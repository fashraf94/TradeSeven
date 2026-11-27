// scripts/research-stock.mjs
//
// Research universe Build 2 (PR B), build prompt section 5.6: THE HAND-RUN SCRIPT for a research stock's numbers. The
// only caller of api/_utils/researchMeasures.js; nothing in the app calls it yet.
//
// USAGE (the service account and the EODHD key come from .env.local at the project root, as scripts/explore-publish.mjs
// reads them; a variable already set in the shell wins, so `node --env-file=<path to .env.local>` works from a worktree):
//
//   node scripts/research-stock.mjs status <SYM>        what is kept for the stock and how old it is; today's counter.  0 calls
//   node scripts/research-stock.mjs fetch <SYM>         what a fetch would do and cost. Writes nothing.                  0 calls
//   node scripts/research-stock.mjs fetch <SYM> --go    fetches if needed, stores, prints the measures with plain labels. 0 or 10
//   node scripts/research-stock.mjs compare <SYM>       one of the 228 only: the measures from a fresh response through the
//                                                       research path's own code, beside peerRankings/{SYM}.metrics.
//                                                       Writes nothing (claims no slot).                                 10 calls
//
// Exit codes: 0 done; 1 failed; 2 refused (not the kind of stock the command takes, or bad arguments); 3 compare found
// a measure that differs (fcfYield excepted: it uses the day's market value).
//
// Never prints a secret: the key is cut from every line printed, and nothing prints the environment. Importing this
// module reads no environment file, opens no connection and makes no call (the direct-run guard at the bottom).

/* global process -- Node script; eslint.config.js provides only browser globals */

import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_TICKERS, TICKER_TO_SECTOR } from '../api/_utils/rankingConfig.js';
import { shapeFundamentals } from '../api/_utils/stockMeasures.js';
import {
  CALLS_PER_FETCH, DAILY_FETCH_CEILING, STORED_METRIC_KEYS, fetchResearchStock, measuresOf, planResearchFetch,
  readFetchDay, readResearchStock, refusalOf, requestFundamentals,
} from '../api/_utils/researchMeasures.js';

export const EXIT = Object.freeze({ DONE: 0, FAILED: 1, REFUSED: 2, DIFFERS: 3 });

/** The ten measures the build prompt names, with plain labels and how each is written. */
export const TEN_MEASURES = Object.freeze([
  ['revenueGrowthYOY', 'Revenue growth, latest quarter against a year earlier', 'fraction'],
  ['earningsGrowthYOY', 'Earnings growth, latest quarter against a year earlier', 'fraction'],
  ['profitMarginTTM', 'Profit margin, last twelve months', 'fraction'],
  ['grossMargin', 'Gross margin, last twelve months', 'fraction'],
  ['fcfYield', 'Free cash flow yield (free cash flow over market value)', 'percent'],
  ['fcfMargin', 'Free cash flow margin (free cash flow over revenue)', 'percent'],
  ['debtToEquity', 'Debt to equity', 'ratio'],
  ['currentRatio', 'Current ratio (current assets over current liabilities)', 'ratio'],
  ['interestCoverage', 'Interest coverage (operating income over interest; 100 means net cash)', 'ratio'],
  ['netDebtEbitda', 'Net debt to EBITDA (-1 means net cash)', 'ratio'],
]);

const USAGE = [
  'usage:',
  '  node scripts/research-stock.mjs status <SYM>',
  '  node scripts/research-stock.mjs fetch <SYM> [--go]',
  '  node scripts/research-stock.mjs compare <SYM>',
].join('\n');

/** House spelling for a typed symbol: upper case, a share class with a hyphen. */
const spell = (s) => String(s ?? '').trim().toUpperCase().replace(/\./g, '-');

