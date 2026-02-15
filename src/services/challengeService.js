// src/services/challengeService.js
// =====================================================
// Challenge system for MarketClash v2
// Includes: Double Down & Market Close challenges
// =====================================================

import { isMarketHoliday, formatDateString } from '../utils/marketHolidays';

/**
 * Challenge Types
 */
export const CHALLENGE_TYPES = {
  DOUBLE_DOWN: 'double_down',      // 2x gains/losses on specific asset
  MARKET_CLOSE: 'market_close',    // Predict S&P 500 or BTC Dominance direction
};

/**
 * Challenge settings
 */
export const CHALLENGE_SETTINGS = {
  // Double Down settings
  DOUBLE_DOWN: {
    START_HOUR_EST: 12,           // 12:00 PM EST
    ACCEPTANCE_WINDOW_MINUTES: 30, // 30 minutes to accept
    DURATION_HOURS: 2,             // 2 hours of 2x gains/losses
  },
  
  // Market Close settings
  MARKET_CLOSE: {
    START_HOUR_EST: 15,            // 3:00 PM EST (1 hour before close)
    ACCEPTANCE_WINDOW_MINUTES: 10,  // 10 minutes to accept
    REWARD_PERCENT: 1.5,           // +1.5% if correct
    PENALTY_PERCENT: 1.5,          // -1.5% if wrong
  },
};

/**
 * Challenge status enum
 */
export const CHALLENGE_STATUS = {
  PENDING: 'pending',      // Challenge available, not yet accepted
  ACTIVE: 'active',        // Challenge accepted, in progress
  WON: 'won',             // Player predicted correctly
  LOST: 'lost',           // Player predicted incorrectly
  EXPIRED: 'expired',     // Challenge window passed without acceptance
  COMPLETED: 'completed'  // Challenge resolved (for any outcome)
};

// =====================================================
// TIME UTILITIES
// =====================================================

/**
 * Get current time in EST
 * @returns {Date} Current time in EST
 */
function getCurrentEST() {
  const now = new Date();
  // Convert to EST (UTC-5) or EDT (UTC-4)
  // Using Intl API for proper timezone handling
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return estTime;
}

/**
 * Check if current time is a trading day (Mon-Fri, not holiday)
 * @returns {boolean}
 */
function isTradingDay() {
  const est = getCurrentEST();
  const dayOfWeek = est.getDay(); // 0 = Sunday, 6 = Saturday

  // Not Saturday or Sunday
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // Check NYSE holiday calendar
  return !isMarketHoliday(formatDateString(est));
}

/**
 * Get current hour in EST
 * @returns {number} Hour in EST (0-23)
 */
function getCurrentHourEST() {
  const est = getCurrentEST();
  return est.getHours();
}

// =====================================================
// CHALLENGE ELIGIBILITY
// =====================================================

/**
 * Check if Double Down challenge should appear
 * @param {Object} battle - Battle object
 * @returns {boolean}
 */
export function shouldShowDoubleDown(battle) {
  if (!battle || battle.status !== 'active') return false;
  
  const currentHour = getCurrentHourEST();
  const targetHour = CHALLENGE_SETTINGS.DOUBLE_DOWN.START_HOUR_EST;
  const windowMinutes = CHALLENGE_SETTINGS.DOUBLE_DOWN.ACCEPTANCE_WINDOW_MINUTES;
  
  const est = getCurrentEST();
  const currentMinutes = est.getMinutes();
  
  // Show if it's between 12:00 PM and 12:30 PM EST
  if (currentHour === targetHour && currentMinutes < windowMinutes) {
    return true;
  }
  
  return false;
}

/**
 * Check if Market Close challenge should appear
 * @param {Object} battle - Battle object
 * @param {string} portfolioType - 'stocks' or 'crypto'
 * @returns {boolean}
 */
export function shouldShowMarketClose(battle, portfolioType) {
  if (!battle || battle.status !== 'active') return false;
  
  const currentHour = getCurrentHourEST();
  const targetHour = CHALLENGE_SETTINGS.MARKET_CLOSE.START_HOUR_EST;
  const windowMinutes = CHALLENGE_SETTINGS.MARKET_CLOSE.ACCEPTANCE_WINDOW_MINUTES;
  
  const est = getCurrentEST();
  const currentMinutes = est.getMinutes();
  
  // For stocks: only on trading days
  if (portfolioType === 'stocks' && !isTradingDay()) {
    return false;
  }
  
  // For crypto: any day is fine
  
  // Show if it's between 3:00 PM and 3:10 PM EST
  if (currentHour === targetHour && currentMinutes < windowMinutes) {
    return true;
  }
  
  return false;
}

