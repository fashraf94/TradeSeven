// api/_utils/practiceField/exits.test.js
//
// Practice Field T1a-2a — THE MONEY COMING OUT: the lines, the sales code makes at the windows, the endpoint and the
// settlement that follows it (Amendment E, rulings E1 to E9, E14, E17; acceptance cases B-EXIT-ONE (33), B-EARLY (34),
// B-ENDPOINT (35), B-WAIT (36), B-DUE-BREACH (38); shared contract V2 §14 cases B-ORDER (4), B-LINE (7), B-CUTOFF (8)).
// Everything runs on the engine's transaction-faithful in-memory Firestore, from synthetic snapshots. No model call.
//
// The book is reconciled after every step of every row; every valuation row is scanned for a sale's word (B-MARK)
// and every result and endpoint row for the three banned words.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { admitIdea, releaseIdea } from './admission.js';
import { closeIdeaBook } from './close.js';
import { sellPendingHoldings, planPendingSales, saleDecisionId, runIdeaBookSalesPass } from './exits.js';
import { enterIdea } from './entry.js';
import { runIdeaBookEvalPass } from './sweep.js';
import { executeIdeaFill, modelledSaleProceeds } from './fills.js';
import { assertReconciled } from './reconcile.js';
import { saleHeldBackBy } from './ledger.js';
import { ideaSchedule, nextSessionDate, sessionAfter } from './windows.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { roundUsd, roundShares } from '../mandateRounding.js';
import {
  seedBook, admitAndEnter, closeOn, windowAt, storeTickSnapshot, storeCloseSnapshot, contractOf, getBook, getIdea, getRow, tickOf, tickSnapshot,
  slotNowOf, slotOpenIso, closeNowOf, etIso, ADMIT_ISO, takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults, countResults, moneyStoreBytes,
} from './__testsupport__/fixtures.js';

// A short idea admitted on Friday 13 Nov 2026 starts on Monday the 16th (session 0) and is due ten sessions later.
const S = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-07', '2026-12-08', '2026-12-09'];
const DUE = S[10];
const AFTER_DUE = S[11];
const BASE = { AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, LLY: 803.17, JNJ: 154.83, JPM: 241.37, SPY: 597.31, XLK: 233.59, XLV: 147.23 };
const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12, LLY: 7.5e11, JNJ: 3.7e11, JPM: 6.8e11 };
const MEGA = { capTier: 'mega', slippageBps: 1, spreadProxyBps: 2 };

/** The fixture's quotes with overrides: a number is a price; an object is a quote as given; `undefined` drops the symbol. */
function quotes(over = {}) {
  const out = {};
  for (const [sym, v] of Object.entries({ ...BASE, ...over })) {
    if (v === undefined) continue;
    if (typeof v === 'number') out[sym] = CAPS[sym] ? { price: v, marketCap: CAPS[sym] } : v;
    else out[sym] = CAPS[sym] && !Object.hasOwn(v, 'marketCap') ? { marketCap: CAPS[sym], ...v } : v;
  }
  return out;
}
const cents = (n) => Math.round(n * 100);
const ideaOf = (ctx, ideaId = ctx.ideaId) => getIdea(ctx.db, ctx.bookId, ideaId);
const bookOf = (ctx) => getBook(ctx.db, ctx.bookId);
const lineOf = (ctx, sym, ideaId = ctx.ideaId) => ideaOf(ctx, ideaId).lines.find((l) => l.symbol === sym);
const decisionsOf = (ctx) => [...ctx.db._store.keys()].filter((p) => p.startsWith(`mandates/${ctx.bookId}/decisions/`)).map((p) => ctx.db._get(p));
const endpointRowOf = (ctx, ideaId = ctx.ideaId) => ctx.db._get(`mandates/${ctx.bookId}/ideas/${ideaId}/rows/endpoint`);
/** The book reconciles with its open ideas, as stored. */
function recon(ctx) {
  const book = bookOf(ctx);
  return assertReconciled(book, book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id)));
}
const closeDay = async (ctx, date, over = {}) => { const out = await closeOn(ctx.db, ctx.bookId, date, quotes(over)); recon(ctx); return out; };
const win = async (ctx, date, slot = 'open30', over = {}) => { const out = await windowAt(ctx.db, ctx.bookId, { date, slot, quotes: quotes(over) }); recon(ctx); return out; };
/** A price a hair below a line's level, in whole cents. */
const below = (level) => roundUsd(level - 0.02);

/** A book with one idea entered at S[0]'s first window, at BASE prices. */
async function setup({ contract = {}, uid = 'owner-1' } = {}) {
  const { db, bookId, bookRef } = await seedBook({ uid });
  const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT', 'NVDA'], ...contract }), quotes: quotes(), date: S[0] });
  if (r.entry.outcome !== 'entered') throw new Error(`setup: ${JSON.stringify(r.entry)}`);
  const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
  recon(ctx);
  return ctx;
}
/** Close S[from..to] at BASE prices (with overrides), with nothing else happening. */
async function closeRange(ctx, from, to, over = {}) {
  for (let i = from; i <= to; i += 1) await closeDay(ctx, S[i], over);
}

let restoreMode;
const scanned = { results: 0 };
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); });
afterEach(() => {
  restoreMode();
  vi.restoreAllMocks();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]); // B-MARK: no valuation row this file wrote carries a sale's word
    expect(bannedWordsOnResults(db)).toEqual([]); // contract §4.4: no result or endpoint row carries a banned word
    scanned.results += countResults(db);
  }
});

describe('the schedule (E17) — admission covers the session after the due session', () => {
  it('a short idea admitted on Friday the 13th starts on the 16th, is due on 1 December and liquidates on the 2nd; the frozen contract carries all three', async () => {
    expect(ideaSchedule(ADMIT_ISO, 'short')).toMatchObject({ startSession: S[0], dueSession: DUE, liquidationSession: AFTER_DUE, sessions: 10 });
    const ctx = await setup();
    expect(ideaOf(ctx).contract.schedule).toMatchObject({ startSession: S[0], dueSession: DUE, liquidationSession: AFTER_DUE });
  });

  it('an idea whose DUE session is the last one on the maintained calendar is refused `calendar_unsupported`: the settlement sale would have no session to fill in', async () => {
    // Walk back from the calendar's last session to the admission day whose short idea would be due on it.
    let last = '2027-12-01';
    for (let next = nextSessionDate(last); next !== null; next = nextSessionDate(last)) last = next;
    expect(nextSessionDate(last)).toBeNull();
    // Find the session whose 10th successor is `last`: the idea's start. Its admission is any instant the day before.
    let start = '2027-11-15';
    while (sessionAfter(start, 10) !== last) start = nextSessionDate(start);
    let admitDay = '2027-11-01';
    while (nextSessionDate(admitDay) !== start) admitDay = nextSessionDate(admitDay);
    const lateIso = etIso(admitDay, 11, 0);
    expect(ideaSchedule(lateIso, 'short')).toBeNull(); // due on the last session: no session after it
    const { db, bookId } = await seedBook();
    const refused = await admitIdea(db, { bookId, contract: contractOf(), opId: 'late', nowIso: lateIso });
    expect(refused.ok).toBe(false);
    expect(refused.refusals.map((r) => r.code)).toContain('calendar_unsupported');
    // One session earlier the due session has a successor, and the idea is admitted.
    let earlierDay = '2027-11-01';
    while (nextSessionDate(earlierDay) !== admitDay) earlierDay = nextSessionDate(earlierDay);
    expect(ideaSchedule(etIso(earlierDay, 11, 0), 'short')).toMatchObject({ liquidationSession: last });
  });
});

