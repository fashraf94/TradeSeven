/**
 * Centralized configuration for earnings-related constants.
 * Consolidates hardcoded values from api/earnings/* and src/services/*
 *
 * @module earningsConfig
 */

// =============================================================================
// SECTOR BEAT RATES
// Historical sector earnings beat rates (used in odds calculation)
// =============================================================================

export const SECTOR_BEAT_RATES = {
  technology: 0.78,
  financial: 0.74,
  healthcare: 0.76,
  consumer_cyclical: 0.71,
  consumer_defensive: 0.73,
  industrial: 0.70,
  energy: 0.65,
  utilities: 0.69,
  materials: 0.67,
  real_estate: 0.68,
  communication: 0.75,
  default: 0.70
};

export const DEFAULT_BEAT_RATE = 0.70;

// =============================================================================
// MOMENTUM THRESHOLDS
// Used in odds.js for price momentum adjustment
// =============================================================================

export const MOMENTUM_THRESHOLDS = {
  // Price change thresholds (percentage)
  STRONG_BULLISH: 15,    // >= 15%
  BULLISH: 8,            // >= 8%
  SLIGHT_BULLISH: 3,     // >= 3%
  SLIGHT_BEARISH: -3,    // <= -3%
  BEARISH: -8,           // <= -8%
  STRONG_BEARISH: -15    // <= -15%
};

// Momentum adjustment factors for odds calculation
export const MOMENTUM_FACTORS = {
  strong_bullish: 1.12,   // priceChange >= 15%
  bullish: 1.07,          // priceChange >= 8%
  slight_bullish: 1.03,   // priceChange >= 3%
  neutral: 1.0,           // -3% < priceChange < 3%
  slight_bearish: 0.97,   // priceChange <= -3%
  bearish: 0.93,          // priceChange <= -8%
  strong_bearish: 0.88    // priceChange <= -15%
};

// =============================================================================
// IMPLIED VOLATILITY THRESHOLDS
// Expected move thresholds for IV-based adjustment
// =============================================================================

export const IV_THRESHOLDS = {
  VERY_HIGH: 12,      // High uncertainty, regress toward 50%
  ELEVATED: 8,        // Elevated uncertainty
  MODERATE: 5,        // Moderate uncertainty
  LOW: 3              // High confidence, amplify signal
};

export const IV_FACTORS = {
  very_high: 0.85,    // expectedMove >= 12%
  elevated: 0.92,     // expectedMove >= 8%
  moderate: 0.97,     // expectedMove >= 5%
  normal: 1.0,        // 3% < expectedMove < 5%
  high_confidence: 1.05  // expectedMove <= 3%
};

// =============================================================================
// PROBABILITY CALCULATION CONSTANTS
// =============================================================================

export const PROBABILITY_CONFIG = {
  SECTOR_BLEND_WEIGHT: 0.15,      // 15% sector, 85% calculated
  CALCULATED_WEIGHT: 0.85,
  MIN_PROBABILITY: 0.15,          // Clamp floor
  MAX_PROBABILITY: 0.95,          // Clamp ceiling
  MIN_QUARTERS_REQUIRED: 4        // Minimum quarters for stock-specific data
};

// =============================================================================
// MAGNITUDE BANDS
// Stock price reaction bands (used in earningsReactionsService.js)
// =============================================================================

export const MAGNITUDE_BANDS = {
  upBig: {
    id: 'upBig',
    label: 'Up Big',
    shortLabel: '+5%+',
    range: '> +5%',
    threshold: 5,       // Percentage threshold
    color: '#22c55e'
  },
  up: {
    id: 'up',
    label: 'Up',
    shortLabel: '+2-5%',
    range: '+2% to +5%',
    thresholdMin: 2,
    thresholdMax: 5,
    color: '#86efac'
  },
  flat: {
    id: 'flat',
    label: 'Flat',
    shortLabel: '0%',
    range: '-2% to +2%',
    thresholdMin: -2,
    thresholdMax: 2,
    color: '#9ca3af'
  },
  down: {
    id: 'down',
    label: 'Down',
    shortLabel: '-2-5%',
    range: '-5% to -2%',
    thresholdMin: -5,
    thresholdMax: -2,
    color: '#fca5a5'
  },
  downBig: {
    id: 'downBig',
    label: 'Down Big',
    shortLabel: '-5%+',
    range: '< -5%',
    threshold: -5,
    color: '#ef4444'
  }
};

// Magnitude band thresholds (percentage values)
export const MAGNITUDE_THRESHOLDS = {
  UP_BIG: 5,
  UP_MIN: 2,
  FLAT_RANGE: 2,  // +/- 2%
  DOWN_MIN: -2,
  DOWN_BIG: -5
};

// =============================================================================
// POINT VALUES FOR PREDICTIONS
// =============================================================================

export const POINT_VALUES = {
  fullBand: {
    description: 'Full band width',
    widthPercent: 100
  },
  halfBand: {
    description: '2% range',
    widthPercent: 50,
    width: 2
  },
  quarterBand: {
    description: '1% range',
    widthPercent: 25,
    width: 1
  }
};

// =============================================================================
// SECTOR DEFAULTS (Magnitude Probabilities)
// Default probability distributions for each sector
// =============================================================================

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

// =============================================================================
// MOMENTUM-MAGNITUDE ADJUSTMENTS
// How momentum affects magnitude probability distributions
// =============================================================================

export const MOMENTUM_MAGNITUDE_ADJUSTMENTS = {
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

// Momentum classification thresholds (for earningsReactionsService)
export const MOMENTUM_CLASS_THRESHOLDS = {
  STRONG_BULLISH: 15,   // >= 15%
  MODERATE_BULLISH: 5,  // >= 5%
  MODERATE_BEARISH: -5, // <= -5%
  STRONG_BEARISH: -15   // <= -15%
};

// =============================================================================
// CACHE TTLs
// =============================================================================

export const CACHE_TTLS = {
  IV_DATA: 24 * 60 * 60 * 1000,         // 24 hours in ms
  VERIFICATION: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  VERIFICATION_DAYS: 30                   // 30 days (for comparison)
};

// =============================================================================
// BATCH PROCESSING
// =============================================================================

export const BATCH_CONFIG = {
  BACKOFF_DELAYS: [
    2000,    // 2 seconds (normal delay)
    5000,    // 5 seconds (after first rate limit)
    15000,   // 15 seconds (after second)
    60000,   // 1 minute (after third)
    300000   // 5 minutes (after fourth)
  ],
  QUARTERS_PER_ITERATION: 4,
  DEFAULT_STOCKS_PER_BATCH: 5,
  MAX_SYNC_BATCH_COUNT: 400
};

// =============================================================================
// RATE LIMITS
// =============================================================================

export const RATE_LIMITS = {
  ODDS_API: {
    limit: 30,
    windowMs: 60000  // 1 minute
  }
};
