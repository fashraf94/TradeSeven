// src/components/TechnicalAnalysis/utils/colors.js
// Shared color utilities for Technical Analysis components

/**
 * Get color based on strength level
 * @param {string} strength - 'STRONG', 'MODERATE', 'WEAK', or default
 * @returns {string} Hex color code
 */
export const getStrengthColor = (strength) => {
  switch (strength) {
    case 'STRONG': return '#00ff88';
    case 'MODERATE': return '#ffcc00';
    case 'WEAK': return '#888';
    default: return '#888';
  }
};

/**
 * Get icon for strength level
 * @param {string} strength - 'STRONG', 'MODERATE', 'WEAK'
 * @returns {string} Unicode icon
 */
export const getStrengthIcon = (strength) => {
  switch (strength) {
    case 'STRONG': return '●●●';
    case 'MODERATE': return '●●○';
    case 'WEAK': return '●○○';
    default: return '○○○';
  }
};

/**
 * Get color for support/resistance type
 * @param {string} type - 'SUPPORT' or 'RESISTANCE'
 * @returns {string} Hex color code
 */
export const getLevelTypeColor = (type) => {
  return type === 'SUPPORT' ? '#00ff88' : '#ff4757';
};

// Common color constants (aligned with holoTheme)
export const COLORS = {
  bullish: '#00ff88',
  bearish: '#ff4757',
  neutral: '#888',
  accent: '#00ffff',
  warning: '#ffcc00',
  background: '#0a1628',
  backgroundDark: '#0a0e14',
  backgroundCard: 'rgba(0, 0, 0, 0.2)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textMuted: 'rgba(255, 255, 255, 0.4)',
};
