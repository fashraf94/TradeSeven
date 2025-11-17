// src/services/battleTimer.js
// =====================================================
// Battle timing and completion logic with TEST_MODE
// =====================================================

/**
 * 🚀 TEST_MODE: Set to true for 24-hour battles (fast testing)
 * Set to false for 5-day battles (production)
 */
export const TEST_MODE = true; // Currently: 1-day battles for user testing

/**
 * Duration constants
 */
export const DAY_DURATION = TEST_MODE ? (24 * 60 * 60 * 1000) : (24 * 60 * 60 * 1000); // 24 hours for both test and production
export const BATTLE_DURATION = 1 * DAY_DURATION; // 1 day battles for testing (change to 5 for production)

// XP Constants
const BASE_XP_WIN = 100;
const BASE_XP_LOSS = 25;
const MAX_BONUS_XP = 100;

// =====================================================
// BATTLE STATUS
// =====================================================

/**
 * Checks if a battle has started
 */
export function hasBattleStarted(battle) {
  if (!battle || !battle.startDate) return false;
  return Date.now() >= new Date(battle.startDate).getTime();
}

/**
 * Checks if a battle has ended (passed endDate)
 */
export function hasBattleEnded(battle) {
  if (!battle || !battle.endDate) return false;
  return Date.now() >= new Date(battle.endDate).getTime();
}

/**
 * Checks if battle is complete (alias for hasBattleEnded)
 */
export function isBattleComplete(battle) {
  return hasBattleEnded(battle);
}

/**
 * Check if a battle just completed (useful for triggering winner logic)
 * @param {Object} battle - Battle object
 * @returns {boolean}
 */
export function isJustCompleted(battle) {
  if (!battle.opponent || battle.result) {
    return false; // Already processed or no opponent
  }

  return getBattleStatus(battle) === 'completed';
}

/**
 * Gets battle status
 * @returns 'waiting' | 'active' | 'completed'
 */
export function getBattleStatus(battle) {
  if (!battle) return 'waiting';

  // If no opponent yet, still waiting
  if (!battle.opponent) return 'waiting';

  // If startDate not set yet, waiting
  if (!battle.startDate) return 'waiting';

  // If battle has ended, completed
  if (hasBattleEnded(battle)) return 'completed';

  // If battle has started but not ended, active
  if (hasBattleStarted(battle)) return 'active';

  // Default to waiting
  return 'waiting';
}

// =====================================================
// TIME REMAINING
// =====================================================

/**
 * Gets remaining time in milliseconds
 */
export function getRemainingTime(battle) {
  if (!battle || !battle.endDate) return 0;
  const remaining = new Date(battle.endDate).getTime() - Date.now();
  return Math.max(0, remaining);
}

/**
 * Formats remaining time as human-readable string
 * Examples: "4 days, 3 hours", "23 hours, 45 minutes", "15 minutes"
 */
export function formatTimeRemaining(battle) {
  const remaining = getRemainingTime(battle);

  if (remaining === 0) {
    return 'Battle Complete';
  }

  const days = Math.floor(remaining / DAY_DURATION);
  const hours = Math.floor((remaining % DAY_DURATION) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  // For battles less than 5 days (like 24-hour test mode)
  if (days === 0) {
    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} min remaining`;
    }
    return `${minutes} min remaining`;
  }

  // For longer battles (5+ days)
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''} remaining`;
  }
  
  return `${minutes} min remaining`;
}

/**
 * Gets the current day of the battle (1-5)
 */
export function getCurrentDay(battle) {
  if (!battle || !battle.startDate) return 0;

  const startTime = new Date(battle.startDate).getTime();
  const currentTime = Date.now();
  const elapsed = currentTime - startTime;

  // Calculate which day we're on (1-5)
  const day = Math.floor(elapsed / DAY_DURATION) + 1;

  // Cap at day 5
  return Math.min(day, 5);
}

/**
 * Formats milliseconds as MM:SS
 */
export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// =====================================================
// WINNER DETERMINATION
// =====================================================

/**
 * Calculate portfolio return percentage
 * @param {Array} portfolio - Array of portfolio assets with amount and price
 * @param {Object} currentPrices - Current prices for all assets {symbol: price}
 * @returns {number} - Return percentage
 */
