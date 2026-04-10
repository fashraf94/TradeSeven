// src/data/forgeKnowledgeBase.js
// Static rule template library for The Forge Discover feed
// Zero Firestore reads — bundled with Vite at build time

export const FORGE_CATEGORIES = [
  { id: 'technical', label: 'Technical', color: '#5eead4', description: 'Price action, indicators, and chart patterns', mode: 'both' },
  { id: 'fundamental', label: 'Fundamental', color: '#a78bfa', description: 'Financial metrics and company valuation', mode: 'both' },
  { id: 'risk', label: 'Risk', color: '#f97066', description: 'Protective constraints and risk management', mode: 'both' },
  { id: 'allocation', label: 'Allocation', color: '#f59e0b', description: 'Portfolio construction and position sizing', mode: 'both' },
  { id: 'mid_battle', label: 'Mid-Battle Trading', color: '#6366F1', description: 'Swap timing, hurdle rates, and mid-game trade management', mode: 'clash' },
  { id: 'game_state', label: 'Game State', color: '#94A3B8', description: 'Phase-aware strategy shifts and score-based decisions', mode: 'clash' },
  { id: 'threshold', label: 'Threshold Strategy', color: '#f472b6', description: 'Scoring threshold proximity and bonus optimization', mode: 'clash' },
  { id: 'tier_strategy', label: 'Tier Strategy', color: '#34d399', description: 'Dynamic tier allocation and multiplier management', mode: 'clash' },
  { id: 'institutional', label: 'Institutional', color: '#06b6d4', description: 'Institutional ownership signals, conviction scoring, and smart-money flow analysis', mode: 'both' },
  { id: 'entry_criteria', label: 'Entry Criteria', color: '#F0C75E', description: 'Filter chain rules that determine when to buy stocks in Season mode', mode: 'season', icon: 'DoorOpen' },
  { id: 'exit_stops', label: 'Exit & Stops', color: '#E8927C', description: 'Rules that determine when to sell positions and protect capital', mode: 'season', icon: 'ShieldOff' },
  { id: 'rebalancing', label: 'Rebalancing', color: '#E8927C', description: 'Portfolio shape management — position sizing, drift correction, cash deployment', mode: 'season', icon: 'Scale' },
  { id: 'season_state', label: 'Season State', color: '#F0C75E', description: 'Adaptive strategy rules based on season position and upcoming events', mode: 'season', icon: 'Brain' },
];

export const SEASON_CONFLICT_PAIRS = [
  { ruleA: 'sx-01', ruleB: 'sx-02', warning: 'Fixed Stop-Loss and Trailing Stop can both trigger sells. The tighter one fires first.' },
  { ruleA: 'sx-04', ruleB: 'sx-02', warning: 'Profit Target sells at a fixed gain. Trailing Stop would let it run further. Opposite philosophies.' },
  { ruleA: 'sr-01', ruleB: 'sr-04', warning: 'Position Size Cap trims winners. Add to Winners adds to them. Check thresholds don\'t fight.' },
  { ruleA: 'ss-01', ruleB: 'ss-03', warning: 'Benchmark Gap Aggression wants new entries. Final Week Lockdown blocks them. Lockdown wins in Week 4.' },
  { ruleA: 'ss-02', ruleB: 'ss-01', warning: 'Lead Protection and Gap Aggression are opposite postures. Verify thresholds don\'t overlap.' },
  { ruleA: 'se-06', ruleB: 'se-01', warning: 'Momentum Entry requires stocks moving up. RSI Gate may reject overbought. Ensure thresholds allow a sweet spot.' },
];

