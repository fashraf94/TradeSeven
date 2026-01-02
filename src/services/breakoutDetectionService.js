// MarketClash TD Scoring - Breakout Detection Service
// Real-time detection of threshold breach events during battles
//
// Detects when assets cross their volatility thresholds:
// - Positive: Breakout → Rally → Moonshot
// - Negative: Bust → Crash → Meltdown

import { isCrypto } from './sessionScoringService.js';

// ============================================
// BREAKOUT EVENT TYPES
// ============================================

/**
 * Breakout type definitions with display properties
 */
export const BREAKOUT_TYPES = {
  // Positive breakouts (gains)
  BREAKOUT: {
    id: 'BREAKOUT',
    name: 'Breakout',
    emoji: '🎯',
    color: '#10b981',
    points: 15,
    isPositive: true,
    thresholdMultiplier: 1.0
  },
  RALLY: {
    id: 'RALLY',
    name: 'Rally',
    emoji: '🚀',
    color: '#f59e0b',
    points: 30,
    isPositive: true,
    thresholdMultiplier: 1.5
  },
  MOONSHOT: {
    id: 'MOONSHOT',
    name: 'Moonshot',
    emoji: '🌙',
    color: '#8b5cf6',
    points: 50,
    isPositive: true,
    thresholdMultiplier: 2.0
  },

  // Negative busts (losses)
  BUST: {
    id: 'BUST',
    name: 'Bust',
    emoji: '📉',
    color: '#ef4444',
    points: -10,
    isPositive: false,
    thresholdMultiplier: 1.0
  },
  CRASH: {
    id: 'CRASH',
    name: 'Crash',
    emoji: '💥',
    color: '#dc2626',
    points: -20,
    isPositive: false,
    thresholdMultiplier: 1.5
  },
  MELTDOWN: {
    id: 'MELTDOWN',
    name: 'Meltdown',
    emoji: '🔥',
    color: '#991b1b',
    points: -35,
    isPositive: false,
    thresholdMultiplier: 2.0
  }
};

// Ordered arrays for checking thresholds
const POSITIVE_BREAKOUT_ORDER = ['BREAKOUT', 'RALLY', 'MOONSHOT'];
const NEGATIVE_BREAKOUT_ORDER = ['BUST', 'CRASH', 'MELTDOWN'];

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
 * Check if a breakout of given type already exists for symbol in session
 */
function hasExistingBreakout(existingBreakouts, symbol, type, sessionId) {
  if (!existingBreakouts || !Array.isArray(existingBreakouts)) {
    return false;
  }

  return existingBreakouts.some(
    b => b.symbol === symbol &&
         b.type === type &&
         b.sessionId === sessionId
  );
}

/**
 * Get threshold value for a breakout type
 */
function getThresholdForType(thresholds, type) {
  const breakoutType = BREAKOUT_TYPES[type];
  if (!breakoutType) return null;

  const baseThreshold = thresholds?.threshold || 2.5;

  if (breakoutType.isPositive) {
    // Positive thresholds
    switch (type) {
      case 'BREAKOUT':
        return thresholds?.threshold || baseThreshold;
      case 'RALLY':
        return thresholds?.rallyThreshold || baseThreshold * 1.5;
      case 'MOONSHOT':
        return thresholds?.moonshotThreshold || baseThreshold * 2.0;
      default:
        return baseThreshold;
    }
  } else {
    // Negative thresholds
    switch (type) {
      case 'BUST':
        return thresholds?.bustThreshold || baseThreshold;
      case 'CRASH':
        return thresholds?.crashThreshold || baseThreshold * 1.5;
      case 'MELTDOWN':
        return thresholds?.meltdownThreshold || baseThreshold * 2.0;
      default:
        return baseThreshold;
    }
  }
}

/**
 * Create a breakout event object
 */
