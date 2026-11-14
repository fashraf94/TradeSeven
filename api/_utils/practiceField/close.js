// api/_utils/practiceField/close.js
//
// Practice Field T1a-1, T1a-2a — THE IDEA-BOOK CLOSE: valuation every session, the lines, the endpoint and the result
// (T1a-1 build prompt §7, §7a requirements 2 and 3; T1a-2a build prompt §3, §5 to §8; Amendment E; acceptance cases
// B-RECON, B-OWNED, B-MARK, B-STAMP, B-LINE, B-EARLY, B-ENDPOINT, B-CATCHUP, B-DUE-BREACH). Dispatched from the
// engine's close sweep for a book of kind `idea_book`; a quarterly book still goes to closeBook, unchanged.
//
// A VALUATION IS A MARK, NEVER A SALE (B-MARK). This pass makes NO fill and writes NO decision record: every sale is a
// fill at a window, through executeIdeaFill (exits.js). A ledger's cash changes here only by a receipted corporate
// action — a dividend, or a delisting's cash per share (Amendment E11) — and every valuation row says `basis: 'mark'`
// and names its figures as marks. What the close MAY do with cash, each a movement of cash that is already cash:
//   • return an UNFILLED reservation to the treasury when an idea times out before its first fill (Q-4);
//   • return a RESOLVED idea's cash to the treasury when it reaches its endpoint with nothing left to sell (E2, E14).
// The endpoint row is a separate document (`rows/endpoint`, `basis: 'liquidation_value'`): a value, not a sale.
//
// ONE SNAPSHOT PER DATE (B-STAMP). The engine builds one close snapshot per date at `${date}_close`. This pass READS
// THAT STORED DOCUMENT ITSELF, inside its own transaction (Astra T1A-03); it takes no snapshot from its caller,
// refuses a stored document whose own key or date is not the session's, marks every ledger of the book from that one
// document, and stores its key and build time on every row. It builds and fetches nothing.
//
// MISSED CLOSES ARE CAUGHT UP FIRST, FROM STORED SNAPSHOTS ONLY (E12; Astra T1A-08). A close for a date first closes
// every trading session between the book's last closed date and that date, IN ORDER, each exactly as a normal close
// would from its own stored `${session}_close` document — corporate actions, marks, lines, entry timeouts, due
// sessions, endpoints — one transaction per session. A missed session with NO stored document gets an `unobserved`
// row (marks carried, not full quality): no line is recognised, every open line is recorded as unobserved for it, and
// an endpoint that falls on it is written with `economicResult: 'unmeasurable'`. Nothing is fetched or invented and
// NO CLOCK MOVES: an idea is settled on its own due session or not measured. A line recognised while catching up is
// recorded as late, and its sale fills at the next eligible observation after the catch-up. The requested date itself
// still needs its document (`valuation_missed` otherwise — tomorrow's close catches it up). A date BEFORE the last
// closed one is still refused `out_of_order`.
//
// IN ONE TRANSACTION PER SESSION, idempotent per date (`execState.lastCloseKey`):
//   0. an `accepted` idea whose start session has passed without a fill is cancelled `entry_timeout`;
//   1. CORPORATE ACTIONS from the daily layer, through the engine's pure functions, applied ONCE to each ledger — the
//      idea's, its comparison's, its SPY line's — and, for the idea's own holdings, to the book's positions too. A
//      split moves quantities and the line's level by the same ratio; a dividend credits the cash of whichever ledger
//      holds the shares; a ticker change renames the holding, its line, the book's position and the coverage entry;
//      a delisting with cash is credited and closes the holding; one without leaves the idea's holding a waiting sale;
//   2. MARKS from the close snapshot for every ledger, each with its quality;
//   3. THE LINES of every running idea (settlement.js readLines);
//   4. THE ENDPOINT AND THE RESULT of an idea on its due session, or with no holdings left: the endpoint row, the
//      result (written once; never again), `settled`, and every remaining holding marked for the settlement sale —
//      or `resulted` at once, its cash back in the treasury and its slot free, when nothing is left to sell;
//   5. ROWS: the book's `dailyRows/{date}` and each filled idea's `ideas/{ideaId}/rows/{date}`;
//   6. RECONCILIATION of the book as read, before step 0 (reject, never repair — Astra T1A-02), and of the book as it
//      will be written, before anything is written.

import { buildCorporateAction } from '../mandateSchema.js';
import { applyCorporateAction } from '../mandateCorporateActions.js';
import { caActionsBySymbol, snapshotExcluding, SNAPSHOT_COLLECTION } from '../mandateUniverseSnapshot.js';
import { markBook } from '../mandateValuation.js';
import { roundUsd } from '../mandateRounding.js';
import { MANDATE_SCHEMA_VERSION } from '../mandateConfig.js';
import { isIdeaBook, IDEA_BOOK_KIND } from '../mandateBookKind.js';
import {
  IDEA_SCHEMA_VERSION, IDEA_STATUS, CANCEL_REASON, VALUATION_LABEL, VALUATION_LABEL_UNOBSERVED, MARK_QUALITY, FILLED_IDEA_STATUSES,
  RUNNING_IDEA_STATUSES, EXIT_REASON, CATCH_UP_MAX_SESSIONS_PER_CALL, PROCESS_QUALITY,
} from './constants.js';
import { PracticeFieldError } from './errors.js';
import { practiceFieldLive } from './mode.js';
import {
  applyLedgerActions, valueLedger, withCloseMarks, suspectedActionSymbols, markedEquityCents, unsettledConflicts, cloneLedger,
} from './ledger.js';
import { closeMarkQuality } from './marks.js';
import { planRelease } from './admission.js';
import { coverageRefOf, coverageRef, coverageWithRef, coverageWithoutRef, ideaCoveragePlanFromLedgers } from './coverage.js';
import { assertReconciled } from './reconcile.js';
import { readLines, buildEndpoint, foldCloseIntoTrack, pendingSaleOf, completedLiquidation, ENDPOINT_KIND } from './settlement.js';
import { firstUnclosedSessionBefore } from './sessions.js';
import { toCents, fromCents } from './money.js';

