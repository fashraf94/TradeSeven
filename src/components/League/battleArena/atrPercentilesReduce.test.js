// src/components/League/battleArena/atrPercentilesReduce.test.js
//
// The pure stockRankings → {SYMBOL: atrPercentile} reduction (Phase 2.5). Node-clean:
// no firebase/React, so it loads and runs without a DOM harness — the coverage the
// hook layer (useAtrPercentiles) can't carry.

import { describe, it, expect } from 'vitest';
import { reduceRankingsToPercentiles } from './atrPercentilesReduce';

describe('reduceRankingsToPercentiles', () => {
  it('maps stocks to {SYMBOL: atrPercentile}, upper-casing + trimming the symbol', () => {
    const map = reduceRankingsToPercentiles({
      stocks: [
        { symbol: 'nvda', atrPercentile: 0.9 },
        { symbol: ' AMD ', atrPercentile: 0.4 },
      ],
    });
    expect(map).toEqual({ NVDA: 0.9, AMD: 0.4 }); // resolveBaseATR keys upper-case — must match
  });

  it('null when there is no usable stocks array (→ caller falls back to the port-contract ATR)', () => {
    expect(reduceRankingsToPercentiles(null)).toBeNull();
    expect(reduceRankingsToPercentiles(undefined)).toBeNull();
    expect(reduceRankingsToPercentiles({})).toBeNull();
    expect(reduceRankingsToPercentiles({ stocks: 'nope' })).toBeNull();
  });

  it('skips entries with a non-string / empty symbol; keeps a 0 percentile (falsy but valid)', () => {
    const map = reduceRankingsToPercentiles({
      stocks: [
        { symbol: 'GE', atrPercentile: 0 }, // a real 0 percentile — resolveBaseATR later maps 0‖0.5→4.0, banking-identical
        { atrPercentile: 0.5 },              // no symbol → skipped
        { symbol: '', atrPercentile: 0.5 },  // empty symbol → skipped
        { symbol: 42, atrPercentile: 0.5 },  // non-string → skipped
      ],
    });
    expect(map).toEqual({ GE: 0 });
  });
});
