// scripts/backing-screenshots/vitest.config.mjs
//
// Dedicated config for the Backing screenshot HARNESS (Backing Beta PR 4).
// The harness renders the backing surfaces with BACKING_BETA_ENABLED forced
// on and writes static pages for shoot.mjs to photograph; it is deliberately
// kept OUT of the default suite — its filename ends in `.render.jsx` (no
// `.test.`/`.spec.`), which the default glob never matches (the
// vitest.rules.config.mjs precedent).
//
// Run: BACKING_SHOTS_DIR=<dir> npx vitest run --config scripts/backing-screenshots/vitest.config.mjs
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from '../../vite.config.js';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['scripts/backing-screenshots/**/*.render.jsx'],
    },
  })
);
