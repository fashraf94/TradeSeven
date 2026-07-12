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

/** Per-date prev-session close map for an ETF's 5m sessions (for the direction tags). */
function prevCloseMap(fiveMinByDate) {
  const dates = [...fiveMinByDate.keys()].sort();
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

/** rows = joined {event fields + features.pre_touch} for in-sample touch events. */
export function buildBudgetReread(rows) {
  const f2 = rows.filter((r) => r.familyTier === 'F2' || r.familyTier === 'F3');
  const side = (arr, s) => arr.filter((r) => r.side === s);
  const out = { acceptance: { minN: MIN_N, minUniqueDates: MIN_UD }, questions: {} };

  // P3 — F2+ × 3 RVOL buckets × side (bucket edges pre-registered, config S5-C1)
  const p3 = {};
  for (const s of ['support', 'resistance']) {
    for (const b of ['LOW', 'MID', 'HIGH']) p3[`${s}.${b}`] = cell(side(f2, s).filter((r) => r.features.pre_touch.rvol_bucket === b));
    p3[`${s}.null_rvol`] = { n: side(f2, s).filter((r) => r.features.pre_touch.rvol_bucket == null).length };
  }
  out.questions.P3 = { gate: 'F2+', split: 'rvol_bucket × side', cells: p3 };

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
    console.log(`  ${q} [gate ${spec.gate}]${spec.split ? ` split ${spec.split}` : ''}`);
    for (const [k, c] of Object.entries(spec.cells)) {
      console.log(`    ${k.padEnd(24)} n=${String(c.n).padStart(4)}${c.uniqueDates != null ? ` ud=${String(c.uniqueDates).padStart(3)}` : ''}${c.verdict ? ` ${c.verdict}` : ''}${c.minClassSharePctToClearFloor != null ? ` (each hourly class needs ≥${c.minClassSharePctToClearFloor}% share)` : ''}`);
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

  // benchmarks + context symbols
  const spySeries = loadDailySeries('SPY');
  const sphbSeries = loadDailySeries('SPHB'), splvSeries = loadDailySeries('SPLV');
  const sectorSeriesByEtf = new Map();
  for (const etf of new Set(Object.values(CONFIG.universe.sectorMap))) sectorSeriesByEtf.set(etf, loadDailySeries(etf));
  const etf5m = new Map();
  for (const etf of ['SPY', 'XLK', 'XLE']) {
    try { etf5m.set(etf, loadFiveMinByDate(etf).fiveMinByDate); } catch { etf5m.set(etf, null); }
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

  const allRows = [];
  const failures = [];
  const t0 = Date.now();

  for (const sym of symbols) {
    const me = memberCtx.find((m) => m.symbol === sym);
    if (!me || !me.events.length) { failures.push({ symbol: sym, error: 'missing series or events — run upstream stages' }); console.log(`🔴 ${sym}: missing inputs — skipped`); continue; }
    try {
      const t = Date.now();
      const { fiveMinByDate } = loadFiveMinByDate(sym);
      const sessionDates = [...fiveMinByDate.keys()].sort();
      const sectorEtf = CONFIG.universe.sectorMap[sym] || null;
      const sectorSeries = sectorEtf ? sectorSeriesByEtf.get(sectorEtf) : null;
      const sector5m = sectorEtf ? etf5m.get(sectorEtf) || null : null;
      const peers = memberCtx.filter((m) => m.symbol !== sym && m.sector === me.sector);
      const reports = reportSessionIdxs(me.series, earningsBySym.get(sym) || []);

      const rows = [];
      for (const ev of me.events) {
        rows.push(assembleEventFeatures({
          event: ev, series: me.series, fiveMinByDate, sessionDates,
          spySeries, sectorSeries,
          spyFiveMinByDate: etf5m.get('SPY'), sectorFiveMinByDate: sector5m,
          spyPrevCloseAdjByDate: etf5m.get('SPY') ? prevCloseMap(etf5m.get('SPY')) : null,
          sectorPrevCloseAdjByDate: sector5m ? prevCloseMap(sector5m) : null,
          marketByDate, peers, reports,
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
