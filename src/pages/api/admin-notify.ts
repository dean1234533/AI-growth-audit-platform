import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { notifyAdmin, type AdminAlertEnv } from '../../server/lib/adminAlert';

export const prerender = false;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

interface RequestBody {
  event?: 'new_user' | 'new_website';
  email?: string;
  websiteUrl?: string;
  websiteName?: string;
  frequency?: string;
}

/**
 * Trusted admin-alert trigger for events that only ever happen client-side (new signup, new
 * monitored website) — the client can't hold RESEND_API_KEY, so it fires this instead. The
 * `event` field is a fixed allowlist and the email body is always built server-side from it,
 * never from client-supplied free text, so this can't be abused as an open email-send relay.
 */
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as AdminAlertEnv;

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  const email = (body.email ?? '').slice(0, 200);

  if (body.event === 'new_user') {
    await notifyAdmin(cfEnv, 'New user registration', [`A new user signed up: ${email || 'unknown email'}.`]);
  } else if (body.event === 'new_website') {
    const url = (body.websiteUrl ?? '').slice(0, 300);
    const name = (body.websiteName ?? '').slice(0, 200);
    const frequency = (body.frequency ?? '').slice(0, 20);
    await notifyAdmin(cfEnv, 'New monitored website', [
      `${email || 'A user'} added a new website to monitor:`,
      `${name} (${url}) — ${frequency} scans.`,
    ]);
  } else {
    return jsonError('Unknown event', 400);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
