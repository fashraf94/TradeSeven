// scripts/test-signal-drop-pipeline.js
//
// Phase 1 quality-testing harness for the Signal Drop pipeline.
//
// Walks scripts/test-inputs/ (recursively), routes each file through
// /api/forge/parse-signal, then (on happy paths) /api/forge/expand-signal,
// captures per-input results to disk, and emits a summary.json with the
// 14-field schema agreed during the plan-approval phase.
//
// HOW TO RUN (from project root):
//
//   node scripts/test-signal-drop-pipeline.js
//   node scripts/test-signal-drop-pipeline.js --cleanup      # purge test user's signalDrops first
//   node scripts/test-signal-drop-pipeline.js --delay-ms 3000  # custom inter-input delay (default 1500)
//
// Cross-platform Node.js — works on Windows PowerShell, macOS, Linux.
// Reads env vars from .env.local at the project root via a simple
// line-parser (no dotenv dependency required).
//
// Required env vars in .env.local:
//   FIREBASE_ADMIN_CREDENTIALS — JSON service account creds (single-line stringified)
//   FIREBASE_API_KEY            — Firebase web API key for the tradeseven project
//   TEST_USER_UID               — UID of the dedicated Firebase Auth test user
//   TEST_USER_AGENT_ID          — agentId of an agent owned by TEST_USER_UID
//   SIGNAL_DROP_API_URL         — Vercel preview URL of the current branch
// Optional:
//   TEST_INPUT_DIR              — defaults to scripts/test-inputs/
//   TEST_RESULTS_DIR            — defaults to scripts/test-results/
//
// INPUT FORMAT (in scripts/test-inputs/, recursively):
//   *.txt starting with http:// or https://   → URL input
//   *.txt (other)                              → text input
//   *.png / *.jpg / *.jpeg / *.webp            → image input (base64 to imageBase64)
//   *.json (companion — same basename)         → metadata { note, category, expectedBehavior }
//   *.json (no companion primary)              → legacy self-contained body fixture
//                                                 (e.g. _baseline/sample-request-text.json)
//
// OUTPUT (in scripts/test-results/{run-timestamp}/):
//   {input-flatname}/parsed.json     — full /api/forge/parse-signal response
//   {input-flatname}/expansion.json  — full /api/forge/expand-signal response (if attempted)
//   {input-flatname}/meta.json       — per-input row + full responses + latency
//   summary.json                     — array of per-input rows (the 14-field schema)
//
// `{input-flatname}` is the file path under test-inputs/ with separators
// flattened to `__` so each input gets its own directory at run-root.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

// firebase-admin imports are dynamic (inside mintIdToken / main) so that
// the unit-test script can import the pure helpers without requiring
// firebase-admin to be installed in the test environment.

// ──────────────────────────────────────────────────────────────────────
// Project root from script location (works regardless of cwd)
// ──────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

