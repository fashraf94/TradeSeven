import React from 'react';

export default function GameModeToggle({ gameMode, setGameMode, colors }) {
  return (
    <div
      id="tour-game-mode-toggle"
      style={{
        background: '#161b22',
        borderBottom: '1px solid #21262d',
        padding: '12px 16px',
        marginBottom: '16px'
      }}
    >
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'center',
        gap: '8px'
      }}>
        {/* Snake Draft 4P - LEFT (default) */}
        <button
          id="tour-snake-draft-btn"
          onClick={() => setGameMode('draft')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: gameMode === 'draft' ? '2px solid #10b981' : '2px solid #21262d',
            background: gameMode === 'draft' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
            color: gameMode === 'draft' ? '#10b981' : '#8b949e',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Snake Draft 4P
        </button>
        {/* Builder 1v1 - RIGHT */}
        <button
          id="tour-builder-btn"
          onClick={() => setGameMode('classic')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: gameMode === 'classic' ? '2px solid #00d9ff' : '2px solid #21262d',
            background: gameMode === 'classic' ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
            color: gameMode === 'classic' ? '#00d9ff' : '#8b949e',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Builder 1v1
        </button>
      </div>
    </div>
  );
}
