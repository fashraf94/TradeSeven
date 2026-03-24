import { SECTORS } from '../constants/sectors';

// Reverse lookup cache: symbol → { name, color, id }
const symbolToSectorCache = new Map();
let cacheBuilt = false;

function buildSymbolToSectorCache() {
  if (cacheBuilt) return;
  Object.entries(SECTORS).forEach(([sectorId, sector]) => {
    sector.topHoldings.forEach(sym => {
      symbolToSectorCache.set(sym, { name: sector.name, color: sector.color, id: sectorId });
    });
  });
  cacheBuilt = true;
}

// Reverse lookup: find sector by name match
function findSectorByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [, sector] of Object.entries(SECTORS)) {
    if (sector.name.toLowerCase() === lower) {
      return { name: sector.name, color: sector.color };
    }
  }
  // Partial match fallback (e.g., "Communication" matches "Communication Services")
  for (const [, sector] of Object.entries(SECTORS)) {
    const sLower = sector.name.toLowerCase();
    if (sLower.startsWith(lower) || lower.startsWith(sLower)) {
      return { name: sector.name, color: sector.color };
    }
  }
  return null;
}

/**
 * Resolve sector info for a stock object from rankings.
 * Tries multiple strategies:
 *   1. Direct SECTORS[sectorId] lookup
 *   2. Reverse lookup by sectorName
 *   3. Reverse lookup by symbol in topHoldings
 *   4. Use raw sectorName with gray color
 *   5. "Unknown" fallback
 */
export function resolveSectorInfo(stock) {
  // 1. Direct lookup by sectorId (ETF ticker like "XLK")
  if (stock.sectorId && SECTORS[stock.sectorId]) {
    const s = SECTORS[stock.sectorId];
    return { name: s.name, color: s.color };
  }

  // 2. Reverse lookup by sectorName
  if (stock.sectorName) {
    const match = findSectorByName(stock.sectorName);
    if (match) return match;
  }

  // 3. Reverse lookup by symbol in topHoldings
  if (stock.symbol) {
    buildSymbolToSectorCache();
    const cached = symbolToSectorCache.get(stock.symbol);
    if (cached) return { name: cached.name, color: cached.color };
  }

  // 4. Use raw sectorName with gray color
  if (stock.sectorName) {
    return { name: stock.sectorName, color: '#6b7280' };
  }

  return { name: 'Unknown', color: '#6b7280' };
}
