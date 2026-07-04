#!/usr/bin/env node
// scripts/calibration/gate-replay-harness.js
// Knob Calibration Task B — Phase B2: gate-replay harness (+ haiku-path extension).
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
// TWO decision paths, both faithful to production:
//   (A) Knob-A forced rotation — fires on the stagnation counter; NOT wake-gated.
//   (H) A UNIFORM EXOGENOUS haiku-proposal stream — identical across archetypes,
//       driven through the real WAKE (evaluateTriggers) → hurdleFloor.byReason
//       .haiku_decision → swap-window (getRecentSwapCount) gates, exactly as the cron
//       applies them. This makes the 8A ratio gates FALSIFIABLE (guardian, whose
//       forced rotation is disabled, still trades via the haiku path → a real tempo
//       floor), exercises the haiku-decision floors, and surfaces wake-starvation's
//       tempo cost in exec counts.
//
// Wake-starvation (Decision 2) lives on the wake-gated HAIKU path (forced rotation
// is not wake-gated): a proposal whose hurdle WOULD clear but whose tick did not
// wake Haiku is STARVED. PASS < 5% + no stress worsening; `wake-but-never-clears`
// (woke, then hurdle-blocked) is monitor-only. Per Decision 2 this gate is
// FAILED-STRUCTURAL (8C divergence) — B3 does not tune toward it.
//
// Both paths share one executedTrades list + one swap-window counter (one battle
// .trades[] in production). Emergencies are not synthesized → 8B stagnation-share +
// emergency-bypass frequency stay with B1 real data.
//
// Deterministic: seeded PRNG + pure gates + a fixed BASE_TIME (no Date.now).

