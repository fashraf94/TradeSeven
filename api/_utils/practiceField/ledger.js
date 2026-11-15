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
// dated on or before it (for a share-basis action: one that precedes it in the order of application, on an earlier date
// or the same one — fix round 3, T2A-D02) waits, on EVERY ledger of the idea (the close's
// hold set, shareBasisHolds, decides for the idea as renameDeferralSymbols did). Not applied, not settled: the holding
// keeps `heldActions: [{ actionId, type, ticker, effectiveDate, ratio, amount, cashPerShare, source, heldOn,
// heldBecause }]` (the payload the feed last listed; it survives the feed dropping the row), stays at its carried mark,
// keeps its slot and alerts at every close. An action dated BEFORE the unresolved one is paid on the count before it,
// which is settled. At the close where the basis settles: the share-basis action, then each held action in date order
// on the count it leaves — once on each entitled ledger and in the book's mirror, its receipt saying `held: true` and
// `heldOn` — then any waiting rename, then marks. On one date, share-basis actions come first. A share-basis action the
// ledger CANNOT apply (a refused ratio, one that would round the holding to nothing, no entitlement data) is recorded the
// same way with `refused` and never replayed, so a row leaving the feed never makes the count read settled (review F2):
// nothing is ever paid on the unadjusted count. If the basis never settles, nothing guesses.
//
// A MOVE THE GAP SCREEN SUSPECTS IS A SHARE BASIS IN DOUBT TOO (fix round 3, Astra T2A-D01). The engine's gap screen
// (classifyOvernightGaps) flags a close whose price moved by a split's shape — a half, a third, twice… of the last
// trusted mark — with no feed row to explain it. It held the sale and the mark, but only while the shape lasted, and the
// close asked it only AFTER paying: a cash delisting paid shares × cash on a count that may be half what it should be,
// deleted the holding, resolved the idea and returned that cash. Now the close asks the screen first, on the state the
// cash would be paid on (after this close's share-basis rows, before any cash: withBasisSuspicions), and a symbol it
// suspects gets a record on the holding — `basisSuspicion: { symbol, suspectedOn, since, ratio, shape, frozenMark,
// frozenMarkAsOf, resolvedBy: null, resolvedAt: null }` — that makes its share basis UNRESOLVED in the sense above
// (unresolvedShareBasis, idea-wide through shareBasisHolds). Every count-dependent action waits on it exactly as on a
// conflict: a cash action dated after `since` (the session of the last trusted mark: the move came after it), and a
// share-basis action dated after the session it was first suspected. The sale waits, a rename waits, the mark is
// carried, the endpoint is unmeasurable, and an alert fires at every close. The record is NOT cleared because the price
// recovers or the screen stops firing. It is released only by
//   • a share-basis row of the symbol that EXPLAINS the move — dated inside the gap (after `since`, on or before
//     `suspectedOn`), first listed after the session the suspicion was raised, and whose ratio matches the move within
//     twice the engine's tolerance (the engine's own test for a feed row that explains a gap). That row then takes the
//     suspicion's place in the order: what is dated before it is paid on the count before it, what is dated after it
//     waits for it, and when it applies the record is removed and its receipt says what it explained; or
//   • the founder (T5): a record carrying both `resolvedBy` and `resolvedAt` no longer holds anything, and the screen's
//     same signature against that same frozen mark raises no new one (the founder has ruled on that move).
// Nothing estimates an adjusted count or picks a ratio. A holding waiting on a delisting is not screened (R-32: its fall
// is the delisting, not a split).
//
// THE BOOK'S MARKED EQUITY has one rounding basis, stated below (`markedEquityCents`).
//
// Pure: no store, no clock.

import { markBook } from '../mandateValuation.js';
import { snapshotExcluding, caActionsBySymbol } from '../mandateUniverseSnapshot.js';
import { pendingActionsFor, applyCorporateAction, classifyOvernightGaps, deriveActionId } from '../mandateCorporateActions.js';
import { MANDATE_CA_RATIO_TOLERANCE, MANDATE_CA_RATIO_MAX_N } from '../mandateConfig.js';
import { roundUsd } from '../mandateRounding.js';
import { MARK_QUALITY } from './constants.js';
import { closeMarkQuality } from './marks.js';
import { addUsd, toCents } from './money.js';
import { etDateOfMs } from './windows.js';

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

