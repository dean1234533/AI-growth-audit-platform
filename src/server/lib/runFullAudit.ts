import { buildCategoryScores, buildGrowthEstimate, buildOverallScore } from '../../lib/scoring';
import { buildRecommendations } from '../../lib/recommendations';
import type { AuditResult, CheckResult, PageAuditResult } from '../../lib/types';
import { fetchAndParse, discoverPages, checkLinkStatuses, checkHttpToHttpsRedirect, type PageData } from './fetchSite';
import { runSeoChecks } from './checks/seo';
import { runAccessibilityChecks } from './checks/accessibility';
import { runMobileChecks } from './checks/mobile';
import { runTrustChecks } from './checks/trust';
import { runConversionChecks } from './checks/conversion';
import { runLocalSeoChecks } from './checks/localSeo';
import { runPerformanceChecks } from './checks/performance';
import { enrichRecommendationsWithAi } from './aiNarrative';

export interface AuditEnv {
  PAGESPEED_API_KEY?: string;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
}

const MAX_PAGES = 5;

function staticChecksFor(
  page: PageData,
  robotsTxt: string | null,
  sitemapXml: string | null,
  seoOpts: Parameters<typeof runSeoChecks>[3] = {},
  location?: string,
): CheckResult[] {
  return [
    ...runSeoChecks(page, robotsTxt, sitemapXml, seoOpts),
    ...runAccessibilityChecks(page),
    ...runMobileChecks(page),
    ...runTrustChecks(page),
    ...runConversionChecks(page),
    ...runLocalSeoChecks(page, { location }),
  ];
}

function scorePage(checks: CheckResult[]) {
  const categories = buildCategoryScores(checks);
  const overallScore = buildOverallScore(categories);
  return { categories, overallScore };
}

export interface AuditBusinessContext {
  businessName?: string;
  businessType?: string;
  location?: string;
}

export interface RunFullAuditOptions {
  /** Discover and audit additional pages beyond the homepage. Off for lightweight scans (e.g. competitors). */
  crawlPages?: boolean;
  /** Run real PageSpeed Insights measurement. Off for lightweight scans — PSI is slow (~15-25s) and rate-limited. */
  runPerformance?: boolean;
  /** Optional context supplied on the audit intake form — sharpens local-relevance checks and personalises copy. Never fabricated if absent. */
  businessContext?: AuditBusinessContext;
}

/**
 * Runs the full audit pipeline: homepage (with real performance measurement + security/link
 * checks) plus up to 4 more discovered pages (static structural checks only — PageSpeed
 * Insights is homepage-only, since it's slow and rate-limited). Shared by the anonymous
 * /api/audit endpoint and the cron scan pipeline so the two never drift apart. Competitor
 * scans pass `{ crawlPages: false, runPerformance: false }` for a fast, homepage-only,
 * static-checks-only comparison — still real data, just not the expensive full sweep.
 */
export async function runFullAudit(
  targetUrl: string,
  env: AuditEnv,
  options: RunFullAuditOptions = {},
): Promise<{ result: AuditResult | null; error?: string }> {
  const crawlPages = options.crawlPages ?? true;
  const runPerformance = options.runPerformance ?? true;
  const businessContext = options.businessContext ?? {};

  const { page: homepage, robotsTxt, sitemapXml, error } = await fetchAndParse(targetUrl);
  if (!homepage) {
    return { result: null, error: error ?? 'Unable to analyse this website' };
  }

  const warnings: string[] = [];

  const discoveredUrls = crawlPages ? discoverPages(homepage.finalUrl, sitemapXml, homepage.links, MAX_PAGES) : [];

  const [otherPageResults, httpsRedirects, linkCheckResults] = await Promise.all([
    Promise.allSettled(discoveredUrls.map((url) => fetchAndParse(url))),
    checkHttpToHttpsRedirect(homepage.finalUrl),
    checkLinkStatuses(homepage.links, homepage.finalUrl),
  ]);

  const otherPages: PageData[] = [];
  for (const r of otherPageResults) {
    if (r.status === 'fulfilled' && r.value.page) otherPages.push(r.value.page);
  }

  const perf = runPerformance
    ? await runPerformanceChecks(targetUrl, env.PAGESPEED_API_KEY)
    : { checks: [], lighthouseA11yChecks: [], lighthouseMobileChecks: [] };
  if (perf.warning) warnings.push(perf.warning);

  const homepageChecks: CheckResult[] = [
    ...runSeoChecks(homepage, robotsTxt, sitemapXml, {
      httpsRedirects,
      linkCheckResults,
      otherPages: otherPages.map((p) => ({ url: p.finalUrl, title: p.title, metaDescription: p.metaDescription })),
    }),
    ...perf.checks,
    ...runAccessibilityChecks(homepage),
    ...perf.lighthouseA11yChecks,
    ...runMobileChecks(homepage),
    ...perf.lighthouseMobileChecks,
    ...runTrustChecks(homepage),
    ...runConversionChecks(homepage),
    ...runLocalSeoChecks(homepage, { location: businessContext.location }),
  ];

  const { categories, overallScore } = scorePage(homepageChecks);
  const growthEstimate = buildGrowthEstimate(categories);

  const failedChecks = homepageChecks.filter((c) => !c.passed && c.severity !== 'info');
  const baseRecommendations = buildRecommendations(failedChecks, homepage.finalUrl);
  const recommendations = await enrichRecommendationsWithAi(env.AI, baseRecommendations);

  const pages: PageAuditResult[] = otherPages.map((p) => {
    const checks = staticChecksFor(p, robotsTxt, sitemapXml, {}, businessContext.location);
    const { categories: pageCategories, overallScore: pageScore } = scorePage(checks);
    return { url: p.finalUrl, overallScore: pageScore, categories: pageCategories };
  });

  const result: AuditResult = {
    url: homepage.finalUrl,
    scannedAt: new Date().toISOString(),
    overallScore,
    categories,
    recommendations,
    growthEstimate,
    meta: {
      pageTitle: homepage.title,
      partial: warnings.length > 0,
      warnings,
      ...(businessContext.businessName ? { businessName: businessContext.businessName } : {}),
      ...(businessContext.businessType ? { businessType: businessContext.businessType } : {}),
      ...(businessContext.location ? { location: businessContext.location } : {}),
    },
    ...(pages.length > 0 ? { pages } : {}),
  };

  return { result };
}
