// research/level-study/04-features.js
//
// LevelStory Session 5 — feature-layer runner (parent §8; Addendum §A2–§A5). Reads the event sets
// (data/events), the daily + raw-5m caches, and earnings; computes the availability-classed
// pre_touch feature set per event; writes data/features/{sym}.json + data/market/context_daily.json
// (gitignored); prints per-symbol null-rate diagnostics and THE POST-S5 BUDGET RE-READ (§7) —
// measured per-question cell counts vs n≥30 AND uniqueDates≥15 (S5-A2).
//
//   npm run features               # frozen universe
//   node 04-features.js AAPL       # explicit list
//
// No outcomes, no hourly classes, no forward-looking anything. Features are stored, never filters.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from './config.js';
import { buildSeries } from './lib/level-series.js';
import { loadFiveMinByDate } from './03-detect-events.js';
import { buildMarketContext } from './lib/features-market.js';
import { assembleEventFeatures, FEATURE_MANIFEST, PRE_TOUCH_KEYS } from './lib/features.js';
import { reportSessionIdxs } from './lib/features-daily.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const NORM_DIR = path.join(HERE, 'data', 'normalized');
const RAW_DIR = path.join(HERE, 'data', 'raw');
const EVENTS_DIR = path.join(HERE, 'data', 'events');
const FEATURES_DIR = path.join(HERE, 'data', 'features');
const MARKET_DIR = path.join(HERE, 'data', 'market');
const UNIVERSE_PATH = path.join(REPO_ROOT, CONFIG.universe.universeFilePath);
const MIN_N = CONFIG.honesty.acceptance.minN;                 // 30
const MIN_UD = CONFIG.honesty.acceptance.minUniqueDates;      // 15 (S5-A2)
const HOLDOUT = CONFIG.range.holdoutStart;

// ── Loaders (tolerant: a missing input degrades to nulls, never fabricates) ──

function loadDailySeries(sym) {
  const p = path.join(NORM_DIR, sym, 'daily.json');
  return fs.existsSync(p) ? buildSeries(JSON.parse(fs.readFileSync(p, 'utf8'))) : null;
}

