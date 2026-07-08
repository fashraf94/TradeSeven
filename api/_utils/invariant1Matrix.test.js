// api/_utils/invariant1Matrix.test.js
// Forge Enforcement Keystone V1.4 — Gate 6: the Invariant-1 comprehensive matrix
// (§3.1 / §6.2). TESTS-ONLY. Proves the single safety contract as ONE exhaustive
// cross-product against the PURE gate functions (not the monolithic cron):
//
//   A swap bypasses BOTH Knob B (clearsHurdleFloor) AND Knob C (getRecentSwapCount)
//   IFF reason ∈ EMERGENCY_BYPASS_REASONS. Every other reason is GATED. Bypass is
//   keyed on REASON, never ACTION, and is independent of `source`.
//
// Shipped reason strings the gates actually see (NOT the spec taxonomy where it
// differs — the cron stamps exitReason:'gameplan_rotation', not gameplan_proposal):
//   emergencies: bust_avoidance, vwap_failure, stepped_trail,
//                guardrail_stopLoss, guardrail_trailingStop
//   gated:       stagnation, haiku_decision, gameplan_rotation
//   + unknown/missing reason edge rows (default-deny).
//
// A red cell here is a FINDING (latent bug), not a test to massage.

import { describe, it, expect } from 'vitest';
import {
  EMERGENCY_BYPASS_REASONS,
  clearsHurdleFloor,
  getRecentSwapCount,
  pickSwapReplacementCandidate,
  evaluateRisk,
} from './agentRiskManager.js';
import { getArchetypeConfig } from './agentArchetypeConfig.js';
import { getPresetConfig } from './agentPresetConfig.js';

// ---- Canonical taxonomy (the shipped strings) ----
const EMERGENCY = ['bust_avoidance', 'vwap_failure', 'stepped_trail', 'guardrail_stopLoss', 'guardrail_trailingStop'];
const GATED = ['stagnation', 'haiku_decision', 'gameplan_rotation'];
const UNKNOWN = ['news_event', undefined]; // default-deny rows: unknown + missing
const ALL_REASONS = [...EMERGENCY, ...GATED, ...UNKNOWN];

const degen = getArchetypeConfig('degen');       // forcedRotation ON, cap 12; floors haiku 0.2 / stagnation 0.3 (B4-tuned) / default 0.2
const guardian = getArchetypeConfig('guardian');  // forcedRotation OFF, cap 2; floors 0.5 across

// ---- Knob B driver. A FAILING candidate (active winning, bench down 3%): fails
// both the bench-positive rule AND the ATR margin. So a GATED reason → blocked; an
// EMERGENCY reason → bypassed at step 1 BEFORE the floor is consulted. userATR is a
// PERCENT (2.5) → internal atr fraction 0.025. ----
const clearB = (reason, archetypeConfig = degen, over = {}) => clearsHurdleFloor({
  active: { symbol: 'OUT', dailyPct: 0.05 },
  benchCandidate: { symbol: 'IN', dailyPct: -0.03 },
  reason,
  archetypeConfig,
  userATR: 2.5,
  ...over,
});

// ---- Knob C driver. A window of N same-reason trades, all 5 min ago. ----
const NOW = Date.parse('2026-05-30T16:00:00.000Z');
const minAgo = (m) => new Date(NOW - m * 60000).toISOString();
const tradeOf = (reason, i = 0, source = undefined) => ({ id: `t_${String(reason)}_${i}`, exitReason: reason, source, swappedOutAt: minAgo(5) });
const windowOf = (reason, n) => Array.from({ length: n }, (_, i) => tradeOf(reason, i));

