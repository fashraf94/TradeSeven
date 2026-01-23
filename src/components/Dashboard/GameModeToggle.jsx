import React, { useState } from 'react';

export default function GameModeToggle({ gameMode, setGameMode, setShowResearchMode, setScreen, colors }) {
  // Hover states for navigation buttons
  const [researchHover, setResearchHover] = useState(false);
  const [earningsHover, setEarningsHover] = useState(false);

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
        gap: '8px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        {/* Snake Draft 4P - Toggle button */}
        <button
          id="tour-snake-draft-btn"
          onClick={() => setGameMode('draft')}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: gameMode === 'draft' ? '2px solid #10b981' : '2px solid #21262d',
            background: gameMode === 'draft' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
            color: gameMode === 'draft' ? '#10b981' : '#8b949e',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          Snake Draft 4P
        </button>
        {/* Builder 1v1 - Toggle button */}
        <button
          id="tour-builder-btn"
          onClick={() => setGameMode('classic')}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: gameMode === 'classic' ? '2px solid #00d9ff' : '2px solid #21262d',
            background: gameMode === 'classic' ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
            color: gameMode === 'classic' ? '#00d9ff' : '#8b949e',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          Builder 1v1
        </button>
        {/* Research - Navigation button */}
        <button
          id="tour-research-btn"
          onClick={() => setShowResearchMode(true)}
          onMouseEnter={() => setResearchHover(true)}
          onMouseLeave={() => setResearchHover(false)}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(0, 217, 255, 0.4)',
            background: 'rgba(0, 217, 255, 0.08)',
            color: '#00d9ff',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: researchHover ? '0 0 20px rgba(0, 217, 255, 0.3)' : 'none'
          }}
        >
          Research
        </button>
        {/* EarningsGame - Navigation button */}
        <button
          id="tour-earnings-btn"
          onClick={() => setScreen('earningsGame')}
          onMouseEnter={() => setEarningsHover(true)}
          onMouseLeave={() => setEarningsHover(false)}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            background: 'rgba(245, 158, 11, 0.08)',
            color: '#f59e0b',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: earningsHover ? '0 0 20px rgba(245, 158, 11, 0.3)' : 'none'
          }}
        >
          EarningsGame
        </button>
      </div>
    </div>
  );
}
