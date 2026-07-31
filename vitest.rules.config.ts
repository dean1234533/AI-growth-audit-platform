import { defineConfig } from 'vitest/config';

// Separate config for the Firestore-emulator-backed rules test — kept out of the default
// `vitest run` (vitest.config.ts) so the main suite doesn't require a running emulator/Java.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/server/lib/__tests__/firestoreRules.test.ts'],
  },
});
