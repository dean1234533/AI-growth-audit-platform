import type { BrowserWorker } from '@cloudflare/puppeteer';
import { buildCategoryScores, buildGrowthEstimate, buildOverallScore } from '../../lib/scoring';
import { buildRecommendations } from '../../lib/recommendations';
import type { AuditResult, CheckResult, PageAuditResult } from '../../lib/types';
import { fetchAndParse, discoverPages, checkLinkStatuses, checkHttpToHttpsRedirect, type PageData } from './fetchSite';
import { renderPage, type RenderedPageData } from './renderPage';
import { hasRenderBudget, recordRenderUsage, recordBudgetSkip, type AuditPriority } from './scanBudget';
import { dedupedRender, normalizeUrlForDedup } from './renderDedup';
import { computeScanPartial } from './scanPartial';
import { resolveFetcher, type SelfFetchEnv } from './selfFetch';
import { parseServiceAccount } from './firestore';
import { runSeoChecks } from './checks/seo';
import { runAccessibilityChecks } from './checks/accessibility';
import { runMobileChecks } from './checks/mobile';
import { runTrustChecks } from './checks/trust';
import { runConversionChecks } from './checks/conversion';
import { runLocalSeoChecks } from './checks/localSeo';
import { classifySiteType } from './checks/shared/siteType';
import { runPerformanceChecks } from './checks/performance';
import { mergePerformanceResults } from './checks/mergePerformance';
import { enrichRecommendationsWithAi } from './aiNarrative';
import { createGeminiRunner } from './gemini';

