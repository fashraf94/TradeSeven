// MarketClash TD Scoring - Session-Based Scoring Engine
// Calculates points for each trading session with breakout bonuses
//
// Sessions run throughout the trading day (Eastern Time):
// - MORNING_BELL: 9:30 AM - 11:30 AM
// - MIDDAY: 11:30 AM - 2:00 PM
// - POWER_HOUR: 2:00 PM - 4:00 PM
// - NIGHT_GAME: 4:00 PM - 8:00 PM (crypto only)

import { getVolatilityThresholds } from './volatilityService.js';

// ============================================
// SESSION DEFINITIONS
// ============================================

/**
 * Session time windows (Eastern Time)
 * Times stored as { hour, minute } in 24-hour format
 */
export const SESSIONS = {
  MORNING_BELL: {
    id: 'MORNING_BELL',
    name: 'Morning Bell',
    start: { hour: 9, minute: 30 },
    end: { hour: 11, minute: 30 },
    allowsStocks: true,
    allowsCrypto: true,
    description: 'Market open momentum'
  },
  MIDDAY: {
    id: 'MIDDAY',
    name: 'Midday',
    start: { hour: 11, minute: 30 },
    end: { hour: 14, minute: 0 },
    allowsStocks: true,
    allowsCrypto: true,
    description: 'Lunch hour trading'
  },
  POWER_HOUR: {
    id: 'POWER_HOUR',
    name: 'Power Hour',
    start: { hour: 14, minute: 0 },
    end: { hour: 16, minute: 0 },
    allowsStocks: true,
    allowsCrypto: true,
    description: 'Final push before close'
  },
  NIGHT_GAME: {
    id: 'NIGHT_GAME',
    name: 'Night Game',
    start: { hour: 16, minute: 0 },
    end: { hour: 20, minute: 0 },
    allowsStocks: false,
    allowsCrypto: true,
    description: 'After-hours crypto action'
  }
};

/**
 * Ordered list of sessions for iteration
 */
export const SESSION_ORDER = ['MORNING_BELL', 'MIDDAY', 'POWER_HOUR', 'NIGHT_GAME'];

// ============================================
// SCORING CONSTANTS
// ============================================

/** Points earned per 1% price change */
const POINTS_PER_PERCENT = 10;

/** BaggerBomb scoring constants (NEW LINEAR SYSTEM)
 * +15 points per threshold crossed (positive)
 * -10 points per threshold crossed (negative)
 */
const BAGGERBOMB_POINTS = 15;
const BUST_POINTS = -10;

/** Conviction multipliers based on portfolio allocation (PvP 1v1 only) */
const CONVICTION_TIERS = [
  { minAllocation: 15.1, maxAllocation: 100, multiplier: 1.3 },
  { minAllocation: 10.1, maxAllocation: 15, multiplier: 1.15 },
  { minAllocation: 0, maxAllocation: 10, multiplier: 1.0 }
];

/** @deprecated - OLD tiered system, kept for reference only
 * Use calculateBaggerBombs() for new linear scoring
 */
const BREAKOUT_BONUSES_LEGACY = {
  BREAKOUT: { multiplier: 1.0, points: 15, name: 'Breakout' },
  RALLY: { multiplier: 1.5, points: 30, name: 'Rally' },
  MOONSHOT: { multiplier: 2.0, points: 50, name: 'Moonshot' }
};

/** @deprecated - OLD tiered system, kept for reference only
 * Use calculateBaggerBombs() for new linear scoring
 */
const BUST_PENALTIES_LEGACY = {
  BUST: { multiplier: 1.0, points: -10, name: 'Bust' },
  CRASH: { multiplier: 1.5, points: -20, name: 'Crash' },
  MELTDOWN: { multiplier: 2.0, points: -35, name: 'Meltdown' }
};

/** Session-level bonuses */
const SESSION_BONUSES = {
  SESSION_WIN: 10,      // Beat opponent in a session
  GREEN_SWEEP: 20,      // All assets positive at session close
  CLEAN_SWEEP: 30       // Win all 4 sessions (bonus on top of session wins)
};

/**
 * Known crypto symbols for type detection
 * Exported for use by other services
 */
