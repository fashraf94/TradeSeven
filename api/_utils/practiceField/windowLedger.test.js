// api/_utils/practiceField/windowLedger.test.js
//
// Practice Field T1a-2b-1 §4 — THE WINDOW LEDGER (Amendment C §3; contract V2 §12; Astra W-12, W-14, W-15). One row
// per book per window it was due, plus the close; the expected windows come from windows.js alone; at each close the
// expected windows are checked against the served ones, the close's row says which were missed, and one
// PRACTICE_FIELD_WINDOW_MISSED alert is returned per missed window. A window is never recorded as served when its pass
// errored, and a retry of a served window writes nothing.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { admitIdea } from './admission.js';
import { runIdeaBookEvalPass, runIdeaBookWindow } from './sweep.js';
import { closeIdeaBook, catchUpIdeaBook } from './close.js';
import { readFileSync } from 'node:fs';
import { ideaBookWindowsOf, windowRowId, CLOSE_WINDOW, IDEA_BOOK_EVAL_FIRE_EVERY_MIN, nextSessionDate } from './windows.js';
import { recordWindowAttempt, foldWindowAttempt, attemptOf, buildCloseWindowRow, WINDOW_OUTCOME, WINDOW_ONLY_SESSIONS_PER_TX, firstUnaccountedWindowSession } from './windowLedger.js';
import {
  seedBook, contractOf, closeOn, storeTickSnapshot, storeCloseSnapshot, tickSnapshot, tickOf, slotNowOf, closeNowOf, etIso, DAYS, ADMIT_ISO,
  getBook, getIdea, windDownBook, withoutWindowAlerts, enterAt,
} from './__testsupport__/fixtures.js';

const QUOTES = { AAPL: 230.17, SPY: 600.1 };
const rowOf = (db, bookId, date, window) => db._get(`mandates/${bookId}/windows/${windowRowId(date, window)}`);
const pass = (db, date, slot, now) => runIdeaBookEvalPass(db, { tick: tickOf(date, slot), now: now ?? slotNowOf(date, slot), ownerToken: 'owner-token' });
const missedAlerts = (alerts) => (alerts || []).filter((a) => /^PRACTICE_FIELD_WINDOW_MISSED /.test(a));

/** A book with one short AAPL idea admitted on the Friday, so it enters on Monday d1. */
async function setup() {
  const ctx = await seedBook();
  const admitted = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf(), opId: 'idea-1', nowIso: ADMIT_ISO });
  expect(admitted.ok).toBe(true);
  return { ...ctx, ideaId: admitted.ideaId };
}

let restore;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); });
afterEach(() => restore());

describe('the expected windows come from windows.js alone', () => {
  it('a regular session: the engine\'s three slots at their own instants, then the close', () => {
    expect(ideaBookWindowsOf(DAYS.d1)).toEqual([
      { window: 'open30', kind: 'intraday', atIso: etIso(DAYS.d1, 10, 0) },
      { window: 'midday', kind: 'intraday', atIso: etIso(DAYS.d1, 12, 45) },
      { window: 'preClose', kind: 'intraday', atIso: etIso(DAYS.d1, 15, 30) },
      { window: CLOSE_WINDOW, kind: 'close', atIso: null },
    ]);
  });

  it('an early-close session is read from its own geometry (a reading: at main the engine still gives it three slots, all before 13:00 — T1b changes the schedule here)', () => {
    const friday = '2026-11-27'; // the day after Thanksgiving: the market closes at 13:00
    const w = ideaBookWindowsOf(friday);
    expect(w.map((x) => x.window)).toEqual(['open30', 'midday', 'preClose', CLOSE_WINDOW]);
    expect(w.map((x) => x.atIso)).toEqual([etIso(friday, 10, 0), etIso(friday, 11, 15), etIso(friday, 12, 30), null]);
  });

  it('a window that opened before the book existed is not due; a day that is not a session expects nothing', () => {
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 11, 0) }).map((x) => x.window)).toEqual(['midday', 'preClose', CLOSE_WINDOW]);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 10, 0) }).map((x) => x.window)).toEqual(['open30', 'midday', 'preClose', CLOSE_WINDOW]);
    // A slot with a fire still to come when the book is created is owed (the 10:15 fire serves a 10:05 book); one with
    // no fire left is not — a 10:20 book is not owed the 10:00 slot, whose window ends at 10:30 (fix-round refuter NF-4).
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 10, 5) }).map((x) => x.window)).toEqual(['open30', 'midday', 'preClose', CLOSE_WINDOW]);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: new Date(Date.parse(etIso(DAYS.d1, 10, 15)) - 1).toISOString() }).map((x) => x.window)).toEqual(['open30', 'midday', 'preClose', CLOSE_WINDOW]);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 10, 15) }).map((x) => x.window)).toEqual(['midday', 'preClose', CLOSE_WINDOW]);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 10, 20) }).map((x) => x.window)).toEqual(['midday', 'preClose', CLOSE_WINDOW]);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 10, 30) }).map((x) => x.window)).toEqual(['midday', 'preClose', CLOSE_WINDOW]);
    // midday [12:45, 13:15) — its last fire is 13:00; preClose [15:30, 16:00) — its last fire is 15:45.
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 12, 59) }).map((x) => x.window)).toEqual(['midday', 'preClose', CLOSE_WINDOW]);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 13, 5) }).map((x) => x.window)).toEqual(['preClose', CLOSE_WINDOW]);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 15, 44) }).map((x) => x.window)).toEqual(['preClose', CLOSE_WINDOW]);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 15, 50) }).map((x) => x.window)).toEqual([CLOSE_WINDOW]);
    // An early close's geometry: open30 [10:00, 10:30), midday [11:15, 11:45), preClose [12:30, 13:00).
    expect(ideaBookWindowsOf('2026-11-27', { createdAtIso: etIso('2026-11-27', 11, 29) }).map((x) => x.window)).toEqual(['midday', 'preClose', CLOSE_WINDOW]);
    expect(ideaBookWindowsOf('2026-11-27', { createdAtIso: etIso('2026-11-27', 12, 50) }).map((x) => x.window)).toEqual([CLOSE_WINDOW]);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 17, 0) }).map((x) => x.window)).toEqual([CLOSE_WINDOW]);
    expect(ideaBookWindowsOf('2026-11-14')).toEqual([]); // a Saturday
    expect(ideaBookWindowsOf('2026-11-26')).toEqual([]); // Thanksgiving
  });

  it('the fire cadence windows.js counts on is the evaluation cron\'s own — every 15 minutes, on the quarter hour, through every session hour', () => {
    expect(IDEA_BOOK_EVAL_FIRE_EVERY_MIN).toBe(15);
    const crons = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8')).crons;
    const evaluate = crons.filter((c) => c.path === '/api/cron/mandate-evaluate');
    expect(evaluate).toHaveLength(1);
    expect(evaluate[0].schedule).toBe('*/15 14,15,16,17,18,19,20,21,22 * * 1-5');
  });
});

