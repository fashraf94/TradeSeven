/**
 * Season Mode — Constants & Configuration (API-side)
 * Mirror of src/data/seasonConfig.js — keep in sync.
 * Referenced by: season crons, evaluation engine, prompt templates, validation
 */

export const SEASON_CONFIG = {
  STARTING_CAPITAL: 100000,
  TARGET_POSITIONS: 10,
  MIN_POSITIONS: 5,
  MAX_POSITIONS: 12,
  MAX_PIT_STOP_CHANGES: 3,
  MAX_SHORTLIST: 3,
  MAX_CONVERSATION_EXCHANGES: 30,
  MAX_USER_MESSAGE_LENGTH: 2000,
  TOTAL_WEEKS: 4,
};

export const SEASON_SCORING = {
  COUNTERFACTUAL_LOOKBACK_DAYS: 5,
  STALE_PRICE_WARNING_DAYS: 3,
  TIE_BREAK_THRESHOLD: 0.05,
  MIN_COUNTERFACTUAL_DAYS: 2,
  LOW_CONFIDENCE_TRIGGER_MIN: 3,
};

export const ENTRY_SCORE_WEIGHTS = {
  technicalScore:    0.25,
  fundamentalScore:  0.25,
  momentumScore:     0.20,
  instScore:         0.15,
  volumeScore:       0.15,
};

export const COMPOSITE_WEIGHTS = {
  sharpe:      0.30,
  drawdown:    0.25,
  consistency: 0.25,
  winRate:     0.20,
};

export const SEASON_API = {
  EODHD_RETRY_ATTEMPTS: 3,
  EODHD_RETRY_DELAYS: [2000, 4000, 8000],
  EODHD_SETTLE_DELAY_MINUTES: 30,
};

export const BLACK_SWAN = {
  POSITION_GAP_PCT: 15,
  SECTOR_COLLAPSE_PCT: -8,
  SPY_CRASH_PCT: -3,
};

export const SEASON_STATUS = {
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const ENTRY_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  WITHDRAWN: 'withdrawn',
  DISQUALIFIED: 'disqualified',
};

export const PIT_STOP_STATUS = {
  OPEN: 'open',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
};

export const RESULT_TYPES = {
  ENTRY_FILTER: 'ENTRY_FILTER',
  EXIT_SIGNAL: 'EXIT_SIGNAL',
  REBALANCE: 'REBALANCE',
  STRATEGY_MOD: 'STRATEGY_MOD',
};

export const PRIORITY = {
  HARD: 'hard',
  SOFT: 'soft',
};
