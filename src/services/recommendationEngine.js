// /src/services/recommendationEngine.js
// Thesis-based asset scoring and recommendation engine - v2.0

// ============================================
// STOCK SECTOR MAPPINGS
// ============================================
const STOCK_SECTORS = {
  Technology: ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'META', 'NVDA', 'AMD', 'INTC', 'CRM', 'ADBE', 'ORCL', 'IBM', 'NOW', 'SNOW', 'PLTR', 'UBER', 'LYFT', 'SHOP', 'XYZ', 'TWLO', 'NET', 'DDOG', 'ZS', 'CRWD', 'MDB', 'TEAM', 'DOCU', 'OKTA', 'ZM', 'WDAY'],
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
const LOW_VOLATILITY = ['JNJ', 'PG', 'KO', 'PEP', 'WMT', 'MCD', 'VZ', 'T', 'SO', 'DUK', 'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO', 'BRK-B', 'UNH', 'HD', 'COST', 'USDT', 'USDC', 'DAI', 'BUSD'];

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
    // Bearish = look for stability (can't short in FantasyTrades)
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
 * Get top recommendations based on thesis - v3.0
 * GUARANTEES: Exactly 8 stocks + exactly 2 crypto (defaults to BTC/ETH)
 */
export function getRecommendations(allAssets, thesis, count = 10) {
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
  // GUARANTEE 8 STOCKS
  // ============================================

  const TARGET_STOCKS = 8;
  let selectedStocks = [];

  // Prioritize sector matches if user selected sectors
  if (thesis.sectors && thesis.sectors.length > 0) {
    // First: High-scoring sector matches
    const sectorMatches = stocks.filter(s =>
      s.thesisScore.score >= 50 &&
      thesis.sectors.some(sector =>
        s.thesisScore.sector?.toLowerCase().includes(sector.toLowerCase()) ||
        sector.toLowerCase().includes(s.thesisScore.sector?.toLowerCase() || '')
      )
    );
    selectedStocks.push(...sectorMatches.slice(0, TARGET_STOCKS));

    // If not enough, add other high-scoring stocks
    if (selectedStocks.length < TARGET_STOCKS) {
      const otherHighScoring = stocks.filter(s =>
        !selectedStocks.includes(s) && s.thesisScore.score >= 40
      );
      selectedStocks.push(...otherHighScoring.slice(0, TARGET_STOCKS - selectedStocks.length));
    }
  } else {
    // No sector preference - take top scoring stocks
    const highScoring = stocks.filter(s => s.thesisScore.score >= 40);
    selectedStocks.push(...highScoring.slice(0, TARGET_STOCKS));
  }

  // FALLBACK: If still not 8 stocks, just take top performers regardless of score
  if (selectedStocks.length < TARGET_STOCKS) {
    const remaining = stocks.filter(s => !selectedStocks.includes(s));
    selectedStocks.push(...remaining.slice(0, TARGET_STOCKS - selectedStocks.length));
  }

  // Ensure exactly 8 stocks
  selectedStocks = selectedStocks.slice(0, TARGET_STOCKS);

  // ============================================
  // GUARANTEE 2 CRYPTO (Default to BTC/ETH)
  // ============================================

  const TARGET_CRYPTO = 2;
  let selectedCrypto = [];

  // Try to find matching crypto with decent scores
  const qualifiedCrypto = crypto.filter(c => c.thesisScore.score >= 40);

  if (qualifiedCrypto.length >= TARGET_CRYPTO) {
    // Use top 2 matching crypto
    selectedCrypto = qualifiedCrypto.slice(0, TARGET_CRYPTO);
  } else if (qualifiedCrypto.length === 1) {
    // Use 1 matching + find BTC or ETH as backup
    selectedCrypto.push(qualifiedCrypto[0]);

    // Add BTC or ETH as second (whichever isn't already selected)
    const defaultCrypto = crypto.find(c =>
      (c.symbol === 'BTC' || c.symbol === 'ETH' || c.symbol === 'BTC-USD' || c.symbol === 'ETH-USD') &&
      !selectedCrypto.some(sc => sc.symbol === c.symbol)
    );
    if (defaultCrypto) {
      selectedCrypto.push(defaultCrypto);
    } else {
      // Just take next best crypto
      const nextBest = crypto.find(c => !selectedCrypto.includes(c));
      if (nextBest) selectedCrypto.push(nextBest);
    }
  } else {
    // NO matching crypto - default to BTC and ETH
    const btc = crypto.find(c => c.symbol === 'BTC' || c.symbol === 'BTC-USD');
    const eth = crypto.find(c => c.symbol === 'ETH' || c.symbol === 'ETH-USD');

    if (btc) selectedCrypto.push(btc);
    if (eth && selectedCrypto.length < TARGET_CRYPTO) selectedCrypto.push(eth);

    // If BTC/ETH not in list, take top 2 crypto anyway
    if (selectedCrypto.length < TARGET_CRYPTO) {
      const remaining = crypto.filter(c => !selectedCrypto.includes(c));
      selectedCrypto.push(...remaining.slice(0, TARGET_CRYPTO - selectedCrypto.length));
    }
  }

  // Ensure exactly 2 crypto
  selectedCrypto = selectedCrypto.slice(0, TARGET_CRYPTO);

  // ============================================
  // COMBINE AND RETURN
  // ============================================

  // Sort combined list by score
  const recommendations = [...selectedStocks, ...selectedCrypto]
    .sort((a, b) => b.thesisScore.score - a.thesisScore.score);

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

/**
 * Generate smart fallback recommendations when scoring fails
 * Analyzes user's must-haves and suggests complementary picks
 */
export function generateSmartFallback({
  mustHavePicks = [],
  selectedSectors = [],
  riskStyle = 'balanced'
}) {
  // Analyze user's picks
  const analysis = analyzeMustHaves(mustHavePicks);

  // Get stocks from selected sectors that complement the user's picks
  const suggestions = getSuggestions(analysis, selectedSectors, riskStyle);

  return {
    analysis,
    suggestions,
    reasoning: generateFallbackReasoning(analysis, suggestions)
  };
}

/**
 * SECTOR_PICKS - Pre-defined stock picks by sector for BaggerBomb Game Plan
 * These are used when technical API calls fail or for faster recommendations
 */
const SECTOR_PICKS = {
  XLK: { // Technology
    breakout: ['NVDA', 'AMD', 'AVGO', 'MRVL', 'SMCI', 'ARM'],
    safe: ['AAPL', 'MSFT', 'CSCO', 'INTC'],
    names: { NVDA: 'NVIDIA', AMD: 'AMD', AVGO: 'Broadcom', MRVL: 'Marvell', SMCI: 'Super Micro', ARM: 'ARM Holdings', AAPL: 'Apple', MSFT: 'Microsoft', CSCO: 'Cisco', INTC: 'Intel' }
  },
  XLV: { // Healthcare
    breakout: ['LLY', 'ISRG', 'VRTX', 'REGN', 'MRNA'],
    safe: ['JNJ', 'UNH', 'PFE', 'ABT'],
    names: { LLY: 'Eli Lilly', ISRG: 'Intuitive Surgical', VRTX: 'Vertex', REGN: 'Regeneron', MRNA: 'Moderna', JNJ: 'J&J', UNH: 'UnitedHealth', PFE: 'Pfizer', ABT: 'Abbott' }
  },
  XLF: { // Financials
    breakout: ['GS', 'MS', 'COIN', 'BLK', 'SCHW'],
    safe: ['JPM', 'V', 'MA', 'BAC'],
    names: { GS: 'Goldman Sachs', MS: 'Morgan Stanley', COIN: 'Coinbase', BLK: 'BlackRock', SCHW: 'Schwab', JPM: 'JPMorgan', V: 'Visa', MA: 'Mastercard', BAC: 'Bank of America' }
  },
  XLE: { // Energy
    breakout: ['XOM', 'CVX', 'OXY', 'DVN', 'FANG'],
    safe: ['COP', 'SLB', 'EOG'],
    names: { XOM: 'ExxonMobil', CVX: 'Chevron', OXY: 'Occidental', DVN: 'Devon', FANG: 'Diamondback', COP: 'ConocoPhillips', SLB: 'Schlumberger', EOG: 'EOG Resources' }
  },
  XLY: { // Consumer Discretionary
    breakout: ['TSLA', 'AMZN', 'RIVN', 'LCID', 'NKE'],
    safe: ['HD', 'MCD', 'SBUX', 'TGT'],
    names: { TSLA: 'Tesla', AMZN: 'Amazon', RIVN: 'Rivian', LCID: 'Lucid', NKE: 'Nike', HD: 'Home Depot', MCD: 'McDonald\'s', SBUX: 'Starbucks', TGT: 'Target' }
  },
  XLP: { // Consumer Staples
    breakout: ['COST', 'WMT', 'EL'],
    safe: ['PG', 'KO', 'PEP', 'CL'],
    names: { COST: 'Costco', WMT: 'Walmart', EL: 'Estee Lauder', PG: 'P&G', KO: 'Coca-Cola', PEP: 'PepsiCo', CL: 'Colgate' }
  },
  XLI: { // Industrials
    breakout: ['CAT', 'DE', 'BA', 'GE', 'UPS'],
    safe: ['HON', 'LMT', 'RTX', 'UNP'],
    names: { CAT: 'Caterpillar', DE: 'Deere', BA: 'Boeing', GE: 'GE', UPS: 'UPS', HON: 'Honeywell', LMT: 'Lockheed', RTX: 'Raytheon', UNP: 'Union Pacific' }
  },
  XLB: { // Materials
    breakout: ['FCX', 'NEM', 'ALB', 'NUE'],
    safe: ['LIN', 'SHW', 'APD', 'DD'],
    names: { FCX: 'Freeport', NEM: 'Newmont', ALB: 'Albemarle', NUE: 'Nucor', LIN: 'Linde', SHW: 'Sherwin-Williams', APD: 'Air Products', DD: 'DuPont' }
  },
  XLU: { // Utilities
    breakout: ['NEE', 'DUK'],
    safe: ['SO', 'D', 'AEP', 'SRE'],
    names: { NEE: 'NextEra', DUK: 'Duke Energy', SO: 'Southern Co', D: 'Dominion', AEP: 'American Electric', SRE: 'Sempra' }
  },
  XLRE: { // Real Estate
    breakout: ['AMT', 'CCI', 'EQIX', 'PLD'],
    safe: ['SPG', 'O', 'PSA', 'AVB'],
    names: { AMT: 'American Tower', CCI: 'Crown Castle', EQIX: 'Equinix', PLD: 'Prologis', SPG: 'Simon Property', O: 'Realty Income', PSA: 'Public Storage', AVB: 'AvalonBay' }
  },
  XLC: { // Communication Services
    breakout: ['META', 'NFLX', 'GOOGL', 'SNAP', 'RBLX'],
    safe: ['DIS', 'VZ', 'T', 'CMCSA'],
    names: { META: 'Meta', NFLX: 'Netflix', GOOGL: 'Google', SNAP: 'Snap', RBLX: 'Roblox', DIS: 'Disney', VZ: 'Verizon', T: 'AT&T', CMCSA: 'Comcast' }
  }
};

/**
 * CRYPTO_PICKS - Pre-defined crypto picks by risk style
 */
const CRYPTO_PICKS = {
  aggressive: [
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'AVAX', name: 'Avalanche' },
    { symbol: 'DOGE', name: 'Dogecoin' },
    { symbol: 'NEAR', name: 'NEAR Protocol' },
    { symbol: 'INJ', name: 'Injective' }
  ],
  balanced: [
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'ADA', name: 'Cardano' },
    { symbol: 'LINK', name: 'Chainlink' }
  ],
  conservative: [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' }
  ]
};

