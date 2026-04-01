// src/data/forgeKnowledgeBase.js
// Static rule template library for The Forge Discover feed
// Zero Firestore reads — bundled with Vite at build time

export const FORGE_CATEGORIES = [
  { id: 'technical', label: 'Technical', color: '#5eead4', description: 'Price action, indicators, and chart patterns' },
  { id: 'fundamental', label: 'Fundamental', color: '#a78bfa', description: 'Financial metrics and company valuation' },
  { id: 'risk', label: 'Risk', color: '#f97066', description: 'Protective constraints and risk management' },
  { id: 'allocation', label: 'Allocation', color: '#f59e0b', description: 'Portfolio construction and position sizing' },
  { id: 'mid_battle', label: 'Mid-Battle Trading', color: '#38bdf8', description: 'Swap timing, hurdle rates, and mid-game trade management' },
  { id: 'game_state', label: 'Game State', color: '#fb923c', description: 'Phase-aware strategy shifts and score-based decisions' },
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
          threshold: { type: 'number', default: 30, min: 15, max: 40 }
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
          threshold: { type: 'number', default: 70, min: 60, max: 85 }
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
        text: 'Prefer stocks showing Bollinger Band squeeze with volume confirmation',
        params: {},
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
          period: { type: 'select', default: '50', options: ['20', '50', '200'] }
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
        text: 'Prefer stocks with bullish MACD crossover signal',
        params: {},
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
          multiplier: { type: 'select', default: '2', options: ['1.5', '2', '3'] }
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
          rank: { type: 'select', default: 'top quartile', options: ['top quartile', 'above median'] }
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
          period: { type: 'select', default: '200', options: ['50', '200'] }
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
          quarters: { type: 'select', default: '2', options: ['1', '2', '3'] }
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
          pct: { type: 'number', default: 10, min: 5, max: 30 }
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
          level: { type: 'select', default: 'sector median', options: ['sector median', '20', '15'] }
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
          threshold: { type: 'number', default: 2.0, min: 1.0, max: 3.0 }
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
          level: { type: 'select', default: 'moderate', options: ['strong', 'moderate'] }
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
          size: { type: 'select', default: 'large', options: ['large', 'mid', 'small'] }
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
          n: { type: 'number', default: 3, min: 2, max: 6 }
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
          pct: { type: 'number', default: 40, min: 20, max: 60 }
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
          level: { type: 'select', default: '2x sector average', options: ['1.5x sector average', '2x sector average', '3x sector average'] }
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
          multiplier: { type: 'select', default: '-2', options: ['-1.5', '-2', '-2.5', '-3'] }
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
          period: { type: 'select', default: '200', options: ['50', '200'] }
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
          sector: { type: 'select', default: 'any single', options: ['any single', 'Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer Discretionary', 'Consumer Staples', 'Industrials', 'Materials', 'Real Estate', 'Communication Services', 'Utilities'] },
          pct: { type: 'number', default: 40, min: 20, max: 80 }
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
          sector: { type: 'select', default: 'Technology', options: ['Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer Discretionary', 'Consumer Staples', 'Industrials', 'Materials', 'Real Estate', 'Communication Services', 'Utilities'] },
          pct: { type: 'number', default: 20, min: 10, max: 50 }
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
          attribute: { type: 'select', default: 'high momentum', options: ['high momentum', 'undervalued', 'high relative strength', 'high volume', 'positive earnings surprise'] }
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
        text: 'Spread allocation evenly across available sectors',
        params: {},
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
          minutes: { type: 'number', default: 60, min: 15, max: 180 }
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
          atr: { type: 'number', default: 0.2, min: 0.1, max: 0.5 },
          minutes: { type: 'number', default: 90, min: 45, max: 150 }
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
          atr: { type: 'number', default: 0.5, min: 0.25, max: 1.0 }
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
          signal: { type: 'select', default: 'bullish crossover', options: ['bullish crossover', 'positive histogram', 'any bullish'] }
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
          star: { type: 'number', default: 2.0, min: 1.5, max: 3.0 },
          core: { type: 'number', default: 1.5, min: 1.0, max: 2.0 }
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
          swaps: { type: 'number', default: 2, min: 1, max: 4 },
          window: { type: 'number', default: 60, min: 30, max: 120 },
          freeze: { type: 'number', default: 45, min: 15, max: 90 }
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
          threshold: { type: 'select', default: 'BaggerBomb (+1.0x)', options: ['BaggerBomb (+1.0x)', 'Double Bagger (+1.5x)'] }
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
          atr: { type: 'number', default: -1.0, min: -1.5, max: -0.5 }
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
          start: { type: 'select', default: '11:30 AM', options: ['11:00 AM', '11:30 AM', '12:00 PM'] },
          end: { type: 'select', default: '1:30 PM', options: ['1:00 PM', '1:30 PM', '2:00 PM'] }
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
          time: { type: 'select', default: '3:00 PM', options: ['2:30 PM', '3:00 PM', '3:30 PM'] },
          pct: { type: 'number', default: 50, min: 25, max: 75 }
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
          pct: { type: 'number', default: 15, min: 5, max: 30 },
          start: { type: 'select', default: '1:00 PM', options: ['12:00 PM', '1:00 PM', '2:00 PM'] }
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
          intervals: { type: 'number', default: 1, min: 1, max: 3 }
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
          indicator: { type: 'select', default: '5-min VWAP trend', options: ['5-min VWAP trend', '5-min RSI direction', '5-min MACD histogram'] }
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
          intervals: { type: 'number', default: 3, min: 2, max: 5 }
        },
        category: 'mid_battle'
      }
    ],
    relatedIndicator: 'VWAP',
    kbEntryId: null,
    tags: ['VWAP', 'thesis-invalidation', 'institutional', 'exit'],
    agentUseDescription: 'Your agent will track how many consecutive evaluation intervals each stock remains below its daily VWAP, and force an exit swap when the specified threshold is reached.',
  },
];
