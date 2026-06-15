// src/utils/watchlistProvenance.test.js
//
// Unit tests for the pure provenance display helper. Plain vitest, no
// rendering — matches the repo's pure-function unit-test convention.

import { describe, it, expect } from 'vitest';
import { getWatchlistProvenance } from './watchlistProvenance.js';

describe('getWatchlistProvenance', () => {
  it('source "theme" -> DISCOVER with ticker count', () => {
    expect(getWatchlistProvenance({ source: 'theme', tickers: [1, 2, 3, 4] }))
      .toEqual({ label: 'DISCOVER', count: 4 });
  });

  it('sourceDropId present -> ATLAS', () => {
    expect(getWatchlistProvenance({ sourceDropId: 'drop-1', tickers: [1] }))
      .toEqual({ label: 'ATLAS', count: 1 });
  });

  it('sourceSessionId present -> ATLAS', () => {
    expect(getWatchlistProvenance({ sourceSessionId: 'sess-1', tickers: [] }))
      .toEqual({ label: 'ATLAS', count: 0 });
  });

  it('no source markers -> MANUAL', () => {
    expect(getWatchlistProvenance({ tickers: [1, 2, 3] }))
      .toEqual({ label: 'MANUAL', count: 3 });
  });

  it('theme takes precedence over drop/session', () => {
    expect(
      getWatchlistProvenance({ source: 'theme', sourceDropId: 'd', sourceSessionId: 's', tickers: [] }).label
    ).toBe('DISCOVER');
  });

  it('null / undefined -> omit label, count 0', () => {
    expect(getWatchlistProvenance(null)).toEqual({ label: null, count: 0 });
    expect(getWatchlistProvenance(undefined)).toEqual({ label: null, count: 0 });
  });

  it('non-array tickers -> count 0', () => {
    expect(getWatchlistProvenance({ source: 'theme', tickers: 'oops' }))
      .toEqual({ label: 'DISCOVER', count: 0 });
  });
});
