import type { CategoryId, CheckResult, MeasurementType } from '../../../lib/types';

function check(
  category: CategoryId,
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: CheckResult['severity'],
  weight: number,
  measurementType: MeasurementType = 'measured',
): CheckResult {
  return { id, category, label, passed, detail, severity, weight, measurementType };
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
    categories?: { performance?: { score?: number } };
  };
}

// PSI's own full mobile Lighthouse run (4 categories requested in one call) commonly takes
// 20-60s for real-world sites — 25s was cutting it off before it finished for anything but
// the simplest pages (confirmed live: vercel.com and a real production React SPA both hit
// this exact "timed out or failed" path). Cloudflare Workers have no hard wall-clock limit on
// an invocation (only CPU time is metered, and waiting on fetch() doesn't count against it) —
// only an undocumented ~90s soft ceiling observed per individual subrequest — so 55s leaves
// real headroom under that without making a single stuck request hang the audit indefinitely.
const PSI_TIMEOUT_MS = 55000;

/** Category of checks that genuinely can't run without PageSpeed Insights — shown honestly instead of silently omitted. */
function notAvailablePerformanceChecks(reason: string): CheckResult[] {
  const ids: [string, string][] = [['perf.speedIndex', 'Speed Index']];
  return ids.map(([id, label]) =>
    check('performance', id, label, false, `Not measured: ${reason}`, 'info', 0, 'not_available'),
  );
}

/**
 * Raw millisecond (or, for CLS, unitless) values for the metrics browserPerformance.ts also
 * measures directly — PSI's own PAGESPEED_API_KEY, `numericValue`, so runFullAudit.ts can build
 * a same-threshold fallback check ONLY for whichever specific metric the real browser
 * measurement didn't produce (see mergePerformance.ts). Never used when the browser value is
 * present — PSI is secondary per-metric, not just secondary overall.
 */
export interface PsiCoreMetrics {
  lcp: number | null;
  fcp: number | null;
  cls: number | null;
  tbt: number | null;
  inp: number | null;
  ttfb: number | null;
}

/**
 * Runs Google PageSpeed Insights ONCE per audit (homepage only — PSI is slow, ~15-25s, and
 * rate-limited, so it isn't worth re-running per discovered page) and derives checks from its
 * Lighthouse report. Requesting all four Lighthouse categories in one call (instead of just
 * "performance") is free — no extra network round-trip — but unlocks real, browser-rendered
 * accessibility/mobile signals (color contrast, tap targets, duplicate IDs) that a static HTML
 * regex could never measure accurately, returned separately so callers can add them alongside
 * (not replacing) the existing static heuristic checks.
 */
