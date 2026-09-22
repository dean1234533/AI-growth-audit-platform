import { parseServiceAccount, runQuery, listFirestoreDocuments, deleteFirestoreDocument } from './firestore';
import { sendPushNotification, type PushSubscriptionJSON } from './push';

// Matches access.ts's ADMIN_EMAIL — the Firebase Auth account the admin actually logs into the
// app with, so push subscriptions registered from that account's devices are the ones alerts
// go to.
export const ADMIN_EMAIL = 'deanburt1308@gmail.com';

export interface AdminAlertEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  VAPID_PRIVATE_KEY_JWK?: string;
  PUBLIC_VAPID_KEY?: string;
}

/**
 * Sends the admin a push notification for a platform event — the admin-only counterpart to
 * user-facing push notifications (see notifyScan.ts's deliverNotifications). Best-effort: never
 * throws, since a failed admin alert must never break the user-facing flow that triggered it.
 * Delivered entirely through the existing Web Push pipeline (push.ts) rather than email — no
 * Resend dependency.
 */
export async function notifyAdmin(env: AdminAlertEnv, subject: string, lines: string[]): Promise<void> {
  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount || !env.VAPID_PRIVATE_KEY_JWK || !env.PUBLIC_VAPID_KEY) {
    console.error(`notifyAdmin: missing Firebase/VAPID config, dropping alert "${subject}"`);
    return;
  }

  try {
    const adminUsers = await runQuery(serviceAccount, 'users', [{ field: 'email', op: 'EQUAL', value: ADMIN_EMAIL }]);
    const adminUser = adminUsers[0] as { id: string } | undefined;
    if (!adminUser) {
      console.error(`notifyAdmin: no user doc for ${ADMIN_EMAIL}, dropping alert "${subject}"`);
      return;
    }

    const subscriptions = await listFirestoreDocuments(serviceAccount, `users/${adminUser.id}/pushSubscriptions`);
    for (const sub of subscriptions) {
      const subscription = sub as unknown as PushSubscriptionJSON & { id: string };
      try {
        const result = await sendPushNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          { title: subject, body: lines.join(' — '), tag: 'admin-alert' },
          env.VAPID_PRIVATE_KEY_JWK,
          env.PUBLIC_VAPID_KEY,
        );
        if (result.expired) {
          await deleteFirestoreDocument(serviceAccount, `users/${adminUser.id}/pushSubscriptions`, subscription.id);
        }
      } catch (err) {
        console.error(`notifyAdmin: push send failed for "${subject}":`, err);
      }
    }
  } catch (err) {
    console.error(`notifyAdmin: failed to deliver "${subject}":`, err);
  }
}
