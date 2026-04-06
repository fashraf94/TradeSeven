/**
 * Trait Library — 16 Fixed Traits for Agent DNA
 *
 * Each trait bundles 2-4 Forge rules with preset parameter profiles
 * at three strength levels (subtle, moderate, dominant).
 *
 * Strength profiles are keyed by ruleId → paramOverrides, matching
 * the same pattern as Trading Style Collections in forgeCollections.js.
 *
 * Rule IDs and param keys are validated against forgeKnowledgeBase.js.
 */

// ═══════════════════════════════════════════════════════════
// INSTINCTS — What patterns your agent recognizes
// ═══════════════════════════════════════════════════════════

const INSTINCT_TRAITS = [
  {
    id: 'trait-trend-rider',
    name: 'Trend Rider',
    identityStatement: 'Trusts the trend and buys the pullback',
    dnaGroup: 'instincts',
    icon: 'TrendingUp',
    source: 'library',
    tags: ['trend', 'moving-average', 'pullback', 'VWAP'],
    ruleIds: ['tech-moving-average-trend', 't-09', 'tv-01'],
    strengthProfiles: {
      subtle: {
        'tech-moving-average-trend': { period: '50', requireAlignment: false },
        't-09': { pct: 0.5 },
        'tv-01': { low: 45, high: 75, weak: 35, stretched: 80 },
      },
      moderate: {
        'tech-moving-average-trend': { period: '50', requireAlignment: true },
        't-09': { pct: 0.4 },
        'tv-01': { low: 50, high: 70, weak: 40, stretched: 75 },
      },
      dominant: {
        'tech-moving-average-trend': { period: '200', requireAlignment: true },
        't-09': { pct: 0.3 },
        'tv-01': { low: 55, high: 65, weak: 45, stretched: 70 },
      },
    },
  },

  {
    id: 'trait-bargain-hunter',
    name: 'Bargain Hunter',
    identityStatement: 'Targets stocks that have been beaten down too far',
    dnaGroup: 'instincts',
    icon: 'Search',
    source: 'library',
    tags: ['oversold', 'mean-reversion', 'RSI', 'bollinger'],
    ruleIds: ['tech-rsi-oversold', 'tv-06', 'tv-07'],
    strengthProfiles: {
      subtle: {
        'tech-rsi-oversold': { threshold: 35 },
        'tv-06': { percentB: 0.2 },
        'tv-07': { pct: 30 },
      },
      moderate: {
        'tech-rsi-oversold': { threshold: 30 },
        'tv-06': { percentB: 0.1 },
        'tv-07': { pct: 25 },
      },
      dominant: {
        'tech-rsi-oversold': { threshold: 25 },
        'tv-06': { percentB: 0.05 },
        'tv-07': { pct: 20 },
      },
    },
  },

  {
    id: 'trait-squeeze-whisperer',
    name: 'Squeeze Whisperer',
    identityStatement: 'Detects compressed volatility before the explosive move',
    dnaGroup: 'instincts',
    icon: 'Zap',
    source: 'library',
    tags: ['squeeze', 'bollinger', 'NR7', 'volatility', 'breakout'],
    ruleIds: ['t-12', 'tv-05', 't-15'],
    strengthProfiles: {
      subtle: {
        't-12': { pct: 10, vol: 1.2 },
        'tv-05': { bw: 6, direction: 'positive' },
        't-15': { score: 60 },
      },
      moderate: {
        't-12': { pct: 8, vol: 1.3 },
        'tv-05': { bw: 5, direction: 'positive and growing' },
        't-15': { score: 65 },
      },
      dominant: {
        't-12': { pct: 5, vol: 1.5 },
        'tv-05': { bw: 4, direction: 'positive and growing' },
        't-15': { score: 70 },
      },
    },
  },

  {
    id: 'trait-volume-believer',
    name: 'Volume Believer',
    identityStatement: 'Only trusts moves that institutional money confirms',
    dnaGroup: 'instincts',
    icon: 'BarChart3',
    source: 'library',
    tags: ['volume', 'institutional', 'confirmation', 'spike'],
    ruleIds: ['t-14', 'tv-13', 'tv-08'],
    strengthProfiles: {
      subtle: {
        't-14': { mult: 1.3 },
        'tv-13': { mult: 1.8 },
        'tv-08': { vol: 0.9 },
      },
      moderate: {
        't-14': { mult: 1.5 },
        'tv-13': { mult: 2.0 },
        'tv-08': { vol: 0.8 },
      },
      dominant: {
        't-14': { mult: 2.0 },
        'tv-13': { mult: 2.5 },
        'tv-08': { vol: 0.7 },
      },
    },
  },

  {
    id: 'trait-breakout-chaser',
    name: 'Breakout Chaser',
    identityStatement: 'Wants stocks making new highs with momentum behind them',
    dnaGroup: 'instincts',
    icon: 'ArrowUpRight',
    source: 'library',
    tags: ['breakout', '52-week-high', 'momentum', 'relative-strength'],
    ruleIds: ['tv-11', 't-11', 'tv-02'],
    strengthProfiles: {
      subtle: {
        'tv-11': { score: 7, pct: 10 },
        't-11': { score: 13, floor: 8 },
        'tv-02': { action: 'hold but monitor' },
      },
      moderate: {
        'tv-11': { score: 9, pct: 5 },
        't-11': { score: 15, floor: 10 },
        'tv-02': { action: 'reduce tier' },
      },
      dominant: {
        'tv-11': { score: 10, pct: 3 },
        't-11': { score: 18, floor: 12 },
        'tv-02': { action: 'flag for swap' },
      },
    },
  },

  {
    id: 'trait-smart-money-tracker',
    name: 'Smart Money Tracker',
    identityStatement: 'Follows where institutional capital is flowing',
    dnaGroup: 'instincts',
    icon: 'Compass',
    source: 'library',
    tags: ['VWAP', 'institutional', 'sector', 'smart-money'],
    ruleIds: ['tv-04', 'mb-05', 'tv-14'],
    strengthProfiles: {
      subtle: {
        'tv-04': { dev: 0.2 },
        'mb-05': { signal: 'any bullish' },
        'tv-14': { max_pct: 50 },
      },
      moderate: {
        'tv-04': { dev: 0.3 },
        'mb-05': { signal: 'any bullish' },
        'tv-14': { max_pct: 40 },
      },
      dominant: {
        'tv-04': { dev: 0.5 },
        'mb-05': { signal: 'bullish crossover' },
        'tv-14': { max_pct: 30 },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════
// STRATEGY — How your agent thinks about the game
// ═══════════════════════════════════════════════════════════

const STRATEGY_TRAITS = [
  {
    id: 'trait-threshold-harvester',
    name: 'Threshold Harvester',
    identityStatement: 'Banks scoring bonuses and rotates into the next opportunity',
    dnaGroup: 'strategy',
    icon: 'Target',
    source: 'library',
    tags: ['threshold', 'harvest', 'scoring', 'BaggerBomb'],
    ruleIds: ['th-01', 'tv-15', 'th-10'],
    strengthProfiles: {
      subtle: {
        'th-01': { atr: 0.25, mult: 2.0, drawdown: 0.3 },
        'tv-15': { threshold: 'Double Bagger (+1.5x)', evals: 3 },
        'th-10': { posture: 'Balanced' },
      },
      moderate: {
        'th-01': { atr: 0.2, mult: 2.0, drawdown: 0.25 },
        'tv-15': { threshold: 'BaggerBomb (+1.0x)', evals: 2 },
        'th-10': { posture: 'Harvest (many +15s)' },
      },
      dominant: {
        'th-01': { atr: 0.15, mult: 2.5, drawdown: 0.2 },
        'tv-15': { threshold: 'Any positive threshold', evals: 1 },
        'th-10': { posture: 'Harvest (many +15s)' },
      },
    },
  },

  {
    id: 'trait-dual-conviction',
    name: 'Dual Conviction',
    identityStatement: 'Requires both fundamentals and technicals to agree before committing',
    dnaGroup: 'strategy',
    icon: 'CheckCheck',
    source: 'library',
    tags: ['dual-confirmation', 'fundamental', 'technical', 'multi-factor'],
    ruleIds: ['tv-10', 'tv-12'],
    strengthProfiles: {
      subtle: {
        'tv-10': { fund_score: 55, tech_score: 50 },
        'tv-12': { tech: 50, rsi_low: 40, rsi_high: 75, vol: 1.1 },
      },
      moderate: {
        'tv-10': { fund_score: 65, tech_score: 60 },
        'tv-12': { tech: 60, rsi_low: 45, rsi_high: 70, vol: 1.2 },
      },
      dominant: {
        'tv-10': { fund_score: 75, tech_score: 70 },
        'tv-12': { tech: 70, rsi_low: 50, rsi_high: 65, vol: 1.5 },
      },
    },
  },

  {
    id: 'trait-score-adaptor',
    name: 'Score Adaptor',
    identityStatement: 'Plays differently when winning than when losing',
    dnaGroup: 'strategy',
    icon: 'Gauge',
    source: 'library',
    tags: ['game-state', 'adaptive', 'score-aware'],
    ruleIds: ['gs-05', 'gs-06'],
    strengthProfiles: {
      subtle: {
        'gs-05': { pct: 15 },
        'gs-06': { pct: 88, reduction: 30 },
      },
      moderate: {
        'gs-05': { pct: 10 },
        'gs-06': { pct: 80, reduction: 50 },
      },
      dominant: {
        'gs-05': { pct: 5 },
        'gs-06': { pct: 72, reduction: 60 },
      },
    },
  },

  {
    id: 'trait-sector-rotator',
    name: 'Sector Rotator',
    identityStatement: 'Rides the sector wave and picks each sector\'s champion',
    dnaGroup: 'strategy',
    icon: 'RefreshCw',
    source: 'library',
    tags: ['sector', 'rotation', 'FantasyTimes', 'RS'],
    ruleIds: ['tv-14', 'a-08'],
    strengthProfiles: {
      subtle: {
        'tv-14': { max_pct: 50, evals: 3 },
        'a-08': { sentiment: 'neutral or better' },
      },
      moderate: {
        'tv-14': { max_pct: 40, evals: 2 },
        'a-08': { sentiment: 'bullish' },
      },
      dominant: {
        'tv-14': { max_pct: 30, evals: 1 },
        'a-08': { sentiment: 'bullish' },
      },
    },
  },

  {
    id: 'trait-penalty-dodger',
    name: 'Penalty Dodger',
    identityStatement: 'Protects the score from catastrophic damage above all else',
    dnaGroup: 'strategy',
    icon: 'ShieldAlert',
    source: 'library',
    tags: ['penalty', 'protection', 'tier', 'volatility'],
    ruleIds: ['ts-07', 'ts-01'],
    strengthProfiles: {
      subtle: {
        'ts-07': { atr: 0.3, recovery: 0.5 },
        'ts-01': { pct: 250, tier: 'Core' },
      },
      moderate: {
        'ts-07': { atr: 0.25, recovery: 0.5 },
        'ts-01': { pct: 200, tier: 'Support' },
      },
      dominant: {
        'ts-07': { atr: 0.2, recovery: 0.6 },
        'ts-01': { pct: 150, tier: 'Support' },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════
// DISCIPLINE — How your agent controls itself
// ═══════════════════════════════════════════════════════════

const DISCIPLINE_TRAITS = [
  {
    id: 'trait-iron-discipline',
    name: 'Iron Discipline',
    identityStatement: 'Never lets one bad stock ruin the battle',
    dnaGroup: 'discipline',
    icon: 'Lock',
    source: 'library',
    tags: ['risk', 'stop-loss', 'hurdle', 'circuit-breaker'],
    ruleIds: ['mb-09', 'mb-04', 'mb-07'],
    strengthProfiles: {
      subtle: {
        'mb-09': { atr: -1.2 },
        'mb-04': { atr: 0.3 },
        'mb-07': { swaps: 3, window: 60 },
      },
      moderate: {
        'mb-09': { atr: -1.0 },
        'mb-04': { atr: 0.5 },
        'mb-07': { swaps: 2, window: 60 },
      },
      dominant: {
        'mb-09': { atr: -0.75 },
        'mb-04': { atr: 0.7 },
        'mb-07': { swaps: 2, window: 45 },
      },
    },
  },

  {
    id: 'trait-patient-holder',
    name: 'Patient Holder',
    identityStatement: 'Gives picks time to work instead of reacting to every dip',
    dnaGroup: 'discipline',
    icon: 'Clock',
    source: 'library',
    tags: ['patience', 'hold', 'disposition', 'maturation'],
    ruleIds: ['mb-01', 'mb-08', 'tv-03'],
    strengthProfiles: {
      subtle: {
        'mb-01': { minutes: 45 },
        'mb-08': { threshold: 'Double Bagger (+1.5x)' },
        'tv-03': { score: 50, minutes: 90 },
      },
      moderate: {
        'mb-01': { minutes: 90 },
        'mb-08': { threshold: 'BaggerBomb (+1.0x)' },
        'tv-03': { score: 60, minutes: 120 },
      },
      dominant: {
        'mb-01': { minutes: 150 },
        'mb-08': { threshold: 'BaggerBomb (+1.0x)' },
        'tv-03': { score: 55, minutes: 180 },
      },
    },
  },

  {
    id: 'trait-active-trader',
    name: 'Active Trader',
    identityStatement: 'Rotates fast into what is working right now',
    dnaGroup: 'discipline',
    icon: 'Repeat',
    source: 'library',
    tags: ['swap', 'rotation', 'stagnation', 'active'],
    ruleIds: ['mb-03', 'ts-04'],
    strengthProfiles: {
      subtle: {
        'mb-03': { atr: 0.3, minutes: 120 },
        'ts-04': { interval: 45, cycles: 3 },
      },
      moderate: {
        'mb-03': { atr: 0.2, minutes: 90 },
        'ts-04': { interval: 30, cycles: 2 },
      },
      dominant: {
        'mb-03': { atr: 0.15, minutes: 60 },
        'ts-04': { interval: 20, cycles: 1 },
      },
    },
  },

  {
    id: 'trait-diversifier',
    name: 'Diversifier',
    identityStatement: 'Spreads risk across sectors so no single bet sinks the ship',
    dnaGroup: 'discipline',
    icon: 'PieChart',
    source: 'library',
    tags: ['diversification', 'barbell', 'bench', 'sectors'],
    ruleIds: ['a-05', 'a-09'],
    strengthProfiles: {
      subtle: {
        'a-05': { anchors: 1, rockets: 2 },
        'a-09': { complement: 1 },
      },
      moderate: {
        'a-05': { anchors: 2, rockets: 3 },
        'a-09': { complement: 2 },
      },
      dominant: {
        'a-05': { anchors: 3, rockets: 2 },
        'a-09': { complement: 3 },
      },
    },
  },

  {
    id: 'trait-let-winners-run',
    name: 'Let Winners Run',
    identityStatement: 'Holds the best picks through scoring thresholds instead of cashing out early',
    dnaGroup: 'discipline',
    icon: 'Rocket',
    source: 'library',
    tags: ['winners', 'threshold', 'hold', 'patience'],
    ruleIds: ['mb-08', 'th-01'],
    strengthProfiles: {
      subtle: {
        'mb-08': { threshold: 'Double Bagger (+1.5x)' },
        'th-01': { atr: 0.25, mult: 2.0, drawdown: 0.3 },
      },
      moderate: {
        'mb-08': { threshold: 'BaggerBomb (+1.0x)' },
        'th-01': { atr: 0.2, mult: 2.5, drawdown: 0.25 },
      },
      dominant: {
        'mb-08': { threshold: 'BaggerBomb (+1.0x)' },
        'th-01': { atr: 0.15, mult: 3.0, drawdown: 0.2 },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════
// Combined library + lookup helpers
// ═══════════════════════════════════════════════════════════

export const TRAIT_LIBRARY = [
  ...INSTINCT_TRAITS,
  ...STRATEGY_TRAITS,
  ...DISCIPLINE_TRAITS,
];

// Map for O(1) lookup by trait ID
export const TRAIT_BY_ID = Object.fromEntries(
  TRAIT_LIBRARY.map(t => [t.id, t])
);

// Get all traits for a specific DNA group
export function getTraitsForGroup(groupId) {
  return TRAIT_LIBRARY.filter(t => t.dnaGroup === groupId);
}

// Get all unique rule IDs referenced across all traits
export function getAllTraitRuleIds() {
  const ids = new Set();
  for (const trait of TRAIT_LIBRARY) {
    for (const ruleId of trait.ruleIds) {
      ids.add(ruleId);
    }
  }
  return [...ids];
}
