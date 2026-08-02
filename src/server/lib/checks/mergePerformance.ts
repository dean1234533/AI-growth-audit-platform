import type { CategoryId, CheckResult, MeasurementType, PerformanceMeta } from '../../../lib/types';
import {
  buildBrowserPerformanceChecks,
  computeBrowserPerformanceScore,
  METRIC_THRESHOLDS,
  type BrowserPerformanceMetrics,
  type CoreMetricKey,
} from './browserPerformance';
import type { PsiCoreMetrics } from './performance';

export type PerformanceSource = PerformanceMeta['primarySource'];
export type { PerformanceMeta };

function check(
  category: CategoryId,
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: CheckResult['severity'],
  weight: number,
  measurementType: MeasurementType,
): CheckResult {
  return { id, category, label, passed, detail, severity, weight, measurementType };
}

const METRIC_LABELS: Record<CoreMetricKey, { id: string; label: string }> = {
  lcp: { id: 'perf.lcp', label: 'Largest Contentful Paint under 2.5s' },
  fcp: { id: 'perf.fcp', label: 'First Contentful Paint under 1.8s' },
  cls: { id: 'perf.cls', label: 'Cumulative Layout Shift under 0.1' },
  tbt: { id: 'perf.tbt', label: 'Total Blocking Time under 200ms' },
  inp: { id: 'perf.inp', label: 'Interaction responsiveness good' },
};
const METRIC_WEIGHTS: Record<CoreMetricKey, number> = { lcp: 10, fcp: 7, cls: 8, tbt: 7, inp: 7 };

function psiFallbackCheck(key: CoreMetricKey, value: number): CheckResult {
  const { good, poor } = METRIC_THRESHOLDS[key];
  const { id, label } = METRIC_LABELS[key];
  const formatted = key === 'cls' ? value.toFixed(3) : key === 'lcp' || key === 'fcp' ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
  return check('performance', id, label, value <= good, `${formatted} (PageSpeed Insights)`, value <= poor ? 'medium' : 'high', METRIC_WEIGHTS[key], 'measured');
}

/** Server response time doesn't feed the 0-100 curve score (it's not one of the 5 weighted Core Web Vitals) but is still shown as its own pass/fail check, same as before this change. */
function ttfbCheck(value: number, source: PerformanceSource): CheckResult {
  const suffix = source === 'psi' ? ' (PageSpeed Insights)' : '';
  return check('performance', 'perf.serverResponseTime', 'Server response time under 600ms', value <= 600, `${Math.round(value)} ms${suffix}`, 'high', 8, 'measured');
}

export interface MergedPerformanceResult {
  checks: CheckResult[];
  meta: PerformanceMeta;
  performanceMeasured: boolean;
  /** Only set when performanceMeasured is false (both sources failed) — the ONE case that should still surface as a scan-level warning/partial trigger. PSI failing alone, with browser succeeding, is deliberately NOT surfaced here (see runFullAudit.ts). */
  warning?: string;
}

/**
 * Implements the source-selection rules: browser measurement is primary; PSI fills in only the
 * specific metrics the browser measurement didn't produce (rendering failed outright, or — for
 * INP specifically — no qualifying interaction occurred, which is the common/expected case).
 * Never averages the two for the same metric — each metric's check comes from exactly one
 * source, so mixing precision levels (a real per-scan browser measurement vs. PSI's own lab
 * run against Google's infrastructure) never happens silently.
 */