import { fileURLToPath } from 'node:url';
import {
  evaluateRisk,
  clearsHurdleFloor,
  getRecentSwapCount,
  updateStagnationCounter,
  EMERGENCY_BYPASS_REASONS,
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

// Would `candidate` fire the bench_outperformance WAKE in isolation? Uses the real
// evaluateTriggers with a guaranteed-weak active so only the candidate's own
// bench-only signal (dailyChangePct / benchATR ≥ 0.5) decides. Deterministic:
// no `timing` → computePhaseFromBattle returns 'MID' before any clock read.
export function candidateWakes(candSymbol, candDailyPctFraction, candBaseATR) {
  const battle = {
    evaluations: [{ at: new Date(BASE_TIME - 30 * 60000).toISOString() }],
    portfolio: { bench: { stocks: [{ symbol: candSymbol, baseATR: candBaseATR }] } },
  };
  const assetScores = [{ symbol: '__ACTIVE__', priceChange: -0.1, multiplier: 0, badges: [] }];
  const prices = { [candSymbol]: { changePercent: candDailyPctFraction * 100 } };
  const res = evaluateTriggers(battle, assetScores, prices, null, null, []);
  return res.triggers.some((t) => t.type === 'bench_outperformance' && t.detail.includes(candSymbol));
}

// Is Haiku woken at tick t? Runs the REAL evaluateTriggers over the whole held book
// (any trigger → shouldEvaluate). Archetype-independent (the wake threshold is not
// archetype-keyed), so the same stream sees the same wake decision for every archetype.
export function isHaikuWoken(universe, t, frozenAtrOf) {
  const assetScores = universe.held.map((h) => {
    const atr = frozenAtrOf.get(h.symbol) || 2.5;
    const priceChange = h.ticks[t].dailyPct * 100;
    return { symbol: h.symbol, priceChange, multiplier: atr ? priceChange / atr : 0, badges: [] };
  });
  const prices = {};
  for (const s of universe.symbols) prices[s.symbol] = { changePercent: s.ticks[t].dailyPct * 100 };
  const battle = {
    evaluations: [{ at: new Date(BASE_TIME - 30 * 60000).toISOString() }],
    portfolio: { bench: { stocks: universe.bench.map((b) => ({ symbol: b.symbol, baseATR: b.ticks[t].atrPercentile * 8 })) } },
  };
  return evaluateTriggers(battle, assetScores, prices, null, null, []).shouldEvaluate;
}

// Build a UNIFORM, EXOGENOUS haiku-proposal stream — a function of the universe
// only (NOT the archetype), so every archetype runs the identical stream through
// its own gates. Every `interval` ticks Haiku proposes swapping the held laggard
// (lowest dailyPct) for the bench leader (highest dailyPct).
export function buildHaikuProposals(universe, { interval = 3 } = {}) {
  const proposals = [];
  for (let t = interval; t < universe.nTicks; t += interval) {
    const out = [...universe.held].sort((a, b) => a.ticks[t].dailyPct - b.ticks[t].dailyPct)[0];
    const inn = [...universe.bench].sort((a, b) => b.ticks[t].dailyPct - a.ticks[t].dailyPct)[0];
    if (out && inn) proposals.push({ tick: t, outSymbol: out.symbol, inSymbol: inn.symbol });
  }
  return proposals;
}

// Replay one archetype over one synthetic universe (both decision paths).
// `config` (optional) injects a CANDIDATE archetype config (B3 tuning); it defaults
// to the shipped illustrative getArchetypeConfig(archetype). The harness never edits
// the fenced config — B3 proposes values as data, evaluated through this injection.
export function replayScenario({ archetype, universe, haikuProposals, config }) {
  const cfg = config || getArchetypeConfig(archetype);
  const fr = cfg.hftConfig.forcedRotation;
  const swCfg = cfg.hftConfig.swapWindow;
  const held = universe.held;
  const bench = universe.bench;
  const proposalByTick = new Map((haikuProposals || buildHaikuProposals(universe)).map((p) => [p.tick, p]));

  const frozenAtrOf = new Map(universe.symbols.map((s) => [s.symbol, s.ticks[0].atrPercentile * 8]));
  const mem = new Map(held.map((s) => [s.symbol, { stagnationTicks: 0, lastTickPrice: null, lastTickTimestamp: null }]));
  const executedTrades = [];

  const m = {
    forcedRotation: { fires: 0, executed: 0, vetoed: 0, capped: 0 },
    haiku: { proposals: 0, woken: 0, wakeStarved: 0, hurdleBlocked: 0, capped: 0, executed: 0 },
    hurdle: { evaluations: 0, cleared: 0, blocked: { below_floor: 0, bench_not_positive: 0, margin_invalid: 0 } },
    swapWindow: { capHits: 0 },
    atrFreshness: { fresh: 0, frozen: 0, sumAbsDelta: 0 },
    wakeStarvation: { clearingOpportunities: 0, starved: 0, wakeButNeverClears: 0 },
  };

  const bumpAtr = (resolved, frozenAtr) => {
    if (resolved.source === 'fresh') {
      m.atrFreshness.fresh++;
      m.atrFreshness.sumAbsDelta += Math.abs(resolved.atr - frozenAtr);
    } else {
      m.atrFreshness.frozen++;
    }
  };

  for (let t = 1; t < universe.nTicks; t++) {
    const now = BASE_TIME + t * TICK_MS;
    const freshMap = buildFreshAtrPercentileMap(
      universe.symbols.map((s) => ({ symbol: s.symbol, atrPercentile: s.ticks[t].atrPercentile })),
    );

    // ---- (A) Knob-A forced rotation — risk loop; not wake-gated ----
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
        null,
        { ticksBelowVwap: 0, stagnationTicks: stag.stagnationTicks, withinAge: stag.withinAge },
        {},
        cfg,
      );
      if (risk.action !== 'SWAP_OUT' || risk.reason !== 'stagnation') continue;
      m.forcedRotation.fires++;

      const used = getRecentSwapCount(executedTrades, swCfg.windowMinutes, now, { countEmergencies: swCfg.countEmergencies });
      if (used >= swCfg.capPerWindow) {
        m.forcedRotation.capped++;
        m.swapWindow.capHits++;
        continue;
      }

      const resolved = resolveHurdleAtr(active.symbol, freshMap, frozenAtr);
      bumpAtr(resolved, frozenAtr);

      const cands = bench
        .map((b) => ({ symbol: b.symbol, dailyPct: b.ticks[t].dailyPct }))
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
        } else if (verdict.blockReason && m.hurdle.blocked[verdict.blockReason] != null) {
          m.hurdle.blocked[verdict.blockReason]++;
        }
      }
      if (chosen) {
        executedTrades.push({ id: `f${t}_${active.symbol}`, exitReason: 'stagnation', swappedOutAt: new Date(now).toISOString() });
        m.forcedRotation.executed++;
      } else {
        m.forcedRotation.vetoed++;
      }
    }

    // ---- (H) Haiku discretionary path — uniform exogenous stream; wake-gated ----
    const proposal = proposalByTick.get(t);
    if (proposal) {
      m.haiku.proposals++;
      const woken = isHaikuWoken(universe, t, frozenAtrOf);
      if (woken) m.haiku.woken++;

      const outHeld = held.find((h) => h.symbol === proposal.outSymbol);
      const inBench = bench.find((b) => b.symbol === proposal.inSymbol);
      const frozenAtr = frozenAtrOf.get(proposal.outSymbol);
      const resolved = resolveHurdleAtr(proposal.outSymbol, freshMap, frozenAtr);
      bumpAtr(resolved, frozenAtr);

      const verdict = clearsHurdleFloor({
        active: { symbol: proposal.outSymbol, dailyPct: outHeld.ticks[t].dailyPct },
        benchCandidate: { symbol: proposal.inSymbol, dailyPct: inBench.ticks[t].dailyPct },
        reason: 'haiku_decision', // → hurdleFloor.byReason.haiku_decision floor
        archetypeConfig: cfg,
        userATR: resolved.atr,
      });
      m.hurdle.evaluations++;
      if (verdict.clears) {
        m.hurdle.cleared++;
        m.wakeStarvation.clearingOpportunities++;
        if (!woken) m.wakeStarvation.starved++; // hurdle would allow; wake never opened the door
      } else {
        if (verdict.blockReason && m.hurdle.blocked[verdict.blockReason] != null) m.hurdle.blocked[verdict.blockReason]++;
        if (woken) m.wakeStarvation.wakeButNeverClears++; // monitor-only
      }

      // Execute exactly as production layers the gates: wake → hurdle → cap.
      if (!woken) {
        m.haiku.wakeStarved++;
      } else if (!verdict.clears) {
        m.haiku.hurdleBlocked++;
      } else {
        const used = getRecentSwapCount(executedTrades, swCfg.windowMinutes, now, { countEmergencies: swCfg.countEmergencies });
        if (used >= swCfg.capPerWindow) {
          m.haiku.capped++;
          m.swapWindow.capHits++;
        } else {
          executedTrades.push({ id: `h${t}`, exitReason: 'haiku_decision', swappedOutAt: new Date(now).toISOString() });
          m.haiku.executed++;
        }
      }
    }
  }

  // derived
  const nonEmergencyExecuted = executedTrades.filter((tr) => !EMERGENCY_BYPASS_REASONS.has(tr.exitReason)).length;
  m.hurdle.rejectionRatePct = m.hurdle.evaluations ? round2((100 * (m.hurdle.evaluations - m.hurdle.cleared)) / m.hurdle.evaluations) : null;
  m.wakeStarvation.ratePct = m.wakeStarvation.clearingOpportunities ? round2((100 * m.wakeStarvation.starved) / m.wakeStarvation.clearingOpportunities) : null;
  m.atrFreshness.meanAbsDelta = m.atrFreshness.fresh ? round2(m.atrFreshness.sumAbsDelta / m.atrFreshness.fresh) : null;
  m.tempo = { forcedExecuted: m.forcedRotation.executed, haikuExecuted: m.haiku.executed, totalExecuted: nonEmergencyExecuted };
  m.executedRotations = nonEmergencyExecuted; // 8A tempo metric = total executed non-emergency rotations
  return m;
}

