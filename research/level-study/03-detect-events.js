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

// ── The market session calendar (S56-C3) ─────────────────────────────────────
//
// This stage RE-NORMALIZES from the raw cache, because it needs the per-bar `regular` arrays that
// sessions.json does not store. That means it re-derives the hourly buckets too — and therefore it
// needs the same session calendar 01-fetch used, or it silently rebuilds every bucket against a
// 16:00 close and stamps pre-fix coverage onto every event. (It did exactly that for one build: the
// sessions on disk were right, the events were wrong, and nothing failed.)
//
// Missing calendar ⇒ HARD FAILURE. Never a silent fall back to a full-day expectation.
let _calendar = null;
function sessionCalendar() {
  if (_calendar) return _calendar;
  const p = path.join(NORM_DIR, '_session_calendar.json');
  if (!fs.existsSync(p)) {
    throw new Error(
      `MISSING_SESSION_CALENDAR: ${path.relative(HERE, p)} not found. It is written by 01-fetch-history. ` +
      'Without it every half-day is measured against a 78-bar expectation and read as a data gap (S56-A4/C3). ' +
      'Run `npm run fetch` first — refusing to stamp biased coverage onto 166k events.',
    );
  }
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  _calendar = new Map(Object.entries(doc.sessionEndEtMinutes).map(([d, m]) => [d, Number(m)]));
  return _calendar;
}

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
  const { bars, sessions } = normalizeFiveMin(raw, byDate, sessionCalendar());
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
      warmup5m: s.warmup5m, // S5.6 §3: carried so consumers can separate baseline-only sessions
      hourly: s.hourly,     // S56-A4: per-bucket bar coverage — the hourly-class eligibility guard
      expectedRegularBarCount: s.expectedRegularBarCount, // S56-A5: whole-session 5m coverage input
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
  // S5.6: the SECTOR stamped on every event record must come from the FROZEN UNIVERSE, not from
  // `CONFIG.universe.sectorMap` — that map only ever held the 11 v1 probe names, so under universe
  // v2 it returns null for ~221 of 232 symbols, and the anomaly scan's cross-sector cut plus every
  // downstream sector grouping would read `sector: null` for the overwhelming majority of events.
  let sectorBySymbol = new Map();
  let sectorOf = (sym) => CONFIG.universe.sectorMap[sym] || null; // degraded-checkout fallback

  if (argv.length) {
    symbols = argv;
    // An explicit CLI list still needs real sectors — read them from the frozen file if present.
    if (fs.existsSync(UNIVERSE_PATH)) {
      const uni = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
      sectorBySymbol = new Map(uni.symbols.map((s) => [s.symbol, s.sector]));
      stratumBySymbol = new Map(uni.symbols.map((s) => [s.symbol, s.stratum]));
      sectorOf = (sym) => sectorBySymbol.get(sym) || CONFIG.universe.sectorMap[sym] || null;
      strataOf = (sym) => stratumBySymbol.get(sym) || null;
    }
  } else if (fs.existsSync(UNIVERSE_PATH)) {
    const uni = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
    // S5.6 Phase B: skip A1 cross-grain quarantined symbols (see 02-build-levels.js), loudly.
    const quarantined = uni.symbols.filter((s) => s.quarantined).map((s) => s.symbol);
    if (quarantined.length) console.log(`🔴 QUARANTINED (A1 cross-grain fail — skipped, founder ruling pending): ${quarantined.join(', ')}`);
    symbols = uni.symbols.filter((s) => !s.quarantined).map((s) => s.symbol);
    sectorBySymbol = new Map(uni.symbols.map((s) => [s.symbol, s.sector]));
    stratumBySymbol = new Map(uni.symbols.map((s) => [s.symbol, s.stratum]));
    sectorOf = (sym) => sectorBySymbol.get(sym) || CONFIG.universe.sectorMap[sym] || null;
    strataOf = (sym) => stratumBySymbol.get(sym) || null;
    console.log(`Scope: frozen universe v${uni.universeVersion} (${symbols.length} study symbols)`);
  } else {
    symbols = [...CONFIG.universe.probe.equities];
    console.log(`Scope: frozen universe file missing — S2 probe equities only (${symbols.length} symbols)`);
  }
  console.log(`LevelStory events v${CONFIG.version} — zone anchor ± ${CONFIG.episode.zoneHalfWidthU}·u (=0.25·ATR), close sep ≥ ${CONFIG.episode.closeSeparationU}·u (=1.0·ATR), ≥ ${CONFIG.episode.closeMinSessionsOutside} session outside\n`);

  // S56-A6 — DEAD-TAPE TRUNCATION (founder ruling). Once a take-private is announced the stock pins
  // to the deal price and realized volatility collapses: the tape is arbitrage, not price discovery.
  // Level interactions there are meaningless — everything "holds" because nothing MOVES — and those
  // events would inflate hold rates with non-market behaviour.
  //
  // The NAMES ARE KEPT and their live history is retained in full. Dropping a stock BECAUSE it was
  // acquired would be survivorship bias we introduced ourselves. Only the dead tail is cut, at a
  // date derived MECHANICALLY from the price series (tools/dead-tape-detect.mjs), never from news.
  const endOverride = new Map();
  if (fs.existsSync(UNIVERSE_PATH)) {
    const u = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
    for (const m of u.symbols) if (m.studyEndOverride) endOverride.set(m.symbol, m.studyEndOverride);
  }
  if (endOverride.size) {
    console.log(`✂️  DEAD-TAPE TRUNCATION (S56-A6): ${[...endOverride.entries()].map(([s, d]) => `${s} → events after ${d} excluded`).join(', ')}`);
  }
  const deadTapeDropped = {};

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
        symbol: sym, sector: sectorOf(sym), stratum: strataOf(sym), // frozen-universe sector (v2), not the 11-probe config map
        registry, fiveMinByDate, dailyByDate: byDate,
      });
      const runtimeMs = Date.now() - t;

      // S56-A6: cut the dead tail BEFORE stats, so every downstream number — per-symbol diagnostics,
      // the anomaly scan, the event-budget checkpoint — is computed on the truncated set. Filtering
      // later would leave the printed diagnostics describing a population the study does not use.
      const cut = endOverride.get(sym);
      if (cut) {
        const before = result.events.length;
        result.events = result.events.filter((e) => e.eventDate <= cut);
        deadTapeDropped[sym] = { cutAfter: cut, dropped: before - result.events.length, retained: result.events.length };
      }

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

  // S56-A6 — state the truncation as a printed number, never a silent filter.
  if (Object.keys(deadTapeDropped).length) {
    console.log('\n──── dead-tape truncation (S56-A6) ────');
    let tot = 0;
    for (const [sym, d] of Object.entries(deadTapeDropped)) {
      tot += d.dropped;
      console.log(`  ${sym.padEnd(5)} events after ${d.cutAfter} EXCLUDED: ${d.dropped}  (retained ${d.retained})`);
    }
    console.log(`  total excluded: ${tot} — dead tape yields few events precisely BECAUSE price does not move.`);
  }

  console.log('\n──── anomaly scan (S4 §2 guards) ────');
  console.log('cross-strata (event-side):', JSON.stringify(scan.correlations));
  for (const w of scan.warnings) console.log(`⚠️  ${w}`);
  if (failures.length) console.log(`\n🔴 ${failures.length} symbol(s) FAILED: ${failures.map((f) => f.symbol).join(', ')}`);
  printCheckpoint(checkpoint);
  console.log(`\nArtifacts: data/events/{symbol}.json + data/events/_stats.json (gitignored). ${totalRuntimeMs}ms total.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
