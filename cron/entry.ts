// Astro's Cloudflare adapter builds dist/server/entry.mjs exporting { fetch }, but Cloudflare
// Cron Triggers need a `scheduled` export too, which Astro doesn't generate. This thin wrapper
// re-exports the Astro-built fetch handler unchanged and adds the scheduled handler for
// automated website monitoring scans. It only resolves after `astro build` has produced
// dist/server/entry.mjs, so it's passed as the entry point to `wrangler deploy` (never built
// directly by `astro build` itself) — see the "deploy" script in package.json.
import astroEntry from '../dist/server/entry.mjs';
import { runDueScans } from './runDueScans';
import { notifyAdmin, type AdminAlertEnv } from '../src/server/lib/adminAlert';

interface Env extends AdminAlertEnv {
  PAGESPEED_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  VAPID_PRIVATE_KEY_JWK?: string;
  PUBLIC_VAPID_KEY?: string;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
  /** Self-referential Service Binding + allowlist, declared in wrangler.toml — see selfFetch.ts. */
  SELF?: { fetch: (url: string, init?: RequestInit) => Promise<Response> };
  SELF_HOSTNAMES?: string;
}

async function runScheduledSafely(env: Env): Promise<void> {
  try {
    await runDueScans(env);
  } catch (err) {
    console.error('cron: uncaught scheduled-run failure:', err);
    await notifyAdmin(env, 'Worker failure — scheduled scan run', [
      `The daily cron run threw an uncaught error: ${err instanceof Error ? err.message : String(err)}`,
    ]);
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** public/_headers covers genuine static-asset responses served directly by the ASSETS
 * binding, but not responses this Worker generates itself (SSR pages, API routes) — this
 * covers those, so every response gets the same security headers either way. */
async function fetchWithSecurityHeaders(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const response = await astroEntry.fetch(request, env, ctx);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  fetch: fetchWithSecurityHeaders,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledSafely(env));
  },
} satisfies ExportedHandler<Env>;
