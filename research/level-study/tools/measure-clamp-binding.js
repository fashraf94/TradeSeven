// research/level-study/tools/measure-clamp-binding.js
//
// Finalize the distanceUnit clamp guards (floorPct / capPct) against the PRE-REGISTERED
// criterion (S3.5-b, amendment 7 / S35-C10):
//
//   each guard binds in ≤10% of symbol-sessions for EVERY symbol.
//
// Let x = 100 · atrMultiple · ATR14(D−1) / price(D−1) — exactly the quantity
// distanceUnit() compares against floorPct / capPct.
//   floor binds ⇔ x < floorPct  → want P(x<floorPct) ≤ 0.10 ∀s ⇔ floorPct ≤ min_s p10(x_s)
//   cap   binds ⇔ x > capPct    → want P(x>capPct)   ≤ 0.10 ∀s ⇔ capPct   ≥ max_s p90(x_s)
//
//   node tools/measure-clamp-binding.js            # frozen universe, from data/normalized
//   node tools/measure-clamp-binding.js AAPL BE    # explicit symbols
//
// Reads data/normalized/{symbol}/daily.json (the S2 fetcher's output — run
// `node 01-fetch-history.js <sym>` first for any missing symbol). Prints the per-symbol
// 0.25×ATR% distribution, per-symbol binding rates at the CURRENT config values and at the
// tool's RECOMMENDED values, and the recommended floorPct / capPct to paste into config.
// Zero product imports; measures only — writes nothing, tunes nothing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from '../config.js';
import { buildSeries } from '../lib/level-series.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.resolve(HERE, '..');
const NORM_DIR = path.join(STUDY, 'data', 'normalized');
const UNIVERSE = path.join(STUDY, path.relative(STUDY, path.resolve(STUDY, '..', '..', CONFIG.universe.universeFilePath)));
const ATR_MULT = CONFIG.levels.geometry.distanceUnit.atrMultiple; // 0.25
const ATR_PERIOD = CONFIG.episode.atr.period;                     // 14
const STUDY_START = CONFIG.range.studyStart, STUDY_END = CONFIG.range.studyEnd;

