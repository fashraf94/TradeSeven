// vitest.config.js
//
// TEST-ONLY config. Vitest reads this file at higher priority than
// vite.config.js, so the production build config stays untouched — nothing
// vitest-related enters the Vercel build path (Vercel runs `vite build`,
// which reads vite.config.js and never loads this file).
//
// It MERGES vite.config.js rather than replacing it: until this file existed,
// vitest fell back to vite.config.js and therefore ran with the React plugin
// and the `@` → ./src alias. Merging preserves that transform pipeline exactly,
// so adding this config changes nothing about how tests are compiled — the
// only delta is the `exclude` below.
//
// WHY THE EXCLUDE: research/level-study is a self-contained study that is
// "isolated from the TradeSeven product. Zero product imports, zero
// dependencies (Node built-ins only)" (research/level-study/package.json) and
// ships its own runner — `node --test "tests/*.test.js"`. Its 44 suites are
// written against the NODE BUILT-IN test runner (`import { test } from
// 'node:test'`), not vitest, so vitest collects them, finds no suite
// registered through its own API, and fails all 44 at file load with
// "No test suite found in file". They are not broken tests and they are not
// ours to convert — see docs/TEST_SUITE_BACKLOG.md.
//
// The glob is deliberately narrow. `**/research/**` would be WRONG: the 14
// suites in api/research/ and the 3 in src/components/Research/ are genuine
// vitest tests and must keep running.
//
// `exclude` REPLACES vitest's defaults rather than extending them, so
// configDefaults.exclude is spread back in — omitting it would pull
// node_modules/ and dist/ into collection.

import { defineConfig, mergeConfig, configDefaults } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, 'research/level-study/tests/**'],
    },
  })
);
