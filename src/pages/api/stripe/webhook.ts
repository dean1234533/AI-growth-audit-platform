import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyStripeSignature } from '../../../server/lib/stripe';
import { updateFirestoreDocument, runQuery, parseServiceAccount } from '../../../server/lib/firestore';

export const prerender = false;

interface Env {
  STRIPE_WEBHOOK_SECRET?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

interface StripeEvent {
  type: string;
  data: {
    object: {
      client_reference_id?: string | null;
      customer?: string | null;
      subscription?: string | null;
      status?: string;
    };
  };
}

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

/**
 * Syncs a user's plan in Firestore from Stripe subscription events. This is the ONLY code path
 * allowed to set `plan`/`stripeCustomerId`/`stripeSubscriptionId` — firestore.rules blocks the
 * client from writing those fields directly, so a signed-in user can't just flip their own
 * plan to 'pro' from devtools.
 */
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;
  if (!cfEnv.STRIPE_WEBHOOK_SECRET) return new Response('Webhook not configured', { status: 503 });

  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) return new Response('Server not configured', { status: 500 });

  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();
  if (!signature || !(await verifyStripeSignature(rawBody, signature, cfEnv.STRIPE_WEBHOOK_SECRET))) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const uid = event.data.object.client_reference_id;
      const customerId = event.data.object.customer;
      const subscriptionId = event.data.object.subscription;
      if (uid && customerId) {
        await updateFirestoreDocument(serviceAccount, 'users', uid, {
          plan: 'pro',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId ?? null,
        });
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const customerId = event.data.object.customer;
      const status = event.data.object.status;
      if (customerId) {
        const matches = await runQuery(serviceAccount, 'users', [{ field: 'stripeCustomerId', op: 'EQUAL', value: customerId }]);
        const plan = event.type === 'customer.subscription.deleted' || !ACTIVE_STATUSES.has(status ?? '') ? 'free' : 'pro';
        for (const match of matches) {
          await updateFirestoreDocument(serviceAccount, 'users', match.id as string, { plan });
        }
      }
    }
  } catch (err) {
    console.error('stripe/webhook processing failed:', err);
    return new Response('Processing error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'content-type': 'application/json' } });
};
