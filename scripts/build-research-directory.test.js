// scripts/build-research-directory.test.js
//
// Research universe Build 1: the generator's pure parts on fixtures (build prompt section 4). No row makes a
// network call: every fetch is a fake, and importing the script is proven to make none.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ALL_TICKERS, INDUSTRY_ETFS, SECTOR_ETFS, STOCK_UNIVERSE, TICKER_TO_SECTOR,
} from '../api/_utils/rankingConfig.js';
import { PRACTICE_FIELD_FUNDS } from '../src/data/practiceFieldFunds.js';
import { INDEX_SYMBOLS as INDEX_REGISTRY_SYMBOLS } from '../api/_utils/indexRegistry.js';
import { INDEX_SYMBOLS as INTRADAY_INDEX_SYMBOLS } from '../api/_utils/intraday/universe.js';
import { INDEX_NAMES } from '../api/_utils/sharedResearch/stepSchema.js';
import { INDEX_SUBJECTS } from '../api/_utils/wireContracts.js';
import {
  CALL_CEILING, CALL_COST, COUNT_MAX, COUNT_MIN, CallCeilingError, EODHD_SECTOR_TO_HOUSE_ID, EXCLUDED_SYMBOLS,
  FLOOR_USD, HOUSE_SECTOR_IDS, KEPT_EXCHANGES, MAX_OFFSET, PAGE_LIMIT, buildDirectory, checkCount, cleanText,
  createCallBudget, etDate, fetchAllScreenerRows, fetchSources, houseSectorOf, houseSpelling, parseArgs,
  parseEnvFile, redactedLine, renderDirectoryModule, runMain, screenerFilters,
} from './build-research-directory.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OLD_SCRIPT = readFileSync(path.join(HERE, 'fetch-ticker-industries.js'), 'utf8');
const NEW_SCRIPT = readFileSync(path.join(HERE, 'build-research-directory.mjs'), 'utf8');

afterEach(() => { vi.unstubAllGlobals(); });

// ── A fake screener that applies the filters the script sends, sorted largest first ──────────────────────────
function fakeScreener(dataset, { maxOffset = MAX_OFFSET, ignoreUpper = false } = {}) {
  const requests = [];
  const ops = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b, '=': (a, b) => a === b };
  const sorted = [...dataset].sort((a, b) => b.market_capitalization - a.market_capitalization || (a.code < b.code ? -1 : 1));
  const fetchPage = async ({ upper, offset, limit, floor = FLOOR_USD }) => {
    requests.push({ upper, offset, limit });
    if (offset > maxOffset) throw new Error(`fake screener: offset ${offset} above ${maxOffset}`);
    const filters = screenerFilters({ floor, upper: ignoreUpper ? null : upper });
    const rows = sorted.filter((r) => filters.every(([field, op, value]) => (field === 'exchange' ? value === 'us' : ops[op](r[field], value))));
    return rows.slice(offset, offset + limit);
  };
  return { fetchPage, requests };
}
const row = (code, mv, over = {}) => ({ code, name: `${code} Corp`, market_capitalization: mv, sector: 'Technology', industry: 'Software', exchange: 'US', ...over });
const listing = (Code, Exchange = 'NYSE', Type = 'Common Stock', Name = `${Code} Corp`) => ({ Code, Name, Country: 'USA', Exchange, Currency: 'USD', Type, Isin: null });

describe('spelling: the house symbol shape', () => {
  it.each([
    ['BRK.B', 'BRK-B'], ['brk.b', 'BRK-B'], [' AAPL ', 'AAPL'], ['BF.B', 'BF-B'], ['HEI-A', 'HEI-A'], ['GLW', 'GLW'],
  ])('%s is written %s', (code, want) => { expect(houseSpelling(code)).toBe(want); });
  it.each([[''], ['^GSPC'], ['-ABC'], ['ABCDEFGHIJKLM'], ['AB CD'], ['AB/CD'], [null], [undefined], [42]])('%s is refused', (code) => {
    expect(houseSpelling(code)).toBeNull();
  });
  it('accepts exactly what resolveSymbol accepts after its own normalisation (12 characters, hyphen after the first)', () => {
    expect(houseSpelling('ABCDEFGHIJKL')).toBe('ABCDEFGHIJKL');
    expect(houseSpelling('A-')).toBe('A-');
  });
});

