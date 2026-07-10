// api/_utils/tempoDialClamp.test.js
//
// Release 2 PR-b foundations — the tempo-dial clamp layer. Expected values
// are HAND-COMPUTED from B4 §D (0.7 / 1.0 / 1.3, direction-aware) against
// the REAL resolved archetype configs — never derived from the module under
// test. This file's REAL imports (agentArchetypeConfig — fenced, called
// never edited — and the clamp graph) are the BUILD_RULES §4
// dependency-surface guard; never mock them.

import { describe, it, expect } from 'vitest';
import { getArchetypeConfig, resolveHftConfig, KNOB_CONFIG_VERSION } from './agentArchetypeConfig.js';
import { TEMPO_DIAL_BANDS, VALID_TEMPO_VALUES } from './tempoDialBands.js';
import {
  resolveTempoDial,
  applyTempoToHftConfig,
  clampHftConfig,
  TEMPO_SUPPRESSION_REASONS,
} from './tempoDialClamp.js';

const mcHft = () => resolveHftConfig(getArchetypeConfig('momentum_chaser'), 'baggerbomb_tournament');

describe('band table binding (spec changelog #13)', () => {
  it('the bands pin the CURRENTLY deployed knob generation — a knob bump/rollback must re-derive + re-pin (or accept dial-dark) BEFORE the dial ever turns on', () => {
    // If this fails after a KNOB_CONFIG_VERSION change, that is the
    // fail-closed discipline working: the clamp is already suppressing to
    // standard at runtime; fix by re-deriving the bands against the new knob
    // table and re-pinning forKnobConfigVersion — never by loosening this.
    expect(TEMPO_DIAL_BANDS.forKnobConfigVersion).toBe(KNOB_CONFIG_VERSION);
  });

  it('carries exactly the B4 §D provisional multipliers', () => {
    expect(TEMPO_DIAL_BANDS.multipliers).toEqual({ measured: 0.7, standard: 1.0, aggressive: 1.3 });
    expect(VALID_TEMPO_VALUES).toEqual(['measured', 'standard', 'aggressive']);
  });
});

describe('resolveTempoDial — desired → effective (fail closed, never silent)', () => {
  it('absent dial → default standard, selectionSource "default" (distinguishable from explicit standard)', () => {
    const r = resolveTempoDial({ desiredTempo: undefined, dialEnabled: true });
    expect(r.effectiveTempo).toBe('standard');
    expect(r.provenance).toEqual({
      tempoDesired: 'standard',
      tempoEffective: 'standard',
      selectionSource: 'default',
      dialBandVersion: 2,
      knobConfigVersion: KNOB_CONFIG_VERSION,
    });
    expect('suppressionReason' in r.provenance).toBe(false);
  });

  it('EXPLICIT standard → selectionSource "user_dial" (the PR-b distinguishability blocker)', () => {
    const r = resolveTempoDial({ desiredTempo: 'standard', dialEnabled: true });
    expect(r.effectiveTempo).toBe('standard');
    expect(r.provenance.selectionSource).toBe('user_dial');
    expect('suppressionReason' in r.provenance).toBe(false);
  });

  it('non-standard + dial ON + version match → dial-attributed effective', () => {
    const r = resolveTempoDial({ desiredTempo: 'aggressive', dialEnabled: true });
    expect(r.effectiveTempo).toBe('aggressive');
    expect(r.multiplier).toBe(1.3);
    expect(r.provenance).toMatchObject({
      tempoDesired: 'aggressive',
      tempoEffective: 'aggressive',
      selectionSource: 'user_dial',
      dialBandVersion: 2,
    });
  });

  it('non-standard + dial OFF → effective standard + suppressionReason dial_disabled (desired kept)', () => {
    const r = resolveTempoDial({ desiredTempo: 'aggressive', dialEnabled: false });
    expect(r.effectiveTempo).toBe('standard');
    expect(r.provenance).toMatchObject({
      tempoDesired: 'aggressive',
      tempoEffective: 'standard',
      suppressionReason: TEMPO_SUPPRESSION_REASONS.DIAL_DISABLED,
    });
  });

  it.each([
    ['missing/older deployed version', 1],
    ['future deployed version (Release-1 rollback mints v3)', 3],
  ])('non-standard + %s → fail closed to standard + band_version_mismatch', (_label, deployed) => {
    const r = resolveTempoDial({ desiredTempo: 'measured', dialEnabled: true, deployedKnobConfigVersion: deployed });
    expect(r.effectiveTempo).toBe('standard');
    expect(r.provenance.suppressionReason).toBe(TEMPO_SUPPRESSION_REASONS.BAND_VERSION_MISMATCH);
    expect(r.provenance.knobConfigVersion).toBe(deployed);
    expect(r.provenance.dialBandVersion).toBe(2);
  });

  it('garbage in the snapshot fails closed + visible (unknown_tempo_value)', () => {
    const r = resolveTempoDial({ desiredTempo: 'turbo', dialEnabled: true });
    expect(r.effectiveTempo).toBe('standard');
    expect(r.provenance.suppressionReason).toBe(TEMPO_SUPPRESSION_REASONS.UNKNOWN_TEMPO_VALUE);
  });
});

