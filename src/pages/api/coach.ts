import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { AuditResult } from '../../lib/types';
import { verifyFirebaseIdToken } from '../../server/lib/verifyFirebaseIdToken';
import { getFirestoreDocument, parseServiceAccount, type ServiceAccount } from '../../server/lib/firestore';
import { createGeminiRunner, getStoredGeminiKey, type AiRunner } from '../../server/lib/gemini';
import { AI_COACH_UPGRADE_MESSAGE, canUseAiCoach, resolvePlanId } from '../../server/lib/access';

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
 * AI Coach is a Pro feature, so — unlike the old "token optional" behaviour — a verified caller
 * is now required. Never trust a uid/email in the request body; a client could put anything
 * there, so identity only ever comes from a server-verified ID token (mirrors websites.ts's
 * requireCaller exactly, for the same reason).
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
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface CompetitorSummary {
  name: string;
  score: number;
  previousScore: number | null;
}

/** Summarises a scan (plus optional trend + competitor context) into the compact facts the model needs. */
function summariseAudit(
  audit: AuditResult,
  siteName: string,
  previous?: AuditResult | null,
  competitors?: CompetitorSummary[],
): string {
  const categoryLines = audit.categories.map((c) => `${c.label}: ${c.score}/100 (${c.checks.filter((x) => !x.passed).length} issues)`).join('\n');
  const topRecs = audit.recommendations
    .slice(0, 15)
    .map((r) => `- [${r.severity}/${r.impact} impact/${r.difficulty}/${r.estimatedTime}] ${r.title}: ${r.description}`)
    .join('\n');

  let trendSection = '';
  if (previous) {
    const scoreDelta = audit.overallScore - previous.overallScore;
    const previousIds = new Set(previous.recommendations.map((r) => r.id));
    const currentIds = new Set(audit.recommendations.map((r) => r.id));
    const newIssues = audit.recommendations.filter((r) => !previousIds.has(r.id));
    const resolvedIssues = previous.recommendations.filter((r) => !currentIds.has(r.id));
    trendSection = `\n\nSince the last scan (${previous.scannedAt}, score ${previous.overallScore}/100):
Score change: ${scoreDelta > 0 ? '+' : ''}${scoreDelta}
New issues: ${newIssues.map((r) => r.title).join('; ') || 'none'}
Resolved issues: ${resolvedIssues.map((r) => r.title).join('; ') || 'none'}`;
  }

  let competitorSection = '';
  if (competitors && competitors.length > 0) {
    const lines = competitors.map((c) => {
      const trend = c.previousScore !== null ? ` (was ${c.previousScore})` : '';
      return `- ${c.name}: ${c.score}/100${trend}`;
    });
    competitorSection = `\n\nCompetitors being tracked:\n${lines.join('\n')}`;
  }

  return `Website: ${siteName} (${audit.url})
Last scanned: ${audit.scannedAt}
Overall score: ${audit.overallScore}/100

Category scores:
${categoryLines}

Detected issues (priority order):
${topRecs}${trendSection}${competitorSection}`;
}

export const POST: APIRoute = async ({ request }) => {
  const caller = await requireCaller(request);
  if (!caller) return jsonError('Not authorized', 401);

  const cfEnv = env as unknown as Env;
  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return jsonError('Server not configured', 500);

  const planId = await resolveCallerPlan(serviceAccount, caller);
  if (!canUseAiCoach(planId)) {
    return jsonError('AI Coach is a Pro feature', 403, { message: AI_COACH_UPGRADE_MESSAGE });
  }

  const geminiRunner = await resolveGeminiRunner(serviceAccount, caller.uid);
  const aiRunner = geminiRunner ?? cfEnv.AI;
  if (!aiRunner) return jsonError('AI coach is not available right now.', 503);

  let body: {
    question?: string;
    siteName?: string;
    audit?: AuditResult;
    previous?: AuditResult | null;
    competitors?: CompetitorSummary[];
    history?: { role: 'user' | 'assistant'; content: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  const question = (body.question ?? '').trim();
  if (!question || !body.audit) {
    return jsonError('A question and audit data are required', 400);
  }

  const dataSummary = summariseAudit(body.audit, body.siteName ?? body.audit.url, body.previous, body.competitors);
  const history = (body.history ?? []).slice(-6);

  try {
    const result = await aiRunner.run(MODEL, {
      messages: [
        {
          role: 'system',
          content:
            'You are an AI website growth coach. You must answer ONLY using the website data provided below — never give generic SEO advice not grounded in this specific data. If the data does not contain enough information to answer, say so plainly rather than inventing something. Keep answers concise (3-6 sentences, or a short bullet list), specific, and reference actual detected issues, scores or categories by name. Speak directly to the business owner, plain English, no jargon.\n\n' +
            dataSummary,
        },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: question },
      ],
      max_tokens: 500,
    });

    const answer = result?.response?.trim();
    if (!answer) return jsonError('The coach could not generate an answer. Please try again.', 502);

    return new Response(JSON.stringify({ answer }), { headers: { 'content-type': 'application/json' } });
  } catch {
    return jsonError('The coach could not generate an answer. Please try again.', 502);
  }
};