// ── THE GAP SCREEN'S SUSPICION (fix round 3, Astra T2A-D01; see the header) ────────────────────────────────────────

/** The type, and the id prefix, a suspicion's item carries in the hold set and in a held action's `heldBecause`. */
export const SUSPECTED_SPLIT = 'suspected_split';
const suspicionIdOf = (symbol, s) => `${SUSPECTED_SPLIT}_${upper(symbol)}_${s.suspectedOn}`;
/** A record the founder has resolved (T5 writes both fields; nothing here writes them). */
const founderResolved = (s) => typeof s?.resolvedBy === 'string' && s.resolvedBy.trim().length > 0 && s.resolvedAt != null;

/** The holding's suspicion while it holds anything: present and not resolved by the founder. */
export function openBasisSuspicion(holding) {
  const s = holding?.basisSuspicion;
  if (!s || typeof s !== 'object' || founderResolved(s)) return null;
  return s;
}

/** The open suspicions of a ledger: `[{ symbol, actionId, ...record }]` (`actionId` is the item's id). */
export function basisSuspicionRecords(ledger) {
  const out = [];
  for (const [symbol, h] of Object.entries(ledger?.holdings || {})) {
    const s = openBasisSuspicion(h);
    if (s) out.push({ ...s, symbol: upper(symbol), actionId: suspicionIdOf(symbol, s) });
  }
  return out;
}

/** Two price ratios are the same move within twice the engine's tolerance (its own `feedExplainsGap` band). */
const sameMove = (a, b) => Number(a) > 0 && Number(b) > 0 && Math.abs(Number(a) - Number(b)) / Number(b) <= MANDATE_CA_RATIO_TOLERANCE * 2;

/** The move the founder has already ruled on: a resolved record not yet SPENT (no fresh mark written since —
 *  withCloseMarks), whose frozen mark is still the holding's mark, and whose move is the one the screen now sees
 *  (`ratio`). That signature against that same mark is not a new suspicion. Once any fresh mark is written the ruling is
 *  spent, even if a later fresh price equals the old one (review F1, and a receipt-time mark: second refuter); and a
 *  further move against the same frozen mark — a second unfed split on top of the ruled one — is a new suspicion
 *  (refuter D1). */
const founderRuledMove = (holding, ratio) => founderResolved(holding?.basisSuspicion)
  && holding.basisSuspicion.spentOn == null
  && Number(holding.basisSuspicion.frozenMark) === Number(holding?.lastMark)
  && sameMove(ratio, holding.basisSuspicion.ratio);

/**
 * Does a share-basis action EXPLAIN a suspicion's move? Dated inside the gap (after `since`, on or before the session it
 * was first suspected), and its ratio matches the move within twice the engine's tolerance — the engine's own test for a
 * feed row that explains a gap (mandateCorporateActions.js feedExplainsGap: shares × r ⇒ price × 1/r). Only a listed
 * SHARE-BASIS row releases a suspicion (the founder's ruling); a cash dividend whose row arrives after the suspicion was
 * raised does not, and waits with everything else until the founder rules (refuter D3: put as a question, Q-T).
 */
function explainsSuspicion(action, s) {
  if (!SHARE_BASIS_TYPES.has(action?.type) || !s) return false;
  const r = Number(action.ratio);
  const move = Number(s.ratio);
  if (!(r > 0) || !(move > 0) || !Number.isFinite(r) || !Number.isFinite(move)) return false;
  if (typeof action.effectiveDate !== 'string' || action.effectiveDate > s.suspectedOn) return false;
  if (typeof s.since === 'string' && action.effectiveDate <= s.since) return false;
  return sameMove(move, 1 / r);
}

/**
 * Do the cash dividends this ledger has already PAID inside the gap explain the holding's move? Once paid they are
 * settled, so the engine's screen (asked with `excludeActionIds: settled`) no longer sees them, and an ex-date drop a
 * special dividend fully explains would read as an unfed split. They are put to the engine's own test again — with
 * those paid dividends as the only actions (review F2; refuter D2). A dividend never adjusts the count: nothing here
 * pays or holds anything, it only stops a mark being frozen, or a record being raised, for a move already explained.
 */
