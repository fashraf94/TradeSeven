// api/_utils/mandateExecution.js
//
// Spec 1 — Mandate Substrate — the ATOMIC EXECUTION BOUNDARY (§3.5) + the
// execution engine (§4.1), forked from season math (I12 fork ledger). Q4
// confirmed the season path's average-cost basis and null-on-degenerate
// handling; this fork EXCLUDES the season Q4 hazards (unclamped TRIM over-sell,
// proceeds-based trade stats) — SELL/TRIM quantities are clamped to held shares
// (§4.1), and realized P&L is basis-correct.
//
// §3.5 — ALL of this happens in ONE Firestore transaction, or none does:
//   read book at baseRevision → verify envelope (harvest validation, §3.3) →
//   re-mark all positions at the harvest tick (one consistent valuation, I6) →
//   mutate cash/positions/costBasisTotal/totalValue/sectorWeights/realized P&L →
//   write decisions/{decisionId} (create-if-absent == the exactly-once claim, F2)
//   → increment revision → clear execState.openBatchId.
// The execution transaction NEVER writes high-water marks or drawdown peaks —
// the close pass is the sole peak writer (I6); intra-day totals inform gates, not
// records. Health.lastSuccessfulEvalAt / consecutiveEvalFailures are the
// handler's concern (§3.1), not this transaction's.
//
// FRICTION (§4.1): P2 executes at the harvest mark with ZERO friction (slippage
// and spread proxy are 0), but every receipt carries the honesty labels
// (spreadBasis:'proxy', frictionBasis:'idealized_no_market_impact', D-15/O-3) and
// the friction model version, so P3 changes VALUES, not shape.

import { buildDecision } from './mandateSchema.js';
import { markBook, avgCostOf } from './mandateValuation.js';
import { markFor } from './mandateUniverseSnapshot.js';
import {
  MANDATE_SHARES_DP,
  MANDATE_USD_DP,
  MANDATE_RESULT_MAX_AGE_MS,
  MANDATE_PRICE_DRIFT_MAX_BPS,
  MANDATE_P2_SLIPPAGE_BPS,
  MANDATE_P2_SPREAD_PROXY_BPS,
  MANDATE_FRICTION_MODEL_VERSION,
  MANDATE_FRICTION_SPREAD_BASIS,
  MANDATE_FRICTION_BASIS,
  MANDATE_VALUE_RECONCILE_TOLERANCE_USD,
  MANDATE_VALUE_CONSERVE_TOLERANCE_USD,
} from './mandateConfig.js';
import { EXIT_VERBS, ENTRY_VERBS } from './mandateDecisionTool.js';

// ── Rounding (§4.1) ──────────────────────────────────────────────────────────

/** Banker's rounding (round half to even) to `dp` decimals. */
export function bankersRound(value, dp) {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** dp;
  const scaled = value * f;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  // Relative half-detection tolerance: at $millions the ULP of `scaled` exceeds a
  // fixed 1e-9, which would drop true half-cents to Math.round (half-up). Scale
  // the tolerance so half-to-even holds at all magnitudes (money-math review M5).
  const halfTol = 1e-9 * Math.max(1, Math.abs(scaled));
  let rounded;
  if (Math.abs(diff - 0.5) < halfTol) rounded = (floor % 2 === 0) ? floor : floor + 1;
  else rounded = Math.round(scaled);
  return rounded / f;
}

const roundUsd = (n) => bankersRound(n, MANDATE_USD_DP);
/** Shares are floored to 6dp so a BUY can never overspend its sized dollars. */
const floorShares = (n) => Math.floor(n * 10 ** MANDATE_SHARES_DP) / 10 ** MANDATE_SHARES_DP;
const roundShares = (n) => bankersRound(n, MANDATE_SHARES_DP);

// ── Friction (§4.1) — zeroed in P2, labeled honestly ─────────────────────────

export function defaultFriction() {
  return { slippageBps: MANDATE_P2_SLIPPAGE_BPS, spreadProxyBps: MANDATE_P2_SPREAD_PROXY_BPS };
}

/** Execution price = mark ± friction (buys pay more, sells receive less). §4.1. */
export function executedPriceFor(verb, mark, { slippageBps, spreadProxyBps }) {
  const adj = (slippageBps + spreadProxyBps) / 10000;
  const isBuySide = ENTRY_VERBS.includes(verb);
  return mark * (isBuySide ? 1 + adj : 1 - adj);
}