describe('B-LINE, B-EXIT-ONE (E1, E6) — a line is a stop on its own holding', () => {
  it('one of three names closes below its line: only that name is sold, at the next eligible observation; the other two and the comparison are unchanged; the condition reads breached', async () => {
    const ctx = await setup();
    const entered = ideaOf(ctx);
    const level = lineOf(ctx, 'MSFT').level;
    expect(level).toBe(entered.lines.find((l) => l.symbol === 'MSFT').fillPrice * 0.95);
    await closeDay(ctx, S[0]);
    expect(ideaOf(ctx).status).toBe('holding');
    expect(getRow(ctx.db, ctx.bookId, ctx.ideaId, S[0]).lineObservations).toEqual({ AAPL: 'at_or_above', MSFT: 'at_or_above', NVDA: 'at_or_above' });

    // S[1]: MSFT closes below its line. The close RECOGNISES it; it sells nothing.
    const breachClose = below(level);
    const closed = await closeDay(ctx, S[1], { MSFT: breachClose });
    expect(closed.alerts).toEqual([]);
    const pending = ideaOf(ctx);
    expect(pending.status).toBe('line_hit_exit_pending');
    expect(pending.statusHistory.map((h) => h.status)).toEqual(['accepted', 'entering', 'holding', 'line_hit_exit_pending']);
    expect(pending.ledger.holdings.MSFT.exitPending).toEqual({
      reason: 'line', session: S[1], close: breachClose, level, at: closeNowOf(S[1]).toISOString(), recognisedLate: false, waiting: null,
    });
    expect(pending.ledger.holdings.AAPL.exitPending).toBeUndefined();
    expect(pending.ledger.holdings.NVDA.exitPending).toBeUndefined();
    expect(pending.lines.find((l) => l.symbol === 'MSFT').breach).toMatchObject({ session: S[1], close: breachClose, level, recognisedLate: false, onDueSession: false });
    expect(getRow(ctx.db, ctx.bookId, ctx.ideaId, S[1]).lineObservations).toEqual({ AAPL: 'at_or_above', MSFT: 'below', NVDA: 'at_or_above' });
    // B-MARK: the close moved no cash and wrote no decision.
    expect(pending.ledger.cash).toBe(entered.ledger.cash);
    expect(decisionsOf(ctx)).toHaveLength(3);
    expect(pending.postEntryFillCount).toBe(0);

    // S[2]'s first window: the sale fills, through executeIdeaFill, at THAT window's mark, at the stored tier.
    const before = { idea: pending, book: bookOf(ctx) };
    const salePrice = 395.11;
    const w = await win(ctx, S[2], 'open30', { MSFT: salePrice });
    expect(w.sales).toEqual({ served: true, sold: 1, waiting: 0, resulted: 0, errors: 0, alerts: [] });
    const after = ideaOf(ctx);
    const book = bookOf(ctx);
    const shares = before.idea.ledger.holdings.MSFT.shares;
    const execPrice = salePrice * (1 - 3 / 10000);
    const proceeds = roundUsd(shares * execPrice);
    const basis = before.idea.ledger.holdings.MSFT.costBasisTotal;
    expect(after.status).toBe('holding'); // E14: back to holding while other holdings remain
    expect(Object.keys(after.ledger.holdings)).toEqual(['AAPL', 'NVDA']);
    expect(after.ledger.holdings.AAPL).toEqual(before.idea.ledger.holdings.AAPL); // the other two: untouched
    expect(after.ledger.holdings.NVDA).toEqual(before.idea.ledger.holdings.NVDA);
    expect(cents(after.ledger.cash)).toBe(cents(before.idea.ledger.cash) + cents(proceeds)); // the proceeds stay in the idea
    expect(after.ledger.realizedPnlUsd).toBe(roundUsd(proceeds - basis));
    expect(after.postEntryFillCount).toBe(1);
    expect(after.ledger.saleReceipts).toEqual([{
      decisionId: saleDecisionId(ctx.ideaId, 'line_exit', 'MSFT'), kind: 'line_exit', symbol: 'MSFT', shares, executedPrice: execPrice,
      proceedsUsd: proceeds, costBasisUsd: basis, realizedPnlUsd: roundUsd(proceeds - basis), frictionPaidUsd: roundUsd((salePrice - execPrice) * shares),
      costTier: MEGA, mark: salePrice, markVendorTimeIso: etIso(S[2], 9, 45), tickKey: `${S[2]}_open30`, sessionDate: S[2], at: slotNowOf(S[2]).toISOString(),
      queuedBy: { session: S[1], at: closeNowOf(S[1]).toISOString(), reason: 'line', waitedSessions: 0 }, firstEligibleWindow: `${S[2]}_open30`,
    }]);
    // E3: the comparison and SPY never trade.
    expect(after.comparisonLedger).toEqual(before.idea.comparisonLedger);
    expect(after.spyLedger).toEqual(before.idea.spyLedger);
    // The book: the position is gone, the cash is up by the proceeds, the treasury did not move, the slot is still taken.
    expect(Object.keys(book.portfolio.positions).sort()).toEqual(['AAPL', 'NVDA']);
    expect(cents(book.portfolio.cash)).toBe(cents(before.book.portfolio.cash) + cents(proceeds));
    expect(book.treasury.unreservedCash).toBe(before.book.treasury.unreservedCash);
    expect(book.slots.short).toBe(ctx.ideaId);
    expect(book.revision).toBe(before.book.revision + 1);
    // Its own receipt: one decision, code not model.
    const decision = ctx.db._get(`mandates/${ctx.bookId}/decisions/${saleDecisionId(ctx.ideaId, 'line_exit', 'MSFT')}`);
    expect(decision).toMatchObject({
      verb: 'SELL', ticker: 'MSFT', status: 'executed', kind: 'idea_book', origin: 'line_exit', ideaId: ctx.ideaId, epochId: 'epoch-0001', contractVersion: 2,
      executedShares: shares, executedPrice: execPrice, executedSizeUsd: proceeds, realizedPnl: roundUsd(proceeds - basis), fillMarkQuality: 'fresh',
      rationale: null, rationaleStatus: 'absent', convictionDiagnostic: null, modelId: null, generationConfigVersion: null, rationaleAt: null, rationaleAtBasis: null,
      submitTickKey: `${S[2]}_open30`, harvestTickKey: `${S[2]}_open30`, frictionModelVersion: 'p3_cap_tier_v1',
    });
    expect(decisionsOf(ctx)).toHaveLength(4);
    expect(book.execState).toMatchObject({ submitted: 0, executed: 0 }); // the model's counters did not move

    // The same window again: nothing is left to sell, nothing is written.
    const bytes = moneyStoreBytes(ctx.db);
    expect((await win(ctx, S[2], 'open30', { MSFT: salePrice })).sales).toEqual({ served: true, sold: 0, waiting: 0, resulted: 0, errors: 0, alerts: [] });
    expect(moneyStoreBytes(ctx.db)).toBe(bytes);

    // The breach stays: the idea runs on with two names, and its line record does not go back.
    await closeDay(ctx, S[2], { MSFT: 430 });
    expect(ideaOf(ctx).status).toBe('holding');
    expect(lineOf(ctx, 'MSFT').breach.session).toBe(S[1]);
    expect(getRow(ctx.db, ctx.bookId, ctx.ideaId, S[2]).lineObservations).toEqual({ AAPL: 'at_or_above', NVDA: 'at_or_above' });
  });

  it('STRICTLY below: a close exactly on the line is not a breach; a cent under it is', async () => {
    const ctx = await setup({ contract: { names: ['AAPL'] } });
    // A level in whole cents, so a close can sit exactly on it.
    const ideaRef = ctx.bookRef.collection('ideas').doc(ctx.ideaId);
    const idea = ideaOf(ctx);
    await ideaRef.set({ ...idea, lines: idea.lines.map((l) => ({ ...l, level: 220.5 })) });
    await closeDay(ctx, S[0], { AAPL: 220.5 });
    expect(ideaOf(ctx).status).toBe('holding');
    expect(lineOf(ctx, 'AAPL').breach).toBeUndefined();
    expect(getRow(ctx.db, ctx.bookId, ctx.ideaId, S[0]).lineObservations).toEqual({ AAPL: 'at_or_above' });
    await closeDay(ctx, S[1], { AAPL: 220.49 });
    expect(ideaOf(ctx).status).toBe('line_hit_exit_pending');
    expect(lineOf(ctx, 'AAPL').breach).toMatchObject({ session: S[1], close: 220.49, level: 220.5 });
  });

  it('E6 — a close that is not full quality recognises nothing and records the line as unobserved for that session: no vendor time, a carried mark, a missing quote, a pre-open print (Q-3)', async () => {
    const ctx = await setup({ contract: { names: ['AAPL', 'MSFT'] } });
    const low = below(lineOf(ctx, 'AAPL').level);
    await closeDay(ctx, S[0], { AAPL: { price: low, at: null } }); // no vendor time: receipt_time_fallback
    await closeDay(ctx, S[1], { AAPL: { price: low, at: etIso(S[0], 15, 59) } }); // the vendor last printed it yesterday: carried_forward
    await closeDay(ctx, S[2], { AAPL: undefined }); // no quote at all
    await closeDay(ctx, S[3], { AAPL: { price: low, at: etIso(S[3], 9, 29) } }); // Q-3: printed before the open
    const idea = ideaOf(ctx);
    expect(idea.status).toBe('holding');
    expect(idea.lines.find((l) => l.symbol === 'AAPL').breach).toBeUndefined();
    expect(idea.unobservedLineSessions).toEqual({ AAPL: [S[0], S[1], S[2], S[3]] });
    expect(idea.ledger.holdings.AAPL.exitPending).toBeUndefined();
    const qualities = [S[0], S[1], S[2], S[3]].map((d) => getRow(ctx.db, ctx.bookId, ctx.ideaId, d).marks.AAPL.quality);
    expect(qualities).toEqual(['receipt_time_fallback', 'carried_forward', 'carried_forward', 'pre_open_print']);
    for (const d of [S[0], S[1], S[2], S[3]]) {
      const row = getRow(ctx.db, ctx.bookId, ctx.ideaId, d);
      expect(row.fullQuality, d).toBe(false);
      expect(row.lineObservations, d).toEqual({ AAPL: 'unobserved', MSFT: 'at_or_above' });
    }
    // The first full-quality close below the line IS recognised.
    await closeDay(ctx, S[4], { AAPL: low });
    expect(ideaOf(ctx).status).toBe('line_hit_exit_pending');
    expect(lineOf(ctx, 'AAPL').breach.session).toBe(S[4]);
    expect(ideaOf(ctx).unobservedLineSessions).toEqual({ AAPL: [S[0], S[1], S[2], S[3]] });
  });
});

describe('E6, continued — what else is not a full-quality close', () => {
  it('a symbol with an UNSETTLED conflicting corporate action reads no line, even after the feed stops presenting it and its mark is fresh again', async () => {
    const ctx = await setup({ contract: { names: ['AAPL', 'MSFT'] } });
    await closeDay(ctx, S[0]);
    const level = lineOf(ctx, 'AAPL').level;
    const dividend = (amount) => ({ type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], amount, source: 'eodhd_dividends' });
    // S[1]: the feed lists one dividend twice with different amounts. Applied to no ledger; the symbol is held back.
    const first = await closeDay(ctx, S[1], { AAPL: { price: below(level), corporateActions: [dividend(0.26), dividend(0.31)] } });
    expect(first.alerts.some((a) => /PRACTICE_FIELD_CORPORATE_ACTION_CONFLICT/.test(a))).toBe(true);
    expect(getRow(ctx.db, ctx.bookId, ctx.ideaId, S[1])).toMatchObject({ fullQuality: false, lineObservations: { AAPL: 'unobserved', MSFT: 'at_or_above' }, marks: { AAPL: { quality: 'carried_forward' } } });
    // S[2]: the feed no longer presents it. The mark is fresh — vendor_time — and below the line; the conflict was never settled.
    await closeDay(ctx, S[2], { AAPL: below(level) });
    const row = getRow(ctx.db, ctx.bookId, ctx.ideaId, S[2]);
    expect(row.marks.AAPL).toMatchObject({ quality: 'vendor_time', mark: below(level) });
    expect(row).toMatchObject({ fullQuality: false, lineObservations: { AAPL: 'unobserved', MSFT: 'at_or_above' } });
    expect(ideaOf(ctx).status).toBe('holding');
    expect(lineOf(ctx, 'AAPL').breach).toBeUndefined();
    expect(ideaOf(ctx).unobservedLineSessions).toEqual({ AAPL: [S[1], S[2]] });
    // A consistent row settles it: the dividend is paid once, and the next close below the line is recognised.
    await closeDay(ctx, S[3], { AAPL: { price: below(level), corporateActions: [dividend(0.26)] } });
    expect(ideaOf(ctx).ledger.appliedActionIds).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    expect(ideaOf(ctx).status).toBe('line_hit_exit_pending');
    expect(lineOf(ctx, 'AAPL').breach.session).toBe(S[3]);
  });
});

describe('B-ORDER (E8) — within a window, sales come first, then entries', () => {
  it('the idea-book pass sells a pending line exit BEFORE it enters a second idea in the same window', async () => {
    const ctx = await setup({ contract: { names: ['AAPL'] } });
    await closeDay(ctx, S[0]);
    // A second idea is admitted during S[1]: its start session is S[2].
    const second = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['JPM'], capitalUsd: 25000 }), opId: 'idea-2', nowIso: etIso(S[1], 11, 0) });
    expect(second).toMatchObject({ ok: true, startSession: S[2] });
    await closeDay(ctx, S[1], { AAPL: below(lineOf(ctx, 'AAPL').level) });
    expect(ideaOf(ctx).status).toBe('line_hit_exit_pending');

    // S[2]'s first window, through the pass the cron calls. Every transaction's answer is recorded in commit order.
    await storeTickSnapshot(ctx.db, S[2], 'open30', quotes());
    const order = [];
    const recording = { ...ctx.db, runTransaction: async (fn, opts) => { const r = await ctx.db.runTransaction(fn, opts); if (r && typeof r.outcome === 'string') order.push(r.outcome); return r; } };
    const pass = await runIdeaBookEvalPass(recording, { tick: tickOf(S[2], 'open30'), now: slotNowOf(S[2]), ownerToken: 'owner-token' });
    expect(pass).toEqual({ books: 1, served: 1, caughtUp: 0, sold: 1, saleWaiting: 0, resulted: 0, entered: 1, waiting: 0, cancelled: 0, errors: 0, leaseSkips: 0 });
    expect(order.filter((o) => o === 'sold' || o === 'entered')).toEqual(['sold', 'entered']);
    recon(ctx);
    expect(ideaOf(ctx, second.ideaId).status).toBe('holding');
    expect(Object.keys(ideaOf(ctx).ledger.holdings)).toEqual([]);
    // The sale's receipt was written against the book BEFORE the entry's fills moved it.
    const sale = ctx.db._get(`mandates/${ctx.bookId}/decisions/${saleDecisionId(ctx.ideaId, 'line_exit', 'AAPL')}`);
    const buy = decisionsOf(ctx).find((d) => d.origin === 'basket_entry' && d.ideaId === second.ideaId);
    expect(sale.baseRevision).toBeLessThan(buy.baseRevision);
  });
});

