// api/_utils/splitTickersByValidation.test.js
//
// Sprint 6 Phase 4.5a — covers the four product cases for the Signal Read
// "found but not in our universe" section (V-18 through V-25) plus defensive
// behavior on malformed inputs.

import { describe, it, expect } from 'vitest';
import { splitTickersByValidation } from './splitTickersByValidation.js';

describe('splitTickersByValidation', () => {
  it('V-18: all-validated input — unsupported empty', () => {
    const result = splitTickersByValidation({
      parse: { tickers: ['AAPL', 'MSFT'], impliedTickers: [] },
      validation: {
        validated: [
          { symbol: 'AAPL', sectorId: 'XLK' },
          { symbol: 'MSFT', sectorId: 'XLK' },
        ],
        unsupported: [],
      },
    });
    expect(result.validated).toEqual(['AAPL', 'MSFT']);
    expect(result.unsupported).toEqual([]);
    expect(result.implied).toEqual([]);
  });

  it('V-19: all-unsupported input — validated empty', () => {
    const result = splitTickersByValidation({
      parse: { tickers: ['GK', 'ARKK'], impliedTickers: [] },
      validation: {
        validated: [],
        unsupported: ['GK', 'ARKK'],
      },
    });
    expect(result.validated).toEqual([]);
    expect(result.unsupported).toEqual(['GK', 'ARKK']);
    expect(result.implied).toEqual([]);
  });

  it('V-20: mix — both validated and unsupported populated', () => {
    const result = splitTickersByValidation({
      parse: { tickers: ['AAPL', 'GK'], impliedTickers: [] },
      validation: {
        validated: [{ symbol: 'AAPL', sectorId: 'XLK' }],
        unsupported: ['GK'],
      },
    });
    expect(result.validated).toEqual(['AAPL']);
    expect(result.unsupported).toEqual(['GK']);
    expect(result.implied).toEqual([]);
  });

  it('V-21: empty parseResult — returns all empty, no throw', () => {
    expect(splitTickersByValidation(null)).toEqual({
      validated: [], implied: [], unsupported: [],
    });
    expect(splitTickersByValidation(undefined)).toEqual({
      validated: [], implied: [], unsupported: [],
    });
    expect(splitTickersByValidation({})).toEqual({
      validated: [], implied: [], unsupported: [],
    });
  });

  it('V-22: missing validation — returns empty validated/unsupported, preserves implied', () => {
    const result = splitTickersByValidation({
      parse: { impliedTickers: ['NVDA'] },
    });
    expect(result.validated).toEqual([]);
    expect(result.unsupported).toEqual([]);
    expect(result.implied).toEqual(['NVDA']);
  });

  it('V-23: missing parse — returns all empty', () => {
    const result = splitTickersByValidation({
      validation: { validated: [{ symbol: 'AAPL', sectorId: 'XLK' }], unsupported: [] },
    });
    expect(result.validated).toEqual(['AAPL']);
    expect(result.unsupported).toEqual([]);
    expect(result.implied).toEqual([]);
  });

  it('V-24: implied tickers passthrough regardless of validation state', () => {
    const result = splitTickersByValidation({
      parse: { tickers: ['AAPL'], impliedTickers: ['NVDA', 'MSFT'] },
      validation: {
        validated: [{ symbol: 'AAPL', sectorId: 'XLK' }],
        unsupported: [],
      },
    });
    expect(result.implied).toEqual(['NVDA', 'MSFT']);
  });

  it('V-25: malformed validation.validated entries (missing symbol) are dropped', () => {
    const result = splitTickersByValidation({
      parse: { tickers: ['AAPL'], impliedTickers: [] },
      validation: {
        validated: [
          { symbol: 'AAPL', sectorId: 'XLK' },
          { sectorId: 'XLK' },           // missing symbol — drop
          null,                            // null entry — drop
          { symbol: 42 },                  // non-string symbol — drop
        ],
        unsupported: ['GK', null, '', 7], // null/empty/non-string also dropped
      },
    });
    expect(result.validated).toEqual(['AAPL']);
    expect(result.unsupported).toEqual(['GK']);
  });
});
