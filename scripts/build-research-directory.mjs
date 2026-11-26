// scripts/build-research-directory.mjs
//
// Research universe, Build 1: the stock directory generator (founder rulings RU-1 to RU-5 of Nov 26, 2026;
// build prompt section 3.1; census docs/audits/20261126_RESEARCH_UNIVERSE_CENSUS.md Part G, row G1).
//
// Run by hand, monthly (RU-4). It writes api/_utils/researchDirectory.js: every US-listed common stock (ADRs
// included) on NYSE, NASDAQ or NYSE American at or above a $1 billion market value, whose screener sector maps to
// one of the 11 house sector ids (RU-3), with a name, and that is not one of the 228 game stocks, a sector fund,
// an industry fund, an index symbol or a Practice Field fund. The 228 are never written; researchUniverse.js adds
// them (RU-1: the game list is unchanged).
//
// SOURCE. EODHD's screener (exchange = us, market value at or above the floor, largest first, 100 rows a page),
// joined by code to EODHD's exchange symbol list for US (the listing venue and the instrument type; the
// screener's own `exchange` field says only "US"). The screener's offset stops at 999, so a pass reads at most
// 1,000 rows; the next pass starts at or below the smallest market value seen and drops rows already held.
// It never calls fundamentals or bulk fundamentals (build prompt section 2).
//
// COST (measured Nov 26, 2026 by the plan probe, before and after on EODHD's user endpoint): screener 5 a
// request, exchange symbol list 1, user endpoint 0. The script counts what it spends and aborts before any
// request that would take it above CALL_CEILING (1,500).
//
// USAGE
//   node --env-file=<path to .env.local> scripts/build-research-directory.mjs [--run-dir <dir>]
//   node scripts/build-research-directory.mjs --from-raw <run-dir>/raw.json [--run-dir <dir>]
//     --from-raw rebuilds from a saved fetch with no network call.
//   EODHD_API_KEY is read from .env.local at the project root if present, else from the environment. It is never
//   printed.
//
// OUTPUT
//   api/_utils/researchDirectory.js (LF), and in the run directory (default: the OS temp dir, never the repo):
//   raw.json (every screener row with its market value, and the exchange symbol list) and run-report.json (every
//   dropped row with its reason, the 228 sector check, the counts, the spend).
//
// Imports are pure data modules only; importing this file makes no call (the main() guard at the bottom).

/* global process -- Node script; eslint.config.js provides only browser globals */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALL_TICKERS,
  INDUSTRY_ETFS,
  RETIRED_STOCKS,
  SECTOR_ETFS,
  STOCK_UNIVERSE,
  TICKER_TO_SECTOR,
} from '../api/_utils/rankingConfig.js';
import { INDEX_SYMBOLS as INDEX_REGISTRY_SYMBOLS } from '../api/_utils/indexRegistry.js';
import { INDEX_SYMBOLS as INTRADAY_INDEX_SYMBOLS } from '../api/_utils/intraday/universe.js';
import { INDEX_NAMES } from '../api/_utils/sharedResearch/stepSchema.js';
import { INDEX_SUBJECTS } from '../api/_utils/wireContracts.js';
import { PRACTICE_FIELD_FUNDS } from '../src/data/practiceFieldFunds.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const PROJECT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
export const DIRECTORY_PATH = path.join(PROJECT_ROOT, 'api', '_utils', 'researchDirectory.js');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const API_BASE = 'https://eodhd.com/api';
/** RU-2: about $1 billion market value and up. */
export const FLOOR_USD = 1_000_000_000;
export const PAGE_LIMIT = 100;
/** The screener's largest accepted offset. */
export const MAX_OFFSET = 999;
export const CALL_CEILING = 1500;
/** Calls each request kind costs (measured by the plan probe, Nov 26, 2026). */
export const CALL_COST = Object.freeze({ screener: 5, exchangeList: 1, user: 0 });
/** Build prompt section 3.1: a final count outside this range means a filter is wrong; nothing is written. */
export const COUNT_MIN = 1000;
export const COUNT_MAX = 5000;

/** NYSE American appears in EODHD's exchange symbol list under both its old name (AMEX) and NYSE MKT. */
export const KEPT_EXCHANGES = Object.freeze(['NYSE', 'NASDAQ', 'AMEX', 'NYSE MKT']);
/** EODHD types an ADR on those exchanges "Common Stock" (TSM, NVO, SHEL, ASML were checked by the probe). */
export const KEPT_TYPE = 'Common Stock';

