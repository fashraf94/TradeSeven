// api/cron/compute-index-intelligence.rollup.test.js
//
// Phase 2 — unit tests for buildIndustriesRollup, the pure core of the industry rollup
// written into the daily stockRankings doc. Mirrors the import-based pattern of
// compute-index-intelligence.intraday.test.js (the cron handler isn't exported, but its
// pure helpers are). Covers: median aggregation, the >= MIN_INDUSTRY_SIZE inclusion gate,
// the per-metric non-null-count gate, and null-industryName skip.

import { describe, it, expect } from 'vitest';
import { buildIndustriesRollup, MIN_INDUSTRY_SIZE } from './compute-index-intelligence.js';

// A rankingStocks-shaped entry: symbol + industryName + the aggregated metrics. Anything
// omitted defaults to null (a thin-history horizon).
function stk(symbol, industryName, fields = {}) {
  return {
    symbol,
    industryName,
    return1W: null, return1M: null, return3M: null, returnYTD: null, return12M: null,
    momentumScore: null,
    ...fields,
  };
}

const SEMI = 'Semiconductors & Semiconductor Equipment';

describe('buildIndustriesRollup', () => {
  it('MIN_INDUSTRY_SIZE is 4', () => {
    expect(MIN_INDUSTRY_SIZE).toBe(4);
  });

  it('includes only industries with >= MIN_INDUSTRY_SIZE members; medians are upper-middle', () => {
    const stocks = [
      stk('NVDA', SEMI, { return1M: 10, momentumScore: 60 }),
      stk('AMD', SEMI, { return1M: 20, momentumScore: 70 }),
      stk('AVGO', SEMI, { return1M: 30, momentumScore: 80 }),
      stk('MU', SEMI, { return1M: 40, momentumScore: 90 }),
      // Banks: only 3 members → excluded
      stk('JPM', 'Banks', { return1M: 5 }),
      stk('BAC', 'Banks', { return1M: 6 }),
      stk('WFC', 'Banks', { return1M: 7 }),
    ];
    const out = buildIndustriesRollup(stocks);

    expect(Object.keys(out)).toEqual([SEMI]); // Banks (3 < 4) excluded
    const semi = out[SEMI];
    expect(semi.name).toBe(SEMI);
    expect(semi.totalStocks).toBe(4);
    expect(semi.stocks.sort()).toEqual(['AMD', 'AVGO', 'MU', 'NVDA']);
    // median (upper-middle) of [10,20,30,40] → 30; of [60,70,80,90] → 80
    expect(semi.return1M).toBe(30);
    expect(semi.momentumScore).toBe(80);
  });

  it('per-metric null gate: a horizon with < MIN_INDUSTRY_SIZE non-null members is null', () => {
    const stocks = [
      stk('A', 'Pharmaceuticals', { return1M: 1, return3M: 10 }),
      stk('B', 'Pharmaceuticals', { return1M: 2, return3M: 20 }),
      stk('C', 'Pharmaceuticals', { return1M: 3, return3M: 30 }),
      stk('D', 'Pharmaceuticals', { return1M: 4, return3M: null }),
      stk('E', 'Pharmaceuticals', { return1M: 5, return3M: null }),
    ];
    const ph = buildIndustriesRollup(stocks).Pharmaceuticals;
    expect(ph.totalStocks).toBe(5);
    expect(ph.return1M).toBe(3); // all 5 non-null → median [1..5] = 3
    expect(ph.return3M).toBeNull(); // only 3 non-null (< 4) → null, won't rank
  });

  it('skips null / missing industryName', () => {
    const stocks = [
      stk('X', null, { return1M: 1 }),
      stk('Y', undefined, { return1M: 2 }),
      stk('NVDA', SEMI, { return1M: 10 }),
      stk('AMD', SEMI, { return1M: 20 }),
      stk('AVGO', SEMI, { return1M: 30 }),
      stk('MU', SEMI, { return1M: 40 }),
    ];
    const out = buildIndustriesRollup(stocks);
    expect(Object.keys(out)).toEqual([SEMI]);
    expect(out[SEMI].totalStocks).toBe(4); // X / Y not grouped
  });

  it('honors a custom minSize (e.g. 3 includes a 3-member industry)', () => {
    const stocks = [
      stk('JPM', 'Banks', { return1M: 5 }),
      stk('BAC', 'Banks', { return1M: 6 }),
      stk('WFC', 'Banks', { return1M: 7 }),
    ];
    expect(buildIndustriesRollup(stocks, 4).Banks).toBeUndefined();
    const banks = buildIndustriesRollup(stocks, 3).Banks;
    expect(banks.totalStocks).toBe(3);
    expect(banks.return1M).toBe(6); // median [5,6,7] = 6
  });

  it('empty / non-array input returns an empty object', () => {
    expect(buildIndustriesRollup(null)).toEqual({});
    expect(buildIndustriesRollup([])).toEqual({});
    expect(buildIndustriesRollup(undefined)).toEqual({});
  });
});
