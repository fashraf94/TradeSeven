# Intraday Data — Build 1 Contract (V1.1)

**Supersedes:** Contract V1 (2026-09-19). Spec V3 and Amendment A remain the ledger record of how rulings were reached. **This is the document the build implements.** Clauses changed from V1 are marked **(V1.1)**.
**Author:** Fable. **Reviewers of record:** Astra (four rounds), Sol. **Builder:** Fable in Claude Code. **Fence contact in build 1: none.**

---

## 0. In plain terms

Build 1 collects delayed intraday quotes every minute during market hours, keeps a running estimate of session VWAP and session high/low/volume for every name in the universe, maintains completed-bar 5-minute MACD, RSI and SMA20 for the names the agent can act on, shows all of it to the **player** labeled as diagnostic data the agent did not see, and grades every day's estimate the next morning against real one-minute bars. The agent's prompt, the scoring price, and every automatic rule are untouched. Those are three later stages, each with its own switch and gate.

---

## 1. Givens

| # | Fact | Consequence |
|---|---|---|
| G1 | EODHD units: quotes 1/ticker; intraday bars 5/request; fundamentals 10; technicals 5; news 5. Baseline ≈ 9,010/weekday; ≈ 2,888 per active battle. | Universe poll uses quotes only. Seed and validate cost 5 per symbol-session. |
| G2 | The evaluator runs **26** evaluating ticks per session (`agent-evaluate.js:303-306`). | Validator aligns to 26; budget uses 26. |
| G3 | Intraday Historical returns prior sessions with a date window and nothing for the current session. | Today's bars cannot be fetched today. |
| G4 | 5-minute endpoint: bars sum to median 74 % of EOD volume (37–99 %); its 16:00 row is `volume: null`, flat. The founder's 1-minute fixture's 16:00 row carries 19.1 M real volume. | Validator uses 1-minute bars and measures reference coverage per session. Closing-row identity is the vendor's (§15). |
| G5 | `marketSchedule.js` is the calendar of record through 2027 with 13:00 ET early closes. | §5.1. No vendor calendar. |
| G6 | `calculateRSI`/`calculateMACD` are batch, latest-only, SMA-seeded, stateless. | New step functions with batch parity (§6.5). |
| G7 | Live v2 carries `lastTradeTime` (ms), snapshot `timestamp` (s), `size`, `volume`, `averageVolume`, session `high/low/open`; which timestamp `volume`, `high`, `low` are cumulative to is **unconfirmed**. **(V1.1)** Live v2's documented response is a `data` object keyed by symbol with the symbol inside each quote; unresolved symbols are silently omitted. | §4 normalization; §5.4 experimental state; H/L cutoffs unknown. |
| G8 | 31 readers of evaluation entries; four feed prompts (`formatRecentEvals` fenced key-explicit; narrator record block shadow-only; anticipation note; reflection prompt → `agent.memory[]`); two summarize; the client subscribes to the whole battle document; the reflection cron reads it wholesale; 150-entry cap. | §8.1 subcollection; §9.2 allowlists. |
| G9 | `fieldOverrides` empty; exemptions console-only; CLI index deploys blocked since 2026-05-24. | §7.2 JSON strings. |
| G10 | Vercel: 100 cron jobs/project; no automatic retry of failed invocations; ordinary duration limits apply. **(V1.1)** | Two crons; retries are self-scheduled (§10.1). |
| G11 | Quiet tick ≈ 24–34 reads, ≈ 36 writes per battle; ~34 writes are `marketDataCache/{SYM}_daily` rewrites from `forceRefresh`. | Stage 3. |
| G12 | Evaluator is equities-hours-only; crypto books close 20:00 ET; two nightly crons and the 17:15 ET bank price crypto after hours. | Stage 3. |
| G13 | Firestore rules on a parent document do not apply to its subcollections. **(V1.1)** | §8.1 rules. |

---

## 2. Scope

**Build 1 delivers:** §5 poller; §6 buckets and recursive state; §7 storage and publication; §8 evaluated records and eligibility; §9 diagnostics and exclusions; §10 validator; §11 legacy gate fix; five flags with two live; §12 tests; §16 hygiene filed.

