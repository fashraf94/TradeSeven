// computeProximity — the ONE derivation of "distance to the next tier".
//
// Lifted from ProximityLabel.jsx (Phase A of the Battle View controller, A2 —
// hazard 15 / Phase 0 §2.3) so the number a row renders and the number the
// Why? panel repeats come from ONE call rather than two. Before the lift the
// threshold math was exported but the dollar-distance branch and the string
// assembly were inline in the label component: a second consumer calling the
// exported function would have rendered the ATR distance beside a row showing
// the dollar distance — the display-disagreement bug class (BUILD_RULES §9).
//
// PURE. No React, no clock. ProximityLabel calls it when no precomputed
// `proximity` prop is passed (every user-side BaggerBomb view — byte-identical
// to the inline path it replaces; computeProximity.test.js proves the text
// over a fixture matrix covering the dollar and ATR branches). TacticalRow
// calls it once per side and passes the result to the label and, under the
// controller flag, to the Why? panel.

import { HOLO_COLORS } from '../../constants/holoTheme';

// Threshold configuration
export const THRESHOLDS = {
  // Positive thresholds (in order)
  bagger: { multiplier: 1.0, icon: '💣', label: 'Bagger' },
  doubleBagger: { multiplier: 1.5, icon: '💣💣', label: 'Double' },
  tenBagger: { multiplier: 2.0, icon: '🚀', label: 'TenBagger' },
  // Negative thresholds (in order of severity)
  bust: { multiplier: -1.0, icon: '📉', label: 'Bust' },
  crash: { multiplier: -1.5, icon: '💥', label: 'Crash' },
  meltdown: { multiplier: -2.0, icon: '🔥', label: 'Meltdown' },
};

// Achievement display config for crossed thresholds
export const ACHIEVEMENT_CONFIG = {
  bagger:       { text: '💣 BaggerBomb!', color: HOLO_COLORS.amber, fontWeight: 700, textShadow: 'none' },
  doubleBagger: { text: '💣💣 Double Bagger!', color: HOLO_COLORS.cyan, fontWeight: 700, textShadow: 'none' },
  tenBagger:    { text: '🚀 TenBagger!', color: HOLO_COLORS.gold, fontWeight: 700, textShadow: '0 0 8px rgba(255,215,0,0.6)' },
  bust:         { text: '📉 Bust', color: HOLO_COLORS.red, fontWeight: 500, textShadow: 'none' },
  crash:        { text: '💥 Crash', color: HOLO_COLORS.red, fontWeight: 700, textShadow: 'none' },
  meltdown:     { text: '🔥 Meltdown', color: '#991b1b', fontWeight: 700, textShadow: 'none' },
};

/**
 * Calculate the next threshold and distance to it
 * Also returns highestCrossed for achievement text display
 */
export function calculateNextThreshold(priceChange, baseATR, history) {
  if (!baseATR || baseATR === 0) {
    return { distance: 0, label: '—', icon: '', direction: 'neutral', isPrimed: false, highestCrossed: null };
  }

  const maxReached = history?.maxMultiplier || 0;
  const minReached = history?.minMultiplier || 0;

  // Compute highest crossed threshold on each side
  let highestCrossedPositive = null;
  if (maxReached >= THRESHOLDS.tenBagger.multiplier) highestCrossedPositive = 'tenBagger';
  else if (maxReached >= THRESHOLDS.doubleBagger.multiplier) highestCrossedPositive = 'doubleBagger';
  else if (maxReached >= THRESHOLDS.bagger.multiplier) highestCrossedPositive = 'bagger';

  let highestCrossedNegative = null;
  if (minReached <= THRESHOLDS.meltdown.multiplier) highestCrossedNegative = 'meltdown';
  else if (minReached <= THRESHOLDS.crash.multiplier) highestCrossedNegative = 'crash';
  else if (minReached <= THRESHOLDS.bust.multiplier) highestCrossedNegative = 'bust';

  // Determine direction based on current movement
  const isPositive = priceChange >= 0;

  if (isPositive) {
    // Moving positive - find next upward threshold
    if (maxReached < THRESHOLDS.bagger.multiplier) {
      const targetPercent = baseATR * THRESHOLDS.bagger.multiplier;
      const distance = targetPercent - priceChange;
      const isPrimed = distance <= targetPercent * 0.5;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.bagger.label,
        icon: THRESHOLDS.bagger.icon,
        direction: 'positive',
        isPrimed,
        highestCrossed: highestCrossedPositive,
      };
    }
    if (maxReached < THRESHOLDS.doubleBagger.multiplier) {
      const targetPercent = baseATR * THRESHOLDS.doubleBagger.multiplier;
      const distance = targetPercent - priceChange;
      const isPrimed = distance <= targetPercent * 0.5;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.doubleBagger.label,
        icon: THRESHOLDS.doubleBagger.icon,
        direction: 'positive',
        isPrimed,
        highestCrossed: highestCrossedPositive,
      };
    }
    if (maxReached < THRESHOLDS.tenBagger.multiplier) {
      const targetPercent = baseATR * THRESHOLDS.tenBagger.multiplier;
      const distance = targetPercent - priceChange;
      const isPrimed = distance <= targetPercent * 0.5;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.tenBagger.label,
        icon: THRESHOLDS.tenBagger.icon,
        direction: 'positive',
        isPrimed,
        highestCrossed: highestCrossedPositive,
      };
    }
    // All positive thresholds reached
    return {
      distance: 0,
      label: 'MAX',
      icon: '🚀',
      direction: 'maxed',
      isPrimed: false,
      highestCrossed: highestCrossedPositive,
    };
  } else {
    // Moving negative - find next downward threshold
    if (minReached > THRESHOLDS.bust.multiplier) {
      const targetPercent = Math.abs(baseATR * THRESHOLDS.bust.multiplier);
      const distance = priceChange - (baseATR * THRESHOLDS.bust.multiplier);
      const isPrimed = distance <= targetPercent * 0.5;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.bust.label,
        icon: THRESHOLDS.bust.icon,
        direction: 'negative',
        isPrimed,
        highestCrossed: highestCrossedNegative,
      };
    }
    if (minReached > THRESHOLDS.crash.multiplier) {
      const targetPercent = Math.abs(baseATR * THRESHOLDS.crash.multiplier);
      const distance = priceChange - (baseATR * THRESHOLDS.crash.multiplier);
      const isPrimed = distance <= targetPercent * 0.5;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.crash.label,
        icon: THRESHOLDS.crash.icon,
        direction: 'negative',
        isPrimed,
        highestCrossed: highestCrossedNegative,
      };
    }
    if (minReached > THRESHOLDS.meltdown.multiplier) {
      const targetPercent = Math.abs(baseATR * THRESHOLDS.meltdown.multiplier);
      const distance = priceChange - (baseATR * THRESHOLDS.meltdown.multiplier);
      const isPrimed = distance <= targetPercent * 0.5;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.meltdown.label,
        icon: THRESHOLDS.meltdown.icon,
        direction: 'negative',
        isPrimed,
        highestCrossed: highestCrossedNegative,
      };
    }
    // All negative thresholds reached
    return {
      distance: 0,
      label: 'MAX',
      icon: '🔥',
      direction: 'maxed',
      isPrimed: false,
      highestCrossed: highestCrossedNegative,
    };
  }
}

