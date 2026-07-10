// vitest.watchlisteval.config.mjs
//
// Release 2 PR-d — dedicated config for the watchlist-framing corpus eval.
// The harness makes REAL OpenRouter calls, so it is kept OUT of the default
// suite (no `.test.` in its filename). Run explicitly (Flash, locally):
//
//     OPENROUTER_API_KEY=... npx vitest run --config vitest.watchlisteval.config.mjs
//
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['api/scripts/watchlist-framing-eval/**/*.eval.mjs'],
    testTimeout: 60 * 60 * 1000,
    hookTimeout: 5 * 60 * 1000,
    fileParallelism: false,
  },
});
