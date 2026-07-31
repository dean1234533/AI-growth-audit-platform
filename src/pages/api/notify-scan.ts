import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { AuditResult, ScanFrequency } from '../../lib/types';
import type { ScanSnapshot } from '../../server/lib/notificationRules';
import { notifyWebsiteScan } from '../../server/lib/notifyScan';
import { parseServiceAccount } from '../../server/lib/firestore';
import type { AdminAlertEnv } from '../../server/lib/adminAlert';

export const prerender = false;

interface Env extends AdminAlertEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  VAPID_PRIVATE_KEY_JWK?: string;
  PUBLIC_VAPID_KEY?: string;
}

interface RequestBody {
  uid?: string;
  websiteId?: string;
  websiteName?: string;
  frequency?: ScanFrequency;
  audit?: AuditResult;
  previous?: ScanSnapshot | null;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * Called (fire-and-forget) by the client right after it writes a manual/first scan to
 * Firestore. Notification docs and push sends need the trusted service account (clients can't
 * create their own notification docs per firestore.rules, and only the server holds the VAPID
 * private key), so this small trusted endpoint mirrors what the cron job does automatically
 * for scheduled scans.
 */
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;
  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return jsonError('Server not configured', 500);

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  if (!body.uid || !body.websiteId || !body.websiteName || !body.frequency || !body.audit) {
    return jsonError('Missing required fields', 400);
  }

  try {
    await notifyWebsiteScan(serviceAccount, cfEnv, {
      uid: body.uid,
      websiteId: body.websiteId,
      websiteName: body.websiteName,
      frequency: body.frequency,
      audit: body.audit,
      previous: body.previous ?? null,
    });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('notify-scan failed:', err);
    return jsonError('Could not process notifications', 500);
  }
};
