import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseClient';

/**
 * Writes the user's own Gemini API key to a Firestore location the client can write but never
 * read back (firestore.rules: users/{uid}/secrets/gemini has `allow read: if false`). This is a
 * blind write — Firestore rules don't require reading existing data first — so the plaintext
 * key never round-trips back into the browser after this call returns. For the masked
 * "•••• last4" display, see getGeminiKeyStatus in ./api.ts, which reads it via a trusted server
 * route instead.
 */
export async function saveGeminiKey(uid: string, apiKey: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'secrets', 'gemini'), { apiKey, updatedAt: serverTimestamp() });
}

export async function removeGeminiKey(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'secrets', 'gemini'));
}
