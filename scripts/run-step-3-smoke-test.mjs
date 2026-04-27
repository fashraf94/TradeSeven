// scripts/run-step-3-smoke-test.mjs
//
// Step 3 deployed-curl smoke test runner for /api/forge/parse-signal.
//
// HOW TO RUN (from project root):
//
//   node scripts/run-step-3-smoke-test.mjs
//
// Cross-platform Node.js — works on Windows PowerShell, macOS, Linux.
// Reads env vars from .env.local at the project root via a simple
// line-parser (no dotenv dependency required).
//
// Required env vars in .env.local:
//   FIREBASE_ADMIN_CREDENTIALS — JSON service account creds (single-line stringified)
//   FIREBASE_API_KEY            — Firebase web API key for the tradeseven project
//   TEST_USER_UID               — UID of the dedicated Firebase Auth test user
//   SIGNAL_DROP_API_URL         — Vercel preview URL of the current branch
// Optional:
//   SAVE_RESPONSE_DIR           — defaults to scripts/test-results/step-3-smoke/

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// ──────────────────────────────────────────────────────────────────────
// Resolve project root from script location (works regardless of cwd)
// ──────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

// ──────────────────────────────────────────────────────────────────────
// .env.local parser — handles KEY=VALUE, double/single-quoted values,
// comments (lines starting with #), and blank lines. JSON-string values
// are returned as-is (still a string) so the caller can JSON.parse.
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
// Setup — read env, validate, init firebase-admin, mint ID token
// ──────────────────────────────────────────────────────────────────────
const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));

const FIREBASE_ADMIN_CREDENTIALS = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
const FIREBASE_API_KEY = env.FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
const TEST_USER_UID = env.TEST_USER_UID || process.env.TEST_USER_UID;
const SIGNAL_DROP_API_URL = env.SIGNAL_DROP_API_URL || process.env.SIGNAL_DROP_API_URL;
const SAVE_RESPONSE_DIR = env.SAVE_RESPONSE_DIR
  || process.env.SAVE_RESPONSE_DIR
  || path.join(PROJECT_ROOT, 'scripts', 'test-results', 'step-3-smoke');

if (!FIREBASE_ADMIN_CREDENTIALS) die('FIREBASE_ADMIN_CREDENTIALS not found in .env.local');
if (!FIREBASE_API_KEY) die('FIREBASE_API_KEY not found in .env.local');
if (!TEST_USER_UID) die('TEST_USER_UID not found in .env.local');
if (!SIGNAL_DROP_API_URL) die('SIGNAL_DROP_API_URL not found in .env.local');

let serviceAccount;
try {
  serviceAccount = JSON.parse(FIREBASE_ADMIN_CREDENTIALS);
} catch (err) {
  die(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${err.message}`);
}

mkdirSync(SAVE_RESPONSE_DIR, { recursive: true });

console.log('Initializing firebase-admin and minting test-user ID token…');
if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

let customToken;
try {
  customToken = await getAuth().createCustomToken(TEST_USER_UID);
} catch (err) {
  console.error('Failed to mint custom token via firebase-admin:');
  console.error(`  ${err.code || ''}: ${err.message}`);
  console.error('Hint: the service account needs the "Service Account Token Creator"');
  console.error('IAM role (roles/iam.serviceAccountTokenCreator) to mint custom tokens.');
  process.exit(1);
}

let idToken;
try {
  const exchangeUrl =
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`;
  const exchangeResp = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const exchangeBody = await exchangeResp.json();
  if (!exchangeResp.ok || !exchangeBody.idToken) {
    console.error('Identity Toolkit token-exchange failed:');
    console.error(`  HTTP ${exchangeResp.status}`);
    console.error(`  ${JSON.stringify(exchangeBody)}`);
    process.exit(1);
  }
  idToken = exchangeBody.idToken;
} catch (err) {
  console.error(`Identity Toolkit token-exchange threw: ${err.message}`);
  process.exit(1);
}

console.log(`ID token minted (length: ${idToken.length}). Starting curls…\n`);

// ──────────────────────────────────────────────────────────────────────
// Curl helper
// ──────────────────────────────────────────────────────────────────────
const FIXTURE_DIR = path.join(PROJECT_ROOT, 'scripts', 'test-results', 'step-3-smoke');

function loadFixture(name) {
  const filePath = path.join(FIXTURE_DIR, `sample-request-${name}.json`);
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

async function postParseSignal(label, fixtureName, responseName) {
  const fixture = loadFixture(fixtureName);
  const body = { ...fixture, dropId: crypto.randomUUID() };
  const url = `${SIGNAL_DROP_API_URL.replace(/\/$/, '')}/api/forge/parse-signal`;

  let status;
  let json;
  let text;
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
    text = await resp.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = { _rawText: text };
    }
  } catch (err) {
    status = 0;
    json = { _fetchError: err.message };
  }

  const savePath = path.join(SAVE_RESPONSE_DIR, `response-${responseName}.json`);
  writeFileSync(savePath, JSON.stringify(json, null, 2));

  console.log(`Curl ${label}: HTTP ${status} → ${path.relative(PROJECT_ROOT, savePath)}`);
  return { status, body: json, dropId: body.dropId };
}

