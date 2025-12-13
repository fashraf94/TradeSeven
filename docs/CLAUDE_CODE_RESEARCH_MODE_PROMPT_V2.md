# Claude Code Task: Enhanced Research Mode Implementation

## Project Context

You are working on **MarketClash**, a competitive stock/crypto portfolio battle game built with React 18 + Vite. The app uses a single `App.jsx` file structure (7,000+ lines). The codebase is connected to Firebase for backend and Vercel for deployment. The app recently integrated EODHD API for market data (100,000 calls/day available).

**Key files to reference:**
- `App.jsx` - Main application (Research Mode currently around lines 3400-3700)
- `api/eodhd-proxy.js` - Vercel serverless function for EODHD API calls
- `src/services/eodhdAPI.js` - Frontend service for API calls
- Design tokens are documented in `/docs/DESIGN_TOKENS.md`

---

## Task Overview

Enhance the existing Research Mode with three major features:

1. **Fundamentals-enriched asset research** with contextual explanations
   - **IMPORTANT:** Stocks and Crypto have DIFFERENT metrics (detailed below)
2. **Personal notes system** for capturing insights during research
3. **Weekly research completion rewards** with streak bonuses

---

## Part 1: Enhanced Research Mode UI

### Tab Structure

Keep the existing Research Mode location. Modify the tab bar to have three tabs:
- **Stocks** (existing, enhanced with fundamentals + technicals)
- **Crypto** (existing, enhanced with volatility + volume + technicals)
- **My Notes** (new)

### Asset Sorting (Backend Logic)

Sort assets by a combined score of:
1. 30-day momentum (primary)
2. Market cap (secondary)

Do NOT display these sort factors to users - just use them for ordering.

### Sector Color System (Stocks Only)

Add subtle sector color coding for stocks. Use muted, desaturated colors that won't distract:

```javascript
const sectorColors = {
  technology: {
    primary: '#4a9ead',
    background: 'rgba(74, 158, 173, 0.12)',
    border: 'rgba(74, 158, 173, 0.25)',
  },
  healthcare: {
    primary: '#5a8a7a',
    background: 'rgba(90, 138, 122, 0.12)',
    border: 'rgba(90, 138, 122, 0.25)',
  },
  financials: {
    primary: '#a89a6a',
    background: 'rgba(168, 154, 106, 0.12)',
    border: 'rgba(168, 154, 106, 0.25)',
  },
  energy: {
    primary: '#b08a5a',
    background: 'rgba(176, 138, 90, 0.12)',
    border: 'rgba(176, 138, 90, 0.25)',
  },
  consumerDiscretionary: {
    primary: '#a07a8a',
    background: 'rgba(160, 122, 138, 0.12)',
    border: 'rgba(160, 122, 138, 0.25)',
  },
  consumerStaples: {
    primary: '#8a7a9a',
    background: 'rgba(138, 122, 154, 0.12)',
    border: 'rgba(138, 122, 154, 0.25)',
  },
  industrials: {
    primary: '#7a8a8a',
    background: 'rgba(122, 138, 138, 0.12)',
    border: 'rgba(122, 138, 138, 0.25)',
  },
  communication: {
    primary: '#6a7a9a',
    background: 'rgba(106, 122, 154, 0.12)',
    border: 'rgba(106, 122, 154, 0.25)',
  },
  utilities: {
    primary: '#6a7a7a',
    background: 'rgba(106, 122, 122, 0.12)',
    border: 'rgba(106, 122, 122, 0.25)',
  },
  realEstate: {
    primary: '#8a7a6a',
    background: 'rgba(138, 122, 106, 0.12)',
    border: 'rgba(138, 122, 106, 0.25)',
  },
  materials: {
    primary: '#9a7a6a',
    background: 'rgba(154, 122, 106, 0.12)',
    border: 'rgba(154, 122, 106, 0.25)',
  }
};

// Crypto uses a single color since there are no "sectors"
const cryptoColor = {
  primary: '#8a6aaa',
  background: 'rgba(138, 106, 170, 0.12)',
  border: 'rgba(138, 106, 170, 0.25)',
};
```

Apply sector colors as:
- 3px left border on asset cards
- Small dot (6px) next to sector label
- Subtle background tint on hover

---

## Part 2: STOCK Research Metrics

Stocks get **fundamentals + technicals** analysis.

### Stock Metrics (8 Total)

