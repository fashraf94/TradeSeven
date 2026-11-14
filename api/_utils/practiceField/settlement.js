// api/_utils/practiceField/settlement.js
//
// Practice Field T1a-2a — THE LINES, THE ENDPOINT AND THE RESULT (Amendment E, rulings E1, E2, E4 to E7, E10, E15,
// E16; shared contract V2 §4.4; build prompt §3, §5, §6). The pure half of what the close does to an idea beyond
// valuing it. Nothing here reads a store or a clock, and NOTHING HERE SELLS: a sale is a fill, and every fill goes
// through executeIdeaFill at a window (exits.js).
//
// READING THE LINES (E6, E7). After a close has applied corporate actions and marked the ledgers, each holding of a
// running idea is compared with its own line:
//   • a FULL-QUALITY close strictly below the line's level is recognised. The line records the breach for good; the
//     holding — that holding and no other (E1) — is marked `exitPending` and the idea becomes
//     `line_hit_exit_pending`. On the idea's DUE session the due date wins (E7): the breach is recorded and no
//     separate exit is queued — the one sale is the settlement liquidation;
//   • a close that is not full quality recognises nothing: the line is recorded as unobserved for that session, by
//     symbol (`unobservedLineSessions`). "Full quality" is the mark's own (`vendor_time`, from this session, at or
//     after its open — marks.js) on a symbol with no unsettled conflicting corporate action;
//   • a line goes on being read for as long as its holding is held and the line has not been recognised. A holding
//     waiting to be sold because of a DELISTING (E11) is still held and its line was never recognised, so its line
//     is still read — observed, unobserved or breached — though nothing more is queued (review RH-3). A holding
//     whose own line was recognised, or one waiting for its settlement sale, is not read again.
//
// THE ENDPOINT (E4) is a liquidation value, computed THE SAME WAY ON ALL THREE LEDGERS: cash, plus each remaining
// holding at the endpoint close's mark, less the modelled cost of selling it at that mark under the ledger's own cost
// policy — the tier each holding ENTERED with (E5; a fund's explicit tier is the tier a fund enters with). The
// arithmetic of one holding is the sale's own (fills.js `modelledSaleProceeds`), so an idea sold the next morning at
// exactly the endpoint's marks shows no liquidation slippage, and an idea that never traded after entry ties its
// same-stock comparison to the cent (B-ENDPOINT). Every displayed figure is the sum of its displayed parts
// (BUILD_RULES §9); the raw values sit beside.
//
// THE RESULT (contract §4.4) is five columns and what the contract says is written with them. It is built ONCE, at
// the endpoint, from the endpoint row's own rounded figures.
//
// THE RUNNING RECORD (`idea.track`). The result needs the largest decline between recorded session-close values and
// the mean invested exposure. Rather than re-read up to sixty rows inside the endpoint's transaction, each close
// folds its row into a small running record on the idea; the endpoint reads it.

import { MANDATE_FRICTION_TIERS } from '../mandateConfig.js';
import {
  IDEA_SCHEMA_VERSION, VALUATION_LABEL, VALUATION_LABEL_UNOBSERVED, MARK_QUALITY, EXIT_REASON, CONTRACT_CONDITION, ECONOMIC_RESULT,
  PROCESS_QUALITY, EVIDENCE_SCOPE_SINGLE, ADOPTION_NO_OFFER, RESULT_VERSION, DECISION_ORIGIN_SETTLEMENT, DECISION_ORIGIN_LINE_EXIT,
} from './constants.js';
import { modelledSaleProceeds, isCostTier, costTierOf } from './fills.js';
import { fundOf, frictionForSymbol } from './symbols.js';
import { unsettledConflicts } from './ledger.js';
import { toCents, fromCents } from './money.js';

/** The kinds of endpoint: at the scheduled due session, early (no holdings left — E2), or after a due session passed. */
/** The corporate actions that pay cash into a ledger. */
const CASH_ACTION_TYPES = new Set(['delisting', 'cash_dividend']);

export const ENDPOINT_KIND = Object.freeze({ DUE_SESSION: 'due_session', EARLY_RESOLUTION: 'early_resolution', LATE: 'late' });

/** What a holding of an idea is waiting for, if anything. */
export const pendingSaleOf = (holding) => holding?.settlementPending ?? holding?.exitPending ?? null;

/** The symbols of a ledger that carry an unsettled conflicting corporate action (their price basis is not certain). */
function unsettledSymbolsOf(ledger) {
  return new Set(unsettledConflicts(ledger).map((r) => String(r.ticker || '').trim().toUpperCase()));
}

