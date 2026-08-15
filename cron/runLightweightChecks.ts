import { resolveFetcher, type SelfFetchEnv } from '../src/server/lib/selfFetch';
import { checkSiteReachable } from '../src/server/lib/lightweightCheck';
import { resolvePlanId, canUseInstantAlerts } from '../src/server/lib/access';
import { notifyUptimeChange, notifyContentIssue } from '../src/server/lib/notifyScan';
import { type AdminAlertEnv } from '../src/server/lib/adminAlert';
import { getFirestoreDocument, updateFirestoreDocument, runQuery, parseServiceAccount, type ServiceAccount } from '../src/server/lib/firestore';

interface CronEnv extends SelfFetchEnv, AdminAlertEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  VAPID_PRIVATE_KEY_JWK?: string;
  PUBLIC_VAPID_KEY?: string;
}

interface WebsiteDoc {
  id: string;
  uid: string;
  url: string;
  name: string;
  status: 'active' | 'paused';
  lastKnownUp?: boolean | null;
  consecutiveDownChecks?: number;
  /** Last known-good content snapshot, for the content-drift check below — absent until the
   * first successful, non-broken-looking check. */
  lastPageTitle?: string | null;
  lastContentLength?: number | null;
  consecutiveContentIssues?: number;
  contentIssueFlagged?: boolean;
}

// Two consecutive 15-minute-apart failures (~15-30 min of confirmed downtime) before alerting —
// a single failed check is just as likely to be a transient network blip as a real outage.
const DOWN_THRESHOLD = 2;

// Only compare against a baseline that actually had substantial content — a homepage that was
// already tiny can't meaningfully "collapse" further, so comparing it would just be noise.
const MIN_BASELINE_CONTENT_LENGTH = 200;
// Content dropping below this fraction of its last known-good length is the "looks broken"
// signal (a hacked/defaced page, a crashed plugin blanking the site, a bad deploy).
const CONTENT_DROP_RATIO = 0.2;
const CONTENT_ISSUE_THRESHOLD = 2;

/**
 * Runs on the 15-minute Cron Trigger (see wrangler.toml, cron/entry.ts) — a lightweight,
 * Browser-Rendering-free check for Pro/admin-owned monitored websites, so a problem surfaces
 * within minutes instead of waiting for the next full daily/weekly scan. Two independent things
 * are checked from the same single request: (1) is the server reachable at all (down/recovered),
 * and (2) does the homepage still look like itself, content-wise (issue/recovered) — a hacked,
 * defaced, or crashed-plugin page can return a perfectly healthy 200 OK while looking nothing
 * like the real site, which reachability alone would never catch. See access.ts's
 * canUseInstantAlerts for the plan gate. Deliberately separate from runDueScans.ts's full-audit
 * pass — this never touches the BROWSER binding or scanBudget.ts's render budget, just a single
 * plain fetch() per site per run.
 */
export async function runLightweightChecks(env: CronEnv): Promise<void> {
  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) {
    console.error('runLightweightChecks: FIREBASE_SERVICE_ACCOUNT_JSON not configured, skipping.');
    return;
  }

  const activeWebsites = (await runQuery(serviceAccount, 'websites', [
    { field: 'status', op: 'EQUAL', value: 'active' },
  ])) as unknown as WebsiteDoc[];
  if (activeWebsites.length === 0) return;

  // Resolve each unique owner's plan once, not once per website — a Pro user can have up to 5
  // monitored websites sharing the same owner.
  const ownerQualifies = new Map<string, boolean>();
  for (const uid of new Set(activeWebsites.map((w) => w.uid))) {
    try {
      const userDoc = await getFirestoreDocument(serviceAccount, 'users', uid);
      const planId = resolvePlanId((userDoc?.email as string | undefined) ?? null, (userDoc?.plan as string | undefined) ?? null);
      ownerQualifies.set(uid, canUseInstantAlerts(planId));
    } catch (err) {
      console.error(`runLightweightChecks: failed to resolve plan for ${uid}:`, err);
      ownerQualifies.set(uid, false);
    }
  }

  // Free-tier websites are filtered out before any fetch() happens at all — cost only exists in
  // proportion to actual Pro usage, never blind polling of every monitored site on the platform.
  const qualifying = activeWebsites.filter((w) => ownerQualifies.get(w.uid));
  await Promise.all(qualifying.map((website) => checkOneWebsite(serviceAccount, env, website)));
}

