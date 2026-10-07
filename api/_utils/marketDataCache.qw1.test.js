// @vitest-environment node
//
// api/_utils/marketDataCache.qw1.test.js
//
// EODHD Quick Wins QW-1 — the session-currency rule for the evaluator's daily
// series (build report docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md §2, §3).
//
// The REAL getStockAnalysisData over the REAL two-layer cache (serverCache L1 is
// the real module, reset per path by re-importing; L2 is an in-memory Firestore
// fake that stores exactly what setCachedData writes). The vendor is the only
// stub. The clock is pinned to Wed 2026-10-07 11:00 ET (market open), so the
// prior completed session is Tue 2026-10-06.
//
// The proofs the build prompt names:
//   P1  the Guard 2 reference (prior close) and every field the evaluator reads
//       from a call — `daily` and `price` — are IDENTICAL whether the series
//       comes from the cache or a fresh fetch, given the same bars;
//   P2  red-then-green: a cached series one session stale must re-fetch (the
//       red half is the mutation run recorded in the build report §2);
//   plus every refusal the rule promises: a today-dated bar, a TTL-stale doc,
//   a null calendar, a closed session, a failed re-fetch never served stale,
//   the quote-failure re-fetch, crypto's UTC day, and forceRefresh winning.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveBadgeBaseline } from './baselineValidation.js';

// ── L2: an in-memory Firestore that keeps what setCachedData writes ─────────
const store = vi.hoisted(() => new Map());
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => {}, cert: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (col) => ({
      doc: (id) => ({
        get: async () => {
          const v = store.get(`${col}/${id}`);
          return { exists: v !== undefined, data: () => (v === undefined ? undefined : structuredClone(v)) };
        },
        set: async (data) => { store.set(`${col}/${id}`, structuredClone(data)); },
      }),
    }),
  }),
}));

const NOW = '2026-10-07T15:00:00.000Z'; // Wed 11:00 ET — session open
const PRIOR = '2026-10-06';             // the prior completed session

