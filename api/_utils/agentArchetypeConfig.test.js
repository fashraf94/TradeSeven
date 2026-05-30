// api/_utils/agentArchetypeConfig.test.js
// Forge Enforcement Keystone V1.4 — Phase 1 (archetype→physics hook).
// Verifies the hftConfig schema (§3.3 + Erratum E1 winnerThreshold), dead
// riskOverrides removal (Decision 10), getArchetypeConfig analyst-default
// fallback (§4.1 / Decision 19), and Gate 1 behavioral differentiation
// (degen ≠ guardian at runtime — NOT merely that the call resolves).

import { describe, it, expect } from 'vitest';
import { ARCHETYPE_CONFIGS, getArchetypeConfig, VALID_ARCHETYPES } from './agentArchetypeConfig.js';

const ALL = ['momentum_chaser', 'analyst', 'diversifier', 'contrarian', 'degen', 'guardian'];

describe('agentArchetypeConfig — VALID_ARCHETYPES', () => {
  it('exposes exactly the 6 platform archetypes', () => {
    expect([...VALID_ARCHETYPES].sort()).toEqual([...ALL].sort());
  });
});

describe('agentArchetypeConfig — dead riskOverrides removed (Decision 10)', () => {
  it.each(ALL)('%s has no riskOverrides field', (name) => {
    expect(ARCHETYPE_CONFIGS[name]).not.toHaveProperty('riskOverrides');
  });
});

describe('agentArchetypeConfig — hftConfig matches §3.3 schema for all 6', () => {
  it.each(ALL)('%s has a complete hftConfig (forcedRotation / hurdleFloor / swapWindow)', (name) => {
    const hft = ARCHETYPE_CONFIGS[name].hftConfig;
    expect(hft).toBeDefined();

    // forcedRotation (Shape-A) — incl. winnerThreshold per Erratum E1
    const fr = hft.forcedRotation;
    expect(typeof fr.enabled).toBe('boolean');
    expect(typeof fr.pctThreshold).toBe('number');
    expect(typeof fr.ticksThreshold).toBe('number');
    expect(typeof fr.maxTickAgeMinutes).toBe('number');
    expect(typeof fr.winnerThreshold).toBe('number'); // Erratum E1

    // hurdleFloor (Shape-B per-reason table)
    const hf = hft.hurdleFloor;
    expect(typeof hf.enabled).toBe('boolean');
    expect(typeof hf.byReason.haiku_decision.atrMultiplier).toBe('number');
    expect(typeof hf.byReason.stagnation.atrMultiplier).toBe('number');
    expect(typeof hf.default.atrMultiplier).toBe('number');
    expect(typeof hf.requireBenchPositive).toBe('boolean');

    // swapWindow (Shape-A)
    const sw = hft.swapWindow;
    expect(typeof sw.enabled).toBe('boolean');
    expect(typeof sw.capPerWindow).toBe('number');
    expect(typeof sw.windowMinutes).toBe('number');
    expect(typeof sw.countEmergencies).toBe('boolean');
  });

  it('winnerThreshold matches the §3.4 anchors (degen 0.002, analyst 0)', () => {
    expect(ARCHETYPE_CONFIGS.degen.hftConfig.forcedRotation.winnerThreshold).toBe(0.002);
    expect(ARCHETYPE_CONFIGS.analyst.hftConfig.forcedRotation.winnerThreshold).toBe(0);
  });

  it('guardian forced rotation is disabled (§3.3 / §3.4)', () => {
    expect(ARCHETYPE_CONFIGS.guardian.hftConfig.forcedRotation.enabled).toBe(false);
  });

  it('countEmergencies defaults to false everywhere (Invariant 1 — emergencies excluded from window)', () => {
    for (const name of ALL) {
      expect(ARCHETYPE_CONFIGS[name].hftConfig.swapWindow.countEmergencies).toBe(false);
    }
  });

  it('matches the §3.3 illustrative launch-seed table exactly', () => {
    expect(ARCHETYPE_CONFIGS.degen.hftConfig.forcedRotation.pctThreshold).toBe(0.001);
    expect(ARCHETYPE_CONFIGS.degen.hftConfig.forcedRotation.ticksThreshold).toBe(3);
    expect(ARCHETYPE_CONFIGS.degen.hftConfig.hurdleFloor.byReason.haiku_decision.atrMultiplier).toBe(0.2);
    expect(ARCHETYPE_CONFIGS.degen.hftConfig.hurdleFloor.byReason.stagnation.atrMultiplier).toBe(0.6);
    expect(ARCHETYPE_CONFIGS.degen.hftConfig.swapWindow.capPerWindow).toBe(12);

    expect(ARCHETYPE_CONFIGS.guardian.hftConfig.swapWindow.capPerWindow).toBe(2);
    expect(ARCHETYPE_CONFIGS.guardian.hftConfig.swapWindow.windowMinutes).toBe(120);

    expect(ARCHETYPE_CONFIGS.momentum_chaser.hftConfig.forcedRotation.pctThreshold).toBe(0.0015);
    expect(ARCHETYPE_CONFIGS.analyst.hftConfig.swapWindow.capPerWindow).toBe(4);
  });
});