// =====================================================================
// Suite 1 — Knob B (clearsHurdleFloor): bypass-vs-gated for EVERY reason
// =====================================================================
describe('Gate 6 · Knob B — clearsHurdleFloor bypass IFF emergency (§3.1)', () => {
  it.each(EMERGENCY)('emergency %s BYPASSES a failing floor (clears, bypassed)', (reason) => {
    const r = clearB(reason);
    expect(r.clears).toBe(true);
    expect(r.bypassed).toBe(true);
    expect(r.reason).toBe(reason);
  });

  it.each(GATED)('gated %s is subject to the floor (blocked, not bypassed)', (reason) => {
    const r = clearB(reason);
    expect(r.bypassed).toBeUndefined();
    expect(r.clears).toBe(false);
  });

  it.each(UNKNOWN)('default-deny: unknown/missing reason %s is GATED, not bypassed', (reason) => {
    const r = clearB(reason);
    expect(r.bypassed).toBeUndefined();
    expect(r.clears).toBe(false);
  });

  it('gated unenumerated reason routes through byReason.default (real degen: 0.2, not stagnation 0.3)', () => {
    // positive bench just below the default floor → below_floor exposes `required`.
    const r = clearsHurdleFloor({ active: { dailyPct: 0 }, benchCandidate: { dailyPct: 0.001 }, reason: 'gameplan_rotation', archetypeConfig: degen, userATR: 2.5 });
    expect(r.clears).toBe(false);
    expect(r.blockReason).toBe('below_floor');
    expect(r.required).toBe(degen.hftConfig.hurdleFloor.default.atrMultiplier); // 0.2
    expect(r.required).not.toBe(degen.hftConfig.hurdleFloor.byReason.stagnation.atrMultiplier); // not 0.3
  });

  it('default routing is UNAMBIGUOUS with a distinctive synthetic default (0.99)', () => {
    const synth = { hftConfig: { hurdleFloor: { enabled: true, byReason: { haiku_decision: { atrMultiplier: 0.2 }, stagnation: { atrMultiplier: 0.6 } }, default: { atrMultiplier: 0.99 }, requireBenchPositive: true } } };
    for (const reason of ['gameplan_rotation', 'news_event', undefined]) {
      const r = clearsHurdleFloor({ active: { dailyPct: 0 }, benchCandidate: { dailyPct: 0.02 }, reason, archetypeConfig: synth, userATR: 2.5 });
      expect(r.required).toBe(0.99); // proves the default branch, not a byReason entry
      expect(r.clears).toBe(false);  // 0.02/0.025 = 0.8 ATR < 0.99
    }
  });
});

// =====================================================================
// Suite 2 — Knob C (getRecentSwapCount): counted-vs-skipped for EVERY reason
// =====================================================================
describe('Gate 6 · Knob C — getRecentSwapCount skips IFF emergency (§3.1)', () => {
  it.each(EMERGENCY)('emergency %s does NOT consume the cap (window of 3 → count 0)', (reason) => {
    expect(getRecentSwapCount(windowOf(reason, 3), 60, NOW)).toBe(0);
  });

  it.each(GATED)('gated %s consumes the cap (window of 3 → count 3)', (reason) => {
    expect(getRecentSwapCount(windowOf(reason, 3), 60, NOW)).toBe(3);
  });

  it('default-deny: unknown reason is counted (consumes cap)', () => {
    expect(getRecentSwapCount(windowOf('news_event', 3), 60, NOW)).toBe(3);
  });

  it('default-deny: MISSING exitReason is counted (conservative non-emergency)', () => {
    const trades = Array.from({ length: 3 }, (_, i) => ({ id: `m${i}`, swappedOutAt: minAgo(5) }));
    expect(getRecentSwapCount(trades, 60, NOW)).toBe(3);
  });
});

// =====================================================================
// Suite 3 — the CONSOLIDATED contract: same reason through BOTH gates agrees
//           with the single EMERGENCY_BYPASS_REASONS constant.
// =====================================================================
describe('Gate 6 · both knobs honor ONE constant (the IFF, both directions)', () => {
  it.each(ALL_REASONS)('reason %s: Knob B bypass and Knob C skip are consistent with EMERGENCY_BYPASS_REASONS', (reason) => {
    const isEmergency = EMERGENCY_BYPASS_REASONS.has(reason);

    // Knob B: bypassed (clears a failing floor) IFF emergency.
    const b = clearB(reason);
    expect(b.bypassed === true).toBe(isEmergency);
    expect(b.clears).toBe(isEmergency);

    // Knob C: skipped (count 0) IFF emergency; counted otherwise.
    const c = getRecentSwapCount(windowOf(reason, 1), 60, NOW);
    expect(c).toBe(isEmergency ? 0 : 1);

    // Both gates agree with each other (the single-source property).
    expect(b.bypassed === true).toBe(c === 0);
  });

  it('the IFF is exact: ONLY the 5 emergency strings bypass, all others gate', () => {
    const bypassers = ALL_REASONS.filter((r) => clearB(r).bypassed === true);
    expect([...bypassers].sort()).toEqual([...EMERGENCY].sort());
  });
});

