import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { AuditResult, Lead } from '../../lib/types';
import { addFirestoreDocument, parseServiceAccount } from '../../server/lib/firestore';

export const prerender = false;

interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

interface LeadRequestBody extends Lead {
  audit?: Pick<AuditResult, 'url' | 'overallScore' | 'scannedAt'>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;

  let body: LeadRequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim();
  const business = (body.business ?? '').trim();
  const website = (body.website ?? '').trim();

  if (!name || !business || !website || !EMAIL_REGEX.test(email)) {
    return jsonError('Please fill in all fields with a valid email address', 400);
  }

  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) {
    return new Response(JSON.stringify({ ok: true, stored: false }), { headers: { 'content-type': 'application/json' } });
  }

  try {
    await addFirestoreDocument(serviceAccount, 'leads', {
      name,
      email,
      business,
      website,
      auditUrl: body.audit?.url ?? website,
      auditScore: body.audit?.overallScore ?? null,
      auditScannedAt: body.audit?.scannedAt ?? null,
      createdAt: new Date(),
    });
  } catch {
    return jsonError('Failed to store lead. Please try again.', 500);
  }

  return new Response(JSON.stringify({ ok: true, stored: true }), { headers: { 'content-type': 'application/json' } });
};
