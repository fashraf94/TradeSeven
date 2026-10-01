// api/cron/film-tape-close.test.js
//
// The close pass (spec §5): the cron guard, the flag at call time (off → zero
// Firestore reads AND writes, and the handle is never even taken), battle
// selection, BA-3's skipped_mode, per-battle isolation, the time floor, and
// the admin-only backfill entry with its queue-flag resumability.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL import of the handler
// and of closePass.js is the runtime guard for their transitive surface
// (src/constants/filmTape.js, src/constants/agentGameModes.js). Never mock
// those imports. The flag module is mocked by spreading the real one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));
const admin = vi.hoisted(() => ({ db: null, calls: 0 }));
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => { admin.calls += 1; return admin.db; },
}));

import handler, { config } from './film-tape-close.js';
import { runClosePass, runBackfill, parseBackfillRange, isBattleDay, tapeDateFor, TIME_FLOOR_MS } from '../_utils/filmTape/closePass.js';
import { makeTapeDb } from '../_utils/filmTape/__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, noTriggerDay, completedDay, skippedModeDay, multiDay } from '../_utils/filmTape/__fixtures__/tapeFixtures.js';

const NIGHT = Date.parse('2026-09-25T02:15:30.000Z'); // 22:15 EDT on 2026-09-24
const tapePath = (id, d) => `agentBattles/${id}/tape/${d}`;

function res() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const cronReq = (query = {}) => ({ headers: { 'x-vercel-cron': '1' }, query });

async function worldOf(...fixtures) {
  const store = {};
  for (const fx of fixtures) seedDay(store, fx);
  return makeTapeDb(store);
}

let savedEnv;
beforeEach(() => {
  flags.writer = true; admin.db = null; admin.calls = 0;
  savedEnv = { CRON_SECRET: process.env.CRON_SECRET, ADMIN_SECRET: process.env.ADMIN_SECRET };
  process.env.CRON_SECRET = 'cron-secret'; delete process.env.ADMIN_SECRET;
});
afterEach(() => {
  process.env.CRON_SECRET = savedEnv.CRON_SECRET;
  if (savedEnv.ADMIN_SECRET === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = savedEnv.ADMIN_SECRET;
  vi.useRealTimers();
});

describe('the handler — guard, flag, wiring', () => {
  it('maxDuration 300 (spec §5)', () => { expect(config.maxDuration).toBe(300); });

  it('refuses a caller with neither the cron header nor the secret', async () => {
    const r = res();
    await handler({ headers: {}, query: {} }, r);
    expect(r.statusCode).toBe(401);
    expect(admin.calls).toBe(0);
  });

  it('FLAG OFF: 200 flag_off — zero Firestore reads, zero writes, and the admin handle is never taken', async () => {
    flags.writer = false;
    const fx = await capturedDay();
    const t = await worldOf(fx);
    admin.db = t.db;
    for (const req of [cronReq(), cronReq({ backfill: '2026-09-21..2026-09-24' }), { headers: { authorization: 'Bearer cron-secret' }, query: { backfill: '2026-09-21..2026-09-24' } }]) {
      const r = res();
      await handler(req, r);
      expect(r.statusCode).toBe(200);
      expect(r.body).toEqual({ skipped: true, reason: 'flag_off' });
    }
    expect(admin.calls).toBe(0);
    expect(t.writeLog).toEqual([]);
    expect(t.readLog).toEqual([]);
  });

  it('flag on: the scheduled call runs the close pass for tonight\'s ET date and writes only tape documents', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NIGHT);
    const fx = await capturedDay();
    const t = await worldOf(fx);
    admin.db = t.db;
    const r = res();
    await handler(cronReq(), r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ mode: 'close', etDate: '2026-09-24', battles: 1 });
    expect(r.body.written).toHaveLength(1);
    expect(t.writeLog.every((w) => /^agentBattles\/[^/]+\/tape\/\d{4}-\d{2}-\d{2}$/.test(w.path))).toBe(true);
  });

  it('the backfill entry is ADMIN-ONLY: the cron header alone never runs it', async () => {
    const fx = await capturedDay();
    const t = await worldOf(fx);
    admin.db = t.db;
    const r = res();
    await handler(cronReq({ backfill: '2026-09-24..2026-09-24' }), r);
    expect(r.statusCode).toBe(401);
    expect(t.writeLog).toEqual([]);
  });

  it('with an ADMIN_SECRET set, a backfill needs BOTH guards: the cron Bearer and the x-admin-secret header (review L3-F5)', async () => {
    process.env.ADMIN_SECRET = 'admin-secret';
    admin.db = (await worldOf()).db;
    const call = async (headers) => { const r = res(); await handler({ headers, query: { backfill: 'bad-range' } }, r); return r.statusCode; };
    expect(await call({ authorization: 'Bearer admin-secret' })).toBe(401);                            // fails the cron guard
    expect(await call({ authorization: 'Bearer cron-secret' })).toBe(401);                             // fails the admin check
    expect(await call({ 'x-vercel-cron': '1' })).toBe(401);                                            // the scheduled call never backfills
    expect(await call({ authorization: 'Bearer cron-secret', 'x-admin-secret': 'admin-secret' })).toBe(400); // both: through to the range check
    expect(await call({ 'x-vercel-cron': '1', 'x-admin-secret': 'admin-secret' })).toBe(400);
  });

  it('the backfill entry validates its range', async () => {
    admin.db = (await worldOf()).db;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-09-28T15:00:00Z')); // Monday 11:00 ET: that session is open
    for (const [bad, word] of [['2026-09-24', 'invalid_range'], ['2026-09-26..2026-09-24', 'invalid_range'], ['2026-09-26..2026-09-27', 'no_sessions_in_range'], ['2026-01-02..2026-06-30', 'range_too_long'], ['2026-09-21..2026-09-28', 'range_not_closed']]) {
      const r = res();
      await handler({ headers: { authorization: 'Bearer cron-secret' }, query: { backfill: bad } }, r);
      expect(r.statusCode, bad).toBe(400);
      expect(r.body).toEqual({ error: word });
    }
  });

  it('with the admin secret, the backfill writes the range and reports completion', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-09-26T15:00:00Z'));
    const fx = await capturedDay();
    const t = await worldOf(fx);
    admin.db = t.db;
    const r = res();
    await handler({ headers: { authorization: 'Bearer cron-secret' }, query: { backfill: '2026-09-23..2026-09-25' } }, r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ mode: 'backfill', complete: true, resumeFrom: null, dates: ['2026-09-23', '2026-09-24', '2026-09-25'] });
    expect(r.body.written).toEqual([expect.objectContaining({ battleId: 'b-captured', etDate: '2026-09-24' })]);
    expect(t.store.has(tapePath('b-captured', '2026-09-24'))).toBe(true);
  });
});

