import { addFirestoreDocument, getFirestoreDocument, listFirestoreDocuments, deleteFirestoreDocument } from './firestore';
import { sendPushNotification, type PushSubscriptionJSON } from './push';
import { buildScanNotifications, buildCompetitorActivityNotification, type ScanSnapshot, type DraftNotification } from './notificationRules';
import type { AuditResult, ScanFrequency } from '../../lib/types';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface NotifyEnv {
  VAPID_PRIVATE_KEY_JWK?: string;
  PUBLIC_VAPID_KEY?: string;
}

async function deliverNotifications(
  serviceAccount: ServiceAccount,
  env: NotifyEnv,
  uid: string,
  drafts: DraftNotification[],
): Promise<void> {
  if (drafts.length === 0) return;

  const [userDoc, subscriptions] = await Promise.all([
    getFirestoreDocument(serviceAccount, 'users', uid),
    listFirestoreDocuments(serviceAccount, `users/${uid}/pushSubscriptions`),
  ]);

  const notificationPref = (userDoc?.notificationPref as string) ?? 'push';
  const workingHours = userDoc?.workingHours as { startHour: number; endHour: number } | null | undefined;

  const withinWorkingHours = (() => {
    if (!workingHours) return true;
    const utcHour = new Date().getUTCHours();
    return workingHours.startHour <= workingHours.endHour
      ? utcHour >= workingHours.startHour && utcHour < workingHours.endHour
      : utcHour >= workingHours.startHour || utcHour < workingHours.endHour;
  })();

  const shouldPush = (notificationPref === 'push' || notificationPref === 'both') && withinWorkingHours;

  for (const draft of drafts) {
    await addFirestoreDocument(serviceAccount, `users/${uid}/notifications`, {
      ...draft,
      read: false,
      createdAt: new Date(),
    });

    if (!shouldPush || !env.VAPID_PRIVATE_KEY_JWK || !env.PUBLIC_VAPID_KEY) continue;

    for (const sub of subscriptions) {
      const subscription = sub as unknown as PushSubscriptionJSON & { id: string };
      try {
        const result = await sendPushNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          { title: draft.title, body: draft.body, url: draft.url, tag: draft.type },
          env.VAPID_PRIVATE_KEY_JWK,
          env.PUBLIC_VAPID_KEY,
        );
        if (result.expired) {
          await deleteFirestoreDocument(serviceAccount, `users/${uid}/pushSubscriptions`, subscription.id);
        }
      } catch (err) {
        console.error(`notifyScan: push send failed for ${uid}:`, err);
      }
    }
  }
}

/** Call after writing a website's new scan — diffs against its previous score snapshot and delivers notifications + push. */
export async function notifyWebsiteScan(
  serviceAccount: ServiceAccount,
  env: NotifyEnv,
  params: {
    uid: string;
    websiteId: string;
    websiteName: string;
    frequency: ScanFrequency;
    audit: AuditResult;
    previous: ScanSnapshot | null;
  },
): Promise<void> {
  if (params.frequency === 'manual') return;
  const drafts = buildScanNotifications(params.audit, params.previous, {
    id: params.websiteId,
    name: params.websiteName,
    frequency: params.frequency,
  });
  await deliverNotifications(serviceAccount, env, params.uid, drafts);
}

/** Call after writing a competitor's new scan — notifies the parent website's owner of significant moves. */
export async function notifyCompetitorScan(
  serviceAccount: ServiceAccount,
  env: NotifyEnv,
  params: {
    uid: string;
    websiteId: string;
    websiteName: string;
    competitorName: string;
    newScore: number;
    previousScore: number | null;
  },
): Promise<void> {
  if (params.previousScore === null) return;
  const draft = buildCompetitorActivityNotification(params.competitorName, params.newScore, params.previousScore, {
    id: params.websiteId,
    name: params.websiteName,
  });
  if (!draft) return;
  await deliverNotifications(serviceAccount, env, params.uid, [draft]);
}
