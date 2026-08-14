import { describe, it, expect } from 'vitest';
import { buildServiceRecommendations } from '../serviceRecommendations';
import { buildCategoryScores } from '../scoring';
import type { AuditResult, CheckResult } from '../types';

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

function makeAudit(checks: CheckResult[]): AuditResult {
  return {
    url: 'https://app.example.com/',
    scannedAt: new Date().toISOString(),
    overallScore: 100,
    categories: buildCategoryScores(checks),
    recommendations: [],
    growthEstimate: {
      additionalEnquiriesPerMonth: [0, 1],
      visibilityImprovementPct: 0,
      conversionImprovementPct: 0,
      speedImprovementPct: 0,
      accessibilityImprovementPct: 0,
    },
    meta: { pageTitle: null, partial: false, warnings: [] },
  };
}

describe('buildServiceRecommendations', () => {
  it('does not pitch "SEO & Website Growth" off an unscored Local SEO category (web application, every check gated not_applicable)', () => {
    const audit = makeAudit([
      makeCheck({ category: 'seo', weight: 10, passed: true }),
      // Every Local SEO check gated not_applicable, as classifySiteType does for a web application.
      makeCheck({ id: 'local.gbp', category: 'localSeo', weight: 0, passed: true, status: 'not_applicable' }),
      makeCheck({ id: 'local.nap', category: 'localSeo', weight: 0, passed: true, status: 'not_applicable' }),
    ]);
    const recs = buildServiceRecommendations(audit);
    expect(recs.find((r) => r.id === 'seo-website-growth')).toBeUndefined();
  });

  it('still pitches "SEO & Website Growth" for a real, actually-scored low SEO category', () => {
    const audit = makeAudit([
      makeCheck({ category: 'seo', weight: 10, passed: false }),
      makeCheck({ id: 'local.gbp', category: 'localSeo', weight: 10, passed: false }),
    ]);
    const recs = buildServiceRecommendations(audit);
    expect(recs.find((r) => r.id === 'seo-website-growth')).toBeDefined();
  });

  it('does not count an unscored category toward the "3+ low categories" Complete Growth Upgrade trigger', () => {
    const audit = makeAudit([
      makeCheck({ category: 'seo', weight: 10, passed: true }),
      makeCheck({ category: 'performance', weight: 10, passed: true }),
      makeCheck({ id: 'local.gbp', category: 'localSeo', weight: 0, passed: true, status: 'not_applicable' }),
      makeCheck({ id: 'local.nap', category: 'localSeo', weight: 0, passed: true, status: 'not_applicable' }),
    ]);
    const recs = buildServiceRecommendations(audit);
    expect(recs.find((r) => r.id === 'complete-growth-upgrade')).toBeUndefined();
  });
});