export const HOUSE_SECTOR_IDS = Object.freeze(Object.keys(STOCK_UNIVERSE));

// EODHD sector strings (both spellings) to the 11 house sector ids. COPIED from
// scripts/fetch-ticker-industries.js:81-101 (GICS_SECTOR_TO_OUR_ID), which cannot be imported: it runs a full
// 228-symbol fundamentals fetch at import. build-research-directory.test.js reads that file as text and fails if
// the two maps ever differ.
export const EODHD_SECTOR_TO_HOUSE_ID = Object.freeze({
  'Information Technology': 'XLK',
  'Health Care': 'XLV',
  'Financials': 'XLF',
  'Energy': 'XLE',
  'Consumer Discretionary': 'XLY',
  'Consumer Staples': 'XLP',
  'Industrials': 'XLI',
  'Materials': 'XLB',
  'Utilities': 'XLU',
  'Real Estate': 'XLRE',
  'Communication Services': 'XLC',
  'Technology': 'XLK',
  'Healthcare': 'XLV',
  'Financial Services': 'XLF',
  'Consumer Cyclical': 'XLY',
  'Consumer Defensive': 'XLP',
  'Basic Materials': 'XLB',
});

/** Symbols never written to the directory besides the 228: sector funds, industry funds, index symbols, Practice Field funds. */
export const EXCLUDED_SYMBOLS = Object.freeze(new Set([
  ...SECTOR_ETFS,
  ...Object.values(INDUSTRY_ETFS).flat(),
  ...INDEX_REGISTRY_SYMBOLS,
  ...INTRADAY_INDEX_SYMBOLS,
  ...INDEX_NAMES,
  ...INDEX_SUBJECTS,
  ...Object.keys(PRACTICE_FIELD_FUNDS),
]));

// ---------------------------------------------------------------------------
// Pure parts
// ---------------------------------------------------------------------------

/** The house symbol shape: what api/_utils/sharedResearch/companies.js resolveSymbol accepts. */
export const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,11}$/;

/** House spelling: upper case, a share class with a hyphen (BRK.B becomes BRK-B, as ALL_TICKERS writes it). Null when malformed. */
export function houseSpelling(code) {
  if (typeof code !== 'string') return null;
  const s = code.trim().toUpperCase().replace(/\./g, '-');
  return SYMBOL_PATTERN.test(s) ? s : null;
}

/** The house sector id for an EODHD sector string, or null when it maps to none (RU-3). */
export function houseSectorOf(sector) {
  if (typeof sector !== 'string') return null;
  const s = sector.trim();
  return Object.hasOwn(EODHD_SECTOR_TO_HOUSE_ID, s) ? EODHD_SECTOR_TO_HOUSE_ID[s] : null;
}

// Control characters, zero-width characters, bidi controls and the byte-order mark (written as escapes on purpose).
const INVISIBLE = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF]', 'g');

/** A display string with invisible characters removed and whitespace collapsed; '' when absent. */
export function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

export class CallCeilingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CallCeilingError';
  }
}

/** Counts what the run spends; refuses (throws CallCeilingError) any request that would take it above the ceiling. */
export function createCallBudget(ceiling = CALL_CEILING, costs = CALL_COST) {
  let spent = 0;
  let requests = 0;
  const byKind = {};
  return {
    spend(kind) {
      const cost = costs[kind];
      if (!Number.isFinite(cost)) throw new Error(`unknown request kind "${kind}"`);
      if (spent + cost > ceiling) {
        throw new CallCeilingError(`call ceiling ${ceiling} reached: ${spent} spent, the next ${kind} request costs ${cost}`);
      }
      spent += cost;
      requests += 1;
      byKind[kind] = (byKind[kind] || 0) + 1;
      return spent;
    },
    get spent() { return spent; },
    get requests() { return requests; },
    get byKind() { return { ...byKind }; },
  };
}

/** The screener filters for one pass: the floor, the pass's upper bound (none on the first pass), US. */
export function screenerFilters({ floor = FLOOR_USD, upper = null } = {}) {
  const filters = [['market_capitalization', '>=', floor]];
  if (upper !== null) filters.push(['market_capitalization', '<=', upper]);
  filters.push(['exchange', '=', 'us']);
  return filters;
}

