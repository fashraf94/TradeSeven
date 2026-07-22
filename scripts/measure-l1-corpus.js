#!/usr/bin/env node
// scripts/measure-l1-corpus.js
//
// Agent Learning System L1 — the M1–M9 MEASUREMENT RUNNER, executable.
// READ-ONLY. Reads the captured learning receipts from Firestore and runs the
// pure measureCorpus() over them, printing the M1–M9 report Flash relays to the
// founder. It NEVER writes to Firestore. It contains NO measurement logic of its
// own — it is a thin runner over api/_utils/learning/measureCorpus.js. If a
// number is missing or wrong, fix it in that pure function (with a unit test),
// not here.
//
// OUTCOME-BLIND, ABSOLUTELY: measureCorpus reads only predicate class labels,
// null rates, staleness, provenance, and opportunity counts. No return / regret /
// contrast / effect / P&L / win-loss is read — the receipt schema carries none.
//
// USAGE (from project root):
//   node scripts/measure-l1-corpus.js                    # full collection-group scan
//   node scripts/measure-l1-corpus.js --battle <id>      # only one battle's receipts
//   node scripts/measure-l1-corpus.js --limit 2000       # most-recent N by capturedAt
//   node scripts/measure-l1-corpus.js --w-grid 5,10,15,30,60   # inject the M8 W grid (minutes)
//   node scripts/measure-l1-corpus.js --json             # dump the raw result object (for pasting real numbers)
//
// NOTE on M8: the W grid is UNCALIBRATED and INJECTED (detectorClassifiers.js).
// The default grid is a measurement convenience, NOT a calibration. Pass the
// contract's real P-W-GRID via --w-grid when it is set.
//
// NOTE on completeness: M8 (per-battle-day opportunities, span2) reasons across
// receipts within a battle, so a truncating --limit can undercount. Prefer a full
// scan (no --limit) or --battle for the D3 numbers.
//
// ENV (matches scripts/preflight-capture-check.js / calibration/export-agent-battles.js):
//   FIREBASE_ADMIN_CREDENTIALS — the service-account JSON, in .env.local or the
//   environment. **Point it at the PREVIEW project, NEVER production.** The script
//   prints the project_id it connected to — CONFIRM it is the preview project
//   before trusting the result.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { measureCorpus, DEFAULT_W_GRID_MINUTES } from '../api/_utils/learning/measureCorpus.js';

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
  const flags = { limit: null, battle: null, wGridMinutes: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') flags.limit = Number(argv[++i]);
    else if (a === '--battle') flags.battle = argv[++i];
    else if (a === '--w-grid') flags.wGridMinutes = String(argv[++i]).split(',').map((s) => Number(s.trim()));
    else if (a === '--json') flags.json = true;
    else if (a === '--help' || a === '-h') flags.help = true;
    else die(`Unknown flag: ${a} (see the header for usage)`);
  }
  if (flags.limit !== null && (!Number.isInteger(flags.limit) || flags.limit < 1)) die(`--limit must be a positive integer, got ${flags.limit}`);
  if (flags.wGridMinutes && flags.wGridMinutes.some((w) => !Number.isFinite(w) || w <= 0)) die(`--w-grid must be positive minutes, got ${argv}`);
  return flags;
}

/** Recursively convert Firestore Timestamps → ISO strings so measurement is plain JSON. */
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

// ── formatting (pure) ────────────────────────────────────────────────────────

const pct = (x) => (x === null || x === undefined ? '  —  ' : `${(x * 100).toFixed(1)}%`);
const ms = (x) => (x === null || x === undefined ? '—' : `${(x / 60000).toFixed(1)}m`);
const num = (x) => (x === null || x === undefined ? '—' : String(x));
const J = (x) => JSON.stringify(x);

function d1Row(cls, cols) {
  const cell = (c) => `${String(c.counts[cls] ?? 0).padStart(5)} (${pct(c.shares[cls])})`;
  return `    ${cls.padEnd(14)} ${cols.map(cell).join('   ')}`;
}

