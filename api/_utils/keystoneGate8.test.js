// api/_utils/keystoneGate8.test.js
// Forge Enforcement Keystone V1.4 — Phase 8 behavioral verification, the MECHANISM
// half (gates 8C / 8D / 8E, §6.3). TESTS-ONLY, against the pure gate functions.
//
// Phase 8 splits and the halves must NOT be conflated:
//   - MECHANISM (8C / 8D / 8E) — calibration-independent, verifiable NOW. This file.
//     Passing 8D/8E IS the mechanism merge-unblock signal.
//   - CALIBRATION (8A / 8B) — post-merge; needs real battle data AND the
//     bench-staleness rescore landed first. Documented (no green cells fabricated)
//     in FORGE_KEYSTONE_PHASE8_CALIBRATION_PLAN.md, NOT here.
//
// Most of the mechanism is already proven by the Phase-7 matrix (invariant1Matrix
// .test.js, 61 cells). This file adds only the three properties that matrix does
// not isolate: the 8C margin-coherence FINDING (a delete-on-unification tripwire),
// the 8D within-tick binding SIMULATION (the one unproven dynamic property), and an
// 8E no-inversion roll-up that references — does not rebuild — the matrix.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  EMERGENCY_BYPASS_REASONS,
  computeBenchVsActiveMargin,
  clearsHurdleFloor,
  getRecentSwapCount,
} from './agentRiskManager.js';
import { evaluateTriggers } from './agentTriggerGate.js';
import { getArchetypeConfig } from './agentArchetypeConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRIGGER_GATE_SOURCE = resolve(__dirname, 'agentTriggerGate.js');

// ---- Shared fixtures ----
const NOW = Date.parse('2026-05-30T16:00:00.000Z');
const NOW_ISO = new Date(NOW).toISOString();
const minAgo = (m) => new Date(NOW - m * 60000).toISOString();

const degen = getArchetypeConfig('degen');       // cap 12, window 60; forcedRotation ON; stagnation floor 0.3 (B4-tuned)
const guardian = getArchetypeConfig('guardian');  // cap  2, window 120; forcedRotation OFF; stagnation floor 0.5