describe('B-EARLY (E2, E14) — an idea with no holdings left resolves early', () => {
  it('the last holding exits: the result is written at that session\'s close against the comparison\'s value at the same close, and the slot frees', async () => {
    const ctx = await setup({ contract: { names: ['AAPL'], comparison: { type: 'sector_fund', symbols: ['XLK'] } } });
    await closeDay(ctx, S[0]);
    await closeDay(ctx, S[1], { AAPL: below(lineOf(ctx, 'AAPL').level) });
    const w = await win(ctx, S[2], 'open30', { AAPL: 214.07 });
    expect(w.sales).toMatchObject({ sold: 1, resulted: 0 });
    const sold = ideaOf(ctx);
    // E14: nothing is left, so it waits — still `line_hit_exit_pending`, still in its slot — for this session's close.
    expect(sold).toMatchObject({ status: 'line_hit_exit_pending', result: null, earlyResolution: { session: S[2], lastSale: saleDecisionId(ctx.ideaId, 'line_exit', 'AAPL') } });
    expect(sold.ledger.holdings).toEqual({});
    expect(bookOf(ctx).slots.short).toBe(ctx.ideaId);
    const cashAtExit = sold.ledger.cash;

    const closed = await closeDay(ctx, S[2], { AAPL: 216.4, XLK: 236.17, SPY: 601.02 });
    expect(closed.resulted).toEqual([ctx.ideaId]);
    const idea = ideaOf(ctx);
    const book = bookOf(ctx);
    expect(idea.status).toBe('resulted');
    expect(idea.statusHistory.map((h) => h.status)).toEqual(['accepted', 'entering', 'holding', 'line_hit_exit_pending', 'settled', 'resulted']);
    // The endpoint is THIS close: the idea's value is its cash; the comparison is valued at this close's marks, less its own exit cost.
    const ep = endpointRowOf(ctx);
    const xlk = sold.comparisonLedger.holdings.XLK;
    const cmpValue = roundUsd(sold.comparisonLedger.cash + roundUsd(xlk.shares * (236.17 * (1 - 3 / 10000))));
    expect(ep).toMatchObject({
      rowKind: 'endpoint', basis: 'liquidation_value', endpointSession: S[2], dueSession: DUE, endpointKind: 'early_resolution', observed: true,
      closeSnapshotKey: `${S[2]}_close`, idea: { cashUsd: cashAtExit, holdingsAtMarksUsd: 0, modelledExitCostUsd: 0, valueUsd: cashAtExit, holdings: {} },
      comparison: { valueUsd: cmpValue },
    });
    expect(idea.result).toMatchObject({
      endpointSession: S[2], endpointKind: 'early_resolution', contractCondition: 'breached', processQuality: 'followed_plan',
      economic: { ideaValueUsd: cashAtExit, comparisonValueUsd: cmpValue, gapUsd: roundUsd(cashAtExit - cmpValue) },
      trades: { entry: { count: 1 }, lineExit: { count: 1 } },
    });
    expect(idea.result.economicResult).toBe('behind'); // sold 7% down against a fund that rose
    // Nothing was left to sell: settled → resulted at the same close; the cash is the treasury's; the slot and the coverage are free.
    expect(idea.ledger.cash).toBe(0);
    expect(idea).toMatchObject({ liquidationProceedsUsd: 0, liquidationSlippageUsd: 0, liquidation: { completedSession: S[2], sales: [], returnedToTreasuryUsd: cashAtExit } });
    expect(cents(book.treasury.unreservedCash)).toBe(8000000 + cents(cashAtExit));
    expect(book.treasury.unreservedCash).toBe(book.portfolio.cash);
    expect(book.slots).toEqual({ short: null, medium: null, long: null });
    expect(book.openIdeaIds).toEqual([]);
    expect(book.portfolio.positions).toEqual({});
    expect(ctx.db._get('practiceFieldCoverage/current').symbols).toEqual({});
    // The slot is free for the next idea.
    const next = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ names: ['MSFT'], capitalUsd: 15000 }), opId: 'idea-next', nowIso: etIso(S[3], 11, 0) });
    expect(next.refusals ?? []).toEqual([]);
    expect(next.ok).toBe(true);
  });
});

describe('B-ENDPOINT (E4, E5) — a liquidation value, computed the same way on all three ledgers', () => {
  const DUE_PX = { AAPL: 240.11, MSFT: 431.07, NVDA: 139.93, SPY: 601.13, XLK: 236.17 };
  /** A ledger's liquidation value, by hand: cash + Σ round(shares × mark × (1 − bps)). */
  const liquidationOf = (ledger, px, bpsOf) => {
    let centsTotal = cents(ledger.cash);
    for (const [sym, h] of Object.entries(ledger.holdings)) centsTotal += cents(roundUsd(h.shares * (px[sym] * (1 - bpsOf(sym) / 10000))));
    return centsTotal / 100;
  };

  it('an idea that never traded after entry, with a same-stock comparison, ties to the cent; SPY is valued the same way; the close sells nothing', async () => {
    const ctx = await setup();
    await closeRange(ctx, 0, 9);
    const before = { idea: ideaOf(ctx), book: bookOf(ctx) };
    const closed = await closeDay(ctx, DUE, DUE_PX);
    expect(closed.alerts).toEqual([]);
    const idea = ideaOf(ctx);
    const ep = endpointRowOf(ctx);
    const own = liquidationOf(before.idea.ledger, DUE_PX, () => 3);
    const spy = liquidationOf(before.idea.spyLedger, DUE_PX, () => 3);
    expect(ep.idea.valueUsd).toBe(own);
    expect(ep.comparison.valueUsd).toBe(own); // the same quantities, the same marks, the same stored tiers
    expect(ep.spy.valueUsd).toBe(spy);
    expect(ep).toMatchObject({ endpointSession: DUE, endpointKind: 'due_session', gapUsd: 0, gapPct: 0, closeSnapshotKey: `${DUE}_close`, closeSnapshotBuiltAt: getRow(ctx.db, ctx.bookId, ctx.ideaId, DUE).closeSnapshotBuiltAt });
    // Each figure is the sum of its displayed parts.
    for (const side of [ep.idea, ep.comparison, ep.spy]) {
      expect(cents(side.valueUsd)).toBe(cents(side.cashUsd) + cents(side.holdingsAtMarksUsd) - cents(side.modelledExitCostUsd));
      expect(cents(side.holdingsNetUsd)).toBe(cents(side.holdingsAtMarksUsd) - cents(side.modelledExitCostUsd));
      expect(side.modelledExitCostUsd).toBeGreaterThan(0);
      expect(side.fullQuality).toBe(true);
    }
    expect(ep.idea.holdings.AAPL).toMatchObject({ shares: before.idea.ledger.holdings.AAPL.shares, mark: 240.11, markQuality: 'vendor_time', costTier: MEGA });
    // The valuation row of the due session is still a mark, before any cost: the endpoint is a separate document.
    const row = getRow(ctx.db, ctx.bookId, ctx.ideaId, DUE);
    expect(row).toMatchObject({ rowKind: 'valuation', basis: 'mark', markedGapUsd: 0 });
    expect(cents(row.markedValue)).toBe(cents(ep.idea.cashUsd) + cents(ep.idea.holdingsAtMarksUsd));

    // The result: five columns.
    expect(idea.result).toMatchObject({
      resultVersion: 1, endpointSession: DUE, endpointKind: 'due_session', endpointSnapshotKey: `${DUE}_close`,
      contractCondition: 'met', economicResult: 'within_band', processQuality: 'followed_plan',
      evidenceScope: 'single_forward_observation', adoption: 'no_offer', closingNote: null, oneObservationLabel: true,
      contractDetail: { breaches: [], unobservedLineSessions: {}, unobservedLineSessionCount: 0 },
      economic: { ideaValueUsd: own, comparisonValueUsd: own, gapUsd: 0, gapPctOfReserved: 0, bandUsd: 50, bandShareOfReserved: 0.0025, unmeasurableBecause: [] },
      spy: { valueUsd: spy, gapUsd: roundUsd(own - spy), fullQuality: true },
      trades: { entry: { count: 3, costsUsd: before.idea.ledger.costsPaidUsd }, lineExit: { count: 0, costsUsd: 0 } },
      investedExposure: { closes: 11 },
      dataQuality: { rows: 11, rowsNotFullQuality: 0, unobservedLineSessions: 0, waitingDays: 0, costTiersStored: true },
    });
    expect(idea.result.investedExposure.mean).toBeGreaterThan(0.99);
    // E14: settled; everything it holds waits for the one settlement sale; the slot is still taken.
    expect(idea.status).toBe('settled');
    expect(idea.endpoint).toEqual({ session: DUE, kind: 'due_session', valueUsd: own, cashUsd: ep.idea.cashUsd, holdingsNetUsd: ep.idea.holdingsNetUsd, snapshotKey: `${DUE}_close` });
    for (const h of Object.values(idea.ledger.holdings)) expect(h.settlementPending).toEqual({ session: DUE, at: closeNowOf(DUE).toISOString(), replacedExit: null, waiting: null });
    expect(bookOf(ctx).slots.short).toBe(ctx.ideaId);
    // B-MARK: the close moved no cash, wrote no decision, and left the treasury alone.
    expect(idea.ledger.cash).toBe(before.idea.ledger.cash);
    expect(bookOf(ctx).portfolio.cash).toBe(before.book.portfolio.cash);
    expect(bookOf(ctx).treasury.unreservedCash).toBe(before.book.treasury.unreservedCash);
    expect(decisionsOf(ctx)).toHaveLength(3);
    expect(idea.postEntryFillCount).toBe(0);
  });

  it('each ledger pays its OWN cost policy, at the tier each holding ENTERED with: a later market cap does not reprice it (E5)', async () => {
    // AAPL enters as a mid cap (10 bps); its comparison is the sector fund (3 bps).
    const { db, bookId, bookRef } = await seedBook();
    const entry = quotes({ AAPL: { price: BASE.AAPL, marketCap: 5e9 } });
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: entry, date: S[0] });
    const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
    expect(ideaOf(ctx).ledger.holdings.AAPL.costTier).toEqual({ capTier: 'mid', slippageBps: 3, spreadProxyBps: 7 });
    await closeRange(ctx, 0, 9);
    const before = ideaOf(ctx);
    await closeDay(ctx, DUE, DUE_PX); // the due snapshot carries AAPL as a MEGA cap (3 bps): not used
    const ep = endpointRowOf(ctx);
    expect(ep.idea.holdings.AAPL.costTier).toEqual({ capTier: 'mid', slippageBps: 3, spreadProxyBps: 7 });
    expect(ep.idea.valueUsd).toBe(liquidationOf(before.ledger, DUE_PX, () => 10));
    expect(ep.idea.valueUsd).not.toBe(liquidationOf(before.ledger, DUE_PX, () => 3));
    expect(ep.comparison.holdings.XLK.costTier).toEqual({ capTier: 'fund:liquid_fund', slippageBps: 1, spreadProxyBps: 2 });
    expect(ep.comparison.valueUsd).toBe(liquidationOf(before.comparisonLedger, DUE_PX, () => 3));
    expect(cents(ep.gapUsd)).toBe(cents(ep.idea.valueUsd) - cents(ep.comparison.valueUsd));
    expect(ideaOf(ctx).result.economic.gapUsd).toBe(ep.gapUsd);
    // …and the settlement sale the next morning is priced at the same stored tier.
    await win(ctx, AFTER_DUE, 'open30', DUE_PX);
    const sale = ideaOf(ctx).ledger.saleReceipts[0];
    expect(sale).toMatchObject({ kind: 'settlement', costTier: { capTier: 'mid', slippageBps: 3, spreadProxyBps: 7 }, executedPrice: 240.11 * (1 - 10 / 10000) });
  });

  it('the endpoint\'s arithmetic is the sale\'s own: selling at exactly the endpoint\'s mark fetches exactly the endpoint\'s figure', () => {
    for (const [shares, mark, tier] of [[28.715311, 240.11, MEGA], [199.940017, 99.37, { capTier: 'small', slippageBps: 5, spreadProxyBps: 15 }], [0.000001, 3e5, MEGA]]) {
      const modelled = modelledSaleProceeds(shares, mark, tier);
      const ledger = { kind: 'idea', reservedCapitalUsd: 20000, cash: 0, holdings: { AAPL: { shares, costBasisTotal: 1, avgCost: 1 / shares, lastMark: mark, openedAt: S[0], costTier: tier } }, costsPaidUsd: 0, dividendsUsd: 0, realizedPnlUsd: 0, appliedActionIds: [], declinedActionIds: [], corporateActionReceipts: [], saleReceipts: [] };
      const snapshot = tickSnapshot(S[1], 'open30', { AAPL: { price: mark, marketCap: 1 } });
      const fill = executeIdeaFill({ ledger, verb: 'SELL', symbol: 'AAPL', snapshot, notBeforeIso: closeNowOf(S[0]).toISOString(), sessionDate: S[1], friction: tier });
      expect(fill.receipt.executedSizeUsd, String(mark)).toBe(modelled.netUsd);
      expect(modelled.grossUsd).toBe(roundUsd(shares * mark));
    }
  });
});