1. **Beta** - Volatility vs market
2. **7-Day Momentum** - Short-term trend
3. **Analyst Consensus** - Wall Street ratings
4. **Average Price Target** - Analyst upside/downside
5. **PEG Ratio** - Valuation relative to growth
6. **52-Week Range Position** - Where price sits in yearly range
7. **50-Day Moving Average** - Medium-term technical level
8. **200-Day Moving Average** - Long-term technical level

### Stock Card (Preview State)

```
┌─────────────────────────────────────────────────────────────┐
│ ┃  AAPL                              $185.50                │
│ ┃  Apple Inc                         ▲ +2.1%                │
│ ┃  ● Technology                                             │
│ ┃                                                           │
│ ┃  Beta: 1.24  │  7D: +3.2%  │  Analysts: 4.1★             │
└─────────────────────────────────────────────────────────────┘
```

### Stock Detail Page

Full detail page shows all 8 metrics with explanations:

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                                    📌 Add to Notes  │
├─────────────────────────────────────────────────────────────┤
│  AAPL · Apple Inc · ● Technology                           │
│  $185.50                              ▲ +2.1% today         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FUNDAMENTALS                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Beta                                          1.24 │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Analyst Consensus                        4.1 / 5.0 │   │
│  │  ●●●●○  24 Strong Buy │ 8 Buy │ 12 Hold │ 2 Sell   │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Avg. Price Target                           $239   │   │
│  │  ████████████████░░░░░  78% of target (+29% upside) │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PEG Ratio                                    1.85  │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  TECHNICALS                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  7-Day Momentum                               +3.2% │   │
│  │  Up 5 of last 7 days                                │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  50-Day Moving Average                      $178.50 │   │
│  │  ✓ Price ABOVE 50 MA (+3.9%)                        │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  200-Day Moving Average                     $165.20 │   │
│  │  ✓ Price ABOVE 200 MA (+12.3%)                      │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  52-Week Range                                      │   │
│  │  $163 ──────────────●───────── $237                 │   │
│  │  Currently at 71% of range                          │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠️ UPCOMING EVENT                                         │
│  Earnings Report: January 30, 2025 (After Market)          │
│  Historically moves ±5.2% on earnings days                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ✏️ ADD CUSTOM NOTE                                        │
│  [Text input...]                              [Save Note]  │
└─────────────────────────────────────────────────────────────┘
```

### Stock Metric Explanations

```javascript
const stockMetricExplanations = {
  beta: {
    intermediate: (value) => `When the market moves 1%, this stock typically moves ${value.toFixed(2)}%. ${value > 1.2 ? 'Higher beta means amplified swings - great for comeback potential, risky if the market dips.' : value < 0.8 ? 'Lower beta means steadier performance with smaller swings.' : 'Moderate volatility, moves roughly with the market.'}`,
    
    moreDepth: `Beta measures how much a stock moves compared to the overall market. Think of it like sensitivity:
    
• Beta = 1.0: Moves exactly with the market
• Beta > 1.0: More volatile (amplifies gains AND losses)
• Beta < 1.0: Less volatile (steadier, smaller swings)

For a 24-hour battle, high beta stocks can make or break your portfolio. If you're confident the market will go up, high beta gives you an edge. If uncertain, lower beta is safer.`
  },
  
  momentum7d: {
    intermediate: (value, upDays) => `${value >= 0 ? 'Up' : 'Down'} ${Math.abs(value).toFixed(1)}% over the past week. ${upDays}/7 trading days were positive. ${Math.abs(value) > 3 ? 'Strong' : Math.abs(value) > 1 ? 'Moderate' : 'Weak'} short-term momentum.`,
    
    moreDepth: `Momentum shows which direction a stock has been trending recently. Stocks in motion tend to stay in motion (at least in the short term).

For MarketClash battles:
• Strong upward momentum: Stock has tailwind, may continue
• Downward momentum: Could be a dip-buy opportunity OR a falling knife
• Flat momentum: Stable but may not give you the edge you need`
  },
  
  analystConsensus: {
    intermediate: (rating, totalAnalysts, buyPercent) => `${totalAnalysts} analysts covering this stock. ${buyPercent}% recommend buying. Average rating: ${rating.toFixed(1)}/5.`,
    
    moreDepth: `Wall Street analysts study companies professionally and issue ratings:

• Strong Buy: Very bullish, expect significant gains
• Buy: Positive outlook
• Hold: Neutral, wait and see
• Sell / Strong Sell: Negative outlook

A high consensus (4.0+) means most experts are optimistic. But remember: analysts aren't always right, and their targets are often 6-12 month outlooks, not 24-hour predictions.`
  },
  
  priceTarget: {
    intermediate: (target, current) => {
      const upside = ((target - current) / current * 100).toFixed(0);
      const progress = (current / target * 100).toFixed(0);
      return `Analysts' average target: $${target.toFixed(2)} (${upside > 0 ? '+' : ''}${upside}% from current). Price is at ${progress}% of target.`;
    },
    
    moreDepth: `Analysts set price targets - where they think the stock will be in 6-12 months.

For MarketClash:
• Stock well below target: Room to run, analysts see upside
• Stock at or above target: May be "priced in," limited near-term catalyst

This doesn't predict tomorrow's price, but shows overall sentiment.`
  },
  
  pegRatio: {
    intermediate: (value) => `PEG of ${value.toFixed(2)}. ${value < 1 ? 'Potentially undervalued relative to growth.' : value > 2 ? 'Premium valuation - growth expectations priced in.' : 'Fairly valued relative to growth expectations.'}`,
    
    moreDepth: `PEG = P/E ratio divided by earnings growth rate. It tells you if a stock's price makes sense given how fast the company is growing.

• PEG < 1.0: Potentially undervalued - growth isn't fully priced in
• PEG 1.0 - 2.0: Fairly valued
• PEG > 2.0: Expensive - you're paying a premium for growth

Lower PEG can mean more upside potential if the company delivers on growth.`
  },
  
  range52w: {
    intermediate: (position, low, high) => `Trading at ${position}% of its yearly range ($${low.toFixed(2)} - $${high.toFixed(2)}). ${position > 75 ? 'Near 52-week highs - strong momentum but limited upside.' : position < 25 ? 'Near 52-week lows - potential value or falling knife.' : 'Mid-range territory.'}`,
    
    moreDepth: `This shows where the current price sits between its lowest and highest points of the past year.

• Near 52-week high (80%+): Stock has been on a run. Could keep going, or may be due for pullback.
• Near 52-week low (20%-): Stock has been beaten down. Could be a bargain, or there's a reason it's low.
• Mid-range (40-60%): Neutral territory.`
  },
  
  ma50: {
    intermediate: (price, ma, isAbove) => {
      const pctDiff = ((price - ma) / ma * 100).toFixed(1);
      return `Price is ${isAbove ? 'ABOVE' : 'BELOW'} the 50-day MA ($${ma.toFixed(2)}) by ${Math.abs(pctDiff)}%. ${isAbove ? 'Short-term bullish signal.' : 'Short-term bearish signal.'}`;
    },
    
    moreDepth: `The 50-day moving average is the average closing price over the last 50 trading days. It's a key technical indicator:

• Price ABOVE 50 MA: Stock is in a short-term uptrend. Buyers are in control.
• Price BELOW 50 MA: Stock is in a short-term downtrend. Sellers are in control.
• Price crossing above 50 MA: Potential bullish signal (trend reversal)
• Price crossing below 50 MA: Potential bearish signal

For 24-hour battles, stocks above their 50 MA tend to have momentum on their side.`
  },
  
  ma200: {
    intermediate: (price, ma, isAbove) => {
      const pctDiff = ((price - ma) / ma * 100).toFixed(1);
      return `Price is ${isAbove ? 'ABOVE' : 'BELOW'} the 200-day MA ($${ma.toFixed(2)}) by ${Math.abs(pctDiff)}%. ${isAbove ? 'Long-term uptrend intact.' : 'Long-term downtrend - caution advised.'}`;
    },
    
    moreDepth: `The 200-day moving average represents the long-term trend. It's one of the most watched indicators:

• Price ABOVE 200 MA: Stock is in a long-term bull market. Major institutions often buy above this level.
• Price BELOW 200 MA: Stock is in a long-term bear market. Often signals fundamental problems.

Key signals:
• "Golden Cross": 50 MA crosses ABOVE 200 MA - very bullish
• "Death Cross": 50 MA crosses BELOW 200 MA - very bearish

Stocks above both their 50 and 200 MA have the strongest technical setup.`
  }
};
```

---

## Part 3: CRYPTO Research Metrics

Crypto gets **volatility + volume + technicals** analysis. NO fundamentals (no P/E, no analysts, no earnings).

### Crypto Metrics (8 Total)

1. **7-Day Volatility** - Daily price swing intensity
2. **30-Day Volatility** - Longer-term volatility trend
3. **Volatility vs BTC** - Comparison to Bitcoin as benchmark
4. **24-Hour Volume** - Trading activity
5. **Volume vs 7-Day Avg** - Is today unusual?
6. **7-Day Momentum** - Short-term trend
7. **30-Day Momentum** - Medium-term trend
8. **Distance from All-Time High** - How far from peak

### Crypto Card (Preview State)

```
┌─────────────────────────────────────────────────────────────┐
│ ┃  SOL                               $98.50                 │
│ ┃  Solana                            ▲ +5.2%                │
│ ┃                                                           │
│ ┃  Vol: 4.2%  │  7D: +12.1%  │  vs BTC: 2.1x              │
└─────────────────────────────────────────────────────────────┘
```

### Crypto Detail Page

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                                    📌 Add to Notes  │
├─────────────────────────────────────────────────────────────┤
│  SOL · Solana                                              │
│  $98.50                               ▲ +5.2% today         │
│  Rank #5 by Market Cap                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  VOLATILITY                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  7-Day Volatility                             4.2%  │   │
│  │  Average daily price swing over the past week       │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  30-Day Volatility                            3.8%  │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Volatility vs Bitcoin                        2.1x  │   │
│  │  ██████████████████████░░░░░░░░                     │   │
│  │  SOL is 2.1x more volatile than BTC                 │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  VOLUME                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  24-Hour Volume                            $2.4B    │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Volume vs 7-Day Avg                        +45%    │   │
│  │  ⚡ Unusually high volume today                     │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  MOMENTUM                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  7-Day Momentum                            +12.1%   │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  30-Day Momentum                            +8.5%   │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Distance from ATH                          -58%    │   │
│  │  All-Time High: $236 (Nov 2021)                     │   │
│  │  [Explanation + More Depth toggle]        [📌] [ℹ️] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ✏️ ADD CUSTOM NOTE                                        │
│  [Text input...]                              [Save Note]  │
└─────────────────────────────────────────────────────────────┘
```

