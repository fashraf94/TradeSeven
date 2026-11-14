// api/_utils/practiceField/catchUp.test.js
//
// Practice Field T1a-2a — MISSED CLOSES, AND DRAINING BOOKS (Amendment E12, E13; Astra T1A-08; build prompt §8;
// acceptance cases B-CATCHUP (37), B-MISSED (9) and the part of B-DRAIN (13) this build owns).
//
// A close for a date first closes every session the book missed before it, in order, each from ITS OWN stored close
// snapshot. A missed session with no stored snapshot is recorded as unobserved. Nothing is fetched or invented, and
// no clock moves.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { admitIdea } from './admission.js';
import { closeIdeaBook, firstUnclosedSessionBefore } from './close.js';
import { runIdeaBookEntryPass } from './entry.js';
import { runIdeaBookEvalPass, runDrainingIdeaBookCloses, withDrainingIdeaBooks, ideaCloseLeftUnclosed, coverageFromStandIn, practiceFieldBuildInputs } from './sweep.js';
import { assertReconciled } from './reconcile.js';
import { nextSessionDate } from './windows.js';
import { CATCH_UP_MAX_SESSIONS_PER_CALL } from './constants.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { roundUsd } from '../mandateRounding.js';
import {
  seedBook, admitAndEnter, closeOn, windowAt, storeTickSnapshot, storeCloseSnapshot, contractOf, getBook, getIdea, getRow, tickOf,
  slotNowOf, closeNowOf, etIso, countDocs, takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults, moneyStoreBytes, makeMandateFakeDb,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'];
const DUE = S[10];
const BASE = { AAPL: 231.47, MSFT: 418.13, JPM: 241.37, SPY: 597.31, XLK: 233.59 };
const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12, JPM: 6.8e11 };
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
const rowOf = (ctx, date, ideaId = ctx.ideaId) => getRow(ctx.db, ctx.bookId, ideaId, date);
const bookRowOf = (ctx, date) => ctx.db._get(`mandates/${ctx.bookId}/dailyRows/${date}`);
const endpointRowOf = (ctx, ideaId = ctx.ideaId) => ctx.db._get(`mandates/${ctx.bookId}/ideas/${ideaId}/rows/endpoint`);
const recon = (ctx) => { const book = bookOf(ctx); return assertReconciled(book, book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id))); };
const closeDay = async (ctx, date, over = {}) => { const out = await closeOn(ctx.db, ctx.bookId, date, quotes(over)); recon(ctx); return out; };
const win = async (ctx, date, slot = 'open30', over = {}) => { const out = await windowAt(ctx.db, ctx.bookId, { date, slot, quotes: quotes(over) }); recon(ctx); return out; };
const lineOf = (ctx, sym) => ideaOf(ctx).lines.find((l) => l.symbol === sym);
async function setup(contract = {}) {
  const { db, bookId, bookRef } = await seedBook();
  const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], ...contract }), quotes: quotes(), date: S[0] });
  const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
  recon(ctx);
  return ctx;
}

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); });
afterEach(() => {
  restoreMode();
  vi.restoreAllMocks();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]);
    expect(bannedWordsOnResults(db)).toEqual([]);
  }
});