/**
 * Generate Game Plan Recommendations - SIMPLIFIED VERSION
 * Uses pre-defined sector picks instead of heavy API calls
 */
export function generateGamePlanRecommendations({
  riskStyle = 'balanced',
  selectedSectors = [],
  mustHavePicks = [],
  sectorData = {}
}) {
  console.log('[Recommendations] Generating for:', { riskStyle, selectedSectors, mustHavePicks: mustHavePicks.length });

  const excludeSymbols = new Set(mustHavePicks.map(p => p.symbol));
  const breakoutCandidates = [];
  const safePlays = [];

  // Get picks from each selected sector
  selectedSectors.forEach(sectorId => {
    const sectorPicks = SECTOR_PICKS[sectorId];
    if (!sectorPicks) return;

    // Add breakout candidates (not already picked)
    sectorPicks.breakout
      .filter(symbol => !excludeSymbols.has(symbol))
      .slice(0, riskStyle === 'aggressive' ? 3 : 2)
      .forEach(symbol => {
        breakoutCandidates.push({
          symbol,
          name: sectorPicks.names[symbol] || symbol,
          sectorId,
          breakoutScore: 65 + Math.floor(Math.random() * 25), // 65-90
          bustRisk: 20 + Math.floor(Math.random() * 25), // 20-45
          threshold: (2 + Math.random() * 2).toFixed(1), // 2-4%
          breakoutInterpretation: { label: 'Good', color: '#22c55e', emoji: '✅' },
          bustInterpretation: { label: 'Moderate', color: '#f59e0b', emoji: '➖' }
        });
      });

    // Add safe plays (not already picked)
    sectorPicks.safe
      .filter(symbol => !excludeSymbols.has(symbol))
      .slice(0, riskStyle === 'conservative' ? 2 : 1)
      .forEach(symbol => {
        safePlays.push({
          symbol,
          name: sectorPicks.names[symbol] || symbol,
          sectorId,
          breakoutScore: 45 + Math.floor(Math.random() * 15), // 45-60
          bustRisk: 10 + Math.floor(Math.random() * 15), // 10-25
          threshold: (1.5 + Math.random() * 1).toFixed(1), // 1.5-2.5%
          breakoutInterpretation: { label: 'Moderate', color: '#f59e0b', emoji: '➖' },
          bustInterpretation: { label: 'Low', color: '#10b981', emoji: '✅' }
        });
      });
  });

  // If no sectors selected, use Technology + Consumer defaults
  if (selectedSectors.length === 0) {
    const defaultSectors = ['XLK', 'XLY'];
    defaultSectors.forEach(sectorId => {
      const sectorPicks = SECTOR_PICKS[sectorId];
      sectorPicks.breakout.slice(0, 2).forEach(symbol => {
        if (!excludeSymbols.has(symbol)) {
          breakoutCandidates.push({
            symbol,
            name: sectorPicks.names[symbol] || symbol,
            sectorId,
            breakoutScore: 70 + Math.floor(Math.random() * 20),
            bustRisk: 25 + Math.floor(Math.random() * 20),
            threshold: (2.5 + Math.random() * 1.5).toFixed(1),
            breakoutInterpretation: { label: 'Good', color: '#22c55e', emoji: '✅' },
            bustInterpretation: { label: 'Moderate', color: '#f59e0b', emoji: '➖' }
          });
        }
      });
      sectorPicks.safe.slice(0, 1).forEach(symbol => {
        if (!excludeSymbols.has(symbol)) {
          safePlays.push({
            symbol,
            name: sectorPicks.names[symbol] || symbol,
            sectorId,
            breakoutScore: 50 + Math.floor(Math.random() * 10),
            bustRisk: 15 + Math.floor(Math.random() * 10),
            threshold: '2.0',
            breakoutInterpretation: { label: 'Moderate', color: '#f59e0b', emoji: '➖' },
            bustInterpretation: { label: 'Low', color: '#10b981', emoji: '✅' }
          });
        }
      });
    });
  }

  // Shuffle and limit
  const shuffledBreakouts = breakoutCandidates.sort(() => Math.random() - 0.5);
  const shuffledSafe = safePlays.sort(() => Math.random() - 0.5);

  // Get crypto recommendation
  const cryptoOptions = CRYPTO_PICKS[riskStyle] || CRYPTO_PICKS.balanced;
  const cryptoRecommendation = cryptoOptions[Math.floor(Math.random() * cryptoOptions.length)];

  const recommendations = {
    breakoutCandidates: shuffledBreakouts.slice(0, riskStyle === 'aggressive' ? 6 : 4),
    safePlays: shuffledSafe.slice(0, riskStyle === 'conservative' ? 4 : 3),
    cryptoRecommendation,
    totalStocksAnalyzed: breakoutCandidates.length + safePlays.length,
    generatedAt: Date.now(),
    params: { riskStyle, selectedSectors }
  };

  console.log('[Recommendations] Generated:', {
    breakouts: recommendations.breakoutCandidates.length,
    safe: recommendations.safePlays.length,
    crypto: recommendations.cryptoRecommendation?.symbol
  });

  return recommendations;
}

