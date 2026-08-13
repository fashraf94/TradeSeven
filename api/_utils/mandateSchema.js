// api/_utils/mandateSchema.js
//
// Spec 1 — Mandate Substrate — the record shapes (§2.1 mandate doc, §2.2
// subcollections) and the identity/key derivations. Node-clean, pure (no
// Firestore I/O — builders return plain objects; the creation service and the
// close/rollover passes do the writing).
//
// Phase 1 obligation (kickoff item 1–2): the mandate doc carries EVERY block —
// health, execState, costTelemetry, dormancy, scoring, dual-lens HWM/drawdown —
// present in the shape even where later phases populate them; and the four
// subcollection shapes are DEFINED here (Phases 2–4 write them).
//
// Enums are the field contracts the later phases bind to (I1 terminal states,
// I10 agency states, FR-4 corporate-action types).

import { createHash } from 'node:crypto';
import {
  MANDATE_SCHEMA_VERSION,
  MANDATE_STARTING_CAPITAL,
  MANDATE_DECISION_VERBS,
} from './mandateConfig.js';

// ── Enums / contracts ────────────────────────────────────────────────────────

/** §3.3 / I1 — the six terminal states; exactly one per submission. */
export const DECISION_STATUSES = Object.freeze([
  'executed', 'rejected_stale', 'gated', 'failed', 'cancelled', 'expired',
]);

/** §2.2 / I10 — per-session agency; `skipped:<reason>` is a family, checked by prefix. */
export const AGENCY_STATES = Object.freeze(['full', 'exit_only', 'frozen']);
export function isValidAgencyState(v) {
  return typeof v === 'string' && (AGENCY_STATES.includes(v) || v.startsWith('skipped:'));
}

/** §4.3 / FR-4 — corporate-action V1 scope. */
export const CORPORATE_ACTION_TYPES = Object.freeze([
  'split', 'reverse_split', 'cash_dividend', 'stock_distribution', 'ticker_change', 'delisting',
]);

export const MANDATE_STATUSES = Object.freeze(['active', 'closed']);

// Re-export the decision verb set so decision-shape consumers have one import.
export const DECISION_VERBS = MANDATE_DECISION_VERBS;

// ── Identity / keys ──────────────────────────────────────────────────────────

/**
 * managerAgentId — STABLE per user × archetype (FR-7 / D-46.3): re-hiring an
 * archetype must resume the SAME manager, so the id is a pure deterministic
 * function of (userId, archetype), never a fresh id per mandate. Distinct
 * namespace from the arena agentId (D-7): the `mgr_` prefix keeps a mandate
 * manager from ever colliding with a battle agent id. The userId is hashed, not
 * embedded in the clear.
 */
export function deriveManagerAgentId(userId, archetype) {
  if (!userId || !archetype) throw new Error('deriveManagerAgentId: userId and archetype required');
  const h = createHash('sha256').update(`${userId}::${archetype}`, 'utf8').digest('hex').slice(0, 16);
  return `mgr_${archetype}_${h}`;
}

/** quarterKey — deterministic (§2.1 / F7): `${mandateId}:${quarterIndex}`. */
export function buildQuarterKey(mandateId, quarterIndex) {
  return `${mandateId}:${quarterIndex}`;
}

// ── Mandate-doc block factories (§2.1) ───────────────────────────────────────
// Each block is present at creation with its blocks-present-but-later-populated
// fields defaulted. Dual-lens HWM/drawdown initialize to the starting value /
// zero — this is INITIALIZATION, not a peak-write; the close pass remains the
// sole peak writer thereafter (I6).