/**
 * Every screener row at or above the floor, largest first, read in passes of at most (maxOffset / limit + 1)
 * pages. A pass that fills every page is followed by one bounded at or below the smallest market value it saw
 * (at or below, not strictly below, so rows tied at the boundary are never lost); rows already held are counted
 * as repeats, never kept twice. Ends when a page returns fewer rows than it asked for. A pass that adds no new
 * row stops the run (no progress), as does a malformed page.
 *
 * fetchPage({ upper, offset, limit }) returns the page's rows (an array).
 */
export async function fetchAllScreenerRows({ fetchPage, floor = FLOOR_USD, limit = PAGE_LIMIT, maxOffset = MAX_OFFSET, log = () => {} }) {
  const held = new Map();
  const passes = [];
  let upper = null;
  for (let pass = 1; ; pass += 1) {
    const record = { pass, upper, pages: 0, rows: 0, added: 0, repeats: 0, smallestMarketValue: null };
    let smallest = Infinity;
    let finished = false;
    for (let offset = 0; offset <= maxOffset; offset += limit) {
      const rows = await fetchPage({ upper, offset, limit, floor });
      if (!Array.isArray(rows)) throw new Error(`screener pass ${pass} offset ${offset}: the page is not a list of rows`);
      record.pages += 1;
      record.rows += rows.length;
      for (const row of rows) {
        const mv = Number(row?.market_capitalization);
        if (Number.isFinite(mv) && mv < smallest) smallest = mv;
        const key = typeof row?.code === 'string' ? row.code : `#malformed-${held.size}`;
        if (held.has(key)) {
          record.repeats += 1;
          continue;
        }
        held.set(key, row);
        record.added += 1;
      }
      if (rows.length < limit) {
        finished = true;
        break;
      }
    }
    record.smallestMarketValue = Number.isFinite(smallest) ? smallest : null;
    passes.push(record);
    log(`[screener] pass ${pass}: ${record.pages} pages, ${record.rows} rows, ${record.added} new, ${record.repeats} repeats, smallest ${record.smallestMarketValue}`);
    if (finished) return { rows: [...held.values()], passes };
    if (record.added === 0) throw new Error(`screener pass ${pass} added no new row; paging stopped (no progress)`);
    if (!Number.isFinite(smallest)) throw new Error(`screener pass ${pass} carried no market value to page below`);
    upper = smallest;
  }
}

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Applies the build prompt's filters (section 3.1) to the screener rows joined to the exchange symbol list.
 * Every row not kept is recorded in `dropped` with the first rule it failed; a row of the 228 is recorded in
 * `gameRows` (for the sector check) and never kept.
 */
export function buildDirectory({
  screenerRows,
  exchangeList,
  floor = FLOOR_USD,
  gameTickers = ALL_TICKERS,
  gameSectorOf = (s) => TICKER_TO_SECTOR[s],
  excluded = EXCLUDED_SYMBOLS,
}) {
  const listings = new Map();
  const listingRepeats = [];
  for (const row of exchangeList) {
    const symbol = houseSpelling(row?.Code);
    if (!symbol) continue;
    if (listings.has(symbol)) {
      listingRepeats.push(symbol);
      continue;
    }
    listings.set(symbol, row);
  }
  const game = new Set(gameTickers);
  const kept = new Map();
  const dropped = [];
  const gameRows = [];
  const sectorStrings = {};
  let nameFromExchangeList = 0;

  for (const row of screenerRows) {
    const code = typeof row?.code === 'string' ? row.code : null;
    const symbol = houseSpelling(code);
    const marketValue = Number(row?.market_capitalization);
    const sectorString = cleanText(row?.sector);
    sectorStrings[sectorString || '(empty)'] = (sectorStrings[sectorString || '(empty)'] || 0) + 1;
    const listing = symbol ? listings.get(symbol) : undefined;
    const drop = (reason) => dropped.push({
      code,
      symbol,
      reason,
      name: cleanText(row?.name) || null,
      sector: sectorString || null,
      industry: cleanText(row?.industry) || null,
      marketValue: Number.isFinite(marketValue) ? marketValue : null,
      exchange: listing?.Exchange ?? null,
      type: listing?.Type ?? null,
    });

    if (!symbol) { drop('bad_symbol'); continue; }
    if (!(marketValue >= floor)) { drop('below_floor'); continue; }
    if (game.has(symbol)) {
      gameRows.push({ symbol, sector: sectorString || null, mapped: houseSectorOf(sectorString), house: gameSectorOf(symbol) ?? null, marketValue });
      continue;
    }
    if (kept.has(symbol)) { drop('repeat_symbol'); continue; }
    if (!listing) { drop('not_in_exchange_list'); continue; }
    if (!KEPT_EXCHANGES.includes(listing.Exchange)) { drop('exchange'); continue; }
    if (listing.Type !== KEPT_TYPE) { drop('type'); continue; }
    const sector = houseSectorOf(sectorString);
    if (!sector) { drop('sector_unmapped'); continue; }
    let name = cleanText(row?.name);
    if (!name) {
      name = cleanText(listing.Name);
      if (name) nameFromExchangeList += 1;
    }
    if (!name) { drop('no_name'); continue; }
    if (excluded.has(symbol)) { drop('fund_or_index'); continue; }
    kept.set(symbol, {
      symbol,
      name,
      sector,
      industry: cleanText(row?.industry) || null,
      marketValue,
      exchange: listing.Exchange,
    });
  }

  const entries = [...kept.values()].sort((a, b) => byCodePoint(a.symbol, b.symbol));
  return { entries, dropped, gameRows, sectorStrings, listingRepeats, nameFromExchangeList };
}

