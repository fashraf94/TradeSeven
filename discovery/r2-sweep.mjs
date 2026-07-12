// discovery/r2-sweep.mjs
//
// LevelStory S5.5 — Job B3 R2 eligibility sweep (FOUNDER-LOCAL; read-only, throwaway).
// Grades the candidate universe against R2 (>=550 daily sessions before studyStart) using the
// study's OWN utility (research/level-study/lib/depth-eligibility.js) — no math duplicated.
//
// Prereq: daily bars fetched to research/level-study/data/normalized/{SYM}/daily.json
//   node research/level-study/01-fetch-history.js --daily-only <the 239 tickers>
//
// Usage:
//   node discovery/r2-sweep.mjs                 # sweeps the full rankingConfig ALL_TICKERS (239)
//   node discovery/r2-sweep.mjs AAPL NVDA ...    # explicit list
//
// Read-only: calls the exported depthEligibilitySweep (permitted — reading/calling study lib
// functions is fine; nothing under research/level-study/ is modified). No refetch here.

import fs from 'node:fs';
import path from 'node:path';
import { depthEligibilitySweep } from '../research/level-study/lib/depth-eligibility.js';
import { ALL_TICKERS } from '../api/_utils/rankingConfig.js';

const NORM_DIR = path.resolve('research/level-study/data/normalized');

function loadDaily(sym) {
  const p = path.join(NORM_DIR, sym, 'daily.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const argv = process.argv.slice(2).filter(Boolean);
const symbols = argv.length ? argv : ALL_TICKERS;

const entries = [];
const missing = [];
for (const sym of symbols) {
  const bars = loadDaily(sym);
  if (!bars || !bars.length) { missing.push(sym); continue; }
  entries.push({ symbol: sym, dailyBars: bars });
}

if (!entries.length) {
  console.log(`🔴 no daily data under ${NORM_DIR}. Fetch first:`);
  console.log(`   node research/level-study/01-fetch-history.js --daily-only ${symbols.slice(0, 6).join(' ')} ...`);
  process.exit(1);
}

const rows = depthEligibilitySweep(entries); // FAIL-first, then thinnest margin (depth-eligibility.js:39-46)
const pass = rows.filter((r) => r.verdict === 'PASS');
const fail = rows.filter((r) => r.verdict === 'FAIL');

console.log(`\n════════ R2 SWEEP — >=550 daily sessions before 2023-07-10 (${entries.length} graded, ${missing.length} missing data) ════════`);
console.log(`  ${'sym'.padEnd(7)} ${'verdict'.padEnd(7)} ${'firstBar'.padEnd(11)} ${'preStudy'.padStart(8)} ${'margin'.padStart(7)}`);
for (const r of rows) {
  console.log(`  ${r.symbol.padEnd(7)} ${r.verdict.padEnd(7)} ${String(r.firstDailyBar).padEnd(11)} ${String(r.preStudySessions).padStart(8)} ${String(r.margin).padStart(7)}`);
}
console.log(`\nSummary: ${pass.length}/${entries.length} clear R2  |  FAIL: ${fail.map((r) => r.symbol).join(', ') || '(none)'}`);
if (missing.length) console.log(`Missing daily data (not graded): ${missing.join(', ')}`);
console.log(`\nReminder: R2 count-PASS does NOT clear a de-SPAC/SPAC-shell name (DKNG/RKLB lesson). Flag thin-margin & recent-listing`);
console.log(`names for the shell-contamination check separately (long pre-listing near-$10 low-vol stretch → regime change). Founder rules each.`);
