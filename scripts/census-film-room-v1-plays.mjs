// scripts/census-film-room-v1-plays.mjs
//
// Film Room C1 fix round — Build C Amendment A CA-13: the READ-ONLY census of the stored plays ledger before the cards
// flag goes 'on'. It answers one question the C1 build could not (report §7 item 13): do stored v1 Practice entries
// (route `drill`) exist in production? Since the allowlist flip of Oct 29 the form offered Practice to allowlisted
// owners; such an entry reads as Offer, says "nominated for the Practice Field", counts open and can only be retired
// (CA-2's v1 case). If any `drill` entry exists, the founder retires it from its receipt (CA-13).
//
// WHAT IT READS: the `plays` collection group, every document, with FIELD SELECTION (`route`, `stage`) and NO FILTER —
// so it needs no index and reads nothing else of a card (no note, no owner, no source).
// WHAT IT PRINTS: COUNTS ONLY — by route, by stage, and route x stage, under fixed bucket names: the vocabulary's own
// routes and stages (src/data/cardStages.js, with the stored alias `drill`), `missing` for a document without the
// field, and `unknown` for any other value. A raw unknown value is never printed (it could be anything, an id
// included); no document id, no path, no owner is ever printed.
// READ-ONLY BY CONSTRUCTION, behind the Film Room B1 census's write-grep gate (scripts/census-film-room-b1.mjs, the
// Practice Field discovery's §0.2 grep): main() greps this file for a Firestore write call before anything else and
// refuses to run on a match (exit 3). Every Firestore access is the one query's get.
// THE CREDENTIAL: a Firebase service account's JSON, taken from FIREBASE_ADMIN_CREDENTIALS if the environment holds
// it, else typed into this script's own HIDDEN prompt (nothing echoed). It never reads an .env file, and never prints
// a value of it — the project id included.
//
// USAGE (the founder, once, before 'on'; never run by a build session against production):
//   node scripts/census-film-room-v1-plays.mjs
// The prompt asks for the service account JSON (one line); paste it and press Enter. Or, in PowerShell, put it in
// the process's environment through a hidden prompt first:
//   $sec = Read-Host -AsSecureString "Service account JSON"
//   $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec); $env:FIREBASE_ADMIN_CREDENTIALS = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b); [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)
//   node scripts/census-film-room-v1-plays.mjs
//   Remove-Item Env:FIREBASE_ADMIN_CREDENTIALS; Remove-Variable sec, b

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARD_ROUTES, CARD_STAGES, STORED_ROUTE_ALIASES } from '../src/data/cardStages.js';
import { errorClassOf } from '../api/_utils/filmTape/errorClass.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// ── the gate ────────────────────────────────────────────────────────────────

const join = (...parts) => parts.join('');
/** The Film Room B1 census's write pattern (the discovery's §0.2 grep), its tokens assembled so this line never matches itself. */
export const WRITE_PATTERN = new RegExp(`\\.(set|update|delete|add|create)\\s*\\(|${join('run', 'Transaction')}|\\.batch\\(|${join('bulk', 'Writer')}|${join('write', 'Batch')}|${join('Field', 'Value')}|${join('recursive', 'Delete')}`);
/** The one file the gate reads: this script (the vocabulary it imports is zero-import data and pure predicates). */
export const GATED_FILE = 'scripts/census-film-room-v1-plays.mjs';
/** `[line, text]` for every line of `source` the pattern matches. */
export const writeCallsIn = (source) => String(source).split(/\r?\n/).map((text, i) => [i + 1, text]).filter(([, text]) => WRITE_PATTERN.test(text));

// ── the core (pure) ─────────────────────────────────────────────────────────

/** The collection group the census reads, and the only fields it selects. */
export const PLAYS_GROUP = 'plays';
export const SELECTED_FIELDS = Object.freeze(['route', 'stage']);
/** The route buckets: the vocabulary's routes and the stored alias (`drill`), then `missing` and `unknown`. */
export const ROUTE_BUCKETS = Object.freeze([...CARD_ROUTES, ...Object.keys(STORED_ROUTE_ALIASES), 'missing', 'unknown']);
/** The stage buckets: the vocabulary's stages, then `missing` and `unknown`. */
export const STAGE_BUCKETS = Object.freeze([...CARD_STAGES, 'missing', 'unknown']);

/** A field's bucket: a known word, `missing` when the document has no such field (or null), `unknown` for anything else. */
const bucketOf = (value, known) => (value === undefined || value === null ? 'missing' : typeof value === 'string' && known.includes(value) ? value : 'unknown');

/**
 * The counts over plain documents (each `{ route, stage }` as the selection returns them).
 *
 * @param {object[]} docs
 * @returns {{ total: number, byRoute: Record<string, number>, byStage: Record<string, number>, byRouteStage: Record<string, Record<string, number>> }}
 */
