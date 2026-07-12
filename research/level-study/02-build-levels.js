// research/level-study/02-build-levels.js
//
// LevelStory Session 3 — point-in-time level registry + lineage engine (parent §5).
//
//   node 02-build-levels.js                  # frozen universe (universe_frozen.json)
//   node 02-build-levels.js AAPL NVDA        # explicit symbol list
//   npm run levels                           # same as the first form
//
// For each symbol: loads data/normalized/{symbol}/daily.json (S2 fetcher output), runs
// the incremental day-forward registry build over the study window, writes the registry
// artifact to data/levels/{symbol}.json (gitignored — NEVER committed), and prints the
// Session-3 sanity statistics (active levels/day, family counts & lifespans, merge/split/
// retire/role-flip counts, tier mix, runtime).
//
// THE GOVERNING INTEGRITY RULE (parent §5.2; S3 prompt §3.1): the registry state for
// session D is built from data through D−1 close only. The banned optimization — build
// levels once over full history, filter by formation date — is not implemented anywhere.
// The incremental forward engine here is permitted because runTruncated() provides the
// from-scratch truncated rebuild and the equivalence harness (tests/09) asserts
// incremental ≡ truncated on sampled (symbol, day) pairs. If they ever disagree, the
// truncated rebuild is the definition of correct.
//
// Exports (consumed by the Phase A test harness): runLevels, runTruncated, registryAt,
// canonical, computeStats.
//
// Zero product imports. No network.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from './config.js';
import { buildSeries } from './lib/level-series.js';
import { buildDaySnapshots } from './lib/level-sources.js';
import { createLineageState, lineageStep, familiesToObject } from './lib/lineage.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const NORM_DIR = path.join(HERE, 'data', 'normalized');
const LEVELS_DIR = path.join(HERE, 'data', 'levels');
const UNIVERSE_PATH = path.join(REPO_ROOT, CONFIG.universe.universeFilePath); // single source of truth (config key)

// ── Core: incremental day-forward registry build ─────────────────────────────

/**
 * @param {Array} dailyBars normalized daily bars, date-ascending
 * @param {object} opts {
 *   symbol,
 *   startDate  — first registry session (default: config studyStart),
 *   endDate    — last registry session, inclusive (default: through the last bar's date),
 *   finalDay   — INTERNAL (runTruncated): one extra registry day strictly after the last
 *                bar, built on the full (truncated) prefix,
 *   enabledFamilies — TEST hook (synthetic scenarios); production uses the config default.
 * }
 * @returns {{symbol, sessions, families, events, _state}} sessions: [{date, atr,
 *   refClose, snapshots}] date-ascending; families: familyId-keyed store.
 */
export function runLevels(dailyBars, opts = {}) {
  const symbol = opts.symbol || 'SYM';
  const startDate = opts.startDate || CONFIG.range.studyStart;
  const endDate = opts.endDate || null;

  const series = buildSeries(dailyBars);
  const state = createLineageState(symbol);
  const sessions = [];

  // Registry days: the symbol's own session dates within [startDate, endDate]. Day at
  // index i is built on bars 0..i−1 (through D−1 close) — the loop hands the engine N=i,
  // so day D's own bar is unreadable by construction even though the full array is in scope.
  for (let i = 0; i < series.n; i++) {
    const D = series.dates[i];
    if (D < startDate) continue;
    if (endDate && D > endDate) break;
    if (i === 0) continue; // no prior data — no registry
    sessions.push(buildOneDay(series, i, D, symbol, state, opts));
  }
  // Truncated-rebuild hook: one more registry day after the final bar. Uniform validation
  // with the loop above — a registry day always needs ≥1 prior bar and must respect
  // startDate, otherwise the truncated path could emit a day the incremental path never
  // builds (garbage NaN registries instead of a loud error).
  if (opts.finalDay) {
    if (series.n === 0) {
      throw new Error(`finalDay ${opts.finalDay}: no prior bars — a registry day needs at least one bar before it`);
    }
    if (opts.finalDay <= series.dates[series.n - 1]) {
      throw new Error(`finalDay ${opts.finalDay} must be strictly after the last bar ${series.dates[series.n - 1]}`);
    }
    if (opts.finalDay < startDate) {
      throw new Error(`finalDay ${opts.finalDay} precedes startDate ${startDate}`);
    }
    sessions.push(buildOneDay(series, series.n, opts.finalDay, symbol, state, opts));
  }

  return {
    symbol,
    configVersion: CONFIG.version,
    basis: CONFIG.levels.construction.priceBasis, // 'adjusted' (A1 one-basis rule)
    startDate,
    sessions,
    families: familiesToObject(state),
    events: state.events,
    _state: { seq: state.seq, pairRuns: sortedObj(state.pairRuns) },
  };
}

