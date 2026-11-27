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
// CORRECTIONS (Build 2, PR A; rulings RU-6, RU-7, RU-8, RU-11, RU-13): every run applies the named list in
// scripts/research-directory-corrections.mjs (validateCorrections first; a malformed list writes nothing). The venue
// and restore corrections each relax one filter for the rows they name, and every other filter still applies; the
// leave-outs and sector fixes are applied after the filters. The run report lists every correction applied, every
// stale one (a symbol the fetch does not hold) and every one with no effect, every retired game symbol found in the
// directory (RU-14), and the rows that entered, left or changed against the directory the run replaces.
// buildDirectory's own default is no corrections; runMain passes the list.
//
// Imports are pure data modules only; importing this file makes no call (the main() guard at the bottom).

/* global process -- Node script; eslint.config.js provides only browser globals */

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
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
import { DIRECTORY_CORRECTIONS } from './research-directory-corrections.mjs';

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

/**
 * NYSE and NYSE American symbols have a root of 1 to 4 letters (a share class follows a hyphen). EODHD's exchange
 * list labels some OTC lines "NYSE" (unsponsored ADRs and foreign ordinaries such as FJIKY, GALDY, RSHGY in the Nov 26
 * run), so a longer root on those venues is an OTC line and is dropped ("not OTC, not pink sheets"). NASDAQ roots run
 * to 5 letters (RYAAY, FWONK) and are not affected.
 */
export const NYSE_FAMILY = Object.freeze(['NYSE', 'AMEX', 'NYSE MKT']);
export const NYSE_ROOT_MAX = 4;
export const otcShapedOnNyseFamily = (symbol, exchange) => NYSE_FAMILY.includes(exchange) && symbol.split('-')[0].length > NYSE_ROOT_MAX;

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

/** No corrections: buildDirectory's default (the filters alone). */
export const NO_CORRECTIONS = Object.freeze({
  leaveOut: Object.freeze([]), sectorFix: Object.freeze([]), restore: Object.freeze([]), venues: Object.freeze([]),
});
export const LEAVE_OUT_KINDS = Object.freeze(['closed_end_fund', 'debt', 'shell', 'game_share_class']);

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
 * row stops the run (no progress), as does a malformed page, and so does a repeat at any value but the pass's bound:
 * it means the screener's order moved between two page calls, and another row may never have been served.
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
          // The only expected repeat is a row tied at the pass's bound (the edge of the pass before). Any other
          // means the screener's order moved between two page calls, and some other row may never have been served.
          if (upper === null || mv !== upper) {
            throw new Error(`screener pass ${pass} offset ${offset}: ${key} came back inside pass ${pass} at ${mv}, not at the pass's bound; the order moved between pages and a row may have been skipped (re-run)`);
          }
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
  corrections = NO_CORRECTIONS,
}) {
  validateCorrections(corrections, { gameTickers });
  const extraVenues = new Set(corrections.venues.map((v) => v.exchange));
  const restored = new Set(corrections.restore.map((r) => r.symbol));
  const relaxedBy = new Map();
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
    let relaxed = null;
    if (!KEPT_EXCHANGES.includes(listing.Exchange)) {
      // RU-8: a correction venue relaxes this filter only; the type filter and every later one still apply.
      if (!extraVenues.has(listing.Exchange)) { drop('exchange'); continue; }
      relaxed = 'venue';
    }
    if (otcShapedOnNyseFamily(symbol, listing.Exchange)) { drop('otc_shaped_code'); continue; }
    if (listing.Type !== KEPT_TYPE) {
      // RU-11: a restored symbol passes the type filter only; it still needs a mapped sector and a name.
      if (!restored.has(symbol)) { drop('type'); continue; }
      relaxed = 'restore';
    }
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
    if (relaxed) relaxedBy.set(symbol, relaxed);
  }

  const correctionReport = applyCorrectionsAfterFilters({ kept, dropped, relaxedBy, corrections, screenerRows });
  const entries = [...kept.values()].sort((a, b) => byCodePoint(a.symbol, b.symbol));
  return { entries, dropped, gameRows, sectorStrings, listingRepeats, nameFromExchangeList, corrections: correctionReport };
}

