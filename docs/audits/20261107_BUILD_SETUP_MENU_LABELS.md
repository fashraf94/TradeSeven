# Build report: Measured Trend Evidence, Slice 2 — setup labels on the candidate menu (disabled build)

Claude Code (Claude Opus 5.5), 7 November 2026, for Flash. §0–§1 were committed first, before any code, as the instruction required (the controlling amendments and the plan mapping each to code and tests; commit `f484ba53`). §2–§10 record what was built, the review and the runs. **Delivery ends at the pushed draft PR: no merge, deploy, flip, production read, provider request, model job, census run or CI watching.**

## 0. Preamble

| | |
|---|---|
| Instruction | "Measured Trend Evidence Slice 2 — disabled-build kickoff with binding V2 corrections" (7 Nov 2026), committed byte-for-byte as `docs/design/20261107_P3_SLICE2_DISABLED_BUILD_KICKOFF_V2_CORRECTIONS.md`. It controls wherever it conflicts with V2 or the resolution note. |
| Historical inputs (preserved, unchanged) | `docs/design/20261107_P3_SLICE2_BUILD_SPEC_DRAFT_V2.md` (SHA-256 `423501ae32929bd15f891a95f3a8b783be484a9d402bec12c11b4bd3cf61143e`, 67,530 bytes) and `docs/design/20261107_P3_SLICE2_V2_RESOLUTION_NOTE.md` (SHA-256 `283070d48c139d2c24b39acd09f71f5a07aefcc1971c63ad430731f9d9aa1c95`, 10,377 bytes), copied from `Documents/FantasyTrades/Archetype/` with `cp`; the hashes are of the source files and of the committed blobs. |
| `git fetch origin` | Run first. |
| Build base | `origin/main` = `d503dd07df76ddfb1931935111d158c944f720ae` — **the revision the review inspected. No drift.** |
| Merged base | `origin/main` moved during the build to `d09603b259fec1b2b41abd580fd80c99e2649f89` (PR #1029, Armory A2); merged in by the app's sync at `7671f271` (two additive conflicts, both sides kept: the flag-module list in `flagPinGuard.test.js` and the protected-store allowlist). A2 touched none of `agent-evaluate.js`, the capture modules or the reflections handler. Re-fetched before the push: unchanged. |
| Final heads | **[superseded: the correction round's heads are §B.9]** code `339b1a13` (the final suite, rules and lint ran here; build, parity and golden at `0c6bda55`, which differs from it by one test row only); the docs commit on top of it holds this report, and `vite build` was re-run on that exact docs head before the push. |
| Branch | `claude/setup-menu-labels-slice2`, cut from `origin/main` in a fresh app worktree; no upstream set (push by refspec). |
| Decisions | D-1 to D-5 and D-7 accepted as amended below. **D-6 unresolved: gates production activation only.** |
| Delivery | Draft PR, then STOP. No merge, deploy, flag flip, production read, provider request, model job, census run or CI watching. |

### 0.1 Anchor re-check at `d503dd07` (VERIFIED, read this session)

| V2 anchor | Found |
|---|---|
| `agent-evaluate.js:1060` `pendingNarrations` | `:1060` `const pendingNarrations = [];` (outside the `try`). |
| `:1577-1585` the menu builder | `:1577` `buildArchetypeCandidateMenu({...})` inside `if (rebuildHotBench && battle.watchlist) {` (`:1564`); `archetypeMenu` non-null → archetype path (`:1587`), else the legacy fallback. |
| `:1694-1716` hot-bench asset map and merge | `:1694-1707` the map (not benched, not held, not rival-held); `:1710-1716` the merge into `battle.portfolio.bench.stocks`. |
| `:2831-2846` catalyst additions | `:2831-2846`, each also pushed into `battle.portfolio.bench.stocks` (`:2846`). |
| `:2898-2906` the universe capture | `:2898-2906`, `candidateSymbols: [...hotBenchSymbols, ...Object.keys(hotBenchAssetMap)]`. |
| `:2908` the no-trigger branch | `:2908` `if (!shouldEvaluate) {`; its awaited `battleRef.update(scoreUpdate)` at `:2931`. |
| `:3013` the admission test | `:3013` `const budget = shouldStartHaikuCall({ elapsedMs, timeBudgetMs: TIME_BUDGET_MS, callsReserveMs })`. |
| `:5037` `finalizeTickCapture` | `:5037`, inside `if (tickCapture.enabled && exitReason !== 'tick_error')` (`:5033`); the error path at `:5172`. |
| `captureContext.js:102-109` `NOOP_METHODS`; `:176-182` the `guard` that writes `faulted` | as cited. |
| `captureSerializer.js:50-60, :308-323` | `ENUM_LISTS`, `ID_RE`, `SYMBOL_RE`; `pathProbes` splits on `.`. |
| `captureWriter.js:76-78, :283, :438-446, :476-512` | `approxBytes`; the conditional spread; rejections into the body's `rejectedFields`; the shed loop measuring `max(body, permanent)`. |
| `setupEvidence/acquire.js:42`, `:148` | `ACQUIRE_TIMEOUT_MS = 5_000` at `:42`; `snapshotDocOf` sets `capturedAt: fetchedAt` at `:148`. |
| `setupEvidence/store.js:35, :37, :146-148` | `LEASE_MS`, `CONFIRM_AFTER_MS`, the confirmation test. |
| `process-pending-reflections.js:303-320` | the observer, step 8, and the response spread pattern. |

No material contract or fence conflict was found, and no line drifted.

## 1. The controlling amendments (verbatim text: §A; the plan for each: here)

Each clause of the instruction, the code that implements it and the acceptance rows that test it, as committed BEFORE the code (`f484ba53`) and left as written. What was built is §2–§4 (the review's changes included, §6), the rows that test each clause are §5, and their results §7. Every planned acceptance case has a row (some titled by V2's row number rather than the id given here), with three additions from the review: SM1-1 (fail closed), SM2-3 (the error exit settles) and SM3-2 (a queued reservation rechecks admission).

### Correction A — optional reads add no deliberate wait

| Clause | Code (planned) | Acceptance (planned) |
|---|---|---|
| Pure pool freeze; the two post-admission read-start sites kept | `setupMenuLabels/pool.js` (pure) through `reads.js` `freezeSetupMenuPool(tickCapture, inputs)`; `agent-evaluate.js` starts reads at the first statement of `!shouldEvaluate` and after `shouldStartHaikuCall` | 1.10 freeze makes no db call; A-1/A-2 the 64/68 s boundaries unchanged |
| At finalization take only results already available; settlement wait zero | `reads.js` `settleSetupMenuReads` is synchronous: seal, copy, compose; no timer, no await. V2's `settleWaitMs` field is dropped (always 0) | A-3 no-trigger exit with a state read resolving at 2,900 ms → `stateRead: false`, every `s2*` null (row 1.3 corrected); A-4 model tick whose call outlasts the read → read available, no wait |
| Unfinished results stay `read_unsettled`; no later result patches the record | the results map is sealed; the composed block is deep-frozen; late callbacks check `closed` | A-5 late resolution after the seal: written block unchanged, results map unchanged |
| Rejection handlers from creation | every read promise gets `.then(ok, fail)` in the expression that creates it | A-6 rejected state read and rejected snapshot reads: no unhandled rejection, `read_failed` |
| Seal on capture, error exit or deadline; stop admitting queued reads; clear timers | `sealSetupMenuReads` (idempotent) in the `finally` on every exit; a per-observation deadline timer (`unref`, cleared on seal) | A-7 error exit seals; A-8 queue closed: queued reads never start; A-9 timer cleared |
| Late callbacks never mutate a recorded object or start reads for a closed observation | the pump skips closed observations | A-8, A-5 |
| Issued read-only RPCs not awaited; no claim that a timer cancels an RPC | no await on exit; the report says a released slot does not cancel its RPC **[superseded, §B.4 F1: no slot is released early any more; a read's charge ends only at its own settlement]** | stated in §3 |
| Bound memoized work across ticks, prior unresolved reads included | a run memo keyed on the invocation's `summary` object (WeakMap): one state read per run, one read per snapshot id per run, ≤ 5 in flight run-wide, ≤ 240 distinct snapshot reads per run; a read's slot is released at its own 3 s deadline (the RPC is not cancelled) so a hung read cannot starve later ticks **[plan as committed; superseded by the correction round, §B.4 F1: each read stays charged until its own promise resolves or rejects, and hung reads leave later names `read_unsettled`]** | A-10 multiple battles on one handler clock: a hung read in battle 1 adds no wait to battle 2 and is not re-issued; the run cap holds |
| Costs reported honestly | the record carries `readsIssued` / `readsShared`; §3 states CPU, read and serialization costs | — |

### Correction B — reservations survive failed outcome writes

| Clause | Code (planned) | Acceptance (planned) |
|---|---|---|
| Unique operation token, generated outside the transaction callback, reused on retry | `tenant.js` mints `randomUUID()` before `reserveKey`; `state.js` reserve: an entry already holding this token returns `reserved` (replay) without a second count | B-1 transaction callback retry: `n` counted once |
| Outcome/refund/release only for the matching active operation, once | `completeKey`, `cancelKey`: apply iff `activeToken === token`; on apply `activeToken = null`, `lastToken = token`; `lastToken === token` → `already_applied`; else `stale` | B-2 duplicate outcome; B-3 pending refund repeated (one decrement); B-4 late completion after takeover changes nothing |
| Store calls outside transaction callbacks | the store call sits between two awaited transactions | static row |
| A reservation with no saved outcome is not retryable when its 120 s expire; durable recovery; next attempt ≥ 31 min after the recovery observation; no new allowance spent; due time not extended again; reservation stays counted | reserve transaction: active token and `inFlightUntil ≤ now` → `activeToken = null`, `recoveredAt`, `lastOutcome: 'unresolved'`, `dueAt = now + 31 min`, `n` kept, refused `recovered` (no request this run); the next run sees `not_due` | B-5 crash after reservation; B-6 completed fetch with lost outcome write; B-7 recovery without an early fetch (runs at +15/+30 min refuse, +46 min may request); B-8 recovery happens once |
| Recovered or superseded tokens cannot shorten the backoff or refund another operation | token check in `completeKey` / `cancelKey` | B-4 |
| Recheck admission and ownership immediately before the store call | after the serialized reserve returns: `deadline − now ≥ 7 s` and the result is our token; else token-checked `cancelKey`, no store call | B-9 admission lost during reservation |
| Uncertain commits conservative | a rejected reserve transaction → no request; a token-checked cancel is attempted (refunds only if our token landed) | B-10 lost reservation acknowledgement |
| Monotonic governed-session retention across overlapping runs | `finishRun` transaction: `governedSessions` only moves forward; prune only `session <` the previous session of the newest known current session | B-11 overlapping session rollover: an older run never deletes a newer session's counters |
| No governed exhausted key evicted; unreadable state or failed reservation → no request | `state_full` refusal; no eviction code exists | 2.8, 2.9 |
| Three non-refunded reservations; reservations counted apart from provider calls | `MAX_RESERVATIONS_PER_KEY_PER_SESSION = 3`; the tenant passes a counting wrapper as the store's `fetchPayload` (same arguments, same result), so `providerRequests` is a real count beside `reservations` and `storeCalls` | 4.7 counts; B-12 a final cache hit is a store call with zero provider requests |
| 31 min is Slice 2's scheduling, not a confirmation guarantee | stated in §3 and in `constants.js` | 2.3 a further `retryable` is legitimate |

### Correction C — protect the whole existing record

| Clause | Code (planned) | Acceptance (planned) |
|---|---|---|
| Candidate array, 48 cap, 24 KiB block cap; cap applied before reads; omitted names counted, never read | `pool.js` caps at freeze; `reads.js` reads only pool candidates | C-1 60 + 5 names → 48 candidates, `omittedCount`, zero reads for omitted names |
| Narrow optional-block admission in `captureWriter.js` before optional bytes can trigger shedding | the base record is composed, sanitized and shed exactly as today, with no block present; then the block is sanitized in its own pass and attached only if `approxBytes(permanent + block) ≤ maxDocBytes`; else a minimal error form (`record_budget`) if it fits; else omitted | C-2 permanent record close to the budget: block dropped, base unchanged; C-3 a normal body is never shed to keep the block |
| Malformed/error-form blocks contained locally; not through the shared fault text | the context's `setupMenu` setter has its own try/catch and never sets `faulted`; the freeze and settle calls catch their own errors (inputs evaluated inside); a block the sanitizer would reject becomes the error form (`block_rejected`), never `rejectedFields` | C-4 malformed block; C-5 the error fallback itself; C-6 a throwing freeze input (truthy non-array `bench.stocks`) leaves `faults.capture` null; rows 1.7/5.5 body identical |
| Capture constants, general serializer admission, non-Slice-2 fields unchanged | only declared paths and lists added | parity rows |
| Ordinary timing observations preserved; parity fixtures never regenerated | `capture.preCommitMs` / `bodyMs` untouched | G.3 parity against the base tree |

### Correction D — the measurement meanings

| Clause | Code (planned) | Acceptance (planned) |
|---|---|---|
| D.1 capture time is not commit time | the field is `capturedBeforeFreeze` (= snapshot `capturedAt` < `frozenAt`, a provider-time comparison only); no commit time, no store change | D-1 provider response before the freeze, snapshot committed after it, read afterwards → `capturedBeforeFreeze: true`, and the census never counts it as decision-time availability |
| D.2 literal set membership | membership from the frozen sets: `inBenchAtFreeze` (renamed from `inDispatchedBench`) = symbol ∈ the bench at the freeze; `heldAtFreeze` = symbol ∈ held at the freeze | D-2 an original-bench name also on the hot bench → `inBenchAtFreeze: true`; held names false; no-trigger ticks |
| Model-visible denominator = `model.dispatched` AND bench membership; attempted-not-dispatched apart from dispatched transport failures | census | D-3 census rows on transport failures |
| D.3 acquisition eligibility apart from model exposure; catalysts a distinct cohort | census cohorts from `source` (`hotbench` = the persisted hot bench the tenant requests) and `inBenchAtFreeze` | D-4 census cohorts |
| A reservation is not a provider request; zero, missing and unreadable distinct; no failure claim from `n > 0` | candidate `s2Entry` (`null` unreadable, `false` no entry, `true` entry), `s2Reservations`, `s2LastOutcome`, `s2LastAt`, `s2Exhausted`; the typed `lastReason` is stored on the state entry for the census's reason table | 3.2–3.4, D-5 |
| `proposal_tick_unevaluated`, battle-scoped joins, truncation coverage, M1/M2 limits | census | 6.2–6.5 |

### Preserved boundaries

V2's file scope plus the writer admission; no change under `api/_utils/setupEvidence/` except the guard test's `ALLOWED_OUTSIDE` entries; evaluator, thresholds, golden, baseline, observer, fenced files, prompts and candidate selection unchanged; `SETUP_MENU_LABELS_ENABLED = false`, pinned and `DARK_BY_DESIGN`; acquisition after the observer with its own constants and state, never `activationObserverState`; `TIME_BUDGET_MS`, earlier tenants and observer constants unchanged. Budget terms: 24 store calls per admitted handler invocation (12 + 12); 1,248 a day only under the 52-invocation assumption; no approved provider allocation.

## 2. What was built (verdict first)

| | |
|---|---|
| Verdict | **Built dark, reviewed, ready for Astra's independent implementation review.** With `SETUP_MENU_LABELS_ENABLED = false` nothing reads, nothing writes, and the tick record, its body, every battle write, the model request and the reflections response are byte-identical to the base (proven below against a `d503dd07` tree). |
| Fenced files edited | **None** (BUILD_RULES §1). Fenced functions called: `flattenBenchServer` (`agentScoring.js`, an existing import, read only). |
| Runtime modules under `api/_utils/setupEvidence/` | **Unchanged**; only `setupEvidenceImportGuard.test.js`'s `ALLOWED_OUTSIDE` gained exact-filename entries. Evaluator, thresholds, golden, baseline, the activation observer, prompts and candidate selection unchanged. |
| Production | No deploy, no flag flip, no production read, no provider request, no model job, no census run. |

**New modules** (`api/_utils/setupMenuLabels/`):

| File | Role |
|---|---|
| `constants.js` | The named limits and closed lists; the store's timeout, lease and confirmation interval restated and pinned (`constants.test.js`). |
| `gate.js` | Flag AND cockpit allowlist, read at call time, never throwing. |
| `pool.js` | **Pure.** The candidate list from the frozen sets (Correction D.2); the 48-candidate cap applied before anything is read (Correction C). |
| `compose.js` | **Pure.** The `setupMenu` block: pre-validated against the serializer's lists, 24 KiB cap, error form, the corrected meanings (`capturedBeforeFreeze`, `inBenchAtFreeze`, `heldAtFreeze`, `s2Entry` …). |
| `reads.js` | The tick's observation: freeze (gate and scope first, inputs evaluated inside its own try), start (un-awaited reads), settle (synchronous, no wait), seal; the run memo. Never names `getOrAcquireSnapshot`. |
| `state.js` | `setupMenuLabelState/main`: the plain read, token-owned reserve/complete/cancel transactions with recovery, monotonic pruning, fail-closed reading. |
| `tenant.js` | The seventh reflections tenant; the only Slice 2 caller of `getOrAcquireSnapshot`. |

**Edited:**

| File | Change |
|---|---|
| `api/cron/agent-evaluate.js` | Import; `let setupMenuReads` beside `pendingNarrations` (:1070); `setupMenuRebuilt` / `setupMenuSelector` beside `hotBenchAssetMap` (:1561) and set in the rebuild branch (:1601); FREEZE after the universe capture (:2925); START as the first statement of `!shouldEvaluate` (:2941) and after `shouldStartHaikuCall` (:3050); SETTLE in the catch's error exit and immediately before `finalizeTickCapture` (whose budget is read after it, as always); SEAL at the end of the `finally`. All inside `captureStep` or self-contained; none awaited. |
| `api/cron/process-pending-reflections.js` | Step 9, strictly after the observer's await, isolating try/catch; `setupMenuLabels` in the response only when not skipped. |
| `api/_utils/tickCapture/captureContext.js` | `setupMenu` in `NOOP_METHODS`; a live setter that swallows its own errors and never writes `faulted`. |
| `api/_utils/tickCapture/captureWriter.js` | `admitOptionalSetupMenu` after the base record is composed, sanitized and shed; the block yields when less than 1 s of the shared capture deadline remains (`OPTIONAL_BLOCK_DEADLINE_MARGIN_MS`). |
| `api/_utils/tickCapture/captureSerializer.js`, `captureConfig.js` | The block's declared paths and closed lists; the RD-1 citation; no version bump. |
| `firestore.rules`, `firestore.indexes.json` | `setupMenuLabelState/{name}` server-only; the `attempts` map exempt from single-field indexing. |
| `api/_utils/compositionProtectedStoresAllowlist.json` | The three `state.js` transaction sites, human-reviewed (none writes a protected store). |
| `src/config/flagPinGuard.test.js` | The flag module registered; `SETUP_MENU_LABELS_ENABLED` in `DARK_BY_DESIGN`. |
| `api/cron/process-pending-reflections.activationEvidence.test.js` | **One row's premise moved** (not in V2's file list; disclosed): "the observer is the LAST tenant" became "after the review pass, before Slice 2's tenant". Reordering the response keys to keep the old regex passing would have left a false row title; the row now pins the full order instead. |

## 3. The tick observation as implemented, and what it costs

1. **Freeze** (pure, no I/O). Gate first (flag + allowlist; closed → nothing evaluated, no key), then the battle's scope (`scopeOf`), then the inputs, evaluated inside the freeze's own try, so a throwing input becomes the error form and never the capture's fault text (Correction C; review SM1-2 moved scope ahead of the inputs). The pool fact is set at once: an honest record if nothing else happens.
2. **Start** at the two post-decision sites. The 64 s / 68 s model admission is computed before any Slice 2 read exists; the reads are started un-awaited, every promise with its handlers attached in the expression that creates it.
3. **Settle**, synchronous, **no wait at all** (Correction A): seal, copy what has arrived, compose once, deep-freeze. Unarrived reads are `read_unsettled`; nothing later patches the record. The error exit settles in the catch (review SM2-3), so its record carries its own read start and counts. The settle's CPU is charged honestly: the capture's budget is read after it, as the capture's timing observation always has been (review SM2-1; the lens's reorder was reversed on its verifier's refutation, §6).
4. **Seal** on capture, error exit or the 3 s deadline: the timer cleared, this observation's queued reads dropped, late callbacks ignored.

**The run memo** (Correction A, bounded work across ticks): keyed on the invocation's `summary`; one state read per run; one read per snapshot id per run, shared; ≤ 5 in flight run-wide; a slot released when its read settles or 3 s after issue (releasing a slot does **not** cancel the RPC; already-issued read-only RPCs are never awaited and die with the invocation) **[superseded, §B.4 F1: the timed release let more than five reads be unresolved at once (Astra: 10, then 15); a read is now charged until its own promise settles, and nothing else releases it]**; ≤ 240 reads per run. A read shared from an earlier tick may predate this tick's freeze: its value can be stale by up to the invocation's length (~290 s), and a later battle's s2 fields describe the run's first state read (review SM1-4; stated in `compose.js`).

**What it costs — measured, not assumed** (Linux, Node 20.20.2, warm medians, 48 fully-labelled candidates; scratch bench, not committed):

| Step | Where | Cost |
|---|---|---|
| Freeze | before the model admission (the sanctioned site) | 0.78 ms |
| Settle (compose) | before the capture | 0.49 ms |
| Capture build with the block (sanitize pass, size measure, free-text re-check) | inside the capture deadline | 13.19 ms (0.69 ms without the block) |
| Block size on the permanent record | the capture commit | ≈ 21.6 KB (cap 24 KiB) |
| Firestore reads | per tick | ≤ 48 snapshot reads + 1 state read per **run**, shared across ticks |

The verifier SMV2 measured the same steps by candidate count (vitest, quiet / busy host): the capture build's extra is 13.0 / 21.0 ms at 48 candidates, 10.7 ms at 25, 3.2 / 6.1 ms at 12; the block is 21.4 KB at 48 and 5.8 KB at 12, on a base permanent record of ≈ 3 KB.

So an in-scope tick costs about **14 ms of handler CPU** in the warm-median measurement (21 ms on the busy host; **[§B, D1: observations, not hard ceilings]**) at the 48-candidate cap (less on a typical hot bench) and up to ~21 KB more on its capture commit. **Where it shows:** `capture.preCommitMs` is stamped before the shed loop and the block's admission, so the timing ON the record excludes the block's writer cost; only the logged `totalMs` and `summary.captureTotalMs` include it. The block is admitted only while ≥ 1 s of the capture's 3 s deadline remains, so it cannot be what turns a commit into `timed_out`; inside that window it shortens the commit's allowance by its own cost. **[Superseded, §B.4 D1: the claim was wrong. The reserve reduces risk. Optional CPU and payload still consume the deadline. Warm timing medians and the reported busy-host result are observations, not hard ceilings. With 1,010 ms left, 20 ms of optional work and a 1,000 ms commit, the base record is `written` and the record with the block is `timed_out` (simulated clock), and a `timed_out` commit may still land.]** This is real: Slice 2 work on earlier battles runs before later battles' admission and before the loop's `TIME_BUDGET_MS` deferral check (Correction A's "affects a later battle" class). It is not a deliberate wait, and it is not zero. With B ≤ 4 in-scope battles (Phase 0 §E3) that is ≈ 55 ms an invocation; at 25 it would be ≈ 0.35 s. No row claims equal CPU time: the frozen-clock rows are titled as order and no-wait proofs (review SM2-2).

**On no-trigger ticks** the reads usually have not arrived by the capture (the exit's own awaited write is short): such ticks will often carry `read_unsettled` labels. That is Correction A's chosen honesty, not a defect; later ticks of the same invocation reuse what arrived.

## 4. The tenant and its accounting

Population, deadlines and caps as V2 §6.1–§6.2 (persisted `watchlist.hotBench`, `min(start + 20 s, handler + 100 s)`, < 15 s → `no_budget`, 6 s preparation, ≤ 12 store calls, ≤ 3 at once, 7 s admission reserve, ≤ 10 battles per owner and ≤ 25 in all **[§B.4 F2: 25 battle DOCUMENTS READ, counted before scope filtering, each owner's query asking for min(10, what remains); the 25 had counted kept battles only]**, keys in turn across battles), with Correction B:

- One token per operation, minted outside every transaction callback; an SDK re-run of a committed reservation is recognised (`replay`) and counted once.
- Outcome, refund and cancel apply only under the active token, once (`already_applied`, `stale`); a recovered or superseded token changes nothing.
- A reservation whose outcome was never saved is **recovered** once its 120 s pass: recorded once (`unresolved`), due 31 min after that observation, its reservation still counted, no request that run; later runs see `not_due` (the due time is never extended).
- Admission is checked when a unit launches, again when the serialiser reaches its reservation (review SM3-2), and again immediately before the store call; a lost admission cancels under the token.
- A rejected reservation transaction is uncertain: no request; a token-checked cancel refunds only if it landed.
- Governed sessions move forward only; an older run's prune can never delete a newer session's counters. Nothing is evicted: past 400 keys a new key is `state_full`.
- **Fail closed** (review SM1-1): a state document this code does not recognise is unreadable (no request, never written over); a malformed entry is refused, counted, never pruned and written back verbatim; the record reads it as unreadable (`s2Entry: null`).

**Accounting kept apart** (each a separate count in the run's result and health line): `reservations` (the cap counts these), `storeCalls`, `providerRequests` (counted by a pass-through wrapper on the store's own `fetchPayload`, same arguments, same function), `finalHits` (a store call with no request), `retries`, refusals by reason, completions by status, cancellations. **Budget terms (unchanged):** 24 store calls per admitted handler invocation (observer 12 + Slice 2 12); 1,248 a day only under the 52-invocation assumption; no approved provider allocation (**D-6 remains the activation gate**). The 31 min due rule is Slice 2's scheduling; a further `retryable` is legitimate if ID-1's observer changes the shared observation meanwhile (row 2.3).

## 5. The tests

| Suite | Rows | What it proves |
|---|---|---|
| `setupMenuLabels/constants.test.js` | 17 | store numbers and closed lists pinned to their sources |
| `setupMenuLabels/gate.test.js` | 4 | the unmocked dependency-surface guard (BUILD_RULES §4; review SM3-3) |
| `setupMenuLabels/pool.test.js` | 19 | literal membership, dedup, cap before reads, scope |
| `setupMenuLabels/compose.test.js` | 20 | the three absences, history meanings, capture time, byte cap, error form, real sanitizer `rejected = []` |
| `setupMenuLabels/reads.test.js` | 20 | Correction A on a manual clock: no wait, late results, rejections, seal, queue closure, run memo |
| `setupMenuLabels/state.test.js` | 34 | Correction B on an in-memory transactional store with lost acks and re-runs; fail-closed reads |
| `setupMenuLabels/tenant.test.js` | 29 | the run: limits, admission rechecks, uncertain commits, recovery, counts, health line, A1.1 |
| `setupMenuLabels/setupMenuLabelsRulesTripwire.test.js` | 5 | rules and index source pins |
| `tickCapture/captureSetupMenu.test.js` | 14 | Correction C at the writer |
| `cron/agent-evaluate.setupMenuLabels.test.js` | 24 | the real `processAgentBattle`: disabled parity, 64/68 s boundaries, no wait, error exit, containment, membership |
| `cron/process-pending-reflections.setupMenuLabels.test.js` | 6 | the seventh seat; flag-off byte identity |
| `scripts/census-setup-menu-labels.test.js` | 15 | denominators, joins, coverage, aggregates only, import pins |
| `test/rules/setupMenuLabelsDenials.rules.mjs` | 17 | emulator: server-only state and tick record |
| `test/rules/setupMenuLabelsTenant.rules.mjs` | 8 | emulator, real store underneath: 2.1, 2.3, 2.6/4.2, 4.1, Correction B |

Default-suite rows of the build: **211 in 13 files** (Linux, final run at `339b1a13`). Edited guard suites: `setupEvidenceImportGuard.test.js` (58 rows, one per caller), `flagPinGuard.test.js`, `compositionProtectedStores.scan.test.js`, and the one moved observer host row. The census suite loads only on LF checkouts: `scripts/export-tick-capture.js` (which it imports, as the export's read path) starts with a shebang that a CRLF Windows checkout breaks — `export-tick-capture.test.js` itself fails the same way there; Linux CI is the record.

## 6. Independent review (BUILD_RULES §2)

The diff is far over the threshold (≥ 10 files, ≥ 1,500 lines), so the review was mandatory. Ids use the unused prefix `SM` (lenses `SM1`–`SM3`, verifiers `SMV1`–`SMV3`, mutants `SMX`).

**Method.**
- Three lenses, each a separate agent on its own LF `git archive` of the reviewed head `4d3f9d18`, with `node_modules` junctioned. Each was read-only on git and on the shared tree:
  - SM1: contract and domain correctness against Corrections A–D;
  - SM2: the tick lifecycle, budgets and the capture record;
  - SM3: the tenant, the host, Firestore semantics and the guards.
- Every finding then went to a separate verifier on a fresh snapshot, instructed to **refute** it with a concrete repro.
- The mutating lens ran last, on its own Linux worktree.

**Findings and dispositions:**

| Id | Severity (verified) | Finding | Verdict | Disposition |
|---|---|---|---|---|
| SM3-1 | blocker | The protected-store write scan (default suite) fails: three `state.js` transaction sites are unlisted. | CONFIRMED (SMV3) | Fixed at `58812db6`: allowlisted at 2/1/1, with a human-review note. Also caught by the first Linux suite. |
| SM1-1 | minor, latent (lens: major) | A state document this code does not recognise (another schema, a non-map `attempts`) was read as a valid empty state. The next whole-document write, `finishRun` included, erased every counter. A malformed entry read as zero. | PARTLY (SMV1: behaviour confirmed; reachable only after a schema bump with a rollback, or a manual edit) | Fixed: the document is unreadable (no request, never written over). A malformed entry is refused, counted, never pruned and written back verbatim; the record shows it as unreadable (`s2Entry: null`). |
| SM1-2 = SM2-5 | minor | The freeze evaluated its inputs before the scope check, so an out-of-scope battle with throwing inputs got an error block. | PARTLY (SMV1: the CPU-side example is unreachable; the rest confirmed) | Fixed: scope is checked before any input; a row proves out-of-scope inputs are never evaluated. |
| SM1-3 (+ SM3 aside) | minor | The census cohort was a copied predicate, not `scopeOf`. | CONFIRMED (SMV1) | Fixed: `inCohort` uses `scopeOf`. |
| SMV1-N1 | minor (new, from the verifier) | The census printed the export's coverage `rows`, which carry battle ids. | — (raised by the verifier with a repro) | Fixed: coverage totals only; a sentinel row runs through `runCensus`. |
| SM3-2 | minor (low) | A reservation queued in the serialiser could *start* after the admission deadline. Correction B's recheck before the store held; V2 §6.2's "start only with ≥ 7 s" did not. | CONFIRMED (SMV3) | Fixed: admission is rechecked when the serialiser reaches the reservation (`admission_closed`, no write). Row B-9 was rewritten so the slow transaction is the reservation itself. |
| SM3-3 | nit | No unmocked dependency-surface test for `gate.js → src/config/setupMenuLabelsFlags.js` (BUILD_RULES §4). | CONFIRMED (SMV1) | Fixed: `gate.test.js`. |
| SM1-5 | nit | `proposal_tick_unevaluated` is inferred, not recorded. | CONFIRMED (SMV3; it adds the reverse edge, where an executed proposal matching the tick's own invalid pick reads `ambiguous`) | Labelled INFERRED in the census header and its report line. No record change (Correction C forbids one). |
| SM1-6 | nit | V2's `readMs` was dropped without a note. | CONFIRMED (SMV3; also `unrecordableCount` added without a note) | Recorded in §8 (block shape vs V2). |
| SM1-4 | nit | A read shared from the memo may predate this tick's freeze, yet the block's instants are this tick's. | CONFIRMED (SMV2; broadened: the shared VALUE, and the shared state read, can be stale by up to the run length) | Documented in `compose.js`. |
| SM2-1 | nit (disclosure; lens: minor) | The settle ran before the base record's budget was read, so its CPU (≈ 0.3–0.5 ms) is charged to the capture-floor gate and the recorded `remainingBudgetMs`. The writer's block admission (≈ 13 ms) runs inside the capture deadline. | PARTLY (SMV2: real, but accepted under Correction A; Correction C's "preserve" is about the record's bytes and ordinary timing observations, and reading the budget before the settle would make that observation overstate the remaining time) | The lens's reorder was applied, then **reversed** on the verifier's refutation (`0c6bda55`): the budget is read after the settle, honestly, and a row pins the charge. The writer's 1 s optional-block margin is kept (it drops the optional block, distorts no observation). The cost is disclosed in §3. |
| SM2-2 | minor | Frozen-clock rows claimed timing equality they cannot observe. Measured ≈ 14 ms CPU per in-scope tick. | CONFIRMED (SMV2: a 50 ms busy-wait per compose left every frozen-clock row green) | Rows retitled as order and no-wait proofs; costs measured and reported (§3). |
| SM2-3 | minor | An error-exit record said `readsIssued: 0` although reads ran; the error exit sealed late. | Main claim CONFIRMED (SMV2, end to end on the handler's path); the nested "seals late" nit REFUTED (the 3 s deadline bounds it; the seal runs before the handler finalizes) | Fixed: the error exit settles in the catch (seal plus its own counts). |
| SM2-4 | nit | `pump` and the slot timer ran outside `safe()`. | CONFIRMED (SMV2; a throwing env also left `inflight` stuck and over-counted `readsIssued`; no production trigger) | Fixed. |

**Refuted:** one claim outright — the nit inside SM2-3 (the error exit's late seal is bounded by the 3 s deadline and runs before the handler finalizes; settling in the catch is kept as hardening). Three were narrowed (PARTLY): SM1-1's severity, SM1-2's CPU-side example (unreachable: `cpu_passive` exits first), and SM2-1, whose fix the verifier refuted and which was reversed. Verifiers: SMV1 (V1 group), SMV2 (V2 group), SMV3 (V3 group), each on a fresh snapshot of `4d3f9d18`.

**What the lenses checked and found correct** (summarised from their coverage lists):
- Correction B's token protocol under every interleaving SM1 traced: re-runs, duplicates, takeover, recovery once, and monotonic pruning.
- The due-time table against the store's confirmation rule, including the 09:00:05 counterexample.
- The launch loop: no deadlock, spin or overshoot.
- The Admin SDK's transaction retry semantics (re-runs after a landed commit are handled by the token).
- Dotted, `~` and `__` map keys are legal in `set()`. About 139 KB at 400 entries (V2's "≈ 50 KB" was low; still far under 1 MiB).
- No composite index is needed: the battle query is equality-only, and the same shape runs in production at `decide.js:757`.
- The seat strictly after the observer, the isolation, and the response key only when not skipped.
- `faulted` is unreachable from Slice 2.
- No wildcard-path collisions between the new declarations and the existing ones (SM2 probed all 165 field, 35 container and 2 key declarations).
- No fenced file carries a Slice 2 marker.
- Every guard and census green, apart from the Windows path-separator rows already known (`agentReadCensus.guard`).

**Mutation lens** (Linux, Node 20.20.2; each mutant applied in its own worktree, judged by the vitest exit code, the file restored by bytes and checked by SHA-256, the tree clean afterwards):

| | |
|---|---|
| Battery | 43 mutants across Corrections A–D, the host and the flag |
| Killed | **42** |
| Survived | SMX-A2: `pump` skipping a closed observation's queued reads. **Equivalent**: `seal` already removes them, so it is one of two redundant guards. SMX-A2b (the other guard alone) also survives; **SMX-A2c (both removed) is killed**. |
| Note | SMX-A12 planted the reversal of SM2-1's reorder at `9fd1f29d` and was killed there; that reorder was itself reversed later (above), so A12 no longer describes a defect. |
| Survived, then fixed | SMX-B11 (the call-cap launch bound) survived the first battery. Its row's reservations were instant, so the three slots ran in lock-step and the bound never bound. The row now holds one unit long; SMX-B11 is **killed** at `fc5291ef`. |
| Baseline | Every target file passed unmutated before the battery. |

The mutant spec and the runner are scratch files (never committed); each mutant names the defect it plants (e.g. SMX-A4 "a settlement wait", SMX-B6 "an older run prunes a newer session", SMX-C1 "the block is present while the base record is shed", SMX-D1 "bench membership from the asset map").

## 7. Runs — executed, and not run

**[History: the original build's runs, at `339b1a13` / `0c6bda55`. The correction round's runs, on its final code head and against `main` `7b1d8d26`, are §B.7.]**

All CI-shaped runs: WSL Ubuntu, `TZ=UTC`, Node **20.20.2** (the workflow pins `node-version: '20'`; the runner's exact 20.x patch is not pinned — the one remaining runtime gap), a worktree of `~/pd-ci` with an install matching the lockfile (`40382e64edb6`), `--maxWorkers=8` under `flock /tmp/pd-suite.lock`.

**Executed:**

| Check | Head | Result |
|---|---|---|
| Full unit suite | `339b1a13` (final code, merged with `d09603b2`) | **1,327 files, 29,222 rows: 29,133 passed, 0 failed, 89 skipped** |
| Full unit suite | `0c6bda55` | 1,327 files, 29,221 rows, 0 failed |
| Full unit suite | `69599965` (first merged head) | 1,327 files, 29,221 rows, 0 failed |
| Full unit suite | `9395f18e` (before the review) | 28,869 passed, **1 failed**: the protected-store write scan, reported as SM3-1 and fixed at `58812db6` |
| `npm run test:rules` (Firestore emulator, Java 21) | `339b1a13` | **34 files, 656 rows, all passed** (the two new suites: 8 + 17) |
| `npm run test:rules` | `58812db6` (pre-merge) | 34 files, 654 rows, all passed |
| `npm run lint:gate` | `339b1a13`, `0c6bda55`, `9395f18e` | pass (0 warnings) |
| `vite build` + whole-`dist/` comparison | `0c6bda55` vs a `d09603b2` tree | **0 files differ**; entry chunk `index-BYnPCOYp.js` both sides (and identical vs `d503dd07` at `9395f18e`) |
| `vite build` | the docs head pushed | exit 0 (run on the exact pushed commit) |
| Golden-baseline guard | `0c6bda55` `--base d09603b2` | **compare mode, PASS** (golden `767d2263…`, `tf-setup-v1/sem-1`, thresholds `26f3f411b566` unchanged); also PASS `--base d503dd07` at `58812db6` |
| Flag-off parity: the REAL `processAgentBattle`, capture on, eight exits (completed, analyst, swap, no-trigger, budget-skipped, degraded quotes, gameplan, transport failure), dumping every capture batch, battle write and model request | `0c6bda55` vs a `d09603b2` tree (and `9395f18e` vs `d503dd07`) | **byte-identical** (SHA-256 `34c9a202…` both times). Control: the flag forced on in the head tree differs, and only by the `setupMenu` block — the rest of each record, the body, the battle writes and the request are equal |
| Mutation battery | `9fd1f29d`; reruns at `d849df8a`, `fc5291ef` | 42 of 43 killed, 1 equivalent (§6) |
| CPU cost bench | `9fd1f29d` | §3 |
| Emulator suites on Windows (development) | `28cf9dc7` | 25 / 25 (not the record) |

**Not run, by instruction or by design:**
- GitHub CI on the PR — not watched by this session (the instruction; BUILD_RULES §2). Founder to read it.
- Astra's independent implementation review of the pushed head — before merge.
- The CI runner's exact Node 20.x patch (local 20.20.2).
- Anything in production: no deploy, flag flip, production read, provider request, model job or census run. The Practice Field was not used.
- The census against real data (it is written and tested on fixtures only).

## 8. Deviations from V2, stated

| V2 | Built | Why |
|---|---|---|
| A 500 ms budget-gated settle wait (§4.4) | No wait at all; `settleWaitMs` not recorded | Correction A |
| `readMs` on the block | Not recorded (derivable from `readsStartedAt` / `observedAt`) | Redundant once there is no wait (review SM1-6) |
| `inDispatchedBench` | `inBenchAtFreeze`, plus `heldAtFreeze` | Correction D.2: literal membership of the frozen sets; the held set separates the P \ M causes |
| `predatesFreeze` | `capturedBeforeFreeze` (provider capture time only) | Correction D.1 |
| `s2Attempts`; `s2LastOutcome: none` | `s2Entry` (null / false / true) and `s2Reservations`; an unrecorded outcome is null; `unresolved` added | Correction D.3; recovery (Correction B) |
| — | `unrecordableCount`, `readsIssued`, `readsShared` | A name the record's symbol syntax cannot carry is counted, never read; read cost made visible (Correction A) |
| The error exit keeps the pool fact unchanged (§4.4.4) | The error exit settles in the catch: sealed at once, its own read start and counts | Correction A ("seal … on error exit"); review SM2-3 |
| Settle inside the capture guard, its errors reaching `faulted` (§4.4) | Never through the shared fault text; contained locally | Correction C |
| The block attached in the composition (§3.2) | Attached after the base record is final, within the whole-record budget and ≥ 1 s before the capture deadline | Correction C; review SM2-1 |
| `isTournament` from the menu helper's test | `scopeOf` first (it excludes the tournament mode), then the tick's tournament context | Review SM1-2 |
| A reservation "starts only with ≥ 7 s left" (§6.2) | Checked at launch, when the serialiser reaches the reservation, and before the store | Correction B; review SM3-2 |
| — | ≤ 24 reservation transactions a run (`MAX_RESERVE_TRANSACTIONS_PER_RUN`) | Bounds refused or cancelled units, which cost a transaction and no call |
| The state document "≈ 50 KB at 400 entries" | ≈ 139 KB measured by SM3 | Still far under 1 MiB; the map is index-exempt |
| — | `api/cron/process-pending-reflections.activationEvidence.test.js`: one row's premise moved | §2 says why |

## 9. Merge and activation prerequisites

**Before merge** (this build's delivery ends at the pushed draft PR):
1. Astra's independent implementation review of the pushed head. **[Done on `4e99b1f8`: changes required. Answered by the correction round (§B); next, Astra's focused recheck of the final head.]**
2. GitHub CI on the PR: `vitest (unit)`, the rules job and the golden-guard step. Not watched by this session (BUILD_RULES §2).
3. The founder's merge.

**After merge, separately** (none of this authorises activation):
4. Publish the Firestore rules (the `setupMenuLabelState/{name}` block).
5. Deploy the index exemption (`setupMenuLabelState.attempts`).

**Production activation — milestone 3**, a separate founder instruction. No calendar date opens it. It needs all of:
- (a) ID-1's first census week recorded complete;
- (b) **D-6 resolved**: the allocation's unit, window, included consumers and treatment of retries and confirm fetches;
- (c) the founder's own flip PR. It sets `SETUP_MENU_LABELS_ENABLED = true`, moves the pin row in `setupMenuLabelsFlags.test.js` to `true`, turns the registration row around, and drops the `DARK_BY_DESIGN` entry, all in one commit (BUILD_RULES §2).

**First-hour checks after a flip:**
- one `[setupMenuLabels]` health line per non-skipped reflections run, carrying separate `reservations`, `storeCalls` and `providerRequests`;
- tick records of in-scope battles carrying `setupMenu`;
- no `setupMenu` on any other battle;
- the cron response gains `setupMenuLabels` only when the tenant ran.

**Not built, by design:** monitoring labels (D-3), catalyst acquisition, any script or endpoint reaching `getOrAcquireSnapshot`, a global daily budget system, filtering, or any trading-performance claim. The M1/M2 limits stand: the recorded replay is below the 20-joined-moment floor.

## 10. Questions

None blocking, and no product decision was taken by the builder. Two readings are recorded so the founder can overrule them:
- **SM1-1's fail-closed reading.** An unrecognised state document, or a malformed entry, stops acquisition for that document or key until a person looks, rather than being repaired. The amendments' "durable conservative" language points this way.
- **SM2-1's 1 s margin.** The optional block yields when less than 1 s of the capture's 3 s deadline remains after the base record is composed. It is not a capture budget constant: it governs only the optional block. **[§B, D1: it reduces the risk to the base record; it does not remove it.]**

## A. The controlling amendments, verbatim

See `docs/design/20261107_P3_SLICE2_DISABLED_BUILD_KICKOFF_V2_CORRECTIONS.md` (the whole instruction, byte-for-byte as received).

## B. Correction round 1 — Astra's review of `4e99b1f8` (7 Nov 2026)

The founder's instruction "FantasyTrades PR #1034: bounded Slice 2 correction round" (7 Nov 2026) authorised one correction round: fixes F1–F4 and D1–D2 from Astra's review ("ASTRA — CHANGES REQUIRED BEFORE MERGE") of `4e99b1f88c85616ce3f626e7d43a2bf867002516`, a merge of current `main`, tests, review, this section, a push to the same draft PR and its description. It is implementation authority for the named fixes, not activation authority: `SETUP_MENU_LABELS_ENABLED` stays `false` and pinned. Nothing was merged, deployed, published, flipped, read from production, requested from a provider, run as a model job or run as a production census; no review was requested and CI was not watched. **Where this section and §0–§10 disagree, this section controls; the earlier text stays as history, with each superseded claim marked in place (§B.8).**

### B.1 State at the start, the main merge

- Worktree clean; branch `claude/setup-menu-labels-slice2`; HEAD `4e99b1f88c85616ce3f626e7d43a2bf867002516`, equal to the remote branch.
- `git fetch origin`: `origin/main` = `7b1d8d2607937c455eed947b2b557a8a1886cf8a` (PR #1030 Research Record Extension and PR #1031 Research Modal Build A merged since `d09603b2`).
- Merged through the app's base-branch sync: **integration commit `1df0f246970c1b2e49084f84b0e6ea4c5236dbe4`** (parents `4e99b1f8`, `7b1d8d26`). Three conflicts, all additive, both sides kept: `api/_utils/compositionProtectedStoresAllowlist.json` (Slice 2's `_notes_setup_menu_labels` and main's `_notes_research_record_extension`, both objects; JSON parses), `api/_utils/setupEvidence/setupEvidenceImportGuard.test.js` (both `ALLOWED_OUTSIDE` groups), `docs/README.md` (both index rows). `firestore.indexes.json` and `src/config/flagPinGuard.test.js` merged cleanly (the `setupMenuLabelState.attempts` exemption and main's `symbolKeys` index both present). `package.json` and `package-lock.json` unchanged by the merge (lock `40382e64edb6`).
- No material fence or contract conflict was found; nothing outside the authorised scope was edited.

### B.2 Fixture provenance

Astra's supplied regression files were available (WSL `/tmp/astra-slice2-01a1b923/evidence`), so **nothing was recreated**. Copied unchanged into the session scratchpad; SHA-256:

| File | SHA-256 (prefix) | Used for |
|---|---|---|
| `reads.regression.test.js` | `1a38aba3` | F1: T1, T1-ext and three controls, adapted into `reads.test.js` |
| `tenant.regression.test.js` | `ab7fbd40` | F2: two regressions and the two-owner control, adapted into `tenant.test.js` |
| `census.regression.test.js` | `00bd2f1c` | F3 / D2: regressions, controls, the range control and the proposal-heuristic row, adapted into `census-setup-menu-labels.test.js`; its malformed-entry row asserted the defect and is rewritten to the corrected shape |
| `block-cap.regression.test.js` | `82e1c2b7` | F4: the 48-candidate 24,577-byte case and its control, adapted into `compose.test.js` |
| `deadline.counterexample.test.js` | `fc49b383` | D1: the counterexample and its two controls, adapted into `captureSetupMenu.test.js` (simulated clock) |
| `parity-base.test.js` / `parity-checkout.test.js` | `ccf9606d` / `5e5a3841` | flag-off tick parity, run unchanged except import paths (§B.6) |
| `reflection-base.test.js` / `reflection-checkout.test.js` | `35b2246b` / `58df5536` | flag-off reflections parity, run unchanged except import paths; a flag-on control derived from the checkout file (§B.6) |
| `vitest.review.config.mjs` | `04e8e864` | not needed (the repo config collects `evidence/`) |

"Adapted" means: import paths rewritten from `../checkout/…` to the suite's own, the harness folded into the suite's `describe` block, and each row titled "(Astra)". No bound was loosened and no assertion dropped; where this round's rows assert more (the scheduler's counter equals the promises outstanding; query limits exact; null figures), they are added beside Astra's.

### B.3 Reproduction on the reviewed head

Astra's five regression files, run on a clean Linux tree at `4e99b1f8` (Node 20.20.2, `TZ=UTC`): **7 rows failed, every control passed**:

| Finding | Observed at `4e99b1f8` |
|---|---|
| F1 | T1: after 3,001 ms the scheduler reported 0 in flight while **10** database promises were unresolved; T1-ext: **15** after three ticks (limit 5) |
| F2 | four owners × ten excluded battles: **40** documents read (reported `battles.read` 40, `kept` 0); all eligible: **30** returned, reported 25 |
| F3 | `schemaVersion: 2` and `attempts: []`: the census said `read` where `readLabelState` says `unreadable`; `n: "3"` gave `reservations: 0` with its `retryable` outcome counted |
| F4 | the 48-candidate case: **24,577** bytes, `ok`, admitted by the writer at 24,577 |
| D1 | (a counterexample, passes by design) base `written`, with the optional block `timed_out` (20 ms optional work, 1,010 ms left, 1,000 ms commit) |
| D2 | (passes by design) one selected tick, lifetime coverage 3 minted / 2 captured, a later session's state with 3 reservations: three populations, unlabelled |

### B.4 The fixes, mapped

| Item | Change (commit) | Tests |
|---|---|---|
| **F1** a read keeps its charge until its own promise settles | `reads.js`: the 3 s slot timer and `LABEL_READ_SLOT_MS` removed; `settleRec` is the only release (`memo.inflight -= 1`, then the pump), once per read; seal and the observation deadline release nothing; the 3 s deadline, zero wait, the 240 cap, memoization, queue removal on closure and the rejection handlers unchanged. `constants.js`: `LABEL_READ_CONCURRENCY` documented as unresolved reads (`6dfe7683`) | `reads.test.js` F1 block: T1, T1-ext, three controls (Astra); exactly-once release, deadline seal keeps charges, no added wait; every row checks the scheduler's counter equals the database promises outstanding. A-10 corrected (the charge is KEPT past 3 s); A-7/A-9 and A-8 rewritten without a slot timer |
| **F2** a 25-document read allowance | `tenant.js`: each owner's query asks for `min(10, 25 − read)`; the whole returned page counts before scope filtering; no query once the allowance is spent; `battles.read` = documents returned (`a5c5d469`) | `tenant.test.js` F2 block, counting returned documents through a wrapper: excluded 4 × 10 → 25 read, limits [10, 10, 5]; eligible 4 × 10 → 25, final limit 5; two owners → 20 (Astra); a short page (10, 10, 10, 2); rotation and the cursor |
| **F3** the census validates as the reader does | new pure `setupMenuLabels/stateShape.js` (`stateDocReadable`, `stateEntryWellFormed`, `stateEntryIds`; imports `constants.js` only), moved unchanged out of `state.js`, which imports and re-exports them; the census's `stateCensusOf` uses the same functions. Absent → `absent`, unsupported or failed read → `unreadable` (cause), every figure `null`; malformed entries counted apart, never aggregated; figures labelled `partial valid-entry subtotals` (`a4106d9c`) | census rows: unsupported schema, `attempts` array, no schema, non-object document (Astra + additions); read failure; absent; valid empty (a measured zero); `n: "3"` (Astra's row, corrected); a mix of valid and seven malformed forms; an agreement sweep against `readLabelState` over ten documents; JSON and printed report both checked |
| **F4** the final block is measured | `compose.js`: counts, status and the truncation counter recomputed after every removal and the final block measured; a candidate-free block over the cap → the error form if it fits, else `null` (no block). `captureContext.js`: the setter treats `null` as that omission and removes the key (`5f8ac629`) | `compose.test.js` F4 block: Astra's case → ≤ 24,576 (47 candidates, `truncated`, counts sum 47) through the writer; exact-cap boundary 24,576 untruncated; a sweep over reason lengths 0–120; unsettled near the cap; error form / `null`. `captureSetupMenu.test.js`: the null omission; the setter row updated |
| **D1** the reserve's wording | `captureWriter.js` comments: the 1 s reserve reduces the risk; optional CPU and payload still consume the deadline; medians and the busy-host result are observations, not ceilings; `timed_out` does not prove no commit. No deadline enlarged, no cost hidden (`5f8ac629`) | `captureSetupMenu.test.js` D1 block, **simulated clock**: Astra's counterexample (base `written`, with the block `timed_out`, and the late commit landed) and its two controls (below the reserve: dropped unexamined; a faster commit: written). They pass on the reviewed code too: they document, they do not regress |
| **D2** three populations | census JSON `meta` (`range`, `populations` with label, scope and keys, `runMemo`) and the report's three numbered sections, each with its scope; the requested range printed; the run memo's staleness stated with the summed `readsIssued` / `readsShared`; no new reads (`a4106d9c`) | the range control (Astra) plus label, scope, order and range assertions on both channels; no-range; the inferred proposal join and the M1/M2 line (Astra) |

The review's fixes (§B.6, commit `d76657bf`) add to this:
- the census refuses a `--from`/`--to` that is not a real date before any read, through `requestedRangeOf`;
- every error-form return in the composer, the catch path included, is bounded by the cap;
- population 1's sub-sections are nested;
- four rows are tightened.

Guard and registration changes, named: the census's import pin (`census-setup-menu-labels.test.js`) gains `stateShape.js` (pure; a new row pins that it imports only `constants.js` and has no I/O call). No other guard, allowlist, rule, index or import registration changed. The `state.js` protected-store allowlist keys are unchanged (the transaction sites did not move).

### B.5 Each regression fails without its fix

The round's test files as of the fix commits (plus `stateShape.js`, which the census test imports) on a clean Linux tree at the integration commit `1df0f246`, without the fixes: **33 rows failed, 104 passed**.
- The 33 failures are the regression rows: F1 6 (T1, T1-ext, the corrected A-10, A-7/A-9 and A-8 without a slot timer, the deadline seal); F2 4; F4 5 (Astra's case, the sweep, the error form and null, the two setter rows); F3/D2 18. The census's import pin and sentinel rows fail too, and so do its absent and valid-empty controls, because they now assert the validated shape and null figures.
- The 104 passes include every control that does not assert the new shape: Astra's three read controls, exactly-once release, no added wait, the two-owner control, the exact-cap boundary, the short-reason control and all three D1 rows (D1 documents; it does not regress).

With the fixes, the same files pass (§B.7). The review's rows (§B.6) were checked by planting each defect (SCX-15, SCX-18 to SCX-24).

### B.6 The round's review (BUILD_RULES §2)

**Method.**
- Ids use the unused prefix SC: lenses SC1 and SC2, verifier SCV2, mutants SCX.
- Each reviewer worked on its own LF `git archive` snapshot of `a4106d9c`, with the round's diff (`git diff 1df0f246 a4106d9c`) and Astra's review beside it. Reviewers were read-only on git and wrote nothing outside their trees.
- **SC1** covered runtime correctness and lifecycle: F1, F2, F4 and the preserve list. **SC2** covered the census (F3, D2), the D1 wording, test integrity across every new row, and the merge resolution.
- Every SC2 finding went to a refuting verifier, **SCV2**, on a fresh snapshot. SC1's two findings are the same claim as SC2-1, so SCV2's verdict on SC2-1 covers them.

| Id | Severity | Finding | Verdict | Disposition |
|---|---|---|---|---|
| SC2-1 (= SC1-1, SC1-2) | major | The build report was untouched. It still claimed the block "cannot be what turns a commit into `timed_out`" (§3) and described the 3 s slot release (§1, §3); it gave the 25-battle cap the old meaning (§4); and it had no correction-round section. | CONFIRMED. PARTLY for §1 (a plan committed before the code: annotate it, do not rewrite it) and §4 (true, but the old meaning). SCV2 added a stale claim at §1 :54. | This section. Each claim is marked superseded in place (§B.8); D1's sentence is quoted verbatim |
| SC2-2 | minor | A `--from`/`--to` that is not a real date still filtered the tick records, because the export compares strings. It printed as "(none)", and `main()` put the raw text in the title. SCV2 found more: such a bound also empties the cohort, `main()` still made two production-shaped reads, and a flag given without a value read as no range. | CONFIRMED | Fixed. `requestedRangeOf` refuses it (also an impossible date, an empty value, and from after to) with a fixed-text `RangeError`. It runs as `runCensus`'s first statement, and in `main()` before credentials or any read. Rows: 8 refusals with zero reader calls; 6 acceptances; the message never echoes the bound; `main()`'s order |
| SC2-3 | minor | The precedence row never truncated (23,638 bytes, `reads_unsettled`), so swapping the precedence left every suite green. | CONFIRMED (re-measured) | Fixed. Four unsettled candidates are kept at the head, and the row asserts `truncated` unconditionally |
| SC2-4 | nit | The printed run-memo line was not pinned. | CONFIRMED | Fixed. Pinned inside population 1 |
| SC2-5 | nit | The `stateShape` purity row missed dynamic imports and file writes. | CONFIRMED | Fixed. It also refuses `import(`, `require(`, host access and writes (no static scan is complete) |
| SC2-6 | nit | The catch path's bound was untested, and two error-form returns were unbounded. They are unreachable at the real cap: the largest error form is 641 bytes. | CONFIRMED | Fixed. All error-form returns go through `errorFormWithin`, and a catch-path row is added |
| SC2-7 | nit | Population 1's sub-sections were `##`, siblings of the numbered populations. | CONFIRMED on structure, PARTLY on the population-3 reading | Fixed. `### 1a` / `1b` / `1c`, with Provider capture and joins in their own sub-section; the row pins three `##` headings |

**Noted, not findings** (recorded so they are not lost):
- SC1 X4: a store returning more documents than its `limit` would be counted honestly, but no longer capped in the loop. Firestore honours `limit`.
- Firestore bills a minimum read for an empty query. Those are not counted, as instructed: the count is of documents returned.
- Pre-existing, outside the round: an `s2` `lastAt` of 1e20 makes the whole block the error form (`toISOString` throws). It is reachable only through a corrupt state entry, and it fails closed.
- SCV2-N1: with a range given, a record without `capturedAt` is dropped. The writer always stamps one.

**What the lenses checked and found correct**, from their coverage lists:
- F1: the charge rises only in `issue` and falls only in `settleRec`, once. SC1 fuzzed 17,500 random steps (ticks, shared names, seals, settles, rejections, timeouts) checking that the counter always equals the outstanding promises, the peak never exceeds 5, issued never exceeds 240, no id is read twice, no sealed queue entry remains, no capacity sits idle beside a queue, and a sealed observation never changes. The pre-fix code fails at step 14.
- F2: every path (a query that throws, owners with no documents, `notOwned` documents, a prep cut, an allowance spent at a page boundary) gives read = returned.
- F4: SC1 fuzzed 3,000 seeds through the writer. Every block is within its cap, the counts are consistent, truncation is minimal, and the output is byte-identical after the writer's sanitize pass. The setter's `null` is reachable only from the composer, and never with the flag off.
- F3: `stateShape` is the old validators verbatim. A differential fuzz of the old `state.js` against the new one over 20,000 documents gave identical results. The census agrees with `readLabelState` on 20,000 random documents; the only divergence is an own `__proto__` key, which Firestore reserves.
- D2: the labels are verbatim, the figures sit under the right populations, and no id, symbol or owner reaches either channel.
- D1: the code comments are corrected; the reserve and its rechecks are intact; the deadline is unchanged.
- The merge resolution holds both sides in all three files.
- The preserve list is untouched.

**Mutation lens SCX** (this round's own battery, not added to §6's 42/43):
- Each mutant ran on its own snapshot tree. A mutant counted as KILLED only when vitest exited non-zero with a test summary showing failed rows; a run that crashed or loaded nothing would have been reported as CRASHED (none were). The file was restored by bytes and checked by SHA-256.
- **24 mutants, 24 killed**:
  - F1 (SCX-1 to SCX-4): a 3 s timed release; a seal that releases charges; no pump on settlement; a sixth read admitted.
  - F2 (SCX-5 to SCX-7): the limit back to 10; counting kept battles only; the allowance measured on kept battles.
  - F3 / D2 (SCX-8 to SCX-13): the document check skipped; malformed entries aggregated; absent as zeros; a non-integer `n` accepted; the range line dropped; the population headings swapped.
  - F4 (SCX-14 to SCX-17): measured before the final counts; no recompute after the loop; an unbounded error form; the setter ignoring `null`.
  - Review fixes (SCX-18 to SCX-24): the precedence swapped; the catch path unbounded; the range refusal removed; an impossible date accepted; the run-memo line dropped; a dynamic write planted in `stateShape.js`; the sub-headings flattened.
- SCX-15 **survived the first battery**: truncating to zero candidates left stale counts, and no row had a candidate-free block that still fits. A row was added, and the mutant is killed.

### B.7 Runs on the final code head

All CI-shaped:
- WSL Ubuntu, `TZ=UTC`, Node **20.20.2** (the workflow pins `node-version: '20'` only; the runner's exact 20.x patch is not pinned).
- A worktree of `~/pd-ci` with an install matching the lockfile (`40382e64edb6`, unchanged by the merge).
- `--maxWorkers=8` under `flock /tmp/pd-suite.lock`.
- Base for every comparison: **`main` `7b1d8d26`**.

**Executed:**

| Check | Head | Result |
|---|---|---|
| Full unit suite | **`d76657bf`** (final code) | **1,354 files, 29,755 rows: 29,666 passed, 0 failed, 89 skipped** |
| Full unit suite | `a4106d9c` (before the review fixes) | 1,354 files, 29,737 rows, 0 failed |
| `npm run test:rules` (Firestore emulator, Java 21) | **`d76657bf`** | **35 files, 664 rows, all passed** (Slice 2's two suites: 8 + 17) |
| `npm run test:rules` | `a4106d9c` | 35 files, 664 rows, all passed |
| `npm run lint:gate` | `d76657bf`, `a4106d9c` | pass (0 warnings) |
| `vite build` + whole-`dist/` comparison | `d76657bf` vs a `7b1d8d26` tree (also `a4106d9c`) | **0 files differ**; entry chunk `index-BHrJlEMa.js` on both sides |
| `vite build` | the docs head pushed | exit 0, run on the exact pushed commit (§B.9) |
| Golden-baseline guard `--base 7b1d8d26` | `d76657bf` (also `a4106d9c`) | **compare mode, PASS**: golden `767d2263…`, `tf-setup-v1/sem-1`, thresholds `26f3f411b566` unchanged |
| Flag-off parity through the REAL `processAgentBattle`, capture on, eight exits; every capture batch, battle write and model request dumped. This session's harness and Astra's (`parity-*.test.js`) | `d76657bf` vs `7b1d8d26` (also `a4106d9c`) | **byte-identical**: this session's dump SHA-256 `34c9a202…` (the same value as the original build's at `d09603b2`), Astra's `13157c82…`. Flag-on control in the head tree: **differs** |
| Flag-off parity through the REAL `process-pending-reflections` handler (Astra's `reflection-*.test.js`: a pending reflection and an empty run; status, body and every write), Slice 2 I/O asserted zero | `d76657bf` vs `7b1d8d26` (also `a4106d9c`) | **byte-identical** (`62f1ffd1…`). Flag-on control: **differs**, by the `setupMenuLabels` key the tenant adds |
| Astra's regressions, reproduction | `4e99b1f8` | 7 failed as reported, every control passed (§B.3) |
| The round's rows without the fixes | `1df0f246` + the round's test files | 33 failed, 104 passed (§B.5) |
| Mutation lens SCX | snapshot trees of `a4106d9c` and `d76657bf` | 24 of 24 killed (§B.6) |

**Not run, or not observed:**
- GitHub CI on the pushed head. Not watched, per the instruction; the founder reads it. The draft's earlier head `4e99b1f8` passed CI, as Astra reported; this session did not observe that run.
- Astra's focused recheck of the final head.
- The CI runner's exact Node 20.x patch (local 20.20.2).
- Anything in production: no deploy, rules or index publication, flag flip, production read, provider request, model job or census run.

### B.8 Superseded claims (marked in place, kept as history)

| Where | Earlier claim | Now |
|---|---|---|
| §0 Final heads | code `339b1a13` | §B.9 |
| §1, Correction A table (two rows) | a read's slot is released at its own 3 s deadline; "a released slot does not cancel its RPC" | F1: a read's charge ends only at its own settlement |
| §3, the run memo | "a slot released when its read settles or 3 s after issue" | F1 (as above) |
| §3, cost | "up to about 14 ms of handler CPU" | a warm median (21 ms on the busy host); observations, not ceilings |
| §3, cost | the block "cannot be what turns a commit into `timed_out`" | **Wrong.** The reserve reduces risk. Optional CPU and payload still consume the deadline. Warm timing medians and the reported busy-host result are observations, not hard ceilings. A `timed_out` commit may still land |
| §4 | "≤ 10 battles per owner and ≤ 25 in all" | 25 battle documents **read**, counted before scope filtering; each owner's query asks for min(10, what remains) |
| §7 | the original runs | §B.7 |
| §9 item 1 | Astra's review pending | Done on `4e99b1f8`, answered here; the focused recheck is next |
| §10, SM2-1 | the 1 s margin | It reduces the risk; it does not remove it |
| PR description | the original body | Replaced by a correction-round body (the original change list stays in §2–§7) |

### B.9 Heads, and what follows

| | |
|---|---|
| Reviewed head (Astra) | `4e99b1f88c85616ce3f626e7d43a2bf867002516` |
| Fetched `main` | `7b1d8d2607937c455eed947b2b557a8a1886cf8a` |
| Integration (merge) commit | `1df0f246970c1b2e49084f84b0e6ea4c5236dbe4` |
| Fix commits | `6dfe7683` (F1), `a5c5d469` (F2), `5f8ac629` (F4, D1), `a4106d9c` (F3, D2), `d76657bf` (review SC fixes) |
| **Final code head** | **`d76657bf3e46ffbe8992fd4dbfdf198b3f6d1a81`** — every check in §B.7 ran here |
| Docs head | the commit holding this section, on top of `d76657bf`; documentation only; `vite build` re-run on it before the push. The pushed SHA is given in the PR description and the session's hand-back |
| Branch | `claude/setup-menu-labels-slice2`, pushed by refspec without force, to the same draft PR #1034 |

The flag stays `SETUP_MENU_LABELS_ENABLED = false` and pinned. **Production activation still requires all of:**
- ID-1's census completion recorded;
- D-6 allocation approval;
- the published `setupMenuLabelState` rules and the `attempts` index exemption (after merge);
- the founder's separate flip instruction.

The Practice Field is not a dependency.
