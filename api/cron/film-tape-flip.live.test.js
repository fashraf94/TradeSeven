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
//   3. the hub helper still answers from Stage 1: Stage 3 needs Film Room v2
//      to resolve on for the owner (FILM_ROOM_V2_MODE, Amendment E BA-40) —
//      the lit writer changes nothing a player sees. Under 'allowlist' with no
//      signed-in owner it is still Stage 1; the flip to 'on' turns this row
//      around in its own commit (the runway in featureFlags.js says so).
// A rollback (the writer back to false) reds the three handler rows; an accidental
// screen flip reds the helper row. The value pins live in src/config/filmTapeFlags.test.js
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

  it('the hub helper stays on Stage 1: Stage 3 still needs v2 on for the owner (FILM_ROOM_V2_MODE) — no tape read, the legacy answer', async () => {
    const calls = [];
    const readTape = async (battleId, etDate) => { calls.push([battleId, etDate]); return { passes: { close: { status: 'written' } } }; };
    const completedNoReview = {
      id: 'battle-1', status: 'completed', completedAt: '2026-09-28T20:05:00.000Z', ownerId: 'u1',
      timing: { tradingDays: ['2026-09-28'] }, dailyReviews: [], reviewPending: false,
    };
    // Stage 3 would read the written final-day tape and answer `ready`, or
    // `pending` before tonight's pass (the writer is lit). Stage 1 reads
    // nothing and answers from the battle document alone.
    for (const now of [Date.parse('2026-09-28T23:00:00.000Z'), Date.parse('2026-10-01T15:00:00.000Z')]) {
      expect(await getReviewAvailability(completedNoReview, { readTape, now }))
        .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    }
    expect(await getReviewAvailability({ ...completedNoReview, dailyReviews: [{ day: 1 }] }, { readTape, now: Date.parse('2026-10-01T15:00:00.000Z') }))
      .toEqual({ ready: true, target: 'filmRoom', availability: 'ready' });
    expect(calls).toEqual([]);
  });
});
