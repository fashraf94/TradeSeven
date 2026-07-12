// discovery/rvol-null-crosstab.mjs
//
// LevelStory S5.5 — Job A instrumentation (READ-ONLY, throwaway; NOT study source).
// Produces the A2.1 cross-tab for the rvol_approach null pattern.
//
//   node discovery/rvol-null-crosstab.mjs                 # frozen universe
//   node discovery/rvol-null-crosstab.mjs AAPL NVDA       # explicit list
//
// It reads ONLY the gitignored study artifacts (no product/study imports, no refetch):
//   research/level-study/data/features/{sym}.json   (feature rows)
//   research/level-study/data/events/{sym}.json      (event records: halfDay, eodSource)
//
// Cause discriminator (needs no 5m reload — derived from the feature row alone):
//   dist_from_session_extreme is computed UNCONDITIONALLY once intradayFeatures() passes its
//   line-91 guard (features-intraday.js:169-171). Therefore, for a row with rvol_approach == null:
//     • dist_from_session_extreme == null  => the line-91 branch fired: NO pre-touch bar
//       (touch/break on the 9:30 opening bar) OR atrDaily null OR empty 5m session.
//       (features-intraday.js:91)   ← the structural, dominant cluster
//     • dist_from_session_extreme != null  => passed line 91 (>=1 pre-bar, atr present) but
//       rvolApproach() returned null: baselineSessions.length < 20 (spin-up) or avg==0.
//       (features-intraday.js:52 / :56)   ← the ~2.7% spin-up cluster
//
// Constants below are transcribed from research/level-study/config.js (cited inline); the script
// imports nothing so it stays dependency-free and cannot perturb study state.

import fs from 'node:fs';
import path from 'node:path';

const LS = path.resolve('research/level-study');
const FEAT_DIR = path.join(LS, 'data', 'features');
const EVENTS_DIR = path.join(LS, 'data', 'events');

const HOLDOUT_START = '2025-12-10'; // config.js:53 range.holdoutStart
const STUDY_START = '2023-07-10';   // config.js:48 range.studyStart
const TOD = { open: [570, 630], midday: [630, 870], power: [870, 960] }; // config.js:445
const SPINUP_SESSIONS = 20;         // config.js:425 rvolOverlay.baselineDays

function loadJson(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; }

function universeSymbols() {
  const argv = process.argv.slice(2).filter(Boolean);
  if (argv.length) return argv;
  const uni = loadJson(path.join(LS, 'universe_frozen.json'));
  return uni ? uni.symbols.map((s) => s.symbol) : [];
}

// pct helper
const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null);
function tallyRow(map, key) { map[key] = map[key] || { n: 0, rvolNull: 0, noPreBar: 0, spinup: 0 }; return map[key]; }
function addTo(bucket, isNull, cause) {
  bucket.n += 1;
  if (isNull) { bucket.rvolNull += 1; if (cause === 'no_pre_bar') bucket.noPreBar += 1; else bucket.spinup += 1; }
}
function printTable(title, map) {
  console.log(`\n── ${title} ──`);
  console.log(`  ${'key'.padEnd(22)} ${'n'.padStart(6)} ${'rvolNull%'.padStart(10)} ${'noPreBar'.padStart(9)} ${'spinup'.padStart(7)}`);
  for (const [k, b] of Object.entries(map).sort((a, c) => c[1].n - a[1].n)) {
    console.log(`  ${k.padEnd(22)} ${String(b.n).padStart(6)} ${String(pct(b.rvolNull, b.n)).padStart(10)} ${String(b.noPreBar).padStart(9)} ${String(b.spinup).padStart(7)}`);
  }
}

