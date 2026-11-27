// api/_utils/researchMeasures.test.js
//
// Research universe Build 2 (PR B), build prompt sections 5 and 6: a research stock's numbers on request. Every row
// runs on fakes: an in-memory, transaction-faithful Firestore (__testsupport__/mandateFakeFirestore.js) and a fake
// fetch. No row calls EODHD or Firestore.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES section 4): importing researchMeasures.js here proves its graph is Node-clean.
// Never mock it.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMandateFakeDb } from './__testsupport__/mandateFakeFirestore.js';
import { SECTOR_BEAT_RATES, TICKER_TO_SECTOR, RETIRED_STOCKS } from './rankingConfig.js';
import { researchNameOf, researchSectorOf } from './researchUniverse.js';
import { extractMetrics, shapeFundamentals } from './stockMeasures.js';
import { estimatesFactOf } from './sharedResearch/opening.js';
import { GOLDEN_CASES } from './__fixtures__/stockMeasuresGoldenInputs.js';
import {
  CALLS_PER_FETCH, DAILY_FETCH_CEILING, KEEP_MS, MEASURES_SHAPE_VERSION, RESEARCH_FETCH_DAYS_COLLECTION,
  RESEARCH_MEASURES_COLLECTION, STORED_METRIC_KEYS, UNAVAILABLE_RETRY_MS, buildRecord, claimFetchSlot, estimatesOf,
  fetchDayOf, fetchResearchStock, fundamentalsUrlOf, isEmptyResponse, measuresOf, planResearchFetch, readFetchDay,
  readResearchStock, refusalOf, requestFundamentals,
} from './researchMeasures.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Read with LF line ends: a Windows checkout may hold CRLF.
const readLf = (p) => readFileSync(p, 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
const RANKINGS_SRC = readLf(path.join(HERE, '..', 'cron', 'compute-rankings.js'));
const ESTIMATES_SRC = readLf(path.join(HERE, '..', 'cron', 'compute-estimates.js'));
const MODULE_SRC = readLf(path.join(HERE, 'researchMeasures.js'));

const KEY = 'TEST-KEY-1234567890';
const T0 = new Date('2026-11-26T15:00:00.000Z');
const quiet = (fn) => { const real = console.log; console.log = () => {}; try { return fn(); } finally { console.log = real; } };
const quietAsync = async (fn) => { const real = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = real; } };

/** A research-stock response: GLW's shape (Trend with past 0y / 0q rows, a reported quarter), made-up values. */
const RESPONSE = {
  Highlights: { MarketCapitalization: 86346842112, QuarterlyRevenueGrowthYOY: 0.184, QuarterlyEarningsGrowthYOY: 0.56, OperatingMarginTTM: 0.1677, ProfitMargin: 0.1213, GrossProfitTTM: 6464000000, RevenueTTM: 17718999040, ReturnOnAssetsTTM: 0.058, ReturnOnEquityTTM: 0.1788, DividendYield: 0.011 },
  Valuation: { EnterpriseValueEbitda: 21.3439, TrailingPE: 40.583, PriceSalesTTM: 4.8731, PriceBookMRQ: 5.9468 },
  Technicals: { '52WeekHigh': 270.63, '52WeekLow': 81.05 },
  Earnings: {
    History: {
      '2026-12-31': { date: '2026-12-31', epsActual: null, epsEstimate: 0.88 },
      '2026-09-30': { date: '2026-09-30', epsActual: 0.91, epsEstimate: 0.89 },
      '2026-06-30': { date: '2026-06-30', epsActual: 0.78, epsEstimate: 0.76 },
    },
    Trend: {
      '2027-12-31': { date: '2027-12-31', period: '+1y', earningsEstimateAvg: '4.5507', earningsEstimateHigh: '4.9900', earningsEstimateLow: '4.1900', earningsEstimateNumberOfAnalysts: '19.0000', earningsEstimateGrowth: '0.3477' },
      '2027-03-31': { date: '2027-03-31', period: '+1q', earningsEstimateAvg: '0.9180', earningsEstimateNumberOfAnalysts: '9.0000', earningsEstimateGrowth: '0.3114' },
      '2026-12-31': { date: '2026-12-31', period: '0y', earningsEstimateAvg: '3.3767', earningsEstimateNumberOfAnalysts: '17.0000', earningsEstimateGrowth: '0.3400', epsRevisionsUpLast30days: '13.0000', epsRevisionsDownLast30days: '1.0000', epsTrendCurrent: '3.3767', epsTrend30daysAgo: '3.2971' },
      '2026-09-30': { date: '2026-09-30', period: '0q', earningsEstimateAvg: '0.8800', earningsEstimateGrowth: '0.3135' },
      '2025-12-31': { date: '2025-12-31', period: '0y', earningsEstimateAvg: '2.5200', earningsEstimateGrowth: '0.2900' },
    },
  },
  Financials: {
    Income_Statement: { yearly: { '2025-12-31': { operatingIncome: '2412000000.37', interestExpense: '-331000000.13', depreciationAndAmortization: '1302000000.71' } } },
    Cash_Flow: { quarterly: Object.fromEntries(['2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30'].map((d, i) => [d, { totalCashFromOperatingActivities: String(712000000.11 + i * 1000000.3), capitalExpenditures: '-311000000.17' }])) },
    Balance_Sheet: { yearly: { '2025-12-31': { shortLongTermDebtTotal: '8456000000.00', totalStockholderEquity: '11234000000.00', totalCurrentAssets: '8123000000.00', totalCurrentLiabilities: '4567000000.00', netDebt: '6987000000.13' } } },
  },
  SharesStats: { ShortPercentFloat: 0.0269, ShortRatio: 1.97 },
  'General::Name': 'Corning Incorporated',
};

