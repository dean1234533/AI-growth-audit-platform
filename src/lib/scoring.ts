import { CATEGORY_LABELS, type CategoryId, type CategoryScore, type CheckResult, type GrowthEstimate } from './types';

const CATEGORY_ORDER: CategoryId[] = ['seo', 'performance', 'accessibility', 'trust', 'mobile', 'conversion', 'localSeo'];

/** A category score is the weighted % of passed checks, out of the total possible weight for that category. */
export function buildCategoryScores(checks: CheckResult[]): CategoryScore[] {
  return CATEGORY_ORDER.map((id) => {
    const categoryChecks = checks.filter((c) => c.category === id);
    const totalWeight = categoryChecks.reduce((sum, c) => sum + c.weight, 0);
    const earnedWeight = categoryChecks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
    const score = totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100);
    return { id, label: CATEGORY_LABELS[id], score, checks: categoryChecks };
  });
}

/**
 * Overall score is the mean of category scores, only counting categories that actually had
 * scoring-relevant checks run. A category can have checks (`.checks.length > 0`) while every
 * one of them is weight-0 (not_applicable/not_verified/not_available) — that's not the same
 * as a genuine 0/100, so it's excluded from the average rather than dragging it down.
 */
export function buildOverallScore(categories: CategoryScore[]): number {
  const scored = categories.filter((c) => c.checks.some((chk) => chk.weight > 0));
  if (scored.length === 0) return 0;
  return Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);
}

/**
 * Transparent heuristic: bigger gaps between current score and 100 in categories
 * that most directly drive leads/traffic (conversion, seo, localSeo, performance)
 * translate into larger estimated upside. Deliberately conservative multipliers.
 */
export function buildGrowthEstimate(categories: CategoryScore[]): GrowthEstimate {
  const byId = Object.fromEntries(categories.map((c) => [c.id, c.score])) as Record<CategoryId, number>;
  const gap = (id: CategoryId) => Math.max(0, 100 - (byId[id] ?? 100));

  const conversionGap = gap('conversion');
  const seoGap = gap('seo');
  const localSeoGap = gap('localSeo');
  const perfGap = gap('performance');
  const a11yGap = gap('accessibility');

  const enquiryUpliftLow = Math.round((conversionGap * 0.15 + seoGap * 0.08 + localSeoGap * 0.08) / 10);
  const enquiryUpliftHigh = Math.round((conversionGap * 0.35 + seoGap * 0.18 + localSeoGap * 0.18) / 10);

  return {
    additionalEnquiriesPerMonth: [Math.max(0, enquiryUpliftLow), Math.max(enquiryUpliftLow + 1, enquiryUpliftHigh)],
    visibilityImprovementPct: Math.round(seoGap * 0.4 + localSeoGap * 0.2),
    conversionImprovementPct: Math.round(conversionGap * 0.45),
    speedImprovementPct: Math.round(perfGap * 0.5),
    accessibilityImprovementPct: Math.round(a11yGap * 0.6),
  };
}