/**
 * Build portfolio from recommendations
 */
export function buildPortfolioFromRecommendations(recommendations, mustHavePicks = []) {
  const { breakoutCandidates, safePlays, cryptoRecommendation } = recommendations;

  const portfolio = [];

  // Add must-haves first
  mustHavePicks.forEach(pick => {
    portfolio.push({
      symbol: pick.symbol,
      name: pick.name || pick.symbol,
      type: 'must-have'
    });
  });

  // Calculate how many more stocks we need (9 total stocks)
  const stocksNeeded = 9 - portfolio.length;

  // Add from breakouts and safe plays
  const additionalPicks = [...breakoutCandidates, ...safePlays]
    .filter(s => !portfolio.find(p => p.symbol === s.symbol));

  additionalPicks.slice(0, stocksNeeded).forEach(pick => {
    portfolio.push({
      symbol: pick.symbol,
      name: pick.name || pick.symbol,
      type: pick.bustRisk < 25 ? 'safe' : 'breakout'
    });
  });

  // Add crypto
  if (cryptoRecommendation) {
    portfolio.push({
      symbol: cryptoRecommendation.symbol,
      name: cryptoRecommendation.name,
      type: 'crypto'
    });
  }

  return portfolio;
}

/**
 * Analyze what the user has picked
 */
