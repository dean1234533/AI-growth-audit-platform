import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { stripeRequest } from '../../../server/lib/stripe';

export const prerender = false;

interface Env {
  STRIPE_SECRET_KEY?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

/** Creates a Stripe Billing Portal session so an existing subscriber can manage or cancel. */
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;
  if (!cfEnv.STRIPE_SECRET_KEY) return jsonError('Billing is not configured yet.', 503);

  let body: { customerId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }
  if (!body.customerId) return jsonError('Missing customerId', 400);

  const origin = new URL(request.url).origin;

  try {
    const session = await stripeRequest<{ url: string }>(cfEnv.STRIPE_SECRET_KEY, 'POST', '/billing_portal/sessions', {
      customer: body.customerId,
      return_url: `${origin}/dashboard/billing`,
    });
    return new Response(JSON.stringify({ url: session.url }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('stripe/portal failed:', err);
    return jsonError('Could not open the billing portal. Please try again.', 502);
  }
};