export function formatReport({ flags, projectId, result }) {
  const L = [];
  const { meta, m1, m2, m3, m4, m5, m6, m7, m8, m9, dataQuality } = result;

  L.push('══════════════════════════════════════════════════════════════');
  L.push('  L1 — M1–M9 MEASUREMENT  (OUTCOME-BLIND · READ-ONLY · live_agent only)');
  L.push('══════════════════════════════════════════════════════════════');
  L.push(`  project: ${projectId}   (CONFIRM this is the PREVIEW project)`);
  L.push(`  source:  ${flags.battle ? `learningReceipts/${flags.battle}/receipts` : 'collectionGroup(receipts) → learningReceipts/*'}${flags.limit ? ` · most-recent ${flags.limit}` : ' · full scan'}`);
  L.push('');
  L.push('  CORPUS');
  L.push(`    total receipts:     ${meta.totalReceipts}`);
  L.push(`    live_agent (N):     ${meta.liveAgentReceipts}   ← the measurement denominator`);
  L.push(`    excluded:           ${meta.excludedCount}  ${J(meta.excludedByClass)}`);
  L.push(`    entry legs:         ${meta.entryLegs}${meta.roleAnomalies ? `   (⚠ ${meta.roleAnomalies} role anomalies)` : ''}`);
  if (meta.liveAgentReceipts === 0) {
    L.push('');
    L.push('  ✗ NO live_agent receipts — nothing to measure. (Capture flag on in preview? Right battle?)');
    return L.join('\n');
  }
  L.push('');

  // M1
  const cols = [m1.asSpecced, m1.drAbstain, m1.abstainBlueSkyOnly];
  L.push(`  M1 — D1 class distribution, three rules  [N=${m1.n} entries · distributional]`);
  L.push(`    ${''.padEnd(14)} ${'as-specced'.padEnd(13)}    ${'dR-abstain'.padEnd(12)}    abstain/blue-sky`);
  for (const cls of ['EXTENDED', 'ROOM', 'INDETERMINATE', 'UNSCORABLE']) L.push(d1Row(cls, cols));
  L.push(`    clears coverage gates (UNSCORABLE≤15%, INDETERMINATE≤40%):`);
  L.push(`       as-specced=${num(m1.asSpecced.clearsGates)}  dR-abstain=${num(m1.drAbstain.clearsGates)}  abstain/blue-sky=${num(m1.abstainBlueSkyOnly.clearsGates)}`);
  L.push('');

  // M2
  L.push(`  M2 — dR null decomposition  [N=${m2.n} null-dR entries of ${m2.nEntries} · structural]`);
  L.push(`    dR null share of entries: ${pct(m2.drNullShareOfEntries)}`);
  L.push(`    blue_sky: ${m2.byReason.blue_sky ?? 0} (${pct(m2.blueSkyShare)})   ambiguous: ${m2.byReason.ambiguous ?? 0} (${pct(m2.ambiguousShare)})`);
  if (m2.presentAmongNulls) L.push(`    ⚠ ${m2.presentAmongNulls} entries labelled 'present' despite null dR — capture defect`);
  L.push('    → mostly ambiguous ⇒ abstain silently absorbs missing data (fix suspect). mostly blue_sky ⇒ abstain honest.');
  L.push('');

  // M3
  L.push(`  M3 — asymmetric-evidence check (EXTENDED rate under abstain)  [structural]`);
  L.push(`    blue_sky group (2-of-2): ${m3.blueSky.extended}/${m3.blueSky.n} = ${pct(m3.blueSky.extendedRate)}`);
  L.push(`    present  group (2-of-3): ${m3.present.extended}/${m3.present.n} = ${pct(m3.present.extendedRate)}`);
  L.push(`    ambiguous group:         ${m3.ambiguous.extended}/${m3.ambiguous.n} = ${pct(m3.ambiguous.extendedRate)}`);
  L.push('    → a materially higher blue_sky rate = the abstain rule imports an evidence-bar bias.');
  L.push('');

  // M4
  L.push(`  M4 — predicate staleness  [N=${m4.n} non-null · structural]`);
  L.push(`    median ${ms(m4.medianMs)}   p90 ${ms(m4.p90Ms)}   max ${ms(m4.maxMs)}   min ${ms(m4.minMs)}`);
  L.push(`    exceed 15m ${pct(m4.exceedShare['15min'])}   30m ${pct(m4.exceedShare['30min'])}   45m ${pct(m4.exceedShare['45min'])}`);
  L.push(`    negative (clock-skew) share: ${pct(m4.negativeShare)} (${m4.negativeCount})  · null-staleness share: ${pct(m4.nullStalenessShare)}`);
  L.push('');

  // M5
  L.push(`  M5 — staleness × class  [N=${m5.n} · ${m5.smdReliable ? 'SMD reliable' : 'SMD thin — medians only'}]`);
  for (const cls of ['EXTENDED', 'ROOM', 'INDETERMINATE', 'UNSCORABLE']) {
    const c = m5.perClass[cls];
    L.push(`    ${cls.padEnd(14)} n=${String(c.n).padStart(4)}  median ${ms(c.medianMs)}`);
  }
  L.push(`    SMD(EXTENDED vs ROOM) = ${m5.smdExtendedVsRoom === null ? '— (too thin)' : m5.smdExtendedVsRoom.toFixed(3)}  ${m5.smdReliable ? '' : `(needs ≥${m5.smdBasis.minPerGroupForSmd}/group; have ${m5.smdBasis.extendedN}/${m5.smdBasis.roomN})`}`);
  L.push('');

  // M6
  L.push(`  M6 — symbol-hour clustering  [N=${m6.nWithKey} keyed of ${m6.n} · structural→distributional]`);
  L.push(`    distinct keys ${m6.distinctKeys}   max cluster ${m6.maxClusterSize}   share sharing a key ${pct(m6.sharedKeyShare)}`);
  L.push(`    null-key share ${pct(m6.nullKeyShare)}   cluster-size histogram ${J(m6.sizeHistogram)}`);
  L.push('    → a high shared share ⇒ the estimator needs a symbol-hour independence unit.');
  L.push('');

  // M7
  L.push(`  M7 — D2 confirmation, entry-weighted  [N=${m7.n} · structural]`);
  L.push(`    upDayVolRatio ≥ ${m7.upDayVolRatio.threshold} pass rate: ${m7.upDayVolRatio.passRateOfNonNull === null ? '—' : pct(m7.upDayVolRatio.passRateOfNonNull)} of ${m7.upDayVolRatio.nNonNull} non-null (${m7.upDayVolRatio.nNull} null)`);
  L.push(`    D2 UNSCORABLE share (intraday rule): ${pct(m7.d2UnscorableShare)}   CONFIRMED: ${pct(m7.d2ConfirmedShare)}`);
  L.push(`    dataMode==='intraday' share: ${pct(m7.intradayShare)}   D2 classes ${J(m7.d2ClassCounts)}`);
  L.push('');

  // M8
  L.push(`  M8 — D3 opportunity counts  [N=${m8.n} legs · ${m8.distinctBattleDays} battle-days · structural]`);
  L.push(`    regime (symbolOut): ${J(m8.regime.symbolOut)}`);
  L.push(`    choppy present: ${num(m8.regime.choppyPresent)}   choppy share of legs-with-regime: ${pct(m8.regime.choppyShareOfLegsWithRegime)}`);
  L.push(`    W grid (min, UNCALIBRATED/injected): ${J(m8.windowGridMinutes)}   scope: ${m8.countingScope}`);
  L.push(`    ${'W(min)'.padStart(7)} ${'opps'.padStart(6)} ${'opps/battle-day'.padStart(16)} ${'chop'.padStart(6)} ${'churn≥2'.padStart(8)}`);
  for (const w of m8.perW) {
    L.push(`    ${String(w.windowMinutes).padStart(7)} ${String(w.opportunities).padStart(6)} ${(w.opportunitiesPerBattleDay === null ? '—' : w.opportunitiesPerBattleDay.toFixed(2)).padStart(16)} ${String(w.chopCount).padStart(6)} ${String(w.churnStateCount).padStart(8)}`);
  }
  L.push(`    span2 (t_i − t_(i−2)):  median ${ms(m8.span2.medianMs)}   p90 ${ms(m8.span2.p90Ms)}   min ${ms(m8.span2.minMs)}   (n=${m8.span2.n})`);
  L.push(`    trades[] truncation rate: ${pct(m8.truncation.truncationRate)} (${m8.truncation.truncatedCount}/${m8.truncation.n})`);
  L.push('');

  // M9
  L.push(`  M9 — version-stamp & provenance  [N=${m9.n} · structural]`);
  const nonNullVersions = Object.entries(m9.versions).filter(([, v]) => v.nonNullCount > 0).map(([k, v]) => `${k}=${v.nonNullCount}${v.distinctValues.length ? ` ${J(v.distinctValues)}` : ''}`);
  const nullVersions = Object.entries(m9.versions).filter(([, v]) => v.nonNullCount === 0).map(([k]) => k);
  L.push(`    versions non-null: ${nonNullVersions.length ? nonNullVersions.join(', ') : '(none)'}`);
  L.push(`    versions still null: ${nullVersions.join(', ') || '(none)'}`);
  L.push(`    entrySnapshotSource: ${J(m9.entrySnapshotSource)}`);
  L.push(`    entryAtrSource:      ${J(m9.entryAtrSource)}`);
  L.push(`    archetype identity:  ${J(m9.archetype)}   archetypeVersion non-null: ${m9.archetypeVersionNonNull}`);
  L.push('');

  // Data-quality guard
  L.push('  DATA-QUALITY GUARD (capture-consistency; re-derives D1 labels from raw inputs)');
  L.push(`    d1 as-specced mismatches: ${dataQuality.d1AsSpeccedMismatch}   dR-abstain mismatches: ${dataQuality.d1DrAbstainMismatch}   ${dataQuality.clean ? '✓ clean' : '✗ DRIFT — captured labels disagree with the frozen classifier'}`);
  L.push('');
  L.push('  (Structural = robust at small N; distributional = needs a large, and eventually archetype-aware, corpus.)');
  return L.join('\n');
}

