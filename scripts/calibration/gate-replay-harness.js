#!/usr/bin/env node
// scripts/calibration/gate-replay-harness.js
// Knob Calibration Task B — Phase B2: gate-replay harness.
//
// Drives synthetic (and, where state permits, replayed-real) battle states through
// the REAL pure decision gates and synthesizes the metrics that recorded battle
// data cannot yield (B1 covers the real-data half). Imports:
//   - resolveHurdleAtr / buildFreshAtrPercentileMap  (api/_utils/hurdleAtr.js — Task A, from main)
//   - evaluateRisk / clearsHurdleFloor / getRecentSwapCount / updateStagnationCounter
//     / EMERGENCY_BYPASS_REASONS                      (api/_utils/agentRiskManager.js, FENCED — called only)
//   - evaluateTriggers                               (api/_utils/agentTriggerGate.js — the wake gate)
//   - getArchetypeConfig                             (api/_utils/agentArchetypeConfig.js)
//
// Captures, per archetype × preset:
//   - full hurdle verdicts incl. blockReason (below_floor / bench_not_positive / margin_invalid)
//   - forced-rotation fires vs executed vs vetoed vs capped
//   - swap-window cap hits (Knob C)
//   - wake-starvation rate (Decision 2 gate): fraction of hurdle-clearing swap
//     opportunities whose chosen candidate would NOT fire the bench_outperformance
//     wake (hurdle allows the swap, wake never opens the door). PASS < 5% and no
//     material worsening under stress. `wake-but-never-clears` is monitor-only.
//   - fresh-vs-frozen ATR deltas (A1 effect): how often / how much the hurdle
//     divisor moved off the frozen swap-in baseATR.
//
// Emergencies (bust/vwap/trail) are NOT synthesized here (intradaySnapshot=null),
// so only Knob-A stagnation rotations fire — B2 isolates Knobs A/B/C + wake; the
// emergency-bypass frequency + 8B stagnation-share come from B1 real data.
//
// Deterministic: seeded PRNG + pure gates + a fixed BASE_TIME (no Date.now).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  evaluateRisk,
  clearsHurdleFloor,
  getRecentSwapCount,
  updateStagnationCounter,
} from '../../api/_utils/agentRiskManager.js';
import { resolveHurdleAtr, buildFreshAtrPercentileMap } from '../../api/_utils/hurdleAtr.js';
import { evaluateTriggers } from '../../api/_utils/agentTriggerGate.js';
import { getArchetypeConfig } from '../../api/_utils/agentArchetypeConfig.js';
import { genUniverse, PRESETS, NORMAL_PRESETS } from './synthetic-universe.js';

export const TICK_MS = 15 * 60 * 1000;
export const BASE_TIME = Date.parse('2026-05-30T13:30:00.000Z');
// Ordering-invariant archetypes, fastest → slowest (design §5.2 / Gate 8A).
export const ORDER = ['degen', 'momentum_chaser', 'analyst', 'diversifier', 'contrarian', 'guardian'];

const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

// Would `candidate` fire the bench_outperformance WAKE? Uses the real
// evaluateTriggers, isolated with a guaranteed-weak active so only the
// candidate's own bench-only signal (dailyChangePct / benchATR ≥ 0.5) decides.
// Deterministic: no `timing` → computePhaseFromBattle returns 'MID' before any clock read.
export function candidateWakes(candSymbol, candDailyPctFraction, candBaseATR) {
  const battle = {
    evaluations: [{ at: new Date(BASE_TIME - 30 * 60000).toISOString() }], // non-empty → not forced_open
    portfolio: { bench: { stocks: [{ symbol: candSymbol, baseATR: candBaseATR }] } },
  };
  const assetScores = [{ symbol: '__ACTIVE__', priceChange: -0.1, multiplier: 0, badges: [] }]; // weak active
  const prices = { [candSymbol]: { changePercent: candDailyPctFraction * 100 } };
  const res = evaluateTriggers(battle, assetScores, prices, null, null, []);
  return res.triggers.some((t) => t.type === 'bench_outperformance' && t.detail.includes(candSymbol));
}

