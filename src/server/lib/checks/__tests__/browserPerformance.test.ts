import { describe, it, expect } from 'vitest';
import {
  buildBrowserPerformanceChecks,
  computeBrowserPerformanceScore,
  deriveBrowserPerformanceMetrics,
  type BrowserPerformanceMetrics,
} from '../browserPerformance';

function metrics(overrides: Partial<BrowserPerformanceMetrics> = {}): BrowserPerformanceMetrics {
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

describe('computeBrowserPerformanceScore', () => {
  it('scores excellent metrics near 100', () => {
    const { score, metricsUsed } = computeBrowserPerformanceScore(
      metrics({ lcp: 1200, fcp: 600, cls: 0.02, tbt: 20, inp: 80 }),
    );
    expect(score).not.toBeNull();
    expect(score as number).toBeGreaterThanOrEqual(95);
    expect(metricsUsed).toHaveLength(5);
  });

  it('scores poor metrics near 0', () => {
    const { score } = computeBrowserPerformanceScore(
      metrics({ lcp: 6000, fcp: 4000, cls: 0.4, tbt: 900, inp: 700 }),
    );
    expect(score as number).toBeLessThanOrEqual(10);
  });

  it('scores mixed metrics in between, deterministically', () => {
    const m = metrics({ lcp: 3000, fcp: 2000, cls: 0.15, tbt: 300, inp: 250 });
    const first = computeBrowserPerformanceScore(m).score;
    const second = computeBrowserPerformanceScore(m).score;
    expect(first).toBe(second);
    expect(first as number).toBeGreaterThan(10);
    expect(first as number).toBeLessThan(90);
  });

  it('a missing INP reduces confidence (fewer metrics used) rather than destroying the score', () => {
    const withInp = computeBrowserPerformanceScore(metrics({ lcp: 2000, fcp: 1200, cls: 0.05, tbt: 100, inp: 100 }));
    const withoutInp = computeBrowserPerformanceScore(metrics({ lcp: 2000, fcp: 1200, cls: 0.05, tbt: 100, inp: null }));
    expect(withoutInp.metricsUsed).toHaveLength(4);
    expect(withoutInp.score).not.toBeNull();
    // Both are "good" metrics — dropping INP (also good) shouldn't crater the score.
    expect(Math.abs((withInp.score as number) - (withoutInp.score as number))).toBeLessThan(15);
  });

  it('a missing Speed Index has no effect — it is not one of the 5 scored metrics', () => {
    // BrowserPerformanceMetrics has no speedIndex field at all (see PerformanceMeta.browser.speedIndex: null in types.ts) — this test documents that omission is intentional.
    const { metricsUsed } = computeBrowserPerformanceScore(metrics({ lcp: 2000, fcp: 1200, cls: 0.05, tbt: 100, inp: 100 }));
    expect(metricsUsed).not.toContain('speedIndex');
  });

  it('returns a null score, not zero, when nothing was measured at all', () => {
    const { score, metricsUsed } = computeBrowserPerformanceScore(metrics());
    expect(score).toBeNull();
    expect(metricsUsed).toHaveLength(0);
  });

  it('never produces a score outside 0-100 at the boundary thresholds', () => {
    const atGood = computeBrowserPerformanceScore(metrics({ lcp: 2500, fcp: 1800, cls: 0.1, tbt: 200, inp: 200 }));
    const atPoor = computeBrowserPerformanceScore(metrics({ lcp: 4000, fcp: 3000, cls: 0.25, tbt: 600, inp: 500 }));
    expect(atGood.score).toBe(100);
    expect(atPoor.score).toBe(0);
  });
});

describe('buildBrowserPerformanceChecks', () => {
  it('marks a metric passed when at/under its good threshold', () => {
    const checks = buildBrowserPerformanceChecks(metrics({ lcp: 2000, fcp: 1000, cls: 0.05, tbt: 50, inp: 100, ttfb: 300 }));
    expect(checks.every((c) => c.passed)).toBe(true);
    expect(checks.every((c) => c.measurementType === 'measured')).toBe(true);
  });

  it('marks a metric failed when over its good threshold', () => {
    const checks = buildBrowserPerformanceChecks(metrics({ lcp: 5000 }));
    const lcpCheck = checks.find((c) => c.id === 'perf.lcp');
    expect(lcpCheck?.passed).toBe(false);
    expect(lcpCheck?.severity).toBe('critical');
  });

  it('omits a check entirely for a metric that was not measured (never a fabricated 0/fail)', () => {
    const checks = buildBrowserPerformanceChecks(metrics({ lcp: 2000 }));
    expect(checks.find((c) => c.id === 'perf.inp')).toBeUndefined();
    expect(checks.find((c) => c.id === 'perf.fcp')).toBeUndefined();
  });
});

describe('deriveBrowserPerformanceMetrics', () => {
  it('computes TBT as sum of max(0, duration-50) for long tasks at/after FCP', () => {
    const derived = deriveBrowserPerformanceMetrics({
      fcp: 1000,
      lcp: 1500,
      cls: 0,
      longTasks: [
        { start: 500, duration: 200 }, // before FCP — excluded
        { start: 1200, duration: 150 }, // 150-50=100
        { start: 1800, duration: 60 }, // 60-50=10
        { start: 2000, duration: 30 }, // under 50ms — contributes 0
      ],
      interactions: [],
      nav: null,
    });
    expect(derived.tbt).toBe(110);
  });

  it('returns null TBT when FCP itself is null (measurement window undefined)', () => {
    const derived = deriveBrowserPerformanceMetrics({ fcp: null, lcp: null, cls: 0, longTasks: [{ start: 100, duration: 200 }], interactions: [], nav: null });
    expect(derived.tbt).toBeNull();
  });

  it('derives INP as the max observed interaction duration, or null (not zero) when none occurred', () => {
    const withInteractions = deriveBrowserPerformanceMetrics({ fcp: 500, lcp: 800, cls: 0, longTasks: [], interactions: [40, 180, 90], nav: null });
    expect(withInteractions.inp).toBe(180);

    const withoutInteractions = deriveBrowserPerformanceMetrics({ fcp: 500, lcp: 800, cls: 0, longTasks: [], interactions: [], nav: null });
    expect(withoutInteractions.inp).toBeNull();
  });

  it('derives TTFB from Navigation Timing responseStart - requestStart', () => {
    const derived = deriveBrowserPerformanceMetrics({
      fcp: 500,
      lcp: 800,
      cls: 0,
      longTasks: [],
      interactions: [],
      nav: { requestStart: 50, responseStart: 230, domContentLoadedEventEnd: 900, loadEventEnd: 1100 },
    });
    expect(derived.ttfb).toBe(180);
    expect(derived.domContentLoaded).toBe(900);
    expect(derived.loadEventEnd).toBe(1100);
  });
});