// =====================================================================
// Suite 8C — margin-coherence CHARACTERIZATION (the §7.1 FINDING, encoded honestly)
// =====================================================================
//
// CHARACTERIZATION: records the 8C margin divergence — the pre-Haiku WAKE trigger
// (agentTriggerGate.js bench_outperformance) uses a bench-ONLY margin
// `changePct / baseATR`, while the hurdle FLOOR (clearsHurdleFloor →
// computeBenchVsActiveMargin) uses a bench-MINUS-active margin
// `(bench − active) / atr`. §7.1 intended ONE shared formula consumed by both; it
// is not. This suite asserts the CURRENT state, NOT the desired one. When the two
// formulas are reconciled, these tests SHOULD FAIL and be DELETED as part of that
// change. See the 8C finding / FORGE_KEYSTONE_PHASE8_CALIBRATION_PLAN.md.
//
// GATE STATUS: 8C fails the §7.1 cross-component COHERENCE clause ONLY — not any
// safety/knob clause. Every safety clause (floor blocks below-floor swaps,
// emergencies bypass, non-emergencies are gated) already PASSES in the Phase-7
// matrix. 8D/8E carry the merge-unblock; 8C is a known-open coherence finding.
describe('Gate 8C · margin-coherence characterization — trigger wake vs hurdle floor DIVERGE (§7.1 FINDING)', () => {
  const triggerSource = readFileSync(TRIGGER_GATE_SOURCE, 'utf-8');

  // The structural proof the formula is DUPLICATED, not shared: the trigger gate
  // cannot be consuming the canonical helper because it never imports it (it only
  // imports agentScoring), yet it computes its own inline bench-only margin.
  it('TRIPWIRE: agentTriggerGate.js does NOT import the shared margin helper (runs its own inline math)', () => {
    expect(triggerSource).not.toMatch(/computeBenchVsActiveMargin/);
    expect(triggerSource).not.toMatch(/from\s*'\.\/agentRiskManager\.js'/);
    // ...and the bench-ONLY inline form is really present (anchors the replication below).
    expect(triggerSource).toMatch(/dailyChangePct\s*\/\s*benchATR/);
  });

  // The numeric core of the finding. The trigger value is bench-only; the helper is
  // bench-minus-active. The ratio is UNIT-INVARIANT (percent vs fraction cancels),
  // so the divergence below is purely SEMANTIC (the −active term), not a unit bug.
  it('TRIPWIRE: the two margins diverge on a shared fixture when the active is winning (helper < trigger)', () => {
    // Shared market state: bench +2% on the day, active +1.5%, active baseATR 2.5%.
    const benchChangePct = 2.0;   // trigger gate reads price.changePercent (PERCENT)
    const baseATR = 2.5;          // bench baseATR (PERCENT)
    const benchDailyPct = 0.02;   // helper reads dailyPct (FRACTION)
    const activeDailyPct = 0.015;
    const atrValue = baseATR / 100; // helper's LANDMINE-1 conversion → 0.025

    // Mirrors agentTriggerGate.js:104 — bench-ONLY (anchored by the static assert above).
    const triggerBenchAtr = benchChangePct / baseATR;                  // 2.0 / 2.5 = 0.8
    const helper = computeBenchVsActiveMargin({ activeDailyPct, benchDailyPct, atrValue });

    expect(triggerBenchAtr).toBeCloseTo(0.8, 10);
    expect(helper.marginAtrUnits).toBeCloseTo(0.2, 10);              // (0.02−0.015)/0.025
    // They DIVERGE, and the wake signal reads STRONGER than the real advantage.
    expect(helper.marginAtrUnits).toBeLessThan(triggerBenchAtr);
    expect(helper.marginAtrUnits).not.toBeCloseTo(triggerBenchAtr, 5);
  });

  it('TRIPWIRE: the divergence IS the −active term — the two coincide only when the active is flat', () => {
    const benchChangePct = 2.0, baseATR = 2.5, benchDailyPct = 0.02, atrValue = 0.025;
    const triggerBenchAtr = benchChangePct / baseATR;                 // 0.8
    const helperFlat = computeBenchVsActiveMargin({ activeDailyPct: 0, benchDailyPct, atrValue });
    // active flat ⇒ bench-minus-active collapses to bench-only ⇒ same number.
    expect(helperFlat.marginAtrUnits).toBeCloseTo(triggerBenchAtr, 10);
  });

  // The finding demonstrated end-to-end with BOTH real functions on ONE market
  // state: "woken by formula X, blocked by formula Y."
  it('FINDING (real functions): the SAME portfolio state WAKES Haiku (bench trigger) yet BLOCKS the swap of its winning position', () => {
    const battle = {
      evaluations: [{ at: minAgo(30) }],    // not the first eval → no forced_open
      // no `timing` → computePhaseFromBattle returns 'MID' (not FINAL_HOUR)
      portfolio: { bench: { stocks: [{ symbol: 'BENCH', baseATR: 2.5 }] } },
    };
    // ONE portfolio, two positions: a LAGGING name (priceChange ≤ 0) opens the
    // bench-outperformance wake (hasWeakActive), while a separate WINNING name sits
    // in the same book — that winner is the rotation candidate the hurdle gates below.
    const assetScores = [
      { symbol: 'WEAK', priceChange: -0.2, multiplier: 0, badges: [] }, // opens hasWeakActive → wake
      { symbol: 'WINNER', priceChange: 1.5, multiplier: 0, badges: [] }, // +1.5% — the rotation candidate
    ];
    const prices = { BENCH: { changePercent: 2.0 } };  // bench +2% → 2.0/2.5 = 0.8x ATR ≥ 0.5

    const woken = evaluateTriggers(battle, assetScores, prices, null, null, []);
    expect(woken.shouldEvaluate).toBe(true);
    expect(woken.triggers.some(t => t.type === 'bench_outperformance')).toBe(true);

    // The WINNER position is the rotation candidate. Against the SAME bench (+2%),
    // its bench-minus-active margin (0.2x) is below the degen stagnation floor
    // (0.3x after the B4 tuning) — so the swap the wake just invited would be BLOCKED.
    const hurdle = clearsHurdleFloor({
      active: { symbol: 'WINNER', dailyPct: 0.015 },
      benchCandidate: { symbol: 'BENCH', dailyPct: 0.02 },
      reason: 'stagnation', archetypeConfig: degen, userATR: 2.5,
    });
    expect(hurdle.clears).toBe(false);
    expect(hurdle.blockReason).toBe('below_floor');
  });
});

