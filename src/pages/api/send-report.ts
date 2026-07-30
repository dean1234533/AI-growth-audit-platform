import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { WeeklyDigest } from '../../lib/reports';

export const prerender = false;

interface Env {
  RESEND_API_KEY?: string;
  REPORT_FROM_EMAIL?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function digestToHtml(digest: WeeklyDigest): string {
  const deltaText =
    digest.scoreDelta === null
      ? 'First scan on record.'
      : digest.scoreDelta === 0
        ? 'No change since last scan.'
        : `${digest.scoreDelta > 0 ? '+' : ''}${digest.scoreDelta} since last scan.`;

  return `
    <h1>${digest.siteName} — Weekly Health Report</h1>
    <p>Score: <strong>${digest.currentScore}/100</strong> (${deltaText})</p>
    ${digest.resolvedIssues.length ? `<p><strong>${digest.resolvedIssues.length} issue(s) resolved:</strong><br>${digest.resolvedIssues.map((r) => r.title).join('<br>')}</p>` : ''}
    ${digest.newIssues.length ? `<p><strong>${digest.newIssues.length} new issue(s):</strong><br>${digest.newIssues.map((r) => r.title).join('<br>')}</p>` : ''}
    ${digest.topPriority ? `<p><strong>Top priority:</strong> ${digest.topPriority.title} — ${digest.topPriority.description}</p>` : ''}
  `;
}

export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;

  let body: { to?: string; digest?: WeeklyDigest };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  if (!body.to || !body.digest) return jsonError('Recipient email and digest are required', 400);

  if (!cfEnv.RESEND_API_KEY) {
    // Not a failure — email delivery is an optional layer on top of the in-app report.
    // See README for how to configure RESEND_API_KEY once you have a Resend account.
    return new Response(JSON.stringify({ ok: true, sent: false, reason: 'Email delivery is not configured yet.' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${cfEnv.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: cfEnv.REPORT_FROM_EMAIL ?? 'reports@dean-da-dev.co.uk',
        to: body.to,
        subject: `${body.digest.siteName} — Weekly Website Health Report`,
        html: digestToHtml(body.digest),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return new Response(JSON.stringify({ ok: true, sent: true }), { headers: { 'content-type': 'application/json' } });
  } catch {
    return jsonError('Could not send the report email. Please try again.', 502);
  }
};
