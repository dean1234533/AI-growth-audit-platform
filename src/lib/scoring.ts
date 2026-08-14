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
 * True when a category had at least one scoring-relevant (weight > 0) check. A category can
 * have checks (`.checks.length > 0`) while every one of them is weight-0
 * (not_applicable/not_verified/not_available — e.g. every Local SEO check on a web application,
 * see classifySiteType) — that's not a genuine 0/100, it's "not scored", and every place that
 * aggregates or displays a category score must treat it that way rather than as a real failure.
 */
export function isCategoryScored(category: CategoryScore): boolean {
  return category.checks.some((c) => c.weight > 0);
}

/**
 * Overall score is the mean of category scores, only counting categories that actually had
 * scoring-relevant checks run — see isCategoryScored.
 */
export function buildOverallScore(categories: CategoryScore[]): number {
  const scored = categories.filter(isCategoryScored);
  if (scored.length === 0) return 0;
  return Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);
}

/**
 * Transparent heuristic: bigger gaps between current score and 100 in categories
 * that most directly drive leads/traffic (conversion, seo, localSeo, performance)
 * translate into larger estimated upside. Deliberately conservative multipliers.
 */
export function buildGrowthEstimate(categories: CategoryScore[]): GrowthEstimate {
  const byId = Object.fromEntries(categories.map((c) => [c.id, c])) as Record<CategoryId, CategoryScore>;
  // A category that wasn't actually scored (e.g. Local SEO on a web application — see
  // isCategoryScored) has no real gap to close; treating its fabricated 0 as a 100-point gap
  // would inflate the estimate with opportunity that doesn't exist.
  const gap = (id: CategoryId) => {
    const category = byId[id];
    if (!category || !isCategoryScored(category)) return 0;
    return Math.max(0, 100 - category.score);
  };

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
