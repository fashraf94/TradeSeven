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
// valued at its carried mark, not full quality, exactly as R-9 holds an unsettled action.
//
// AMBIGUITY IS STICKY (Amendment F revision 1, S-1 to S-3; it replaces T1a-1's R-21, under which a feed that later
// presented one consistent row settled a conflict). An id becomes AMBIGUOUS on a ledger the first time it is seen
//   1. listed with two or more economic payloads — in one call, or across closes, or across the daily layer and a
//      backfill (`kinds` on the record says which: `conflict`, `revision`, `archive_backfill`);
//   2. REVISED: listed with a payload different from one this ledger already holds a record of (a held action);
//   3. as a POSSIBLE RE-DATE (F-7): the new row, and the unsettled row it may repeat, each get a `possible_redate` record.
// Once ambiguous, ONLY THE FOUNDER'S RULING settles the id (resolve_hold, `conflict`): no automatic path applies,
// declines, replays or retires it — not a later single row, not a row under a moved date (RF-A2 is withdrawn), not a
// replay after coverage returns, not a backfill row, not the not-entitled decline. Its record keeps EVERY distinct
// payload seen (`rows`), so a later re-date of any of them is matched (Astra T2D-C01). Until it is ruled it moves no cash
// and no shares on that ledger; a share-basis one puts its symbol's basis in doubt idea-wide (the class rule), and every
// open record keeps the rows below full quality and is named at the endpoint. A ruled id that later shows a payload the
// ruling did not see is a new ambiguity (`revised_after_ruling`): alerted, and it waits for the founder again (S-2).
// An action that was never ambiguous is applied exactly as before (S-3).
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
// frozenMarkAsOf, resolvedBy: null, resolvedAt: null, seenAtRaise, lastSeen }` — that makes its share basis UNRESOLVED in the sense above
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
//   • the founder (Amendment F-5, resolve_hold — holdRulings.js): a ruling on the record, applied once at the next close,
//     which retires it. `price_move` (the move was real) releases what it held, to be paid on the current count, and
//     makes the last price observed while it stood the holding's reference; `split` applies the founder's split once.
//     A ruling covers exactly the recorded move: any later split-shaped gap — an identical one included — is a new
//     record, judged against the reference the ruling set.
// Nothing estimates an adjusted count or picks a ratio. A holding waiting on a delisting is not screened (R-32: its fall
// is the delisting, not a split).
//
// THE BOOK'S MARKED EQUITY has one rounding basis, stated below (`markedEquityCents`).
//
// Pure: no store, no clock.

import { markBook } from '../mandateValuation.js';
import { snapshotExcluding, caActionsBySymbol } from '../mandateUniverseSnapshot.js';
import {
  pendingActionsFor, applyCorporateAction, classifyOvernightGaps, deriveActionId, parseSplitsPayload, parseDividendsPayload,
} from '../mandateCorporateActions.js';
import { MANDATE_CA_RATIO_TOLERANCE, MANDATE_CA_RATIO_MAX_N } from '../mandateConfig.js';
import { roundUsd, roundShares } from '../mandateRounding.js';
import { MARK_QUALITY } from './constants.js';
import { closeMarkQuality } from './marks.js';
import { addUsd, toCents } from './money.js';
import { CA_COVERAGE_GAP } from './dailyCoverage.js';
import { nextSessionDate } from './windows.js';

export const LEDGER_KIND = Object.freeze({ IDEA: 'idea', COMPARISON: 'comparison', SPY: 'spy' });

/** The engine's action id (type, ticker, effective date), for a module that must not import the engine's applier itself
 *  (the founder's rulings, holdRulings.js — exits.test.js rule 7 keeps that import to this file and the close). */
export const actionIdOf = (action) => deriveActionId(action);

/** The engine's two vendor parsers (mandateCorporateActions.js, called, never edited), for the parse report
 *  (caParseReport.js, T1a-2b-4 T2D-12) — re-exported here so the engine-import guard (exits.test.js rule 7) still names
 *  only this file and the close as the engine's corporate-action importers. */
export const parseVendorSplits = (symbol, rows) => parseSplitsPayload(symbol, rows);
export const parseVendorDividends = (symbol, rows) => parseDividendsPayload(symbol, rows);

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

export const SHARE_BASIS_TYPES = new Set(['split', 'reverse_split', 'stock_distribution']);
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

// ── RE-DATED AND LATE ACTIONS (Amendment F-7; T1a-1 FR-A5, RF-A2; T1a-2a C-16) ──────────────────────────────────────
// The engine's id is (type, ticker, effective date): a vendor that moves an action's date lists it under a NEW id.
//   • A POSSIBLE RE-DATE: a row with the same symbol, type and payload (amount, or ratio) as an action this ledger has
//     already applied or holds — or declined as not entitled (the agreed Q10; Astra T2D-01) — under a different id, with
//     an effective date within REDATE_WINDOW_SESSIONS sessions of it, is NOT applied. It is recorded once (`possible_redate`, naming both ids) and alerted while listed; it is not
//     settled, so the founder may apply it (resolve_hold, `conflict`). A share-basis one is a doubt about the symbol's
//     count — it is either the same split (the count is right) or a second one (it is not) — so it holds, as a conflict
//     does; a cash dividend's puts no count in doubt and holds nothing.
//   • A CONFLICT SETTLED UNDER A MOVED DATE: a row under a new id, within the same window, whose payload is one of an
//     unsettled conflict's payloads settles that conflict: the row is applied once, and the old id is recorded as
//     settled by it (`settled_by_redate`, declined).
//   • A LATE CASH ACTION: a cash dividend dated BEFORE a share-basis action this ledger has already applied, but listed
//     only after it, is paid on the count the holding had ON ITS OWN EX-DATE — read from the applied share-basis
//     receipts' `sharesBefore` (every one written since T1a-2b-3 carries `sharesBefore` and `sharesAfter`). With no
//     such count on record, nothing is estimated: the dividend is held, refused `count_on_ex_date_unknown`.

/** The receipt reason of a row the ledger does not apply as a possible re-date of one it applied or holds. */
export const POSSIBLE_REDATE = 'possible_redate';
/** The receipt reason of an action the holding was not entitled to (bought on or after its effective date). Since the
 *  T1a-2b-3 fix round the receipt keeps the payload it declined, and a row re-dated within the window matches it (Q10). */
export const NOT_ENTITLED = 'not_entitled';
/** Two effective dates this many trading sessions apart, or fewer, can be one action re-dated by the vendor. */
export const REDATE_WINDOW_SESSIONS = 5;

/** Are two session dates within `n` trading sessions of each other? (Exported for the adjustments, T1a-2b-4.) */
export function withinSessions(a, b, n) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let [lo, hi] = a <= b ? [a, b] : [b, a];
  for (let i = 0; i < n && lo < hi; i += 1) {
    const s = nextSessionDate(lo);
    if (s === null) return false;
    lo = s;
  }
  return lo >= hi;
}
/** Q-14 (the founder's ruling, 20 Nov 2026): the OTHER share-basis ids among `others` — rows or items of `action`'s symbol
 *  — on `action`'s effective date that the founder has not ruled at this close (`ruledHere`). A ruled share-basis action
 *  beside any of them, recorded, held, waiting or listed now, always HOLDS, as one ambiguity with it, until the founder
 *  rules the pair, whatever order the two ids sort in; meanwhile no dividend, sale or approval uses the count. The held
 *  path (`applyLedgerActions`) and the closed one (adjustments.js) both ask it. */
export function sameDateUnruled(action, others, ruledHere) {
  if (!SHARE_BASIS_TYPES.has(action?.type) || typeof action.effectiveDate !== 'string') return [];
  return others.filter((o) => o && o.actionId !== action.actionId && SHARE_BASIS_TYPES.has(o.type) && o.effectiveDate === action.effectiveDate && !ruledHere?.has(o.actionId));
}
/** The payload two rows of one kind must share to be one action (the id fixes the rest). */
const samePayload = (a, b) => (a?.ratio ?? null) === (b?.ratio ?? null) && (a?.amount ?? null) === (b?.amount ?? null)
  && (a?.cashPerShare ?? null) === (b?.cashPerShare ?? null);

// ── ROWS LISTED BEFORE THEIR DATE (the founder's ruling of 21 Nov 2026, A-1 to A-3; Astra T2E-C01 to C03) ─────────────
// The daily layer lists a row up to two calendar days before its effective date, and a vendor announces most dividends
// days ahead. Before this ruling the ledger dropped every row dated after the close (the engine's selector, onOrBefore),
// so an announcement's history was lost: a payload revised before its date paid the latest value with no record, a row
// moved to an earlier date was paid there, and a sale forgot what the holding had been told.
//   A-2  Every row listed for a held symbol and dated AFTER the close is OBSERVED on its ledger (`listedAhead`) from its
//        first listing — its id, type, date and the payloads of its latest listing — at COVERED closes only: a close whose
//        data does not cover the symbol is neither an update nor a withdrawal. The observation lives on the LEDGER, not the
//        holding, so it outlasts a sale (adjustments.js screens a sold holding's rows against it).
//   A-1  Before its date, the latest listing of an id is the announcement: a changed payload, a withdrawal, a conflict that
//        resolves to one payload are updates — nothing has been owed or paid, so nothing waits. From the first close on or
//        after the date the row is compared with the announcement it entered the date with: another payload, an
//        announcement still conflicting (A-3), or a withdrawn one listed again, is a REVISION — ambiguous, for the founder
//        (Amendment F rev 1, L-1 to L-8). An unchanged announcement is on-time data and applies exactly as before.
//   A-2  An observation is a PAIRING CANDIDATE for the re-date rule (L-2 ②, L-3) even before its date. From the first close
//        on or after either id's date, two ids of one payload within the window are one ambiguity — unless the switch from
//        one to the other was made before both dates (A-1): the later announcement was listed, at a covered close, after
//        the other's last listing and before both dates. An observation such a pairing makes ambiguous takes its own
//        `possible_redate` record at that very close, so the founder can answer it (resolve_hold, `conflict`): a blocker
//        with no record would be a dead end (T2E-C05's lesson).
// An observation is OPEN (a pairing candidate itself) until its id is settled, recorded or held on the ledger — those carry
// it from there — and is KEPT after that: its listing dates still show a switch made before both dates, whichever id it is
// paired with later. Nothing is written for a row that is never listed ahead, so complete, on-time data stores exactly
// what it stored before.

/** The ledger's observations of rows listed before their date (A-2): `[{ actionId, type, ticker, effectiveDate, listedOn,
 *  payloads, firstSeenOn, withdrawnOn }]` — `listedOn` the covered closes before its date that listed it, `payloads` the
 *  distinct payloads of its latest such listing, `withdrawnOn` the first covered close before its date that no longer did. */
export const listedAheadOf = (ledger) => (Array.isArray(ledger?.listedAhead) ? ledger.listedAhead : []);
/** The observation of `actionId` on a ledger, or null. */
export const announcementOf = (ledger, actionId) => listedAheadOf(ledger).find((e) => e?.actionId === actionId) ?? null;
/** The last covered close before its date that listed an observation (A-2). */
export const lastListedOf = (e) => (Array.isArray(e?.listedOn) && e.listedOn.length > 0 ? e.listedOn[e.listedOn.length - 1] : null);
/** The action an observation stands for, by its latest announced payload (the first, when it was listed two ways). */
export function actionOfAnnouncement(e) {
  const p = (e?.payloads || [])[0] || {};
  return {
    type: e.type, ticker: upper(e.ticker), effectiveDate: e.effectiveDate, actionId: e.actionId, source: p.source ?? null,
    ...(p.ratio != null ? { ratio: p.ratio } : {}), ...(p.amount != null ? { amount: p.amount } : {}),
    ...(p.cashPerShare != null ? { cashPerShare: p.cashPerShare } : {}), ...(p.renamedTo != null ? { renamedTo: p.renamedTo } : {}),
  };
}
/** A-1, at the first close on or after its date: does what is listed for the id now (`rows`) differ from the announcement it
 *  entered the date with? A withdrawn announcement, or one still listed two ways (A-3), always does. Pure. */
export function differsFromAnnouncement(e, rows) {
  if (!e || !(Array.isArray(e.listedOn) && e.listedOn.length > 0)) return false;
  if (e.withdrawnOn != null || (e.payloads || []).length !== 1) return true;
  const announced = actionPayloadOf(e.payloads[0]);
  return (rows || []).some((r) => actionPayloadOf(r) !== announced);
}
/**
 * A-1: WAS THE SWITCH BETWEEN TWO IDS MADE BEFORE BOTH THEIR DATES? `a` superseded `b` when `a` was listed, at a covered
 * close, after `b`'s last listing and before both dates (`entryA.listedOn`); `lastB` is null when `b`'s last listing is not
 * known to be before its date (listed on or after it, or never ahead) — then no switch can be shown, and the two pair. Pure.
 */
export function switchedBeforeDates(entryA, lastA, dateA, entryB, lastB, dateB) {
  const m = dateA < dateB ? dateA : dateB;
  const sup = (e, last) => Boolean(e) && typeof last === 'string' && (e.listedOn || []).some((x) => x > last && x < m);
  return sup(entryA, lastB) || sup(entryB, lastA);
}

/** The `possible_redate` receipts of a ledger whose row is not settled since (neither applied nor declined). */
export function unsettledRedates(ledger) {
  const settled = settledIdsOf(ledger);
  return (ledger?.corporateActionReceipts || []).filter((r) => r?.reason === POSSIBLE_REDATE && !settled.has(r.actionId));
}

/**
 * The `conflicting_action` receipts on a ledger whose action is not settled since — neither applied nor declined. A row
 * of the idea stays not full quality while any is open (close.js; review FR-A1). Amendment F rev 1 (S-1, S-2): this
 * includes a conflict on an action the holding was NOT entitled to — it is ambiguous like any other, and only the
 * founder settles it (refuter RF-A1's release once the feed stopped listing it was an automatic settle, and its payloads
 * are what a later re-date is matched against: Astra T2D-C01).
 */
export function unsettledConflicts(ledger) {
  const settled = settledIdsOf(ledger);
  return (ledger?.corporateActionReceipts || []).filter((r) => r?.reason === CONFLICTING_ACTION && !settled.has(r.actionId));
}

/** The receipt reason of a ruled id the feed later lists with a payload the ruling did not see (Amendment F rev 1, S-2). */
export const REVISED_AFTER_RULING = 'revised_after_ruling';

/** The `revised_after_ruling` records of a ledger the founder has not answered yet (`closedBy` null). */
export function openRulingRevisions(ledger) {
  return (ledger?.corporateActionReceipts || []).filter((r) => r?.reason === REVISED_AFTER_RULING && r.closedBy == null);
}

/**
 * EVERY OPEN AMBIGUITY of a ledger (Amendment F rev 1): its unsettled conflicts (revisions and archive/backfill
 * disagreements are recorded as conflicts), its unsettled possible re-dates, and its ruled ids revised since. One
 * predicate for the gate, the row's quality, the endpoint's naming and the founder's rulings.
 */
export function openAmbiguities(ledger) {
  return [...unsettledConflicts(ledger), ...unsettledRedates(ledger), ...openRulingRevisions(ledger)];
}

