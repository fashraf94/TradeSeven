// api/_utils/practiceField/close.js
//
// Practice Field T1a-1 — THE IDEA-BOOK CLOSE: valuation, every session (build prompt §7, §7a requirements 2 and 3;
// acceptance cases B-RECON, B-OWNED, B-MARK, B-STAMP). Dispatched from the engine's close sweep for a book of kind
// `idea_book`; a quarterly book still goes to closeBook, unchanged.
//
// A VALUATION IS A MARK, NEVER A SALE (B-MARK). This pass writes NO decision record and NO fill receipt, changes no
// ledger's cash except by a dividend, and moves nothing from a ledger to the treasury. Every row it writes says
// `basis: 'mark'` and names its figures as marks (`markedValue`, `markedGapUsd`). No function here turns a marked
// value into cash. (The one cash movement besides a dividend is the return of an UNFILLED reservation when an idea
// times out before its first fill — a reservation, not a value.)
//
// ONE SNAPSHOT PER DATE (B-STAMP). The engine builds one close snapshot per date at `${date}_close` and every fire
// and page reads that stored document before building (api/cron/mandate-evaluate.js runCloseSweep;
// mandateUniverseSnapshot.js createOrAdopt — the first commit wins and a loser adopts it). This pass REFUSES any
// snapshot whose key is not exactly `${date}_close`, marks every ledger of the book from that one document, and
// stores its key and build time on every row. It fetches nothing of its own: a held symbol the snapshot lacks is a
// carried mark (`fullQuality: false`), and a missing snapshot writes no row and answers `valuation_missed`
// (recovery is T1a-2).
//
// IN ONE TRANSACTION, idempotent per date (`execState.lastCloseKey`):
//   0. an `accepted` idea whose start session has passed without a fill is cancelled `entry_timeout`;
//   1. CORPORATE ACTIONS from the daily layer, through the engine's pure functions, applied ONCE to each ledger —
//      the idea's, its comparison's, its SPY line's — and, for the idea's own holdings, to the book's positions
//      too. A split moves quantities and the line's level by the same ratio; a dividend credits the cash of
//      whichever ledger holds the shares;
//   2. MARKS from the close snapshot for every ledger, each with its quality;
//   3. ROWS: the book's `dailyRows/{date}` and each holding idea's `ideas/{ideaId}/rows/{date}`;
//   4. RECONCILIATION before anything is written.
// Line exits, settlement, results, cutoffs and recovery are T1a-2. Nothing exits here.

import { buildCorporateAction } from '../mandateSchema.js';
import { applyCorporateAction } from '../mandateCorporateActions.js';
import { caActionsBySymbol, snapshotExcluding } from '../mandateUniverseSnapshot.js';
import { markBook } from '../mandateValuation.js';
import { roundUsd } from '../mandateRounding.js';
import { MANDATE_SCHEMA_VERSION } from '../mandateConfig.js';
import { isIdeaBook, IDEA_BOOK_KIND } from '../mandateBookKind.js';
import {
  IDEA_SCHEMA_VERSION, IDEA_STATUS, CANCEL_REASON, VALUATION_LABEL, MARK_QUALITY,
} from './constants.js';
import { PracticeFieldError } from './errors.js';
import { practiceFieldLive } from './mode.js';
import { applyLedgerActions, valueLedger, withCloseMarks, suspectedActionSymbols } from './ledger.js';
import { closeMarkQuality } from './marks.js';
import { planRelease } from './admission.js';
import { coverageRefOf } from './coverage.js';
import { assertReconciled } from './reconcile.js';
import { toCents, fromCents, addUsd } from './money.js';

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

/**
 * One holding idea at the close: actions applied to its three ledgers, each valued, and its row.
 * Pure. Returns the next idea document, the row, and what the book must mirror.
 */
