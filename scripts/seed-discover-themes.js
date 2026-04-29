// scripts/seed-discover-themes.js
//
// Idempotent uploader for the discoverThemes Firestore collection.
//
// Reads each *.json file from dkb/thematic/, validates it against the
// expected DKB schema, transforms the DKB shape → discoverThemes shape
// per the Sprint 0 mapping, and writes one document per file using a
// deterministic doc ID (theme_<snake_id>) so re-runs overwrite cleanly.
//
// USAGE (from project root):
//   node scripts/seed-discover-themes.js --dry-run
//   node scripts/seed-discover-themes.js
//
// FLAGS:
//   --dry-run    Print the planned writes (no Firestore mutation, no
//                firebase-admin init, no .env.local read).
//
// ENV (loaded from .env.local at project root, live runs only):
//   FIREBASE_ADMIN_CREDENTIALS — single-line stringified service-account
//                                JSON. Same env var the existing
//                                scripts/test-signal-drop-pipeline.js
//                                already uses.
//
// IDEMPOTENCY:
//   Live writes use set() against a deterministic doc ID. createdAt is
//   preserved across re-runs (read existing doc, carry the value
//   forward); updatedAt is always refreshed. Re-running on the same
//   inputs converges to the same final document state.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const THEMATIC_DIR = path.join(PROJECT_ROOT, 'dkb', 'thematic');

// Manual per Flash. Files whose derived doc ID is missing here fail
// validation (signals an unexpected new theme that needs a slot).
const DISPLAY_ORDER = {
  theme_ai_infrastructure_buildout: 1,
  theme_reshoring: 2,
  theme_energy_transition: 3,
  theme_aging_demographics: 4,
  theme_housing_cycle: 5,
  theme_consumer_bifurcation: 6,
  theme_cybersecurity_buildout: 7,
  theme_dollar_strength_regimes: 8,
};

const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------
// Env + flags
// ---------------------------------------------------------------------

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