**Deferred stages:** Stage 2 agent decision use (gate: paired-eval scorecard — correct use of eligible evidence, no use of ineligible, stale/missing/conflicting-timeframe/archetype cases, overclaim as one row, ≥ 200 prompts). Stage 3 price source (§8.5 adapter; G11/G12; ID-22 §7 approval). Stage 4 risk activation (§10.6 gate).

**Out:** the stream; strategy-level requirement sets; Jev; crypto VWAP.

---

## 3. Controls

| Flag | Type | Live in build 1 |
|---|---|---|
| `INTRADAY_COLLECT_ENABLED` | bool | yes — poller and validator run |
| `INTRADAY_DIAGNOSTIC_ENABLED` | bool | yes — views written; player surfaces read them; shadow lines logged |
| `INTRADAY_AGENT_USE_ENABLED` | bool | present, no consumer |
| `INTRADAY_PRICE_SOURCE` | `'legacy'\|'snapshot'` | present, no consumer |
| `INTRADAY_RISK_ACTIVATION_ENABLED` | bool | present, no consumer |

Booleans pin in `flagPinGuard.test.js`; the enum in `src/config/intradayPriceSourceFlags.test.js`. Ship all off / `'legacy'`. With all flags off every surface is byte-identical to today **except §11**.

---

## 4. Data sources and normalization

- **US stocks/ETFs:** Live v2 `GET /api/us-quote-delayed?s=…`, ≤ 20 tickers/request, 1 unit/ticker. **(V1.1)** Parse the `data` object keyed by symbol; a requested symbol absent from `data` is recorded `anomalies.missing++` with no update. Fields: `symbol, lastTradePrice, lastTradeTime, size, open, high, low, volume, averageVolume, previousClosePrice, change, changePercent, timestamp`. The builder verifies the shape against the vendor page in the read-only step.
- **Crypto:** Live v1 `GET /api/real-time/{first}?s=…` (array of `{ code, close, timestamp, volume, previousClose, change, change_p }`).
- **(V1.1) One internal shape.** Both adapters produce `Observation = { sym, price, priceAsOf (ms), snapshotTs (ms), availableAt (ms), volume|null, high|null, low|null, open|null, averageVolume|null, previousClose|null, change|null, changePercent|null, size|null, source }`. Tests cover both vendors and an omitted symbol.
- **Prior-session bars:** `GET /api/intraday/{sym}?interval=1m&from=&to=`, 5 units, date window from the calendar's previous regular session.
- **Universe list:** the 255 real-time symbols of `compute-index-intelligence` plus every crypto symbol held or benched in an active battle. **Actionable set:** held ∪ bench across active battles, recomputed each sweep.

---

## 5. The poller

### 5.1 Schedule and session
Cron `* 13-21 * * 1-5` UTC → `/api/cron/intraday-poll`. Imports `getSessionForDate(etDate)` from `marketSchedule.js`. **(V1.1) Invocation order:** (1) deadline processing (§6.2) for any actionable symbol whose session close + 30 min has passed with its last bucket still open — runs **before** the session guard, every invocation; (2) the session guard: quote collection only when `now ∈ [open, close + 30 min]`; (3) the sweep. Missing calendar entry → exit with `calendar_missing`; never guess. Session length is `close − open` from the calendar (390 min normal, 210 min early close).

### 5.2 Tiers and cadence
`api/_utils/intradayConfig.js`: `UNIVERSE_CADENCE_MIN = 5`, `HELD_TIER_ENABLED = true`, `LEASE_MS = 90_000`, `MAX_TICKERS_PER_REQUEST = 20`, `VOLUME_CUTOFF_FIELD = null`, `HL_CUTOFF_FIELD = null` **(V1.1)**, `CLOSING_ROW_POLICY = null`. Every invocation sweeps the actionable set; when `etMinute % UNIVERSE_CADENCE_MIN === 0` also the universe; a symbol in both is fetched once. Changing any of these is a founder PR that bumps `calcVersion`.

