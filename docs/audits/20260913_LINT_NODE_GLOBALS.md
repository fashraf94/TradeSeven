# Lint: Node globals for `api/` and `scripts/`

**Date:** September 13, 2026
**Branch:** `claude/lint-node-globals`
**Base:** `origin/main` @ `c35f9a59` (`Merge pull request #842 from fashraf94/tournament/n1-mitigate-mon0845`)
**Scope:** `eslint.config.js` only — one file, +61 lines, 0 deletions. No production code, no test code, no fenced file, no manifest change.
**Mandate:** make the real lint signal visible. **Fix nothing.** Every finding below is recorded for separate tasking (BUILD_RULES §3).

---

## 1. Executive verdict

| # | Question | Answer |
|---|---|---|
| 1 | Did the noise go away? | **Yes.** `no-undef` **734 → 6**. Total errors **1,628 → 901** (−727, −44.7%). |
| 2 | Is what remains real? | **Yes.** All 6 remaining `no-undef` are genuine. Nothing Node-global remains. |
| 3 | Was `globals` already installed? | **Yes** — `globals@^16.4.0`, `package.json:60`. **No manifest change was needed or made.** |
| 4 | Does CI gate on lint? | **No.** Neither workflow runs lint. **The STOP condition did not trigger** — see §5. |
| 5 | Is the test suite affected? | **No.** Proven by three runs — see §6. |
| 6 | Does the build still pass? | **Yes.** `vite build` exit 0. |
| 7 | How many real bugs did this surface? | **7 groups, 3 of them high-severity** — see §7(a). |
| 8 | Anything the founder must decide? | **Yes, two things** — see §9. |

**The headline finding:** `src/App.jsx` renders four identifiers that are not in scope at the point of use (`xpForNextLevel`, `xpProgress`, `xpNeeded`, `nextRank`). That is a `ReferenceError` the moment the XP modal paints. It was sitting behind 728 lines of `process is not defined`.

---

## 2. Preamble (BUILD_RULES §2 / §3 compliance)

- **`git fetch origin` ran as the first git operation of this session** (§3). `origin/main` resolved to `c35f9a59`; the container's ref was already current, no phantom gap.
- **Branch:** cut fresh from `origin/main` at `c35f9a59`, clean tree, zero local commits ahead at cut time (§2, one task = one branch).
  - *Deviation noted for the record:* the harness pre-created and checked out its own session-default branch (`claude/dreamy-brahmagupta-9lfm3i`) rather than the branch this task names. The task prompt names `claude/lint-node-globals` explicitly and says "never the session default name", so that branch was created off `origin/main` at the same SHA. Nothing was committed to the session-default branch.
- **Working tree:** clean at cut, clean at report time apart from the one intended file.
- **Fenced files (§1):** none read for modification, none edited. `api/_utils/agentPromptAssembly.js` and `api/_utils/archetypeScoring.js` appear in findings below **as lint output only** — no line of either was changed, and no exported function was called.
- **Review threshold (§2):** 1 file / 61 lines. Below the ≥10 files OR ≥1500 lines trigger; no adversarial multi-lens review required. A `vite build` was run anyway.
- **Report also written outside the repo tree** (§3) and offered for download.

---

## 3. The diff

`eslint.config.js` — the existing browser entry is **untouched**. Two entries are appended.

```diff
--- a/eslint.config.js
+++ b/eslint.config.js
@@ -26,4 +26,65 @@ export default defineConfig([
        'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      },
    },
+
+  // ── Node globals: server + tooling surfaces ──────────────────────────────
+  //  (full rationale comment retained in the file)
+  {
+    files: [
+      'api/**/*.{js,jsx,mjs,cjs}',
+      'scripts/**/*.{js,jsx,mjs,cjs}',
+      'research/**/*.{js,jsx,mjs,cjs}',
+      'discovery/**/*.{js,mjs,cjs}',
+      'tracer/**/*.{js,mjs,cjs}',
+      'test/**/*.{js,mjs,cjs}',
+      '*.config.{js,mjs,cjs}',
+      'test-firebase.js',
+      'firestore.rules.emulator.test.js',
+    ],
+    languageOptions: {
+      globals: globals.node,
+    },
+  },
+
+  // ── Node globals: test files, wherever they live ─────────────────────────
+  {
+    files: ['**/*.{test,spec}.{js,jsx,mjs,cjs}'],
+    languageOptions: {
+      globals: globals.node,
+    },
+  },
 ])
```

### 3.1 Directories covered, and why

