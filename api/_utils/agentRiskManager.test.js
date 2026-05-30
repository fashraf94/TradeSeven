// api/_utils/agentRiskManager.test.js
// Forge Enforcement Keystone V1.4 — Phase 1 (archetype→physics hook).
// Verifies the evaluateRisk archetype-aware wrapper (§4.1):
//   - hftConfig is echoed on the result (wire is live & observable for Gate 1)
//   - backward-compatible default (archetypeConfig omitted → hftConfig null)
//   - the wrapper does NOT change base risk physics in Phase 1
//   - Decision 2 isolation: base levers track presetOverrides; hftConfig tracks
//     archetypeConfig — independently.

import { describe, it, expect } from 'vitest';
import { evaluateRisk, updateStagnationCounter, pickSwapReplacementCandidate } from './agentRiskManager.js';
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

// ---- Phase 3: Knob A — forced rotation (§4.2 / §3.4) ----

describe('updateStagnationCounter — D2 lifecycle + tick-age guard (§3.4)', () => {
  const CFG = { pctThreshold: 0.001, maxTickAgeMinutes: 20 };
  const T0 = 1_000_000_000_000; // arbitrary epoch ms

  it('first tick initializes tracking, does not increment, withinAge false', () => {
    const r = updateStagnationCounter({ currentPrice: 100, lastTickPrice: null, lastTickTimestamp: null, now: T0, ...CFG, stagnationTicks: 0 });
    expect(r.stagnationTicks).toBe(0);
    expect(r.lastTickPrice).toBe(100);
    expect(r.lastTickTimestamp).toBe(T0);
    expect(r.withinAge).toBe(false);
  });

  it('increments on a flat tick (move < pctThreshold) within age; withinAge true', () => {
    const r = updateStagnationCounter({ currentPrice: 100.05, lastTickPrice: 100, lastTickTimestamp: T0, now: T0 + 15 * 60000, ...CFG, stagnationTicks: 2 });
    expect(r.stagnationTicks).toBe(3); // move 0.0005 < 0.001
    expect(r.withinAge).toBe(true);
    expect(r.lastTickPrice).toBe(100.05);
    expect(r.lastTickTimestamp).toBe(T0 + 15 * 60000);
  });

  it('resets on a meaningful move (>= pctThreshold) within age', () => {
    const r = updateStagnationCounter({ currentPrice: 101, lastTickPrice: 100, lastTickTimestamp: T0, now: T0 + 15 * 60000, ...CFG, stagnationTicks: 5 });
    expect(r.stagnationTicks).toBe(0); // move 0.01 >= 0.001
    expect(r.withinAge).toBe(true);
  });

  it('PAUSES (count unchanged) when tick age exceeds maxTickAgeMinutes; withinAge false; tracking still refreshed', () => {
    const r = updateStagnationCounter({ currentPrice: 100.05, lastTickPrice: 100, lastTickTimestamp: T0, now: T0 + 90 * 60000, ...CFG, stagnationTicks: 4 });
    expect(r.stagnationTicks).toBe(4); // unchanged (pause)
    expect(r.withinAge).toBe(false);
    expect(r.lastTickPrice).toBe(100.05); // only the COUNTER is age-gated
    expect(r.lastTickTimestamp).toBe(T0 + 90 * 60000);
  });

  it('bad current price is a no-op (no tracking refresh, withinAge false)', () => {
    const r = updateStagnationCounter({ currentPrice: 0, lastTickPrice: 100, lastTickTimestamp: T0, now: T0 + 15 * 60000, ...CFG, stagnationTicks: 3 });
    expect(r.stagnationTicks).toBe(3);
    expect(r.lastTickPrice).toBe(100); // NOT refreshed with bad data
    expect(r.lastTickTimestamp).toBe(T0);
    expect(r.withinAge).toBe(false);
  });
});