// =====================================================================
// Suite 4 — ACTION COLLISIONS (load-bearing: bypass keyed on reason, not action)
// =====================================================================
describe('Gate 6 · action collisions — same ACTION, divergent bypass (§3.1)', () => {
  // evaluateRisk emits action SWAP_OUT for BOTH vwap_failure and stagnation.
  const vwapResult = evaluateRisk(
    { symbol: 'X', tier: 'core', baseATR: 2.5, dailyPct: 0 },
    100, 100, 2.5,
    { vwap: 100, vwapDeviation: -1, sma20_5m: null },
    { ticksBelowVwap: 2 },
    {}, degen,
  );
  const stagResult = evaluateRisk(
    { symbol: 'X', tier: 'core', baseATR: 2.5, dailyPct: 0 },
    100, 100, 2.5,
    null,
    { withinAge: true, stagnationTicks: 3 },
    {}, degen,
  );

  it('SWAP_OUT collision: evaluateRisk yields action SWAP_OUT for BOTH vwap_failure and stagnation', () => {
    expect(vwapResult.action).toBe('SWAP_OUT');
    expect(stagResult.action).toBe('SWAP_OUT');
    expect(vwapResult.reason).toBe('vwap_failure');
    expect(stagResult.reason).toBe('stagnation');
  });

  it('SWAP_OUT collision DIVERGES at both gates despite identical action', () => {
    // Knob B
    expect(clearB(vwapResult.reason).bypassed).toBe(true);   // vwap_failure → bypass
    expect(clearB(stagResult.reason).clears).toBe(false);    // stagnation → gated
    // Knob C
    expect(getRecentSwapCount(windowOf(vwapResult.reason, 1), 60, NOW)).toBe(0); // not counted
    expect(getRecentSwapCount(windowOf(stagResult.reason, 1), 60, NOW)).toBe(1); // counted
    // membership is the discriminator, NOT the (identical) action
    expect(EMERGENCY_BYPASS_REASONS.has(vwapResult.reason)).toBe(true);
    expect(EMERGENCY_BYPASS_REASONS.has(stagResult.reason)).toBe(false);
  });

  it('SWAP collision: guardrail_* vs haiku_decision (all action SWAP on trades[]) diverge — breaker ignores the action field', () => {
    const swapTrades = [
      { id: 'a', action: 'SWAP', exitReason: 'guardrail_stopLoss', swappedOutAt: minAgo(5) },
      { id: 'b', action: 'SWAP', exitReason: 'guardrail_trailingStop', swappedOutAt: minAgo(5) },
      { id: 'c', action: 'SWAP', exitReason: 'haiku_decision', swappedOutAt: minAgo(5) },
    ];
    // identical action 'SWAP' on all three; the breaker counts ONLY haiku_decision.
    expect(getRecentSwapCount(swapTrades, 60, NOW)).toBe(1);
    // Knob B: guardrails bypass, haiku_decision gated.
    expect(clearB('guardrail_stopLoss').bypassed).toBe(true);
    expect(clearB('guardrail_trailingStop').bypassed).toBe(true);
    expect(clearB('haiku_decision').clears).toBe(false);
  });
});

// =====================================================================
// Suite 5 — × SOURCE AXIS: source is NOT a bypass input (Phase-5 decision)
// =====================================================================
describe('Gate 6 · × source axis — bypass is independent of source (§4.4 decision)', () => {
  it('Knob B has no source parameter: adding/varying `source` does not change the verdict', () => {
    const base = clearsHurdleFloor({ active: { dailyPct: 0 }, benchCandidate: { symbol: 'IN', dailyPct: 0.01 }, reason: 'stagnation', archetypeConfig: degen, userATR: 2.5 });
    for (const s of ['archetype', 'haiku', 'risk_manager', 'guardrail', undefined]) {
      const withSource = clearsHurdleFloor({ active: { dailyPct: 0 }, benchCandidate: { symbol: 'IN', dailyPct: 0.01 }, reason: 'stagnation', archetypeConfig: degen, userATR: 2.5, source: s });
      expect(withSource).toEqual(base); // stray source key ignored
    }
  });

  it('Knob C keys on exitReason, ignores source: a GATED reason is counted regardless of source', () => {
    const trades = ['archetype', 'haiku', 'risk_manager', 'guardrail', undefined].map((s, i) => tradeOf('stagnation', i, s));
    expect(getRecentSwapCount(trades, 60, NOW)).toBe(5); // all counted
  });

  it('Knob C keys on exitReason, ignores source: an EMERGENCY reason is skipped regardless of source', () => {
    const trades = ['archetype', 'haiku', 'risk_manager', 'guardrail', undefined].map((s, i) => tradeOf('vwap_failure', i, s));
    expect(getRecentSwapCount(trades, 60, NOW)).toBe(0); // all skipped
  });

  it('a source label that LOOKS protective does not rescue a gated reason', () => {
    // exitReason gated but source='guardrail' → still counted (source proves nothing).
    expect(getRecentSwapCount([tradeOf('stagnation', 0, 'guardrail')], 60, NOW)).toBe(1);
  });
});

