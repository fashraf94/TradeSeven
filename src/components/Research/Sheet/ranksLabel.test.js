// The two-view shell — R-32, the Ranks label (spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-7): the group the SHOWN rank is
// within, which rank, the reading's ET day — from the fields CompeteTab's badge
// prints (BUILD_RULES §9). Never "All stocks" for a rank within a sector; no
// reading time → no day.

import { describe, it, expect } from 'vitest';
import { ranksLabelOf, readingMs, etDayLabel } from './ranksLabel.js';

// Wed Nov 11, 2026, 22:05 ET = Thu 03:05 UTC: the ET day, never the UTC one.
const WED_EVENING_ET = Date.UTC(2026, 10, 12, 3, 5);
const PEER = { sectorName: 'Utilities', compositeRank: 12, totalPeers: 38, computedAt: new Date(WED_EVENING_ET).toISOString() };
const RANKINGS = { computedAt: { toMillis: () => WED_EVENING_ET } };
const ROW = { symbol: 'CEG', sectorName: 'Utilities', sectorTechnicalRank: 4, sectorTechnicalTotal: 38 };
const TECH = { technicalRank: 31, updatedAt: { seconds: Math.floor(Date.UTC(2026, 10, 10, 21, 0) / 1000), nanoseconds: 0 } };

describe('ranksLabelOf', () => {
  it('fundamental (the badge CompeteTab opens on): the peer group, the peer-rankings day', () => {
    expect(ranksLabelOf({ data: PEER, rankingsData: RANKINGS, currentStockRanking: ROW, techData: TECH, selectedView: 'fundamental' }))
      .toBe('Utilities · fundamental rank · Wed Nov 11');
  });
  it('technical within the sector: the sector, the stockRankings day', () => {
    expect(ranksLabelOf({ data: PEER, rankingsData: RANKINGS, currentStockRanking: ROW, techData: TECH, selectedView: 'technical' }))
      .toBe('Utilities · technical rank · Wed Nov 11');
  });
  it('technical with no sector rank: the badge shows the universe rank, so All stocks, at the score doc\'s own time', () => {
    expect(ranksLabelOf({ data: PEER, rankingsData: RANKINGS, currentStockRanking: { symbol: 'CEG' }, techData: TECH, selectedView: 'technical' }))
      .toBe('All stocks · technical rank · Tue Nov 10');
  });
  it('never All stocks when the rank is within a sector', () => {
    const label = ranksLabelOf({ data: PEER, rankingsData: RANKINGS, currentStockRanking: ROW, techData: TECH, selectedView: 'technical' });
    expect(label).not.toContain('All stocks');
  });
  it('no reading time: the group and the rank, no day (never "today")', () => {
    expect(ranksLabelOf({ data: { ...PEER, computedAt: undefined }, selectedView: 'fundamental' })).toBe('Utilities · fundamental rank');
  });
  it('nothing to name: no label', () => {
    expect(ranksLabelOf({ data: null, selectedView: 'fundamental' })).toBe(null);
    expect(ranksLabelOf({ data: { ...PEER, sectorName: '' }, selectedView: 'fundamental' })).toBe(null);
    expect(ranksLabelOf({ data: PEER, currentStockRanking: null, techData: null, selectedView: 'technical' })).toBe(null);
  });
});

describe('the reading\'s instant and its ET day', () => {
  it('epoch ms, an ISO string, a Timestamp with toMillis, a serialized Timestamp', () => {
    expect(readingMs(WED_EVENING_ET)).toBe(WED_EVENING_ET);
    expect(readingMs(new Date(WED_EVENING_ET).toISOString())).toBe(WED_EVENING_ET);
    expect(readingMs({ toMillis: () => WED_EVENING_ET })).toBe(WED_EVENING_ET);
    expect(readingMs({ seconds: WED_EVENING_ET / 1000, nanoseconds: 0 })).toBe(WED_EVENING_ET);
    expect(readingMs({ _seconds: WED_EVENING_ET / 1000 })).toBe(WED_EVENING_ET);
    expect([readingMs(null), readingMs('nope'), readingMs({}), readingMs(-1)]).toEqual([null, null, null, null]);
  });
  it('the ET day, never the UTC one', () => {
    expect(etDayLabel(WED_EVENING_ET)).toBe('Wed Nov 11');
    expect(etDayLabel(null)).toBe(null);
  });
});
