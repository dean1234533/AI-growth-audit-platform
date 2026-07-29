import type { AuditResult, Lead } from '../../src/lib/types';
import { addFirestoreDocument, parseServiceAccount } from '../lib/firestore';

interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

interface LeadRequestBody extends Lead {
  audit?: Pick<AuditResult, 'url' | 'overallScore' | 'scannedAt'>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

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

  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) {
    // Firebase not configured yet — don't block the lead flow in local/dev setups.
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

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
