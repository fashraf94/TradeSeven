// api/scripts/capture-earnings-calendar-eodhd.js
// Doug tracked-intersection defect — the diagnostic capture (same provenance
// pattern as capture-econ-events-eodhd.js). Doug's morning fire logged
//   outcome=empty_window fetched=3531 tracked=0
// i.e. 3,531 rows came back from EODHD /calendar/earnings and ZERO survived
// the tracked-universe intersection (generate-recap.js:171-189). This script
// captures a real response and prints the field inventory + a two-way
// intersection test so ONE run settles which clause is the zero-gate:
//   (1) symbol normalization  — is `code` present, does it end in `.US`,
//       do the tracked mega-caps appear at all?
//   (2) field-name mismatch   — is the reported EPS under `actual` (the
//       documented EODHD calendar field) or `actual_eps` (what the code
//       reads)? Same for estimate: `estimate` vs `eps_estimate`.
//
// READ-ONLY: a single GET against EODHD, then analysis + print. Writes
// nothing to Firestore, nothing to the repo. Needs only:
//   EODHD_API_KEY   (same key the server uses; .env.example:11)
//
// Run from the REPO ROOT (where .env.local lives). Capture the SAME window
// the failing fire used — a morning fire's window is [prior ET session,
// today], so pass both days:
//   node api/scripts/capture-earnings-calendar-eodhd.js --from 2026-07-30 --to 2026-07-31
//   # explicit-flag equivalent (matches the other api/scripts):
//   node --env-file=.env.local api/scripts/capture-earnings-calendar-eodhd.js --from 2026-07-30 --to 2026-07-31
//   # defaults to the last completed trading day → today if no flags given.
//
// What to do with the output:
//   1. Read the DIAGNOSIS block on STDERR with CC — it names the zero-gate
//      clause directly (symbol vs field-name) from the captured rows.
//   2. Redirect STDOUT to a file and hand it back; it becomes the A6 fixture
//      source (provenance comment naming window + capture instant), exactly
//      like the econ capture:
//        node api/scripts/capture-earnings-calendar-eodhd.js --from ... --to ... > earnings-capture.json
//
// CONTINGENCY (mirrors R-B1): if the endpoint is unavailable on the plan
// (402/403/404 below) → HARD STOP, re-scope with founder. No improvised
// fallback.

import { existsSync } from 'node:fs';
import { TICKERS } from '../_utils/stockIntelligenceData.js';

// Env self-load, same pattern as the econ capture: no-op when already set.
if (!process.env.EODHD_API_KEY) {
  for (const envFile of ['.env.local', '.env']) {
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
      break;
    }
  }
}
if (!process.env.EODHD_API_KEY) {
  console.error(
    '[CaptureEarnings] EODHD_API_KEY missing. Add it to .env.local at the ' +
    'repo root (see .env.example:11), then re-run from the repo root.',
  );
  process.exit(1);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const today = new Date();
const yesterday = new Date(today.getTime() - 86_400_000);
const from = argValue('--from') || isoDate(yesterday);
const to = argValue('--to') || isoDate(today);
for (const [flag, val] of [['--from', from], ['--to', to]]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    console.error(`[CaptureEarnings] ${flag} must be YYYY-MM-DD, got: ${val}`);
    process.exit(1);
  }
}

// EXACTLY the URL generate-recap.js:78 builds (no country/symbols filter —
// so the diagnostic sees what the failing fire saw).
const url =
  `https://eodhd.com/api/calendar/earnings?api_token=${process.env.EODHD_API_KEY}` +
  `&fmt=json&from=${from}&to=${to}`;

console.error(`[CaptureEarnings] GET /calendar/earnings from=${from} to=${to}`);

const response = await fetch(url);
if (response.status === 402 || response.status === 403 || response.status === 404) {
  console.error(
    `[CaptureEarnings] HTTP ${response.status} — /calendar/earnings appears ` +
    'UNAVAILABLE on this EODHD plan. HARD STOP: re-scope with the founder. ' +
    'Do not improvise a fallback source.',
  );
  process.exit(2);
}
if (!response.ok) {
  console.error(`[CaptureEarnings] HTTP ${response.status} — retry once; if it persists, treat as the contingency.`);
  process.exit(3);
}

const raw = await response.text();
let data;
try {
  data = JSON.parse(raw);
} catch {
  console.error('[CaptureEarnings] response is not JSON; first 500 chars:');
  console.error(raw.slice(0, 500));
  process.exit(4);
}
const rows = Array.isArray(data?.earnings) ? data.earnings : (Array.isArray(data) ? data : null);
if (!rows) {
  console.error('[CaptureEarnings] no `earnings` array in the response. Top-level keys:', Object.keys(data || {}));
  process.exit(5);
}

