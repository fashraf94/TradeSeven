// research/level-study/tools/cross-grain-integrity.mjs
//
// S5.6 Phase B — CROSS-GRAIN INTEGRITY SCAN (A1 / parent §4.3).
//
//   node tools/cross-grain-integrity.mjs
//
// The A1 invariant pairs the RAW daily close against the 5-minute closing-auction print of the same
// session and requires them to agree within 0.1% — a tolerance that is NEVER loosened (S3-R2).
// It exists to prove the two grains sit on the same price basis before anything is built on them.
//
// At 11 mega-caps it always passed. At 232 names it does not, and the failures are not noise: the
// diff is CONSTANT across a span and then stops dead on one date — the signature of a CORPORATE
// ACTION that the vendor applied to one grain and not the other.
//
// This tool measures the failure per symbol, extracts the constant ratio and the break date, and
// reports. It DECIDES NOTHING and it fixes nothing: per parent §4.3 the rule is "quarantine, don't
// degrade" — a symbol whose grains disagree cannot have its 5m placed on the daily basis at all,
// and making the invariant pass by construction would destroy the very diagnostic that caught this.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from '../config.js';
import { crossGrainCheck } from '../lib/normalize.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(STUDY_ROOT, '..', '..');
const NORM = path.join(STUDY_ROOT, 'data', 'normalized');
const OUT = path.join(STUDY_ROOT, 'data', 'phase-a', 'cross_grain_integrity.json');
const UNIVERSE = path.join(REPO_ROOT, CONFIG.universe.universeFilePath);
const TOL = CONFIG.adjustment.crossGrainInvariant.tolerancePct; // 0.1 — NEVER loosened

const uni = JSON.parse(fs.readFileSync(UNIVERSE, 'utf8'));
const rows = [];

for (const m of uni.symbols) {
  const sym = m.symbol;
  const sPath = path.join(NORM, sym, 'sessions.json');
  const dPath = path.join(NORM, sym, 'daily.json');
  if (!fs.existsSync(sPath) || !fs.existsSync(dPath)) continue;
  const sessions = JSON.parse(fs.readFileSync(sPath, 'utf8'));
  const byDate = new Map(JSON.parse(fs.readFileSync(dPath, 'utf8')).map((b) => [b.date, b]));
  const res = crossGrainCheck(sessions, byDate);
  const fails = res.filter((r) => !r.pass).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!fails.length) continue;

  // A corporate-action mismatch shows up as a CONSTANT ratio across the failing span. Measure it:
  // if the ratio is constant, this is a vendor basis divergence, not random data noise.
  const ratios = fails.map((f) => f.auctionClose / f.dailyClose);
  const rMin = Math.min(...ratios), rMax = Math.max(...ratios);
  const constant = (rMax - rMin) / rMax < 1e-4; // ratio identical to 4 decimal places across the span

  const passes = res.filter((r) => r.pass).map((r) => r.date).sort();
  const lastFail = fails[fails.length - 1].date;
  const breakDate = passes.find((d) => d > lastFail) || null; // the session the grains re-converge

  rows.push({
    symbol: sym, sector: m.sector,
    checked: res.length, failed: fails.length,
    failPct: Math.round((fails.length / res.length) * 1000) / 10,
    ratio: Math.round(rMax * 10000) / 10000,
    ratioIsConstant: constant,
    diffPct: Math.round(fails[0].diffPct * 100) / 100,
    firstFail: fails[0].date, lastFail, breakDate,
    verdict: 'QUARANTINE',
  });
}

const line = (s) => console.log(s);
line(`\n════════ CROSS-GRAIN INTEGRITY (A1: |raw daily close − 5m auction print| ≤ ${TOL}%) ════════`);
line(`  Scanned ${uni.symbols.length} symbols. Symbols with ANY failing session: ${rows.length}\n`);
if (!rows.length) {
  line('  ✅ every symbol passes on every session — both grains share one price basis.');
} else {
  for (const r of rows.sort((a, b) => b.failPct - a.failPct)) {
    line(`  🔴 ${r.symbol.padEnd(6)} [${r.sector}] ${r.failed}/${r.checked} sessions FAIL (${r.failPct}%)`);
    line(`       constant ratio ${r.ratio}× (diff ${r.diffPct}%) — ${r.ratioIsConstant ? 'CONSTANT across the whole span ⇒ a CORPORATE ACTION, not noise' : '⚠ ratio VARIES — not a clean corporate action'}`);
    line(`       fails ${r.firstFail} → ${r.lastFail}; grains re-converge ${r.breakDate}`);
  }
  line(`\n  DIAGNOSIS: EODHD back-adjusts the DAILY \`close\` field for SPINOFFS, but delivers 5-minute`);
  line(`  bars AS PRINTED. So the A1 premise — "daily close is the raw point-in-time print" — is FALSE`);
  line(`  for these names, and only for sessions BEFORE their spinoff date.`);
  line(`\n  CONSEQUENCE: levels/ATR are built on the daily (spinoff-adjusted) basis while events are`);
  line(`  detected on 5m bars that are NOT spinoff-adjusted. For DD the two differ by 2.39× — every`);
  line(`  level would sit 139% away from every 5m bar. The events for these names would be garbage.`);
  line(`\n  ACTION: QUARANTINE (parent §4.3 "quarantine, don't degrade"). Not fixed here: deriving the`);
  line(`  factor from the auction print instead would make the A1 invariant pass BY CONSTRUCTION and`);
  line(`  destroy the diagnostic that caught this. The 0.1% tolerance is NEVER loosened (S3-R2).`);
  line(`  ⛔ FOUNDER RULING REQUIRED.`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  invariant: `|raw daily close − 5m auction print| ≤ ${TOL}% (A1 / parent §4.3; tolerance NEVER loosened)`,
  scanned: uni.symbols.length,
  quarantined: rows.map((r) => r.symbol),
  diagnosis: 'EODHD back-adjusts the daily `close` field for SPINOFFS while delivering 5-minute bars as printed. The A1 premise that daily close is the raw point-in-time print is false for spinoff names, for all sessions before the spinoff. Levels (daily, adjusted) and events (5m, not spinoff-adjusted) would then live on different price bases.',
  action: 'QUARANTINE — parent §4.3 "quarantine, don\'t degrade". Founder ruling required.',
  symbols: rows,
}, null, 2));
line(`\n  artifact → ${path.relative(STUDY_ROOT, OUT)}`);
