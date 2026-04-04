// src/data/forgeCollections.js
// Curated collections that group rule templates by strategic intent.
// Referenced by the Discover tab's carousel sections.

// ══════════════════════════════════════
// TRADING STYLE COLLECTIONS (Phase E)
// ══════════════════════════════════════
// Each collection tells a distinct strategic story with 9 non-overlapping rules.
// paramOverrides keys are reconciled against forgeKnowledgeBase.js Phase A param keys.

export const TRADING_STYLE_COLLECTIONS = [
  {
    id: 'swing-trader',
    title: 'Swing Trader',
    subtitle: 'Capture today\'s explosive move from a multi-day setup at its inflection point.',
    icon: 'TrendingUp',
    accentColor: '#5EEAD4',
    difficulty: 'intermediate',
    tags: ['trend', 'patience', 'daily-chart', 'institutional', 'conviction'],
    isStyleCollection: true,

    philosophy: 'Traditional swing trading targets moves that unfold over 2\u20135 days. In a 1-day BaggerBomb battle, the swing trader\u2019s edge is compressed: you\u2019re identifying stocks currently at the explosive inflection point of a daily-chart setup \u2014 a stock that has been building a multi-day base, pulling back to daily support, or completing a pattern that is likely to produce today\u2019s outsized move. The swing trader enters with patience, holds with conviction, and trusts the daily structure over intraday noise.',

    conflicts: ['day-trader'],

    rules: [
      {
        ruleId: 'tech-rsi-oversold',
        paramOverrides: { threshold: 35, volumeConfirm: true },
        rationale: 'Swing setups target stocks pulling back within an uptrend, not stocks in freefall. A 14-day RSI of 35 catches the "coiled spring" at daily support before the trend fully breaks \u2014 deeper than a day trader\'s entry but not so deep that it signals a regime change. Volume confirmation ensures institutional accumulation is driving the reversal, not just retail speculation.',
      },
      {
        ruleId: 'tech-moving-average-trend',
        paramOverrides: { period: '50', requireAlignment: true },
        rationale: 'The 50-day SMA is the institutional benchmark for intermediate trend health. Full bullish alignment (SMA 20 > 50 > 200) confirms that short-term momentum, medium-term trend, and long-term structure are all pushing in agreement. When a stock with this alignment experiences a brief pullback, it represents a high-probability swing entry.',
      },
      {
        ruleId: 't-09',
        paramOverrides: { pct: 0.5 },
        rationale: 'Swing traders give VWAP pullbacks more breathing room than day traders (who use 0.2%). A 0.5% tolerance absorbs the "liquidity traps" where institutional algorithms deliberately breach VWAP to trigger retail stop-losses before resuming the upward trend.',
      },
      {
        ruleId: 't-11',
        paramOverrides: { score: 17, floor: 10 },
        rationale: 'Relative Strength vs. SPY identifies where institutional capital is flowing. A score of 17 out of 22 targets the top ~25% of market leaders \u2014 stocks that hold up during broad market corrections because large funds are quietly accumulating positions.',
      },
      {
        ruleId: 'mb-01',
        paramOverrides: { minutes: 90 },
        rationale: 'Swing trades need time to mature. A 90-minute hold clears the erratic opening range (9:30\u201310:30 AM) and the 10:30 AM "re-evaluation" window where trends often reverse before continuing.',
      },
      {
        ruleId: 'mb-08',
        paramOverrides: { threshold: 'BaggerBomb (+1.0x)' },
        rationale: 'The disposition effect \u2014 the urge to sell winners early \u2014 is the primary failure mode for swing traders operating in fast environments. Setting the floor at BaggerBomb means the agent won\'t exit a winning stock until it has demonstrated significant directional strength.',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -1.5 },
        rationale: 'Swing setups in volatile stocks need room to breathe. A -1.5 ATR stop is wider than the day trader\'s -1.0 ATR because the swing thesis expects larger intraday swings as the daily-chart pattern resolves.',
      },
      {
        ruleId: 'th-01',
        paramOverrides: { atr: 0.5, mult: 3.0, drawdown: 0.5 },
        rationale: 'When a stock is within 0.5 ATR of a scoring threshold, the swing trader becomes extremely resistant to swapping it out (3.0x multiplier). This reflects high-conviction patience \u2014 if the daily-chart setup is nearing its payout, abandoning it destroys expected value.',
      },
      {
        ruleId: 'ts-04',
        paramOverrides: { interval: 60, cycles: 2 },
        rationale: 'Swing traders don\'t micro-manage tier assignments. A 60-minute review interval provides enough data to make a confident promotion decision without churning the portfolio every eval tick.',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'day-trader',
    title: 'Day Trader',
    subtitle: 'VWAP-centric intraday execution with aggressive position rotation.',
    icon: 'Zap',
    accentColor: '#6366F1',
    difficulty: 'intermediate',
    tags: ['VWAP', 'intraday', 'speed', 'mean-reversion', 'session-timing'],
    isStyleCollection: true,

    philosophy: 'The day trader operates on intraday microstructure, not daily chart setups. VWAP is the institutional fair-value anchor \u2014 the line where professional desks execute large block orders. The day trader buys pullbacks to VWAP in uptrends, cuts positions fast when they break below fair value, avoids the midday liquidity trap, and rotates aggressively into momentum leaders during Power Hour. Speed and precision beat patience in a 6.5-hour session.',

    conflicts: ['swing-trader'],

    rules: [
      {
        ruleId: 't-09',
        paramOverrides: { pct: 0.2 },
        rationale: 'Day traders demand tighter VWAP proximity than swing traders (who use 0.5%). A 0.2% pullback to VWAP is the institutional "sweet spot" \u2014 the zone where algorithmic buyers programmatically defend the session average.',
      },
      {
        ruleId: 't-10',
        paramOverrides: { dev: 2.5 },
        rationale: 'In a normal distribution, 95% of price action falls within 2.0 standard deviations of VWAP. Setting the fade to 2.5\u03c3 lets strong momentum stocks "walk the bands" while flagging genuine statistical exhaustion at the 99th percentile.',
      },
      {
        ruleId: 'mb-05',
        paramOverrides: { signal: 'positive histogram' },
        rationale: 'A positive MACD histogram is a continuous state that confirms active, expanding bullish momentum at the exact moment the swap logic executes. This state-based approach gives the day trader a 1\u20132 bar advantage over crossover-based entries.',
      },
      {
        ruleId: 'mb-11',
        paramOverrides: { time: '3:00 PM', pct: 60 },
        rationale: 'The final hour accounts for 20\u201330% of the session\'s total volume. A 60% hurdle rate reduction at 3:00 PM creates the urgency needed to rotate out of flattened "morning winners" in favor of "afternoon squeezes."',
      },
      {
        ruleId: 'mb-15',
        paramOverrides: { intervals: 2 },
        rationale: 'If a stock stays below VWAP for 30 minutes (two eval intervals), the intraday thesis is broken. Institutional sentiment has shifted \u2014 cut fast, rotate to a stock where buyers are in control.',
      },
      {
        ruleId: 'mb-10',
        paramOverrides: { start: '11:30 AM', end: '2:00 PM' },
        rationale: 'Between 11:30 AM and 2:00 PM, institutional traders step away and volume drops 40%+. Blocking swap evaluations during this window prevents the agent from churning on low-conviction signals.',
      },
      {
        ruleId: 'mb-03',
        paramOverrides: { atr: 0.3, minutes: 60 },
        rationale: 'A stock that moves less than 30% of its daily ATR in a full hour is "dead money." The day trader\'s velocity requirement is more aggressive because day trading is fundamentally about capital efficiency.',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -1.0 },
        rationale: 'The day trader uses a tighter stop (-1.0 ATR) than the swing trader (-1.5 ATR) because the intraday thesis should resolve quickly. Day traders entered on precision (0.2% from VWAP); if the entry doesn\'t work almost immediately, holding longer just compounds the loss.',
      },
      {
        ruleId: 'mb-12',
        paramOverrides: { pct: 20, start: '1:00 PM' },
        rationale: 'Starting a 20% hourly hurdle rate decay at 1:00 PM creates accelerating urgency. By the final hour, the bar for swapping is dramatically lower, priming the portfolio for aggressive Power Hour rotations.',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'momentum-rider',
    title: 'Momentum Rider',
    subtitle: 'Target explosive breakouts and ride winners past BaggerBomb toward Double Bagger.',
    icon: 'Rocket',
    accentColor: '#F472B6',
    difficulty: 'advanced',
    tags: ['breakout', 'volatility', 'squeeze', 'relative-strength', 'conviction'],
    isStyleCollection: true,

    philosophy: 'The BaggerBomb scoring math favors aggression: one Triple Bagger at Star tier (+100 points) offsets five Busts at Star tier (-100 points). The momentum rider accepts a lower win rate in exchange for capturing fat-tailed moves that reach +1.5 and +2.0 ATR. Entry targets stocks in extreme volatility compression with institutional relative strength, then holds through intraday noise with widened stops to let winners run past BaggerBomb toward Double Bagger.',

    conflicts: ['defensive-fortress'],

    rules: [
      {
        ruleId: 'tech-bollinger-squeeze',
        paramOverrides: { bandwidthThreshold: 15, volumeConfirm: true },
        rationale: 'A Bollinger Bandwidth at the 15th percentile identifies stocks compressed tighter than 85% of recent history \u2014 a "coiled spring" ready to explode. Volume confirmation is non-negotiable: breakouts without institutional volume are "head fakes" that mean-revert into Bust penalties.',
      },
      {
        ruleId: 'tech-macd-bullish',
        paramOverrides: { macdDirection: 'histogram expanding', rsiFloor: 55 },
        rationale: 'An expanding MACD histogram means short-term momentum is pulling away from the longer-term trend at an increasing rate \u2014 the "momentum of momentum." The RSI floor of 55 confirms the stock is firmly in the bullish regime.',
      },
      {
        ruleId: 't-11',
        paramOverrides: { score: 18, floor: 12 },
        rationale: 'The momentum rider demands top-decile institutional leadership. A Relative Strength score of 18 out of 22 targets the top ~18% of equities experiencing price-agnostic institutional demand.',
      },
      {
        ruleId: 't-12',
        paramOverrides: { pct: 10 },
        rationale: 'The 10th percentile squeeze identifies the most extreme compression \u2014 tighter than 90% of history. These rare setups have the highest expectancy for multi-ATR explosive moves.',
      },
      {
        ruleId: 'mb-08',
        paramOverrides: { threshold: 'Double Bagger (+1.5x)' },
        rationale: 'This is the defining parameter of the momentum rider. One Double Bagger at Star tier (+60 points) fully funds three Busts. A stock that has already reached +1.0 ATR has demonstrated genuine momentum \u2014 the conditional probability of extending to +1.5 ATR is significantly higher.',
      },
      {
        ruleId: 'mb-11',
        paramOverrides: { time: '3:00 PM', pct: 50 },
        rationale: 'A 50% hurdle reduction at 3:00 PM makes the agent hyper-sensitive to late-day volume spikes. This is less aggressive than the day trader\'s 60% because the momentum rider\'s edge is holding winners, not rotating.',
      },
      {
        ruleId: 'th-04',
        paramOverrides: { threshold: 'BaggerBomb', atr: 0.75 },
        rationale: 'After BaggerBomb, the momentum rider widens the trailing stop by 0.75 ATR \u2014 the exact opposite of the defensive player. This "house money" logic treats secured points as a cushion to pursue Double Bagger.',
      },
      {
        ruleId: 'ts-04',
        paramOverrides: { interval: 30, cycles: 2 },
        rationale: 'The momentum rider promotes aggressively but not recklessly. A 30-minute review window with 0.4 ATR threshold confirms genuine "escape velocity" before committing the Star tier\'s 2x multiplier.',
      },
      {
        ruleId: 'mb-04',
        paramOverrides: { atr: 0.4 },
        rationale: 'The swap hurdle rate of 0.4 ATR ensures bench-to-portfolio rotations are genuine upgrades, not lateral moves between stocks in the same noise regime.',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'defensive-fortress',
    title: 'Defensive Fortress',
    subtitle: 'Win by not losing \u2014 capital preservation through penalty avoidance and tight risk controls.',
    icon: 'Shield',
    accentColor: '#EF4444',
    difficulty: 'intermediate',
    tags: ['capital-preservation', 'penalty-avoidance', 'diversification', 'low-volatility', 'consistency'],
    isStyleCollection: true,

    philosophy: 'A single Meltdown on a Star-tier stock costs -70 effective points \u2014 equivalent to wiping out nearly five BaggerBombs on Support stocks. The defensive player recognizes that in a field where aggressive competitors occasionally Meltdown, consistency compounds. This collection prioritizes exiting before penalties trigger, locking in threshold bonuses immediately, demoting weakening stocks from high-multiplier tiers, and diversifying across sectors to prevent correlated drawdowns.',

    conflicts: ['momentum-rider'],

    rules: [
      {
        ruleId: 'tech-rsi-overbought',
        paramOverrides: { threshold: 65, strictMode: true },
        rationale: 'An RSI ceiling of 65 is tighter than the traditional 70 threshold because by the time the 15-minute eval payload reflects RSI 70, the stock has likely already begun its reversal. Strict mode enforces this as a hard exclusion \u2014 the agent is mathematically barred from buying any stock above RSI 65.',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -0.7 },
        rationale: 'Setting the stop at -0.7 ATR \u2014 well before the -1.0 ATR Bust penalty threshold \u2014 ensures the agent exits while the loss is still a standard P&L fluctuation, not a scoring catastrophe. Taking a guaranteed -0.7 ATR P&L loss with zero penalty points is exponentially better than risking -1.0 ATR plus a -10 point penalty.',
      },
      {
        ruleId: 'mb-07',
        paramOverrides: { swaps: 2, window: 60, freeze: 45 },
        rationale: 'If the agent executes two swaps within 60 minutes, the predictive models are out of sync with the current market regime. The 45-minute freeze prevents "behavioral cascading" \u2014 the algorithmic equivalent of tilt.',
      },
      {
        ruleId: 'th-05',
        paramOverrides: { tier: 'Star', atr: 0.3 },
        rationale: 'When a Star-tier stock hits a positive threshold, the defensive player immediately tightens the trailing stop to 0.3 ATR. This guarantees the threshold bonus is locked in, willingly sacrificing the improbable Double Bagger to eliminate reversion risk.',
      },
      {
        ruleId: 'th-07',
        paramOverrides: { mult: 2.0 },
        rationale: 'Grounded in Kahneman and Tversky\'s Prospect Theory, where the loss aversion coefficient \u03bb is ~2.0\u20132.25. This forces the agent to perceive negative thresholds as twice as close, triggering maximum swap urgency.',
      },
      {
        ruleId: 'ts-07',
        paramOverrides: { atr: 0.5, recovery: 0.8 },
        rationale: 'When a Star-tier stock degrades to -0.5 ATR from entry, it\'s demoted to Support. A high recovery distance (0.8 ATR) prevents "dead cat bounce" re-promotions \u2014 a stock that dropped this far has demonstrated structural weakness.',
      },
      {
        ruleId: 'risk-sector-diversification',
        paramOverrides: { n: 4 },
        rationale: 'With a 5\u20138 stock portfolio, requiring 4 distinct sectors caps any single sector at ~40% exposure. If one sector collapses, the other stocks provide a "fortress" of stability.',
      },
      {
        ruleId: 'a-09',
        paramOverrides: { complement: 3, high_upside: 1 },
        rationale: 'Three bench stocks from different sectors ensures immediate rotation options if the market regime shifts. Exactly 1 high-ATR "lottery ticket" provides controlled, fractional-Kelly exposure to asymmetric upside.',
      },
      {
        ruleId: 'ts-09',
        paramOverrides: { minutes: 45, tier: 'Core' },
        rationale: 'The first 45 minutes are the highest-risk period for false signals. Restricting maximum tier to Core means even a Meltdown in the opening chaos costs -52.5 points instead of -70 points.',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },
];

// ══════════════════════════════════════
// THEMED COLLECTIONS (Original)
// ══════════════════════════════════════

export const FORGE_COLLECTIONS = [
  ...TRADING_STYLE_COLLECTIONS,
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
  {
    id: 'battle-tactics',
    title: 'Battle Tactics',
    subtitle: 'Rules that control when and how your agent trades during live battles',
    icon: 'Swords',
    accentColor: '#6366F1',
    ruleIds: [
      'mb-01',
      'mb-04',
      'mb-07',
      'mb-09',
      'mb-10',
      'mb-15',
    ],
  },
  {
    id: 'game-clock-plays',
    title: 'Game Clock Plays',
    subtitle: 'Phase-aware rules that shift strategy as the battle progresses',
    icon: 'Clock',
    accentColor: '#94A3B8',
    ruleIds: [
      'gs-01',
      'gs-02',
      'gs-04',
      'gs-05',
      'gs-06',
    ],
  },
  {
    id: 'threshold-hunters',
    title: 'Threshold Hunters',
    subtitle: 'Strategies for pursuing and protecting scoring bonuses',
    icon: 'Target',
    accentColor: '#e879f9',
    ruleIds: [
      'th-01',
      'th-04',
      'th-07',
      'th-09',
      'th-10',
    ],
  },
  {
    id: 'tier-master',
    title: 'Tier Master',
    subtitle: 'Control how the Star, Core, and Support multipliers are assigned',
    icon: 'Layers',
    accentColor: '#fbbf24',
    ruleIds: [
      'ts-01',
      'ts-04',
      'ts-05',
      'ts-07',
      'ts-09',
    ],
  },
];
