// api/_utils/watchlistValidation.test.js
//
// Pins the shared watchlist caps at the source. These helpers were extracted
// (byte-identical) from api/forge/watchlists/[id].js so the PATCH route and the
// create-from-tickers branch in api/forge/watchlists.js validate against the
// same limits. The [id]/create handler suites cover the integration; these
// tests lock the unit behaviour so the caps can't silently drift.

import { describe, it, expect } from 'vitest';
import {
  capString,
  capTickersArray,
  NAME_MAX_LEN,
  NOTES_MAX_LEN,
  TICKERS_MAX_COUNT,
  TICKER_SYMBOL_MAX_LEN,
} from './watchlistValidation.js';

describe('cap constants (locked values)', () => {
  it('matches the Phase 4A audit Section 9 caps', () => {
    expect(NAME_MAX_LEN).toBe(100);
    expect(NOTES_MAX_LEN).toBe(2000);
    expect(TICKERS_MAX_COUNT).toBe(40);
    expect(TICKER_SYMBOL_MAX_LEN).toBe(12);
  });
});

describe('capString', () => {
  it('returns null for non-strings (PATCH uses this to skip a field)', () => {
    expect(capString(undefined, 100)).toBeNull();
    expect(capString(123, 100)).toBeNull();
    expect(capString(null, 100)).toBeNull();
  });

  it('trims and caps to the limit', () => {
    expect(capString('  hello  ', 100)).toBe('hello');
    expect(capString('x'.repeat(150), 100)).toHaveLength(100);
  });

  it('preserves an empty string (clearing a field)', () => {
    expect(capString('', 100)).toBe('');
  });
});

describe('capTickersArray', () => {
  const NOW = '2026-06-08T00:00:00.000Z';

  it('returns null when not given an array', () => {
    expect(capTickersArray(undefined, NOW)).toBeNull();
    expect(capTickersArray('AAPL', NOW)).toBeNull();
  });

  it('uppercases the symbol and defaults addedBy to user', () => {
    const out = capTickersArray([{ symbol: 'aapl' }], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].symbol).toBe('AAPL');
    expect(out[0].addedBy).toBe('user');
    expect(out[0].reasoning).toBe('');
    expect(out[0].category).toBe('');
    expect(out[0].addedAt).toBe(NOW);
  });

  it('honors an explicit valid addedBy and a provided addedAt', () => {
    const out = capTickersArray(
      [{ symbol: 'MSFT', addedBy: 'agent', addedAt: '2026-01-01T00:00:00.000Z' }],
      NOW,
    );
    expect(out[0].addedBy).toBe('agent');
    expect(out[0].addedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('drops malformed / empty-symbol entries', () => {
    const out = capTickersArray([{ symbol: '' }, { symbol: 123 }, { foo: 'bar' }, 'nope', null], NOW);
    expect(out).toEqual([]);
  });

  it('caps the symbol length and the list length', () => {
    const longSym = capTickersArray([{ symbol: 'A'.repeat(20) }], NOW);
    expect(longSym[0].symbol).toHaveLength(TICKER_SYMBOL_MAX_LEN);

    const many = Array.from({ length: 45 }, (_, i) => ({ symbol: `T${i}` }));
    expect(capTickersArray(many, NOW)).toHaveLength(TICKERS_MAX_COUNT);
  });
});
