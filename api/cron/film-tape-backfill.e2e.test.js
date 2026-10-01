// api/cron/film-tape-backfill.e2e.test.js
//
// The backfill (BA-15) END TO END through the real entry points, over a
// fixture range: the admin-secret request to /api/cron/film-tape-close
// writes the range until its budget runs out, the SAME request again resumes
// where it stopped — the queue flag is each tape's own passes.close.status —
// and a third changes nothing; the next morning's /api/cron/film-tape-candles
// enriches every backfilled day inside the retry window; the founder read-out
// (scripts/export-film-tape.js) then reads the whole range back with the
// writer flag OFF. Across all of it: writes land only under
// agentBattles/*/tape (BA-1), and no tick body is ever read (BA-2).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of both cron
// handlers, closePass.js, candlePass.js, writeTapeDay.js and the export
// script are the runtime guard for their surface. Never mock them. The flag
// module is mocked by spreading the real one; the admin handle returns the
// in-memory store; the fetcher is replaced by fixture bars (no network).

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));
const admin = vi.hoisted(() => ({ db: null }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => admin.db }));
const market = vi.hoisted(() => ({ rows: {}, calls: 0 }));
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchIntradayCandles: async (symbol) => { market.calls += 1; return market.rows[symbol] || []; },
}));

import closeHandler from './film-tape-close.js';
import candleHandler from './film-tape-candles.js';
import { TIME_FLOOR_MS } from '../_utils/filmTape/closePass.js';
import { makeTapeDb } from '../_utils/filmTape/__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, skippedModeDay, multiDay } from '../_utils/filmTape/__fixtures__/tapeFixtures.js';
import { flatRows } from '../_utils/filmTape/__fixtures__/tapeBars.js';
import { runExport, makeFirestoreReader } from '../../scripts/export-film-tape.js';

const RANGE = '2026-09-21..2026-09-25';
const DAYS = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
// Every battle-day in the range, in the order the backfill walks it: date, then battle id.
const BATTLE_DAYS = [
  ['2026-09-21', 'b-multi'], ['2026-09-22', 'b-multi'], ['2026-09-23', 'b-multi'],
  ['2026-09-24', 'b-captured'], ['2026-09-24', 'b-flat6'], ['2026-09-24', 'b-multi'],
  ['2026-09-25', 'b-multi'],
];
const BACKFILL_AT = Date.parse('2026-09-28T15:00:00.000Z'); // Monday 11:00 ET — every session in the range has closed
const CANDLES_AT = Date.parse('2026-09-29T11:00:30.000Z');  // Tuesday 07:00 ET — the candle cron
const tapePath = (id, d) => `agentBattles/${id}/tape/${d}`;

function res() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
// The cron guard (Bearer CRON_SECRET) AND the admin secret: a backfill needs both.
const adminReq = (query) => ({ headers: { authorization: 'Bearer cron-secret', 'x-admin-secret': 'admin-secret' }, query });

let t;
const clock = { advancePerTapeWrite: 0 };
const saved = {};

beforeAll(async () => {
  saved.CRON_SECRET = process.env.CRON_SECRET;
  saved.ADMIN_SECRET = process.env.ADMIN_SECRET;
  process.env.CRON_SECRET = 'cron-secret';
  process.env.ADMIN_SECRET = 'admin-secret';
  vi.useFakeTimers({ toFake: ['Date'] });
  const store = {};
  seedDay(store, await multiDay());
  seedDay(store, await capturedDay());
  seedDay(store, await skippedModeDay());
  // Each tape write "takes" advancePerTapeWrite ms of the handler's budget.
  t = makeTapeDb(store, {
    hooks: {
      afterTxRead: async (path) => {
        if (clock.advancePerTapeWrite && /^agentBattles\/[^/]+\/tape\/\d{4}-\d{2}-\d{2}$/.test(path)) vi.setSystemTime(Date.now() + clock.advancePerTapeWrite);
      },
    },
  });
  admin.db = t.db;
  for (const s of ['AAPL', 'MSFT', 'NVDA', 'AMD', 'KO', 'PEP', 'TSLA', 'NFLX', 'XLK', 'XLP', 'XLC', 'XLY', 'SPY', 'RSP']) {
    market.rows[s] = DAYS.flatMap((d) => flatRows(d, 100));
  }
});