async function checkOneWebsite(serviceAccount: ServiceAccount, env: CronEnv, website: WebsiteDoc): Promise<void> {
  try {
    const fetcher = resolveFetcher(website.url, env);
    const { up, title, contentLength } = await checkSiteReachable(website.url, fetcher);
    const wasDown = website.lastKnownUp === false;
    const consecutiveDownChecks = up ? 0 : (website.consecutiveDownChecks ?? 0) + 1;

    const update: Record<string, unknown> = {
      lastUptimeCheckAt: new Date(),
      lastKnownUp: up,
      consecutiveDownChecks,
    };

    // Content-drift is only meaningful when the site actually responded — a down site has no
    // content to compare, and shouldn't clobber the last known-good snapshot while it's out.
    let contentLooksBroken = false;
    let consecutiveContentIssues = website.consecutiveContentIssues ?? 0;
    let contentIssueFlagged = website.contentIssueFlagged ?? false;
    if (up) {
      const baseline = website.lastContentLength ?? null;
      contentLooksBroken = baseline !== null && baseline >= MIN_BASELINE_CONTENT_LENGTH && contentLength < baseline * CONTENT_DROP_RATIO;

      if (contentLooksBroken) {
        consecutiveContentIssues += 1;
        // Baseline (lastPageTitle/lastContentLength) is deliberately NOT updated here — keep the
        // last known-good snapshot so recovery can still be detected once the page is fixed.
      } else {
        consecutiveContentIssues = 0;
        contentIssueFlagged = false;
        update.lastPageTitle = title;
        update.lastContentLength = contentLength;
      }
      update.consecutiveContentIssues = consecutiveContentIssues;
      update.contentIssueFlagged = contentIssueFlagged;
    }

    const shouldFlagContentIssue = up && contentLooksBroken && consecutiveContentIssues === CONTENT_ISSUE_THRESHOLD && !website.contentIssueFlagged;
    if (shouldFlagContentIssue) update.contentIssueFlagged = true;

    await updateFirestoreDocument(serviceAccount, 'websites', website.id, update);

    if (!up && consecutiveDownChecks === DOWN_THRESHOLD) {
      await notifyUptimeChange(serviceAccount, env, { uid: website.uid, websiteId: website.id, websiteName: website.name, status: 'down' }).catch((err) =>
        console.error(`runLightweightChecks: down-notify failed for ${website.id}:`, err),
      );
    } else if (up && wasDown) {
      await notifyUptimeChange(serviceAccount, env, { uid: website.uid, websiteId: website.id, websiteName: website.name, status: 'recovered' }).catch((err) =>
        console.error(`runLightweightChecks: recovered-notify failed for ${website.id}:`, err),
      );
    }

    if (shouldFlagContentIssue) {
      await notifyContentIssue(serviceAccount, env, { uid: website.uid, websiteId: website.id, websiteName: website.name, status: 'issue' }).catch((err) =>
        console.error(`runLightweightChecks: content-issue notify failed for ${website.id}:`, err),
      );
    } else if (up && !contentLooksBroken && website.contentIssueFlagged) {
      await notifyContentIssue(serviceAccount, env, { uid: website.uid, websiteId: website.id, websiteName: website.name, status: 'recovered' }).catch((err) =>
        console.error(`runLightweightChecks: content-recovered notify failed for ${website.id}:`, err),
      );
    }
  } catch (err) {
    console.error(`runLightweightChecks: check failed for ${website.id} (${website.url}):`, err);
  }
}
