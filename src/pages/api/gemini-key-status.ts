import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyFirebaseIdToken } from '../../server/lib/verifyFirebaseIdToken';
import { parseServiceAccount } from '../../server/lib/firestore';
import { getGeminiKeyLast4 } from '../../server/lib/gemini';

export const prerender = false;

interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * Tells the Settings page whether the signed-in user has a Gemini key saved, and its last 4
 * characters for the masked "•••• last4" display — never the full key. This is the ONLY way
 * the client ever learns anything about the stored key; firestore.rules denies reading
 * users/{uid}/secrets/gemini directly, even for the owner.
 */
export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined;
  if (!projectId) return jsonError('Server not configured', 500);
  const verified = await verifyFirebaseIdToken(idToken, projectId);
  if (!verified?.uid) return jsonError('Not authorized', 401);

  const cfEnv = env as unknown as Env;
  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return jsonError('Server not configured', 500);

  const last4 = await getGeminiKeyLast4(serviceAccount, verified.uid);
  return new Response(JSON.stringify({ hasKey: last4 !== null, last4 }), { headers: { 'content-type': 'application/json' } });
};
