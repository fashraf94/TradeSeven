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
// applied to a ledger only when its id is in neither list. Splits, reverse splits, stock distributions and cash
// dividends are applied as T1a-1 built them. T1a-2a (Amendment E11) adds the two identity events:
//   ticker change   the holding's key migrates to the new symbol on every ledger that holds the name; no cash moves;
//                   one receipt per ledger. The caller renames the line, the book's position and the coverage entry.
//   delisting       NEVER A SALE. With a cash amount per share on the action it is credited as a receipted corporate
//                   action on every ledger that holds the name and the holding closes: the cash, less the holding's
//                   cost basis, is the ledger's realised profit or loss, recorded on the action's receipt (the
//                   reconciliation checks the sum, as it checks dividends). WITHOUT one, nothing is applied: the
//                   engine's forced close at a carried mark never reaches an idea book (B-NOFILL). The symbol is
//                   reported `delistedWaiting` and `unresolved` (carried mark, not full quality), and the idea's own
//                   holding becomes a waiting sale (close.js; Amendment E9).
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
// THE BOOK'S MARKED EQUITY has one rounding basis, stated below (`markedEquityCents`).
//
// Pure: no store, no clock.

import { markBook } from '../mandateValuation.js';
import { snapshotExcluding, caActionsBySymbol } from '../mandateUniverseSnapshot.js';
import { pendingActionsFor, applyCorporateAction, classifyOvernightGaps, deriveActionId } from '../mandateCorporateActions.js';
import { roundUsd } from '../mandateRounding.js';
import { MARK_QUALITY } from './constants.js';
import { closeMarkQuality } from './marks.js';
import { addUsd, toCents } from './money.js';

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
    // Kept for the life of the ledger (Astra's condition on the receipt rule): the reconciliation ties the ledger's
    // dividends and its realised profit and loss to these two lists, so nothing may prune them.
    corporateActionReceipts: [],
    saleReceipts: [],
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
    saleReceipts: [...(ledger.saleReceipts || [])],
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
const APPLICABLE_TYPES = new Set([...SHARE_BASIS_TYPES, 'cash_dividend', 'ticker_change', 'delisting']);

/** A delisting's cash per share, only when it is a real positive amount. */
const delistingCashOf = (action) => (typeof action?.cashPerShare === 'number' && Number.isFinite(action.cashPerShare) && action.cashPerShare > 0 ? action.cashPerShare : null);
const upper = (s) => String(s || '').trim().toUpperCase();

/** The receipt reason of an action id the feed listed twice with different payloads (Astra T1A-01). */
export const CONFLICTING_ACTION = 'conflicting_action';

/**
 * The `conflicting_action` receipts on a ledger whose action is not settled since — neither applied nor declined —
 * and that the holding was entitled to. A row of the idea stays not full quality while any is open (close.js; review
 * FR-A1). A conflict on an action the holding is NOT entitled to (bought on or after its effective date) owed
 * nothing whatever its payload, so it is held back only while the feed presents it, never afterwards (refuter RF-A1).
 */
export function unsettledConflicts(ledger) {
  const settled = new Set([...(ledger?.appliedActionIds || []), ...(ledger?.declinedActionIds || [])]);
  return (ledger?.corporateActionReceipts || []).filter((r) => r?.reason === CONFLICTING_ACTION && r.entitled !== false && !settled.has(r.actionId));
}

