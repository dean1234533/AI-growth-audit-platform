import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { stripeRequest } from '../../../server/lib/stripe';
import { verifyFirebaseIdToken } from '../../../server/lib/verifyFirebaseIdToken';
import { getFirestoreDocument, parseServiceAccount } from '../../../server/lib/firestore';

export const prerender = false;

interface Env {
  STRIPE_SECRET_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

/** Creates a Stripe Billing Portal session so an existing subscriber can manage or cancel. */
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;
  if (!cfEnv.STRIPE_SECRET_KEY) return jsonError('Billing is not configured yet.', 503);

  // The customer id is read from the caller's own user doc — never from the request body,
  // which would let anyone open another customer's billing portal.
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined;
  const authHeader = request.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const caller = projectId ? await verifyFirebaseIdToken(idToken, projectId) : null;
  if (!caller?.uid) return jsonError('Please sign in again.', 401);

  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return jsonError('Server not configured', 500);
  const userDoc = await getFirestoreDocument(serviceAccount, 'users', caller.uid);
  const customerId = typeof userDoc?.stripeCustomerId === 'string' ? userDoc.stripeCustomerId : null;
  if (!customerId) return jsonError('No billing account found.', 404);

  const origin = new URL(request.url).origin;

  try {
    const session = await stripeRequest<{ url: string }>(cfEnv.STRIPE_SECRET_KEY, 'POST', '/billing_portal/sessions', {
      customer: customerId,
      return_url: `${origin}/dashboard/billing`,
    });
    return new Response(JSON.stringify({ url: session.url }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('stripe/portal failed:', err);
    return jsonError('Could not open the billing portal. Please try again.', 502);
  }
};