### 5.3 Sweep
1. Acquire lease (§7.4). 2. Build lists; dedupe. 3. Fetch outside any transaction, 10 s timeout per request, concurrency 4. **(V1.1) 4. Record units immediately** — 1 per ticker requested whether or not it returned — in a transaction on `intradayBudget/{etDate}` (read, add, write), **before** any calculation or publication, so a lost lease or aborted publish still records the charge. 5. Per symbol: classify the observation (§5.5), apply rollover (§5.6) first, then accumulators (§5.4), session H/L/V, and for actionable symbols buckets and state (§6). 6. Build documents. 7. Publish (§7.4).

### 5.4 The VWAP estimate and the vendor aggregates
Per symbol, on an **accepted** observation (§5.5):
```
Δvol = volume − lastAcceptedVolume
if Δvol > 0: num += price × Δvol; den += Δvol; samples++
first accepted observation of a session: num = ((high + low + price) / 3) × volume; den = volume; samples = 1   (if high/low null: num = price × volume)
vwapEstimate = den > 0 ? num / den : null
```
**Cutoffs (V1.1).** `estimateCutoff` and `volumeCutoffAsOf` are populated from `VOLUME_CUTOFF_FIELD` when set, else `null`. Session `high`/`low`/`open` are **vendor aggregates**, not values derived from sampled closes: their cutoff is populated from `HL_CUTOFF_FIELD` when set, else `null`. **The estimate is computed regardless.** While `VOLUME_CUTOFF_FIELD` is null the VWAP record carries `experimental: true`, `method: 'sampled_estimate'`, `state: 'display_only'` (§8.3) with reason `cutoff_unconfirmed`; it is excluded from qualification (§10.3) and from every consumer except player display. Price-based indicators (buckets, SMA20, MACD, RSI) carry `priceAsOf` cutoffs and their own eligibility. Known failure, in the definition text: all interval volume is assigned to the interval's last accepted price; error is unbounded at sharp intra-poll moves.

**`volumePace` (V1.1, formula restored):** `elapsedMin = (volumeCutoffAsOf − sessionOpenMs) / 60_000`; `sessionLenMin = (sessionCloseMs − sessionOpenMs) / 60_000`; `volumePace = volume / (averageVolume × elapsedMin / sessionLenMin)`, `method: 'linear_pace'`. Absent with reason: `cutoff_unconfirmed` (cutoff null), `insufficient_elapsed` (`elapsedMin < 5`), `no_reference_volume` (`averageVolume` missing or ≤ 0), `volume_invalid` (§5.5). Early closes use the calendar's shorter `sessionLenMin`.

### 5.5 Observation classification **(V1.1)**
Order: **numeric validation → rollover → classification.**
- **Reject** (no update; `anomalies.rejected++`, reason coded): `priceAsOf` missing/non-finite/`> availableAt + 60_000`/`< sessionOpenMs`; `price` missing, non-finite or ≤ 0.
- **Volume invalid** (`volume` missing, non-finite or < 0): price-based updates proceed; volume-based (accumulator, pace) skip with `anomalies.volumeInvalid++`. `high/low/open` invalid → `sessionHL` absent this sweep.
- **Rollover first** (§5.6): if the ET date of `priceAsOf` differs from the accumulator's session date, reset before any comparison — the overnight volume reset is not an anomaly.
- **Unchanged:** `priceAsOf === lastAcceptedAsOf && volume === lastAcceptedVolume` → no update, `unchangedCount++`, **not an anomaly** (a refreshed snapshot with no new trade is normal, including repeated closing quotes).
- **Volume-only advance:** `priceAsOf === lastAcceptedAsOf && volume > lastAcceptedVolume` → accumulator applies `Δvol` at `price`; `volumeOnlyAdvance++`; not an anomaly.
- **Regressed:** `priceAsOf < lastAcceptedAsOf` or `volume < lastAcceptedVolume` → **hold** (`anomalies.held++`), nothing applied. **Resume** on the next observation with `priceAsOf > lastAcceptedAsOf && volume ≥ lastAcceptedVolume`, assigning `volume − lastAcceptedVolume` at `price` (`anomalies.gapAssigned++`). Two **distinct** held observations in a session (distinct `priceAsOf` or `snapshotTs`) set the accumulator `degraded` for the session.
- **Accepted:** `priceAsOf > lastAcceptedAsOf && volume ≥ lastAcceptedVolume` → apply §5.4; update `lastAcceptedAsOf/Volume`.
- **Keys:** `observationId = hash(sym, priceAsOf, snapshotTs)` records vendor revisions. **`strikeKey = hash(sym, priceAsOf)`** is the strike-evidence identity; stage 4's consecutive-strike counter advances only on a new `strikeKey`. Both are on every record.

