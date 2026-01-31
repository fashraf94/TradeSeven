// BadgeRow - Displays earned BaggerBomb/Bust badges
// Shows emoji badges with pop-in animation when earned

import React from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Badge configuration with emoji, color, and points
const BADGE_CONFIG = {
  // Positive badges (in earning order)
  bagger: {
    icon: '💣',
    label: 'Bagger',
    color: HOLO_COLORS.green,
    bgColor: `${HOLO_COLORS.green}20`,
    points: 15,
  },
  doubleBagger: {
    icon: '💣💣',
    label: 'Double Bagger',
    color: HOLO_COLORS.amber,
    bgColor: `${HOLO_COLORS.amber}20`,
    points: 30,
  },
  tenBagger: {
    icon: '🚀',
    label: 'TenBagger',
    color: HOLO_COLORS.purple,
    bgColor: `${HOLO_COLORS.purple}20`,
    points: 50,
  },
  // Negative badges (in severity order)
  bust: {
    icon: '📉',
    label: 'Bust',
    color: HOLO_COLORS.amber,
    bgColor: `${HOLO_COLORS.amber}20`,
    points: -10,
  },
  crash: {
    icon: '💥',
    label: 'Crash',
    color: HOLO_COLORS.red,
    bgColor: `${HOLO_COLORS.red}20`,
    points: -20,
  },
  meltdown: {
    icon: '🔥',
    label: 'Meltdown',
    color: '#991b1b',
    bgColor: '#991b1b20',
    points: -35,
  },
};

// Animation variants for badge pop-in
const badgeVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25,
    },
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

// Stagger animation for multiple badges
const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

/**
 * Single Badge component
 */
function Badge({ type, size = 'default', showLabel = false }) {
  const config = BADGE_CONFIG[type];
  if (!config) return null;

  const isSmall = size === 'small';
  const fontSize = isSmall ? '12px' : '14px';
  const padding = isSmall ? '2px 4px' : '3px 6px';

  return (
    <motion.span
      variants={badgeVariants}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize,
        padding,
        borderRadius: '4px',
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}40`,
        whiteSpace: 'nowrap',
      }}
      title={`${config.label} (${config.points > 0 ? '+' : ''}${config.points} pts)`}
    >
      <span>{config.icon}</span>
      {showLabel && (
        <span style={{ color: config.color, fontWeight: 500 }}>
          {config.label}
        </span>
      )}
    </motion.span>
  );
}

Badge.propTypes = {
  type: PropTypes.oneOf(Object.keys(BADGE_CONFIG)).isRequired,
  size: PropTypes.oneOf(['small', 'default']),
  showLabel: PropTypes.bool,
};

/**
 * BadgeRow - Displays a row of earned badges
 */
export default function BadgeRow({
  badges = [],
  size = 'default',
  showLabels = false,
  maxDisplay = 6,
  align = 'left',
}) {
  // Limit displayed badges if needed
  const displayBadges = badges.slice(0, maxDisplay);
  const overflow = badges.length - maxDisplay;

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: size === 'small' ? '4px' : '6px',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <AnimatePresence mode="popLayout">
        {displayBadges.map((badge, index) => (
          <Badge
            key={`${badge}-${index}`}
            type={badge}
            size={size}
            showLabel={showLabels}
          />
        ))}
        {overflow > 0 && (
          <motion.span
            variants={badgeVariants}
            style={{
              fontSize: size === 'small' ? '10px' : '12px',
              color: HOLO_COLORS.textMuted,
              alignSelf: 'center',
            }}
          >
            +{overflow}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

BadgeRow.propTypes = {
  /** Array of badge type strings: 'bagger', 'doubleBagger', 'tenBagger', 'bust', 'crash', 'meltdown' */
  badges: PropTypes.arrayOf(PropTypes.oneOf(Object.keys(BADGE_CONFIG))),
  /** Size variant */
  size: PropTypes.oneOf(['small', 'default']),
  /** Show text labels alongside emoji */
  showLabels: PropTypes.bool,
  /** Maximum badges to display before showing overflow count */
  maxDisplay: PropTypes.number,
  /** Alignment of badges */
  align: PropTypes.oneOf(['left', 'right']),
};

BadgeRow.defaultProps = {
  badges: [],
  size: 'default',
  showLabels: false,
  maxDisplay: 6,
  align: 'left',
};

// Export badge config for use in other components
export { BADGE_CONFIG };
