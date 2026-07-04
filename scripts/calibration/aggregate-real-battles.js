#!/usr/bin/env node
// scripts/calibration/aggregate-real-battles.js
// Knob Calibration Task B — Phase B1: real-data trade-stat aggregation.
//
// Reads a local JSON export of `agentBattles` documents and produces the
// per-archetype REAL-DATA metrics the §5.2 acceptance report needs:
//   - baseline trade counts                        (§5.2 item 1)
//   - executed non-emergency rotations per battle  (median = Gate 8A tempo metric,
//                                                    FORGE_KEYSTONE_PHASE8_CALIBRATION_PLAN.md §1)
//   - stagnation share of non-emergency rotations  (Gate 8B, §2)
//   - emergency-bypass frequency, reason-attributed (§5.2 item 3)
//
// It does NOT produce the hurdle-floor rejection rate or vetoed forced-rotation
// fire frequency: those events are never persisted to battle.trades[] (a
// blocked/vetoed swap does not execute), so they are SYNTHESIZED by the B2
// gate-replay harness, not aggregated here. See the A0/B0 discovery report.
//
// Aggregation keys off battle.agentContext.archetype — per-trade `archetype` is
// null for non-archetype swaps (FORGE_KEYSTONE_PHASE8_CALIBRATION_PLAN.md §3(b)).
//
// PROVENANCE / CENSORING: battle.trades[] is capped at the last 50 entries
// (agentSwapExecution.js:345, `.slice(-50)`). A battle at that cap — or whose
// scoreState.tradeCount exceeds trades.length — is TRUNCATED: its counts are
// FLOOR values (lower bounds), flagged `censored` so the ledger never reports a
// truncated count as exact.
//
// PROVENANCE / TAXONOMY: a trade whose exitReason is neither an emergency reason
// nor a recognized non-emergency reason is UNKNOWN/MISSING. Default-deny counts
// such trades as non-emergency, which INFLATES the 8A tempo metric — a real risk
// for pre-V1.4-taxonomy (Mar–May) battles. The unknown/missing share is surfaced
// per battle and overall so B3 can judge how much the 8A number is inflated.
//
// Offline + deterministic: no network, no Firestore read/write, no Date.now,
// no randomness. Time span is derived from the data, never the wall clock.
//
// Usage:
//   node scripts/calibration/aggregate-real-battles.js --input export.json
//   node scripts/calibration/aggregate-real-battles.js --input export.json --format json --out metrics.json
//
// `--input` is a JSON file: either an array of battle docs or { "battles": [...] }.
// Produce one from Firestore with your own read-only admin tooling; THIS SCRIPT
// NEVER TOUCHES THE DATABASE.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Node-cleanliness runtime guard (BUILD_RULES §4): agentRiskManager.js is
// zero-import and pure; importing EMERGENCY_BYPASS_REASONS here (and in the test)
// IS the guard that no browser dep enters the graph. Import the constant — never
// re-list the reasons locally (FORGE_KEYSTONE_PHASE8_CALIBRATION_PLAN.md §5), and
// NEVER mock this import.
import { EMERGENCY_BYPASS_REASONS } from '../../api/_utils/agentRiskManager.js';

export const TRADES_CAP = 50; // agentSwapExecution.js:345 `.slice(-50)`

// Recognized NON-emergency exit reasons (FORGE_KEYSTONE_PHASE8_CALIBRATION_PLAN.md §1).
// There is no single exported source for these today, so this mirrors the plan's
// enumeration; keep it in sync if the reason taxonomy grows. A non-emergency trade
// whose reason is NOT in this set is treated as unknown/missing (see partitionTrades).
export const KNOWN_NONEMERGENCY_REASONS = new Set(['stagnation', 'haiku_decision', 'gameplan_rotation']);

// --- pure stat helpers (deterministic) ---
export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const round = (x, d = 2) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const sum = (nums) => nums.reduce((a, b) => a + b, 0);

function summarize(nums) {
  if (!nums.length) return { n: 0, median: null, mean: null, min: null, max: null };
  return {
    n: nums.length,
    median: round(median(nums)),
    mean: round(sum(nums) / nums.length),
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

const sortObj = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])));

// createdAt may be an ISO string or a serialized Firestore Timestamp.
export function toEpochMs(createdAt) {
  if (createdAt == null) return null;
  if (typeof createdAt === 'string') {
    const t = Date.parse(createdAt);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof createdAt === 'object') {
    const secs = createdAt._seconds ?? createdAt.seconds;
    if (typeof secs === 'number') return secs * 1000;
  }
  return null;
}

// A battle's trades[] is truncated (counts are floors) if it hit the 50-cap, or
// scoreState.tradeCount reports more swaps than the retained array holds.
export function isTruncated(battle) {
  const trades = Array.isArray(battle?.trades) ? battle.trades : [];
  const tradeCount = battle?.scoreState?.tradeCount;
  if (trades.length >= TRADES_CAP) return true;
  if (typeof tradeCount === 'number' && tradeCount > trades.length) return true;
  return false;
}