export function buildPortfolioBlock(startingCapital = MANDATE_STARTING_CAPITAL) {
  return {
    cash: startingCapital,
    positions: {}, // { TICKER: { shares, costBasisTotal, avgCost, lastMark, lastMarkAsOf, lastMarkSource, sector } }
    totalValue: startingCapital,
    initialValue: startingCapital,
    sectorWeights: {},
    // F15 — lifetime lens (never reset)
    lifetimeHighWaterMark: startingCapital,
    lifetimeDrawdownFromPeak: 0,
    // F15 — tenure lens (reset at rollover, §5.3)
    quarterHighWaterMark: startingCapital,
    quarterDrawdownFromPeak: 0,
  };
}

/** FR-2 — tenure-scoped primary. Null metrics until P3 computes them (§4.2 warmup: null, never 0/NaN). */
export function buildScoringBlock() {
  return { quarter: null, lifetime: null, asOf: null };
}

/** §6.4 / F25 — persisted failure state. */
export function buildHealthBlock() {
  return {
    consecutiveEvalFailures: 0,
    lastSuccessfulEvalAt: null, // SUCCESS record only (agencyState 'full' evidence) — not a sweep key
    lastEvalSweepAt: null, // eval sweep ORDERING KEY — advanced on every processed outcome (P3 review INV-4/C21-1: success-only keys starve the tail)
    lastCloseMarkAt: null, // success record of the last committed close
    lastCloseAttemptAt: null, // close sweep ORDERING KEY — advanced by commits AND failures
    consecutiveCloseFailures: 0, // whole-close failure streak (§6.4 — the missed-session channel, P3 review INV-1)
    missedMarks: 0, // §3.6 / §6.4 — incremented on an un-markable close AND retroactively per fully-missed session
    consecutiveMissedMarks: 0, // §6.4 — alert at MANDATE_MISSED_MARKS_ALERT consecutive missed close marks (P3)
    quarantined: false,
  };
}

/** §6.5 — dormancy plumbing (Spec 3 wires touches; trading/close never downshift). */
export function buildDormancyBlock() {
  return { lastUserActivityAt: null, downshifted: false };
}

/** §6.2 — cost telemetry, accumulated per book. */
export function buildCostTelemetryBlock() {
  return { tokensIn: 0, tokensOut: 0, estUsd: 0, monthKey: null };
}

/** §3.3 / I1 / I9 — execution/liveness state. openBatchId gates submission. */
export function buildExecStateBlock() {
  return {
    // The OPEN-SUBMISSION gate (§3.3). House convention (P3 expiry, P4
    // rollover/escape cancels, P5 batch transport): openBatchId holds the open
    // submission's deterministic REQUEST id — which is also its decisionId, so
    // every disposal path writes decisions/{openBatchId}. The provider-side
    // Anthropic batch id is the separate field below (P5): one provider batch
    // carries many books' requests, so it is bookkept platform-side
    // (mandateBatches/{providerBatchId}) and mirrored here for drain/ops.
    openBatchId: null,
    openBatchSubmittedAt: null,
    openProviderBatchId: null,
    lastProcessedRolloverKey: null,
    lastCloseKey: null,
    // I9 liveness counters (executedVsSubmitted); populated by the exec path (P2+).
    submitted: 0,
    executed: 0,
    // I9 (P3): consecutive rejected_stale/expired submissions — THE liveness
    // wire (founder ruling: HOLD-only is healthy, the ratio is secondary).
    staleRejectStreak: 0,
    // Within-slot idempotency stamp for UNBILLED sweep skips (tier-ineligible,
    // missing vintage) — parallel to execState.lastEvalTickKey, which only
    // attempts write (P3 review INV-4: unstamped skips re-processed every fire).
    lastSweepTickKey: null,
  };
}

/**
 * The dotted-leaf patch that clears the WHOLE open-submission gate block (I1).
 * P5 single source of truth: every terminal transition that releases the gate
 * (execution, harvest disposition, close-pass expiry, rollover/escape cancel,
 * drain) spreads THIS — so a new gate field can never be cleared at one site
 * and leak at another.
 */
export function clearedOpenSubmissionPatch() {
  return {
    'execState.openBatchId': null,
    'execState.openBatchSubmittedAt': null,
    'execState.openProviderBatchId': null,
  };
}

