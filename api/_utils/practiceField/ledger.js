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
// A TICKER CHANGE WAITS WHILE THE HOLDING'S SHARE BASIS IS UNRESOLVED (Astra T2A-01). A conflict's receipt, and the
// sale guard that reads it, know the holding by its old ticker: a rename applied over an unresolved split, reverse
// split or stock distribution would carry the unadjusted share count to a ticker no receipt names, and its sale would
// sell it. So ticker changes are taken LAST in a call, after every other action, and one for a symbol whose share
// basis is still unresolved — an unsettled share-basis conflict, or a share-basis action due that the ledger has
// neither applied nor declined (unsettledShareBasisSymbols) — is NOT applied. The holding keeps its symbol, carries
// `deferredRename: { from, to, actionId, effectiveDate, deferredOn }` (on the holding, so a basket can wait on two
// names at once; it survives the feed dropping the rename row), is valued at its carried mark, and its sale stays
// held under its own name. The close decides this for the WHOLE idea (renameDeferralSymbols): if any of its ledgers
// has the symbol unresolved, no ledger renames it, so a same-stock comparison stays tied. At the close where the
// share basis settles, the rename is applied — from the feed's row if it still lists one, else from the record —
// after the share-basis action and before marks, receipted with `deferred: true` and the session it waited from.
// Nothing guesses a ratio: a conflict that never settles holds the holding under the founder's alert (C-6).
//
// NOTHING THAT DEPENDS ON A SHARE COUNT RUNS WHILE THE SHARE COUNT IS IN DOUBT (fix round 2; Astra T2A-C01). A sale and
// a rename already waited; a cash delisting did not, so it paid shares × cashPerShare on an unadjusted count, resolved
// the idea and returned that cash to the treasury. Now every COUNT-DEPENDENT action — a cash delisting, a cash dividend,
// and a later split, reverse split or stock distribution — of a symbol whose share basis is unresolved by an action
// dated on or before it (strictly before, for a share-basis action) waits, on EVERY ledger of the idea (the close's
// hold set, shareBasisHolds, decides for the idea as renameDeferralSymbols did). Not applied, not settled: the holding
// keeps `heldActions: [{ actionId, type, ticker, effectiveDate, ratio, amount, cashPerShare, source, heldOn,
// heldBecause }]` (the payload the feed last listed; it survives the feed dropping the row), stays at its carried mark,
// keeps its slot and alerts at every close. An action dated BEFORE the unresolved one is paid on the count before it,
// which is settled. At the close where the basis settles: the share-basis action, then each held action in date order
// on the count it leaves — once on each entitled ledger and in the book's mirror, its receipt saying `held: true` and
// `heldOn` — then any waiting rename, then marks. On one date, share-basis actions come first. A held record is released
// only when every share-basis action it waits on is settled on the ledger that had it, so a due row the feed drops
// keeps holding it (never paid on the unadjusted count). If the basis never settles, nothing guesses.
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
const settledIdsOf = (ledger) => new Set([...(ledger?.appliedActionIds || []), ...(ledger?.declinedActionIds || [])]);

/**
 * An action whose AMOUNT OR EFFECT DEPENDS ON THE HOLDING'S SHARE COUNT (fix round 2, the share-basis class): a split,
 * reverse split or stock distribution (shares × ratio), a cash dividend (shares × amount) and a delisting with cash
 * (shares × cashPerShare). Each waits while the count it would act on is in doubt. A rename waits too (below), and a
 * sale (saleHeldBackBy). A delisting with NO cash amount is never applied (E11) and moves no count.
 */
const countDependent = (action) => SHARE_BASIS_TYPES.has(action?.type) || action?.type === 'cash_dividend'
  || (action?.type === 'delisting' && delistingCashOf(action) !== null);

/** The receipt reason of an action id the feed listed twice with different payloads (Astra T1A-01). */
export const CONFLICTING_ACTION = 'conflicting_action';

