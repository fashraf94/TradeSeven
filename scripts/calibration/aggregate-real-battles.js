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
//   node scripts/calibration/aggregate-real-battles.js --input export.json --generation-boundary 2026-07-08T20:05:00Z
//
// Release 1 (Tuned Knob Values Landing V1.1) additions:
//   - --generation-boundary <iso>[,<iso>…]: bucket battles by generation; the watch
//     comparison uses only battles WHOLLY CONTAINED (created AND completed) in one
//     generation. Straddlers/in-flight are excluded and tallied separately (§5).
//   - swap-cap pinning per archetype (§4.1 HARM trigger, via the fenced runtime
//     window counter getRecentSwapCount against the deployed capPerWindow).
//   - opponent split (cpu-opponent / player-opponent by isCpu): BOTH groups count
//     toward the decision metric; the split only flags material tempo divergence.
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
// getRecentSwapCount is the FENCED live circuit-breaker window counter (Release 1
// §4.1). We CALL it (reading/calling fenced exports is permitted; BUILD_RULES §1)
// so the cap-pinning metric mirrors the runtime window semantics exactly rather
// than re-implementing them.
import { EMERGENCY_BYPASS_REASONS, getRecentSwapCount } from '../../api/_utils/agentRiskManager.js';
// Cap-pinning resolves each archetype's swapWindow (capPerWindow/windowMinutes)
// from the SAME fenced source the runtime deploys — so the metric measures pinning
// against the cap actually in force at run time (Release 1 §4.1, "the system's own
// terms"). A pre-merge baseline run therefore measures the old cap; a post-merge
// run measures the new one. Calling these exports is permitted (BUILD_RULES §1).
import { getArchetypeConfig, resolveHftConfig } from '../../api/_utils/agentArchetypeConfig.js';

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

// Opponent classification (Release 1 Decision 2 refinement). isCpu is stamped on
// tournament CPU/padding battles at deploy (agentBattleService.js) and passed
// through verbatim by export-agent-battles.js. We split by opponent — NOT by
// "training" — because isCpu covers ranked CPU padding too; the label reflects
// that honestly. BOTH groups count toward the aggregate decision metric (knob
// physics are opponent-independent); the split exists only to surface divergence.
export function opponentGroup(battle) {
  return battle?.isCpu === true ? 'cpu-opponent' : 'player-opponent';
}

// Material tempo divergence between the two opponent groups. This is a DIAGNOSTIC
// flag, never a promote/revert gate — a large gap between cpu-opponent and
// player-opponent tempo means something opponent-specific is at play and warrants
// a look. Rule: divergent if the larger median is ≥1.5× the smaller (both > 0), or
// (when one group is 0) the absolute gap is ≥2 rotations. Raw medians are always
// surfaced so a human makes the call.
export function tempoDivergence(cpuMedian, playerMedian, { ratio = 1.5, absolute = 2 } = {}) {
  if (cpuMedian == null || playerMedian == null) {
    return { divergent: false, reason: 'insufficient-data', cpuMedian, playerMedian };
  }
  const hi = Math.max(cpuMedian, playerMedian);
  const lo = Math.min(cpuMedian, playerMedian);
  const absDiff = hi - lo;
  const ratioVal = lo > 0 ? hi / lo : null;
  const divergent = lo > 0 ? ratioVal >= ratio : absDiff >= absolute;
  return {
    divergent,
    cpuMedian,
    playerMedian,
    absDiff: round(absDiff),
    ratio: ratioVal == null ? null : round(ratioVal),
    thresholds: { ratio, absolute },
  };
}

