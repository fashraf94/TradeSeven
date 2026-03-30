// src/data/forgeCollections.js
// Curated collections that group rule templates by strategic intent.
// Referenced by the Discover tab's carousel sections.

export const FORGE_COLLECTIONS = [
  {
    id: 'defensive-playbook',
    title: 'Defensive Playbook',
    subtitle: 'Protect your portfolio with risk management and smart allocation',
    icon: 'Shield',
    accentColor: '#ef4444',
    ruleIds: [
      'risk-sector-diversification',
      'risk-single-stock-limit',
      'risk-volatility-avoidance',
      'alloc-even-spread',
    ],
  },
  {
    id: 'momentum-hunter',
    title: 'Momentum Hunter',
    subtitle: 'Chase breakouts and ride trends with technical signals',
    icon: 'TrendingUp',
    accentColor: '#5eead4',
    ruleIds: [
      'tech-moving-average-trend',
      'tech-bollinger-squeeze',
      'tech-volume-surge',
      'tech-macd-bullish',
    ],
  },
  {
    id: 'value-investor',
    title: 'Value Investor',
    subtitle: 'Find undervalued companies with strong fundamentals',
    icon: 'Gem',
    accentColor: '#f59e0b',
    ruleIds: [
      'fund-value-pe',
      'fund-earnings-surprise',
      'fund-financial-health',
      'fund-revenue-growth',
    ],
  },
  {
    id: 'contrarian-edge',
    title: 'Contrarian Edge',
    subtitle: 'Go against the crowd when signals say the market overreacted',
    icon: 'RotateCcw',
    accentColor: '#8b5cf6',
    ruleIds: [
      'tech-rsi-oversold',
      'tech-rsi-overbought',
      'risk-avoid-declining-trend',
    ],
  },
  {
    id: 'conviction-plays',
    title: 'Conviction Plays',
    subtitle: 'Concentrate your bets on your highest-confidence picks',
    icon: 'Target',
    accentColor: '#f59e0b',
    ruleIds: [
      'alloc-tier-preference',
      'alloc-sector-cap',
      'tech-relative-strength',
      'alloc-sector-minimum',
    ],
  },
];