function closeHoldingIdea(idea, { date, closeSnapshot, actionsBySymbol, sinceDate, snapshotMeta }) {
  // 1. Corporate actions, once per ledger.
  const own = applyLedgerActions(idea.ledger, actionsBySymbol, { date });
  const cmp = applyLedgerActions(idea.comparisonLedger, actionsBySymbol, { date });
  const spy = applyLedgerActions(idea.spyLedger, actionsBySymbol, { date });

  // A split moves the line's level by the same ratio as the quantity (a price is per share).
  let lines = idea.lines;
  for (const change of own.shareBasisChanges) {
    lines = lines.map((l) => (l.symbol === change.ticker
      ? { ...l, level: l.level / change.ratio, adjustments: [...(l.adjustments || []), { actionId: change.actionId, ratio: change.ratio, appliedOn: date }] }
      : l));
  }

  // 2. Marks. A symbol with an unresolved or suspected action is valued at its carried mark.
  const value = (ledger, unresolved) => {
    const frozen = new Set([...unresolved, ...suspectedActionSymbols(ledger, closeSnapshot, actionsBySymbol, { sinceDate, date })]);
    return { valuation: valueLedger(ledger, closeSnapshot, { sessionDate: date, frozen }), frozen };
  };
  const ownV = value(own.ledger, own.unresolved);
  const cmpV = value(cmp.ledger, cmp.unresolved);
  const spyV = value(spy.ledger, spy.unresolved);

  const nextIdea = {
    ...idea,
    ledger: withCloseMarks(own.ledger, ownV.valuation),
    comparisonLedger: withCloseMarks(cmp.ledger, cmpV.valuation),
    spyLedger: withCloseMarks(spy.ledger, spyV.valuation),
    lines,
    lastValuedOn: date,
    revision: (idea.revision || 0) + 1,
  };

  // 3. The row. The gap is computed from the ROUNDED, displayed values (BUILD_RULES §9); raw values sit beside.
  const valueCents = toCents(ownV.valuation.markedValue);
  const comparisonCents = toCents(cmpV.valuation.markedValue);
  const spyCents = toCents(spyV.valuation.markedValue);
  const reservedCents = toCents(idea.contract.capitalUsd);
  const row = {
    schemaVersion: IDEA_SCHEMA_VERSION,
    rowKind: 'valuation',
    basis: 'mark',
    label: VALUATION_LABEL,
    date,
    ideaId: idea.ideaId,
    bookId: idea.bookId,
    closeSnapshotKey: snapshotMeta.key,
    closeSnapshotBuiltAt: snapshotMeta.builtAt,
    reservedCapitalUsd: idea.contract.capitalUsd,
    markedValue: ownV.valuation.markedValue,
    cash: ownV.valuation.cash,
    markedHoldingsValue: ownV.valuation.markedHoldingsValue,
    quantities: quantitiesOf(own.ledger),
    marks: marksOf(ownV.valuation),
    cumulativeCostsUsd: own.ledger.costsPaidUsd,
    dividendsToDateUsd: own.ledger.dividendsUsd,
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
    fullQuality: ownV.valuation.fullQuality && cmpV.valuation.fullQuality && spyV.valuation.fullQuality,
    // False when a leg entered at the friction model's widest tier for want of a market cap (review L3-2): the gap then
    // carries a cost difference that is not the idea's doing. `fullQuality` keeps its own meaning (marks only).
    entryCostTiersKnown: (idea.entry?.unknownCostTierLegs || []).length === 0,
  };

  const alerts = [];
  for (const [name, set] of [['idea', ownV.frozen], ['comparison', cmpV.frozen], ['spy', spyV.frozen]]) {
    for (const sym of set) alerts.push(`PRACTICE_FIELD_MARK_HELD_BACK ${idea.ideaId} ${name} ${sym} — unresolved or suspected corporate action; valued at its carried mark`);
  }
  return { nextIdea, row, ownApplied: own.applied, ownFrozen: ownV.frozen, alerts };
}

/**
 * Close one idea book for `date`.
 *
 * @returns {Promise<{ closed: boolean, skipped?: string, row?: object, ideaRows?: object, cancelled?: string[], alerts: string[] }>}
 */