describe('getArchetypeConfig — analyst-default fallback (§4.1 / Decision 19)', () => {
  it.each(ALL)('returns the matching config for %s', (name) => {
    expect(getArchetypeConfig(name)).toBe(ARCHETYPE_CONFIGS[name]);
  });

  it('falls back to analyst for the "unknown" sentinel (the persisted default)', () => {
    expect(getArchetypeConfig('unknown')).toBe(ARCHETYPE_CONFIGS.analyst);
  });

  it('falls back to analyst for undefined / null (legacy battles)', () => {
    expect(getArchetypeConfig(undefined)).toBe(ARCHETYPE_CONFIGS.analyst);
    expect(getArchetypeConfig(null)).toBe(ARCHETYPE_CONFIGS.analyst);
  });

  it('falls back to analyst for a non-archetype value (A1-class safety; e.g. day_trader)', () => {
    expect(getArchetypeConfig('day_trader')).toBe(ARCHETYPE_CONFIGS.analyst);
  });
});

// Gate 1 (LOAD-BEARING): assert behavioral differentiation at runtime — that the
// resolved configs genuinely DIFFER, not merely that the call resolves.
describe('Gate 1 — archetype behavioral differentiation (degen ≠ guardian)', () => {
  const degen = getArchetypeConfig('degen').hftConfig;
  const guardian = getArchetypeConfig('guardian').hftConfig;

  it('degen enables forced rotation; guardian does not', () => {
    expect(degen.forcedRotation.enabled).toBe(true);
    expect(guardian.forcedRotation.enabled).toBe(false);
    expect(degen.forcedRotation.enabled).not.toBe(guardian.forcedRotation.enabled);
  });

  it('degen has a higher swap cap than guardian (active vs conservative ceiling)', () => {
    expect(degen.swapWindow.capPerWindow).toBeGreaterThan(guardian.swapWindow.capPerWindow);
  });

  it('degen rotates on smaller flatlines / fewer ticks than guardian (lower pct + tick thresholds)', () => {
    expect(degen.forcedRotation.pctThreshold).toBeLessThan(guardian.forcedRotation.pctThreshold);
    expect(degen.forcedRotation.ticksThreshold).toBeLessThan(guardian.forcedRotation.ticksThreshold);
  });

  it('degen: LOW discretionary (haiku) floor, HIGH mechanical (stagnation) floor — V1.3 inversion resolved', () => {
    expect(degen.hurdleFloor.byReason.haiku_decision.atrMultiplier)
      .toBeLessThan(degen.hurdleFloor.byReason.stagnation.atrMultiplier);
    // and degen acts on thinner discretionary edges than guardian
    expect(degen.hurdleFloor.byReason.haiku_decision.atrMultiplier)
      .toBeLessThan(guardian.hurdleFloor.byReason.haiku_decision.atrMultiplier);
  });

  it('the two configs are not structurally equal', () => {
    expect(degen).not.toEqual(guardian);
  });
});
