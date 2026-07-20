// api/_utils/masteryFormula.test.js
// Archetype Mastery P1 — formula acceptance (Spec V2 §4/§6, §12) at
// formulaVersion: 1 (PROVISIONAL constants — V2.1 memo §9 ruling; the
// acceptance-matrix arithmetic asserted here is EVALUATED-ON-ASSUMPTIONS
// where the live score distribution is required; recalibration at ≥100
// post-Jul-18 settled battles ships formulaVersion: 2, never retroactive).

import { describe, it, expect } from 'vitest';
import {
  FORMULA_VERSION,
  MASTERY_XP_CONSTANTS,
  MODE_MULTS,
  LEVEL_XP_THRESHOLDS,
  MAX_LEVEL,
  levelForXp,
  validateFormulaInputs,
  computeXp,
  buildAwardDoc,
  buildZeroReceipt,
  REASON_CODES,
} from './masteryFormula.js';

const C = MASTERY_XP_CONSTANTS;

describe('level curve (spec §6, D1: 10 levels, cumulative 200/500/900/1400/2000/2700/3500/4400/5400)', () => {
  it('pins the ratified thresholds', () => {
    expect(LEVEL_XP_THRESHOLDS).toEqual([0, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400]);
    expect(MAX_LEVEL).toBe(10);
  });

  it.each([
    [0, 1], [199, 1], [200, 2], [499, 2], [500, 3],
    [899, 3], [900, 4], [1400, 5], [2000, 6], [2700, 7],
    [3500, 8], [4400, 9], [5399, 9], [5400, 10], [999999, 10],
  ])('xp %i → level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });

  it('fails closed on garbage XP', () => {
    expect(levelForXp(NaN)).toBe(1);
    expect(levelForXp(-5)).toBe(1);
    expect(levelForXp(undefined)).toBe(1);
  });
});

describe('validateFormulaInputs — fail-closed (spec §4: never defaults to 1.0 mode)', () => {
  const sound = { modeKind: 'ranked', archetype: 'guardian', currentScore: 42.5, rateBand: 1.0 };

  it('accepts sound inputs for every known archetype id', () => {
    for (const arch of ['momentum_chaser', 'analyst', 'diversifier', 'contrarian', 'degen', 'guardian']) {
      expect(validateFormulaInputs({ ...sound, archetype: arch })).toBeNull();
    }
  });

  it('quarantines unknown/missing mode', () => {
    expect(validateFormulaInputs({ ...sound, modeKind: 'weird' })).toMatch(/^unknown_mode:/);
    expect(validateFormulaInputs({ ...sound, modeKind: null })).toMatch(/^unknown_mode:/);
  });

  it("quarantines alien archetypes — including the doc-shape fallback literal 'unknown'", () => {
    expect(validateFormulaInputs({ ...sound, archetype: 'unknown' })).toMatch(/^alien_archetype:/);
    expect(validateFormulaInputs({ ...sound, archetype: undefined })).toMatch(/^alien_archetype:/);
  });

  it('quarantines non-finite scores and invalid rate bands', () => {
    expect(validateFormulaInputs({ ...sound, currentScore: NaN })).toMatch(/^non_finite_score:/);
    expect(validateFormulaInputs({ ...sound, currentScore: Infinity })).toMatch(/^non_finite_score:/);
    expect(validateFormulaInputs({ ...sound, rateBand: 0.75 })).toMatch(/^invalid_rate_band:/);
    expect(validateFormulaInputs({ ...sound, rateBand: NaN })).toMatch(/^invalid_rate_band:/);
  });
});

describe('computeXp — §4 components', () => {
  const base = { modeKind: 'ranked', currentScore: 0, humansOutplaced: 0, wonAgainstField: false, isMultiDay: false, rateBand: 1.0 };

  it('PARTICIPATION is flat and unconditional for a settled eligible battle', () => {
    expect(computeXp(base).components.participation).toBe(C.PARTICIPATION);
  });

  it('PERFORMANCE floors at 0 (never negative) and clamps at CAP', () => {
    expect(computeXp({ ...base, currentScore: -80 }).components.performance).toBe(0);
    expect(computeXp({ ...base, currentScore: 40 }).components.performance).toBe(20);
    expect(computeXp({ ...base, currentScore: 500 }).components.performance).toBe(C.PERFORMANCE_CAP);
  });

  it('PLACEMENT pays strictly-outplaced humans, capped; CPU_PLACEMENT only on a strict field win', () => {
    expect(computeXp({ ...base, humansOutplaced: 1 }).components.placement).toBe(C.PLACEMENT_PER_HUMAN);
    expect(computeXp({ ...base, humansOutplaced: 3 }).components.placement).toBe(C.PLACEMENT_CAP);
    expect(computeXp({ ...base, wonAgainstField: true }).components.placement).toBe(C.CPU_PLACEMENT);
    // an engineered tie pays zero placement (neither outplaced nor strict win)
    expect(computeXp(base).components.placement).toBe(0);
  });

  it('COMPLETION pays only multi-day battles', () => {
    expect(computeXp(base).components.completion).toBe(0);
    expect(computeXp({ ...base, isMultiDay: true }).components.completion).toBe(C.COMPLETION);
  });

  it('xpFinal = round(xpBase × MODE_MULT × rateBand)', () => {
    const r = computeXp({ ...base, currentScore: 40, wonAgainstField: true, modeKind: 'training', rateBand: 0.5 });
    // base = 25 + 20 + 8 + 0 = 53; 53 × 0.6 × 0.5 = 15.9 → 16
    expect(r.xpBase).toBe(53);
    expect(r.modeMult).toBe(0.6);
    expect(r.xpFinal).toBe(16);
  });

  it('rateBand 0 (rank 7+) zeroes the final award', () => {
    expect(computeXp({ ...base, currentScore: 100, humansOutplaced: 2, rateBand: 0 }).xpFinal).toBe(0);
  });
});

describe('acceptance-matrix arithmetic (spec §4 a–e) — EVALUATED-ON-ASSUMPTIONS at formulaVersion 1', () => {
  it('(a) design-intent ranked median composition ≈ 100 (needs live k-fit: ASSUMED)', () => {
    // PARTICIPATION + design-median PERFORMANCE (~45 target) + 1v1 human win.
    expect(C.PARTICIPATION + 45 + C.PLACEMENT_PER_HUMAN).toBe(100);
  });

  it('(b) max training award < 100 even at formula-level maxima', () => {
    const maxBase = C.PARTICIPATION + C.PERFORMANCE_CAP + C.PLACEMENT_CAP + C.COMPLETION;
    expect(Math.round(maxBase * MODE_MULTS.training * 1.0)).toBeLessThan(100);
  });

  it('(e) CPU-pod first place pays less than a 1v1 human win', () => {
    expect(C.CPU_PLACEMENT).toBeLessThan(C.PLACEMENT_PER_HUMAN);
  });

  it('(d) idle single-day battle at full rate < 40 (40% of the 100 target)', () => {
    // idle: PERFORMANCE floors to 0, no placement, no completion.
    expect(C.PARTICIPATION).toBeLessThan(40);
  });

  it('(d-tension, DOCUMENTED) an idle multi-day completion breaches the 40% gate — the known v1 tension', () => {
    // 25 + 0 + 0 + 20 = 45 > 40. Multi-day creation is disabled in prod
    // (AGENT_BATTLE_DURATION_MODE 'fullday'), so v1 exposure is nil; the
    // recalibration checkpoint decides the activity predicate. This test
    // pins the tension HONESTLY so a silent constant change can't hide it.
    expect(C.PARTICIPATION + C.COMPLETION).toBe(45);
    expect(C.PARTICIPATION + C.COMPLETION).toBeGreaterThan(40);
  });
});

describe('award doc shapes (spec §5)', () => {
  it('buildAwardDoc carries the full §5 shape; optional keys are ABSENT unless set', () => {
    const award = buildAwardDoc({
      archetype: 'degen',
      components: { participation: 25, performance: 10, placement: 8, completion: 0 },
      modeMult: 1.0,
      rateBand: 1.0,
      xpFinal: 43,
      levelBefore: 1,
      levelAfter: 1,
      epochId: 1,
      settledAt: 'T',
    });
    expect(award).toEqual({
      archetype: 'degen',
      components: { participation: 25, performance: 10, placement: 8, completion: 0 },
      multipliers: { mode: 1.0, rateBand: 1.0 },
      xpFinal: 43,
      levelBefore: 1,
      levelAfter: 1,
      formulaVersion: FORMULA_VERSION,
      epochId: 1,
      settledAt: 'T',
    });
    expect('reasonCode' in award).toBe(false);
    expect('levelProvisional' in award).toBe(false);
    expect('backfilled' in award).toBe(false);
  });

  it('buildZeroReceipt is a REAL award doc: xpFinal 0, public reasonCode only, level unchanged', () => {
    const r = buildZeroReceipt({ archetype: 'guardian', reasonCode: REASON_CODES.QUARANTINED, epochId: 2, settledAt: 'T', level: 4 });
    expect(r.xpFinal).toBe(0);
    expect(r.reasonCode).toBe('quarantined');
    expect(r.levelBefore).toBe(4);
    expect(r.levelAfter).toBe(4);
    expect(r.components).toEqual({ participation: 0, performance: 0, placement: 0, completion: 0 });
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
  });

  it('the public reasonCode enum is exactly the spec §4 vocabulary', () => {
    expect(Object.values(REASON_CODES).sort()).toEqual(['daily_ceiling', 'flag_disabled', 'quarantined']);
  });
});
