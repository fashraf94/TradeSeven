import React from 'react';
import { Swords, Newspaper, Bot, GraduationCap, Search } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const NAV_ITEMS = [
  { id: 'compete', label: 'Compete', icon: Swords, screen: 'dashboard', iconSize: 24 },
  { id: 'news', label: 'News', icon: Newspaper, screen: 'fantasytimes', iconSize: 24 },
  { id: 'agent', label: 'Agent', icon: Bot, screen: 'agent', iconSize: 28 },
  { id: 'academy', label: 'Academy', icon: GraduationCap, screen: null, iconSize: 24 },
  { id: 'search', label: 'Search', icon: Search, screen: 'search', iconSize: 24 },
];

// Fallback tokens in case ThemeProvider is not available
const FALLBACK = {
  bgCard: '#15171E',
  borderDefault: 'rgba(255,255,255,0.05)',
  teal: '#5eead4',
  glowTealNav: '0 0 12px rgba(94,234,212,0.7)',
  textMuted: '#94a3b8',
};

export default function BottomNav({ screen, setScreen, setShowAcademy, showAcademy }) {
  let tokens;
  try {
    const theme = useTheme();
    tokens = theme.tokens;
  } catch {
    tokens = FALLBACK;
  }

  const isActive = (item) => {
    if (item.id === 'compete') return screen === 'dashboard';
    if (item.id === 'news') return screen === 'fantasytimes';
    if (item.id === 'agent') return screen === 'agent';
    if (item.id === 'academy') return showAcademy;
    if (item.id === 'search') return screen === 'search';
    return false;
  };

  const handlePress = (item) => {
    if (item.id === 'academy') {
      setShowAcademy(true);
      return;
    }
    if (item.screen) {
      setScreen(item.screen);
    }
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: '64px',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: tokens.bgCard,
        borderTop: `1px solid ${tokens.borderDefault}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            onClick={() => handlePress(item)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 0',
              position: 'relative',
            }}
          >
            {/* Active indicator bar */}
            {active && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '25%',
                  right: '25%',
                  height: '3px',
                  borderRadius: '0 0 3px 3px',
                  background: tokens.teal,
                  boxShadow: tokens.glowTealNav,
                }}
              />
            )}

            <Icon
              size={item.iconSize}
              style={{
                color: active ? tokens.teal : tokens.textMuted,
                transition: 'color 0.2s',
              }}
            />

            <span
              style={{
                fontSize: '10px',
                fontWeight: active ? '600' : '400',
                color: active ? tokens.teal : tokens.textMuted,
                transition: 'color 0.2s',
                lineHeight: 1,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