describe('applyTempoToHftConfig — identity when standard (off-state invariant BY CONSTRUCTION)', () => {
  it('returns the SAME reference for standard / multiplier 1.0 / null config', () => {
    const cfg = mcHft();
    expect(applyTempoToHftConfig(cfg, 'standard', 1.0)).toBe(cfg);
    expect(applyTempoToHftConfig(cfg, 'aggressive', 1.0)).toBe(cfg);
    expect(applyTempoToHftConfig(null, 'aggressive', 1.3)).toBeNull();
  });

  it('clampHftConfig is reference-identical under every suppressed/default/standard state', () => {
    const cfg = mcHft();
    for (const args of [
      { desiredTempo: undefined, dialEnabled: false },                              // default, dial off
      { desiredTempo: undefined, dialEnabled: true },                               // default, dial on
      { desiredTempo: 'standard', dialEnabled: true },                              // explicit standard
      { desiredTempo: 'aggressive', dialEnabled: false },                           // suppressed: flag
      { desiredTempo: 'aggressive', dialEnabled: true, deployedKnobConfigVersion: 3 }, // suppressed: version
      { desiredTempo: 'turbo', dialEnabled: true },                                 // suppressed: garbage
    ]) {
      expect(clampHftConfig({ hftConfig: cfg, ...args }).hftConfig).toBe(cfg);
    }
  });
});

