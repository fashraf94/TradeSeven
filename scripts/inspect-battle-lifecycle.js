#!/usr/bin/env node
// scripts/inspect-battle-lifecycle.js
//
// ONE agent battle's lifecycle fields — READ-ONLY. Written for the Film Tape
// first-smoke discovery (docs/audits/20261002_FILM_TAPE_FIRST_SMOKE_DISCOVERY.md,
// Q3): a battle taped with no evaluation, no tick, no deferral listing and no
// opponent score. It prints exactly the fields that tell the platform paths
// behind that apart, and nothing else:
//
//   createdAt, activatedAt, status, gameMode, agentId
//   timing.*                     (every key the document carries)
//   scoreState                   (every key; currentScore, opponentScore,
//                                 lastScoredAt and evaluationCount always
//                                 printed first, "(absent)" when missing)
//   the opponent fields          (opponent.* — portfolio and bench as symbols)
//   statusFeed                   the first and the last 10 entries: type, time,
//                                message (type = the entry's `action`, else
//                                its `type`)
//
// Instants are printed as stored, with the America/New_York wall clock beside
// them, because every path it separates turns on an ET time (the 16:00 close,
// the 20:00 crypto-extended expiry). An ABSENT field prints "(absent)" and a
// stored null prints "null" — the difference is the finding.
//
// It NEVER writes to Firestore: the reader below exposes one `get()` and no
// write method. It imports no flag module and fetches nothing beyond the one
// document read.
//
// USAGE (from the project root):
//
//   node scripts/inspect-battle-lifecycle.js --battle <battleId>
//
// The read-out goes to stdout; the project line goes to stderr, so a redirect
// captures only the read-out.
//
// ENV (matches scripts/export-film-tape.js):
//   FIREBASE_ADMIN_CREDENTIALS — the service-account JSON, in .env.local or the
//   environment. The script prints the project_id it connected to — CONFIRM it
//   before trusting the result.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');

/** How many statusFeed entries are printed from each end. */
export const FEED_EDGE = 10;

const TIERS = ['star', 'core', 'support'];
/** Printed first, present or not: the scoreState keys a never-scored battle is told by. */
const SCORE_STATE_ALWAYS = ['currentScore', 'opponentScore', 'lastScoredAt', 'evaluationCount'];

// ── pure helpers (exported; no DB, no side effects) ──────────────────────────

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
  const flags = { battle: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--battle') flags.battle = argv[++i] ?? null;
    else if (a === '--help' || a === '-h') flags.help = true;
  }
  return flags;
}

/** What is wrong with the flags, in one line — or null when they name a read. */
export function argsProblem(flags) {
  if (flags.help) return null;
  if (!flags.battle) return 'nothing to read: --battle <id>';
  if (flags.battle.includes('/')) return '--battle takes a document id, not a path';
  return null;
}

export function usage() {
  return [
    'inspect-battle-lifecycle — READ-ONLY lifecycle fields of one agentBattles document.',
    '',
    '  --battle <id>   the agentBattles document id',
    '',
    'Prints createdAt, activatedAt, status, gameMode, agentId, timing.*, scoreState,',
    `the opponent fields and the first and last ${FEED_EDGE} statusFeed entries.`,
    'Writes NOTHING to Firestore.',
  ].join('\n');
}

