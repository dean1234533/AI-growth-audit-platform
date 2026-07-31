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
import { addFirestoreDocument, updateFirestoreDocument, getFirestoreDocument, runQuery, parseServiceAccount } from '../src/server/lib/firestore';
import { notifyWebsiteScan, notifyCompetitorScan } from '../src/server/lib/notifyScan';
import { notifyAdmin, type AdminAlertEnv } from '../src/server/lib/adminAlert';

interface CronEnv extends AdminAlertEnv {
  PAGESPEED_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  VAPID_PRIVATE_KEY_JWK?: string;
  PUBLIC_VAPID_KEY?: string;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
}

interface WebsiteDoc {
  id: string;
  uid: string;
  url: string;
  name: string;
  frequency: ScanFrequency;
  status: 'active' | 'paused';
  latestOverallScore?: number;
  latestCategoryScores?: { id: string; score: number }[];
}

interface CompetitorDoc {
  id: string;
  url: string;
  name: string;
  path: string[];
  latestOverallScore?: number;
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
    await notifyAdmin(env, 'Firebase failure — cron skipped', ['FIREBASE_SERVICE_ACCOUNT_JSON is not configured; the scheduled scan run was skipped entirely.']);
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

      const previous: import('../src/server/lib/notificationRules').ScanSnapshot | null =
        website.latestOverallScore === undefined
          ? null
          : { overallScore: website.latestOverallScore, categoryScores: website.latestCategoryScores ?? [] };

      await notifyWebsiteScan(serviceAccount, env, {
        uid: website.uid,
        websiteId: website.id,
        websiteName: website.name,
        frequency: website.frequency,
        audit,
        previous,
      }).catch((err) => console.error(`runDueScans: notify failed for website ${website.id}:`, err));

      await notifyAdmin(env, 'Completed monitoring scan', [`${website.name} (${website.url}) scanned — score ${audit.overallScore}/100.`]);
    } catch (err) {
      console.error(`runDueScans: scan failed for website ${website.id} (${website.url}):`, err);
      await notifyAdmin(env, 'Failed scan', [`Scan failed for ${website.name} (${website.url}): ${err instanceof Error ? err.message : String(err)}`]);
    }
  }

  // Competitors default to a fixed weekly cadence (see COMPETITOR_FREQUENCY in src/lib/monitoring.ts,
  // which this mirrors) — there's no per-competitor frequency picker, so every due one gets scanned
  // and rescheduled a week out, regardless of its parent website's own frequency.
  const dueCompetitors = (await runQuery(
    serviceAccount,
    'competitors',
    [{ field: 'nextScanDue', op: 'LESS_THAN_OR_EQUAL', value: new Date() }],
    { allDescendants: true },
  )) as unknown as CompetitorDoc[];

  for (const competitor of dueCompetitors) {
    const websiteId = competitor.path[1];
    if (!websiteId) continue;
    try {
      const audit = await runAudit(competitor.url, env);
      if (!audit) continue;

      await addFirestoreDocument(serviceAccount, `websites/${websiteId}/competitors/${competitor.id}/scans`, { ...audit });

      const now = new Date();
      await updateFirestoreDocument(serviceAccount, `websites/${websiteId}/competitors`, competitor.id, {
        lastScannedAt: now,
        nextScanDue: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        latestOverallScore: audit.overallScore,
        latestCategoryScores: audit.categories.map((c) => ({ id: c.id, score: c.score })),
      });

      const parentWebsite = (await getFirestoreDocument(serviceAccount, 'websites', websiteId)) as unknown as
        | { uid: string; name: string }
        | null;
      if (parentWebsite) {
        await notifyCompetitorScan(serviceAccount, env, {
          uid: parentWebsite.uid,
          websiteId,
          websiteName: parentWebsite.name,
          competitorName: competitor.name,
          newScore: audit.overallScore,
          previousScore: competitor.latestOverallScore ?? null,
        }).catch((err) => console.error(`runDueScans: competitor notify failed for ${competitor.id}:`, err));
      }
    } catch (err) {
      console.error(`runDueScans: competitor scan failed for ${competitor.id} (${competitor.url}):`, err);
    }
  }
}