/** Raw EODHD `/eod/` rows, newest-first (the URL carries order=d), weekdays only. */
function rawBars(newestDate, n = 62, base = 100) {
  const out = [];
  const d = new Date(`${newestDate}T12:00:00Z`);
  let i = 0;
  while (out.length < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const close = +(base + Math.sin(i / 3) * 4 + i * 0.05).toFixed(2);
      out.push({
        date: d.toISOString().slice(0, 10),
        open: +(close - 0.4).toFixed(2), high: +(close + 1.1).toFixed(2), low: +(close - 1.3).toFixed(2),
        close, adjusted_close: +(close * 0.995).toFixed(4), volume: 1_000_000 + i * 1000,
      });
      i++;
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

let vendor;      // { eod: { [sym]: rows|{status} }, rt: { [sym]: quote|{status} } }
let calls;       // every vendor URL, in order
function installVendor() {
  calls = [];
  globalThis.fetch = vi.fn(async (url) => {
    calls.push(String(url));
    const m = String(url).match(/\/api\/(eod|real-time)\/([^?]+)\?/);
    const [, kind, sym] = m;
    const entry = (kind === 'eod' ? vendor.eod : vendor.rt)[sym];
    if (entry === undefined || entry?.status) {
      return { ok: false, status: entry?.status || 404, json: async () => null };
    }
    return { ok: true, status: 200, json: async () => structuredClone(entry) };
  });
}
const eodCalls = () => calls.filter((u) => u.includes('/api/eod/'));

/** A fresh module = a fresh serverCache L1 (the Firestore fake persists). */
async function freshMdc() {
  vi.resetModules();
  return import('./marketDataCache.js');
}

const EVAL = { fields: ['daily', 'price'] };
const FORCED = { forceRefresh: true, ...EVAL };
const POLICY = { ...EVAL, dailyPolicy: 'session_current' };

beforeEach(() => {
  store.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  process.env.EODHD_API_KEY = 'test-key';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vendor = {
    eod: { 'AAPL.US': rawBars(PRIOR), 'BTC-USD.CC': rawBars(PRIOR, 62, 60000) },
    rt: {
      'AAPL.US': { code: 'AAPL.US', close: 104.2, previousClose: 100.0, change: 5.2, change_p: 5.25, high: 105, low: 98.7, volume: 5e6, timestamp: 1791385200 },
      'BTC-USD.CC': { code: 'BTC-USD.CC', close: 61000, previousClose: 60000, change: 900, change_p: 1.5, high: 61500, low: 59800, volume: 1e4, timestamp: 1791385200 },
    },
  };
  installVendor();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Seed the L2 doc exactly as setCachedData writes it, `ageMs` old. */
function seedDaily(clean, rows, ageMs = 60_000) {
  store.set(`marketDataCache/${clean}_daily`, {
    data: structuredClone(rows), cachedAt: new Date(Date.now() - ageMs), ttlType: 'daily',
    ttlMs: 4 * 3600_000, expiresAt: new Date(Date.now() - ageMs + 4 * 3600_000),
  });
}

/** Everything the evaluator reads from one call (agent-evaluate.js :1068-1076, :1137-1144). */
function evaluatorView(result, { isCrypto, previousClose }) {
  return {
    daily: result.daily,
    price: result.price,
    guard2: resolveBadgeBaseline({ daily: result.daily, previousClose, isCrypto, baseATR: isCrypto ? 5 : 2.5, etToday: '2026-10-07', utcToday: '2026-10-07' }),
  };
}

describe('QW-1 P1 — cache-served and fresh series give the evaluator identical inputs (same bars)', () => {
  for (const [label, sym, clean, isCrypto, previousClose] of [
    ['stock, Guard 2 accepts', 'AAPL', 'AAPL', false, undefined],
    ['stock, Guard 2 SUBSTITUTES (a wrong previousClose)', 'AAPL', 'AAPL', false, 93.5],
    ['crypto (UTC day)', 'BTC-USD.CC', 'BTC', true, undefined],
  ]) {
    it(label, async () => {
      // Path A — today's forced refresh. It writes the series through to L2.
      const a = await (await freshMdc()).getStockAnalysisData(sym, FORCED);
      expect(a.cacheStatus.daily).toBe('fresh');
      expect(store.has(`marketDataCache/${clean}_daily`)).toBe(true);
      const eodBefore = eodCalls().length;

      // Path B — the QW-1 policy on a fresh instance: served from L2, no /eod/.
      const b = await (await freshMdc()).getStockAnalysisData(sym, POLICY);
      expect(b.cacheStatus.daily).toBe('hit');
      expect(eodCalls().length).toBe(eodBefore);

      const pc = previousClose ?? a.price.previousClose;
      const va = evaluatorView(a, { isCrypto, previousClose: pc });
      const vb = evaluatorView(b, { isCrypto, previousClose: pc });
      expect(vb).toEqual(va);
      // The reference is the prior session's bar in both, and it is non-trivial.
      expect(va.guard2.value).toBeGreaterThan(0);
      if (previousClose === 93.5) expect(va.guard2.fired).toBe(true);
    });
  }
});

describe('QW-1 P2 — a cached series one session stale must re-fetch (red-then-green)', () => {
  it('TTL-fresh but newest bar = 2026-10-05 (one session stale) → one /eod/ re-fetch, the FRESH series is served and written through', async () => {
    seedDaily('AAPL', (await import('./marketDataCache.js')).mapDailyRows(rawBars('2026-10-05')).rows);
    const mdc = await freshMdc();
    const r = await mdc.getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
    expect(r.cacheStatus.daily).toBe('fresh');
    expect(r.daily[0].date).toBe(PRIOR);
    expect(store.get('marketDataCache/AAPL_daily').data[0].date).toBe(PRIOR);
  });
});

describe('QW-1 — every refusal re-fetches, and nothing refused is ever served', () => {
  it('a today-dated (partial) bar in the cache is refused', async () => {
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars('2026-10-07')).rows);
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
    expect(r.daily[0].date).toBe(PRIOR);
  });

  it('a TTL-stale doc (5 h old) is refused even when current', async () => {
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars(PRIOR)).rows, 5 * 3600_000);
    await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
  });

  it('a null calendar (outside MAINTAINED_HOLIDAY_YEARS) is refused, never guessed', async () => {
    vi.setSystemTime(new Date('2028-03-01T15:00:00.000Z')); // Wed 10:00 ET, 2028 not maintained
    vendor.eod['AAPL.US'] = rawBars('2028-02-29');
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars('2028-02-29')).rows);
    expect(mdc0.dailySeriesCurrency(mdc0.mapDailyRows(rawBars('2028-02-29')).rows, { isCrypto: false, etToday: '2028-03-01', utcToday: '2028-03-01' }).reason).toBe('calendar_missing');
    await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
  });

  it('outside the regular session the policy never reads the cache (forced-refresh equivalent)', async () => {
    vi.setSystemTime(new Date('2026-10-07T22:00:00.000Z')); // 18:00 ET — closed
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars(PRIOR)).rows);
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
    expect(r.cacheStatus.daily).toBe('fresh');
  });

  it('a refused series whose re-fetch FAILS is never served stale: no series, errors.daily set (the forced path\'s own end state)', async () => {
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars('2026-10-05')).rows);
    vendor.eod['AAPL.US'] = { status: 503 };
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(r.daily).toBeUndefined();
    expect(r.errors.daily).toMatch(/503/);
    expect(r.cacheStatus.daily).toBeUndefined();
    expect(r.staleFields).toEqual([]);
    // Same as today's forced refresh under the same vendor failure:
    const forced = await (await freshMdc()).getStockAnalysisData('AAPL', FORCED);
    expect({ daily: r.daily, price: r.price, errors: r.errors }).toEqual({ daily: forced.daily, price: forced.price, errors: forced.errors });
  });

  it('forceRefresh wins over dailyPolicy', async () => {
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars(PRIOR)).rows);
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', { ...POLICY, forceRefresh: true });
    expect(eodCalls()).toHaveLength(1);
    expect(r.cacheStatus.daily).toBe('fresh');
  });

  it('crypto: the previous UTC date is current; a current-UTC-day bar is refused', async () => {
    const mdc0 = await freshMdc();
    seedDaily('BTC', mdc0.mapDailyRows(rawBars(PRIOR, 62, 60000)).rows);
    const served = await (await freshMdc()).getStockAnalysisData('BTC-USD.CC', POLICY);
    expect(served.cacheStatus.daily).toBe('hit');
    expect(eodCalls()).toHaveLength(0);
    seedDaily('BTC', mdc0.mapDailyRows(rawBars('2026-10-07', 62, 60000)).rows);
    await (await freshMdc()).getStockAnalysisData('BTC-USD.CC', POLICY);
    expect(eodCalls()).toHaveLength(1);
  });
});

