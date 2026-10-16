# Build report — Film Room B1.1: the live count on the record, late meetings, the hub helper

**Date:** 15–16 Oct 2026 · **Executor:** Claude Code (desktop, local Windows + WSL Ubuntu) · **Prompt:** Fable, "Build prompt — Film Room B1.1" (2026-10-15) · **Governing:** Build B spec V1.0 with Amendments A, B (RB-6–RB-9) and C (RC-1–RC-5), Astra's B1 confirmation (N1), BUILD_RULES

## Verdict

| Question | Answer |
|---|---|
| Built | B0 docs and items 1–5, one commit each with their tests; one commit of §2 review fixes. Draft PR, no merge, no production write, no backfill, no refresh. |
| Item 1 (RC-2) — the live count on the record | **Done.** The evaluator records, per held symbol, the count `evaluateRisk` received, `withinAge` and `dailyPct` exactly as passed (`\|\| 0` included); the capture writes `risk.stagnation`, the tape copies it to `checks[].stagnation` (class R). |
| Proof of no change in the evaluator (exit criterion 1) | **Holds.** Every battle write (`cronState` included), prompt, writer argument, verdict and capture byte is identical to the tree before B1.1, with `risk.stagnation` lifted — on the frozen calls-off golden (16 scenarios), the rollback golden (3) and a new frozen golden of **18 ticks where the stagnation rule is live** (fires executed, vetoed, held by the breaker, paused, reset, chained). |
| Item 2 (RC-1) — `stalled` v2 | **Done.** Basis `recorded` / `recomputed` per holding per day, stored in `tags.inputs.holdingBasis`; registry text is RC-1's verbatim; versions 2. |
| Acceptance B again | **Every recorded stagnation exit is preceded** on the census-shaped fixture (no-trigger and meeting checks between the stall and the exit). **Without the records the same days give B1's result byte for byte** (against B1's own tagger output, frozen). A recorded holding's miss is reported as class `recorded_basis`. |
| Item 3 (RC-3) — late-filed meetings | **Done, and dormant in production:** every battle the platform creates today is a single-day battle, so it has no previous session (§5). A re-merge of P equals, byte for byte, the founder's refresh of P at the same instant (§5, ruling 2). |
| Completion-filing answer | **Completion does not file a pending meeting.** The final-day re-merge therefore does not cover it; such a meeting is never filed, and its tape's "a refresh copies it" note is untrue for it (pre-existing, ruling 3). |
| Item 4 (RB-9) — the hub helper | **Done.** An untaped mode answers Stage 1 before any verdict or read; three keys in every branch. |
| Item 5 (RC-4, Astra N1) | **Done.** One fixed list of real error classes (cited to the installed packages); every other name prints `Error`, on all four surfaces. |
| capture `schemaVersion` | **Not bumped** — a ruling is requested (§3, ruling 1). |
| Mutants | Round 1: **22 of 22 killed** (the 7 the prompt names + 15). Round 2, after the review fixes: **39 of 39 killed** (§8). |
| §2 review | 5 lenses + one refuter per finding: **27 findings — 13 CONFIRMED, 13 PARTLY, 1 REFUTED** — plus X5's test-integrity findings (9 mutants that survived), each answered by a new row and re-run in round 2. **No exit criterion breached as built.** |
| Checks (on the branch merged with current `main`, `458fb929`) | Linux suite CI-shaped: **1,023 files, 0 failing; 21,772 passed, 0 failed, 88 skipped**. Rules suite: **25 files, 424 passed**. `lint:gate`: **0 problems**. `vite build`: **passes**. |
| Fence | No BUILD_RULES §1 file, rules, index, flag or `vercel.json` touched; no new legacy-table importer. `updateStagnationCounter` / `evaluateRisk` called, never edited or copied. |

## 0. Preamble