describe('B-CATCHUP (E12) — missed closes are caught up before the next close, from stored snapshots only', () => {
  it('two missed sessions are closed in order, each from ITS OWN stored snapshot, before the requested date; each corporate action is applied once', async () => {
    const ctx = await setup();
    await closeDay(ctx, S[0]);
    // S[1] and S[2] are missed — but the engine stored their close snapshots (a dividend goes ex on S[1]).
    const dividend = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], amount: 0.26, source: 'eodhd_dividends' };
    await storeCloseSnapshot(ctx.db, S[1], quotes({ AAPL: { price: 229.7, corporateActions: [dividend] }, MSFT: 421.4 }));
    await storeCloseSnapshot(ctx.db, S[2], quotes({ AAPL: { price: 233.05, corporateActions: [dividend] }, MSFT: 417.9 }));
    const shares = ideaOf(ctx).ledger.holdings.AAPL.shares;
    const out = await closeDay(ctx, S[3], { AAPL: { price: 234.6, corporateActions: [dividend] }, MSFT: 419.2 });
    expect(out).toMatchObject({ closed: true, session: S[3], catchUp: false, caughtUp: [{ date: S[1], observed: true }, { date: S[2], observed: true }], alerts: [] });
    // Each session has its own rows, from its own document, in order.
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/dailyRows/`)).toBe(4);
    for (const [date, aapl, msft] of [[S[1], 229.7, 421.4], [S[2], 233.05, 417.9], [S[3], 234.6, 419.2]]) {
      const row = rowOf(ctx, date);
      expect(row, date).toMatchObject({ date, observed: true, fullQuality: true, closeSnapshotKey: `${date}_close`, marks: { AAPL: { mark: aapl, quality: 'vendor_time' }, MSFT: { mark: msft } } });
      expect(bookRowOf(ctx, date), date).toMatchObject({ date, observed: true, closeSnapshotKey: `${date}_close` });
    }
    // A caught-up row says it was recorded late; the requested date's does not.
    const lateAt = closeNowOf(S[3]).toISOString();
    expect(rowOf(ctx, S[1]).caughtUpAt).toBe(lateAt);
    expect(bookRowOf(ctx, S[2]).caughtUpAt).toBe(lateAt);
    expect(rowOf(ctx, S[3]).caughtUpAt).toBeUndefined();
    // The dividend: presented on three closes, applied once — on the session it went ex.
    const idea = ideaOf(ctx);
    expect(idea.ledger.dividendsUsd).toBe(roundUsd(shares * 0.26));
    expect(idea.ledger.appliedActionIds).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    expect(rowOf(ctx, S[1]).corporateActionsApplied.idea).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    expect(rowOf(ctx, S[2]).corporateActionsApplied.idea).toEqual([]);
    expect(bookOf(ctx).execState.lastCloseKey).toBe(S[3]);
    expect(idea.track).toMatchObject({ rows: 4, closes: 4, rowsNotFullQuality: 0 });
  });

  it('a missed session with NO stored snapshot gets an unobserved row — marks carried, not full quality, every open line unobserved for it — and nothing is fetched or invented', async () => {
    const ctx = await setup();
    await closeDay(ctx, S[0], { AAPL: 230.2, MSFT: 420.6 });
    const before = { idea: ideaOf(ctx), book: bookOf(ctx) };
    // S[1] has no stored document at all; a crash below every line on S[1] can never be seen.
    const errors = [];
    const out = await closeDay(ctx, S[2], { AAPL: 232.9, MSFT: 416.3 });
    errors.push(...out.alerts);
    expect(out).toMatchObject({ closed: true, caughtUp: [{ date: S[1], observed: false }] });
    expect(errors).toEqual([`PRACTICE_FIELD_SESSION_UNOBSERVED ${ctx.bookId} ${S[1]} — no stored close snapshot; the session is recorded as unobserved`]);
    const row = rowOf(ctx, S[1]);
    expect(row).toMatchObject({
      date: S[1], observed: false, fullQuality: false, closeSnapshotKey: null, closeSnapshotBuiltAt: null, rowKind: 'valuation', basis: 'mark',
      marks: { AAPL: { mark: 230.2, quality: 'unobserved', vendorTimeIso: null }, MSFT: { mark: 420.6, quality: 'unobserved' } },
      lineObservations: { AAPL: 'unobserved', MSFT: 'unobserved' },
      corporateActionsApplied: { idea: [], comparison: [], spy: [] },
    });
    expect(row.markedValue).toBe(rowOf(ctx, S[0]).markedValue); // the carried marks: the value did not move
    expect(bookRowOf(ctx, S[1])).toMatchObject({ observed: false, fullQuality: false, closeSnapshotKey: null, markedEquity: bookRowOf(ctx, S[0]).markedEquity });
    const idea = ideaOf(ctx);
    expect(idea.unobservedLineSessions).toEqual({ AAPL: [S[1]], MSFT: [S[1]] });
    expect(idea.status).toBe('holding');
    expect(idea.track).toMatchObject({ rows: 3, rowsNotFullQuality: 1, closes: 2 }); // the unobserved session is a row, not a close value
    // No snapshot was created for the missing session.
    expect(ctx.db._get(`mandateUniverseSnapshots/${S[1]}_close`)).toBeUndefined();
    // The unobserved session itself moved no cash and no quantity.
    expect(rowOf(ctx, S[1]).quantities).toEqual({ AAPL: before.idea.ledger.holdings.AAPL.shares, MSFT: before.idea.ledger.holdings.MSFT.shares });
    expect(rowOf(ctx, S[1]).cash).toBe(before.idea.ledger.cash);
  });

  it('a breach found while catching up is recognised LATE and recorded as late; its sale fills at the next eligible observation after the catch-up', async () => {
    const ctx = await setup({ names: ['AAPL'] });
    await closeDay(ctx, S[0]);
    const level = lineOf(ctx, 'AAPL').level;
    await storeCloseSnapshot(ctx.db, S[1], quotes({ AAPL: roundUsd(level - 0.02) })); // the breach, on a session nobody closed
    // S[2]'s first window catches S[1] up BEFORE it sells or enters (review RH-1): the breach is recognised there, late.
    const first = await win(ctx, S[2], 'open30');
    const caughtAt = slotNowOf(S[2]).toISOString();
    expect(first).toMatchObject({ complete: true, caughtUp: [{ date: S[1], observed: true }] });
    const idea = ideaOf(ctx);
    expect(idea.status).toBe('line_hit_exit_pending');
    expect(idea.lines[0].breach).toMatchObject({ session: S[1], recognisedLate: true, recognisedAt: caughtAt, onDueSession: false });
    expect(idea.ledger.holdings.AAPL.exitPending).toMatchObject({ reason: 'line', session: S[1], at: caughtAt, recognisedLate: true });
    // The window that recognised it cannot fill it: its quote was observed BEFORE the decision existed. That is not a
    // wait — the sale has not had a window yet — so nothing is counted against it (review SX-10).
    expect(first.sales).toMatchObject({ sold: 0, waiting: 0 });
    expect(idea.ledger.holdings.AAPL.exitPending.waiting ?? null).toBeNull();
    expect(idea.ledger.saleReceipts).toEqual([]);
    // The next window fills it — its first eligible observation.
    expect((await win(ctx, S[2], 'midday', { AAPL: 221.3 })).sales).toMatchObject({ sold: 1 });
    expect(ideaOf(ctx).ledger.saleReceipts[0]).toMatchObject({ kind: 'line_exit', sessionDate: S[2], mark: 221.3, firstEligibleWindow: `${S[2]}_midday`, tickKey: `${S[2]}_midday` });
    await closeDay(ctx, S[2]);
    const result = ideaOf(ctx).result;
    expect(result.contractDetail.breaches[0]).toMatchObject({ session: S[1], recognisedLate: true });
    // A stop the process recognised a session late is a blocked process, never `followed_plan` (review RH-5).
    expect(result.processQuality).toBe('blocked');
    expect(result.processDetail.blockedBy.map((b) => b.kind)).toEqual(['line_recognised_late']);
  });

  it('the window catches up a book that has NEVER closed, from the session its first idea filled in — before it sells or enters anything', async () => {
    const ctx = await setup({ names: ['AAPL'] }); // entered on S[0]; no close has ever run
    expect(bookOf(ctx).execState.lastCloseKey ?? null).toBeNull();
    await storeCloseSnapshot(ctx.db, S[0], quotes());
    const out = await win(ctx, S[1], 'open30');
    expect(out).toMatchObject({ served: true, complete: true, caughtUp: [{ date: S[0], observed: true }] });
    expect(bookOf(ctx).execState.lastCloseKey).toBe(S[0]);
    expect(rowOf(ctx, S[0])).toMatchObject({ observed: true, fullQuality: true });
  });

  it('the window pass does nothing past a session it cannot close (review RH-2): with no stored close snapshot inside the catch-up bound the gap is recorded unobserved and the window then runs; a failing catch-up stops the window', async () => {
    const ctx = await setup({ names: ['AAPL'] });
    await closeDay(ctx, S[0]);
    // S[1] has no stored snapshot: caught up as unobserved, then the window runs normally.
    const out = await win(ctx, S[2], 'open30');
    expect(out).toMatchObject({ served: true, complete: true, caughtUp: [{ date: S[1], observed: false }] });
    expect(bookOf(ctx).execState.lastCloseKey).toBe(S[1]);
    // A window in a session whose close is already written does nothing at all.
    await closeDay(ctx, S[2]);
    const before = moneyStoreBytes(ctx.db);
    expect(await win(ctx, S[2], 'preClose')).toMatchObject({ served: true, complete: false, skipped: 'session_already_closed', caughtUp: [] });
    expect(moneyStoreBytes(ctx.db)).toBe(before);
    // A catch-up that throws (the book refuses to reconcile) stops the window: no sale and no entry is attempted.
    await ctx.bookRef.update({ 'portfolio.totalValue': roundUsd(bookOf(ctx).portfolio.totalValue + 0.01) });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await storeTickSnapshot(ctx.db, S[4], 'open30', quotes());
      const stopped = await windowAt(ctx.db, ctx.bookId, { date: S[4], slot: 'open30' });
      expect(stopped).toMatchObject({ served: true, complete: false, skipped: 'catch_up_failed', errors: 1, sales: { sold: 0 }, entries: { entered: 0 } });
    } finally { errors.mockRestore(); }
  });

  it('B-MISSED — a due session in the gap settles from ITS OWN stored snapshot; the clock never moves', async () => {
    const ctx = await setup();
    for (let i = 0; i <= 8; i += 1) await closeDay(ctx, S[i]);
    const schedule = structuredClone(ideaOf(ctx).contract.schedule);
    // S[9] and the due session are missed; both have stored snapshots. The catch-up runs at S[11]'s close.
    await storeCloseSnapshot(ctx.db, S[9], quotes({ AAPL: 236.2 }));
    await storeCloseSnapshot(ctx.db, DUE, quotes({ AAPL: 239.4, MSFT: 425.1, SPY: 603.3 }));
    const out = await closeDay(ctx, S[11], { AAPL: 251.7, MSFT: 440.9 });
    expect(out.caughtUp).toEqual([{ date: S[9], observed: true }, { date: DUE, observed: true }]);
    const idea = ideaOf(ctx);
    const ep = endpointRowOf(ctx);
    expect(idea.contract.schedule).toEqual(schedule); // no clock moved
    expect(idea.status).toBe('settled');
    expect(ep).toMatchObject({ endpointSession: DUE, endpointKind: 'due_session', observed: true, closeSnapshotKey: `${DUE}_close` });
    expect(ep.idea.holdings).toMatchObject({ AAPL: { mark: 239.4 }, MSFT: { mark: 425.1 } }); // the DUE session's prices, never S[11]'s
    // …and an endpoint the process wrote a session late is a blocked process (review RH-5): the figures are the due
    // session's own, the label says the close did not run on time.
    expect(idea.result).toMatchObject({ endpointSession: DUE, economicResult: 'within_band', contractCondition: 'met', processQuality: 'blocked' });
    expect(idea.result.processDetail.blockedBy).toEqual([{ kind: 'endpoint_valuation', session: DUE, writtenLate: true }]);
    expect(ep).toMatchObject({ writtenLate: true });
    // The settlement sale was queued when the catch-up ran: it fills at the next eligible observation after that.
    expect(idea.ledger.holdings.AAPL.settlementPending).toMatchObject({ session: DUE, at: closeNowOf(S[11]).toISOString() });
    expect((await win(ctx, S[12], 'open30')).sales).toMatchObject({ sold: 2, resulted: 1 });
  });

  it('B-MISSED — a due session in the gap with NO stored snapshot is settled on that session all the same, and its economic result reads unmeasurable', async () => {
    const ctx = await setup();
    for (let i = 0; i <= 9; i += 1) await closeDay(ctx, S[i]);
    const out = await closeDay(ctx, S[11]); // the due session, S[10], has no stored document
    expect(out.caughtUp).toEqual([{ date: DUE, observed: false }]);
    const idea = ideaOf(ctx);
    const ep = endpointRowOf(ctx);
    expect(idea.status).toBe('settled');
    expect(ep).toMatchObject({ endpointSession: DUE, dueSession: DUE, endpointKind: 'due_session', observed: false, closeSnapshotKey: null });
    expect(ep.idea.holdings.AAPL).toMatchObject({ markQuality: 'unobserved', mark: BASE.AAPL });
    expect(idea.result).toMatchObject({
      endpointSession: DUE, economicResult: 'unmeasurable', processQuality: 'blocked', contractCondition: 'unobserved',
      economic: { unmeasurableBecause: ['endpoint_session_unobserved', 'idea_mark_not_full_quality', 'comparison_mark_not_full_quality'] },
      processDetail: { blockedBy: [{ kind: 'endpoint_valuation', session: DUE }] },
      contractDetail: { unobservedLineSessions: { AAPL: [DUE], MSFT: [DUE] } },
    });
    // The capital is not held hostage: the liquidation still runs at the next eligible observation.
    expect((await win(ctx, S[12], 'open30')).sales).toMatchObject({ sold: 2, resulted: 1 });
    expect(bookOf(ctx).slots.short).toBeNull();
  });

  it('Astra T1A-08 — off for two sessions, with a due session and an entry timeout in the gap and one gap session with no stored snapshot; on again: the next close catches up, and no clock moves', async () => {
    const ctx = await setup();
    for (let i = 0; i <= 8; i += 1) await closeDay(ctx, S[i]);
    // A second idea admitted during S[8]: its start session is S[9].
    const second = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['JPM'], capitalUsd: 25000 }), opId: 'idea-2', nowIso: etIso(S[8], 15, 0) });
    expect(second).toMatchObject({ ok: true, startSession: S[9] });
    const schedules = [structuredClone(ideaOf(ctx).contract.schedule), structuredClone(ideaOf(ctx, second.ideaId).contract.schedule)];
    const treasuryBefore = bookOf(ctx).treasury.unreservedCash;

    // OFF for S[9] and S[10] (the due session): every Practice Field path is a no-op, and at 'off' an idea book is stepped over.
    restoreMode();
    restoreMode = setPracticeFieldModeForTests('off');
    const offBytes = moneyStoreBytes(ctx.db);
    await storeTickSnapshot(ctx.db, S[9], 'open30', quotes());
    expect(await runIdeaBookEntryPass(ctx.db, { bookRef: ctx.bookRef, tick: tickOf(S[9], 'open30'), now: slotNowOf(S[9]) })).toMatchObject({ served: false, entered: 0 });
    expect(await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[9], now: closeNowOf(S[9]) })).toEqual({ closed: false, skipped: 'practice_field_off', alerts: [] });
    await storeCloseSnapshot(ctx.db, DUE, quotes({ AAPL: 238.8, MSFT: 426.6 })); // the due session's document exists; S[9]'s never did
    expect(await closeIdeaBook(ctx.db, ctx.bookRef, { date: DUE, now: closeNowOf(DUE) })).toEqual({ closed: false, skipped: 'practice_field_off', alerts: [] });
    expect(moneyStoreBytes(ctx.db)).toBe(offBytes);

    // ON again at S[11].
    restoreMode();
    restoreMode = setPracticeFieldModeForTests('on');
    const out = await closeDay(ctx, S[11]);
    expect(out).toMatchObject({ closed: true, caughtUp: [{ date: S[9], observed: false }, { date: DUE, observed: true }], cancelled: [second.ideaId] });
    // The entry timeout: its start session fell in the gap. Cancelled `entry_timeout` while catching S[9] up; never a late entry.
    const cancelled = ideaOf(ctx, second.ideaId);
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelled: { reason: 'entry_timeout', returnedToTreasuryUsd: 25000 } });
    expect(cancelled.contract.schedule).toEqual(schedules[1]);
    expect(bookOf(ctx).treasury.unreservedCash).toBe(roundUsd(treasuryBefore + 25000));
    expect(bookOf(ctx).slots.medium).toBeNull();
    // The due session: settled from its own stored snapshot, on its own date.
    const idea = ideaOf(ctx);
    expect(idea.contract.schedule).toEqual(schedules[0]);
    expect(idea.status).toBe('settled');
    expect(endpointRowOf(ctx)).toMatchObject({ endpointSession: DUE, observed: true, idea: { holdings: { AAPL: { mark: 238.8 }, MSFT: { mark: 426.6 } } } });
    expect(idea.result).toMatchObject({ endpointSession: DUE, economicResult: 'within_band', contractCondition: 'unobserved', dataQuality: { unobservedLineSessions: 2, rowsNotFullQuality: 1 } });
    expect(idea.unobservedLineSessions).toEqual({ AAPL: [S[9]], MSFT: [S[9]] });
    // Every session has its row; the gap's are marked as recorded late.
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/dailyRows/`)).toBe(12);
    expect(rowOf(ctx, S[9])).toMatchObject({ observed: false, caughtUpAt: closeNowOf(S[11]).toISOString() });
    expect(rowOf(ctx, DUE)).toMatchObject({ observed: true, caughtUpAt: closeNowOf(S[11]).toISOString() });
    expect(bookOf(ctx).execState.lastCloseKey).toBe(S[11]);
    // A date before the last closed one is still refused.
    expect(await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[9], now: closeNowOf(S[11]) })).toMatchObject({ closed: false, skipped: 'out_of_order' });
  });

  it('a book that has never closed starts at the first session it held anything; the requested date itself still needs its document; the catch-up is bounded per call and never skips', async () => {
    const ctx = await setup({ slot: 'long', capitalUsd: 30000 });
    expect(firstUnclosedSessionBefore(bookOf(ctx), [ideaOf(ctx)], S[0])).toBeNull();
    expect(firstUnclosedSessionBefore(bookOf(ctx), [ideaOf(ctx)], S[2])).toBe(S[0]);
    expect(firstUnclosedSessionBefore({ execState: { lastCloseKey: S[0] } }, [], S[1])).toBeNull();
    expect(firstUnclosedSessionBefore({ execState: { lastCloseKey: '2026-11-25' } }, [], '2026-12-01')).toBe('2026-11-27'); // Thanksgiving is not a session
    expect(firstUnclosedSessionBefore({ execState: {} }, [], S[5])).toBeNull(); // nothing was ever held
    // The requested date with no stored document: nothing is written, though an earlier session was caught up.
    const first = await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[1], now: closeNowOf(S[1]) });
    expect(first).toMatchObject({ closed: false, skipped: 'valuation_missed', caughtUp: [{ date: S[0], observed: false }] });
    expect(bookOf(ctx).execState.lastCloseKey).toBe(S[0]);
    expect(rowOf(ctx, S[1])).toBeUndefined();
    // A long gap: more missed sessions than one call catches up.
    let far = S[0];
    for (let i = 0; i < CATCH_UP_MAX_SESSIONS_PER_CALL + 4; i += 1) far = nextSessionDate(far);
    await storeCloseSnapshot(ctx.db, far, quotes());
    const partial = await closeIdeaBook(ctx.db, ctx.bookRef, { date: far, now: closeNowOf(far) });
    expect(partial).toMatchObject({ closed: false, skipped: 'catch_up_incomplete' });
    expect(partial.caughtUp).toHaveLength(CATCH_UP_MAX_SESSIONS_PER_CALL);
    expect(bookOf(ctx).execState.lastCloseKey).toBe(partial.caughtUp[CATCH_UP_MAX_SESSIONS_PER_CALL - 1].date);
    expect(rowOf(ctx, far)).toBeUndefined(); // the requested date is not closed until every session before it is
    const rest = await closeIdeaBook(ctx.db, ctx.bookRef, { date: far, now: closeNowOf(far) });
    expect(rest).toMatchObject({ closed: true, session: far });
    expect(rest.caughtUp).toHaveLength(3);
    // Every session from S[0] to `far` has exactly one row, in calendar order, none skipped.
    const dates = [...ctx.db._store.keys()].filter((p) => p.startsWith(`mandates/${ctx.bookId}/dailyRows/`)).map((p) => p.split('/').pop()).sort();
    const expected = [S[0]];
    while (expected[expected.length - 1] !== far) expected.push(nextSessionDate(expected[expected.length - 1]));
    expect(dates).toEqual(expected);
    expect(ideaOf(ctx).unobservedLineSessions.AAPL).toHaveLength(expected.length - 1);
    recon(ctx);
  });

  it('the same bound through the window pass (review RH-1): a book further behind than one call catches up gets no sale and no entry in that fire, is counted and is NOT stamped; the slot\'s next fire finishes the catch-up and serves it', async () => {
    const ctx = await setup({ slot: 'long', capitalUsd: 30000 });
    await closeDay(ctx, S[0]);
    let far = S[0];
    for (let i = 0; i < CATCH_UP_MAX_SESSIONS_PER_CALL + 4; i += 1) far = nextSessionDate(far);
    await storeTickSnapshot(ctx.db, far, 'open30', quotes());
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fire = () => runIdeaBookEvalPass(ctx.db, { tick: tickOf(far, 'open30'), now: slotNowOf(far), ownerToken: 'owner-token' });
    const none = { sold: 0, saleWaiting: 0, resulted: 0, entered: 0, waiting: 0, cancelled: 0, leaseSkips: 0 };
    expect(await fire()).toEqual({ books: 1, served: 1, caughtUp: CATCH_UP_MAX_SESSIONS_PER_CALL, errors: 1, ...none });
    expect(bookOf(ctx).execState.lastIdeaTickKey ?? null).not.toBe(`${far}_open30`); // not stamped: the slot's next fire serves it
    expect(firstUnclosedSessionBefore(bookOf(ctx), [ideaOf(ctx)], far)).not.toBeNull();
    expect(await fire()).toEqual({ books: 1, served: 1, caughtUp: 3, errors: 0, ...none });
    expect(bookOf(ctx).execState.lastIdeaTickKey).toBe(`${far}_open30`);
    expect(firstUnclosedSessionBefore(bookOf(ctx), [ideaOf(ctx)], far)).toBeNull();
    expect(await fire()).toEqual({ books: 1, served: 0, caughtUp: 0, errors: 0, ...none }); // served this slot
    recon(ctx);
    errors.mockRestore();
  });
});