export function parseArgs(argv) {
  const [command, rawSymbol, ...rest] = argv;
  if (!['status', 'fetch', 'compare'].includes(command)) throw new Error(`unknown command ${JSON.stringify(command ?? '')}`);
  const symbol = spell(rawSymbol);
  if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(symbol)) throw new Error(`${command} needs a symbol`);
  const go = rest.includes('--go');
  const unknown = rest.filter((a) => a !== '--go');
  if (unknown.length > 0) throw new Error(`unknown argument ${unknown[0]}`);
  if (go && command !== 'fetch') throw new Error('--go is for fetch only');
  return { command, symbol, go };
}

/** One value as a person reads it, with the stored raw value beside it. */
export function formatMeasure(value, kind) {
  if (value === null || value === undefined) return 'not available (null)';
  if (typeof value !== 'number') return String(value);
  const raw = `raw ${value}`;
  if (kind === 'fraction') return `${(value * 100).toFixed(2)}% (${raw})`;
  if (kind === 'percent') return `${value.toFixed(2)}% (${raw})`;
  return `${value.toFixed(2)} (${raw})`;
}

const ageText = (ms) => {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return 'unknown age';
  const h = ms / 3600e3;
  return h < 48 ? `${h.toFixed(1)} hours old` : `${(h / 24).toFixed(1)} days old`;
};

/** The stored record, with plain labels. */
export function renderRecord(record) {
  const lines = [
    `${record.symbol}: ${record.name} (sector ${record.sectorId}, industry ${record.industry ?? 'none given'})`,
    `  status ${record.status}; fetched ${record.fetchedAt ?? 'never'}; shape version ${record.shapeVersion}`,
  ];
  if (record.unavailable) lines.push(`  last attempt failed: ${record.unavailable.reason} at ${record.unavailable.at}`);
  if (record.metrics) {
    lines.push('  The ten measures:');
    for (const [key, label, kind] of TEN_MEASURES) lines.push(`    ${label}: ${formatMeasure(record.metrics[key], kind)}`);
    const tenKeys = new Set(TEN_MEASURES.map(([k]) => k));
    const rest = STORED_METRIC_KEYS.filter((k) => !tenKeys.has(k)).map((k) => `${k} ${record.metrics[k] === null ? 'null' : record.metrics[k]}`);
    lines.push(`  Other stored measures (raw): ${rest.join('; ')}`);
  }
  if (record.estimates) {
    const fe = record.estimates.forwardEstimates;
    const g = (e) => (e?.growth == null ? 'none' : `${(Number(e.growth) * 100).toFixed(1)}%`);
    lines.push(`  Analyst estimates: EPS growth this fiscal year ${g(fe.currentYear)}, next ${g(fe.nextYear)} (${fe.nextYear?.numAnalysts == null ? '?' : Number(fe.nextYear.numAnalysts)} analysts on the next year)`);
  } else {
    lines.push('  Analyst estimates: none');
  }
  return lines;
}

/** Equal for compare: the same number (or both null), or the same string. */
const same = (a, b) => (a === null && b === null) || Object.is(a, b) || (typeof a === 'number' && typeof b === 'number' && a === b);

async function cmdStatus({ symbol, db, now }) {
  const lines = [];
  const refused = refusalOf(symbol);
  if (refused) lines.push(`${symbol} is not a research stock (${refused}); nothing is kept for it.`);
  const { record, ageMs } = await readResearchStock(db, symbol, now);
  if (!record) lines.push(refused ? '' : `${symbol}: nothing kept yet.`);
  else lines.push(...renderRecord(record), `  kept numbers are ${ageText(ageMs)}`);
  const day = await readFetchDay(db, now);
  lines.push(`Today's counter (${day.day}, UTC): ${day.fetches} of ${day.ceiling} fetches used (${day.fetches * CALLS_PER_FETCH} calls).`);
  return { exitCode: EXIT.DONE, lines: lines.filter((l) => l !== '') };
}

