// src/services/earningsReactionsService.js
// Enhanced EarningsGame pricing with price floors, steeper multipliers, and precision tiers

// ============================================
// CONSTANTS
// ============================================

export const BUDGET = 10000;
export const MIN_PRICE = 500; // Price floor - no parlay costs less than this

// Magnitude bands for stock reactions
export const MAGNITUDE_BANDS = {
  upBig: {
    id: 'upBig',
    label: 'Up Big',
    emoji: '🚀',
    range: '> +5%',
    min: 5,
    max: Infinity,
    midpoint: 7 // Used for precision tier centering
  },
  up: {
    id: 'up',
    label: 'Up',
    emoji: '📈',
    range: '+2% to +5%',
    min: 2,
    max: 5,
    midpoint: 3.5
  },
  flat: {
    id: 'flat',
    label: 'Flat',
    emoji: '😐',
    range: '-2% to +2%',
    min: -2,
    max: 2,
    midpoint: 0
  },
  down: {
    id: 'down',
    label: 'Down',
    emoji: '📉',
    range: '-5% to -2%',
    min: -5,
    max: -2,
    midpoint: -3.5
  },
  downBig: {
    id: 'downBig',
    label: 'Down Big',
    emoji: '💥',
    range: '< -5%',
    min: -Infinity,
    max: -5,
    midpoint: -7
  }
};

// Precision tiers for Lottery Mode
export const PRECISION_TIERS = {
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'Full range',
    multiplierBoost: 1.0,
    widthPercent: 100 // Uses full band width
  },
  narrow: {
    id: 'narrow',
    label: 'Narrow',
    description: '2% range',
    multiplierBoost: 1.6,
    width: 2 // 2 percentage points
  },
  bullseye: {
    id: 'bullseye',
    label: 'Bullseye',
    emoji: '🎯',
    description: '1% range',
    multiplierBoost: 2.5,
    width: 1 // 1 percentage point
  }
};

// Sector-based default probabilities for stock reactions after earnings
export const SECTOR_DEFAULTS = {
  tech: {
    afterBeat: { upBig: 0.20, up: 0.25, flat: 0.25, down: 0.20, downBig: 0.10 },
    afterMiss: { upBig: 0.05, up: 0.10, flat: 0.15, down: 0.30, downBig: 0.40 }
  },
  financials: {
    afterBeat: { upBig: 0.10, up: 0.35, flat: 0.35, down: 0.15, downBig: 0.05 },
    afterMiss: { upBig: 0.05, up: 0.10, flat: 0.20, down: 0.40, downBig: 0.25 }
  },
  consumer: {
    afterBeat: { upBig: 0.15, up: 0.30, flat: 0.30, down: 0.18, downBig: 0.07 },
    afterMiss: { upBig: 0.05, up: 0.12, flat: 0.18, down: 0.35, downBig: 0.30 }
  },
  healthcare: {
    afterBeat: { upBig: 0.08, up: 0.30, flat: 0.40, down: 0.17, downBig: 0.05 },
    afterMiss: { upBig: 0.05, up: 0.15, flat: 0.25, down: 0.35, downBig: 0.20 }
  },
  industrial: {
    afterBeat: { upBig: 0.12, up: 0.32, flat: 0.32, down: 0.17, downBig: 0.07 },
    afterMiss: { upBig: 0.05, up: 0.10, flat: 0.20, down: 0.38, downBig: 0.27 }
  },
  energy: {
    afterBeat: { upBig: 0.18, up: 0.28, flat: 0.26, down: 0.18, downBig: 0.10 },
    afterMiss: { upBig: 0.06, up: 0.12, flat: 0.17, down: 0.32, downBig: 0.33 }
  },
  default: {
    afterBeat: { upBig: 0.12, up: 0.30, flat: 0.32, down: 0.18, downBig: 0.08 },
    afterMiss: { upBig: 0.05, up: 0.10, flat: 0.20, down: 0.35, downBig: 0.30 }
  }
};

// ============================================
// MOMENTUM MAGNITUDE ADJUSTMENTS
// ============================================
// Based on trading insight: stocks running into earnings tend to have smaller post-earnings moves (priced in)
// Stocks selling off into earnings tend to have larger surprise moves