/**
 * The record of a finished liquidation (E4, E14): what the settlement sales fetched, against what the endpoint valued
 * the same holdings at, and the cash that returns to the treasury. The slippage is recorded and is NOT part of the
 * result. Pure; shared by the window that fills the last settlement sale (exits.js) and the close that finds nothing
 * left to sell (close.js).
 *
 * A holding the endpoint valued may leave by a delisting's CASH instead of a sale (E11), and may pay a DIVIDEND
 * between the endpoint and its sale (the sale waits across the ex-date — exits.js). That cash is part of what the
 * holding fetched: it is counted beside the sales' proceeds, under its own name, and the slippage is measured
 * against both (review RH-6; second refuter pass, 4a) — otherwise a paid-out holding would read as a loss of its
 * whole endpoint value, and an ex-dividend sale as a loss of the dividend.
 *
 * @returns {{ returnedCents: number, fields: object }}  `fields` are spread onto the idea document
 */
export function completedLiquidation(idea, ledger, { session, nowIso }) {
  const sales = (ledger.saleReceipts || []).filter((s) => s.kind === DECISION_ORIGIN_SETTLEMENT);
  const proceedsCents = sales.reduce((sum, s) => sum + toCents(s.proceedsUsd), 0);
  // Cash a corporate action paid AFTER the endpoint valued the holdings (a receipt applied on a later session): a
  // delisting's cash (`cashUsd`) or a dividend (`incomeUsd`). One applied on or before the endpoint session is
  // already in the endpoint's cash.
  const endpointSession = idea.endpoint?.session ?? null;
  const paidOut = (ledger.corporateActionReceipts || []).filter((r) => r?.applied === true && CASH_ACTION_TYPES.has(r.type) && endpointSession !== null && r.appliedOn > endpointSession);
  const paidOutCents = paidOut.reduce((sum, r) => sum + toCents(r.cashUsd || 0) + toCents(r.incomeUsd || 0), 0);
  const endpointNetCents = toCents(idea.endpoint?.holdingsNetUsd || 0);
  const slippageCents = proceedsCents + paidOutCents - endpointNetCents;
  const returnedCents = toCents(ledger.cash);
  // What waited after the endpoint (review RH-4): the result is written once and is not amended, so the settlement
  // sales' own waiting is stated here, on the liquidation's record, beside the idea's live `processQuality`.
  const waited = (idea.blockedBy || []).filter((b) => typeof b?.kind === 'string' && b.kind.startsWith('settlement_sale_'));
  return {
    returnedCents,
    fields: {
      liquidationProceedsUsd: fromCents(proceedsCents),
      liquidationSlippageUsd: fromCents(slippageCents),
      liquidation: {
        completedSession: session, completedAt: nowIso, sales: sales.map((s) => s.decisionId),
        proceedsUsd: fromCents(proceedsCents), corporateActionCashUsd: fromCents(paidOutCents), corporateActions: paidOut.map((r) => r.actionId),
        endpointHoldingsNetUsd: fromCents(endpointNetCents),
        slippageUsd: fromCents(slippageCents), returnedToTreasuryUsd: fromCents(returnedCents),
        processQuality: waited.length > 0 ? PROCESS_QUALITY.BLOCKED : PROCESS_QUALITY.FOLLOWED_PLAN, blockedBy: waited,
      },
    },
  };
}

// ── The lines ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Read an idea's lines at one close.
 *
 * @param {object} args
 * @param {object} args.idea        the idea AFTER this close's corporate actions and marks (ledger, lines)
 * @param {object|null} args.valuation  the idea's own valuation at this close (ledger.js valueLedger); null when the
 *                                  session has no stored close snapshot (nothing can be recognised)
 * @param {string} args.date        the session being closed
 * @param {boolean} args.isDueSession  the idea's due session: a breach is recorded and nothing is queued (E7)
 * @param {boolean} args.late       this close is a catch-up of a missed session (E12)
 * @param {string} args.recognisedAtIso  the instant this close runs — the decision instant of any exit it queues
 * @param {string|null} args.snapshotKey
 * @returns {{ lines: Array<object>, holdings: object, unobservedLineSessions: object, breaches: Array<object>,
 *             observations: Object<string, string>, unobserved: string[] }}
 */
