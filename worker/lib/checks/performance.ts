import type { CheckResult } from '../../../src/lib/types';

function check(id: string, label: string, passed: boolean, detail: string, severity: CheckResult['severity'], weight: number): CheckResult {
  return { id, category: 'performance', label, passed, detail, severity, weight };
}

interface LighthouseAudit {
  id: string;
  score: number | null;
  numericValue?: number;
  displayValue?: string;
  details?: { items?: unknown[] };
}

interface PageSpeedResponse {
  lighthouseResult?: {
    audits: Record<string, LighthouseAudit>;
  };
}

const PSI_TIMEOUT_MS = 25000;

/**
 * Runs Google PageSpeed Insights and derives our performance checks from its Lighthouse audits.
 * Returns { checks: [] , warning } if the API key is missing or the call fails, so the rest
 * of the audit can still complete (marked partial by the caller).
 */
export async function runPerformanceChecks(
  targetUrl: string,
  apiKey: string | undefined,
): Promise<{ checks: CheckResult[]; warning?: string }> {
  if (!apiKey) {
    return { checks: [], warning: 'Performance checks skipped: PAGESPEED_API_KEY is not configured.' };
  }

  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&key=${apiKey}&strategy=mobile&category=performance`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  let json: PageSpeedResponse;
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) {
      return { checks: [], warning: `Performance checks skipped: PageSpeed Insights returned HTTP ${res.status}.` };
    }
    json = await res.json();
  } catch {
    return { checks: [], warning: 'Performance checks skipped: PageSpeed Insights request timed out or failed.' };
  } finally {
    clearTimeout(timer);
  }

  const audits = json.lighthouseResult?.audits;
  if (!audits) {
    return { checks: [], warning: 'Performance checks skipped: PageSpeed Insights returned no data.' };
  }

  const results: CheckResult[] = [];
  const scorePass = (id: string, threshold = 0.9) => (audits[id]?.score ?? 0) >= threshold;

  const lcp = audits['largest-contentful-paint'];
  if (lcp) results.push(check('perf.lcp', 'Largest Contentful Paint under 2.5s', (lcp.score ?? 0) >= 0.9, lcp.displayValue ?? 'unknown', (lcp.score ?? 0) >= 0.5 ? 'medium' : 'critical', 10));

  const cls = audits['cumulative-layout-shift'];
  if (cls) results.push(check('perf.cls', 'Cumulative Layout Shift under 0.1', (cls.score ?? 0) >= 0.9, cls.displayValue ?? 'unknown', (cls.score ?? 0) >= 0.5 ? 'medium' : 'high', 8));

  const inp = audits['interaction-to-next-paint'] ?? audits['experimental-interaction-to-next-paint'] ?? audits['max-potential-fid'];
  if (inp) results.push(check('perf.inp', 'Interaction responsiveness good', (inp.score ?? 0) >= 0.9, inp.displayValue ?? 'unknown', (inp.score ?? 0) >= 0.5 ? 'medium' : 'high', 7));

  const images = audits['uses-optimized-images'] ?? audits['uses-responsive-images'];
  if (images) results.push(check('perf.largeImages', 'Images appropriately sized/optimised', scorePass('uses-optimized-images') || scorePass('uses-responsive-images'), images.displayValue ?? (images.details?.items?.length ? `${images.details.items.length} image(s) flagged` : 'No large images flagged'), 'high', 8));

  const unusedCss = audits['unused-css-rules'];
  if (unusedCss) results.push(check('perf.unusedCss', 'Minimal unused CSS', scorePass('unused-css-rules'), unusedCss.displayValue ?? 'unknown', 'medium', 5));

  const unusedJs = audits['unused-javascript'];
  if (unusedJs) results.push(check('perf.unusedJs', 'Minimal unused JavaScript', scorePass('unused-javascript'), unusedJs.displayValue ?? 'unknown', 'medium', 5));

  const compression = audits['uses-text-compression'];
  if (compression) results.push(check('perf.compression', 'Text compression enabled', scorePass('uses-text-compression'), compression.displayValue ?? 'unknown', 'medium', 6));

  const caching = audits['uses-long-cache-ttl'];
  if (caching) results.push(check('perf.caching', 'Efficient cache policy set', scorePass('uses-long-cache-ttl'), caching.displayValue ?? 'unknown', 'medium', 5));

  const lazyLoading = audits['offscreen-images'];
  if (lazyLoading) results.push(check('perf.lazyLoading', 'Offscreen images lazy-loaded', scorePass('offscreen-images'), lazyLoading.displayValue ?? 'unknown', 'medium', 5));

  const renderBlocking = audits['render-blocking-resources'];
  if (renderBlocking) results.push(check('perf.renderBlocking', 'No render-blocking resources', scorePass('render-blocking-resources'), renderBlocking.displayValue ?? 'unknown', 'high', 7));

  return { checks: results };
}