describe('the intraday rows the idea-book pass writes', () => {
  it('a served window: when, what code did, no model, no trigger; `code_action` when code acted, `no_model_action` when it only looked', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, DAYS.d1, 'open30', QUOTES);
    const p1 = await pass(ctx.db, DAYS.d1, 'open30');
    expect(p1).toMatchObject({ books: 1, served: 1, entered: 1, errors: 0 });
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d1, 'open30')).toEqual({
      schemaVersion: 1, bookId: ctx.bookId, sessionDate: DAYS.d1, window: 'open30', kind: 'intraday', tickKey: `${DAYS.d1}_open30`,
      served: true, servedAt: slotNowOf(DAYS.d1).toISOString(), firstAttemptAt: slotNowOf(DAYS.d1).toISOString(), attempts: 1, errors: 0,
      attemptLog: [expect.objectContaining({ complete: true, errors: 0, entriesFilled: 1 })],
      code: { caughtUpSessions: [], sales: { filled: 0, waiting: 0 }, entries: { filled: 1, waiting: 0, cancelled: 0 }, ideasResulted: 0 },
      modelCalled: false, triggers: [], outcome: WINDOW_OUTCOME.CODE_ACTION,
    });
    await storeTickSnapshot(ctx.db, DAYS.d1, 'midday', QUOTES);
    await pass(ctx.db, DAYS.d1, 'midday');
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d1, 'midday')).toMatchObject({ served: true, code: { entries: { filled: 0 }, sales: { filled: 0 } }, outcome: WINDOW_OUTCOME.NO_MODEL_ACTION, modelCalled: false, triggers: [] });
  });

  it('a pass that ERRORED is never recorded as served: its attempt is kept, and the slot\'s next fire folds its own into the SAME row', async () => {
    const ctx = await setup();
    // The stored slot document is another session's: the entry's transaction refuses it (an error, counted).
    const wrong = { ...tickSnapshot(DAYS.d1, 'open30', QUOTES), sessionDate: DAYS.d2 };
    ctx.db._store.set(`mandateUniverseSnapshots/${DAYS.d1}_open30`, { data: wrong, version: 1 });
    const errors = []; const original = console.error; console.error = (...x) => errors.push(x.join(' '));
    try {
      const failed = await pass(ctx.db, DAYS.d1, 'open30');
      expect(failed).toMatchObject({ served: 1, entered: 0, errors: 1 });
    } finally { console.error = original; }
    let row = rowOf(ctx.db, ctx.bookId, DAYS.d1, 'open30');
    expect(row).toMatchObject({ served: false, servedAt: null, attempts: 1, errors: 1, code: { entries: { filled: 0 } } });
    expect(getBook(ctx.db, ctx.bookId).execState.lastIdeaTickKey ?? null).toBeNull(); // not stamped: the next fire retries
    // The slot's next fire, with the slot's own document: served, both attempts on the one row.
    ctx.db._store.set(`mandateUniverseSnapshots/${DAYS.d1}_open30`, { data: tickSnapshot(DAYS.d1, 'open30', QUOTES), version: 2 });
    const later = new Date(slotNowOf(DAYS.d1).getTime() + 3 * 60_000);
    expect(await pass(ctx.db, DAYS.d1, 'open30', later)).toMatchObject({ entered: 1, errors: 0 });
    row = rowOf(ctx.db, ctx.bookId, DAYS.d1, 'open30');
    expect(row).toMatchObject({ served: true, servedAt: later.toISOString(), firstAttemptAt: slotNowOf(DAYS.d1).toISOString(), attempts: 2, errors: 1, code: { entries: { filled: 1 } }, outcome: 'code_action' });
    expect(row.attemptLog.map((a) => [a.complete, a.errors])).toEqual([[true, 1], [true, 0]]);
  });

  it('a retry of a SERVED window writes nothing new — through the pass and through the recorder itself', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, DAYS.d1, 'open30', QUOTES);
    await pass(ctx.db, DAYS.d1, 'open30');
    const path = `mandates/${ctx.bookId}/windows/${DAYS.d1}_open30`;
    const before = JSON.stringify(ctx.db._store.get(path));
    // The pass: the within-slot stamp skips the book.
    expect(await pass(ctx.db, DAYS.d1, 'open30', new Date(slotNowOf(DAYS.d1).getTime() + 60_000))).toMatchObject({ books: 1, served: 0 });
    // The stamp lost (a failed stamp write): the window runs again, and its row is not touched.
    await ctx.bookRef.set({ execState: { lastIdeaTickKey: null } }, { merge: true });
    expect(await pass(ctx.db, DAYS.d1, 'open30', new Date(slotNowOf(DAYS.d1).getTime() + 2 * 60_000))).toMatchObject({ served: 1, errors: 0 });
    // The recorder, asked directly with another attempt.
    const out = await recordWindowAttempt(ctx.db, { bookRef: ctx.bookRef, tick: tickOf(DAYS.d1), win: { complete: true, errors: 0, caughtUp: [], sales: { sold: 9 }, entries: {} }, now: new Date() });
    expect(out).toEqual({ wrote: false, served: true });
    expect(JSON.stringify(ctx.db._store.get(path))).toBe(before);
  });

  it('foldWindowAttempt: fills, timeouts and results add up across attempts; what waits is the last attempt\'s; a served row is returned unchanged', () => {
    const tick = tickOf(DAYS.d1, 'midday');
    // The first attempt fills a sale and an entry, then errors on another idea; the second fills one of each more.
    const a1 = attemptOf({ complete: true, errors: 1, caughtUp: [{ date: '2026-11-13', observed: true }], sales: { sold: 1, waiting: 2, resulted: 1 }, entries: { entered: 1, waiting: 1, cancelled: 1 } }, { nowIso: 'A' });
    const r1 = foldWindowAttempt(null, a1, { bookId: 'b', tick });
    expect(r1).toMatchObject({ served: false, attempts: 1, errors: 1, code: { caughtUpSessions: [{ date: '2026-11-13', observed: true }], sales: { filled: 1, waiting: 2 }, entries: { filled: 1, waiting: 1, cancelled: 1 }, ideasResulted: 1 } });
    const a2 = attemptOf({ complete: true, errors: 0, caughtUp: [{ date: '2026-11-13', observed: true }], sales: { sold: 1, waiting: 0, resulted: 1 }, entries: { entered: 1, cancelled: 1 } }, { nowIso: 'B' });
    const r2 = foldWindowAttempt(r1, a2, { bookId: 'b', tick });
    expect(r2).toMatchObject({ served: true, servedAt: 'B', firstAttemptAt: 'A', attempts: 2, errors: 1, code: { caughtUpSessions: [{ date: '2026-11-13', observed: true }], sales: { filled: 2, waiting: 0 }, entries: { filled: 2, waiting: 0, cancelled: 2 }, ideasResulted: 2 } });
    expect(foldWindowAttempt(r2, a1, { bookId: 'b', tick })).toBe(r2);
    // An attempt with an error is never served, however complete.
    expect(foldWindowAttempt(null, attemptOf({ complete: true, errors: 1 }, { nowIso: 'C' }), { bookId: 'b', tick }).served).toBe(false);
    // Only looking (a sale waiting) is no code action.
    expect(foldWindowAttempt(null, attemptOf({ complete: true, errors: 0, sales: { sold: 0, waiting: 3 } }, { nowIso: 'D' }), { bookId: 'b', tick }).outcome).toBe('no_model_action');
  });
});

