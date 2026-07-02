// api/_utils/canonicalOpen.test.js
//
// Phase 1 guard tests for the canonical-open capture util. The load-bearing
// TRIPWIRE: the capture path reads the PINNED source (fetchBatchQuotes →
// /real-time/ item.open) and NEVER getStockAnalysisData (the /eod/ feed that
// would recreate the intraday-vs-banked open divergence). The real import of
// canonicalOpen.js below is ALSO the dependency-surface guard (BUILD_RULES §4):
// it explodes here if a browser dep enters the graph. Never mock it away.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Control the PINNED source's output.
const fetchBatchQuotes = vi.fn();
vi.mock('./tournamentPrices.js', () => ({
  fetchBatchQuotes: (...a) => fetchBatchQuotes(...a),
}));

// Tripwire: if the capture path ever reaches for getStockAnalysisData (the
// WRONG /eod/ feed), this spy records it and the guard test fails.
const getStockAnalysisData = vi.fn(async () => ({}));
vi.mock('./marketDataCache.js', () => ({
  getStockAnalysisData: (...a) => getStockAnalysisData(...a),
  isCryptoSymbol: (s) => /-USD$|^(BTC|ETH|SOL)$/.test(String(s || '')),
}));

import { fetchCanonicalOpens } from './canonicalOpen.js';

describe('fetchCanonicalOpens — pinned source, fail-closed', () => {
  beforeEach(() => { fetchBatchQuotes.mockReset(); getStockAnalysisData.mockClear(); });

  it('returns { open, priceTimestamp, instrumentId } when the batch quote carries a positive open', async () => {
    fetchBatchQuotes.mockResolvedValue({
      LLY: { open: 812.5, close: 820, current: 820, previousClose: 800, timestamp: 1719927000 },
    });
    const out = await fetchCanonicalOpens(['lly']); // lowercased on input → uppercased internally
    expect(out).toEqual({ LLY: { open: 812.5, priceTimestamp: 1719927000, instrumentId: null } });
  });

  it('fail-closed: absent / zero / negative open → null (no fallback, no last-close substitution)', async () => {
    fetchBatchQuotes.mockResolvedValue({
      A: { open: null, close: 10, current: 10, previousClose: 9, timestamp: 1 },
      B: { open: 0, close: 10, current: 10, previousClose: 9, timestamp: 1 },
      C: { open: -5, close: 10, current: 10, previousClose: 9, timestamp: 1 },
      // D omitted from the quote payload entirely
    });
    const out = await fetchCanonicalOpens(['A', 'B', 'C', 'D']);
    expect(out).toEqual({ A: null, B: null, C: null, D: null });
  });

  it('degrades to all-null when the vendor batch fails (fetchBatchQuotes returns {})', async () => {
    fetchBatchQuotes.mockResolvedValue({});
    const out = await fetchCanonicalOpens(['NVDA', 'AMD']);
    expect(out).toEqual({ NVDA: null, AMD: null });
  });

  it('GUARD (tripwire): NEVER calls getStockAnalysisData; reads the pinned batch source', async () => {
    fetchBatchQuotes.mockResolvedValue({ NVDA: { open: 100, timestamp: 5 } });
    await fetchCanonicalOpens(['NVDA']);
    expect(getStockAnalysisData).not.toHaveBeenCalled();
    expect(fetchBatchQuotes).toHaveBeenCalledWith(['NVDA'], {});
  });

  it('empty / blank symbol list short-circuits without a vendor call', async () => {
    const out = await fetchCanonicalOpens(['', '  ', null, undefined]);
    expect(out).toEqual({});
    expect(fetchBatchQuotes).not.toHaveBeenCalled();
  });
});