export function readLines({ idea, valuation, date, isDueSession, late, recognisedAtIso, snapshotKey }) {
  const holdings = { ...(idea.ledger.holdings || {}) };
  const unsettled = unsettledSymbolsOf(idea.ledger);
  const unobservedLineSessions = Object.fromEntries(Object.entries(idea.unobservedLineSessions || {}).map(([s, d]) => [s, [...d]]));
  const breaches = [];
  const observations = {};
  const unobserved = [];
  const lines = (idea.lines || []).map((line) => {
    const holding = holdings[line.symbol];
    // A line is read while its holding is held and the line has not been recognised. A holding waiting for its
    // settlement sale is past its endpoint. One waiting because of a DELISTING is still read (review RH-3).
    if (!holding || line.breach || holding.settlementPending != null) return line;
    const waitingOnDelisting = holding.exitPending != null;
    const mark = valuation?.marks?.[line.symbol] ?? null;
    const fullQuality = !!mark && mark.quality === MARK_QUALITY.VENDOR_TIME && !unsettled.has(line.symbol)
      && typeof mark.mark === 'number' && Number.isFinite(mark.mark) && Number.isFinite(line.level);
    if (!fullQuality) {
      unobservedLineSessions[line.symbol] = [...(unobservedLineSessions[line.symbol] || []), date];
      observations[line.symbol] = 'unobserved';
      unobserved.push(line.symbol);
      return line;
    }
    // STRICTLY below (E1): a close exactly on the line has not crossed it.
    if (!(mark.mark < line.level)) { observations[line.symbol] = 'at_or_above'; return line; }
    observations[line.symbol] = 'below';
    const breach = {
      session: date, close: mark.mark, level: line.level, closeVendorTimeIso: mark.vendorTimeIso ?? null,
      snapshotKey: snapshotKey ?? null, recognisedAt: recognisedAtIso, recognisedLate: late === true, onDueSession: isDueSession === true,
    };
    breaches.push({ symbol: line.symbol, ...breach });
    // The breach queues the holding's exit — unless the due date wins (E7), or the holding is already waiting to be
    // sold (a delisting): one holding, one pending sale.
    if (!isDueSession && !waitingOnDelisting) {
      holdings[line.symbol] = {
        ...holding,
        exitPending: { reason: EXIT_REASON.LINE, session: date, close: mark.mark, level: line.level, at: recognisedAtIso, recognisedLate: late === true, waiting: null },
      };
    }
    return { ...line, breach };
  });
  return { lines, holdings, unobservedLineSessions, breaches, observations, unobserved };
}

// ── The endpoint ─────────────────────────────────────────────────────────────────────────────────────────────

/** The cost tier a holding is liquidated under: a fund's explicit tier; the tier a stock entered with (E5). */
export function exitTierOf(symbol, holding) {
  if (fundOf(symbol)) return { tier: costTierOf(frictionForSymbol(symbol, null)), stored: true };
  if (isCostTier(holding?.costTier)) return { tier: costTierOf(holding.costTier), stored: true };
  // A holding with no stored tier (none is written by this build) is costed at the model's widest tier and named.
  const widest = MANDATE_FRICTION_TIERS.unknown;
  return { tier: { capTier: 'unknown', slippageBps: widest.slippageBps, spreadProxyBps: widest.spreadProxyBps }, stored: false };
}

/**
 * One ledger's liquidation value at an endpoint close (E4): its cash, plus each holding at the close's mark, less
 * the modelled cost of selling it there. The same function for the idea, its comparison and SPY.
 *
 * @param {object} ledger     the ledger after the close's actions and marks
 * @param {object} valuation  its valuation at that close (valueLedger)
 * @returns {{ cashUsd: number, holdingsAtMarksUsd: number, modelledExitCostUsd: number, holdingsNetUsd: number,
 *             valueUsd: number, valueCents: number, rawValue: number, fullQuality: boolean, marksFullQuality: boolean,
 *             unsettledActions: string[], costTiersStored: boolean, holdings: Object<string, object> }}
 *   `fullQuality` is `marksFullQuality` (every mark is `vendor_time`) AND no unsettled conflicting corporate action:
 *   the two are kept apart so a result can say WHICH it lacked (review RH-7).
 */
