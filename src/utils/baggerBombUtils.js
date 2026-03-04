// baggerBombUtils.js - Utility functions for BaggerBomb scoring and history tracking
// Handles threshold crossing detection, history updates, and session timing

import {
  THRESHOLD_MULTIPLIERS as _THRESHOLD_MULTIPLIERS,
  THRESHOLD_POINTS as _THRESHOLD_POINTS,
  CONVICTION_MULTIPLIERS,
} from '../constants/baggerBombScoring';

// ==================== CONSTANTS ====================
// Re-exported from single source of truth (src/constants/baggerBombScoring.js)

export const THRESHOLD_MULTIPLIERS = _THRESHOLD_MULTIPLIERS;
export const THRESHOLD_POINTS = _THRESHOLD_POINTS;

// Session definitions (Eastern Time)
export const SESSION_CONFIG = {
  morning: {
    id: 'MORNING_BELL',
    label: 'Morning Bell',
    shortLabel: 'Morning',
    icon: '🌅',
    startHour: 9.5,   // 9:30 AM ET
    endHour: 11.5,    // 11:30 AM ET
    allowsStocks: true,
    allowsCrypto: true,
  },
  midday: {
    id: 'MIDDAY',
    label: 'Midday',
    shortLabel: 'Midday',
    icon: '☀️',
    startHour: 11.5,  // 11:30 AM ET
    endHour: 14,      // 2:00 PM ET
    allowsStocks: true,
    allowsCrypto: true,
  },
  power: {
    id: 'POWER_HOUR',
    label: 'Power Hour',
    shortLabel: 'Power',
    icon: '⚡',
    startHour: 14,    // 2:00 PM ET
    endHour: 16,      // 4:00 PM ET
    allowsStocks: true,
    allowsCrypto: true,
  },
  night: {
    id: 'NIGHT_GAME',
    label: 'Night Game',
    shortLabel: 'Night',
    icon: '🌙',
    startHour: 16,    // 4:00 PM ET
    endHour: 20,      // 8:00 PM ET
    allowsStocks: false,
    allowsCrypto: true,
  },
};

export const SESSION_ORDER = ['morning', 'midday', 'power', 'night'];
export const SESSION_ID_ORDER = ['MORNING_BELL', 'MIDDAY', 'POWER_HOUR', 'NIGHT_GAME'];

// ==================== HISTORY TRACKING ====================

/**
 * Check if history needs updating and return the updated history, or null if unchanged.
 * Only returns a new object when maxMultiplier increased or minMultiplier decreased,
 * preventing unnecessary Firebase writes on every price poll.
 * @param {number} currentMultiplier - Current multiplier (priceChange / baseATR)
 * @param {Object} prevHistory - Previous history { maxMultiplier, minMultiplier, badges, events }
 * @returns {Object|null} Updated history if changed, null if no update needed
 */
export function getHistoryUpdateIfChanged(currentMultiplier, prevHistory = {}) {
  const prevMax = prevHistory.maxMultiplier || 0;
  const prevMin = prevHistory.minMultiplier || 0;

  const newMax = Math.max(prevMax, currentMultiplier);
  const newMin = Math.min(prevMin, currentMultiplier);

  if (newMax > prevMax || newMin < prevMin) {
    return {
      ...prevHistory,
      maxMultiplier: newMax,
      minMultiplier: newMin,
      badges: prevHistory.badges ? [...prevHistory.badges] : [],
      events: prevHistory.events ? [...prevHistory.events] : [],
    };
  }

  return null; // No change needed
}

/**
 * Update asset history with new multiplier, tracking max/min reached
 * @param {string} symbol - Asset symbol
 * @param {number} currentMultiplier - Current multiplier (priceChange / baseATR)
 * @param {Object} prevHistory - Previous history { maxMultiplier, minMultiplier, badges }
 * @returns {Object} Updated history
 */