### Crypto Metric Explanations

```javascript
const cryptoMetricExplanations = {
  volatility7d: {
    intermediate: (value) => `Average daily swing of ${value.toFixed(1)}% over the past week. ${value > 5 ? 'Very high volatility - big swings both ways.' : value > 3 ? 'Moderate volatility - expect meaningful daily moves.' : 'Relatively stable for crypto.'}`,
    
    moreDepth: `Volatility measures how much the price swings up and down. In crypto, this is measured as the average daily percentage change:

• Low volatility (<3%): Relatively stable, smaller daily moves
• Medium volatility (3-5%): Typical for major altcoins
• High volatility (>5%): Expect big swings, both gains and losses

For 24-hour battles:
• High volatility = high risk/reward. You could win big or lose big.
• Low volatility = steadier but may not give you the edge you need.`
  },
  
  volatility30d: {
    intermediate: (value, vs7d) => {
      const trend = vs7d > value ? 'Volatility is increasing' : vs7d < value ? 'Volatility is decreasing' : 'Volatility is stable';
      return `30-day average volatility: ${value.toFixed(1)}%. ${trend} compared to recent week.`;
    },
    
    moreDepth: `Comparing 30-day to 7-day volatility shows if the asset is becoming more or less volatile:

• 7-day > 30-day: Volatility is INCREASING. Market is getting more uncertain. Bigger swings likely.
• 7-day < 30-day: Volatility is DECREASING. Market is calming down. Potentially safer entry.
• 7-day ≈ 30-day: Stable volatility. Expect similar patterns to continue.`
  },
  
  volatilityVsBtc: {
    intermediate: (ratio) => `This asset is ${ratio.toFixed(1)}x ${ratio > 1 ? 'more' : 'less'} volatile than Bitcoin. ${ratio > 2 ? 'Significantly amplified risk/reward.' : ratio > 1.2 ? 'Moderately more volatile than BTC.' : ratio < 0.8 ? 'Surprisingly stable for an altcoin.' : 'Similar volatility to BTC.'}`,
    
    moreDepth: `Bitcoin is the benchmark for crypto volatility. Comparing other coins to BTC helps you understand relative risk:

