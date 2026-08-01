import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyFirebaseIdToken } from '../../../server/lib/verifyFirebaseIdToken';
import { parseServiceAccount } from '../../../server/lib/firestore';
import { createGeminiRunner, getStoredGeminiKey, type AiRunner } from '../../../server/lib/gemini';
import { ADMIN_EMAIL } from '../../../server/lib/adminAlert';
import { SITE_URL } from '../../../lib/seo/site';

export const prerender = false;

interface Env {
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const CHANNELS = ['email', 'sms', 'social'] as const;
type Channel = (typeof CHANNELS)[number];

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

/** Verifies the caller is the admin, and returns their uid (for looking up their own Gemini key) or null if not authorized. */
async function requireAdminUid(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined;
  if (!projectId) return null;
  const verified = await verifyFirebaseIdToken(idToken, projectId);
  return verified?.email === ADMIN_EMAIL ? verified.uid : null;
}

const CHANNEL_GUIDANCE: Record<Channel, string> = {
  email: 'Write this as a short cold email (no subject line, just the body). 3-5 short sentences/paragraphs. Can include a brief greeting and sign-off with just "Dean".',
  sms: 'Write this as a text message. Very short — 2-3 sentences max, no greeting/sign-off, get straight to the point.',
  social: 'Write this as a casual social media DM (e.g. Instagram/Facebook/LinkedIn). Short, friendly, conversational — 2-4 sentences, no formal greeting or sign-off.',
};

export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;
  const uid = await requireAdminUid(request);
  if (!uid) return jsonError('Not authorized', 403);

  let body: { business?: string; website?: string; findings?: string[]; channel?: Channel };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  const business = (body.business ?? '').trim();
  const website = (body.website ?? '').trim();
  const findings = (body.findings ?? []).map((f) => f.trim()).filter(Boolean).slice(0, 5);
  const channel: Channel = CHANNELS.includes(body.channel as Channel) ? (body.channel as Channel) : 'email';

  if (!business || !website || findings.length === 0) {
    return jsonError('Business name, website and at least one finding are required', 400);
  }

  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  const geminiKey = serviceAccount ? await getStoredGeminiKey(serviceAccount, uid) : undefined;
  const aiRunner: AiRunner | typeof cfEnv.AI = geminiKey ? createGeminiRunner(geminiKey) : cfEnv.AI;
  if (!aiRunner) return jsonError('AI is not available right now.', 503);

  const auditUrl = SITE_URL;

  try {
    const result = await aiRunner.run(MODEL, {
      messages: [
        {
          role: 'system',
          content: `You write short, natural, human-sounding cold outreach messages on behalf of a web developer. Rules:
- Only mention the specific issues listed below — never invent or guess additional problems.
- Never exaggerate business impact (no "guaranteed", no invented percentages or stats).
- The goal is NOT to sell a website or pitch services in this message. The goal is ONLY to get the recipient to try a free website audit tool.
- Tone: friendly, direct, genuinely helpful — not salesy, not generic.
- Always include this exact link somewhere natural in the message: ${auditUrl}
- Vary your phrasing and structure each time — never use a fixed template.
- ${CHANNEL_GUIDANCE[channel]}
- Output ONLY the message text, nothing else (no subject line, no explanation, no quotes around it).`,
        },
        {
          role: 'user',
          content: `Business name: ${business}\nWebsite: ${website}\nIssues found on their site:\n${findings.map((f) => `- ${f}`).join('\n')}`,
        },
      ],
      max_tokens: 350,
    });

    const message = result?.response?.trim();
    if (!message) return jsonError('Could not generate a message. Please try again.', 502);

    return new Response(JSON.stringify({ message, auditUrl }), { headers: { 'content-type': 'application/json' } });
  } catch {
    return jsonError('Could not generate a message. Please try again.', 502);
  }
};
