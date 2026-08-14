import type { CheckResult, MeasurementType } from '../../../lib/types';
import type { PageData, LinkCheckResult } from '../fetchSite';
import type { RenderedPageData } from '../renderPage';
import { looksLikeJsAppShell } from './shared/jsShellDetection';

function check(
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: CheckResult['severity'],
  weight: number,
  measurementType: MeasurementType = 'detected',
): CheckResult {
  return { id, category: 'seo', label, passed, detail, severity, weight, measurementType };
}

export interface SeoCheckOptions {
  /** Result of actually requesting the http:// origin — null if not checked/not applicable. */
  httpsRedirects?: boolean | null;
  /** Real HEAD/GET results for a bounded sample of links — replaces the old always-passing check. */
  linkCheckResults?: LinkCheckResult[];
  /** Other discovered pages' title/meta, for cross-page duplicate detection. */
  otherPages?: { url: string; title: string | null; metaDescription: string | null }[];
  /** True when the page was classified as a web application rather than a local business — see
   * classifySiteType in shared/siteType.ts. Skips checks that only make sense for a physical/
   * local business. */
  isApp?: boolean;
}

export function runSeoChecks(page: PageData, robotsTxt: string | null, sitemapXml: string | null, opts: SeoCheckOptions = {}, rendered?: RenderedPageData | null): CheckResult[] {
  const results: CheckResult[] = [];

  // Prefer the rendered DOM's JSON-LD/headings/images when available — GTM/tag-manager and
  // JS-framework sites commonly inject structured data and even headings client-side, which a
  // static HTML fetch never sees at all (a false "missing schema", not just low confidence).
  // The rendered snapshot already includes everything server-rendered too, so it's used as the
  // sole source rather than merged with the static one, to avoid double-counting the same
  // blocks as "duplicates".
  const jsonLd = rendered ? rendered.jsonLd : page.jsonLd;
  const h1s = rendered ? rendered.h1s : page.h1s;
  const headings = rendered ? rendered.headings : page.headings;
  const images = rendered ? rendered.images : page.images;
  const structuredDataSource: MeasurementType = rendered ? 'measured' : 'detected';
  // See jsShellDetection.ts — only downgrades a genuine "no H1 found" to not_verified when the
  // static HTML itself looks like an unrendered JS-app shell, never just because rendering was
  // unavailable. A real static page's genuinely missing H1 still fails, as before.
  const isLikelyShell = !rendered && looksLikeJsAppShell(page);

  const title = page.title?.trim() ?? '';
  results.push(check('seo.missingTitle', 'Page title present', title.length > 0, title.length > 0 ? `Title: "${title}"` : 'No <title> tag found', 'critical', 10));

  if (title.length > 0) {
    const good = title.length >= 30 && title.length <= 60;
    results.push(check('seo.titleLength', 'Title length optimal (30-60 chars)', good, `Title is ${title.length} characters`, 'medium', 6));
  }

  const desc = page.metaDescription?.trim() ?? '';
  results.push(check('seo.missingMetaDescription', 'Meta description present', desc.length > 0, desc.length === 0 ? 'No meta description found' : `Meta description is ${desc.length} characters`, 'high', 8));
  if (desc.length > 0) {
    const optimalLength = desc.length >= 50 && desc.length <= 160;
    results.push(check('seo.metaDescriptionLength', 'Meta description length optimal (50-160 chars)', optimalLength, `Meta description is ${desc.length} characters`, 'low', 4));
  }

  if (h1s.length === 0 && isLikelyShell) {
    results.push({
      id: 'seo.missingH1',
      category: 'seo',
      label: 'Exactly one H1 present',
      passed: true,
      detail: 'No H1 was found in the static HTML, but this page matches a JavaScript-app shell pattern — headings are likely rendered by JavaScript this scan could not execute.',
      severity: 'info',
      weight: 0,
      measurementType: 'not_available',
      status: 'not_verified',
    });
  } else {
    results.push(check('seo.missingH1', 'Exactly one H1 present', h1s.length === 1, h1s.length === 0 ? 'No H1 tag found' : `${h1s.length} H1 tag(s) found`, 'high', 8, structuredDataSource));
  }
  if (h1s.length > 1) {
    results.push(check('seo.multipleH1', 'Single H1 (not multiple)', false, `${h1s.length} H1 tags found`, 'low', 3, structuredDataSource));
  }

  const h2Count = headings.filter((h) => h.level === 2).length;
  results.push(check('seo.h2Structure', 'H2 subheadings used to structure content', h2Count > 0, h2Count > 0 ? `${h2Count} H2 heading(s) found` : 'No H2 subheadings found — content may lack clear structure', 'low', 3));

  const ogCount = Object.keys(page.openGraph).length;
  results.push(check('seo.openGraph', 'Open Graph tags present', ogCount >= 3, ogCount === 0 ? 'No Open Graph tags found' : `${ogCount} Open Graph tag(s) found`, 'low', 4));

  const twCount = Object.keys(page.twitterCard).length;
  results.push(check('seo.twitterCard', 'Twitter Card tags present', twCount >= 2, twCount === 0 ? 'No Twitter Card tags found' : `${twCount} Twitter Card tag(s) found`, 'low', 3));

  results.push(check('seo.canonical', 'Canonical URL present', !!page.canonical, page.canonical ? `Canonical: ${page.canonical}` : 'No canonical tag found', 'low', 4));

  if (page.canonical) {
    const canonicalMatches = canonicalResolvesToSelf(page.canonical, page.finalUrl);
    results.push(check('seo.canonicalConsistency', 'Canonical URL points to this page', canonicalMatches, canonicalMatches ? 'Canonical URL matches the page it\'s declared on' : `Canonical (${page.canonical}) does not match the page URL (${page.finalUrl})`, 'medium', 5));
  }

  const robotsContent = (page.metaRobots ?? '').toLowerCase();
  const xRobotsHeader = (page.headers['x-robots-tag'] ?? '').toLowerCase();
  const isNoindex = robotsContent.includes('noindex') || xRobotsHeader.includes('noindex');
  results.push(check('seo.indexable', 'Page is indexable (no noindex)', !isNoindex, isNoindex ? `noindex found in ${robotsContent.includes('noindex') ? 'meta robots' : 'X-Robots-Tag header'}` : 'No noindex directive found', 'critical', 10));

  const isNofollow = robotsContent.includes('nofollow') || xRobotsHeader.includes('nofollow');
  if (isNofollow) {
    results.push(check('seo.nofollow', 'Page does not block link-following', false, `nofollow found in ${robotsContent.includes('nofollow') ? 'meta robots' : 'X-Robots-Tag header'}`, 'medium', 4));
  }

  results.push(check('seo.httpStatus', 'Page returns a successful HTTP status', page.status >= 200 && page.status < 300, `HTTP ${page.status}`, page.status >= 500 ? 'critical' : page.status >= 400 ? 'high' : 'low', page.status >= 400 ? 8 : 2));

  if (opts.httpsRedirects !== undefined && opts.httpsRedirects !== null) {
    results.push(check('seo.httpsRedirect', 'HTTP requests redirect to HTTPS', opts.httpsRedirects, opts.httpsRedirects ? 'http:// origin redirects to https://' : 'http:// origin does NOT redirect to https:// — visitors typing the plain address stay unencrypted', 'high', 7));
  }

  results.push(check('seo.robotsTxt', 'robots.txt present', !!robotsTxt, robotsTxt ? 'robots.txt found' : 'No robots.txt found', 'low', 4));

  if (robotsTxt) {
    const referencesSitemap = /sitemap:/i.test(robotsTxt);
    results.push(check('seo.robotsReferencesSitemap', 'robots.txt references the sitemap', referencesSitemap, referencesSitemap ? 'Sitemap: directive found in robots.txt' : 'No Sitemap: directive found in robots.txt', 'low', 3));
  }

  results.push(check('seo.sitemap', 'sitemap.xml present', !!sitemapXml, sitemapXml ? 'sitemap.xml found' : 'No sitemap.xml found', 'medium', 6));

  if (sitemapXml) {
    const urlCount = (sitemapXml.match(/<loc>/gi) || []).length;
    results.push(check('seo.sitemapUrls', 'Sitemap lists at least one URL', urlCount > 0, urlCount > 0 ? `${urlCount} URL(s) listed in sitemap.xml` : 'sitemap.xml exists but lists no URLs', 'medium', 4));
  }

  const imagesMissingAlt = images.filter((img) => !img.alt || img.alt.trim() === '');
  results.push(check('seo.imageAlt', 'Images have alt text', images.length === 0 || imagesMissingAlt.length === 0, images.length === 0 ? 'No images found' : `${imagesMissingAlt.length} of ${images.length} images missing alt text`, 'medium', 7, structuredDataSource));

  results.push(check('seo.structuredData', 'Structured data (schema.org) present', jsonLd.length > 0, jsonLd.length > 0 ? `${jsonLd.length} structured data block(s) found` : 'No structured data found', 'high', 9, structuredDataSource));

  if (page.jsonLdParseErrors > 0) {
    results.push(check('seo.structuredDataValid', 'Structured data is valid JSON', false, `${page.jsonLdParseErrors} JSON-LD block(s) failed to parse — invalid JSON syntax`, 'high', 6));
  }

  const schemaTypes = collectJsonLdTypes(jsonLd);
  const duplicateTypes = [...schemaTypes.entries()].filter(([, count]) => count > 1).map(([t]) => t);
  if (duplicateTypes.length > 0) {
    results.push(check('seo.duplicateSchema', 'No duplicate structured data types', false, `Duplicate schema type(s) found: ${duplicateTypes.join(', ')}`, 'low', 3, structuredDataSource));
  }

  if (opts.isApp) {
    results.push({
      id: 'seo.localBusinessSchema',
      category: 'seo',
      label: 'LocalBusiness schema present',
      passed: true,
      detail: 'Not applicable — this page was identified as a web application, not a local business.',
      severity: 'info',
      weight: 0,
      measurementType: 'not_available',
    });
  } else {
    const hasLocalBusiness = jsonLdHasType(jsonLd, ['LocalBusiness', 'Organization', 'HomeAndConstructionBusiness']);
    results.push(check('seo.localBusinessSchema', 'LocalBusiness schema present', hasLocalBusiness, hasLocalBusiness ? 'LocalBusiness/Organization schema found' : 'No LocalBusiness schema found', 'high', 8, structuredDataSource));
  }

  const hasFaqSchema = jsonLdHasType(jsonLd, ['FAQPage']);
  results.push(check('seo.faqSchema', 'FAQ schema present', hasFaqSchema, hasFaqSchema ? 'FAQPage schema found' : 'No FAQPage schema found', 'low', 3, structuredDataSource));

  const hasBreadcrumb = jsonLdHasType(jsonLd, ['BreadcrumbList']);
  const isHomepage = (() => {
    try {
      return new URL(page.finalUrl).pathname.replace(/\/+$/, '') === '';
    } catch {
      return false;
    }
  })();
  if (isHomepage) {
    // A breadcrumb trail is contextually meaningless on the root page — this must never read
    // as "missing," which would incorrectly suggest the site's breadcrumb implementation
    // (verified correct on every other page type, e.g. tool/blog pages) has a gap.
    results.push({ id: 'seo.breadcrumbSchema', category: 'seo', label: 'Breadcrumb schema present', passed: true, detail: 'Not applicable — breadcrumbs are not meaningful on a homepage', severity: 'info', weight: 0, measurementType: 'detected', status: 'not_applicable' });
  } else {
    results.push(check('seo.breadcrumbSchema', 'Breadcrumb schema present', hasBreadcrumb, hasBreadcrumb ? 'BreadcrumbList schema found' : 'No BreadcrumbList schema found', 'low', 3, structuredDataSource));
  }

  if (opts.linkCheckResults && opts.linkCheckResults.length > 0) {
    // l.ok is already confidence-aware (fetchSite.ts's classifyLinkStatus) — only a genuine
    // 'broken' (404/410/5xx) counts against `!l.ok`. A 'blocked' link (bot-protected, e.g. a
    // 403 from Instagram) is real, working evidence of nothing being wrong, not a failure.
    const brokenInternal = opts.linkCheckResults.filter((l) => l.isInternal && l.confidence === 'broken');
    results.push(
      check(
        'seo.brokenLinks',
        'No broken internal links',
        brokenInternal.length === 0,
        brokenInternal.length === 0
          ? `${opts.linkCheckResults.filter((l) => l.isInternal).length} internal link(s) checked, none broken`
          : `${brokenInternal.length} broken internal link(s) found: ${brokenInternal.slice(0, 3).map((l) => `${l.href} (${l.status ?? 'unreachable'})`).join(', ')}`,
        'high',
        8,
        'measured',
      ),
    );

    const brokenExternal = opts.linkCheckResults.filter((l) => !l.isInternal && l.confidence === 'broken');
    if (opts.linkCheckResults.some((l) => !l.isInternal)) {
      results.push(
        check(
          'seo.brokenExternalLinks',
          'No broken external links',
          brokenExternal.length === 0,
          brokenExternal.length === 0
            ? `${opts.linkCheckResults.filter((l) => !l.isInternal).length} external link(s) checked, none broken`
            : `${brokenExternal.length} broken external link(s) found: ${brokenExternal.slice(0, 3).map((l) => l.href).join(', ')}`,
          'medium',
          4,
          'measured',
        ),
      );
    }

    const blocked = opts.linkCheckResults.filter((l) => l.confidence === 'blocked');
    if (blocked.length > 0) {
      results.push({
        id: 'seo.blockedLinks',
        category: 'seo',
        label: 'Links that could not be independently verified',
        passed: true,
        detail: `${blocked.length} link(s) could not be independently verified because the destination restricted automated access (e.g. ${blocked.slice(0, 3).map((l) => `${l.href} — HTTP ${l.status}`).join(', ')}) — this is routine bot-protection, not evidence the link is broken`,
        severity: 'info',
        weight: 0,
        measurementType: 'measured',
        status: 'not_verified',
      });
    }
  } else {
    const internalLinks = page.links.filter((l) => isInternalLink(l.href, page.finalUrl));
    results.push(check('seo.brokenLinks', 'Broken link check', true, `${internalLinks.length} internal link(s) found; not checked for this scan`, 'info', 0, 'not_available'));
  }

  if (opts.otherPages && opts.otherPages.length > 0) {
    const allTitles = [{ url: page.finalUrl, title }, ...opts.otherPages.map((p) => ({ url: p.url, title: p.title?.trim() ?? '' }))];
    const titleGroups = new Map<string, string[]>();
    for (const { url, title: t } of allTitles) {
      if (!t) continue;
      const list = titleGroups.get(t) ?? [];
      list.push(url);
      titleGroups.set(t, list);
    }
    const duplicateTitleGroup = [...titleGroups.values()].find((urls) => urls.length > 1);
    if (duplicateTitleGroup) {
      results.push(check('seo.duplicateTitle', 'No duplicate titles across pages', false, `${duplicateTitleGroup.length} pages share the same title tag`, 'medium', 5));
    }

    const allDescs = [{ url: page.finalUrl, desc }, ...opts.otherPages.map((p) => ({ url: p.url, desc: p.metaDescription?.trim() ?? '' }))];
    const descGroups = new Map<string, string[]>();
    for (const { url, desc: d } of allDescs) {
      if (!d) continue;
      const list = descGroups.get(d) ?? [];
      list.push(url);
      descGroups.set(d, list);
    }
    const duplicateDescGroup = [...descGroups.values()].find((urls) => urls.length > 1);
    if (duplicateDescGroup) {
      results.push(check('seo.duplicateMetaDescription', 'No duplicate meta descriptions across pages', false, `${duplicateDescGroup.length} pages share the same meta description`, 'medium', 4));
    }
  }

  return results;
}

