// ChamberFuse - Bidirectional threshold gauge for BaggerBomb
// Shows proximity to 6 thresholds (3 positive, 3 negative)
// Segments stay lit once crossed (via history tracking)

import React, { useMemo, useEffect, useRef } from 'react';
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

// Segment colors when lit
const SEGMENT_COLORS = {
  // Positive (left to right after center)
  bagger: HOLO_COLORS.green,       // #00ff88
  doubleBagger: HOLO_COLORS.amber, // #f59e0b
  tenBagger: HOLO_COLORS.purple,   // #8b5cf6
  // Negative (right to left before center)
  bust: HOLO_COLORS.amber,         // #f59e0b
  crash: HOLO_COLORS.red,          // #ff3366
  meltdown: '#991b1b',             // Deep red
};

// Segment glows when lit
const SEGMENT_GLOWS = {
  bagger: `0 0 12px ${HOLO_COLORS.green}80`,
  doubleBagger: `0 0 12px ${HOLO_COLORS.amber}80`,
  tenBagger: `0 0 12px ${HOLO_COLORS.purple}80`,
  bust: `0 0 12px ${HOLO_COLORS.amber}80`,
  crash: `0 0 12px ${HOLO_COLORS.red}80`,
  meltdown: '0 0 12px #991b1b80',
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

/**
 * Map a multiplier value to track percentage position
 * Range: -2.5 (0%) to +2.5 (100%), with 0 at 50%
 */
const valueToPercent = (multiplier, rangeMax = 2.5) => {
  const clamped = Math.max(-rangeMax, Math.min(rangeMax, multiplier));
  return ((clamped + rangeMax) / (rangeMax * 2)) * 100;
};

/**
 * FuseSegment - Individual segment of the fuse track
 */
function FuseSegment({ name, lit, color, glow, width, position }) {
  return (
    <motion.div
      animate={{
        backgroundColor: lit ? color : HOLO_COLORS.bgElevated,
        opacity: lit ? 1 : 0.3,
        boxShadow: lit ? glow : 'none',
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        width,
        height: '100%',
        borderRight: position !== 'last' ? `1px solid ${HOLO_COLORS.borderSubtle}` : 'none',
        borderLeft: position === 'first' ? 'none' : undefined,
      }}
    />
  );
}

FuseSegment.propTypes = {
  name: PropTypes.string.isRequired,
  lit: PropTypes.bool.isRequired,
  color: PropTypes.string.isRequired,
  glow: PropTypes.string.isRequired,
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

  // Calculate needle position as percentage
  const needlePosition = useMemo(() => valueToPercent(currentMultiplier), [currentMultiplier]);

  // Sizes based on compact mode
  const trackHeight = compact ? 16 : 24;
  const needleSize = compact ? 12 : 16;
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

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: trackHeight + (showLabels ? 20 : 0),
        userSelect: 'none',
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
            color={SEGMENT_COLORS[seg.name]}
            glow={SEGMENT_GLOWS[seg.name]}
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

      {/* Animated Needle - intensity-based vibration */}
      <motion.div
        animate={{
          left: `${needlePosition}%`,
          // Vibration amplitude scales with intensity (0.3 = subtle, 1.0 = strong)
          x: animate && isPrimed ? [-3 * primedIntensity, 3 * primedIntensity, -2 * primedIntensity, 2 * primedIntensity, 0] : 0,
          scale: isPrimed ? 1 + (0.15 * primedIntensity) : 1,
        }}
        transition={{
          left: { type: 'spring', stiffness: 80, damping: 15 },
          x: isPrimed ? { duration: 0.2 + (0.15 * (1 - primedIntensity)), repeat: Infinity, ease: 'easeInOut' } : { duration: 0 },
          scale: { duration: 0.2 },
        }}
        style={{
          position: 'absolute',
          top: trackHeight / 2,
          width: needleSize,
          height: needleSize,
          marginLeft: -needleSize / 2,
          marginTop: -needleSize / 2,
          borderRadius: '50%',
          backgroundColor: isPrimed ? HOLO_COLORS.amber : HOLO_COLORS.cyan,
          border: `2px solid ${HOLO_COLORS.textPrimary}`,
          // Glow intensity scales with proximity
          boxShadow: isPrimed
            ? `0 0 ${12 + (8 * primedIntensity)}px ${HOLO_COLORS.amber}, 0 0 ${20 + (15 * primedIntensity)}px ${HOLO_COLORS.amber}40`
            : GLOW_EFFECTS.cyan,
          zIndex: 10,
        }}
      />

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
