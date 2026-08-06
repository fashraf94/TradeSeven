// api/scripts/capture-exa-search.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — §3.2 founder deliverable:
// capture ONE raw Exa /search response so it can become (a) the R2-style
// provenance fixture for the dual-retrieval tests and (b) the C9 pricing /
// latency / surface eyeball at the STOP.
//
// READ-ONLY: performs a single POST against Exa's /search endpoint and prints.
// Writes nothing to Firestore, nothing to the repo, nothing anywhere. Needs
// only:
//   EXA_API_KEY   (founder adds it to Vercel env + .env.local — never in chat)
//
// Run from the REPO ROOT (where .env.local lives):
//   node api/scripts/capture-exa-search.js
//   # explicit-flag equivalent (matches the other api/scripts):
//   node --env-file=.env.local api/scripts/capture-exa-search.js
//   # the spec's target run — the Jul 31 GOOGL drop (GOOGL -$17.98):
//   node api/scripts/capture-exa-search.js --ticker GOOGL --name "Alphabet" \
//     --direction down --pct 4.5 --from 2026-07-30 --to 2026-08-01
//   # full override of the query text:
//   node api/scripts/capture-exa-search.js --query "Why did Alphabet stock fall on July 31 2026?"
//
// The default query mirrors the SHAPE of the production Sonar catalyst prompt
// (sonarCatalystFetch.js:30) so the captured EXA response is directly
// comparable to the Sonar channel it will run alongside under F2.
//
// What to do with the output (§3.2 / C9):
//   1. Eyeball the rows + the printed `costDollars` block with CC — this run
//      doubles as the C9 pricing/latency/surface review. Confirm the response
//      carries fresh, on-topic catalyst URLs + highlights for the GOOGL drop.
//   2. Paste the raw JSON block (STDOUT) back to the build session; it becomes
//      the R2 provenance fixture (real EXA response, provenance comment
//      mandatory), replacing any SYNTHETIC placeholder.
//
// CONTINGENCY (C9, verbatim intent): if the surface, auth, or cost disappoints
// at the STOP — auth/plan errors below (401/402/403/429/404), or the printed
// cost is unacceptable — HARD STOP and re-scope with the founder. F2 drops to
// the register; F1+F3 ship alone (zero EXA dependency). No improvised fallback.

import { existsSync } from 'node:fs';

// Env self-load, same pattern as capture-econ-events-eodhd.js: no-op when the
// var is already present (running with --env-file, or on Vercel).
if (!process.env.EXA_API_KEY) {
  for (const envFile of ['.env.local', '.env']) {
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
      break;
    }
  }
}

if (!process.env.EXA_API_KEY) {
  console.error(
    '[CaptureExaSearch] EXA_API_KEY missing. Add it to .env.local at the repo ' +
    'root (the founder deliverable, §3.1), then re-run from the repo root.',
  );
  process.exit(1);
}

function argValue(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// ── Query construction ──────────────────────────────────────────────────────
// Defaults target the spec's Jul 31 GOOGL drop; every part is overridable.
const ticker = argValue('--ticker', 'GOOGL');
const companyName = argValue('--name', 'Alphabet');
const direction = argValue('--direction', 'down');
const pct = argValue('--pct', '4.5');
const numResults = Number(argValue('--num', '10'));

// Default window: Jul 30 → Aug 1 2026 (brackets the Jul 31 drop day). The
// EODHD/Sonar channels use a 24h recency filter; EXA takes explicit dates.
const from = argValue('--from', '2026-07-30');
const to = argValue('--to', '2026-08-01');

const nameStr = companyName ? `${ticker} (${companyName})` : ticker;
const defaultQuery =
  `Why is ${nameStr} stock ${direction} ${Math.abs(Number(pct)).toFixed(1)}% today? ` +
  `What are the specific catalysts, news events, court decisions, analyst actions, ` +
  `regulatory developments, or company announcements driving this move?`;
const query = argValue('--query', defaultQuery);

for (const [flag, val] of [['--from', from], ['--to', to]]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    console.error(`[CaptureExaSearch] ${flag} must be YYYY-MM-DD, got: ${val}`);
    process.exit(1);
  }
}
if (!Number.isFinite(numResults) || numResults < 1 || numResults > 100) {
  console.error(`[CaptureExaSearch] --num must be 1..100, got: ${argValue('--num', '10')}`);
  process.exit(1);
}

