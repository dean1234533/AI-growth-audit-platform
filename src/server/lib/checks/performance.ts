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
  };
}

const PSI_TIMEOUT_MS = 25000;

/** Category of checks that genuinely can't run without PageSpeed Insights — shown honestly instead of silently omitted. */
function notAvailablePerformanceChecks(reason: string): CheckResult[] {
  const ids: [string, string][] = [
    ['perf.lcp', 'Largest Contentful Paint'],
    ['perf.fcp', 'First Contentful Paint'],
    ['perf.cls', 'Cumulative Layout Shift'],
    ['perf.tbt', 'Total Blocking Time'],
    ['perf.speedIndex', 'Speed Index'],
  ];
  return ids.map(([id, label]) =>
    check('performance', id, label, false, `Not measured: ${reason}`, 'info', 0, 'not_available'),
  );
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
): Promise<{ checks: CheckResult[]; lighthouseA11yChecks: CheckResult[]; lighthouseMobileChecks: CheckResult[]; warning?: string }> {
  if (!apiKey) {
    return {
      checks: notAvailablePerformanceChecks('PAGESPEED_API_KEY is not configured on the server.'),
      lighthouseA11yChecks: [],
      lighthouseMobileChecks: [],
      warning: 'Performance checks skipped: PAGESPEED_API_KEY is not configured.',
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
      };
    }
    json = await res.json();
  } catch {
    return {
      checks: notAvailablePerformanceChecks('PageSpeed Insights request timed out or failed.'),
      lighthouseA11yChecks: [],
      lighthouseMobileChecks: [],
      warning: 'Performance checks skipped: PageSpeed Insights request timed out or failed.',
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
    };
  }

  const results: CheckResult[] = [];
  const scorePass = (id: string, threshold = 0.9) => (audits[id]?.score ?? 0) >= threshold;

  const lcp = audits['largest-contentful-paint'];
  if (lcp) results.push(check('performance', 'perf.lcp', 'Largest Contentful Paint under 2.5s', (lcp.score ?? 0) >= 0.9, lcp.displayValue ?? 'unknown', (lcp.score ?? 0) >= 0.5 ? 'medium' : 'critical', 10));

  const fcp = audits['first-contentful-paint'];
  if (fcp) results.push(check('performance', 'perf.fcp', 'First Contentful Paint under 1.8s', (fcp.score ?? 0) >= 0.9, fcp.displayValue ?? 'unknown', (fcp.score ?? 0) >= 0.5 ? 'medium' : 'high', 7));

  const cls = audits['cumulative-layout-shift'];
  if (cls) results.push(check('performance', 'perf.cls', 'Cumulative Layout Shift under 0.1', (cls.score ?? 0) >= 0.9, cls.displayValue ?? 'unknown', (cls.score ?? 0) >= 0.5 ? 'medium' : 'high', 8));

  const tbt = audits['total-blocking-time'];
  if (tbt) results.push(check('performance', 'perf.tbt', 'Total Blocking Time under 200ms', (tbt.score ?? 0) >= 0.9, tbt.displayValue ?? 'unknown', (tbt.score ?? 0) >= 0.5 ? 'medium' : 'high', 7));

  const speedIndex = audits['speed-index'];
  if (speedIndex) results.push(check('performance', 'perf.speedIndex', 'Speed Index under 3.4s', (speedIndex.score ?? 0) >= 0.9, speedIndex.displayValue ?? 'unknown', (speedIndex.score ?? 0) >= 0.5 ? 'medium' : 'high', 6));

  const inp = audits['interaction-to-next-paint'] ?? audits['experimental-interaction-to-next-paint'] ?? audits['max-potential-fid'];
  if (inp) results.push(check('performance', 'perf.inp', 'Interaction responsiveness good', (inp.score ?? 0) >= 0.9, inp.displayValue ?? 'unknown', (inp.score ?? 0) >= 0.5 ? 'medium' : 'high', 7));

  const serverResponse = audits['server-response-time'];
  if (serverResponse) results.push(check('performance', 'perf.serverResponseTime', 'Server response time under 600ms', scorePass('server-response-time'), serverResponse.displayValue ?? 'unknown', 'high', 8));

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

  return { checks: results, lighthouseA11yChecks, lighthouseMobileChecks };
}
