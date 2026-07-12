// vitest.rules.config.mjs
//
// Dedicated config for the Firestore security-rules test suite (Agent Learning
// System L1, Phase 1). These tests talk to a live Firestore emulator, so they
// are deliberately kept OUT of the default suite — their filenames end in
// `.rules.mjs` (no `.test.`/`.spec.`), which the default glob never matches
// (the vitest.eval.config.mjs precedent).
//
// Run via `npm run test:rules`, which wraps this in `firebase emulators:exec`
// so the emulator is up and FIRESTORE_EMULATOR_HOST is set.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/rules/**/*.rules.mjs'],
    // The emulator is shared process-wide; run rules files serially so
    // clearFirestore() in one file can't race another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
