/**
 * breakContext — unit suite for V2 Build 3 (technical state at the flag).
 *
 * The load-bearing test here is the ORDER-ADAPTER PROOF: known CHRONOLOGICAL
 * composites go through computeContextAtFlag (whose adapter reverse-copies
 * into technicalCalculations' NEWEST-FIRST convention) and every result is
 * asserted against an independent test-local reference computed directly on
 * the chronological array — hand-rolled SMA/RSI in THIS file only (test-local
 * reference implementations are sanctioned; production copies are not,
 * BUILD_RULES §4). Fixture A is deliberately order-ASYMMETRIC so a
 * zero-reversal or double-reversal adapter cannot pass by coincidence.
 *
 * The module imports technicalCalculations.js and correlationMath.js for
 * real (call-only) — this suite exercises those integrations unmocked.
 */
import { describe, it, expect } from 'vitest';
import {
  computeContextAtFlag,
  conditionedBaseRates,
  CONDITION_MIN_INDEPENDENT,
} from './breakContext.js';
import { forwardReturns } from '../_utils/correlationMath.js';

// ==================== Test-local reference implementations ====================
// Chronological (oldest-first) SMA over the window ENDING at endIdx, and
// Wilder RSI over the full prefix [0..endIdx] — the same statistics the
// production path must produce THROUGH its newest-first adapter.

function refSMA(levels, endIdx, period) {
  if (endIdx + 1 < period) return null;
  let s = 0;
  for (let i = endIdx - period + 1; i <= endIdx; i++) s += levels[i];
  return s / period;
}