const MOMENTUM_MAGNITUDE_ADJUSTMENTS = {
  // Strong positive momentum (+15% or more)
  strongBullish: {
    afterBeat: {
      flat: 1.20,      // +20% more likely to be flat (priced in)
      up: 1.05,        // slightly more likely
      upBig: 0.85,     // -15% less likely (already ran)
      down: 0.95,      // slightly less likely
      downBig: 0.85    // -15% less likely
    },
    afterMiss: {
      flat: 0.80,      // -20% less likely (surprise!)
      up: 0.85,        // less likely
      upBig: 0.70,     // much less likely
      down: 1.15,      // more likely
      downBig: 1.30    // +30% more likely (nasty surprise)
    }
  },

  // Moderate positive momentum (+5% to +15%)
  moderateBullish: {
    afterBeat: {
      flat: 1.10,
      up: 1.02,
      upBig: 0.92,
      down: 0.98,
      downBig: 0.92
    },
    afterMiss: {
      flat: 0.90,
      up: 0.92,
      upBig: 0.85,
      down: 1.08,
      downBig: 1.15
    }
  },

  // Neutral momentum (-5% to +5%)
  neutral: {
    afterBeat: { flat: 1.0, up: 1.0, upBig: 1.0, down: 1.0, downBig: 1.0 },
    afterMiss: { flat: 1.0, up: 1.0, upBig: 1.0, down: 1.0, downBig: 1.0 }
  },

  // Moderate negative momentum (-15% to -5%)
  moderateBearish: {
    afterBeat: {
      flat: 0.90,      // less likely flat
      up: 1.05,
      upBig: 1.15,     // +15% more likely (positive surprise)
      down: 0.95,
      downBig: 0.90
    },
    afterMiss: {
      flat: 0.90,
      up: 0.95,
      upBig: 0.90,
      down: 1.08,
      downBig: 1.12    // more likely big down (confirms fears)
    }
  },

  // Strong negative momentum (-15% or worse)
  strongBearish: {
    afterBeat: {
      flat: 0.80,      // -20% less likely flat
      up: 1.10,
      upBig: 1.30,     // +30% more likely (big positive surprise)
      down: 0.90,
      downBig: 0.85
    },
    afterMiss: {
      flat: 0.85,
      up: 0.90,
      upBig: 0.85,
      down: 1.10,
      downBig: 1.20    // +20% more likely (confirms worst fears)
    }
  }
};

/**
 * Classify momentum based on 30-day price change
 * @param {number|null} priceChange30d - 30-day price change percentage
 * @returns {string} - Momentum classification
 */
function classifyMomentum(priceChange30d) {
  if (priceChange30d === null || priceChange30d === undefined) {
    console.log(`[Momentum] No data → neutral`);
    return 'neutral';
  }

  let momentumClass;
  if (priceChange30d >= 15) momentumClass = 'strongBullish';
  else if (priceChange30d >= 5) momentumClass = 'moderateBullish';
  else if (priceChange30d <= -15) momentumClass = 'strongBearish';
  else if (priceChange30d <= -5) momentumClass = 'moderateBearish';
  else momentumClass = 'neutral';

  console.log(`[Momentum] ${priceChange30d?.toFixed(1)}% → ${momentumClass}`);
  return momentumClass;
}

/**
 * Apply momentum adjustments to magnitude probabilities
 * @param {Object} baseProbabilities - Base probability object { upBig, up, flat, down, downBig }
 * @param {string} momentumClass - Momentum classification
 * @param {string} outcome - 'beat' or 'miss'
 * @returns {Object} - Adjusted probabilities (normalized to sum to 1.0)
 */
function applyMomentumToMagnitude(baseProbabilities, momentumClass, outcome) {
  const adjustments = MOMENTUM_MAGNITUDE_ADJUSTMENTS[momentumClass];
  if (!adjustments) return baseProbabilities;

  const factors = outcome === 'beat' ? adjustments.afterBeat : adjustments.afterMiss;

  // Apply factors
  const adjusted = {};
  let total = 0;

  Object.keys(baseProbabilities).forEach(magnitude => {
    adjusted[magnitude] = baseProbabilities[magnitude] * (factors[magnitude] || 1.0);
    total += adjusted[magnitude];
  });

  // Normalize to ensure probabilities sum to 1.0
  Object.keys(adjusted).forEach(magnitude => {
    adjusted[magnitude] = Math.round((adjusted[magnitude] / total) * 100) / 100;
  });

  // Log sample adjustment for debugging
  if (momentumClass !== 'neutral') {
    console.log(`[Magnitude Adjust] ${outcome}: flat ${baseProbabilities.flat?.toFixed(2)} → ${adjusted.flat?.toFixed(2)}`);
  }

  return adjusted;
}