describe('settlement (E4, E14) — the sale that frees the capital, the session after the endpoint', () => {
  const DUE_PX = { AAPL: 240.11, MSFT: 431.07, NVDA: 139.93, SPY: 601.13 };
  const settled = async (contract = {}) => { const ctx = await setup({ contract }); await closeRange(ctx, 0, 9); await closeDay(ctx, DUE, DUE_PX); return ctx; };

  it('every remaining holding is sold at the next session\'s first eligible window; with the last fill the cash returns to the treasury, the slot and the coverage free, and the idea is resulted — in one transaction', async () => {
    const ctx = await settled();
    const before = { idea: ideaOf(ctx), book: bookOf(ctx) };
    const result = structuredClone(before.idea.result);
    const endpoint = structuredClone(endpointRowOf(ctx));
    // The same prices as the endpoint's marks: the liquidation fetches exactly what the endpoint said.
    const w = await win(ctx, AFTER_DUE, 'open30', DUE_PX);
    expect(w.sales).toEqual({ served: true, sold: 3, waiting: 0, resulted: 1, errors: 0, alerts: [] });
    const idea = ideaOf(ctx);
    const book = bookOf(ctx);
    expect(idea.status).toBe('resulted');
    expect(idea.statusHistory.map((h) => h.status)).toEqual(['accepted', 'entering', 'holding', 'settled', 'resulted']);
    expect(idea.ledger.holdings).toEqual({});
    expect(idea.ledger.cash).toBe(0);
    expect(idea.postEntryFillCount).toBe(3);
    expect(idea.ledger.saleReceipts.map((s) => [s.kind, s.symbol])).toEqual([['settlement', 'AAPL'], ['settlement', 'MSFT'], ['settlement', 'NVDA']]);
    const proceeds = idea.ledger.saleReceipts.reduce((sum, s) => sum + cents(s.proceedsUsd), 0) / 100;
    expect(proceeds).toBe(endpoint.idea.holdingsNetUsd);
    expect(idea).toMatchObject({
      liquidationProceedsUsd: proceeds, liquidationSlippageUsd: 0,
      liquidation: { completedSession: AFTER_DUE, proceedsUsd: proceeds, endpointHoldingsNetUsd: endpoint.idea.holdingsNetUsd, slippageUsd: 0, returnedToTreasuryUsd: endpoint.idea.valueUsd },
    });
    expect(idea.liquidation.sales).toEqual(['AAPL', 'MSFT', 'NVDA'].map((sym) => saleDecisionId(ctx.ideaId, 'settlement', sym)));
    // The treasury holds everything again: its 80,000 plus the idea's final cash, which is the endpoint's value.
    expect(cents(book.treasury.unreservedCash)).toBe(8000000 + cents(endpoint.idea.valueUsd));
    expect(book.portfolio.cash).toBe(book.treasury.unreservedCash);
    expect(book.portfolio.totalValue).toBe(book.treasury.unreservedCash);
    expect(book.portfolio.positions).toEqual({});
    expect(book.slots.short).toBeNull();
    expect(book.openIdeaIds).toEqual([]);
    expect(book.revision).toBe(before.book.revision + 1);
    expect(ctx.db._get('practiceFieldCoverage/current').symbols).toEqual({});
    expect(decisionsOf(ctx).filter((d) => d.origin === 'settlement')).toHaveLength(3);
    expect(decisionsOf(ctx).filter((d) => d.origin === 'line_exit')).toHaveLength(0);
    // The slippage is recorded and is NOT part of the result: the result and the endpoint row are byte-identical.
    expect(idea.result).toEqual(result);
    expect(endpointRowOf(ctx)).toEqual(endpoint);
  });

  it('the liquidation slippage is the proceeds minus what the endpoint valued the same holdings at; a partly filled liquidation keeps the slot until the last sale', async () => {
    const ctx = await settled();
    const endpoint = endpointRowOf(ctx);
    // The first window has no price for NVDA: two holdings sell, the third waits, the idea stays settled in its slot.
    const first = await win(ctx, AFTER_DUE, 'open30', { AAPL: 238.02, MSFT: 433.4, NVDA: undefined });
    expect(first.sales).toMatchObject({ sold: 2, waiting: 1, resulted: 0 });
    const mid = ideaOf(ctx);
    expect(mid.status).toBe('settled');
    expect(Object.keys(mid.ledger.holdings)).toEqual(['NVDA']);
    expect(mid.ledger.holdings.NVDA.settlementPending.waiting).toMatchObject({ attempts: 1, sessions: [AFTER_DUE], lastRefusal: 'no_quote' });
    expect(mid.processQuality).toBe('blocked'); // the idea's LIVE process quality; its result stays as written
    expect(mid.result.processQuality).toBe('followed_plan');
    expect(bookOf(ctx).slots.short).toBe(ctx.ideaId);
    expect(mid.liquidation).toBeUndefined();
    // The second window has it.
    const second = await win(ctx, AFTER_DUE, 'midday', { AAPL: 238.02, MSFT: 433.4, NVDA: 141.6 });
    expect(second.sales).toMatchObject({ sold: 1, resulted: 1 });
    const idea = ideaOf(ctx);
    const proceeds = idea.ledger.saleReceipts.reduce((sum, s) => sum + cents(s.proceedsUsd), 0);
    expect(idea.status).toBe('resulted');
    expect(cents(idea.liquidationProceedsUsd)).toBe(proceeds);
    expect(cents(idea.liquidationSlippageUsd)).toBe(proceeds - cents(endpoint.idea.holdingsNetUsd));
    expect(idea.liquidationSlippageUsd).not.toBe(0);
    expect(cents(bookOf(ctx).treasury.unreservedCash)).toBe(8000000 + cents(endpoint.idea.cashUsd) + proceeds);
    expect(bookOf(ctx).slots.short).toBeNull();
  });

  it('B-CUTOFF, as far as this build owns it — after the endpoint nothing reads a line, nothing rewrites the result, and the reservation cannot be released; the endpoint is the due session\'s post-close value', async () => {
    const ctx = await settled();
    const result = structuredClone(ideaOf(ctx).result);
    const endpoint = structuredClone(endpointRowOf(ctx));
    expect(endpoint).toMatchObject({ endpointSession: DUE, closeSnapshotKey: `${DUE}_close`, label: 'post_close_snapshot' });
    // The session after: no price at any window (the sale waits), and a close far below every line.
    for (const slot of ['open30', 'midday', 'preClose']) await win(ctx, AFTER_DUE, slot, { AAPL: undefined, MSFT: undefined, NVDA: undefined });
    const crash = { AAPL: 150.01, MSFT: 280.02, NVDA: 90.03 };
    await closeDay(ctx, AFTER_DUE, crash);
    const idea = ideaOf(ctx);
    expect(idea.status).toBe('settled');
    expect(idea.result).toEqual(result); // written once
    expect(endpointRowOf(ctx)).toEqual(endpoint);
    expect(idea.lines.every((l) => l.breach === undefined)).toBe(true);
    const row = getRow(ctx.db, ctx.bookId, ctx.ideaId, AFTER_DUE);
    expect(row.lineObservations).toBeUndefined(); // no line is read after the endpoint
    expect(row.markedValue).toBeLessThan(endpoint.idea.valueUsd); // …though the book is still valued, every session
    expect(await releaseIdea(ctx.db, { bookId: ctx.bookId, ideaId: ctx.ideaId, nowIso: etIso(S[12], 9, 0) })).toEqual({ ok: false, code: 'idea_already_filled', status: 'settled' });
    // A replayed close of the due session writes nothing.
    const bytes = moneyStoreBytes(ctx.db);
    expect(await closeIdeaBook(ctx.db, ctx.bookRef, { date: DUE, now: closeNowOf(DUE) })).toMatchObject({ closed: false, skipped: 'out_of_order' });
    expect(moneyStoreBytes(ctx.db)).toBe(bytes);
  });
});

