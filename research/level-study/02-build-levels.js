// research/level-study/02-build-levels.js
//
// LevelStory Sessions 3 + 3.5 — point-in-time level registry + lineage engine
// (parent §5; S3.5 rework: unified distance scale, warmup lineage replay, merge
// effective timing, role state machine, study-end enforcement, rebuilt anomaly scan).
//
//   node 02-build-levels.js                  # frozen universe (config universeFilePath)
//   node 02-build-levels.js AAPL NVDA        # explicit symbol list
//   npm run levels                           # same as the first form
//
// THE GOVERNING INTEGRITY RULE (parent §5.2): the registry state for session D is built
// from data through D−1 close only. The banned optimization — build once over full
// history, filter by formation date — is not implemented anywhere. The incremental
// forward engine is permitted because runTruncated() provides the from-scratch truncated
// rebuild and the equivalence harness asserts incremental ≡ truncated. If they ever
// disagree, the truncated rebuild is the definition of correct.
//
// WARMUP LINEAGE REPLAY (S3.5 §4, LS3-02): lineage is ONE CONTINUOUS STATE MACHINE from
// the first session where the distance unit is defined (ATR(14) at prior close),
// through the warmup, into the study window. Warmup sessions build state only and are
// NEVER emitted; the study registry opens with a checkpoint of inherited, real family
// identity (true bornDate, anchors, counters, role history, pending state), and every
// family carries preStudy/preStudyAgeSessions so nothing is silently left-censored.
//
// STUDY-END ENFORCEMENT (S3.5 §7b, LS3-06): production input is physically truncated at
// config studyEnd, endDate is passed explicitly, artifacts carry actualFirst/LastSession,
// and a result outside the configured window throws.
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
const ATR_PERIOD = CONFIG.episode.atr.period; // lineage starts once ATR(14, D−1) exists (warmupReplay.startRule)

// ── Core: continuous lineage replay + emitted study registry ─────────────────

/**
 * @param {Array} dailyBars normalized daily bars, date-ascending
 * @param {object} opts {
 *   symbol,
 *   startDate  — first EMITTED registry session (default: config studyStart); lineage
 *                replays from the first unit-defined session regardless (S3.5 §4),
 *   endDate    — last registry session, inclusive (default: config studyEnd — never
 *                silently "through whatever is in the cache", LS3-06),
 *   finalDay   — INTERNAL (runTruncated): one extra registry day strictly after the last
 *                bar, built on the full (truncated) prefix,
 *   enabledFamilies — TEST hook (synthetic scenarios); production uses the config default.
 * }
 * @returns {{symbol, configVersion, sessions, families, events, studyStartCheckpoint,
 *   actualFirstSession, actualLastSession, _state}}
 */
export function runLevels(dailyBars, opts = {}) {
  const symbol = opts.symbol || 'SYM';
  const startDate = opts.startDate || CONFIG.range.studyStart;
  const endDate = opts.endDate || CONFIG.range.studyEnd;

  const series = buildSeries(dailyBars);
  const state = createLineageState(symbol);
  const sessions = [];
  let checkpoint = null;

  // Lineage replay: every session from index ATR_PERIOD (first with ATR at prior close)
  // through endDate feeds the state machine; only sessions ≥ startDate are emitted.
  for (let i = ATR_PERIOD; i < series.n; i++) {
    const D = series.dates[i];
    if (D > endDate) break;
    const emit = D >= startDate;
    if (emit && !checkpoint) checkpoint = takeStudyStartCheckpoint(state, D);
    const day = stepOneDay(series, i, D, symbol, state, opts);
    if (emit) sessions.push(day);
  }

  // Truncated-rebuild hook: one more registry day after the final bar. Uniform
  // validation with the loop — a registry day always needs a defined distance unit and
  // must respect the emission window.
  if (opts.finalDay) {
    if (series.n < ATR_PERIOD + 1) {
      throw new Error(`finalDay ${opts.finalDay}: only ${series.n} prior bars — the distance unit needs ATR(${ATR_PERIOD}) at prior close`);
    }
    if (opts.finalDay <= series.dates[series.n - 1]) {
      throw new Error(`finalDay ${opts.finalDay} must be strictly after the last bar ${series.dates[series.n - 1]}`);
    }
    if (opts.finalDay < startDate) throw new Error(`finalDay ${opts.finalDay} precedes startDate ${startDate}`);
    if (opts.finalDay > endDate) throw new Error(`finalDay ${opts.finalDay} exceeds endDate ${endDate}`);
    if (!checkpoint) checkpoint = takeStudyStartCheckpoint(state, opts.finalDay);
    sessions.push(stepOneDay(series, series.n, opts.finalDay, symbol, state, opts));
  }

  return {
    symbol,
    configVersion: CONFIG.version,
    basis: CONFIG.levels.construction.priceBasis, // 'adjusted' (A1 one-basis rule)
    startDate,
    endDate,
    actualFirstSession: sessions.length ? sessions[0].date : null,
    actualLastSession: sessions.length ? sessions[sessions.length - 1].date : null,
    studyStartCheckpoint: checkpoint,
    sessions,
    families: familiesToObject(state),
    events: state.events,
    _state: { seq: state.seq, sessionOrdinal: state.sessionOrdinal, pairRuns: sortedObj(state.pairRuns) },
  };
}

