import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyFirebaseIdToken } from '../../server/lib/verifyFirebaseIdToken';
import { addFirestoreDocument, getFirestoreDocument, parseServiceAccount, runQuery, type ServiceAccount } from '../../server/lib/firestore';
import { buildWebsiteQuota, canAddWebsite, resolvePlanId, websiteLimitMessage } from '../../server/lib/access';
import type { AuditResult, ScanFrequency } from '../../lib/types';

export const prerender = false;

interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers: { 'content-type': 'application/json' } });
}

interface VerifiedCaller {
  uid: string;
  email: string | null;
}

/**
 * Resolves the authenticated caller from a Bearer ID token — the only source of truth for
 * "who is this" and "what's their email" (used for admin resolution). Never trust a uid/email
 * in the request body; a client could put anything there.
 */
async function requireCaller(request: Request): Promise<VerifiedCaller | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined;
  if (!projectId) return null;
  const verified = await verifyFirebaseIdToken(idToken, projectId);
  if (!verified?.uid) return null;
  return { uid: verified.uid, email: verified.email ?? null };
}

async function resolveCallerPlan(serviceAccount: ServiceAccount, caller: VerifiedCaller) {
  const userDoc = await getFirestoreDocument(serviceAccount, 'users', caller.uid);
  const billingPlan = typeof userDoc?.plan === 'string' ? userDoc.plan : null;
  return resolvePlanId(caller.email, billingPlan);
}

async function countWebsites(serviceAccount: ServiceAccount, uid: string): Promise<number> {
  const docs = await runQuery(serviceAccount, 'websites', [{ field: 'uid', op: 'EQUAL', value: uid }]);
  return docs.length;
}

/** Current plan + website usage, for the frontend to render "3 / 5 websites" without hardcoding any limit itself. */
export const GET: APIRoute = async ({ request }) => {
  const caller = await requireCaller(request);
  if (!caller) return jsonError('Not authorized', 401);

  const cfEnv = env as unknown as Env;
  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return jsonError('Server not configured', 500);

  const planId = await resolveCallerPlan(serviceAccount, caller);
  const currentCount = await countWebsites(serviceAccount, caller.uid);
  const quota = buildWebsiteQuota(planId, currentCount);

  return new Response(JSON.stringify(quota), { headers: { 'content-type': 'application/json' } });
};

interface CreateWebsiteBody {
  url?: string;
  name?: string;
  frequency?: ScanFrequency;
  audit?: AuditResult;
}

/**
 * Creates a new monitored website + its first scan, enforcing the plan-based website limit
 * server-side. This is the ONLY way a website doc can be created — firestore.rules denies
 * direct client writes to `websites` on create, specifically so this check can't be bypassed
 * by talking to Firestore directly instead of this route.
 */
export const POST: APIRoute = async ({ request }) => {
  const caller = await requireCaller(request);
  if (!caller) return jsonError('Not authorized', 401);

  const cfEnv = env as unknown as Env;
  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return jsonError('Server not configured', 500);

  let body: CreateWebsiteBody;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  if (!body.url || !body.frequency || !body.audit) {
    return jsonError('Missing url, frequency, or audit', 400);
  }

  const planId = await resolveCallerPlan(serviceAccount, caller);
  const currentCount = await countWebsites(serviceAccount, caller.uid);

  if (!canAddWebsite(planId, currentCount)) {
    return jsonError('Website limit reached', 403, { message: websiteLimitMessage(planId) });
  }

  const now = new Date();
  const nextScanDue = computeNextScanDue(body.frequency, now);
  const name = body.name?.trim() || deriveName(body.audit.url);

  // Always write `caller.uid` — the verified token's uid — never anything the client might send
  // in the body, so a website can never be created on another user's behalf.
  const websiteId = await addFirestoreDocument(serviceAccount, 'websites', {
    uid: caller.uid,
    url: body.audit.url,
    name,
    frequency: body.frequency,
    status: 'active',
    createdAt: now,
    lastScannedAt: now,
    nextScanDue,
    latestOverallScore: body.audit.overallScore,
    latestCategoryScores: body.audit.categories.map((c) => ({ id: c.id, score: c.score })),
  });

  await addFirestoreDocument(serviceAccount, `websites/${websiteId}/scans`, body.audit as unknown as Record<string, unknown>);

  return new Response(JSON.stringify({ websiteId, audit: body.audit }), { headers: { 'content-type': 'application/json' } });
};

function computeNextScanDue(frequency: ScanFrequency, from: Date): Date | null {
  if (frequency === 'manual') return null;
  const next = new Date(from);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
}

function deriveName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
