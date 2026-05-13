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
import { fetchIntradayCandles, filterToLatestSession } from './marketDataCache.js';
import { calculateVWAP } from './technicalCalculations.js';

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

  it('Test 7 — drops the in-progress trailing candle when close is null (May 7 market-open failure mode)', async () => {
    const synthetic = [
      { datetime: '2026-05-07 13:20:00', open: 100, high: 101, low: 99.5, close: 100.5, volume: 12000 },
      { datetime: '2026-05-07 13:25:00', open: 100.5, high: 102, low: 100.2, close: 101.8, volume: 15000 },
      // The forming 9:30 ET / 13:30 UTC bar — EODHD returns close=null
      { datetime: '2026-05-07 13:30:00', open: 101.8, high: 101.9, low: 101.5, close: null, volume: 0 },
    ];
    mockFetchOk(synthetic);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const candles = await fetchIntradayCandles('MU');

    expect(candles).toHaveLength(2);
    expect(candles[1].close).toBe(101.8);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0];
    expect(msg).toContain('partial candle');
    expect(msg).toContain('MU');
    expect(msg).toContain('1');
  });

  it('Test 8 — drops multiple partial candles with mixed null OHLC fields', async () => {
    const synthetic = [
      { datetime: '2026-05-07 13:20:00', open: 100, high: 101, low: 99.5, close: 100.5, volume: 12000 },
      { datetime: '2026-05-07 13:25:00', open: null, high: 102, low: 100.2, close: 101.8, volume: 15000 }, // null open
      { datetime: '2026-05-07 13:30:00', open: 101.8, high: 102.5, low: 101.3, close: 101.9, volume: 9000 },
      { datetime: '2026-05-07 13:35:00', open: 101.9, high: undefined, low: 101.5, close: 102.0, volume: 8000 }, // undefined high
      { datetime: '2026-05-07 13:40:00', open: 102.0, high: 102.5, low: 101.8, close: 102.3, volume: 11000 },
    ];
    mockFetchOk(synthetic);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const candles = await fetchIntradayCandles('MU');

    expect(candles).toHaveLength(3);
    expect(candles.map(c => c.close)).toEqual([100.5, 101.9, 102.3]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0];
    expect(msg).toContain('Dropped 2 partial candle');
    expect(msg).toContain('MU');
  });
});

// ==================== filterToLatestSession — RTH session boundary ====================
//
// The helper restores session VWAP semantics by filtering EODHD's multi-day
// intraday response down to candles from the latest available RTH session in ET.
// Fix v2: anchors on the latest ET date IN THE DATA (not today's ET date) so
// it handles EODHD's ~1-trading-day lag without producing intraday: null.
// Critical edge cases covered: pre-9:30 ET, weekends, holidays, DST
// transitions, early-close days, future-timestamp safety guard.
//
// All `now` values are constructed via Date.UTC so the tests are independent
// of the host system's timezone.

// Helper: build a UTC Date equivalent to a wall-clock ET datetime.
// Accepts the ET offset directly because Intl-based conversion is what we're
// validating; using it on both sides would be circular.
function utcFromEt(year, month, day, hourEt, minuteEt, etOffsetHours) {
  // ET wall-clock → UTC: ET = UTC - offset, so UTC = ET + offset.
  return new Date(Date.UTC(year, month - 1, day, hourEt + etOffsetHours, minuteEt, 0));
}

// Synthetic candle factory. `datetime` is the EODHD bare format (UTC).
function makeCandle(dateUtcString, opts = {}) {
  return {
    datetime: dateUtcString,
    open: opts.open ?? 100,
    high: opts.high ?? 101,
    low: opts.low ?? 99,
    close: opts.close ?? 100.5,
    volume: opts.volume ?? 10000,
  };
}

