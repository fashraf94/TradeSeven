// /src/components/Dashboard/DashboardTabs.jsx
// 3-tab navigation: PVP | TRAIN & EARN | RESEARCH
// Color-coded glowing tabs inspired by tarot card design
// PVP: Cyan, TRAIN: Purple, RESEARCH: Amber
// Mobile: All 3 tabs fit on 375px screen without scrolling

import React, { useState } from 'react';
import { useIsMobile } from '../../hooks';

// Tab configuration with unique theme colors
const TABS = [
  {
    id: 'pvp',
    label: 'PVP',
    icon: '⚔️',
    // Cyan theme - competitive
    color: '#00d9ff',
    glowColor: 'rgba(0, 217, 255, 0.5)',
    bgGradient: 'linear-gradient(135deg, rgba(0, 217, 255, 0.15) 0%, rgba(0, 217, 255, 0.05) 100%)',
  },
  {
    id: 'train',
    label: 'TRAIN & EARN',
    mobileLabel: 'TRAIN',
    icon: '🪙',
    // Purple theme - training/growth
    color: '#9333ea',
    glowColor: 'rgba(147, 51, 234, 0.5)',
    bgGradient: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(147, 51, 234, 0.05) 100%)',
  },
  {
    id: 'research',
    label: 'RESEARCH',
    icon: '📊',
    // Amber theme - knowledge
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.5)',
    bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
  },
];

export default function DashboardTabs({ activeTab, setActiveTab, setShowResearchMode, colors }) {
  const [hoverTab, setHoverTab] = useState(null);
  const { isMobile } = useIsMobile();

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
        padding: '10px 12px',
        marginBottom: '16px',
      }}
    >
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'center',
        gap: isMobile ? '8px' : '12px',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id && tab.id !== 'research';
          const isHovered = hoverTab === tab.id;

          // Use mobile label if available and on small screen
          const displayLabel = isMobile && tab.mobileLabel ? tab.mobileLabel : tab.label;

          // Dynamic styles based on state
          const borderOpacity = isActive ? 1 : isHovered ? 0.6 : 0.3;
          const glowIntensity = isActive ? 1 : isHovered ? 0.4 : 0;

          return (
            <button
              key={tab.id}
              id={tab.id === 'pvp' ? 'tour-games-btn' : tab.id === 'research' ? 'tour-research-btn' : `tour-${tab.id}-btn`}
              onClick={() => handleTabClick(tab.id)}
              onMouseEnter={() => setHoverTab(tab.id)}
              onMouseLeave={() => setHoverTab(null)}
              style={{
                // Responsive sizing
                padding: isMobile ? '10px 14px' : '12px 20px',
                borderRadius: '12px',
                fontSize: isMobile ? '11px' : '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                // Flex behavior
                flexShrink: 1,
                minWidth: 0,
                // Color-coded border with dynamic opacity
                border: `2px solid ${tab.color}`,
                borderColor: isActive
                  ? tab.color
                  : `rgba(${tab.id === 'pvp' ? '0, 217, 255' : tab.id === 'train' ? '147, 51, 234' : '245, 158, 11'}, ${borderOpacity})`,
                // Background: dark base with color tint when active
                background: isActive
                  ? tab.bgGradient
                  : 'rgba(10, 14, 20, 0.8)',
                // Text color: theme color when active, muted otherwise
                color: isActive
                  ? tab.color
                  : isHovered
                    ? '#e6edf3'
                    : '#6e7681',
                // Glow effect
                boxShadow: glowIntensity > 0
                  ? `0 0 ${15 * glowIntensity}px ${tab.glowColor}, inset 0 0 ${20 * glowIntensity}px rgba(${tab.id === 'pvp' ? '0, 217, 255' : tab.id === 'train' ? '147, 51, 234' : '245, 158, 11'}, 0.1)`
                  : 'none',
                letterSpacing: isMobile ? '0.3px' : '0.8px',
                textTransform: 'uppercase',
              }}
            >
              {/* Subtle inner highlight for active state */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '40%',
                  background: `linear-gradient(180deg, ${tab.color}15 0%, transparent 100%)`,
                  pointerEvents: 'none',
                  borderRadius: '10px 10px 0 0',
                }} />
              )}

              {/* Tab content */}
              <span style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '4px' : '6px',
              }}>
                <span style={{
                  fontSize: isMobile ? '12px' : '14px',
                  // Subtle glow on icon when active
                  filter: isActive ? `drop-shadow(0 0 4px ${tab.color})` : 'none',
                }}>
                  {tab.icon}
                </span>
                {displayLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
