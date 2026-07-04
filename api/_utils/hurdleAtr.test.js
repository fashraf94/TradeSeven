// api/_utils/hurdleAtr.test.js
// Knob Calibration Task A — narrow hurdle-only ATR freshening (pure helper).
import { describe, it, expect } from 'vitest';
import {
  atrFromPercentile,
  buildFreshAtrPercentileMap,
  resolveHurdleAtr,
  ATR_PERCENTILE_TO_BASEATR,
} from './hurdleAtr.js';

describe('atrFromPercentile', () => {
  it('applies the canonical 8x mapping (mirrors tournamentUserScoring.js:99 / agent-evaluate.js:874)', () => {
    expect(ATR_PERCENTILE_TO_BASEATR).toBe(8);
    expect(atrFromPercentile(0.5)).toBe(4);
    expect(atrFromPercentile(1)).toBe(8);
    expect(atrFromPercentile(0)).toBe(0); // derivable, but not a usable divisor (gate is in resolveHurdleAtr)
  });

  it('returns null for negative, NaN, or non-number input', () => {
    expect(atrFromPercentile(-0.1)).toBeNull();
    expect(atrFromPercentile(NaN)).toBeNull();
    expect(atrFromPercentile(undefined)).toBeNull();
    expect(atrFromPercentile('0.5')).toBeNull();
  });
});

describe('buildFreshAtrPercentileMap', () => {
  it('maps symbol→atrPercentile, skipping malformed entries and non-arrays', () => {
    const m = buildFreshAtrPercentileMap([
      { symbol: 'AAA', atrPercentile: 0.5 },
      { symbol: 'BBB' }, // no atrPercentile → skip
      { atrPercentile: 0.7 }, // no symbol → skip
      null,
    ]);
    expect(m.get('AAA')).toBe(0.5);
    expect(m.has('BBB')).toBe(false);
    expect(m.size).toBe(1);
    expect(buildFreshAtrPercentileMap(null).size).toBe(0);
    expect(buildFreshAtrPercentileMap(undefined).size).toBe(0);
  });
});

describe('resolveHurdleAtr', () => {
  const map = buildFreshAtrPercentileMap([
    { symbol: 'FRESH', atrPercentile: 0.5 },
    { symbol: 'ZERO', atrPercentile: 0 },
  ]);

  it('uses the freshly-derived ATR when the symbol is in the rankings', () => {
    expect(resolveHurdleAtr('FRESH', map, 2.5)).toEqual({ atr: 4, source: 'fresh' });
  });

  it('falls back to the frozen value VERBATIM when the symbol is absent (byte-identical to pre-fix)', () => {
    expect(resolveHurdleAtr('MISSING', map, 2.5)).toEqual({ atr: 2.5, source: 'frozen' });
    expect(resolveHurdleAtr('MISSING', map, undefined)).toEqual({ atr: undefined, source: 'frozen' });
  });

  it('falls back to frozen when the fresh percentile derives a non-positive ATR', () => {
    expect(resolveHurdleAtr('ZERO', map, 3.1)).toEqual({ atr: 3.1, source: 'frozen' });
  });

  it('handles a non-Map lookup by falling back to frozen (defensive)', () => {
    expect(resolveHurdleAtr('FRESH', null, 2.5)).toEqual({ atr: 2.5, source: 'frozen' });
  });
});