function paidDividendsExplain(ledger, holding, sym, snapshot, { date }) {
  // Only the dividends paid AT THIS CLOSE (`appliedOn`), whatever their date — one paid at an earlier close already had
  // its close, whose mark this one is read against (second refuter: a window keyed on the mark's session, which a
  // receipt-time mark leaves behind, pulled an older dividend in and explained a real unfed split away).
  const paid = (ledger?.corporateActionReceipts || [])
    .filter((r) => r?.type === 'cash_dividend' && r.applied === true && r.appliedOn === date && upper(r.ticker) === sym
      && typeof r.effectiveDate === 'string' && r.effectiveDate <= date)
    .map((r) => ({ type: 'cash_dividend', ticker: sym, amount: r.amount, effectiveDate: r.effectiveDate }));
  if (paid.length === 0) return false;
  return classifyOvernightGaps({ [sym]: holding }, snapshot, { [sym]: paid }, { sinceDate: null, asOfDate: date }).pendingCA.has(sym);
}

/** A holding waiting on a delisting (E11): its fall is the delisting, not a split (R-32). */
const delistingWaitingHolding = (h) => h?.exitPending?.reason === 'delisting' || h?.settlementPending?.replacedExit?.reason === 'delisting';

/** The symbols of a ledger's holdings that wait on a delisting — and those it has already SOLD on one (review F3: the
 *  comparison, which never sells, still holds the name at its pre-delisting mark). Only the idea's own ledger carries
 *  the waiting sale, so the close hands this set, read from the idea's ledger, to the screen of every ledger of the idea. */
export function delistingWaitingSymbols(ledger) {
  const out = new Set(Object.entries(ledger?.holdings || {}).filter(([, h]) => delistingWaitingHolding(h)).map(([sym]) => upper(sym)));
  for (const r of ledger?.saleReceipts || []) if (r?.queuedBy?.reason === 'delisting') out.add(upper(r.symbol));
  return out;
}

/** The move's split shape: forward (`split`, price × 1/n) or `reverse_split` (price × n), n the nearest whole number in
 *  the engine's own range (2…MANDATE_CA_RATIO_MAX_N) — found by search, so no raw rounding enters the money path. */
function shapeOf(ratio) {
  const kind = ratio < 1 ? 'split' : 'reverse_split';
  const x = ratio < 1 ? 1 / ratio : ratio;
  let n = 2;
  for (let k = 3; k <= MANDATE_CA_RATIO_MAX_N; k += 1) if (Math.abs(x - k) < Math.abs(x - n)) n = k;
  return { kind, n };
}

/** The session date of a holding's last trusted mark, or null when it cannot be told. */
function markSessionOf(holding) {
  const ms = typeof holding?.lastMarkAsOf === 'string' ? Date.parse(holding.lastMarkAsOf) : NaN;
  return Number.isFinite(ms) ? etDateOfMs(ms) : null;
}

/**
 * THE GAP SCREEN, ASKED BEFORE ANY CASH (fix round 3, T2A-D01). On the state a cash action would be paid on — this
 * close's share-basis actions applied (the dry run shareBasisHolds makes), nothing else — every symbol the engine's
 * screen SUSPECTS (a split's shape with no feed row: `suspectedCA`, never `pendingCA`, which a listed row explains) gets
 * a `basisSuspicion` record on this ledger's holding, unless it already has an open one (the first is kept, with the
 * session it was first suspected), the founder has ruled on this very move, or the holding waits on a delisting (R-32) —
 * on this ledger, or on the idea's own (`delistingWaiting`, which the close reads from the idea's ledger: only it carries
 * the waiting sale, and a suspicion on the comparison would hold that sale idea-wide). Pure.
 * @returns {{ ledger: object, raised: Array<object> }}
 */
