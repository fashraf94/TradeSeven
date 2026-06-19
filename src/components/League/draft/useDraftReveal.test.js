// src/components/League/draft/useDraftReveal.test.js
//
// Tests for the pure snipe-enrichment used by the opponent reveal. A snipe = a
// CPU took a name that sat in the human's pre-pick top tier (#1–6).

import { describe, it, expect } from 'vitest';
import { enrichRevealBlock } from './useDraftReveal';

const ranks = new Map([
  ['NVDA', 1],
  ['META', 3],
  ['AMD', 6],
  ['KO', 7],
  ['XLU', 20],
]);

describe('enrichRevealBlock', () => {
  it('flags a snipe when the symbol was in the top 6 of the pre-pick board', () => {
    const out = enrichRevealBlock([{ pickNumber: 2, odUserId: 'cpu1', symbol: 'META' }], ranks);
    expect(out[0]).toMatchObject({ symbol: 'META', humanRank: 3, sniped: true, pickNumber: 2, odUserId: 'cpu1' });
  });

  it('rank 6 is a snipe (inclusive), rank 7 is not', () => {
    const out = enrichRevealBlock([
      { pickNumber: 2, odUserId: 'c', symbol: 'AMD' },
      { pickNumber: 3, odUserId: 'c', symbol: 'KO' },
    ], ranks);
    expect(out[0].sniped).toBe(true);   // #6
    expect(out[1].sniped).toBe(false);  // #7
  });

  it('a name outside the top tier is not a snipe', () => {
    const out = enrichRevealBlock([{ pickNumber: 4, odUserId: 'c', symbol: 'XLU' }], ranks);
    expect(out[0]).toMatchObject({ humanRank: 20, sniped: false });
  });

  it('a name not on the captured board has no rank and is not a snipe', () => {
    const out = enrichRevealBlock([{ pickNumber: 5, odUserId: 'c', symbol: 'TSLA' }], ranks);
    expect(out[0]).toMatchObject({ humanRank: null, sniped: false });
  });

  it('uppercases symbols and tolerates a missing ranks map', () => {
    const out = enrichRevealBlock([{ pickNumber: 2, odUserId: 'c', symbol: 'nvda' }], null);
    expect(out[0].symbol).toBe('NVDA');
    expect(out[0].sniped).toBe(false);
  });

  it('returns [] for empty / missing input', () => {
    expect(enrichRevealBlock([], ranks)).toEqual([]);
    expect(enrichRevealBlock(undefined, ranks)).toEqual([]);
  });
});
