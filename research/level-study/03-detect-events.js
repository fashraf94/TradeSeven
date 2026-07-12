// research/level-study/03-detect-events.js
//
// LevelStory Session 4 — event-detection runner (parent §6, §13). Reads the level registry
// (data/levels/{sym}.json, from 02-build-levels.js) + the 5-min raw cache, runs the episode
// model (lib/events.js), and writes independent events to data/events/{sym}.json. Then prints
// the per-symbol diagnostics, the §2-guarded anomaly scan, and the §7 EVENT-BUDGET CHECKPOINT
// (the session's most important output). Zero product imports; artifacts are gitignored.
//
//   npm run events                 # frozen universe (11 study symbols)
//   node 03-detect-events.js AAPL  # an explicit symbol list
//
// NOTE (S4 §0.1): 01-fetch-history.js persists only per-session summaries in sessions.json, not
// per-bar 5m. Per-bar 5m is reconstructed here from the raw cache (data/raw/{sym}/5m/*.json) via
// normalizeFiveMin — the same normalizer the fetcher used — so no math is duplicated.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from './config.js';
import { normalizeFiveMin } from './lib/normalize.js';
import { detectEvents } from './lib/events.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const NORM_DIR = path.join(HERE, 'data', 'normalized');
const RAW_DIR = path.join(HERE, 'data', 'raw');
const LEVELS_DIR = path.join(HERE, 'data', 'levels');
const EVENTS_DIR = path.join(HERE, 'data', 'events');
const UNIVERSE_PATH = path.join(REPO_ROOT, CONFIG.universe.universeFilePath);
const MIN_N = CONFIG.honesty.acceptance.minN;        // 30 — the acceptance floor (parent §15)
const HOLDOUT_START = CONFIG.range.holdoutStart;      // 2025-12-10
const IN_SAMPLE_MONTHS = CONFIG.range.inSampleMonths; // 29
const DIAG = CONFIG.diagnostics.anomalyScan;          // S4 §2 guards (MAD floor, cross-strata event floor)

// ── Load per-bar 5m for a symbol (reconstructed from the raw cache; S4 §0.1) ──

export function loadFiveMinByDate(sym) {
  const dailyBars = JSON.parse(fs.readFileSync(path.join(NORM_DIR, sym, 'daily.json'), 'utf8'));
  const byDate = new Map(dailyBars.map((b) => [b.date, b]));
  const rawDir = path.join(RAW_DIR, sym, CONFIG.fetch.intradayInterval); // e.g. .../5m
  const raw = [];
  const seenTs = new Set(); // dedup overlapping/re-fetched cache chunks by bar timestamp (else bars double-count)
  if (fs.existsSync(rawDir)) {
    for (const f of fs.readdirSync(rawDir).filter((n) => n.endsWith('.json')).sort()) {
      const arr = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'));
      if (!Array.isArray(arr)) continue;
      for (const rec of arr) {
        if (rec && rec.timestamp != null) {
          if (seenTs.has(rec.timestamp)) continue;
          seenTs.add(rec.timestamp);
        }
        raw.push(rec);
      }
    }
  }
  const { bars, sessions } = normalizeFiveMin(raw, byDate);
  const regByDate = new Map();
  for (const b of bars) {
    if (b.role !== 'regular') continue;
    if (!regByDate.has(b.etDate)) regByDate.set(b.etDate, []);
    regByDate.get(b.etDate).push(b);
  }
  const map = new Map();
  for (const s of sessions) {
    map.set(s.etDate, {
      isFullDay: s.isFullDay, earlyClose: s.earlyClose, hasAuction: s.hasAuction,
      sessionCloseAdj: s.sessionCloseAdj,
      regular: (regByDate.get(s.etDate) || []).sort((a, b) => a.etMinutes - b.etMinutes),
    });
  }
  return { fiveMinByDate: map, byDate };
}

// ── Per-symbol event stats (the per-symbol console line + _stats.json entry) ──

