// FantasyTrades TD Scoring - Breakout Detection Service
// Real-time detection of threshold breach events during battles
//
// NEW LINEAR SCORING SYSTEM:
// - BaggerBomb: +15 points per threshold crossed (positive)
// - Bust: -10 points per threshold crossed (negative)
//
// Example with 2.8% threshold:
// +2.8% = 1 BaggerBomb (+15 pts)
// +5.6% = 2 BaggerBombs (+30 pts)
// -2.8% = 1 Bust (-10 pts)
// -5.6% = 2 Busts (-20 pts)

import { isCrypto } from './sessionScoringService.js';

// ============================================
// SCORING CONSTANTS (NEW LINEAR SYSTEM)
// ============================================

const BAGGERBOMB_POINTS = 15;   // +15 per threshold crossed
const BUST_POINTS = -10;        // -10 per negative threshold crossed

// ============================================
// BREAKOUT EVENT TYPES
// ============================================

/**
 * Breakout type definitions with display properties
 * NEW: Simplified to BAGGERBOMB and BUST only
 */
export const BREAKOUT_TYPES = {
  // Positive breakout - BaggerBomb
  BAGGERBOMB: {
    id: 'BAGGERBOMB',
    name: 'BaggerBomb',
    emoji: '💣',
    color: '#10b981',
    pointsPerThreshold: BAGGERBOMB_POINTS,
    isPositive: true
  },

  // Negative breakout - Bust
  BUST: {
    id: 'BUST',
    name: 'Bust',
    emoji: '📉',
    color: '#ef4444',
    pointsPerThreshold: BUST_POINTS,
    isPositive: false
  },

  // Legacy types - kept for backward compatibility with existing data
  BREAKOUT: {
    id: 'BREAKOUT',
    name: 'BaggerBomb',
    emoji: '💣',
    color: '#10b981',
    points: 15,
    isPositive: true,
    thresholdMultiplier: 1.0,
    _legacy: true
  },
  RALLY: {
    id: 'RALLY',
    name: '2x BaggerBomb',
    emoji: '💣💣',
    color: '#f59e0b',
    points: 30,
    isPositive: true,
    thresholdMultiplier: 1.5,
    _legacy: true
  },
  MOONSHOT: {
    id: 'MOONSHOT',
    name: '3x BaggerBomb',
    emoji: '💣💣💣',
    color: '#8b5cf6',
    points: 45,
    isPositive: true,
    thresholdMultiplier: 2.0,
    _legacy: true
  },
  CRASH: {
    id: 'CRASH',
    name: '2x Bust',
    emoji: '📉📉',
    color: '#dc2626',
    points: -20,
    isPositive: false,
    thresholdMultiplier: 1.5,
    _legacy: true
  },
  MELTDOWN: {
    id: 'MELTDOWN',
    name: '3x Bust',
    emoji: '📉📉📉',
    color: '#991b1b',
    points: -35,
    isPositive: false,
    thresholdMultiplier: 2.0,
    _legacy: true
  }
};

// ============================================
// INTRADAY TRIGGER DETECTION (NEW)
// ============================================

/**
 * Check if a BaggerBomb was triggered based on intraday high
 * @param {number} intradayHigh - Highest price reached during period
 * @param {number} baselinePrice - Starting price for the period
 * @param {number} threshold - Asset's volatility threshold %
 * @param {number} previouslyTriggered - Number of BaggerBombs already triggered this period
 * @returns {object} { newBaggerBombs: number, totalBaggerBombs: number, percentGain: number }
 */
export function checkBaggerBombTrigger(intradayHigh, baselinePrice, threshold, previouslyTriggered = 0) {
  if (!baselinePrice || baselinePrice <= 0 || !threshold || threshold <= 0) {
    return { newBaggerBombs: 0, totalBaggerBombs: 0, percentGain: 0 };
  }

  const percentGain = ((intradayHigh - baselinePrice) / baselinePrice) * 100;
  const totalBaggerBombs = Math.max(0, Math.floor(percentGain / threshold));
  const newBaggerBombs = Math.max(0, totalBaggerBombs - previouslyTriggered);

  return {
    newBaggerBombs,
    totalBaggerBombs,
    percentGain: Number(percentGain.toFixed(2))
  };
}

/**
 * Check if a Bust was triggered based on intraday low
 * @param {number} intradayLow - Lowest price reached during period
 * @param {number} baselinePrice - Starting price for the period
 * @param {number} threshold - Asset's volatility threshold %
 * @param {number} previouslyTriggered - Number of Busts already triggered this period
 * @returns {object} { newBusts: number, totalBusts: number, percentLoss: number }
 */