// Replay one archetype over one synthetic universe. Returns the metric bundle.
export function replayScenario({ archetype, universe }) {
  const cfg = getArchetypeConfig(archetype);
  const fr = cfg.hftConfig.forcedRotation;
  const swCfg = cfg.hftConfig.swapWindow;
  const held = universe.held;
  const bench = universe.bench;

  const frozenAtrOf = new Map(universe.symbols.map((s) => [s.symbol, s.ticks[0].atrPercentile * 8]));
  const mem = new Map(held.map((s) => [s.symbol, { stagnationTicks: 0, lastTickPrice: null, lastTickTimestamp: null }]));
  const executedTrades = [];

  const m = {
    forcedRotation: { fires: 0, executed: 0, vetoed: 0, capped: 0 },
    hurdle: { evaluations: 0, cleared: 0, blocked: { below_floor: 0, bench_not_positive: 0, margin_invalid: 0 } },
    swapWindow: { capHits: 0 },
    atrFreshness: { fresh: 0, frozen: 0, sumAbsDelta: 0 },
    wakeStarvation: { clearingOpportunities: 0, starved: 0, wakeButNeverClears: 0 },
  };

  for (let t = 1; t < universe.nTicks; t++) {
    const now = BASE_TIME + t * TICK_MS;
    const freshMap = buildFreshAtrPercentileMap(
      universe.symbols.map((s) => ({ symbol: s.symbol, atrPercentile: s.ticks[t].atrPercentile })),
    );

    for (const active of held) {
      const at = active.ticks[t];
      const cronMem = mem.get(active.symbol);
      const stag = updateStagnationCounter({
        currentPrice: at.price,
        lastTickPrice: cronMem.lastTickPrice,
        lastTickTimestamp: cronMem.lastTickTimestamp,
        now,
        pctThreshold: fr.pctThreshold,
        maxTickAgeMinutes: fr.maxTickAgeMinutes,
        stagnationTicks: cronMem.stagnationTicks,
      });
      cronMem.stagnationTicks = stag.stagnationTicks;
      cronMem.lastTickPrice = stag.lastTickPrice;
      cronMem.lastTickTimestamp = stag.lastTickTimestamp;

      const frozenAtr = frozenAtrOf.get(active.symbol);
      const risk = evaluateRisk(
        { symbol: active.symbol, tier: 'star', baseATR: frozenAtr, dailyPct: at.dailyPct },
        at.price,
        active.entryPrice,
        frozenAtr,
        null, // no intraday snapshot → isolate Knob A stagnation (no bust/vwap/trail emergencies)
        { ticksBelowVwap: 0, stagnationTicks: stag.stagnationTicks, withinAge: stag.withinAge },
        {},
        cfg,
      );
      if (risk.action !== 'SWAP_OUT' || risk.reason !== 'stagnation') continue;
      m.forcedRotation.fires++;

      // Knob C: circuit breaker on forced rotation.
      const used = getRecentSwapCount(executedTrades, swCfg.windowMinutes, now, { countEmergencies: swCfg.countEmergencies });
      if (used >= swCfg.capPerWindow) {
        m.forcedRotation.capped++;
        m.swapWindow.capHits++;
        continue;
      }

      // A1: hurdle divisor from the fresh rankings (frozen fallback verbatim).
      const resolved = resolveHurdleAtr(active.symbol, freshMap, frozenAtr);
      if (resolved.source === 'fresh') {
        m.atrFreshness.fresh++;
        m.atrFreshness.sumAbsDelta += Math.abs(resolved.atr - frozenAtr);
      } else {
        m.atrFreshness.frozen++;
      }

      // Candidates by momentum desc (mirrors pickSwapReplacementCandidate); first clearer wins.
      const cands = bench
        .map((b) => ({ symbol: b.symbol, dailyPct: b.ticks[t].dailyPct, baseATR: b.ticks[t].atrPercentile * 8 }))
        .sort((a, b) => b.dailyPct - a.dailyPct);

      let chosen = null;
      for (const cand of cands) {
        const verdict = clearsHurdleFloor({
          active: { symbol: active.symbol, dailyPct: at.dailyPct },
          benchCandidate: { symbol: cand.symbol, dailyPct: cand.dailyPct },
          reason: 'stagnation',
          archetypeConfig: cfg,
          userATR: resolved.atr,
        });
        m.hurdle.evaluations++;
        if (verdict.clears) {
          m.hurdle.cleared++;
          if (!chosen) chosen = cand;
        } else {
          if (verdict.blockReason && m.hurdle.blocked[verdict.blockReason] != null) m.hurdle.blocked[verdict.blockReason]++;
          // monitor-only ("wake-but-never-clears"): this candidate WOULD wake Haiku
          // yet the hurdle blocked it — the benign looked-didn't-swap direction.
          if (candidateWakes(cand.symbol, cand.dailyPct, cand.baseATR)) m.wakeStarvation.wakeButNeverClears++;
        }
      }

      if (chosen) {
        executedTrades.push({ id: `x${t}_${active.symbol}`, exitReason: 'stagnation', swappedOutAt: new Date(now).toISOString() });
        m.forcedRotation.executed++;
        // Decision-2 gate: a hurdle-CLEARING swap opportunity is STARVED if its chosen
        // candidate would NOT fire the bench_outperformance wake (hurdle allows the
        // swap, wake never opens the door).
        m.wakeStarvation.clearingOpportunities++;
        if (!candidateWakes(chosen.symbol, chosen.dailyPct, chosen.baseATR)) m.wakeStarvation.starved++;
      } else {
        m.forcedRotation.vetoed++;
      }
    }
  }

  // derived
  m.hurdle.rejectionRatePct = m.hurdle.evaluations
    ? round2((100 * (m.hurdle.evaluations - m.hurdle.cleared)) / m.hurdle.evaluations)
    : null;
  m.wakeStarvation.ratePct = m.wakeStarvation.clearingOpportunities
    ? round2((100 * m.wakeStarvation.starved) / m.wakeStarvation.clearingOpportunities)
    : null;
  m.atrFreshness.meanAbsDelta = m.atrFreshness.fresh ? round2(m.atrFreshness.sumAbsDelta / m.atrFreshness.fresh) : null;
  m.executedRotations = m.forcedRotation.executed; // synthetic tempo (all synthetic swaps are non-emergency stagnation)
  return m;
}

