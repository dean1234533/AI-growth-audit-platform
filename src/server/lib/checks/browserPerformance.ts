import type { CategoryId, CheckResult, MeasurementType } from '../../../lib/types';

/**
 * Real browser-measured Core Web Vitals, captured from the SAME Puppeteer/Browser Rendering
 * session renderPage.ts already runs for a scan — no second browser launch, no second
 * navigation. This is NOT the `lighthouse` npm package (confirmed unable to run inside the
 * Workers runtime — it depends on `fs`/`module.createRequire` for its runtime audit-loading,
 * which has no filesystem to read in a statically-bundled Worker). These are the same
 * underlying browser signals (PerformanceObserver / Navigation Timing / long tasks) that
 * Lighthouse itself ultimately reads, just measured and scored directly by Growth Audit.
 */
export interface BrowserPerformanceMetrics {
  /** Largest Contentful Paint, ms. Null if no paint observed before the measurement window closed. */
  lcp: number | null;
  /** First Contentful Paint, ms. */
  fcp: number | null;
  /** Cumulative Layout Shift, unitless — accumulated via the standard session-window algorithm (see collector script), not a naive sum of every shift. */
  cls: number | null;
  /** Total Blocking Time, ms — sum of max(0, longTaskDuration - 50) for long tasks inside [fcp, measurementEnd]. Null if fcp itself is null (window undefined). */
  tbt: number | null;
  /** Interaction to Next Paint, ms — only populated if a real Event Timing interaction entry was captured (see renderPage.ts's single synthetic Tab keypress). Null (not zero) when no qualifying interaction occurred, which is the common/expected case for a passive automated scan. */
  inp: number | null;
  /** Time to First Byte, ms — Navigation Timing responseStart - requestStart. */
  ttfb: number | null;
  /** DOMContentLoaded, ms from navigation start. Supporting data only, not scored. */
  domContentLoaded: number | null;
  /** load event end, ms from navigation start. Supporting data only, not scored. */
  loadEventEnd: number | null;
  /** Wall-clock length, ms, of the window long tasks/CLS were observed over (navigation start to final collection). Documents exactly what TBT was integrated over. */
  measurementWindowMs: number;
}

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

/** Formats a millisecond value the same way PSI's `displayValue` strings read, so existing UI copy doesn't need to special-case the source. */
function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
function fmtMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

/**
 * Core Web Vitals-style pass/fail thresholds, matching the "good" cutoffs already implied by
 * the existing PSI-derived check labels ("under 2.5s", "under 1.8s", "under 0.1", "under
 * 200ms", "under 3.4s") — kept identical here so switching source never silently redefines
 * what counts as a pass.
 */
export function buildBrowserPerformanceChecks(m: BrowserPerformanceMetrics): CheckResult[] {
  const results: CheckResult[] = [];

  if (m.lcp !== null) {
    results.push(check('performance', 'perf.lcp', 'Largest Contentful Paint under 2.5s', m.lcp <= 2500, fmtSeconds(m.lcp), m.lcp <= 4000 ? 'medium' : 'critical', 10));
  }
  if (m.fcp !== null) {
    results.push(check('performance', 'perf.fcp', 'First Contentful Paint under 1.8s', m.fcp <= 1800, fmtSeconds(m.fcp), m.fcp <= 3000 ? 'medium' : 'high', 7));
  }
  if (m.cls !== null) {
    results.push(check('performance', 'perf.cls', 'Cumulative Layout Shift under 0.1', m.cls <= 0.1, m.cls.toFixed(3), m.cls <= 0.25 ? 'medium' : 'high', 8));
  }
  if (m.tbt !== null) {
    results.push(check('performance', 'perf.tbt', 'Total Blocking Time under 200ms', m.tbt <= 200, fmtMs(m.tbt), m.tbt <= 600 ? 'medium' : 'high', 7));
  }
  if (m.inp !== null) {
    results.push(check('performance', 'perf.inp', 'Interaction responsiveness good', m.inp <= 200, fmtMs(m.inp), m.inp <= 500 ? 'medium' : 'high', 7));
  }
  if (m.ttfb !== null) {
    results.push(check('performance', 'perf.serverResponseTime', 'Server response time under 600ms', m.ttfb <= 600, fmtMs(m.ttfb), 'high', 8));
  }

  return results;
}

