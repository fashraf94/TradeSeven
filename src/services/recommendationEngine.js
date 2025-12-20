// /src/services/recommendationEngine.js
// Thesis-based asset scoring and recommendation engine - v2.0

// ============================================
// STOCK SECTOR MAPPINGS
// ============================================
const STOCK_SECTORS = {
  Technology: ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'META', 'NVDA', 'AMD', 'INTC', 'CRM', 'ADBE', 'ORCL', 'IBM', 'NOW', 'SNOW', 'PLTR', 'UBER', 'LYFT', 'SHOP', 'SQ', 'TWLO', 'NET', 'DDOG', 'ZS', 'CRWD', 'MDB', 'TEAM', 'DOCU', 'OKTA', 'ZM', 'WDAY'],
  Financials: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK', 'SCHW', 'AXP', 'V', 'MA', 'PYPL', 'COIN', 'USB', 'PNC', 'TFC', 'COF', 'DFS', 'AIG', 'MET', 'PRU', 'ALL', 'TRV', 'CB', 'MMC', 'AON', 'ICE', 'CME', 'SPGI', 'MCO'],
  Healthcare: ['JNJ', 'UNH', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'ABT', 'BMY', 'AMGN', 'GILD', 'CVS', 'CI', 'HUM', 'ISRG', 'MDT', 'DHR', 'SYK', 'BDX', 'ZBH', 'EW', 'BSX', 'REGN', 'VRTX', 'BIIB', 'MRNA', 'ILMN', 'DXCM', 'ALGN', 'IDXX'],
  Consumer: ['AMZN', 'TSLA', 'HD', 'NKE', 'MCD', 'SBUX', 'TGT', 'COST', 'WMT', 'LOW', 'TJX', 'ROST', 'DG', 'DLTR', 'LULU', 'GPS', 'ANF', 'BBWI', 'ULTA', 'EL', 'PG', 'KO', 'PEP', 'CL', 'KMB', 'GIS', 'K', 'CPB', 'SJM', 'HRL'],
  Energy: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'VLO', 'PSX', 'OXY', 'HAL', 'BKR', 'DVN', 'FANG', 'HES', 'PXD', 'WMB', 'KMI', 'OKE', 'ET', 'EPD', 'LNG', 'TRGP', 'MRO', 'APA', 'EQT'],
  Industrials: ['CAT', 'DE', 'BA', 'HON', 'UPS', 'FDX', 'LMT', 'RTX', 'GE', 'MMM', 'EMR', 'ITW', 'PH', 'ROK', 'CMI', 'PCAR', 'NSC', 'UNP', 'CSX', 'ODFL', 'JBHT', 'XPO', 'DAL', 'UAL', 'LUV', 'AAL', 'WM', 'RSG', 'GD', 'NOC'],
  Communications: ['NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'TMUS', 'CHTR', 'WBD', 'PARA', 'FOX', 'SNAP', 'PINS', 'MTCH', 'RBLX', 'EA', 'TTWO', 'ATVI', 'SPOT', 'LYV', 'ROKU', 'FUBO', 'WMG', 'SIRI', 'IMAX', 'AMC'],
  Utilities: ['NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'SRE', 'XEL', 'WEC', 'ES', 'ED', 'PEG', 'AWK', 'ATO', 'NI', 'CMS', 'DTE', 'FE', 'PPL', 'EVRG'],
  'Real Estate': ['AMT', 'PLD', 'CCI', 'EQIX', 'SPG', 'PSA', 'O', 'WELL', 'DLR', 'AVB', 'EQR', 'VTR', 'ARE', 'MAA', 'UDR', 'ESS', 'INVH', 'SUI', 'CPT', 'PEAK'],
  Materials: ['LIN', 'APD', 'SHW', 'ECL', 'DD', 'DOW', 'LYB', 'PPG', 'NEM', 'FCX', 'NUE', 'STLD', 'CLF', 'VMC', 'MLM', 'MOS', 'CF', 'ALB', 'FMC', 'CE'],
};

// Volatility classification
const HIGH_VOLATILITY = ['TSLA', 'NVDA', 'AMD', 'COIN', 'GME', 'AMC', 'RIVN', 'LCID', 'PLTR', 'SNAP', 'HOOD', 'MARA', 'RIOT', 'MSTR', 'BTC', 'ETH', 'SOL', 'DOGE', 'SHIB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'AAVE', 'CRV', 'APE', 'PEPE', 'WIF', 'BONK', 'NEAR', 'INJ', 'TIA', 'SUI', 'SEI'];
const LOW_VOLATILITY = ['JNJ', 'PG', 'KO', 'PEP', 'WMT', 'MCD', 'VZ', 'T', 'SO', 'DUK', 'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO', 'BRK.B', 'UNH', 'HD', 'COST', 'USDT', 'USDC', 'DAI', 'BUSD'];

/**
 * Get sector for a stock symbol
 */
function getStockSector(symbol) {
  for (const [sector, stocks] of Object.entries(STOCK_SECTORS)) {
    if (stocks.includes(symbol)) {
      return sector;
    }
  }
  return null;
}

/**
 * Get volatility classification for an asset
 */
function getAssetVolatility(asset) {
  const symbol = asset.symbol?.toUpperCase();

  if (HIGH_VOLATILITY.includes(symbol)) return 'high';
  if (LOW_VOLATILITY.includes(symbol)) return 'low';

  // For crypto, default to high volatility
  if (asset.category !== undefined) return 'high';

  // Default based on recent price change
  const change = Math.abs(parseFloat(asset.percentChange || asset.change24h) || 0);
  if (change > 5) return 'high';
  if (change < 1.5) return 'low';
  return 'medium';
}

/**
 * Calculate thesis alignment score for a single asset - v2.0
 * Improved weighting: User's explicit choices = 60%, Market data = 30%, Bonus = 10%
 */
export function calculateThesisAlignment(asset, thesis) {
  let score = 0;
  let maxPossible = 0;
  const matchReasons = [];
  const isCrypto = asset.category !== undefined;

  // Determine asset's sector (for stocks)
  const assetSector = isCrypto
    ? (asset.category || 'Crypto')
    : (getStockSector(asset.symbol) || asset.sector || 'Unknown');

  // ============================================
  // TIER 1: USER'S EXPLICIT CHOICES (60 points)
  // ============================================

  // 1. Sector Match (25 points max) - CRITICAL
  maxPossible += 25;
  if (thesis.sectors && thesis.sectors.length > 0) {
    const matchedSector = thesis.sectors.find(s =>
      s.toLowerCase() === assetSector.toLowerCase() ||
      assetSector.toLowerCase().includes(s.toLowerCase()) ||
      s.toLowerCase().includes(assetSector.toLowerCase())
    );

    if (matchedSector) {
      score += 25;
      matchReasons.push(`Matches your ${assetSector} sector focus`);
    }
  } else {
    // No sectors selected = give partial credit
    score += 12;
  }

  // 2. Market Direction / Stance Match (20 points max)
  maxPossible += 20;
  const change = parseFloat(asset.percentChange || asset.change24h) || 0;

  if (thesis.stance === 'bullish') {
    if (change > 3) {
      score += 20;
      matchReasons.push(`Strong positive momentum (+${change.toFixed(1)}%) aligns with bullish outlook`);
    } else if (change > 0) {
      score += 15;
      matchReasons.push(`Positive movement (+${change.toFixed(1)}%) fits bullish thesis`);
    } else if (change > -2) {
      score += 8;
    }
  } else if (thesis.stance === 'bearish') {
    // Bearish = look for stability (can't short in MarketClash)
    if (Math.abs(change) < 1.5) {
      score += 20;
      matchReasons.push('Stable price action for defensive positioning');
    } else if (Math.abs(change) < 3) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    // Neutral
    if (Math.abs(change) >= 1 && Math.abs(change) <= 5) {
      score += 15;
    } else {
      score += 10;
    }
  }

  // 3. Risk Tolerance Match (15 points max)
  maxPossible += 15;
  const volatility = getAssetVolatility(asset);

  if (thesis.risk === 'aggressive') {
    if (volatility === 'high') {
      score += 15;
      matchReasons.push('High volatility suits aggressive strategy');
    } else if (volatility === 'medium') {
      score += 10;
    } else {
      score += 4;
    }
  } else if (thesis.risk === 'conservative') {
    if (volatility === 'low') {
      score += 15;
      matchReasons.push('Low volatility fits conservative approach');
    } else if (volatility === 'medium') {
      score += 10;
    } else {
      score += 3;
    }
  } else {
    // Balanced/moderate
    if (volatility === 'medium') {
      score += 15;
      matchReasons.push('Moderate volatility matches balanced approach');
    } else {
      score += 10;
    }
  }

  // ============================================
  // TIER 2: MARKET DATA FACTORS (30 points)
  // ============================================

  // 4. Performance Strength (10 points)
  maxPossible += 10;
  const absChange = Math.abs(change);
  if (thesis.stance === 'bullish' && change > 0) {
    if (change >= 5) {
      score += 10;
      matchReasons.push(`Strong gains (+${change.toFixed(1)}%)`);
    } else if (change >= 2) {
      score += 7;
    } else {
      score += 4;
    }
  } else if (thesis.stance !== 'bullish') {
    // For bearish/neutral, reward stability
    if (absChange < 2) {
      score += 10;
    } else if (absChange < 5) {
      score += 6;
    } else {
      score += 3;
    }
  } else {
    score += 3;
  }

  // 5. Market Cap / Stability (10 points)
  maxPossible += 10;
  const marketCap = asset.marketCap || asset.market_cap || 0;
  if (marketCap > 100000000000) { // >$100B
    score += 10;
    if (thesis.risk === 'conservative') {
      matchReasons.push('Large-cap stability');
    }
  } else if (marketCap > 10000000000) { // >$10B
    score += 8;
  } else if (marketCap > 1000000000) { // >$1B
    score += 6;
  } else if (marketCap > 0) {
    score += 4;
  } else {
    score += 5; // Unknown market cap
  }

  // 6. Volume / Liquidity (5 points)
  maxPossible += 5;
  const volume = asset.volume || 0;
  const avgVolume = asset.avgVolume || asset.average_volume || 0;

  if (avgVolume > 0 && volume > 0) {
    const volumeRatio = volume / avgVolume;
    if (volumeRatio > 1.5) {
      score += 5;
      matchReasons.push('Above-average trading volume');
    } else if (volumeRatio > 1) {
      score += 4;
    } else {
      score += 2;
    }
  } else {
    score += 3;
  }

  // 7. 7-Day Trend (5 points)
  maxPossible += 5;
  const change7d = parseFloat(asset.priceChange7d || asset.change7d) || 0;
  if (thesis.stance === 'bullish' && change7d > 5) {
    score += 5;
  } else if (thesis.stance === 'bullish' && change7d > 0) {
    score += 3;
  } else if (thesis.stance !== 'bullish' && Math.abs(change7d) < 5) {
    score += 4;
  } else {
    score += 2;
  }

  // ============================================
  // TIER 3: BONUS FACTORS (10 points)
  // ============================================

  // 8. Timeframe Fit (5 points)
  maxPossible += 5;
  if (thesis.battleType === 'head-to-head') {
    // 24hr - high movement is good
    if (volatility === 'high') {
      score += 5;
      matchReasons.push('Active price movement for short-term trading');
    } else if (volatility === 'medium') {
      score += 3;
    } else {
      score += 1;
    }
  } else if (thesis.battleType === 'snake-draft') {
    // Week-long
    if (volatility === 'medium' || volatility === 'low') {
      score += 5;
    } else {
      score += 3;
    }
  } else {
    score += 3;
  }

  // 9. Asset Type Preference (5 points)
  maxPossible += 5;
  if (isCrypto && thesis.risk === 'aggressive') {
    score += 5;
  } else if (!isCrypto && thesis.risk === 'conservative') {
    score += 5;
  } else {
    score += 3;
  }

  // ============================================
  // CALCULATE FINAL SCORE
  // ============================================

  const percentageScore = Math.round((score / maxPossible) * 100);

  // Determine alignment
  let alignment;
  if (percentageScore >= 75) {
    alignment = 'strong';
  } else if (percentageScore >= 55) {
    alignment = 'good';
  } else if (percentageScore >= 40) {
    alignment = 'moderate';
  } else {
    alignment = 'weak';
  }

  return {
    score: percentageScore,
    rawScore: score,
    maxScore: maxPossible,
    alignment,
    matchReasons: matchReasons.slice(0, 3),
    sector: assetSector,
    volatility,
    isCrypto,
  };
}

/**
 * Get top recommendations based on thesis - v2.0
 * Now limits crypto and enforces minimum score threshold
 */
export function getRecommendations(allAssets, thesis, count = 8) {
  // Score all assets
  const scored = allAssets.map(asset => ({
    ...asset,
    thesisScore: calculateThesisAlignment(asset, thesis)
  }));

  // Separate stocks and crypto
  const stocks = scored.filter(a => !a.thesisScore.isCrypto);
  const crypto = scored.filter(a => a.thesisScore.isCrypto);

  // Sort each by score (descending)
  stocks.sort((a, b) => b.thesisScore.score - a.thesisScore.score);
  crypto.sort((a, b) => b.thesisScore.score - a.thesisScore.score);

  // ============================================
  // APPLY FILTERS
  // ============================================

  // Filter 1: Minimum score threshold (55+ for good match)
  const MIN_SCORE = 55;
  const qualifiedStocks = stocks.filter(s => s.thesisScore.score >= MIN_SCORE);
  const qualifiedCrypto = crypto.filter(c => c.thesisScore.score >= MIN_SCORE);

  // Filter 2: Prioritize sector matches if user selected sectors
  let sectorPrioritizedStocks = qualifiedStocks;
  if (thesis.sectors && thesis.sectors.length > 0) {
    const sectorMatches = qualifiedStocks.filter(s =>
      thesis.sectors.some(sector =>
        s.thesisScore.sector?.toLowerCase().includes(sector.toLowerCase()) ||
        sector.toLowerCase().includes(s.thesisScore.sector?.toLowerCase() || '')
      )
    );
    const otherStocks = qualifiedStocks.filter(s => !sectorMatches.includes(s));
    sectorPrioritizedStocks = [...sectorMatches, ...otherStocks];
  }

  // ============================================
  // BUILD FINAL RECOMMENDATIONS
  // ============================================

  // Take top 6 stocks (sector-prioritized)
  const recommendedStocks = sectorPrioritizedStocks.slice(0, 6);

  // Take max 2 crypto
  const MAX_CRYPTO = 2;
  const recommendedCrypto = qualifiedCrypto.slice(0, MAX_CRYPTO);

  // Combine and sort by score
  const recommendations = [...recommendedStocks, ...recommendedCrypto]
    .sort((a, b) => b.thesisScore.score - a.thesisScore.score)
    .slice(0, count);

  // ============================================
  // FALLBACK: If not enough qualified assets
  // ============================================

  if (recommendations.length < 4) {
    // Lower threshold and try again
    const FALLBACK_MIN_SCORE = 40;
    const fallbackStocks = stocks
      .filter(s => s.thesisScore.score >= FALLBACK_MIN_SCORE)
      .slice(0, 6);
    const fallbackCrypto = crypto
      .filter(c => c.thesisScore.score >= FALLBACK_MIN_SCORE)
      .slice(0, 2);

    return [...fallbackStocks, ...fallbackCrypto]
      .sort((a, b) => b.thesisScore.score - a.thesisScore.score)
      .slice(0, count);
  }

  return recommendations;
}

/**
 * Generate specific explanation based on score data - v2.0
 * Now includes specific numbers and reasoning
 */
export function generateGenericExplanation(asset, thesis) {
  const score = asset.thesisScore;

  if (!score || !score.matchReasons || score.matchReasons.length === 0) {
    // Fallback explanation with specific data
    const change = parseFloat(asset.percentChange || asset.change24h) || 0;
    const direction = change >= 0 ? 'up' : 'down';
    return `Currently ${direction} ${Math.abs(change).toFixed(1)}%. Moderate fit for your ${thesis.stance || 'market'} strategy.`;
  }

  // Use the top match reason
  let explanation = score.matchReasons[0];

  // Add secondary reason for strong matches
  if (score.score >= 70 && score.matchReasons.length > 1) {
    explanation += `. ${score.matchReasons[1]}`;
  }

  return explanation;
}

/**
 * Filter assets by sector/category
 */
export function filterBySector(assets, sectors) {
  if (!sectors || sectors.length === 0) return assets;

  return assets.filter(asset => {
    const isCrypto = asset.category !== undefined;
    const assetSector = isCrypto
      ? (asset.category || 'Crypto')
      : (getStockSector(asset.symbol) || asset.sector || '');

    return sectors.some(s =>
      assetSector.toLowerCase().includes(s.toLowerCase()) ||
      s.toLowerCase().includes(assetSector.toLowerCase())
    );
  });
}

/**
 * Get all unique sectors from assets
 */
export function getAvailableSectors(assets) {
  const sectors = new Set();
  assets.forEach(asset => {
    if (asset.category !== undefined) {
      // It's crypto
      sectors.add(asset.category || 'Crypto');
    } else {
      // It's a stock
      const sector = getStockSector(asset.symbol) || asset.sector;
      if (sector) sectors.add(sector);
    }
  });
  return Array.from(sectors);
}

export default {
  calculateThesisAlignment,
  getRecommendations,
  generateGenericExplanation,
  filterBySector,
  getAvailableSectors,
  getStockSector,
  getAssetVolatility,
  STOCK_SECTORS,
};