function loadEvents(sym) {
  const p = path.join(EVENTS_DIR, `${sym}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).events : null;
}

/** Earnings report dates per symbol from the raw bulk cache (degrades to [] → features null). */
function loadEarningsDates() {
  const dir = path.join(RAW_DIR, '_earnings');
  const bySym = new Map();
  if (!fs.existsSync(dir)) return bySym;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const rows = Array.isArray(doc) ? doc : (doc && Array.isArray(doc.earnings) ? doc.earnings : []);
    for (const r of rows) {
      const sym = (r.code || r.symbol || '').split('.')[0];
      const d = r.report_date || r.date;
      if (!sym || !d) continue;
      if (!bySym.has(sym)) bySym.set(sym, new Set());
      bySym.get(sym).add(d);
    }
  }
  return new Map([...bySym].map(([s, set]) => [s, [...set].sort()]));
}

/**
 * Per-date prev-session close map for an ETF's 5m sessions (for the direction tags).
 * S5.6 §3: warmup5m sessions are EXCLUDED. The direction tags are features, and features may
 * never read a warmup bar — only the RVOL/volume baselines may. Filtering here keeps the first
 * study session's ETF direction null exactly as it was pre-warmup, so the warmup changes RVOL
 * and nothing else.
 */
function prevCloseMap(fiveMinByDate) {
  const dates = [...fiveMinByDate.keys()].filter((d) => !fiveMinByDate.get(d).warmup5m).sort();
  const m = new Map();
  for (let i = 1; i < dates.length; i++) m.set(dates[i], fiveMinByDate.get(dates[i - 1]).sessionCloseAdj);
  return m;
}

// ── Null-rate accounting (the expansion evidence, §4.5/§4.6) ─────────────────

export function nullRates(featureRows) {
  const counts = {}, total = featureRows.length;
  for (const k of Object.keys(FEATURE_MANIFEST)) counts[k] = 0;
  for (const row of featureRows) {
    for (const [k, v] of Object.entries(row.features.pre_touch)) if (v == null) counts[k] += 1;
    for (const [k, v] of Object.entries(row.features.post_touch)) if (v == null) counts[k] += 1;
  }
  const rates = {};
  for (const [k, c] of Object.entries(counts)) rates[k] = total ? Math.round((c / total) * 1000) / 10 : null;
  return { total, nullRatePct: rates };
}

// ── §7 THE POST-S5 BUDGET RE-READ ────────────────────────────────────────────

const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

function cell(rows) {
  const n = rows.length;
  const ud = new Set(rows.map((r) => r.eventDate)).size;
  return { n, uniqueDates: ud, verdict: n >= MIN_N && ud >= MIN_UD ? 'PASS' : 'UNDERPOWERED' };
}

/**
 * A cell for a DESCRIPTIVE class — counts ONLY, never a verdict.
 *
 * S56-A2 pre-registers OPEN_TOUCH as described-never-tested: no hypothesis, no verdict, no CI. But
 * `cell()` stamps `verdict: PASS | UNDERPOWERED` on everything it touches, and `printReread` prints
 * `c.verdict` generically — so an OPEN_TOUCH row would render as `OPEN_TOUCH … n=812 PASS`, and a
 * reader (the founder is non-technical and reads the verdict column) would take a descriptive
 * base-rate class for a cleared hypothesis. A cell may not display a verdict it does not have.
 * (BUILD_RULES §9: the label and the number come from one source, by construction.)
 */
function descriptiveCell(rows) {
  return { n: rows.length, uniqueDates: new Set(rows.map((r) => r.eventDate)).size };
}

/** rows = joined {event fields + features.pre_touch} for in-sample touch events. */
export function buildBudgetReread(rows) {
  const f2 = rows.filter((r) => r.familyTier === 'F2' || r.familyTier === 'F3');
  const side = (arr, s) => arr.filter((r) => r.side === s);
  const out = { acceptance: { minN: MIN_N, minUniqueDates: MIN_UD }, questions: {} };

  // P3 — F2+ × 3 RVOL buckets × side, ON hasIntradayApproach === true (S56-A1).
  //
  // P3 was ALREADY conditioned this way in fact — an event whose touch bar is the session's first
  // regular bar has zero pre-touch bars, so rvol_approach is UNDEFINED (100% null, measured) and it
  // fell into the null_rvol cell. S56-A1 makes the silent conditioning STATED. We are not narrowing
  // P3; we are telling the truth about its population. The excluded count is reported, never hidden.
  const f2approach = f2.filter((r) => r.hasIntradayApproach === true);
  const p3 = {};
  for (const s of ['support', 'resistance']) {
    for (const b of ['LOW', 'MID', 'HIGH']) p3[`${s}.${b}`] = cell(side(f2approach, s).filter((r) => r.features.pre_touch.rvol_bucket === b));
    // Residual nulls WITHIN the approach-bearing population (the 3.2% baseline/spin-up class) —
    // structurally different from the excluded no-approach events, so reported separately.
    p3[`${s}.null_rvol`] = { n: side(f2approach, s).filter((r) => r.features.pre_touch.rvol_bucket == null).length };
  }
  out.questions.P3 = {
    gate: 'F2+ AND hasIntradayApproach === true (S56-A1)',
    split: 'rvol_bucket × side',
    cells: p3,
    excludedNoIntradayApproach: {
      n: f2.filter((r) => r.hasIntradayApproach !== true).length,
      why: 'no regular bar before the touch bar → zero pre-touch bars → rvol_approach UNDEFINED (not missing). Split below into the true 09:30 gap-opens (OPEN_TOUCH, S56-A2) and data-gap sessions; never pooled into P3.',
    },
  };

  // The events with NO intraday approach are NOT one population. Two different things null RVOL:
  //   OPEN_TOUCH        — the touch bar IS the 09:30 regular open. A real gap-into-the-zone setup:
  //                       economically coherent, ~30% of episodes, the S56-A2 descriptive class.
  //   NO_PRE_BAR_DATA_GAP — the session's early bars are MISSING from the vendor feed (thin name,
  //                       halt, truncated chunk), so the first delivered bar is mid-session. This is
  //                       a DATA ARTIFACT, not a gap open.
  // Both are excluded from P3 (neither has a measurable approach), but pooling the artifacts into
  // OPEN_TOUCH would contaminate the base rates the founder reads for a real economic class. At ~230
  // names — many thinner than the 11 probes — this is a population, not a rounding error. So they
  // are separated by the touch bar's ET minute and reported apart.
  const REG_OPEN = CONFIG.session.regularOpenEtMinutes; // 570 = 09:30 ET
  const noApproach = rows.filter((r) => r.hasIntradayApproach !== true);
  const isOpenTouch = (r) => r.touchEtMinutes === REG_OPEN;
  const openTouch = {}, dataGap = {};
  for (const s of ['support', 'resistance']) {
    openTouch[s] = descriptiveCell(side(noApproach.filter(isOpenTouch), s));
    openTouch[`${s}.F2plus`] = descriptiveCell(side(f2.filter((r) => r.hasIntradayApproach !== true && isOpenTouch(r)), s));
    dataGap[s] = descriptiveCell(side(noApproach.filter((r) => !isOpenTouch(r)), s));
  }
  out.questions.OPEN_TOUCH = {
    gate: `disposition=touch AND hasIntradayApproach === false AND touchEtMinutes === ${REG_OPEN} (09:30 ET) — S56-A2`,
    split: 'side',
    cells: openTouch,
    descriptiveOnly: true,
    note: 'DESCRIPTIVE ONLY — no hypothesis is pre-registered on this class, so its cells carry NO verdict. Base rates (held_EOD, clean_bounce, MFE/MAE) are reported in S6. Never pooled into P3.',
  };
  out.questions.NO_PRE_BAR_DATA_GAP = {
    gate: `hasIntradayApproach === false AND touchEtMinutes !== ${REG_OPEN} — the session's early 5m bars are missing from the vendor feed`,
    split: 'side',
    cells: dataGap,
    descriptiveOnly: true,
    note: 'A DATA ARTIFACT, not an economic class. Excluded from P3 (no measurable approach) and deliberately NOT pooled into OPEN_TOUCH (which is a real gap-into-the-zone setup). Reported so the count is visible rather than silently absorbed. A large number here is a data-quality finding.',
  };

  // P6 — F2+ × EXT/NOT_EXT × side (MID displayed-not-tested) + regime interaction (drops first)
  const p6 = {}, p6x = {};
  for (const s of ['support', 'resistance']) {
    for (const b of ['EXT', 'NOT_EXT', 'MID']) p6[`${s}.${b}`] = cell(side(f2, s).filter((r) => r.features.pre_touch.extension_bucket === b));
    for (const g of ['MOMO_ON', 'MOMO_OFF', 'NEUTRAL']) {
      for (const b of ['EXT', 'NOT_EXT']) {
        p6x[`${s}.${b}.${g}`] = cell(side(f2, s).filter((r) => r.features.pre_touch.extension_bucket === b && r.features.pre_touch.momo_regime === g));
      }
    }
  }
  out.questions.P6 = {
    gate: 'F2+ (SHARP_REJECT split pending S6)', split: 'extension_bucket × side', cells: p6,
    regimeInteraction: p6x,
    fallback: 'pre-registered ladder: the regime interaction drops first if cells starve; per-side EXT vs NOT_EXT protected last',
  };

  // P4 — F1 vs F2 × side (per amendment S5-A1; SHARP_REJECT split pending S6; F3 = exploratory footnote)
  const p4 = {};
  for (const s of ['support', 'resistance']) {
    for (const t of ['F1', 'F2']) p4[`${s}.${t}`] = cell(side(rows, s).filter((r) => r.familyTier === t));
    p4[`${s}.F3_footnote`] = { n: side(rows, s).filter((r) => r.familyTier === 'F3').length };
  }
  out.questions.P4 = { gate: 'all-tier (SHARP_REJECT split pending S6)', split: 'F1 vs F2 × side (S5-A1)', cells: p4 };

  // P1/P2/P5 — still gated on hourly classes (S6): report the base + required class share
  const base = {};
  for (const s of ['support', 'resistance']) {
    const c = cell(side(f2, s));
    base[s] = { ...c, minClassSharePctToClearFloor: c.n > 0 ? round1((MIN_N / c.n) * 100) : null };
  }
  out.questions.P1_P2_P5 = {
    gate: 'F2+ per side (hourly-class split pending S6)', cells: base,
    note: 'each of the 5 hourly classes needs ≥ minClassSharePct of its side base (plus uniqueDates≥15) to clear the floor',
  };
  return out;
}

