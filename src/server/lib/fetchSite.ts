export interface PageData {
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  title: string | null;
  metaDescription: string | null;
  metaRobots: string | null;
  canonical: string | null;
  viewport: string | null;
  htmlLang: string | null;
  charset: string | null;
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  h1s: string[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string | null }[];
  links: { href: string; text: string }[];
  iframes: { title: string | null }[];
  ids: string[];
  forms: { hasLabelsForAllInputs: boolean; inputCount: number; fields: string[] }[];
  buttons: { hasAccessibleName: boolean; text: string }[];
  jsonLd: unknown[];
  jsonLdParseErrors: number;
  bodyText: string;
  isHttps: boolean;
}

const FETCH_TIMEOUT_MS = 8000;
const LINK_CHECK_TIMEOUT_MS = 6000;
const MAX_BODY_BYTES = 3_000_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; GrowthAuditBot/1.0; +https://growthaudit.app)';

async function timedFetch(url: string, opts: { timeoutMs?: number; method?: string; redirect?: RequestRedirect } = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: opts.redirect ?? 'follow',
      method: opts.method ?? 'GET',
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Actually requests the plain-http:// version of the site's origin and checks whether it
 * redirects to https — rather than assuming this from the https-served page alone. Returns
 * null if the http:// origin can't be reached at all (some hosts refuse plain HTTP outright,
 * which isn't the same as "doesn't redirect").
 */
export async function checkHttpToHttpsRedirect(httpsUrl: string): Promise<boolean | null> {
  let httpOrigin: string;
  try {
    const url = new URL(httpsUrl);
    if (url.protocol !== 'https:') return null;
    httpOrigin = `http://${url.host}/`;
  } catch {
    return null;
  }
  const res = await timedFetch(httpOrigin, { timeoutMs: 6000 });
  if (!res) return null;
  return res.url.startsWith('https://');
}

export async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await timedFetch(url);
  if (!res) return { ok: false, status: 0, text: '' };
  const text = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, text };
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