describe('direction-aware application — hand-computed B4 §D expectations on the REAL momentum_chaser config', () => {
  // Real B4-tuned mc values @ 4a0f43e: ticksThreshold 5, capPerWindow 6,
  // floors haiku 0.35 / stagnation 0.5 / default 0.35.

  it('AGGRESSIVE (×1.3): caps multiply, thresholds/floors divide, safety verbatim — full-population deep-equal (merge-not-replace)', () => {
    const cfg = mcHft();
    const { hftConfig: out, provenance } = clampHftConfig({ hftConfig: cfg, desiredTempo: 'aggressive', dialEnabled: true });
    expect(out).not.toBe(cfg);
    expect(out).toEqual({
      forcedRotation: {
        enabled: true,            // safety — verbatim
        pctThreshold: 0.0015,     // safety — verbatim
        ticksThreshold: 4,        // round(5 ÷ 1.3) = round(3.846)
        maxTickAgeMinutes: 20,    // safety — verbatim
        winnerThreshold: 0.0015,  // safety — verbatim
      },
      hurdleFloor: {
        enabled: true,            // safety — verbatim
        byReason: {
          haiku_decision: { atrMultiplier: 0.27 }, // round2(0.35 ÷ 1.3)
          stagnation: { atrMultiplier: 0.38 },     // round2(0.5 ÷ 1.3)
        },
        default: { atrMultiplier: 0.27 },          // round2(0.35 ÷ 1.3)
        requireBenchPositive: true,                // safety — verbatim
      },
      swapWindow: {
        enabled: true,            // safety — verbatim
        capPerWindow: 8,          // round(6 × 1.3) = round(7.8)
        windowMinutes: 60,        // safety — verbatim
        countEmergencies: false,  // safety — verbatim
      },
    });
    expect(provenance.tempoEffective).toBe('aggressive');
    // The INPUT config is never mutated.
    expect(cfg.swapWindow.capPerWindow).toBe(6);
    expect(cfg.forcedRotation.ticksThreshold).toBe(5);
  });

  it('MEASURED (×0.7): the opposite direction, same field discipline', () => {
    const { hftConfig: out } = clampHftConfig({ hftConfig: mcHft(), desiredTempo: 'measured', dialEnabled: true });
    expect(out.swapWindow.capPerWindow).toBe(4);                       // round(6 × 0.7) = round(4.2)
    expect(out.forcedRotation.ticksThreshold).toBe(7);                 // round(5 ÷ 0.7) = round(7.14)
    expect(out.hurdleFloor.byReason.haiku_decision.atrMultiplier).toBe(0.5);  // round2(0.35 ÷ 0.7)
    expect(out.hurdleFloor.byReason.stagnation.atrMultiplier).toBe(0.71);     // round2(0.5 ÷ 0.7)
    expect(out.hurdleFloor.default.atrMultiplier).toBe(0.5);
    // Direction sanity: measured is slower everywhere aggressive is faster.
    expect(out.swapWindow.capPerWindow).toBeLessThan(6);
    expect(out.forcedRotation.ticksThreshold).toBeGreaterThan(5);
  });

  it('cross-product: every archetype × every band resolves to a fully-populated config (no ?? site can see undefined)', () => {
    for (const archetype of ['momentum_chaser', 'contrarian', 'degen', 'guardian', 'diversifier', 'analyst']) {
      const cfg = resolveHftConfig(getArchetypeConfig(archetype), 'baggerbomb_tournament');
      for (const tempo of VALID_TEMPO_VALUES) {
        const { hftConfig: out } = clampHftConfig({ hftConfig: cfg, desiredTempo: tempo, dialEnabled: true });
        // The downstream consumers' exact read paths (agent-evaluate.js:1038/
        // 1086/1748, agentRiskManager.js:154/315 @ 4a0f43e) must all resolve.
        expect(out.forcedRotation?.enabled, `${archetype}/${tempo}`).toBeDefined();
        expect(typeof out.forcedRotation?.ticksThreshold).toBe('number');
        expect(typeof out.swapWindow?.capPerWindow).toBe('number');
        expect(out.swapWindow.capPerWindow).toBeGreaterThanOrEqual(1);
        expect(out.forcedRotation.ticksThreshold).toBeGreaterThanOrEqual(1);
        expect(typeof out.hurdleFloor?.default?.atrMultiplier).toBe('number');
        expect(typeof out.hurdleFloor?.byReason?.haiku_decision?.atrMultiplier).toBe('number');
        expect(typeof out.hurdleFloor?.byReason?.stagnation?.atrMultiplier).toBe('number');
        // Safety fields byte-identical at every band.
        expect(out.forcedRotation.pctThreshold).toBe(cfg.forcedRotation.pctThreshold);
        expect(out.forcedRotation.winnerThreshold).toBe(cfg.forcedRotation.winnerThreshold);
        expect(out.forcedRotation.maxTickAgeMinutes).toBe(cfg.forcedRotation.maxTickAgeMinutes);
        expect(out.forcedRotation.enabled).toBe(cfg.forcedRotation.enabled);
        expect(out.swapWindow.windowMinutes).toBe(cfg.swapWindow.windowMinutes);
        expect(out.swapWindow.countEmergencies).toBe(cfg.swapWindow.countEmergencies);
        expect(out.hurdleFloor.enabled).toBe(cfg.hurdleFloor.enabled);
        expect(out.hurdleFloor.requireBenchPositive).toBe(cfg.hurdleFloor.requireBenchPositive);
      }
    }
  });

  it('≥1 clamps hold at extreme synthetic multipliers', () => {
    const tiny = { swapWindow: { capPerWindow: 1 }, forcedRotation: { ticksThreshold: 1 } };
    const shrunk = applyTempoToHftConfig(tiny, 'measured', 0.2);
    expect(shrunk.swapWindow.capPerWindow).toBe(1);      // max(1, round(0.2))
    const stretched = applyTempoToHftConfig(tiny, 'aggressive', 3);
    expect(stretched.forcedRotation.ticksThreshold).toBe(1); // max(1, round(0.33))
  });

  it('never creates absent sub-objects and carries unknown future keys through untouched', () => {
    const sparse = { swapWindow: { capPerWindow: 4, enabled: true }, futureKnob: { x: 1 } };
    const out = applyTempoToHftConfig(sparse, 'aggressive', 1.3);
    expect(out.swapWindow.capPerWindow).toBe(5); // round(4 × 1.3) = round(5.2)
    expect(out.forcedRotation).toBeUndefined();  // absent stays absent
    expect(out.hurdleFloor).toBeUndefined();
    expect(out.futureKnob).toBe(sparse.futureKnob); // untouched branch keeps its reference
  });
});