describe('runClosePass — selection (§5)', () => {
  it('active battles and battles completed on the ET date; a battle whose trading day is not tonight gets nothing', async () => {
    const a = await capturedDay({ battleId: 'b-a' });
    const done = await completedDay({ battleId: 'b-done' });
    const tomorrow = await noTriggerDay({ battleId: 'b-tomorrow' });
    tomorrow.battle.timing = { tradingDays: ['2026-09-25'] };
    tomorrow.ticks = [];
    const t = await worldOf(a, done, tomorrow);
    const s = await runClosePass({ db: t.db, clock: () => NIGHT, startMs: NIGHT });
    expect(s.etDate).toBe('2026-09-24');
    expect(s.written.map((w) => w.battleId).sort()).toEqual(['b-a', 'b-done']);
    expect(s.notBattleDay).toEqual(['b-tomorrow']);
    expect(t.store.has(tapePath('b-tomorrow', '2026-09-24'))).toBe(false);
  });

  it('a flat6/tournament battle gets its skipped_mode document (BA-3)', async () => {
    const t = await worldOf(await skippedModeDay());
    const s = await runClosePass({ db: t.db, clock: () => NIGHT, startMs: NIGHT });
    expect(s.skippedMode).toEqual(['b-flat6']);
    expect(t.store.get(tapePath('b-flat6', '2026-09-24')).passes.close.status).toBe('skipped_mode');
  });

  it('a battle that completed tonight after its last session gets its FINAL day re-merged', async () => {
    const m = await multiDay({ full: true });
    m.battle.timing.tradingDays = ['2026-09-21', '2026-09-22', '2026-09-23'];
    m.battle.status = 'completed';
    m.battle.completedAt = '2026-09-24T13:05:00.000Z'; // swept the next morning
    const t = await worldOf(m);
    const s = await runClosePass({ db: t.db, clock: () => NIGHT, startMs: NIGHT });
    expect(s.written).toEqual([expect.objectContaining({ battleId: 'b-multi', etDate: '2026-09-23' })]);
    expect(t.store.get(tapePath('b-multi', '2026-09-23')).battle.status).toBe('completed');
    expect(tapeDateFor(m.battle, '2026-09-24')).toBe('2026-09-23');
  });

  it('a non-session ET date answers not_a_trading_day and reads nothing', async () => {
    const t = await worldOf(await capturedDay());
    const sat = Date.parse('2026-09-27T02:15:00Z'); // Saturday 22:15 EDT on 2026-09-26
    const s = await runClosePass({ db: t.db, clock: () => sat, startMs: sat });
    expect(s).toEqual({ skipped: true, reason: 'not_a_trading_day', etDate: '2026-09-26' });
    expect(t.readLog).toEqual([]);
  });

  it('isBattleDay reads timing.tradingDays; a legacy document falls back to its active window', () => {
    expect(isBattleDay({ timing: { tradingDays: ['2026-09-24'] } }, '2026-09-24')).toBe(true);
    expect(isBattleDay({ timing: { tradingDays: ['2026-09-25'] } }, '2026-09-24')).toBe(false);
    expect(isBattleDay({ activatedAt: '2026-09-22T13:00:00Z', completedAt: '2026-09-25T20:00:00Z' }, '2026-09-24')).toBe(true);
    expect(isBattleDay({ activatedAt: '2026-09-25T13:00:00Z' }, '2026-09-24')).toBe(false);
  });
});

