// api/_utils/agentScoring.js
// Server-side scoring functions for agent mid-battle evaluations.
// Duplicated from src/utils/baggerBombUtils.js and src/constants/baggerBombScoring.js
// because server-side code (api/) cannot import from src/.
//
// Ports below are BYTE-IDENTICAL to the canonical source. The math-consistency
// test in api/_utils/agentScoring.consistency.test.js asserts that this
// duplication never drifts. If you modify any port, update the canonical source
// (src/utils/baggerBombUtils.js) in the same change.

// ==================== CONSTANTS ====================

export const CONVICTION_MULTIPLIERS = {
  star: 2.0,
  core: 1.5,
  support: 1.0,
};

export const THRESHOLD_POINTS = {
  bagger: 15,
  doubleBagger: 30,
  tenBagger: 50,
  bust: -10,
  crash: -20,
  meltdown: -35,
};

export const THRESHOLD_MULTIPLIERS = {
  bagger: 1.0,
  doubleBagger: 1.5,
  tenBagger: 2.0,
  bust: -1.0,
  crash: -1.5,
  meltdown: -2.0,
};

// ==================== PORTFOLIO HELPERS ====================

/**
 * Flatten tiered portfolio into scored array.
 * Mirrors src/utils/baggerBombUtils.js:421-448
 */
export function flattenPortfolioServer(portfolio) {
  if (!portfolio) return [];
  const flat = [];

  (portfolio.star || []).forEach((asset, index) => {
    if (asset) flat.push({ ...asset, tier: 'star', allocation: 20, slotIndex: index });
  });
  (portfolio.core || []).forEach((asset, index) => {
    if (asset) flat.push({ ...asset, tier: 'core', allocation: 15, slotIndex: index });
  });
  (portfolio.support || []).forEach((asset, index) => {
    if (asset) flat.push({ ...asset, tier: 'support', allocation: 10, slotIndex: index });
  });

  return flat;
}

/**
 * Flatten bench into array.
 * Mirrors src/utils/baggerBombUtils.js:455-471
 */
export function flattenBenchServer(bench) {
  if (!bench) return [];
  const flat = [];

  (bench.stocks || []).forEach((asset, index) => {
    if (asset) flat.push({ ...asset, benchType: 'stock', slotIndex: index });
  });
  if (bench.crypto) {
    flat.push({ ...bench.crypto, benchType: 'crypto', slotIndex: 0 });
  }

  return flat;
}

// ==================== BADGE / POINTS ====================

/**
 * Get badges earned based on history multipliers.
 * Mirrors src/utils/baggerBombUtils.js:160-174
 */
export function getBadgesFromHistoryServer(history) {
  const badges = [];

  if (history.maxMultiplier >= THRESHOLD_MULTIPLIERS.bagger) badges.push('bagger');
  if (history.maxMultiplier >= THRESHOLD_MULTIPLIERS.doubleBagger) badges.push('doubleBagger');
  if (history.maxMultiplier >= THRESHOLD_MULTIPLIERS.tenBagger) badges.push('tenBagger');

  if (history.minMultiplier <= THRESHOLD_MULTIPLIERS.bust) badges.push('bust');
  if (history.minMultiplier <= THRESHOLD_MULTIPLIERS.crash) badges.push('crash');
  if (history.minMultiplier <= THRESHOLD_MULTIPLIERS.meltdown) badges.push('meltdown');

  return badges;
}

/**
 * Calculate total points from badges array.
 * Mirrors src/utils/baggerBombUtils.js:285-289
 */
export function calculatePointsServer(badges) {
  return badges.reduce((total, badge) => total + (THRESHOLD_POINTS[badge] || 0), 0);
}

// ==================== THRESHOLD PROXIMITY (Tier 0 Item 4) ====================

/**
 * Detect if a stock is in the "Red Zone" — within 25% of its next uncrossed threshold.
 * Byte-identical port of src/utils/baggerBombUtils.js:182-233.
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
 * Byte-identical port of src/utils/baggerBombUtils.js:244-278.
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

// ==================== MAIN SCORING ====================

/**
 * Calculate asset score with threshold system.
 * Mirrors src/utils/baggerBombUtils.js:535-627 (calculateAssetScoreV3)
 *
 * @param {Object} asset - { symbol, baseATR, tier, direction }
 * @param {number} priceChange - Percent change from entry price
 * @param {Object} history - { maxMultiplier, minMultiplier }
 * @param {Object} extremes - { highChange?, lowChange? } percent changes at daily high/low
 * @param {number|null} thresholdPriceChange - Percent change from previousClose for threshold detection
 * @returns {Object} Score breakdown
 */
export function calculateAssetScoreServer(asset, priceChange, history = {}, extremes = {}, thresholdPriceChange = null) {
  const baseATR = asset.baseATR || 2.5;

  // Negate for short positions
  const isShort = asset.direction === 'short';
  if (isShort) {
    priceChange = -priceChange;
    if (thresholdPriceChange != null) {
      thresholdPriceChange = -thresholdPriceChange;
    }
    if (extremes.highChange != null || extremes.lowChange != null) {
      extremes = {
        highChange: extremes.highChange != null ? -extremes.highChange : undefined,
        lowChange: extremes.lowChange != null ? -extremes.lowChange : undefined,
      };
    }
  }

  // Guard: skip scoring if priceChange is invalid
  if (priceChange == null || !isFinite(priceChange)) {
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

  // Threshold multiplier: previousClose when available, entry price fallback
  const effectiveThresholdChange = (thresholdPriceChange != null && isFinite(thresholdPriceChange))
    ? thresholdPriceChange
    : priceChange;
  const multiplier = effectiveThresholdChange / baseATR;

  const tierMultiplier = CONVICTION_MULTIPLIERS[asset.tier] || CONVICTION_MULTIPLIERS.support;

  // Base points: 10 per 1% change, scaled by tier
  const basePoints = priceChange * 10 * tierMultiplier;

  // Badge detection using intraday extremes + persisted history
  const highMultiplier = extremes.highChange != null ? extremes.highChange / baseATR : multiplier;
  const lowMultiplier = extremes.lowChange != null ? extremes.lowChange / baseATR : multiplier;

  const historyMax = history.maxMultiplier || 0;
  const historyMin = history.minMultiplier || 0;
  const effectiveMax = Math.max(historyMax, highMultiplier, multiplier);
  const effectiveMin = Math.min(historyMin, lowMultiplier, multiplier);

  const badges = getBadgesFromHistoryServer({
    maxMultiplier: effectiveMax,
    minMultiplier: effectiveMin,
  });

  const bonusPoints = calculatePointsServer(badges);

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
