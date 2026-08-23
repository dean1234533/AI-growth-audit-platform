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

/**
 * Additive status alongside `passed`, for the two cases a plain boolean can't express honestly:
 * - not_applicable: this check doesn't make sense on this page (e.g. breadcrumb schema on a
 *   homepage) — it isn't a defect, so it must never read as "missing" in the UI or count
 *   against the score.
 * - not_verified: the infrastructure that would confirm this one way or the other wasn't
 *   available for this scan (no browser rendering budget left, a link target blocked
 *   automated requests) — genuinely unknown, not a failure.
 * Absent for ordinary pass/fail checks. Always paired with `weight: 0` so scoring.ts needs
 * no special-casing — it already excludes weight-0 checks from both sides of the ratio.
 */
export type CheckStatus = 'not_applicable' | 'not_verified';

export interface CheckResult {
  id: string;
  category: CategoryId;
  label: string;
  passed: boolean;
  /** Raw detail describing what was actually found, e.g. "Title is 12 characters" */
  detail: string;
  severity: Severity;
  /** Points this check contributes to the category score (0 if failed, or if not_applicable/not_verified) */
  weight: number;
  measurementType: MeasurementType;
  /** Set only for not_applicable/not_verified results — see CheckStatus. */
  status?: CheckStatus;
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

export interface ScanQuality {
  scannedAt: string;
  jsRenderingUsed: boolean;
  /** Why rendering was skipped, when it was — e.g. "daily browser-rendering budget exhausted". Absent when rendering ran. */
  jsRenderingReason?: string;
  performanceMeasured: boolean;
  /** Which source the core performance metrics (LCP/FCP/CLS/TBT/INP) actually came from this
   * scan — Growth Audit's own browser measurement (primary), PageSpeed Insights (fallback), or
   * 'none' if both failed. See meta.performance for the full breakdown. */
  performanceSource?: 'browser' | 'psi' | 'none';
}

/**
 * Growth Audit's own browser-measured performance data (primary source) alongside PageSpeed
 * Insights (secondary/supplementary) — see src/server/lib/checks/mergePerformance.ts, which
 * builds this. Not the `lighthouse` npm package — real Chrome PerformanceObserver/Navigation
 * Timing data captured from the same Browser Rendering session used for the rest of the scan.
 */
export interface PerformanceMeta {
  browser: {
    available: boolean;
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    tbt: number | null;
    inp: number | null;
    ttfb: number | null;
    speedIndex: null;
  };
  psi: {
    available: boolean;
    score: number | null;
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    tbt: number | null;
    inp: number | null;
  };
  primarySource: 'browser' | 'psi' | 'none';
  score: number | null;
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
    /** Explicit audit-quality state — see src/server/lib/runFullAudit.ts for exactly how each
     * is determined. Absent on older stored scans (predates this field); treat as unknown, not
     * STATIC_FALLBACK, when reading historical data. */
    auditQuality?: 'FULL' | 'PARTIAL' | 'STATIC_FALLBACK';
    warnings: string[];
    /** Optional context supplied on the audit intake form — absent on audits run without it. */
    businessName?: string;
    businessType?: string;
    location?: string;
    /** Whether the scanned page was classified as a marketing/business website or a web
     * application (SaaS product, dashboard, sign-in-gated tool) — see classifySiteType in
     * src/server/lib/checks/shared/siteType.ts. Absent on older stored scans (predates this
     * field); treat as unknown, not 'website', when reading historical data. */
    siteType?: 'website' | 'app';
    /** Why siteType was classified the way it was — always present alongside siteType, shown in
     * the UI so the label is never an unexplained guess. */
    siteTypeReason?: string;
    /** How thoroughly this scan actually checked the site — shown in the UI so a scan run
     * without rendering/PSI budget never silently looks as authoritative as a full one. */
    scanQuality?: ScanQuality;
    pagesDiscovered?: number;
    pagesScanned?: number;
    pagesSkipped?: number;
    crawlLimit?: number;
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
  businessName?: string;
  siteType?: 'website' | 'app';
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
