// src/components/Forge/Watchlist/tickerSearchMatch.test.js
//
// Sprint 6 Phase 4B — pure-logic coverage for the ticker-add search.

import { describe, it, expect } from 'vitest';
import { searchUniverse } from './tickerSearchMatch';

describe('searchUniverse', () => {
  it('matches by ticker symbol prefix', () => {
    const results = searchUniverse('AAP');
    expect(results.some((r) => r.symbol === 'AAPL')).toBe(true);
  });

  it('ranks an exact symbol match above prefix matches', () => {
    // "C" is Citigroup's ticker; many symbols also start with C.
    const results = searchUniverse('C');
    expect(results[0].symbol).toBe('C');
  });

  it('matches by GICS industry name', () => {
    const results = searchUniverse('semiconductor');
    const symbols = results.map((r) => r.symbol);
    expect(symbols).toContain('NVDA'); // industry: Semiconductors & Semiconductor Equipment
    expect(symbols).toContain('AMD');
  });

  it('does not match company names (no company-name data, per A2)', () => {
    // "apple" is Apple's company name but not its symbol/industry.
    expect(searchUniverse('apple').some((r) => r.symbol === 'AAPL')).toBe(false);
  });

  it('excludes symbols already in the watchlist', () => {
    const results = searchUniverse('AAP', { excludeSymbols: ['AAPL'] });
    expect(results.some((r) => r.symbol === 'AAPL')).toBe(false);
  });

  it('returns nothing at capacity or for an empty query', () => {
    expect(searchUniverse('AAPL', { atCap: true })).toEqual([]);
    expect(searchUniverse('')).toEqual([]);
    expect(searchUniverse('   ')).toEqual([]);
  });
});