/**
 * The `conflicting_action` receipts on a ledger whose action is not settled since — neither applied nor declined —
 * and that the holding was entitled to. A row of the idea stays not full quality while any is open (close.js; review
 * FR-A1). A conflict on an action the holding is NOT entitled to (bought on or after its effective date) owed
 * nothing whatever its payload, so it is held back only while the feed presents it, never afterwards (refuter RF-A1).
 */
export function unsettledConflicts(ledger) {
  const settled = settledIdsOf(ledger);
  return (ledger?.corporateActionReceipts || []).filter((r) => r?.reason === CONFLICTING_ACTION && r.entitled !== false && !settled.has(r.actionId));
}

/**
 * THE HELD ACTIONS of a ledger (fix round 2): `[{ symbol, ...record }]`, one per action a holding is owed but that waits
 * for its share basis. A record lives on the HOLDING (`heldActions`), as a waiting rename's does, so it survives the
 * feed dropping the row: `{ actionId, type, ticker, effectiveDate, ratio, amount, cashPerShare, source, heldOn,
 * heldBecause: [{ actionId, type, effectiveDate, ledger }] }` — the payload the feed last listed, the session it first
 * waited from, and the share-basis actions it waits on (each named with the ledger that has it unresolved).
 */
export function heldActionRecords(ledger) {
  const out = [];
  for (const [symbol, h] of Object.entries(ledger?.holdings || {})) for (const r of h?.heldActions || []) out.push({ symbol, ...r });
  return out;
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

const itemOf = (a, ledger) => ({ actionId: a.actionId, type: a.type, effectiveDate: a.effectiveDate ?? null, ledger });
const byItem = (a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || a.actionId.localeCompare(b.actionId) || String(a.ledger).localeCompare(String(b.ledger));
const addItem = (map, sym, item) => {
  const key = upper(sym);
  const list = map.get(key) || [];
  if (!list.some((i) => i.actionId === item.actionId && i.ledger === item.ledger)) list.push(item);
  map.set(key, list);
};

/**
 * THE SHARE-BASIS ACTIONS this ledger has not settled on `date`, by symbol (Astra T2A-01; fix round 2): an unsettled
 * conflicting split, reverse split or stock distribution it was entitled to (unsettledConflicts); one due on or before
 * `date` — listed now — that it has neither applied nor declined (one it could not apply, or one with no entitlement
 * data); one it HOLDS behind an earlier unresolved one; and every share-basis action a held record of this ledger still
 * waits on that the ledger has not settled — so a due row the feed drops while an action waits on it keeps holding it
 * (the fail-closed side of R-46; nothing remembers such a row otherwise).
 * @returns {Map<string, Array<{ actionId: string, type: string, effectiveDate: string|null, ledger: string|null }>>}
 */
export function unresolvedShareBasis(ledger, actionsBySymbol, { date }) {
  const out = new Map();
  const kind = ledger?.kind ?? null;
  const settled = settledIdsOf(ledger);
  const due = pendingActionsFor(ledger?.holdings || {}, actionsBySymbol || {}, { onOrBefore: date, appliedIds: settled });
  for (const a of [...due.pending, ...due.noEntitlementData]) if (SHARE_BASIS_TYPES.has(a.type)) addItem(out, a.ticker, itemOf(a, kind));
  for (const r of unsettledConflicts(ledger)) if (SHARE_BASIS_TYPES.has(r.type)) addItem(out, r.ticker, itemOf(r, kind));
  for (const r of heldActionRecords(ledger)) {
    if (settled.has(r.actionId)) continue;
    if (SHARE_BASIS_TYPES.has(r.type)) addItem(out, r.symbol, itemOf(r, kind));
    for (const c of r.heldBecause || []) if (c?.ledger === kind && !settled.has(c.actionId)) addItem(out, r.symbol, { ...c });
  }
  for (const list of out.values()) list.sort(byItem);
  return out;
}

/** The symbols of unresolvedShareBasis. A ticker change for such a symbol waits (applyLedgerActions). */
export function unsettledShareBasisSymbols(ledger, actionsBySymbol, { date }) {
  return new Set(unresolvedShareBasis(ledger, actionsBySymbol, { date }).keys());
}

/**
 * THE IDEA'S HOLD SET at this close (Astra T2A-01, T2A-C01): every share-basis action unresolved on ANY of its ledgers
 * once this close's share-basis actions are applied (to a copy, with cash actions and renames withheld — a cash
 * delisting applied here would drop the holding and hide a due row on it). Every ledger is handed the same set, so a
 * same-stock comparison makes the same choice as its idea: an action that depends on the count waits on all of them,
 * or on none. Pure.
 * @returns {Map<string, Array<{ actionId, type, effectiveDate, ledger }>>}  symbol → what it waits on
 */
export function shareBasisHolds(ledgers, actionsBySymbol, { date }) {
  const out = new Map();
  for (const ledger of ledgers || []) {
    if (!ledger) continue;
    const after = applyActions(ledger, actionsBySymbol, { date, phase: 'share_basis' }).ledger;
    for (const [sym, items] of unresolvedShareBasis(after, actionsBySymbol, { date })) for (const i of items) addItem(out, sym, i);
  }
  for (const list of out.values()) list.sort(byItem);
  return out;
}

/**
 * The symbols whose ticker change must wait on EVERY ledger of an idea at this close (Astra T2A-01): the symbols of
 * shareBasisHolds.
 */
export function renameDeferralSymbols(ledgers, actionsBySymbol, { date }) {
  return new Set(shareBasisHolds(ledgers, actionsBySymbol, { date }).keys());
}

/**
 * Apply every corporate action this ledger is due on or before `date`, once — and once per id within this call
 * (Astra T1A-01), however many rows of it the feed carries. An action that depends on the share count waits while
 * the count is in doubt; ticker changes come last, and wait too (Astra T2A-01, T2A-C01; see the header).
 *
 * @param {object} ledger
 * @param {object} actionsBySymbol  `{ SYM: [normalized actions] }` from the close snapshot (caActionsBySymbol)
 * @param {{ date: string, holds?: Map, deferRenames?: Set<string>, renameTargetsTaken?: Set<string>, renameIdsScreened?: Map }} opts
 *   date                the session date being closed
 *   holds               the idea's hold set (shareBasisHolds): symbol → the share-basis actions unresolved on any of its
 *                       ledgers. A count-dependent action of the symbol dated on or after one of them waits here too
 *   deferRenames        symbols whose rename waits because ANOTHER ledger of the idea has their share basis
 *                       unresolved (renameDeferralSymbols); this ledger's own unresolved symbols are added here
 *   renameTargetsTaken  symbols another idea of the book holds: a rename into one is not applied (R-36). The close
 *                       screens the feed's rows for it before the call; this screens a rename taken from a
 *                       holding's `deferredRename` record, which no feed row carries
 *   renameIdsScreened   id → target of each ticker-change row the close screened out for R-36: a record of that id
 *                       takes that target and is not applied this close
 * @returns {{ ledger: object, applied: Array<object>, declined: Array<object>, unresolved: Set<string>,
 *             conflicts: Array<object>,
 *             shareBasisChanges: Array<{ ticker: string, ratio: number, actionId: string }>,
 *             renames: Array<{ from: string, to: string, actionId: string, deferred?: true, deferredOn?: string }>,
 *             renamesDeferred: Array<{ from: string, to: string, actionId: string, effectiveDate: string, deferredOn: string }>,
 *             renamesBlocked: Array<{ from: string, to: string, actionId: string }>,
 *             held: Array<object>,
 *             closedByCash: Array<{ ticker: string, actionId: string, cashUsd: number, realizedPnlUsd: number }>,
 *             delistedWaiting: Array<{ ticker: string, actionId: string, effectiveDate: string, renamedFrom?: string }> }}
 */
export function applyLedgerActions(ledger, actionsBySymbol, { date, holds = null, deferRenames = null, renameTargetsTaken = null, renameIdsScreened = null }) {
  return applyActions(ledger, actionsBySymbol, { date, phase: 'all', holds, deferRenames, renameTargetsTaken, renameIdsScreened });
}

/** The order of one call: by effective date; on one date the share-basis actions FIRST (a cash action of that date is
 *  paid on the count they leave), then the rest, then ticker changes; then by id. */
const phaseRank = (a) => (SHARE_BASIS_TYPES.has(a.type) ? 0 : (a.type === 'ticker_change' ? 2 : 1));
const byDatePhaseId = (a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || phaseRank(a) - phaseRank(b) || String(a.actionId).localeCompare(String(b.actionId));

/** The action a held record stands for, when the feed no longer lists its row. */
function actionOfRecord(symbol, r) {
  const action = { type: r.type, ticker: symbol, effectiveDate: r.effectiveDate, actionId: r.actionId, source: r.source ?? null };
  if (r.ratio != null) action.ratio = r.ratio;
  if (r.amount != null) action.amount = r.amount;
  if (r.cashPerShare != null) action.cashPerShare = r.cashPerShare;
  return action;
}

/** The holding without the held record `actionId` (and without `heldActions` once none is left). */
function withoutHeld(holding, actionId) {
  if (!holding?.heldActions) return holding;
  const { heldActions, ...rest } = holding;
  const left = heldActions.filter((r) => r.actionId !== actionId);
  return left.length > 0 ? { ...rest, heldActions: left } : rest;
}

function applyActions(ledger, actionsBySymbol, { date, phase, holds = null, deferRenames = null, renameTargetsTaken = null, renameIdsScreened = null }) {
  // 'share_basis' is the dry run shareBasisHolds makes: share-basis actions only, cash actions and renames withheld.
  const everything = phase === 'all';
  const next = cloneLedger(ledger);
  const kind = next.kind ?? null;
  const settled = settledIdsOf(next);
  const { pending, unrecognized, notEntitled, noEntitlementData } = pendingActionsFor(
    next.holdings, actionsBySymbol, { onOrBefore: date, appliedIds: settled },
  );
  const applied = [];
  const declined = [];
  const unresolved = new Set();
  const shareBasisChanges = [];
  const conflicts = [];
  const renames = [];
  const renamesDeferred = [];
  const renamesBlocked = [];
  const renameRows = [];
  const held = [];
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
    // A held action whose own id the feed now lists two ways is no longer a payload to pay later: the conflict's
    // receipt governs it, as it governs any conflict (the record would otherwise apply a payload the feed contradicted).
    const sym = upper(first.ticker);
    if (next.holdings[sym]?.heldActions?.some((r) => r.actionId === id)) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], id) };
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

  // THE SHARE-BASIS ACTIONS THIS LEDGER CANNOT SETTLE, kept as the call goes (fix round 2): its unsettled conflicts, the
  // rows it has no entitlement data for, the ones it holds and what they wait on — and, below, each one the applier
  // refuses or that waits. A count-dependent action of the symbol dated on or after one of them (strictly after, for a
  // share-basis action: two of one date never wait on each other) waits, as one dated after one of the idea's `holds`.
  const blocked = new Map();
  for (const [sym, items] of unresolvedShareBasis(next, actionsBySymbol, { date })) {
    for (const i of items) {
      const listedNow = pending.some((a) => a.actionId === i.actionId);
      if (!listedNow || unsettledConflicts(next).some((r) => r.actionId === i.actionId) || heldActionRecords(next).some((r) => r.actionId === i.actionId)) addItem(blocked, sym, i);
    }
  }
  const causesOf = (action) => {
    const sym = upper(action.ticker);
    const strict = SHARE_BASIS_TYPES.has(action.type);
    const before = (i) => typeof i.effectiveDate !== 'string' || (strict ? i.effectiveDate < action.effectiveDate : i.effectiveDate <= action.effectiveDate);
    const nowSettled = settledIdsOf(next);
    const out = new Map();
    for (const i of holds?.get(sym) || []) if (i.actionId !== action.actionId && before(i) && !(i.ledger === kind && nowSettled.has(i.actionId))) addItem(out, sym, { ...i });
    for (const i of blocked.get(sym) || []) if (i.actionId !== action.actionId && before(i) && !nowSettled.has(i.actionId)) addItem(out, sym, { ...i });
    return (out.get(sym) || []).sort(byItem);
  };
  // Not applied, not settled: the holding keeps a record of what it is owed, refreshed to the payload the feed lists now.
  const hold = (sym, action, causes) => {
    unresolved.add(sym);
    if (SHARE_BASIS_TYPES.has(action.type)) addItem(blocked, sym, itemOf(action, kind));
    const h = next.holdings[sym];
    if (!h) return;
    const prior = (h.heldActions || []).find((r) => r.actionId === action.actionId) ?? null;
    const record = {
      actionId: action.actionId, type: action.type, ticker: sym, effectiveDate: action.effectiveDate,
      ratio: action.ratio ?? null, amount: action.amount ?? null, cashPerShare: action.cashPerShare ?? null, source: action.source ?? null,
      heldOn: prior?.heldOn ?? date, heldBecause: causes,
    };
    const list = [...(h.heldActions || []).filter((r) => r.actionId !== action.actionId), record].sort(byDatePhaseId);
    next.holdings = { ...next.holdings, [sym]: { ...h, heldActions: list } };
    held.push(record);
  };

  // The feed's rows, and every held action whose row the feed no longer lists (its record stands in for it). A listed
  // row of a held id supersedes the record.
  const listedIds = new Set(pending.map((a) => a.actionId));
  const fromRecords = [];
  for (const [sym, h] of Object.entries(next.holdings)) {
    for (const r of h?.heldActions || []) {
      if (settled.has(r.actionId) || conflicting.has(r.actionId) || listedIds.has(r.actionId)) continue;
      fromRecords.push(actionOfRecord(sym, r));
    }
  }
  const candidates = [...pending, ...fromRecords].sort(byDatePhaseId);

  for (const action of candidates) {
    if (!firstOf(action)) continue;
    if (!APPLICABLE_TYPES.has(action.type)) { unresolved.add(action.ticker); continue; }
    // Ticker changes are taken last, below (T2A-01): after every share-basis action of this call.
    if (action.type === 'ticker_change') { renameRows.push(action); continue; }
    // A delisting with no cash amount is NOT applied (E11): the engine's applier would force a sale at the carried
    // mark. It is settled by nobody, so a later row that does carry the cash still applies, once.
    if (action.type === 'delisting' && delistingCashOf(action) === null) {
      unresolved.add(action.ticker);
      delistedWaiting.push({ ticker: upper(action.ticker), actionId: action.actionId, effectiveDate: action.effectiveDate });
      continue;
    }
    // The dry run (shareBasisHolds) applies share-basis actions only.
    if (!everything && !SHARE_BASIS_TYPES.has(action.type)) continue;
    const sym = upper(action.ticker);
    // T2A-C01: nothing whose amount or effect depends on the share count is applied while that count is in doubt.
    if (countDependent(action)) {
      const causes = causesOf(action);
      if (causes.length > 0) { hold(sym, action, causes); continue; }
    }
    const heldRecord = (next.holdings[sym]?.heldActions || []).find((r) => r.actionId === action.actionId) ?? null;
    const heldFields = heldRecord ? { held: true, heldOn: heldRecord.heldOn } : {};
    const heldBefore = next.holdings[sym] || null;
    const out = applyCorporateAction({ positions: next.holdings, cash: next.cash }, action);
    if (!out.ok) {
      unresolved.add(action.ticker);
      if (SHARE_BASIS_TYPES.has(action.type)) addItem(blocked, sym, itemOf(action, kind));
      continue;
    }
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
        applied: true, appliedOn: date, source: action.source ?? null, note: out.note, ...heldFields,
      };
      next.corporateActionReceipts.push(receipt);
      applied.push({ ...action, receipt });
      closedByCash.push({ ticker: upper(action.ticker), actionId: action.actionId, cashUsd: receipt.cashUsd, realizedPnlUsd: receipt.realizedPnlUsd });
      continue;
    }
    // A share-basis action that would round a holding to nothing is not applied (review L1-1): the symbol is held at
    // its carried mark, not full quality, until T1a-2's policy decides it — never a holding of zero shares with a basis.
    if (SHARE_BASIS_TYPES.has(action.type) && !(Number(out.positions[action.ticker]?.shares) > 0)) {
      unresolved.add(action.ticker);
      addItem(blocked, sym, itemOf(action, kind));
      continue;
    }
    next.holdings = out.positions;
    if (heldRecord && next.holdings[sym]) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], action.actionId) };
    next.cash = out.cash;
    next.dividendsUsd = addUsd(next.dividendsUsd, out.incomeUsd);
    next.appliedActionIds.push(action.actionId);
    const receipt = {
      actionId: action.actionId, type: action.type, ticker: action.ticker, effectiveDate: action.effectiveDate,
      ratio: action.ratio ?? null, amount: action.amount ?? null, incomeUsd: out.incomeUsd,
      applied: true, appliedOn: date, source: action.source ?? null, note: out.note, ...heldFields,
    };
    next.corporateActionReceipts.push(receipt);
    applied.push({ ...action, receipt });
    if (SHARE_BASIS_TYPES.has(action.type)) shareBasisChanges.push({ ticker: action.ticker, ratio: Number(action.ratio), actionId: action.actionId });
  }

  // TICKER CHANGES, LAST (Astra T2A-01). The feed's rows, and any rename an earlier close deferred whose row the feed
  // no longer lists (the holding's `deferredRename` record). One for a symbol whose share basis is unresolved — on
  // this ledger after the actions above, or on another ledger of the idea (`deferRenames`) — waits; so does one for a
  // holding that still carries a held action (fix round 2: the action names the old ticker, and is owed first).
  if (everything) {
    const settledNow = settledIdsOf(next);
    const candidates = [...renameRows];
    for (const [sym, h] of Object.entries(next.holdings)) {
      const record = h?.deferredRename;
      if (!record || settledNow.has(record.actionId) || conflicting.has(record.actionId) || candidates.some((r) => r.actionId === record.actionId)) continue;
      // The close screened this id's row out (R-36): the record does not stand in for it, and takes the target the row
      // names now, so a later close never falls back to a target the feed corrected away from (fix-round refuters,
      // F2 and S1). The holding stays unresolved here: the close marks it blocked.
      if (renameIdsScreened?.has(record.actionId)) {
        const screenedTo = typeof renameIdsScreened.get === 'function' ? renameIdsScreened.get(record.actionId) : null;
        if (typeof screenedTo === 'string' && screenedTo.length > 0 && screenedTo !== record.to) {
          next.holdings = { ...next.holdings, [sym]: { ...h, deferredRename: { ...record, to: screenedTo } } };
        }
        continue;
      }
      candidates.push({ type: 'ticker_change', ticker: sym, renamedTo: record.to, effectiveDate: record.effectiveDate, actionId: record.actionId });
    }
    candidates.sort((a, b) => (a.effectiveDate + a.actionId).localeCompare(b.effectiveDate + b.actionId));
    const wait = new Set([
      ...(deferRenames || []), ...unsettledShareBasisSymbols(next, actionsBySymbol, { date }), ...heldActionRecords(next).map((r) => r.symbol),
    ]);
    for (const action of candidates) {
      const from = upper(action.ticker);
      const to = upper(action.renamedTo);
      const holding = next.holdings[from];
      if (!holding) { unresolved.add(action.ticker); continue; }
      if (wait.has(from)) {
        // Not applied, not settled: the holding keeps its symbol and its first deferral's record — whose target follows
        // the row the feed lists now for the same id (a corrected row; fix-round refuter, F2), so the reservation and
        // the rename name what the feed last said.
        const prior = holding.deferredRename ?? null;
        const record = prior === null ? { from, to, actionId: action.actionId, effectiveDate: action.effectiveDate, deferredOn: date }
          : (prior.actionId === action.actionId ? { ...prior, to } : prior);
        next.holdings = { ...next.holdings, [from]: { ...holding, deferredRename: record } };
        unresolved.add(from);
        renamesDeferred.push(record);
        continue;
      }
      // R-36, for a rename the close's own screen of the feed's rows could not see: one taken from a record.
      if (renameTargetsTaken?.has(to)) { unresolved.add(from); renamesBlocked.push({ from, to, actionId: action.actionId }); continue; }
      const { deferredRename: waited = null, ...plain } = holding;
      const out = applyCorporateAction({ positions: { ...next.holdings, [from]: plain }, cash: next.cash }, action);
      if (!out.ok) { unresolved.add(action.ticker); continue; }
      next.holdings = out.positions;
      next.appliedActionIds.push(action.actionId);
      const deferral = waited && waited.actionId === action.actionId ? { deferred: true, deferredOn: waited.deferredOn } : {};
      const receipt = {
        actionId: action.actionId, type: action.type, ticker: action.ticker, effectiveDate: action.effectiveDate,
        renamedTo: to, incomeUsd: 0, applied: true, appliedOn: date, source: action.source ?? null, note: out.note, ...deferral,
      };
      next.corporateActionReceipts.push(receipt);
      applied.push({ ...action, receipt });
      renames.push({ from, to, actionId: action.actionId, ...deferral });
    }
    // C-13: a delisting with no cash amount and a rename of the same holding in ONE close. The waiting sale belongs to
    // the HOLDING, which now answers to its new ticker: the close looks it up there, and its mark is carried there.
    for (const r of renames) {
      for (let i = 0; i < delistedWaiting.length; i += 1) {
        if (delistedWaiting[i].ticker === r.from) delistedWaiting[i] = { ...delistedWaiting[i], ticker: r.to, renamedFrom: r.from };
      }
      if (unresolved.has(r.from)) unresolved.add(r.to);
    }
    // EVERY SYMBOL WHOSE SHARE BASIS IS UNRESOLVED is valued at its carried mark (R-45, now for the whole class): on
    // this ledger, on any ledger of the idea (`holds`), or carrying a held action. A fresh price against an unadjusted
    // count would put a wrong value on the row — and the gap screen alone does not catch a 1.2 or 1.5 ratio once the
    // feed drops the conflict.
    for (const sym of unsettledShareBasisSymbols(next, actionsBySymbol, { date })) if (Object.hasOwn(next.holdings, sym)) unresolved.add(sym);
    for (const sym of holds?.keys() || []) if (Object.hasOwn(next.holdings, sym)) unresolved.add(sym);
    for (const r of heldActionRecords(next)) unresolved.add(r.symbol);
  }
  return { ledger: next, applied, declined, unresolved, conflicts, shareBasisChanges, renames, renamesDeferred, renamesBlocked, held, closedByCash, delistedWaiting };
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
 *
 * And (fix round 2, the share-basis class) while the holding's share basis is unresolved ANYWHERE IN THE IDEA: the
 * holding carries a held action (it is owed something that waits on its count — a dropped due row it waits on
 * included), or another ledger of the idea (`otherLedgers`: the comparison's, the SPY line's) has the symbol's share
 * basis unresolved — `corporate_action_unsettled`, as the idea's own conflict reads.
 */
export function saleHeldBackBy(ledger, symbol, snapshot, { sinceDate, date, otherLedgers = [] }) {
  const holding = ledger?.holdings?.[symbol];
  if (!holding) return null;
  const actionsBySymbol = caActionsBySymbol(snapshot);
  if ((holding.heldActions || []).length > 0) return 'corporate_action_unsettled';
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
  if (unsettledShareBasisSymbols(ledger, actionsBySymbol, { date }).has(symbol)) return 'corporate_action_unsettled';
  for (const other of otherLedgers || []) {
    if (other && unsettledShareBasisSymbols(other, actionsBySymbol, { date }).has(symbol)) return 'corporate_action_unsettled';
  }
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
