export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type CategoryId =
  | 'seo'
  | 'performance'
  | 'accessibility'
  | 'trust'
  | 'mobile'
  | 'conversion'
  | 'localSeo';

export interface CheckResult {
  id: string;
  category: CategoryId;
  label: string;
  passed: boolean;
  /** Raw detail describing what was actually found, e.g. "Title is 12 characters" */
  detail: string;
  severity: Severity;
  /** Points this check contributes to the category score (0 if failed) */
  weight: number;
}

export interface Recommendation {
  id: string;
  category: CategoryId;
  title: string;
  description: string;
  severity: Severity;
  impact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  priority: number;
  aiGenerated: boolean;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  score: number;
  checks: CheckResult[];
}

export interface GrowthEstimate {
  additionalEnquiriesPerMonth: [number, number];
  visibilityImprovementPct: number;
  conversionImprovementPct: number;
  speedImprovementPct: number;
  accessibilityImprovementPct: number;
}

export interface AuditResult {
  url: string;
  scannedAt: string;
  overallScore: number;
  categories: CategoryScore[];
  recommendations: Recommendation[];
  growthEstimate: GrowthEstimate;
  meta: {
    pageTitle: string | null;
    screenshotUrl?: string;
    partial: boolean;
    warnings: string[];
  };
}

export interface Lead {
  name: string;
  email: string;
  business: string;
  website: string;
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  seo: 'SEO',
  performance: 'Performance',
  accessibility: 'Accessibility',
  trust: 'Trust',
  mobile: 'Mobile',
  conversion: 'Conversion',
  localSeo: 'Local SEO',
};