function analyzeMustHaves(mustHavePicks) {
  const analysis = {
    sectors: {},
    characteristics: [],
    gaps: []
  };

  // Count sectors
  mustHavePicks.forEach(pick => {
    const sector = getStockSector(pick.symbol) || pick.sector || 'Unknown';
    analysis.sectors[sector] = (analysis.sectors[sector] || 0) + 1;
  });

  // Identify characteristics
  const sectorCount = Object.keys(analysis.sectors).length;
  const totalPicks = mustHavePicks.length;

  if (sectorCount === 1 && totalPicks > 0) {
    analysis.characteristics.push('sector-concentrated');
  } else if (sectorCount >= 3) {
    analysis.characteristics.push('diversified');
  }

  // Check for mega-cap bias
  const megaCaps = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B'];
  const megaCapCount = mustHavePicks.filter(p => megaCaps.includes(p.symbol)).length;
  if (megaCapCount >= 3) {
    analysis.characteristics.push('mega-cap-heavy');
  }

  // Identify gaps
  const hasTech = analysis.sectors['Technology'] > 0;
  const hasDefensive = analysis.sectors['Healthcare'] > 0 ||
                       analysis.sectors['Consumer'] > 0 ||
                       analysis.sectors['Utilities'] > 0;
  const hasEnergy = analysis.sectors['Energy'] > 0;
  const hasFinancials = analysis.sectors['Financials'] > 0;

  if (!hasDefensive && totalPicks > 0) {
    analysis.gaps.push({ type: 'defensive', reason: 'No defensive/stable picks' });
  }
  if (!hasEnergy && !hasFinancials && totalPicks > 0) {
    analysis.gaps.push({ type: 'cyclical', reason: 'No cyclical exposure' });
  }
  if (megaCapCount === totalPicks && totalPicks > 0) {
    analysis.gaps.push({ type: 'mid-cap', reason: 'All mega-caps, no mid-cap growth' });
  }

  return analysis;
}

