// api/_utils/practiceField/entry.js
//
// Practice Field T1a-1 — BASKET ENTRY, BY CODE, MATCHED ON BOTH SIDES (concept V6.1 §2 "code enters, exits and
// settles; the model manages", ruling 13; shared contract V2 §4.3; build prompt §6; acceptance cases B-ENTER,
// B-FILL, B-NOFILL). The eval handler's idea-book pass calls `runIdeaBookEntryPass` at each entry slot
// (windows.js). It makes NO model call and touches no model counter.
//
// FOR EACH `accepted` IDEA, in one transaction:
//   • before its start session — nothing;
//   • after its start session — it is cancelled `entry_timeout` and its reservation returns to the treasury. The
//     decision is by SESSION DATE, never by "a pass ran": a missed fire can never turn into a late entry (concept
//     §8 "an outage never extends an idea");
//   • in its start session — ALL-OR-NOTHING: every name, every comparison symbol and SPY must have an ELIGIBLE
//     mark (marks.js) in this slot's snapshot, or NEITHER SIDE BUYS and the idea waits for the next slot. At the
//     session's last entry slot a failed attempt is the timeout.
//
// WHEN IT FILLS, one snapshot prices everything:
//   the idea's side     each name's planned dollars (whole cents, contract.js) bought through executeIdeaFill on
//                       the idea's own ledger; the SAME fills are booked into the book's portfolio from their
//                       receipts (cash down by each cost, a position per name stamped with the idea's id), so the
//                       two are independent records of one fill and reconcile.js compares them;
//   the comparison      a separate paper ledger, same reserved capital, same snapshot, same cost policy (a stock's
//                       tier for stocks, the fund's explicit tier for a fund). `same_stock_held` is the idea's own
//                       ledger copied — quantities, basis, costs, residual cash — so an idea that never trades
//                       ties it to the cent;
//   SPY                 a third paper ledger, built the same way;
//   the lines           frozen at fill: level = the name's fill price × (1 − distancePct), in the idea record's
//                       invalidation shape `{ symbol, side: 'below', level, basis: 'daily_close' }`;
//   the inception row   `ideas/{ideaId}/rows/inception`: reserved capital before costs, the snapshot's key and the
//                       vendor times, each leg's fill, costs paid, and every ledger's opening value;
//   decisions           one `decisions/{id}` receipt per name, `origin: 'basket_entry'`, no reason (code decided);
//   coverage            the names move from `pending` to `held`.
// The book is reconciled before anything is written; any invariant failure aborts the whole transaction.

import { buildDecision } from '../mandateSchema.js';
import { markBook } from '../mandateValuation.js';
import { roundUsd } from '../mandateRounding.js';
import { MANDATE_FRICTION_MODEL_VERSION } from '../mandateConfig.js';
import { isIdeaBook } from '../mandateBookKind.js';
import { PRACTICE_FIELD_BENCHMARK_SYMBOL } from '../../../src/data/practiceFieldFunds.js';
import {
  IDEA_SCHEMA_VERSION, IDEA_STATUS, CANCEL_REASON, DECISION_ORIGIN_BASKET_ENTRY, PRACTICE_FIELD_CONTRACT_VERSION,
} from './constants.js';
import { PracticeFieldError, isPracticeFieldError } from './errors.js';
import { practiceFieldLive } from './mode.js';
import { eligibleMark } from './marks.js';
import { executeIdeaFill } from './fills.js';
import { newLedger, mirrorLedger, LEDGER_KIND } from './ledger.js';
import { planLegCents, planBasketCents } from './contract.js';
import { mandateSectorOf, classificationOf } from './symbols.js';
import { ideaEntrySlots, isLastIdeaEntrySlot } from './windows.js';
import { planRelease } from './admission.js';
import { coverageRefOf, coverageRef, ideaCoveragePlan, coverageWithRef } from './coverage.js';
import { recordedEquityUsd } from './ideaBook.js';
import { assertReconciled } from './reconcile.js';
import { toCents, fromCents, addUsd } from './money.js';

const LOG_PREFIX = '[PracticeFieldEntry]';

/** The deterministic decision id of one basket-entry leg. */
export function entryDecisionId(ideaId, symbol) {
  return `${ideaId}__entry__${symbol}`;
}

/** Every symbol an idea needs a price for at entry: its names, its comparison's symbols and SPY. */
export function entrySymbols(contract) {
  return [...new Set([...contract.names, ...contract.comparison.symbols, PRACTICE_FIELD_BENCHMARK_SYMBOL])];
}

