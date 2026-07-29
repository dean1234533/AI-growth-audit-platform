import type { CheckResult } from '../../../lib/types';
import type { PageData } from '../fetchSite';

function check(id: string, label: string, passed: boolean, detail: string, severity: CheckResult['severity'], weight: number): CheckResult {
  return { id, category: 'localSeo', label, passed, detail, severity, weight };
}

export function runLocalSeoChecks(page: PageData): CheckResult[] {
  const results: CheckResult[] = [];
  const html = page.html;
  const text = page.bodyText;

  const hasGbp = /g\.page\/|goo\.gl\/maps|maps\.google|google\.com\/maps\/place|business\.google\.com/i.test(html);
  results.push(check('local.gbp', 'Google Business Profile linked', hasGbp, hasGbp ? 'Google Business Profile / Maps link found' : 'No Google Business Profile link found', 'high', 9));

  const hasAddressPattern = /\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,30}(street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b/i.test(text) || /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/.test(text);
  results.push(check('local.nap', 'Name/Address/Phone consistently present', hasAddressPattern, hasAddressPattern ? 'Address-like pattern found on page' : 'No clear address pattern found on homepage', 'medium', 6));

  const keywordMatch = /href=["'][^"']*(locations?|areas?-we-cover|service-area)[^"']*["']/i.test(html);
  const cluster = detectLocationPageCluster(page.links, page.finalUrl);
  const hasLocationPages = keywordMatch || cluster.found;
  results.push(
    check(
      'local.locationPages',
      'Dedicated location/service-area pages',
      hasLocationPages,
      hasLocationPages
        ? cluster.found
          ? `${cluster.count} location page(s) detected (e.g. "/${cluster.example}")`
          : 'Location/service-area page link found'
        : 'No dedicated location pages found',
      'high',
      7,
    ),
  );

  const hasServiceAreas = /(serving|we cover|service area|areas we serve|based in)/i.test(text);
  results.push(check('local.serviceAreas', 'Service areas listed', hasServiceAreas, hasServiceAreas ? 'Service-area phrasing found' : 'No service-area phrasing found', 'medium', 5));

  const hasReviewCount = /\b\d+(\.\d)?\s*\/\s*5\b|\b\d+\s*(reviews|ratings)\b|★{3,}/i.test(text);
  results.push(check('local.reviews', 'Review count/rating displayed', hasReviewCount, hasReviewCount ? 'Review/rating pattern found' : 'No review count or rating displayed on homepage', 'high', 8));

  return results;
}

const LOCATION_CLUSTER_THRESHOLD = 4;

/**
 * Many sites publish a page per town/suburb served (e.g. "/personal-trainer-stratford",
 * "/personal-trainer-ilford") without ever using the words "location" or "area" in the
 * URL. Detect this by grouping same-host, single-segment link slugs by their leading or
 * trailing two hyphen-separated tokens — a cluster of 4+ slugs sharing a prefix or suffix
 * (e.g. "personal-trainer") is a strong signal of dedicated location pages.
 */
function detectLocationPageCluster(links: { href: string }[], baseUrl: string): { found: boolean; count: number; example: string } {
  const base = new URL(baseUrl);
  const counts = new Map<string, string[]>();

  for (const { href } of links) {
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.host !== base.host) continue;

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) continue;

    const slug = segments[0].toLowerCase();
    const tokens = slug.split('-').filter(Boolean);
    if (tokens.length < 2) continue;

    const prefixKey = tokens.slice(0, 2).join('-');
    const suffixKey = tokens.slice(-2).join('-');
    for (const key of new Set([prefixKey, suffixKey])) {
      const existing = counts.get(key) ?? [];
      if (!existing.includes(slug)) existing.push(slug);
      counts.set(key, existing);
    }
  }

  let best: string[] = [];
  for (const slugs of counts.values()) {
    if (slugs.length > best.length) best = slugs;
  }

  return { found: best.length >= LOCATION_CLUSTER_THRESHOLD, count: best.length, example: best[0] ?? '' };
}