describe('the sector map', () => {
  it('is the map in scripts/fetch-ticker-industries.js, pair for pair (read as text: importing it runs a fundamentals fetch)', () => {
    const block = OLD_SCRIPT.slice(OLD_SCRIPT.indexOf('const GICS_SECTOR_TO_OUR_ID = {'), OLD_SCRIPT.indexOf('};', OLD_SCRIPT.indexOf('const GICS_SECTOR_TO_OUR_ID = {')));
    const pairs = [...block.matchAll(/'([^']+)':\s*'([A-Z]+)'/g)].map((m) => [m[1], m[2]]).sort();
    expect(pairs.length).toBe(17);
    expect(Object.entries(EODHD_SECTOR_TO_HOUSE_ID).sort()).toEqual(pairs);
  });
  it('maps both spellings onto the 11 house sector ids and reaches every one', () => {
    expect(new Set(Object.values(EODHD_SECTOR_TO_HOUSE_ID))).toEqual(new Set(HOUSE_SECTOR_IDS));
    expect(HOUSE_SECTOR_IDS).toEqual(Object.keys(STOCK_UNIVERSE));
    for (const [name, id] of Object.entries(EODHD_SECTOR_TO_HOUSE_ID)) expect(houseSectorOf(name)).toBe(id);
    expect(houseSectorOf(' Technology ')).toBe('XLK');
  });
  it.each([[''], ['Other'], ['Financial'], ['Industrial Goods'], ['technology'], ['toString'], ['constructor'], [null]])('%s maps to none (RU-3)', (s) => {
    expect(houseSectorOf(s)).toBeNull();
  });
});