// ──────────────────────────────────────────────────────────────────────
// Run the five curls in sequence (no parallelism — we want clean cache
// ordering for Curl 5 to actually be a hit, not a race)
// ──────────────────────────────────────────────────────────────────────
const results = {
  text:      await postParseSignal('1 (text)',      'text',      'text'),
  url:       await postParseSignal('2 (url)',       'url',       'url'),
  junk:      await postParseSignal('3 (junk)',      'junk',      'junk'),
  injection: await postParseSignal('4 (injection)', 'injection', 'injection'),
  cached:    await postParseSignal('5 (cache)',     'text',      'text-cached'),
};

// ──────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────
function fmtTickers(validation) {
  if (!validation || !Array.isArray(validation.validated)) return '[]';
  return '[' + validation.validated.map(v => v.symbol).join(',') + ']';
}

function fmtConfidence(parse) {
  if (!parse || typeof parse.confidence !== 'number') return 'n/a';
  return parse.confidence.toFixed(2);
}

function summarize(label, result, expected) {
  if (result.status !== 200) {
    console.log(`${label}: HTTP ${result.status} ✗ (non-200)`);
    console.log(`           body: ${JSON.stringify(result.body).slice(0, 500)}`);
    return false;
  }
  const b = result.body || {};
  const parse = b.parse || {};
  const confidence = fmtConfidence(parse);
  const tickers = fmtTickers(b.validation);

  let suffix = '';
  let pass = true;

  if (expected.bailout) {
    const ok = b.shouldBailout === true;
    suffix += ` shouldBailout=${b.shouldBailout ? 'TRUE' : 'FALSE'} ${ok ? '✓' : '✗'}`;
    pass = pass && ok;
  }
  if (expected.injection) {
    const ok = parse.suspectedInjection === true;
    suffix += ` suspectedInjection=${parse.suspectedInjection ? 'TRUE' : 'FALSE'} ${ok ? '✓' : '✗'}`;
    pass = pass && ok;
  }
  if (expected.cached) {
    const ok = b.cached === true;
    suffix += ` cached=${b.cached ? 'TRUE' : 'FALSE'} ${ok ? '✓' : '✗'}`;
    pass = pass && ok;
  }
  if (expected.cached && expected.matchTextResult) {
    const baseline = expected.matchTextResult;
    const sameTopic = parse.topic === (baseline.body?.parse?.topic || null);
    const sameKeyClaim = parse.keyClaim === (baseline.body?.parse?.keyClaim || null);
    const ok = sameTopic && sameKeyClaim;
    suffix += ` parseMatch=${ok ? 'TRUE' : 'FALSE'} ${ok ? '✓' : '✗'}`;
    pass = pass && ok;
  }

  console.log(`${label}: 200 OK, parse.confidence=${confidence}, validatedTickers=${tickers}${suffix}`);
  return pass;
}

console.log('\n=== Step 3 Smoke Test Results ===');
const p1 = summarize('Curl 1 (text)',      results.text,      {});
const p2 = summarize('Curl 2 (url)',       results.url,       {});
const p3 = summarize('Curl 3 (junk)',      results.junk,      { bailout: true });
const p4 = summarize('Curl 4 (injection)', results.injection, { injection: true });
const p5 = summarize('Curl 5 (cache)',     results.cached,    { cached: true, matchTextResult: results.text });

const allPassed = p1 && p2 && p3 && p4 && p5;

console.log('\nResponses saved under:');
console.log(`  ${path.relative(PROJECT_ROOT, SAVE_RESPONSE_DIR)}/`);

console.log('\nSide effects to verify manually:');
console.log(`- Firestore: 5 records under users/${TEST_USER_UID}/signalDrops/`);
console.log(`  (one per dropId — Curls 1+5 share contentHash but produce 2 separate drop records)`);
console.log('- Firestore: 1-4 records under signalDropCache/ (one per unique contentHash)');
console.log('- GCS shadow log: 5 records under shadow/signal_drops/<today>/');

if (!allPassed) {
  console.log('\n⚠  One or more expectations did not match. Inspect the response-*.json files.');
  process.exit(1);
}
console.log('\nAll five curls returned 200 with expected flags. Ready for spot-check.');