function main() {
  const symbols = universeSymbols();
  if (!symbols.length) { console.log('no universe (pass symbols or provide universe_frozen.json)'); process.exit(1); }
  if (!fs.existsSync(FEAT_DIR)) { console.log(`🔴 ${FEAT_DIR} absent — run \`npm run features\` first (founder-local; data is gitignored).`); process.exit(1); }

  const byTod = {}, byDisposition = {}, byHalfDay = {}, byEodSource = {}, bySessionPos = {}, byFirst20 = {};
  // P3 exposure view: disposition==='touch', F2+, in-sample only, split by tod_bucket.
  const p3Tod = {};
  let total = 0, totalNull = 0;

  for (const sym of symbols) {
    const feat = loadJson(path.join(FEAT_DIR, `${sym}.json`));
    const ev = loadJson(path.join(EVENTS_DIR, `${sym}.json`));
    if (!feat) { console.log(`⚠ ${sym}: no features file — skipped`); continue; }
    const evById = new Map((ev ? ev.events : []).map((e) => [e.eventId, e]));
    // session-position needs touchEtMin; approximate minutes-since-open from tod + no_pre_bar flag.
    // first-20-session ranking is per-symbol on the sorted distinct event dates present in features.
    const sortedDates = [...new Set(feat.rows.map((r) => r.eventDate))].sort();
    const first20 = new Set(sortedDates.slice(0, SPINUP_SESSIONS));

    for (const row of feat.rows) {
      const pre = row.features.pre_touch;
      const isNull = pre.rvol_approach == null;
      const noPreBar = pre.dist_from_session_extreme == null; // line-91 signature
      const cause = noPreBar ? 'no_pre_bar' : 'spinup';
      const e = evById.get(row.eventId) || {};
      total += 1; if (isNull) totalNull += 1;

      addTo(tallyRow(byTod, pre.tod_bucket == null ? 'null_tod' : pre.tod_bucket), isNull, cause);
      addTo(tallyRow(byDisposition, row.disposition), isNull, cause);
      addTo(tallyRow(byHalfDay, e.halfDay ? 'halfDay' : 'fullDay'), isNull, cause);
      addTo(tallyRow(byEodSource, e.eodSource || 'unknown'), isNull, cause);
      addTo(tallyRow(byFirst20, first20.has(row.eventDate) ? 'first20_sessions' : 'rest_of_window'), isNull, cause);
      // fine session position: only the two states the data can distinguish without a 5m reload
      addTo(tallyRow(bySessionPos, noPreBar ? 'first_bar(0_pre)' : 'has_pre_bar(>=1)'), isNull, cause);

      // P3 exposure: touch-only, F2+, in-sample
      if (row.disposition === 'touch' && (row.familyTier === 'F2' || row.familyTier === 'F3') && row.eventDate < HOLDOUT_START) {
        addTo(tallyRow(p3Tod, pre.tod_bucket == null ? 'null_tod' : pre.tod_bucket), isNull, cause);
      }
    }
  }

  console.log(`\n════════ RVOL_APPROACH NULL CROSS-TAB (S5.5 Job A / A2.1) ════════`);
  console.log(`study window ${STUDY_START}..(holdout ${HOLDOUT_START})  |  symbols ${symbols.join(',')}`);
  console.log(`ALL events (every disposition): n=${total}  rvol_approach null=${pct(totalNull, total)}%`);
  printTable('by tod_bucket (ALL dispositions)', byTod);
  printTable('by disposition — GAP_BREAK are first-bar by construction (events.js:449) & EXCLUDED from P3', byDisposition);
  printTable('by halfDay', byHalfDay);
  printTable('by eodSource (fallback_1555 sessions)', byEodSource);
  printTable('by first-20 sessions of window (5m spin-up)', byFirst20);
  printTable('by session position (pre-bar presence)', bySessionPos);

  console.log(`\n════════ P3 EXPOSURE — touch-only, F2+, in-sample (what P3 actually sees) ════════`);
  printTable('P3 cells by tod_bucket', p3Tod);
  const openCell = p3Tod['open'];
  if (openCell) {
    const survive = openCell.n - openCell.rvolNull;
    console.log(`\n  P3 OPEN-bucket survival: ${survive}/${openCell.n} open-bucket F2+ touch events carry a non-null rvol_bucket`);
    console.log(`  (= ${pct(survive, openCell.n)}% survive into P3's LOW/MID/HIGH cells; the rest fall into P3.null_rvol and are dropped from the RVOL comparison).`);
  }
  console.log(`\nInterpretation: 'noPreBar' counts are the features-intraday.js:91 cluster (first-bar/9:30 touch or GAP_BREAK);`);
  console.log(`'spinup' counts are the features-intraday.js:52 baseline<20 cluster. If P3 open-bucket survival is low, P3 is`);
  console.log(`conditioned on "the touch did not open on the session's first 5m bar." — S5.5 A2.4.`);
}

main();
