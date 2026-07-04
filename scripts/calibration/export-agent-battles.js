#!/usr/bin/env node
// scripts/calibration/export-agent-battles.js
// Knob Calibration — READ-ONLY export of agentBattles → a local JSON file for
// aggregate-real-battles.js (B1). It READS Firestore and writes ONLY a local
// file; it never mutates the database. Mirrors the .env.local admin convention of
// scripts/rule-compat-cleanup.js (FIREBASE_ADMIN_CREDENTIALS).
//
// USAGE (from project root):
//   node scripts/calibration/export-agent-battles.js                       # completed → ./export.json
//   node scripts/calibration/export-agent-battles.js --status all          # every status
//   node scripts/calibration/export-agent-battles.js --from 2026-03-01 --to 2026-06-01
//   node scripts/calibration/export-agent-battles.js --out battles.json --limit 500
//
// Then: node scripts/calibration/aggregate-real-battles.js --input export.json
//
// ENV: FIREBASE_ADMIN_CREDENTIALS in .env.local (rule-compat-cleanup.js convention).

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..', '..');

function die(msg) {
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
}

export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

export function parseArgs(argv) {
  const flags = { status: 'completed', from: null, to: null, out: null, limit: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--status') flags.status = argv[++i];
    else if (a === '--from') flags.from = argv[++i];
    else if (a === '--to') flags.to = argv[++i];
    else if (a === '--out') flags.out = argv[++i];
    else if (a === '--limit') flags.limit = Number(argv[++i]);
    else die(`Unknown flag: ${a}`);
  }
  return flags;
}

// Recursively convert Firestore Timestamps → ISO strings so the export is plain
// JSON. (aggregate-real-battles.js toEpochMs also accepts {_seconds}/{seconds},
// but ISO is the cleanest wire form and sorts lexically.)
export function serialize(v) {
  if (v == null) return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(serialize);
  if (typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = serialize(val);
    return o;
  }
  return v;
}

// Client-side date window on the (already-serialized ISO) createdAt — avoids a
// composite Firestore index while still honoring --from/--to.
export function applyDateWindow(battles, { from, to }) {
  let out = battles;
  if (from) {
    const f = new Date(from).toISOString();
    out = out.filter((b) => typeof b.createdAt === 'string' && b.createdAt >= f);
  }
  if (to) {
    const t = new Date(to).toISOString();
    out = out.filter((b) => typeof b.createdAt === 'string' && b.createdAt <= t);
  }
  return out;
}

async function main() {
  const flags = parseArgs(process.argv);
  const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const creds = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!creds) die('FIREBASE_ADMIN_CREDENTIALS not found in .env.local or the environment');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(creds);
  } catch (err) {
    die(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${err.message}`);
  }

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  console.log(`firebase-admin initialized for project: ${serviceAccount.project_id}`);

  // READ ONLY. Single-field status equality → no custom index needed. The date
  // window is applied client-side (below), so no composite index is required.
  let q = db.collection('agentBattles');
  if (flags.status && flags.status !== 'all') q = q.where('status', '==', flags.status);
  if (flags.limit) q = q.limit(flags.limit);

  const snap = await q.get();
  let battles = snap.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
  battles = applyDateWindow(battles, flags);

  const outPath = flags.out || path.join(process.cwd(), 'export.json');
  writeFileSync(outPath, JSON.stringify({ battles }, null, 2));
  console.log(`Exported ${battles.length} agentBattles (status=${flags.status}${flags.from ? `, from ${flags.from}` : ''}${flags.to ? `, to ${flags.to}` : ''}) → ${outPath}`);
  console.log(`Next: node scripts/calibration/aggregate-real-battles.js --input ${outPath}`);
}

// Runner only — guarded so tests can import the pure helpers without a DB.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => die(err.stack || err.message));
}
