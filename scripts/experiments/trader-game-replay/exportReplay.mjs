#!/usr/bin/env node
// scripts/experiments/trader-game-replay/exportReplay.mjs
//
// Trader game replay pack — THE EXPORT (prompt of 15 Nov 2026, section 3).
// READ-ONLY on production: the only Firestore calls are `.get()` on a query, a
// collection or a document. There is no write call in this file. It writes local
// files only, to a directory OUTSIDE the repository (`--out`).
//
// What it reads, per agent-mode battle whose first trading day is on or after
// 10 Aug 2026 (the read pattern of scripts/calibration/export-agent-battles.js:
// one single-field equality query, the date window applied client-side):
//   - the battle record (it carries `evaluations[]`, `trades[]`, `chatExchanges[]`)
//   - learningReceipts/{battleId}/receipts            (Part A: the sale-time touch record)
//   - agentBattles/{battleId}/ticks                    (Part B: one row per check)
//   - agentBattles/{battleId}/tickBodies               (Part C: the request and response text)
//   - agentBattles/{battleId}/calls                    (Part B: cockpit commands)
//   - agentBattles/{battleId}/tape and tape/{d}/series (Part B: prices at each check, 10-minute bars)
//   - agentBattles/{battleId}/intradayViews            (Part B: a price fallback at model checks)
//
// NO ACCOUNT IDS LEAVE THIS SCRIPT. Each battle's bundle is serialized to JSON and
// then every battle id, owner id, agent id and opponent account id is replaced AT
// THE TEXT LEVEL (longest id first) by an ordinal: battle-001, acct-01, agent-01.
// Text-level, not field-level, so that values that embed an id stay equal to the
// field they are checked against (a measured receipt's battleId against the
// battle's id, the stored receiptContent string that embeds it). After writing,
// every output file is scanned for every original id; any hit fails the run.
// Printed output is counts only.
//
// USAGE (from the repo root):
//   node scripts/experiments/trader-game-replay/exportReplay.mjs --out <dir> [--env <path to .env.local>]
//
// ENV: FIREBASE_ADMIN_CREDENTIALS (the export-agent-battles.js convention), read
// from --env, else this tree's .env.local, else the environment. Never printed.

import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseEnvFile, serialize } from '../../calibration/export-agent-battles.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');

export const SINCE_DAY = '2026-08-10';
export const GAME_MODE = 'baggerbomb_agent';
const SUBCOLLECTIONS = ['ticks', 'tickBodies', 'calls', 'intradayViews'];

function die(msg) {
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
}

export function parseArgs(argv) {
  const flags = { out: null, env: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') flags.out = argv[++i];
    else if (a === '--env') flags.env = argv[++i];
    else die(`Unknown flag: ${a}`);
  }
  if (!flags.out) die('--out <dir> is required (a directory outside the repository)');
  return flags;
}

/** The battle's first trading day: timing.tradingDays[0], else the creation date. */
export function firstTradingDay(b) {
  const d = b?.timing?.tradingDays?.[0];
  if (typeof d === 'string') return d.slice(0, 10);
  return typeof b?.createdAt === 'string' ? b.createdAt.slice(0, 10) : null;
}

const ID_KEY_RE = /(?:^|[a-z])(?:ownerId|userId|uid|odUserId|agentId|createdBy|ownerUid|playerId)$/i;

/** Every string under a key that names an account or agent (walked, keys included). */
export function collectAccountIds(value, out = new Set(), key = '') {
  if (value == null) return out;
  if (typeof value === 'string') {
    // An id, not a word: 10+ id characters with at least one digit or capital.
    if (ID_KEY_RE.test(key) && /^[A-Za-z0-9_-]{10,128}$/.test(value) && /[0-9A-Z]/.test(value)) out.add(value);
    return out;
  }
  if (Array.isArray(value)) { for (const v of value) collectAccountIds(v, out, key); return out; }
  if (typeof value === 'object') for (const [k, v] of Object.entries(value)) collectAccountIds(v, out, k);
  return out;
}

/** Replace every id in `text`, longest first. `pairs` is [[original, ordinal]] sorted by length desc. */
export function pseudonymize(text, pairs) {
  let out = text;
  let hits = 0;
  for (const [from, to] of pairs) {
    if (!out.includes(from)) continue;
    const parts = out.split(from);
    hits += parts.length - 1;
    out = parts.join(to);
  }
  return { text: out, hits };
}

const docsOf = (snap) => snap.docs.map((d) => ({ _docId: d.id, ...serialize(d.data()) }));

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

async function readBundle(db, battle) {
  const ref = db.collection('agentBattles').doc(battle._docId);
  const bundle = { battle, receipts: [], tape: [] };
  bundle.receipts = docsOf(await db.collection('learningReceipts').doc(battle._docId).collection('receipts').get());
  for (const name of SUBCOLLECTIONS) bundle[name] = docsOf(await ref.collection(name).get());
  const tapeDays = docsOf(await ref.collection('tape').get());
  for (const day of tapeDays) {
    const series = docsOf(await ref.collection('tape').doc(day._docId).collection('series').get());
    bundle.tape.push({ ...day, series });
  }
  return bundle;
}

