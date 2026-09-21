#!/usr/bin/env node
// scripts/export-tick-capture.js
//
// Tick capture — the EXPORT (spec docs/specs/CAPTURE_BUILD_SPEC_V1_3.md §7).
// READ-ONLY. It reads the two capture subcollections with the Admin SDK,
// writes a local JSONL file, and prints the three C-1 figures. It NEVER writes
// to Firestore — there is no Firestore write call in this file, and its test
// asserts that.
//
// It contains NO coverage arithmetic of its own: it is a thin runner over
// api/_utils/tickCapture/captureCoverage.js (the measure-l1-corpus.js
// precedent). If a number is missing or wrong, fix it there, with a unit test.
//
// USAGE (from the project root; runs from the Windows checkout unchanged —
// every path is built with node:path and nothing shells out):
//
//   node scripts/export-tick-capture.js --battle <battleId>
//   node scripts/export-tick-capture.js --from 2026-09-01 --to 2026-09-30
//   node scripts/export-tick-capture.js --battle <id> --out C:\tmp\ticks.jsonl
//   node scripts/export-tick-capture.js --battle <id> --resolve-unknown 41,42
//   node scripts/export-tick-capture.js --battle <id> --json
//
// COVERAGE IS ALWAYS EXACT, even for a date range: the range selects the
// BATTLES (a collection-group query on `ticks` by `capturedAt`), and then the
// runner reads each selected battle's FULL `ticks` subcollection plus its
// persisted `cronState.tickSeq`. Coverage is therefore always measured against
// a whole battle's counter, never against a window that cannot contain its own
// denominator. The JSONL, by contrast, carries only the ticks inside the
// window — the `--from/--to` dates filter the OUTPUT, not the denominator.
//
// BODIES EXPIRE. A permanent record whose `tickBodies` document is gone was
// deleted by the TTL policy: it is counted as EXPIRED, never as a gap, and its
// JSONL line carries `body: null`.
//
// ENV (matches scripts/measure-l1-corpus.js):
//   FIREBASE_ADMIN_CREDENTIALS — the service-account JSON, in .env.local or the
//   environment. The script prints the project_id it connected to — CONFIRM it
//   before trusting the result.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeCoverage, formatCoverageReport, toJsonlLine } from '../api/_utils/tickCapture/captureCoverage.js';
import { TICKS_SUBCOLLECTION, TICK_BODIES_SUBCOLLECTION } from '../api/_utils/tickCapture/captureConfig.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');

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
  const flags = { battle: null, from: null, to: null, out: null, json: false, help: false, resolveUnknown: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--battle') flags.battle = argv[++i];
    else if (a === '--from') flags.from = argv[++i];
    else if (a === '--to') flags.to = argv[++i];
    else if (a === '--out') flags.out = argv[++i];
    else if (a === '--resolve-unknown') flags.resolveUnknown = String(argv[++i] ?? '').split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
    else if (a === '--json') flags.json = true;
    else if (a === '--help' || a === '-h') flags.help = true;
  }
  return flags;
}

/** `--from/--to` are inclusive ET-agnostic ISO DATES; `to` covers its whole day. */
export function rangeBounds({ from, to }) {
  return {
    fromIso: from ? `${from}T00:00:00.000Z` : null,
    toIso: to ? `${to}T23:59:59.999Z` : null,
  };
}

/** Is this record's capturedAt inside the requested window? Null bounds are open. */
export function inWindow(capturedAt, { fromIso, toIso }) {
  if (typeof capturedAt !== 'string') return false;
  if (fromIso && capturedAt < fromIso) return false;
  if (toIso && capturedAt > toIso) return false;
  return true;
}

/** The default output path, inside the project, platform-correct. */
export function defaultOutPath(flags, now = new Date()) {
  const stamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const scope = flags.battle ? `battle-${flags.battle}` : `range-${flags.from || 'start'}-${flags.to || 'end'}`;
  return path.join(PROJECT_ROOT, 'scripts', 'test-results', `tick-capture-${scope}-${stamp}.jsonl`);
}

/**
 * The coverage input for ONE battle, from data a caller has already read.
 * Pure: the shape the runner hands `computeCoverage`.
 */
export function buildBattleInput({ battleId, mintedTickSeq, permanentDocs, bodyIds, reportedUnknown = [] }) {
  const present = bodyIds instanceof Set ? bodyIds : new Set(bodyIds || []);
  return {
    battleId,
    mintedTickSeq,
    reportedUnknown,
    ticks: (permanentDocs || []).map((d) => ({
      tickSeq: d?.tickSeq,
      dispatched: d?.model?.dispatched === true,
      bodyStatus: d?.body?.status ?? 'skipped',
      bodyPresent: present.has(d?.tickId),
    })),
  };
}

export function usage() {
  return [
    'export-tick-capture — READ-ONLY export of the tick capture record.',
    '',
    '  --battle <id>              one battle',
    '  --from <YYYY-MM-DD>        range start (inclusive)',
    '  --to <YYYY-MM-DD>          range end (inclusive)',
    '  --out <path>               JSONL destination (default: scripts/test-results/…)',
    '  --resolve-unknown a,b,c    tickSeqs a run logged as `timed_out`; each is',
    '                             resolved to landed/missing by PRESENCE',
    '  --json                     also print the raw totals object',
    '',
    'Writes NOTHING to Firestore.',
  ].join('\n');
}

