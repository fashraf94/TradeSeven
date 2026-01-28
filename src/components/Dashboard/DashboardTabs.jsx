// /src/components/Dashboard/DashboardTabs.jsx
// 3-tab navigation: PVP | TRAIN & EARN | RESEARCH
// Active tab: amber fill with dark text. Inactive: dark bg with grey text.
// RESEARCH tab opens research modal (same behavior as before).

import React, { useState } from 'react';

const TABS = [
  { id: 'pvp', label: 'PVP', icon: '⚔️' },
  { id: 'train', label: 'TRAIN & EARN', icon: '🪙' },
  { id: 'research', label: 'RESEARCH', icon: '📊' },
];

export default function DashboardTabs({ activeTab, setActiveTab, setShowResearchMode, colors }) {
  const [hoverTab, setHoverTab] = useState(null);

  const handleTabClick = (tabId) => {
    if (tabId === 'research') {
      // Research opens the research modal instead of switching tabs
      setShowResearchMode(true);
      return;
    }
    setActiveTab(tabId);
  };

  return (
    <div
      id="tour-game-mode-toggle"
      style={{
        background: '#161b22',
        borderBottom: '1px solid #21262d',
        padding: '10px 16px',
        marginBottom: '16px',
      }}
    >
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id && tab.id !== 'research';
          const isHovered = hoverTab === tab.id;

          return (
            <button
              key={tab.id}
              id={tab.id === 'pvp' ? 'tour-games-btn' : tab.id === 'research' ? 'tour-research-btn' : `tour-${tab.id}-btn`}
              onClick={() => handleTabClick(tab.id)}
              onMouseEnter={() => setHoverTab(tab.id)}
              onMouseLeave={() => setHoverTab(null)}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                position: 'relative',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                border: isActive
                  ? '1px solid #f59e0b'
                  : `1px solid ${isHovered ? 'rgba(255, 255, 255, 0.15)' : '#21262d'}`,
                background: isActive
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : isHovered
                    ? 'rgba(22, 27, 34, 1)'
                    : 'rgba(22, 27, 34, 0.8)',
                color: isActive
                  ? '#0d1117'
                  : isHovered
                    ? '#e6edf3'
                    : '#8b949e',
                boxShadow: isActive
                  ? '0 0 16px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  : 'none',
                letterSpacing: '0.5px',
              }}
            >
              {/* Inner shine for active tab */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)',
                  pointerEvents: 'none',
                  borderRadius: '10px 10px 0 0',
                }} />
              )}
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px' }}>{tab.icon}</span>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
