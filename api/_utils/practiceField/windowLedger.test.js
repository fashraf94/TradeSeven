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
import { runIdeaBookEvalPass } from './sweep.js';
import { closeIdeaBook } from './close.js';
import { ideaBookWindowsOf, windowRowId, CLOSE_WINDOW } from './windows.js';
import { recordWindowAttempt, foldWindowAttempt, attemptOf, buildCloseWindowRow, WINDOW_OUTCOME } from './windowLedger.js';
import {
  seedBook, contractOf, closeOn, storeTickSnapshot, storeCloseSnapshot, tickSnapshot, tickOf, slotNowOf, closeNowOf, etIso, DAYS, ADMIT_ISO,
  getBook, getIdea, windDownBook, withoutWindowAlerts,
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
    expect(ideaBookWindowsOf(DAYS.d1, { createdAtIso: etIso(DAYS.d1, 17, 0) }).map((x) => x.window)).toEqual([CLOSE_WINDOW]);
    expect(ideaBookWindowsOf('2026-11-14')).toEqual([]); // a Saturday
    expect(ideaBookWindowsOf('2026-11-26')).toEqual([]); // Thanksgiving
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
    const a1 = attemptOf({ complete: false, errors: 0, skipped: 'catch_up_incomplete', caughtUp: [{ date: '2026-11-13', observed: true }], sales: { sold: 1, waiting: 2 }, entries: { entered: 0, waiting: 1 } }, { nowIso: 'A' });
    const r1 = foldWindowAttempt(null, a1, { bookId: 'b', tick });
    expect(r1).toMatchObject({ served: false, attempts: 1, code: { caughtUpSessions: [{ date: '2026-11-13', observed: true }], sales: { filled: 1, waiting: 2 }, entries: { waiting: 1 } } });
    const a2 = attemptOf({ complete: true, errors: 0, caughtUp: [{ date: '2026-11-13', observed: true }], sales: { sold: 1, waiting: 0, resulted: 1 }, entries: { entered: 1, cancelled: 1 } }, { nowIso: 'B' });
    const r2 = foldWindowAttempt(r1, a2, { bookId: 'b', tick });
    expect(r2).toMatchObject({ served: true, servedAt: 'B', firstAttemptAt: 'A', attempts: 2, code: { caughtUpSessions: [{ date: '2026-11-13', observed: true }], sales: { filled: 2, waiting: 0 }, entries: { filled: 1, waiting: 0, cancelled: 1 }, ideasResulted: 1 } });
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
      served: true, servedAt: closeNowOf(DAYS.d1).toISOString(), observed: true, closeSnapshotKey: `${DAYS.d1}_close`,
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

  it('buildCloseWindowRow is the whole judgment: missing is every expected intraday window without a SERVED row', () => {
    const book = { createdAt: new Date(etIso(DAYS.admit, 9, 0)) };
    const base = { bookId: 'b', book, session: DAYS.d1, observed: true, catchUp: false, snapshotMeta: { key: `${DAYS.d1}_close` }, bookClosed: false, nowIso: 'N', code: { ideasValued: 0, endpoints: [], resulted: [], cancelled: [] } };
    expect(buildCloseWindowRow({ ...base, windowRows: {} }).missing).toEqual(['open30', 'midday', 'preClose']);
    expect(buildCloseWindowRow({ ...base, windowRows: { open30: { served: true }, midday: { served: false }, preClose: { served: true } } }).missing).toEqual(['midday']);
    expect(buildCloseWindowRow({ ...base, windowRows: { open30: { served: true }, midday: { served: true }, preClose: { served: true } } }).alerts).toEqual([]);
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