export function calculatePortfolioReturn(portfolio, currentPrices) {
  if (!portfolio || portfolio.length === 0) {
    return 0;
  }

  // Calculate initial value and current value
  let initialValue = 0;
  let currentValue = 0;

  portfolio.forEach(asset => {
    const shares = asset.amount / asset.price; // How many shares/coins bought
    const currentPrice = currentPrices[asset.symbol] || asset.price; // Current price or fallback

    initialValue += asset.amount; // Original dollar amount invested
    currentValue += shares * currentPrice; // Current value of those shares
  });

  if (initialValue === 0) return 0;

  // Return percentage: (current - initial) / initial * 100
  return ((currentValue - initialValue) / initialValue) * 100;
}

/**
 * Determine the winner of a completed battle
 * @param {Object} battle - Battle object with creatorPortfolio and opponentPortfolio
 * @param {Object} currentPrices - Current prices for all assets
 * @returns {Object} - { winner, loser, creatorReturn, opponentReturn, margin }
 */
export function determineWinner(battle, currentPrices) {
  const creatorReturn = calculatePortfolioReturn(battle.creatorPortfolio, currentPrices);
  const opponentReturn = calculatePortfolioReturn(battle.opponentPortfolio, currentPrices);

  const margin = Math.abs(creatorReturn - opponentReturn);

  if (creatorReturn > opponentReturn) {
    return {
      winner: battle.creator,
      loser: battle.opponent,
      creatorReturn: Number(creatorReturn.toFixed(2)),
      opponentReturn: Number(opponentReturn.toFixed(2)),
      margin: Number(margin.toFixed(2))
    };
  } else {
    return {
      winner: battle.opponent,
      loser: battle.creator,
      creatorReturn: Number(creatorReturn.toFixed(2)),
      opponentReturn: Number(opponentReturn.toFixed(2)),
      margin: Number(margin.toFixed(2))
    };
  }
}

// =====================================================
// XP CALCULATION
// =====================================================

/**
 * Calculate XP earned from a battle
 * @param {boolean} won - Did the player win?
 * @param {number} margin - Victory/loss margin (percentage points)
 * @returns {number} - XP earned
 */
export function calculateXP(won, margin) {
  if (won) {
    // Winner gets base XP + bonus based on margin
    const bonus = Math.min(margin * 10, MAX_BONUS_XP); // 10 XP per % margin, max 100
    return Math.floor(BASE_XP_WIN + bonus);
  } else {
    // Loser gets base XP (participation)
    return BASE_XP_LOSS;
  }
}

/**
 * Check if user should rank up based on XP
 * @param {number} xp - Current XP
 * @returns {string} - New rank
 */
export function determineRank(xp) {
  if (xp >= 5000) return 'Master';
  if (xp >= 2000) return 'Expert';
  if (xp >= 500) return 'Veteran';
  return 'Beginner';
}

// =====================================================
// BATTLE PROCESSING
// =====================================================

/**
 * Process a newly completed battle
 * Updates the battle with result data but does NOT update user stats
 * (User stats should be updated separately based on current user)
 * 
 * @param {Object} battle - Battle object
 * @param {Object} currentPrices - Current prices for all assets
 * @returns {Object} - Updated battle with result
 */
export function processCompletedBattle(battle, currentPrices) {
  // Determine winner
  const result = determineWinner(battle, currentPrices);

  // Calculate XP for both players
  const creatorIsWinner = result.winner === battle.creator;
  const creatorXP = calculateXP(creatorIsWinner, result.margin);
  const opponentXP = calculateXP(!creatorIsWinner, result.margin);

  // Return updated battle object
  return {
    ...battle,
    status: 'completed',
    completedAt: new Date().toISOString(),
    result: {
      ...result,
      xpAwarded: {
        [battle.creator]: creatorXP,
        [battle.opponent]: opponentXP
      }
    }
  };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get start and end timestamps for a battle
 * @param {Object} battle - Battle object
 * @returns {Object} - { startTime, endTime }
 */
export function getBattleTimes(battle) {
  const startTime = new Date(battle.startDate).getTime();
  const endTime = startTime + BATTLE_DURATION;

  return {
    startTime: new Date(startTime),
    endTime: new Date(endTime)
  };
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string}
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Get battle duration in human-readable format
 * @returns {string}
 */
export function getBattleDurationText() {
  if (TEST_MODE) {
    return '1 day';
  }
  return '5 days';
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  TEST_MODE,
  BATTLE_DURATION,
  DAY_DURATION,
  hasBattleStarted,
  hasBattleEnded,
  isBattleComplete,
  isJustCompleted,
  getBattleStatus,
  getRemainingTime,
  formatTimeRemaining,
  getCurrentDay,
  formatTime,
  calculatePortfolioReturn,
  determineWinner,
  calculateXP,
  determineRank,
  processCompletedBattle,
  getBattleTimes,
  formatDate,
  getBattleDurationText
};