The task named `api/**` and `scripts/**` and asked for "any other server or tooling directory you find — list them".

| Path | Node? | `no-undef` at `c35f9a59` | Why included |
|---|---|---|---|
| `api/**` | yes | 474 | Vercel serverless functions + crons |
| `scripts/**` | yes | 174 | CLI tooling, run via `node` |
| `research/**` | yes | 52 | `research/level-study` — self-contained Node study, own runner (`node --test`) |
| `discovery/**` | yes | 0 (see §7c-1) | `.mjs` Node recon scripts |
| `tracer/**` | yes | 2 | Node-side trace pipeline |
| `test/**` | yes | 0 (see §7c-1) | Firestore rules suites (`.mjs`) |
| `*.config.{js,mjs,cjs}` (root) | yes | 1 | `eslint`, `postcss`, `tailwind`, `vite`, `vitest`, `vitest.eval`, `vitest.rules` |
| `test-firebase.js` (root) | yes | 11 | Root Node smoke script |
| `firestore.rules.emulator.test.js` (root) | yes | 1 | Root emulator suite |
| `**/*.{test,spec}.*` | yes | 13 under `src/` | vitest runs every suite in Node |

**There is no `functions/` directory in this repo** — checked, it does not exist. `dkb/`, `docs/`, `fixtures/` and `public/` contain **zero** `.js`/`.jsx` files and need no entry.

### 3.2 Files that are legitimately both — item 3

Flat config **unions** `languageOptions.globals` across every entry a file matches. It does not replace. So every file matched by the new entries **keeps the browser set and gains the Node set** — no enumeration is needed and no file had to be special-cased.

That resolves item 3 automatically. **23 `api/` modules are imported directly by `src/`** and are therefore genuinely dual-runtime; all 23 now carry browser ∪ node:

```
api/_utils/archetypeRegistry        api/_utils/masteryConfig
api/_utils/archetypeScoring         api/_utils/masteryEnforcement
api/_utils/archetypeVersionConstants  api/_utils/masteryFormula
api/_utils/axisDerivation           api/_utils/rankingConfig
api/_utils/behaviorFingerprint      api/_utils/seasonLeaderboard
api/_utils/canonicalHash            api/_utils/splitTickersByValidation
api/_utils/compositionEnforcement   api/_utils/tempoDialBands
api/_utils/fantasyTimesTickers      api/_utils/tempoDialClamp
api/_utils/leanRevalidation         api/_utils/tournamentLiveComposite
                                    api/_utils/tournamentTime
                                    api/_utils/tournamentUserScoring
                                    api/_utils/voiceLayerGrounding
                                    api/_utils/wireFlags
                                    api/cron/process-draft-claims
```

The **9 test suites under `src/`** that were reporting Node globals as undefined are the same case — jsdom needs `document`/`window`, the vitest runner supplies `process`/`__dirname`/`global`. They get both. **No test file was edited**; this is config only.

> `src/components/starfield.inert.test.jsx`, `src/hooks/useDeployTargetProgress.test.jsx`,
> `src/screens/__golden__/captureControllerOnGolden.test.jsx`, `src/screens/__golden__/captureFlagOffGolden.test.jsx`,
> `src/screens/leagueParticipantFraming.test.js`, `src/screens/trainingDraftRoomCopyParity.test.js`,
> `src/services/websocketService.test.js`, `src/theme/motion.guard.test.js`, `src/theme/tokens.guard.test.js`

**The cost, stated deliberately:** because the union runs both ways, a stray `document` or `window` inside `api/` will now *not* be flagged. Narrowing that means scoping the browser entry to `src/**`, which the task forbids ("do not change the browser entry"). It is listed as a tuning candidate in §7(c)-7.

---

## 4. Before / after

Both runs: `npx eslint .` at `c35f9a59`, 2,303 files linted in each. Machine-readable output diffed, not eyeballed.

### 4.1 Totals

| | Errors | Warnings | Files with issues | Files linted |
|---|---|---|---|---|
| **Before** | **1,628** | 119 | 641 | 2,303 |
| **After** | **901** | 119 | 451 | 2,303 |
| **Δ** | **−727 (−44.7%)** | 0 | −190 | 0 |

`filesLinted` is identical in both runs — the new globs added globals only, they did not pull new files into the lint set.

### 4.2 By rule