describe('the close: expected against observed, once', () => {
  it('the close\'s row names the windows expected, served and missing; one PRACTICE_FIELD_WINDOW_MISSED per missed window; a second close fire adds nothing', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, DAYS.d1, 'open30', QUOTES);
    await pass(ctx.db, DAYS.d1, 'open30');
    await storeTickSnapshot(ctx.db, DAYS.d1, 'midday', QUOTES);
    await pass(ctx.db, DAYS.d1, 'midday');
    // preClose never ran.
    const out = await closeOn(ctx.db, ctx.bookId, DAYS.d1, QUOTES);
    expect(out.closed).toBe(true);
    expect(missedAlerts(out.alerts)).toEqual([`PRACTICE_FIELD_WINDOW_MISSED ${ctx.bookId} ${DAYS.d1}_preClose — the book was due at this window and no pass served it`]);
    expect(out.missedWindows).toEqual(['preClose']);
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d1, CLOSE_WINDOW)).toEqual({
      schemaVersion: 1, bookId: ctx.bookId, sessionDate: DAYS.d1, window: 'close', kind: 'close', tickKey: `${DAYS.d1}_close`,
      served: true, servedAt: closeNowOf(DAYS.d1).toISOString(), valued: true, observed: true, closeSnapshotKey: `${DAYS.d1}_close`,
      code: { caughtUpSession: false, ideasValued: 1, endpoints: [], ideasResulted: [], entriesTimedOut: [], bookClosed: false },
      modelCalled: false, triggers: [], outcome: 'no_model_action',
      session: { expected: ['open30', 'midday', 'preClose', 'close'], served: ['open30', 'midday', 'close'], missing: ['preClose'], notServedButAttempted: [] },
    });
    // A second fire for the same date: already closed — no row rewritten, no alert again.
    const bytes = JSON.stringify(rowOf(ctx.db, ctx.bookId, DAYS.d1, CLOSE_WINDOW));
    const again = await closeIdeaBook(ctx.db, ctx.bookRef, { date: DAYS.d1, now: closeNowOf(DAYS.d1) });
    expect(again).toMatchObject({ closed: false, skipped: 'already_closed', alerts: [] });
    expect(JSON.stringify(rowOf(ctx.db, ctx.bookId, DAYS.d1, CLOSE_WINDOW))).toBe(bytes);
  });

  it('every window served: nothing missed, no alert', async () => {
    const ctx = await setup();
    for (const slot of ['open30', 'midday', 'preClose']) {
      await storeTickSnapshot(ctx.db, DAYS.d1, slot, QUOTES);
      await pass(ctx.db, DAYS.d1, slot);
    }
    const out = await closeOn(ctx.db, ctx.bookId, DAYS.d1, QUOTES);
    expect(out.alerts).toEqual([]);
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d1, CLOSE_WINDOW).session).toEqual({ expected: ['open30', 'midday', 'preClose', 'close'], served: ['open30', 'midday', 'preClose', 'close'], missing: [], notServedButAttempted: [] });
  });

  it('a window whose only attempt errored is MISSED at the close (and says it was attempted)', async () => {
    const ctx = await setup();
    ctx.db._store.set(`mandateUniverseSnapshots/${DAYS.d1}_open30`, { data: { ...tickSnapshot(DAYS.d1, 'open30', QUOTES), sessionDate: DAYS.d2 }, version: 1 });
    const original = console.error; console.error = () => {};
    try { await pass(ctx.db, DAYS.d1, 'open30'); } finally { console.error = original; }
    for (const slot of ['midday', 'preClose']) { await storeTickSnapshot(ctx.db, DAYS.d1, slot, QUOTES); await pass(ctx.db, DAYS.d1, slot); }
    const out = await closeOn(ctx.db, ctx.bookId, DAYS.d1, QUOTES);
    expect(missedAlerts(out.alerts)).toEqual([`PRACTICE_FIELD_WINDOW_MISSED ${ctx.bookId} ${DAYS.d1}_open30 — the book was due at this window and no pass served it`]);
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d1, CLOSE_WINDOW).session).toMatchObject({ missing: ['open30'], notServedButAttempted: ['open30'] });
  });

  it('a session caught up: its close row says so, and the window that caught it up records the session it closed', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, DAYS.d1, 'open30', QUOTES);
    await pass(ctx.db, DAYS.d1, 'open30');
    // d1's close fire never ran; its close snapshot was stored. d2's first window catches it up.
    await storeCloseSnapshot(ctx.db, DAYS.d1, QUOTES);
    await storeTickSnapshot(ctx.db, DAYS.d2, 'open30', QUOTES);
    const errors = []; const original = console.error; console.error = (...x) => errors.push(x.join(' '));
    try { expect(await pass(ctx.db, DAYS.d2, 'open30')).toMatchObject({ caughtUp: 1, errors: 0 }); } finally { console.error = original; }
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d1, CLOSE_WINDOW)).toMatchObject({ caughtUpAt: slotNowOf(DAYS.d2).toISOString(), code: { caughtUpSession: true }, session: { missing: ['midday', 'preClose'] } });
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d2, 'open30')).toMatchObject({ served: true, code: { caughtUpSessions: [{ date: DAYS.d1, observed: true }] }, outcome: 'code_action' });
    // The catch-up's missed windows are logged by the pass, as every catch-up alert is.
    expect(errors.filter((e) => /PRACTICE_FIELD_WINDOW_MISSED/.test(e))).toHaveLength(2);
  });

  it('a book created after a window opened is not owed it; a book closed by its wind-down owes no window after', async () => {
    const ctx = await seedBook({ nowIso: etIso(DAYS.d1, 11, 0) });
    const out = await closeOn(ctx.db, ctx.bookId, DAYS.d1, QUOTES);
    expect(out).toMatchObject({ closed: true, missedWindows: ['midday', 'preClose'] }); // open30 opened before the book existed
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d1, CLOSE_WINDOW).session.expected).toEqual(['midday', 'preClose', 'close']);
    // Wound down with nothing open: the next close completes it, and its row says the book closed.
    await windDownBook(ctx.db, { uid: 'owner-1', nowIso: etIso(DAYS.d1, 18, 0) });
    const closing = await closeOn(ctx.db, ctx.bookId, DAYS.d2, QUOTES);
    expect(closing).toMatchObject({ closed: true, bookClosed: true });
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d2, CLOSE_WINDOW)).toMatchObject({ code: { bookClosed: true }, outcome: 'code_action' });
    // After it, a window pass finds no open book: no row is written for d3.
    await storeTickSnapshot(ctx.db, DAYS.d3, 'open30', QUOTES);
    expect(await pass(ctx.db, DAYS.d3, 'open30')).toMatchObject({ books: 0 });
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d3, 'open30')).toBeUndefined();
    expect(withoutWindowAlerts(closing.alerts)).toEqual([]);
  });

  it('fix-round refuter NF-4 — a book created at 10:20, after the 10:00 slot\'s last fire, is not told it missed that slot', async () => {
    const ctx = await seedBook({ nowIso: etIso(DAYS.d1, 10, 20) });
    for (const slot of ['midday', 'preClose']) {
      await storeTickSnapshot(ctx.db, DAYS.d1, slot, QUOTES);
      expect(await pass(ctx.db, DAYS.d1, slot)).toMatchObject({ books: 1, served: 1, errors: 0 });
    }
    const out = await closeOn(ctx.db, ctx.bookId, DAYS.d1, QUOTES);
    expect(out).toMatchObject({ closed: true, missedWindows: [] });
    expect(missedAlerts(out.alerts)).toEqual([]);
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d1, CLOSE_WINDOW).session).toMatchObject({ expected: ['midday', 'preClose', 'close'], served: ['midday', 'preClose', 'close'], missing: [] });
  });

  it('buildCloseWindowRow is the whole judgment: missing is every expected intraday window without a SERVED row', () => {
    const book = { createdAt: new Date(etIso(DAYS.admit, 9, 0)) };
    const base = { bookId: 'b', book, session: DAYS.d1, observed: true, catchUp: false, snapshotMeta: { key: `${DAYS.d1}_close` }, bookClosed: false, nowIso: 'N', code: { ideasValued: 0, endpoints: [], resulted: [], cancelled: [] } };
    expect(buildCloseWindowRow({ ...base, windowRows: {} }).missing).toEqual(['open30', 'midday', 'preClose']);
    expect(buildCloseWindowRow({ ...base, windowRows: { open30: { served: true }, midday: { served: false }, preClose: { served: true } } }).missing).toEqual(['midday']);
    expect(buildCloseWindowRow({ ...base, windowRows: { open30: { served: true }, midday: { served: true }, preClose: { served: true } } }).alerts).toEqual([]);
  });
});

