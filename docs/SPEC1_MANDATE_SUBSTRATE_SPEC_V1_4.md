# Spec 1 — Mandate Substrate — Build Spec V1.4 (LOCK CANDIDATE)

> **Terminology (O-1 resolved).** The feature is **The Mandate**. A manager is *granted a mandate* (the three-month term, the entity: `mandates/{mandateId}`) and *runs a book* under it (the portfolio: the `portfolio` field). Both terms are load-bearing and non-interchangeable: the mandate is the relationship and its term; the book is the money.

**Date:** August 7, 2026
**Supersedes:** V1.3 (same date). Changelogs: §0.4 (V1.1→V1.2, adversarial), §0.5 (V1.2→V1.3, micro-verification), §0.6 (V1.3→V1.4, invariant review + founder rulings).
**Status:** LOCK CANDIDATE — all three review rounds complete (ChatGPT defect pass §12, micro-verification §13, Fable invariant review §14). On founder sign-off: commit to `docs/`, then CC Phase 1.
**Verification basis:** `docs/audits/MICRO_VERIFICATION_CONTRACTS_V1.md` (HEAD `01e1150`).
**Invariant basis:** Fable review of V1.3 (I1–I17). Disposition §14.
**Charter:** `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_1.md` (binding; D-numbers refer to it)
**Discovery basis:** `docs/audits/SPEC1_PORTFOLIO_SUBSTRATE_DISCOVERY_V1.md` (R-numbers refer to its reuse map)
**Adversarial basis:** ChatGPT review of V1.1, findings F1–F38. Disposition table §12.
**Working name:** `mandates` — final name gated on O-1, decided **before Phase 1 merge**.
**Timeline:** 3–4 weeks, six phases.

---

## 0. Resolved Decisions

### 0.1 From founder review of discovery

| # | Ruling |
|---|--------|
| O-9 | **Fork, don't repurpose.** New collection; harvest the `seasonEntries.portfolio` shape; repoint season settlement/risk math onto the new shape. Season modules untouched. *Separate tasking, pre-launch:* retire the live season create path. |
| O-10 | **Dedicated cron slots.** Founder allocates 2 of 3 free slots (37→39). D-31 proactive triggers are Spec 3. Dispatcher consolidation downgraded to optional post-launch cleanup. §6 tournament reserve knowingly spent. |
| O-11 | **New awaited stream.** `captureReceipt`'s outcome-blind contract untouched; dual-label scoring lands on a new `mandate_scoring` stream. |
| O-12 | **Adopt the registry** as the class-definition read surface; new importer recorded in `archetypeImportBoundaryBaseline.json` same commit. |
| O-13 | **New durable per-book vintage** — see §5.1, now a content-addressed pinned vintage doc, not a metadata label. |
| O-14 | Working name `mandates`; final gated on O-1. |

### 0.2 Proposed defaults — RATIFY AT DESIGN LOCK

| # | Proposal |
|---|----------|
| O-3 | **RATIFIED: $10,000,000 virtual USD** starting capital; USD display, 2dp. Config constant `MANDATE_STARTING_CAPITAL`. Founder ruling: the scale is deliberately near-fictional for entertainment and attachment value ("my manager made $340K this quarter" is a story users retell). Mechanically scale-invariant — all metrics are ratios, and share rounding improves. **Required honesty caveat (see §4.1):** at this capital scale the fixed-bps friction model no longer approximates real execution cost, so frictions are labeled **idealized** rather than realistic. |
| O-4 | **Equities-only V1.** Ticker-keyed positions; no crypto. |
| O-5 | **REVISED per Q1: the book builds its own sector cap.** `checkSectorCap` is private, tiered-battle-coupled, and **fails open** on a flat position map — unusable and unsafe for a money path. `mandateSectorCap.js` (new, non-fenced) enforces the cap on the flat `{ticker:{...}}` map, reading the per-archetype `sectorConcentrationCap` **values** from the pinned vintage payload (the values are data; only the dead function is abandoned). **All book gates fail closed:** malformed input blocks and quarantines, never passes. Position bounds: target 5–15, cash floor 2% — construction targets and entry gates only, never exit blockers (§3.4). |

### 0.3 Founder rulings on adversarial findings

| # | Ruling | Resolves |
|---|--------|----------|
| **FR-1** | **Capital carries forward at rollover — same archetype or different.** The book belongs to the user; managers are hired and fired. Switching archetypes at rollover never costs the user capital, because charging for rotation would penalize the exact behavior the platform's rotation thesis exists to encourage. | F28 |
| **FR-2** | **Scoring is tenure-scoped, not lifetime-blended.** Each `quarterSummary` records what that archetype did during its own mandate — return, risk metrics, regime mix, vintage served. The user's history reads as a manager ledger. Lifetime figures exist but are never the comparable unit. | F15, F28 |
| **FR-3** | **The escape hatch voids the quarter.** It is not a manager change; it is a correction of a bad assignment. The old book closes flagged `voided:true`, its quarter summary is marked non-scoring, and the replacement book starts fresh at `MANDATE_STARTING_CAPITAL`. Available once ever, within 14 days of the *first* book's creation. | F28, F6 |
| **FR-4** | **Corporate actions V1 scope:** splits, cash dividends, stock distributions, ticker changes, delistings (forced close at last good mark). Mergers treated as delist-with-cash. Full merger/spinoff modeling is post-launch. | F13 |
| **FR-5** | **Comparability rule (forward-looking, D-38):** when social surfaces eventually exist, the comparable unit is tenure performance, never absolute balance. Tenure-scoped scoring from day one makes this free later. | — |
| **FR-6** | **Vintage boundary ratified (resolves I5):** the vintage freeze absorbs **model identity** (the seat entry from `mandateGenerationConfig`) and **gate configuration** (cash floor, position bounds, max weight, decision-tool verb set) alongside archetype content. A mid-quarter model swap cannot reach an active book; model and gate changes propagate per-user at rollover — the same staged rollout D-9 already gives archetype content. Consciously accepted cost: a bake-off winner reaches full adoption over ~3 months. A documented **break-glass override** (`MANDATE_VINTAGE_BREAK_GLASS`) exists for provider outages or model-safety emergencies; using it is a logged platform event stamped on every affected receipt. Prompt-template logic remains platform-global under declared change control, version-stamped per receipt. | I5 |
| **FR-7** | **Relationship memory hooks (foreclosure prevention only; the system itself is Spec 3):** the archetype never diverges; the *relationship* does — identical class + identical inputs ⇒ identical behavior, and divergence happens only through inputs (memory is an input, like market data, never an identity mutation). Spec 1 lands three hooks: (a) `managerAgentId` is **stable per user × archetype** — re-hiring an archetype resumes the same manager and its history; (b) every decision receipt carries `influenceStateRef`, **provably null in V1**, the future binding point for advisory/memory state (I8); (c) keying reservation — partner profile at `users/{uid}` (shared across archetypes), working relationship history keyed per user × archetype. Flagged as a charter amendment at next charter touch: relationship memory as the compounding asset. | I8 |

### 0.4 Changelog V1.1 → V1.2

| Area | Change | Findings |
|---|---|---|
| Execution contract | New §3.3 — submission envelope binding every model request to an immutable base state; deterministic request/decision IDs; claim-and-execute exactly-once; session-boundary invalidation. | F1, F2, F3 |
| Atomicity | New §3.5 — single transaction boundary for all portfolio mutation + receipt + idempotency record. Rollover and escape given equivalent boundaries. | F5, F6, F7 |
| Daily close | New §3.6 — an authoritative post-close mark pass for **every** active book, independent of model cadence. | F4 |
| Vintage | §5.1 — content-addressed `archetypeVintages/{codeId}_{hash}` docs; books pin by reference; prompts assemble **from the pinned doc**. Vintage pinning now binds behavior, not just metadata. Also supplies DEF-3's atomic release unit. | F8, F22, F36 |
| Universe bounds | §3.0 — hard universe cap, snapshot size budget, per-symbol completeness, held-symbol freshness requirement, carry-over marks. Scaling claim restated with bounds. | F11, F12, F16 |
| Money precision | §4.1 — cost basis method and units, partial-sale formula, execution-price formula, single point of friction entry (double-subtraction eliminated), rounding, negative-cash impossibility. | F14 |
| Corporate actions | New §4.3. | F13 |
| Metrics | §4.2 — warmup minimums, null semantics, zero-variance and zero-drawdown handling; lifetime vs tenure drawdown separated. | F15, F18 |
| Position bounds | §3.4 — minimum-count is a construction target and entry gate, never an exit blocker; bootstrap ramp defined. | F9 |
| Calendar | §3.1 — single market-calendar source of record governs eligibility, holidays, half-days, DST. | F17 |
| Bounded sweep | §3.1 — checkpoint cursor, bounded work unit, fair-progress ordering, completion proof. | F24 |
| Health | §6.4 — persisted failure state, consecutive-failure and missed-mark alerting, poisoned-book quarantine. | F25 |
| Transport | §3.3 — drain protocol before transport-mode change. | F26 |
| Provenance | §2 — price/regime `asOf` + source on every stored mark and row. | F19, F20 |
| Rollover semantics | §5.3 — logical vs processing time, catch-up for multiple missed boundaries, explicit mutation list including `quarterStartAt`, cadence recompute rule. | F21, F23 |
| Auth | §7 — explicit auth contract for every mutating endpoint. | F29 |
| Cost claims | §6.3 — tier-mix assumption stated; acceptance measures observed upstream calls, not symbol count. | F30 |
| Acceptance | §9 — all six archetypes; injected failure cases; production-transport coverage. | F31 |
| Housekeeping | §8 citation fixed to BUILD_RULES §7; schema versions added (§2); retention rules (§3.7). | F32, F33, F34 |
| Prerequisites | New §11 — micro-verification task for the five repo facts the review could not check. | F35–F38 |

