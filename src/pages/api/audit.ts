import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { runFullAudit, type AuditEnv } from '../../server/lib/runFullAudit';
import { notifyAdmin, type AdminAlertEnv } from '../../server/lib/adminAlert';
import { resolveHttpAuditPriority } from '../../server/lib/auditPriority';

export const prerender = false;

interface Env extends AuditEnv, AdminAlertEnv {}

function normalizeUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;

  let body: { url?: string; businessName?: string; businessType?: string; location?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  const targetUrl = normalizeUrl(body.url ?? '');
  if (!targetUrl) {
    return jsonError('Please enter a valid website URL', 400);
  }

  const businessContext = {
    businessName: body.businessName?.trim() || undefined,
    businessType: body.businessType?.trim() || undefined,
    location: body.location?.trim() || undefined,
  };

  // Resolved server-side from a verified Firebase ID token (Bearer header), never from
  // anything in the request body — see auditPriority.ts. Covers the public lead-gen tool
  // (no token -> 'public'), a logged-in customer's "Scan Now"/new-website audit ('customer'),
  // and Dean's own admin account ('admin') identically, whichever page on the site actually
  // called this endpoint.
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined;
  const priority = await resolveHttpAuditPriority(request, projectId);

  const { result, error } = await runFullAudit(targetUrl, cfEnv, { businessContext, priority });
  if (!result) {
    return jsonError(error ?? 'Unable to analyse this website', 422);
  }

  await notifyAdmin(cfEnv, 'Audit completed', [`${result.url} scored ${result.overallScore}/100.`]);

  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  });
};
