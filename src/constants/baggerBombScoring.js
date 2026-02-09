// baggerBombScoring.js — Single source of truth for BaggerBomb scoring constants
// Used by V3 hooks, scoring engines, and all display components
//
// CANONICAL VALUES (Asymmetric — busts hurt more):
//   Positive: BaggerBomb +15, Double Bagger +30, TenBagger +50
//   Negative: Bust -10, Crash -20, Meltdown -35

// ==================== THRESHOLD TIERS ====================

/**
 * Positive (bagger) tiers
 * multiplier = how many multiples of baseATR the price must move
 */
export const BAGGER_TIERS = [
  { key: 'bagger',       label: 'BaggerBomb',    emoji: '💣',    multiplier: 1.0, points: 15  },
  { key: 'doubleBagger', label: 'Double Bagger',  emoji: '💣💣',  multiplier: 1.5, points: 30  },
  { key: 'tenBagger',    label: 'TenBagger',      emoji: '🚀💣',  multiplier: 2.0, points: 50  },
];

/**
 * Negative (bust) tiers
 * multiplier = how many multiples of baseATR the price must drop
 */
export const BUST_TIERS = [
  { key: 'bust',     label: 'Bust',     emoji: '📉',      multiplier: 1.0, points: -10 },
  { key: 'crash',    label: 'Crash',    emoji: '💥',      multiplier: 1.5, points: -20 },
  { key: 'meltdown', label: 'Meltdown', emoji: '🔥',      multiplier: 2.0, points: -35 },
];

// ==================== FLAT LOOKUPS ====================

/** Points keyed by tier name — drop-in replacement for THRESHOLD_POINTS */
export const THRESHOLD_POINTS = {
  bagger: 15,
  doubleBagger: 30,
  tenBagger: 50,
  bust: -10,
  crash: -20,
  meltdown: -35,
};

/** Multipliers keyed by tier name — drop-in replacement for THRESHOLD_MULTIPLIERS */
export const THRESHOLD_MULTIPLIERS = {
  bagger: 1.0,
  doubleBagger: 1.5,
  tenBagger: 2.0,
  bust: -1.0,
  crash: -1.5,
  meltdown: -2.0,
};

// ==================== CONVICTION MULTIPLIERS ====================

/** Tier-based conviction multipliers for Star/Core/Support portfolios.
 *  Applied to percentage-based points only; BaggerBomb/Bust bonuses stay flat. */
export const CONVICTION_MULTIPLIERS = {
  star: 2.0,
  core: 1.5,
  support: 1.0,
};

// ==================== LINEAR SCORING ====================

/** Per-threshold points for linear scoring engines (sessionScoringService, breakoutDetection) */
export const POINTS_PER_BAGGERBOMB = 15;
export const POINTS_PER_BUST = -10;

// ==================== DISPLAY HELPERS ====================

/**
 * Get display info for a threshold tier
 * @param {string} tierKey - 'bagger', 'doubleBagger', 'tenBagger', 'bust', 'crash', 'meltdown'
 * @returns {{ label: string, emoji: string, points: number, color: string } | null}
 */
export function getThresholdDisplay(tierKey) {
  const all = [...BAGGER_TIERS, ...BUST_TIERS];
  const tier = all.find(t => t.key === tierKey);
  if (!tier) return null;

  const isPositive = tier.points > 0;
  return {
    label: tier.label,
    emoji: tier.emoji,
    points: tier.points,
    pointsLabel: `${isPositive ? '+' : ''}${tier.points} pts`,
    color: isPositive ? '#10b981' : '#ef4444',
  };
}
