// api/scripts/capture-econ-events-eodhd.js
// Recap Restoration mini-arc — R-B1 founder deliverable: capture ONE raw
// EODHD /economic-events response so it can become R2's provenance fixture
// (spec V1.1 §5 R2: "fixture built from the captured real EODHD response,
// provenance comment mandatory").
//
// READ-ONLY: performs a single GET against EODHD and prints. Writes nothing
// to Firestore, nothing to the repo, nothing anywhere. Needs only:
//   EODHD_API_KEY   (same key the server uses; .env.example:11)
//
// Run from the REPO ROOT (where .env.local lives):
//   node api/scripts/capture-econ-events-eodhd.js
//   # explicit-flag equivalent (matches the other api/scripts):
//   node --env-file=.env.local api/scripts/capture-econ-events-eodhd.js
//   # optional window override (defaults to the last 7 calendar days):
//   node api/scripts/capture-econ-events-eodhd.js --from 2026-07-23 --to 2026-07-30
//
// What to do with the output (R-B1 / R-B1a):
//   1. Eyeball the rows with CC — this run doubles as the freshness test on
//      current EODHD econ quality (R-B1a) and validates the category
//      matcher table in fetchEconomicEventsEODHD.js.
//   2. Paste the raw JSON block back to the build session; it becomes the
//      provenance fixture in econPrintVerifier.test.js, replacing the
//      SYNTHETIC placeholder (which is marked as such).
//
// CONTINGENCY (R-B1, verbatim): if the endpoint is unavailable on the plan
// (403/402/404 below) → HARD STOP, re-scope with founder. No improvised
// fallback.

import { existsSync } from 'node:fs';

// Env self-load, same pattern as wire-exemplar-shortlist.js: no-op when the
// var is already present (running with --env-file, or on Vercel).
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
    '[CaptureEconEvents] EODHD_API_KEY missing. Add it to .env.local at the ' +
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
const weekAgo = new Date(today.getTime() - 7 * 86_400_000);
const from = argValue('--from') || isoDate(weekAgo);
const to = argValue('--to') || isoDate(today);

for (const [flag, val] of [['--from', from], ['--to', to]]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    console.error(`[CaptureEconEvents] ${flag} must be YYYY-MM-DD, got: ${val}`);
    process.exit(1);
  }
}

const url =
  `https://eodhd.com/api/economic-events?api_token=${process.env.EODHD_API_KEY}` +
  `&fmt=json&country=US&from=${from}&to=${to}&limit=1000`;

console.error(`[CaptureEconEvents] GET /economic-events country=US from=${from} to=${to}`);

const response = await fetch(url);

if (response.status === 402 || response.status === 403 || response.status === 404) {
  console.error(
    `[CaptureEconEvents] HTTP ${response.status} — the /economic-events endpoint ` +
    'appears UNAVAILABLE on this EODHD plan. Per ruling R-B1 this is a HARD ' +
    'STOP: re-scope with the founder. Do not improvise a fallback source.',
  );
  process.exit(2);
}
if (!response.ok) {
  console.error(
    `[CaptureEconEvents] HTTP ${response.status} — transient or unexpected error. ` +
    'Retry once; if it persists, treat as the R-B1 contingency and re-scope.',
  );
  process.exit(3);
}

const raw = await response.text();
let rows;
try {
  rows = JSON.parse(raw);
} catch {
  console.error('[CaptureEconEvents] response is not JSON; first 500 chars:');
  console.error(raw.slice(0, 500));
  process.exit(4);
}

// Summary to STDERR (human eyeball), raw JSON to STDOUT (the fixture source)
// so `> capture.json` captures exactly the provenance payload.
const count = Array.isArray(rows) ? rows.length : 0;
console.error(`[CaptureEconEvents] rows=${count}`);
if (Array.isArray(rows) && count > 0) {
  const types = [...new Set(rows.map((r) => r?.type).filter(Boolean))].sort();
  console.error(`[CaptureEconEvents] distinct type strings (${types.length}):`);
  for (const t of types) console.error(`  - ${t}`);
  const withActual = rows.filter((r) => r?.actual !== null && r?.actual !== undefined).length;
  const withEstimate = rows.filter((r) => r?.estimate !== null && r?.estimate !== undefined).length;
  console.error(
    `[CaptureEconEvents] operand presence: actual=${withActual}/${count} estimate=${withEstimate}/${count}`,
  );
  const sample = rows[0];
  console.error('[CaptureEconEvents] first-row field types: ' +
    Object.entries(sample).map(([k, v]) => `${k}:${v === null ? 'null' : typeof v}`).join(' '));
}

console.log(JSON.stringify({
  capturedAt: new Date().toISOString(),
  endpoint: 'https://eodhd.com/api/economic-events',
  params: { country: 'US', from, to, limit: 1000 },
  rows,
}, null, 2));
