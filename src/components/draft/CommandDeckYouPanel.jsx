import React from 'react';

/**
 * CommandDeckYouPanel - Central "YOU" Panel in Command Deck
 *
 * A bright cyan panel showing the current user's info and draft stats.
 * Features slanted edges, gradient background, and glow effects.
 * Extra pulse animation when it's the user's turn.
 */

const CommandDeckYouPanel = ({
  username = 'YOU',
  stats = {
    steadyPicked: 0,
    riskyPicked: 0,
    defensivePicked: 0,
  },
  isYourTurn = false,
  totalValue = 0,
}) => {
  // Calculate total picks
  const totalPicks = stats.steadyPicked + stats.riskyPicked + stats.defensivePicked;

  // Format display value (placeholder for now)
  const formatValue = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val}`;
  };

  return (
    <div
      className={isYourTurn ? 'pulse-glow' : ''}
      style={{
        position: 'relative',
        minWidth: '180px',
        maxWidth: '240px',
        padding: '12px 32px',
        background: 'linear-gradient(180deg, #00d4ff 0%, #0099cc 100%)',
        clipPath: 'polygon(20px 0, calc(100% - 20px) 0, 100% 100%, 0 100%)',
        boxShadow: isYourTurn
          ? `
            0 0 40px rgba(0, 212, 255, 0.7),
            0 0 60px rgba(0, 212, 255, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.4)
          `
          : `
            0 0 30px rgba(0, 212, 255, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.3)
          `,
        textAlign: 'center',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '20px',
          right: '20px',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
        }}
      />

      {/* Turn indicator badge */}
      {isYourTurn && (
        <div
          style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '2px 12px',
            background: '#ffffff',
            color: '#0099cc',
            fontSize: '9px',
            fontWeight: '800',
            letterSpacing: '1.5px',
            borderRadius: '2px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            textTransform: 'uppercase',
          }}
        >
          Your Turn
        </div>
      )}

      {/* Category indicator (D for position in draft order) */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '24px',
          width: '18px',
          height: '18px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: '700',
          color: 'rgba(10, 14, 20, 0.8)',
        }}
      >
        D
      </div>

      {/* Main "YOU" text */}
      <div
        style={{
          fontSize: '26px',
          fontWeight: '800',
          color: '#0a0e14',
          letterSpacing: '2px',
          textShadow: '0 1px 0 rgba(255, 255, 255, 0.3)',
          marginTop: '4px',
        }}
      >
        {username.toUpperCase()}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          marginTop: '6px',
          fontSize: '13px',
          fontWeight: '700',
          color: '#0a0e14',
          opacity: 0.9,
        }}
      >
        <span>{formatValue(totalValue)}</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>R{stats.riskyPicked}</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>D{stats.defensivePicked}</span>
      </div>

      {/* Progress indicator - picks remaining */}
      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
        }}
      >
        {[...Array(9)].map((_, idx) => (
          <div
            key={idx}
            style={{
              width: '8px',
              height: '4px',
              borderRadius: '1px',
              background: idx < totalPicks
                ? 'rgba(10, 14, 20, 0.7)'
                : 'rgba(10, 14, 20, 0.2)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Bottom shine effect */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '20px',
          background: 'linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.1))',
          pointerEvents: 'none',
        }}
      />

      {/* Corner accents */}
      <div
        style={{
          position: 'absolute',
          bottom: '4px',
          left: '4px',
          width: '12px',
          height: '12px',
          borderLeft: '2px solid rgba(10, 14, 20, 0.2)',
          borderBottom: '2px solid rgba(10, 14, 20, 0.2)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '4px',
          right: '4px',
          width: '12px',
          height: '12px',
          borderRight: '2px solid rgba(10, 14, 20, 0.2)',
          borderBottom: '2px solid rgba(10, 14, 20, 0.2)',
        }}
      />
    </div>
  );
};

export default CommandDeckYouPanel;
