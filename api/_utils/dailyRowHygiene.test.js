// api/_utils/dailyRowHygiene.test.js
//
// The daily mapper validates numerically: a row whose close, high or low is not
// a finite number is DROPPED, never coerced to 0.
//
// The defect this battery names is not a crash and not a null — it is a FINITE
// WRONG NUMBER. EODHD can return `null` for a field on a halted or otherwise
// broken session, and JavaScript's `+` coerces `null` to 0 silently, so
// `calculateSMA`'s `reduce((a, b) => a + b, 0)` (technicalCalculations.js:22)
// turns one null close into an average that is low by close/period and carries
// no marker of it. `calculateEMA`/`calculateMACD` seed the same way (`:40`,
// `:194`). Nothing throws, nothing logs, no renderer suppresses it: the wrong
// average is printed as a measurement, on the research card, in the voice
// layer, and in the prompts the decider reads.
//
// So every row here proves the same two things together — the surviving series
// is EXACTLY the series without the bad row, and the value the old mapper would
// have produced is finite, different, and therefore undetectable downstream.
// The second half is the mutation check: a row that only asserted "no NaN"
// could not fail under this defect.
//
// This file's un-mocked import of marketDataCache.js is also the BUILD_RULES §4
// dependency-surface guard for that module's import graph — it must never be
// mocked.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchDailyOHLCV, mapDailyRows } from './marketDataCache.js';
import { calculateAllIndicators, calculateSMA, calculateMACD } from './technicalCalculations.js';

const DAY_MS = 86_400_000;

// An EODHD `/eod/` payload: newest-first weekday rows, gently trending with a
// wobble so ATR/Bollinger/RSI are non-degenerate and nothing here depends on
// flat data. 90 weekdays clears MACD's 35-row and SMA50's 50-row minimums with
// room, which is what makes "the same series minus one row" a fair comparison.
function eodPayload(n = 90) {
  const rows = [];
  const today = Date.UTC(2026, 5, 15);
  for (let i = 0; i < n; i++) {
    const close = Number((120 + i * 0.35 + Math.sin(i / 3) * 1.8).toFixed(4));
    rows.push({
      date: new Date(today - i * DAY_MS).toISOString().slice(0, 10),
      open: Number((close - 0.25).toFixed(4)),
      high: Number((close + 1.2).toFixed(4)),
      low: Number((close - 1.2).toFixed(4)),
      close,
      adjusted_close: close,
      volume: 4_000_000 + (i % 5) * 120_000,
    });
  }
  return rows;
}

function stubFetch(rows) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(rows),
  })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the defect: one null close is a finite wrong average, not a null one', () => {
  it('null sums as 0 — the old mapper produced a finite SMA that was wrong by close/period', () => {
    const good = Array.from({ length: 50 }, () => 100);
    const withNull = [...good];
    withNull[7] = null;                            // what `d.adjusted_close || d.close` yielded

    const poisoned = calculateSMA(withNull, 50);
    expect(Number.isFinite(poisoned)).toBe(true);   // no NaN, no null, no throw
    expect(poisoned).toBe(98);                      // 4900/50 — low by exactly close/period
    expect(poisoned).not.toBe(calculateSMA(good, 50));

    // MACD too: finite, and different. Nothing downstream can tell.
    const macdPoisoned = calculateMACD(withNull);
    const macdGood = calculateMACD(good.map((v, i) => v + Math.sin(i / 4)));
    expect(Number.isFinite(macdPoisoned.histogram)).toBe(true);
    expect(macdPoisoned.histogram).not.toBe(macdGood.histogram);
  });
});

describe('mapDailyRows — the drop criterion', () => {
  it('drops a row whose close is unusable in BOTH fields, and counts it', () => {
    const payload = eodPayload(10);
    payload[4].close = null;
    payload[4].adjusted_close = null;

    const { rows, dropped } = mapDailyRows(payload);
    expect(dropped).toBe(1);
    expect(rows).toHaveLength(9);
    expect(rows.some(r => r.date === payload[4].date)).toBe(false);
    // Nothing zero-valued survived in its place.
    expect(rows.every(r => Number.isFinite(r.close) && r.close > 0)).toBe(true);
  });

  it('drops on a bad high or a bad low as well — close alone is not the test', () => {
    const highBad = eodPayload(10);
    highBad[2].high = null;
    expect(mapDailyRows(highBad).dropped).toBe(1);

    const lowBad = eodPayload(10);
    lowBad[6].low = undefined;
    expect(mapDailyRows(lowBad).dropped).toBe(1);

    const strBad = eodPayload(10);
    strBad[1].high = 'NA';
    expect(mapDailyRows(strBad).dropped).toBe(1);
  });

  it('keeps a row whose close is recoverable from the raw close — a drop is a last resort', () => {
    const payload = eodPayload(10);
    payload[3].adjusted_close = null;   // the fallback the shipped `||` already had
    const { rows, dropped } = mapDailyRows(payload);
    expect(dropped).toBe(0);
    expect(rows).toHaveLength(10);
    expect(rows[3].close).toBe(payload[3].close);
  });

  it('coerces numeric strings rather than dropping them', () => {
    const payload = eodPayload(4);
    payload[1].adjusted_close = '131.25';
    payload[1].close = '131.00';
    const { rows, dropped } = mapDailyRows(payload);
    expect(dropped).toBe(0);
    expect(rows[1].close).toBe(131.25);
    expect(rows[1].rawClose).toBe(131);
  });

  it('validates the siblings too — an unusable open/rawClose/volume is null, never 0', () => {
    const payload = eodPayload(4);
    payload[0].open = null;
    payload[0].volume = 'NA';
    delete payload[2].close;             // rawClose has nothing to read
    const { rows, dropped } = mapDailyRows(payload);

    expect(dropped).toBe(0);             // none of the three is a drop criterion
    expect(rows[0].open).toBeNull();
    expect(rows[0].volume).toBeNull();
    expect(rows[2].rawClose).toBeNull(); // `rawClose ?? close` still resolves (decide.js:1053-1054)
    expect(rows[2].close).toBe(payload[2].adjusted_close);
    for (const r of rows) {
      expect(r.open).not.toBe(0);
      expect(r.volume).not.toBe(0);
      expect(r.rawClose).not.toBe(0);
    }
  });

  it('an all-bad payload yields an empty series, not a series of zeros', () => {
    const payload = eodPayload(6).map(r => ({ ...r, close: null, adjusted_close: null }));
    const { rows, dropped } = mapDailyRows(payload);
    expect(rows).toHaveLength(0);
    expect(dropped).toBe(6);
    // calculateAllIndicators is null-honest about an empty series.
    expect(calculateAllIndicators(rows)).toBeNull();
  });
});

