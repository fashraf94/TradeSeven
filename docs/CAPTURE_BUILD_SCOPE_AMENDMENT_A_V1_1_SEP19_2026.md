# Capture build — Scope Amendment A (V1.1)

**Arc:** BaggerBomb Command Center · **Author:** Fable · **Date:** 2026-09-19 · **Supersedes:** V1 (same date)
**Status:** proposed, approve-by-default
**Source:** Astra discovery `docs/audits/20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY.md`; adjudication V1.1; Astra's second-opinion review of V1.
**Changes from V1:** A-1 defines shared identity and a durable per-tick record (the caps become projections, not "display caps" by assertion); A-2 captures the dispatched request and the raw response together at the transport boundary, form (b) dropped; A-3 becomes pair-wise and two-tier, with computation assigned to the guardrail owner; A-4 becomes a tick-outcome record with separate dimensions, reconciled with P-6 and A-6; A-5 stores the control snapshot inline and assigns reader work to existing owners; A-7 gets initialization, idempotency and reconciliation; A-8 tests the whole snapshot; privacy tested on serialized payloads; retention stated as policy with a named dependency; §3 narrowed; §7 acceptance points at D5.
**Governs:** the capture-build spec when it is written; merges into an existing spec as a numbered section with a version bump.

---

## 0. In plain terms

The capture build already records, for every check the agent makes, whether its exits were armed, where its exit levels sat, and one score every screen agrees on. This amendment adds what the audit showed we cannot reconstruct: exactly what the agent was sent and what it said back, which swaps it could legally have made, why a tick produced no check or a check failed, and ids that never repeat and always join. These records feed the Film Room, the first Jev experiment, and agent learning.

Nothing here changes what the agent sees or how it decides. That is the parity change, separate and fenced.

---

## 1. Base scope (ledger, Sep 17)

- Armed state per check; exit levels per held position per check.
- One score source under `scoreState`; readers derive, never recompute.
- The directive card shows the player's text and the canonical text as two things.
- This arc writes the records; the Film Room chat builds the readers.

---

## 2. Additions

### A-1 Identity and the durable record
- **`tickId`** is minted once per admitted tick at lease acquisition: `${battleId}:${tickSeq}`, with `tickSeq` a monotonic counter on the battle document incremented in the lease transaction. A retried or overlapping invocation that does not hold the lease mints nothing.
- **`checkId = tickId`** when a model check is attempted. **`actionId = ${tickId}:${n}`** for each action executed in that tick (forced exits, model swap, meeting-approved swaps), `n` in execution order.
- **The durable per-tick record** is one document per admitted tick in a subcollection (`battles/{battleId}/ticks/{tickId}`), holding: the tick-outcome fields (A-4), the check capture (A-2) when attempted, the alternatives (A-3), the control snapshot (A-5), the call envelope (A-6), and an `actions[]` array embedding each executed action's identifying fields (`actionId`, kind, outgoing, incoming, slot, execution price, executedAt, source, reason). This record is the uncapped backing store. `battle.evaluations` (150) and `battle.trades` (50) become projections of it.
- **Joins.** Tape, Film Room, receipts and exports join by `tickId` / `actionId`. Until the executor fence entry (A-7) adds `actionId` to `battle.trades` entries, the legacy join for capped trade entries is `(battleId, executedAt, outgoing, incoming)`; readers label such joins `legacy`.
- **Retries.** Ids are stable for the same logical event because they are minted once under the lease; the swap executor's existing self/duplicate rejection stays the guard against double execution.
- **Migration.** Pre-amendment records have no ids; readers treat them as `legacy, not joinable`.