// Run every archetype over one preset (fixed seed) → per-archetype metric map.
export function replayPreset({ preset, seed = 7, nHeld = 3, nBench = 9, nTicks = 26 }) {
  const universe = genUniverse({ preset, seed, nHeld, nBench, nTicks });
  const byArchetype = {};
  for (const archetype of ORDER) {
    byArchetype[archetype] = replayScenario({ archetype, universe });
  }
  return { preset, seed, byArchetype };
}

// Evaluate the unified gate set against a full run (all presets). Returns a
// pass/fail-or-"before" summary. With the current illustrative seeds this is the
// "before" picture — some gates are expected to be unmet until the B3 tune.
export function evaluateUnifiedGates(runsByPreset) {
  const primary = runsByPreset.chop || Object.values(runsByPreset)[0];
  const tempo = (preset) => {
    const r = runsByPreset[preset];
    return Object.fromEntries(ORDER.map((a) => [a, r.byArchetype[a].executedRotations]));
  };
  const chopTempo = tempo(primary.preset);

  // Gate 8A ordering (from synthetic executed rotations) — degen ≥ 3× guardian,
  // momentum_chaser ≥ 1.5× guardian, guardian lowest.
  const g = chopTempo.guardian;
  const ordering8A = {
    metric: 'median-proxy: executed non-emergency rotations per synthetic session',
    tempo: chopTempo,
    degenGEQ3xGuardian: g === 0 ? chopTempo.degen > 0 : chopTempo.degen >= 3 * g,
    momentumGEQ1_5xGuardian: g === 0 ? chopTempo.momentum_chaser > 0 : chopTempo.momentum_chaser >= 1.5 * g,
    guardianLowest: ORDER.every((a) => chopTempo[a] >= g),
  };
  ordering8A.pass = ordering8A.degenGEQ3xGuardian && ordering8A.momentumGEQ1_5xGuardian && ordering8A.guardianLowest;

  // Wake-starvation (Decision 2): PASS < 5% and no material worsening under stress.
  const starvationByPreset = Object.fromEntries(
    PRESETS.filter((p) => runsByPreset[p]).map((p) => {
      const r = runsByPreset[p];
      const clearing = ORDER.reduce((s, a) => s + r.byArchetype[a].wakeStarvation.clearingOpportunities, 0);
      const starved = ORDER.reduce((s, a) => s + r.byArchetype[a].wakeStarvation.starved, 0);
      return [p, { clearing, starved, ratePct: clearing ? round2((100 * starved) / clearing) : null }];
    }),
  );
  const normalRates = NORMAL_PRESETS.filter((p) => starvationByPreset[p]?.ratePct != null).map((p) => starvationByPreset[p].ratePct);
  const normalMax = normalRates.length ? Math.max(...normalRates) : null;
  const stressRate = starvationByPreset.stress?.ratePct ?? null;
  const wakeStarvation = {
    byPreset: starvationByPreset,
    normalMaxPct: normalMax,
    stressPct: stressRate,
    under5pct: normalMax != null ? normalMax < 5 : null,
    noStressWorsening: stressRate != null && normalMax != null ? stressRate <= normalMax + 1 : null,
  };
  wakeStarvation.pass = wakeStarvation.under5pct === true && wakeStarvation.noStressWorsening === true;

  // Stress: no ordering inversion (guardian still lowest, degen still highest tempo).
  const stressTempo = runsByPreset.stress ? tempo('stress') : null;
  const stressReplay = stressTempo
    ? {
        tempo: stressTempo,
        noInversion: stressTempo.degen >= stressTempo.guardian && ORDER.every((a) => stressTempo[a] >= stressTempo.guardian),
      }
    : { note: 'no stress preset run' };

  return {
    '8A_ordering': ordering8A,
    '8B_stagnation_share': { source: 'B1 real data (synthetic is stagnation-only, so 8B is not synthesizable here)' },
    emergency_bypass_frequency: { source: 'B1 real data (emergencies not synthesized in B2)' },
    hurdle_rejection_rate: Object.fromEntries(ORDER.map((a) => [a, primary.byArchetype[a].hurdle.rejectionRatePct])),
    stress_replay: stressReplay,
    wake_starvation: wakeStarvation,
    dial_position_ordering: { source: 'B3/WS2 — bands not yet drafted; base ordering established here' },
    atr_freshness: Object.fromEntries(
      ORDER.map((a) => [a, { fresh: primary.byArchetype[a].atrFreshness.fresh, frozen: primary.byArchetype[a].atrFreshness.frozen, meanAbsDelta: primary.byArchetype[a].atrFreshness.meanAbsDelta }]),
    ),
  };
}