/** A fake fetch: answers in turn, records every URL. */
function fakeFetch(...answers) {
  const urls = [];
  const fn = async (url) => {
    urls.push(url);
    const a = answers.length > 1 ? answers.shift() : answers[0];
    if (a instanceof Error) throw a;
    if (typeof a === 'number') return { ok: false, status: a, json: async () => ({}) };
    if (a === 'bad-json') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } };
    return { ok: true, status: 200, json: async () => structuredClone(a) };
  };
  fn.urls = urls;
  return fn;
}
const clockAt = (date) => () => new Date(date.getTime());
const run = (symbol, { db, fetchImpl, at = T0, ceiling } = {}) => quietAsync(() => fetchResearchStock(symbol, { db, apiKey: KEY, fetchImpl, now: clockAt(at), ...(ceiling ? { ceiling } : {}) }));
const paths = (db) => [...db._store.keys()].sort();

// -- Refusals --------------------------------------------------------------------------------------------------------

describe('only a research stock: the rest are refused with no read, no write and no call', () => {
  const untouchable = new Proxy({}, { get: () => { throw new Error('the store was touched'); } });
  it.each([
    ['one of the 228', 'AAPL', 'game_stock'],
    ['a game share class (BRK-B)', 'BRK-B', 'game_stock'],
    ['a retired game stock', 'MMC', 'retired'],
    ['a symbol not on the list', 'ZZZZ', 'not_on_list'],
    ['a left-out directory row (PR A)', 'BRK-A', 'not_on_list'],
    ['a lower-case spelling', 'glw', 'not_on_list'],
    ['nothing', undefined, 'not_on_list'],
  ])('%s', async (_t, symbol, reason) => {
    const fetchImpl = fakeFetch(RESPONSE);
    const out = await fetchResearchStock(symbol, { db: untouchable, apiKey: KEY, fetchImpl, now: clockAt(T0) });
    expect(out).toMatchObject({ outcome: 'refused', reason, calls: 0, record: null });
    expect(fetchImpl.urls).toEqual([]);
    expect(planResearchFetch(symbol, null, T0.getTime())).toEqual({ action: 'refuse', reason, calls: 0 });
  });
  it('every retired game stock is refused, ahead of the directory (a retired symbol can enter it: Build 1, Q9)', () => {
    for (const s of Object.keys(RETIRED_STOCKS)) expect(refusalOf(s)).toBe('retired');
  });
  it('a research stock is not refused', () => {
    for (const s of ['GLW', 'ANET', 'TSM', 'CBOE', 'MOG-B']) expect(refusalOf(s)).toBeNull();
  });
});

// -- The stored record -----------------------------------------------------------------------------------------------

// Company names, Build 3a: the record's name for GLW, ANET and TSM (the three stored by Build 2's live check), pinned
// BEFORE the name moved into the shared response shaping, so that move cannot change a stored research record. Each
// response shape a name can arrive in: as given, with spaces around it, absent, empty, blank, not a string, under
// General.Name, and under both keys.
describe('the record name for GLW, ANET and TSM (pinned before the name got one home)', () => {
  const { 'General::Name': _drop, ...noName } = RESPONSE;
  const named = (v) => ({ ...noName, 'General::Name': v });
  const nameOf = (sym, data) => quiet(() => buildRecord(sym, structuredClone(data), T0.toISOString())).name;
  it.each([
    ['GLW', 'Corning Incorporated'], ['ANET', 'Arista Networks'], ['TSM', 'Taiwan Semiconductor Manufacturing'],
  ])('%s: the response name, trimmed; else the directory name (%s)', (sym, directoryName) => {
    expect(researchNameOf(sym)).toBe(directoryName);
    expect(nameOf(sym, named(`${directoryName} Inc`))).toBe(`${directoryName} Inc`);
    expect(nameOf(sym, named(`  ${directoryName} Ltd `))).toBe(`${directoryName} Ltd`);
    expect(nameOf(sym, noName)).toBe(directoryName);
    for (const odd of ['', '   ', null, 42, { Name: 'x' }]) expect(nameOf(sym, named(odd))).toBe(directoryName);
    expect(nameOf(sym, { ...noName, General: { Name: 'Under General' } })).toBe('Under General');
    expect(nameOf(sym, { ...named('Under The Key'), General: { Name: 'Under General' } })).toBe('Under The Key');
  });
});