• 2x+ BTC volatility: Very aggressive. Big potential gains but also big potential losses.
• 1-2x BTC volatility: Typical for major altcoins. Moderately more volatile.
• <1x BTC volatility: Rare for altcoins. Often stablecoins or very established tokens.

For MarketClash: If you want to play it "safe" in crypto battles, lower volatility vs BTC is better. If you need a comeback, higher volatility gives more upside (and downside).`
  },
  
  volume24h: {
    intermediate: (value) => {
      const formatted = value >= 1e9 ? `$${(value/1e9).toFixed(1)}B` : `$${(value/1e6).toFixed(0)}M`;
      return `${formatted} traded in the last 24 hours. ${value > 1e9 ? 'Very liquid - easy to trade.' : value > 100e6 ? 'Good liquidity.' : 'Lower liquidity - price can move on smaller trades.'}`;
    },
    
    moreDepth: `24-hour volume shows how much money is flowing through this asset:

• High volume (>$1B): Very liquid. Large trades don't move the price much.
• Medium volume ($100M-$1B): Good liquidity for most purposes.
• Low volume (<$100M): Be careful. Price can spike or crash on relatively small trades.

Volume also indicates interest. Rising volume often precedes big price moves.`
  },
  
  volumeVsAvg: {
    intermediate: (pctDiff) => {
      const direction = pctDiff > 0 ? 'higher' : 'lower';
      const magnitude = Math.abs(pctDiff);
      return `Today's volume is ${magnitude.toFixed(0)}% ${direction} than the 7-day average. ${magnitude > 50 ? '⚡ Unusual activity - something may be happening.' : magnitude > 20 ? 'Elevated interest today.' : 'Normal trading activity.'}`;
    },
    
    moreDepth: `Comparing today's volume to the recent average reveals unusual activity:

• Volume 50%+ above average: Something is happening. News, rumors, or whale activity. Expect bigger moves.
• Volume 20-50% above average: Elevated interest. Worth paying attention.
• Volume near average: Normal day. No unusual catalysts.
• Volume below average: Quiet day. Less likely to see big moves.

Unusual volume often comes BEFORE big price moves, making it a leading indicator.`
  },
  
  momentum7d: {
    intermediate: (value) => `${value >= 0 ? 'Up' : 'Down'} ${Math.abs(value).toFixed(1)}% over the past 7 days. ${Math.abs(value) > 15 ? 'Very strong move.' : Math.abs(value) > 5 ? 'Solid momentum.' : 'Relatively flat.'}`,
    
    moreDepth: `7-day momentum shows the short-term trend direction and strength:

• Strong positive (>15%): Asset is hot. Could continue or be due for pullback.
• Moderate positive (5-15%): Healthy uptrend.
• Flat (-5% to +5%): Consolidating. Waiting for direction.
• Moderate negative (-5% to -15%): Downtrend. Could be buying opportunity or falling knife.
• Strong negative (<-15%): Significant selling pressure.

In 24-hour battles, momentum often continues in the short term. But extreme momentum (>20%) often reverts.`
  },
  
  momentum30d: {
    intermediate: (value, vs7d) => {
      const trend = vs7d > value ? 'accelerating' : vs7d < value ? 'decelerating' : 'steady';
      return `${value >= 0 ? 'Up' : 'Down'} ${Math.abs(value).toFixed(1)}% over 30 days. Short-term momentum is ${trend}.`;
    },
    
    moreDepth: `Comparing 30-day to 7-day momentum reveals trend strength:

• 7-day > 30-day (both positive): Momentum is ACCELERATING. Trend is strengthening.
• 7-day < 30-day (both positive): Momentum is SLOWING. Trend may be weakening.
• 7-day positive, 30-day negative: Potential REVERSAL. Recent bounce off lows.
• 7-day negative, 30-day positive: Potential BREAKDOWN. Recent weakness in uptrend.

Accelerating momentum has the best chance of continuing into your battle window.`
  },
  
  distanceFromATH: {
    intermediate: (pctFromATH, athPrice, athDate) => {
      return `Currently ${Math.abs(pctFromATH).toFixed(0)}% below all-time high of $${athPrice.toFixed(2)} (${athDate}). ${Math.abs(pctFromATH) < 20 ? 'Near ATH - strong momentum.' : Math.abs(pctFromATH) > 70 ? 'Far from ATH - high risk or value opportunity.' : 'Significant room to recover.'}`;
    },
    
    moreDepth: `Distance from All-Time High shows where the current price sits vs the asset's peak:

• Within 20% of ATH: Asset is strong. Hitting new highs is realistic.
• 20-50% below ATH: Meaningful correction. Could recover or drop further.
• 50-80% below ATH: Major drawdown. Either a value opportunity or fundamental problems.
• 80%+ below ATH: Extreme drawdown. Very high risk. Many never recover.

Note: In crypto, ATHs are often from bull market peaks. Don't assume every coin will return to ATH.`
  }
};
```

---

## Part 4: Notes System

### Note Data Structure

```javascript
const noteSchema = {
  id: 'uuid',
  oduserId: 'firebase_user_id',
  symbol: 'AAPL',  // or 'BTC' or 'GENERAL'
  assetType: 'stock' | 'crypto',
  type: 'clipped' | 'custom',
  
  // For clipped notes:
  metricName: 'Beta',  // or 'volatility7d', etc.
  metricValue: '1.24',
  explanation: 'When the market moves 1%...',
  
  // For custom notes:
  customText: 'My custom insight',
  
  // For both:
  userAnnotation: '',  // Optional user comment added to clipped notes
  createdAt: firebase.firestore.Timestamp,
  weekOf: '2025-12-16',  // Monday of the week (ISO date string)
  isFinalized: false
};
```

### Firebase Collections

**Collection: `userResearchNotes`**
- Stores all individual notes

**Collection: `userWeeklyResearch`**
```javascript
{
  oduserId: 'firebase_user_id',
  odweekOf: '2025-12-16',
  noteCount: 12,
  assetsCovered: ['AAPL', 'MSFT', 'BTC', 'SOL'],  // Both stocks and crypto count
  isComplete: false,
  completedAt: null,
  xpAwarded: 0,
  streak: 3
}
```

### Notes Tab UI

```
┌─────────────────────────────────────────────────────────────┐
│  MY NOTES                                     Week of 12/16 │
├─────────────────────────────────────────────────────────────┤
│  WEEKLY RESEARCH PROGRESS                                   │
│  ████████████████████░░░░░░░░░░  12/20 notes               │
│  3/4 assets covered                                         │
│                                                             │
│  Complete 20 notes on 4+ assets to earn:                    │
│  🔥 175 XP (4-week streak bonus: +75 XP)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STOCKS                                                     │
│  📁 AAPL (5 notes)                              [Expand ▼]  │
│  📁 MSFT (4 notes)                              [Expand ▼]  │
│                                                             │
│  CRYPTO                                                     │
│  📁 BTC (2 notes)                               [Expand ▼]  │
│  📁 SOL (1 note)                                [Expand ▼]  │
│                                                             │
│  📁 General Strategy (0 notes)                  [Expand ▼]  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [✓ Finalize & Complete Weekly Research]                   │
└─────────────────────────────────────────────────────────────┘
```

### Notes Mini-Tab During Draft

In Classic Portfolio Builder, show collapsible notes below portfolio cart:

**Collapsed:**
```
📝 MY NOTES (12)                                 [Expand ▲]
Quick view: AAPL, MSFT, BTC, SOL
```

**Expanded:**
```
📝 MY NOTES                                     [Collapse ▼]
────────────────────────────────────────────────────────────
🔍 [Search notes...]
────────────────────────────────────────────────────────────
STOCKS
  AAPL (5)
  • Beta 1.24 - amplified swings
  • Above 50 & 200 MA - strong technical setup

  MSFT (4)
  • Steady performer, good anchor

