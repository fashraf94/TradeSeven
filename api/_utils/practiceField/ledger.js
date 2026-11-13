// api/_utils/practiceField/ledger.js
//
// Practice Field T1a-1 — ONE LEDGER SHAPE for everything an idea accounts for (shared contract V2 §4.2; Astra V6
// C6-01). An idea carries three ledgers, all of this shape and all valued and adjusted by the SAME functions:
//
//   ledger            the idea's own sub-ledger: its reserved cash and its holdings. Its holdings are ALSO positions
//                     in the book's portfolio (each stamped with the idea's id), and the two are reconciled after
//                     every mutation (reconcile.js, B-RECON);
//   comparisonLedger  the matched comparison: paper beside the book, never part of its portfolio;
//   spyLedger         the SPY context line: the same.
//
// A ledger's holdings use the ENGINE'S POSITION SHAPE ({ shares, costBasisTotal, avgCost, lastMark, lastMarkAsOf,
// lastMarkSource, sector, openedAt }) so the engine's pure functions work on any of them unchanged: computeExecution
// fills them, markBook values them, pendingActionsFor / applyCorporateAction adjust them (`openedAt` is what a
// split or a dividend is entitled by; without it the engine declines the action).
//
// COSTS ENTER ONCE: a fill's friction is inside the price it paid, so it is already in the ledger's cash and basis.
// `costsPaidUsd` is a running record for display; it is never subtracted from anything (Astra V5 A4).
//
// CORPORATE ACTIONS ARE APPLIED ONCE PER LEDGER. The daily layer presents the same action on several consecutive
// closes (its window reaches five days back), and one action (a SPY dividend) can belong to several ledgers at
// once. Each ledger therefore keeps its OWN record of the action ids it has applied or declined, and an action is
// applied to a ledger only when its id is in neither list. Only splits, reverse splits, stock distributions and
// cash dividends are applied here: a ticker change or a delisting is NOT (the engine's delisting is a forced sale
// at a carried mark, which an idea book never does — B-NOFILL); such a symbol is reported `unresolved`, valued at
// its carried mark and marked not-full-quality until T1a-2's policy decides it.
//
// ONE ACTION, ONE APPLICATION, EVEN WHEN THE FEED LISTS IT TWICE (Astra T1A-01). The feed parser keeps duplicate
// vendor rows and the engine's selector checks only the ids settled BEFORE the call, so two identical rows in one
// window would both pay, or both multiply. Within one call every row is keyed by the engine's `deriveActionId`
// (type, ticker, effective date): the first row of an id is processed and every later row of that id is skipped.
// Two rows with one id and DIFFERENT payloads (an amount or a ratio — the id already fixes the rest) are a
// conflict: neither is applied, the ledger records one `conflicting_action` receipt for the id, and the symbol is
// valued at its carried mark, not full quality, exactly as R-9 holds an unsupported action. A conflict is not
// settled (its id goes to neither list), so a feed that later presents one consistent row still applies it once.
//
// Pure: no store, no clock.

import { markBook } from '../mandateValuation.js';
import { snapshotExcluding } from '../mandateUniverseSnapshot.js';
import { pendingActionsFor, applyCorporateAction, classifyOvernightGaps, deriveActionId } from '../mandateCorporateActions.js';
import { roundUsd } from '../mandateRounding.js';
import { MARK_QUALITY } from './constants.js';
import { closeMarkQuality } from './marks.js';
import { addUsd } from './money.js';

export const LEDGER_KIND = Object.freeze({ IDEA: 'idea', COMPARISON: 'comparison', SPY: 'spy' });

/** A new ledger holding `reservedCapitalUsd` in cash and nothing else. */
export function newLedger(kind, reservedCapitalUsd) {
  const reserved = roundUsd(reservedCapitalUsd);
  return {
    kind,
    reservedCapitalUsd: reserved,
    cash: reserved,
    holdings: {},
    costsPaidUsd: 0,
    dividendsUsd: 0,
    realizedPnlUsd: 0,
    appliedActionIds: [],
    declinedActionIds: [],
    corporateActionReceipts: [],
  };
}

/** A deep-enough copy: holdings and lists are fresh objects, so a caller may build the next state freely. */
export function cloneLedger(ledger) {
  const holdings = {};
  for (const [sym, h] of Object.entries(ledger.holdings || {})) holdings[sym] = { ...h };
  return {
    ...ledger,
    holdings,
    appliedActionIds: [...(ledger.appliedActionIds || [])],
    declinedActionIds: [...(ledger.declinedActionIds || [])],
    corporateActionReceipts: [...(ledger.corporateActionReceipts || [])],
  };
}

/**
 * The comparison ledger for `same_stock_held`: EXACTLY the idea's quantities, basis, costs and residual cash at
 * entry — so an idea that never trades ties its comparison to the cent (build prompt §6).
 */