function refRSI(levels, endIdx, period = 14) {
  if (endIdx + 1 < period + 1) return null;
  const changes = [];
  for (let i = 1; i <= endIdx; i++) changes.push(levels[i] - levels[i - 1]);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const ch = changes[i];
    if (ch > 0) avgGain += ch;
    else avgLoss += -ch;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    const ch = changes[i];
    avgGain = (avgGain * (period - 1) + (ch > 0 ? ch : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (ch < 0 ? -ch : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

const refSide = (levels, c) => {
  const sma = refSMA(levels, c, 50);
  // Mirror production's 4dp SMA rounding (calculateSMA returns toFixed(4)).
  return sma == null ? null : levels[c] > Number(sma.toFixed(4)) ? 'above' : 'below';
};

// ==================== Fixtures ====================

// Fixture A — order-ASYMMETRIC side-flip: 50 HIGH levels (200) followed by a
// low rising ramp. At c = 119 the trailing 50-window mean is ~108.9 and the
// level is 113.8 → 'above'; an adapter that failed to reverse would hand
// calculateSMA the OLDEST 50 levels (mean 200) and classify 'below'. The RSI
// history is equally asymmetric (one -100 crash then steady +0.2 gains), so a
// time-flipped RSI lands far from the true value.
const FIX_A = [
  ...Array.from({ length: 50 }, () => 200),
  ...Array.from({ length: 70 }, (_, k) => 100 + 0.2 * k),
];
const FIX_A_C = FIX_A.length - 1; // 119

// Fixture B — deterministic pseudo-random walk (Lehmer, the boundary-suite
// idiom): no structure the adapter could exploit; agreement with the
// chronological reference at several anchors is the general proof.
function lehmer(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}
const genB = lehmer(20260703);
const FIX_B = (() => {
  const levels = [100];
  for (let i = 0; i < 119; i++) {
    levels.push(levels[levels.length - 1] * (1 + (genB() - 0.5) * 0.04));
  }
  return levels; // 120 chronological levels
})();

// Ramp levels for the partition math: levels[i] = 100 + i → every forward
// return is positive and hand-computable as h / (100 + c).
const RAMP = Array.from({ length: 40 }, (_, i) => 100 + i);
const RAMP_DATES = RAMP.map((_, i) => `D${i}`);
const rampFwd = (c, h) => h / (100 + c);

const ep = (c, side) => ({
  startCloseIndex: c,
  startDate: `D${c}`,
  direction: 'weakening',
  contextAtFlag: { vs50DMA: side, rsi14: side ? 50 : null, rsiZone: side ? 'neutral' : null },
});

// ==================== The order-adapter proof ====================

describe('computeContextAtFlag — order adapter proven against the chronological reference', () => {
  it('Fixture A (asymmetric): vs50DMA flips sides between the correct window and the wrong-order window', () => {
    const ctx = computeContextAtFlag(FIX_A, FIX_A_C);
    // The trailing window ending at c says 'above'…
    expect(refSide(FIX_A, FIX_A_C)).toBe('above');
    expect(ctx.vs50DMA).toBe('above');
    // …and the fixture DISCRIMINATES: the window a non-reversing adapter
    // would read (the oldest 50 levels, mean 200) classifies 'below'.
    const wrongWindowMean = refSMA(FIX_A, 49, 50); // levels[0..49]
    expect(FIX_A[FIX_A_C] > wrongWindowMean).toBe(false);
  });

  it('Fixture A: rsi14/rsiZone match the chronological reference (2dp production rounding)', () => {
    const ctx = computeContextAtFlag(FIX_A, FIX_A_C);
    const ref = refRSI(FIX_A, FIX_A_C, 14);
    expect(ctx.rsi14).toBeCloseTo(ref, 1);
    expect(ctx.rsiZone).toBe(ref >= 70 ? 'overbought' : ref <= 30 ? 'oversold' : 'neutral');
  });

  it.each([[49], [60], [100], [119]])(
    'Fixture B (random walk): stamps at c=%i agree with the reference',
    (c) => {
      const ctx = computeContextAtFlag(FIX_B, c);
      expect(ctx.vs50DMA).toBe(refSide(FIX_B, c));
      const ref = refRSI(FIX_B, c, 14);
      expect(ctx.rsi14).toBeCloseTo(ref, 1);
      expect(ctx.rsiZone).toBe(ref >= 70 ? 'overbought' : ref <= 30 ? 'oversold' : 'neutral');
    }
  );

  it('never mutates the caller\'s chronological levels (reverse-COPY, not reverse)', () => {
    const levels = [...FIX_B];
    computeContextAtFlag(levels, 100);
    expect(levels).toEqual(FIX_B);
  });
});

describe('computeContextAtFlag — null conventions (pinned to the module, Phase 0-lite)', () => {
  it('vs50DMA needs 50 levels INCLUDING c: null at c=48, valued at c=49', () => {
    const flat = Array.from({ length: 60 }, () => 100);
    expect(computeContextAtFlag(flat, 48).vs50DMA).toBeNull();
    // 50 flat levels: level === SMA → 'below' (the classifyTrend not-above
    // convention — equality is never 'above').
    expect(computeContextAtFlag(flat, 49).vs50DMA).toBe('below');
  });

  it('rsi14 needs 15 levels INCLUDING c: null at c=13, valued at c=14', () => {
    expect(computeContextAtFlag(FIX_B, 13).rsi14).toBeNull();
    expect(computeContextAtFlag(FIX_B, 13).rsiZone).toBeNull();
    expect(computeContextAtFlag(FIX_B, 14).rsi14).not.toBeNull();
    expect(computeContextAtFlag(FIX_B, 14).rsiZone).not.toBeNull();
  });

  it('an early episode (c < 14) stamps all-null — never a guessed state', () => {
    expect(computeContextAtFlag(FIX_B, 10)).toEqual({ vs50DMA: null, rsi14: null, rsiZone: null });
  });

  it('c in [14, 48] stamps RSI but not vs50DMA (per-indicator independence)', () => {
    const ctx = computeContextAtFlag(FIX_B, 30);
    expect(ctx.vs50DMA).toBeNull();
    expect(ctx.rsi14).toBeCloseTo(refRSI(FIX_B, 30, 14), 1);
  });

  it('degenerate input (bad c, non-array levels) returns the all-null context', () => {
    const allNull = { vs50DMA: null, rsi14: null, rsiZone: null };
    expect(computeContextAtFlag(FIX_B, -1)).toEqual(allNull);
    expect(computeContextAtFlag(FIX_B, FIX_B.length)).toEqual(allNull);
    expect(computeContextAtFlag(FIX_B, 10.5)).toEqual(allNull);
    expect(computeContextAtFlag(null, 60)).toEqual(allNull);
  });

  it('a corrupt (non-finite) level anywhere in the prefix nulls EVERY stamp — never a guessed side', () => {
    // Unguarded, a NaN in the SMA window propagates to `level > NaN` = false
    // → a confident 'below'; a NaN change reads as a flat day in Wilder RSI.
    const corrupt = [...FIX_B];
    corrupt[20] = NaN; // inside both the RSI history and the 50-window at c=60
    expect(computeContextAtFlag(corrupt, 60)).toEqual({ vs50DMA: null, rsi14: null, rsiZone: null });
    // Corruption AFTER c sits outside the prefix and must not null the stamp.
    const laterCorrupt = [...FIX_B];
    laterCorrupt[80] = NaN;
    expect(computeContextAtFlag(laterCorrupt, 60).vs50DMA).not.toBeNull();
    expect(computeContextAtFlag(laterCorrupt, 60).rsi14).not.toBeNull();
  });
});

// ==================== Conditioned base rates ====================

describe('conditionedBaseRates — partition membership (null stamps join neither side)', () => {
  it('splits by each episode\'s own vs50DMA; null-stamp and stamp-less episodes are excluded from BOTH partitions', () => {
    const episodes = [
      ep(5, 'below'),
      ep(6, 'above'),
      ep(7, null), // stamped null — excluded
      { startCloseIndex: 8, startDate: 'D8', direction: 'weakening' }, // pre-Build-3 shape, no contextAtFlag — excluded
      ep(9, 'below'),
    ];
    const out = conditionedBaseRates(RAMP, RAMP_DATES, episodes, [5]);
    // below: c=5 and c=9 — both eligible; the within-partition walk clusters
    // c=9 (its [9,14] window overlaps c=5's [5,10]).
    expect(out.below50DMA[5].eligibleCount).toBe(2);
    expect(out.below50DMA[5].independentCount).toBe(1);
    // above: only c=6 — independent in ITS OWN walk even though it overlaps
    // the below-side c=5 window (independence is within-condition).
    expect(out.above50DMA[5].eligibleCount).toBe(1);
    expect(out.above50DMA[5].independentCount).toBe(1);
    // The two excluded episodes appear in NEITHER count: 2 + 1 eligible from 5 episodes.
    expect(out.below50DMA[5].eligibleCount + out.above50DMA[5].eligibleCount).toBe(3);
  });

  it('carries EXACTLY the five aggregate fields per horizon block (no details leak)', () => {
    const out = conditionedBaseRates(RAMP, RAMP_DATES, [ep(5, 'below')], [5, 10, 20]);
    for (const key of ['below50DMA', 'above50DMA']) {
      expect(Object.keys(out[key]).map(Number).sort((a, b) => a - b)).toEqual([5, 10, 20]);
      for (const h of [5, 10, 20]) {
        expect(Object.keys(out[key][h]).sort()).toEqual(
          ['eligibleCount', 'hitRate', 'independentCount', 'mean', 'median'].sort()
        );
      }
    }
  });
});

describe('conditionedBaseRates — the tier gate in-data (no median under 3 independent)', () => {
  it('a partition with 2 independent renders counts but NULL mean/median/hitRate', () => {
    // c=5 and c=20 at h=5: windows [5,10] and [20,25] — both independent.
    const out = conditionedBaseRates(RAMP, RAMP_DATES, [ep(5, 'below'), ep(20, 'below')], [5]);
    const block = out.below50DMA[5];
    expect(block.eligibleCount).toBe(2);
    expect(block.independentCount).toBe(2);
    expect(CONDITION_MIN_INDEPENDENT).toBe(3);
    expect(block.mean).toBeNull();
    expect(block.median).toBeNull();
    expect(block.hitRate).toBeNull();
  });

  it('a partition reaching 3 independent carries the hand-computed stats', () => {
    // c = 5, 15, 25 at h=5: windows [5,10], [15,20], [25,30] — all independent.
    const cs = [5, 15, 25];
    const out = conditionedBaseRates(RAMP, RAMP_DATES, cs.map((c) => ep(c, 'below')), [5]);
    const block = out.below50DMA[5];
    expect(block.eligibleCount).toBe(3);
    expect(block.independentCount).toBe(3);
    const fwd = cs.map((c) => rampFwd(c, 5)).sort((a, b) => a - b);
    expect(block.median).toBeCloseTo(fwd[1], 12);
    expect(block.mean).toBeCloseTo((fwd[0] + fwd[1] + fwd[2]) / 3, 12);
    expect(block.hitRate).toBe(1); // the ramp only rises
    // The other side stays an honest zero-count block with null stats.
    expect(out.above50DMA[5]).toEqual({
      eligibleCount: 0,
      independentCount: 0,
      mean: null,
      median: null,
      hitRate: null,
    });
  });

  it('episodes past the horizon end are excluded per partition (the forwardReturns eligibility rule)', () => {
    // c=38 at h=5 needs closes[43] — beyond the 40-level ramp → ineligible.
    const out = conditionedBaseRates(RAMP, RAMP_DATES, [ep(38, 'below')], [5]);
    expect(out.below50DMA[5].eligibleCount).toBe(0);
    expect(out.below50DMA[5].independentCount).toBe(0);
  });
});

describe('conditionedBaseRates — null-never-zero on invalid input', () => {
  it('non-array episodes → null; corrupt levels → null (forwardReturns null propagates)', () => {
    expect(conditionedBaseRates(RAMP, RAMP_DATES, null, [5])).toBeNull();
    expect(conditionedBaseRates(['x', 'y'], ['D0', 'D1'], [ep(0, 'below')], [5])).toBeNull();
    expect(conditionedBaseRates(RAMP, RAMP_DATES.slice(0, 10), [ep(5, 'below')], [5])).toBeNull(); // dates length mismatch
  });

  it('defaults to the pinned [5, 10, 20] horizons — forwardReturns\' OWN default (one home, no drift)', () => {
    const episodes = [ep(5, 'below')];
    const out = conditionedBaseRates(RAMP, RAMP_DATES, episodes);
    expect(Object.keys(out.below50DMA).map(Number).sort((a, b) => a - b)).toEqual([5, 10, 20]);
    // Parity pin: an omitted horizons argument falls through to
    // forwardReturns' default parameter, so the conditioned blocks carry
    // exactly the horizons the unconditioned baseRates blocks carry.
    const fr = forwardReturns(RAMP, RAMP_DATES, episodes);
    expect(Object.keys(out.below50DMA).sort()).toEqual(Object.keys(fr).sort());
  });
});