describe('QW-1 — a failed quote re-fetches the series before the fallback is built', () => {
  it('the fallback price equals the forced path\'s, built from the FRESH series even when the cached copy differs', async () => {
    vendor.rt['AAPL.US'] = { status: 500 };
    const forced = await (await freshMdc()).getStockAnalysisData('AAPL', FORCED);
    expect(forced.price).toEqual({ current: forced.daily[0].close, fallback: true });

    // The cached copy passes the currency rule but carries a revised close on
    // its newest bar (e.g. an ex-dividend re-adjustment the vendor applied
    // since). The fallback must NOT read it.
    const mdc0 = await freshMdc();
    const revised = mdc0.mapDailyRows(rawBars(PRIOR)).rows;
    revised[0] = { ...revised[0], close: revised[0].close - 7 };
    seedDaily('AAPL', revised);
    const before = eodCalls().length;
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls().length).toBe(before + 1);
    expect(r.cacheStatus.daily).toBe('fresh');
    expect({ daily: r.daily, price: r.price, errors: r.errors }).toEqual({ daily: forced.daily, price: forced.price, errors: forced.errors });
  });

  it('quote AND re-fetch both failing leaves no series and no price — the forced path\'s end state', async () => {
    vendor.rt['AAPL.US'] = { status: 500 };
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars(PRIOR)).rows);
    vendor.eod['AAPL.US'] = { status: 502 };
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    const forced = await (await freshMdc()).getStockAnalysisData('AAPL', FORCED);
    expect(r.price).toBeUndefined();
    expect({ daily: r.daily, price: r.price, errors: r.errors, status: r.cacheStatus.daily })
      .toEqual({ daily: forced.daily, price: forced.price, errors: forced.errors, status: forced.cacheStatus.daily });
  });

  it('a live quote never triggers the re-fetch (the cache saving holds)', async () => {
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars(PRIOR)).rows);
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(0);
    expect(r.price.fallback).toBeUndefined();
    expect(r.price.current).toBe(104.2);
  });
});

