// scripts/research-stock.test.js
//
// Research universe Build 2 (PR B), build prompt sections 5.6 and 6: the hand-run script. Every row runs on fakes (an
// in-memory Firestore, a fake fetch, a fixed clock); none calls EODHD or Firestore.

import { describe, it, expect } from 'vitest';
import { makeMandateFakeDb } from '../api/_utils/__testsupport__/mandateFakeFirestore.js';
import { GOLDEN_CASES } from '../api/_utils/__fixtures__/stockMeasuresGoldenInputs.js';
import { shapeFundamentals } from '../api/_utils/stockMeasures.js';
import { STORED_METRIC_KEYS, measuresOf } from '../api/_utils/researchMeasures.js';
import { TICKER_TO_SECTOR } from '../api/_utils/rankingConfig.js';
import { EXIT, TEN_MEASURES, formatMeasure, isDirectRun, parseArgs, runCli } from './research-stock.mjs';

const KEY = 'SCRIPT-TEST-KEY-0987654321';
const T0 = new Date('2026-11-26T15:00:00.000Z');
const GLW_RESPONSE = GOLDEN_CASES.find((c) => c.id === 'research-stock-short-history').response;
const AAPL_CASE = GOLDEN_CASES.find((c) => c.id === 'full-xlk');

function fakeFetch(answer) {
  const urls = [];
  const fn = async (url) => {
    urls.push(url);
    if (answer instanceof Error) throw answer;
    if (typeof answer === 'number') return { ok: false, status: answer, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => structuredClone(answer) };
  };
  fn.urls = urls;
  return fn;
}

async function cli(argv, { db = makeMandateFakeDb(), fetchImpl = fakeFetch(GLW_RESPONSE), at = T0, env = { EODHD_API_KEY: KEY }, getDb } = {}) {
  const lines = [];
  const realLog = console.log;
  console.log = () => {};
  try {
    const code = await runCli(argv, { getDb: getDb ?? (async () => db), env, fetchImpl, now: () => new Date(at.getTime()), print: (s) => lines.push(s) });
    return { code, lines, text: lines.join('\n'), db, fetchImpl };
  } finally {
    console.log = realLog;
  }
}
const versions = (db) => [...db._store.keys()].sort().map((p) => `${p}@${db._versionOf(p)}`);

describe('arguments', () => {
  it.each([
    [['status', 'glw'], { command: 'status', symbol: 'GLW', go: false }],
    [['fetch', 'GLW'], { command: 'fetch', symbol: 'GLW', go: false }],
    [['fetch', 'GLW', '--go'], { command: 'fetch', symbol: 'GLW', go: true }],
    [['compare', 'brk.b'], { command: 'compare', symbol: 'BRK-B', go: false }],
  ])('%j', (argv, want) => { expect(parseArgs(argv)).toEqual(want); });
  it.each([[[]], [['nuke', 'GLW']], [['fetch']], [['status', 'GLW', '--go']], [['compare', 'NVDA', '--go']], [['fetch', 'GLW', '--force']], [['fetch', '^GSPC']]])('refuses %j', async (argv) => {
    expect(() => parseArgs(argv)).toThrow();
    const r = await cli(argv);
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.fetchImpl.urls).toEqual([]);
  });
});

describe('fetch without --go: says what it would do and cost; no call and no write', () => {
  it('a new stock: one request, 10 calls', async () => {
    const db = makeMandateFakeDb();
    const r = await cli(['fetch', 'GLW'], { db });
    expect(r.code).toBe(EXIT.DONE);
    expect(r.text).toContain('Would make one fundamentals request: 10 calls, fetch 1 of 200 today, then store researchMeasures/GLW.');
    expect(r.text).toContain('Dry run: nothing was written.');
    expect(r.fetchImpl.urls).toEqual([]);
    expect(versions(db)).toEqual([]);
  });
  it('kept numbers: 0 calls; over the ceiling: no call', async () => {
    const db = makeMandateFakeDb();
    await cli(['fetch', 'GLW', '--go'], { db });
    const before = versions(db);
    const kept = await cli(['fetch', 'GLW'], { db, at: new Date(T0.getTime() + 3600e3) });
    expect(kept.text).toContain('Would use the kept numbers (1.0 hours old). Cost: 0 calls.');
    await db.doc('researchFetchDays/2026-11-26').update({ fetches: 200 });
    const over = await cli(['fetch', 'ANET'], { db });
    expect(over.text).toContain("Would make no call: today's ceiling (200 fetches) is reached. Not available today. Cost: 0 calls.");
    expect(kept.fetchImpl.urls).toEqual([]);
    expect(over.fetchImpl.urls).toEqual([]);
    expect(versions(db).filter((v) => v.startsWith('researchMeasures'))).toEqual(before.filter((v) => v.startsWith('researchMeasures')));
  });
  it('one of the 228: refused, no call', async () => {
    const r = await cli(['fetch', 'AAPL']);
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.text).toContain('REFUSED: AAPL is not a research stock (game_stock). No call.');
  });
  it.each([['AAPL', 'game_stock'], ['MMC', 'retired'], ['ZZZZ', 'not_on_list']])('%s is refused before any read (review R2-3)', async (sym, reason) => {
    // Awaiting a value probes its then; every other property is a store access.
    const untouchable = new Proxy({}, { get: (_t, k) => { if (k === 'then') return undefined; throw new Error('the store was touched'); } });
    const r = await cli(['fetch', sym], { db: untouchable });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.text).toBe(`REFUSED: ${sym} is not a research stock (${reason}). No call.`);
  });
});