export const CRYPTO_SYMBOLS = new Set([
  // Major coins
  'BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'XRP', 'AVAX', 'DOT',
  'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'NEAR', 'APT',
  // Layer 2 / Alt L1
  'ARB', 'OP', 'SHIB', 'PEPE', 'BNB', 'TRX', 'TON', 'XLM',
  // DeFi / Infrastructure
  'ALGO', 'FIL', 'AAVE', 'MKR', 'CRV', 'SNX', 'COMP', 'VET',
  // Gaming / Metaverse
  'SAND', 'MANA', 'AXS', 'IMX', 'GALA', 'ENJ',
  // AI / Data
  'RNDR', 'RENDER', 'FET', 'OCEAN', 'TAO',
  // Stablecoins
  'USDT', 'USDC',
  // Draft crypto symbols (for OHLCV chart detection)
  'ICP', 'HBAR', 'XMR', 'ETC', 'SUI', 'SUI20947', 'INJ',
  'FLOKI', 'BONK', 'WIF', 'ASI', 'AGIX', 'AKT',
  '1INCH', 'SUSHI', 'CAKE', 'SEI',
  'DAI', 'FRAX', 'TUSD',
  'LDO', 'RPL', 'FXS', 'CBETH',
  'GRT', 'BAND', 'API3',
  'CRO', 'KCS', 'OKB', 'LEO',
  'ZEC', 'DASH', 'WBTC',
  'ENS', 'QNT', 'THETA', 'HNT', 'AR',
  'FTM', 'EGLD', 'RUNE', 'KAVA', 'CELO',
  // Verified replacement symbols
  'PENDLE', 'DYDX', 'CFX', 'SSV', 'MINA', 'STORJ', 'HIGH',
]);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a symbol is a cryptocurrency
 * @param {string} symbol - Asset symbol (e.g., 'BTC', 'AAPL')
 * @returns {boolean}
 */
export function isCrypto(symbol) {
  return CRYPTO_SYMBOLS.has(symbol.toUpperCase());
}

/**
 * Get current time in Eastern timezone
 * @returns {Date} Current time adjusted to ET
 */
function getEasternTime() {
  // Create date string in Eastern timezone
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

/**
 * Convert session time to minutes since midnight for comparison
 */
function timeToMinutes(time) {
  return time.hour * 60 + time.minute;
}

/**
 * Get current session based on Eastern Time
 * @returns {Object|null} Current session object or null if outside trading hours
 */
export function getCurrentSession() {
  const et = getEasternTime();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();
  const dayOfWeek = et.getDay(); // 0 = Sunday, 6 = Saturday

  // Check if it's a weekend (no stock sessions, but crypto NIGHT_GAME could run)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  for (const sessionId of SESSION_ORDER) {
    const session = SESSIONS[sessionId];
    const startMinutes = timeToMinutes(session.start);
    const endMinutes = timeToMinutes(session.end);

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      // On weekends, only return NIGHT_GAME (crypto only)
      if (isWeekend && sessionId !== 'NIGHT_GAME') {
        continue;
      }
      return session;
    }
  }

  return null;
}

/**
 * Get minutes remaining in a session
 * @param {string} sessionId - Session identifier
 * @returns {number} Minutes remaining, or 0 if session not active
 */
export function getSessionTimeRemaining(sessionId) {
  const session = SESSIONS[sessionId];
  if (!session) return 0;

  const et = getEasternTime();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();
  const endMinutes = timeToMinutes(session.end);
  const startMinutes = timeToMinutes(session.start);

  // Check if we're in this session
  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    return endMinutes - currentMinutes;
  }

  return 0;
}

/**
 * Get session start and end times as Date objects for a given date
 * @param {string} sessionId - Session identifier
 * @param {Date} date - Date to get session times for (defaults to today)
 * @returns {{ start: Date, end: Date }}
 */
export function getSessionTimes(sessionId, date = new Date()) {
  const session = SESSIONS[sessionId];
  if (!session) return null;

  // Create dates in Eastern timezone
  const etDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const start = new Date(etDate);
  start.setHours(session.start.hour, session.start.minute, 0, 0);

  const end = new Date(etDate);
  end.setHours(session.end.hour, session.end.minute, 0, 0);

  return { start, end };
}

// ============================================
// CONVICTION MULTIPLIER
// ============================================