function buildOneDay(series, N, D, symbol, state, opts) {
  const day = buildDaySnapshots(series, N, D, { symbol, enabledFamilies: opts.enabledFamilies });
  lineageStep(state, D, day.snapshots, day.atr);
  return { date: D, atr: day.atr, refClose: day.refClose, snapshots: day.snapshots };
}

/**
 * From-scratch truncated rebuild for registry day D (parent §5.2's definition of correct):
 * physically slice the series to bars dated < D, replay the full day-by-day construction
 * over the slice, then build D itself as the final day. Identical opts → the equivalence
 * harness compares this against the incremental run stopped at D.
 */
export function runTruncated(dailyBars, D, opts = {}) {
  const sliced = dailyBars.filter((b) => b.date < D);
  return runLevels(sliced, { ...opts, endDate: null, finalDay: D });
}

/** The registry entry for one day out of a run result (null if D wasn't a registry day). */
export function registryAt(result, D) {
  return result.sessions.find((s) => s.date === D) || null;
}

/** Canonical JSON (recursively sorted keys) — the equality surface for the harness tests. */
export function canonical(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(v) {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortValue(v[k]);
    return out;
  }
  return v;
}

function sortedObj(map) {
  const out = {};
  for (const k of [...map.keys()].sort()) out[k] = map.get(k);
  return out;
}

// ── Sanity statistics (Session-3 report §4.2) ────────────────────────────────

export function computeStats(result, runtimeMs = null) {
  const perDay = result.sessions.map((s) => s.snapshots.length);
  const fams = Object.values(result.families);
  const dateOrdinal = new Map(result.sessions.map((s, i) => [s.date, i]));
  const lastOrdinal = result.sessions.length - 1;
  const lifespans = fams.map((f) => {
    const born = dateOrdinal.get(f.bornDate) ?? 0;
    const end = f.retiredDate ? dateOrdinal.get(f.retiredDate)
      : f.mergedDate ? dateOrdinal.get(f.mergedDate)
      : lastOrdinal;
    return (end ?? lastOrdinal) - born + 1;
  });
  const tierCounts = { F1: 0, F2: 0, F3: 0 };
  let snapTotal = 0;
  for (const s of result.sessions) for (const snap of s.snapshots) { tierCounts[snap.tier] += 1; snapTotal += 1; }
  const events = result.events;
  return {
    symbol: result.symbol,
    registrySessions: result.sessions.length,
    activeLevelsPerDay: { median: quantile(perDay, 0.5), p90: quantile(perDay, 0.9), max: perDay.length ? Math.max(...perDay) : null },
    familyCount: fams.length,
    familyStatus: {
      live: fams.filter((f) => f.status === 'live').length,
      retired: fams.filter((f) => f.status === 'retired').length,
      merged: fams.filter((f) => f.status === 'merged').length,
    },
    medianFamilyLifespanSessions: quantile(lifespans, 0.5),
    events: {
      merges: events.filter((e) => e.type === 'merge').length,
      splits: events.filter((e) => e.type === 'split').length,
      retirements: events.filter((e) => e.type === 'retirement').length,
      roleFlips: events.filter((e) => e.type === 'role_flip').length,
    },
    tierMixPct: {
      F1: pct(tierCounts.F1, snapTotal), F2: pct(tierCounts.F2, snapTotal), F3: pct(tierCounts.F3, snapTotal),
    },
    runtimeMs,
  };
}

function quantile(arr, q) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
function pct(x, total) { return total ? Math.round((x / total) * 1000) / 10 : null; }

// ── CLI (Phase B runner — requires local fetched data) ───────────────────────