describe('fetch --go: fetches if needed, stores, prints the measures with plain labels', () => {
  it('the first time costs 10 calls and stores; the second costs nothing', async () => {
    const db = makeMandateFakeDb();
    const first = await cli(['fetch', 'GLW', '--go'], { db });
    expect(first.code).toBe(EXIT.DONE);
    expect(first.lines[0]).toBe('Fetched and stored. Calls: 10.');
    expect(first.text).toContain('GLW: Corning Incorporated (sector XLK, industry Electronic Components)');
    for (const [, label] of TEN_MEASURES) expect(first.text).toContain(`    ${label}: `);
    expect(first.fetchImpl.urls).toHaveLength(1);
    const second = await cli(['fetch', 'GLW', '--go'], { db, at: new Date(T0.getTime() + 60e3) });
    expect(second.lines[0]).toBe('Kept numbers used. Calls: 0.');
    expect(second.fetchImpl.urls).toEqual([]);
    expect(db._get('researchFetchDays/2026-11-26').fetches).toBe(1);
  });
  it('a provider failure: unavailable, exit 1, and the key is never printed', async () => {
    const r = await cli(['fetch', 'GLW', '--go'], { fetchImpl: fakeFetch(new Error(`ECONNRESET https://eodhd.com/api/fundamentals/GLW.US?api_token=${KEY}`)) });
    expect(r.code).toBe(EXIT.FAILED);
    expect(r.lines[0]).toBe('Unavailable (network_error). Calls: 10.');
    expect(r.text).not.toContain(KEY);
  });
});

describe('status: what is kept and how old, and today\'s counter; 0 calls, no write', () => {
  it('reads only', async () => {
    const db = makeMandateFakeDb();
    const none = await cli(['status', 'GLW'], { db });
    expect(none.text).toContain('GLW: nothing kept yet.');
    expect(none.text).toContain("Today's counter (2026-11-26, UTC): 0 of 200 fetches used (0 calls).");
    await cli(['fetch', 'GLW', '--go'], { db });
    const before = versions(db);
    const r = await cli(['status', 'GLW'], { db, at: new Date(T0.getTime() + 3 * 86400e3) });
    expect(r.text).toContain('kept numbers are 3.0 days old');
    expect(r.text).toContain("Today's counter (2026-11-29, UTC): 0 of 200 fetches used (0 calls).");
    expect(r.fetchImpl.urls).toEqual([]);
    expect(versions(db)).toEqual(before);
  });
});