// Split a battle's trades[] using the FENCED EMERGENCY_BYPASS_REASONS set
// (default-deny: unknown/missing reason = non-emergency). Also tallies the
// unknown/missing-reason trades that default-deny silently folds into
// non-emergency, so their 8A-inflating share can be surfaced.
export function partitionTrades(trades) {
  const nonEmergency = [];
  const emergency = [];
  let stagnation = 0;
  let unknown = 0;
  const emergencyByReason = {};
  const unknownByReason = {};
  for (const t of trades) {
    const reason = t?.exitReason;
    if (EMERGENCY_BYPASS_REASONS.has(reason)) {
      emergency.push(t);
      emergencyByReason[reason] = (emergencyByReason[reason] || 0) + 1;
    } else {
      nonEmergency.push(t);
      if (reason === 'stagnation') stagnation += 1;
      if (!KNOWN_NONEMERGENCY_REASONS.has(reason)) {
        unknown += 1;
        const key = reason == null ? '(missing)' : String(reason);
        unknownByReason[key] = (unknownByReason[key] || 0) + 1;
      }
    }
  }
  return { nonEmergency, emergency, stagnation, unknown, emergencyByReason, unknownByReason };
}

export function aggregateBattles(battles) {
  const groups = new Map();
  let spanMin = null;
  let spanMax = null;

  for (const battle of battles) {
    const archetype = battle?.agentContext?.archetype || 'unknown';
    if (!groups.has(archetype)) groups.set(archetype, []);
    groups.get(archetype).push(battle);
    const ms = toEpochMs(battle?.createdAt);
    if (ms != null) {
      spanMin = spanMin == null ? ms : Math.min(spanMin, ms);
      spanMax = spanMax == null ? ms : Math.max(spanMax, ms);
    }
  }

  const perArchetype = {};
  for (const archetype of [...groups.keys()].sort()) {
    const list = groups.get(archetype);
    let censored = 0;
    const baseline = [];
    const rotations = [];
    let totalStagnation = 0;
    let totalNonEmergency = 0;
    let totalUnknown = 0;
    const emergencyPerBattle = [];
    const emergencyByReason = {};
    const unknownByReason = {};
    const perBattleUnknownSharePct = [];

    for (const battle of list) {
      const trades = Array.isArray(battle?.trades) ? battle.trades : [];
      if (isTruncated(battle)) censored += 1;
      const p = partitionTrades(trades);
      baseline.push(trades.length);
      rotations.push(p.nonEmergency.length);
      totalStagnation += p.stagnation;
      totalNonEmergency += p.nonEmergency.length;
      totalUnknown += p.unknown;
      emergencyPerBattle.push(p.emergency.length);
      for (const [r, c] of Object.entries(p.emergencyByReason)) emergencyByReason[r] = (emergencyByReason[r] || 0) + c;
      for (const [r, c] of Object.entries(p.unknownByReason)) unknownByReason[r] = (unknownByReason[r] || 0) + c;
      if (trades.length) perBattleUnknownSharePct.push(round((p.unknown / trades.length) * 100));
    }

    const totalTrades = sum(baseline);
    const spanList = list.map((b) => toEpochMs(b?.createdAt)).filter((x) => x != null);
    const unknownShareOfNonEmergency = totalNonEmergency ? round((totalUnknown / totalNonEmergency) * 100) : null;
    perArchetype[archetype] = {
      battles: list.length,
      censoredBattles: censored,
      baselineTradeCount: summarize(baseline),
      nonEmergencyRotationsPerBattle: summarize(rotations), // .median = Gate 8A tempo metric
      stagnationSharePct: totalNonEmergency ? round((totalStagnation / totalNonEmergency) * 100) : null, // Gate 8B
      emergencyBypass: {
        perBattle: summarize(emergencyPerBattle),
        total: sum(emergencyPerBattle),
        byReason: sortObj(emergencyByReason),
      },
      // Unknown/missing-reason trades — folded into non-emergency by default-deny,
      // so this share is the 8A tempo-metric inflation ceiling for real data.
      unknownReason: {
        trades: totalUnknown,
        sharePctOfAllTrades: totalTrades ? round((totalUnknown / totalTrades) * 100) : null,
        sharePctOfNonEmergency: unknownShareOfNonEmergency,
        perBattleSharePct: summarize(perBattleUnknownSharePct),
        byReason: sortObj(unknownByReason),
      },
      provenance: {
        source: 'real',
        n: list.length,
        span: spanList.length
          ? { from: new Date(Math.min(...spanList)).toISOString(), to: new Date(Math.max(...spanList)).toISOString() }
          : null,
        censoredNote: censored
          ? `${censored}/${list.length} battles hit the ${TRADES_CAP}-trade cap or report more swaps than retained — their counts are FLOOR values (lower bounds).`
          : null,
        taxonomyNote: totalUnknown
          ? `${totalUnknown} trade(s) (${unknownShareOfNonEmergency}% of non-emergency) carry an unknown/missing exitReason — default-deny counts them as non-emergency, inflating the 8A tempo metric. Likely pre-V1.4-taxonomy battles; inspect unknownReason.byReason.`
          : null,
      },
    };
  }

  // Descriptive tempo ordering (NOT a gate — Gate 8A/8B are asserted in the B3 run).
  const tempoOrdering = Object.entries(perArchetype)
    .filter(([, m]) => m.nonEmergencyRotationsPerBattle.median != null)
    .sort((a, b) => b[1].nonEmergencyRotationsPerBattle.median - a[1].nonEmergencyRotationsPerBattle.median)
    .map(([a, m]) => ({ archetype: a, medianNonEmergencyRotations: m.nonEmergencyRotationsPerBattle.median }));

  return {
    generatedBy: 'scripts/calibration/aggregate-real-battles.js (Knob Calibration B1)',
    tradesCap: TRADES_CAP,
    emergencyBypassReasons: [...EMERGENCY_BYPASS_REASONS].sort(),
    knownNonEmergencyReasons: [...KNOWN_NONEMERGENCY_REASONS].sort(),
    totalBattles: battles.length,
    totalCensored: Object.values(perArchetype).reduce((a, m) => a + m.censoredBattles, 0),
    totalUnknownReasonTrades: Object.values(perArchetype).reduce((a, m) => a + m.unknownReason.trades, 0),
    span:
      spanMin != null && spanMax != null
        ? { from: new Date(spanMin).toISOString(), to: new Date(spanMax).toISOString() }
        : null,
    perArchetype,
    tempoOrdering,
    notCovered: {
      hurdleFloorRejectionRate:
        'NOT derivable from trades[] — blocked swaps do not execute; synthesized by the B2 gate-replay harness.',
      forcedRotationFireFrequency:
        'Only EXECUTED rotations persist (exitReason=stagnation, source=archetype); VETOED fires leave no trade — synthesized by B2.',
    },
  };
}