/**
 * Get conviction multiplier based on portfolio allocation percentage
 * Higher allocation = more "conviction" = higher multiplier
 *
 * @param {number} allocationPercent - Percentage of portfolio (0-100)
 * @returns {number} Multiplier (1.0, 1.15, or 1.3)
 */
export function getConvictionMultiplier(allocationPercent) {
  // Clamp to valid range
  const allocation = Math.max(0, Math.min(100, allocationPercent));

  for (const tier of CONVICTION_TIERS) {
    if (allocation >= tier.minAllocation && allocation <= tier.maxAllocation) {
      return tier.multiplier;
    }
  }

  return 1.0; // Default fallback
}

// ============================================
// BAGGERBOMB SCORING (NEW LINEAR SYSTEM)
// ============================================

/**
 * Calculate BaggerBomb count for an asset's performance
 * NEW LINEAR SYSTEM: +15 per threshold crossed, -10 per negative threshold
 *
 * @param {number} percentChange - The asset's % change
 * @param {number} threshold - The asset's volatility threshold
 * @returns {object} { baggerBombs: number, busts: number, points: number }
 */
export function calculateBaggerBombs(percentChange, threshold) {
  if (!threshold || threshold <= 0) {
    return { baggerBombs: 0, busts: 0, points: 0 };
  }

  if (percentChange >= 0) {
    // Positive: count how many thresholds crossed
    const baggerBombs = Math.floor(percentChange / threshold);
    return {
      baggerBombs,
      busts: 0,
      points: baggerBombs * BAGGERBOMB_POINTS
    };
  } else {
    // Negative: count how many negative thresholds crossed
    const busts = Math.floor(Math.abs(percentChange) / threshold);
    return {
      baggerBombs: 0,
      busts,
      points: busts * BUST_POINTS
    };
  }
}

/**
 * Calculate total score for an asset in a session/day
 * NEW UNIFIED SCORING FUNCTION
 *
 * @param {number} percentChange - The asset's % change for the period
 * @param {number} threshold - The asset's volatility threshold
 * @param {number} allocation - The asset's allocation % (for conviction multiplier, PvP only)
 * @param {boolean} useConviction - Whether to apply conviction multipliers
 * @returns {object} Full scoring breakdown
 */
export function calculateAssetScore(percentChange, threshold, allocation = 11.1, useConviction = false) {
  // Base points from % return
  const basePoints = percentChange * POINTS_PER_PERCENT;

  // BaggerBomb/Bust points
  const { baggerBombs, busts, points: breakoutPoints } = calculateBaggerBombs(percentChange, threshold);

  // Conviction multiplier (PvP 1v1 only)
  let convictionMultiplier = 1.0;
  if (useConviction) {
    if (allocation > 15) convictionMultiplier = 1.3;
    else if (allocation > 10) convictionMultiplier = 1.15;
  }

  // Total score
  const rawScore = basePoints + breakoutPoints;
  const finalScore = rawScore * convictionMultiplier;

  return {
    percentChange: Number(percentChange.toFixed(2)),
    basePoints: Number(basePoints.toFixed(2)),
    baggerBombs,
    busts,
    breakoutPoints,
    convictionMultiplier,
    rawScore: Number(rawScore.toFixed(2)),
    finalScore: Number(finalScore.toFixed(2))
  };
}

// ============================================
// BASE POINTS CALCULATION
// ============================================

/**
 * Calculate base points for an asset's performance
 * Base Points = percentChange × POINTS_PER_PERCENT × convictionMultiplier
 *
 * @param {number} percentChange - Price change percentage (e.g., 2.5 for +2.5%)
 * @param {number} allocationPercent - Portfolio allocation percentage
 * @returns {number} Base points (can be negative)
 */
export function calculateBasePoints(percentChange, allocationPercent) {
  const convictionMultiplier = getConvictionMultiplier(allocationPercent);
  const basePoints = percentChange * POINTS_PER_PERCENT * convictionMultiplier;

  return Number(basePoints.toFixed(2));
}

// ============================================
// BREAKOUT BONUSES (NEW LINEAR SYSTEM)
// ============================================

