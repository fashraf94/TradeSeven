// api/_utils/agentRiskManager.test.js
// Forge Enforcement Keystone V1.4 — Phase 1 (archetype→physics hook).
// Verifies the evaluateRisk archetype-aware wrapper (§4.1):
//   - hftConfig is echoed on the result (wire is live & observable for Gate 1)
//   - backward-compatible default (archetypeConfig omitted → hftConfig null)
//   - the wrapper does NOT change base risk physics in Phase 1
//   - Decision 2 isolation: base levers track presetOverrides; hftConfig tracks
//     archetypeConfig — independently.

import { describe, it, expect } from 'vitest';
import { evaluateRisk } from './agentRiskManager.js';
import { getArchetypeConfig } from './agentArchetypeConfig.js';

const POS = { symbol: 'AAPL', tier: 'core', baseATR: 2.5 };
const degen = getArchetypeConfig('degen');
const guardian = getArchetypeConfig('guardian');

describe('evaluateRisk — archetype wire (§4.1)', () => {
  it('omitting archetypeConfig is backward-compatible (hftConfig null, HOLD)', () => {
    const r = evaluateRisk(POS, 100, 100, 2.5, null, {});
    expect(r.action).toBe('HOLD');
    expect(r.hftConfig).toBeNull();
  });

  it('echoes the resolved hftConfig on the result', () => {
    const r = evaluateRisk(POS, 100, 100, 2.5, null, {}, {}, degen);
    expect(r.hftConfig).toBe(degen.hftConfig);
    expect(r.hftConfig.forcedRotation.enabled).toBe(true);
  });

  it('different archetypes carry different hftConfig (differentiation at the risk-layer boundary)', () => {
    const d = evaluateRisk(POS, 100, 100, 2.5, null, {}, {}, degen);
    const g = evaluateRisk(POS, 100, 100, 2.5, null, {}, {}, guardian);
    expect(d.hftConfig).not.toEqual(g.hftConfig);
    expect(d.hftConfig.swapWindow.capPerWindow).toBeGreaterThan(g.hftConfig.swapWindow.capPerWindow);
  });
});

describe('evaluateRisk — wrapper preserves base physics', () => {
  it('a bust-avoidance breach returns EMERGENCY_SWAP regardless of archetype', () => {
    // entry 100 → current 90 = -10% = -4x ATR (<= -0.85 default bust buffer)
    const base = evaluateRisk(POS, 90, 100, 2.5, null, {});
    const withDegen = evaluateRisk(POS, 90, 100, 2.5, null, {}, {}, degen);
    const withGuardian = evaluateRisk(POS, 90, 100, 2.5, null, {}, {}, guardian);
    expect(base.action).toBe('EMERGENCY_SWAP');
    expect(base.reason).toBe('bust_avoidance');
    expect(withDegen.action).toBe('EMERGENCY_SWAP');
    expect(withGuardian.action).toBe('EMERGENCY_SWAP');
    // …and the differentiated knobs still ride along on the protective swap
    expect(withDegen.hftConfig).toBe(degen.hftConfig);
  });
});

describe('evaluateRisk — Decision 2 isolation (base levers preset-driven, hftConfig archetype-driven)', () => {
  // entry 100 → current 98 = -2% = -0.8x ATR. Default bustBuffer -0.85 → HOLD;
  // tightened preset bustBuffer -0.75 → EMERGENCY_SWAP.
  it('preset toggle changes the BASE decision; hftConfig is unaffected', () => {
    const loose = evaluateRisk(POS, 98, 100, 2.5, null, {}, {}, guardian);
    const tight = evaluateRisk(POS, 98, 100, 2.5, null, {}, { bustBuffer: -0.75 }, guardian);
    expect(loose.action).toBe('HOLD');
    expect(tight.action).toBe('EMERGENCY_SWAP');
    // same archetype across both presets → identical hftConfig (untouchable from preset)
    expect(loose.hftConfig).toBe(guardian.hftConfig);
    expect(tight.hftConfig).toBe(guardian.hftConfig);
  });

  it('archetype change does NOT alter base physics (Phase 1) but DOES alter hftConfig', () => {
    const asDegen = evaluateRisk(POS, 98, 100, 2.5, null, {}, {}, degen);
    const asGuardian = evaluateRisk(POS, 98, 100, 2.5, null, {}, {}, guardian);
    expect(asDegen.action).toBe(asGuardian.action); // both HOLD — base physics identical in Phase 1
    expect(asDegen.hftConfig).not.toEqual(asGuardian.hftConfig); // knobs differ
  });
});
