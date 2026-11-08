# Build report: Measured Trend Evidence, Slice 2 — setup labels on the candidate menu (disabled build)

Claude Code (Claude Opus 5.5), 7 November 2026, for Flash. **DRAFT — written before implementation.** This first version records the controlling amendments and the plan that maps each to code and tests, as the founder instruction requires. The results, the review and the runs are added when they exist.

## 0. Preamble

| | |
|---|---|
| Instruction | "Measured Trend Evidence Slice 2 — disabled-build kickoff with binding V2 corrections" (7 Nov 2026), committed byte-for-byte as `docs/design/20261107_P3_SLICE2_DISABLED_BUILD_KICKOFF_V2_CORRECTIONS.md`. It controls wherever it conflicts with V2 or the resolution note. |
| Historical inputs (preserved, unchanged) | `docs/design/20261107_P3_SLICE2_BUILD_SPEC_DRAFT_V2.md` (SHA-256 `423501ae32929bd15f891a95f3a8b783be484a9d402bec12c11b4bd3cf61143e`, 67,530 bytes) and `docs/design/20261107_P3_SLICE2_V2_RESOLUTION_NOTE.md` (SHA-256 `283070d48c139d2c24b39acd09f71f5a07aefcc1971c63ad430731f9d9aa1c95`, 10,377 bytes), copied from `Documents/FantasyTrades/Archetype/` with `cp`; the hashes are of the source files and of the committed blobs. |
| `git fetch origin` | Run first. |
| Base | `origin/main` = `d503dd07df76ddfb1931935111d158c944f720ae` — **the revision the review inspected. No drift.** |
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

Each clause of the instruction, the code that implements it and the acceptance rows that test it. "Planned" until §5 records the result.

### Correction A — optional reads add no deliberate wait

| Clause | Code (planned) | Acceptance (planned) |
|---|---|---|
| Pure pool freeze; the two post-admission read-start sites kept | `setupMenuLabels/pool.js` (pure) through `reads.js` `freezeSetupMenuPool(tickCapture, inputs)`; `agent-evaluate.js` starts reads at the first statement of `!shouldEvaluate` and after `shouldStartHaikuCall` | 1.10 freeze makes no db call; A-1/A-2 the 64/68 s boundaries unchanged |
| At finalization take only results already available; settlement wait zero | `reads.js` `settleSetupMenuReads` is synchronous: seal, copy, compose; no timer, no await. V2's `settleWaitMs` field is dropped (always 0) | A-3 no-trigger exit with a state read resolving at 2,900 ms → `stateRead: false`, every `s2*` null (row 1.3 corrected); A-4 model tick whose call outlasts the read → read available, no wait |
| Unfinished results stay `read_unsettled`; no later result patches the record | the results map is sealed; the composed block is deep-frozen; late callbacks check `closed` | A-5 late resolution after the seal: written block unchanged, results map unchanged |
| Rejection handlers from creation | every read promise gets `.then(ok, fail)` in the expression that creates it | A-6 rejected state read and rejected snapshot reads: no unhandled rejection, `read_failed` |
| Seal on capture, error exit or deadline; stop admitting queued reads; clear timers | `sealSetupMenuReads` (idempotent) in the `finally` on every exit; a per-observation deadline timer (`unref`, cleared on seal) | A-7 error exit seals; A-8 queue closed: queued reads never start; A-9 timer cleared |
| Late callbacks never mutate a recorded object or start reads for a closed observation | the pump skips closed observations | A-8, A-5 |
| Issued read-only RPCs not awaited; no claim that a timer cancels an RPC | no await on exit; the report says a released slot does not cancel its RPC | stated in §3 |
| Bound memoized work across ticks, prior unresolved reads included | a run memo keyed on the invocation's `summary` object (WeakMap): one state read per run, one read per snapshot id per run, ≤ 5 in flight run-wide, ≤ 240 distinct snapshot reads per run; a read's slot is released at its own 3 s deadline (the RPC is not cancelled) so a hung read cannot starve later ticks | A-10 multiple battles on one handler clock: a hung read in battle 1 adds no wait to battle 2 and is not re-issued; the run cap holds |
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

## 2–6. (filled in after the build)

## A. The controlling amendments, verbatim

See `docs/design/20261107_P3_SLICE2_DISABLED_BUILD_KICKOFF_V2_CORRECTIONS.md` (the whole instruction, byte-for-byte as received).
