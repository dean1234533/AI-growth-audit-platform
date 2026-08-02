import type { CheckResult, MeasurementType } from '../../../lib/types';
import type { PageData } from '../fetchSite';
import { hasGoogleLocationLink } from './shared/googleLocationLinks';
import { isSoftwareProductSite } from './shared/siteType';

function check(
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: CheckResult['severity'],
  weight: number,
  measurementType: MeasurementType = 'detected',
): CheckResult {
  return { id, category: 'localSeo', label, passed, detail, severity, weight, measurementType };
}

/** Not a real fail — this check only makes sense for a local/physical business, and the page
 * has explicitly declared itself a software product instead (see isSoftwareProductSite). Shown
 * as passed + weight 0 so it neither counts against the score nor produces a recommendation,
 * exactly like the existing not_available pattern used elsewhere (e.g. performance checks with
 * no PageSpeed key configured) — never silently omitted, never presented as a confirmed gap. */
function notApplicableToSoftware(id: string, label: string): CheckResult {
  return {
    id,
    category: 'localSeo',
    label,
    passed: true,
    detail: 'Not applicable — this page identifies itself as a software product, not a local business.',
    severity: 'info',
    weight: 0,
    measurementType: 'not_available',
  };
}

export interface LocalSeoCheckOptions {
  /** User-supplied location hint from the audit intake form, e.g. "Bristol". */
  location?: string;
}

export function runLocalSeoChecks(page: PageData, opts: LocalSeoCheckOptions = {}): CheckResult[] {
  const results: CheckResult[] = [];
  const html = page.html;
  const text = page.bodyText;
  const isSoftwareProduct = isSoftwareProductSite(page.jsonLd);

  if (isSoftwareProduct) {
    results.push(notApplicableToSoftware('local.gbp', 'Google Business Profile linked'));
    results.push(notApplicableToSoftware('local.nap', 'Name/Address/Phone consistently present'));
    results.push(notApplicableToSoftware('local.locationPages', 'Dedicated location/service-area pages'));
    results.push(notApplicableToSoftware('local.serviceAreas', 'Service areas listed'));
    results.push(notApplicableToSoftware('local.reviews', 'Review count/rating displayed'));
    return results;
  }

  const hasGbp = hasGoogleLocationLink(html);
  results.push(check('local.gbp', 'Google Business Profile linked', hasGbp, hasGbp ? 'Google Business Profile / Maps link found' : 'No Google Business Profile link found', 'high', 9));

  // Full UK postcode is the strong signal; an outward code alone (e.g. "E15", common for
  // privacy-conscious home-based businesses that don't want to publish a full address) is a
  // weaker but still-genuine one — don't fail a business for reasonably protecting its address.
  const hasFullPostcode = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/.test(text);
  const hasOutwardCodeOnly = !hasFullPostcode && /\b[A-Z]{1,2}\d[A-Z\d]?\b/.test(text);
  const hasStreetAddress = /\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,30}(street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b/i.test(text);
  const hasAddressPattern = hasStreetAddress || hasFullPostcode || hasOutwardCodeOnly;
  results.push(
    check(
      'local.nap',
      'Name/Address/Phone consistently present',
      hasAddressPattern,
      hasStreetAddress || hasFullPostcode
        ? 'Address-like pattern found on page'
        : hasOutwardCodeOnly
          ? 'A postcode district was found (no full postcode) — a weaker but still genuine location signal'
          : 'No clear address pattern found on homepage',
      'medium',
      6,
    ),
  );

  // The compound phrasing check ("areas-we-cover", "service-area") stays; add a second,
  // pathname-aware check for the equally common convention of a bare "/areas" or "/locations"
  // hub with individual place pages nested under it (e.g. "/areas/wanstead") — checked via the
  // URL's first path segment specifically, not a raw href substring match, so it doesn't also
  // match unrelated things like "/account/member-area".
  const keywordMatch = /href=["'][^"']*(locations?|areas?-we-cover|service-areas?)[^"']*["']/i.test(html);
  const hasAreaOrLocationHub = hasTopLevelAreaOrLocationLink(page.links, page.finalUrl);
  const cluster = detectLocationPageCluster(page.links, page.finalUrl);
  const hasLocationPages = keywordMatch || hasAreaOrLocationHub || cluster.found;
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

  // Tolerate real-world phrasing between the number and "reviews"/"ratings" (e.g. "9 verified
  // Google Reviews") and "X out of 5" as well as "X/5" — the original tight patterns only
  // matched adjacency, which most genuine review widgets don't use verbatim.
  const hasReviewCount = /\b\d+(\.\d)?\s*(?:\/|out of)\s*5\b|\b\d+\s+(?:\w+\s+){0,3}(reviews|ratings)\b|★{3,}/i.test(text);
  results.push(check('local.reviews', 'Review count/rating displayed', hasReviewCount, hasReviewCount ? 'Review/rating pattern found' : 'No review count or rating displayed on homepage', 'high', 8));

  const localBusinessBlock = findLocalBusinessBlock(page.jsonLd);
  if (localBusinessBlock) {
    const missing: string[] = [];
    if (!localBusinessBlock.name) missing.push('name');
    if (!localBusinessBlock.address) missing.push('address');
    if (!localBusinessBlock.telephone) missing.push('telephone');
    results.push(
      check(
        'local.schemaCompleteness',
        'LocalBusiness schema has required properties',
        missing.length === 0,
        missing.length === 0 ? 'name, address and telephone are all present in the schema' : `LocalBusiness schema is missing: ${missing.join(', ')}`,
        'medium',
        5,
      ),
    );
  }

  const location = opts.location?.trim();
  if (location) {
    const needle = location.toLowerCase();
    const haystack = `${page.title ?? ''} ${page.metaDescription ?? ''} ${page.h1s.join(' ')}`.toLowerCase();
    const mentionsLocation = haystack.includes(needle);
    results.push(
      check(
        'local.locationRelevance',
        `Mentions "${location}" in title, meta description or H1`,
        mentionsLocation,
        mentionsLocation ? `"${location}" found in the page's title, meta description or H1` : `"${location}" was not found in the title, meta description or H1 — this can weaken relevance for local searches`,
        'high',
        7,
      ),
    );
  }

  return results;
}

/**
 * Finds the first LocalBusiness/Organization-typed JSON-LD block — unwraps plain arrays and the
 * schema.org `@graph` convention (multiple distinct entities bundled in one <script> tag), not
 * just a block's own top-level `@type` (caught live in remote testing: without this, an entity
 * nested inside `@graph` alongside e.g. a BreadcrumbList/SoftwareApplication was invisible here).
 */
function findLocalBusinessBlock(blocks: unknown[]): Record<string, unknown> | null {
  const types = ['LocalBusiness', 'Organization', 'HomeAndConstructionBusiness'];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const graph = (block as Record<string, unknown>)['@graph'];
    const items = Array.isArray(block) ? block : Array.isArray(graph) ? graph : [block];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const t = obj['@type'];
      const typeList = Array.isArray(t) ? t : [t];
      if (typeList.some((tt) => typeof tt === 'string' && types.includes(tt))) return obj;
    }
  }
  return null;
}

