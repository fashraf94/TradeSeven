// api/_utils/axisDerivation.test.js
//
// Archetype Rank Interface V2 — spec §5 tests 1 + 2 (+ the Phase A half of 12):
//   1. per-axis derivation incl. N = 1, tie-aware `strength`, direction, 1-dp rounding
//   2. `axes` invariant: every non-null field is a number in [0, 100]; raw gate
//      fields never inside `axes`
//  12. (Phase A half) derivation is a pure function of the persisted shape —
//      byte-identical across a JSON round trip and unaffected by an attached
//      `axes` object — so the producer and the scorer's fallback cannot differ.
// Zero mocks: this module has zero imports.

import { describe, it, expect } from 'vitest';
import {
  deriveAxes,
  tieAwarePercentiles,
  computeUniverseMedianReturn1W,
  countAxisNulls,
  round1,
  AXIS_KEYS,
  AXES_FORMULA_VERSION,
  DISLOCATION_WEIGHTS,
} from './axisDerivation.js';

// A persisted-shape stockRankings entry (the compute-index-intelligence.js
// stockEntry fields the axes read), with overrides.
function stock(overrides = {}) {
  return {
    symbol: 'X',
    sectorName: 'Technology',
    fundamentalScore: 60,
    technicalScore: 70,
    momentumScore: 55,
    atrPercentile: 0.37,
    techRaw: { rsi: 55.2, bbPercentB: 0.61, distTo52wkHigh: 4.2, atrPercent: 2.1 },
    return1W: 1.5,
    return1M: -3.2,
    return3M: 8.1,
    sma200_position: 5.5,
    ...overrides,
  };
}

describe('tieAwarePercentiles (P-9)', () => {
  it('spreads distinct values 0..100 and gives ties the mean of their shared ranks', () => {
    expect(tieAwarePercentiles([10, 20, 30])).toEqual([0, 50, 100]);
    expect(tieAwarePercentiles([10, 10, 20])).toEqual([25, 25, 100]);
    expect(tieAwarePercentiles([20, 10, 10])).toEqual([100, 25, 25]);
  });
  it('N = 1 → 100; nulls stay null and do not count toward N', () => {
    expect(tieAwarePercentiles([5])).toEqual([100]);
    expect(tieAwarePercentiles([null, 4, 2])).toEqual([null, 100, 0]);
    expect(tieAwarePercentiles([null, undefined, NaN])).toEqual([null, null, null]);
    expect(tieAwarePercentiles([])).toEqual([]);
  });
  it('treats -0 and 0 as one tie run', () => {
    expect(tieAwarePercentiles([-0, 0, 1])).toEqual([25, 25, 100]);
  });
});