### A-2 Exact request and response per model check
- **Capture at the transport boundary.** The serialized request body as dispatched (`api/_utils/agentEvalTransport.js` or its caller) and the raw response body as received are written to the tick record, with a SHA-256 of each. If the transport mutates messages or tool definitions after the handler's `promptBuilt` point, the dispatched form is the one captured; a build test asserts the captured bytes equal the dispatched bytes on fixtures.
- **Form (b) (re-render from inputs) is dropped.** Live reads and time-dependent values make re-rendering unprovable.
- **The response is part of the evidence.** The raw tool result (decision, pair, conviction, hypothesis, rationale, claims, citations) is stored beside the request so the original claim survives the 150-entry evaluations cap. This is the pairing D5's three arms require.
- **Shown-evidence manifest** beside the request: one row per rendered field — `sourceId`, `field`, `valueAsRendered`, `asOf`, `availability ∈ {known, unknown, stale, not_rendered}`. Snapshot fields not rendered are `not_rendered` and can never be promoted to "seen".
- **Storage.** Per-tick documents (A-1), not the battle document. Phase 0 sizes them (Q2).
- **Retention (policy, not mechanism).** Proposed: request and response text kept for the battle's lifetime plus 90 days, manifest kept indefinitely. Enforcement is a named later hygiene task; until it exists, nothing is deleted and this is stated on the record schema.
- **Privacy, tested on payloads.** A build test seeds a fixture player message with a sentinel string, runs a directive turn and an eval tick, and asserts the sentinel appears in no captured request, response or manifest field. Canonical-menu and agent-authored text are not assumed safe by authorship. Any sanitized export is a separate artifact that records what it removed; the captured original is never edited.
- **HOLDs included.** A model check returning HOLD is captured identically to one returning SWAP.