/** The key of THE close snapshot for a date. */
export const closeSnapshotKeyFor = (date) => `${date}_close`;

const toIso = (v) => {
  if (v == null) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : null;
};

const quantitiesOf = (ledger) => Object.fromEntries(Object.entries(ledger.holdings).map(([s, h]) => [s, h.shares]));
const marksOf = (valuation) => Object.fromEntries(Object.entries(valuation.marks).map(([s, m]) => [s, {
  mark: m.mark, quality: m.quality, markSource: m.markSource, vendorTimeIso: m.vendorTimeIso,
}]));

/** What applyLedgerActions answers when there is nothing to apply: the session has no stored snapshot, so no feed. */
const noActions = (ledger) => ({
  ledger, applied: [], declined: [], unresolved: new Set(), conflicts: [], shareBasisChanges: [], renames: [], closedByCash: [], delistedWaiting: [],
});

/** A valuation of a session nobody observed: every mark is the carried one, and says so (E12). */
function unobservedValuation(ledger, date) {
  const v = valueLedger(ledger, null, { sessionDate: date });
  const marks = Object.fromEntries(Object.entries(v.marks).map(([s, m]) => [s, { ...m, quality: MARK_QUALITY.UNOBSERVED, vendorTimeIso: null }]));
  return { ...v, marks, fullQuality: false };
}

export { firstUnclosedSessionBefore };

/**
 * One FILLED idea at one session's close: actions applied to its three ledgers, each valued, its lines read, its row
 * — and, at its endpoint, its endpoint row and result. Pure. `closeSnapshot` is null for a session with no stored
 * document (an unobserved session).
 */
