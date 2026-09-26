# Flip report: `CALL_RECORDS_MODE` from `'off'` to `'shadow'`

**Date:** 2026-09-26 · **Builder:** Claude Code · **Branch:** `claude/flip-call-records-shadow` · **PR:** [fashraf94/TradeSeven#913](https://github.com/fashraf94/TradeSeven/pull/913)
**Commits:** `64ecd8551defdc8fbce17926618b2da60dbe2d5f` (the flip and its pin row) · `a59fa85b73a7e38754af60f1cf8cf8dbe5fcf673` (the docstring label, added on #913) · this report is added by the commit after them.

**Session preamble (BUILD_RULES §2, §3).**
- `git fetch origin` ran first (exit 0).
- The branch was cut with `git checkout -b claude/flip-call-records-shadow origin/main`. At the start, HEAD = `origin/main` = `9f39875d7691ba3626d485a87ce95e082bbe93e7` (Merge PR #912), and the tree was clean (0 `git status --porcelain` lines).
- `git fetch --unshallow origin` also ran. It is read-only and permitted by §3. It was needed to read the precedent string-flag flip, `454c9240`.
- `npm ci` ran (exit 0) because `node_modules` was missing. No tracked file changed.
- **Follow-up on #913, same session:**
  - `git fetch origin` ran first (exit 0).
  - The branch was at `64ecd855`, equal to its remote, with a clean tree.
  - `origin/main` was still `9f39875d`.

## Executive verdict

| Question | Answer |
|---|---|
| **What changed?** | **Two source files.** `64ecd855` is the flip: the switch value moved to `'shadow'` at `src/config/featureFlags.js:2826`, and its pin row moved in the **same commit** at `src/config/callRecordsFlags.test.js:44` (row title) and `:47` (the value). `a59fa85b` moves the docstring's "(shipped)" label from `'off'` (`featureFlags.js:2789`) to `'shadow'` (`:2798`), as you asked on #913. It changes a comment only. This report is added as `docs/audits/20260926_FLIP_CALL_RECORDS_MODE_SHADOW.md`. |
| **Do the seven suites that pin the switch pass at shadow?** | **Yes.** 7 of 7 files and 45 of 45 tests pass, exit 0. |
| **Full suite** | **Passes** on the final code tree (`a59fa85b`): 802 files and 15,929 tests pass (3 files and 64 tests skipped), exit 0. These are the same counts as the run at `64ecd855`. |
| **Lint gate** (`npm run lint:gate`) | **Passes** on `a59fa85b`: 0 problems at `--max-warnings 0`, exit 0. |
| **Fence (BUILD_RULES §1)** | **Not touched.** No fenced file was edited and no fenced function was called. None of the changed files is on the §1 list. |
| **Does pushing change anything live?** | **No.** Pushed ≠ deployed. **Merging does**: from the next evaluation check, the AI may declare calls and the records are written, but nothing is shown to players. |
| **Anything needed from you before you merge?** | **Yes, two items, see §4.** (1) The `calls` index must be *Enabled* and `firestore.rules` published. Both are done in the Firebase console, so this session cannot check them. (2) The Build 0 report asks Astra to confirm the AI-visible declarations text (C2), and the repo has no record that this happened. |

## 1. The change (`file:line`, at `a59fa85b`)

| File:line | Commit | Before | After |
|---|---|---|---|
| `src/config/featureFlags.js:2826` | `64ecd855` | `export const CALL_RECORDS_MODE = 'off';` | `export const CALL_RECORDS_MODE = 'shadow';` |
| `src/config/callRecordsFlags.test.js:47` | `64ecd855` | `expect(CALL_RECORDS_MODE).toBe('off');` | `expect(CALL_RECORDS_MODE).toBe('shadow');` |
| `src/config/callRecordsFlags.test.js:44` | `64ecd855` | `it("walk step 0: 'off' — no schema property, no reserve, no record read or written", …` | `it("walk step 1: 'shadow' — declarations and calls minted, states flipped, nothing rendered", …` |
| `src/config/featureFlags.js:2789` | `a59fa85b` | `'off'    (shipped) — no \`declarations\` property …` | `'off'    no \`declarations\` property …` |
| `src/config/featureFlags.js:2798` | `a59fa85b` | `'shadow' the model may declare; …` | `'shadow' (shipped) — the model may declare; …` |

**The one judgment call: the row title at `:44`.**
- The pin is the whole `it(…)` row. The file's own header (`:17-18`) says each walk step "moves the first row below in the same commit".
- Left alone, the title would print "walk step 0: 'off' — no schema property, no reserve, no record read or written" over a test that asserts `'shadow'`, where all three of those things now happen. BUILD_RULES §2 requires a flip to move text that pins the pre-flip state.
- The precedent flip of a string switch, `VOICE_GROUNDING_MODE` in `454c9240`, moved its row titles the same way.
- The new title uses the contract's own words for shadow (`docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:107`).
- The title has no effect on whether the test passes. You kept it on #913.

**Not needed:**
- `flagPinGuard` / `DARK_BY_DESIGN`: a string switch cannot be a `DARK_BY_DESIGN` key. The pin file asserts this (`callRecordsFlags.test.js:66-68`), and that row still passes.
- The docstring runway text (`featureFlags.js:2807-2818`): it still reads true after the flip.

## 2. The seven suites that pin the switch

**Citation note:** the prompt cites build report §8 **B-2**, but in `docs/audits/20260924_BUILD0_CALL_RECORDS.md` §8, B-2 is a different finding: "six `await callsStepAsync` at off each cost one microtask turn" (`:386`). The seven suites are §8 row **C-1** (`:389`), and they were pinned by commit `e87694a0` ("pin CALL_RECORDS_MODE off in the seven exact-key cron suites"). The list below is taken from that commit's file list.

Each suite sets its own `CALL_RECORDS_MODE: 'off'` in its mock, so it does not depend on the live switch value. This is the review C-1 fix: without those pins, 17 tests in these 7 suites went red at shadow.

| Suite | Tests at shadow |
|---|---|
| `api/cron/agent-evaluate.tickStamps.flagOn.test.js` | 16 ✓ |
| `api/cron/agent-evaluate.timing.test.js` | 12 ✓ |
| `api/cron/agent-evaluate.intradayViews.test.js` | 8 ✓ |
| `api/cron/agent-evaluate.tickStamps.flagOff.test.js` | 4 ✓ |
| `api/cron/agent-evaluate.tickStamps.gates.test.js` | 3 ✓ |
| `api/cron/agent-evaluate.intradayViews.flagOff.test.js` | 1 ✓ |
| `api/cron/agent-evaluate.tickStamps.modeNotEnforce.test.js` | 1 ✓ |
| **Total** | **7 files, 45 tests, exit 0** |

## 3. Verification runs

Every command below ran in this session. Output was **redirected to a file, never piped**, so each exit code is the command's own, and each exit code was asserted with `test $rc -eq 0`.

| Check | Tree | Command | Result |
|---|---|---|---|
| The seven suites | `64ecd855` | `npx vitest run <the 7 files>` | **7 files, 45 tests passed; exit 0** |
| The pin and the call-records suites | `64ecd855` | `npx vitest run src/config/callRecordsFlags.test.js src/config/flagPinGuard.test.js api/_utils/callRecords/ api/cron/agent-evaluate.tickStamps.callsOn.test.js api/cron/agent-evaluate.callRecords.offGolden.test.js api/_utils/composition.m7e2eBudget.test.js` | **13 files, 353 tests passed; exit 0** |
| Full suite | `64ecd855` | `npx vitest run` | **802 files passed (3 skipped); 15,929 tests passed (64 skipped); exit 0.** Duration 218.8 s. No failed file. |
| Lint gate | `64ecd855` | `npm run lint:gate` | **exit 0**, no output. Run after the suite finished so it could not skew timing-sensitive rows. |
| **Full suite, final code tree** | `a59fa85b` | `npx vitest run` | **802 files passed (3 skipped); 15,929 tests passed (64 skipped); exit 0.** Duration 200.2 s. No failed file. |
| **Lint gate, final code tree** | `a59fa85b` | `npm run lint:gate` | **exit 0**, no output. Run after the suite finished. |
| Fence | `a59fa85b` | `git diff origin/main --name-only` ∩ BUILD_RULES §1 | **∅** |

The report file cannot change a test result. No test lists `docs/audits/`; the tests that mention it only cite audit files by name in strings and comments.

## 4. Before you merge: the Build 0 report's pre-shadow list, checked against the repo

The Build 0 report lists what should be settled before this flip (§10 step 4, and §14.6 "Still open before shadow"). Some items are closed in the repo; others can't be checked from here.

| Item | Status | Evidence |
|---|---|---|
| A-1 ruling (a battle with no watchlist labels its calls "agent initiative") | **Closed** | Report §12, commit `b0105b0f` |
| E-3 ruling (a `next_check` call is judged once, by its next check) | **Closed** | Report §12, commit `a78bbfb3` |
| C-5: real `countTokens` measurement with declarations on | **Closed** | `docs/audits/20260925_EVAL_REQUEST_TOKEN_MEASUREMENT.md`: 11,851 of the 12,000-token input budget (margin 149). The output ceiling was raised to 3,072 (`api/_utils/agentEvalTransport.js:64`). The budget test passes at shadow (§3). |
| Astra confirms the exact C2 declarations text, which the AI sees (C-4; §14.6 item 1) | **No record in the repo** | Your call. This flip is what makes that text visible to the AI. |
| `firestore.rules` published, and the `calls` composite index shown *Enabled* (§10 steps 2–3) | **Can't be checked from this session** (Firebase console) | The docstring runway (`featureFlags.js:2807-2809`) makes the deployed index a precondition. If the index is missing, the flip scan logs `[calls] flip index MISSING …` and skips flips for 10 minutes instead of failing checks (report §10 step 6). |
| Pilot handoff carries the V1.4 hash (§14.6 item 5) | **Outside this repo** | — |

## 5. The docstring label (changed on #913)

- **Before:** `src/config/featureFlags.js:2789` labelled `'off'` "(shipped)".
- **After:** at your instruction on #913, per BUILD_RULES §2, the label is on `'shadow'` (`:2798`). This is `a59fa85b`, comment only.
- **Why a second commit:** the flip commit `64ecd855` was already pushed, so the label moves in a second commit on the same PR rather than by rewriting it (no force-push).
- **Effect on `main`:** whichever way you merge, the tip of `main` never carries the stale label. With a merge commit, `64ecd855` stays in history with the old label, and no test reads it.
- **Nothing else calls `'off'` the default:**
  - No other docstring calls `'off'` the shipped or default value. The call-records sources were checked: `api/cron/agent-evaluate.js`, `api/_utils/callRecords/*.js`, `agentEvalToolSchema.js` and `agentEvalTransport.js`. Their comments describe what each state does (for example `agent-evaluate.js:40-42`, `mode.js:6-10`) and do not name a live value.
  - The pin file's header line "'off' ships with Build 0" (`callRecordsFlags.test.js:13`) describes Build 0's release. It is still true, so it is left as is.
- **One wording flagged for your call, not changed** (outside this round's scope):
  - `api/_utils/agentEvalTransport.js:173` says the off reserve leaves the requirement at "44,000 ms, today's number exactly".
  - It means the pre-build figure and is not a default label. After the flip, though, "today" reads as the live state, which is 48,000 ms at shadow (`:172`).

## 6. Rollback

"A rollback is the same line back to 'off'" (`featureFlags.js:2817-2818`). It goes together with the pin row (and now the "(shipped)" label), in one commit. At `'off'`, existing records are neither read nor written. The Build 0 report §10 proposes rollback triggers against the five sessions before the flip:
- the model timeout rate up by 2 points or more;
- `truncated_response` + `invalid_tool_result` up by 1 point or more;
- p95 `callMs` up by 2,000 ms or more;
- the SWAP share, or anticipation candidates per check, moving by more than 25 %.
