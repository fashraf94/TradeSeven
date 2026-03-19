/**
 * FantasyTimes V2 — Reporter Identity & Feed Design Tokens
 * Centralized theme constants for the editorial feed redesign.
 */

export const REPORTER_COLORS = {
  kai:  { hex: '#00D9FF', rgb: '0, 217, 255', name: 'Kai Nakamura', beat: 'Market Pulse' },
  alex: { hex: '#FF6B6B', rgb: '255, 107, 107', name: 'Alex Chen', beat: 'Stock Spotlight' },
  neta: { hex: '#F59E0B', rgb: '245, 158, 11', name: 'Neta Patel', beat: 'Economics Desk' },
  doug: { hex: '#FFD700', rgb: '255, 215, 0', name: 'Doug Torres', beat: 'Earnings Analyst' },
  kim:  { hex: '#A78BFA', rgb: '167, 139, 250', name: 'Kim Park', beat: 'Sector Strategist' },
};

export const SENTIMENT_COLORS = {
  bullish: '#10b981',
  bearish: '#ef4444',
  neutral: '#64748b',
  mixed:   '#64748b',
};

export const FEED_TOKENS = {
  // Backgrounds
  bgCard: '#15171E',
  bgCardBorder: 'rgba(255, 255, 255, 0.06)',

  // Shadows
  obsidianShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.05)',
  heroInnerGlow: 'inset 0 1px 0 rgba(255,255,255,0.1)',

  // Radius
  cardRadius: 16,
  innerRadius: 8,

  // Padding
  paddingStandard: 16,
  paddingHero: 20,

  // Gaps
  gapStandard: 12,
  gapTight: 8,
  gapLoose: 16,
};

/**
 * Returns a subtle radial gradient in the top-left corner using the reporter's color.
 * Applied as backgroundImage on story cards.
 */
export const getReporterGlow = (reporterKey) => {
  const color = REPORTER_COLORS[reporterKey];
  if (!color) return 'none';
  return `radial-gradient(circle at top left, rgba(${color.rgb}, 0.05) 0%, transparent 40%)`;
};

/**
 * Returns a CSS borderLeft value using the sentiment color.
 */
export const getSentimentBorder = (sentiment) => {
  const color = SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.neutral;
  return `2px solid ${color}`;
};

/**
 * Returns the full reporter object from REPORTER_COLORS, or null if not found.
 */
export const getReporterByKey = (key) => {
  return REPORTER_COLORS[key] || null;
};