function pctile(sorted, q) { // type-7 linear interpolation
  if (!sorted.length) return null;
  const h = (sorted.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}
const bindLow = (xs, f) => (100 * xs.filter((x) => x < f).length) / xs.length;
const bindHigh = (xs, c) => (100 * xs.filter((x) => x > c).length) / xs.length;

function xSeries(dailyBars, window) {
  const s = buildSeries(dailyBars);
  const xs = [];
  for (let i = ATR_PERIOD; i < s.n; i++) {          // session at i uses ATR/price at i−1 (distanceUnit call site)
    const D = s.dates[i];
    if (window === 'study' && !(D >= STUDY_START && D <= STUDY_END)) continue;
    const atr = s.atr[i - 1], price = s.aClose[i - 1];
    if (atr == null || !(price > 0)) continue;
    xs.push(100 * ATR_MULT * atr / price);
  }
  return xs.sort((a, b) => a - b);
}

function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  let symbols = argv;
  if (!symbols.length) {
    if (!fs.existsSync(UNIVERSE)) { console.error(`No universe file at ${UNIVERSE} and no symbols given.`); process.exit(1); }
    symbols = JSON.parse(fs.readFileSync(UNIVERSE, 'utf8')).symbols.map((s) => s.symbol);
  }

  const cur = CONFIG.levels.geometry.distanceUnit;
  console.log(`Clamp-binding measurement — config v${CONFIG.version} (floorPct=${cur.floorPct}, capPct=${cur.capPct}), atrMultiple=${ATR_MULT}`);
  console.log(`Criterion: each guard binds ≤10% of symbol-sessions for EVERY symbol.\n`);

  const rows = [];
  const missing = [];
  for (const sym of symbols) {
    const p = path.join(NORM_DIR, sym, 'daily.json');
    if (!fs.existsSync(p)) { missing.push(sym); continue; }
    // daily.json is the S2 fetcher's ALREADY-NORMALIZED output (normalizeDaily().bars) —
    // the same shape the levels runner reads and hands straight to buildSeries. Do not
    // re-normalize (that would look for raw EODHD field names and quarantine every bar).
    const bars = JSON.parse(fs.readFileSync(p, 'utf8'));
    const study = xSeries(bars, 'study'), full = xSeries(bars, 'full');
    if (!study.length) { missing.push(sym); continue; }
    rows.push({ sym, study, full, p10s: pctile(study, 0.10), p90s: pctile(study, 0.90), p10f: pctile(full, 0.10), p90f: pctile(full, 0.90) });
  }
  if (!rows.length) { console.error('No measurable symbols (run `node 01-fetch-history.js <sym>` to populate data/normalized).'); process.exit(1); }

  console.log('0.25×ATR%  per symbol   (study window | full history)');
  console.log('sym   |   n | study p10 | study p50 | study p90 | full p10 | full p90');
  for (const r of rows) {
    console.log(`${r.sym.padEnd(5)} | ${String(r.study.length).padStart(4)} | ${r.p10s.toFixed(3).padStart(9)} | ${pctile(r.study,0.5).toFixed(3).padStart(9)} | ${r.p90s.toFixed(3).padStart(9)} | ${r.p10f.toFixed(3).padStart(8)} | ${r.p90f.toFixed(3).padStart(8)}`);
  }

  // Pre-registered criterion, evaluated over BOTH windows (the strict superset).
  const minP10 = Math.min(...rows.map((r) => Math.min(r.p10s, r.p10f)));
  const maxP90 = Math.max(...rows.map((r) => Math.max(r.p90s, r.p90f)));
  const floorSym = rows.find((r) => Math.min(r.p10s, r.p10f) === minP10).sym;
  const capSym = rows.find((r) => Math.max(r.p90s, r.p90f) === maxP90).sym;
  // Round floor DOWN and cap UP to 2 dp so ≤10% holds strictly with a hair of margin.
  const recFloor = Math.floor(minP10 * 100) / 100;
  const recCap = Math.ceil(maxP90 * 100) / 100;

  console.log(`\nBoundaries: min_s p10 = ${minP10.toFixed(4)} (set by ${floorSym});  max_s p90 = ${maxP90.toFixed(4)} (set by ${capSym})`);
  console.log(`RECOMMENDED (round floor↓, cap↑): floorPct = ${recFloor}, capPct = ${recCap}\n`);

  for (const [label, floorPct, capPct] of [['CURRENT config', cur.floorPct, cur.capPct], ['RECOMMENDED', recFloor, recCap]]) {
    console.log(`Binding rates — ${label} (floorPct=${floorPct}, capPct=${capPct}):`);
    console.log('sym   | floor study/full | cap study/full');
    let ok = true;
    for (const r of rows) {
      const fs2 = bindLow(r.study, floorPct), ff = bindLow(r.full, floorPct);
      const cs = bindHigh(r.study, capPct), cf = bindHigh(r.full, capPct);
      if (Math.max(fs2, ff, cs, cf) > 10.0001) ok = false;
      const flag = Math.max(fs2, ff, cs, cf) > 10.0001 ? ' ⚠ >10%' : '';
      console.log(`${r.sym.padEnd(5)} | ${fs2.toFixed(1).padStart(6)}% / ${ff.toFixed(1).padStart(5)}% | ${cs.toFixed(1).padStart(5)}% / ${cf.toFixed(1).padStart(5)}%${flag}`);
    }
    console.log(`  ⇒ ≤10% for every symbol, both windows: ${ok ? 'YES' : 'NO'}\n`);
  }

  if (missing.length) console.log(`⚠ NOT MEASURED (no data/normalized): ${missing.join(', ')} — run \`node 01-fetch-history.js ${missing.join(' ')}\` then re-run this tool.`);
  console.log(`Symbols measured: ${rows.map((r) => r.sym).join(', ')} (${rows.length}/${symbols.length}).`);
}

main();
