import React, { useState } from 'react';

export default function GameModeToggle({ activeTab = 'games', setShowResearchMode, setScreen, colors }) {
  // Hover states for all tabs
  const [gamesHover, setGamesHover] = useState(false);
  const [researchHover, setResearchHover] = useState(false);
  const [earningsHover, setEarningsHover] = useState(false);

  // Games tab is always "active" when on dashboard (it's the default view)
  const isGamesActive = activeTab === 'games';

  // Base tab style
  const tabBaseStyle = {
    padding: '12px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  // Inactive tab style
  const tabInactiveStyle = {
    ...tabBaseStyle,
    background: 'rgba(22, 27, 34, 0.8)',
    border: '1px solid #21262d',
    color: '#8b949e',
    boxShadow: 'none',
  };

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
        gap: '10px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        {/* Games - Active tab (shows carousels) */}
        <button
          id="tour-games-btn"
          onMouseEnter={() => setGamesHover(true)}
          onMouseLeave={() => setGamesHover(false)}
          style={isGamesActive ? {
            ...tabBaseStyle,
            background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
            border: '1px solid rgba(0, 255, 255, 0.5)',
            color: '#00ffff',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          } : {
            ...tabInactiveStyle,
            borderColor: gamesHover ? 'rgba(255, 255, 255, 0.2)' : '#21262d',
            background: gamesHover ? 'rgba(22, 27, 34, 1)' : 'rgba(22, 27, 34, 0.8)',
            color: gamesHover ? '#e6edf3' : '#8b949e',
          }}
        >
          {/* Inner shine overlay for active state */}
          {isGamesActive && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
              pointerEvents: 'none',
              borderRadius: '12px 12px 0 0',
            }} />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>Games</span>
        </button>

        {/* Research - Navigation button */}
        <button
          id="tour-research-btn"
          onClick={() => setShowResearchMode(true)}
          onMouseEnter={() => setResearchHover(true)}
          onMouseLeave={() => setResearchHover(false)}
          style={{
            ...tabBaseStyle,
            background: researchHover
              ? 'linear-gradient(135deg, rgba(0, 217, 255, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
            border: '1px solid rgba(0, 217, 255, 0.5)',
            color: '#00d9ff',
            boxShadow: researchHover
              ? '0 0 25px rgba(0, 217, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 0 15px rgba(0, 217, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Inner shine overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
            pointerEvents: 'none',
            borderRadius: '12px 12px 0 0',
          }} />
          <span style={{ position: 'relative', zIndex: 1 }}>Research</span>
        </button>

        {/* EarningsGame - Navigation button */}
        <button
          id="tour-earnings-btn"
          onClick={() => setScreen('earningsGame')}
          onMouseEnter={() => setEarningsHover(true)}
          onMouseLeave={() => setEarningsHover(false)}
          style={{
            ...tabBaseStyle,
            background: earningsHover
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            color: '#f59e0b',
            boxShadow: earningsHover
              ? '0 0 25px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 0 15px rgba(245, 158, 11, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Inner shine overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
            pointerEvents: 'none',
            borderRadius: '12px 12px 0 0',
          }} />
          <span style={{ position: 'relative', zIndex: 1 }}>EarningsGame</span>
        </button>
      </div>
    </div>
  );
}
