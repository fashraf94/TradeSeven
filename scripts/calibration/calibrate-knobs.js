#!/usr/bin/env node
// scripts/calibration/calibrate-knobs.js
// Knob Calibration Task B — Phase B3: the calibration run.
//
// Proposes tuned per-archetype hftConfig values and VERIFIES them against the
// unified gate set through the B2 gate-replay harness. It does NOT edit the fenced
// api/_utils/agentArchetypeConfig.js — the tuned table is emitted as DATA (proposed
// for the Tier-2 fence bundle; build spec §0). Riders honored:
//   - 8B is REAL-DATA ONLY (B1); the synthetic stagnation share is a proposal-rate
//     artifact and is never treated as an 8B measure here.
//   - Proposal-rate sensitivity sweep: gates must hold at 0.5x / 1x / 2x the haiku
//     proposal rate. A gate that flips across rates is a MECHANISM finding.
//   - Regime scope: ordering/ratio gates evaluated per-preset on trend/chop/stress;
//     flatline excluded by design (all-zero).
//   - Wake-starvation carried as FAILED-STRUCTURAL (F2, 8C queue) — NOT tuned toward.
// Dial bands are verified across the full archetype x dial cross-product on TOTAL
// tempo (the shared swap-window couples the two paths, so per-path numbers mislead).

import { runAll, ORDER } from './gate-replay-harness.js';
import { getArchetypeConfig } from '../../api/_utils/agentArchetypeConfig.js';

const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

// Baseline haiku interval; the rate sweep is 0.5x / 1x / 2x of it.
const RATE_SWEEP = { '0.5x': 8, '1x': 4, '2x': 2 };
export const GATE_PRESETS = ['trend', 'chop', 'stress']; // flatline excluded (rider 3)
export const BANDS = { Measured: 0.7, Standard: 1.0, Aggressive: 1.3 };
const DEGEN_MC_SEP_TARGET = 1.3; // quality goal: degen clearly faster than mc

// PROPOSED tuned table: clone the shipped illustrative hftConfig and tune to widen
// degen<->mc while keeping guardian lowest. Rationale in the B3 phase report.
export function buildProposed() {
  const t = {};
  for (const a of ORDER) t[a] = structuredClone(getArchetypeConfig(a).hftConfig);
  // degen (Speculator): the shipped stagnation floor 0.6 was oddly HIGH for the
  // fastest archetype (harder to rotate). Lower it so degen actually churns.
  t.degen.hurdleFloor.byReason.stagnation.atrMultiplier = 0.3;
  // momentum_chaser (Trend Follower): clearly slower than degen — fire later, cap
  // tighter, floors higher.
  t.momentum_chaser.forcedRotation.ticksThreshold = 5;
  t.momentum_chaser.swapWindow.capPerWindow = 6;
  t.momentum_chaser.hurdleFloor.byReason.haiku_decision.atrMultiplier = 0.35;
  t.momentum_chaser.hurdleFloor.byReason.stagnation.atrMultiplier = 0.5;
  t.momentum_chaser.hurdleFloor.default.atrMultiplier = 0.35;
  // analyst / diversifier / contrarian: unchanged (moderate). guardian: unchanged
  // (forcedRotation disabled, cap 2, floors 0.5 — the tempo floor via haiku only).
  return t;
}

const configsFrom = (table) => Object.fromEntries(Object.entries(table).map(([a, hft]) => [a, { hftConfig: hft }]));

