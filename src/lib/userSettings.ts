import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseClient';

export type PlanId = 'free' | 'pro' | 'business';

export interface UserSettings {
  displayName: string;
  weeklyDigestEnabled: boolean;
  plan: PlanId;
  createdAt?: unknown;
}

const DEFAULTS: UserSettings = {
  displayName: '',
  weeklyDigestEnabled: true,
  plan: 'free',
};

export async function getUserSettings(uid: string): Promise<UserSettings> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return DEFAULTS;
  return { ...DEFAULTS, ...(snap.data() as Partial<UserSettings>) };
}

export async function saveUserSettings(uid: string, updates: Partial<UserSettings>): Promise<void> {
  await setDoc(doc(db, 'users', uid), { ...updates, updatedAt: serverTimestamp() }, { merge: true });
}

export async function ensureUserDoc(uid: string, displayName: string): Promise<void> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return;
  await setDoc(doc(db, 'users', uid), { ...DEFAULTS, displayName, createdAt: serverTimestamp() });
}