export function updateAssetHistory(symbol, currentMultiplier, prevHistory = {}) {
  const newHistory = {
    maxMultiplier: prevHistory.maxMultiplier || 0,
    minMultiplier: prevHistory.minMultiplier || 0,
    badges: prevHistory.badges ? [...prevHistory.badges] : [],
    events: prevHistory.events ? [...prevHistory.events] : [],
  };

  // Track max positive multiplier
  if (currentMultiplier > newHistory.maxMultiplier) {
    newHistory.maxMultiplier = currentMultiplier;
  }

  // Track min negative multiplier
  if (currentMultiplier < newHistory.minMultiplier) {
    newHistory.minMultiplier = currentMultiplier;
  }

  return newHistory;
}

/**
 * Detect if a threshold was crossed between previous and current multiplier
 * @param {number} prevMultiplier - Previous multiplier
 * @param {number} currentMultiplier - Current multiplier
 * @returns {Object|null} Crossed threshold info or null
 */
export function detectThresholdCross(prevMultiplier, currentMultiplier) {
  const crossedThresholds = [];

  // Check positive thresholds
  if (currentMultiplier >= THRESHOLD_MULTIPLIERS.bagger && prevMultiplier < THRESHOLD_MULTIPLIERS.bagger) {
    crossedThresholds.push({ name: 'bagger', multiplier: THRESHOLD_MULTIPLIERS.bagger, points: THRESHOLD_POINTS.bagger });
  }
  if (currentMultiplier >= THRESHOLD_MULTIPLIERS.doubleBagger && prevMultiplier < THRESHOLD_MULTIPLIERS.doubleBagger) {
    crossedThresholds.push({ name: 'doubleBagger', multiplier: THRESHOLD_MULTIPLIERS.doubleBagger, points: THRESHOLD_POINTS.doubleBagger });
  }
  if (currentMultiplier >= THRESHOLD_MULTIPLIERS.tenBagger && prevMultiplier < THRESHOLD_MULTIPLIERS.tenBagger) {
    crossedThresholds.push({ name: 'tenBagger', multiplier: THRESHOLD_MULTIPLIERS.tenBagger, points: THRESHOLD_POINTS.tenBagger });
  }

  // Check negative thresholds
  if (currentMultiplier <= THRESHOLD_MULTIPLIERS.bust && prevMultiplier > THRESHOLD_MULTIPLIERS.bust) {
    crossedThresholds.push({ name: 'bust', multiplier: THRESHOLD_MULTIPLIERS.bust, points: THRESHOLD_POINTS.bust });
  }
  if (currentMultiplier <= THRESHOLD_MULTIPLIERS.crash && prevMultiplier > THRESHOLD_MULTIPLIERS.crash) {
    crossedThresholds.push({ name: 'crash', multiplier: THRESHOLD_MULTIPLIERS.crash, points: THRESHOLD_POINTS.crash });
  }
  if (currentMultiplier <= THRESHOLD_MULTIPLIERS.meltdown && prevMultiplier > THRESHOLD_MULTIPLIERS.meltdown) {
    crossedThresholds.push({ name: 'meltdown', multiplier: THRESHOLD_MULTIPLIERS.meltdown, points: THRESHOLD_POINTS.meltdown });
  }

  return crossedThresholds.length > 0 ? crossedThresholds : null;
}

/**
 * Get badges earned based on history
 * @param {Object} history - History with maxMultiplier and minMultiplier
 * @returns {string[]} Array of badge names
 */
export function getBadgesFromHistory(history) {
  const badges = [];

  // Positive badges
  if (history.maxMultiplier >= THRESHOLD_MULTIPLIERS.bagger) badges.push('bagger');
  if (history.maxMultiplier >= THRESHOLD_MULTIPLIERS.doubleBagger) badges.push('doubleBagger');
  if (history.maxMultiplier >= THRESHOLD_MULTIPLIERS.tenBagger) badges.push('tenBagger');

  // Negative badges
  if (history.minMultiplier <= THRESHOLD_MULTIPLIERS.bust) badges.push('bust');
  if (history.minMultiplier <= THRESHOLD_MULTIPLIERS.crash) badges.push('crash');
  if (history.minMultiplier <= THRESHOLD_MULTIPLIERS.meltdown) badges.push('meltdown');

  return badges;
}