function printReread(rr) {
  console.log(`\n════════ §7 POST-S5 BUDGET RE-READ (floors: n≥${MIN_N} AND uniqueDates≥${MIN_UD} — S5-A2) ════════`);
  for (const [q, spec] of Object.entries(rr.questions)) {
    // A descriptive class is never tested, so it must never LOOK tested. Say so on the header line,
    // and its cells carry no verdict to print (descriptiveCell) — the two agree by construction.
    console.log(`  ${q} [gate ${spec.gate}]${spec.split ? ` split ${spec.split}` : ''}${spec.descriptiveOnly ? '  — DESCRIPTIVE ONLY, never tested (no verdict)' : ''}`);
    for (const [k, c] of Object.entries(spec.cells)) {
      console.log(`    ${k.padEnd(24)} n=${String(c.n).padStart(4)}${c.uniqueDates != null ? ` ud=${String(c.uniqueDates).padStart(3)}` : ''}${c.verdict ? ` ${c.verdict}` : ''}${c.minClassSharePctToClearFloor != null ? ` (each hourly class needs ≥${c.minClassSharePctToClearFloor}% share)` : ''}`);
    }
    if (spec.excludedNoIntradayApproach) {
      console.log(`    ${'excluded (no approach)'.padEnd(24)} n=${String(spec.excludedNoIntradayApproach.n).padStart(4)}  — stated, not hidden (S56-A1)`);
    }
    if (spec.regimeInteraction) {
      const dead = Object.values(spec.regimeInteraction).filter((c) => c.verdict === 'UNDERPOWERED').length;
      console.log(`    regime interaction: ${Object.keys(spec.regimeInteraction).length} cells, ${dead} underpowered — ${dead > 0 ? 'interaction DROPS (pre-registered fallback)' : 'viable'}`);
    }
  }
}

