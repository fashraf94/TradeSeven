// api/cron/film-tape-candles.test.js
//
// The candle pass handler (spec §6): the cron guard; the writer flag at call
// time — off → zero Firestore reads, zero writes, ZERO fetches, and the admin
// handle never taken; on → the generic fetcher at interval '1m'.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL import of the handler
// and of candlePass.js is the runtime guard for their transitive surface.
// Never mock them. The flag module is mocked by spreading the real one; the
// fetcher is wrapped so no request leaves the test.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));
const admin = vi.hoisted(() => ({ db: null, calls: 0 }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => { admin.calls += 1; return admin.db; } }));
const fetches = vi.hoisted(() => ({ calls: [], bars: {} }));
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchIntradayCandles: async (symbol, opts) => { fetches.calls.push({ symbol, ...opts }); return fetches.bars[symbol] || []; },
}));

import handler, { config } from './film-tape-candles.js';
import { writeTapeDay } from '../_utils/filmTape/writeTapeDay.js';
import { makeTapeDb } from '../_utils/filmTape/__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay } from '../_utils/filmTape/__fixtures__/tapeFixtures.js';
import { flatRows } from '../_utils/filmTape/__fixtures__/tapeBars.js';

function res() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

let savedSecret;
beforeEach(() => {
  flags.writer = true; admin.db = null; admin.calls = 0; fetches.calls = []; fetches.bars = {};
  savedSecret = process.env.CRON_SECRET; process.env.CRON_SECRET = 'cron-secret';
});
afterEach(() => { process.env.CRON_SECRET = savedSecret; vi.useRealTimers(); });

describe('film-tape-candles handler', () => {
  it('maxDuration 300 (spec §6)', () => { expect(config.maxDuration).toBe(300); });

  it('refuses a caller with neither the cron header nor the secret', async () => {
    const r = res();
    await handler({ headers: {}, query: {} }, r);
    expect(r.statusCode).toBe(401);
    expect(admin.calls).toBe(0);
  });

  it('FLAG OFF: 200 flag_off — zero reads, zero writes, zero fetches, the admin handle never taken', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: Date.parse('2026-09-25T02:15:30Z') });
    const writesBefore = t.writeLog.length;
    const readsBefore = t.readLog.length;
    flags.writer = false;
    admin.db = t.db;
    const r = res();
    await handler({ headers: { 'x-vercel-cron': '1' }, query: {} }, r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ skipped: true, reason: 'flag_off' });
    expect(admin.calls).toBe(0);
    expect(t.writeLog.length).toBe(writesBefore);
    expect(t.readLog.length).toBe(readsBefore);
    expect(fetches.calls).toEqual([]);
  });

  it('flag on: the morning run fetches 1-minute bars through the generic fetcher and writes the pass', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: Date.parse('2026-09-25T02:15:30Z') });
    for (const s of ['AAPL', 'MSFT', 'NVDA', 'AMD', 'KO', 'PEP', 'TSLA', 'NFLX', 'XLK', 'XLP', 'XLC', 'XLY', 'SPY', 'RSP']) fetches.bars[s] = flatRows('2026-09-24', 100);
    admin.db = t.db;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-09-25T11:00:30Z'));
    const r = res();
    await handler({ headers: { 'x-vercel-cron': '1' }, query: {} }, r);
    expect(r.statusCode).toBe(200);
    expect(r.body.written).toHaveLength(1);
    expect(fetches.calls.length).toBe(14);
    expect(fetches.calls.every((c) => c.interval === '1m' && Number.isInteger(c.hoursBack))).toBe(true);
    expect(t.store.get(`agentBattles/${fx.battleId}/tape/2026-09-24`).passes.candles.status).toBe('written');
  });
});
