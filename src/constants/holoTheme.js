// MarketClash Holographic War Room Theme
// Used across all Snake Draft screens
// Created for UI Redesign - Phase 1

export const HOLO_COLORS = {
  // Backgrounds
  bgDeep: '#0a0e14',
  bgCard: '#0d1117',
  bgElevated: '#161b22',

  // Borders
  borderSubtle: '#21262d',
  borderGlow: 'rgba(0, 255, 255, 0.3)',
  borderBright: 'rgba(0, 255, 255, 0.5)',

  // Primary Accents
  primary: '#00d9ff',  // Standard primary cyan (used across BaggerBomb components)
  cyan: '#00ffff',
  green: '#00ff88',
  greenMuted: '#10b981',  // Muted green (used in threshold displays)
  greenBright: '#22c55e', // Bright green (selections, confirmations)
  amber: '#f59e0b',
  red: '#ff3366',
  redMuted: '#ef4444',  // Muted red (used in threshold displays)
  purple: '#8b5cf6',

  // Rank Colors
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',

  // Category Colors (STANDARDIZED - use these everywhere)
  steady: '#00ffff',    // Cyan
  risky: '#f59e0b',     // Amber
  defensive: '#10b981', // Green

  // Sector Colors
  sectorTech: '#3b82f6',
  sectorEnergy: '#ef4444',
  sectorHealthcare: '#14b8a6',
  sectorFinancials: '#22c55e',
  sectorConsumerCyclical: '#a855f7',
  sectorConsumerDefensive: '#ec4899',
  sectorIndustrials: '#f59e0b',
  sectorMaterials: '#f97316',
  sectorRealEstate: '#6366f1',
  sectorUtilities: '#64748b',
  sectorCommunication: '#06b6d4',
  sectorCrypto: '#fbbf24',

  // Rating Colors
  ratingStrongBuy: '#10b981',
  ratingBuy: '#00d9ff',
  ratingHold: '#f59e0b',
  ratingSell: '#ef4444',

  // Text
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
};

export const GLOW_EFFECTS = {
  cyan: '0 0 15px rgba(0, 255, 255, 0.5), 0 0 30px rgba(0, 255, 255, 0.3)',
  green: '0 0 15px rgba(0, 255, 136, 0.5), 0 0 30px rgba(0, 255, 136, 0.3)',
  amber: '0 0 15px rgba(245, 158, 11, 0.5), 0 0 30px rgba(245, 158, 11, 0.3)',
  red: '0 0 15px rgba(255, 51, 102, 0.5), 0 0 30px rgba(255, 51, 102, 0.3)',
  purple: '0 0 15px rgba(139, 92, 246, 0.5), 0 0 30px rgba(139, 92, 246, 0.3)',
  gold: '0 0 15px rgba(255, 215, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.3)',
};

// BaggerBomb glow effects based on bomb/bust count
export const BAGGER_GLOW_CONFIG = {
  bomb1: { // 1 baggerbomb - Blue
    shadow: '0 0 12px rgba(59, 130, 246, 0.4), 0 0 24px rgba(59, 130, 246, 0.2)',
    shadowPeak: '0 0 18px rgba(59, 130, 246, 0.55), 0 0 32px rgba(59, 130, 246, 0.35)',
    border: 'rgba(59, 130, 246, 0.5)',
  },
  bomb2: { // 2 baggerbombs - Green
    shadow: '0 0 15px rgba(16, 185, 129, 0.5), 0 0 30px rgba(16, 185, 129, 0.25)',
    shadowPeak: '0 0 22px rgba(16, 185, 129, 0.65), 0 0 40px rgba(16, 185, 129, 0.4)',
    border: 'rgba(16, 185, 129, 0.6)',
  },
  bomb3: { // 3+ baggerbombs - Gold
    shadow: '0 0 18px rgba(255, 215, 0, 0.5), 0 0 36px rgba(255, 215, 0, 0.3)',
    shadowPeak: '0 0 25px rgba(255, 215, 0, 0.65), 0 0 45px rgba(255, 215, 0, 0.45)',
    border: 'rgba(255, 215, 0, 0.6)',
  },
  bust1: { // 1 bust - Yellow
    shadow: '0 0 12px rgba(234, 179, 8, 0.4), 0 0 24px rgba(234, 179, 8, 0.2)',
    shadowPeak: '0 0 18px rgba(234, 179, 8, 0.55), 0 0 32px rgba(234, 179, 8, 0.35)',
    border: 'rgba(234, 179, 8, 0.5)',
  },
  bust2: { // 2 busts - Orange
    shadow: '0 0 15px rgba(249, 115, 22, 0.5), 0 0 30px rgba(249, 115, 22, 0.25)',
    shadowPeak: '0 0 22px rgba(249, 115, 22, 0.65), 0 0 40px rgba(249, 115, 22, 0.4)',
    border: 'rgba(249, 115, 22, 0.6)',
  },
  bust3: { // 3+ busts - Red
    shadow: '0 0 18px rgba(239, 68, 68, 0.5), 0 0 36px rgba(239, 68, 68, 0.3)',
    shadowPeak: '0 0 25px rgba(239, 68, 68, 0.65), 0 0 45px rgba(239, 68, 68, 0.45)',
    border: 'rgba(239, 68, 68, 0.6)',
  },
};