describe('B-WAIT (E9) — a sale with no eligible price waits', () => {
  it('fills nothing — never at a carried mark, never at cost — keeps the slot, records each refusal, reads blocked, alerts from the fifth session once per session, and sells when a price appears', async () => {
    const ctx = await setup({ contract: { names: ['AAPL', 'MSFT'] } });
    await closeDay(ctx, S[0], { AAPL: below(lineOf(ctx, 'AAPL').level) }); // recognised at S[0]'s close
    const queued = { idea: ideaOf(ctx), book: bookOf(ctx) };
    expect(queued.idea.status).toBe('line_hit_exit_pending');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const noSale = (label) => {
      const idea = ideaOf(ctx);
      const book = bookOf(ctx);
      expect(idea.ledger.holdings.AAPL.shares, label).toBe(queued.idea.ledger.holdings.AAPL.shares);
      expect(idea.ledger.cash, label).toBe(queued.idea.ledger.cash);
      expect(idea.ledger.saleReceipts, label).toEqual([]);
      expect(idea.postEntryFillCount, label).toBe(0);
      expect(book.portfolio.positions.AAPL.shares, label).toBe(queued.book.portfolio.positions.AAPL.shares);
      expect(book.portfolio.cash, label).toBe(queued.book.portfolio.cash);
      expect(book.slots.short, label).toBe(ctx.ideaId);
      expect(decisionsOf(ctx), label).toHaveLength(2);
      expect(idea.status, label).toBe('line_hit_exit_pending');
    };
    const stale = (date, slot) => new Date(Date.parse(slotNowOf(date, slot).toISOString()) - 60_000 - 21 * 60_000).toISOString(); // 21 minutes before the build

    // Session S[1]: three windows, three different reasons there is no eligible price.
    const w1 = await windowAt(ctx.db, ctx.bookId, { date: S[1], slot: 'open30' }); // no stored snapshot at all
    expect(w1.sales).toEqual({ served: true, sold: 0, waiting: 1, resulted: 0, errors: 0, alerts: [] });
    noSale('no stored snapshot');
    await win(ctx, S[1], 'midday', { AAPL: { price: 215.2, at: etIso(S[0], 15, 59) } }); // the vendor's last print is yesterday's: a carried mark
    noSale('carried');
    await win(ctx, S[1], 'preClose', { AAPL: { price: 215.2, at: stale(S[1], 'preClose') } }); // Q-2: 21 minutes old at the window's tick
    noSale('stale');
    let waiting = ideaOf(ctx).ledger.holdings.AAPL.exitPending.waiting;
    expect(waiting).toMatchObject({ attempts: 3, sessions: [S[1]], firstTickKey: `${S[1]}_open30`, lastTickKey: `${S[1]}_preClose`, lastRefusal: 'stale_quote', alertedOn: null });
    expect(waiting.refusals.map((r) => r.refusal)).toEqual(['no_stored_snapshot', 'carried_forward', 'stale_quote']);
    expect(ideaOf(ctx)).toMatchObject({ processQuality: 'blocked', waitedSessions: [S[1]], blockedBy: [{ kind: 'line_exit_waited', symbol: 'AAPL', session: S[1] }] });
    // A window already recorded is not recorded twice.
    const bytes = moneyStoreBytes(ctx.db);
    await win(ctx, S[1], 'preClose', { AAPL: { price: 215.2, at: stale(S[1], 'preClose') } });
    expect(moneyStoreBytes(ctx.db)).toBe(bytes);
    await closeDay(ctx, S[1]);

    // Sessions S[2] to S[4]: no quote, or a quote with no vendor time. Four sessions waited: no alert yet.
    await win(ctx, S[2], 'open30', { AAPL: undefined });
    await closeDay(ctx, S[2]);
    await win(ctx, S[3], 'open30', { AAPL: { price: 215.2, at: null } });
    await closeDay(ctx, S[3]);
    await win(ctx, S[4], 'open30', { AAPL: undefined });
    await closeDay(ctx, S[4]);
    noSale('four sessions');
    expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending.waiting).toMatchObject({ attempts: 6, sessions: [S[1], S[2], S[3], S[4]], lastRefusal: 'no_quote', alertedOn: null });
    const alertsLogged = () => errors.mock.calls.map((c) => String(c[0])).filter((m) => /PRACTICE_FIELD_SALE_WAITING/.test(m));
    expect(alertsLogged()).toEqual([]);

    // The FIFTH session: the alert fires — once for the session, however many windows refuse.
    const fifth = await win(ctx, S[5], 'open30', { AAPL: undefined });
    expect(fifth.sales.alerts).toHaveLength(1);
    expect(fifth.sales.alerts[0]).toMatch(new RegExp(`^PRACTICE_FIELD_SALE_WAITING ${ctx.ideaId} AAPL line_exit — no eligible price for 5 sessions`));
    expect((await win(ctx, S[5], 'midday', { AAPL: undefined })).sales.alerts).toEqual([]);
    expect(alertsLogged()).toHaveLength(1);
    await closeDay(ctx, S[5]);
    // The sixth: once more.
    expect((await win(ctx, S[6], 'open30', { AAPL: undefined })).sales.alerts).toHaveLength(1);
    expect(alertsLogged()).toHaveLength(2);
    noSale('six sessions');

    // A price appears: the sale fills, with the record of how long it waited; the idea goes back to holding.
    const filled = await win(ctx, S[6], 'midday', { AAPL: 214.4 });
    expect(filled.sales).toMatchObject({ sold: 1, waiting: 0 });
    const sold = ideaOf(ctx);
    expect(sold.status).toBe('holding');
    expect(sold.ledger.saleReceipts[0]).toMatchObject({ kind: 'line_exit', symbol: 'AAPL', mark: 214.4, queuedBy: { session: S[0], reason: 'line', waitedSessions: 6 } });
    expect(sold.waitedSessions).toEqual([S[1], S[2], S[3], S[4], S[5], S[6]]);
    expect(sold.processQuality).toBe('blocked'); // it never goes back

    // …and the result reads `blocked`.
    await closeRange(ctx, 6, 10);
    const result = ideaOf(ctx).result;
    expect(result).toMatchObject({
      contractCondition: 'breached', processQuality: 'blocked',
      processDetail: { blockedBy: [{ kind: 'line_exit_waited', symbol: 'AAPL', session: S[1] }] },
      dataQuality: { waitingDays: 6 },
    });
  });

  it('a line exit still waiting at the due session becomes the settlement sale — one sale, its waiting record kept — and the slot stays occupied until it fills', async () => {
    const ctx = await setup({ contract: { names: ['AAPL'] } });
    await closeRange(ctx, 0, 7);
    await closeDay(ctx, S[8], { AAPL: below(lineOf(ctx, 'AAPL').level) });
    await win(ctx, S[9], 'open30', { AAPL: undefined });
    await closeDay(ctx, S[9]);
    await win(ctx, DUE, 'open30', { AAPL: undefined });
    await closeDay(ctx, DUE);
    const idea = ideaOf(ctx);
    expect(idea.status).toBe('settled');
    expect(idea.ledger.holdings.AAPL.exitPending).toBeUndefined();
    expect(idea.ledger.holdings.AAPL.settlementPending).toMatchObject({ session: DUE, replacedExit: { reason: 'line', session: S[8] }, waiting: { attempts: 2, sessions: [S[9], DUE] } });
    expect(idea.result).toMatchObject({ contractCondition: 'breached', processQuality: 'blocked' });
    // The settlement sale waits too: the slot stays occupied, session after session.
    await win(ctx, AFTER_DUE, 'open30', { AAPL: undefined });
    await closeDay(ctx, AFTER_DUE);
    expect(bookOf(ctx).slots.short).toBe(ctx.ideaId);
    expect(ideaOf(ctx).ledger.holdings.AAPL.settlementPending.waiting.sessions).toEqual([S[9], DUE, AFTER_DUE]);
    const refused = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ names: ['MSFT'], capitalUsd: 15000 }), opId: 'idea-2', nowIso: etIso(S[12], 11, 0) });
    expect(refused.refusals.map((r) => r.code)).toContain('slot_occupied');
    // It fills when a price appears: exactly one sale of the holding, a settlement sale.
    const w = await win(ctx, S[12], 'open30');
    expect(w.sales).toMatchObject({ sold: 1, resulted: 1 });
    expect(decisionsOf(ctx).filter((d) => d.verb === 'SELL').map((d) => d.origin)).toEqual(['settlement']);
    expect(bookOf(ctx).slots.short).toBeNull();
  });
});

describe('B-DUE-BREACH (E7) — on the due session the due date wins', () => {
  it('a close below a line on the due session records breached and produces exactly one sale: the settlement liquidation', async () => {
    const ctx = await setup({ contract: { names: ['AAPL', 'MSFT'] } });
    await closeRange(ctx, 0, 9);
    const level = lineOf(ctx, 'AAPL').level;
    await closeDay(ctx, DUE, { AAPL: below(level) });
    const idea = ideaOf(ctx);
    expect(idea.status).toBe('settled'); // never `line_hit_exit_pending`
    expect(idea.statusHistory.map((h) => h.status)).toEqual(['accepted', 'entering', 'holding', 'settled']);
    expect(lineOf(ctx, 'AAPL').breach).toMatchObject({ session: DUE, close: below(level), level, onDueSession: true });
    expect(idea.ledger.holdings.AAPL.exitPending).toBeUndefined(); // no separate line exit is queued
    expect(idea.ledger.holdings.AAPL.settlementPending).toMatchObject({ session: DUE, replacedExit: null });
    expect(idea.result).toMatchObject({ contractCondition: 'breached', contractDetail: { breaches: [{ symbol: 'AAPL', session: DUE, onDueSession: true }] } });
    expect(getRow(ctx.db, ctx.bookId, ctx.ideaId, DUE).lineObservations).toEqual({ AAPL: 'below', MSFT: 'at_or_above' });
    const w = await win(ctx, AFTER_DUE, 'open30', { AAPL: below(level) });
    expect(w.sales).toMatchObject({ sold: 2, resulted: 1 });
    const sells = decisionsOf(ctx).filter((d) => d.verb === 'SELL');
    expect(sells.map((d) => [d.ticker, d.origin]).sort()).toEqual([['AAPL', 'settlement'], ['MSFT', 'settlement']]); // exactly one sale per holding
  });
});

describe('Q-2 and FR-A7 — one rule for every fill: a maximum age, and the stored snapshot', () => {
  const staleAt = (date, slot) => new Date(Date.parse(slotNowOf(date, slot).toISOString()) - 60_000 - 21 * 60_000).toISOString();
  const freshEnoughAt = (date, slot) => new Date(Date.parse(slotNowOf(date, slot).toISOString()) - 60_000 - 20 * 60_000).toISOString();

  it('a 21-minute-old quote is refused `stale_quote` for an ENTRY and for a SALE; a 20-minute-old one fills', async () => {
    // Entry.
    const { db, bookId, bookRef } = await seedBook();
    const a = await admitIdea(db, { bookId, contract: contractOf({ names: ['AAPL'] }), opId: 'idea-1', nowIso: ADMIT_ISO });
    await storeTickSnapshot(db, S[0], 'open30', quotes({ AAPL: { price: BASE.AAPL, at: staleAt(S[0], 'open30') } }));
    expect(await enterIdea(db, { bookRef, ideaId: a.ideaId, tick: tickOf(S[0], 'open30'), nowIso: slotNowOf(S[0]).toISOString() }))
      .toEqual({ outcome: 'waiting', refusals: [{ symbol: 'AAPL', refusal: 'stale_quote' }] });
    await storeTickSnapshot(db, S[0], 'midday', quotes({ AAPL: { price: BASE.AAPL, at: freshEnoughAt(S[0], 'midday') } }));
    expect((await enterIdea(db, { bookRef, ideaId: a.ideaId, tick: tickOf(S[0], 'midday'), nowIso: slotNowOf(S[0], 'midday').toISOString() })).outcome).toBe('entered');
    // Sale.
    const ctx = { db, bookId, bookRef, ideaId: a.ideaId };
    await closeDay(ctx, S[0], { AAPL: below(lineOf(ctx, 'AAPL').level) });
    const refused = await win(ctx, S[1], 'open30', { AAPL: { price: 215.5, at: staleAt(S[1], 'open30') } });
    expect(refused.sales).toMatchObject({ sold: 0, waiting: 1 });
    expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending.waiting.lastRefusal).toBe('stale_quote');
    const filled = await win(ctx, S[1], 'midday', { AAPL: { price: 215.5, at: freshEnoughAt(S[1], 'midday') } });
    expect(filled.sales).toMatchObject({ sold: 1 });
  });

  it('a sale reads THE STORED slot snapshot itself: a caller\'s object never reaches the fill, and a stored document that is not the slot\'s own is refused', async () => {
    const ctx = await setup({ contract: { names: ['AAPL', 'MSFT'] } });
    await closeDay(ctx, S[0], { AAPL: below(lineOf(ctx, 'AAPL').level) });
    const tick = tickOf(S[1], 'open30');
    const nowIso = slotNowOf(S[1]).toISOString();
    // (a) Nothing stored; a caller hands a snapshot object: it is not read, and nothing fills.
    const handed = tickSnapshot(S[1], 'open30', quotes({ AAPL: 219.99 }));
    expect(await sellPendingHoldings(ctx.db, { bookRef: ctx.bookRef, ideaId: ctx.ideaId, tick, nowIso, snapshot: handed })).toMatchObject({ outcome: 'waiting', sold: [] });
    expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending.waiting.lastRefusal).toBe('no_stored_snapshot');
    // (b) A stored document that is not this slot's own — a close snapshot, another session's — is refused whole.
    for (const wrong of [{ ...tickSnapshot(S[1], 'midday', quotes()), sessionDate: S[2] }, tickSnapshot(S[0], 'midday', quotes())]) {
      ctx.db._store.set(`mandateUniverseSnapshots/${S[1]}_midday`, { data: wrong, version: 1 });
      const bytes = moneyStoreBytes(ctx.db);
      await expect(sellPendingHoldings(ctx.db, { bookRef: ctx.bookRef, ideaId: ctx.ideaId, tick: tickOf(S[1], 'midday'), nowIso: slotNowOf(S[1], 'midday').toISOString() })).rejects.toThrow(/sale_snapshot_mismatch/);
      expect(moneyStoreBytes(ctx.db)).toBe(bytes);
    }
    // (c) The stored document and the caller's object differ: the STORED price fills.
    await storeTickSnapshot(ctx.db, S[1], 'preClose', quotes({ AAPL: 216.31 }));
    const out = await sellPendingHoldings(ctx.db, { bookRef: ctx.bookRef, ideaId: ctx.ideaId, tick: tickOf(S[1], 'preClose'), nowIso: slotNowOf(S[1], 'preClose').toISOString(), snapshot: tickSnapshot(S[1], 'preClose', quotes({ AAPL: 999.99 })) });
    expect(out.outcome).toBe('sold');
    expect(ideaOf(ctx).ledger.saleReceipts[0].mark).toBe(216.31);
    recon(ctx);
  });

  it('planPendingSales is pure, and a sale whose book position is not the idea\'s own is refused before anything is written', async () => {
    const ctx = await setup({ contract: { names: ['AAPL'] } });
    await closeDay(ctx, S[0], { AAPL: below(lineOf(ctx, 'AAPL').level) });
    const book = bookOf(ctx);
    const idea = ideaOf(ctx);
    const frozen = JSON.stringify([book, idea]);
    const snapshot = tickSnapshot(S[1], 'open30', quotes());
    const plan = planPendingSales({ book, idea, others: [], snapshot, tick: tickOf(S[1], 'open30'), nowIso: slotNowOf(S[1]).toISOString() });
    expect(plan).toMatchObject({ changed: true, resulted: false, sold: [{ symbol: 'AAPL', origin: 'line_exit' }] });
    expect(JSON.stringify([book, idea])).toBe(frozen); // the inputs are not mutated
    const foreign = { ...book, portfolio: { ...book.portfolio, positions: { AAPL: { ...book.portfolio.positions.AAPL, ideaId: 'another-idea' } } } };
    expect(() => planPendingSales({ book: foreign, idea, others: [], snapshot, tick: tickOf(S[1], 'open30'), nowIso: slotNowOf(S[1]).toISOString() })).toThrow(/sale_position_mismatch/);
  });

  it('the sales pass serves an active or a draining book and nothing else; one idea\'s failure does not block another\'s sale', async () => {
    const ctx = await setup({ contract: { names: ['AAPL'] } });
    const second = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ slot: 'medium', names: ['JPM'], capitalUsd: 25000 }), opId: 'idea-2', quotes: quotes(), date: S[0] });
    await closeDay(ctx, S[0], { AAPL: below(lineOf(ctx, 'AAPL').level), JPM: below(lineOf(ctx, 'JPM', second.ideaId).level) });
    await storeTickSnapshot(ctx.db, S[1], 'open30', quotes());
    const tick = tickOf(S[1], 'open30');
    await ctx.bookRef.update({ status: 'closed' });
    expect(await runIdeaBookSalesPass(ctx.db, { bookRef: ctx.bookRef, tick, now: slotNowOf(S[1]) })).toEqual({ served: false, sold: 0, waiting: 0, resulted: 0, errors: 0, alerts: [] });
    await ctx.bookRef.update({ status: 'active' });
    // The first idea's sale transaction fails; the second idea's still runs.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let failures = 1;
    const flaky = { ...ctx.db, runTransaction: async (fn, opts) => { if (failures > 0) { failures -= 1; throw Object.assign(new Error('UNAVAILABLE: injected'), { code: 14 }); } return ctx.db.runTransaction(fn, opts); } };
    const flakyRef = flaky.collection('mandates').doc(ctx.bookId);
    expect(await runIdeaBookSalesPass(flaky, { bookRef: flakyRef, tick, now: slotNowOf(S[1]) })).toMatchObject({ served: true, sold: 1, errors: 1 });
    expect(errors.mock.calls.some((c) => /sale failed/.test(String(c[0])))).toBe(true);
    expect(await runIdeaBookSalesPass(ctx.db, { bookRef: ctx.bookRef, tick, now: slotNowOf(S[1]) })).toMatchObject({ served: true, sold: 1, errors: 0 });
    recon(ctx);
  });
});