export function mirrorLedger(kind, source) {
  const copy = cloneLedger(source);
  return { ...copy, kind };
}

const SHARE_BASIS_TYPES = new Set(['split', 'reverse_split', 'stock_distribution']);
const APPLICABLE_TYPES = new Set([...SHARE_BASIS_TYPES, 'cash_dividend']);

/** The receipt reason of an action id the feed listed twice with different payloads (Astra T1A-01). */
export const CONFLICTING_ACTION = 'conflicting_action';

/** What makes two feed rows of one id the same action. The id already fixes the type, ticker and effective date. */
const actionPayloadOf = (row) => JSON.stringify([row.ratio ?? null, row.amount ?? null]);

/**
 * The ids, among this call's due rows, that the feed lists more than once with different payloads.
 * @returns {Map<string, Array<object>>}  id → every row of it (in feed order)
 */
function conflictingActionIds(rows) {
  const byId = new Map();
  for (const row of rows) {
    const id = deriveActionId(row);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(row);
  }
  const conflicts = new Map();
  for (const [id, group] of byId) if (new Set(group.map(actionPayloadOf)).size > 1) conflicts.set(id, group);
  return conflicts;
}

/**
 * Apply every corporate action this ledger is due on or before `date`, once — and once per id within this call
 * (Astra T1A-01), however many rows of it the feed carries.
 *
 * @param {object} ledger
 * @param {object} actionsBySymbol  `{ SYM: [normalized actions] }` from the close snapshot (caActionsBySymbol)
 * @param {{ date: string }} opts   the session date being closed
 * @returns {{ ledger: object, applied: Array<object>, declined: Array<object>, unresolved: Set<string>,
 *             conflicts: Array<object>,
 *             shareBasisChanges: Array<{ ticker: string, ratio: number, actionId: string }> }}
 */