describe('the stored record', () => {
  const record = quiet(() => buildRecord('GLW', structuredClone(RESPONSE), T0.toISOString()));

  it('the metrics keys are exactly the keys of peerRankings/{sym}.metrics, read from the rankings job, with the same defaults', () => {
    const start = RANKINGS_SRC.indexOf('      metrics: {', RANKINGS_SRC.indexOf('async function persistResults('));
    const block = RANKINGS_SRC.slice(start, RANKINGS_SRC.indexOf('\n      },', start));
    const rows = [...block.matchAll(/^ {8}(\w+): stock\.metrics\?\.(\w+) \?\? (null|false),$/gm)];
    expect(rows.length).toBeGreaterThan(30);
    for (const [, key, field] of rows) expect(field).toBe(key);
    expect(rows.map((r) => r[1])).toEqual([...STORED_METRIC_KEYS]);
    expect(Object.keys(record.metrics)).toEqual([...STORED_METRIC_KEYS]);
    const falseKeys = rows.filter((r) => r[3] === 'false').map((r) => r[1]);
    expect(falseKeys).toEqual(['squeezeWatch']);
  });
  it('holds no rank, percentile, tier, composite score, pillar, sector median or leaderboard at any depth (RU-15)', () => {
    const banned = /rank|percentile|tier|composite|pillar|median|leaderboard|peers/i;
    const keysOf = (v, out = []) => {
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); keysOf(x, out); }
      return out;
    };
    const all = keysOf(record);
    expect(all.length).toBeGreaterThan(40);
    expect(all.filter((k) => banned.test(k))).toEqual([]);
    expect(Object.keys(record).sort()).toEqual(['estimates', 'fetchedAt', 'industry', 'metrics', 'name', 'sectorId', 'shapeVersion', 'status', 'symbol', 'unavailable']);
  });
  it('carries the fundamentals name, the directory sector and industry, the time and the shape version', () => {
    expect(record).toMatchObject({ symbol: 'GLW', name: 'Corning Incorporated', sectorId: 'XLK', industry: 'Electronic Components', status: 'ok', fetchedAt: T0.toISOString(), unavailable: null, shapeVersion: MEASURES_SHAPE_VERSION });
  });
  it('the name falls back to the directory when the response carries none', () => {
    const { 'General::Name': _drop, ...noName } = RESPONSE;
    expect(quiet(() => buildRecord('GLW', structuredClone(noName), T0.toISOString())).name).toBe('Corning Incorporated');
  });
  it('the units are the rankings job\'s: every value is extractMetrics\' own, not converted (fcfYield and fcfMargin x100, margins and growth as fractions)', () => {
    const m = quiet(() => extractMetrics('GLW', shapeFundamentals(structuredClone(RESPONSE), 'GLW')));
    for (const k of STORED_METRIC_KEYS.filter((x) => !['beatRate', 'beatRateSource', 'avgSurpriseMag', 'surpriseConsistency'].includes(x))) {
      expect(record.metrics[k]).toEqual(m[k] ?? (k === 'squeezeWatch' ? false : null));
    }
    expect(record.metrics.grossMargin).toBeCloseTo(6464000000 / 17718999040, 12);
    expect(record.metrics.revenueGrowthYOY).toBe(0.184);
    const fcf = [0, 1, 2, 3].reduce((s, i) => s + (712000000.11 + i * 1000000.3) - 311000000.17, 0);
    expect(record.metrics.fcfYield).toBeCloseTo((fcf / 86346842112) * 100, 9);
    expect(record.metrics.fcfMargin).toBeCloseTo((fcf / 17718999040) * 100, 9);
  });
  it('a measure the response does not carry is null (never a guess): no momentum, no ProfitMarginTTM, no ShortPercentOfFloat', () => {
    for (const k of ['sixMonthReturn', 'threeMonthReturn', 'oneMonthReturn', 'profitMarginTTM', 'shortInterestScore']) expect(record.metrics[k]).toBeNull();
    const thin = quiet(() => buildRecord('GLW', { Highlights: { RevenueTTM: 100 } }, T0.toISOString()));
    expect(Object.keys(thin.metrics)).toEqual([...STORED_METRIC_KEYS]);
    for (const k of ['grossMargin', 'fcfYield', 'debtToEquity', 'currentRatio', 'interestCoverage', 'netDebtEbitda', 'marketCap']) expect(thin.metrics[k]).toBeNull();
    expect(thin.estimates).toBeNull();
  });
});

describe('the sector passed to the math is researchSectorOf(symbol)', () => {
  it('a short history takes the research sector\'s default beat rate, not the 0.68 the 228\'s map gives an unknown symbol', () => {
    const short = { ...RESPONSE, Earnings: { History: { a: { epsActual: 1.1, epsEstimate: 1.0 } } } };
    const r = quiet(() => buildRecord('GLW', structuredClone(short), T0.toISOString()));
    expect(researchSectorOf('GLW')).toBe('XLK');
    expect(r.metrics.beatRate).toBeCloseTo(SECTOR_BEAT_RATES.XLK * 100, 9);
    expect(r.metrics.beatRateSource).toBe('sector_default');
    const viaGameMap = quiet(() => extractMetrics('GLW', shapeFundamentals(structuredClone(short), 'GLW')));
    expect(viaGameMap.beatRate).toBeCloseTo(68, 9);
  });
  it.each(GOLDEN_CASES.filter((c) => TICKER_TO_SECTOR[c.ticker]).map((c) => [c.id, c]))('for one of the 228 with its own sector, measuresOf is exactly the rankings job\'s stored block (%s)', (_id, c) => {
    quiet(() => {
      const shaped = shapeFundamentals(structuredClone(c.response), c.ticker);
      const m = extractMetrics(c.ticker, shaped);
      const persisted = Object.fromEntries(STORED_METRIC_KEYS.map((k) => [k, m[k] ?? (k === 'squeezeWatch' ? false : null)]));
      expect(measuresOf(c.ticker, shaped, TICKER_TO_SECTOR[c.ticker])).toEqual(persisted);
    });
  });
});