/**
 * Detect if a stock is in the "Red Zone" — within 25% of its next uncrossed threshold.
 * @param {number} currentMultiplier - Current price multiplier (priceChange / baseATR)
 * @param {string[]} existingBadges - Badges already earned for this asset
 * @returns {Object|null} { targetThreshold, targetMultiple, direction, progress } or null
 */
export function detectRedZone(currentMultiplier, existingBadges = []) {
  const POSITIVE_THRESHOLDS = [
    { name: 'bagger', mult: THRESHOLD_MULTIPLIERS.bagger },
    { name: 'doubleBagger', mult: THRESHOLD_MULTIPLIERS.doubleBagger },
    { name: 'tenBagger', mult: THRESHOLD_MULTIPLIERS.tenBagger },
  ];
  const NEGATIVE_THRESHOLDS = [
    { name: 'bust', mult: THRESHOLD_MULTIPLIERS.bust },
    { name: 'crash', mult: THRESHOLD_MULTIPLIERS.crash },
    { name: 'meltdown', mult: THRESHOLD_MULTIPLIERS.meltdown },
  ];

  // Check positive direction — find the next uncrossed positive threshold
  if (currentMultiplier > 0) {
    const nextPositive = POSITIVE_THRESHOLDS.find(
      t => !existingBadges.includes(t.name) && currentMultiplier < t.mult
    );
    if (nextPositive) {
      const zoneStart = nextPositive.mult * 0.75;
      if (currentMultiplier >= zoneStart) {
        const progress = ((currentMultiplier - zoneStart) / (nextPositive.mult * 0.25)) * 100;
        return {
          targetThreshold: nextPositive.name,
          targetMultiple: nextPositive.mult,
          direction: 'positive',
          progress: Math.min(Math.round(progress), 100),
        };
      }
    }
  }

  // Check negative direction — find the next uncrossed negative threshold
  if (currentMultiplier < 0) {
    const nextNegative = NEGATIVE_THRESHOLDS.find(
      t => !existingBadges.includes(t.name) && currentMultiplier > t.mult
    );
    if (nextNegative) {
      const zoneStart = nextNegative.mult * 0.75; // e.g., -0.75 for bust at -1.0
      if (currentMultiplier <= zoneStart) {
        const progress = ((zoneStart - currentMultiplier) / (Math.abs(nextNegative.mult) * 0.25)) * 100;
        return {
          targetThreshold: nextNegative.name,
          targetMultiple: nextNegative.mult,
          direction: 'negative',
          progress: Math.min(Math.round(progress), 100),
        };
      }
    }
  }

  return null;
}

/**
 * Check if a stock is in the Orange Zone — too close to a threshold to swap.
 * A stock is locked when it's within 0.5 percentage points of its next threshold
 * in either direction (positive or negative).
 *
 * @param {number} currentMultiplier - priceChange / baseATR
 * @param {number} baseATR - The asset's volatility threshold (percentage)
 * @returns {{ locked: boolean, direction: string|null, distancePercent: number|null, message: string|null }}
 */
export function isSwapLocked(currentMultiplier, baseATR) {
  const ORANGE_ZONE_PCT = 0.5;
  if (!baseATR || baseATR <= 0) return { locked: false, direction: null, distancePercent: null, message: null };

  const POSITIVE_THRESHOLDS = [
    THRESHOLD_MULTIPLIERS.bagger,       // 1.0
    THRESHOLD_MULTIPLIERS.doubleBagger,  // 1.5
    THRESHOLD_MULTIPLIERS.tenBagger,     // 2.0
  ];
  const NEGATIVE_THRESHOLDS = [
    THRESHOLD_MULTIPLIERS.bust,      // -1.0
    THRESHOLD_MULTIPLIERS.crash,     // -1.5
    THRESHOLD_MULTIPLIERS.meltdown,  // -2.0
  ];

  // Check positive direction: find next threshold above current multiplier
  const nextPositive = POSITIVE_THRESHOLDS.find(t => currentMultiplier < t);
  if (nextPositive != null) {
    const distPct = (nextPositive - currentMultiplier) * baseATR;
    if (distPct <= ORANGE_ZONE_PCT && distPct > 0) {
      return { locked: true, direction: 'positive', distancePercent: distPct, message: 'approaching BaggerBomb' };
    }
  }

  // Check negative direction: find next threshold below current multiplier
  const nextNegative = NEGATIVE_THRESHOLDS.find(t => currentMultiplier > t);
  if (nextNegative != null) {
    const distPct = (currentMultiplier - nextNegative) * baseATR;
    if (distPct <= ORANGE_ZONE_PCT && distPct > 0) {
      return { locked: true, direction: 'negative', distancePercent: distPct, message: 'approaching Bust' };
    }
  }

  return { locked: false, direction: null, distancePercent: null, message: null };
}

