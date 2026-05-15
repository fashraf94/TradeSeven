// src/components/Forge/Watchlist/tickerSearchMatch.js
//
// Sprint 6 Phase 4B — pure search logic for the manual ticker-add control.
// Searches the ranking universe (stocks + sector ETFs + industry ETFs) by
// ticker symbol and GICS industry name only — no company-name search
// (Phase 4B audit A2; company names are not in the ranking data anyway).

import {
  TICKER_TO_TYPE,
  TICKER_TO_INDUSTRY,
  TICKER_TO_SECTOR,
  STOCK_UNIVERSE,
} from '../../../../api/_utils/rankingConfig.js';

const UNIVERSE = Object.keys(TICKER_TO_TYPE).map((symbol) => ({
  symbol,
  type: TICKER_TO_TYPE[symbol],
  industry: TICKER_TO_INDUSTRY[symbol] || '',
  sectorName: STOCK_UNIVERSE[TICKER_TO_SECTOR[symbol]]?.name || '',
}));

/**
 * Search the ranking universe by symbol prefix/substring and industry name.
 * @param {string} query
 * @param {{ excludeSymbols?: string[], atCap?: boolean }} opts
 * @returns {Array<{symbol,type,industry,sectorName,rank}>} ranked matches —
 *   exact symbol > symbol prefix > symbol substring > industry substring.
 */
export function searchUniverse(query, { excludeSymbols = [], atCap = false } = {}) {
  if (atCap) return [];
  const q = String(query || '').trim().toUpperCase();
  if (!q) return [];

  const exclude = new Set(excludeSymbols.map((s) => String(s).toUpperCase()));
  const matches = [];
  for (const entry of UNIVERSE) {
    if (exclude.has(entry.symbol)) continue;
    const sym = entry.symbol;
    const industry = entry.industry.toUpperCase();
    let rank = 0;
    if (sym === q) rank = 4;
    else if (sym.startsWith(q)) rank = 3;
    else if (sym.includes(q)) rank = 2;
    else if (industry.includes(q)) rank = 1;
    if (rank > 0) matches.push({ ...entry, rank });
  }
  matches.sort((a, b) =>
    b.rank !== a.rank ? b.rank - a.rank : a.symbol.localeCompare(b.symbol),
  );
  return matches;
}

export default searchUniverse;
