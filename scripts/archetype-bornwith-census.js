// scripts/archetype-bornwith-census.js
//
// Finding-10 READ-ONLY census: count agents whose equippedTraits contains NONE
// of their archetype's born-with set (the invariant-violating "bad state" the
// atomic archetype-change seed (api/agent/change-archetype.js) now prevents going
// forward). This measures the EXISTING beta population before deciding whether to
// repair it — it is a COUNT sketch, NOT a migration. ZERO writes: .get() + report
// only. Mirrors the scripts/rule-compat-cleanup.js runner convention.
//
// USAGE (from project root):
//   node scripts/archetype-bornwith-census.js            # census + JSON report
//   node scripts/archetype-bornwith-census.js --out <p>  # report path
//
// ENV: FIREBASE_ADMIN_CREDENTIALS in .env.local (a JSON service account), the
// seed-discover-themes.js / rule-compat-cleanup.js convention. Reads only.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { ARCHETYPE_DEFAULT_TRAITS } from '../src/data/traitLibrary.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');

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
  // Pass the parsed service account straight to cert() — the exact convention
  // scripts/rule-compat-cleanup.js uses (firebase-admin reads the snake_case
  // downloaded-JSON shape), so an existing .env.local works unchanged.
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function main() {
  const outArgIdx = process.argv.indexOf('--out');
  const outPath = outArgIdx > -1 ? process.argv[outArgIdx + 1]
    : path.join(PROJECT_ROOT, 'archetype-bornwith-census-report.json');

  const db = initAdmin();
  const snap = await db.collection('agents').get(); // READ-ONLY

  const stats = {
    scanned: 0, bad: 0, partial: 0, full: 0,
    skippedNoArchetype: 0, skippedUnknownArchetype: 0, skippedNoDefaults: 0,
    clones: { scanned: 0, bad: 0 },
  };
  const badAgents = [];

  for (const doc of snap.docs) {
    const a = doc.data();
    const isClone = a.isTrainingClone === true;
    if (!a.archetype) { stats.skippedNoArchetype++; continue; }
    const bw = ARCHETYPE_DEFAULT_TRAITS[a.archetype];
    if (bw === undefined) { stats.skippedUnknownArchetype++; continue; }
    if (!bw.length) { stats.skippedNoDefaults++; continue; }

    const eq = new Set((a.equippedTraits || []).map((t) => t && t.traitId).filter(Boolean));
    const hits = bw.filter((id) => eq.has(id)).length;

    stats.scanned++;
    if (isClone) stats.clones.scanned++;
    if (hits === 0) {
      stats.bad++;
      if (isClone) stats.clones.bad++;
      badAgents.push({ id: doc.id, archetype: a.archetype, isTrainingClone: isClone, equippedTraitIds: [...eq] });
    } else if (hits < bw.length) {
      stats.partial++;
    } else {
      stats.full++;
    }
  }

  const report = { generatedAt: new Date().toISOString(), collection: 'agents', totalDocs: snap.size, stats, badAgents };
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\n=== Archetype born-with census (READ-ONLY) ===');
  console.log(`total agent docs      : ${snap.size}`);
  console.log(`scanned (has defaults): ${stats.scanned}`);
  console.log(`BAD  (0 born-with)    : ${stats.bad}   <-- invariant-violating count`);
  console.log(`partial (some)        : ${stats.partial}`);
  console.log(`full (all born-with)  : ${stats.full}`);
  console.log(`  of which clones      : scanned ${stats.clones.scanned}, bad ${stats.clones.bad}`);
  console.log(`skipped: noArchetype=${stats.skippedNoArchetype} unknownArchetype=${stats.skippedUnknownArchetype} noDefaults=${stats.skippedNoDefaults}`);
  console.log(`report written to     : ${outPath}\n`);
}

main().catch((err) => die(err && err.stack ? err.stack : String(err)));