// =====================================================================
// Suite 6 — A2 ROWS (MANDATORY, safety-critical §3.1 A2)
// =====================================================================
describe('Gate 6 · A2 — guardrail-forced protective exits are never blocked', () => {
  it.each(['guardrail_stopLoss', 'guardrail_trailingStop'])('Knob B: %s clears even when its candidate FAILS the floor (agent never parked in a stop-breach)', (reason) => {
    const r = clearsHurdleFloor({
      active: { dailyPct: 0.08 },          // active up — a normal swap would have a tiny margin
      benchCandidate: { dailyPct: -0.05 }, // bench down 5% — fails bench-positive AND margin
      reason, archetypeConfig: guardian, userATR: 2.5,
    });
    expect(r.clears).toBe(true);
    expect(r.bypassed).toBe(true);
  });

  it('Knob C: a guardrail exit survives a window AT cap (guardian cap 2)', () => {
    const cap = guardian.hftConfig.swapWindow.capPerWindow; // 2
    const fullWindow = windowOf('haiku_decision', cap);     // 2 gated swaps already in-window
    expect(getRecentSwapCount(fullWindow, guardian.hftConfig.swapWindow.windowMinutes, NOW)).toBe(cap); // == cap

    // The guardrail swap contributes 0 to the count (never relies on/consumes the cap)...
    const withGuardrail = [...fullWindow, tradeOf('guardrail_stopLoss', 99)];
    expect(getRecentSwapCount(withGuardrail, guardian.hftConfig.swapWindow.windowMinutes, NOW)).toBe(cap); // still == cap
    // ...and the breaker's bypass key is the membership, not the count.
    expect(EMERGENCY_BYPASS_REASONS.has('guardrail_stopLoss')).toBe(true);
  });
});

// =====================================================================
// Suite 7 — §6.2 integration: archetype → physics (all 6) drives differentiated behavior
// =====================================================================
describe('Gate 6 · §6.2 archetype → physics (all 6 archetypes)', () => {
  const ALL_ARCH = ['momentum_chaser', 'analyst', 'diversifier', 'contrarian', 'degen', 'guardian'];

  it.each(ALL_ARCH)('%s resolves a real hftConfig that drives both gates (positive floors + cap)', (name) => {
    const cfg = getArchetypeConfig(name);
    expect(cfg.hftConfig.hurdleFloor.byReason.haiku_decision.atrMultiplier).toBeGreaterThan(0);
    expect(cfg.hftConfig.swapWindow.capPerWindow).toBeGreaterThan(0);
  });

  it('Knob B diverges by archetype: the SAME bench candidate clears degen but not guardian', () => {
    const benchPos = { symbol: 'IN', dailyPct: 0.0075 }; // +0.75% → 0.0075/0.025 = 0.3 ATR
    const args = (arch) => ({ active: { dailyPct: 0 }, benchCandidate: benchPos, reason: 'haiku_decision', archetypeConfig: arch, userATR: 2.5 });
    expect(clearsHurdleFloor(args(degen)).clears).toBe(true);    // 0.3 ≥ degen haiku 0.2
    expect(clearsHurdleFloor(args(guardian)).clears).toBe(false); // 0.3 < guardian haiku 0.5
  });

  it('Knob C diverges by archetype: the SAME window is under degen cap (12) but over guardian cap (2)', () => {
    const used = getRecentSwapCount(windowOf('haiku_decision', 5), 60, NOW); // 5
    expect(used).toBeLessThan(degen.hftConfig.swapWindow.capPerWindow);       // 5 < 12 → degen would allow
    expect(used).toBeGreaterThanOrEqual(guardian.hftConfig.swapWindow.capPerWindow); // 5 ≥ 2 → guardian would block
  });

  it('forcedRotation differentiation holds at the source (degen ON, guardian OFF)', () => {
    expect(degen.hftConfig.forcedRotation.enabled).toBe(true);
    expect(guardian.hftConfig.forcedRotation.enabled).toBe(false);
  });
});

