// api/_utils/marketDataCache.realTimePrice.test.js
//
// The real-time price contract (docs/audits/20261014_BUILD_NA_QUOTE_INVALID_PRICE.md):
// on an HTTP 200, the selected price (`close || previousClose || 0`, order
// unchanged) becomes `price.current` only when it is a finite, strictly
// positive number or a complete decimal numeric string (converted). Anything
// else leaves `price` ABSENT, records `errors.price`, and logs a sanitized line.
// It never substitutes a daily close. A non-200 response keeps the existing
// fallback (latest daily close, `fallback: true`), unchanged.
//
// Runs the REAL getStockAnalysisData; only the network (global fetch) and the
// cache's Firestore are doubles.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', async () => {
  const { cacheDbDouble } = await import('./__fixtures__/eodhdQuoteFixtures.js');
  return { getFirestore: () => cacheDbDouble() };
});

const { getStockAnalysisData, toUsableQuotePrice } = await import('./marketDataCache.js');
const { REAL_TIME, DAILY, rawJson, stubEodhdFetch } = await import('./__fixtures__/eodhdQuoteFixtures.js');

const KEY = 'test-eodhd-key-do-not-log';
const BOTH = { forceRefresh: true, fields: ['daily', 'price'] };
const PRICE_ONLY = { forceRefresh: true, fields: ['price'] };

