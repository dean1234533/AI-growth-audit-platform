import { describe, it, expect } from 'vitest';
import { buildOverallScore, buildCategoryScores } from '../scoring';
import type { CheckResult } from '../types';

function makeCheck(overrides: Partial<CheckResult>): CheckResult {
  return {
    id: 'test.check',
    category: 'seo',
    label: 'Test',
    passed: true,
    detail: '',
    severity: 'medium',
    weight: 5,
    measurementType: 'detected',
    ...overrides,
  };
}

describe('buildOverallScore', () => {
  it('excludes a category whose checks are entirely weight-0 (not_applicable/not_verified) from the average, rather than counting it as a fabricated 0', () => {
    const categories = buildCategoryScores([
      makeCheck({ category: 'seo', weight: 10, passed: true }),
      // 'accessibility' has a check, but it's entirely not_applicable/weight-0
      makeCheck({ category: 'accessibility', weight: 0, passed: true, status: 'not_applicable' }),
    ]);
    const overall = buildOverallScore(categories);
    // seo scores 100 (its only check passed); accessibility must be excluded, not counted as 0 —
    // if it were wrongly included, the average would be (100 + 0) / 2 = 50, not 100.
    expect(overall).toBe(100);
  });

  it('still returns 0 when there are genuinely no scored checks anywhere', () => {
    expect(buildOverallScore([])).toBe(0);
  });
});
