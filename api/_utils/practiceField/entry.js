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
//     mark (marks.js) in this slot's snapshot AND a cost tier that can be resolved (Amendment D Q-1: a stock with
//     no market cap on the snapshot is missing data, refused `cost_tier_unknown` — never bought at the widest tier),
//     or NEITHER SIDE BUYS and the idea waits for the next slot. At the session's last entry slot a failed attempt
//     is the timeout, and the timeout names every leg that refused.
//
// THE STORED SNAPSHOT, READ HERE (review FR-A7; T1a-2a §2). The fill reads THE stored slot snapshot,
// `mandateUniverseSnapshots/{tickKey}`, itself, by key, inside its transaction. It takes no snapshot from its caller:
// an object that merely carries the right key can never price a fill. A missing document is no fill this window.
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
// The book is reconciled as read, before anything is decided, and again before anything is written (Astra T1A-02:
// reject, never repair); any invariant failure aborts the whole transaction.

import { buildDecision } from '../mandateSchema.js';
import { markBook } from '../mandateValuation.js';
import { roundUsd } from '../mandateRounding.js';
import { MANDATE_FRICTION_MODEL_VERSION } from '../mandateConfig.js';
import { isIdeaBook } from '../mandateBookKind.js';
import { PRACTICE_FIELD_BENCHMARK_SYMBOL } from '../../../src/data/practiceFieldFunds.js';
import {
  IDEA_SCHEMA_VERSION, IDEA_STATUS, CANCEL_REASON, DECISION_ORIGIN_BASKET_ENTRY, PRACTICE_FIELD_CONTRACT_VERSION, PROCESS_QUALITY,
} from './constants.js';
import { PracticeFieldError, isPracticeFieldError } from './errors.js';
import { practiceFieldLive } from './mode.js';
import { eligibleMark } from './marks.js';
import { executeIdeaFill, resolvedCostTier } from './fills.js';
import { newTrack } from './settlement.js';
import { newLedger, mirrorLedger, LEDGER_KIND, markedEquityCents } from './ledger.js';
import { planLegCents, planBasketCents } from './contract.js';
import { mandateSectorOf, classificationOf } from './symbols.js';
import { ideaEntrySlots, isLastIdeaEntrySlot } from './windows.js';
import { planRelease } from './admission.js';
import { coverageRefOf, coverageRef, ideaCoveragePlan, coverageWithRef } from './coverage.js';
import { assertReconciled } from './reconcile.js';
import { fillSessionRefusal } from './sessions.js';
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
  // Since Amendment D's Q-1 this list is ALWAYS EMPTY: a leg with no resolvable tier does not fill (fills.js refuses
  // it), so no receipt can carry the `unknown` tier. The field stays, empty, because T1a-1's records and rows carry
  // it (a stock with no market cap used to pay the widest tier, and every such leg was named — review L3-2); the
  // close still reads a stored list when it writes `entryCostTiersKnown`.
  const unknownCostTierLegs = [];
  return {
    unknownCostTierLegs,
    ledger, comparisonLedger: comparison.ledger, spyLedger: spy.ledger,
    receipts: { idea: ideaReceipts, comparison: comparison.receipts, spy: spy.receipts },
    lines, startMarkAt: vendorTimes[0] ?? null,
  };
}

/**
 * One idea, one slot, one transaction.
 *
 * @returns {Promise<{ outcome: 'entered'|'waiting'|'cancelled'|'not_yet'|'not_this_session'|'not_pending'|'not_found', refusals?: Array<object> }>}
 */