/** The payloads an ambiguity record has seen: its `rows`, or (a record written before rev 1) its own payload. */
export function recordedPayloadsOf(r) {
  if (Array.isArray(r?.rows) && r.rows.length > 0) return r.rows;
  return [{ ratio: r?.ratio ?? null, amount: r?.amount ?? null, ...(r?.cashPerShare != null ? { cashPerShare: r.cashPerShare } : {}) }];
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
export const suspicionIdOf = (symbol, s) => `${SUSPECTED_SPLIT}_${upper(symbol)}_${s.suspectedOn}`;

/**
 * The holding's open suspicion. A record stands until a listed share-basis row explains it or the founder's ruling is
 * applied (Amendment F-5): either RETIRES it into `basisSuspicionHistory` (F-8), so a record on the holding is open.
 * (The provisional T5 reader — a record carrying `resolvedBy` and `resolvedAt` holding nothing, and the screen
 * matching the ruled move's signature against the frozen mark — is gone: that matching was the root of Z1.)
 */
export function openBasisSuspicion(holding) {
  const s = holding?.basisSuspicion;
  if (!s || typeof s !== 'object') return null;
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

/** Is `ratio` (shares × r) the split the move `moveRatio` (price × 1/r) shows, within twice the engine's tolerance? */
export const ratioMatchesMove = (ratio, moveRatio) => Number(ratio) > 0 && sameMove(moveRatio, 1 / Number(ratio));

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
  return classifyOvernightGaps({ [sym]: screenHoldingOf(holding) }, snapshot, { [sym]: paid }, { sinceDate: null, asOfDate: date }).pendingCA.has(sym);
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

/**
 * F-5 (review B1, B3, D1; lens A's A1): THE GAP SCREEN'S REFERENCE AFTER A FOUNDER'S `price_move` RULING — see
 * priceMoveReference. It is kept as `screenReference` beside the holding's mark, never written into `lastMark` or its
 * provenance, which stay the carried mark a stored snapshot priced (a carried price must cite the row that priced it;
 * D1). A share-basis action dated after the reference's session divides it (applyActions); the first fresh mark replaces
 * it (withCloseMarks). Every gap screen of a holding reads it (screenHoldingOf).
 */
const screenReferenceOf = (h) => (h?.screenReference && Number(h.screenReference.price) > 0 && typeof h.screenReference.session === 'string' ? h.screenReference : null);
/** The holding as the gap screen sees it: its screen reference, if any, in place of its mark. */
function screenHoldingOf(h) {
  const ref = screenReferenceOf(h);
  return ref ? { ...h, lastMark: Number(ref.price) } : h;
}
const screenView = (holdings) => Object.fromEntries(Object.entries(holdings || {}).map(([sym, h]) => [sym, screenHoldingOf(h)]));

/**
 * The session the holding's last trusted mark CAME FROM, or null when it cannot be told (Amendment F-3; Astra T2B-01's
 * confirmation). It is the mark's own provenance (`lastMarkProvenance.session`): the session of the snapshot that
 * priced it, which a carry or a split's adjustment leaves unchanged. Not `lastMarkAsOf`, which keeps an older quote's
 * vendor time when a later quote had none — so a gap was dated from a session before the one its frozen mark came from
 * (Nov 27 timed → Nov 30 untimed → a later halving read as moving since Nov 27). A holding with no provenance says it
 * cannot be told (null): every cash action after the mark then waits, the fail-closed side.
 */
function markSessionOf(holding) {
  // (After a `price_move` ruling the screen's reference is the price seen at the record's session: the gap runs from there.)
  const session = screenReferenceOf(holding)?.session ?? holding?.lastMarkProvenance?.session;
  return typeof session === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(session) ? session : null;
}

/**
 * THE GAP SCREEN, ASKED BEFORE ANY CASH (fix round 3, T2A-D01). On the state a cash action would be paid on — this
 * close's share-basis actions applied (the dry run shareBasisHolds makes), nothing else — every symbol the engine's
 * screen SUSPECTS (a split's shape with no feed row: `suspectedCA`, never `pendingCA`, which a listed row explains) gets
 * a `basisSuspicion` record on this ledger's holding, unless it still has an open one once those share-basis actions are
 * applied (the first is kept, with the session it was first suspected), the founder has ruled on this very move, or the
 * holding waits on a delisting (R-32) — on this ledger, or on the idea's own (`delistingWaiting`, which the close reads
 * from the idea's ledger: only it carries the waiting sale, and a suspicion on the comparison would hold that sale
 * idea-wide). Pure.
 * The open note is read on the DRY-RUN holding, not the stored one (final fix, Astra T2A-E01): a row of this close that
 * explains the old note releases it in the dry run, and a further move that row does not explain is then recorded in its
 * place — with that move's session, ratio and adjusted frozen mark — before the idea's hold set is computed, so the cash
 * waits until a listed row explains the new move too.
 * A symbol whose corporate-action data does not cover this session (`skip`; Amendment F-1) is not screened: its share
 * basis is already in doubt for want of data, everything that depends on its count waits for that, and its mark is
 * carried. It is screened at the close whose data covers it again, after the rows that data lists are applied.
 * THE DRY RUN USES THE HOLDING'S REAL STATE (Amendment F rev 1, S-4; Astra T2D-C04): it is handed the close's coverage
 * holds (`holds`), so a split that coverage — or ambiguity, which the applier's own gate refuses — keeps from applying is
 * not simulated either. Simulated, it retired the record the real holding still stands under, and the next split-shaped
 * transition, seen while that record stood, was never recorded.
 * @returns {{ ledger: object, raised: Array<object> }}
 */
export function withBasisSuspicions(ledger, closeSnapshot, actionsBySymbol, { sinceDate, date, delistingWaiting = null, skip = null, ruledIds = null, pricesUsable = true, holds = null }) {
  if (!ledger || !closeSnapshot) return { ledger, raised: [] };
  const dry = applyActions(ledger, actionsBySymbol, { date, phase: 'share_basis', ruledIds, holds }).ledger;
  const settled = settledIdsOf(dry);
  const scan = classifyOvernightGaps(screenView(dry.holdings), closeSnapshot, actionsBySymbol, { sinceDate: sinceDate ?? null, asOfDate: date, excludeActionIds: settled });
  let next = ledger;
  const raised = [];
  for (const [sym, { ratio }] of scan.suspectedCA) {
    const h = ledger.holdings?.[sym];
    const d = dry.holdings?.[sym];
    if (!h || !d || skip?.has(sym) || openBasisSuspicion(d) || delistingWaitingHolding(h) || delistingWaiting?.has(sym)) continue;
    // A delisting with no cash listed for it today makes it a waiting sale at this close (R-32, as above).
    if ((actionsBySymbol?.[sym] || []).some((a) => a?.type === 'delisting' && delistingCashOf(a) === null && typeof a.effectiveDate === 'string' && a.effectiveDate <= date && !settled.has(deriveActionId(a)))) continue;
    // (A dividend paid at an earlier close that explains its own ex-date drop leaves that close's mark fresh —
    // suspectedActionSymbols — so the move is not seen here again: review F2, refuter D2.)
    const since = markSessionOf(d);
    const record = {
      symbol: sym, suspectedOn: date, since, ratio,
      shape: shapeOf(ratio),
      frozenMark: Number(screenHoldingOf(d).lastMark), frozenMarkAsOf: d.lastMarkAsOf ?? null, resolvedBy: null, resolvedAt: null,
      // F-5: the price seen at THIS session (`seenAtRaise`, written once) and the last one seen while the record stands
      // (`lastSeen`, refreshed below): a `price_move` ruling judges the move between them (priceMoveReference).
      seenAtRaise: quoteSeenOf(closeSnapshot, sym, date),
      lastSeen: quoteSeenOf(closeSnapshot, sym, date),
    };
    if (next === ledger) next = cloneLedger(ledger);
    // F-8: an old note this close's row explained in the dry run (T2A-E01) is retired into the history, naming the row
    // that explained it, before the new note takes its place — so the row's receipt can name it too.
    const old = openBasisSuspicion(h);
    let history = h.basisSuspicionHistory || [];
    if (old) {
      const oldId = suspicionIdOf(sym, old);
      const by = (dry.corporateActionReceipts || []).find((r) => r.applied === true && r.appliedOn === date && r.explainedSuspicion?.id === oldId);
      history = [...history, {
        ...old, id: oldId, closedOn: date, explainedBy: by ? { actionId: by.actionId, type: by.type, ratio: by.ratio ?? null, effectiveDate: by.effectiveDate } : null, replacedBy: suspicionIdOf(sym, record),
        // F-8: a record the founder's `split` explained names the ruling here too (review B7).
        ...(by?.founderRuling ? { resolvedBy: by.founderRuling.by ?? null, resolvedAt: by.founderRuling.at ?? null, ruling: by.founderRuling } : {}),
      }];
    }
    next.holdings[sym] = { ...h, basisSuspicion: record, ...(old ? { basisSuspicionHistory: history } : {}) };
    raised.push(record);
  }
  // F-5: every record still open after this close's rows keeps the last price seen while it stands (`lastSeen`) — at a
  // close whose data covers the symbol only (`skip`: a session with no corporate-action data, or a snapshot naming
  // another layer, says nothing a ruling may rely on; lens A's A1). Raised records already carry this close's.
  for (const [sym, h] of Object.entries(next.holdings || {})) {
    const open = openBasisSuspicion(h);
    if (!open || open.suspectedOn === date || !pricesUsable || !openBasisSuspicion(dry.holdings?.[sym])) continue;
    const seen = quoteSeenOf(closeSnapshot, sym, date);
    if (seen === null) continue;
    const uncoveredHere = skip?.has(sym) === true;
    // Astra T2D-08: every SPLIT-SHAPED TRANSITION seen while the record stands is kept, with its dates — the step from
    // the last price observed to this one, put to the engine's own screen. Only the first and the last price survived
    // before, so a halving and its recovery ($50 → $25 → $50) vanished, and a ruling on the first halving released a
    // dividend dated inside the hidden one. A close whose corporate-action data does not cover the symbol still OBSERVED
    // its price (its snapshot names its layer): a transition there is kept too, flagged `uncovered` (fix-round refuter
    // AR1-RF-04), but it never moves `lastSeen` — a ruling's reference is a covered close's (lens A's A1). The last price
    // observed at such a close is kept as `lastQuote` until a covered close replaces it, so the next step is judged from it.
    const prior = isSeen(open.lastQuote) && (!isSeen(open.lastSeen) || open.lastQuote.session > open.lastSeen.session) ? open.lastQuote : open.lastSeen;
    const step = transitionOf(sym, prior, seen);
    const transitions = step ? [...(Array.isArray(open.transitions) ? open.transitions : []), uncoveredHere ? { ...step, uncovered: true } : step] : open.transitions;
    const { lastQuote: _replaced, ...covered } = open;
    const record = uncoveredHere ? { ...open, lastQuote: seen } : { ...covered, lastSeen: seen };
    if (transitions) record.transitions = transitions;
    if (next === ledger) next = cloneLedger(ledger);
    next.holdings[sym] = { ...next.holdings[sym], basisSuspicion: record };
  }
  return { ledger: next, raised };
}

/** A quote seen, as kept on a record (`seenAtRaise`, `lastSeen`, a transition's ends). */
const isSeen = (q) => q !== null && typeof q === 'object' && Number(q.price) > 0 && typeof q.session === 'string';

/**
 * T2D-08: the split-shaped move from one price seen to a later one, as the engine's screen judges an overnight gap —
 * `{ session, since, ratio, from, to }` — or null (no such move, or either end unknown). Pure.
 */
function transitionOf(symbol, from, to) {
  if (!isSeen(from) || !isSeen(to) || !(to.session > from.session)) return null;
  const sym = upper(symbol);
  const scan = classifyOvernightGaps({ [sym]: { lastMark: Number(from.price) } }, { symbols: { [sym]: { price: Number(to.price), complete: true } } }, {}, { asOfDate: to.session });
  const step = scan.suspectedCA.get(sym);
  return step ? { session: to.session, since: from.session, ratio: step.ratio, from, to } : null;
}

/**
 * T2D-08: THE RECORD A TRANSITION BECOMES once the record it was seen under is retired — by the founder's ruling, or by a
 * row that explains it. It stands for that move exactly: first seen at its own session, frozen at the price before it,
 * holding what is dated after the session that price came from; the transitions after it travel with it, and it keeps
 * the last price seen. `raisedBy` names what retired the record before it. Pure.
 */
function recordOfTransition(symbol, t, rest, lastSeen, raisedBy) {
  const sym = upper(symbol);
  return {
    symbol: sym, suspectedOn: t.session, since: t.since, ratio: t.ratio, shape: shapeOf(t.ratio),
    frozenMark: Number(t.from.price), frozenMarkAsOf: t.from.vendorTimeIso ?? null, resolvedBy: null, resolvedAt: null,
    seenAtRaise: t.to, lastSeen: isSeen(lastSeen) && lastSeen.session >= t.to.session ? lastSeen : t.to,
    ...(rest.length > 0 ? { transitions: rest } : {}), raisedBy,
  };
}

/** The transitions a record still carries (well formed, in session order). */
const transitionsOf = (s) => (Array.isArray(s?.transitions) ? s.transitions.filter((t) => t && isSeen(t.from) && isSeen(t.to) && Number(t.ratio) > 0) : []);

/**
 * F-5: WHAT A `price_move` RULING LEAVES THE GAP SCREEN (review B1, B3; lens A's A1; Z1). The ruling covers EXACTLY the
 * recorded move — the move seen at the record's own session. Every later move is judged, never covered: so the move
 * from the price seen then (`seenAtRaise`) to the last price seen while the record stood (`lastSeen`) is put to the
 * engine's own screen. A split-shaped one is a NEW record, of that move (`stepRecord`: first seen at `lastSeen`'s
 * session, frozen at `seenAtRaise`'s price) — a second halving made while the record stood (B1), or a recovery the
 * record hid (Z1) — and the screen's reference stays the ruled session's price, so a row dated after it that explains the
 * new record divides it. Otherwise the reference is the last price seen (`screenReference`): a later move is judged
 * against it, and a split dated after it divides it (Y4). Pure.
 * @returns {{ screenReference: object|null, stepRecord: object|null }}
 */
export function priceMoveReference(symbol, s, { requestKey = null } = {}) {
  const sym = upper(symbol);
  const ok = isSeen;
  const seen = ok(s?.seenAtRaise) ? s.seenAtRaise : null;
  if (seen === null) return { screenReference: null, stepRecord: null };
  const reference = (q) => ({ price: Number(q.price), session: q.session, snapshotKey: q.snapshotKey ?? null, ruling: requestKey });
  // Astra T2D-08: the split-shaped transitions seen while the record stood come first, each its own move: the first is
  // the new record, carrying the rest — a halving hidden by its recovery is never covered by the ruling before it.
  const [first, ...rest] = transitionsOf(s);
  if (first) {
    return {
      screenReference: reference(seen),
      stepRecord: recordOfTransition(sym, first, rest, s.lastSeen, { ruling: requestKey, after: suspicionIdOf(sym, s) }),
    };
  }
  const last = ok(s.lastSeen) && s.lastSeen.session > seen.session ? s.lastSeen : null;
  if (last === null) return { screenReference: reference(seen), stepRecord: null };
  const scan = classifyOvernightGaps({ [sym]: { lastMark: Number(seen.price) } }, { symbols: { [sym]: { price: Number(last.price), complete: true } } }, {}, { asOfDate: last.session });
  const step = scan.suspectedCA.get(sym);
  if (!step) return { screenReference: reference(last), stepRecord: null };
  return {
    screenReference: reference(seen),
    stepRecord: {
      symbol: sym, suspectedOn: last.session, since: seen.session, ratio: step.ratio, shape: shapeOf(step.ratio),
      frozenMark: Number(seen.price), frozenMarkAsOf: seen.vendorTimeIso ?? null, resolvedBy: null, resolvedAt: null,
      seenAtRaise: last, lastSeen: last, raisedBy: { ruling: requestKey, after: suspicionIdOf(sym, s) },
    },
  };
}

/** What a close's snapshot shows of a symbol, as a mark's provenance would name it — or null with no complete quote. */
function quoteSeenOf(closeSnapshot, sym, date) {
  const e = closeSnapshot?.symbols?.[sym];
  if (!e?.complete || !(Number(e.price) > 0)) return null;
  const q = closeMarkQuality(e, date);
  return { session: date, price: Number(e.price), snapshotKey: closeSnapshot.tickKey ?? null, quality: q.quality, vendorTimeIso: q.vendorTimeIso ?? null };
}

/** What makes two feed rows of one id the same action. The id already fixes the type, ticker and effective date. */
// (A rename's target compares in upper case — AR2-RF-3: `aapx` and `AAPX` are one target, and a ruling that saw one saw both.)
export const actionPayloadOf = (row) => JSON.stringify([row.ratio ?? null, row.amount ?? null, row.renamedTo != null ? upper(row.renamedTo) : null, row.cashPerShare ?? null]);

/**
 * The ids, among this call's due rows, that the feed lists more than once with different payloads.
 * @returns {Map<string, Array<object>>}  id → every row of it (in feed order)
 */
function conflictingActionIds(rows) {
  const byId = new Map();
  for (const row of rows) {
    const id = row.actionId ?? deriveActionId(row);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(row);
  }
  const conflicts = new Map();
  for (const [id, group] of byId) if (new Set(group.map(actionPayloadOf)).size > 1) conflicts.set(id, group);
  return conflicts;
}

// ── STICKY AMBIGUITY'S RECORDS (Amendment F rev 1; see the header) ──────────────────────────────────────────────────

/** A row's payload as an ambiguity record keeps it — `seenOn` when it was first seen after the record was made, and
 *  `origin: 'backfill'` for a row a backfill carried (close.js tags them), so an archive/backfill disagreement is named. */
function rowOfPayload(row, seenOn) {
  return {
    ratio: row?.ratio ?? null, amount: row?.amount ?? null,
    ...(row?.cashPerShare != null ? { cashPerShare: row.cashPerShare } : {}),
    ...(row?.renamedTo != null ? { renamedTo: row.renamedTo } : {}),
    source: row?.source ?? null,
    ...(row?.feedOrigin === 'backfill' || row?.origin === 'backfill' ? { origin: 'backfill' } : {}),
    ...(seenOn ? { seenOn } : {}),
  };
}

/** The kinds of ambiguity a record stands for (S-1): what it was, plus `add`, plus `archive_backfill` once its payloads
 *  came both from a backfill and from the daily layer (S-1 ④; Astra T2D-C02). */
function kindsOf(record, rows, add) {
  const kinds = new Set(record ? (record.kinds || [record.reason === POSSIBLE_REDATE ? 'possible_redate' : 'conflict']) : []);
  kinds.add(add);
  const fromBackfill = rows.some((r) => r?.origin === 'backfill');
  if (fromBackfill && rows.some((r) => r?.origin !== 'backfill')) kinds.add('archive_backfill');
  return [...kinds];
}

/**
 * The ids a FOUNDER'S RULING settled on this ledger — applied with its payload, declined `none`, or declined as not
 * entitled — each with every payload the ruling covered (S-2). A conflict ruling made since this round carries what its
 * record had SEEN when it was made (`seen`; AR2-C-1: a payload observed later, even before the ruling applied, is not
 * covered). One without it (a ruling of another kind, or recorded before) covers its applied payload, and a conflict
 * ruling's record's payloads. A revision the founder has answered (closed) is covered too. A payload outside these is
 * what the founder has not seen. Pure.
 * @returns {Map<string, { keys: Set<string>, ruling: string|null, ruled: object|string }>}
 */
export function founderSettledIds(ledger) {
  const out = new Map();
  const receipts = ledger?.corporateActionReceipts || [];
  // T1a-2b-4 (Astra T2D-05; FQ-11): AN ID THE FEED SETTLED — applied with one payload, never ambiguous — is covered by that
  // payload alone. A later different payload under it was discarded before (the settled id never reached the gate); it is
  // now the same new ambiguity a ruled id's revision is (`revised_after_ruling`, `ruling: null`, `settledBy: 'feed'`):
  // alerted, below full quality, a split's count in doubt again, and only the founder answers it — keeping the original,
  // or choosing the correction, which the close applies as ONE linked adjustment (adjustments.js). Cash dividends and
  // share-basis actions only: the classes the adjustment can correct. A ruling's later correction of it (a ruled_correction
  // adjustment) covers what that ruling saw, and is the outcome now.
  for (const r of receipts) {
    if (r?.applied !== true || r.founderRuling || r.historyOnly === true) continue;
    if (!(SHARE_BASIS_TYPES.has(r.type) || r.type === 'cash_dividend') || out.has(r.actionId)) continue;
    const keys = new Set([actionPayloadOf(r)]);
    for (const x of receipts) if (x?.actionId === r.actionId && x.reason === REVISED_AFTER_RULING && x.closedBy != null) for (const p of x.rows || []) keys.add(actionPayloadOf(p));
    out.set(r.actionId, { keys, ruling: null, ruled: { ratio: r.ratio ?? null, amount: r.amount ?? null }, settledBy: 'feed' });
  }
  for (const a of ledger?.adjustments || []) {
    if (a?.kind !== 'ruled_correction' || !a.ruling || !out.has(a.actionId)) continue;
    const prior = out.get(a.actionId);
    const keys = new Set(prior.keys);
    for (const p of a.ruling.seen || []) keys.add(actionPayloadOf(p));
    keys.add(actionPayloadOf(a.payload || {}));
    out.set(a.actionId, { keys, ruling: a.ruling.requestKey ?? null, ruled: { ratio: a.payload?.ratio ?? null, amount: a.payload?.amount ?? null }, settledBy: 'feed' });
  }
  for (const r of receipts) {
    const ruling = r?.founderRuling;
    if (!ruling) continue;
    if (!(r.applied === true || r.reason === 'founder_ruled_none' || r.reason === NOT_ENTITLED)) continue;
    const keys = new Set();
    if (Array.isArray(ruling.seen)) {
      for (const p of ruling.seen) keys.add(actionPayloadOf(p));
    } else if (ruling.kind === 'conflict') {
      for (const x of receipts) if (x?.actionId === r.actionId && (x.reason === CONFLICTING_ACTION || x.reason === POSSIBLE_REDATE)) for (const p of recordedPayloadsOf(x)) keys.add(actionPayloadOf(p));
    }
    for (const x of receipts) if (x?.actionId === r.actionId && x.reason === REVISED_AFTER_RULING && x.closedBy != null) for (const p of x.rows || []) keys.add(actionPayloadOf(p));
    if (r.reason !== 'founder_ruled_none') keys.add(actionPayloadOf(r));
    const ruled = r.reason === 'founder_ruled_none' ? 'none' : {
      ratio: r.ratio ?? null, amount: r.amount ?? null, ...(r.cashPerShare != null ? { cashPerShare: r.cashPerShare } : {}), ...(r.renamedTo != null ? { renamedTo: r.renamedTo } : {}),
    };
    out.set(r.actionId, { keys, ruling: ruling.requestKey ?? null, ruled });
  }
  return out;
}

/**
 * T1a-2b-4: THE FOUNDER'S RATIO CORRECTIONS of a ledger's symbol — actionId → the ratio in force (a posted share-basis
 * `ruled_correction` adjustment, adjustments.js correctShareBasisOn). Empty on a ledger no correction touched. Pure.
 */
export function ratioCorrectionsOf(ledger, symbol, { postedOnOrBefore = null } = {}) {
  const sym = upper(symbol);
  const out = new Map();
  for (const a of ledger?.adjustments || []) {
    if (!a || a.held === true || a.kind !== 'ruled_correction' || !SHARE_BASIS_TYPES.has(a.type) || upper(a.ticker) !== sym || !(Number(a.ratio) > 0)) continue;
    if (postedOnOrBefore !== null && !(typeof a.postedOn === 'string' && a.postedOn <= postedOnOrBefore)) continue;
    out.set(a.actionId, Number(a.ratio));
  }
  return out;
}

/**
 * THE SHARE-BASIS CHAIN of a ledger's symbol, IN DATED ORDER (T1a-2b-4 fix round, the founder's L-4: counts are
 * recomputed, not patched): every applied share-basis receipt — effective date, then phase, then id, whatever order they
 * were applied in — each with its ratio (the founder's correction of it, if one is in force) and the count before and
 * after it, REPLAYED from the count before any of them (the first-applied receipt's `sharesBefore`: the entry fill, as an
 * idea never buys again and a sale closes the whole holding), rounding to six places at each step as the applier rounds.
 * Applied in date order, the replay reproduces the recorded counts exactly; applied out of it (a split listed late), it
 * is the count the holding, the book's mirror and every later ex-date count use (T2E-04: 4-for-5 then 2-for-1 gives
 * 159.952012, the order of arrival 159.952013). The one chain every reader of a count reads (review AR4-C-1). `index` is
 * each receipt's place in the order applied. Pure.
 * @returns {{ events: Array<{ actionId, effectiveDate, ratio, before, after, index, historyOnly }>, base: number|null, end: number|null }}
 */
export function shareBasisChainOf(ledger, symbol) {
  const sym = upper(symbol);
  const corrected = ratioCorrectionsOf(ledger, sym);
  const applied = [];
  let base = null;
  for (const [index, r] of (ledger?.corporateActionReceipts || []).entries()) {
    if (r?.applied !== true || !SHARE_BASIS_TYPES.has(r.type) || upper(r.ticker) !== sym) continue;
    if (base === null) base = Number(r.sharesBefore);
    applied.push({ r, index });
  }
  applied.sort((a, b) => byDatePhaseId(a.r, b.r) || a.index - b.index);
  const events = [];
  let count = base;
  for (const { r, index } of applied) {
    const ratio = corrected.get(r.actionId) ?? Number(r.ratio);
    const before = count;
    const after = roundShares(before * ratio);
    count = after;
    events.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, ratio, before, after, index, historyOnly: r.historyOnly === true });
  }
  return { events, base, end: count };
}

