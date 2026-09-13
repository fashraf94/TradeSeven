import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },

  // ── Node globals: server + tooling surfaces ──────────────────────────────
  //
  // The entry above declares ONLY browser globals, for every file in the repo.
  // That made `process`, `Buffer`, `global` and `__dirname` undefined under
  // api/ and scripts/ — 730 of the 734 `no-undef` errors at c35f9a5 were this
  // one cause, which buried the 4 real ones. This entry merges the Node set
  // back in for the surfaces that actually run in Node.
  //
  // MERGE, NOT REPLACE: flat config unions `languageOptions.globals` across
  // every entry a file matches, so files here keep the browser set AND the
  // rules from the entry above. That union is deliberate and is what item 3
  // of the task needs — a shared api/_utils/ module imported by src/ is
  // legitimately both, and gets both without being enumerated. The cost is
  // stated on purpose: a stray `document` / `window` inside api/ will NOT be
  // flagged by no-undef. Narrowing that means splitting the browser entry to
  // `src/**`, which is a separate, deliberate change.
  //
  // KNOWN MASKING: `globals.node` includes the CommonJS wrapper vars
  // (`require`, `module`, `exports`, `__dirname`, `__filename`), which do NOT
  // exist in this package's plain ESM runtime ("type": "module"). Declaring
  // them here silences 3 `require` and 4 `__dirname` sites that the c35f9a5
  // run had flagged — two of which are real. They are recorded in
  // docs/audits/20260913_LINT_NODE_GLOBALS.md rather than fixed here;
  // `globals.nodeBuiltin` (same set minus the CJS vars) is the follow-up.
  {
    files: [
      'api/**/*.{js,jsx,mjs,cjs}',
      'scripts/**/*.{js,jsx,mjs,cjs}',
      'research/**/*.{js,jsx,mjs,cjs}',
      'discovery/**/*.{js,mjs,cjs}',
      'tracer/**/*.{js,mjs,cjs}',
      'test/**/*.{js,mjs,cjs}',
      // Root tooling configs: eslint, postcss, tailwind, vite, and the three
      // vitest configs (vitest.config.js, vitest.eval.config.mjs,
      // vitest.rules.config.mjs). A bare `*.` glob does not cross `/`, so
      // this stays root-only. There is no functions/ dir in this repo.
      '*.config.{js,mjs,cjs}',
      'test-firebase.js',
      'firestore.rules.emulator.test.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  // ── Node globals: test files, wherever they live ─────────────────────────
  //
  // vitest runs every suite in Node, so a test under src/ reaches for
  // `process`, `__dirname` and `global` exactly like one under api/ — while
  // still needing the browser set for jsdom (`document`, `window`). Same
  // union as above, and the same "legitimately both" case as item 3: these
  // files get browser ∪ node. Nine suites under src/ were reporting Node
  // globals as undefined at c35f9a5; this is config only — no test file is
  // touched.
  {
    files: ['**/*.{test,spec}.{js,jsx,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
