// api/_utils/cpuOpponentGenerator.js
// Server-side CPU opponent portfolio generation for agent battles.
// Ported from src/App.jsx generateCPUPortfolioBaggerBombV3 — same selection
// logic, adapted for server-side data format (sectorName field).

const SECTORS = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer Discretionary', 'Industrials'];

function formatV3Asset(asset, isCrypto = false) {
  return {
    symbol: asset.symbol,
    name: asset.name || asset.symbol,
    price: asset.price || 0,
    baseATR: asset.baseATR || (isCrypto ? 5.0 : 2.5),
    isCrypto,
  };
}

/**
 * generateCPUOpponent(stockUniverse, cryptoAssets, excludeSymbols)
 *
 * @param {Array} stockUniverse  — ranked stock list from indexIntelligence (uses .sectorName)
 * @param {Array} cryptoAssets   — CRYPTO_ASSETS array (each has .isCrypto, .baseATR)
 * @param {Set}   excludeSymbols — symbols already used by the agent portfolio (avoid overlap)
 * @returns {{ portfolio: { star, core, support }, bench: { stocks, crypto } }}
 */
export function generateCPUOpponent(stockUniverse, cryptoAssets, excludeSymbols = new Set()) {
  const usedSymbols = new Set(excludeSymbols);
  const cpuStocks = [];

  // Pick one stock from each target sector
  SECTORS.forEach(sector => {
    const sectorStocks = stockUniverse.filter(s =>
      (s.sectorName === sector || s.sector === sector || s.category === sector) &&
      !usedSymbols.has(s.symbol)
    );
    if (sectorStocks.length > 0) {
      const pick = sectorStocks[Math.floor(Math.random() * sectorStocks.length)];
      cpuStocks.push(pick);
      usedSymbols.add(pick.symbol);
    }
  });

  // Fill to 6 stocks if sectors didn't provide enough
  while (cpuStocks.length < 6 && stockUniverse.length > usedSymbols.size) {
    const pick = stockUniverse[Math.floor(Math.random() * stockUniverse.length)];
    if (!usedSymbols.has(pick.symbol)) {
      cpuStocks.push(pick);
      usedSymbols.add(pick.symbol);
    }
  }

  // Select crypto for support slot (exclude stablecoins)
  const eligibleCrypto = cryptoAssets
    .filter(c => (!c.category || c.category !== 'Stablecoin') && !usedSymbols.has(c.symbol))
    .slice(0, 8);
  const mainCrypto = eligibleCrypto.length > 0
    ? eligibleCrypto[Math.floor(Math.random() * eligibleCrypto.length)]
    : null;
  if (mainCrypto) usedSymbols.add(mainCrypto.symbol);

  // Build V3 tiered portfolio
  const portfolio = {
    star: [
      cpuStocks[0] ? formatV3Asset(cpuStocks[0]) : null,
      cpuStocks[1] ? formatV3Asset(cpuStocks[1]) : null,
    ],
    core: [
      cpuStocks[2] ? formatV3Asset(cpuStocks[2]) : null,
      cpuStocks[3] ? formatV3Asset(cpuStocks[3]) : null,
    ],
    support: [
      cpuStocks[4] ? formatV3Asset(cpuStocks[4]) : null,
      cpuStocks[5] ? formatV3Asset(cpuStocks[5]) : null,
      mainCrypto ? formatV3Asset(mainCrypto, true) : null,
    ],
  };

  // Generate bench (3 stocks + 1 crypto)
  const benchStocks = [];
  for (let i = 0; i < 3; i++) {
    const remaining = stockUniverse.filter(s => !usedSymbols.has(s.symbol));
    if (remaining.length > 0) {
      const pick = remaining[Math.floor(Math.random() * remaining.length)];
      benchStocks.push(formatV3Asset(pick));
      usedSymbols.add(pick.symbol);
    }
  }

  const benchCrypto = eligibleCrypto.find(c => !usedSymbols.has(c.symbol));

  const bench = {
    stocks: benchStocks,
    crypto: benchCrypto ? formatV3Asset(benchCrypto, true) : null,
  };

  return { portfolio, bench };
}
