// ChamberFuse - Bidirectional threshold gauge for BaggerBomb
// Shows proximity to 6 thresholds (3 positive, 3 negative)
// Segments stay lit once crossed (via history tracking)
// Visual overhaul: Glassmorphic bomb indicator + tiered glow system

import React, { useMemo, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';

// Threshold multipliers (of baseATR)
const MULTIPLIERS = {
  // Positive thresholds
  bagger: 1.0,
  doubleBagger: 1.5,
  tenBagger: 2.0,
  // Negative thresholds
  bust: -1.0,
  crash: -1.5,
  meltdown: -2.0,
};

// Segment emoji labels
const SEGMENT_LABELS = {
  meltdown: '🔥',
  crash: '💥',
  bust: '📉',
  bagger: '💣',
  doubleBagger: '💣💣',
  tenBagger: '🚀',
};

// Segment colors when lit (used for labels)
const SEGMENT_COLORS = {
  bagger: HOLO_COLORS.green,
  doubleBagger: HOLO_COLORS.amber,
  tenBagger: HOLO_COLORS.purple,
  bust: HOLO_COLORS.amber,
  crash: HOLO_COLORS.red,
  meltdown: '#991b1b',
};

// BombIndicator visual state config
const BOMB_STYLES = {
  neutral: {
    bg: 'radial-gradient(circle, rgba(0,255,255,0.15) 0%, rgba(0,217,255,0.08) 100%)',
    border: 'rgba(0,255,255,0.3)',
    boxShadow: '0 0 8px rgba(0,255,255,0.3)',
    emoji: '💣',
    pulse: null,
  },
  bagger: {
    bg: 'radial-gradient(circle, rgba(255,215,0,0.25) 0%, rgba(255,165,0,0.15) 100%)',
    border: 'rgba(255,215,0,0.4)',
    boxShadow: '0 0 12px rgba(255,215,0,0.5), 0 0 24px rgba(255,165,0,0.2)',
    boxShadowPeak: '0 0 20px rgba(255,215,0,0.7), 0 0 35px rgba(255,165,0,0.35)',
    emoji: '💣',
    pulse: { duration: 2 },
  },
  doubleBagger: {
    bg: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,200,0,0.2) 100%)',
    border: 'rgba(255,215,0,0.5)',
    boxShadow: '0 0 16px rgba(255,215,0,0.6), 0 0 30px rgba(255,165,0,0.3)',
    boxShadowPeak: '0 0 24px rgba(255,215,0,0.8), 0 0 40px rgba(255,165,0,0.4)',
    emoji: '💣',
    pulse: { duration: 1.8 },
  },
  tenBagger: {
    bg: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,215,0,0.2) 100%)',
    border: 'rgba(255,255,255,0.4)',
    boxShadow: '0 0 20px rgba(255,215,0,0.6), 0 0 35px rgba(255,255,255,0.3)',
    boxShadowPeak: '0 0 28px rgba(255,215,0,0.8), 0 0 45px rgba(255,255,255,0.45)',
    emoji: '🚀',
    pulse: { duration: 1.5 },
  },
  bust: {
    bg: 'radial-gradient(circle, rgba(255,51,102,0.25) 0%, rgba(200,0,50,0.15) 100%)',
    border: 'rgba(255,51,102,0.3)',
    boxShadow: '0 0 10px rgba(255,51,102,0.4), 0 0 20px rgba(255,0,0,0.15)',
    boxShadowPeak: '0 0 16px rgba(255,51,102,0.6), 0 0 28px rgba(255,0,0,0.25)',
    emoji: '💣',
    pulse: { duration: 2.5 },
  },
  crash: {
    bg: 'radial-gradient(circle, rgba(200,0,50,0.3) 0%, rgba(153,27,27,0.2) 100%)',
    border: 'rgba(200,0,50,0.4)',
    boxShadow: '0 0 12px rgba(255,51,102,0.5), 0 0 24px rgba(255,0,0,0.2)',
    boxShadowPeak: '0 0 18px rgba(255,51,102,0.7), 0 0 32px rgba(255,0,0,0.3)',
    emoji: '💥',
    pulse: { duration: 2 },
  },
  meltdown: {
    bg: 'radial-gradient(circle, rgba(153,27,27,0.35) 0%, rgba(127,29,29,0.25) 100%)',
    border: 'rgba(200,0,50,0.4)',
    boxShadow: '0 0 14px rgba(200,0,50,0.5), 0 0 28px rgba(153,27,27,0.3)',
    boxShadowPeak: '0 0 20px rgba(200,0,50,0.7), 0 0 35px rgba(153,27,27,0.4)',
    emoji: '💥',
    pulse: { duration: 1.8 },
  },
};