/**
 * The full mandate doc at creation (§2.1). `revision:0`, `status:'active'`,
 * `voided:false`. Timestamps are JS Dates (Admin SDK → Firestore Timestamp;
 * the status+nextRolloverAt range query in §5.3 needs a Timestamp, not a
 * string). `quarterIndex:1`; `quarterKey` derived. Every §2.1 block present.
 */
export function buildNewMandateDoc({
  mandateId,
  userId,
  archetype,
  managerAgentId,
  vintageRef,
  cadenceTier,
  createdAt,
  quarterStartAt,
  nextRolloverAt,
  escapeHatchEligibleUntil,
  startingCapital = MANDATE_STARTING_CAPITAL,
}) {
  if (!mandateId || !userId || !archetype || !managerAgentId || !vintageRef) {
    throw new Error('buildNewMandateDoc: mandateId, userId, archetype, managerAgentId, vintageRef required');
  }
  return {
    schemaVersion: MANDATE_SCHEMA_VERSION,
    userId,
    status: 'active',
    voided: false, // FR-3: only escape-hatch books flip this
    revision: 0, // §5.2 — the correctness backbone; every mutating txn increments it (F1)
    archetype,
    managerAgentId,
    vintageRef,
    quarterIndex: 1,
    quarterKey: buildQuarterKey(mandateId, 1),
    createdAt,
    quarterStartAt,
    nextRolloverAt,
    cadenceTier,
    escapeHatchEligibleUntil, // first book only; createdAt + 14d
    portfolio: buildPortfolioBlock(startingCapital),
    scoring: buildScoringBlock(),
    health: buildHealthBlock(),
    dormancy: buildDormancyBlock(),
    costTelemetry: buildCostTelemetryBlock(),
    execState: buildExecStateBlock(),
  };
}

// ── Subcollection shape definitions (§2.2) ───────────────────────────────────
// Phase 1 DEFINES these; Phases 2–4 WRITE them. Each factory returns the
// canonical shape with the §2.2 field set present (defaulted/null), carrying
// `schemaVersion`. They are the contract later phases populate — no Phase-1 code
// writes a subcollection doc.

/**
 * dailyRows/{YYYY-MM-DD} — written by the daily close pass (§3.6), never by an
 * eval tick. `quarterIndex` makes tenure-scoping a query (FR-2). `agencyState`
 * records whether the manager could act (I10). `partial:true` on carry-over /
 * creation-day rows (I17).
 *
 * P3 additions (first writer — no row was ever written before the close pass
 * existed, so the shape stays schemaVersion 1): dividend income (§4.3 — income,
 * not trading P&L), the day/cumulative friction figures that let gross be
 * reconstructed as net + Σ friction (F14, single-direction), the cumulative
 * liveness counters snapshotted for the I9 trailing-window ratio, and
 * `degradedMarks` (any carry-over mark among today's position marks, I6).
 */