describe('evaluateRisk — Knob A forced-rotation branch (§4.2)', () => {
  const degen = getArchetypeConfig('degen');       // enabled, ticksThreshold 3, winnerThreshold 0.002
  const guardian = getArchetypeConfig('guardian');  // forcedRotation DISABLED
  const FLAT = { symbol: 'AAPL', tier: 'core', baseATR: 2.5, dailyPct: 0 };
  const STAG = { withinAge: true, stagnationTicks: 3 };

  it('fires SWAP_OUT/stagnation/archetype when enabled + withinAge + counter>=threshold + not winning', () => {
    const r = evaluateRisk(FLAT, 100, 100, 2.5, null, STAG, {}, degen);
    expect(r.action).toBe('SWAP_OUT');
    expect(r.reason).toBe('stagnation');
    expect(r.source).toBe('archetype');
  });

  it('does NOT fire when forcedRotation disabled (guardian)', () => {
    expect(evaluateRisk(FLAT, 100, 100, 2.5, null, STAG, {}, guardian).action).toBe('HOLD');
  });

  it('does NOT fire when counter below threshold', () => {
    expect(evaluateRisk(FLAT, 100, 100, 2.5, null, { withinAge: true, stagnationTicks: 2 }, {}, degen).action).toBe('HOLD');
  });

  // The approved tick-age FIRE refinement: a counter already >= threshold must NOT
  // fire on a stale (withinAge:false) gap-recovery tick — only on the next timely one.
  it('does NOT fire on a stale tick even when counter >= threshold (withinAge false)', () => {
    expect(evaluateRisk(FLAT, 100, 100, 2.5, null, { withinAge: false, stagnationTicks: 5 }, {}, degen).action).toBe('HOLD');
  });

  it('fires on the next timely flat tick after a stale one', () => {
    expect(evaluateRisk(FLAT, 100, 100, 2.5, null, { withinAge: false, stagnationTicks: 5 }, {}, degen).action).toBe('HOLD');
    const timely = evaluateRisk(FLAT, 100, 100, 2.5, null, { withinAge: true, stagnationTicks: 5 }, {}, degen);
    expect(timely.action).toBe('SWAP_OUT');
    expect(timely.reason).toBe('stagnation');
  });
});

describe('evaluateRisk — winner suppression units (§3.4): dailyPct FRACTION vs winnerThreshold', () => {
  const degen = getArchetypeConfig('degen'); // winnerThreshold 0.002 (= +0.2%)
  const STAG = { withinAge: true, stagnationTicks: 3 };
  const at = (dailyPct) => evaluateRisk({ symbol: 'X', baseATR: 2.5, dailyPct }, 100, 100, 2.5, null, STAG, {}, degen);

  it('suppresses a clearly-winning +2% position (0.02 >= 0.002) — catches a unit mismatch', () => {
    expect(at(0.02).action).toBe('HOLD');
  });

  it('suppresses at the +0.2% boundary (0.002 is not < 0.002)', () => {
    expect(at(0.002).action).toBe('HOLD');
  });

  it('is eligible for a barely-positive +0.1% position (0.001 < 0.002)', () => {
    expect(at(0.001).action).toBe('SWAP_OUT');
  });

  it('is eligible for a losing position', () => {
    expect(at(-0.03).action).toBe('SWAP_OUT');
  });

  it('does not fire when dailyPct is missing (cannot confirm not-winning)', () => {
    expect(evaluateRisk({ symbol: 'X', baseATR: 2.5 }, 100, 100, 2.5, null, STAG, {}, degen).action).toBe('HOLD');
  });
});

