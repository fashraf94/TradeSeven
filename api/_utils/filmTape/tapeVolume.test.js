// api/_utils/filmTape/tapeVolume.test.js
//
// Film Room B1 item 7 — W3, a missing volume stays missing, end to end. The
// generic intraday fetcher (marketDataCache.js fetchIntradayCandles) projects
// `volume: d.volume || 0` for every caller, so bars.js never saw a missing
// volume: the tape's candle pass now asks it to keep one (keepMissingVolume),
// and only the tape — every other caller's projection is unchanged. Tapes
// already written keep their zeros (nothing rewrites a stored series' volume).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real fetcher and passes; only
// the flag module is mocked, by spreading the real one, and the network
// (globalThis.fetch) is stubbed.

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { fetchIntradayCandles } from '../marketDataCache.js';
import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass, keepSeries } from './candlePass.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { sessionRows, flatRows, fetcherOf } from './__fixtures__/tapeBars.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z');

afterEach(() => { vi.unstubAllGlobals(); });

describe('the generic fetcher\'s projection', () => {
  const EODHD = [
    { datetime: '2026-09-24 13:30:00', open: 1, high: 2, low: 0.5, close: 1.5, volume: 300 },
    { datetime: '2026-09-24 13:31:00', open: 1.5, high: 2, low: 1, close: 1.8, volume: null },   // a real range, no volume
    { datetime: '2026-09-24 13:32:00', open: 1.8, high: 2, low: 1, close: 1.9, volume: 0 },
    { datetime: '2026-09-24 13:33:00', open: 1.9, high: 2, low: 1, close: 1.7 },                 // volume absent
  ];
  async function fetchWith(options) {
    process.env.EODHD_API_KEY = process.env.EODHD_API_KEY || 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => structuredClone(EODHD) })));
    return fetchIntradayCandles('ACN', options);
  }

  it('by default — every caller but the tape — unchanged: a missing volume reads 0', async () => {
    expect((await fetchWith({ interval: '1m' })).map((c) => c.volume)).toEqual([300, 0, 0, 0]);
    expect((await fetchWith({ interval: '5m', hoursBack: 3 })).map((c) => c.volume)).toEqual([300, 0, 0, 0]);
  });

  it('with keepMissingVolume (the tape\'s candle pass): a missing volume reads null; a real 0 stays 0', async () => {
    expect((await fetchWith({ interval: '1m', keepMissingVolume: true })).map((c) => c.volume)).toEqual([300, null, 0, null]);
  });
});

describe('through the real candle pass: the stored series keeps the missing volume missing', () => {
  it('the candle pass asks for missing volumes; ACN\'s 09:30 bucket (one minute without its volume) is stored null, the next one summed', async () => {
    const fx = await stalledDay({ battleId: 'b-volume' });
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT });
    const acn = sessionRows(D, () => 300).map((r, i) => (i === 3 ? { ...r, volume: null } : r));   // rows[3] = 09:32
    const f = fetcherOf(new Proxy({}, { get: (_, sym) => (sym === 'ACN' ? acn : (typeof sym === 'string' ? flatRows(D, 100) : undefined)) }));
    await runCandlePass({ db: t.db, fetchCandles: f.fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(f.calls.length).toBeGreaterThan(0);
    expect(f.calls.every((c) => c.keepMissingVolume === true && c.interval === '1m')).toBe(true);
    const series = t.store.get(`agentBattles/${fx.battleId}/tape/${D}/series/ACN`);
    expect(series.bars[0]).toMatchObject({ t: '2026-09-24T13:30:00.000Z', v: null, m: 10 });
    expect(series.bars[1]).toMatchObject({ t: '2026-09-24T13:40:00.000Z', v: 10_000, m: 10 });
    expect(series.numberClasses['bars[].v']).toBe('market');
  });
});

describe('review B-4 — the BA-34 series merge never keeps a missing volume over a later response that has it', () => {
  const bar = (v, m = 10) => ({ t: '2026-09-24T13:30:00.000Z', o: 1, h: 1, l: 1, c: 1, v, n: m, m });
  const doc = (bars) => ({ symbol: 'ACN', bars, atChecks: [], sessionOpen: null });

  it('equal minutes: the saved null gives way to the fresh volume — nothing kept', () => {
    const r = keepSeries(doc([bar(null)]), doc([bar(9000)]));
    expect(r.kept).toBe(false);
    expect(r.doc.bars[0].v).toBe(9000);
  });

  it('equal minutes, the fresh response missing the volume: the saved volume stands (a saved fact never shrinks)', () => {
    const r = keepSeries(doc([bar(9000)]), doc([bar(null)]));
    expect(r.doc.bars[0].v).toBe(9000);
    expect(r.kept).toBe(true);
  });

  it('more minutes still win, whatever the volume', () => {
    expect(keepSeries(doc([bar(9000, 9)]), doc([bar(null, 10)])).doc.bars[0]).toMatchObject({ v: null, m: 10 });
  });
});
