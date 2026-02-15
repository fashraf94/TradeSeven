import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';

/**
 * HoldToLaunchButton — Premium hold-to-activate "launch sequence" button.
 *
 * Hold for 1.5s to trigger navigation. Features a circular SVG progress ring
 * around a rocket icon, haptic feedback, and a completion flash animation.
 *
 * @param {Object} props
 * @param {function} props.onComplete — Called after hold completes + exit animation
 */

const HOLD_DURATION = 1500; // 1.5 seconds
const TICK_MS = 16;         // ~60fps
const RING_RADIUS = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const HoldToLaunchButton = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | holding | complete
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const vibratedHalfRef = useRef(false);

  const startHold = useCallback(() => {
    if (phase === 'complete') return;
    setPhase('holding');
    vibratedHalfRef.current = false;
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / HOLD_DURATION, 1);
      setProgress(pct);

      // Haptic at 50%
      if (pct >= 0.5 && !vibratedHalfRef.current) {
        vibratedHalfRef.current = true;
        if (navigator.vibrate) navigator.vibrate(10);
      }

      if (pct >= 1) {
        clearInterval(intervalRef.current);
        setPhase('complete');
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => onComplete(), 400);
      }
    }, TICK_MS);
  }, [phase, onComplete]);

  const stopHold = useCallback(() => {
    if (phase === 'complete') return;
    clearInterval(intervalRef.current);
    setPhase('idle');
    setProgress(0);
  }, [phase]);

  const glowIntensity = progress * 0.6;
  const borderColor = phase === 'complete'
    ? 'rgba(0, 217, 255, 0.8)'
    : `rgba(0, 217, 255, ${0.3 + glowIntensity})`;

  return (
    <motion.button
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onContextMenu={(e) => e.preventDefault()}
      animate={phase === 'complete' ? {
        scale: [1, 1.05, 1],
        backgroundColor: ['#161b22', '#0891b2', '#161b22'],
      } : {}}
      transition={{ duration: 0.4 }}
      style={{
        width: '100%',
        height: 60,
        padding: '0 24px',
        borderRadius: 16,
        border: `2px solid ${borderColor}`,
        background: phase === 'complete'
          ? '#0891b2'
          : `linear-gradient(135deg, #0d1117 0%, #161b22 100%)`,
        boxShadow: `0 0 ${15 + progress * 30}px rgba(0, 217, 255, ${0.15 + glowIntensity})`,
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '2px',
        textTransform: 'uppercase',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        transition: phase === 'holding' ? 'none' : 'all 0.3s ease',
      }}
    >
      {/* Rocket icon with circular progress ring */}
      <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg
          viewBox="0 0 44 44"
          style={{ position: 'absolute', top: 0, left: 0, width: 44, height: 44 }}
        >
          {/* Background ring (track) */}
          <circle
            cx="22" cy="22" r={RING_RADIUS}
            fill="none"
            stroke="rgba(0, 217, 255, 0.15)"
            strokeWidth="3"
          />
          {/* Progress ring */}
          <circle
            cx="22" cy="22" r={RING_RADIUS}
            fill="none"
            stroke="#00d9ff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: '50% 50%',
              transition: phase === 'holding' ? 'none' : 'stroke-dashoffset 0.3s ease-out',
              filter: `drop-shadow(0 0 ${4 + progress * 8}px rgba(0, 217, 255, ${0.5 + progress * 0.5}))`,
            }}
          />
        </svg>
        {/* Rocket icon centered */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          <Rocket
            size={20}
            color={phase === 'complete' ? '#ffffff' : '#00d9ff'}
            style={{
              filter: phase !== 'idle'
                ? `drop-shadow(0 0 4px rgba(0, 217, 255, ${0.5 + progress}))`
                : 'none',
            }}
          />
        </div>
      </div>

      {/* Button text */}
      <span style={{
        position: 'relative',
        zIndex: 1,
        opacity: phase === 'holding' ? (0.7 + progress * 0.3) : 1,
      }}>
        {phase === 'complete'
          ? 'LAUNCHING...'
          : phase === 'holding'
            ? 'ENGAGING...'
            : 'HOLD TO LAUNCH'}
      </span>
    </motion.button>
  );
};

export default HoldToLaunchButton;
