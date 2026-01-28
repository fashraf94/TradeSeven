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
  // MOBILE-FIRST: Default to true so button is always visible on initial render
  // Then update to false on desktop after mount
  const [isMobile, setIsMobile] = useState(true);

  // Update on resize and mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 480);
    };
    // Check immediately on mount
    checkMobile();
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
    <motion.div
      data-testid="seasonal-banner"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      style={{
        marginBottom: '20px',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 100%)',
        borderRadius: '12px',
        borderLeft: '3px solid #f59e0b',
        // ALWAYS stack vertically on mobile for button visibility
        display: 'flex',
        flexDirection: 'column', // HARDCODED for testing
        alignItems: isMobile ? 'stretch' : 'center',
        gap: '12px',
      }}
    >
      {/* DEBUG INDICATOR - REMOVE AFTER TESTING */}
      <div style={{ color: 'red', fontSize: '20px', fontWeight: 'bold', background: 'yellow', padding: '4px' }}>
        DEBUG: isMobile = {String(isMobile)} | width = {typeof window !== 'undefined' ? window.innerWidth : 'SSR'}
      </div>

      {/* Top row: Icon + Text */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flex: isMobile ? 'none' : 1,
        minWidth: 0,
      }}>
        {/* Icon */}
        <span style={{
          fontSize: isMobile ? '20px' : '22px',
          flexShrink: 0,
          lineHeight: 1,
        }}>
          {config.icon}
        </span>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? '13px' : '14px',
            fontWeight: '700',
            color: '#e6edf3',
            lineHeight: 1.3,
            marginBottom: '2px',
          }}>
            {config.title}
          </div>
          <div style={{
            fontSize: isMobile ? '11px' : '12px',
            color: '#8b949e',
            lineHeight: 1.3,
          }}>
            {config.subtitle}
          </div>
        </div>
      </div>

      {/* CTA Button - FULL WIDTH on mobile, always visible */}
      <button
        onClick={handleCTA}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          // Full width on mobile, auto on desktop
          width: '100%', // HARDCODED for testing
          padding: isMobile ? '12px 16px' : '8px 16px',
          background: isHovered
            ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          border: 'none',
          borderRadius: '8px',
          color: '#0d1117',
          fontSize: isMobile ? '12px' : '11px',
          fontWeight: '800',
          cursor: 'pointer',
          // Don't shrink or allow overflow
          flexShrink: 0,
          whiteSpace: 'nowrap',
          letterSpacing: '0.5px',
          transition: 'all 0.2s ease',
          boxShadow: isHovered
            ? '0 0 12px rgba(245, 158, 11, 0.4)'
            : '0 0 8px rgba(245, 158, 11, 0.2)',
          // Ensure minimum tap target
          minHeight: '44px',
        }}
      >
        {config.cta}
      </button>
    </motion.div>
  );
}
