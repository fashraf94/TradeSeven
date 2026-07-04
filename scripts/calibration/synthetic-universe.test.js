// scripts/calibration/synthetic-universe.test.js
// Knob Calibration B2 — synthetic universe generator (golden/determinism).
import { describe, it, expect } from 'vitest';
import { makePrng, genUniverse } from './synthetic-universe.js';

describe('makePrng', () => {
  it('is deterministic and seed-dependent, in [0,1)', () => {
    const a = makePrng(42);
    const b = makePrng(42);
    const c = makePrng(43);
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA).not.toEqual([c(), c(), c()]);
    seqA.forEach((x) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    });
  });
});

describe('genUniverse', () => {
  it('throws on an unknown preset', () => {
    expect(() => genUniverse({ preset: 'nope' })).toThrow(/unknown preset/);
  });

  it('is byte-identical for the same (preset, seed)', () => {
    expect(JSON.stringify(genUniverse({ preset: 'chop', seed: 7 }))).toBe(
      JSON.stringify(genUniverse({ preset: 'chop', seed: 7 })),
    );
  });

  it('held names are stagnant (per-tick move < degen 0.1% threshold) regardless of preset', () => {
    const u = genUniverse({ preset: 'trend', seed: 7, nHeld: 3, nBench: 3, nTicks: 26 });
    for (const h of u.held) {
      for (let t = 1; t < h.ticks.length; t++) {
        const move = Math.abs(h.ticks[t].price - h.ticks[t - 1].price) / h.ticks[t - 1].price;
        expect(move).toBeLessThan(0.001);
      }
    }
  });

  it('trend bench rises on the day (net-positive average dailyPct)', () => {
    const u = genUniverse({ preset: 'trend', seed: 7, nBench: 9 });
    const avgLast = u.bench.reduce((s, b) => s + b.ticks[b.ticks.length - 1].dailyPct, 0) / u.bench.length;
    expect(avgLast).toBeGreaterThan(0);
  });

  it('atrPercentile stays within [0.05, 0.95] (drifting, bounded)', () => {
    const u = genUniverse({ preset: 'stress', seed: 3 });
    for (const s of u.symbols) {
      for (const tk of s.ticks) {
        expect(tk.atrPercentile).toBeGreaterThanOrEqual(0.05);
        expect(tk.atrPercentile).toBeLessThanOrEqual(0.95);
      }
    }
  });
});
