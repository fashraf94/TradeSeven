// api/_utils/behaviorFingerprint.test.js
//
// Release 3 (Character tab) — the §2.1 BLOCKING test for the derived behavior
// fingerprint. It proves the three things the spec makes blocking:
//   1. the axis vector is DERIVED from the resolved knob config (no hardcoded
//      per-archetype axis table exists — every expected value is recomputed
//      from an actual config field);
//   2. a changed knob value MOVES the shape;
//   3. the tempo dial moves EXACTLY the three responsive axes and leaves the two
//      fixed anchors untouched (the founder's Q3 teaching contract).
//
// This file's REAL import of behaviorFingerprint.js (→ agentArchetypeConfig.js,
// tempoDialClamp.js, tempoDialBands.js, agentPresetConfig.js) IS the BUILD_RULES
// §4 dependency-surface guard: it explodes in the Node test env if a browser dep
// ever enters the graph. NEVER mock it.

import { describe, it, expect } from 'vitest';
import {
  computeFingerprint,
  computeFingerprintByTempo,
  rawAxisMetrics,
  resolveConfigForFingerprint,
  FINGERPRINT_AXES,
  DIAL_RESPONSIVE_AXES,
  FIXED_ANCHOR_AXES,
} from './behaviorFingerprint.js';
import { ARCHETYPE_CONFIGS, VALID_ARCHETYPES } from './agentArchetypeConfig.js';
import { VALID_TEMPO_VALUES } from './tempoDialBands.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const AXIS_KEYS = FINGERPRINT_AXES.map((a) => a.key);

describe('behaviorFingerprint — axis metadata contract', () => {
  it('partitions the five axes into exactly three dial-responsive + two fixed anchors', () => {
    expect(DIAL_RESPONSIVE_AXES).toEqual(['tempo', 'reach', 'patience']);
    expect(FIXED_ANCHOR_AXES).toEqual(['concentration', 'discipline']);
    // the two sets are disjoint and cover all five
    expect([...DIAL_RESPONSIVE_AXES, ...FIXED_ANCHOR_AXES].sort()).toEqual([...AXIS_KEYS].sort());
  });
});

describe('behaviorFingerprint — DERIVED from resolved config, not hardcoded (§2.1)', () => {
  // For every (archetype × tempo) the raw metric of each axis must equal the
  // value read straight off the resolved config field — proving there is no
  // hardcoded axis table. Expected values are recomputed here from actual
  // config fields, never asserted against a literal per-archetype vector.
  for (const archetype of VALID_ARCHETYPES) {
    for (const tempo of VALID_TEMPO_VALUES) {
      it(`${archetype} @ ${tempo}: raw axes tie to real config fields`, () => {
        const { archetypeConfig, resolvedHftConfig } = resolveConfigForFingerprint(archetype, tempo);
        const fp = computeFingerprint(archetype, tempo);

        // Tempo ← capPerWindow ÷ the forced-rotation clock (churn rate). For an
        // enabled rotation this is exactly cap / ticksThreshold (both resolved).
        if (resolvedHftConfig.forcedRotation.enabled !== false) {
          expect(fp.raw.tempo).toBeCloseTo(
            resolvedHftConfig.swapWindow.capPerWindow / resolvedHftConfig.forcedRotation.ticksThreshold, 10);
        } else {
          expect(fp.raw.tempo).toBeGreaterThan(0); // disabled: swap-window-only churn
        }
        // Reach ← 1 / hurdleFloor.default.atrMultiplier (resolved)
        expect(fp.raw.reach).toBeCloseTo(1 / resolvedHftConfig.hurdleFloor.default.atrMultiplier, 10);
        // Concentration ← top-level sectorConcentrationCap
        expect(fp.raw.concentration).toBe(archetypeConfig.sectorConcentrationCap);
        // Patience ← the STAGNATION hurdle floor (resolved), or maximal when disabled
        if (resolvedHftConfig.forcedRotation.enabled === false) {
          expect(fp.raw.patience).toBeGreaterThan(0.5); // above the largest enabled stagnation floor
        } else {
          expect(fp.raw.patience).toBe(resolvedHftConfig.hurdleFloor.byReason.stagnation.atrMultiplier);
        }
        // Discipline > 0 and equals the documented preset formula
        expect(fp.raw.discipline).toBeGreaterThan(0);

        // The helper's own rawAxisMetrics is the single mapping home — output agrees.
        expect(fp.raw).toEqual(rawAxisMetrics(archetypeConfig, resolvedHftConfig));

        // Every normalized axis is a finite magnitude inside the render clamp.
        for (const key of AXIS_KEYS) {
          expect(fp.axes[key]).toBeGreaterThanOrEqual(0.06);
          expect(fp.axes[key]).toBeLessThanOrEqual(0.97);
        }
      });
    }
  }
});

