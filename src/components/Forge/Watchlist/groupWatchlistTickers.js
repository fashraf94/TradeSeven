// src/components/Forge/Watchlist/groupWatchlistTickers.js
//
// Sprint 6 Phase 4B — pure grouping logic for the watchlist editor's ticker
// display. Kept React-free so it can be unit-tested directly.
//
// Takes the watchlist's flat tickers[] array and groups it for display:
//   - In-universe tickers bucket by GICS sector, then by industry. Sector
//     ETFs (industry === null in the ranking config) collect into a separate
//     per-sector group rendered above the industry groups.
//   - Industry ETFs fold into the industry group matching their theme name,
//     or form their own group when no underlying stock shares that industry.
//   - Off-universe tickers (symbols absent from the ranking universe) are
//     returned separately for the editor's "not in our universe" section.
//
// Ordering (Phase 4B audit L9 / A1 / D-A-1):
//   - Sectors: most members first, sector name alphabetical as tiebreak.
//   - Industry groups within a sector: industry name alphabetical.
//   - Tickers within any group: symbol alphabetical.

import {
  TICKER_TO_TYPE,
  TICKER_TO_SECTOR,
  TICKER_TO_INDUSTRY,
  STOCK_UNIVERSE,
} from '../../../../api/_utils/rankingConfig.js';

const bySymbol = (a, b) => a.symbol.localeCompare(b.symbol);

/**
 * Group a watchlist's tickers for display in the editor.
 * @param {Array<{symbol: string}>} tickers - watchlist ticker entries
 * @returns {{ sectors: Array, offUniverse: Array }}
 */
export function groupWatchlistTickers(tickers) {
  const list = Array.isArray(tickers) ? tickers : [];
  const offUniverse = [];
  const sectorBuckets = new Map(); // sectorId -> { etf: [], industries: Map }

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const symbol =
      typeof entry.symbol === 'string' ? entry.symbol.trim().toUpperCase() : '';
    if (!symbol) continue;

    const type = TICKER_TO_TYPE[symbol];
    if (!type) {
      offUniverse.push({ ...entry, symbol, type: null });
      continue;
    }

    // type and sectorId are populated in lockstep by the ranking config —
    // a symbol with a type always has a sector.
    const sectorId = TICKER_TO_SECTOR[symbol];
    if (!sectorBuckets.has(sectorId)) {
      sectorBuckets.set(sectorId, { etf: [], industries: new Map() });
    }
    const bucket = sectorBuckets.get(sectorId);
    const item = { ...entry, symbol, type };

    if (type === 'sector_etf') {
      bucket.etf.push(item);
    } else {
      const industry = TICKER_TO_INDUSTRY[symbol] || 'Other';
      if (!bucket.industries.has(industry)) bucket.industries.set(industry, []);
      bucket.industries.get(industry).push(item);
    }
  }

  const sectors = [];
  for (const [sectorId, bucket] of sectorBuckets) {
    const etfGroup = [...bucket.etf].sort(bySymbol);
    const industryGroups = [...bucket.industries.entries()]
      .map(([industry, items]) => ({
        industry,
        tickers: [...items].sort(bySymbol),
      }))
      .sort((a, b) => a.industry.localeCompare(b.industry));
    const count =
      etfGroup.length +
      industryGroups.reduce((n, g) => n + g.tickers.length, 0);
    sectors.push({
      sectorId,
      name: STOCK_UNIVERSE[sectorId]?.name || sectorId,
      count,
      etfGroup,
      industryGroups,
    });
  }

  sectors.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  offUniverse.sort(bySymbol);

  return { sectors, offUniverse };
}

export default groupWatchlistTickers;