describe('Astra T2B-02 — every due session is accounted for from the book\'s creation, by the window ledger\'s own cursor', () => {
  const dump = (db, bookId) => JSON.stringify([...db._store.entries()].filter(([p]) => p.startsWith(`mandates/${bookId}`)));
  const closeRows = (db, bookId) => [...db._store.keys()].filter((p) => p.startsWith(`mandates/${bookId}/windows/`) && p.endsWith('_close')).map((p) => p.split('/').pop().replace('_close', '')).sort();
  const missedOn = (alerts, date) => missedAlerts(alerts).filter((a) => a.includes(` ${date}_`));
  const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };
  const INTRADAY = ['open30', 'midday', 'preClose'];
  const windowOnlyRow = (db, bookId, date) => rowOf(db, bookId, date, CLOSE_WINDOW);

  for (const order of ['the 17 Nov close alone', 'a catch-up before 17 Nov\'s first window, then its close']) {
    it(`her case — an EMPTY book created 16 Nov 09:00, no window run, then ${order}: 16 Nov's three windows are reported missing, once, with no valuation row`, async () => {
      const D16 = '2026-11-16';
      const D17 = '2026-11-17';
      const ctx = await seedBook({ nowIso: etIso(D16, 9, 0) });
      expect(ideaBookWindowsOf(D16, { createdAtIso: etIso(D16, 9, 0) }).map((w) => w.window)).toEqual([...INTRADAY, CLOSE_WINDOW]);
      const alerts = [];
      if (order.startsWith('a catch-up')) {
        const caught = await catchUpIdeaBook(ctx.db, ctx.bookRef, { before: D17, now: slotNowOf(D17) });
        expect(caught).toMatchObject({ complete: true, caughtUp: [], windowsAccounted: [{ session: D16, missing: INTRADAY }] });
        alerts.push(...caught.alerts);
      }
      const out = await closeOn(ctx.db, ctx.bookId, D17, QUOTES);
      expect(out).toMatchObject({ closed: true, session: D17, caughtUp: [] });
      alerts.push(...out.alerts);
      // Once each: 16 Nov's three, then 17 Nov's own three.
      expect(missedOn(alerts, D16)).toEqual(INTRADAY.map((w) => `PRACTICE_FIELD_WINDOW_MISSED ${ctx.bookId} ${D16}_${w} — the book was due at this window and no pass served it`));
      expect(missedOn(alerts, D17)).toHaveLength(3);
      expect(missedAlerts(alerts)).toHaveLength(6);
      expect(windowOnlyRow(ctx.db, ctx.bookId, D16)).toMatchObject({
        sessionDate: D16, kind: 'close', valued: false, accountedBy: 'window_cursor', observed: null, closeSnapshotKey: null,
        code: { caughtUpSession: null, ideasValued: 0, endpoints: [], ideasResulted: [], entriesTimedOut: [], bookClosed: false },
        session: { expected: [...INTRADAY, CLOSE_WINDOW], served: [CLOSE_WINDOW], missing: INTRADAY, notServedButAttempted: [] },
      });
      expect(windowOnlyRow(ctx.db, ctx.bookId, D17)).toMatchObject({ valued: true, observed: true });
      // No money was valued for 16 Nov: no valuation row. The valuation cursor is the valuation's.
      expect(ctx.db._get(`mandates/${ctx.bookId}/dailyRows/${D16}`)).toBeUndefined();
      expect(getBook(ctx.db, ctx.bookId).execState).toMatchObject({ lastCloseKey: D17, windowsAccountedThrough: D17 });
      // A replay — the close again, a later catch-up — writes nothing and says nothing.
      const bytes = dump(ctx.db, ctx.bookId);
      expect(await closeIdeaBook(ctx.db, ctx.bookRef, { date: D17, now: closeNowOf(D17) })).toMatchObject({ skipped: 'already_closed', alerts: [] });
      expect(await catchUpIdeaBook(ctx.db, ctx.bookRef, { before: DAYS.d3, now: slotNowOf(DAYS.d3) })).toMatchObject({ complete: true, windowsAccounted: [], alerts: [] });
      expect(dump(ctx.db, ctx.bookId)).toBe(bytes);
      expect(closeRows(ctx.db, ctx.bookId)).toEqual([D16, D17]);
    });
  }

  it('an accepted idea that never filled, its first close missed: its creation day and its start session are accounted for (window cursor only), then the close that times it out', async () => {
    const ctx = await setup(); // created Friday 13 Nov 09:00; the idea is admitted at 11:00 and may enter on Monday d1
    const out = await closeOn(ctx.db, ctx.bookId, DAYS.d2, QUOTES); // nothing ran on 13 or 16 Nov; d2's close
    expect(out).toMatchObject({ closed: true, session: DAYS.d2, cancelled: [ctx.ideaId] }); // the timeout is the valuation's own, unchanged
    expect(out.windowsAccounted).toEqual([{ session: DAYS.admit, missing: INTRADAY }, { session: DAYS.d1, missing: INTRADAY }]);
    for (const d of [DAYS.admit, DAYS.d1]) {
      expect(windowOnlyRow(ctx.db, ctx.bookId, d), d).toMatchObject({ valued: false, session: { missing: INTRADAY } });
      expect(ctx.db._get(`mandates/${ctx.bookId}/dailyRows/${d}`), d).toBeUndefined();
      expect(missedOn(out.alerts, d), d).toHaveLength(3);
    }
    expect(missedOn(out.alerts, DAYS.d2)).toHaveLength(3);
    // In session order: 13 Nov's, then 16 Nov's, then d2's own.
    expect(missedAlerts(out.alerts).map((a) => a.split(' ')[2].slice(0, 10))).toEqual([...Array(3).fill(DAYS.admit), ...Array(3).fill(DAYS.d1), ...Array(3).fill(DAYS.d2)]);
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).status).toBe('cancelled');
    const bytes = dump(ctx.db, ctx.bookId);
    expect((await quiet(() => runIdeaBookWindow(ctx.db, { bookRef: ctx.bookRef, tick: tickOf(DAYS.d3), now: slotNowOf(DAYS.d3) }))).caughtUp).toEqual([]);
    expect(closeRows(ctx.db, ctx.bookId)).toEqual([DAYS.admit, DAYS.d1, DAYS.d2]);
    expect(missedAlerts((await closeIdeaBook(ctx.db, ctx.bookRef, { date: DAYS.d2, now: closeNowOf(DAYS.d2) })).alerts)).toEqual([]);
    expect(dump(ctx.db, ctx.bookId)).toBe(bytes); // the next window and a replayed close write nothing
  });

  // Review W-2: which session the cursor starts at. The creation date when the book existed before that session's close
  // pass ended (18:00 Eastern), else the next session; never a day that is not a session.
  it('the creation session: after the close pass ends (18:30) → the next session; after the close but before the pass ends (17:30) → that day; a Saturday → Monday', async () => {
    const after = await seedBook({ nowIso: etIso(DAYS.d1, 18, 30) });
    expect(firstUnaccountedWindowSession(getBook(after.db, after.bookId))).toBe(DAYS.d2);
    await closeOn(after.db, after.bookId, DAYS.d2, QUOTES);
    expect(rowOf(after.db, after.bookId, DAYS.d1, CLOSE_WINDOW)).toBeUndefined();
    const before = await seedBook({ nowIso: etIso(DAYS.d1, 17, 30) });
    expect(firstUnaccountedWindowSession(getBook(before.db, before.bookId))).toBe(DAYS.d1);
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 17, 30) }).map((w) => w.window)).toEqual([CLOSE_WINDOW]);
    const saturday = await seedBook({ nowIso: etIso('2026-11-14', 12, 0) });
    expect(firstUnaccountedWindowSession(getBook(saturday.db, saturday.bookId))).toBe(DAYS.d1);
    await closeOn(saturday.db, saturday.bookId, DAYS.d2, QUOTES);
    expect(rowOf(saturday.db, saturday.bookId, '2026-11-14', CLOSE_WINDOW)).toBeUndefined();
    expect(rowOf(saturday.db, saturday.bookId, DAYS.d1, CLOSE_WINDOW)).toMatchObject({ valued: false, session: { missing: INTRADAY } });
  });

  it('review W-3 — no fill is dated in a session the cursor has already written up: it is refused as closed, and that session\'s later close never meets a second row', async () => {
    const ctx = await setup(); // the idea may enter on d1
    // A catch-up dated AFTER d1 (no fire does this today: a fire's catch-up only reaches sessions before its own).
    const caught = await quiet(() => catchUpIdeaBook(ctx.db, ctx.bookRef, { before: DAYS.d2, now: slotNowOf(DAYS.d2) }));
    expect(caught.windowsAccounted.map((w) => w.session)).toEqual([DAYS.admit, DAYS.d1]);
    expect(await enterAt(ctx.db, ctx.bookId, ctx.ideaId, { date: DAYS.d1, quotes: QUOTES })).toMatchObject({ outcome: 'not_this_session', reason: 'session_already_closed' });
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).status).toBe('accepted');
    const out = await closeOn(ctx.db, ctx.bookId, DAYS.d2, QUOTES); // the close goes on: the idea timed out, no collision
    expect(out).toMatchObject({ closed: true, session: DAYS.d2, cancelled: [ctx.ideaId] });
  });

  it('more sessions than one transaction takes: an empty book created 1 Oct is accounted for through 13 Nov in order, twenty sessions a transaction, each once', async () => {
    const ctx = await seedBook({ nowIso: etIso('2026-10-01', 9, 0) });
    let txs = 0;
    const run = ctx.db.runTransaction.bind(ctx.db);
    ctx.db.runTransaction = (fn) => { txs += 1; return run(fn); };
    const caught = await catchUpIdeaBook(ctx.db, ctx.bookRef, { before: DAYS.d1, now: slotNowOf(DAYS.d1) });
    const expected = ['2026-10-01'];
    while (nextSessionDate(expected[expected.length - 1]) < DAYS.d1) expected.push(nextSessionDate(expected[expected.length - 1]));
    expect(expected.length).toBeGreaterThan(WINDOW_ONLY_SESSIONS_PER_TX);
    expect(caught).toMatchObject({ complete: true, caughtUp: [] });
    expect(caught.windowsAccounted.map((w) => w.session)).toEqual(expected);
    expect(txs).toBe(Math.ceil(expected.length / WINDOW_ONLY_SESSIONS_PER_TX));
    expect(closeRows(ctx.db, ctx.bookId)).toEqual(expected);
    expect(getBook(ctx.db, ctx.bookId).execState.windowsAccountedThrough).toBe(expected[expected.length - 1]);
    expect(getBook(ctx.db, ctx.bookId).execState.lastCloseKey ?? null).toBeNull(); // nothing valued
    expect(missedAlerts(caught.alerts)).toHaveLength(expected.length * 3);
  });

  it('a valuation catch-up bounded at twenty sessions accounts the windows in order with it: no session skipped or twice, and the next call goes on from there', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, DAYS.d1, 'open30', QUOTES);
    await quiet(() => pass(ctx.db, DAYS.d1, 'open30')); // enters at d1 (and accounts for 13 Nov, before d1)
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).status).toBe('holding');
    const S = [DAYS.d1];
    while (S.length < 26) S.push(nextSessionDate(S[S.length - 1]));
    await storeCloseSnapshot(ctx.db, S[25], QUOTES);
    const first = await quiet(() => closeIdeaBook(ctx.db, ctx.bookRef, { date: S[25], now: closeNowOf(S[25]) }));
    expect(first).toMatchObject({ closed: false, skipped: 'catch_up_incomplete' });
    expect(first.caughtUp.map((c) => c.date)).toEqual(S.slice(0, 20));
    expect(closeRows(ctx.db, ctx.bookId)).toEqual([DAYS.admit, ...S.slice(0, 20)]);
    expect(getBook(ctx.db, ctx.bookId).execState).toMatchObject({ lastCloseKey: S[19], windowsAccountedThrough: S[19] });
    const second = await quiet(() => closeIdeaBook(ctx.db, ctx.bookRef, { date: S[25], now: closeNowOf(S[25]) }));
    expect(second).toMatchObject({ closed: true, session: S[25] });
    expect(closeRows(ctx.db, ctx.bookId)).toEqual([DAYS.admit, ...S]);
    expect(getBook(ctx.db, ctx.bookId).execState).toMatchObject({ lastCloseKey: S[25], windowsAccountedThrough: S[25] });
    // Every session's missed windows once, across both calls: d1's open30 was served, so d1 misses two.
    const all = [...first.alerts, ...second.alerts];
    for (const d of S.slice(1)) expect(missedOn(all, d), d).toHaveLength(3);
    expect(missedOn(all, DAYS.d1)).toHaveLength(2);
  });
});