function frictionReceipt({ slippageBps, spreadProxyBps }, frictionPaid) {
  return {
    slippageBps,
    spreadProxyBps,
    spreadBasis: MANDATE_FRICTION_SPREAD_BASIS,       // 'proxy' — never observed spread
    frictionPaid: roundUsd(frictionPaid),
    frictionBasis: MANDATE_FRICTION_BASIS,            // 'idealized_no_market_impact'
  };
}

// ── Price-drift guard (§3.3 / I3) ────────────────────────────────────────────

/** Basis-points move from the submit mark to the harvest mark. */
export function driftBps(submitMark, harvestMark) {
  if (!Number.isFinite(submitMark) || submitMark <= 0 || !Number.isFinite(harvestMark)) return Infinity;
  return Math.abs(harvestMark - submitMark) / submitMark * 10000;
}

// ── Harvest validation (§3.3) — a result is applied only if ALL hold ─────────

/**
 * @returns {{ ok:true } | { ok:false, status:'rejected_stale'|'expired', failCondition:string, drift?:number }}
 */
export function validateEnvelope(book, envelope, { currentSessionDate, now, submitMark, harvestMark, verb, ticker }) {
  // 1. base revision
  if (book.revision !== envelope.baseRevision) {
    return { ok: false, status: 'rejected_stale', failCondition: 'base_revision' };
  }
  // 2. quarter identity + liveness
  if (book.quarterKey !== envelope.quarterKey || book.status !== 'active' || book.voided) {
    return { ok: false, status: 'rejected_stale', failCondition: 'quarter_or_status' };
  }
  // 3. same trading session (cross-session results are NEVER applied, F3)
  if (envelope.sessionDate !== currentSessionDate) {
    return { ok: false, status: 'rejected_stale', failCondition: 'cross_session' };
  }
  // 4. result age (age-out → expired terminal state, I1)
  const ageMs = now.getTime() - new Date(envelope.submittedAt).getTime();
  if (ageMs > MANDATE_RESULT_MAX_AGE_MS) {
    return { ok: false, status: 'expired', failCondition: 'result_age' };
  }
  // 5/6. ENTRIES ONLY: a BUY/ADD needs a fresh harvest mark and must not fill at a
  // price that drifted materially from the one reasoned over (I3). Exits are NEVER
  // subject to these — a data-quality mechanism must never suppress an exit
  // (C-21); a SELL/TRIM fills at the best available mark (fresh, else carry-over)
  // and is validated only by the base-state checks above.
  if (ENTRY_VERBS.includes(verb) && ticker) {
    if (harvestMark == null) {
      return { ok: false, status: 'rejected_stale', failCondition: 'no_harvest_mark' };
    }
    const d = driftBps(submitMark, harvestMark);
    if (d > MANDATE_PRICE_DRIFT_MAX_BPS) {
      return { ok: false, status: 'rejected_stale', failCondition: 'price_drift', drift: d };
    }
  }
  return { ok: true };
}

// ── Execution math (pure) ────────────────────────────────────────────────────

/**
 * Compute the portfolio mutation for a gated-and-validated decision. Pure — no
 * Firestore. Returns the new cash/positions and the receipt fields, or a
 * non-executing status (e.g. a size too small to buy a single 6dp share).
 *
 * @returns {{ ok:true, mutation, receipt } | { ok:false, status, reason }}
 */