// -- Estimates -------------------------------------------------------------------------------------------------------

describe('analyst estimates from the same response', () => {
  const est = estimatesOf(RESPONSE.Earnings);
  it('takes each period from the latest row ending after the last reported quarter, values as EODHD sends them', () => {
    expect(est.forwardEstimates.currentYear).toEqual({ avg: '3.3767', high: null, low: null, numAnalysts: '17.0000', growth: '0.3400' });
    expect(est.forwardEstimates.nextYear).toEqual({ avg: '4.5507', high: '4.9900', low: '4.1900', numAnalysts: '19.0000', growth: '0.3477' });
    expect(est.forwardEstimates.nextQtr).toMatchObject({ avg: '0.9180', growth: '0.3114' });
    expect(est).toMatchObject({ earningsEstimateNumberOfAnalysts: '17.0000', epsRevisionsUpLast30days: '13.0000', epsRevisionsDownLast30days: '1.0000' });
  });
  it('a "0q" row for a quarter already reported is not the current quarter: null (the current one lost its key to the year)', () => {
    expect(est.forwardEstimates.currentQtr).toBeNull();
  });
  it('a past year still labelled "0y" is never taken for the current year', () => {
    const onlyPast = { History: RESPONSE.Earnings.History, Trend: { x: { date: '2025-12-31', period: '0y', earningsEstimateGrowth: '0.29' } } };
    expect(estimatesOf(onlyPast)).toBeNull();
  });
  it('with no reported quarter, the latest row of each label is taken', () => {
    const e = estimatesOf({ Trend: RESPONSE.Earnings.Trend });
    expect(e.forwardEstimates.currentQtr).toMatchObject({ avg: '0.8800' });
    expect(e.forwardEstimates.currentYear).toMatchObject({ avg: '3.3767' });
  });
  it('the estimatesCache shape for one stock, without emsPercentile (a percentile, RU-15); the computed fields null', () => {
    expect(Object.keys(est)).toEqual(['rsr', 'ems', 'earningsEstimateNumberOfAnalysts', 'epsRevisionsUpLast30days', 'epsRevisionsDownLast30days', 'surpriseStreak', 'avgSurprise', 'estimateSpread', 'forwardEstimates']);
    expect(Object.keys(est.forwardEstimates)).toEqual(['currentQtr', 'nextQtr', 'currentYear', 'nextYear']);
    for (const k of ['rsr', 'ems', 'surpriseStreak', 'avgSurprise', 'estimateSpread']) expect(est[k]).toBeNull();
    const cacheShape = /emsPercentile: null, \/\/ computed in Phase D/.test(ESTIMATES_SRC);
    expect(cacheShape).toBe(true);
  });
  it('estimatesFactOf (Work an idea) reads it as it reads the cache', () => {
    expect(estimatesFactOf('GLW', est)).toBe('Analyst consensus growth for GLW: 34% for the current fiscal year and 34.8% for the next (19 analysts on the next year).');
  });
  it('no Trend: no estimates', () => {
    expect(estimatesOf({ History: RESPONSE.Earnings.History })).toBeNull();
    expect(estimatesOf(undefined)).toBeNull();
  });
  it('its forward-estimate picker is compute-estimates.js\'s extractForwardEstimate, body for body', () => {
    const bodyOf = (src) => {
      const start = src.indexOf('function extractForwardEstimate(entry) {');
      expect(start).toBeGreaterThan(-1);
      return src.slice(start, src.indexOf('\n}\n', start) + 2);
    };
    expect(bodyOf(MODULE_SRC)).toBe(bodyOf(ESTIMATES_SRC));
  });
});

// -- Kept, fetched, refreshed ---------------------------------------------------------------------------------------