describe('filterToLatestSession — anchors on latest ET date in candles', () => {
  // Fix v2 semantics: the filter anchors on the latest ET date present in the
  // input candles, NOT on today's ET date. This fixes the production failure
  // where EODHD's ~1-trading-day lag caused Fix v1 to reject all candles.
  // `now` is retained in the signature but currently unused — date selection
  // is driven entirely by the data.

  it('returns latest-session candles even when called before 9:30 AM ET (overnight / pre-open)', () => {
    // Pre-open shouldn't matter: if EODHD only has yesterday's data, that's
    // the latest session we can render.
    const now = utcFromEt(2026, 5, 12, 8, 0, 4);
    const candles = [
      makeCandle('2026-05-11 13:30:00'),  // Yesterday 9:30 ET
      makeCandle('2026-05-11 19:55:00'),  // Yesterday 15:55 ET
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out).toHaveLength(2);
    expect(sessionDate).toBe('2026-05-11');
  });

  it('returns only the latest ET date when candles span multiple sessions', () => {
    // 2026-05-12 (Tuesday, DST). 12:00 PM ET = 16:00 UTC. Open is 13:30 UTC, close 20:00 UTC.
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const candles = [
      makeCandle('2026-05-11 14:00:00'),  // Yesterday — drop (older date)
      makeCandle('2026-05-12 12:00:00'),  // Pre-market — drop (before 9:30 ET on latest date)
      makeCandle('2026-05-12 13:30:00'),  // 9:30 ET — first session candle, keep
      makeCandle('2026-05-12 13:35:00'),  // 9:35 ET — keep
      makeCandle('2026-05-12 15:55:00'),  // 11:55 ET — keep
      makeCandle('2026-05-12 16:00:00'),  // 12:00 ET — keep
      makeCandle('2026-05-12 17:00:00'),  // 13:00 ET — keep (within RTH; no now-based cap)
      makeCandle('2026-05-12 20:00:00'),  // 16:00 ET (close) — keep (boundary inclusive)
      makeCandle('2026-05-12 20:05:00'),  // 16:05 ET — drop (after close)
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(sessionDate).toBe('2026-05-12');
    expect(out.map(c => c.datetime)).toEqual([
      '2026-05-12 13:30:00',
      '2026-05-12 13:35:00',
      '2026-05-12 15:55:00',
      '2026-05-12 16:00:00',
      '2026-05-12 17:00:00',
      '2026-05-12 20:00:00',
    ]);
  });

  it('excludes candles from earlier dates even when within RTH window', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const candles = [
      makeCandle('2026-05-11 13:30:00'),  // Yesterday 9:30 ET — drop
      makeCandle('2026-05-11 15:00:00'),  // Yesterday 11:00 ET — drop
      makeCandle('2026-05-11 19:55:00'),  // Yesterday 15:55 ET — drop
      makeCandle('2026-05-12 14:00:00'),  // Today 10:00 ET — keep
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out).toHaveLength(1);
    expect(out[0].datetime).toBe('2026-05-12 14:00:00');
    expect(sessionDate).toBe('2026-05-12');
  });

  it('handles DST correctly — summer (DST, UTC-4)', () => {
    // 2026-06-15 (Monday, DST). Open = 13:30 UTC.
    const now = utcFromEt(2026, 6, 15, 10, 0, 4);
    const candles = [
      makeCandle('2026-06-15 13:25:00'),  // 9:25 ET — before open, drop
      makeCandle('2026-06-15 13:30:00'),  // 9:30 ET — keep
      makeCandle('2026-06-15 14:00:00'),  // 10:00 ET — keep
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out).toHaveLength(2);
    expect(sessionDate).toBe('2026-06-15');
    expect(out.map(c => c.datetime)).toEqual([
      '2026-06-15 13:30:00',
      '2026-06-15 14:00:00',
    ]);
  });

  it('handles DST correctly — winter (standard time, UTC-5)', () => {
    // 2026-01-20 (Tuesday, standard time). Open = 14:30 UTC.
    const now = utcFromEt(2026, 1, 20, 10, 0, 5);
    const candles = [
      makeCandle('2026-01-20 14:25:00'),  // 9:25 ET — drop
      makeCandle('2026-01-20 14:30:00'),  // 9:30 ET — keep
      makeCandle('2026-01-20 15:00:00'),  // 10:00 ET — keep
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out).toHaveLength(2);
    expect(sessionDate).toBe('2026-01-20');
    expect(out.map(c => c.datetime)).toEqual([
      '2026-01-20 14:30:00',
      '2026-01-20 15:00:00',
    ]);
  });

  it('weekend candle becomes the latest session if EODHD anomalously ships one (filter trusts feed)', () => {
    // 2026-05-16 is a Saturday. We don't add holiday/weekend gating — the
    // filter trusts EODHD not to ship weekend candles for equity symbols.
    // If one slips through and is the latest date, it's the anchor.
    const now = utcFromEt(2026, 5, 16, 12, 0, 4);
    const candles = [
      makeCandle('2026-05-15 14:00:00'),  // Friday — drop (older date)
      makeCandle('2026-05-16 14:00:00'),  // Saturday 10 AM ET — latest date, within RTH
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out).toHaveLength(1);
    expect(out[0].datetime).toBe('2026-05-16 14:00:00');
    expect(sessionDate).toBe('2026-05-16');
  });

  it('returns previous-day session when latest available candles are from yesterday (the EODHD-lag case)', () => {
    // This is the exact production failure mode: EODHD's /intraday endpoint
    // lags ~1 trading day, so even when called mid-session on May 12, the
    // latest candles in the response are from May 11.
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const candles = [
      makeCandle('2026-05-11 13:30:00'),  // 9:30 ET
      makeCandle('2026-05-11 14:00:00'),  // 10:00 ET
      makeCandle('2026-05-11 19:55:00'),  // 15:55 ET
      makeCandle('2026-05-11 20:00:00'),  // 16:00 ET (close)
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out).toHaveLength(4);
    expect(sessionDate).toBe('2026-05-11');
  });

  it('respects early close days — 1:00 PM ET close on Black Friday 2026', () => {
    // 2026-11-27 is the Black Friday early close (1 PM ET).
    // DST ends Nov 1 in 2026, so this date is standard time UTC-5.
    const now = utcFromEt(2026, 11, 27, 14, 0, 5);
    const candles = [
      makeCandle('2026-11-27 14:30:00'),  // 9:30 ET — keep
      makeCandle('2026-11-27 17:55:00'),  // 12:55 ET — keep (within early-close window)
      makeCandle('2026-11-27 18:00:00'),  // 13:00 ET — early close boundary — keep (inclusive)
      makeCandle('2026-11-27 18:05:00'),  // 13:05 ET — past early close — drop
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out.map(c => c.datetime)).toEqual([
      '2026-11-27 14:30:00',
      '2026-11-27 17:55:00',
      '2026-11-27 18:00:00',
    ]);
    expect(sessionDate).toBe('2026-11-27');
  });

  it('future-timestamped candles within RTH window are NOT excluded (no now-based cap)', () => {
    // Behavior change from Fix v1: there's no longer a `Math.min(close, now)`
    // cap, so a 15:55 ET candle published when `now` reads 10:00 ET will be
    // kept. EODHD shouldn't publish future bars in practice; this test
    // documents the trade-off.
    const now = utcFromEt(2026, 5, 12, 10, 0, 4);
    const candles = [
      makeCandle('2026-05-12 13:30:00'),  // 9:30 ET — keep
      makeCandle('2026-05-12 14:00:00'),  // 10:00 ET — keep
      makeCandle('2026-05-12 14:05:00'),  // 10:05 ET — "future" vs now, kept
      makeCandle('2026-05-12 19:55:00'),  // 15:55 ET — "future" vs now, kept
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out).toHaveLength(4);
    expect(sessionDate).toBe('2026-05-12');
  });

  it('parses ISO-with-Z datetime format as UTC', () => {
    // fetchIntradayCandles's fallback path emits ISO strings via .toISOString().
    // 2026-05-12 (DST). 9:30 ET = 13:30 UTC.
    const now = utcFromEt(2026, 5, 12, 10, 0, 4);
    const candles = [
      makeCandle('2026-05-12T13:30:00.000Z'),
      makeCandle('2026-05-12T13:35:00.000Z'),
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out).toHaveLength(2);
    expect(sessionDate).toBe('2026-05-12');
  });

  it('returns {candles: [], sessionDate: null} for null/empty/missing candle arrays', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    expect(filterToLatestSession(null, now)).toEqual({ candles: [], sessionDate: null });
    expect(filterToLatestSession(undefined, now)).toEqual({ candles: [], sessionDate: null });
    expect(filterToLatestSession([], now)).toEqual({ candles: [], sessionDate: null });
  });

  it('returns {candles: [], sessionDate: null} when all candles have malformed datetimes', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const candles = [
      makeCandle('not a date'),
      makeCandle(''),
      { datetime: null, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ];
    expect(filterToLatestSession(candles, now)).toEqual({ candles: [], sessionDate: null });
  });

  it('skips candles with malformed datetime strings but anchors on valid latest', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const candles = [
      makeCandle('not a date'),
      makeCandle(''),
      { datetime: null, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      makeCandle('2026-05-12 14:00:00'),  // 10:00 ET — keep
    ];
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(out).toHaveLength(1);
    expect(out[0].datetime).toBe('2026-05-12 14:00:00');
    expect(sessionDate).toBe('2026-05-12');
  });

  it('preserves oldest-first chronological order in the output', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const candles = [
      makeCandle('2026-05-12 13:30:00', { close: 100 }),
      makeCandle('2026-05-12 13:35:00', { close: 101 }),
      makeCandle('2026-05-12 13:40:00', { close: 102 }),
      makeCandle('2026-05-12 13:45:00', { close: 103 }),
    ];
    const { candles: out } = filterToLatestSession(candles, now);
    expect(out.map(c => c.close)).toEqual([100, 101, 102, 103]);
  });

  it('sessionDate returned in YYYY-MM-DD format', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const candles = [makeCandle('2026-05-12 13:30:00')];
    const { sessionDate } = filterToLatestSession(candles, now);
    expect(sessionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sessionDate).toBe('2026-05-12');
  });

  it('handles large multi-day fixture (regression: production failure mode)', () => {
    // Mimic the shape of a real EODHD response that spans many trading days.
    // The filter must pull only the latest date's RTH session.
    const dates = [
      '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08',
      '2026-05-11', '2026-05-12',
    ];
    const candles = [];
    for (const dateStr of dates) {
      for (let i = 0; i < 78; i++) {
        const totalMinutes = (9 * 60 + 30) + 4 * 60 + i * 5; // UTC = ET + 4 (DST)
        const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
        const mm = String(totalMinutes % 60).padStart(2, '0');
        candles.push(makeCandle(`${dateStr} ${hh}:${mm}:00`));
      }
    }
    const now = utcFromEt(2026, 5, 13, 10, 0, 4); // doesn't matter
    const { candles: out, sessionDate } = filterToLatestSession(candles, now);
    expect(sessionDate).toBe('2026-05-12');
    expect(out).toHaveLength(78);
    expect(out[0].datetime.startsWith('2026-05-12')).toBe(true);
    expect(out[out.length - 1].datetime.startsWith('2026-05-12')).toBe(true);
  });
});

