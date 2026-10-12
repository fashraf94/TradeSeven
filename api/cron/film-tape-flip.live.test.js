// api/cron/film-tape-flip.live.test.js
//
// Film Room A1 — THE WRITER FLIP, against the REAL flag values (spec §10 flip 1).
// Every behaviour suite of the tape mocks FILM_TAPE_WRITE_ENABLED both ways, so
// none of them can say what the shipped value does. This file mocks NEITHER
// flag: it reads src/config/featureFlags.js as it ships and proves
//   1. the close handler no longer answers flag_off — it takes the Firestore
//      handle and writes the day's tape (and the admin backfill entry runs);
//   2. the candle handler no longer answers flag_off — it takes the handle and
//      selects the waiting tape;
//   3. the hub helper answers from Stage 3: Film Room v2 resolves on for every
//      owner (FILM_ROOM_V2_MODE 'on', Amendment E BA-40), so it spends one
//      bounded read of the final day's tape, asks no allowlist verdict, and
//      never answers from the legacy review (spec §11). The flip to 'on'
//      turned this row around in its own commit; under 'allowlist' with no
//      signed-in owner it answered from Stage 1.
// A writer rollback (back to false) reds the three handler rows and the helper row's
// `pending`; a screen rollback (back to 'allowlist') reds the helper row. The value pins live in src/config/filmTapeFlags.test.js
// alone: this file asserts BEHAVIOUR, never `expect(FLAG).toBe(…)`, so the
// flag-pin guard's one-pinning-suite pointer stays as it is.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of both handlers,
// closePass.js and the hub helper are the runtime guard for their transitive
// surface. Never mock them; only the Admin handle and the market fetcher are
// stubbed, as in film-tape-close.test.js and film-tape-candles.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const admin = vi.hoisted(() => ({ db: null, calls: 0 }));
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => { admin.calls += 1; return admin.db; },
}));
const fetches = vi.hoisted(() => ({ calls: [] }));
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchIntradayCandles: async (symbol, opts) => { fetches.calls.push({ symbol, ...opts }); return []; },
}));

import closeHandler from './film-tape-close.js';
import candleHandler from './film-tape-candles.js';
import { getReviewAvailability } from '../../src/utils/reviewAvailability.js';
import { makeTapeDb } from '../_utils/filmTape/__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay } from '../_utils/filmTape/__fixtures__/tapeFixtures.js';

const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');   // 22:15 EDT on 2026-09-24 — the close pass
const MORNING = Date.parse('2026-09-25T11:00:30.000Z'); // 07:00 EDT on 2026-09-25 — the candle pass
const cronReq = (query = {}) => ({ headers: { 'x-vercel-cron': '1' }, query });

function res() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

async function worldOf(...fixtures) {
  const store = {};
  for (const fx of fixtures) seedDay(store, fx);
  return makeTapeDb(store);
}

