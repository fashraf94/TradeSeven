// EarningsGame Design System - "Terminal Aesthetic"

export const designColors = {
  // Backgrounds
  bgPrimary: '#0a0a0f',
  bgCard: '#12121a',
  bgCardInner: '#161b22',

  // Borders
  borderDefault: '#21262d',
  borderSubtle: '#333333',

  // Accents
  cyan: '#00d9ff',
  green: '#10b981',
  greenBright: '#22c55e',
  orange: '#f59e0b',
  orangeRed: '#f97316',
  red: '#ef4444',
  redDark: '#dc2626',
  purple: '#9333ea',
  violet: '#a78bfa',
  gold: '#fbbf24',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',
};

export const glowEffects = {
  cyan: '0 0 10px rgba(0, 217, 255, 0.5)',
  cyanIntense: '0 0 15px rgba(0, 217, 255, 0.7)',
  green: '0 0 10px rgba(16, 185, 129, 0.5)',
  red: '0 0 10px rgba(239, 68, 68, 0.5)',
};

export const bgTints = {
  cyan: 'rgba(0, 217, 255, 0.1)',
  green: 'rgba(16, 185, 129, 0.1)',
  red: 'rgba(239, 68, 68, 0.1)',
  orange: 'rgba(249, 115, 22, 0.1)',
  gold: 'rgba(251, 191, 36, 0.2)',
  violet: 'rgba(139, 92, 246, 0.2)',
};

export const fontMono = "'SF Mono', 'Monaco', 'Consolas', monospace";

export const BUDGET = 10000;
export const MIN_PREDICTIONS = 3;
export const MAX_PREDICTIONS = 10;

// Bracket definitions
export const BRACKETS = {
  diamond: { emoji: '🏆', label: 'DIAMOND', color: '#00d9ff' },
  gold: { emoji: '🥇', label: 'GOLD', color: '#fbbf24' },
  silver: { emoji: '🥈', label: 'SILVER', color: '#9ca3af' },
  bronze: { emoji: '🥉', label: 'BRONZE', color: '#f97316' },
};

// Magnitude definitions
export const MAGNITUDES = [
  { id: 'downBig', label: 'DOWN BIG', emoji: '💥', range: '< -5%', min: -Infinity, max: -5 },
  { id: 'down', label: 'DOWN', emoji: '📉', range: '-2% to -5%', min: -5, max: -2 },
  { id: 'flat', label: 'FLAT', emoji: '😐', range: '±2%', min: -2, max: 2 },
  { id: 'up', label: 'UP', emoji: '📈', range: '+2% to +5%', min: 2, max: 5 },
  { id: 'upBig', label: 'UP BIG', emoji: '🚀', range: '> +5%', min: 5, max: Infinity },
];