export function computeExecution({ decision, execSizeUsd, positions, cash, snapshot, friction = defaultFriction(), sectorOf = null }) {
  const verb = decision.verb;
  const ticker = decision.ticker;
  const nextPositions = { ...positions };

  if (verb === 'HOLD') {
    return { ok: true, mutation: { cash, positions: nextPositions }, receipt: { executedSizeUsd: 0, executedPrice: null, shares: 0, clamped: false, realizedPnl: 0, friction: frictionReceipt(friction, 0) } };
  }

  const snapMark = markFor(snapshot, ticker);
  const DUST = 1 / 10 ** MANDATE_SHARES_DP;

  // ── ENTRY: BUY / ADD — a fresh, POSITIVE mark is REQUIRED (fail-closed, no
  //    carry-over; a 0/negative/absent mark never opens or grows a position). ──
  if (ENTRY_VERBS.includes(verb)) {
    const mark = snapMark;
    if (!(mark > 0)) return { ok: false, status: 'rejected_stale', reason: 'no_mark' };
    const execPrice = executedPriceFor(verb, mark, friction);

    const shares = floorShares(execSizeUsd / execPrice);
    if (shares <= 0) return { ok: false, status: 'gated', reason: 'size_too_small' };
    const cost = roundUsd(shares * execPrice);
    if (cost > cash + 1e-9) return { ok: false, status: 'gated', reason: 'insufficient_cash' };

    const prev = positions[ticker] || null;
    const oldShares = prev ? Number(prev.shares) || 0 : 0;
    const oldBasis = prev ? Number(prev.costBasisTotal) || 0 : 0;
    const newShares = roundShares(oldShares + shares);
    const newBasis = roundUsd(oldBasis + cost);
    const sector = prev?.sector ?? sectorOf ?? (snapshot?.symbols?.[ticker]?.sector ?? null);

    nextPositions[ticker] = {
      shares: newShares,
      costBasisTotal: newBasis,
      avgCost: newBasis / newShares,
      lastMark: mark,
      lastMarkAsOf: snapshot?.symbols?.[ticker]?.priceAsOf ?? null,
      lastMarkSource: 'snapshot',
      sector,
    };
    const frictionPaid = (execPrice - mark) * shares;
    return {
      ok: true,
      mutation: { cash: roundUsd(cash - cost), positions: nextPositions },
      receipt: { executedSizeUsd: cost, executedPrice: execPrice, shares, clamped: false, realizedPnl: 0, markSource: 'snapshot', friction: frictionReceipt(friction, frictionPaid) },
    };
  }

  // ── EXIT: SELL / TRIM — NEVER suppressed (C-21). Fill at the fresh mark when
  //    available, else the last-good (carry-over) mark (§4.3 "exit at last good
  //    mark"), else average cost — only a total absence of any positive mark can
  //    reject, and that is a value-impossibility, not a data-hygiene block. ──
  if (EXIT_VERBS.includes(verb)) {
    const prev = positions[ticker];
    if (!prev) return { ok: false, status: 'gated', reason: 'not_held' };
    const heldShares = Number(prev.shares) || 0;
    if (heldShares <= 0) return { ok: false, status: 'gated', reason: 'not_held' };

    let mark = snapMark;
    let exitMarkSource = 'snapshot';
    if (!(mark > 0)) { mark = Number(prev.lastMark); exitMarkSource = 'carry_over'; }
    if (!(mark > 0)) { mark = avgCostOf(prev); exitMarkSource = 'basis'; }
    if (!(mark > 0)) return { ok: false, status: 'rejected_stale', reason: 'no_mark' };
    const execPrice = executedPriceFor(verb, mark, friction);

    let wantShares;
    let clamped = false;
    if (verb === 'SELL') {
      wantShares = heldShares; // full exit
    } else { // TRIM
      wantShares = floorShares(execSizeUsd / execPrice);
      if (wantShares > heldShares) { wantShares = heldShares; clamped = true; } // over-ask clamp (§4.1), STRICT
    }
    if (wantShares <= 0) return { ok: false, status: 'gated', reason: 'size_too_small' };
    // Dust guard (M4): a residual below one representable share is sold in full —
    // never leave a 1e-6-share, $0-basis lingering position from TRIM rounding.
    if (heldShares - wantShares < DUST) wantShares = heldShares;

    const proceedsNet = roundUsd(wantShares * execPrice);
    const oldBasis = Number(prev.costBasisTotal) || 0;
    const deltaBasis = roundUsd(oldBasis * (wantShares / heldShares));
    const realizedPnl = roundUsd(proceedsNet - deltaBasis);
    const remaining = roundShares(heldShares - wantShares);

    if (remaining <= 0) {
      delete nextPositions[ticker]; // fully exited
    } else {
      const newBasis = roundUsd(oldBasis - deltaBasis);
      nextPositions[ticker] = {
        ...prev,
        shares: remaining,
        costBasisTotal: newBasis,
        avgCost: avgCostOf({ shares: remaining, costBasisTotal: newBasis }),
        lastMark: mark,
        lastMarkAsOf: exitMarkSource === 'snapshot' ? (snapshot?.symbols?.[ticker]?.priceAsOf ?? null) : (prev.lastMarkAsOf ?? null),
        lastMarkSource: exitMarkSource,
      };
    }
    const frictionPaid = (mark - execPrice) * wantShares;
    return {
      ok: true,
      mutation: { cash: roundUsd(cash + proceedsNet), positions: nextPositions },
      receipt: { executedSizeUsd: proceedsNet, executedPrice: execPrice, shares: wantShares, clamped, realizedPnl, markSource: exitMarkSource, friction: frictionReceipt(friction, frictionPaid) },
    };
  }

  return { ok: false, status: 'gated', reason: 'unknown_verb' };
}

// ── Sector weights (percent) for the portfolio block ─────────────────────────

