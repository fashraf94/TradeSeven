// api/_utils/fetchEarningsCalendarEODHD.test.js
//
// Unit tests for the EODHD-backed earnings calendar fetcher used by the
// daily regime brief cron. Tests stub global.fetch — no real EODHD
// calls. System time is pinned to a known Wednesday (2026-05-13 14:00 UTC,
// i.e. 10:00 AM ET) so the Mon-Sun partitioning is deterministic.
//
// Mirrors the pattern in api/_utils/marketDataCache.test.js (vitest +
// vi.stubGlobal for fetch, beforeEach/afterEach env key save/restore).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchEarningsCalendarEODHD } from './fetchEarningsCalendarEODHD.js';

const ORIGINAL_API_KEY = process.env.EODHD_API_KEY;

function stubFetchOk(payload) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => payload })),
  );
}

function stubFetchHttpError(status) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status, json: async () => ({}) })),
  );
}

function stubFetchThrows() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('network down');
    }),
  );
}

beforeEach(() => {
  process.env.EODHD_API_KEY = 'test-token';
  vi.useFakeTimers();
  // 2026-05-13 14:00 UTC → 10:00 AM ET (EDT, UTC-4) → todayET = '2026-05-13' (Wed).
  vi.setSystemTime(new Date('2026-05-13T14:00:00Z'));
  // Silence the observability console.log calls during tests; they're
  // verified separately rather than littering test output.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.EODHD_API_KEY;
  } else {
    process.env.EODHD_API_KEY = ORIGINAL_API_KEY;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('fetchEarningsCalendarEODHD', () => {
  it('normalizes a mega-cap row into the downstream item shape', async () => {
    stubFetchOk({
      earnings: [
        {
          code: 'CSCO.US',
          name: 'Cisco Systems',
          report_date: '2026-05-13',
          before_after_market: 'AfterMarket',
          market_cap: 200e9,
        },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toHaveLength(1);
    expect(result.thisWeek[0]).toEqual({
      date: '2026-05-13',
      day: 'Wednesday',
      timing: 'AMC',
      symbol: 'CSCO',
      name: 'Cisco Systems',
      significance: 'high',
    });
    expect(result.nextWeek).toHaveLength(0);
    expect(result.spotlight).toBeNull();
    expect(result.citations).toEqual([]);
  });

  it('returned shape matches the Sonar fetcher contract', async () => {
    stubFetchOk({ earnings: [] });
    const result = await fetchEarningsCalendarEODHD();
    expect(result).toHaveProperty('thisWeek');
    expect(result).toHaveProperty('nextWeek');
    expect(result).toHaveProperty('spotlight');
    expect(result).toHaveProperty('cachedAt');
    expect(result).toHaveProperty('citations');
    expect(Array.isArray(result.thisWeek)).toBe(true);
    expect(Array.isArray(result.nextWeek)).toBe(true);
    expect(typeof result.cachedAt).toBe('number');
    expect(Array.isArray(result.citations)).toBe(true);
  });

  it('drops items with numeric market_cap at or below 25e9', async () => {
    stubFetchOk({
      earnings: [
        {
          code: 'XYZ.US',
          name: 'XYZ Co',
          report_date: '2026-05-14',
          before_after_market: 'BeforeMarket',
          market_cap: 10e9,
        },
        {
          code: 'EDGE.US',
          name: 'EdgeCase Inc',
          report_date: '2026-05-14',
          before_after_market: 'BeforeMarket',
          market_cap: 25e9,
        },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toHaveLength(0);
    expect(result.nextWeek).toHaveLength(0);
  });

  it('logs `below_threshold` when a numeric cap fails the gate', async () => {
    const logSpy = vi.spyOn(console, 'log');
    stubFetchOk({
      earnings: [
        {
          code: 'XYZ.US',
          name: 'XYZ Co',
          report_date: '2026-05-14',
          before_after_market: 'BeforeMarket',
          market_cap: 5e9,
        },
      ],
    });
    await fetchEarningsCalendarEODHD();
    const dropLog = logSpy.mock.calls.find((args) =>
      args[0]?.includes?.('below_threshold'),
    );
    expect(dropLog).toBeTruthy();
    expect(dropLog[0]).toContain('symbol=XYZ');
    expect(dropLog[0]).toContain('report_date=2026-05-14');
    expect(dropLog[0]).toContain('market_cap=5000000000');
  });

  it('backstop catches null market_cap when symbol is in PRIORITY_STOCKS', async () => {
    stubFetchOk({
      earnings: [
        {
          code: 'NVDA.US',
          name: 'Nvidia',
          report_date: '2026-05-14',
          before_after_market: 'AfterMarket',
          market_cap: null,
        },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toHaveLength(1);
    expect(result.thisWeek[0].symbol).toBe('NVDA');
  });

  it('logs `null_market_cap_backstop` when the backstop fires', async () => {
    const logSpy = vi.spyOn(console, 'log');
    stubFetchOk({
      earnings: [
        {
          code: 'NVDA.US',
          name: 'Nvidia',
          report_date: '2026-05-14',
          before_after_market: 'AfterMarket',
          market_cap: null,
        },
      ],
    });
    await fetchEarningsCalendarEODHD();
    const backstopLog = logSpy.mock.calls.find((args) =>
      args[0]?.includes?.('null_market_cap_backstop'),
    );
    expect(backstopLog).toBeTruthy();
    expect(backstopLog[0]).toContain('symbol=NVDA');
    expect(backstopLog[0]).toContain('report_date=2026-05-14');
  });

  it('drops items with null market_cap when symbol is NOT in PRIORITY_STOCKS', async () => {
    stubFetchOk({
      earnings: [
        {
          code: 'OBSCURE.US',
          name: 'Obscure Inc',
          report_date: '2026-05-14',
          before_after_market: 'BeforeMarket',
          market_cap: null,
        },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toHaveLength(0);
  });

  it('partitions events into thisWeek and nextWeek by Mon-Sun calendar week', async () => {
    // todayET = 2026-05-13 (Wed). thisWeek window: 2026-05-11..05-17.
    // nextWeek window: 2026-05-18..05-24. Past-week rows must drop.
    stubFetchOk({
      earnings: [
        { code: 'AAPL.US', name: 'Apple', report_date: '2026-05-13', before_after_market: 'AfterMarket', market_cap: 3.5e12 },
        { code: 'MSFT.US', name: 'Microsoft', report_date: '2026-05-15', before_after_market: 'AfterMarket', market_cap: 3.5e12 },
        { code: 'NVDA.US', name: 'Nvidia', report_date: '2026-05-21', before_after_market: 'AfterMarket', market_cap: 2.5e12 },
        { code: 'TSLA.US', name: 'Tesla', report_date: '2026-05-12', before_after_market: 'AfterMarket', market_cap: 1e12 },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek.map((e) => e.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(result.nextWeek.map((e) => e.symbol)).toEqual(['NVDA']);
  });

  it('translates BeforeMarket → BMO and AfterMarket → AMC', async () => {
    stubFetchOk({
      earnings: [
        { code: 'AAPL.US', name: 'Apple', report_date: '2026-05-13', before_after_market: 'BeforeMarket', market_cap: 3.5e12 },
        { code: 'MSFT.US', name: 'Microsoft', report_date: '2026-05-14', before_after_market: 'AfterMarket', market_cap: 3.5e12 },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek[0].timing).toBe('BMO');
    expect(result.thisWeek[1].timing).toBe('AMC');
  });

  it('leaves timing empty when before_after_market is missing or unknown', async () => {
    stubFetchOk({
      earnings: [
        { code: 'AAPL.US', name: 'Apple', report_date: '2026-05-13', before_after_market: 'Unknown', market_cap: 3.5e12 },
        { code: 'MSFT.US', name: 'Microsoft', report_date: '2026-05-14', before_after_market: null, market_cap: 3.5e12 },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek[0].timing).toBe('');
    expect(result.thisWeek[1].timing).toBe('');
  });

  it('rejects weekend report_dates', async () => {
    // 2026-05-16 = Sat, 2026-05-17 = Sun.
    stubFetchOk({
      earnings: [
        { code: 'AAPL.US', name: 'Apple', report_date: '2026-05-16', before_after_market: 'AfterMarket', market_cap: 3.5e12 },
        { code: 'MSFT.US', name: 'Microsoft', report_date: '2026-05-17', before_after_market: 'AfterMarket', market_cap: 3.5e12 },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toHaveLength(0);
    expect(result.nextWeek).toHaveLength(0);
  });

  it('drops non-US listings', async () => {
    stubFetchOk({
      earnings: [
        { code: 'BAJAJ.NSE', name: 'Bajaj', report_date: '2026-05-13', before_after_market: 'AfterMarket', market_cap: 50e9 },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toHaveLength(0);
  });

  it('drops thisWeek items dated strictly before todayET', async () => {
    // 2026-05-11 (Mon) and 2026-05-12 (Tue) are in this calendar week
    // but before today (Wed 2026-05-13).
    stubFetchOk({
      earnings: [
        { code: 'AAPL.US', name: 'Apple', report_date: '2026-05-11', before_after_market: 'AfterMarket', market_cap: 3.5e12 },
        { code: 'MSFT.US', name: 'Microsoft', report_date: '2026-05-12', before_after_market: 'AfterMarket', market_cap: 3.5e12 },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toHaveLength(0);
  });

  it('keeps a today-dated report in thisWeek', async () => {
    stubFetchOk({
      earnings: [
        { code: 'AAPL.US', name: 'Apple', report_date: '2026-05-13', before_after_market: 'AfterMarket', market_cap: 3.5e12 },
      ],
    });
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toHaveLength(1);
    expect(result.thisWeek[0].date).toBe('2026-05-13');
  });

  it('returns the empty fallback on HTTP error', async () => {
    stubFetchHttpError(500);
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toEqual([]);
    expect(result.nextWeek).toEqual([]);
    expect(result.spotlight).toBe('Earnings calendar temporarily unavailable');
  });

  it('returns the empty fallback when fetch throws', async () => {
    stubFetchThrows();
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toEqual([]);
    expect(result.nextWeek).toEqual([]);
    expect(result.spotlight).toBe('Earnings calendar temporarily unavailable');
  });

  it('returns the empty fallback when EODHD response has no earnings array', async () => {
    stubFetchOk({});
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toEqual([]);
    expect(result.nextWeek).toEqual([]);
    expect(result.spotlight).toBe('Earnings calendar temporarily unavailable');
  });

  it('returns the empty fallback when EODHD_API_KEY is missing', async () => {
    delete process.env.EODHD_API_KEY;
    const result = await fetchEarningsCalendarEODHD();
    expect(result.thisWeek).toEqual([]);
    expect(result.nextWeek).toEqual([]);
    expect(result.spotlight).toBe('Earnings calendar temporarily unavailable');
  });

  it('calls EODHD with a Mon-of-thisWeek to Sun-of-nextWeek window', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ earnings: [] }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    await fetchEarningsCalendarEODHD();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain('from=2026-05-11');
    expect(url).toContain('to=2026-05-24');
    expect(url).toContain('fmt=json');
    expect(url).toContain('api_token=test-token');
  });
});
