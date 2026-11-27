// api/_utils/sharedResearch/researchRows.test.js
//
// Research universe Build 3b, build prompt sections 5.4 and 6: names and a research company's numbers on a research
// session. On the atomic in-memory Firestore double, with a fake fetch; no row calls EODHD or Firestore.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real, unmocked import of researchRows.js is the runtime guard for its graph.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeSrFirestore } from './__fixtures__/srFirestore.js';
import { namesFor, fetchableOf, rowSymbolsOf, researchRowOf, researchRowsFor, RESEARCH_FETCHES_PER_INVESTIGATION, NUMBERS } from './researchRows.js';
import { readNames } from './store.js';

const RESEARCH = { universe: 'research', entry: { names: [] } };
const GAME = { entry: { names: [] } };
const NOW = new Date('2026-11-27T15:00:00.000Z');
const kept = (symbol, over = {}) => ({ symbol, name: `${symbol} Kept Name`, sectorId: 'XLK', status: 'ok', metrics: { grossMargin: 0.36, fcfYield: 6.9 }, estimates: null, fetchedAt: '2026-11-26T15:00:00.000Z', unavailable: null, reportsIn: 'USD', heldBack: [], shapeVersion: 2, ...over });
const rel = (symbol, n, status = 'verified') => ({ findingId: `f_${n}`, kind: 'relationship', symbol, status, fact: 'Supplier · x' });

afterEach(() => { vi.restoreAllMocks(); });

describe('namesFor (section 5.4)', () => {
  it('a game-list session reads exactly what readNames reads: peerRankings only', async () => {
    const env = makeSrFirestore({ 'peerRankings/NVDA': { name: 'NVIDIA Corporation' }, 'researchMeasures/GLW': kept('GLW') });
    expect(await namesFor(env.db, ['NVDA', 'GLW'], GAME)).toEqual(await readNames(env.db, ['NVDA', 'GLW']));
    expect(await namesFor(env.db, ['NVDA', 'GLW'], GAME)).toEqual({ NVDA: 'NVIDIA Corporation' });
  });
  it("a research session: a game stock's peerRankings name; a research stock's kept record name, else the directory's", async () => {
    const env = makeSrFirestore({ 'peerRankings/NVDA': { name: 'NVIDIA Corporation' }, 'researchMeasures/GLW': kept('GLW', { name: 'Corning Inc' }) });
    expect(await namesFor(env.db, ['NVDA', 'GLW', 'ANET'], RESEARCH)).toEqual({ NVDA: 'NVIDIA Corporation', GLW: 'Corning Inc', ANET: 'Arista Networks' });
    expect(env.reads.map(([, p]) => p).sort()).toEqual(['peerRankings/NVDA', 'researchMeasures/ANET', 'researchMeasures/GLW']);
  });
});

describe('fetchableOf: at most 10, in a fixed order (section 6)', () => {
  const twelve = ['GLW', 'ANET', 'MRVL', 'COHR', 'CIEN', 'VRT', 'HPE', 'TSM', 'ASML', 'ARM', 'APH', 'TEL'];
  it('the names in scope first, then each research company by its first Source-backed relationship; game stocks never', () => {
    const session = { universe: 'research', entry: { names: ['NVDA', 'TSM'] } };
    const record = { findings: [rel('GLW', 1), rel('NVDA', 2), rel('ANET', 3, 'unverified'), rel('ANET', 4), rel('GLW', 5)] };
    expect(fetchableOf(session, record)).toEqual(['TSM', 'GLW', 'ANET']);
  });
  it('the first ten never change: superseding a finding, or adding more, never lets an eleventh in', () => {
    const record = { findings: twelve.map((s, i) => rel(s, i)) };
    const first = fetchableOf(RESEARCH, record);
    expect(first).toEqual(twelve.slice(0, RESEARCH_FETCHES_PER_INVESTIGATION));
    // a correction supersedes GLW's finding: it stays on the record (appended, never removed), so the ten are the same
    const after = { findings: [...record.findings, { ...rel('GLW', 99, 'unavailable'), supersedes: 'f_0' }, rel('ZION', 100)] };
    expect(fetchableOf(RESEARCH, after)).toEqual(first);
  });
  it('the rows: the names in scope, then the supported companies, each once', () => {
    expect(rowSymbolsOf({ entry: { names: ['NVDA', 'GLW'] } }, { supported: [{ symbol: 'GLW' }, { symbol: 'ANET' }] })).toEqual(['NVDA', 'GLW', 'ANET']);
  });
});