async function main() {
  const flags = parseArgs(process.argv);
  const outDir = path.resolve(flags.out);
  if (outDir.toLowerCase().startsWith(PROJECT_ROOT.toLowerCase())) die('--out must be outside the repository');
  const envFile = flags.env || path.join(PROJECT_ROOT, '.env.local');
  const env = parseEnvFile(envFile);
  const creds = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!creds) die('FIREBASE_ADMIN_CREDENTIALS not found (value not printed)');
  let serviceAccount;
  try { serviceAccount = JSON.parse(creds); } catch { die('FIREBASE_ADMIN_CREDENTIALS is not valid JSON (value not printed)'); }

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  console.log(`firebase-admin initialized for project: ${serviceAccount.project_id}`);

  // READ ONLY. Single-field equality, no composite index; the window is client-side.
  const snap = await db.collection('agentBattles').where('gameMode', '==', GAME_MODE).get();
  const all = docsOf(snap);
  const battles = all
    .filter((b) => (firstTradingDay(b) || '') >= SINCE_DAY)
    .sort((a, b) => (firstTradingDay(a) + (a.createdAt || '') + a._docId).localeCompare(firstTradingDay(b) + (b.createdAt || '') + b._docId));
  console.log(`agent-mode battles: ${all.length}; first trading day on or after ${SINCE_DAY}: ${battles.length}`);

  const bundles = await pool(battles, 4, (b) => readBundle(db, b));

  // ---- the id map: battles by ordinal of first trading day; accounts and agents by first appearance.
  const pad = (n, w) => String(n).padStart(w, '0');
  const pairs = new Map();
  battles.forEach((b, i) => pairs.set(b._docId, `battle-${pad(i + 1, 3)}`));
  const accounts = new Set();
  const agents = new Set();
  for (const bundle of bundles) {
    const b = bundle.battle;
    if (typeof b.ownerId === 'string') accounts.add(b.ownerId);
    for (const t of bundle.ticks) if (typeof t.ownerId === 'string') accounts.add(t.ownerId);
    for (const d of bundle.tape) if (typeof d.ownerId === 'string') accounts.add(d.ownerId);
    if (typeof b.agentId === 'string') agents.add(b.agentId);
    for (const id of collectAccountIds(bundle)) if (!pairs.has(id) && !accounts.has(id)) agents.add(id);
  }
  for (const k of ['TEST_USER_UID', 'COCKPIT_ALLOWLIST_UIDS']) {
    for (const v of String(env[k] || process.env[k] || '').split(',').map((s) => s.trim()).filter((s) => s.length >= 10)) accounts.add(v);
  }
  for (const v of String(env.TEST_USER_AGENT_ID || process.env.TEST_USER_AGENT_ID || '').split(',').map((s) => s.trim()).filter((s) => s.length >= 10)) agents.add(v);
  let a = 0; for (const id of accounts) if (!pairs.has(id)) pairs.set(id, `acct-${pad(++a, 2)}`);
  let g = 0; for (const id of agents) if (!pairs.has(id) && !accounts.has(id)) pairs.set(id, `agent-${pad(++g, 2)}`);
  const sorted = [...pairs.entries()].sort((x, y) => y[0].length - x[0].length || x[0].localeCompare(y[0]));

  mkdirSync(outDir, { recursive: true });
  const manifest = { exportedFor: 'trader-game-replay-pack', sinceDay: SINCE_DAY, gameMode: GAME_MODE, battles: [], idCounts: { battles: battles.length, accounts: a, agents: g } };
  let replaced = 0;
  bundles.forEach((bundle, i) => {
    const name = `battle-${pad(i + 1, 3)}.json`;
    const { text, hits } = pseudonymize(JSON.stringify(bundle), sorted);
    replaced += hits;
    writeFileSync(path.join(outDir, name), text);
    manifest.battles.push({
      file: name,
      firstTradingDay: firstTradingDay(bundle.battle),
      status: bundle.battle.status ?? null,
      archetype: bundle.battle.agentContext?.archetype ?? null,
      route: Object.hasOwn(bundle.battle.scoring || {}, 'stockThresholdModel') ? 'measured' : 'legacy',
      counts: { receipts: bundle.receipts.length, ticks: bundle.ticks.length, tickBodies: bundle.tickBodies.length, calls: bundle.calls.length, intradayViews: bundle.intradayViews.length, tapeDays: bundle.tape.length, tapeSeries: bundle.tape.reduce((n, d) => n + d.series.length, 0), evaluations: (bundle.battle.evaluations || []).length, trades: (bundle.battle.trades || []).length },
    });
  });
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // ---- the leak scan: no original id in any output file.
  let leaks = 0;
  for (const f of readdirSync(outDir).filter((n) => n.endsWith('.json'))) {
    const text = readFileSync(path.join(outDir, f), 'utf8');
    for (const [from] of sorted) if (text.includes(from)) leaks++;
  }
  console.log(`wrote ${bundles.length} battle files + manifest; ids replaced: ${replaced}; distinct ids mapped: ${sorted.length}; leak-scan hits: ${leaks}`);
  if (leaks > 0) die('an original id survived in an output file — the export is not safe to use');
  const tally = (key) => manifest.battles.reduce((m, r) => { const k = key(r); m[k] = (m[k] || 0) + 1; return m; }, {});
  console.log('by status:', JSON.stringify(tally((r) => r.status)));
  console.log('completed by archetype|route:', JSON.stringify(tally((r) => (r.status === 'completed' ? `${r.archetype}|${r.route}` : 'not completed'))));
  console.log('completed with ticks:', manifest.battles.filter((r) => r.status === 'completed' && r.counts.ticks > 0).length);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().then(() => process.exit(0)).catch((err) => die(String(err?.message || err).slice(0, 400)));
}
