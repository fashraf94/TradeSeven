// /src/components/Dashboard/SeasonalBanner.jsx
// Amber/gold seasonal banner shown between Live Clashes and Game Cards
// PVP variant: EarningsGame Tournament CTA
// TRAIN variant: 2X Practice Drills promo
// Hardcoded isSeasonalActive = true for now
// Mobile: Stacks vertically with full-width button

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Hardcode seasonal active state until backend provides it
const isSeasonalActive = true;

const VARIANTS = {
  pvp: {
    icon: '🏆',
    title: 'EarningsGame Tournament',
    subtitle: 'Compete for the leaderboard • Ends in 3 days',
    cta: 'ENTER TOURNAMENT',
    action: 'earningsGame',
  },
  train: {
    icon: '⚡',
    title: 'Limited Time: 2X Practice Drills',
    subtitle: 'Earn double tokens on all training games',
    cta: 'PLAY NOW',
    action: null, // No navigation, just visual promo
  },
};

export default function SeasonalBanner({ variant = 'pvp', setScreen, colors }) {
  const [isHovered, setIsHovered] = useState(false);
  // Initialize with actual window width to prevent flash of wrong layout
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 480;
    }
    return true; // SSR fallback: assume mobile
  });

  // Update on resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 480);
    checkMobile(); // Run immediately to sync state
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isSeasonalActive) return null;

  console.log('SeasonalBanner render - isMobile:', isMobile, 'window.innerWidth:', typeof window !== 'undefined' ? window.innerWidth : 'SSR');

  const config = VARIANTS[variant] || VARIANTS.pvp;

  const handleCTA = () => {
    if (config.action && setScreen) {
      setScreen(config.action);
    }
  };

  return (
    <div
      data-testid="seasonal-banner"
      style={{
        marginBottom: '20px',
        padding: '14px 16px',
        width: '100%',
        maxWidth: 'calc(100vw - 32px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 100%)',
        borderRadius: '12px',
        borderLeft: '3px solid #f59e0b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '12px',
      }}
    >
      {/* Icon + Text row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>{config.icon}</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#e6edf3' }}>{config.title}</div>
          <div style={{ fontSize: '11px', color: '#8b949e' }}>{config.subtitle}</div>
        </div>
      </div>

      {/* Button - DIRECT CHILD of outer container */}
      <button
        onClick={handleCTA}
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          border: 'none',
          borderRadius: '8px',
          color: '#0d1117',
          fontSize: '12px',
          fontWeight: '800',
          cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        {config.cta}
      </button>
    </div>
  );
}
