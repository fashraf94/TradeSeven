// scripts/calibration/gate-replay-harness.test.js
// Knob Calibration B2 — gate-replay harness (golden/determinism + gate wiring).
import { describe, it, expect } from 'vitest';
import { candidateWakes, replayScenario, runAll, replayRealBattles } from './gate-replay-harness.js';
import { genUniverse } from './synthetic-universe.js';
// This file imports the FENCED agentRiskManager.js (via the harness) plus
// hurdleAtr.js and agentTriggerGate.js. Its passing load in bare vitest IS the
// BUILD_RULES §4 dependency-surface guard — do NOT mock these imports.

describe('candidateWakes (real evaluateTriggers bench_outperformance)', () => {
  it('a loud candidate (>=0.5x its own ATR up) fires the wake', () => {
    // dailyPct 0.02 → 2.0% ; baseATR 2.5 → 2.0/2.5 = 0.8x >= 0.5
    expect(candidateWakes('CAND', 0.02, 2.5)).toBe(true);
  });
  it('a quiet candidate (<0.5x its ATR) does NOT fire the wake — the 8C gap', () => {
    // 0.1% / 2.5 = 0.04x < 0.5 — could still clear the RELATIVE hurdle, yet no wake
    expect(candidateWakes('CAND', 0.001, 2.5)).toBe(false);
  });
});

describe('replayScenario', () => {
  const universe = genUniverse({ preset: 'trend', seed: 7 });

  it('guardian never force-rotates (forcedRotation disabled)', () => {
    const m = replayScenario({ archetype: 'guardian', universe });
    expect(m.forcedRotation.fires).toBe(0);
    expect(m.forcedRotation.executed).toBe(0);
  });

  it('degen out-trades analyst on trend (tempo ordering)', () => {
    const d = replayScenario({ archetype: 'degen', universe });
    const a = replayScenario({ archetype: 'analyst', universe });
    expect(d.executedRotations).toBeGreaterThan(a.executedRotations);
  });

  it('captures full metric shape incl. blockReason breakdown + fresh ATR usage', () => {
    const m = replayScenario({ archetype: 'degen', universe });
    expect(m.hurdle.blocked).toHaveProperty('below_floor');
    expect(m.hurdle.blocked).toHaveProperty('bench_not_positive');
    expect(m.atrFreshness.fresh).toBeGreaterThan(0); // A1 fresh-ATR path exercised
    expect(m.wakeStarvation).toHaveProperty('clearingOpportunities');
    expect(m.wakeStarvation).toHaveProperty('wakeButNeverClears');
  });
});

describe('unified gates + determinism', () => {
  const out = runAll();

  it('is fully deterministic (byte-identical on repeat)', () => {
    expect(JSON.stringify(runAll())).toBe(JSON.stringify(out));
  });

  it('establishes a base tempo ordering with guardian lowest', () => {
    const t = out.unifiedGates['8A_ordering'].tempo;
    expect(t.guardian).toBe(0);
    expect(t.degen).toBeGreaterThanOrEqual(t.analyst);
    expect(out.unifiedGates['8A_ordering'].guardianLowest).toBe(true);
  });

  it('surfaces the wake-starvation gate; the 8C divergence shows up in chop', () => {
    const ws = out.unifiedGates.wake_starvation;
    expect(ws.byPreset.chop.ratePct).toBeGreaterThan(0);
    expect(typeof ws.pass).toBe('boolean');
  });

  it('stress replay holds no ordering inversion', () => {
    expect(out.unifiedGates.stress_replay.noInversion).toBe(true);
  });

  it('routes the metrics B2 cannot synthesize to their real-data / WS2 owners', () => {
    expect(out.unifiedGates['8B_stagnation_share'].source).toMatch(/B1 real data/);
    expect(out.unifiedGates.emergency_bypass_frequency.source).toMatch(/B1 real data/);
    expect(out.unifiedGates.dial_position_ordering.source).toMatch(/B3\/WS2/);
  });
});

describe('replayRealBattles (honest coverage)', () => {
  it('reports zero gate-replayable coverage from recorded battles', () => {
    const r = replayRealBattles([{ trades: [] }, { trades: [] }]);
    expect(r.totalBattles).toBe(2);
    expect(r.gateReplayableBattles).toBe(0);
    expect(r.coveragePct).toBe(0);
    expect(r.note).toMatch(/B1|synthetic/);
  });
});
