// api/_utils/researchMeasures.precedence.test.js
//
// Research universe Build 2 (PR B), review R2-9: a retired game stock the directory holds is still refused. The real
// directory holds no retired symbol today, but Build 1 showed one can enter it (PARA's symbol now names another
// company; RU-14 has each rebuild report it). The fetch module is not mocked; only the directory's data is planted.

import { describe, it, expect, vi } from 'vitest';
import { makeMandateFakeDb } from './__testsupport__/mandateFakeFirestore.js';

vi.mock('./researchDirectory.js', () => ({
  RESEARCH_DIRECTORY: Object.freeze({
    PARA: Object.freeze(['Planted Parabolic', 'XLK', 'Planted']),
    ZQXA: Object.freeze(['Sentinel Co', 'XLB', null]),
  }),
  RESEARCH_DIRECTORY_META: Object.freeze({ generatedOn: '2026-11-26', count: 2, floorUsd: 1_000_000_000 }),
}));

const { isResearchStock } = await import('./researchUniverse.js');
const { RETIRED_STOCKS } = await import('./rankingConfig.js');
const { refusalOf, planResearchFetch, fetchResearchStock } = await import('./researchMeasures.js');

describe('a retired game stock that is a directory entry', () => {
  it('is a research stock to the accessor, and retired', () => {
    expect(isResearchStock('PARA')).toBe(true);
    expect(Object.hasOwn(RETIRED_STOCKS, 'PARA')).toBe(true);
  });
  it('is refused as retired, with no read, no write and no call', async () => {
    expect(refusalOf('PARA')).toBe('retired');
    expect(planResearchFetch('PARA', null, Date.now())).toEqual({ action: 'refuse', reason: 'retired', calls: 0 });
    const db = makeMandateFakeDb();
    const urls = [];
    const out = await fetchResearchStock('PARA', { db, apiKey: 'k', fetchImpl: async (u) => { urls.push(u); throw new Error('called'); } });
    expect(out).toMatchObject({ outcome: 'refused', reason: 'retired', calls: 0, record: null });
    expect(urls).toEqual([]);
    expect([...db._store.keys()]).toEqual([]);
  });
  it('a planted entry that is not retired is not refused (the plant works)', () => {
    expect(refusalOf('ZQXA')).toBeNull();
  });
});
