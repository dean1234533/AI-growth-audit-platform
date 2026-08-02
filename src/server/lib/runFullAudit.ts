import type { BrowserWorker } from '@cloudflare/puppeteer';
import { buildCategoryScores, buildGrowthEstimate, buildOverallScore } from '../../lib/scoring';
import { buildRecommendations } from '../../lib/recommendations';
import type { AuditResult, CheckResult, PageAuditResult } from '../../lib/types';
import { fetchAndParse, discoverPages, checkLinkStatuses, checkHttpToHttpsRedirect, type PageData } from './fetchSite';
import { renderPage, type RenderedPageData } from './renderPage';
import { hasRenderBudget, recordRenderUsage } from './scanBudget';
import { computeScanPartial } from './scanPartial';
import { parseServiceAccount } from './firestore';
import { runSeoChecks } from './checks/seo';
import { runAccessibilityChecks } from './checks/accessibility';
import { runMobileChecks } from './checks/mobile';
import { runTrustChecks } from './checks/trust';
import { runConversionChecks } from './checks/conversion';
import { runLocalSeoChecks } from './checks/localSeo';
import { runPerformanceChecks } from './checks/performance';
import { enrichRecommendationsWithAi } from './aiNarrative';
import { createGeminiRunner } from './gemini';

export interface AuditEnv {
  PAGESPEED_API_KEY?: string;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
  /** Cloudflare Browser Rendering binding — absent in local dev (no remote-mode support) or if not yet provisioned. */
  BROWSER?: BrowserWorker;
  /** Needed only for the daily browser-rendering budget counter (src/server/lib/scanBudget.ts); reuses the same secret already used for lead/scan storage. */
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

// Confirmed live in remote testing: raising this from the original 5 to 8, combined with real
// browser rendering (which itself generates subrequests for every asset the page loads —
// images, fonts, scripts), reproducibly exhausted the Workers subrequest ceiling by the time
// AI recommendation enrichment and the admin-notification email ran (both degrade gracefully
// when that happens — the audit itself still completes and scores correctly — but losing them
// isn't free, so pulled back from 8 to 6 to leave real headroom instead of running right at the edge.
const MAX_PAGES = 6;

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
  /** The scanned website's owner's own Gemini API key (users/{uid}/secrets/gemini), when
   * they've set one — used for recommendation write-up instead of the shared Workers AI quota.
   * Absent for anonymous scans (no owner) and for owners who haven't set a key. */
  geminiApiKey?: string;
}