function sectorWeightsPct(marked, totalValue) {
  if (!(totalValue > 0)) return {};
  const usd = {};
  for (const m of Object.values(marked)) {
    const sector = m.sector || '__unknown__';
    usd[sector] = (usd[sector] || 0) + m.marketValue;
  }
  const pct = {};
  for (const [s, v] of Object.entries(usd)) pct[s] = v / totalValue;
  return pct;
}

// ── The atomic transaction (§3.5) ────────────────────────────────────────────

/**
 * Execute one decision inside a single revision-preconditioned transaction.
 *
 * @param {object} args
 * @param {FirebaseFirestore.DocumentReference} args.mandateRef
 * @param {string} args.decisionId          deterministic id (§3.3) — the claim
 * @param {object} args.decision            normalized {verb, ticker, sizeUsd,...}
 * @param {object} args.gateResult          from mandateGate.evaluateGate
 * @param {object} args.envelope            {baseRevision, quarterKey, vintageRef, submitTickKey, submittedAt, sessionDate, mandatePromptTemplateVersion}
 * @param {object} args.snapshot            harvest-tick snapshot (§3.0)
 * @param {number} args.submitMark          the mark the model reasoned over (drift guard)
 * @param {string} args.currentSessionDate  today's trading session
 * @param {Date}   [args.now]
 * @param {object} [args.friction]
 * @returns {Promise<{ status, applied:boolean, idempotent?:boolean, decision, failCondition?, reason? }>}
 */
