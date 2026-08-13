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
'open' → 'harvested'  provider ENDED ∧ every entry disposed ∧ usage billed
                      (the poll runs FIRST: an ended batch harvests normally
                      whatever its age — per-request validation expires stale
                      results with honest conditions and real billing)
'open' → 'expired'    age-out (un-ended past MANDATE_RESULT_MAX_AGE_MS):
                      provider cancel best-effort ONCE (agedOutAt marker);
                      every undisposed entry → decision 'expired' NOW (books
                      freed immediately); the DOC then waits for the provider
                      to end so pre-cancel usage still bills (the `billed`
                      map), finalizing at end — or loudly at the
                      MANDATE_BATCH_BILLING_GIVEUP_MS horizon with
                      unbilledRequestCount + MANDATE_BATCH_UNBILLED_SPEND
'open' → 'cancelled'  drain (F26): drainRequested marker FIRST (stragglers
                      keep the drain disposition), provider cancel
                      best-effort; every undisposed entry → decision
                      'rejected_stale'; unbilled count recorded at finalize
```
A doc leaves `'open'` only at full entry coverage, through a TRANSACTIONAL finalize conditioned on `status === 'open'` (racing fires cannot write divergent terminals). A lease-skipped or errored entry leaves the doc `'open'` for the next fire; a book-missing entry disposes leaselessly so the doc still converges. Terminal docs are retained 30 days (§3.7); **open docs are never retention-deleted** — a 30-day-old open doc alerts `MANDATE_BATCH_STUCK_OPEN` instead; `mandateBatchStats` is the record side and is never swept.

### 2.3 Crash windows (submit) — each converging

| Crash point | State left | Convergence |
|---|---|---|
| before the enqueue stamp | nothing anywhere | the same slot's next generous fire retries cleanly (zero cost) |
| between enqueue stamps and provider create | books stamped (billed-eval + frontier keys), nothing submitted | the stamped books SKIP the rest of this slot and submit fresh next slot under new requestIds. **Deliberate trade (review #1):** one recoverable lost slot beats the duplicate-page spend the unstamped design incurred on ROUTINE fire overlap — Risk 7 priced liveness first, but overlap is every slot and a crash is rare |
| after create, before batch doc | provider-side orphan; no doc, no gates; books stamped | books submit fresh next slot; the orphan is never harvested and expires provider-side (24h). Bounded token waste; zero dangling state our side; unbillable (documented §7) |
| after doc, before/among gate txns | ZOMBIE requests (in doc + provider, no gate) | the harvest still processes them — envelope validation against the live book decides (a still-valid zombie may legitimately execute; a moved book rejects it). Same-revision duplicates share a requestId and converge on the claim; different-revision duplicates are distinct requests of which at most one validates. The **ownership-conditional gate clear** keeps a zombie's terminal from releasing a live submission's gate, and the ownership-conditional STAMP keeps it from dragging `lastEvalTickKey` backward |
| gate txn precondition fails | zombie (logged `MANDATE_BATCH_ZOMBIE`) | as above |

**The ownership-conditional clear (P5's one deliberate change to merged P2 semantics).** `writeTerminal`/`disposeSubmission` clear the gate block **iff `execState.openBatchId === decisionId`**. P2's unconditional clear was written when the gate was never set (direct mode); under batch, a zombie's terminal with an unconditional clear would release the gate a NEWER live submission holds, re-opening double-submit. Under direct mode the change is value-invisible (gate always null). Mutation guards: `mandateExecution.test.js` P5 block (owned gate → full block cleared incl. `openProviderBatchId`; foreign gate → survives).

### 2.4 Crash windows (harvest)

| Crash point | Convergence |
|---|---|
| after `executeDecision`/`disposeSubmission` commit, before `markDisposed` | the kickoff's named scenario: next fire re-processes the entry → the claim no-ops → disposed map converges → doc finalizes. **No double execution, no double billing** (bookkeeping is skipped on `idempotent:true`) — interleavings test (b) |
| two fires poll the same open batch | per-entry leases serialize the bookkeeping; the claim serializes the money; the disposed-map merge and finalize are idempotent (same keys, same values) |
| harvest races the close pass | both are revision-preconditioned transactions on the book; the loser retries against the winner. Close wins → the result dies `base_revision` (interleavings test (c), barrier-forced). Harvest wins → the close re-marks the post-trade book. **Discovered third path, kept:** a close whose `now` puts the submission past the 4h age runs its own expiry duty first and claims `expired`; the harvest then no-ops on the claim — also correct, also converging (test (c)'s comment pins the in-window variant deliberately) |
| harvest races rollover/escape | the lifecycle txns cancel the open submission inside their own commit (P4, now live); the late result no-ops on the claim — interleavings test (d) drives the REAL `escapeMandate` with a real open batch and then delivers the "valid" result |

### 2.5 Liveness bound (the C-21 question, quantified — post-fix)

A gated book skips evals. Release paths, in layering order: (1) the tick's own harvest (normal operation); (2) **the transport-independent in-sweep gate age-out** (review #6: any gate older than `MANDATE_RESULT_MAX_AGE_MS` is expired by the sweep itself, and the book evaluates THAT SAME FIRE — under `'batch'` and `'direct'` alike); (3) the close pass's once-daily expiry duty; (4) next-session harvest-before-submit; (5) the founder drain. **Worst-case submit-blocked wall clock during sessions: ≤ 4h + one slot gap** — the multi-day mid-drain window the C-21 reviewer computed against the pre-fix build (92–118h) is closed; closed-market spans (nights/weekends/holidays) remain, when no transport could trade anyway. The C-21 reviewer's pure-batch walk (C21-P5-9) additionally proved: at most ONE submitting slot can ever be lost to a stuck batch within a session (slots are ≥2h45m apart; the age-out fires at 4h), and the Friday-midday-overnight case loses ZERO submitting slots. No reachable state is indefinite; the gated state is now visible (`gatedOpenBatch` counter, `MANDATE_OPEN_BATCH_UNDER_DIRECT`, `MANDATE_GATE_EXPIRED`).

---

## 3. Pass 1 — findings (four adversarial Opus reviewers)

Four lenses per the kickoff's aim: **invariants** (batch state machine under crash-replay + the harvest/close/rollover three-way), **money** (fill honesty under batch latency; drift guard; harvest-tick pricing; billing), **C-21** (can a stuck batch suppress an exit or block escape), **spec** (drain fidelity; last-tick under early closes; scope). 44 findings were raised (7 money, 12 spec, 13 C-21, 12 invariants — several one defect seen through multiple lenses). The full reviewer outputs are preserved verbatim in the session record; the table consolidates by defect.

| # | IDs (lens) | Sev | Claim (as raised) |
|---|---|---|---|
| 1 | INV-P5-1/-2 (inv) | BLOCKER | The batch enqueue path wrote NO durable stamp under the book's lease — the within-slot idempotency landed only in the post-loop gate txn, so two overlapping generous fires re-enqueued and re-billed the entire page (routine cron overlap, not a crash corner); a failure between provider create and the gate txns additionally left the sweep frontier un-advanced (the P3 INV-4 pin regression). |
| 2 | INV-P5-3 (inv) | HIGH | The gate short-circuit ran BEFORE envelope validation, so under batch a stale/cross-session/aged result whose decision also failed a gate (position exited in flight → `not_held`) recorded `gated` and RESET the I9 staleness streak — the designated liveness wire — exactly when submissions were dying stale. |
| 3 | MONEY-P5-1, INV-P5-9 (money, inv) | HIGH | Four paths spent real provider tokens and recorded $0: age-out (cancelled without ever streaming results), drain, close-expiry-then-harvest (the idempotent skip discarded the priced usage), and the create→doc crash orphan. Quantified at up to ~7.5% of the D-22 band invisible, with the run-rate alert blind. |
| 4 | MONEY-P5-2 (money) | HIGH | A degraded-tick harvest (failed snapshot → `symbols:{}`) derived the friction tier from the empty snapshot → `'unknown'` 20 bps on every exit — $1,700 phantom friction on a $1M mega-cap exit; the exact P3 money-review finding-4 class, batch edition, blessed by a passing test that didn't look at the price. |
| 5 | C21-P5-1 (C-21) | MED-HIGH | `skipped_open_batch` shared `skipped_tier`'s `lastSweepTickKey` stamp, converting a TRANSIENT gate (clearable by the next fire's harvest) into a slot-long submit lockout — up to ~72h of lost eligibility across a weekend for a condition that had already cleared mid-slot. |
| 6 | C21-P5-2 (C-21) | MED | Mid-drain (mode flipped to `'direct'` with batches open) had NO 4h backstop — only the once-daily close pass, whose age test provably misses same-day midday submissions (3h01m < 4h at the close fire) → worst case ~92–118h submit-blocked, invisible (no counter, no log). |
| 7 | C21-P5-6 (C-21) | MED | `expired`/`result_missing` dispositions were credited as SUCCESSFUL evals (`lastSuccessfulEvalAt`, failures reset) — a permanently-broken transport could never quarantine and reported `agencyState:'full'` while undelivered for weeks. |
| 8 | C21-P5-7, INV-P5-8 (C-21, inv) | MED | The eval sweep still claimed `complete:true` on `newlyEvaluated===0` with no errors/lease/deferral/harvest guard (the close sweep's P3 INV-1 lesson, unapplied) — reachable systematically under batch (harvest consuming the whole budget; an all-gated population). |
| 9 | C21-P5-3 (C-21) | MED | The age-out loop — the stuck-batch defense itself — had no per-entry try/catch: one throwing entry aborted disposal of all its siblings. |
| 10 | C21-P5-4, INV-P5-5, SPEC-P5-8 (3 lenses) | MED | A missing book doc made its batch doc immortal (lease `no_such_book` → `skipped:'lease'` forever; the `book_missing` branch was dead code that would throw), and ≥20 stuck docs would deterministically starve ALL harvesting (unordered poll page). |
| 11 | INV-P5-6 (inv) | MED | A zombie's terminal wrote `lastEvalTickKey ← its old submitTickKey`, dragging the billing stamp BACKWARD over a newer submission's. |
| 12 | INV-P5-7 (inv) | MED | A transient submit-snapshot READ failure terminally rejected every entry in the batch (`price_drift` via null submitMark) — paid results destroyed by a Firestore blip. |
| 13 | SPEC-P5-3/-4 (spec) | MED | A partially-drained batch's stragglers harvested later as `'cancelled'` (lifecycle word) instead of the §3.3-mandated `rejected_stale`, flipping the I9 streak sign; and a partially-drained doc was unreachable under `'direct'` until the 30-day alert. |
| 14 | C21-P5-5 (C-21) | LOW-MED | The batch-doc age test failed OPEN on a missing/corrupt `submittedAt` (`?? now` → age 0 → never ages) — the wrong fail direction for the liveness backstop (the close pass's twin fails closed). |
| 15 | MONEY-P5-4/-6 (money) | MED/LOW | `unpricedCalls` was write-only (no day block, no row, no alert; once-per-process console line), and a NULL model id skipped even that line — unknown-model spend understated estUsd/run-rate with near-zero signal. |
| 16 | SPEC-P5-5 (spec) | MINOR | §3.7 batch retention used collection-name literals (rename would silently break it) and had zero test coverage — the phase's thinnest deliverable against the mutation-check rule. |
| 17 | SPEC-P5-12 (spec) | LOW | `mandateBatchStats/{date}` — acceptance #8's evidence — was swept by the 30-day bookkeeping window. |
| 18 | SPEC-P5-10 (spec) | LOW | No drain endpoint test (auth property unlocked). |
| 19 | SPEC-P5-7 (spec) | LOW | `MANDATE_BATCH_STATUSES` inert; no set-level I1 completeness assertion; the `gated` case lacked a gate-clear assertion. |
| 20 | SPEC-P5-9 (spec) | LOW | Claimed the batch×cache `estUsd` arithmetic "assumes stacking" in the place §3.3 forbids; also flagged the missing non-zero-cache end-to-end test. |
| 21 | SPEC-P5-1, C21-P5-13 (spec, C-21) | MINOR | Under batch, `fast` ≡ `standard` (both submit open30+midday; preClose is harvest-only) — a spec-arithmetic consequence of F3 × slot geometry, unrecorded, with §6.3's ~2× fast-tier cost assumption no longer holding. |
| 22 | MONEY-P5-3 (money) | MED | Slot geometry × the 4h age: an open30 batch has ONE in-window harvest slot (midday); ended-but-old batches were blindly cancelled unbilled at preClose. |
| 23 | SPEC-P5-6, INV-P5-4 (spec, inv) | MINOR | Three lifecycle disposal paths (close-expiry, rollover, escape) bypass `execStateTerminalPatch` — `submitted` under-counts on those paths; the transport header overclaimed "every terminal transition"; plus a theoretically-unreachable streak-outside-guard in the close expiry. |
| 24 | INV-P5-10 (inv) | LOW | Rollover/escape overwrite `decisions/{openBatchId}` with an unconditional `tx.set`, safe only via a non-local revision argument. |
| 25 | INV-P5-11 (inv) | LOW | Concurrent fires could finalize one batch doc with divergent status / undercounted dispositions (finalize wasn't transactional). |
| 26 | INV-P5-12, C21-P5-8 (inv, C-21) | LOW | "Harvested book re-submits THIS tick" holds only ≤ page-size populations (the harvest advances the sweep key, sorting freed books behind). |
| 27 | MONEY-P5-5 (money) | MED | Prompt caching ships unconditionally and is plausibly a +25% regression under batch (writes-without-reads above the min-cacheable prefix), with no flag. |
| 28 | MONEY-P5-7 (money) | LOW | Failed-snapshot receipts stamp a `harvestTickKey` whose snapshot doc was never written. |
| 29 | C21-P5-10 (C-21) | LOW (spec text) | The CODE holds (escape never refusable for a batch — P5 added no precondition), but spec §5.4's sentence "`execState.openBatchId` is null" as an escape PRECONDITION contradicts I1/FR-3's dispose-not-refuse ruling — a trap for a future implementer. |
| — | C21-P5-9/-11/-12, INV attacks-that-hold, MONEY attacks-that-hold | — | The reviewers additionally recorded the attacks that FAILED with defending lines: double-execute from zombie pairs (claim + revision), gate-stuck-forever (unreachable), close-expiry-vs-harvest conflicting terminals (serialized), batch-doc convergence after markEntry crashes, provider-dead age-out independence, quarantined-exit round-trip integrity, failed-snapshot exit-at-carry-over (full trace), escape unblockability. |

## 4. Pass 2 — verification (refute-with-repro) and dispositions

Every finding was driven to a disposition; **each CONFIRMED fix ships with a mutation-guard test that fails without it** (the guard IS the repro, per the §2 pattern). A dedicated Opus refuter then attacked the REFUTED/residual dispositions and gave the fix pass itself an adversarial look (§4.3).

### 4.1 CONFIRMED — fixed in this PR, with guards

1. **#1 (INV-P5-1/-2) — FIXED.** The enqueue branch now writes the billed-eval stamp + sweep frontier key UNDER THE LEASE, before provider creation (`mandate-evaluate.js` enqueue branch); the gate txn re-asserts them atomically with the gate. Stated trade (audit'd in-code): a crash between stamp and create costs the stamped books one slot — a lost slot is recoverable, duplicate spend is not. Guard: interleavings (i) — fire A crashes at create (stamped, unsubmitted, loud); fire B the same slot skips, `createMandateBatch` never called twice.
2. **#2 (INV-P5-3) — FIXED.** `validateEnvelope` split into phases: base conditions 1–4 run BEFORE the gate; mark conditions 5–6 after it, with the condition-5 refinement (null harvest mark rejects as staleness only when the ticker HAD a submit mark — a vanished symbol is transport staleness; a never-eligible one keeps the honest `gated`/universe label, preserving P2 direct-mode semantics). Guards: four new executeDecision tests (stale+not-held → `rejected_stale`/`base_revision`/streak++; aged+gated → `expired`; hallucinated → `gated`; vanished → `rejected_stale`/`no_harvest_mark`).
3. **#3 (MONEY-P5-1/INV-P5-9) — FIXED.** The batch doc gained a `billed` map (usage accounting exactly-once, INDEPENDENT of the decision claim): a result whose terminal was claimed elsewhere still bills when it arrives; the age-out path now polls FIRST (an ended batch harvests normally whatever its age — validation expires per-request with honest conditions and real billing), disposes books immediately when un-ended, and defers doc finalization to the provider's end for billing, giving up loudly past `MANDATE_BATCH_BILLING_GIVEUP_MS` with `unbilledRequestCount` + `MANDATE_BATCH_UNBILLED_SPEND`. Drain finalization records its unbilled count the same way. Guards: the rewritten LATE BATCH test (bill-on-idempotent + third-pass no-double-bill), the BILLING GIVE-UP test, the close-expiry-billing test (incl. non-zero cache reads/writes end-to-end — closing SPEC-P5-9's coverage gap). Residual (documented §7): the create→doc orphan remains unbillable (no our-side record) — bounded, provider-expiring, ops-reconcilable.
4. **#4 (MONEY-P5-2) — FIXED.** The harvest tiers friction from the submit-tick snapshot whenever the current snapshot cannot tier the symbol (cap is split-invariant and slow-moving); passed as an explicit override into `executeDecision`. Guard: interleavings (g) now asserts the mega tier (1+2 bps) and the exact executed price on the degraded-tick exit.
5. **#5 (C21-P5-1) — FIXED.** `skipped_open_batch` no longer writes the slot stamp (frontier key only) — a mid-slot gate clearance is USED by the same slot's next fire. Guard: interleavings (j) — fire 1 skip-without-stamp, fire 2 harvests and RE-SUBMITS in the same slot.
6. **#6 (C21-P5-2) — FIXED structurally.** The gate age-out is now TRANSPORT-INDEPENDENT at eval granularity: any gate older than `MANDATE_RESULT_MAX_AGE_MS` is expired by the sweep itself (`MANDATE_GATE_EXPIRED`, revision-disciplined via `disposeSubmission`), and the book evaluates THE SAME FIRE. Worst-case submit-blocked time collapses to ≤ 4h + one slot gap during sessions (closed-market spans excepted, when no one can trade anyway). Visibility: `summary.gatedOpenBatch` counter + `MANDATE_OPEN_BATCH_UNDER_DIRECT` alert. Guard: interleavings (k) — a 5h-old gate under `'direct'` expires in-sweep and the model is called that fire.
7. **#7 (C21-P5-6) — FIXED.** `bookkeepHealth` maps `failed` AND `expired` to eval failures (quarantine path live for a dead transport; `agencyState` stops claiming `full`); `cancelled` is lifecycle-neutral; delivered answers (executed/gated/rejected_stale) remain successful evals. Guards: LATE BATCH asserts `consecutiveEvalFailures:1` on age-out; the partial-batch test asserts the errored entry's failure count. |
8. **#8 (C21-P5-7/INV-P5-8) — FIXED.** Eval-sweep completion now requires zero errors, zero lease-skips, no time-budget deferral, and a clean harvest (mirroring the close sweep's P3 guard); the harvest respects the deadline per-entry and per-batch. Guard: interleavings (i)'s second fire asserts `complete:true` only on the clean path; the deferral/error paths are covered by the summary plumbing tests.
9. **#9 (C21-P5-3) — FIXED.** The age-out loop got the same per-entry try/catch + deadline checks as the results loop (one thrower no longer aborts its siblings).
10. **#10 (C21-P5-4/INV-P5-5/SPEC-P5-8) — FIXED.** `disposeSubmission` claims the terminal decision even when the book doc is GONE (no throw; no book fabricated); both harvest lanes treat `no_such_book` as proceed-leaselessly. A batch doc can therefore always converge; the deterministic poll-page starvation loses its known feeder. Guards: the missing-book executeDecision test; the transport 'deleted book cannot strand its batch doc' test (doc → `harvested`).
11. **#11 (INV-P5-6) — FIXED.** The billing stamp is written only when the terminal OWNS the gate or no gate exists (direct mode) — a zombie can no longer drag it backward. Guard: the foreign-terminal stamp test.
12. **#12 (INV-P5-7) — FIXED.** A submit-snapshot read ERROR leaves the batch open for retry (age-out still backstops); only a genuinely absent doc proceeds null/fail-closed. Guard: the poisoned-read transport test (nothing disposed, doc open).
13. **#13 (SPEC-P5-3/-4) — FIXED.** The drain marks `drainRequested` on the doc BEFORE cancelling; later-arriving `canceled` rows keep `rejected_stale`/`drained_transport_change` (streak evidence preserved) and the doc finalizes `cancelled`; an incomplete drain logs `MANDATE_DRAIN_INCOMPLETE` loudly with an `incomplete` count in the response. Guards: the two drain-marker tests (marked vs console-cancel).
14. **#14 (C21-P5-5) — FIXED.** Batch-doc age fails CLOSED (missing/unparseable `submittedAt` = infinitely old), matching the close pass's twin. Guard: the corrupt-submittedAt test.
15. **#15 (MONEY-P5-4/-6) — FIXED.** `unpricedCalls` now flows day-block → daily row → `MANDATE_UNPRICED_SPEND` close alert; a null model id alerts like any unknown id. Guards: priceUsage/telemetryPatch tests + the alert path.
16. **#16 (SPEC-P5-5) — FIXED.** Retention uses `MANDATE_BATCH_COLLECTION`; full retention test added (terminal-old swept; OPEN preserved + `MANDATE_BATCH_STUCK_OPEN`; recent kept; stats retained).
17. **#17 (SPEC-P5-12) — FIXED by a stated reading.** `mandateBatchStats` is the RECORD side of §3.7's line (acceptance #8's evidence, the standing I9 instrument) and is no longer swept; one tiny doc per batch day. |
18. **#18 (SPEC-P5-10) — FIXED.** `api/mandate/drain.test.js` locks the auth property (dark by default; flag alone insufficient; allowlist alone insufficient; POST-only; opaque 403).
19. **#19 (SPEC-P5-7) — FIXED (tests).** The `gated` terminal's gate-clear is asserted; the six terminal statuses each have a gate-release assertion across the suite; `MANDATE_BATCH_STATUSES` documents the doc machine (kept as the exported contract).
20. **#25 (INV-P5-11) — FIXED.** `finalizeBatch` is a transaction conditioned on the doc still being `'open'`, reading the disposed map inside it — racing fires cannot write divergent terminals or undercounted dispositions; the stats sample is idempotent by batch-id key.
21. **#23-part (SPEC-P5-6 header overclaim) — FIXED (docs).** The transport header now names the three lifecycle paths that share only the gate-clear half; the counter asymmetry is the documented reading below.

### 4.2 REFUTED / accepted residuals / founder flags

- **#20 (SPEC-P5-9) — REFUTED (with its test gap closed).** Pricing REPORTED usage components at the published rate card is billing arithmetic on measured quantities; §3.3's "do not assume stacking" governs whether cache hits OCCUR under batch — which is exactly what `cacheHitTokens`/`cacheWriteTokens` measure per call. The missing end-to-end non-zero-cache test was added regardless (§4.1 #3).
- **#21 (SPEC-P5-1/C21-P5-13) — CONFIRMED as spec arithmetic; FOUNDER FLAG, no unilateral change.** Under batch, fast ≡ standard (two submitting slots each) and §6.3's fast-tier cost assumption halves. This is F3 × the P2 slot table, both spec-pinned; options (a fourth non-final fast slot, revised tier tables, or acceptance of the collapse) are a founder calibration at P6, not an executor edit (guardrail 1). Recorded here and in the PR.
- **#22 (MONEY-P5-3) — PARTIALLY FIXED (the billing/honesty half, via #3's poll-first reorder: an ended-but-old batch now bills and records honest per-result `expired` conditions); the CALIBRATION half — whether `MANDATE_RESULT_MAX_AGE_MS` (4h, spec initial) should exceed the open30→preClose gap (5h30m) — is a FOUNDER FLAG with the arithmetic laid out in the PR.**
- **#23 (SPEC-P5-6/INV-P5-4 counters) — DOCUMENTED READING.** The three lifecycle disposal paths (close-expiry, rollover, escape — P3/P4-reviewed transactions) move the streak (where applicable) and the gate but not `submitted`. The streak is THE liveness wire by founder ruling (P2 close-out); the ratio is a coarse secondary; restructuring FR-1-guarded transactions to feed a secondary instrument is churn risk for no primary-signal gain. The INV-P5-4-secondary (streak-outside-guard) is unreachable in the current machine (§4.3 refuter verdict) and stays as written.
- **#24 (INV-P5-10) — DOCUMENTED RESIDUAL.** The unconditional `tx.set` in rollover/escape is safe via the (now audit-recorded) invariant: a decision doc for the GATE'S OWN id cannot exist while the gate is set, because every owning terminal clears the gate in the same transaction and the gate txn preconditions on revision. Future writers adding a decision-doc path must preserve it; the refuter re-verified it against the post-fix machine (§4.3).
- **#26 (INV-P5-12/C21-P5-8) — ACCEPTED + comment corrected.** Same-tick re-submission is exact ≤ page-size; above it, fairness-first ordering hands the freed book to a later generous fire. Self-balancing, never starving.
- **#27 (MONEY-P5-5) — MEASURED RISK, accepted.** D-20 mandates the mechanism; both cache sides are measured per call into daily rows; the regression scenario (writes-without-reads above the min-cacheable prefix) is detectable from row telemetry within days and reversible by a one-line change. A new flag would contradict §7's posture, and a dark default would leave acceptance unable to measure caching at all. At the current Haiku seat the scaffold sits under the minimum cacheable prefix (≥2048 tokens), so the expected day-one state is INERT-and-measured-zero.
- **#28 (MONEY-P5-7) — ACCEPTED RESIDUAL.** `fillMarkQuality:'carry_over'` carries the fill honesty; the absent snapshot doc is derivable from the tick key. No receipt field added.
- **#29 (C21-P5-10) — SPEC-TEXT DEFECT, FOUNDER FLAG.** The code follows I1 ("escape … disposes of open batches inside their transactions; never blockable") — but spec §5.4's precondition sentence ("`execState.openBatchId` is null") contradicts it and would instruct a future implementer to build the exact D-3 violation. Flagged for a spec-text amendment at the next spec touch; no code change (the disposition table §14/I1 is the later, controlling ruling).

### 4.3 Refuter pass verdicts

<!-- REFUTER VERDICTS -->

---

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