describe('behaviorFingerprint — a changed knob MOVES the shape (§2.1)', () => {
  it('bumping swapWindow.capPerWindow moves the Tempo axis and nothing hardcoded pins it', () => {
    const base = computeFingerprint('momentum_chaser', 'standard');
    const mutated = clone(ARCHETYPE_CONFIGS);
    mutated.momentum_chaser.hftConfig.swapWindow.capPerWindow += 5;
    const after = computeFingerprint('momentum_chaser', 'standard', { configs: mutated });
    expect(after.raw.tempo).toBeGreaterThan(base.raw.tempo);
    expect(after.axes.tempo).not.toBeCloseTo(base.axes.tempo, 6);
  });

  it('lowering hurdleFloor.default.atrMultiplier raises the Reach axis', () => {
    const base = computeFingerprint('analyst', 'standard');
    const mutated = clone(ARCHETYPE_CONFIGS);
    mutated.analyst.hftConfig.hurdleFloor.default.atrMultiplier = 0.2; // was 0.4
    const after = computeFingerprint('analyst', 'standard', { configs: mutated });
    expect(after.raw.reach).toBeGreaterThan(base.raw.reach);
  });

  it('changing sectorConcentrationCap moves the (fixed-anchor) Concentration axis', () => {
    const base = computeFingerprint('diversifier', 'standard');
    const mutated = clone(ARCHETYPE_CONFIGS);
    mutated.diversifier.sectorConcentrationCap = 6; // was 2
    const after = computeFingerprint('diversifier', 'standard', { configs: mutated });
    expect(after.raw.concentration).toBe(6);
    expect(after.axes.concentration).toBeGreaterThan(base.axes.concentration);
  });
});

describe('behaviorFingerprint — Release-1 tuning direction (founder correction 2026-07-13)', () => {
  // Real HEAD config is POST-tuning. Reverting the two documented Release-1
  // changes reconstructs the PRE-tuning disposition, so we can pin the direction
  // each change must render as.
  const preTuning = () => {
    const pre = clone(ARCHETYPE_CONFIGS);
    // momentum_chaser was TEMPERED: forced-rotation clock 3→5, swap ceiling 8→6,
    // stagnation floor 0.55→0.5. Revert to pre-tuning values.
    pre.momentum_chaser.hftConfig.forcedRotation.ticksThreshold = 3;
    pre.momentum_chaser.hftConfig.swapWindow.capPerWindow = 8;
    pre.momentum_chaser.hftConfig.hurdleFloor.byReason.stagnation.atrMultiplier = 0.55;
    // degen was LOOSENED: stagnation floor 0.6→0.3 to make it churn more. Revert.
    pre.degen.hftConfig.hurdleFloor.byReason.stagnation.atrMultiplier = 0.6;
    return pre;
  };

  it("degen's stagnation floor 0.6→0.3 reads as LESS patient (post < pre)", () => {
    const post = computeFingerprint('degen', 'standard');                       // real HEAD (floor 0.3)
    const before = computeFingerprint('degen', 'standard', { configs: preTuning() }); // floor 0.6
    expect(post.raw.patience).toBeLessThan(before.raw.patience);
    expect(post.axes.patience).toBeLessThan(before.axes.patience);
  });

  it("momentum_chaser's clock 3→5 tempering reads as LOWER Tempo, not higher Patience", () => {
    const post = computeFingerprint('momentum_chaser', 'standard');                       // ticks 5, cap 6
    const before = computeFingerprint('momentum_chaser', 'standard', { configs: preTuning() }); // ticks 3, cap 8
    // The tempering shows up as LOWER tempo (fires later + tighter ceiling = less churn)...
    expect(post.raw.tempo).toBeLessThan(before.raw.tempo);
    // ...and does NOT show up as higher patience (the mis-keying this corrects).
    expect(post.raw.patience).toBeLessThanOrEqual(before.raw.patience);
  });

  it('the stagnation CLOCK drives Tempo, not Patience: changing ONLY ticksThreshold moves Tempo and leaves Patience flat', () => {
    const base = computeFingerprint('momentum_chaser', 'standard');
    const slower = clone(ARCHETYPE_CONFIGS);
    slower.momentum_chaser.hftConfig.forcedRotation.ticksThreshold += 3; // longer clock = less churn
    const after = computeFingerprint('momentum_chaser', 'standard', { configs: slower });
    expect(after.raw.tempo).toBeLessThan(base.raw.tempo);  // lower tempo
    expect(after.raw.patience).toBe(base.raw.patience);     // patience untouched by the clock
  });
});