export type CoreMetricKey = 'lcp' | 'fcp' | 'cls' | 'tbt' | 'inp';

/**
 * "Good"/"poor" cutoffs, shared by both the browser-measured checks above and
 * mergePerformance.ts's PSI-fallback checks, so which source a metric came from never changes
 * what counts as a pass for that metric. Matches the existing check label text ("under 2.5s"
 * etc.) already in use before this change.
 */
export const METRIC_THRESHOLDS: Record<CoreMetricKey, { good: number; poor: number }> = {
  lcp: { good: 2500, poor: 4000 },
  cls: { good: 0.1, poor: 0.25 },
  tbt: { good: 200, poor: 600 },
  fcp: { good: 1800, poor: 3000 },
  inp: { good: 200, poor: 500 },
};

interface MetricCurve {
  key: CoreMetricKey;
  good: number;
  poor: number;
  /** Relative importance when all 5 metrics are available — renormalized over whichever subset is actually available, so a missing metric never becomes an implicit zero. */
  weight: number;
}

// `poor` is where the curve bottoms out at 0, linearly interpolated between good and poor —
// not a cliff-edge pass/fail, per the "scoring curve" requirement. Weights: LCP is weighted
// heaviest (30) as the single most user-visible "did the page show up" signal, CLS and TBT
// next (20 each — visual stability and interactivity), FCP and INP lightest (15 each — FCP
// largely overlaps the LCP story, INP is frequently unavailable for a passive scan).
const CURVES: MetricCurve[] = (['lcp', 'cls', 'tbt', 'fcp', 'inp'] as CoreMetricKey[]).map((key) => ({
  key,
  ...METRIC_THRESHOLDS[key],
  weight: { lcp: 30, cls: 20, tbt: 20, fcp: 15, inp: 15 }[key],
}));

function curveScore(value: number, good: number, poor: number): number {
  if (value <= good) return 100;
  if (value >= poor) return 0;
  return Math.round((100 * (poor - value)) / (poor - good));
}

export interface BrowserPerformanceScore {
  /** 0-100, deterministic — the "Growth Audit Performance Score" / "Browser Performance Score" surfaced in the UI. Null if not even one core metric was measured. */
  score: number | null;
  /** Which of the 5 weighted metrics actually fed the score, for transparency (e.g. surfaced as a footnote, not required reading). */
  metricsUsed: MetricCurve['key'][];
}

/**
 * Weighted average of per-metric 0-100 curve scores. Weights are renormalized over only the
 * metrics actually available for this scan, so a missing INP (the common case — see
 * BrowserPerformanceMetrics.inp) reduces confidence/coverage rather than being treated as a
 * failing 0. Deterministic: same inputs always produce the same score.
 */
export function computeBrowserPerformanceScore(m: BrowserPerformanceMetrics): BrowserPerformanceScore {
  const available = CURVES.filter((c) => m[c.key] !== null);
  if (available.length === 0) return { score: null, metricsUsed: [] };

  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = available.reduce((sum, c) => {
    const value = m[c.key] as number;
    return sum + curveScore(value, c.good, c.poor) * (c.weight / totalWeight);
  }, 0);

  return { score: Math.round(weightedSum), metricsUsed: available.map((c) => c.key) };
}

/**
 * Browser-side collector, injected via `page.evaluateOnNewDocument()` BEFORE navigation (see
 * renderPage.ts) so its PerformanceObservers are attached before the first paint/layout-shift/
 * long-task can occur — attaching after `load` would silently miss everything that already
 * happened. `buffered: true` is kept as a second line of defence, not a substitute for early
 * injection. Runs entirely on standard browser APIs — no Node, no filesystem, nothing
 * Lighthouse-specific.
 */
