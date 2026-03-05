// /src/components/Dashboard/ClashCard/TugOfWarBar.jsx
// Redesigned tug-of-war progress bar showing score balance between two players
// Green-to-cyan (player) vs red (opponent) with white center divider

import React from 'react';

export default function TugOfWarBar({ myScore = 0, opponentScore = 0 }) {
  const total = Math.abs(myScore) + Math.abs(opponentScore);
  // Clamp between 15% and 85% so neither side ever fully disappears
  const myPercent = total === 0 ? 50 : Math.max(15, Math.min(85, (Math.abs(myScore) / total) * 100));

  return (
    <div style={{
      width: '100%',
      padding: '0 4px',
      marginTop: '12px',
    }}>
      {/* Score labels above bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '4px',
      }}>
        <span style={{
          fontSize: '10px',
          fontWeight: '600',
          color: '#10b981',
          opacity: 0.8,
        }}>
          YOU
        </span>
        <span style={{
          fontSize: '10px',
          fontWeight: '600',
          color: '#ef4444',
          opacity: 0.8,
        }}>
          OPP
        </span>
      </div>

      {/* Bar track */}
      <div style={{
        width: '100%',
        height: '6px',
        borderRadius: '3px',
        background: 'rgba(255, 255, 255, 0.06)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Player fill (left side, green-to-cyan) */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${myPercent}%`,
          background: 'linear-gradient(90deg, #10b981 0%, #00d9ff 100%)',
          borderRadius: '3px 0 0 3px',
          transition: 'width 0.6s ease-out',
          boxShadow: myPercent > 50 ? '0 0 8px rgba(0, 217, 255, 0.3)' : 'none',
        }} />

        {/* Opponent fill (right side, red) */}
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width: `${100 - myPercent}%`,
          background: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)',
          borderRadius: '0 3px 3px 0',
          transition: 'width 0.6s ease-out',
          boxShadow: myPercent < 50 ? '0 0 8px rgba(239, 68, 68, 0.3)' : 'none',
        }} />

        {/* Center divider line */}
        <div style={{
          position: 'absolute',
          left: `${myPercent}%`,
          top: '-1px',
          width: '2px',
          height: 'calc(100% + 2px)',
          background: '#ffffff',
          borderRadius: '1px',
          transform: 'translateX(-50%)',
          transition: 'left 0.6s ease-out',
          boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
        }} />
      </div>
    </div>
  );
}