// Symbol to sector mapping
const SYMBOL_SECTORS = {
  // Tech
  'NVDA': 'tech', 'AAPL': 'tech', 'MSFT': 'tech', 'GOOGL': 'tech', 'GOOG': 'tech',
  'META': 'tech', 'AMZN': 'tech', 'AMD': 'tech', 'INTC': 'tech', 'TSM': 'tech',
  'NFLX': 'tech', 'CRM': 'tech', 'ADBE': 'tech', 'ORCL': 'tech', 'CSCO': 'tech',
  'AVGO': 'tech', 'QCOM': 'tech', 'TXN': 'tech', 'NOW': 'tech', 'IBM': 'tech',
  'UBER': 'tech', 'ABNB': 'tech', 'SNAP': 'tech', 'PINS': 'tech', 'SQ': 'tech',
  'SHOP': 'tech', 'PLTR': 'tech', 'SNOW': 'tech', 'DDOG': 'tech', 'ZS': 'tech',

  // Financials
  'JPM': 'financials', 'BAC': 'financials', 'WFC': 'financials', 'GS': 'financials',
  'MS': 'financials', 'C': 'financials', 'BLK': 'financials', 'SCHW': 'financials',
  'AXP': 'financials', 'V': 'financials', 'MA': 'financials', 'PYPL': 'financials',
  'COF': 'financials', 'USB': 'financials', 'PNC': 'financials',

  // Consumer
  'TSLA': 'consumer', 'NKE': 'consumer', 'SBUX': 'consumer', 'MCD': 'consumer',
  'HD': 'consumer', 'LOW': 'consumer', 'TGT': 'consumer', 'COST': 'consumer',
  'WMT': 'consumer', 'DIS': 'consumer', 'CMCSA': 'consumer', 'PEP': 'consumer',
  'KO': 'consumer', 'PG': 'consumer', 'CL': 'consumer',

  // Healthcare
  'JNJ': 'healthcare', 'UNH': 'healthcare', 'PFE': 'healthcare', 'MRK': 'healthcare',
  'ABBV': 'healthcare', 'LLY': 'healthcare', 'TMO': 'healthcare', 'ABT': 'healthcare',
  'BMY': 'healthcare', 'AMGN': 'healthcare', 'GILD': 'healthcare', 'CVS': 'healthcare',
  'CI': 'healthcare', 'HUM': 'healthcare', 'ISRG': 'healthcare',

  // Industrial
  'CAT': 'industrial', 'DE': 'industrial', 'BA': 'industrial', 'HON': 'industrial',
  'UPS': 'industrial', 'FDX': 'industrial', 'LMT': 'industrial', 'RTX': 'industrial',
  'GE': 'industrial', 'MMM': 'industrial', 'EMR': 'industrial', 'ITW': 'industrial',

  // Energy
  'XOM': 'energy', 'CVX': 'energy', 'COP': 'energy', 'SLB': 'energy',
  'EOG': 'energy', 'PXD': 'energy', 'MPC': 'energy', 'VLO': 'energy',
  'PSX': 'energy', 'OXY': 'energy', 'HAL': 'energy', 'DVN': 'energy'
};

// ============================================
// MULTIPLIER SYSTEM
// ============================================

/**
 * Get base multiplier based on combined probability
 * Steeper curve rewards contrarian/long-shot plays
 * Max base multiplier is 8x (can reach 20x with precision boost)
 */