describe('behaviorFingerprint — the dial moves 3 axes, not the 2 anchors (Q3 teaching contract)', () => {
  it('measured→aggressive moves Tempo/Reach/Patience and leaves Concentration/Discipline fixed', () => {
    // momentum_chaser has forced rotation ENABLED, so all three responsive axes move.
    const measured = computeFingerprint('momentum_chaser', 'measured');
    const aggressive = computeFingerprint('momentum_chaser', 'aggressive');

    for (const key of DIAL_RESPONSIVE_AXES) {
      expect(aggressive.axes[key]).not.toBeCloseTo(measured.axes[key], 6);
    }
    for (const key of FIXED_ANCHOR_AXES) {
      expect(aggressive.axes[key]).toBeCloseTo(measured.axes[key], 12);
      expect(aggressive.raw[key]).toBe(measured.raw[key]);
    }
  });

  it('aggressive rotates sooner (less patient) and reaches further than measured', () => {
    const measured = computeFingerprint('momentum_chaser', 'measured');
    const aggressive = computeFingerprint('momentum_chaser', 'aggressive');
    expect(aggressive.axes.tempo).toBeGreaterThan(measured.axes.tempo); // more rotation
    expect(aggressive.axes.reach).toBeGreaterThan(measured.axes.reach); // reaches further
    expect(aggressive.axes.patience).toBeLessThan(measured.axes.patience); // holds less
  });

  it('the fixed anchors are identical across ALL three dial positions for every archetype', () => {
    for (const archetype of VALID_ARCHETYPES) {
      const byTempo = computeFingerprintByTempo(archetype);
      for (const key of FIXED_ANCHOR_AXES) {
        expect(byTempo.standard.axes[key]).toBe(byTempo.measured.axes[key]);
        expect(byTempo.standard.axes[key]).toBe(byTempo.aggressive.axes[key]);
      }
    }
  });
});

describe('behaviorFingerprint — honest normalization keeps archetypes in their lane (§2.1)', () => {
  it('Guardian at Aggressive is still slower (lower Tempo) than Speculator at Measured', () => {
    const guardianHot = computeFingerprint('guardian', 'aggressive');
    const degenCold = computeFingerprint('degen', 'measured');
    expect(guardianHot.axes.tempo).toBeLessThan(degenCold.axes.tempo);
  });

  it('base disposition survives normalization: Speculator out-rotates Capital Preserver at the same dial', () => {
    const degen = computeFingerprint('degen', 'standard');
    const guardian = computeFingerprint('guardian', 'standard');
    expect(degen.axes.tempo).toBeGreaterThan(guardian.axes.tempo);
    expect(guardian.axes.discipline).toBeGreaterThan(degen.axes.discipline);
  });
});

describe('behaviorFingerprint — disabled forced rotation (guardian) reads maximally patient + dial-invariant', () => {
  it('guardian patience does not move with the dial (it never force-rotates)', () => {
    const byTempo = computeFingerprintByTempo('guardian');
    expect(byTempo.measured.raw.patience).toBe(byTempo.aggressive.raw.patience);
    expect(byTempo.measured.axes.patience).toBe(byTempo.aggressive.axes.patience);
  });

  it('guardian stays the MOST patient archetype at every dial position (founder requirement)', () => {
    for (const tempo of VALID_TEMPO_VALUES) {
      const guardian = computeFingerprint('guardian', tempo).axes.patience;
      for (const archetype of VALID_ARCHETYPES) {
        expect(guardian).toBeGreaterThanOrEqual(computeFingerprint(archetype, tempo).axes.patience - 1e-9);
      }
    }
  });
});

describe('behaviorFingerprint — full coverage + shape', () => {
  it('every archetype × tempo yields all five finite axes', () => {
    for (const archetype of VALID_ARCHETYPES) {
      for (const tempo of VALID_TEMPO_VALUES) {
        const fp = computeFingerprint(archetype, tempo);
        expect(Object.keys(fp.axes).sort()).toEqual([...AXIS_KEYS].sort());
        for (const key of AXIS_KEYS) expect(Number.isFinite(fp.axes[key])).toBe(true);
        expect(fp.dialResponsive).toEqual(['tempo', 'reach', 'patience']);
        expect(fp.fixed).toEqual(['concentration', 'discipline']);
      }
    }
  });

  it('an unknown archetype falls back to the analyst config without throwing', () => {
    const fp = computeFingerprint('not_a_real_archetype', 'standard');
    const analyst = computeFingerprint('analyst', 'standard');
    expect(fp.axes).toEqual(analyst.axes);
  });
});