export async function executeDecision(db, {
  mandateRef, decisionId, decision, gateResult, envelope, snapshot, submitMark,
  currentSessionDate, now = new Date(), friction = defaultFriction(),
}) {
  const decRef = mandateRef.collection('decisions').doc(decisionId);
  const harvestTickKey = snapshot?.tickKey ?? null;

  const writeTerminal = (tx, book, status, extra = {}) => {
    const doc = buildDecision({
      decisionId,
      verb: decision.verb,
      ticker: decision.ticker,
      requestedSizeUsd: decision.sizeUsd ?? null,
      vintageRef: envelope.vintageRef ?? null,
      baseRevision: envelope.baseRevision ?? null,
      submitTickKey: envelope.submitTickKey ?? null,
      harvestTickKey,
      mandatePromptTemplateVersion: envelope.mandatePromptTemplateVersion ?? null,
      gateOutcome: gateResult?.gateOutcome ?? null,
      frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
      status,
      ...extra,
    });
    tx.set(decRef, doc);
    // Every terminal transition clears openBatchId in a revision-disciplined txn (I1).
    // lastEvalTickKey is set ATOMICALLY with the commit so a same-slot re-fire is
    // hard-idempotent at the book level (the handler skips a book already stamped
    // with the current tickKey) — the decision-doc claim only guards a replay of
    // the SAME requestId, not a re-eval at the new (post-commit) revision.
    tx.update(mandateRef, {
      revision: book.revision + 1,
      'execState.openBatchId': null,
      'execState.lastEvalTickKey': envelope.submitTickKey ?? null,
      'execState.submitted': (book.execState?.submitted || 0) + 1,
      'execState.executed': (book.execState?.executed || 0) + (status === 'executed' ? 1 : 0),
    });
    return { status, applied: status === 'executed', decision: doc, ...('failCondition' in extra ? { failCondition: extra.failCondition } : {}) };
  };

  return db.runTransaction(async (tx) => {
    // Exactly-once (F2): a committed decision doc is the claim — retry no-ops.
    const existing = await tx.get(decRef);
    if (existing.exists) return { status: existing.data().status, applied: false, idempotent: true, decision: existing.data() };

    const bookSnap = await tx.get(mandateRef);
    if (!bookSnap.exists) throw new Error('executeDecision: book missing');
    const book = bookSnap.data();

    // Book value BEFORE the mutation, at THIS snapshot — the independent baseline
    // the post-mutation conservation invariant checks against (money-review M2).
    const preTotalValue = markBook(book.portfolio?.positions || {}, book.portfolio?.cash || 0, snapshot).totalValue;

    // If the gate rejected upstream, record the gated terminal state (no mutation).
    if (gateResult && gateResult.passed === false) {
      return writeTerminal(tx, book, 'gated', { failCondition: gateResult.reason ?? gateResult.rule });
    }

    // Harvest validation (§3.3).
    const harvestMark = decision.ticker ? markFor(snapshot, decision.ticker) : null;
    const v = validateEnvelope(book, envelope, {
      currentSessionDate, now, submitMark, harvestMark, verb: decision.verb, ticker: decision.ticker,
    });
    if (!v.ok) {
      const extra = { failCondition: v.failCondition };
      if (v.drift != null) extra.gateOutcome = { rule: 'price_drift', passed: false, driftBps: v.drift };
      return writeTerminal(tx, book, v.status, extra);
    }

    // Compute the mutation (pure).
    const exec = computeExecution({
      decision, execSizeUsd: gateResult?.execSizeUsd ?? decision.sizeUsd,
      positions: book.portfolio.positions || {}, cash: book.portfolio.cash || 0, snapshot, friction,
    });
    if (!exec.ok) return writeTerminal(tx, book, exec.status, { failCondition: exec.reason });

    const { cash: newCash, positions: newPositions } = exec.mutation;

    // Re-value at the SAME harvest snapshot (the one consistent valuation, I6).
    const { marked, totalValue } = markBook(newPositions, newCash, snapshot);

    // §3.5 invariants — a violation ABORTS to `failed`, never partially commits.
    if (newCash < -MANDATE_VALUE_RECONCILE_TOLERANCE_USD) {
      return writeTerminal(tx, book, 'failed', { failCondition: 'cash_negative' });
    }
    for (const [t, p] of Object.entries(newPositions)) {
      if (!(Number(p.shares) >= 0)) return writeTerminal(tx, book, 'failed', { failCondition: `shares_negative:${t}` });
    }
    // Value conservation (§3.5): at one consistent valuation a trade only moves
    // value by the friction it pays — `newTotalValue === preTotalValue − frictionPaid`
    // (P2 friction is 0, so value is exactly conserved). Checking against the
    // INDEPENDENT pre-mutation baseline (not the same-call self-sum, which is
    // tautological — money-review M2) actually catches a mis-recorded basis/shares/cash.
    const frictionPaid = exec.receipt.friction?.frictionPaid || 0;
    if (Math.abs(totalValue - (preTotalValue - frictionPaid)) > MANDATE_VALUE_CONSERVE_TOLERANCE_USD) {
      return writeTerminal(tx, book, 'failed', { failCondition: 'value_reconcile' });
    }

    // Write the executed decision receipt.
    const doc = buildDecision({
      decisionId,
      verb: decision.verb,
      ticker: decision.ticker,
      requestedSizeUsd: decision.sizeUsd ?? null,
      executedSizeUsd: exec.receipt.executedSizeUsd,
      executedShares: exec.receipt.shares,       // §4.1 — the filled quantity
      executedPrice: exec.receipt.executedPrice,
      realizedPnl: exec.receipt.realizedPnl,     // §4.1 — recorded here; needs the historical basis, unrecoverable otherwise
      // 'snapshot' → 'fresh'; carry_over/basis pass through (founder rider).
      fillMarkQuality: exec.receipt.markSource === 'snapshot' ? 'fresh' : (exec.receipt.markSource ?? null),
      clamped: exec.receipt.clamped,
      friction: exec.receipt.friction,
      frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
      gateOutcome: gateResult?.gateOutcome ?? null,
      vintageRef: envelope.vintageRef ?? null,
      baseRevision: envelope.baseRevision ?? null,
      submitTickKey: envelope.submitTickKey ?? null,
      harvestTickKey,
      mandatePromptTemplateVersion: envelope.mandatePromptTemplateVersion ?? null,
      status: 'executed',
    });
    tx.set(decRef, doc);

    // Mutate the book: portfolio + revision + clear openBatchId + liveness (I9).
    // NEVER writes HWM/drawdown — the close pass is the sole peak writer (I6).
    // lastEvalTickKey stamped atomically → same-slot re-fire is hard-idempotent.
    //
    // LIVENESS SIGNAL (founder ruling, Phase 2 close-out): a HOLD is a terminal
    // `executed` decision and increments `executed` here — a book that only ever
    // HOLDs is HEALTHY. Liveness (I9/§6.4) is therefore judged by the STALE-REJECTION
    // STREAK (P3), not by the executed/submitted ratio: a book that only *rejects*
    // is the unhealthy case. P3 must wire the liveness floor to the streak, not this
    // counter.
    tx.update(mandateRef, {
      'portfolio.cash': newCash,
      'portfolio.positions': newPositions,
      'portfolio.totalValue': roundUsd(totalValue),
      'portfolio.sectorWeights': sectorWeightsPct(marked, totalValue),
      revision: book.revision + 1,
      'execState.openBatchId': null,
      'execState.lastEvalTickKey': envelope.submitTickKey ?? null,
      'execState.submitted': (book.execState?.submitted || 0) + 1,
      'execState.executed': (book.execState?.executed || 0) + 1,
    });

    return { status: 'executed', applied: true, decision: doc, receipt: exec.receipt };
  });
}