describe('the env loader is the one in scripts/fetch-ticker-industries.js', () => {
  const fn = (text) => {
    const start = text.indexOf('function parseEnvFile(filePath) {');
    return text.slice(start, text.indexOf('\n}\n', start) + 2).replace(/\r/g, '');
  };
  it('has the same body, character for character', () => {
    expect(fn(NEW_SCRIPT.replace(/\r/g, '')).length).toBeGreaterThan(200);
    expect(fn(NEW_SCRIPT.replace(/\r/g, ''))).toBe(fn(OLD_SCRIPT.replace(/\r/g, '')));
  });
  it('reads quoted and bare values and skips comments', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rd-env-'));
    try {
      writeFileSync(path.join(dir, '.env.local'), '# c\nA=1\r\nB="two"\nC=\'three\'\nnoequals\n');
      expect(parseEnvFile(path.join(dir, '.env.local'))).toEqual({ A: '1', B: 'two', C: 'three' });
      expect(parseEnvFile(path.join(dir, 'missing'))).toEqual({});
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('the filter (build prompt section 3.1)', () => {
  const ESL = [
    listing('GLW'), listing('TSM', 'NYSE', 'Common Stock', 'Taiwan Semiconductor Manufacturing'), listing('ARCC', 'NASDAQ'),
    listing('HEI-A'), listing('AMX1', 'AMEX'), listing('MKT1', 'NYSE MKT'),
    listing('CBOE', 'BATS'), listing('NSRGY', 'PINK'), listing('QXQX', 'OTCQX'), listing('ARC1', 'NYSE ARCA'), listing('USUS', 'US'),
    listing('PDI', 'NYSE', 'FUND'), listing('ETF1', 'NYSE', 'ETF'), listing('PFD-P-A', 'NYSE', 'Preferred Stock'),
    listing('NOSEC'), listing('OTHER'), listing('NONAME', 'NYSE', 'Common Stock', ''), listing('ESLNAME', 'NYSE', 'Common Stock', 'Name From List'),
    listing('XLK', 'NYSE'), listing('SMH', 'NASDAQ'), listing('RSP', 'NYSE'), listing('IWM', 'NYSE'), listing('VIX', 'NYSE'),
    listing('AAPL', 'NASDAQ'), listing('V'), listing('BRK-A'), listing('INVIS'), listing('NOIND'), listing('LOW1'),
  ];
  const SCREENER = [
    row('GLW', 3e10), row('TSM', 1e12), row('ARCC', 1.5e10, { sector: 'Financial Services' }), row('HEI.A', 2e10, { sector: 'Industrials' }),
    row('AMX1', 2e9), row('MKT1', 2e9),
    row('CBOE', 2.5e10, { sector: 'Financial Services' }), row('NSRGY', 2.5e11, { sector: 'Consumer Defensive' }), row('QXQX', 5e9), row('ARC1', 5e9), row('USUS', 5e9),
    row('PDI', 5e9), row('ETF1', 5e9), row('PFD-P-A', 5e9),
    row('NOSEC', 5e9, { sector: '' }), row('OTHER', 5e9, { sector: 'Other' }),
    row('NONAME', 5e9, { name: '' }), row('ESLNAME', 5e9, { name: '   ' }),
    row('XLK', 5e9), row('SMH', 5e9), row('RSP', 5e9), row('IWM', 5e9), row('VIX', 5e9),
    row('AAPL', 4e12), row('V', 6e11),
    row('BRK.A', 9e11, { sector: 'Financial Services' }), row('BRK-A', 9e11, { sector: 'Financial Services' }),
    row('INVIS', 5e9, { name: 'Invis​‮ Corp  Inc' }), row('NOIND', 5e9, { industry: '' }),
    row('LOW1', 999_999_999), row('^GSPC', 5e12), row(null, 5e9), row('GONE', 5e9),
  ];
  const out = buildDirectory({ screenerRows: SCREENER, exchangeList: ESL });
  const reason = (code) => out.dropped.find((d) => d.code === code)?.reason;
  const kept = Object.fromEntries(out.entries.map((e) => [e.symbol, e]));

  it('accounts for every screener row: kept, dropped with a reason, or a game row (never dropped silently)', () => {
    expect(out.entries.length + out.dropped.length + out.gameRows.length).toBe(SCREENER.length);
    for (const d of out.dropped) expect(typeof d.reason).toBe('string');
  });
  it('keeps NYSE, NASDAQ and NYSE American (AMEX and NYSE MKT) common stock, ADRs included', () => {
    expect(Object.keys(kept).sort()).toEqual(['AMX1', 'ARCC', 'BRK-A', 'ESLNAME', 'GLW', 'HEI-A', 'INVIS', 'MKT1', 'NOIND', 'TSM']);
    expect(KEPT_EXCHANGES).toEqual(['NYSE', 'NASDAQ', 'AMEX', 'NYSE MKT']);
  });
  it.each([['CBOE'], ['NSRGY'], ['QXQX'], ['ARC1'], ['USUS']])('drops %s by its listing exchange', (code) => { expect(reason(code)).toBe('exchange'); });
  it.each([['PDI'], ['ETF1'], ['PFD-P-A']])('drops %s by its type', (code) => { expect(reason(code)).toBe('type'); });
  it.each([['NOSEC'], ['OTHER']])('drops %s: its sector maps to no house sector (RU-3)', (code) => { expect(reason(code)).toBe('sector_unmapped'); });
  it('drops a row with no name in either source, and takes the list\'s name when the screener has none', () => {
    expect(reason('NONAME')).toBe('no_name');
    expect(kept.ESLNAME.name).toBe('Name From List');
    expect(out.nameFromExchangeList).toBe(1);
  });
  it.each([['XLK'], ['SMH'], ['RSP'], ['IWM'], ['VIX']])('drops %s: a sector fund, industry fund, index symbol or Practice Field fund', (code) => {
    expect(reason(code)).toBe('fund_or_index');
  });
  it('never keeps one of the 228, and records it for the sector check', () => {
    expect(kept.AAPL).toBeUndefined();
    expect(out.gameRows.map((g) => g.symbol).sort()).toEqual(['AAPL', 'V']);
    const v = out.gameRows.find((g) => g.symbol === 'V');
    expect(v).toMatchObject({ mapped: 'XLK', house: 'XLF' });
  });
  it('writes the house spelling and keeps a share class once', () => {
    expect(kept['HEI-A']).toBeDefined();
    expect(reason('BRK.A')).toBe(undefined);
    expect(out.dropped.filter((d) => d.symbol === 'BRK-A').map((d) => d.reason)).toEqual(['repeat_symbol']);
  });
  it('drops below the floor, malformed codes and codes missing from the exchange list', () => {
    expect(reason('LOW1')).toBe('below_floor');
    expect(reason('^GSPC')).toBe('bad_symbol');
    expect(out.dropped.find((d) => d.code === null)?.reason).toBe('bad_symbol');
    expect(reason('GONE')).toBe('not_in_exchange_list');
  });
  it('cleans names (invisible characters out, whitespace collapsed) and writes an empty industry as null', () => {
    expect(kept.INVIS.name).toBe('Invis Corp Inc');
    expect(kept.NOIND.industry).toBeNull();
    expect(cleanText('\u0007 A⁦B⁩ ')).toBe('AB');
  });
  it('sorts entries by symbol, by code point', () => {
    const syms = out.entries.map((e) => e.symbol);
    expect(syms).toEqual([...syms].sort());
  });
  it('the real exclusion set holds every sector fund, industry fund, index symbol and Practice Field fund, and none of the 228', () => {
    const want = [...SECTOR_ETFS, ...Object.values(INDUSTRY_ETFS).flat(), ...INDEX_REGISTRY_SYMBOLS, ...INTRADAY_INDEX_SYMBOLS, ...INDEX_NAMES, ...INDEX_SUBJECTS, ...Object.keys(PRACTICE_FIELD_FUNDS)];
    for (const s of want) expect(EXCLUDED_SYMBOLS.has(s)).toBe(true);
    expect(EXCLUDED_SYMBOLS.size).toBe(new Set(want).size);
    for (const s of ALL_TICKERS) expect(EXCLUDED_SYMBOLS.has(s)).toBe(false);
  });
  it('reads the house sector from the house map for the 228', () => {
    expect(out.gameRows.find((g) => g.symbol === 'AAPL').house).toBe(TICKER_TO_SECTOR.AAPL);
  });
});

describe('paging below the offset limit', () => {
  // Market values fall by 1e7 a row from 9e12; rows 98 to 102 share one value, astride the first pass's edge.
  const dataset = (n, tieAt = 98, tieLen = 5) => Array.from({ length: n }, (_, i) => {
    const k = i >= tieAt && i < tieAt + tieLen ? tieAt : i;
    return row(`S${String(i).padStart(4, '0')}`, 9e12 - k * 1e7);
  });

  it('reads every row once across passes, ties at the pass edge included (at or below, never strictly below)', async () => {
    const data = dataset(257);
    const { fetchPage, requests } = fakeScreener(data, { maxOffset: 99 });
    const out = await fetchAllScreenerRows({ fetchPage, limit: 10, maxOffset: 99 });
    expect(out.rows.map((r) => r.code).sort()).toEqual(data.map((r) => r.code).sort());
    expect(out.passes.length).toBe(3);
    expect(out.passes[1].upper).toBe(out.passes[0].smallestMarketValue);
    expect(out.passes[1].repeats).toBeGreaterThan(0);
    expect(Math.max(...requests.map((r) => r.offset))).toBe(90);
    expect(requests.filter((r) => r.upper === null).map((r) => r.offset)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });
  it('a strictly-below next pass would lose the tied rows (the fixture can tell the two apart)', async () => {
    const data = dataset(257);
    const sorted = [...data].sort((a, b) => b.market_capitalization - a.market_capitalization || (a.code < b.code ? -1 : 1));
    const edge = sorted[99].market_capitalization;
    const tiedAfterEdge = sorted.slice(100).filter((r) => r.market_capitalization === edge);
    expect(tiedAfterEdge.length).toBeGreaterThan(0);
  });
  it('ends when a page returns fewer rows than it asked for, including a pass that only repeats the edge', async () => {
    const data = dataset(199, 0, 1);
    const { fetchPage } = fakeScreener(data, { maxOffset: 99 });
    const out = await fetchAllScreenerRows({ fetchPage, limit: 10, maxOffset: 99 });
    expect(out.rows.length).toBe(199);
    expect(out.passes.at(-1)).toMatchObject({ added: 0, repeats: 1, pages: 1 });
  });
  it('pages the real constants (100 a page, offset up to 999) over 2,345 rows', async () => {
    const data = dataset(2345, 995, 12);
    const { fetchPage, requests } = fakeScreener(data);
    const out = await fetchAllScreenerRows({ fetchPage });
    expect(out.rows.length).toBe(2345);
    expect(PAGE_LIMIT).toBe(100);
    expect(MAX_OFFSET).toBe(999);
    expect(Math.max(...requests.map((r) => r.offset))).toBe(900);
    expect(out.passes.length).toBe(3);
  });
  it('stops when a pass adds no new row (a screener that ignores the bound)', async () => {
    const { fetchPage } = fakeScreener(dataset(300), { maxOffset: 99, ignoreUpper: true });
    await expect(fetchAllScreenerRows({ fetchPage, limit: 10, maxOffset: 99 })).rejects.toThrow(/no progress/);
  });
  it('stops on a page that is not a list', async () => {
    await expect(fetchAllScreenerRows({ fetchPage: async () => ({ error: 'x' }) })).rejects.toThrow(/not a list/);
  });
  it('sends the floor, the pass bound at or below, and US', () => {
    expect(screenerFilters({ floor: 1e9, upper: null })).toEqual([['market_capitalization', '>=', 1e9], ['exchange', '=', 'us']]);
    expect(screenerFilters({ floor: 1e9, upper: 5e9 })).toEqual([['market_capitalization', '>=', 1e9], ['market_capitalization', '<=', 5e9], ['exchange', '=', 'us']]);
    expect(FLOOR_USD).toBe(1_000_000_000);
  });
});

describe('the call ceiling', () => {
  it('spends 5 a screener request, 1 for the exchange list, 0 for the user endpoint, and refuses past 1,500', () => {
    expect(CALL_CEILING).toBe(1500);
    expect(CALL_COST).toEqual({ screener: 5, exchangeList: 1, user: 0 });
    const b = createCallBudget();
    b.spend('user');
    for (let i = 0; i < 300; i += 1) b.spend('screener');
    expect(b.spent).toBe(1500);
    expect(() => b.spend('screener')).toThrow(CallCeilingError);
    expect(() => b.spend('exchangeList')).toThrow(CallCeilingError);
    expect(b.spent).toBe(1500);
    expect(b.byKind).toEqual({ user: 1, screener: 300 });
    expect(() => b.spend('fundamentals')).toThrow(/unknown request kind/);
  });

  const endless = () => {
    const calls = [];
    const fetchJson = async (url) => {
      const u = new URL(url);
      calls.push(u.pathname);
      if (u.pathname.endsWith('/user')) return { apiRequests: 100, dailyRateLimit: 100000 };
      if (u.pathname.includes('/exchange-symbol-list/')) return [listing('GLW')];
      const offset = Number(u.searchParams.get('offset'));
      return { data: Array.from({ length: 100 }, (_, i) => row(`Z${calls.length}X${offset + i}`, 9e12 - calls.length * 1e6 - i)) };
    };
    return { fetchJson, calls };
  };
  it('aborts the fetch at the request that would pass the ceiling: 299 screener pages after the exchange list', async () => {
    const { fetchJson, calls } = endless();
    const budget = createCallBudget();
    await expect(fetchSources({ apiKey: 'k', fetchJson, budget })).rejects.toThrow(CallCeilingError);
    expect(calls.filter((p) => p.endsWith('/screener')).length).toBe(299);
    expect(budget.spent).toBe(1496);
  });
  it('writes no directory when the ceiling stops the run', async () => {
    const { fetchJson } = endless();
    const writes = [];
    await expect(runMain({
      env: { EODHD_API_KEY: 'k' }, fetchJson, writeFile: (p) => writes.push(p), makeDir: () => {}, outPath: '/out/researchDirectory.js', defaultRunDir: '/run', log: () => {},
    })).rejects.toThrow(CallCeilingError);
    expect(writes).toEqual([]);
  });
  it('never calls fundamentals or bulk fundamentals', () => {
    expect(NEW_SCRIPT).not.toMatch(/\/fundamentals\/|bulk-fundamentals/);
  });
});

describe('the count stop', () => {
  it.each([[COUNT_MIN - 1], [COUNT_MAX + 1], [0], [NaN]])('%s stops the run', (n) => { expect(() => checkCount(n)).toThrow(/nothing written/); });
  it.each([[COUNT_MIN], [COUNT_MAX], [2500]])('%s passes', (n) => { expect(checkCount(n)).toBe(n); });
  it('a small run writes its report but no directory', async () => {
    const fetchJson = async (url) => {
      const u = new URL(url);
      if (u.pathname.endsWith('/user')) return { apiRequests: 10 };
      if (u.pathname.includes('/exchange-symbol-list/')) return [listing('GLW')];
      return { data: Number(u.searchParams.get('offset')) === 0 ? [row('GLW', 3e10)] : [] };
    };
    const writes = [];
    await expect(runMain({
      env: { EODHD_API_KEY: 'k' }, fetchJson, writeFile: (p) => writes.push(p), makeDir: () => {}, outPath: '/out/researchDirectory.js', defaultRunDir: '/run', log: () => {},
    })).rejects.toThrow(/outside 1000 to 5000/);
    expect(writes.map((p) => path.basename(p))).toEqual(['raw.json', 'run-report.json']);
  });
});

describe('the generated module', () => {
  const entries = [
    { symbol: 'ZZZ', name: 'Zed "Quoted" Co', sector: 'XLI', industry: null },
    { symbol: 'AAA', name: 'Back\\slash Inc', sector: 'XLK', industry: 'Software - Application' },
    { symbol: 'BRK-A', name: 'Berkshire Hathaway Inc', sector: 'XLF', industry: 'Insurance - Diversified' },
  ];
  const text = renderDirectoryModule({ entries, generatedOn: '2026-11-26' });

  it('states the date, the count, the floor and that it is generated', () => {
    expect(text).toContain('// Generated: 2026-11-26');
    expect(text).toContain('// Count: 3');
    expect(text).toContain('// Floor: market value at or above $1,000,000,000');
    expect(text).toContain('generated by scripts/build-research-directory.mjs; do not edit by hand');
    expect(text).not.toMatch(/\r/);
    expect(text).not.toMatch(/^import /m);
  });
  it('writes one entry per line, sorted by symbol, with no market value', () => {
    const lines = text.split('\n').filter((l) => /^ {2}"/.test(l));
    expect(lines.map((l) => JSON.parse(l.slice(2, l.indexOf(':'))))).toEqual(['AAA', 'BRK-A', 'ZZZ']);
    expect(text).not.toMatch(/marketValue|market_capitalization/);
  });
  it('imports back to the same entries, frozen', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rd-mod-'));
    try {
      const file = path.join(dir, 'researchDirectory.js');
      writeFileSync(file, text);
      const mod = await import(/* @vite-ignore */ pathToFileURL(file).href);
      expect(mod.RESEARCH_DIRECTORY).toEqual({
        AAA: ['Back\\slash Inc', 'XLK', 'Software - Application'],
        'BRK-A': ['Berkshire Hathaway Inc', 'XLF', 'Insurance - Diversified'],
        ZZZ: ['Zed "Quoted" Co', 'XLI', null],
      });
      expect(mod.RESEARCH_DIRECTORY_META).toEqual({ generatedOn: '2026-11-26', count: 3, floorUsd: 1e9 });
      expect(Object.isFrozen(mod.RESEARCH_DIRECTORY)).toBe(true);
      expect(Object.isFrozen(mod.RESEARCH_DIRECTORY.AAA)).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('refuses a malformed date', () => {
    expect(() => renderDirectoryModule({ entries, generatedOn: '26/11/2026' })).toThrow(/YYYY-MM-DD/);
  });
});

describe('the CLI', () => {
  it('importing the script makes no network call', async () => {
    const spy = vi.fn(async () => { throw new Error('no network in tests'); });
    vi.stubGlobal('fetch', spy);
    vi.resetModules();
    await import('./build-research-directory.mjs');
    expect(spy).not.toHaveBeenCalled();
  });
  it('cuts the key out of an error line', () => {
    expect(redactedLine(new Error('bad sk-123 thing'), 'sk-123')).toBe('FATAL: bad <key> thing');
  });
  it('parses its two options and refuses anything else', () => {
    expect(parseArgs(['--run-dir', 'd', '--from-raw', 'r.json'])).toEqual({ runDir: 'd', fromRaw: 'r.json' });
    expect(() => parseArgs(['--run-dir'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--write-anywhere'])).toThrow(/unknown argument/);
  });
  it('dates the run in New York', () => {
    expect(etDate(Date.parse('2026-11-27T03:00:00Z'))).toBe('2026-11-26');
  });
});