/** Throws when the final count is outside [COUNT_MIN, COUNT_MAX]: a filter is wrong, and nothing is written. */
export function checkCount(count, { min = COUNT_MIN, max = COUNT_MAX } = {}) {
  if (!(count >= min && count <= max)) {
    throw new Error(`directory count ${count} is outside ${min} to ${max}; a filter is wrong, nothing written`);
  }
  return count;
}

const fmtInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** The generated module's text: a header, then one entry per line sorted by symbol, LF line endings. */
export function renderDirectoryModule({ entries, generatedOn, floor = FLOOR_USD }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(generatedOn))) throw new Error(`generatedOn must be YYYY-MM-DD, got ${generatedOn}`);
  const sorted = [...entries].sort((a, b) => byCodePoint(a.symbol, b.symbol));
  const perSector = Object.fromEntries(HOUSE_SECTOR_IDS.map((id) => [id, 0]));
  for (const e of sorted) perSector[e.sector] += 1;
  const lines = [
    '// api/_utils/researchDirectory.js',
    '//',
    '// GENERATED: generated by scripts/build-research-directory.mjs; do not edit by hand.',
    '//',
    '// The research directory (research universe Build 1; founder rulings RU-1 to RU-5 of Nov 26, 2026): US-listed',
    '// companies at or above the floor, each with a name, a house sector id and an industry. The 228 game stocks are',
    '// not here; api/_utils/researchUniverse.js adds them. Rebuilt monthly by re-running the script (RU-4).',
    '//',
    `// Generated: ${generatedOn}`,
    `// Count: ${fmtInt(sorted.length)}`,
    `// Floor: market value at or above $${fmtInt(floor)} (EODHD screener, on the day generated; no market values are stored)`,
    '// Kept: listed on NYSE, NASDAQ or NYSE American; EODHD type Common Stock (ADRs included); a screener sector that',
    '// maps to one of the 11 house sector ids; a name; not a sector fund, industry fund, index symbol or Practice',
    '// Field fund.',
    '// Industry: the screener\'s own industry string, not the GICS industry rankingConfig.js STOCK_INDUSTRIES holds.',
    `// Per sector: ${HOUSE_SECTOR_IDS.map((id) => `${id} ${perSector[id]}`).join(', ')}`,
    '//',
    '// Each entry: symbol, then name, house sector id, industry (null when the screener gave none).',
    '',
    'export const RESEARCH_DIRECTORY_META = Object.freeze({',
    `  generatedOn: ${JSON.stringify(generatedOn)},`,
    `  count: ${sorted.length},`,
    `  floorUsd: ${floor},`,
    '});',
    '',
    'export const RESEARCH_DIRECTORY = Object.freeze({',
    ...sorted.map((e) => `  ${JSON.stringify(e.symbol)}: [${JSON.stringify(e.name)}, ${JSON.stringify(e.sector)}, ${e.industry === null ? 'null' : JSON.stringify(e.industry)}],`),
    '});',
    'for (const entry of Object.values(RESEARCH_DIRECTORY)) Object.freeze(entry);',
    '',
  ];
  return lines.join('\n');
}

