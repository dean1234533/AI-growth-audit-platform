// Deliberately hardcoded rather than imported from src/lib/seo/site.ts — that module reads
// import.meta.env, which Vite only replaces inside the Astro build. cron/entry.ts (which also
// imports this file) is bundled separately by wrangler's own esbuild, where that replacement
// never happens and the import blows up at runtime with "Cannot read properties of undefined".
const ADMIN_EMAIL = 'dean@dean-da-dev.co.uk';

export interface AdminAlertEnv {
  RESEND_API_KEY?: string;
  REPORT_FROM_EMAIL?: string;
}

/**
 * Sends Dean a short, scannable email for a platform event — the admin-only counterpart to
 * user-facing push notifications. Best-effort: never throws, since a failed admin email must
 * never break the user-facing flow that triggered it. Mirrors the Resend call already used in
 * contact.ts's `notifyOwner` and report-summary/send-report's email sends.
 */
export async function notifyAdmin(env: AdminAlertEnv, subject: string, lines: string[]): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.REPORT_FROM_EMAIL ?? 'reports@dean-da-dev.co.uk',
        to: ADMIN_EMAIL,
        subject: `[Growth Audit] ${subject}`,
        html: `<p>${lines.map((l) => escapeHtml(l)).join('</p><p>')}</p>`,
      }),
    });
  } catch (err) {
    console.error(`notifyAdmin: failed to send "${subject}":`, err);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