function stepOneDay(series, N, D, symbol, state, opts) {
  const day = buildDaySnapshots(series, N, D, { symbol, enabledFamilies: opts.enabledFamilies });
  lineageStep(state, D, day.snapshots, { unit: day.unit, refClose: day.refClose });
  return { date: D, atr: day.atr, refClose: day.refClose, unit: day.unit, snapshots: day.snapshots };
}

/**
 * The study-start checkpoint (S3.5 §4): taken immediately BEFORE the first emitted
 * session is processed — the state the study inherits from the warmup replay.
 * Every existing family is stamped preStudy with its true replayed age, and its warmup
 * matchHistory is cleared (S35-C4: warmup match history is state-building only — study
 * artifacts may only reference study-window snapshots).
 */
function takeStudyStartCheckpoint(state, firstStudyDate) {
  const liveFamilies = [];
  let retired = 0, merged = 0;
  for (const fam of state.families.values()) {
    fam.preStudy = true;
    fam.preStudyAgeSessions = state.sessionOrdinal - fam.bornOrdinal;
    fam.matchHistory = [];
    if (fam.status === 'live') {
      liveFamilies.push({
        familyId: fam.familyId,
        bornDate: fam.bornDate,
        preStudyAgeSessions: fam.preStudyAgeSessions,
        status: fam.status,
        anchor: fam.anchor,
        zeroSupportRun: fam.zeroSupportRun,
        splitRun: fam.splitRun,
        pendingSide: fam.pendingSide,
        pendingRun: fam.pendingRun,
        pendingStartDate: fam.pendingStartDate,
        lastMatchedDate: fam.lastMatchedDate,
        roleLog: fam.roleLog.map((r) => ({ ...r })),
      });
    } else if (fam.status === 'retired') retired += 1;
    else merged += 1;
  }
  liveFamilies.sort((a, b) => (a.familyId < b.familyId ? -1 : 1));
  return {
    date: firstStudyDate,
    warmupSessionsReplayed: state.sessionOrdinal,
    liveFamilies,
    warmupFamilyCounts: { live: liveFamilies.length, retired, merged },
    pairRuns: sortedObj(state.pairRuns),
  };
}

/**
 * From-scratch truncated rebuild for registry day D (parent §5.2's definition of
 * correct): physically slice the series to bars dated < D, replay the FULL construction
 * (warmup lineage included) over the slice, then build D itself as the final day.
 */