describe('B-DRAIN (E13), as far as this build owns it — a draining book gets every code duty and no entries or admissions', () => {
  /** A book with one idea whose line was hit on S[1] and a second idea admitted for S[2], set to `draining` (nothing sets the status yet: T1a-2b). */
  async function drainingBook() {
    const ctx = await setup({ names: ['AAPL'] });
    await closeDay(ctx, S[0]);
    const second = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['JPM'], capitalUsd: 25000 }), opId: 'idea-2', nowIso: etIso(S[1], 11, 0) });
    await closeDay(ctx, S[1], { AAPL: roundUsd(lineOf(ctx, 'AAPL').level - 0.02) });
    await ctx.bookRef.update({ status: 'draining' });
    return { ...ctx, secondId: second.ideaId };
  }

  it('the line exit still executes, through the idea-book pass\'s own query; the pending idea takes NO entry; nothing new is admitted', async () => {
    const ctx = await drainingBook();
    await storeTickSnapshot(ctx.db, S[2], 'open30', quotes());
    const pass = await runIdeaBookEvalPass(ctx.db, { tick: tickOf(S[2], 'open30'), now: slotNowOf(S[2]), ownerToken: 'owner-token' });
    expect(pass).toEqual({ books: 1, served: 1, caughtUp: 0, sold: 1, saleWaiting: 0, resulted: 0, entered: 0, waiting: 0, cancelled: 0, errors: 0, leaseSkips: 0 });
    recon(ctx);
    expect(ideaOf(ctx).ledger.saleReceipts).toHaveLength(1); // the line exit filled
    expect(ideaOf(ctx, ctx.secondId)).toMatchObject({ status: 'accepted', lastEntryAttempt: null }); // not entered, not even attempted
    expect(bookOf(ctx).execState.lastIdeaTickKey).toBe(`${S[2]}_open30`);
    const refused = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'long', names: ['MSFT'], capitalUsd: 20000 }), opId: 'idea-3', nowIso: etIso(S[2], 11, 0) });
    expect(refused.ok).toBe(false);
    expect(refused.refusals.map((r) => r.code)).toContain('book_not_active');
  });

  it('its closes run by the Practice Field\'s own query — valuation, the entry timeout, early resolution and the freed slot — and an active book is not touched by it', async () => {
    const ctx = await drainingBook();
    await win(ctx, S[2], 'open30');
    const other = await seedBook({ db: ctx.db, uid: 'owner-2', opId: 'create-2', archetypeCodeId: 'degen' }); // an ACTIVE idea book in the same store
    await storeCloseSnapshot(ctx.db, S[2], quotes());
    const out = await runDrainingIdeaBookCloses(ctx.db, { date: S[2], now: closeNowOf(S[2]), ownerToken: 'owner-token' });
    expect(out).toEqual({ books: 1, closed: 1, skipped: 0, unclosed: 0, errors: 0, leaseSkips: 0, alerts: [] });
    recon(ctx);
    const book = bookOf(ctx);
    expect(book).toMatchObject({ status: 'draining', execState: { lastCloseKey: S[2] }, slots: { short: null, medium: null, long: null }, openIdeaIds: [] });
    expect(ideaOf(ctx).status).toBe('resulted'); // its last holding exited: resolved at this close (E2)
    expect(ideaOf(ctx, ctx.secondId)).toMatchObject({ status: 'cancelled', cancelled: { reason: 'entry_timeout' } }); // the pending idea timed out: no entry in a draining book
    expect(book.treasury.unreservedCash).toBe(book.portfolio.cash);
    expect(getBook(ctx.db, other.bookId).execState.lastCloseKey ?? null).toBeNull(); // the active book is the engine sweep's, not this pass's
    // A second fire: already closed.
    expect(await runDrainingIdeaBookCloses(ctx.db, { date: S[2], now: closeNowOf(S[2]), ownerToken: 'owner-token' })).toMatchObject({ books: 1, closed: 0, skipped: 1 });
  });

  it('a close that answered `closed: false` left the book UNCLOSED for the date in exactly two cases — the catch-up ran out of its bound, or the date has no stored snapshot; every other answer means there was nothing to do', () => {
    expect(ideaCloseLeftUnclosed({ closed: false, skipped: 'catch_up_incomplete' })).toBe(true);
    expect(ideaCloseLeftUnclosed({ closed: false, skipped: 'valuation_missed' })).toBe(true);
    for (const skipped of ['already_closed', 'out_of_order', 'not_open', 'not_idea_book', 'book_missing', 'practice_field_off', 'nothing_to_catch_up']) {
      expect(ideaCloseLeftUnclosed({ closed: false, skipped }), skipped).toBe(false);
    }
    expect(ideaCloseLeftUnclosed({ closed: true })).toBe(false);
    expect(ideaCloseLeftUnclosed(null)).toBe(false);
  });

  it('the snapshot build counts a draining idea book — by the Practice Field\'s own query, never the engine\'s — and one book\'s failure never throws', async () => {
    const ctx = await drainingBook();
    const activeDocs = (await ctx.db.collection('mandates').where('status', '==', 'active').get()).docs;
    expect(activeDocs).toHaveLength(0); // the engine's own query cannot see it
    const withDrain = await withDrainingIdeaBooks(ctx.db, activeDocs);
    expect(withDrain.map((d) => d.id)).toEqual([ctx.bookId]);
    // No draining book: the engine's own array comes back, untouched.
    const none = makeMandateFakeDb();
    const docs = [{ id: 'q1' }];
    expect(await withDrainingIdeaBooks(none, docs)).toBe(docs);
    // The Practice Field's query failing costs the engine nothing: its documents come back, and the failure is logged.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = { collection: () => { throw new Error('UNAVAILABLE: injected'); } };
    expect(await withDrainingIdeaBooks(failing, docs)).toBe(docs);
    expect(errors.mock.calls.some((c) => /PRACTICE_FIELD_DRAINING_QUERY_FAILED/.test(String(c[0])))).toBe(true);
    // …with ONLY the mandates query failing (review lens 3, IS-2): whether a draining book exists is unknown, and a
    // snapshot is built once. The coverage document still lists every open idea's symbols, so when it reserves anything
    // the build is told an idea book is in play — one stand-in that holds nothing — and covers them as it would have.
    const mandatesDown = (db) => ({ ...db, collection: (c) => { if (c === 'mandates') throw new Error('UNAVAILABLE: injected (mandates)'); return db.collection(c); } });
    const fallback = await withDrainingIdeaBooks(mandatesDown(ctx.db), docs);
    expect(fallback).toHaveLength(2);
    expect(fallback[0]).toBe(docs[0]);
    expect(fallback[1].data()).toEqual({ kind: 'idea_book', status: 'draining', portfolio: { positions: {} } });
    // A coverage document that reserves nothing (no open idea anywhere): the engine's own array, untouched.
    expect(await withDrainingIdeaBooks(mandatesDown(none), docs)).toBe(docs);
    // The stand-in CARRIES the coverage document the fallback read, and the build is handed it: no second read — a
    // second one failing would throw into the fire the fallback is there to protect (third refuter pass, 9a).
    const carried = coverageFromStandIn(fallback);
    expect(Object.keys(carried.symbols).sort()).toEqual(Object.keys(ctx.db._get('practiceFieldCoverage/current').symbols).sort());
    expect(coverageFromStandIn(docs)).toBeUndefined();
    expect(coverageFromStandIn([])).toBeUndefined();
    const unreadable = { collection: () => { throw new Error('UNAVAILABLE: injected (any read)'); } };
    const inputs = await practiceFieldBuildInputs(unreadable, { ideaHeldTickers: [], quarterlyActive: true, coverageData: carried });
    expect([...inputs.daily.coverageTickers].sort()).toEqual(Object.keys(carried.symbols).sort());
    await expect(practiceFieldBuildInputs(unreadable, { ideaHeldTickers: [], quarterlyActive: true })).rejects.toThrow(/UNAVAILABLE/); // no stand-in: the read is made here, as before
    // A close that throws for one draining book is counted, not thrown.
    await storeCloseSnapshot(ctx.db, S[2], quotes());
    const broken = { ...ctx.db, runTransaction: async () => { throw Object.assign(new Error('UNAVAILABLE: injected'), { code: 14 }); } };
    expect(await runDrainingIdeaBookCloses(broken, { date: S[2], now: closeNowOf(S[2]), ownerToken: 'owner-token' })).toMatchObject({ books: 1, closed: 0, errors: 1 });
    expect(errors.mock.calls.some((c) => /draining idea book .* close failed/.test(String(c[0])))).toBe(true);
    expect(cents(bookOf(ctx).portfolio.cash)).toBeGreaterThan(0);
  });
});