/** The marked value of a ledger at the snapshot it just filled from (its opening value). */
function openingMarkedValue(ledger, snapshot) {
  const v = markBook(ledger.holdings, ledger.cash, snapshot);
  return addUsd(roundUsd(ledger.cash), roundUsd(v.positionsValue));
}

/**
 * Fill a paper ledger (a comparison or SPY) with `legs` (symbol → whole cents), all from one snapshot.
 * @returns {{ ledger: object, receipts: Array<object> }}
 */
function fillPaperLedger(kind, capitalUsd, legs, { snapshot, notBeforeIso, sessionDate }) {
  let ledger = newLedger(kind, capitalUsd);
  const receipts = [];
  for (const [symbol, cents] of Object.entries(legs)) {
    const out = executeIdeaFill({
      ledger, verb: 'BUY', symbol, sizeUsd: fromCents(cents), snapshot, notBeforeIso, sessionDate, sector: classificationOf(symbol),
    });
    ledger = out.ledger;
    receipts.push(out.receipt);
  }
  return { ledger, receipts };
}

/**
 * The pure core of one entry: every ledger filled from one snapshot, or a PracticeFieldError. Nothing is written.
 *
 * @returns {{ ledger, comparisonLedger, spyLedger, receipts: { idea, comparison, spy }, lines, startMarkAt }}
 */
export function computeBasketEntry({ idea, snapshot, sessionDate }) {
  const contract = idea.contract;
  const notBeforeIso = idea.admittedAt;
  const capitalCents = toCents(contract.capitalUsd);
  const ctx = { snapshot, notBeforeIso, sessionDate };

  // The idea's side.
  let ledger = idea.ledger;
  const ideaReceipts = [];
  for (const [symbol, cents] of Object.entries(planLegCents(contract, capitalCents))) {
    const out = executeIdeaFill({ ledger, verb: 'BUY', symbol, sizeUsd: fromCents(cents), ...ctx, sector: mandateSectorOf(symbol) });
    ledger = out.ledger;
    ideaReceipts.push(out.receipt);
  }

  // The comparison's side: same capital, same snapshot, same cost policy.
  let comparison;
  if (contract.comparison.type === 'same_stock_held') {
    comparison = { ledger: mirrorLedger(LEDGER_KIND.COMPARISON, ledger), receipts: ideaReceipts.map((r) => ({ ...r })) };
  } else if (contract.comparison.type === 'sector_fund') {
    comparison = fillPaperLedger(LEDGER_KIND.COMPARISON, contract.capitalUsd, { [contract.comparison.symbols[0]]: capitalCents }, ctx);
  } else {
    comparison = fillPaperLedger(LEDGER_KIND.COMPARISON, contract.capitalUsd, planBasketCents(contract.comparison.symbols, capitalCents), ctx);
  }

  // SPY, the context line.
  const spy = fillPaperLedger(LEDGER_KIND.SPY, contract.capitalUsd, { [PRACTICE_FIELD_BENCHMARK_SYMBOL]: capitalCents }, ctx);

  // The lines, frozen at fill.
  const lines = contract.lines.map((l) => {
    const r = ideaReceipts.find((x) => x.symbol === l.symbol);
    return {
      symbol: l.symbol, side: 'below', level: r.executedPrice * (1 - l.distancePct), basis: 'daily_close',
      distancePct: l.distancePct, fillPrice: r.executedPrice, entryMark: r.mark, adjustments: [],
    };
  });

  const vendorTimes = [...ideaReceipts, ...comparison.receipts, ...spy.receipts].map((r) => r.markVendorTimeIso).sort();
  return {
    ledger, comparisonLedger: comparison.ledger, spyLedger: spy.ledger,
    receipts: { idea: ideaReceipts, comparison: comparison.receipts, spy: spy.receipts },
    lines, startMarkAt: vendorTimes[0] ?? null,
  };
}

/**
 * One idea, one slot, one transaction.
 *
 * @returns {Promise<{ outcome: 'entered'|'waiting'|'cancelled'|'not_yet'|'not_pending'|'not_found', refusals?: Array<object> }>}
 */