describe('kept numbers first; one request otherwise', () => {
  it('the first touch makes one fundamentals request with the rankings job\'s filter, stores the record and claims one slot', async () => {
    const db = makeMandateFakeDb();
    const fetchImpl = fakeFetch(RESPONSE);
    const out = await run('GLW', { db, fetchImpl });
    expect(out).toMatchObject({ outcome: 'fetched', calls: CALLS_PER_FETCH, stale: false, day: '2026-11-26' });
    expect(fetchImpl.urls).toEqual([fundamentalsUrlOf('GLW', KEY)]);
    expect(fetchImpl.urls[0]).toBe(`https://eodhd.com/api/fundamentals/GLW.US?api_token=${KEY}&fmt=json&filter=Highlights,Valuation,Technicals,Earnings,Financials,SharesStats,General::Name`);
    expect(db._get('researchMeasures/GLW')).toEqual(out.record);
    expect(db._get('researchFetchDays/2026-11-26')).toMatchObject({ day: '2026-11-26', fetches: 1, ceiling: DAILY_FETCH_CEILING });
    expect(paths(db)).toEqual(['researchFetchDays/2026-11-26', 'researchMeasures/GLW']);
  });
  it.each([
    ['an hour later', 3600e3, 'kept'],
    ['exactly 7 days later', KEEP_MS, 'kept'],
    ['7 days and a millisecond later', KEEP_MS + 1, 'fetched'],
  ])('%s: %s', async (_t, later, outcome) => {
    const db = makeMandateFakeDb();
    await run('GLW', { db, fetchImpl: fakeFetch(RESPONSE) });
    const fetchImpl = fakeFetch(RESPONSE);
    const out = await run('GLW', { db, fetchImpl, at: new Date(T0.getTime() + later) });
    expect(out.outcome).toBe(outcome);
    expect(fetchImpl.urls).toHaveLength(outcome === 'kept' ? 0 : 1);
    expect(out.calls).toBe(outcome === 'kept' ? 0 : CALLS_PER_FETCH);
    if (outcome === 'fetched') expect(out.record.fetchedAt).toBe(new Date(T0.getTime() + later).toISOString());
  });
  it('numbers kept in an older shape are refetched', async () => {
    const db = makeMandateFakeDb();
    await run('GLW', { db, fetchImpl: fakeFetch(RESPONSE) });
    await db.doc('researchMeasures/GLW').update({ shapeVersion: 0 });
    const fetchImpl = fakeFetch(RESPONSE);
    // The next day: a symbol is fetched at most once a UTC day.
    expect((await run('GLW', { db, fetchImpl, at: new Date(T0.getTime() + 86400e3) })).outcome).toBe('fetched');
    expect(fetchImpl.urls).toHaveLength(1);
  });
  it('readResearchStock and readFetchDay read only', async () => {
    const db = makeMandateFakeDb();
    expect(await readResearchStock(db, 'GLW', T0)).toEqual({ record: null, ageMs: null });
    await run('GLW', { db, fetchImpl: fakeFetch(RESPONSE) });
    const before = paths(db).map((p) => db._versionOf(p));
    const later = new Date(T0.getTime() + 3600e3);
    expect((await readResearchStock(db, 'GLW', later)).ageMs).toBe(3600e3);
    expect(await readFetchDay(db, T0)).toEqual({ day: '2026-11-26', fetches: 1, ceiling: 200, symbols: { GLW: T0.toISOString() } });
    expect(paths(db).map((p) => db._versionOf(p))).toEqual(before);
  });
});

// -- Failures --------------------------------------------------------------------------------------------------------

describe('when the provider fails or has nothing', () => {
  it.each([
    ['a 404', 404, 'http_404'],
    ['a 500', 500, 'http_500'],
    ['a network error', new Error(`connect ECONNREFUSED https://eodhd.com/api/fundamentals/GLW.US?api_token=${KEY}`), 'network_error'],
    ['a body that is not JSON', 'bad-json', 'bad_json'],
    ['an empty object', {}, 'empty_response'],
    ['an empty list', [], 'empty_response'],
    ['no Highlights and no Financials', { Earnings: { Trend: {} }, 'General::Name': 'X' }, 'empty_response'],
  ])('%s stores an unavailable record with the reason and the time, and never the URL or the key', async (_t, answer, reason) => {
    const db = makeMandateFakeDb();
    const out = await run('GLW', { db, fetchImpl: fakeFetch(answer) });
    expect(out).toMatchObject({ outcome: 'unavailable', reason, calls: CALLS_PER_FETCH, stale: false });
    const stored = db._get('researchMeasures/GLW');
    expect(stored).toMatchObject({ status: 'unavailable', metrics: null, estimates: null, fetchedAt: null, unavailable: { reason, at: T0.toISOString() }, name: 'Corning Incorporated', sectorId: 'XLK' });
    expect(JSON.stringify(stored)).not.toContain(KEY);
    expect(JSON.stringify(stored)).not.toMatch(/eodhd|api_token|http:|https:/i);
    expect(JSON.stringify(out)).not.toContain(KEY);
  });
  it.each([
    ['an hour later: no call', 3600e3, 0],
    ['exactly 1 day later: no call', UNAVAILABLE_RETRY_MS, 0],
    ['1 day and a millisecond later: one call', UNAVAILABLE_RETRY_MS + 1, 1],
  ])('a stock with no data is retried only after 1 day (%s)', async (_t, later, calls) => {
    const db = makeMandateFakeDb();
    await run('GLW', { db, fetchImpl: fakeFetch(404) });
    const fetchImpl = fakeFetch(404);
    const out = await run('GLW', { db, fetchImpl, at: new Date(T0.getTime() + later) });
    expect(fetchImpl.urls).toHaveLength(calls);
    expect(out.calls).toBe(calls * CALLS_PER_FETCH);
    expect(out.outcome).toBe('unavailable');
    if (calls === 0) expect(out.retryAfter).toBe(new Date(T0.getTime() + UNAVAILABLE_RETRY_MS).toISOString());
  });
  it('ten touches in a day of a stock with no data cost one request', async () => {
    const db = makeMandateFakeDb();
    const fetchImpl = fakeFetch(404);
    for (let i = 0; i < 10; i += 1) await run('GLW', { db, fetchImpl, at: new Date(T0.getTime() + i * 3600e3) });
    expect(fetchImpl.urls).toHaveLength(1);
    expect(db._get('researchFetchDays/2026-11-26').fetches).toBe(1);
  });
  it('a failed refetch keeps the earlier numbers (marked with the failure) and returns them stale', async () => {
    const db = makeMandateFakeDb();
    const first = await run('GLW', { db, fetchImpl: fakeFetch(RESPONSE) });
    const at = new Date(T0.getTime() + KEEP_MS + 1);
    const out = await run('GLW', { db, fetchImpl: fakeFetch(503), at });
    expect(out).toMatchObject({ outcome: 'unavailable', reason: 'http_503', stale: true, calls: CALLS_PER_FETCH });
    const stored = db._get('researchMeasures/GLW');
    expect(stored.metrics).toEqual(first.record.metrics);
    expect(stored.fetchedAt).toBe(T0.toISOString());
    expect(stored.unavailable).toEqual({ reason: 'http_503', at: at.toISOString() });
    // An hour later: no call; the old numbers come back stale.
    const fetchImpl = fakeFetch(RESPONSE);
    const again = await run('GLW', { db, fetchImpl, at: new Date(at.getTime() + 3600e3) });
    expect(again).toMatchObject({ outcome: 'unavailable', calls: 0, stale: true });
    expect(again.record.metrics).toEqual(first.record.metrics);
    expect(fetchImpl.urls).toEqual([]);
    // After a day: one call, and a success clears the mark.
    const later = await run('GLW', { db, fetchImpl, at: new Date(at.getTime() + UNAVAILABLE_RETRY_MS + 1) });
    expect(later.outcome).toBe('fetched');
    expect(db._get('researchMeasures/GLW').unavailable).toBeNull();
  });
  it('requestFundamentals never throws and never returns error text', async () => {
    const out = await requestFundamentals('GLW', KEY, async () => { throw new Error(`boom ${KEY}`); });
    expect(out).toEqual({ ok: false, reason: 'network_error' });
    expect(await requestFundamentals('GLW', KEY, async () => null)).toEqual({ ok: false, reason: 'http_0' });
  });
  it('isEmptyResponse', () => {
    expect([null, 'x', [], {}, { Highlights: {} }, { Financials: {} }].map(isEmptyResponse)).toEqual([true, true, true, true, true, true]);
    expect([{ Highlights: { A: 1 } }, { Financials: { Cash_Flow: {} } }].map(isEmptyResponse)).toEqual([false, false]);
  });
});