export function runTruncated(dailyBars, D, opts = {}) {
  const sliced = dailyBars.filter((b) => b.date < D);
  // endDate = D so the result (including its provenance fields) is comparable
  // one-to-one against the incremental run stopped at D.
  return runLevels(sliced, { ...opts, endDate: D, finalDay: D });
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

// ── Hard registry invariants (S3.5 §7c) — THROW, never warn ──────────────────

export function assertRegistryInvariants(result) {
  const fail = (msg) => { throw new Error(`registry invariant violated [${result.symbol}]: ${msg}`); };
  const fams = Object.values(result.families);
  const byStatus = { live: 0, retired: 0, merged: 0 };
  for (const f of fams) {
    if (!(f.status in byStatus)) fail(`${f.familyId}: unknown status ${f.status}`);
    byStatus[f.status] += 1;
  }
  if (byStatus.live + byStatus.retired + byStatus.merged !== fams.length) {
    fail(`familyCount ${fams.length} != live+retired+merged ${byStatus.live + byStatus.retired + byStatus.merged}`);
  }

  const events = result.events;
  const merges = events.filter((e) => e.type === 'merge');
  if (merges.length !== byStatus.merged) fail(`merged families ${byStatus.merged} != merge events ${merges.length}`);
  for (const e of merges) {
    const s = result.families[e.survivorId], a = result.families[e.absorbedId];
    if (!s || !a) fail(`merge@${e.date}: missing family`);
    if (a.status !== 'merged' || a.mergedInto !== e.survivorId || a.mergedDate !== e.date) fail(`merge@${e.date}: absorbed ${e.absorbedId} state incoherent`);
    if (s.status === 'merged' && s.mergedDate === e.date) fail(`merge@${e.date}: survivor ${e.survivorId} merged away the same session`);
    if (!s.mergedFrom.some((m) => m.familyId === e.absorbedId && m.date === e.date)) fail(`merge@${e.date}: survivor lacks mergedFrom provenance`);
  }
  for (const e of events.filter((x) => x.type === 'split')) {
    if (!e.branches || e.branches.length < 1) fail(`split@${e.date}: no branches`);
    if (!result.families[e.familyId]) fail(`split@${e.date}: elder missing`);
    for (const b of e.branches) {
      const bf = result.families[b];
      if (!bf) fail(`split@${e.date}: branch ${b} missing`);
      if (bf.splitFrom !== e.familyId || bf.bornDate !== e.date) fail(`split@${e.date}: branch ${b} parentage incoherent`);
    }
  }
  for (const e of events) {
    for (const id of [e.familyId, e.survivorId, e.absorbedId, ...(e.branches || [])].filter(Boolean)) {
      if (!result.families[id]) fail(`${e.type}@${e.date}: references unknown family ${id}`);
    }
  }

  // Ownership: current-session ownership follows the merge-timing rule (S3.5 §5) — no
  // snapshot on or after a family's terminal date references it; no retired/merged
  // family receives a later match.
  const terminal = new Map(); // familyId -> first date it may no longer own snapshots
  for (const f of fams) {
    if (f.status === 'merged') terminal.set(f.familyId, f.mergedDate);   // effective ON the merge date
    if (f.status === 'retired') terminal.set(f.familyId, afterIso(f.retiredDate)); // owns through its retire date
  }
  for (const s of result.sessions) {
    for (const snap of s.snapshots) {
      const f = result.families[snap.familyId];
      if (!f) fail(`${s.date}: snapshot ${snap.snapshotId} references unknown family ${snap.familyId}`);
      const t = terminal.get(snap.familyId);
      if (t && s.date >= t) fail(`${s.date}: snapshot owned by ${snap.familyId}, terminal since ${t} (LS3-03 guard)`);
    }
  }
  for (const f of fams) {
    for (const h of f.matchHistory) {
      if (h.fromFamilyId) continue; // transferred entries are the source family's record
      if (f.status === 'merged' && h.date > f.mergedDate) fail(`${f.familyId}: matched after merge`);
      if (f.status === 'retired' && h.date > f.retiredDate) fail(`${f.familyId}: matched after retirement`);
    }
  }
  return true;
}

function afterIso(iso) { return `${iso}~`; } // sorts strictly after iso, before any later date

// ── Sanity statistics (per symbol) ───────────────────────────────────────────

export function computeStats(result, runtimeMs = null) {
  const first = result.actualFirstSession || '';
  const perDay = result.sessions.map((s) => s.snapshots.length);
  const famsAll = Object.values(result.families);
  // Study families: alive at some point inside the emitted window (checkpoint-live
  // inheritances + in-study founds). Warmup-dead families are genealogy, not sample.
  const famsStudy = famsAll.filter((f) =>
    f.status === 'live' || !f.preStudy || (f.retiredDate ?? f.mergedDate ?? '9999-99-99') >= first);
  const dateOrdinal = new Map(result.sessions.map((s, i) => [s.date, i]));
  const lastOrdinal = result.sessions.length - 1;
  const lifespans = famsStudy.map((f) => {
    const born = dateOrdinal.get(f.bornDate) ?? 0; // preStudy families count from the study start
    const end = f.retiredDate ? dateOrdinal.get(f.retiredDate)
      : f.mergedDate ? dateOrdinal.get(f.mergedDate)
      : lastOrdinal;
    return (end ?? lastOrdinal) - born + 1;
  });
  const tierCounts = { F1: 0, F2: 0, F3: 0 };
  let snapTotal = 0;
  for (const s of result.sessions) for (const snap of s.snapshots) { tierCounts[snap.tier] += 1; snapTotal += 1; }
  // Event COUNTS are study-window only; warmup events remain in result.events as
  // genealogy (the invariant checker needs them) but are not sample statistics.
  const studyEvents = result.events.filter((e) => e.date >= first);
  const flips = studyEvents.filter((e) => e.type === 'role_flip').length;
  // Matched-family sessions over the study window (matchHistory is study-only — cleared
  // at the checkpoint), for the role-flip rate denominator.
  const matchedFamilySessions = famsAll.reduce((a, f) => a + new Set(f.matchHistory.filter((h) => !h.fromFamilyId).map((h) => h.date)).size, 0);
  const atrPcts = result.sessions.filter((s) => s.atr != null && s.refClose).map((s) => (100 * s.atr) / s.refClose);
  const foundedInStudy = famsAll.filter((f) => !f.preStudy).length;
  const mergesN = studyEvents.filter((e) => e.type === 'merge').length;
  const splitsN = studyEvents.filter((e) => e.type === 'split').length;
  const retirementsN = studyEvents.filter((e) => e.type === 'retirement').length;
  return {
    symbol: result.symbol,
    configVersion: result.configVersion,
    registrySessions: result.sessions.length,
    actualFirstSession: result.actualFirstSession,
    actualLastSession: result.actualLastSession,
    atrPctMedian: quantile(atrPcts, 0.5),
    activeLevelsPerDay: { median: quantile(perDay, 0.5), p90: quantile(perDay, 0.9), max: perDay.length ? Math.max(...perDay) : null },
    familyCountStudy: famsStudy.length,
    familyCountTotalStore: famsAll.length,   // incl. warmup genealogy
    familiesLiveAtStudyStart: result.studyStartCheckpoint ? result.studyStartCheckpoint.warmupFamilyCounts.live : null,
    familiesFoundedInStudy: foundedInStudy,
    medianFamilyLifespanSessions: quantile(lifespans, 0.5),
    events: { merges: mergesN, splits: splitsN, retirements: retirementsN, roleFlips: flips },
    ratios: {
      newFamiliesPer100Sessions: result.sessions.length ? round2((100 * foundedInStudy) / result.sessions.length) : null,
      // Event rates per 100 STUDY families — the volatility-neutral denominator. Raw
      // event counts scale with how many families a symbol carries (itself ~vol-linked),
      // so raw counts spuriously correlate with ATR%; per-100-families removes that.
      mergesPer100Families: famsStudy.length ? round2((100 * mergesN) / famsStudy.length) : null,
      splitsPer100Families: famsStudy.length ? round2((100 * splitsN) / famsStudy.length) : null,
      mergesPlusSplitsPer100Families: famsStudy.length ? round2((100 * (mergesN + splitsN)) / famsStudy.length) : null,
      retirementShare: famsStudy.length ? round2(retirementsN / famsStudy.length) : null,
      roleFlipsPer100MatchedFamilySessions: matchedFamilySessions ? round2((100 * flips) / matchedFamilySessions) : null,
      snapshotFamilyChurnRate: snapTotal ? round2(foundedInStudy / snapTotal) : null,
    },
    tierMixPct: { F1: pct(tierCounts.F1, snapTotal), F2: pct(tierCounts.F2, snapTotal), F3: pct(tierCounts.F3, snapTotal) },
    runtimeMs,
  };
}

function quantile(arr, q) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
function pct(x, total) { return total ? Math.round((x / total) * 1000) / 10 : null; }
function round2(x) { return Math.round(x * 100) / 100; }

// ── Anomaly scan (S3.5 §7c): per-symbol + cross-strata warnings — report, never retune ──

export function scanWarnings(allStats, strataOf = () => null) {
  const warnings = [];
  const metric = (fn) => allStats.map(fn);

  // Per-symbol zero-event and MAD-outlier warnings.
  for (const s of allStats) {
    if (s.events.merges === 0) warnings.push(`${s.symbol}: ZERO merges over the window`);
    if (s.events.splits === 0) warnings.push(`${s.symbol}: ZERO splits over the window`);
    if (s.events.retirements === 0) warnings.push(`${s.symbol}: ZERO retirements over the window`);
  }
  const madChecks = [
    ['familyCountStudy', (s) => s.familyCountStudy],
    ['newFamiliesPer100Sessions', (s) => s.ratios.newFamiliesPer100Sessions],
    ['mergesPer100Families', (s) => s.ratios.mergesPer100Families],
    ['splitsPer100Families', (s) => s.ratios.splitsPer100Families],
    ['mergesPlusSplitsPer100Families', (s) => s.ratios.mergesPlusSplitsPer100Families],
    ['retirementShare', (s) => s.ratios.retirementShare],
    ['medianLifespan', (s) => s.medianFamilyLifespanSessions],
    ['roleFlipsPer100MatchedFamilySessions', (s) => s.ratios.roleFlipsPer100MatchedFamilySessions],
    ['F2plusF3sharePct', (s) => (s.tierMixPct.F2 ?? 0) + (s.tierMixPct.F3 ?? 0)],
    ['activeLevelsPerDayMedian', (s) => s.activeLevelsPerDay.median],
    ['snapshotFamilyChurnRate', (s) => s.ratios.snapshotFamilyChurnRate],
  ];
  for (const [name, fn] of madChecks) {
    const vals = metric(fn).filter((v) => v != null);
    if (vals.length < 4) continue;
    const med = quantile(vals, 0.5);
    const mad = quantile(vals.map((v) => Math.abs(v - med)), 0.5);
    if (!(mad > 0)) continue;
    for (const s of allStats) {
      const v = fn(s);
      if (v != null && Math.abs(v - med) > 3 * mad) {
        warnings.push(`${s.symbol}: ${name} ${v} is a MAD outlier (median ${med}, MAD ${round2(mad)})`);
      }
    }
  }

  // Cross-strata checks — the check class that would have caught LS3-01.
  const withAtr = allStats.filter((s) => s.atrPctMedian != null);
  const correlations = {};
  if (withAtr.length >= 4) {
    const atr = withAtr.map((s) => s.atrPctMedian);
    // Correlate RATES (per 100 study families), never raw counts — raw counts made
    // merges read as ATR-correlated purely because high-vol names carry more families.
    correlations.atrPct_vs_mergeRate = pearson(atr, withAtr.map((s) => s.ratios.mergesPer100Families ?? 0));
    correlations.atrPct_vs_splitRate = pearson(atr, withAtr.map((s) => s.ratios.splitsPer100Families ?? 0));
    correlations.atrPct_vs_F2F3share = pearson(atr, withAtr.map((s) => (s.tierMixPct.F2 ?? 0) + (s.tierMixPct.F3 ?? 0)));
    for (const [k, v] of Object.entries(correlations)) {
      if (v != null && Math.abs(v) >= 0.8) warnings.push(`cross-strata: |${k}| = ${v} — geometry may be confounded with volatility`);
    }
    // Top-vs-bottom volatility-tertile event-rate ratios.
    const byAtr = [...withAtr].sort((a, b) => a.atrPctMedian - b.atrPctMedian);
    const third = Math.floor(byAtr.length / 3);
    if (third >= 1) {
      const bottom = byAtr.slice(0, third), top = byAtr.slice(-third);
      const rate = (grp, fn) => grp.reduce((a, s) => a + fn(s), 0) / grp.length;
      correlations.tertileRatio_mergeRate = ratioOrNull(rate(top, (s) => s.ratios.mergesPer100Families ?? 0), rate(bottom, (s) => s.ratios.mergesPer100Families ?? 0));
      correlations.tertileRatio_splitRate = ratioOrNull(rate(top, (s) => s.ratios.splitsPer100Families ?? 0), rate(bottom, (s) => s.ratios.splitsPer100Families ?? 0));
    }
  }

  // Any stratum where every symbol records zero for one event type.
  const strata = new Map();
  for (const s of allStats) {
    const st = strataOf(s.symbol);
    if (!st) continue;
    if (!strata.has(st)) strata.set(st, []);
    strata.get(st).push(s);
  }
  for (const [st, members] of strata) {
    for (const ev of ['merges', 'splits', 'retirements']) {
      if (members.length >= 2 && members.every((s) => s.events[ev] === 0)) {
        warnings.push(`stratum ${st}: ALL symbols record zero ${ev}`);
      }
    }
  }

  return { warnings, correlations };
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? round2(sxy / Math.sqrt(sxx * syy) * 100) / 100 : null;
}
function ratioOrNull(a, b) { return b > 0 ? round2(a / b) : (a > 0 ? Infinity : null); }

// ── CLI (Phase B runner — requires local fetched data) ───────────────────────

async function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  let symbols;
  let strataOf = () => null;
  if (argv.length) symbols = argv;
  else if (fs.existsSync(UNIVERSE_PATH)) {
    const uni = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
    symbols = uni.symbols.map((s) => s.symbol); // study subjects only; context symbols host no levels
    const stratumBySymbol = new Map(uni.symbols.map((s) => [s.symbol, s.stratum]));
    strataOf = (sym) => stratumBySymbol.get(sym) || null;
    console.log(`Scope: frozen universe v${uni.universeVersion} (${symbols.length} study symbols)`);
  } else {
    // Degraded-checkout fallback (the frozen universe file is committed, so this path is
    // practically unreachable). Probe EQUITIES only: context symbols are not study
    // subjects and must not host level registries (universe file note / S3 rulings §C).
    symbols = [...CONFIG.universe.probe.equities];
    console.log(`Scope: frozen universe file missing — S2 probe equities only (${symbols.length} symbols)`);
  }

  const START = CONFIG.range.studyStart, END = CONFIG.range.studyEnd;
  console.log(`LevelStory levels v${CONFIG.version} — window ${START} → ${END} (enforced), basis: adjusted\n`);
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
      // LS3-06: PHYSICAL truncation at studyEnd — a refreshed cache can never silently
      // extend the pre-registered window.
      const bars = JSON.parse(fs.readFileSync(dailyPath, 'utf8')).filter((b) => b.date <= END);
      const t = Date.now();
      const result = runLevels(bars, { symbol: sym, startDate: START, endDate: END });
      const runtimeMs = Date.now() - t;

      assertRegistryInvariants(result); // hard invariants THROW (S3.5 §7c)
      if (result.actualFirstSession && result.actualFirstSession < START) throw new Error(`emitted ${result.actualFirstSession} before studyStart`);
      if (result.actualLastSession && result.actualLastSession > END) throw new Error(`emitted ${result.actualLastSession} after studyEnd`);

      await writeJson(path.join(LEVELS_DIR, `${sym}.json`), {
        symbol: result.symbol,
        configVersion: result.configVersion,
        basis: result.basis,
        window: { configured: { start: START, end: END }, actualFirstSession: result.actualFirstSession, actualLastSession: result.actualLastSession },
        studyStartCheckpoint: result.studyStartCheckpoint,
        sessions: result.sessions,   // per-session snapshot registry (zones + familyId per day — S7 chart-packet feed)
        families: result.families,   // the family store: anchors, lineage events, role logs, preStudy provenance
        events: result.events,
      });
      const stats = computeStats(result, runtimeMs);
      allStats.push(stats);
      console.log(`✅ ${sym.padEnd(5)} sess=${stats.registrySessions} lvl/day med=${stats.activeLevelsPerDay.median}`
        + ` | fam=${stats.familyCountStudy} (pre-study live ${stats.familiesLiveAtStudyStart}, founded ${stats.familiesFoundedInStudy})`
        + ` | mrg=${stats.events.merges} spl=${stats.events.splits} ret=${stats.events.retirements} flip=${stats.events.roleFlips} (${stats.ratios.roleFlipsPer100MatchedFamilySessions}/100)`
        + ` | F1/F2/F3=${stats.tierMixPct.F1}/${stats.tierMixPct.F2}/${stats.tierMixPct.F3}% | atr%=${round2(stats.atrPctMedian)} | ${runtimeMs}ms`);
    } catch (e) {
      failures.push({ symbol: sym, error: e.message });
      console.log(`🔴 ${sym}: FAILED — ${e.message}`);
    }
  }

  const totalMs = Date.now() - t0;
  const scan = scanWarnings(allStats, strataOf);
  await writeJson(path.join(LEVELS_DIR, '_stats.json'), {
    generatedAt: new Date().toISOString(),
    configVersion: CONFIG.version,
    window: { start: START, end: END },
    totalRuntimeMs: totalMs,
    failures,
    perSymbol: allStats,
    anomalyScan: scan,
  });

  console.log('\n════════ ANOMALY SCAN (report, don\'t retune) ════════');
  console.log('cross-strata:', JSON.stringify(scan.correlations));
  if (scan.warnings.length) for (const w of scan.warnings) console.log(`⚠️  ${w}`);
  else console.log('no warnings');

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
