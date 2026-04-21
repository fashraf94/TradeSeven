// scripts/uploadDKB.js
//
// Upload Domain Knowledge Base (DKB) entries to the Firestore `domainKnowledge`
// collection. Feeds Gemma's Voice Layer (Blocks 3.5 / 3.6 / 3.7 — Anchor,
// State-Triggered, Semantic RAG).
//
// Usage:
//   node scripts/uploadDKB.js <path-to-batch.json>    # upload one batch
//   node scripts/uploadDKB.js --verify                # read-check: list all docs
//
// The batch file must contain a JSON array of DKB entries. Each entry MUST
// include: id, type ("quant"|"thematic"), status, fullEntry, injection,
// gemmaDirective.battle, gemmaDirective.workshop.
//
// Behavior:
//   - Sequential, one entry at a time (no parallel writes).
//   - Pre-existence check per entry — aborts the entry if the doc already exists
//     (no silent overwrites).
//   - Timestamp handling (user-specified):
//       * createdAt, updatedAt, platformValidation.lastValidated:
//           - `null` or the string "SERVER_TIMESTAMP" → FieldValue.serverTimestamp()
//           - ISO-8601 string → converted to a JS Date so Firestore stores it
//             as a Timestamp (preserves the meaningful date the entry carries)
//           - Anything else → preserved exactly as provided
//   - Validation failure policy:
//       * Fewer than 3 failures per batch: skip the failing entry, continue.
//       * 3 or more failures per batch: halt the batch and report.
//   - Env vars required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
//     FIREBASE_PRIVATE_KEY (same as the rest of the codebase). Script exits
//     early with a clear error if any are missing.
//
// TODO (follow-up, out of scope for this script): When the DKB loader in
// api/_utils/voiceLayerPrompt.js is built, it will query this collection and a
// composite index on (type ASC, status ASC) will likely be required. Add that
// index to firestore.indexes.json once the loader's exact query shape is
// finalized.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';

const COLLECTION = 'domainKnowledge';
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const REQUIRED_TOP_LEVEL = ['id', 'type', 'status', 'fullEntry', 'injection', 'gemmaDirective'];
const VALID_TYPES = new Set(['quant', 'thematic']);

function assertEnv() {
  const missing = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']
    .filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    console.error('Source your .env (or Vercel env) before running.');
    process.exit(1);
  }
}

function validateEntry(entry) {
  const issues = [];
  for (const field of REQUIRED_TOP_LEVEL) {
    if (entry[field] === undefined || entry[field] === null) {
      issues.push(`missing required field: ${field}`);
    }
  }
  if (entry.type && !VALID_TYPES.has(entry.type)) {
    issues.push(`invalid type "${entry.type}" (expected "quant" or "thematic")`);
  }
  if (entry.gemmaDirective) {
    if (entry.gemmaDirective.battle === undefined) {
      issues.push('missing gemmaDirective.battle');
    }
    if (entry.gemmaDirective.workshop === undefined) {
      issues.push('missing gemmaDirective.workshop');
    }
  }
  if (typeof entry.injection !== 'string') {
    issues.push('injection must be a string');
  }
  return issues;
}

function coerceTimestampValue(value) {
  if (value === null || value === 'SERVER_TIMESTAMP') {
    return FieldValue.serverTimestamp();
  }
  if (typeof value === 'string' && ISO_REGEX.test(value)) {
    return new Date(value);
  }
  return value;
}

function normalizeTimestamps(entry) {
  const out = { ...entry };
  if ('createdAt' in out) out.createdAt = coerceTimestampValue(out.createdAt);
  if ('updatedAt' in out) out.updatedAt = coerceTimestampValue(out.updatedAt);
  if (out.platformValidation && typeof out.platformValidation === 'object') {
    const pv = { ...out.platformValidation };
    if ('lastValidated' in pv) pv.lastValidated = coerceTimestampValue(pv.lastValidated);
    out.platformValidation = pv;
  }
  return out;
}

