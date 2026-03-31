// src/components/FantasyTimes/BroadsheetMasthead.jsx
// Sticky masthead bar — "FANTASYTIMES" in Newsreader serif, LIVE indicator, date in monospace.

import React from 'react';
import { BROADSHEET_TOKENS } from '../../constants/reporterTheme';

const pulseKeyframes = `@keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`;

export default function BroadsheetMasthead({ isDesktop, isLive, accentColor }) {
  const height = isDesktop ? BROADSHEET_TOKENS.mastheadHeight.desktop : BROADSHEET_TOKENS.mastheadHeight.mobile;
  const borderColor = accentColor || BROADSHEET_TOKENS.mastheadBorder;

  const now = new Date();
  const dateStr = isDesktop
    ? now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isDesktop ? '0 48px' : '0 16px',
      background: BROADSHEET_TOKENS.mastheadBg,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: `2px solid ${borderColor}`,
      transition: 'border-color 0.3s ease',
    }}>
      <style>{pulseKeyframes}</style>

      <h1 style={{
        margin: 0,
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: isDesktop ? 48 : 20,
        fontWeight: 700,
        letterSpacing: '-0.04em',
        color: '#00d9ff',
        lineHeight: 1,
      }}>
        FANTASYTIMES
      </h1>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {isLive && (
          <>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#00ff88',
              animation: 'livePulse 2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: BROADSHEET_TOKENS.fontMono,
              fontSize: 11,
              fontWeight: 600,
              color: '#00ff88',
              letterSpacing: '0.05em',
            }}>
              LIVE UPDATE
            </span>
            <span style={{
              fontFamily: BROADSHEET_TOKENS.fontMono,
              fontSize: 11,
              color: '#859398',
              marginLeft: 4,
            }}>
              —
            </span>
          </>
        )}
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 11,
          color: '#859398',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {dateStr}
        </span>
      </div>
    </header>
  );
}
