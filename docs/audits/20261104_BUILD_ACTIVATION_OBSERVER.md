# Build report: the ID-1 activation observer (ID-1 Build 2)

**Date:** 4 November 2026. **Executor:** Claude Code (Opus 5.5, advisor Fable 5.1), own worktree. **Branch:** `claude/activation-observer` (pushed by refspec from the app worktree's local branch `claude/advisor-fable-bb305d`), cut from `origin/main` at `f3da14a3`. **Contract:** `docs/design/20261104_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_7.md` (committed byte-identical by this build). **Prompt:** Build Prompt V3 (Fable, 4 Nov). **Discovery:** `docs/audits/20261030_PHASE0_ID1_SHARED_EVIDENCE.md`. **Build 1:** `docs/audits/20261030_BUILD_SETUP_EVIDENCE_STORE.md`.

## 1. In plain terms

Build 1 made the shelf: one permanent record per stock, per completed trading day, of what the Trend Follower's setup rule said about it. This build makes the clerk who writes, each time a stock enters a Trend Follower's portfolio, a permanent note saying which record it entered under and the swing low its thesis breaks below. One note per holding: a stock that leaves and comes back gets a second note, never the first one again.

**Nothing runs yet.** The clerk is the sixth job of the reflections cron, behind a switch that is off (`ACTIVATION_EVIDENCE_ENABLED = false`) and the cockpit allowlist. With the switch off the cron answers exactly what it answered before, byte for byte. Nothing about trading, scoring or the game changes.

| Question | Answer |
|---|---|
| Is it built? | Yes. `api/_utils/activationEvidence/` (seven pure modules, five that do I/O), the sixth tenant, the census `scripts/census-activation-evidence.mjs`. |
| Does it run? | No. The flag ships `false`; the observer returns before any read. |
| Fenced files? | None edited; the observer calls no fenced function. One test row reaches the fenced scorer through the non-fenced corrected writer (Q5). Nothing in `api/_utils/setupEvaluator/` and no behaviour of the store changed (one test file of the store gains this build's importers by name). |
| Did the host cron change for its other jobs? | No. `TIME_BUDGET_MS` is still 50 s, no tenant's code, deadline or response key moved, and the flag-off response is byte-identical to the base's (three fixtures). |
| The schedule? | The reflections cron gains the 01:00 UTC hour (four runs, 01:00–01:45). No existing tenant produces a new kind of output in them (§6). |
| Independent review | 4 lenses, 4 refuting verifiers: 25 findings (4 MEDIUM as reported, none after verification): 14 confirmed, 10 partly, 1 refuted. 20 fixed or reworded; 5 left as recorded; Q2 and Q3 carry two contract readings to you. One point was against the prompt's letter (a casual clone's second read could start after the 6 s budget) and is fixed. Then a mutation lens on the fixed head (§10). |
| Final runs | All green; the numbers are in §11. |
| What you need to do | After merging: publish the Firestore rules, deploy the new index, confirm the cron hour in Vercel. Then, when you choose, the flag flip as its own PR (§13). |
| Questions | Five, none blocking (§14), all answerable before the flag flip. **Ruled 6 Nov (contract V1.8):** Q1, Q4, Q5 kept; Q2, Q3 and review L4-2 changed, built in the rulings round (§16). |

## 2. Preamble

- `git fetch origin main` ran first: `origin/main` = `f3da14a3d0874dc44f06dd3af0fa9ab157b6715d` (the #1025 merge). The worktree's HEAD was the same commit, clean.
- The app made this worktree with the local branch `claude/advisor-fable-bb305d`; the branch is pushed as `HEAD:refs/heads/claude/activation-observer`, so the PR head carries the prompt's name.
- `docs/BUILD_RULES.md` was read in full, then the contract, the Phase 0 report and Build 1's report.
- **Prerequisite met:** `.github/workflows/tests.yml:150` on `origin/main` has the `rules` job (`firestore rules + emulator suites`), whose step at `:190-191` runs `npm run test:rules`. This PR's emulator rows run in CI.

## 3. §1 re-verification at HEAD (all VERIFIED at `f3da14a3`)

| Anchor | Finding | Drift |
|---|---|---|
| `agentBattleService.js` | Roster `agentContext.initialPortfolio` :256; watchlist :208; hypothesis :217-231; the expiry choice is the call at :128 (`tieredFullDay`), its helper at :420. Owner `ownerId` :141; `status` :142; `createdAt`/`activatedAt` :149-150; `expiresAt` :152; `timing.tradingDays` :156; `isCpu` only on tournament battles :146. Owner tiered slots `portfolio.star/core/support` :160-162; bench `portfolio.bench` :165-168; opponent `opponent` :173. | none (the prompt's ":420" is the helper) |
| `stockAdmissionWindow.js` | 20:00 ET is `NIGHT_GAME_CLOSE` :22; the expiry is chosen at :72. | 6 lines (prompt: :66) |
| `agentSwapExecution.js` (legacy) | Row :395-418; `swappedOutAt: now` :408 and the incoming `swappedInAt: now` :432 from one `now` (:308); slice :499; `tradeCount` +1 :508; `verification.verificationId` :161. The row spreads the caller's metadata AFTER its computed keys; the metadata is the allowlisted `EXECUTOR_METADATA_KEYS` (`executorMetadata.js:34-38`), which holds no computed key. | none |
| `stockThresholdAdmission.js` (corrected) | Incoming `positionId` :241; the transaction clock `at` :251; the row :269-273 (metadata spread FIRST) with `outgoingPositionId`, `incomingPositionId`, `outgoingReceipt`, `incomingReceipt`; slice :283; qualify stamping :94-104. `outgoingReceipt.enteredAt` is the outgoing position's entry instant (`bindStockReceipt` :25-29); `incomingReceipt.enteredAt` is written from `at`, the same value as `swappedOutAt`. No `verification` on this route. | none |
| Route discriminator | The battle-level committed field is `scoring.stockThresholdModel` (`stockModelRoute`, `src/utils/stockThresholdModel.js:26-32`). No per-lifetime route field exists, so **a lifetime is corrected exactly when its own position-id field is present**, and the build checks that it agrees with the battle's stamp (decision 19). | — |
| Ticks | `captureWriter.js:581-584` (one batch); the permanent document carries `tickSeq`, `evalId`, `capturedAt` (ISO, :254) and `actions` (:308); `captureContext.js:256-270` records one action per committed executor result (`kind: 'swap'`, `committed: true`, `swappedOutAt`, `symbolOut`, `symbolIn`). **`capturedAt` is queryable:** `tapeSources.js:44` range-queries it (auto-indexed; only nested maps are exempted). Proposal executions record committed actions (`agent-evaluate.js:5396-5405`). The serializer admits `actions[].swappedOutAt` unchanged (`captureSerializer.js:136`, `:373`), so the tape's string key holds. | none |
| `tapeAssemble.js` | `swapKey` :392. | none |
| `casualClone.js` | `resolveAttributionAgentId` :297-325 (clone agent → named parent → owner comparison); `isCasualCloneId` `leagueTournament.js:417`. | none |
| `review.js` | `frozenNamesOf` :166. | none |
| Allowlist / gate | `readCockpitAllowlist` `callRecords/allowlist.js:47` (env name :27); `hypothesisRecords/gate.js` shape. | none |
| `reviewPass.js` | Persisted cursors and the due phase passing failing rows :447-490; `battleIsTerminal` :161. | none |
| Host | `TIME_BUDGET_MS = 50_000` :67; `maxDuration: 120` :64; five tenants :209-288; response :292-300. `vercel.json:206`. No test pins the schedule string; three tests pin the cron COUNT (44), which a schedule edit does not change. | none |
| Store | `getOrAcquireSnapshot` / `readSnapshot` `index.js:56`, `:36`; `lastCompletedSessionAt` `sessionAt.js:27`; `snapshotIdOf` `key.js:61` (session and symbol assertions); `ACQUIRE_TIMEOUT_MS` `acquire.js:42` (5 s). Snapshot document `acquire.js:134-151` (`entry`, `capturedAt` = `fetchedAt`, `key.ruleSet`, `schemaVersion: 1`); the entry's swing low is `entry.factsUsed.swingLow.value` (`tfSetupV1.js:318`, the same value as `entry.evidence.swingLow.value`). Claim document `store.js:71-76`; a lease is live while `|now − claimedAt| < 120 s` (`store.js:42-45`, not exported). Build 1's import guard `setupEvidenceImportGuard.test.js:32-35`. | none |
| `firestore.indexes.json` | No composite serves `ownerId ==` with a `createdAt` bound and descending order (the nearest, `(ownerId, agentId, createdAt desc)`, needs `agentId` equality). **This build adds `(ownerId ASC, createdAt DESC)`.** | — |
| `eval_NNN` | `EXECUTOR_METADATA_KEYS` unchanged; no discriminator of the model path has been added. Not used. | none |

## 4. What was built

| File | What it does |
|---|---|
| `activationEvidence/constants.js` | The §3 limits, the field masks, collection names. Restates the store's 5 s timeout and 120 s lease so the census never loads the store's write-capable modules; a test pins both to the store's own. |
| `scope.js` | Contract §2; one exclusion reason, first in the order game mode, CPU, training clone, archetype. |
| `lifetimes.js` | Contract §4.1: each owner slot's ordered lifetimes, the identity table, the consistency checks, class from each lifetime's own evidence, the gap rule. |
| `discover.js` | The activations, the crypto count, the unresolved by reason, the schedule; `activationKeyOf` (wrapper → `ok` → `snapshotIdOf`). |
| `schedule.js` | The cutoff, due-ness (callable from stored values), the horizon, a session's close. |
| `tick.js` | The join on the tape's swap key, the grace, the bounded `capturedAt` windows. |
| `pointer.js` | One pointer, exactly §4 and §4.5; `snapshotServes` (schemaVersion, key, a readable `capturedAt`). |
| `attribution.js` | The resolver, and the unresolved test; returns the two fields and a deferral flag. Each of the resolver's reads is admitted by the preparation budget. |
| `writer.js` | `createWithEvidence`, `createAtFinalization`; `tx.create` only. |
| `state.js` | `activationObserverState/main`: read (absent or unreadable → empty), normalise, write. |
| `gate.js` | The flag and the allowlist, environment only. |
| `tenant.js` | `runActivationObserver`, the §4 run. |
| `api/cron/process-pending-reflections.js` | The sixth tenant after the review pass, in its own try/catch; a docstring row; two stale comments corrected (52 ticks a day; the Wire's worst gap 11h15m). |
| `vercel.json` | `*/15 13,14,15,16,17,18,19,20,21,22,23,0,1 * * *`. |
| `src/config/activationEvidenceFlags.js` | `ACTIVATION_EVIDENCE_ENABLED = false`, its own module, registered in `flagPinGuard.test.js` with a `DARK_BY_DESIGN` entry; pin in `activationEvidenceFlags.test.js`. |
| `firestore.rules` | `agentBattles/{battleId}/activations/{activationId}` (inside the battle match) and `activationObserverState/{name}`: `allow read, write: if false`. |
| `firestore.indexes.json` | `agentBattles (ownerId ASC, createdAt DESC)`. |
| `compositionProtectedStoresAllowlist.json` | The writer's three `tx.create` sites (two keys) and a note. Neither collection is protected. |
| `setupEvidenceImportGuard.test.js` | This build's ten importers, each by exact filename with its reason. |
| `scripts/census-activation-evidence.mjs` | The census (§12). |

Fenced functions called: none. The store's `getOrAcquireSnapshot`, `readSnapshot`, `snapshotIdOf`, `ruleKeyOf`, `lastCompletedSessionAt`, the evaluator's `describeRuleSet`, the resolver, `frozenNamesOf` and the calendar are called and not edited.

## 5. Decisions, stated as decisions

1. **Class needs a boolean.** A lifetime's class is its own evidence's `isCrypto` (the live position, or the closing row); a missing or non-boolean value, or a `.CC` symbol recorded as a stock, is `class_unknown`. Every writer of record stamps a boolean (`decide.js:1268`, `:1275` and the crypto table; `agentSwapExecution.js:404`, `:429`; `stockThresholdAdmission.js:269` and the incoming asset), so this costs nothing on real documents and the census would show any that lack one.
2. **Ordering.** A slot's rows are ordered by their `swappedOutAt` instants. A row whose instant cannot be read leaves the order unknown, so the slot is `instant_malformed`; two rows of one slot at one instant leave it ambiguous, so the slot is `inconsistent`.
3. **A corrected stock swap-in must be corroborated:** its `incomingReceipt.enteredAt` must equal the row's `swappedOutAt` (the writer stamps both from `at`), else the slot is `inconsistent`. A row naming a slot the roster does not have, and two lifetimes that would share an id, are `inconsistent` too.
4. **The gap, to the letter.** Under a gap each slot's starting lifetime is `gap` (a crypto roster slot is counted as crypto instead), the lifetime the earliest retained row closes is not named (it may be the starting position or a swap-in whose row is gone), and every retained swap-in is named. The tenant counts them per run as `gapStarts`, written or not; the census tells which were written (§12). A `gap` lifetime is unresolved, never outstanding, so a due gap battle still finishes. See the question in §14.
5. **One match from a partial tick read defers too.** The prompt's rule is "exactly one match → `tick_action`" and "an incomplete read is never none". A partial read cannot show there is only one, so a single match from an incomplete read also defers (`tick_read_incomplete`); two or more matches are `unavailable` (ambiguous) whatever the read.
6. **The tick read is bounded by `capturedAt`.** For each battle with an unwritten swap-in: the windows `[swappedOutAt − 30 min, swappedOutAt + 30 min]`, merged, `select(tickSeq, evalId, actions)`, at most 400 documents in all; a full page, a failure or a window left unread makes the read incomplete.
7. **Stored due-ness passes `terminal: false`.** The state stores `cutoffAt` and `expiresAt`, not the status (contract §4.4's shape). The cutoff (01:30 UTC the next day) falls after every expiry createAgentBattle writes (00:00 or 01:00 UTC, or the close), so the stored answer equals the document's. The one exception, a terminal battle whose expiry is later than its cutoff or missing, is only queued as ordinary; its document decides once read (review L2-4).
8. **Attribution is resolved during preparation**, once per battle with unwritten work, held in run memory only (advisor: the resolver's two reads would not fit the 2 s write reserve). A ranked battle needs no read. Each of a casual clone's two reads (the clone, then the parent) is a preparation read admitted by the 6 s budget; a read the budget refuses defers the battle, never `unresolved` (review V4).
9. **Queues take only battles this run's owner-scoped queries returned**, so a battle of an owner who left the allowlist is never read from the index. The index is pruned of entries no query returned, and only when every owner's query answered.
10. **Carried keys** store `dueAt`, the earliest cutoff of the battles that need the key; a carried key is due when `now ≥ dueAt`, is dropped once `now ≥ dueAt + 3 days` (its battles are past the horizon), or, with no `dueAt`, once its session is older than the 14-day lookback. A carried key whose snapshot id no longer matches the deployed rule set is dropped (`carried_stale`), and one past its horizon is never offered again (`carried_past_horizon`).
11. **`activatingTick.evaluationId`** is the row's `evaluationId` on `tick_action` (the canonical example shows it), and `null` on `unavailable`. `tickSeq` and `evalId` come from the tick only; the row's `eval_NNN` is never parsed.
12. **`anchorSwingLow`** is `entry.factsUsed.swingLow.value` when it is a positive finite number.
13. **A final that does not serve its key** (another `schemaVersion`, or a `key` naming another session, symbol or rule set) is neither evidence nor proof of absence: neither writer uses it, nothing is written, it is counted `snapshotInvalid`.
14. **The tenant's clock is its injected `now`** (production `() => new Date()`), handed to the store unchanged. A test seam, `instrument.before(kind)`, is awaited before each I/O start; production passes none.
15. **The census imports `discover.js` for the deployed rule set** (`currentRuleSet`) and `schedule.js` for a session's close, so its static imports stay the pure modules and the store's two pure modules.
16. **The census's `finalization_undetermined` is counted over the in-scope candidates read**: a battle with no readable last trading day can never fall in a last-trading-day cohort.
17. **The writes run beside acquisition** (review L2-1). The prompt lists acquisition (step 10) before the writes (steps 11–12). Run strictly in that order, one store call over 5 s admitted late in the window ends inside the last 2 s and skips every write, evidence already in hand included. So the writes start as soon as a key's final or this run's own `retryable` is in hand, one transaction at a time. Every stated rule still holds: one cap of 30 for both kinds, a 2 s reserve before each transaction, the null rule unchanged (this run's `retryable` and the read inside the transaction), every started call awaited. Finalisation-due work still goes first: ordinary writes wait until no due key is still waiting on its store call. The alternative is the strict order with a larger admission reserve (about 9–10 s); see Q4.
18. **In flight, in the census, means not terminal and not yet expired** (review L2-5). The prompt says "still active". A census run between the close and the 02:00 UTC settlement would otherwise count the whole day as in flight and measure nothing.
19. **The route is checked, not guessed** (review L1-1): the battle's stamp and each lifetime's own position-id field must agree.
20. **A key is carried only while one of its activations is still unwritten** (review L2-2, L4-1). Keys the run did not discover stay carried until their horizon.
21. **The owners are queried in an order that turns each 15-minute run** (review L4-2), so a preparation budget that fits only some queries starves no owner. This uses no cursor and leaves the state's shape unchanged.
22. **A state the run could not read is never written over** (review L2-6); the next run that reads it carries on.
23. **A battle with no `agentId` is counted `malformed` and never written** (review L3-3). Every createAgentBattle document has one.

## 6. The new hour: what each tenant does at 01:00–01:45 UTC (VERIFIED)

Between 00:45 and 01:45 UTC neither calendar date moves: the UTC date rolled at 00:00 and the ET date rolls only at 04:00 or 05:00 UTC, so every date key equals the 00:45 run's. The one new fact is the winter Night Game expiry at exactly 01:00 UTC (20:00 EST; `stockAdmissionWindow.js:22`, `:72`), which summer already reaches at 00:00 UTC.

| Tenant | Gate | What a 01:00–01:45 UTC run does | New kind of output? |
|---|---|---|---|
| Reflections | none | Drains the same queue; `pendingReflection` is set only when a battle completes (`agent-evaluate.js:6937`), and the evening settlement runs at 02:00 UTC, after 01:45. Its only time logic is a 7-day backstop from `completedAt` (`reflectionOutcome.js:113-117`). | No — a backlog retried sooner. |
| Wire sweep | `WIRE_WRITES_ENABLED` | Replays failed stories sooner (orphan cutoff now − 30 min, `wireReplaySweep.js:180`); replays keep each envelope's stored `marketDate`. | No. |
| Editorial | `EDITORIAL_REVIEW_ENABLED = false` (`featureFlags.js:1609`) and UTC Sunday | Inert today. If on: a Sunday 01:xx run files under the same UTC slot date and ISO week as 00:xx (`wireEditorialRun.js:402-409`); a finished week makes later ticks a no-op. | No. |
| Call sweep | `CALL_RECORDS_MODE = 'on'` and the allowlist | In winter, a crypto battle's open calls can expire from 01:15 UTC while the battle is still `active` (the active-parent path, `sweep.js:130`, `past_deadline`), where today they are swept at 13:00 after settlement (`decideTerminalParentExpiry`, `sweep.js:173-178`, the same `expired_unresolved` / `past_deadline`; the label invariance is its stated rule, `:161-171`). | No — the same labels, sooner, by the other of its two paths. |
| Review pass | `HYPOTHESIS_RECORDS_ENABLED` and the allowlist | In winter, from 01:00 a crypto battle counts as over (`reviewPass.js:180-184`), so battle-end rows move to `review_due` that evening instead of at 13:00; the contract's §9 expected this (it closes P1c's winter gap). | No — the same transitions, sooner. |

The extra hour takes effect at deploy, with the flag still off. 48 → 52 runs a day; the cron count stays 44.

## 7. The limits against the allowlist

Two owners, each with at most a ranked and a casual battle a day; a battle holds six starting stocks plus its swap-ins (Phase 0: at most 5 trades a battle since 1 Sep). A day is therefore at most about 4 battles and 20–30 activations, which share keys within a session across battles.

- **Battles:** 25 a run against at most ~10 candidates in 14 days per owner pair at today's pace: every candidate is read in one run; excluded and finished battles drop out.
- **Acquisitions:** 12 a run, 3 at once. A new battle's six creations are six keys; after the first run they are mostly final. Within one run, with the full slice, preparation ends by 6 s and starts are admitted until 13 s: at least two waves of three.
- **Pointer writes:** 30 a run, with and without evidence together: one battle-day's pointers fit in one run.
- **Ticks:** windows of an hour around each unwritten swap-in (about 6 ticks each); 400 is far above any battle today.
- **What the census should watch to tune them:** `acquisitionsStarted` near 12, `deferred.not_reached` and `deferred.write_cap` above zero on ordinary days (raise the caps); `deferred.prep_cut` and `battles_unread` (preparation too slow); `truncations` (pages); `ticks.incompleteReads`; carried keys growing run over run.

## 8. Tests and where they run

Pure rows run in the ordinary suite with no network and no emulator: scope, lifetimes (including one end-to-end run of the real corrected writer, A → B → A, through the non-fenced `executeCorrectedStockSwap` and the stock-threshold harness; see Q5), discover and the keys, schedule (both seasons, multi-day, early close, terminal, stored due-ness, no `tradingDays`, the horizon), tick, pointer (on snapshots the store's own acquisition produced), attribution (every unresolved path, the cross-owner parent), state, the gate, the constants' pins, the rules tripwire, the I/O boundary pins, the flag pin, the host (flag-off byte identity, the tenant order, the budget, the cron line), and the census (import pin, member-call list, restricted reader, each measure, the sentinel sweep).

Everything that needs Firestore is in the emulator suite: `test/rules/activationObserver.rules.mjs` (the writer and the tenant on the Admin SDK, with the real store: the gate and the budget with no read, owner scoping, truncation, pointers with evidence, never updated, concurrent runs, the tick join, the corrected route, the store call — symbol form, crypto exclusion, an `ABORTED` throw, confirmation across three runs — the null rule at and before the cutoff, `pending`, unreached keys, acquisition versus finalisation, one shared cap, `calendar_missing`, progress under slow reads, the preparation budget, carried keys, fairness of keys and battles, final-tick starvation across 01:30, 01:45 and 13:00, caps and reserves with every started call awaited, a lost, stale, garbage or unwritable state, the horizon, counts-only return; and the review's rows: evidence in hand written beside slow calls, no dead carried keys, an unreadable state not overwritten, the owner order turning, an agent-less battle, a casual clone's budgeted reads, and the mutation lens's five), and `test/rules/activationEvidenceDenials.rules.mjs` (no client verb on either collection for the owner, another user, a privileged context or an anonymous client; the parent's owner read granted and not reaching the subcollection).

## 9. Advisor

Consulted twice, as the prompt orders: with the plan before the first edit, and before declaring done. Review subagents never consulted it.

**Before the first edit.** The advisor said: "Plan is sound; nothing here is a STOP." What changed because of it:
- The flag-off golden was captured at base before the handler was touched ("Hard-code that string in the new host row; a structural key-set check is what already exists, the prompt asks for byte identity").
- Attribution moved from the write phase into preparation: "the resolver is two sequential Firestore gets before the transaction even starts; 2 s won't cover it reliably."
- The gap kept to the letter, with the legacy-id point raised as a question (§14): "build the letter — unwritten starting lifetimes are `gap` on both routes."
- The stored-due-ness row includes a terminal-before-expiry battle and pre-cutoff instants.
- The census reuses the new index with a wide `createdAt` bound instead of a second index.
- Smoke rows for `getAll` with a field mask and an empty `select()` on the emulator; the serializer's handling of `swappedOutAt` confirmed (§3).

**Before declaring done.** See §15.

## 10. Independent review (BUILD_RULES §2)

Four lenses, each on its own LF `git archive` tree of `8b023da5`, read-only on git and on the shared tree, none running the emulator; then one refuting verifier per lens on a fresh tree of the same commit; then the mutation lens last, on the fixed head (below). Review subagents never consulted the advisor.

| Lens | Subject | Findings | After verification |
|---|---|---|---|
| L1 | Discovery: lifetimes on both routes, A → B → A, the gap, consistency, class, stability | 5 (no HIGH or MEDIUM) | 3 confirmed, 2 partly |
| L2 | Time: milliseconds, the wrapper, cutoffs, due-ness, the horizon, ticks, late and duplicated runs | 6 (1 MEDIUM) | 4 confirmed, 2 partly; the MEDIUM is LOW after V2 |
| L3 | The record and honesty: §4.5, the null rule, attribution, stream, idea fields, ticks | 6 (2 MEDIUM) | 1 confirmed, 5 partly; both MEDIUMs are LOW after V3 |
| L4 | The host and the bounds: budget, deadline, caps, fairness, state, gate, rules, guards, census | 4 + 4 nits (1 MEDIUM) | 6 confirmed, 1 partly, 1 refuted (one nit, the parent read, was against the letter); the MEDIUM is LOW after V4 |

| Id | Severity after verification | Finding | Verdict | Disposition |
|---|---|---|---|---|
| L1-1 | LOW | A starting lifetime's route came from one field compared with nothing, so a missing `outgoingPositionId` or live `positionId` would flip its id to the fallback between runs and mint a second pointer. No writer produces it. | CONFIRMED | **Fixed:** the battle's stamp (`scoring.stockThresholdModel`, now in the field mask) and every lifetime's own id field must agree, else the slot is `inconsistent`. V1 checked that no real document from either writer, crypto included, is flagged. |
| L1-2 | nit | The tenant counted every gap starting lifetime as `gap`, written or not. | PARTLY | **Fixed:** counted apart as `gapStarts`; the census says which were written. |
| L1-3 | nit | The census called every non-discoverable pointer "beyond retained history", gap or not. | CONFIRMED | **Fixed:** only under a gap; otherwise `writtenNowUnresolved`. |
| L1-4 | nit | Position ids were not checked as document ids before the pointer read. | CONFIRMED | **Fixed** by the L1-1 check (an id outside `[A-Za-z0-9_-]{1,128}` makes the slot `inconsistent`). |
| L1-5 | nit | An unused index follows array order; a gap's crypto start is classed from the roster. | PARTLY | No change: the index never leaves `lifetimesOf`; the roster class only chooses a counter (decision 4). |
| L2-1 | LOW (was MEDIUM) | Writes waited for every store call; a call over 5 s admitted late could end in the last 2 s and skip the whole write phase, evidence in hand included. V2: a narrow window, a consequence of the prompt's own numbers, and a contract-accepted deferral. | PARTLY | **Fixed:** writes run beside acquisition (decision 17); a row shows evidence in hand written while three slow calls end with 1.7 s left. |
| L2-2 | LOW | A key whose activations were all written stayed carried and was fetched every run for three days. | CONFIRMED | **Fixed:** a key is carried only while one of its activations is unwritten. |
| L2-3 | LOW | Tick reads were not taken due-first. | CONFIRMED | **Fixed:** finalisation-due battles first. |
| L2-4 | nit | The stored-equals-document claim is false for a terminal battle whose expiry is after its cutoff, or has none. | CONFIRMED | **Fixed:** the comment states the exception; a row pins it. Queue placement only. |
| L2-5 | LOW | The census treated expired, unsettled battles as in flight until the 02:00 UTC settlement. | CONFIRMED | **Fixed:** in flight = not terminal and not yet expired (decision 18). |
| L2-6 | nit | An unreadable state was overwritten with an empty-based one; abandonment has one generic reason. | PARTLY | **State half fixed** (never written over a state the run could not read). The reason half meets the letter: `calendar_missing` is the only reason the contract names, and the rest is unknowable at the horizon without reads. |
| L3-1 | LOW (was MEDIUM) | `activatingTick.evaluationId` is the row's `evaluationId`. V3: the build's reading is the stronger one (§4.5's shared placeholder; "the other three fields null" only under `unavailable`); one comment and one test title overstated it. | PARTLY | Comment and title fixed. **Question Q2.** |
| L3-2 | LOW (was MEDIUM) | A transient read error in the resolver freezes a create-once pointer as `unresolved`. V3: fails safe, follows §4's letter; deferral is closer to the intent. | PARTLY | Built to the letter. **Question Q3.** |
| L3-3 | nit | A battle with no `agentId` would be recorded `resolved` with a null id. No in-scope battle can lack one. | PARTLY | **Fixed** defensively: counted `malformed`, never written. |
| L3-4 | nit | A final without a readable `capturedAt` would give an entry with null timing. Cannot happen. | PARTLY | **Fixed** defensively: such a final does not serve; `snapshotCapturedAt` is the normalised instant. |
| L3-5 | info | `tick_action` could carry null ids. V3: a null `evalId` is real and honest (a risk action in a tick that exited before it identified an evaluation); a null `tickSeq` cannot occur. | PARTLY | My first fix (both null → unavailable) was **corrected after V3**: only a non-finite `tickSeq` reads `unavailable` (malformed); a null `evalId` is kept. |
| L3-6 | info | No activationEvidence module logs; ids reach logs only through the resolver and the store, as before. | CONFIRMED | §12's log plan names those lines. |
| L4-1 | LOW (was MEDIUM) | The same mechanism as L2-2, found independently: dead carried keys re-acquired until their horizon; V4 added that a carried key was offered once more even past its horizon. | PARTLY | **Fixed** with L2-2; a carried key past its horizon is no longer offered (`carried_past_horizon`). |
| L4-2 | LOW | The owner order was fixed, so at scale late owners could starve and pruning stall; the state's `battles` map reaches Firestore's 40,000 index entries a document at about 5,000 battles (map subfields are indexed by default). | CONFIRMED | **Owner order fixed** (decision 21). The index-entry ceiling is far from two owners; **before widening the allowlist**, add a `fieldOverrides` exemption for `activationObserverState.battles` (§13). One persistently failing owner query still stalls pruning (the index stores no owner); it costs size, never a pointer. |
| L4-3 | LOW | The census counted `finalization_undetermined` over out-of-scope battles too. | CONFIRMED | **Fixed:** in scope only. |
| L4-4 | LOW | "Pure" and "read-only" were pinned on direct imports only; `pointer.js` loads 30 modules transitively, some I/O-capable, and the census reaches `marketDataCache.js` through the session wrapper. Nothing is called. | CONFIRMED | **Reworded** in the boundary test and `pointer.js`'s header; both reaches come from imports the prompt requires (`frozenNamesOf`, `lastCompletedSessionAt`). |
| L4 nit-1 | nit | The flag-off host row's I/O counter matches paths containing "activation" only. | CONFIRMED | No change: the observer's first read (the state) is caught, and the byte-golden catches any change to the response. |
| L4 nit-2 | — | A casual clone's attribution is two sequential reads under one budget check, so the parent read could start after 6 s: **against the prompt's letter**. | CONFIRMED | **Fixed:** each of the resolver's reads is admitted by the budget; a refused read defers the battle (`prep_cut`), never `unresolved`. A read started before 6 s may still run past it (no read is raced). |
| L4 nit-3 | — | The docs the code cites were not in the code commit. | CONFIRMED | This build's docs commit. |
| L4 nit-4 | — | A multi-day battle longer than ~10 days would leave the 14-day lookback before its horizon. | REFUTED | The longest duration is five trading days: cutoff + 3 days is at most ~13 days. |

**Attacked and not broken, across the lenses:** a wrong id or instant on any real writer's document (in L1's own scratch tree, the real legacy writer through a 51-swap gap; the committed row's real corrected writer A → B → A); a guessed id; ordering under skew; a null pointer before the cutoff, on `pending`, on a throw, on an unreached key or on another run's `retryable`; a final used for another key; a set, update or merge on a pointer; a clock read past `now`; any timezone dependence (four zones); a store call or transaction without its reserve; concurrency above 3 or any cap exceeded; a cursor that does not advance; a read before the gate or of another owner's battle; a garbage state changing a pointer; any id, symbol or path on any census channel; the flag-off response (the base handler reproduced the golden strings exactly).

**Mutation lens.** On its own tree of the fixed head `da910626`, one defect at a time, the pure suite and (for the tenant and the writer) the emulator suite, one emulator at a time: **71 planted, 64 killed, 7 survived, 0 broken.** The killed set covers every lifetimes consistency check and the new route check, the gap rule, class, the schedule's cutoff, comparison, null cutoff and horizon, the tick join's commit, completeness, grace and ambiguity rules, every pointer representation, the key's two refusals, the census's sentinels, precedence and cohort, the writer's final read, create-once and key check, and the tenant's null rule (`pending`, unreached, before the cutoff), the shared cap, both reserves, the preparation budget, both kinds of cursors, owner scoping, carried keys, state failures, the writes beside acquisition, the carry rule, an unreadable state, owner rotation, the malformed-battle skip and the budgeted attribution. One killed mutant, `set` in place of `create` in `createWithEvidence`, changes no behaviour (the transaction reads the pointer first), so its only guard is the static boundary row, by design. **All 7 survivors were real test gaps, none equivalent**: a store throw at finalisation (TN02 — the null rule's "this run's own `retryable`" had no row at the cutoff), a failed battle read and the due cursor (TN11), the due-first write gate (TN17), tick reads due-first (TN19), a carried key past its horizon (TN23), the legacy creation instant (LT15) and its normalised fallback id (LT16). Each got a row at `04ac5510`. Re-planted on a fresh archive of `04ac5510` with the committed rows: **7 of 7 killed, each by its own row and by no other** (the two lifetimes mutants on the pure suite, the five tenant mutants on the emulator suite), and the tree restored after each.

## 11. Runs

On the code head `04ac5510` (`origin/main` still `f3da14a3`, so the PR tree is the branch tree). Linux is WSL Ubuntu, Node 20.20.2 (CI's), in a private worktree of `~/pd-ci` at the exact commit with a fresh `npm ci` (lockfile `40382e64edb6`).

| Check | Where | Result |
|---|---|---|
| Full vitest suite | Linux, `TZ=UTC`, `--maxWorkers=8`, under `flock` | 1,284 files passed, 8 skipped; 28,433 rows passed, 0 failed, 89 skipped; 225 s |
| `npm run test:rules` | Linux, Temurin 21, the Firestore emulator | 32 files, 607 rows passed (542 at base + 65 new) |
| `npm run lint:gate` | Linux | exit 0 |
| Golden guard | `scripts/ci/tf-setup-golden-guard.mjs`, compare mode against `f3da14a3` | PASS: golden `767d22633672`, `tf-setup-v1/sem-1`, one baseline entry, no new entry |
| Host byte identity | `process-pending-reflections.activationEvidence.test.js` | the three flag-off responses equal the strings the base handler gave (L4 re-ran the base handler on the same fixtures: identical) |

Earlier runs, for the record: at `8b023da5` the suite showed 2 failing rows, both this build's: the executor census (the first draft of the real-writer row called the fenced `executeSwapServer`) and the `equippedHypothesis` census (two new readers unlisted). Both were fixed before review closed (Q5; the census lists the two readers with their reasons). At `c632a4d0` the suite and the emulator suites were green. On Windows, `filmTape/tapeWiring.test.js` failed to load in this CRLF worktree (a parse error; none of its imports changed); it passes on Linux, the suite of record.

The docs commit on top holds documents only. Its own suite, lint gate, emulator suites and `vite build`, on the exact pushed head, are in the PR description.

## 12. The census: reading plan

**Run** (repo root, the founder's machine, production credentials from `.env.local`; nothing is written but the two local files):

    node scripts/census-activation-evidence.mjs --session <the session> --out census-<date>.md --json census-<date>.json

- **After the first full session:** `--session` that session, `--sessions 1`. Read first: the cohort size and in-flight count; §3's headline (pointers with evidence ÷ discoverable resolvable activations) — it should be near 1 for battles whose activations dated to an earlier session; §1's null pointers by `missing.detail` (expected only for after-close activations whose bar had not arrived by 01:45 UTC); §2's exclusions; §4's categories (any `liveLease` or long-aged `observationAwaiting` is worth a second read an hour later).
- **After a week:** `--sessions 5`. Read §5: minutes from each session's close to the final snapshot's `fetchedAt` for after-close activations, and the outstanding keys' attempts — this is the measured newest-session cutoff the contract asked for.
- **The log plan (Vercel, the founder reads it):** in the production logs of `/api/cron/process-pending-reflections`, filter the prefix `[setupEvidence]` with the text `fetch failed` (written by `acquireOnce`, `api/_utils/setupEvidence/acquire.js:102`) over each evening from the session close (20:00 or 21:00 UTC) to the 01:45 UTC run. Count the lines per run time; compare with §5's attempt counts. The same prefix with `mapDailyRows dropped` (`acquire.js:112`) and `lease release failed` (`index.js:80`) should be zero. These lines carry a symbol and a session; they stay in Vercel and are never copied into a report.

## 13. The founder's steps

1. Review this PR's CI run (`vitest (unit)` and `firestore rules + emulator suites`), then merge.
2. **Publish the Firestore rules** (this build adds two server-only collections).
3. **Deploy the indexes**: the composite `agentBattles (ownerId ASC, createdAt DESC)`, and (since the rulings round, §16) the two single-field exemptions on `activationObserverState` (`battles` and `outstandingKeys`, contract V1.8 §4.4). Wait for the composite to build.
4. After the deploy, confirm the reflections cron in Vercel's cron list shows the hour 1 (`*/15 13,…,23,0,1 * * *`).
5. When you choose: the flag flip as its own PR — the flag line to `true`, the pin row in `src/config/activationEvidenceFlags.test.js` to `true` with its registration row turned around, and the `DARK_BY_DESIGN` entry dropped, in one commit. The allowlist is the existing `COCKPIT_ALLOWLIST_UIDS`.
6. Then the census after the first full session and again after a week (§12).

(The former step 7, exempting the state's `battles` map from indexing before widening the allowlist, is done: the founder ruled it in now, and step 3's deploy carries it; §16.)

Pushed is not deployed. Crons do not run on Vercel preview.

## 14. Questions, none blocking

All of these can be answered before the flag flip; no pointer exists until then.

**Ruled 6 November 2026** (founder; contract V1.8 §12; built in the rulings round, §16). Each ruling sits beside its question below.

| Question | Ruling | Code change |
|---|---|---|
| Q1 | Keep as built | none |
| Q2 | `activatingTick.evaluationId` is `null` on every path | `tick.js` |
| Q3 | A failed resolver read defers; `unresolved` only on a verdict | `attribution.js`, one line of `tenant.js` |
| Q4 | Keep as built (V1.8 §4.2 now states it) | none |
| Q5 | Keep | none |
| Review L4-2 | Exempt the state's maps from indexing now | `firestore.indexes.json` |

- **Q1 (the gap, legacy route).** Under a gap the contract makes every unwritten starting lifetime `gap`. On a legacy battle the starting position's id does not depend on any row (`${tier}:${slot}:${battle.activatedAt}`), so whether it was written is checkable even under a gap, and it could even be written then if its class were known. Built to the letter (never written under a gap). Keep it, or let the next contract version name and write legacy starting positions under a gap? Recommendation: keep — the observer runs every 15 minutes, so a starting position is written long before 50 trades exist.
  - **Ruling (6 Nov): keep as built.** No change; V1.8 §4.1 is unchanged.
- **Q2 (`activatingTick.evaluationId`, review L3-1).** Built as the row's `evaluationId` on `tick_action` and `null` on `unavailable`: §4.5 shows one placeholder for it and `tradeRef.evaluationId`, and §4 nulls "the other three fields" only for `unavailable`. On a proposal execution that value is the proposing check's `eval_NNN`, not the executing tick's, and it duplicates `tradeRef`. Keep it, or make it `null` on every path (no committed tick field carries one)? Recommendation: `null` on every path in V1.8, since `tradeRef` already holds the row's id and a reader may take the field for the tick's.
  - **Ruling (6 Nov): change — `null` on every path, `tick_action` included.** `tickSeq` and `evalId` still come from the tick record; `tradeRef.evaluationId` still carries the row's id (V1.8 §4, §4.5). Built in §16.
- **Q3 (attribution on a read error, review L3-2).** The resolver turns a read error into the clone's own id, so a Firestore blip on a casual-clone battle writes a create-once pointer as `unresolved` (built to §4's letter). Other runs' pointers of the same battle then resolve to the parent. Keep it, or defer the battle's writes on a read error and write `unresolved` only on the resolver's real verdicts (missing clone, missing or empty parent id, missing parent, owner mismatch, self-reference)? Recommendation: defer, in V1.8. `casualClone.js` need not change: a recording database handle in `attribution.js` can tell the two apart.
  - **Ruling (6 Nov): change — a resolver read that fails defers the battle's writes for this run; `unresolved` is recorded only on the resolver's verdicts** (V1.8 §4, §4.2). `casualClone.js` is unchanged. Built in §16, counted as `deferred.attribution_read_error`.
- **Q4 (the write order, decision 17).** Keep the writes beside acquisition, or return to the strict step order and raise `ADMISSION_RESERVE_MS` to about 9–10 s? Recommendation: keep. It changes no stated rule, and the strict order loses evidence it already holds.
  - **Ruling (6 Nov): keep as built.** V1.8 §4.2 ("Order of work") now states it. No change.
- **Q5 (a test that reaches a fenced function, §8).** The observer calls no fenced function. One lifetimes row drives the non-fenced corrected writer (`stockThresholdAdmission.js` `executeCorrectedStockSwap`) to produce real documents, and that writer itself calls the fenced scorer `calculateAssetScoreServer`. The first draft of the row called the fenced `executeSwapServer`; the Linux suite's executor census caught it, and it was changed. If the prompt's "call a fenced function" covers tests too, the row can go; the hand-built fixtures cover the same cases. Recommendation: keep.
  - **Ruling (6 Nov): keep.** The fence governs edits and product calls; a test exercising a real writer path is allowed (V1.8 §12). No change.
- **Review L4-2 (the state document's index entries; §13's former step 7).**
  - **Ruling (6 Nov): change — exempt the state's maps from indexing now, not before widening.** Built in §16 (`battles` and `outstandingKeys`, V1.8 §4.4).

## 15. Before declaring done

The second advisor consultation came after every commit existed and the final runs were green on the exact head. The advisor said: "Everything the prompt ordered is built, reviewed, mutation-checked and green on the exact head. Nothing blocks the push." What changed because of it:
- This section: the consultation is recorded here, in the report, by amending the docs commit rather than stacking a second one (Build 1's precedent), and every check was re-run on the amended head (the PR description gives the numbers).
- Before the push, the remote was checked for an existing `claude/activation-observer` branch or PR (this prompt supersedes V1 and V2), with no force-push if one existed.
- After the PR opened, nothing more: no binding, no CI watching, no auto-merge (BUILD_RULES §2).
- The PR description keeps the Q5 sentence beside "fenced functions called by the observer: none", so the one test row that reaches the fenced scorer is in view before CI.

No code changed because of it.

## 16. The rulings round (6 November 2026)

**Prompt:** the founder's rulings on Q1–Q5 (Fable, 6 Nov). **Contract:** `docs/design/20261106_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_8.md`, committed byte-identical by this round's docs commit (SHA-256 `8728966195730c18b7b85f4af3b2de6f16ebd6cf5b9c3bef4f1a371ef07502e6`, blob `8661ed58`); V1.7 stays beside it. **Executor:** Claude Code (Opus 5.5, advisor), a fresh session in its own worktree (local branch `claude/id1-build-2-rulings-5acaaa`, fast-forwarded to the PR head `96923f8c` and pushed by refspec to `claude/activation-observer`, no force). `git fetch origin` ran first: `origin/main` was still `f3da14a3`, and PR #1026 was open and unmerged at `96923f8c`.

| | |
|---|---|
| What changed | Three things, each its own commit: `activatingTick.evaluationId` is `null` on every path (Q2, `cbc3036b`); a failed attribution read defers the battle instead of recording `unresolved` (Q3, `5710f253`); the observer state's `battles` map and `outstandingKeys` array are exempt from single-field indexing (L4-2, `7dd7b1b0`). Then the review's three test points (`f8d0937d`, tests only) and this docs commit. |
| What did not | Q1, Q4, Q5: no change. No change to `casualClone.js`, the store, the evaluator, any fenced file, the flag, any other pointer field, cap, reserve, cursor or the null rule. The census reads no counter that was renamed (`deferred.prep_cut` keeps its name; the new reason is a new key), so it is untouched. |
| Mutants | 2 planted, 2 killed, each by its own rows; the unmutated tree green. |
| Review | One refuting reviewer on its own tree of `7dd7b1b0`: all four claims HELD; 3 LOW and 2 NIT, no production bug. Two LOW and one NIT fixed in tests (`f8d0937d`); the rest recorded (§16.4). |
| Runs | All green on the code head `7dd7b1b0` (§16.5); the pushed head's numbers are in the PR description. |

### 16.1 The three changes

1. **Q2** (`api/_utils/activationEvidence/tick.js:94`): `joinTick` returns `evaluationId: null` on the `tick_action` path; the header (`:12-16`) says why. `tickSeq` and `evalId` still come from the tick record; `pointer.js` is unchanged, so `tradeRef.evaluationId` still carries the row's id. The `unavailable` and ambiguous paths already gave all three ids `null` (`UNAVAILABLE_TICK`, `:36`).
2. **Q3** (`api/_utils/activationEvidence/attribution.js:45-60`, `:72-78`): the budgeted handle the resolver reads through now also reports any throw from a read it admitted (`onThrew`, `:55`). The budget refusal is checked before the read, outside the `try` (`:50`), so a refusal is never counted as a read error; the read is `return await`ed inside the `try`, so a rejected read is caught. `attributionOf` returns `{ deferred: true, reason: 'prep_cut' }` for a refusal (as before, now with its reason) and `{ deferred: true, reason: 'attribution_read_error' }` for a throw; a non-deferred result is unchanged and carries no `reason`, so nothing new reaches `buildPointer`. The tenant counts the reason it is given (`tenant.js:270`) and, as before, writes nothing for the battle in this run: the battle never reaches the run's work list, so no store call is made for it, and its battle-index entry stays unfinished for the next run. `casualClone.js` is unchanged: it still swallows the error and returns the clone's own id; the handle is how the observer tells an error from a verdict. A missing clone, a missing or empty parent id, a missing parent, an owner mismatch and a self-reference stay `unresolved`. A null database also stays `unresolved` (nothing throws on that path; the production tenant always has a database). A read that keeps failing leaves the battle's work outstanding until the horizon, whose branch runs before the attribution call, so the work is then abandoned and counted without another read.
3. **Indexes** (`firestore.indexes.json:854-863`): two `fieldOverrides` entries, `{ collectionGroup: 'activationObserverState', fieldPath: 'battles' | 'outstandingKeys', indexes: [] }`, the same shape as the file's existing `tickBodies` and `ticks` exemptions. Nothing queries the collection: `state.js:25` reads and writes `activationObserverState/main` by id, and no other module names it. **Firebase's documented format (VERIFIED, read this session):** the `firestore.indexes.json` reference (firebase.google.com/docs/reference/firestore/indexes) documents `fieldOverrides[].indexes` as "Use an empty array to disable indexes on this collectionGroup + fieldPath", and its own example exempts a map field (`myBigMapField`) that way. The index overview (firebase.google.com/docs/firestore/query-data/index-overview, "Automatic index exemptions") says: "If you create an index exemption for a map field, the map's subfields inherit those settings." So exempting `battles` exempts every `battles.<battleId>.*` subfield. For an array, the same page lists three automatic entries, all for the whole array value (ascending, descending, array-contains), and says nothing about maps inside an array; exempting `outstandingKeys` removes those three. The page's limits table gives 40,000 index entries per document. `state.js`'s header records the exemption (`:19-24`).

### 16.2 Tests

- **Q2:** the three `joinTick` pins move to `null` (`tick.test.js:28`, `:35`, `:64`); a new row drives `joinTick` into `buildPointer` (`tick.test.js:37`): a `tick_action` pointer has `evaluationId: null` and `tradeRef.evaluationId` keeps the row's id (`eval_007`, a proposal execution's), and an `unavailable` pointer has all three `null`. The §4.5 canonical fixture moves to `null` (`pointer.test.js:17`). The emulator row pins `null` and `tradeRef.evaluationId: 'eval_012'` on a written pointer (`test/rules/activationObserver.rules.mjs:285-286`).
- **Q3 (pure, `attribution.test.js:72-112`):** a clone read that throws → deferred `attribution_read_error`, and the parent is never read; a parent read that throws → deferred; a read that throws a plain `TypeError` with no code → deferred, on either read (added after the review, `:89`); every read failing → deferred, and the same agents healthy → resolved to the parent; a throw from the read seam counts as a failed read, while a refusal is `prep_cut`; a ranked battle needs no read, so a failing database cannot defer it. The "read error" row left the `unresolved` table, which now holds only the five verdicts; the null database has its own row (`:44`, unchanged behaviour, not one of the contract's verdicts). The budget row's pin gains `reason: 'prep_cut'`.
- **Q3 (emulator, `activationObserver.rules.mjs:465`):** the real database behind a proxy whose every `agents` read throws: the casual clone's battle gets no pointer, `deferred.attribution_read_error` is 6, `prep_cut` is absent, and no store call starts; the next run on the plain database writes the six pointers `resolved` to the parent (`attributionAgentId` and `stream.attributionAgentId` `agent-p`, `clone: 'casual'`).
- **Indexes (`activationEvidenceRulesTripwire.test.js:48`):** exactly the two overrides on `activationObserverState`, none on `activations`; the exempt fields are the state's own keys, the state is addressed by `collection(...).doc(...)` only, and no query is built on its collection in `state.js` or `tenant.js`.

### 16.3 The two mutants

On a separate LF `git archive` of `7dd7b1b0` in the session scratchpad (`node_modules` junctioned), one at a time, each judged by exit code and the JSON reporter's failed rows (the JSON deleted before each run), then restored from `git show 7dd7b1b0:<path>` and compared:

| Mutant | Planted | Pure suite (`api/_utils/activationEvidence/`, 130 rows) | Emulator file (49 rows) |
|---|---|---|---|
| Q2-M1 | `tick.js:94` back to `evaluationId: row.evaluationId ?? null` | **killed**, exit 1: 4 rows, all in `tick.test.js` (the new pointer row, the two `tick_action` pins, the null-`evalId` row) | **killed**, exit 1: 1 row, the tick-action row (`:277`) |
| Q3-M1 | `attribution.js:78` deleted, so a thrown read falls through to `unresolved` | **killed**, exit 1: 4 rows, all in the new Q3 block (clone throws, parent throws, every read failing, the seam) | **killed**, exit 1: 1 row, the new Q3 row (`:465`) |
| control | none | exit 0, 0 failed | the same file passed 49 of 49 on the fix tree on Windows before the commits, and in the runs below |

Each mutant is caught by its own rows and by no row in another file.

### 16.4 Independent review

One review subagent, instructed to refute, on its own read-only LF `git archive` of `7dd7b1b0` in the session scratchpad (`node_modules` junctioned; no git writes, nothing written in the repository, no emulator, since the Linux emulator run was in flight; it read the emulator file instead). It ran its own differentials and mutants, restored each file from the commit, and ended on a green control (130 of 130).

| Claim | Verdict | What the reviewer tried |
|---|---|---|
| 1. Q2 changed only `activatingTick.evaluationId` | **HELD** | A differential of `joinTick` at `96923f8c` against the head over 234 cases (six swap-ins, thirteen tick reads, three clocks; row ids of several shapes, ticks carrying their own `evaluationId`, malformed `tickSeq`, two matches, incomplete reads): with that one field removed, every result and every built pointer was identical, key order included; the head's value was `null` in all 234; `unavailable` and ambiguous joins give all three ids `null`; starting positions still give `activatingTick: null`, `tradeRef: null`. |
| 2. Q3 cannot record `unresolved` on a thrown read, nor defer a verdict | **HELD** | Traced `casualClone.js:297-326`: every verdict is a plain return, so `onThrew` (only in the catch around an admitted read) cannot fire on one; a differential of `attributionOf` at `96923f8c` against the head over the five verdicts, a non-string parent id, the healthy case and a ranked battle: identical, `deferred: false`. Its mutant removing `await` from the guarded read was killed by three Q3 rows. The tenant counts the reason under its own name and `continue`s before the battle joins the work list. |
| 3. The exemption touches only the state collection | **HELD** | The diff appends two entries after `tape/etDate` and changes no other override or composite; the shape (`collectionGroup`, `fieldPath`, `indexes`) is that of 19 of the file's 21 existing overrides (the other two add `ttl`); Firebase's two sentences confirmed on the fetched pages; nothing in `api/`, `scripts/` or `src/` queries the collection (the one collection-level access is inside an `assertFails` in `test/rules/activationEvidenceDenials.rules.mjs`). |
| 4. Nothing else moved | **HELD** | Exactly the ten listed files; `casualClone.js`, `constants.js`, `writer.js`, `pointer.js`, the store, the evaluator, the fenced files and the flag untouched; nothing outside the module lists the deferral reasons, and the census reads none of the tenant's counts. |

**Findings and dispositions**

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| RV-1 | LOW | The tenant's use of `attribution.reason` (`tenant.js:270`) is guarded only by the emulator suite: its mutants "count every deferral as `prep_cut`" and "count one per battle" survive the default suite and die only on the emulator row (`activationObserver.rules.mjs:483-484`). | **Recorded.** The tenant has no default-suite harness (it is the I/O module; every tenant behaviour is proven on the emulator), and the emulator suite runs on every PR in CI's `rules` job (`tests.yml:191`). |
| RV-2 | LOW | "Any throw counts as a failed read" rested on the read seam: this round's `dbOf` throws coded errors, so a filter on `err.code` died only on the seam row. | **Fixed** (`f8d0937d`): a database read throwing a plain `TypeError` with no code defers, on either read (`attribution.test.js:89`). Planted again on the snapshot with the seam row removed: killed by the new row alone; control green. |
| RV-3 | LOW | The null database sat in the "unresolved (a verdict)" table, beyond the contract's five verdicts. | **Fixed** (`f8d0937d`): its own row, named as unchanged behaviour the tenant never reaches (the host always passes a database, and with none the state and candidate reads fail before any battle is read). |
| RV-4 | NIT | The second index tripwire row's title said "nothing queries the collection", more than it checks (only chained calls in `state.js` and `tenant.js`). | **Fixed** (`f8d0937d`): the title says what it checks. |
| RV-5 | NIT | Throws that do not pass through the handle still give `unresolved`: `.data()` or an `exists` getter throwing, a `get()` resolving to `null`, `mayRead()` throwing. | **Recorded.** None is a read failing: the Admin SDK's `data()` decodes a document already fetched, `get()` never resolves to `null`, and `mayRead` is a clock comparison. V1.8 says "either of the resolver's reads fails". |
| RV-6 | note | Outside this round: `casualClone.js:317` accepts a parent when both `ownerId`s are `undefined`. | **Reported for separate tasking** (BUILD_RULES §3), not fixed: the file is outside this round's scope and `buildCasualCloneDoc` always writes `ownerId`. |

Two of the reviewer's mutants survive by design: taking `evaluationId` from the tick record is unreachable (the tick read's field mask, `TICK_FIELDS`, `constants.js:63`, carries no such field), and a two-statement query on the state collection would slip past the tripwire's regex (RV-4's scope, now stated in its title).

### 16.5 Runs

On the code head `7dd7b1b0` (`origin/main` still `f3da14a3`, so the PR tree is the branch tree). Linux is WSL Ubuntu, Node 20.20.2 (CI's), in a private worktree of `~/pd-ci` at the exact commit, `node_modules` linked to a real install of the same lockfile (`40382e64edb6`, hashed inside WSL).

| Check | Where | Result |
|---|---|---|
| Full vitest suite | Linux, `TZ=UTC`, `--maxWorkers=8`, under `flock` | 1,284 files passed, 8 skipped; 28,440 rows passed, 0 failed, 89 skipped; 233 s. Seven rows more than §11's 28,433: one Q2 row, four Q3 rows net (five added, the "read error" row removed from the `unresolved` table), two index rows |
| `npm run test:rules` | Linux, Temurin 21, the Firestore emulator | 32 files, 608 rows passed (607 + the Q3 row) |
| `npm run lint:gate` | Linux | exit 0 |
| `vite build` | Linux | exit 0, built in 14 s (esbuild CSS-syntax warnings on an inline stylesheet's comment and keyframes; the PR changes no CSS) |
| Golden guard | `scripts/ci/tf-setup-golden-guard.mjs`, compare mode against `f3da14a3` | PASS: golden `767d22633672`, `tf-setup-v1/sem-1`, one baseline entry, unchanged |

After these runs, the review's test commit `f8d0937d` added one row (the plain-error row; the null-database row moved out of a table, so the count is the same) and the pure module ran 131 of 131 on Windows. The docs commit on top holds documents only. The suite, emulator suites, lint gate, `vite build` and golden guard on the exact pushed head, which includes both, are in the PR description.