CRYPTO
  BTC (2)
  • Low volatility for crypto
  • Use as stable base

  SOL (1)
  • 2x BTC volatility - high risk/reward
```

---

## Part 5: Weekly Research Rewards

### Completion Requirements

```javascript
const RESEARCH_REQUIREMENTS = {
  minimumNotes: 20,
  minimumAssets: 4,  // Can be any mix of stocks and crypto
  mustFinalize: true
};
```

### XP Reward Calculation

```javascript
const calculateResearchXP = (streak) => {
  const baseXP = 100;
  
  const streakBonuses = {
    1: 0,
    2: 25,
    3: 50,
    4: 75,
    5: 100,
    6: 100,
    7: 100,
    8: 100,
    9: 100,
    10: 200  // Max bonus
  };
  
  const bonus = streak >= 10 ? 200 : (streakBonuses[streak] || 100);
  
  return {
    base: baseXP,
    streakBonus: bonus,
    total: baseXP + bonus
  };
};
```

### Week Definition

- Week starts **Monday 00:00 UTC**
- Week ends **Sunday 23:59 UTC**
- Streak breaks if user doesn't complete by Sunday midnight

---

## Part 6: API Integration

### Stock Fundamentals - New Serverless Function

Create `api/eodhd-stock-fundamentals.js`:

```javascript
export default async function handler(req, res) {
  const { symbol } = req.query;
  const API_KEY = process.env.EODHD_API_KEY;
  
  try {
    const [highlights, technicals, analysts, earnings] = await Promise.all([
      fetch(`https://eodhd.com/api/fundamentals/${symbol}.US?api_token=${API_KEY}&fmt=json&filter=Highlights`).then(r => r.json()),
      fetch(`https://eodhd.com/api/fundamentals/${symbol}.US?api_token=${API_KEY}&fmt=json&filter=Technicals`).then(r => r.json()),
      fetch(`https://eodhd.com/api/fundamentals/${symbol}.US?api_token=${API_KEY}&fmt=json&filter=AnalystRatings`).then(r => r.json()),
      fetch(`https://eodhd.com/api/fundamentals/${symbol}.US?api_token=${API_KEY}&fmt=json&filter=Earnings`).then(r => r.json())
    ]);
    
    const result = {
      symbol,
      // Fundamentals
      beta: technicals.Beta,
      peRatio: highlights.PERatio,
      pegRatio: highlights.PEGRatio,
      targetPrice: highlights.WallStreetTargetPrice,
      
      // Technicals  
      fiftyTwoWeekHigh: technicals['52WeekHigh'],
      fiftyTwoWeekLow: technicals['52WeekLow'],
      fiftyDayMA: technicals['50DayMA'],
      twoHundredDayMA: technicals['200DayMA'],
      
      // Analysts
      analystRating: analysts.Rating,
      strongBuy: analysts.StrongBuy,
      buy: analysts.Buy,
      hold: analysts.Hold,
      sell: analysts.Sell,
      strongSell: analysts.StrongSell,
      
      // Earnings
      nextEarningsDate: findNextEarningsDate(earnings),
      earningsBeforeAfter: findEarningsTimeOfDay(earnings)
    };
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function findNextEarningsDate(earnings) {
  if (!earnings?.History) return null;
  const now = new Date();
  const futureEarnings = Object.values(earnings.History)
    .filter(e => new Date(e.reportDate) > now)
    .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));
  return futureEarnings[0]?.reportDate || null;
}

