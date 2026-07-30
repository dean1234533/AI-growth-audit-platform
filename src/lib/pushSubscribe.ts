import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebaseClient';

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** Requests browser permission (if not already granted/denied) and stores the subscription in Firestore. */
export async function subscribeToPush(uid: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'Push notifications are not supported on this device.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Notifications permission was not granted.' };
  }

  const publicKey = import.meta.env.PUBLIC_VAPID_KEY as string;
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });
  }

  const json = subscription.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
  if (!json.keys) return { ok: false, reason: 'Subscription is missing encryption keys.' };

  const subId = await sha256Hex(json.endpoint);
  await setDoc(doc(db, 'users', uid, 'pushSubscriptions', subId), {
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent,
    createdAt: serverTimestamp(),
  });

  return { ok: true };
}

export async function unsubscribeFromPush(uid: string): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    const subId = await sha256Hex(endpoint);
    await deleteDoc(doc(db, 'users', uid, 'pushSubscriptions', subId)).catch(() => {});
  }
}

export interface StoredPushSubscription {
  id: string;
  endpoint: string;
  userAgent?: string;
}

export async function listPushSubscriptions(uid: string): Promise<StoredPushSubscription[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'pushSubscriptions'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as { endpoint: string; userAgent?: string }) }));
}

export async function removePushSubscription(uid: string, subId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'pushSubscriptions', subId));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
