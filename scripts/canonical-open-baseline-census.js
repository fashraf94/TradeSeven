// scripts/canonical-open-baseline-census.js
//
// READ-ONLY census of League rounds that were STAMPED with
// `baselinePolicy: 'canonical_open'` at formation — i.e. the rounds formed while
// LEAGUE_CANONICAL_OPEN_CAPTURE has been on (flipped true in commit 6c5d59c6 on
// 2026-07-18). Counts how many carry the stamp overall and how many were formed
// since a cutoff (default 2026-07-18), so the founder can size the canonical-open
// cohort before deciding anything about it. ZERO writes: .get() + report only.
// Mirrors the scripts/rule-compat-cleanup.js runner convention.
//
// USAGE (from project root):
//   node scripts/canonical-open-baseline-census.js                 # since 2026-07-18
//   node scripts/canonical-open-baseline-census.js --since <ISO>   # custom cutoff
//   node scripts/canonical-open-baseline-census.js --out <path>    # report path
//
// ENV: FIREBASE_ADMIN_CREDENTIALS in .env.local (a JSON service account), the
// rule-compat-cleanup.js convention. Reads only.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { TOURNAMENT_GROUPS_COLLECTION, BASELINE_POLICY } from '../src/constants/leagueTournament.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_SINCE = '2026-07-18T00:00:00.000Z'; // the LEAGUE_CANONICAL_OPEN_CAPTURE flip (commit 6c5d59c6)

function die(msg) { console.error(`\nFATAL: ${msg}`); process.exit(1); }

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function initAdmin() {
  if (getApps().length) return getFirestore();
  const env = { ...parseEnvFile(path.join(PROJECT_ROOT, '.env.local')), ...process.env };
  const raw = env.FIREBASE_ADMIN_CREDENTIALS;
  if (!raw) die('FIREBASE_ADMIN_CREDENTIALS not found in .env.local or the environment');
  let serviceAccount;
  try { serviceAccount = JSON.parse(raw); } catch (err) { die(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${err.message}`); }
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

// createdAt may be an ISO string, a Firestore Timestamp, a Date, or epoch millis.
function toMillis(ts) {
  if (ts == null) return NaN;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
  if (ts instanceof Date) return ts.getTime();
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? NaN : parsed;
}

async function main() {
  const sinceIdx = process.argv.indexOf('--since');
  const sinceIso = sinceIdx > -1 ? process.argv[sinceIdx + 1] : DEFAULT_SINCE;
  const sinceMs = Date.parse(sinceIso);
  if (Number.isNaN(sinceMs)) die(`--since is not a valid ISO date: ${sinceIso}`);

  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx > -1 ? process.argv[outIdx + 1]
    : path.join(PROJECT_ROOT, 'canonical-open-baseline-census-report.json');

  const db = initAdmin();
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).get(); // READ-ONLY

  const stats = {
    totalGroups: snap.size,
    stamped: 0,               // baselinePolicy === canonical_open (any time)
    stampedSinceCutoff: 0,    // stamped AND createdAt >= --since
    stampedNoCreatedAt: 0,    // stamped but createdAt unparseable (can't date-bucket)
  };
  const stampedSince = [];

  for (const doc of snap.docs) {
    const g = doc.data();
    if (g.baselinePolicy !== BASELINE_POLICY.CANONICAL_OPEN) continue;
    stats.stamped += 1;
    const ms = toMillis(g.createdAt);
    if (Number.isNaN(ms)) { stats.stampedNoCreatedAt += 1; continue; }
    if (ms >= sinceMs) {
      stats.stampedSinceCutoff += 1;
      stampedSince.push({ id: doc.id, createdAt: g.createdAt, status: g.status ?? null, isLiveDraft: g.isLiveDraft ?? null });
    }
  }

  const report = { generatedAt: new Date().toISOString(), collection: TOURNAMENT_GROUPS_COLLECTION, since: sinceIso, stats, stampedSince };
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\n=== Canonical-open baseline census (READ-ONLY) ===');
  console.log(`collection             : ${TOURNAMENT_GROUPS_COLLECTION}`);
  console.log(`since cutoff           : ${sinceIso}`);
  console.log(`total group docs       : ${stats.totalGroups}`);
  console.log(`stamped canonical_open : ${stats.stamped}`);
  console.log(`  ...formed since cutoff: ${stats.stampedSinceCutoff}   <-- rounds carrying baselinePolicy since the flip`);
  console.log(`  ...stamped, no createdAt: ${stats.stampedNoCreatedAt} (couldn't date-bucket)`);
  console.log(`report written to      : ${outPath}\n`);
}

main().catch((err) => die(err && err.stack ? err.stack : String(err)));