// ── Request body (Exa /search, verified against exa-labs/openapi-spec) ───────
// `contents.highlights` returns the token-efficient excerpts EXA recommends for
// agent workflows; `contents.text` (capped) is included so the founder can
// eyeball full-article grounding. `category: 'news'` + the published-date
// window keep results on the drop day. `type: 'auto'` is Exa's default router.
const requestBody = {
  query,
  type: 'auto',
  category: 'news',
  numResults,
  startPublishedDate: `${from}T00:00:00.000Z`,
  endPublishedDate: `${to}T23:59:59.999Z`,
  contents: {
    text: { maxCharacters: 1200 },
    highlights: { numSentences: 3, highlightsPerUrl: 3 },
  },
};

const ENDPOINT = 'https://api.exa.ai/search';

console.error(
  `[CaptureExaSearch] POST /search  ticker=${ticker} window=${from}..${to} ` +
  `numResults=${numResults}`,
);
console.error(`[CaptureExaSearch] query: "${query}"`);

const t0 = Date.now();
let response;
try {
  response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Exa auth is the x-api-key header — NOT a Bearer token.
      'x-api-key': process.env.EXA_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });
} catch (err) {
  console.error(`[CaptureExaSearch] network error reaching Exa: ${err.message}`);
  console.error('[CaptureExaSearch] Retry once; if it persists treat as the C9 contingency and re-scope.');
  process.exit(3);
}
const latencyMs = Date.now() - t0;

if ([401, 402, 403, 429, 404].includes(response.status)) {
  console.error(
    `[CaptureExaSearch] HTTP ${response.status} — auth, plan, quota, or endpoint ` +
    'problem on this Exa account. Per C9 this is a HARD STOP: re-scope with the ' +
    'founder (F2 drops to the register; F1+F3 ship alone). Do not improvise a fallback.',
  );
  process.exit(2);
}
if (!response.ok) {
  console.error(
    `[CaptureExaSearch] HTTP ${response.status} — transient or unexpected error. ` +
    'Retry once; if it persists, treat as the C9 contingency and re-scope.',
  );
  process.exit(3);
}

const raw = await response.text();
let data;
try {
  data = JSON.parse(raw);
} catch {
  console.error('[CaptureExaSearch] response is not JSON; first 500 chars:');
  console.error(raw.slice(0, 500));
  process.exit(4);
}

// ── Summary to STDERR (human eyeball), raw JSON to STDOUT (the fixture source)
// so `> capture.json` captures exactly the provenance payload.
const results = Array.isArray(data?.results) ? data.results : [];
console.error(`[CaptureExaSearch] latency=${latencyMs}ms  results=${results.length}  searchType=${data?.searchType ?? 'n/a'}`);

// The C9 pricing eyeball: /search returns a top-level costDollars object.
if (data?.costDollars !== undefined) {
  console.error('[CaptureExaSearch] costDollars: ' + JSON.stringify(data.costDollars));
} else {
  console.error('[CaptureExaSearch] costDollars: ABSENT — verify pricing from the dashboard before the C9 decision.');
}

for (const [i, r] of results.entries()) {
  const hl = Array.isArray(r?.highlights) ? r.highlights.length : 0;
  const textLen = typeof r?.text === 'string' ? r.text.length : 0;
  console.error(
    `  ${i + 1}. [${r?.publishedDate ?? 'no-date'}] score=${r?.score ?? 'n/a'} ` +
    `highlights=${hl} textChars=${textLen}\n     ${r?.title ?? '(no title)'}\n     ${r?.url ?? '(no url)'}`,
  );
}
if (results.length === 0) {
  console.error('[CaptureExaSearch] ZERO results — widen the window or drop category=news, then re-run. ' +
    'A zero-result GOOGL drop-day capture is itself a C9 surface finding.');
}

console.log(JSON.stringify({
  capturedAt: new Date().toISOString(),
  endpoint: ENDPOINT,
  latencyMs,
  request: requestBody,
  costDollars: data?.costDollars ?? null,
  searchType: data?.searchType ?? null,
  requestId: data?.requestId ?? null,
  response: data,
}, null, 2));