function closeFilledIdea(idea, { date, closeSnapshot, actionsBySymbol: feedActions, heldByOthers = new Set(), sinceDate, snapshotMeta, nowIso, catchUp }) {
  const observed = closeSnapshot !== null;
  const running = RUNNING_IDEA_STATUSES.includes(idea.status);
  const dueSession = idea.contract.schedule.dueSession;
  const alerts = [];

  // One name, one idea (B-SAME): a ticker change INTO a symbol another idea of the book holds would put one ticker in
  // two ideas. It is applied to no ledger of this idea — the symbol is held at its carried mark, not full quality,
  // with an alert — instead of aborting the whole book's close on the book's mirror (review, lens 1).
  const renameBlocked = new Set();
  const actionsBySymbol = {};
  for (const [sym, list] of Object.entries(feedActions || {})) {
    actionsBySymbol[sym] = list.filter((a) => {
      if (a?.type !== 'ticker_change' || !heldByOthers.has(String(a.renamedTo || '').trim().toUpperCase())) return true;
      renameBlocked.add(sym);
      return false;
    });
  }

  // 1. Corporate actions, once per ledger.
  const own = observed ? applyLedgerActions(idea.ledger, actionsBySymbol, { date }) : noActions(idea.ledger);
  const cmp = observed ? applyLedgerActions(idea.comparisonLedger, actionsBySymbol, { date }) : noActions(idea.comparisonLedger);
  const spy = observed ? applyLedgerActions(idea.spyLedger, actionsBySymbol, { date }) : noActions(idea.spyLedger);

  for (const [name, out] of [['idea', own], ['comparison', cmp], ['spy', spy]]) {
    for (const sym of renameBlocked) {
      if (!Object.hasOwn(out.ledger.holdings || {}, sym)) continue;
      out.unresolved.add(sym);
      alerts.push(`PRACTICE_FIELD_RENAME_BLOCKED ${idea.ideaId} ${name} ${sym} — a ticker change into a symbol another idea of the book holds is not applied; the holding is valued at its carried mark`);
    }
  }

  // A split moves the line's level by the same ratio as the quantity (a price is per share).
  let lines = idea.lines;
  for (const change of own.shareBasisChanges) {
    lines = lines.map((l) => (l.symbol === change.ticker
      ? { ...l, level: l.level / change.ratio, adjustments: [...(l.adjustments || []), { actionId: change.actionId, ratio: change.ratio, appliedOn: date }] }
      : l));
  }
  // A ticker change renames the line and its unobserved record with the holding (E11). No cash moves.
  let unobservedLineSessions = idea.unobservedLineSessions || {};
  for (const rename of own.renames) {
    lines = lines.map((l) => (l.symbol === rename.from
      ? { ...l, symbol: rename.to, renamedFrom: [...(l.renamedFrom || []), { symbol: rename.from, actionId: rename.actionId, appliedOn: date }] }
      : l));
    if (Object.hasOwn(unobservedLineSessions, rename.from)) {
      const { [rename.from]: moved, ...rest } = unobservedLineSessions;
      unobservedLineSessions = { ...rest, [rename.to]: [...(rest[rename.to] || []), ...moved] };
    }
  }
  // A delisting with no cash amount is never applied as a sale (E11): the idea's own holding becomes a waiting sale
  // (E9), sold only when a window shows an eligible price. A holding already waiting keeps its record.
  let ownLedger = own.ledger;
  if (running) {
    for (const d of own.delistedWaiting) {
      const h = ownLedger.holdings[d.ticker];
      if (!h || pendingSaleOf(h)) continue;
      ownLedger = cloneLedger(ownLedger);
      ownLedger.holdings[d.ticker] = {
        ...h, exitPending: { reason: EXIT_REASON.DELISTING, session: date, at: nowIso, actionId: d.actionId, recognisedLate: catchUp === true, waiting: null },
      };
      alerts.push(`PRACTICE_FIELD_DELISTING_WAITING ${idea.ideaId} ${d.ticker} ${d.actionId} — a delisting with no cash amount is not applied; the holding waits for an eligible price`);
    }
  }

  // 2. Marks. A symbol with an unresolved or suspected action is valued at its carried mark.
  const value = (ledger, unresolved) => {
    if (!observed) return { valuation: unobservedValuation(ledger, date), frozen: new Set() };
    const frozen = new Set([...unresolved, ...suspectedActionSymbols(ledger, closeSnapshot, actionsBySymbol, { sinceDate, date })]);
    return { valuation: valueLedger(ledger, closeSnapshot, { sessionDate: date, frozen }), frozen };
  };
  const ownV = value(ownLedger, own.unresolved);
  const cmpV = value(cmp.ledger, cmp.unresolved);
  const spyV = value(spy.ledger, spy.unresolved);
  // Conflicts recorded on a ledger and not settled since (neither applied nor declined), this close's included.
  const openConflicts = [['idea', ownLedger], ['comparison', cmp.ledger], ['spy', spy.ledger]].flatMap(([name, ledger]) => unsettledConflicts(ledger).map((r) => ({ name, actionId: r.actionId })));

  // An unobserved session changes no ledger: there is nothing to write a mark from.
  let next = {
    ...idea,
    ledger: observed ? withCloseMarks(ownLedger, ownV.valuation) : ownLedger,
    comparisonLedger: observed ? withCloseMarks(cmp.ledger, cmpV.valuation) : cmp.ledger,
    spyLedger: observed ? withCloseMarks(spy.ledger, spyV.valuation) : spy.ledger,
    lines,
    lastValuedOn: observed ? date : (idea.lastValuedOn ?? null),
    lastClosedOn: date,
    revision: (idea.revision || 0) + 1,
  };
  if (Object.keys(unobservedLineSessions).length > 0 || idea.unobservedLineSessions) next.unobservedLineSessions = unobservedLineSessions;

  // 3. The lines, on every session up to and including the due one, while the idea runs (E6, E7).
  let lineRead = null;
  if (running && date <= dueSession) {
    lineRead = readLines({
      idea: next, valuation: observed ? ownV.valuation : null, date, isDueSession: date === dueSession,
      late: catchUp === true, recognisedAtIso: nowIso, snapshotKey: snapshotMeta.key,
    });
    next = { ...next, lines: lineRead.lines, ledger: { ...next.ledger, holdings: lineRead.holdings }, unobservedLineSessions: lineRead.unobservedLineSessions };
    // E12, E15: a line recognised while catching up was recognised LATE — a code action that did not happen at its
    // first eligible moment. It is recorded as late on the line, and the idea's process quality reads blocked.
    if (catchUp && lineRead.breaches.length > 0) {
      const late = lineRead.breaches.map((b) => ({ kind: 'line_recognised_late', symbol: b.symbol, session: b.session }));
      next = { ...next, blockedBy: [...(next.blockedBy || []), ...late], processQuality: PROCESS_QUALITY.BLOCKED };
    }
  }
  // The status follows what the holdings carry (E14).
  if (running) {
    const holdings = Object.values(next.ledger.holdings);
    const waitingToExit = holdings.some((h) => h.exitPending != null);
    const status = waitingToExit ? IDEA_STATUS.LINE_HIT_EXIT_PENDING
      : (holdings.length > 0 ? IDEA_STATUS.HOLDING : next.status);
    if (status !== next.status) next = { ...next, status, statusHistory: [...(next.statusHistory || []), { status, at: nowIso }] };
  }

  // 4. The row. The gap is computed from the ROUNDED, displayed values (BUILD_RULES §9); raw values sit beside.
  const valueCents = toCents(ownV.valuation.markedValue);
  const comparisonCents = toCents(cmpV.valuation.markedValue);
  const spyCents = toCents(spyV.valuation.markedValue);
  const reservedCents = toCents(idea.contract.capitalUsd);
  const row = {
    schemaVersion: IDEA_SCHEMA_VERSION,
    rowKind: 'valuation',
    basis: 'mark',
    // A session with no stored close snapshot is not a post-close snapshot value: it says `unobserved` (review RH-8).
    label: observed ? VALUATION_LABEL : VALUATION_LABEL_UNOBSERVED,
    date,
    ideaId: idea.ideaId,
    bookId: idea.bookId,
    closeSnapshotKey: snapshotMeta.key,
    closeSnapshotBuiltAt: snapshotMeta.builtAt,
    reservedCapitalUsd: idea.contract.capitalUsd,
    markedValue: ownV.valuation.markedValue,
    cash: ownV.valuation.cash,
    markedHoldingsValue: ownV.valuation.markedHoldingsValue,
    quantities: quantitiesOf(ownLedger),
    marks: marksOf(ownV.valuation),
    cumulativeCostsUsd: ownLedger.costsPaidUsd,
    dividendsToDateUsd: ownLedger.dividendsUsd,
    comparisonType: idea.contract.comparison.type,
    comparisonMarkedValue: cmpV.valuation.markedValue,
    comparisonCash: cmpV.valuation.cash,
    comparisonQuantities: quantitiesOf(cmp.ledger),
    comparisonMarks: marksOf(cmpV.valuation),
    comparisonCumulativeCostsUsd: cmp.ledger.costsPaidUsd,
    spyMarkedValue: spyV.valuation.markedValue,
    spyCash: spyV.valuation.cash,
    spyQuantities: quantitiesOf(spy.ledger),
    spyMarks: marksOf(spyV.valuation),
    markedGapUsd: fromCents(valueCents - comparisonCents),
    markedGapPct: ((valueCents - comparisonCents) * 100) / reservedCents,
    markedGapToSpyUsd: fromCents(valueCents - spyCents),
    markedGapToSpyPct: ((valueCents - spyCents) * 100) / reservedCents,
    raw: {
      markedValue: ownV.valuation.rawValue,
      comparisonMarkedValue: cmpV.valuation.rawValue,
      spyMarkedValue: spyV.valuation.rawValue,
      markedGapUsd: ownV.valuation.rawValue - cmpV.valuation.rawValue,
    },
    corporateActionsApplied: {
      idea: own.applied.map((a) => a.actionId), comparison: cmp.applied.map((a) => a.actionId), spy: spy.applied.map((a) => a.actionId),
    },
    // Not full quality while any ledger of the idea holds an UNSETTLED conflicting action (review FR-A1): after the
    // feed stops presenting a conflict, its symbol is marked fresh again, but the action — a dividend's income, say —
    // was never applied, so the row must not read as clean until a consistent row settles it.
    fullQuality: observed && ownV.valuation.fullQuality && cmpV.valuation.fullQuality && spyV.valuation.fullQuality && openConflicts.length === 0,
    // Always true since Amendment D's Q-1 (a leg with no resolvable cost tier does not enter); kept on the row because
    // T1a-1's rows carry it.
    entryCostTiersKnown: (idea.entry?.unknownCostTierLegs || []).length === 0,
    // E12: was this session's close snapshot stored? An unobserved row carries marks, never observations.
    observed,
  };
  // What each line read at this close (E6): 'below', 'at_or_above' or 'unobserved', by symbol.
  if (lineRead) row.lineObservations = lineRead.observations;
  if (catchUp) row.caughtUpAt = nowIso;

  for (const [name, set] of [['idea', ownV.frozen], ['comparison', cmpV.frozen], ['spy', spyV.frozen]]) {
    for (const sym of set) alerts.push(`PRACTICE_FIELD_MARK_HELD_BACK ${idea.ideaId} ${name} ${sym} — unresolved or suspected corporate action; valued at its carried mark`);
  }
  const seenToday = new Set();
  for (const [name, out] of [['idea', own], ['comparison', cmp], ['spy', spy]]) {
    for (const c of out.conflicts) {
      seenToday.add(`${name} ${c.actionId}`);
      alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_CONFLICT ${idea.ideaId} ${name} ${c.actionId} — the feed lists it ${c.rows.length} times with different payloads; applied to no ledger`);
    }
  }
  for (const c of openConflicts) {
    if (!seenToday.has(`${c.name} ${c.actionId}`)) alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_UNSETTLED ${idea.ideaId} ${c.name} ${c.actionId} — a conflicting action the feed no longer presents was never applied; the row is not full quality`);
  }

  // The running record the result is built from: every close while the idea runs, the endpoint's own included.
  if (running) next = { ...next, track: foldCloseIntoTrack(idea.track, row, { observed }) };

  // 5. The endpoint and the result: on the due session (E4), or as soon as nothing is held (E2). Written ONCE — an
  //    idea that carries a result never gets another (build prompt §6).
  let endpointRow = null;
  const nothingHeld = Object.keys(next.ledger.holdings).length === 0;
  if (running && next.result == null && (date >= dueSession || nothingHeld)) {
    const kind = date > dueSession ? ENDPOINT_KIND.LATE : (date === dueSession ? ENDPOINT_KIND.DUE_SESSION : ENDPOINT_KIND.EARLY_RESOLUTION);
    const built = buildEndpoint({
      idea: next, valuations: { idea: ownV.valuation, comparison: cmpV.valuation, spy: spyV.valuation },
      date, kind, observed, caughtUp: catchUp === true, snapshotMeta, nowIso,
    });
    endpointRow = built.endpointRow;
    // Everything still held waits for the ONE settlement sale (E7): a line exit still pending becomes it, keeping the
    // record of how long it has waited.
    const holdings = Object.fromEntries(Object.entries(next.ledger.holdings).map(([sym, h]) => {
      const { exitPending, ...rest } = h;
      return [sym, {
        ...rest,
        settlementPending: {
          session: date, at: nowIso,
          replacedExit: exitPending ? { reason: exitPending.reason, session: exitPending.session } : null,
          waiting: exitPending?.waiting ?? null,
        },
      }];
    }));
    const statusHistory = [...(next.statusHistory || []), { status: IDEA_STATUS.SETTLED, at: nowIso }];
    next = {
      ...next,
      status: IDEA_STATUS.SETTLED,
      statusHistory,
      ledger: { ...next.ledger, holdings },
      result: built.result,
      endpoint: {
        session: date, kind, valueUsd: built.endpointRow.idea.valueUsd, cashUsd: built.endpointRow.idea.cashUsd,
        holdingsNetUsd: built.endpointRow.idea.holdingsNetUsd, snapshotKey: snapshotMeta.key,
      },
      settledAt: nowIso,
      processQuality: built.result.processQuality,
      blockedBy: built.result.processDetail.blockedBy,
    };
  }
  // E14: a settled idea with nothing left to sell is `resulted` at this same close — one that reached its endpoint
  // holding nothing, or (E11) one whose last waiting holding a delisting's cash has just closed. The caller returns
  // its cash to the treasury and frees its slot and its coverage.
  if (next.status === IDEA_STATUS.SETTLED && Object.keys(next.ledger.holdings).length === 0) {
    const done = completedLiquidation(next, next.ledger, { session: date, nowIso });
    next = {
      ...next,
      ...done.fields,
      status: IDEA_STATUS.RESULTED,
      statusHistory: [...(next.statusHistory || []), { status: IDEA_STATUS.RESULTED, at: nowIso }],
      ledger: { ...next.ledger, cash: 0 },
    };
    return { nextIdea: next, row, endpointRow, returnedCents: done.returnedCents, resolved: true, ownApplied: own.applied, ownFrozen: ownV.frozen, alerts, coverageChanged: false };
  }
  const coverageChanged = own.renames.length + cmp.renames.length + spy.renames.length > 0;
  return { nextIdea: next, row, endpointRow, returnedCents: 0, resolved: false, ownApplied: own.applied, ownFrozen: ownV.frozen, alerts, coverageChanged };
}