// -- The ceiling -----------------------------------------------------------------------------------------------------

describe('the daily ceiling', () => {
  const seeded = (fetches, extra = {}) => makeMandateFakeDb({ 'researchFetchDays/2026-11-26': { day: '2026-11-26', fetches }, ...extra });
  it('is 200 fetches a day, 10 calls each', () => {
    expect(DAILY_FETCH_CEILING).toBe(200);
    expect(CALLS_PER_FETCH).toBe(10);
  });
  it('the 200th fetch goes through; the 201st makes no call', async () => {
    const db = seeded(199);
    const fetchImpl = fakeFetch(RESPONSE);
    const out200 = await run('GLW', { db, fetchImpl });
    expect(out200.outcome).toBe('fetched');
    expect(db._get('researchFetchDays/2026-11-26').fetches).toBe(200);
    const out201 = await run('ANET', { db, fetchImpl });
    expect(out201).toEqual({ symbol: 'ANET', outcome: 'over_ceiling', reason: 'daily_ceiling', day: '2026-11-26', calls: 0, record: null, stale: false });
    expect(fetchImpl.urls).toHaveLength(1);
    expect(db._get('researchFetchDays/2026-11-26').fetches).toBe(200);
    expect(db._get('researchMeasures/ANET')).toBeUndefined();
  });
  it('over the ceiling, kept numbers come back however old, marked stale', async () => {
    const old = quiet(() => buildRecord('GLW', structuredClone(RESPONSE), '2026-01-01T00:00:00.000Z'));
    const db = seeded(200, { 'researchMeasures/GLW': old });
    const fetchImpl = fakeFetch(RESPONSE);
    const out = await run('GLW', { db, fetchImpl });
    expect(out).toMatchObject({ outcome: 'over_ceiling', calls: 0, stale: true });
    expect(out.record).toEqual(old);
    expect(fetchImpl.urls).toEqual([]);
  });
  it('a new UTC day starts at zero', async () => {
    const db = seeded(200);
    const out = await run('GLW', { db, fetchImpl: fakeFetch(RESPONSE), at: new Date('2026-11-27T00:00:00.000Z') });
    expect(out).toMatchObject({ outcome: 'fetched', day: '2026-11-27' });
    expect(fetchDayOf(new Date('2026-11-26T23:59:59.999Z'))).toBe('2026-11-26');
  });
  it('two claims at once take two slots (the loser re-reads the winner\'s count)', async () => {
    const db = seeded(5);
    db.setBarrier(async () => { await claimFetchSlot(db, T0, { symbol: 'ANET' }); });
    const a = await claimFetchSlot(db, T0, { symbol: 'GLW' });
    expect(a).toEqual({ ok: true, day: '2026-11-26', fetches: 7 });
    expect(db._get('researchFetchDays/2026-11-26').fetches).toBe(7);
    expect(db._txAttempts()).toBeGreaterThanOrEqual(3);
  });
  it('two claims at once for the last slot: one goes through, the other is refused (the ceiling cannot be passed)', async () => {
    const db = seeded(199);
    let rival;
    db.setBarrier(async () => { rival = await claimFetchSlot(db, T0, { symbol: 'ANET' }); });
    const a = await claimFetchSlot(db, T0, { symbol: 'GLW' });
    expect([rival.ok, a.ok].sort()).toEqual([false, true]);
    expect(db._get('researchFetchDays/2026-11-26').fetches).toBe(200);
  });
  it('a symbol is claimed at most once a UTC day: a second claim for it is refused and takes no slot (review R2-1)', async () => {
    const db = seeded(5);
    expect(await claimFetchSlot(db, T0, { symbol: 'GLW' })).toEqual({ ok: true, day: '2026-11-26', fetches: 6 });
    expect(await claimFetchSlot(db, T0, { symbol: 'GLW' })).toEqual({ ok: false, reason: 'symbol_claimed_today', day: '2026-11-26', fetches: 6 });
    expect(db._get('researchFetchDays/2026-11-26').fetches).toBe(6);
    expect((await claimFetchSlot(db, new Date('2026-11-27T00:00:01.000Z'), { symbol: 'GLW' })).ok).toBe(true);
  });
  it('two touches of the same new stock at once: one claim, one call, one record; the other makes no call (review R2-1, R2-2)', async () => {
    const db = makeMandateFakeDb();
    const fetchImpl = fakeFetch(RESPONSE);
    const outs = await Promise.all([run('GLW', { db, fetchImpl }), run('GLW', { db, fetchImpl })]);
    expect(fetchImpl.urls).toHaveLength(1);
    expect(db._get('researchFetchDays/2026-11-26').fetches).toBe(1);
    expect(outs.map((o) => o.calls).sort()).toEqual([0, 10]);
    expect(paths(db)).toEqual(['researchFetchDays/2026-11-26', 'researchMeasures/GLW']);
    expect(db._get('researchMeasures/GLW').status).toBe('ok');
  });
  it('a refused claim writes nothing', async () => {
    const db = seeded(200);
    const v = db._versionOf('researchFetchDays/2026-11-26');
    expect((await claimFetchSlot(db, T0, { symbol: 'GLW' })).ok).toBe(false);
    expect(db._versionOf('researchFetchDays/2026-11-26')).toBe(v);
  });
  it.each([
    ['a string', 'abc'], ['a negative count', -500], ['null', null], ['a fraction', 1.5], ['missing', undefined],
  ])('a malformed counter (%s) refuses every claim: fail closed (review R2-5)', async (_t, fetches) => {
    const db = makeMandateFakeDb({ 'researchFetchDays/2026-11-26': { day: '2026-11-26', ...(fetches === undefined ? {} : { fetches }) } });
    const fetchImpl = fakeFetch(RESPONSE);
    expect(await claimFetchSlot(db, T0, { symbol: 'GLW' })).toMatchObject({ ok: false, reason: 'counter_malformed' });
    const out = await run('GLW', { db, fetchImpl });
    expect(out).toMatchObject({ outcome: 'over_ceiling', reason: 'counter_malformed', calls: 0 });
    expect(fetchImpl.urls).toEqual([]);
  });
});

