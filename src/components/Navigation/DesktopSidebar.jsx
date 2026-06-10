// /src/components/Navigation/DesktopSidebar.jsx
// Fixed left sidebar for desktop — navigation, stats, user profile
// Supports collapsed (64px, icons only) and expanded (220px, full labels) states

import React, { useState } from 'react';
import { Swords, Newspaper, Hammer, Clock, Settings, Flame, Trophy, PanelLeftClose, PanelLeftOpen, LogOut, Search } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { TOURNAMENT_TAB_ENABLED } from '../../config/featureFlags';

const NAV_ITEMS = [
  { id: 'compete', label: 'Compete', Icon: Swords, screen: 'dashboard' },
  { id: 'news', label: 'News', Icon: Newspaper, screen: 'fantasytimes' },
  // The retired Agent Hub's slot — held by the flagged League tab (Closeout Spec §6).
  ...(TOURNAMENT_TAB_ENABLED
    ? [{ id: 'league', label: 'League', Icon: Trophy, screen: 'league' }]
    : []),
  { id: 'forge', label: 'Forge', Icon: Hammer, screen: null },
  { id: 'search', label: 'Search', Icon: Search, screen: 'search' },
  { id: 'history', label: 'History', Icon: Clock, screen: 'battleHistory' },
  { id: 'settings', label: 'Settings', Icon: Settings, screen: 'profile' },
];

