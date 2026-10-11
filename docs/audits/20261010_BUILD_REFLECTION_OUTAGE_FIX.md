# Build — Reflection outage fix (package P-OUT-1)

**Smoke preview (the one display line):** https://trade-seven-nn5dl0qps-fais-projects-bc179554.vercel.app (Vercel Preview, deployment state `success`; the served main bundle contains "No lesson was recorded for this game.") — branch `claude/reflection-outage-fix-smoke` at `3f6cae55`, the code head itself (no flag, no fixture). The line shows on any agent whose record sheet holds an old failure entry; 19 agents held one at the Phase 0 census.

**Date:** 10 Oct 2026 · **Session:** Claude Code (Opus 5.5) · **Branch:** `claude/reflection-outage-fix` (the app's worktree branch `claude/reflection-outage-fix-7cb2e2`, pushed by refspec) · **Base:** `origin/main` = `a06c2a75` (the #951 merge) · **Code head:** `3f6cae55` · **Head:** this report's commit (recorded in the PR) · **PR:** the draft PR whose head is `claude/reflection-outage-fix` (not merged; CI not watched) · **Prompt:** Fable, 10 Oct 2026, "Build — Reflection outage fix (package P-OUT-1)"; founder rulings O1–O4 adopted by Flash, 10 Oct 2026 ("yes to all").
**Rests on:** `docs/audits/20261010_PHASE0_REFLECTION_OUTAGE_ROOT_CAUSE.md` (R1, R2, R3, R6(a)), merged into this branch from `claude/reflection-outage-phase0` (`656a9cbb`).

Every `file:line` below was read at the code head `3f6cae55` in this session (VERIFIED) unless marked ASSUMED. No player or agent text and no uid, agent id or battle id appears in this report.

---

## 1. In plain terms

**What was wrong.** After every finished game the agent writes a short lesson about how it played. That request was given 30 seconds, and a tournament game's answer took 32 to 39 seconds, so the clock always won. The code then saved the words *Reflection generation failed.* as if they were the lesson, marked the game as done, and never tried again. The request itself kept running and was paid for.

**What changed.**
- **The request is smaller.** The agent is no longer also asked to fill in a nine-part questionnaire about the game's design. Nothing in the product ever read those answers. The questionnaires already collected are kept, and nothing new is added to them (ruling O1).
- **The request now fits its time.** Six real, already-finished tournament games were re-sent with the smaller request. Every answer came back complete, in 11 to 21 seconds (it used to take 32 to 39), and the longest answer was 1,031 tokens (it used to reach 1,945). From those measurements, the time limit is now **35 seconds**, which is 1.7 times the slowest call, and the length limit is **4,096 tokens**, 4 times the longest answer. When the time limit is reached, the request is now cancelled rather than left running (ruling O2).
- **A failure is never saved as a lesson.** If the request fails, nothing is written to the agent: no lesson, and nothing for the "wisdom" paragraph to learn from. An answer that was refused or cut off counts as a failure too. The game stays in the queue and is tried again on the next run of the 15-minute job, up to **three attempts**. After the third failure the game is marked "no lesson" and leaves the queue (ruling O3).
- **Every attempt now records why it failed.** The game's record holds:
  - ok or failed;
  - a reason from a fixed list: out of time, cut off at the length limit, no completed answer, a missing part, a server error with its number, a connection error, or unknown;
  - how long it took, how much it wrote, which model, and which attempt it was.

  A small read-only script prints those counts by reason and by day (ruling O4).
- **One line on the record sheet.** Where an old game still shows *Reflection generation failed.* under it, the timeline now says **No lesson was recorded for this game.** Nothing else on the sheet changes. The "Strategic insight" paragraph is shown exactly as before.

**What players will see.** New games get a real lesson under them, usually within 15 minutes of finishing, as before. If a lesson cannot be written after three tries, the game shows no lesson. It never shows a fake one. Old games that already show the failure line now read *No lesson was recorded for this game.* The "Strategic insight" paragraphs already built from failures are unchanged; resetting them is a separate step (ruling 2).

**One trade-off to know.** The job runs every 15 minutes from 13:00 to 00:59 UTC, which is 48 runs a day. A run starts a second lesson only if a full 35-second request still fits before the job's other work. A normal lesson takes 11 to 21 seconds, so in practice each run writes **one lesson, about 48 a day**. Recent weeks completed about 20 a week. If a league close finishes more than about 20 games at once, the rest get their lessons the next afternoon, because the job is idle from 01:00 to 12:59 UTC. The job's other work (the news-wire catch-up, the calls sweep, the hypothesis review) keeps its time on every run but one kind: a run whose lesson lands on a five-game milestone and starts the 30-second "wisdom" consolidation. That never happens for tournament games.

**Three things for you to decide or sign.**
1. **Sign-off: one scanner allowlist entry.** The attempt claim writes to the battle record inside a transaction, and the repo's write scanner asks a human to approve every such write (§8).
2. **Noted: the job's time ceiling went from 60 to 120 seconds,** so the rare lesson-plus-consolidation run can't be cut off mid-write (§3.3). This is the "raise the cron's duration ceiling" case the prompt names.
3. **A question (review finding RV-9).** If the whole account is refused for a while (the 8 October spending-limit day, or the June model retirement), every queued game uses its three attempts within 45 minutes and is finished without a lesson. That follows ruling O3 as written. If you want those games to survive a short outage, the options are to spread the attempts out in time, or not to count account-level refusals (`http_400` / `401` / `403` / `404`) against the three. Either changes O3, so I did not do it.

**How to confirm it in production.** Crons do not run on Vercel preview, so this fix cannot be seen working there. It is confirmed by the first battles that complete after the merge. A day later, run, from the main checkout:

```
node scripts/reflection-outcome-readout.mjs --from <merge day> --to <next day>
```

Expect mostly `ok`, a slowest successful call well under 35 s, and an empty or small "Failed, by class" list. The record sheet of an agent that played should show a real lesson under the new game.

---

## 2. Gate facts (BUILD_RULES §2 / §3)

- `git fetch origin` ran first. `origin/main` = `a06c2a75`; `origin/claude/reflection-outage-phase0` = `656a9cbb`. Re-fetched before the final checks: `origin/main` was still `a06c2a75`, so the branch already contained it and no merge was needed (§9.3).
- The app made a worktree branch `claude/reflection-outage-fix-7cb2e2` at `a06c2a75` = `origin/main` (cut fresh by construction). It is pushed as `claude/reflection-outage-fix` by refspec.
- **Setup step 2:** `git diff --name-status HEAD...origin/claude/reflection-outage-phase0` listed three paths, all under `docs/` (`docs/README.md`, the Phase 0 report, the ruling sheet). Merged as `e52dbb39` (`--no-ff`). No STOP.
- **Fence:** no file in the BUILD_RULES §1 list is edited. Fenced functions *called*: none newly. `flattenPortfolioServer` (`agentScoring.js`) was called only by the removed feedback writer; its import is gone from `reflect.js`. `agentReflectionUtils.js` keeps its pre-existing import.
- **Cron count:** unchanged at 43 (`vercel.json`); no schedule edited.
- **Model spend:** 6 calls of the 6 allowed, **$0.1452** at list price (22,785 input / 5,124 output tokens, `claude-sonnet-4-6` at $3 / $15 per million), nothing written back (§3). The reviewers made no model calls.
- **Firestore:** read-only for the measurement (`.collection / .doc / .get` only). The script was gated in the same shell command on the growth replay's §7 proof grep `\.(set|update|delete|add|create)\s*\(|runTransaction|\.batch\(|bulkWriter|writeBatch|FieldValue|recursiveDelete` → **no matches (exit 1)**. Credentials came from the primary checkout's `.env.local` and were never printed. Run window: 2026-10-11 03:26–03:28 UTC (the evening of 10 Oct in the US).

---

## 3. The numbers, and why

### 3.1 Measurements (ruling O2)

The new request is the worktree's `agentReflectionUtils.js` with the questionnaire removed; the script refuses to run if the tool schema still carries it. It was sent for six completed tournament battles: the five largest of the 40 most recent battles behind a failed reflection (most hypotheses in the prompt, then the longest prompt), plus the smallest as a floor. The production request shape was used unchanged (`claude-sonnet-4-6`, temperature 0.3, thinking disabled, effort low, forced `submit_reflection`), except `max_tokens: 4096`, so the true answer size was measured uncut. Measured from a home machine, so the times include client network and TLS overhead.

| # | Completed | Evaluations | Hypotheses in prompt | User prompt chars | Elapsed | Input / output tokens | `stop_reason` | Grades | Cost |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-10-06 | 18 | **10** | 9,363 | 20.5 s | 4,155 / **1,031** | `tool_use` | 10 | $0.028 |
| 2 | 2026-10-07 | 18 | 9 | 8,426 | 19.2 s | 3,884 / 966 | `tool_use` | 10 | $0.026 |
| 3 | 2026-08-27 | 23 | 9 | 8,210 | 14.5 s | 3,818 / 724 | `tool_use` | 7 | $0.022 |
| 4 | 2026-09-15 | 14 | 9 | 8,157 | 18.6 s | 3,792 / 947 | `tool_use` | 9 | $0.026 |
| 5 | 2026-09-01 | 18 | 9 | 8,104 | **20.6 s** | 3,701 / 993 | `tool_use` | 9 | $0.026 |
| 6 (floor) | 2026-10-08 | 17 | 3 | 7,215 | 11.0 s | 3,435 / 463 | `tool_use` | 3 | $0.017 |

All six were valid: one tool call, a non-empty lesson, `stop_reason: tool_use`. Hypothesis counts across the pool of 40:

| Hypotheses | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|
| Battles | 1 | 2 | 1 | 1 | 5 | 21 | 8 | 1 |

The Phase 0 reproductions of the old request on the same kind of battle took 32.2–39.5 s for 1,400–1,945 output tokens (Phase 0 §R1). A reflection now also costs about half as much: $0.017–$0.028, against $0.034–$0.043.

### 3.2 The chosen values

| Value | Rule (prompt) | Measured | Chosen | Where |
|---|---|---|---|---|
| Deadline | ≥ 1.5 × the slowest call | 20.6 s → ≥ 30.9 s | **35 s** (1.7×) | `api/_utils/reflectionOutcome.js:20` |
| Token ceiling | ≥ 2 × the largest answer | 1,031 → ≥ 2,062 | **4,096** (4.0×) | `api/_utils/reflectionOutcome.js:21` |
| Attempts | three (O3) | — | **3** | `api/_utils/reflectionOutcome.js:24` |

Why 35 s and not more: the deadline must leave the cron's other tenants their time (§3.3). At 35 s, a reflection that runs its full deadline ends by about 38 s. That leaves the Wire sweep 12 s of its 50 s budget, and leaves the call sweep and review pass inside their caps. At 40 s the call sweep would be left about 2.7 s, barely above its 2 s starvation floor.

The ceiling cannot bind before the deadline. At the measured ~50 tokens a second, 35 s writes about 1,750 tokens, which is under 4,096. A runaway answer is therefore named `timeout`.

### 3.3 The cron's budget (`api/cron/process-pending-reflections.js`)

- **The tenants and their clocks (unchanged).** Neither of the two handler-anchored caps was moved. Both are pinned by review L5-3 (`process-pending-reflections.hypothesisReview.test.js:120`), so the reflections had to fit in front of them.

  | Tenant | Runs when | Starvation floor | Anchors |
  |---|---|---|---|
  | Wire sweep | `TIME_BUDGET_MS − elapsed > 5 s` | 5 s | `:57`, `:197-198` |
  | Editorial (Sundays) | 20 s of that budget remain | 20 s | — |
  | Call sweep | deadline `min(now + 20 s, handlerStart + 45 s)` | 2 s | `api/_utils/callRecords/sweep.js:70-72`, `:86-88` |
  | Review pass | deadline `min(now + 8 s, handlerStart + 50 s)` | 1.5 s | `api/_utils/hypothesisRecords/reviewPass.js:54-57`, `:81-83` |

- **The start rule (new).** A reflection starts only if `elapsed + 35 s + 3 s` ends by `REFLECTION_PHASE_MS = 40 s`. The first reflection of a tick always starts, so the queue always moves (`:66-67`, `:107`). The old rule started reflections until 50 s had passed, so a reflection begun at 49 s could run to 79 s, past the 60 s ceiling.
- **The ceiling.** `maxDuration` 60 → **120 s** (`:54`); the tenants' budget is unchanged. The ceiling is raised for one path: a reflection at its full 35 s that lands on a five-game milestone then runs its own consolidation call, raced against 30 s (`agentConsolidationApply.js:17`, `:338-354`). That is about 70 s in the worst case, which a 60 s ceiling would kill mid-write. **Raised; flagged here as the prompt asks.**
- **Throughput.** The schedule gives 48 ticks a day (`vercel.json:201-202`, hours 13–00 UTC). With one full-length reflection per tick, capacity is about 48 reflections a day. A second one runs in the same tick only when the first ended within 2 s (a skip or a fast error).

---

## 4. What changed, by file (VERIFIED at `3f6cae55`)

| File | Change |
|---|---|
| `api/_utils/agentReflectionUtils.js` | **Schema:** keeps only `selfReflection`, byte-identical (`:17-61`; `required: ['selfReflection']` at `:23`).<br>**System prompt:** a single self-reflection pass (`:174-181`).<br>**User message:** drops the questionnaire instructions and the category lookup, and ends at the self-reflection instructions (`:267-283`).<br>**Imports:** the now-unused `gameDesignCategoryConfig.js` import is removed. |
| `api/_utils/reflectionOutcome.js` (new) | The measured numbers and the attempt cap (`:20-24`).<br>The fixed vocabulary (`:27-29`).<br>`classifyReflectionError` (`:41-47`): our own deadline flag first, then the SDK's `APIConnectionTimeoutError` / `APIConnectionError` / `APIError.status`.<br>`errorNameOf`: the class name, never the message.<br>`buildReflectionOutcome` (`:66-80`): exactly the nine ruled fields, never `undefined`; `model: null` when no call was made.<br>`reflectionBattleUpdate` (`:92-106`): what the cron writes after an attempt. |
| `api/agent/reflect.js` | **Contract:** `generateReflection(db, battleId, { attempt, modelCall })` returns `{ outcome: 'ok' \| 'failed', record }` or `{ outcome: 'skipped', reason }` (`:71`; skips at `:79`, `:85`, `:93`). The fallback lesson is gone.<br>**Already recorded:** a game whose lesson is already in the learning target's window is an `ok` attempt with no call and no shadow line, and the consolidation gate still runs (`:124-128`, `:242`).<br>**Recovery pass:** `modelCall: false` never calls; with no lesson recorded it returns failed/`unknown` (`:129-133`).<br>**Failure path:** a failure writes nothing and returns before the consolidation gate (`:184-187`). A memory write that throws is a failed attempt of class `unknown` (`:143-154`).<br>**Shadow line:** mirrors the record, and carries the lesson only on a success (`:167-182`).<br>**The call:** `callSonnetReflection` never throws (`:265-338`). The deadline rejects the race, then aborts the request (`:276-281`; signal passed at `:296`).<br>**Order of checks:** `stop_reason: max_tokens` is a named failure (`:312-314`); any other non-`tool_use` stop reason is `no_tool_use` (`:320-322`); a missing tool block is `no_tool_use` (`:325-328`); a missing or blank lesson is `missing_keys` (`:330-335`).<br>**Removed:** `writeGameDesignFeedback` and its imports. |
| `api/cron/process-pending-reflections.js` | **The claim** (`:129-140`) is one transaction per battle, before the call:<br>• re-checks the flag;<br>• respects an unexpired lease → `busy`;<br>• then makes ONE `tx.update` (`:137-139`): `reflectionAttempts + 1` plus `reflectionLeaseUntil = now + 150 s`, or, when three attempts are already spent, the lease alone for a no-call recovery pass.<br>**Then:** the call with the claimed attempt (`:148-150`), and the outcome write that clears the lease (`:156-157`).<br>**A throw:** a throw from the reflection itself records failed/`unknown`, best effort (`:175-183`). A throw from the outcome write never does.<br>**Also:** the start rule, the ceiling and the lease constant (`:54`, `:66-70`, `:107`). The stale "fallback is desired" comment is replaced.<br>**Response keys** are unchanged: busy counts as `skipped`, a cap-out as `failed`. |
| `api/_utils/compositionProtectedStoresAllowlist.json` | `api/cron/process-pending-reflections.js::handler::update::unresolved: 1`, plus a `_notes_reflection_outage_fix` note. **Founder sign-off requested** (§8). |
| `src/utils/evolutionTimeline.js` | `LEGACY_REFLECTION_FAILURE_LESSON` and `NO_LESSON_RECORDED_LINE` (`:25-26`). A game row whose lesson is exactly the legacy literal shows the new line (`:158`). Only the record sheet renders subtitles; the preview card shows titles only (`EvolutionPreviewCard.jsx:22`, `:45`). |
| `scripts/reflection-outcome-readout.mjs` (new) | The read-only readout (§5). |
| Tests | Four new files, two extended display suites, and two updated host suites (§7). |

**Not changed:**
- `firestore.rules`: the owner's battle-update allowlist (`firestore.rules:456-459`) does not name the new fields, so only the server writes them.
- `firestore.indexes.json`: the `gameDesignFeedback` indexes stay.
- The `gameDesignFeedback` collection and its documents.
- `shadowLogger.js`: its line shape is whatever the caller passes.
- The consolidation driver and its locked template.
- `buildMemoryEntry` (`reflect.js:348-365`).

---

## 5. The outcome record and the readout (ruling O4)

**On the battle,** for the latest attempt:
- `reflectionOutcome = { outcome, failureClass, errorName, elapsedMs, stopReason, usage: { input_tokens, output_tokens }, model, attempt, at }`;
- `reflectionAttempts`: the claimed attempts;
- `reflectionNoLesson: true` once three are spent with no lesson;
- `reflectionLeaseUntil`: the claim lease, `null` after the outcome write.

A success keeps the old `pendingReflection: false` + `reflectedAt` stamp. A skip (battle or agent gone) keeps the old flag-clear with no record. An attempt that made no call (lesson already recorded, recovery pass) has `elapsedMs`, `stopReason`, `usage` and `model` all `null`. No field carries player or agent text: `errorName` is a class name (`RateLimitError`, `ReflectionDeadlineError`, `FirebaseError`), never a message. Earlier attempts of a battle are in the shadow line. O4 asks the battle for the latest attempt only (see RV-6(b) in §9).

**In the shadow line** (`shadow/reflections/…`, unchanged delivery): the same nine fields are spread onto the existing line; `selfReflection` is `null` on a failure; the always-null `gameDesignFeedback` key is gone.

**The readout** (`scripts/reflection-outcome-readout.mjs`):
- **The query:** one Firestore query, `agentBattles where status == completed`, selecting only `reflectionOutcome`, `reflectionNoLesson` and `pendingReflection`. It is a single-field filter, so no new index is needed.
- **What it counts:** each battle's latest attempt whose `at` falls in the UTC day range — ok / failed; failed by class; failed split into finished-without-a-lesson, still retrying and ended otherwise, so the total reconciles; latest attempt number; by day; the slowest successful call; the largest answer.
- **What it prints:** no id.
- **Read-only discipline:** it follows the growth replay's §7 discipline. The test runs the write-call grep over the file and walks its syntax tree to pin every member call to a read-only allowlist. Credentials load only inside `main()`.

---

## 6. Failure handling, as built (ruling O3)

| Situation | Memory entry | Consolidation gate | Battle afterwards |
|---|---|---|---|
| Success (attempt 1, 2 or 3) | written, exactly as before | runs, exactly as before | flag cleared, `reflectedAt`, outcome `ok` |
| Failure, attempt 1 or 2 (any class, incl. a refused or cut-off answer) | **none** | **not run** | flag **still set**, attempts +1, outcome `failed` + class; the next tick retries |
| Failure, attempt 3 | **none** | **not run** | flag cleared, `reflectionNoLesson: true`, outcome `failed` + class |
| An unexpected throw from the reflection | none | not run | flag still set, attempt counted, outcome `failed` / `unknown` with the error's class; at attempt 3 the battle finishes without a lesson at once |
| The run dies inside an attempt | none | not run | the attempt was claimed before the call; the lease expires before the next tick; after three claims the next tick runs a **no-call recovery pass**: a lesson that did land → cleared as `ok`; none → `reflectionNoLesson` with a `failed` / `unknown` record |
| Memory write throws after a valid answer | none landed (or it did, see the next row) | not run | outcome `failed`, class `unknown`; retried |
| A success whose battle write was lost, or a memory write that committed but reported an error | written | runs on the retry | the next attempt finds the lesson in the window: `ok` with no call, the consolidation gate runs (the milestone claim keeps it to one run) |
| Two overlapping runs (a manual run during a tick) | at most one | — | the second finds the claim's lease and leaves the battle alone (`skipped`) |

**Casual clones:** the same function, so the same rules. A failure writes neither the parent nor the clone. A success lands in the parent's window through the existing transactional forward (`reflect.js:143-150`, `:382-389`). The already-recorded check reads the parent's window, where the lesson lands.

---

## 7. Tests

| File | Rows | What they pin |
|---|---|---|
| `api/agent/reflect.generateReflection.test.js` (new) | 32 | The SDK is mocked with its real error classes.<br>**Timeout:** the abort fires exactly at the deadline, not 1 ms before; it settles on time even when the SDK ignores the abort.<br>**`max_tokens`:** never parsed, even with a lesson in the partial input.<br>**Foreign stop reasons:** `refusal` / `end_turn` / `pause_turn` / context cut, each with a valid-looking tool block → `no_tool_use`, never saved.<br>**Other failure classes:** `no_tool_use`; `missing_keys` ×4; `http_529` / `http_429` / `connection` / `unknown` with their class names.<br>**Failure side effects:** a failure at a milestone runs no consolidation and burns no milestone; a memory-write throw is a failed attempt.<br>**Valid answer:** writes the identical entry into the rolling window, records `ok`, and writes no feedback document even when the model returns one.<br>**Request shape:** ceiling, signal and tool; the selfReflection schema pinned deep-equal to the original; no prompt asks for a design evaluation.<br>**Already recorded:** no call, no write, no shadow line; an ambiguous memory write still consolidates on the retry; a casual retry checks the parent.<br>**Recovery pass:** never calls.<br>**Casual forward:** on failure and on success. **Skips.** |
| `api/cron/process-pending-reflections.outcome.test.js` (new) | 19 | **Retry and cap:** a failure leaves the flag and raises the count; the third failure marks and clears, and a fourth tick never calls; a success clears, and after a failure it is attempt 2.<br>**Odd results:** a skip; a malformed result.<br>**Throws:** a throw is recorded and bounded; a throw from the outcome write after an ok never records a failure.<br>**Recovery pass:** with a missing lesson and with a landed lesson.<br>**Lease:** overlap makes one call and the success stands; live vs expired lease; lease > ceiling.<br>**One full-deadline reflection:** the only one that tick; the Wire sweep runs and replays its story; the call sweep and review pass are handed slices above their floors.<br>**Start-rule timing:** a 10 s first → no second start; 3 s → none; 1.5 s → a second starts; the ceiling covers the worst path; a slow (cold-start) queue read still starts the first; fast reflections share a tick. |
| `api/_utils/reflectionOutcome.test.js` (new) | 12 | The numbers against the measured rule; the vocabulary; the classifier; error names; the record's exact keys; the battle update for each outcome. |
| `scripts/reflection-outcome-readout.test.js` (new) | 11 | The counts; the reconciling failed split; the inclusive range; no id in the output or the JSON; the reader's query; the §7 grep; the AST allowlist; lazy credentials. |
| `src/utils/evolutionTimeline.test.js` | +4 (13) | The legacy line renders the new copy; a real lesson is unchanged; only the exact literal is replaced. |
| `src/components/Dashboard/AgentRecordSheet.render.test.jsx` | +2 (5) | The rendered sheet shows the new line and never the failure line; a real lesson and the Strategic insight paragraph render as stored. |
| `process-pending-reflections.test.js`, `.hypothesisReview.test.js` | mocks | The `generateReflection` mocks now return an `ok` result, because the host reads the outcome. One call-argument pin gains `{ attempt: 1 }`. No assertion was loosened. |

**Mutation check.** Each mutant ran one at a time against its rows, on an LF snapshot.

| Round | Snapshot | Result | Notes |
|---|---|---|---|
| 1 | `a2e054bf` | 25 of 25 KILLED | — |
| 2 | `3f6cae55` (final code) | 38 of 39 KILLED | Two kills were by timeout: removing the race, and ignoring the lease (the overlapping run waits). |

The single survivor is **removing `clearTimeout`, an equivalent mutant**. `Promise.race` already absorbs the late rejection, and the fired timer only aborts a finished request; both reviewers ran it and judged it harmless.

The 39 cover:
- every round-1 defect;
- the reviewer's survivors: phase 40 → 70 s, write reserve 3 s → 0, `maxDuration` 120 → 60, and the already-recorded check on the clone;
- a foreign stop reason parsed;
- the already-recorded path skipping the consolidation gate;
- `modelCall` ignored;
- the throw-record guard dropped, and the throw record removed;
- the recovery pass calling the model;
- the lease ignored, and the lease not cleared;
- the readout's ended-otherwise bucket dropped.

**Suites and gates:**
- **Linux, CI-shaped, `a2e054bf`** (WSL Ubuntu, private clone, `TZ=UTC`, `npm run test:run -- --maxWorkers=2`): exit 0, **Test Files 935 passed | 7 skipped (942)**, **Tests 19,978 passed | 88 skipped**, 334 s.
- **Linux, CI-shaped, `3f6cae55` (final code):** exit 0, **Test Files 935 passed | 7 skipped (942)**, **Tests 19,995 passed | 88 skipped**, 331 s (`origin/main` unchanged at `a06c2a75`, so this is also the merged tree CI tests).
- **`lint:gate`** on LF snapshots of `a2e054bf` and `3f6cae55`: exit 0, 2,838 files, 0 errors, 0 warnings; every changed file linted.
- **`vite build`** ran on an LF archive of the exact pushed head before the push. A commit cannot carry its own build result, so the SHA and the result are in the PR description.
- **Rules suite:** not run. `firestore.rules` is unchanged.
- **A CRLF-only row:** `api/_utils/intradayPromptExclusions.test.js` "the anticipation note reads only evalId and timestamp" fails in this Windows CRLF worktree and passes on the LF snapshot and on Linux. It is a source-text regex over `voiceLayerAnticipation.js`, which this build does not touch.

---

## 8. Protected-store scanner and writer census

- **The new key.** `compositionProtectedStores.scan.test.js` flagged `api/cron/process-pending-reflections.js::handler::update::unresolved`: the claim transaction's `tx.update(battleRef, …)`. The scanner never resolves a transaction-handle write's target (`compositionProtectedStoresScan.js:294-298`: once the handle is "shaped", the argument is not consulted), so every `tx.update` is listed by hand. The target is `agentBattles/{battleId}`, not a protected store.
- **Its count.** The count is **1**: one write in the claim, carrying the attempt and the lease, or the lease alone for a spent battle. It was 2 before the review round merged the claim's two branches into one update. Listed with a human-review note. **FOUNDER SIGN-OFF REQUESTED.**
- **Writes that need no listing.** The outcome write and the throw-record write (`battleRef.update(…)`) resolve to `agentBattles` and need no listing. `reflect.js`'s keys are unchanged: `generateReflection::update::agents` stays at 1, the `pendingConsolidation` write (`:219`), because the consolidation gate stays inline. The removed `gameDesignFeedback` `.add` was never listed (not a protected store).
- **The census tests.** `compositionWriterCensus.test.js` and `compositionDerivedWrites.census.test.js` pass. Neither covers these files: there are no agent-settings or composition writes here.

---

## 9. Independent review (BUILD_RULES §2: at threshold, 18 files / 2,052 lines)

### 9.1 How it ran

**Reviewer RV1.** One independent reviewer, as the prompt asks. It worked on its own LF `git archive` snapshot of `a2e054bf` (`node_modules` as a junction), read-only on git and on the real checkouts. It was instructed to refute the fix along eight lenses: the prompt's four questions (a failure saved as a lesson, an endless loop, a call left running, a lost success), then the budget and tenants, test integrity, privacy and read-only proof, and the display. It ran the real SDK with `fetch` stubbed, wrote scratch rows, and ran its own mutants.

**Verifier VF1.** Under §2, every finding then went to an independent verifier on a separate snapshot, instructed to refute each with a concrete repro.

Neither made a model call or touched Firestore. Both restored their snapshots byte-exactly (`sha256sum -c`) and deleted their scratch files. The full reports are kept outside the tree, in the session scratchpad (`review-rv1.md`, `verify-vf1.md`).

### 9.2 Findings and dispositions

| RV | Finding (short) | RV1 | VF1 verdict | Disposition |
|---|---|---|---|---|
| RV-1 | A non-`max_tokens` stop reason (refusal, end_turn, pause_turn) with a tool block was parsed, so a refused or cut-off lesson could be saved | MAJOR | **CONFIRMED** at code level, MINOR: only `refusal` is reachable with this request | **Fixed** `0d6fd62a`: only `stop_reason: tool_use` is parsed; anything else is `no_tool_use` with the stop reason on the record (`reflect.js:320-322`), inside the O4 vocabulary. 4 rows; mutant M26 killed. |
| RV-2 | The budget rows could not fail under the starvation they describe (phase / reserve / ceiling mutants survived) | MAJOR | **PARTIAL**, MINOR: phase mutant reproduced; no production defect | **Fixed** `0d6fd62a`: 10 s / 3 s / 1.5 s rows and a ceiling pin. M33 / M34 / M35 killed. VF1's correction applied: the 3 s row pins the reserve, the 1.5 s row is the boundary. |
| RV-3 | The start rule makes the batch 1 per tick: about 48 a day | MINOR | **PARTIAL**, NOTE: true, already disclosed | **Disclosed** (§1, §3.3); the `BATCH_LIMIT` comment now says what the rule does. Founder awareness. |
| RV-4 | A spent battle was marked `reflectionNoLesson` even when attempt 3's lesson had landed | MINOR | **CONFIRMED**, MINOR; also made the old §6 row false for attempt 3 | **Fixed** `0d6fd62a`: the no-call recovery pass (`modelCall: false`) looks for the lesson first. 2 rows; M31 / M28 killed. |
| RV-5 | The claim was a counter, not a lease: overlapping runs both called and could write contradicting end states | MINOR | **CONFIRMED** (mechanism), MINOR: overlap needs a manual run during a tick | **Fixed** `3f6cae55`: a 150 s claim lease in the same single `tx.update`, cleared by the outcome write. 3 rows; M36 / M37 killed. |
| RV-6 | Record gaps: (a) a throw or exhaustion left no record; (b) only the latest attempt is kept; (c) a skip after a failure left a stale record; (d) the readout's failed split did not add up | MINOR | **PARTIAL**: (a)(c)(d) CONFIRMED; **(b) REFUTED**: O4 asks for the latest attempt on the battle, and the shadow line holds every attempt | (a)(c)(d) **fixed** `0d6fd62a`: throw record, recovery-pass record, already-recorded = `ok`, an "ended otherwise" bucket. M29 / M30 / M38 killed. (b) no change, as ruled. |
| RV-7 | An ambiguous memory write (committed, reported failed) lost the milestone consolidation on the retry | MINOR | **CONFIRMED**, NOTE: never reached by tournament battles | **Fixed** `0d6fd62a`: the already-recorded path runs the consolidation gate. 1 row; M27 killed. |
| RV-8 | Mutation survivors: the already-recorded check on the clone; no `clearTimeout` | NOTE | **CONFIRMED**; `clearTimeout` harmless | **Fixed**: a casual-retry row (M32 killed). `clearTimeout` survives as an equivalent mutant (§7). |
| RV-9 | Instant account-level failures (`http_400` / `401` / `404`) burn all three attempts in 45 minutes | NOTE | **CONFIRMED**, NOTE: follows O3 as ruled | **Founder question** (§1). Not changed. |
| RV-10 | A claim transaction that always throws is never counted and can block the queue head | NOTE | **CONFIRMED** (mechanism), NOTE: no realistic cause found, no model spend | Separate task, if ever. Listed in §10. |
| RV-11 | The consolidation call still races 30 s with no abort / no `clearTimeout` / no `stop_reason` | NOTE | **CONFIRMED**, out of scope as ruled | §10 (P-OUT-2). |
| RV-12 | Legacy failure text still reaches the model: the Consolidated Insight line in the reflection prompt; consolidation windows | NOTE | **CONFIRMED** with one refinement: memory lessons are not rendered in the reflection prompt, only the paragraph is | §10 (P-OUT-2 / P-RESET). |

**Split:** 9 CONFIRMED, 3 PARTIAL, 1 part REFUTED (RV-6(b)). Nothing was blocking.

VF1 also noted two report errors, both corrected here: the claim that the tenants keep their time on every run was overstated (a consolidation run can take it), and §7's earlier row count was wrong. VF1 further noted that the cron's auth guard accepts a caller-supplied `x-vercel-cron: 1` header. That is pre-existing, already flagged as F04 by the 2026-09-20 security audit, and unchanged here.

### 9.3 After the fixes

The verification chain restarted on the final code `3f6cae55`:
- mutation round 2 (§7);
- the scanner, at count 1;
- `lint:gate`;
- `git fetch`: `origin/main` was unchanged at `a06c2a75`;
- the CI-shaped Linux suite (§7);
- `vite build` on the exact pushed head (§7).

---

## 10. Out of scope, noticed (for separate tasking)

- **The consolidation call has the outage's shape** (RV-11). `agentConsolidationApply.js:338-354` races Sonnet against 30 s with no abort signal, so a timed-out consolidation is left running and billed. The milestone claim (`reflect.js:213-215`) and `pendingConsolidation` (`:219`) precede it (Phase 0 §R3).
- **Legacy failure text still reaches the model** (RV-12) through the Consolidated Insight line of the reflection prompt (`agentReflectionUtils.js:200`) and through consolidation windows that still hold old failure entries. This belongs to P-OUT-2 / P-RESET.
- **An always-throwing claim** (RV-10) would retry every tick without being counted. No model spend; no realistic cause found.
- **`api/_utils/gameDesignCategoryConfig.js` now has no importer.** It is dead code, kept because the collection stays.
- **A stale anchor:** `src/config/featureFlags.js:2764` cites `agentReflectionUtils.js:220-229, :339`. Those lines moved with this change (and had drifted before it). Not edited, to keep this build out of the flag-source module.
- `REFLECTION_WRITER_INVESTIGATION_V2.md`, cited by the cron header, is still not in `docs/` (Phase 0 §5).

---

**Branch:** `claude/reflection-outage-fix` · **Code head:** `3f6cae55` · **Report:** `docs/audits/20261010_BUILD_REFLECTION_OUTAGE_FIX.md` · **Model spend:** $0.1452 (6 of 6 calls; nothing written back).