function parseCliFlags(argv) {
  const flags = { dryRun: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/seed-discover-themes.js [--dry-run]');
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${arg}`);
      process.exit(2);
    }
  }
  return flags;
}

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------

function deriveDocId(kebabId) {
  return `theme_${kebabId.replaceAll('-', '_')}`;
}

// Spec 2.4: take the substring up to the first ". ", append the period
// back. Falls back to the full thesis string when no sentence break is
// found.
function extractFirstSentence(thesis) {
  if (!thesis || typeof thesis !== 'string') return '';
  const idx = thesis.indexOf('. ');
  if (idx === -1) return thesis.trim();
  return `${thesis.slice(0, idx)}.`;
}

// ---------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------

function validateThemeFile(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('top-level value is not an object');
    return { valid: false, errors, docId: null };
  }

  if (!data.id || typeof data.id !== 'string') {
    errors.push(`missing 'id' field`);
  } else if (!KEBAB_RE.test(data.id)) {
    errors.push(`'id' is not kebab-case: "${data.id}"`);
  }

  const docId = data.id && KEBAB_RE.test(data.id) ? deriveDocId(data.id) : null;
  if (docId && !(docId in DISPLAY_ORDER)) {
    errors.push(`derived docId "${docId}" not in DISPLAY_ORDER lookup (unexpected new theme)`);
  }

  const fe = data.fullEntry || {};
  if (!fe.theme || typeof fe.theme !== 'string') {
    errors.push('missing fullEntry.theme');
  }

  if (!fe.tagline || typeof fe.tagline !== 'string') {
    errors.push('missing fullEntry.tagline');
  } else if (fe.tagline.length < 100 || fe.tagline.length > 300) {
    errors.push(`fullEntry.tagline length ${fe.tagline.length} outside 100-300 range`);
  }

  if (!Array.isArray(fe?.chain?.layers) || fe.chain.layers.length < 3) {
    errors.push('fullEntry.chain.layers must be array with length >= 3');
  } else if (fe.chain.layers.some(l => !l || typeof l.label !== 'string')) {
    errors.push('every chain layer must have a string label');
  }

  if (!Array.isArray(fe?.tickerEcosystem?.primary) || fe.tickerEcosystem.primary.length < 4) {
    errors.push('fullEntry.tickerEcosystem.primary must be array with length >= 4');
  }

  if (!Array.isArray(fe.subAngles) || fe.subAngles.length < 1) {
    errors.push('fullEntry.subAngles must be non-empty array');
  } else if (fe.subAngles.some(sa => !sa || typeof sa.angle !== 'string' || typeof sa.thesis !== 'string')) {
    errors.push('every subAngle must have string `angle` and `thesis` fields');
  }

  if (!data.workshopSeedPrompt || typeof data.workshopSeedPrompt !== 'string') {
    errors.push('missing top-level workshopSeedPrompt');
  }

  if (!Array.isArray(data.triggerKeywords)) {
    errors.push('missing top-level triggerKeywords array');
  }

  return { valid: errors.length === 0, errors, docId };
}

// ---------------------------------------------------------------------
// Transform DKB → discoverThemes doc
// ---------------------------------------------------------------------

function transformToDoc(data, FieldValue) {
  const docId = deriveDocId(data.id);
  const fe = data.fullEntry;
  const primary = fe.tickerEcosystem.primary;
  const title = fe.theme;

  const subAngles = fe.subAngles.map(sa => {
    const sentence = extractFirstSentence(sa.thesis);
    return `${sa.angle}: ${sentence}`;
  });

  const chain = fe.chain.layers.map(l => l.label);

  const ts = FieldValue ? FieldValue.serverTimestamp() : '<serverTimestamp>';

  return {
    docId,
    doc: {
      id: docId,
      title,
      narrative: fe.tagline,
      chain,
      tickers: primary,
      subAngles,
      workshopSeedContext: {
        contextBlock: data.workshopSeedPrompt,
        tickerSeed: primary,
        metadata: {
          source: 'discoverTheme',
          themeId: docId,
          themeTitle: title,
          triggerKeywords: data.triggerKeywords,
        },
      },
      isLiveThisWeek: false,
      liveSignalReason: null,
      displayOrder: DISPLAY_ORDER[docId],
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    },
  };
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const flags = parseCliFlags(process.argv);
  console.log(flags.dryRun ? '=== DRY RUN — no Firestore writes ===' : '=== LIVE RUN ===');
  console.log(`Source dir: ${path.relative(PROJECT_ROOT, THEMATIC_DIR)}/`);

  if (!existsSync(THEMATIC_DIR)) die(`thematic dir not found: ${THEMATIC_DIR}`);
  const files = readdirSync(THEMATIC_DIR).filter(f => f.endsWith('.json')).sort();
  console.log(`Detected ${files.length} JSON file(s):`);
  for (const f of files) console.log(`  - ${f}`);

  // Init firebase-admin only when actually writing
  let db = null;
  let FieldValue = null;
  if (!flags.dryRun) {
    const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
    const FIREBASE_ADMIN_CREDENTIALS =
      env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
    if (!FIREBASE_ADMIN_CREDENTIALS) die('FIREBASE_ADMIN_CREDENTIALS not found in .env.local');
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(FIREBASE_ADMIN_CREDENTIALS);
    } catch (err) {
      die(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${err.message}`);
    }
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const firestoreModule = await import('firebase-admin/firestore');
    if (getApps().length === 0) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    db = firestoreModule.getFirestore();
    FieldValue = firestoreModule.FieldValue;
    console.log(`firebase-admin initialized for project: ${serviceAccount.project_id}`);
  }

  let validationFailures = 0;
  let writeSuccess = 0;
  let writeFailures = 0;
  const skipped = [];
  const planned = [];

  for (const fileName of files) {
    const filePath = path.join(THEMATIC_DIR, fileName);
    let data;
    try {
      data = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`\n[SKIP] ${fileName}: failed to parse JSON — ${err.message}`);
      validationFailures++;
      skipped.push({ fileName, reason: `parse: ${err.message}` });
      continue;
    }

    const { valid, errors, docId } = validateThemeFile(data);
    if (!valid) {
      console.error(`\n[SKIP] ${fileName}: validation failed`);
      for (const e of errors) console.error(`  - ${e}`);
      validationFailures++;
      skipped.push({ fileName, reason: errors.join('; ') });
      continue;
    }

    const { doc } = transformToDoc(data, FieldValue);
    planned.push({ fileName, docId, data });

    if (flags.dryRun) {
      console.log(`\n[PLAN] ${fileName} → discoverThemes/${docId}`);
      console.log(`  title:        ${doc.title}`);
      console.log(`  displayOrder: ${doc.displayOrder}`);
      console.log(`  tickers:      [${doc.tickers.join(', ')}]`);
      console.log(`  chain:        ${doc.chain.length} layer(s) — ${doc.chain.map(l => `"${l}"`).join(', ')}`);
      console.log(`  subAngles:    ${doc.subAngles.length}`);
      console.log(`  triggerKW:    ${doc.workshopSeedContext.metadata.triggerKeywords.length} keyword(s)`);
    } else {
      try {
        const ref = db.collection('discoverThemes').doc(docId);
        const snap = await ref.get();
        const writeDoc = snap.exists
          ? { ...doc, createdAt: snap.get('createdAt') ?? doc.createdAt }
          : doc;
        await ref.set(writeDoc);
        const action = snap.exists ? 'UPDATED' : 'CREATED';
        console.log(`[${action}] discoverThemes/${docId}`);
        writeSuccess++;
      } catch (err) {
        console.error(`[WRITE-FAIL] discoverThemes/${docId}: ${err.message}`);
        writeFailures++;
        // Stop on first write failure per Sprint 0 spec 3.1
        break;
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`  Files detected:       ${files.length}`);
  console.log(`  Validation failures:  ${validationFailures}`);
  if (flags.dryRun) {
    console.log(`  Planned writes:       ${planned.length}`);
  } else {
    console.log(`  Successful writes:    ${writeSuccess}`);
    console.log(`  Write failures:       ${writeFailures}`);
  }
  if (skipped.length) {
    console.log('\n  Skipped:');
    for (const s of skipped) console.log(`    - ${s.fileName}: ${s.reason}`);
  }

  // Show one full sample doc on dry-run for schema review
  if (flags.dryRun) {
    const SAMPLE_DOC_ID = 'theme_ai_infrastructure_buildout';
    const sample = planned.find(p => p.docId === SAMPLE_DOC_ID);
    if (sample) {
      console.log(`\n=== SAMPLE FULL DOC: discoverThemes/${SAMPLE_DOC_ID} ===`);
      const { doc } = transformToDoc(sample.data, null);
      console.log(JSON.stringify(doc, null, 2));
    } else {
      console.log(`\n[note] sample doc ${SAMPLE_DOC_ID} not in planned writes`);
    }
  }

  if (validationFailures > 0 || writeFailures > 0) process.exit(1);
}

main().catch(err => {
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
});
