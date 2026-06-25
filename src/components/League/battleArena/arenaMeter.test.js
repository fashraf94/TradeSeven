// src/components/League/battleArena/arenaMeter.test.js
//
// Pure-function tests for the star-meter geometry. This file's import of
// arenaMeter (→ baggerBombScoring) IS the dependency-surface guard: it loads
// clean in the Node test env, proving the meter's tick source stays node-clean
// and canonical (BUILD_RULES §4 — never mocked).

import { describe, it, expect } from 'vitest';
import { BAGGER_TIERS, BUST_TIERS } from '../../../constants/baggerBombScoring';
import {
  ST_DOM, METER_TICKS, meterPct, tickCrossed, meterInfo, meterNear,
} from './arenaMeter';

describe('METER_TICKS — derived from canon, not copied', () => {
  it('carries every bagger tier on the positive side and every bust tier mirrored negative', () => {
    const good = METER_TICKS.filter((t) => t.kind === 'good');
    const bad = METER_TICKS.filter((t) => t.kind === 'bad');
    expect(good.map((t) => t.m)).toEqual(BAGGER_TIERS.map((t) => t.multiplier));
    expect(bad.map((t) => t.m)).toEqual(BUST_TIERS.map((t) => -t.multiplier));
    // labels come straight from the tier table
    expect(good.map((t) => t.name)).toEqual(['BaggerBomb', 'Double Bagger', 'TenBagger']);
    expect(bad.map((t) => t.name)).toEqual(['Bust', 'Crash', 'Meltdown']);
  });
});

describe('meterPct', () => {
  it('maps 0 to centre, ±ST_DOM to the rails, and clamps beyond', () => {
    expect(meterPct(0)).toBe(50);
    expect(meterPct(ST_DOM)).toBe(100);
    expect(meterPct(-ST_DOM)).toBe(0);
    expect(meterPct(99)).toBe(100); // clamped
    expect(meterPct(-99)).toBe(0);
  });
  it('treats non-finite as 0 (centre)', () => {
    expect(meterPct(NaN)).toBe(50);
    expect(meterPct(undefined)).toBe(50);
  });
});

describe('tickCrossed', () => {
  it('crosses a good tick at-or-above, a bad tick at-or-below', () => {
    const good = { m: 1.0 }; const bad = { m: -1.0 };
    expect(tickCrossed(good, 1.0)).toBe(true);
    expect(tickCrossed(good, 0.99)).toBe(false);
    expect(tickCrossed(bad, -1.0)).toBe(true);
    expect(tickCrossed(bad, -0.99)).toBe(false);
  });
});

describe('meterInfo', () => {
  it('reports the next line up and the crossed top going up', () => {
    const info = meterInfo(1.2); // crossed +1.0, straining to +1.5
    expect(info.nextUp.m).toBe(1.5);
    expect(info.topUp.m).toBe(1.0);
    expect(info.nextDown.m).toBe(-1.0);
    expect(info.lowDown).toBeNull();
  });
  it('reports the next line down and the crossed low going down', () => {
    const info = meterInfo(-1.2); // crossed -1.0, straining to -1.5
    expect(info.nextDown.m).toBe(-1.5);
    expect(info.lowDown.m).toBe(-1.0);
    expect(info.nextUp.m).toBe(1.0);
  });
  it('at the top of the scale there is no next line up', () => {
    expect(meterInfo(2.0).nextUp).toBeNull();
    expect(meterInfo(-2.0).nextDown).toBeNull();
  });
});

describe('meterNear', () => {
  it('is near when within the band of the line it strains toward', () => {
    expect(meterNear(0.9, true)).toBe(true);   // 0.1 from +1.0
    expect(meterNear(0.5, true)).toBe(false);  // 0.5 from +1.0
    expect(meterNear(-0.9, false)).toBe(true); // 0.1 from -1.0
  });
  it('is not near when there is no target line', () => {
    expect(meterNear(2.0, true)).toBe(false);  // already at the top
  });
});