describe('compare: one of the 228 only; the research path beside peerRankings; writes nothing', () => {
  const storedFor = (c) => {
    const realLog = console.log;
    console.log = () => {};
    try { return measuresOf(c.ticker, shapeFundamentals(structuredClone(c.response), c.ticker), TICKER_TO_SECTOR[c.ticker]); } finally { console.log = realLog; }
  };
  it('agrees on all ten when the stored block came from the same response (exit 0), and writes nothing', async () => {
    const db = makeMandateFakeDb({ 'peerRankings/AAPL': { ticker: 'AAPL', computedAt: '2026-11-26T11:00:51.356Z', metrics: storedFor(AAPL_CASE) } });
    const before = versions(db);
    const r = await cli(['compare', 'AAPL'], { db, fetchImpl: fakeFetch(AAPL_CASE.response) });
    expect(r.code).toBe(EXIT.DONE);
    expect(r.text).toContain('Result: the ten measures agree.');
    expect(r.lines.filter((l) => / equal/.test(l))).toHaveLength(10);
    expect(r.fetchImpl.urls).toHaveLength(1);
    expect(versions(db)).toEqual(before);
  });
  it('reports a differing measure (exit 3) and allows fcfYield to move with the market value', async () => {
    const stored = { ...storedFor(AAPL_CASE), currentRatio: 9.99, fcfYield: storedFor(AAPL_CASE).fcfYield * 1.001 };
    const db = makeMandateFakeDb({ 'peerRankings/AAPL': { metrics: stored } });
    const r = await cli(['compare', 'AAPL'], { db, fetchImpl: fakeFetch(AAPL_CASE.response) });
    expect(r.code).toBe(EXIT.DIFFERS);
    expect(r.lines.find((l) => l.includes('currentRatio'))).toMatch(/DIFFERS/);
    expect(r.lines.find((l) => l.includes('fcfYield'))).toMatch(/allowed: it uses the day's market value/);
    expect(r.text).toContain('Result: 1 of the ten measures differ.');
  });
  it('both null is said as "equal (both null)", never a plain match (profitMarginTTM, the rankings job\'s fault)', async () => {
    const c = GOLDEN_CASES.find((x) => x.id === 'net-cash-no-interest');
    const db = makeMandateFakeDb({ 'peerRankings/XOM': { metrics: storedFor(c) } });
    const r = await cli(['compare', 'XOM'], { db, fetchImpl: fakeFetch(c.response) });
    expect(r.lines.find((l) => l.includes('profitMarginTTM'))).toMatch(/equal \(both null\)/);
  });
  it.each([['GLW'], ['MMC'], ['ZZZZ']])('refuses %s with no call', async (sym) => {
    const r = await cli(['compare', sym]);
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.fetchImpl.urls).toEqual([]);
  });
  it('claims no slot and writes no research record', async () => {
    const db = makeMandateFakeDb({ 'peerRankings/AAPL': { metrics: storedFor(AAPL_CASE) } });
    await cli(['compare', 'AAPL'], { db, fetchImpl: fakeFetch(AAPL_CASE.response) });
    expect([...db._store.keys()]).toEqual(['peerRankings/AAPL']);
  });
});

describe('secrets and side effects', () => {
  it('an error that carries the key is printed with the key cut out', async () => {
    const r = await cli(['status', 'GLW'], { getDb: async () => { throw new Error(`could not connect with ${KEY}`); } });
    expect(r.code).toBe(EXIT.FAILED);
    expect(r.text).toBe('FAILED: could not connect with <key>');
  });
  it('no line of any command prints the key', async () => {
    const db = makeMandateFakeDb({ 'peerRankings/AAPL': { metrics: {} } });
    const all = [];
    for (const argv of [['status', 'GLW'], ['fetch', 'GLW'], ['fetch', 'GLW', '--go'], ['compare', 'AAPL']]) all.push((await cli(argv, { db, fetchImpl: fakeFetch(argv[1] === 'AAPL' ? AAPL_CASE.response : GLW_RESPONSE) })).text);
    expect(all.join('\n')).not.toContain(KEY);
  });
  it('runs only when invoked directly', () => {
    expect(isDirectRun(import.meta.url, undefined)).toBe(false);
    expect(isDirectRun(import.meta.url, '')).toBe(false);
    expect(isDirectRun(new URL('./research-stock.mjs', import.meta.url).href, new URL('./research-stock.test.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))).toBe(false);
  });
  it('formats a value as a person reads it, with the raw value beside it', () => {
    expect(formatMeasure(0.184, 'fraction')).toBe('18.40% (raw 0.184)');
    expect(formatMeasure(6.86, 'percent')).toBe('6.86% (raw 6.86)');
    expect(formatMeasure(-1, 'ratio')).toBe('-1.00 (raw -1)');
    expect(formatMeasure(null, 'ratio')).toBe('not available (null)');
  });
  it('labels the ten measures the build prompt names, all of them stored keys', () => {
    expect(TEN_MEASURES.map(([k]) => k)).toEqual(['revenueGrowthYOY', 'earningsGrowthYOY', 'profitMarginTTM', 'grossMargin', 'fcfYield', 'fcfMargin', 'debtToEquity', 'currentRatio', 'interestCoverage', 'netDebtEbitda']);
    for (const [k] of TEN_MEASURES) expect(STORED_METRIC_KEYS).toContain(k);
  });
});