export function ledgerEndpoint(ledger, valuation) {
  const cashCents = toCents(ledger.cash);
  let grossCents = 0;
  let netCents = 0;
  let rawNet = 0;
  const unsettledActions = unsettledConflicts(ledger).map((r) => r.actionId);
  let marksFullQuality = true;
  let costTiersStored = true;
  const holdings = {};
  for (const sym of Object.keys(ledger.holdings || {}).sort()) {
    const h = ledger.holdings[sym];
    const m = valuation.marks[sym];
    const { tier, stored } = exitTierOf(sym, h);
    if (!stored) costTiersStored = false;
    const sale = modelledSaleProceeds(h.shares, m.mark, tier);
    grossCents += toCents(sale.grossUsd);
    netCents += toCents(sale.netUsd);
    rawNet += sale.rawNet;
    if (m.quality !== MARK_QUALITY.VENDOR_TIME) marksFullQuality = false;
    holdings[sym] = {
      shares: h.shares, mark: m.mark, markQuality: m.quality, markVendorTimeIso: m.vendorTimeIso ?? null,
      costTier: tier, atMarkUsd: sale.grossUsd, netOfModelledCostUsd: sale.netUsd, modelledCostUsd: fromCents(toCents(sale.grossUsd) - toCents(sale.netUsd)),
    };
  }
  const valueCents = cashCents + netCents;
  return {
    cashUsd: fromCents(cashCents),
    // The sum of each holding's OWN rounded figure. The valuation row of the same close states the same holdings as
    // one raw sum rounded once (`markedHoldingsValue`); the two can differ by a cent per holding, so the row's figure
    // is carried here beside it rather than left to look like a disagreement (review SX-9).
    holdingsAtMarksUsd: fromCents(grossCents),
    rowMarkedHoldingsValueUsd: valuation.markedHoldingsValue ?? null,
    modelledExitCostUsd: fromCents(grossCents - netCents),
    holdingsNetUsd: fromCents(netCents),
    valueUsd: fromCents(valueCents),
    valueCents,
    rawValue: (Number(ledger.cash) || 0) + rawNet,
    fullQuality: marksFullQuality && unsettledActions.length === 0,
    marksFullQuality,
    unsettledActions,
    costTiersStored,
    holdings,
  };
}

// ── The running record ───────────────────────────────────────────────────────────────────────────────────────

const newSeries = () => ({ peakCents: null, peakOn: null, declineCents: 0, declinePeakCents: null, declinePeakOn: null, declineTroughOn: null });

/** Fold one recorded session-close value into a peak-to-trough series. Pure. */
function foldSeries(series, valueCents, date) {
  const s = { ...(series || newSeries()) };
  if (s.peakCents === null || valueCents > s.peakCents) { s.peakCents = valueCents; s.peakOn = date; return s; }
  const decline = s.peakCents - valueCents;
  if (decline > s.declineCents) { s.declineCents = decline; s.declinePeakCents = s.peakCents; s.declinePeakOn = s.peakOn; s.declineTroughOn = date; }
  return s;
}

/** The running record an idea starts with at entry. */
export function newTrack() {
  return { rows: 0, rowsNotFullQuality: 0, closes: 0, exposureSum: 0, idea: newSeries(), comparison: newSeries() };
}

/**
 * Fold one close's row into the idea's running record. An unobserved session (no stored close snapshot) counts as a
 * row that is not full quality and adds no close value: nothing was observed.
 */
export function foldCloseIntoTrack(track, row, { observed }) {
  const t = { ...newTrack(), ...(track || {}) };
  t.rows += 1;
  if (row.fullQuality !== true) t.rowsNotFullQuality += 1;
  if (!observed) return t;
  const valueCents = toCents(row.markedValue);
  t.closes += 1;
  t.exposureSum += valueCents > 0 ? toCents(row.markedHoldingsValue) / valueCents : 0;
  t.idea = foldSeries(t.idea, valueCents, row.date);
  t.comparison = foldSeries(t.comparison, toCents(row.comparisonMarkedValue), row.date);
  return t;
}

const declineOf = (series) => (series && series.declineCents > 0
  ? {
    usd: fromCents(series.declineCents),
    pctOfPriorPeak: (series.declineCents * 100) / series.declinePeakCents,
    priorPeakUsd: fromCents(series.declinePeakCents), peakOn: series.declinePeakOn, troughOn: series.declineTroughOn,
  }
  : { usd: 0, pctOfPriorPeak: 0, priorPeakUsd: series?.peakCents != null ? fromCents(series.peakCents) : null, peakOn: series?.peakOn ?? null, troughOn: null });

// ── The endpoint row and the result ──────────────────────────────────────────────────────────────────────────