/**
 * Throws on a malformed corrections list, so a run with one writes nothing: every symbol in house spelling and named
 * once across leave-outs, sector fixes and restores; none of the 228 (they never reach the directory); a known
 * leave-out kind; a house sector id and an industry on a sector fix; a venue that is not already kept; a ruling and a
 * reason on every entry.
 */
export function validateCorrections(corrections, { gameTickers = ALL_TICKERS } = {}) {
  const problems = [];
  const game = new Set(gameTickers);
  const seen = new Map();
  for (const list of ['leaveOut', 'sectorFix', 'restore', 'venues']) {
    if (!Array.isArray(corrections?.[list])) { problems.push(`${list} is not a list`); continue; }
    for (const [i, e] of corrections[list].entries()) {
      const at = `${list}[${i}]`;
      if (!(typeof e?.ruling === 'string' && /^RU-\d+$/.test(e.ruling))) problems.push(`${at} has no ruling`);
      if (!(typeof e?.reason === 'string' && e.reason.trim().length > 0)) problems.push(`${at} has no reason`);
      if (list === 'venues') {
        if (!(typeof e?.exchange === 'string' && e.exchange.length > 0)) problems.push(`${at} has no exchange`);
        else if (KEPT_EXCHANGES.includes(e.exchange)) problems.push(`${at}: ${e.exchange} is already kept`);
        continue;
      }
      const symbol = e?.symbol;
      if (typeof symbol !== 'string' || houseSpelling(symbol) !== symbol) { problems.push(`${at} has a malformed symbol ${JSON.stringify(symbol)}`); continue; }
      if (game.has(symbol)) problems.push(`${at}: ${symbol} is one of the 228, which never reach the directory`);
      if (seen.has(symbol)) problems.push(`${at}: ${symbol} is already named at ${seen.get(symbol)}`);
      else seen.set(symbol, at);
      if (list === 'leaveOut' && !LEAVE_OUT_KINDS.includes(e.kind)) problems.push(`${at}: unknown kind ${JSON.stringify(e.kind)}`);
      if (list === 'sectorFix') {
        if (!HOUSE_SECTOR_IDS.includes(e.sector)) problems.push(`${at}: ${JSON.stringify(e.sector)} is not a house sector id`);
        if (!(typeof e.industry === 'string' && e.industry.trim().length > 0)) problems.push(`${at} has no industry`);
      }
    }
  }
  if (problems.length > 0) throw new Error(`corrections list is malformed, nothing written: ${problems.join('; ')}`);
  return true;
}

/**
 * The leave-outs and sector fixes, applied to the kept rows after the filters (mutates `kept` and `dropped`), and the
 * account of every correction: applied, stale (no screener row names the symbol) or no effect (the row was dropped by
 * a filter first; the filter is named).
 */