export function getMultiplier(combinedProbability) {
  const prob = combinedProbability;

  if (prob >= 0.35) return 1.3;   // Very likely - modest reward
  if (prob >= 0.25) return 1.5;   // Likely
  if (prob >= 0.18) return 1.8;   // Moderate
  if (prob >= 0.12) return 2.2;   // Contrarian
  if (prob >= 0.08) return 3.0;   // Long shot
  if (prob >= 0.05) return 4.0;   // Very long shot
  if (prob >= 0.03) return 5.5;   // Lottery territory
  if (prob >= 0.01) return 7.0;   // Extreme long shot
  return 8.0;                      // Ultra rare (< 1%)
}

/**
 * Get risk level display info based on multiplier
 */
export function getRiskLevel(multiplier) {
  if (multiplier <= 1.5) return { level: 'low', label: 'Safe Play', color: '#10b981' };
  if (multiplier <= 2.2) return { level: 'medium', label: 'Moderate', color: '#f59e0b' };
  if (multiplier <= 4.0) return { level: 'high', label: 'Risky', color: '#f97316' };
  if (multiplier <= 6.0) return { level: 'very-high', label: 'Long Shot', color: '#ef4444' };
  return { level: 'extreme', label: 'Lottery', color: '#dc2626' };
}

// ============================================
// PRECISION TIER CALCULATIONS
// ============================================

/**
 * Calculate precision range for a given magnitude band and tier
 * Returns the specific price range the user is betting on
 */
export function getPrecisionRange(magnitudeBand, precisionTier) {
  const band = MAGNITUDE_BANDS[magnitudeBand];
  const tier = PRECISION_TIERS[precisionTier];

  if (precisionTier === 'standard') {
    return {
      min: band.min,
      max: band.max,
      label: band.range,
      width: band.max === Infinity || band.min === -Infinity
        ? 'unlimited'
        : Math.abs(band.max - band.min)
    };
  }

  // For narrow and bullseye, center around the band's midpoint
  const halfWidth = tier.width / 2;
  const center = band.midpoint;

  let min = center - halfWidth;
  let max = center + halfWidth;

  // Handle edge cases for Up Big and Down Big
  if (magnitudeBand === 'upBig') {
    // Shift range to start at +5%
    min = 5 + (tier.width === 2 ? 0 : 0.5);
    max = min + tier.width;
  } else if (magnitudeBand === 'downBig') {
    // Shift range to end at -5%
    max = -5 - (tier.width === 2 ? 0 : 0.5);
    min = max - tier.width;
  }

  const formatNum = (n) => {
    if (n === Infinity) return '∞';
    if (n === -Infinity) return '-∞';
    return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
  };

  return {
    min,
    max,
    label: `${formatNum(min)} to ${formatNum(max)}`,
    width: tier.width
  };
}

/**
 * Get all precision options for a magnitude band
 * Returns array of options with ranges and boosted multipliers
 */
export function getPrecisionOptions(magnitudeBand, baseMultiplier) {
  const options = [];

  Object.values(PRECISION_TIERS).forEach(tier => {
    const range = getPrecisionRange(magnitudeBand, tier.id);
    const boostedMultiplier = Math.min(baseMultiplier * tier.multiplierBoost, 20); // Cap at 20x

    options.push({
      tierId: tier.id,
      tierLabel: tier.label,
      tierEmoji: tier.emoji || '',
      description: tier.description,
      range: range,
      multiplierBoost: tier.multiplierBoost,
      finalMultiplier: boostedMultiplier,
      isCapped: baseMultiplier * tier.multiplierBoost > 20
    });
  });

  return options;
}

// ============================================
// PARLAY PRICE CALCULATIONS
// ============================================

/**
 * Calculate price for a parlay
 * Applies $500 minimum floor and rounds to whole dollars
 */
export function calculateParlayPrice(beatMissOdds, reactionProbability, budget = BUDGET) {
  const rawPrice = budget * beatMissOdds * reactionProbability;
  return Math.max(Math.round(rawPrice), MIN_PRICE);
}

/**
 * Calculate potential payout for a parlay
 */
export function calculatePayout(price, multiplier) {
  return Math.round(price * multiplier);
}

/**
 * Get sector for a symbol
 */
export function getSectorForSymbol(symbol) {
  const upperSymbol = symbol?.toUpperCase();
  return SYMBOL_SECTORS[upperSymbol] || 'default';
}

/**
 * Get reaction probabilities for a symbol and outcome
 */