| Rule | Before (err) | After (err) | Δ | Warnings (both) |
|---|---:|---:|---:|---:|
| `no-unused-vars` | 775 | 775 | 0 | 0 |
| **`no-undef`** | **734** | **6** | **−728** | 0 |
| `react-refresh/only-export-components` | 60 | 60 | 0 | 0 |
| `react-hooks/rules-of-hooks` | 19 | 19 | 0 | 0 |
| `no-case-declarations` | 11 | 11 | 0 | 0 |
| `no-empty` | 6 | 6 | 0 | 0 |
| `no-misleading-character-class` | 5 | 5 | 0 | 0 |
| `no-unreachable` | 5 | 5 | 0 | 0 |
| `no-constant-binary-expression` | 5 | 5 | 0 | 0 |
| `no-useless-escape` | 3 | 3 | 0 | 0 |
| `(parse / fatal)` | 2 | 2 | 0 | 3 |
| `no-control-regex` | 1 | 1 | 0 | 0 |
| `no-irregular-whitespace` | 1 | 1 | 0 | 0 |
| `no-useless-catch` | 1 | 1 | 0 | 0 |
| **`no-redeclare`** | **0** | **1** | **+1** | 0 |
| `react-hooks/exhaustive-deps` | 0 | 0 | 0 | 116 |
| **Total** | **1,628** | **901** | **−727** | **119** |

**The arithmetic closes exactly:** −728 `no-undef` +1 `no-redeclare` = **−727**. Nothing else moved. That is the proof that this change did only what it claims.

### 4.3 The one new error — and it is a genuine find

`scripts/fetch-ticker-industries.js:51` now trips **`no-redeclare`**:

```js
/* global process -- Node script; eslint.config.js provides only browser globals */
```

Someone hit this exact bug before and hand-patched their own file. The directive is now redundant and should be deleted. It is the only such directive in the repo — verified by grep across all `.js`/`.jsx`/`.mjs`. Left in place per "fix nothing"; see §7(b)-8.

### 4.4 What the `no-undef` was, before

| Identifier | Count | Files |
|---|---:|---:|
| `process` | 691 | 214 |
| `Buffer` | 16 | 11 |
| `global` | 16 | 3 |
| `__dirname` | 4 | 4 |
| `require` | 3 | 3 |
| **Node-global subtotal** | **730** | |
| `xpForNextLevel`, `xpProgress`, `xpNeeded`, `nextRank` | 4 | 1 |
| **Total** | **734** | **226** |

**730 of 734 were one cause.** The prompt's "~1,615 `no-undef`" was the *total* error count (1,628 measured), not the `no-undef` count.

### 4.5 Top ten files, before → after

| Before | | After | |
|---:|---|---:|---|
| 133 | `src/App.jsx` | 133 | `src/App.jsx` |
| 17 | `scripts/test-signal-drop-pipeline.js` | 16 | `src/screens/DraftRoomScreen.jsx` |
| 16 | `src/screens/DraftRoomScreen.jsx` | 15 | `src/components/Forge/ForgeLanding.jsx` |
| 16 | `test-firebase.js` | 13 | `src/screens/EarningsGameScreen.jsx` |
| 15 | `api/scripts/capture-exa-search.js` | 8 | `src/screens/AgentBattleScreen.jsx` |
| 15 | `src/components/Forge/ForgeLanding.jsx` | 8 | `src/screens/DraftBattleScreenV2.jsx` |
| 13 | `api/scripts/capture-earnings-calendar-eodhd.js` | 7 | `api/ai-advisor.js` |
| 13 | `api/scripts/voice-grounding-harness.js` | 7 | `src/components/Forge/StarterKit.jsx` |
| 13 | `scripts/ingest-vera.js` | 6 | `api/_utils/archetypeRegistry.js` |
| 13 | `src/screens/EarningsGameScreen.jsx` | 6 | `api/cron/compute-rankings.js` |

Five `api/`+`scripts/` files drop off the list entirely. **`src/App.jsx` is unchanged at 133 and is now, unambiguously, the most defective file in the repo** — 14.8% of all remaining errors in one file.

### 4.6 Remaining errors by directory

| Directory | Errors after |
|---|---:|
| `src` | 757 |
| `api` | 127 |
| `research` | 7 |
| root files | 5 |
| `scripts` | 4 |
| `tracer` | 1 |

---

## 5. CI gate check — the prescribed STOP did NOT trigger

`.github/workflows/` holds exactly two files. **Neither runs `npm run lint`**; `eslint` appears nowhere in `.github/`.

| Workflow | Trigger | Runs |
|---|---|---|
| `main.yml` ("Keep Vercel Functions Warm") | `schedule` every 5 min, `workflow_dispatch` | three `curl` warm-up pings, each `continue-on-error: true` |
| `tests.yml` ("Tests") | `pull_request` → `main`, `workflow_dispatch` | `npm ci` then `npm run test:run -- --maxWorkers=2` |