export async function enterIdea(db, { bookRef, ideaId, tick, nowIso }) {
  // 'off': no Practice Field code path runs, whoever calls. Before any read.
  if (!practiceFieldLive()) return { outcome: 'practice_field_off' };
  if (typeof tick?.tickKey !== 'string' || typeof tick?.date !== 'string') throw new PracticeFieldError('entry_snapshot_mismatch', { tickKey: tick?.tickKey ?? null, snapshotKey: null });
  const ideaRef = bookRef.collection('ideas').doc(ideaId);
  const coverageDocRef = coverageRefOf(db);
  // THE stored slot snapshot of this window (FR-A7). The collection by its literal name, for the protected-store scan.
  const snapshotRef = db.collection('mandateUniverseSnapshots').doc(tick.tickKey);

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
    // Nothing moves past an unclosed session (sessions.js; review RH-1): an entry is refused while a session before
    // its window is unclosed, or when its own session's close is already written. The catch-up — which also times an
    // overdue idea out — runs first in the idea-book pass; this is the guard behind it.
    const sessionRefusal = fillSessionRefusal(book, [...others, idea], tick.date);
    if (sessionRefusal !== null) return { outcome: 'not_this_session', reason: sessionRefusal };
    const coverageSnap = await tx.get(coverageDocRef);
    const coverageData = coverageSnap.exists ? coverageSnap.data() : null;
    // The slot's own stored document, read inside the transaction. It must be THIS slot's (review L3-6): a stored
    // document whose own key or session is another's is refused, never a close snapshot or another slot's.
    const snapshotSnap = await tx.get(snapshotRef);
    const snapshot = snapshotSnap.exists ? snapshotSnap.data() : null;
    if (snapshot && (snapshot.tickKey !== tick.tickKey || snapshot.sessionDate !== tick.date)) {
      throw new PracticeFieldError('entry_snapshot_mismatch', { tickKey: tick.tickKey, snapshotKey: snapshot.tickKey ?? null, sessionDate: snapshot.sessionDate ?? null });
    }
    // Reject, never repair (Astra T1A-02): the book as READ must reconcile before anything is decided. This entry
    // rewrites the book's equity, so a check of the next state alone would overwrite an inconsistent one and pass.
    assertReconciled(book, [...others, idea]);

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

    // ALL-OR-NOTHING: every symbol must have an eligible mark in THIS snapshot — and (Q-1) a cost tier that can be
    // resolved. A stock with no market cap on the snapshot is missing data: the basket waits, as for a missing price.
    const refusals = [];
    for (const symbol of entrySymbols(idea.contract)) {
      if (snapshot === null) { refusals.push({ symbol, refusal: 'no_stored_snapshot' }); continue; }
      const mark = eligibleMark(snapshot, symbol, { notBeforeIso: idea.admittedAt, sessionDate: tick.date });
      if (!mark.ok) { refusals.push({ symbol, refusal: mark.refusal }); continue; }
      if (!resolvedCostTier(symbol, snapshot).known) refusals.push({ symbol, refusal: 'cost_tier_unknown' });
    }
    // A slot that cannot fill: the attempt is recorded and the idea waits — or, at the session's last entry slot, times out.
    const deferOrCancel = (why) => {
      const attempt = { tickKey: tick.tickKey, slot: tick.slot, at: nowIso, refusals: why };
      if (isLastIdeaEntrySlot(tick.slot)) return { ...cancel(attempt), refusals: why };
      tx.update(ideaRef, { lastEntryAttempt: attempt });
      return { outcome: 'waiting', refusals: why };
    };
    if (refusals.length > 0) return deferOrCancel(refusals);

    // Every leg has an eligible mark: fill both sides. Nothing has been written yet, so a leg the engine itself
    // cannot fill (review L1-1) is one more failed attempt, all-or-nothing like a missing mark; any other failure
    // aborts the transaction.
    let entry;
    try {
      entry = computeBasketEntry({ idea, snapshot, sessionDate: tick.date });
    } catch (err) {
      if (isPracticeFieldError(err, 'cost_tier_unknown')) return deferOrCancel([{ symbol: err.detail.symbol, refusal: 'cost_tier_unknown' }]);
      if (!isPracticeFieldError(err, 'fill_refused')) throw err;
      return deferOrCancel([{ symbol: err.detail.symbol, refusal: `fill_refused:${err.detail.reason}` }]);
    }

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
        unknownCostTierLegs: entry.unknownCostTierLegs,
        // What the result's trades line reads (contract §4.4): the entry's legs and what they cost.
        legCount: entry.receipts.idea.length, costsPaidUsd: entry.ledger.costsPaidUsd,
      },
      // Fills after the basket entry: none yet. The same-stock tie (reconcile.js rule 9) holds while this is 0;
      // every later fill (a line exit, a settlement sale) increments it.
      postEntryFillCount: 0,
      // What T1a-2a's lines, sales and result keep on the idea (settlement.js, exits.js).
      unobservedLineSessions: {},
      track: newTrack(),
      processQuality: PROCESS_QUALITY.FOLLOWED_PLAN,
      blockedBy: [],
      waitedSessions: [],
      lastEntryAttempt: null,
      revision: (idea.revision || 0) + 1,
    };
    const nextPortfolio = { ...book.portfolio, positions, cash: fromCents(bookCashCents), frictionPaidCum: fromCents(frictionCents) };
    const nextBook = { ...book, portfolio: nextPortfolio, revision: (book.revision || 0) + 1 };
    // The book's marked equity on the one R-19 basis (ledger.js), the same the close writes and rule 7 checks.
    nextBook.portfolio.totalValue = fromCents(markedEquityCents(book.treasury?.unreservedCash, [...others, nextIdea]).equityCents);
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
      unknownCostTierLegs: entry.unknownCostTierLegs,
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
export async function runIdeaBookEntryPass(db, { bookRef, tick, now = new Date() }) {
  const out = { served: false, entered: 0, waiting: 0, cancelled: 0, errors: 0 };
  if (!practiceFieldLive()) return out;
  if (!ideaEntrySlots().includes(tick.slot)) return out;
  const bookSnap = await bookRef.get();
  if (!bookSnap.exists) return out;
  const book = bookSnap.data();
  // E13: a draining book takes NO entry (its sales, settlement and valuation are served by their own passes).
  if (!isIdeaBook(book) || book.status !== 'active') return out;
  out.served = true;
  const nowIso = now.toISOString();
  for (const ideaId of book.openIdeaIds || []) {
    try {
      const res = await enterIdea(db, { bookRef, ideaId, tick, nowIso });
      if (res.outcome === 'entered') out.entered += 1;
      else if (res.outcome === 'waiting') out.waiting += 1;
      else if (res.outcome === 'cancelled') out.cancelled += 1;
    } catch (err) {
      out.errors += 1;
      const code = isPracticeFieldError(err) ? err.code : 'error';
      console.error(`${LOG_PREFIX} ${bookRef.id} idea ${ideaId} entry failed at ${tick.tickKey} (${code}): ${err.message}`);
      // Leave the reason ON THE IDEA (refuter RF3-1): if the failure lasts to the session's last slot the close
      // cancels the idea `entry_timeout`, and without this nothing on its record would say why. Bookkeeping only:
      // no money moves and no revision; `update` never creates a missing idea; a failure here changes nothing.
      await bookRef.collection('ideas').doc(ideaId)
        .update({ lastEntryAttempt: { tickKey: tick.tickKey, slot: tick.slot, at: nowIso, error: code } })
        .catch(() => {});
    }
  }
  return out;
}