export function getReactionProbabilities(symbol, outcome) {
  const sector = getSectorForSymbol(symbol);
  const sectorData = SECTOR_DEFAULTS[sector] || SECTOR_DEFAULTS.default;
  return outcome === 'beat' ? sectorData.afterBeat : sectorData.afterMiss;
}

/**
 * Get reaction probabilities - tries stock-specific first, falls back to sector
 * This is the ASYNC version that checks historical data
 *
 * @param {string} symbol - Stock symbol
 * @param {string} outcome - 'beat' or 'miss'
 * @returns {Promise<Object>} - { probabilities, source, sector?, quarterCount? }
 */
export async function getReactionProbabilitiesAsync(symbol, outcome) {
  // Dynamically import to avoid circular dependencies
  const { getStockReactionProbabilities, getStockEarningsHistory } = await import('./stockEarningsHistoryService');

  // Try stock-specific data first
  const stockProbs = await getStockReactionProbabilities(symbol);

  if (stockProbs) {
    const probs = outcome === 'beat' ? stockProbs.afterBeat : stockProbs.afterMiss;
    // Validate we have all magnitude bands
    if (probs && probs.upBig !== undefined && probs.up !== undefined &&
        probs.flat !== undefined && probs.down !== undefined && probs.downBig !== undefined) {
      // Get quarter count from history
      const history = await getStockEarningsHistory(symbol);
      const quarterCount = history?.quartersAnalyzed || 0;
      return { probabilities: probs, source: 'stock-specific', quarterCount };
    }
  }

  // Fall back to sector defaults
  const sector = getSectorForSymbol(symbol);
  const sectorData = SECTOR_DEFAULTS[sector] || SECTOR_DEFAULTS.default;
  const probs = outcome === 'beat' ? sectorData.afterBeat : sectorData.afterMiss;

  return { probabilities: probs, source: 'sector-default', sector };
}

/**
 * Calculate all parlay options for an earnings event
 * Returns 10 base parlays (5 for beat, 5 for miss)
 * Each parlay includes precision tier options for Lottery Mode
 */
export function calculateParlayPrices(event, budget = BUDGET) {
  const { beatOdds = 0.5, symbol } = event;
  const missOdds = 1 - beatOdds;

  const sector = getSectorForSymbol(symbol);
  const sectorData = SECTOR_DEFAULTS[sector] || SECTOR_DEFAULTS.default;

  const parlays = [];

  ['beat', 'miss'].forEach(outcome => {
    const outcomeOdds = outcome === 'beat' ? beatOdds : missOdds;
    const reactions = outcome === 'beat' ? sectorData.afterBeat : sectorData.afterMiss;

    Object.entries(MAGNITUDE_BANDS).forEach(([bandId, band]) => {
      const reactionProb = reactions[bandId];
      const combinedProb = outcomeOdds * reactionProb;

      // Calculate base price with floor
      const price = calculateParlayPrice(outcomeOdds, reactionProb, budget);
      const baseMultiplier = getMultiplier(combinedProb);
      const basePayout = calculatePayout(price, baseMultiplier);
      const risk = getRiskLevel(baseMultiplier);

      // Get precision options for Lottery Mode
      const precisionOptions = getPrecisionOptions(bandId, baseMultiplier);

      parlays.push({
        id: `${outcome}-${bandId}`,
        outcome,
        outcomeLabel: outcome === 'beat' ? 'BEAT' : 'MISS',
        magnitude: bandId,
        magnitudeLabel: band.label,
        magnitudeEmoji: band.emoji,
        magnitudeRange: band.range,

        // Probabilities
        outcomeOdds,
        reactionProb,
        combinedProb,

        // Base pricing (Standard tier)
        price,
        priceDisplay: `$${price.toLocaleString()}`,
        baseMultiplier,
        basePayout,
        basePayoutDisplay: `$${basePayout.toLocaleString()}`,
        risk,

        // Precision options for Lottery Mode
        precisionOptions,

        // Sector info
        sector
      });
    });
  });

  // Sort: beat outcomes first, then by price descending
  parlays.sort((a, b) => {
    if (a.outcome !== b.outcome) return a.outcome === 'beat' ? -1 : 1;
    return b.price - a.price;
  });

  return parlays;
}

/**
 * Enhance an event with calculated parlays and summary data
 */