async function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  let symbols;
  if (argv.length) symbols = argv;
  else if (fs.existsSync(UNIVERSE_PATH)) {
    const uni = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
    symbols = uni.symbols.map((s) => s.symbol); // study subjects only; context symbols host no levels
    console.log(`Scope: frozen universe v${uni.universeVersion} (${symbols.length} study symbols)`);
  } else {
    // Degraded-checkout fallback (the frozen universe file is committed, so this path is
    // practically unreachable). Probe EQUITIES only: context symbols are not study
    // subjects and must not host level registries (universe file note / S3 rulings §C).
    symbols = [...CONFIG.universe.probe.equities];
    console.log(`Scope: frozen universe file missing — S2 probe equities only (${symbols.length} symbols)`);
  }

  console.log(`LevelStory S3 levels — window ${CONFIG.range.studyStart} → ${CONFIG.range.studyEnd}, basis: adjusted\n`);
  const allStats = [];
  const failures = [];
  const t0 = Date.now();

  for (const sym of symbols) {
    const dailyPath = path.join(NORM_DIR, sym, 'daily.json');
    if (!fs.existsSync(dailyPath)) {
      // The S2 fetcher's default list is the 14-symbol probe — universe symbols outside
      // it (PLTR, BE) must be fetched explicitly by name.
      failures.push({ symbol: sym, error: `missing ${path.relative(HERE, dailyPath)} — run \`node 01-fetch-history.js ${sym}\` first` });
      console.log(`🔴 ${sym}: no normalized daily data — skipped (fetch it: node 01-fetch-history.js ${sym})`);
      continue;
    }
    try {
      const bars = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
      const t = Date.now();
      const result = runLevels(bars, { symbol: sym });
      const runtimeMs = Date.now() - t;
      await writeJson(path.join(LEVELS_DIR, `${sym}.json`), {
        symbol: result.symbol,
        configVersion: result.configVersion,
        basis: result.basis,
        startDate: result.startDate,
        sessions: result.sessions,   // per-session snapshot registry (zones + familyId per day — S7 chart-packet feed)
        families: result.families,   // the family store: anchors, lineage events, role logs
        events: result.events,
      });
      const stats = computeStats(result, runtimeMs);
      allStats.push(stats);
      console.log(`✅ ${sym.padEnd(5)} sessions=${stats.registrySessions} lvl/day med=${stats.activeLevelsPerDay.median} p90=${stats.activeLevelsPerDay.p90} max=${stats.activeLevelsPerDay.max}`
        + ` | fam=${stats.familyCount} (live ${stats.familyStatus.live}/ret ${stats.familyStatus.retired}/mrg ${stats.familyStatus.merged}) lifespan med=${stats.medianFamilyLifespanSessions}`
        + ` | mrg=${stats.events.merges} spl=${stats.events.splits} ret=${stats.events.retirements} flip=${stats.events.roleFlips}`
        + ` | tiers F1/F2/F3=${stats.tierMixPct.F1}/${stats.tierMixPct.F2}/${stats.tierMixPct.F3}% | ${runtimeMs}ms`);
    } catch (e) {
      failures.push({ symbol: sym, error: e.message });
      console.log(`🔴 ${sym}: FAILED — ${e.message}`);
    }
  }

  const totalMs = Date.now() - t0;
  await writeJson(path.join(LEVELS_DIR, '_stats.json'), {
    generatedAt: new Date().toISOString(),
    configVersion: CONFIG.version,
    window: { start: CONFIG.range.studyStart, end: CONFIG.range.studyEnd },
    totalRuntimeMs: totalMs,
    failures,
    perSymbol: allStats,
  });

  // Anomaly flags (S3 prompt §4.3 — findings for founder review, never auto-tuned).
  console.log('\n════════ ANOMALY SCAN (report, don\'t fix) ════════');
  const medFam = quantile(allStats.map((s) => s.familyCount), 0.5) ?? 0;
  const flags = [];
  for (const s of allStats) {
    if (medFam && s.familyCount >= 10 * medFam) flags.push(`${s.symbol}: family count ${s.familyCount} ≥ 10× median (${medFam})`);
    if (s.events.retirements === 0) flags.push(`${s.symbol}: zero retirements over the window`);
  }
  if (allStats.length && allStats.every((s) => s.events.merges === 0)) flags.push('zero merges across ALL symbols');
  if (flags.length) for (const f of flags) console.log(`⚠️  ${f}`);
  else console.log('none');

  console.log(`\nArtifacts: data/levels/{symbol}.json + data/levels/_stats.json (gitignored — never committed)`);
  console.log(`Total runtime: ${(totalMs / 1000).toFixed(1)}s for ${allStats.length}/${symbols.length} symbols`);
  if (failures.length) console.log(`🔴 ${failures.length} failure(s): ${failures.map((f) => f.symbol).join(', ')}`);
}

async function writeJson(p, obj) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(obj));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