/**
 * Calculate total points from badges
 * @param {string[]} badges - Array of badge names
 * @returns {number} Total points
 */
export function calculatePoints(badges) {
  return badges.reduce((total, badge) => {
    return total + (THRESHOLD_POINTS[badge] || 0);
  }, 0);
}

// ==================== SESSION TIMING ====================

/**
 * Get current Eastern Time
 * @returns {Object} { hour, minute, second, decimalHour }
 */
export function getEasternTime() {
  const now = new Date();

  // Get UTC components
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcSecond = now.getUTCSeconds();

  // Convert to ET (simplified: UTC-5, doesn't account for DST)
  // For production, use a proper timezone library
  const etOffset = -5;
  const etHour = (utcHour + etOffset + 24) % 24;

  return {
    hour: etHour,
    minute: utcMinute,
    second: utcSecond,
    decimalHour: etHour + utcMinute / 60 + utcSecond / 3600,
  };
}

/**
 * Get current session based on time
 * @returns {string|null} Session key ('morning', 'midday', 'power', 'night') or null
 */
export function getCurrentSession() {
  const { decimalHour } = getEasternTime();

  for (const [key, session] of Object.entries(SESSION_CONFIG)) {
    if (decimalHour >= session.startHour && decimalHour < session.endHour) {
      return key;
    }
  }

  return null; // Outside trading hours
}

/**
 * Get current session ID (for Firebase compatibility)
 * @returns {string} Session ID like 'MORNING_BELL' or empty string
 */
export function getCurrentSessionId() {
  const sessionKey = getCurrentSession();
  if (!sessionKey) return '';
  return SESSION_CONFIG[sessionKey]?.id || '';
}

/**
 * Get seconds remaining in current session
 * @returns {number} Seconds remaining, or 0 if outside session
 */
