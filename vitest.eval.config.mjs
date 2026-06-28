// vitest.eval.config.mjs
//
// Phase H — dedicated config for the Archetype-Integrity OBSERVE reliability eval.
// The eval harness makes REAL Gemma calls, so it is deliberately kept OUT of the
// default suite (its filename has no `.test.`/`.spec.`, which the default glob
// requires). Run it explicitly:
//
//     npx vitest run --config vitest.eval.config.mjs
//
// Needs OPENROUTER_API_KEY set and outbound access to openrouter.ai.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['api/scripts/archetype-integrity-eval/**/*.eval.mjs'],
    // 2h ceiling. With bounded concurrency an N=3 run finishes in minutes, but the
    // timeout stays generous so a slow-network day / rate-limit backoff can't trip it.
    testTimeout: 2 * 60 * 60 * 1000,
    hookTimeout: 5 * 60 * 1000,
    fileParallelism: false,
  },
});