// Run every archetype over one preset (fixed seed, shared exogenous haiku stream).
// `configs` (optional) is a { archetype: config } map of CANDIDATE configs (B3);
// `interval` sets the haiku proposal cadence (the proposal-rate sweep varies it).
export function replayPreset({ preset, seed = 7, nHeld = 3, nBench = 9, nTicks = 26, configs, interval }) {
  const universe = genUniverse({ preset, seed, nHeld, nBench, nTicks });
  const haikuProposals = buildHaikuProposals(universe, interval ? { interval } : undefined); // identical across archetypes
  const byArchetype = {};
  for (const archetype of ORDER) {
    byArchetype[archetype] = replayScenario({ archetype, universe, haikuProposals, config: configs?.[archetype] });
  }
  return { preset, seed, byArchetype };
}

// Evaluate the unified gate set against a full run. With the current illustrative
// seeds this is the "before" picture — several gates are expected unmet until B3.
export function evaluateUnifiedGates(runsByPreset) {
  const primary = runsByPreset.chop || Object.values(runsByPreset)[0];
  const tempo = (preset) => Object.fromEntries(ORDER.map((a) => [a, runsByPreset[preset].byArchetype[a].executedRotations]));
  const chopTempo = tempo(primary.preset);

  // Gate 8A ordering — now FALSIFIABLE (guardian trades via the haiku path).
  const g = chopTempo.guardian;
  const ordering8A = {
    metric: 'executed non-emergency rotations per synthetic session (forced + haiku)',
    tempo: chopTempo,
    degenGEQ3xGuardian: g > 0 ? chopTempo.degen >= 3 * g : chopTempo.degen > 0,
    momentumGEQ1_5xGuardian: g > 0 ? chopTempo.momentum_chaser >= 1.5 * g : chopTempo.momentum_chaser > 0,
    guardianLowest: ORDER.every((a) => chopTempo[a] >= g),
  };
  ordering8A.pass = ordering8A.degenGEQ3xGuardian && ordering8A.momentumGEQ1_5xGuardian && ordering8A.guardianLowest;

  // Wake-starvation (Decision 2) — from the wake-gated haiku path.
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
    status: 'FAILED-STRUCTURAL (8C divergence — scoped to evaluateTriggers unification; NOT a B3 knob-tuning target, contract F2)',
    byPreset: starvationByPreset,
    normalMaxPct: normalMax,
    stressPct: stressRate,
    under5pct: normalMax != null ? normalMax < 5 : null,
    noStressWorsening: stressRate != null && normalMax != null ? stressRate <= normalMax + 1 : null,
  };
  wakeStarvation.pass = wakeStarvation.under5pct === true && wakeStarvation.noStressWorsening === true;

  const stressTempo = runsByPreset.stress ? tempo('stress') : null;
  const stressReplay = stressTempo
    ? { tempo: stressTempo, noInversion: ORDER.every((a) => stressTempo[a] >= stressTempo.guardian) && stressTempo.degen >= stressTempo.guardian }
    : { note: 'no stress preset run' };

  return {
    '8A_ordering': ordering8A,
    '8B_stagnation_share': { source: 'B1 real data (synthetic is stagnation/haiku-only; 8B not synthesizable here)' },
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
// persist only executed trades (trades[]) — no per-tick price series and no
// per-decision candidate set — so the decision path cannot be replayed from them.
// Reported honestly rather than fabricated.
export function replayRealBattles(battles) {
  const total = Array.isArray(battles) ? battles.length : 0;
  return {
    totalBattles: total,
    gateReplayableBattles: 0,
    coveragePct: 0,
    note:
      'Recorded battles embed only executed trades (trades[]) — no per-tick price series and no per-decision candidate set. ' +
      'Gate-replay cannot run over recorded battles; real-data metrics come from B1 (aggregate-real-battles.js), and the ' +
      'synthetic replay above is the instrument for the non-persisted metrics.',
  };
}

export function runAll({ seed = 7, nHeld = 3, nBench = 9, nTicks = 26, configs, interval } = {}) {
  const runsByPreset = {};
  for (const preset of PRESETS) runsByPreset[preset] = replayPreset({ preset, seed, nHeld, nBench, nTicks, configs, interval });
  return { seed, nHeld, nBench, nTicks, runsByPreset, unifiedGates: evaluateUnifiedGates(runsByPreset) };
}

// --- CLI demo ---
function formatDemo(out) {
  const L = [];
  L.push('# B2 gate-replay harness — "before" picture on the CURRENT illustrative hftConfig seeds');
  L.push(`# seed=${out.seed} held=${out.nHeld} bench=${out.nBench} ticks=${out.nTicks} (SYNTHETIC — not real battle data)`);
  L.push('# tempo = forced + haiku executed (uniform exogenous haiku stream, identical across archetypes)');
  L.push('');
  for (const preset of PRESETS) {
    const r = out.runsByPreset[preset];
    L.push(`## preset: ${preset}`);
    const head = ['archetype', 'fFire', 'fExec', 'hProp', 'hWoke', 'hExec', 'TOTAL', 'hurdleRej%', 'wakeStarv%'];
    L.push('  ' + head.join(' | '));
    for (const a of ORDER) {
      const m = r.byArchetype[a];
      L.push(
        '  ' +
          [a, m.forcedRotation.fires, m.forcedRotation.executed, m.haiku.proposals, m.haiku.woken, m.haiku.executed, m.executedRotations, m.hurdle.rejectionRatePct ?? 'n/a', m.wakeStarvation.ratePct ?? 'n/a'].join(' | '),
      );
    }
    L.push('');
  }
  const ug = out.unifiedGates;
  const o = ug['8A_ordering'];
  L.push('## unified gate set (the "before" verdict)');
  L.push(`  8A ordering tempo: ${JSON.stringify(o.tempo)}`);
  L.push(`     degen≥3×guardian=${o.degenGEQ3xGuardian}  mc≥1.5×guardian=${o.momentumGEQ1_5xGuardian}  guardianLowest=${o.guardianLowest}  → PASS=${o.pass}`);
  L.push(`  wake-starvation (Decision 2): normalMax=${ug.wake_starvation.normalMaxPct}% stress=${ug.wake_starvation.stressPct}% → ${ug.wake_starvation.status}`);
  L.push(`  hurdle rejection rate (chop): ${JSON.stringify(ug.hurdle_rejection_rate)}`);
  L.push(`  stress no-inversion: ${JSON.stringify(ug.stress_replay.noInversion ?? ug.stress_replay.note)}`);
  L.push(`  8B stagnation share: ${ug['8B_stagnation_share'].source}`);
  L.push(`  emergency-bypass freq: ${ug.emergency_bypass_frequency.source}`);
  L.push(`  dial-position ordering: ${ug.dial_position_ordering.source}`);
  return L.join('\n');
}

function main() {
  const out = runAll();
  console.log(process.argv.slice(2).includes('--json') ? JSON.stringify(out, null, 2) : formatDemo(out));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