// ──────────────────────────────────────────────────────────────────────
// Constants — extension groups + rough model pricing for cost estimation
// ──────────────────────────────────────────────────────────────────────
const TEXT_EXTENSIONS = new Set(['.txt']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const SKIP_EXTENSIONS = new Set(['.md', '.gitkeep', '.gitignore', '.ds_store']);
const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// Rough per-call cost estimates. Real per-token costs live in shadow-log
// records from the endpoints; this is a coarse triage figure for the
// stdout summary so Flash can spot expensive runs at a glance.
const COST_ESTIMATE_PER_PARSE_USD = 0.003;
const COST_ESTIMATE_PER_EXPAND_USD = 0.001;

// ──────────────────────────────────────────────────────────────────────
// .env.local parser — KEY=VALUE, double/single-quoted values, comments,
// blank lines. JSON-string values left as strings for the caller to parse.
// ──────────────────────────────────────────────────────────────────────
function parseEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function die(message) {
  console.error(`ENV ERROR: ${message}`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────
// CLI flags
// ──────────────────────────────────────────────────────────────────────
const DEFAULT_INTER_INPUT_DELAY_MS = 1500;

function parseCliFlags(argv) {
  const flags = { cleanup: false, delayMs: DEFAULT_INTER_INPUT_DELAY_MS };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--cleanup') {
      flags.cleanup = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/test-signal-drop-pipeline.js [--cleanup] [--delay-ms N]');
      process.exit(0);
    } else if (arg.startsWith('--delay-ms=')) {
      const n = Number.parseInt(arg.slice('--delay-ms='.length), 10);
      if (Number.isFinite(n) && n >= 0) flags.delayMs = n;
      else die(`--delay-ms value must be a non-negative integer; got "${arg.slice('--delay-ms='.length)}"`);
    } else if (arg === '--delay-ms') {
      const next = args[i + 1];
      const n = Number.parseInt(next, 10);
      if (Number.isFinite(n) && n >= 0) {
        flags.delayMs = n;
        i += 1;
      } else {
        die(`--delay-ms value must be a non-negative integer; got "${next}"`);
      }
    }
  }
  return flags;
}

// ──────────────────────────────────────────────────────────────────────
// Sleep helper — used by the 429-retry path inside postJson and the
// inter-input delay loop inside main. Tests can pass a no-op sleep
// to avoid waiting through real timers.
// ──────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────────────────────────────
// Input discovery — recursive walk of test-inputs/, classify each file
// ──────────────────────────────────────────────────────────────────────

// Recursively walk a directory, returning absolute file paths. Hidden
// files (leading `.`) are skipped. Symlinks are not followed.
function walkInputDir(rootDir) {
  const out = [];
  if (!existsSync(rootDir)) return out;

  function recurse(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        recurse(fullPath);
      } else if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }
  recurse(rootDir);
  return out.sort(); // deterministic ordering
}

// Classify a file by extension. Returns the role the file plays in the
// harness pipeline. Pure function — easy to unit-test.
function classifyExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return { kind: 'json' };
  if (TEXT_EXTENSIONS.has(ext)) return { kind: 'txt' };
  if (IMAGE_EXTENSIONS.has(ext)) return { kind: 'image', mime: IMAGE_MIME[ext] };
  if (SKIP_EXTENSIONS.has(ext) || ext === '') {
    return { kind: 'skip', reason: `non-input extension ${ext || '(none)'}` };
  }
  return { kind: 'skip', reason: `unrecognized extension ${ext}` };
}

// Group files by basename (without extension) within the same directory.
// For each group:
//   - If a primary input file exists (.txt / .png / .jpg / .jpeg / .webp),
//     that's the input. Companion .json is metadata.
//   - If only .json exists, it's a legacy self-contained body fixture.
// Pure function — easy to unit-test.
function pairInputsWithMetadata(files) {
  const groups = new Map();
  for (const file of files) {
    const ext = path.extname(file);
    const key = file.slice(0, -ext.length); // dir + basename, no ext
    const cls = classifyExtension(file);
    if (cls.kind === 'skip') continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ file, ext: ext.toLowerCase(), cls });
  }

  const inputs = [];
  for (const [key, group] of groups) {
    const primary = group.find(g => g.cls.kind === 'txt' || g.cls.kind === 'image');
    const json = group.find(g => g.cls.kind === 'json');
    if (primary) {
      inputs.push({
        kind: 'primary',
        primaryFile: primary.file,
        primaryClass: primary.cls,
        metadataFile: json ? json.file : null,
        groupKey: key,
      });
    } else if (json) {
      inputs.push({
        kind: 'legacy-json',
        primaryFile: json.file,
        primaryClass: json.cls,
        metadataFile: null,
        groupKey: key,
      });
    }
  }
  return inputs.sort((a, b) => a.primaryFile.localeCompare(b.primaryFile));
}