describe('an error after the call cannot cost a call on every touch (review R2-1)', () => {
  it('a store write that fails after the call: the touch fails, and later touches that day make no call', async () => {
    const db = makeMandateFakeDb();
    db.failNextWrites('researchMeasures/GLW', 3);
    const fetchImpl = fakeFetch(RESPONSE);
    await expect(run('GLW', { db, fetchImpl })).rejects.toThrow();
    for (let i = 1; i <= 3; i += 1) {
      const out = await run('GLW', { db, fetchImpl, at: new Date(T0.getTime() + i * 60e3) });
      expect(out).toMatchObject({ outcome: 'unavailable', reason: 'symbol_claimed_today', calls: 0 });
    }
    expect(fetchImpl.urls).toHaveLength(1);
    expect(db._get('researchFetchDays/2026-11-26').fetches).toBe(1);
  });
  it('math that throws on the response stores compute_error, and the next touch makes no call', async () => {
    const broken = structuredClone(RESPONSE);
    broken.Earnings.History['2026-03-31'] = null;
    const db = makeMandateFakeDb();
    const fetchImpl = fakeFetch(broken);
    const out = await run('GLW', { db, fetchImpl });
    expect(out).toMatchObject({ outcome: 'unavailable', reason: 'compute_error', calls: CALLS_PER_FETCH });
    expect(db._get('researchMeasures/GLW')).toMatchObject({ status: 'unavailable', metrics: null, unavailable: { reason: 'compute_error', at: T0.toISOString() } });
    const again = await run('GLW', { db, fetchImpl, at: new Date(T0.getTime() + UNAVAILABLE_RETRY_MS + 1) });
    expect(again.calls).toBe(CALLS_PER_FETCH);
    expect(await run('GLW', { db, fetchImpl, at: new Date(T0.getTime() + UNAVAILABLE_RETRY_MS + 2) })).toMatchObject({ calls: 0 });
    expect(fetchImpl.urls).toHaveLength(2);
  });
});