describe('nothing a committed session or a filled sale did is lost to a later failure', () => {
  it('review B3 — a catch-up that commits one session and then THROWS on the next still logs the committed session\'s missed windows, once', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, DAYS.d1, 'open30', QUOTES);
    await pass(ctx.db, DAYS.d1, 'open30'); // entered; midday and preClose never run; d1's close fire never runs
    await storeCloseSnapshot(ctx.db, DAYS.d1, QUOTES);
    // d2's stored close document is not d2's own: its close throws.
    ctx.db._store.set(`mandateUniverseSnapshots/${DAYS.d2}_close`, { data: { tickKey: `${DAYS.d3}_close`, sessionDate: DAYS.d2, symbols: {} }, version: 1 });
    const logged = []; const original = console.error; console.error = (...x) => logged.push(x.join(' '));
    try {
      await expect(closeIdeaBook(ctx.db, ctx.bookRef, { date: DAYS.d2, now: closeNowOf(DAYS.d2) })).rejects.toThrow(/close_snapshot_key_mismatch/);
    } finally { console.error = original; }
    expect(getBook(ctx.db, ctx.bookId).execState.lastCloseKey).toBe(DAYS.d1); // d1 committed
    expect(logged.filter((l) => /PRACTICE_FIELD_WINDOW_MISSED/.test(l))).toEqual([
      `[PracticeFieldClose] ${ctx.bookId} PRACTICE_FIELD_WINDOW_MISSED ${ctx.bookId} ${DAYS.d1}_midday — the book was due at this window and no pass served it`,
      `[PracticeFieldClose] ${ctx.bookId} PRACTICE_FIELD_WINDOW_MISSED ${ctx.bookId} ${DAYS.d1}_preClose — the book was due at this window and no pass served it`,
    ]);
  });

  it('review B4 — the entry pass throwing as a whole after a sale filled: the window answers the sale and one error, and its row records the sale, not served', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, DAYS.d1, 'open30', QUOTES);
    await pass(ctx.db, DAYS.d1, 'open30');
    const level = getIdea(ctx.db, ctx.bookId, ctx.ideaId).lines[0].level;
    await closeOn(ctx.db, ctx.bookId, DAYS.d1, { AAPL: Math.round((level - 0.02) * 100) / 100, SPY: 600.1 });
    await storeTickSnapshot(ctx.db, DAYS.d2, 'open30', { AAPL: 216.3, SPY: 600.1 });
    // The third read of the book in the window is the entry pass's own: it fails.
    let reads = 0;
    const flaky = { ...ctx.bookRef, get: async () => { reads += 1; if (reads === 3) throw new Error('UNAVAILABLE: injected (entry pass read)'); return ctx.bookRef.get(); } };
    const original = console.error; console.error = () => {};
    let win;
    try { win = await runIdeaBookWindow(ctx.db, { bookRef: flaky, tick: tickOf(DAYS.d2), now: slotNowOf(DAYS.d2) }); } finally { console.error = original; }
    expect(win).toMatchObject({ served: true, complete: true, errors: 1, sales: { sold: 1, errors: 0 }, entries: { errors: 1 } });
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).ledger.saleReceipts).toHaveLength(1);
    await recordWindowAttempt(ctx.db, { bookRef: ctx.bookRef, tick: tickOf(DAYS.d2), win, now: slotNowOf(DAYS.d2) });
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d2, 'open30')).toMatchObject({ served: false, errors: 1, code: { sales: { filled: 1 } }, outcome: 'code_action' });
  });

  it('fix-round refuter NF-5 — the SALES pass throwing as a whole: the entry pass still runs, its fill is the window\'s, and the window is one error, not served', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, DAYS.d1, 'open30', QUOTES);
    // The second read of the book in the window is the sales pass's own: it fails.
    let reads = 0;
    const flaky = { ...ctx.bookRef, get: async () => { reads += 1; if (reads === 2) throw new Error('UNAVAILABLE: injected (sales pass read)'); return ctx.bookRef.get(); } };
    const original = console.error; console.error = () => {};
    let win;
    try { win = await runIdeaBookWindow(ctx.db, { bookRef: flaky, tick: tickOf(DAYS.d1), now: slotNowOf(DAYS.d1) }); } finally { console.error = original; }
    expect(win).toMatchObject({ served: true, complete: true, errors: 1, sales: { sold: 0, errors: 1 }, entries: { entered: 1, errors: 0 } });
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).status).toBe('holding'); // the entry filled
    await recordWindowAttempt(ctx.db, { bookRef: ctx.bookRef, tick: tickOf(DAYS.d1), win, now: slotNowOf(DAYS.d1) });
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d1, 'open30')).toMatchObject({ served: false, errors: 1, code: { entries: { filled: 1 } }, outcome: 'code_action' });
  });
});