// --- CLI ---
function parseArgs(argv) {
  const args = { format: 'table' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') args.input = argv[++i];
    else if (a === '--format') args.format = argv[++i];
    else if (a === '--out') args.out = argv[++i];
  }
  return args;
}

function loadBattles(path) {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const battles = Array.isArray(raw) ? raw : raw.battles;
  if (!Array.isArray(battles)) {
    throw new Error(`Input ${path} must be a JSON array of battle docs or { "battles": [...] }`);
  }
  return battles;
}

export function formatTable(report) {
  const lines = [];
  const cell = (v) => (v == null ? 'n/a' : v);
  const spanStr = report.span ? `, ${report.span.from.slice(0, 10)} → ${report.span.to.slice(0, 10)}` : '';
  lines.push(`# Real-battle knob metrics — ${report.totalBattles} battles${spanStr}`);
  lines.push(`# emergency reasons (fenced source): ${report.emergencyBypassReasons.join(', ')}`);
  if (report.totalCensored) {
    lines.push(`# WARNING ${report.totalCensored} censored (${report.tradesCap}-trade cap) — those counts are FLOOR values`);
  }
  if (report.totalUnknownReasonTrades) {
    lines.push(`# WARNING ${report.totalUnknownReasonTrades} trades carry an unknown/missing reason — counted as non-emergency (default-deny), inflating 8A. See unkRsn% + unknownReason.byReason`);
  }
  lines.push('');
  const head = ['archetype', 'battles', 'cens', 'baseline(med)', 'nonEmergRot(med)=8A', 'stagShare%=8B', 'emerg(med)', 'unkRsn%(ofNonEmerg)'];
  lines.push(head.join(' | '));
  lines.push(head.map((h) => '-'.repeat(h.length)).join('-|-'));
  for (const [arch, m] of Object.entries(report.perArchetype)) {
    lines.push(
      [
        arch,
        m.battles,
        m.censoredBattles,
        cell(m.baselineTradeCount.median),
        cell(m.nonEmergencyRotationsPerBattle.median),
        cell(m.stagnationSharePct),
        cell(m.emergencyBypass.perBattle.median),
        cell(m.unknownReason.sharePctOfNonEmergency),
      ].join(' | '),
    );
  }
  lines.push('');
  lines.push('# descriptive tempo ordering (NOT a gate — 8A/8B asserted in the B3 run):');
  lines.push('#   ' + report.tempoOrdering.map((t) => `${t.archetype}=${t.medianNonEmergencyRotations}`).join(' > '));
  lines.push('# NOT covered here (synthesized by B2): hurdle-floor rejection rate, vetoed forced-rotation fire frequency.');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Usage: node scripts/calibration/aggregate-real-battles.js --input <export.json> [--format json|table] [--out <file>]');
    console.error('  --input: JSON array of agentBattles docs, or { "battles": [...] }. This script never reads/writes Firestore.');
    process.exit(1);
  }
  const battles = loadBattles(args.input);
  const report = aggregateBattles(battles);
  const out = args.format === 'json' ? JSON.stringify(report, null, 2) : formatTable(report);
  if (args.out) {
    writeFileSync(args.out, out);
    console.error(`Wrote ${args.format} to ${args.out}`);
  } else {
    console.log(out);
  }
}

// Run main() only as a CLI, not when imported by the test.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
