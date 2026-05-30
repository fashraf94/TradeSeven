// api/cron/compute-index-intelligence.intraday.test.js
//
// Phase 1 (Option B — partial/full-universe intraday recompute): unit tests for
// injectIntradayBar, the pure core of intraday mode. The cron splices today's
// live price onto each symbol's newest-first OHLCV array as a synthetic index-0
// bar before the (unchanged) scoring pipeline runs, so the cross-sectional RS /
// ATR / momentum percentiles — and the baggerBombFit derived from them — reflect
// the current session instead of yesterday's close.
//
// The handler itself needs EODHD + Firebase credentials and live network, so it
// can't be exercised here; these lock the deterministic injection contract.

import { describe, it, expect } from 'vitest';
import { injectIntradayBar } from './compute-index-intelligence.js';

// newest-first bars, mirroring fetchOHLCV's output (index 0 == most recent).
function bars(n, { startVol = 1000 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const day = String(20 - i).padStart(2, '0');
    out.push({ date: `2026-05-${day}`, open: 100, high: 101, low: 99, close: 100 - i, volume: startVol });
  }
  return out;
}

describe('injectIntradayBar', () => {
  it('prepends a synthetic today bar when the newest bar is an earlier date', () => {
    const arr = bars(40);
    const out = injectIntradayBar(arr, { close: 105, open: 101, high: 106, low: 100 }, '2026-05-21');
    expect(out.length).toBe(41);
    expect(out[0].date).toBe('2026-05-21');
    expect(out[0].close).toBe(105);
    expect(out[0].open).toBe(101);
    expect(out[1]).toBe(arr[0]); // full history preserved by reference
  });

  it('replaces index 0 when the EOD feed already returned today (no duplicate session)', () => {
    const arr = bars(40);
    arr[0].date = '2026-05-21';
    const out = injectIntradayBar(arr, { close: 105 }, '2026-05-21');
    expect(out.length).toBe(40);
    expect(out[0].date).toBe('2026-05-21');
    expect(out[0].close).toBe(105);
    expect(out[1]).toBe(arr[1]);
  });

  it('neutralizes volume to the trailing average (no fake spike/drought from a partial bar)', () => {
    const arr = bars(40, { startVol: 2000 });
    const out = injectIntradayBar(arr, { close: 105 }, '2026-05-21');
    expect(out[0].volume).toBe(2000); // == trailing-30 avg → volumeRatio ≈ 1.0
  });

  it('guards session high >= close and low <= close even with inconsistent quote ranges', () => {
    const arr = bars(40);
    const out = injectIntradayBar(arr, { close: 110, high: 108, low: 95 }, '2026-05-21');
    expect(out[0].high).toBeGreaterThanOrEqual(110);
    expect(out[0].low).toBeLessThanOrEqual(110);
  });

  it('falls back to prior close for open/high/low when the quote omits them', () => {
    const arr = bars(40);
    const prevClose = arr[0].close;
    const out = injectIntradayBar(arr, { close: 105 }, '2026-05-21');
    expect(out[0].open).toBe(prevClose);
    expect(out[0].high).toBe(105);
    expect(out[0].low).toBe(105);
  });

  it('coerces numeric strings (EODHD sometimes returns "NA"/strings)', () => {
    const arr = bars(40);
    const out = injectIntradayBar(arr, { close: '105.5', high: '106', low: '104', open: '105' }, '2026-05-21');
    expect(out[0].close).toBe(105.5);
    expect(out[0].high).toBe(106);
  });

  it('returns the array unchanged when the quote carries no usable price', () => {
    const arr = bars(10);
    expect(injectIntradayBar(arr, null, '2026-05-21')).toBe(arr);
    expect(injectIntradayBar(arr, { close: 0 }, '2026-05-21')).toBe(arr);
    expect(injectIntradayBar(arr, { close: -3 }, '2026-05-21')).toBe(arr);
    expect(injectIntradayBar(arr, { close: 'NA' }, '2026-05-21')).toBe(arr);
  });

  it('returns an empty array unchanged', () => {
    expect(injectIntradayBar([], { close: 105 }, '2026-05-21')).toEqual([]);
  });
});