describe('create-once (contract §10) — a sale\'s receipt and an idea\'s endpoint can each be written only once', () => {
  it('a sale whose receipt already exists aborts whole: nothing is sold, nothing is written', async () => {
    const ctx = await setup({ contract: { names: ['AAPL', 'MSFT'] } });
    await closeDay(ctx, S[0], { AAPL: below(lineOf(ctx, 'AAPL').level) });
    // A receipt under the sale's own id is already in the store (it should be impossible: an idea sells a holding once).
    await ctx.bookRef.collection('decisions').doc(saleDecisionId(ctx.ideaId, 'line_exit', 'AAPL')).set({ planted: true });
    await storeTickSnapshot(ctx.db, S[1], 'open30', quotes());
    const bytes = moneyStoreBytes(ctx.db);
    await expect(sellPendingHoldings(ctx.db, { bookRef: ctx.bookRef, ideaId: ctx.ideaId, tick: tickOf(S[1], 'open30'), nowIso: slotNowOf(S[1]).toISOString() })).rejects.toThrow(/ALREADY_EXISTS/);
    expect(moneyStoreBytes(ctx.db)).toBe(bytes);
    expect(Object.keys(ideaOf(ctx).ledger.holdings)).toEqual(['AAPL', 'MSFT']);
  });

  it('an endpoint row that already exists aborts the close that would write a second: no result, no settled status, no row of the date', async () => {
    const ctx = await setup({ contract: { names: ['AAPL'] } });
    await closeRange(ctx, 0, 9);
    await ctx.bookRef.collection('ideas').doc(ctx.ideaId).collection('rows').doc('endpoint').set({ planted: true });
    await storeCloseSnapshot(ctx.db, DUE, quotes());
    const bytes = moneyStoreBytes(ctx.db);
    await expect(closeIdeaBook(ctx.db, ctx.bookRef, { date: DUE, now: closeNowOf(DUE) })).rejects.toThrow(/ALREADY_EXISTS/);
    expect(moneyStoreBytes(ctx.db)).toBe(bytes);
    expect(ideaOf(ctx)).toMatchObject({ status: 'holding', result: null });
    expect(getRow(ctx.db, ctx.bookId, ctx.ideaId, DUE)).toBeUndefined();
  });
});