### A-3 Eligible alternatives at decision (pair-wise, two tiers)
- Eligibility is a property of an `(outgoing, incoming)` pair, not of a bench stock. The record lists pairs plus `HOLD`, each with `eligible` and, when false, the excluding reason (`asset_class`, `cooldown`, `active_holding`, `distressed_veto`, `locked_outgoing`, `no_quote`, `tempo_cap`, `hurdle`, other), and the `stateVersion` (the tick's `tickId` plus the portfolio revision) the evaluation used.
- **Tier 1 (this build):** the validation result of the pair the model proposed, as computed today, plus the cheap per-name predicates already computed for the bench (cooldown, active holding, asset class, known-distressed), with `completeness: 'partial'`.
- **Tier 2 (J2 prerequisite):** full enumeration of every held × eligible-bench pair through the existing validator. This is new decision-side logic; it is owned by the guardrail/executor owner (fenced) and scheduled with J2, not with this build. Capture persists whatever tier is available and labels it.
- The V1 claim that the full set "is in memory at S9/S10 today" is withdrawn; Phase 0 Q3 establishes what is computed today.

### A-4 Tick-outcome record
Every admitted tick writes these dimensions, whether or not a model check ran:
- `checkAttempted` (bool) · `stageReached ∈ {S5, S6, S7, S8, S9, S10, S11, S12}` · `failureReason ∈ {none, no_trigger, budget_skipped, quote_unusable, lease_held, deferred, prompt_build_timeout, model_timeout, invalid_tool_result, guardrail_error}` · `proposedDecision` (the model's, if any) · `executedActions[]` (A-1) · `holdKind ∈ {chosen, default_no_check, default_failure, n/a}`.
- A forced exit in S7 followed by a skipped or failed model call retains the forced exit in `executedActions` and records the skip or failure separately. Readers render `default_no_check` as "no check this tick", `default_failure` as "check failed, held by default", and never either as a chosen HOLD.
- The capture build owns the vocabulary and writes at every existing return site in the handler (Phase 0 Q4). The eval-cron scaling arc's deferred-beat PR writes only `deferred`.
- P-6's Opus tasks use the existing failure-category field of the evaluation record for `guardrail_error` and `invalid_tool_result` now; this build normalizes those values into `failureReason` without renaming them.

### A-5 Frozen controls on the record
- On every admitted tick: the directive's id, version and **canonical text inline** (a sentence; a hash alone cannot recover historical text), the control epoch, `equippedConfigHash`, and the resolved lean set as rendered.
- Consumers: the Film Room and directive card read these fields (Film Room chat owns that change); the J1 export reads them; trade narration is retired by the grounding walk and gets no reader work.

### A-6 Model-call envelope
- Requested model id, returned model id, temperature, output ceiling, request and response hashes (A-2), `buildMs`, `callMs`, `timeoutKind`, and the tool-validation outcome (`valid`, `invalid_shape`, `missing_conviction`, `unknown_symbol`, `parse_error`, with the failing field).
- Written even when validation fails, so a P-6 fallback HOLD is distinguishable from a chosen HOLD (A-4 `holdKind`).

### A-7 Cumulative locked points independent of the trades array
- `scoreState.lockedPointsTotal` and `scoreState.lastAppliedActionId`.
- **Commit rule.** The executor increments `lockedPointsTotal` in the same Firestore transaction that appends the trade, keyed by `actionId`; if `lastAppliedActionId` already equals this `actionId`, the transaction applies nothing. One rule covers close, retry and overlap.
- **Initialization.** On first read of a battle lacking the field, seed from the sum of retained `battle.trades` locked points and stamp `lockedPointsSeededFrom: 'retained_trades'` with the count summed. If Phase 0 Q8 finds any battle whose trade count ever exceeded 50, that battle is stamped `lockedPointsIncomplete: true` and the Film Room shows the total as incomplete; no back-fill is invented.
- **Reconciliation.** A read-only script compares `lockedPointsTotal` to the retained-trades sum for every battle under the cap and reports drift; drift is a bug, never auto-corrected.
- Fenced (`agentSwapExecution.js`; the tick-sum site in the handler). Rides the single-score-source fence entry; no separate priority.

### A-8 Coherence precondition
- The capture records the state actually shown, so P-3 (Opus T1) lands before or with this build.
- Build test: on a tick with a forced swap first and on a tick without one, the captured held set, per-asset scores, header totals, prices and position metadata equal the battle's state at request dispatch, component by component. Totals are never compared in place of components.

---

## 3. Readers this build must not break and must enable

- Film Room (Phase 4 of this arc): headline from `scoreState`; tape and receipts joined by A-1 ids; directive card from A-5.
- J1 experiment export: a read-only script writing per-tick records (A-2 request, response and manifest; A-3; A-5; A-6) to local JSONL for a date range; no Firestore writes; runnable from Flash's Windows checkout.
- Scaling instrumentation: per-battle wall time and A-4 `failureReason` roll up per invocation.
- Agent learning Phase B (unbuilt): A-3 and `executedActions` supply **inputs** to a one-step counterfactual. The counterfactual itself needs its own contract (scoring-rule version, price series and timestamps, position state, horizon); that contract belongs to the Learning Charter, not this build.

---

## 4. Out of scope

- Any change to what the model is shown (parity change, fenced).
- Any new indicator, data source or freshness rule (intraday-data arc).
- Tier 2 alternatives enumeration (guardrail owner, with J2).
- Reader changes other than the export script (Film Room chat owns readers; narration is retired, not rebuilt).
- Retention enforcement (named later task; see A-2).

---

## 5. Fence contact

| Item | Contact |
|---|---|
| A-1 tick record, A-4, A-5, A-6, A-8 test | Handler and receipt writers; expected fence-free. Confirm in Phase 0. |
| A-1 `actionId` on capped trade entries | Fenced (`agentSwapExecution.js`); rides the A-7 fence entry. Until then, legacy join. |
| A-2 | Transport-boundary hook; read-only on the assembler. `agentEvalTransport.js` is not on the fence list at this writing; Phase 0 confirms. |
| A-3 Tier 1 | Handler-side, using already-computed predicates. Tier 2 fenced, deferred. |
| A-7 | Fenced; single-score-source fence entry. |

---

## 6. Phase 0 questions for CC (read-only, hard STOP)

1. Where the request is serialized and dispatched; whether anything between `promptBuilt` and dispatch changes model-visible content. Cite lines.
2. Per-tick document size at today's prompt and response length; confirm the battle document cannot host it.
3. Which A-3 predicates are computed today, at which lines, and for which names; whether any pair-wise enumeration exists.
4. Every return site in the handler that ends an admitted tick, for A-4.
5. Where the tick sum reads `battle.trades`; whether `scoreState` has exactly one writer; where the lease is acquired, for `tickSeq`.
6. The complete list of fields that can carry player utterance text, for the sentinel test.
7. Storage and retention cost at 20 concurrent battles and at 200.
8. Read-only production count: the maximum trade count any battle has reached, and the maximum evaluation count, to bound A-7 and A-1.

---

## 7. Acceptance for the J1 experiment

Readiness is checked against the report's D5 contract: 120 original decision contexts, development and held-out days disjoint, battle-level grouping, frozen labels, adequate class counts, and complete request–response pairs. Twelve captured trading days across all six archetypes, with HOLDs and skips, is the milestone at which that check first runs. Until it passes, the experiment stops at fixture feasibility, as its design specifies.
