// scripts/calibration/gate-replay-harness.test.js
// Knob Calibration B2 — gate-replay harness (golden/determinism + gate wiring).
import { describe, it, expect } from 'vitest';
import {
  candidateWakes,
  isHaikuWoken,
  buildHaikuProposals,
  replayScenario,
  runAll,
  replayRealBattles,
} from './gate-replay-harness.js';
import { genUniverse } from './synthetic-universe.js';
// This file imports the FENCED agentRiskManager.js (via the harness) plus
// hurdleAtr.js and agentTriggerGate.js. Its passing load in bare vitest IS the
// BUILD_RULES §4 dependency-surface guard — do NOT mock these imports.

describe('candidateWakes (real evaluateTriggers bench_outperformance)', () => {
  it('a loud candidate (>=0.5x its own ATR up) fires the wake', () => {
    expect(candidateWakes('CAND', 0.02, 2.5)).toBe(true); // 2.0% / 2.5 = 0.8x
  });
  it('a quiet candidate (<0.5x its ATR) does NOT fire the wake — the 8C gap', () => {
    expect(candidateWakes('CAND', 0.001, 2.5)).toBe(false); // 0.1% / 2.5 = 0.04x
  });
});

describe('buildHaikuProposals — uniform + exogenous', () => {
  const u = genUniverse({ preset: 'trend', seed: 7 });
  it('is a function of the universe only (deterministic, archetype-independent)', () => {
    expect(buildHaikuProposals(u)).toEqual(buildHaikuProposals(u));
  });
  it('proposes held→bench swaps at a fixed cadence', () => {
    const p = buildHaikuProposals(u, { interval: 3 });
    expect(p.length).toBeGreaterThan(0);
    for (const { tick, outSymbol, inSymbol } of p) {
      expect(tick % 3).toBe(0);
      expect(u.held.some((h) => h.symbol === outSymbol)).toBe(true);
      expect(u.bench.some((b) => b.symbol === inSymbol)).toBe(true);
    }
  });
});

describe('isHaikuWoken (real evaluateTriggers over the book)', () => {
  it('a trend book (loud bench) wakes Haiku; a flatline book does not', () => {
    const trend = genUniverse({ preset: 'trend', seed: 7 });
    const flat = genUniverse({ preset: 'flatline', seed: 7 });
    const frozenT = new Map(trend.symbols.map((s) => [s.symbol, s.ticks[0].atrPercentile * 8]));
    const frozenF = new Map(flat.symbols.map((s) => [s.symbol, s.ticks[0].atrPercentile * 8]));
    expect(isHaikuWoken(trend, trend.nTicks - 1, frozenT)).toBe(true);
    expect(isHaikuWoken(flat, flat.nTicks - 1, frozenF)).toBe(false);
  });
});

describe('replayScenario — forced + haiku paths', () => {
  const universe = genUniverse({ preset: 'trend', seed: 7 });

  it('guardian never force-rotates but DOES trade via the haiku path (real tempo floor)', () => {
    const m = replayScenario({ archetype: 'guardian', universe });
    expect(m.forcedRotation.fires).toBe(0);
    expect(m.forcedRotation.executed).toBe(0);
    expect(m.haiku.executed).toBeGreaterThan(0); // the point of the extension
    expect(m.executedRotations).toBe(m.haiku.executed);
  });

  it('degen out-trades guardian on TOTAL tempo (8A now falsifiable, not vacuous)', () => {
    const d = replayScenario({ archetype: 'degen', universe });
    const g = replayScenario({ archetype: 'guardian', universe });
    expect(g.executedRotations).toBeGreaterThan(0); // guardian is non-zero now
    expect(d.executedRotations).toBeGreaterThan(g.executedRotations);
  });

  it('captures the haiku-path gates, fresh ATR usage, and wake-starvation', () => {
    const m = replayScenario({ archetype: 'analyst', universe });
    expect(m.haiku).toMatchObject({
      proposals: expect.any(Number),
      woken: expect.any(Number),
      wakeStarved: expect.any(Number),
      hurdleBlocked: expect.any(Number),
      capped: expect.any(Number),
      executed: expect.any(Number),
    });
    expect(m.atrFreshness.fresh).toBeGreaterThan(0); // A1 fresh-ATR path exercised
    expect(m.wakeStarvation).toHaveProperty('clearingOpportunities');
  });
});

describe('unified gates + determinism', () => {
  const out = runAll();

  it('is fully deterministic (byte-identical on repeat)', () => {
    expect(JSON.stringify(runAll())).toBe(JSON.stringify(out));
  });

  it('8A ordering is falsifiable: guardian lowest but non-zero, degen highest', () => {
    const o = out.unifiedGates['8A_ordering'];
    expect(o.tempo.guardian).toBeGreaterThan(0);
    expect(o.guardianLowest).toBe(true);
    expect(o.tempo.degen).toBeGreaterThan(o.tempo.guardian);
  });

  it('wake-starvation is recorded FAILED-STRUCTURAL and shows up in chop', () => {
    const ws = out.unifiedGates.wake_starvation;
    expect(ws.status).toMatch(/FAILED-STRUCTURAL/);
    expect(ws.byPreset.chop.ratePct).toBeGreaterThan(0);
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
