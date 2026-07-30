import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { stripeRequest } from '../../../server/lib/stripe';

export const prerender = false;

interface Env {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRO_PRICE_ID?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

/** Creates a Stripe Checkout session for the Pro subscription, tagged with the signed-in user's uid. */
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;
  if (!cfEnv.STRIPE_SECRET_KEY || !cfEnv.STRIPE_PRO_PRICE_ID) return jsonError('Billing is not configured yet.', 503);

  let body: { uid?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }
  if (!body.uid || !body.email) return jsonError('Missing uid or email', 400);

  const origin = new URL(request.url).origin;

  try {
    const session = await stripeRequest<{ url: string }>(cfEnv.STRIPE_SECRET_KEY, 'POST', '/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': cfEnv.STRIPE_PRO_PRICE_ID,
      'line_items[0][quantity]': 1,
      client_reference_id: body.uid,
      customer_email: body.email,
      success_url: `${origin}/dashboard/billing?success=1`,
      cancel_url: `${origin}/dashboard/billing?canceled=1`,
    });
    return new Response(JSON.stringify({ url: session.url }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('stripe/checkout failed:', err);
    return jsonError('Could not start checkout. Please try again.', 502);
  }
};
