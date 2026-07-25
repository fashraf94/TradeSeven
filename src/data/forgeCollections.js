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
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tech-moving-average-trend',
        paramOverrides: { period: '50', requireAlignment: true },
        rationale: 'The 50-day SMA is the institutional benchmark for intermediate trend health. Full bullish alignment (SMA 20 > 50 > 200) confirms that short-term momentum, medium-term trend, and long-term structure are all pushing in agreement. When a stock with this alignment experiences a brief pullback, it represents a high-probability swing entry.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-01',
        paramOverrides: {},
        rationale: 'The swing entry is a pause inside an uptrend, not a breakdown. The RSI momentum zone targets stocks with building strength that have not yet overextended — the daily-chart equivalent of buying the dip without buying the reversal. It complements the deeper oversold screen above: that one catches the stock at daily support, this one catches it still riding the trend.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 't-11',
        paramOverrides: { score: 17, floor: 10 },
        rationale: 'Relative Strength vs. SPY identifies where institutional capital is flowing. A score of 17 out of 22 targets the top ~25% of market leaders \u2014 stocks that hold up during broad market corrections because large funds are quietly accumulating positions.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-01',
        paramOverrides: { minutes: 90 },
        rationale: 'Swing trades need time to mature. A 90-minute hold clears the erratic opening range (9:30\u201310:30 AM) and the 10:30 AM "re-evaluation" window where trends often reverse before continuing.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-08',
        paramOverrides: { threshold: 'BaggerBomb (+1.0x)' },
        rationale: 'The disposition effect \u2014 the urge to sell winners early \u2014 is the primary failure mode for swing traders operating in fast environments. Setting the floor at BaggerBomb means the agent won\'t exit a winning stock until it has demonstrated significant directional strength.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -1.5 },
        rationale: 'Swing setups in volatile stocks need room to breathe. A -1.5 ATR stop is wider than the day trader\'s -1.0 ATR because the swing thesis expects larger intraday swings as the daily-chart pattern resolves.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'th-01',
        paramOverrides: { atr: 0.5, mult: 3.0, drawdown: 0.5 },
        rationale: 'When a stock is within 0.5 ATR of a scoring threshold, the swing trader becomes extremely resistant to swapping it out (3.0x multiplier). This reflects high-conviction patience \u2014 if the daily-chart setup is nearing its payout, abandoning it destroys expected value.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'ts-04',
        paramOverrides: { interval: 60, cycles: 2 },
        rationale: 'Swing traders don\'t micro-manage tier assignments. A 60-minute review interval provides enough data to make a confident promotion decision without churning the portfolio every eval tick.',
        priority: 1,
        priorityLabel: 'Core Strategy',
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

    // ── RETIRED (C-20, Jul 25 2026) ──────────────────────────────────────────
    retired: true,
    retiredReason:
      'Its stated thesis is VWAP-centric intraday execution, and its entire VWAP '
      + 'core (t-09 pullback, t-10 sigma-band fade, mb-05 VWAP+MACD swap gate) cites '
      + 'signals that exist on no running path: VWAP is computed for HELD positions '
      + 'only, there are no VWAP sigma-bands, and no 5-minute MACD. Substituting '
      + 'would have left a preset labelled "VWAP-centric" containing no VWAP, which '
      + 'is a mislabel rather than a fix.',
    returnsWith:
      'The intraday/VWAP build: candidate-side VWAP plus 5-min RSI/MACD. Signal '
      + 'Inventory V2 notes this is a COMPUTATION gap, not a data gap — 5-minute bars '
      + 'are already fetched and one 5-min indicator (sma20_5m) already ships.',

    philosophy: 'The day trader operates on intraday microstructure, not daily chart setups. VWAP is the institutional fair-value anchor \u2014 the line where professional desks execute large block orders. The day trader buys pullbacks to VWAP in uptrends, cuts positions fast when they break below fair value, avoids the midday liquidity trap, and rotates aggressively into momentum leaders during Power Hour. Speed and precision beat patience in a 6.5-hour session.',

    conflicts: ['swing-trader'],

    rules: [
      {
        ruleId: 't-09',
        paramOverrides: { pct: 0.2 },
        rationale: 'Day traders demand tighter VWAP proximity than swing traders (who use 0.5%). A 0.2% pullback to VWAP is the institutional "sweet spot" \u2014 the zone where algorithmic buyers programmatically defend the session average.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 't-10',
        paramOverrides: { dev: 2.5 },
        rationale: 'In a normal distribution, 95% of price action falls within 2.0 standard deviations of VWAP. Setting the fade to 2.5\u03c3 lets strong momentum stocks "walk the bands" while flagging genuine statistical exhaustion at the 99th percentile.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-05',
        paramOverrides: { signal: 'positive histogram' },
        rationale: 'A positive MACD histogram is a continuous state that confirms active, expanding bullish momentum at the exact moment the swap logic executes. This state-based approach gives the day trader a 1\u20132 bar advantage over crossover-based entries.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-11',
        paramOverrides: { time: '3:00 PM', pct: 60 },
        rationale: 'The final hour accounts for 20\u201330% of the session\'s total volume. A 60% hurdle rate reduction at 3:00 PM creates the urgency needed to rotate out of flattened "morning winners" in favor of "afternoon squeezes."',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-15',
        paramOverrides: { intervals: 2 },
        rationale: 'If a stock stays below VWAP for 30 minutes (two eval intervals), the intraday thesis is broken. Institutional sentiment has shifted \u2014 cut fast, rotate to a stock where buyers are in control.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-10',
        paramOverrides: { start: '11:30 AM', end: '2:00 PM' },
        rationale: 'Between 11:30 AM and 2:00 PM, institutional traders step away and volume drops 40%+. Blocking swap evaluations during this window prevents the agent from churning on low-conviction signals.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-03',
        paramOverrides: { atr: 0.3, minutes: 60 },
        rationale: 'A stock that moves less than 30% of its daily ATR in a full hour is "dead money." The day trader\'s velocity requirement is more aggressive because day trading is fundamentally about capital efficiency.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -1.0 },
        rationale: 'The day trader uses a tighter stop (-1.0 ATR) than the swing trader (-1.5 ATR) because the intraday thesis should resolve quickly. Day traders entered on precision (0.2% from VWAP); if the entry doesn\'t work almost immediately, holding longer just compounds the loss.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-12',
        paramOverrides: { pct: 20, start: '1:00 PM' },
        rationale: 'Starting a 20% hourly hurdle rate decay at 1:00 PM creates accelerating urgency. By the final hour, the bar for swapping is dramatically lower, priming the portfolio for aggressive Power Hour rotations.',
        priority: 1,
        priorityLabel: 'Core Strategy',
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
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tech-macd-bullish',
        paramOverrides: { macdDirection: 'histogram expanding', rsiFloor: 55 },
        rationale: 'An expanding MACD histogram means short-term momentum is pulling away from the longer-term trend at an increasing rate \u2014 the "momentum of momentum." The RSI floor of 55 confirms the stock is firmly in the bullish regime.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 't-11',
        paramOverrides: { score: 18, floor: 12 },
        rationale: 'The momentum rider demands top-decile institutional leadership. A Relative Strength score of 18 out of 22 targets the top ~18% of equities experiencing price-agnostic institutional demand.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 't-12',
        paramOverrides: { pct: 10 },
        rationale: 'The 10th percentile squeeze identifies the most extreme compression \u2014 tighter than 90% of history. These rare setups have the highest expectancy for multi-ATR explosive moves.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-08',
        paramOverrides: { threshold: 'Double Bagger (+1.5x)' },
        rationale: 'This is the defining parameter of the momentum rider. One Double Bagger at Star tier (+60 points) fully funds three Busts. A stock that has already reached +1.0 ATR has demonstrated genuine momentum \u2014 the conditional probability of extending to +1.5 ATR is significantly higher.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-11',
        paramOverrides: { time: '3:00 PM', pct: 50 },
        rationale: 'A 50% hurdle reduction at 3:00 PM makes the agent hyper-sensitive to late-day volume spikes. This is less aggressive than the day trader\'s 60% because the momentum rider\'s edge is holding winners, not rotating.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'th-04',
        paramOverrides: { threshold: 'BaggerBomb', atr: 0.75 },
        rationale: 'After BaggerBomb, the momentum rider widens the trailing stop by 0.75 ATR \u2014 the exact opposite of the defensive player. This "house money" logic treats secured points as a cushion to pursue Double Bagger.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'ts-04',
        paramOverrides: { interval: 30, cycles: 2 },
        rationale: 'The momentum rider promotes aggressively but not recklessly. A 30-minute review window with 0.4 ATR threshold confirms genuine "escape velocity" before committing the Star tier\'s 2x multiplier.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-04',
        paramOverrides: { atr: 0.4 },
        rationale: 'The swap hurdle rate of 0.4 ATR ensures bench-to-portfolio rotations are genuine upgrades, not lateral moves between stocks in the same noise regime.',
        priority: 1,
        priorityLabel: 'Core Strategy',
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
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -0.7 },
        rationale: 'Setting the stop at -0.7 ATR \u2014 well before the -1.0 ATR Bust penalty threshold \u2014 ensures the agent exits while the loss is still a standard P&L fluctuation, not a scoring catastrophe. Taking a guaranteed -0.7 ATR P&L loss with zero penalty points is exponentially better than risking -1.0 ATR plus a -10 point penalty.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-07',
        paramOverrides: { swaps: 2, window: 60, freeze: 45 },
        rationale: 'If the agent executes two swaps within 60 minutes, the predictive models are out of sync with the current market regime. The 45-minute freeze prevents "behavioral cascading" \u2014 the algorithmic equivalent of tilt.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'th-05',
        paramOverrides: { tier: 'Star', atr: 0.3 },
        rationale: 'When a Star-tier stock hits a positive threshold, the defensive player immediately tightens the trailing stop to 0.3 ATR. This guarantees the threshold bonus is locked in, willingly sacrificing the improbable Double Bagger to eliminate reversion risk.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'th-07',
        paramOverrides: { mult: 2.0 },
        rationale: 'Grounded in Kahneman and Tversky\'s Prospect Theory, where the loss aversion coefficient \u03bb is ~2.0\u20132.25. This forces the agent to perceive negative thresholds as twice as close, triggering maximum swap urgency.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'ts-07',
        paramOverrides: { atr: 0.5, recovery: 0.8 },
        rationale: 'When a Star-tier stock degrades to -0.5 ATR from entry, it\'s demoted to Support. A high recovery distance (0.8 ATR) prevents "dead cat bounce" re-promotions \u2014 a stock that dropped this far has demonstrated structural weakness.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'risk-sector-diversification',
        paramOverrides: { n: 4 },
        rationale: 'With a 5\u20138 stock portfolio, requiring 4 distinct sectors caps any single sector at ~40% exposure. If one sector collapses, the other stocks provide a "fortress" of stability.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'a-09',
        paramOverrides: { complement: 3, high_upside: 1 },
        rationale: 'Three bench stocks from different sectors ensures immediate rotation options if the market regime shifts. Exactly 1 high-ATR "lottery ticket" provides controlled, fractional-Kelly exposure to asymmetric upside.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'ts-09',
        paramOverrides: { minutes: 45, tier: 'Core' },
        rationale: 'The first 45 minutes are the highest-risk period for false signals. Restricting maximum tier to Core means even a Meltdown in the opening chaos costs -52.5 points instead of -70 points.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  // ══════════════════════════════════════
  // TRADINGVIEW STYLE COLLECTIONS
  // ══════════════════════════════════════

  {
    id: 'trend-surfer',
    title: 'Trend Surfer',
    subtitle: 'Ride confirmed trends using moving average alignment and momentum pullbacks',
    icon: 'Waves',
    accentColor: '#5EEAD4',
    difficulty: 'intermediate',
    tags: ['trend', 'moving-average', 'pullback', 'golden-cross', 'tradingview'],
    isStyleCollection: true,

    philosophy: 'The most popular strategies on TradingView share one core belief: the trend is your friend. This collection implements the Golden Cross, EMA Ribbon, and Pullback-to-MA strategies \u2014 all adapted for BaggerBomb. Instead of generating buy/sell signals on a single chart, your agent uses trend confirmation across daily structure and intraday momentum to select and tier 7 stocks. Trending stocks that pull back to support get patience. Stocks that break their trend get swapped.',

    conflicts: ['oversold-sniper'],

    progressionHints: {
      rookie: { activeCount: 5, injectedCount: 3, message: '3 core rules powering your agent. Play 3 more games to unlock Edge rules.' },
      starter: { activeCount: 7, injectedCount: 6, message: '7 rules active. Reach Partner level to unlock the full strategy.' },
      partner: { activeCount: 9, injectedCount: 9, message: 'Full strategy unlocked. All 9 rules active.' },
    },

    rules: [
      {
        ruleId: 'tech-moving-average-trend',
        paramOverrides: { period: '50', requireAlignment: true },
        rationale: 'The Golden Cross / EMA Ribbon core signal. Requires full bullish SMA alignment (20 > 50 > 200) to confirm the trend is intact across all timeframes.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-01',
        paramOverrides: { low: 50, high: 70, weak: 40, stretched: 75 },
        rationale: 'RSI as momentum confirmation, not mean reversion. The 50-70 zone identifies stocks with rising momentum that haven\'t overheated.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -1.0 },
        rationale: 'Even trend surfers need a hard stop. -1.0 ATR prevents a single position from reaching Crash or Meltdown territory.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 't-11',
        paramOverrides: { score: 15, floor: 8 },
        rationale: 'Relative Strength vs SPY ensures we\'re riding leaders, not laggards.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'tech-macd-bullish',
        paramOverrides: {},
        rationale: 'Entry timing inside an already-confirmed trend: act when momentum turns back up, not when price merely drifts. Distinct from the zero-line patience rule below — that one governs how long to HOLD through a pause, this one governs WHEN to enter. Different phases of the same trade.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'ts-02',
        paramOverrides: { score: 60, tier: 'Support' },
        rationale: 'Multi-Timeframe Trend Alignment: Star tier requires BOTH daily trend health AND intraday VWAP confirmation.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'tv-03',
        paramOverrides: { score: 55, minutes: 120 },
        rationale: 'The MACD Zero-Line Bounce \u2014 momentum pullbacks in a trend are buying opportunities, not exit signals.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'mb-01',
        paramOverrides: { minutes: 90 },
        rationale: 'Trend surfers are patient. A 90-minute hold prevents reacting to intraday noise.',
        priority: 4,
        priorityLabel: 'Mastery',
      },
      {
        ruleId: 'mb-08',
        paramOverrides: { threshold: 'BaggerBomb (+1.0x)' },
        rationale: 'Don\'t sell winners until they hit a scoring threshold. Selling a rising stock before BaggerBomb is the #1 mistake in trend following.',
        priority: 4,
        priorityLabel: 'Mastery',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'vwap-warrior',
    title: 'VWAP Warrior',
    subtitle: 'Follow institutional money using VWAP as the single source of truth',
    icon: 'Target',
    accentColor: '#6366F1',
    difficulty: 'intermediate',
    tags: ['VWAP', 'institutional', 'smart-money', 'ICT', 'tradingview'],
    isStyleCollection: true,

    // ── RETIRED (C-20, Jul 25 2026) ──────────────────────────────────────────
    retired: true,
    retiredReason:
      '5 of its 7 rules (tv-04 reclaim, mb-05 VWAP+MACD gate, t-09 pullback, '
      + 't-10 sigma fade, tv-09 sweep-with-VWAP-recovery) rest on VWAP as a '
      + 'SELECTION signal, which does not exist: buildMomentumSnapshot iterates held '
      + 'positions only and the bench block renders no VWAP line. The collection is '
      + 'its thesis, so there is nothing to substitute toward.',
    returnsWith:
      'The intraday/VWAP build — the same arc that returns day-trader.',

    philosophy: 'VWAP (Volume-Weighted Average Price) is how institutions measure execution quality. If a stock is above VWAP, buyers are winning. Below VWAP, sellers dominate. This collection treats VWAP as the only indicator that matters, incorporating VWAP Trend Following, VWAP Mean Reversion, and Smart Money Concepts from TradingView.',

    conflicts: [],

    progressionHints: {
      rookie: { activeCount: 5, injectedCount: 3, message: '3 VWAP rules active. Play 3 more games to unlock advanced patterns.' },
      starter: { activeCount: 7, injectedCount: 6, message: 'Full VWAP strategy active.' },
      partner: { activeCount: 7, injectedCount: 7, message: 'Full strategy unlocked.' },
    },

    rules: [
      {
        ruleId: 'tv-04',
        paramOverrides: { dev: 0.3 },
        rationale: 'The VWAP Reclaim is the signature entry. A stock that dips below VWAP and fights back above it proved the buyers are stronger.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-05',
        paramOverrides: { signal: 'any bullish' },
        rationale: 'Only swap INTO stocks trading above VWAP. The VWAP Warrior never enters below VWAP.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-15',
        paramOverrides: {},
        rationale: 'VWAP Invalidation is the hard exit. When price fails VWAP for consecutive ticks, the institutional support is gone.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 't-09',
        paramOverrides: { pct: 0.2 },
        rationale: 'Tighter than the Trend Surfer\'s 0.4% because VWAP Warriors demand precision at the institutional decision point.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 't-14',
        paramOverrides: { mult: 1.5 },
        rationale: 'Volume validates everything. A breakout above VWAP on high volume is confirmed.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 't-10',
        paramOverrides: { dev: 1.5 },
        rationale: 'Avoid overextended stocks. When price is 1.5+ standard deviations above VWAP, even institutional buying can\'t sustain it.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'tv-09',
        paramOverrides: { atr: 0.5, vol: 1.5, minutes: 60 },
        rationale: 'The Smart Money / ICT pattern: a sharp drop on volume followed by VWAP recovery is a liquidity sweep. Hold through it.',
        priority: 3,
        priorityLabel: 'Edge',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'squeeze-hunter',
    title: 'Squeeze Hunter',
    subtitle: 'Find compressed volatility and ride the explosive breakout',
    icon: 'Zap',
    accentColor: '#F472B6',
    difficulty: 'intermediate',
    tags: ['squeeze', 'bollinger', 'NR7', 'volatility', 'breakout', 'tradingview'],
    isStyleCollection: true,

    philosophy: 'The Squeeze Momentum Indicator by LazyBear is the most popular community script on TradingView. When Bollinger Bands contract, volatility is compressed like a coiled spring. This collection combines squeeze detection, NR7 compression, and MACD direction filtering. For BaggerBomb, this is the highest-probability path to threshold hits: compressed ATR \u2192 squeeze break \u2192 rapid expansion \u2192 BaggerBomb in one move.',

    conflicts: ['defensive-fortress'],

    progressionHints: {
      rookie: { activeCount: 5, injectedCount: 3, message: '3 squeeze detection rules active. Play 3 more games to unlock portfolio tuning.' },
      starter: { activeCount: 7, injectedCount: 6, message: 'Full squeeze strategy active.' },
      partner: { activeCount: 7, injectedCount: 7, message: 'Full strategy unlocked.' },
    },

    rules: [
      {
        ruleId: 't-12',
        paramOverrides: { pct: 8, vol: 1.3 },
        rationale: 'The core signal. Bandwidth below 8th percentile indicates extreme compression. Volume confirms institutional positioning.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-05',
        paramOverrides: { bw: 5, direction: 'positive and growing' },
        rationale: 'The LazyBear filter: MACD histogram direction predicts whether the squeeze breaks UP or DOWN.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -0.75 },
        rationale: 'Tighter stop than trend collections. If a squeeze breaks the wrong way, get out fast.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 't-15',
        paramOverrides: {},
        rationale: 'NR7 + Bollinger squeeze = double compression. The most violent breakouts come from multi-dimensional compression.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'a-05',
        paramOverrides: { anchors: 2, rockets: 3, low_pct: 1.5, high_pct: 3.0 },
        rationale: '3 high-ATR squeeze candidates balanced by 2 low-ATR anchors.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'ts-02',
        paramOverrides: { score: 55, tier: 'Core' },
        rationale: 'Lower conviction bar than trend collections. Squeeze hunters care more about compression than daily trend.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'th-01',
        paramOverrides: {},
        rationale: 'When a squeeze breaks toward a scoring threshold, hold with maximum patience.',
        priority: 3,
        priorityLabel: 'Edge',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'oversold-sniper',
    title: 'Oversold Sniper',
    subtitle: 'Buy extreme fear and sell the recovery with surgical timing',
    icon: 'Crosshair',
    accentColor: '#EF4444',
    difficulty: 'intermediate',
    tags: ['oversold', 'mean-reversion', 'RSI', 'bollinger', 'bounce', 'tradingview'],
    isStyleCollection: true,

    philosophy: 'RSI Oversold, Bollinger Band Mean Reversion, and RSI Divergence are among the most searched TradingView strategies. They share a belief: when a stock has been beaten down too far too fast, the snap-back is inevitable. In BaggerBomb, a violent recovery from oversold can hit scoring thresholds in a single session.',

    conflicts: ['trend-surfer', 'momentum-rider'],

    progressionHints: {
      rookie: { activeCount: 5, injectedCount: 3, message: '3 mean-reversion rules active. Play 3 more games to unlock pattern recognition.' },
      starter: { activeCount: 7, injectedCount: 6, message: 'Full oversold strategy active.' },
      partner: { activeCount: 7, injectedCount: 7, message: 'Full strategy unlocked.' },
    },

    rules: [
      {
        ruleId: 'tech-rsi-oversold',
        paramOverrides: { threshold: 30, volumeConfirm: true },
        rationale: 'Classic RSI Oversold with volume confirmation. Volume shows someone is starting to buy the dip.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-06',
        paramOverrides: { percentB: 0.1, tierRule: 'Support or Core only' },
        rationale: 'Bollinger Lower Band Entry \u2014 statistically reverts to the mean. Tier capped because upside is defined.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -0.85 },
        rationale: 'Moderate stop. Tighter than trend-following because oversold stocks can keep falling.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 't-13',
        paramOverrides: {},
        rationale: 'When price makes a new low but RSI makes a higher low, selling momentum is fading.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 't-12',
        paramOverrides: {},
        rationale: 'Spring-loaded, measured by volatility compression rather than where the bar closed. Bollinger Band Width in the lowest percentile means the range has coiled and an expansion is overdue \u2014 the same "about to snap back" thesis, sourced from a signal the agent can actually see.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'tv-08',
        paramOverrides: { score: 50, vol: 0.8, minutes: 120 },
        rationale: 'Low volume pullback hold \u2014 if the selling is on thin volume, the dip isn\'t real.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'ts-07',
        paramOverrides: {},
        rationale: 'Safety net. If an oversold pick keeps falling toward penalty threshold, demote tier to minimize damage.',
        priority: 3,
        priorityLabel: 'Edge',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'volume-detective',
    title: 'Volume Detective',
    subtitle: 'Let volume tell the truth \u2014 high volume is conviction, low volume is deception',
    icon: 'BarChart3',
    accentColor: '#F59E0B',
    difficulty: 'beginner',
    tags: ['volume', 'spike', 'institutional', 'confirmation', 'tradingview'],
    isStyleCollection: true,

    philosophy: 'Every experienced TradingView trader will tell you: volume is the one indicator that doesn\'t lie. A price move without volume is a rumor. A price move WITH volume is a fact. This collection makes volume the primary lens for every decision.',

    conflicts: [],

    progressionHints: {
      rookie: { activeCount: 5, injectedCount: 3, message: '3 volume rules active. Play 3 more games to unlock momentum integration.' },
      starter: { activeCount: 7, injectedCount: 6, message: 'Full volume strategy active.' },
      partner: { activeCount: 7, injectedCount: 7, message: 'Full strategy unlocked.' },
    },

    rules: [
      {
        ruleId: 't-14',
        paramOverrides: { mult: 1.5 },
        rationale: 'No breakout is trusted without 1.5x average volume. Filters out false breakouts.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-13',
        paramOverrides: { mult: 2.0, tier: 'Core' },
        rationale: 'Volume spike at 2x = institutional buying. Automatic Core tier floor.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -1.0 },
        rationale: 'Standard protective stop. Volume analysis doesn\'t change where the emergency exit is.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-08',
        paramOverrides: { score: 50, vol: 0.7, minutes: 120 },
        rationale: 'Low volume during a dip = nobody is selling. Hold with 120-minute patience.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'tv-02',
        paramOverrides: { action: 'hold but monitor' },
        rationale: 'MACD histogram as secondary momentum context for volume signals.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'a-06',
        paramOverrides: { rs_min: 13, pct: 35 },
        rationale: 'Lean toward RS leaders (top 35%) with volume confirmation layered on top.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'mb-04',
        paramOverrides: { atr: 0.5 },
        rationale: 'Replacement stock must beat active by 0.5 ATR AND have volume confirmation.',
        priority: 3,
        priorityLabel: 'Edge',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'rs-leader',
    title: 'RS Leader',
    subtitle: 'Only own the strongest stocks in the strongest sectors \u2014 cut everything else',
    icon: 'Trophy',
    accentColor: '#34D399',
    difficulty: 'beginner',
    tags: ['relative-strength', 'leader', 'sector', 'breakout', 'tradingview'],
    isStyleCollection: true,

    philosophy: 'Relative Strength analysis is the foundation of CANSLIM, Minervini\'s trend templates, and countless TradingView screening strategies. Stocks outperforming the market tend to keep outperforming. This collection combines RS ranking with sector rotation, 52-week high breakouts, and earnings quality.',

    conflicts: ['oversold-sniper'],

    progressionHints: {
      rookie: { activeCount: 5, injectedCount: 3, message: '3 RS leadership rules active. Play 3 more games to unlock sector rotation.' },
      starter: { activeCount: 7, injectedCount: 6, message: '7 rules active. Reach Partner for score-aware adaptation.' },
      partner: { activeCount: 8, injectedCount: 8, message: 'Full strategy unlocked.' },
    },

    rules: [
      {
        ruleId: 't-11',
        paramOverrides: { score: 18, floor: 12 },
        rationale: 'Aggressive RS filtering. Top ~15% only. Tighter than any other collection.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-11',
        paramOverrides: { score: 9, pct: 5 },
        rationale: '52-Week High Breakout. New highs attract institutional momentum capital.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -0.85 },
        rationale: 'Moderate stop. RS Leaders expect performance, so -0.85 ATR is a serious failure signal.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-14',
        paramOverrides: { max_pct: 40, evals: 2 },
        rationale: 'Sector Leader Selection. Strong stocks in strong sectors. 40% sector cap.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'tv-10',
        paramOverrides: { fund_score: 60, tech_score: 65, tier: 'Star' },
        rationale: 'Dual confirmation. Both fundamentals and technicals must agree for Star tier.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'a-08',
        paramOverrides: { sentiment: 'bullish' },
        rationale: 'FantasyTimes narrative confirmation layered on RS data.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'ts-04',
        paramOverrides: {},
        rationale: 'Promote winners, demote losers. No loyalty to underperformers.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      // C-20 (Jul 25 2026): the gs-06 "press when trailing par" slot was dropped
      // rather than substituted. Score-vs-par does not exist on any running
      // path, and no supported rule expresses aggression triggered by standing.
      // This is a selection collection — its thesis lives in the RS and sector
      // rules above; the game-state leg was always its weakest.
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'triple-threat',
    title: 'Triple Threat',
    subtitle: 'Three independent confirmations required for every decision',
    icon: 'Shield',
    accentColor: '#8B5CF6',
    difficulty: 'advanced',
    tags: ['multi-factor', 'confluence', 'triple-screen', 'Elder', 'tradingview'],
    isStyleCollection: true,

    philosophy: 'Alexander Elder\'s Triple Screen and the MACD+RSI+Volume Trinity are the most recommended indicator combinations on TradingView. When three independent signals agree, the probability increases dramatically. This collection requires triple confirmation for tier assignment and demands volume validation for every action.',

    conflicts: [],

    progressionHints: {
      rookie: { activeCount: 5, injectedCount: 3, message: '3 screening rules active. Play 3 more games to unlock precision entry tools.' },
      starter: { activeCount: 7, injectedCount: 6, message: '7 rules active. Reach Partner for maximum conviction holds.' },
      partner: { activeCount: 8, injectedCount: 8, message: 'Full strategy unlocked.' },
    },

    rules: [
      {
        ruleId: 'tv-12',
        paramOverrides: { tech: 60, rsi_low: 45, rsi_high: 70, vol: 1.3 },
        rationale: 'The Multi-Factor Tier Assignment IS the Triple Threat. 3/3 = Star, 2/3 = Core, 1/0 = Support.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tech-moving-average-trend',
        paramOverrides: { period: '50', requireAlignment: true },
        rationale: 'Elder Screen 1: the long-term trend confirmation via SMA alignment.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 't-14',
        paramOverrides: { mult: 1.3 },
        rationale: 'Elder Screen 3: volume above 1.3x confirms genuine participation.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-01',
        paramOverrides: { low: 45, high: 70, weak: 35, stretched: 80 },
        rationale: 'Elder Screen 2: RSI momentum zone. Wider than Trend Surfer because other layers confirm.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'tv-02',
        paramOverrides: {},
        rationale: 'The third independent confirmation. Trend alignment and the volume gate cover structure and participation; a growing MACD histogram adds acceleration — a signal neither of the others can produce. Three genuinely separate reads, which is the whole point of this build.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'mb-04',
        paramOverrides: { atr: 0.7 },
        rationale: 'Highest hurdle in any collection. Triple-confirmed positions earned their place.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'mb-01',
        paramOverrides: { minutes: 120 },
        rationale: 'Maximum patience. Triple-confirmed positions get 120 minutes to prove the thesis.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -0.85 },
        rationale: 'Even the Triple Threat can be wrong. -0.85 ATR balances conviction with capital preservation.',
        priority: 4,
        priorityLabel: 'Mastery',
      },
    ],

    get ruleIds() { return this.rules.map(r => r.ruleId); },
  },

  {
    id: 'baggerbomb-native',
    title: 'BaggerBomb Native',
    subtitle: 'Built for BaggerBomb scoring mechanics \u2014 no TradingView equivalent exists',
    icon: 'Flame',
    accentColor: '#FB923C',
    difficulty: 'advanced',
    tags: ['BaggerBomb', 'threshold', 'scoring', 'native', 'game-theory'],
    isStyleCollection: true,

    philosophy: 'Every other collection translates a TradingView strategy into our system. This one can\'t be translated back \u2014 it\'s built from the ground up for BaggerBomb\'s unique scoring mechanics. ATR-based thresholds, tier multipliers, score-differential adaptation, and harvest-mode swaps are concepts that don\'t exist in traditional technical analysis. This is the graduation collection: you came to FantasyTrades because of TradingView. You stay because of THIS.',

    conflicts: [],

    progressionHints: {
      rookie: { activeCount: 5, injectedCount: 3, message: '3 scoring rules active. Play 3 more games to unlock harvest mode.' },
      starter: { activeCount: 7, injectedCount: 6, message: '7 rules active. Reach Partner to unlock score-aware adaptation.' },
      partner: { activeCount: 9, injectedCount: 9, message: 'Full strategy unlocked.' },
    },

    rules: [
      {
        ruleId: 'th-01',
        paramOverrides: {},
        rationale: 'THE core BaggerBomb mechanic. When near a scoring threshold, hold with maximum patience. Worth +15/+30/+50 points.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'a-05',
        paramOverrides: { anchors: 2, rockets: 3, low_pct: 1.5, high_pct: 3.5 },
        rationale: '3 high-ATR threshold candidates + 2 low-ATR penalty shields.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'mb-09',
        paramOverrides: { atr: -0.85 },
        rationale: 'Exits BEFORE the Bust threshold (-1.0x ATR). Calibrated to a specific scoring rule.',
        priority: 1,
        priorityLabel: 'Core Strategy',
      },
      {
        ruleId: 'tv-15',
        paramOverrides: { threshold: 'BaggerBomb (+1.0x)', evals: 2, rsi: 50 },
        rationale: 'Threshold Harvest. After banking +15, swap for the next ATR rocket. Pure game theory.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'ts-01',
        paramOverrides: { pct: 200, tier: 'Support' },
        rationale: 'Prevent Star tier (2x multiplier) on erratically volatile stocks. 2x doubles losses too.',
        priority: 2,
        priorityLabel: 'Foundation',
      },
      {
        ruleId: 'th-10',
        paramOverrides: { posture: 'Harvest (many +15s)' },
        rationale: 'Harvest mode: 3 BaggerBombs (+45) beats 1 Triple Bagger (+50) in expected value.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'ts-07',
        paramOverrides: {},
        rationale: 'Near penalty threshold, demote to Support (1x). -15 at 1x = -15. -15 at 2x = -30.',
        priority: 3,
        priorityLabel: 'Edge',
      },
      {
        ruleId: 'gs-08',
        paramOverrides: {},
        rationale: 'When the scoring system says it is working, stop touching it. After a run of positive thresholds the swap hurdle rises, so a hot book is not over-managed into mediocrity. Keyed on the threshold events this game mode is built around.',
        priority: 4,
        priorityLabel: 'Mastery',
      },
      {
        ruleId: 'gs-03',
        paramOverrides: {},
        rationale: 'Hurdles fall with each phase transition, so late in the battle a marginal upgrade becomes worth taking. Reaching one more threshold before the close is worth more than protecting a hurdle that no longer has time to pay off — this is clock-aware scoring, triggered by the phase, not by standing.',
        priority: 4,
        priorityLabel: 'Mastery',
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
    // C-20 (Jul 25 2026): risk-single-stock-limit → r-06 (the game has no
    // position sizing, so a per-stock cap was structurally vacuous; r-06 caps
    // per-sector holdings, a ceiling complementing the diversification floor
    // above). risk-volatility-avoidance → r-09. NOTE the honest shift: the old
    // rule was an always-on per-stock screen against sector-average volatility;
    // r-09 is REACTIVE, engaging low-ATR-only after a drawdown threshold. A
    // preventive per-stock volatility screen returns only if that substrate is
    // built — sector-average volatility exists nowhere at HEAD.
    ruleIds: [
      'risk-sector-diversification',
      'r-06',
      'r-09',
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

    // ── RETIRED (C-20, Jul 25 2026) ──────────────────────────────────────────
    retired: true,
    retiredReason:
      'All 4 rules are hidden_unwired, and only ONE supported fundamental rule '
      + 'exists corpus-wide (tv-10) — a four-rule value preset cannot be rebuilt '
      + 'from it. The metrics are real and persisted; they simply reach no agent.',
    returnsWith:
      'THE FUNDAMENTAL MIRROR WIRE — the #1 follow-on arc. Every metric already '
      + 'exists on peerRankings/{ticker} (P/E compute-rankings.js:1352, P/B :1354, '
      + 'D/E :1363, FCF-yield :1355, revisions :1372) but no agent path reads that '
      + 'collection. One mirror into the doc agents already load un-hides 12 rules, '
      + 'restores this collection intact, and repairs the StarterKit value path.',
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
    // C-20 (Jul 25 2026): gs-04/05/06 were par-predicated — they triggered on
    // STANDING, not phase, so they were always off this collection's stated
    // thesis, and score-vs-par exists on no running path. Replaced with two
    // genuinely phase-gated rules (gs-03 per-transition hurdle decay, gs-10
    // FINAL_HOUR no-chase); the gs-06 "press when trailing" slot was dropped
    // rather than filled, since nothing supported expresses it. Four rules, all
    // actually phase-aware — a closer match to the subtitle than before.
    ruleIds: [
      'gs-01',
      'gs-02',
      'gs-03',
      'gs-10',
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

// ══════════════════════════════════════
// C-20 HONESTY GATE — offered vs. retired
// ══════════════════════════════════════
// A collection whose THESIS is dark is not sold, even if some of its rules
// still resolve (founder ruling, Jul 25 2026). Retired collections keep their
// full definition above so existing equips resolve normally and the retirement
// record travels with the data — they are simply not OFFERED.
//
// Display surfaces must read OFFERED_COLLECTIONS. Lookup-by-id and
// relationship-graph consumers keep reading FORGE_COLLECTIONS.

/** Collections currently offered to users. */
export const OFFERED_COLLECTIONS = FORGE_COLLECTIONS.filter((c) => !c.retired);

/** Retired collections, retained for the record and for legacy resolution. */
export const RETIRED_COLLECTIONS = FORGE_COLLECTIONS.filter((c) => c.retired);