// ==================== filterToLatestSession + calculateVWAP — integration ====================
//
// End-to-end shape: realistic multi-session candle arrays (mirroring what
// EODHD currently returns by default) → filter → calculateVWAP. These tests
// pin the behavior the production bug surfaced:
//   - Without the filter, calculateVWAP produces a multi-day window VWAP
//     (the cause of MU's 67% deviation in voiceLayerCache on May 12).
//   - With the filter, calculateVWAP produces a true session VWAP with
//     small, plausible deviation magnitudes.

describe('filterToLatestSession + calculateVWAP — session VWAP integration', () => {
  // Build N synthetic 5-minute candles for one ET trading session at a
  // given price level. Volume is constant per candle so the VWAP weights
  // each session equally.
  function buildSessionCandles({ dateStr, priceLevel, count = 78, volumePerBar = 10000, etOffset }) {
    // dateStr: 'YYYY-MM-DD' (ET trading date)
    // We emit candles starting at 9:30 ET. UTC = ET + offset.
    const [y, mo, d] = dateStr.split('-').map(Number);
    const startUtcMinutes = (9 * 60 + 30) + etOffset * 60;
    const candles = [];
    for (let i = 0; i < count; i++) {
      const minutesFromStart = i * 5;
      const totalMinutes = startUtcMinutes + minutesFromStart;
      const hh = Math.floor(totalMinutes / 60);
      const mm = totalMinutes % 60;
      const hhStr = String(hh).padStart(2, '0');
      const mmStr = String(mm).padStart(2, '0');
      // Wave around the price level for variation.
      const tickJitter = ((i % 5) - 2) * 0.1;
      const close = priceLevel + tickJitter;
      candles.push({
        datetime: `${dateStr} ${hhStr}:${mmStr}:00`,
        open: close - 0.05,
        high: close + 0.2,
        low: close - 0.2,
        close,
        volume: volumePerBar,
      });
    }
    return candles;
  }

  it('Test 11 — with realistic multi-session candles, session VWAP differs sharply from raw multi-day VWAP', () => {
    // Scenario reproduces the MU-style production data: a stock that's
    // climbed substantially. Without the session filter, the multi-day
    // VWAP anchors near the historical low; with the filter, it anchors
    // at today's session.
    //
    // 2026-05-11 (Mon, DST UTC-4): full session at $100 (78 bars)
    // 2026-05-12 (Tue, DST UTC-4): half session at $200, now = 13:00 ET
    const yesterday = buildSessionCandles({
      dateStr: '2026-05-11', priceLevel: 100, count: 78, etOffset: 4,
    });
    const today = buildSessionCandles({
      dateStr: '2026-05-12', priceLevel: 200, count: 42, etOffset: 4, // 9:30 + 42×5 = 13:00 ET
    });
    const allCandles = [...yesterday, ...today];
    const now = utcFromEt(2026, 5, 12, 13, 0, 4);

    // Raw multi-day VWAP — drags the average toward yesterday's price.
    const rawResult = calculateVWAP(allCandles);
    expect(rawResult).not.toBeNull();
    // Combined volume-weighted average of $100 (78 bars) and $200 (42 bars)
    // ≈ (100*78 + 200*42) / 120 ≈ 135 — extreme deviation from current ~$200.
    expect(Math.abs(rawResult.vwapDeviation)).toBeGreaterThan(20);

    // Session-filtered VWAP — anchors today only.
    const { candles: sessionCandles, sessionDate } = filterToLatestSession(allCandles, now);
    expect(sessionCandles).toHaveLength(today.length);
    expect(sessionDate).toBe('2026-05-12');
    const sessionResult = calculateVWAP(sessionCandles);
    expect(sessionResult).not.toBeNull();
    // Session VWAP ≈ $200 (today's tight band around $200), current price ≈ $200,
    // deviation should be near zero.
    expect(Math.abs(sessionResult.vwapDeviation)).toBeLessThan(0.5);
  });

  it('Test 12 — vwapDeviation reflects session-only price action after filtering', () => {
    // 2026-05-12 mid-session. Today's session opens at $100 and drifts to
    // $102 by the time of the snapshot — a +0.5% session deviation, which
    // is a plausible single-session signal.
    const todayBars = [];
    for (let i = 0; i < 20; i++) {
      const close = 100 + i * 0.1; // climbs from 100 to 101.9
      const minutesFromOpen = i * 5;
      const totalMinutes = (9 * 60 + 30) + 4 * 60 + minutesFromOpen; // 9:30 ET + UTC offset
      const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
      const mm = String(totalMinutes % 60).padStart(2, '0');
      todayBars.push({
        datetime: `2026-05-12 ${hh}:${mm}:00`,
        open: close - 0.05, high: close + 0.05, low: close - 0.05, close, volume: 10000,
      });
    }
    // Add a few stale yesterday bars at $50 that the filter should exclude.
    const yesterdayStale = buildSessionCandles({
      dateStr: '2026-05-11', priceLevel: 50, count: 10, etOffset: 4,
    });

    const now = utcFromEt(2026, 5, 12, 11, 30, 4); // After all 20 today-bars (last bar at 11:05 ET)
    const all = [...yesterdayStale, ...todayBars];
    const { candles: filtered, sessionDate } = filterToLatestSession(all, now);
    const result = calculateVWAP(filtered);

    expect(result).not.toBeNull();
    expect(filtered).toHaveLength(20); // stale yesterday bars dropped
    expect(sessionDate).toBe('2026-05-12');
    expect(result.currentPrice).toBeCloseTo(101.9, 1);
    // Session VWAP is the volume-weighted mean ≈ 100.95; deviation ≈ +0.94%.
    expect(result.vwapDeviation).toBeGreaterThan(0);
    expect(result.vwapDeviation).toBeLessThan(2);
  });

  it('Test 13 — typical-stock session deviation lands in plausible <±5% range', () => {
    // Walks the price up 3% across one session — a "moved more than usual"
    // single-session day. Verifies the final deviation is meaningful but
    // bounded (within the documented session-realistic range of <±10%).
    const today = [];
    const startPrice = 100;
    const endPrice = 103;
    const count = 50;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const close = startPrice + (endPrice - startPrice) * t;
      const minutesFromOpen = i * 5;
      const totalMinutes = (9 * 60 + 30) + 4 * 60 + minutesFromOpen;
      const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
      const mm = String(totalMinutes % 60).padStart(2, '0');
      today.push({
        datetime: `2026-05-12 ${hh}:${mm}:00`,
        open: close, high: close + 0.1, low: close - 0.1, close, volume: 12000,
      });
    }
    const now = utcFromEt(2026, 5, 12, 13, 30, 4); // far enough into the session
    const { candles: filtered, sessionDate } = filterToLatestSession(today, now);
    const result = calculateVWAP(filtered);

    expect(sessionDate).toBe('2026-05-12');

    expect(result).not.toBeNull();
    expect(result.vwapDeviation).toBeGreaterThan(0);     // price closed up vs session VWAP
    expect(Math.abs(result.vwapDeviation)).toBeLessThan(5); // within session-plausible range
  });
});