// Build the parse-signal request body for one classified input. Returns
// { body, inputType, category, inputName, expectedBehavior }. Throws on
// malformed legacy-json or unreadable file.
function buildRequestBodyFromInput(input, testInputsRoot) {
  const inputName = path.relative(testInputsRoot, input.primaryFile).split(path.sep).join('/');
  const dropId = crypto.randomUUID();

  // Read companion metadata if present
  let metadata = {};
  if (input.metadataFile) {
    try {
      metadata = JSON.parse(readFileSync(input.metadataFile, 'utf8'));
    } catch (err) {
      throw new Error(`failed to parse metadata ${input.metadataFile}: ${err.message}`);
    }
  }

  const note = typeof metadata.note === 'string' ? metadata.note : undefined;
  const explicitCategory = typeof metadata.category === 'string' ? metadata.category : null;
  const expectedBehavior = typeof metadata.expectedBehavior === 'string' ? metadata.expectedBehavior : null;

  // Default category: 'baseline' for files under _baseline/, else 'uncategorized'
  const defaultCategory = inputName.startsWith('_baseline/') ? 'baseline' : 'uncategorized';
  const category = explicitCategory || defaultCategory;

  if (input.kind === 'legacy-json') {
    // Self-contained body fixture from _baseline/ etc. Expect type + payload fields.
    const raw = JSON.parse(readFileSync(input.primaryFile, 'utf8'));
    if (!raw.type) {
      throw new Error(`legacy fixture ${inputName} missing required field "type"`);
    }
    const body = { ...raw, dropId };
    return {
      body,
      inputType: raw.type,
      category,
      inputName,
      expectedBehavior,
    };
  }

  // Primary file is .txt or image
  if (input.primaryClass.kind === 'txt') {
    const contents = readFileSync(input.primaryFile, 'utf8').trim();
    const firstWord = contents.split(/\s/)[0] || '';
    const isUrl = /^https?:\/\//i.test(firstWord);
    if (isUrl) {
      return {
        body: { type: 'url', url: firstWord, note, dropId },
        inputType: 'url',
        category,
        inputName,
        expectedBehavior,
      };
    }
    return {
      body: { type: 'text', text: contents, note, dropId },
      inputType: 'text',
      category,
      inputName,
      expectedBehavior,
    };
  }

  // image
  const buf = readFileSync(input.primaryFile);
  const imageBase64 = buf.toString('base64');
  return {
    body: {
      type: 'image',
      imageBase64,
      imageMime: input.primaryClass.mime,
      note,
      dropId,
    },
    inputType: 'image',
    category,
    inputName,
    expectedBehavior,
  };
}

// ──────────────────────────────────────────────────────────────────────
// --cleanup helper — purge users/{TEST_USER_UID}/signalDrops in batches
// of 500. Pure batching logic factored into chunkArray for unit tests.
// ──────────────────────────────────────────────────────────────────────
function chunkArray(arr, size) {
  if (size <= 0) throw new Error('chunkArray: size must be > 0');
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function cleanupTestUserDrops(db, userId, { dryRun = false } = {}) {
  const ref = db.collection('users').doc(userId).collection('signalDrops');
  const snap = await ref.get();
  const docRefs = snap.docs.map(d => d.ref);
  const ids = snap.docs.map(d => d.id);

  if (dryRun) {
    return { wouldDelete: docRefs.length, ids, batches: chunkArray(ids, 500).length };
  }

  const chunks = chunkArray(docRefs, 500);
  let deleted = 0;
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const docRef of chunk) batch.delete(docRef);
    await batch.commit();
    deleted += chunk.length;
  }
  return { deleted };
}

// ──────────────────────────────────────────────────────────────────────
// Path classifiers — convert HTTP responses into parsePath / expansionPath
// summary enums per the schema agreed in plan approval.
// ──────────────────────────────────────────────────────────────────────
function classifyParsePath(parseResp) {
  if (!parseResp || parseResp.status !== 200 || !parseResp.body?.parse) return 'parse_error';
  const { shouldBailout, shouldHardCheckpoint } = parseResp.body;
  if (shouldBailout) return 'bailout';
  if (shouldHardCheckpoint) return 'low_confidence_checkpoint';
  return 'happy';
}