/**
 * Close ONE session of one idea book, in one transaction: the first session before `date` the book has not closed
 * (a catch-up — E12), or `date` itself when there is none.
 *
 * @returns {Promise<{ closed: boolean, skipped?: string, session?: string, catchUp?: boolean, observed?: boolean,
 *                     row?: object, ideaRows?: object, endpoints?: object, cancelled?: string[], resulted?: string[], alerts: string[] }>}
 */
async function closeNextSession(db, bookRef, { date, now, catchUpOnly = false }) {
  const nowIso = now.toISOString();
  const coverageDocRef = coverageRefOf(db);

  return db.runTransaction(async (tx) => {
    const alerts = [];
    const bookSnap = await tx.get(bookRef);
    if (!bookSnap.exists) return { closed: false, skipped: 'book_missing', alerts };
    const book = bookSnap.data();
    if (!isIdeaBook(book)) return { closed: false, skipped: 'not_idea_book', alerts };
    // A catch-up before a window (`catchUpOnly`) closes only sessions BEFORE `date`; with `date` itself already closed
    // there is nothing before it left to close.
    if (catchUpOnly && typeof book.execState?.lastCloseKey === 'string' && date <= book.execState.lastCloseKey) return { closed: false, skipped: 'nothing_to_catch_up', alerts };
    if (book.execState?.lastCloseKey === date) return { closed: false, skipped: 'already_closed', alerts };
    // Never backwards (review L1-9): a close for a date before the last one would rewind the marks and the key.
    if (typeof book.execState?.lastCloseKey === 'string' && date < book.execState.lastCloseKey) return { closed: false, skipped: 'out_of_order', alerts };
    // E13: a draining book gets every code duty.
    if (book.status !== 'active' && book.status !== 'draining') return { closed: false, skipped: 'not_open', alerts };

    const ideas = [];
    for (const id of book.openIdeaIds || []) {
      const snap = await tx.get(bookRef.collection('ideas').doc(id));
      if (!snap.exists) throw new PracticeFieldError('open_idea_missing', { ideaId: id });
      ideas.push(snap.data());
    }
    // E12: the session this transaction closes — the first one the book has missed, or the requested date.
    const missed = firstUnclosedSessionBefore(book, ideas, date);
    if (catchUpOnly && missed === null) return { closed: false, skipped: 'nothing_to_catch_up', alerts };
    const session = missed ?? date;
    const catchUp = session !== date;
    // Nothing moves past an unclosed session (sessions.js): an idea that filled AFTER the session being closed cannot
    // exist — every fill refuses to run while an earlier session is unclosed. If one does, the book's present is not
    // this session's past, and no row of it is written (reject, never repair — review RH-1).
    const fromTheFuture = ideas.filter((i) => typeof i?.entry?.sessionDate === 'string' && i.entry.sessionDate > session);
    if (fromTheFuture.length > 0) throw new PracticeFieldError('idea_filled_after_unclosed_session', { session, ideas: fromTheFuture.map((i) => ({ ideaId: i.ideaId, entered: i.entry.sessionDate })) });
    const soldLater = ideas.flatMap((i) => (i?.ledger?.saleReceipts || []).filter((s) => s.sessionDate > session).map((s) => ({ ideaId: i.ideaId, symbol: s.symbol, sold: s.sessionDate })));
    if (soldLater.length > 0) throw new PracticeFieldError('sale_filled_after_unclosed_session', { session, sales: soldLater });

    // B-STAMP (Astra T1A-03): THE stored close snapshot of the session, read here. A REQUESTED date with no document
    // writes no row — and nothing is built or fetched to make one. A MISSED session with no document is unobserved.
    const key = closeSnapshotKeyFor(session);
    const snapshotSnap = await tx.get(db.collection(SNAPSHOT_COLLECTION).doc(key));
    if (!snapshotSnap.exists && !catchUp) return { closed: false, skipped: 'valuation_missed', alerts };
    const closeSnapshot = snapshotSnap.exists ? snapshotSnap.data() : null;
    if (closeSnapshot && (closeSnapshot.tickKey !== key || closeSnapshot.sessionDate !== session)) {
      throw new PracticeFieldError('close_snapshot_key_mismatch', { expected: key, got: closeSnapshot?.tickKey ?? null, sessionDate: closeSnapshot?.sessionDate ?? null });
    }
    const observed = closeSnapshot !== null;
    const snapshotMeta = observed ? { key, builtAt: toIso(closeSnapshot.builtAt) } : { key: null, builtAt: null };
    const actionsBySymbol = observed ? caActionsBySymbol(closeSnapshot) : {};

    // Reject, never repair (Astra T1A-02): the close re-marks every position and recomputes the equity, so a book
    // that is inconsistent AS READ would otherwise be overwritten into one that passes. It is refused here instead.
    assertReconciled(book, ideas);
    const coverageSnap = ideas.length > 0 ? await tx.get(coverageDocRef) : null;
    let coverageData = coverageSnap?.exists ? coverageSnap.data() : null;
    let coverageWrite = false;

    // 0. Entry timeouts: the start session is over and nothing filled. The reservation returns; nothing was bought.
    let working = book;
    const nextIdeas = new Map(ideas.map((i) => [i.ideaId, i]));
    const cancelled = [];
    for (const idea of ideas.filter((i) => i.status === IDEA_STATUS.ACCEPTED && i.contract.schedule.startSession <= session)) {
      const rel = planRelease({ book: working, idea, coverageData, reason: CANCEL_REASON.ENTRY_TIMEOUT, nowIso });
      working = rel.nextBook;
      coverageData = rel.nextCoverage;
      coverageWrite = true;
      nextIdeas.set(idea.ideaId, rel.nextIdea);
      cancelled.push(idea.ideaId);
    }

    // 1–5. Each filled idea: actions, marks, lines, row — and its endpoint when it is due or holds nothing.
    const sinceDate = book.execState?.lastCloseKey ?? null;
    let positions = { ...(working.portfolio.positions || {}) };
    let bookCash = working.portfolio.cash;
    const ideaRows = {};
    const endpoints = {};
    const resulted = [];
    const bookActionDocs = [];
    const frozenBookSymbols = new Set();
    let allFullQuality = observed;
    for (const idea of ideas) {
      if (!FILLED_IDEA_STATUSES.includes(idea.status)) continue;
      const heldByOthers = new Set(Object.entries(positions).filter(([, p]) => p?.ideaId !== idea.ideaId).map(([sym]) => sym));
      const out = closeFilledIdea(idea, { date: session, closeSnapshot, actionsBySymbol, heldByOthers, sinceDate, snapshotMeta, nowIso, catchUp });
      nextIdeas.set(idea.ideaId, out.nextIdea);
      ideaRows[idea.ideaId] = out.row;
      alerts.push(...out.alerts);
      if (!out.row.fullQuality) allFullQuality = false;
      for (const sym of out.ownFrozen) frozenBookSymbols.add(sym);
      // Mirror the idea's OWN applied actions onto the book's positions and cash — an independent application of
      // the same action, which the reconciliation below then compares with the idea's ledger. The list is the
      // ledger's deduplicated one (Astra T1A-01): one application per action id, never one per feed row. A delisting
      // is in it only with its cash amount (ledger.js): the engine's forced close at a mark is never reached.
      for (const action of out.ownApplied) {
        const applied = applyCorporateAction({ positions, cash: bookCash }, action);
        if (!applied.ok) throw new PracticeFieldError('book_action_not_applied', { ideaId: idea.ideaId, actionId: action.actionId, reason: applied.reason });
        positions = applied.positions;
        bookCash = applied.cash;
        bookActionDocs.push([bookRef.collection('corporateActions').doc(action.actionId), {
          ...buildCorporateAction({
            actionId: action.actionId, type: action.type, ticker: action.ticker, ratio: action.ratio ?? null,
            amount: action.amount ?? null, appliedAt: now, source: action.source ?? null,
          }),
          effectiveDate: action.effectiveDate,
          ideaId: idea.ideaId,
          note: applied.note,
        }]);
      }
      if (out.endpointRow) endpoints[idea.ideaId] = out.endpointRow;
      const ideaRefKey = coverageRef(idea.bookId, idea.ideaId);
      if (out.resolved) {
        // E2, E14: the idea is out of the open set — its cash is the treasury's again, its slot and coverage are free.
        working = {
          ...working,
          treasury: { ...working.treasury, unreservedCash: fromCents(toCents(working.treasury.unreservedCash) + out.returnedCents) },
          slots: { ...working.slots, [idea.contract.slot]: working.slots?.[idea.contract.slot] === idea.ideaId ? null : working.slots?.[idea.contract.slot] ?? null },
          openIdeaIds: (working.openIdeaIds || []).filter((id) => id !== idea.ideaId),
        };
        coverageData = coverageWithoutRef(coverageData, ideaRefKey, nowIso);
        coverageWrite = true;
        resulted.push(idea.ideaId);
      } else if (out.coverageChanged) {
        // E11: a renamed symbol is what the idea needs a price for from now on.
        coverageData = coverageWithRef(coverageData, ideaRefKey, ideaCoveragePlanFromLedgers(out.nextIdea), nowIso);
        coverageWrite = true;
      }
    }

    // The book's own marks, from the SAME snapshot, written back onto its positions. An unobserved session marks
    // nothing: the positions stay exactly as they were.
    const markingSnapshot = observed && frozenBookSymbols.size > 0 ? snapshotExcluding(closeSnapshot, frozenBookSymbols) : closeSnapshot;
    const bookMark = markBook(positions, bookCash, markingSnapshot);
    const nextPositions = {};
    for (const [sym, pos] of Object.entries(positions)) {
      const m = bookMark.marked[sym];
      if (!m || !observed) { nextPositions[sym] = pos; continue; }
      const fresh = m.markSource === 'snapshot';
      const q = fresh ? closeMarkQuality(closeSnapshot.symbols?.[sym] ?? null, session) : { quality: MARK_QUALITY.CARRIED_FORWARD, vendorTimeIso: null };
      if (q.quality !== MARK_QUALITY.VENDOR_TIME) allFullQuality = false;
      nextPositions[sym] = {
        ...pos,
        lastMark: m.mark,
        lastMarkAsOf: fresh ? (q.vendorTimeIso ?? pos.lastMarkAsOf ?? null) : (pos.lastMarkAsOf ?? null),
        lastMarkSource: fresh ? 'snapshot' : m.markSource,
      };
    }

    const openIdeas = (working.openIdeaIds || []).map((id) => nextIdeas.get(id));
    // BUILD_RULES §9 (review L1-6) on the ONE basis (ledger.js markedEquityCents, Astra T1A-02): the book's positions
    // value is the SUM of its ideas' holdings at the marks this close just wrote on them — each idea's row's
    // `markedHoldingsValue` — so the book's row and its ideas' rows can never disagree by a cent. The raw mark of the
    // book's own positions — an independent valuation of the same shares from the same snapshot — sits beside it and
    // must agree to within one rounding per idea.
    const equity = markedEquityCents(working.treasury.unreservedCash, openIdeas);
    const treasuryCash = fromCents(equity.treasuryCents);
    const reservedCash = fromCents(equity.cashCents);
    const markedPositionsValue = fromCents(equity.holdingsCents);
    if (Math.abs(equity.holdingsCents - toCents(roundUsd(bookMark.positionsValue))) > Object.keys(ideaRows).length) {
      throw new PracticeFieldError('book_marks_disagree_with_ideas', { ideas: equity.holdingsCents, book: toCents(roundUsd(bookMark.positionsValue)) });
    }
    const markedEquity = fromCents(equity.equityCents);
    const costsToDateUsd = roundUsd(working.portfolio.frictionPaidCum || 0);

    const nextBook = {
      ...working,
      portfolio: { ...working.portfolio, positions: nextPositions, cash: roundUsd(bookCash), totalValue: markedEquity },
      revision: (working.revision || 0) + 1,
    };
    // 6. Reconcile BEFORE anything is written.
    assertReconciled(nextBook, openIdeas);

    const row = {
      schemaVersion: MANDATE_SCHEMA_VERSION,
      kind: IDEA_BOOK_KIND,
      rowKind: 'valuation',
      basis: 'mark',
      label: observed ? VALUATION_LABEL : VALUATION_LABEL_UNOBSERVED,
      date: session,
      closeSnapshotKey: snapshotMeta.key,
      closeSnapshotBuiltAt: snapshotMeta.builtAt,
      markedEquity,
      treasuryCash,
      reservedCash,
      markedPositionsValue,
      costsToDateUsd,
      positionCount: Object.keys(nextPositions).length,
      openIdeaIds: [...(working.openIdeaIds || [])],
      raw: { markedEquity: bookMark.totalValue, markedPositionsValue: bookMark.positionsValue },
      fullQuality: allFullQuality,
      observed,
    };
    if (catchUp) row.caughtUpAt = nowIso;

    // Commit.
    for (const [ref, doc] of bookActionDocs) tx.set(ref, doc);
    for (const [ideaId, next] of nextIdeas) {
      const prior = ideas.find((i) => i.ideaId === ideaId);
      if (next !== prior) tx.set(bookRef.collection('ideas').doc(ideaId), next);
    }
    for (const [ideaId, ideaRow] of Object.entries(ideaRows)) {
      tx.set(bookRef.collection('ideas').doc(ideaId).collection('rows').doc(session), ideaRow);
    }
    // CREATE-ONCE (build prompt §6; contract §10): an idea has one endpoint. A second one aborts the whole close.
    for (const [ideaId, endpointRow] of Object.entries(endpoints)) {
      tx.create(bookRef.collection('ideas').doc(ideaId).collection('rows').doc('endpoint'), endpointRow);
    }
    tx.set(bookRef.collection('dailyRows').doc(session), row);
    if (coverageWrite) tx.set(coverageDocRef, coverageData);
    const bookPatch = {
      portfolio: nextBook.portfolio,
      treasury: nextBook.treasury,
      slots: nextBook.slots,
      openIdeaIds: nextBook.openIdeaIds,
      revision: nextBook.revision,
      'health.lastCloseAttemptAt': now,
      'health.consecutiveCloseFailures': 0,
      'execState.lastCloseKey': session,
    };
    // An unobserved session marked nothing: the last-mark time stays where the last real mark left it.
    if (observed) bookPatch['health.lastCloseMarkAt'] = now;
    tx.update(bookRef, bookPatch);
    return { closed: true, session, catchUp, observed, row, ideaRows, endpoints, cancelled, resulted, alerts };
  });
}