describe('QW-1 (review E1-1) — a served series must agree with the live quote, or it is re-fetched', () => {
  /** The cached copy is the vendor's series with the newest bar's raw close replaced. */
  async function seedWithNewestRawClose(rawClose) {
    const mdc0 = await freshMdc();
    const rows = mdc0.mapDailyRows(rawBars(PRIOR)).rows;
    rows[0] = { ...rows[0], rawClose };
    seedDaily('AAPL', rows);
  }
  const guard2 = (r) => resolveBadgeBaseline({ daily: r.daily, previousClose: r.price.previousClose, isCrypto: false, baseATR: 2.5, etToday: '2026-10-07', utcToday: '2026-10-07' });

  it('R1 — a vendor CORRECTION after the write (cached 100, vendor and quote now 103): re-fetched, Guard 2 identical to the forced path', async () => {
    await seedWithNewestRawClose(100);
    const corrected = rawBars(PRIOR);
    corrected[0] = { ...corrected[0], close: 103 };
    vendor.eod['AAPL.US'] = corrected;
    vendor.rt['AAPL.US'] = { ...vendor.rt['AAPL.US'], previousClose: 103 };
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
    expect(r.cacheStatus.daily).toBe('fresh');
    const forced = await (await freshMdc()).getStockAnalysisData('AAPL', FORCED);
    expect(guard2(r)).toEqual(guard2(forced));
    expect(guard2(r)).toEqual(expect.objectContaining({ value: 103, fired: false }));
    expect({ daily: r.daily, price: r.price }).toEqual({ daily: forced.daily, price: forced.price });
  });

  it('R2 — a GLITCHED read some other writer stored (cached 96, true 100): re-fetched, so Guard 2 never substitutes the glitch', async () => {
    await seedWithNewestRawClose(96);
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
    expect(r.daily[0].rawClose).toBe(100);
    expect(guard2(r)).toEqual(expect.objectContaining({ value: 100, fired: false }));
  });

  it('a cached bar with NO raw close is never served (Guard 2 would fall to the adjusted close)', async () => {
    await seedWithNewestRawClose(null);
    await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
  });

  it('a quote with no previousClose cannot vouch: re-fetched, and the live price is kept', async () => {
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars(PRIOR)).rows);
    vendor.rt['AAPL.US'] = { ...vendor.rt['AAPL.US'], previousClose: null };
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
    expect(r.price.current).toBe(104.2);
    expect(r.price.fallback).toBeUndefined();
  });

  it('a mismatch whose re-fetch FAILS leaves no series and the live price — the forced path\'s end state', async () => {
    await seedWithNewestRawClose(96);
    vendor.eod['AAPL.US'] = { status: 503 };
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    const forced = await (await freshMdc()).getStockAnalysisData('AAPL', FORCED);
    expect({ daily: r.daily, price: r.price, errors: r.errors, status: r.cacheStatus.daily })
      .toEqual({ daily: forced.daily, price: forced.price, errors: forced.errors, status: forced.cacheStatus.daily });
  });

  it('agreement is EXACT, so a served series can never make Guard 2 fire whatever the baseATR', async () => {
    const { PRIOR_CLOSE_AGREEMENT_TOLERANCE } = await freshMdc();
    expect(PRIOR_CLOSE_AGREEMENT_TOLERANCE).toBe(0);
    // Even at a pathological baseATR (agent-evaluate derives some from atrPercentile × 8):
    const g2 = resolveBadgeBaseline({ daily: [{ date: PRIOR, rawClose: 100, close: 100 }], previousClose: 100, isCrypto: false, baseATR: 0.0001, etToday: '2026-10-07', utcToday: '2026-10-07' });
    expect(g2.fired).toBe(false);
  });

  it('an exact match is served; a rounding-only difference is re-fetched (cost, never a different number)', async () => {
    await seedWithNewestRawClose(100);
    const served = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(0);
    expect(served.cacheStatus.daily).toBe('hit');
    await seedWithNewestRawClose(100.004);
    const refetched = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(eodCalls()).toHaveLength(1);
    expect(refetched.cacheStatus.daily).toBe('fresh');
  });
});

