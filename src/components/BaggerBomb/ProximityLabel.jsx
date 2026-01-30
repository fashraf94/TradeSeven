// ProximityLabel - Shows distance to next threshold
// Displays "0.4% to 🚀" style helper text

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

/**
 * Calculate the next threshold and distance to it
 */
function calculateNextThreshold(priceChange, baseATR, history) {
  if (!baseATR || baseATR === 0) {
    return { distance: 0, label: '—', icon: '', direction: 'neutral', isPrimed: false };
  }

  const multiplier = priceChange / baseATR;
  const maxReached = history?.maxMultiplier || 0;
  const minReached = history?.minMultiplier || 0;

  // Determine direction based on current movement
  const isPositive = priceChange >= 0;

  if (isPositive) {
    // Moving positive - find next upward threshold
    if (maxReached < THRESHOLDS.bagger.multiplier) {
      const targetPercent = baseATR * THRESHOLDS.bagger.multiplier;
      const distance = targetPercent - priceChange;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.bagger.label,
        icon: THRESHOLDS.bagger.icon,
        direction: 'positive',
        isPrimed: distance <= baseATR * 0.1,
      };
    }
    if (maxReached < THRESHOLDS.doubleBagger.multiplier) {
      const targetPercent = baseATR * THRESHOLDS.doubleBagger.multiplier;
      const distance = targetPercent - priceChange;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.doubleBagger.label,
        icon: THRESHOLDS.doubleBagger.icon,
        direction: 'positive',
        isPrimed: distance <= baseATR * 0.15,
      };
    }
    if (maxReached < THRESHOLDS.tenBagger.multiplier) {
      const targetPercent = baseATR * THRESHOLDS.tenBagger.multiplier;
      const distance = targetPercent - priceChange;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.tenBagger.label,
        icon: THRESHOLDS.tenBagger.icon,
        direction: 'positive',
        isPrimed: distance <= baseATR * 0.2,
      };
    }
    // All positive thresholds reached
    return {
      distance: 0,
      label: 'MAX',
      icon: '🚀',
      direction: 'maxed',
      isPrimed: false,
    };
  } else {
    // Moving negative - find next downward threshold
    if (minReached > THRESHOLDS.bust.multiplier) {
      const targetPercent = baseATR * THRESHOLDS.bust.multiplier;
      const distance = priceChange - targetPercent;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.bust.label,
        icon: THRESHOLDS.bust.icon,
        direction: 'negative',
        isPrimed: distance <= baseATR * 0.1,
      };
    }
    if (minReached > THRESHOLDS.crash.multiplier) {
      const targetPercent = baseATR * THRESHOLDS.crash.multiplier;
      const distance = priceChange - targetPercent;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.crash.label,
        icon: THRESHOLDS.crash.icon,
        direction: 'negative',
        isPrimed: distance <= baseATR * 0.15,
      };
    }
    if (minReached > THRESHOLDS.meltdown.multiplier) {
      const targetPercent = baseATR * THRESHOLDS.meltdown.multiplier;
      const distance = priceChange - targetPercent;
      return {
        distance: Math.max(0, distance),
        label: THRESHOLDS.meltdown.label,
        icon: THRESHOLDS.meltdown.icon,
        direction: 'negative',
        isPrimed: distance <= baseATR * 0.2,
      };
    }
    // All negative thresholds reached
    return {
      distance: 0,
      label: 'MAX',
      icon: '🔥',
      direction: 'maxed',
      isPrimed: false,
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
  size = 'default',
  align = 'left',
}) {
  const { distance, icon, direction, isPrimed } = useMemo(
    () => calculateNextThreshold(priceChange, baseATR, history),
    [priceChange, baseATR, history]
  );

  const isSmall = size === 'small';
  const fontSize = isSmall ? '10px' : '12px';

  // Determine text color based on direction
  const getTextColor = () => {
    if (direction === 'maxed') {
      return direction === 'positive' ? HOLO_COLORS.green : HOLO_COLORS.red;
    }
    if (isPrimed) {
      return HOLO_COLORS.amber;
    }
    return HOLO_COLORS.textMuted;
  };

  // Format the display text
  const formatText = () => {
    if (direction === 'maxed') {
      return `MAX ${icon}`;
    }
    if (distance === 0) {
      return `${icon}`;
    }
    return `${distance.toFixed(1)}% to ${icon}`;
  };

  return (
    <motion.span
      animate={isPrimed ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
      transition={isPrimed ? { duration: 1.5, repeat: Infinity } : {}}
      style={{
        fontSize,
        color: getTextColor(),
        fontWeight: isPrimed ? 500 : 400,
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