/**
 * CATCH UP every session this book missed BEFORE `before`, in order, each from its own stored close snapshot (E12) —
 * and close nothing else. The idea-book pass calls it at every window, before any sale or entry (sessions.js: nothing
 * moves past an unclosed session). `complete` is true only when no session before `before` is left unclosed.
 *
 * @returns {Promise<{ complete: boolean, skipped?: string, caughtUp: Array<{ date: string, observed: boolean }>,
 *                     cancelled: string[], resulted: string[], alerts: string[] }>}
 */
export async function catchUpIdeaBook(db, bookRef, { before, now = new Date() } = {}) {
  if (!db || !bookRef) throw new Error('catchUpIdeaBook: db and bookRef required');
  if (typeof before !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(before)) throw new Error('catchUpIdeaBook: before required');
  const out = { complete: false, caughtUp: [], cancelled: [], resulted: [], alerts: [] };
  // 'off': no Practice Field code path runs, whoever calls. Before any read.
  if (!practiceFieldLive()) return { ...out, skipped: 'practice_field_off' };
  for (;;) {
    const res = await closeNextSession(db, bookRef, { date: before, now, catchUpOnly: true });
    out.alerts.push(...(res.alerts || []));
    out.cancelled.push(...(res.cancelled || []));
    out.resulted.push(...(res.resulted || []));
    if (!res.closed) return { ...out, complete: res.skipped === 'nothing_to_catch_up', skipped: res.skipped };
    out.caughtUp.push({ date: res.session, observed: res.observed });
    if (!res.observed) out.alerts.push(`PRACTICE_FIELD_SESSION_UNOBSERVED ${bookRef.id} ${res.session} — no stored close snapshot; the session is recorded as unobserved`);
    if (out.caughtUp.length >= CATCH_UP_MAX_SESSIONS_PER_CALL) return { ...out, skipped: 'catch_up_incomplete' };
  }
}