export const FORGE_RULE_TEMPLATES = [
  // ══════════════════════════════════════
  // TECHNICAL CATEGORY
  // ══════════════════════════════════════
  {
    id: 'tech-rsi-oversold',
    category: 'technical',
    modes: 'both',
    headline: 'Buy oversold stocks',
    description: 'Add stocks that have dropped hard and show signs of bouncing back.',
    learnMore: 'RSI (Relative Strength Index) measures momentum on a 0-100 scale. Below 30 means the stock is oversold — it may have fallen too far, too fast. Historically, oversold stocks tend to bounce. This rule tells your agent to look for these opportunities.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks with RSI below {threshold}',
        params: {
          threshold: { type: 'number', default: 30, min: 15, max: 45, step: 5, unit: 'RSI', label: 'Oversold threshold', hint: 'RSI level below which a stock is considered oversold. Swing traders use 35, day traders prefer 20-25.' },
          volumeConfirm: { type: 'toggle', default: false, label: 'Require volume confirmation', hint: 'When on, only triggers when volume exceeds the 20-day average — confirms institutional participation.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'RSI (14-period)',
    kbEntryId: null,
    tags: ['momentum', 'RSI', 'oversold', 'mean-reversion'],
    agentUseDescription: 'Your agent will check RSI levels before buying and prioritize stocks with RSI below 30 that show reversal signals.',
  },
  {
    id: 'tech-rsi-overbought',
    category: 'technical',
    modes: 'both',
    headline: 'Avoid overbought stocks',
    description: 'Skip stocks that have run up too fast and may be due for a pullback.',
    learnMore: 'When RSI goes above 70, a stock is considered overbought — it has risen quickly and may pull back. This rule makes your agent cautious about chasing rallies.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Avoid stocks with RSI above {threshold}',
        params: {
          threshold: { type: 'number', default: 70, min: 60, max: 85, step: 5, unit: 'RSI', label: 'Overbought ceiling', hint: 'RSI level above which a stock is considered overbought. Defensive players use 65 to exit before reversals.' },
          strictMode: { type: 'toggle', default: false, label: 'Hard exclusion mode', hint: 'When on, completely excludes overbought stocks instead of just deprioritizing them.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'RSI (14-period)',
    kbEntryId: null,
    tags: ['momentum', 'RSI', 'overbought'],
    agentUseDescription: 'Your agent will skip stocks with RSI above 70, avoiding positions that have rallied too fast and may pull back.',
  },
  {
    id: 'tech-bollinger-squeeze',
    category: 'technical',
    modes: 'both',
    headline: 'Look for volatility breakouts',
    description: 'Target stocks where price is compressed tight — a big move may be coming.',
    learnMore: 'Bollinger Bands show a stock\'s normal price range. When the bands squeeze tight, the stock is coiled — a breakout (up or down) often follows. Combined with volume confirmation, this can signal the start of a strong move.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Prefer stocks showing Bollinger Band squeeze below {bandwidthThreshold}th percentile with volume confirmation',
        params: {
          bandwidthThreshold: { type: 'number', default: 20, min: 5, max: 40, step: 5, unit: '%ile', label: 'Compression percentile', hint: 'How narrow the Bollinger Bands must be. Lower = tighter squeeze = more explosive breakout potential.' },
          volumeConfirm: { type: 'toggle', default: false, label: 'Require breakout volume', hint: 'When on, only triggers on above-average volume — filters out false breakouts.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'Bollinger Band position',
    kbEntryId: null,
    tags: ['volatility', 'Bollinger', 'breakout', 'volume'],
    agentUseDescription: 'Your agent will scan for Bollinger Band squeezes and flag stocks where a breakout is likely, confirming with volume before acting.',
  },
  {
    id: 'tech-moving-average-trend',
    category: 'technical',
    modes: 'both',
    headline: 'Follow the trend',
    description: 'Prefer stocks trading above their moving average — the trend is your friend.',
    learnMore: 'A stock above its 50-day moving average is in an uptrend. A stock below it is in a downtrend. This simple filter keeps your agent on the right side of momentum.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks trading above their {period}-day moving average',
        params: {
          period: { type: 'select', default: '50', options: [{ value: '20', label: 'SMA 20 (aggressive)' }, { value: '50', label: 'SMA 50 (institutional)' }, { value: '200', label: 'SMA 200 (macro)' }], label: 'Trend moving average', hint: 'Which moving average defines the trend. SMA 50 is the institutional standard.' },
          requireAlignment: { type: 'toggle', default: false, label: 'Require full bullish alignment', hint: 'When on, requires SMA 20 > SMA 50 > SMA 200 — the strongest trend confirmation.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: '50-day Moving Average',
    kbEntryId: 'moving-averages',
    tags: ['trend', 'moving-average', 'momentum'],
    agentUseDescription: 'Your agent will filter out stocks trading below their moving average, keeping only those with confirmed uptrend momentum.',
  },
  {
    id: 'tech-macd-bullish',
    category: 'technical',
    modes: 'both',
    headline: 'Ride momentum shifts',
    description: 'Look for stocks where trend momentum is turning positive.',
    learnMore: 'MACD tracks the relationship between two moving averages. When the MACD line crosses above the signal line, momentum is shifting bullish. This rule helps your agent catch trend reversals early.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Prefer stocks with {macdDirection} MACD signal and RSI above {rsiFloor}',
        params: {
          macdDirection: { type: 'select', default: 'histogram expanding', options: [{ value: 'histogram expanding', label: 'Histogram expanding' }, { value: 'bullish crossover', label: 'Bullish crossover' }, { value: 'above zero line', label: 'Above zero line' }], label: 'MACD momentum signal', hint: 'What defines accelerating momentum. Histogram expanding detects acceleration earliest.' },
          rsiFloor: { type: 'number', default: 50, min: 40, max: 65, step: 5, unit: 'RSI', label: 'Minimum RSI for momentum', hint: 'Ensures momentum is occurring in a bullish regime. 55+ filters out weak bounces.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'MACD Signal',
    kbEntryId: null,
    tags: ['momentum', 'MACD', 'crossover', 'trend-reversal'],
    agentUseDescription: 'Your agent will watch for MACD bullish crossovers and boost conviction on stocks where momentum is shifting from bearish to bullish.',
  },
  {
    id: 'tech-volume-surge',
    category: 'technical',
    modes: 'both',
    headline: 'Follow the smart money',
    description: 'Pay attention when trading volume spikes — big players may be moving.',
    learnMore: 'A surge in volume (2x or more above average) often signals institutional interest. Price moves on high volume are more meaningful than moves on low volume. This rule tells your agent to weight volume-confirmed moves more heavily.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks showing volume above {multiplier}x their average',
        params: {
          multiplier: { type: 'select', default: '2', options: [{ value: '1.5', label: '1.5x (sensitive)' }, { value: '2', label: '2x (standard)' }, { value: '3', label: '3x (strong conviction)' }], label: 'Volume surge multiplier', hint: 'How much above average volume must be. Higher = fewer but stronger signals.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'Volume',
    kbEntryId: 'volume-liquidity',
    tags: ['volume', 'institutional', 'confirmation'],
    agentUseDescription: 'Your agent will weight volume-confirmed price moves more heavily, treating unusual volume spikes as signals of institutional interest.',
  },
  {
    id: 'tech-relative-strength',
    category: 'technical',
    modes: 'both',
    headline: 'Pick sector leaders',
    description: 'Choose stocks that are outperforming their sector peers.',
    learnMore: 'Relative strength compares a stock to its sector. A stock in the top quartile is leading its peers — it has the wind at its back. This rule tells your agent to favor leaders over laggards.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks with relative strength in the {rank} of their sector',
        params: {
          rank: { type: 'select', default: 'top quartile', options: [{ value: 'top quartile', label: 'Top quartile (top 25%)' }, { value: 'above median', label: 'Above median (top 50%)' }], label: 'Relative strength rank', hint: 'How selective to be about sector leadership. Top quartile is more selective but finds the strongest leaders.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'Relative Strength',
    kbEntryId: null,
    tags: ['relative-strength', 'sector', 'leaders'],
    agentUseDescription: 'Your agent will rank stocks against their sector peers and favor those outperforming the group, avoiding laggards.',
  },
  {
    id: 'tech-avoid-declining',
    category: 'technical',
    modes: 'both',
    headline: 'Don\'t catch falling knives',
    description: 'Avoid stocks in a sustained downtrend — wait for a reversal first.',
    learnMore: 'A stock trading below its 200-day moving average is in a long-term downtrend. Buying into a downtrend is risky — you\'re fighting momentum. This rule keeps your agent from trying to pick bottoms.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Avoid stocks trading below their {period}-day moving average',
        params: {
          period: { type: 'select', default: '200', options: [{ value: '50', label: '50-day (medium-term)' }, { value: '200', label: '200-day (long-term)' }], label: 'Downtrend moving average', hint: 'Which moving average defines the downtrend. 200-day catches long-term declines, 50-day is more sensitive.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: '200-day Moving Average',
    kbEntryId: 'moving-averages',
    tags: ['trend', 'downtrend', 'risk-avoidance'],
    agentUseDescription: 'Your agent will automatically exclude stocks trading below their long-term moving average, avoiding potential value traps.',
  },

  // ══════════════════════════════════════
  // FUNDAMENTAL CATEGORY
  // ══════════════════════════════════════
  {
    id: 'fund-earnings-surprise',
    category: 'fundamental',
    modes: 'both',
    headline: 'Bet on earnings winners',
    description: 'Favor companies that consistently beat earnings expectations.',
    learnMore: 'Companies that beat earnings estimates tend to continue outperforming. A positive earnings surprise signals strong execution and sometimes conservative guidance — both bullish signs.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Favor companies with positive earnings surprise in the last {quarters} quarters',
        params: {
          quarters: { type: 'select', default: '2', options: [{ value: '1', label: '1 quarter' }, { value: '2', label: '2 quarters' }, { value: '3', label: '3 quarters' }], label: 'Lookback quarters', hint: 'How many recent quarters must show positive surprise. More quarters = stronger signal but fewer matches.' }
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Earnings Surprise',
    kbEntryId: null,
    tags: ['earnings', 'surprise', 'momentum'],
    agentUseDescription: 'Your agent will check recent earnings reports and prioritize companies that beat analyst estimates, signaling strong execution.',
  },
  {
    id: 'fund-revenue-growth',
    category: 'fundamental',
    modes: 'both',
    headline: 'Find growing companies',
    description: 'Prefer companies with strong revenue growth — the top line matters most.',
    learnMore: 'Revenue growth shows whether a company is actually expanding its business. Earnings can be managed through cost-cutting, but revenue growth is harder to fake. Companies growing revenue above 10% are typically in a healthy expansion phase.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer companies with revenue growth above {pct}%',
        params: {
          pct: { type: 'number', default: 10, min: 5, max: 30, step: 5, unit: '%', label: 'Minimum revenue growth', hint: 'Year-over-year revenue growth threshold. Growth investors use 15%+, value investors accept 5%.' },
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Revenue Growth',
    kbEntryId: null,
    tags: ['revenue', 'growth', 'top-line'],
    agentUseDescription: 'Your agent will screen for companies with strong top-line revenue growth, filtering out stagnant businesses.',
  },
  {
    id: 'fund-value-pe',
    category: 'fundamental',
    modes: 'both',
    headline: 'Hunt for undervalued stocks',
    description: 'Look for stocks trading at a discount to their sector\'s average valuation.',
    learnMore: 'P/E ratio measures how much you pay per dollar of earnings. A stock with a P/E below its sector median may be undervalued — the market hasn\'t caught up to its true worth. Be careful though: sometimes stocks are cheap for a reason.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks with P/E ratio below {level}',
        params: {
          level: { type: 'select', default: 'sector median', options: [{ value: 'sector median', label: 'Sector median' }, { value: '20', label: 'P/E below 20' }, { value: '15', label: 'P/E below 15 (deep value)' }], label: 'Valuation ceiling', hint: 'P/E threshold for value screening. Sector median is relative, fixed numbers are absolute targets.' }
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'P/E Ratio',
    kbEntryId: null,
    tags: ['value', 'PE', 'valuation'],
    agentUseDescription: 'Your agent will compare each stock\'s P/E ratio against its sector median and favor those trading at a discount.',
  },
  {
    id: 'fund-bank-pb',
    category: 'fundamental',
    modes: 'both',
    headline: 'Value banks the right way',
    description: 'Use P/B ratio instead of P/E for bank stocks — it\'s a better measure.',
    learnMore: 'Banks earn money differently than tech companies. P/E is misleading because bank earnings are heavily cyclical. P/B (price-to-book) measures the stock price against the bank\'s actual asset value — a much better gauge for financials.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Evaluate bank stocks using P/B ratio; flag banks with P/B above {threshold} as expensive',
        params: {
          threshold: { type: 'number', default: 2.0, min: 1.0, max: 3.0, step: 0.5, unit: 'P/B', label: 'P/B expensive threshold', hint: 'Price-to-book level above which a bank is considered expensive. Most banks trade between 1.0-2.5x book.' },
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'P/B Ratio',
    kbEntryId: 'sector-playbook-banks',
    tags: ['banks', 'financials', 'PB', 'sector-specific'],
    agentUseDescription: 'Your agent will use P/B ratio instead of P/E when evaluating bank stocks, flagging those trading above book value as expensive.',
  },
  {
    id: 'fund-financial-health',
    category: 'fundamental',
    modes: 'both',
    headline: 'Avoid fragile companies',
    description: 'Skip companies with weak balance sheets — they crack under pressure.',
    learnMore: 'Financial health combines debt levels, cash flow strength, and profit margins into one picture. A company with strong financial health can weather market downturns. A weak one might not survive.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer companies with financial health score rated {level} or better',
        params: {
          level: { type: 'select', default: 'moderate', options: [{ value: 'strong', label: 'Strong only' }, { value: 'moderate', label: 'Moderate or better' }], label: 'Minimum health rating', hint: 'How strict the financial health filter is. Strong-only is more selective but finds the most resilient companies.' }
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Financial Health Score',
    kbEntryId: null,
    tags: ['health', 'balance-sheet', 'quality'],
    agentUseDescription: 'Your agent will assess debt levels, cash flow, and margins to avoid companies with weak balance sheets that could crack under pressure.',
  },
  {
    id: 'fund-market-cap',
    category: 'fundamental',
    modes: 'both',
    headline: 'Pick your weight class',
    description: 'Focus on company size that matches your strategy — big, medium, or small.',
    learnMore: 'Large caps (>$10B) are stable but move slowly. Mid caps ($2-10B) balance growth and stability. Small caps (<$2B) are volatile but can deliver explosive moves. Your choice depends on your game strategy.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer {size} cap stocks',
        params: {
          size: { type: 'select', default: 'large', options: [{ value: 'large', label: 'Large cap (>$10B)' }, { value: 'mid', label: 'Mid cap ($2-10B)' }, { value: 'small', label: 'Small cap (<$2B)' }], label: 'Market cap preference', hint: 'Large caps are stable, mid caps balance growth and stability, small caps are volatile but explosive.' }
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Market Capitalization',
    kbEntryId: 'market-capitalization',
    tags: ['market-cap', 'size', 'large-cap', 'small-cap'],
    agentUseDescription: 'Your agent will filter stocks by market capitalization, focusing on the size category that best fits your risk tolerance and game strategy.',
  },

  // ══════════════════════════════════════
  // RISK CATEGORY
  // ══════════════════════════════════════
  {
    id: 'risk-sector-diversification',
    category: 'risk',
    modes: 'both',
    headline: 'Spread your bets',
    description: 'Don\'t put all your picks in one industry — diversify across sectors.',
    learnMore: 'If all your picks are tech stocks and tech drops, your entire portfolio drops. Spreading across at least 3 sectors means one bad sector won\'t sink your whole game. This is the most fundamental risk rule.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Diversify across at least {n} sectors',
        params: {
          n: { type: 'number', default: 3, min: 2, max: 6, step: 1, unit: 'sectors', label: 'Minimum sectors', hint: 'How many different sectors the portfolio must span. Defensive players use 4-5.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['diversification', 'sector', 'foundational'],
    agentUseDescription: 'Your agent will ensure picks are spread across multiple sectors, rejecting portfolios that concentrate too heavily in one industry.',
  },
  {
    id: 'risk-single-stock-limit',
    category: 'risk',
    modes: 'both',
    headline: 'Don\'t bet the farm',
    description: 'Cap how much of your portfolio goes into any single stock.',
    learnMore: 'Putting 50%+ into one stock is gambling, not strategy. If that stock tanks, your whole game is over. A reasonable cap forces your agent to spread conviction across multiple picks.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'No single stock above {pct}% of portfolio',
        params: {
          pct: { type: 'number', default: 40, min: 20, max: 60, step: 5, unit: '%', label: 'Maximum single-stock weight', hint: 'Cap on any single stock as percentage of portfolio. Lower = more diversified, higher = more concentrated.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['concentration', 'position-sizing', 'foundational'],
    agentUseDescription: 'Your agent will cap the portfolio weight of any single stock, preventing one bad pick from sinking your entire game.',
  },
  {
    id: 'risk-volatility-avoidance',
    category: 'risk',
    modes: 'both',
    headline: 'Stay away from wild swings',
    description: 'Avoid stocks that are moving much more than normal for their sector.',
    learnMore: 'ATR (Average True Range) measures how much a stock moves each day. A stock with ATR far above its sector average is unusually volatile — it could move big in either direction. This rule keeps your agent away from unpredictable movers.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Avoid stocks with volatility above {level} for their sector',
        params: {
          level: { type: 'select', default: '2x sector average', options: [{ value: '1.5x sector average', label: '1.5x sector avg (strict)' }, { value: '2x sector average', label: '2x sector avg (standard)' }, { value: '3x sector average', label: '3x sector avg (lenient)' }], label: 'Volatility ceiling', hint: 'How much above the sector average volatility is tolerated. Stricter = fewer but more stable picks.' }
        },
        category: 'risk'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['volatility', 'ATR', 'risk-avoidance'],
    agentUseDescription: 'Your agent will measure each stock\'s volatility against its sector average and avoid those with unusually wild price swings.',
  },
  {
    id: 'risk-exit-atr-stop',
    category: 'risk',
    modes: 'both',
    headline: 'Know when to fold',
    description: 'Exit positions that drop too far — cut losses before they get worse.',
    learnMore: 'A stock that drops more than 2x its normal daily range from your entry is telling you something is wrong. Cutting the loss here prevents a small loss from becoming a devastating one. This is a classic stop-loss strategy.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Exit any position that drops below {multiplier}x ATR from entry',
        params: {
          multiplier: { type: 'select', default: '-2', options: [{ value: '-1.5', label: '-1.5x ATR (tight)' }, { value: '-2', label: '-2x ATR (standard)' }, { value: '-2.5', label: '-2.5x ATR (wide)' }, { value: '-3', label: '-3x ATR (very wide)' }], label: 'Stop-loss distance', hint: 'How far a stock must drop before exit. Tighter stops cut losses faster but trigger more often.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['stop-loss', 'ATR', 'exit-strategy'],
    agentUseDescription: 'Your agent will automatically exit positions that drop beyond a set ATR threshold from entry, cutting losses before they compound.',
  },
  {
    id: 'risk-avoid-declining-trend',
    category: 'risk',
    modes: 'both',
    headline: 'Don\'t fight the trend',
    description: 'Avoid stocks in a long-term downtrend — the momentum is against you.',
    learnMore: 'Buying a stock that has been falling for months is like swimming upstream. Even if it looks cheap, downtrends persist longer than most people expect. Wait for a confirmed reversal first.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Avoid stocks in a sustained downtrend (below {period}-day moving average)',
        params: {
          period: { type: 'select', default: '200', options: [{ value: '50', label: '50-day (medium-term)' }, { value: '200', label: '200-day (long-term)' }], label: 'Trend period', hint: 'Which moving average defines the downtrend. 200-day is more conservative, 50-day catches declines earlier.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: '200-day Moving Average',
    kbEntryId: null,
    tags: ['downtrend', 'trend', 'risk-avoidance'],
    agentUseDescription: 'Your agent will avoid buying stocks in sustained downtrends, waiting for a confirmed trend reversal before considering them.',
  },

  // ══════════════════════════════════════
  // ALLOCATION CATEGORY
  // ══════════════════════════════════════
  {
    id: 'alloc-sector-cap',
    category: 'allocation',
    modes: 'both',
    headline: 'Cap your sector exposure',
    description: 'Limit how much of your portfolio goes into any one sector.',
    learnMore: 'Even if you love tech, putting 80% there means you live and die by one sector. A reasonable cap (30-50%) ensures sector-specific bad news doesn\'t wipe out your entire strategy.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Cap {sector} sector at {pct}% of portfolio',
        params: {
          sector: { type: 'select', default: 'any single', options: [{ value: 'any single', label: 'Any single sector' }, { value: 'Technology', label: 'Technology' }, { value: 'Healthcare', label: 'Healthcare' }, { value: 'Financials', label: 'Financials' }, { value: 'Energy', label: 'Energy' }, { value: 'Consumer Discretionary', label: 'Consumer Discretionary' }, { value: 'Consumer Staples', label: 'Consumer Staples' }, { value: 'Industrials', label: 'Industrials' }, { value: 'Materials', label: 'Materials' }, { value: 'Real Estate', label: 'Real Estate' }, { value: 'Communication Services', label: 'Communication Services' }, { value: 'Utilities', label: 'Utilities' }], label: 'Sector scope', hint: 'Which sector to cap. "Any single" applies the cap uniformly to all sectors.' },
          pct: { type: 'number', default: 40, min: 20, max: 80, step: 5, unit: '%', label: 'Maximum sector weight', hint: 'Maximum percentage of portfolio in this sector. Lower = more diversified.' },
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['sector', 'cap', 'exposure', 'foundational'],
    agentUseDescription: 'Your agent will enforce a maximum percentage for any single sector, rebalancing when one sector grows too dominant.',
  },
  {
    id: 'alloc-sector-minimum',
    category: 'allocation',
    modes: 'both',
    headline: 'Guarantee sector exposure',
    description: 'Make sure your portfolio always includes a certain sector.',
    learnMore: 'If you believe energy stocks are going to outperform, this rule ensures your agent always allocates at least a minimum percentage to that sector — even when other signals are louder.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Allocate at least {pct}% to {sector} sector',
        params: {
          sector: { type: 'select', default: 'Technology', options: [{ value: 'Technology', label: 'Technology' }, { value: 'Healthcare', label: 'Healthcare' }, { value: 'Financials', label: 'Financials' }, { value: 'Energy', label: 'Energy' }, { value: 'Consumer Discretionary', label: 'Consumer Discretionary' }, { value: 'Consumer Staples', label: 'Consumer Staples' }, { value: 'Industrials', label: 'Industrials' }, { value: 'Materials', label: 'Materials' }, { value: 'Real Estate', label: 'Real Estate' }, { value: 'Communication Services', label: 'Communication Services' }, { value: 'Utilities', label: 'Utilities' }], label: 'Target sector', hint: 'Which sector to guarantee exposure to.' },
          pct: { type: 'number', default: 20, min: 10, max: 50, step: 5, unit: '%', label: 'Minimum sector weight', hint: 'Minimum percentage of portfolio allocated to this sector.' },
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['sector', 'minimum', 'allocation'],
    agentUseDescription: 'Your agent will always allocate at least the specified percentage to your chosen sector, even when other signals compete for attention.',
  },
  {
    id: 'alloc-tier-preference',
    category: 'allocation',
    modes: 'clash',
    headline: 'Control your Star picks',
    description: 'Decide what kind of stocks deserve your highest-scoring Star tier slot.',
    learnMore: 'In BaggerBomb, your Star tier stock gets a 2x score multiplier. This rule tells your agent what type of stock to put in that premium position — momentum leaders, undervalued gems, or something else.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Prefer {attribute} stocks for Star tier in BaggerBomb',
        params: {
          attribute: { type: 'select', default: 'high momentum', options: [{ value: 'high momentum', label: 'High momentum' }, { value: 'undervalued', label: 'Undervalued' }, { value: 'high relative strength', label: 'High relative strength' }, { value: 'high volume', label: 'High volume' }, { value: 'positive earnings surprise', label: 'Positive earnings surprise' }], label: 'Star tier criteria', hint: 'What attribute determines the Star tier pick. Momentum riders prefer high momentum, value players prefer undervalued.' }
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['tier', 'star', 'BaggerBomb', 'game-specific'],
    agentUseDescription: 'Your agent will select Star tier stocks based on your preferred attribute, putting your highest-conviction pick in the 2x multiplier slot.',
  },
  {
    id: 'alloc-even-spread',
    category: 'allocation',
    modes: 'both',
    headline: 'Keep it balanced',
    description: 'Spread allocation evenly across sectors instead of concentrating.',
    learnMore: 'An even spread means no single sector dominates your portfolio. This is the most defensive allocation strategy — you won\'t have the highest highs but you\'re protected from sector-specific crashes.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Spread allocation evenly across available sectors with {conviction} enforcement',
        params: {
          conviction: { type: 'select', default: 'moderate', options: [{ value: 'light', label: 'Light touch' }, { value: 'moderate', label: 'Moderate' }, { value: 'strong', label: 'Strong conviction' }], label: 'Rule strength', hint: 'How strictly the agent follows this directive.' },
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['balanced', 'even', 'defensive'],
    agentUseDescription: 'Your agent will distribute portfolio weight equally across available sectors, preventing any one sector from dominating your picks.',
  },

  // ══════════════════════════════════════
  // MID-BATTLE TRADING CATEGORY
  // ══════════════════════════════════════

  // MB-01: Signal Maturation Hold
  {
    id: 'mb-01',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Give your pick time to work',
    description: 'Prevents the agent from swapping a recently acquired stock, giving the original thesis time to play out.',
    hook: 'Gives your pick time to work — short-term dips are usually noise, not signal',
    learnMore: 'Short-term price dips right after picking a stock are usually noise, not a real signal. By enforcing a minimum hold time, you prevent your agent from panic-swapping on temporary volatility. The original thesis needs time to play out before you judge it.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Do not swap a stock held for less than {minutes} minutes unless it is approaching a Bust threshold',
        params: {
          minutes: { type: 'number', default: 60, min: 15, max: 180, step: 15, unit: 'min', label: 'Minimum hold time', hint: 'How long to hold before considering a swap. Longer = more patience with your thesis.' },
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['swap', 'patience', 'timing', 'hold'],
    agentUseDescription: 'Your agent will refuse to swap any stock until it has been held for the specified number of minutes, unless the stock is approaching a Bust threshold — giving your original pick time to work.',
  },

  // MB-03: Stagnation Swap
  {
    id: 'mb-03',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Replace dead money',
    description: 'Forces the agent to replace a stock that is not moving — dead money in a 1-day battle is a liability.',
    hook: 'A stock that sits still is wasting a roster spot — kick it out and find something alive',
    learnMore: 'In a single-day battle, time is your most precious resource. A stock that barely moves is consuming a roster slot without contributing to your score. ATR (Average True Range) measures typical movement — if a stock is moving far less than expected, it\'s stagnating and should be replaced with something active.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Swap any stock that has moved less than {atr} ATR in either direction over the last {minutes} minutes',
        params: {
          atr: { type: 'number', default: 0.2, min: 0.1, max: 0.5, step: 0.1, unit: 'ATR', label: 'Minimum movement', hint: 'ATR movement required. Day traders use 0.3 (30% of daily range).' },
          minutes: { type: 'number', default: 90, min: 45, max: 150, step: 15, unit: 'min', label: 'Stagnation window', hint: 'Time to wait before declaring dead money. Day traders use 60 min.' }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['swap', 'stagnation', 'dead-money', 'capital-velocity'],
    agentUseDescription: 'Your agent will monitor each stock\'s movement relative to its ATR and automatically swap out any stock that has flatlined over the specified time window.',
  },

  // MB-04: ATR Hurdle Rate
  {
    id: 'mb-04',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Demand proof before swapping',
    description: 'Requires the bench stock to significantly outperform the active stock before a swap is allowed.',
    hook: 'A swap should be a clear upgrade — this rule demands proof, not a guess',
    learnMore: 'Every swap carries risk — you might be selling low and buying high. By requiring the bench stock to outperform the active stock by a meaningful ATR margin, you ensure swaps are clear upgrades rather than lateral moves or gambles.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Only swap if the bench stock\'s intraday performance exceeds the active stock\'s by at least {atr} ATR',
        params: {
          atr: { type: 'number', default: 0.5, min: 0.25, max: 1.0, step: 0.25, unit: 'ATR', label: 'Swap hurdle', hint: 'Bench stock must outperform by this much. Lower = more responsive to breakouts.' },
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['swap', 'hurdle', 'quality-gate', 'cooldown-cost'],
    agentUseDescription: 'Your agent will compare the bench stock\'s intraday performance against the active stock\'s using ATR, and only allow a swap when the bench stock exceeds the active by the specified ATR threshold.',
  },

  // MB-05: VWAP Qualification Gate
  {
    id: 'mb-05',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Follow the smart money',
    description: 'Only allows swapping INTO a bench stock trading above its VWAP — ensures institutional momentum supports the move.',
    hook: 'If the smart money isn\'t buying it, your agent shouldn\'t either',
    learnMore: 'VWAP (Volume Weighted Average Price) represents the average price institutions are paying. A stock trading above VWAP has institutional buying support. Combining this with a bullish MACD signal creates a quality gate — your agent only swaps into stocks with both institutional momentum and confirmed trend direction.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Only swap into a bench stock if its price is above the daily VWAP and the 5-minute MACD shows a {signal} signal',
        params: {
          signal: { type: 'select', default: 'bullish crossover', options: [{ value: 'bullish crossover', label: 'Bullish crossover' }, { value: 'positive histogram', label: 'Positive histogram' }, { value: 'any bullish', label: 'Any bullish signal' }], label: 'MACD confirmation type', hint: 'Positive histogram detects active momentum; crossover confirms direction change.' }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'VWAP / MACD',
    kbEntryId: null,
    tags: ['swap', 'VWAP', 'institutional', 'quality-gate'],
    agentUseDescription: 'Your agent will only swap into a bench stock if it is trading above its daily VWAP and the 5-minute MACD confirms the specified bullish signal type.',
  },

  // MB-06: Tier-Weighted Conviction Premium
  {
    id: 'mb-06',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Protect your best picks',
    description: 'Makes it progressively harder to swap out higher-tier stocks — Star tier needs overwhelming evidence to abandon.',
    hook: 'Your best pick deserves the most protection — Star stocks are harder to give up on',
    learnMore: 'Star tier stocks carry a 2x scoring multiplier, so swapping one out is a high-stakes decision. This rule multiplies the swap hurdle rate by tier — making it progressively harder to give up on your highest-conviction picks. The evidence to abandon a Star stock should be overwhelming.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Multiply the swap hurdle rate by {star}x for Star tier and {core}x for Core tier stocks',
        params: {
          star: { type: 'number', default: 2.0, min: 1.5, max: 3.0, step: 0.5, unit: 'x', label: 'Star tier hurdle multiplier', hint: 'How much harder it is to swap a Star stock. Higher = more protection for your best pick.' },
          core: { type: 'number', default: 1.5, min: 1.0, max: 2.0, step: 0.5, unit: 'x', label: 'Core tier hurdle multiplier', hint: 'How much harder it is to swap a Core stock. Lower than Star but still provides protection.' }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['swap', 'tier', 'conviction', 'star-protection'],
    agentUseDescription: 'Your agent will multiply the swap hurdle rate based on the stock\'s tier — requiring significantly stronger evidence to swap out Star and Core stocks compared to Support stocks.',
  },

  // MB-07: Swap Circuit Breaker
  {
    id: 'mb-07',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Stop the churn',
    description: 'Hard timeout if the agent trades too frequently — prevents destructive feedback loops in choppy markets.',
    hook: 'Too many swaps in a row means the market is confusing your agent — force a cooldown',
    learnMore: 'In choppy or trendless markets, an agent can enter a destructive cycle of swapping back and forth. This circuit breaker detects excessive swap frequency and forces a cooldown period, giving the market time to establish direction before the agent resumes trading.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'If {swaps} or more swaps are executed within {window} minutes, disable non-emergency evaluations for {freeze} minutes',
        params: {
          swaps: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: '', label: 'Swap limit', hint: 'Number of swaps that triggers the circuit breaker. Lower = more conservative.' },
          window: { type: 'number', default: 60, min: 30, max: 120, step: 15, unit: 'min', label: 'Detection window', hint: 'Time window for counting swaps. Shorter window catches rapid-fire churning.' },
          freeze: { type: 'number', default: 45, min: 15, max: 90, step: 15, unit: 'min', label: 'Cooldown duration', hint: 'How long to freeze non-emergency swaps. Longer = more time for the market to settle.' }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['swap', 'anti-churn', 'circuit-breaker', 'patience'],
    agentUseDescription: 'Your agent will track swap frequency and automatically disable non-emergency swap evaluations for the specified freeze period if too many swaps occur within the time window.',
  },

  // MB-08: Disposition Override
  {
    id: 'mb-08',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Let winners run',
    description: 'Prevents the agent from swapping a winning stock until it reaches a scoring threshold — counteracts the urge to sell winners too early.',
    hook: 'Selling a winner early is the #1 mistake in trading — let profits run',
    learnMore: 'The disposition effect is the tendency to sell winners too early and hold losers too long. This rule counteracts that bias by preventing your agent from swapping any stock with positive P&L until it reaches a meaningful scoring threshold. Let profits run instead of locking in small gains.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Do not swap any stock with positive P&L until it reaches the {threshold} scoring threshold',
        params: {
          threshold: { type: 'select', default: 'BaggerBomb (+1.0x)', options: [{ value: 'BaggerBomb (+1.0x)', label: 'BaggerBomb (+1.0x)' }, { value: 'Double Bagger (+1.5x)', label: 'Double Bagger (+1.5x)' }], label: 'Minimum hold target', hint: 'Don\'t sell winners until this threshold. Momentum riders hold to Double Bagger.' }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['swap', 'disposition-effect', 'let-winners-run', 'behavioral'],
    agentUseDescription: 'Your agent will hold any stock with positive P&L until it reaches the specified scoring threshold, preventing premature exits from winning positions.',
  },

  // MB-09: Catastrophic Loss Eject
  {
    id: 'mb-09',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Pull the emergency brake',
    description: 'Hard stop-loss that overrides all holding rules — prevents a position from reaching Crash or Meltdown.',
    hook: 'Some losses are worth cutting immediately — pull the emergency brake',
    learnMore: 'Some losses are worth cutting immediately. This is an emergency override that supersedes all other holding rules — if a stock drops below the specified ATR threshold from entry, it gets ejected regardless of tier, hold time, or any other rule. It\'s the last line of defense against catastrophic scoring penalties.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Automatically swap any stock that drops below {atr} ATR from entry, regardless of tier or hold time',
        params: {
          atr: { type: 'number', default: -1.0, min: -1.5, max: -0.5, step: 0.1, unit: 'ATR', label: 'Emergency exit distance', hint: 'ATR loss that triggers immediate exit. Defensive: -0.7, Day: -1.0, Swing: -1.5.' },
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['swap', 'stop-loss', 'emergency', 'meltdown-prevention'],
    agentUseDescription: 'Your agent will immediately eject any stock that drops below the specified ATR threshold from its entry price, overriding all other hold rules to prevent catastrophic losses.',
  },

  // MB-10: Midday Lull Squelch
  {
    id: 'mb-10',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Stay quiet at lunch',
    description: 'Blocks swap evaluations during the lowest-volume lunch hour period.',
    hook: 'The lunch hour is a graveyard for momentum — keep your agent quiet when the market sleeps',
    learnMore: 'The midday lunch hour (roughly 11:30 AM - 1:30 PM ET) is the lowest-volume period of the trading day. Price moves during this window are unreliable and often reverse. This rule blocks your agent from making swap decisions during the lull, preventing trades based on thin, misleading price action.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Between {start} and {end}, block all swap evaluations unless triggered by a news catalyst',
        params: {
          start: { type: 'select', default: '11:30 AM', options: [{ value: '11:00 AM', label: '11:00 AM (early)' }, { value: '11:30 AM', label: '11:30 AM (standard)' }, { value: '12:00 PM', label: '12:00 PM (late)' }], label: 'Lull start time', hint: 'When to begin blocking swap evaluations. Earlier = more conservative.' },
          end: { type: 'select', default: '1:30 PM', options: [{ value: '1:00 PM', label: '1:00 PM (short)' }, { value: '1:30 PM', label: '1:30 PM (standard)' }, { value: '2:00 PM', label: '2:00 PM (extended)' }], label: 'Lull end time', hint: 'When to resume swap evaluations. Later = longer quiet period.' }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['timing', 'midday', 'volume', 'patience'],
    agentUseDescription: 'Your agent will block all swap evaluations during the specified midday window, only allowing trades triggered by breaking news catalysts.',
  },

  // MB-11: Power Hour Aggression
  {
    id: 'mb-11',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Lean in for the final push',
    description: 'Lowers swap hurdle rates in the final hour to capture end-of-day institutional moves.',
    hook: 'The last hour of trading is when the big money moves — let your agent join the party',
    learnMore: 'The final hour of trading (power hour) sees a surge in institutional volume as funds rebalance and close positions. Price moves during this window are often directional and sustained. This rule lowers swap hurdle rates to let your agent capitalize on these high-conviction end-of-day moves.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'After {time}, reduce the swap hurdle rate by {pct}% and evaluate bench stocks showing 5-minute MACD divergence',
        params: {
          time: { type: 'select', default: '3:00 PM', options: [{ value: '2:30 PM', label: '2:30 PM (early)' }, { value: '3:00 PM', label: '3:00 PM (standard)' }, { value: '3:30 PM', label: '3:30 PM (late)' }], label: 'Power hour start', hint: 'When to start reducing hurdle rates. Earlier = more time to capture institutional moves.' },
          pct: { type: 'number', default: 50, min: 25, max: 75, step: 25, unit: '%', label: 'Hurdle reduction', hint: 'How much to reduce the swap hurdle rate. Higher = more aggressive in the final push.' }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'MACD',
    kbEntryId: null,
    tags: ['timing', 'power-hour', 'aggression', 'institutional'],
    agentUseDescription: 'Your agent will lower swap hurdle rates after the specified time and actively evaluate bench stocks showing MACD divergence, making it easier to capitalize on end-of-day institutional moves.',
  },

  // MB-12: Hurdle Rate Time Decay
  {
    id: 'mb-12',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Use it or lose it',
    description: 'Gradually lowers the swap hurdle rate as the day progresses — bench optionality is worth less as time runs out.',
    hook: 'Swaps get cheaper to justify as the clock ticks — your bench is worth less if you never use it',
    learnMore: 'Bench stocks are like options — their value decays over time. Early in the day, you should demand a large performance gap to justify a swap. But as the clock ticks, an unused bench is a wasted resource. This rule gradually lowers the hurdle rate so your agent becomes more willing to act as time runs out.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Reduce the swap hurdle rate by {pct}% for each hour after {start}',
        params: {
          pct: { type: 'number', default: 15, min: 5, max: 30, step: 5, unit: '%', label: 'Hourly decay rate', hint: 'Hurdle reduction per hour. Higher = faster decay, more willingness to swap as time runs out.' },
          start: { type: 'select', default: '1:00 PM', options: [{ value: '12:00 PM', label: '12:00 PM (early)' }, { value: '1:00 PM', label: '1:00 PM (standard)' }, { value: '2:00 PM', label: '2:00 PM (late)' }], label: 'Decay start time', hint: 'When hurdle rate decay begins. Earlier start = more gradual reduction.' }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['timing', 'hurdle', 'time-decay', 'optionality'],
    agentUseDescription: 'Your agent will progressively reduce the swap hurdle rate by the specified percentage for each hour after the start time, making swaps increasingly easier to justify as the trading day progresses.',
  },

  // MB-13: News Confirmation Lag
  {
    id: 'mb-13',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Wait for the dust to settle',
    description: 'Delays the agent\'s reaction to breaking news to avoid trading into overreactions.',
    hook: 'First reactions to headlines are usually wrong — wait for the dust to settle',
    learnMore: 'Markets tend to overreact to breaking news in the first few minutes, then correct. By introducing a delay between a news trigger and swap execution, your agent avoids buying into the spike or selling into the panic. The dust needs to settle before you can see clearly.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'When a news trigger fires, wait {intervals} evaluation intervals before allowing a swap based on that catalyst',
        params: {
          intervals: { type: 'number', default: 1, min: 1, max: 3, step: 1, unit: '', label: 'Confirmation delay', hint: 'Evaluation intervals to wait after news. More intervals = more time for overreaction to settle.' },
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['news', 'patience', 'overreaction', 'confirmation'],
    agentUseDescription: 'Your agent will delay acting on news catalysts by the specified number of evaluation intervals, allowing the initial market overreaction to settle before making swap decisions.',
  },

  // MB-14: Sentiment-Price Confluence
  {
    id: 'mb-14',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Trust price over headlines',
    description: 'Requires FantasyTimes sentiment to match actual price direction before acting.',
    hook: 'Headlines lie sometimes — trust the price, not the story',
    learnMore: 'News headlines can be misleading — a "bullish" story doesn\'t always move the price up. This rule requires the FantasyTimes sentiment direction to match the stock\'s actual price indicator before the agent acts. When sentiment and price agree, the signal is much stronger.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Only act on a news catalyst if the FantasyTimes sentiment direction matches the stock\'s {indicator} direction',
        params: {
          indicator: { type: 'select', default: '5-min VWAP trend', options: [{ value: '5-min VWAP trend', label: '5-min VWAP trend' }, { value: '5-min RSI direction', label: '5-min RSI direction' }, { value: '5-min MACD histogram', label: '5-min MACD histogram' }], label: 'Price confirmation indicator', hint: 'Which technical indicator must confirm the news sentiment before acting.' }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'VWAP / RSI / MACD',
    kbEntryId: null,
    tags: ['news', 'sentiment', 'confluence', 'VWAP'],
    agentUseDescription: 'Your agent will only act on FantasyTimes news catalysts when the sentiment direction matches the stock\'s specified technical indicator direction, filtering out misleading headlines.',
  },

  // MB-15: VWAP Thesis Invalidation
  {
    id: 'mb-15',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Exit when the thesis breaks',
    description: 'If a stock stays below VWAP for consecutive intervals, the thesis is broken — force an exit.',
    hook: 'When a stock can\'t hold above its average price, the institutions have given up — so should your agent',
    learnMore: 'VWAP represents the price institutions are paying. When a stock consistently trades below VWAP, it means institutional buyers have stepped away. If this persists for multiple evaluation intervals, the original bullish thesis is invalidated. This rule forces an exit regardless of tier or hold time.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Swap any stock that remains below its daily VWAP for {intervals} consecutive evaluations, regardless of tier',
        params: {
          intervals: { type: 'number', default: 3, min: 2, max: 5, step: 1, unit: '', label: 'Below-VWAP tolerance', hint: 'Consecutive eval intervals below VWAP before forcing exit. Day traders use 2 (30 min).' },
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'VWAP',
    kbEntryId: null,
    tags: ['VWAP', 'thesis-invalidation', 'institutional', 'exit'],
    agentUseDescription: 'Your agent will track how many consecutive evaluation intervals each stock remains below its daily VWAP, and force an exit swap when the specified threshold is reached.',
  },

  // ══════════════════════════════════════
  // GAME STATE CATEGORY
  // ══════════════════════════════════════

  // GS-01: Early Phase Bench Preservation
  {
    id: 'gs-01',
    category: 'game_state',
    modes: 'clash',
    headline: 'Survive the opening chaos',
    description: 'Restricts offensive swaps in the EARLY phase — agent trusts its initial portfolio.',
    hook: 'The morning is chaos — survive the noise before making moves',
    learnMore: 'The first phase of a trading day is dominated by volatile opening prints and erratic price swings. Most of these moves reverse within minutes. This rule tells your agent to trust its initial picks and avoid knee-jerk swaps during the EARLY phase, unless a stock is in serious trouble.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'In the EARLY phase, disable swap evaluations unless a stock drops below {atr} ATR',
        params: {
          atr: { type: 'number', default: -1.0, min: -1.5, max: -0.5, step: 0.1, unit: 'ATR', label: 'Emergency swap threshold', hint: 'ATR drop that overrides the early-phase hold. More negative = more patience in the opening.' },
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['phase', 'early', 'preservation', 'patience'],
    agentUseDescription: 'Your agent will disable swap evaluations during the EARLY phase, only allowing swaps if a stock drops below the specified ATR threshold — preserving your initial portfolio through the noisy opening.',
  },

  // GS-02: Phase-Scaled Risk Tolerance
  {
    id: 'gs-02',
    category: 'game_state',
    modes: 'clash',
    headline: 'Scale risk by time of day',
    description: 'Widens or tightens stop-loss thresholds based on the current time phase.',
    hook: 'Morning volatility needs a wide leash, but final hour needs a tight one',
    learnMore: 'Volatility is not constant throughout the day — it spikes at the open, settles midday, and surges again at the close. This rule adjusts stop-loss thresholds by phase so your agent gives stocks more room to breathe in the volatile morning and tightens up as the day ends and every point counts.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Scale ATR-based stop thresholds by phase: EARLY {early}x, MID {mid}x, LATE {late}x, FINAL_HOUR {final}x',
        params: {
          early: { type: 'number', default: 2.0, min: 1.5, max: 3.0, step: 0.5, unit: 'x', label: 'EARLY phase multiplier', hint: 'Stop-loss multiplier during volatile opening. Higher = more room to breathe.' },
          mid: { type: 'number', default: 1.5, min: 1.0, max: 2.0, step: 0.5, unit: 'x', label: 'MID phase multiplier', hint: 'Stop-loss multiplier during midday. Moderate room as volatility settles.' },
          late: { type: 'number', default: 1.2, min: 1.0, max: 1.5, step: 0.1, unit: 'x', label: 'LATE phase multiplier', hint: 'Stop-loss multiplier as day progresses. Tighter to protect gains.' },
          final: { type: 'number', default: 1.0, min: 0.5, max: 1.5, step: 0.1, unit: 'x', label: 'FINAL_HOUR multiplier', hint: 'Stop-loss multiplier in the last hour. Tightest to lock in the final score.' }
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['phase', 'risk-scaling', 'stop-loss', 'time-aware'],
    agentUseDescription: 'Your agent will multiply ATR-based stop thresholds by phase-specific scaling factors, giving stocks more breathing room early in the day and tightening stops as the battle progresses.',
  },

  // GS-03: Bench Optionality Time Decay
  {
    id: 'gs-03',
    category: 'game_state',
    modes: 'clash',
    headline: 'Use the bench before it expires',
    description: 'Makes swaps easier to justify as the day progresses.',
    hook: 'An unused bench at the closing bell is a wasted resource',
    learnMore: 'Your bench stocks are like options — they lose value as time passes. Early in the day there\'s plenty of time for your current picks to work, so swaps should be rare. But as phase transitions tick by, an unused bench becomes a liability. This rule lowers hurdle rates with each phase to encourage timely use of your bench.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Reduce swap hurdle rates by {pct}% for each phase transition (EARLY → MID → LATE → FINAL_HOUR)',
        params: {
          pct: { type: 'number', default: 20, min: 10, max: 40, step: 5, unit: '%', label: 'Phase decay rate', hint: 'How much to reduce hurdle rates per phase transition. Higher = faster unlocking of bench optionality.' },
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['phase', 'time-decay', 'optionality', 'bench'],
    agentUseDescription: 'Your agent will reduce swap hurdle rates by the specified percentage at each phase transition, making it progressively easier to justify using bench stocks as the day progresses.',
  },

  // GS-04: Par Score Target
  {
    id: 'gs-04',
    category: 'game_state',
    modes: 'clash',
    headline: 'Set your scoring target',
    description: 'Sets an internal score benchmark that triggers strategy shifts between aggressive and defensive.',
    hook: 'Define what winning means for your agent — everything else adjusts around this number',
    learnMore: 'A par score is your agent\'s internal definition of "winning." Once set, other game-state rules can use it to decide when to play aggressively (below par) or defensively (above par). It\'s the foundation for adaptive strategy — without a target, your agent has no way to know if it\'s ahead or behind.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Set a par score target of {points} points. Use this to determine whether to play aggressively or defensively',
        params: {
          points: { type: 'number', default: 80, min: 30, max: 200, step: 10, unit: 'pts', label: 'Par score target', hint: 'Your scoring benchmark. Other game-state rules reference this to decide aggressive vs. defensive play.' }
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['score', 'par', 'benchmark', 'foundation'],
    agentUseDescription: 'Your agent will use the par score target as a benchmark to determine whether it should play aggressively or defensively, informing other game-state rules.',
  },

  // GS-05: Leading — Defensive Posture
  {
    id: 'gs-05',
    category: 'game_state',
    modes: 'clash',
    headline: 'Protect the lead',
    description: 'When score exceeds par target, shifts to capital preservation.',
    hook: 'When you\'re ahead, protect the lead — like running out the clock in football',
    learnMore: 'When your score is well above par, the smart play is to protect what you\'ve earned rather than risk it chasing more. This rule widens loss tolerance (so minor dips don\'t trigger panicked swaps) and restricts swaps to emergencies only — like running out the clock when you\'re winning.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'When score exceeds par target by {pct}%, widen loss tolerance to {atr} ATR and restrict swaps to emergency exits only',
        params: {
          pct: { type: 'number', default: 20, min: 10, max: 50, step: 5, unit: '%', label: 'Lead margin', hint: 'How far above par triggers defensive mode. Higher = only shift when solidly ahead.' },
          atr: { type: 'number', default: -1.2, min: -1.5, max: -0.8, step: 0.1, unit: 'ATR', label: 'Widened loss tolerance', hint: 'Relaxed stop-loss for leading positions. More negative = more breathing room.' }
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['score', 'leading', 'defensive', 'clock-management'],
    agentUseDescription: 'Your agent will shift to defensive mode when score exceeds the par target by the specified percentage, widening loss tolerance and restricting swaps to emergency exits only.',
  },

  // GS-06: Trailing — Aggressive Posture
  {
    id: 'gs-06',
    category: 'game_state',
    modes: 'clash',
    headline: 'Play to win from behind',
    description: 'When score falls below par target, increases risk appetite.',
    hook: 'When you\'re behind with time running out, play to win — not to lose slowly',
    learnMore: 'When your score is significantly below par and time is running out, playing it safe guarantees a loss. This rule increases risk appetite in the LATE and FINAL_HOUR phases — lowering swap hurdles and prioritizing high-ATR bench stocks that have the explosive potential to close the gap.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'When score falls below {pct}% of par target and phase is LATE or FINAL_HOUR, reduce all swap hurdle rates by {reduction}% and prioritize high-ATR bench stocks',
        params: {
          pct: { type: 'number', default: 80, min: 50, max: 90, step: 5, unit: '%', label: 'Trailing threshold', hint: 'Score as percentage of par that triggers aggressive mode. Lower = activate sooner.' },
          reduction: { type: 'number', default: 50, min: 25, max: 75, step: 25, unit: '%', label: 'Hurdle rate reduction', hint: 'How much to reduce swap hurdle rates. Higher = more aggressive comeback attempt.' }
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['score', 'trailing', 'aggressive', 'hail-mary'],
    agentUseDescription: 'Your agent will shift to aggressive mode when trailing the par target in late phases, reducing swap hurdle rates and prioritizing high-ATR bench stocks to maximize comeback potential.',
  },

  // GS-07: Satisficer's Lock
  {
    id: 'gs-07',
    category: 'game_state',
    modes: 'clash',
    headline: 'Lock in a great score',
    description: 'When score exceeds a high ceiling, completely disables offensive swaps.',
    hook: 'Sometimes good enough is the smartest play — lock in a great score and stop gambling',
    learnMore: 'There comes a point where your score is so good that any additional swap is more likely to hurt than help. This rule sets a ceiling score at which your agent stops all offensive trading and only acts to prevent catastrophic losses. It\'s the ultimate "quit while you\'re ahead" rule.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'When score exceeds {ceiling} points, disable all offensive swaps. Only swap if a stock falls within {atr} ATR of a Crash threshold',
        params: {
          ceiling: { type: 'number', default: 150, min: 80, max: 300, step: 10, unit: 'pts', label: 'Lock-in ceiling', hint: 'Score at which all offensive swaps stop. Higher = more ambitious before locking in.' },
          atr: { type: 'number', default: 0.2, min: 0.1, max: 0.5, step: 0.1, unit: 'ATR', label: 'Crash protection distance', hint: 'Only swap if stock is this close to a Crash threshold. Lower = tighter emergency detection.' }
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['score', 'aspiration', 'lock', 'capital-preservation'],
    agentUseDescription: 'Your agent will completely disable offensive swaps when the score exceeds the ceiling, only allowing emergency swaps to prevent stocks from reaching Crash thresholds.',
  },

  // GS-08: Hot Hand Swap Freeze
  {
    id: 'gs-08',
    category: 'game_state',
    modes: 'clash',
    headline: 'Don\'t fix what isn\'t broken',
    description: 'When the portfolio is on a winning streak, locks it to prevent over-managing success.',
    hook: 'Don\'t fix what isn\'t broken — if your portfolio is hitting thresholds, leave it alone',
    learnMore: 'When your portfolio is on a hot streak — multiple positive thresholds hit in a short window — the worst thing your agent can do is tinker. This rule dramatically increases swap hurdle rates during winning streaks, effectively freezing the portfolio to let the momentum play out.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'If {thresholds} or more positive thresholds have been hit in the last {cycles} evaluation cycles, increase swap hurdle rates by {mult}x',
        params: {
          thresholds: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: '', label: 'Threshold hit count', hint: 'How many positive thresholds define a hot streak. Lower = triggers freeze more easily.' },
          cycles: { type: 'number', default: 4, min: 2, max: 8, step: 1, unit: '', label: 'Lookback cycles', hint: 'Evaluation cycles to look back for threshold hits. Shorter = more reactive to recent streaks.' },
          mult: { type: 'number', default: 3.0, min: 2.0, max: 5.0, step: 0.5, unit: 'x', label: 'Hurdle rate multiplier', hint: 'How much to increase swap hurdle rates during a hot streak. Higher = harder to break the streak.' }
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['momentum', 'hot-hand', 'freeze', 'winning-streak'],
    agentUseDescription: 'Your agent will track positive threshold hits across evaluation cycles and dramatically increase swap hurdle rates during winning streaks, preventing unnecessary trades when the portfolio is performing well.',
  },

  // GS-09: Drawdown Regime Breaker
  {
    id: 'gs-09',
    category: 'game_state',
    modes: 'clash',
    headline: 'Break the losing streak',
    description: 'If the portfolio bleeds slowly over consecutive cycles, forces a change.',
    hook: 'A slow bleed is worse than a quick cut — break the losing pattern',
    learnMore: 'A slow, steady decline is harder to detect than a sudden crash, but just as damaging. When portfolio P&L has been negative for several consecutive cycles, the current strategy clearly isn\'t working. This rule forces a swap of the worst performer to break the losing pattern.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'If portfolio P&L has been negative for {cycles} consecutive evaluation cycles, force a swap of the worst-performing stock',
        params: {
          cycles: { type: 'number', default: 4, min: 3, max: 6, step: 1, unit: '', label: 'Consecutive loss cycles', hint: 'How many negative cycles before forcing a swap. Lower = faster pattern-breaking.' },
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['drawdown', 'regime-break', 'forced-swap', 'losing-streak'],
    agentUseDescription: 'Your agent will track consecutive negative P&L cycles and force a swap of the worst-performing stock when the specified threshold is reached, breaking destructive losing patterns.',
  },

  // GS-10: End-of-Day Reversal Fade
  {
    id: 'gs-10',
    category: 'game_state',
    modes: 'clash',
    headline: 'Don\'t chase afternoon runners',
    description: 'In FINAL_HOUR, prevents swapping INTO stocks that have already run up massively.',
    hook: 'Stocks that ran all day often reverse in the last hour — don\'t chase yesterday\'s winner at 3pm',
    learnMore: 'Stocks that have already made large intraday moves are statistically more likely to reverse in the final hour as traders take profits. Swapping into a stock that\'s already up big is chasing — you\'re buying at the top. This rule blocks your agent from swapping into overextended stocks during FINAL_HOUR.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'In FINAL_HOUR, prohibit swapping into any bench stock with intraday P&L exceeding {atr} ATR',
        params: {
          atr: { type: 'number', default: 1.5, min: 1.0, max: 2.0, step: 0.5, unit: 'ATR', label: 'Overextension threshold', hint: 'Maximum intraday ATR gain before a stock is considered too extended to buy in FINAL_HOUR.' },
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['phase', 'final-hour', 'reversal', 'institutional'],
    agentUseDescription: 'Your agent will block swaps into bench stocks that have already moved beyond the specified ATR threshold during FINAL_HOUR, preventing chasing of overextended stocks.',
  },

  // GS-12: After-Hours Catalyst Positioning
  {
    id: 'gs-12',
    category: 'game_state',
    modes: 'clash',
    headline: 'Position for after-hours moves',
    description: 'In the final evaluation, prioritizes stocks with scheduled post-market catalysts.',
    hook: 'Scoring continues after the bell — position for after-hours earnings moves',
    learnMore: 'If scoring continues after market close, stocks with scheduled after-hours catalysts (like earnings reports) can deliver massive moves. This rule tells your agent to prioritize those stocks in its final evaluation, but only if they have enough volatility (ATR) to actually capture the move.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'In the final evaluation before market close, prioritize bench stocks with scheduled after-hours catalysts if their ATR exceeds {pct}% of price',
        params: {
          pct: { type: 'number', default: 2.0, min: 1.0, max: 4.0, step: 0.5, unit: '%', label: 'Minimum ATR % of price', hint: 'ATR percentage threshold for after-hours candidates. Higher = only volatile stocks with big move potential.' },
        },
        category: 'game_state'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['after-hours', 'earnings', 'catalyst', 'final-swap'],
    agentUseDescription: 'Your agent will prioritize bench stocks with after-hours catalysts in its final evaluation, but only if their ATR exceeds the specified percentage of price.',
  },

  // ══════════════════════════════════════
  // THRESHOLD STRATEGY CATEGORY
  // ══════════════════════════════════════

  // TH-01: Proximity Persistence
  {
    id: 'th-01',
    category: 'threshold',
    modes: 'clash',
    headline: 'Hold near the bonus line',
    description: 'The closer a stock is to a positive threshold, the harder it becomes to swap out.',
    hook: 'When your stock is inches from a bonus, hold your nerve — the payoff is worth the wait',
    learnMore: 'When a stock is close to triggering a positive scoring threshold, swapping it out means giving up on imminent bonus points. This rule increases swap resistance as stocks approach thresholds — the closer you are, the more evidence is needed to justify an exit. But if the stock reverses hard, the protection lifts.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'If a stock is within {atr} ATR of its next positive threshold, increase its swap resistance by {mult}x. Do not swap unless it reverses more than {drawdown} ATR from its peak',
        params: {
          atr: { type: 'number', default: 0.25, min: 0.1, max: 0.5, step: 0.05, unit: 'ATR', label: 'Proximity range', hint: 'How close to a threshold before swap resistance kicks in. Lower = tighter protection zone.' },
          mult: { type: 'number', default: 2.0, min: 1.5, max: 3.0, step: 0.5, unit: 'x', label: 'Resistance multiplier', hint: 'How much harder it is to swap a near-threshold stock. Higher = stronger hold near bonuses.' },
          drawdown: { type: 'number', default: 0.3, min: 0.15, max: 0.5, step: 0.05, unit: 'ATR', label: 'Reversal override', hint: 'ATR drawdown from peak that overrides proximity hold. Lower = faster bail on reversals.' }
        },
        category: 'threshold'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['threshold', 'proximity', 'hold', 'goal-gradient'],
    agentUseDescription: 'Your agent will increase swap resistance for stocks approaching positive thresholds, requiring a significant drawdown reversal before allowing a swap of a near-threshold stock.',
  },

  // TH-04: House Money Pursuit
  {
    id: 'th-04',
    category: 'threshold',
    modes: 'clash',
    headline: 'Chase the next bonus',
    description: 'After hitting a threshold, widens stops to chase the next tier — treats locked-in points as a cushion.',
    hook: 'You already banked the bonus — now play with house money and go for the bigger prize',
    learnMore: 'Once a stock triggers a threshold bonus, those points are locked in. This gives you a cushion to play with — "house money." By widening the trailing stop after a threshold hit, your agent gives the stock more room to run toward the next, bigger bonus tier instead of locking in a modest gain.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'After a stock triggers {threshold}, widen the trailing stop by an additional {atr} ATR to chase the next threshold tier',
        params: {
          threshold: { type: 'select', default: 'BaggerBomb', options: [{ value: 'BaggerBomb', label: 'BaggerBomb' }, { value: 'Double Bagger', label: 'Double Bagger' }], label: 'Trigger threshold', hint: 'Which scoring level activates the stop widening.' },
          atr: { type: 'number', default: 0.5, min: 0.3, max: 1.0, step: 0.1, unit: 'ATR', label: 'Additional stop buffer', hint: 'Extra ATR room after threshold hit. Momentum riders use 0.75 to chase Double Bagger.' }
        },
        category: 'threshold'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['threshold', 'post-bonus', 'house-money', 'aggressive'],
    agentUseDescription: 'Your agent will widen trailing stops after a stock triggers the specified threshold, giving it more room to pursue the next bonus tier using the locked-in points as a cushion.',
  },

  // TH-05: Bird-in-the-Hand Lock
  {
    id: 'th-05',
    category: 'threshold',
    modes: 'clash',
    headline: 'Lock in the win',
    description: 'After hitting a threshold, tightens stops to lock in base P&L — especially in high-multiplier tiers.',
    hook: 'A guaranteed win beats a maybe — lock in your gains before the market takes them back',
    learnMore: 'The opposite of House Money — this rule prioritizes certainty over upside. After a threshold hit, it tightens the trailing stop to protect your gains, especially for Star and Core tier stocks where the multiplier amplifies both gains and losses. A guaranteed win is worth more than a gamble for a bigger one.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'After a stock in {tier} tier triggers a positive threshold, tighten the trailing stop to {atr} ATR below the current price',
        params: {
          tier: { type: 'select', default: 'Star', options: [{ value: 'Star', label: 'Star only' }, { value: 'Star and Core', label: 'Star and Core' }, { value: 'Any tier', label: 'Any tier' }], label: 'Apply to tier', hint: 'Which tier gets the profit lock. Star tier has the most to protect (2x multiplier).' },
          atr: { type: 'number', default: 0.2, min: 0.1, max: 0.4, step: 0.05, unit: 'ATR', label: 'Trailing stop distance', hint: 'ATR below peak price. Defensive players use 0.1-0.2 (extremely tight) to lock in bonuses.' }
        },
        category: 'threshold'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['threshold', 'post-bonus', 'profit-lock', 'conservative'],
    agentUseDescription: 'Your agent will tighten trailing stops after a stock triggers a positive threshold in the specified tier, locking in gains by reducing the distance between the current price and the stop level.',
  },

  // TH-07: Asymmetric Loss Multiplier
  {
    id: 'th-07',
    category: 'threshold',
    modes: 'clash',
    headline: 'Fear losses more than you love gains',
    description: 'Makes the agent treat negative thresholds as closer than they are — fear of loss should outweigh excitement about gains.',
    hook: 'Losing 35 points hurts way more than gaining 15 feels good — be properly scared of penalties',
    learnMore: 'Scoring penalties are often much larger than bonuses. A Bust costs -35 points while a BaggerBomb only earns +15. This asymmetry means your agent should be disproportionately afraid of approaching negative thresholds. This rule multiplies the perceived proximity of penalties so your agent reacts sooner.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Multiply the perceived proximity of all negative thresholds by {mult}x when calculating swap urgency',
        params: {
          mult: { type: 'number', default: 1.5, min: 1.2, max: 2.0, step: 0.1, unit: 'x', label: 'Loss perception multiplier', hint: 'How much closer penalties feel. 2.0x = Kahneman loss aversion. Higher = more defensive.' },
        },
        category: 'threshold'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['threshold', 'loss-aversion', 'penalty', 'asymmetry'],
    agentUseDescription: 'Your agent will multiply the perceived proximity of negative thresholds by the specified factor, making it react to approaching penalties sooner and with greater urgency than it does for approaching bonuses.',
  },

  // TH-08: Sunk-Cost Threshold Timeout
  {
    id: 'th-08',
    category: 'threshold',
    modes: 'clash',
    headline: 'Know when to give up waiting',
    description: 'If a stock hovers near a threshold without crossing it, the agent resets and treats it as swappable.',
    hook: 'Just because a stock is close doesn\'t mean it\'ll get there — know when to give up waiting',
    learnMore: 'Proximity Persistence protects stocks near thresholds, but that protection can become a trap. If a stock hovers near a bonus for too long without triggering it, you\'re falling for the sunk-cost fallacy. This rule sets a timeout — after the specified wait, the proximity bonus resets and the stock becomes swappable again.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'If a stock remains within {atr} ATR of a positive threshold for more than {minutes} minutes without triggering it, reset its proximity bonus',
        params: {
          atr: { type: 'number', default: 0.15, min: 0.05, max: 0.3, step: 0.05, unit: 'ATR', label: 'Hover zone', hint: 'ATR distance that defines "near" a threshold. Wider zone = more stocks affected by the timeout.' },
          minutes: { type: 'number', default: 45, min: 15, max: 90, step: 15, unit: 'min', label: 'Timeout duration', hint: 'How long to wait before resetting proximity bonus. Shorter = less patience with hovering.' }
        },
        category: 'threshold'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['threshold', 'sunk-cost', 'timeout', 'discipline'],
    agentUseDescription: 'Your agent will track how long each stock has been hovering near a positive threshold and reset its proximity bonus after the specified timeout, preventing the sunk-cost fallacy from locking up roster spots.',
  },

  // TH-09: Weakest-Link Swap Priority
  {
    id: 'th-09',
    category: 'threshold',
    modes: 'clash',
    headline: 'Replace the weakest link',
    description: 'When swapping, always eject the stock furthest from any positive threshold.',
    hook: 'Every portfolio has a weakest link — make sure that\'s the one that gets replaced',
    learnMore: 'Not all stocks are equal when it comes to scoring potential. The stock furthest from its next positive threshold is contributing the least to your score potential. When it\'s time to swap, this rule ensures the weakest link gets ejected — not a stock that might be close to triggering a bonus.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'When initiating a swap, select the stock with the greatest distance to its next positive threshold as the ejection candidate',
        params: {
          exempt_tiers: { type: 'select', default: 'None', options: [{ value: 'None', label: 'None (all swappable)' }, { value: 'Star only', label: 'Star only exempt' }, { value: 'Star and Core', label: 'Star and Core exempt' }], label: 'Tier exemptions', hint: 'Which tiers are protected from weakest-link ejection. Exempting Star protects your 2x pick.' }
        },
        category: 'threshold'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['threshold', 'weakest-link', 'portfolio-triage', 'swap-selection'],
    agentUseDescription: 'Your agent will select the stock with the greatest distance to its next positive threshold as the swap ejection candidate, ensuring the weakest scorer gets replaced first.',
  },

  // TH-10: Portfolio Scoring Posture
  {
    id: 'th-10',
    category: 'threshold',
    modes: 'clash',
    headline: 'Choose your scoring personality',
    description: 'Sets the agent\'s global philosophy — harvest many small bonuses or hunt rare big ones.',
    hook: 'Do you want lots of +15s or one epic +50? This defines your agent\'s scoring personality',
    learnMore: 'There are two ways to score big: collect many small threshold bonuses (Harvest) or hold out for rare, massive ones (Hunt). Harvest mode swaps stocks after BaggerBomb to bring in fresh threshold candidates. Hunt mode holds for deeper milestones. Balanced mode adapts based on game state. This is the most fundamental strategic choice you can make.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Set scoring posture to {posture}. In Harvest mode, swap stocks after BaggerBomb for fresh candidates. In Hunt mode, hold for deeper milestones',
        params: {
          posture: { type: 'select', default: 'Balanced', options: [{ value: 'Harvest (many +15s)', label: 'Harvest (many +15s)' }, { value: 'Hunt (few +50s)', label: 'Hunt (few +50s)' }, { value: 'Balanced', label: 'Balanced (adaptive)' }], label: 'Scoring philosophy', hint: 'Harvest collects small bonuses frequently, Hunt holds for big ones, Balanced adapts to game state.' }
        },
        category: 'threshold'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['threshold', 'posture', 'harvest', 'hunt', 'philosophy'],
    agentUseDescription: 'Your agent will follow the specified scoring posture — Harvest mode recycles stocks after BaggerBomb for fresh threshold candidates, Hunt mode holds for deeper milestones, and Balanced adapts based on game state.',
  },

  // ══════════════════════════════════════
  // TIER STRATEGY CATEGORY
  // ══════════════════════════════════════

  // TS-01: Volatility-Adjusted Star Cap
  {
    id: 'ts-01',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Keep wild stocks out of Star',
    description: 'Prevents Star tier from being assigned to erratic, high-volatility stocks.',
    hook: 'The 2x multiplier doubles everything — including losses. Keep wild stocks out of Star',
    learnMore: 'The Star tier\'s 2x multiplier is a double-edged sword — it amplifies gains but also losses. When a stock\'s intraday ATR spikes well beyond its historical average, it\'s behaving erratically. This rule caps the maximum tier for such stocks, keeping the powerful multiplier away from unpredictable movers.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'If a stock\'s current intraday ATR exceeds {pct}% of its 14-day average ATR, restrict its maximum tier to {tier}',
        params: {
          pct: { type: 'number', default: 200, min: 150, max: 300, step: 25, unit: '%', label: 'Volatility spike threshold', hint: 'Current ATR as % of 14-day average that triggers tier restriction. Lower = more sensitive to volatility spikes.' },
          tier: { type: 'select', default: 'Support', options: [{ value: 'Support', label: 'Support (safest)' }, { value: 'Core', label: 'Core (moderate)' }], label: 'Maximum tier for volatile stocks', hint: 'What tier to restrict erratic stocks to. Support removes the multiplier entirely.' },
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['tier', 'volatility', 'star-cap', 'risk-reduction'],
    agentUseDescription: 'Your agent will compare each stock\'s current intraday ATR to its 14-day average and restrict the maximum tier assignment for stocks whose volatility exceeds the specified threshold.',
  },

  // TS-02: Multi-Timeframe Conviction Gate
  {
    id: 'ts-02',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Require multi-timeframe agreement',
    description: 'Star tier requires both daily trend AND intraday momentum to be bullish.',
    hook: 'True conviction means every timeframe agrees — if daily and intraday diverge, demote',
    learnMore: 'A stock can look great on the daily chart but be falling apart intraday, or vice versa. This rule requires both the Daily Technical Score and intraday VWAP position to be bullish before Star tier is allowed. If either timeframe breaks down, the stock is demoted — true conviction demands agreement across timeframes.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'A stock is only eligible for Star tier if its Daily Technical Score is above {score} AND price is above daily VWAP. If either breaks, demote to {tier}',
        params: {
          score: { type: 'number', default: 70, min: 50, max: 90, step: 5, unit: '/100', label: 'Technical score minimum', hint: 'Daily Technical Score required for Star eligibility. Higher = stricter quality gate.' },
          tier: { type: 'select', default: 'Support', options: [{ value: 'Support', label: 'Support (strict)' }, { value: 'Core', label: 'Core (moderate)' }], label: 'Demotion tier', hint: 'Where to demote when conviction breaks. Support removes the multiplier entirely.' },
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: 'VWAP / Daily Technical Score',
    kbEntryId: null,
    tags: ['tier', 'multi-timeframe', 'VWAP', 'conviction'],
    agentUseDescription: 'Your agent will only assign Star tier to stocks where both the Daily Technical Score exceeds the threshold and price is above VWAP, demoting immediately if either condition breaks.',
  },

  // TS-03: Free-Ride Threshold Holder
  {
    id: 'ts-03',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Park stalled threshold plays in Support',
    description: 'Stocks near a threshold with stalled momentum are restricted to Support — the bonus is the same regardless of tier.',
    hook: 'Threshold bonuses don\'t care about the multiplier — park stalled stocks in Support and give Star to something moving',
    learnMore: 'Threshold bonuses are flat point amounts — they don\'t get multiplied by tier. So a stock sitting near a threshold with neutral momentum (RSI 40-60) doesn\'t benefit from being in Star or Core. This rule parks those stocks in Support, freeing the multiplier tiers for stocks with real directional momentum.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'If a stock is within {atr} ATR of a positive threshold but its 5-minute RSI is between 40 and 60, restrict to Support tier',
        params: {
          atr: { type: 'number', default: 0.2, min: 0.1, max: 0.4, step: 0.1, unit: 'ATR', label: 'Threshold proximity', hint: 'ATR distance to threshold that defines "near." Wider = more stocks get parked in Support.' },
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: 'RSI (5-minute) / ATR',
    kbEntryId: null,
    tags: ['tier', 'threshold', 'free-ride', 'scoring-asymmetry'],
    agentUseDescription: 'Your agent will restrict stocks to Support tier when they are near a positive threshold but showing neutral RSI momentum, preserving multiplier tiers for stocks with directional movement.',
  },

  // TS-04: Performance-Based Tier Rotation
  {
    id: 'ts-04',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Star goes to the hottest stock',
    description: 'Dynamically promotes the highest-velocity stock to Star — the multiplier is earned, not assumed.',
    hook: 'Star tier should go to your hottest stock right now — not the one you liked best this morning',
    learnMore: 'Your pre-market Star pick may not be the best performer once trading begins. This rule compares P&L velocity across all stocks at regular intervals and promotes the hottest mover to Star. The 2x multiplier is earned through performance, not assumed from overnight analysis.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Every {interval} minutes, compare P&L velocity. If a Core or Support stock outperforms Star over the last {cycles} cycles, swap their tiers',
        params: {
          interval: { type: 'number', default: 30, min: 15, max: 60, step: 15, unit: 'min', label: 'Review interval', hint: 'How often to compare P&L velocity across stocks. Faster = more responsive to momentum shifts.' },
          cycles: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: '', label: 'Outperformance cycles', hint: 'Consecutive cycles a stock must outperform Star before promotion. Higher = more conviction required.' }
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['tier', 'rotation', 'performance', 'meritocracy'],
    agentUseDescription: 'Your agent will compare P&L velocity across all stocks at regular intervals and swap tier assignments when a lower-tier stock consistently outperforms the current Star.',
  },

  // TS-05: Post-Threshold Exhaustion Scale-Out
  {
    id: 'ts-05',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Demote tired Star stocks after a bonus',
    description: 'After a Star stock hits a bonus AND shows overbought signals, demotes it to lock in multiplied gains.',
    hook: 'Your Star stock earned a bonus but looks tired — demote before the reversal eats your 2x gains',
    learnMore: 'When a Star stock triggers a threshold bonus and simultaneously shows overbought RSI, it may be exhausted. Keeping it in Star means the 2x multiplier will amplify the likely pullback. This rule demotes to Support and promotes the strongest Core stock, capturing the bonus while protecting against a reversal.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'When a Star tier stock triggers a positive threshold AND its 5-minute RSI exceeds {rsi}, demote to Support and promote the Core stock with highest MACD trajectory',
        params: {
          rsi: { type: 'number', default: 75, min: 65, max: 85, step: 5, unit: 'RSI', label: 'Overbought RSI trigger', hint: 'RSI level that signals exhaustion after a bonus hit. Lower = more aggressive about demoting tired winners.' }
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: 'RSI (5-minute) / MACD',
    kbEntryId: null,
    tags: ['tier', 'exhaustion', 'scale-out', 'profit-taking'],
    agentUseDescription: 'Your agent will demote Star stocks to Support after they trigger a threshold bonus while showing overbought RSI, promoting the strongest Core stock to Star to protect multiplied gains.',
  },

  // TS-06: Stagnation Demotion
  {
    id: 'ts-06',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Don\'t waste Star on a flatline',
    description: 'Strips the Star multiplier from stocks that have flatlined — the 2x is wasted on a stock that isn\'t moving.',
    hook: 'A 2x multiplier on zero movement is still zero — move the Star to something actually trading',
    learnMore: 'The Star multiplier only matters if the stock is moving. A flatlined stock in Star tier is wasting the most powerful tool in your arsenal. This rule detects stagnation over consecutive evaluation cycles and demotes the stock, promoting the most active alternative to capture the multiplier\'s potential.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'If a Star stock\'s price changes less than {pct}% over {cycles} consecutive evaluation cycles, demote to Support',
        params: {
          pct: { type: 'number', default: 0.1, min: 0.05, max: 0.3, step: 0.05, unit: '%', label: 'Stagnation threshold', hint: 'Maximum price change that counts as flat. Lower = stricter definition of stagnation.' },
          cycles: { type: 'number', default: 3, min: 2, max: 5, step: 1, unit: '', label: 'Stagnation cycles', hint: 'Consecutive flat cycles before demotion. Lower = faster response to dead multiplier.' }
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['tier', 'stagnation', 'dead-multiplier', 'rotation'],
    agentUseDescription: 'Your agent will monitor Star stock price movement across evaluation cycles and demote to Support if the stock flatlines, promoting the most active stock to Star.',
  },

  // TS-07: Penalty Shielding Demotion
  {
    id: 'ts-07',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Demote before the penalty hits',
    description: 'When a Star/Core stock approaches a negative threshold, demotes to Support to halve the continuous P&L bleed.',
    hook: 'The penalty is the same in any tier, but the damage on the way down is halved in Support — demote before it hurts',
    learnMore: 'Negative threshold penalties are flat point deductions regardless of tier, but the continuous P&L bleed on the way down IS multiplied. By demoting to Support before a stock reaches a penalty threshold, you halve the damage from the decline while the penalty itself stays the same. Re-promotion requires the stock to recover significantly.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'When any Star or Core stock comes within {atr} ATR of a negative threshold, demote to Support. Re-promotion requires moving {recovery} ATR away',
        params: {
          atr: { type: 'number', default: 0.3, min: 0.1, max: 0.5, step: 0.1, unit: 'ATR', label: 'Demotion trigger distance', hint: 'ATR distance to negative threshold that triggers tier demotion. Lower = earlier protection.' },
          recovery: { type: 'number', default: 0.5, min: 0.3, max: 0.8, step: 0.1, unit: 'ATR', label: 'Recovery distance for re-promotion', hint: 'ATR distance away from threshold needed to restore tier. Higher = prevents dead cat bounce re-promotion.' }
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['tier', 'penalty', 'shielding', 'demotion', 'meltdown-guard'],
    agentUseDescription: 'Your agent will demote Star or Core stocks to Support when they approach negative thresholds, halving the multiplied P&L bleed. Re-promotion requires the stock to move the specified ATR distance away from the threshold.',
  },

  // TS-08: Thesis Drift Sentinel
  {
    id: 'ts-08',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Catch the hidden divergence',
    description: 'Demotes a stock when price and momentum diverge — new highs with fading MACD is a warning sign.',
    hook: 'When the speedometer drops but the car keeps climbing, the hill is about to win',
    learnMore: 'Bearish divergence — price making new highs while MACD histogram declines — is one of the most reliable reversal warnings in technical analysis. For a Star stock, this divergence is especially dangerous because the 2x multiplier will amplify the coming reversal. This rule catches the divergence early and demotes before the damage is done.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'If a Star stock\'s price makes a new intraday high but its 5-minute MACD histogram is declining, demote to {tier}',
        params: {
          tier: { type: 'select', default: 'Core', options: [{ value: 'Core', label: 'Core (moderate demotion)' }, { value: 'Support', label: 'Support (full demotion)' }], label: 'Divergence demotion tier', hint: 'Where to send a Star stock showing bearish divergence. Support removes the multiplier entirely.' },
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: 'MACD (5-minute)',
    kbEntryId: null,
    tags: ['tier', 'divergence', 'thesis-drift', 'MACD'],
    agentUseDescription: 'Your agent will monitor for bearish divergence between price and MACD histogram on Star stocks, demoting immediately when price makes a new high but MACD histogram is declining.',
  },

  // TS-09: Early-Session Discovery Cap
  {
    id: 'ts-09',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Cap tiers during the morning open',
    description: 'Restricts the Star tier during the first 30-45 minutes to prevent morning whipsaw at 2x.',
    hook: 'The morning open is a guessing game — don\'t let 2x amplify a wrong guess',
    learnMore: 'The first 30-45 minutes of trading are the most volatile and unpredictable period of the day. Assigning Star tier during this window means amplifying the noise at 2x. This rule caps all stocks at a lower tier during the discovery period, then promotes the top performer to Star once the dust settles.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'During the first {minutes} minutes of EARLY phase, restrict maximum tier to {tier}. Promote top performer to Star after',
        params: {
          minutes: { type: 'number', default: 45, min: 15, max: 60, step: 15, unit: 'min', label: 'Discovery period', hint: 'How long to restrict Star tier at the open. Longer = more data before committing the 2x multiplier.' },
          tier: { type: 'select', default: 'Core', options: [{ value: 'Core', label: 'Core (moderate cap)' }, { value: 'Support', label: 'Support (strict cap)' }], label: 'Morning max tier', hint: 'Maximum tier during the discovery period. Core still provides some multiplier benefit.' },
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['tier', 'early-session', 'discovery', 'morning-cap'],
    agentUseDescription: 'Your agent will restrict the maximum tier during the first minutes of the EARLY phase, then promote the top-performing stock to Star once the restriction period ends.',
  },

  // ══════════════════════════════════════
  // TECHNICAL CATEGORY (expansion)
  // ══════════════════════════════════════

  // T-09: VWAP Pullback Entry
  {
    id: 't-09',
    category: 'technical',
    modes: 'both',
    headline: 'Buy the dip to fair value',
    description: 'Prefer stocks that have pulled back to VWAP in an uptrend — buying at institutional fair value.',
    hook: 'Smart money buys the dip to the average price',
    learnMore: 'VWAP represents the average price institutions are paying throughout the day. When an uptrending stock pulls back to VWAP, it\'s offering a discount to institutional fair value. These pullbacks are high-probability entry points because big buyers tend to step in and defend the VWAP level.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks where price has pulled back to within {pct}% of daily VWAP while trend remains bullish',
        params: {
          pct: { type: 'number', default: 0.3, min: 0.1, max: 1.0, step: 0.1, unit: '%', label: 'VWAP pullback tolerance', hint: 'How close to VWAP the price must pull back. Day traders use 0.2%, swing traders use 0.5%.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'VWAP',
    kbEntryId: null,
    tags: ['VWAP', 'pullback', 'institutional', 'entry'],
    agentUseDescription: 'Your agent will prioritize stocks that have pulled back to within the specified percentage of their daily VWAP while maintaining a bullish overall trend.',
  },

  // T-10: VWAP Deviation Fade
  {
    id: 't-10',
    category: 'technical',
    modes: 'both',
    headline: 'Avoid overextended stocks',
    description: 'Avoid stocks that have moved more than 2 standard deviations from VWAP.',
    hook: 'When a stock moves too far too fast from its average, it almost always comes back',
    learnMore: 'Stocks trading far above or below VWAP are statistically likely to revert to the mean. When price moves beyond 2 standard deviations from VWAP, the move is overextended and the risk of a reversal is high. This rule reduces selection priority for these stretched stocks to avoid buying at unsustainable prices.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Reduce selection priority for stocks trading beyond {dev} standard deviations from daily VWAP',
        params: {
          dev: { type: 'number', default: 2.0, min: 1.5, max: 3.0, step: 0.5, unit: 'σ', label: 'Overextension threshold', hint: 'Standard deviations from VWAP before a stock is considered overextended. Higher = more room for winners to run.' }
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'VWAP',
    kbEntryId: null,
    tags: ['VWAP', 'mean-reversion', 'overextended', 'fade'],
    agentUseDescription: 'Your agent will reduce selection priority for stocks trading beyond the specified number of standard deviations from their daily VWAP, avoiding overextended moves.',
  },

  // T-11: Relative Strength Preference
  {
    id: 't-11',
    category: 'technical',
    modes: 'both',
    headline: 'Follow institutional accumulation',
    description: 'Prioritize stocks outperforming SPY — institutional accumulation signal.',
    hook: 'Stocks that hold up when the market drops are being accumulated by institutions',
    learnMore: 'Relative Strength vs. SPY measures how a stock performs compared to the broad market. Stocks with high relative strength are being accumulated by institutions — they hold up during selloffs and lead during rallies. This rule prioritizes market leaders and avoids laggards that can\'t keep up.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks with RS vs SPY score above {score}/22. Avoid stocks below {floor}',
        params: {
          score: { type: 'number', default: 15, min: 10, max: 22, step: 1, unit: '/22', label: 'RS preference score', hint: 'Minimum Relative Strength vs SPY. Momentum riders use 18 (top 20%), swing traders use 17.' },
          floor: { type: 'number', default: 8, min: 0, max: 15, step: 1, unit: '/22', label: 'RS avoidance floor', hint: 'Below this score, the stock is avoided entirely. Higher = stricter quality filter.' }
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'Relative Strength vs. SPY',
    kbEntryId: null,
    tags: ['relative-strength', 'SPY', 'institutional', 'alpha'],
    agentUseDescription: 'Your agent will prefer stocks with Relative Strength vs. SPY scores above the specified threshold and avoid stocks scoring below the floor.',
  },

  // T-12: Bollinger Squeeze Priority
  {
    id: 't-12',
    category: 'technical',
    modes: 'both',
    headline: 'Catch the volatility squeeze',
    description: 'Prioritize stocks with extremely narrow Bollinger Bands — about to explode.',
    hook: 'Quiet stocks are loading up energy — when the squeeze breaks, it\'s usually explosive',
    learnMore: 'When Bollinger Bands contract to their narrowest width, it signals that volatility is being compressed like a spring. The subsequent breakout is often explosive and directional. Combined with above-average volume, a Bollinger squeeze is one of the most reliable breakout setups in technical analysis.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Prioritize stocks where Bollinger Band Width is in lowest {pct}th percentile, especially with volume above {vol}x average',
        params: {
          pct: { type: 'number', default: 10, min: 5, max: 25, step: 5, unit: '%ile', label: 'Squeeze tightness', hint: 'How extreme the compression must be. 10th percentile = tighter than 90% of history.' },
          vol: { type: 'number', default: 1.5, min: 1.0, max: 2.5, step: 0.5, unit: 'x', label: 'Volume confirmation multiplier', hint: 'Volume above this multiple of average confirms the squeeze breakout.' }
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'Bollinger Bands',
    kbEntryId: null,
    tags: ['bollinger', 'squeeze', 'volatility', 'breakout'],
    agentUseDescription: 'Your agent will prioritize stocks with Bollinger Band Width in the lowest percentile of recent history, especially when accompanied by above-average volume signaling an imminent breakout.',
  },

  // T-13: RSI Divergence Warning
  {
    id: 't-13',
    category: 'technical',
    modes: 'both',
    headline: 'Spot hidden momentum shifts',
    description: 'Flags stocks where price and RSI disagree — momentum fading despite price looking strong.',
    hook: 'When momentum fades but price looks strong, a reversal is coming',
    learnMore: 'RSI divergence occurs when price makes a new high but RSI makes a lower high (bearish) or price makes a new low but RSI makes a higher low (bullish). This disconnect between price and momentum is one of the earliest reversal warnings. This rule adjusts conviction based on divergence signals.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Reduce conviction in stocks showing bearish RSI divergence. Increase conviction for bullish divergence with {conviction} enforcement',
        params: {
          conviction: { type: 'select', default: 'moderate', options: [{ value: 'light', label: 'Light touch' }, { value: 'moderate', label: 'Moderate' }, { value: 'strong', label: 'Strong conviction' }], label: 'Rule strength', hint: 'How strictly the agent follows this directive.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'RSI (14-period)',
    kbEntryId: null,
    tags: ['RSI', 'divergence', 'momentum', 'reversal-warning'],
    agentUseDescription: 'Your agent will detect RSI divergence patterns and adjust conviction accordingly — reducing it for bearish divergence and increasing it for bullish divergence.',
  },

  // T-14: Volume Breakout Validation
  {
    id: 't-14',
    category: 'technical',
    modes: 'both',
    headline: 'Demand volume proof on breakouts',
    description: 'Only trust breakouts with a volume spike — moves without volume are fake.',
    hook: 'A breakout without volume is a promise without action — demand proof',
    learnMore: 'A price breakout is only meaningful if it\'s backed by significantly above-average volume. Volume confirms that institutions are participating in the move. Breakouts on normal or low volume are often false signals that quickly reverse. This rule filters out fake breakouts by requiring a volume spike.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Only act on breakouts where volume exceeds {mult}x the 20-day average',
        params: {
          mult: { type: 'number', default: 1.5, min: 1.2, max: 3.0, step: 0.1, unit: 'x', label: 'Volume confirmation threshold', hint: 'Volume must exceed this multiple of 20-day average for breakout to be valid. Higher = fewer but stronger signals.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'Volume (20-day average)',
    kbEntryId: null,
    tags: ['volume', 'breakout', 'validation', 'institutional'],
    agentUseDescription: 'Your agent will only act on breakout signals when volume exceeds the specified multiple of the 20-day average, filtering out false breakouts on thin volume.',
  },

  // T-15: NR7 Compression Alert
  {
    id: 't-15',
    category: 'technical',
    modes: 'both',
    headline: 'Catch the narrowest range breakout',
    description: 'Flag stocks with their narrowest daily range in 7 days — maximum energy compression.',
    hook: 'The quietest day in a week is usually followed by one of the loudest',
    learnMore: 'NR7 (Narrow Range 7) flags stocks trading in their tightest daily range in seven sessions. Like a Bollinger squeeze, this compression signals stored energy that often releases in a powerful directional move. When combined with a strong technical score, NR7 stocks are prime breakout candidates.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Prioritize stocks flagged with NR7 when combined with technical score above {score}',
        params: {
          score: { type: 'number', default: 70, min: 50, max: 90, step: 5, unit: '/100', label: 'Technical score minimum', hint: 'NR7 stocks must also have a strong technical score. Higher = more selective breakout candidates.' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'NR7 (Narrow Range 7)',
    kbEntryId: null,
    tags: ['NR7', 'compression', 'breakout', 'volatility'],
    agentUseDescription: 'Your agent will prioritize NR7-flagged stocks for portfolio selection when they also have a technical score above the specified threshold.',
  },

  // T-16: Multi-Signal Confluence
  {
    id: 't-16',
    category: 'technical',
    modes: 'both',
    headline: 'Require multiple green lights',
    description: 'Require multiple indicators to agree before the agent acts — reduces false signals.',
    hook: 'One green light could be a fluke — three green lights mean the move is real',
    learnMore: 'Any single indicator can give a false signal. But when multiple independent indicators agree — price above VWAP, positive MACD histogram, and RSI in the bullish 50-70 range — the probability of a real move increases dramatically. This rule requires multi-signal confluence before your agent acts.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Only select stocks where at least {count} of these are bullish: price above VWAP, MACD histogram positive, RSI 50-70',
        params: {
          count: { type: 'select', default: '2 of 3', options: [{ value: '2 of 3', label: '2 of 3 (moderate)' }, { value: '3 of 3', label: '3 of 3 (strict)' }], label: 'Confluence requirement', hint: 'How many indicators must agree. 3 of 3 is the strongest filter but may miss some opportunities.' }
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'VWAP / MACD / RSI',
    kbEntryId: null,
    tags: ['confluence', 'multi-indicator', 'quality-filter', 'false-signal'],
    agentUseDescription: 'Your agent will only select stocks where the specified number of indicators are simultaneously bullish, filtering out false signals from single-indicator noise.',
  },

  // ══════════════════════════════════════
  // FUNDAMENTAL CATEGORY (expansion)
  // ══════════════════════════════════════

  // F-07: Earnings Surprise Momentum
  {
    id: 'f-07',
    category: 'fundamental',
    modes: 'both',
    headline: 'Ride the earnings surprise wave',
    description: 'Prefer stocks that consistently beat earnings estimates by large margins.',
    hook: 'Companies that keep beating expectations keep surprising the market',
    learnMore: 'Post-Earnings Announcement Drift (PEAD) is one of the most well-documented market anomalies — stocks that beat earnings estimates tend to keep drifting in the surprise direction for weeks. This rule targets consistent big beaters, where the drift effect is strongest.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Prefer stocks where earnings beat rate exceeds {beat_pct}% and surprise magnitude is in top {decile}',
        params: {
          beat_pct: { type: 'number', default: 75, min: 50, max: 100, step: 5, unit: '%', label: 'Earnings beat rate', hint: 'Minimum percentage of quarters the company must have beaten estimates. Higher = more consistent beaters.' },
          decile: { type: 'select', default: 'Top 20%', options: [{ value: 'Top 10%', label: 'Top 10% (elite)' }, { value: 'Top 20%', label: 'Top 20% (strong)' }, { value: 'Top 30%', label: 'Top 30% (moderate)' }], label: 'Surprise magnitude', hint: 'How large the earnings beats must be relative to peers. Top 10% finds the biggest upside surprises.' }
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Earnings Beat Rate',
    kbEntryId: null,
    tags: ['earnings', 'surprise', 'PEAD', 'momentum'],
    agentUseDescription: 'Your agent will prioritize stocks with high earnings beat rates and surprise magnitudes in the specified top percentile, capturing post-earnings announcement drift.',
  },

  // F-08: Free Cash Flow Quality Filter
  {
    id: 'f-08',
    category: 'fundamental',
    modes: 'both',
    headline: 'Trust the cash, not the math',
    description: 'Prefer stocks with positive free cash flow — the real measure of financial health.',
    hook: 'Earnings can be faked with accounting tricks — cash flow can\'t',
    learnMore: 'Free cash flow is the cash a company generates after capital expenditures — it\'s much harder to manipulate than reported earnings. Companies with high FCF yield (FCF divided by market cap) are generating real money relative to their valuation, making them more resilient and less likely to disappoint.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks where FCF is positive and FCF yield is in top {pct}% of universe',
        params: {
          pct: { type: 'number', default: 25, min: 10, max: 50, step: 5, unit: '%', label: 'FCF yield percentile', hint: 'Top percentile of FCF yield to target. Lower = more selective, finds the best cash generators.' },
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Free Cash Flow Yield',
    kbEntryId: null,
    tags: ['FCF', 'quality', 'cash-flow', 'resilience'],
    agentUseDescription: 'Your agent will prioritize stocks with positive free cash flow and FCF yield in the top percentile of the universe, focusing on companies with genuine financial strength.',
  },

  // F-09: Sector-Adjusted Leverage Safety
  {
    id: 'f-09',
    category: 'fundamental',
    modes: 'both',
    headline: 'Avoid over-leveraged companies',
    description: 'Avoid over-leveraged companies using sector-relative debt limits.',
    hook: 'A bank with 1.5x debt is normal — a tech company with 1.5x debt is a red flag',
    learnMore: 'Different sectors carry different amounts of debt as standard practice — financials are naturally leveraged while tech companies typically are not. This rule compares a company\'s debt-to-equity against its sector average rather than an absolute number, catching truly over-leveraged companies regardless of industry.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Avoid stocks where D/E exceeds {mult}x sector average. Tighten to {tight_mult}x when sentiment is bearish',
        params: {
          mult: { type: 'number', default: 1.25, min: 1.0, max: 2.0, step: 0.25, unit: 'x', label: 'Normal leverage ceiling', hint: 'Maximum D/E as multiple of sector average. Higher = more tolerant of leverage.' },
          tight_mult: { type: 'number', default: 1.0, min: 0.75, max: 1.25, step: 0.25, unit: 'x', label: 'Bearish leverage ceiling', hint: 'Tighter ceiling during bearish sentiment. Lower = more defensive when markets are nervous.' }
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Debt-to-Equity Ratio',
    kbEntryId: null,
    tags: ['leverage', 'debt', 'sector-relative', 'safety'],
    agentUseDescription: 'Your agent will avoid stocks with debt-to-equity ratios exceeding the specified multiple of their sector average, tightening the threshold further during bearish sentiment.',
  },

  // F-10: Sector-Specific Valuation Routing
  {
    id: 'f-10',
    category: 'fundamental',
    modes: 'both',
    headline: 'Use the right valuation yardstick',
    description: 'Uses the right valuation metric for each sector — P/B for banks, P/S for tech, dividend yield for utilities.',
    hook: 'You wouldn\'t judge a fish by how well it climbs a tree — use the right yardstick',
    learnMore: 'P/E ratios are meaningless for unprofitable growth companies. P/B is the standard for banks. P/S works best for high-growth tech. Dividend yield matters most for utilities. This rule routes each stock to the valuation metric that actually matters for its sector, then selects the cheapest stocks on the correct measure.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Evaluate stocks using the metric appropriate to their sector. Prefer stocks in cheapest {pct}% on correct metric',
        params: {
          pct: { type: 'number', default: 40, min: 20, max: 60, step: 10, unit: '%', label: 'Value percentile', hint: 'Prefer stocks in cheapest X% on their sector-appropriate metric. Lower = stricter value filter.' },
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'P/E, P/B, P/S, Dividend Yield',
    kbEntryId: null,
    tags: ['valuation', 'sector-specific', 'P/B', 'P/S', 'dividend'],
    agentUseDescription: 'Your agent will evaluate each stock using the valuation metric most appropriate for its sector and prefer stocks ranking in the cheapest percentile on that metric.',
  },

  // F-11: Revenue Growth Acceleration
  {
    id: 'f-11',
    category: 'fundamental',
    modes: 'both',
    headline: 'Chase accelerating growth',
    description: 'Prefer stocks where the growth rate is accelerating, not just high.',
    hook: 'Acceleration beats speed — growing 10% after 8% is better than 15% after 20%',
    learnMore: 'A company growing revenue at 10% after growing at 8% last quarter is accelerating — the trend is improving. A company growing at 15% after 20% is decelerating — the trend is worsening. Markets reward acceleration because it signals improving business conditions and often leads to upward estimate revisions.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Prefer stocks where current revenue growth rate is at least {bps} basis points higher than previous quarter',
        params: {
          bps: { type: 'number', default: 200, min: 50, max: 500, step: 50, unit: 'bps', label: 'Acceleration threshold', hint: 'Basis points of revenue growth acceleration required. Higher = only the strongest accelerators.' }
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Revenue Growth Rate',
    kbEntryId: null,
    tags: ['revenue', 'acceleration', 'growth', 'second-derivative'],
    agentUseDescription: 'Your agent will prefer stocks showing revenue growth acceleration — where the current quarter\'s growth rate exceeds the previous quarter\'s by the specified number of basis points.',
  },

  // F-12: Analyst Revision Momentum
  {
    id: 'f-12',
    category: 'fundamental',
    modes: 'both',
    headline: 'Follow the analyst upgrades',
    description: 'Prefer stocks where analyst consensus has improved recently.',
    hook: 'When Wall Street upgrades in unison, they know something the market hasn\'t priced in',
    learnMore: 'Analyst estimate revisions are one of the strongest predictors of near-term stock performance. When multiple analysts simultaneously raise their estimates, they\'re responding to new information the market hasn\'t fully priced. This rule captures the revision momentum signal before the broader market catches up.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks where analyst consensus has improved over past {days} days. Avoid deteriorating consensus',
        params: {
          days: { type: 'number', default: 30, min: 14, max: 60, step: 7, unit: 'days', label: 'Revision lookback', hint: 'How far back to check for analyst consensus changes. Shorter = more responsive to recent upgrades.' },
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Analyst Consensus Rating',
    kbEntryId: null,
    tags: ['analyst', 'revision', 'consensus', 'institutional'],
    agentUseDescription: 'Your agent will prefer stocks with improving analyst consensus over the specified period and avoid stocks where consensus is deteriorating.',
  },

  // F-13: Earnings Calendar Risk Management
  {
    id: 'f-13',
    category: 'fundamental',
    modes: 'both',
    headline: 'Manage earnings week risk',
    description: 'Adjusts selection priority based on proximity to earnings dates.',
    hook: 'Earnings week is like a coin flip on steroids',
    learnMore: 'Earnings announcements create massive gap risk — stocks can jump or drop 10%+ overnight. This rule lets you control how your agent handles stocks approaching their earnings date. The default is to reduce priority (avoid the coin flip), but you can override for stocks with high historical beat rates.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Within {days} days of earnings, {action} selection priority. Override if beat rate above {beat_pct}%',
        params: {
          days: { type: 'number', default: 3, min: 1, max: 7, step: 1, unit: 'days', label: 'Earnings proximity window', hint: 'Days before earnings to adjust priority. Larger window = earlier positioning.' },
          action: { type: 'select', default: 'decrease', options: [{ value: 'decrease', label: 'Decrease priority (avoid)' }, { value: 'increase', label: 'Increase priority (lean in)' }, { value: 'neutral', label: 'Neutral (ignore)' }], label: 'Default earnings action', hint: 'How to handle stocks approaching earnings. Decrease avoids the gap risk, increase bets on the report.' },
          beat_pct: { type: 'number', default: 80, min: 60, max: 100, step: 5, unit: '%', label: 'Override beat rate', hint: 'Beat rate above which the default action is overridden. Only relevant if default is decrease.' }
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: 'Earnings Calendar',
    kbEntryId: null,
    tags: ['earnings', 'calendar', 'gap-risk', 'timing'],
    agentUseDescription: 'Your agent will adjust selection priority for stocks approaching earnings dates based on the specified action, with an override for stocks exceeding the beat rate threshold.',
  },

  // ══════════════════════════════════════
  // RISK CATEGORY (expansion)
  // ══════════════════════════════════════

  // R-06: Sector Concentration Cap
  {
    id: 'r-06',
    category: 'risk',
    modes: 'both',
    headline: 'Cap sector exposure',
    description: 'Limits the number of stocks from any single sector.',
    hook: 'When one sector tanks, you don\'t want half your portfolio going with it',
    learnMore: 'Sector concentration is one of the most common portfolio killers. If three of your five stocks are tech and tech drops 5%, your whole portfolio suffers. This rule caps the maximum number of stocks from any single sector, forcing diversification that protects you from sector-specific shocks.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Limit portfolio to maximum of {max} stocks from any single sector',
        params: {
          max: { type: 'number', default: 2, min: 1, max: 3, step: 1, unit: '', label: 'Maximum stocks per sector', hint: 'Hard cap on stocks from any single sector. Lower = more diversified but less ability to concentrate in hot sectors.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['sector', 'concentration', 'diversification', 'constraint'],
    agentUseDescription: 'Your agent will enforce a maximum number of stocks from any single sector when building and rebalancing the portfolio.',
  },

  // R-07: Sub-Sector Correlation Guard
  {
    id: 'r-07',
    category: 'risk',
    modes: 'both',
    headline: 'Avoid hidden correlation traps',
    description: 'Avoids holding multiple stocks from the same sub-industry.',
    hook: 'Three chip stocks isn\'t diversification — it\'s a triple bet on semiconductors',
    learnMore: 'Sector diversification isn\'t enough — two semiconductor stocks in different ETF sectors still move together. This rule goes deeper, treating stocks from the same sub-industry as highly correlated and limiting overlap. True diversification means different business drivers, not just different ticker symbols.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Avoid holding more than {max} stock from the same sub-industry',
        params: {
          max: { type: 'number', default: 1, min: 1, max: 2, step: 1, unit: '', label: 'Sub-industry limit', hint: 'Maximum stocks from the same sub-industry. 1 ensures true diversification within sectors.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['sub-sector', 'correlation', 'proxy', 'concentration'],
    agentUseDescription: 'Your agent will limit holdings from the same sub-industry to the specified maximum, preventing hidden correlation from undermining portfolio diversification.',
  },

  // R-08: Market Cap Barbell
  {
    id: 'r-08',
    category: 'risk',
    modes: 'both',
    headline: 'Mix stability with explosiveness',
    description: 'Ensures mix of large-cap stability and small-cap volatility.',
    hook: 'Big stocks keep you alive, small stocks make you rich — you need both',
    learnMore: 'Large-cap stocks provide stability and predictable scoring, while small-caps deliver the explosive moves needed to hit high thresholds. A barbell strategy combines both extremes — large-cap anchors that protect your baseline score and small-cap satellites that provide upside potential.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Maintain at least {anchors} large-cap stocks and no more than {sails} small-cap stocks',
        params: {
          anchors: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: '', label: 'Large-cap anchors', hint: 'Minimum number of stable large-cap stocks. More anchors = more baseline protection.' },
          sails: { type: 'number', default: 2, min: 1, max: 3, step: 1, unit: '', label: 'Small-cap limit', hint: 'Maximum number of volatile small-cap stocks. Fewer = less explosive risk.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: 'Market Capitalization',
    kbEntryId: null,
    tags: ['market-cap', 'barbell', 'stability', 'anchor'],
    agentUseDescription: 'Your agent will maintain a minimum number of large-cap anchor stocks and cap the number of small-cap stocks, ensuring a barbell mix of stability and explosive potential.',
  },

  // R-09: Portfolio Drawdown Circuit Breaker
  {
    id: 'r-09',
    category: 'risk',
    modes: 'both',
    headline: 'Switch to survival mode',
    description: 'Shifts to defensive mode if total portfolio drops below a threshold.',
    hook: 'When the whole portfolio is bleeding, stop trying to be a hero',
    learnMore: 'When your total portfolio drawdown exceeds a critical level, something has gone systemically wrong — the market regime may have shifted or your strategy is mismatched with conditions. This circuit breaker shifts to defensive mode, restricting new swaps to low-volatility stocks only until conditions stabilize.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'If total portfolio drawdown exceeds {pct}%, shift to defensive mode with low-ATR stocks only',
        params: {
          pct: { type: 'number', default: 10, min: 5, max: 20, step: 5, unit: '%', label: 'Drawdown trigger', hint: 'Portfolio loss percentage that triggers survival mode. Lower = earlier defensive shift.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['drawdown', 'circuit-breaker', 'defensive', 'survival'],
    agentUseDescription: 'Your agent will shift to defensive mode when total portfolio drawdown exceeds the specified percentage, restricting new swaps to low-ATR stocks only.',
  },

  // R-10: Volatility Regime Scaling
  {
    id: 'r-10',
    category: 'risk',
    modes: 'both',
    headline: 'De-risk in volatile markets',
    description: 'Reduces high-ATR exposure when the broad market is in a volatile regime.',
    hook: 'When the whole market is panicking, even good stocks get dragged down',
    learnMore: 'In high-volatility market regimes, correlations spike and even fundamentally strong stocks get dragged down. This rule detects elevated market volatility and restricts the portfolio to lower-ATR stocks, reducing exposure to the wild swings that can devastate a portfolio in chaotic conditions.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'When market volatility is elevated, restrict portfolio to stocks with ATR below {pct}% of price',
        params: {
          pct: { type: 'number', default: 3.0, min: 1.5, max: 5.0, step: 0.5, unit: '%', label: 'ATR/price cap', hint: 'Maximum ATR as percentage of price during volatile markets. Lower = only the calmest stocks allowed.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['volatility', 'regime', 'SPY-ATR', 'de-risk'],
    agentUseDescription: 'Your agent will restrict the portfolio to stocks with ATR below the specified percentage of price when broad market volatility is elevated.',
  },

  // R-11: Crypto Containment Protocol
  {
    id: 'r-11',
    category: 'risk',
    modes: 'clash',
    headline: 'Keep crypto on a leash',
    description: 'Manages the mandatory crypto asset to prevent portfolio-destroying volatility.',
    hook: 'Crypto can make or break your battle — keep it on a leash',
    learnMore: 'Crypto assets are mandatory in the portfolio but carry extreme volatility. An uncontrolled crypto position in Star tier can single-handedly swing your score by 50+ points. This rule restricts crypto to a lower tier and limits exposure to major coins during portfolio drawdowns.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Restrict mandatory crypto to {tier} tier. During drawdowns, limit to major coins only',
        params: {
          tier: { type: 'select', default: 'Support', options: [{ value: 'Support', label: 'Support (safest)' }, { value: 'Core', label: 'Core (moderate)' }, { value: 'Any', label: 'Any tier (unrestricted)' }], label: 'Crypto tier cap', hint: 'Maximum tier for the mandatory crypto asset. Support removes the multiplier entirely.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['crypto', 'containment', 'volatility', 'mandatory-asset'],
    agentUseDescription: 'Your agent will restrict the mandatory crypto asset to the specified tier and limit to major coins only during portfolio drawdowns.',
  },

  // R-12: Bearish Sector Exclusion
  {
    id: 'r-12',
    category: 'risk',
    modes: 'both',
    headline: 'Avoid sectors in the news doghouse',
    description: 'Excludes stocks in sectors with negative FantasyTimes sentiment.',
    hook: 'Don\'t fight the news — if FantasyTimes says a sector is in trouble, listen',
    learnMore: 'FantasyTimes sentiment reflects the current news narrative around each sector. Fighting negative sentiment is a losing battle — even fundamentally strong stocks get dragged down when their sector is under fire. This rule excludes stocks from sectors with bearish or worse sentiment, keeping your portfolio aligned with the prevailing narrative.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Avoid buying stocks in sectors where FantasyTimes sentiment is {sentiment} or worse',
        params: {
          sentiment: { type: 'select', default: 'bearish', options: [{ value: 'bearish', label: 'Bearish (avoid negative)' }, { value: 'neutral', label: 'Neutral (avoid non-bullish)' }], label: 'Sentiment exclusion floor', hint: 'Minimum sentiment to allow buying. Neutral is stricter — only buys into bullish sectors.' },
        },
        category: 'risk'
      }
    ],
    relatedIndicator: 'FantasyTimes Sentiment',
    kbEntryId: null,
    tags: ['sentiment', 'sector', 'exclusion', 'news-aware'],
    agentUseDescription: 'Your agent will exclude stocks from sectors where FantasyTimes sentiment is at or below the specified level, avoiding sectors under negative news pressure.',
  },

  // ══════════════════════════════════════
  // ALLOCATION CATEGORY (expansion)
  // ══════════════════════════════════════

  // A-05: Volatility Barbell
  {
    id: 'a-05',
    category: 'allocation',
    modes: 'both',
    headline: 'Build a barbell portfolio',
    description: 'Split portfolio between high-ATR explosive stocks and low-ATR anchors — avoid the moderate middle.',
    hook: 'Safe stocks keep you in the game, explosive stocks win it — need both extremes',
    learnMore: 'A barbell portfolio combines two extremes: low-ATR anchor stocks that protect your baseline score and high-ATR rockets that chase explosive threshold bonuses. The boring middle ground — moderate stocks that neither protect nor explode — is the worst of both worlds in a single-day battle.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Build portfolio with at least {anchors} low-ATR anchors (below {low_pct}%) and {rockets} high-ATR rockets (above {high_pct}%)',
        params: {
          anchors: { type: 'number', default: 2, min: 1, max: 3, step: 1, unit: '', label: 'Low-ATR anchors', hint: 'Minimum stable, low-volatility stocks for baseline protection.' },
          rockets: { type: 'number', default: 2, min: 1, max: 3, step: 1, unit: '', label: 'High-ATR rockets', hint: 'Number of explosive, high-volatility stocks for threshold-chasing upside.' },
          low_pct: { type: 'number', default: 1.5, min: 0.5, max: 2.5, step: 0.5, unit: '%', label: 'Anchor ATR ceiling', hint: 'Maximum ATR % of price for anchor stocks. Lower = calmer anchors.' },
          high_pct: { type: 'number', default: 3.5, min: 2.5, max: 5.0, step: 0.5, unit: '%', label: 'Rocket ATR floor', hint: 'Minimum ATR % of price for rocket stocks. Higher = more explosive picks.' }
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: 'ATR (Average True Range)',
    kbEntryId: null,
    tags: ['barbell', 'volatility', 'anchors', 'explosive'],
    agentUseDescription: 'Your agent will build a barbell portfolio with the specified number of low-ATR anchor stocks and high-ATR explosive stocks, avoiding moderate-volatility stocks in between.',
  },

  // A-06: Momentum Tilt
  {
    id: 'a-06',
    category: 'allocation',
    modes: 'both',
    headline: 'Lean into market leaders',
    description: 'Overweight stocks with the highest relative strength — lean into the market leaders.',
    hook: 'Stocks beating the market today tend to keep beating it tomorrow — lean into leaders',
    learnMore: 'Momentum is the most persistent factor in equity markets — stocks with high relative strength tend to continue outperforming. This rule tilts your portfolio toward market leaders by requiring minimum RS scores for selection and reserving Star and Core tiers for the strongest performers.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks with RS vs SPY above {rs_min}/22. Star and Core only for top {pct}% RS',
        params: {
          rs_min: { type: 'number', default: 15, min: 10, max: 22, step: 1, unit: '/22', label: 'Minimum RS score', hint: 'Minimum Relative Strength vs SPY for selection. Higher = only the strongest market leaders.' },
          pct: { type: 'number', default: 25, min: 10, max: 50, step: 5, unit: '%', label: 'Top RS for premium tiers', hint: 'Only stocks in the top X% of RS rankings get Star or Core. Lower = more exclusive.' }
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: 'Relative Strength vs. SPY',
    kbEntryId: null,
    tags: ['momentum', 'relative-strength', 'leaders', 'overweight'],
    agentUseDescription: 'Your agent will prefer stocks with RS vs. SPY above the minimum threshold and restrict Star and Core tier assignments to stocks in the top percentile of RS rankings.',
  },

  // A-07: Defensive/Growth Balance
  {
    id: 'a-07',
    category: 'allocation',
    modes: 'both',
    headline: 'Balance defense and offense',
    description: 'Ensure a mix of high-ATR growth engines and high-fundamental-score defensive anchors.',
    hook: 'Growth stocks chase thresholds, defensive stocks protect the score — balance your appetite',
    learnMore: 'Growth stocks with high ATR chase the big threshold bonuses, while defensive stocks with strong fundamentals protect your baseline score from collapsing. The right balance depends on your risk appetite — more defensive stocks for safety, more growth stocks for upside.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Maintain at least {defensive} high-fundamental-score stocks and up to {growth} high-ATR growth stocks',
        params: {
          defensive: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: '', label: 'Defensive stock count', hint: 'Minimum high-fundamental-score stocks for baseline protection.' },
          growth: { type: 'number', default: 3, min: 2, max: 4, step: 1, unit: '', label: 'Growth stock limit', hint: 'Maximum high-ATR growth stocks. More = higher upside but more risk.' },
          fund_min: { type: 'number', default: 70, min: 50, max: 90, step: 10, unit: '/100', label: 'Fundamental score floor', hint: 'Minimum composite fundamental score for defensive picks. Higher = stricter quality.' }
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: 'Fundamental Composite Score',
    kbEntryId: null,
    tags: ['defensive', 'growth', 'balance', 'quality'],
    agentUseDescription: 'Your agent will maintain a minimum number of high-fundamental-score defensive stocks and cap the number of high-ATR growth stocks, balancing protection and upside.',
  },

  // A-08: Sentiment-Driven Sector Rotation
  {
    id: 'a-08',
    category: 'allocation',
    modes: 'both',
    headline: 'Ride the sentiment tailwinds',
    description: 'Overweight sectors with positive FantasyTimes sentiment — ride the narrative tailwinds.',
    hook: 'When the news cycle turns on a sector, the smart money moves first — move with it',
    learnMore: 'FantasyTimes sentiment reflects the current news narrative for each sector. Sectors with bullish sentiment benefit from institutional buying pressure as the narrative drives capital flows. This rule overweights favored sectors and rebalances when sentiment shifts, keeping your portfolio aligned with the dominant market story.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Overweight sectors where FantasyTimes sentiment is {sentiment} or better',
        params: {
          sentiment: { type: 'select', default: 'bullish', options: [{ value: 'bullish', label: 'Bullish only' }, { value: 'neutral or better', label: 'Neutral or better' }], label: 'Sentiment threshold', hint: 'Minimum FantasyTimes sentiment for sector overweighting. Neutral is less selective but catches more sectors.' },
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: 'FantasyTimes Sentiment',
    kbEntryId: null,
    tags: ['sentiment', 'sector-rotation', 'FantasyTimes', 'macro'],
    agentUseDescription: 'Your agent will overweight sectors with FantasyTimes sentiment at or above the specified level and rebalance when sentiment changes.',
  },

  // A-09: Complementary Bench Strategy
  {
    id: 'a-09',
    category: 'allocation',
    modes: 'clash',
    headline: 'Build a versatile bench',
    description: 'Build the bench to complement the active roster — different sectors, different styles.',
    hook: 'Your bench isn\'t a backup squad — it\'s a toolkit for when the market changes',
    learnMore: 'A bench that mirrors your active roster is useless — when your picks are struggling, your bench will be too. This rule builds a complementary bench with different sector exposure and high-ATR breakout candidates, giving you real optionality when market conditions shift.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'At least {complement} bench stocks from different sectors. Include {high_upside} high-ATR breakout candidates',
        params: {
          complement: { type: 'number', default: 2, min: 1, max: 3, step: 1, unit: '', label: 'Cross-sector bench stocks', hint: 'Minimum bench stocks from different sectors than the active roster. Higher = more diversified swap options.' },
          high_upside: { type: 'number', default: 1, min: 0, max: 2, step: 1, unit: '', label: 'High-ATR bench candidates', hint: 'Number of explosive breakout candidates to keep on the bench for momentum swaps.' }
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['bench', 'complement', 'diversification', 'toolkit'],
    agentUseDescription: 'Your agent will build a bench with stocks from different sectors than the active roster and include high-ATR breakout candidates for swap optionality.',
  },

  // A-10: Economic Calendar Positioning
  {
    id: 'a-10',
    category: 'allocation',
    modes: 'both',
    headline: 'Position for economic events',
    description: 'Tilt the portfolio toward event-sensitive sectors ahead of major economic announcements.',
    hook: 'Big economic announcements move entire sectors — be positioned before the news drops',
    learnMore: 'Major economic events like FOMC decisions, CPI releases, and jobs reports create predictable sector-level moves. Rate-sensitive sectors react to Fed decisions, consumer sectors to CPI data, and so on. This rule tilts your portfolio toward the sectors historically most affected by upcoming events.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'When high-impact event is within {days} days, tilt toward historically sensitive sectors',
        params: {
          days: { type: 'number', default: 2, min: 1, max: 5, step: 1, unit: 'days', label: 'Event proximity window', hint: 'Days before a high-impact event to start positioning. Larger window = earlier preparation.' },
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: 'Economic Calendar',
    kbEntryId: null,
    tags: ['economic-calendar', 'FOMC', 'CPI', 'macro-positioning'],
    agentUseDescription: 'Your agent will tilt portfolio allocation toward sectors historically sensitive to upcoming high-impact economic events within the specified time window.',
  },

  // TV-01: RSI Momentum Zone
  {
    id: 'tv-01',
    category: 'technical',
    modes: 'both',
    headline: 'RSI Momentum Zone',
    description: 'Targets stocks in the RSI sweet spot — strong momentum without overextension. Unlike the oversold bounce, this rule seeks stocks already moving.',
    hook: 'The best stocks aren\'t oversold or overbought — they\'re in the power zone where momentum is building',
    learnMore: 'RSI is often used to find oversold bounces, but quantitative research shows it works even better as a trend-following tool. Stocks with RSI between 50 and 70 are in a momentum sweet spot — strong enough to confirm a trend, but not so stretched that a pullback is imminent. This rule targets that power zone and avoids both weak (below 40) and overextended (above 75) stocks.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks with 14-day RSI between {low} and {high}. This zone indicates building momentum without overextension. Deprioritize stocks with RSI below {weak} (no momentum) or above {stretched} (overextended)',
        params: {
          low: { type: 'number', default: 50, min: 40, max: 60, step: 5, unit: '', label: 'Zone floor', hint: 'RSI above this = momentum confirmed' },
          high: { type: 'number', default: 70, min: 60, max: 80, step: 5, unit: '', label: 'Zone ceiling', hint: 'RSI above this = getting stretched' },
          weak: { type: 'number', default: 40, min: 25, max: 50, step: 5, unit: '', label: 'Weak threshold', hint: 'Below this = no momentum' },
          stretched: { type: 'number', default: 75, min: 65, max: 85, step: 5, unit: '', label: 'Stretched threshold', hint: 'Above this = overextended' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'RSI (14-period)',
    kbEntryId: null,
    tags: ['RSI', 'momentum', 'zone', 'trend-following', 'tradingview'],
    agentUseDescription: 'Your agent will prioritize stocks with RSI in the 50-70 momentum zone and deprioritize stocks with weak or overextended RSI readings.',
  },

  // TV-02: MACD Histogram Acceleration
  {
    id: 'tv-02',
    category: 'technical',
    modes: 'both',
    headline: 'MACD Histogram Acceleration',
    description: 'Focuses on whether the MACD histogram is growing or shrinking. A growing histogram means momentum is accelerating — the move is getting stronger.',
    hook: 'A positive MACD is good, but a GROWING MACD is better — acceleration beats direction',
    learnMore: 'Most traders only check whether MACD is positive or negative. But the real edge is in the histogram\'s rate of change — is it growing or shrinking? A growing histogram means the gap between the MACD line and signal line is widening, which indicates accelerating momentum. When the histogram starts shrinking, even if still positive, the move is losing steam and a reversal may be near.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Prefer stocks where the MACD histogram is positive AND growing (current bar larger than previous). When the histogram starts shrinking, even if still positive, {action}',
        params: {
          action: { type: 'select', default: 'reduce tier', options: [
            { value: 'reduce tier', label: 'Reduce tier' },
            { value: 'flag for swap', label: 'Flag for swap' },
            { value: 'hold but monitor', label: 'Hold but monitor' },
          ], label: 'On deceleration', hint: 'What to do when momentum peaks' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'MACD Histogram',
    kbEntryId: null,
    tags: ['MACD', 'histogram', 'acceleration', 'momentum', 'tradingview'],
    agentUseDescription: 'Your agent will favor stocks with a growing MACD histogram and take the specified action when histogram momentum decelerates.',
  },

  // TV-03: MACD Zero-Line Bounce
  {
    id: 'tv-03',
    category: 'technical',
    modes: 'clash',
    headline: 'MACD Zero-Line Bounce',
    description: 'In an uptrend, MACD often pulls back toward zero then bounces. This catches the momentum reset before the next leg up.',
    hook: 'When momentum cools to neutral in an uptrend, the next surge is loading — buy the pause',
    learnMore: 'In a healthy uptrend, momentum doesn\'t stay at maximum forever — it naturally oscillates. When the MACD histogram pulls back toward zero, many traders panic and sell. But if the daily trend structure (technical score) remains healthy, this pause is actually the momentum resetting before the next leg higher. This rule prevents your agent from mistaking a normal momentum pullback for a trend reversal.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'When a stock\'s MACD histogram is near zero but the daily technical score is above {score}, treat this as a momentum pause in an uptrend — increase hold patience to {minutes} minutes. This is a buying opportunity, not an exit signal',
        params: {
          score: { type: 'number', default: 60, min: 45, max: 80, step: 5, unit: '/100', label: 'Min daily score', hint: 'Confirms the trend is still healthy' },
          minutes: { type: 'number', default: 120, min: 60, max: 240, step: 15, unit: 'min', label: 'Hold patience', hint: 'How long to wait for momentum to resume' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'MACD Histogram',
    kbEntryId: null,
    tags: ['MACD', 'zero-line', 'pullback', 'trend-continuation', 'tradingview'],
    agentUseDescription: 'Your agent will hold through MACD zero-line pauses when the daily technical score confirms the uptrend is intact, increasing hold patience instead of swapping.',
  },

  // TV-04: VWAP Reclaim Entry
  {
    id: 'tv-04',
    category: 'technical',
    modes: 'clash',
    headline: 'VWAP Reclaim Entry',
    description: 'Targets stocks that dipped below VWAP and recovered back above it. The reclaim signals buyers stepping in at institutional fair value.',
    hook: 'A stock that fights its way back above VWAP just proved the buyers are stronger than the sellers',
    learnMore: 'VWAP (Volume-Weighted Average Price) represents the average price institutions paid throughout the day. When a stock dips below VWAP and then recovers above it, it signals that buyers stepped in at the institutional fair value level and overwhelmed sellers. This reclaim pattern is one of the most reliable intraday reversal signals because it demonstrates genuine buying pressure at a meaningful price level.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'On the bench, prioritize stocks that have recently reclaimed VWAP from below (currently above VWAP with a VWAP deviation above {dev}% after previously being negative). This reversal pattern signals institutional buying',
        params: {
          dev: { type: 'number', default: 0.3, min: 0.1, max: 1.0, step: 0.1, unit: '%', label: 'Min deviation above VWAP', hint: 'How far above VWAP to confirm reclaim' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'VWAP',
    kbEntryId: null,
    tags: ['VWAP', 'reclaim', 'reversal', 'institutional', 'tradingview'],
    agentUseDescription: 'Your agent will prioritize bench stocks showing a VWAP reclaim pattern — dipping below and recovering above VWAP with sufficient deviation to confirm the reversal.',
  },

  // TV-05: Squeeze Direction Filter
  {
    id: 'tv-05',
    category: 'technical',
    modes: 'both',
    headline: 'Squeeze Direction Filter',
    description: 'When a Bollinger Band squeeze is detected, use MACD histogram direction to predict breakout direction. Positive histogram = likely upward breakout.',
    hook: 'A squeeze tells you WHEN the move is coming — MACD tells you WHICH WAY',
    learnMore: 'A Bollinger Band squeeze occurs when the bands contract tightly around price, indicating low volatility that typically precedes a big move. The problem is that squeezes break in both directions — up or down. By combining the squeeze detection with MACD histogram direction, you can filter for squeezes most likely to break upward. This is the core concept behind LazyBear\'s Squeeze Momentum Indicator, the most popular community script on TradingView.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'When a stock is in a Bollinger squeeze (bandwidth below {bw}%), only select it if the MACD histogram is {direction}. A squeeze with negative momentum predicts a downward breakout — avoid',
        params: {
          bw: { type: 'number', default: 4, min: 2, max: 8, step: 1, unit: '%', label: 'Squeeze bandwidth', hint: 'Lower = tighter squeeze = bigger expected move' },
          direction: { type: 'select', default: 'positive and growing', options: [
            { value: 'positive', label: 'Positive (any)' },
            { value: 'positive and growing', label: 'Positive & growing' },
            { value: 'turning positive', label: 'Turning positive from negative' },
          ], label: 'Required MACD state', hint: 'How strong must the directional signal be' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'Bollinger Bands / MACD',
    kbEntryId: null,
    tags: ['bollinger', 'squeeze', 'MACD', 'direction', 'LazyBear', 'tradingview'],
    agentUseDescription: 'Your agent will only select stocks in a Bollinger squeeze when the MACD histogram confirms a likely upward breakout direction, filtering out bearish squeezes.',
  },

  // TV-06: Bollinger Lower Band Entry
  {
    id: 'tv-06',
    category: 'technical',
    modes: 'both',
    headline: 'Bollinger Lower Band Entry',
    description: 'When price touches or penetrates the lower Bollinger Band, the stock is stretched below its statistical mean. Expect a bounce back toward the middle band.',
    hook: 'Stocks that touch the lower band are statistically stretched — the rubber band usually snaps back',
    learnMore: 'Bollinger Bands plot two standard deviations above and below a 20-period moving average. When price reaches the lower band, it\'s statistically at an extreme — roughly 95% of price action occurs within the bands. While a stock can "ride the band" in a strong downtrend, in normal conditions a touch of the lower band represents a high-probability mean reversion opportunity back toward the middle band (20 SMA).',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Look for stocks where Bollinger percentB is below {percentB}. These are trading near or below the lower band and are mean-reversion candidates. Set exit expectation at the middle band (20 SMA). {tierRule}',
        params: {
          percentB: { type: 'number', default: 0.1, min: 0.0, max: 0.3, step: 0.1, unit: '', label: 'Max percentB', hint: '0 = at the lower band, negative = below it' },
          tierRule: { type: 'select', default: 'Support or Core only', options: [
            { value: 'Support or Core only', label: 'Support/Core only (conservative)' },
            { value: 'Core tier', label: 'Core tier (moderate)' },
            { value: 'Any tier', label: 'Any tier (aggressive)' },
          ], label: 'Tier restriction', hint: 'Mean reversion upside is defined, not explosive' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'Bollinger Bands',
    kbEntryId: null,
    tags: ['bollinger', 'lower-band', 'mean-reversion', 'oversold', 'tradingview'],
    agentUseDescription: 'Your agent will target stocks trading near or below the lower Bollinger Band as mean-reversion candidates, with tier restrictions reflecting the defined upside.',
  },

  // TV-07: Intraday Range Position
  {
    id: 'tv-07',
    category: 'technical',
    modes: 'clash',
    headline: 'Intraday Range Position',
    description: 'Stocks that close near the low of their intraday range often bounce the next session. This is the IBS (Internal Bar Strength) concept from quantitative research.',
    hook: 'A stock beaten down to its daily low is spring-loaded for a morning bounce — this is one of the most backtested edges in quant trading',
    learnMore: 'Internal Bar Strength (IBS) measures where a stock\'s closing price falls within its intraday high-low range. Research across decades of data shows that stocks closing near their daily low tend to bounce the following session, while stocks closing near their high tend to pull back. This mean-reversion effect is one of the most robust edges in quantitative finance and works particularly well on liquid, large-cap stocks.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'When a stock closes in the bottom {pct}% of its intraday range, increase hold patience to {minutes} minutes. A morning recovery is statistically likely. Do not swap a stock near its daily low unless it breaches a Bust threshold',
        params: {
          pct: { type: 'number', default: 20, min: 10, max: 40, step: 5, unit: '%', label: 'Bottom range %', hint: 'Lower = more extreme = higher bounce probability' },
          minutes: { type: 'number', default: 90, min: 45, max: 180, step: 15, unit: 'min', label: 'Bounce patience', hint: 'How long to wait for the recovery' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['IBS', 'range', 'bounce', 'mean-reversion', 'quant', 'tradingview'],
    agentUseDescription: 'Your agent will increase hold patience for stocks closing near the bottom of their intraday range, giving the statistically likely morning bounce time to develop.',
  },

  // TV-08: Low Volume Pullback Hold
  {
    id: 'tv-08',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Low Volume Pullback Hold',
    description: 'In an uptrend, pullbacks on below-average volume are healthy — they show a lack of selling pressure. The trend resumes when volume returns.',
    hook: 'If nobody\'s actually selling, the dip isn\'t real — low volume pullbacks in uptrends are gifts',
    learnMore: 'Volume tells you the conviction behind a price move. When a stock in an uptrend pulls back on below-average volume, it means there\'s no real selling pressure — the pullback is caused by a temporary absence of buyers, not an influx of sellers. These low-volume dips typically resolve when normal buying volume returns. Conversely, if volume INCREASES during a pullback, institutional sellers are participating and the dip may be real.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'When a stock in an uptrend (daily technical score above {score}) pulls back on below-average volume (volume ratio below {vol}x), increase hold patience to {minutes} minutes. Only swap if volume INCREASES during the pullback',
        params: {
          score: { type: 'number', default: 55, min: 40, max: 75, step: 5, unit: '/100', label: 'Min trend score', hint: 'Confirms the stock is still in an uptrend' },
          vol: { type: 'number', default: 0.8, min: 0.5, max: 1.0, step: 0.1, unit: 'x', label: 'Max volume ratio', hint: 'Below this = low volume = healthy pullback' },
          minutes: { type: 'number', default: 90, min: 45, max: 180, step: 15, unit: 'min', label: 'Extra patience', hint: 'How long to hold during the low-volume dip' },
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'Volume / ATR',
    kbEntryId: null,
    tags: ['volume', 'pullback', 'hold', 'trend', 'patience', 'tradingview'],
    agentUseDescription: 'Your agent will hold through pullbacks on low volume in uptrending stocks, only considering a swap if volume increases during the decline.',
  },

  // TV-09: Smart Money Liquidity Sweep
  {
    id: 'tv-09',
    category: 'mid_battle',
    modes: 'clash',
    headline: 'Smart Money Liquidity Sweep',
    description: 'When a stock drops sharply on a volume spike then immediately recovers, institutional players swept stop-losses to accumulate at a lower price. Hold through this pattern.',
    hook: 'That scary drop and instant recovery? That was smart money shaking out weak hands to buy cheaper',
    learnMore: 'Liquidity sweeps are a core concept in Smart Money / ICT (Inner Circle Trader) methodology. Large institutions need to accumulate shares without driving the price up, so they deliberately push price through a support level to trigger stop-loss orders. This creates a burst of selling liquidity that they absorb. The telltale sign: a sharp drop on elevated volume followed by a quick recovery back above VWAP. If your stock shows this pattern, the "dip" was engineered — hold through it.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'When a stock drops more than {atr}x ATR intraday on elevated volume (above {vol}x average) but then recovers above VWAP within {minutes} minutes, do NOT swap — this is a liquidity sweep pattern. Increase hold conviction',
        params: {
          atr: { type: 'number', default: 0.5, min: 0.3, max: 1.0, step: 0.1, unit: 'x ATR', label: 'Drop threshold', hint: 'How far the stock must drop to trigger this pattern' },
          vol: { type: 'number', default: 1.5, min: 1.2, max: 2.5, step: 0.1, unit: 'x avg', label: 'Volume spike', hint: 'Volume must be elevated for a true sweep' },
          minutes: { type: 'number', default: 60, min: 30, max: 120, step: 15, unit: 'min', label: 'Recovery window', hint: 'How quickly it must recover to confirm the pattern' },
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'VWAP / Volume',
    kbEntryId: null,
    tags: ['smart-money', 'ICT', 'liquidity', 'sweep', 'institutional', 'tradingview'],
    agentUseDescription: 'Your agent will recognize liquidity sweep patterns — sharp drops on volume followed by VWAP recovery — and hold through them instead of panic-swapping.',
  },

  // TV-10: Earnings + Technical Confluence
  {
    id: 'tv-10',
    category: 'fundamental',
    modes: 'both',
    headline: 'Earnings + Technical Confluence',
    description: 'Stocks with both strong earnings history AND bullish technicals have dual confirmation. Fundamental quality backs the technical momentum.',
    hook: 'Great earnings AND great technicals? That\'s the market saying "this stock deserves to be here" — double conviction',
    learnMore: 'The strongest stock picks have both fundamental quality and technical momentum. A stock with great earnings but weak technicals may be a value trap — the market knows something the numbers don\'t show. A stock with strong technicals but weak fundamentals may be a speculative bubble. When both signals agree, you have dual confirmation that the stock\'s price action is backed by real business performance.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks where the fundamental composite score is above {fund_score} AND the daily technical score is above {tech_score}. Stocks meeting both criteria are eligible for {tier} tier. Stocks meeting only one are restricted to Core or below',
        params: {
          fund_score: { type: 'number', default: 65, min: 40, max: 85, step: 5, unit: '/100', label: 'Min fundamental score', hint: 'From peerRankings composite' },
          tech_score: { type: 'number', default: 60, min: 40, max: 80, step: 5, unit: '/100', label: 'Min technical score', hint: 'From stockTechnicalScores composite' },
          tier: { type: 'select', default: 'Star', options: [
            { value: 'Star', label: 'Star eligible' },
            { value: 'Core', label: 'Core max' },
          ], label: 'Dual-confirm tier', hint: 'What tier can dual-confirmed stocks reach' },
        },
        category: 'fundamental'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['earnings', 'technical', 'confluence', 'dual-confirmation', 'tradingview'],
    agentUseDescription: 'Your agent will require both strong fundamentals and strong technicals for Star tier eligibility, restricting single-signal stocks to Core or below.',
  },

  // TV-11: 52-Week High Breakout Preference
  {
    id: 'tv-11',
    category: 'technical',
    modes: 'both',
    headline: '52-Week High Breakout Preference',
    description: 'Stocks near their 52-week high are breaking through resistance. This is the Donchian / channel breakout concept — new highs attract momentum buyers.',
    hook: 'Stocks making new highs tend to keep making new highs — resistance becomes support once it breaks',
    learnMore: 'The Donchian Channel breakout strategy is one of the oldest and most respected trend-following systems. When a stock approaches or breaks its 52-week high, it\'s clearing a major resistance level that attracts momentum-following institutional capital. Contrary to the instinct that "it\'s too high to buy," stocks near their highs tend to continue higher because the breakout signals that all overhead supply has been absorbed.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prefer stocks with a highProximity score above {score} out of 12. Stocks within {pct}% of their 52-week high are in breakout territory and attract momentum-following institutional buyers',
        params: {
          score: { type: 'number', default: 9, min: 6, max: 12, step: 1, unit: '/12', label: 'Min highProximity', hint: 'Higher = closer to 52-week high' },
          pct: { type: 'number', default: 5, min: 2, max: 15, step: 1, unit: '%', label: 'Max distance from high', hint: 'How close to the 52-week high to qualify' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: '52-Week High',
    kbEntryId: null,
    tags: ['breakout', '52-week-high', 'Donchian', 'channel', 'momentum', 'tradingview'],
    agentUseDescription: 'Your agent will prefer stocks trading near their 52-week high, using highProximity scores to identify breakout candidates with institutional momentum.',
  },

  // TV-12: Multi-Factor Tier Assignment
  {
    id: 'tv-12',
    category: 'tier_strategy',
    modes: 'clash',
    headline: 'Multi-Factor Tier Assignment',
    description: 'Assigns tiers based on how many independent signals agree. More confirmations = higher tier. Stocks that only pass one check get the lowest tier.',
    hook: 'One green light is a suggestion. Three green lights is conviction — let the evidence decide your tier',
    learnMore: 'Alexander Elder\'s Triple Screen system and the MACD+RSI+Volume "Trinity" are among the most recommended indicator combinations on TradingView. The insight: no single indicator is reliable alone, but when three independent signals agree, the probability of a winning trade increases dramatically. This rule checks three factors — daily technical score, RSI momentum zone, and volume — and assigns tiers based on how many pass.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Check each stock against three factors: (1) Daily technical score above {tech}, (2) RSI in momentum zone {rsi_low}-{rsi_high}, (3) Volume above {vol}x average. Assign Star to stocks passing all 3. Core to stocks passing 2. Support to stocks passing 1 or 0',
        params: {
          tech: { type: 'number', default: 60, min: 40, max: 80, step: 5, unit: '/100', label: 'Technical threshold', hint: 'Daily composite score requirement' },
          rsi_low: { type: 'number', default: 45, min: 30, max: 55, step: 5, unit: '', label: 'RSI floor', hint: 'Bottom of the momentum zone' },
          rsi_high: { type: 'number', default: 70, min: 60, max: 80, step: 5, unit: '', label: 'RSI ceiling', hint: 'Top of the momentum zone' },
          vol: { type: 'number', default: 1.2, min: 1.0, max: 2.0, step: 0.1, unit: 'x', label: 'Volume multiplier', hint: 'Volume vs 20-day average' },
        },
        category: 'tier_strategy'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['multi-factor', 'tier', 'trinity', 'triple-screen', 'confirmation', 'tradingview'],
    agentUseDescription: 'Your agent will assign tiers based on how many of three independent factors each stock passes — daily technical score, RSI momentum zone, and volume confirmation.',
  },

  // TV-13: Volume Spike Institutional Signal
  {
    id: 'tv-13',
    category: 'technical',
    modes: 'clash',
    headline: 'Volume Spike Institutional Signal',
    description: 'When volume explodes above 2x average on a bullish candle, institutions are taking a position. This is the strongest confirmation signal in technical analysis.',
    hook: 'When the big money shows up, the volume screams it — a 2x spike on a green candle is the loudest buy signal in the market',
    learnMore: 'Volume spikes are the fingerprint of institutional activity. When volume surges to 2x or more of the 20-day average on a positive price move, it indicates that large players — mutual funds, hedge funds, pension funds — are actively accumulating. This is the strongest form of technical confirmation because it represents real capital commitment, not just pattern interpretation. Retail traders can\'t move volume like this.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'When evaluating bench stocks for swaps, prioritize any stock showing a volume spike above {mult}x the 20-day average with positive price action. This overrides other technical signals — volume is the ultimate confirmation. Assign these stocks a minimum tier of {tier}',
        params: {
          mult: { type: 'number', default: 2.0, min: 1.5, max: 3.0, step: 0.1, unit: 'x', label: 'Spike multiplier', hint: 'How much above average to qualify as a spike' },
          tier: { type: 'select', default: 'Core', options: [
            { value: 'Star', label: 'Star minimum' },
            { value: 'Core', label: 'Core minimum' },
          ], label: 'Min tier on spike', hint: 'Volume conviction should be rewarded with tier placement' },
        },
        category: 'technical'
      }
    ],
    relatedIndicator: 'Volume',
    kbEntryId: null,
    tags: ['volume', 'spike', 'institutional', 'confirmation', 'tradingview'],
    agentUseDescription: 'Your agent will prioritize bench stocks with volume spikes above the specified multiplier on bullish price action, assigning a minimum tier floor to reflect institutional conviction.',
  },

  // TV-14: Sector Leader Selection
  {
    id: 'tv-14',
    category: 'allocation',
    modes: 'both',
    headline: 'Sector Leader Selection',
    description: 'Instead of picking stocks first, identify the strongest sectors then pick the leader within each one. Ride the sector tide and the stock wave simultaneously.',
    hook: 'A great stock in a bad sector is swimming against the current — find the strongest sector first, then pick its champion',
    learnMore: 'Sector rotation is a major driver of stock returns — studies show that sector selection explains more of a stock\'s performance than individual stock selection alone. By first identifying the strongest sectors using sector RS scores, then selecting the leader within each sector using RS vs SPY, you align both the macro and micro forces in your favor. This is the institutional approach: top-down sector allocation with bottom-up stock picking.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Overweight sectors with the highest sector RS scores. Within each strong sector, select the stock with the highest RS vs SPY score. Limit exposure to any single sector to {max_pct}%. When FantasyTimes reports sector rotation, adjust within {evals} evaluations',
        params: {
          max_pct: { type: 'number', default: 40, min: 25, max: 60, step: 5, unit: '%', label: 'Max sector weight', hint: 'Prevents over-concentration in one sector' },
          evals: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: 'evals', label: 'Rotation speed', hint: 'How quickly to respond to sector shifts' },
        },
        category: 'allocation'
      }
    ],
    relatedIndicator: 'Sector RS',
    kbEntryId: null,
    tags: ['sector', 'rotation', 'leader', 'RS', 'FantasyTimes', 'tradingview'],
    agentUseDescription: 'Your agent will overweight the strongest sectors by RS score, select the leading stock within each, and respond to FantasyTimes sector rotation signals within the specified evaluation window.',
  },

  // TV-15: Threshold Harvest Swap
  {
    id: 'tv-15',
    category: 'threshold',
    modes: 'clash',
    headline: 'Threshold Harvest Swap',
    description: 'After a stock hits a BaggerBomb threshold bonus, immediately evaluate whether to swap it for a fresh high-ATR candidate. The points are banked — now find the next threshold opportunity.',
    hook: 'You already got the +15. The stock doesn\'t know it owes you another one — swap for a fresh rocket',
    learnMore: 'BaggerBomb scoring thresholds award bonus points when a stock moves a certain multiple of its ATR. Once those points are banked, the stock has no memory of owing you more — it\'s equally likely to move toward the next threshold or to reverse. Meanwhile, a fresh high-ATR bench stock with bullish momentum has its full threshold journey ahead of it. This harvest swap strategy optimizes for multiple threshold hits across different stocks rather than waiting for one epic move.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'After a stock triggers a {threshold} threshold bonus, swap it out within {evals} evaluations for the highest-ATR bench stock with bullish momentum (RSI above {rsi} and above VWAP). The scored points are locked — maximize remaining time by finding the next threshold candidate',
        params: {
          threshold: { type: 'select', default: 'BaggerBomb (+1.0x)', options: [
            { value: 'BaggerBomb (+1.0x)', label: 'After BaggerBomb (+15)' },
            { value: 'Double Bagger (+1.5x)', label: 'After Double Bagger (+30)' },
            { value: 'Any positive threshold', label: 'After any positive threshold' },
          ], label: 'Harvest trigger', hint: 'Which threshold triggers the swap' },
          evals: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: 'evals', label: 'Swap speed', hint: 'Evaluations before executing the harvest swap' },
          rsi: { type: 'number', default: 50, min: 40, max: 60, step: 5, unit: '', label: 'Replacement RSI floor', hint: 'New stock must have momentum' },
        },
        category: 'threshold'
      }
    ],
    relatedIndicator: 'ATR / Threshold',
    kbEntryId: null,
    tags: ['threshold', 'harvest', 'swap', 'scoring', 'BaggerBomb-native', 'tradingview'],
    agentUseDescription: 'Your agent will swap out stocks that have triggered a scoring threshold bonus, replacing them with the highest-ATR bench candidate showing bullish momentum to chase the next threshold hit.',
  },

  // ══════════════════════════════════════
  // INSTITUTIONAL CATEGORY
  // ══════════════════════════════════════

  // i-01: Institutional Conviction Filter
  {
    id: 'i-01',
    category: 'institutional',
    modes: 'both',
    headline: 'Institutional Conviction Filter',
    description: 'Prefer stocks where active institutional holders are net accumulating. Filters out passive index fund noise to focus on informed, high-conviction buying.',
    learnMore: 'Institutional conviction is measured by weighting each holder\'s quarterly change by their portfolio concentration. A stock showing "strong accumulation" means multiple active fund managers are increasing positions as a significant percentage of their portfolios — not just index funds mechanically rebalancing. Research shows that a manager\'s most over-weighted positions outperform the market by 1.6-2.1% per quarter.',
    difficulty: 'beginner',
    forgeTemplates: [{
      text: 'Strongly prefer drafting stocks where institutional conviction is {conviction}',
      params: {
        conviction: {
          type: 'select',
          default: 'strong_accumulation',
          options: [
            { value: 'strong_accumulation', label: 'Strong Accumulation' },
            { value: 'mild_accumulation', label: 'Mild Accumulation' },
          ],
          label: 'Minimum Conviction Level',
          hint: 'Strong filters out passive index inflows. Mild is more permissive but noisier.',
        },
      },
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'conviction', 'accumulation', 'smart-money', '13F'],
    agentUseDescription: 'Filters the draft universe to stocks where active institutional holders (excluding passive index funds) are net accumulating. Uses the weighted conviction score from 13F filings. This is a soft preference — the agent can still draft stocks without institutional backing if technical signals are strong.',
  },

  // i-02: Distribution Avoidance
  {
    id: 'i-02',
    category: 'institutional',
    modes: 'both',
    headline: 'Distribution Avoidance',
    description: 'Strictly avoid stocks where institutions are actively selling. When smart money exits, overhead supply caps intraday upside and increases bust risk.',
    learnMore: 'Institutional distribution creates a "VWAP ceiling" — when large funds are selling, their algorithms feed sell orders into any price rally, suppressing the momentum needed for ATR threshold crossings. Research shows that sell herding has a more persistent negative impact on returns than buy herding has a positive impact. This asymmetry makes distribution avoidance one of the most effective defensive rules.',
    difficulty: 'beginner',
    forgeTemplates: [{
      text: 'Strictly avoid drafting stocks where institutional conviction is {level} or worse',
      params: {
        level: {
          type: 'select',
          default: 'strong_distribution',
          options: [
            { value: 'strong_distribution', label: 'Strong Distribution' },
            { value: 'mild_distribution', label: 'Mild Distribution' },
          ],
          label: 'Avoidance Threshold',
          hint: 'Strong Distribution filters the bottom ~10-15%. Mild Distribution is more aggressive and removes ~25-30%.',
        },
      },
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'distribution', 'avoidance', 'risk', 'smart-money'],
    agentUseDescription: 'Hard filter that excludes stocks from the draftable universe when institutional holders are net selling. This is a defensive rule — stocks under active distribution face overhead selling pressure from institutional VWAP algorithms that cap intraday upside. Applied at draft time as a Level 1 filter.',
  },

  // i-03: Consensus Discovery
  {
    id: 'i-03',
    category: 'institutional',
    modes: 'both',
    headline: 'Consensus Discovery',
    description: 'Prefer stocks where multiple institutions opened brand new positions this quarter. New money entering a stock signals a fresh catalyst that passed rigorous research filters.',
    learnMore: 'When an institution opens a new position, it means the stock competed for capital against every other opportunity in the manager\'s universe. When two or more do it independently in the same quarter, it signals a "consensus discovery" — multiple professional research teams found the same opportunity. This cluster buying pattern is one of the strongest alpha signals in 13F data.',
    difficulty: 'intermediate',
    forgeTemplates: [{
      text: 'Prefer stocks where at least {count} top-20 institutional holders initiated a completely new position this quarter',
      params: {
        count: {
          type: 'number',
          default: 2,
          min: 1,
          max: 5,
          step: 1,
          unit: '',
          label: 'Minimum New Positions',
          hint: '1 is noise. 2 is consensus. 3+ is a stampede. Higher = stronger signal but fewer qualifying stocks.',
        },
      },
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'new-position', 'cluster-buy', 'catalyst', 'consensus'],
    agentUseDescription: 'Identifies stocks with fresh institutional interest — positions that didn\'t exist last quarter. Multiple new positions in the same stock signal a consensus discovery among independent research teams. Applied as a preference during portfolio construction.',
  },

  // i-04: Whale Concentration Guard
  {
    id: 'i-04',
    category: 'institutional',
    modes: 'both',
    headline: 'Whale Concentration Guard',
    description: 'Avoid stocks where a single institution holds too large a stake. When one whale controls the float, their exit creates outsized price drops and bust risk.',
    learnMore: 'When a single entity controls 20%+ of outstanding shares, the stock\'s liquidity becomes dependent on that fund\'s stability. If the whale faces redemptions, their forced selling overwhelms market depth and triggers cascading price drops. The threshold of 20% accounts for the dominance of passive index providers (Vanguard, BlackRock, State Street), who routinely hold 10-15% of major stocks through mechanical index inclusion.',
    difficulty: 'intermediate',
    forgeTemplates: [{
      text: 'Avoid stocks where any single institutional entity holds more than {pct}% of total outstanding shares',
      params: {
        pct: {
          type: 'number',
          default: 20,
          min: 10,
          max: 35,
          step: 1,
          unit: '%',
          label: 'Maximum Single-Holder Stake',
          hint: '20% filters extreme concentration while allowing normal passive index holdings. Lower = stricter but may exclude popular large-caps.',
        },
      },
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'concentration', 'whale', 'risk', 'liquidity'],
    agentUseDescription: 'Tail-risk filter that excludes stocks with extreme ownership concentration by a single entity. Applied at draft time to prevent the agent from holding stocks vulnerable to a single fund\'s liquidation cascade. The 20% default accounts for passive index fund dominance in modern markets.',
  },

  // i-05: Active Fund Overlap Guard
  {
    id: 'i-05',
    category: 'institutional',
    modes: 'both',
    headline: 'Active Fund Overlap Guard',
    description: 'Prevent drafting too many stocks held by the same active mutual fund. High overlap means correlated drawdowns when that fund faces redemptions.',
    learnMore: 'When multiple stocks in your portfolio are top holdings of the same active mutual fund, they become linked through common flow shocks. During market stress, funds facing redemptions liquidate across their entire portfolio simultaneously — creating correlated crashes in seemingly unrelated stocks. This rule targets active fund overlap specifically because passive index funds (Vanguard, BlackRock) hold everything and carry no informational signal.',
    difficulty: 'advanced',
    forgeTemplates: [{
      text: 'Ensure no more than {max} drafted stocks share the same top-3 active mutual fund holder (excluding passive index providers)',
      params: {
        max: {
          type: 'number',
          default: 2,
          min: 1,
          max: 4,
          step: 1,
          unit: '',
          label: 'Maximum Overlap',
          hint: '2 enforces strict diversification in a 5-stock portfolio. 3 allows moderate clustering. 1 is extremely restrictive.',
        },
      },
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'overlap', 'diversification', 'correlation', 'fund-risk'],
    agentUseDescription: 'Portfolio diversification rule that limits how many drafted stocks can share the same active mutual fund as a top-3 holder. Passive index funds are excluded from the check since they hold everything mechanically. Applied during portfolio construction to prevent correlated liquidation risk.',
  },

  // i-06: Hedge Fund Favorites
  {
    id: 'i-06',
    category: 'institutional',
    modes: 'clash',
    headline: 'Hedge Fund Favorites',
    description: 'Target stocks widely held by top hedge funds for momentum amplification. Crowded trades provide explosive intraday moves but carry reversal risk.',
    learnMore: 'Stocks held by multiple top hedge funds benefit from persistent buying pressure during momentum phases — the Goldman Sachs "Hedge Fund VIP" index outperforms the S&P 500 in 60% of quarters. However, these crowded positions are fragile: when market stress hits, highly correlated hedge funds unwind simultaneously, causing violent crashes. Use this rule for BaggerBomb momentum plays but pair it with tight technical swap parameters.',
    difficulty: 'intermediate',
    forgeTemplates: [{
      text: 'Target high-momentum setups in stocks held by at least {count} of the top-20 hedge funds, but maintain strict technical swap parameters due to crowded-trade reversal risk',
      params: {
        count: {
          type: 'number',
          default: 3,
          min: 2,
          max: 10,
          step: 1,
          unit: '',
          label: 'Minimum Hedge Fund Holders',
          hint: '3 identifies a crowded trade. 5+ is an extremely popular position with high momentum but severe crash risk.',
        },
      },
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'hedge-fund', 'crowded-trade', 'momentum', 'VIP'],
    agentUseDescription: 'Momentum amplifier that prefers stocks widely held across top hedge funds. These "crowded trades" produce outsized intraday moves ideal for ATR threshold crossings. The agent must pair this with strict technical swap rules — if VWAP or 5-min MACD breaks down, exit immediately to avoid herd liquidation.',
  },

  // i-07: Sector Institutional Flow
  {
    id: 'i-07',
    category: 'institutional',
    modes: 'both',
    headline: 'Sector Institutional Flow',
    description: 'Align stock selection with sectors where institutional money is flowing in. Capital rotation at the sector level creates structural tailwinds for individual stocks.',
    learnMore: 'Institutions don\'t just pick stocks — they rotate capital along sector lines. When massive funds rotate into Technology or out of Financials, it creates a rising or falling tide that individual stocks can\'t fight. Sector-level flow has 71% directional accuracy in high-signal sectors like Energy. This rule stacks well with FantasyTimes news sentiment for double confirmation.',
    difficulty: 'beginner',
    forgeTemplates: [{
      text: 'Prefer drafting stocks in sectors where the aggregate institutional flow sentiment is {sentiment}',
      params: {
        sentiment: {
          type: 'select',
          default: 'bullish',
          options: [
            { value: 'bullish', label: 'Bullish (Net Accumulation)' },
            { value: 'neutral', label: 'Neutral or Better' },
          ],
          label: 'Sector Flow Threshold',
          hint: 'Bullish aligns with the dominant capital rotation. Neutral allows sectors that aren\'t actively distributing.',
        },
      },
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'sector', 'flow', 'rotation', 'macro'],
    agentUseDescription: 'Macro-alignment rule that ensures the agent\'s stock picks are in sectors where institutional capital is flowing in. Acts as a structural tailwind multiplier for technical breakout signals. Stacks with FantasyTimes sector sentiment for dual confirmation. Applied as a Level 2 preference during portfolio construction.',
  },

  // i-08: Insider + Institution Confluence
  {
    id: 'i-08',
    category: 'institutional',
    modes: 'both',
    headline: 'Insider + Institution Confluence',
    description: 'The premium signal: prefer stocks where both institutional holders AND company insiders are buying. Dual confirmation from people with the deepest knowledge.',
    learnMore: 'When corporate insiders (CEOs, CFOs) buy their own stock AND institutional managers are accumulating, it creates the strongest predictive signal in the 13F universe. Insiders know the company\'s immediate prospects; institutions validate the thesis with external analysis. Research shows this confluence yields 12-18% annualized abnormal returns. The 60-day insider lookback captures post-earnings buying windows while keeping the signal timely.',
    difficulty: 'advanced',
    forgeTemplates: [{
      text: 'Highlight as highest-conviction: Strongly prefer stocks where institutional conviction is accumulating AND insider activity in the past {days} days shows net buying',
      params: {
        days: {
          type: 'number',
          default: 60,
          min: 30,
          max: 180,
          step: 15,
          unit: '',
          label: 'Insider Lookback Window',
          hint: '60 days captures recent post-earnings insider buying. 90 is standard for longer horizons. 30 is aggressive and may miss slower-moving signals.',
        },
      },
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'insider', 'confluence', 'premium', 'dual-signal', 'highest-conviction'],
    agentUseDescription: 'The highest-ranked institutional rule. Combines lagged 13F institutional accumulation with near real-time insider buying (Form 4 filings, required within 2 business days). This confluence neutralizes the primary weakness of quarterly data by demanding a timely insider confirmation. Applied as the top priority during portfolio construction — stocks meeting this criteria get maximum draft preference.',
  },

  // i-09: Transient Capital Catalyst
  {
    id: 'i-09',
    category: 'institutional',
    modes: 'clash',
    headline: 'Transient Capital Catalyst',
    description: 'Prefer stocks where accumulation is driven by high-turnover, short-horizon institutions. These "transient" funds amplify intraday volatility — exactly what BaggerBomb rewards.',
    learnMore: 'Not all institutional money is equal. "Transient" institutions (high portfolio turnover, short holding periods) create significantly more stock return volatility than "dedicated" long-term holders. Since BaggerBomb rewards ATR threshold crossings, stocks with transient institutional accumulation are structurally more likely to produce the sharp intraday moves needed for Bagger bonuses. Dedicated holders provide stability but suppress the volatility BaggerBomb rewards.',
    difficulty: 'advanced',
    forgeTemplates: [{
      text: 'Prefer stocks where recent institutional accumulation is driven by high-turnover transient institutions rather than long-term dedicated holders',
      params: {},
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'transient', 'volatility', 'momentum', 'high-turnover', 'ATR'],
    agentUseDescription: 'Volatility amplifier that biases the agent toward stocks with accumulation by high-turnover "transient" institutions (quantitative funds, short-horizon momentum funds) rather than low-turnover "dedicated" holders. Transient capital creates the sharp intraday price movements needed for ATR threshold crossings. This is a toggle rule with no parameters — the agent checks whether the accumulating institutions are classified as high-turnover in the archetype system.',
  },

  // i-10: Institutional Breadth Momentum
  {
    id: 'i-10',
    category: 'institutional',
    modes: 'both',
    headline: 'Institutional Breadth Momentum',
    description: 'Prefer stocks where the number of unique institutional holders is expanding quarter after quarter. A growing investor base often precedes major price re-ratings.',
    learnMore: 'Breadth of ownership — how many unique funds hold a stock — is often more informative than depth (how much they hold). A stock being adopted by 10-20 new funds each quarter for multiple consecutive quarters experiences a "geometric expansion" in its investor base. This expanding breadth typically precedes significant price re-ratings as the stock graduates from niche to mainstream institutional coverage.',
    difficulty: 'intermediate',
    forgeTemplates: [{
      text: 'Prefer stocks where the number of unique institutional holders has increased for at least {quarters} consecutive quarters',
      params: {
        quarters: {
          type: 'number',
          default: 2,
          min: 1,
          max: 4,
          step: 1,
          unit: '',
          label: 'Consecutive Growth Quarters',
          hint: '2 confirms a trend. 3+ is a strong geometric expansion. 1 may be noise.',
        },
      },
      category: 'institutional',
    }],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['institutional', 'breadth', 'momentum', 'ownership-expansion', 'emerging'],
    agentUseDescription: 'Identifies stocks with expanding institutional adoption — a growing number of unique fund holders over consecutive quarters. This "breadth momentum" often precedes significant price re-ratings as the stock moves from niche to mainstream institutional coverage. Applied as a preference during portfolio construction, particularly useful for mid-cap Rockets that are gaining institutional traction.',
  },

  // ══════════════════════════════════════
  // ENTRY CRITERIA CATEGORY (Season Mode)
  // ══════════════════════════════════════

  // SE-01: RSI Entry Gate
  {
    id: 'se-01',
    category: 'entry_criteria',
    modes: 'season',
    headline: 'RSI Entry Gate',
    description: 'Only enter positions where RSI indicates the stock isn\'t overbought — prevents chasing stocks that have already run.',
    hook: 'Stops you from buying at the top — if everyone\'s already in, you\'re late',
    learnMore: 'RSI measures momentum on a 0-100 scale. Stocks with high RSI have already rallied hard and are statistically more likely to pull back. By gating entries below a threshold, you avoid buying at the top of a move. In a 4-week season, getting caught in a pullback wastes precious runway. This pairs naturally with the Momentum Entry Threshold — together they define a "sweet spot" where stocks are moving but not overextended.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Only enter positions where RSI is below {upper}',
        params: {
          upper: { type: 'number', default: 65, min: 50, max: 80, label: 'Max RSI', hint: 'Lower = stricter. Below 60 is conservative, 70+ is permissive.', unit: 'RSI' },
        },
        category: 'entry_criteria',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['entry', 'rsi', 'overbought', 'filter', 'season'],
    agentUseDescription: 'Blocks entry into stocks with RSI above the threshold. Prevents buying overbought momentum that may reverse.',
  },

  // SE-02: Volume Confirmation
  {
    id: 'se-02',
    category: 'entry_criteria',
    modes: 'season',
    headline: 'Volume Confirmation',
    description: 'Require meaningful trading volume before entering — ensures the stock has active interest, not a dead drift.',
    hook: 'Volume is conviction — if nobody\'s trading it, why are you buying it?',
    learnMore: 'Volume confirms that a price move has institutional participation behind it. Stocks drifting on low volume are prone to sudden reversals when real buyers or sellers arrive. By requiring above-average volume, you filter for stocks where institutions are actively engaged — the moves are more likely to sustain. In a season portfolio, getting stuck in a low-volume name that drifts sideways wastes a roster slot.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Require volume to be at least {multiplier}x the 20-day average before entering',
        params: {
          multiplier: { type: 'number', default: 1.2, min: 0.8, max: 3.0, step: 0.1, label: 'Volume Multiple', hint: '1.0 = average volume. Higher = only buy on strong volume days.', unit: 'x' },
        },
        category: 'entry_criteria',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['entry', 'volume', 'confirmation', 'filter', 'season'],
    agentUseDescription: 'Requires relative volume above threshold before entering a position. Filters out low-interest stocks.',
  },

  // SE-03: Trend Alignment Filter
  {
    id: 'se-03',
    category: 'entry_criteria',
    modes: 'season',
    headline: 'Trend Alignment Filter',
    description: 'Only buy stocks trading above their moving average — the simplest trend-following filter. Below the SMA = downtrend.',
    hook: 'Don\'t fight the trend — if it\'s below the average, the market is telling you something',
    learnMore: 'A stock trading above its moving average is in an uptrend — momentum is on your side. A stock below it is fighting gravity. This is the most fundamental trend-following filter and forms the backbone of most systematic strategies. Shorter moving averages (20-day) react faster but produce more false signals. The 50-day is the institutional standard. The 200-day defines the major trend and rarely gives false readings.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Only enter stocks trading above their {period}-day moving average',
        params: {
          period: { type: 'select', default: 50, options: [{ value: 20, label: '20-day (short-term)' }, { value: 50, label: '50-day (medium-term)' }, { value: 100, label: '100-day (long-term)' }, { value: 200, label: '200-day (major trend)' }], label: 'Moving Average Period', hint: 'Shorter periods react faster but give more false signals.' },
        },
        category: 'entry_criteria',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['entry', 'trend', 'sma', 'moving-average', 'filter', 'season'],
    agentUseDescription: 'Filters out stocks in downtrends by requiring price above the selected moving average period.',
  },

  // SE-04: Earnings Avoidance Window
  {
    id: 'se-04',
    category: 'entry_criteria',
    modes: 'season',
    headline: 'Earnings Avoidance Window',
    description: 'Don\'t enter positions right before earnings — overnight gap risk can destroy a position. Huge strategic lever.',
    hook: 'Earnings are coin flips — great companies miss, bad companies surprise. Avoid the casino.',
    learnMore: 'Earnings announcements create massive gap risk — stocks can jump or drop 10%+ overnight regardless of quality. In a 4-week season, a single earnings gap against you can wipe out days of careful gains. This rule creates a buffer zone around earnings dates, preventing new entries when the risk/reward is dominated by a binary event. Conservative players use 5-10 day buffers; aggressive players accept 1-2 day windows.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Don\'t enter within {days} trading days of an earnings report',
        params: {
          days: { type: 'number', default: 3, min: 1, max: 10, label: 'Buffer Days', hint: 'Conservative: 5-10 days. Aggressive: 1-2 days. This is a major risk control.', unit: '' },
        },
        category: 'entry_criteria',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['entry', 'earnings', 'risk', 'avoidance', 'filter', 'season'],
    agentUseDescription: 'Blocks entry into stocks with earnings reports within the buffer window. Avoids overnight gap risk.',
  },

  // SE-05: Fundamental Floor
  {
    id: 'se-05',
    category: 'entry_criteria',
    modes: 'season',
    headline: 'Fundamental Floor',
    description: 'Require a minimum fundamental quality score — prevents chasing technically attractive junk.',
    hook: 'Charts lie, fundamentals don\'t — make sure the company is actually solid',
    learnMore: 'Technical signals can make a fundamentally weak stock look attractive — momentum, breakouts, and volume spikes happen in bad companies too. This rule sets a quality floor using the composite fundamental score (0-100), which combines earnings quality, revenue growth, balance sheet strength, and valuation metrics. Stocks below the floor are excluded regardless of how good the chart looks. A score of 50 is median quality; 70+ indicates strong fundamentals.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Only enter stocks with a Fundamental Score above {minScore}',
        params: {
          minScore: { type: 'number', default: 50, min: 20, max: 80, label: 'Minimum Score', hint: 'Our scoring system rates fundamentals 0-100. 50 is median quality.', unit: '' },
        },
        category: 'entry_criteria',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['entry', 'fundamental', 'quality', 'floor', 'filter', 'season'],
    agentUseDescription: 'Requires minimum fundamental score before entry. Prevents buying technically attractive but fundamentally weak stocks.',
  },

  // SE-06: Momentum Entry Threshold
  {
    id: 'se-06',
    category: 'entry_criteria',
    modes: 'season',
    headline: 'Momentum Entry Threshold',
    description: 'Require recent price momentum before entering — no dead money. Creates natural tension with the RSI gate.',
    hook: 'Money in motion stays in motion — flat stocks waste your limited season runway',
    learnMore: 'In a 4-week season, every day counts. A stock that isn\'t moving is consuming a roster slot without contributing returns. This rule requires minimum recent price momentum before entry, ensuring your agent only buys stocks that are actively trending. The natural tension with the RSI Entry Gate is intentional — momentum requires the stock to be moving, but RSI caps how far it can have moved. Together they define the optimal entry window: moving but not overextended.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Require a minimum {period}-day price change of {pct}%',
        params: {
          period: { type: 'select', default: 10, options: [{ value: 5, label: '5-day (fast)' }, { value: 10, label: '10-day (medium)' }, { value: 20, label: '20-day (slow)' }], label: 'Lookback Period', hint: 'Shorter = recent momentum. Longer = sustained trend.' },
          pct: { type: 'number', default: 2, min: 0.5, max: 10, step: 0.5, label: 'Min Change %', hint: 'Higher = stronger momentum required. Watch for tension with RSI Gate.', unit: '%' },
        },
        category: 'entry_criteria',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['entry', 'momentum', 'price-change', 'filter', 'season'],
    agentUseDescription: 'Requires minimum price change over the lookback period. Filters out stagnant stocks wasting season runway.',
  },

  // SE-07: Sector Freshness Check
  {
    id: 'se-07',
    category: 'entry_criteria',
    modes: 'season',
    headline: 'Sector Freshness Check',
    description: 'Prevents sector concentration at entry time — if you already have 30% tech, don\'t add more tech.',
    hook: 'Diversification happens at the door, not after the house is on fire',
    learnMore: 'Sector concentration is one of the biggest portfolio killers in a multi-week season. If three of your positions are tech and tech drops 5%, your whole portfolio suffers. This rule checks sector exposure at entry time and blocks new positions when a sector is already at its weight cap. Unlike rebalancing rules that fix drift after it happens, this prevents concentration from forming in the first place.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Don\'t enter if sector already at {maxPct}% or more of portfolio',
        params: {
          maxPct: { type: 'number', default: 30, min: 15, max: 50, label: 'Max Sector Weight', hint: 'Lower = more diversified. 25-30% is moderate. 15% is very strict.', unit: '%' },
        },
        category: 'entry_criteria',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['entry', 'sector', 'diversification', 'concentration', 'filter', 'season'],
    agentUseDescription: 'Blocks entry when a sector already exceeds the weight cap. Enforces diversification at entry time.',
  },

  // SE-08: Institutional Sentiment Check
  {
    id: 'se-08',
    category: 'entry_criteria',
    modes: 'season',
    headline: 'Institutional Sentiment Check',
    description: 'Only enter stocks where big institutions are buying, not selling. Leverages 13F data as a leading indicator.',
    hook: 'Follow the smart money — if BlackRock is buying, they probably know something',
    learnMore: 'Institutional 13F filings reveal what the biggest money managers are doing with their portfolios. When institutions are increasing their positions, it signals confidence backed by deep research. When they\'re reducing, it often precedes price weakness. This rule checks the direction of institutional ownership over recent quarters — increasing or stable ownership is a green light, while declining ownership is a warning sign. The multi-quarter lookback filters out noise from single-quarter rebalancing.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Only enter stocks where institutional ownership has {direction} over the last {quarters} quarters',
        params: {
          direction: { type: 'select', default: 'stable_or_increased', options: [{ value: 'increased', label: 'Increased' }, { value: 'stable_or_increased', label: 'Stable or Increased' }, { value: 'any', label: 'Any (no filter)' }], label: 'Ownership Direction', hint: 'Increased = bullish institutions. Stable = not bailing. Any = disabled.' },
          quarters: { type: 'select', default: 2, options: [{ value: 1, label: '1 quarter' }, { value: 2, label: '2 quarters' }, { value: 4, label: '4 quarters' }], label: 'Lookback Quarters', hint: 'More quarters = stronger conviction signal but slower to react.' },
        },
        category: 'entry_criteria',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['entry', 'institutional', '13f', 'smart-money', 'filter', 'season'],
    agentUseDescription: 'Requires institutional ownership trending in the specified direction. Uses 13F data as a conviction signal.',
  },

  // ══════════════════════════════════════
  // EXIT & STOPS CATEGORY (Season Mode)
  // ══════════════════════════════════════

  // SX-01: Fixed Stop-Loss
  {
    id: 'sx-01',
    category: 'exit_stops',
    modes: 'season',
    headline: 'Fixed Stop-Loss',
    description: 'The most fundamental risk rule. Sell any position that drops a set percentage from entry. Tight stops = quick cuts + frequent re-entry. Wide stops = ride through volatility.',
    hook: 'The #1 rule in trading: cut your losses. The only question is where.',
    learnMore: 'Stop-losses are the single most important risk management tool. Without one, a small loss can snowball into a catastrophic one. The tradeoff is between tight and wide: tight stops (3-5%) cut losses quickly but trigger frequently, leading to more re-entry costs and whipsaws. Wide stops (15-20%) give positions room to breathe through normal volatility but expose you to larger drawdowns when the thesis is truly broken. In a 4-week season, a balanced stop around 7-10% gives enough room for daily noise while capping downside.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Sell any position that drops {pct}% from entry',
        params: {
          pct: { type: 'number', default: 8, min: 3, max: 20, label: 'Stop-Loss %', hint: 'Tight (3-5%) = frequent stops. Medium (7-10%) = balanced. Wide (15-20%) = ride volatility.', unit: '%' },
        },
        category: 'exit_stops',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['exit', 'stop-loss', 'risk', 'capital-protection', 'season'],
    agentUseDescription: 'Mandatory sell when position drops below stop-loss threshold from entry price. Hard priority — overrides soft holds.',
  },

  // SX-02: Trailing Stop
  {
    id: 'sx-02',
    category: 'exit_stops',
    modes: 'season',
    headline: 'Trailing Stop',
    description: 'Sell if position drops from its highest price since entry — protects gains by measuring from the peak, not the entry.',
    hook: 'Lock in gains automatically — you\'ll never give back your entire rally',
    learnMore: 'A trailing stop ratchets upward with the stock price but never moves down. If a stock rises 20% then pulls back 10% from its peak, the trailing stop triggers — you keep 10% instead of watching all gains evaporate. The key tension is with Profit Target: a profit target sells at a fixed gain (e.g., +15%), while a trailing stop lets winners run indefinitely but gives back some gains on exit. Combining both creates a system where positions either hit the target or get stopped out on a reversal.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Sell if position drops {pct}% from its highest closing price since entry',
        params: {
          pct: { type: 'number', default: 10, min: 3, max: 25, label: 'Trail Distance %', hint: 'Tighter = protects more gain but exits sooner. Wider = lets winners breathe.', unit: '%' },
        },
        category: 'exit_stops',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['exit', 'trailing-stop', 'gains', 'peak', 'season'],
    agentUseDescription: 'Sells when position drops from its high-water mark by the trail percentage. Hard priority. Protects accumulated gains.',
  },

  // SX-03: Time-Based Exit
  {
    id: 'sx-03',
    category: 'exit_stops',
    modes: 'season',
    headline: 'Time-Based Exit',
    description: 'Close positions that aren\'t working within a time window. Dead money in a 4-week season wastes 25% of your runway per week.',
    hook: 'Time is money — literally. A flat stock in a 20-day season is an expensive do-nothing.',
    learnMore: 'In a 4-week season, time is your scarcest resource. A stock that sits flat for a week has consumed 25% of your season runway without contributing returns. This rule sets a performance deadline — if a position hasn\'t gained the minimum within the time window, it gets closed and the capital is redeployed to a better opportunity. The minimum gain threshold is the key lever: 0% means "just don\'t lose money," while 2%+ demands active profit generation.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Close any position that hasn\'t gained {pct}% within {days} trading days',
        params: {
          days: { type: 'number', default: 5, min: 2, max: 15, label: 'Time Window', hint: 'Shorter = impatient but responsive. Longer = more patient.', unit: '' },
          pct: { type: 'number', default: 1, min: 0, max: 5, step: 0.5, label: 'Min Gain Required', hint: '0% = must not lose money. 2%+ = must actively profit.', unit: '%' },
        },
        category: 'exit_stops',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['exit', 'time', 'dead-money', 'patience', 'season'],
    agentUseDescription: 'Exits positions that fail to achieve minimum gain within the time window. Soft priority. Fights dead money.',
  },

  // SX-04: Profit Target
  {
    id: 'sx-04',
    category: 'exit_stops',
    modes: 'season',
    headline: 'Profit Target',
    description: 'Sell when a position hits a gain target — birds in the hand. Natural tension with Trailing Stop (lock in now vs. let it run).',
    hook: 'Nobody went broke taking profits — but leaving money on the table hurts too',
    learnMore: 'Profit targets create a disciplined exit at a predetermined gain level. The advantage is certainty — you lock in gains without waiting for a reversal signal. The disadvantage is capping upside — a stock that would have gained 40% gets sold at 15%. The key tension is with the Trailing Stop: if both are equipped, the tighter one fires first. A 15% profit target with a 10% trailing stop means the target fires first for a steady rise, but the trailing stop catches a sharp reversal before the target is reached.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Sell any position that gains {pct}% from entry',
        params: {
          pct: { type: 'number', default: 15, min: 5, max: 50, label: 'Profit Target %', hint: 'Low (5-8%) = frequent wins. High (20%+) = fewer but bigger wins.', unit: '%' },
        },
        category: 'exit_stops',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['exit', 'profit', 'target', 'gains', 'season'],
    agentUseDescription: 'Sells positions that reach the profit target. Soft priority. Locks in gains at a fixed level.',
  },

  // SX-05: Technical Exit Signal
  {
    id: 'sx-05',
    category: 'exit_stops',
    modes: 'season',
    headline: 'Technical Exit Signal',
    description: 'Sell on technical breakdown — RSI overbought, MACD crossover, or price dropping below its moving average.',
    hook: 'Let the charts tell you when the party\'s over, not your gut',
    learnMore: 'Technical exit signals let the market tell you when a trend is ending rather than guessing. RSI overbought signals momentum exhaustion — the stock has risen too far too fast. MACD bearish crossover detects a shift in trend direction before it becomes obvious on the chart. Price below the moving average confirms the trend has broken. The "RSI OR MACD" option casts the widest net — either signal triggers an exit, making it the most defensive choice.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Sell on technical breakdown: {trigger}',
        params: {
          trigger: { type: 'select', default: 'rsi_overbought', options: [{ value: 'rsi_overbought', label: 'RSI Overbought' }, { value: 'macd_bearish', label: 'MACD Bearish Crossover' }, { value: 'below_sma', label: 'Below Moving Average' }, { value: 'either_rsi_or_macd', label: 'RSI OR MACD (either triggers)' }], label: 'Exit Trigger', hint: 'RSI = momentum reversal. MACD = trend shift. SMA = trend break.' },
          rsiThreshold: { type: 'number', default: 75, min: 65, max: 90, label: 'RSI Threshold', hint: 'Only used with RSI trigger. Higher = more permissive.', unit: 'RSI' },
          smaPeriod: { type: 'select', default: 20, options: [{ value: 20, label: '20-day' }, { value: 50, label: '50-day' }], label: 'SMA Period', hint: 'Only used with SMA trigger. 20-day reacts faster.' },
        },
        category: 'exit_stops',
        targetType: 'indicator_weight'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['exit', 'technical', 'rsi', 'macd', 'sma', 'breakdown', 'season'],
    agentUseDescription: 'Exits on selected technical breakdown signal. Soft priority. Pairs with entry criteria for complete technical systems.',
  },

  // SX-06: Earnings Exit
  {
    id: 'sx-06',
    category: 'exit_stops',
    modes: 'season',
    headline: 'Earnings Exit',
    description: 'Sell positions before earnings to avoid overnight gap risk. The toggle is the key decision: protect all positions or only profitable ones?',
    hook: 'Take profits before the dice roll — or hold through and hope for the best',
    learnMore: 'Earnings reports create binary outcomes — stocks can gap 10%+ in either direction overnight. If you\'re sitting on a profitable position, selling before earnings locks in those gains and eliminates the risk of giving them back on a miss. The "Only If Profitable" toggle is the critical decision: ON means you protect gains but hold losers through earnings (hoping for a positive surprise), while OFF means you exit everything approaching earnings regardless of P&L — the more defensive choice.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Sell positions {days} days before earnings if profitable',
        params: {
          days: { type: 'number', default: 2, min: 1, max: 5, label: 'Days Before Earnings', hint: 'More days = safer but may miss pre-earnings run-up.', unit: '' },
          onlyIfProfitable: { type: 'toggle', default: true, label: 'Only If Profitable', hint: 'ON = protect gains only. OFF = also cut losers before potential further damage.' },
        },
        category: 'exit_stops',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['exit', 'earnings', 'risk', 'gap', 'season'],
    agentUseDescription: 'Exits positions approaching earnings reports. Toggle controls whether only profitable positions are sold or all positions.',
  },

  // SX-07: Correlation-Based Exit
  {
    id: 'sx-07',
    category: 'exit_stops',
    modes: 'season',
    headline: 'Correlation-Based Exit',
    description: 'If two holdings move together too closely, sell the weaker one. Sector diversity ≠ correlation diversity.',
    hook: 'Owning 3 tech stocks that move in lockstep isn\'t diversification — it\'s triple exposure',
    learnMore: 'Two stocks can be in different sectors yet still move in lockstep — for example, a cloud software company and a semiconductor maker might both track the Nasdaq closely. High rolling correlation between holdings means your diversification is illusory — when one drops, the other drops too. This rule computes pairwise correlation over the specified window and sells the weaker performer when two holdings exceed the threshold. True portfolio diversification requires low correlation, not just different ticker symbols.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'If two holdings show {days}-day correlation above {threshold}, sell the weaker one',
        params: {
          days: { type: 'select', default: 10, options: [{ value: 5, label: '5-day (recent)' }, { value: 10, label: '10-day (standard)' }, { value: 20, label: '20-day (broad)' }], label: 'Correlation Window', hint: 'Shorter = catches recent convergence. Longer = structural similarity.' },
          threshold: { type: 'number', default: 0.85, min: 0.7, max: 0.95, step: 0.05, label: 'Correlation Threshold', hint: '0.85 is high correlation. Lower = stricter diversification.', unit: '' },
        },
        category: 'exit_stops',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['exit', 'correlation', 'diversification', 'advanced', 'season'],
    agentUseDescription: 'Compares rolling correlation between all position pairs. Sells the weaker of any pair exceeding the threshold. Soft priority.',
  },

  // ══════════════════════════════════════
  // REBALANCING CATEGORY (Season Mode)
  // ══════════════════════════════════════

  // SR-01: Position Size Cap
  {
    id: 'sr-01',
    category: 'rebalancing',
    modes: 'season',
    headline: 'Position Size Cap',
    description: 'Trim any position that grows too large — classic rebalancing. The gap between max and target determines how aggressively you sell winners.',
    hook: 'No single stock should hold your portfolio hostage — cap the concentration',
    learnMore: 'When a stock rallies hard, it can grow from 10% of your portfolio to 25%+ without you adding a share. That concentration means a single stock\'s reversal can drag down your entire season. This rule automatically trims oversized positions back to a target weight. The gap between max and target is the key lever: a narrow gap (15% max, 13% target) triggers frequent small trims, while a wide gap (25% max, 15% target) allows positions to grow significantly before a larger trim. Pairs naturally with Add to Winners — together they create a "pyramid up to the cap" strategy.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Trim any position above {maxPct}% back to {targetPct}%',
        params: {
          maxPct: { type: 'number', default: 15, min: 10, max: 30, label: 'Max Weight', hint: 'When a position hits this weight, trimming begins.', unit: '%' },
          targetPct: { type: 'number', default: 12, min: 8, max: 25, label: 'Target Weight', hint: 'Trim down to this weight. Smaller gap = more frequent trims.', unit: '%' },
        },
        category: 'rebalancing',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['rebalance', 'position-size', 'concentration', 'trim', 'season'],
    agentUseDescription: 'Trims positions exceeding the max weight back to the target weight. Hard priority. Prevents single-stock concentration.',
  },

  // SR-02: Cash Deployment Trigger
  {
    id: 'sr-02',
    category: 'rebalancing',
    modes: 'season',
    headline: 'Cash Deployment Trigger',
    description: 'If cash builds up past a threshold, prioritize finding new entries. Prevents accidentally becoming a cash-heavy portfolio after exits.',
    hook: 'Cash earns zero in a 4-week sprint — deploy it or lose the race',
    learnMore: 'After exits fire — stop-losses, profit targets, earnings exits — cash accumulates. In a 4-week season, idle cash is a direct drag on returns. This rule monitors your cash percentage and triggers entry scans when it exceeds the threshold. It also serves a dual role on Day 1: the cron reads this threshold to determine how much cash to reserve during initial portfolio construction. A low threshold (5-10%) keeps you nearly fully invested at all times, while a higher threshold (30-40%) maintains a war chest for opportunistic entries.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'If cash exceeds {pct}%, prioritize deploying into entry candidates',
        params: {
          pct: { type: 'number', default: 15, min: 5, max: 40, label: 'Cash Threshold', hint: 'Low (5-10%) = stay fully invested. High (30-40%) = big cash buffer is OK.', unit: '%' },
        },
        category: 'rebalancing',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['rebalance', 'cash', 'deployment', 'invested', 'season'],
    agentUseDescription: 'Triggers entry scan when cash exceeds the threshold. Soft priority. Also determines initial cash reserve on Day 1 portfolio construction.',
  },

  // SR-03: Sector Drift Rebalance
  {
    id: 'sr-03',
    category: 'rebalancing',
    modes: 'season',
    headline: 'Sector Drift Rebalance',
    description: 'If market moves push one sector too far from your starting allocation, rebalance back. Strategic asset allocation vs. letting the market decide.',
    hook: 'Markets will drift your portfolio into concentration — this rule fights back',
    learnMore: 'Even a well-diversified portfolio drifts over time as different sectors perform differently. If tech rallies 15% while energy drops 10%, your originally balanced allocation becomes tech-heavy. This rule compares each sector\'s current weight to its initial weight and triggers rebalancing when the drift exceeds the tolerance. Tight tolerance (5%) maintains strict strategic allocation, while loose tolerance (20%) lets market momentum run before correcting. This is the season-mode equivalent of institutional strategic asset allocation.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'If any sector drifts more than {tolerance}% from initial weight, rebalance',
        params: {
          tolerance: { type: 'number', default: 10, min: 5, max: 20, label: 'Drift Tolerance', hint: 'Tight (5%) = strict balance. Loose (20%) = let markets breathe.', unit: '%' },
        },
        category: 'rebalancing',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['rebalance', 'sector', 'drift', 'allocation', 'season'],
    agentUseDescription: 'Rebalances when any sector\'s weight drifts beyond tolerance from its initial allocation. Soft priority.',
  },

  // SR-04: Add to Winners
  {
    id: 'sr-04',
    category: 'rebalancing',
    modes: 'season',
    headline: 'Add to Winners',
    description: 'Increase positions that are working. Direct tension with Position Size Cap — combined strategy: add to winners UP TO the cap.',
    hook: 'Double down on what\'s working — momentum is real, ride it',
    learnMore: 'Pyramiding — adding to winning positions — is a core momentum strategy. When a stock is already up significantly, it has demonstrated the thesis is working. Adding more capital to winners and less to losers is how trend-following systems generate outsized returns. The direct tension with Position Size Cap is intentional: Add to Winners pushes position sizes up, while Position Size Cap trims them back down. Together they create a dynamic where winners grow aggressively up to a hard ceiling, preventing any single position from dominating the portfolio.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'Add {addPct}% to holdings up more than {threshold}%',
        params: {
          threshold: { type: 'number', default: 10, min: 5, max: 25, label: 'Min Gain to Add', hint: 'Higher = only add to clear winners. Lower = pyramid earlier.', unit: '%' },
          addPct: { type: 'number', default: 2, min: 1, max: 5, label: 'Add Amount', hint: 'Small (1-2%) = cautious pyramiding. Large (4-5%) = aggressive.', unit: '%' },
        },
        category: 'rebalancing',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['rebalance', 'pyramid', 'winners', 'add', 'season'],
    agentUseDescription: 'Adds to winning positions that exceed the gain threshold. Soft priority. Conflicts with Position Size Cap — check thresholds.',
  },

  // SR-05: Underperformer Reduction
  {
    id: 'sr-05',
    category: 'rebalancing',
    modes: 'season',
    headline: 'Underperformer Reduction',
    description: 'Gradually reduce holdings that are lagging the S&P — softer than a hard stop-loss. Winners grow, losers shrink naturally.',
    hook: 'Don\'t wait for a stop-loss — start trimming losers before they become catastrophes',
    learnMore: 'Unlike a hard stop-loss that exits entirely at a fixed level, this rule gradually reduces positions that are underperforming relative to the S&P 500 benchmark. If the S&P is up 3% over 5 days and your holding is down 2%, that\'s a 5% underperformance gap — trimming begins. The gradual approach is less disruptive than a hard exit: a 3% reduction per trigger lets you slowly rotate capital away from laggards without the whipsaw risk of a binary stop-loss. Combined with Add to Winners, this creates a natural Darwinian portfolio: winners grow, losers shrink.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Reduce by {reducePct}% any holding underperforming S&P by {threshold}% over {days} days',
        params: {
          threshold: { type: 'number', default: 5, min: 2, max: 15, label: 'Underperformance Gap', hint: 'How much worse than S&P before trimming starts.', unit: '%' },
          days: { type: 'number', default: 5, min: 3, max: 10, label: 'Measurement Window', hint: 'Shorter = react faster. Longer = more forgiving of short dips.', unit: '' },
          reducePct: { type: 'number', default: 3, min: 1, max: 5, label: 'Reduction Amount', hint: 'Gradual (1-2%) = slow fade. Aggressive (4-5%) = fast rotation.', unit: '%' },
        },
        category: 'rebalancing',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['rebalance', 'underperformer', 'benchmark', 'reduction', 'season'],
    agentUseDescription: 'Gradually reduces positions underperforming S&P by the threshold over the measurement window. Soft priority. Benchmark-relative.',
  },

  // ══════════════════════════════════════
  // SEASON STATE CATEGORY (Season Mode)
  // ══════════════════════════════════════

  // SS-01: Benchmark Gap Aggression
  {
    id: 'ss-01',
    category: 'season_state',
    modes: 'season',
    headline: 'Benchmark Gap Aggression',
    description: 'If you\'re losing the race against the S&P after a certain week, shift to higher-beta entries to catch up. Automated aggression.',
    hook: 'Losing by 3% in Week 3? Time to swing harder or accept defeat.',
    learnMore: 'In a competitive season, trailing the S&P benchmark by a meaningful margin means your current strategy isn\'t working. This rule automatically increases risk appetite by shifting entry preferences toward higher-beta stocks — names with more explosive upside potential. The activation week determines when the shift happens: early activation (Week 1) gives you maximum runway to recover, while late activation (Week 3) is a last-ditch effort. Conflicts directly with Final Week Lockdown — if both are equipped, lockdown overrides in Week 4.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'If trailing S&P by {pct}% after Week {week}, shift to higher-beta entries',
        params: {
          pct: { type: 'number', default: 3, min: 1, max: 10, label: 'Deficit Trigger', hint: 'How far behind before going aggressive.', unit: '%' },
          week: { type: 'select', default: 2, options: [{ value: 1, label: 'After Week 1' }, { value: 2, label: 'After Week 2' }, { value: 3, label: 'After Week 3' }], label: 'Activation Week', hint: 'Earlier = more time to recover. Later = last-ditch effort.' },
        },
        category: 'season_state',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['season', 'benchmark', 'aggression', 'beta', 'comeback'],
    agentUseDescription: 'Shifts entry preferences toward higher-beta stocks when trailing the S&P benchmark by the threshold after the activation week.',
  },

  // SS-02: Lead Protection Mode
  {
    id: 'ss-02',
    category: 'season_state',
    modes: 'season',
    headline: 'Lead Protection Mode',
    description: 'When you\'re ahead of the S&P, automatically tighten risk controls — protect the lead. The strategy that builds a lead ≠ the strategy that protects it.',
    hook: 'You\'ve built a lead — don\'t blow it. Shift from offense to defense.',
    learnMore: 'Building a lead and protecting a lead require opposite strategies. The aggressive moves that got you ahead — high beta, concentrated positions — become liabilities once you\'re winning. This rule automatically shifts to defensive posture when your portfolio leads the S&P by the trigger amount: trailing stops tighten to lock in gains, and new entries are capped at a maximum beta to prevent volatile additions. The opposite posture from Gap Aggression — verify thresholds don\'t overlap or you\'ll get conflicting signals.',
    difficulty: 'advanced',
    forgeTemplates: [
      {
        text: 'If leading S&P by {pct}%, tighten trailing stops to {tightPct}% and cap beta at {maxBeta}',
        params: {
          pct: { type: 'number', default: 5, min: 2, max: 15, label: 'Lead Trigger', hint: 'How far ahead before switching to defense.', unit: '%' },
          tightPct: { type: 'number', default: 5, min: 3, max: 10, label: 'Tight Trailing Stop', hint: 'Overrides your normal trailing stop with this tighter value.', unit: '%' },
          maxBeta: { type: 'number', default: 1.2, min: 0.8, max: 1.5, step: 0.1, label: 'Max Beta', hint: 'Caps how volatile your entries can be. 1.0 = market average.', unit: '' },
        },
        category: 'season_state',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['season', 'protection', 'defense', 'lead', 'trailing-stop'],
    agentUseDescription: 'Activates defensive mode when leading S&P. Tightens trailing stops and caps entry beta. Opposite posture from Gap Aggression.',
  },

  // SS-03: Final Week Lockdown
  {
    id: 'ss-03',
    category: 'season_state',
    modes: 'season',
    headline: 'Final Week Lockdown',
    description: 'In the last week of the season, block all new entries. Prevents desperation plays. Conflicts with Gap Aggression.',
    hook: 'The last week isn\'t for gambling — protect what you\'ve built',
    learnMore: 'The final week of a season is when desperation leads to bad decisions. New entries late in the season have minimal time to work and maximum risk of going wrong. This rule blocks all new position entries in Week 4, forcing the portfolio to ride out with its current holdings. The only actions allowed are exits (stop-losses, profit targets) and rebalancing. Directly conflicts with Benchmark Gap Aggression — if both are equipped, lockdown takes hard priority in Week 4.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'In the final week, don\'t open new positions',
        params: {
          enabled: { type: 'toggle', default: true, label: 'Enable Lockdown', hint: 'ON = no new positions in Week 4. OFF = trade freely through the end.' },
        },
        category: 'season_state',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['season', 'lockdown', 'final-week', 'defense'],
    agentUseDescription: 'Blocks all new entries in the final week. Hard priority — overrides all entry-seeking rules including Gap Aggression.',
  },

  // SS-04: FOMC/CPI Defensive Rotation
  {
    id: 'ss-04',
    category: 'season_state',
    modes: 'season',
    headline: 'FOMC/CPI Defensive Rotation',
    description: 'Reduce high-beta exposure before major macro events — Fed meetings and CPI reports. Connects FantasyTimes intelligence to portfolio action.',
    hook: 'The Fed moves markets more than any earnings report — don\'t get caught flat-footed',
    learnMore: 'FOMC decisions and CPI reports are the highest-impact macro events in the calendar. They can move the entire market 2-3% in minutes, and high-beta stocks amplify that move. This rule uses the season\'s macro calendar to identify upcoming Fed meetings and CPI releases, then automatically reduces high-beta positions in the days before the event. After the event passes and the market digests the news, normal positioning resumes. Think of it as a pre-emptive de-risking around known volatility catalysts.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'Reduce high-beta exposure by {reducePct}% in the {days} days before Fed/CPI',
        params: {
          reducePct: { type: 'number', default: 10, min: 5, max: 25, label: 'Reduction Amount', hint: 'How much to reduce high-beta positions.', unit: '%' },
          days: { type: 'number', default: 2, min: 1, max: 5, label: 'Days Before Event', hint: 'Start reducing this many trading days before the macro event.', unit: '' },
        },
        category: 'season_state',
        targetType: 'risk_parameter'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['season', 'macro', 'fomc', 'cpi', 'defensive'],
    agentUseDescription: 'Reduces high-beta positions ahead of scheduled macro events (FOMC, CPI). Uses macro calendar from season doc.',
  },

  // SS-05: Weekly Momentum Shift
  {
    id: 'ss-05',
    category: 'season_state',
    modes: 'season',
    headline: 'Weekly Momentum Shift',
    description: 'After each week, automatically tilt toward sectors that are outperforming. Automated sector rotation — winners get more weight.',
    hook: 'Ride the wave — if energy is ripping and tech is lagging, lean into energy',
    learnMore: 'Sector momentum tends to persist over multi-week periods — sectors that outperformed last week are statistically more likely to outperform next week. This rule automatically adjusts sector allocations at the start of each week based on the previous week\'s relative performance. Outperforming sectors get increased allocation weight, while underperformers get reduced. The shift amount controls how aggressively the portfolio rotates: subtle (1-2%) creates gentle momentum tilt, while aggressive (6-8%) makes dramatic weekly rotations.',
    difficulty: 'intermediate',
    forgeTemplates: [
      {
        text: 'After each week, tilt {shiftPct}% toward outperforming sectors',
        params: {
          shiftPct: { type: 'number', default: 3, min: 1, max: 8, label: 'Shift Amount', hint: 'Subtle (1-2%) = gentle momentum. Aggressive (6-8%) = hard rotation.', unit: '%' },
        },
        category: 'season_state',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['season', 'momentum', 'sector-rotation', 'weekly'],
    agentUseDescription: 'Tilts portfolio weight toward outperforming sectors at the start of each week. Automated momentum rotation.',
  },

  // SS-06: Pit Stop Suggestion Priority
  {
    id: 'ss-06',
    category: 'season_state',
    modes: 'season',
    headline: 'Pit Stop Suggestion Priority',
    description: 'Controls how much weight your weekend stock suggestions get during entry scans. Meta-strategic: how much do you trust yourself vs. the algorithm?',
    hook: 'Your agent works for you — but should it listen to your stock picks, or trust its own analysis?',
    learnMore: 'During the weekend pit stop, you can suggest stocks for your agent to consider. This rule controls how those suggestions are ranked against the agent\'s own candidates during entry scans. "First in Line" means your suggestions get evaluated first and are preferred if they pass entry criteria. "Equal with Others" treats them as normal candidates. "Only if No Better Options" means the agent uses its own analysis first and only falls back to your suggestions when it can\'t find better opportunities. This is a meta-strategic choice about human-AI collaboration.',
    difficulty: 'beginner',
    forgeTemplates: [
      {
        text: 'Prioritize user-suggested stocks {priority} during entry scans',
        params: {
          priority: { type: 'select', default: 'first_in_line', options: [{ value: 'first_in_line', label: 'First in Line' }, { value: 'equal_with_others', label: 'Equal with Others' }, { value: 'only_if_no_better_candidates', label: 'Only if No Better Options' }], label: 'Suggestion Priority', hint: 'First in Line = your picks get priority. Equal = no preference. Only if No Better = agent decides.' },
        },
        category: 'season_state',
        targetType: 'strategy_selection'
      }
    ],
    relatedIndicator: null,
    kbEntryId: null,
    tags: ['season', 'pit-stop', 'shortlist', 'user-influence'],
    agentUseDescription: 'Adjusts entry scan ranking for user-suggested stocks from the weekend pit stop shortlist.',
  },
];

export const FORGE_CONFLICT_PAIRS = [
  { ruleA: 'th-04', ruleB: 'th-05', message: 'House Money Pursuit and Bird-in-the-Hand Lock are opposite strategies. Choose one.' },
  { ruleA: 'gs-05', ruleB: 'gs-06', message: 'Leading Defensive and Trailing Aggressive trigger at opposite score levels. Set your Par Score Target correctly.' },
  { ruleA: 'gs-07', ruleB: 'th-10', message: 'Satisficer\'s Lock disables trading, but Scoring Posture may want swaps. Choose your endgame.' },
  { ruleA: 'th-10', ruleB: 'th-04', message: 'Harvest posture swaps after BaggerBomb, but House Money holds. Mutually exclusive.' },
  { ruleA: 'mb-01', ruleB: 'mb-09', message: 'Signal Maturation Hold vs Catastrophic Loss Eject. Eject should always override.' },
  { ruleA: 'mb-10', ruleB: 'mb-09', message: 'Midday Lull blocks swaps, but Catastrophic Eject is an emergency. Eject should win.' },
  { ruleA: 'mb-08', ruleB: 'mb-15', message: 'Disposition Override protects winners, but VWAP Invalidation forces exits. VWAP overrides reversing winners.' },
  { ruleA: 'th-01', ruleB: 'th-08', message: 'Proximity Persistence holds near thresholds, Sunk-Cost Timeout gives up. Timeout should eventually override.' },
  { ruleA: 'ts-01', ruleB: 'ts-04', message: 'Volatility Cap may restrict a stock that Performance Rotation wants to promote. Cap takes precedence.' },
  { ruleA: 'gs-10', ruleB: 'mb-11', message: 'Reversal Fade avoids afternoon runners, Power Hour increases sensitivity. Choose your final-hour philosophy.' },
  { ruleA: 'ts-07', ruleB: 'th-04', message: 'Penalty Shielding demotes near penalties, House Money widens stops. If reversing toward Bust, shielding wins.' },
];