export async function closeIdeaBook(db, bookRef, { date, closeSnapshot, now = new Date() } = {}) {
  if (!db || !bookRef) throw new Error('closeIdeaBook: db and bookRef required');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('closeIdeaBook: date required');
  // 'off': no Practice Field code path runs, whoever calls. Before any read.
  if (!practiceFieldLive()) return { closed: false, skipped: 'practice_field_off', alerts: [] };
  // B-STAMP: no snapshot, no row — and nothing fetched to make one.
  if (!closeSnapshot) return { closed: false, skipped: 'valuation_missed', alerts: [] };
  const key = closeSnapshotKeyFor(date);
  if (closeSnapshot.tickKey !== key || closeSnapshot.sessionDate !== date) {
    throw new PracticeFieldError('close_snapshot_key_mismatch', { expected: key, got: closeSnapshot.tickKey ?? null });
  }
  const nowIso = now.toISOString();
  const snapshotMeta = { key, builtAt: toIso(closeSnapshot.builtAt) };
  const actionsBySymbol = caActionsBySymbol(closeSnapshot);
  const coverageDocRef = coverageRefOf(db);

  return db.runTransaction(async (tx) => {
    const alerts = [];
    const bookSnap = await tx.get(bookRef);
    if (!bookSnap.exists) return { closed: false, skipped: 'book_missing', alerts };
    const book = bookSnap.data();
    if (!isIdeaBook(book)) return { closed: false, skipped: 'not_idea_book', alerts };
    if (book.execState?.lastCloseKey === date) return { closed: false, skipped: 'already_closed', alerts };
    // Never backwards (review L1-9): a close for a date before the last one would rewind the marks and the key.
    if (typeof book.execState?.lastCloseKey === 'string' && date < book.execState.lastCloseKey) return { closed: false, skipped: 'out_of_order', alerts };
    if (book.status !== 'active' && book.status !== 'draining') return { closed: false, skipped: 'not_open', alerts };

    const ideas = [];
    for (const id of book.openIdeaIds || []) {
      const snap = await tx.get(bookRef.collection('ideas').doc(id));
      if (!snap.exists) throw new PracticeFieldError('open_idea_missing', { ideaId: id });
      ideas.push(snap.data());
    }
    const timedOut = ideas.filter((i) => i.status === IDEA_STATUS.ACCEPTED && i.contract.schedule.startSession <= date);
    let coverageData = null;
    if (timedOut.length > 0) {
      const coverageSnap = await tx.get(coverageDocRef);
      coverageData = coverageSnap.exists ? coverageSnap.data() : null;
    }

    // 0. Entry timeouts: the start session is over and nothing filled. The reservation returns; nothing was bought.
    let working = book;
    const nextIdeas = new Map(ideas.map((i) => [i.ideaId, i]));
    const cancelled = [];
    for (const idea of timedOut) {
      const rel = planRelease({ book: working, idea, coverageData, reason: CANCEL_REASON.ENTRY_TIMEOUT, nowIso });
      working = rel.nextBook;
      coverageData = rel.nextCoverage;
      nextIdeas.set(idea.ideaId, rel.nextIdea);
      cancelled.push(idea.ideaId);
    }

    // 1–3. Each holding idea: actions, marks, row.
    const sinceDate = book.execState?.lastCloseKey ?? null;
    let positions = { ...(working.portfolio.positions || {}) };
    let bookCash = working.portfolio.cash;
    const ideaRows = {};
    const bookActionDocs = [];
    const frozenBookSymbols = new Set();
    let allFullQuality = true;
    for (const idea of ideas) {
      if (idea.status !== IDEA_STATUS.HOLDING) continue;
      const out = closeHoldingIdea(idea, { date, closeSnapshot, actionsBySymbol, sinceDate, snapshotMeta });
      nextIdeas.set(idea.ideaId, out.nextIdea);
      ideaRows[idea.ideaId] = out.row;
      alerts.push(...out.alerts);
      if (!out.row.fullQuality) allFullQuality = false;
      for (const sym of out.ownFrozen) frozenBookSymbols.add(sym);
      // Mirror the idea's OWN applied actions onto the book's positions and cash — an independent application of
      // the same action, which the reconciliation below then compares with the idea's ledger.
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
    }

    // The book's own marks, from the SAME snapshot, written back onto its positions.
    const markingSnapshot = frozenBookSymbols.size > 0 ? snapshotExcluding(closeSnapshot, frozenBookSymbols) : closeSnapshot;
    const bookMark = markBook(positions, bookCash, markingSnapshot);
    const nextPositions = {};
    for (const [sym, pos] of Object.entries(positions)) {
      const m = bookMark.marked[sym];
      if (!m) { nextPositions[sym] = pos; continue; }
      const fresh = m.markSource === 'snapshot';
      const q = fresh ? closeMarkQuality(closeSnapshot.symbols?.[sym] ?? null, date) : { quality: MARK_QUALITY.CARRIED_FORWARD, vendorTimeIso: null };
      if (q.quality !== MARK_QUALITY.VENDOR_TIME) allFullQuality = false;
      nextPositions[sym] = {
        ...pos,
        lastMark: m.mark,
        lastMarkAsOf: fresh ? (q.vendorTimeIso ?? pos.lastMarkAsOf ?? null) : (pos.lastMarkAsOf ?? null),
        lastMarkSource: fresh ? 'snapshot' : m.markSource,
      };
    }

    const openIdeas = (working.openIdeaIds || []).map((id) => nextIdeas.get(id));
    const treasuryCash = roundUsd(working.treasury.unreservedCash);
    const reservedCash = fromCents(openIdeas.reduce((sum, i) => sum + toCents(i.ledger.cash), 0));
    // BUILD_RULES §9 (review L1-6): the book's positions value is the SUM of its ideas' displayed holdings values, so
    // the book's row and its ideas' rows can never disagree by a cent. The raw mark of the book's own positions —
    // an independent valuation of the same shares from the same snapshot — sits beside it and must agree to within
    // one rounding per idea.
    const markedPositionsValue = fromCents(Object.values(ideaRows).reduce((sum, r) => sum + toCents(r.markedHoldingsValue), 0));
    if (Math.abs(toCents(markedPositionsValue) - toCents(roundUsd(bookMark.positionsValue))) > Object.keys(ideaRows).length) {
      throw new PracticeFieldError('book_marks_disagree_with_ideas', { ideas: toCents(markedPositionsValue), book: toCents(roundUsd(bookMark.positionsValue)) });
    }
    const markedEquity = addUsd(treasuryCash, reservedCash, markedPositionsValue);
    const costsToDateUsd = roundUsd(working.portfolio.frictionPaidCum || 0);

    const nextBook = {
      ...working,
      portfolio: { ...working.portfolio, positions: nextPositions, cash: roundUsd(bookCash), totalValue: markedEquity },
      revision: (working.revision || 0) + 1,
    };
    // 4. Reconcile BEFORE anything is written.
    assertReconciled(nextBook, openIdeas);

    const row = {
      schemaVersion: MANDATE_SCHEMA_VERSION,
      kind: IDEA_BOOK_KIND,
      rowKind: 'valuation',
      basis: 'mark',
      label: VALUATION_LABEL,
      date,
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
    };

    // Commit.
    for (const [ref, doc] of bookActionDocs) tx.set(ref, doc);
    for (const [ideaId, next] of nextIdeas) {
      const prior = ideas.find((i) => i.ideaId === ideaId);
      if (next !== prior) tx.set(bookRef.collection('ideas').doc(ideaId), next);
    }
    for (const [ideaId, ideaRow] of Object.entries(ideaRows)) {
      tx.set(bookRef.collection('ideas').doc(ideaId).collection('rows').doc(date), ideaRow);
    }
    tx.set(bookRef.collection('dailyRows').doc(date), row);
    if (cancelled.length > 0) tx.set(coverageDocRef, coverageData);
    tx.update(bookRef, {
      portfolio: nextBook.portfolio,
      treasury: nextBook.treasury,
      slots: nextBook.slots,
      openIdeaIds: nextBook.openIdeaIds,
      revision: nextBook.revision,
      'health.lastCloseMarkAt': now,
      'health.lastCloseAttemptAt': now,
      'health.consecutiveCloseFailures': 0,
      'execState.lastCloseKey': date,
    });
    return { closed: true, row, ideaRows, cancelled, alerts };
  });
}