describe('evaluateRisk — protective actions outrank forced rotation (priority)', () => {
  const degen = getArchetypeConfig('degen');
  const STAG = { withinAge: true, stagnationTicks: 99 }; // would fire if reached

  it('bust_avoidance (EMERGENCY_SWAP) wins over stagnation', () => {
    const r = evaluateRisk({ symbol: 'X', baseATR: 2.5, dailyPct: 0 }, 90, 100, 2.5, null, STAG, {}, degen);
    expect(r.action).toBe('EMERGENCY_SWAP');
    expect(r.reason).toBe('bust_avoidance');
  });

  it('vwap_failure (SWAP_OUT) wins over stagnation', () => {
    const r = evaluateRisk(
      { symbol: 'X', baseATR: 2.5, dailyPct: 0 },
      100, 100, 2.5,
      { vwap: 100, vwapDeviation: -1, sma20_5m: null },
      { ticksBelowVwap: 2, withinAge: true, stagnationTicks: 99 },
      {}, degen,
    );
    expect(r.action).toBe('SWAP_OUT');
    expect(r.reason).toBe('vwap_failure');
  });

  it('LOCK (threshold proximity) wins over stagnation', () => {
    // +0.9x ATR (2.25% on 2.5 ATR) within 0.2x of the 1.0 bonus → LOCK
    expect(evaluateRisk({ symbol: 'X', baseATR: 2.5, dailyPct: 0 }, 102.25, 100, 2.5, null, STAG, {}, degen).action).toBe('LOCK');
  });

  it('TRAIL_STOP wins over stagnation', () => {
    // +1.5x ATR (3.75%) and below the 5min SMA20 → TRAIL_STOP
    const r = evaluateRisk(
      { symbol: 'X', baseATR: 2.5, dailyPct: 0 },
      103.75, 100, 2.5,
      { vwap: 100, vwapDeviation: 1, sma20_5m: 200 },
      STAG, {}, degen,
    );
    expect(r.action).toBe('TRAIL_STOP');
  });
});

describe('pickSwapReplacementCandidate — quality-gated wrapper (§4.2)', () => {
  const prices = { AAA: { changePercent: 5 }, BBB: { changePercent: 3 }, CCC: { changePercent: 1 } };
  const bench = [
    { symbol: 'AAA', isCrypto: false },
    { symbol: 'BBB', isCrypto: false },
    { symbol: 'CCC', isCrypto: false },
  ];

  it('returns the best-momentum candidate when the predicate passes all', () => {
    expect(pickSwapReplacementCandidate({ benchAssets: bench, prices, outgoingIsCrypto: false, clearsQuality: () => true }).symbol).toBe('AAA');
  });

  it('iterates to the first candidate that clears the predicate', () => {
    expect(pickSwapReplacementCandidate({ benchAssets: bench, prices, outgoingIsCrypto: false, clearsQuality: (a) => a.symbol !== 'AAA' }).symbol).toBe('BBB');
  });

  it('returns null (the rotation VETO) when no candidate clears the predicate', () => {
    expect(pickSwapReplacementCandidate({ benchAssets: bench, prices, outgoingIsCrypto: false, clearsQuality: () => false })).toBeNull();
  });

  it('excludes held symbols', () => {
    expect(pickSwapReplacementCandidate({ benchAssets: bench, prices, outgoingIsCrypto: false, heldSymbols: new Set(['AAA', 'BBB']), clearsQuality: () => true }).symbol).toBe('CCC');
  });

  it('respects asset-type match (no crypto for a stock swap)', () => {
    const mixed = [{ symbol: 'BTC', isCrypto: true }, { symbol: 'AAA', isCrypto: false }];
    const r = pickSwapReplacementCandidate({ benchAssets: mixed, prices: { BTC: { changePercent: 9 }, AAA: { changePercent: 1 } }, outgoingIsCrypto: false, clearsQuality: () => true });
    expect(r.symbol).toBe('AAA');
  });

  it('excludes cooldown candidates and returns null if all filtered', () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(pickSwapReplacementCandidate({ benchAssets: [{ symbol: 'AAA', isCrypto: false, cooldownUntil: future }], prices, outgoingIsCrypto: false, clearsQuality: () => true })).toBeNull();
  });
});
