export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type CategoryId =
  | 'seo'
  | 'performance'
  | 'accessibility'
  | 'trust'
  | 'mobile'
  | 'conversion'
  | 'localSeo';

/**
 * How confident this result is, so the UI never presents a guess as a measured fact:
 * - measured: real browser data (PageSpeed Insights / Lighthouse)
 * - detected: deterministic fact from the actual HTTP response/HTML (a header is present,
 *   robots.txt returned 200, JSON-LD parsed) — not a guess, just not browser-rendered
 * - inferred: regex/static heuristic on raw HTML — real signal, lower confidence
 * - not_available: the current infrastructure genuinely can't check this (e.g. no
 *   PAGESPEED_API_KEY configured) — shown honestly rather than silently omitted
 */
export type MeasurementType = 'measured' | 'detected' | 'inferred' | 'not_available';

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
  measurementType: MeasurementType;
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
  /** The specific detected detail behind this recommendation, e.g. "Measured LCP: 14.1 seconds" */
  evidence: string;
  /** Which page this was found on — the audited URL by default, or a discovered page's URL */
  affectedUrl: string;
  detectionMethod: MeasurementType;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  score: number;
  checks: CheckResult[];
}

/** A secondary discovered page's own category breakdown — homepage stays on AuditResult's top-level fields for backwards compatibility. */
export interface PageAuditResult {
  url: string;
  overallScore: number;
  categories: CategoryScore[];
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
    /** Optional context supplied on the audit intake form — absent on audits run without it. */
    businessName?: string;
    businessType?: string;
    location?: string;
  };
  /** Additional discovered pages beyond the homepage, each with their own category breakdown. Absent on older stored scans. */
  pages?: PageAuditResult[];
}

export interface Lead {
  name: string;
  email: string;
  business: string;
  website: string;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';

export interface EnquiryLead extends Lead {
  helpWith: string;
  preferredContact: 'email' | 'phone' | 'either';
  message: string;
}

/** A stored lead record as the admin view reads it back — additive fields on top of the base Firestore doc. */
export interface StoredLead extends Partial<EnquiryLead> {
  id: string;
  source: 'pdf_download' | 'enquiry';
  status: LeadStatus;
  auditUrl?: string;
  auditScore?: number | null;
  topIssues?: string[];
  recommendedServices?: string[];
  createdAt?: string;
}

export type ScanFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

export interface MonitoredWebsite {
  id: string;
  uid: string;
  url: string;
  name: string;
  frequency: ScanFrequency;
  status: 'active' | 'paused';
  createdAt: string;
  lastScannedAt: string | null;
  nextScanDue: string | null;
  latestOverallScore: number | null;
  latestCategoryScores: { id: CategoryId; score: number }[];
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