function median(xs) {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function round2(x) { return x == null ? null : Math.round(x * 100) / 100; }

export function computeEventStats(result, registry, runtimeMs) {
  const events = result.events;
  const touch = events.filter((e) => e.disposition === 'touch');
  const sessIdx = new Map(registry.sessions.map((s, i) => [s.date, i]));
  const lastIdx = registry.sessions.length - 1;
  const lenSessions = (e) => {
    const a = sessIdx.get(e.episodeStart);
    const b = e.episodeEnd == null ? lastIdx : (sessIdx.has(e.episodeEnd) ? sessIdx.get(e.episodeEnd) : lastIdx);
    return a == null ? null : (b - a + 1);
  };
  const count = (arr, fn) => arr.reduce((m, e) => { const k = fn(e); m[k] = (m[k] || 0) + 1; return m; }, {});
  return {
    symbol: result.symbol,
    configVersion: CONFIG.version,
    eventsDetected: events.length,
    rejected: result.rejected,
    shadowed: result.shadowed,
    episodes: result.episodes,
    dispositions: result.dispositions,
    sideMix: count(touch, (e) => e.side),
    tierMix: count(touch, (e) => e.familyTier),
    medianProbesPerEpisode: median(touch.map((e) => e.probeCountInEpisode)),
    medianEpisodeLenSessions: median(touch.map(lenSessions)),
    runtimeMs,
  };
}

// ── Event-side anomaly scan (reuses the S4 §2 guards on event counts) ─────────

export function scanEventWarnings(allStats, strataOf = () => null) {
  const warnings = [];
  for (const s of allStats) {
    if (s.eventsDetected === 0) warnings.push(`${s.symbol}: ZERO events detected over the window`);
    if (s.rejected === 0 && s.eventsDetected > 0) warnings.push(`${s.symbol}: ZERO independence-filter rejections — the filter may not be exercised`);
  }
  // Cross-strata event-rate suppression (S4 §2.2): below the floor, correlations are noise.
  const totalEvents = allStats.reduce((a, s) => a + s.eventsDetected, 0);
  const correlations = totalEvents < DIAG.crossStrataMinEvents ? { status: 'insufficient', totalEvents } : { totalEvents };
  // Per-metric MAD-outlier check with the §2.1 floor (events-per-symbol distribution).
  const vals = allStats.map((s) => s.eventsDetected).filter((v) => v != null);
  if (vals.length >= 4) {
    const sorted = [...vals].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const madSorted = vals.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    const mad = madSorted[Math.floor(madSorted.length / 2)];
    if (mad > 0 && mad >= DIAG.madMedianFloorFrac * Math.abs(med)) {
      for (const s of allStats) if (Math.abs(s.eventsDetected - med) > 3 * mad) {
        warnings.push(`${s.symbol}: eventsDetected ${s.eventsDetected} is a MAD outlier (median ${med}, MAD ${round2(mad)})`);
      }
    }
  }
  // Per-stratum all-zero.
  const strata = new Map();
  for (const s of allStats) { const st = strataOf(s.symbol); if (!st) continue; if (!strata.has(st)) strata.set(st, []); strata.get(st).push(s); }
  for (const [st, members] of strata) if (members.length >= 2 && members.every((s) => s.eventsDetected === 0)) warnings.push(`stratum ${st}: ALL symbols record zero events`);
  return { warnings, correlations };
}

// ── §7 EVENT-BUDGET CHECKPOINT (parent §13 / §15) — the session's key output ──

const isTouch = (e) => e.disposition === 'touch';
const isF2plus = (e) => e.familyTier === 'F2' || e.familyTier === 'F3';
const bySide = (arr) => ({ support: arr.filter((e) => e.side === 'support').length, resistance: arr.filter((e) => e.side === 'resistance').length });

export function buildCheckpointReport(allEvents, opts = {}) {
  const nSymbols = opts.nSymbols || 11;
  const holdoutStart = opts.holdoutStart || HOLDOUT_START;
  const all = allEvents;
  const touch = all.filter(isTouch);
  const inSample = touch.filter((e) => e.eventDate < holdoutStart);
  const holdout = touch.filter((e) => e.eventDate >= holdoutStart);
  const f2 = inSample.filter(isF2plus);

  const bySymbol = {};
  for (const e of inSample) bySymbol[e.symbol] = (bySymbol[e.symbol] || 0) + 1;
  const top5 = Object.values(bySymbol).sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const uniqueDates = new Set(inSample.map((e) => e.eventDate)).size;

  const minUd = CONFIG.honesty.acceptance.minUniqueDates; // S5-A2: uniqueDates floor, reported in every checkpoint
  const cellVerdict = (n, ud) => (n >= MIN_N && ud >= minUd ? 'PASS' : 'UNDERPOWERED');
  const sideCells = (arr) => {
    const s = bySide(arr);
    const ud = (side) => new Set(arr.filter((e) => e.side === side).map((e) => e.eventDate)).size;
    const udS = ud('support'), udR = ud('resistance');
    return { support: s.support, resistance: s.resistance, supportUniqueDates: udS, resistanceUniqueDates: udR,
      supportVerdict: cellVerdict(s.support, udS), resistanceVerdict: cellVerdict(s.resistance, udR) };
  };

  // Only the S4-KNOWABLE gating cell is scored now; finer splits (hourly class, RVOL bucket,
  // extension, regime) arrive in Sessions 5–6 and are flagged pending — never fabricated here.
  const questions = {
    P1: { base: 'F2+ touch per side', split: '× 5 hourly classes (S5)', cells: sideCells(f2), status: 'BASE_ONLY' },
    P2: { base: 'F2+ touch per side (bridge)', split: '× hourly class (S5)', cells: sideCells(f2), status: 'BASE_ONLY' },
    P3: { base: 'F2+ touch per side', split: '× 3 RVOL buckets (S5)', cells: sideCells(f2), status: 'BASE_ONLY' },
    P4: { base: 'all-tier touch per side', split: '× F1 vs F2 within SHARP_REJECT (S5-A1; SHARP_REJECT split pending S6)', cells: sideCells(inSample),
      f3PerSide: bySide(inSample.filter((e) => e.familyTier === 'F3')), status: 'BASE_ONLY', flag: 'S5-A1: primary comparison is F1 vs F2; F3 pools into F2+ gates and appears as an exploratory footnote only' },
    P5: { base: 'requires hourly classes', split: 'BREAK_RECLAIM vs DRIFT_HOLD (S5)', cells: null, status: 'REQUIRES_S5' },
    P6: { base: 'F2+ touch per side', split: '× SHARP_REJECT × EXT/NOT_EXT × 3 regimes (S5/S6)', cells: sideCells(f2), status: 'BASE_ONLY',
      fallback: 'regime interaction drops first; per-side EXT/NOT_EXT protected last (Addendum §A4.3)' },
  };

  return {
    acceptanceFloorN: MIN_N,
    totals: {
      allEvents: all.length,
      touch: touch.length,
      gapBreak: all.filter((e) => e.disposition === 'GAP_BREAK').length,
      retiredMidEpisode: all.filter((e) => e.disposition === 'RETIRED_MIDEPISODE').length,
      inSampleTouch: inSample.length,
      holdoutTouch: holdout.length, // counted, NOT analyzed (holdout opens once, later)
    },
    concentration: {
      uniqueEventDates: uniqueDates,
      top5SymbolPct: inSample.length ? round2((top5 / inSample.length) * 100) : null,
      eventsPerSymbolPerMonth: round2(inSample.length / (nSymbols * IN_SAMPLE_MONTHS)),
    },
    perSide: { allTouch: bySide(inSample), f2plus: bySide(f2) },
    questions,
  };
}

function printCheckpoint(report) {
  console.log('\n════════ §7 EVENT-BUDGET CHECKPOINT (parent §13/§15; floor n≥' + report.acceptanceFloorN + ') ════════');
  const t = report.totals, c = report.concentration;
  console.log(`Totals: ${t.allEvents} events | touch ${t.touch} (in-sample ${t.inSampleTouch}, holdout ${t.holdoutTouch}) | GAP_BREAK ${t.gapBreak} | RETIRED_MIDEPISODE ${t.retiredMidEpisode}`);
  console.log(`Concentration (in-sample touch): unique event-dates ${c.uniqueEventDates} | top-5-symbol ${c.top5SymbolPct}% | ${c.eventsPerSymbolPerMonth} events/symbol/month`);
  console.log(`Per side (in-sample touch): all-tier S/R = ${report.perSide.allTouch.support}/${report.perSide.allTouch.resistance} | F2+ S/R = ${report.perSide.f2plus.support}/${report.perSide.f2plus.resistance}`);
  console.log('Per pre-registered question (S4-knowable gating cell vs floor):');
  for (const [q, v] of Object.entries(report.questions)) {
    const cells = v.cells ? `S=${v.cells.support}(${v.cells.supportVerdict}) R=${v.cells.resistance}(${v.cells.resistanceVerdict})` : '—';
    console.log(`  ${q} [${v.status}] base ${v.base} → ${cells}; split ${v.split}${v.flag ? ` ⚠ ${v.flag}` : ''}`);
  }
}

// ── Artifact writer (compact, deterministic; no wallclock in per-symbol files) ─

async function writeJson(p, obj) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(obj));
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  let symbols, strataOf = () => null, stratumBySymbol = new Map();
  if (argv.length) {
    symbols = argv;
  } else if (fs.existsSync(UNIVERSE_PATH)) {
    const uni = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
    symbols = uni.symbols.map((s) => s.symbol);
    stratumBySymbol = new Map(uni.symbols.map((s) => [s.symbol, s.stratum]));
    strataOf = (sym) => stratumBySymbol.get(sym) || null;
    console.log(`Scope: frozen universe v${uni.universeVersion} (${symbols.length} study symbols)`);
  } else {
    symbols = [...CONFIG.universe.probe.equities];
    console.log(`Scope: frozen universe file missing — S2 probe equities only (${symbols.length} symbols)`);
  }
  console.log(`LevelStory events v${CONFIG.version} — zone anchor ± ${CONFIG.episode.zoneHalfWidthU}·u (=0.25·ATR), close sep ≥ ${CONFIG.episode.closeSeparationU}·u (=1.0·ATR), ≥ ${CONFIG.episode.closeMinSessionsOutside} session outside\n`);

  const allStats = [];
  const allEvents = [];
  const failures = [];
  const t0 = Date.now();

  for (const sym of symbols) {
    const levelsPath = path.join(LEVELS_DIR, `${sym}.json`);
    if (!fs.existsSync(levelsPath)) {
      failures.push({ symbol: sym, error: `missing ${path.relative(HERE, levelsPath)} — run \`npm run levels\` first` });
      console.log(`🔴 ${sym}: no level registry — skipped (run: npm run levels)`);
      continue;
    }
    try {
      const registry = JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
      const { fiveMinByDate, byDate } = loadFiveMinByDate(sym);
      const t = Date.now();
      const result = detectEvents({
        symbol: sym, sector: CONFIG.universe.sectorMap[sym] || null, stratum: strataOf(sym),
        registry, fiveMinByDate, dailyByDate: byDate,
      });
      const runtimeMs = Date.now() - t;
      await writeJson(path.join(EVENTS_DIR, `${sym}.json`), { symbol: sym, configVersion: CONFIG.version, events: result.events });
      const stats = computeEventStats(result, registry, runtimeMs);
      allStats.push(stats);
      for (const e of result.events) allEvents.push(e);
      const d = stats.dispositions;
      const tm = stats.tierMix, sm = stats.sideMix;
      console.log(`✅ ${sym.padEnd(5)} ev=${stats.eventsDetected} rej=${stats.rejected} shad=${stats.shadowed}`
        + ` | t/gb/rm=${d.touch}/${d.GAP_BREAK}/${d.RETIRED_MIDEPISODE}`
        + ` | S/R=${sm.support || 0}/${sm.resistance || 0}`
        + ` | F1/F2/F3=${tm.F1 || 0}/${tm.F2 || 0}/${tm.F3 || 0}`
        + ` | probes~${stats.medianProbesPerEpisode} epiLen~${stats.medianEpisodeLenSessions} | ${runtimeMs}ms`);
    } catch (e) {
      failures.push({ symbol: sym, error: e.message });
      console.log(`🔴 ${sym}: FAILED — ${e.message}`);
    }
  }

  const totalRuntimeMs = Date.now() - t0;
  const scan = scanEventWarnings(allStats, strataOf);
  const checkpoint = buildCheckpointReport(allEvents, { nSymbols: allStats.length || symbols.length, strataOf });

  await writeJson(path.join(EVENTS_DIR, '_stats.json'), {
    generatedAt: new Date().toISOString(), // wallclock is quarantined to _stats.json only
    configVersion: CONFIG.version,
    window: { start: CONFIG.range.studyStart, end: CONFIG.range.studyEnd, holdoutStart: HOLDOUT_START },
    totalRuntimeMs, failures,
    perSymbol: allStats,
    anomalyScan: scan,
    checkpoint,
  });

  console.log('\n──── anomaly scan (S4 §2 guards) ────');
  console.log('cross-strata (event-side):', JSON.stringify(scan.correlations));
  for (const w of scan.warnings) console.log(`⚠️  ${w}`);
  if (failures.length) console.log(`\n🔴 ${failures.length} symbol(s) FAILED: ${failures.map((f) => f.symbol).join(', ')}`);
  printCheckpoint(checkpoint);
  console.log(`\nArtifacts: data/events/{symbol}.json + data/events/_stats.json (gitignored). ${totalRuntimeMs}ms total.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
