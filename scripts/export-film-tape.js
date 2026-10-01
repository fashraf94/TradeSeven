#!/usr/bin/env node
// scripts/export-film-tape.js
//
// Film Room tape — THE FOUNDER READ-OUT (spec docs/specs/
// FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md, BA-18). READ-ONLY. It reads
// tape documents and their series documents with the Admin SDK and prints them
// as markdown: every number labelled by its provenance class (BA-21), every
// section headed by its coverage line (BA-20), the series summarised. It NEVER
// writes to Firestore — there is no Firestore write call in this file, and its
// test asserts that. It fetches nothing: no market data, no model, no network
// beyond the Firestore reads.
//
// It reads REGARDLESS of FILM_TAPE_WRITE_ENABLED. It is read-only, so the flag
// is irrelevant to it; it does not import the flag module.
//
// It contains NO formatting of its own: it is a thin runner over
// api/_utils/filmTape/tapeExport.js (the export-tick-capture precedent). If a
// number is missing or mislabelled, fix it there, with a unit test.
//
// USAGE (from the project root; runs from the Windows checkout unchanged —
// every path is built with node:path and nothing shells out):
//
//   node scripts/export-film-tape.js --battle <battleId> --date 2026-09-24
//   node scripts/export-film-tape.js --battle <battleId> --recent 5
//   node scripts/export-film-tape.js --recent 5
//   node scripts/export-film-tape.js --battle <id> --date <etDate> --out C:\tmp\tape.md
//
// `--recent <n>` without `--battle` reads the n most recent tape days across
// every battle — a collection-group query ordered by `etDate`, which needs the
// collection-group `etDate` index listed in the A1 build report. With
// `--battle` it reads that battle's own subcollection (no extra index).
//
// Markdown goes to stdout (or to `--out`, a local UTF-8 file); everything
// else — the project line, the counts — goes to stderr, so a redirect captures
// only the read-out.
//
// ENV (matches scripts/export-tick-capture.js):
//   FIREBASE_ADMIN_CREDENTIALS — the service-account JSON, in .env.local or the
//   environment. The script prints the project_id it connected to — CONFIRM it
//   before trusting the result.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { formatTapeMarkdown } from '../api/_utils/filmTape/tapeExport.js';
import { TAPE_SUBCOLLECTION, SERIES_SUBCOLLECTION } from '../src/constants/filmTape.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');

/** The most tape days one `--recent` run reads. */
export const MAX_RECENT = 50;

const ET_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROLE_ORDER = ['held', 'sold', 'plan', 'market', 'sector'];

// ── pure helpers (exported for unit tests; no DB, no side effects) ───────────

export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

export function parseArgs(argv) {
  const flags = { battle: null, date: null, recent: null, out: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--battle') flags.battle = argv[++i] ?? null;
    else if (a === '--date') flags.date = argv[++i] ?? null;
    else if (a === '--recent') flags.recent = argv[++i] ?? null;
    else if (a === '--out') flags.out = argv[++i] ?? null;
    else if (a === '--help' || a === '-h') flags.help = true;
  }
  return flags;
}

/** What is wrong with the flags, in one line — or null when they name a read. */
export function argsProblem(flags) {
  if (flags.help) return null;
  if (flags.date !== null && flags.recent !== null) return 'use --date or --recent, not both';
  if (flags.date !== null) {
    if (!flags.battle) return '--date needs --battle <id>';
    if (!ET_DATE.test(flags.date)) return '--date must be an ET trading date, YYYY-MM-DD';
    return null;
  }
  if (flags.recent !== null) {
    const n = Number(flags.recent);
    if (!Number.isInteger(n) || n < 1 || n > MAX_RECENT) return `--recent must be a whole number from 1 to ${MAX_RECENT}`;
    return null;
  }
  return 'nothing to read: --battle <id> --date <YYYY-MM-DD>, or --recent <n> (optionally with --battle <id>)';
}

export function usage() {
  return [
    'export-film-tape — READ-ONLY founder read-out of Film Room tape days (BA-18).',
    '',
    '  --battle <id> --date <YYYY-MM-DD>   one tape day',
    '  --battle <id> --recent <n>          that battle\'s n most recent tape days',
    '  --recent <n>                        the n most recent tape days of any battle',
    `                                      (n from 1 to ${MAX_RECENT})`,
    '  --out <path>                        write the markdown to a local file (UTF-8)',
    '',
    'Writes NOTHING to Firestore. Reads regardless of FILM_TAPE_WRITE_ENABLED.',
  ].join('\n');
}

