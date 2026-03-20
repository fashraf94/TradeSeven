// ProximityLabel - Shows distance to next threshold
// Displays "0.4% to 🚀" style helper text
// Shows achievement text when thresholds are crossed

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Threshold configuration
const THRESHOLDS = {
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
const ACHIEVEMENT_CONFIG = {
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
function calculateNextThreshold(priceChange, baseATR, history) {
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

/**
 * ProximityLabel - Shows distance to next threshold
 */
export default function ProximityLabel({
  priceChange,
  baseATR,
  history = { maxMultiplier: 0, minMultiplier: 0 },
  dailyLevels = null,
  currentPrice = null,
  size = 'default',
  align = 'left',
}) {
  const { distance, label, icon, direction, isPrimed, highestCrossed } = useMemo(
    () => calculateNextThreshold(priceChange, baseATR, history),
    [priceChange, baseATR, history]
  );

  // When cron levels available, compute dollar distance to next threshold
  const dollarInfo = useMemo(() => {
    if (!dailyLevels || !currentPrice || currentPrice <= 0) return null;
    if (direction === 'maxed' || highestCrossed) return null;
    // Map label to cron level key
    const labelToKey = { 'Bagger': 'baggerBomb', 'Double': 'doubleBagger', 'TenBagger': 'tenBagger', 'Bust': 'bust', 'Crash': 'crash', 'Meltdown': 'meltdown' };
    const targetKey = labelToKey[label];
    const targetPrice = targetKey ? dailyLevels[targetKey] : null;
    if (!targetPrice) return null;
    const dollarDistance = Math.abs(targetPrice - currentPrice);
    const pctDistance = (dollarDistance / currentPrice) * 100;
    return { dollarDistance, pctDistance, targetPrice };
  }, [dailyLevels, currentPrice, direction, highestCrossed, label]);

  const isSmall = size === 'small';
  const fontSize = isSmall ? '10px' : '12px';

  // Check if we should show achievement text
  const achievement = highestCrossed && (direction === 'maxed' || distance === 0)
    ? ACHIEVEMENT_CONFIG[highestCrossed]
    : null;

  // Determine text color based on direction
  const getTextColor = () => {
    if (achievement) return achievement.color;
    if (direction === 'maxed') {
      return direction === 'positive' ? HOLO_COLORS.green : HOLO_COLORS.red;
    }
    // Use amber (#f59e0b) for threshold proximity
    return '#f59e0b';
  };

  // Format the display text - "💣 X.X% to BaggerBomb" or "💣 $3.50 to Bagger" format
  const formatText = () => {
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
  };

  return (
    <motion.span
      animate={isPrimed ? {
        opacity: [0.8, 1, 0.8],
        textShadow: [
          '0 0 4px rgba(245, 158, 11, 0.3)',
          '0 0 8px rgba(245, 158, 11, 0.6)',
          '0 0 4px rgba(245, 158, 11, 0.3)',
        ],
      } : { opacity: 1 }}
      transition={isPrimed ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
      style={{
        fontSize,
        color: getTextColor(),
        fontWeight: achievement ? achievement.fontWeight : 500,
        textShadow: achievement ? achievement.textShadow : undefined,
        textAlign: align,
        display: 'block',
        whiteSpace: 'nowrap',
      }}
    >
      {formatText()}
    </motion.span>
  );
}

ProximityLabel.propTypes = {
  /** Current price change percentage */
  priceChange: PropTypes.number.isRequired,
  /** Base ATR threshold percentage */
  baseATR: PropTypes.number.isRequired,
  /** History tracking for determining next uncrossed threshold */
  history: PropTypes.shape({
    maxMultiplier: PropTypes.number,
    minMultiplier: PropTypes.number,
  }),
  /** Cron-computed dollar levels (Phase B) */
  dailyLevels: PropTypes.shape({
    baseline: PropTypes.number,
    baggerBomb: PropTypes.number,
    doubleBagger: PropTypes.number,
    tenBagger: PropTypes.number,
    bust: PropTypes.number,
    crash: PropTypes.number,
    meltdown: PropTypes.number,
  }),
  /** Current market price for dollar distance calculation */
  currentPrice: PropTypes.number,
  /** Size variant */
  size: PropTypes.oneOf(['small', 'default']),
  /** Text alignment */
  align: PropTypes.oneOf(['left', 'center', 'right']),
};

ProximityLabel.defaultProps = {
  history: { maxMultiplier: 0, minMultiplier: 0 },
  size: 'default',
  align: 'left',
};

// Export helper for use in other components
export { calculateNextThreshold, THRESHOLDS };