function classifyExpansionPath(parsePath, expandResp, expandWasCalled) {
  if (parsePath === 'parse_error') return 'not_attempted';
  if (parsePath === 'bailout') return 'skipped_bailout';
  if (parsePath === 'low_confidence_checkpoint') return 'skipped_checkpoint';
  if (!expandWasCalled) return 'not_attempted';
  if (!expandResp) return 'expansion_error';
  if (expandResp.status === 502 && expandResp.body?.reason) return 'validation_failure';
  if (expandResp.status !== 200 || !expandResp.body?.expansion) return 'expansion_error';
  return 'ran';
}

// ──────────────────────────────────────────────────────────────────────
// Stdout summary helpers — confidence histogram + cost estimate
// ──────────────────────────────────────────────────────────────────────
function histogramConfidence(rows) {
  const buckets = new Array(10).fill(0); // 0.0-0.1, 0.1-0.2, ..., 0.9-1.0
  let nullCount = 0;
  for (const r of rows) {
    if (typeof r.parseConfidence !== 'number') {
      nullCount += 1;
      continue;
    }
    const idx = Math.min(9, Math.floor(r.parseConfidence * 10));
    buckets[idx] += 1;
  }
  return { buckets, nullCount };
}

function estimateCostUSD(rows) {
  let parseCalls = 0;
  let expandCalls = 0;
  for (const r of rows) {
    if (r.parsePath !== 'parse_error') parseCalls += 1;
    if (r.expansionPath === 'ran' || r.expansionPath === 'validation_failure' || r.expansionPath === 'expansion_error') {
      expandCalls += 1;
    }
  }
  return parseCalls * COST_ESTIMATE_PER_PARSE_USD + expandCalls * COST_ESTIMATE_PER_EXPAND_USD;
}