export function enhanceEventWithParlays(event, budget = BUDGET) {
  const parlays = calculateParlayPrices(event, budget);

  // Create reaction summary for display
  const sector = getSectorForSymbol(event.symbol);
  const sectorData = SECTOR_DEFAULTS[sector] || SECTOR_DEFAULTS.default;

  const reactionSummary = {
    sector,
    sectorLabel: sector.charAt(0).toUpperCase() + sector.slice(1),
    afterBeat: Object.entries(sectorData.afterBeat).map(([band, prob]) => ({
      band,
      ...MAGNITUDE_BANDS[band],
      probability: prob,
      probabilityDisplay: `${(prob * 100).toFixed(0)}%`
    })),
    afterMiss: Object.entries(sectorData.afterMiss).map(([band, prob]) => ({
      band,
      ...MAGNITUDE_BANDS[band],
      probability: prob,
      probabilityDisplay: `${(prob * 100).toFixed(0)}%`
    }))
  };

  return {
    ...event,
    parlays,
    reactionSummary,
    enhancedAt: new Date().toISOString()
  };
}

/**
 * Calculate parlay prices - ASYNC version that uses stock-specific data when available
 * Now includes momentum adjustments to magnitude probabilities
 *
 * @param {Object} event - Earnings event with beatOdds, symbol, and optionally priceChange30d
 * @param {number} budget - Budget amount (default BUDGET)
 * @returns {Promise<Array>} - Array of parlay options
 */
export async function calculateParlayPricesAsync(event, budget = BUDGET) {
  const { beatOdds = 0.5, symbol, priceChange30d } = event;
  const missOdds = 1 - beatOdds;

  // Classify momentum for magnitude adjustments
  const momentumClass = classifyMomentum(priceChange30d);

  // Fetch stock-specific probabilities (async)
  const [beatProbs, missProbs] = await Promise.all([
    getReactionProbabilitiesAsync(symbol, 'beat'),
    getReactionProbabilitiesAsync(symbol, 'miss')
  ]);

  // Apply momentum adjustments to base probabilities
  const adjustedBeatProbs = {
    ...beatProbs,
    probabilities: applyMomentumToMagnitude(beatProbs.probabilities, momentumClass, 'beat')
  };
  const adjustedMissProbs = {
    ...missProbs,
    probabilities: applyMomentumToMagnitude(missProbs.probabilities, momentumClass, 'miss')
  };

  console.log(`[Magnitude] ${symbol}: momentum=${momentumClass} (${priceChange30d?.toFixed(1) || 'N/A'}%), applying adjustments`);

  const parlays = [];

  const sector = getSectorForSymbol(symbol);

  ['beat', 'miss'].forEach(outcome => {
    const outcomeOdds = outcome === 'beat' ? beatOdds : missOdds;
    const { probabilities: reactions, source, quarterCount } = outcome === 'beat' ? adjustedBeatProbs : adjustedMissProbs;

    Object.entries(MAGNITUDE_BANDS).forEach(([bandId, band]) => {
      const reactionProb = reactions[bandId];
      const combinedProb = outcomeOdds * reactionProb;

      // Calculate base price with floor
      const price = calculateParlayPrice(outcomeOdds, reactionProb, budget);
      const baseMultiplier = getMultiplier(combinedProb);
      const basePayout = calculatePayout(price, baseMultiplier);
      const risk = getRiskLevel(baseMultiplier);

      // Get precision options for Lottery Mode
      const precisionOptions = getPrecisionOptions(bandId, baseMultiplier);

      parlays.push({
        id: `${outcome}-${bandId}`,
        outcome,
        outcomeLabel: outcome === 'beat' ? 'BEAT' : 'MISS',
        magnitude: bandId,
        magnitudeLabel: band.label,
        magnitudeEmoji: band.emoji,
        magnitudeRange: band.range,

        // Probabilities
        outcomeOdds,
        reactionProb,
        combinedProb,

        // Data source indicator
        dataSource: source,
        quarterCount: quarterCount || null, // Number of quarters if stock-specific, null if sector

        // Base pricing (Standard tier)
        price,
        priceDisplay: `$${price.toLocaleString()}`,
        baseMultiplier,
        basePayout,
        basePayoutDisplay: `$${basePayout.toLocaleString()}`,
        risk,

        // Precision options for Lottery Mode
        precisionOptions,

        // Sector info
        sector,

        // Momentum info
        momentumClass,
        priceChange30d: priceChange30d || null
      });
    });
  });

  // Sort: beat outcomes first, then by price descending
  parlays.sort((a, b) => {
    if (a.outcome !== b.outcome) return a.outcome === 'beat' ? -1 : 1;
    return b.price - a.price;
  });

  return parlays;
}