export function withBasisSuspicions(ledger, closeSnapshot, actionsBySymbol, { sinceDate, date, delistingWaiting = null }) {
  if (!ledger || !closeSnapshot) return { ledger, raised: [] };
  const dry = applyActions(ledger, actionsBySymbol, { date, phase: 'share_basis' }).ledger;
  const settled = settledIdsOf(dry);
  const scan = classifyOvernightGaps(dry.holdings, closeSnapshot, actionsBySymbol, { sinceDate: sinceDate ?? null, asOfDate: date, excludeActionIds: settled });
  let next = ledger;
  const raised = [];
  for (const [sym, { ratio }] of scan.suspectedCA) {
    const h = ledger.holdings?.[sym];
    const d = dry.holdings?.[sym];
    if (!h || !d || openBasisSuspicion(h) || founderRuledMove(d, ratio) || delistingWaitingHolding(h) || delistingWaiting?.has(sym)) continue;
    // A delisting with no cash listed for it today makes it a waiting sale at this close (R-32, as above).
    if ((actionsBySymbol?.[sym] || []).some((a) => a?.type === 'delisting' && delistingCashOf(a) === null && typeof a.effectiveDate === 'string' && a.effectiveDate <= date && !settled.has(deriveActionId(a)))) continue;
    // (A dividend paid at an earlier close that explains its own ex-date drop leaves that close's mark fresh —
    // suspectedActionSymbols — so the move is not seen here again: review F2, refuter D2.)
    const since = markSessionOf(d);
    const record = {
      symbol: sym, suspectedOn: date, since, ratio,
      shape: shapeOf(ratio),
      frozenMark: Number(d.lastMark), frozenMarkAsOf: d.lastMarkAsOf ?? null, resolvedBy: null, resolvedAt: null,
    };
    if (next === ledger) next = cloneLedger(ledger);
    next.holdings[sym] = { ...h, basisSuspicion: record };
    raised.push(record);
  }
  return { ledger: next, raised };
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
 * data); and one it HOLDS — behind an earlier unresolved one, or because it cannot apply it (`refused`). Every one of
 * these survives the feed dropping its row (a conflict by its receipt, the rest by their held record), so a cash action
 * held behind one is never released by a row leaving the feed (the fail-closed side of R-46; review F2). And (fix round
 * 3, T2A-D01) every open gap-screen suspicion, as `{ actionId: 'suspected_split_SYM_<suspectedOn>', type:
 * 'suspected_split', effectiveDate: suspectedOn, since, ledger }` — durable on its holding's record, like the rest.
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
  }
  // …and every open gap-screen suspicion (fix round 3, T2A-D01), unless a share-basis row that EXPLAINS it is here to
  // apply — listed now (not two ways) or held on the holding — at a close after the one that raised it: that row then
  // stands for the move, in its own place in the order (it is an item above, or is applied in order).
  const conflicted = conflictingActionIds([...due.pending, ...due.noEntitlementData, ...due.unrecognized]);
  for (const [sym, h] of Object.entries(ledger?.holdings || {})) {
    const s = openBasisSuspicion(h);
    if (!s) continue;
    const key = upper(sym);
    const listed = due.pending.filter((a) => upper(a.ticker) === key && !conflicted.has(a.actionId));
    const recorded = (h.heldActions || []).filter((r) => !r.refused && !settled.has(r.actionId)).map((r) => actionOfRecord(key, r));
    if (typeof date === 'string' && date > s.suspectedOn && [...listed, ...recorded].some((a) => explainsSuspicion(a, s))) continue;
    addItem(out, key, { actionId: suspicionIdOf(key, s), type: SUSPECTED_SPLIT, effectiveDate: s.suspectedOn ?? null, since: s.since ?? null, ledger: kind });
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
  // The holding's own key (upper case), whatever case a row carries (refuter 2): a lower-case row must hold the mark.
  for (const bad of [...noEntitlementData, ...unrecognized]) unresolved.add(upper(bad.ticker));

  // THE SHARE-BASIS ACTIONS THIS LEDGER CANNOT SETTLE, kept as the call goes (fix round 2): its unsettled conflicts, the
  // rows it has no entitlement data for, the ones it holds and what they wait on — and, below, each one the applier
  // refuses or that waits. A cash action of the symbol dated on or after one of them waits, as one dated after one of the
  // idea's `holds`. A share-basis action waits on one that PRECEDES it in this call's own order of application
  // (`byDatePhaseId`: date, then phase, then id) — on an earlier date or on the same one — and never on itself or on one
  // after it (fix round 3, Astra T2A-D02: shares are rounded after each action, so two of one date applied out of order
  // leave a different count).
  const blocked = new Map();
  for (const [sym, items] of unresolvedShareBasis(next, actionsBySymbol, { date })) {
    for (const i of items) {
      const listedNow = pending.some((a) => a.actionId === i.actionId);
      if (!listedNow || unsettledConflicts(next).some((r) => r.actionId === i.actionId) || heldActionRecords(next).some((r) => r.actionId === i.actionId)) addItem(blocked, sym, i);
    }
  }
  const causesOf = (action) => {
    const sym = upper(action.ticker);
    const shareBasis = SHARE_BASIS_TYPES.has(action.type);
    // A gap-screen suspicion (fix round 3, T2A-D01) moved some time after `since` and on or before `suspectedOn`: it holds
    // a cash action dated after `since` (all of them when `since` cannot be told), and a share-basis action dated after
    // `suspectedOn` — one dated inside the gap is the feed's own account of it, applied (and, if it explains the move,
    // releasing it).
    const suspicionHolds = (i) => (shareBasis ? action.effectiveDate > i.effectiveDate : (typeof i.since !== 'string' || action.effectiveDate > i.since));
    const before = (i) => {
      if (typeof i.effectiveDate !== 'string') return true;
      if (i.type === SUSPECTED_SPLIT) return suspicionHolds(i);
      return shareBasis ? byDatePhaseId(i, action) < 0 : i.effectiveDate <= action.effectiveDate;
    };
    const nowSettled = settledIdsOf(next);
    const out = new Map();
    for (const i of holds?.get(sym) || []) if (i.actionId !== action.actionId && before(i) && !(i.ledger === kind && nowSettled.has(i.actionId))) addItem(out, sym, { ...i });
    for (const i of blocked.get(sym) || []) if (i.actionId !== action.actionId && before(i) && !nowSettled.has(i.actionId)) addItem(out, sym, { ...i });
    return (out.get(sym) || []).sort(byItem);
  };
  // Not applied, not settled: the holding keeps a record of what it is owed, refreshed to the payload the feed lists now.
  // A share-basis action this ledger CANNOT apply (the applier refuses its ratio, it would round the holding to nothing,
  // or the holding has no entitlement data) is recorded the same way, `refused` naming why (review F2): otherwise it is
  // forgotten the moment the feed drops its row, the count reads settled, and a later cash action pays on the
  // unadjusted count. Such a record is never replayed — only a listed row of its id can settle it — so it holds the
  // holding until the feed corrects it or the founder acts (C-6).
  const hold = (sym, action, causes, refused = null) => {
    unresolved.add(sym);
    if (SHARE_BASIS_TYPES.has(action.type)) addItem(blocked, sym, itemOf(action, kind));
    const h = next.holdings[sym];
    if (!h) return;
    const prior = (h.heldActions || []).find((r) => r.actionId === action.actionId) ?? null;
    const record = {
      actionId: action.actionId, type: action.type, ticker: sym, effectiveDate: action.effectiveDate,
      ratio: action.ratio ?? null, amount: action.amount ?? null, cashPerShare: action.cashPerShare ?? null, source: action.source ?? null,
      heldOn: prior?.heldOn ?? date, heldBecause: causes, ...(refused ? { refused } : {}),
    };
    const list = [...(h.heldActions || []).filter((r) => r.actionId !== action.actionId), record].sort(byDatePhaseId);
    next.holdings = { ...next.holdings, [sym]: { ...h, heldActions: list } };
    held.push(record);
  };

  for (const a of noEntitlementData) {
    if (SHARE_BASIS_TYPES.has(a.type) && !conflicting.has(a.actionId)) hold(upper(a.ticker), a, [], 'no_entitlement_data');
  }

  // The feed's rows, and every held action whose row the feed no longer lists (its record stands in for it). A listed
  // row of a held id supersedes the record.
  const listedIds = new Set(pending.map((a) => a.actionId));
  const fromRecords = [];
  for (const [sym, h] of Object.entries(next.holdings)) {
    for (const r of h?.heldActions || []) {
      if (r.refused || settled.has(r.actionId) || conflicting.has(r.actionId) || listedIds.has(r.actionId)) continue;
      fromRecords.push(actionOfRecord(sym, r));
    }
  }
  const candidates = [...pending, ...fromRecords].sort(byDatePhaseId);

  for (const action of candidates) {
    if (!firstOf(action)) continue;
    if (!APPLICABLE_TYPES.has(action.type)) { unresolved.add(upper(action.ticker)); continue; }
    // Ticker changes are taken last, below (T2A-01): after every share-basis action of this call.
    if (action.type === 'ticker_change') { renameRows.push(action); continue; }
    // A delisting with no cash amount is NOT applied (E11): the engine's applier would force a sale at the carried
    // mark. It is settled by nobody, so a later row that does carry the cash still applies, once.
    if (action.type === 'delisting' && delistingCashOf(action) === null) {
      unresolved.add(upper(action.ticker));
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
      unresolved.add(sym);
      if (SHARE_BASIS_TYPES.has(action.type)) hold(sym, action, [], out.reason ?? 'not_applicable');
      continue;
    }
    if (action.type === 'delisting') {
      // The engine credited shares × the deal's cash and dropped the holding. It must have priced at the cash amount
      // itself — never at a mark — or nothing is applied.
      if (!out.forcedClose || out.forcedClose.mark !== delistingCashOf(action)) { unresolved.add(sym); continue; }
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
    // Read under the holding's own key (upper case), whatever case the row carries (review F3).
    if (SHARE_BASIS_TYPES.has(action.type) && !(Number(out.positions[sym]?.shares) > 0)) {
      hold(sym, action, [], 'rounds_to_nothing');
      continue;
    }
    next.holdings = out.positions;
    if (heldRecord && next.holdings[sym]) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], action.actionId) };
    // A share-basis row that EXPLAINS the holding's open suspicion, at a close after the one that raised it, releases it
    // (fix round 3, T2A-D01): the record is removed and the receipt says what it explained.
    let explained = {};
    const suspicion = SHARE_BASIS_TYPES.has(action.type) ? openBasisSuspicion(next.holdings[sym]) : null;
    if (suspicion && date > suspicion.suspectedOn && explainsSuspicion(action, suspicion)) {
      const { basisSuspicion, ...rest } = next.holdings[sym];
      next.holdings = { ...next.holdings, [sym]: rest };
      explained = { explainedSuspicion: { suspectedOn: basisSuspicion.suspectedOn, ratio: basisSuspicion.ratio, frozenMark: basisSuspicion.frozenMark } };
    }
    next.cash = out.cash;
    next.dividendsUsd = addUsd(next.dividendsUsd, out.incomeUsd);
    next.appliedActionIds.push(action.actionId);
    const receipt = {
      actionId: action.actionId, type: action.type, ticker: action.ticker, effectiveDate: action.effectiveDate,
      ratio: action.ratio ?? null, amount: action.amount ?? null, incomeUsd: out.incomeUsd,
      applied: true, appliedOn: date, source: action.source ?? null, note: out.note, ...heldFields, ...explained,
    };
    next.corporateActionReceipts.push(receipt);
    applied.push({ ...action, receipt });
    if (SHARE_BASIS_TYPES.has(action.type)) shareBasisChanges.push({ ticker: sym, ratio: Number(action.ratio), actionId: action.actionId });
  }

  // TICKER CHANGES, LAST (Astra T2A-01). The feed's rows, and any rename an earlier close deferred whose row the feed
  // no longer lists (the holding's `deferredRename` record). One for a symbol whose share basis is unresolved — on
  // this ledger after the actions above, or on another ledger of the idea (`deferRenames`) — waits. (A holding that
  // still carries a held action is always one of these: a record lives only while what it waits on is unresolved.)
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
    const wait = new Set([...(deferRenames || []), ...unsettledShareBasisSymbols(next, actionsBySymbol, { date })]);
    for (const action of candidates) {
      const from = upper(action.ticker);
      const to = upper(action.renamedTo);
      const holding = next.holdings[from];
      if (!holding) { unresolved.add(from); continue; }
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
      if (!out.ok) { unresolved.add(from); continue; }
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
    // this ledger, or on any ledger of the idea (`holds`) — which covers every holding carrying a held action. A fresh
    // price against an unadjusted count would put a wrong value on the row — and the gap screen alone does not catch a
    // 1.2 or 1.5 ratio once the feed drops the conflict.
    for (const sym of unsettledShareBasisSymbols(next, actionsBySymbol, { date })) if (Object.hasOwn(next.holdings, sym)) unresolved.add(sym);
    for (const sym of holds?.keys() || []) if (Object.hasOwn(next.holdings, sym)) unresolved.add(sym);
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
 *
 * A fresh mark written over a suspicion the founder has resolved SPENDS that ruling (fix round 3, review F1 and second
 * refuter): the record gains `spentOn` (the session), and from then on the screen compares against the fresh mark, so
 * a later split-shaped move is a new suspicion. Keyed on the mark being fresh, not on `lastMarkAsOf`, which a
 * receipt-time mark (no vendor time) leaves unchanged. Nothing is removed from the record.
 */
export function withCloseMarks(ledger, valuation, { date = null } = {}) {
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
    if (fresh && founderResolved(h.basisSuspicion) && h.basisSuspicion.spentOn == null) {
      next.holdings[sym].basisSuspicion = { ...h.basisSuspicion, spentOn: date ?? m.vendorTimeIso ?? 'fresh_mark' };
    }
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
 *
 * And (fix round 3, T2A-D01) while the holding carries an open gap-screen suspicion (`basisSuspicion`):
 * `suspected_corporate_action`, as the live screen reads — also after the price has recovered, and also for a holding
 * that began waiting on a delisting after the suspicion was raised. The live screen still runs as before; a move the
 * founder has resolved is not suspected again against the same frozen mark.
 */
export function saleHeldBackBy(ledger, symbol, snapshot, { sinceDate, date, otherLedgers = [] }) {
  const holding = ledger?.holdings?.[symbol];
  if (!holding) return null;
  const actionsBySymbol = caActionsBySymbol(snapshot);
  // The gap screen's RECORD (fix round 3, T2A-D01): the move it suspected is not settled because the price has since
  // recovered or the shape has gone. First, before the delisting exception below: a suspicion raised before the holding
  // began waiting on a delisting still holds it.
  if (openBasisSuspicion(holding)) return 'suspected_corporate_action';
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
  for (const other of otherLedgers || []) {
    if (other && unsettledShareBasisSymbols(other, actionsBySymbol, { date }).has(symbol)) return 'corporate_action_unsettled';
  }
  const delistedWaiting = holding.exitPending?.reason === 'delisting' || holding.settlementPending?.replacedExit?.reason === 'delisting';
  if (delistedWaiting) return null;
  const gaps = classifyOvernightGaps(one, snapshot, actionsBySymbol, { sinceDate: sinceDate ?? null, asOfDate: date, excludeActionIds: settled });
  // A move the founder has ruled on (a resolved record, its frozen mark still the holding's) is not suspected again.
  if (gaps.suspectedCA.has(symbol) && !gaps.pendingCA.has(symbol) && founderRuledMove(holding, gaps.suspectedCA.get(symbol).ratio)) return null;
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
  // A move the founder has ruled on (fix round 3: a resolved record whose frozen mark is still the holding's) is not held
  // back again: the close marks it fresh, and the next screen compares against that fresh mark.
  const frozen = new Set(scan.frozen);
  for (const [sym, { ratio }] of scan.suspectedCA) if (!scan.pendingCA.has(sym) && founderRuledMove(ledger.holdings?.[sym], ratio)) frozen.delete(sym);
  // A dividend this ledger has just PAID, at this close, that explains the ex-date drop: once settled the screen excludes
  // it, and the mark would be frozen at the pre-ex price beside the dividend's cash — a value counted twice and a mark
  // later moves are read against (refuter D2; pre-existing, R-31's mark hold). Asked again, the engine's way.
  for (const sym of scan.suspectedCA.keys()) {
    const h = ledger.holdings?.[sym];
    if (h && frozen.has(sym) && !scan.pendingCA.has(sym) && paidDividendsExplain(ledger, h, sym, closeSnapshot, { date })) frozen.delete(sym);
  }
  return frozen;
}
