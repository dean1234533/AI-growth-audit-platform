import { describe, it, expect } from 'vitest';
import { mergePerformanceResults } from '../mergePerformance';
import type { BrowserPerformanceMetrics } from '../browserPerformance';
import type { PsiCoreMetrics } from '../performance';

function browserMetrics(overrides: Partial<BrowserPerformanceMetrics> = {}): BrowserPerformanceMetrics {
  return {
    lcp: null,
    fcp: null,
    cls: null,
    tbt: null,
    inp: null,
    ttfb: null,
    domContentLoaded: null,
    loadEventEnd: null,
    measurementWindowMs: 0,
    ...overrides,
  };
}

function psiMetrics(overrides: Partial<PsiCoreMetrics> = {}): PsiCoreMetrics {
  return { lcp: null, fcp: null, cls: null, tbt: null, inp: null, ttfb: null, ...overrides };
}

const GOOD_BROWSER = browserMetrics({ lcp: 1500, fcp: 800, cls: 0.02, tbt: 40, inp: 90, ttfb: 200 });
const GOOD_PSI = psiMetrics({ lcp: 1600, fcp: 850, cls: 0.03, tbt: 50, inp: 100, ttfb: 220 });

describe('mergePerformanceResults — Case 1: browser succeeds, PSI succeeds', () => {
  it('uses browser as primary, does not average with PSI, and does not warn', () => {
    const result = mergePerformanceResults(GOOD_BROWSER, { coreMetrics: GOOD_PSI, score: 0.95 });
    expect(result.performanceMeasured).toBe(true);
    expect(result.meta.primarySource).toBe('browser');
    expect(result.warning).toBeUndefined();
    const lcpCheck = result.checks.find((c) => c.id === 'perf.lcp');
    // Browser's 1500ms, not PSI's 1600ms and not an average (1550ms) of the two.
    expect(lcpCheck?.detail).toContain('1.5');
    expect(result.meta.psi.available).toBe(true);
  });
});

describe('mergePerformanceResults — Case 2: browser succeeds, PSI fails', () => {
  it('stays fully measured and does NOT warn — a PSI failure alone must not taint an otherwise-complete scan', () => {
    const result = mergePerformanceResults(GOOD_BROWSER, { coreMetrics: null, score: null, warning: 'Performance checks skipped: PageSpeed Insights request timed out or failed.' });
    expect(result.performanceMeasured).toBe(true);
    expect(result.meta.primarySource).toBe('browser');
    expect(result.warning).toBeUndefined();
    expect(result.meta.psi.available).toBe(false);
    expect(result.meta.score).not.toBeNull();
  });
});

describe('mergePerformanceResults — Case 3: browser fails, PSI succeeds', () => {
  it('falls back to PSI, records primarySource psi, and does not pretend browser measurement succeeded', () => {
    const result = mergePerformanceResults(null, { coreMetrics: GOOD_PSI, score: 0.9 });
    expect(result.performanceMeasured).toBe(true);
    expect(result.meta.primarySource).toBe('psi');
    expect(result.meta.browser.available).toBe(false);
    const lcpCheck = result.checks.find((c) => c.id === 'perf.lcp');
    expect(lcpCheck?.detail).toContain('PageSpeed Insights');
  });
});

describe('mergePerformanceResults — Case 4: both fail', () => {
  it('marks performance unavailable with a clear warning, never inventing a score', () => {
    const result = mergePerformanceResults(null, { coreMetrics: null, score: null, warning: 'Performance checks skipped: PageSpeed Insights request timed out or failed.' });
    expect(result.performanceMeasured).toBe(false);
    expect(result.meta.primarySource).toBe('none');
    expect(result.meta.score).toBeNull();
    expect(result.warning).toBeTruthy();
    // Every core metric check present should be explicitly not_available, not a fabricated fail.
    for (const key of ['perf.lcp', 'perf.fcp', 'perf.cls', 'perf.tbt', 'perf.inp']) {
      const c = result.checks.find((chk) => chk.id === key);
      expect(c?.measurementType).toBe('not_available');
      expect(c?.weight).toBe(0);
    }
  });
});

describe('mergePerformanceResults — per-metric fallback (not all-or-nothing)', () => {
  it('uses browser for metrics it measured and PSI only for the ones it did not (e.g. missing INP)', () => {
    const partialBrowser = browserMetrics({ lcp: 1500, fcp: 800, cls: 0.02, tbt: 40, inp: null, ttfb: 200 });
    const result = mergePerformanceResults(partialBrowser, { coreMetrics: psiMetrics({ inp: 220 }), score: 0.8 });
    expect(result.meta.primarySource).toBe('browser'); // browser still supplied the majority
    const inpCheck = result.checks.find((c) => c.id === 'perf.inp');
    expect(inpCheck?.detail).toContain('PageSpeed Insights');
    expect(inpCheck?.measurementType).toBe('measured');
  });

  it('missing metrics on both sides become not_available, not zero', () => {
    const partialBrowser = browserMetrics({ lcp: 1500 });
    const result = mergePerformanceResults(partialBrowser, { coreMetrics: null, score: null });
    const fcpCheck = result.checks.find((c) => c.id === 'perf.fcp');
    expect(fcpCheck?.measurementType).toBe('not_available');
    expect(fcpCheck?.weight).toBe(0);
    expect(fcpCheck?.passed).toBe(false); // not_available checks are conventionally passed:false, weight:0 — never scored as a failure
  });
});

describe('mergePerformanceResults — boundary values', () => {
  it('keeps the overall score within 0-100 even with mixed extreme metrics', () => {
    const extreme = browserMetrics({ lcp: 0, fcp: 0, cls: 0, tbt: 0, inp: 0 });
    const result = mergePerformanceResults(extreme, { coreMetrics: null, score: null });
    expect(result.meta.score).not.toBeNull();
    expect(result.meta.score as number).toBeGreaterThanOrEqual(0);
    expect(result.meta.score as number).toBeLessThanOrEqual(100);
  });
});