The Vercel build is also clear: `vercel.json` sets `"framework": "vite"` with **no `buildCommand` override**, so the deploy runs `npm run build` = `vite build`. No lint.

**Conclusion: nothing in CI or the deploy path gates on lint, so surfacing these findings cannot turn any check red.** The STOP condition in the task ("if CI gates on lint and this change would turn CI red … STOP before pushing") is not met. Pushing is safe.

*(Separately worth the founder's attention: because lint is ungated everywhere, all 901 errors below have accumulated with no mechanism to stop the 902nd. Adding a lint job is a decision, not this task's to make — see §9.)*

---

## 6. Verification

### 6.1 Test suite — unaffected, and proven

Run unpiped, output redirected to a file (redirection is not a pipe, so `$?` is the command's own status), exit code asserted each time.

| # | Tree | Command | Exit | Test files | Tests |
|---|---|---|---:|---|---|
| 1 | with change | `npm run test:run -- --maxWorkers=2` | **1** | 655 passed, 3 skipped | 12,368 passed, 64 skipped, **0 failed** |
| 2 | `git checkout HEAD -- eslint.config.js` (pristine `c35f9a59`) | same | **0** | 655 passed, 3 skipped | 12,368 passed, 64 skipped |
| 3 | change restored | same | **0** | 655 passed, 3 skipped | 12,368 passed, 64 skipped |

**Runs 1 and 3 used byte-identical trees and produced different exit codes.** That is the definition of nondeterminism, and it settles the question: the change is not the cause.

The corroborating evidence:

- **All three runs report identical counts** — 655 / 3 / 12,368 / 64. The same tests ran and every one passed in all three. Run 1's exit 1 came from **2 unhandled errors, not test failures.**
- **The error is a teardown race.** `ReferenceError: window is not defined`, thrown from `setTimeout(() => setFlash(null), 300)` at `src/components/shared/AnimatedScore.jsx:55` — a 300 ms timer firing after jsdom was torn down, surfacing via `src/screens/AgentBattleScreen.showIt.jsdom.test.jsx`.
- **ESLint config is not on vitest's read path.** `vitest.config.js` merges `vite.config.js`; neither mentions eslint, and no lint plugin is installed. There is no mechanism by which this diff could reach the runner.

**This is a pre-existing latent flake in the repo, not a regression.** It is a real finding — it can red the `tests.yml` gate on any PR, at random. Recorded in §8 for separate tasking, not fixed here.

### 6.2 Build

`npx vite build` → **exit 0**, built in 21.32s. Only the pre-existing "chunks larger than 500 kB" advisory. `dist/` was removed afterwards; it is gitignored and the tree is clean.

---

## 7. The real findings — the deliverable

901 errors + 119 warnings remain. **None of them is a Node global.** Grouped as instructed. Every line/behaviour claim below was checked against the code in this session (VERIFIED); nothing is inherited.

### (a) Likely bugs — 7 groups, 3 high-severity

**A1 — HIGH · Four identifiers used out of scope in the XP modal · `src/App.jsx:10544, 10555, 10575, 10578`**

The only non-global `no-undef` in the repo, and it survived the cleanup because it is real.

```
App.jsx:10544:86  'xpForNextLevel' is not defined.
App.jsx:10555:40  'xpProgress' is not defined.
App.jsx:10575:18  'xpNeeded' is not defined.
App.jsx:10578:18  'nextRank' is not defined.
```

All four **are** declared — at `src/App.jsx:8736–8741`, as block-scoped `const`s inside `getScreenContent` (opens at `:8607`), under the comment `// XP calculation for modal`. They are consumed 1,800 lines away in a **sibling** scope, the app-level XP progress modal. ESLint's scope analysis is authoritative here: at the point of use they are not in the scope chain.

**Consequence:** a `ReferenceError` that unmounts the React tree the instant that modal renders. The declarations look like the author intended to hoist them and the modal was moved out from under them.

*Note: `src/App.jsx:12369` also has an empty block, and `src/App.jsx` carries 133 of the 901 remaining errors. This file wants its own task.*

---

**A2 — HIGH · `scripts/buildStockData.js` cannot run at all · `scripts/buildStockData.js:13`**

```js
const fs = require('fs');
```

`package.json` declares `"type": "module"` (`package.json:5`) and there is no `scripts/package.json` overriding it — verified, the only nested manifest in the repo is `research/level-study/package.json`. So this file is ESM and `require` does not exist in it.

**Executed to confirm** (the `require` is the first statement, so it throws before any I/O — nothing was written, tree verified clean afterwards):

```
ReferenceError: require is not defined in ES module scope, you can use import instead
    at file:///home/user/TradeSeven/scripts/buildStockData.js:13:12
exit=1
```

The file's own header says `Run: node buildStockData.js`. **That has not worked since the repo went ESM.** The script that generates `stockIntelligenceData.js` — `TICKERS`, `STOCK_DATA`, `getStockContext` — is dead. Fix is one line (`import fs from 'node:fs'`), but it is not this task's line, and someone should first establish whether the generated artifact is still current.

---

**A3 — HIGH · Top-performer selection silently mis-ranks on `NaN` · `src/components/draft/TopPerformersModal.jsx:43`**

```js
const assetScore    = asset.totalScore ?? (asset.gain * 10);
const existingScore = existing?.totalScore ?? (existing?.gain * 10) ?? -Infinity;
```

ESLint: *"Unexpected constant nullishness on the left-hand side of a `??` expression."*

When `existing.totalScore` and `existing.gain` are both absent, `(undefined * 10)` evaluates to **`NaN`** — and `NaN` is **not nullish**, so `?? -Infinity` never fires. `existingScore` becomes `NaN`, every comparison against it returns `false`, and the "asset with highest totalScore" is silently not selected. The `-Infinity` guard is unreachable code that reads like protection.

This is a **display-integrity** defect of exactly the family BUILD_RULES §9 was written for: the displayed top performer is derived through a path that can disagree with the data. Flagging it for a §9-aware task rather than a one-line patch.

---

**A4 — HIGH · 19 conditionally-called React hooks across 11 files · `react-hooks/rules-of-hooks`**

Hooks called after an early return or inside a branch. React's own crash class ("Rendered fewer hooks than expected") — order-dependent, so it survives testing and fails in production on a specific render path.

| File | Lines | Hook |
|---|---|---|
| `src/App.jsx` | 8299, 8300, 8301 | `useState` ×3 |
| `src/App.jsx` | 8305, 8376 | `useEffect` ×2 |
| `src/components/FantasyTimes/EditorialStory.jsx` | 530, 537, 552 | `useRef`, `useEffect` ×2 |
| `src/components/BaggerBomb/TacticalRow.jsx` | 179, 211 | `useMemo` ×2 |
| `src/components/Forge/CollectionDetailSheet.jsx` | 176, 188 | `useMemo` ×2 |
| `src/components/Agent/InlineTradingGradeCard.jsx` | 161 | `useEffect` |
| `src/components/DesktopBackground.jsx` | 14 | `React.useMemo` |
| `src/components/FantasyTimes/ReporterDesk.jsx` | 545 | `useMemo` |
| `src/components/StonkOptionsPosition.jsx` | 48 | `useMemo` |
| `src/components/draft/CompeteTab.jsx` | 506 | `useMemo` |
| `src/screens/DraftBattleScreenV2.jsx` | 1006 | `useMemo` |
| `src/screens/SnakeDraft/DraftCompleteScreen.jsx` | 468 | `useMemo` |

`TacticalRow.jsx` and `DraftBattleScreenV2.jsx` are named in the marketclash-components skill as **Snake Draft gold-standard reference** surfaces — worth prioritising.

---

**A5 — MEDIUM · Two files do not parse · `scripts/composition/cells_C5.js:4`, `cells_C7.js:3`**

```
Parsing error: Unexpected token :
```

Both are bare object-literal **fragments** — they open straight into `'ts-01': { … }` with no wrapper. Their siblings `cells_C1.js` and `cells_C6.js` wrap the same content in `const C1_RISK_CELLS = { … }` and parse fine. `scripts/composition/assemble.mjs:22–29` reads each fragment as **text**, writes a wrapped temp file, then imports it — so C5 and C7 work in the pipeline and only ESLint chokes.

Two defensible fixes: wrap them like C1/C6, or add them to `globalIgnores`. Either is a real decision about the assembler's contract, not a lint tweak. **Note these are the only 2 files in 2,303 that ESLint cannot read at all — they are invisible to every rule, permanently.**

---

**A6 — MEDIUM · `tailwind.config.js` is inert, and its `require` proves it · `tailwind.config.js:59`**

```js
plugins: [require("tailwindcss-animate")],
```

Same ESM/`require` class as A2 — yet `vite build` passes. Three independent checks say the file is **never applied to the build**:

1. `src/index.css:1–3` uses the **Tailwind v3** directives `@tailwind base/components/utilities`, while the installed toolchain is **v4** (`tailwindcss@^4.1.16`, `@tailwindcss/postcss@^4.1.16`). v4's entry is `@import "tailwindcss"`.
2. There is **no `@config` directive** in any CSS file — v4's mechanism for loading a JS config.
3. The built CSS contains **zero** `tailwindcss-animate` utilities (`accordion-down`, `animate-in`: 0 occurrences in `dist/assets/*.css`).

This independently corroborates BUILD_RULES §10's recorded observation that *"45 shadcn-style color utilities sit in live JSX emitting no CSS."* The cause is not only the empty `colors` key — **the whole config, plugin included, is not reaching the build.** That reframes the §10 Tailwind-wiring task (R-S10) and should be handed to it.

---

**A7 — LOW/MED · Emoji bullet filter matches the wrong things · `api/ai-advisor.js:613`**

```js
if (trimmed.match(/^[✅⚠️📊🎯💡🔹•\-\*]/) || …
```

Five errors on one line: *"Unexpected surrogate pair in character class. Use 'u' flag"* ×4 and *"Unexpected combined character in character class"* ×1.

Without the `u` flag the class is read as **individual UTF-16 code units**, so it does not match the emoji it lists and *does* match stray halves of unrelated emoji. This is the filter deciding which advisor lines survive into user-facing output — so it drops and keeps the wrong lines. Cosmetic blast radius, but genuinely not doing what the code says. (`no-useless-escape` on the same line, `\*`, is the same expression.)

### (b) Hygiene — 894 of the 901

**B1 · `no-unused-vars` — 775 errors across 409 files.** Classified by reading the source at each reported position:

| Kind | Count | Files | Note |
|---|---:|---:|---|
| Unused **imports** | 334 | 283 | Highest-value sweep — dead imports still cost bundle weight |
| Unused **locals** | 333 | 146 | Includes dead-code residue |
| Unused **params** | 75 | 60 | Mostly convention; see §7(c)-3 |
| **Caught errors** (`catch (e)`) | 33 | 23 | **Explicitly not bugs** per the task. Two are already named `_` |
| **Total** | **775** | **409** | |

By directory: `src` 643 · `api` 119 · `research` 6 · root 5 · `scripts` 1 · `tracer` 1.
Top files: `src/App.jsx` 104 · `DraftRoomScreen.jsx` 16 · `EarningsGameScreen.jsx` 13 · `AgentBattleScreen.jsx` 8 · `StarterKit.jsx` 7 · `DraftBattleScreenV2.jsx` 7 · `api/cron/compute-rankings.js` 6 · `WeeklyChallenges/index.jsx` 6 · `BaggerBombBattleView.jsx` 6 · `api/_utils/archetypeRegistry.js` 6.

**108 of the 775 (caught errors + params) would vanish on a rule-option change alone** — see §7(c)-3. The genuine backlog is closer to **667**.

**B2 · Deliberately disabled code reads as lint errors — 9 sites.** Not bugs; not accidents either. Someone turned features off in place:

- `no-unreachable` ×5, all `src/App.jsx` (`:3396, :4015, :4194, :4511, :4587`) — each an early `return;` at the top of a `useEffect` body, e.g. `return; // TEMPORARILY DISABLED — weekly challenges + slot machine` and `// TEMPORARILY DISABLED — mid-game challenge popup`.
- `{false && <Component />}` ×4 — `src/App.jsx:10421, 10422, 10423` (`MidGameChallengePopup`, `RiskChallengePopup`, `RiskChallengeResultPopup`) and `src/screens/BattleViewScreen.jsx:327` (`// ACTIVE RISK CHALLENGE INDICATOR — disabled, may re-enable later`).

**This is a product-state fact, not a lint fact:** four challenge/risk features and one indicator are switched off in the source. Worth a founder read before anyone "cleans up" the dead code — deleting it deletes the features.

**B3 · `react-refresh/only-export-components` — 60 errors, 29 files.** A Vite fast-refresh nicety (a module exporting both a component and a non-component loses HMR). No runtime impact. Candidate for `warn` — §7(c)-5.

**B4 · `no-case-declarations` — 11 errors, 2 files.** `src/App.jsx` ×10 (`:4236, 4251, 4267, 4276, 4277, 4278, 4369, 4370, 4407, 4415`), `src/services/researchAdvisor.js:147`. `let`/`const` in a `case` without braces — leaks across arms. Latent, not currently biting.

**B5 · `no-empty` — 6 errors, 5 files.** `src/App.jsx:12369`, `src/components/Forge/ForgeScreen.jsx:79` and `:85`, `src/components/Search/ExploreView.jsx:52`, `src/components/Search/SearchOverlay.jsx:42`, `src/components/draft/CommandDeckConfirmButton.jsx:38`. Empty blocks are usually silently-swallowed catches — **adjacent to the BUILD_RULES §5 prohibition on fire-and-forget writes.** Each should be read individually; if any sits on a catalog-event write path it escalates out of hygiene.

**B6 · `no-useless-catch` — 1.** `src/hooks/useCooldown.js:45` — a `try/catch` that only rethrows.

**B7 · Small stuff — 5.** `no-useless-escape` ×3 (`api/ai-advisor.js:613`, `api/stocks/analysis.js:222`, `src/utils/knowledgePackageParser.js:151`); `no-control-regex` ×1 (`api/_utils/agentPromptAssembly.js:318` — a **§1-fenced file**, reported only, not touched; the control chars look intentional in a sanitiser); `no-irregular-whitespace` ×1 (`research/level-study/lib/stats.js:14`).

**B8 · 3 unused `eslint-disable` directives** (reported as warnings): `api/cron/mandate-rollover.js:89` (`no-constant-condition`), `firestore.rules.emulator.test.js:150` (`no-console`), `src/hooks/useWebSocketPrices.js:73` (`react-hooks/exhaustive-deps`). Plus the now-redundant `/* global process */` at `scripts/fetch-ticker-industries.js:51` from §4.3. Directives that suppress nothing are worse than none — they read as "known issue" when the issue is gone.

**B9 · `react-hooks/exhaustive-deps` — 116 warnings, 40 files.** Currently non-blocking. The single biggest judgement call in the backlog: some are genuine stale-closure bugs, many are deliberate. Needs triage, not a sweep — §7(c)-6.

### (c) Rules that should probably be tuned for this codebase

**C1 — 26 `.mjs` files are collected by ESLint and matched by no rule at all.** The most consequential config finding here, and it is *not* fixed by this change.

ESLint 9 lints `.js`/`.mjs`/`.cjs` by default, but the only rule-bearing entry is scoped `files: ['**/*.{js,jsx}']` — which **does not match `.mjs`**. So all 26 `.mjs` files are read, matched against nothing, and reported clean. `discovery/peek.mjs` uses `process` and reported zero errors both before and after. Verified: **26 `.mjs` linted, 0 with any message, in both runs.**

Affected: all 9 of `discovery/*.mjs`, `research/level-study/tools/*.mjs`, all 6 of `test/rules/*.mjs`, `scripts/composition/assemble.mjs`, `scripts/composition/generate_*.mjs`, `api/scripts/archetype-integrity-eval/runEval.eval.mjs`, `vitest.eval.config.mjs`, `vitest.rules.config.mjs`.

Fix is one glob (`'**/*.{js,jsx,mjs,cjs}'` on the base entry) — deliberately **not** done here, because it would pull 26 unlinted files into the run and add an unknown error count, muddying the before/after this task exists to produce. **It should be its own task, with its own baseline.**

**C2 — `globals.node` masks 7 sites that the old config was right about.** `globals.node` includes the CommonJS wrapper vars — `require`, `module`, `exports`, `__dirname`, `__filename` — which **do not exist** in this `"type": "module"` package. Declaring them silences:

- `require`: `scripts/buildStockData.js:13` (**A2, proven broken**), `tailwind.config.js:59` (**A6, inert config**), `api/_utils/compositionRunbookGates.test.js:187`
- `__dirname`: `vite.config.js:10`, `src/hooks/useDeployTargetProgress.test.jsx`, `src/screens/leagueParticipantFraming.test.js`, `src/screens/trainingDraftRoomCopyParity.test.js`

The four `__dirname` uses work today because Vite bundles its config through esbuild and vitest's runner supplies CJS-ish wrapper vars. The two `require` sites in A2/A6 are real defects. The task prescribed `globals.node`, so `globals.node` is what shipped — **but `globals.nodeBuiltin` is the same set minus exactly these five CJS vars and is the correct choice for an ESM-only package.** Recommended follow-up; it would re-surface A2 and A6 permanently and cost 4 `__dirname` suppressions.

**C3 — `no-unused-vars` has `varsIgnorePattern` but no `argsIgnorePattern` or `caughtErrorsIgnorePattern`.** Current: `['error', { varsIgnorePattern: '^[A-Z_]' }]`. Adding `argsIgnorePattern: '^_'` and `caughtErrorsIgnorePattern: '^_'` would let the codebase mark intent explicitly and would take **108 of 775** out of the noise — including the 33 caught errors the task names as not-bugs. Two of them are already written `_` and still error.

**C4 — `scripts/composition/cells_*.js` fragments need a `globalIgnores` entry** (or the C1/C6 wrapper) — A5.

**C5 — `react-refresh/only-export-components` at `error` is arguably miscalibrated** — 60 errors for a DX-only concern. `warn` would drop remaining *errors* 901 → 841 without losing the signal.

**C6 — decide `react-hooks/exhaustive-deps`' status.** 116 warnings, invisible in an ungated-lint repo. Either triage them to error or accept them explicitly.

**C7 — the browser entry could be scoped to `src/**`.** Today it applies browser globals to every file including `api/`, so a stray `document` in a serverless function is not flagged. The task forbade touching that entry, correctly — it is a deliberate change with its own blast radius (the 23 dual-runtime modules in §3.2 would need explicit handling). Listed for completeness.

**C8 — `ecmaVersion: 2020` in `languageOptions`** while `parserOptions.ecmaVersion` is `'latest'`. Parsing is unaffected; only the built-in globals set is pinned to 2020. Minor, but it is an inconsistency someone will trip over.

---

## 8. Found outside the task — recorded, not fixed (BUILD_RULES §3)

**F1 · The unit suite has a nondeterministic failure that can red the `tests.yml` gate at random.** Observed once in three full runs during §6.1 verification, on a tree that passed the other two times.

```
ReferenceError: window is not defined
  ❯ Timeout._onTimeout src/components/shared/AnimatedScore.jsx:55:26
  This error originated in "src/screens/AgentBattleScreen.showIt.jsdom.test.jsx"
```

`AnimatedScore.jsx:55` schedules `setTimeout(() => setFlash(null), 300)`; when the suite tears jsdom down inside that window, the callback reaches a dead `window` and vitest reports an **unhandled error** — which fails the run (exit 1) even with 12,368 tests passing and zero failures. Observed once in three runs at `--maxWorkers=2`, the exact flag CI uses — too few samples to state a rate, but enough to establish it is not deterministic.

Because `tests.yml` is the repo's **only** merge gate, this can red an unrelated PR and cost a cycle. Likely fixes: clear the timer on unmount in `AnimatedScore.jsx`, or `vi.useFakeTimers()` in the suite. **Not touched — that is test/production code and outside this task.**

**F2 · The `stockIntelligenceData.js` generator has been dead since the ESM migration** — A2. Worth checking whether the committed artifact is stale before repairing the generator.

**F3 · The Tailwind pipeline is not wired** — A6. Materially changes the §10 R-S10 Tailwind-wiring task's premise.

---

## 9. Founder decisions

Neither blocks this push.

**D1 · Should lint be gated in CI?** Right now nothing stops error 902. The honest sequencing is: land the group-(a) bugs and the (c) tuning first, then gate — gating at 901 would just mean `continue-on-error`, which is not a gate. A cheap interim: gate on `no-undef` and `react-hooks/rules-of-hooks` only (25 errors), which are the two rules that catch crashes.

**D2 · `globals.node` → `globals.nodeBuiltin`?** §7(c)-2. It re-surfaces two real bugs permanently and costs four `__dirname` suppressions. The task prescribed `globals.node` and that is what shipped; this is the founder's call, not a mid-task substitution.

---

## 10. What this task did not do

- **Fixed nothing.** Not one finding above was acted on. `git diff` is one file.
- **No manifest change** — `globals@^16.4.0` was already a devDependency (`package.json:60`); `package.json` and `package-lock.json` are untouched.
- **No production code, no test code, no fenced file.** Two fenced files appear in findings as lint output only (`api/_utils/agentPromptAssembly.js:318`, and `api/_utils/archetypeScoring.js` among the 23 dual-runtime modules); neither was edited and no exported function was called.
- **Did not fix the `.mjs` blind spot (C1)** — deliberately, to keep this before/after clean.
- **Did not touch the browser entry for `src/`.**
- **No PR, no merge, no CI watching.** Delivery ends at pushed (BUILD_RULES §2).

Each group in §7 is sized to become its own task. Suggested order by value: **A1 → A3 → A4 → A2 → C1 → C3 → B1(imports) → A6/§10 hand-off.**