function average(nums) {
  const valid = nums.filter(n => typeof n === 'number' && !Number.isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ──────────────────────────────────────────────────────────────────────
// HTTP helpers — postJson with latency measurement and one-shot 429
// retry. When a call returns HTTP 429, we read body.retryAfter (default
// 30 if missing/unparseable), sleep retryAfter+2 seconds, and retry
// the same call once. If the retry also 429s we surface that status to
// the caller (the existing classifyParsePath / classifyExpansionPath
// helpers map status:429 to parse_error / expansion_error correctly).
//
// `label` (optional) is prefixed to the rate-limit log line so the
// orchestrator's "[N/M] inputName" context survives the line break.
// `_sleep` is a hidden testing hook — tests pass a no-op so unit tests
// don't actually wait through the real retryAfter window.
// ──────────────────────────────────────────────────────────────────────
const DEFAULT_RETRY_AFTER_SECONDS = 30;
const RETRY_BUFFER_SECONDS = 2;

function readRetryAfter(body) {
  const raw = body?.retryAfter;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  if (typeof raw === 'string') {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_RETRY_AFTER_SECONDS;
}

async function postJson({ apiUrl, idToken, endpoint, body, label, _sleep = sleep }) {
  const url = `${apiUrl.replace(/\/$/, '')}${endpoint}`;
  const t0 = Date.now();

  async function attempt() {
    let status;
    let bodyJson;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      status = resp.status;
      const text = await resp.text();
      try {
        bodyJson = JSON.parse(text);
      } catch {
        bodyJson = { _rawText: text };
      }
    } catch (err) {
      status = 0;
      bodyJson = { _fetchError: err.message };
    }
    return { status, body: bodyJson };
  }

  let result = await attempt();

  if (result.status === 429) {
    const retryAfter = readRetryAfter(result.body);
    const sleepSeconds = retryAfter + RETRY_BUFFER_SECONDS;
    const prefix = label ? `${label} ` : '';
    console.log(`\n${prefix}rate-limited, sleeping ${sleepSeconds}s before retry`);
    await _sleep(sleepSeconds * 1000);
    result = await attempt();
    if (result.status === 429) {
      console.log(`${prefix}rate limit persisted after retry; skipping`);
    }
  }

  const latencyMs = Date.now() - t0;
  return { ...result, latencyMs };
}

// ──────────────────────────────────────────────────────────────────────
// Auth — mint Firebase custom token, exchange for ID token
// ──────────────────────────────────────────────────────────────────────
async function mintIdToken({ serviceAccount, testUserUid, firebaseApiKey }) {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  const customToken = await getAuth().createCustomToken(testUserUid);
  const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`;
  const exchangeResp = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const exchangeBody = await exchangeResp.json();
  if (!exchangeResp.ok || !exchangeBody.idToken) {
    throw new Error(
      `Identity Toolkit exchange failed: HTTP ${exchangeResp.status} — ${JSON.stringify(exchangeBody)}`,
    );
  }
  return exchangeBody.idToken;
}

// ──────────────────────────────────────────────────────────────────────
// Per-input pipeline runner — POST parse-signal → on happy path POST
// expand-signal → build the row + meta object. Returns
// { row, meta, parseResp, expandResp }.
// ──────────────────────────────────────────────────────────────────────
async function runOneInput(input, ctx, label) {
  const { apiUrl, idToken, agentId, testInputsRoot } = ctx;

  let prepared;
  try {
    prepared = buildRequestBodyFromInput(input, testInputsRoot);
  } catch (err) {
    // Couldn't even build the request — synthesize a row that records
    // the failure without poisoning the rest of the run.
    const inputName = path.relative(testInputsRoot, input.primaryFile).split(path.sep).join('/');
    const row = {
      inputName,
      inputType: 'unknown',
      category: 'uncategorized',
      parsePath: 'parse_error',
      expansionPath: 'not_attempted',
      parseConfidence: null,
      tickersFound: 0,
      unsupportedTickers: 0,
      suspectedInjection: false,
      expansionTickerCount: null,
      expansionConfidence: null,
      validationWarnings: '',
      hardRejected: false,
      manualRating: '',
      manualNotes: '',
    };
    return {
      row,
      meta: { row, error: err.message, parseResp: null, expandResp: null },
      parseResp: null,
      expandResp: null,
    };
  }

  const { body, inputType, category, inputName, expectedBehavior } = prepared;

  // Parse-signal call (postJson handles 429-retry once internally)
  const parseResp = await postJson({
    apiUrl,
    idToken,
    endpoint: '/api/forge/parse-signal',
    body,
    label: `${label || ''} ${inputName} parse`.trim(),
  });
  const parsePath = classifyParsePath(parseResp);

  // Extract row fields from parse response
  const parse = parseResp.body?.parse || null;
  const validation = parseResp.body?.validation || null;
  const parseConfidence = typeof parse?.confidence === 'number' ? parse.confidence : null;
  const tickersFound = Array.isArray(validation?.validated) ? validation.validated.length : 0;
  const unsupportedTickers = Array.isArray(validation?.unsupported) ? validation.unsupported.length : 0;
  const suspectedInjection = parse?.suspectedInjection === true;

  // Expand-signal call (only on parsePath === 'happy' per spec)
  let expandResp = null;
  let expandWasCalled = false;
  if (parsePath === 'happy' && parse) {
    expandWasCalled = true;
    expandResp = await postJson({
      apiUrl,
      idToken,
      endpoint: '/api/forge/expand-signal',
      body: {
        parsedSignal: parse,
        dropId: body.dropId,
        agentId,
      },
      label: `${label || ''} ${inputName} expand`.trim(),
    });
  }
  const expansionPath = classifyExpansionPath(parsePath, expandResp, expandWasCalled);

  // Extract expansion fields
  const expansion = expandResp?.body?.expansion || null;
  const expansionTickerCount = Array.isArray(expansion?.relatedTickers)
    ? expansion.relatedTickers.length
    : null;
  const expansionConfidence = typeof expansion?.confidence === 'string' ? expansion.confidence : null;
  const validationWarnings = expandResp?.body?.validationWarning || '';
  const hardRejected = expansionPath === 'validation_failure';

  const row = {
    inputName,
    inputType,
    category,
    parsePath,
    expansionPath,
    parseConfidence,
    tickersFound,
    unsupportedTickers,
    suspectedInjection,
    expansionTickerCount,
    expansionConfidence,
    validationWarnings,
    hardRejected,
    manualRating: '',
    manualNotes: '',
  };

  const meta = {
    row,
    expectedBehavior,
    parseLatencyMs: parseResp.latencyMs,
    expandLatencyMs: expandResp?.latencyMs ?? null,
    parseStatus: parseResp.status,
    expandStatus: expandResp?.status ?? null,
    parseResp: parseResp.body,
    expandResp: expandResp?.body ?? null,
    requestBody: redactBodyForMeta(body),
  };

  return { row, meta, parseResp, expandResp };
}

// Strip imageBase64 from request body before saving to meta.json — it
// would bloat each meta file by megabytes per image input.
function redactBodyForMeta(body) {
  if (!body || typeof body !== 'object') return body;
  const { imageBase64, ...rest } = body;
  if (typeof imageBase64 === 'string') {
    return { ...rest, imageBase64: `[redacted ${imageBase64.length} chars]` };
  }
  return body;
}

// ──────────────────────────────────────────────────────────────────────
// Main orchestrator
// ──────────────────────────────────────────────────────────────────────
async function main() {
  const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const flags = parseCliFlags(process.argv);

  const FIREBASE_ADMIN_CREDENTIALS = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
  const FIREBASE_API_KEY = env.FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  const TEST_USER_UID = env.TEST_USER_UID || process.env.TEST_USER_UID;
  const TEST_USER_AGENT_ID = env.TEST_USER_AGENT_ID || process.env.TEST_USER_AGENT_ID;
  const SIGNAL_DROP_API_URL = env.SIGNAL_DROP_API_URL || process.env.SIGNAL_DROP_API_URL;
  const TEST_INPUT_DIR = env.TEST_INPUT_DIR
    || process.env.TEST_INPUT_DIR
    || path.join(PROJECT_ROOT, 'scripts', 'test-inputs');
  const TEST_RESULTS_DIR = env.TEST_RESULTS_DIR
    || process.env.TEST_RESULTS_DIR
    || path.join(PROJECT_ROOT, 'scripts', 'test-results');

  if (!FIREBASE_ADMIN_CREDENTIALS) die('FIREBASE_ADMIN_CREDENTIALS not found in .env.local');
  if (!FIREBASE_API_KEY) die('FIREBASE_API_KEY not found in .env.local');
  if (!TEST_USER_UID) die('TEST_USER_UID not found in .env.local');
  if (!TEST_USER_AGENT_ID) die('TEST_USER_AGENT_ID not found in .env.local');
  if (!SIGNAL_DROP_API_URL) die('SIGNAL_DROP_API_URL not found in .env.local');

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(FIREBASE_ADMIN_CREDENTIALS);
  } catch (err) {
    die(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${err.message}`);
  }

  // Mint ID token (initializes firebase-admin app as a side effect)
  console.log('Initializing firebase-admin and minting test-user ID token…');
  let idToken;
  try {
    idToken = await mintIdToken({
      serviceAccount,
      testUserUid: TEST_USER_UID,
      firebaseApiKey: FIREBASE_API_KEY,
    });
  } catch (err) {
    console.error('Failed to mint ID token:');
    console.error(`  ${err.message}`);
    console.error('Hint: the service account needs the "Service Account Token Creator"');
    console.error('IAM role (roles/iam.serviceAccountTokenCreator) to mint custom tokens.');
    process.exit(1);
  }
  console.log(`ID token minted (length: ${idToken.length}).`);

  // --cleanup: purge test user's signalDrops collection before run
  if (flags.cleanup) {
    console.log('--cleanup: purging users/<TEST_USER_UID>/signalDrops…');
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const result = await cleanupTestUserDrops(db, TEST_USER_UID);
    console.log(`Cleaned up ${result.deleted} stale drop records.`);
  }

  // Discover inputs
  const allFiles = walkInputDir(TEST_INPUT_DIR);
  const inputs = pairInputsWithMetadata(allFiles);
  console.log(`Discovered ${inputs.length} input(s) in ${path.relative(PROJECT_ROOT, TEST_INPUT_DIR)}/`);
  if (inputs.length === 0) {
    console.log('No inputs to process. Add files to scripts/test-inputs/ and re-run.');
    process.exit(0);
  }

  // Run-root directory: scripts/test-results/{run-timestamp}/
  const runTimestamp = formatRunTimestamp(new Date());
  const runRoot = path.join(TEST_RESULTS_DIR, runTimestamp);
  mkdirSync(runRoot, { recursive: true });
  console.log(`Run root: ${path.relative(PROJECT_ROOT, runRoot)}/`);
  console.log(`Inter-input delay: ${flags.delayMs}ms (override with --delay-ms N)\n`);

  // Per-input loop (serial — preserves cache-hit determinism)
  const ctx = {
    apiUrl: SIGNAL_DROP_API_URL,
    idToken,
    agentId: TEST_USER_AGENT_ID,
    testInputsRoot: TEST_INPUT_DIR,
  };
  const rows = [];
  const metas = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const inputName = path.relative(TEST_INPUT_DIR, input.primaryFile).split(path.sep).join('/');
    const flatname = inputName.replace(/[\\/]/g, '__').replace(/\.[^.]+$/, '');
    const inputDir = path.join(runRoot, flatname);
    mkdirSync(inputDir, { recursive: true });

    const label = `[${i + 1}/${inputs.length}]`;
    process.stdout.write(`${label} ${inputName}… `);

    const { row, meta, parseResp, expandResp } = await runOneInput(input, ctx, label);

    // Save per-input artifacts
    writeFileSync(path.join(inputDir, 'parsed.json'), JSON.stringify(parseResp?.body ?? null, null, 2));
    if (expandResp !== null) {
      writeFileSync(path.join(inputDir, 'expansion.json'), JSON.stringify(expandResp.body ?? null, null, 2));
    }
    writeFileSync(path.join(inputDir, 'meta.json'), JSON.stringify(meta, null, 2));

    rows.push(row);
    metas.push(meta);

    process.stdout.write(`parse=${row.parsePath}, expand=${row.expansionPath}\n`);

    // Inter-input pacing — skip the trailing wait after the last input
    if (i < inputs.length - 1 && flags.delayMs > 0) {
      await sleep(flags.delayMs);
    }
  }

  // Write summary.json
  const summaryPath = path.join(runRoot, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(rows, null, 2));
  console.log(`\nSummary: ${path.relative(PROJECT_ROOT, summaryPath)}`);

  // Stdout summary
  printStdoutSummary(rows, metas, runRoot);
}

