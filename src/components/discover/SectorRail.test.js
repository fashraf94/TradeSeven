import { describe, it, expect, vi } from 'vitest';

// Neutralize module-load side effects so we can import the named
// `computeRenderOrder` export from SectorRail.jsx without booting
// Firebase or pulling localStorage init through cacheService.
vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  default: {},
}));
vi.mock('../../services/eodhdAPI', () => ({
  getMultipleStockPrices: vi.fn(),
}));

import { computeRenderOrder } from './SectorRail';

// Fixtures shared across cases. 5D order: XLE(5) > XLK(4) > XLV(3) > XLF(2).
// Hot-3 = [XLE, XLK, XLV]; remaining (by displayOrder asc) = [XLF].
const SECTORS = [
  { ticker: 'XLK', name: 'Technology', displayOrder: 1 },
  { ticker: 'XLF', name: 'Financials', displayOrder: 2 },
  { ticker: 'XLV', name: 'Healthcare', displayOrder: 3 },
  { ticker: 'XLE', name: 'Energy', displayOrder: 4 },
];
const SNAPSHOT = [
  { etf: 'XLK', changePercent: 1.0, weekChange: 4.0 },
  { etf: 'XLF', changePercent: 2.0, weekChange: 2.0 },
  { etf: 'XLV', changePercent: 3.0, weekChange: 3.0 },
  { etf: 'XLE', changePercent: 4.0, weekChange: 5.0 },
];
const EXPECTED_RANKING = ['XLE', 'XLK', 'XLV', 'XLF'];
const EXPECTED_MEDALS = [1, 2, 3, null];
const EXPECTED_FIVE_DAY = [5.0, 4.0, 3.0, 2.0];

function byTicker(result, ticker) {
  return result.find((s) => s.ticker === ticker);
}

function assertFiveDayRankingUnchanged(result) {
  expect(result.map((s) => s.ticker)).toEqual(EXPECTED_RANKING);
  expect(result.map((s) => s.medalRank)).toEqual(EXPECTED_MEDALS);
  expect(result.map((s) => s.fiveDayPct)).toEqual(EXPECTED_FIVE_DAY);
}

describe('computeRenderOrder — 1D fallback chain', () => {
  it('uses fresh.percentChange when timestamp is a real number', () => {
    const fresh = {
      XLK: { percentChange: 1.5, timestamp: 1714512345 },
      XLF: { percentChange: 2.5, timestamp: 1714512345 },
      XLV: { percentChange: 3.5, timestamp: 1714512345 },
      XLE: { percentChange: 4.5, timestamp: 1714512345 },
    };

    const result = computeRenderOrder(SECTORS, SNAPSHOT, fresh);

    expect(byTicker(result, 'XLK').oneDayPct).toBe(1.5);
    expect(byTicker(result, 'XLF').oneDayPct).toBe(2.5);
    expect(byTicker(result, 'XLV').oneDayPct).toBe(3.5);
    expect(byTicker(result, 'XLE').oneDayPct).toBe(4.5);
    assertFiveDayRankingUnchanged(result);
  });

  it('falls back to snapshot.changePercent when fresh entry has no timestamp (FALLBACK_STOCK_PRICES path)', () => {
    // Mirrors getMultipleStockPrices' outage fallback: percentChange: 0
    // with no timestamp field. Without the timestamp guard the rail
    // would paint +0.00% across all sectors during an EODHD outage.
    const fresh = {
      XLK: { percentChange: 0 },
      XLF: { percentChange: 0 },
      XLV: { percentChange: 0 },
      XLE: { percentChange: 0 },
    };

    const result = computeRenderOrder(SECTORS, SNAPSHOT, fresh);

    expect(byTicker(result, 'XLK').oneDayPct).toBe(1.0);
    expect(byTicker(result, 'XLF').oneDayPct).toBe(2.0);
    expect(byTicker(result, 'XLV').oneDayPct).toBe(3.0);
    expect(byTicker(result, 'XLE').oneDayPct).toBe(4.0);
    assertFiveDayRankingUnchanged(result);
  });

  it('also treats explicit timestamp: null as a fallback signal', () => {
    // eodhdAPI normalizes `timestamp: priceData.timestamp || null`, so a
    // real but timestampless EODHD response yields null. The guard
    // `timestamp != null` rejects both null and undefined.
    const fresh = {
      XLK: { percentChange: 9.9, timestamp: null },
      XLF: { percentChange: 9.9, timestamp: null },
      XLV: { percentChange: 9.9, timestamp: null },
      XLE: { percentChange: 9.9, timestamp: null },
    };

    const result = computeRenderOrder(SECTORS, SNAPSHOT, fresh);

    expect(byTicker(result, 'XLK').oneDayPct).toBe(1.0);
    expect(byTicker(result, 'XLF').oneDayPct).toBe(2.0);
    expect(byTicker(result, 'XLV').oneDayPct).toBe(3.0);
    expect(byTicker(result, 'XLE').oneDayPct).toBe(4.0);
    assertFiveDayRankingUnchanged(result);
  });

  it('falls back to snapshot.changePercent when freshPrices is null entirely (pre-fetch / failure)', () => {
    const result = computeRenderOrder(SECTORS, SNAPSHOT, null);

    expect(byTicker(result, 'XLK').oneDayPct).toBe(1.0);
    expect(byTicker(result, 'XLF').oneDayPct).toBe(2.0);
    expect(byTicker(result, 'XLV').oneDayPct).toBe(3.0);
    expect(byTicker(result, 'XLE').oneDayPct).toBe(4.0);
    assertFiveDayRankingUnchanged(result);
  });

  it('returns null oneDayPct when both fresh and snapshot lack 1D for that ticker, while preserving 5D ranking', () => {
    // XLK appears in snapshot but only carries weekChange (5D). No
    // changePercent. freshPrices has no XLK entry. Expect oneDayPct=null
    // for XLK; the other three sectors still resolve through snapshot.
    const partialSnapshot = [
      { etf: 'XLK', weekChange: 4.0 }, // no changePercent
      { etf: 'XLF', changePercent: 2.0, weekChange: 2.0 },
      { etf: 'XLV', changePercent: 3.0, weekChange: 3.0 },
      { etf: 'XLE', changePercent: 4.0, weekChange: 5.0 },
    ];
    const fresh = {
      XLF: { percentChange: 2.5, timestamp: 1714512345 },
      // XLK, XLV, XLE absent
    };

    const result = computeRenderOrder(SECTORS, partialSnapshot, fresh);

    expect(byTicker(result, 'XLK').oneDayPct).toBeNull();
    expect(byTicker(result, 'XLF').oneDayPct).toBe(2.5); // fresh wins
    expect(byTicker(result, 'XLV').oneDayPct).toBe(3.0); // snapshot
    expect(byTicker(result, 'XLE').oneDayPct).toBe(4.0); // snapshot
    assertFiveDayRankingUnchanged(result);
  });
});
