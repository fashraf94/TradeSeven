/**
 * TournamentModeToggle
 * Toggle switch between Practice and Tournament modes
 */

import React from 'react';

const TournamentModeToggle = ({
  user,
  tournamentMode,
  setTournamentMode
}) => {
  if (!user) {
    return (
      <div style={{
        background: '#1a1a2e',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '12px',
        textAlign: 'center'
      }}>
        <span style={{ color: '#6b7280', fontSize: '13px' }}>
          Sign in to compete in tournaments
        </span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      marginBottom: '12px'
    }}>
      <button
        onClick={() => setTournamentMode(false)}
        style={{
          flex: 1,
          padding: '10px',
          borderRadius: '8px',
          border: !tournamentMode ? '2px solid #00d9ff' : '1px solid #2d3748',
          background: !tournamentMode ? 'rgba(0, 217, 255, 0.1)' : '#1a1a2e',
          color: !tournamentMode ? '#00d9ff' : '#9ca3af',
          cursor: 'pointer',
          fontWeight: '600'
        }}
      >
        Practice Mode
      </button>
      <button
        onClick={() => setTournamentMode(true)}
        style={{
          flex: 1,
          padding: '10px',
          borderRadius: '8px',
          border: tournamentMode ? '2px solid #10b981' : '1px solid #2d3748',
          background: tournamentMode ? 'rgba(16, 185, 129, 0.1)' : '#1a1a2e',
          color: tournamentMode ? '#10b981' : '#9ca3af',
          cursor: 'pointer',
          fontWeight: '600'
        }}
      >
        🏆 Tournament
      </button>
    </div>
  );
};

export default TournamentModeToggle;
