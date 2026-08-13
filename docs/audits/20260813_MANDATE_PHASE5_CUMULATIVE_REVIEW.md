# Spec 1 — Mandate Substrate — Phase 5 Cumulative Review

**Phase:** P5 of 6 (the batch transport — §3.3 made real; the spec's named top risk, Risk 7).
**Branch:** `claude/mandate-substrate-phase-5-5pk22u` off `main` @ `0332fd0c` (with P1 #740, P2 #745, P3 #750, P4 #752 merged).
**Diff:** 22 files, +2618 −165. Over the BUILD_RULES §2 threshold (≥10 files / ≥1500 lines) → the multi-lens adversarial + refute-with-repro review below was mandatory and is recorded in §3–§4. Per the standing P5 allocation the executor/reviewer pair is inverted: Fable executed; four Opus reviewers ran the adversarial pass.
**Everything ships dark:** `MANDATE_TRANSPORT_MODE` stays `'direct'` (pinned, `mandateFlags.test.js:41`); the drain endpoint is founder-gated (`MANDATE_FOUNDER_CREATE_ENABLED` + allowlist, both required); no new flags; no `vercel.json` change (P6). The production flip is a later config PR after acceptance.

---

## 0. Step 0 — abbreviated drift check (CLEAN, no STOP)

`git fetch origin` first (BUILD_RULES §3), recorded here. Branch cut exactly at `origin/main` = `0332fd0c`. `git diff 07bd548a..HEAD -- api/ src/config/featureFlags.js src/config/mandateFlags.test.js` (the #752 merge → session start) is **EMPTY** — every P2–P4 mandate module byte-identical since the P4 merge; the three merges after #752 (#753–#755) were docs/ops only. All VERIFIED this session:

| # | Kickoff item | Verdict | Anchor |
|---|---|---|---|
| 1 | P2–P4 modules unchanged: `mandateModelCall` envelope/requestId (F1/F2); `mandateExecution.validateEnvelope` 5 conditions + exit carve-out; `execState` shape (`openBatchId`/`staleRejectStreak`/`submitted`/`executed`/`lastSweepTickKey`); `isLastSlotForTier` inert (no production caller); P3 expiry path; P4 open-batch cancels | CLEAN | `mandateModelCall.js:41-69`; `mandateExecution.js:94-127`; `mandateSchema.js:120-137`; `mandateSessionSlots.js:125-128`; `mandateClosePass.js:186-204,453`; `mandateRollover.js:196-217`; `mandateEscape.js:134-174` (pre-P5 line numbers) |
| 2 | The Anthropic Batch API precedent (Doug submit→poll, discovery R3): `batches.create({requests:[{custom_id, params}]})` with params nested per request, `batches.retrieve`, `batches.results` (async iterable of `{custom_id, result:{type,…}}`), consumed in `poll-batch.js` by `result.result.type` | CLEAN — P5 adapts exactly this shape | `wireModelCall.js:111-144`; `api/fantasytimes/poll-batch.js:107-235` |
| 3 | `mandateGenerationConfig` seam — model/params as config (`getModelSeat`), frozen into vintages | CLEAN | `mandateGenerationConfig.js:25-72` |
| 4 | Terminal-state set (six statuses) + deterministic `requestId` | CLEAN | `mandateSchema.js:26-28`; `mandateModelCall.js:41-46` |
| 5 | `MANDATE_TRANSPORT_MODE` exists, default `'direct'`, pinned, zero api consumers pre-P5 | CLEAN | `featureFlags.js:1601-1607`; `mandateFlags.test.js:40-42` |

**Load-bearing convention discovered in Step 0 and followed:** across P3/P4, `execState.openBatchId` holds the open submission's **requestId** (= decisionId) — the close-pass expiry, rollover cancel, and escape cancel all write `decisions/{openBatchId}`. P5 keeps that convention (the gate names the request) and adds `execState.openProviderBatchId` for the provider-side batch id, since one provider batch carries many books' requests.

---

## 1. What was built (the 6 kickoff items)

**Item 1 — batch transport core (`api/_utils/mandateBatchTransport.js`, new; + `mandateModelCall.js` batch wrappers; + `mandate-evaluate.js` wiring).**
- **Client surface** stays inside the sole importer: `createMandateBatch` / `retrieveMandateBatch` / `mandateBatchResults` / `cancelMandateBatch` (`mandateModelCall.js:169-218`), params built per request through the SAME `buildMandateRequest` as direct transport (deny-unknown per request, the wireModelCall R4-B2 shape). The imports-closure scan still passes with one sole importer.
- **Submit** (`submitMandateBatch`, `mandateBatchTransport.js:118-186`): one Message Batch per tick for all enqueued books (`custom_id` = deterministic requestId); then the bookkeeping doc `mandateBatches/{providerBatchId}` (entries: `{mandateId, model, verbs, envelope}` per request — the F1 envelope travels with the request); then per-book **revision-disciplined gate transactions** (precondition: revision === envelope.baseRevision ∧ un-gated ∧ active ∧ same quarterKey) setting `openBatchId`/`openBatchSubmittedAt`/`openProviderBatchId` + the billed-eval stamp (`lastEvalTickKey`) + the sweep frontier key, atomically. Write order is the crash-safety design (§2 below). A failed gate precondition logs `MANDATE_BATCH_ZOMBIE` and leaves the request to converge on the claim.
- **Harvest before submit** (`runEvalSweep`, `mandate-evaluate.js:308-315`): every batch-mode fire polls open batch docs first; each returned result runs the full §3.3 validation and executes through the untouched §3.5 `executeDecision` (claim-and-execute on the deterministic decisionId). Per-entry processing holds the book's owner-token lease (the P3 INV-3 read→bill→merge idiom); health/telemetry bookkeeping mirrors the direct loop exactly and is skipped on idempotent replays.
- **Partial batches** (`harvestOneBatch`): `succeeded` → full path; `errored` → `failed` (`api_error:<type>`); `canceled` → `cancelled`; provider-`expired` → `expired`; **missing result row → `expired` (`result_missing`)**. No request is left in limbo while its siblings terminate; the batch doc's `disposed` map converges to full coverage before the doc leaves `'open'`.
- **Terminal-state completeness (I1):** every disposal path flows through one of two primitives — `executeDecision` (results) or the new `disposeSubmission` (`mandateExecution.js:295-333`, result-less terminals) — and both share `execStateTerminalPatch` (`mandateExecution.js:262-283`): counters, streak, and the **ownership-conditional** gate clear (§2). `clearedOpenSubmissionPatch()` (`mandateSchema.js`) is the single source of truth for the gate-field set, spread by execution, close-expiry, rollover, escape, and drain — a new gate field can never be cleared at one site and leak at another.

**Item 2 — last-tick rule (F3).** `isFinalSessionSlot` (`mandateSessionSlots.js:130-155`) is the no-submit predicate; under batch, the session's final tick is **harvest-only** (`mandate-evaluate.js:317-329` — no page, no submits, close-pass expiry remains the backstop). Session-scoped reading stated in §5.1. Early-close shift tested at the real calendar (2026-11-27: preClose at 12:30 ET is the final tick; the same wall-clock on a regular day is no tick at all — `mandateSessionSlots.test.js` P5 block). The construction property (every tier keeps ≥1 submitting slot under batch; slow submits at open30 by construction) is suite-asserted — the test that fails if TIER_SLOTS is ever reconfigured to starve a tier.

**Item 3 — drain protocol (F26).** `drainOpenBatches` (`mandateBatchTransport.js:472-517`) + the founder-gated dark endpoint `api/mandate/drain.js` (same auth contract as create/accelerate: flag AND allowlist; the P4 ambiguity-4 no-new-flag precedent). Explicit and invocable only — a mode flip triggers nothing implicit (proven: interleaving test (f) asserts a `'direct'` fire with open batches neither polls nor executes them). Word reconciliation per the kickoff: the **batch doc** goes `'cancelled'` (the I1 lifecycle word, matching rollover/escape's decision status for their disposals); each undelivered request's **decision** records `'rejected_stale'` with `failCondition:'drained_transport_change'` (the §3.3 drain language — a drain is a staleness event by fiat: the mode is changing, results must not be applied). Idempotent; re-invoke to completion; books resume under the new mode immediately (one-slot sweep-stamp cost at most).

**Item 4 — prompt caching (D-20).** `buildMandateRequest` converts a string system scaffold into a single `cache_control:{type:'ephemeral'}` block (`mandateModelCall.js:118-126`) — the cached prefix is (tools + identity scaffold), stable per vintage × verb-set; the per-tick context rides in `messages`, after the breakpoint, uncached. Applied uniformly to both transports at the one construction site. **Nothing assumes batch and caching stack:** `priceUsage` v2 reads `cache_read_input_tokens` AND `cache_creation_input_tokens` off every response and prices them (read 0.1×, write 1.25×, batch ×0.5 across all components — `modelPriceTable.js:22-24,96-101`); `telemetryPatch` (moved to `modelPriceTable.js`, re-exported from the handler for import-path stability) accumulates both sides; `closeBook` folds them onto the daily row (`cacheWriteTokens` added to `buildDailyRow`, schema-additive). **Honest expectation, recorded for acceptance:** at the current Haiku 4.5 seat the stable prefix (~a few hundred tokens) likely sits under the model's minimum cacheable prefix, in which case `cache_control` no-ops silently and measured `cacheHitTokens` stays 0 — that is the measurement working, not a wiring gap; padding the prompt to force caching would be cost-negative and was not done.

**Item 5 — liveness measurement (I9, the top-risk instrument).**
- Per-batch turnaround persisted at finalize: `turnaroundMs` (submit → provider `ended_at`) and `harvestLagMs` (submit → applied) on the batch doc AND as a per-day sample map on the platform doc **`mandateBatchStats/{sessionDate}`** (`finalizeBatch`, `mandateBatchTransport.js:341-378`) — `{batches: {batchId: {tickKey, status, submittedAt, endedAt, harvestedAt, turnaroundMs, harvestLagMs, requestCount, dispositions}}}`, keyed by batch id so re-finalization is idempotent. ~10 batches/day → quantiles computable at read; acceptance #8 compares these against session windows with data.
- `executedVsSubmitted` + `staleRejectStreak` move through the SAME shared terminal patch under batch as under direct (verified by the transport tests: executed resets the streak; expired/rejected_stale increment; failed resets per the P3 semantics — reading stated in §5.4). The `MANDATE_STALE_STREAK` alert fires from the harvest exactly as from the eval loop.
- The injected late batch walks the full acceptance-critical path in-suite: age-out → provider cancel (best-effort) → `expired` terminal → streak++ → **gate cleared → next tick submits normally**, and a late provider result afterwards no-ops on the claim (transport test "LATE BATCH", interleavings (a)).

**Item 6 — money-path rounding scan (`api/_utils/mandateMoneyRounding.scan.test.js`).** The MONEY-7/MONEY-P4-3 class killer: over the transitive import closure of all six mandate money entrypoints (the same `evalPathClosure` walker as the sole-importer scans), every raw `Math.round`/`Math.floor`/`Math.ceil`/`.toFixed(` occurrence in a **mandate-owned** module must be `mandateRounding.js` itself or count-pinned in a reviewed baseline (display/calendar/estimate/clamp/counter classifications + the one deliberate money site, `floorShares`, directional by design per §4.1). Scope boundary (shared platform modules excluded, with the residual named) is documented in the test header. **Mutation-checked:** injecting `Math.round(x*100)/100` — the literal MONEY-P4-3 defect — into a mandate module turns the scan red.

**Tests:** full repo suite **7,912 passed / 0 failed** (60 skipped: emulator-rules-gated + flag-off — the standing skip set), +45 net new for the phase. `vite build` ✓. Native-ESM smoke extended to `api/mandate/drain.js` (all six mandate routes load under real `node`). Protected-store scan **9/9**.

---

## 2. The batch state machine (the deliverable) — enumerated

### 2.1 Book-side: the open-submission gate

`execState.openBatchId` = the open submission's requestId (house convention since P3), `openBatchSubmittedAt`, `openProviderBatchId` (new). One in-flight submission per book, enforced twice: the sweep's `skipped_open_batch` check (`mandate-evaluate.js:96-104`, **transport-independent** — F26's "cannot submit under the new mode" is honored under a mid-drain `'direct'` flip too) and the gate transaction's precondition.

```
IDLE (gate null)
  └─ submit gate txn (revision-preconditioned, NON-incrementing — reading §5.2)
       → OPEN (gate = requestId R; lastEvalTickKey stamped; sweep key advanced)
OPEN → exactly one terminal for R, each in ONE revision-disciplined transaction:
  executed        harvest: valid result, gates pass, §3.5 mutation      (streak → 0)
  gated           harvest: deterministic gate rejects (universe/caps/
                  exit-only/suspected-CA)                               (streak → 0)
  rejected_stale  harvest: any §3.3 validation failure (base_revision /
                  quarter_or_status / cross_session / price_drift /
                  no_harvest_mark) — discarded, never adapted; OR the
                  F26 drain (failCondition drained_transport_change)    (streak +1)
  failed          harvest: API-errored result / no tool_use / bad
                  decision shape / vintage unreadable / §3.5 invariant
                  abort                                                 (streak → 0)
  expired         batch age-out past MANDATE_RESULT_MAX_AGE_MS (harvest
                  lane), provider-expired result, MISSING result row,
                  or the close pass's book-level expiry duty            (streak +1)
  cancelled       rollover / escape in-transaction disposal; provider-
                  canceled result row                                   (streak → 0)
  → back to IDLE: every terminal flows through execStateTerminalPatch —
    counters++, streak per status, gate cleared IFF owned (§2.3) — so the
    book returns to submit-eligibility from every reachable state (I1).
```

The decision-doc **claim** (create-if-absent on `decisions/{R}`) makes the terminal unique: whichever path claims first stands; every later path no-ops idempotently (harvest replay, drain-after-rollover, close-expiry-then-harvest — all tested).

### 2.2 Batch-side: `mandateBatches/{providerBatchId}`

```
(no doc) ─ provider create ─→ (doc 'open', entries + envelopes recorded)
'open' → 'harvested'  provider ended ∧ every entry disposed (disposed map full)
'open' → 'expired'    age-out: provider cancel best-effort; every undisposed
                      entry → decision 'expired'; doc terminal when covered
'open' → 'cancelled'  drain: provider cancel best-effort; every undisposed
                      entry → decision 'rejected_stale'; doc terminal when covered
```
A doc leaves `'open'` only at full entry coverage; a lease-skipped or errored entry leaves the doc `'open'` for the next fire (bounded by the age-out lane). Terminal docs are retained 30 days (§3.7); **open docs are never retention-deleted** — a 30-day-old open doc alerts `MANDATE_BATCH_STUCK_OPEN` instead (`mandateClosePass.js` retention block).

### 2.3 Crash windows (submit) — each converging

| Crash point | State left | Convergence |
|---|---|---|
| before provider create | nothing anywhere | books unstamped → the same slot's next generous fire retries cleanly (zero cost — the liveness-optimal choice; Risk 7) |
| after create, before batch doc | provider-side orphan; no doc, no gates | books re-submit next tick under NEW requestIds (new tickKey ⇒ new hash); the orphan is never harvested and expires provider-side (24h). Bounded token waste; zero dangling state our side |
| after doc, before/among gate txns | ZOMBIE requests (in doc + provider, no gate) | the harvest still processes them — envelope validation against the live book decides (a still-valid zombie may legitimately execute; a moved book rejects it). Un-gated books may re-submit; same-revision duplicates share a requestId and converge on the claim; different-revision duplicates are distinct requests of which at most one validates. The **ownership-conditional gate clear** (below) keeps a zombie's terminal from releasing a live submission's gate |
| gate txn precondition fails | zombie (logged `MANDATE_BATCH_ZOMBIE`) | as above |

**The ownership-conditional clear (P5's one deliberate change to merged P2 semantics).** `writeTerminal`/`disposeSubmission` clear the gate block **iff `execState.openBatchId === decisionId`**. P2's unconditional clear was written when the gate was never set (direct mode); under batch, a zombie's terminal with an unconditional clear would release the gate a NEWER live submission holds, re-opening double-submit. Under direct mode the change is value-invisible (gate always null). Mutation guards: `mandateExecution.test.js` P5 block (owned gate → full block cleared incl. `openProviderBatchId`; foreign gate → survives).

### 2.4 Crash windows (harvest)

| Crash point | Convergence |
|---|---|
| after `executeDecision`/`disposeSubmission` commit, before `markDisposed` | the kickoff's named scenario: next fire re-processes the entry → the claim no-ops → disposed map converges → doc finalizes. **No double execution, no double billing** (bookkeeping is skipped on `idempotent:true`) — interleavings test (b) |
| two fires poll the same open batch | per-entry leases serialize the bookkeeping; the claim serializes the money; the disposed-map merge and finalize are idempotent (same keys, same values) |
| harvest races the close pass | both are revision-preconditioned transactions on the book; the loser retries against the winner. Close wins → the result dies `base_revision` (interleavings test (c), barrier-forced). Harvest wins → the close re-marks the post-trade book. **Discovered third path, kept:** a close whose `now` puts the submission past the 4h age runs its own expiry duty first and claims `expired`; the harvest then no-ops on the claim — also correct, also converging (test (c)'s comment pins the in-window variant deliberately) |
| harvest races rollover/escape | the lifecycle txns cancel the open submission inside their own commit (P4, now live); the late result no-ops on the claim — interleavings test (d) drives the REAL `escapeMandate` with a real open batch and then delivers the "valid" result |

### 2.5 Liveness bound (the C-21 question, quantified)

A gated book skips evals — worst case walked explicitly: midday submit (~12:45 ET) → preClose harvest missed (cron hiccup) → close-window expiry does NOT fire (age ~3.5h < 4h) → book stays gated overnight → next session's open30 fire harvests-before-submitting (cross-session ⇒ `rejected_stale`, gate cleared) → the book submits **that same tick**. Evals lost: zero (there are no ticks between preClose and next open30 at which it could have evaluated). The 4h age-out, the close-pass duty, next-session harvest-before-submit, and the drain are four independent release paths; no reachable state is indefinite. (Reviewer verdicts on this claim: §3/§4.)

---

## 3. Pass 1 — findings (four adversarial Opus reviewers)

Four lenses per the kickoff's aim: **invariants** (batch state machine under crash-replay + the harvest/close/rollover three-way), **money** (fill honesty under batch latency; drift guard; harvest-tick pricing; billing), **C-21** (can a stuck batch suppress an exit or block escape), **spec** (drain fidelity; last-tick under early closes; scope).

<!-- FINDINGS TABLE — filled after the reviewer pass -->

## 4. Pass 2 — verification (refute-with-repro) and dispositions

<!-- Filled after the refuter pass -->

---

## 5. Ambiguities and readings chosen (for founder review)

1. **The gate write is revision-PRECONDITIONED, not revision-incrementing.** §2.1's "revision: incremented in every mutating transaction" is read as governing mutations of book substance (portfolio, lifecycle, records); the gate set is submission bookkeeping. The precondition gives the same safety (any concurrent substantive mutation bumps revision and fails the gate txn), while incrementing would force `computeRequestId` to hash a predicted post-increment revision — fragile for no added safety. Every SUBSTANTIVE P5 write (every terminal transition, incl. `disposeSubmission`) does increment.
2. **`isLastSlotForTier` wiring (F3).** The no-submit predicate is **session-scoped** (`isFinalSessionSlot`): the spec's subject is "the final eligible tick of a session," and the harvest runs on every later fire regardless of tier, so a tier riding an early slot submits freely — which is P2's own stated design for `TIER_SLOTS` ("slow rides an EARLY slot… to leave a later harvest tick"). A per-tier no-submit predicate would forbid slow tier from ever trading (its only slot is its own last). `isLastSlotForTier` is wired as the tier-scoped view in the suite-asserted construction property (every tier retains ≥1 submitting slot under batch). Accepted F3 cost, stated: under batch, fast tier submits twice/day (open30, midday) with preClose harvest-only; direct mode keeps three.
3. **Drain wording (the kickoff's explicit reconciliation ask).** Batch doc → `'cancelled'`; drained decisions → `'rejected_stale'` + `failCondition:'drained_transport_change'`; rollover/escape decisions stay `'cancelled'` (their §5.3/§5.4 letter). Rationale in §1 item 3. A drain bumps each affected book's streak by 1 (status-driven, I9-honest: the submissions did die undelivered); at the alert threshold of 3 a single drain cannot alert alone.
4. **API-errored requests → `failed`, streak-neutral-by-reset (the kickoff asks for this reading).** P3's `streakAfter` resets on `failed` ("executed/gated/failed all mean the pipeline delivered a live answer"); an API error is a definite infrastructure failure, not a staleness discard, so it feeds `consecutiveEvalFailures` (→ quarantine, like the direct loop) and resets the staleness streak. The streak stays a pure staleness instrument.
5. **No-tool-use / malformed decisions under batch → terminal `failed`** (`model_no_tool_use` / `bad_decision:<reason>`), unlike direct mode's soft no-decision skip: under batch the submission exists durably (gate set), so I1 demands a terminal decision doc. Health increments identically to direct.
6. **`failCondition` made durable on the decision doc** (`mandateSchema.js buildDecision`, additive at schemaVersion 1 — the P3/P4 row-extension precedent). P2 carried the §3.3 "failing condition recorded" only on return values (+ drift's gateOutcome); under batch the submit context is gone by harvest time and the receipt is the only record. The close-pass expiry now also records `result_age`.
7. **Harvest telemetry/health under the book lease, billed at harvest, batch rates.** The P3 INV-3 idiom (read → bill → merge under one hold) reused verbatim; billing keys off the entry's stored model id (no second vintage read); idempotent replays bill nothing. Direct-path billing is untouched. `telemetryPatch` moved to `modelPriceTable.js` (§6.2's home) so the transport never imports a cron entrypoint; the handler re-exports it (zero import-path churn — its tests run unchanged).
8. **`MODEL_PRICE_TABLE_VERSION` 1→2** (batch multiplier + cache read/write components — the change the P2 header explicitly reserved for P5). Usage is priced exactly as the API reports it (`input_tokens` exclusive of cache tokens); whether batch and caching stack is measured, never assumed (D-20).
9. **Normalize against submit-time verbs, gate against harvest-time state.** The entry stores the verb set the decision tool offered (what the model SAW); `evaluateGate` runs against the fresh book (quarantine imposed mid-flight blocks an entry at harvest — transport test "QUARANTINED-at-harvest"). A quarantined-at-submit book's exit-only tool travels with the request, so its exits normalize and execute at harvest.
10. **`submitMark` derived at harvest from the submit tick's durable snapshot** (120-day retention ≫ any harvest window; one read per batch). It cannot be stored at submit because the ticker is unknown until the model answers. A missing submit snapshot or absent ticker ⇒ `submitMark null` ⇒ drift = ∞ ⇒ entries fail closed at the drift guard; exits are never subject (C-21). Residual (accepted, documented): the drift basis is the RAW submit snapshot — a symbol CA-frozen at submit but clean at harvest compares against the raw submit mark; the harvest-side gate re-checks `caFrozen` at harvest, and the case requires the model to have named a symbol its own prompt excluded.
11. **Failed-snapshot ticks harvest against a minimal `{tickKey, symbols:{}}` context** (§3.1 "the tick harvests but does not submit"): entries die at the universe/drift gates (fail-closed), exits fill at carry-over marks, HOLDs execute — C-21 holds degraded (interleavings test (g) proves the SELL fills at last-good while the BUY gates).
12. **The drain endpoint reuses the founder-create flag** (P4 ambiguity-4 precedent: founder ops machinery, no new flag, no flag-pin churn) with the same two-condition auth.
13. **Counter asymmetry, pre-existing, left alone:** the close-pass expiry (P3-reviewed) bumps the streak but not `submitted`; the harvest expiry paths (P5, primary under batch) bump both via the shared patch. Changing the close path would churn P3 goldens for a rare backstop; noted for the acceptance run's counter reads.
14. **The rounding scan's scope boundary** — mandate-owned modules on the money-path closure; shared platform modules excluded with the residual stated in the test header (a shared module writing book money directly would evade the rounding scan and be caught by the protected-store write-site review instead).

---

## 6. Protected-store scan (standing rule, handled in-PR)

Resolvability first: all 11 new write sites resolve `::unresolved` — the same two classes as every P1–P4 entry (transaction-handle `tx.set`/`tx.update` on passed-in refs; `.set` through a collection-name **constant** the scanner cannot resolve; B3-EXT one-hop helper calls). None can be restructured to a literal without breaking the atomic boundaries. **Write-target table:** `mandateBatches/{providerBatchId}` (bookkeeping doc: create, disposed-map merges, finalize), `mandateBatchStats/{date}` (I9 per-day samples), `mandates/{id}` (gate txn; disposition update), `mandates/{id}/decisions/{requestId}` (terminal receipts) — **none is in `PROTECTED_COLLECTIONS`**. Allowlisted at pinned counts with a `_notes_spec1_phase5` block. Scan 9/9 green (deny-by-default + count-drift + no stale).

New platform collections (`mandateBatches`, `mandateBatchStats`) are Admin-SDK-only server state — no client reads, no security-rules surface change (client writes to everything mandate remain denied wholesale per §2.4), no new composite indexes (`status=='open'` and the retention `sessionDate` range are single-field, auto-indexed).

---

## 7. Flagged for P6 / founder (known boundaries, not defects)

- **Measured turnaround from live runs is NOT obtainable in this environment** (no network, no API key, crons don't run on preview — BUILD_RULES §6). The instrument is built and suite-proven with a fake provider; acceptance #8's real distribution lands in P6's acceptance run. What P5 can promise structurally: submission only ever happens with ≥1 later same-session harvest fire, and the 4h age-out bounds every miss.
- **Provider-side orphan batches** (crash between create and the batch doc) cost bounded tokens and expire provider-side in 24h; they are invisible to our state machine by design. If ops wants them enumerable, a `batches.list` reconciliation belongs in P6 ops tooling, not the money path.
- **Batch spend duplication windows** (zombie/duplicate submissions) are converging and bounded (one duplicate model call per affected book per crash) — accepted per Risk 7's liveness-first posture; `MANDATE_BATCH_ZOMBIE` logs each occurrence for the acceptance run to count.
- **Prompt-cache minimum:** at the current Haiku seat the stable prefix likely sits under the minimum cacheable length; measured `cacheHitTokens`/`cacheWriteTokens` will say (item 4 §1). If the founder wants cache economics, the lever is a larger stable scaffold or a seat change at rollover — a product decision, not P5 plumbing.
- **`mandateBatchStats` doc growth:** ~10 samples/day keyed by batch id in one doc per day — no ceiling risk; retention deletes with the 30-day window.

---

## 8. Verdict

<!-- Filled after the review passes -->