function applyCorrectionsAfterFilters({ kept, dropped, relaxedBy, corrections, screenerRows }) {
  const fetched = new Set();
  for (const row of screenerRows) {
    const s = houseSpelling(typeof row?.code === 'string' ? row.code : null);
    if (s) fetched.add(s);
  }
  const dropReason = (symbol) => dropped.find((d) => d.symbol === symbol)?.reason ?? null;
  const applied = [];
  const stale = [];
  const noEffect = [];
  const account = (kind, e, ok, detail) => {
    if (ok) applied.push({ kind, symbol: e.symbol, ruling: e.ruling, ...detail });
    else if (!fetched.has(e.symbol)) stale.push({ kind, symbol: e.symbol, ruling: e.ruling });
    else noEffect.push({ kind, symbol: e.symbol, ruling: e.ruling, droppedBy: dropReason(e.symbol), ...detail });
  };

  for (const e of corrections.leaveOut) {
    const row = kept.get(e.symbol);
    if (row) {
      kept.delete(e.symbol);
      relaxedBy.delete(e.symbol);
      dropped.push({ code: e.symbol, symbol: e.symbol, reason: 'correction_leave_out', name: row.name, sector: row.sector, industry: row.industry, marketValue: row.marketValue, exchange: row.exchange, type: null, correction: { kind: e.kind, ruling: e.ruling } });
    }
    account(`leave_out:${e.kind}`, e, Boolean(row), row ? { name: row.name } : {});
  }
  for (const e of corrections.sectorFix) {
    const row = kept.get(e.symbol);
    const detail = row ? { name: row.name, from: [row.sector, row.industry], to: [e.sector, e.industry] } : {};
    if (row) { row.sector = e.sector; row.industry = e.industry; }
    account('sector_fix', e, Boolean(row), detail);
  }
  for (const e of corrections.restore) {
    const row = kept.get(e.symbol);
    const entered = Boolean(row) && relaxedBy.get(e.symbol) === 'restore';
    // Kept with no help from the correction (the vendor's type is now right): no effect, recorded so the review drops it.
    if (row && !entered) noEffect.push({ kind: 'restore', symbol: e.symbol, ruling: e.ruling, droppedBy: null, note: 'kept by the filters alone' });
    else account('restore', e, entered, row ? { name: row.name, sector: row.sector } : {});
  }
  const venueAdmitted = [...relaxedBy].filter(([, why]) => why === 'venue').map(([symbol]) => kept.get(symbol))
    .filter(Boolean).sort((a, b) => byCodePoint(a.symbol, b.symbol))
    .map((r) => ({ symbol: r.symbol, name: r.name, exchange: r.exchange, sector: r.sector }));
  for (const v of corrections.venues) {
    const admitted = venueAdmitted.filter((r) => r.exchange === v.exchange);
    applied.push({ kind: 'venue', exchange: v.exchange, ruling: v.ruling, admitted: admitted.map((r) => r.symbol) });
  }
  return { applied, stale, noEffect, venueAdmitted };
}

/** Entries of a generated directory module, read back from its text: { symbol: [name, sector, industry] }. */
export function parseDirectoryModuleEntries(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    if (!/^ {2}"[^"]+": \[/.test(line)) continue;
    Object.assign(out, JSON.parse(`{${line.trim().replace(/,$/, '')}}`));
  }
  return out;
}

