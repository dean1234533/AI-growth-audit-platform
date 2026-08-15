import type { ScanFrequency } from '../src/lib/types';
import { runFullAudit, type AuditEnv } from '../src/server/lib/runFullAudit';
import { addFirestoreDocument, updateFirestoreDocument, getFirestoreDocument, runQuery, parseServiceAccount } from '../src/server/lib/firestore';
import { notifyWebsiteScan, notifyCompetitorScan } from '../src/server/lib/notifyScan';
import { notifyAdmin, type AdminAlertEnv } from '../src/server/lib/adminAlert';
import { getStoredGeminiKey } from '../src/server/lib/gemini';

interface CronEnv extends AuditEnv, AdminAlertEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  VAPID_PRIVATE_KEY_JWK?: string;
  PUBLIC_VAPID_KEY?: string;
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

// Browser Rendering's free-tier limits (3 concurrent browsers, 1 new instance/20s — see
// wrangler.toml's [browser] binding comment) mean scanning every due site in one unbounded
// sequential loop, now that each scan can launch a real browser, risks either blowing past
// the concurrency cap or exhausting the daily render budget in one cron run. Process in small
// bounded batches with pacing between them instead.
const BATCH_SIZE = 3;
const BATCH_PACING_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processInBatches<T>(items: T[], handler: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((item) => handler(item)));
    if (i + BATCH_SIZE < items.length) await sleep(BATCH_PACING_MS);
  }
}

async function runAudit(
  targetUrl: string,
  env: CronEnv,
  options?: { crawlPages?: boolean; runPerformance?: boolean; geminiApiKey?: string; priority?: 'monitoring' },
) {
  const { result } = await runFullAudit(targetUrl, env, options);
  return result;
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

  await processInBatches(dueWebsites, async (website) => {
    try {
      const geminiApiKey = await getStoredGeminiKey(serviceAccount, website.uid).catch(() => undefined);
      // 'monitoring' priority — checked against the daily Browser Rendering budget INSIDE
      // runFullAudit (hasRenderBudget, scanBudget.ts) before any render is attempted, and is
      // never allowed to spend into PROTECTED_CUSTOMER_RESERVATION_SECONDS. A skipped render
      // still completes the rest of the audit via static analysis/PSI — see auditQuality on
      // the result — rather than the scan failing outright.
      const audit = await runAudit(website.url, env, { geminiApiKey, priority: 'monitoring' });
      if (!audit) return;

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
    } catch (err) {
      console.error(`runDueScans: scan failed for website ${website.id} (${website.url}):`, err);
      await notifyAdmin(env, 'Failed scan', [`Scan failed for ${website.name} (${website.url}): ${err instanceof Error ? err.message : String(err)}`]);
    }
  });

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
      const audit = await runAudit(competitor.url, env, { crawlPages: false, runPerformance: false });
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
