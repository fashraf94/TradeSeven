import React, { useEffect, useRef } from 'react';

/**
 * HoloTimer - Massive Glowing Timer Display
 *
 * A large digital timer with color-coded states and glow effects.
 * Changes appearance based on time remaining:
 * - > 60s: Cyan (safe)
 * - 30-60s: Yellow/amber (warning)
 * - < 30s: Red + pulse (critical)
 * - < 10s: Red + faster pulse + shake (urgent)
 */

const HoloTimer = ({
  seconds = 120,
  isYourTurn = false,
  onExpire,
}) => {
  const hasExpiredRef = useRef(false);

  // Determine timer state
  const getTimerState = () => {
    if (seconds > 60) return 'safe';
    if (seconds > 30) return 'warning';
    if (seconds > 10) return 'critical';
    return 'urgent';
  };

  const timerState = getTimerState();

  // Color configurations for each state
  const stateConfig = {
    safe: {
      color: '#00ffff',
      glowColor: 'rgba(0, 255, 255, 0.8)',
      glowColorMid: 'rgba(0, 255, 255, 0.4)',
      glowColorOuter: 'rgba(0, 255, 255, 0.2)',
    },
    warning: {
      color: '#ffaa00',
      glowColor: 'rgba(255, 170, 0, 0.8)',
      glowColorMid: 'rgba(255, 170, 0, 0.4)',
      glowColorOuter: 'rgba(255, 170, 0, 0.2)',
    },
    critical: {
      color: '#ff3366',
      glowColor: 'rgba(255, 51, 102, 0.8)',
      glowColorMid: 'rgba(255, 51, 102, 0.4)',
      glowColorOuter: 'rgba(255, 51, 102, 0.2)',
    },
    urgent: {
      color: '#ff3366',
      glowColor: 'rgba(255, 51, 102, 0.9)',
      glowColorMid: 'rgba(255, 51, 102, 0.5)',
      glowColorOuter: 'rgba(255, 51, 102, 0.3)',
    },
  };

  const config = stateConfig[timerState];

  // Format time as M:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Handle timer expiration
  useEffect(() => {
    if (seconds <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpire?.();
    } else if (seconds > 0) {
      hasExpiredRef.current = false;
    }
  }, [seconds, onExpire]);

  // Animation class based on state
  const getAnimationClass = () => {
    if (timerState === 'urgent') return 'timer-urgent';
    if (timerState === 'critical') return 'timer-critical';
    return '';
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Background glow effect */}
      <div
        style={{
          position: 'absolute',
          width: '120px',
          height: '60px',
          background: `radial-gradient(ellipse, ${config.glowColorMid} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          opacity: timerState === 'safe' ? 0.5 : 0.8,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Timer display */}
      <div
        className={getAnimationClass()}
        style={{
          position: 'relative',
          fontSize: '56px',
          fontWeight: '700',
          fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
          letterSpacing: '4px',
          color: config.color,
          textShadow: `
            0 0 20px ${config.glowColor},
            0 0 40px ${config.glowColorMid},
            0 0 60px ${config.glowColorOuter}
          `,
          transition: 'color 0.3s ease',
          zIndex: 1,
        }}
      >
        {formatTime(seconds)}
      </div>

      {/* "YOUR TURN" indicator when active */}
      {isYourTurn && (
        <div
          style={{
            marginTop: '8px',
            padding: '4px 16px',
            background: `${config.color}20`,
            border: `1px solid ${config.color}60`,
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '700',
            color: config.color,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            animation: timerState === 'urgent' || timerState === 'critical'
              ? 'pulse-badge 1s ease-in-out infinite'
              : 'none',
          }}
        >
          Your Turn
        </div>
      )}

      {/* Countdown warning for low time */}
      {timerState === 'urgent' && (
        <div
          style={{
            position: 'absolute',
            bottom: '-30px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '10px',
            fontWeight: '600',
            color: config.color,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            animation: 'blink 0.5s ease-in-out infinite',
          }}
        >
          Time Running Out!
        </div>
      )}

      {/* Animations and classes consolidated in index.css: timer-pulse, timer-pulse-fast, timer-shake, pulse-badge, blink, .timer-critical, .timer-urgent, .timer-final */}
    </div>
  );
};

/**
 * Compact version for header bar
 */
export const HoloTimerCompact = ({
  seconds = 120,
  isYourTurn = false,
}) => {
  const getTimerState = () => {
    if (seconds > 60) return 'safe';
    if (seconds > 30) return 'warning';
    return 'critical';
  };

  const timerState = getTimerState();

  const colors = {
    safe: '#00ffff',
    warning: '#ffaa00',
    critical: '#ff3366',
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={timerState === 'critical' ? 'pulse-glow-fast' : ''}
      style={{
        fontSize: '24px',
        fontWeight: '700',
        fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
        letterSpacing: '2px',
        color: colors[timerState],
        textShadow: `0 0 15px ${colors[timerState]}80`,
      }}
    >
      {formatTime(seconds)}
    </div>
  );
};

/**
 * Inline timer for mobile headers
 */
export const HoloTimerInline = ({
  seconds = 120,
}) => {
  const getTimerState = () => {
    if (seconds > 60) return 'safe';
    if (seconds > 30) return 'warning';
    return 'critical';
  };

  const timerState = getTimerState();

  const colors = {
    safe: '#00ffff',
    warning: '#ffaa00',
    critical: '#ff3366',
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <span
      style={{
        fontSize: '32px',
        fontWeight: '700',
        fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
        letterSpacing: '2px',
        color: colors[timerState],
        textShadow: `
          0 0 15px ${colors[timerState]}80,
          0 0 30px ${colors[timerState]}40
        `,
      }}
    >
      {formatTime(seconds)}
    </span>
  );
};

export default HoloTimer;