/** What makes two feed rows of one id the same action. The id already fixes the type, ticker and effective date. */
const actionPayloadOf = (row) => JSON.stringify([row.ratio ?? null, row.amount ?? null, row.renamedTo ?? null, row.cashPerShare ?? null]);

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
 *             shareBasisChanges: Array<{ ticker: string, ratio: number, actionId: string }>,
 *             renames: Array<{ from: string, to: string, actionId: string }>,
 *             closedByCash: Array<{ ticker: string, actionId: string, cashUsd: number, realizedPnlUsd: number }>,
 *             delistedWaiting: Array<{ ticker: string, actionId: string, effectiveDate: string }> }}
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
  const renames = [];
  const closedByCash = [];
  const delistedWaiting = [];

  // A conflict is applied to nobody and settled by nobody: one receipt per id per ledger, a carried mark.
  const conflicting = conflictingActionIds([...pending, ...notEntitled, ...noEntitlementData, ...unrecognized]);
  // The rows of one id share a type and an effective date, so they share an entitlement: one list holds them all.
  const notEntitledIds = new Set(notEntitled.map((row) => deriveActionId(row)));
  for (const [id, group] of conflicting) {
    const first = group[0];
    // The holding's own key (upper case), whatever case a feed row carries — the id is normalised the same way.
    unresolved.add(String(first.ticker || '').trim().toUpperCase());
    const receipt = {
      actionId: id, type: first.type, ticker: first.ticker, effectiveDate: first.effectiveDate, applied: false, reason: CONFLICTING_ACTION,
      entitled: !notEntitledIds.has(id),
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
    // A delisting with no cash amount is NOT applied (E11): the engine's applier would force a sale at the carried
    // mark. It is settled by nobody, so a later row that does carry the cash still applies, once.
    if (action.type === 'delisting' && delistingCashOf(action) === null) {
      unresolved.add(action.ticker);
      delistedWaiting.push({ ticker: upper(action.ticker), actionId: action.actionId, effectiveDate: action.effectiveDate });
      continue;
    }
    const heldBefore = next.holdings[upper(action.ticker)] || null;
    const out = applyCorporateAction({ positions: next.holdings, cash: next.cash }, action);
    if (!out.ok) { unresolved.add(action.ticker); continue; }
    if (action.type === 'delisting') {
      // The engine credited shares × the deal's cash and dropped the holding. It must have priced at the cash amount
      // itself — never at a mark — or nothing is applied.
      if (!out.forcedClose || out.forcedClose.mark !== delistingCashOf(action)) { unresolved.add(action.ticker); continue; }
      next.holdings = out.positions;
      next.cash = out.cash;
      next.realizedPnlUsd = addUsd(next.realizedPnlUsd, out.forcedClose.realizedPnl);
      next.appliedActionIds.push(action.actionId);
      const receipt = {
        actionId: action.actionId, type: action.type, ticker: action.ticker, effectiveDate: action.effectiveDate,
        cashPerShare: delistingCashOf(action), shares: out.forcedClose.shares, cashUsd: out.forcedClose.proceeds,
        costBasisUsd: roundUsd(Number(heldBefore?.costBasisTotal) || 0), realizedPnlUsd: out.forcedClose.realizedPnl, incomeUsd: 0,
        applied: true, appliedOn: date, source: action.source ?? null, note: out.note,
      };
      next.corporateActionReceipts.push(receipt);
      applied.push({ ...action, receipt });
      closedByCash.push({ ticker: upper(action.ticker), actionId: action.actionId, cashUsd: receipt.cashUsd, realizedPnlUsd: receipt.realizedPnlUsd });
      continue;
    }
    if (action.type === 'ticker_change') {
      next.holdings = out.positions;
      next.appliedActionIds.push(action.actionId);
      const receipt = {
        actionId: action.actionId, type: action.type, ticker: action.ticker, effectiveDate: action.effectiveDate,
        renamedTo: upper(action.renamedTo), incomeUsd: 0, applied: true, appliedOn: date, source: action.source ?? null, note: out.note,
      };
      next.corporateActionReceipts.push(receipt);
      applied.push({ ...action, receipt });
      renames.push({ from: upper(action.ticker), to: upper(action.renamedTo), actionId: action.actionId });
      continue;
    }
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
  return { ledger: next, applied, declined, unresolved, conflicts, shareBasisChanges, renames, closedByCash, delistedWaiting };
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

// ── THE ROUNDING BASIS OF A BOOK'S MARKED EQUITY (R-19; Astra T1A-02) ─────────────────────────────────────────
// Stated ONCE, here. The entry (the equity it writes), the close (the equity and the book row it writes) and the
// reconciliation (rule 7, which checks the equity a book carries) all use it, so they cannot drift apart:
//
//   each open idea's holdings at the marks RECORDED on them (`lastMark`; average cost only for a holding that has
//   none), Σ shares × mark, rounded ONCE to a cent per idea — exactly the `markedHoldingsValue` of that idea's row;
//   the book's marked equity = the treasury's unreserved cash + Σ open ideas' (cash + that value), in whole cents.
//
// The book's figure is the sum of its ideas' figures: a book row, its idea rows and the permitted maximum agree to
// the cent. `portfolio.totalValue` is that number, as the last entry or close wrote it; admission reads it.

/** A ledger's holdings valued at the marks recorded on them, in whole cents (rounded once). */
export function recordedHoldingsCents(ledger) {
  return toCents(markBook(ledger?.holdings || {}, 0, null).positionsValue);
}

/**
 * The book's marked equity on the R-19 basis, in whole cents, with its parts.
 * @param {number} treasuryUnreservedCash  the book's `treasury.unreservedCash`
 * @param {Array<object>} ideas           the book's open ideas (their own ledgers; never a comparison or SPY)
 * @returns {{ treasuryCents: number, cashCents: number, holdingsCents: number, equityCents: number }}
 */
export function markedEquityCents(treasuryUnreservedCash, ideas) {
  const treasuryCents = toCents(treasuryUnreservedCash);
  let cashCents = 0;
  let holdingsCents = 0;
  for (const idea of ideas || []) {
    cashCents += toCents(idea?.ledger?.cash);
    holdingsCents += recordedHoldingsCents(idea?.ledger);
  }
  return { treasuryCents, cashCents, holdingsCents, equityCents: treasuryCents + cashCents + holdingsCents };
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
 * Why a SALE of `symbol` on this ledger must not fill from `snapshot` on `date`, or null (review SX-1). Corporate
 * actions are applied at the close, so a window on the day one takes effect shows the already-adjusted price beside
 * a holding that is not yet adjusted: selling there sells the old share count at the new price, or sells ex-dividend
 * a holding that is owed the dividend. The sale waits (Amendment E9) when:
 *   corporate_action_pending    the feed lists an action for the symbol, effective on or before `date`, that this
 *                               ledger has neither applied nor declined and the holding is entitled to — or one it
 *                               cannot classify. A DELISTING WITH NO CASH AMOUNT does not count: it is never settled,
 *                               and it is the very reason such a holding is waiting to be sold (E11);
 *   corporate_action_unsettled  the ledger holds an unsettled conflicting action on the symbol;
 *   suspected_corporate_action  the engine's gap screen: an overnight move with a split's signature, or one a feed
 *                               action explains, that the ledger has not applied.
 * The same screen the close uses to hold a MARK back, asked before a fill — with one exception: a holding a delisting
 * left waiting (E11) is not put through the gap screen. Its mark has been carried since the delisting, and a delisted
 * name's price falling to a half or a third of that is the delisting, not a split; held back on that signature its
 * sale could wait for ever (review, lens 1 refuter). Listed actions and unsettled conflicts still hold it back.
 */
export function saleHeldBackBy(ledger, symbol, snapshot, { sinceDate, date }) {
  const holding = ledger?.holdings?.[symbol];
  if (!holding) return null;
  const actionsBySymbol = caActionsBySymbol(snapshot);
  const one = { [symbol]: holding };
  const settled = new Set([...(ledger.appliedActionIds || []), ...(ledger.declinedActionIds || [])]);
  const due = pendingActionsFor(one, actionsBySymbol, { onOrBefore: date, appliedIds: settled });
  // A conflicting CASH DIVIDEND holds the sale only WHILE THE FEED STILL LISTS A ROW OF IT (the pending rule above
  // covers that: the feed may yet settle on one row, and the close then credits the idea what its comparison gets —
  // third refuter pass). Once the feed lists none it can never settle, and it puts no share count in doubt: holding
  // the sale then would hold the capital for good and protect nothing (second refuter pass, 2b). The feed's window
  // is a few days, so that wait is bounded. A conflict of ANY other kind, or of none it can name, still holds.
  const conflicts = unsettledConflicts(ledger).filter((r) => upper(r.ticker) === symbol);
  const waitingFor = [...due.pending, ...due.noEntitlementData, ...due.unrecognized]
    .filter((a) => !(a.type === 'delisting' && delistingCashOf(a) === null));
  if (waitingFor.length > 0) return 'corporate_action_pending';
  if (conflicts.some((r) => r.type !== 'cash_dividend')) return 'corporate_action_unsettled';
  const delistedWaiting = holding.exitPending?.reason === 'delisting' || holding.settlementPending?.replacedExit?.reason === 'delisting';
  if (delistedWaiting) return null;
  const gaps = classifyOvernightGaps(one, snapshot, actionsBySymbol, { sinceDate: sinceDate ?? null, asOfDate: date, excludeActionIds: settled });
  return gaps.frozen.has(symbol) ? 'suspected_corporate_action' : null;
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