// Best-effort replay of RECORDED battles through the gates. Recorded agentBattles
// do NOT persist per-tick price series or the candidate set the agent saw at each
// decision, so the full decision path cannot be replayed from them. This reports
// that coverage honestly rather than fabricating it.
export function replayRealBattles(battles) {
  const total = Array.isArray(battles) ? battles.length : 0;
  const replayable = 0; // no battle carries the per-tick state a gate-replay needs
  return {
    totalBattles: total,
    gateReplayableBattles: replayable,
    coveragePct: total ? round2((100 * replayable) / total) : 0,
    note:
      'Recorded battles embed only executed trades (trades[]) — no per-tick price series and no per-decision candidate set. ' +
      'Gate-replay therefore cannot run over recorded battles; real-data metrics come from B1 (aggregate-real-battles.js), ' +
      'and the synthetic replay above is the instrument for the non-persisted metrics (hurdle rejection, fires-vs-executed, wake-starvation, stress).',
  };
}

// Run all presets and produce the full "before" picture.
export function runAll({ seed = 7, nHeld = 3, nBench = 9, nTicks = 26 } = {}) {
  const runsByPreset = {};
  for (const preset of PRESETS) runsByPreset[preset] = replayPreset({ preset, seed, nHeld, nBench, nTicks });
  return { seed, nHeld, nBench, nTicks, runsByPreset, unifiedGates: evaluateUnifiedGates(runsByPreset) };
}

// --- CLI demo ---
function formatDemo(out) {
  const L = [];
  L.push(`# B2 gate-replay harness — "before" picture on the CURRENT illustrative hftConfig seeds`);
  L.push(`# seed=${out.seed} held=${out.nHeld} bench=${out.nBench} ticks=${out.nTicks} (SYNTHETIC — not real battle data)`);
  L.push('');
  for (const preset of PRESETS) {
    const r = out.runsByPreset[preset];
    L.push(`## preset: ${preset}`);
    const head = ['archetype', 'fires', 'exec', 'veto', 'capped', 'hurdleRej%', 'wakeStarv%', 'atrFresh/frozen'];
    L.push('  ' + head.join(' | '));
    for (const a of ORDER) {
      const m = r.byArchetype[a];
      L.push('  ' + [a, m.forcedRotation.fires, m.forcedRotation.executed, m.forcedRotation.vetoed, m.forcedRotation.capped, m.hurdle.rejectionRatePct, m.wakeStarvation.ratePct, `${m.atrFreshness.fresh}/${m.atrFreshness.frozen}`].join(' | '));
    }
    L.push('');
  }
  const ug = out.unifiedGates;
  L.push('## unified gate set (the "before" verdict)');
  L.push(`  8A ordering (exec rotations): ${JSON.stringify(ug['8A_ordering'].tempo)} → PASS=${ug['8A_ordering'].pass}`);
  L.push(`  wake-starvation (Decision 2): normalMax=${ug.wake_starvation.normalMaxPct}% stress=${ug.wake_starvation.stressPct}% → PASS=${ug.wake_starvation.pass} (need <5% + no stress worsening)`);
  L.push(`  hurdle rejection rate (chop): ${JSON.stringify(ug.hurdle_rejection_rate)}`);
  L.push(`  stress no-inversion: ${JSON.stringify(ug.stress_replay.noInversion ?? ug.stress_replay.note)}`);
  L.push(`  8B stagnation share: ${ug['8B_stagnation_share'].source}`);
  L.push(`  emergency-bypass freq: ${ug.emergency_bypass_frequency.source}`);
  L.push(`  dial-position ordering: ${ug.dial_position_ordering.source}`);
  return L.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const out = runAll();
  if (json) console.log(JSON.stringify(out, null, 2));
  else console.log(formatDemo(out));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