async function cmdFetchDry({ symbol, db, now }) {
  // Refused before anything is read (review R2-3).
  const refused = refusalOf(symbol);
  if (refused) return { exitCode: EXIT.REFUSED, lines: [`REFUSED: ${symbol} is not a research stock (${refused}). No call.`] };
  const { record } = await readResearchStock(db, symbol, now);
  const plan = planResearchFetch(symbol, record, now.getTime());
  const day = await readFetchDay(db, now);
  const lines = [];
  const claimedToday = Object.hasOwn(day.symbols ?? {}, symbol);
  if (plan.action === 'use_kept') lines.push(`Would use the kept numbers (${ageText(plan.ageMs)}). Cost: 0 calls.`);
  else if (plan.action === 'fetch' && claimedToday) lines.push(`Would make no call: ${symbol} was already fetched or tried today (UTC). Cost: 0 calls.`);
  else if (plan.action === 'wait') lines.push(`Would make no call: the last attempt failed (${plan.reason}); retry after ${plan.retryAfter}.${plan.stale ? ' Kept numbers would come back stale.' : ''} Cost: 0 calls.`);
  else if (day.fetches >= DAILY_FETCH_CEILING) lines.push(`Would make no call: today's ceiling (${DAILY_FETCH_CEILING} fetches) is reached.${plan.refresh ? ' Kept numbers would come back stale.' : ' Not available today.'} Cost: 0 calls.`);
  else lines.push(`Would ${plan.refresh ? 'refresh numbers older than 7 days with' : 'make'} one fundamentals request: ${CALLS_PER_FETCH} calls, fetch ${day.fetches + 1} of ${DAILY_FETCH_CEILING} today, then store researchMeasures/${symbol}.`);
  lines.push('Dry run: nothing was written. Add --go to do it.');
  return { exitCode: EXIT.DONE, lines };
}

async function cmdFetchGo({ symbol, db, apiKey, fetchImpl, now }) {
  const out = await fetchResearchStock(symbol, { db, apiKey, fetchImpl, now: () => (typeof now === 'function' ? now() : new Date(now.getTime())) });
  if (out.outcome === 'refused') return { exitCode: EXIT.REFUSED, lines: [`REFUSED: ${symbol} is not a research stock (${out.reason}). No call.`] };
  const head = {
    kept: `Kept numbers used. Calls: 0.`,
    fetched: `Fetched and stored. Calls: ${out.calls}.`,
    unavailable: `Unavailable (${out.reason}). Calls: ${out.calls}.${out.retryAfter ? ` Retry after ${out.retryAfter}.` : ''}`,
    over_ceiling: `Today's ceiling is reached: no call.${out.record ? '' : ' Not available today.'}`,
  }[out.outcome];
  const lines = [head];
  if (out.stale) lines.push('These numbers are more than 7 days old (stale).');
  if (out.record) lines.push(...renderRecord(out.record));
  return { exitCode: out.outcome === 'unavailable' && !out.record?.metrics ? EXIT.FAILED : EXIT.DONE, lines };
}