// =====================================================================
// Suite 8D — within-tick binding SIMULATION (GAP 1: the one unproven dynamic property)
// =====================================================================
//
// The circuit breaker (getRecentSwapCount) binds the Nth forced rotation in a
// burst ONLY if the cron re-reads the LIVE, growing battle.trades[] each iteration.
// The Phase-5 static guard (agent-evaluate.test.js) proves the CRON wires that live
// re-read in-loop; this sim proves the LOGIC binds: the count rises within the tick,
// so exactly `cap` rotations fire and the rest skip. Together they close 8D.
describe('Gate 8D · within-tick binding — getRecentSwapCount caps a burst as trades[] grows', () => {
  // Simulate one cron tick attempting more stagnation rotations than the cap allows.
  // The breaker reads the live, growing trades[] every iteration (within-tick binding).
  const simulateForcedRotationTick = ({ cap, windowMinutes, attempts }) => {
    const trades = [];
    let executed = 0;
    for (let i = 0; i < attempts; i++) {
      if (getRecentSwapCount(trades, windowMinutes, NOW) >= cap) continue;   // breaker skips
      trades.push({ id: `r${i}`, exitReason: 'stagnation', swappedOutAt: NOW_ISO });
      executed++;
    }
    return { trades, executed, gatedCount: getRecentSwapCount(trades, windowMinutes, NOW) };
  };

  it('degen (cap 12): exactly cap rotations fire across cap+3 attempts; the rest skip', () => {
    const cap = degen.hftConfig.swapWindow.capPerWindow;            // 12
    const windowMinutes = degen.hftConfig.swapWindow.windowMinutes; // 60
    const { executed, gatedCount } = simulateForcedRotationTick({ cap, windowMinutes, attempts: cap + 3 });
    expect(executed).toBe(cap);     // binding held within the tick
    expect(gatedCount).toBe(cap);   // the live count saturated at the cap
  });

  it('guardian (cap 2): exactly cap rotations fire across cap+3 attempts; the rest skip', () => {
    const cap = guardian.hftConfig.swapWindow.capPerWindow;            // 2
    const windowMinutes = guardian.hftConfig.swapWindow.windowMinutes; // 120
    const { executed, gatedCount } = simulateForcedRotationTick({ cap, windowMinutes, attempts: cap + 3 });
    expect(executed).toBe(cap);
    expect(gatedCount).toBe(cap);
  });

  it('the LIVE re-read is what binds — a FROZEN pre-tick count lets the whole burst through (17), the live reader caps it (12)', () => {
    const cap = degen.hftConfig.swapWindow.capPerWindow; // 12
    const attempts = cap + 5;                            // 17
    // FROZEN reader: the count is snapshotted ONCE before the loop (the pre-tick
    // value) and never re-read, so it stays 0 < cap and every attempt fires.
    const frozenCount = getRecentSwapCount([], 60, NOW); // 0, captured once
    let frozenExecuted = 0;
    for (let i = 0; i < attempts; i++) { if (frozenCount >= cap) continue; frozenExecuted++; }
    expect(frozenExecuted).toBe(attempts);               // 17 — a frozen count does NOT bind
    // LIVE reader: re-reads the growing trades[] each iteration → binds at the cap.
    const { executed } = simulateForcedRotationTick({ cap, windowMinutes: 60, attempts });
    expect(executed).toBe(cap);                          // 12 — the live re-read is the binding
    expect(executed).toBeLessThan(frozenExecuted);       // 12 < 17 — the contrast is the whole point
  });

  it('8D emergency bypass: an emergency rotation fires even at cap and does NOT consume the window', () => {
    const cap = degen.hftConfig.swapWindow.capPerWindow;             // 12
    const windowMinutes = degen.hftConfig.swapWindow.windowMinutes;  // 60
    const { trades, gatedCount } = simulateForcedRotationTick({ cap, windowMinutes, attempts: cap + 3 });
    expect(gatedCount).toBe(cap);
    // A further GATED rotation would be skipped (window is at cap)...
    expect(getRecentSwapCount(trades, windowMinutes, NOW) >= cap).toBe(true);
    // ...but the emergency branch never consults the cap → it "executes". Adding the
    // emergency trade does NOT raise the gated count (excluded by reason).
    trades.push({ id: 'emg', exitReason: 'vwap_failure', swappedOutAt: NOW_ISO });
    expect(getRecentSwapCount(trades, windowMinutes, NOW)).toBe(cap); // still 12, not 13
    expect(EMERGENCY_BYPASS_REASONS.has('vwap_failure')).toBe(true);  // membership is the discriminator
  });
});