/**
 * Map a multiplier value to track percentage position
 * Range: -2.5 (0%) to +2.5 (100%), with 0 at 50%
 */
const valueToPercent = (multiplier, rangeMax = 2.5) => {
  const clamped = Math.max(-rangeMax, Math.min(rangeMax, multiplier));
  return ((clamped + rangeMax) / (rangeMax * 2)) * 100;
};

/**
 * Get tiered segment style based on segment name and lit state
 * Uses CSS animations (compositor-friendly) instead of framer-motion for loops
 */
function getSegmentStyle(name, lit) {
  if (!lit) {
    return {
      background: `rgba(22, 27, 34, 0.8)`,
      opacity: 0.3,
      boxShadow: 'none',
    };
  }

  switch (name) {
    case 'bagger':
      return {
        background: 'linear-gradient(90deg, rgba(245,158,11,0.3) 0%, rgba(255,165,0,0.2) 100%)',
        backgroundSize: '200% 100%',
        animation: 'chamberShimmer 3s ease-in-out infinite',
        borderColor: 'rgba(245,158,11,0.4)',
        boxShadow: '0 0 8px rgba(245,158,11,0.3)',
        opacity: 1,
      };
    case 'doubleBagger':
      return {
        background: 'linear-gradient(90deg, rgba(0,255,255,0.3) 0%, rgba(0,217,255,0.2) 100%)',
        backgroundSize: '200% 100%',
        animation: 'chamberShimmer 2.5s ease-in-out infinite',
        borderColor: 'rgba(0,255,255,0.5)',
        boxShadow: '0 0 12px rgba(0,255,255,0.4)',
        opacity: 1,
      };
    case 'tenBagger':
      return {
        background: 'linear-gradient(90deg, rgba(255,215,0,0.4) 0%, rgba(255,255,255,0.2) 50%, rgba(255,215,0,0.4) 100%)',
        backgroundSize: '200% 100%',
        animation: 'chamberShimmer 2s ease-in-out infinite',
        borderColor: 'rgba(255,215,0,0.6)',
        boxShadow: '0 0 16px rgba(255,215,0,0.5), 0 0 30px rgba(255,215,0,0.2)',
        opacity: 1,
      };
    case 'bust':
      return {
        background: 'linear-gradient(90deg, rgba(255,51,102,0.2) 0%, rgba(200,0,50,0.15) 100%)',
        backgroundSize: '200% 100%',
        animation: 'chamberPulseRed 3s ease-in-out infinite',
        borderColor: 'rgba(255,51,102,0.3)',
        boxShadow: '0 0 6px rgba(255,51,102,0.25)',
        opacity: 1,
      };
    case 'crash':
      return {
        background: 'linear-gradient(90deg, rgba(200,0,50,0.3) 0%, rgba(255,0,0,0.2) 100%)',
        backgroundSize: '200% 100%',
        animation: 'chamberPulseRed 2.5s ease-in-out infinite',
        borderColor: 'rgba(255,0,0,0.4)',
        boxShadow: '0 0 10px rgba(255,0,0,0.35)',
        opacity: 1,
      };
    case 'meltdown':
      return {
        background: 'linear-gradient(90deg, rgba(153,27,27,0.35) 0%, rgba(127,29,29,0.25) 100%)',
        backgroundSize: '200% 100%',
        animation: 'chamberPulseRed 2s ease-in-out infinite',
        borderColor: 'rgba(153,27,27,0.4)',
        boxShadow: '0 0 10px rgba(153,27,27,0.35)',
        opacity: 1,
      };
    default:
      return {
        background: HOLO_COLORS.bgElevated,
        opacity: 1,
        boxShadow: 'none',
      };
  }
}

/**
 * FuseSegment - Individual segment of the fuse track
 * Uses CSS transitions + CSS animations for performance
 */
