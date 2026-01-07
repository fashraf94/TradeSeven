// /src/services/scoring/constants.js

/**
 * BaggerBomb Scoring System Constants
 * Single source of truth for all scoring values
 */

// ===========================================
// CORE BAGGERBOMB SCORING
// ===========================================

export const BAGGERBOMB = {
  // Points per threshold crossed (positive direction)
  POINTS_PER_THRESHOLD: 15,

  // Points per threshold crossed (negative direction)
  BUST_POINTS_PER_THRESHOLD: -7.5,
};

// ===========================================
// CONVICTION MULTIPLIERS (PvP 1v1 Only)
// ===========================================

export const CONVICTION = {
  LOW: {
    minAllocation: 7.5,
    maxAllocation: 10.0,
    multiplier: 1.0
  },
  MEDIUM: {
    minAllocation: 10.1,
    maxAllocation: 15.0,
    multiplier: 1.15
  },
  HIGH: {
    minAllocation: 15.1,
    maxAllocation: 20.0,
    multiplier: 1.3
  }
};

/**
 * Get conviction multiplier based on allocation percentage
 * @param {number} allocation - Allocation percentage (7.5-20)
 * @returns {number} Multiplier (1.0, 1.15, or 1.3)
 */
export const getConvictionMultiplier = (allocation) => {
  if (allocation >= CONVICTION.HIGH.minAllocation) return CONVICTION.HIGH.multiplier;
  if (allocation >= CONVICTION.MEDIUM.minAllocation) return CONVICTION.MEDIUM.multiplier;
  return CONVICTION.LOW.multiplier;
};

// ===========================================
// SESSION BONUSES (PvP 1v1 Only)
// ===========================================

export const SESSION_BONUS = {
  WIN_SESSION: 10,        // Win a session
  GREEN_SWEEP: 20,        // All assets positive in session
  CLEAN_SWEEP: 30         // Win session + all assets positive
};

// ===========================================
// TRAINING MODE ADJUSTMENTS
// ===========================================

export const TRAINING = {
  // Reduce thresholds by 30% for more action in shorter time
  THRESHOLD_REDUCTION: 0.3,

  // No conviction multipliers in training
  USE_CONVICTION: false,

  // No session bonuses in training
  USE_SESSION_BONUSES: false,

  // No bench/substitutions in training
  HAS_BENCH: false
};

// ===========================================
// SNAKE DRAFT ADJUSTMENTS
// ===========================================

export const SNAKE_DRAFT = {
  // No conviction multipliers (equal weight assets)
  USE_CONVICTION: false,

  // No session bonuses
  USE_SESSION_BONUSES: false,

  // Number of assets per player
  ASSETS_PER_PLAYER: 9,

  // Base points multiplier for % return
  PERCENT_MULTIPLIER: 10  // 1% = 10 points
};

// ===========================================
// XP REWARDS
// ===========================================

export const XP_REWARDS = {
  // PvP 1v1
  PVP_WIN: 150,
  PVP_LOSS: 50,

  // Training
  TRAINING_WIN: 10,
  TRAINING_LOSS: 5,

  // Snake Draft
  SNAKE_FIRST: 200,
  SNAKE_SECOND: 125,
  SNAKE_THIRD: 75,
  SNAKE_FOURTH: 50
};

// ===========================================
// SESSION TIMING (Eastern Time)
// ===========================================

export const SESSIONS = {
  MORNING_BELL: {
    name: 'Morning Bell',
    start: { hour: 9, minute: 30 },
    end: { hour: 11, minute: 30 }
  },
  MIDDAY: {
    name: 'Midday',
    start: { hour: 11, minute: 30 },
    end: { hour: 14, minute: 0 }
  },
  POWER_HOUR: {
    name: 'Power Hour',
    start: { hour: 14, minute: 0 },
    end: { hour: 16, minute: 0 }
  },
  NIGHT_GAME: {
    name: 'Night Game',
    start: { hour: 16, minute: 0 },
    end: { hour: 20, minute: 0 },
    cryptoOnly: true
  }
};

export const SESSION_ORDER = ['MORNING_BELL', 'MIDDAY', 'POWER_HOUR', 'NIGHT_GAME'];

// ===========================================
// PVP BATTLE TIMING (Eastern Time)
// ===========================================

export const PVP_TIMING = {
  // Commitment deadline: 3:55 PM ET
  COMMITMENT_DEADLINE: { hour: 15, minute: 55 },

  // Baseline price lock: 4:00 PM ET (market close)
  BASELINE_LOCK: { hour: 16, minute: 0 },

  // Battle start: 9:30 AM ET (next market open)
  BATTLE_START: { hour: 9, minute: 30 },

  // Battle end: 8:00 PM ET (same day)
  BATTLE_END: { hour: 20, minute: 0 }
};

// ===========================================
// SUBSTITUTION RULES (PvP 1v1 Only)
// ===========================================

export const SUBSTITUTION = {
  MAX_PER_BATTLE: 2,

  WINDOWS: [
    {
      name: 'Window 1',
      start: { hour: 11, minute: 30 },
      end: { hour: 11, minute: 45 }
    },
    {
      name: 'Window 2',
      start: { hour: 14, minute: 0 },
      end: { hour: 14, minute: 15 }
    }
  ]
};

// ===========================================
// PORTFOLIO CONSTRAINTS
// ===========================================

export const PORTFOLIO = {
  // PvP 1v1 constraints
  PVP: {
    MIN_STOCKS: 6,
    MAX_STOCKS: 12,
    CRYPTO_COUNT: 1,
    CRYPTO_ALLOCATION: 10,  // Fixed 10%
    MIN_ALLOCATION: 7.5,
    MAX_ALLOCATION: 20,
    BENCH_STOCKS: 4,
    BENCH_CRYPTO: 1
  },

  // Snake Draft constraints
  SNAKE_DRAFT: {
    TOTAL_ASSETS: 9,
    STEADY_COUNT: 3,
    RISKY_COUNT: 3,
    DEFENSIVE_COUNT: 3
  }
};

// ===========================================
// THRESHOLD DEFAULTS (Fallbacks)
// ===========================================

export const DEFAULT_THRESHOLDS = {
  STOCK: 3.0,      // 3% default for stocks
  CRYPTO: 5.0,     // 5% default for crypto

  // Ranges for reference
  STOCK_MIN: 1.0,
  STOCK_MAX: 15.0,
  CRYPTO_MIN: 2.0,
  CRYPTO_MAX: 25.0
};