/** Series documents in reading order: held, sold, plan, market, sector; then by symbol. */
export function sortSeries(docs) {
  const rank = (r) => (ROLE_ORDER.includes(r) ? ROLE_ORDER.indexOf(r) : ROLE_ORDER.length);
  return [...docs].sort((a, b) => rank(a.role) - rank(b.role) || String(a.symbol).localeCompare(String(b.symbol)));
}

// ── the runner (no formatting lives here) ───────────────────────────────────

/**
 * Read the tape days the flags name and format them, with a reader object so
 * the whole runner is testable against doubles. The reader is READ-ONLY by
 * construction: it exposes no write method at all.
 *
 * @param {object} reader
 * @param {(battleId: string, etDate: string) => Promise<object|null>} reader.readTape
 * @param {(opts: { battleId: string|null, n: number }) => Promise<object[]>} reader.readRecentTapes
 * @param {(battleId: string, etDate: string) => Promise<object[]>} reader.readSeries
 */
export async function runExport(reader, flags) {
  let docs;
  if (flags.date) {
    const doc = await reader.readTape(flags.battle, flags.date);
    docs = doc ? [doc] : [];
  } else {
    docs = await reader.readRecentTapes({ battleId: flags.battle || null, n: Number(flags.recent) });
  }
  const parts = [];
  for (const doc of docs) {
    const series = await reader.readSeries(doc.battleId, doc.etDate);
    parts.push(formatTapeMarkdown(doc, sortSeries(series)));
  }
  if (!parts.length) {
    parts.push(flags.date
      ? `# Film tape — no document at \`agentBattles/${flags.battle}/${TAPE_SUBCOLLECTION}/${flags.date}\`\n\nNo tape for this day.\n`
      : `# Film tape — no tape documents${flags.battle ? ` for \`${flags.battle}\`` : ''}\n\nNo tape days found.\n`);
  }
  return {
    markdown: parts.join('\n---\n\n'),
    days: docs.map((d) => ({ battleId: d.battleId, etDate: d.etDate })),
  };
}

/**
 * The Firestore reader. Every method READS (`get()` only); there is
 * deliberately no write method to call. Exported so its paths and queries are
 * exercised against the in-memory store in the test.
 */
export function makeFirestoreReader(db) {
  const tapeCol = (battleId) => db.collection('agentBattles').doc(battleId).collection(TAPE_SUBCOLLECTION);
  const dataOf = (d) => (typeof d.data === 'function' ? d.data() : d.data);
  return {
    async readTape(battleId, etDate) {
      const snap = await tapeCol(battleId).doc(etDate).get();
      return snap.exists ? dataOf(snap) : null;
    },
    async readRecentTapes({ battleId, n }) {
      const q = battleId ? tapeCol(battleId) : db.collectionGroup(TAPE_SUBCOLLECTION);
      const snap = await q.orderBy('etDate', 'desc').limit(n).get();
      return snap.docs.map(dataOf).filter((d) => d && typeof d.battleId === 'string' && typeof d.etDate === 'string');
    },
    async readSeries(battleId, etDate) {
      const snap = await tapeCol(battleId).doc(etDate).collection(SERIES_SUBCOLLECTION).get();
      return snap.docs.map(dataOf);
    },
  };
}

async function main() {
  const flags = parseArgs(process.argv);
  const problem = argsProblem(flags);
  if (flags.help || problem) {
    if (problem) console.error(`\n${problem}\n`);
    console.error(usage());
    if (problem) process.exitCode = 2;
    return;
  }

  const env = { ...parseEnvFile(path.join(PROJECT_ROOT, '.env.local')), ...process.env };
  const creds = env.FIREBASE_ADMIN_CREDENTIALS;
  if (!creds) {
    console.error('\nFATAL: FIREBASE_ADMIN_CREDENTIALS is not set (.env.local or the environment).');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(creds);
  console.error(`[export-film-tape] project_id: ${serviceAccount.project_id} — CONFIRM this is the project you meant.`);

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(serviceAccount) });

  const { markdown, days } = await runExport(makeFirestoreReader(getFirestore()), flags);
  if (flags.out) {
    const outPath = path.resolve(flags.out);
    writeFileSync(outPath, markdown, 'utf8');
    console.error(`[export-film-tape] ${days.length} tape day(s) → ${outPath}`);
  } else {
    process.stdout.write(markdown);
    console.error(`[export-film-tape] ${days.length} tape day(s)`);
  }
}

// CLI entrypoint only — importing this module runs nothing (the ws1-observe-walk precedent).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