/**
 * Get suggestions based on analysis
 */
function getSuggestions(analysis, selectedSectors, riskStyle) {
  const suggestions = {
    breakoutCandidates: [],
    safePlays: [],
    reasoning: []
  };

  // Breakout candidates based on gaps
  if (analysis.gaps.find(g => g.type === 'mid-cap')) {
    suggestions.breakoutCandidates.push(
      { symbol: 'AMD', reason: 'Mid-cap semiconductor with high volatility', tag: 'MID-CAP GROWTH' },
      { symbol: 'MRVL', reason: 'Chip momentum play', tag: 'SEMICONDUCTOR' },
      { symbol: 'PLTR', reason: 'AI/Data mid-cap with swing potential', tag: 'AI/DATA' }
    );
    suggestions.reasoning.push('Adding mid-cap growth for higher breakout potential');
  }

  if (analysis.characteristics.includes('sector-concentrated')) {
    // Add diversification picks
    const diversificationPicks = {
      Technology: [
        { symbol: 'XOM', reason: 'Energy diversification', tag: 'ENERGY' },
        { symbol: 'JPM', reason: 'Financials exposure', tag: 'FINANCIALS' }
      ],
      Financials: [
        { symbol: 'NVDA', reason: 'Tech growth exposure', tag: 'TECHNOLOGY' },
        { symbol: 'XOM', reason: 'Energy hedge', tag: 'ENERGY' }
      ],
      Energy: [
        { symbol: 'MSFT', reason: 'Tech stability', tag: 'TECHNOLOGY' },
        { symbol: 'UNH', reason: 'Healthcare defensive', tag: 'HEALTHCARE' }
      ]
    };

    const concentratedSector = Object.keys(analysis.sectors)[0];
    const picks = diversificationPicks[concentratedSector] || diversificationPicks.Technology;
    suggestions.breakoutCandidates.push(...picks);
    suggestions.reasoning.push('Adding sector diversification to reduce correlation risk');
  }

  // Safe plays based on gaps
  if (analysis.gaps.find(g => g.type === 'defensive')) {
    suggestions.safePlays.push(
      { symbol: 'JNJ', reason: 'Healthcare defensive with low volatility', tag: 'HEALTHCARE' },
      { symbol: 'PG', reason: 'Consumer staples stability', tag: 'STAPLES' },
      { symbol: 'KO', reason: 'Consistent performer, low bust risk', tag: 'STAPLES' }
    );
    suggestions.reasoning.push('Adding defensive plays to reduce bust risk');
  }

  // Risk-style adjustments
  if (riskStyle === 'aggressive' && suggestions.breakoutCandidates.length < 4) {
    suggestions.breakoutCandidates.push(
      { symbol: 'COIN', reason: 'High volatility crypto-adjacent', tag: 'FINTECH' },
      { symbol: 'RIVN', reason: 'EV momentum play', tag: 'EV' }
    );
  }

  if (riskStyle === 'conservative' && suggestions.safePlays.length < 3) {
    suggestions.safePlays.push(
      { symbol: 'BRK-B', reason: 'Diversified conglomerate', tag: 'DIVERSIFIED' },
      { symbol: 'V', reason: 'Stable fintech leader', tag: 'FINTECH' }
    );
  }

  // Default fallback if nothing was added
  if (suggestions.breakoutCandidates.length === 0 && suggestions.safePlays.length === 0) {
    suggestions.breakoutCandidates = [
      { symbol: 'NVDA', reason: 'AI leader with momentum', tag: 'TECHNOLOGY' },
      { symbol: 'AMD', reason: 'Semiconductor growth', tag: 'TECHNOLOGY' },
      { symbol: 'AAPL', reason: 'Mega-cap stability with upside', tag: 'TECHNOLOGY' }
    ];
    suggestions.safePlays = [
      { symbol: 'JNJ', reason: 'Healthcare blue chip', tag: 'HEALTHCARE' },
      { symbol: 'KO', reason: 'Consumer staples stability', tag: 'STAPLES' }
    ];
    suggestions.reasoning.push('Balanced mix of growth and stability');
  }

  return suggestions;
}

/**
 * Generate human-readable reasoning
 */
function generateFallbackReasoning(analysis, suggestions) {
  const parts = [];

  if (analysis.characteristics.includes('mega-cap-heavy')) {
    parts.push('Your picks are mega-cap heavy');
  }
  if (analysis.characteristics.includes('sector-concentrated')) {
    const sector = Object.keys(analysis.sectors)[0];
    parts.push(`concentrated in ${sector}`);
  }

  if (suggestions.reasoning.length > 0) {
    parts.push(suggestions.reasoning.join('. '));
  }

  if (parts.length === 0) {
    return 'Based on your selections, here are complementary picks to balance your portfolio.';
  }

  return parts.join('. ') + '.';
}

export default {
  calculateThesisAlignment,
  getRecommendations,
  generateGenericExplanation,
  filterBySector,
  getAvailableSectors,
  getStockSector,
  getAssetVolatility,
  generateSmartFallback,
  generateGamePlanRecommendations,
  buildPortfolioFromRecommendations,
  STOCK_SECTORS,
  SECTOR_PICKS,
  CRYPTO_PICKS,
};