// ── the runner (no coverage arithmetic lives here) ──────────────────────────

/**
 * Read every battle the scope names, with a reader object so the whole runner
 * is testable against doubles. The reader is READ-ONLY by construction: it
 * exposes no write method at all.
 *
 * @param {object} reader
 * @param {(battleId: string) => Promise<{mintedTickSeq: number}|null>} reader.readBattle
 * @param {(battleId: string) => Promise<object[]>} reader.readTicks
 * @param {(battleId: string) => Promise<string[]>} reader.readBodyIds
 * @param {(battleId: string, tickId: string) => Promise<object|null>} reader.readBody
 * @param {(bounds: object) => Promise<string[]>} reader.findBattleIds
 */
export async function runExport(reader, flags, { now = new Date() } = {}) {
  const bounds = rangeBounds(flags);
  const battleIds = flags.battle ? [flags.battle] : await reader.findBattleIds(bounds);

  const inputs = [];
  const lines = [];
  for (const battleId of battleIds) {
    const battleDoc = await reader.readBattle(battleId);
    const permanentDocs = await reader.readTicks(battleId);
    const bodyIds = new Set(await reader.readBodyIds(battleId));
    inputs.push(buildBattleInput({
      battleId,
      mintedTickSeq: battleDoc?.mintedTickSeq ?? 0,
      permanentDocs,
      bodyIds,
      reportedUnknown: flags.battle ? flags.resolveUnknown : [],
    }));

    for (const permanent of permanentDocs) {
      if ((flags.from || flags.to) && !inWindow(permanent?.capturedAt, bounds)) continue;
      const body = bodyIds.has(permanent?.tickId) ? await reader.readBody(battleId, permanent.tickId) : null;
      lines.push(toJsonlLine({ permanent, body }));
    }
  }

  const totals = computeCoverage(inputs);
  const outPath = flags.out ? path.resolve(flags.out) : defaultOutPath(flags, now);
  const scope = flags.battle ? `battle ${flags.battle}` : `${flags.from || 'start'} → ${flags.to || 'end'} (${battleIds.length} battle(s))`;
  return { totals, lines, outPath, scope, battleIds };
}

async function main() {
  const flags = parseArgs(process.argv);
  if (flags.help || (!flags.battle && !flags.from && !flags.to)) {
    console.log(usage());
    return;
  }

  const env = { ...parseEnvFile(path.join(PROJECT_ROOT, '.env.local')), ...process.env };
  const creds = env.FIREBASE_ADMIN_CREDENTIALS;
  if (!creds) {
    console.error('\nFATAL: FIREBASE_ADMIN_CREDENTIALS is not set (.env.local or the environment).');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(creds);
  console.log(`[export-tick-capture] project_id: ${serviceAccount.project_id} — CONFIRM this is the project you meant.`);

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // Every method here READS. There is deliberately no write method to call.
  const reader = {
    async readBattle(battleId) {
      const snap = await db.collection('agentBattles').doc(battleId).get();
      return snap.exists ? { mintedTickSeq: snap.data()?.cronState?.tickSeq ?? 0 } : null;
    },
    async readTicks(battleId) {
      const snap = await db.collection('agentBattles').doc(battleId).collection(TICKS_SUBCOLLECTION).orderBy('tickSeq').get();
      return snap.docs.map((d) => d.data());
    },
    async readBodyIds(battleId) {
      const snap = await db.collection('agentBattles').doc(battleId).collection(TICK_BODIES_SUBCOLLECTION).select().get();
      return snap.docs.map((d) => d.id);
    },
    async readBody(battleId, tickId) {
      const snap = await db.collection('agentBattles').doc(battleId).collection(TICK_BODIES_SUBCOLLECTION).doc(tickId).get();
      return snap.exists ? snap.data() : null;
    },
    async findBattleIds(bounds) {
      let q = db.collectionGroup(TICKS_SUBCOLLECTION);
      if (bounds.fromIso) q = q.where('capturedAt', '>=', bounds.fromIso);
      if (bounds.toIso) q = q.where('capturedAt', '<=', bounds.toIso);
      const snap = await q.select('battleId').get();
      return [...new Set(snap.docs.map((d) => d.data()?.battleId).filter(Boolean))];
    },
  };

  const { totals, lines, outPath, scope } = await runExport(reader, flags);
  writeFileSync(outPath, lines.length ? `${lines.join('\n')}\n` : '', 'utf8');
  console.log(`\n[export-tick-capture] wrote ${lines.length} record(s) to ${outPath}\n`);
  console.log(formatCoverageReport(totals, { scope }));
  if (flags.json) console.log(`\n${JSON.stringify(totals, null, 2)}`);
}

// CLI entrypoint only — importing this module runs nothing (the ws1-observe-walk precedent).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