### 0.5 Changelog V1.2 → V1.3 (micro-verification results folded in)

| Area | Change | Source |
|---|---|---|
| Sector cap | O-5 revised: own implementation, fail-closed; cap *values* still sourced from vintage payload. | Q1 |
| Fail-closed doctrine | New standing rule: every deterministic gate on the book path fails **closed** (block + quarantine on malformed input). Q1's fail-open guard is the cautionary example. | Q1 |
| Vintage coverage | §5.1: vintage payload includes **all** archetype version constants (incl. `calibrationBundleVersion`, which the live hash asymmetrically drops); platform prompt-template version is **stamped on every decision receipt** rather than pinned — archetype content is book-pinned, platform machinery evolves globally with provenance. | Q2 |
| Locking | §3.1: build own lease (owner token + fenced release), confirmed necessary — the existing lease is timestamp-only with a real stale-writer race and a 120s timeout under a 300s handler. Correctness does **not** rest on the lease: every book mutation is a `revision`-preconditioned transaction, so a stale writer's commit fails on mismatch. The lease is throttling; the transactions are the correctness boundary. | Q3 |
| Execution fork | §4.1: sell/trim quantities **clamped to held shares** (season's unclamped TRIM over-sell bug is not inherited); season `computeTradeStats` is NOT ported (its proceeds-based "dollar P&L" distorts profit factor — book realized P&L is basis-correct). Season's null-on-degenerate metric guards confirmed and adopted. | Q4 |
| Snapshot architecture | §3.0 restructured into a **two-layer snapshot**: fast layer (batched multi-symbol quotes via the true batch endpoint, per tick) + slow layer (fundamentals/sector/cap/corporate-actions, once daily pre-open). Cold per-symbol enrichment never runs per tick. Scaling claim recomputed with verified call counts. Daily upstream-call counter added. | Q5 |
| Friction spread | §4.1: bid/ask do not exist in any payload — the half-spread term becomes an explicit **modeled proxy** (`spreadProxyBps` by market-cap tier), labeled as such on every receipt. | Q5 |
| Corporate actions | §4.3: no corporate-action feed exists in the repo — P3 adds a fetcher (EODHD splits/dividends endpoints) in the slow layer, plus the raw-vs-adjusted divergence heuristic as a backstop **detector** that quarantines on unexplained overnight gaps. | Q5 |
| Active-book claim | §5.2: transactional same-doc claim confirmed as the correct pattern; `reserveSymbol` (`tournamentAgentLedger.js:370`) cited as the reference implementation. Count-cap query patterns are explicitly rejected for uniqueness. | Q6 |
| §11 | Converted from open prerequisite to **resolved** — answers recorded, all forced amendments applied in this version. | Q1–Q6 |

### 0.6 Changelog V1.3 → V1.4 (Fable invariant review + founder rulings)

| Area | Change | Findings |
|---|---|---|
| Batch lifecycle | Every submission reaches exactly one terminal state (`executed`/`rejected_stale`/`gated`/`failed`/`cancelled`/`expired`); every terminal transition clears `openBatchId` under revision discipline; rollover, escape, and quarantine **dispose** of open batches inside their transactions. Escape is never blockable by a stuck batch. | I1 |
| C-21 restored | Fail-closed doctrine rewritten: it governs entries and acting-on-bad-data, **never** exits on fresh data, and no exit-suppressing state may be indefinite. Freshness is per-symbol; quarantine becomes **exit-only mode** (eval continues, tool restricted to SELL/TRIM/HOLD). | I2 |
| Price basis | Fills price at the **harvest tick's mark**; both `submitTickKey` and `harvestTickKey` on every receipt; price-drift guard rejects as stale beyond `MANDATE_PRICE_DRIFT_MAX_BPS`. | I3 |
| Tenure attribution | Rollover boundaries **normalize to session closes owned by the close pass**; row `quarterIndex` tags are the single source of truth; summary windows derive from tagged rows, consistent by construction under lag and catch-up. Boundary valuations are authoritative closes. | I4 |
| Vintage boundary | Model identity + gate config absorbed into the vintage (FR-6); boundary enumerated in §5.1; break-glass documented. | I5 |
| Valuation discipline | **Only the close pass sets high-water marks.** The execution transaction re-marks *all* positions from the single harvest tick (gate consistency) but never writes peaks. Partial/carry-over rows are excluded from variance-based metrics and flagged in scoring. | I6 |
| Gap detector | Cross-checks the CA feed first; ratio-shaped gaps → **symbol-level** suspected-CA quarantine (carry-over), not book freeze; news-shaped gaps pass. Founder-manual-clear is never the response to routine volatility. | I7 |
| Influence gate | Prompt-assembly inputs are a **test-enforced closed allowlist**; receipts carry `influenceStateRef` (null V1, provable). | I8 |
| Liveness | `executedVsSubmitted` ratio is a first-class per-book health metric with alert; stale-rejection streaks alert; acceptance **measures batch turnaround against session windows**. | I9 |
| Agency record | Every daily row records `agencyState` (`full`/`exit_only`/`frozen`/`skipped:<reason>`); tenure summaries aggregate it. "I was frozen" is durably answerable (D-17). | I10 |
| Universe floor | `MANDATE_MIN_CANDIDATE_CAPACITY` with degradation alert. | I11 |
| Fork ledger | §8 fork ledger; season math confirmed non-fenced (fork ≠ circumvention); battle-vs-book sector-cap divergence documented as **accepted, revisit at Spec 4**. | I12 |
| Retention | Snapshot retention 30→**120 days**, covering the scoring window narration will run against. | I13 |
| Stream durability | Un-appended `mandate_scoring` close leaves a durable pending marker consumed by the next close's retry. | I14 |
| FR-1 teeth | Rollover transaction **asserts** `totalValue` unchanged across the commit. | I15 |
| Bandwidth | One-action-per-eval named a deliberate V1 decision; its effect on stress drawdowns acknowledged in the scoring model and tenure record. | I16 |
| Creation rows | Books created intra-session (escape replacements) owe a `dailyRow` from their first *full* session; creation day writes a `partial:true` row at close. Acceptance #3 amended accordingly. | I17 |

---

## 1. Scope

**In:** durable per-user book; scheduled trading loop with a safe execution contract; authoritative daily close; honest scoring with frictions and corporate actions; lifecycle (lock, escape hatch, rolling rollover, behavior-binding vintage); instrumentation (regime rows, cost telemetry, dual-label stream, health state, dormancy plumbing); founder-only creation for dark testing.

**Out:** onboarding (Spec 2); all conversation/SignalDrop/debate/proactive/narration (Spec 3); arena (Spec 4); rollover *experience* UI (DEF-1); attribution displays (DEF-2); vintage *release process* UI/workflow (DEF-3 — though §5.1 supplies its storage primitive); season create-path retirement, POST auth bypass, Juneteenth divergence (separate tasking).

**Headless by design.** Acceptance is founder-observed via Firestore + logs (§9).

---

## 2. Data Model

All durable record families carry `schemaVersion` (F33), integer, starting at 1.

### 2.1 `mandates/{mandateId}`

```
schemaVersion             1
userId                    string
status                    'active' | 'closed'
voided                    bool          // FR-3: escape-hatch books only
revision                  int           // monotonic; incremented in every mutating transaction (F1)
archetype                 code-id
managerAgentId            string        // D-7 separate identity; STABLE per user×archetype (FR-7) — re-hiring resumes the same manager
vintageRef                string        // → archetypeVintages/{codeId}_{hash}  (F8, §5.1)
quarterIndex              int           // 1-based; part of quarter identity
quarterKey                string        // `${mandateId}:${quarterIndex}` — deterministic (F7)
createdAt / quarterStartAt / nextRolloverAt      ts
cadenceTier               'slow'|'standard'|'fast'
escapeHatchEligibleUntil  ts            // first book only; createdAt + 14d
portfolio {
  cash                    number (USD, 2dp)
  positions { TICKER: { shares (6dp), costBasisTotal (USD 2dp), avgCost (derived),
                        lastMark, lastMarkAsOf, lastMarkSource, sector } }
  totalValue, initialValue, sectorWeights
  lifetimeHighWaterMark, lifetimeDrawdownFromPeak       // F15: lifetime lens
  quarterHighWaterMark,  quarterDrawdownFromPeak        // F15: tenure lens (reset at rollover)
}
scoring { quarter: {...}, lifetime: {...}, asOf }        // FR-2 tenure-scoped primary
health { consecutiveEvalFailures, lastSuccessfulEvalAt, lastCloseMarkAt, quarantined }  // F25
dormancy { lastUserActivityAt, downshifted }
costTelemetry { tokensIn, tokensOut, estUsd, monthKey }
execState { openBatchId, openBatchSubmittedAt, lastProcessedRolloverKey, lastCloseKey }
```

**Escape-hatch once-ever flag:** `userMeta/{uid}.mandateEscapeHatchUsed` — written **inside** the escape transaction (§5.4), never as a follow-up (F6).

### 2.2 Subcollections

- `dailyRows/{YYYY-MM-DD}` — `{ date, totalValue, dayReturnPct, quarterDrawdown, regime, regimeAsOf, regimeSource, markSource, **agencyState**, evalCount, tokensIn, tokensOut, estUsd, quarterIndex, schemaVersion }`. Written by the daily close pass (§3.6), never by an eval tick. `quarterIndex` makes tenure-scoping a query (FR-2). `agencyState` ∈ `full | exit_only | frozen | skipped:<reason>` records whether the manager could act that session (I10); quarter summaries aggregate it so tenure records distinguish judgment from administrative freeze.
- `decisions/{decisionId}` — deterministic ID (§3.3). Records verb, ticker, requested and executed size, executed price with `priceBasis:'harvest_tick'`, friction breakdown + `frictionModelVersion`, gate outcomes, `vintageRef`, `baseRevision`, `submitTickKey`, `harvestTickKey` (I3), `mandatePromptTemplateVersion`, `influenceStateRef` (null in V1, FR-7/I8), `status: 'executed'|'rejected_stale'|'gated'|'failed'|'cancelled'|'expired'` — six terminal states, exactly one per submission (I1).
- `quarterSummaries/{quarterIndex}` — tenure record (FR-2): archetype, `vintageRef`, `quarterStartAt`/`quarterEndAt`, opening and closing value, tenure return, tenure risk metrics, regime mix, `scoring: bool` (false when `voided`, FR-3).
- `corporateActions/{actionId}` — applied action log (§4.3), idempotency-keyed.

### 2.3 Platform collections

- `mandateUniverseSnapshots/{tickKey}` — §3.0.
- `archetypeVintages/{codeId}_{hash}` — §5.1.

### 2.4 Indexes and rules

Composites: `userId+status`, `userId+createdAt DESC`, `status+nextRolloverAt ASC`, `status+health.quarantined+userId` (sweep cursor, §3.1).
Rules: owner-read on books and subcollections; **all client writes denied** (Admin SDK only). Every user action goes through an authenticated endpoint (§7).

---

## 3. Evaluation Pipeline

### 3.0 Shared universe snapshot (HARD REQUIREMENT)

**Market data is fetched once per tick, platform-wide. No book fetches its own data.** Architectural invariant, not an optimization.

- `mandateUniverseSnapshot.js` builds snapshots in **two layers** (Q5: cold per-symbol enrichment costs 5 fetches/stock and must never run per tick):
  - **Fast layer (per tick):** batched multi-symbol quotes via the true batch endpoint (`fetchBatchQuotes` path — the only genuinely multi-symbol upstream; `fetchIntradayBatch` is per-symbol despite its name and is not used here). Prices, volume, change. → `mandateUniverseSnapshots/{tickKey}`.
  - **Slow layer (once daily, pre-open):** fundamentals-derived fields (marketCap, sector/industry), corporate-actions data (§4.3), and any technical baselines. → `mandateUniverseDaily/{date}`. Tick snapshots reference the day doc; per-symbol enrichment is a daily cost, not a tick cost.
- **Build set** = curated candidate universe ∪ all held tickers across active books, **hard-capped at `MANDATE_UNIVERSE_MAX_SYMBOLS` (initial 300)**. Because BUY/ADD is restricted to snapshot symbols (below), held tickers are a subset of the universe by construction — the union cannot grow unboundedly with users (F12). Delisted or removed symbols still held by a book are carried in the build set as **carry-over marks** until closed out, and counted against the cap with priority over candidates.
- **Size budget:** `MANDATE_SNAPSHOT_MAX_BYTES` (initial 800KB, under Firestore's 1MB doc ceiling). Build fails loudly rather than silently truncating; if the budget is approached, candidate symbols are dropped before held symbols.
- **Candidate-capacity floor (I11):** the snapshot must retain ≥ `MANDATE_MIN_CANDIDATE_CAPACITY` (initial 100) non-held candidate symbols. Falling below logs `MANDATE_UNIVERSE_DEGRADED` and alerts — the cap must never silently convert the platform to sell-only by crowding candidates out with carry-overs.
- **Per-symbol completeness (F11):** each symbol entry carries `{price, priceAsOf, source, complete: bool}`. The snapshot doc carries `symbolCount`, `completeCount`, and `missing[]`. A fresh `builtAt` **does not** certify a symbol.
- **Freshness contract (per-symbol, I2):** freshness is evaluated per held symbol, never whole-book. Symbols that are present, `complete`, and within `MANDATE_MARK_MAX_AGE_MS` are **actionable**; stale/missing symbols are **frozen** (no action on them this eval, carry-over mark). The eval proceeds on the actionable set — one halted ticker never suppresses exits on nineteen healthy ones. A book with zero actionable symbols skips with reason and `agencyState:'skipped:data'`. No per-book fetch, ever.
- **Eligible trade universe (F16):** BUY/ADD may only name a symbol present-and-complete in the tick's snapshot. Any other ticker is rejected at the deterministic gate (§3.4) with `status:'gated'`. There is no fallback fetch path.
- **Enforcement:** dependency test — no module on the book eval path imports market-fetch clients except `mandateUniverseSnapshot.js`.

**Scaling property (restated with verified call counts, F12/F30/Q5):** upstream volume is flat in user count and now computable: fast layer ≈ a handful of batched quote calls per tick (300 symbols / batch-size per call), ~5 ticks/day; slow layer ≈ 2–3 calls/symbol once daily (fundamentals + splits + dividends) ≈ ~900/day. Total well under 2K calls/day against a 100K/day ceiling — no tier upgrade at any plausible scale. The snapshot builder increments a **daily upstream-call counter** (Q5 found no quota accounting anywhere; the book brings its own), logged and alerted at a configured fraction of the daily ceiling. Acceptance measures observed request counts (§9).

### 3.1 Handler, calendar, and bounded sweep

`api/cron/mandate-evaluate.js` — new, non-fenced. One slot.

- **Calendar (F17):** eligibility is governed by a single source of record — `marketSchedule` (`NYSE_HOLIDAYS_*`, session times, half-days) — evaluated in `America/New_York`. The cron fires generously; the handler decides. Holidays and post-close half-day ticks are no-ops. Cadence tiers map to *session-relative* slots (open+30m, midday, pre-close), not raw UTC hours.
- **Lock (Q3 resolved — build own):** the existing `evaluatingAt` lease is timestamp-only, has no owner identity, releases unconditionally, and its 120s timeout sits under a 300s handler — the stale-writer race is real. The book's lease carries an **owner token** (invocation nonce); release and renewal are preconditioned on token match. More importantly, **correctness never rests on the lease**: every book mutation is a `revision`-preconditioned transaction (§3.5), so a stale writer's commit fails on mismatch regardless of lock state. The lease exists to prevent wasted duplicate work, not to guarantee safety.
- **Bounded sweep (F24):** work is processed in bounded pages (`MANDATE_SWEEP_PAGE_SIZE`) with a durable cursor in `cronState`. Ordering is by `lastSuccessfulEvalAt ASC` so the least-recently-served books go first and no tail starves. A tick that exhausts its budget commits its cursor and defers; the next tick resumes. Completion is proven by cursor wrap, logged.
- **Per-book isolation:** try/catch per book; failures increment `health.consecutiveEvalFailures` (§6.4).
- **Tick order:** ensure snapshot (§3.0) → harvest (§3.3) → select eligible → submit. Snapshot construction is a **precondition**; if it fails, the tick harvests but does not submit.

### 3.2 Prompt assembly — new, fence-free

- **Identity: assembled from the pinned vintage doc** (`vintageRef`), never from live registry reads (F8, §5.1).
- Context: `mandateContextBlock.js` — book state, positions with marks and `asOf`, cash, quarter drawdown, days-into-quarter, regime + `regimeAsOf`. No timer, no opponent.
- Market data: shared snapshot only (§3.0); candidate count is a config constant.
- Context budget enforced pre-send (§6.3).
- New prompt-contributing modules registered in `PROMPT_CONTRIBUTING_MODULES` same commit.

### 3.3 Model seam, transport, and the execution contract

- `mandateModelCall.js` — sole Anthropic-client importer in book context (AST-enforced). Provider/model/params from `mandateGenerationConfig.js`.

**Submission envelope (F1) — every request carries an immutable base-state identity:**
```
{ requestId, mandateId, baseRevision, quarterKey, vintageRef, snapshotTickKey,
  bookStatus, submittedAt, sessionDate }
```
`requestId` is deterministic: `hash(mandateId, quarterKey, snapshotTickKey, baseRevision)` (F2).

**Harvest validation — a result is applied only if ALL hold:**
1. `book.revision === baseRevision`
2. `book.quarterKey === quarterKey` and `book.status === 'active'` and not `voided`
3. `sessionDate` equals the current trading session (**cross-session results are never applied**, F3)
4. result age ≤ `MANDATE_RESULT_MAX_AGE_MS`
5. every ticker named is present-and-complete in the **current** tick's snapshot

Any failure → decision written `status:'rejected_stale'` with the failing condition, and **discarded**. Stale decisions are never adapted, re-priced, or partially applied.

**Exactly-once (F2):** decision docs use the deterministic `decisionId`; execution is claim-and-execute inside the §3.5 transaction (create-if-absent on the decision doc is the claim). A crash after commit leaves a committed decision; a retry sees it and no-ops. A crash before commit leaves nothing.

**Price basis (I3):** fills execute at the **harvest tick's mark** — latency realism; the model's sizing is in dollars, so share quantity derives at the harvest price. Both `submitTickKey` and `harvestTickKey` land on the receipt. **Price-drift guard:** if the harvest mark has moved more than `MANDATE_PRICE_DRIFT_MAX_BPS` (initial 150) from the submit mark, the decision is `rejected_stale` with the drift recorded — the manager never fills at a price materially different from the one it reasoned over.

**Terminal-state contract (I1):** every submission reaches **exactly one** terminal state — `executed`, `rejected_stale`, `gated`, `failed`, `cancelled` (operator/lifecycle disposal), or `expired` (age-out past `MANDATE_RESULT_MAX_AGE_MS`, applied by the next harvest or health sweep, not merely alerted). **Every terminal transition clears `execState.openBatchId` in a revision-disciplined transaction** — there is no path that leaves the gate set with no live batch behind it, and no bare doc-write path that clears it outside the discipline. From every reachable state the book returns to submit-eligibility.

**Liveness metric (I9):** the book maintains `execState.submitted` / `execState.executed` counters; the `executedVsSubmitted` ratio is a first-class health signal (§6.4). A stale-rejection streak ≥ `MANDATE_STALE_STREAK_ALERT` (initial 3) alerts independently of eval failures — a platform of never-trading books must be loudly distinguishable from a healthy one.

**Last-tick-of-session rule (F3):** the final eligible tick of a session **does not submit**. Submission happens only on ticks with a later same-session harvest opportunity. Slow-tier books therefore evaluate on an early slot by construction.

**Transport modes:** `MANDATE_TRANSPORT_MODE: 'direct'|'batch'`. **Drain protocol (F26):** a mode change takes effect only after all open batches are harvested or explicitly cancelled and their decisions written `rejected_stale`. `execState.openBatchId` gates submission — a book with an open batch never double-submits.

**Caching:** `cache_control` on the stable scaffold; do not assume batch and caching stack; `cacheHitTokens` measured (§6.3).

### 3.4 Decision schema and deterministic gate

- `MANDATE_DECISION_TOOL` (new module): `BUY | SELL | TRIM | ADD | HOLD`, one action per decision, sized in dollars (shares derived at execution).
- **Gate order (C-21: risk lines preempt advisory):**
  1. **Universe check** — BUY/ADD ticker must be present-and-complete in the tick snapshot (§3.0), else `gated`.
  2. **Exit lane (F9, I2)** — SELL/TRIM are **never blocked by minimum-position count or diversification rules**, and exits clear on any symbol whose own data is fresh regardless of other symbols' state or the book's quarantine status. This is C-21 in practice, restated as spec doctrine: **fail-closed governs entries and governs acting on bad data; it never suppresses exits on fresh data; and no exit-suppressing state may be indefinite.**
  3. **Entry gates** — sector cap via `mandateSectorCap.js` (own implementation per O-5/Q1, fail-closed, cap values from the pinned vintage payload), max single-position weight, cash floor 2%, max position count 15.
  4. **Bootstrap ramp (F9)** — the minimum-position target (5) is a *construction target*, not an entry precondition. A book below target is in `bootstrapping` mode: BUY is permitted freely toward the target, and the prompt instructs the manager to build toward it. The minimum never converts a BUY to HOLD, and never blocks a SELL.
- Gate outcomes are recorded on the decision doc with the specific rule that fired.
- **Bandwidth (I16, deliberate V1 decision):** one action per eval is chosen for auditability and gate simplicity, and it caps risk-response speed — a 15-position fast-tier book needs ~5 sessions to fully de-risk; slow tier, weeks. This is acknowledged in the scoring model: stress-window drawdowns are partly bandwidth artifacts, the tenure record notes the constraint, and multi-action decisions are an explicit V2 candidate rather than a silent assumption.

### 3.5 Atomic execution boundary (F5)

All of the following occur in **one Firestore transaction**, or none do:

read book at `baseRevision` → verify envelope conditions → **re-mark all positions at the harvest tick's snapshot** (one consistent valuation for gates and totals, I6) → mutate `cash`, `positions`, `costBasisTotal`, `totalValue`, `sectorWeights`, realized P&L → write the `decisions/{decisionId}` doc → increment `revision` → clear `execState.openBatchId`. **The execution transaction never writes high-water marks or drawdown peaks** — the close pass is the sole peak writer (I6); intra-day totals inform gates, not records.

Invariants asserted inside the transaction: cash ≥ 0; shares ≥ 0; `Σ position marks + cash === totalValue` within rounding tolerance. A violated invariant aborts the transaction and writes `status:'failed'` on a health increment — it never partially commits.

### 3.6 Daily close pass (F4)

`MANDATE_CLOSE_ENABLED` — runs on the **final eligible tick of each trading session** (no new slot; the eval handler's post-close duty). It is the authoritative mark, independent of model cadence, and runs for **every** active book including slow-tier and dormant.

Per book, in one transaction: apply any pending corporate actions (§4.3) → mark every position at the session's official close from the close snapshot → recompute `totalValue` and **set HWM/drawdown (both lenses) — the close pass is the sole writer of peaks (I6)** → write `dailyRows/{date}` with regime, provenance, and `agencyState` (I10) → recompute quarter and lifetime scoring (§4.2) → increment `revision` → set `execState.lastCloseKey` (idempotency: a repeat run for the same date no-ops). Books created intra-session (escape replacements, I17) write a `partial:true` row on their creation day; their first full-session row begins the scoring series.

A book that cannot be fully marked (missing/incomplete holdings) writes a row flagged `partial:true` with `markSource:'carry_over'` and increments `health.missedMarks` — it does not silently record a stale value as truth (F19).

**Dual-label stream (O-11, I14):** after a successful close, an awaited-and-checked `shadowLogger.appendToStream('mandate_scoring', …)`. On failure, the close transaction's follow-up writes a durable `pendingScoringAppends/{date}` marker; the next close consumes and retries all pending markers. A logged failure followed by process death is therefore a deferred row, never a silently missing one. The stream never blocks or re-runs the close itself.

### 3.7 Retention (F34)

`mandateUniverseSnapshots` retained **120 days** (I13 — decision-relevant context must cover the scoring window it will be narrated against; a quarter is ~63 sessions); terminal batch bookkeeping 30 days; `decisions`, `dailyRows`, `quarterSummaries`, `corporateActions` retained indefinitely (they are the record). Cleanup piggybacks the close pass — no new cron.

---

## 4. Money and Scoring

### 4.1 Accounting precision (F14)

- **Cost basis: average cost.** `costBasisTotal` in USD; `avgCost = costBasisTotal / shares`. Partial sale reduces `costBasisTotal` proportionally: `Δbasis = costBasisTotal × (sharesSold / sharesHeld)`; realized P&L = `proceedsNet − Δbasis`.
- **Execution price** = snapshot mark ± friction, computed once: `executedPrice = mark × (1 + slippageBps/10000 + spreadProxyBps/10000)` for buys, minus for sells. Commission $0 (V1). **`spreadProxyBps` is a modeled estimate by market-cap tier** — bid/ask do not exist in any repo payload (Q5) — and every receipt labels it `spreadBasis:'proxy'` so the estimate is never mistaken for observed spread.
- **Friction honesty at scale (O-3):** `MANDATE_STARTING_CAPITAL` is $10M, at which a 5% position is ~$500K — a size whose real-world market impact materially exceeds fixed-bps slippage. The friction model is therefore **idealized: it models spread and slippage but not market impact or liquidity constraints.** Every receipt carries `frictionBasis:'idealized_no_market_impact'`, and any surface reporting net P&L must not describe these frictions as realistic execution cost. D-15's honesty promise is satisfied by accurate labeling, not by overstating the model. *(Mitigating factor: the curated universe is liquid large/mid-cap by construction, so the gap is narrowest where it matters most.)*
- **Quantity clamps (Q4):** SELL/TRIM share quantities are clamped to currently held shares before execution; a clamped decision records `clamped:true`. The season fork's unclamped over-sell path is explicitly not inherited. Season `computeTradeStats` is not ported; realized P&L is basis-correct per this section.
- **Friction enters exactly once, at execution, through cash** (F14). `frictionPaid` is recorded on the decision and accumulated for reporting only. **`netPnl` is the portfolio-derived figure; `grossPnl` is reconstructed as `netPnl + Σ frictionPaid`.** Frictions are never subtracted a second time.
- Shares to 6dp, cash and USD to 2dp, banker's rounding; a BUY is sized down to fit available cash after friction so cash can never go negative (asserted in §3.5).

### 4.2 Risk metrics (F18, F15)

- `mandateRiskMetrics.js`, forked from season math (R15), computed **per lens**: `scoring.quarter` uses only rows with the current `quarterIndex` (FR-2); `scoring.lifetime` uses all rows.
- **Warmup:** metrics requiring dispersion return `null` (never `NaN`, never 0) below `MANDATE_METRIC_MIN_ROWS` (initial 20 for Sharpe/consistency, 5 for drawdown). Nulls are stored as nulls and rendered as "insufficient history."
- **Partial-row discipline (I6):** rows flagged `partial:true` or carrying frozen/carry-over marks are **excluded** from variance-based metrics (Sharpe, consistency) and counted in drawdown only with a `degradedMarks:true` flag on the scoring block. A book carrying a frozen position reports metrics honestly labeled, never variance-suppressed numbers presented as full-quality.
- Zero variance → Sharpe `null`. Zero drawdown → recovery factor `null`, not infinity. Composite is computed only from non-null components with weights renormalized, and records which components contributed.

### 4.3 Corporate actions (F13, FR-4)

`mandateCorporateActions.js`, applied in the close pass before marking, idempotent per `{mandateId, actionId}`:

- **Split / reverse split:** shares × ratio, `costBasisTotal` unchanged, `avgCost` derived. No P&L impact.
- **Cash dividend:** cash += `shares × amount`, recorded as income (not realized trading P&L) on the daily row.
- **Stock distribution:** shares increase, basis unchanged.
- **Ticker change:** position key migrates; decision and daily history retain the old symbol with a `renamedTo` pointer.
- **Delisting / merger (FR-4):** forced close at last good mark, proceeds to cash, decision written `verb:'CORPORATE_CLOSE'`, symbol dropped from the carry-over build set.

Source (Q5): **no corporate-action feed exists in the repo today** — P3 adds a small fetcher against EODHD's splits and dividends endpoints, run in the snapshot slow layer for held + universe symbols. Backstop (revised per I7): an overnight gap beyond `MANDATE_CA_GAP_THRESHOLD` on a held symbol first **cross-checks the CA feed**; if a matching action exists, it is applied normally. If the gap is **ratio-shaped** (≈÷2, ÷3, ÷10 — split signature) with no feed entry, the **symbol** enters suspected-CA carry-over (frozen mark, exit via §3.4 remains available at last good mark) pending resolution — the *book* is never frozen. **News-shaped gaps pass through** — markets gapping on earnings is not an anomaly, and founder-manual-clear is never the response to routine volatility. An unrecognized action type likewise quarantines (§6.4) rather than silently mismarking.

---

## 5. Lifecycle

### 5.1 Vintage as a pinned behavioral contract (F8, F22, F36)

Metadata pinning is insufficient — a stored label with live registry reads produces silent mid-quarter behavior drift. Instead:

- `archetypeVintages/{codeId}_{hash}` — a **content-addressed, immutable** doc containing the full behavior-bearing payload for one archetype at one release: identity block text, physics/knob values, zone definitions, all contributing version constants, **the model seat (provider + model id + generation params, FR-6)**, **gate configuration (cash floor, position bounds, max single-position weight, decision-tool verb set, FR-6)**, and `displayVintage` ("Contrarian v1.4"). `hash` is computed over the payload.
- **Boundary enumeration (I5):** *inside the pin* — everything above. *Outside the pin, under declared change control with per-receipt version stamps* — prompt-template logic (`mandatePromptTemplateVersion`), friction model (`frictionModelVersion`), snapshot/calendar machinery. Nothing that materially shapes decisions lives outside both lists. **Break-glass:** `MANDATE_VINTAGE_BREAK_GLASS` permits an emergency model substitution across active books (provider outage, model-safety event); activating it is a logged platform event stamped on every affected receipt and reported at the next founder review.
- Creation is a **release action**: a build step materializes the current composition into a vintage doc if one does not already exist for that hash. This is the atomic release unit DEF-3 needs (F22) — rollover consumes a *published* vintage, never a live mixed read.
- Books store `vintageRef`; **§3.2 assembles prompts from the pinned doc**. Registry changes mid-quarter cannot reach an active book.
- **Coverage (Q2):** the vintage payload includes **all** archetype version constants — explicitly including `calibrationBundleVersion`, which the live identity hash asymmetrically drops — plus the full composed content. The live `computeIdentityHash` is not reused as-is; the vintage hash is computed over the complete payload. **Boundary:** platform prompt-template logic (the book's own assembly code) is *platform machinery*, not archetype content — it is not pinned per-book, but `mandatePromptTemplateVersion` is stamped on every decision receipt so template evolution is visible in provenance. Archetype-borne behavior is book-pinned; platform machinery evolves globally, with receipts.
- Rollover re-pins to the current published vintage (§5.3). Multiple vintages run live simultaneously — the intended per-user staged rollout (D-9).

### 5.2 Creation and lock

`mandateCreationService.js` (Admin-side): mints `managerAgentId`, resolves and pins `vintageRef`, seeds `MANDATE_STARTING_CAPITAL` as cash, sets `quarterIndex:1`, `quarterKey`, `nextRolloverAt`, `escapeHatchEligibleUntil = createdAt + 14d`, `revision:0`. Spec 2 calls it from onboarding; Spec 1 ships a founder-gated endpoint (§7).

**Lock (D-2):** no archetype-change path exists on an active book. The only mutations are the escape hatch and rollover.

**One active book per user:** enforced by a transactional same-doc claim on `userMeta/{uid}.activeMandateId`, written in the same transaction as creation — read and write target one document, guaranteeing a write-write conflict between concurrent creators. Reference implementation: `reserveSymbol` (`tournamentAgentLedger.js:370`, Q6). Count-cap query patterns (season's) are explicitly rejected: they guard a cap, not uniqueness, and cross-partition safety rests on runtime phantom protection.

### 5.3 Rollover (D-37, F7, F21, F23)

`api/cron/mandate-rollover.js` — second slot, daily pre-market, calendar-gated per §3.1.

- Query `status=='active' && nextRolloverAt <= now`.
- **Boundary normalization (I4):** `nextRolloverAt` is normalized at creation and at every advance to the **next session close on or after** `createdAt + 3 months` — quarter boundaries live only at session edges the close pass owns. The close pass that completes a boundary session is the last row of the old quarter; rollover processes next pre-market and the new quarter's first row is that day's close. **Row `quarterIndex` tags are the single source of truth for tenure membership (FR-2); summary windows derive from tagged rows**, so windows, tags, and boundary valuations are mutually consistent by construction — including under processing lag and catch-up. Boundary opening/closing valuations are the authoritative closes of the tagged edge rows, never the book doc's processing-time value.
- **Logical vs processing time (F21):** if several boundaries have passed (outage), the sweep **catches up one boundary at a time**, deriving each summary from its tagged rows; a catch-up quarter whose row range is empty is recorded `empty:true` rather than fabricated.
- **One atomic commit (F7)** per boundary containing: `quarterSummaries/{quarterIndex}` write → `quarterIndex++` and new `quarterKey` → `quarterStartAt` = logical boundary → `nextRolloverAt` += 3 months (ET/DST-safe) → **re-pin `vintageRef` to the current published vintage** → reset quarter lens (`quarterHighWaterMark = totalValue`, `quarterDrawdownFromPeak = 0`) → **recompute `cadenceTier` from the new vintage** (F23) → `execState.lastProcessedRolloverKey = quarterKey` → `revision++`. Idempotent by `lastProcessedRolloverKey`.
- **Capital carries forward (FR-1, asserted per I15):** the rollover transaction **asserts `totalValue` unchanged across the commit** — the charter's most user-facing promise is structural, not documented. Lifetime HWM continues. The new quarter's opening value is the boundary close.
- **Open-batch disposal (I1):** a book crossing rollover with an open batch has it **cancelled inside the rollover transaction** (`status:'cancelled'`, gate cleared) — stale batches never cross a quarter boundary.
- **Archetype selection:** V1 default continues the same archetype; the sweep accepts an archetype parameter so DEF-1 attaches without touching mechanics. Selecting a different archetype changes `archetype`, `managerAgentId`, and `vintageRef` — **and does not touch capital** (FR-1).

### 5.4 Escape hatch (D-3, FR-3, F6)

Endpoint (auth per §7). Preconditions, all validated **inside one transaction**: book is the user's first book, `now <= escapeHatchEligibleUntil`, `userMeta.mandateEscapeHatchUsed === false`, book `status === 'active'`, and `execState.openBatchId` is null.

Single transaction: close old book (`status:'closed'`, `voided:true`) → write terminal `quarterSummary` with `scoring:false` → create replacement book at `MANDATE_STARTING_CAPITAL` with the new archetype and a freshly pinned `vintageRef`, `quarterIndex:1` → set `userMeta.mandateEscapeHatchUsed = true` and `activeMandateId` → flag both books for the I-5 cohort.

**Race with rollover (F6):** a book within its first 14 days cannot be at a rollover boundary, so the two cannot collide in practice; the transaction nonetheless re-reads `revision` and aborts on mismatch. **Open batch (I1, revised):** an open batch is **cancelled inside the escape transaction** (`status:'cancelled'`, gate cleared) — the escape hatch is the one charter mechanism (D-3) that must never be blockable by plumbing, so it disposes rather than refuses. The replacement book's row obligations follow I17 (§3.6).

---

## 6. Instrumentation

### 6.1 Regime and provenance (I-7, F19)
Regime is stamped on each daily row at write time from `indexIntelligence/marketContext`, with `regimeAsOf` and `regimeSource`. A regime doc older than `MANDATE_REGIME_MAX_AGE_MS` is stamped `regime:'unknown'` — never a silently stale label. Marks carry `lastMarkAsOf` and `lastMarkSource`.

### 6.2 Cost telemetry (I-6)
`modelPriceTable.js` (versioned $/MTok); usage × table → `estUsd` accumulated per book and per daily row. `MANDATE_RUNRATE_EXCEEDED` logged above the D-22 band.

### 6.3 Token budget and cost claims (F30)
`MANDATE_EVAL_INPUT_TOKEN_BUDGET` (14,000) measured pre-send with a per-block breakdown on exceed (alert, not block). `cacheHitTokens` recorded.
**Reference envelope — assumptions stated, not asserted:** ~$0.0075/eval batched at 12K in / 600 out; per book-month ≈ $0.16 slow / $0.32 standard / $0.63 fast; blended ~$0.30–0.35 **assuming a 40/40/20 slow/standard/fast mix**. Upstream call estimates assume a verified calls-per-symbol figure (§11). **Acceptance measures observed model spend and observed upstream request counts** — the envelope is a comparison baseline, never a passing criterion.

### 6.4 Health and quarantine (F25)
`health.consecutiveEvalFailures` increments on any per-book failure and resets on success. At `MANDATE_QUARANTINE_THRESHOLD` (initial 5) the book enters **exit-only mode** (I2): it remains in the eval sweep with the decision tool restricted to `SELL | TRIM | HOLD`, entries blocked, `agencyState:'exit_only'` on its rows, and `MANDATE_QUARANTINED` emitted. It is still marked daily by the close pass. A book is never left fully frozen and indefinitely founder-gated while riding positions down — C-21 outranks ops hygiene. Founder action restores full mode. Also alerted: missed close marks ≥ 2 consecutive sessions, snapshot build failures, open batches older than `MANDATE_RESULT_MAX_AGE_MS` (auto-expired per §3.3, not merely alerted), `executedVsSubmitted` below `MANDATE_LIVENESS_FLOOR` over a trailing window, and stale-rejection streaks (I9).

### 6.5 Dormancy
`lastUserActivityAt` touch API (Spec 3 wires touches), `downshifted` derivation, flag. **Trading cadence and daily close are never downshifted** — only future reflection/narration depth.

---

## 7. Feature Flags and Endpoint Auth

**Flags** (default false/safest, merge dark): `MANAGED_MANDATE_ENABLED` · `MANDATE_EVAL_ENABLED` · `MANDATE_CLOSE_ENABLED` · `MANDATE_ROLLOVER_ENABLED` · `MANDATE_TRANSPORT_MODE='direct'` · `MANDATE_DORMANCY_DOWNSHIFT_ENABLED` · `MANDATE_FOUNDER_CREATE_ENABLED`. Cron registrations land with handlers no-op'ing while flags are false. Flips are separate one-line PRs after preview smoke.

**Endpoint auth contract (F29)** — every mutating endpoint:
- Verifies a Firebase ID token server-side; derives `uid` **from the token, never from the request body**.
- Asserts `book.userId === uid` before any mutation. Book IDs in the body are treated as untrusted input.
- Founder-only endpoints require both `MANDATE_FOUNDER_CREATE_ENABLED` **and** an allowlisted `uid` — a flag alone is not authorization.
- Cron endpoints check `x-vercel-cron` **or** `CRON_SECRET` on **all methods**, not GET only (avoiding the bypass found in the audit).
- Mutating endpoints are idempotent by client-supplied request key where retry is plausible.

---

## 8. Fence Interaction Plan

**Zero fenced edits.** All fenced interaction is call-only (BUILD_RULES §1-permitted, no sign-off): archetype config **reads** (cap values, knobs) and registry composition at *vintage publish time*. Q1 removed the only planned fenced function call (`checkSectorCap` — private, battle-shaped, fail-open); the book now touches fenced modules for data reads only. Ratchet obligation: the new importer path recorded in `archetypeImportBoundaryBaseline.json` same commit.

**Escalation (F32):** if any phase discovers it needs a fenced **shape or behavior** change, that phase **stops and escalates per BUILD_RULES §7** (the dual-adversarial fence review procedure) — not this document's §7. Design intent is that none does.

**Fork ledger (I12):** declared fork sources — `seasonSettlement.recalculatePortfolio` and `seasonLeaderboard` risk math (**not on the 11-file fence**; fork is not circumvention), forked into `mandateExecution.js` / `mandateRiskMetrics.js` with the Q4 hazards excluded. **Accepted divergence, documented:** the battle sector-cap enforcer (fenced, tier-shaped) and `mandateSectorCap.js` (flat-map) share cap *values* via archetype config but not enforcement semantics; the same archetype may exhibit different effective concentration in arena vs. book. Revisit at Spec 4 when the two run side by side; any reconciliation is a §7-gated event on the battle side.

**Fork ledger — registry snapshot catalog vs. vintage store (added Phase 1, 2026-08-12; founder ruling on the Step 0 drift check).** The rules-revamp "Composition PR 4 (catalog model)" landed a content-addressed registry snapshot catalog (`docs/registry-snapshots/archetype-registry-identity-v{N}.json`, built by `archetypeRegistry.buildRegistrySnapshot()`) *after* this spec's verification basis was taken. It is deliberately a **separate mechanism from the §5.1 vintage store, with a distinct job** — **not** duplication: (a) **registry snapshots** are *registry-side release/audit artifacts*, keyed by the **incomplete `identityHash`** (`computeIdentityHash`, which strips `calibrationBundleVersion` / `ruleLibraryVersion`), carrying archetype composition + corpus only; (b) the **vintage** (`archetypeVintages/{codeId}_{hash}`) is the *mandate-side complete behavioral contract*, keyed by `canonicalContentHash` over the **full payload** (archetype content + model seat + gate config + all version constants), and is the doc a book pins and §3.2 assembles prompts from. The two are joinable in audit because the vintage payload records `versionConstants.archetypeIdentityVersion`, and vintage publish **asserts** the frozen composition resolves against the current `ARCHETYPE_IDENTITY_VERSION` before writing. **Ratchet reconciliation:** per O-12 the vintage publish reads archetype content through `archetypeRegistry` (the sanctioned surface — it exposes `physics.sectorConcentrationCap` and `physics.calibrationBundleVersion`), so Phase 1 introduces **no new direct importer of a legacy archetype table** and `archetypeImportBoundaryBaseline.json` is unchanged (adding a registry-only consumer would fail `archetypeRegistry.test.js`'s shrink-only ratchet). The §8 "new importer recorded … same commit" obligation is satisfied by construction — there is no new importer.

**Fork ledger — season execution math → `mandateExecution.js` (realized Phase 2, 2026-08-12).** The declared fork (line above) is now concrete. `mandateExecution.js` re-implements the portfolio-mutation math independently rather than importing `seasonSettlement` (fork is a rewrite against the season contract Q4 verified, not a call into dormant season code). **Carried:** average-cost basis (`avgCost = costBasisTotal / shares`; ADD blends `((oldShares·oldAvg)+(newShares·price))/total`, the `seasonSettlement.js:162` shape), null-on-degenerate, and single-point friction. **Deliberately EXCLUDED (Q4 hazards, §4.1):** the season fork's unclamped over-sell path — SELL/TRIM quantities are clamped to held shares (`clamped:true` recorded); and season `computeTradeStats`/proceeds-based trade stats are not ported — realized P&L is basis-correct (`proceedsNet − Δbasis`, `Δbasis = costBasisTotal·(sharesSold/sharesHeld)`). **P2 divergences from the eventual model, documented:** friction is zeroed (`MANDATE_FRICTION_MODEL_VERSION = 'p2_zero_friction'`; the market-cap-tier spread proxy is P3) but every receipt already carries the honesty labels; and the close pass — not this transaction — remains the sole writer of HWM/drawdown peaks (I6), so the execution boundary writes none. `seasonLeaderboard` risk math → `mandateRiskMetrics.js` is still P3.

**Prompt-input registry (Phase 2 reading, flagged for founder).** §3.2's "register new prompt-contributing modules in `PROMPT_CONTRIBUTING_MODULES` same commit" was read as *register in a prompt-contributing-modules registry*: a mandate-scoped one (`__fixtures__/mandatePromptRegistry.js` + `mandatePromptAssembly.honesty.test.js`) rather than the battle-specific C-20 registry, whose forbidden-signal list and fenced-assembler tripwire are battle-only and would cross-couple the two subsystems' honesty suites. The mandate tripwire enforces the substantive §3.2 guard directly — the assembler imports **no** live registry/model-config source (identity comes only from the pinned vintage) and every prose module is classified. If the founder intends literal membership in the shared C-20 list instead, it is a one-line follow-up.

`/code-review` at high effort for any phase exceeding 10 files / 1500 lines (P2, P3 will).

---

## 9. Phases and Acceptance

| Phase | Scope |
|---|---|
| P1 | Schema + `schemaVersion`, rules, indexes, `userMeta` with transactional active-book claim, vintage store + publish step (§5.1), creation service, founder endpoint with auth (§7) |
| P2 | **Two-layer snapshot builder (§3.0) with completeness + bounds + call counter**, market-calendar gating, bounded sweep + owner-token lease, model seam + config + price table, prompt assembly from pinned vintage, decision tool, deterministic gate incl. `mandateSectorCap` + exit lane + bootstrap ramp, **atomic execution boundary (§3.5)** with quantity clamps, direct transport |
| P3 | Daily close pass (§3.6), friction model with `spreadProxyBps` (§4.1), risk metrics both lenses with warmup nulls (§4.2), corporate-actions fetcher + gap detector (§4.3), dailyRows + regime provenance, dual-label stream, cost telemetry, health/quarantine (§6.4), retention (§3.7) |
| P4 | Rollover sweep with logical-time catch-up, escape hatch transaction, quarterSummaries, accelerated-clock harness |
| P5 | Batch transport: submission envelope, deterministic IDs, harvest validation, last-tick rule, drain protocol; prompt caching; cadence tiers |
| P6 | Cron registrations, preview smoke, acceptance run |

**Founder acceptance bar (before Spec 2 begins) — F31:**
1. **All six archetypes** run books dark ≥ 10 market days (not three tiers).
2. At least 5 of those days in **production transport (`batch`)**, including a Friday and a session followed by a market holiday.
3. Every active book has a `dailyRow` for **every** trading session — zero gaps, slow tier included.
4. **Injected failure cases pass:** duplicate harvest of one batch executes once; a result whose `baseRevision` is stale is rejected, not applied; a cross-session result is rejected; a snapshot missing a held symbol causes a skip and a flagged partial close, not a bad mark; a mid-flight crash (killed between decision write and commit) leaves no partial mutation; a rollover replayed twice produces one summary.
5. Accelerated-clock harness: full rollover with capital carried forward and quarter lens reset; a two-boundary catch-up; one escape-hatch exercise resetting to $100K with `voided:true` and a non-scoring summary.
6. **Measured** model spend and **measured** upstream request counts recorded against §6.3's envelope (measurement is the criterion; matching the estimate is not).
7. A corporate action (split or dividend) applied correctly to a live position — synthetic if none occurs naturally; plus one synthetic **news-shaped gap passing through** and one **ratio-shaped gap** entering symbol-level suspected-CA (I7).
8. **Batch turnaround measured against session windows (I9):** observed submit→result latency distribution recorded for every batch day; the executed-vs-submitted ratio across the run must exceed `MANDATE_LIVENESS_FLOOR`, and at least one injected late batch must reach `expired` with the book returning to submit-eligibility (I1).
9. **Agency record (I10):** every acceptance dailyRow carries a correct `agencyState`, including one forced `exit_only` day (injected quarantine) during which a SELL executes and a BUY is blocked, and the tenure summary aggregates the states.
10. Zero-gap criterion (#3) amended per I17: escape-replacement books owe a `partial:true` creation-day row and full rows thereafter.

Red anywhere = not done. Every dark-inert assertion added here is treated as a potential production incident when it later reddens.

---

## 10. Risks

1. **Season fork drift** — forked mutation math diverges from dormant season code. Mitigated by O-9 retirement direction.
2. **Per-book market fetching regression** — largest scaling risk; works in dark testing, breaks at scale. Mitigated by the §3.0 sole-importer test; treat failure as a production incident.
3. **Vintage store staleness** — if the publish step is skipped, rollover re-pins to an unchanged vintage silently. Mitigated by publishing on build and asserting the current composition hash resolves to an existing doc.
4. **Two-slot commitment** — 39/40, tournament reserve knowingly spent.
5. **WebSocket temptation** — Vercel's beta is instance-pinned and duration-capped; wrong shape for upstream feeds. Bookmarked for Spec 3/4 client-facing use.
6. **Fail-open inheritance** — Q1 found a dormant, fail-open guard presented as an enforcement surface. Standing lesson, as revised by I2: gates on the money path fail closed **for entries and for acting on bad data**, and never suppress exits on fresh data.
7. **Batch turnaround (I9 — the named top risk):** every §3.3 safety mechanism works by discarding what misses the session window; if turnaround routinely exceeds it, books stop trading while looking healthy. Mitigations are structural (liveness metric, streak alerts, expiry-to-eligibility) and measured (acceptance #8). Direct transport remains a fully supported fallback; launching on direct at higher per-eval cost is an acceptable trade if P5 measurement disappoints.

---

## 11. Micro-Verification — RESOLVED

The read-only verification (`docs/audits/MICRO_VERIFICATION_CONTRACTS_V1.md`) answered all six questions; every forced amendment is applied in this version (§0.5). The original questions are retained below for the audit trail; answers in one line each:

- **Q1** `checkSectorCap`: private, tiered-battle-coupled, fail-open, dormant — **not reusable**; own cap built (O-5 revised).
- **Q2** Registry: current-only resolution; hash excludes prompt-rendering logic and `calibrationBundleVersion` — vintage payload made complete; template version stamped on receipts (§5.1).
- **Q3** Lease: timestamp-only, real stale-writer race, 120s<300s — own owner-token lease; correctness carried by revision-preconditioned transactions (§3.1).
- **Q4** Season math: average-cost confirmed, null-on-degenerate confirmed, atomic caller write confirmed; unclamped TRIM over-sell and proceeds-based trade stats **not inherited** (§4.1).
- **Q5** EODHD: 5 fetches/stock cold, no true batch except quotes, no bid/ask/avg-volume, no corporate-action feed, no quota accounting — two-layer snapshot, spread proxy, CA fetcher, call counter (§3.0, §4.1, §4.3).
- **Q6** Active-cap: transactional but count-based; same-doc claim (`reserveSymbol`) adopted as the uniqueness pattern (§5.2).

Original questions (audit trail):

1. **`agentGuardrails.checkSectorCap`** — exact signature, required input shape, return semantics. Does it assume battle portfolio shape, tier/slot data, or any battle-only invariant? If yes, call-only reuse is unsafe and the book needs its own cap implementation (O-5 changes).
2. **`archetypeRegistry.getArchetypeDefinition()` / `computeIdentityHash`** — is there any historical version resolution, and exactly which behavior-bearing bytes does the hash cover? Confirms §5.1's content-addressing is complete rather than partial.
3. **`evaluatingAt` lease** — does it include an owner token / stale-writer fencing, or is it timestamp-only? Determines whether §3.1 reuses or builds the lock.
4. **Season execution/risk helpers** — verified behavior of `recalculatePortfolio` on partial sells, cost-basis handling, rounding, and price conventions; and the exact `computeSharpe`/drawdown input contract. Determines how much of §4.1 is fork vs rewrite.
5. **EODHD helper call counts and payload fields** — how many upstream requests per symbol do the R10 helpers actually make, and do responses include bid/ask and market-cap fields needed by the friction model (F20)? Determines both the §3.0 scaling claim and whether §4.1's spread term is computable without a second source. Also: does the account's corporate-actions data cover splits/dividends/ticker changes (§4.3)?

Additionally: **R26's active-cap mechanism** — is it query-then-create (not race-safe) or transactional? §5.2 assumes a transactional claim is required.

---

## 12. Adversarial Findings Disposition

| Finding | Disposition |
|---|---|
| F1, F2, F3 | **Accepted** → §3.3 submission envelope, deterministic IDs, harvest validation, last-tick rule |
| F4 | **Accepted** → §3.6 daily close pass |
| F5, F6, F7 | **Accepted** → §3.5, §5.3, §5.4 atomic boundaries |
| F8 | **Accepted, confirmed by discovery** (registry composes current only) → §5.1 content-addressed vintage store |
| F9 | **Accepted** → §3.4 exit lane + bootstrap ramp |
| F10 | **Accepted** → §9 P2 owns snapshot; §3.1 tick order |
| F11 | **Accepted** → §3.0 per-symbol completeness |
| F12 | **Partially accepted.** The "flat in users" property holds *once* F16's universe restriction exists (holdings ⊆ bounded universe). Accepted as a specification obligation: bounds now stated (§3.0) and the claim restated with them. Rejected as a refutation of the scaling property itself. |
| F13 | **Accepted** (FR-4) → §4.3 |
| F14 | **Accepted** → §4.1, incl. single-point friction entry |
| F15 | **Accepted** (FR-2) → dual-lens HWM/drawdown, tenure-scoped scoring |
| F16 | **Accepted** → §3.0 eligible trade universe + §3.4 gate 1 |
| F17–F27, F29–F34 | **Accepted** → see §0.4 mapping |
| F28 | **Accepted with a founder ruling that supersedes both options offered** → FR-1/FR-2/FR-3: capital carries forward at rollover (rotation must never cost capital); escape hatch voids the quarter and resets to $100K; scoring is tenure-scoped so histories never blend |
| F35–F38 | **Accepted as blocking prerequisites** → §11 micro-verification (now resolved) |

---

## 13. Micro-Verification Disposition (V1.3)

| Q | Verdict vs V1.2 assumption | Action taken |
|---|---|---|
| Q1 | **Broke O-5** (call-only reuse unsafe: fail-open on flat maps) | Own `mandateSectorCap.js`, fail-closed doctrine adopted spec-wide |
| Q2 | **Partially broke §5.1** (live hash incomplete for pinning) | Vintage hash computed over complete payload incl. all version constants; platform template versioned via receipts |
| Q3 | **Confirmed the contingency** V1.2 already carried | Own owner-token lease; correctness anchored in §3.5 revision preconditions |
| Q4 | **Confirmed §4.1/§4.2**, surfaced two fork hazards | Quantity clamps added; `computeTradeStats` excluded from the fork |
| Q5 | **Broke §3.0 as written** (per-tick enrichment 5×/symbol) and §4.1's spread input | Two-layer snapshot; `spreadProxyBps`; CA fetcher; upstream call counter |
| Q6 | **Confirmed §5.2's design** and named its reference implementation | `reserveSymbol` cited as the pattern of record |

---

## 14. Fable Invariant Review Disposition (V1.4)

| Finding | Severity | Disposition |
|---|---|---|
| I1 open-batch disposition | BLOCKER | **Accepted** → §3.3 terminal-state contract; §5.3/§5.4 in-transaction disposal; §6.4 auto-expiry |
| I2 fail-closed vs C-21 | BLOCKER | **Accepted** → per-symbol freshness (§3.0), exit-only quarantine (§6.4), doctrine rewritten (§3.4, Risks 6) |
| I3 price basis | MAJOR | **Accepted** → harvest-tick basis + dual tick keys + drift guard (§3.3) |
| I4 tenure attribution | MAJOR | **Accepted** → session-edge boundaries; row tags as source of truth (§5.3) |
| I5 vintage narrowing | MAJOR | **Accepted via FR-6** → model + gates inside the pin; boundary enumerated; break-glass (§5.1) |
| I6 valuation discipline | MAJOR | **Accepted** → close pass sole peak writer; single-tick re-mark in execution; partial-row exclusion (§3.5, §3.6, §4.2) |
| I7 gap detector | MAJOR | **Accepted** → CA cross-check; ratio-shape symbol quarantine; news gaps pass (§4.3) |
| I8 influence gate | MAJOR | **Accepted** → test-enforced allowlist; `influenceStateRef` null-in-V1 (§3.2, §2.2, FR-7) |
| I9 batch liveness | MAJOR | **Accepted** → liveness metric + alerts (§3.3, §6.4); acceptance #8; promoted to named top risk |
| I10 agency record | MAJOR | **Accepted** → `agencyState` on every row; tenure aggregation (§2.2, §3.6) |
| I11 universe starvation | MINOR | **Accepted** → candidate-capacity floor + alert (§3.0) |
| I12 fence-fork provenance | QUESTION | **Answered + accepted** → season math verified non-fenced; fork ledger; sector-cap divergence documented, revisit Spec 4 (§8) |
| I13 retention | MINOR | **Accepted** → 120 days (§3.7) |
| I14 stream durability | MINOR | **Accepted** → pending-append marker (§3.6) |
| I15 FR-1 teeth | MINOR | **Accepted** → transaction assertion (§5.3) |
| I16 bandwidth | MINOR | **Accepted** → named deliberate V1 decision; scoring acknowledgment (§3.4) |
| I17 creation rows | MINOR | **Accepted** → creation-day partial row rule (§3.6); acceptance #10 |

**Fable's meta-findings on prior reviews:** all three accepted — F3's liveness cost now priced and measured (I9); Q1's fail-closed over-generalization corrected (I2); F12's missing floor added (I11); the price-basis gap in the micro-verification closed in-spec (I3); F15's second HWM writer removed (I6).