export async function enterIdea(db, { bookRef, ideaId, tick, snapshot, nowIso }) {
  // 'off': no Practice Field code path runs, whoever calls. Before any read.
  if (!practiceFieldLive()) return { outcome: 'practice_field_off' };
  const ideaRef = bookRef.collection('ideas').doc(ideaId);
  const coverageDocRef = coverageRefOf(db);

  return db.runTransaction(async (tx) => {
    const bookSnap = await tx.get(bookRef);
    if (!bookSnap.exists || !isIdeaBook(bookSnap.data())) return { outcome: 'not_found' };
    const book = bookSnap.data();
    const ideaSnap = await tx.get(ideaRef);
    if (!ideaSnap.exists) return { outcome: 'not_found' };
    const idea = ideaSnap.data();
    if (idea.status !== IDEA_STATUS.ACCEPTED) return { outcome: 'not_pending' };

    const { startSession, entryNotBefore } = idea.contract.schedule;
    if (tick.date < startSession || Date.parse(nowIso) < Date.parse(entryNotBefore.iso)) return { outcome: 'not_yet' };

    const others = [];
    for (const id of book.openIdeaIds || []) {
      if (id === ideaId) continue;
      const snap = await tx.get(bookRef.collection('ideas').doc(id));
      if (snap.exists) others.push(snap.data());
    }
    const coverageSnap = await tx.get(coverageDocRef);
    const coverageData = coverageSnap.exists ? coverageSnap.data() : null;

    const cancel = (detail) => {
      const { nextBook, nextIdea, nextCoverage } = planRelease({ book, idea, coverageData, reason: CANCEL_REASON.ENTRY_TIMEOUT, nowIso });
      assertReconciled(nextBook, others);
      tx.set(ideaRef, { ...nextIdea, lastEntryAttempt: detail ?? idea.lastEntryAttempt ?? null });
      tx.update(bookRef, { treasury: nextBook.treasury, slots: nextBook.slots, openIdeaIds: nextBook.openIdeaIds, revision: nextBook.revision });
      tx.set(coverageDocRef, nextCoverage);
      return { outcome: 'cancelled', reason: CANCEL_REASON.ENTRY_TIMEOUT };
    };

    // Past the start session: never a late entry.
    if (tick.date > startSession) return cancel(null);

    // ALL-OR-NOTHING: every symbol must have an eligible mark in THIS snapshot.
    const refusals = [];
    for (const symbol of entrySymbols(idea.contract)) {
      const mark = eligibleMark(snapshot, symbol, { notBeforeIso: idea.admittedAt, sessionDate: tick.date });
      if (!mark.ok) refusals.push({ symbol, refusal: mark.refusal });
    }
    if (refusals.length > 0) {
      const attempt = { tickKey: snapshot?.tickKey ?? tick.tickKey, slot: tick.slot, at: nowIso, refusals };
      if (isLastIdeaEntrySlot(tick.slot)) return { ...cancel(attempt), refusals };
      tx.update(ideaRef, { lastEntryAttempt: attempt });
      return { outcome: 'waiting', refusals };
    }

    // Every leg has an eligible mark: fill both sides (a failure in here aborts the transaction).
    const entry = computeBasketEntry({ idea, snapshot, sessionDate: tick.date });

    // The book's side, booked from the fills' own receipts.
    const positions = { ...(book.portfolio.positions || {}) };
    let bookCashCents = toCents(book.portfolio.cash);
    let frictionCents = toCents(book.portfolio.frictionPaidCum || 0);
    const decisions = [];
    for (const r of entry.receipts.idea) {
      if (Object.hasOwn(positions, r.symbol)) throw new PracticeFieldError('ticker_held_by_other_idea', { symbol: r.symbol, ideaId: positions[r.symbol].ideaId ?? null });
      bookCashCents -= toCents(r.executedSizeUsd);
      frictionCents += toCents(r.friction.frictionPaid);
      positions[r.symbol] = {
        shares: r.shares,
        costBasisTotal: r.executedSizeUsd,
        avgCost: r.executedSizeUsd / r.shares,
        lastMark: r.mark,
        lastMarkAsOf: r.markVendorTimeIso,
        lastMarkSource: 'snapshot',
        sector: mandateSectorOf(r.symbol),
        openedAt: tick.date,
        ideaId, // every position belongs to an idea (direction note ruling 4)
      };
      const decisionId = entryDecisionId(ideaId, r.symbol);
      decisions.push([bookRef.collection('decisions').doc(decisionId), {
        ...buildDecision({
          decisionId, verb: 'BUY', ticker: r.symbol,
          requestedSizeUsd: r.requestedSizeUsd, executedSizeUsd: r.executedSizeUsd, executedShares: r.shares,
          executedPrice: r.executedPrice, realizedPnl: 0, fillMarkQuality: 'fresh', clamped: false,
          friction: r.friction, frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
          baseRevision: book.revision ?? null, submitTickKey: snapshot.tickKey ?? null, harvestTickKey: snapshot.tickKey ?? null,
          status: 'executed',
        }),
        // Outside the engine's builder on purpose: a quarterly decision record keeps exactly its shape.
        kind: 'idea_book',
        origin: DECISION_ORIGIN_BASKET_ENTRY,
        ideaId,
        epochId: idea.contract.epochId,
        contractVersion: PRACTICE_FIELD_CONTRACT_VERSION,
        markVendorTimeIso: r.markVendorTimeIso,
      }]);
    }

    const nextIdea = {
      ...idea,
      status: IDEA_STATUS.HOLDING,
      statusHistory: [...(idea.statusHistory || []), { status: IDEA_STATUS.ENTERING, at: nowIso }, { status: IDEA_STATUS.HOLDING, at: nowIso }],
      ledger: entry.ledger,
      comparisonLedger: entry.comparisonLedger,
      spyLedger: entry.spyLedger,
      lines: entry.lines,
      entry: {
        sessionDate: tick.date, slot: tick.slot, snapshotKey: snapshot.tickKey ?? tick.tickKey,
        filledAt: nowIso, startMarkAt: entry.startMarkAt,
      },
      lastEntryAttempt: null,
      revision: (idea.revision || 0) + 1,
    };
    const nextPortfolio = { ...book.portfolio, positions, cash: fromCents(bookCashCents), frictionPaidCum: fromCents(frictionCents) };
    const nextBook = { ...book, portfolio: nextPortfolio, revision: (book.revision || 0) + 1 };
    nextBook.portfolio.totalValue = recordedEquityUsd(nextBook);
    assertReconciled(nextBook, [...others, nextIdea]);

    const inception = {
      schemaVersion: IDEA_SCHEMA_VERSION,
      rowKind: 'inception',
      basis: 'fill',
      ideaId,
      bookId: idea.bookId,
      sessionDate: tick.date,
      startSnapshotKey: snapshot.tickKey ?? tick.tickKey,
      startSnapshotBuiltAt: snapshot.builtAt ?? null,
      startMarkAt: entry.startMarkAt,
      reservedCapitalUsd: idea.contract.capitalUsd, // before costs
      legs: entry.receipts,
      costsPaidUsd: {
        idea: entry.ledger.costsPaidUsd, comparison: entry.comparisonLedger.costsPaidUsd, spy: entry.spyLedger.costsPaidUsd,
      },
      residualCashUsd: { idea: entry.ledger.cash, comparison: entry.comparisonLedger.cash, spy: entry.spyLedger.cash },
      openingMarkedValue: {
        idea: openingMarkedValue(entry.ledger, snapshot),
        comparison: openingMarkedValue(entry.comparisonLedger, snapshot),
        spy: openingMarkedValue(entry.spyLedger, snapshot),
      },
      origin: idea.contract.origin,
      lines: entry.lines.map(({ symbol, level, distancePct, fillPrice }) => ({ symbol, level, distancePct, fillPrice })),
      writtenAt: nowIso,
    };

    tx.set(ideaRef, nextIdea);
    tx.set(ideaRef.collection('rows').doc('inception'), inception);
    for (const [ref, doc] of decisions) tx.set(ref, doc);
    tx.update(bookRef, { portfolio: nextBook.portfolio, revision: nextBook.revision });
    tx.set(coverageDocRef, coverageWithRef(coverageData, coverageRef(idea.bookId, ideaId), ideaCoveragePlan(idea.contract, { filled: true }), nowIso));
    return { outcome: 'entered', legs: entry.receipts.idea.length };
  });
}