// Swap-cap pinning for ONE battle (Release 1 §4.1 HARM trigger, made measurable).
// For each cap-subject (non-emergency, unless countEmergencies) executed swap, we
// count the swaps in the trailing windowMinutes window ANCHORED on that swap using
// the fenced getRecentSwapCount — so the count matches the live breaker exactly. A
// window that reaches capPerWindow is "pinned". Returns per-battle window tallies;
// counts inherit the caller's censored flag (a 50-cap-truncated trades[] yields a
// FLOOR on pinned windows).
export function capPinningForBattle(battle) {
  const archetype = battle?.agentContext?.archetype || 'unknown';
  const sw = resolveHftConfig(getArchetypeConfig(archetype), battle?.gameMode)?.swapWindow;
  const trades = Array.isArray(battle?.trades) ? battle.trades : [];
  if (!sw?.enabled || !(sw.capPerWindow > 0) || !(sw.windowMinutes > 0)) {
    return { capPerWindow: sw?.capPerWindow ?? null, windowMinutes: sw?.windowMinutes ?? null, windows: 0, pinnedWindows: 0 };
  }
  const anchors = trades.filter((t) => t
    && !Number.isNaN(Date.parse(t?.swappedOutAt))
    && (sw.countEmergencies || !EMERGENCY_BYPASS_REASONS.has(t.exitReason)));
  let pinnedWindows = 0;
  for (const t of anchors) {
    const used = getRecentSwapCount(trades, sw.windowMinutes, t.swappedOutAt, { countEmergencies: sw.countEmergencies });
    if (used >= sw.capPerWindow) pinnedWindows += 1;
  }
  return { capPerWindow: sw.capPerWindow, windowMinutes: sw.windowMinutes, windows: anchors.length, pinnedWindows };
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
    // Release 1 additions: opponent-split tempo + swap-cap pinning.
    const rotationsByOpponent = { 'cpu-opponent': [], 'player-opponent': [] };
    let totalWindows = 0;
    let totalPinnedWindows = 0;
    const perBattlePinnedSharePct = [];
    let capParams = { capPerWindow: null, windowMinutes: null };

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
      // Opponent-split tempo (both groups still feed `rotations` above).
      rotationsByOpponent[opponentGroup(battle)].push(p.nonEmergency.length);
      // Swap-cap pinning (per-battle, against the deployed cap for this archetype/mode).
      const cp = capPinningForBattle(battle);
      if (cp.capPerWindow != null) capParams = { capPerWindow: cp.capPerWindow, windowMinutes: cp.windowMinutes };
      totalWindows += cp.windows;
      totalPinnedWindows += cp.pinnedWindows;
      if (cp.windows) perBattlePinnedSharePct.push(round((cp.pinnedWindows / cp.windows) * 100));
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
      // Release 1 §4.1 — swap-cap pinning (live-anchored runaway metric). pinnedSharePct
      // is the share of cap-subject rolling windows that reached capPerWindow; the §4.1
      // HARM trigger is ≥50% across ≥2 consecutive sessions (the multi-session sustain is
      // a watch-time judgment, not computed here). Censored battles floor these counts.
      swapCapPinning: {
        capPerWindow: capParams.capPerWindow,
        windowMinutes: capParams.windowMinutes,
        windows: totalWindows,
        pinnedWindows: totalPinnedWindows,
        pinnedSharePct: totalWindows ? round((totalPinnedWindows / totalWindows) * 100) : null,
        perBattleSharePct: summarize(perBattlePinnedSharePct),
        censoredNote: censored
          ? `${censored}/${list.length} battles censored (${TRADES_CAP}-cap) — pinned-window counts are FLOOR values.`
          : null,
      },
      // Release 1 Decision 2 — opponent-split tempo (both groups count toward the
      // aggregate `nonEmergencyRotationsPerBattle` above; this split only flags a
      // material cpu-vs-player divergence for investigation, never a gate).
      opponentBreakdown: {
        'cpu-opponent': {
          battles: rotationsByOpponent['cpu-opponent'].length,
          nonEmergencyRotationsPerBattle: summarize(rotationsByOpponent['cpu-opponent']),
        },
        'player-opponent': {
          battles: rotationsByOpponent['player-opponent'].length,
          nonEmergencyRotationsPerBattle: summarize(rotationsByOpponent['player-opponent']),
        },
        tempoDivergence: tempoDivergence(
          median(rotationsByOpponent['cpu-opponent']),
          median(rotationsByOpponent['player-opponent']),
        ),
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

// ==================== GENERATION BUCKETING (Release 1 §5) ====================
// Under tick-time resolution, a merge/rollback flips in-flight battles mid-battle,
// so the promote/revert comparison may only use battles WHOLLY CONTAINED in one
// generation (created AND completed on the same side of every boundary). These
// helpers implement that filter; straddlers and still-in-flight battles are
// excluded and reported separately.

// Interval i is [boundary[i-1], boundary[i]) — half-open. Returns the generation
// index (0..boundaries.length) for an epoch-ms timestamp. Boundaries should sit in
// the gap BETWEEN sessions (spec §5.2: merge after market close) so same-session
// battles never land on a boundary.
export function generationIndex(ms, sortedBoundaryMs) {
  let i = 0;
  while (i < sortedBoundaryMs.length && ms >= sortedBoundaryMs[i]) i += 1;
  return i;
}

// Partition battles into per-generation buckets by the wholly-contained rule. A
// battle joins generation g iff BOTH createdAt and completedAt resolve to g; any
// straddler — or a battle missing completedAt (still in-flight) — goes to
// `straddling` and is never used for a per-generation comparison.
export function bucketByGeneration(battles, boundaryIsos) {
  const boundaryMs = boundaryIsos.map((s) => Date.parse(s));
  if (boundaryMs.some((x) => Number.isNaN(x))) {
    throw new Error(`--generation-boundary: unparseable ISO timestamp in [${boundaryIsos.join(', ')}]`);
  }
  const sorted = [...boundaryMs].sort((a, b) => a - b);
  const buckets = Array.from({ length: sorted.length + 1 }, () => []);
  const straddling = [];
  for (const b of battles) {
    const createdMs = toEpochMs(b?.createdAt);
    const completedMs = toEpochMs(b?.completedAt);
    if (createdMs == null || completedMs == null) { straddling.push(b); continue; }
    const gi = generationIndex(createdMs, sorted);
    const gc = generationIndex(completedMs, sorted);
    if (gi === gc) buckets[gi].push(b);
    else straddling.push(b);
  }
  return { sortedBoundaryMs: sorted, buckets, straddling };
}

// Generation-aware aggregation: one full per-archetype report per generation over
// only its wholly-contained battles, plus a separate straddler tally. This is the
// promote/revert-safe view the §5 watch window compares across generations.
export function aggregateWithGenerations(battles, boundaryIsos) {
  const { sortedBoundaryMs, buckets, straddling } = bucketByGeneration(battles, boundaryIsos);
  const boundaries = sortedBoundaryMs.map((ms) => new Date(ms).toISOString());
  const straddlingByArchetype = {};
  for (const b of straddling) {
    const a = b?.agentContext?.archetype || 'unknown';
    straddlingByArchetype[a] = (straddlingByArchetype[a] || 0) + 1;
  }
  return {
    generatedBy: 'scripts/calibration/aggregate-real-battles.js (Knob Calibration B1 — generation-bucketed)',
    mode: 'generation-bucketed',
    boundaries,
    whollyContainedRule: 'A battle is compared only if createdAt AND completedAt fall in the same generation; straddlers and in-flight battles are excluded (tick-time resolution flips in-flight battles mid-battle).',
    totalBattles: battles.length,
    generations: buckets.map((bucket, i) => ({
      index: i,
      from: i === 0 ? null : boundaries[i - 1],
      to: i === boundaries.length ? null : boundaries[i],
      containedBattles: bucket.length,
      report: aggregateBattles(bucket),
    })),
    straddling: {
      battles: straddling.length,
      byArchetype: sortObj(straddlingByArchetype),
      note: straddling.length
        ? `${straddling.length} battle(s) straddle a generation boundary or lack completedAt — EXCLUDED from the per-generation comparison.`
        : null,
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
    else if (a === '--generation-boundary') args.generationBoundary = argv[++i];
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
  const head = ['archetype', 'battles', 'cens', 'baseline(med)', 'nonEmergRot(med)=8A', 'stagShare%=8B', 'emerg(med)', 'unkRsn%(ofNonEmerg)', 'capPin%@cap'];
  lines.push(head.join(' | '));
  lines.push(head.map((h) => '-'.repeat(h.length)).join('-|-'));
  for (const [arch, m] of Object.entries(report.perArchetype)) {
    const cp = m.swapCapPinning;
    const capPinCell = cp.pinnedSharePct == null ? 'n/a' : `${cp.pinnedSharePct}@${cell(cp.capPerWindow)}`;
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
        capPinCell,
      ].join(' | '),
    );
  }
  lines.push('');
  lines.push('# descriptive tempo ordering (NOT a gate — 8A/8B asserted in the B3 run):');
  lines.push('#   ' + report.tempoOrdering.map((t) => `${t.archetype}=${t.medianNonEmergencyRotations}`).join(' > '));
  // Opponent-split divergence flags (diagnostic only — both groups count toward the decision).
  const diverged = Object.entries(report.perArchetype)
    .filter(([, m]) => m.opponentBreakdown.tempoDivergence.divergent)
    .map(([a, m]) => `${a} (cpu=${m.opponentBreakdown.tempoDivergence.cpuMedian} vs player=${m.opponentBreakdown.tempoDivergence.playerMedian})`);
  lines.push(diverged.length
    ? `# OPPONENT TEMPO DIVERGENCE (investigate, not a gate): ${diverged.join('; ')}`
    : '# opponent tempo divergence: none flagged (cpu-opponent ≈ player-opponent).');
  lines.push('# capPin%@cap = share of cap-subject rolling windows that reached capPerWindow (§4.1 HARM: ≥50% across ≥2 sessions).');
  lines.push('# NOT covered here (synthesized by B2): hurdle-floor rejection rate, vetoed forced-rotation fire frequency.');
  return lines.join('\n');
}

// Generation-bucketed formatter (Release 1 §5): render each generation's report via
// formatTable, framed by its window, with the excluded-straddler tally called out.
export function formatGenerationReport(gen) {
  const lines = [];
  lines.push(`# Generation-bucketed knob metrics — ${gen.totalBattles} battles across ${gen.generations.length} generation(s)`);
  lines.push(`# boundaries: ${gen.boundaries.join(', ') || '(none)'}`);
  lines.push(`# rule: ${gen.whollyContainedRule}`);
  if (gen.straddling.note) lines.push(`# EXCLUDED ${gen.straddling.note}`);
  for (const g of gen.generations) {
    lines.push('');
    lines.push(`## generation ${g.index} [${g.from || '-inf'} → ${g.to || '+inf'}] — ${g.containedBattles} wholly-contained battle(s)`);
    lines.push(g.containedBattles ? formatTable(g.report) : '# (no wholly-contained battles in this generation)');
  }
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Usage: node scripts/calibration/aggregate-real-battles.js --input <export.json> [--format json|table] [--out <file>] [--generation-boundary <iso>[,<iso>...]]');
    console.error('  --input: JSON array of agentBattles docs, or { "battles": [...] }. This script never reads/writes Firestore.');
    console.error('  --generation-boundary: ISO timestamp(s) partitioning time into generations; the comparison uses only battles wholly contained in one generation (Release 1 §5).');
    process.exit(1);
  }
  const battles = loadBattles(args.input);
  const boundaries = args.generationBoundary
    ? args.generationBoundary.split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  const report = boundaries && boundaries.length
    ? aggregateWithGenerations(battles, boundaries)
    : aggregateBattles(battles);
  const out = args.format === 'json'
    ? JSON.stringify(report, null, 2)
    : (report.mode === 'generation-bucketed' ? formatGenerationReport(report) : formatTable(report));
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