async function cmdCompare({ symbol, db, apiKey, fetchImpl }) {
  if (!ALL_TICKERS.includes(symbol)) return { exitCode: EXIT.REFUSED, lines: [`REFUSED: compare takes one of the 228 game stocks; ${symbol} is not one. No call.`] };
  if (typeof apiKey !== 'string' || apiKey.length === 0) return { exitCode: EXIT.FAILED, lines: ['FAILED: no EODHD key in the environment.'] };
  const got = await requestFundamentals(symbol, apiKey, fetchImpl);
  if (!got.ok) return { exitCode: EXIT.FAILED, lines: [`FAILED: the fundamentals request for ${symbol} failed (${got.reason}). Calls: ${CALLS_PER_FETCH}.`] };
  const fresh = measuresOf(symbol, shapeFundamentals(got.data, symbol), TICKER_TO_SECTOR[symbol]);
  const snap = await db.collection('peerRankings').doc(symbol).get();
  if (!snap.exists) return { exitCode: EXIT.FAILED, lines: [`FAILED: peerRankings/${symbol} does not exist. Calls: ${CALLS_PER_FETCH}.`] };
  const doc = snap.data();
  const stored = doc.metrics ?? {};
  const computedAt = doc.computedAt?.toDate ? doc.computedAt.toDate().toISOString() : String(doc.computedAt ?? 'unknown');
  const lines = [`${symbol}: the research path's measures from a fresh response, beside peerRankings/${symbol}.metrics (computed ${computedAt}). Calls: ${CALLS_PER_FETCH}. Nothing written.`];
  let differs = 0;
  for (const [key, label] of TEN_MEASURES) {
    const a = stored[key] ?? null;
    const b = fresh[key] ?? null;
    let verdict;
    if (a === null && b === null) verdict = 'equal (both null)';
    else if (same(a, b)) verdict = 'equal';
    else if (key === 'fcfYield' && typeof a === 'number' && typeof b === 'number') verdict = `differs by ${(((b - a) / Math.abs(a)) * 100).toFixed(3)}% (allowed: it uses the day's market value)`;
    else { verdict = 'DIFFERS'; differs += 1; }
    lines.push(`  ${key.padEnd(18)} stored ${String(a).padEnd(22)} new ${String(b).padEnd(22)} ${verdict}   (${label})`);
  }
  lines.push(differs === 0 ? 'Result: the ten measures agree.' : `Result: ${differs} of the ten measures differ.`);
  return { exitCode: differs === 0 ? EXIT.DONE : EXIT.DIFFERS, lines };
}

/**
 * The whole run, with its effects injected (the tests pass an in-memory db, a fake fetch and a fixed clock). `loadEnv`
 * runs after the arguments are checked; `getDb` is called once, at the first read.
 */
export async function runCli(argv, {
  getDb, loadEnv = async () => {}, env = process.env, fetchImpl = globalThis.fetch, now = () => new Date(),
  print = (s) => console.log(s),
} = {}) {
  let parsed;
  try { parsed = parseArgs(argv); } catch (err) {
    print(`REFUSED: ${err.message}`);
    print(USAGE);
    return EXIT.REFUSED;
  }
  let apiKey;
  const redact = (s) => (apiKey ? String(s).split(apiKey).join('<key>') : String(s));
  try {
    await loadEnv();
    apiKey = env.EODHD_API_KEY;
    const db = await getDb();
    const at = now();
    const args = { symbol: parsed.symbol, db, apiKey, fetchImpl, now: at };
    let result;
    if (parsed.command === 'status') result = await cmdStatus(args);
    else if (parsed.command === 'compare') result = await cmdCompare(args);
    else if (parsed.go) result = await cmdFetchGo({ ...args, now });
    else result = await cmdFetchDry(args);
    for (const line of result.lines) print(redact(line));
    return result.exitCode;
  } catch (err) {
    print(redact(`FAILED: ${err?.message ?? err}`));
    return EXIT.FAILED;
  }
}

/** The environment file, loaded here only, after the arguments are checked (a variable set in the shell wins). */
async function loadProductionEnv() {
  await import('./loadLocalEnv.js');
}

/** Credentials, loaded here only, at the first read. */
async function productionDb() {
  const { requireFirebaseCreds } = await import('./loadLocalEnv.js');
  requireFirebaseCreds();
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  return getFirebaseAdmin();
}

// Compared as real paths: run through a junction or symlink, Node runs the real file while argv[1] keeps the link.
const realOrResolved = (p) => {
  try { return realpathSync(p); } catch { return path.resolve(p); }
};
export const isDirectRun = (moduleUrl, argv1) => typeof argv1 === 'string' && argv1.length > 0
  && realOrResolved(fileURLToPath(moduleUrl)) === realOrResolved(argv1);

if (isDirectRun(import.meta.url, process.argv[1])) {
  runCli(process.argv.slice(2), { getDb: productionDb, loadEnv: loadProductionEnv })
    .then((code) => { process.exitCode = code; });
}
