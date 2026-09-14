# Build — Eval transport hygiene (timer after `promptBuilt` · call timing on the record · timeout kind)

**Fence (BUILD_RULES §1, re-read at HEAD `fcace00d`):** `api/cron/agent-evaluate.js` and `api/_utils/agentEvalTransport.js` are **OUTSIDE the calibration fence** — neither appears in the §1 list (`decide.js`, `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentBattleService.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `agentGuardrails.js`, `archetypeScoring.js`, `tournamentUserScoring.js`). `api/_utils/agentEvalPromptAssembly.js` **is** fenced and was **not edited** — it is imported and called by the cron exactly as before, and doubled (never edited) in one test file, the pattern `agent-evaluate.tickStamps.gates.test.js` already uses.

---

## 0. Executive verdict

| | |
|---|---|
| **What changed** | When the decider's Haiku call starts, how long it gets, and what the record says about it. Nothing else. |
| **Defect fixed** | Since June 11 the 22 s abort backstop was armed **before** prompt assembly, so the call's real ceiling was `22 s − build`. A 21.5 s build left it **500 ms** — measured, not inferred (§4.1 evidence below). |
| **New failure mode, honestly named** | A prompt build over 10 s now ends the check as `build_timeout` instead of as an aborted call. **With a consequence §2's wording understates**: in the band 10 s–(22 s − model latency) the pre-change code made the call and got a real decision, and now no call is made at all. Prescribed by §2.2, quantified in §7 (D1), structurally unreachable for non-institutional agents. |
| **Invariant** | **HOLDS on the prompt half, byte-exactly and executably** (§7). The "only when the call starts and how long it gets change" half is **too narrow** — see the row above. The decision path, swaps, tick stamps and narrator are untouched. |
| **Fence** | **CLEAN.** No fenced file edited. No `src/config/featureFlags.js` change. No `DARK_BY_DESIGN` entry. |
| **Adversarial review (§2)** | **RUN** — 4 isolated lenses, 26 findings, 29 mutations. **One real defect in what I built, found and fixed** (`timeoutKind` could claim a transport timeout on a call that never happened). 7 test gaps closed. 8 CONFIRMED-but-out-of-scope findings recorded, 2 of them major. §7. |
| **Suite** | `npm run test:run` → **exit 0**, 656 files / **12 384** tests passed, 3 files / 64 tests skipped. |
| **Lint (touched files)** | 5 errors before, **5 after**. Did not rise. Both new files add 0. |
| **`vite build`** | exit 0 (required by §2 at the review threshold). |
| **§5 threshold** | **CROSSED — read §8.** 12 files / **1 077** lines in the build diff; 14 files / **1 748** lines cumulative on the branch. |

---

## 1. Session preamble

| | |
|---|---|
| `git fetch origin` | run first (BUILD_RULES §3), before any remote comparison. |
| Branch | `claude/eval-transport-hygiene`, cut from `origin/main`. |
| HEAD at cut | `fcace00d4d572b8778ca218f51c96fa913c72045` (`origin/main` was at the same SHA). |
| Tree at cut | clean. |
| First commit | `270c1c61` — `git cherry-pick 98d9bde5`, Friday's Phase 0 report + census script, verbatim. |
| Build commit | `d775537f`. |
| Phase 0 read | `docs/audits/20260911_PHASE0_EVAL_TIMEOUTS_VWAPDEV.md` §3 in full. Its line numbers are stated at `fcace00d`, which **is** this HEAD; every cited site was nonetheless re-read in this session before editing, and all matched. |
| `npm ci` | the container had no `node_modules`; installed before any test run. |

### `git diff --stat`

Build diff against the cherry-picked Phase 0 commit — **12 files, 1 004 insertions, 73 deletions** (the build commit `d775537f` plus the review-fix commit; §7):

```
 api/_utils/__fixtures__/tickStampsHarness.js       |  22 +-
 api/_utils/agentEvalTransport.js                   |  95 +++++-
 api/_utils/agentEvalTransport.test.js              | 134 ++++++-
 api/cron/agent-evaluate.js                         | 198 ++++++++--
 api/cron/agent-evaluate.tickStamps.flagOff.test.js |  41 ++-
 api/cron/agent-evaluate.tickStamps.flagOn.test.js  |  16 +-
 api/cron/agent-evaluate.tickStamps.gates.test.js   |   6 +-
 ...gent-evaluate.tickStamps.modeNotEnforce.test.js |   4 +-
 api/cron/agent-evaluate.tickStamps.pins.test.js    |  64 +++-
 api/cron/agent-evaluate.timing.test.js             | 440 +++++++++++++++++++++
 src/data/decisionRecord.test.js                    |   9 +-
 src/screens/battleView/WhyPanel.render.test.jsx    |  48 +++
 12 files changed, 1004 insertions(+), 73 deletions(-)
```

Cumulative branch diff against `origin/main` adds the two cherry-picked Phase 0 files (`docs/audits/20260911_…md` +263, `scripts/phase0-eval-timeouts-readonly.js` +408) plus this record — **14 files, 1 675 insertions, 73 deletions**.

**Assertion required by §5:** `git diff --stat` shows **no `src/config/featureFlags.js`**, **no `DARK_BY_DESIGN`** (0 occurrences anywhere in the diff text), and **no fenced file**. `api/_utils/__fixtures__/promptHonestyRegistry.js` is likewise unchanged, so the §1 flag-split prose rule is not engaged.

---

## 2. The changes, with `file:line` after the edit

### 2.1 Arm the abort after the prompt is built

`api/cron/agent-evaluate.js`

| What | Line |
|---|---|
| `let buildTimer = null;` / `let hardAbort = null;` — **declared before the `try`**, so the `finally` is safe when the build fails before either timer is armed | `:2009`, `:2010` |
| `const buildStartedAt = Date.now();` | `:2011` |
| `promptBuilt = true;` | `:2054` |
| `const abortCtrl = new AbortController();` | `:2072` |
| `hardAbort = setTimeout(() => abortCtrl.abort(), HAIKU_CALL_CEILING_MS);` — **immediately after `promptBuilt = true`, immediately before `messages.create`** | `:2073` |
| `await anthropic.messages.create({ … }, { timeout: 20_000, signal: abortCtrl.signal })` — SDK timeout and `maxRetries: 0` **unchanged** | `:2077-2089` |
| `finally { clearTimeout(buildTimer); clearTimeout(hardAbort); }` | `:2139-2147` |

The SDK timeout and the backstop now start from the same instant, so the backstop is a true backstop.

### 2.2 Bound the build on its own

`api/_utils/agentEvalTransport.js`

| What | Line |
|---|---|
| `export const PROMPT_BUILD_CEILING_MS = 10_000;` beside `HAIKU_CALL_CEILING_MS` (`:14`), with the prescribed comment — typical build sub-second, institutional agents add sequential Firestore batches, **revisit once `buildMs` has a week of data** | `:33` |
| `export const PROMPT_BUILD_TIMEOUT_ERROR_NAME = 'PromptBuildTimeoutError';` | `:37` |

`api/cron/agent-evaluate.js`

| What | Line |
|---|---|
| `const buildPrompt = async () => { … }` — the three builders, same order, same argument lists, verbatim | `:2034-2042` |
| `const built = await Promise.race([ buildPrompt().finally(() => { clearTimeout(buildTimer); }), … ])` — **a race, no AbortController**: a Firestore read is unbilled and an orphaned one is harmless (the June EODHD-GET precedent). The winner clears the race timer in its own `finally` — no dangling timer | `:2043-2052` |
| `buildTimer = setTimeout(() => { … err.name = PROMPT_BUILD_TIMEOUT_ERROR_NAME; reject(err); }, PROMPT_BUILD_CEILING_MS)` | `:2046-2050` |
| `if (buildMs === null) buildMs = Date.now() - buildStartedAt;` in the catch | `:2127` |

On the rejection: **no call is made**; `promptBuilt` stays `false` (so no stamps — the rule is unchanged); `haikuFailure = { failureClass: 'build_timeout', message, timestamp, timeoutKind: null }` + `evalId` at the entry; the tick continues exactly as a transport failure does today — entry written, `eval_degraded` beat, shadow record; `consecutiveEvalFailures` increments (the existing `haikuResult ? 'success' : (class === 'budget_skipped' ? … : 'failure')` resolution at `:2948-2950` already does this — a build timeout is the eval path failing, not scheduling). A builder that throws for any other reason keeps today's behaviour.

### 2.3 The pre-call guard's arithmetic

`api/_utils/agentEvalTransport.js:164-174`

```js
export function shouldStartHaikuCall({
  elapsedMs, timeBudgetMs,
  promptBuildCeilingMs = PROMPT_BUILD_CEILING_MS,   // :167
  callCeilingMs = HAIKU_CALL_CEILING_MS,
  postCallAllowanceMs = HAIKU_POST_CALL_ALLOWANCE_MS,
}) {
  const remainingMs = timeBudgetMs - elapsedMs;
  const requiredMs = promptBuildCeilingMs + callCeilingMs + postCallAllowanceMs;  // :172
  ...
}
```

10 + 22 + 12 = **44 s**, the sum of three named constants, never a literal. The guard still runs **once, before the build** (`agent-evaluate.js:1995`); `budget_skipped` semantics are unchanged.

### 2.4 Timing on the entry — additive

`api/cron/agent-evaluate.js:2784-2786`, in the `const evaluation = {…}` literal (`:2738`), immediately after `haikuError`:

```js
promptBuiltAt,   // ISO string, or null (the prompt was never finished)
buildMs,         // integer around the whole build, or null (the build never ran)
callMs,          // messages.create start → return or throw, or null (no call)
```

Declared beside `promptBuilt` at `:1979-1981`. `Date.now()` pairs, nothing fancier. `callMs` is taken in a `finally` around the `create` call alone (`:2092`), so "return or throw" is literal. On a build timeout `buildMs` is the measured elapsed at the ceiling (≥ 10 000), not a hard-coded constant — honest about scheduling lag, and `≥ ceiling` is what §4.2 asserts.

`buildMs` and `callMs` also ride the shadow record (`:2903-2904`).

**These fields do not reach the prompt.** `formatRecentEvals` reads a fixed eight-key whitelist (`agentEvalPromptAssembly.js:1389-1402`), pinned in `agent-evaluate.tickStamps.pins.test.js` — extended in this commit to cover the new keys (§4.5).

### 2.5 Timeout kind

`api/_utils/agentEvalTransport.js`

| What | Line |
|---|---|
| `classifyHaikuFailure` — one new branch, **checked first**: `PromptBuildTimeoutError` → `'build_timeout'` | `:80-84` |
| `classifyHaikuFailure` still returns `'timeout'` for **both** transport timeouts — every consumer of the class is unchanged | `:86-94` |
| `export function classifyTimeoutKind(err)` → `'sdk'` \| `'backstop'` \| `null`, keyed on `constructor.name` per the June SDK quirk recorded in the module header | `:120-143` |

Written to `haikuError.timeoutKind` at `agent-evaluate.js:2136` (the catch, gated on `callMs` — see §7), and as an explicit `null` at the other two `haikuFailure` sites (`:2001` `budget_skipped`, `:2111` `truncated_response`) so `haikuError` has one shape.

`'build_timeout'` is a new class value. The reader enumeration is §3.

### 2.6 Shadow record join fields

`api/cron/agent-evaluate.js:2882-2883` — `evalId` and `timestamp: evaluation.timestamp` on the `logEvaluation` payload, so it joins to its entry **by value** rather than by array order (the forensics gap Phase 0 hit). Additive.

---

## 3. Every reader of `failureClass` — `file:line`

`'build_timeout'` is a new class value. Every site that reads `failureClass` (or `haikuError` at all) was enumerated by grep over `api/`, `src/` and `scripts/` and read at its line. **No reader switches exhaustively**, so an unknown class falls to the existing generic state everywhere — never a blank, never a crash, never a fabricated state. No new copy was needed in `battleViewCopy.js`, and none was added.

### Server

| `file:line` | What it does with the class | Verdict for `'build_timeout'` |
|---|---|---|
|  `api/cron/agent-evaluate.js:2747-2751` | picks the entry's fallback `rationale`: `=== 'budget_skipped'` → the skip sentence, else `'Haiku call failed — defaulting to HOLD'` | falls to the generic failure sentence — correct (the engine did fail) |
|  `api/cron/agent-evaluate.js:2860-2861` | `eval_degraded` statusFeed beat, interpolates the class into the message | `…degraded this tick (build_timeout)…` — a system feed line, not player copy |
|  `api/cron/agent-evaluate.js:2900` | shadow log `failureClass: haikuFailure?.failureClass \|\| null` | passthrough |
|  `api/cron/agent-evaluate.js:2961-2962` | `cronErrors[]` — `error: \`haiku_eval ${class}: ${message}\``, plus `failureClass` | passthrough, capped at 20 |
|  `api/cron/agent-evaluate.js:2948-2950` | `nextConsecutiveEvalFailures(prev, haikuResult ? 'success' : (class === 'budget_skipped' ? 'budget_skipped' : 'failure'))` | **increments the streak** — which is the intent: a build timeout is the eval path failing, not scheduling |
| `api/_utils/shadowAssemblyCapture.js:303` | `resolveTerminalGate` → `` terminalGate: `transport_${class}` `` | `transport_build_timeout`; string interpolation, no enumeration downstream |
| `api/_utils/voiceLayerGrounding.js:237,247` | presence check, then `noDecisionLine(evaluation.haikuError)` (imported from the zero-import `src/data/decisionRecord.js:87` — the §4 `api/` → `src/` import, guarded) | generic absence line |
| `scripts/phase0-eval-timeouts-readonly.js:152,168,214,273` | read-only census; buckets anything outside `success / timeout / budget_skipped / truncated_response` under **"other"** | counted under "other" — no crash, and the column already exists |

### Client

| `file:line` | What it does with the class | Verdict for `'build_timeout'` |
|---|---|---|
| `src/data/decisionRecord.js:80-81` | `noDecisionLine`: `=== 'timeout' ? NO_DECISION_OUTAGE : NO_DECISION_INCOMPLETE` | **generic line** — "No decision recorded at this check · the evaluation did not complete" |
| `src/screens/battleView/selectWhyState.js:145-151` | the Why? panel's absence arm: `const timedOut = …failureClass === 'timeout'`, then `COPY.noDecisionOutage : COPY.noDecisionIncomplete` | **generic line** — this is the site §4.6's mounted row exercises, and the site the mutation check confirms is live |
| `src/screens/battleView/battleViewCopy.js:263-276` | holds the three absence strings; keys on nothing | unchanged — no new copy, so no copy guard to pass |
| `src/screens/battleView/buildTape.js:274` | `const quiet = decision === 'HOLD' && downgraded !== true && !evaluation.haikuError` | **presence only, class-agnostic** — a `build_timeout` check is not "quiet", same as any other outage |
| `src/screens/battleView/selectBench.js:83` | comment only; the scan-back skips outage entries by presence, not class | class-agnostic |

**One thing found while checking, reported not fixed (BUILD_RULES §3).** `noDecisionLine` (`src/data/decisionRecord.js:80`) and `selectWhyState.js:146` are two copies of the same rule against the same field. They agree today, and both were mutation-checked in this session, but the Why? panel does **not** call `noDecisionLine` — mutating `decisionRecord.js` alone leaves `WhyPanel.render.test.jsx` fully green (verified: 64/64 passed under the mutant). The server narrator (`voiceLayerGrounding.js:247`) is the only caller. That is the display-agreement shape BUILD_RULES §9 exists to forbid, and it is outside this task. **Separate tasking.**


---

## 4. The tests, each shown failing under its defect

Every guard below was shown RED under the defect it names. For §4.1 and §4.2 the demonstration is the one the prompt requires: the new file was run against the **pre-change cron** (`git stash push -- api/cron/agent-evaluate.js`, run, `git stash pop` — the transport module and the tests stayed as built), and the failure output is pasted verbatim. For the rest, the defect was introduced as a **mutation** into production source and the suite re-run.

### 4.1 Timer placement — `api/cron/agent-evaluate.timing.test.js:202-255`

The seam is the **real `processAgentBattle`**: the three builders and `messages.create` are doubled, the sequence between them is production code. `setTimeout` is faked alongside `Date` (`toFake: ['Date','setTimeout','clearTimeout']`) so a 21.5 s build and a 22 s call cost the suite nothing; `advanceTimersByTimeAsync` flushes microtasks between firings, so timers armed mid-tick fire in window. The doubled `messages.create` behaves like the SDK — it records whether the signal it was handed was **already aborted**, takes its fake time, and rejects the instant that signal aborts.

Three rows: a 21.5 s build then a 5 s call; the same with the build/call arithmetic asserted; and a call that outlives the ceiling (the backstop must still fire).

**SHOWN FAILING against the pre-change cron:**

```
 FAIL  api/cron/agent-evaluate.timing.test.js > §4.1 … > the signal handed to messages.create
       is not aborted at call time, and is never aborted during a 5s call
 AssertionError: the backstop must not fire during a 5s call: expected 500 to be null

 FAIL  api/cron/agent-evaluate.timing.test.js > §4.1 … > the backstop and the SDK timeout now
       measure the same interval from the same instant
 AssertionError: expected undefined to be 21500   // no buildMs on the entry at all

 FAIL  api/cron/agent-evaluate.timing.test.js > §4.1 … > a call that outlives the ceiling is
       still aborted — the backstop is a backstop, not removed
 AssertionError: expected 500 to be 22000         // the call got 500 ms, not 22 000
```

`expected 500 to be null` **is the defect, measured**: 22 000 − 21 500 = 500 ms. The abort fired half a second into a call that needed five seconds.

**GREEN after:** all three pass; `abortedAtCallTime === false`, `abortedAfterMs === null` on the 5 s call, `entry.callMs === 5000`, `entry.buildMs === 21500`, and the third row still shows `abortedAfterMs === 22000` with `timeoutKind: 'backstop'` — the backstop was moved, not removed.

### 4.2 Build ceiling — `api/cron/agent-evaluate.timing.test.js:257-317`

A `buildLiveContextBlock` that returns `new Promise(() => {})` — it never resolves. The ceiling runs at its **production value** (asserted in the row: `expect(PROMPT_BUILD_CEILING_MS).toBe(10_000)`).

**SHOWN FAILING against the pre-change cron** — the row does not fail on an assertion, it fails by **hanging**, which is exactly the hazard §2.2 exists to close:

```
 FAIL  api/cron/agent-evaluate.timing.test.js > §4.2 … > a build that never resolves ends the
       tick at the ceiling as build_timeout …
 Error: Test timed out in 5000ms.

 FAIL  api/cron/agent-evaluate.timing.test.js > §4.2 … > the loop proceeds: the next battle
       takes its own tick normally
 Error: Test timed out in 5000ms.
```

**GREEN after**, with every clause the prompt names: `messages.create` not called; `promptBuilt === false` (proved by `Object.keys(entry)` equalling the base keys exactly and by `heard`/`evidence`/`vintages`/`candidates` all absent); `failureClass: 'build_timeout'`; `callMs === null`; `buildMs >= 10_000`; `promptBuiltAt === null`; `consecutiveEvalFailures` 0 → 1; `totalHaikuCalls` incremented (it counts attempts); the `eval_degraded` beat and the `cronErrors` entry both naming the new class; and a second battle taking its own tick normally afterwards. A fourth row pins the other side of the bound: a build finishing at ceiling − 1 ms is **not** a timeout and does reach the model.

### 4.3 Guard arithmetic — `api/_utils/agentEvalTransport.test.js:159-211`

Expressed through the constants, never a literal: `PROMPT_BUILD_CEILING_MS + HAIKU_CALL_CEILING_MS + HAIKU_POST_CALL_ALLOWANCE_MS`. Proceeds at exactly the sum, skips one millisecond under, and one added row states the behaviour change out loud — a battle sitting at exactly the **old** 34 s requirement is now skipped.

**MUTATION** (`requiredMs` reverted to the two-constant sum) → **5 rows RED**, e.g. `AssertionError: expected 34000 to be 44000`.

### 4.4 `classifyTimeoutKind` — `api/_utils/agentEvalTransport.test.js:118-157` (+ the two `classifyHaikuFailure` rows at `:96-110`)

SDK timeout class and `Request timed out.` → `'sdk'`; `APIUserAbortError`, a native `AbortError`, `Request was aborted.` → `'backstop'`; a build timeout, HTTP statuses, `APIConnectionError`, `TypeError`, nullish, a truncated-response message → `null`. `classifyHaikuFailure(PromptBuildTimeoutError)` → `'build_timeout'`, plus a row asserting the build-timeout **message** is not timeout-shaped, so the class does not depend on branch order.

**MUTATION 1** (`'backstop'` arm returns `'sdk'`) → 2 rows RED: `expected 'sdk' to be 'backstop'`, `expected 'sdk' not to be 'sdk'`.
**MUTATION 2** (the `build_timeout` branch deleted from `classifyHaikuFailure`) → 3 rows RED across two files: `expected 'Error' to be 'build_timeout'`.

### 4.5 Prompt invariance — `api/cron/agent-evaluate.tickStamps.pins.test.js` (pin 4)

Two halves, both extended:

- **The source pin.** `formatRecentEvals` must read exactly the eight whitelisted keys and must not contain `promptBuiltAt`, `buildMs`, `callMs`, `timeoutKind` or `haikuError` — checked alongside the four existing stamp keys, with an added anti-vacuous row asserting the whitelist and the additive set are disjoint.
- **The behavioural twin.** Three production-shaped entries (a check that built and called; a check whose build blew the ceiling, no call; a transport timeout carrying `timeoutKind: 'sdk'`) applied to the **three entries the renderer actually renders**. `formatRecentEvals(timed, 3)` is asserted **byte-identical** to `formatRecentEvals(plain, 3)`, the rendered block is asserted non-trivial (length > 80, and it contains each `evalId`) so the comparison cannot pass vacuously, and none of `promptBuiltAt / buildMs / callMs / timeoutKind / build_timeout / 10004 / 20003 / 6231` appears in it.

`api/_utils/__fixtures__/promptHonestyRegistry.js` is **unchanged**. All 12 pins pass.

### 4.6 Client absence state — `src/screens/battleView/WhyPanel.render.test.jsx:203-250`

Mounted and behavioural, never a source grep: the real `WhyPanel` rendered through the real `selectWhyState` from a **real doc-shaped entry** — `haikuError: { failureClass: 'build_timeout', message, timestamp, timeoutKind: null, evalId }` plus `promptBuiltAt: null, buildMs: 10004, callMs: null`. It renders the **generic** absence ("…the evaluation did not complete"), `data-why-kind="absent"`, never the timeout words, never `build_timeout`, never `Haiku`, never `10004`, and is not blank (the facts around the absence still render). A second row proves the three timing fields never reach the player on a **normal** tick either.

**MUTATION** (`selectWhyState.js:146` → `const timedOut = !!evaluation.haikuError`) → **2 rows RED**, the new one among them: `expected '<section role="region" …' to contain 'No decision recorded at this check · …'`. This is the live decision site; the mutation identified it (see the §3 note about the second, unused copy in `decisionRecord.js`).

### 4.7 Shadow record — `api/cron/agent-evaluate.timing.test.js:319-350`

On a healthy tick the `logEvaluation` payload carries `evalId === entry.evalId`, `timestamp === entry.timestamp`, `buildMs === 1500`, `callMs === 4000` and `failureClass: null`; on a build timeout it carries `failureClass: 'build_timeout'`, the matching `evalId`, `callMs: null` and `buildMs >= 10_000`.

**SHOWN FAILING against the pre-change cron:** `AssertionError: expected undefined to be 'eval_001'`.


---

## 5. Verification

### Full suite — exit code asserted, never piped through `tail`/`head`

`npm run test:run`, whole output captured to a file, exit code read from `$?`:

Run twice — once on the build as committed, once after the adversarial review's fixes (§7). Both green; the second is the one that ships:

```
EXIT CODE: 0

 Test Files  656 passed | 3 skipped (659)
      Tests  12384 passed | 64 skipped (12448)
   Duration  155.24s
```

The 3 skipped files / 64 skipped tests are the repo's pre-existing skips, unchanged by this commit.

### `vite build`

`npm run build` → **exit 0** (run again after the review's fixes; also exit 0). Required by BUILD_RULES §2 at the review threshold: no test in the repo imports `App.jsx`, so the build is the only check that would catch a syntax error there. (This commit touches no `src/` source file — only one `src/` test file — so the build is a formality here, but the threshold requires it and it was run.)

### Lint

`npm run lint` is red at HEAD (known: browser-only globals under `api/`). Measured **on the touched files only**, before (HEAD, with the working tree stashed) and after:

| File | Before | After |
|---|---|---|
| `api/cron/agent-evaluate.js` | 5 errors | 5 errors |
| `api/_utils/agentEvalTransport.js` | 0 | 0 |
| `api/_utils/agentEvalTransport.test.js` | 0 | 0 |
| `api/_utils/__fixtures__/tickStampsHarness.js` | 0 | 0 |
| the four `agent-evaluate.tickStamps.*.test.js` | 0 | 0 |
| `src/screens/battleView/WhyPanel.render.test.jsx` | 0 | 0 |
| `src/data/decisionRecord.test.js` | 0 | 0 |
| `api/cron/agent-evaluate.timing.test.js` (new) | — | **0** |
| **TOTAL** | **5** | **5** |

**It did not rise.** All five are pre-existing and untouched by this change: `getPresetAdjustedStrategies` unused (`:54`), `process` not defined (`:154`, `:177` — the browser-globals config), `_e` unused (`:1079`, `:1910`). Two errors I did introduce in the new test file — an unused `summary` destructure, then an unused `settled` left behind when the review removed a vacuous assertion — were each caught by this check and removed before their commit.

### Fence / flag assertions

- `git diff --stat` contains **no `src/config/featureFlags.js`**.
- `git diff` contains **0 occurrences of `DARK_BY_DESIGN`**.
- `git diff --name-only` contains **no fenced file** (all eleven §1 paths checked by name).
- `api/_utils/__fixtures__/promptHonestyRegistry.js` unchanged.


---

## 6. Deviations

Each item is either a place where the prompt's text did not map one-to-one onto the tree, or a judgement call the prompt did not cover. None is a silent improvisation.

**D-1 — §2.3's conditional did not fire.** "If the 12 s is a literal, name it `POST_CALL_ALLOWANCE_MS` in the same module." It is not a literal: it already exists as `HAIKU_POST_CALL_ALLOWANCE_MS` (`agentEvalTransport.js:15`, since June). The existing name was kept rather than renamed — a rename would have been churn across the module, its test and the cron for no gain. The guard is still the sum of three named constants.

**D-2 — the error's name is an exported constant, not a bare literal.** §2.2 says the rejection "carries a named error (`name: 'PromptBuildTimeoutError'`)". The string would otherwise have been written three times (the cron's thrower, `classifyHaikuFailure`'s matcher, `classifyTimeoutKind`'s guard), which is exactly the drift shape the module's `EVAL_MODEL_ID` comment exists to prevent. It is exported once as `PROMPT_BUILD_TIMEOUT_ERROR_NAME` (`:29`) and read by all three. No error class was added — the module stays "pure helpers, no I/O, no SDK imports".

**D-3 — `timeoutKind` is on all three `haikuFailure` literals, not only the catch.** §2.5 says "`null` for non-timeouts". Read literally that could mean the key is only written where an error exists. It is written as an explicit `null` at the `budget_skipped` (`:2001`) and `truncated_response` (`:2111`) sites too, so `haikuError` has exactly ONE shape on every path and no reader has to distinguish "absent" from "null".

**D-4 — the harness key list was split rather than grown.** Three additive entry fields break every `expect(Object.keys(entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS, …])` assertion in the four `tickStamps` suites. `PRE_PHASE_B_ENTRY_KEYS` was **not** grown: it is frozen history that must keep matching `tickStampsEntryGolden.flagOff.json` (captured at `4a8ae54a`). Instead the harness gained `TIMING_ENTRY_KEYS` and `BASE_ENTRY_KEYS = [...PRE_PHASE_B_ENTRY_KEYS, ...TIMING_ENTRY_KEYS]` (`tickStampsHarness.js:74`, `:77`), and the four suites were repointed at `BASE_ENTRY_KEYS`. This is the main reason the diff reaches 11 files (§8).

**D-5 — the flag-off golden was NOT regenerated.** `tickStampsEntryGolden.flagOff.json` is a frozen capture of the pre-Phase-B tree; regenerating it from this tree would destroy the one thing it proves. The byte comparison in `agent-evaluate.tickStamps.flagOff.test.js` now lifts the three timing fields off **both sides** (`pick(entry, PRE_PHASE_B_ENTRY_KEYS)`) before comparing, so it still asserts that nothing else moved — same 25 keys, same order, same bytes. Two guards were added so this cannot go vacuous: the live entry's non-golden keys must be exactly the three timing keys, with their frozen-clock values (`FROZEN_NOW / 0 / 0`); and the `GENERATE_TICK_STAMPS_GOLDEN` escape hatch now strips the same fields, so a future regeneration cannot silently write an incompatible artifact.

**D-6 — §4.1's 21.5 s build needs the build ceiling raised, and the row raises it.** As written, §4.1 (a 21.5 s build that then reaches the call) and §2.2 (a 10 s build ceiling) cannot both hold: under the shipped ceiling that build ends as `build_timeout` and never reaches `messages.create`. §4.1 is about **timer placement**, so the row raises `PROMPT_BUILD_CEILING_MS` to 60 s for itself — through a getter on the mocked transport module, every other export real — and keeps the prescribed 21.5 s / 5 s numbers. §4.2 asserts in its own body that it is running at the **production** 10 s value. The conflict is in the prompt, not in the build; flagging it rather than quietly rescaling the numbers.

**D-7 — I judged the two class-loop unit tests safe to leave alone, and the review proved me wrong on one of them.** My reasoning was that `decisionRecord.test.js:190` and `selectWhyState.test.js:245` already loop over `'unknown'` and arbitrary values, so the generic fallthrough was covered by construction and §4.6's one **mounted** test was enough. Lens C refuted it with a repro: `'build_timeout'` **contains the substring `timeout`**, which none of the looped classes does, so a matcher loosened from `===` to `.includes()` gives a check that never made a call the words "the evaluation timed out" — and 49 test files stayed green under exactly that mutation. `'build_timeout'` is now the first entry in `decisionRecord.test.js`'s loop, with a comment saying why it is listed first, and reverting the fix reddens it. (`selectWhyState.test.js` is left as it was: its own site has the mounted §4.6 row, which the review mutation-checked.) Recorded as a deviation rather than quietly corrected, because the original judgement is in this record.

**D-8 — `buildMs` on a build timeout is measured, not set to the constant.** §2.4 says "on build timeout it is the ceiling". It is `Date.now() - buildStartedAt` at the moment the race rejects, which is the ceiling plus whatever scheduling lag the runtime added. That is the honest number and it satisfies §4.2's `buildMs >= ceiling`; hard-coding the constant would have hidden lag that is worth seeing when the week of data arrives.

**D-10 — four findings the review CONFIRMED are recorded and not fixed**, each with its reason, in §7: D1 (the 10–16 s no-call band — prescribed by §2.2), D2 (the ceiling bounds one of three builds per tick — `shadowAssemblyCapture.js` is outside §2), B3 (`evalId` collides past 150 entries — pre-existing), B2/D3, B4/D5, D7/B6 and B5. Three comments I had written were corrected where they claimed more than the code delivers; no behaviour was changed for any of them.

**D-9 — `npm ci` was run.** The container had no `node_modules`, so nothing could be verified without it. Recorded per BUILD_RULES §3's "record what you did" discipline; it changes no tracked file (`package-lock.json` untouched).


---

## 7. Adversarial review (BUILD_RULES §2)

The §5 threshold is crossed (§8), so BUILD_RULES §2 makes this mandatory. It was **run, not disclosed-as-skipped**.

### Method

Four independent lenses, each on its **own `git archive d775537f` extraction** under the session scratchpad with `node_modules` symlinked, each **read-only on git and on the shared working tree** (the Sep 2 reviewer-isolation ruling — Reviewer B's byte-exact restore is the precedent). Each was instructed to **refute**: a finding without a repro the reviewer actually executed had to be marked UNVERIFIED. None was: every finding below arrived with commands and output.

| Lens | Dimension | Findings |
|---|---|---|
| A | async / lifecycle correctness | 5 (1 major, 4 minor) |
| B | the persisted record and every reader | 6 (3 major, 3 minor) |
| C | test integrity — 29 mutations run | 7 (1 major, 6 minor) |
| D | the invariant, the fence, unintended side effects | 8 (2 major, 6 minor) |

Isolation verified after the fact: the shared tree was `git status --porcelain` empty at `d775537f` throughout. `vite build` exit 0.

### The one defect the review caught in what I built — CONFIRMED, FIXED

**`timeoutKind` could claim a transport timeout on a call that never happened** (A2 · B1 · D4 converged on it independently). Two distinct bugs, both mine, both in code added by this commit:

1. **A build-phase failure with a timeout-shaped message was recorded as `timeoutKind: 'sdk'`** — asserting the SDK's 20 s per-request timeout fired on a request that was never sent. Reachable: the build's own Firestore path can throw gaxios' `Total timeout of 60000ms exceeded` on a stalled token refresh, or a socket's `connect ETIMEDOUT`. I reproduced it directly against the shipped exports:
   ```
   {"m":"connect ETIMEDOUT 142.250.1.1:443",     "failureClass":"timeout","timeoutKind":"sdk"}
   {"m":"Total timeout of 60000ms exceeded",     "failureClass":"timeout","timeoutKind":"sdk"}
   ```
   (`failureClass: 'timeout'` there is **pre-existing** — the same matcher at `d775537f^`. The false `timeoutKind` was new.)
   **Fix** (`agent-evaluate.js:2135`): `timeoutKind: callMs === null ? null : classifyTimeoutKind(err)`. The kind describes the call, so it may only be claimed when a call ran — and the cron already held the disambiguating fact.
2. **`classifyTimeoutKind` tested the message regex before the class check**, so an `APIUserAbortError` whose message mentioned a timeout read as `'sdk'` — the one discrimination the field exists to make.
   **Fix** (`agentEvalTransport.js:126-134`): both class checks before either message check, matching the module header's own rule that the class is the strong signal.

Both fixes are mutation-verified: reverting either reddens a row.

### Test gaps the review found — 7 closed, each mutation-verified

Lens C ran 29 mutations; 24 went RED unprompted (the placement, the race, every timing field, the entry-key lists, the pins twin's two vacuity modes, the client copy). Five were GREEN — gaps — plus two more from A and one from D:

| Gap | Was | Now |
|---|---|---|
| **C1 (major)** `noDecisionLine` — the narrator's copy of "only a timeout earns the timeout words" — had no `build_timeout` row. `'build_timeout'` **contains** the substring `timeout`, so a matcher loosened `===` → `.includes()` silently gives a check that made no call the words "the evaluation timed out"; 49 files stayed green under that mutation. | GREEN | RED (`decisionRecord.test.js:190`) |
| **A1** the build-timeout guard in `classifyTimeoutKind` was dead code — the shipped message matches no regex, so the row asserting `null` passed with or without it | GREEN | RED (a build error with a timeout-**shaped** message) |
| **C2/D8 (M16, M17)** `timeoutKind: null` on the two *literal*-built receipts (`budget_skipped`, `truncated_response`) was unpinned; `haikuError` could silently go back to a non-uniform shape | GREEN | RED (`Object.keys(entry.haikuError)` pinned on both, plus a new end-to-end `truncated_response` row) |
| **C6** `timeoutKind: 'sdk'` was never produced end to end — the SDK is doubled, so only the 22 s backstop could fire, leaving the **common** production timeout path with zero integration coverage | absent | a row driving the SDK's own shape through the real `processAgentBattle` |
| **A4** `if (buildMs === null)` — the only thing stopping `buildMs` from absorbing the *call's* wall time on a call-phase failure, i.e. from answering "build or call?" wrongly in exactly the case the field exists for — had no test | GREEN | RED (`buildMs` asserted on the backstop row; unguarded it reads 43 500 instead of 21 500) |
| **A3** at a build of **exactly** the ceiling, the winner is decided by `Promise.race` array order; swapping the two arms reads as an identical refactor and silently flips the tie to `build_timeout` | GREEN | RED (an exact-tie row; the swap now reddens it) |
| **C4** the flag-off golden row titled "keys, **order**, bytes" was no longer order-sensitive — `pick` re-imposes the golden's order on whatever it is handed | GREEN | RED (the live entry's own key order asserted before the byte comparison) |
| **C3** the §4.2 anti-vacuity guard read a const destructured at module init, so it could never observe a test override — the very thing its comment claimed | unfalsifiable | reads the mocked namespace |
| **C5** `expect(settled).toBe(true)` was unfalsifiable decoration (the handler has always run by the time it is read) | vacuous | removed; the comment names vitest's `testTimeout` as the real hang guard, which is how this file fails against the pre-change cron |

### CONFIRMED findings NOT fixed, and why

**D1 (major) — the invariant as I wrote it was too narrow, and §0 above is corrected.** A build of 10–16 s now yields **no model call at all**, where the pre-change code made that call and recorded a real decision. Lens D materialised the pre-change cron and ran both through the same harness at a 6 s model latency:
```
build=  9500ms  OLD: call=1 decision recorded   NEW: call=1 decision recorded
build= 10001ms  OLD: call=1 decision recorded   NEW: call=0 build_timeout   <== REGRESSION
build= 15999ms  OLD: call=1 decision recorded   NEW: call=0 build_timeout   <== REGRESSION
build= 21500ms  OLD: call=1 timeout             NEW: call=0 build_timeout
```
The band is `[PROMPT_BUILD_CEILING_MS, HAIKU_CALL_CEILING_MS − model_latency)`; at a fast 3 s Haiku it is [10 s, 19 s). **This is prescribed by §2.2, not improvised** — the ceiling is the task's own instruction, and the whole point is that an unbounded build can take the serial loop and this battle's write with it. But "only when the call starts and how long it gets change" understates it, so the verdict table now names the band.

The mitigating structure, which Lens D established and I had not: `fetchInstitutionalContext` is the **only** `await` in the entire build (`agentEvalPromptAssembly.js:1250`), it returns `null` with zero reads unless the agent has a `category === 'institutional'` rule (`:891-893`), and its errors are swallowed fast (`:930-933`). So the ceiling is **structurally unreachable for every non-institutional agent**, and for institutional ones it is 2–3 sequential round trips. It fires on a Firestore *hang*, not on slowness. 10 s is generous — which is why the constant says REVISIT once `buildMs` has a week of data.

**D2 (major) — the ceiling bounds one of three builds per tick.** `SHADOW_ASSEMBLY_ENABLED = true` (`featureFlags.js:1348`, not dark), and `buildShadowDiffRecord` awaits `buildLiveContextBlock` **twice more** (`shadowAssemblyCapture.js:182`, `:186`) — both unbounded, both awaited at `agent-evaluate.js:2968` **before** `await battleRef.update(finalUpdate)` at `:2990`. I verified this myself at those lines. So a Firestore hang in the shadow rebuilds still costs the write, which is precisely the hazard my constant's comment claims to close. Bounding them is a change to `shadowAssemblyCapture.js`, which §2 does not prescribe — **so it is not fixed here** (BUILD_RULES §3: report, don't fix). What I did do is stop my own comment overstating its reach: `agentEvalTransport.js:25-38` now says explicitly that it bounds the decider's build only, names the two unbounded rebuilds, and points at the follow-up. **This is the most important open item in the handover.**

**B3 (major, pre-existing) — `evalId` is not unique, so §2.6's join key is `timestamp`.** `evalId` is `evaluations.length + 1` against an array capped at 150, so on a battle past 150 checks every later entry is `eval_151`. A `5d` battle runs ~180 ticks. Lens B showed the live consequence: `agentReflectionUtils.js:182-188` dedupes by `evalId || timestamp`, so two real checks vanish from the reflection prompt. My co-added `timestamp` rescues the shadow join (it is unique per tick), so **this commit is not broken** — but its comment claimed too much. Corrected at `agent-evaluate.js:2872-2879`: `timestamp` is named as the key, `evalId` as the human-readable half, with the collision called out as pre-existing and unfixed. **Separate tasking.**

**B2 / D3 — `build_timeout` increments `totalHaikuCalls` and refreshes `lastEvalStartedAt` though no request was sent.** Both lenses flagged the counter's docstring ("counts ATTEMPTS — a budget_skipped tick never started a call"). This is **pre-existing semantics, not new**: a builder throw has behaved identically since the June fix, and `agent-evaluate.tickStamps.gates.test.js:191` already pins `totalHaikuCalls === 1` for exactly that case at HEAD. The counter's contrast is with `budget_skipped`, not with "a request reached the wire". Behaviour unchanged; the comment at `:2914-2921` now says so, so the forensics column cannot be misread.

**B4 / D5 — the class name reaches players verbatim.** `Evaluation engine degraded this tick (build_timeout) — defaulted to HOLD.` (`agent-evaluate.js:2855`) flows to `AgentDesk.jsx:158`, `statusFeedToVoice.js:59`, and `Flat6BattleView.jsx:335`, where the feed is public to the whole tournament group. **Pre-existing shape** — `timeout`, `budget_skipped` and `truncated_response` already leak identically — so this adds one token to an existing channel rather than opening one. Copy is out of scope (§3). Recorded for the founder.

**D6 — the budget guard's side effect, quantified.** Lens D ran the real exports: the flip window is exactly `elapsed ∈ [246_001, 256_000] ms` — **10.0 s, 3.4 % of the 290 s budget**. Guard evaluations are separated by one full per-battle cost (≫ 10 s), so **at most one battle per tick** can land in it, and that battle is compensated: `budget_skipped` never sets `haikuAttempted`, so `lastEvalStartedAt` is not refreshed and it leads the next tick's fair-rotation sort. Net cost: one evaluation deferred ≤ 15 min. The worst case is unchanged at exactly 290 000 ms, so 44 s is the *correct* reservation for the new arrangement, not an over-reservation. Second-order, unmentioned in §2.3: a skipped battle now costs ~0 instead of a ≤ 22 s call, so more battles reach the guard before the handler-level deferral — slightly more `budget_skipped` entries and fewer silent `summary.skipped` ones.

**D7 / B6 — the forensics ride a fire-and-forget channel, and nothing reads the new fields yet.** `logEvaluation(...).catch(() => {})` is the pattern BUILD_RULES §5 names as its cautionary tale; the `.catch` is pre-existing and the same `buildMs`/`callMs` are durable on the battle-doc entry, so the data is recoverable. Separately, `timeoutKind`/`buildMs`/`callMs` have **zero readers** — `scripts/phase0-eval-timeouts-readonly.js` was not extended to surface them. That is by design (§2 is exhaustive and does not ask for it) and is now a named handover item.

**B5 — stale anchors.** My line shifts invalidated the `file:line` anchors in the Phase-0 script's header comment, and two client comments enumerate the class vocabulary without `build_timeout`. Both are comment-only and neither is load-bearing (the code is non-exhaustive by construction). Not fixed — three more files against an already-crossed threshold was the wrong trade, and BUILD_RULES §3 already requires inherited anchors be re-verified. Recorded.

**A5 / C7 — `clearTimeout(buildTimer)` in the outer `finally` can never be the clear that matters**, and my comment ("either timer may never have been armed") was false for it: `buildTimer` is armed synchronously while the race array is evaluated. The redundant clear is harmless and stays; the comment at `:2139-2144` is now accurate.

### Refuted / no finding

- **Unhandled rejections and dangling promises: none.** `Promise.race` subscribes a rejection handler to both arms before either settles, so a late rejection of the abandoned build is absorbed. Verified twice by Lens A — an isolated harness (`UNHANDLED_REJECTIONS=[]`, `ACTIVE_HANDLES=[]`) and end-to-end through the real `processAgentBattle` with a build rejecting 15 s in, followed by a clean second battle.
- **Timer leaks across battles: none.** Both timers are `let`-scoped inside the per-battle block, so a late `.finally` from battle N can only clear battle N's own already-fired timer.
- **`messages.create` reached with `promptBuilt === false`, or with undefined prompt parts: impossible.** The race can only resolve with `buildPrompt()`'s object; nothing between the flip and the call can throw.
- **Firestore write safety: clean.** All four new fields are `null`-initialised and only ever assigned from `Date.now()` arithmetic or `toISOString()`; `classifyTimeoutKind` is total. Verified through the harness mock that rejects `undefined` at **six** outcomes — success, `budget_skipped`, `truncated_response`, a builder `TypeError`, `build_timeout`, an SDK timeout — with `undefinedPaths()` empty on both the `finalUpdate` and the shadow payload. There is exactly **one** entry-composition site, so no other flush site is left inconsistent.
- **Entry size: not material.** Measured with the repo's own `firestoreBytes`: **70 B** per populated entry, 32 B all-null; × 150 = 10.3 KiB = **1.0 % of the 1 MiB document limit**, taking `evaluations` from ≈237 KiB to ≈242 KiB.
- **The shadow record passes through verbatim.** `shadowLogger.js:44-69` is `JSON.stringify({ ...record, _stream, _loggedAt })` — no whitelist, and no `timestamp` collision (the parent's payload had no such key; the writer's own additions are underscore-prefixed). I confirmed this at those lines myself.
- **`resolveTerminalGate`: safe.** `transport_build_timeout` is produced correctly and nothing downstream enumerates `transport_*`.
- **Over-mocking / fake seam: refuted.** Lens C proved the ceiling getter is live in the cron's import binding (removing the override makes the same tick end at exactly `buildMs === 10_000` with zero calls), and that the other doubles do not stub the ordering under test. Fake timers cover the whole path — a test that should hang fails loudly with `Test timed out`, not silently.
- **Prompt byte-identity: HOLDS, executably.** Lens D diffed the request literal character by character (the only difference is the hoisted `let response`), diffed the builder call block (empty), and wrote a test asserting all three assembled parts are `.toBe()`-identical from entries with and without the new fields. It then audited every read of `battle.evaluations` in the tree: nowhere is an entry spread, `Object.keys`-iterated, or `JSON.stringify`-ed into prompt text.
- **FENCE: CLEAN**, checked entry by entry against §1, plus no `featureFlags.js` change, no `DARK_BY_DESIGN`, no new importer of a legacy archetype table (§2.3 ratchet untouched), no new prompt-rendering module (no `PROMPT_CONTRIBUTING_MODULES` obligation), no `vercel.json` change (§6 budget untouched). The `vi.mock` of the fenced assembler in the new test file is the same permitted double already used at `agent-evaluate.tickStamps.gates.test.js:103`.

### After the fixes

`npm run test:run` → **exit 0**, 656 files / **12 384** tests passed. Lint on the touched files: **5 errors, unchanged** (one error the fixes introduced was caught by that check and removed). `vite build` exit 0. Diff: **12 files, 1 004 insertions, 73 deletions** — `src/data/decisionRecord.test.js` is the twelfth, added for C1.


---

## 8. The §5 threshold

**The build diff reaches 12 files (1 077 lines changed: 1 004 insertions + 73 deletions). The cumulative branch diff reaches 14 files and 1 748 lines (1 675 + 73).** Both §5 limits are crossed. This is the STOP, and it is reported here rather than discovered by the founder in the PR. (It was 11 files before the adversarial review; `src/data/decisionRecord.test.js` is the twelfth, added to close review finding C1.)

**Why it got there, honestly.** Three production files were touched — `agentEvalTransport.js`, `agent-evaluate.js`, and the cron's test-harness fixture. The other eight are tests, and seven of those eight were **forced, not chosen**:

| File | Why it is in the diff | Avoidable? |
|---|---|---|
| `agentEvalTransport.js` | §2.2, §2.3, §2.5 | no |
| `agent-evaluate.js` | §2.1, §2.2, §2.4, §2.5, §2.6 | no |
| `tickStampsHarness.js` | the three additive entry fields change the entry's key list (D-4) | no |
| `…tickStamps.flagOff.test.js` | exact `Object.keys` + the golden byte comparison (D-5) | no |
| `…tickStamps.flagOn.test.js` | exact `Object.keys` (×3 rows) | no |
| `…tickStamps.gates.test.js` | exact `Object.keys` (×2 rows) | no |
| `…tickStamps.modeNotEnforce.test.js` | exact `Object.keys` | no |
| `…tickStamps.pins.test.js` | §4.5 | no — prescribed |
| `agentEvalTransport.test.js` | §4.3, §4.4 | no — prescribed |
| `agent-evaluate.timing.test.js` | §4.1, §4.2, §4.7 | no — prescribed |
| `WhyPanel.render.test.jsx` | §4.6 | no — prescribed |
| `src/data/decisionRecord.test.js` | review finding C1 | no — a real, mutation-proved gap |

Four suites assert the entry's key list with `toEqual`, which is a good pin and the reason the count is what it is: **any** additive field on the evaluation entry costs four test files before a line of new testing is written. That is the structural cost, and it was not visible from the prompt.

**What I did about it.** Two things, and I am stating both plainly so the founder can judge:

1. I did **not** stop halfway. Splitting this change leaves a red suite — the four key-list assertions fail the moment the three fields land — so there is no partial state worth handing over. The change is one atomic unit; it is complete, green, and reported.
2. I **ran the §2 adversarial review** rather than only flagging the threshold (§7). BUILD_RULES §2 makes it mandatory at ≥10 files and states it operationally: multi-lens, independently verified by reviewers instructed to refute, reviewer isolation on snapshot trees, an explicit `vite build`, mutation checks where tests are added, and written down in `docs/audits/`. All of that is in §7 and in this record — and it earned its cost: it found a real defect in code this commit added (a `timeoutKind` that could claim the SDK timed out on a request never sent), seven test gaps including one where 49 files stayed green under a live regression, and it proved the invariant statement too narrow.

If the founder's reading of §5 is that the session should have stopped at file ten and waited, then the correct remedy is a founder decision on scope, not a redo: the work is committed on the branch and nothing has been pushed toward merge. **This is the flag.**


---

## 9. Disclosure paragraph (for the PR body — the founder pastes it)

> Changes when the decider's Haiku call starts and how long it gets: the call now receives its full 22 s ceiling instead of 22 s minus prompt-build time, a June 11 placement. A build exceeding 10 s now ends the check honestly as `build_timeout` instead of as an aborted call. Nothing the decider sees changes — the prompt is byte-identical and pinned. New record fields are additive; readers null-guard.

*One sentence the prescribed disclosure does not cover, surfaced by the adversarial review and worth the founder knowing before merge: in the band from 10 s to (22 s − model latency) a build that previously still got its call and returned a real decision now returns none, so the new ceiling is a trade — an unbounded build can no longer take the serial loop and this battle's write with it, at the cost of losing the evaluation outright when it fires. It is structurally unreachable for any agent without institutional rules, and it bounds only the decider's own build: the shadow capture rebuilds the same block twice more per tick, unbounded, on the same path (open item 1 in the handover).*

---

## 10. Handover

**THE SMOKE IS PRODUCTION. This is a cron, and a preview deploy runs no cron — there is no preview URL for this change.** After the founder merges, the first triggered tick's entry carries `promptBuiltAt`, `buildMs`, `callMs`, and `haikuError: null` (or, on a failure, a `timeoutKind`). The founder reads it in the console.

### What to read, and where

`agentBattles/{id}` → `evaluations[]` → the last entry:

| Field | Healthy tick | What it tells you |
|---|---|---|
| `promptBuiltAt` | an ISO timestamp | the prompt was finished; the call started here |
| `buildMs` | expected sub-second for most agents | **the number the 10 s ceiling should be re-tuned against after a week** |
| `callMs` | expected well under 20 000 | what the call actually got — this is the number that was invisible before |
| `haikuError` | `null` | no degradation |

On a failure, `haikuError.timeoutKind` finally separates the two timeouts that `failureClass: 'timeout'` merged: `'sdk'` = the SDK's own 20 s fired; `'backstop'` = the cron's 22 s abort fired. A `failureClass: 'build_timeout'` means the prompt build blew 10 s and no call was made.

The same `buildMs` / `callMs`, plus `evalId` and `timestamp`, now ride each shadow record in `shadow/evaluations/{day}/*.jsonl`, so a week of them can be read in one pass without touching the battle docs — and each one joins back to its entry by value instead of by array position.

### What this build did NOT decide

Phase 0 §3.6 named two candidate causes for the 3/13 Thursday timeouts and could not separate them without data. This change does not pick one — it makes the record able to say. Specifically **out of scope by the prompt's own §3**:

- The ceilings (`HAIKU_CALL_CEILING_MS`, the SDK's 20 s, `max_tokens: 2048`) are unchanged. The founder's read of `haikuError.message` on Thursday's three entries decides whether they move — a later one-line change.
- Splitting `'timeout'` into two `failureClass` values. `timeoutKind` carries that now.
- Prompt assembly, tick stamps, the decision path, the narrator, the credential loader, lint config, suite hygiene.

### Open items for separate tasking (BUILD_RULES §3 — found, not fixed)

Ordered by what I would task first. All are CONFIRMED with repros in §7.

1. **The build ceiling bounds ONE of three live-context builds per tick (§7, D2 — major).** `SHADOW_ASSEMBLY_ENABLED` is `true`, and `shadowAssemblyCapture.js:182` / `:186` rebuild the same block twice more, unbounded, both awaited *before* `battleRef.update(finalUpdate)`. A Firestore hang there still costs the write — the exact hazard the new ceiling exists to close. The ceiling's own comment now says so rather than overstating its reach. **This is the biggest gap this change leaves open.**
2. **`evalId` is not unique past 150 checks (§7, B3 — major, pre-existing).** `evaluations.length + 1` against a 150-cap array, so on a `5d` battle (~180 ticks) every entry after the 150th is `eval_151`. Live consequence: `agentReflectionUtils.js:182-188` dedupes by `evalId || timestamp`, so real checks vanish from the reflection prompt. The shadow join added here is rescued by `timestamp`; nothing else is.
3. **The duplicated absence rule (BUILD_RULES §9).** `noDecisionLine` (`src/data/decisionRecord.js:80`, the narrator's) and `selectWhyState.js:146` (the panel's) are two copies of one rule over one field. They agree today; each now has its own guard, but that is two guards for what should be one source.
4. **The 10 s build ceiling is a guess** — documented as such in the constant, to be re-tuned from the first week of `buildMs`.
5. **Nothing reads the new fields yet (§7, D7/B6).** `scripts/phase0-eval-timeouts-readonly.js` was not extended to surface `timeoutKind` / `buildMs` / `callMs`; that is out of §2's scope but it is the natural next hour of work once data exists.
6. **The class name reaches players verbatim (§7, B4/D5).** `Evaluation engine degraded this tick (build_timeout)` reaches the Flat6 feed, which is public to the whole tournament group. Pre-existing channel (`timeout`, `budget_skipped` already do it); a copy decision, not a code one.
7. **Stale anchors (§7, B5).** This change's line shifts invalidated the `file:line` anchors in the Phase-0 script's header comment, and two client comments enumerate the failure-class vocabulary without `build_timeout`. Comment-only; nothing load-bearing.

### State

Branch `claude/eval-transport-hygiene`, three commits — `270c1c61` (the cherry-picked Phase 0 report), `d775537f` (the build), and the review-fix commit carrying §7's corrections and this record — **pushed**. No PR opened; the founder opens PRs. Not merged. §9 above is the disclosure paragraph for the PR body.