// ── runner ───────────────────────────────────────────────────────────────────

async function fetchReceipts(db, flags) {
  const base = flags.battle
    ? db.collection('learningReceipts').doc(flags.battle).collection('receipts')
    : db.collectionGroup('receipts');
  const onlyLearning = (docs) => (flags.battle ? docs : docs.filter((d) => d.ref.path.startsWith('learningReceipts/')));

  if (flags.limit) {
    try {
      const snap = await base.orderBy('capturedAt', 'desc').limit(flags.limit).get();
      return onlyLearning(snap.docs).map((d) => serialize(d.data()));
    } catch (err) {
      console.warn(`  (ordered query unavailable — ${String(err.message).split('\n')[0]}; falling back to full fetch + client sort)`);
      const snap = await base.get();
      const all = onlyLearning(snap.docs).map((d) => serialize(d.data()));
      all.sort((a, b) => String(b.capturedAt || '').localeCompare(String(a.capturedAt || '')));
      return all.slice(0, flags.limit);
    }
  }
  // Full scan (measurement default) — the whole corpus in scope.
  const snap = await base.get();
  return onlyLearning(snap.docs).map((d) => serialize(d.data()));
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
  const opts = flags.wGridMinutes ? { wGridMinutes: flags.wGridMinutes } : {};
  const result = measureCorpus(receipts, opts);

  if (flags.json) {
    console.log(JSON.stringify({ projectId: serviceAccount.project_id, wGridDefault: DEFAULT_W_GRID_MINUTES, result }, null, 2));
    return;
  }
  console.log(formatReport({ flags, projectId: serviceAccount.project_id, result }));
}

// Runner only — guarded so tests can import the pure helpers without a DB.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => die(err.stack || err.message));
}