/**
 * Flattens every JSON-LD block into a list of individual typed items — unwrapping both plain
 * arrays and, critically, the schema.org `@graph` convention (`{"@context":..., "@graph": [...]}`
 * used to bundle several distinct entities — e.g. BreadcrumbList, SoftwareApplication, and
 * FAQPage — into a single <script> tag. Caught live in remote testing: the previous version only
 * ever checked a block's own top-level `@type`, so anything nested inside `@graph` was invisible
 * to every type-presence check below, even though it was genuinely present on the page.
 */
function flattenJsonLdItems(blocks: unknown[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const graph = (block as Record<string, unknown>)['@graph'];
    const candidates = Array.isArray(block) ? block : Array.isArray(graph) ? graph : [block];
    for (const item of candidates) {
      if (item && typeof item === 'object') items.push(item as Record<string, unknown>);
    }
  }
  return items;
}

function collectJsonLdTypes(blocks: unknown[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of flattenJsonLdItems(blocks)) {
    const t = item['@type'];
    const typeList = Array.isArray(t) ? t : [t];
    for (const tt of typeList) {
      if (typeof tt === 'string') counts.set(tt, (counts.get(tt) ?? 0) + 1);
    }
  }
  return counts;
}

function jsonLdHasType(blocks: unknown[], types: string[]): boolean {
  return flattenJsonLdItems(blocks).some((item) => {
    const t = item['@type'];
    const typeList = Array.isArray(t) ? t : [t];
    return typeList.some((tt) => typeof tt === 'string' && types.includes(tt));
  });
}

function isInternalLink(href: string, baseUrl: string): boolean {
  try {
    const base = new URL(baseUrl);
    const url = new URL(href, base);
    return url.host === base.host;
  } catch {
    return false;
  }
}

function canonicalResolvesToSelf(canonical: string, pageUrl: string): boolean {
  try {
    const canonicalUrl = new URL(canonical, pageUrl);
    const self = new URL(pageUrl);
    const normalize = (u: URL) => `${u.host}${u.pathname.replace(/\/+$/, '') || '/'}`;
    return normalize(canonicalUrl) === normalize(self);
  } catch {
    return false;
  }
}