describe('a slower failure never replaces numbers fetched after it began (review R2-2)', () => {
  /** A fetch that answers after `ms` milliseconds. */
  const slow = (answer, ms) => async () => {
    await new Promise((r) => setTimeout(r, ms));
    if (typeof answer === 'number') return { ok: false, status: answer, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => structuredClone(answer) };
  };
  it.each([
    ['a new stock', null],
    ['a stock with numbers 8 days old', '2026-11-18T23:00:00.000Z'],
  ])('%s: a refresh that began before midnight UTC and fails late leaves the success that landed after midnight', async (_t, oldFetchedAt) => {
    const seed = oldFetchedAt ? { 'researchMeasures/GLW': quiet(() => buildRecord('GLW', structuredClone(RESPONSE), oldFetchedAt)) } : {};
    const db = makeMandateFakeDb(seed);
    const beforeMidnight = new Date('2026-11-26T23:59:59.000Z');
    const afterMidnight = new Date('2026-11-27T00:00:01.000Z');
    const [failed, fetched] = await Promise.all([
      quietAsync(() => fetchResearchStock('GLW', { db, apiKey: KEY, fetchImpl: slow(503, 40), now: clockAt(beforeMidnight) })),
      quietAsync(() => fetchResearchStock('GLW', { db, apiKey: KEY, fetchImpl: slow(RESPONSE, 5), now: clockAt(afterMidnight) })),
    ]);
    expect(fetched.outcome).toBe('fetched');
    expect(failed).toMatchObject({ outcome: 'unavailable', reason: 'http_503', calls: CALLS_PER_FETCH });
    const stored = db._get('researchMeasures/GLW');
    expect(stored).toMatchObject({ status: 'ok', fetchedAt: afterMidnight.toISOString(), unavailable: null });
    expect(failed.record).toEqual(stored);
  });
});

describe('clocks and versions (review R2-4, R2-6)', () => {
  it('a kept record dated in the future (beyond a minute of clock skew) is not fresh: refetched once', () => {
    const rec = quiet(() => buildRecord('GLW', structuredClone(RESPONSE), '2027-06-01T00:00:00.000Z'));
    expect(planResearchFetch('GLW', rec, T0.getTime()).action).toBe('fetch');
    const skewed = quiet(() => buildRecord('GLW', structuredClone(RESPONSE), new Date(T0.getTime() + 30e3).toISOString()));
    expect(planResearchFetch('GLW', skewed, T0.getTime()).action).toBe('use_kept');
  });
  it('an unavailable mark dated in the future does not hold a stock for ever', () => {
    const rec = { symbol: 'GLW', status: 'unavailable', metrics: null, fetchedAt: null, unavailable: { reason: 'http_404', at: '2027-06-01T00:00:00.000Z' }, shapeVersion: MEASURES_SHAPE_VERSION };
    expect(planResearchFetch('GLW', rec, T0.getTime()).action).toBe('fetch');
  });
  it('a failed refetch keeps the record\'s own shape version (none stays none), so old-shape numbers are not later reused as current', async () => {
    const old = { ...quiet(() => buildRecord('GLW', structuredClone(RESPONSE), new Date(T0.getTime() - 86400e3).toISOString())) };
    delete old.shapeVersion;
    const db = makeMandateFakeDb({ 'researchMeasures/GLW': old });
    const out = await run('GLW', { db, fetchImpl: fakeFetch(503) });
    expect(out.outcome).toBe('unavailable');
    expect(db._get('researchMeasures/GLW').shapeVersion).toBeNull();
    const twoDaysOn = T0.getTime() + 2 * 86400e3;
    expect(planResearchFetch('GLW', db._get('researchMeasures/GLW'), twoDaysOn).action).toBe('fetch');
  });
});

// -- What it may touch -----------------------------------------------------------------------------------------------

describe('what it may touch', () => {
  it('names two collections and writes nothing the game reads', () => {
    expect([RESEARCH_MEASURES_COLLECTION, RESEARCH_FETCH_DAYS_COLLECTION]).toEqual(['researchMeasures', 'researchFetchDays']);
    // Literal names, so the protected-store write scan resolves every write site (compositionProtectedStores.scan.test.js).
    const collections = [...MODULE_SRC.matchAll(/\.collection\(\s*([^)]+?)\s*\)/g)].map((m) => m[1]);
    expect(collections.length).toBe(5);
    expect(new Set(collections)).toEqual(new Set(["'researchMeasures'", "'researchFetchDays'"]));
    for (const name of ['peerRankings', 'sectorRankings', 'scannerSummary', 'estimatesCache', 'indexIntelligence', 'institutionalAggregates', 'stockRankings', 'priceHistory']) {
      expect(MODULE_SRC).not.toContain(`'${name}'`);
    }
  });
  it('imports no SDK, reads no environment and has no default network path but the fetch it is handed', () => {
    const specifiers = [...MODULE_SRC.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(specifiers).toEqual(['./rankingConfig.js', './researchUniverse.js', './stockMeasures.js']);
    expect(MODULE_SRC).not.toMatch(/process\.env|firebase/);
  });
  it('firestore.rules names neither collection, and its last rule denies every client read and write', () => {
    const rules = readLf(path.join(HERE, '..', '..', 'firestore.rules'));
    expect(rules).not.toMatch(/researchMeasures|researchFetchDays/);
    expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}\s*\}\s*\}\s*$/);
    // The only other wildcards are scoped to named collections.
    const wild = [...rules.matchAll(/^\s*match (\S+) \{/gm)].map((m) => m[1]).filter((p) => p.includes('=**'));
    expect(wild).toEqual(['/tournamentGroups/{groupId}/{document=**}', '/{path=**}/hypothesisVersions/{versionId}', '/{document=**}']);
  });
});