/**
 * Check if acceptance window has expired
 * @param {Object} challenge - Challenge object
 * @returns {boolean}
 */
export function hasAcceptanceWindowExpired(challenge) {
  if (!challenge || !challenge.appearsAt) return false;
  
  const windowMinutes = challenge.type === CHALLENGE_TYPES.DOUBLE_DOWN
    ? CHALLENGE_SETTINGS.DOUBLE_DOWN.ACCEPTANCE_WINDOW_MINUTES
    : CHALLENGE_SETTINGS.MARKET_CLOSE.ACCEPTANCE_WINDOW_MINUTES;
  
  const windowMs = windowMinutes * 60 * 1000;
  const expiryTime = new Date(challenge.appearsAt).getTime() + windowMs;
  
  return Date.now() > expiryTime;
}

// =====================================================
// DOUBLE DOWN CHALLENGE
// =====================================================

/**
 * Generate Double Down challenge
 * @param {Object} battle - Battle object
 * @param {string} username - Current user's username
 * @returns {Object} Challenge object
 */
export function generateDoubleDownChallenge(battle, username) {
  // Get user's portfolio
  const isCreator = battle.creator === username;
  const userPortfolio = isCreator ? battle.creatorPortfolio : battle.opponentPortfolio;
  
  if (!userPortfolio || userPortfolio.length === 0) return null;
  
  // Select random asset from user's portfolio
  const randomIndex = Math.floor(Math.random() * userPortfolio.length);
  const selectedAsset = userPortfolio[randomIndex];
  
  return {
    id: `challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: CHALLENGE_TYPES.DOUBLE_DOWN,
    battleId: battle.id,
    username: username,
    asset: {
      symbol: selectedAsset.symbol,
      name: selectedAsset.name
    },
    appearsAt: Date.now(),
    expiresAt: Date.now() + (CHALLENGE_SETTINGS.DOUBLE_DOWN.ACCEPTANCE_WINDOW_MINUTES * 60 * 1000),
    duration: CHALLENGE_SETTINGS.DOUBLE_DOWN.DURATION_HOURS * 60 * 60 * 1000,
    status: CHALLENGE_STATUS.PENDING,
    acceptedAt: null,
    completesAt: null,
    startingPrice: null,
    endingPrice: null,
    portfolioImpact: null
  };
}

/**
 * Accept Double Down challenge
 * @param {Object} challenge - Challenge object
 * @param {number} currentPrice - Current price of asset
 * @returns {Object} Updated challenge
 */
export function acceptDoubleDown(challenge, currentPrice) {
  const now = Date.now();
  const completesAt = now + challenge.duration;
  
  return {
    ...challenge,
    status: CHALLENGE_STATUS.ACTIVE,
    acceptedAt: now,
    completesAt: completesAt,
    startingPrice: currentPrice
  };
}

/**
 * Resolve Double Down challenge
 * @param {Object} challenge - Challenge object
 * @param {number} currentPrice - Current price of asset
 * @param {number} assetAllocation - How much of portfolio this asset represents (0-1)
 * @returns {Object} Updated challenge with result
 */
export function resolveDoubleDown(challenge, currentPrice, assetAllocation) {
  if (!challenge.startingPrice || !currentPrice) {
    return {
      ...challenge,
      status: CHALLENGE_STATUS.EXPIRED,
      portfolioImpact: 0
    };
  }
  
  // Calculate normal gain/loss
  const normalReturn = ((currentPrice - challenge.startingPrice) / challenge.startingPrice) * 100;
  
  // Double it
  const doubledReturn = normalReturn * 2;
  
  // Apply to portfolio (weighted by asset allocation)
  const portfolioImpact = doubledReturn * assetAllocation;
  
  return {
    ...challenge,
    status: CHALLENGE_STATUS.COMPLETED,
    endingPrice: currentPrice,
    normalReturn: Number(normalReturn.toFixed(2)),
    doubledReturn: Number(doubledReturn.toFixed(2)),
    portfolioImpact: Number(portfolioImpact.toFixed(2)),
    resolvedAt: Date.now()
  };
}

/**
 * Check if Double Down should resolve
 * @param {Object} challenge - Challenge object
 * @returns {boolean}
 */
export function shouldResolveDoubleDown(challenge) {
  if (!challenge || challenge.status !== CHALLENGE_STATUS.ACTIVE) return false;
  if (!challenge.completesAt) return false;
  
  return Date.now() >= challenge.completesAt;
}

// =====================================================
// MARKET CLOSE CHALLENGE
// =====================================================

/**
 * Generate Market Close challenge
 * @param {Object} battle - Battle object
 * @param {string} portfolioType - 'stocks' or 'crypto'
 * @param {string} username - Current user's username
 * @returns {Object} Challenge object
 */
export function generateMarketCloseChallenge(battle, portfolioType, username) {
  // Determine what we're predicting
  const market = portfolioType === 'stocks' ? 'S&P 500' : 'Bitcoin Dominance';
  const symbol = portfolioType === 'stocks' ? '^GSPC' : 'BTC.D';
  
  return {
    id: `challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: CHALLENGE_TYPES.MARKET_CLOSE,
    battleId: battle.id,
    username: username,
    market: market,
    symbol: symbol,
    portfolioType: portfolioType,
    appearsAt: Date.now(),
    expiresAt: Date.now() + (CHALLENGE_SETTINGS.MARKET_CLOSE.ACCEPTANCE_WINDOW_MINUTES * 60 * 1000),
    resolveTime: portfolioType === 'stocks' 
      ? getMarketCloseTime() 
      : Date.now() + (60 * 60 * 1000), // 1 hour for crypto
    status: CHALLENGE_STATUS.PENDING,
    acceptedAt: null,
    prediction: null, // 'up' or 'down'
    baselinePrice: null, // Set when FIRST user accepts
    closingPrice: null,
    reward: CHALLENGE_SETTINGS.MARKET_CLOSE.REWARD_PERCENT,
    penalty: CHALLENGE_SETTINGS.MARKET_CLOSE.PENALTY_PERCENT,
    portfolioImpact: null
  };
}

