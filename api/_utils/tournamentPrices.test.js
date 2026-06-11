// api/_utils/tournamentPrices.test.js
//
// Batch quote helper: URL contract (house comma-join), field normalization
// (EODHD 'NA' strings), caller-symbol round-tripping for dot-class tickers
// and crypto, and the degrade-to-empty failure convention.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL
// tournamentPrices module below is the runtime guard for its import of
// api/_utils/marketDataCache.js — it explodes in this Node test environment
// if a browser-only dependency ever enters that transitive graph. Never mock
// this import.

import { describe, it, expect } from 'vitest';
import { fetchBatchQuotes, fetchQuoteForSymbol } from './tournamentPrices.js';

const API_KEY = 'test-key';

function makeFetch(payload, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok, status, json: async () => payload };
  };
  return { fetchImpl, calls };
}

describe('fetchBatchQuotes', () => {
  it('issues one comma-joined real-time call and keys results by the caller symbol', async () => {
    const { fetchImpl, calls } = makeFetch([
      { code: 'NVDA.US', open: 100.5, close: 102.3, previousClose: 99.8, timestamp: 1765467000 },
      { code: 'BRK-B.US', open: 412.0, close: 415.2, previousClose: 410.9, timestamp: 1765467000 },
      { code: 'BTC-USD.CC', open: 64100, close: 64550.5, previousClose: 63900, timestamp: 1765467000 },
    ]);
    const quotes = await fetchBatchQuotes(['NVDA', 'BRK.B', 'BTC'], { fetchImpl, apiKey: API_KEY });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/real-time/NVDA.US,BRK-B.US,BTC-USD.CC?');
    expect(calls[0]).toContain('fmt=json');

    expect(quotes.NVDA).toEqual({ open: 100.5, current: 102.3, previousClose: 99.8, timestamp: 1765467000 });
    expect(quotes['BRK.B']).toEqual({ open: 412.0, current: 415.2, previousClose: 410.9, timestamp: 1765467000 });
    expect(quotes.BTC.current).toBe(64550.5);
  });

  it("normalizes EODHD's 'NA' strings and missing fields to null; current falls back to previousClose", async () => {
    const { fetchImpl } = makeFetch([
      { code: 'NVDA.US', open: 'NA', previousClose: 99.8, timestamp: 'NA' },
    ]);
    const quotes = await fetchBatchQuotes(['NVDA'], { fetchImpl, apiKey: API_KEY });
    expect(quotes.NVDA).toEqual({ open: null, current: 99.8, previousClose: 99.8, timestamp: null });
  });

  it('handles a single-object (non-array) response and dedupes/uppercases input', async () => {
    const { fetchImpl, calls } = makeFetch({ code: 'NVDA.US', open: 1, close: 2, previousClose: 3, timestamp: 4 });
    const quotes = await fetchBatchQuotes(['nvda', 'NVDA '], { fetchImpl, apiKey: API_KEY });
    expect(calls[0]).toContain('/real-time/NVDA.US?');
    expect(quotes.NVDA.current).toBe(2);
  });

  it('returns {} on transport failure, non-ok status, missing key, or empty input — never throws', async () => {
    const boom = async () => { throw new Error('network down'); };
    expect(await fetchBatchQuotes(['NVDA'], { fetchImpl: boom, apiKey: API_KEY })).toEqual({});

    const { fetchImpl } = makeFetch([], { ok: false, status: 502 });
    expect(await fetchBatchQuotes(['NVDA'], { fetchImpl, apiKey: API_KEY })).toEqual({});

    expect(await fetchBatchQuotes(['NVDA'], { fetchImpl, apiKey: undefined })).toEqual({});

    const { fetchImpl: untouched, calls } = makeFetch([]);
    expect(await fetchBatchQuotes([], { fetchImpl: untouched, apiKey: API_KEY })).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('ignores response items for symbols that were not asked for', async () => {
    const { fetchImpl } = makeFetch([
      { code: 'NVDA.US', open: 1, close: 2, previousClose: 3, timestamp: 4 },
      { code: 'TSLA.US', open: 9, close: 9, previousClose: 9, timestamp: 9 },
    ]);
    const quotes = await fetchBatchQuotes(['NVDA'], { fetchImpl, apiKey: API_KEY });
    expect(Object.keys(quotes)).toEqual(['NVDA']);
  });
});

describe('fetchQuoteForSymbol', () => {
  it('returns the single quote, or null when unavailable', async () => {
    const { fetchImpl } = makeFetch([{ code: 'NVDA.US', open: 1, close: 2, previousClose: 3, timestamp: 4 }]);
    expect((await fetchQuoteForSymbol('NVDA', { fetchImpl, apiKey: API_KEY })).current).toBe(2);

    const { fetchImpl: empty } = makeFetch([]);
    expect(await fetchQuoteForSymbol('NVDA', { fetchImpl: empty, apiKey: API_KEY })).toBeNull();
  });
});