/**
 * Calculate breakout bonuses for positive threshold breaches
 * NEW LINEAR SYSTEM: Each threshold crossed = +15 points (stacking)
 *
 * Example: Asset threshold = 2.8%
 * +2.8% = 1 BaggerBomb = +15 pts
 * +5.6% = 2 BaggerBombs = +30 pts
 * +8.4% = 3 BaggerBombs = +45 pts
 *
 * @param {number} percentChange - Price change percentage
 * @param {Object} thresholds - Threshold data from volatilityService
 * @returns {{ bonuses: Array, totalBonus: number, baggerBombs: number }}
 */
export function calculateBreakoutBonuses(percentChange, thresholds) {
  const bonuses = [];
  let totalBonus = 0;

  // Only positive moves can earn breakout bonuses
  if (percentChange <= 0) {
    return { bonuses, totalBonus, baggerBombs: 0 };
  }

  const threshold = thresholds?.threshold || 2.5;

  // NEW LINEAR: Count how many thresholds crossed
  const baggerBombs = Math.floor(percentChange / threshold);

  if (baggerBombs > 0) {
    // Calculate points using linear system
    totalBonus = baggerBombs * BAGGERBOMB_POINTS;

    // Create a single bonus entry showing total BaggerBombs
    bonuses.push({
      type: 'BAGGERBOMB',
      name: baggerBombs === 1 ? 'BaggerBomb' : `${baggerBombs}x BaggerBomb`,
      points: totalBonus,
      thresholdHit: threshold,
      thresholdsCrossed: baggerBombs,
      actualChange: percentChange
    });
  }

  return { bonuses, totalBonus, baggerBombs };
}

// ============================================
// BUST PENALTIES (NEW LINEAR SYSTEM)
// ============================================

/**
 * Calculate bust penalties for negative threshold breaches
 * NEW LINEAR SYSTEM: Each threshold crossed = -10 points (stacking)
 *
 * Example: Asset threshold = 2.8%
 * -2.8% = 1 Bust = -10 pts
 * -5.6% = 2 Busts = -15 pts
 * -8.4% = 3 Busts = -22.5 pts
 *
 * @param {number} percentChange - Price change percentage (negative)
 * @param {Object} thresholds - Threshold data from volatilityService
 * @returns {{ penalties: Array, totalPenalty: number, busts: number }}
 */
export function calculateBustPenalties(percentChange, thresholds) {
  const penalties = [];
  let totalPenalty = 0;

  // Only negative moves incur bust penalties
  if (percentChange >= 0) {
    return { penalties, totalPenalty, busts: 0 };
  }

  // Use absolute value for comparison
  const absChange = Math.abs(percentChange);
  const threshold = thresholds?.bustThreshold || thresholds?.threshold || 2.5;

  // NEW LINEAR: Count how many thresholds crossed
  const busts = Math.floor(absChange / threshold);

  if (busts > 0) {
    // Calculate points using linear system
    totalPenalty = busts * BUST_POINTS;

    // Create a single penalty entry showing total Busts
    penalties.push({
      type: 'BUST',
      name: busts === 1 ? 'Bust' : `${busts}x Bust`,
      points: totalPenalty,
      thresholdHit: threshold,
      thresholdsCrossed: busts,
      actualChange: percentChange
    });
  }

  return { penalties, totalPenalty, busts };
}

// ============================================
// ASSET SESSION SCORE
// ============================================

/**
 * Calculate complete session score for a single asset
 *
 * @param {Object} asset - Asset object with symbol and allocation
 * @param {number} sessionOpenPrice - Price at session start
 * @param {number} sessionClosePrice - Price at session end
 * @param {Object} thresholds - Threshold data for this asset
 * @param {number} totalPortfolioValue - Total portfolio value for allocation calc
 * @returns {Object} Detailed score breakdown
 */