function findEarningsTimeOfDay(earnings) {
  if (!earnings?.History) return null;
  const now = new Date();
  const futureEarnings = Object.values(earnings.History)
    .filter(e => new Date(e.reportDate) > now)
    .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));
  return futureEarnings[0]?.beforeAfterMarket || null;
}
```

### Crypto Data - Check EODHD Crypto Support

EODHD provides crypto data. Create `api/eodhd-crypto-data.js`:

```javascript
export default async function handler(req, res) {
  const { symbol } = req.query;  // e.g., 'BTC', 'ETH', 'SOL'
  const API_KEY = process.env.EODHD_API_KEY;
  
  try {
    // Fetch historical data for volatility calculation
    const endDate = new Date().toISOString().split('T')[0];
    const startDate30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const [priceHistory, btcHistory] = await Promise.all([
      fetch(`https://eodhd.com/api/eod/${symbol}-USD.CC?api_token=${API_KEY}&fmt=json&from=${startDate30d}&to=${endDate}`).then(r => r.json()),
      fetch(`https://eodhd.com/api/eod/BTC-USD.CC?api_token=${API_KEY}&fmt=json&from=${startDate30d}&to=${endDate}`).then(r => r.json())
    ]);
    
    // Calculate metrics
    const volatility7d = calculateVolatility(priceHistory.slice(-7));
    const volatility30d = calculateVolatility(priceHistory);
    const btcVolatility7d = calculateVolatility(btcHistory.slice(-7));
    
    const momentum7d = calculateMomentum(priceHistory, 7);
    const momentum30d = calculateMomentum(priceHistory, 30);
    
    const latestPrice = priceHistory[priceHistory.length - 1];
    const volume24h = latestPrice.volume * latestPrice.close;  // Approximate USD volume
    const avgVolume7d = priceHistory.slice(-7).reduce((sum, d) => sum + d.volume * d.close, 0) / 7;
    
    // Get ATH (would need historical endpoint or cache this)
    const athData = await getATHData(symbol, API_KEY);
    
    const result = {
      symbol,
      volatility7d,
      volatility30d,
      volatilityVsBtc: volatility7d / btcVolatility7d,
      volume24h,
      volumeVsAvg: ((volume24h - avgVolume7d) / avgVolume7d) * 100,
      momentum7d,
      momentum30d,
      currentPrice: latestPrice.close,
      athPrice: athData.price,
      athDate: athData.date,
      distanceFromATH: ((latestPrice.close - athData.price) / athData.price) * 100
    };
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function calculateVolatility(priceData) {
  if (priceData.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < priceData.length; i++) {
    returns.push((priceData[i].close - priceData[i-1].close) / priceData[i-1].close * 100);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / returns.length);
}

function calculateMomentum(priceData, days) {
  const recent = priceData.slice(-days);
  if (recent.length < 2) return 0;
  return ((recent[recent.length - 1].close - recent[0].close) / recent[0].close) * 100;
}
```

### Caching Strategy

Cache both stock and crypto data:
- Stock fundamentals: 24 hours (doesn't change often)
- Crypto metrics: 1 hour (more volatile)
- Store in localStorage with timestamps

---

## Part 7: New State Variables

```javascript
// Research Mode enhancements
const [researchActiveTab, setResearchActiveTab] = useState('stocks'); // 'stocks' | 'crypto' | 'notes'
const [selectedAssetDetail, setSelectedAssetDetail] = useState(null);
const [selectedAssetType, setSelectedAssetType] = useState(null); // 'stock' | 'crypto'
const [stockFundamentals, setStockFundamentals] = useState({}); // { AAPL: {...}, MSFT: {...} }
const [cryptoMetrics, setCryptoMetrics] = useState({}); // { BTC: {...}, ETH: {...} }
const [showMoreDepth, setShowMoreDepth] = useState({}); // { metricName: boolean }

// Notes system
const [userNotes, setUserNotes] = useState([]);
const [weeklyProgress, setWeeklyProgress] = useState(null);
const [notesExpanded, setNotesExpanded] = useState({});
const [draftNotesExpanded, setDraftNotesExpanded] = useState(false);

// Research rewards
const [researchStreak, setResearchStreak] = useState(0);
const [showResearchComplete, setShowResearchComplete] = useState(false);
```

---

## Visual Style Guidelines

Follow the existing dark theme from DESIGN_TOKENS.md:
- Background: `#0d1117` (primary), `#161b22` (cards)
- Borders: `#21262d`
- Text: `#ffffff` (primary), `#8b949e` (muted)
- Accents: Use sector colors sparingly for stocks, single purple accent for crypto
- Keep the Bloomberg terminal / dark focused aesthetic
- Animations: Subtle, 0.2s ease transitions

---

## Implementation Order

1. **Phase 1:** Create stock fundamentals API endpoint
2. **Phase 2:** Create crypto metrics API endpoint
3. **Phase 3:** Build stock detail page with all 8 metrics
4. **Phase 4:** Build crypto detail page with all 8 metrics
5. **Phase 5:** Add explanations + More Depth toggles
6. **Phase 6:** Implement notes clipping + custom notes
7. **Phase 7:** Build Notes tab with stock/crypto organization
8. **Phase 8:** Add notes mini-tab to draft flow
9. **Phase 9:** Weekly progress tracking + finalization
10. **Phase 10:** XP rewards + streak system

---

## Testing Checklist

- [ ] Stock fundamentals load for all 15 stocks
- [ ] Crypto metrics load for all 18 cryptos
- [ ] Sector colors display correctly on stock cards
- [ ] Stock metrics show correct explanations
- [ ] Crypto metrics show correct explanations (different from stocks!)
- [ ] Volatility vs BTC calculates correctly
- [ ] More Depth toggle works for all metrics
- [ ] Notes save to Firebase with correct assetType
- [ ] Notes persist across sessions
- [ ] Notes tab shows stocks and crypto separately
- [ ] Notes mini-tab appears in draft
- [ ] Weekly progress counts both stocks and crypto
- [ ] Finalization awards correct XP
- [ ] Streak increments and resets properly

---

## Reference Files

- Full UI specification: See `RESEARCH_MODE_UI_SPEC.md` in project docs
- EODHD API documentation: See `EODHD_MarketClash_Feature_Roadmap.md`
- Design tokens: See `DESIGN_TOKENS.md`