describe('QW-1 (review E1-2) — no refusal reason ever falls back to the refused copy', () => {
  it('a TTL-stale CURRENT doc + a vendor 503 → no series, nothing stale', async () => {
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars(PRIOR)).rows, 5 * 3600_000);
    vendor.eod['AAPL.US'] = { status: 503 };
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(r.daily).toBeUndefined();
    expect(r.staleFields).toEqual([]);
    expect(r.cacheStatus.daily).toBeUndefined();
  });

  it('a today-dated (partial) doc + a vendor 503 → no series, nothing stale', async () => {
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars('2026-10-07')).rows);
    vendor.eod['AAPL.US'] = { status: 503 };
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(r.daily).toBeUndefined();
    expect(r.staleFields).toEqual([]);
  });

  it('a closed session + a vendor 503 → no series, nothing stale (the cache is not even read)', async () => {
    vi.setSystemTime(new Date('2026-10-07T22:00:00.000Z'));
    const mdc0 = await freshMdc();
    seedDaily('AAPL', mdc0.mapDailyRows(rawBars(PRIOR)).rows, 60 * 60_000);
    vendor.eod['AAPL.US'] = { status: 503 };
    const r = await (await freshMdc()).getStockAnalysisData('AAPL', POLICY);
    expect(r.daily).toBeUndefined();
    expect(r.staleFields).toEqual([]);
  });
});

describe('QW-1 — the pure rule', () => {
  it('previousUtcDate crosses months and years and refuses junk', async () => {
    const { previousUtcDate } = await freshMdc();
    expect(previousUtcDate('2026-10-07')).toBe('2026-10-06');
    expect(previousUtcDate('2026-03-01')).toBe('2026-02-28');
    expect(previousUtcDate('2027-01-01')).toBe('2026-12-31');
    expect(previousUtcDate('nope')).toBeNull();
  });

  it('dailySeriesCurrency names every outcome, against the calendar of record', async () => {
    const { dailySeriesCurrency } = await freshMdc();
    const ctx = { isCrypto: false, etToday: '2026-10-07', utcToday: '2026-10-07' };
    expect(dailySeriesCurrency([{ date: '2026-10-06' }], ctx)).toEqual({ current: true, newest: '2026-10-06', expected: '2026-10-06', reason: null });
    expect(dailySeriesCurrency([{ date: '2026-10-05' }], ctx).reason).toBe('stale_session');
    expect(dailySeriesCurrency([{ date: '2026-10-07' }], ctx).reason).toBe('current_day_bar');
    expect(dailySeriesCurrency([], ctx).reason).toBe('empty');
    // Monday after a weekend: the prior session is Friday.
    expect(dailySeriesCurrency([{ date: '2026-10-09' }], { ...ctx, etToday: '2026-10-12' }).current).toBe(true);
    // The day after Thanksgiving 2026 (Thu 11-26 is a NYSE holiday): prior session is Wed 11-25.
    expect(dailySeriesCurrency([{ date: '2026-11-25' }], { ...ctx, etToday: '2026-11-27' }).current).toBe(true);
    // Crypto reads the UTC calendar: Sunday's prior day is Saturday.
    expect(dailySeriesCurrency([{ date: '2026-10-10' }], { isCrypto: true, etToday: '2026-10-11', utcToday: '2026-10-11' }).current).toBe(true);
  });
});