describe("a research company's row", () => {
  it('shown: its name and symbol, its sector, no rank, its measures as kept, the date fetched, its currency', () => {
    expect(researchRowOf('GLW', kept('GLW'), { fetchable: true, name: 'Corning Incorporated', nowMs: NOW.getTime() })).toEqual({
      symbol: 'GLW', name: 'Corning Incorporated', research: true,
      peer: { sector: 'Technology', metrics: { grossMargin: 0.36, fcfYield: 6.9 }, asOf: '2026-11-26T15:00:00.000Z' },
      ranking: null, numbers: NUMBERS.shown, stale: false, reportsIn: 'USD', heldBack: [],
    });
  });
  it('past the tenth: its numbers were not fetched, and none are shown even when kept', () => {
    const row = researchRowOf('APH', kept('APH'), { fetchable: false, nowMs: NOW.getTime() });
    expect(row).toMatchObject({ numbers: NUMBERS.notFetched, peer: { metrics: null, asOf: null }, ranking: null });
  });
  it('nothing kept, or a failure with no earlier numbers: not available today', () => {
    expect(researchRowOf('GLW', null, { fetchable: true, nowMs: NOW.getTime() })).toMatchObject({ numbers: NUMBERS.notAvailable, name: 'Corning Incorporated' });
    expect(researchRowOf('GLW', { status: 'unavailable', metrics: null }, { fetchable: true, nowMs: NOW.getTime() }).numbers).toBe(NUMBERS.notAvailable);
  });
  it('numbers older than 7 days are shown, marked stale; held-back measures carry their currency', () => {
    const row = researchRowOf('TSM', kept('TSM', { fetchedAt: '2026-11-10T00:00:00.000Z', reportsIn: 'TWD', heldBack: ['fcfYield', 'fcfMargin', 'priceSalesTTM'] }), { fetchable: true, nowMs: NOW.getTime() });
    expect(row).toMatchObject({ numbers: NUMBERS.shown, stale: true, reportsIn: 'TWD', heldBack: ['fcfYield', 'fcfMargin', 'priceSalesTTM'] });
  });
  it('never a rank, a percentile, a tier or a score at any depth (RU-15)', () => {
    const keys = [];
    const walk = (v) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.push(k); walk(x); } };
    walk(researchRowOf('GLW', kept('GLW'), { fetchable: true, nowMs: NOW.getTime() }));
    expect(keys.filter((k) => /percentile|tier|score|composite|rank(?!ing$)/i.test(k))).toEqual([]);
  });
});

describe('researchRowsFor: fetching and reading', () => {
  const companies = { supported: [{ symbol: 'GLW', name: 'Corning Incorporated' }] };
  const record = { findings: [rel('GLW', 1)] };
  it('with nothing to fetch with (a read): what is kept, no call', async () => {
    const env = makeSrFirestore({ 'researchMeasures/GLW': kept('GLW') });
    const rows = await researchRowsFor(env.db, { session: RESEARCH, record, companies, names: { GLW: 'Corning Incorporated' }, fetch: null });
    expect(rows).toEqual([expect.objectContaining({ symbol: 'GLW', numbers: 'shown' })]);
    expect(env.writes).toEqual([]);
  });
  it('past its start-by point a step fetches nothing: it reads what is kept', async () => {
    const env = makeSrFirestore({});
    const fetchImpl = vi.fn();
    const rows = await researchRowsFor(env.db, { session: RESEARCH, record, companies, fetch: { apiKey: 'K', fetchImpl, now: () => NOW, deadlineAt: Date.now() - 1 } });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(rows[0].numbers).toBe('not_available');
    expect(env.writes).toEqual([]);
  });
  it('a fetch that throws never throws here: the row is not available', async () => {
    const env = makeSrFirestore({});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows = await researchRowsFor(env.db, { session: RESEARCH, record, companies, fetch: { apiKey: undefined, fetchImpl: vi.fn(), now: () => NOW, deadlineAt: null } });
    expect(rows[0].numbers).toBe('not_available');
  });
});