describe('deriveAxes — per-axis derivation (test 1)', () => {
  it('quality and persistence pass through; volatility = atrPercentile × 100; calm mirrors it', () => {
    const [axes] = deriveAxes([stock()]);
    expect(axes.quality).toBe(60);
    expect(axes.persistence).toBe(55);
    expect(axes.volatility).toBe(37);
    expect(axes.calm).toBe(63);
    expect(axes.volatility + axes.calm).toBe(100);
  });

  it('N = 1 → strength 100 and dislocation 100', () => {
    const [axes] = deriveAxes([stock()]);
    expect(axes.strength).toBe(100);
    expect(axes.dislocation).toBe(100);
  });

  it('strength is a tie-aware percentile of technicalScore (not list order)', () => {
    const u = [
      stock({ symbol: 'A', technicalScore: 80 }),
      stock({ symbol: 'B', technicalScore: 80 }),
      stock({ symbol: 'C', technicalScore: 60 }),
    ];
    const axes = deriveAxes(u);
    expect(axes.map((a) => a.strength)).toEqual([75, 75, 0]);
    // reversing the list order changes nothing but the alignment
    const rev = deriveAxes([...u].reverse());
    expect(rev.map((a) => a.strength)).toEqual([0, 75, 75]);
  });

  it('direction: a higher technicalScore ranks higher; a more negative return1M is MORE dislocated', () => {
    const [lo, hi] = deriveAxes([stock({ symbol: 'LO', technicalScore: 40 }), stock({ symbol: 'HI', technicalScore: 90 })]);
    expect(hi.strength).toBeGreaterThan(lo.strength);
    const [down, up] = deriveAxes([
      stock({ symbol: 'DOWN', return1M: -10, return3M: -12, sma200_position: -8 }),
      stock({ symbol: 'UP', return1M: 10, return3M: 12, sma200_position: 8 }),
    ]);
    expect(down.dislocation).toBe(100);
    expect(up.dislocation).toBe(0);
  });

  it('dislocation blends the three negated percentiles 0.5 / 0.3 / 0.2 before the outer percentile', () => {
    expect(DISLOCATION_WEIGHTS).toEqual({ return1M: 0.5, return3M: 0.3, sma200_position: 0.2 });
    // A is worst on 1M (weight .5) but best on 3M and SMA; B the mirror. Three
    // names so the blend has room to differ from any single term.
    const u = [
      stock({ symbol: 'A', return1M: -20, return3M: 30, sma200_position: 30 }),
      stock({ symbol: 'B', return1M: 20, return3M: -30, sma200_position: -30 }),
      stock({ symbol: 'C', return1M: 0, return3M: 0, sma200_position: 0 }),
    ];
    // blends: A = .5·100 + .3·0 + .2·0 = 50 ; B = .5·0 + .3·100 + .2·100 = 50 ; C = 50·(.5+.3+.2) = 50 → all tie → 50 each
    const axes = deriveAxes(u);
    expect(axes.map((a) => a.dislocation)).toEqual([50, 50, 50]);
  });

  it('rounds every axis to 1 dp (and never emits -0)', () => {
    const axes = deriveAxes([
      stock({ symbol: 'A', technicalScore: 10 }),
      stock({ symbol: 'B', technicalScore: 20 }),
      stock({ symbol: 'C', technicalScore: 30 }),
      stock({ symbol: 'D', technicalScore: 40 }),
    ]);
    expect(axes.map((a) => a.strength)).toEqual([0, 33.3, 66.7, 100]);
    for (const a of axes) for (const k of AXIS_KEYS) if (a[k] != null) expect(Object.is(a[k], -0)).toBe(false);
    expect(round1(-0.04)).toBe(0);
    expect(Object.is(round1(-0.04), -0)).toBe(false);
    expect(round1(37.00000000000001)).toBe(37);
  });

  it('null inputs yield null axes — nothing is imputed (R10)', () => {
    const [axes] = deriveAxes([stock({
      fundamentalScore: null, technicalScore: null, momentumScore: null, atrPercentile: null,
      return1M: null, return3M: null, sma200_position: null,
    })]);
    for (const k of AXIS_KEYS) expect(axes[k]).toBeNull();
  });

  it('dislocation is null when ANY of its three inputs is null (< 200 bars ⇒ null); the name still counts toward the inner percentiles it has (P-9 literal)', () => {
    const u = [
      stock({ symbol: 'THIN', sma200_position: null, return1M: -50 }),
      stock({ symbol: 'A', return1M: -5, return3M: -5, sma200_position: -5 }),
      stock({ symbol: 'B', return1M: 5, return3M: 5, sma200_position: 5 }),
    ];
    const axes = deriveAxes(u);
    expect(axes[0].dislocation).toBeNull();
    expect(axes[1].dislocation).toBe(100);
    expect(axes[2].dislocation).toBe(0);
    // Spec-literal pools: P(−10, 40, 0), Q(0, −30, 0), R(10, 10, −10) plus three names with
    // returns but no SMA-200. return1M pool = all six → P 100 / Q 20 / R 0; return3M pool =
    // all six → P 60 / Q 100 / R 80; sma pool = {P, Q, R} → P 25 / Q 25 / R 100.
    // Blends: P 73, Q 45, R 44 → outer percentile P 100, Q 50, R 0. (A complete-set pool
    // would give Q 100 / P 50 / R 0 — the reading the review rejected.)
    const literal = deriveAxes([
      stock({ symbol: 'P', return1M: -10, return3M: 40, sma200_position: 0 }),
      stock({ symbol: 'Q', return1M: 0, return3M: -30, sma200_position: 0 }),
      stock({ symbol: 'R', return1M: 10, return3M: 10, sma200_position: -10 }),
      stock({ symbol: 'N1', return1M: -5, return3M: 50, sma200_position: null }),
      stock({ symbol: 'N2', return1M: -6, return3M: 60, sma200_position: null }),
      stock({ symbol: 'N3', return1M: -7, return3M: 70, sma200_position: null }),
    ]);
    expect(literal.map((a) => a.dislocation)).toEqual([100, 50, 0, null, null, null]);
  });

  it('volatility honours the raw ATR (P-10 / V-2): techRaw.atrPercent null ⇒ null; techRaw absent ⇒ persisted atrPercentile', () => {
    const [gated] = deriveAxes([stock({ techRaw: { rsi: 50, bbPercentB: 0.5, distTo52wkHigh: 3, atrPercent: null } })]);
    expect(gated.volatility).toBeNull();
    expect(gated.calm).toBeNull();
    const preAxes = stock();
    delete preAxes.techRaw;
    const [legacy] = deriveAxes([preAxes]);
    expect(legacy.volatility).toBe(37);
    expect(legacy.calm).toBe(63);
  });

  it('catalyst and sectorStanding are reserved — always null in V2', () => {
    const [axes] = deriveAxes([stock()]);
    expect(axes.catalyst).toBeNull();
    expect(axes.sectorStanding).toBeNull();
  });

  it('does not mutate its input and tolerates a non-array', () => {
    const u = [stock()];
    const before = JSON.stringify(u);
    deriveAxes(u);
    expect(JSON.stringify(u)).toBe(before);
    expect(deriveAxes(null)).toEqual([]);
    expect(deriveAxes(undefined)).toEqual([]);
  });

  it('exports formula version 1', () => {
    expect(AXES_FORMULA_VERSION).toBe(1);
  });
});

