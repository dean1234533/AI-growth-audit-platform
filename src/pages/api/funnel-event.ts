import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addFirestoreDocument, parseServiceAccount } from '../../server/lib/firestore';

export const prerender = false;

interface Env { FIREBASE_SERVICE_ACCOUNT_JSON?: string }

const EVENTS = new Set(['landing_view', 'audit_started', 'audit_completed', 'booking_clicked', 'enquiry_opened', 'report_unlocked', 'monitor_clicked']);
const CHANNELS = new Set(['email', 'whatsapp', 'instagram', 'facebook', 'linkedin']);

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result && result.length <= max ? result : null;
}

export const POST: APIRoute = async ({ request }) => {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 4_096) return new Response(null, { status: 413 });
  let raw: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 4_096) return new Response(null, { status: 413 });
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }
  const event = clean(raw.event, 40);
  if (!event || !EVENTS.has(event)) return new Response(null, { status: 400 });

  const source = raw.attribution && typeof raw.attribution === 'object'
    ? raw.attribution as Record<string, unknown>
    : {};
  const channelValue = clean(source.channel, 20);
  const attribution = {
    version: source.version === 1 ? 1 : null,
    channel: channelValue && CHANNELS.has(channelValue) ? channelValue : null,
    leadId: clean(source.leadId, 200),
    leadCollection: clean(source.leadCollection, 100),
  };
  const serviceAccount = parseServiceAccount((env as unknown as Env).FIREBASE_SERVICE_ACCOUNT_JSON);
  if (serviceAccount) {
    try {
      await addFirestoreDocument(serviceAccount, 'funnelEvents', {
        event,
        attribution,
        website: clean(raw.website, 500) ?? clean(source.website, 500),
        score: typeof raw.score === 'number' && raw.score >= 0 && raw.score <= 100 ? raw.score : null,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('[funnel-event] Firestore write failed', error);
      return new Response(null, { status: 500 });
    }
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
