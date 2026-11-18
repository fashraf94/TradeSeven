// scripts/experiments/setup-frequency/lib.mjs
//
// Setup frequency count (experiment prompt V1.1, 17 Nov 2026) — THE SHARED HELPERS: the window's sessions, the
// run folder (outside the repository), the write-verb grep every script passes before it runs, and plain statistics.
// No Firestore, no network, no clock read except where a caller passes one.
//
// The run folder holds everything a step writes. Nothing lands in the repository tree.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSessionForDate } from '../../../api/_utils/marketSchedule.js';
import { STOCK_UNIVERSE } from '../../../api/_utils/rankingConfig.js';
import { repoRoots, insideAny } from '../trader-game-replay/exportReplay.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..');
export const DEFAULT_RUN_DIR = 'C:/Users/fashr/Documents/FantasyTrades/SetupFrequency/run-20261117';

/** The prompt's window: the 120 completed sessions ending at the last completed session before the run (§2). */
export const WINDOW_SESSIONS = 120;
/** Prompt §1 rule 6: the hard cap on provider requests for the whole run. */
export const REQUEST_CAP = 400;
/** The market-state symbol (§3) and the eleven sector funds the ranked universe is grouped under (rankingConfig.js STOCK_UNIVERSE keys). */
export const MARKET_SYMBOL = 'SPY';
export const SECTOR_FUNDS = Object.freeze(Object.keys(STOCK_UNIVERSE));
/** symbol → sector name, from the ranked universe's own grouping. */
export const UNIVERSE_SECTOR = Object.freeze(Object.fromEntries(Object.values(STOCK_UNIVERSE).flatMap((s) => s.stocks.map((sym) => [sym, s.name]))));
/** sector fund → sector name. */
export const FUND_SECTOR = Object.freeze(Object.fromEntries(Object.entries(STOCK_UNIVERSE).map(([fund, s]) => [fund, s.name])));

export function die(msg) {
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
}

/** `--run <dir>` (default DEFAULT_RUN_DIR), refused inside this checkout or the main checkout. */
export function runDirOf(argv) {
  const i = argv.indexOf('--run');
  const dir = path.resolve(i >= 0 ? argv[i + 1] : DEFAULT_RUN_DIR);
  if (insideAny(dir, repoRoots(PROJECT_ROOT))) die(`the run folder must be outside the repository: ${dir}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export const argOf = (argv, flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
}

/** The window: WINDOW_SESSIONS sessions, oldest first, ending at `lastSession`, walked on the calendar of record. */
export function windowSessions(lastSession) {
  const out = [lastSession];
  while (out.length < WINDOW_SESSIONS) {
    const prev = getSessionForDate(out[out.length - 1])?.previousEtDate;
    if (!prev) die(`the calendar cannot name the session before ${out[out.length - 1]}`);
    out.push(prev);
  }
  return out.reverse();
}

/** The session after `session` on the calendar, or null. */
export function nextSessionOf(session) {
  let d = new Date(`${session}T12:00:00Z`);
  for (let i = 0; i < 10; i++) {
    d = new Date(d.getTime() + 86_400_000);
    const day = getSessionForDate(d.toISOString().slice(0, 10));
    if (!day) return null;
    if (day.isTradingDay) return day.etDate;
  }
  return null;
}

// ---- The write-verb grep (prompt §1 rule 4) -------------------------------------------------------------------------
//
// Every script calls this before it does anything. It reads every .mjs file in this folder as text, comments included,
// and refuses to run when any holds a Firestore write verb as a call, when any file other than exportProduction.mjs
// imports the Admin SDK, or when any file other than fetchBars.mjs imports the provider's request module. The folder
// avoids Set and Map mutators for the same reason: their method names are write verbs and would read as writes.

const WRITE_VERB_RE = /\.(set|update|create|delete|add|commit|batch|runTransaction|bulkWriter|recursiveDelete)\s*\(/g;
const ADMIN_SDK_RE = /['"`]firebase-admin/;
const PROVIDER_RE = /['"`/]eodhdDailyWindow/;

export function writeVerbGrep() {
  const files = readdirSync(HERE).filter((f) => f.endsWith('.mjs')).sort();
  const hits = [];
  for (const file of files) {
    const text = readFileSync(path.join(HERE, file), 'utf8');
    for (const m of text.matchAll(WRITE_VERB_RE)) hits.push(`${file}: write verb ${m[0]}`);
    if (file !== 'exportProduction.mjs' && ADMIN_SDK_RE.test(text)) hits.push(`${file}: imports the Admin SDK`);
    if (file !== 'fetchBars.mjs' && PROVIDER_RE.test(text)) hits.push(`${file}: imports the provider request`);
  }
  if (hits.length > 0) die(`write-verb grep failed:\n  ${hits.join('\n  ')}`);
  return { files, hits: 0 };
}

// ---- Statistics -----------------------------------------------------------------------------------------------------

/** Nearest-rank percentile of a numeric array (p in 0..100); null for an empty array. */
export function percentile(values, p) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const rank = Math.max(1, Math.ceil((p / 100) * v.length));
  return v[Math.min(rank, v.length) - 1];
}

/** The median as the mean of the two middle values for an even count. */
export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function spread(values) {
  const v = values.filter((x) => Number.isFinite(x));
  return { n: v.length, median: median(v), p10: percentile(v, 10), p90: percentile(v, 90), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null };
}

export const share = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
export const bump = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
export const uniq = (arr) => { const seen = {}; const out = []; for (const x of arr) if (!seen[x]) { seen[x] = true; out.push(x); } return out; };
export const exists = existsSync;