/**
 * Close one idea book for `date`, valued from THE stored close snapshot of that date (`mandateUniverseSnapshots/
 * {date}_close`), which this function reads itself. It takes no snapshot argument (Astra T1A-03). Sessions the book
 * missed before `date` are closed first, in order, each from its own stored snapshot (E12).
 *
 * @returns {Promise<{ closed: boolean, skipped?: string, row?: object, ideaRows?: object, endpoints?: object,
 *                     cancelled?: string[], resulted?: string[], caughtUp: Array<{ date: string, observed: boolean }>, alerts: string[] }>}
 */
export async function closeIdeaBook(db, bookRef, { date, now = new Date() } = {}) {
  if (!db || !bookRef) throw new Error('closeIdeaBook: db and bookRef required');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('closeIdeaBook: date required');
  // 'off': no Practice Field code path runs, whoever calls. Before any read.
  if (!practiceFieldLive()) return { closed: false, skipped: 'practice_field_off', alerts: [] };

  const caughtUp = [];
  const alerts = [];
  const cancelled = [];
  const resulted = [];
  for (;;) {
    const res = await closeNextSession(db, bookRef, { date, now });
    alerts.push(...(res.alerts || []));
    cancelled.push(...(res.cancelled || []));
    resulted.push(...(res.resulted || []));
    if (res.closed && res.session === date) return { ...res, cancelled, resulted, caughtUp, alerts };
    if (!res.closed) {
      // A refusal says only what it refused — plus whatever sessions this call caught up before it.
      return caughtUp.length > 0 ? { ...res, cancelled, resulted, caughtUp, alerts } : { ...res, alerts };
    }
    caughtUp.push({ date: res.session, observed: res.observed });
    if (!res.observed) alerts.push(`PRACTICE_FIELD_SESSION_UNOBSERVED ${bookRef.id} ${res.session} — no stored close snapshot; the session is recorded as unobserved`);
    // A bound on one call's work, never on the catch-up: the next fire continues from where this one stopped.
    if (caughtUp.length >= CATCH_UP_MAX_SESSIONS_PER_CALL) return { closed: false, skipped: 'catch_up_incomplete', cancelled, resulted, caughtUp, alerts };
  }
}
