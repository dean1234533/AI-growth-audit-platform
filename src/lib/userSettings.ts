import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseClient';
import type { ScanFrequency } from './types';

export type PlanId = 'free' | 'pro' | 'business';
export type NotificationPref = 'push' | 'email' | 'both' | 'none';

export interface WorkingHours {
  startHour: number;
  endHour: number;
}

export interface UserSettings {
  displayName: string;
  weeklyDigestEnabled: boolean;
  notificationPref: NotificationPref;
  defaultScanFrequency: ScanFrequency;
  /** Push alerts are held to the Notification Centre only outside this UTC hour window; null = no restriction. */
  workingHours: WorkingHours | null;
  plan: PlanId;
  createdAt?: unknown;
}

const DEFAULTS: UserSettings = {
  displayName: '',
  weeklyDigestEnabled: true,
  notificationPref: 'push',
  defaultScanFrequency: 'weekly',
  workingHours: null,
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
