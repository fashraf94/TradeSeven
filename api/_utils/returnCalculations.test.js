// api/_utils/returnCalculations.test.js
//
// Conversational Performance — unit tests for computeReturns. The cron computes these
// fresh on live data, so this suite is our insurance the math is right BEFORE it runs:
//   - each horizon's lookback (1W=5, 1M=21, 3M=63, 12M=252 bars) and percent math
//   - signed output: positive and negative returns, 2-dp rounding
//   - null on insufficient history (per-horizon; 12M needs 253 bars)
//   - the YTD date-anchor: last close of the PRIOR year, most-recent one, date-driven
//   - defensive guards: empty / null / non-finite / zero-or-negative denominator

import { describe, it, expect } from 'vitest';
import { computeReturns } from './returnCalculations.js';

// Build a newest-first closes array of `len` bars at a flat `fill`, then override
// specific indices so each horizon's two endpoints are known exactly.
function makeCloses(len, fill, overrides = {}) {
  const arr = new Array(len).fill(fill);
  for (const [idx, val] of Object.entries(overrides)) arr[Number(idx)] = val;
  return arr;
}

// All-2026 ISO dates, newest-first, so YTD finds no prior-year bar unless we say so.
function makeDates(len, year = 2026) {
  return new Array(len).fill(`${year}-06-01`);
}

describe('computeReturns — horizon math', () => {
  it('computes every fixed-lookback horizon from its endpoints, including a negative', () => {
    // closes[0]=110; 1W vs closes[5]=100, 1M vs [21]=88, 3M vs [63]=137.5, 12M vs [252]=55.
    const closes = makeCloses(260, 100, { 0: 110, 5: 100, 21: 88, 63: 137.5, 252: 55 });
    const r = computeReturns(closes, makeDates(260));
    expect(r.return1W).toBe(10);      // 110/100 - 1 = +10.00%
    expect(r.return1M).toBe(25);      // 110/88  - 1 = +25.00%
    expect(r.return3M).toBe(-20);     // 110/137.5 - 1 = -20.00% (negative)
    expect(r.return12M).toBe(100);    // 110/55  - 1 = +100.00%
  });

  it('rounds to two decimals', () => {
    const closes = makeCloses(10, 100, { 0: 100, 5: 99 });
    // 100/99 - 1 = 0.010101... → 1.01%
    expect(computeReturns(closes, makeDates(10)).return1W).toBe(1.01);
  });

  it('returns the full five-key shape on every call', () => {
    const r = computeReturns(makeCloses(260, 100), makeDates(260));
    expect(Object.keys(r).sort()).toEqual(
      ['return12M', 'return1M', 'return1W', 'return3M', 'returnYTD'].sort(),
    );
  });
});

describe('computeReturns — insufficient history → null', () => {
  it('nulls a horizon when its past endpoint does not exist', () => {
    // 6 bars: 1W has closes[5]; 1M/3M/12M do not.
    const r = computeReturns(makeCloses(6, 100, { 0: 110, 5: 100 }), makeDates(6));
    expect(r.return1W).toBe(10);
    expect(r.return1M).toBeNull();
    expect(r.return3M).toBeNull();
    expect(r.return12M).toBeNull();
  });

  it('nulls 1W when there are only 5 bars (no closes[5])', () => {
    expect(computeReturns(makeCloses(5, 100), makeDates(5)).return1W).toBeNull();
  });

  it('12M is null at exactly 252 bars and present at 253', () => {
    expect(computeReturns(makeCloses(252, 100, { 0: 120, 251: 100 }), makeDates(252)).return12M).toBeNull();
    expect(computeReturns(makeCloses(253, 100, { 0: 120, 252: 100 }), makeDates(253)).return12M).toBe(20);
  });
});

describe('computeReturns — YTD date anchor', () => {
  it('anchors on the MOST RECENT close of the prior year (last close < currentYear)', () => {
    // Newest-first. currentYear derives from dates[0] (2026). The prior-year anchor is
    // the FIRST bar with year < 2026 = 2025-12-31 (closes[2]=100), NOT 2025-12-30 (95).
    const dates = ['2026-01-03', '2026-01-02', '2025-12-31', '2025-12-30'];
    const closes = [110, 108, 100, 95];
    expect(computeReturns(closes, dates).returnYTD).toBe(10); // 110/100 - 1
  });

  it('is null when the window holds no prior-year bar', () => {
    const dates = ['2026-03-02', '2026-03-01', '2026-02-28'];
    expect(computeReturns([120, 118, 117], dates).returnYTD).toBeNull();
  });

  it('handles a year boundary across more than one prior-year bar', () => {
    // Anchor must be the LATEST prior-year close (2025-12-31 → 50), not an earlier one.
    const dates = ['2026-02-02', '2026-01-15', '2025-12-31', '2025-11-30', '2025-10-31'];
    const closes = [75, 70, 50, 48, 45];
    expect(computeReturns(closes, dates).returnYTD).toBe(50); // 75/50 - 1 = +50.00%
  });
});

describe('computeReturns — defensive guards', () => {
  it('all-null on empty or non-array input', () => {
    for (const r of [computeReturns([], []), computeReturns(null, null), computeReturns(undefined, undefined)]) {
      expect(r).toEqual({
        return1W: null, return1M: null, return3M: null, returnYTD: null, return12M: null,
      });
    }
  });

  it('nulls a horizon on a non-finite endpoint', () => {
    expect(computeReturns(makeCloses(10, 100, { 0: NaN }), makeDates(10)).return1W).toBeNull();
    expect(computeReturns(makeCloses(10, 100, { 0: Infinity, 5: 100 }), makeDates(10)).return1W).toBeNull();
    expect(computeReturns(makeCloses(10, 100, { 0: 110, 5: null }), makeDates(10)).return1W).toBeNull();
  });

  it('nulls a horizon on a zero or negative denominator', () => {
    expect(computeReturns(makeCloses(10, 100, { 0: 110, 5: 0 }), makeDates(10)).return1W).toBeNull();
    expect(computeReturns(makeCloses(10, 100, { 0: 110, 5: -5 }), makeDates(10)).return1W).toBeNull();
  });
});
