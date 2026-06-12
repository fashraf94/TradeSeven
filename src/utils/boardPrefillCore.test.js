// src/utils/boardPrefillCore.test.js
//
// P5 — battery for the shared prefill core. The convergence contract this
// locks: equipped-first ordering, dedupe across sources, the ∩ userPool step
// (previously BoardEditor-only), depth slicing, and the generalized
// no-watchlist floor (pad from ranked candidates ∩ pool, then the ranked
// pool itself, to depthMin exactly).

import { describe, it, expect } from 'vitest';
import { cleanSymbols, composeBoardPrefill, padBoardToFloor } from './boardPrefillCore';

describe('cleanSymbols', () => {
  it('trims, uppercases, dedupes, drops empties and non-strings', () => {
    expect(cleanSymbols([' nvda ', 'NVDA', 'amd', '', null, 7, 'amd'])).toEqual(['NVDA', 'AMD']);
  });

  it('tolerates a non-array', () => {
    expect(cleanSymbols(undefined)).toEqual([]);
  });
});

describe('composeBoardPrefill', () => {
  const pool = ['NVDA', 'AMD', 'TSLA', 'META', 'AAPL'];

  it('equipped names come first in stored order, then alerts not already present', () => {
    expect(composeBoardPrefill({
      equippedSymbols: ['TSLA', 'NVDA'],
      scoutAlertSymbols: ['NVDA', 'META'],
      userPool: pool,
    })).toEqual(['TSLA', 'NVDA', 'META']);
  });

  it('intersects with the pool — off-pool names are dropped', () => {
    expect(composeBoardPrefill({
      equippedSymbols: ['NVDA', 'ZZZZ'],
      scoutAlertSymbols: ['YYYY', 'AMD'],
      userPool: pool,
    })).toEqual(['NVDA', 'AMD']);
  });

  it('slices to depthMax', () => {
    expect(composeBoardPrefill({
      equippedSymbols: ['NVDA', 'AMD', 'TSLA'],
      userPool: pool,
      depthMax: 2,
    })).toEqual(['NVDA', 'AMD']);
  });

  it('userPool: null means no intersection (explicit semantics, no accidental wipe)', () => {
    expect(composeBoardPrefill({ equippedSymbols: ['ZZZZ'], userPool: null })).toEqual(['ZZZZ']);
  });

  it('empty sources yield an empty suggestion', () => {
    expect(composeBoardPrefill({ userPool: pool })).toEqual([]);
  });
});

describe('padBoardToFloor — the generalized no-watchlist floor', () => {
  const rankedPool = ['NVDA', 'AMD', 'TSLA', 'META', 'AAPL', 'MSFT'];

  it('pads from ranked candidates ∩ pool first, then the ranked pool, to depthMin exactly', () => {
    const { board, floored } = padBoardToFloor({
      board: ['META'],
      rankedCandidates: ['ZZZZ', 'TSLA', 'META'], // off-pool dropped, dupes skipped
      rankedPool,
      depthMin: 4,
    });
    expect(board).toEqual(['META', 'TSLA', 'NVDA', 'AMD']);
    expect(floored).toBe(true);
  });

  it('a board already at the floor is returned untouched, floored: false', () => {
    const input = ['NVDA', 'AMD'];
    const { board, floored } = padBoardToFloor({ board: input, rankedPool, depthMin: 2 });
    expect(board).toEqual(input);
    expect(floored).toBe(false);
  });

  it('an exhausted pool stops short of depthMin (caller defers loudly via buildBoardCommit)', () => {
    const { board, floored } = padBoardToFloor({
      board: [],
      rankedCandidates: [],
      rankedPool: ['NVDA', 'AMD'],
      depthMin: 5,
    });
    expect(board).toEqual(['NVDA', 'AMD']);
    expect(floored).toBe(true);
  });

  it('never mutates inputs', () => {
    const input = ['NVDA'];
    padBoardToFloor({ board: input, rankedPool, depthMin: 3 });
    expect(input).toEqual(['NVDA']);
  });
});