export function buildDailyRow({ date, quarterIndex, ...rest } = {}) {
  return {
    schemaVersion: MANDATE_SCHEMA_VERSION,
    date: date ?? null,
    totalValue: rest.totalValue ?? null,
    dayReturnPct: rest.dayReturnPct ?? null, // null when no prior row exists (never a fabricated multi-day figure)
    quarterDrawdown: rest.quarterDrawdown ?? null,
    regime: rest.regime ?? 'unknown', // §6.1 — never a silently stale label
    regimeAsOf: rest.regimeAsOf ?? null,
    regimeSource: rest.regimeSource ?? null,
    markSource: rest.markSource ?? null,
    agencyState: rest.agencyState ?? null, // full | exit_only | frozen | skipped:<reason>
    evalCount: rest.evalCount ?? 0,
    tokensIn: rest.tokensIn ?? 0,
    tokensOut: rest.tokensOut ?? 0,
    estUsd: rest.estUsd ?? 0,
    cacheHitTokens: rest.cacheHitTokens ?? 0, // §6.3 — cache reads (the D-20 stacking measurement)
    cacheWriteTokens: rest.cacheWriteTokens ?? 0, // §6.3 (P5) — cache writes; hit rate needs both sides
    unpricedCalls: rest.unpricedCalls ?? 0, // §6.2 (P5) — calls whose estUsd degraded to null (unknown model id); alerted at close
    quarterIndex: quarterIndex ?? null,
    partial: rest.partial ?? false, // I17 / §3.6 — creation-day & carry-over rows
    degradedMarks: rest.degradedMarks ?? false, // I6 — any carry-over mark in today's marking
    // RETURN-QUALITY LABELS (P3 review): dayReturnPct is a DAY return only when
    // sessionsSpanned === 1 and its baseline was a fresh mark. A row whose
    // previous close never happened (sessionsSpanned > 1), or whose baseline
    // row carried degraded marks (returnBaseDegraded), keeps its factual
    // number but is EXCLUDED from variance metrics — labeled-degraded, never
    // silently blended (I11/F19). null = no prior row (first close).
    sessionsSpanned: rest.sessionsSpanned ?? null,
    returnBaseDegraded: rest.returnBaseDegraded ?? false,
    dividendIncomeUsd: rest.dividendIncomeUsd ?? 0, // §4.3 — income, not trading P&L
    dayFrictionPaid: rest.dayFrictionPaid ?? null, // F14 — gross = net + this, never subtracted twice; null on the first row (no window)
    frictionPaidCum: rest.frictionPaidCum ?? 0,
    submittedCum: rest.submittedCum ?? 0, // I9 — trailing-window liveness inputs
    executedCum: rest.executedCum ?? 0,
  };
}

/**
 * decisions/{decisionId} — deterministic id (§3.3). One terminal `status` per
 * submission (I1). `priceBasis:'harvest_tick'` (I3). `influenceStateRef` is
 * PROVABLY NULL in V1 (FR-7 / I8). Friction breakdown carries its model version.
 */
export function buildDecision({ decisionId, verb, ticker, ...rest } = {}) {
  return {
    schemaVersion: MANDATE_SCHEMA_VERSION,
    decisionId: decisionId ?? null,
    verb: verb ?? null, // one of DECISION_VERBS
    ticker: ticker ?? null,
    requestedSizeUsd: rest.requestedSizeUsd ?? null,
    executedSizeUsd: rest.executedSizeUsd ?? null,
    executedShares: rest.executedShares ?? null, // §4.1 — the derived share quantity filled
    executedPrice: rest.executedPrice ?? null,
    realizedPnl: rest.realizedPnl ?? null, // §4.1 — proceedsNet − Δbasis on a SELL/TRIM; needs the historical basis at sale time, so it is recorded here (unrecoverable otherwise)
    priceBasis: 'harvest_tick', // I3
    // Which mark QUALITY the fill executed at (founder rider, Phase 2 close-out):
    // 'fresh' = the tick snapshot; 'carry_over' = a held symbol's last-good mark
    // when frozen (§4.3, exits only); 'basis' = average cost fallback. P3 scoring /
    // narration must be able to tell a degraded fill from a fresh one. null = no fill.
    fillMarkQuality: rest.fillMarkQuality ?? null,
    clamped: rest.clamped ?? false, // §4.1 — SELL/TRIM clamped to held shares
    friction: rest.friction ?? null, // { slippageBps, spreadProxyBps, spreadBasis:'proxy', frictionPaid, frictionBasis:'idealized_no_market_impact' }
    frictionModelVersion: rest.frictionModelVersion ?? null,
    gateOutcome: rest.gateOutcome ?? null, // { rule, passed } — the specific rule that fired
    // §3.3 "with the failing condition recorded" — the terminal condition that
    // produced a non-executed status (base_revision, cross_session, result_age,
    // price_drift, api_error:*, drained_transport_change, …). P2 carried it on
    // return values only; P5 makes it DURABLE on the doc, because under batch
    // transport the submit context is gone by harvest time and the receipt is
    // the only record. Additive at schemaVersion 1 (the P3/P4 row precedent).
    failCondition: rest.failCondition ?? null,
    vintageRef: rest.vintageRef ?? null,
    baseRevision: rest.baseRevision ?? null,
    submitTickKey: rest.submitTickKey ?? null, // I3
    harvestTickKey: rest.harvestTickKey ?? null, // I3
    // P5 (refuter, MONEY-P5-7): true when the harvest ran against the empty
    // degraded context of a failed-snapshot tick — the tickKey's snapshot doc
    // either does not exist or was written LATER by a luckier fire, so replay
    // audits must not price this receipt against it. Additive at v1.
    harvestSnapshotDegraded: rest.harvestSnapshotDegraded ?? false,
    mandatePromptTemplateVersion: rest.mandatePromptTemplateVersion ?? null,
    influenceStateRef: null, // FR-7 / I8 — provably null in V1
    status: rest.status ?? null, // one of DECISION_STATUSES
  };
}

