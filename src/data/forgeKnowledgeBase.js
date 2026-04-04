// src/data/forgeKnowledgeBase.js
// Static rule template library for The Forge Discover feed
// Zero Firestore reads — bundled with Vite at build time

export const FORGE_CATEGORIES = [
  { id: 'technical', label: 'Technical', color: '#5eead4', description: 'Price action, indicators, and chart patterns' },
  { id: 'fundamental', label: 'Fundamental', color: '#a78bfa', description: 'Financial metrics and company valuation' },
  { id: 'risk', label: 'Risk', color: '#f97066', description: 'Protective constraints and risk management' },
  { id: 'allocation', label: 'Allocation', color: '#f59e0b', description: 'Portfolio construction and position sizing' },
  { id: 'mid_battle', label: 'Mid-Battle Trading', color: '#6366F1', description: 'Swap timing, hurdle rates, and mid-game trade management' },
  { id: 'game_state', label: 'Game State', color: '#94A3B8', description: 'Phase-aware strategy shifts and score-based decisions' },
  { id: 'threshold', label: 'Threshold Strategy', color: '#f472b6', description: 'Scoring threshold proximity and bonus optimization' },
  { id: 'tier_strategy', label: 'Tier Strategy', color: '#34d399', description: 'Dynamic tier allocation and multiplier management' },
];

export const FORGE_RULE_TEMPLATES = [
  // ══════════════════════════════════════
  // TECHNICAL CATEGORY
  // ══════════════════════════════════════
  {
    id: 'tech-rsi-oversold',
    category: 'technical',
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
