// src/components/Research/chartUtils.basis.test.js
//
// The Chart view's read — THE CANDLES' BASIS (ACX-3, CR-7, UC-1 – UC-2; spec docs/specs/CHART_READ_SPEC_V1.md):
// prepareChartData's one named option. `basis: 'raw'` draws each candle as traded; absent, the candles are
// scaled by adjusted close ÷ close exactly as before (deep-equal to the pre-build function, copied below verbatim
// from main 2e069d42, so "byte for byte" is a row, not a claim).

import { describe, it, expect } from 'vitest';
import { prepareChartData, formatTime } from './chartUtils.js';

// main @ 2e069d42's prepareChartData's per-candle transform, verbatim (the oracle).
const legacyCandle = (candle, isIntraday) => {
  const rawTime = candle.date || candle.datetime || candle.timestamp;
  const time = formatTime(rawTime, isIntraday);
  if (!time) return null;
  const adjClose = Number(candle.adjusted_close) || Number(candle.close);
  const rawClose = Number(candle.close);
  const factor = rawClose > 0 ? adjClose / rawClose : 1;
  return { time, open: Number(candle.open) * factor, high: Number(candle.high) * factor, low: Number(candle.low) * factor, close: adjClose, volume: Number(candle.volume) || 0 };
};

// Newest first, as the API answers; a 2:1 split three sessions back (adjusted = half the raw before it).
const ROWS = [
  { date: '2026-11-18', open: 142.95, high: 143.7, low: 142.6, close: 143.35, adjusted_close: 143.35, volume: 1_900_000 },
  { date: '2026-11-17', open: 141.61, high: 143.1, low: 141.35, close: 142.8, adjusted_close: 142.8, volume: 4_100_000 },
  { date: '2026-11-16', open: 141.37, high: 142.13, low: 140.7, close: 141.6, adjusted_close: 141.6, volume: 3_700_000 },
  { date: '2026-11-13', open: 283.13, high: 285.37, low: 281.61, close: 284.2, adjusted_close: 142.1, volume: 1_800_000 },
];

describe('prepareChartData(rawData, { basis })', () => {
  it('absent: identical to the pre-build transform, row for row', () => {
    const out = prepareChartData(ROWS);
    const want = [...ROWS].map((c) => legacyCandle(c, false)).reverse();
    expect(out).toEqual(want);
    expect(out[0].close).toBe(142.1); // the split row drawn adjusted, today as before
    expect(prepareChartData(ROWS, {})).toEqual(want);
    expect(prepareChartData(ROWS, { basis: 'adjusted' })).toEqual(want); // only 'raw' changes anything
  });
  it("'raw': every candle as traded — open, high, low and close unscaled", () => {
    const out = prepareChartData(ROWS, { basis: 'raw' });
    expect(out.map((c) => [c.open, c.high, c.low, c.close, c.volume])).toEqual([...ROWS].reverse().map((r) => [r.open, r.high, r.low, r.close, r.volume]));
    expect(out.map((c) => c.time)).toEqual(prepareChartData(ROWS).map((c) => c.time));
  });
  it("UC-4: a live-patched last row (the hook keeps the stored adjusted close) draws the live price only on 'raw'", () => {
    const patched = [{ ...ROWS[0], close: 143.62, adjusted_close: 143.35 }, ...ROWS.slice(1)];
    expect(prepareChartData(patched, { basis: 'raw' }).at(-1).close).toBe(143.62);
    expect(prepareChartData(patched).at(-1).close).toBe(143.35); // today's adjusted path: the stored adjusted close
  });
});