const AREA_OR_LOCATION_SEGMENTS = new Set(['area', 'areas', 'location', 'locations', 'service-area', 'service-areas']);

/**
 * Catches the "/areas/wanstead", "/locations/ilford" convention — a hub path whose *first*
 * segment is exactly "area(s)"/"location(s)" with at least one page nested under it. Checked
 * against the URL's parsed first path segment specifically (not a raw href substring), so it
 * doesn't also match unrelated things like "/account/member-area".
 */
function hasTopLevelAreaOrLocationLink(links: { href: string }[], baseUrl: string): boolean {
  const base = new URL(baseUrl);
  return links.some(({ href }) => {
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      return false;
    }
    if (url.host !== base.host) return false;
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length >= 2 && AREA_OR_LOCATION_SEGMENTS.has(segments[0].toLowerCase());
  });
}

const LOCATION_CLUSTER_THRESHOLD = 4;

/**
 * Many sites publish a page per town/suburb served, either flat (e.g. "/personal-trainer-
 * stratford", "/personal-trainer-ilford") or nested under a shared hub segment (e.g.
 * "/areas/wanstead", "/areas/ilford") — neither necessarily using the words "location" or
 * "area" in every individual page's own slug. Detect the flat form by grouping same-host,
 * single-segment link slugs by their leading or trailing two hyphen-separated tokens; detect
 * the nested form by grouping two-segment links by their shared first segment. A cluster of
 * 4+ slugs sharing a prefix/suffix, or 3+ pages under the same hub segment, is a strong signal.
 */
function detectLocationPageCluster(links: { href: string }[], baseUrl: string): { found: boolean; count: number; example: string } {
  const base = new URL(baseUrl);
  const counts = new Map<string, string[]>();

  const nestedHubs = new Map<string, string[]>();
  const NESTED_HUB_THRESHOLD = 3;

  for (const { href } of links) {
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.host !== base.host) continue;

    const allSegments = url.pathname.split('/').filter(Boolean);
    if (allSegments.length === 2) {
      const hub = allSegments[0].toLowerCase();
      const list = nestedHubs.get(hub) ?? [];
      if (!list.includes(allSegments[1].toLowerCase())) list.push(allSegments[1].toLowerCase());
      nestedHubs.set(hub, list);
    }

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

  let bestHub: { hub: string; pages: string[] } | null = null;
  for (const [hub, pages] of nestedHubs.entries()) {
    if (!bestHub || pages.length > bestHub.pages.length) bestHub = { hub, pages };
  }
  if (bestHub && bestHub.pages.length >= NESTED_HUB_THRESHOLD && bestHub.pages.length > best.length) {
    return { found: true, count: bestHub.pages.length, example: `${bestHub.hub}/${bestHub.pages[0]}` };
  }

  return { found: best.length >= LOCATION_CLUSTER_THRESHOLD, count: best.length, example: best[0] ?? '' };
}
