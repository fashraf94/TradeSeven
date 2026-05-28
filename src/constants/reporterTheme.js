/**
 * FantasyTimes V2 — Reporter Identity & Feed Design Tokens
 * Centralized theme constants for the editorial feed redesign.
 */

export const REPORTER_COLORS = {
  kai:  { hex: '#00D9FF', rgb: '0, 217, 255', name: 'Kai', beat: 'Market Pulse' },
  alex: { hex: '#E05DBF', rgb: '224, 93, 191', name: 'Alex', beat: 'Stock Spotlight' },
  neta: { hex: '#F59E0B', rgb: '245, 158, 11', name: 'Neta', beat: 'Economics Desk' },
  doug: { hex: '#FFD700', rgb: '255, 215, 0', name: 'Doug', beat: 'Earnings Analyst' },
  kim:  { hex: '#A78BFA', rgb: '167, 139, 250', name: 'Kim', beat: 'Sector Strategist' },
  // Vera: backend persona exists in Phase 1; UI render lands in Phase 2.
  // Both shapes coexist — existing UI consumers read hex/rgb/name/beat;
  // Phase 2 deepdive card layout will read primary/accent/ambient.
  vera: {
    hex: '#1e3a5f',
    rgb: '30, 58, 95',
    name: 'Vera',
    beat: 'Thematic & Industry Research',
    primary: '#1e3a5f',
    accent: '#3b6ba5',
    ambient: 'rgba(30, 58, 95, 0.15)',
    // Contrast-safe variant of `primary` for use ON dark backgrounds (the reporter
    // tab strip, the deepdive band/card eyebrows + CTAs, and deepdive links). Pure
    // navy `primary` (#1e3a5f) is unreadable as text on the near-black page, so it
    // stays reserved for brand-identity surfaces — left-edge stripes, blockquote /
    // table borders, h1 underlines — where it sits against lighter/other content.
    onDarkAccent: '#7fb0e6',
  },
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

// ── Broadsheet Tokens (V3 Newspaper Layout) ──

export const BROADSHEET_TOKENS = {
  // Typography
  fontHeadline: "'Newsreader', Georgia, 'Times New Roman', serif",
  fontBody: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",

  // Surfaces
  bgPage: '#0D0E12',
  bgSidebarStory: '#1a1b20',
  bgMoverCard: '#292a2e',
  bgHoverStory: '#1f1f24',

  // Column Rules & Fold Line
  columnRule: 'rgba(255, 255, 255, 0.08)',
  foldLine: 'rgba(255, 255, 255, 0.12)',
  sectionRule: 'rgba(133, 147, 152, 0.15)',
  storyDivider: 'rgba(133, 147, 152, 0.15)',

  // Masthead
  mastheadBg: 'rgba(18, 19, 23, 0.7)',
  mastheadBorder: 'rgba(255, 255, 255, 0.1)',

  // Ambient Glow (hero zone)
  heroGlow: (reporterRgb) => `radial-gradient(circle at 50% 50%, rgba(${reporterRgb}, 0.08) 0%, transparent 70%)`,

  // Dormant Visual Treatment
  dormantFilter: 'grayscale(100%) opacity(0.7)',
  dormantBlend: 'normal',
  activeFilter: 'none',

  // Reporter Section Accent
  sectionAccentBorder: (reporterHex) => `2px solid ${reporterHex}`,

  // Spacing
  mastheadHeight: { desktop: 56, mobile: 48 },
  navStripHeight: 44,
  columnGap: { desktop: 24, mobile: 16 },
  sectionGap: { desktop: 48, mobile: 32 },
  storyPadding: { desktop: 48, mobile: 16 },
  heroMinHeight: 600,
  mobileHeroVh: 75,
};

// ── Reporter Section Layouts ──

export const REPORTER_LAYOUTS = {
  kai: {
    columns: 3,
    style: 'dense-grid',
    description: 'Tight 3-column grid with rapid-fire updates',
  },
  alex: {
    columns: 2,
    style: 'ticker-grid',
    description: '2-column ticker card grid with sparklines',
  },
  neta: {
    columns: 2,
    style: 'editorial',
    description: '2-column editorial layout with comparison visuals',
  },
  doug: {
    columns: 2,
    style: 'editorial',
    description: '2-column layout with structured earnings content',
  },
  kim: {
    columns: 1,
    maxWidth: 860,
    style: 'essay',
    description: 'Single centered column, wide margins, drop cap, muted text',
  },
  // Vera: layout shape exists in Phase 1 so backend lookups don't fall through.
  // Phase 2 implements the deepdive card render across BroadsheetFrontPage,
  // ReporterDesk, and StoryDetail, plus a dedicated full-deepdive route.
  vera: {
    columns: 1,
    maxWidth: 900,
    style: 'deepdive-card',
    layout: 'deepdive-card',
    feature: 'deepdive-feature',
    description: 'Single column deepdive card linking to the full research page (Phase 2)',
  },
};