export const getBaggerGlow = (bombCount, bustCount) => {
  if (bombCount >= 3) return BAGGER_GLOW_CONFIG.bomb3;
  if (bombCount === 2) return BAGGER_GLOW_CONFIG.bomb2;
  if (bombCount === 1) return BAGGER_GLOW_CONFIG.bomb1;
  if (bustCount >= 3) return BAGGER_GLOW_CONFIG.bust3;
  if (bustCount === 2) return BAGGER_GLOW_CONFIG.bust2;
  if (bustCount === 1) return BAGGER_GLOW_CONFIG.bust1;
  return null;
};

export const RANK_CONFIG = {
  1: { label: '1ST', emoji: '', color: HOLO_COLORS.gold, glow: GLOW_EFFECTS.gold },
  2: { label: '2ND', emoji: '', color: HOLO_COLORS.silver, glow: 'none' },
  3: { label: '3RD', emoji: '', color: HOLO_COLORS.bronze, glow: 'none' },
  4: { label: '4TH', emoji: '', color: HOLO_COLORS.textMuted, glow: 'none' },
};

export const CATEGORY_CONFIG = {
  steady: { letter: 'S', color: HOLO_COLORS.steady, label: 'Steady' },
  risky: { letter: 'R', color: HOLO_COLORS.risky, label: 'Risky' },
  defensive: { letter: 'D', color: HOLO_COLORS.defensive, label: 'Defensive' },
};

// Sector color mapping - handles various naming conventions from data sources
export const SECTOR_CONFIG = {
  // Technology
  'Technology': { color: HOLO_COLORS.sectorTech, label: 'Technology' },
  'Information Technology': { color: HOLO_COLORS.sectorTech, label: 'Technology' },
  // Energy
  'Energy': { color: HOLO_COLORS.sectorEnergy, label: 'Energy' },
  // Healthcare
  'Healthcare': { color: HOLO_COLORS.sectorHealthcare, label: 'Healthcare' },
  'Health Care': { color: HOLO_COLORS.sectorHealthcare, label: 'Healthcare' },
  // Financials
  'Financials': { color: HOLO_COLORS.sectorFinancials, label: 'Financials' },
  'Financial Services': { color: HOLO_COLORS.sectorFinancials, label: 'Financials' },
  // Consumer Cyclical
  'Consumer Cyclical': { color: HOLO_COLORS.sectorConsumerCyclical, label: 'Consumer Cyclical' },
  'Consumer Discretionary': { color: HOLO_COLORS.sectorConsumerCyclical, label: 'Consumer Cyclical' },
  // Consumer Defensive
  'Consumer Defensive': { color: HOLO_COLORS.sectorConsumerDefensive, label: 'Consumer Defensive' },
  'Consumer Staples': { color: HOLO_COLORS.sectorConsumerDefensive, label: 'Consumer Defensive' },
  // Industrials
  'Industrials': { color: HOLO_COLORS.sectorIndustrials, label: 'Industrials' },
  // Materials
  'Basic Materials': { color: HOLO_COLORS.sectorMaterials, label: 'Materials' },
  'Materials': { color: HOLO_COLORS.sectorMaterials, label: 'Materials' },
  // Real Estate
  'Real Estate': { color: HOLO_COLORS.sectorRealEstate, label: 'Real Estate' },
  // Utilities
  'Utilities': { color: HOLO_COLORS.sectorUtilities, label: 'Utilities' },
  // Communication
  'Communication Services': { color: HOLO_COLORS.sectorCommunication, label: 'Communication' },
  // Crypto
  'Cryptocurrency': { color: HOLO_COLORS.sectorCrypto, label: 'Crypto' },
  // Default fallback
  'default': { color: HOLO_COLORS.cyan, label: 'Other' },
};

// Helper function to get sector color
export const getSectorColor = (sector) => {
  return SECTOR_CONFIG[sector]?.color || SECTOR_CONFIG.default.color;
};

// Rating color mapping
export const RATING_CONFIG = {
  'Strong Buy': { color: HOLO_COLORS.ratingStrongBuy, label: 'Strong Buy' },
  'Buy': { color: HOLO_COLORS.ratingBuy, label: 'Buy' },
  'Hold': { color: HOLO_COLORS.ratingHold, label: 'Hold' },
  'Sell': { color: HOLO_COLORS.ratingSell, label: 'Sell' },
  'Strong Sell': { color: HOLO_COLORS.ratingSell, label: 'Strong Sell' },
};

// Helper function to get rating color
export const getRatingColor = (rating) => {
  if (!rating) return HOLO_COLORS.textMuted;
  // Check if rating contains "Strong" for Strong Buy
  if (rating.includes('Strong') && rating.includes('Buy')) return HOLO_COLORS.ratingStrongBuy;
  if (rating.includes('Strong')) return HOLO_COLORS.ratingSell;
  return RATING_CONFIG[rating]?.color || HOLO_COLORS.textMuted;
};

// Background with scanline effect
export const HOLO_BACKGROUND = `
  repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 255, 0.03) 2px,
    rgba(0, 255, 255, 0.03) 4px
  ),
  radial-gradient(ellipse at 50% 0%, rgba(0, 255, 255, 0.08) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 20%, rgba(0, 255, 136, 0.05) 0%, transparent 40%),
  ${HOLO_COLORS.bgDeep}
`;

// Animation keyframes - now consolidated in animations.js
// Re-exported for backwards compatibility with components using HOLO_ANIMATIONS
// Note: These keyframes are also available in index.css as spin, holo-pulse, holo-glow, holo-float, scan-down
export { HOLO_ANIMATIONS } from './animations.js';
