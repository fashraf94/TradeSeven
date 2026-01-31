// TriggerCelebration - Enhanced threshold crossing celebration
// Card-contained animation with particle burst, badge slam, and floating points

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Badge configuration
const BADGE_CONFIG = {
  bagger: { icon: '💣', label: 'BaggerBomb', points: 15 },
  doubleBagger: { icon: '💣💣', label: 'Double Bagger', points: 30 },
  tenBagger: { icon: '🚀', label: 'TenBagger!', points: 50 },
  bust: { icon: '📉', label: 'Bust', points: -10 },
  crash: { icon: '💥', label: 'Crash', points: -20 },
  meltdown: { icon: '🔥', label: 'Meltdown', points: -35 },
};

/**
 * Particle - Single particle in the burst effect
 */
function Particle({ angle, delay, isPositive }) {
  const distance = 60 + Math.random() * 40;
  const size = 4 + Math.random() * 4;
  const duration = 0.4 + Math.random() * 0.2;

  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;

  return (
    <motion.div
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      animate={{ x, y, scale: 0, opacity: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
        boxShadow: `0 0 ${size}px ${isPositive ? HOLO_COLORS.green : HOLO_COLORS.red}`,
      }}
    />
  );
}

Particle.propTypes = {
  angle: PropTypes.number.isRequired,
  delay: PropTypes.number,
  isPositive: PropTypes.bool,
};

/**
 * ParticleBurst - Multiple particles exploding outward
 */
function ParticleBurst({ isPositive, particleCount = 6 }) {
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    angle: (i / particleCount) * Math.PI * 2 + Math.random() * 0.5,
    delay: Math.random() * 0.1,
  }));

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      {particles.map((p, i) => (
        <Particle
          key={i}
          angle={p.angle}
          delay={p.delay}
          isPositive={isPositive}
        />
      ))}
    </div>
  );
}

ParticleBurst.propTypes = {
  isPositive: PropTypes.bool,
  particleCount: PropTypes.number,
};

/**
 * FloatingPoints - Points that float up (positive) or sink down (negative)
 */
function FloatingPoints({ points, isPositive }) {
  return (
    <motion.div
      initial={{ y: 0, opacity: 1, scale: 0.8 }}
      animate={{
        y: isPositive ? -40 : 40,
        opacity: 0,
        scale: 1.2,
      }}
      transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        top: isPositive ? '20%' : '80%',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '24px',
        fontWeight: 700,
        color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
        textShadow: `0 0 10px ${isPositive ? HOLO_COLORS.green : HOLO_COLORS.red}`,
        whiteSpace: 'nowrap',
      }}
    >
      {points > 0 ? '+' : ''}{points}
    </motion.div>
  );
}

FloatingPoints.propTypes = {
  points: PropTypes.number.isRequired,
  isPositive: PropTypes.bool,
};

/**
 * GlowPulse - Background glow that pulses
 */
function GlowPulse({ isPositive }) {
  const color = isPositive ? HOLO_COLORS.green : HOLO_COLORS.red;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.3, 0] }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        inset: -20,
        borderRadius: '16px',
        background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        pointerEvents: 'none',
      }}
    />
  );
}

GlowPulse.propTypes = {
  isPositive: PropTypes.bool,
};

/**
 * ChainIndicator - Shows "CHAIN x3" for multiple triggers
 */
function ChainIndicator({ count }) {
  if (count <= 1) return null;

  return (
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.3 }}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        padding: '4px 8px',
        backgroundColor: HOLO_COLORS.amber,
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        color: HOLO_COLORS.bgDeep,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      Chain x{count}
    </motion.div>
  );
}

ChainIndicator.propTypes = {
  count: PropTypes.number.isRequired,
};

/**
 * TriggerCelebration - Main celebration component
 */
export default function TriggerCelebration({
  trigger,
  chainCount = 1,
  cumulativePoints = null,
  onComplete,
  autoHide = true,
  duration = 800,
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoHide && trigger) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onComplete) onComplete();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [trigger, autoHide, duration, onComplete]);

  if (!trigger || !visible) return null;

  const config = BADGE_CONFIG[trigger.name] || BADGE_CONFIG.bagger;
  const isPositive = ['bagger', 'doubleBagger', 'tenBagger'].includes(trigger.name);
  const displayPoints = cumulativePoints !== null ? cumulativePoints : (trigger.points || config.points);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'relative',
          width: '200px',
          height: '140px',
          backgroundColor: HOLO_COLORS.bgElevated,
          borderRadius: '16px',
          border: `2px solid ${isPositive ? HOLO_COLORS.green : HOLO_COLORS.red}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Background glow pulse */}
        <GlowPulse isPositive={isPositive} />

        {/* Particle burst */}
        <ParticleBurst isPositive={isPositive} />

        {/* Chain indicator */}
        <ChainIndicator count={chainCount} />

        {/* Badge with slam animation */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: [0, 1.4, 1], rotate: [20, -5, 0] }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ fontSize: '48px', zIndex: 10 }}
        >
          {config.icon}
        </motion.div>

        {/* Symbol */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            marginTop: '4px',
            fontSize: '14px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
            zIndex: 10,
          }}
        >
          {trigger.symbol}
        </motion.div>

        {/* Label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            fontSize: '11px',
            color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
            fontWeight: 600,
            zIndex: 10,
          }}
        >
          {config.label}
        </motion.div>

        {/* Floating points */}
        <FloatingPoints points={displayPoints} isPositive={isPositive} />
      </motion.div>
    </AnimatePresence>
  );
}

TriggerCelebration.propTypes = {
  /** Trigger object with name, symbol, points */
  trigger: PropTypes.shape({
    name: PropTypes.oneOf(['bagger', 'doubleBagger', 'tenBagger', 'bust', 'crash', 'meltdown']),
    symbol: PropTypes.string,
    points: PropTypes.number,
  }),
  /** Number of chained triggers (for "CHAIN x3" indicator) */
  chainCount: PropTypes.number,
  /** Cumulative points to show (for chain sequences) */
  cumulativePoints: PropTypes.number,
  /** Callback when animation completes */
  onComplete: PropTypes.func,
  /** Auto-hide after duration */
  autoHide: PropTypes.bool,
  /** Duration before auto-hide (ms) */
  duration: PropTypes.number,
};

TriggerCelebration.defaultProps = {
  trigger: null,
  chainCount: 1,
  cumulativePoints: null,
  onComplete: null,
  autoHide: true,
  duration: 800,
};

// Export sub-components for custom usage
export { ParticleBurst, FloatingPoints, GlowPulse, ChainIndicator, BADGE_CONFIG };
