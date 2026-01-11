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
  cyan: '#00ffff',
  green: '#00ff88',
  amber: '#f59e0b',
  red: '#ff3366',
  purple: '#8b5cf6',

  // Rank Colors
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',

  // Category Colors (STANDARDIZED - use these everywhere)
  steady: '#00ffff',    // Cyan
  risky: '#f59e0b',     // Amber
  defensive: '#10b981', // Green

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

// Animation keyframes (for use in style tags)
export const HOLO_ANIMATIONS = `
  @keyframes holoSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes holoScanDown {
    0% { top: 0; opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes holoPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  @keyframes holoGlow {
    0%, 100% { box-shadow: 0 0 15px rgba(0, 255, 255, 0.5); }
    50% { box-shadow: 0 0 25px rgba(0, 255, 255, 0.8); }
  }
  @keyframes holoFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
`;