/**
 * Get market close time (4:00 PM EST today)
 * @returns {number} Timestamp of market close
 */
function getMarketCloseTime() {
  const est = getCurrentEST();
  const closeTime = new Date(est);
  closeTime.setHours(16, 0, 0, 0); // 4:00 PM EST
  
  return closeTime.getTime();
}

/**
 * Accept Market Close challenge
 * @param {Object} challenge - Challenge object
 * @param {string} prediction - 'up' or 'down'
 * @param {number} currentPrice - Current market price (used as baseline if first to accept)
 * @returns {Object} Updated challenge
 */
export function acceptMarketClose(challenge, prediction, currentPrice) {
  return {
    ...challenge,
    status: CHALLENGE_STATUS.ACTIVE,
    acceptedAt: Date.now(),
    prediction: prediction,
    baselinePrice: challenge.baselinePrice || currentPrice // Use existing if second user
  };
}

/**
 * Resolve Market Close challenge
 * @param {Object} challenge - Challenge object
 * @param {number} closingPrice - Price at market close
 * @returns {Object} Updated challenge with result
 */
export function resolveMarketClose(challenge, closingPrice) {
  if (!challenge.baselinePrice || !challenge.prediction) {
    return {
      ...challenge,
      status: CHALLENGE_STATUS.EXPIRED,
      portfolioImpact: 0
    };
  }
  
  const priceChange = closingPrice - challenge.baselinePrice;
  const actualMove = priceChange > 0 ? 'up' : 'down';
  const correct = challenge.prediction === actualMove;
  
  const portfolioImpact = correct ? challenge.reward : -challenge.penalty;
  
  return {
    ...challenge,
    status: correct ? CHALLENGE_STATUS.WON : CHALLENGE_STATUS.LOST,
    closingPrice: closingPrice,
    priceChange: Number(priceChange.toFixed(2)),
    portfolioImpact: portfolioImpact,
    resolvedAt: Date.now()
  };
}

/**
 * Check if Market Close should resolve
 * @param {Object} challenge - Challenge object
 * @returns {boolean}
 */
export function shouldResolveMarketClose(challenge) {
  if (!challenge || challenge.status !== CHALLENGE_STATUS.ACTIVE) return false;
  if (!challenge.resolveTime) return false;
  
  return Date.now() >= challenge.resolveTime;
}

// =====================================================
// CHALLENGE STORAGE
// =====================================================

const CHALLENGES_KEY = 'marketclash_challenges';

/**
 * Load all challenges from localStorage
 * @returns {Array} Array of challenge objects
 */