describe('rule 7 — every sale goes through executeIdeaFill; no other module calls the engine\'s fill computation (a static check of the source)', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const modules = readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).sort();
  const src = (f) => readFileSync(join(dir, f), 'utf8');
  /** A module's source without its comment lines. */
  const code = (f) => src(f).split(/\r?\n/).filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
  const importersOf = (engineModule) => modules.filter((f) => new RegExp(`from\\s+['"]\\.\\./${engineModule}\\.js['"]`).test(code(f)));

  it('the scan reads the real modules', () => {
    expect(modules.length).toBeGreaterThan(15);
    for (const f of ['fills.js', 'exits.js', 'close.js', 'entry.js', 'settlement.js', 'ledger.js']) expect(modules, f).toContain(f);
  });

  it('only fills.js imports the engine\'s execution module, and from it only the fill computation, which it never calls by name', () => {
    expect(importersOf('mandateExecution')).toEqual(['fills.js']);
    expect(code('fills.js')).toMatch(/^import \{ computeExecution \} from '\.\.\/mandateExecution\.js';$/m);
    // The wrapper calls it through its injectable `compute` parameter; nothing anywhere calls `computeExecution(` itself.
    for (const f of modules) expect(/\bcomputeExecution\s*\(/.test(code(f)), f).toBe(false);
    for (const f of modules) expect(/\b(executeDecision|disposeSubmission|executedPriceFor)\b/.test(code(f)), f).toBe(false);
  });

  it('exits.js sells by one call to executeIdeaFill; the close and the settlement module never fill', () => {
    expect((code('exits.js').match(/\bexecuteIdeaFill\s*\(/g) || [])).toHaveLength(1);
    expect(code('exits.js')).toMatch(/verb: 'SELL'/);
    for (const f of ['close.js', 'settlement.js', 'reconcile.js', 'ledger.js', 'admission.js', 'sweep.js']) expect(/\bexecuteIdeaFill\b/.test(code(f)), f).toBe(false);
    // The only modules that fill at all: the entry (buys) and the exits (sells).
    expect(modules.filter((f) => /\bexecuteIdeaFill\s*\(/.test(code(f)) && f !== 'fills.js')).toEqual(['entry.js', 'exits.js']);
  });

  it('the engine\'s corporate-action applier — whose delisting is a forced sale at a mark — is imported only by the ledger (behind its cash-amount guard) and by the close (the book\'s mirror of what the ledger applied)', () => {
    expect(importersOf('mandateCorporateActions')).toEqual(['close.js', 'ledger.js']);
  });
});

describe('the review\'s sale rules — a sale\'s window, its session, its lateness, and a corporate action in the way', () => {
  /** An idea with MSFT waiting to exit on its line since S[1]'s close. */
  async function pendingExit() {
    const ctx = await setup();
    await closeDay(ctx, S[0]);
    await closeDay(ctx, S[1], { MSFT: below(lineOf(ctx, 'MSFT').level) });
    expect(ideaOf(ctx).status).toBe('line_hit_exit_pending');
    return ctx;
  }
  const sell = (ctx, tick, now) => sellPendingHoldings(ctx.db, { bookRef: ctx.bookRef, ideaId: ctx.ideaId, tick, nowIso: (now ?? slotNowOf(tick.date, tick.slot)).toISOString() });

  it('code sells at its windows only (review SX-8): a close key, or a key that is not the slot\'s own, sells nothing and writes nothing', async () => {
    const ctx = await pendingExit();
    await storeTickSnapshot(ctx.db, S[2], 'open30', quotes());
    await storeCloseSnapshot(ctx.db, S[2], quotes());
    const before = moneyStoreBytes(ctx.db);
    const notWindows = [
      { date: S[2], slot: 'close', tickKey: `${S[2]}_close` }, // the close snapshot is never a sale's price
      { date: S[2], slot: 'open30', tickKey: `${S[2]}_close` }, // …under a window's name either
      { date: S[2], slot: 'open30', tickKey: `${S[1]}_open30` }, // another session's window
      { date: S[2], slot: 'open30', tickKey: `${S[2]}_midday` }, // another slot's
    ];
    for (const tick of notWindows) {
      expect(await sell(ctx, tick, slotNowOf(S[2])), tick.tickKey).toEqual({ outcome: 'not_a_sale_window' });
      expect(await runIdeaBookSalesPass(ctx.db, { bookRef: ctx.bookRef, tick, now: slotNowOf(S[2]) }), tick.tickKey).toEqual({ served: false, sold: 0, waiting: 0, resulted: 0, errors: 0, alerts: [] });
    }
    expect(moneyStoreBytes(ctx.db)).toBe(before);
    expect((await sell(ctx, tickOf(S[2], 'open30'))).outcome).toBe('sold'); // the window itself sells
  });

  it('nothing moves past an unclosed session (review RH-1): a sale is refused while an earlier session of the book is unclosed, and in a session whose close is already written', async () => {
    const ctx = await pendingExit();
    // S[2] is never closed. S[3]'s window, asked directly for the sale: refused, nothing recorded — not even a wait.
    await storeTickSnapshot(ctx.db, S[3], 'open30', quotes());
    const before = moneyStoreBytes(ctx.db);
    expect(await sell(ctx, tickOf(S[3], 'open30'))).toEqual({ outcome: 'not_this_session', reason: 'earlier_session_unclosed' });
    // A window dated in S[1], whose close is written.
    await storeTickSnapshot(ctx.db, S[1], 'preClose', quotes());
    expect(await sell(ctx, tickOf(S[1], 'preClose'), new Date(closeNowOf(S[1]).getTime() + 60_000))).toEqual({ outcome: 'not_this_session', reason: 'session_already_closed' });
    expect(moneyStoreBytes(ctx.db)).toBe(before);
    // S[2]'s own window: the session after the last close. It sells.
    expect((await win(ctx, S[2], 'open30')).sales).toMatchObject({ sold: 1 });
  });

  it('the close refuses a book whose fills are dated after the session it would close (review RH-1): no row of that session is written over a later present', async () => {
    const ctx = await pendingExit();
    expect((await win(ctx, S[2], 'open30')).sales).toMatchObject({ sold: 1 }); // a sale dated S[2]
    // Forge the one state the gate makes unreachable: the book says its last close was S[0].
    await ctx.bookRef.update({ 'execState.lastCloseKey': S[0] });
    await storeCloseSnapshot(ctx.db, S[2], quotes());
    const before = moneyStoreBytes(ctx.db);
    await expect(closeIdeaBook(ctx.db, ctx.bookRef, { date: S[2], now: closeNowOf(S[2]) })).rejects.toMatchObject({ code: 'sale_filled_after_unclosed_session', detail: { session: S[1], sales: [{ ideaId: ctx.ideaId, symbol: 'MSFT', sold: S[2] }] } });
    expect(moneyStoreBytes(ctx.db)).toBe(before);
    // The same for an ENTRY dated after the session.
    await ctx.bookRef.update({ 'execState.lastCloseKey': S[1] });
    await closeDay(ctx, S[2]);
    const second = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 25000 }), opId: 'second', nowIso: etIso(S[2], 17, 0) });
    expect(second).toMatchObject({ ok: true, startSession: S[3] });
    expect((await win(ctx, S[3], 'open30')).entries).toMatchObject({ entered: 1 });
    await ctx.bookRef.update({ 'execState.lastCloseKey': S[1] });
    await storeCloseSnapshot(ctx.db, S[3], quotes());
    const again = moneyStoreBytes(ctx.db);
    await expect(closeIdeaBook(ctx.db, ctx.bookRef, { date: S[3], now: closeNowOf(S[3]) })).rejects.toMatchObject({ code: 'idea_filled_after_unclosed_session', detail: { session: S[2], ideas: [{ ideaId: second.ideaId, entered: S[3] }] } });
    expect(moneyStoreBytes(ctx.db)).toBe(again);
  });

  it('E15 (review RH-5): a sale filled later than its first eligible window with no refusal on record — no pass ran then — reads blocked; one filled at its first window does not', async () => {
    const late = await pendingExit();
    // S[2]'s first window never ran. The midday window fills the sale.
    expect((await win(late, S[2], 'midday', { MSFT: 380.2 })).sales).toMatchObject({ sold: 1 });
    const idea = ideaOf(late);
    expect(idea.ledger.saleReceipts[0]).toMatchObject({ firstEligibleWindow: `${S[2]}_open30`, tickKey: `${S[2]}_midday`, queuedBy: { waitedSessions: 0 } });
    expect(idea.processQuality).toBe('blocked');
    expect(idea.blockedBy).toEqual([{ kind: 'line_exit_late', symbol: 'MSFT', session: S[2], firstWindow: `${S[2]}_open30`, filledAt: `${S[2]}_midday` }]);
    await closeRange(late, 2, 10);
    expect(ideaOf(late).result).toMatchObject({ processQuality: 'blocked', processDetail: { blockedBy: [{ kind: 'line_exit_late', symbol: 'MSFT' }] } });

    const onTime = await pendingExit();
    expect((await win(onTime, S[2], 'open30', { MSFT: 380.2 })).sales).toMatchObject({ sold: 1 });
    expect(ideaOf(onTime)).toMatchObject({ processQuality: 'followed_plan', blockedBy: [] });
    expect(ideaOf(onTime).ledger.saleReceipts[0]).toMatchObject({ firstEligibleWindow: `${S[2]}_open30`, tickKey: `${S[2]}_open30` });
    // A settlement sale filled a window late says so under its own name.
    await closeRange(onTime, 2, 10);
    expect(ideaOf(onTime).status).toBe('settled');
    expect((await win(onTime, AFTER_DUE, 'midday')).sales).toMatchObject({ sold: 2, resulted: 1 });
    const done = ideaOf(onTime);
    expect(done.blockedBy.map((b) => b.kind)).toEqual(['settlement_sale_late', 'settlement_sale_late']);
    expect(done.liquidation).toMatchObject({ processQuality: 'blocked', blockedBy: [{ kind: 'settlement_sale_late', symbol: 'AAPL' }, { kind: 'settlement_sale_late', symbol: 'NVDA' }] });
    expect(done.result.processQuality).toBe('followed_plan'); // the result was written at the endpoint and is not amended
  });

  it('nothing is attempted before a sale\'s first eligible window, and a window whose quotes all predate the decision is not that window (review SX-10): a close that ran late, just before a slot', async () => {
    const ctx = await setup();
    await closeDay(ctx, S[0]);
    // S[1]'s close runs LATE — the next morning, four minutes before S[2]'s first window opens.
    await storeCloseSnapshot(ctx.db, S[1], quotes({ MSFT: below(lineOf(ctx, 'MSFT').level) }));
    const lateClose = new Date(Date.parse(slotOpenIso(S[2], 'open30')) - 4 * 60_000);
    expect(await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[1], now: lateClose })).toMatchObject({ closed: true });
    const pending = ideaOf(ctx).ledger.holdings.MSFT.exitPending;
    expect(pending).toMatchObject({ reason: 'line', at: lateClose.toISOString(), waiting: null });
    // The pure plan, asked at a window BEFORE the first eligible one: nothing is attempted and nothing is recorded.
    const early = planPendingSales({ book: bookOf(ctx), idea: ideaOf(ctx), others: [], snapshot: tickSnapshot(S[1], 'preClose', quotes()), tick: tickOf(S[1], 'preClose'), nowIso: lateClose.toISOString() });
    expect(early).toMatchObject({ changed: false, sold: [], waited: [] });
    expect(early.nextIdea.ledger.holdings.MSFT.exitPending).toEqual(pending);
    // S[2]'s first window opens after the decision, but every quote in it was observed before the decision: it was
    // never eligible. Nothing is sold, nothing is counted as a wait, and the idea is not blocked.
    const first = await win(ctx, S[2], 'open30');
    expect(first.sales).toMatchObject({ sold: 0, waiting: 0 });
    expect(ideaOf(ctx).ledger.holdings.MSFT.exitPending).toMatchObject({ waiting: null, notBefore: { date: S[2], slot: 'open30', tickKey: `${S[2]}_open30` } });
    expect(ideaOf(ctx)).toMatchObject({ blockedBy: [], waitedSessions: [] });
    const marked = moneyStoreBytes(ctx.db);
    await win(ctx, S[2], 'open30'); // the slot's second fire: marked once
    expect(moneyStoreBytes(ctx.db)).toBe(marked);
    // The next window is the first eligible one: it fills there, on time.
    expect((await win(ctx, S[2], 'midday', { MSFT: 380.2 })).sales).toMatchObject({ sold: 1 });
    expect(ideaOf(ctx).ledger.saleReceipts[0]).toMatchObject({ firstEligibleWindow: `${S[2]}_midday`, tickKey: `${S[2]}_midday` });
    expect(ideaOf(ctx)).toMatchObject({ processQuality: 'followed_plan', blockedBy: [] });
  });

  it('a sale never fills across a corporate action (review SX-1): on the day a split takes effect the window shows the adjusted price beside an unadjusted holding — the sale waits, the close applies the split, and the next window sells the adjusted shares', async () => {
    const ctx = await pendingExit();
    const split = { type: 'split', ticker: 'MSFT', effectiveDate: S[2], ratio: 2, source: 'eodhd_splits' };
    const shares = ideaOf(ctx).ledger.holdings.MSFT.shares;
    const basis = ideaOf(ctx).ledger.holdings.MSFT.costBasisTotal;
    const halved = 190.4;
    const first = await win(ctx, S[2], 'open30', { MSFT: { price: halved, corporateActions: [split] } });
    expect(first.sales).toMatchObject({ sold: 0, waiting: 1 });
    let idea = ideaOf(ctx);
    expect(idea.ledger.saleReceipts).toEqual([]); // not sold at half the value
    expect(idea.ledger.holdings.MSFT).toMatchObject({ shares, exitPending: { waiting: { attempts: 1, lastRefusal: 'corporate_action_pending' } } });
    expect(idea.blockedBy).toEqual([{ kind: 'line_exit_held_for_corporate_action', symbol: 'MSFT', session: S[2] }]); // held, not waiting for a price
    // The close applies the split; the sale then fills the doubled quantity at the adjusted price.
    await closeDay(ctx, S[2], { MSFT: { price: halved, corporateActions: [split] } });
    expect(ideaOf(ctx).ledger.holdings.MSFT.shares).toBe(roundShares(shares * 2));
    expect((await win(ctx, S[3], 'open30', { MSFT: { price: 191.1, corporateActions: [split] } })).sales).toMatchObject({ sold: 1 });
    idea = ideaOf(ctx);
    expect(idea.ledger.saleReceipts[0]).toMatchObject({ kind: 'line_exit', shares: roundShares(shares * 2), mark: 191.1, costBasisUsd: basis });
  });

  it('…and without a feed entry: an overnight move with a split\'s signature holds the sale back as a suspected corporate action; an unsettled conflict on the symbol does too', async () => {
    const ctx = await pendingExit();
    // Half the last close, nothing in the feed: the engine's gap screen (the close holds the MARK back on the same test).
    const first = await win(ctx, S[2], 'open30', { MSFT: roundUsd(ideaOf(ctx).ledger.holdings.MSFT.lastMark / 2) });
    expect(first.sales).toMatchObject({ sold: 0, waiting: 1 });
    expect(ideaOf(ctx).ledger.holdings.MSFT.exitPending.waiting.lastRefusal).toBe('suspected_corporate_action');
    expect(ideaOf(ctx).blockedBy).toEqual([{ kind: 'line_exit_held_for_corporate_action', symbol: 'MSFT', session: S[2] }]); // held, not a wait for a price
    expect(ideaOf(ctx).ledger.saleReceipts).toEqual([]);
    // The pure question, on a ledger carrying an unsettled conflict for the symbol.
    const ledger = structuredClone(ideaOf(ctx).ledger);
    const snapshot = tickSnapshot(S[2], 'midday', quotes());
    expect(saleHeldBackBy(ledger, 'MSFT', snapshot, { sinceDate: S[1], date: S[2] })).toBeNull();
    expect(saleHeldBackBy(ledger, 'AAPL', snapshot, { sinceDate: S[1], date: S[2] })).toBeNull();
    expect(saleHeldBackBy(ledger, 'TSLA', snapshot, { sinceDate: S[1], date: S[2] })).toBeNull(); // not held: nothing to hold back
    const twoSplits = tickSnapshot(S[2], 'midday', quotes({ MSFT: { price: 209.07, corporateActions: [
      { type: 'split', ticker: 'MSFT', effectiveDate: S[2], ratio: 2, source: 'eodhd_splits' }, { type: 'split', ticker: 'MSFT', effectiveDate: S[2], ratio: 3, source: 'eodhd_splits' },
    ] } }));
    expect(saleHeldBackBy(ledger, 'MSFT', twoSplits, { sinceDate: S[1], date: S[2] })).toBe('corporate_action_pending');
    const conflicted = { ...ledger, corporateActionReceipts: [...ledger.corporateActionReceipts, { actionId: 'split_MSFT_' + S[1], type: 'split', ticker: 'MSFT', effectiveDate: S[1], applied: false, reason: 'conflicting_action', seenOn: S[1] }] };
    expect(saleHeldBackBy(conflicted, 'MSFT', snapshot, { sinceDate: S[1], date: S[2] })).toBe('corporate_action_unsettled');
    expect(saleHeldBackBy(conflicted, 'AAPL', snapshot, { sinceDate: S[1], date: S[2] })).toBeNull();
    // A delisting with NO cash amount is the very reason such a holding waits to be sold: it holds nothing back.
    const delisted = tickSnapshot(S[2], 'midday', quotes({ MSFT: { price: 418.2, corporateActions: [{ type: 'delisting', ticker: 'MSFT', effectiveDate: S[2], source: 'founder_action' }] } }));
    expect(saleHeldBackBy(ledger, 'MSFT', delisted, { sinceDate: S[1], date: S[2] })).toBeNull();
    // …one WITH a cash amount is a payment the close will make: the sale waits for it.
    const paid = tickSnapshot(S[2], 'midday', quotes({ MSFT: { price: 418.2, corporateActions: [{ type: 'delisting', ticker: 'MSFT', effectiveDate: S[2], cashPerShare: 418.5, source: 'founder_action' }] } }));
    expect(saleHeldBackBy(ledger, 'MSFT', paid, { sinceDate: S[1], date: S[2] })).toBe('corporate_action_pending');
    // An action dated AFTER the window's session is not due yet.
    const later = tickSnapshot(S[2], 'midday', quotes({ MSFT: { price: 418.2, corporateActions: [{ type: 'split', ticker: 'MSFT', effectiveDate: S[3], ratio: 2, source: 'eodhd_splits' }] } }));
    expect(saleHeldBackBy(ledger, 'MSFT', later, { sinceDate: S[1], date: S[2] })).toBeNull();
  });
});