function createBreakoutEvent(type, symbol, assetName, sessionId, percentChange, price) {
  const breakoutType = BREAKOUT_TYPES[type];
  if (!breakoutType) return null;

  return {
    id: generateBreakoutId(),
    type,
    symbol: symbol.toUpperCase(),
    assetName: assetName || symbol.toUpperCase(),
    sessionId,
    percentChange: Number(percentChange.toFixed(2)),
    price: Number(price.toFixed(2)),
    points: breakoutType.points,
    timestamp: Date.now(),
    name: breakoutType.name,
    emoji: breakoutType.emoji,
    color: breakoutType.color,
    isPositive: breakoutType.isPositive,
    isCrypto: isCrypto(symbol)
  };
}

// ============================================
// BREAKOUT DETECTION
// ============================================

/**
 * Detect breakout events for a single asset
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

  // Calculate percent change
  const percentChange = ((currentPrice - sessionOpenPrice) / sessionOpenPrice) * 100;

  // Determine which type of breakouts to check
  if (percentChange > 0) {
    // Check positive breakouts (Breakout, Rally, Moonshot)
    for (const type of POSITIVE_BREAKOUT_ORDER) {
      const threshold = getThresholdForType(thresholds, type);

      // Check if percent change exceeds threshold
      if (percentChange >= threshold) {
        // Check if this breakout already exists
        if (!hasExistingBreakout(existingBreakouts, symbol, type, sessionId)) {
          const breakout = createBreakoutEvent(
            type,
            symbol,
            assetName,
            sessionId,
            percentChange,
            currentPrice
          );
          if (breakout) {
            newBreakouts.push(breakout);
          }
        }
      }
    }
  } else if (percentChange < 0) {
    // Check negative busts (Bust, Crash, Meltdown)
    const absChange = Math.abs(percentChange);

    for (const type of NEGATIVE_BREAKOUT_ORDER) {
      const threshold = getThresholdForType(thresholds, type);

      // Check if absolute percent change exceeds threshold
      if (absChange >= threshold) {
        // Check if this breakout already exists
        if (!hasExistingBreakout(existingBreakouts, symbol, type, sessionId)) {
          const breakout = createBreakoutEvent(
            type,
            symbol,
            assetName,
            sessionId,
            percentChange,
            currentPrice
          );
          if (breakout) {
            newBreakouts.push(breakout);
          }
        }
      }
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

    // Count by positive/negative
    if (breakoutType.isPositive) {
      summary.positive++;
      summary.totalBonusPoints += breakoutType.points;
    } else {
      summary.negative++;
      summary.totalPenaltyPoints += breakoutType.points; // Already negative
    }

    // Count by type
    if (!summary.byType[type]) {
      summary.byType[type] = {
        count: 0,
        points: 0,
        ...breakoutType
      };
    }
    summary.byType[type].count++;
    summary.byType[type].points += breakoutType.points;

    // Count by symbol
    const symbol = breakout.symbol;
    if (!summary.bySymbol[symbol]) {
      summary.bySymbol[symbol] = {
        count: 0,
        points: 0,
        breakouts: []
      };
    }
    summary.bySymbol[symbol].count++;
    summary.bySymbol[symbol].points += breakoutType.points;
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

  const direction = breakout.percentChange >= 0 ? 'up' : 'down';
  const absChange = Math.abs(breakout.percentChange).toFixed(2);
  const pointsText = breakout.points >= 0 ? `+${breakout.points}` : `${breakout.points}`;

  let title, body;

  if (isYours) {
    // User's own breakout
    if (breakoutType.isPositive) {
      title = `${breakout.emoji} ${breakout.name}! ${breakout.symbol}`;
      body = `Your ${breakout.assetName || breakout.symbol} is ${direction} ${absChange}%! ${pointsText} points`;
    } else {
      title = `${breakout.emoji} ${breakout.name}! ${breakout.symbol}`;
      body = `Your ${breakout.assetName || breakout.symbol} dropped ${absChange}%. ${pointsText} points`;
    }
  } else {
    // Opponent's breakout
    if (breakoutType.isPositive) {
      title = `${breakout.emoji} Opponent ${breakout.name}!`;
      body = `Their ${breakout.assetName || breakout.symbol} hit a ${breakout.name.toLowerCase()} (${direction} ${absChange}%)`;
    } else {
      title = `${breakout.emoji} Opponent ${breakout.name}!`;
      body = `Their ${breakout.assetName || breakout.symbol} took a hit (${direction} ${absChange}%)`;
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
