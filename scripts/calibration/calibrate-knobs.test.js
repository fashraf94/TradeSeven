// scripts/calibration/calibrate-knobs.test.js
// Knob Calibration B3 — calibration run (verdict + gate/sweep/band verification).
import { describe, it, expect } from 'vitest';
import {
  buildProposed,
  runSweep,
  verifyDialBands,
  applyBand,
  calibrate,
  BANDS,
  GATE_PRESETS,
} from './calibrate-knobs.js';

describe('buildProposed', () => {
  it('widens degen<->mc: lowers degen stagnation floor + slows mc', () => {
    const t = buildProposed();
    expect(t.degen.hurdleFloor.byReason.stagnation.atrMultiplier).toBe(0.3);
    expect(t.momentum_chaser.forcedRotation.ticksThreshold).toBe(5);
    expect(t.momentum_chaser.swapWindow.capPerWindow).toBe(6);
    expect(t.guardian.forcedRotation.enabled).toBe(false); // guardian unchanged
  });
  it('is deterministic', () => {
    expect(JSON.stringify(buildProposed())).toBe(JSON.stringify(buildProposed()));
  });
});

describe('applyBand', () => {
  it('Aggressive loosens (cap up, ticks down, floors down) vs Measured', () => {
    const base = buildProposed().degen;
    const aggr = applyBand(base, BANDS.Aggressive);
    const meas = applyBand(base, BANDS.Measured);
    expect(aggr.swapWindow.capPerWindow).toBeGreaterThanOrEqual(meas.swapWindow.capPerWindow);
    expect(aggr.forcedRotation.ticksThreshold).toBeLessThanOrEqual(meas.forcedRotation.ticksThreshold);
    expect(aggr.hurdleFloor.byReason.stagnation.atrMultiplier).toBeLessThanOrEqual(
      meas.hurdleFloor.byReason.stagnation.atrMultiplier,
    );
  });
});

describe('runSweep (proposal-rate x regime gates)', () => {
  const s = runSweep(buildProposed());
  it('passes every rate x preset with no rate flips', () => {
    expect(s.allPass).toBe(true);
    expect(s.rateFlips).toEqual([]);
  });
  it('degen is clearly separated from mc (>= 1.3x target)', () => {
    expect(s.degenMcSepMin).toBeGreaterThanOrEqual(1.3);
  });
});

describe('verifyDialBands', () => {
  const b = verifyDialBands(buildProposed());
  it('holds CP@Aggressive <= Spec@Measured and per-band ordering on every gate preset', () => {
    expect(b.pass).toBe(true);
    for (const p of GATE_PRESETS) {
      expect(b.byPreset[p].cpAggressiveBelowSpecMeasured).toBe(true);
      expect(b.byPreset[p].perBandOrderingHolds).toBe(true);
    }
  });
});

describe('calibrate (full run)', () => {
  const out = calibrate();
  it('reaches an overall PASS verdict on the current seeds', () => {
    expect(out.verdict.overall).toBe(true);
    expect(out.verdict.noRateFlips).toBe(true);
    expect(out.verdict.bandsHold).toBe(true);
  });
  it('carries the riders: 8B real-only, wake-starvation FAILED-STRUCTURAL, proposed-only', () => {
    expect(out.notes['8B']).toMatch(/REAL-DATA ONLY/);
    expect(out.notes.wakeStarvation).toMatch(/FAILED-STRUCTURAL/);
    expect(out.notes.landing).toMatch(/PROPOSED ONLY/);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(calibrate())).toBe(JSON.stringify(out));
  });
});