// Map a threshold label to the cron-level key on `dailyLevels`.
const LABEL_TO_LEVEL_KEY = {
  Bagger: 'baggerBomb',
  Double: 'doubleBagger',
  TenBagger: 'tenBagger',
  Bust: 'bust',
  Crash: 'crash',
  Meltdown: 'meltdown',
};

/**
 * When cron levels are available, the dollar distance to the next threshold —
 * the number the row ACTUALLY renders on a battle with daily levels. Null
 * when there are no levels, no price, the side is maxed, or a threshold on
 * this side has already been crossed (the achievement text takes over).
 */
export function computeDollarInfo({ dailyLevels, currentPrice, direction, highestCrossed, label }) {
  if (!dailyLevels || !currentPrice || currentPrice <= 0) return null;
  if (direction === 'maxed' || highestCrossed) return null;
  const targetKey = LABEL_TO_LEVEL_KEY[label];
  const targetPrice = targetKey ? dailyLevels[targetKey] : null;
  if (!targetPrice) return null;
  const dollarDistance = Math.abs(targetPrice - currentPrice);
  const pctDistance = (dollarDistance / currentPrice) * 100;
  return { dollarDistance, pctDistance, targetPrice };
}

/**
 * The display text — "💣 X.X% to Bagger" (ATR branch) or the same shape from
 * the dollar branch, or the achievement text, or "🚀 MAX", or the bare icon
 * at zero distance. Verbatim the label component's former formatText().
 */
export function formatProximityText({ achievement, direction, icon, distance, label, dollarInfo }) {
  if (achievement) return achievement.text;
  if (direction === 'maxed') {
    return `${icon} MAX`;
  }
  if (distance === 0) {
    return `${icon}`;
  }
  // When cron levels available, show dollar distance
  if (dollarInfo) {
    return `${icon} ${dollarInfo.pctDistance.toFixed(1)}% to ${label}`;
  }
  return `${icon} ${distance.toFixed(1)}% to ${label}`;
}

/**
 * Everything a proximity consumer needs, computed once.
 *
 * @param {object} args
 * @param {number} args.priceChange   the daily-relative threshold progress the row uses
 * @param {number} args.baseATR       the base threshold percentage
 * @param {object} [args.history]     { maxMultiplier, minMultiplier }
 * @param {object} [args.dailyLevels] cron-computed dollar levels, or null
 * @param {number} [args.currentPrice]
 * @returns {{
 *   text: string, label: string, icon: string, distance: number, direction: string,
 *   isPrimed: boolean, highestCrossed: string|null, achievement: object|null,
 *   dollarInfo: object|null,
 * }}
 */
export function computeProximity({
  priceChange,
  baseATR,
  history = { maxMultiplier: 0, minMultiplier: 0 },
  dailyLevels = null,
  currentPrice = null,
} = {}) {
  const next = calculateNextThreshold(priceChange, baseATR, history);
  const { distance, label, icon, direction, isPrimed, highestCrossed } = next;
  const dollarInfo = computeDollarInfo({ dailyLevels, currentPrice, direction, highestCrossed, label });
  // Achievement text when a threshold has been crossed on this side.
  const achievement = highestCrossed && (direction === 'maxed' || distance === 0)
    ? ACHIEVEMENT_CONFIG[highestCrossed]
    : null;
  const text = formatProximityText({ achievement, direction, icon, distance, label, dollarInfo });
  return { text, label, icon, distance, direction, isPrimed, highestCrossed, achievement, dollarInfo };
}

export default computeProximity;
