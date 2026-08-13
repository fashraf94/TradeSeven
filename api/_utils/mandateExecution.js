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
// FRICTION (§4.1, P3): fills price through the market-cap-tier model
// (mandateFrictionModel.js) — friction is computed HERE, at the execution
// boundary, from the decision + the harvest snapshot, so it enters EXACTLY ONCE
// through cash (F14) and no call site can forget it. Every receipt carries the
// honesty labels (spreadBasis:'proxy', frictionBasis:'idealized_no_market_impact',
// D-15/O-3) and the friction model version. `grossPnl` is later reconstructed
// as `netPnl + Σ frictionPaid` from the accumulated `portfolio.frictionPaidCum`
// — friction is never subtracted a second time.
//
// CA-FROZEN SYMBOLS (§4.3/I7): a symbol the gap detector froze this tick is
// carried in `caFrozen` — an ENTRY on it is gated; an EXIT skips the (already
// CA-adjusted) fresh mark and fills at the position's LAST-GOOD mark, the
// ratified C-21 path.

import { buildDecision, clearedOpenSubmissionPatch } from './mandateSchema.js';
import { markBook, avgCostOf } from './mandateValuation.js';
import { markFor, snapshotExcluding } from './mandateUniverseSnapshot.js';
import { frictionForDecision, zeroFriction } from './mandateFrictionModel.js';
import {
  MANDATE_SHARES_DP,
  MANDATE_RESULT_MAX_AGE_MS,
  MANDATE_PRICE_DRIFT_MAX_BPS,
  MANDATE_FRICTION_MODEL_VERSION,
  MANDATE_FRICTION_SPREAD_BASIS,
  MANDATE_FRICTION_BASIS,
  MANDATE_VALUE_RECONCILE_TOLERANCE_USD,
  MANDATE_VALUE_CONSERVE_TOLERANCE_USD,
} from './mandateConfig.js';
import { EXIT_VERBS, ENTRY_VERBS } from './mandateDecisionTool.js';

// ── Rounding (§4.1) ──────────────────────────────────────────────────────────

// One ledger, one rounding regime: bankersRound moved to mandateRounding.js in
// P3 (its old 1e-9-relative half tolerance swallowed every value above $5M into
// the half-to-even branch — odd cents unrepresentable at the $10M base). The
// re-export keeps this module the import point for execution-math callers.
export { bankersRound } from './mandateRounding.js';
import { roundUsd, roundShares } from './mandateRounding.js';
/** Shares are floored to 6dp so a BUY can never overspend its sized dollars. */
const floorShares = (n) => Math.floor(n * 10 ** MANDATE_SHARES_DP) / 10 ** MANDATE_SHARES_DP;