/** The run's report (written to the run directory, never the repo). */
export function summarizeRun({ build, passes, spend, gameTickers = ALL_TICKERS, retired = RETIRED_STOCKS, watch = [] }) {
  const { entries, dropped, gameRows } = build;
  const bySymbol = new Map(entries.map((e) => [e.symbol, e]));
  const droppedBySymbol = new Map(dropped.filter((d) => d.symbol).map((d) => [d.symbol, d]));
  const perSector = Object.fromEntries(HOUSE_SECTOR_IDS.map((id) => [id, 0]));
  for (const e of entries) perSector[e.sector] += 1;
  const dropCounts = {};
  for (const d of dropped) dropCounts[d.reason] = (dropCounts[d.reason] || 0) + 1;
  const returnedGame = new Set(gameRows.map((g) => g.symbol));
  const landing = (symbol) => {
    if (bySymbol.has(symbol)) return { symbol, landed: 'directory', name: bySymbol.get(symbol).name, sector: bySymbol.get(symbol).sector };
    if (droppedBySymbol.has(symbol)) return { symbol, landed: 'absent', reason: droppedBySymbol.get(symbol).reason, row: droppedBySymbol.get(symbol) };
    return { symbol, landed: 'absent', reason: 'not_returned_by_screener' };
  };
  return {
    count: entries.length,
    perSector,
    spend,
    passes,
    dropCounts,
    sectorStrings: build.sectorStrings,
    unmappedSectorStrings: Object.keys(build.sectorStrings).filter((s) => !houseSectorOf(s === '(empty)' ? '' : s)),
    nameFromExchangeList: build.nameFromExchangeList,
    listingRepeats: build.listingRepeats,
    gameSectorMismatches: gameRows.filter((g) => g.mapped !== g.house),
    gameReturned: returnedGame.size,
    gameNotReturned: gameTickers.filter((s) => !returnedGame.has(s)),
    retired: Object.keys(retired).map(landing),
    watch: watch.map(landing),
    hyphenated: entries.filter((e) => e.symbol.includes('-')).map((e) => ({ symbol: e.symbol, name: e.name, exchange: e.exchange })),
    lowest20: [...entries].sort((a, b) => a.marketValue - b.marketValue).slice(0, 20),
    dropped,
  };
}

// ---------------------------------------------------------------------------
// Env (COPIED from scripts/fetch-ticker-industries.js:108-128, parseEnvFile)
// ---------------------------------------------------------------------------

