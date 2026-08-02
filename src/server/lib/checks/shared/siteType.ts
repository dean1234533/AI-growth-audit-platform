const APP_SCHEMA_TYPES = new Set(['SoftwareApplication', 'WebApplication', 'MobileApplication']);
// Deliberately NOT plain 'Organization' here — a SoftwareApplication's own `creator`/`publisher`
// is conventionally an Organization (Growth Audit's own schema does exactly this for Dean Da
// Dev), so treating bare Organization presence as "this is a local business" would immediately
// defeat the purpose. Only a true LocalBusiness-family type, or any block that actually carries
// a street `address`, counts as a real local-business signal.
const LOCAL_BUSINESS_TYPES = new Set(['LocalBusiness', 'HomeAndConstructionBusiness']);

function flattenJsonLd(blocks: unknown[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const graph = (block as Record<string, unknown>)['@graph'];
    const entries = Array.isArray(block) ? block : Array.isArray(graph) ? graph : [block];
    for (const entry of entries) {
      if (entry && typeof entry === 'object') items.push(entry as Record<string, unknown>);
    }
  }
  return items;
}

function hasSchemaType(items: Record<string, unknown>[], types: Set<string>): boolean {
  return items.some((item) => {
    const t = item['@type'];
    const typeList = Array.isArray(t) ? t : [t];
    return typeList.some((tt) => typeof tt === 'string' && types.has(tt));
  });
}

/**
 * True when the page's own structured data declares itself a software product (e.g. Growth
 * Audit itself) rather than a physical/local business. A handful of checks — Google Business
 * Profile link, NAP, dedicated location pages, service-area phrasing, review-count display,
 * click-to-call — only make sense for a local business; forcing them on a SaaS/web-app site
 * would penalise it for lacking things it was never meant to have. Requires an explicit,
 * self-declared SoftwareApplication/WebApplication/MobileApplication type (not a heuristic
 * guess), and backs off if a LocalBusiness-type block is ALSO present — a real business that
 * also happens to be an app (e.g. a booking platform for a physical shop) still gets the full
 * local-SEO check set.
 */
export function isSoftwareProductSite(jsonLd: unknown[]): boolean {
  const items = flattenJsonLd(jsonLd);
  const declaresApp = hasSchemaType(items, APP_SCHEMA_TYPES);
  if (!declaresApp) return false;
  const hasLocalBusinessSignal = hasSchemaType(items, LOCAL_BUSINESS_TYPES) || items.some((item) => Boolean(item.address));
  return !hasLocalBusinessSignal;
}