/**
 * Enhance an event with calculated parlays - ASYNC version
 * Includes stock-specific stats when available
 *
 * @param {Object} event - Earnings event
 * @param {number} budget - Budget amount (default BUDGET)
 * @returns {Promise<Object>} - Enhanced event with parlays, reactionSummary, stockStats
 */
export async function enhanceEventWithParlaysAsync(event, budget = BUDGET) {
  const parlays = await calculateParlayPricesAsync(event, budget);

  // Try to get stock-specific stats for display
  let stockStats = null;
  try {
    const { getStockEarningsStats } = await import('./stockEarningsHistoryService');
    stockStats = await getStockEarningsStats(event.symbol);
  } catch (e) {
    // Service not available, continue without
    console.warn('[enhanceEventWithParlaysAsync] Could not fetch stock stats:', e.message);
  }

  // Create reaction summary for display
  const sector = getSectorForSymbol(event.symbol);
  const sectorData = SECTOR_DEFAULTS[sector] || SECTOR_DEFAULTS.default;

  // Determine data source from parlays
  const dataSource = parlays[0]?.dataSource || 'sector-default';

  const reactionSummary = {
    sector,
    sectorLabel: sector.charAt(0).toUpperCase() + sector.slice(1),
    dataSource,
    stockStats, // Will be null if no history, or { avgMoveOnBeat, avgMoveOnMiss, etc. }
    afterBeat: Object.entries(sectorData.afterBeat).map(([band, prob]) => ({
      band,
      ...MAGNITUDE_BANDS[band],
      probability: prob,
      probabilityDisplay: `${(prob * 100).toFixed(0)}%`
    })),
    afterMiss: Object.entries(sectorData.afterMiss).map(([band, prob]) => ({
      band,
      ...MAGNITUDE_BANDS[band],
      probability: prob,
      probabilityDisplay: `${(prob * 100).toFixed(0)}%`
    }))
  };

  return {
    ...event,
    parlays,
    reactionSummary,
    stockStats, // Also at top level for easy access
    dataSource,
    enhancedAt: new Date().toISOString()
  };
}

/**
 * Verify if a prediction hit based on actual results
 */
export function verifyPrediction(prediction, actualMove, didBeat) {
  // Check outcome match
  const outcomeCorrect =
    (prediction.outcome === 'beat' && didBeat) ||
    (prediction.outcome === 'miss' && !didBeat);

  if (!outcomeCorrect) {
    return { correct: false, reason: 'outcome' };
  }

  // Check magnitude match based on precision tier
  const { magnitude, precisionTier = 'standard' } = prediction;
  const range = getPrecisionRange(magnitude, precisionTier);

  let magnitudeCorrect = false;

  if (range.min === -Infinity) {
    magnitudeCorrect = actualMove <= range.max;
  } else if (range.max === Infinity) {
    magnitudeCorrect = actualMove >= range.min;
  } else {
    magnitudeCorrect = actualMove >= range.min && actualMove <= range.max;
  }

  if (!magnitudeCorrect) {
    return { correct: false, reason: 'magnitude' };
  }

  return { correct: true };
}

export default {
  BUDGET,
  MIN_PRICE,
  MAGNITUDE_BANDS,
  PRECISION_TIERS,
  SECTOR_DEFAULTS,
  getMultiplier,
  getRiskLevel,
  getPrecisionRange,
  getPrecisionOptions,
  calculateParlayPrice,
  calculatePayout,
  getSectorForSymbol,
  getReactionProbabilities,
  calculateParlayPrices,
  enhanceEventWithParlays,
  verifyPrediction,
  // Async versions that use stock-specific historical data
  getReactionProbabilitiesAsync,
  calculateParlayPricesAsync,
  enhanceEventWithParlaysAsync
};