export interface AuditEnv extends SelfFetchEnv {
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
  isApp: boolean,
  seoOpts: Parameters<typeof runSeoChecks>[3] = {},
  location?: string,
): CheckResult[] {
  return [
    ...runSeoChecks(page, robotsTxt, sitemapXml, { ...seoOpts, isApp }),
    ...runAccessibilityChecks(page),
    ...runMobileChecks(page),
    ...runTrustChecks(page, undefined, isApp),
    ...runConversionChecks(page, undefined, isApp),
    ...runLocalSeoChecks(page, isApp, { location }),
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
  /** Who's asking, for Browser Rendering budget purposes — see scanBudget.ts. Defaults to
   * 'public', the most restrictive tier, so a caller that forgets to specify this explicitly
   * never accidentally gets customer/admin treatment. Callers should always pass this
   * explicitly in practice (api/audit.ts resolves it server-side from the request's verified
   * identity; runDueScans.ts passes 'monitoring' directly, since cron has no HTTP entry point
   * to spoof). */
  priority?: AuditPriority;
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
  const priority: AuditPriority = options.priority ?? 'public';

  // Only non-undefined when targetUrl's host is one of THIS deployment's own hostnames
  // (server-side config, see selfFetch.ts) — every external target is fetched exactly as
  // before. Same fetcher reused for every discovered page below since discoverPages() only
  // ever returns same-host URLs.
  const fetcher = resolveFetcher(targetUrl, env);

  const { page: homepage, robotsTxt, sitemapXml, error } = await fetchAndParse(targetUrl, fetcher);
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
  let renderIsNew = false; // true only if THIS call actually started the render (vs joined an in-flight one from a concurrent request for the same URL) — see renderDedup.ts. Only the starting call records budget usage.
  const shouldAttemptRender = crawlPages && !!env.BROWSER; // crawlPages doubles as "this is a full scan, not a lightweight competitor check"
  const budgetCheck = shouldAttemptRender ? await hasRenderBudget(serviceAccount, priority) : { allowed: false as const, reason: 'budget_unknown' as const };
  if (shouldAttemptRender && !budgetCheck.allowed) {
    recordBudgetSkip(serviceAccount, priority, budgetCheck.reason).catch(() => {});
  }

  const renderPromise: Promise<RenderedPageData | null> = (async () => {
    if (!shouldAttemptRender || !budgetCheck.allowed || !env.BROWSER) return null;
    renderStart = Date.now();
    const browser = env.BROWSER;
    const { promise, isNew } = dedupedRender(normalizeUrlForDedup(homepage.finalUrl), () => renderPage(browser, homepage.finalUrl));
    renderIsNew = isNew;
    return promise;
  })();

  const perfPromise = runPerformance
    ? runPerformanceChecks(targetUrl, env.PAGESPEED_API_KEY)
    : Promise.resolve({
        checks: [] as CheckResult[],
        lighthouseA11yChecks: [] as CheckResult[],
        lighthouseMobileChecks: [] as CheckResult[],
        warning: undefined as string | undefined,
        psiCoreMetrics: null,
        psiScore: null,
      });

  const [rendered, perf, httpsRedirects, linkCheckResults] = await Promise.all([
    renderPromise,
    perfPromise,
    // Deliberately always the public path (no fetcher) even for an internal target — this
    // check's entire job is verifying Cloudflare's edge redirects plain-http to https, which
    // the service binding (bypassing the edge) cannot meaningfully test.
    checkHttpToHttpsRedirect(homepage.finalUrl),
    checkLinkStatuses(homepage.links, homepage.finalUrl, {}, fetcher),
  ]);

  // Classified once — using the rendered snapshot when available, so a client-rendered sign-in
  // screen or client-injected schema.org data is visible to the classifier too — and reused for
  // every discovered page below; site type is a whole-site property, not something that should
  // flip-flop per subpage.
  const siteType = classifySiteType(homepage, rendered);
  const isApp = siteType.type === 'app';

  if (renderStart > 0 && renderIsNew) {
    // Record real elapsed time regardless of success/failure — a timed-out render attempt
    // still used real browser seconds against the daily budget. Only recorded by the call that
    // actually started the render (renderIsNew) — a concurrent request that merely joined an
    // in-flight render via renderDedup.ts must not double-count the same browser time.
    recordRenderUsage(serviceAccount, Date.now() - renderStart, priority, rendered ? 'rendered' : 'static_fallback').catch(() => {});
  }
  // Browser-measured Core Web Vitals (from the same render session above) are primary; PSI
  // fills in only the specific metrics the browser measurement didn't produce. A PSI-only
  // failure is recorded in meta.performance.psi but deliberately NOT pushed to `warnings`
  // when the browser measurement succeeded — see mergePerformance.ts — so a PSI timeout can no
  // longer make an otherwise-complete scan read as partial.
  const perfResult = mergePerformanceResults(rendered?.browserPerformance ?? null, {
    coreMetrics: perf.psiCoreMetrics,
    score: perf.psiScore,
    warning: perf.warning,
  });
  if (perfResult.warning) warnings.push(perfResult.warning);

  // Discover pages using both the static homepage links and (when rendering ran) the rendered
  // DOM's links — a JS-driven nav/footer can add links a static fetch never sees at all.
  const discoveredUrls = crawlPages ? discoverPages(homepage.finalUrl, sitemapXml, homepage.links, MAX_PAGES, rendered?.links ?? []) : [];
  const otherPageResults = await Promise.allSettled(discoveredUrls.map((url) => fetchAndParse(url, fetcher)));

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
        isApp,
      },
      rendered,
    ),
    ...perf.checks,
    ...perfResult.checks,
    ...runAccessibilityChecks(homepage, rendered),
    ...perf.lighthouseA11yChecks,
    ...runMobileChecks(homepage, rendered),
    ...perf.lighthouseMobileChecks,
    ...runTrustChecks(homepage, rendered, isApp),
    ...runConversionChecks(homepage, rendered, isApp),
    ...runLocalSeoChecks(homepage, isApp, { location: businessContext.location }),
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
    const checks = staticChecksFor(p, robotsTxt, sitemapXml, isApp, {}, businessContext.location);
    const { categories: pageCategories, overallScore: pageScore } = scorePage(checks);
    return { url: p.finalUrl, overallScore: pageScore, categories: pageCategories };
  });

  const jsRenderingReason = rendered
    ? undefined
    : !shouldAttemptRender
      ? (crawlPages ? 'Browser rendering is not configured for this environment' : 'Skipped for this lightweight scan')
      : !budgetCheck.allowed && budgetCheck.reason === 'exhausted'
        ? 'Daily browser-rendering budget likely exhausted (best-effort estimate, not a hard Cloudflare guarantee) — some checks fell back to static analysis'
        : !budgetCheck.allowed && budgetCheck.reason === 'reserved_for_customers'
          ? 'Remaining browser-rendering capacity is reserved for customer scans right now — this scan fell back to static analysis'
          : !budgetCheck.allowed && budgetCheck.reason === 'public_allocation_exhausted'
            ? "Today's browser-rendering allocation for the public audit tool is used up — this scan fell back to static analysis"
            : !budgetCheck.allowed && budgetCheck.reason === 'budget_unknown'
              ? 'Could not confirm remaining browser-rendering budget, so skipped it as a precaution — some checks fell back to static analysis'
              : 'Browser rendering failed for this scan — some checks fell back to static analysis';

  // Explicit audit-quality state (see PerformanceMeta/AuditResult in types.ts):
  //  FULL: a real Browser Rendering pass succeeded, and nothing else significant failed.
  //  PARTIAL: rendering succeeded but something else notable didn't (currently: performance
  //   measurement failed on both sources — the only thing that still reaches `warnings`, see
  //   mergePerformance.ts's Case 4).
  //  STATIC_FALLBACK: no rendered data at all — whether because rendering was never attempted
  //   by design (a lightweight competitor/comparison scan), was skipped by the budget system
  //   above, or was attempted and genuinely failed. Rendering-dependent checks fall back to
  //   not_verified (or, for a detected JS-app-shell page, several conversion/SEO checks do too
  //   — see jsShellDetection.ts) rather than being scored as false failures.
  const auditQuality: 'FULL' | 'PARTIAL' | 'STATIC_FALLBACK' = !rendered ? 'STATIC_FALLBACK' : warnings.length > 0 ? 'PARTIAL' : 'FULL';

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
      auditQuality,
      warnings,
      siteType: siteType.type,
      siteTypeReason: siteType.reason,
      ...(businessContext.businessName ? { businessName: businessContext.businessName } : {}),
      ...(businessContext.businessType ? { businessType: businessContext.businessType } : {}),
      ...(businessContext.location ? { location: businessContext.location } : {}),
      scanQuality: {
        scannedAt: new Date().toISOString(),
        jsRenderingUsed: !!rendered,
        ...(jsRenderingReason ? { jsRenderingReason } : {}),
        performanceMeasured: runPerformance && perfResult.performanceMeasured,
        performanceSource: perfResult.meta.primarySource,
      },
      ...(runPerformance ? { performance: perfResult.meta } : {}),
      pagesDiscovered: discoveredUrls.length,
      pagesScanned: otherPages.length,
      pagesSkipped: Math.max(0, discoveredUrls.length - otherPages.length),
      crawlLimit: MAX_PAGES,
    },
    ...(pages.length > 0 ? { pages } : {}),
  };

  return { result };
}