export function mergePerformanceResults(
  browser: BrowserPerformanceMetrics | null,
  psi: { coreMetrics: PsiCoreMetrics | null; score: number | null; warning?: string },
): MergedPerformanceResult {
  const keys: CoreMetricKey[] = ['lcp', 'fcp', 'cls', 'tbt', 'inp'];
  const checks: CheckResult[] = [];
  const sourcesUsed = new Set<PerformanceSource>();

  // Merged metric set, one value per key regardless of source — feeds the single deterministic
  // score below so browser and PSI numbers are never blended within the same metric.
  const merged: BrowserPerformanceMetrics = {
    lcp: null,
    fcp: null,
    cls: null,
    tbt: null,
    inp: null,
    ttfb: null,
    domContentLoaded: null,
    loadEventEnd: null,
    measurementWindowMs: 0,
  };

  for (const key of keys) {
    const browserValue = browser?.[key] ?? null;
    const psiValue = psi.coreMetrics?.[key] ?? null;
    if (browserValue !== null) {
      merged[key] = browserValue;
      sourcesUsed.add('browser');
    } else if (psiValue !== null) {
      merged[key] = psiValue;
      checks.push(psiFallbackCheck(key, psiValue));
      sourcesUsed.add('psi');
    } else {
      // Neither source produced this specific metric — shown honestly rather than silently
      // dropped. INP hits this path routinely (a passive automated scan rarely produces a
      // qualifying real interaction) without that alone meaning the whole scan is broken.
      const { id, label } = METRIC_LABELS[key];
      const reason = key === 'inp' ? 'No qualifying interaction was captured during this scan.' : 'Not measured by browser rendering or PageSpeed Insights for this scan.';
      checks.push(check('performance', id, label, false, `Not measured: ${reason}`, 'info', 0, 'not_available'));
    }
  }
  // Browser-sourced checks for whichever of the 5 keys the browser DID measure (built together
  // since buildBrowserPerformanceChecks also emits the browser-sourced TTFB check).
  if (browser) {
    for (const c of buildBrowserPerformanceChecks(browser)) {
      if (c.id === 'perf.serverResponseTime') continue; // handled separately below alongside the PSI-fallback case
      checks.push(c);
    }
  }

  // TTFB: same browser-first/PSI-fallback rule, kept separate since it's not one of the 5
  // weighted curve metrics.
  const browserTtfb = browser?.ttfb ?? null;
  const psiTtfb = psi.coreMetrics?.ttfb ?? null;
  if (browserTtfb !== null) {
    checks.push(ttfbCheck(browserTtfb, 'browser'));
    merged.ttfb = browserTtfb;
  } else if (psiTtfb !== null) {
    checks.push(ttfbCheck(psiTtfb, 'psi'));
    merged.ttfb = psiTtfb;
  } else {
    checks.push(check('performance', 'perf.serverResponseTime', 'Server response time under 600ms', false, 'Not measured: not available from browser rendering or PageSpeed Insights for this scan.', 'info', 0, 'not_available'));
  }

  const { score } = computeBrowserPerformanceScore(merged);

  const primarySource: PerformanceSource = sourcesUsed.has('browser') ? 'browser' : sourcesUsed.has('psi') ? 'psi' : 'none';
  const performanceMeasured = primarySource !== 'none';

  const meta: PerformanceMeta = {
    browser: {
      available: !!browser && keys.some((k) => browser[k] !== null),
      lcp: browser?.lcp ?? null,
      fcp: browser?.fcp ?? null,
      cls: browser?.cls ?? null,
      tbt: browser?.tbt ?? null,
      inp: browser?.inp ?? null,
      ttfb: browser?.ttfb ?? null,
      speedIndex: null,
    },
    psi: {
      available: !!psi.coreMetrics,
      score: psi.score,
      lcp: psi.coreMetrics?.lcp ?? null,
      fcp: psi.coreMetrics?.fcp ?? null,
      cls: psi.coreMetrics?.cls ?? null,
      tbt: psi.coreMetrics?.tbt ?? null,
      inp: psi.coreMetrics?.inp ?? null,
    },
    primarySource,
    score,
  };

  return {
    checks,
    meta,
    performanceMeasured,
    // Only surfaced as a scan-level warning (and therefore only contributes to meta.partial —
    // see runFullAudit.ts) when NEITHER source produced a usable measurement. A PSI-only
    // failure alongside a successful browser measurement is real information (kept in
    // meta.performance.psi.available: false) but must not make an otherwise-complete scan read
    // as broken.
    ...(performanceMeasured ? {} : { warning: psi.warning ?? 'Performance could not be measured: browser rendering and PageSpeed Insights both failed for this scan.' }),
  };
}
