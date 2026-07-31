import { describe, it, expect } from 'vitest';
import { computeScanPartial } from '../scanPartial';

describe('computeScanPartial', () => {
  it('full browser scan (rendered succeeded) is not partial', () => {
    expect(computeScanPartial([], true, { renderMs: 100 })).toBe(false);
  });

  it('browser fallback (crawlPages true, rendering never completed) is partial', () => {
    expect(computeScanPartial([], true, null)).toBe(true);
  });

  it('a lightweight scan that never attempts rendering (crawlPages false) is not partial', () => {
    expect(computeScanPartial([], false, null)).toBe(false);
  });

  it('a PageSpeed warning still marks the scan partial, independent of rendering', () => {
    expect(computeScanPartial(['PageSpeed Insights failed'], true, { renderMs: 100 })).toBe(true);
  });

  it('both a warning and a browser fallback still just resolve to partial: true', () => {
    expect(computeScanPartial(['PageSpeed Insights failed'], true, null)).toBe(true);
  });
});