### 5.6 Session rollover
Per symbol on the ET date of its own `priceAsOf` changing: accumulators reset, `degraded` clears, the ring's session pointer advances. Never per sweep.

### 5.7 Crypto
Price facts only. `vwap: { value: null, method: 'n/a', state: 'ineligible', reason: 'no_session_anchor' }`. No buckets.

---

## 6. Buckets and recursive state (actionable set)

### 6.1 Keys and closes
`k = floor(priceAsOf / 300_000)`. Bucket `close` = `price` of the greatest `priceAsOf` in the bucket; `sampleCount`, `closeLagMs = bucketEndMs − maxPriceAsOf` stored. Only `priceAsOf ∈ [sessionOpenMs, sessionCloseMs]` is bucketed; `priceAsOf === sessionCloseMs` belongs to the last regular-session bucket.

### 6.2 Completion — two outcomes
- **Normal:** bucket `k` completes on an observation with key `> k`, or for the last bucket on an observation with `priceAsOf ≥ sessionCloseMs`. **Close order:** an exact-close observation is applied to the last bucket first, then the bucket is finalized and indicators advance once; an observation with `priceAsOf > sessionCloseMs` establishes passage but its price is never written to the last bucket.
- **Deadline (V1.1):** at `close + 30 min`, a last bucket not normally completed is marked `status: 'incomplete', reason: 'deadline'`; state does not advance across it. Deadline processing runs at the start of **every** poller invocation before the session guard (§5.1) and again, idempotently, at the start of the validator for the session it grades — so a late or missing invocation cannot skip it. **Test:** the deadline invocation is skipped; the next invocation (and separately the validator) finalizes as `incomplete`.

### 6.3 Immutability and adjacency
Completed buckets are immutable; an observation for a completed key is rejected and logged (`lateUpdateRejected`). Adjacency is session-relative per the calendar; closure gaps are not gaps.

### 6.4 Gaps and per-indicator warmup
Missing bucket → state does not advance. Per-indicator `warmupBars` — RSI-14: 15; SMA20: 20; MACD: 35 — measured on the longest contiguous completed segment ending at the current bucket; each reinitializes independently via §6.5 `init` once its length is reached; `status: 'absent', reason: 'warmup'` until then. The VWAP accumulator is unaffected.

### 6.5 Step functions with batch parity
`stepEma`, `stepMacd`, `stepWilderRsi`, `stepSma`, each with `init(closes)` copying the batch seed phases (`technicalCalculations.js:76-78`, `:169-173`, `:214-219`). Parity at N ∈ {35, 61, 120} to 1e-9. `macd5m = { line, signal, hist, event, eventBarKey }`; `event` set iff `sign(line − signal)` changed between the last two completed buckets; `eventBarKey` is that bucket's key.

