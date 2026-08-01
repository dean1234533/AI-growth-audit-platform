import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { WeeklyDigest } from '../../lib/reports';
import { verifyFirebaseIdToken } from '../../server/lib/verifyFirebaseIdToken';
import { getFirestoreDocument, parseServiceAccount, type ServiceAccount } from '../../server/lib/firestore';
import { createGeminiRunner, getStoredGeminiKey, type AiRunner } from '../../server/lib/gemini';
import { AI_REPORTS_UPGRADE_MESSAGE, canUseAiReports, resolvePlanId } from '../../server/lib/access';

export const prerender = false;

interface Env {
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

interface VerifiedCaller {
  uid: string;
  email: string | null;
}

/**
 * AI-written weekly reports are a Pro feature, so — like coach.ts — a verified caller is
 * required. Never trust a uid/email in the request body.
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

/** The caller's own Gemini key, if they have one set — returns undefined (meaning "use the
 * shared AI") on any lookup failure, never throws. */
async function resolveGeminiRunner(serviceAccount: ServiceAccount | null, uid: string): Promise<AiRunner | undefined> {
  if (!serviceAccount) return undefined;
  const key = await getStoredGeminiKey(serviceAccount, uid);
  return key ? createGeminiRunner(key) : undefined;
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers: { 'content-type': 'application/json' } });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function digestToFacts(digest: WeeklyDigest): string {
  const deltaText =
    digest.scoreDelta === null
      ? 'This is the first scan on record.'
      : digest.scoreDelta === 0
        ? 'The score has not changed since the last scan.'
        : `The score ${digest.scoreDelta > 0 ? 'increased' : 'decreased'} from ${digest.previousScore} to ${digest.currentScore} (${digest.scoreDelta > 0 ? '+' : ''}${digest.scoreDelta}).`;

  return `Site: ${digest.siteName} (${digest.siteUrl})
Current score: ${digest.currentScore}/100
${deltaText}
Resolved since last scan: ${digest.resolvedIssues.map((r) => r.title).join('; ') || 'none'}
New issues since last scan: ${digest.newIssues.map((r) => r.title).join('; ') || 'none'}
Top priority right now: ${digest.topPriority ? `${digest.topPriority.title} — ${digest.topPriority.description}` : 'none'}`;
}

/** A short conversational narrative for the top of a weekly report — grounded in the same digest data the report itself renders. */
export const POST: APIRoute = async ({ request }) => {
  const caller = await requireCaller(request);
  if (!caller) return jsonError('Not authorized', 401);

  const cfEnv = env as unknown as Env;
  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return jsonError('Server not configured', 500);

  const planId = await resolveCallerPlan(serviceAccount, caller);
  if (!canUseAiReports(planId)) {
    return jsonError('AI reports are a Pro feature', 403, { message: AI_REPORTS_UPGRADE_MESSAGE });
  }

  let body: { digest?: WeeklyDigest; userName?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }
  if (!body.digest) return jsonError('A digest is required', 400);

  const name = body.userName?.trim();
  const salutation = `${greeting()}${name ? `, ${name}` : ''} 👋`;

  const geminiRunner = await resolveGeminiRunner(serviceAccount, caller.uid);
  const aiRunner = geminiRunner ?? cfEnv.AI;

  if (!aiRunner) {
    // Deterministic fallback if Workers AI isn't available — still real data, just not prose-polished.
    const d = body.digest;
    const scoreLine =
      d.scoreDelta === null
        ? `Your first scan of ${d.siteName} is in — you're starting at ${d.currentScore}/100.`
        : `Your website health has ${d.scoreDelta >= 0 ? 'increased' : 'decreased'} from ${d.previousScore} to ${d.currentScore}.`;
    return new Response(JSON.stringify({ summary: `${salutation} ${scoreLine}` }), { headers: { 'content-type': 'application/json' } });
  }

  try {
    const result = await aiRunner.run(MODEL, {
      messages: [
        {
          role: 'system',
          content:
            `You write the opening line of a weekly website health report, in the voice of a friendly AI coach speaking directly to the site owner. ` +
            `Start with exactly this salutation: "${salutation}". Then write 2-4 short sentences using ONLY the facts below — no invented numbers, no generic advice. ` +
            `Mention the score and its change, and name the single most important thing to do next if there is a top priority. Plain English, warm but concise, no headers or bullet points.\n\n` +
            digestToFacts(body.digest),
        },
        { role: 'user', content: 'Write the summary.' },
      ],
      max_tokens: 220,
    });

    const summary = result?.response?.trim();
    if (!summary) throw new Error('empty response');
    return new Response(JSON.stringify({ summary }), { headers: { 'content-type': 'application/json' } });
  } catch {
    const d = body.digest;
    const scoreLine =
      d.scoreDelta === null
        ? `Your first scan of ${d.siteName} is in — you're starting at ${d.currentScore}/100.`
        : `Your website health has ${d.scoreDelta >= 0 ? 'increased' : 'decreased'} from ${d.previousScore} to ${d.currentScore}.`;
    return new Response(JSON.stringify({ summary: `${salutation} ${scoreLine}` }), { headers: { 'content-type': 'application/json' } });
  }
};