let savedKey;
let warn;
let error;
beforeEach(() => {
  savedKey = process.env.EODHD_API_KEY;
  process.env.EODHD_API_KEY = KEY;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = savedKey;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** One symbol's real-time body (and optional daily rows) → the producer's result. */
async function produce(body, { symbol = 'EQR', daily = DAILY.EQR, opts = BOTH } = {}) {
  const eod = `${symbol}.US`;
  stubEodhdFetch(vi, { realTime: { [eod]: body }, eod: daily === null ? {} : { [eod]: daily } });
  return getStockAnalysisData(symbol, opts);
}

describe('toUsableQuotePrice — the acceptance rule', () => {
  it('accepts finite, strictly positive numbers unchanged', () => {
    for (const v of [482.65, 0.0001, 63, 1e6]) expect(toUsableQuotePrice(v)).toBe(v);
  });

  it('accepts complete decimal numeric strings, converted to numbers', () => {
    expect(toUsableQuotePrice('63.66')).toBe(63.66);
    expect(toUsableQuotePrice('63')).toBe(63);
    expect(toUsableQuotePrice('0.5')).toBe(0.5);
    expect(toUsableQuotePrice('007.50')).toBe(7.5);
  });

  it('rejects "NA", malformed and partial strings, and numeric strings that are not positive', () => {
    for (const v of ['NA', '63.66junk', ' 63.66', '63.66 ', '63.', '.5', '1e3', '-5', '+5', '', '0', '0.00', 'Infinity', 'NaN', '9'.repeat(400)]) {
      expect(toUsableQuotePrice(v), JSON.stringify(v).slice(0, 24)).toBeNull();
    }
  });

  it('rejects zero, negatives, non-finite numbers, booleans, arrays, objects and nullish', () => {
    for (const v of [0, -0, -1, NaN, Infinity, -Infinity, true, false, [], [63.66], {}, { current: 1 }, null, undefined]) {
      expect(toUsableQuotePrice(v), String(v)).toBeNull();
    }
  });
});

describe('getStockAnalysisData — a 200 with a usable price keeps today\'s payload', () => {
  it('a numeric quote maps exactly as before', async () => {
    for (const opts of [BOTH, PRICE_ONLY]) {
      const r = await produce(REAL_TIME.MPC_LIVE, { symbol: 'MPC', opts });
      expect(r.price).toEqual({
        current: 482.65, previousClose: 476.98, change: 5.67, changePercent: 1.1887,
        high: 482.65, low: 480, volume: 1129234, timestamp: 1792006920,
      });
      expect(r.errors.price).toBeUndefined();
    }
  });

  it('an absent, null or zero close still selects a valid numeric previousClose', async () => {
    for (const body of [{ previousClose: 50 }, { close: null, previousClose: 50 }, { close: 0, previousClose: 50 }]) {
      const r = await produce(body);
      // BaggerBomb v2 Ruling 9: the selection is unchanged (current 50); the
      // additive previousCloseStandIn marks it, so only corrected stock
      // valuation can refuse it.
      expect(r.price).toEqual({
        current: 50, previousClose: 50, change: 0, changePercent: 0,
        high: undefined, low: undefined, volume: undefined, timestamp: undefined,
        previousCloseStandIn: true,
      });
      expect(r.errors.price).toBeUndefined();
    }
  });

  it('BaggerBomb v2 Ruling 9: a real close carries no stand-in marker', async () => {
    const r = await produce(REAL_TIME.MPC_LIVE, { symbol: 'MPC' });
    expect(Object.hasOwn(r.price, 'previousCloseStandIn')).toBe(false);
  });

  it('a complete decimal string close becomes a number; the other fields are as before', async () => {
    const r = await produce({ ...REAL_TIME.MPC_LIVE, close: '482.65' }, { symbol: 'MPC' });
    expect(r.price.current).toBe(482.65);
    expect(typeof r.price.current).toBe('number');
    expect(r.price.previousClose).toBe(476.98);
    expect(r.errors.price).toBeUndefined();
  });
});

describe('getStockAnalysisData — a 200 with an unusable price sets NO price', () => {
  it('EQR\'s real all-"NA" body, with daily bars: no price, no daily-close substitute, errors.price set', async () => {
    const r = await produce(REAL_TIME.EQR_ALL_NA);
    expect(r.daily.length).toBeGreaterThan(0); // a daily close WAS available to substitute
    expect(r.price).toBeUndefined();
    expect(r.errors.price).toMatch(/not a positive number/);
  });

  it('the all-"NA" body without daily bars, and with price requested alone: no price', async () => {
    expect((await produce(REAL_TIME.EQR_ALL_NA, { daily: [] })).price).toBeUndefined();
    expect((await produce(REAL_TIME.EQR_ALL_NA, { daily: null })).price).toBeUndefined();
    expect((await produce(REAL_TIME.EQR_ALL_NA, { opts: PRICE_ONLY })).price).toBeUndefined();
  });

  it('close "NA" beside a numeric previousClose stays unavailable (the selection picks "NA")', async () => {
    expect((await produce({ close: 'NA', previousClose: 50 })).price).toBeUndefined();
    const wbd = await produce(REAL_TIME.WBD_MIXED, { symbol: 'WBD', daily: [] });
    expect(wbd.price).toBeUndefined();
    expect(wbd.errors.price).toMatch(/not a positive number/);
  });

  it('malformed, non-positive, non-finite and non-number selections: no price', async () => {
    const bodies = [
      { close: '63.66junk' },
      { close: ' 63.66' },
      { close: -5, previousClose: 50 },
      { close: '-5' },
      { close: true, previousClose: 50 },
      { close: [63.66] },
      { close: { value: 63.66 } },
      rawJson('{"close":1e400}'),
      { close: '', previousClose: '' }, // selects 0
      { close: 0, previousClose: 0 },
      {},
    ];
    for (const body of bodies) {
      const r = await produce(body);
      expect(r.price, JSON.stringify(body)).toBeUndefined();
      expect(r.errors.price, JSON.stringify(body)).toBeDefined();
    }
  });

  it('logs a sanitized, bounded line: the symbol and the value kind, never the key or the URL', async () => {
    await produce(REAL_TIME.EQR_ALL_NA);
    await produce({ close: 'x'.repeat(500) });
    const lines = warn.mock.calls.map((args) => args.map(String).join(' ')).filter((l) => l.includes('Real-time price unavailable'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('EQR.US');
    expect(lines[0]).toContain('string "NA"');
    for (const line of lines) {
      expect(line.length).toBeLessThan(160);
      expect(line).not.toContain(KEY);
      expect(line).not.toContain('api_token');
    }
    const everyLogged = [...warn.mock.calls, ...error.mock.calls].flat().map(String).join('\n');
    expect(everyLogged).not.toContain(KEY);
  });
});

describe('getStockAnalysisData — a non-200 keeps the existing fallback (unchanged in this fix)', () => {
  it('a failed request with daily bars falls back to the newest ADJUSTED daily close, marked fallback', async () => {
    // Pinned as-is on purpose: AVB's adjusted 65.90 against its raw 184.0601 is
    // the separately tracked risk (report §6); this fix does not touch it.
    const r = await produce(500, { symbol: 'AVB', daily: DAILY.AVB });
    expect(r.price).toEqual({ current: 65.9, fallback: true });
    expect(r.errors.price).toMatch(/responded with 500/);
  });

  it('a failed request without daily bars leaves no price', async () => {
    const r = await produce(503, { daily: [] });
    expect(r.price).toBeUndefined();
    expect(r.errors.price).toMatch(/responded with 503/);
  });
});
