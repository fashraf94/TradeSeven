#!/usr/bin/env node
// scripts/preflight-capture-check.js
//
// Agent Learning System L1 — the CAPTURE-RUN GATE, executable.
// READ-ONLY. Reads the most recent learning receipts from Firestore and runs the
// pure validateCaptureSample() over them, so a founder can gate a multi-day
// capture: SHORT capture → this script → only start the LONG run if it PASSES.
// It never writes to Firestore. It contains NO validation logic of its own — it
// is a thin runner over api/_utils/learning/preflightReceiptCheck.js. If a check
// is missing, add it to that pure function (with a unit test), not here.
//
// USAGE (from project root):
//   node scripts/preflight-capture-check.js                 # 25 most-recent receipts, collection-group
//   node scripts/preflight-capture-check.js --limit 50      # most-recent 50
//   node scripts/preflight-capture-check.js --battle <id>   # only one battle's receipts
//
// ENV (matches scripts/calibration/export-agent-battles.js / rule-compat-cleanup.js):
//   FIREBASE_ADMIN_CREDENTIALS — the service-account JSON, in .env.local or the
//   environment. **Point it at the PREVIEW project, NEVER production.** The script
//   prints the project_id it connected to — CONFIRM it is the preview project
//   before trusting the result. (Capture runs behind LEARNING_L1_CAPTURE_ENABLED,
//   which is on only in preview.)
//
// EXIT CODE / DECISION:
//   0 = PASS  → the sample is structurally sound; proceed to the long capture run.
//   1 = FAIL  → a field is silently null/broken; FIX CAPTURE before the long run,
//               or the multi-day window is wasted. The report names the offending
//               field and prints a sample bad receipt.
//   A PASS on a NARROW sample (one battle / one symbol) is a weak signal — the
//   report prints sample breadth so a narrow sample cannot masquerade as broad.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateCaptureSample } from '../api/_utils/learning/preflightReceiptCheck.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');

function die(msg) {
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
}

// ── pure helpers (exported for unit tests; no DB, no side effects) ───────────

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
  const flags = { limit: 25, battle: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') flags.limit = Number(argv[++i]);
    else if (a === '--battle') flags.battle = argv[++i];
    else if (a === '--help' || a === '-h') flags.help = true;
    else die(`Unknown flag: ${a} (see the header for usage)`);
  }
  if (!flags.help && (!Number.isInteger(flags.limit) || flags.limit < 1)) die(`--limit must be a positive integer, got ${flags.limit}`);
  return flags;
}

/** Recursively convert Firestore Timestamps → ISO strings so prints are plain JSON. */
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