/** T1a-2b-4 fix round (L-4): the count of `symbol` on `exDate` along the dated chain — the count before any share-basis
 *  event, times every one dated on or before it, in dated order, rounded at each step. Null with no event applied. Pure. */
export function datedCountOn(ledger, symbol, exDate) {
  const { events, base } = shareBasisChainOf(ledger, symbol);
  if (events.length === 0) return null;
  let count = base;
  const from = [];
  for (const e of events) {
    if (e.effectiveDate > exDate) break;
    count = roundShares(count * e.ratio);
    from.push(e.actionId);
  }
  return { count, from };
}

/** The feed's rows of `id` listed for a symbol this ledger holds, due on or before `date` (never a founder's action). */
function feedRowsListedFor(ledger, actionsBySymbol, id, date) {
  const out = [];
  for (const [sym, list] of Object.entries(feedRowsOf(actionsBySymbol))) {
    if (!ledger?.holdings?.[upper(sym)]) continue;
    for (const a of list || []) {
      if (a && a.founderRuling == null && typeof a.effectiveDate === 'string' && a.effectiveDate <= date && deriveActionId(a) === id) out.push(a);
    }
  }
  return out;
}

const itemOf = (a, ledger) => ({ actionId: a.actionId, type: a.type, effectiveDate: a.effectiveDate ?? null, ledger });
const byItem = (a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || a.actionId.localeCompare(b.actionId) || String(a.ledger).localeCompare(String(b.ledger));
const addItem = (map, sym, item) => {
  const key = upper(sym);
  const list = map.get(key) || [];
  const same = list.find((i) => i.actionId === item.actionId && i.ledger === item.ledger);
  if (!same) list.push(item);
  else if (item.ambiguous === true && same.ambiguous !== true) list[list.indexOf(same)] = { ...same, ambiguous: true }; // (a doubt about the id itself, however it was first listed)
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
  const due = pendingActionsFor(ledger?.holdings || {}, feedRowsOf(actionsBySymbol), { onOrBefore: date, appliedIds: settled });
  // F-5: a founder's `split` (its own id) is listed like a feed row.
  // …only one that would be applied on this state: a founder split moot here (its record gone, or standing for another
  // move now) explains nothing, so the record's own item stays and holds what is dated in its gap (fix-round refuter NF-1).
  const founder = founderSplitRowsOf(ledger, actionsBySymbol, { date, settled }).filter((a) => founderSplitMoot(ledger, upper(a.ticker), a, date) === null);
  for (const a of [...due.pending, ...due.noEntitlementData, ...founder]) if (SHARE_BASIS_TYPES.has(a.type)) addItem(out, a.ticker, itemOf(a, kind));
  // (`ambiguous`: the item is a doubt about THE ID ITSELF — another ledger's action of that same id waits on it; AR2-B-3.)
  for (const r of unsettledConflicts(ledger)) if (SHARE_BASIS_TYPES.has(r.type)) addItem(out, r.ticker, { ...itemOf(r, kind), ambiguous: true });
  // …and (Amendment F-7) every share-basis row recorded as a possible re-date and not settled since: the same split
  // under a moved date, or a second one — the count is in doubt either way until the founder settles it.
  for (const r of unsettledRedates(ledger)) if (SHARE_BASIS_TYPES.has(r.type)) addItem(out, r.ticker, { ...itemOf(r, kind), ambiguous: true });
  // …and (rev 1, S-2) a ruled split the feed has since listed with a ratio the ruling did not see: the count is in doubt
  // again until the founder answers.
  for (const r of openRulingRevisions(ledger)) if (SHARE_BASIS_TYPES.has(r.type)) addItem(out, r.ticker, { ...itemOf(r, kind), ambiguous: true });
  const ambiguous = new Set([...unsettledConflicts(ledger), ...unsettledRedates(ledger)].map((r) => r.actionId));
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
    // (Rev 1, S-4: an AMBIGUOUS row explains nothing — the applier will not apply it — unless it is the founder's.)
    const listed = [...due.pending.filter((a) => upper(a.ticker) === key && !conflicted.has(a.actionId) && (!ambiguous.has(a.actionId) || a.founderRuling)), ...founder.filter((a) => upper(a.ticker) === key)];
    const recorded = (h.heldActions || []).filter((r) => !r.refused && !settled.has(r.actionId) && (!ambiguous.has(r.actionId) || r.founderRuling)).map((r) => actionOfRecord(key, r));
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

// ── A DOUBT HOLDS ONLY WHAT IT TOUCHES (Amendment F-4; T1a-2a Q-O, Q-M) ──────────────────────────────────────────────
// A doubt ABOUT A SYMBOL — a feed conflict, an action unapplied or held because the data is in doubt, a split-shaped
// price move, a coverage gap — holds that symbol on every ledger of the idea, as before. A doubt IN ONE PAPER LEDGER'S
// OWN COUNT — the comparison's or the SPY line's — holds only that ledger: the data is clear, only that ledger's
// holding cannot take it. Its own count is in doubt when a share-basis action is refused for a reason of the ledger's
// own (`LEDGER_OWN_REFUSALS`: it would round the holding to nothing — refuter 2's frozen-basket holding under a correct
// reverse split — or the holding has no entitlement data), and so is any action it holds behind only such doubts of its
// own. The idea's own cash and sale go on. A doubt in the IDEA'S own count still holds the whole idea (its same-stock
// comparison has the same count, and the same doubt).

/** The refusals of a share-basis action that are about a ledger's OWN holding, not about the symbol's data. */
export const LEDGER_OWN_REFUSALS = new Set(['rounds_to_nothing', 'no_entitlement_data']);
const isPaperLedger = (ledger) => ledger?.kind === LEDGER_KIND.COMPARISON || ledger?.kind === LEDGER_KIND.SPY;

/**
 * The ids of a ledger's unresolved share-basis items that are doubts in its OWN count (see above): its records refused
 * for a reason of its own, the due rows it has no entitlement data for, and — to a fixpoint — every record held behind
 * nothing but such doubts on this same ledger. Pure.
 */
export function ledgerOwnDoubtIds(ledger, actionsBySymbol, { date }) {
  const kind = ledger?.kind ?? null;
  const own = new Set();
  const records = heldActionRecords(ledger);
  for (const r of records) if (typeof r.refused === 'string' && LEDGER_OWN_REFUSALS.has(r.refused)) own.add(r.actionId);
  const due = pendingActionsFor(ledger?.holdings || {}, actionsBySymbol || {}, { onOrBefore: date, appliedIds: settledIdsOf(ledger) });
  for (const a of due.noEntitlementData) if (SHARE_BASIS_TYPES.has(a.type)) own.add(a.actionId);
  for (let grew = true; grew;) {
    grew = false;
    for (const r of records) {
      if (own.has(r.actionId) || r.refused) continue;
      const causes = r.heldBecause || [];
      if (causes.length > 0 && causes.every((c) => c.ledger === kind && own.has(c.actionId))) { own.add(r.actionId); grew = true; }
    }
  }
  return own;
}

/**
 * The SYMBOLS a ledger has in doubt in the sense that holds the whole idea: its unresolved share-basis items, less — on
 * a paper ledger — the doubts in its own count (F-4). The idea's sale reads the other ledgers through this.
 */
export function ideaWideDoubtSymbols(ledger, actionsBySymbol, { date }) {
  const own = isPaperLedger(ledger) ? ledgerOwnDoubtIds(ledger, actionsBySymbol, { date }) : null;
  const out = new Set();
  for (const [sym, items] of unresolvedShareBasis(ledger, actionsBySymbol, { date })) if (items.some((i) => !own?.has(i.actionId))) out.add(sym);
  return out;
}

/**
 * THE IDEA'S HOLD SET at this close (Astra T2A-01, T2A-C01): every share-basis action unresolved on ANY of its ledgers
 * once this close's share-basis actions are applied (to a copy, with cash actions and renames withheld — a cash
 * delisting applied here would drop the holding and hide a due row on it). Every ledger is handed the same set, so a
 * same-stock comparison makes the same choice as its idea: an action that depends on the count waits on all of them,
 * or on none. A doubt in a PAPER ledger's own count is not in it (Amendment F-4): it holds that ledger alone, through
 * the ledger's own unresolved items. Pure.
 * @returns {Map<string, Array<{ actionId, type, effectiveDate, ledger }>>}  symbol → what it waits on
 */
export function shareBasisHolds(ledgers, actionsBySymbol, { date, ruledIds = null, holds = null }) {
  const out = new Map();
  // Each ledger may be handed its OWN rows (an array aligned with `ledgers`; Astra T2D-09: a founder ruling's action and
  // the feed rows it replaces belong to the ledgers whose record it covers), and its own ruled ids likewise.
  const rowsOf = (i) => (Array.isArray(actionsBySymbol) ? actionsBySymbol[i] : actionsBySymbol);
  const ruledOf = (i) => (Array.isArray(ruledIds) ? ruledIds[i] ?? null : ruledIds);
  for (const [i, ledger] of (ledgers || []).entries()) {
    if (!ledger) continue;
    const rows = rowsOf(i);
    // (Rev 1, S-4: the dry run is handed the close's coverage holds — a split coverage keeps from applying is not simulated.)
    const after = applyActions(ledger, rows, { date, phase: 'share_basis', ruledIds: ruledOf(i), holds }).ledger;
    const own = isPaperLedger(ledger) ? ledgerOwnDoubtIds(after, rows, { date }) : null;
    for (const [sym, items] of unresolvedShareBasis(after, rows, { date })) {
      for (const i of items) if (!own?.has(i.actionId)) addItem(out, sym, i);
    }
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
// ── F-5: THE FOUNDER'S `split` (review B2, B5, D5, D6) ─────────────────────────────────────────────────────────────

/** A founder's `split` ruling's action (holdRulings.js): a share-basis row carrying its ruling and its OWN id. */
export const isFounderSplit = (a) => a?.founderRuling?.kind === 'suspicion' && SHARE_BASIS_TYPES.has(a?.type) && typeof a?.actionId === 'string';
/** The rows of a feed map that are not a founder's split (the engine derives a row's id; a founder split keeps its own). */
function feedRowsOf(actionsBySymbol) {
  if (!actionsBySymbol) return {};
  return Object.fromEntries(Object.entries(actionsBySymbol).map(([sym, list]) => [sym, (list || []).filter((a) => !isFounderSplit(a))]));
}
/** The founder splits of a feed map due on this ledger at `date`: its holding holds the name, and its own id is unsettled. */
function founderSplitRowsOf(ledger, actionsBySymbol, { date, settled }) {
  const out = [];
  for (const list of Object.values(actionsBySymbol || {})) {
    for (const a of list || []) {
      if (!isFounderSplit(a)) continue;
      const sym = upper(a.ticker);
      if (!ledger?.holdings?.[sym] || typeof a.effectiveDate !== 'string' || a.effectiveDate > date || settled.has(a.actionId)) continue;
      out.push({ ...a, ticker: sym });
    }
  }
  return out;
}

/**
 * THE MOVE A RECORD STILL STANDS FOR (review D5): its recorded price ratio, less what the share-basis rows this ledger has
 * applied SINCE it was raised, dated inside its gap (after `since`, on or before `suspectedOn`), already account for —
 * each multiplies the price ratio by its share ratio (shares × r ⇒ price × 1/r). A row applied at the raise's own close is
 * already in the recorded ratio (the screen reads the state after that close's share-basis rows). Two rows that together
 * explain the move (T1a-2a Q-V) leave ×1: the count is already right, and a founder split on top would corrupt it. Pure.
 */
export function residualMoveOf(ledger, symbol, s) {
  const sym = upper(symbol);
  let move = Number(s?.ratio);
  // (T1a-2b-4, review AR4-C-5: a row the founder's correction re-ratioed explains the move by the ratio in force — and a
  // row the record already counted, re-ratioed SINCE it was raised, explains the difference: ×(ratio now / ratio then).)
  const corrected = ratioCorrectionsOf(ledger, sym);
  const correctedThen = ratioCorrectionsOf(ledger, sym, { postedOnOrBefore: s?.suspectedOn ?? null });
  for (const r of ledger?.corporateActionReceipts || []) {
    if (r?.applied !== true || !SHARE_BASIS_TYPES.has(r.type) || upper(r.ticker) !== sym) continue;
    if (typeof r.effectiveDate !== 'string' || r.effectiveDate > s.suspectedOn || (typeof s.since === 'string' && r.effectiveDate <= s.since)) continue;
    const now = corrected.get(r.actionId) ?? Number(r.ratio);
    if (!(typeof r.appliedOn === 'string' && r.appliedOn > s.suspectedOn)) {
      // Counted in the record already (applied by its raise); a correction since moves it by the difference only.
      const then = correctedThen.get(r.actionId) ?? Number(r.ratio);
      if (now !== then && then > 0) move *= now / then;
      continue;
    }
    move *= now;
  }
  return move;
}

/**
 * Why a founder's split is NOT applied on this ledger now, or null (review B2, B5, D5). It is applied only where the
 * record it was ruled for still stands — or where this close's screen retired that record because this very action
 * explained it in the dry run (T2A-E01's replacement path) — and only for the move no applied row explains: a row of
 * this close dated inside the gap, applied first in date order, may already have explained it (B2), and a ledger that
 * never carried the record has nothing to correct (B5).
 */
function founderSplitMoot(ledger, sym, action, date) {
  const h = ledger?.holdings?.[sym];
  const id = action.founderRuling?.recordId;
  const open = openBasisSuspicion(h);
  let record = open && suspicionIdOf(sym, open) === id ? open : null;
  if (!record) record = (h?.basisSuspicionHistory || []).find((e) => e?.id === id && e.closedOn === date && e.explainedBy?.actionId === action.actionId) ?? null;
  if (!record) return 'record_not_open';
  if (!ratioMatchesMove(action.ratio, residualMoveOf(ledger, sym, record))) return 'ratio_not_residual';
  return null;
}

export function applyLedgerActions(ledger, actionsBySymbol, { date, holds = null, deferRenames = null, renameTargetsTaken = null, renameIdsScreened = null, ruledIds = null, replacedRows = null, uncoveredSymbols = null }) {
  return applyActions(ledger, actionsBySymbol, { date, phase: 'all', holds, deferRenames, renameTargetsTaken, renameIdsScreened, ruledIds, replacedRows, uncoveredSymbols });
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
  // F-5: an action a founder's ruling supplied, held behind another doubt, keeps its ruling (its receipt names it).
  if (r.founderRuling) action.founderRuling = r.founderRuling;
  return action;
}

/** The holding without the held record `actionId` (and without `heldActions` once none is left). */
function withoutHeld(holding, actionId) {
  if (!holding?.heldActions) return holding;
  const { heldActions, ...rest } = holding;
  const left = heldActions.filter((r) => r.actionId !== actionId);
  return left.length > 0 ? { ...rest, heldActions: left } : rest;
}

/**
 * A-2: THE LEDGER'S OBSERVATIONS AFTER THIS CLOSE'S LISTING. Every row dated after `date` of a symbol the ledger holds — or
 * has SOLD (a sale receipt, no holding: the sold holding's screens meet what the vendor lists after the sale, A-2's "across
 * a sale") — the feed's, and the feed's rows a pending ruling replaces (still listed), is observed at a close whose data
 * covers the symbol (no coverage-gap item for it in `holds`, and not in `uncoveredSymbols`, the close's refusals for a sold
 * symbol): a new one is added, a known one takes this close's listing (`listedOn`, `payloads`),
 * and a known one dated after `date` that this covered close no longer lists is withdrawn (`withdrawnOn`, the first such
 * close). An observation whose date has come is left as its last listing before the date left it (A-1). Pure; returns the
 * prior array itself when nothing changed (re-running a close changes nothing).
 */
function observeListedAhead(ledger, actionsBySymbol, replacedRows, { date, holds, uncoveredSymbols = null }) {
  const prior = listedAheadOf(ledger);
  const covered = (sym) => !(holds?.get(sym) || []).some((i) => i?.type === CA_COVERAGE_GAP) && !uncoveredSymbols?.has(sym);
  const sold = new Set((ledger?.saleReceipts || []).map((r) => upper(r?.symbol)).filter((s) => s && !ledger?.holdings?.[s]));
  const observes = (sym) => Boolean(ledger?.holdings?.[sym]) || sold.has(sym);
  const listed = new Map();
  for (const src of [feedRowsOf(actionsBySymbol), replacedRows || {}]) {
    for (const list of Object.values(src)) {
      for (const a of list || []) {
        if (!a || a.founderRuling != null || typeof a.effectiveDate !== 'string' || !(a.effectiveDate > date) || !APPLICABLE_TYPES.has(a.type)) continue;
        const sym = upper(a.ticker);
        if (!observes(sym) || !covered(sym)) continue;
        const id = deriveActionId(a);
        const x = listed.get(id) ?? { a, sym, payloads: new Map() };
        const k = actionPayloadOf(a);
        if (!x.payloads.has(k)) x.payloads.set(k, rowOfPayload(a, null));
        listed.set(id, x);
      }
    }
  }
  if (listed.size === 0 && !prior.some((e) => e.effectiveDate > date && observes(upper(e.ticker)) && covered(upper(e.ticker)) && e.withdrawnOn == null)) return prior;
  const payloadsOf = (x) => [...x.payloads.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, p]) => p);
  let changed = false;
  const out = prior.map((e) => {
    const x = listed.get(e.actionId);
    if (x) {
      listed.delete(e.actionId);
      const payloads = payloadsOf(x);
      const listedOn = lastListedOf(e) === date ? e.listedOn : [...(e.listedOn || []), date];
      if (listedOn === e.listedOn && e.withdrawnOn == null && stableKey(e.payloads) === stableKey(payloads)) return e;
      changed = true;
      return { ...e, listedOn, payloads, withdrawnOn: null };
    }
    const sym = upper(e.ticker);
    if (e.effectiveDate > date && e.withdrawnOn == null && observes(sym) && covered(sym)) { changed = true; return { ...e, withdrawnOn: date }; }
    return e;
  });
  for (const [id, x] of listed) {
    changed = true;
    out.push({ actionId: id, type: x.a.type, ticker: x.sym, effectiveDate: x.a.effectiveDate, listedOn: [date], payloads: payloadsOf(x), firstSeenOn: date, withdrawnOn: null });
  }
  return changed ? out : prior;
}
const stableKey = (rows) => JSON.stringify((rows || []).map((r) => actionPayloadOf(r)));

function applyActions(ledger, actionsBySymbol, { date, phase, holds = null, deferRenames = null, renameTargetsTaken = null, renameIdsScreened = null, ruledIds = null, replacedRows = null, uncoveredSymbols = null }) {
  // 'share_basis' is the dry run shareBasisHolds makes: share-basis actions only, cash actions and renames withheld.
  const everything = phase === 'all';
  const next = cloneLedger(ledger);
  const kind = next.kind ?? null;
  const settled = settledIdsOf(next);
  // A-2: the rows listed ahead, observed (the dry runs observe them the same way, so they decide as the real run does).
  {
    const observed = observeListedAhead(next, actionsBySymbol, replacedRows, { date, holds, uncoveredSymbols });
    if (observed !== listedAheadOf(next)) { if (observed.length > 0) next.listedAhead = observed; else delete next.listedAhead; }
  }
  // (An observation is OPEN — bare — while its id has no receipt, record or held row on the ledger: those carry it.)
  const bareAnnouncementOf = (id) => {
    const e = announcementOf(next, id);
    if (!e || settledIdsOf(next).has(id) || (next.corporateActionReceipts || []).some((r) => r?.actionId === id)) return null;
    return Object.values(next.holdings || {}).some((h) => (h?.heldActions || []).some((r) => r.actionId === id)) ? null : e;
  };
  const bareAnnouncements = () => listedAheadOf(next).filter((e) => bareAnnouncementOf(e.actionId) !== null);
  // The ids listed at this close, whatever their date (a row listed now was last listed now).
  const listedNowIds = new Set();
  for (const src of [feedRowsOf(actionsBySymbol), replacedRows || {}]) for (const list of Object.values(src)) for (const a of list || []) if (a && a.founderRuling == null && typeof a.effectiveDate === 'string') listedNowIds.add(deriveActionId(a));
  // A held record whose id is settled since — applied, or declined by the founder's ruling — is owed nothing more: it
  // is dropped, so it never holds the holding for good (review C2).
  for (const [sym, h] of Object.entries(next.holdings)) {
    if ((h?.heldActions || []).some((r) => settled.has(r.actionId))) {
      const left = h.heldActions.filter((r) => !settled.has(r.actionId));
      const { heldActions: _gone, ...rest } = h;
      next.holdings = { ...next.holdings, [sym]: left.length > 0 ? { ...rest, heldActions: left } : rest };
    }
  }
  // F-5: a founder's `split` keeps its OWN id (review D6: the feed may already have settled the record's split id on
  // this idea) — it never passes the engine's id derivation, so it never meets the feed's row of that id.
  const { pending, unrecognized, notEntitled, noEntitlementData } = pendingActionsFor(
    next.holdings, feedRowsOf(actionsBySymbol), { onOrBefore: date, appliedIds: settled },
  );
  pending.push(...founderSplitRowsOf(next, actionsBySymbol, { date, settled }));
  const founderSkips = [];
  const founderRefusals = [];
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

  // ── AMBIGUITY IS STICKY (Amendment F rev 1, S-1, S-2; see the header) ─────────────────────────────────────────────
  const redates = [];
  // The feed's rows a pending ruling replaces on this ledger (close.js), due now on a held symbol, by id: observed only.
  const replacedRowsById = new Map();
  for (const [sym, list] of Object.entries(replacedRows || {})) {
    if (!next.holdings[upper(sym)]) continue;
    for (const a of list || []) {
      if (!a || typeof a.effectiveDate !== 'string' || a.effectiveDate > date) continue;
      const id = deriveActionId(a);
      replacedRowsById.set(id, [...(replacedRowsById.get(id) || []), a]);
    }
  }
  // The founder's own action for an id (resolve_hold) is the one thing that settles an ambiguous id.
  // A founder's own action (any ruling kind) is never a feed row: not a conflict, a revision or a re-date of anything.
  const isFounderAction = (a) => a?.founderRuling != null && ruledIds?.has(a.actionId) === true;
  // …but only a CONFLICT ruling (resolve_hold, `conflict`) settles an AMBIGUOUS id (S-2; AR2-A-1, AR2-C-2: a founder split
  // or a coverage-gap row under that id settled it with a payload its record never saw, and locked the record).
  const isRuled = (a) => isFounderAction(a) && a.founderRuling.kind === 'conflict';
  // A pending founder SPLIT (a `suspicion` ruling's action) that this call finds AMBIGUOUS — its id listed by the vendor with
  // a ratio that disagrees with it (Astra T2D-D02), or its payload possibly a re-date of another row (the final soak's
  // SOAK-R3-1) — is REFUSED: the close closes its ruling with the reason, and only `resolve_hold(conflict)` settles the id.
  // Left pending, it would come back every close under an ambiguous id.
  const refuseFounderSplit = (a, reason) => {
    if (!isFounderSplit(a) || !isFounderAction(a) || founderRefusals.some((x) => x.actionId === a.actionId)) return;
    const sym = upper(a.ticker);
    founderRefusals.push({ actionId: a.actionId, recordId: a.founderRuling.recordId ?? null, requestKey: a.founderRuling.requestKey ?? null, ticker: sym, reason });
    if (next.holdings[sym]?.heldActions?.some((r) => r.actionId === a.actionId)) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], a.actionId) };
  };
  /** Whether `d` lies inside the gap of the record a founder split covers (after `since`, on or before `suspectedOn`): a row
   *  dated there is an account of the SAME move — it explains the record first and the founder split goes moot (review B2,
   *  D5, NF-1) — never a re-date of the founder's split. */
  const inFounderGap = (a, d) => {
    if (!isFounderSplit(a) || typeof d !== 'string') return false;
    const s = openBasisSuspicion(next.holdings[upper(a.ticker)]);
    if (!s || suspicionIdOf(upper(a.ticker), s) !== a.founderRuling?.recordId) return false;
    return (typeof s.since !== 'string' || d > s.since) && d <= s.suspectedOn;
  };
  // The feed's due rows of this call (a founder's action is not a feed row: it is never part of a conflict or a revision).
  // (AR2-RF-1: a founder's action of ANOTHER kind — a coverage-gap `row`, a founder split under the derived id — is one
  // more account of its id: with a different payload from the feed's row of the same id it is a CONFLICT, as two vendor
  // rows would be; before, the feed's row was applied first and the founder's dropped silently. A `conflict` ruling's
  // action is the founder's answer to its record: it replaces the feed's rows of the id and is not one of them.)
  const feedDue = [...pending, ...notEntitled, ...noEntitlementData, ...unrecognized].filter((a) => a.founderRuling?.kind !== 'conflict');
  // Every ambiguous id's OPEN record — its first unsettled conflict or possible re-date receipt — kept live through the call.
  const ambiguity = new Map();
  for (const r of [...unsettledConflicts(next), ...unsettledRedates(next)]) if (!ambiguity.has(r.actionId)) ambiguity.set(r.actionId, r);
  // What this call learned about ambiguity, for the close's alerts: a record made, or a payload it had not seen.
  const ambiguities = [];
  /** Put `fresh` in the place of `old` among the receipts (never mutating the caller's), and keep it as the open record. */
  const replaceReceipt = (old, fresh) => {
    const i = next.corporateActionReceipts.indexOf(old);
    if (i >= 0) next.corporateActionReceipts[i] = fresh; else next.corporateActionReceipts.push(fresh);
    ambiguity.set(fresh.actionId, fresh);
    return fresh;
  };
  /** A new open record of an ambiguous id: kept, and named for the alerts. */
  const recordAmbiguity = (receipt, how) => {
    next.corporateActionReceipts.push(receipt);
    ambiguity.set(receipt.actionId, receipt);
    ambiguities.push({ actionId: receipt.actionId, ticker: upper(receipt.ticker), type: receipt.type, how, payloads: recordedPayloadsOf(receipt).length });
    return receipt;
  };
  /**
   * An open record takes every payload of `rows` it has not seen (Astra T2D-C01: a payload first seen at a later close was
   * lost, so its re-date was paid). Nothing is settled by it: the id stays ambiguous until the founder rules.
   */
  const observe = (record, rows) => {
    const keys = new Set(recordedPayloadsOf(record).map(actionPayloadOf));
    const fresh = [];
    for (const row of rows) {
      const k = actionPayloadOf(row);
      if (keys.has(k)) continue;
      keys.add(k);
      fresh.push(rowOfPayload(row, date));
    }
    if (fresh.length === 0) return record;
    const rowsNow = [...recordedPayloadsOf(record), ...fresh];
    const updated = { ...record, rows: rowsNow, kinds: kindsOf(record, rowsNow, 'revision'), lastRevisedOn: date };
    ambiguities.push({ actionId: record.actionId, ticker: upper(record.ticker), type: record.type, how: 'payload_added', payloads: rowsNow.length });
    return replaceReceipt(record, updated);
  };

  // S-1 ①: ONE ID LISTED TWO WAYS in this call — the daily layer and a backfill included. Neither row is applied; the
  // ledger records the conflict (or, for an id already ambiguous, the payloads it has not seen) and carries the mark.
  const conflicting = conflictingActionIds(feedDue);
  // The rows of one id share a type and an effective date, so they share an entitlement: one list holds them all.
  const notEntitledIds = new Set(notEntitled.map((row) => deriveActionId(row)));
  for (const [id, group] of conflicting) {
    const first = group[0];
    // The holding's own key (upper case), whatever case a feed row carries — the id is normalised the same way.
    unresolved.add(upper(first.ticker));
    const open = ambiguity.get(id);
    // (AR2-IR-3: a held record of this id — the feed's, or a founder's coverage row — is one more payload seen: kept, so
    // the founder can still choose it. AR2-IR-5: each payload once.)
    const heldOfId = (next.holdings[upper(first.ticker)]?.heldActions || []).filter((r) => r.actionId === id && r.founderRuling?.kind !== 'conflict');
    // (A-1, A-3: the announcement the id entered its date with is a payload seen too — kept, so the founder can choose it.)
    const announced = bareAnnouncementOf(id);
    const announcedRows = announced ? (announced.payloads || []).map((p) => rowOfPayload(p, lastListedOf(announced))) : [];
    const firstRows = [];
    for (const row of [...heldOfId.map((r) => rowOfPayload(r, r.heldOn ?? null)), ...announcedRows, ...group.map((row) => rowOfPayload(row, null))]) {
      if (!firstRows.some((x) => actionPayloadOf(x) === actionPayloadOf(row))) firstRows.push(row);
    }
    const receipt = open ? observe(open, [...heldOfId, ...group]) : recordAmbiguity({
      actionId: id, type: first.type, ticker: first.ticker, effectiveDate: first.effectiveDate, applied: false, reason: CONFLICTING_ACTION,
      entitled: !notEntitledIds.has(id),
      rows: firstRows, seenOn: date,
      kinds: kindsOf(null, firstRows, 'conflict'),
    }, 'conflict');
    conflicts.push(receipt);
    // (Astra T2D-D02, final fix: a pending founder SPLIT among the id's accounts — the vendor lists its id with a ratio
    // that disagrees with it — is refused here, at the close the disagreement first shows, covered or not; the conflict,
    // which carries the founder's ratio as one recorded payload, takes `resolve_hold(conflict)`.)
    for (const a of group) refuseFounderSplit(a, 'vendor_rows_disagree');
  }
  // S-1 ②: AN ID LISTED NOW WITH ONE PAYLOAD. An ambiguous one's record takes the payload if it is new (a revision of an
  // ambiguous id). One this ledger HOLDS a record of with a different payload — an action held behind a doubt, or one the
  // applier refused — is a revision: the id becomes ambiguous, and its record no longer replays (before rev 1 the record
  // was refreshed to whatever the feed listed now, so a revision was paid at full quality once the doubt cleared).
  // (AR2-C-1, AR2-A-5: while a ruling is pending the close hands this ledger the feed's rows of its id apart —
  // `replacedRows` — so the ruling's action stands for them. They are still OBSERVED: a payload among them that the
  // record has not seen is kept, and once the ruling applies it is one the ruling did not see.)
  for (const [id, rows] of replacedRowsById) { const open = ambiguity.get(id); if (open) observe(open, rows); }
  const singles = new Map();
  for (const a of feedDue) if (!conflicting.has(a.actionId) && !singles.has(a.actionId)) singles.set(a.actionId, a);
  for (const [id, a] of singles) {
    const sym = upper(a.ticker);
    const open = ambiguity.get(id);
    if (open) { observe(open, [a]); continue; }
    // A held action's payload, or (AR2-A-3) a waiting rename's target — a revision of either is ambiguity.
    const deferred = a.type === 'ticker_change' && next.holdings[sym]?.deferredRename?.actionId === id ? next.holdings[sym].deferredRename : null;
    // (A held action the founder supplied by a ruling of another kind — a coverage-gap row — is one more account of the id, as
    // a feed row is: a different payload listed against it is a revision. Battery AR2-M34: a later feed payload silently
    // replaced it. A `conflict` ruling's held action is the founder's answer, re-supplied until applied.)
    const record = (next.holdings[sym]?.heldActions || []).find((r) => r.actionId === id && r.founderRuling?.kind !== 'conflict')
      ?? (deferred ? { renamedTo: deferred.to, source: null, heldOn: deferred.deferredOn ?? null } : null);
    // A-1, A-3 (the founder's ruling, 21 Nov 2026; Astra T2E-C01): AT THE FIRST CLOSE ON OR AFTER ITS DATE, a row announced
    // ahead is held to the announcement it entered the date with. Another payload, an announcement still listed two ways,
    // or a withdrawn one listed again is a REVISION: ambiguous, for the founder. An unchanged one is on-time data.
    if (record === null) {
      const announced = bareAnnouncementOf(id);
      if (announced && differsFromAnnouncement(announced, [a])) {
        unresolved.add(sym);
        const rows = [...new Map([...(announced.payloads || []).map((p) => rowOfPayload(p, lastListedOf(announced))), rowOfPayload(a, date)].map((x) => [actionPayloadOf(x), x])).values()];
        recordAmbiguity({
          actionId: id, type: a.type, ticker: a.ticker, effectiveDate: a.effectiveDate, applied: false, reason: CONFLICTING_ACTION,
          entitled: !notEntitledIds.has(id), rows, seenOn: date, kinds: kindsOf(null, rows, (announced.payloads || []).length > 1 ? 'conflict' : 'revision'),
          revisedFrom: { announcedOn: lastListedOf(announced), ...(announced.withdrawnOn != null ? { withdrawnOn: announced.withdrawnOn } : {}) },
        }, 'revision');
        continue;
      }
    }
    if (record === null || (samePayload(record, a) && upper(record.renamedTo) === upper(a.renamedTo))) continue;
    unresolved.add(sym);
    const rows = [rowOfPayload(record, record.heldOn ?? null), rowOfPayload(a, date)];
    recordAmbiguity({
      actionId: id, type: a.type, ticker: a.ticker, effectiveDate: a.effectiveDate, applied: false, reason: CONFLICTING_ACTION,
      entitled: !notEntitledIds.has(id), rows, seenOn: date, kinds: kindsOf(null, rows, 'revision'), revisedFrom: { heldOn: record.heldOn ?? null, ...(record.refused ? { refused: record.refused } : {}) },
    }, 'revision');
  }
  // S-2: A RULED ID that shows, since the ruling, a payload the ruling did not see — a new ambiguity (`checkRulingRevisions`,
  // run at the end of the call, once a ruling this close applies is settled: AR2-C-1).
  const checkRulingRevisions = () => {
    for (const [id, covered] of founderSettledIds(next)) {
      // What the id has shown: the feed's rows now (the replaced ones included), and every payload its records kept —
      // one observed while the ruling waited counts, though the feed may have dropped it since.
      const listed = [...feedRowsListedFor(next, actionsBySymbol, id, date), ...(replacedRowsById.get(id) || [])];
      const recordRows = (next.corporateActionReceipts || []).filter((r) => r?.actionId === id && (r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE)).flatMap(recordedPayloadsOf);
      const unseen = [...listed, ...recordRows].filter((row) => !covered.keys.has(actionPayloadOf(row)));
      if (unseen.length === 0) continue;
      const prior = openRulingRevisions(next).find((r) => r.actionId === id) ?? null;
      const known = new Set((prior?.rows || []).map(actionPayloadOf));
      const fresh = [];
      for (const row of unseen) if (!known.has(actionPayloadOf(row))) { known.add(actionPayloadOf(row)); fresh.push(rowOfPayload(row, date)); }
      if (fresh.length === 0) continue;
      const meta = listed[0] ?? (next.corporateActionReceipts || []).find((r) => r?.actionId === id && (r.founderRuling || r.applied === true));
      if (SHARE_BASIS_TYPES.has(meta.type) || meta.type === 'ticker_change') unresolved.add(upper(meta.ticker));
      if (prior) {
        const k = next.corporateActionReceipts.indexOf(prior);
        next.corporateActionReceipts[k] = { ...prior, rows: [...prior.rows, ...fresh], lastRevisedOn: date };
        ambiguities.push({ actionId: id, ticker: upper(meta.ticker), type: meta.type, how: 'revised_after_ruling', payloads: prior.rows.length + fresh.length });
      } else {
        next.corporateActionReceipts.push({
          actionId: id, type: meta.type, ticker: meta.ticker, effectiveDate: meta.effectiveDate, applied: false, reason: REVISED_AFTER_RULING,
          rows: fresh, seenOn: date, ruling: covered.ruling, ruled: covered.ruled, closedBy: null,
          ...(covered.settledBy === 'feed' ? { settledBy: 'feed' } : {}),
        });
        ambiguities.push({ actionId: id, ticker: upper(meta.ticker), type: meta.type, how: 'revised_after_ruling', payloads: fresh.length });
      }
    }
  };
  // (Astra T2D-D01, final fix: run ONCE HERE, before any new date is classified, for the ids the founder had settled
  // before this call — so a payload of one listed now is recorded before `redateMatchOf` reads the pool. Run only at the
  // end, the vendor's correction of a founder-settled id and its re-date listed in ONE close met an empty pool: the moved
  // row was matched against nothing and paid. The end-of-call run stays, for a ruling this call settles.)
  checkRulingRevisions();

  // THE SHARE-BASIS ACTIONS THIS LEDGER CANNOT SETTLE, kept as the call goes (fix round 2): its unsettled conflicts, the
  // rows it has no entitlement data for, the ones it holds and what they wait on — and, below, each one the applier
  // refuses or that waits. A cash action of the symbol dated on or after one of them waits, as one dated after one of the
  // idea's `holds`. A share-basis action waits on one that PRECEDES it in this call's own order of application
  // (`byDatePhaseId`: date, then phase, then id) — on an earlier date or on the same one — and never on itself or on one
  // after it (fix round 3, Astra T2A-D02: shares are rounded after each action, so two of one date applied out of order
  // leave a different count).
  const blocked = new Map();
  // (T1a-2b-4 fix round, L-5: `how` 'same_date_share_basis' — a share-basis id of another type or ratio on the same date.)
  const recordRedate = (sym, action, redateOf, how = 'possible_redate', rows = null) => {
    const receipt = {
      actionId: action.actionId, type: action.type, ticker: action.ticker, effectiveDate: action.effectiveDate,
      ratio: action.ratio ?? null, amount: action.amount ?? null, cashPerShare: action.cashPerShare ?? null, source: action.source ?? null,
      applied: false, reason: POSSIBLE_REDATE, redateOf, seenOn: date,
      // (Rev 1: the record keeps every payload it sees, as a conflict's does — an announcement's, every one it listed: A-2.)
      rows: rows ?? [rowOfPayload(action, null)], kinds: [how], ...(rows ? { announced: true } : {}),
    };
    if (!next.corporateActionReceipts.some((r) => r.actionId === action.actionId && r.reason === POSSIBLE_REDATE)) {
      next.corporateActionReceipts.push(receipt);
      ambiguity.set(receipt.actionId, receipt);
      ambiguities.push({ actionId: receipt.actionId, ticker: sym, type: receipt.type, how, redateOf, payloads: 1 });
    }
    redates.push(receipt);
    if (SHARE_BASIS_TYPES.has(action.type)) { unresolved.add(sym); addItem(blocked, sym, itemOf(action, kind)); }
  };
  // F-7: A POSSIBLE RE-DATE — the row of an action this ledger applied, holds or DECLINED as not entitled (the agreed Q10),
  // or ANY payload any of its conflict or re-date records has seen (rev 1: Astra T2D-C01, C03 — a moved row matching an
  // open conflict's payload no longer settles it; RF-A2 is withdrawn), that `action` may be under a moved date. Returns
  // the first match's id and every UNSETTLED held row it matches (rev 1, S-1 ③: the row it may repeat becomes ambiguous
  // too), or null. `unsettledOnly`: match only a row that is not settled (the not-entitled path below).
  const redateMatchOf = (action, sym, { unsettledOnly = false, pastOnly = false } = {}) => {
    // The founder applied it (resolve_hold): not a re-date — except a founder SPLIT, which answered a price move, not the
    // vendor's rows: its payload is matched as a feed row's is (the final soak's SOAK-R3-1, below).
    // (…and a founder's COVERAGE-GAP row, which is a backfill row the founder picked: matched as the feed row it is — the
    // coordinator's probe after the refuter, AR3-RF-5: the vendor's same $1 a session earlier and the founder's row both paid.)
    const coverageRow = isFounderAction(action) && action.founderRuling.kind === 'coverage_gap';
    if (isFounderAction(action) && !isFounderSplit(action) && !coverageRow) return null;
    const settledNow = settledIdsOf(next);
    // (AR2-IR-6: a holding renamed from an older ticker owns that ticker's records too — a row the vendor re-lists under
    // the new ticker matches them; before, a dividend ambiguous under the old ticker was paid when re-listed under the new.)
    const aliases = new Set([sym]);
    for (let grew = true; grew;) {
      grew = false;
      for (const x of next.corporateActionReceipts || []) {
        if (x?.type === 'ticker_change' && x.applied === true && aliases.has(upper(x.renamedTo)) && !aliases.has(upper(x.ticker))) { aliases.add(upper(x.ticker)); grew = true; }
      }
    }
    const sameKind = (r) => r?.type === action.type && aliases.has(upper(r.ticker));
    const pool = [];
    for (const r of next.corporateActionReceipts || []) {
      if (!sameKind(r)) continue;
      if (r.applied === true || r.reason === NOT_ENTITLED) pool.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, ratio: r.ratio ?? null, amount: r.amount ?? null, cashPerShare: r.cashPerShare ?? null, open: false });
      // (…and every payload a ruled id showed since its ruling — a `revised_after_ruling` record's rows: the S-6 soak found a
      // ruled split's later ratio, re-dated, applied as a fresh split.)
      if (r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE || r.reason === REVISED_AFTER_RULING) {
        for (const p of recordedPayloadsOf(r)) pool.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, ratio: p?.ratio ?? null, amount: p?.amount ?? null, cashPerShare: p?.cashPerShare ?? null, open: !settledNow.has(r.actionId) });
      }
    }
    const heldRows = (next.holdings[sym]?.heldActions || []).filter((r) => sameKind({ ...r, ticker: sym }) && !r.refused && r.founderRuling == null && !settledNow.has(r.actionId));
    for (const r of heldRows) pool.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, ratio: r.ratio ?? null, amount: r.amount ?? null, cashPerShare: r.cashPerShare ?? null, open: true, held: r });
    // A-2 (the founder's ruling, 21 Nov 2026; Astra T2E-C01, C02): EVERY OPEN OBSERVATION of a row listed before its date —
    // by each payload it was last announced with — unless the switch between the two ids was made before both dates (A-1).
    const own = announcementOf(next, action.actionId);
    const ownLast = listedNowIds.has(action.actionId) ? date : lastListedOf(own);
    const announcedPool = bareAnnouncements().filter((e) => e.actionId !== action.actionId && aliases.has(upper(e.ticker))
      && !switchedBeforeDates(own, ownLast, action.effectiveDate, e, listedNowIds.has(e.actionId) ? date : lastListedOf(e), e.effectiveDate));
    for (const e of announcedPool) {
      if (e.type !== action.type) continue;
      for (const p of e.payloads || []) pool.push({ actionId: e.actionId, effectiveDate: e.effectiveDate, ratio: p.ratio ?? null, amount: p.amount ?? null, cashPerShare: p.cashPerShare ?? null, open: true, announced: e });
    }
    // (A founder split meets only what is UNSETTLED — an open record's payload, a held row: a settled action explained a
    // move of its own, and the founder answered a later one, not a re-date of it — fix-round row T2D-11.)
    const openEnough = (r) => !(unsettledOnly || isFounderSplit(action)) || r.open;
    // (A-1: no partner — a receipt, a record, a held row or an observation — that the switch was made away from, or onto,
    // before both dates: an id announced ahead keeps its listing dates on the ledger after it settles, so the switch is still
    // shown. A partner listed at or after its own date — every settled one but a withdrawn announcement — has no last listing
    // before it: it can be shown to have superseded, never to have been superseded.)
    const switched = (r) => switchedBeforeDates(own, ownLast, action.effectiveDate, announcementOf(next, r.actionId),
      listedNowIds.has(r.actionId) ? date : (r.announced ? lastListedOf(r.announced) : null), r.effectiveDate);
    const matches = pool.filter((r) => r.actionId !== action.actionId && samePayload(r, action) && withinSessions(r.effectiveDate, action.effectiveDate, REDATE_WINDOW_SESSIONS)
      && !inFounderGap(action, r.effectiveDate) && openEnough(r) && !switched(r));
    // T1a-2b-4 fix round (L-5, Astra T2E-06; Q-9 answered with a hold): TWO SHARE-BASIS IDS OF ONE SYMBOL AND ONE EFFECTIVE
    // DATE are one ambiguity — whatever their types or ratios (a 10-for-1 and a 1-for-10 of one date, under `split_…` and
    // `reverse_split_…`, may be one action and its direction correction). Applied, held, declined or recorded, the other id
    // matches: this one is recorded, and nothing uses the count until the founder's conflict ruling.
    const sameDate = [];
    if (SHARE_BASIS_TYPES.has(action.type)) {
      for (const r of next.corporateActionReceipts || []) {
        if (!SHARE_BASIS_TYPES.has(r?.type) || !aliases.has(upper(r.ticker)) || r.actionId === action.actionId || r.effectiveDate !== action.effectiveDate) continue;
        if (r.applied === true || r.reason === NOT_ENTITLED) sameDate.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, open: false });
        if (r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE || r.reason === REVISED_AFTER_RULING) sameDate.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, open: !settledNow.has(r.actionId) });
      }
      for (const r of next.holdings[sym]?.heldActions || []) {
        if (!SHARE_BASIS_TYPES.has(r.type) || r.refused || r.founderRuling != null || settledNow.has(r.actionId) || r.actionId === action.actionId || r.effectiveDate !== action.effectiveDate) continue;
        sameDate.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, open: true, held: r });
      }
      // (A-2: an open observation of another share-basis id of the same date, as L-5 pairs any other.)
      for (const e of announcedPool) if (SHARE_BASIS_TYPES.has(e.type) && e.effectiveDate === action.effectiveDate) sameDate.push({ actionId: e.actionId, effectiveDate: e.effectiveDate, open: true, announced: e });
    }
    // (`pastOnly`: an observation still ahead of its date meets only what is dated on or before this close — two rows whose
    // dates are both still ahead are an announcement and wait for the first of them, A-1.)
    const past = (r) => !pastOnly || (typeof r.effectiveDate === 'string' && r.effectiveDate <= date);
    const dated = sameDate.filter((r) => !inFounderGap(action, r.effectiveDate) && openEnough(r) && past(r) && !switched(r));
    const matched = matches.filter(past);
    if (matched.length === 0 && dated.length === 0) return null;
    const all = [...matched, ...dated];
    return {
      redateOf: all[0].actionId, how: matched.length > 0 ? 'possible_redate' : 'same_date_share_basis',
      heldMatches: [...new Map(all.filter((m) => m.held).map((m) => [m.actionId, m.held])).values()],
      announcedMatches: [...new Map(all.filter((m) => m.announced).map((m) => [m.actionId, m.announced])).values()],
    };
  };
  /** Record `action` as a possible re-date, and make every unsettled held row — and every open observation (A-2) — it may
   *  repeat ambiguous too (S-1 ③). `rows`: an observation's announced payloads, all of them. */
  const recordRedatePair = (sym, action, match, rows = null) => {
    recordRedate(sym, action, match.redateOf, match.how, rows);
    for (const r of match.heldMatches) {
      next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], r.actionId) };
      recordRedate(sym, actionOfRecord(sym, r), action.actionId, match.how);
    }
    for (const e of match.announcedMatches || []) {
      if (e.actionId === action.actionId) continue;
      recordRedate(sym, actionOfAnnouncement(e), action.actionId, match.how, (e.payloads || []).map((p) => rowOfPayload(p, lastListedOf(e))));
    }
  };
  // A-2 (the founder's ruling, 21 Nov 2026; Astra T2E-C02): AN OBSERVATION ALREADY PAIRED. A row announced for a later date
  // whose payload is one this ledger has applied, declined, holds or recorded — or has seen announced under another date
  // that is now past — within the window: one of the two dates has come, so the two are one ambiguity (the second bullet of
  // A-1). The observation takes its own record at this close, so the founder can answer it before its date: a paid $1 of
  // Tuesday and the same $1 announced for Friday hold Tuesday's late_basis approval (L-2 ②) until the founder rules
  // Friday's. Two observations whose dates are both still ahead are one announcement, and wait for the first date.
  for (const e of bareAnnouncements()) {
    const sym = upper(e.ticker);
    if (!(e.effectiveDate > date) || !next.holdings[sym] || !['cash_dividend', ...SHARE_BASIS_TYPES].includes(e.type) || bareAnnouncementOf(e.actionId) === null) continue;
    const base = actionOfAnnouncement(e);
    for (const p of e.payloads || []) {
      const m = redateMatchOf({ ...base, ratio: p.ratio ?? undefined, amount: p.amount ?? undefined }, sym, { pastOnly: true });
      if (m === null) continue;
      recordRedatePair(sym, base, m, (e.payloads || []).map((x) => rowOfPayload(x, lastListedOf(e))));
      break;
    }
  }

  // Every other id is processed at its FIRST row in this call; a repeated row of it is skipped.
  const seen = new Set(conflicting.keys());
  const firstOf = (row) => {
    const id = row.actionId ?? deriveActionId(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  };

  for (const decl of notEntitled) {
    if (!firstOf(decl)) continue;
    // An ambiguous id is not declined by the feed either (rev 1, S-2): only the founder's ruling settles it.
    if (ambiguity.has(decl.actionId) && !isRuled(decl)) continue;
    // A not-entitled row that may repeat a row this ledger has NOT settled — one it holds, or an ambiguous one's payload —
    // is a possible re-date (rev 1, S-1 ③): the vendor may have moved that action past the purchase date, so the row
    // it repeats may be owed nothing. Both wait for the founder. (One matching only a settled row is declined as before.)
    const match = isFounderAction(decl) ? null : redateMatchOf(decl, upper(decl.ticker), { unsettledOnly: true });
    if (match) { recordRedatePair(upper(decl.ticker), decl, match); continue; }
    // Bought on or after the effective date: the price paid already reflects the action. Declined, durably — with the
    // payload it declined (Astra T2D-01, the agreed Q10): a row the vendor re-dates past the purchase date matches it.
    next.declinedActionIds.push(decl.actionId);
    const receipt = {
      actionId: decl.actionId, type: decl.type, ticker: decl.ticker, effectiveDate: decl.effectiveDate, applied: false, reason: NOT_ENTITLED, seenOn: date,
      ratio: decl.ratio ?? null, amount: decl.amount ?? null, cashPerShare: decl.cashPerShare ?? null,
      ...(decl.founderRuling ? { founderRuling: decl.founderRuling } : {}),
    };
    next.corporateActionReceipts.push(receipt);
    declined.push(receipt);
  }
  // The holding's own key (upper case), whatever case a row carries (refuter 2): a lower-case row must hold the mark.
  for (const bad of [...noEntitlementData, ...unrecognized]) unresolved.add(upper(bad.ticker));

  // An ambiguous id's held record is no longer a payload to pay later — its record governs it, and only the founder's
  // ruling settles it (a held FOUNDER action stays: the ruling re-supplies it until it is applied).
  for (const [sym, h] of Object.entries(next.holdings)) {
    for (const r of h?.heldActions || []) {
      if (r.founderRuling?.kind !== 'conflict' && ambiguity.has(r.actionId)) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], r.actionId) };
    }
  }

  for (const [sym, items] of unresolvedShareBasis(next, actionsBySymbol, { date })) {
    for (const i of items) {
      const listedNow = pending.some((a) => a.actionId === i.actionId);
      if (!listedNow || ambiguity.has(i.actionId) || heldActionRecords(next).some((r) => r.actionId === i.actionId)) addItem(blocked, sym, i);
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
      // A coverage gap (Amendment F-1): the data presented to THIS close does not vouch for the symbol, so EVERY
      // count-dependent action of it waits — cash or share basis, whatever its date (Astra T2D-07: a dividend dated on the
      // last covered session but first listed at an uncovered close was paid; F-1 and exit criterion 6 bind the session
      // doing the work). It is held on the holding and replayed once at the close whose data covers the symbol again.
      if (i.type === CA_COVERAGE_GAP) return true;
      if (typeof i.effectiveDate !== 'string') return true;
      if (i.type === SUSPECTED_SPLIT) return suspicionHolds(i);
      return shareBasis ? byDatePhaseId(i, action) < 0 : i.effectiveDate <= action.effectiveDate;
    };
    const nowSettled = settledIdsOf(next);
    const out = new Map();
    // (AR2-B-3: a SHARE-BASIS action of an id ANOTHER ledger of the idea has in doubt waits behind that doubt too — the
    // class rule: the symbol's basis is in doubt idea-wide. Before, the item of its own id was skipped on every ledger, so a
    // ledger without the record applied a split the idea disputed, and a same-stock pair came apart. A cash action of
    // such an id is still its own ledger's to apply: S-5, Astra T2D-C05.)
    const sameIdElsewhere = (i) => i.actionId === action.actionId && shareBasis && i.ledger !== kind && i.ambiguous === true && !isRuled(action);
    const plain = ({ ambiguous: _a, ...i }) => i;
    for (const i of holds?.get(sym) || []) if (((i.actionId !== action.actionId && before(i)) || sameIdElsewhere(i)) && !(i.ledger === kind && nowSettled.has(i.actionId))) addItem(out, sym, plain(i));
    // (A suspicion of this ledger retired earlier in this call — explained, or the founder's split for it applied —
    // holds nothing after it: the record no longer stands. One still standing holds, as always.)
    const retiredHere = (i) => i.type === SUSPECTED_SPLIT && i.ledger === kind && (() => {
      const s = openBasisSuspicion(next.holdings[sym]);
      return !s || suspicionIdOf(sym, s) !== i.actionId;
    })();
    // (SOAK-R3-2, the final soak: nor does a founder split found MOOT earlier in this call — its record retired by a row
    // applied first. Before, its item still held what is dated after it for this close; re-running the close applied it.)
    const mootHere = (i) => founderSkips.some((s) => s.actionId === i.actionId);
    for (const i of blocked.get(sym) || []) if (i.actionId !== action.actionId && before(i) && !nowSettled.has(i.actionId) && !retiredHere(i) && !mootHere(i)) addItem(out, sym, plain(i));
    // Q-14 (the founder's ruling, 20 Nov 2026): a RULED share-basis action beside another share-basis id of its date that
    // the founder has not ruled at this close — recorded, held (here or on another ledger of the idea) or listed in this
    // call — waits, whatever order the two sort in: the pair is one ambiguity until the founder rules it. (Before, it waited
    // only on one that sorted first, and not at all on one listed in the same call — the fourth refuter's EQ-1.) The ruling
    // stays pending while the record stands (holdRulings.js), so the pair applies at the close the other id is ruled.
    if (shareBasis && isRuled(action)) {
      const ruledHere = new Set(candidates.filter((a) => isFounderAction(a)).map((a) => a.actionId));
      const others = [...(blocked.get(sym) || []), ...(holds?.get(sym) || []), ...candidates.filter((a) => upper(a.ticker) === sym)];
      for (const o of sameDateUnruled(action, others, ruledHere)) if (!nowSettled.has(o.actionId) && !mootHere(o)) addItem(out, sym, plain(itemOf(o, o.ledger ?? kind)));
    }
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
      ...(action.founderRuling ? { founderRuling: action.founderRuling } : {}),
    };
    const list = [...(h.heldActions || []).filter((r) => r.actionId !== action.actionId), record].sort(byDatePhaseId);
    next.holdings = { ...next.holdings, [sym]: { ...h, heldActions: list } };
    held.push(record);
  };

  for (const a of noEntitlementData) {
    if (SHARE_BASIS_TYPES.has(a.type) && !conflicting.has(a.actionId) && !(ambiguity.has(a.actionId) && !isRuled(a))) hold(upper(a.ticker), a, [], 'no_entitlement_data');
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
  // S-1 ③, BEFORE ANYTHING IS APPLIED: two UNSETTLED rows of this call — listed, or held on the holding — that may be one
  // action under two dates (same symbol, type and payload, within the window) are BOTH ambiguous. Matched only in the
  // loop below, the earlier-dated one was applied first (a held row replaying once its doubt cleared) and only the later
  // one waited: which of the two was paid depended on the order the vendor's rows happened to reach the close.
  {
    // (A pending founder split is one of these rows — SOAK-R3-1 — while its record stands: refused if it pairs.)
    const open = candidates.filter((a) => !isRuled(a) && (a.founderRuling == null || (isFounderSplit(a) && isFounderAction(a) && founderSplitMoot(next, upper(a.ticker), a, date) === null)
      || (isFounderAction(a) && a.founderRuling.kind === 'coverage_gap'))
      && !ambiguity.has(a.actionId) && !conflicting.has(a.actionId)
      && APPLICABLE_TYPES.has(a.type) && a.type !== 'ticker_change' && !(a.type === 'delisting' && delistingCashOf(a) === null));
    const paired = new Set();
    for (const a of open) {
      for (const b of open) {
        if (a === b || a.actionId === b.actionId || upper(a.ticker) !== upper(b.ticker)) continue;
        // (T1a-2b-4 fix round, L-5: two share-basis rows of one date under two ids pair whatever their types or ratios.)
        const sameDateShare = SHARE_BASIS_TYPES.has(a.type) && SHARE_BASIS_TYPES.has(b.type) && a.effectiveDate === b.effectiveDate;
        if (!sameDateShare && (a.type !== b.type || !samePayload(a, b))) continue;
        if (!withinSessions(a.effectiveDate, b.effectiveDate, REDATE_WINDOW_SESSIONS) || paired.has(a.actionId)) continue;
        if (inFounderGap(a, b.effectiveDate) || inFounderGap(b, a.effectiveDate)) continue;
        paired.add(a.actionId);
        const sym = upper(a.ticker);
        if (next.holdings[sym]?.heldActions?.some((r) => r.actionId === a.actionId)) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], a.actionId) };
        recordRedate(sym, a, b.actionId, sameDateShare && !(a.type === b.type && samePayload(a, b)) ? 'same_date_share_basis' : 'possible_redate');
        refuseFounderSplit(a, 'possible_redate');
      }
    }
    // (SOAK-R3-1: the vendor's own rows of a pending founder split's id, which AGREE with it and so are replaced by it
    // (close.js), are still the vendor's account: one that may be a re-date of another unsettled row of this call — the same
    // payload under another date — makes both ambiguous, and the founder's split is refused. Replaced, they were unseen.)
    for (const f of open.filter((a) => isFounderSplit(a))) {
      for (const v of replacedRowsById.get(f.actionId) || []) {
        for (const b of open) {
          if (b === f || b.actionId === f.actionId || b.type !== v.type || upper(b.ticker) !== upper(v.ticker) || !samePayload(b, v)) continue;
          if (!withinSessions(v.effectiveDate, b.effectiveDate, REDATE_WINDOW_SESSIONS)) continue;
          const sym = upper(b.ticker);
          if (!paired.has(b.actionId)) {
            paired.add(b.actionId);
            if (next.holdings[sym]?.heldActions?.some((r) => r.actionId === b.actionId)) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], b.actionId) };
            recordRedate(sym, b, f.actionId);
          }
          if (!paired.has(f.actionId)) { paired.add(f.actionId); recordRedate(sym, f, b.actionId); }
          refuseFounderSplit(f, 'possible_redate');
        }
      }
    }
  }

  for (const action of candidates) {
    if (!firstOf(action)) continue;
    // THE GATE (Amendment F rev 1, S-2): an ambiguous id is applied, declined, replayed or retired by nothing but the
    // founder's ruling for it — not by a later single row, a row under a moved date, a replay after coverage returns or a
    // backfill row. It moves no cash and no shares; a conflict, or a share-basis action, carries the mark.
    if (ambiguity.has(action.actionId) && !isRuled(action)) {
      // (The refuter's AR3-RF-2: a pending founder split whose id this call found ambiguous by ANY path — here a held vendor
      // row of its id revising it (S-1 ②) — is refused, not left pending under the gate: pending, it locked the suspicion
      // (`price_move` 409) and, once a conflict ruling applied that id, was marked applied with its own split never applied.)
      refuseFounderSplit(action, 'id_ambiguous');
      if (ambiguity.get(action.actionId).reason === CONFLICTING_ACTION || SHARE_BASIS_TYPES.has(action.type)) unresolved.add(upper(action.ticker));
      continue;
    }
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
    // F-5: a founder's split applies only where its record stands, and only for the move left (founderSplitMoot). Not
    // applied, it settles nothing — the close marks the ruling moot (holdRulings.js markRulingsApplied) — and a held
    // record of it goes.
    if (isFounderSplit(action)) {
      const why = founderSplitMoot(next, sym, action, date);
      if (why !== null) {
        founderSkips.push({ actionId: action.actionId, recordId: action.founderRuling.recordId ?? null, requestKey: action.founderRuling.requestKey ?? null, ticker: sym, reason: why });
        if (next.holdings[sym]?.heldActions?.some((r) => r.actionId === action.actionId)) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], action.actionId) };
        continue;
      }
    }
    // F-7: one economic action under a moved date is applied once — a row that may be a re-date of one this ledger has
    // applied, holds, or has seen in an ambiguity record is recorded, not applied; and (rev 1, S-1 ③) an unsettled held
    // row it may repeat becomes ambiguous with it. (A cashless delisting, above, applies nothing anyway.)
    {
      // (SOAK-R3-1: for a pending founder split, also the vendor's OWN rows of its id that it replaced — they agreed with it —
      // checked as the feed rows they are, against everything this ledger has seen: a declined, applied or recorded payload
      // under another date makes the id a possible re-date, as it would without the ruling.)
      const vendorMatch = () => {
        for (const v of (isFounderSplit(action) && isFounderAction(action) ? replacedRowsById.get(action.actionId) : null) || []) {
          const m = redateMatchOf({ ...v, actionId: action.actionId }, sym);
          if (m !== null) return m;
        }
        return null;
      };
      const match = redateMatchOf(action, sym) ?? vendorMatch();
      if (match !== null) {
        recordRedatePair(sym, action, match);
        // (SOAK-R3-1, the final soak: a pending founder split whose payload may be a re-date of another row — the vendor's
        // same split under another date — is ambiguous like any row: refused, and only a conflict ruling settles it. Before,
        // a founder action was never matched, so the founder's 2:1 applied beside the vendor's re-dated 2:1.)
        refuseFounderSplit(action, 'possible_redate');
        // A held action found to be a possible re-date is no longer a payload to pay later: its `possible_redate`
        // receipt governs it, and the founder may apply it (review C2 — the record would otherwise hold for good).
        if (next.holdings[sym]?.heldActions?.some((r) => r.actionId === action.actionId)) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], action.actionId) };
        continue;
      }
    }
    // T2A-C01: nothing whose amount or effect depends on the share count is applied while that count is in doubt.
    if (countDependent(action)) {
      const causes = causesOf(action);
      if (causes.length > 0) { hold(sym, action, causes); continue; }
    }
    const heldRecord = (next.holdings[sym]?.heldActions || []).find((r) => r.actionId === action.actionId) ?? null;
    const heldFields = heldRecord ? { held: true, heldOn: heldRecord.heldOn } : {};
    const heldBefore = next.holdings[sym] || null;
    // F-7 (C-16): A LATE CASH DIVIDEND — dated before a share-basis action this ledger has already applied — is paid on
    // the count the holding had on its own ex-date: the `sharesBefore` of the FIRST APPLIED of the share-basis actions
    // dated after it — the receipts are kept in the order they were applied, and a split listed late may have been
    // applied after a later-dated one, so the earliest DATED one's count can already hold another. With no such count
    // on record, nothing is estimated: held, refused.
    let late = null;
    if (action.type === 'cash_dividend' && heldBefore) {
      const basis = (next.corporateActionReceipts || [])
        .filter((r) => r.applied === true && SHARE_BASIS_TYPES.has(r.type) && upper(r.ticker) === sym && typeof r.effectiveDate === 'string');
      const first = basis.findIndex((r) => r.effectiveDate > action.effectiveDate);
      if (first >= 0) {
        // (T1a-2b-4 fix round, L-4: the ex-date count is the DATED CHAIN's — ledger.js datedCountOn: the count before any
        // share-basis event times each one dated on or before the ex-date, in dated order, the founder's corrected ratio in
        // force (AR4-C-1). A share-basis action dated on or before the ex-date but applied after the first one dated after it
        // (it was listed late) is named, as before.)
        const earlierLate = basis.slice(first + 1).filter((r) => r.effectiveDate <= action.effectiveDate).sort(byDatePhaseId);
        const dated = datedCountOn(next, sym, action.effectiveDate);
        const count = Number(dated?.count);
        if (!(count > 0) || !Number.isFinite(count)) { hold(sym, action, [], 'count_on_ex_date_unknown'); continue; }
        late = { entitledShares: count, countFrom: basis[first].actionId, ...(earlierLate.length > 0 ? { countAlsoFrom: earlierLate.map((r) => r.actionId) } : {}) };
      }
    }
    const out = applyCorporateAction({
      positions: late ? { ...next.holdings, [sym]: { ...heldBefore, shares: late.entitledShares } } : next.holdings, cash: next.cash,
    }, action);
    // Astra T2D-10: an action a founder's CONFLICT or SPLIT ruling supplied that the applier refuses for good (a ratio it
    // refuses, a holding it would round to nothing) is a permanent refusal, not a wait for evidence: it is reported
    // (`founderRefusals`) and leaves no held record, so the close closes the ruling with its reason and the record it
    // covers — still open — takes another ruling (`none`, or another payload). Kept as a held record, it locked the
    // record for good (`record_already_resolved`) and masked the feed's later correction.
    const founderRefusal = (reason) => {
      unresolved.add(sym);
      founderRefusals.push({ actionId: action.actionId, recordId: action.founderRuling.recordId ?? null, requestKey: action.founderRuling.requestKey ?? null, ticker: sym, reason });
      if (next.holdings[sym]?.heldActions?.some((r) => r.actionId === action.actionId)) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], action.actionId) };
    };
    const refusableRuling = action.founderRuling?.kind === 'conflict' || action.founderRuling?.kind === 'suspicion';
    if (!out.ok) {
      if (refusableRuling && SHARE_BASIS_TYPES.has(action.type)) { founderRefusal(out.reason ?? 'not_applicable'); continue; }
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
        ...(action.founderRuling ? { founderRuling: action.founderRuling } : {}),
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
      if (refusableRuling) { founderRefusal('rounds_to_nothing'); continue; }
      hold(sym, action, [], 'rounds_to_nothing');
      continue;
    }
    // (A late dividend leaves the holding as it was: its count was only read for the payment.)
    if (!late) next.holdings = out.positions;
    // F-5 (B3): the screen's reference after a `price_move` ruling is a price of its own session — a share-basis action
    // dated AFTER it divides it as the engine divided the mark; one dated on or before it is already in that price.
    if (SHARE_BASIS_TYPES.has(action.type)) {
      const ref = screenReferenceOf(next.holdings[sym]);
      if (ref && typeof action.effectiveDate === 'string' && action.effectiveDate > ref.session) {
        next.holdings = { ...next.holdings, [sym]: { ...next.holdings[sym], screenReference: { ...ref, price: Number(ref.price) / Number(action.ratio) } } };
      }
    }
    if (heldRecord && next.holdings[sym]) next.holdings = { ...next.holdings, [sym]: withoutHeld(next.holdings[sym], action.actionId) };
    // A share-basis row that EXPLAINS the holding's open suspicion, at a close after the one that raised it, releases it
    // (fix round 3, T2A-D01). F-8: THE RECEIPT LINK, both ways — the record is not deleted but retired into the holding's
    // `basisSuspicionHistory`, naming the row that explained it (`explainedBy`), and the row's receipt names the record
    // (`explainedSuspicion.id`). A record the screen replaced at this close because this row explained it in the dry run
    // (T2A-E01) is already in the history, naming this row: the receipt names it too.
    let explained = {};
    const suspicion = SHARE_BASIS_TYPES.has(action.type) ? openBasisSuspicion(next.holdings[sym]) : null;
    // (F-5: the founder's split for this very record explains it — it is the founder's account of the move left, which
    // after a row applied inside the gap is less than the recorded move: review D5.)
    const ruledFor = suspicion !== null && isFounderSplit(action) && action.founderRuling.recordId === suspicionIdOf(sym, suspicion);
    if (suspicion && date > suspicion.suspectedOn && (explainsSuspicion(action, suspicion) || ruledFor)) {
      const { basisSuspicion, ...rest } = next.holdings[sym];
      const id = suspicionIdOf(sym, basisSuspicion);
      // T2D-08: a split-shaped transition seen while this record stood is not explained by the row that explains the
      // record: the first becomes the record (carrying the rest), and what is dated after it stays held.
      const [nextStep, ...later] = transitionsOf(basisSuspicion);
      const promoted = nextStep ? recordOfTransition(sym, nextStep, later, basisSuspicion.lastSeen, { explainedBy: action.actionId, after: id }) : null;
      const retired = {
        ...basisSuspicion, id, closedOn: date, explainedBy: { actionId: action.actionId, type: action.type, ratio: action.ratio ?? null, effectiveDate: action.effectiveDate },
        // F-8: a record closed by the founder's `split` ruling names the ruling.
        ...(action.founderRuling ? { resolvedBy: action.founderRuling.by, resolvedAt: action.founderRuling.at, ruling: action.founderRuling } : {}),
        ...(promoted ? { replacedBy: suspicionIdOf(sym, promoted) } : {}),
      };
      next.holdings = { ...next.holdings, [sym]: { ...rest, ...(promoted ? { basisSuspicion: promoted } : {}), basisSuspicionHistory: [...(rest.basisSuspicionHistory || []), retired] } };
      explained = { explainedSuspicion: { id, suspectedOn: basisSuspicion.suspectedOn, ratio: basisSuspicion.ratio, frozenMark: basisSuspicion.frozenMark } };
    } else if (SHARE_BASIS_TYPES.has(action.type)) {
      const past = (next.holdings[sym]?.basisSuspicionHistory || []).find((e) => e.closedOn === date && e.explainedBy?.actionId === action.actionId);
      if (past) explained = { explainedSuspicion: { id: past.id, suspectedOn: past.suspectedOn, ratio: past.ratio, frozenMark: past.frozenMark } };
    }
    next.cash = out.cash;
    next.dividendsUsd = addUsd(next.dividendsUsd, out.incomeUsd);
    next.appliedActionIds.push(action.actionId);
    const receipt = {
      actionId: action.actionId, type: action.type, ticker: action.ticker, effectiveDate: action.effectiveDate,
      ratio: action.ratio ?? null, amount: action.amount ?? null, incomeUsd: out.incomeUsd,
      applied: true, appliedOn: date, source: action.source ?? null, note: out.note, ...heldFields, ...explained,
      // F-7: a share-basis receipt keeps the count before and after it (a later late dividend reads its ex-date count);
      // a late dividend says which count it was paid on, and from which action's receipt.
      ...(SHARE_BASIS_TYPES.has(action.type) ? { sharesBefore: Number(heldBefore?.shares) || 0, sharesAfter: next.holdings[sym]?.shares ?? null } : {}),
      ...(late ? { entitledShares: late.entitledShares, entitledSharesFrom: late.countFrom, ...(late.countAlsoFrom ? { entitledSharesAlsoFrom: late.countAlsoFrom } : {}) } : {}),
      // F-5: an action the founder's ruling supplied says so — its founder receipt.
      ...(action.founderRuling ? { founderRuling: action.founderRuling } : {}),
    };
    next.corporateActionReceipts.push(receipt);
    // T1a-2b-4 fix round (L-4, Astra T2E-04): A SHARE-BASIS ACTION APPLIED OUT OF DATE ORDER — one dated before a share-basis
    // action this ledger already applied (listed late) — leaves the count the applier rounded in the order of ARRIVAL. The
    // count is recomputed along the dated chain from the entry fill (shareBasisChainOf: date, phase, id; six places at
    // each step) and the holding takes it; the receipt keeps what happened (`sharesAfter`, the applier's) and records the
    // difference (`recount`). The close's book mirror takes the same count from the receipt.
    if (SHARE_BASIS_TYPES.has(action.type) && next.holdings[sym]
      && next.corporateActionReceipts.some((r) => r !== receipt && r?.applied === true && SHARE_BASIS_TYPES.has(r.type) && upper(r.ticker) === sym && byDatePhaseId(r, action) > 0)) {
      const dated = shareBasisChainOf(next, sym).end;
      const h = next.holdings[sym];
      if (Number.isFinite(dated) && dated > 0 && dated !== Number(h.shares)) {
        receipt.recount = { order: 'dated', sharesAfterApplied: Number(h.shares), sharesAfter: dated, differenceShares: roundShares(dated - Number(h.shares)) };
        next.holdings = { ...next.holdings, [sym]: { ...h, shares: dated, avgCost: (Number(h.costBasisTotal) || 0) / dated } };
      }
    }
    applied.push({ ...action, receipt, ...(late ? { entitledShares: late.entitledShares } : {}) });
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
      // Rev 1, S-2 (AR2-A-2): a waiting rename whose id is AMBIGUOUS is not applied from its record — only the founder's
      // ruling settles it. The holding keeps its symbol and its carried mark.
      if (ambiguity.has(record.actionId)) { unresolved.add(upper(sym)); continue; }
      // The close screened this id's row out (R-36): the record does not stand in for it, and takes the target the row
      // names now, so a later close never falls back to a target the feed corrected away from (fix-round refuters,
      // F2 and S1). The holding stays unresolved here: the close marks it blocked.
      if (renameIdsScreened?.has(record.actionId)) {
        const screenedTo = typeof renameIdsScreened.get === 'function' ? renameIdsScreened.get(record.actionId) : null;
        // Rev 1, S-1 ② (AR2-A-3): a target the feed now names differently is a REVISION — the id is ambiguous, and the
        // record no longer follows the row (before rev 1 it took the new target, F2/S1); the founder rules the target.
        if (typeof screenedTo === 'string' && screenedTo.length > 0 && screenedTo !== record.to) {
          const rows = [rowOfPayload({ renamedTo: record.to }, record.deferredOn ?? null), rowOfPayload({ renamedTo: screenedTo }, date)];
          recordAmbiguity({
            actionId: record.actionId, type: 'ticker_change', ticker: sym, effectiveDate: record.effectiveDate, applied: false, reason: CONFLICTING_ACTION,
            entitled: true, rows, seenOn: date, kinds: kindsOf(null, rows, 'revision'), revisedFrom: { deferredOn: record.deferredOn ?? null },
          }, 'revision');
        }
        continue;
      }
      candidates.push({ type: 'ticker_change', ticker: sym, renamedTo: record.to, effectiveDate: record.effectiveDate, actionId: record.actionId });
    }
    candidates.sort((a, b) => (a.effectiveDate + a.actionId).localeCompare(b.effectiveDate + b.actionId));
    // (AR2-IR-2: and while ITS SYMBOL has any open ambiguity on this ledger — a cash conflict too. Renamed first, the
    // founder's ruling on the old symbol's record could reach no holding: closed `moot`, the money owed unpayable.)
    const ambiguousSymbols = openAmbiguities(next).filter((r) => r.type !== 'ticker_change').map((r) => upper(r.ticker));
    const wait = new Set([...(deferRenames || []), ...unsettledShareBasisSymbols(next, actionsBySymbol, { date }), ...ambiguousSymbols]);
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
      if (renameTargetsTaken?.has(to)) {
        unresolved.add(from);
        renamesBlocked.push({ from, to, actionId: action.actionId });
        // (AR2-RF-2: the founder's rename into a target another idea of the book holds can never apply while it does — a
        // refusal, as T2D-10's: the ruling closes with its reason and the record takes another ruling.)
        if (action.founderRuling?.kind === 'conflict') founderRefusals.push({ actionId: action.actionId, recordId: action.founderRuling.recordId ?? null, requestKey: action.founderRuling.requestKey ?? null, ticker: from, reason: 'rename_target_taken' });
        continue;
      }
      const { deferredRename: waited = null, ...plain } = holding;
      const out = applyCorporateAction({ positions: { ...next.holdings, [from]: plain }, cash: next.cash }, action);
      if (!out.ok) {
        unresolved.add(from);
        // (AR2-IR-1: the founder's rename the applier refuses — a target this ledger already holds — is a refusal as
        // T2D-10's are: the ruling closes with its reason and the record takes another, never left pending for good.)
        if (action.founderRuling?.kind === 'conflict') founderRefusals.push({ actionId: action.actionId, recordId: action.founderRuling.recordId ?? null, requestKey: action.founderRuling.requestKey ?? null, ticker: from, reason: out.reason ?? 'rename_refused' });
        continue;
      }
      next.holdings = out.positions;
      next.appliedActionIds.push(action.actionId);
      const deferral = waited && waited.actionId === action.actionId ? { deferred: true, deferredOn: waited.deferredOn } : {};
      const receipt = {
        actionId: action.actionId, type: action.type, ticker: action.ticker, effectiveDate: action.effectiveDate,
        renamedTo: to, incomeUsd: 0, applied: true, appliedOn: date, source: action.source ?? null, note: out.note, ...deferral,
        ...(action.founderRuling ? { founderRuling: action.founderRuling } : {}),
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
  checkRulingRevisions();
  return {
    ledger: next, applied, declined, unresolved, conflicts, shareBasisChanges, renames, renamesDeferred, renamesBlocked, held, closedByCash, delistedWaiting, redates,
    founderSkips, founderRefusals, ambiguities,
  };
}