### 6.6 Seeding **(V1.1)**
At the first sweep of a session and on mid-session join: fetch the calendar's previous regular session as 1-minute bars, aggregate to 5-minute buckets, seed **up to 60 available contiguous buckets** (an early-close session yields 42); readiness is each indicator's `warmupBars` against the actual count; if fewer than 35 are available, fetch one further prior session (5 more units), at most two sessions. Seeded buckets carry `seeded: true`. Vendor unpublished → retry every 15 min for 2 h, then `seedStatus: 'unavailable'`. **Late seed:** rebuild chronologically (seed, then today's buckets in order), recompute state through the whole sequence, then trim to 60; today's observations never erased or reordered; parity test over > 60 bars. Mid-session join: earlier buckets missing; §6.4. Corporate action across the seed boundary → `seedStatus: 'corporate_action'`.

### 6.7 Close qualification propagates **(V1.1)**
A session whose closing bar is unresolved (§15 unanswered, or `referenceCoveragePct` failing §10.2) marks its last bucket `closeQualified: false`. **Clearing:** SMA20 clears when that bucket leaves its 20-bucket window. **MACD and RSI clear only on reinitialization from a contiguous segment of `warmupBars` completed buckets all `closeQualified: true`**, or on a rebuild after `CLOSING_ROW_POLICY` is set — elapsed bars never clear them, because recursive state retains the influence. `closeQualified` is a fact on every recursive-indicator record; §8.3 requires it for stage-4 consumers and reports it for display; §10.5 excludes unqualified series from qualification metrics.

---

## 7. Storage and publication

### 7.1 Three shapes
- `intradaySnapshots/latest`: `sweepId, generation, sweepAt, lastSuccessfulSweepAt, lease, calcVersion, anomalies, symbols: { [sym]: facts }` where facts are the §8.2 blocks **without** verdicts (**(V1.1)** including the `price` block and each indicator's `status`).
- `intradayCalcState/{etDate}`: universe accumulators `{ [sym]: { num, den, samples, lastAcceptedVolume, lastAcceptedAsOf, sessionEtDate, degraded, heldObservationIds[] } }`, `generation`.
- `intradayCalcState/{etDate}/actionable/{sym}`: `ringJson`, `stateJson`, `logJson`, `generation`, `seedStatus`. **(V1.1)** Log entries: `{ sweepAt, priceAsOf, snapshotTs, price, estimate, experimental, estimateCutoff, volumeCutoffAsOf, calcVersion, strikeKey, generation }`.
- **(V1.1)** `intradayBudget/{etDate}`: `{ unitsRequested, unitsBySource, sweeps }`, written per §5.3 step 4.

### 7.2 Why strings
Per G9. `fieldOverrides` may replace this when CLI deploys are restored; not build 1.

### 7.3 Sizing
Measured: snapshot at 255; one actionable document at 420 sweeps; publish transaction at 30 and at 255 actionable symbols; against 1 MiB and 10 MiB. Generation-pointer design only if the transaction ceiling is below 30.

### 7.4 Lease and atomic publication
**Acquire:** transaction on `intradaySnapshots/latest`; `now` per attempt; abort `lease_busy` if `expiresAt > now && owner !== me`; else write `{ owner: uuid, expiresAt: now + LEASE_MS }`. Fetch and compute outside transactions. **Publish:** one transaction, `now` recomputed per attempt; require `owner === me && expiresAt > now` else abort with nothing written (`lease_lost` / `lease_expired`); write snapshot, universe state and every actionable document with one `generation`; release inside the same transaction. Cleanup outside is conditioned on `owner === me`. **(V1.1)** Units are already recorded before this step (§5.3).

---

## 8. Evaluated records and eligibility

### 8.1 Where they live, and the failure contract **(V1.1)**
At `INTRADAY_DIAGNOSTIC_ENABLED`, agent-evaluate reads `intradaySnapshots/latest` once per invocation. Per battle per tick it computes the view (§8.3) for held ∪ bench and writes `agentBattles/{battleId}/intradayViews/{evalId}` with **set-merge** (idempotent on retry; `evalId` is the stable id the entry already carries). The evaluation entry carries only `intradaySnapshotId, intradayGeneration, intradayViewRef, intradayViewStatus, intradayEvaluatedAt, intradayPolicyVersion, decisionStartedAt, decisionCompletedAt`.
**Isolation:** the snapshot read and the view write are each wrapped, bounded to 2 s, and non-fatal. Missing snapshot → `intradayViewStatus: 'no_snapshot'`; malformed → `'snapshot_invalid'`; write failure → `'write_failed'` with `intradayViewRef: null`; in every case the trading evaluation and its authoritative battle write proceed unchanged. **Test:** each failure mode leaves the evaluation entry, decision and status feed byte-identical to a run with diagnostics off, apart from the status field.
**Access:** Firestore rules add `match /agentBattles/{battleId}/intradayViews/{evalId}`: read allowed to exactly the principals the parent battle's read rule allows (mirrored explicitly, per G13); client writes denied; server writes via Admin. Rules test added. The client performs one `get` when the Why? panel opens and never subscribes to the subcollection; it renders diagnostics only when `intradayViewRef === evalId` **and** the fetched document's `evalId` matches.

### 8.2 Schema **(V1.1)**
```
intradayViews/{evalId} = {
  evalId, battleId, sweepId, generation, calcVersion, policyVersion, evaluatedAt,
  presetId, presetBand,                             // from battle.strategyPreset → agentPresetConfig dead band, copied at evaluation
  providedToDecision: false,                        // build 1 constant
  symbols: {
    [sym]: {
      observationId, strikeKey, source, availableAt, collectionStalled,
      price: { value, priceAsOf, snapshotTs, previousClose, change, changePercent, size },
      indicators: {
        vwap:       { status, value, method, experimental, estimateCutoff, volumeCutoffAsOf, quality: { samples, degraded }, verdict },
        sessionHL:  { status, value: { high, low, open }, cutoff, verdict },
        volume:     { status, value, cutoff, verdict },
        volumePace: { status, value, method, elapsedAtCutoffMin, verdict },
        sma20_5m:   { status, value, cutoff: bucketEnd, quality: { completedBars, gaps, closeLagMs, warmupMet, closeQualified }, verdict },
        macd5m:     { status, value: { line, signal, hist, event, eventBarKey }, cutoff, quality, verdict },
        rsi5m:      { status, value, cutoff, quality, verdict }
      }
    }
  }
}
verdict = { state: 'eligible' | 'ineligible' | 'display_only', reason, consumer }
```
Definitions that do not vary — `name, params, timeframe, units, session, adjust, venue` — live in `intradayDefinitions/v{calcVersion}`, immutable; `venue: 'vendor_unconfirmed'` until §15. **Receipt-only replay test (V1.1):** with `intradaySnapshots/latest` deleted, every strike computation and every displayed line is reconstructed from a stored view plus its definitions document alone.

### 8.3 Eligibility **(V1.1)**
`evaluateIntraday(symbolFacts, { nowMs, policyVersion, consumer })` → verdicts, per indicator independently. Policy v1:
- `eligible` requires: `cutoff !== null`; age from the indicator's own cutoff ≤ consumer `maxAgeMs` (display 45 min; stage 4 25 min); `status === 'completed'` where the consumer requires it; `samples ≥ 3` for the accumulator; `warmupMet` for recursive indicators; not `degraded`; not `collectionStalled`; `experimental === false`; and for stage-4 consumers `closeQualified === true`.
- **`display_only`:** `experimental === true` (or cutoff null on a vendor aggregate) with a finite value, for the display consumer only. Rendered with the phrase "cutoff unconfirmed" and the **quote's** `priceAsOf` shown separately as "quote as of". Every non-display consumer treats it as `ineligible`.
- `ineligible` otherwise, with reason.
Stage-4 rule: `evaluateIntraday` runs immediately before every action. Build-1 test: the verdict flips as `nowMs` crosses an age limit while the persisted view is unchanged.

### 8.4 Vintages and evidence
`vintages.intradaySnapshotId`, `vintages.intradayGeneration`; `vintages.vwap ∈ {'diagnostic','tick','absent'}`. `evidence[sym]` not extended.

### 8.5 Price adapter (built now)
`toLegacyPriceShape(price facts) → { current, previousClose, change, changePercent, high, low, volume, timestamp, priceAsOf, source, fallback: false }`; tests enumerate every consumer field, timestamp units, nullable `previousClose`, crypto path.

---

## 9. Diagnostics and exclusions

### 9.1 Player surfaces **(V1.1)**
Why? panel fetches the view on open and renders from a fixed copy table keyed by `verdict.state` and `reason`; every block headed **`Diagnostic · recorded at the check · not seen by the agent`**. Examples: `VWAP est. 493.12 · cutoff unconfirmed · quote as of 1:52 PM · experimental`; `5m MACD hist +0.31 · completed bars · as of 2:00 PM`; `VWAP unavailable · warming up`. Tape and narrator use the same table; the narrator may not connect a diagnostic value to the decision. Shadow lines (the stage-2 prompt lines, rendered by a non-fenced renderer registered in `PROMPT_CONTRIBUTING_MODULES` at stage 2) are stored on the view as `shadowLines`, never sent.

### 9.2 Exclusions **(V1.1)**
The four prompt-feeding readers and two summary paths do not read `intradayViews` or `shadowLines` — wholesale readers by construction (subcollection), key-explicit readers by an **explicit field allowlist** the build adds to each non-fenced reader (the fenced `formatRecentEvals` is asserted key-explicit by test). Pointer fields on the entry are not prompt inputs under any allowlist. **Tests:** (a) reflection input from a fixture battle with a populated subcollection contains no diagnostic key; (b) `formatRecentEvals` byte-identical with and without pointer fields; (c) anticipation note and narrator record block likewise; (d) **sent prompts compared with diagnostics on and off differ only in existing nondeterministic fields** — no new diagnostic values or shadow lines appear (the prompt already contains intraday *guidance*; that is not the assertion).

### 9.3 The lint
`buildPresentSignals` behaviour unchanged. The five 5-minute names become conditional on the view **and** `INTRADAY_AGENT_USE_ENABLED` (false → never present). Vocabulary rows for `macd5m`, `rsi5m`, `sma20_5m` added.

---

## 10. The validator

### 10.1 Schedule and state **(V1.1)**
Cron `*/30 10-16 * * 2-6` UTC → `/api/cron/intraday-validate`. State in `intradayValidationState/{etDate}`: `{ status: 'pending'|'in_progress'|'done'|'window_closed', pendingSymbols[], doneSymbols[], attempts, firstPublishHourUtc, windowClosesAt }`. Each invocation: apply deadline reconciliation (§6.2) for the session; if bars are unpublished, record the attempt and exit; otherwise validate up to 20 symbols within a 60 s budget, persist progress, exit. `done` when `pendingSymbols` is empty; `window_closed` at 16:00 UTC with the unvalidated symbols listed and reason `unpublished`. Bounded work every invocation; nothing relies on platform retries.

### 10.2 Reference series and coverage
`refVWAP(t) = Σ(HLC3 × volume) / Σ volume` over 1-minute bars with `start + 60_000 ≤ t` — **bar-derived reference VWAP**. Per symbol-session: `referenceCoveragePct = Σ(bar volume) / EOD volume`, `barsMissing`. Coverage < 90 % or any missing bar before a comparison point → `coverage: 'partial'`, excluded from qualification with reason. Closing-row identity is not inferred; until §15, close-dependent comparisons carry `closeQualified: false` and §6.7 propagates. **(V1.1)** `closeQualified` is checked, not merely recorded: unqualified series are excluded from every qualification metric.

### 10.3 Alignment
Per log entry: `estimateCutoff` (from the entry; null → excluded with `cutoff_unconfirmed`), `referenceCutoff` = end of the last completed bar ≤ `estimateCutoff`, `alignmentLagMs` recorded (longer when a preceding bar is missing; reported via `barsMissing`). The reported quantity is `comparisonResidual`. Price-source residual `price − refClose(referenceCutoff)` separate.

### 10.4 Evaluation-linked metrics
For each evaluation with a stored view: from the view's `price.value` and `presetBand`, compute `estDev` and `refDev` on the same price; `isVwapStrike` on both; agreement / false strike / missed strike / near-threshold (`|refDev − (−presetBand)| ≤ 0.25`); replay the consecutive-strike counter on both series keyed by `strikeKey`; bucket closes vs reference 5-minute closes; SMA20 residual; MACD event agreement by `eventBarKey`.

### 10.5 Reported
`intradayValidation/{etDate}`: residual distribution by `alignmentLagMs` bin; **P95 |comparisonResidual| / price**; overall disagreement; false-strike rate; missed-strike rate; near-threshold disagreement; replayed exit disagreement; SMA20 P95 |residual|/price; MACD event agreement; `referenceCoveragePct`; lost coverage by reason; event counts; `firstPublishHourUtc`; `unavailable` reasons (**never zero**). Trailing-10 and test-period rollups.

### 10.6 Qualification calendar and stage-4 gate
Collection-only sessions: series metrics only; evaluation-linked `unavailable: 'no_evaluation_evidence'`. Characterization: 10 sessions from the first with stored views. Freeze: alignment policy, `policyVersion`, `calcVersion`, seven thresholds, minimum event counts (proposed 30 each). Test: next 10 sessions fixed. Flip PR quotes the test period only; any denominator below minimum → `insufficient_evidence`. Any change to source, cadence, seeding, `calcVersion` or policy resets the calendar.

### 10.7 Versioning
`calcVersion` covers §5.4–5.6, §6, §10.2–10.3; `policyVersion` covers §8.3. Both on every view, log entry and validation document.

---

## 11. The legacy gate fix — the one flags-off behaviour change
`isVwapSessionUsable({ sessionDate, todayET, coverageCount, asOfMs, nowMs, maxAgeMs })` with the freshness clause mandatory; the legacy candle path passes its newest session candle's timestamp and `VWAP_LEGACY_MAX_AGE_MS = 45 min`. A stalled candle feed is refused. Tested independently; stated in the PR body.

---

## 12. Tests
Named inline throughout; plus **(V1.1)**: receipt-only replay (§8.2); unchanged observation → no update, no anomaly; volume-only advance; regressed vs unchanged distinction; rollover before comparison (overnight reset is not an anomaly); numeric validation with volume-invalid leaving price indicators intact; `strikeKey` unchanged across a refreshed `snapshotTs`; missed-deadline invocation finalized by the next invocation and by the validator; §8.1 four failure modes; subcollection rules (owner read, non-owner denied, client write denied); Live v2 `data`-keyed parse and omitted symbol; early-close seed of 42 buckets with per-indicator readiness; second-session fetch when < 35; log-entry provenance fields; units recorded when publish fails; sent-prompt on/off diff; `closeQualified` cleared for SMA20 by window exit and for MACD/RSI only by qualified reinitialization; §10.2 exclusion of unqualified series. All V1 tests retained.

## 13. Smoke **(V1.1 arithmetic)**
Normal session: poller active 420 min → 84 universe sweeps, 420 actionable sweeps; each symbol fetched once per sweep. `units/day ≈ 84 × |universe ∖ actionable| + 420 × |actionable| + 5 × |actionable| (seed) + 5 × |actionable| (validate)`. At 255 universe / 30 actionable: ≈ 18,900 + 12,600 + 150 + 150 ≈ **31,800**. Early close: 240 min → 48 / 240. `intradayBudget/{etDate}.unitsRequested` must match within the day's `anomalies.missing`.
**Collect, day 1:** snapshot dated today; `priceAsOf` 10–30 min behind `availableAt`; `closeLagMs` on completed buckets; `unchangedCount` non-zero after the close, `anomalies.held` near zero; budget as above; per-symbol documents with growing `logJson`; one `generation` per sweep across all documents; no battle document touched. **Day 2:** `intradayValidation/{day1}` with series metrics, `referenceCoveragePct`, `firstPublishHourUtc`, evaluation-linked `unavailable`. **Diagnostic, live battle:** Why? panel block with its header; `intradayViews/{evalId}` with per-indicator verdicts and `presetBand`; `shadowLines` present; sent prompt unchanged vs diagnostics-off except nondeterministic fields; next morning's validation has evaluation-linked metrics.

## 14. Fence contact
None.

## 15. Vendor-pending configuration
**(1)** Live v2 `volume` cutoff → `VOLUME_CUTOFF_FIELD`; `high/low` cutoff → `HL_CUTOFF_FIELD` (may differ); venue → `intradayDefinitions.venue`; each clears its `experimental`/null-cutoff state and bumps `calcVersion`. **(2)** Closing-row assignment → `CLOSING_ROW_POLICY`; clears `closeQualified: false` going forward via §6.7 rebuild; bumps `calcVersion`.

## 16. Hygiene filed, not built
Six early-close-blind `marketSchedule.js` copies; eight request-counting comments; `featureFlags.js:2339`; `compute-rankings.js:1498`; BUILD_RULES §6 ceiling; the `:00` rankings-rewrite race; the 68-request unbounded `Promise.all`.
