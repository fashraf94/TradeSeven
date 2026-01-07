// /src/services/scoring/index.js

/**
 * BaggerBomb Scoring System
 * Centralized exports for all scoring functionality
 */

// Constants
export * from './constants';

// Core Calculator
export {
  calculateBaggerBombs,
  calculateBusts,
  calculateBreakoutPoints,
  calculateAssetScore,
  calculateSnakeDraftAssetScore,
  calculatePortfolioScore
} from './baggerBombCalculator';

// Timing Utilities
export {
  toEasternTime,
  isWeekday,
  isMarketHours,
  isStockTradingHours,
  getCurrentSession,
  getNextSession,
  isWithinCommitmentWindow,
  getCommitmentDeadlineInfo,
  getSubstitutionWindowStatus,
  getNextTradingDay,
  getTodayDeadline,
  formatRemainingTime
} from './timingUtils';

// Breakout Detection
export {
  BreakoutTracker,
  createPortfolioTrackers,
  updateTrackers,
  formatBreakoutNotification
} from './breakoutDetection';
