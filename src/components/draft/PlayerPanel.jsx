import React, { useState, useEffect } from 'react';

/**
 * PlayerPanel - Opponent/Player Panel for Zone B
 *
 * Shows player information with three visual states:
 * 1. Normal (waiting) - dark background, subtle glow
 * 2. Active/Picking - bright cyan border, pulsing glow, progress bar
 * 3. Just Picked - green flash, checkmark animation
 */

const PlayerPanel = ({
  username = 'Player',
  isCurrentPicker = false,
  isYou = false,
  isCPU = false,
  stats = {
    steadyPicked: 0,
    riskyPicked: 0,
    defensivePicked: 0,
  },
  lastPick,
  pickProgress = 0,
  compact = false,
}) => {
  const [showPickFlash, setShowPickFlash] = useState(false);
  const [prevLastPick, setPrevLastPick] = useState(lastPick);

  // Detect when a pick is made and trigger flash
  useEffect(() => {
    if (lastPick && lastPick !== prevLastPick) {
      setShowPickFlash(true);
      const timer = setTimeout(() => setShowPickFlash(false), 1500);
      setPrevLastPick(lastPick);
      return () => clearTimeout(timer);
    }
  }, [lastPick, prevLastPick]);

  // Calculate total picks
  const totalPicks = stats.steadyPicked + stats.riskyPicked + stats.defensivePicked;

  // Determine visual state
  const getState = () => {
    if (showPickFlash) return 'picked';
    if (isCurrentPicker) return 'picking';
    return 'waiting';
  };

  const state = getState();

  // State-based styling
  const stateStyles = {
    waiting: {
      background: 'var(--holo-bg-card, rgba(10, 20, 30, 0.85))',
      border: '1px solid var(--holo-border, rgba(0, 255, 255, 0.3))',
      boxShadow: '0 0 10px rgba(0, 255, 255, 0.1)',
    },
    picking: {
      background: 'rgba(0, 255, 255, 0.1)',
      border: '2px solid var(--neon-cyan, #00ffff)',
      boxShadow: `
        0 0 20px rgba(0, 255, 255, 0.5),
        0 0 40px rgba(0, 255, 255, 0.3),
        inset 0 0 20px rgba(0, 255, 255, 0.1)
      `,
    },
    picked: {
      background: 'rgba(0, 255, 136, 0.15)',
      border: '2px solid var(--neon-green, #00ff88)',
      boxShadow: '0 0 30px rgba(0, 255, 136, 0.5)',
    },
  };

  const currentStyle = stateStyles[state];

  if (compact) {
    return (
      <div
        className={state === 'picking' ? 'picker-pulse' : ''}
        style={{
          position: 'relative',
          padding: '8px 16px',
          borderRadius: '6px',
          textAlign: 'center',
          minWidth: '100px',
          transition: 'all 0.3s ease',
          ...currentStyle,
        }}
      >
        {/* Picking badge */}
        {state === 'picking' && (
          <div
            style={{
              position: 'absolute',
              top: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '2px 10px',
              background: 'var(--neon-cyan, #00ffff)',
              color: '#0a0e14',
              fontSize: '8px',
              fontWeight: '800',
              letterSpacing: '1px',
              borderRadius: '2px',
              textTransform: 'uppercase',
            }}
          >
            Picking
          </div>
        )}

        {/* Username */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          {isCPU && <span style={{ fontSize: '10px' }}>🤖</span>}
          <span
            style={{
              color: state === 'picking' ? 'var(--neon-cyan)' : '#e6edf3',
              fontWeight: '600',
              fontSize: '13px',
            }}
          >
            {isYou ? 'YOU' : username}
          </span>
          {isYou && <span style={{ color: 'var(--neon-cyan)', fontSize: '10px' }}>★</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={state === 'picking' ? 'picker-pulse' : ''}
      style={{
        position: 'relative',
        padding: '12px 20px',
        borderRadius: '8px',
        textAlign: 'center',
        minWidth: '120px',
        transition: 'all 0.3s ease',
        ...currentStyle,
      }}
    >
      {/* Picking badge */}
      {state === 'picking' && (
        <div
          style={{
            position: 'absolute',
            top: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '3px 14px',
            background: 'var(--neon-cyan, #00ffff)',
            color: '#0a0e14',
            fontSize: '9px',
            fontWeight: '800',
            letterSpacing: '1.5px',
            borderRadius: '2px',
            textTransform: 'uppercase',
            boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)',
          }}
        >
          Picking
        </div>
      )}

      {/* Pick flash checkmark */}
      {state === 'picked' && (
        <div
          className="pick-check-animation"
          style={{
            position: 'absolute',
            top: '-12px',
            right: '-8px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--neon-green, #00ff88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(0, 255, 136, 0.6)',
            zIndex: 2,
          }}
        >
          <span style={{ color: '#0a0e14', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
        </div>
      )}

      {/* Username row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginBottom: '4px',
        }}
      >
        {isCPU && <span style={{ fontSize: '12px' }}>🤖</span>}
        <span
          style={{
            color: state === 'picking'
              ? 'var(--neon-cyan)'
              : state === 'picked'
                ? 'var(--neon-green)'
                : '#ffffff',
            fontWeight: '700',
            fontSize: '14px',
            textShadow: state === 'picking'
              ? '0 0 10px rgba(0, 255, 255, 0.5)'
              : 'none',
          }}
        >
          {isYou ? 'YOU' : username}
        </span>
        {isYou && (
          <span
            style={{
              color: 'var(--neon-cyan)',
              fontSize: '12px',
              textShadow: '0 0 8px rgba(0, 255, 255, 0.6)',
            }}
          >
            ★
          </span>
        )}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '11px',
          color: '#6e7681',
        }}
      >
        <span style={{ color: '#00ffff' }}>S{stats.steadyPicked}</span>
        <span style={{ color: '#f59e0b' }}>R{stats.riskyPicked}</span>
        <span style={{ color: '#10b981' }}>D{stats.defensivePicked}</span>
      </div>

      {/* Progress bar (for picking state) */}
      {state === 'picking' && pickProgress > 0 && (
        <div
          style={{
            marginTop: '8px',
            height: '3px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pickProgress * 100}%`,
              background: pickProgress > 0.7
                ? 'var(--neon-red, #ff3366)'
                : 'var(--neon-cyan, #00ffff)',
              boxShadow: pickProgress > 0.7
                ? '0 0 10px rgba(255, 51, 102, 0.6)'
                : '0 0 10px rgba(0, 255, 255, 0.6)',
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Last pick indicator */}
      {lastPick && state === 'picked' && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '10px',
            color: 'var(--neon-green)',
            fontWeight: '600',
          }}
        >
          Picked: {lastPick}
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes picker-pulse {
          0%, 100% {
            box-shadow:
              0 0 20px rgba(0, 255, 255, 0.5),
              0 0 40px rgba(0, 255, 255, 0.3),
              inset 0 0 20px rgba(0, 255, 255, 0.1);
          }
          50% {
            box-shadow:
              0 0 30px rgba(0, 255, 255, 0.7),
              0 0 50px rgba(0, 255, 255, 0.4),
              inset 0 0 25px rgba(0, 255, 255, 0.15);
          }
        }

        .picker-pulse {
          animation: picker-pulse 2s ease-in-out infinite;
        }

        @keyframes pick-check-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .pick-check-animation {
          animation: pick-check-pop 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default PlayerPanel;