const ET_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** A stored instant as an ISO string (a Firestore Timestamp, a Date, or an ISO string), else null. */
export function isoOf(v) {
  const d = v && typeof v.toDate === 'function' ? v.toDate()
    : v instanceof Date ? v
      : typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

/** The ET wall clock of an instant, 'YYYY-MM-DD HH:mm:ss ET'. */
export function etOf(iso) {
  const p = Object.fromEntries(ET_PARTS.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} ET`;
}

const jsonOf = (v) => JSON.stringify(v, (_k, x) => (x && typeof x.toDate === 'function' ? x.toDate().toISOString() : x));

/** One value as printed: "(absent)" for a missing key, an instant with its ET clock, else JSON. */
export function show(v, { instant = false } = {}) {
  if (v === undefined) return '(absent)';
  if (v === null) return 'null';
  if (instant || (v && typeof v.toDate === 'function')) {
    const iso = isoOf(v);
    if (iso) return `${typeof v === 'string' ? v : iso} (${etOf(iso)})`;
  }
  return typeof v === 'string' ? v : jsonOf(v);
}

const symbolsOf = (list) => (Array.isArray(list) ? list.map((a) => (a && a.symbol) || null) : list);

/** The opponent block as lines: its scalar keys raw, its portfolio and bench as symbols per slot. */
function opponentLines(opponent) {
  if (opponent === undefined || opponent === null) return [`opponent: ${show(opponent)}`];
  if (typeof opponent !== 'object') return [`opponent: ${show(opponent)}`];
  const lines = [];
  for (const key of Object.keys(opponent)) {
    const v = opponent[key];
    if (key === 'portfolio' && v && typeof v === 'object') {
      for (const tier of [...TIERS, ...Object.keys(v).filter((k) => !TIERS.includes(k))]) {
        if (tier in v) lines.push(`opponent.portfolio.${tier}: ${show(TIERS.includes(tier) ? symbolsOf(v[tier]) : v[tier])}`);
      }
    } else if (key === 'bench' && v && typeof v === 'object') {
      lines.push(`opponent.bench.stocks: ${show(symbolsOf(v.stocks))}`);
      lines.push(`opponent.bench.crypto: ${show(v.crypto === undefined || v.crypto === null ? v.crypto : v.crypto.symbol ?? v.crypto)}`);
    } else {
      lines.push(`opponent.${key}: ${show(v)}`);
    }
  }
  return lines.length ? lines : ['opponent: {}'];
}

/** One statusFeed entry: index, time, type, message. */
function feedLine(entry, i) {
  const e = entry && typeof entry === 'object' ? entry : {};
  const type = e.action ?? e.type;
  const time = e.timestamp ?? e.time ?? e.at;
  return `  #${i + 1}  ${show(time, { instant: true })}  type=${show(type)}  message=${show(e.message)}`;
}

/** The statusFeed's first and last FEED_EDGE entries, never printing one twice. */
function feedLines(feed) {
  if (!Array.isArray(feed)) return [`statusFeed: ${show(feed)}`];
  const lines = [`statusFeed: ${feed.length} entr${feed.length === 1 ? 'y' : 'ies'}`];
  if (feed.length <= FEED_EDGE * 2) {
    feed.forEach((e, i) => lines.push(feedLine(e, i)));
    return lines;
  }
  lines.push(`  — first ${FEED_EDGE} —`);
  feed.slice(0, FEED_EDGE).forEach((e, i) => lines.push(feedLine(e, i)));
  lines.push(`  — last ${FEED_EDGE} (entries ${feed.length - FEED_EDGE + 1}–${feed.length}) —`);
  feed.slice(-FEED_EDGE).forEach((e, i) => lines.push(feedLine(e, feed.length - FEED_EDGE + i)));
  return lines;
}

/** The read-out for one battle document (`doc` null when it does not exist). */
export function formatLifecycle(battleId, doc) {
  const lines = [`agentBattles/${battleId}`];
  if (!doc) return [...lines, '(no such document)', ''].join('\n');
  lines.push('');
  lines.push(`createdAt: ${show(doc.createdAt, { instant: true })}`);
  lines.push(`activatedAt: ${show(doc.activatedAt, { instant: true })}`);
  lines.push(`status: ${show(doc.status)}`);
  lines.push(`gameMode: ${show(doc.gameMode)}`);
  lines.push(`agentId: ${show(doc.agentId)}`);
  lines.push('');
  if (doc.timing && typeof doc.timing === 'object') {
    for (const key of Object.keys(doc.timing)) lines.push(`timing.${key}: ${show(doc.timing[key], { instant: key.endsWith('At') })}`);
  } else {
    lines.push(`timing: ${show(doc.timing)}`);
  }
  lines.push('');
  if (doc.scoreState && typeof doc.scoreState === 'object') {
    const ss = doc.scoreState;
    for (const key of [...SCORE_STATE_ALWAYS, ...Object.keys(ss).filter((k) => !SCORE_STATE_ALWAYS.includes(k))]) {
      lines.push(`scoreState.${key}: ${show(ss[key], { instant: key.endsWith('At') })}`);
    }
  } else {
    lines.push(`scoreState: ${show(doc.scoreState)}`);
  }
  lines.push('');
  lines.push(...opponentLines(doc.opponent));
  lines.push('');
  lines.push(...feedLines(doc.statusFeed));
  lines.push('');
  return lines.join('\n');
}

// ── the runner ───────────────────────────────────────────────────────────────

/**
 * The Firestore reader. It READS (`get()` only); there is deliberately no
 * write method to call.
 */
export function makeFirestoreReader(db) {
  return {
    async readBattle(battleId) {
      const snap = await db.collection('agentBattles').doc(battleId).get();
      return snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    },
  };
}

export async function runInspect(reader, flags) {
  const doc = await reader.readBattle(flags.battle);
  return { text: formatLifecycle(flags.battle, doc), found: Boolean(doc) };
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
  console.error(`[inspect-battle-lifecycle] project_id: ${serviceAccount.project_id} — CONFIRM this is the project you meant.`);

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(serviceAccount) });

  const { text, found } = await runInspect(makeFirestoreReader(getFirestore()), flags);
  process.stdout.write(text);
  console.error(`[inspect-battle-lifecycle] ${found ? 'document read' : 'no such document'}`);
}

// CLI entrypoint only — importing this module runs nothing (the export-film-tape precedent).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