- **Fetch:** `git fetch origin` first. `origin/main` = `1d6d5d4a` (#974), which contains #962 (`495ee07b`, VERIFIED by `git merge-base --is-ancestor`).
- **Main moved during the build** to `17947fdd` (#975 BaggerBomb thresholds blockers, #976 research modal wiring; 26 files, none in common with this branch). Merged into the branch at **`458fb929`** with the app's base-branch sync; every final check ran on that merged tree (§9).
- **Branch:** the app's worktree branch `claude/film-room-b1-1-6bfed6`, cut at `1d6d5d4a`, clean; pushed by refspec to **`claude/film-room-b1-1`**.
- **Anchors** were re-verified at this head before use (the prompt's were read at `495ee07b`).

## 1. The items

| Item | Commit | What (lines at the review head `40198f4f`) | Tests | Mutants (round 1) |
|---|---|---|---|---|
| B0 | `e2c1deec` | Astra's confirmation, Amendments B and C, verbatim; B1 report §13 (the refresh, counts only); three README rows | — | — |
| 1 (RC-2) | `0fdd9039` | `agent-evaluate.js:1741`, `:1876`, `:1888`, `:1910`; `captureWriter.js:163` (`stagnationRecordOf`), `:284`; `captureSerializer.js:102–104`, `:236`, `:246–247`; `tapeAssemble.js:168` (`stagnationOf`), `:267`; `src/constants/filmTape.js:194–195` | the RC-2 pin (`agent-evaluate.tickCapture.test.js`); the two frozen goldens' lift (`__fixtures__/stagnationLift.js`); writer and serializer rows; `tapeStagnation.test.js`; the screen's criterion-9 rows | M1, M2 (named), M8, M9, M10 killed |
| 2 (RC-1) | `a8ebff1d` | `tapeTags.js` `recordAt`, `holdingBasisOf`, the recorded walk in `tagDay`, the pause note, `checks.stagnation` as a source; registry `stalled` v2 (`situationRegistry.js:20`, `:31`); census class `recorded_basis` | `tapeTagsRecorded.test.js` (acceptance B, B1 byte for byte against `tagsB1Golden.json`, the mixed day, reproducibility, the recorded walk); version pins | M3 (named), M11–M14 killed |
| 3 (RC-3) | `708e6382` | `closePass.js` `previousTapeDay`, `meetingKeysOn`, `remergePreviousDay`; the summary fields; the handler's log line (`film-tape-close.js:110`) | `closePassLateMeeting.test.js` | M4, M5 (named), M15–M17 killed |
| 4 (RB-9) | `b5849fdb` | `reviewAvailability.js` — the writer's mode test before the verdict | `reviewAvailability.test.js` RB-9 rows | M6 (named), M18 killed |
| 5 (RC-4) | `687179b3` | `errorClass.js` (the list, `errorClassOf`); used at `tapeAssemble.js:227`, `:935`, `tapeTags.js:425`, `census-film-room-b1.mjs:405` | `errorClass.test.js` | M7 (named), M19–M22 killed |
| review | `40198f4f` | the §2 review's fixes (§7) | the rows §7 names; `agent-evaluate.stagnationLive.golden.test.js` | round 2, §8 |
| merge | `458fb929` | `origin/main` `17947fdd` merged in (no conflict, no file in common) | — | — |

## 2. The evaluator's byte-identical proof (exit criterion 1)

The evaluator change is recording only: the position object `evaluateRisk` receives is now named (`riskPosition`, the same literal, `agent-evaluate.js:1876`), `stagnationRead` is filled after the call (`:1888`) and never read back, and the map rides the existing capture step (`:1910`). `evaluateRisk` does not mutate its position (`agentRiskManager.js:89–92`).

| Proof | What it compares | Result |
|---|---|---|
| Calls-off golden, frozen before Build 0 (`agent-evaluate.callRecords.offGolden.test.js`) | every exit's battle writes (cronState included), prompt bytes, writer arguments, summary and both capture documents | **identical** with `risk.stagnation` lifted; the lift asserts the record sits on exactly the tick records whose verdicts the tick computed, over those symbols |
| Rollback golden (`agent-evaluate.callRecords.rollback.test.js`) | the same, three rows | **identical**, same lift |
| **Live stagnation golden** (new, `agent-evaluate.stagnationLive.golden.test.js`, fixture captured from `1d6d5d4a`) | 18 ticks with seeded counters: fires executed, vetoed by the hurdle floor, held by the circuit breaker, age pauses, a reset, a threshold crossed, a quote without `changePercent`, a degen winner test, capture off, 8 chained ticks; per part SHA-256 of thrown, summary, battle writes, prompts, capture, writer arguments, every `evaluateRisk` / `updateStagnationCounter` / `clearsHurdleFloor` call's inputs and result, end state | **identical** on every part of every tick; recorded == received on every tick |
| Tick-coherence prompt golden (`agent-evaluate.tickCoherence.test.js`) | the prompt block, pre-fix snapshot | identical (LF tree; this row is CRLF-only red on Windows) |
| The RC-2 pin (`agent-evaluate.tickCapture.test.js`) | the recorded `ticks` (after the update), `withinAge` and `dailyPct` (with `\|\| 0`) equal what `evaluateRisk` received | holds; kills M1, M2 |

The review (X1-3) found that the two older goldens start every symbol on its first tick, so they never run the rule; the live golden closes that gap.

## 3. The capture `schemaVersion` decision — ruling 1

**What I did: not bumped.** `risk.stagnation` is emitted on any tick that ran the risk loop, under the registered versions (1 calls off, 2 calls on).

**Why:** the versions are the call-record contract's registered contribution sets (`docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md` §9: "Each emitted shape names its registered schema version"; `captureConfig.js:57–74`). A bump means re-registering both rows there, a cross-arc document this build does not own, and it moves the frozen goldens' version values (38 occurrences), `captureComposition.calls.test.js`, `agent-evaluate.tickStamps.callsOn.test.js` and the pilot spec's "P5 bumps from whatever is current". No reader keys on the tick capture's version: the only one that reads it, `scripts/shadow-read-call-records.mjs:207`, copies it; the tape tests for the field's presence.

**Against it (review X1-4, PARTLY):** `captureConfig.js:37` says "Bump on any shape change"; the Cockpit Phase 0 report lists the version among the ratchets every build meets (`docs/audits/20260923_PHASE0_COCKPIT.md:40`); ruling CR-3 says "the version exists to say so". My precedent, `scores.stockModel` (#972), is narrower than I first claimed: it is gated by the battle's stock-model route; `risk.stagnation` is the first ungated additive field since capture went live. No ruling in `docs/` allows one.

**Asked:** (a) accept the field under the registered versions and reword `captureConfig.js:37` to the rule actually followed; or (b) bump, with the contract owner re-registering version 1+stagnation and 2+stagnation, in a follow-up.

**Consumers of the tick's `risk` shape** (all read by name; none breaks): the tape's `riskOf` reads `verdicts` (`tapeAssemble.js:148`); the ablation replay reads `lockedCount` / `forcedExitCount` (`scripts/experiments/archetypeAblationReplay.mjs:807`); the export passes the record through (`scripts/export-tick-capture.js`); the census reads the tape's `checks[].risk`, verdicts only; the cockpit and shadow reads read `calls` only. The frozen goldens are the only byte pins, and they lift exactly the field.

## 4. `stalled` v2 (item 2)

- **The basis** (`tapeTags.js:125` `holdingBasisOf`): `recorded` when every check that holds the symbol carries a complete record (`recordAt`, `:115`: an integer count ≥ 0, a boolean, a finite number); else `recomputed`. A check rebuilt from its entry carries none, so it demotes its holdings. `tagDay` rejects stored inputs whose `holdingBasis` differs from the checks' own (v1 inputs name none and still reproduce).
- **Recorded walk:** count, age verdict and winner input are the record's; a reset is `withinAge && ticks === 0`; nothing is recomputed; no price is needed.
- **Acceptance B again** (`tapeTagsRecorded.test.js`): on the census-shaped day (no-trigger checks 3–4, a meeting check 5, the exit at 6) the recorded basis tags ACN at checks 4 and 5 (live counts 3 and 4) and the exit is preceded; the census classes no mismatch. B1 on the same day: no tag, not preceded, `no_price_pause`.
- **B1 byte for byte:** `__fixtures__/tagsB1Golden.json` is B1's own tagger output on three fixture days (captured at `0fdd9039`, whose tagger and registry are byte-identical to `495ee07b`; SHA-256 pinned, LF). Without records, v2's `tags` and `coverage.tags` equal it with only the version labels and the new `inputs.holdingBasis` normalised. The review regenerated it from the base tagger and got the same SHA.
- **RC-1's "the count runs at S2's move threshold"** holds for a recorded count by value: the one archetype with forced rotation off (guardian) counts at 0.003, S2's threshold; a tripwire row fails the day they part.

## 5. Late-filed meetings (item 3)

- **Behaviour:** after day D, the pass takes P from the validated timeline, lists the meetings the battle's history now holds as created on P (the writer's own `buildMeetings`, no read), reads P only for a candidate, and re-merges P with `writeTapeDay` only when a candidate's key is missing. Tiered battles only; only above the pass's time floor. P with no written tape is never written. A failure never marks P failed and leaves D as it was.
- **Summary:** `remerged` (each row says `meetingsStored`), `remergeUnchanged` (reason `already_copied`, `not_written`, `time_floor`, `writer_unchanged`), `remergeFailed`; the log line prints the three counts only.
- **The candle pass is not reopened:** the re-merge moves no candle field, no fingerprint and asks no provider (tested). A meeting-only symbol is outside the candle input fingerprint, so a P whose pass has ended keeps it ended and the late leg gets no bars (RB-2); a P whose pass is still to run fetches the leg on its next attempt, as an on-time leg (tested).
- **Dormant today (review X3-1, CONFIRMED):** `AGENT_BATTLE_DURATION_MODE = 'fullday'` (`agentBattleService.js:37`) gives every battle one trading day, `createAgentBattle` is the only creator, and the timeline is never rewritten, so no battle has a previous session. RC-3 runs only on fixtures until a multi-day battle exists.
- **What a re-merge moves besides the meetings (review X3-2, PARTLY) — ruling 2.** The same writer copies whatever else P's sources gained since P's night: a call's observed state (`CALL_RECORDS_MODE` is `'on'`), a directive's heard stamp, the completion block when the battle completed (BA-27), a gap's attribution, and on a P written before B1.1 the v2 tag labels and the two new declarations. A refuter showed the re-merged P is **byte-identical to the founder's refresh of P at the same instant** in every case (and base's refresh moves the same fields); a row now pins that equivalence. Criterion 2's exception names only P's meetings and `coverage.meetings`. Asked: read the exception as "a re-merge moves what a refresh of P at that instant moves", or make the re-merge meetings-only (which contradicts RC-3's "the same writer").

## 6. The hub helper and the error classes (items 4, 5)

- **RB-9:** `resolveModeConfig(battle.gameMode).label !== 'tiered'` (the writer's `isTieredBattle`, the route's test) sends the battle to `stageOne` before the verdict; the test sits in a try, so a mode that cannot be looked up falls through as before RB-9. A row pins the helper's branch to `isTieredBattle` over every known mode and the prototype names.
- **The class list** (`errorClass.js:22`): the ECMAScript built-ins; `FirebaseError`, `FirebaseAppError`, `FirebaseFirestoreError` (firebase-admin 13.7.0 `lib/utils/error.js`); `GoogleError` (google-gax 4.6.1); `GaxiosError` (gaxios 6.7.1) — each cited. `errorClassOf` returns the listed name (if not the generic `Error`), else the listed constructor name, else `Error`. Astra's N1 repro prints `Error` on all four surfaces and reaches no stored byte.

## 7. The §2 review

The cumulative diff crosses the threshold (≥10 files). Five lenses on path-distinct LF snapshots of `687179b3` (read-only on git and the worktree; the mutating lens on its own tree): X1 evaluator and capture, X2 tagger and census, X3 the re-merge, X4 hub helper and classes, X5 test integrity, criteria and fences. Every finding went to a refuter on its own snapshot. Verdicts: **CONFIRMED** stands as stated, **PARTLY** names what stands, **REFUTED** with the reason.

| Id | Finding | Refuter | Disposition |
|---|---|---|---|
| X4-1 | `AggregateError` (ES2021) reddens the lint gate | CONFIRMED (the only gate hit; base clean) | fixed |
| X4-2 | the RB-9 mode test outside a try can reject | PARTLY: real, unreachable (only `createAgentBattle` writes `gameMode`) | fixed; matches base on those inputs |
| X4-3 | an empty-message error prints its bare name through the message channels | PARTLY: pre-existing, unreachable, outside RC-4's four sites | separate tasking |
| X4-4 | mode test not pinned to the writer's; a stale row; an unreachable guard | PARTLY | fixed (parity row, retitle, prose) |
| X4-5 | citation errors in `errorClass.js` | PARTLY (the lens's own streaming citation was also wrong) | fixed |
| X2-1 | the census class `recorded_basis` untested | CONFIRMED | fixed (two rows) |
| X2-2 | `recorded_basis` is a catch-all; its comment overclaims | PARTLY | comment fixed; sub-classes are the founder's call |
| X2-3 | on the recorded basis "fired" restarts each day while the count carries | PARTLY: B1's day-local convention, spec silent; one false-positive tag on a day after a vetoed fire | **ruling 4** |
| X2-4 | a recorded count that falls without a timely zero is no run boundary | PARTLY: also from a `tick_error` record; costs a missed tag (reported as `recorded_basis`) | ruling 4 |
| X2-5 | a quote-less tick records `dailyPct: 0` and tags | REFUTED: such a tick exits `degraded_quotes` before the risk loop | — |
| X2-6 | the fixture's daily change equals its change from entry | PARTLY | backlog |
| X2-7 | (a) a fully recorded day with partial evidence reads `unavailable`; (b) `inputs.winnerBasis` names the recomputed input only | CONFIRMED (both) | (a) ruling 5; (b) backlog |
| X2-8 | four stale comments | CONFIRMED | fixed |
| X1-1 | the writer records `{}` for a loop over no holdings | PARTLY: mirrors `verdicts`; unreachable | comment fixed |
| X1-2 | a dotted ticker key is rejected under both maps | mechanism CONFIRMED; "unreachable" REFUTED (an equipped watchlist can hold `BF.B`); pre-existing serializer limit | separate tasking |
| X1-3 | the frozen goldens never run the stagnation rule | CONFIRMED; the refuter built the before/after proof (identical) | fixed: the live golden |
| X1-4 | the `schemaVersion` precedent is narrower than claimed | PARTLY | **ruling 1** |
| X1-5 | `numberClasses` moves on a pre-B1.1 tape's rewrite | CONFIRMED fact; A1's own design (B1 did the same) | ruling 2 |
| X3-1 | RC-3 unreachable at HEAD; completion never files a pending meeting | CONFIRMED | **ruling 3** |
| X3-2 | a re-merge moves P fields outside criterion 2's exception | PARTLY: equals a refresh of P | **ruling 2**; equivalence row |
| X3-3 | "late legs get no bars" holds only for an ended candle pass | PARTLY | wording fixed; row |
| X3-4 | a P whose meetings the budget drops is listed `remerged` | CONFIRMED | fixed (`meetingsStored`) |
| X3-5 | a seq both attributed and unattributed after a re-write | CONFIRMED, pre-existing in `tapeMerge.js` | separate tasking |
| X3-6 | the time floor does not gate the re-merge | CONFIRMED | fixed (`time_floor`) |
| X3-7 | the owner can rewrite a copied meeting, or push it off P with 26 plants, and B1.1's re-merge triggers it nightly | CONFIRMED (the cap eviction is pre-existing) | **ruling 6** |
| X3-8 | untested guards and log line | CONFIRMED | fixed (rows) |
| X3-9 | "the transaction never committed" overstated | CONFIRMED | wording fixed |
| X5-1 … X5-5 | nine mutants survived (the class half of criterion 4, an entry row, incomplete records, `every` vs `some`, the untaped guard, `sameBasis`'s key count, name precedence) | X5 ran each mutant at `687179b3` (it survived the whole related suite) | fixed: a row each; re-run in round 2 (§8) |
| X5-6 / X5-7 / X5-8 | message channel; criterion 2 wording; a B1-written P | as X4-3 / X1-5 / covered by a new row | as above |

Counts: of the 27 X1–X4 findings, 13 CONFIRMED, 13 PARTLY (X1-2 among them: mechanism confirmed, its reachability claim refuted), 1 REFUTED (X2-5); plus X5's eight findings: its nine mutants that survived at `687179b3` are re-run in round 2 (§8) against the new rows. Lens and refuter reports are held in the session; the CONFIRMED/PARTLY split is theirs.

## 8. Mutants

**Round 1** (at `687179b3`, LF snapshot): 22 of 22 killed.

| Id | Mutant (the prompt's seven first) | Killed by |
|---|---|---|
| M1 | the evaluator records the count from before the update | the RC-2 pin |
| M2 | `dailyPct` recorded without its `\|\| 0` | the RC-2 pin (MSFT has no `changePercent`) |
| M3 | the tagger uses the recorded basis when one check lacks the record | the mixed-day rows |
| M4 | the re-merge runs for a battle with no meeting on P | the no-meeting read-count row |
| M5 | a re-merge failure passed to `safeMarkFailed` | the injected-failure row |
| M6 | the hub helper asks for the verdict before the mode test | the RB-9 'allowlist' row |
| M7 | the class helper accepts any `…Error` name | the N1 rows |
| M8–M22 | the writer's type checks, the tape copy, emission on every tick, the recorded reset and winner input, the pause note, the basis check, the re-merge's three guards and its call, the RB-9 test, the class constructor read, the census and the two raw-name sites | each by its item's rows |

**Round 2:** **39 of 39 killed** at `40198f4f` (LF snapshot): the 22 of round 1 re-run (M6, M17, M18 re-anchored where the fixes moved their lines), and 17 new — R1 the RB-9 test outside its try; R2 the time floor ignored; R3 `meetingsStored` always true; R4 an entry row ignored by the basis; R5 / R6 a recorded mismatch classed `other` / never counted; R7 the constructor read before the name; R8 / R9 `recordAt` dropping its boolean / number check; R10 `every` → `some`; R11 the untaped guard removed; R12 `sameBasis` without its key count; R13 / R14 the log line's constant zeros / swapped counts; R15–R17 the persisted count one too many, the age verdict flipped and the daily change scaled in the evaluator (each killed by the live stagnation golden). R4–R12 are X5's survivors.

## 9. Checks

| Check | Tree | Result |
|---|---|---|
| Full suite, CI-shaped: WSL Ubuntu, a private clone, Node 20.20.2, npm 10.8.2, `CI=true TZ=UTC`, `--maxWorkers=2` | `458fb929` (tree `1f48a531`), the branch merged with `origin/main` `17947fdd` | **1,023 files, 0 failing; 21,772 passed, 0 failed, 88 skipped** (515 s) |
| Rules suite (`npm run test:rules`; Windows, Java 21, the Firestore emulator — WSL has no Java) | LF archive of `458fb929` | **25 files, 424 passed** |
| `lint:gate` | `458fb929`, Linux | **0 problems** |
| `vite build` | `458fb929`, Linux; and again on the pushed head | **passes** (3,999 modules; the existing CSS warnings only) |
| Frozen goldens on the merged tree (calls-off, rollback, live stagnation) | `458fb929` | identical (§2) |

- **Windows worktree runs** (during the build) fail only the rows known to fail on this machine for platform reasons: CRLF source scans (`agent-evaluate.evalRun`, `agent-evaluate.tickCoherence` ×2, `agent-evaluate.tickStamps.pins`, `eligibility`, `shadowCpuQuoteIntegrityFlags`), Windows paths (`decisionRecord` ×2, `ruleSupportStatus`, `traitLibraryCandidate.composition`, the §2.3 ratchet row). Each passes on the LF snapshot and on Linux.
- **Timeouts under load:** the heavy writer suites this build adds run whole multi-day fixture worlds; under the review's parallel load they hit vitest's 5 s default, so they carry the heavy tape suites' 30–60 s limits (the `screenFixtures.test.js` precedent). The CI-shaped run above had no timeout.
- **PR CI:** not available when this report was committed (it runs on the push); its result is reported with the PR.

## 10. Fence statement

`git diff --name-only 1d6d5d4a 40198f4f` (the branch's own changes, without the merge of `main`) names no BUILD_RULES §1 file (`api/agent/decide.js`, `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentBattleService.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `agentGuardrails.js`, `archetypeScoring.js`, `tournamentUserScoring.js`), no `firestore.rules`, no `firestore.indexes.json`, no `vercel.json`, no `src/config/featureFlags.js`, and not `api/_utils/archetypeImportBoundaryBaseline.json`. Called, never edited or copied: `updateStagnationCounter`, `evaluateRisk` (`agentRiskManager.js`). No new importer of a legacy archetype table: the new fixture imports `archetypeRegistry.js` (the sanctioned layer) and the risk manager; the ratchet's POSIX re-scan finds 87/87 at both head and base (review X5). `agent-evaluate.js` only records. No merge, no production write, no backfill, no refresh.

## 11. For the founder and the spec author

1. **`schemaVersion` (§3).** Accept `risk.stagnation` under the registered versions and reword `captureConfig.js:37`, or bump with the contract owner re-registering both shapes.
2. **What a late-meeting re-merge may move (§5).** As built it is a refresh of P: P's calls' observed state, a heard stamp, a completion, a gap's attribution, and on a pre-B1.1 P the v2 labels and two declarations move with the meetings. Read criterion 2's exception that way, or ask for a meetings-only re-merge (which drops RC-3's "the same writer").
3. **A meeting pending at completion is never filed.** Every battle is single-day today, so RC-3 never fires, and the meeting a battle leaves pending at its last check stays out of the history; its tape keeps "only a later run of this day's close pass (a refresh) copies it", which no run will do. Options: reword the note on a completed battle's final day; copy the unfiled meeting from the server's copy (`cronState.gameplanMeeting`) with a pending-at-completion status; or file it at completion (an evaluator change, outside this build's record-only fence).
4. **The recorded basis's run boundaries (X2-3, X2-4).** The count carries over the night but "the rule has fired in the run" restarts each day (B1's convention, which the spec does not address), so a holding whose fire was vetoed the evening before is tagged at the next morning's first check. And a recorded count that falls without a timely zero (an unrecorded tick, a `tick_error` record) is not treated as a new run. Options: carry "fired" from the prior tape (stored in `tags.inputs`), narrow RC-1's "in the run" to the day, or add a census class / coverage note for discontinuities.
5. **Coverage on a fully recorded day (X2-7a).** B1's rule still reads `stalled` unavailable when the evidence section is partial, though no recorded holding reads evidence. Keep (conservative) or drop the evidence reason and source on days with no recomputed holding.
6. **Owner-written meeting history and the re-merge (X3-7).** The owner may write `gameplanMeetingHistory`; a planted duplicate or a new id makes the next night's pass re-merge P, the new read of a copied row wins, and 26 earlier-dated plants push the real meeting off P (the day's cap keeps the earliest). Before B1.1 only an admin refresh (or a completion night) could do this. Option: make a copied meeting row permanent (the stored row wins, the cap keeps stored rows first).
7. **For separate tasking (pre-existing, reported, not fixed):** X3-5 (a seq listed both as the day's gap and as unattributed after any re-write, `tapeMerge.js:523–527`); X4-3 (an empty-message error prints its bare name in the read notes and `passes.*.reason`); X1-2 (a dotted ticker key is rejected by the capture serializer under every symbol-keyed map); X2-2's sub-classes; X2-6's fixture variant; X2-7b's `winnerBasis` label.
8. **RC-5 respected:** no census size line was built.