export function applyLedgerActions(ledger, actionsBySymbol, { date }) {
  const next = cloneLedger(ledger);
  const settled = new Set([...next.appliedActionIds, ...next.declinedActionIds]);
  const { pending, unrecognized, notEntitled, noEntitlementData } = pendingActionsFor(
    next.holdings, actionsBySymbol, { onOrBefore: date, appliedIds: settled },
  );
  const applied = [];
  const declined = [];
  const unresolved = new Set();
  const shareBasisChanges = [];
  const conflicts = [];

  // A conflict is applied to nobody and settled by nobody: one receipt per id per ledger, a carried mark.
  const conflicting = conflictingActionIds([...pending, ...notEntitled, ...noEntitlementData, ...unrecognized]);
  for (const [id, group] of conflicting) {
    const first = group[0];
    unresolved.add(first.ticker);
    const receipt = {
      actionId: id, type: first.type, ticker: first.ticker, effectiveDate: first.effectiveDate, applied: false, reason: CONFLICTING_ACTION,
      rows: group.map((row) => ({ ratio: row.ratio ?? null, amount: row.amount ?? null, source: row.source ?? null })), seenOn: date,
    };
    conflicts.push(receipt);
    if (!next.corporateActionReceipts.some((r) => r.actionId === id && r.reason === CONFLICTING_ACTION)) next.corporateActionReceipts.push(receipt);
  }

  // Every other id is processed at its FIRST row in this call; a repeated row of it is skipped.
  const seen = new Set(conflicting.keys());
  const firstOf = (row) => {
    const id = deriveActionId(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  };

  for (const decl of notEntitled) {
    if (!firstOf(decl)) continue;
    // Bought on or after the effective date: the price paid already reflects the action. Declined, durably.
    next.declinedActionIds.push(decl.actionId);
    const receipt = { actionId: decl.actionId, type: decl.type, ticker: decl.ticker, effectiveDate: decl.effectiveDate, applied: false, reason: 'not_entitled', seenOn: date };
    next.corporateActionReceipts.push(receipt);
    declined.push(receipt);
  }
  for (const bad of [...noEntitlementData, ...unrecognized]) unresolved.add(bad.ticker);

  for (const action of pending) {
    if (!firstOf(action)) continue;
    if (!APPLICABLE_TYPES.has(action.type)) { unresolved.add(action.ticker); continue; }
    const out = applyCorporateAction({ positions: next.holdings, cash: next.cash }, action);
    if (!out.ok) { unresolved.add(action.ticker); continue; }
    // A share-basis action that would round a holding to nothing is not applied (review L1-1): the symbol is held at
    // its carried mark, not full quality, until T1a-2's policy decides it — never a holding of zero shares with a basis.
    if (SHARE_BASIS_TYPES.has(action.type) && !(Number(out.positions[action.ticker]?.shares) > 0)) { unresolved.add(action.ticker); continue; }
    next.holdings = out.positions;
    next.cash = out.cash;
    next.dividendsUsd = addUsd(next.dividendsUsd, out.incomeUsd);
    next.appliedActionIds.push(action.actionId);
    const receipt = {
      actionId: action.actionId, type: action.type, ticker: action.ticker, effectiveDate: action.effectiveDate,
      ratio: action.ratio ?? null, amount: action.amount ?? null, incomeUsd: out.incomeUsd,
      applied: true, appliedOn: date, source: action.source ?? null, note: out.note,
    };
    next.corporateActionReceipts.push(receipt);
    applied.push({ ...action, receipt });
    if (SHARE_BASIS_TYPES.has(action.type)) shareBasisChanges.push({ ticker: action.ticker, ratio: Number(action.ratio), actionId: action.actionId });
  }
  return { ledger: next, applied, declined, unresolved, conflicts, shareBasisChanges };
}

/**
 * Value a ledger at the close snapshot. A VALUATION, never a fill: it reads marks and changes nothing.
 *
 * A symbol the snapshot cannot mark — absent, incomplete, in `frozen` (an unresolved or suspected corporate
 * action) — is valued at the ledger's own last mark and labelled `carried_forward`. `fullQuality` is false
 * whenever any mark is not `vendor_time`.
 *
 * @returns {{ rawValue: number, rawPositionsValue: number, markedValue: number, markedHoldingsValue: number, cash: number,
 *             marks: Object<string, { mark: number, shares: number, quality: string, markSource: string, vendorTimeIso: string|null }>,
 *             fullQuality: boolean }}
 */
export function valueLedger(ledger, closeSnapshot, { sessionDate, frozen = null } = {}) {
  const markingSnapshot = frozen && frozen.size > 0 ? snapshotExcluding(closeSnapshot, frozen) : closeSnapshot;
  const { marked, positionsValue, totalValue } = markBook(ledger.holdings, ledger.cash, markingSnapshot);
  const marks = {};
  let fullQuality = true;
  for (const [sym, m] of Object.entries(marked)) {
    const fromSnapshot = m.markSource === 'snapshot';
    const q = fromSnapshot
      ? closeMarkQuality(closeSnapshot?.symbols?.[sym] ?? null, sessionDate)
      : { quality: MARK_QUALITY.CARRIED_FORWARD, vendorTimeIso: null };
    if (q.quality !== MARK_QUALITY.VENDOR_TIME) fullQuality = false;
    marks[sym] = { mark: m.mark, shares: m.shares, quality: q.quality, markSource: m.markSource, vendorTimeIso: q.vendorTimeIso };
  }
  // BUILD_RULES §9: the displayed value is the sum of its displayed parts — the cash (already whole cents) and the
  // holdings' value rounded once — never a second rounding of the raw total.
  const cash = roundUsd(ledger.cash);
  const markedHoldingsValue = roundUsd(positionsValue);
  return {
    rawValue: totalValue,
    rawPositionsValue: positionsValue,
    markedValue: addUsd(cash, markedHoldingsValue),
    markedHoldingsValue,
    cash,
    marks,
    fullQuality,
  };
}

/**
 * Write a valuation's marks back onto the ledger's holdings (tomorrow's gap screen compares against today's
 * mark). Cash, quantities and basis are untouched.
 */
export function withCloseMarks(ledger, valuation) {
  const next = cloneLedger(ledger);
  for (const [sym, h] of Object.entries(next.holdings)) {
    const m = valuation.marks[sym];
    if (!m) continue;
    const fresh = m.markSource === 'snapshot';
    next.holdings[sym] = {
      ...h,
      lastMark: m.mark,
      lastMarkAsOf: fresh ? (m.vendorTimeIso ?? h.lastMarkAsOf ?? null) : (h.lastMarkAsOf ?? null),
      lastMarkSource: fresh ? 'snapshot' : m.markSource,
    };
  }
  return next;
}

/**
 * The symbols whose close mark must NOT be trusted for this ledger today: an overnight gap that a corporate action
 * in the feed has not yet been applied to explain, or that has a split's signature with no feed entry (the engine's
 * gap screen, I7 — a missed split would otherwise halve a recorded value). Actions this ledger has just applied or
 * declined are settled and excluded.
 */
export function suspectedActionSymbols(ledger, closeSnapshot, actionsBySymbol, { sinceDate, date }) {
  const settled = new Set([...(ledger.appliedActionIds || []), ...(ledger.declinedActionIds || [])]);
  const scan = classifyOvernightGaps(ledger.holdings, closeSnapshot, actionsBySymbol, {
    sinceDate: sinceDate ?? null, asOfDate: date, excludeActionIds: settled,
  });
  return scan.frozen;
}