function dist(receipts, getter) {
  const out = {};
  for (const r of receipts) {
    const k = getter(r);
    const key = k == null ? 'null' : String(k);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

/** Descriptive breadth of the sample (NOT a pass/fail gate — visibility only). */
export function sampleBreadth(receipts) {
  const battles = [...new Set(receipts.map((r) => r?.battleId).filter((x) => x != null))];
  const symbols = [...new Set(receipts.map((r) => r?.symbolIn).filter((x) => x != null))];
  return {
    count: receipts.length,
    battles,
    symbols,
    dataModeDist: dist(receipts, (r) => r?.predicateInputs?.symbolIn?.dataMode),
    drNullReasonDist: dist(receipts, (r) => r?.predicateClassification?.symbolIn?.drNullReason),
    narrow: battles.length <= 1 || symbols.length <= 1,
  };
}

/** For each failed error-check, the first offending receipt (deduped, ≤3). */
export function pickSampleBadReceipts(result, receipts) {
  const failed = (result.checks || []).filter((c) => c.level === 'error' && !c.pass);
  const byIndex = new Map();
  for (const c of failed) {
    const idx = c.offendingIndices && c.offendingIndices[0] != null ? c.offendingIndices[0] : 0;
    if (!byIndex.has(idx)) byIndex.set(idx, []);
    byIndex.get(idx).push(c.name);
  }
  return [...byIndex.entries()].slice(0, 3).map(([index, checkNames]) => ({ index, checkNames, receipt: receipts[index] }));
}

const ICON = { true: '✓', false: '✗' };
const LEVEL_ICON = { error: '✗', warn: '⚠', info: 'ℹ' };

/** Render the full human-readable report as a string (pure). */
export function formatReport({ flags, projectId, result, breadth, receipts }) {
  const L = [];
  L.push('══════════════════════════════════════════════════════════════');
  L.push(`  L1 CAPTURE PRE-FLIGHT — ${result.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  L.push('══════════════════════════════════════════════════════════════');
  L.push(`  project: ${projectId}   (CONFIRM this is PREVIEW, not production)`);
  L.push(`  source:  ${flags.battle ? `learningReceipts/${flags.battle}/receipts` : 'collectionGroup(receipts) → learningReceipts/*'} · limit ${flags.limit}`);
  L.push('');

  // Sample breadth — always printed; a narrow sample cannot masquerade as broad.
  L.push('  SAMPLE BREADTH');
  L.push(`    receipts:        ${breadth.count}`);
  L.push(`    distinct battles: ${breadth.battles.length}  [${breadth.battles.slice(0, 6).join(', ')}${breadth.battles.length > 6 ? ' …' : ''}]`);
  L.push(`    distinct symbols: ${breadth.symbols.length}  [${breadth.symbols.slice(0, 10).join(', ')}${breadth.symbols.length > 10 ? ' …' : ''}]`);
  L.push(`    dataMode:         ${JSON.stringify(breadth.dataModeDist)}`);
  L.push(`    drNullReason:     ${JSON.stringify(breadth.drNullReasonDist)}`);
  if (breadth.narrow) {
    L.push('    ⚠ NARROW SAMPLE — one battle and/or one symbol. A PASS here is a WEAK');
    L.push('      signal; widen the capture (more battles/symbols) before trusting it.');
  }
  L.push('');

  // Checks.
  L.push('  CHECKS');
  for (const c of result.checks) {
    const icon = c.pass ? (c.level === 'info' ? 'ℹ' : '✓') : LEVEL_ICON[c.level] || ICON[c.pass];
    const tag = c.level === 'warn' ? ' (warn)' : c.level === 'info' ? '' : c.pass ? '' : ' (ERROR)';
    L.push(`    ${icon} ${c.name}${tag}: ${c.detail}`);
  }
  L.push('');

  // Summary counts.
  L.push('  SUMMARY');
  for (const [k, v] of Object.entries(result.summary || {})) {
    L.push(`    ${k}: ${typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3) : JSON.stringify(v)}`);
  }
  L.push('');

  // On FAIL: name the offending field(s) + show sample bad receipt(s).
  if (!result.pass) {
    const samples = pickSampleBadReceipts(result, receipts);
    L.push('  DIAGNOSIS (why it failed)');
    for (const c of result.checks.filter((x) => x.level === 'error' && !x.pass)) {
      L.push(`    ✗ ${c.name}: ${c.detail}`);
    }
    L.push('');
    for (const s of samples) {
      L.push(`  SAMPLE BAD RECEIPT — index ${s.index} (flagged by: ${s.checkNames.join(', ')})`);
      L.push(indent(JSON.stringify(s.receipt ?? null, null, 2), 4));
      L.push('');
    }
    L.push('  → FIX CAPTURE before the long run. Do not burn the window on null fields.');
  } else {
    L.push('  → PASS. The sample is structurally sound; proceed to the long capture run.');
    if (breadth.narrow) L.push('    (…but see the NARROW SAMPLE warning above — consider widening first.)');
  }
  return L.join('\n');
}

function indent(s, n) {
  const pad = ' '.repeat(n);
  return s.split('\n').map((line) => pad + line).join('\n');
}

// ── runner ───────────────────────────────────────────────────────────────────

async function fetchReceipts(db, flags) {
  const base = flags.battle
    ? db.collection('learningReceipts').doc(flags.battle).collection('receipts')
    : db.collectionGroup('receipts');
  const onlyLearning = (docs) => (flags.battle ? docs : docs.filter((d) => d.ref.path.startsWith('learningReceipts/')));

  try {
    // Efficient path: most-recent by capturedAt (needs the single-field index,
    // which Firestore auto-provides for collection + collection-group scope).
    const snap = await base.orderBy('capturedAt', 'desc').limit(flags.limit).get();
    return onlyLearning(snap.docs).map((d) => serialize(d.data()));
  } catch (err) {
    // Fallback (e.g. index not yet built): fetch then client-sort. Correct at the
    // preview volumes this gate targets (a SHORT capture).
    console.warn(`  (ordered query unavailable — ${String(err.message).split('\n')[0]}; falling back to fetch-all + client sort)`);
    const snap = await base.get();
    const all = onlyLearning(snap.docs).map((d) => serialize(d.data()));
    all.sort((a, b) => String(b.capturedAt || '').localeCompare(String(a.capturedAt || '')));
    return all.slice(0, flags.limit);
  }
}

async function main() {
  const flags = parseArgs(process.argv);
  if (flags.help) {
    console.log(readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    return;
  }

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

  const receipts = await fetchReceipts(db, flags);
  if (receipts.length === 0) {
    console.log(formatReport({
      flags, projectId: serviceAccount.project_id,
      result: validateCaptureSample(receipts, { expectedDrNullRate: 0.59 }),
      breadth: sampleBreadth(receipts), receipts,
    }));
    die(flags.battle
      ? `no receipts found under learningReceipts/${flags.battle}/receipts (is the capture flag on in preview? right battle id?)`
      : 'no learning receipts found (is LEARNING_L1_CAPTURE_ENABLED on in preview, and has a battle run?)');
  }

  const result = validateCaptureSample(receipts, { expectedDrNullRate: 0.59 });
  const breadth = sampleBreadth(receipts);
  console.log(formatReport({ flags, projectId: serviceAccount.project_id, result, breadth, receipts }));
  process.exit(result.pass ? 0 : 1);
}

// Runner only — guarded so tests can import the pure helpers without a DB.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => die(err.stack || err.message));
}