export function calculateAssetSessionScore(
  asset,
  sessionOpenPrice,
  sessionClosePrice,
  thresholds,
  totalPortfolioValue
) {
  const { symbol, shares = 1, value = 0 } = asset;

  // Calculate allocation percentage
  const assetValue = value || (shares * sessionClosePrice);
  const allocationPercent = totalPortfolioValue > 0
    ? (assetValue / totalPortfolioValue) * 100
    : 10; // Default to 10% if no portfolio value

  // Calculate session percent change
  const percentChange = sessionOpenPrice > 0
    ? ((sessionClosePrice - sessionOpenPrice) / sessionOpenPrice) * 100
    : 0;

  // Calculate base points
  const basePoints = calculateBasePoints(percentChange, allocationPercent);

  // Calculate breakout bonuses (positive moves)
  const { bonuses, totalBonus } = calculateBreakoutBonuses(percentChange, thresholds);

  // Calculate bust penalties (negative moves)
  const { penalties, totalPenalty } = calculateBustPenalties(percentChange, thresholds);

  // Total score for this asset in this session
  const totalScore = basePoints + totalBonus + totalPenalty;

  return {
    symbol,
    sessionOpenPrice,
    sessionClosePrice,
    percentChange: Number(percentChange.toFixed(2)),
    allocationPercent: Number(allocationPercent.toFixed(2)),
    convictionMultiplier: getConvictionMultiplier(allocationPercent),
    basePoints,
    bonuses,
    totalBonus,
    penalties,
    totalPenalty,
    totalScore: Number(totalScore.toFixed(2)),
    isPositive: percentChange > 0,
    isCrypto: isCrypto(symbol)
  };
}

// ============================================
// PORTFOLIO SESSION SCORE
// ============================================

/**
 * Calculate total session score for an entire portfolio
 *
 * @param {Array} portfolio - Array of asset objects
 * @param {Object} sessionOpenPrices - Map of symbol -> open price
 * @param {Object} sessionClosePrices - Map of symbol -> close price
 * @param {Object} allThresholds - Map of symbol -> threshold data
 * @param {string} sessionId - Session identifier (e.g., 'MORNING_BELL')
 * @returns {Object} Complete session scoring breakdown
 */
export function calculateSessionScore(
  portfolio,
  sessionOpenPrices,
  sessionClosePrices,
  allThresholds,
  sessionId
) {
  const session = SESSIONS[sessionId];
  if (!session) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }

  // Filter assets eligible for this session
  const eligibleAssets = portfolio.filter(asset => {
    const crypto = isCrypto(asset.symbol);
    if (crypto) return session.allowsCrypto;
    return session.allowsStocks;
  });

  // Calculate total portfolio value for allocation percentages
  const totalPortfolioValue = eligibleAssets.reduce((sum, asset) => {
    const closePrice = sessionClosePrices[asset.symbol] || 0;
    return sum + (asset.shares || 1) * closePrice;
  }, 0);

  // Score each asset
  const assetScores = eligibleAssets.map(asset => {
    const openPrice = sessionOpenPrices[asset.symbol] || 0;
    const closePrice = sessionClosePrices[asset.symbol] || 0;
    const thresholds = allThresholds[asset.symbol] || {};

    return calculateAssetSessionScore(
      asset,
      openPrice,
      closePrice,
      thresholds,
      totalPortfolioValue
    );
  });

  // Aggregate totals
  const totalBasePoints = assetScores.reduce((sum, s) => sum + s.basePoints, 0);
  const totalBonusPoints = assetScores.reduce((sum, s) => sum + s.totalBonus, 0);
  const totalPenaltyPoints = assetScores.reduce((sum, s) => sum + s.totalPenalty, 0);

  // Check for Green Sweep (all assets positive)
  const allPositive = assetScores.length > 0 && assetScores.every(s => s.isPositive);
  const greenSweepBonus = allPositive ? SESSION_BONUSES.GREEN_SWEEP : 0;

  // Total session score
  const sessionTotal = totalBasePoints + totalBonusPoints + totalPenaltyPoints + greenSweepBonus;

  // Collect all bonuses and penalties for display
  const allBonuses = assetScores.flatMap(s =>
    s.bonuses.map(b => ({ ...b, symbol: s.symbol }))
  );
  const allPenalties = assetScores.flatMap(s =>
    s.penalties.map(p => ({ ...p, symbol: s.symbol }))
  );

  return {
    sessionId,
    sessionName: session.name,
    assetScores,
    eligibleAssetCount: eligibleAssets.length,
    totalBasePoints: Number(totalBasePoints.toFixed(2)),
    totalBonusPoints,
    totalPenaltyPoints,
    greenSweepBonus,
    allPositive,
    sessionTotal: Number(sessionTotal.toFixed(2)),
    allBonuses,
    allPenalties,
    calculatedAt: new Date().toISOString()
  };
}