// =====================================================================
// Suite 8E — no-inversion roll-up (consolidated; references invariant1Matrix Suites 7/8)
// =====================================================================
//
// The matrix already proves per-knob archetype divergence (Suite 7) and preset
// isolation (Suite 8). This roll-up asserts only the consolidated cross-archetype
// property: at the mechanism level degen permits STRICTLY MORE non-emergency
// trading than guardian, and the floor ordering cannot invert that.
describe('Gate 8E · no-inversion roll-up — degen out-trades guardian at the mechanism level (refs matrix Suites 7/8)', () => {
  it('degen permits strictly more non-emergency churn than guardian (cap + forcedRotation)', () => {
    expect(degen.hftConfig.swapWindow.capPerWindow)
      .toBeGreaterThan(guardian.hftConfig.swapWindow.capPerWindow);   // 12 > 2
    expect(degen.hftConfig.forcedRotation.enabled).toBe(true);
    expect(guardian.hftConfig.forcedRotation.enabled).toBe(false);
  });

  it('the B4-loosened degen stagnation floor (0.3 ≤ guardian 0.5) REINFORCES, not inverts, the ordering', () => {
    // Release 1 (B4) lowered degen's stagnation floor 0.6→0.3, so it is now BELOW
    // guardian's 0.5. A lower floor is EASIER to clear → MORE permissive, which now
    // ALIGNS the floor ordering with the trade-frequency ordering (degen out-trades
    // guardian). Combined with degen's higher cap and enabled forced rotation, this
    // strengthens the ordering rather than inverting it — the pre-B4 "looks backwards
    // but is compensated" tension is gone.
    expect(degen.hftConfig.hurdleFloor.byReason.stagnation.atrMultiplier)
      .toBeLessThanOrEqual(guardian.hftConfig.hurdleFloor.byReason.stagnation.atrMultiplier);
    expect(guardian.hftConfig.forcedRotation.enabled).toBe(false);
  });

  it('the knobs are archetype-locked — there is no preset arg that could alter either cap (see Suite 8)', () => {
    // getArchetypeConfig takes only archetype; preset cannot reach the cap.
    expect(getArchetypeConfig('degen').hftConfig.swapWindow.capPerWindow).toBe(12);
    expect(getArchetypeConfig('guardian').hftConfig.swapWindow.capPerWindow).toBe(2);
  });
});
