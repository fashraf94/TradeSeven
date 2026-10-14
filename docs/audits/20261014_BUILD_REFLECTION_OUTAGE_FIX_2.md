# Build — Reflection outage fix, part 2 (package P-OUT-2): the wisdom rewrite

**Smoke preview (the record-sheet row):** https://trade-seven-13ythyw80-fais-projects-bc179554.vercel.app (Vercel Preview, deployment state `success`). Branch `claude/reflection-outage-fix-smoke` is at `7ea1491e`, the code head itself: no flag, no fixture, a fast-forward from part 1's `3f6cae55`. The served main bundle contains both "No lesson was recorded for this game." and this build's marker check (`.noLesson===!0`). No production agent holds a marker yet, so the preview shows the honest line only under old failure entries. The marker's row is proved by the render test (§8).

**Date:** 14 Oct 2026 · **Session:** Claude Code (Opus 5.5) · **Branch:** `claude/reflection-outage-fix-2` (the app's worktree branch `claude/reflection-outage-fix-p2-c79d3e`, pushed by refspec) · **Base:** `origin/main` = `d5d8fa9b` (the #957 merge) · **Code head:** `7ea1491e` · **Head:** this report's commit (recorded in the PR) · **PR:** the draft PR whose head is `claude/reflection-outage-fix-2` (not merged; CI not watched) · **Prompt:** Fable, 14 Oct 2026, "Build — Reflection outage fix, part 2 (package P-OUT-2): the wisdom rewrite"; founder rulings O5–O9 adopted by Flash, 14 Oct 2026.
**Rests on:** `docs/audits/20261010_PHASE0_REFLECTION_OUTAGE_ROOT_CAUSE.md` (§R3, §R6 (b) and (c)) and `docs/audits/20261010_BUILD_REFLECTION_OUTAGE_FIX.md` (§5, §6, §10, RV-9).

Every `file:line` below was read at the code head `7ea1491e` in this session (VERIFIED) unless marked ASSUMED. No player or agent text and no uid, agent id or battle id appears in this report.

---

## 1. In plain terms

| Question | Answer |
|---|---|
| Does the wisdom rewrite still read failure lines? | **No.** It reads only real lessons. |
| Can it run with too little to learn from? | **No.** It needs 3 real lessons in the agent's last five games. Below that it does nothing and spends nothing. |
| Can an account problem use up a game's three tries? | **No**, for 7 days after the game. Then it counts, so nothing waits for ever. |
| Can the rewrite call be left running and billed? | **No.** It is cancelled at its deadline (60 s, chosen by measurement). |
| Does a game without a lesson still vanish from the record sheet? | **No.** It shows *No lesson was recorded for this game.* |
| Fenced files touched? | **None.** |
| Review | One adversarial reviewer and 14 independent verifiers: 14 findings, 9 CONFIRMED, 4 PARTIAL, 1 REFUTED, none blocking. 6 fixed in code or tests; 3 come to you (items 1, 2 and 5 below); the rest are notes (§11). |

**What was still wrong.** Part 1 fixed the lesson an agent writes after each game. The next step was still broken. On every fifth game that counts (a game against the CPU), the agent rewrites its "wisdom" paragraph, the *Strategic insight* on the record sheet, from the last five lessons in its memory. Those five slots still hold old entries that only say *Reflection generation failed.*, and the rewrite read them as if they were lessons. The rewrite call also kept the same 30-second clock that broke the lessons, with no way to cancel it.

**What changed.**
- **The rewrite reads only real lessons.** Old failure lines and the new "no lesson" rows are left out. Each game keeps its number, so the agent still sees which game a lesson came from (ruling O5).
- **No rewrite without enough to learn from.** The rewrite runs only when the five slots hold at least **3 real lessons**. With fewer, nothing happens: no call, nothing written, the five-game turn is not used up, and the agent keeps its current paragraph. The check runs once before anything is spent, and again inside the rewrite itself (O5).
- **An account problem no longer uses up a game's tries.** If the account itself refuses the call, that try is handed back. That covers a bad or revoked key, no permission, a retired model, a billing problem, a spending or usage limit, or an empty credit balance. The game stays in the queue and is tried again on later runs. After **7 days** these refusals count like any other failure, so no game can wait for ever. Every other error still counts as one of the three tries (O7).
- **The rewrite call gets part 1's fix.** It is cancelled when its time runs out instead of being left running and billed. A cut-off or refused answer is never used. Its log line says why it failed, and never repeats the agent's words (O8).
- **A game without a lesson keeps its row.** When a game finishes without a lesson, the record sheet now shows it with **No lesson was recorded for this game.** Until now the game simply vanished from the timeline (O9).

**The numbers chosen, and why.** The new, filtered rewrite request was sent four times, for the real agents whose five slots hold the most real lessons. **Only one agent's slots reach 3 today**, so the other three had 2. The ruling allows this; it is said here plainly. Nothing was written back. The answers took **25.6 to 36.1 seconds** and were **1,131 to 1,655 tokens** long, all complete and valid. **Two of the four would have been cut off by the old 30-second clock**: the rewrite had the same problem the lessons had. So:
- the rewrite's time limit is now **60 seconds** (1.66 × the slowest call; the rule asks for at least 1.5 ×);
- its length limit is **4,096 tokens** (2.5 × the longest answer; the rule asks for at least 2 ×);
- the job's time ceiling stays **120 seconds**. A lesson at its full 35 s, then a rewrite at its full 60 s, plus start-up and writes, is about 110 s.

The four calls cost **$0.15**.

**What players will see.**
- New games get a lesson as before. A game that ends without one shows **No lesson was recorded for this game.** instead of disappearing.
- The *Strategic insight* paragraph changes only when the agent reaches a five-game turn (every fifth game against the CPU) and its last five games hold 3 real lessons. Until then it stays exactly as it is. Paragraphs already built from failure lines are not reset here; that is a separate step.
- During an account outage, games simply wait in the queue and get their lessons once the account works again.

**How to confirm it in production.** Crons do not run on Vercel preview, so none of this can be seen working there.
- **Account problems and "no lesson" rows** are proved by the tests, and after merge by the readout. Run from the main checkout:
  ```
  node scripts/reflection-outcome-readout.mjs --from <merge day> --to <next day>
  ```
  The first line now reads "… still retrying N [of which waiting on the account M] …". M above 0 means games are waiting out an account problem rather than using up their tries.
- **A real rewrite.** It happens only on an agent's fifth (tenth, …) game against the CPU, or on a later reflection at that same count; see decision 1 below. When it does, you will see one of two things:
  - **It ran:** on the record sheet, a new *Evolution cycle* row with a headline appears and the *Strategic insight* paragraph changes. In the shadow log (`shadow/agent_consolidation/<day>/…`) the line reads `success: true, outcome: 'ok', stopReason: 'tool_use'`, with its time in `elapsedMs`; expect well under 60,000.
  - **It was skipped for lack of lessons:** nothing changes on the sheet. The shadow line reads `reason: 'insufficient_real_lessons'` with `realLessons` (0–2) and `totalEntries`.
  - **Worth watching:** consolidation lines with `failureClass: 'timeout'`. A timed-out line carries `usage: null`, so a token count alone never shows that the 60 s clock is getting tight. The answer re-states every discipline each cycle, so it grows as an agent matures (review WR-12, §11).

**Things for you to decide or know.**
1. **A question: which reading of O6?** (review WR-1). O6 says tournament games "still do not trigger a rewrite" and "do not change how `gamesPlayed` moves". The build keeps the cadence exactly: tournament games never count toward the five. But O5 says a turn below the floor uses up nothing, so that turn stays open. A **tournament** game's lesson that arrives later at the same count, and brings the slots to 3, then runs the rewrite. This was possible before, but rare (a tournament battle that happened to be reflected first, or a failed reflection at the turn). The floor now makes it common, because most slots hold failure lines today. The build follows the cadence reading and leaves this as it is. The other reading, "only a game that moved the count may run the rewrite", is a three-line gate (`battleDoc.gameMode !== TOURNAMENT_GAME_MODE`). It would also close the two old paths, and seven test fixtures that use a tournament battle at a turn would move. Your call.
2. **A sign-off: one known race** (review WR-3). Below the floor nothing is spent, with one exception. Two runs on the **same agent** at once (a manual run during a tick) can land a "no lesson" row between the floor check and the rewrite's own re-check. The rewrite then correctly refuses, but the five-game turn stays used up, so that rewrite waits for the next turn. No call is made and nothing is lost. The complete fix releases the turn in one transaction when the rewrite refuses. That is a new write site on the agent document, so it needs your sign-off. A half-fix was tried and does not close the race.
3. **Noted: 402 counts as an account problem.** O7 lists 401, 403, 404, the usage or spend limit and the credit balance. Anthropic's documentation sends billing and payment problems as 402 `billing_error`, which is the account refusing the call, so the build treats it the same way (§5). Say if you want it out.
4. **Noted: where the credit-balance status comes from.** Anthropic's documentation gives the credit-balance message but not its HTTP status. Public reports show a 400, and the build matches the message on a 400. A 402 is caught by item 3 anyway.
5. **A question carried from part 1: a failed rewrite still uses up its turn** (review WR-11; pre-existing, no ruling covers it). If the rewrite call itself is refused or times out, the turn was already claimed, so the next try is five games later. A release on failure is about ten lines, and the verifier has it ready if you want it.
6. **A disclosure.** During setup, a shell command meant to confirm that two credential names exist in `.env.local` printed the first 40 characters of each matching line. That put about ten characters of the API key into this session's local transcript. Nothing left the machine. The key is not in this report, the repo or any artifact. Rotating it is your call.

---

## 2. Gate facts (BUILD_RULES §2 / §3)

- `git fetch origin` ran first: `origin/main` = `d5d8fa9b`. Re-fetched before the final checks (2026-10-14 17:07 UTC): `origin/main` was still `d5d8fa9b`, so the branch already contains it and the final checks ran on the tree CI tests.
- The app made a worktree branch `claude/reflection-outage-fix-p2-c79d3e` at `d5d8fa9b` = `origin/main`. It was cut fresh by construction, with a clean tree at session start. It is pushed as `claude/reflection-outage-fix-2` by refspec.
- **Fence:** no file in the BUILD_RULES §1 list is edited (`git diff --name-only d5d8fa9b HEAD` lists none of them; the reviewer and two verifiers re-checked).
  - **Fenced functions called:** in product code, none newly. In one test, `formatMemory` from `api/_utils/agentPromptAssembly.js` is CALLED to pin how the draft prompt renders a marker (`api/agent/reflect.generateReflection.test.js`); the file is not edited.
- **The locked consolidation template** (`api/_utils/agentConsolidationPrompt.js:16-176`, "DO NOT MODIFY") is byte-identical. The filter is in `formatMemory`, outside it (`:285-287`).
- **Cron count:** unchanged at 43 (`vercel.json` not edited). `maxDuration` is unchanged at 120 s (§3.3).
- **Model spend:** 4 calls of the 4 allowed, **$0.1473** at list price (20,203 input / 5,782 output tokens; `claude-sonnet-4-6` at $3 / $15 per million). Nothing was written back (§3). The reviewer and the verifiers made no model calls; one verifier ran the real SDK against a stubbed `fetch`.
- **Firestore:** read-only for the measurement (`.collection / .doc / .get` only).
  - **The proof grep.** The script was gated in the same shell command on the growth replay's §7 proof grep `\.(set|update|delete|add|create)\s*\(|runTransaction|\.batch\(|bulkWriter|writeBatch|FieldValue|recursiveDelete`: **no matches**, for both the dry run and the measured run. The model call goes through `client.messages.create.bind(client.messages)`, so the grep stays mechanical.
  - **One module import.** The script imports the worktree's `agentConsolidationApply.js` for its pure `validateConsolidationOutput` only; no Firestore handle reaches that module.
  - **Credentials and timing.** Credentials came from the primary checkout's `.env.local`, and the script never printed them (see §1, item 6, for a separate setup command). Run window: 2026-10-14 15:40–15:42 UTC.

## 3. The numbers, and why

### 3.1 Measurement (ruling O8)

**The request.** It is the worktree's `buildConsolidationPrompt` with the new filter. The script refuses to run if the worktree's `formatMemory` does not filter and number as built.

**Which windows.** Every agent document was read, and each distinct memory window ranked by real lessons. Two agents can hold an identical window (a clone carrying a copy of another agent's window), so each window was measured once.

| Real lessons per window (all 25 agents holding memory) | 0 | 1 | 2 | 3 | 4–5 |
|---|---|---|---|---|---|
| Agents | 11 | 9 | 3 | 2 | 0 |

The two agents with 3 real lessons hold one identical window, so **only one distinct window reaches the floor today**. The four calls went to it and to the three best windows with 2 (the ruling's "measure on the best available and say so").

**The request shape.** The production shape was used unchanged (`claude-sonnet-4-6`, temperature 0.3, thinking disabled, effort low, forced `submit_consolidation`), except `max_tokens: 8192`, so the true answer size was measured uncut. The calls ran from a home machine, so the times include client network and TLS overhead.

| # | Real / entries | Prior insight | Disciplines in | Pending lessons | System prompt chars | Elapsed | Input / output tokens | `stop_reason` | Valid | Cost |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **3** / 5 | yes | 1 | 2 | 14,665 | **36.1 s** | 5,440 / 1,536 | `tool_use` | yes | $0.039 |
| 2 | 2 / 5 | yes | 5 | 0 | 14,580 | 34.1 s | 5,339 / **1,655** | `tool_use` | yes | $0.041 |
| 3 | 2 / 4 | no | 0 | 0 | 11,924 | 29.8 s | 4,702 / 1,460 | `tool_use` | yes | $0.036 |
| 4 | 2 / 2 | no | 0 | 0 | 11,876 | 25.6 s | 4,722 / 1,131 | `tool_use` | yes | $0.031 |

"Valid" means `validateConsolidationOutput` passed with 0 errors, so the answer would have applied.

**Two of the four (36.1 s, 34.1 s) would have been cut off by the old 30 s race**, which also never cancelled the request. The largest answer (1,655 tokens) sat close to the old 2,000-token ceiling.

### 3.2 The chosen values

| Value | Rule (prompt) | Measured | Chosen | Where |
|---|---|---|---|---|
| Consolidation deadline | ≥ 1.5 × the slowest call | 36.1 s → ≥ 54.1 s | **60 s** (1.66×) | `api/_utils/agentConsolidationApply.js:37` |
| Consolidation ceiling | ≥ 2 × the largest answer | 1,655 → ≥ 3,310 | **4,096** (2.5×) | `api/_utils/agentConsolidationApply.js:38` |
| Real-lesson floor | founder slot (O5) | — | **3** | `api/_utils/memoryLessons.js:25` |
| Account-refusal backstop | founder slot (O7) | — | **7 days** | `api/_utils/reflectionOutcome.js:34` |

The ceiling cannot bind before the deadline. At the measured 43–49 tokens a second, 60 s writes about 2,550–2,940 tokens, under 4,096. A runaway answer is therefore named `timeout`, as in part 1.

What the measurement could not see (review WR-12): windows with 4–5 real lessons, and discipline arrays that grow every cycle. The answer re-states all disciplines, with no cap. On these four calls, the 60 s budget would be reached at roughly 15–19 disciplines, an estimate. Watch the consolidation `timeout` lines (§1).

### 3.3 The cron's ceiling (`api/cron/process-pending-reflections.js`)

**The worst single path.** It is:
1. the queue read;
2. a reflection at its full 35 s deadline;
3. on a five-game turn with ≥ 3 real lessons: the floor read, the milestone claim, the flag write and the driver's re-read;
4. a consolidation at its full **60 s**;
5. the apply.

That is about 5 + 35 + 60 + 10 = **110 s**, inside `maxDuration: 120` (`:64`). **Not raised.**

**Checked end to end** (verifier WR-12). The real handler, `generateReflection` and the driver ran on this path, with both model calls answering 1 ms before their deadlines. It came to 95.0 s plus 13 Firestore round trips in sequence (16 on the casual path). The later tenants make no Firestore calls on such a tick. 120 s is crossed only if round trips average 1.92 s or more, or one stalls for 25 s.

**If a run is killed at 120 s.** It wastes one paid consolidation call and moves that rewrite to the next turn; the next tick makes no model call and runs nothing twice.

**The lease and the pin.** The claim lease (150 s, `:80`) still outlives the ceiling. The pin is `process-pending-reflections.outcome.test.js` "the ceiling covers the worst path", which now imports the exported `CONSOLIDATION_TIMEOUT_MS` instead of matching a source literal.

A run whose lesson lands on a turn still takes the later tenants' time on that tick (part 1 disclosed this). The longer deadline lengthens it.

---

## 4. What changed, by file (VERIFIED at `7ea1491e`)

| File | Change |
|---|---|
| `api/_utils/memoryLessons.js` (new, pure, import-free) | One definition, shared by the filter, both floors and the record sheet:<br>• `LEGACY_REFLECTION_FAILURE_LESSON` (`:21`);<br>• `MIN_REAL_LESSONS_FOR_CONSOLIDATION = 3` (`:25`);<br>• `isNoLessonMarker` (`:28`);<br>• `isRealLesson`: a non-blank lesson, not the exact legacy literal, not a marker (`:42`);<br>• `countRealLessons` (`:49`). |
| `api/_utils/agentConsolidationPrompt.js` | `formatMemory` numbers every game over the **unfiltered** window, then drops anything that is not a real lesson (`:285-287`); an all-filtered window renders the empty sentinel. One import (`:14`). The locked template is untouched. |
| `api/_utils/agentConsolidationApply.js` | **The driver's own floor** on its re-read: below 3 it returns `{ success:false, reason:'insufficient_real_lessons' }`, writes nothing and logs one counts-only line (`:358-367`).<br>**The call** (`callSonnetConsolidation`, `:464`): our deadline settles the race, then aborts the request (`:476`; the signal is passed at `:492`); only `stop_reason: tool_use` is parsed (`:516-526`); `max_tokens` is a named failure.<br>**The shadow lines** carry the part-1 vocabulary (`consolidationCallFields`, `:534`). There is no agent text on any failure: the old `no_tool_use` response dump, the `validation_failed` output (now `validationErrorCount`, `:396`), the `firestore_apply_failed` output and the raw `err.message` are gone.<br>**The numbers** (`:37-38`). The existing reasons are kept. |
| `api/_utils/reflectionOutcome.js` | **The classifier.** `isAccountWideRefusal` (`:84`; the table is in §5), and `isCountedAttempt` with the 7-day backstop (`:34`, `:113`). An unreadable completion time counts.<br>**The record** gains `accountWide`, always a boolean (`:145`). **The exact-keys pin changes**: `outcome, failureClass, accountWide, errorName, elapsedMs, stopReason, usage, model, attempt, at`.<br>**The battle update** (`reflectionBattleUpdate`, `:178`) has two new branches:<br>• a refusal that reflect.js judged not counted hands the claimed attempt back in the same write (`reflectionAttempts: attempt − 1`, `:189`) and never finishes the battle;<br>• a third attempt that could not leave its row stays pending for the recovery pass (`:191`), which always finishes. |
| `api/agent/reflect.js` | **`alreadyRecorded`** counts only a real lesson for this game (`:148`, `:156`).<br>**One write per attempt, through the existing writers** (`:211-214`): the lesson, or (on the third counted failure, or the recovery pass, `:187`) the no-lesson marker. Before a marker, a fresh read of the learning window (`:191-200`): if this game's lesson is there the attempt is `ok` with no call metrics (`:239`); if any entry for the game is there, nothing is written (`:149`, `:199`).<br>**`counted`** is decided once per attempt (`:186`) and returned to the cron (`:266`). A third attempt whose marker or lesson write, or fresh read, throws returns `deferToRecovery` (`:205`, `:227`).<br>**The floor** (`:297-310`): a fresh read of the learning target **before** the claim (`:320`) and the `pendingConsolidation` write (`:325`). The already-recorded path runs the same gate.<br>**Builders and writers:** `buildNoLessonMarker` (`:493`); `writeMemoryReflection` takes the entry and its base window (`:505`); the casual transactional forward never appends a marker beside any entry for its game (`:523`). |
| `api/cron/process-pending-reflections.js` | Passes `recoveryPass` to the battle update (`:170`). A **throw** from the reflection at the third attempt now waits one tick for the recovery pass, which writes the marker; a throw in the recovery pass finishes the battle (`:199`, review WR-2). Comments. |
| `src/utils/evolutionTimeline.js` | Imports the literal and the predicates from `memoryLessons.js` and re-exports the literal (`:19`, `:31`). A marker renders `NO_LESSON_RECORDED_LINE` (`:169`), and never shows if the window also holds a real lesson for the same game (`:157-160`). |
| `scripts/reflection-outcome-readout.mjs` | "waiting on the account": a sub-count of "still retrying" (`:59`, `:84`, `:100`). The query, the `select` and the read-only allowlist are unchanged. |
| Tests | Four new test files, seven extended (§8). |

**Not changed:**
- `firestore.rules`;
- `firestore.indexes.json`;
- `shadowLogger.js`;
- the allowlist (§10);
- `updateAgentStats` and how `gamesPlayed` moves (O6);
- `buildMemoryEntry`'s output (it now spreads a shared `gameFieldsOf`, with the same fields);
- `claimConsolidationMilestone`.

---

## 5. Account-wide refusals: what counts, and the sources (ruling O7)

**The SDK, read in this session** (`@anthropic-ai/sdk` 0.71.2, `core/error.js`). It raises an `APIError` subclass per status:

| Status | Class |
|---|---|
| 400 | `BadRequestError` |
| 401 | `AuthenticationError` |
| 403 | `PermissionDeniedError` |
| 404 | `NotFoundError` |
| 429 | `RateLimitError` |
| ≥ 500 | `InternalServerError` |
| 402 | plain `APIError` |

`err.status` is the HTTP status. `err.error` is the **whole** parsed body (`client.js` `makeStatusError(status, errJSON, …)`), so the API's error object is `err.error.error = { type, message, details? }`. Confirmed by constructing one with `APIError.generate(400, body, undefined, new Headers())`.

| Refusal | Status / `error.type` | How it is recognised | Source |
|---|---|---|---|
| Invalid, revoked or expired key | 401 `authentication_error` | status | platform.claude.com/docs/en/api/errors |
| No permission for the resource | 403 `permission_error` | status | same |
| Retired or unknown model | 404 `not_found_error` | status | same |
| Billing or payment problem | 402 `billing_error` | status | same ("an issue with your billing or payment information") |
| A spend limit the organisation set | 400 `invalid_request_error` | message starts `You have reached your specified API usage limits` (or `…specified workspace API usage limits`) | platform.claude.com/docs/en/api/rate-limits, "Setting your own spend limit". Seen in production on 8 Oct 2026 (`docs/audits/20261009_COCKPIT_LIVE_WEEK1_READ.md:140`) |
| The usage tier's monthly spend cap | 429 `rate_limit_error` with `error.details.error_code: enforced_spend_limit_reached` | the error code; the docs say to use it to tell this apart from a rate limit | rate-limits, "Reaching your spend cap" |
| Prepaid credits used up | 400 `invalid_request_error` | message starts `Your credit balance is too low to access the Anthropic API` | The message is from platform.claude.com/docs/en/about-claude/api-credits-for-subscribers. **The status is not in the docs**; public reports (e.g. github.com/crmne/ruby_llm/issues/1006) show a 400. |

**An ordinary try:** every other 400 (a malformed request), every other 429 (a rate limit), every 5xx, connection errors and our own deadline. The failure class keeps the part-1 vocabulary (`http_401`, `http_400`, …). The record gains one boolean, `accountWide`.

**The SDK's own retries** (review WR-5, REFUTED by the documentation). The SDK retries a 429 twice. The docs say the spend-cap 429 "never" carries `retry-after`, so the retries take at most 0.5 s + 1.0 s, well inside the 35 s deadline. `reflect.sdkLayer.test.js` runs the documented responses through the real SDK, with only `fetch` stubbed, and pins this. It would turn red if an SDK upgrade changed the backoff or the error shape. An org-set 400 is never retried.

## 6. Failure handling, as built now (part 1's §6 with part 2's rows)

| Situation | Memory | Consolidation gate | Battle afterwards |
|---|---|---|---|
| Success (any attempt) | the lesson, as before | runs only on a five-game turn AND with ≥ 3 real lessons on a fresh read; below that, one shadow line and nothing else | flag cleared, `reflectedAt`, outcome `ok` |
| Failure, attempt 1 or 2 | none | not run | flag still set, attempts +1, outcome `failed` + class; retried next tick |
| **Account-wide refusal, battle completed ≤ 7 days ago, any attempt incl. 3** | **none** | not run | **flag still set; attempts back to their value before the claim**; outcome `failed` + class + `accountWide: true`; retried every tick until the backstop |
| Account-wide refusal, battle completed > 7 days ago (or no readable completion time) | as any failure | not run | counts like any failure; at attempt 3, finished with a marker |
| **Third counted failure** | **one no-lesson marker** (fresh read first: never beside this game's lesson or any entry for it) | not run | flag cleared, `reflectionNoLesson: true` |
| Third attempt whose marker write, lesson write or fresh read throws, or which throws before its call | none landed | not run | **stays pending one tick**; the no-call recovery pass looks for the lesson and writes the marker, and always finishes |
| The run dies inside attempt 3 | none | not run | the next tick's recovery pass: a lesson that landed gives `ok`; none gives a **marker** + `reflectionNoLesson` |
| A lesson that landed although its write reported an error | already there | runs on the retry (with the floor) | the next attempt finds the lesson: `ok` with no call |

**Unchanged from part 1:** the claim before the call, the 150 s lease, the recovery pass, and "a crashed attempt still counts". The refund is part of the single outcome write, not a second transaction.

**One decision per attempt.** `reflect.js` decides whether an attempt counts (`isCountedAttempt`, using the battle's `completedAt` and the time of the failure) and returns `counted`. The cron writes what `reflect.js` decided, so the marker and the refund can never disagree.

**A part-1 row moved** (review WR-2). Part 1's "a third throw finishes the battle at once" now waits one tick for the recovery pass, so the game keeps its row. `process-pending-reflections.outcome.test.js` pins the new end state.

## 7. The no-lesson marker: who reads it (ruling O9)

**The marker:** `{ gameId, gameMode, result, score, opponentScore, lesson: '', noLesson: true, date }`, built from the same game fields as a lesson entry.

**How it is written:** through the existing memory writers, either the plain rolling-window write or the transactional forward to the parent for a casual clone. **No new write site**; the scanner's keys and counts for these files are unchanged (§10).

| Reader | What it does with a marker | Anchor |
|---|---|---|
| `alreadyRecorded` (reflect.js) | ignores it: only a real lesson for this game counts | `reflect.js:148`, `:156` |
| The consolidation filter and both floors | ignore it | `agentConsolidationPrompt.js:285-287`; `reflect.js:299`; `agentConsolidationApply.js:357` |
| The record-sheet timeline | renders the game row with **No lesson was recorded for this game.**; a marker never shows if the window also holds a real lesson for the same game | `evolutionTimeline.js:157-169` |
| **The fenced draft prompt** (`agentPromptAssembly.js` `formatMemory`, under `RECENT GAME MEMORY:`; not edited) | renders it as **`Game (Win +12.35): No lesson recorded.`**: the result word, the signed score, then the fallback text, because the lesson is empty. Pinned in `reflect.generateReflection.test.js` with the marker the code actually writes. **Where it runs** (verifier WR-13): only the deploy-time strategy call on legacy tiered deploys (`decide.js:419`). The trading/evaluation prompt renders no memory at all. | `agentPromptAssembly.js:96`, `:277-286` |
| The casual re-sync (`casualClone.js:97`) | copies the parent's window, markers included, to the clone | unchanged |

A marker takes one of the five slots, like any entry. So a game without a lesson pushes an older lesson out of the window, and a window with markers is likelier to fall below the floor. That follows O9 and O5 as ruled.

---

## 8. Tests

| File | Rows | What they pin |
|---|---|---|
| `api/_utils/memoryLessons.test.js` (new) | 6 | The definitions: the literal (matched exactly), blank, marker, the floor of 3; import-free (the client bundle imports it). |
| `api/_utils/agentConsolidationPrompt.test.js` | +4 (21) | Legacy lines and markers are excluded. The numbers hold with `gamesPlayed` known (6, 8, 10) and unknown ("1 / 3 / 5 of 5 in window"). An all-filtered window gives the sentinel. The whole prompt carries no failure line. |
| `api/_utils/agentConsolidationApply.driver.test.js` (new) | 19 | The real driver, with the SDK mocked but its real error classes kept.<br>**The numbers** against the measured rule.<br>**Floor:** below it, no call, no write, one counts-only line; at 3, the call runs with only real lessons in it.<br>**Request shape:** the signal and the ceiling.<br>**Timeouts:** the abort fires AT the deadline, not 1 ms before; the call settles at the deadline even when the SDK ignores the abort.<br>**Failures:** `max_tokens` is never parsed; four foreign stop reasons are never applied; a missing tool block; 529 / 401 / usage-limit errors by class; `validation_failed` (count only); `firestore_apply_failed`.<br>**Privacy:** every failure line is checked against an allowed-key set, with planted agent text that must not appear.<br>**A valid answer** applies exactly as before; the casual path uses the transactional apply. |
| `api/_utils/reflectionOutcome.test.js` | +31 (43) | **The exact keys with `accountWide`** (changed pin). The boolean.<br>**The classifier** on the SDK's real classes: 8 account-wide shapes plus a non-JSON 401 and 404; 12 ordinary-try shapes.<br>**The backstop:** exactly 7 days is not past it; reads ISO, ms and Timestamp; an unreadable time counts.<br>**The refund** at attempts 1–3; refunds only an account-wide record; the deferral; the recovery pass always finishes. |
| `api/agent/reflect.generateReflection.test.js` | +31 (63) | **Account-wide** 401/403/404/usage-limit at attempt 3: not counted, nothing written. Past the backstop: counted, with a marker. A plain 400 counts. Our own deadline is never account-wide.<br>**Marker:** exactly one at the third counted failure, in the window's exact shape; none at attempts 1–2; at any attempt number in the recovery pass; the draft-prompt rendering; never twice; never beside any entry for the game (plain path and transaction); never counted as recorded (markers and legacy lines); the casual marker lands on the parent; written on the fresh window (another game's lesson survives).<br>**Fresh read:** a lesson landing during the call makes the attempt a success with no call metrics; the fresh read is the parent's; a fresh read that throws defers.<br>**Deferral:** a throwing marker write or lesson write defers; the recovery pass never defers.<br>**Floor:** 2 real gives no call, claim or flag, and one line; markers and blanks don't count; 3 real runs; it reads the window this game just joined; the casual floor reads the parent; the already-recorded path respects it. |
| `api/agent/reflect.sdkLayer.test.js` (new) | 3 | **The real SDK**, `fetch` stubbed, fake timers:<br>• the documented spend-cap 429 gives 3 fetches, then `http_429` / account-wide / not counted, with no writes;<br>• the org-set 400 gives 1 fetch, account-wide;<br>• a 529 counts and leaves a marker. |
| `api/cron/process-pending-reflections.accountWide.test.js` (new) | 13 | **The real cron and real reflect.js**, with the client's `create` faked using the SDK's real error classes.<br>**Six account-wide shapes** at attempt 3 over two ticks: the count unchanged, still pending, no marker. A plain 400 counts; past the backstop counts.<br>**The readout's sub-count** reconciles on real records.<br>**Markers:** exactly one at the third counted failure; a throw before the call waits one tick, then the marker; the recovery pass writes one when no lesson landed, none when one did. |
| `api/cron/process-pending-reflections.outcome.test.js` | +4, 1 changed (23) | **The refund**, across three ticks at attempt 3. Recovery after the account recovers. A deferral, then the recovery pass. A recovery pass asking to defer is finished. The ceiling pin uses `CONSOLIDATION_TIMEOUT_MS`. **Changed:** the third throw now waits for the recovery pass (WR-2). |
| `scripts/reflection-outcome-readout.test.js` | +1 (12) | The sub-count and the reconciliation. The rendered line changed. |
| `src/utils/evolutionTimeline.test.js`, `src/components/Dashboard/AgentRecordSheet.render.test.jsx` | +3 (16), +1 (6) | A marker renders the honest line, and never stands in for a real lesson of the same game. The literal is the shared one. The rendered sheet shows the marker's row. |

**Suites and gates:**
- **Linux, CI-shaped, `7ea1491e` (final code)** (WSL Ubuntu, a private clone, `TZ=UTC`, `npm run test:run -- --maxWorkers=2`): exit 0, **Test Files 946 passed | 7 skipped (953)**, **Tests 20,247 passed | 88 skipped**, 516 s. `origin/main` unchanged, so this is the merged tree CI tests.
- **`lint:gate`** on an LF snapshot of `7ea1491e`: exit 0, 2,860 files, 0 errors, 0 warnings. The snapshot was the mutation tree; every mutated file was compared byte-for-byte with the commit first.
- **`vite build`** ran on an LF archive of the exact pushed head before the push. A commit cannot carry its own build result, so the SHA and the result are in the PR description.
- **The rules suite** was not run: `firestore.rules` is unchanged.

## 9. Mutation check

Each mutant is an exact-string change, run one at a time against its rows on an LF snapshot, with the file restored after each.

| Round | Snapshot | Result | Notes |
|---|---|---|---|
| 1 | `feefc48e` | 66 of 68 killed (one of them by timeout) | Survivors **RF4**: the `!timedOut &&` guard on `accountWide` was equivalent, because our own deadline always settles the race with our own error, so the guard was removed. **RF7**: no row pinned "the recovery pass leaves a row at any attempt number"; a row was added. |
| 2 | `7ea1491e` (final code) | **77 of 77 killed** (one by timeout: removing the race leaves the "settles at the deadline" row waiting) | The round-1 set with stale strings updated, plus a mutant for every review fix (WR-2 ×2, WR-4, WR-6 ×3, WR-7, WR-9, WR-14) and one for the real-SDK rows. |

The reviewer ran its own 32 mutants on `68bdc17f` (27 killed). Its five survivors became WR-6 (three test gaps, fixed) and WR-7 (two no-behaviour-change mutants, now pinned).

## 10. Protected-store scanner and writer census

- **No new write site.** The marker goes through the two memory writers that already existed (`writeMemoryReflection` `agentRef.update`; `appendMemoryReflectionForwardTx` `tx.update`). The scanner's keys and counts for every touched file are identical to the allowlist at the base: `reflect.js` 5 keys, `process-pending-reflections.js` 1, `agentConsolidationApply.js` 4. This was listed directly from `scanProtectedStoreWrites` at the final code, not inferred from a green row.
- **The allowlist JSON is not in the diff.** `compositionProtectedStores.scan.test.js` passes 9/9.
- **The census tests.** `compositionWriterCensus.test.js` and `compositionDerivedWrites.census.test.js` pass.
- **WR-3.** The complete fix for this race would add a write site (a claim release), which is why it goes to you (§1, item 2).

---

## 11. Independent review (BUILD_RULES §2: 19 files / 1,970 lines changed at the code head, 1,841 added and 129 removed)

### 11.1 How it ran

**The reviewer.** One independent adversarial reviewer worked on its own LF `git archive` snapshot of `68bdc17f`, read-only on git and on the real checkouts. It was told to **refute** the fix along the prompt's five questions, plus six more lenses: wiring, test integrity, privacy, the numbers, display and the fence. It ran the real SDK against a stubbed `fetch`, built scratch rows, and ran 32 mutants. It restored its snapshot byte-exactly (a whole-tree SHA-256 manifest, before and after).

**The verifiers.** Each of its 14 findings then went to a **separate** verifier, each on its own snapshot, told to refute it with a concrete repro. All restored their snapshots byte-exactly. None made a model call or touched Firestore or the network.

**Shared side effect (disclosed).** Every `vitest` run rewrites vitest's own results cache under `node_modules/.vite` through the junction. It holds test timings, no source.

**Records.** The full reports are kept outside the tree, in the session scratchpad (`review-wr.md`, `verify-wr1.md` … `verify-wr14.md`). Finding ids are `WR-n`, distinct from part 1's `RV-n`.

### 11.2 The reviewer's answers to the five questions

| Question | Answer (after verification) |
|---|---|
| Can a failure line or a marker still reach a consolidation? | **No.** |
| Can a window below 3 still spend a milestone? | **Only by a race between two runs on the same agent** (WR-3; founder sign-off for the fix). |
| Can an account-wide outage still exhaust a game, or can any refusal loop forever? | **No** on the documented responses (WR-5 refuted). **No loop:** the backstop, the one-tick deferral and the always-finishing recovery pass bound everything. |
| Can a consolidation call still be left running? | **No.** The real SDK sends nothing after the abort. |
| Can a real lesson be hidden by a marker? | **No** at the final code. The three unpinned guards are now pinned (WR-6), and the plain path's rule matches the transaction (WR-9). |

### 11.3 Findings and dispositions

| WR | Finding (short) | Reviewer | Verifier verdict | Disposition |
|---|---|---|---|---|
| WR-1 | A below-floor turn stays open, so a later **tournament** reflection can run the rewrite (O6, one reading) | MAJOR | **PARTIAL**, MINOR: mechanism confirmed; base already allowed it (queue order, a failed turn); O6 holds on the cadence reading; the drafts' "never for tournament games" wording was false | **Founder question** (§1, item 1). Wording corrected. Gate ready (3 lines) if you choose the strict reading. |
| WR-2 | A third attempt that throws before its call finishes with no row | MINOR | **CONFIRMED**, MINOR | **Fixed** `7ea1491e`: it waits one tick for the recovery pass. 1 end-to-end row; part-1 row moved. |
| WR-3 | Floor read and milestone claim not atomic: two runs on one agent can spend a turn below the floor | MINOR | **CONFIRMED**, MINOR (defensible NOTE). The reviewer's in-transaction fix closes only one of two windows | **Founder sign-off** (§1, item 2): the full fix is a claim release, a new write site. Code comment states the limit. |
| WR-4 | An `ok` found by the fresh read kept the failed call's metrics | MINOR | **CONFIRMED**, NOTE: needs a concurrent writer | **Fixed**: no call metrics on that `ok`; a log line names the failed call; the comment names the real trigger. |
| WR-5 | SDK 429 retries with a long `retry-after` turn an account-wide refusal into a counted timeout | MINOR (assumed) | **REFUTED**: the docs say the spend-cap 429 never carries `retry-after`; on the documented response the real SDK settles in ≤ 1.5 s, account-wide, not counted | No change. The verifier's suggested permanent real-SDK guard was adopted (`reflect.sdkLayer.test.js`). |
| WR-6 | Three correct guards had no test (marker on the fresh window; floor and fresh read on the parent) | MINOR | **CONFIRMED** | **Fixed**: 3 rows, each killing its mutant. |
| WR-7 | Two surviving mutants; the deferral contract was unpinned | NOTE | **CONFIRMED**, NOTE: no observable behaviour change via the only caller | **Fixed**: 2 assertions/rows. |
| WR-8 | The end-to-end harness replaces `messages.create`; a comment claimed SDK retries | NOTE | **CONFIRMED**, MINOR: the loose call-count pin was not a guard | **Fixed**: the pin is `toBe(2)`, the header and comment are honest, and real-SDK rows were added. |
| WR-9 | On the plain path a legacy line for the game did not block the marker | NOTE | **CONFIRMED**, NOTE: unreachable in production | **Fixed**: any entry for the game blocks it, as in the transaction. 1 row. |
| WR-10 | A blank-lesson entry: "not a lesson" to the filter, an empty subtitle on the sheet | NOTE | **PARTIAL**, NOTE: never in production; the suggested fix would break part 1's ruled display line | **Comment only** (`memoryLessons.js`); display unchanged. |
| WR-11 | A failed or refused rewrite call still uses up its turn | NOTE | **CONFIRMED** as a founder question: pre-existing (Phase 0 §R3, part 1 §10), no ruling | **Founder question** (§1, item 5). |
| WR-12 | The numbers hold; the "5 s + 10 s" are estimates; growth unseen | NOTE | **CONFIRMED**, NOTE: an end-to-end run gives 95 s plus round trips; 120 s holds | Report (§3.3) and a production watch item (§1). |
| WR-13 | The fenced draft prompt renders an old failure line as a lesson | NOTE (out of scope) | **PARTIAL**, NOTE: true, but only in the deploy-time strategy call on legacy tiered deploys; the trading prompt renders no memory | Out of scope (fenced). §13. |
| WR-14 | Other account-level 400s count; 402 is included beyond O7's letter | NOTE | **PARTIAL**, NOTE: a founder question, not a defect | **Founder note** (§1, item 3). Rows for a non-JSON 401/404 were added. |

**Split:** CONFIRMED 9 (WR-2, 3, 4, 6, 7, 8, 9, 11, 12), PARTIAL 4 (WR-1, 10, 13, 14), REFUTED 1 (WR-5). No BLOCKER.

**Corrections the verifiers made to the reviewer:**
- WR-1: the base comparison was overstated.
- WR-2: O9 has no list of throw sites.
- WR-3: the suggested fix was partial.
- WR-4: the trigger is a concurrent writer, not an ambiguous write.
- WR-7 and WR-14: several citations were offset.

### 11.4 After the fixes

The verification chain restarted on the final code `7ea1491e`:
- mutation round 2 (§9);
- the scanner keys, listed directly;
- `lint:gate`;
- `git fetch`;
- the CI-shaped Linux suite (§8);
- `vite build` on the exact pushed head (§8).

---

## 12. Production check, stated plainly

- **Crons do not run on Vercel preview** (BUILD_RULES §6). Nothing in this build can be seen working there.
- **The account-wide and marker paths** are proved by the tests (§8). After merge, confirm them with the readout's "waiting on the account" sub-count and, on the record sheet, a *No lesson was recorded for this game.* row under any game that finishes without a lesson.
- **A real consolidation** happens only on an agent's fifth (tenth, …) game against the CPU, or later at that count (§1, item 1), and only with 3 real lessons in its window. §1 says how to recognise one in the shadow line (`shadow/agent_consolidation/…`) and on the record sheet. Only one distinct window reaches 3 today, so the first real rewrite may take a while.
- **The smoke preview** (top of this report) shows the record sheet. No production agent holds a marker yet, so it can show only the legacy line on agents that have one. The marker's row is proved by the render test.

## 13. Out of scope, noticed (for separate tasking)

- **The fenced draft prompt shows old failure lines as lessons** (WR-13): `Game (Win +x): Reflection generation failed.` plus `→ Adjustment: N/A`. It reaches only the deploy-time strategy call on legacy tiered deploys (`decide.js:419`), and clears itself as windows roll. The fix is one line in a fenced file. That `formatMemory` also prints a draw as `Loss`.
- **A wider pre-existing lost update** (verifiers WR-3 and WR-6): the plain lesson write uses the window read at the start of the attempt, about 35 s earlier, as its base (`reflect.js:184`, written at `:214`; the same at the base, `d5d8fa9b:api/agent/reflect.js:370`). A marker or lesson written by an overlapping run during the call is overwritten. The window is much wider than WR-3's.
- **The cron accepts any caller-supplied `x-vercel-cron: 1` header** (verifier WR-3; already flagged as F04 by the 2026-09-20 security audit). It is unchanged here.
- **The discipline arrays have no cap.** The consolidation answer grows with them toward the 60 s budget (WR-12).
- **Carried from part 1:** an always-throwing claim (RV-10); `gameDesignCategoryConfig.js` has no importer; a stale anchor at `src/config/featureFlags.js:2764`; and `REFLECTION_WRITER_INVESTIGATION_V2.md` is still not in `docs/`.

---

**Branch:** `claude/reflection-outage-fix-2` · **Code head:** `7ea1491e` · **Report:** `docs/audits/20261014_BUILD_REFLECTION_OUTAGE_FIX_2.md` · **Model spend:** $0.1473 (4 of 4 calls; nothing written back).