async function uploadBatch(filePath) {
  const absPath = resolve(process.cwd(), filePath);
  let raw;
  try {
    raw = readFileSync(absPath, 'utf8');
  } catch (err) {
    console.error(`Could not read batch file: ${absPath}`);
    console.error(err.message);
    process.exit(1);
  }

  let entries;
  try {
    entries = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON in batch file: ${absPath}`);
    console.error(err.message);
    process.exit(1);
  }

  if (!Array.isArray(entries)) {
    console.error('Batch file must contain a JSON array of entries.');
    process.exit(1);
  }

  console.log(`\nLoaded ${entries.length} entries from ${absPath}`);
  console.log(`Target collection: ${COLLECTION}\n`);

  const db = getFirebaseAdmin();
  const results = {
    uploaded: [],
    skippedExisting: [],
    failedValidation: [],
    failedWrite: [],
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const label = `[${i + 1}/${entries.length}] ${entry?.id ?? '<no id>'}`;

    if (results.failedValidation.length >= 3) {
      console.error(`\nAborting batch: 3+ validation failures indicate a systemic paste issue.`);
      break;
    }

    const issues = validateEntry(entry);
    if (issues.length) {
      console.error(`${label} ✗ validation failed: ${issues.join('; ')}`);
      results.failedValidation.push({ id: entry?.id ?? null, issues });
      continue;
    }

    const docRef = db.collection(COLLECTION).doc(entry.id);

    let existing;
    try {
      existing = await docRef.get();
    } catch (err) {
      console.error(`${label} ✗ pre-existence check failed: ${err.message}`);
      results.failedWrite.push({ id: entry.id, error: err.message });
      continue;
    }

    if (existing.exists) {
      console.warn(`${label} ⚠ already exists — skipping (no overwrite without confirmation)`);
      results.skippedExisting.push(entry.id);
      continue;
    }

    const payload = normalizeTimestamps(entry);

    try {
      await docRef.set(payload);
      console.log(`${label} ✓ uploaded (type=${entry.type})`);
      results.uploaded.push(entry.id);
    } catch (err) {
      console.error(`${label} ✗ write failed: ${err.message}`);
      results.failedWrite.push({ id: entry.id, error: err.message });
    }
  }

  const successful = results.uploaded.length;
  const failed = results.failedValidation.length + results.failedWrite.length;
  const skipped = results.skippedExisting.length;

  console.log(`\n--- Batch report ---`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed} (validation: ${results.failedValidation.length}, write: ${results.failedWrite.length})`);
  console.log(`Skipped (already exists): ${skipped}`);

  if (results.uploaded.length) {
    console.log(`\nUploaded IDs:`);
    for (const id of results.uploaded) console.log(`  - ${id}`);
  }
  if (results.skippedExisting.length) {
    console.log(`\nSkipped (existing) IDs:`);
    for (const id of results.skippedExisting) console.log(`  - ${id}`);
  }
  if (results.failedValidation.length) {
    console.log(`\nValidation failures:`);
    for (const f of results.failedValidation) {
      console.log(`  - ${f.id ?? '<no id>'}: ${f.issues.join('; ')}`);
    }
  }
  if (results.failedWrite.length) {
    console.log(`\nWrite failures:`);
    for (const f of results.failedWrite) {
      console.log(`  - ${f.id}: ${f.error}`);
    }
  }

  return results;
}

async function verifyCollection() {
  const db = getFirebaseAdmin();
  console.log(`\nReading all docs from ${COLLECTION}...\n`);
  const snap = await db.collection(COLLECTION).get();

  const byType = { quant: [], thematic: [], other: [] };
  snap.forEach((doc) => {
    const data = doc.data() ?? {};
    const type = data.type;
    const row = { id: doc.id, type: type ?? '<missing>' };
    if (type === 'quant') byType.quant.push(row);
    else if (type === 'thematic') byType.thematic.push(row);
    else byType.other.push(row);
  });

  console.log(`Total docs: ${snap.size}`);
  console.log(`  quant:    ${byType.quant.length}`);
  console.log(`  thematic: ${byType.thematic.length}`);
  if (byType.other.length) {
    console.log(`  other:    ${byType.other.length} (unexpected)`);
  }

  console.log(`\nQuant entries:`);
  for (const r of byType.quant) console.log(`  - ${r.id}`);
  console.log(`\nThematic entries:`);
  for (const r of byType.thematic) console.log(`  - ${r.id}`);
  if (byType.other.length) {
    console.log(`\nUnexpected-type entries:`);
    for (const r of byType.other) console.log(`  - ${r.id} (type=${r.type})`);
  }

  const expected = 16;
  const expectedSplit = 8;
  const countsOk = snap.size === expected
    && byType.quant.length === expectedSplit
    && byType.thematic.length === expectedSplit;

  console.log(`\nExpected: ${expected} total (${expectedSplit} quant + ${expectedSplit} thematic)`);
  console.log(countsOk ? 'Read-check: PASS' : 'Read-check: MISMATCH');
}

async function main() {
  assertEnv();

  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage:');
    console.error('  node scripts/uploadDKB.js <path-to-batch.json>');
    console.error('  node scripts/uploadDKB.js --verify');
    process.exit(1);
  }

  if (arg === '--verify') {
    await verifyCollection();
  } else {
    await uploadBatch(arg);
  }
}

main().catch((err) => {
  console.error('\nFatal error:');
  console.error(err);
  process.exit(1);
});
