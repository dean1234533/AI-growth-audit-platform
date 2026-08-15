import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebaseClient';

export type NotificationType =
  | 'critical_alert'
  | 'weekly_report'
  | 'health_improved'
  | 'health_declined'
  | 'competitor_activity'
  | 'security_warning'
  | 'performance_drop'
  | 'content_recommendation'
  | 'site_down'
  | 'site_recovered'
  | 'content_issue'
  | 'content_recovered';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string;
  websiteId?: string;
  websiteName?: string;
  read: boolean;
  createdAt: { toDate: () => Date } | null;
}

export function subscribeToNotifications(uid: string, callback: (notifications: AppNotification[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(30));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) })));
  });
}

export async function markNotificationRead(uid: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { read: true });
}

export async function markAllNotificationsRead(uid: string, notificationIds: string[]): Promise<void> {
  if (!notificationIds.length) return;
  const batch = writeBatch(db);
  for (const id of notificationIds) {
    batch.update(doc(db, 'users', uid, 'notifications', id), { read: true });
  }
  await batch.commit();
}