describe('the second refuter pass — what the review\'s own fixes left open', () => {
  /** An idea with MSFT waiting to exit on its line since S[1]'s close. */
  async function pendingExit() {
    const ctx = await setup();
    await closeDay(ctx, S[0]);
    await closeDay(ctx, S[1], { MSFT: below(lineOf(ctx, 'MSFT').level) });
    return ctx;
  }

  it('2a — on a day the corporate-action fetch FAILED for the symbol (the daily layer says so; the slot snapshot cannot) the sale waits under its own name; the next day it fills', async () => {
    const ctx = await pendingExit();
    // The engine's daily document of S[2]: the fetch failed for MSFT only.
    await ctx.db.collection('mandateUniverseDaily').doc(S[2]).set({ date: S[2], symbols: { MSFT: { caFetchFailed: true }, AAPL: { sector: 'Technology' } } });
    const dailyBefore = JSON.stringify(ctx.db._get(`mandateUniverseDaily/${S[2]}`));
    for (const slot of ['open30', 'midday', 'preClose']) expect((await win(ctx, S[2], slot)).sales, slot).toMatchObject({ sold: 0, waiting: 1 });
    let idea = ideaOf(ctx);
    expect(idea.ledger.saleReceipts).toEqual([]);
    expect(idea.ledger.holdings.MSFT.exitPending.waiting).toMatchObject({ attempts: 3, lastRefusal: 'corporate_action_data_missing' });
    expect(idea.blockedBy).toEqual([{ kind: 'line_exit_held_for_corporate_action', symbol: 'MSFT', session: S[2] }]);
    expect(JSON.stringify(ctx.db._get(`mandateUniverseDaily/${S[2]}`))).toBe(dailyBefore); // read, never written
    // A symbol whose fetch did not fail is not held: the same day, another idea's sale would fill (the pure plan).
    const plan = (daily) => planPendingSales({ book: bookOf(ctx), idea: ideaOf(ctx), others: [], snapshot: tickSnapshot(S[2], 'preClose', quotes()), daily, tick: tickOf(S[2], 'preClose'), nowIso: slotNowOf(S[2], 'preClose').toISOString() });
    expect(plan({ symbols: { AAPL: { caFetchFailed: true }, MSFT: { sector: 'Technology' } } }).sold).toHaveLength(1); // another symbol's failure holds nothing
    expect(plan({ symbols: { MSFT: { caFetchFailed: true } } }).sold).toHaveLength(0);
    // A daily document with NO ENTRY for the symbol (built without the idea book's coverage) knows as little: held.
    const absent = plan({ symbols: { AAPL: { sector: 'Technology' } } });
    expect(absent.sold).toHaveLength(0);
    expect(absent.waited).toEqual([expect.objectContaining({ symbol: 'MSFT', refusal: 'corporate_action_data_missing' })]);
    expect(plan({ date: S[2] }).sold).toHaveLength(0); // …or with no symbols at all
    // No daily document at all: nothing can be said either way, and the slot snapshot's own lists are all there is.
    expect(plan(null).sold).toHaveLength(1);
    // The next day's document has no failure: the sale fills.
    await closeDay(ctx, S[2]);
    await ctx.db.collection('mandateUniverseDaily').doc(S[3]).set({ date: S[3], symbols: { MSFT: { sector: 'Technology' } } });
    expect((await win(ctx, S[3], 'open30')).sales).toMatchObject({ sold: 1 });
    idea = ideaOf(ctx);
    expect(idea.ledger.saleReceipts[0]).toMatchObject({ kind: 'line_exit', sessionDate: S[3], queuedBy: { waitedSessions: 1 } });
  });

  it('2b — a conflicting CASH DIVIDEND holds no sale (no share count is in doubt, and once the feed drops it nothing would ever release it); a share-basis conflict still does', async () => {
    const ctx = await pendingExit();
    const ledger = structuredClone(ideaOf(ctx).ledger);
    const snapshot = tickSnapshot(S[2], 'open30', quotes());
    const conflict = (type) => ({ actionId: `${type}_MSFT_${S[1]}`, type, ticker: 'MSFT', effectiveDate: S[1], applied: false, reason: 'conflicting_action', seenOn: S[1] });
    const withConflict = (type) => ({ ...ledger, corporateActionReceipts: [...ledger.corporateActionReceipts, conflict(type)] });
    const held = (l, snap = snapshot) => saleHeldBackBy(l, 'MSFT', snap, { sinceDate: S[1], date: S[2] });
    expect(held(withConflict('cash_dividend'))).toBeNull();
    // Fail-closed for every other kind, and for a receipt that cannot say what it is.
    for (const type of ['split', 'reverse_split', 'stock_distribution', 'ticker_change', 'delisting', 'something_new', undefined]) expect(held(withConflict(type)), String(type)).toBe('corporate_action_unsettled');
    // WHILE THE FEED STILL LISTS A ROW OF THE CONFLICTED DIVIDEND the sale waits (third refuter pass): the feed may
    // yet settle on one row, and the close then credits the idea what its comparison gets. Both rows listed…
    const rows = [{ type: 'cash_dividend', ticker: 'MSFT', effectiveDate: S[1], amount: 0.83, source: 'eodhd_dividends' }, { type: 'cash_dividend', ticker: 'MSFT', effectiveDate: S[1], amount: 0.91, source: 'eodhd_dividends' }];
    const listed = tickSnapshot(S[2], 'open30', quotes({ MSFT: { price: BASE.MSFT, corporateActions: rows } }));
    expect(held(withConflict('cash_dividend'), listed)).toBe('corporate_action_pending');
    // …or the one corrected row.
    const corrected = tickSnapshot(S[2], 'open30', quotes({ MSFT: { price: BASE.MSFT, corporateActions: [rows[0]] } }));
    expect(held(withConflict('cash_dividend'), corrected)).toBe('corporate_action_pending');
    // A single, ordinary dividend the holding is owed is still a payment the close will make: the sale waits for it.
    const one = tickSnapshot(S[2], 'open30', quotes({ MSFT: { price: BASE.MSFT, corporateActions: [{ type: 'cash_dividend', ticker: 'MSFT', effectiveDate: S[2], amount: 0.83, source: 'eodhd_dividends' }] } }));
    expect(held(ledger, one)).toBe('corporate_action_pending');
    // A split conflict through the window: held, under the held name (not a wait for a price).
    const splitCtx = await pendingExit();
    const splitIdea = ideaOf(splitCtx);
    await splitCtx.db.collection('mandates').doc(splitCtx.bookId).collection('ideas').doc(splitCtx.ideaId).set({ ...splitIdea, ledger: { ...splitIdea.ledger, corporateActionReceipts: [conflict('split')] }, comparisonLedger: { ...splitIdea.comparisonLedger, corporateActionReceipts: [conflict('split')] } });
    expect((await win(splitCtx, S[2], 'open30')).sales).toMatchObject({ sold: 0, waiting: 1 });
    expect(ideaOf(splitCtx).ledger.holdings.MSFT.exitPending.waiting.lastRefusal).toBe('corporate_action_unsettled');
    expect(ideaOf(splitCtx).blockedBy).toEqual([{ kind: 'line_exit_held_for_corporate_action', symbol: 'MSFT', session: S[2] }]);
    // Through the window: with the dropped dividend conflict on the ledger the sale FILLS.
    const stored = ideaOf(ctx);
    await ctx.db.collection('mandates').doc(ctx.bookId).collection('ideas').doc(ctx.ideaId).set({ ...stored, ledger: withConflict('cash_dividend'), comparisonLedger: { ...stored.comparisonLedger, corporateActionReceipts: [conflict('cash_dividend')] } });
    recon(ctx);
    expect((await win(ctx, S[2], 'open30')).sales).toMatchObject({ sold: 1, waiting: 0 });
  });

  it('3a — a window whose quotes predate the decision is "never eligible" ONCE; a later window that still shows only that old print is a real wait and is recorded', async () => {
    const ctx = await setup();
    await closeDay(ctx, S[0]);
    await storeCloseSnapshot(ctx.db, S[1], quotes({ MSFT: below(lineOf(ctx, 'MSFT').level) })); // a close nobody ran
    // S[2] open30 catches S[1] up and queues MSFT's exit at the window's own instant. MSFT last printed at 09:45.
    const stale = { price: 398.11, at: etIso(S[2], 9, 45) };
    const first = await win(ctx, S[2], 'open30', { MSFT: stale });
    expect(first).toMatchObject({ caughtUp: [{ date: S[1], observed: true }], sales: { sold: 0, waiting: 0 } }); // before its first window: not attempted
    expect(ideaOf(ctx).ledger.holdings.MSFT.exitPending).toMatchObject({ waiting: null });
    // Midday and preClose: MSFT has still not printed since 09:45 — before the decision, and by now far past the
    // maximum age. Those are eligible windows with no usable price: waits, not "never eligible".
    expect((await win(ctx, S[2], 'midday', { MSFT: stale })).sales).toMatchObject({ sold: 0, waiting: 1 });
    expect((await win(ctx, S[2], 'preClose', { MSFT: stale })).sales).toMatchObject({ sold: 0, waiting: 1 });
    let idea = ideaOf(ctx);
    expect(idea.ledger.holdings.MSFT.exitPending).toMatchObject({ waiting: { attempts: 2, sessions: [S[2]], lastRefusal: 'stale_quote' } });
    expect(idea.ledger.holdings.MSFT.exitPending.notBefore).toBeUndefined();
    expect(idea.waitedSessions).toEqual([S[2]]);
    expect(idea.blockedBy.map((b) => b.kind)).toEqual(['line_recognised_late', 'line_exit_waited']);
    await closeDay(ctx, S[2]);
    expect((await win(ctx, S[3], 'open30', { MSFT: 397.2 })).sales).toMatchObject({ sold: 1 });
    idea = ideaOf(ctx);
    expect(idea.ledger.saleReceipts[0]).toMatchObject({ firstEligibleWindow: `${S[2]}_midday`, tickKey: `${S[3]}_open30`, queuedBy: { waitedSessions: 1 } });
    expect(idea.blockedBy.map((b) => b.kind)).toEqual(['line_recognised_late', 'line_exit_waited']); // waited, so not "late"
  });

  it('3b — a waiting record inherited from the line exit a settlement sale replaced is from before that sale\'s first window: a late settlement fill still says late', async () => {
    const ctx = await setup({ contract: { names: ['AAPL', 'MSFT'] } });
    await closeRange(ctx, 0, 7);
    await closeDay(ctx, S[8], { MSFT: below(lineOf(ctx, 'MSFT').level) });
    // The exit waits through S[9] (no MSFT price), and at the due close becomes the settlement sale.
    for (const slot of ['open30', 'midday', 'preClose']) expect((await win(ctx, S[9], slot, { MSFT: undefined })).sales).toMatchObject({ sold: 0, waiting: 1 });
    await closeDay(ctx, S[9]);
    await closeDay(ctx, DUE);
    const pending = ideaOf(ctx).ledger.holdings.MSFT.settlementPending;
    expect(pending).toMatchObject({ replacedExit: { reason: 'line' }, waiting: { sessions: [S[9]] } });
    // The settlement sales' first window (the morning after the due session) never ran. Midday fills both.
    expect((await win(ctx, AFTER_DUE, 'midday')).sales).toMatchObject({ sold: 2, resulted: 1 });
    const idea = ideaOf(ctx);
    expect(idea.liquidation).toMatchObject({ processQuality: 'blocked' });
    expect(idea.liquidation.blockedBy).toEqual([
      { kind: 'settlement_sale_late', symbol: 'AAPL', session: AFTER_DUE, firstWindow: `${AFTER_DUE}_open30`, filledAt: `${AFTER_DUE}_midday` },
      { kind: 'settlement_sale_late', symbol: 'MSFT', session: AFTER_DUE, firstWindow: `${AFTER_DUE}_open30`, filledAt: `${AFTER_DUE}_midday` },
    ]);
    // …and a settlement sale that WAS refused at its first window, then filled, is a wait, not a lateness.
    const waited = await setup({ contract: { names: ['AAPL'] } });
    await closeRange(waited, 0, 10);
    expect((await win(waited, AFTER_DUE, 'open30', { AAPL: undefined })).sales).toMatchObject({ sold: 0, waiting: 1 });
    expect((await win(waited, AFTER_DUE, 'midday')).sales).toMatchObject({ sold: 1, resulted: 1 });
    expect(ideaOf(waited).liquidation.blockedBy.map((b) => b.kind)).toEqual(['settlement_sale_waited']);
  });
});

describe('the banned-word scan looked at something', () => {
  it('this file wrote results and endpoint rows, and every one was scanned', () => {
    expect(scanned.results).toBeGreaterThan(10);
  });
});