export function getSessionTimeRemaining() {
  const sessionKey = getCurrentSession();
  if (!sessionKey) return 0;

  const session = SESSION_CONFIG[sessionKey];
  const { decimalHour } = getEasternTime();

  const remainingHours = session.endHour - decimalHour;
  if (remainingHours <= 0) return 0;

  return Math.floor(remainingHours * 3600);
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 * @param {number} totalSeconds - Total seconds
 * @param {boolean} includeHours - Include hours in format
 * @returns {string} Formatted time string
 */
export function formatTimeRemaining(totalSeconds, includeHours = false) {
  if (!totalSeconds || totalSeconds <= 0) return '--:--';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (includeHours || hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Get session status for all sessions
 * @param {string} currentSessionKey - Current session key
 * @param {string[]} completedSessions - Array of completed session IDs
 * @returns {Object} Map of session key to status
 */
export function getSessionStatuses(currentSessionKey, completedSessions = []) {
  const statuses = {};

  SESSION_ORDER.forEach((key) => {
    const session = SESSION_CONFIG[key];
    const sessionId = session.id;

    if (completedSessions.includes(sessionId)) {
      statuses[key] = 'completed';
    } else if (key === currentSessionKey) {
      statuses[key] = 'active';
    } else {
      // Check if session is upcoming or missed
      const currentIndex = SESSION_ORDER.indexOf(currentSessionKey);
      const thisIndex = SESSION_ORDER.indexOf(key);

      if (currentSessionKey && thisIndex < currentIndex) {
        statuses[key] = 'missed';
      } else {
        statuses[key] = 'locked';
      }
    }
  });

  return statuses;
}

// ==================== PORTFOLIO HELPERS ====================

/**
 * Transform new tier-based portfolio to flat array (for scoring compatibility)
 * @param {Object} portfolio - { star: [], core: [], support: [] }
 * @returns {Object[]} Flat array of assets with tier info
 */
export function flattenPortfolio(portfolio) {
  if (!portfolio) return [];

  const flat = [];

  // Star picks (20% each)
  (portfolio.star || []).forEach((asset, index) => {
    if (asset) {
      flat.push({ ...asset, tier: 'star', allocation: 20, slotIndex: index });
    }
  });

  // Core holds (15% each)
  (portfolio.core || []).forEach((asset, index) => {
    if (asset) {
      flat.push({ ...asset, tier: 'core', allocation: 15, slotIndex: index });
    }
  });

  // Support plays (10% each)
  (portfolio.support || []).forEach((asset, index) => {
    if (asset) {
      flat.push({ ...asset, tier: 'support', allocation: 10, slotIndex: index });
    }
  });

  return flat;
}

/**
 * Get bench assets as flat array
 * @param {Object} bench - { stocks: [], crypto: {} }
 * @returns {Object[]} Array of bench assets
 */
export function flattenBench(bench) {
  if (!bench) return [];

  const flat = [];

  (bench.stocks || []).forEach((asset, index) => {
    if (asset) {
      flat.push({ ...asset, benchType: 'stock', slotIndex: index });
    }
  });

  if (bench.crypto) {
    flat.push({ ...bench.crypto, benchType: 'crypto', slotIndex: 0 });
  }

  return flat;
}

/**
 * Organize flat portfolio back into tiers
 * @param {Object[]} flatPortfolio - Flat array with tier info
 * @returns {Object} Tier-organized portfolio
 */
export function organizeIntoTiers(flatPortfolio) {
  const portfolio = {
    star: [null, null],
    core: [null, null],
    support: [null, null, null],
  };

  flatPortfolio.forEach((asset) => {
    const tier = asset.tier;
    const index = asset.slotIndex;

    if (tier && portfolio[tier] && index !== undefined && index < portfolio[tier].length) {
      portfolio[tier][index] = asset;
    }
  });

  return portfolio;
}

// ==================== EVENT CREATION ====================

/**
 * Create a threshold crossing event
 * @param {string} player - 'player' or 'opponent'
 * @param {string} symbol - Asset symbol
 * @param {string} thresholdName - 'bagger', 'doubleBagger', etc.
 * @param {number} multiplier - Current multiplier
 * @param {number} points - Points for this threshold
 * @returns {Object} Event object
 */
export function createThresholdEvent(player, symbol, thresholdName, multiplier, points, direction) {
  const event = {
    id: `${Date.now()}-${symbol}-${thresholdName}`,
    timestamp: new Date().toISOString(),
    type: thresholdName,
    player,
    symbol,
    multiplier,
    points,
  };
  if (direction) event.direction = direction;
  return event;
}

// ==================== SCORING ====================

/**
 * Calculate asset score with new threshold system
 * @param {Object} asset - Asset with symbol, baseATR
 * @param {number} priceChange - Percent change from open (current price)
 * @param {Object} history - Asset history with maxMultiplier, minMultiplier
 * @param {Object} extremes - Optional { highChange, lowChange } percent changes from open at daily high/low
 * @returns {Object} Score breakdown
 */
export function calculateAssetScoreV3(asset, priceChange, history = {}, extremes = {}) {
  const baseATR = asset.baseATR || 2.5;

  // Guard: skip scoring if priceChange is invalid (NaN, Infinity, null)
  // This catches NaN from division-by-zero when baseline price is 0 (e.g., EODHD API failure at activation)
  if (priceChange == null || !isFinite(priceChange)) {
    console.log(`[Scoring] ${asset.symbol}: SKIPPING (invalid priceChange=${priceChange})`);

    return {
      symbol: asset.symbol,
      priceChange: 0,
      multiplier: 0,
      baseATR,
      tierMultiplier: CONVICTION_MULTIPLIERS[asset.tier] || CONVICTION_MULTIPLIERS.support,
      basePoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      badges: [],
      history: { maxMultiplier: history.maxMultiplier || 0, minMultiplier: history.minMultiplier || 0 },
    };
  }

  const multiplier = priceChange / baseATR;

  // Conviction multiplier: Star 2x, Core 1.5x, Support 1x
  const tierMultiplier = CONVICTION_MULTIPLIERS[asset.tier] || CONVICTION_MULTIPLIERS.support;

  // Base points: 10 per 1% change, scaled by conviction tier (uses CURRENT price, not extremes)
  const basePoints = priceChange * 10 * tierMultiplier;

  // For badge/threshold detection, use intraday high/low extremes when available.
  // A threshold is "cemented" once the price touches it at ANY point during the day:
  // - Positive bombs (bagger/doubleBagger/tenBagger): triggered by intraday HIGH
  // - Negative busts (bust/crash/meltdown): triggered by intraday LOW
  const highMultiplier = extremes.highChange != null ? extremes.highChange / baseATR : multiplier;
  const lowMultiplier = extremes.lowChange != null ? extremes.lowChange / baseATR : multiplier;

  // effectiveMax = best positive multiplier reached (for bombs)
  // effectiveMin = worst negative multiplier reached (for busts)
  // Include persisted history so badges earned from past peaks are never lost,
  // even if intraday extremes are missing or price has reversed.
  const historyMax = history.maxMultiplier || 0;
  const historyMin = history.minMultiplier || 0;
  const effectiveMax = Math.max(historyMax, highMultiplier, multiplier);
  const effectiveMin = Math.min(historyMin, lowMultiplier, multiplier);

  // Get badges from intraday extremes
  const badges = getBadgesFromHistory({
    maxMultiplier: effectiveMax,
    minMultiplier: effectiveMin,
  });

  // Bonus points from badges (flat, NOT scaled by conviction)
  const bonusPoints = calculatePoints(badges);

  return {
    symbol: asset.symbol,
    priceChange,
    multiplier,
    baseATR,
    tierMultiplier,
    basePoints: Math.round(basePoints),
    bonusPoints,
    totalPoints: Math.round(basePoints + bonusPoints),
    badges,
    history: {
      maxMultiplier: effectiveMax,
      minMultiplier: effectiveMin,
    },
  };
}

// ============================================
// V4 VERSION DETECTION UTILITIES
// ============================================

/**
 * Get the schema version of a battle
 * @param {Object} battle - Battle object
 * @returns {number} Version number (defaults to 3)
 */
export function getBattleVersion(battle) {
  if (!battle) return 3;
  if (battle._v) return battle._v;
  if (battle.type === 'baggerbomb_v5') return 5;
  if (battle.type === 'baggerbomb_v4') return 4;
  return 3;
}

/**
 * Check if a battle is V4 (free agent system)
 * @param {Object} battle - Battle object
 * @returns {boolean}
 */
export function isV4Battle(battle) {
  return getBattleVersion(battle) >= 4;
}

/**
 * Get all portfolio assets including those with swap prices
 * Works for both V3 and V4
 * @param {Object} battle - Battle object
 * @param {boolean} isCreator - Whether to get creator's or opponent's assets
 * @returns {Array} Flat array of portfolio assets
 */
export function getPortfolioAssets(battle, isCreator = true) {
  const player = isCreator ? battle?.creator : battle?.opponent;
  if (!player?.portfolio) return [];

  return [
    ...(player.portfolio.star || []),
    ...(player.portfolio.core || []),
    ...(player.portfolio.support || []),
  ].filter(Boolean);
}

/**
 * Calculate percentage change between current and open price.
 * Safe against zero/missing values.
 * @param {number} current - Current price
 * @param {number} open - Open/reference price
 * @returns {number|null} Percentage change or null if inputs invalid
 */
export function calcPctChange(current, open) {
  if (!current || !open || open === 0) return null;
  return ((current - open) / open) * 100;
}