// ── Writer ────────────────────────────────────────────────────────────────────

async function writeJson(p, obj) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(obj));
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  let uni = null;
  if (fs.existsSync(UNIVERSE_PATH)) uni = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
  const members = uni ? uni.symbols : CONFIG.universe.probe.equities.map((s) => ({ symbol: s, sector: CONFIG.universe.sectorMap[s], stratum: null }));
  const symbols = argv.length ? argv : members.map((m) => m.symbol);
  console.log(`LevelStory features v${CONFIG.version} — ${PRE_TOUCH_KEYS.length} pre_touch features, availability-closed\n`);

  // S5.6 — the sector map is the FROZEN UNIVERSE's, not the config's 11-symbol probe map.
  //
  // `CONFIG.universe.sectorMap` only ever held the 11 probe names (it was transcribed from the v1
  // freeze). Under universe v2 (~230 names) a lookup there returns undefined for every new symbol →
  // sectorEtf null → sector_direction_at_touch, ret_*_vs_sector and sector_rs_vs_spy_* all null for
  // the overwhelming majority of the universe. That would silently null the very sector layer the
  // expansion was bought to switch on. The universe file carries `sector` per member; use it, and
  // fall back to the config map only for a degraded checkout.
  const sectorOf = new Map(members.filter((m) => m.sector).map((m) => [m.symbol, m.sector]));
  const sectorFor = (sym) => sectorOf.get(sym) || CONFIG.universe.sectorMap[sym] || null;

  // benchmarks + context symbols
  const spySeries = loadDailySeries('SPY');
  const sphbSeries = loadDailySeries('SPHB'), splvSeries = loadDailySeries('SPLV');
  const sectorEtfsInUse = [...new Set([...sectorOf.values(), ...Object.values(CONFIG.universe.sectorMap)])];
  const sectorSeriesByEtf = new Map();
  for (const etf of sectorEtfsInUse) sectorSeriesByEtf.set(etf, loadDailySeries(etf));
  const etf5m = new Map();
  const etfPrevClose = new Map(); // prev-close maps built ONCE per run (review fix: were rebuilt per event)
  // 5m context = SPY + EVERY sector ETF the universe actually references (was hardcoded SPY/XLK/XLE
  // — the cause of the 53.5% sector_rs_vs_spy null, and a trap for the expanded universe).
  for (const etf of ['SPY', ...sectorEtfsInUse]) {
    try {
      const m = loadFiveMinByDate(etf).fiveMinByDate;
      etf5m.set(etf, m);
      etfPrevClose.set(etf, prevCloseMap(m));
    } catch { etf5m.set(etf, null); etfPrevClose.set(etf, null); }
  }
  const earningsBySym = loadEarningsDates();

  // per-symbol daily series + events (the universe context for market + peer layers)
  const memberCtx = [];
  for (const m of members) {
    const series = loadDailySeries(m.symbol);
    const events = loadEvents(m.symbol);
    if (series) memberCtx.push({ symbol: m.symbol, sector: m.sector, stratum: m.stratum, series, events: events || [] });
  }
  if (!memberCtx.length) { console.log('🔴 no data present — run `npm run fetch && npm run levels && npm run events` first'); process.exit(1); }

  // market context, computed ONCE on the master calendar (SPY dates; fallback: first member)
  const calendar = (spySeries || memberCtx[0].series).dates.filter((d) => d >= CONFIG.range.studyStart && d <= CONFIG.range.studyEnd);
  const marketByDate = buildMarketContext({ sessionDates: calendar, members: memberCtx, spy: spySeries, sphb: sphbSeries, splv: splvSeries });
  await writeJson(path.join(MARKET_DIR, 'context_daily.json'), { configVersion: CONFIG.version, sessions: [...marketByDate.values()] });
  console.log(`market context: ${marketByDate.size} sessions → data/market/context_daily.json`);
  const regimeNull = [...marketByDate.values()].filter((c) => c.momo_regime == null).length;
  console.log(`⚠ momo_regime null on ${regimeNull}/${marketByDate.size} sessions — and at ${memberCtx.length} symbols the deciles are ~1 name: the regime meter is NOT trustworthy at this scale (expansion evidence)\n`);

  // S5.6 — STALE-ARTIFACT PRECHECK (must run BEFORE the per-symbol loop).
  //
  // assembleEventFeatures throws when an event predates S56-A1 (no `hasIntradayApproach`). But that
  // throw lands in the per-symbol try/catch below, which records a failure and CONTINUES. On a stale
  // pipeline the throw fires for every symbol → every symbol is skipped → `allRows` is empty →
  // buildBudgetReread([]) emits an all-zero, all-UNDERPOWERED table, _stats.json is overwritten with
  // it, the previous run's data/features/{sym}.json survive untouched, and the process exits 0.
  // A silent all-zero budget re-read is exactly the failure this study cannot tolerate.
  //
  // So check the schema up front and ABORT. The pipeline order is levels → events → features; a
  // stale events artifact means the operator skipped a stage, and the only correct response is to
  // stop and say so.
  for (const m of memberCtx) {
    const bad = m.events.find((ev) => typeof ev.hasIntradayApproach !== 'boolean');
    if (bad) {
      console.log(`\n🔴 STALE EVENT ARTIFACT — ${m.symbol}: event ${bad.eventId} has no \`hasIntradayApproach\` (S56-A1).`);
      console.log('   These events predate S5.6. Re-run the pipeline before features:');
      console.log('     npm run levels && npm run events && npm run features');
      console.log('   Aborting so a stale run cannot silently emit an all-zero budget re-read.');
      process.exit(1);
    }
  }

  const allRows = [];
  const failures = [];
  const t0 = Date.now();

  for (const sym of symbols) {
    const me = memberCtx.find((m) => m.symbol === sym);
    if (!me || !me.events.length) { failures.push({ symbol: sym, error: 'missing series or events — run upstream stages' }); console.log(`🔴 ${sym}: missing inputs — skipped`); continue; }
    try {
      const t = Date.now();
      const { fiveMinByDate } = loadFiveMinByDate(sym);
      // S5.6 §3: `sessionDates` is STUDY-WINDOW ONLY — every feature (gap_context, the approach
      // seed) walks it, and a feature may never read a warmup5m bar. The RVOL/volume baseline
      // derives its own calendar from `fiveMinByDate` inside assembleEventFeatures, so the warmup
      // is reachable on exactly that one path and nowhere else.
      const sessionDates = [...fiveMinByDate.keys()].filter((d) => !fiveMinByDate.get(d).warmup5m).sort();
      const sectorEtf = sectorFor(sym); // universe-file sector (v2), not the 11-symbol probe map
      const sectorSeries = sectorEtf ? sectorSeriesByEtf.get(sectorEtf) : null;
      const sector5m = sectorEtf ? etf5m.get(sectorEtf) || null : null;
      const peers = memberCtx.filter((m) => m.symbol !== sym && m.sector === me.sector);
      const reports = reportSessionIdxs(me.series, earningsBySym.get(sym) || []);

      const rows = [];
      const dailyCache = new Map(); // events sharing (eventDate, side) reuse the daily block
      for (const ev of me.events) {
        rows.push(assembleEventFeatures({
          event: ev, series: me.series, fiveMinByDate, sessionDates,
          spySeries, sectorSeries,
          spyFiveMinByDate: etf5m.get('SPY'), sectorFiveMinByDate: sector5m,
          spyPrevCloseAdjByDate: etfPrevClose.get('SPY'),
          sectorPrevCloseAdjByDate: sectorEtf ? etfPrevClose.get(sectorEtf) || null : null,
          marketByDate, peers, reports, dailyCache,
        }));
      }
      await writeJson(path.join(FEATURES_DIR, `${sym}.json`), { symbol: sym, configVersion: CONFIG.version, rows });
      allRows.push(...rows);
      const nr = nullRates(rows);
      const peerNull = nr.nullRatePct.peer_level_event_rate_prior_5d;
      console.log(`✅ ${sym.padEnd(5)} events=${rows.length} | peers null=${peerNull}% | rvol null=${nr.nullRatePct.rvol_approach}% | ext null=${nr.nullRatePct.extension_pctile}% | ${Date.now() - t}ms`);
    } catch (e) {
      failures.push({ symbol: sym, error: e.message });
      console.log(`🔴 ${sym}: FAILED — ${e.message}`);
    }
  }

  const agg = nullRates(allRows);
  const inSample = allRows.filter((r) => r.disposition === 'touch' && r.eventDate < HOLDOUT);
  const reread = buildBudgetReread(inSample);

  await writeJson(path.join(FEATURES_DIR, '_stats.json'), {
    generatedAt: new Date().toISOString(), configVersion: CONFIG.version,
    totalRuntimeMs: Date.now() - t0, failures,
    totalEvents: allRows.length, inSampleTouch: inSample.length,
    nullRates: agg, budgetReread: reread,
  });

  console.log('\n──── null rates (expansion evidence; % of events) ────');
  for (const layer of ['group', 'market']) {
    for (const [k, m] of Object.entries(FEATURE_MANIFEST)) if (m.layer === layer) console.log(`  ${k.padEnd(44)} ${agg.nullRatePct[k]}%`);
  }
  printReread(reread);
  console.log(`\nArtifacts: data/features/{sym}.json + data/market/context_daily.json + data/features/_stats.json (gitignored). ${Date.now() - t0}ms total.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