describe('a draining or paused book is still due at every window', () => {
  it('the pass serves a draining book\'s window and records it; a paused book\'s too', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, DAYS.d1, 'open30', QUOTES);
    await pass(ctx.db, DAYS.d1, 'open30');
    await closeOn(ctx.db, ctx.bookId, DAYS.d1, QUOTES);
    const prev = process.env.MANDATE_FOUNDER_UIDS;
    process.env.MANDATE_FOUNDER_UIDS = 'owner-1';
    try {
      const { runFounderAction } = await import('./founderControls.js');
      await runFounderAction(ctx.db, { uid: 'owner-1', body: { action: 'pause', requestKey: 'p-1' }, nowIso: etIso(DAYS.d1, 18, 0) });
    } finally { if (prev === undefined) delete process.env.MANDATE_FOUNDER_UIDS; else process.env.MANDATE_FOUNDER_UIDS = prev; }
    expect(getBook(ctx.db, ctx.bookId).drafting).toBe('paused');
    await storeTickSnapshot(ctx.db, DAYS.d2, 'open30', QUOTES);
    await pass(ctx.db, DAYS.d2, 'open30');
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d2, 'open30')).toMatchObject({ served: true });
    await windDownBook(ctx.db, { uid: 'owner-1', nowIso: etIso(DAYS.d2, 12, 0) });
    await storeTickSnapshot(ctx.db, DAYS.d2, 'midday', QUOTES);
    await pass(ctx.db, DAYS.d2, 'midday');
    expect(getBook(ctx.db, ctx.bookId).status).toBe('draining');
    expect(rowOf(ctx.db, ctx.bookId, DAYS.d2, 'midday')).toMatchObject({ served: true });
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).status).toBe('holding');
  });
});
