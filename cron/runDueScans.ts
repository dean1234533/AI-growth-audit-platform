import { buildCategoryScores, buildGrowthEstimate, buildOverallScore } from '../src/lib/scoring';
import { buildRecommendations } from '../src/lib/recommendations';
import type { AuditResult, CheckResult, ScanFrequency } from '../src/lib/types';
import { fetchAndParse } from '../src/server/lib/fetchSite';
import { runSeoChecks } from '../src/server/lib/checks/seo';
import { runAccessibilityChecks } from '../src/server/lib/checks/accessibility';
import { runMobileChecks } from '../src/server/lib/checks/mobile';
import { runTrustChecks } from '../src/server/lib/checks/trust';
import { runConversionChecks } from '../src/server/lib/checks/conversion';
import { runLocalSeoChecks } from '../src/server/lib/checks/localSeo';
import { runPerformanceChecks } from '../src/server/lib/checks/performance';
import { enrichRecommendationsWithAi } from '../src/server/lib/aiNarrative';
import { addFirestoreDocument, updateFirestoreDocument, runQuery, parseServiceAccount } from '../src/server/lib/firestore';

interface CronEnv {
  PAGESPEED_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
}

interface WebsiteDoc {
  id: string;
  url: string;
  frequency: ScanFrequency;
  status: 'active' | 'paused';
}

const FREQUENCY_MS: Record<Exclude<ScanFrequency, 'manual'>, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

async function runAudit(targetUrl: string, env: CronEnv): Promise<AuditResult | null> {
  const { page, robotsTxt, sitemapXml } = await fetchAndParse(targetUrl);
  if (!page) return null;

  const perf = await runPerformanceChecks(targetUrl, env.PAGESPEED_API_KEY);
  const warnings = perf.warning ? [perf.warning] : [];

  const checks: CheckResult[] = [
    ...runSeoChecks(page, robotsTxt, sitemapXml),
    ...perf.checks,
    ...runAccessibilityChecks(page),
    ...runMobileChecks(page),
    ...runTrustChecks(page),
    ...runConversionChecks(page),
    ...runLocalSeoChecks(page),
  ];

  const categories = buildCategoryScores(checks);
  const overallScore = buildOverallScore(categories);
  const growthEstimate = buildGrowthEstimate(categories);

  const failedChecks = checks.filter((c) => !c.passed && c.severity !== 'info');
  const baseRecommendations = buildRecommendations(failedChecks);
  const recommendations = await enrichRecommendationsWithAi(env.AI, baseRecommendations);

  return {
    url: page.finalUrl,
    scannedAt: new Date().toISOString(),
    overallScore,
    categories,
    recommendations,
    growthEstimate,
    meta: { pageTitle: page.title, partial: warnings.length > 0, warnings },
  };
}

/** Runs on the daily Cron Trigger: scans every monitored website whose schedule says it's due. */
export async function runDueScans(env: CronEnv): Promise<void> {
  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) {
    console.error('runDueScans: FIREBASE_SERVICE_ACCOUNT_JSON not configured, skipping.');
    return;
  }

  const dueWebsites = (await runQuery(serviceAccount, 'websites', [
    { field: 'status', op: 'EQUAL', value: 'active' },
    { field: 'nextScanDue', op: 'LESS_THAN_OR_EQUAL', value: new Date() },
  ])) as unknown as WebsiteDoc[];

  for (const website of dueWebsites) {
    try {
      const audit = await runAudit(website.url, env);
      if (!audit) continue;

      await addFirestoreDocument(serviceAccount, `websites/${website.id}/scans`, { ...audit });

      const now = new Date();
      const nextScanDue =
        website.frequency === 'manual' ? null : new Date(now.getTime() + FREQUENCY_MS[website.frequency]);

      await updateFirestoreDocument(serviceAccount, 'websites', website.id, {
        lastScannedAt: now,
        nextScanDue,
        latestOverallScore: audit.overallScore,
        latestCategoryScores: audit.categories.map((c) => ({ id: c.id, score: c.score })),
      });
    } catch (err) {
      console.error(`runDueScans: scan failed for website ${website.id} (${website.url}):`, err);
    }
  }
}