// ============================================
// BATTLE SCORING (comparing two portfolios)
// ============================================

/**
 * Compare two portfolio session scores and determine winner
 *
 * @param {Object} playerScore - Player's session score from calculateSessionScore
 * @param {Object} opponentScore - Opponent's session score
 * @returns {Object} Battle result with session winner bonus applied
 */
export function compareSessionScores(playerScore, opponentScore) {
  const playerTotal = playerScore.sessionTotal;
  const opponentTotal = opponentScore.sessionTotal;

  const playerWins = playerTotal > opponentTotal;
  const isTie = playerTotal === opponentTotal;

  // Winner gets SESSION_WIN bonus
  const playerSessionBonus = playerWins ? SESSION_BONUSES.SESSION_WIN : 0;
  const opponentSessionBonus = !playerWins && !isTie ? SESSION_BONUSES.SESSION_WIN : 0;

  return {
    sessionId: playerScore.sessionId,
    playerTotal,
    opponentTotal,
    playerWins,
    isTie,
    playerSessionBonus,
    opponentSessionBonus,
    playerFinalScore: playerTotal + playerSessionBonus,
    opponentFinalScore: opponentTotal + opponentSessionBonus,
    margin: Math.abs(playerTotal - opponentTotal)
  };
}

/**
 * Calculate Clean Sweep bonus for winning all sessions
 *
 * @param {Array} sessionResults - Array of session comparison results
 * @returns {{ playerCleanSweep: boolean, opponentCleanSweep: boolean, playerBonus: number, opponentBonus: number }}
 */
export function calculateCleanSweepBonus(sessionResults) {
  const playerWins = sessionResults.filter(r => r.playerWins).length;
  const opponentWins = sessionResults.filter(r => !r.playerWins && !r.isTie).length;
  const totalSessions = sessionResults.length;

  const playerCleanSweep = playerWins === totalSessions && totalSessions === 4;
  const opponentCleanSweep = opponentWins === totalSessions && totalSessions === 4;

  return {
    playerCleanSweep,
    opponentCleanSweep,
    playerBonus: playerCleanSweep ? SESSION_BONUSES.CLEAN_SWEEP : 0,
    opponentBonus: opponentCleanSweep ? SESSION_BONUSES.CLEAN_SWEEP : 0
  };
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Get all scoring constants (for UI display)
 */
export function getScoringConstants() {
  return {
    POINTS_PER_PERCENT,
    BAGGERBOMB_POINTS,
    BUST_POINTS,
    CONVICTION_TIERS,
    SESSION_BONUSES
  };
}

/**
 * Fetch thresholds for a portfolio's assets
 * Convenience wrapper that separates stocks and crypto
 *
 * @param {Array} portfolio - Array of asset objects with symbol property
 * @returns {Object} Map of symbol -> threshold data
 */
export async function getPortfolioThresholds(portfolio) {
  const stockSymbols = portfolio
    .filter(a => !isCrypto(a.symbol))
    .map(a => a.symbol);

  const cryptoSymbols = portfolio
    .filter(a => isCrypto(a.symbol))
    .map(a => a.symbol);

  const [stockThresholds, cryptoThresholds] = await Promise.all([
    stockSymbols.length > 0 ? getVolatilityThresholds(stockSymbols, 'stock') : {},
    cryptoSymbols.length > 0 ? getVolatilityThresholds(cryptoSymbols, 'crypto') : {}
  ]);

  return { ...stockThresholds, ...cryptoThresholds };
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  // Session definitions
  SESSIONS,
  SESSION_ORDER,

  // NEW BaggerBomb scoring functions
  calculateBaggerBombs,
  calculateAssetScore,

  // Core scoring functions
  getConvictionMultiplier,
  calculateBasePoints,
  calculateBreakoutBonuses,
  calculateBustPenalties,
  calculateAssetSessionScore,
  calculateSessionScore,

  // Battle comparison
  compareSessionScores,
  calculateCleanSweepBonus,

  // Helpers
  isCrypto,
  getCurrentSession,
  getSessionTimeRemaining,
  getSessionTimes,
  getScoringConstants,
  getPortfolioThresholds,

  // Constants
  CRYPTO_SYMBOLS,
  BAGGERBOMB_POINTS,
  BUST_POINTS
};
