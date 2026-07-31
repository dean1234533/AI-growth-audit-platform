/**
 * Detects a link to a Google Business Profile / Google Maps location — used by both
 * localSeo.ts (`local.gbp`) and trust.ts (`trust.googleMaps`), which previously maintained
 * two separately-hand-written regexes that had each drifted to cover a different subset of
 * real-world URL shapes (neither covered `share.google` or `maps.app.goo.gl`). One shared,
 * broader list here instead of two that can silently diverge again.
 *
 * Deliberately hostname/substring-based rather than a single exhaustive regex — Google has
 * shipped several generations of link shape for the same underlying product (g.page, the
 * various maps.google.* / google.com/maps forms, maps.app.goo.gl, and now share.google), and
 * a new one is more likely to be *added* to this list over time than to replace an existing
 * pattern outright.
 */
const GOOGLE_LOCATION_HOSTS = [
  'g.page',
  'goo.gl',
  'maps.google',
  'google.com',
  'business.google.com',
  'maps.app.goo.gl',
  'share.google',
];

export function hasGoogleLocationLink(html: string): boolean {
  const hrefs = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)].map((m) => m[1]);
  return hrefs.some((href) => isGoogleLocationLink(href));
}

export function isGoogleLocationLink(href: string): boolean {
  let hostname: string;
  let pathname: string;
  try {
    const url = new URL(href, 'https://placeholder.invalid');
    hostname = url.hostname.toLowerCase();
    pathname = url.pathname.toLowerCase();
  } catch {
    return false;
  }

  if (!GOOGLE_LOCATION_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) return false;

  // maps.app.goo.gl is single-purpose (Google Maps' own short-link domain) — host match alone
  // is sufficient. Checked before the generic goo.gl branch below, since
  // 'maps.app.goo.gl'.endsWith('.goo.gl') is also true and would otherwise wrongly require
  // its short-link path (which is just a random ID, not "/maps/...") to start with "/maps".
  if (hostname === 'maps.app.goo.gl') return true;

  // Bare goo.gl and google.com host many unrelated products — only count the ones that are
  // actually a map/place/business link, not e.g. an unrelated goo.gl short link or a plain
  // google.com search.
  if (hostname === 'goo.gl' || hostname.endsWith('.goo.gl')) return pathname.startsWith('/maps');
  if (hostname === 'google.com' || hostname.endsWith('.google.com')) {
    return pathname.startsWith('/maps') || hostname.startsWith('business.') || hostname.startsWith('maps.');
  }

  // g.page, share.google are single-purpose enough that host match alone is sufficient.
  return true;
}