export function parseEnvFile(filePath) {
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

// ---------------------------------------------------------------------------
// Network (injected fetchJson; the key never leaves the URL and is never printed)
// ---------------------------------------------------------------------------

/** The plain fetch used by the CLI. Error messages carry the request label and status, never the URL. */
export async function fetchJsonOverNetwork(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return res.json();
}

/** One fetch of everything the build needs, under the budget. */
export async function fetchSources({ apiKey, fetchJson, budget, floor = FLOOR_USD, log = () => {} }) {
  const token = `api_token=${encodeURIComponent(apiKey)}&fmt=json`;
  const user = async (label) => {
    budget.spend('user');
    const u = await fetchJson(`${API_BASE}/user?${token}`, label);
    return { apiRequests: u?.apiRequests ?? null, apiRequestsDate: u?.apiRequestsDate ?? null, dailyRateLimit: u?.dailyRateLimit ?? null, extraLimit: u?.extraLimit ?? null };
  };
  const before = await user('user (before)');
  budget.spend('exchangeList');
  const exchangeList = await fetchJson(`${API_BASE}/exchange-symbol-list/US?${token}`, 'exchange symbol list');
  if (!Array.isArray(exchangeList)) throw new Error('exchange symbol list: not a list');
  log(`[exchange list] ${exchangeList.length} rows`);
  const screener = await fetchAllScreenerRows({
    floor,
    log,
    fetchPage: async ({ upper, offset, limit }) => {
      budget.spend('screener');
      const filters = encodeURIComponent(JSON.stringify(screenerFilters({ floor, upper })));
      const body = await fetchJson(
        `${API_BASE}/screener?${token}&filters=${filters}&sort=market_capitalization.desc&limit=${limit}&offset=${offset}`,
        `screener (upper ${upper}, offset ${offset})`,
      );
      return body?.data;
    },
  });
  const after = await user('user (after)');
  return { before, after, exchangeList, screener };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const opts = { runDir: null, fromRaw: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--run-dir') opts.runDir = argv[++i];
    else if (a === '--from-raw') opts.fromRaw = argv[++i];
    else throw new Error(`unknown argument ${a}`);
    if (opts.runDir === undefined || opts.fromRaw === undefined) throw new Error(`${a} needs a value`);
  }
  return opts;
}

/** Today's date in New York (the house calendar), YYYY-MM-DD. */
export const etDate = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

export async function runMain({
  argv = [],
  env = {},
  fetchJson = fetchJsonOverNetwork,
  readFile = (p) => readFileSync(p, 'utf8'),
  writeFile = (p, text) => writeFileSync(p, text),
  makeDir = (p) => mkdirSync(p, { recursive: true }),
  nowMs = Date.now(),
  outPath = DIRECTORY_PATH,
  defaultRunDir = path.join(os.tmpdir(), 'research-directory'),
  watch = ['GLW', 'HPE', 'ANET', 'MRVL', 'COHR', 'CIEN', 'VRT'],
  log = (line) => console.error(line),
}) {
  const opts = parseArgs(argv);
  const runDir = opts.runDir || defaultRunDir;
  makeDir(runDir);

  let raw;
  let spend;
  if (opts.fromRaw) {
    raw = JSON.parse(readFile(opts.fromRaw));
    spend = { ...raw.spend, rebuiltFromRaw: true };
    log(`[raw] rebuilt from ${opts.fromRaw}, no network call`);
  } else {
    const apiKey = env.EODHD_API_KEY;
    if (!apiKey) throw new Error('EODHD_API_KEY missing from .env.local and the environment');
    const budget = createCallBudget();
    let fetched;
    try {
      fetched = await fetchSources({ apiKey, fetchJson, budget, log });
    } finally {
      log(`[spend] counted ${budget.spent} calls in ${budget.requests} requests ${JSON.stringify(budget.byKind)}`);
    }
    spend = {
      counted: budget.spent,
      requests: budget.requests,
      byKind: budget.byKind,
      measured: fetched.after.apiRequests !== null && fetched.before.apiRequests !== null ? fetched.after.apiRequests - fetched.before.apiRequests : null,
      before: fetched.before,
      after: fetched.after,
    };
    raw = {
      fetchedOn: etDate(nowMs),
      fetchedAt: new Date(nowMs).toISOString(),
      floor: FLOOR_USD,
      spend,
      passes: fetched.screener.passes,
      screenerRows: fetched.screener.rows,
      exchangeList: fetched.exchangeList,
    };
    writeFile(path.join(runDir, 'raw.json'), JSON.stringify(raw));
  }

  const build = buildDirectory({ screenerRows: raw.screenerRows, exchangeList: raw.exchangeList, floor: raw.floor });
  const report = summarizeRun({ build, passes: raw.passes, spend, watch });
  writeFile(path.join(runDir, 'run-report.json'), JSON.stringify(report, null, 2));
  log(`[build] ${build.entries.length} kept, ${build.dropped.length} dropped ${JSON.stringify(report.dropCounts)}; ${build.gameRows.length} game rows`);
  checkCount(build.entries.length);
  writeFile(outPath, renderDirectoryModule({ entries: build.entries, generatedOn: raw.fetchedOn, floor: raw.floor }));
  log(`[write] ${outPath}: ${build.entries.length} entries`);
  return { report, build };
}

/** An error line with the key cut out, should any message ever carry it. */
export const redactedLine = (err, key) => {
  const text = `FATAL: ${err?.message ?? err}`;
  return key ? text.split(key).join('<key>') : text;
};

async function main() {
  const fileEnv = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const env = { EODHD_API_KEY: fileEnv.EODHD_API_KEY || process.env.EODHD_API_KEY };
  try {
    await runMain({ argv: process.argv.slice(2), env });
  } catch (err) {
    console.error(redactedLine(err, env.EODHD_API_KEY));
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && SCRIPT_PATH === path.resolve(process.argv[1]);
if (invokedDirectly) main();