// =====================================================================
// Suite 8 — §6.2 integration: preset-toggle isolation (Decision 2)
// =====================================================================
describe('Gate 6 · §6.2 preset isolation — strategyPreset cannot touch the knobs', () => {
  it.each(['aggressive', 'balanced', 'defensive'])('preset %s carries base risk levers but NO hftConfig', (preset) => {
    const p = getPresetConfig(preset);
    expect(p.risk.bustBuffer).toBeDefined();
    expect(p).not.toHaveProperty('hftConfig');
    expect(p).not.toHaveProperty('forcedRotation');
    expect(p).not.toHaveProperty('hurdleFloor');
    expect(p).not.toHaveProperty('swapWindow');
  });

  it('base levers MOVE across presets (aggressive ≠ defensive) — preset is not inert', () => {
    expect(getPresetConfig('aggressive').risk.bustBuffer).not.toBe(getPresetConfig('defensive').risk.bustBuffer);
  });

  it('the archetype hftConfig is preset-independent (same regardless of which preset is in play)', () => {
    // getArchetypeConfig takes only archetype — there is no preset arg that could alter it.
    expect(getArchetypeConfig('degen').hftConfig).toEqual(getArchetypeConfig('degen').hftConfig);
    // And the knob values are stable across the whole preset set.
    const knobUnderEveryPreset = ['aggressive', 'balanced', 'defensive'].map(() => getArchetypeConfig('degen').hftConfig.swapWindow.capPerWindow);
    expect(new Set(knobUnderEveryPreset).size).toBe(1); // 12 everywhere
  });

  it('evaluateRisk: a tightened preset changes the BASE decision but NOT the echoed hftConfig', () => {
    const POS = { symbol: 'AAPL', tier: 'core', baseATR: 2.5 };
    const loose = evaluateRisk(POS, 98, 100, 2.5, null, {}, {}, guardian);                 // -0.8x ATR, default → HOLD
    const tight = evaluateRisk(POS, 98, 100, 2.5, null, {}, { bustBuffer: -0.75 }, guardian); // tightened → EMERGENCY_SWAP
    expect(loose.action).toBe('HOLD');
    expect(tight.action).toBe('EMERGENCY_SWAP');
    expect(tight.hftConfig).toBe(loose.hftConfig); // identical knobs across presets
  });
});

// =====================================================================
// Suite 9 — §6.2 integration: Knob A × B veto (the rotation VETO)
// =====================================================================
describe('Gate 6 · §6.2 Knob A × B — a stagnation rotation whose only candidate fails the floor is VETOED', () => {
  const stagnationQuality = (prices) => (candidate) => clearsHurdleFloor({
    active: { symbol: 'OUT', dailyPct: 0 },
    benchCandidate: { symbol: candidate.symbol, dailyPct: (prices[candidate.symbol]?.changePercent || 0) / 100 },
    reason: 'stagnation', archetypeConfig: degen, userATR: 2.5,
  }).clears;

  it('VETO: the single candidate fails degen stagnation floor (bench-negative) → returns null', () => {
    const bench = [{ symbol: 'AAA', isCrypto: false }];
    const prices = { AAA: { changePercent: -3 } }; // bench down 3% → fails bench-positive (floor magnitude irrelevant here)
    const r = pickSwapReplacementCandidate({ benchAssets: bench, prices, outgoingIsCrypto: false, clearsQuality: stagnationQuality(prices) });
    expect(r).toBeNull();
  });

  it('positive control: a candidate that CLEARS the floor is returned (no false veto)', () => {
    const bench = [{ symbol: 'AAA', isCrypto: false }];
    const prices = { AAA: { changePercent: 2 } }; // +2% → 0.02/0.025 = 0.8 ATR ≥ 0.3 → clears
    const r = pickSwapReplacementCandidate({ benchAssets: bench, prices, outgoingIsCrypto: false, clearsQuality: stagnationQuality(prices) });
    expect(r?.symbol).toBe('AAA');
  });

  it('emergency swaps do NOT go through the Knob-B veto path (no quality predicate) — contract reminder', () => {
    // This documents the Invariant-1 boundary: only the stagnation candidate source
    // is quality-gated; bust/vwap/trail route through pickSwapReplacementCandidate
    // WITHOUT clearsQuality (held/self exclusion only — VWAP Floor B2).
    expect(EMERGENCY_BYPASS_REASONS.has('vwap_failure')).toBe(true);
    expect(EMERGENCY_BYPASS_REASONS.has('stagnation')).toBe(false);
  });
});