// Deterministic pseudo-random fixture (LCG) — 60 names, ~15% nulls per field.
function fixtureUniverse(n = 60, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const maybeNull = (v) => (rnd() < 0.15 ? null : v);
  const sectors = ['Technology', 'Healthcare', 'Energy', 'Financials', 'Utilities', null];
  const out = [];
  for (let i = 0; i < n; i++) {
    const atrPct = Math.round(rnd() * 100) / 100;
    out.push({
      symbol: `S${i}`,
      sectorName: sectors[i % sectors.length],
      fundamentalScore: maybeNull(Math.round(rnd() * 100)),
      technicalScore: maybeNull(Math.round(rnd() * 100)),
      momentumScore: maybeNull(Math.round(rnd() * 100)),
      atrPercentile: atrPct,
      techRaw: { rsi: 50, bbPercentB: 0.5, distTo52wkHigh: 5, atrPercent: maybeNull(Number((rnd() * 6).toFixed(2))) },
      return1W: maybeNull(Number(((rnd() - 0.5) * 20).toFixed(2))),
      return1M: maybeNull(Number(((rnd() - 0.5) * 60).toFixed(2))),
      return3M: maybeNull(Number(((rnd() - 0.5) * 100).toFixed(2))),
      sma200_position: maybeNull(Number(((rnd() - 0.5) * 80).toFixed(2))),
    });
  }
  return out;
}

describe('axes invariant (test 2)', () => {
  it('every non-null field is a number in [0, 100] rounded to 1 dp; exactly the AXIS_KEYS; no raw gate fields', () => {
    const axesList = deriveAxes(fixtureUniverse());
    expect(axesList).toHaveLength(60);
    for (const axes of axesList) {
      expect(Object.keys(axes).sort()).toEqual([...AXIS_KEYS].sort());
      expect(axes).not.toHaveProperty('return1W');
      expect(axes).not.toHaveProperty('return1M');
      for (const k of AXIS_KEYS) {
        const v = axes[k];
        if (v === null) continue;
        expect(typeof v).toBe('number');
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
        expect(round1(v)).toBe(v);
      }
    }
  });

  it('a null in any weighted input surfaces as a null axis, never a number', () => {
    const u = fixtureUniverse();
    const axesList = deriveAxes(u);
    u.forEach((s, i) => {
      if (s.fundamentalScore == null) expect(axesList[i].quality).toBeNull();
      if (s.technicalScore == null) expect(axesList[i].strength).toBeNull();
      if (s.momentumScore == null) expect(axesList[i].persistence).toBeNull();
      if (s.techRaw.atrPercent == null) { expect(axesList[i].volatility).toBeNull(); expect(axesList[i].calm).toBeNull(); }
      if (s.return1M == null || s.return3M == null || s.sma200_position == null) expect(axesList[i].dislocation).toBeNull();
    });
  });
});

describe('persisted-shape parity (the Phase A half of test 12)', () => {
  it('is byte-identical across a JSON round trip and ignores an already-attached axes object', () => {
    const u = fixtureUniverse();
    const first = deriveAxes(u);
    const roundTripped = deriveAxes(JSON.parse(JSON.stringify(u)));
    expect(roundTripped).toEqual(first);
    const withAxes = u.map((s, i) => ({ ...s, axes: first[i] }));
    expect(deriveAxes(withAxes)).toEqual(first);
    expect(JSON.stringify(deriveAxes(withAxes))).toBe(JSON.stringify(first));
  });
});

describe('computeUniverseMedianReturn1W (P-13 doc-level field)', () => {
  it('uses the repo median convention (sorted ascending, upper-middle) over non-null values', () => {
    expect(computeUniverseMedianReturn1W([stock({ return1W: 3 }), stock({ return1W: -1 }), stock({ return1W: 2 })])).toBe(2);
    expect(computeUniverseMedianReturn1W([stock({ return1W: 4 }), stock({ return1W: 1 }), stock({ return1W: 3 }), stock({ return1W: 2 })])).toBe(3);
    expect(computeUniverseMedianReturn1W([stock({ return1W: -2 }), stock({ return1W: -5 })])).toBe(-2);
    expect(computeUniverseMedianReturn1W([stock({ return1W: null }), stock({ return1W: -4.25 })])).toBe(-4.25);
  });
  it('is null on an empty or all-null universe', () => {
    expect(computeUniverseMedianReturn1W([])).toBeNull();
    expect(computeUniverseMedianReturn1W([stock({ return1W: null })])).toBeNull();
    expect(computeUniverseMedianReturn1W(null)).toBeNull();
  });
});

describe('countAxisNulls', () => {
  it('counts nulls per axis over an axes list', () => {
    const counts = countAxisNulls(deriveAxes([stock(), stock({ fundamentalScore: null, sma200_position: null })]));
    expect(counts.quality).toBe(1);
    expect(counts.dislocation).toBe(1);
    expect(counts.strength).toBe(0);
    expect(counts.catalyst).toBe(2);
    expect(counts.sectorStanding).toBe(2);
  });
});
