#!/usr/bin/env node
/**
 * seed-discover-sectors.js
 *
 * Idempotent uploader for the 11 SPDR sector docs to the
 * `discoverSectors` Firestore collection.
 *
 * Mirrors the pattern established by scripts/seed-discover-themes.js:
 *  - Uses firebase-admin SDK with credentials from .env.local
 *  - Deterministic doc IDs (`sector_<lowercased_ticker>`)
 *  - Read-then-write to preserve `createdAt` across re-runs
 *  - Dry-run mode via --dry-run flag
 *  - Verification read-back at end
 *
 * Run:
 *   node scripts/seed-discover-sectors.js              # live upload
 *   node scripts/seed-discover-sectors.js --dry-run    # show what would happen
 *
 * Required env: FIREBASE_ADMIN_CREDENTIALS in .env.local
 *
 * The Firestore doc shape is the REGISTRY only — what's visible and in
 * what order. Editorial content (regime tag, body, linked themes) lives
 * in src/components/discover/sectorContent.js and is not seeded.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const COLLECTION = 'discoverSectors';

// Canonical sector universe — 11 SPDR sectors in default display order.
// Order here = displayOrder field. See sectorContent.js for editorial content.
const SECTORS = [
  { ticker: 'XLK', name: 'Technology' },
  { ticker: 'XLV', name: 'Healthcare' },
  { ticker: 'XLF', name: 'Financials' },
  { ticker: 'XLE', name: 'Energy' },
  { ticker: 'XLI', name: 'Industrials' },
  { ticker: 'XLY', name: 'Consumer Discretionary' },
  { ticker: 'XLP', name: 'Consumer Staples' },
  { ticker: 'XLU', name: 'Utilities' },
  { ticker: 'XLB', name: 'Materials' },
  { ticker: 'XLRE', name: 'Real Estate' },
  { ticker: 'XLC', name: 'Communication Services' },
];

// .env.local parser — mirrors scripts/seed-discover-themes.js:58-78 exactly
// so future maintainers see one pattern, not two.
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

async function initAdmin() {
  const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const credsRaw = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!credsRaw) {
    console.error('ERROR: FIREBASE_ADMIN_CREDENTIALS missing from .env.local');
    process.exit(1);
  }
  let creds;
  try {
    creds = JSON.parse(credsRaw);
  } catch (err) {
    console.error('ERROR: FIREBASE_ADMIN_CREDENTIALS is not valid JSON');
    console.error(err.message);
    process.exit(1);
  }
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const firestoreModule = await import('firebase-admin/firestore');
  if (getApps().length === 0) {
    initializeApp({ credential: cert(creds) });
  }
  return {
    db: firestoreModule.getFirestore(),
    FieldValue: firestoreModule.FieldValue,
  };
}

function buildDocId(ticker) {
  return `sector_${ticker.toLowerCase()}`;
}

function buildDocPayload(sector, displayOrder, existingCreatedAt, FieldValue) {
  const now = FieldValue.serverTimestamp();
  return {
    ticker: sector.ticker,
    name: sector.name,
    status: 'active',
    displayOrder,
    // createdAt: preserved on re-run, set fresh on first creation
    createdAt: existingCreatedAt || now,
    updatedAt: now,
  };
}

async function seed() {
  const { db, FieldValue } = await initAdmin();
  const collRef = db.collection(COLLECTION);

  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Seeding ${SECTORS.length} sectors to '${COLLECTION}'\n`);

  const summary = { created: 0, updated: 0, errors: 0 };

  for (let i = 0; i < SECTORS.length; i++) {
    const sector = SECTORS[i];
    const displayOrder = i + 1; // 1-indexed
    const docId = buildDocId(sector.ticker);
    const docRef = collRef.doc(docId);

    try {
      const existing = await docRef.get();
      const existingCreatedAt = existing.exists ? existing.data().createdAt : null;
      const payload = buildDocPayload(sector, displayOrder, existingCreatedAt, FieldValue);

      const action = existing.exists ? 'UPDATE' : 'CREATE';
      console.log(`  ${action}: ${docId} (displayOrder=${displayOrder}, name="${sector.name}")`);

      if (!DRY_RUN) {
        await docRef.set(payload);
        if (existing.exists) summary.updated += 1;
        else summary.created += 1;
      }
    } catch (err) {
      console.error(`  ERROR on ${docId}: ${err.message}`);
      summary.errors += 1;
    }
  }

  console.log(`\nSummary: ${summary.created} created, ${summary.updated} updated, ${summary.errors} errors`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes performed. Re-run without --dry-run to apply.\n');
    return;
  }

  // Verification read-back
  console.log('\nVerifying upload...');
  const snapshot = await collRef.orderBy('displayOrder', 'asc').get();
  console.log(`  Found ${snapshot.size} docs in '${COLLECTION}':`);
  snapshot.forEach((doc) => {
    const d = doc.data();
    console.log(`    ${doc.id}: displayOrder=${d.displayOrder}, ticker=${d.ticker}, status=${d.status}`);
  });

  if (snapshot.size !== SECTORS.length) {
    console.warn(`\nWARNING: Expected ${SECTORS.length} docs, found ${snapshot.size}. Investigate before launching.`);
    process.exit(1);
  }

  console.log('\nSeed complete.\n');
}

seed().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