/**
 * quarterSummaries/{quarterIndex} — the tenure record (FR-2). `scoring:false`
 * when the quarter is voided (FR-3). `empty:true` for a catch-up quarter whose
 * row range is empty rather than fabricated (§5.3 / F21).
 */
export function buildQuarterSummary({ quarterIndex, archetype, vintageRef, ...rest } = {}) {
  return {
    schemaVersion: MANDATE_SCHEMA_VERSION,
    quarterIndex: quarterIndex ?? null,
    archetype: archetype ?? null,
    vintageRef: vintageRef ?? null,
    quarterStartAt: rest.quarterStartAt ?? null,
    quarterEndAt: rest.quarterEndAt ?? null,
    openingValue: rest.openingValue ?? null,
    closingValue: rest.closingValue ?? null,
    tenureReturn: rest.tenureReturn ?? null,
    riskMetrics: rest.riskMetrics ?? null, // tenure-scoped (§4.2)
    regimeMix: rest.regimeMix ?? null,
    // I10 (§2.2): sessions by agencyState — so a tenure charged with drawdown
    // can show WHEN the manager could act vs. was administratively frozen.
    agencyStateMix: rest.agencyStateMix ?? null,
    // §4.3 term totals — the rows carry both (income is not trading P&L).
    frictionTotalUsd: rest.frictionTotalUsd ?? 0,
    dividendIncomeTotalUsd: rest.dividendIncomeTotalUsd ?? 0,
    scoring: rest.scoring ?? true, // false when voided (FR-3)
    empty: rest.empty ?? false, // §5.3 catch-up
  };
}

/**
 * corporateActions/{actionId} — applied action log (§4.3), idempotency-keyed on
 * {mandateId, actionId}. Written in the close pass before marking (P3).
 */
export function buildCorporateAction({ actionId, type, ticker, ...rest } = {}) {
  return {
    schemaVersion: MANDATE_SCHEMA_VERSION,
    actionId: actionId ?? null,
    type: type ?? null, // one of CORPORATE_ACTION_TYPES
    ticker: ticker ?? null,
    ratio: rest.ratio ?? null, // split / reverse-split
    amount: rest.amount ?? null, // cash dividend per share
    renamedTo: rest.renamedTo ?? null, // ticker change
    appliedAt: rest.appliedAt ?? null,
    source: rest.source ?? null,
    // Entitlement claims (P3 review): applied:false docs are durable "seen and
    // DECLINED, because <reason>" records — they hold the same idempotency key
    // so the close pass never re-examines (or re-alerts) the action for this
    // book. reason ∈ {not_entitled, no_entitlement_data} today.
    applied: rest.applied ?? true,
    reason: rest.reason ?? null,
  };
}
