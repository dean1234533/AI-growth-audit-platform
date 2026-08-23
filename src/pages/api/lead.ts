import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { AuditResult, Lead } from '../../lib/types';
import type { AttributionContext } from '../../lib/attribution';
import { addFirestoreDocument, parseServiceAccount } from '../../server/lib/firestore';
import { notifyAdmin, type AdminAlertEnv } from '../../server/lib/adminAlert';

export const prerender = false;

interface Env extends AdminAlertEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

interface LeadRequestBody extends Lead {
  audit?: Pick<AuditResult, 'url' | 'overallScore' | 'scannedAt' | 'categories' | 'recommendations'>;
  source?: 'pdf_download' | 'enquiry';
  helpWith?: string;
  preferredContact?: 'email' | 'phone' | 'either';
  message?: string;
  recommendedServices?: string[];
  attribution?: AttributionContext;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeAttribution(value: AttributionContext | undefined): Record<string, string | number | null> | null {
  if (!value || value.version !== 1) return null;
  const clean = (input: unknown, max: number) => typeof input === 'string' && input.trim().length <= max ? input.trim() : null;
  return {
    version: 1,
    channel: clean(value.channel, 20),
    leadId: clean(value.leadId, 200),
    leadCollection: clean(value.leadCollection, 100),
  };
}

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
  const source = body.source === 'enquiry' ? 'enquiry' : 'pdf_download';

  if (!name || !business || !website || !EMAIL_REGEX.test(email)) {
    return jsonError('Please fill in all fields with a valid email address', 400);
  }
  if (source === 'enquiry' && !(body.helpWith ?? '').trim()) {
    return jsonError('Please let us know what you\'d like help with', 400);
  }

  const topIssues = (body.audit?.recommendations ?? []).slice(0, 5).map((r) => r.title);
  const categoryScores = (body.audit?.categories ?? []).map((c) => ({ id: c.id, score: c.score }));

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
      source,
      status: 'new',
      helpWith: body.helpWith ?? null,
      preferredContact: body.preferredContact ?? null,
      message: body.message ?? null,
      recommendedServices: body.recommendedServices ?? [],
      auditUrl: body.audit?.url ?? website,
      auditScore: body.audit?.overallScore ?? null,
      auditScannedAt: body.audit?.scannedAt ?? null,
      categoryScores,
      topIssues,
      attribution: safeAttribution(body.attribution),
      createdAt: new Date(),
    });
  } catch {
    return jsonError('Failed to store lead. Please try again.', 500);
  }

  if (source === 'enquiry') {
    await notifyAdmin(cfEnv, `New enquiry from ${name} (${business})`, [
      `Website: ${website}`,
      `Email: ${email}`,
      `Wants help with: ${body.helpWith ?? '-'}`,
      `Preferred contact: ${body.preferredContact ?? '-'}`,
      body.message ? `Message: ${body.message}` : '',
      body.audit?.overallScore != null ? `Audit score: ${body.audit.overallScore}/100` : '',
      topIssues.length ? `Top issues: ${topIssues.join('; ')}` : '',
    ].filter(Boolean));
  }

  return new Response(JSON.stringify({ ok: true, stored: true }), { headers: { 'content-type': 'application/json' } });
};