/**
 * Value a ledger at the close snapshot. A VALUATION, never a fill: it reads marks and changes nothing.
 *
 * A symbol the snapshot cannot mark — absent, incomplete, in `frozen` (an unresolved or suspected corporate
 * action) — is valued at the ledger's own last mark and labelled `carried_forward`. `fullQuality` is false
 * whenever any mark is not `vendor_time`. A carried mark whose symbol is in `carriedQuality` takes that quality instead
 * — the close names a mark it carried because the session's corporate-action data did not cover the symbol
 * (`ca_coverage_missing`, Amendment F-1).
 *
 * @returns {{ rawValue: number, rawPositionsValue: number, markedValue: number, markedHoldingsValue: number, cash: number,
 *             marks: Object<string, { mark: number, shares: number, quality: string, markSource: string, vendorTimeIso: string|null }>,
 *             fullQuality: boolean }}
 */
export function valueLedger(ledger, closeSnapshot, { sessionDate, frozen = null, carriedQuality = null } = {}) {
  const markingSnapshot = frozen && frozen.size > 0 ? snapshotExcluding(closeSnapshot, frozen) : closeSnapshot;
  const { marked, positionsValue, totalValue } = markBook(ledger.holdings, ledger.cash, markingSnapshot);
  const marks = {};
  let fullQuality = true;
  for (const [sym, m] of Object.entries(marked)) {
    const fromSnapshot = m.markSource === 'snapshot';
    const q = fromSnapshot
      ? closeMarkQuality(closeSnapshot?.symbols?.[sym] ?? null, sessionDate)
      : { quality: carriedQuality?.get(sym) ?? MARK_QUALITY.CARRIED_FORWARD, vendorTimeIso: null };
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

// ── THE PROVENANCE OF A HOLDING'S RECORDED MARK (Astra T2B-01) ─────────────────────────────────────────────────
// Every holding's `lastMark` carries, beside it, `lastMarkProvenance`: where THAT price came from — `{ source, symbol,
// session, snapshotKey, quality, vendorTimeIso }`. It is written wherever a holding's mark is set from a quote, on every
// ledger (the idea's, its comparison's, its SPY line's) and on the book's mirror of the idea's positions:
//   source 'fill'   a fill priced the holding (fills.js executeIdeaFill): the slot snapshot's key, `vendor_time` (the
//                   eligible-mark rule admits only a quote the vendor timed in the session), and that quote's time;
//   source 'close'  a close marked it FROM its stored snapshot (withCloseMarks): the close snapshot's key, the close's
//                   quality for it, and the vendor's time — NULL when the quote had none (`receipt_time_fallback`).
// A CARRY COPIES IT UNCHANGED: a mark the close could not take from its snapshot, an unobserved session, a split's
// adjustment of the mark (the engine divides `lastMark`; the receipts say by what) and a ticker change all leave the
// provenance as it was, so an untimed source stays untimed through any number of carries. `symbol` is the symbol the
// quote was for (a ticker change renames the holding, not its source).
//
// `lastMarkAsOf` IS NOT PROVENANCE. It is the engine's position field, kept exactly as before: the time of the last
// VENDOR-TIMED mark, which a later untimed quote does not replace. The gap screen reads it (markSessionOf: the session of
// the last trusted mark), so changing it would move which cash actions wait — a money change this round may not make.
// Nothing that states where a price came from reads it: the packets read `lastMarkProvenance`.

/** Where a recorded mark came from (see above). */
export const MARK_PROVENANCE_SOURCE = Object.freeze({ FILL: 'fill', CLOSE: 'close' });

/** A holding's mark provenance (see above). Every field is present; the unknown ones are null. */
export function markProvenance({ source, symbol, session, snapshotKey, quality, vendorTimeIso }) {
  return {
    source, symbol: symbol ?? null, session: session ?? null, snapshotKey: snapshotKey ?? null,
    quality: quality ?? null, vendorTimeIso: vendorTimeIso ?? null,
  };
}

/**
 * Write a valuation's marks back onto the ledger's holdings (tomorrow's gap screen compares against today's
 * mark). Cash, quantities and basis are untouched.
 *
 * A fresh mark takes this close's provenance (`date`, `snapshotKey`, its quality and vendor time — null when the quote
 * had none); a carried mark keeps the provenance it had (Astra T2B-01). `lastMarkAsOf` is written as before (see above).
 */
export function withCloseMarks(ledger, valuation, { date = null, snapshotKey = null } = {}) {
  const next = cloneLedger(ledger);
  for (const [sym, h] of Object.entries(next.holdings)) {
    const m = valuation.marks[sym];
    if (!m) continue;
    const fresh = m.markSource === 'snapshot';
    // (F-5: a fresh mark — one this close's screen passed — replaces a `price_move` ruling's screen reference.)
    const { screenReference: _replaced, ...unreferenced } = h;
    next.holdings[sym] = {
      ...(fresh ? unreferenced : h),
      lastMark: m.mark,
      lastMarkAsOf: fresh ? (m.vendorTimeIso ?? h.lastMarkAsOf ?? null) : (h.lastMarkAsOf ?? null),
      lastMarkSource: fresh ? 'snapshot' : m.markSource,
      ...(fresh ? {
        lastMarkProvenance: markProvenance({
          source: MARK_PROVENANCE_SOURCE.CLOSE, symbol: sym, session: date, snapshotKey, quality: m.quality, vendorTimeIso: m.vendorTimeIso,
        }),
      } : {}),
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
 *
 * And (fix round 3, T2A-D01) while the holding carries an open gap-screen suspicion (`basisSuspicion`):
 * `suspected_corporate_action`, as the live screen reads — also after the price has recovered, and also for a holding
 * that began waiting on a delisting after the suspicion was raised. The live screen still runs as before; a move the
 * founder has resolved is not suspected again against the same frozen mark.
 *
 * The action rows are the snapshot's own unless the caller hands the session's (`actionsBySymbol`): Amendment F-2 —
 * the union of the session's daily layer and the snapshot's copy (dailyCoverage.js unionActionsBySymbol).
 */
export function saleHeldBackBy(ledger, symbol, snapshot, { sinceDate, date, otherLedgers = [], actionsBySymbol: rows = null }) {
  const holding = ledger?.holdings?.[symbol];
  if (!holding) return null;
  const actionsBySymbol = rows ?? caActionsBySymbol(snapshot);
  // The gap screen's RECORD (fix round 3, T2A-D01): the move it suspected is not settled because the price has since
  // recovered or the shape has gone. First, before the delisting exception below: a suspicion raised before the holding
  // began waiting on a delisting still holds it.
  if (openBasisSuspicion(holding)) return 'suspected_corporate_action';
  const settled = new Set([...(ledger.appliedActionIds || []), ...(ledger.declinedActionIds || [])]);
  // (A held record whose id has since been settled — declined by the founder, say — holds nothing: review C2.)
  if ((holding.heldActions || []).some((r) => !settled.has(r.actionId))) return 'corporate_action_unsettled';
  // A share-basis row recorded as a possible re-date (F-7) is a doubt about THIS ledger's count, as it is for the close:
  // the sale waits (review C1 — before, only another ledger's copy of it reached the sale).
  if (unsettledRedates(ledger).some((r) => SHARE_BASIS_TYPES.has(r.type) && upper(r.ticker) === symbol)) return 'corporate_action_unsettled';
  // …and (rev 1, S-2) a ruled split the feed has since listed with a ratio the ruling did not see.
  if (openRulingRevisions(ledger).some((r) => SHARE_BASIS_TYPES.has(r.type) && upper(r.ticker) === symbol)) return 'corporate_action_unsettled';
  const one = { [symbol]: holding };
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
  // Another ledger's doubt holds the idea's sale only when it is a doubt about the symbol, not one in that paper
  // ledger's own count (Amendment F-4).
  for (const other of otherLedgers || []) {
    if (other && ideaWideDoubtSymbols(other, actionsBySymbol, { date }).has(symbol)) return 'corporate_action_unsettled';
  }
  const delistedWaiting = holding.exitPending?.reason === 'delisting' || holding.settlementPending?.replacedExit?.reason === 'delisting';
  if (delistedWaiting) return null;
  const gaps = classifyOvernightGaps({ [symbol]: screenHoldingOf(holding) }, snapshot, actionsBySymbol, { sinceDate: sinceDate ?? null, asOfDate: date, excludeActionIds: settled });
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
  const scan = classifyOvernightGaps(screenView(ledger.holdings), closeSnapshot, actionsBySymbol, {
    sinceDate: sinceDate ?? null, asOfDate: date, excludeActionIds: settled,
  });
  const frozen = new Set(scan.frozen);
  // A dividend this ledger has just PAID, at this close, that explains the ex-date drop: once settled the screen excludes
  // it, and the mark would be frozen at the pre-ex price beside the dividend's cash — a value counted twice and a mark
  // later moves are read against (refuter D2; pre-existing, R-31's mark hold). Asked again, the engine's way.
  for (const sym of scan.suspectedCA.keys()) {
    const h = ledger.holdings?.[sym];
    if (h && frozen.has(sym) && !scan.pendingCA.has(sym) && paidDividendsExplain(ledger, h, sym, closeSnapshot, { date })) frozen.delete(sym);
  }
  return frozen;
}