export function checkBustTrigger(intradayLow, baselinePrice, threshold, previouslyTriggered = 0) {
  if (!baselinePrice || baselinePrice <= 0 || !threshold || threshold <= 0) {
    return { newBusts: 0, totalBusts: 0, percentLoss: 0 };
  }

  const percentLoss = ((baselinePrice - intradayLow) / baselinePrice) * 100;
  const totalBusts = Math.max(0, Math.floor(percentLoss / threshold));
  const newBusts = Math.max(0, totalBusts - previouslyTriggered);

  return {
    newBusts,
    totalBusts,
    percentLoss: Number(percentLoss.toFixed(2))
  };
}

/**
 * Calculate points for BaggerBomb/Bust count
 * @param {number} baggerBombs - Number of BaggerBombs triggered
 * @param {number} busts - Number of Busts triggered
 * @returns {object} { baggerBombPoints, bustPoints, totalPoints }
 */
export function calculateBreakoutPoints(baggerBombs = 0, busts = 0) {
  const baggerBombPoints = baggerBombs * BAGGERBOMB_POINTS;
  const bustPoints = busts * BUST_POINTS;

  return {
    baggerBombPoints,
    bustPoints,
    totalPoints: baggerBombPoints + bustPoints
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate unique breakout event ID
 */
function generateBreakoutId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `breakout_${timestamp}_${random}`;
}

/**
 * Check how many BaggerBombs/Busts already exist for symbol in session
 * @returns {object} { baggerBombs: number, busts: number }
 */
function getExistingBreakoutCounts(existingBreakouts, symbol, sessionId) {
  if (!existingBreakouts || !Array.isArray(existingBreakouts)) {
    return { baggerBombs: 0, busts: 0 };
  }

  let baggerBombs = 0;
  let busts = 0;

  existingBreakouts
    .filter(b => b.symbol === symbol.toUpperCase() && b.sessionId === sessionId)
    .forEach(b => {
      if (b.thresholdsCrossed) {
        // New format with thresholdsCrossed
        if (b.type === 'BAGGERBOMB' || b.isPositive) {
          baggerBombs = Math.max(baggerBombs, b.thresholdsCrossed);
        } else {
          busts = Math.max(busts, b.thresholdsCrossed);
        }
      } else {
        // Legacy format - count individual events
        if (b.isPositive) {
          baggerBombs++;
        } else {
          busts++;
        }
      }
    });

  return { baggerBombs, busts };
}

/**
 * Create a BaggerBomb breakout event object (NEW LINEAR SYSTEM)
 */
function createBaggerBombEvent(symbol, assetName, sessionId, percentChange, price, thresholdsCrossed) {
  const points = thresholdsCrossed * BAGGERBOMB_POINTS;
  const bombEmojis = '💣'.repeat(Math.min(thresholdsCrossed, 5));

  return {
    id: generateBreakoutId(),
    type: 'BAGGERBOMB',
    symbol: symbol.toUpperCase(),
    assetName: assetName || symbol.toUpperCase(),
    sessionId,
    percentChange: Number(percentChange.toFixed(2)),
    price: Number(price.toFixed(2)),
    points,
    thresholdsCrossed,
    timestamp: Date.now(),
    name: thresholdsCrossed === 1 ? 'BaggerBomb' : `${thresholdsCrossed}x BaggerBomb`,
    emoji: bombEmojis,
    color: thresholdsCrossed >= 3 ? '#8b5cf6' : thresholdsCrossed >= 2 ? '#f59e0b' : '#10b981',
    isPositive: true,
    isCrypto: isCrypto(symbol)
  };
}

/**
 * Create a Bust breakout event object (NEW LINEAR SYSTEM)
 */
function createBustEvent(symbol, assetName, sessionId, percentChange, price, thresholdsCrossed) {
  const points = thresholdsCrossed * BUST_POINTS;

  return {
    id: generateBreakoutId(),
    type: 'BUST',
    symbol: symbol.toUpperCase(),
    assetName: assetName || symbol.toUpperCase(),
    sessionId,
    percentChange: Number(percentChange.toFixed(2)),
    price: Number(price.toFixed(2)),
    points,
    thresholdsCrossed,
    timestamp: Date.now(),
    name: thresholdsCrossed === 1 ? 'Bust' : `${thresholdsCrossed}x Bust`,
    emoji: '📉'.repeat(Math.min(thresholdsCrossed, 3)),
    color: thresholdsCrossed >= 3 ? '#991b1b' : thresholdsCrossed >= 2 ? '#dc2626' : '#ef4444',
    isPositive: false,
    isCrypto: isCrypto(symbol)
  };
}

// ============================================
// BREAKOUT DETECTION (NEW LINEAR SYSTEM)
// ============================================

/**
 * Detect breakout events for a single asset
 * NEW LINEAR SYSTEM: Counts thresholds crossed, not tiered levels
 *
 * @param {string} symbol - Asset symbol
 * @param {number} sessionOpenPrice - Price at session start
 * @param {number} currentPrice - Current price
 * @param {Object} thresholds - Threshold data from volatilityService
 * @param {Array} existingBreakouts - Already recorded breakouts (to avoid duplicates)
 * @param {string} sessionId - Current session ID
 * @param {string} assetName - Optional display name for asset
 * @returns {Array} New breakout events (excludes already-recorded ones)
 */
export function detectBreakouts(
  symbol,
  sessionOpenPrice,
  currentPrice,
  thresholds,
  existingBreakouts = [],
  sessionId = 'UNKNOWN',
  assetName = null
) {
  const newBreakouts = [];

  // Validate inputs
  if (!sessionOpenPrice || sessionOpenPrice <= 0) {
    return newBreakouts;
  }

  if (!currentPrice || currentPrice <= 0) {
    return newBreakouts;
  }

  const threshold = thresholds?.threshold || 2.5;
  if (threshold <= 0) {
    return newBreakouts;
  }

  // Calculate percent change
  const percentChange = ((currentPrice - sessionOpenPrice) / sessionOpenPrice) * 100;

  // Get existing counts to avoid duplicates
  const existingCounts = getExistingBreakoutCounts(existingBreakouts, symbol, sessionId);

  if (percentChange > 0) {
    // Check for BaggerBombs (positive)
    const totalBaggerBombs = Math.floor(percentChange / threshold);

    if (totalBaggerBombs > existingCounts.baggerBombs) {
      // New BaggerBomb(s) triggered
      const breakout = createBaggerBombEvent(
        symbol,
        assetName,
        sessionId,
        percentChange,
        currentPrice,
        totalBaggerBombs
      );
      newBreakouts.push(breakout);
    }
  } else if (percentChange < 0) {
    // Check for Busts (negative)
    const absChange = Math.abs(percentChange);
    const totalBusts = Math.floor(absChange / threshold);

    if (totalBusts > existingCounts.busts) {
      // New Bust(s) triggered
      const breakout = createBustEvent(
        symbol,
        assetName,
        sessionId,
        percentChange,
        currentPrice,
        totalBusts
      );
      newBreakouts.push(breakout);
    }
  }

  return newBreakouts;
}

// ============================================
// PORTFOLIO BREAKOUT CHECKING
// ============================================

/**
 * Check all assets in a portfolio for breakout events
 *
 * @param {Array} portfolio - Array of asset objects with symbol and optional name
 * @param {Object} sessionOpenPrices - Map of symbol -> open price
 * @param {Object} currentPrices - Map of symbol -> current price
 * @param {Object} allThresholds - Map of symbol -> threshold data
 * @param {Array} existingBreakouts - Already recorded breakouts
 * @param {string} sessionId - Current session ID
 * @returns {Array} All new breakout events across portfolio
 */
export function checkPortfolioBreakouts(
  portfolio,
  sessionOpenPrices,
  currentPrices,
  allThresholds,
  existingBreakouts = [],
  sessionId
) {
  const allNewBreakouts = [];

  for (const asset of portfolio) {
    const symbol = asset.symbol?.toUpperCase();
    if (!symbol) continue;

    const openPrice = sessionOpenPrices[symbol];
    const currentPrice = currentPrices[symbol];
    const thresholds = allThresholds[symbol] || {};

    const assetBreakouts = detectBreakouts(
      symbol,
      openPrice,
      currentPrice,
      thresholds,
      existingBreakouts,
      sessionId,
      asset.name || asset.assetName
    );

    // Add session ID to each breakout (for consistency)
    assetBreakouts.forEach(b => {
      b.sessionId = sessionId;
    });

    allNewBreakouts.push(...assetBreakouts);
  }

  return allNewBreakouts;
}

// ============================================
// BREAKOUT SUMMARY
// ============================================

/**
 * Get summary statistics for an array of breakouts
 *
 * @param {Array} breakouts - Array of breakout events
 * @returns {Object} Summary with counts and point totals
 */
export function getBreakoutSummary(breakouts) {
  if (!breakouts || !Array.isArray(breakouts) || breakouts.length === 0) {
    return {
      total: 0,
      positive: 0,
      negative: 0,
      totalBonusPoints: 0,
      totalPenaltyPoints: 0,
      netPoints: 0,
      byType: {},
      bySymbol: {}
    };
  }

  const summary = {
    total: breakouts.length,
    positive: 0,
    negative: 0,
    totalBonusPoints: 0,
    totalPenaltyPoints: 0,
    netPoints: 0,
    byType: {},
    bySymbol: {}
  };

  for (const breakout of breakouts) {
    const type = breakout.type;
    const breakoutType = BREAKOUT_TYPES[type];

    if (!breakoutType) continue;

    // Use breakout.points for new format, fallback to breakoutType.points for legacy
    const points = breakout.points !== undefined ? breakout.points : breakoutType.points;

    // Count by positive/negative
    if (breakoutType.isPositive || breakout.isPositive) {
      summary.positive++;
      summary.totalBonusPoints += points;
    } else {
      summary.negative++;
      summary.totalPenaltyPoints += points; // Already negative
    }

    // Count by type
    if (!summary.byType[type]) {
      summary.byType[type] = {
        count: 0,
        points: 0,
        thresholdsCrossed: 0,
        ...breakoutType
      };
    }
    summary.byType[type].count++;
    summary.byType[type].points += points;
    summary.byType[type].thresholdsCrossed += breakout.thresholdsCrossed || 1;

    // Count by symbol
    const symbol = breakout.symbol;
    if (!summary.bySymbol[symbol]) {
      summary.bySymbol[symbol] = {
        count: 0,
        points: 0,
        baggerBombs: 0,
        busts: 0,
        breakouts: []
      };
    }
    summary.bySymbol[symbol].count++;
    summary.bySymbol[symbol].points += points;
    if (breakoutType.isPositive || breakout.isPositive) {
      summary.bySymbol[symbol].baggerBombs += breakout.thresholdsCrossed || 1;
    } else {
      summary.bySymbol[symbol].busts += breakout.thresholdsCrossed || 1;
    }
    summary.bySymbol[symbol].breakouts.push(breakout);
  }

  summary.netPoints = summary.totalBonusPoints + summary.totalPenaltyPoints;

  return summary;
}

// ============================================
// NOTIFICATION FORMATTING
// ============================================

/**
 * Format a breakout event for notification display
 * UPDATED for new linear scoring system
 *
 * @param {Object} breakout - Breakout event object
 * @param {boolean} isYours - Whether this is the user's asset (vs opponent's)
 * @returns {Object} Notification-ready object
 */
export function formatBreakoutNotification(breakout, isYours = true) {
  const breakoutType = BREAKOUT_TYPES[breakout.type];
  if (!breakoutType) {
    return null;
  }

  const thresholdsCrossed = breakout.thresholdsCrossed || 1;
  const absChange = Math.abs(breakout.percentChange).toFixed(2);
  const pointsText = breakout.points >= 0 ? `+${breakout.points}` : `${breakout.points}`;
  const thresholdText = thresholdsCrossed === 1 ? 'threshold' : 'thresholds';

  let title, body;

  if (isYours) {
    // User's own breakout - NEW FORMAT emphasizing thresholds crossed
    if (breakoutType.isPositive || breakout.isPositive) {
      // BaggerBomb notification
      const bombEmojis = breakout.emoji || '💣'.repeat(Math.min(thresholdsCrossed, 5));
      title = `${bombEmojis} BaggerBomb! ${breakout.symbol}`;
      body = `${breakout.symbol} crossed ${thresholdsCrossed} ${thresholdText} (${pointsText} pts)`;
    } else {
      // Bust notification
      title = `${breakout.emoji || '📉'} Bust! ${breakout.symbol}`;
      body = `${breakout.symbol} dropped ${thresholdsCrossed} ${thresholdText} (${pointsText} pts)`;
    }
  } else {
    // Opponent's breakout
    if (breakoutType.isPositive || breakout.isPositive) {
      const bombEmojis = breakout.emoji || '💣'.repeat(Math.min(thresholdsCrossed, 3));
      title = `${bombEmojis} Opponent BaggerBomb!`;
      body = `Their ${breakout.symbol} crossed ${thresholdsCrossed} ${thresholdText}`;
    } else {
      title = `${breakout.emoji || '📉'} Opponent Bust!`;
      body = `Their ${breakout.symbol} dropped ${thresholdsCrossed} ${thresholdText}`;
    }
  }

  return {
    type: breakout.type,
    title,
    body,
    data: {
      breakoutId: breakout.id,
      symbol: breakout.symbol,
      sessionId: breakout.sessionId,
      points: breakout.points,
      percentChange: breakout.percentChange,
      isYours
    },
    color: breakout.color,
    emoji: breakout.emoji,
    isPositive: breakoutType.isPositive,
    priority: breakoutType.isPositive ? 'high' : 'normal',
    timestamp: breakout.timestamp
  };
}

/**
 * Format multiple breakouts for a summary notification
 *
 * @param {Array} breakouts - Array of breakout events
 * @param {boolean} isYours - Whether these are user's assets
 * @returns {Object} Summary notification object
 */
export function formatBreakoutSummaryNotification(breakouts, isYours = true) {
  if (!breakouts || breakouts.length === 0) {
    return null;
  }

  const summary = getBreakoutSummary(breakouts);
  const owner = isYours ? 'Your' : "Opponent's";

  // Find the "best" breakout to feature
  const sortedBreakouts = [...breakouts].sort((a, b) => {
    const aType = BREAKOUT_TYPES[a.type];
    const bType = BREAKOUT_TYPES[b.type];
    return Math.abs(bType.points) - Math.abs(aType.points);
  });

  const featured = sortedBreakouts[0];
  const featuredType = BREAKOUT_TYPES[featured.type];

  let title, body;

  if (breakouts.length === 1) {
    // Single breakout - use regular format
    return formatBreakoutNotification(breakouts[0], isYours);
  }

  // Multiple breakouts
  const pointsText = summary.netPoints >= 0 ? `+${summary.netPoints}` : `${summary.netPoints}`;

  title = `${featured.emoji} ${breakouts.length} Breakout Events!`;
  body = `${owner} portfolio: ${summary.positive} positive, ${summary.negative} negative (${pointsText} pts)`;

  return {
    type: 'SUMMARY',
    title,
    body,
    data: {
      breakoutCount: breakouts.length,
      breakouts: breakouts.map(b => b.id),
      netPoints: summary.netPoints,
      isYours
    },
    color: summary.netPoints >= 0 ? '#10b981' : '#ef4444',
    emoji: featured.emoji,
    isPositive: summary.netPoints >= 0,
    priority: 'high',
    timestamp: Date.now()
  };
}

// ============================================
// BREAKOUT HISTORY MANAGEMENT
// ============================================

/**
 * Filter breakouts by session
 *
 * @param {Array} breakouts - Array of all breakouts
 * @param {string} sessionId - Session to filter by
 * @returns {Array} Breakouts for specified session
 */
export function getBreakoutsForSession(breakouts, sessionId) {
  if (!breakouts || !Array.isArray(breakouts)) {
    return [];
  }
  return breakouts.filter(b => b.sessionId === sessionId);
}

/**
 * Filter breakouts by symbol
 *
 * @param {Array} breakouts - Array of all breakouts
 * @param {string} symbol - Symbol to filter by
 * @returns {Array} Breakouts for specified symbol
 */
export function getBreakoutsForSymbol(breakouts, symbol) {
  if (!breakouts || !Array.isArray(breakouts)) {
    return [];
  }
  return breakouts.filter(b => b.symbol === symbol.toUpperCase());
}

/**
 * Get the highest tier breakout for a symbol in a session
 *
 * @param {Array} breakouts - Array of breakouts
 * @param {string} symbol - Asset symbol
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Highest tier breakout or null
 */
export function getHighestBreakout(breakouts, symbol, sessionId) {
  const symbolBreakouts = breakouts.filter(
    b => b.symbol === symbol.toUpperCase() && b.sessionId === sessionId
  );

  if (symbolBreakouts.length === 0) {
    return null;
  }

  // Sort by absolute point value (highest first)
  return symbolBreakouts.sort((a, b) => {
    return Math.abs(BREAKOUT_TYPES[b.type].points) - Math.abs(BREAKOUT_TYPES[a.type].points);
  })[0];
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  // Constants
  BREAKOUT_TYPES,
  BAGGERBOMB_POINTS,
  BUST_POINTS,

  // NEW: Intraday trigger detection
  checkBaggerBombTrigger,
  checkBustTrigger,
  calculateBreakoutPoints,

  // Detection
  detectBreakouts,
  checkPortfolioBreakouts,

  // Summary & Formatting
  getBreakoutSummary,
  formatBreakoutNotification,
  formatBreakoutSummaryNotification,

  // History management
  getBreakoutsForSession,
  getBreakoutsForSymbol,
  getHighestBreakout
};
