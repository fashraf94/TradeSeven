// ProximityLabel - Shows distance to next threshold
// Displays "0.4% to 🚀" style helper text
// Shows achievement text when thresholds are crossed
//
// Phase A of the Battle View controller (A2, hazard 15): the threshold math,
// the dollar-distance branch and the string assembly now live in ONE pure
// function, computeProximity() (./computeProximity.js). This component calls
// it when no precomputed `proximity` prop is passed — every user-side
// BaggerBomb view, byte-identical to the inline path it replaces — and
// renders the precomputed result when TacticalRow hands one down, so the row
// and the Why? panel repeat the same number from the same call.

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { THRESHOLD_HEAT, STRIKE_COLORS } from '../../constants/animationTokens';
import { computeProximity, calculateNextThreshold, THRESHOLDS } from './computeProximity';

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
  proximityRatio = 1,
  heatDirection = 'neutral',
  // Phase A: a precomputed computeProximity() result. When absent the label
  // computes its own from the props above — the pre-lift behaviour, verbatim.
  proximity = null,
}) {
  const computed = useMemo(
    () => proximity ?? computeProximity({ priceChange, baseATR, history, dailyLevels, currentPrice }),
    [proximity, priceChange, baseATR, history, dailyLevels, currentPrice]
  );
  const { direction, isPrimed, achievement, text } = computed;

  const isSmall = size === 'small';
  const fontSize = isSmall ? '10px' : '12px';

  // Determine text color — graduated warming based on proximity
  const getTextColor = () => {
    if (achievement) return achievement.color;
    if (direction === 'maxed') {
      return direction === 'positive' ? HOLO_COLORS.green : HOLO_COLORS.red;
    }
    // Graduated warming when proximity data available
    if (heatDirection !== 'neutral' && proximityRatio < THRESHOLD_HEAT.triggerProximity) {
      if (proximityRatio < THRESHOLD_HEAT.breathingProximity) {
        // Closest: teal for bagger approach, red for bust
        return heatDirection === 'positive'
          ? STRIKE_COLORS.anticipationBagger
          : STRIKE_COLORS.anticipationBust;
      }
      // Mid-range: warm to white
      return '#e6edf3';
    }
    // Default: muted
    return HOLO_COLORS.textMuted;
  };

  // Breathing class for very close proximity
  const isBreathing = heatDirection !== 'neutral'
    && proximityRatio < THRESHOLD_HEAT.breathingProximity;

  // The display text — "💣 X.X% to Bagger" — is computeProximity()'s `text`.

  return (
    <motion.span
      animate={isPrimed && !isBreathing ? {
        opacity: [0.8, 1, 0.8],
        textShadow: [
          '0 0 4px rgba(245, 158, 11, 0.3)',
          '0 0 8px rgba(245, 158, 11, 0.6)',
          '0 0 4px rgba(245, 158, 11, 0.3)',
        ],
      } : { opacity: 1 }}
      transition={isPrimed && !isBreathing ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
      className={isBreathing ? 'threshold-breathing' : undefined}
      style={{
        fontSize,
        color: getTextColor(),
        fontWeight: achievement ? achievement.fontWeight : 500,
        textShadow: achievement ? achievement.textShadow : undefined,
        textAlign: align,
        display: 'block',
        whiteSpace: 'nowrap',
        ...(isBreathing ? { animation: 'thresholdBreath 2s ease-in-out infinite' } : {}),
      }}
    >
      {text}
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
  /** Proximity ratio from threshold heat computation (0 = at threshold, 1 = far away) */
  proximityRatio: PropTypes.number,
  /** Direction of heat approach */
  heatDirection: PropTypes.oneOf(['positive', 'negative', 'neutral']),
  /** A precomputed computeProximity() result (Phase A) — optional */
  proximity: PropTypes.shape({
    text: PropTypes.string.isRequired,
    direction: PropTypes.string,
    isPrimed: PropTypes.bool,
    achievement: PropTypes.object,
  }),
};

ProximityLabel.defaultProps = {
  history: { maxMultiplier: 0, minMultiplier: 0 },
  size: 'default',
  align: 'left',
};

// Export helper for use in other components (re-exported from
// ./computeProximity, where the math now lives)
export { calculateNextThreshold, THRESHOLDS };