function formatRunTimestamp(date) {
  // YYYYMMDD-HHMMSS in UTC for filesystem-safe, ordered naming
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}${mo}${d}-${h}${mi}${s}Z`;
}

function printStdoutSummary(rows, metas, runRoot) {
  console.log('\n=== Phase 1 Test Harness Summary ===');
  console.log(`Total inputs processed: ${rows.length}`);

  // parsePath counts
  const parsePathCounts = countBy(rows, 'parsePath');
  console.log('\nparsePath distribution:');
  for (const [k, v] of Object.entries(parsePathCounts)) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }

  // expansionPath counts
  const expansionPathCounts = countBy(rows, 'expansionPath');
  console.log('\nexpansionPath distribution:');
  for (const [k, v] of Object.entries(expansionPathCounts)) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }

  // Confidence histogram
  const { buckets, nullCount } = histogramConfidence(rows);
  console.log('\nparseConfidence histogram (10 buckets of 0.1):');
  for (let i = 0; i < buckets.length; i++) {
    const lo = (i * 0.1).toFixed(1);
    const hi = ((i + 1) * 0.1).toFixed(1);
    const bar = '█'.repeat(buckets[i]);
    console.log(`  ${lo}–${hi}  ${String(buckets[i]).padStart(3)}  ${bar}`);
  }
  if (nullCount > 0) console.log(`  (null/missing confidence: ${nullCount})`);

  // Cross-cutting counts
  const junkBailoutCount = rows.filter(r => r.parsePath === 'bailout').length;
  const hardCheckpointCount = rows.filter(r => r.parsePath === 'low_confidence_checkpoint').length;
  const expansionRanCount = rows.filter(r => r.expansionPath === 'ran').length;
  const expansionErrorCount = rows.filter(r => r.expansionPath === 'expansion_error').length;
  const crossSectorWarningCount = rows.filter(r => r.validationWarnings && r.validationWarnings.length > 0).length;
  const hardRejectionCount = rows.filter(r => r.hardRejected === true).length;
  const suspectedInjectionCount = rows.filter(r => r.suspectedInjection === true).length;

  console.log('\nCross-cutting counts:');
  console.log(`  junk bailouts:                ${junkBailoutCount}`);
  console.log(`  hard checkpoints:             ${hardCheckpointCount}`);
  console.log(`  expansions ran:               ${expansionRanCount}`);
  console.log(`  expansion errors:             ${expansionErrorCount}`);
  console.log(`  cross-sector warnings:        ${crossSectorWarningCount}`);
  console.log(`  hard rejections (validator):  ${hardRejectionCount}`);
  console.log(`  suspectedInjection flagged:   ${suspectedInjectionCount}`);

  // Latency
  const parseLatencies = metas.map(m => m.parseLatencyMs).filter(Boolean);
  const expandLatencies = metas.map(m => m.expandLatencyMs).filter(Boolean);
  const avgParse = average(parseLatencies);
  const avgExpand = average(expandLatencies);
  console.log('\nLatency (avg ms):');
  console.log(`  parse-signal:  ${avgParse !== null ? avgParse.toFixed(0) : 'n/a'}  (n=${parseLatencies.length})`);
  console.log(`  expand-signal: ${avgExpand !== null ? avgExpand.toFixed(0) : 'n/a'}  (n=${expandLatencies.length})`);

  // Cost (rough — authoritative cost lives in shadow logs)
  const cost = estimateCostUSD(rows);
  console.log(`\nEstimated total cost (rough — authoritative costs in shadow logs):`);
  console.log(`  $${cost.toFixed(4)} USD`);

  console.log(`\nPer-input artifacts: ${path.relative(PROJECT_ROOT, runRoot)}/<input>/`);
  console.log(`Summary row table:   ${path.relative(PROJECT_ROOT, runRoot)}/summary.json`);
  console.log('\nNext step: open summary.json, fill in manualRating / manualNotes per input,');
  console.log('then write PHASE1_QUALITY_REPORT.md per the Step 7 schema.');
}

function countBy(rows, field) {
  const out = {};
  for (const r of rows) {
    const k = r[field] || '(undefined)';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// Only run main when executed directly — exporting nothing keeps the
// module importable from the unit-test script without firing the run.
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  main().catch((err) => {
    console.error(`FATAL: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
}

// Named exports so the unit-test script can exercise pure helpers
// without booting firebase-admin or hitting the network.
export {
  parseEnvFile,
  parseCliFlags,
  walkInputDir,
  classifyExtension,
  pairInputsWithMetadata,
  buildRequestBodyFromInput,
  chunkArray,
  cleanupTestUserDrops,
  classifyParsePath,
  classifyExpansionPath,
  histogramConfidence,
  estimateCostUSD,
  average,
  postJson,
  mintIdToken,
  sleep,
  readRetryAfter,
  DEFAULT_INTER_INPUT_DELAY_MS,
  DEFAULT_RETRY_AFTER_SECONDS,
  runOneInput,
  main,
  PROJECT_ROOT,
  IMAGE_MIME,
  COST_ESTIMATE_PER_PARSE_USD,
  COST_ESTIMATE_PER_EXPAND_USD,
};
