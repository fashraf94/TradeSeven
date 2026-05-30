// api/_utils/agentRiskManager.test.js
// Forge Enforcement Keystone V1.4 — Phase 1 (archetype→physics hook).
// Verifies the evaluateRisk archetype-aware wrapper (§4.1):
//   - hftConfig is echoed on the result (wire is live & observable for Gate 1)
//   - backward-compatible default (archetypeConfig omitted → hftConfig null)
//   - the wrapper does NOT change base risk physics in Phase 1
//   - Decision 2 isolation: base levers track presetOverrides; hftConfig tracks
//     archetypeConfig — independently.

import { describe, it, expect } from 'vitest';
import { evaluateRisk, updateStagnationCounter, pickSwapReplacementCandidate, clearsHurdleFloor, computeBenchVsActiveMargin, EMERGENCY_BYPASS_REASONS, getRecentSwapCount } from './agentRiskManager.js';
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

// ---- Phase 4: Knob B — hurdle floor (§4.3 / §3.1) ----

describe('EMERGENCY_BYPASS_REASONS — single source of truth (§3.1)', () => {
  it('contains exactly the 5 emergency reasons (3 risk + 2 guardrail)', () => {
    expect([...EMERGENCY_BYPASS_REASONS].sort()).toEqual(
      ['bust_avoidance', 'guardrail_stopLoss', 'guardrail_trailingStop', 'stepped_trail', 'vwap_failure'],
    );
  });

  it('does NOT contain the gated reasons (stagnation / haiku_decision / gameplan_*)', () => {
    for (const r of ['stagnation', 'haiku_decision', 'gameplan_proposal', 'gameplan_meeting', 'threshold_proximity']) {
      expect(EMERGENCY_BYPASS_REASONS.has(r)).toBe(false);
    }
  });
});

describe('computeBenchVsActiveMargin — canonical margin (§4.3)', () => {
  it('computes rawPctMargin and marginAtrUnits in consistent (fraction) units', () => {
    // active -1%, bench +2%, ATR 2.5% → all fractions: (0.02 - (-0.01)) / 0.025 = 1.2
    const m = computeBenchVsActiveMargin({ activeDailyPct: -0.01, benchDailyPct: 0.02, atrValue: 0.025 });
    expect(m.rawPctMargin).toBeCloseTo(0.03, 10);
    expect(m.marginAtrUnits).toBeCloseTo(1.2, 10);
    expect(m.eligibleForComparison).toBe(true);
    expect(m.reasonIfInvalid).toBeNull();
  });

  it('flags ineligible (and NaN margin) when atrValue <= 0', () => {
    const m = computeBenchVsActiveMargin({ activeDailyPct: 0.01, benchDailyPct: 0.02, atrValue: 0 });
    expect(m.eligibleForComparison).toBe(false);
    expect(Number.isNaN(m.marginAtrUnits)).toBe(true);
    expect(m.reasonIfInvalid).toBe('invalid_atr');
  });

  it('flags ineligible when a dailyPct is non-finite', () => {
    const m = computeBenchVsActiveMargin({ activeDailyPct: NaN, benchDailyPct: 0.02, atrValue: 0.025 });
    expect(m.eligibleForComparison).toBe(false);
    expect(m.reasonIfInvalid).toBe('non_finite_dailyPct');
  });
});