/**
 * Build an idea's endpoint row and its result. Pure; called once per idea, by the close that reaches its endpoint.
 *
 * @param {object} args
 * @param {object} args.idea        the idea after this close's actions, marks, lines and running record
 * @param {{ idea: object, comparison: object, spy: object }} args.valuations  each ledger's valuation at this close
 * @param {string} args.date        the endpoint session
 * @param {string} args.kind        ENDPOINT_KIND
 * @param {boolean} args.observed   the session has a stored close snapshot
 * @param {boolean} [args.caughtUp] this close is a catch-up of a missed session: the endpoint is written late
 * @param {{ key: string|null, builtAt: string|null }} args.snapshotMeta
 * @param {string} args.nowIso
 * @returns {{ endpointRow: object, result: object }}
 */
export function buildEndpoint({ idea, valuations, date, kind, observed, caughtUp = false, snapshotMeta, nowIso }) {
  const own = ledgerEndpoint(idea.ledger, valuations.idea);
  const cmp = ledgerEndpoint(idea.comparisonLedger, valuations.comparison);
  const spy = ledgerEndpoint(idea.spyLedger, valuations.spy);
  const reservedCents = toCents(idea.contract.capitalUsd);
  const gapCents = own.valueCents - cmp.valueCents;
  const spyGapCents = own.valueCents - spy.valueCents;

  const endpointRow = {
    schemaVersion: IDEA_SCHEMA_VERSION,
    rowKind: 'endpoint',
    basis: 'liquidation_value',
    label: observed ? VALUATION_LABEL : VALUATION_LABEL_UNOBSERVED,
    ideaId: idea.ideaId,
    bookId: idea.bookId,
    endpointSession: date,
    dueSession: idea.contract.schedule.dueSession,
    endpointKind: kind,
    observed: observed === true,
    writtenLate: caughtUp === true,
    closeSnapshotKey: snapshotMeta?.key ?? null,
    closeSnapshotBuiltAt: snapshotMeta?.builtAt ?? null,
    reservedCapitalUsd: idea.contract.capitalUsd,
    comparisonType: idea.contract.comparison.type,
    idea: own,
    comparison: cmp,
    spy,
    gapUsd: fromCents(gapCents),
    gapPct: (gapCents * 100) / reservedCents,
    gapToSpyUsd: fromCents(spyGapCents),
    gapToSpyPct: (spyGapCents * 100) / reservedCents,
    raw: { ideaValue: own.rawValue, comparisonValue: cmp.rawValue, spyValue: spy.rawValue, gapUsd: own.rawValue - cmp.rawValue },
    writtenAt: nowIso,
  };

  // contractCondition (E6): breached if any line was recognised; else unobserved if any line went unobserved on any
  // session from entry to the endpoint; else met.
  const breaches = (idea.lines || []).filter((l) => l.breach).map((l) => ({ symbol: l.symbol, ...l.breach }));
  const unobservedLineSessions = idea.unobservedLineSessions || {};
  const unobservedCount = Object.values(unobservedLineSessions).reduce((n, d) => n + d.length, 0);
  const contractCondition = breaches.length > 0 ? CONTRACT_CONDITION.BREACHED
    : (unobservedCount > 0 ? CONTRACT_CONDITION.UNOBSERVED : CONTRACT_CONDITION.MET);

  // economicResult (E10): a label needs full-quality endpoint marks on the idea AND its comparison, from the
  // scheduled session. Computed from the rounded, displayed values (BUILD_RULES §9); the raw values sit beside.
  const unmeasurableBecause = [];
  if (!observed) unmeasurableBecause.push('endpoint_session_unobserved');
  if (kind === ENDPOINT_KIND.LATE) unmeasurableBecause.push('endpoint_after_due_session');
  if (!own.marksFullQuality) unmeasurableBecause.push('idea_mark_not_full_quality');
  if (!cmp.marksFullQuality) unmeasurableBecause.push('comparison_mark_not_full_quality');
  // A conflicting corporate action never settled leaves the value itself in doubt (a dividend never credited, a
  // split never applied) though every mark is clean: unmeasurable, under its own reason (review RH-7).
  if (own.unsettledActions.length > 0) unmeasurableBecause.push('idea_unsettled_corporate_action');
  if (cmp.unsettledActions.length > 0) unmeasurableBecause.push('comparison_unsettled_corporate_action');
  const bandCents = toCents(idea.contract.band.usd);
  let economicResult;
  if (unmeasurableBecause.length > 0) economicResult = ECONOMIC_RESULT.UNMEASURABLE;
  else if (gapCents > bandCents) economicResult = ECONOMIC_RESULT.AHEAD;
  else if (gapCents < -bandCents) economicResult = ECONOMIC_RESULT.BEHIND;
  else economicResult = ECONOMIC_RESULT.WITHIN_BAND;

  // processQuality (E15): blocked when a line exit or the endpoint valuation waited for data. (A settlement sale
  // can only wait AFTER this is written; it is recorded on the idea's live `processQuality` and its liquidation.)
  // The endpoint valuation "waited for data" when its session was never observed, when a mark of the idea's own was
  // not full quality, or when it was written late — by a catch-up, after its session (E12).
  const blockedBy = [...(idea.blockedBy || [])];
  if (!observed || kind === ENDPOINT_KIND.LATE || !own.marksFullQuality || caughtUp) {
    blockedBy.push({ kind: 'endpoint_valuation', session: date, ...(caughtUp ? { writtenLate: true } : {}) });
  }
  if (own.unsettledActions.length > 0) blockedBy.push({ kind: 'endpoint_unsettled_corporate_action', session: date, actions: own.unsettledActions });
  const processQuality = blockedBy.length > 0 ? PROCESS_QUALITY.BLOCKED : PROCESS_QUALITY.FOLLOWED_PLAN;

  const track = idea.track || newTrack();
  // Sales before the endpoint all carry the origin `line_exit`; one whose holding a delisting left waiting recognised
  // no line, so it is counted apart (review RH-3), by what queued it.
  const early = (idea.ledger.saleReceipts || []).filter((r) => r.kind === DECISION_ORIGIN_LINE_EXIT);
  const lineExits = early.filter((r) => r.queuedBy?.reason !== EXIT_REASON.DELISTING);
  const lineExitCostCents = lineExits.reduce((sum, r) => sum + toCents(r.frictionPaidUsd || 0), 0);
  const delistingExits = early.filter((r) => r.queuedBy?.reason === EXIT_REASON.DELISTING);
  const delistingExitCostCents = delistingExits.reduce((sum, r) => sum + toCents(r.frictionPaidUsd || 0), 0);

  const result = {
    resultVersion: RESULT_VERSION,
    writtenAt: nowIso,
    endpointSession: date,
    endpointKind: kind,
    endpointSnapshotKey: snapshotMeta?.key ?? null,
    endpointSnapshotBuiltAt: snapshotMeta?.builtAt ?? null,
    // 1
    contractCondition,
    contractDetail: { breaches, unobservedLineSessions, unobservedLineSessionCount: unobservedCount },
    // 2
    economicResult,
    economic: {
      ideaValueUsd: own.valueUsd, comparisonValueUsd: cmp.valueUsd, comparisonType: idea.contract.comparison.type,
      gapUsd: fromCents(gapCents), gapPctOfReserved: (gapCents * 100) / reservedCents,
      bandUsd: fromCents(bandCents), bandShareOfReserved: idea.contract.band.shareOfReserved,
      raw: endpointRow.raw, unmeasurableBecause,
    },
    // 3
    processQuality,
    processDetail: { blockedBy },
    // 4, 5 and the closing note: fixed in release 1 (E16)
    evidenceScope: EVIDENCE_SCOPE_SINGLE,
    adoption: ADOPTION_NO_OFFER,
    closingNote: null,
    oneObservationLabel: true,
    // Beside them (contract §4.4).
    spy: { valueUsd: spy.valueUsd, gapUsd: fromCents(spyGapCents), gapPctOfReserved: (spyGapCents * 100) / reservedCents, fullQuality: spy.fullQuality },
    largestDecline: { idea: declineOf(track.idea), comparison: declineOf(track.comparison), basis: 'recorded_session_close_values' },
    trades: {
      entry: { count: idea.entry?.legCount ?? null, costsUsd: idea.entry?.costsPaidUsd ?? null },
      lineExit: { count: lineExits.length, costsUsd: fromCents(lineExitCostCents) },
      // A holding sold because a delisting left it waiting: recorded with the origin `line_exit`, counted here, apart.
      delistingExit: { count: delistingExits.length, costsUsd: fromCents(delistingExitCostCents) },
    },
    investedExposure: { mean: track.closes > 0 ? track.exposureSum / track.closes : null, closes: track.closes },
    dataQuality: {
      rows: track.rows, rowsNotFullQuality: track.rowsNotFullQuality,
      unobservedLineSessions: unobservedCount,
      waitingDays: (idea.waitedSessions || []).length,
      costTiersStored: own.costTiersStored && cmp.costTiersStored && spy.costTiersStored,
    },
  };
  return { endpointRow, result };
}