/** The rows that entered, left or changed (name, sector or industry) against the directory a run replaces. */
export function diffDirectories(previous, entries) {
  const next = Object.fromEntries(entries.map((e) => [e.symbol, [e.name, e.sector, e.industry]]));
  const prevSyms = Object.keys(previous ?? {});
  const row = (symbol, [name, sector, industry]) => ({ symbol, name, sector, industry });
  return {
    before: previous ? prevSyms.length : null,
    after: entries.length,
    entered: Object.keys(next).filter((s) => !Object.hasOwn(previous ?? {}, s)).sort(byCodePoint).map((s) => row(s, next[s])),
    left: prevSyms.filter((s) => !Object.hasOwn(next, s)).sort(byCodePoint).map((s) => row(s, previous[s])),
    changed: prevSyms.filter((s) => Object.hasOwn(next, s) && JSON.stringify(previous[s]) !== JSON.stringify(next[s])).sort(byCodePoint)
      .map((s) => ({ symbol: s, from: previous[s], to: next[s] })),
  };
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
export function renderDirectoryModule({ entries, generatedOn, floor = FLOOR_USD, corrected = false }) {
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
    `// Floor: market value at or above $${fmtInt(floor)} (the screener's latest market values when generated; no market values are stored)`,
    '// Kept: listed on NYSE, NASDAQ or NYSE American (on NYSE and NYSE American a root of at most 4 letters; a longer',
    '// code there is an OTC line); EODHD type Common Stock (ADRs included); a screener sector that maps to one of the',
    '// 11 house sector ids; a name; not a sector fund, industry fund, index symbol or Practice Field fund.',
    ...(corrected ? [
      '// Corrections: the named list in scripts/research-directory-corrections.mjs (rulings RU-6, RU-7, RU-8, RU-11, RU-13)',
      '// is applied on every run: closed-end funds, debt and shells the vendor types Common Stock are left out, as are second',
      '// share classes of game stocks; wrong vendor sectors are fixed; common shares the vendor types Preferred are restored;',
      '// common stock listed on BATS is kept.',
    ] : []),
    '// Sector: the screener\'s own sector words (Morningstar-style) mapped to a house sector id; they can differ from GICS.',
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
export function summarizeRun({ build, passes, spend, gameTickers = ALL_TICKERS, retired = RETIRED_STOCKS, watch = [], previous = null }) {
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
    // RU-14: every retired game symbol that appears in the directory (nothing changes for it now; each rebuild reports it).
    retiredInDirectory: entries.filter((e) => Object.hasOwn(retired, e.symbol)).map((e) => ({ symbol: e.symbol, name: e.name, sector: e.sector })),
    corrections: build.corrections ?? null,
    againstPrevious: diffDirectories(previous, entries),
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
  corrections = DIRECTORY_CORRECTIONS,
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
    const measured = fetched.after.apiRequests !== null && fetched.before.apiRequests !== null ? fetched.after.apiRequests - fetched.before.apiRequests : null;
    spend = {
      counted: budget.spent,
      requests: budget.requests,
      byKind: budget.byKind,
      measured,
      // A warning, not a stop: the key may be shared with jobs that spend calls during the run.
      measuredAboveCounted: measured !== null && measured > budget.spent,
      before: fetched.before,
      after: fetched.after,
    };
    if (spend.measuredAboveCounted) {
      log(`[spend] WARNING: EODHD counted ${measured} calls on this key during the run, ${budget.spent} by this run's own count: another user of the key, or a changed price (check the screener's cost before trusting the ceiling)`);
    }
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

  const build = buildDirectory({ screenerRows: raw.screenerRows, exchangeList: raw.exchangeList, floor: raw.floor, corrections });
  // The directory this run replaces, read back for the entered / left / changed list (none on a first run).
  let previous = null;
  try { previous = parseDirectoryModuleEntries(readFile(outPath)); } catch { previous = null; }
  const report = summarizeRun({ build, passes: raw.passes, spend, watch, previous });
  writeFile(path.join(runDir, 'run-report.json'), JSON.stringify(report, null, 2));
  log(`[build] ${build.entries.length} kept, ${build.dropped.length} dropped ${JSON.stringify(report.dropCounts)}; ${build.gameRows.length} game rows`);
  const c = report.corrections;
  log(`[corrections] ${c.applied.length} applied, ${c.stale.length} stale${c.stale.length ? ` (${c.stale.map((s) => s.symbol).join(', ')})` : ''}, ${c.noEffect.length} with no effect${c.noEffect.length ? ` (${c.noEffect.map((s) => `${s.symbol}: ${s.droppedBy ?? s.note}`).join(', ')})` : ''}; venue let in ${c.venueAdmitted.map((r) => `${r.symbol} (${r.name})`).join(', ') || 'nothing'}`);
  log(`[retired] retired game symbols in the directory: ${report.retiredInDirectory.map((r) => r.symbol).join(', ') || 'none'}`);
  const d = report.againstPrevious;
  log(`[diff] ${d.before ?? 'no previous directory'} -> ${d.after}: ${d.entered.length} entered, ${d.left.length} left, ${d.changed.length} changed`);
  checkCount(build.entries.length);
  const corrected = ['leaveOut', 'sectorFix', 'restore', 'venues'].some((k) => corrections[k].length > 0);
  writeFile(outPath, renderDirectoryModule({ entries: build.entries, generatedOn: raw.fetchedOn, floor: raw.floor, corrected }));
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

// Compared as real paths: run through a junction or symlink, Node runs the real file (import.meta.url) while argv[1]
// keeps the linked path, and a plain comparison would exit silently without running.
const realOrResolved = (p) => {
  try { return realpathSync(p); } catch { return path.resolve(p); }
};
const invokedDirectly = Boolean(process.argv[1]) && realOrResolved(SCRIPT_PATH) === realOrResolved(process.argv[1]);
if (invokedDirectly) main();