describe('clearsHurdleFloor — Knob B gate (§4.3)', () => {
  const degen = getArchetypeConfig('degen');       // haiku 0.2 / stagnation 0.6 / default 0.2
  const guardian = getArchetypeConfig('guardian');  // 0.5 across the board
  // Reusable: outgoing flat (0%), incoming up. With userATR=2.5(%) → atr fraction 0.025.
  const call = (overrides = {}) => clearsHurdleFloor({
    active: { symbol: 'OUT', dailyPct: 0 },
    benchCandidate: { symbol: 'IN', dailyPct: 0.01 }, // +1% → margin 0.01/0.025 = 0.4 ATR
    reason: 'stagnation',
    archetypeConfig: degen,
    userATR: 2.5,
    ...overrides,
  });

  // --- LANDMINE-1 unit assertion (the Phase-4 analog of Phase-3's +2% test) ---
  it('LANDMINE-1: active -1% vs bench +2%, ATR 2.5% → marginAtrUnits 1.2, clears degen stagnation floor 0.6', () => {
    const r = clearsHurdleFloor({
      active: { dailyPct: -0.01 }, benchCandidate: { dailyPct: 0.02 },
      reason: 'stagnation', archetypeConfig: degen, userATR: 2.5,
    });
    expect(r.clears).toBe(true);
    expect(r.margin.marginAtrUnits).toBeCloseTo(1.2, 10);
    expect(r.required).toBe(0.6);
  });

  it('LANDMINE-1: a just-missing margin is below_floor (0.4 ATR < degen stagnation 0.6)', () => {
    const r = call(); // +1% → 0.4 ATR units, degen stagnation requires 0.6
    expect(r.clears).toBe(false);
    expect(r.blockReason).toBe('below_floor');
    expect(r.margin.marginAtrUnits).toBeCloseTo(0.4, 10);
  });

  it('clears when the margin meets the floor exactly (>=)', () => {
    // bench +1.5% → 0.015/0.025 = 0.6 ATR == degen stagnation floor 0.6
    const r = call({ benchCandidate: { symbol: 'IN', dailyPct: 0.015 } });
    expect(r.clears).toBe(true);
    expect(r.margin.marginAtrUnits).toBeCloseTo(0.6, 10);
  });

  // --- A2: emergency bypass (load-bearing safety contract) ---
  it.each(['bust_avoidance', 'vwap_failure', 'stepped_trail', 'guardrail_stopLoss', 'guardrail_trailingStop'])(
    'A2: %s bypasses the floor even when bench is negative / margin fails', (reason) => {
      const r = clearsHurdleFloor({
        active: { dailyPct: 0.05 },                 // active winning big
        benchCandidate: { dailyPct: -0.03 },        // bench down 3% — would fail both gates
        reason, archetypeConfig: degen, userATR: 2.5,
      });
      expect(r.clears).toBe(true);
      expect(r.bypassed).toBe(true);
      expect(r.reason).toBe(reason);
    });

  // --- Invariant-1 spot matrix: gated reasons are NOT bypassed ---
  it.each(['stagnation', 'haiku_decision'])('Invariant-1: %s is gated (not bypassed)', (reason) => {
    const r = clearsHurdleFloor({
      active: { dailyPct: 0 }, benchCandidate: { dailyPct: -0.01 }, // negative bench → blocked
      reason, archetypeConfig: degen, userATR: 2.5,
    });
    expect(r.bypassed).toBeUndefined();
    expect(r.clears).toBe(false);
  });

  // --- Bench-positive rule (non-emergency) ---
  it('blocks bench_not_positive even when the ATR margin would clear', () => {
    // bench 0% but active -10% → huge raw margin, yet bench not positive
    const r = clearsHurdleFloor({
      active: { dailyPct: -0.1 }, benchCandidate: { dailyPct: 0 },
      reason: 'haiku_decision', archetypeConfig: degen, userATR: 2.5,
    });
    expect(r.clears).toBe(false);
    expect(r.blockReason).toBe('bench_not_positive');
  });

  // --- Shape-B per-reason lookup + default fallback ---
  it('uses byReason[haiku_decision] (0.2) for a discretionary swap', () => {
    // +0.6% → 0.006/0.025 = 0.24 ATR ≥ degen haiku 0.2 → clears
    const r = call({ reason: 'haiku_decision', benchCandidate: { symbol: 'IN', dailyPct: 0.006 } });
    expect(r.clears).toBe(true);
    expect(r.required).toBe(0.2);
  });

  it('falls back to default (0.2) for an unenumerated reason (e.g. gameplan_proposal)', () => {
    const r = call({ reason: 'gameplan_proposal', benchCandidate: { symbol: 'IN', dailyPct: 0.006 } });
    expect(r.required).toBe(0.2); // degen.default.atrMultiplier
    expect(r.clears).toBe(true);
  });

  it('applies different per-reason floors per archetype (degen stagnation 0.6 vs guardian 0.5)', () => {
    const bench = { symbol: 'IN', dailyPct: 0.0125 }; // 0.0125/0.025 = 0.5 ATR
    expect(call({ archetypeConfig: degen, benchCandidate: bench }).clears).toBe(false);   // 0.5 < 0.6
    expect(call({ archetypeConfig: guardian, benchCandidate: bench }).clears).toBe(true); // 0.5 >= 0.5
  });

  // --- Disabled floor ---
  it('clears (disabled) when hurdleFloor.enabled is false', () => {
    const off = { hftConfig: { hurdleFloor: { enabled: false } } };
    const r = clearsHurdleFloor({ active: { dailyPct: 0 }, benchCandidate: { dailyPct: -1 }, reason: 'stagnation', archetypeConfig: off, userATR: 2.5 });
    expect(r.clears).toBe(true);
    expect(r.disabled).toBe(true);
  });

  // --- margin_invalid passthrough ---
  it('blocks margin_invalid when userATR is 0', () => {
    const r = call({ userATR: 0 });
    expect(r.clears).toBe(false);
    expect(r.blockReason).toBe('margin_invalid');
  });
});

// ---- Phase 5: Knob C — circuit breaker / swapWindow (§4.4) ----