export function countPlays(docs) {
  const knownRoutes = ROUTE_BUCKETS.slice(0, -2);
  const knownStages = STAGE_BUCKETS.slice(0, -2);
  const byRoute = Object.fromEntries(ROUTE_BUCKETS.map((r) => [r, 0]));
  const byStage = Object.fromEntries(STAGE_BUCKETS.map((s) => [s, 0]));
  const byRouteStage = Object.fromEntries(ROUTE_BUCKETS.map((r) => [r, Object.fromEntries(STAGE_BUCKETS.map((s) => [s, 0]))]));
  let total = 0;
  for (const d of Array.isArray(docs) ? docs : []) {
    const doc = d !== null && typeof d === 'object' && !Array.isArray(d) ? d : {};
    const r = bucketOf(doc.route, knownRoutes);
    const s = bucketOf(doc.stage, knownStages);
    total += 1;
    byRoute[r] += 1;
    byStage[s] += 1;
    byRouteStage[r][s] += 1;
  }
  return { total, byRoute, byStage, byRouteStage };
}

/** The census as text: counts under fixed bucket names, nothing read from a document but its two counted fields. */
export function renderCensus(r) {
  const L = [];
  L.push('# Film Room — stored plays by route and stage (counts only)');
  L.push(`entries read: ${r.total}`);
  L.push(`stored v1 Practice entries (route drill): ${r.byRoute.drill}${r.byRoute.drill ? ' — retire each from its receipt before on (Amendment A CA-13)' : ''}`);
  L.push('');
  L.push('## by route');
  for (const k of ROUTE_BUCKETS) L.push(`- ${k}: ${r.byRoute[k]}`);
  L.push('');
  L.push('## by stage');
  for (const k of STAGE_BUCKETS) L.push(`- ${k}: ${r.byStage[k]}`);
  L.push('');
  L.push(`## route x stage (${STAGE_BUCKETS.join(' · ')})`);
  for (const k of ROUTE_BUCKETS) L.push(`- ${k}: ${STAGE_BUCKETS.map((s) => r.byRouteStage[k][s]).join(' · ')}`);
  return L.join('\n');
}

/**
 * THE ONE READ: the plays collection group, every document, the two fields selected, no filter, no order, no limit.
 * Returns the selected fields of each document only (never an id or a path).
 */
export async function readPlays(db) {
  const snap = await db.collectionGroup(PLAYS_GROUP).select(...SELECTED_FIELDS).get();
  return snap.docs.map((d) => {
    const data = typeof d.data === 'function' ? d.data() : d.data;
    return { route: data?.route, stage: data?.stage };
  });
}

/** A failure line: the error's class from the one fixed list, and nothing of its message (no id, no path, no key can print). */
export const failureLine = (err) => `[census-v1-plays] failed: ${errorClassOf(err)}`;

// ── main (the credential and the read live only here) ──────────────────────

/** A line typed into a prompt that echoes nothing (raw mode on a terminal; a plain line read when stdin is piped). */
function readHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    let text = '';
    const raw = Boolean(stdin.isTTY);
    const done = (value) => { stdin.removeListener('data', onData); if (raw) stdin.setRawMode(false); stdin.pause(); stdout.write('\n'); resolve(value); };
    const onData = (chunk) => {
      for (const ch of String(chunk)) {
        if (ch === '\u0003') { stdin.removeListener('data', onData); if (raw) stdin.setRawMode(false); reject(new Error('cancelled')); return; }
        if (ch === '\r' || ch === '\n') { done(text); return; }
        if (ch === '\u007f' || ch === '\b') text = text.slice(0, -1);
        else text += ch;
      }
    };
    if (raw) stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

function stop(message, code = 2) {
  console.error(`STOP: ${message}`);
  process.exit(code);
}

async function main() {
  // THE GATE, before anything else: no credential is asked for and no read is made if it trips
  const hits = writeCallsIn(readFileSync(path.join(REPO, GATED_FILE), 'utf8'));
  if (hits.length) stop(`write-grep gate: ${GATED_FILE} has ${hits.length} line(s) matching a write call (${hits.map(([n]) => n).join(', ')}) — refusing to run`, 3);
  console.log(`[census-v1-plays] gate: ${GATED_FILE} — no write call`);
  const typed = process.env.FIREBASE_ADMIN_CREDENTIALS || await readHidden('Service account JSON (hidden): ');
  let sa = null;
  try { sa = JSON.parse(typed); } catch { sa = null; }
  if (!sa || typeof sa.private_key !== 'string') stop('no usable Firebase service account (value not printed)');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore(initializeApp({ credential: cert(sa) }, 'census-film-room-v1-plays'));
  const docs = await readPlays(db);
  console.log(renderCensus(countPlays(docs)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => { console.error(failureLine(err)); process.exit(1); });
}