describe('runClosePass — budget and isolation', () => {
  it('a battle whose write throws gets its failure record; the next battle proceeds', async () => {
    const a = await capturedDay({ battleId: 'b-a' });
    const b = await noTriggerDay({ battleId: 'b-b' });
    const t = await worldOf(a, b);
    const { writeTapeDay } = await import('../_utils/filmTape/writeTapeDay.js');
    const write = async (id, d, o) => { if (id === 'b-a') throw new Error('boom'); return writeTapeDay(id, d, o); };
    const s = await runClosePass({ db: t.db, clock: () => NIGHT, startMs: NIGHT, write });
    expect(s.failed).toEqual([{ battleId: 'b-a', etDate: '2026-09-24', reason: 'boom' }]);
    expect(s.written.map((w) => w.battleId)).toEqual(['b-b']);
    expect(t.store.get(tapePath('b-a', '2026-09-24')).passes.close).toMatchObject({ status: 'failed', reason: 'boom' });
  });

  it('below the 30 s floor, the rest are named notReached — none is half-written', async () => {
    const a = await capturedDay({ battleId: 'b-a' });
    const b = await noTriggerDay({ battleId: 'b-b' });
    const t = await worldOf(a, b);
    let now = NIGHT;
    const clock = () => now;
    const { writeTapeDay } = await import('../_utils/filmTape/writeTapeDay.js');
    const write = async (id, d, o) => { const r = await writeTapeDay(id, d, o); now = NIGHT + 300_000 - TIME_FLOOR_MS + 1; return r; };
    const s = await runClosePass({ db: t.db, clock, startMs: NIGHT, budgetMs: 300_000, write });
    expect(s.written.map((w) => w.battleId)).toEqual(['b-a']);
    expect(s.notReached).toEqual(['b-b']);
    expect(t.store.has(tapePath('b-b', '2026-09-24'))).toBe(false);
  });
});

describe('the backfill (BA-15) — resumable by the queue flag', () => {
  it('parseBackfillRange: sessions only, inclusive, bounded', () => {
    expect(parseBackfillRange('2026-09-21..2026-09-25').dates).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
    expect(parseBackfillRange('2026-09-25..2026-09-28').dates).toEqual(['2026-09-25', '2026-09-28']);
    expect(parseBackfillRange('nope').error).toBe('invalid_range');
  });

  it('parseBackfillRange: a range reaching a session that has not closed is refused — no tape for a day that has not happened', () => {
    const closeOf0925 = Date.parse('2026-09-25T20:00:00.000Z'); // 16:00 EDT
    expect(parseBackfillRange('2026-09-24..2026-09-25', { nowMs: closeOf0925 - 1 }).error).toBe('range_not_closed');
    expect(parseBackfillRange('2026-09-24..2026-09-25', { nowMs: closeOf0925 }).dates).toEqual(['2026-09-24', '2026-09-25']);
    expect(parseBackfillRange('2026-09-28..2026-10-02', { nowMs: closeOf0925 }).error).toBe('range_not_closed');
    // an early-close session closes at 13:00 ET
    expect(parseBackfillRange('2026-11-27..2026-11-27', { nowMs: Date.parse('2026-11-27T18:00:00.000Z') }).dates).toEqual(['2026-11-27']);
  });

  it('writes every battle-day in the range; a re-invocation after a budget stop resumes where it stopped', async () => {
    const m = await multiDay();
    const t = await worldOf(m);
    const dates = parseBackfillRange('2026-09-21..2026-09-25').dates;
    let now = Date.parse('2026-09-28T15:00:00Z');
    const start = now;
    const { writeTapeDay } = await import('../_utils/filmTape/writeTapeDay.js');
    let n = 0;
    const write = async (id, d, o) => { const r = await writeTapeDay(id, d, o); n += 1; if (n === 2) now = start + 300_000 - TIME_FLOOR_MS + 1; return r; };
    const first = await runBackfill({ db: t.db, clock: () => now, startMs: start, budgetMs: 300_000, dates, write });
    expect(first.complete).toBe(false);
    expect(first.written.map((w) => w.etDate)).toEqual(['2026-09-21', '2026-09-22']);
    expect(first.resumeFrom).toEqual({ etDate: '2026-09-23', battleId: 'b-multi' });
    // the same request, a fresh budget: the two written days are skipped by their own passes.close.status
    now = Date.parse('2026-09-28T15:10:00Z');
    const second = await runBackfill({ db: t.db, clock: () => now, startMs: now, budgetMs: 300_000, dates });
    expect(second.complete).toBe(true);
    expect(second.alreadyDone.map((x) => x.etDate)).toEqual(['2026-09-21', '2026-09-22']);
    expect(second.written.map((w) => w.etDate)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25']);
    for (const d of m.days) expect(t.store.get(tapePath('b-multi', d)).passes.close.status, d).toBe('written');
    expect(t.writeLog.every((w) => /\/tape\//.test(w.path))).toBe(true);
  });
});