export const BROWSER_METRICS_COLLECTOR_SCRIPT = `
(() => {
  window.__gaMetrics = { fcp: null, lcp: null, cls: 0, longTasks: [], interactions: [] };

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') window.__gaMetrics.fcp = entry.startTime;
      }
    }).observe({ type: 'paint', buffered: true });
  } catch (e) {}

  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__gaMetrics.lcp = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}

  try {
    // Standard session-window CLS accumulation (web.dev/cls): consecutive shifts within 1s of
    // each other, and within 5s of the window's first shift, are grouped into one session; the
    // final CLS is the largest session total observed, not a running sum of every shift ever.
    let sessionValue = 0;
    let sessionEntries = [];
    let maxSessionValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        const first = sessionEntries[0];
        const lastEntry = sessionEntries[sessionEntries.length - 1];
        if (sessionValue && first && lastEntry && entry.startTime - lastEntry.startTime < 1000 && entry.startTime - first.startTime < 5000) {
          sessionValue += entry.value;
          sessionEntries.push(entry);
        } else {
          sessionValue = entry.value;
          sessionEntries = [entry];
        }
        if (sessionValue > maxSessionValue) maxSessionValue = sessionValue;
      }
      window.__gaMetrics.cls = maxSessionValue;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__gaMetrics.longTasks.push({ start: entry.startTime, duration: entry.duration });
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}

  try {
    // Event Timing entries only carry an interactionId for genuine discrete user interactions
    // (click/keydown-keyup that produces one). A passive automated page load generates none of
    // these on its own — this only populates if renderPage.ts's single synthetic Tab keypress
    // (see below) happens to trigger a qualifying entry, which is why INP is null (not 0/estimated)
    // in the normal case rather than a fabricated value.
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.interactionId) window.__gaMetrics.interactions.push(entry.duration);
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch (e) {}
})();
`;

interface RawCollectedMetrics {
  fcp: number | null;
  lcp: number | null;
  cls: number;
  longTasks: { start: number; duration: number }[];
  interactions: number[];
  nav: { responseStart: number; requestStart: number; domContentLoadedEventEnd: number; loadEventEnd: number } | null;
}

/**
 * Turns the raw browser-side collection (see BROWSER_METRICS_COLLECTOR_SCRIPT and its
 * retrieval in renderPage.ts) into the final metrics object, computing TBT server-side since
 * it needs both the long-task list and the FCP cutoff together.
 *
 * TBT measurement window, explicitly: [FCP, measurementEnd] where measurementEnd is when
 * renderPage.ts pulled the collected data (after its settle wait) — see renderPage.ts's
 * comment at the call site for the exact wait sequence. This is a documented, simpler stand-in
 * for Lighthouse's own FCP-to-TTI window (TTI itself isn't computed here); long tasks that
 * start before FCP are excluded since a task before any paint isn't yet blocking a rendered
 * page's main thread.
 */
export function deriveBrowserPerformanceMetrics(raw: RawCollectedMetrics): BrowserPerformanceMetrics {
  const fcp = raw.fcp;
  const tbt =
    fcp === null
      ? null
      : raw.longTasks.filter((t) => t.start >= fcp).reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);

  const inp = raw.interactions.length > 0 ? Math.max(...raw.interactions) : null;

  const ttfb = raw.nav ? Math.max(0, raw.nav.responseStart - raw.nav.requestStart) : null;
  const domContentLoaded = raw.nav ? raw.nav.domContentLoadedEventEnd : null;
  const loadEventEnd = raw.nav ? raw.nav.loadEventEnd : null;

  const lastLongTaskEnd = raw.longTasks.reduce((max, t) => Math.max(max, t.start + t.duration), 0);
  const measurementWindowMs = Math.max(raw.lcp ?? 0, loadEventEnd ?? 0, lastLongTaskEnd);

  return {
    lcp: raw.lcp,
    fcp,
    cls: raw.cls,
    tbt,
    inp,
    ttfb,
    domContentLoaded,
    loadEventEnd,
    measurementWindowMs,
  };
}