// Ordering/ratio gate on ONE preset, on TOTAL tempo (forced + haiku executed).
export function orderingGate(runsByPreset, preset) {
  const tempo = Object.fromEntries(ORDER.map((a) => [a, runsByPreset[preset].byArchetype[a].executedRotations]));
  const g = tempo.guardian;
  const guardianLowest = ORDER.every((a) => tempo[a] >= g);
  const degenGEQ3xGuardian = g > 0 ? tempo.degen >= 3 * g : tempo.degen > 0;
  const mcGEQ1_5xGuardian = g > 0 ? tempo.momentum_chaser >= 1.5 * g : tempo.momentum_chaser > 0;
  const degenMcSep = tempo.momentum_chaser > 0 ? round2(tempo.degen / tempo.momentum_chaser) : null;
  return {
    tempo,
    guardianLowest,
    degenGEQ3xGuardian,
    mcGEQ1_5xGuardian,
    degenMcSep,
    pass: guardianLowest && degenGEQ3xGuardian && mcGEQ1_5xGuardian,
  };
}

// Run the full proposal-rate sweep x regime-scope gate matrix for a config table.
export function runSweep(table) {
  const configs = configsFrom(table);
  const matrix = {};
  for (const [rate, interval] of Object.entries(RATE_SWEEP)) {
    const r = runAll({ configs, interval });
    matrix[rate] = Object.fromEntries(GATE_PRESETS.map((p) => [p, orderingGate(r.runsByPreset, p)]));
  }
  // gate pass = every rate x preset passes; also flag any gate that FLIPS across rates
  const cells = [];
  for (const rate of Object.keys(RATE_SWEEP)) for (const p of GATE_PRESETS) cells.push({ rate, p, ...matrix[rate][p] });
  const allPass = cells.every((c) => c.pass);
  const flips = GATE_PRESETS.filter((p) => new Set(Object.keys(RATE_SWEEP).map((rate) => matrix[rate][p].pass)).size > 1);
  const sepMin = Math.min(...cells.map((c) => c.degenMcSep ?? Infinity));
  return { matrix, allPass, rateFlips: flips, degenMcSepMin: round2(sepMin) };
}

// Apply a dial band multiplier to a resolved hftConfig (tempo up with mult:
// looser cap, fewer ticks to fire, lower floors). Clamped.
export function applyBand(hft, mult) {
  const c = structuredClone(hft);
  c.swapWindow.capPerWindow = Math.max(1, Math.round(c.swapWindow.capPerWindow * mult));
  c.forcedRotation.ticksThreshold = Math.max(1, Math.round(c.forcedRotation.ticksThreshold / mult));
  for (const k of ['haiku_decision', 'stagnation']) c.hurdleFloor.byReason[k].atrMultiplier = round2(c.hurdleFloor.byReason[k].atrMultiplier / mult);
  c.hurdleFloor.default.atrMultiplier = round2(c.hurdleFloor.default.atrMultiplier / mult);
  return c;
}

// Verify the dial bands across the full archetype x dial cross-product on total
// tempo, per preset. The load-bearing invariant (design §5.2 D2): Capital Preserver
// (guardian) @ Aggressive stays slower than Speculator (degen) @ Measured; and the
// ordering holds at every fixed dial position.
export function verifyDialBands(table) {
  const byPreset = {};
  for (const preset of GATE_PRESETS) {
    // tempo[archetype][band] — each archetype run with ALL archetypes at that band.
    const tempo = {};
    for (const [band, mult] of Object.entries(BANDS)) {
      const configs = configsFrom(Object.fromEntries(ORDER.map((a) => [a, applyBand(table[a], mult)])));
      const r = runAll({ configs });
      for (const a of ORDER) {
        tempo[a] = tempo[a] || {};
        tempo[a][band] = r.runsByPreset[preset].byArchetype[a].executedRotations;
      }
    }
    const perBandOrdering = Object.fromEntries(
      Object.keys(BANDS).map((band) => [band, ORDER.every((a) => tempo[a][band] >= tempo.guardian[band])]),
    );
    const cpAggressive = tempo.guardian.Aggressive;
    const specMeasured = tempo.degen.Measured;
    byPreset[preset] = {
      tempo,
      perBandOrderingHolds: Object.values(perBandOrdering).every(Boolean),
      cpAggressiveBelowSpecMeasured: cpAggressive <= specMeasured,
      cpAggressive,
      specMeasured,
    };
  }
  const pass = Object.values(byPreset).every((p) => p.perBandOrderingHolds && p.cpAggressiveBelowSpecMeasured);
  return { byPreset, pass };
}