/**
 * The idea-book pass for one book at one eval slot. Per-idea isolation: one idea's failure never blocks another.
 *
 * @returns {Promise<{ served: boolean, entered: number, waiting: number, cancelled: number, errors: number }>}
 */
export async function runIdeaBookEntryPass(db, { bookRef, tick, snapshot, now = new Date() }) {
  const out = { served: false, entered: 0, waiting: 0, cancelled: 0, errors: 0 };
  if (!practiceFieldLive()) return out;
  if (!ideaEntrySlots().includes(tick.slot)) return out;
  const bookSnap = await bookRef.get();
  if (!bookSnap.exists) return out;
  const book = bookSnap.data();
  if (!isIdeaBook(book) || book.status !== 'active') return out;
  out.served = true;
  const nowIso = now.toISOString();
  for (const ideaId of book.openIdeaIds || []) {
    try {
      const res = await enterIdea(db, { bookRef, ideaId, tick, snapshot, nowIso });
      if (res.outcome === 'entered') out.entered += 1;
      else if (res.outcome === 'waiting') out.waiting += 1;
      else if (res.outcome === 'cancelled') out.cancelled += 1;
    } catch (err) {
      out.errors += 1;
      const code = isPracticeFieldError(err) ? err.code : 'error';
      console.error(`${LOG_PREFIX} ${bookRef.id} idea ${ideaId} entry failed at ${tick.tickKey} (${code}): ${err.message}`);
    }
  }
  return out;
}
