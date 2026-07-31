import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Requires a running Firestore emulator (Java) — run separately via `npm run test:rules`,
    // not part of the default `vitest run` so the main suite stays emulator-independent.
    exclude: ['**/node_modules/**', '**/__tests__/firestoreRules.test.ts'],
  },
});
