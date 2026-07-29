export interface PageData {
  finalUrl: string;
  status: number;
  html: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  viewport: string | null;
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  h1s: string[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string | null }[];
  links: { href: string }[];
  forms: { hasLabelsForAllInputs: boolean; inputCount: number; fields: string[] }[];
  buttons: { hasAccessibleName: boolean }[];
  jsonLd: unknown[];
  bodyText: string;
  isHttps: boolean;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 3_000_000;

async function timedFetch(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrowthAuditBot/1.0; +https://growthaudit.app)' },
      redirect: 'follow',
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await timedFetch(url);
  if (!res) return { ok: false, status: 0, text: '' };
  const text = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, text };
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
    html: '',
    title: null,
    metaDescription: null,
    canonical: null,
    viewport: null,
    openGraph: {},
    twitterCard: {},
    h1s: [],
    headings: [],
    images: [],
    links: [],
    forms: [],
    buttons: [],
    jsonLd: [],
    bodyText: '',
    isHttps: finalUrl.startsWith('https://'),
  };

  let jsonLdBuffer = '';

  const rewriter = new HTMLRewriter()
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
        if (href) page.links.push({ href });
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
        page.buttons.push({ hasAccessibleName: !!el.getAttribute('aria-label') });
      },
    })
    .on('script[type="application/ld+json"]', {
      text(text) {
        jsonLdBuffer += text.text;
        if (text.lastInTextNode) {
          try {
            page.jsonLd.push(JSON.parse(jsonLdBuffer));
          } catch {
            // ignore malformed JSON-LD blocks
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
