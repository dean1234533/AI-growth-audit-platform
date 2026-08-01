import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Exercises the actual firestore.rules file against a local Firestore emulator — the only way
// to verify rule changes without deploying to the live project (see DEFECT 1: the deployed
// production ruleset was missing the pushSubscriptions/notifications blocks that exist here).
// Requires `firebase emulators:exec` (or an already-running emulator on :8080) — see package.json.
describe('firestore.rules — pushSubscriptions & notifications', () => {
  let testEnv: RulesTestEnvironment;
  const OWNER_UID = 'alice';
  const OTHER_UID = 'bob';

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'growth-audit-platform-rules-test',
      firestore: {
        rules: readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('pushSubscriptions', () => {
    it('owner can create their own push subscription', async () => {
      const db = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(
        setDoc(doc(db, `users/${OWNER_UID}/pushSubscriptions/sub1`), {
          endpoint: 'https://fcm.googleapis.com/fcm/send/example',
          keys: { p256dh: 'key', auth: 'secret' },
        }),
      );
    });

    it('another authenticated user cannot read or write it', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `users/${OWNER_UID}/pushSubscriptions/sub1`), {
          endpoint: 'https://fcm.googleapis.com/fcm/send/example',
        });
      });

      const db = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(getDoc(doc(db, `users/${OWNER_UID}/pushSubscriptions/sub1`)));
      await assertFails(setDoc(doc(db, `users/${OWNER_UID}/pushSubscriptions/sub1`), { endpoint: 'hijacked' }));
    });
  });

  describe('notifications', () => {
    async function seedNotification() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `users/${OWNER_UID}/notifications/n1`), {
          title: 'New opportunity',
          body: 'Improve Largest Contentful Paint',
          read: false,
        });
      });
    }

    it('owner can read their own notification', async () => {
      await seedNotification();
      const db = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(getDoc(doc(db, `users/${OWNER_UID}/notifications/n1`)));
    });

    it('owner can mark their own notification as read', async () => {
      await seedNotification();
      const db = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(updateDoc(doc(db, `users/${OWNER_UID}/notifications/n1`), { read: true }));
    });

    it('the client can never create a notification directly, owner or not', async () => {
      const db = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertFails(setDoc(doc(db, `users/${OWNER_UID}/notifications/n2`), { title: 'forged', read: false }));
    });

    it('another authenticated user cannot read or update it', async () => {
      await seedNotification();
      const db = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(getDoc(doc(db, `users/${OWNER_UID}/notifications/n1`)));
      await assertFails(updateDoc(doc(db, `users/${OWNER_UID}/notifications/n1`), { read: true }));
    });

    it('an unauthenticated request cannot read it', async () => {
      await seedNotification();
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, `users/${OWNER_UID}/notifications/n1`)));
    });
  });

  describe('users/{uid}/secrets/gemini — write-only from the client, never readable, not even by the owner', () => {
    it('the owner can write (save/replace) their own key', async () => {
      const db = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(setDoc(doc(db, `users/${OWNER_UID}/secrets/gemini`), { apiKey: 'real-key-123' }));
    });

    it('NOT EVEN THE OWNER can read it back — this is the property that keeps the plaintext key out of the browser', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `users/${OWNER_UID}/secrets/gemini`), { apiKey: 'real-key-123' });
      });
      const db = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertFails(getDoc(doc(db, `users/${OWNER_UID}/secrets/gemini`)));
    });

    it('the owner can delete (remove) their own key', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `users/${OWNER_UID}/secrets/gemini`), { apiKey: 'real-key-123' });
      });
      const db = testEnv.authenticatedContext(OWNER_UID).firestore();
      const { deleteDoc } = await import('firebase/firestore');
      await assertSucceeds(deleteDoc(doc(db, `users/${OWNER_UID}/secrets/gemini`)));
    });

    it('another authenticated user cannot read or write it (owner isolation)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `users/${OWNER_UID}/secrets/gemini`), { apiKey: 'real-key-123' });
      });
      const db = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(getDoc(doc(db, `users/${OWNER_UID}/secrets/gemini`)));
      await assertFails(setDoc(doc(db, `users/${OWNER_UID}/secrets/gemini`), { apiKey: 'hijacked-key' }));
    });

    it('an unauthenticated request cannot read or write it', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `users/${OWNER_UID}/secrets/gemini`), { apiKey: 'real-key-123' });
      });
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, `users/${OWNER_UID}/secrets/gemini`)));
      await assertFails(setDoc(doc(db, `users/${OWNER_UID}/secrets/gemini`), { apiKey: 'hijacked-key' }));
    });
  });

  describe('websites — creation is server-only (plan limits enforced by POST /api/websites, not by rules)', () => {
    it('the client can never create a website doc directly, even for their own uid', async () => {
      // This is the property that makes the website-limit enforcement in
      // src/pages/api/websites.ts actually secure: if a direct client create were allowed here,
      // a user could bypass the plan-based limit entirely by talking to Firestore directly
      // instead of the quota-checked route.
      const db = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertFails(setDoc(doc(db, 'websites/forged-website'), { uid: OWNER_UID, url: 'https://evil.example.com' }));
    });

    it('the client cannot create a website claiming a different owner either', async () => {
      const db = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertFails(setDoc(doc(db, 'websites/forged-website-2'), { uid: OTHER_UID, url: 'https://evil.example.com' }));
    });
  });
});