export async function fetchAndParse(
  targetUrl: string,
): Promise<{ page: PageData | null; robotsTxt: string | null; sitemapXml: string | null; error?: string }> {
  const res = await timedFetch(targetUrl);
  if (!res) {
    return {
      page: null,
      robotsTxt: null,
      sitemapXml: null,
      error: 'Could not reach the website. It may be down or blocking automated requests.',
    };
  }

  const finalUrl = res.url || targetUrl;

  const page: PageData = {
    finalUrl,
    status: res.status,
    headers: headersToRecord(res.headers),
    html: '',
    title: null,
    metaDescription: null,
    metaRobots: null,
    canonical: null,
    viewport: null,
    htmlLang: null,
    charset: null,
    openGraph: {},
    twitterCard: {},
    h1s: [],
    headings: [],
    images: [],
    links: [],
    iframes: [],
    ids: [],
    forms: [],
    buttons: [],
    jsonLd: [],
    jsonLdParseErrors: 0,
    bodyText: '',
    isHttps: finalUrl.startsWith('https://'),
  };

  let jsonLdBuffer = '';
  let linkTextBuffer = '';
  let buttonTextBuffer = '';

  const rewriter = new HTMLRewriter()
    .on('html', {
      element(el) {
        page.htmlLang = el.getAttribute('lang');
      },
    })
    .on('title', {
      text(text) {
        page.title = ((page.title ?? '') + text.text).trim() || page.title;
      },
    })
    .on('meta', {
      element(el) {
        const name = (el.getAttribute('name') || '').toLowerCase();
        const property = (el.getAttribute('property') || '').toLowerCase();
        const content = el.getAttribute('content') || '';
        if (name === 'description') page.metaDescription = content;
        if (name === 'viewport') page.viewport = content;
        if (name === 'robots') page.metaRobots = content;
        if (el.getAttribute('charset')) page.charset = el.getAttribute('charset');
        if (property.startsWith('og:')) page.openGraph[property] = content;
        if (name.startsWith('twitter:')) page.twitterCard[name] = content;
      },
    })
    .on('link', {
      element(el) {
        const rel = (el.getAttribute('rel') || '').toLowerCase();
        if (rel === 'canonical') page.canonical = el.getAttribute('href');
      },
    })
    .on('img', {
      element(el) {
        page.images.push({ src: el.getAttribute('src') || '', alt: el.getAttribute('alt') });
      },
    })
    .on('a', {
      element(el) {
        const href = el.getAttribute('href');
        if (href) {
          page.links.push({ href, text: '' });
        }
      },
      text(text) {
        if (page.links.length === 0) return;
        linkTextBuffer += text.text;
        if (text.lastInTextNode) {
          page.links[page.links.length - 1].text = linkTextBuffer.trim();
          linkTextBuffer = '';
        }
      },
    })
    .on('iframe', {
      element(el) {
        page.iframes.push({ title: el.getAttribute('title') });
      },
    })
    .on('[id]', {
      element(el) {
        const id = el.getAttribute('id');
        if (id) page.ids.push(id);
      },
    })
    .on('form', {
      element() {
        page.forms.push({ hasLabelsForAllInputs: true, inputCount: 0, fields: [] });
      },
    })
    .on('input, textarea, select', {
      element(el) {
        const form = page.forms[page.forms.length - 1];
        if (!form) return;
        const type = el.getAttribute('type') || 'text';
        if (type === 'hidden' || type === 'submit' || type === 'button') return;
        form.inputCount += 1;
        form.fields.push(el.getAttribute('name') || type);
        const hasAriaLabel = !!el.getAttribute('aria-label') || !!el.getAttribute('aria-labelledby');
        const hasId = !!el.getAttribute('id');
        if (!hasAriaLabel && !hasId && !el.getAttribute('placeholder')) {
          form.hasLabelsForAllInputs = false;
        }
      },
    })
    .on('button', {
      element(el) {
        page.buttons.push({ hasAccessibleName: !!el.getAttribute('aria-label'), text: '' });
      },
      text(text) {
        if (page.buttons.length === 0) return;
        buttonTextBuffer += text.text;
        if (text.lastInTextNode) {
          page.buttons[page.buttons.length - 1].text = buttonTextBuffer.trim();
          buttonTextBuffer = '';
        }
      },
    })
    .on('script[type="application/ld+json"]', {
      text(text) {
        jsonLdBuffer += text.text;
        if (text.lastInTextNode) {
          try {
            page.jsonLd.push(JSON.parse(jsonLdBuffer));
          } catch {
            page.jsonLdParseErrors += 1;
          }
          jsonLdBuffer = '';
        }
      },
    });

  let html = '';
  try {
    html = await rewriter.transform(res).text();
  } catch {
    return { page: null, robotsTxt: null, sitemapXml: null, error: 'Failed to parse the website HTML.' };
  }

  page.html = html.length > MAX_BODY_BYTES ? html.slice(0, MAX_BODY_BYTES) : html;

  const headingMatches = [...page.html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  page.headings = headingMatches.map((m) => ({ level: Number(m[1]), text: stripTags(m[2]).trim() }));
  page.h1s = page.headings.filter((h) => h.level === 1).map((h) => h.text);
  page.bodyText = stripTags(page.html).replace(/\s+/g, ' ').trim().slice(0, 20000);

  const origin = new URL(finalUrl).origin;
  const [robots, sitemap] = await Promise.allSettled([fetchText(`${origin}/robots.txt`), fetchText(`${origin}/sitemap.xml`)]);

  return {
    page,
    robotsTxt: robots.status === 'fulfilled' && robots.value.ok ? robots.value.text : null,
    sitemapXml: sitemap.status === 'fulfilled' && sitemap.value.ok ? sitemap.value.text : null,
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

const IMPORTANT_PATH_HINTS = ['about', 'contact', 'services', 'service', 'pricing', 'products', 'shop'];

/**
 * Picks up to `maxPages - 1` additional important URLs to audit alongside the homepage —
 * from the sitemap first (if present), then from same-host links found on the homepage,
 * prioritising common important paths (about/contact/services/etc). Bounded and deduped;
 * never crawls beyond the site's own declared/linked pages.
 */
export function discoverPages(homepageUrl: string, sitemapXml: string | null, homepageLinks: { href: string }[], maxPages = 5): string[] {
  const base = new URL(homepageUrl);
  const seen = new Set<string>([normalizeForDedupe(homepageUrl)]);
  const picked: string[] = [];
  const limit = Math.max(0, maxPages - 1);

  function tryAdd(rawUrl: string): boolean {
    let url: URL;
    try {
      url = new URL(rawUrl, base);
    } catch {
      return false;
    }
    if (url.host !== base.host) return false;
    if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|ico|xml)$/i.test(url.pathname)) return false;
    const key = normalizeForDedupe(url.toString());
    if (seen.has(key)) return false;
    seen.add(key);
    picked.push(url.toString());
    return true;
  }

  if (sitemapXml) {
    const locs = [...sitemapXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    const prioritized = [
      ...locs.filter((l) => IMPORTANT_PATH_HINTS.some((hint) => l.toLowerCase().includes(hint))),
      ...locs,
    ];
    for (const loc of prioritized) {
      if (picked.length >= limit) break;
      tryAdd(loc);
    }
  }

  if (picked.length < limit) {
    const linkHrefs = homepageLinks.map((l) => l.href);
    const prioritized = [
      ...linkHrefs.filter((l) => IMPORTANT_PATH_HINTS.some((hint) => l.toLowerCase().includes(hint))),
      ...linkHrefs,
    ];
    for (const href of prioritized) {
      if (picked.length >= limit) break;
      tryAdd(href);
    }
  }

  return picked;
}

function normalizeForDedupe(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname.replace(/\/+$/, '') || '/'}`;
  } catch {
    return url;
  }
}

export interface LinkCheckResult {
  href: string;
  status: number | null;
  ok: boolean;
  isInternal: boolean;
}

/**
 * Actually checks whether links resolve — bounded HEAD requests (falling back to GET when a
 * server rejects HEAD) with a short per-link timeout, run concurrently via Promise.allSettled
 * so one slow/dead host can't stall the whole audit. This replaces a check that previously
 * always reported "passed" without ever making a request.
 */
export async function checkLinkStatuses(
  links: { href: string }[],
  baseUrl: string,
  opts: { internalLimit?: number; externalLimit?: number } = {},
): Promise<LinkCheckResult[]> {
  const internalLimit = opts.internalLimit ?? 15;
  const externalLimit = opts.externalLimit ?? 5;
  const base = new URL(baseUrl);

  const seen = new Set<string>();
  const internal: string[] = [];
  const external: string[] = [];

  for (const { href } of links) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    if (url.host === base.host) {
      if (internal.length < internalLimit) internal.push(key);
    } else if (external.length < externalLimit) {
      external.push(key);
    }
  }

  const targets = [
    ...internal.map((href) => ({ href, isInternal: true })),
    ...external.map((href) => ({ href, isInternal: false })),
  ];

  const results = await Promise.allSettled(
    targets.map(async ({ href, isInternal }): Promise<LinkCheckResult> => {
      let res = await timedFetch(href, { method: 'HEAD', timeoutMs: LINK_CHECK_TIMEOUT_MS });
      if (!res || res.status === 405 || res.status === 501) {
        res = await timedFetch(href, { method: 'GET', timeoutMs: LINK_CHECK_TIMEOUT_MS });
      }
      return { href, status: res?.status ?? null, ok: !!res && res.status < 400, isInternal };
    }),
  );

  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { href: targets[i].href, status: null, ok: false, isInternal: targets[i].isInternal },
  );
}
