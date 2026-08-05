// scripts/loadLocalEnv.js
//
// Local-shell env loading for the one-off operational scripts (lifecycle void
// pre-check / apply). Serverless functions get FIREBASE_* injected by Vercel;
// a local `node scripts/…` run gets nothing, so `cert()` receives an object of
// undefineds and firebase-admin throws the opaque:
//
//   app/invalid-credential: Service account object must contain a string "project_id"
//
// which tells an operator nothing about what to do. This module loads
// .env.local / .env into process.env and turns a missing/malformed credential
// into a one-line instruction.
//
// NO dotenv dependency (it is not in package.json) — same hand-rolled
// line-parser approach already used by scripts/test-signal-drop-pipeline.js:86.
//
// IMPORT ORDER MATTERS: import this module ABOVE any module that may read
// process.env at import time. ESM evaluates imports in source order, and this
// module loads the env file as an import side effect.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

// Searched in order; the first file to define a key wins. A key already present
// in the real process environment ALWAYS wins over both, so this is safe to
// leave wired up if a script is ever run somewhere env is injected.
const ENV_FILES = ['.env.local', '.env'];

// KEY=VALUE, one pair per line. Strips one layer of matched surrounding quotes,
// skips blanks and # comments. Escape sequences (notably the \n inside a
// single-line PEM) are deliberately left as literal text — firebaseAdmin.js:17
// performs the .replace(/\\n/g, '\n') normalization downstream.
export function parseEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
      || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/** Files actually found and loaded, for the diagnostic message. */
export const loadedEnvFiles = [];

export function loadLocalEnv() {
  for (const name of ENV_FILES) {
    const full = path.join(PROJECT_ROOT, name);
    if (!existsSync(full)) continue;
    loadedEnvFiles.push(name);
    const parsed = parseEnvFile(full);
    for (const [k, v] of Object.entries(parsed)) {
      // Real environment wins; earlier file wins over later file.
      if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v;
    }
  }
  return loadedEnvFiles;
}

// Load on import, so this module can be imported for its side effect above the
// firebaseAdmin import.
loadLocalEnv();

const REQUIRED = [
  ['FIREBASE_PROJECT_ID', 'the Firebase project id, e.g. tradeseven-xxxxx'],
  ['FIREBASE_CLIENT_EMAIL', 'the service-account email, ends in .iam.gserviceaccount.com'],
  ['FIREBASE_PRIVATE_KEY', 'the service-account private key, double-quoted, \\n-escaped, on ONE line'],
];

function fail(lines) {
  console.error('');
  console.error('=============================================================');
  console.error(' CREDENTIALS NOT READY — nothing was read, nothing was written');
  console.error('=============================================================');
  for (const l of lines) console.error(l);
  console.error('');
  console.error(` Env files found in ${PROJECT_ROOT}: ${loadedEnvFiles.length ? loadedEnvFiles.join(', ') : 'NONE'}`);
  console.error('');
  console.error(' Fix it, then run the exact same command again.');
  console.error('');
  process.exit(4);
}

/**
 * Verifies the three FIREBASE_* credential vars are present and well-formed.
 * Exits 4 with an actionable message instead of letting firebase-admin throw
 * `app/invalid-credential` from deep inside cert(). Never prints secret values.
 */
export function requireFirebaseCreds() {
  const missing = REQUIRED.filter(([name]) => !process.env[name]);
  if (missing.length) {
    fail([
      ` Missing ${missing.map(([n]) => n).join(', ')}.`,
      '',
      ' Set it in .env.local in the repo root (one KEY=VALUE per line):',
      ...missing.map(([n, hint]) => `   ${n}=...   # ${hint}`),
    ]);
  }

  // A private key pasted with real line breaks silently truncates to the first
  // line under a line-based parser — catch it here rather than as a signing
  // error five seconds later.
  const key = process.env.FIREBASE_PRIVATE_KEY;
  const normalized = key.replace(/\\n/g, '\n');
  if (!normalized.includes('-----BEGIN PRIVATE KEY-----')
    || !normalized.includes('-----END PRIVATE KEY-----')) {
    fail([
      ' FIREBASE_PRIVATE_KEY is set but does not look like a PEM private key',
      ' (missing the -----BEGIN PRIVATE KEY----- / -----END PRIVATE KEY----- markers).',
      '',
      ' In .env.local it must be ONE line, wrapped in double quotes, with the',
      ' line breaks written as the two characters \\n — like this:',
      '',
      '   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEv...\\n-----END PRIVATE KEY-----\\n"',
      '',
      ' If you pasted the key across several lines, rejoin it into one line.',
    ]);
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };
}