export function calibrate() {
  const proposed = buildProposed();
  const sweep = runSweep(proposed);
  const bands = verifyDialBands(proposed);
  return {
    proposed,
    sweep,
    bands,
    verdict: {
      gatesPass: sweep.allPass,
      noRateFlips: sweep.rateFlips.length === 0,
      degenMcSeparated: sweep.degenMcSepMin >= DEGEN_MC_SEP_TARGET,
      bandsHold: bands.pass,
      overall: sweep.allPass && sweep.rateFlips.length === 0 && bands.pass,
    },
    notes: {
      '8B': 'REAL-DATA ONLY (B1 aggregate-real-battles.js, with unknown-reason share quoted) — synthetic stagnation share is a proposal-rate artifact and is NOT an 8B measure.',
      wakeStarvation: 'FAILED-STRUCTURAL (8C divergence) — carried to contract F2, fenced-evaluateTriggers unification; NOT tuned toward here.',
      landing: 'PROPOSED ONLY — tuned values ride the Tier-2 fence bundle; this run edits no fenced file.',
    },
  };
}

// --- CLI ---
function fmt(out) {
  const L = [];
  L.push('# B3 calibration run — PROPOSED tuned hftConfig (verified via the B2 harness)');
  L.push(`# verdict: ${JSON.stringify(out.verdict)}`);
  L.push('');
  L.push('## proposal-rate sweep x regime gates (ordering/ratio on total tempo)');
  for (const rate of Object.keys(RATE_SWEEP)) {
    for (const p of GATE_PRESETS) {
      const c = out.sweep.matrix[rate][p];
      L.push(`  ${rate} ${p}: PASS=${c.pass} | tempo ${JSON.stringify(c.tempo)} | degen/mc=${c.degenMcSep}`);
    }
  }
  L.push(`  allPass=${out.sweep.allPass}  rateFlips=${JSON.stringify(out.sweep.rateFlips)}  degen/mc min=${out.sweep.degenMcSepMin}`);
  L.push('');
  L.push('## dial-band cross-product (Measured/Standard/Aggressive on total tempo)');
  for (const p of GATE_PRESETS) {
    const b = out.bands.byPreset[p];
    L.push(`  ${p}: perBandOrdering=${b.perBandOrderingHolds}  CP@Aggr(${b.cpAggressive}) <= Spec@Measured(${b.specMeasured})=${b.cpAggressiveBelowSpecMeasured}`);
  }
  L.push(`  bandsHold=${out.bands.pass}`);
  L.push('');
  L.push('## proposed values (degen + momentum_chaser deltas vs shipped)');
  L.push(`  degen.hurdleFloor.stagnation: 0.6 -> ${out.proposed.degen.hurdleFloor.byReason.stagnation.atrMultiplier}`);
  L.push(`  momentum_chaser.forcedRotation.ticksThreshold: 3 -> ${out.proposed.momentum_chaser.forcedRotation.ticksThreshold}`);
  L.push(`  momentum_chaser.swapWindow.capPerWindow: 8 -> ${out.proposed.momentum_chaser.swapWindow.capPerWindow}`);
  L.push(`  momentum_chaser.hurdleFloor {haiku,stag,default}: {0.3,0.55,0.3} -> {${out.proposed.momentum_chaser.hurdleFloor.byReason.haiku_decision.atrMultiplier},${out.proposed.momentum_chaser.hurdleFloor.byReason.stagnation.atrMultiplier},${out.proposed.momentum_chaser.hurdleFloor.default.atrMultiplier}}`);
  return L.join('\n');
}

import { fileURLToPath } from 'node:url';
function main() {
  const out = calibrate();
  console.log(process.argv.slice(2).includes('--json') ? JSON.stringify(out, null, 2) : fmt(out));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
