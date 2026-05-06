// api/_utils/marketDataCache.test.js
// Unit tests for fetchIntradayCandles — added as part of the EODHD intraday
// fix. The function shipped 22 days ago without tests, which is part of why
// a 200-OK-with-empty-body went unnoticed for so long. These tests guard:
//   - The URL shape (default omits from/to; hoursBack opts in to a window)
//   - The empty-array and non-array warning paths (visibility for future bugs)
//   - The HTTP-error throw path
//
// Tests do not make real EODHD calls — global.fetch is stubbed per test.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchIntradayCandles } from './marketDataCache.js';

const ORIGINAL_API_KEY = process.env.EODHD_API_KEY;

beforeEach(() => {
  process.env.EODHD_API_KEY = 'test-token';
});

afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.EODHD_API_KEY;
  } else {
    process.env.EODHD_API_KEY = ORIGINAL_API_KEY;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetchOk(jsonBody) {
  const fetchSpy = vi.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(jsonBody),
  }));
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

function mockFetchError(status) {
  const fetchSpy = vi.fn(() => Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(null),
  }));
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

describe('fetchIntradayCandles', () => {
  it('Test 1 — happy path: returns parsed candles in passthrough shape', async () => {
    const synthetic = [
      { datetime: '2026-05-05 14:00:00', open: 100, high: 101, low: 99.5, close: 100.5, volume: 12000 },
      { datetime: '2026-05-05 14:05:00', open: 100.5, high: 102, low: 100.2, close: 101.8, volume: 15000 },
      { datetime: '2026-05-05 14:10:00', open: 101.8, high: 102.5, low: 101.3, close: 101.9, volume: 9000 },
    ];
    mockFetchOk(synthetic);

    const candles = await fetchIntradayCandles('MU');

    expect(candles).toHaveLength(3);
    expect(candles[0]).toEqual({
      datetime: '2026-05-05 14:00:00',
      open: 100,
      high: 101,
      low: 99.5,
      close: 100.5,
      volume: 12000,
    });
    expect(candles[2].close).toBe(101.9);
    expect(candles[2].volume).toBe(9000);
  });

  it('Test 2 — default URL omits from/to (regression guard for fix)', async () => {
    const fetchSpy = mockFetchOk([
      { datetime: '2026-05-05 14:00:00', open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ]);

    await fetchIntradayCandles('MU', { interval: '5m' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0];

    expect(url).toContain('/api/intraday/MU.US');
    expect(url).toContain('api_token=test-token');
    expect(url).toContain('fmt=json');
    expect(url).toContain('interval=5m');
    // The whole point of the fix: no NOW-relative window by default.
    expect(url).not.toContain('from=');
    expect(url).not.toContain('to=');
  });

  it('Test 3 — explicit hoursBack adds from/to to the URL', async () => {
    const fetchSpy = mockFetchOk([
      { datetime: '2026-05-05 14:00:00', open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ]);

    const before = Math.floor(Date.now() / 1000);
    await fetchIntradayCandles('MU', { interval: '5m', hoursBack: 24 });
    const after = Math.floor(Date.now() / 1000);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0];

    expect(url).toContain('from=');
    expect(url).toContain('to=');

    const fromMatch = url.match(/[?&]from=(\d+)/);
    const toMatch = url.match(/[?&]to=(\d+)/);
    expect(fromMatch).not.toBeNull();
    expect(toMatch).not.toBeNull();

    const fromTs = Number(fromMatch[1]);
    const toTs = Number(toMatch[1]);
    // hoursBack=24 means from = to - 86400. Allow a 2s slop around the
    // captured before/after window to absorb test execution time.
    expect(toTs).toBeGreaterThanOrEqual(before);
    expect(toTs).toBeLessThanOrEqual(after);
    expect(toTs - fromTs).toBe(24 * 60 * 60);
  });

  it('Test 4 — empty-array response logs a warning and returns []', async () => {
    mockFetchOk([]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const candles = await fetchIntradayCandles('MU');

    expect(candles).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0];
    expect(msg).toContain('empty');
    expect(msg).toContain('MU');
  });

  it('Test 5 — non-array response logs a warning and returns []', async () => {
    mockFetchOk({});  // EODHD returns an object instead of an array
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const candles = await fetchIntradayCandles('MU');

    expect(candles).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0];
    expect(msg).toContain('not an array');
    expect(msg).toContain('MU');
  });

  it('Test 6 — non-OK HTTP response throws an error containing the status code', async () => {
    mockFetchError(500);

    await expect(fetchIntradayCandles('MU')).rejects.toThrow(/500/);
  });
});
