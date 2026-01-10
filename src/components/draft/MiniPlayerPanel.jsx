import React from 'react';

/**
 * MiniPlayerPanel - Compact horizontal player panel for phone layout
 *
 * Displays player info in a minimal form for the horizontal mini-arc
 * on phone screens (< 768px). Shows name, status badge, and S/R/D counts.
 */

const MiniPlayerPanel = ({
  player,
  isCurrentPicker = false,
  isNextPicker = false,
  isYou = false
}) => {
  // Determine visual state
  const state = isCurrentPicker ? 'picking' : isNextPicker ? 'next' : 'waiting';

  const stateStyles = {
    picking: {
      border: '2px solid #00ff88',
      boxShadow: '0 0 12px rgba(0, 255, 136, 0.5)',
      background: '#0d1a14'
    },
    next: {
      border: '2px solid #ff9500',
      boxShadow: '0 0 10px rgba(255, 149, 0, 0.4)',
      background: '#1a1510'
    },
    waiting: {
      border: '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: 'none',
      background: '#0d1117'
    }
  };

  const style = stateStyles[state];

  // Truncate display name for small panels
  const displayName = isYou
    ? 'YOU'
    : (player?.displayName || 'Player').slice(0, 8);

  return (
    <div
      className="mini-player-panel"
      style={{
        position: 'relative',
        minWidth: '68px',
        maxWidth: '85px',
        padding: '6px 8px',
        borderRadius: '8px',
        textAlign: 'center',
        zIndex: 10,
        transition: 'all 0.3s ease',
        ...style
      }}
    >
      {/* Status Badge - PICKING or UP NEXT */}
      {(isCurrentPicker || isNextPicker) && (
        <div style={{
          position: 'absolute',
          top: '-9px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '7px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
          background: isCurrentPicker ? '#00ff88' : '#ff9500',
          color: '#000',
          boxShadow: isCurrentPicker
            ? '0 0 8px rgba(0, 255, 136, 0.6)'
            : '0 0 8px rgba(255, 149, 0, 0.6)'
        }}>
          {isCurrentPicker ? 'PICKING' : 'UP NEXT'}
        </div>
      )}

      {/* Player Name */}
      <div style={{
        fontSize: '10px',
        fontWeight: '600',
        color: isYou ? '#00ff88' : '#fff',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        marginTop: (isCurrentPicker || isNextPicker) ? '4px' : '0',
        textShadow: isYou ? '0 0 8px rgba(0, 255, 136, 0.5)' : 'none'
      }}>
        {displayName}{isYou && ' ★'}
      </div>

      {/* S/R/D Stats */}
      <div style={{
        fontSize: '9px',
        display: 'flex',
        justifyContent: 'center',
        gap: '4px',
        marginTop: '3px',
        fontWeight: '500'
      }}>
        <span style={{ color: '#00d9ff' }}>S{player?.categories?.steady || 0}</span>
        <span style={{ color: '#f59e0b' }}>R{player?.categories?.risky || 0}</span>
        <span style={{ color: '#10b981' }}>D{player?.categories?.defensive || 0}</span>
      </div>

      {/* CSS for picking pulse animation */}
      {isCurrentPicker && (
        <style>{`
          @keyframes mini-picking-pulse {
            0%, 100% { box-shadow: 0 0 12px rgba(0, 255, 136, 0.5); }
            50% { box-shadow: 0 0 18px rgba(0, 255, 136, 0.7); }
          }
          .mini-player-panel:has([data-picking="true"]) {
            animation: mini-picking-pulse 1.5s ease-in-out infinite;
          }
        `}</style>
      )}
    </div>
  );
};

export default MiniPlayerPanel;
