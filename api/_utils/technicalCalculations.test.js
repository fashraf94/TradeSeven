// api/_utils/technicalCalculations.test.js
// Unit tests for calculateVWAP — added alongside the May 7 market-open fix.
// The function shipped 22 days ago without tests; this is the missing
// coverage. Bug surface tested:
//   - Happy path (real OHLCV)
//   - Empty array → null
//   - All zero volume → null
//   - Last candle close: null (the May 7 failure mode that crashed the eval cron)
//   - All candles with null close → null (vwap NaN propagation)
//   - Non-finite intermediate values (Infinity in close)

import { describe, it, expect } from 'vitest';
import { calculateVWAP } from './technicalCalculations.js';

function candle({ open = 100, high = 101, low = 99, close = 100.5, volume = 10000 } = {}) {
  return { datetime: '2026-05-07 13:30:00', open, high, low, close, volume };
}

describe('calculateVWAP', () => {
  it('Test 1 — happy path: returns vwap object for valid candles', () => {
    const candles = [
      candle({ high: 101, low: 99, close: 100, volume: 10000 }),  // typical = 100
      candle({ high: 103, low: 101, close: 102, volume: 20000 }), // typical = 102
      candle({ high: 105, low: 103, close: 104, volume: 30000 }), // typical = 104
    ];
    // Weighted: (100*10000 + 102*20000 + 104*30000) / 60000 = 6160000 / 60000 = 102.6667
    const result = calculateVWAP(candles);

    expect(result).not.toBeNull();
    expect(result.vwap).toBeCloseTo(102.6667, 3);
    expect(result.currentPrice).toBe(104);
    // vwapDeviation = (104 - 102.6667) / 102.6667 * 100 ≈ 1.2987%
    expect(result.vwapDeviation).toBeCloseTo(1.2987, 2);
  });

  it('Test 2 — empty array returns null', () => {
    expect(calculateVWAP([])).toBeNull();
    expect(calculateVWAP(null)).toBeNull();
    expect(calculateVWAP(undefined)).toBeNull();
  });

  it('Test 3 — all-zero-volume candles return null', () => {
    const candles = [
      candle({ volume: 0 }),
      candle({ volume: 0 }),
      candle({ volume: 0 }),
    ];

    expect(calculateVWAP(candles)).toBeNull();
  });

  it('Test 4 — last candle has close: null returns null (May 7 market-open failure mode)', () => {
    // This is the exact shape that crashed the eval cron at 13:30 UTC May 7.
    // EODHD returned the in-progress 9:30 ET candle with close=null. Layer 2's
    // !Number.isFinite(currentPrice) guard catches this.
    const candles = [
      candle({ close: 100, volume: 10000 }),
      candle({ close: 101, volume: 12000 }),
      candle({ close: null, volume: 0 }),
    ];

    expect(calculateVWAP(candles)).toBeNull();
  });

  it('Test 5 — all candles with null close returns null (vwap becomes NaN)', () => {
    // typicalPrice = (high + low + null) / 3 = NaN. cumulativeTPV stays NaN.
    // cumulativeVolume from valid `volume` values may pass the line-391 guard,
    // so vwap = NaN / nonzero = NaN. Layer 2's !Number.isFinite(vwap) guard
    // catches this (NaN is not finite).
    const candles = [
      candle({ close: null, volume: 10000 }),
      candle({ close: null, volume: 12000 }),
      candle({ close: null, volume: 8000 }),
    ];

    expect(calculateVWAP(candles)).toBeNull();
  });

  it('Test 6 — non-finite intermediate value (Infinity in close) returns null', () => {
    // Defense in depth: any path that produces Infinity/-Infinity/NaN in vwap
    // or currentPrice should be caught by the Layer 2 guard rather than
    // surfacing as a poisoned numeric value downstream.
    const candles = [
      candle({ close: 100, volume: 10000 }),
      candle({ close: Infinity, volume: 10000 }),
    ];

    expect(calculateVWAP(candles)).toBeNull();
  });
});
