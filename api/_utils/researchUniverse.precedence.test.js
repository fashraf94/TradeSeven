// api/_utils/researchUniverse.precedence.test.js
//
// Research universe Build 1: the accessor's precedence rules on a PLANTED directory (build prompt section 3.2).
// The real directory never holds one of the 228 (researchDirectory.test.js), so the rule "for one of the 228 the
// house map wins" can only be shown on a planted one. The accessor itself is not mocked; only its data is.

import { describe, it, expect, vi } from 'vitest';

vi.mock('./researchDirectory.js', () => ({
  RESEARCH_DIRECTORY: Object.freeze({
    AAPL: Object.freeze(['Planted Apple', 'XLE', 'Planted']),
    PARA: Object.freeze(['Planted Para', 'XLK', 'Planted']),
    ZQXA: Object.freeze(['Sentinel Co', 'XLB', null]),
  }),
  RESEARCH_DIRECTORY_META: Object.freeze({ generatedOn: '2026-11-26', count: 3, floorUsd: 1_000_000_000 }),
}));

const { isResearchStock, researchIndustryOf, researchSectorOf, researchUniverse, RESEARCH_DIRECTORY_COUNT } = await import('./researchUniverse.js');
const { resolveSymbol } = await import('./sharedResearch/companies.js');
const { RETIRED_STOCKS, TICKER_TO_SECTOR } = await import('./rankingConfig.js');

describe('on a planted directory', () => {
  it('the house map wins for one of the 228, and it is never a research stock', () => {
    expect(TICKER_TO_SECTOR.AAPL).toBe('XLK');
    expect(researchSectorOf('AAPL')).toBe('XLK');
    expect(isResearchStock('AAPL')).toBe(false);
    expect(researchUniverse.has('AAPL')).toBe(true);
  });
  it('a directory entry reads the directory', () => {
    expect(researchSectorOf('ZQXA')).toBe('XLB');
    expect(isResearchStock('ZQXA')).toBe(true);
    expect(researchIndustryOf('ZQXA')).toBeNull();
    expect(RESEARCH_DIRECTORY_COUNT).toBe(3);
  });
  it('a retired stock the directory holds (as built; a later build rules on it): held, retired, refused by resolveSymbol, the directory\'s sector', () => {
    expect(RETIRED_STOCKS.PARA).toBe('XLC');
    expect(researchUniverse.has('PARA')).toBe(true);
    expect(researchUniverse.retired('PARA')).toBe(true);
    expect(resolveSymbol('para', researchUniverse)).toBeNull();
    expect(isResearchStock('PARA')).toBe(true);
    expect(researchSectorOf('PARA')).toBe('XLK');
  });
});
