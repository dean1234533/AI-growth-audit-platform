import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyFirebaseIdToken } from '../../../server/lib/verifyFirebaseIdToken';
import { listFirestoreDocuments, updateFirestoreDocument, parseServiceAccount } from '../../../server/lib/firestore';
import { ADMIN_EMAIL } from '../../../server/lib/adminAlert';

export const prerender = false;

interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

async function requireAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined;
  if (!projectId) return false;
  const verified = await verifyFirebaseIdToken(idToken, projectId);
  return verified?.email === ADMIN_EMAIL;
}

export const GET: APIRoute = async ({ request }) => {
  if (!(await requireAdmin(request))) return jsonError('Not authorized', 403);

  const cfEnv = env as unknown as Env;
  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return jsonError('Server not configured', 500);

  const leads = await listFirestoreDocuments(serviceAccount, 'leads');
  leads.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));

  return new Response(JSON.stringify({ leads }), { headers: { 'content-type': 'application/json' } });
};

export const PATCH: APIRoute = async ({ request }) => {
  if (!(await requireAdmin(request))) return jsonError('Not authorized', 403);

  const cfEnv = env as unknown as Env;
  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return jsonError('Server not configured', 500);

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  const validStatuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
  if (!body.id || !body.status || !validStatuses.includes(body.status)) {
    return jsonError('Invalid lead id or status', 400);
  }

  await updateFirestoreDocument(serviceAccount, 'leads', body.id, { status: body.status });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