// ── Friction (§4.1) — cap-tier model (P3), labeled honestly ──────────────────

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
 * §3.3 harvest validation. `phase` (P5) lets the execution boundary split the
 * check around the deterministic gate: `'base'` = conditions 1–4 (pure
 * base-state staleness — MUST precede the gate, or a stale result whose
 * decision also fails a gate dies 'gated' and resets the I9 streak, review
 * INV-P5-3); `'marks'` = conditions 5–6 (harvest-mark presence + price drift —
 * entangled with the universe gate, so they run AFTER it); `'all'` (default) =
 * the standalone contract.
 *
 * Condition 5 refinement (P5): a null harvest mark rejects as staleness ONLY
 * when the ticker HAD a submit mark — i.e. it was eligible when the model
 * chose it and vanished in flight (the universe changed under the decision).
 * A ticker with no submit mark either was never eligible (a hallucinated
 * entry — the UNIVERSE GATE's case, 'gated', streak-neutral) or cannot be
 * drift-checked (missing submit snapshot — fail closed as price_drift via the
 * Infinity path below). Exits are NEVER subject to 5/6 (C-21).
 *
 * @returns {{ ok:true } | { ok:false, status:'rejected_stale'|'expired', failCondition:string, drift?:number }}
 */
export function validateEnvelope(book, envelope, { currentSessionDate, now, submitMark, harvestMark, verb, ticker, phase = 'all' }) {
  if (phase !== 'marks') {
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
  }
  if (phase !== 'base') {
    // 5/6. ENTRIES ONLY: a BUY/ADD needs a fresh harvest mark and must not fill
    // at a price that drifted materially from the one reasoned over (I3). Exits
    // are NEVER subject to these — a data-quality mechanism must never suppress
    // an exit (C-21); a SELL/TRIM fills at the best available mark (fresh, else
    // carry-over) and is validated only by the base-state checks above.
    if (ENTRY_VERBS.includes(verb) && ticker) {
      if (harvestMark == null && submitMark != null) {
        return { ok: false, status: 'rejected_stale', failCondition: 'no_harvest_mark' };
      }
      if (harvestMark != null) {
        const d = driftBps(submitMark, harvestMark);
        if (d > MANDATE_PRICE_DRIFT_MAX_BPS) {
          return { ok: false, status: 'rejected_stale', failCondition: 'price_drift', drift: d };
        }
      }
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
 * `friction` defaults through the §4.1 cap-tier model from the harvest
 * snapshot; `caFrozen` carries the gap detector's frozen symbols (§4.3/I7).
 *
 * @returns {{ ok:true, mutation, receipt } | { ok:false, status, reason }}
 */
export function computeExecution({ decision, execSizeUsd, positions, cash, snapshot, friction = null, caFrozen = null, sectorOf = null, sessionDate = null }) {
  const verb = decision.verb;
  const ticker = decision.ticker;
  const nextPositions = { ...positions };
  const fx = friction ?? frictionForDecision(decision, snapshot);

  if (verb === 'HOLD') {
    return { ok: true, mutation: { cash, positions: nextPositions }, receipt: { executedSizeUsd: 0, executedPrice: null, shares: 0, clamped: false, realizedPnl: 0, friction: frictionReceipt(zeroFriction(), 0) } };
  }

  const caFrozenHere = !!(caFrozen && ticker && caFrozen.has(ticker));
  const snapMark = caFrozenHere ? null : markFor(snapshot, ticker); // a CA-frozen fresh mark prices NOTHING this tick (§4.3)
  const DUST = 1 / 10 ** MANDATE_SHARES_DP;

  // ── ENTRY: BUY / ADD — a fresh, POSITIVE mark is REQUIRED (fail-closed, no
  //    carry-over; a 0/negative/absent mark never opens or grows a position).
  //    A CA-frozen symbol never opens or grows a position either (§4.3/I7). ──
  if (ENTRY_VERBS.includes(verb)) {
    if (caFrozenHere) return { ok: false, status: 'gated', reason: 'suspected_ca' };
    const mark = snapMark;
    if (!(mark > 0)) return { ok: false, status: 'rejected_stale', reason: 'no_mark' };
    const execPrice = executedPriceFor(verb, mark, fx);

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
      // ENTITLEMENT SUBSTRATE (§4.3, spec+money review P3): the ET session
      // date this CONTINUOUS holding began. A top-up keeps the original date;
      // an exit-and-rebuy starts a new one. The CA applier only credits
      // date-entitlement actions (splits/dividends/distributions) to holdings
      // opened STRICTLY BEFORE the effective date — never a phantom dividend
      // to a post-ex-date buyer.
      openedAt: prev ? (prev.openedAt ?? null) : (sessionDate ?? null),
    };
    const frictionPaid = (execPrice - mark) * shares;
    return {
      ok: true,
      mutation: { cash: roundUsd(cash - cost), positions: nextPositions },
      receipt: { executedSizeUsd: cost, executedPrice: execPrice, shares, clamped: false, realizedPnl: 0, markSource: 'snapshot', friction: frictionReceipt(fx, frictionPaid) },
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
    const execPrice = executedPriceFor(verb, mark, fx);

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
      receipt: { executedSizeUsd: proceedsNet, executedPrice: execPrice, shares: wantShares, clamped, realizedPnl, markSource: exitMarkSource, friction: frictionReceipt(fx, frictionPaid) },
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

// ── Terminal-transition bookkeeping (§3.3 / I1 / I9) ─────────────────────────

// I9 (P3): the stale-rejection streak — consecutive submissions that die as
// rejected_stale/expired. It is THE liveness signal (founder ruling: HOLD-only
// is healthy, so the executed ratio can't be); executed/gated/failed all mean
// the pipeline delivered a live answer, so they reset it. Updated atomically
// with every terminal transition.
export const streakAfter = (book, status) => (
  (status === 'rejected_stale' || status === 'expired')
    ? (book.execState?.staleRejectStreak || 0) + 1
    : 0
);

/**
 * The execState portion of EVERY terminal transition — the ONE builder all
 * disposal paths share (I1: no bare doc-write path outside the discipline).
 * Counters + streak + the gate clear.
 *
 * OWNERSHIP-CONDITIONAL GATE CLEAR (P5). Under direct transport the gate is
 * never set, so clearing was trivially safe. Under batch transport a book can
 * transiently have TWO submissions alive at once — a crash between provider
 * batch creation and the gate write leaves a ZOMBIE request in flight with no
 * gate, and the book legitimately re-submits; the zombie's result can still
 * validate and terminate first. An UNCONDITIONAL clear would then release the
 * gate the LIVE submission holds, re-opening double-submit — so the clear
 * applies only when the gate names the submission being terminated
 * (openBatchId === decisionId; house convention: the gate holds the requestId).
 * A non-owning terminal leaves the gate to its owner, whose own terminal
 * transition clears it — the I1 invariant "gate set ⟺ a live submission it
 * names" holds in both cases.
 */
export function execStateTerminalPatch(book, decisionId, status, { submitTickKey = null } = {}) {
  const openBatchId = book.execState?.openBatchId ?? null;
  const ownsGate = openBatchId === decisionId;
  return {
    ...(ownsGate ? clearedOpenSubmissionPatch() : {}),
    // lastEvalTickKey stamps the SUBMIT tick (the billed eval) atomically with
    // the commit so a same-slot re-fire is hard-idempotent at the book level.
    // Written only when this terminal OWNS the gate (batch) or no gate exists
    // (direct mode / post-disposal) — a ZOMBIE's terminal must not move the
    // billing stamp BACKWARD over a newer submission's (P5 review INV-P5-6:
    // the old-tick overwrite re-opened same-slot re-eval once the live gate
    // cleared).
    ...(submitTickKey != null && (ownsGate || openBatchId == null)
      ? { 'execState.lastEvalTickKey': submitTickKey } : {}),
    'execState.submitted': (book.execState?.submitted || 0) + 1,
    'execState.executed': (book.execState?.executed || 0) + (status === 'executed' ? 1 : 0),
    'execState.staleRejectStreak': streakAfter(book, status),
  };
}

/**
 * Terminal disposition for a submission WITHOUT a model result to execute
 * (§3.3 / I1): API-errored (`failed`), aged-out or provider-expired
 * (`expired`), operator/lifecycle disposal (`cancelled`), drain
 * (`rejected_stale`). One revision-disciplined transaction: claim the decision
 * doc if absent (a replay no-ops on the claim), write the terminal receipt,
 * bump revision, apply the shared execState terminal patch (counters, streak,
 * ownership-conditional gate clear).
 *
 * @returns {Promise<{ status, applied:false, idempotent?:true, staleRejectStreak?:number }>}
 */
export async function disposeSubmission(db, {
  mandateRef, requestId, status, failCondition = null, envelope = null, verb = null, ticker = null,
}) {
  const decRef = mandateRef.collection('decisions').doc(requestId);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(decRef);
    if (existing.exists) {
      return { status: existing.data().status, applied: false, idempotent: true };
    }
    const bookSnap = await tx.get(mandateRef);

    tx.set(decRef, buildDecision({
      decisionId: requestId,
      verb,
      ticker,
      status,
      frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
      vintageRef: envelope?.vintageRef ?? null,
      baseRevision: envelope?.baseRevision ?? null,
      submitTickKey: envelope?.submitTickKey ?? null,
      mandatePromptTemplateVersion: envelope?.mandatePromptTemplateVersion ?? null,
      ...(failCondition != null ? { failCondition } : {}),
    }));
    // A MISSING book (deleted out-of-band) still gets its terminal decision —
    // the claim is what makes the batch doc converge (I1: no request left in
    // limbo; P5 review INV-P5-5/SPEC-P5-8 found the old throw left the entry
    // undisposable and its batch doc immortal). Decision subcollection docs
    // exist independently of the parent in Firestore; there is simply no book
    // state to update.
    if (!bookSnap.exists) {
      return { status, applied: false, bookMissing: true, failCondition };
    }
    const book = bookSnap.data();
    tx.update(mandateRef, {
      revision: (book.revision || 0) + 1,
      ...execStateTerminalPatch(book, requestId, status, { submitTickKey: envelope?.submitTickKey ?? null }),
    });
    return { status, applied: false, staleRejectStreak: streakAfter(book, status), failCondition };
  });
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
 * @param {object} [args.friction]   override; defaults through the §4.1 cap-tier model
 * @param {Set<string>} [args.caFrozen]  gap-detector frozen symbols this tick (§4.3/I7)
 * @returns {Promise<{ status, applied:boolean, idempotent?:boolean, decision, failCondition?, reason? }>}
 */
export async function executeDecision(db, {
  mandateRef, decisionId, decision, gateResult, envelope, snapshot, submitMark,
  currentSessionDate, now = new Date(), friction = null, caFrozen = null,
}) {
  const decRef = mandateRef.collection('decisions').doc(decisionId);
  const harvestTickKey = snapshot?.tickKey ?? null;
  // §3.5 "one consistent valuation" must be consistent WITH THE FILL BASIS:
  // a CA-frozen symbol fills (and is valued) at its last-good carry-over mark,
  // never the already-adjusted fresh mark — so the valuation snapshot excludes
  // frozen symbols throughout, or the conservation invariant would compare a
  // carry-over fill against a phantom-mark baseline and abort a correct exit.
  const vSnap = snapshotExcluding(snapshot, caFrozen);
  // FRICTION TIER from the ORIGINAL snapshot, not vSnap: market cap is
  // split-invariant (price × shares outstanding), so a suspected CA impugns the
  // MARK, never the tier — pricing a $30B name's frozen exit at the 'unknown'
  // 20bps tier undercredits the exit for no safety (money review P3 finding 4).
  const fx = friction ?? frictionForDecision(decision, snapshot);

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
    // Every terminal transition releases the gate under revision discipline
    // (I1) — via the shared execStateTerminalPatch, which makes the clear
    // OWNERSHIP-CONDITIONAL (P5: a zombie duplicate's terminal must not release
    // the live submission's gate) and stamps lastEvalTickKey atomically with
    // the commit so a same-slot re-fire is hard-idempotent at the book level —
    // the decision-doc claim only guards a replay of the SAME requestId, not a
    // re-eval at the new (post-commit) revision.
    tx.update(mandateRef, {
      revision: book.revision + 1,
      ...execStateTerminalPatch(book, decisionId, status, { submitTickKey: envelope.submitTickKey ?? null }),
    });
    return { status, applied: status === 'executed', decision: doc, staleRejectStreak: streakAfter(book, status), ...('failCondition' in extra ? { failCondition: extra.failCondition } : {}) };
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
    const preTotalValue = markBook(book.portfolio?.positions || {}, book.portfolio?.cash || 0, vSnap).totalValue;

    // Defense-in-depth (money review P3 finding 5): an ENTRY on a CA-frozen
    // symbol must terminate as 'gated'/suspected_ca — the honest cause of a
    // DATA-QUALITY freeze — not fall through to validateEnvelope's
    // no_harvest_mark (vSnap excludes the symbol, so the harvest mark is null)
    // and die 'rejected_stale', which would bump the I9 staleRejectStreak for
    // a freeze that is not transport staleness. Deliberately BEFORE validation
    // (the P3 ruling ranks the CA classification over the staleness label).
    if (caFrozen && decision.ticker && ENTRY_VERBS.includes(decision.verb) && caFrozen.has(decision.ticker)) {
      return writeTerminal(tx, book, 'gated', { failCondition: 'suspected_ca' });
    }

    // Harvest validation, BASE conditions 1–4, BEFORE the deterministic gate
    // (P5 review INV-P5-3): §3.3 is the OUTER contract — "a result is applied
    // only if ALL hold; any failure → rejected_stale" — and the §3.4 gate
    // governs VALID results. Under direct transport the order was invisible
    // (submit and harvest share the tick, so 1–4 always passed); under batch,
    // gating first let a stale result whose decision ALSO failed the gate
    // (position exited between submit and harvest → 'not_held') die as
    // 'gated' — recording the wrong condition and RESETTING the I9 staleness
    // streak, the designated liveness wire, exactly when submissions were
    // dying stale.
    const harvestMark = decision.ticker ? markFor(vSnap, decision.ticker) : null;
    const vArgs = { currentSessionDate, now, submitMark, harvestMark, verb: decision.verb, ticker: decision.ticker };
    const vBase = validateEnvelope(book, envelope, { ...vArgs, phase: 'base' });
    if (!vBase.ok) {
      return writeTerminal(tx, book, vBase.status, { failCondition: vBase.failCondition });
    }

    // The deterministic gate (§3.4), on a base-valid result. Runs before the
    // MARK conditions (5–6) so a never-eligible (hallucinated) entry keeps its
    // honest 'gated'/universe label instead of a staleness one — see
    // validateEnvelope's condition-5 refinement.
    if (gateResult && gateResult.passed === false) {
      return writeTerminal(tx, book, 'gated', { failCondition: gateResult.reason ?? gateResult.rule });
    }

    // Harvest validation, MARK conditions 5–6 (entries only: harvest-mark
    // presence for a ticker that WAS submit-eligible, and the I3 drift guard).
    const vMarks = validateEnvelope(book, envelope, { ...vArgs, phase: 'marks' });
    if (!vMarks.ok) {
      const extra = { failCondition: vMarks.failCondition };
      if (vMarks.drift != null) extra.gateOutcome = { rule: 'price_drift', passed: false, driftBps: vMarks.drift };
      return writeTerminal(tx, book, vMarks.status, extra);
    }

    // Compute the mutation (pure). Friction defaults through the §4.1 cap-tier
    // model inside computeExecution — the single entry point (F14).
    const exec = computeExecution({
      decision, execSizeUsd: gateResult?.execSizeUsd ?? decision.sizeUsd,
      positions: book.portfolio.positions || {}, cash: book.portfolio.cash || 0, snapshot: vSnap, friction: fx, caFrozen,
      sessionDate: currentSessionDate,
    });
    if (!exec.ok) return writeTerminal(tx, book, exec.status, { failCondition: exec.reason });

    const { cash: newCash, positions: newPositions } = exec.mutation;

    // Re-value at the SAME harvest snapshot (the one consistent valuation, I6).
    const { marked, totalValue } = markBook(newPositions, newCash, vSnap);

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
      // F14 reporting accumulator: friction paid to date, so gross can always be
      // reconstructed as net + Σ friction (added back once, never subtracted twice).
      'portfolio.frictionPaidCum': roundUsd((book.portfolio?.frictionPaidCum || 0) + frictionPaid),
      revision: book.revision + 1,
      // Shared terminal bookkeeping (counters, streak reset — a live fill resets
      // the I9 streak — ownership-conditional gate clear, submit-tick stamp).
      ...execStateTerminalPatch(book, decisionId, 'executed', { submitTickKey: envelope.submitTickKey ?? null }),
    });

    return { status: 'executed', applied: true, decision: doc, receipt: exec.receipt, staleRejectStreak: 0 };
  });
}
