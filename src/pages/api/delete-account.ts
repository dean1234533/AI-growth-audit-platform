import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { stripeRequest } from '../../server/lib/stripe';
import { verifyFirebaseIdToken } from '../../server/lib/verifyFirebaseIdToken';
import {
  deleteFirestoreDocument,
  getFirestoreDocument,
  listFirestoreDocuments,
  parseServiceAccount,
  runQuery,
  type ServiceAccount,
} from '../../server/lib/firestore';

export const prerender = false;

interface Env {
  STRIPE_SECRET_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

/** Deletes every doc directly under a collection path, paging until it is empty. */
async function purgeCollection(sa: ServiceAccount, collectionPath: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const docs = await listFirestoreDocuments(sa, collectionPath);
    if (docs.length === 0) return;
    await Promise.all(docs.map((d) => deleteFirestoreDocument(sa, collectionPath, String(d.id))));
  }
}

/**
 * Permanently removes everything stored for the signed-in user and cancels their Stripe
 * subscription, so deleting an account can never leave a Pro customer being billed. The
 * Firestore rules make scan history immutable and block client deletes of the user doc, so
 * this has to run server-side with the service account. The browser deletes the Firebase
 * Auth user itself afterwards.
 */
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined;
  const authHeader = request.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const caller = projectId ? await verifyFirebaseIdToken(idToken, projectId) : null;
  if (!caller?.uid) return jsonError('Please sign in again.', 401);

  const sa = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!sa) return jsonError('Server not configured', 500);
  const uid = caller.uid;

  try {
    // 1. Stop billing first — if this fails we must not delete the account.
    const userDoc = await getFirestoreDocument(sa, 'users', uid);
    const subId = typeof userDoc?.stripeSubscriptionId === 'string' ? userDoc.stripeSubscriptionId : null;
    if (subId && cfEnv.STRIPE_SECRET_KEY) {
      try {
        await stripeRequest(cfEnv.STRIPE_SECRET_KEY, 'DELETE', `/subscriptions/${encodeURIComponent(subId)}`);
      } catch (err) {
        // Already-cancelled subscriptions 404 — anything else blocks the deletion.
        if (!(err instanceof Error) || !/No such subscription|resource_missing|canceled/i.test(err.message)) throw err;
      }
    }

    // 2. Monitored websites with their scans, competitors and competitor scans.
    const sites = await runQuery(sa, 'websites', [{ field: 'uid', op: 'EQUAL', value: uid }]);
    for (const site of sites) {
      const siteId = String(site.id);
      const competitors = await listFirestoreDocuments(sa, `websites/${siteId}/competitors`).catch(() => []);
      for (const c of competitors) {
        await purgeCollection(sa, `websites/${siteId}/competitors/${String(c.id)}/scans`);
        await deleteFirestoreDocument(sa, `websites/${siteId}/competitors`, String(c.id));
      }
      await purgeCollection(sa, `websites/${siteId}/scans`);
      await deleteFirestoreDocument(sa, 'websites', siteId);
    }

    // 3. The user's own document and subcollections.
    await purgeCollection(sa, `users/${uid}/pushSubscriptions`);
    await purgeCollection(sa, `users/${uid}/notifications`);
    await deleteFirestoreDocument(sa, `users/${uid}/secrets`, 'gemini');
    await deleteFirestoreDocument(sa, 'users', uid);

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('delete-account failed:', err);
    return jsonError('Could not delete your account right now. Please try again.', 502);
  }
};