export async function runPerformanceChecks(
  targetUrl: string,
  apiKey: string | undefined,
): Promise<{
  checks: CheckResult[];
  lighthouseA11yChecks: CheckResult[];
  lighthouseMobileChecks: CheckResult[];
  warning?: string;
  psiCoreMetrics: PsiCoreMetrics | null;
  psiScore: number | null;
}> {
  if (!apiKey) {
    return {
      checks: notAvailablePerformanceChecks('PAGESPEED_API_KEY is not configured on the server.'),
      lighthouseA11yChecks: [],
      lighthouseMobileChecks: [],
      warning: 'Performance checks skipped: PAGESPEED_API_KEY is not configured.',
      psiCoreMetrics: null,
      psiScore: null,
    };
  }

  const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
  const categoryParams = categories.map((c) => `category=${c}`).join('&');
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&key=${apiKey}&strategy=mobile&${categoryParams}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  let json: PageSpeedResponse;
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) {
      return {
        checks: notAvailablePerformanceChecks(`PageSpeed Insights returned HTTP ${res.status}.`),
        lighthouseA11yChecks: [],
        lighthouseMobileChecks: [],
        warning: `Performance checks skipped: PageSpeed Insights returned HTTP ${res.status}.`,
        psiCoreMetrics: null,
        psiScore: null,
      };
    }
    json = await res.json();
  } catch {
    return {
      checks: notAvailablePerformanceChecks('PageSpeed Insights request timed out or failed.'),
      lighthouseA11yChecks: [],
      lighthouseMobileChecks: [],
      warning: 'Performance checks skipped: PageSpeed Insights request timed out or failed.',
      psiCoreMetrics: null,
      psiScore: null,
    };
  } finally {
    clearTimeout(timer);
  }

  const audits = json.lighthouseResult?.audits;
  if (!audits) {
    return {
      checks: notAvailablePerformanceChecks('PageSpeed Insights returned no data.'),
      lighthouseA11yChecks: [],
      lighthouseMobileChecks: [],
      warning: 'Performance checks skipped: PageSpeed Insights returned no data.',
      psiCoreMetrics: null,
      psiScore: null,
    };
  }

  const results: CheckResult[] = [];
  const scorePass = (id: string, threshold = 0.9) => (audits[id]?.score ?? 0) >= threshold;

  // Core Web Vitals (LCP/FCP/CLS/TBT/INP) and server-response-time are deliberately NOT pushed
  // into `results` here anymore — browserPerformance.ts measures these directly from Growth
  // Audit's own Browser Rendering session now, and is the primary source. Their raw values are
  // still extracted below into `psiCoreMetrics` so mergePerformance.ts can fall back to PSI
  // per-metric ONLY when the browser measurement didn't produce that specific metric (e.g.
  // rendering failed entirely, or a real interaction never fired for INP).
  const psiCoreMetrics: PsiCoreMetrics = {
    lcp: audits['largest-contentful-paint']?.numericValue ?? null,
    fcp: audits['first-contentful-paint']?.numericValue ?? null,
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    tbt: audits['total-blocking-time']?.numericValue ?? null,
    inp: audits['interaction-to-next-paint']?.numericValue ?? audits['experimental-interaction-to-next-paint']?.numericValue ?? audits['max-potential-fid']?.numericValue ?? null,
    ttfb: audits['server-response-time']?.numericValue ?? null,
  };
  const psiScore = json.lighthouseResult?.categories?.performance?.score ?? null;

  const speedIndex = audits['speed-index'];
  if (speedIndex) results.push(check('performance', 'perf.speedIndex', 'Speed Index under 3.4s', (speedIndex.score ?? 0) >= 0.9, speedIndex.displayValue ?? 'unknown', (speedIndex.score ?? 0) >= 0.5 ? 'medium' : 'high', 6));

  const pageWeight = audits['total-byte-weight'];
  if (pageWeight) results.push(check('performance', 'perf.pageWeight', 'Total page size reasonable', scorePass('total-byte-weight'), pageWeight.displayValue ?? 'unknown', 'medium', 5));

  const images = audits['uses-optimized-images'] ?? audits['uses-responsive-images'];
  if (images) results.push(check('performance', 'perf.largeImages', 'Images appropriately sized/optimised', scorePass('uses-optimized-images') || scorePass('uses-responsive-images'), images.displayValue ?? (images.details?.items?.length ? `${images.details.items.length} image(s) flagged` : 'No large images flagged'), 'high', 8));

  const modernFormats = audits['modern-image-formats'];
  if (modernFormats) results.push(check('performance', 'perf.modernImageFormats', 'Modern image formats (WebP/AVIF) used', scorePass('modern-image-formats'), modernFormats.displayValue ?? 'unknown', 'medium', 4));

  const fontDisplay = audits['font-display'];
  if (fontDisplay) results.push(check('performance', 'perf.fontDisplay', 'Web fonts avoid invisible text during load', scorePass('font-display'), fontDisplay.displayValue ?? 'unknown', 'low', 3));

  const thirdParty = audits['third-party-summary'];
  if (thirdParty) results.push(check('performance', 'perf.thirdParty', 'Third-party scripts have minimal impact', scorePass('third-party-summary'), thirdParty.displayValue ?? 'unknown', 'medium', 4));

  const unusedCss = audits['unused-css-rules'];
  if (unusedCss) results.push(check('performance', 'perf.unusedCss', 'Minimal unused CSS', scorePass('unused-css-rules'), unusedCss.displayValue ?? 'unknown', 'medium', 5));

  const unusedJs = audits['unused-javascript'];
  if (unusedJs) results.push(check('performance', 'perf.unusedJs', 'Minimal unused JavaScript', scorePass('unused-javascript'), unusedJs.displayValue ?? 'unknown', 'medium', 5));

  const compression = audits['uses-text-compression'];
  if (compression) results.push(check('performance', 'perf.compression', 'Text compression enabled', scorePass('uses-text-compression'), compression.displayValue ?? 'unknown', 'medium', 6));

  const caching = audits['uses-long-cache-ttl'];
  if (caching) results.push(check('performance', 'perf.caching', 'Efficient cache policy set', scorePass('uses-long-cache-ttl'), caching.displayValue ?? 'unknown', 'medium', 5));

  const lazyLoading = audits['offscreen-images'];
  if (lazyLoading) results.push(check('performance', 'perf.lazyLoading', 'Offscreen images lazy-loaded', scorePass('offscreen-images'), lazyLoading.displayValue ?? 'unknown', 'medium', 5));

  const renderBlocking = audits['render-blocking-resources'];
  if (renderBlocking) results.push(check('performance', 'perf.renderBlocking', 'No render-blocking resources', scorePass('render-blocking-resources'), renderBlocking.displayValue ?? 'unknown', 'high', 7));

  // Real, browser-rendered accessibility signals — added alongside (not replacing) the static
  // regex-based checks in accessibility.ts, since these come from actual Chrome rendering.
  const lighthouseA11yChecks: CheckResult[] = [];
  const contrast = audits['color-contrast'];
  if (contrast && contrast.score !== null) {
    lighthouseA11yChecks.push(
      check('accessibility', 'a11y.colorContrastMeasured', 'Text has sufficient colour contrast (measured)', contrast.score >= 0.9, contrast.score >= 0.9 ? 'Rendered contrast check passed' : `${contrast.details?.items?.length ?? 'Some'} element(s) with insufficient contrast, as rendered in Chrome`, 'high', 8, 'measured'),
    );
  }
  const duplicateId = audits['duplicate-id-active'];
  if (duplicateId && duplicateId.score !== null) {
    lighthouseA11yChecks.push(
      check('accessibility', 'a11y.duplicateIdsMeasured', 'No duplicate active-element IDs (measured)', duplicateId.score >= 0.9, duplicateId.displayValue ?? 'Rendered DOM check', 'medium', 5, 'measured'),
    );
  }
  const ariaValid = audits['aria-valid-attr-value'] ?? audits['aria-valid-attr'];
  if (ariaValid && ariaValid.score !== null) {
    lighthouseA11yChecks.push(
      check('accessibility', 'a11y.ariaValidMeasured', 'ARIA attributes are valid (measured)', ariaValid.score >= 0.9, ariaValid.displayValue ?? 'Rendered ARIA validation', 'medium', 5, 'measured'),
    );
  }

  // Real, browser-rendered mobile signals.
  const lighthouseMobileChecks: CheckResult[] = [];
  const tapTargets = audits['tap-targets'];
  if (tapTargets && tapTargets.score !== null) {
    lighthouseMobileChecks.push(
      check('mobile', 'mobile.tapTargetsMeasured', 'Tap targets appropriately sized (measured)', tapTargets.score >= 0.9, tapTargets.displayValue ?? 'Rendered tap-target sizing check', 'medium', 6, 'measured'),
    );
  }
  const fontSize = audits['font-size'];
  if (fontSize && fontSize.score !== null) {
    lighthouseMobileChecks.push(
      check('mobile', 'mobile.fontSizeMeasured', 'Text is legible without zooming (measured)', fontSize.score >= 0.9, fontSize.displayValue ?? 'Rendered font-size check', 'medium', 5, 'measured'),
    );
  }
  const contentWidth = audits['content-width'];
  if (contentWidth && contentWidth.score !== null) {
    lighthouseMobileChecks.push(
      check('mobile', 'mobile.contentWidthMeasured', 'Content sized correctly for viewport (measured)', contentWidth.score >= 0.9, contentWidth.displayValue ?? 'Rendered content-width check', 'high', 7, 'measured'),
    );
  }

  return { checks: results, lighthouseA11yChecks, lighthouseMobileChecks, psiCoreMetrics, psiScore };
}