afterAll(() => {
  vi.useRealTimers();
  if (saved.CRON_SECRET === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved.CRON_SECRET;
  if (saved.ADMIN_SECRET === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = saved.ADMIN_SECRET;
});

describe('the backfill entry, end to end, resumable by the queue flag', () => {
  let first;
  let afterFirst;

  it('the cron secret alone never runs a backfill when an admin secret is set', async () => {
    vi.setSystemTime(BACKFILL_AT);
    const r = res();
    await closeHandler({ headers: { authorization: 'Bearer cron-secret' }, query: { backfill: RANGE } }, r);
    expect(r.statusCode).toBe(401);
    expect(t.writeLog).toEqual([]);
  });

  it('request 1: writes the range in order until the budget floor, then says where to resume', async () => {
    vi.setSystemTime(BACKFILL_AT);
    clock.advancePerTapeWrite = 100_000; // three writes spend 300 s — past the 30 s floor
    const r = res();
    await closeHandler(adminReq({ backfill: RANGE }), r);
    clock.advancePerTapeWrite = 0;
    expect(r.statusCode).toBe(200);
    first = r.body;
    expect(first).toMatchObject({ mode: 'backfill', complete: false, dates: DAYS });
    const done = first.written.map((w) => [w.etDate, w.battleId]);
    expect(done).toEqual(BATTLE_DAYS.slice(0, done.length));
    expect(done.length).toBe(Math.ceil((300_000 - TIME_FLOOR_MS) / 100_000));
    const [nextDate, nextBattle] = BATTLE_DAYS[done.length];
    expect(first.resumeFrom).toEqual({ etDate: nextDate, battleId: nextBattle });
    for (const [d, id] of BATTLE_DAYS.slice(done.length)) expect(t.store.has(tapePath(id, d)), `${id} ${d}`).toBe(false);
    afterFirst = new Map(BATTLE_DAYS.slice(0, done.length).map(([d, id]) => [tapePath(id, d), JSON.stringify(t.store.get(tapePath(id, d)))]));
  });

  it('request 2 (the same request): the written days are skipped by their own passes.close.status; the rest are written', async () => {
    vi.setSystemTime(BACKFILL_AT + 600_000);
    const r = res();
    await closeHandler(adminReq({ backfill: RANGE }), r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ mode: 'backfill', complete: true, resumeFrom: null });
    expect(r.body.alreadyDone.map((x) => [x.etDate, x.battleId])).toEqual(first.written.map((w) => [w.etDate, w.battleId]));
    const rest = BATTLE_DAYS.slice(first.written.length);
    const reached = [...r.body.written.map((w) => [w.etDate, w.battleId]), ...r.body.skippedMode.map((x) => [x.etDate, x.battleId])];
    expect(reached.sort()).toEqual([...rest].sort());
    expect(r.body.skippedMode).toEqual([{ battleId: 'b-flat6', etDate: '2026-09-24' }]);
    // the days request 1 wrote are byte-identical — skipped, not rewritten
    for (const [p, json] of afterFirst) expect(JSON.stringify(t.store.get(p)), p).toBe(json);
    for (const [d, id] of BATTLE_DAYS) {
      expect(t.store.get(tapePath(id, d)).passes.close.status, `${id} ${d}`).toBe(id === 'b-flat6' ? 'skipped_mode' : 'written');
    }
  });

  it('request 3: everything is already done — zero writes', async () => {
    vi.setSystemTime(BACKFILL_AT + 1_200_000);
    const writes = t.writeLog.length;
    const r = res();
    await closeHandler(adminReq({ backfill: RANGE }), r);
    expect(r.body).toMatchObject({ complete: true, written: [], failed: [] });
    expect(r.body.alreadyDone).toHaveLength(BATTLE_DAYS.length);
    expect(t.writeLog.length).toBe(writes);
  });

  it('the next candle morning enriches every backfilled day inside the retry window', async () => {
    vi.setSystemTime(CANDLES_AT);
    const r = res();
    await candleHandler({ headers: { 'x-vercel-cron': '1' }, query: {} }, r);
    expect(r.statusCode).toBe(200);
    const enriched = BATTLE_DAYS.filter(([, id]) => id !== 'b-flat6');
    expect(r.body.written.map((w) => w.path).sort()).toEqual(enriched.map(([d, id]) => tapePath(id, d)).sort());
    for (const [d, id] of enriched) {
      const tape = t.store.get(tapePath(id, d));
      expect(tape.passes.candles, `${id} ${d}`).toMatchObject({ status: 'written', attempts: 1, symbolsMissing: [] });
      const series = [...t.store.keys()].filter((k) => k.startsWith(`${tapePath(id, d)}/series/`));
      expect(series.length, `${id} ${d}`).toBe(tape.passes.candles.symbolsRequested.length);
    }
    expect(t.store.get(tapePath('b-flat6', '2026-09-24')).passes.candles.status).toBe('skipped');
  });

  it('the founder read-out reads the whole range back with the writer flag OFF', async () => {
    flags.writer = false;
    const writes = t.writeLog.length;
    const out = await runExport(makeFirestoreReader(t.db), { battle: null, date: null, recent: String(BATTLE_DAYS.length) });
    expect(out.days).toHaveLength(BATTLE_DAYS.length);
    expect(out.days.map((d) => d.etDate)).toEqual([...out.days.map((d) => d.etDate)].sort().reverse());
    expect(out.markdown).not.toContain('UNCLASSIFIED');
    expect(out.markdown.split('\n---\n\n')).toHaveLength(BATTLE_DAYS.length);
    expect(out.markdown).toContain("_No day sections: the close pass has not written this day's record (skipped_mode)._");
    expect((out.markdown.match(/^## Checks\n> coverage: \*\*/gm) || []).length).toBe(BATTLE_DAYS.length - 1);
    expect(t.writeLog.length).toBe(writes);
    flags.writer = true;
  });

  it('BA-1 / BA-2 across the whole run: every write under agentBattles/*/tape, never a tick body read', () => {
    expect(t.writeLog.length).toBeGreaterThan(0);
    for (const w of t.writeLog) expect(w.path).toMatch(/^agentBattles\/[^/]+\/tape\/\d{4}-\d{2}-\d{2}(\/series\/[A-Z.-]+)?$/);
    expect(t.readLog.some((r) => String(r).includes('tickBodies'))).toBe(false);
    expect(market.calls).toBeGreaterThan(0);
  });
});