function FuseSegment({ name, lit, width, position }) {
  const segmentStyle = getSegmentStyle(name, lit);

  return (
    <div
      style={{
        width,
        height: '100%',
        borderRight: position !== 'last' ? `1px solid ${HOLO_COLORS.borderSubtle}` : 'none',
        borderLeft: position === 'first' ? 'none' : undefined,
        transition: 'opacity 0.3s ease-out, background 0.3s ease-out, box-shadow 0.3s ease-out',
        ...segmentStyle,
      }}
    />
  );
}

FuseSegment.propTypes = {
  name: PropTypes.string.isRequired,
  lit: PropTypes.bool.isRequired,
  width: PropTypes.string.isRequired,
  position: PropTypes.oneOf(['first', 'middle', 'last']),
};

/**
 * ChamberFuse - Main component
 * Bidirectional gauge showing threshold proximity
 */
export default function ChamberFuse({
  priceChange,
  baseATR,
  history = { maxMultiplier: 0, minMultiplier: 0 },
  compact = false,
  showLabels = true,
  animate = true,
  onThresholdCross,
}) {
  const prevMultiplierRef = useRef(0);

  // Calculate current position as multiplier of baseATR
  const currentMultiplier = useMemo(() => {
    if (!baseATR || baseATR === 0) return 0;
    return priceChange / baseATR;
  }, [priceChange, baseATR]);

  // Determine which segments are lit (current OR history)
  const litSegments = useMemo(() => ({
    // Positive: lit if current >= threshold OR history max >= threshold
    bagger: currentMultiplier >= MULTIPLIERS.bagger || history.maxMultiplier >= MULTIPLIERS.bagger,
    doubleBagger: currentMultiplier >= MULTIPLIERS.doubleBagger || history.maxMultiplier >= MULTIPLIERS.doubleBagger,
    tenBagger: currentMultiplier >= MULTIPLIERS.tenBagger || history.maxMultiplier >= MULTIPLIERS.tenBagger,
    // Negative: lit if current <= threshold OR history min <= threshold
    bust: currentMultiplier <= MULTIPLIERS.bust || history.minMultiplier <= MULTIPLIERS.bust,
    crash: currentMultiplier <= MULTIPLIERS.crash || history.minMultiplier <= MULTIPLIERS.crash,
    meltdown: currentMultiplier <= MULTIPLIERS.meltdown || history.minMultiplier <= MULTIPLIERS.meltdown,
  }), [currentMultiplier, history.maxMultiplier, history.minMultiplier]);

  // Derive highest active state from litSegments
  const activeState = useMemo(() => {
    const highestPositive = litSegments.tenBagger ? 'tenBagger'
      : litSegments.doubleBagger ? 'doubleBagger'
      : litSegments.bagger ? 'bagger' : null;
    const highestNegative = litSegments.meltdown ? 'meltdown'
      : litSegments.crash ? 'crash'
      : litSegments.bust ? 'bust' : null;
    // Use the side matching current direction for the bomb indicator
    const overall = currentMultiplier >= 0
      ? (highestPositive || highestNegative)
      : (highestNegative || highestPositive);
    return { highestPositive, highestNegative, overall };
  }, [litSegments, currentMultiplier]);

  // BombIndicator visual style
  const bombStyle = BOMB_STYLES[activeState.overall] || BOMB_STYLES.neutral;

  // Check if primed and calculate intensity (0-1, where 1 is closest to threshold)
  const primedState = useMemo(() => {
    // Calculate distance to nearest uncrossed threshold
    let nearestDistance = null;
    let isPositive = true;

    // Check proximity to positive thresholds
    if (currentMultiplier > 0 && currentMultiplier < MULTIPLIERS.bagger) {
      nearestDistance = MULTIPLIERS.bagger - currentMultiplier;
      isPositive = true;
    } else if (currentMultiplier >= MULTIPLIERS.bagger && currentMultiplier < MULTIPLIERS.doubleBagger) {
      nearestDistance = MULTIPLIERS.doubleBagger - currentMultiplier;
      isPositive = true;
    } else if (currentMultiplier >= MULTIPLIERS.doubleBagger && currentMultiplier < MULTIPLIERS.tenBagger) {
      nearestDistance = MULTIPLIERS.tenBagger - currentMultiplier;
      isPositive = true;
    }

    // Check proximity to negative thresholds
    if (currentMultiplier < 0 && currentMultiplier > MULTIPLIERS.bust) {
      const dist = Math.abs(currentMultiplier - MULTIPLIERS.bust);
      if (nearestDistance === null || dist < nearestDistance) {
        nearestDistance = dist;
        isPositive = false;
      }
    } else if (currentMultiplier <= MULTIPLIERS.bust && currentMultiplier > MULTIPLIERS.crash) {
      const dist = Math.abs(currentMultiplier - MULTIPLIERS.crash);
      if (nearestDistance === null || dist < nearestDistance) {
        nearestDistance = dist;
        isPositive = false;
      }
    } else if (currentMultiplier <= MULTIPLIERS.crash && currentMultiplier > MULTIPLIERS.meltdown) {
      const dist = Math.abs(currentMultiplier - MULTIPLIERS.meltdown);
      if (nearestDistance === null || dist < nearestDistance) {
        nearestDistance = dist;
        isPositive = false;
      }
    }

    if (nearestDistance === null) {
      return { isPrimed: false, intensity: 0, isPositive: true };
    }

    // Primed if within 10% (0.1 multiplier distance)
    const isPrimed = nearestDistance <= 0.1;
    // Intensity: 1.0 at 2% distance, 0.3 at 10% distance
    const intensity = isPrimed ? Math.min(1, Math.max(0.3, 1 - (nearestDistance / 0.1) * 0.7)) : 0;

    return { isPrimed, intensity, isPositive };
  }, [currentMultiplier]);

  const isPrimed = primedState.isPrimed;
  const primedIntensity = primedState.intensity;

  // Detect threshold crossings and fire callback
  useEffect(() => {
    if (!onThresholdCross) return;

    const prev = prevMultiplierRef.current;
    const curr = currentMultiplier;

    // Check positive thresholds
    Object.entries(MULTIPLIERS).forEach(([name, threshold]) => {
      if (threshold > 0) {
        // Positive threshold: crossed when going from below to at/above
        if (prev < threshold && curr >= threshold) {
          onThresholdCross(name, curr, threshold);
        }
      } else {
        // Negative threshold: crossed when going from above to at/below
        if (prev > threshold && curr <= threshold) {
          onThresholdCross(name, curr, threshold);
        }
      }
    });

    prevMultiplierRef.current = curr;
  }, [currentMultiplier, onThresholdCross]);

  // Ignite transition — brightness flash on new threshold crossing
  const [igniting, setIgniting] = useState(false);
  const prevLitRef = useRef(litSegments);

  useEffect(() => {
    const prev = prevLitRef.current;
    const newlyLit = Object.keys(litSegments).some(
      key => litSegments[key] && !prev[key]
    );
    if (newlyLit) {
      setIgniting(true);
      const timer = setTimeout(() => setIgniting(false), 400);
      prevLitRef.current = litSegments;
      return () => clearTimeout(timer);
    }
    prevLitRef.current = litSegments;
  }, [litSegments]);

  // Calculate needle position as percentage
  const needlePosition = useMemo(() => valueToPercent(currentMultiplier), [currentMultiplier]);

  // Sizes based on compact mode
  const trackHeight = compact ? 16 : 24;
  const indicatorSize = compact ? 20 : 28;
  const labelSize = compact ? 9 : 11;

  // Segment order (left to right): meltdown, crash, bust, [center], bagger, doubleBagger, tenBagger
  const segments = [
    { name: 'meltdown', position: 'first' },
    { name: 'crash', position: 'middle' },
    { name: 'bust', position: 'middle' },
    { name: 'bagger', position: 'middle' },
    { name: 'doubleBagger', position: 'middle' },
    { name: 'tenBagger', position: 'last' },
  ];

  // Build boxShadow pulse animation for BombIndicator (framer-motion)
  const bombPulseAnimate = bombStyle.pulse ? {
    boxShadow: [
      bombStyle.boxShadow,
      bombStyle.boxShadowPeak || bombStyle.boxShadow,
      bombStyle.boxShadow,
    ],
  } : {};
  const bombPulseTransition = bombStyle.pulse ? {
    duration: bombStyle.pulse.duration,
    repeat: Infinity,
    ease: 'easeInOut',
  } : {};

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: trackHeight + (showLabels ? 20 : 0),
        userSelect: 'none',
        animation: igniting ? 'chamberIgnite 0.4s ease-out forwards' : 'none',
      }}
    >
      {/* Track Background with Segments */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: trackHeight,
          backgroundColor: HOLO_COLORS.bgCard,
          borderRadius: trackHeight / 2,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {segments.map((seg) => (
          <FuseSegment
            key={seg.name}
            name={seg.name}
            lit={litSegments[seg.name]}
            width="16.67%"
            position={seg.position}
          />
        ))}
      </div>

      {/* Center Line Marker */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          width: 2,
          height: trackHeight,
          backgroundColor: HOLO_COLORS.textMuted,
          opacity: 0.5,
          transform: 'translateX(-50%)',
          zIndex: 5,
        }}
      />

      {/* BombIndicator — Glassmorphic bomb replacing the old cyan circle needle */}
      <motion.div
        animate={{
          left: `${needlePosition}%`,
          x: animate && isPrimed ? [-3 * primedIntensity, 3 * primedIntensity, -2 * primedIntensity, 2 * primedIntensity, 0] : 0,
          scale: isPrimed ? 1 + (0.1 * primedIntensity) : 1,
          ...bombPulseAnimate,
        }}
        transition={{
          left: { type: 'spring', stiffness: 80, damping: 15 },
          x: isPrimed ? { duration: 0.2 + (0.15 * (1 - primedIntensity)), repeat: Infinity, ease: 'easeInOut' } : { duration: 0 },
          scale: { duration: 0.2 },
          boxShadow: bombPulseTransition,
        }}
        style={{
          position: 'absolute',
          top: trackHeight / 2,
          width: indicatorSize,
          height: indicatorSize,
          marginLeft: -indicatorSize / 2,
          marginTop: -indicatorSize / 2,
          borderRadius: '50%',
          // Glassmorphic effect
          background: bombStyle.bg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1.5px solid ${bombStyle.border}`,
          boxShadow: bombStyle.boxShadow,
          // Layout
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? 10 : 14,
          zIndex: 10,
        }}
      >
        {bombStyle.emoji}
      </motion.div>

      {/* Threshold Labels */}
      {showLabels && (
        <div
          style={{
            position: 'absolute',
            top: trackHeight + 4,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: labelSize,
            color: HOLO_COLORS.textMuted,
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          <span style={{ color: litSegments.meltdown ? SEGMENT_COLORS.meltdown : undefined }}>
            {SEGMENT_LABELS.meltdown}
          </span>
          <span style={{ color: litSegments.crash ? SEGMENT_COLORS.crash : undefined }}>
            {SEGMENT_LABELS.crash}
          </span>
          <span style={{ color: litSegments.bust ? SEGMENT_COLORS.bust : undefined }}>
            {SEGMENT_LABELS.bust}
          </span>
          <span style={{ opacity: 0.5 }}>•</span>
          <span style={{ color: litSegments.bagger ? SEGMENT_COLORS.bagger : undefined }}>
            {SEGMENT_LABELS.bagger}
          </span>
          <span style={{ color: litSegments.doubleBagger ? SEGMENT_COLORS.doubleBagger : undefined }}>
            {SEGMENT_LABELS.doubleBagger}
          </span>
          <span style={{ color: litSegments.tenBagger ? SEGMENT_COLORS.tenBagger : undefined }}>
            {SEGMENT_LABELS.tenBagger}
          </span>
        </div>
      )}
    </div>
  );
}

ChamberFuse.propTypes = {
  /** Current price change percentage (e.g., 3.2 for +3.2%) */
  priceChange: PropTypes.number.isRequired,
  /** Base ATR threshold percentage (e.g., 2.8 for 2.8% threshold) */
  baseATR: PropTypes.number.isRequired,
  /** History tracking for persistent segment lighting */
  history: PropTypes.shape({
    /** Highest positive multiplier reached this session */
    maxMultiplier: PropTypes.number,
    /** Lowest negative multiplier reached this session */
    minMultiplier: PropTypes.number,
  }),
  /** Use compact sizing for list rows */
  compact: PropTypes.bool,
  /** Show threshold emoji labels below track */
  showLabels: PropTypes.bool,
  /** Enable needle animations */
  animate: PropTypes.bool,
  /** Callback when threshold is crossed: (thresholdName, currentMultiplier, thresholdValue) */
  onThresholdCross: PropTypes.func,
};

ChamberFuse.defaultProps = {
  history: { maxMultiplier: 0, minMultiplier: 0 },
  compact: false,
  showLabels: true,
  animate: true,
  onThresholdCross: null,
};