let savedEnv;
beforeEach(() => {
  admin.db = null; admin.calls = 0; fetches.calls = [];
  savedEnv = { CRON_SECRET: process.env.CRON_SECRET, ADMIN_SECRET: process.env.ADMIN_SECRET };
  process.env.CRON_SECRET = 'cron-secret'; delete process.env.ADMIN_SECRET;
});
afterEach(() => {
  process.env.CRON_SECRET = savedEnv.CRON_SECRET;
  if (savedEnv.ADMIN_SECRET === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = savedEnv.ADMIN_SECRET;
  vi.useRealTimers();
});

describe('the flip, with the REAL flag values (no flag mock in this file)', () => {
  it('the close handler no longer answers flag_off: it takes the handle and writes the day\'s tape', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NIGHT);
    const fx = await capturedDay();
    const t = await worldOf(fx);
    admin.db = t.db;
    const r = res();
    await closeHandler(cronReq(), r);
    expect(r.statusCode).toBe(200);
    expect(r.body.reason).not.toBe('flag_off');
    expect(r.body.mode).toBe('close');
    expect(r.body.etDate).toBe('2026-09-24');
    expect(admin.calls).toBe(1);
    expect(r.body.written.length).toBeGreaterThan(0);
    expect(t.writeLog.some((w) => /^agentBattles\/[^/]+\/tape\/2026-09-24$/.test(w.path))).toBe(true);
  });

  it('the close handler\'s admin backfill entry runs too (both guards), instead of flag_off', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NIGHT);
    const fx = await capturedDay();
    const t = await worldOf(fx);
    admin.db = t.db;
    process.env.ADMIN_SECRET = 'admin-secret';
    const r = res();
    await closeHandler({ headers: { authorization: 'Bearer cron-secret', 'x-admin-secret': 'admin-secret' }, query: { backfill: '2026-09-21..2026-09-24' } }, r);
    expect(r.statusCode).toBe(200);
    expect(r.body.reason).not.toBe('flag_off');
    expect(r.body.mode).toBe('backfill');
    expect(r.body.complete).toBe(true);
    expect(admin.calls).toBe(1);
  });

  it('the candle handler no longer answers flag_off: it takes the handle and selects the waiting tape', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NIGHT);
    const fx = await capturedDay();
    const t = await worldOf(fx);
    admin.db = t.db;
    await closeHandler(cronReq(), res());               // the night's tape, so the morning has work
    admin.calls = 0;
    vi.setSystemTime(MORNING);
    const r = res();
    await candleHandler(cronReq(), r);
    expect(r.statusCode).toBe(200);
    expect(r.body.reason).not.toBe('flag_off');
    expect(r.body.skipped).toBeUndefined();
    expect(r.body.runEtDate).toBe('2026-09-25');
    expect(admin.calls).toBe(1);
    expect(r.body.selected).toBeGreaterThan(0);
    expect(fetches.calls.length).toBeGreaterThan(0);
  });

  it("the hub helper answers from Stage 3: v2 is on for every owner (FILM_ROOM_V2_MODE 'on') — one bounded read of the final day's tape, no allowlist verdict, never the legacy review (spec §11)", async () => {
    const calls = [];
    const verdicts = [];
    let stored = { passes: { close: { status: 'written' } } };
    const readTape = async (battleId, etDate) => { calls.push([battleId, etDate]); return stored; };
    const readVerdict = async (battleId) => { verdicts.push(battleId); return false; };
    const completedNoReview = {
      id: 'battle-1', status: 'completed', completedAt: '2026-09-28T20:05:00.000Z', ownerId: 'u1',
      timing: { tradingDays: ['2026-09-28'] }, dailyReviews: [], reviewPending: false,
    };
    const answer = (battle, now) => getReviewAvailability(battle, { readTape, readVerdict, now });
    const TONIGHT = Date.parse('2026-09-28T23:00:00.000Z');   // 19:00 EDT, before the night's close pass
    const LATER = Date.parse('2026-10-01T15:00:00.000Z');     // every pass that could tape the final day has run
    // ready: the final day's tape has a written close pass — with no legacy review (Stage 1 would say unavailable)
    expect(await answer(completedNoReview, LATER)).toEqual({ ready: true, target: 'filmRoom', availability: 'ready' });
    // no tape yet: pending while the close pass that tapes the final day is still to run (the writer is lit)…
    stored = null;
    expect(await answer(completedNoReview, TONIGHT)).toEqual({ ready: false, target: 'filmRoom', availability: 'pending' });
    // …and unavailable once it has run — even beside a legacy review, which Stage 1 would call ready
    expect(await answer({ ...completedNoReview, dailyReviews: [{ day: 1 }] }, LATER)).toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    // active: not completed — unavailable, and no read spent
    expect(await answer({ ...completedNoReview, status: 'active', completedAt: null }, LATER)).toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    // one bounded read per completed battle, of tape/{its last trading day}; 'on' never asks for the allowlist verdict
    expect(calls).toEqual([['battle-1', '2026-09-28'], ['battle-1', '2026-09-28'], ['battle-1', '2026-09-28']]);
    expect(verdicts).toEqual([]);
  });
});