function NavItem({ item, active, collapsed, hovered, onHover, onLeave, onClick, tokens, unreadCount }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const isDisabled = item.disabled === true;

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      onMouseEnter={() => { if (!isDisabled) onHover(); if (collapsed) setTooltipVisible(true); }}
      onMouseLeave={() => { onLeave(); setTooltipVisible(false); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '12px',
        padding: collapsed ? '10px 0' : '10px 14px',
        borderRadius: '10px',
        border: 'none',
        borderLeft: collapsed ? 'none' : (active ? `3px solid ${tokens.teal}` : '3px solid transparent'),
        background: active
          ? 'rgba(94,234,212,0.08)'
          : hovered && !isDisabled
            ? 'rgba(255,255,255,0.03)'
            : 'transparent',
        boxShadow: active ? 'inset 0 0 20px rgba(94,234,212,0.03)' : 'none',
        color: active ? tokens.teal : tokens.textMuted,
        fontSize: '14px',
        fontWeight: '500',
        cursor: isDisabled ? 'default' : 'pointer',
        width: '100%',
        textAlign: 'left',
        position: 'relative',
        transition: 'background 0.15s ease',
        justifyContent: collapsed ? 'center' : 'flex-start',
        opacity: isDisabled ? 0.35 : 1,
        pointerEvents: isDisabled ? 'none' : 'auto',
      }}
    >
      <div style={{
        width: collapsed ? 'auto' : '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <item.Icon size={20} />
      </div>
      <span style={{
        opacity: collapsed ? 0 : 1,
        width: collapsed ? 0 : 'auto',
        transition: 'opacity 0.15s ease',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}>
        {item.label}
      </span>
      {isDisabled && !collapsed && (
        <span style={{
          fontSize: '8px',
          fontWeight: 700,
          color: '#5eead4',
          background: 'rgba(94,234,212,0.15)',
          padding: '2px 5px',
          borderRadius: '6px',
          lineHeight: 1,
          marginLeft: 'auto',
        }}>
          Soon
        </span>
      )}
      {item.id === 'news' && unreadCount > 0 && (
        <span style={{
          position: 'absolute',
          right: collapsed ? '6px' : '12px',
          top: collapsed ? '4px' : 'auto',
          minWidth: '18px',
          height: '18px',
          borderRadius: '9px',
          background: tokens.teal,
          color: tokens.bgApp,
          fontSize: '10px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 5px',
        }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
      {/* Tooltip in collapsed state */}
      {collapsed && tooltipVisible && (
        <div style={{
          position: 'fixed',
          left: '68px',
          background: '#161b22',
          color: '#fff',
          fontSize: '12px',
          fontWeight: '500',
          padding: '5px 10px',
          borderRadius: '6px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          border: '1px solid #21262d',
        }}>
          {item.label}
        </div>
      )}
    </button>
  );
}

export default function DesktopSidebar({
  screen,
  setScreen,
  setShowForge,
  showForge,
  user,
  unreadCount,
  collapsed,
  onToggleCollapse,
  onLogout,
}) {
  const { tokens } = useTheme();
  const [hoveredId, setHoveredId] = useState(null);

  const isActive = (item) => {
    if (item.id === 'forge') return showForge;
    return screen === item.screen;
  };

  const handleNav = (item) => {
    if (item.id === 'forge') {
      setShowForge(true);
    } else {
      setShowForge(false);
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
      width: collapsed ? '64px' : '220px',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      background: tokens.bgCard,
      backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, transparent 30%)',
      borderRight: `1px solid ${tokens.borderDefault}`,
      boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
      zIndex: 40,
      padding: collapsed ? '20px 0' : '20px 16px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Toggle — very top */}
      <div style={{
        display: 'flex',
        justifyContent: collapsed ? 'center' : 'flex-end',
        padding: collapsed ? '0 0 8px' : '0 10px 8px',
      }}>
        <button
          onClick={onToggleCollapse}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            border: 'none',
            background: 'transparent',
            color: '#8b949e',
            cursor: 'pointer',
            borderRadius: '6px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#5eead4'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#8b949e'; }}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: collapsed ? 0 : '10px',
        marginBottom: collapsed ? '12px' : '24px',
        padding: collapsed ? '0' : '0 10px',
      }}>
        <Flame size={22} color={tokens.teal} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '18px',
          fontWeight: '700',
          background: 'linear-gradient(90deg, #FF8C00, #468CFF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : 'auto',
          transition: 'opacity 0.15s ease, width 0.2s ease',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
          FantasyTrades
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={isActive(item)}
            collapsed={collapsed}
            hovered={hoveredId === item.id}
            onHover={() => setHoveredId(item.id)}
            onLeave={() => setHoveredId(null)}
            onClick={() => handleNav(item)}
            tokens={tokens}
            unreadCount={item.id === 'news' ? unreadCount : 0}
          />
        ))}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Stats — hidden when collapsed */}
      {!collapsed && (
        <div style={{
          borderTop: `1px solid ${tokens.borderDivider}`,
          paddingTop: '12px',
          marginTop: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '12px 10px 8px',
          alignItems: 'flex-start',
          overflow: 'hidden',
        }}>
          <div style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
            <span style={{ color: tokens.emerald, fontWeight: '600' }}>W: {wins}</span>
            <span style={{ color: tokens.textFaintest, margin: '0 8px' }}>•</span>
            <span style={{ color: tokens.red, fontWeight: '600' }}>L: {losses}</span>
          </div>
          <div style={{ fontSize: '13px', color: tokens.textMuted, whiteSpace: 'nowrap' }}>
            Rate: {winRate}%
          </div>
        </div>
      )}

      {/* User */}
      <div
        onClick={() => { setShowForge(false); setScreen('profile'); }}
        style={{
          borderTop: `1px solid ${tokens.borderDivider}`,
          paddingTop: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : '12px',
          cursor: 'pointer',
          padding: collapsed ? '12px 0 0' : '12px 10px 0',
          justifyContent: collapsed ? 'center' : 'flex-start',
          overflow: 'hidden',
        }}
      >
        <div style={{
          width: collapsed ? '32px' : '40px',
          height: collapsed ? '32px' : '40px',
          borderRadius: '50%',
          background: tokens.bgIcon,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: collapsed ? '13px' : '16px',
          fontWeight: '600',
          color: tokens.teal,
          flexShrink: 0,
          transition: 'width 0.2s ease, height 0.2s ease, font-size 0.2s ease',
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
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : 'auto',
          transition: 'opacity 0.15s ease',
        }}>
          {user?.username || 'Player'}
        </span>
      </div>

      {/* Logout */}
      {onLogout && (
        <div style={{
          borderTop: `1px solid ${tokens.borderDivider}`,
          marginTop: '12px',
          paddingTop: '12px',
          padding: collapsed ? '12px 0 0' : '12px 10px 0',
        }}>
          <button
            onClick={onLogout}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(248,113,113,0.1)';
              e.currentTarget.style.color = '#f87171';
              const tooltip = e.currentTarget.querySelector('[data-tooltip]');
              if (tooltip) tooltip.style.display = 'block';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#8b949e';
              const tooltip = e.currentTarget.querySelector('[data-tooltip]');
              if (tooltip) tooltip.style.display = 'none';
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : '12px',
              padding: collapsed ? '8px 0' : '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: '#8b949e',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'background 0.15s ease, color 0.15s ease',
              position: 'relative',
            }}
          >
            <div style={{
              width: collapsed ? 'auto' : '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <LogOut size={18} />
            </div>
            <span style={{
              opacity: collapsed ? 0 : 1,
              width: collapsed ? 0 : 'auto',
              transition: 'opacity 0.15s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}>
              Log Out
            </span>
            {collapsed && (
              <div
                data-tooltip
                style={{
                  display: 'none',
                  position: 'fixed',
                  left: '68px',
                  background: '#161b22',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '500',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 9999,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  border: '1px solid #21262d',
                }}
              >
                Log Out
              </div>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