// ── DIAGNOSIS ─────────────────────────────────────────────────────────────
const tickerSet = new Set(TICKERS.map((t) => t.toUpperCase()));
const stripCode = (c) => String(c || '').replace('.US', '').toUpperCase();
const nonNull = (v) => v !== null && v !== undefined;
const count = (pred) => rows.filter(pred).length;

console.error('\n══════════ DIAGNOSIS ══════════');
console.error(`rows: ${rows.length}`);

// Union of top-level keys across all rows — reveals actual vs actual_eps.
const keyUnion = new Set();
for (const r of rows) for (const k of Object.keys(r || {})) keyUnion.add(k);
console.error(`distinct top-level keys (${keyUnion.size}): ${[...keyUnion].sort().join(', ')}`);

// (1) SYMBOL NORMALIZATION.
const withCode = count((r) => typeof r.code === 'string' && r.code.length > 0);
const dotUsCodes = count((r) => typeof r.code === 'string' && r.code.endsWith('.US'));
const trackedRows = rows.filter((r) => tickerSet.has(stripCode(r.code)));
console.error('\n(1) SYMBOL SIDE:');
console.error(`  rows with a non-empty \`code\`: ${withCode}/${rows.length}`);
console.error(`  \`code\` ending in ".US": ${dotUsCodes}/${rows.length}`);
console.error(`  sample codes: ${[...new Set(rows.slice(0, 12).map((r) => r.code))].join(', ')}`);
console.error(`  rows whose stripped code ∈ tracked universe (${TICKERS.length} symbols): ${trackedRows.length}`);
if (trackedRows.length) {
  console.error(`  tracked symbols present: ${[...new Set(trackedRows.map((r) => stripCode(r.code)))].join(', ')}`);
}

// (2) FIELD-NAME MISMATCH — population counts for both candidate names.
console.error('\n(2) FIELD-NAME SIDE (population across ALL rows):');
console.error(`  actual      (documented calendar field): ${count((r) => nonNull(r.actual))} non-null`);
console.error(`  actual_eps  (what generate-recap reads) : ${count((r) => nonNull(r.actual_eps))} non-null`);
console.error(`  estimate    (documented calendar field): ${count((r) => nonNull(r.estimate))} non-null`);
console.error(`  eps_estimate(what generate-recap reads) : ${count((r) => nonNull(r.eps_estimate))} non-null`);

// Two-way intersection test — the smoking gun.
const reportDateOk = (r) => typeof r.report_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.report_date);
const surviveCurrent = count((r) => tickerSet.has(stripCode(r.code)) && reportDateOk(r) && nonNull(r.actual_eps));
const surviveProposed = count((r) => tickerSet.has(stripCode(r.code)) && reportDateOk(r) && nonNull(r.actual));
console.error('\nTWO-WAY TRACKED-INTERSECTION TEST:');
console.error(`  survive CURRENT filter  (code∈set && report_date && actual_eps present): ${surviveCurrent}`);
console.error(`  survive PROPOSED filter (code∈set && report_date && actual     present): ${surviveProposed}`);

console.error('\nRAW TRACKED ROWS (the exact fields a tracked reporter carries):');
for (const r of trackedRows.slice(0, 8)) console.error('  ' + JSON.stringify(r));
if (!trackedRows.length) {
  console.error('  (none — if the feed returned 3531 rows with ZERO tracked symbols, the zero-gate is on the SYMBOL side; investigate `code` shape above.)');
}

console.error('\nVERDICT HINT:');
if (surviveCurrent === 0 && surviveProposed > 0) {
  console.error('  → FIELD-NAME mismatch confirmed: rows survive under `actual` but not `actual_eps`.');
} else if (trackedRows.length === 0) {
  console.error('  → SYMBOL side is the zero-gate: no tracked symbol appears under `code` at all.');
} else if (surviveCurrent > 0) {
  console.error('  → Current filter DOES survive here — the production zero may be window/timing specific; compare this window to the failing fire.');
} else {
  console.error('  → Neither field populated for tracked rows in this window — capture a window with known post-close reporters.');
}
console.error('═══════════════════════════════\n');

// ── STDOUT: the fixture payload ────────────────────────────────────────────
console.log(JSON.stringify({
  capturedAt: new Date().toISOString(),
  endpoint: 'https://eodhd.com/api/calendar/earnings',
  params: { from, to },
  rowCount: rows.length,
  rows,
}, null, 2));