/**
 * Runs the full audit pipeline: homepage (real performance measurement, real browser
 * rendering when budget/binding allow it, plus security/link checks) plus up to `MAX_PAGES -
 * 1` more discovered pages (static structural checks only — both rendering and PageSpeed
 * Insights are homepage-only, since they're the slow/rate-limited/budget-constrained parts).
 * Shared by the anonymous /api/audit endpoint and the cron scan pipeline so the two never
 * drift apart. Competitor scans pass `{ crawlPages: false, runPerformance: false }` for a
 * fast, homepage-only, static-checks-only comparison — still real data, just not the
 * expensive full sweep (and rendering is skipped too, for the same budget reasons).
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
  if (homepage.status < 200 || homepage.status >= 300) {
    // The fetch itself succeeded, but the server returned an error page (e.g. a Cloudflare 522,
    // a 500, a maintenance page) rather than the real site — scoring that error page's markup
    // as if it were the site's actual content would be actively misleading, not just incomplete.
    return {
      result: null,
      error: `The website returned an error (HTTP ${homepage.status}) instead of a working page, so it can't be audited right now. Please try again shortly.`,
    };
  }

  const warnings: string[] = [];
  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);

  // Render, PageSpeed Insights, the http->https check, and the homepage's own link-check all
  // run concurrently — rendering was deliberately kept out of the critical path sequence
  // after PSI (which alone already takes 15-25s) so a real-browser pass doesn't add latency
  // on top of it for the user-facing scan flow.
  let renderStart = 0;
  const shouldAttemptRender = crawlPages && !!env.BROWSER; // crawlPages doubles as "this is a full scan, not a lightweight competitor check"
  const budgetCheck = shouldAttemptRender ? await hasRenderBudget(serviceAccount) : { allowed: false as const, reason: 'budget_unknown' as const };

  const renderPromise: Promise<RenderedPageData | null> = (async () => {
    if (!shouldAttemptRender || !budgetCheck.allowed || !env.BROWSER) return null;
    renderStart = Date.now();
    return renderPage(env.BROWSER, homepage.finalUrl);
  })();

  const perfPromise = runPerformance
    ? runPerformanceChecks(targetUrl, env.PAGESPEED_API_KEY)
    : Promise.resolve({ checks: [] as CheckResult[], lighthouseA11yChecks: [] as CheckResult[], lighthouseMobileChecks: [] as CheckResult[], warning: undefined as string | undefined });

  const [rendered, perf, httpsRedirects, linkCheckResults] = await Promise.all([
    renderPromise,
    perfPromise,
    checkHttpToHttpsRedirect(homepage.finalUrl),
    checkLinkStatuses(homepage.links, homepage.finalUrl),
  ]);

  if (renderStart > 0) {
    // Record real elapsed time regardless of success/failure — a timed-out render attempt
    // still used real browser seconds against the daily budget.
    recordRenderUsage(serviceAccount, Date.now() - renderStart).catch(() => {});
  }
  if (perf.warning) warnings.push(perf.warning);

  // Discover pages using both the static homepage links and (when rendering ran) the rendered
  // DOM's links — a JS-driven nav/footer can add links a static fetch never sees at all.
  const discoveredUrls = crawlPages ? discoverPages(homepage.finalUrl, sitemapXml, homepage.links, MAX_PAGES, rendered?.links ?? []) : [];
  const otherPageResults = await Promise.allSettled(discoveredUrls.map((url) => fetchAndParse(url)));

  const otherPages: PageData[] = [];
  for (const r of otherPageResults) {
    if (r.status === 'fulfilled' && r.value.page) otherPages.push(r.value.page);
  }

  const homepageChecks: CheckResult[] = [
    ...runSeoChecks(
      homepage,
      robotsTxt,
      sitemapXml,
      {
        httpsRedirects,
        linkCheckResults,
        otherPages: otherPages.map((p) => ({ url: p.finalUrl, title: p.title, metaDescription: p.metaDescription })),
      },
      rendered,
    ),
    ...perf.checks,
    ...runAccessibilityChecks(homepage, rendered),
    ...perf.lighthouseA11yChecks,
    ...runMobileChecks(homepage, rendered),
    ...perf.lighthouseMobileChecks,
    ...runTrustChecks(homepage, rendered),
    ...runConversionChecks(homepage, rendered),
    ...runLocalSeoChecks(homepage, { location: businessContext.location }),
  ];

  const { categories, overallScore } = scorePage(homepageChecks);
  const growthEstimate = buildGrowthEstimate(categories);

  // not_applicable/not_verified checks are informational (see CheckStatus in types.ts) — they
  // must never turn into a "fix this" recommendation, since there's nothing actionable to fix.
  const failedChecks = homepageChecks.filter((c) => !c.passed && c.severity !== 'info' && c.status !== 'not_applicable' && c.status !== 'not_verified');
  const baseRecommendations = buildRecommendations(failedChecks, homepage.finalUrl);
  const aiRunner = options.geminiApiKey ? createGeminiRunner(options.geminiApiKey) : env.AI;
  const recommendations = await enrichRecommendationsWithAi(aiRunner, baseRecommendations);

  const pages: PageAuditResult[] = otherPages.map((p) => {
    const checks = staticChecksFor(p, robotsTxt, sitemapXml, {}, businessContext.location);
    const { categories: pageCategories, overallScore: pageScore } = scorePage(checks);
    return { url: p.finalUrl, overallScore: pageScore, categories: pageCategories };
  });

  const jsRenderingReason = rendered
    ? undefined
    : !shouldAttemptRender
      ? (crawlPages ? 'Browser rendering is not configured for this environment' : 'Skipped for this lightweight scan')
      : !budgetCheck.allowed && budgetCheck.reason === 'exhausted'
        ? 'Daily browser-rendering budget likely exhausted (best-effort estimate, not a hard Cloudflare guarantee) — some checks fell back to static analysis'
        : !budgetCheck.allowed && budgetCheck.reason === 'budget_unknown'
          ? 'Could not confirm remaining browser-rendering budget, so skipped it as a precaution — some checks fell back to static analysis'
          : 'Browser rendering failed for this scan — some checks fell back to static analysis';

  const result: AuditResult = {
    url: homepage.finalUrl,
    scannedAt: new Date().toISOString(),
    overallScore,
    categories,
    recommendations,
    growthEstimate,
    meta: {
      pageTitle: homepage.title,
      partial: computeScanPartial(warnings, crawlPages, rendered),
      warnings,
      ...(businessContext.businessName ? { businessName: businessContext.businessName } : {}),
      ...(businessContext.businessType ? { businessType: businessContext.businessType } : {}),
      ...(businessContext.location ? { location: businessContext.location } : {}),
      scanQuality: {
        scannedAt: new Date().toISOString(),
        jsRenderingUsed: !!rendered,
        ...(jsRenderingReason ? { jsRenderingReason } : {}),
        performanceMeasured: runPerformance && !perf.warning,
      },
      pagesDiscovered: discoveredUrls.length,
      pagesScanned: otherPages.length,
      pagesSkipped: Math.max(0, discoveredUrls.length - otherPages.length),
      crawlLimit: MAX_PAGES,
    },
    ...(pages.length > 0 ? { pages } : {}),
  };

  return { result };
}