export function loadChallenges() {
  try {
    const raw = localStorage.getItem(CHALLENGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading challenges:', error);
    return [];
  }
}

/**
 * Save challenges to localStorage
 * @param {Array} challenges - Array of challenge objects
 */
export function saveChallenges(challenges) {
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));
    return true;
  } catch (error) {
    console.error('Error saving challenges:', error);
    return false;
  }
}

/**
 * Get active challenges for a battle
 * @param {string} battleId - Battle ID
 * @returns {Array} Array of active challenges
 */
export function getActiveChallenges(battleId) {
  const challenges = loadChallenges();
  return challenges.filter(c => 
    c.battleId === battleId && 
    (c.status === CHALLENGE_STATUS.ACTIVE || c.status === CHALLENGE_STATUS.PENDING)
  );
}

/**
 * Get challenges for specific user in a battle
 * @param {string} battleId - Battle ID
 * @param {string} username - Username
 * @returns {Array} Array of challenges for this user
 */
export function getUserChallenges(battleId, username) {
  const challenges = loadChallenges();
  return challenges.filter(c => 
    c.battleId === battleId && 
    c.username === username
  );
}

/**
 * Get opponent's challenges for a battle
 * @param {string} battleId - Battle ID
 * @param {string} opponentUsername - Opponent's username
 * @returns {Array} Array of opponent's challenges
 */
export function getOpponentChallenges(battleId, opponentUsername) {
  const challenges = loadChallenges();
  return challenges.filter(c => 
    c.battleId === battleId && 
    c.username === opponentUsername &&
    c.status === CHALLENGE_STATUS.ACTIVE // Only show active challenges
  );
}

/**
 * Add a new challenge
 * @param {Object} challenge - Challenge object
 */
export function addChallenge(challenge) {
  const challenges = loadChallenges();
  challenges.push(challenge);
  saveChallenges(challenges);
}

/**
 * Update an existing challenge
 * @param {Object} updatedChallenge - Updated challenge object
 */
export function updateChallenge(updatedChallenge) {
  const challenges = loadChallenges();
  const index = challenges.findIndex(c => c.id === updatedChallenge.id);
  
  if (index !== -1) {
    challenges[index] = updatedChallenge;
    saveChallenges(challenges);
  }
}

/**
 * Remove a challenge
 * @param {string} challengeId - Challenge ID
 */
export function removeChallenge(challengeId) {
  const challenges = loadChallenges();
  const filtered = challenges.filter(c => c.id !== challengeId);
  saveChallenges(filtered);
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get time remaining for acceptance window
 * @param {Object} challenge
 * @returns {number} Milliseconds remaining
 */
export function getAcceptanceTimeRemaining(challenge) {
  if (!challenge || !challenge.expiresAt) return 0;
  const remaining = challenge.expiresAt - Date.now();
  return Math.max(0, remaining);
}

/**
 * Get time remaining for active challenge
 * @param {Object} challenge
 * @returns {number} Milliseconds remaining
 */
export function getChallengeTimeRemaining(challenge) {
  if (!challenge) return 0;
  
  if (challenge.type === CHALLENGE_TYPES.DOUBLE_DOWN && challenge.completesAt) {
    const remaining = challenge.completesAt - Date.now();
    return Math.max(0, remaining);
  }
  
  if (challenge.type === CHALLENGE_TYPES.MARKET_CLOSE && challenge.resolveTime) {
    const remaining = challenge.resolveTime - Date.now();
    return Math.max(0, remaining);
  }
  
  return 0;
}

/**
 * Format time remaining as human-readable string
 * @param {number} ms - Milliseconds
 * @returns {string}
 */
export function formatTimeRemaining(ms) {
  if (ms <= 0) return 'Expired';
  
  const minutes = Math.floor(ms / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  CHALLENGE_TYPES,
  CHALLENGE_SETTINGS,
  CHALLENGE_STATUS,
  
  // Eligibility
  shouldShowDoubleDown,
  shouldShowMarketClose,
  hasAcceptanceWindowExpired,
  
  // Double Down
  generateDoubleDownChallenge,
  acceptDoubleDown,
  resolveDoubleDown,
  shouldResolveDoubleDown,
  
  // Market Close
  generateMarketCloseChallenge,
  acceptMarketClose,
  resolveMarketClose,
  shouldResolveMarketClose,
  
  // Storage
  loadChallenges,
  saveChallenges,
  getActiveChallenges,
  getUserChallenges,
  getOpponentChallenges,
  addChallenge,
  updateChallenge,
  removeChallenge,
  
  // Utilities
  getAcceptanceTimeRemaining,
  getChallengeTimeRemaining,
  formatTimeRemaining
};