describe('fetchDailyOHLCV — one null close, end to end', () => {
  it('the SMA and MACD EQUAL the values computed over the remaining rows', async () => {
    const payload = eodPayload(90);
    const victim = 12;
    payload[victim].close = null;
    payload[victim].adjusted_close = null;
    stubFetch(payload);

    const daily = await fetchDailyOHLCV('AAPL.US', 'test-token');
    expect(daily).toHaveLength(89);

    // The reference series: the SAME payload with the bad row simply absent,
    // mapped by the same code. If dropping and never-having-been-there agree,
    // the drop introduced nothing.
    const reference = mapDailyRows(payload.filter((_, i) => i !== victim)).rows;
    expect(reference).toHaveLength(89);
    expect(daily).toEqual(reference);

    const got = calculateAllIndicators(daily);
    const want = calculateAllIndicators(reference);
    expect(got.sma.sma20).toBe(want.sma.sma20);
    expect(got.sma.sma50).toBe(want.sma.sma50);
    expect(got.macd).toEqual(want.macd);
    expect(got.rsi).toEqual(want.rsi);
    expect(got.ema).toEqual(want.ema);
    expect(got.atr).toEqual(want.atr);
    expect(got.bollingerBands).toEqual(want.bollingerBands);
    expect(got.dataPoints).toBe(89);
  });

  it('and NO finite-but-wrong value is produced — the shipped mapper\'s numbers are gone', async () => {
    const payload = eodPayload(90);
    const victim = 12;
    payload[victim].close = null;
    payload[victim].adjusted_close = null;
    stubFetch(payload);

    const daily = await fetchDailyOHLCV('AAPL.US', 'test-token');
    const got = calculateAllIndicators(daily);

    // What the shipped mapper would have handed calculateAllIndicators: every
    // row kept, the unusable close left as null.
    const poisoned = payload.map(d => ({
      date: d.date, open: d.open, high: d.high, low: d.low,
      close: d.adjusted_close || d.close, rawClose: d.close, volume: d.volume,
    }));
    const wrong = calculateAllIndicators(poisoned);

    // The old numbers were FINITE — that is the whole hazard — and wrong.
    expect(Number.isFinite(wrong.sma.sma20)).toBe(true);
    expect(Number.isFinite(wrong.sma.sma50)).toBe(true);
    expect(Number.isFinite(wrong.macd.histogram)).toBe(true);
    expect(wrong.sma.sma20).not.toBe(got.sma.sma20);
    expect(wrong.sma.sma50).not.toBe(got.sma.sma50);
    expect(wrong.macd.histogram).not.toBe(got.macd.histogram);

    // The size of the lie, stated: one null close in a 20-row window is a
    // 5%-of-price error on SMA20, silently.
    expect(got.sma.sma20 - wrong.sma.sma20).toBeGreaterThan(5);

    // And nothing the new path returns is non-finite either.
    for (const v of [got.sma.sma20, got.sma.sma50, got.macd.macd, got.macd.signal,
      got.macd.histogram, got.rsi.value, got.atr.value, got.ema.ema12]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('logs the drop count for the fetch', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const payload = eodPayload(20);
    payload[3].close = null;
    payload[3].adjusted_close = null;
    payload[9].low = null;
    stubFetch(payload);

    await fetchDailyOHLCV('AAPL.US', 'test-token');

    const line = spy.mock.calls.map(c => String(c[0]))
      .find(m => m.includes('Daily OHLCV for AAPL.US'));
    expect(line).toBeDefined();
    expect(line).toContain('18 rows kept');
    expect(line).toContain('2 dropped');
  });

  it('a clean payload is byte-identical to the shipped mapper, and logs 0 dropped', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const payload = eodPayload(60);
    stubFetch(payload);

    const daily = await fetchDailyOHLCV('AAPL.US', 'test-token');
    expect(daily).toEqual(payload.map(d => ({
      date: d.date, open: d.open, high: d.high, low: d.low,
      close: d.adjusted_close || d.close, rawClose: d.close, volume: d.volume,
    })));

    const line = spy.mock.calls.map(c => String(c[0]))
      .find(m => m.includes('Daily OHLCV for AAPL.US'));
    expect(line).toContain('0 dropped');
  });
});
