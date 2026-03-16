// /src/components/Navigation/DesktopSidebar.jsx
// Fixed left sidebar for desktop — navigation, stats, user profile

import React, { useState } from 'react';
import { Swords, Newspaper, BarChart3, Clock, Settings, Flame } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const NAV_ITEMS = [
  { id: 'compete', label: 'Compete', Icon: Swords, screen: 'dashboard' },
  { id: 'news', label: 'News', Icon: Newspaper, screen: 'fantasytimes' },
  { id: 'research', label: 'Research', Icon: BarChart3, screen: null },
  { id: 'history', label: 'History', Icon: Clock, screen: 'battleHistory' },
  { id: 'settings', label: 'Settings', Icon: Settings, screen: 'profile' },
];

export default function DesktopSidebar({
  screen,
  setScreen,
  setShowResearchMode,
  showResearchMode,
  user,
  unreadCount,
}) {
  const { tokens } = useTheme();
  const [hoveredId, setHoveredId] = useState(null);

  const isActive = (item) => {
    if (item.id === 'research') return showResearchMode;
    return screen === item.screen;
  };

  const handleNav = (item) => {
    if (item.id === 'research') {
      setShowResearchMode(true);
    } else {
      setShowResearchMode(false);
      setScreen(item.screen);
    }
  };

  const wins = user?.wins || 0;
  const losses = user?.losses || 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width: '220px',
      background: tokens.bgCard,
      borderRight: `1px solid ${tokens.borderDefault}`,
      zIndex: 40,
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '32px',
        padding: '0 10px',
      }}>
        <Flame size={22} color={tokens.teal} />
        <span style={{
          fontSize: '18px',
          fontWeight: '700',
          background: 'linear-gradient(90deg, #FF8C00, #468CFF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          FantasyTrades
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const hovered = hoveredId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                borderLeft: active ? `3px solid ${tokens.teal}` : '3px solid transparent',
                background: active
                  ? 'rgba(94,234,212,0.08)'
                  : hovered
                    ? 'rgba(255,255,255,0.03)'
                    : 'transparent',
                color: active ? tokens.teal : tokens.textMuted,
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                position: 'relative',
                transition: 'background 0.15s ease',
              }}
            >
              <item.Icon size={20} />
              {item.label}
              {item.id === 'news' && unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  minWidth: '20px',
                  height: '20px',
                  borderRadius: '10px',
                  background: tokens.teal,
                  color: tokens.bgApp,
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Stats */}
      <div style={{
        borderTop: `1px solid ${tokens.borderDivider}`,
        paddingTop: '16px',
        marginTop: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '16px 10px 12px',
      }}>
        <div style={{ fontSize: '13px' }}>
          <span style={{ color: tokens.emerald, fontWeight: '600' }}>W: {wins}</span>
          <span style={{ color: tokens.textFaintest, margin: '0 8px' }}>•</span>
          <span style={{ color: tokens.red, fontWeight: '600' }}>L: {losses}</span>
        </div>
        <div style={{ fontSize: '13px', color: tokens.textMuted }}>
          Rate: {winRate}%
        </div>
      </div>

      {/* User */}
      <div
        onClick={() => { setShowResearchMode(false); setScreen('profile'); }}
        style={{
          borderTop: `1px solid ${tokens.borderDivider}`,
          paddingTop: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          padding: '16px 10px 0',
        }}
      >
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: tokens.bgIcon,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: '600',
          color: tokens.teal,
          flexShrink: 0,
        }}>
          {(user?.username || 'U')[0].toUpperCase()}
        </div>
        <span style={{
          fontSize: '14px',
          fontWeight: '500',
          color: tokens.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {user?.username || 'Player'}
        </span>
      </div>
    </div>
  );
}