describe('getRecentSwapCount — rolling-window counter (§4.4)', () => {
  // Anchor "now" at a fixed epoch; build trades relative to it.
  const NOW = Date.parse('2026-05-30T16:00:00.000Z');
  const minAgo = (m) => new Date(NOW - m * 60000).toISOString();
  const trade = (id, exitReason, minutesAgo) => ({ id, exitReason, swappedOutAt: minAgo(minutesAgo) });

  it('counts non-emergency swaps inside the window', () => {
    const trades = [
      trade('t1', 'haiku_decision', 10),
      trade('t2', 'stagnation', 20),
      trade('t3', 'gameplan_rotation', 30),
    ];
    expect(getRecentSwapCount(trades, 60, NOW)).toBe(3);
  });

  it('excludes swaps older than the window', () => {
    const trades = [
      trade('t1', 'haiku_decision', 10),   // in
      trade('t2', 'stagnation', 90),       // out (window 60)
    ];
    expect(getRecentSwapCount(trades, 60, NOW)).toBe(1);
  });

  it('window boundary: a swap exactly at the cutoff is included; just past is excluded', () => {
    expect(getRecentSwapCount([trade('t1', 'haiku_decision', 60)], 60, NOW)).toBe(1);   // ts === cutoff
    expect(getRecentSwapCount([trade('t1', 'haiku_decision', 61)], 60, NOW)).toBe(0);   // ts < cutoff
  });

  it('Trap 1 / emergency exclusion: emergency-reason swaps are NOT counted (countEmergencies false)', () => {
    const trades = [
      trade('t1', 'bust_avoidance', 5),
      trade('t2', 'vwap_failure', 5),
      trade('t3', 'stepped_trail', 5),
      trade('t4', 'guardrail_stopLoss', 5),
      trade('t5', 'guardrail_trailingStop', 5),
      trade('t6', 'haiku_decision', 5),    // the only non-emergency
      trade('t7', 'stagnation', 5),        // non-emergency
    ];
    expect(getRecentSwapCount(trades, 60, NOW)).toBe(2);
  });

  it('countEmergencies:true includes emergency-reason swaps', () => {
    const trades = [
      trade('t1', 'bust_avoidance', 5),
      trade('t2', 'haiku_decision', 5),
    ];
    expect(getRecentSwapCount(trades, 60, NOW, { countEmergencies: true })).toBe(2);
  });

  it('legacy trade missing exitReason is COUNTED (conservative non-emergency side)', () => {
    const trades = [
      { id: 't1', swappedOutAt: minAgo(5) },            // no exitReason
      trade('t2', 'guardrail_stopLoss', 5),             // emergency → excluded
    ];
    expect(getRecentSwapCount(trades, 60, NOW)).toBe(1);
  });

  it('isNaN-guards a missing / garbage swappedOutAt (skipped, not thrown, not counted)', () => {
    const trades = [
      { id: 't1', exitReason: 'haiku_decision' },                       // missing swappedOutAt
      { id: 't2', exitReason: 'haiku_decision', swappedOutAt: 'not-a-date' },
      trade('t3', 'haiku_decision', 5),                                 // valid
    ];
    expect(getRecentSwapCount(trades, 60, NOW)).toBe(1);
  });

  it('dedupes by trade id (the same record twice counts once)', () => {
    const t = trade('dup', 'haiku_decision', 5);
    expect(getRecentSwapCount([t, t], 60, NOW)).toBe(1);
  });

  it('accepts an ISO-string now as well as epoch ms', () => {
    const trades = [trade('t1', 'haiku_decision', 10)];
    expect(getRecentSwapCount(trades, 60, '2026-05-30T16:00:00.000Z')).toBe(1);
  });

  it('defensive: non-array / windowMinutes<=0 / unparseable now → 0', () => {
    expect(getRecentSwapCount(null, 60, NOW)).toBe(0);
    expect(getRecentSwapCount([trade('t1', 'haiku_decision', 5)], 0, NOW)).toBe(0);
    expect(getRecentSwapCount([trade('t1', 'haiku_decision', 5)], 60, 'bad-date')).toBe(0);
  });

  it('mixed realistic tick: only the 2 non-emergency in-window swaps count', () => {
    const trades = [
      trade('t1', 'stagnation', 2),          // count
      trade('t2', 'vwap_failure', 3),        // emergency → skip
      trade('t3', 'haiku_decision', 4),      // count
      trade('t4', 'guardrail_stopLoss', 5),  // emergency → skip
      trade('t5', 'haiku_decision', 200),    // out of window
    ];
    expect(getRecentSwapCount(trades, 60, NOW)).toBe(2);
  });

  it('future-dated swaps (ts > now) are excluded', () => {
    const future = { id: 'tf', exitReason: 'haiku_decision', swappedOutAt: new Date(NOW + 60000).toISOString() };
    expect(getRecentSwapCount([future], 60, NOW)).toBe(0);
  });
});
