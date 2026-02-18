/**
 * Intelligence Prompt — System prompt and prompt assembly for the Stock Intelligence Agent.
 *
 * Exports:
 *   INTELLIGENCE_SYSTEM_PROMPT — The educational personality prompt
 *   detectQuestionType(question) — Returns array of relevant data categories
 *   buildIntelligencePrompt(question, stockData, context) — Assembles the full prompt
 */

// ============================================
// INDICATOR EDUCATION DICTIONARY
// ============================================

export const INDICATOR_EDUCATION = {
  rsi: {
    simple: 'Measures buying/selling momentum on a 0-100 scale',
    detail: 'RSI compares the magnitude of recent gains to recent losses over 14 periods. Above 70 = aggressive buying, below 30 = aggressive selling. It shows momentum, not direction.',
    common_mistake: 'RSI above 70 does NOT mean "sell" — in strong uptrends, RSI can stay above 70 for weeks. Think of it as "running hot" not "broken."',
  },
  macd: {
    simple: 'Shows whether short-term momentum is accelerating or decelerating',
    detail: 'MACD tracks the gap between 12-day and 26-day exponential moving averages. When the gap widens, momentum is growing; when it narrows, momentum is fading. The signal line (9-day EMA of MACD) flags crossover moments.',
    common_mistake: 'A bearish MACD crossover during an uptrend often just means "slowing down" not "reversing." Many traders sell too early on MACD signals alone.',
  },
  bollinger: {
    simple: 'Shows whether price is unusually high or low relative to recent range',
    detail: 'Bollinger Bands plot 2 standard deviations above and below a 20-day average. %B shows where price sits within the bands (0 = lower band, 1 = upper band). Bandwidth measures volatility — narrow bands often precede big moves.',
    common_mistake: 'Touching the upper band does NOT mean "overbought." In strong trends, price can "walk the band" for extended periods. The bands measure volatility, not direction.',
  },
  atr: {
    simple: 'Measures how much a stock typically moves per day (volatility)',
    detail: 'Average True Range averages the daily high-low range over 14 days, including gaps. A $5 ATR means the stock typically moves $5 in a day. Higher ATR = more volatile = wider expected price swings.',
    common_mistake: 'ATR does NOT indicate direction. A high ATR just means large moves are normal for this stock — it says nothing about whether the next move is up or down.',
  },
  volume: {
    simple: 'Tracks how many shares are trading relative to the recent average',
    detail: 'Relative volume (RVOL) compares current volume to the 20-day average. 1.5x+ suggests institutional activity. Volume confirms price moves — a breakout on low volume is suspicious, while high volume suggests conviction.',
    common_mistake: 'High volume is NOT always bullish. Volume just means participation — it matters whether the volume is on up-moves or down-moves. A spike in volume on a decline is a warning, not a buy signal.',
  },
  sma50: {
    simple: 'The average closing price over the last 50 days — shows the medium-term trend',
    detail: 'Price above SMA50 generally indicates a medium-term uptrend. The distance from SMA50 (extension) shows how far price has deviated from the trend. Large extensions historically revert.',
    common_mistake: 'A stock dropping below SMA50 is not an automatic sell signal. The best trends regularly test and bounce off the 50-day. Look at the slope and volume, not just the cross.',
  },
  sma200: {
    simple: 'The average closing price over the last 200 days — the primary long-term trend indicator',
    detail: 'The 200-day moving average is widely watched by institutions. Price above = long-term uptrend. The "golden cross" (50-day crossing above 200-day) and "death cross" (below) are famous institutional signals.',
    common_mistake: 'The golden cross and death cross are LAGGING signals — by the time they trigger, much of the move has already happened. They confirm trends, they don\'t predict them.',
  },
  pe_ratio: {
    simple: 'Price divided by earnings — shows how much investors pay per dollar of profit',
    detail: 'A P/E of 25 means investors pay $25 for every $1 of annual earnings. Higher P/E = higher growth expectations baked in. Must be compared to sector averages and historical ranges to be meaningful.',
    common_mistake: 'Low P/E does NOT mean "cheap" and high P/E does NOT mean "expensive." A P/E of 8 on a declining business can be a value trap, while a P/E of 50 on a fast grower may be reasonable.',
  },
};

// ============================================
// SYSTEM PROMPT
// ============================================

export const INTELLIGENCE_SYSTEM_PROMPT = `You are the MarketClash Intelligence Agent — an educational market analyst that helps users understand stocks and crypto through data-backed analysis.

YOUR ROLE:
- Present what technical and fundamental indicators are showing
- Explain what the data means in plain language
- Always show both bullish and bearish perspectives
- Teach users to interpret data themselves

YOUR RULES — THESE ARE ABSOLUTE:
1. NEVER recommend buying, selling, or any specific action
2. NEVER use: "you should", "I recommend", "consider buying", "good pick", "bad pick", "I would", "the play is", "the move is"
3. ALWAYS use: "the data shows", "indicators suggest", "historically", "this pattern has been associated with", "the risk factor here is"
4. EVERY bullish point MUST be paired with a risk or bearish counterpoint
5. EVERY claim MUST reference a specific data point (number, percentage, date)
6. When discussing ANY metric, briefly explain what it measures and why it matters
7. NEVER reference MarketClash game modes, battles, or scoring mechanics
8. You are a TEACHER, not an advisor. Your job is to make the user smarter, not to tell them what to do.

FLASH'S TRADING WISDOM — weave these educational principles into your analysis where relevant:
- Correlation Breakdown: "Stocks that normally move together can diverge during stress events. Just because NVDA and AMD both make chips doesn't mean they'll react the same way to earnings."
- Price Confirmation: "A single indicator in isolation is noise. Look for confirmation — if RSI says overbought but volume is rising and MACD is still bullish, that's different from RSI overbought with declining volume."
- Volume Validation: "Price moves without volume are like promises without follow-through. A breakout on low volume is a setup for a trap — smart money tends to move on above-average volume."
- Sector Context: "A stock's move means nothing without sector context. Is AAPL up 3% while all tech is up 4%? That's actually relative weakness, not strength."
- Mean Reversion vs Trend: "The most common beginner mistake is confusing a pullback in an uptrend with a reversal. In strong trends, dips to the 50-day MA are where institutions add, not where trends die."
- Time Frame Alignment: "A stock can be bullish on the daily and bearish on the weekly. Always specify which time frame you're analyzing — a day trader and a swing trader can both be right about the same stock at the same time."

RESPONSE FORMAT: Return valid JSON only (no markdown fences):
{
  "headline": "Brief 5-8 word snapshot (e.g., 'NVDA Momentum Strong, Nearing Resistance')",
  "content": "2-4 paragraph educational analysis. Lead with the most relevant data for the question asked. Explain indicator concepts inline. Use specific numbers. Balance bullish and bearish perspectives.",
  "dataPoints": {
    // Include only the indicators most relevant to the question
    // Each with: value, context label, and a 1-sentence explanation
  },
  "bullCase": "1-2 sentences on what the data shows favorably",
  "bearCase": "1-2 sentences on risks, concerns, or warning signals",
  "educationalNote": "1-2 sentences explaining a key concept mentioned in the analysis, including a common mistake beginners make with that concept (e.g., 'RSI measures momentum on a 0-100 scale. Common mistake: RSI above 70 does NOT mean sell — in strong uptrends, RSI can stay elevated for weeks.')"
}

EDUCATIONAL LANGUAGE EXAMPLES:

GOOD: "NVDA's RSI reads 72, which measures buying momentum on a 0-100 scale. Readings above 70 historically indicate aggressive buying that often precedes a cooling period. However, in strong uptrends, RSI can remain elevated for extended periods — the 2023 AI rally saw NVDA's RSI above 70 for 6 consecutive weeks."

BAD: "NVDA is overbought at RSI 72. You should wait for a pullback before adding it to your portfolio."

GOOD: "The stock trades 8% above its 50-day moving average of $810, which measures the medium-term trend. This separation — called 'extension' — has historically been followed by either a pullback to the average or a sideways consolidation that lets the average catch up."

BAD: "The stock is extended and due for a pullback. I'd wait for it to come back to the 50-day MA."

GOOD: "Volume has averaged 1.4x the 20-day average over the past 5 sessions. Elevated volume during a price advance is generally considered confirming — it suggests the move has broad participation rather than being driven by a few large trades."

BAD: "Strong volume confirms the breakout. This is a bullish setup."

COMPARISON MODE — When comparing two assets:
- Present data for BOTH assets side by side
- Focus on the specific dimension the user asked about (technicals, fundamentals, momentum, etc.)
- Never declare a "winner" — present the data and let the user draw conclusions
- Highlight meaningful DIFFERENCES, not just raw numbers
- Use relative framing: "AAPL trades at 28x earnings while MSFT trades at 35x, but MSFT's revenue growth of 15% outpaces AAPL's 8%"
- End with: "These metrics paint different pictures depending on what matters most to you as an investor."`;

// ============================================
// QUESTION TYPE DETECTION (returns array)
// ============================================

const KEYWORD_MAP = {
  technical: [
    'chart', 'technical', 'rsi', 'macd', 'support', 'resistance',
    'oversold', 'overbought', 'moving average', 'volume', 'pattern',
    'bollinger', 'atr', 'momentum', 'trend', 'breakout', 'breakdown',
    'sma', 'ema', 'indicator',
  ],
  fundamental: [
    'valuation', 'p/e', 'pe ratio', 'earnings per share', 'revenue',
    'growth', 'fundamental', 'analyst', 'rating', 'market cap',
    'margin', 'profit', 'cash flow', 'balance sheet', 'debt',
    'peg', 'price to',
  ],
  earnings: [
    'earnings', 'report', 'beat', 'miss', 'guidance', 'quarter',
    'eps', 'earnings call', 'results', 'fiscal',
  ],
  news: [
    'news', 'happening', 'why', 'moving', 'today', 'dropped',
    'surged', 'crash', 'rally', 'catalyst', 'announcement',
    'headline', 'recent',
  ],
  comparison: [
    ' vs ', ' versus ', 'compare', 'compared', 'or better', 'which is',
    ' vs.', 'head to head',
  ],
};

// Price movement words that signal technical context is needed alongside news
const PRICE_MOVEMENT_WORDS = [
  'drop', 'crash', 'down', 'fell', 'rally', 'surge', 'up',
  'spike', 'moon', 'tank', 'plunge', 'soar', 'rip', 'dump',
  'pump', 'collapse', 'skyrocket',
];

// Which data fields each question type needs
const DATA_FIELDS_BY_TYPE = {
  technical: ['daily', 'technicals'],
  fundamental: ['fundamentals'],
  earnings: ['earnings', 'fundamentals'],
  news: ['news', 'daily'],
  comparison: ['daily', 'technicals', 'fundamentals', 'news', 'earnings'],
  general: ['technicals', 'fundamentals'],
};

/**
 * Detect question types from user's question.
 * Returns an array of types, with compound rules applied.
 *
 * @param {string} question
 * @returns {string[]} Array of detected types, e.g. ['earnings', 'news']
 */
export function detectQuestionType(question) {
  if (!question) return ['general'];

  const lower = ` ${question.toLowerCase()} `;
  const types = [];

  // Check each category
  for (const [type, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        types.push(type);
        break; // One match per category is enough
      }
    }
  }

  // Compound rules
  // 1. Earnings → always add news (post-earnings moves are narrative-driven)
  if (types.includes('earnings') && !types.includes('news')) {
    types.push('news');
  }

  // 2. News + price movement words → add technical (volume/price context explains the move)
  if (types.includes('news')) {
    const hasPriceMovement = PRICE_MOVEMENT_WORDS.some(w => lower.includes(w));
    if (hasPriceMovement && !types.includes('technical')) {
      types.push('technical');
    }
  }

  // 3. Comparison overrides — include everything for both symbols
  // (comparison is already in types if detected, and DATA_FIELDS_BY_TYPE handles it)

  // Default to general if nothing matched
  if (types.length === 0) {
    return ['general'];
  }

  return types;
}

// ============================================
// COMPARISON MODE — detect two symbols
// ============================================

// Common stock/crypto symbols pattern: 1-5 uppercase letters or crypto like BTC, ETH
const SYMBOL_PATTERN = /\b([A-Z]{1,5})\b/g;

// Words that look like symbols but aren't
const SYMBOL_BLACKLIST = new Set([
  'I', 'A', 'THE', 'AND', 'OR', 'NOT', 'FOR', 'IS', 'IT', 'AT', 'TO',
  'IN', 'ON', 'OF', 'DO', 'IF', 'MY', 'UP', 'SO', 'NO', 'BE', 'BY',
  'VS', 'AN', 'AM', 'AS', 'HAS', 'HAD', 'WAS', 'ARE', 'HOW', 'WHY',
  'CAN', 'ALL', 'MAY', 'BUT', 'ITS', 'NOW', 'NEW', 'OLD', 'TOP',
  'RSI', 'MACD', 'SMA', 'EMA', 'ATR', 'PE', 'PEG', 'EPS', 'IPO',
  'CEO', 'CFO', 'CTO', 'AI', 'GDP', 'ETF', 'SEC', 'NYSE', 'NASDAQ',
  'USD', 'API', 'YOY', 'QOQ', 'MA', 'BB', 'USA',
]);

/**
 * Detect if the user is comparing two symbols.
 * Returns null if no comparison detected, or { symbolA, symbolB } if found.
 *
 * @param {string} question
 * @returns {{ symbolA: string, symbolB: string } | null}
 */
export function detectComparisonSymbols(question) {
  if (!question) return null;

  // Must contain comparison keywords
  const lower = question.toLowerCase();
  const hasComparisonWord = [' vs ', ' vs.', ' versus ', 'compare', 'compared', 'or better', 'which is', 'head to head']
    .some(kw => lower.includes(kw));
  if (!hasComparisonWord) return null;

  // Extract potential symbols (uppercase 1-5 letter words)
  const matches = [];
  let match;
  while ((match = SYMBOL_PATTERN.exec(question)) !== null) {
    const sym = match[1];
    if (!SYMBOL_BLACKLIST.has(sym) && sym.length >= 2) {
      matches.push(sym);
    }
  }

  // Need exactly 2 unique symbols for comparison
  const unique = [...new Set(matches)];
  if (unique.length >= 2) {
    return { symbolA: unique[0], symbolB: unique[1] };
  }

  return null;
}

// ============================================
// DATA FORMATTING HELPERS (token-efficient)
// ============================================

function formatPrice(price) {
  if (!price) return null;

  const parts = [`Current: $${price.current}`];
  if (price.changePercent != null) {
    const sign = price.changePercent >= 0 ? '+' : '';
    parts.push(`Change: ${sign}${price.changePercent}%`);
  }
  if (price.previousClose) parts.push(`Prev Close: $${price.previousClose}`);
  if (price.fallback) parts.push('(price from last close, real-time unavailable)');

  return parts.join(' | ');
}

function formatTechnicals(technicals) {
  if (!technicals) return null;

  const lines = [];

  if (technicals.rsi) {
    lines.push(`RSI(14): ${technicals.rsi.value} (${technicals.rsi.zone})`);
  }
  if (technicals.macd) {
    const m = technicals.macd;
    const signal = m.histogram > 0 ? 'bullish' : 'bearish';
    lines.push(`MACD: ${m.macd} | Signal: ${m.signal} | Histogram: ${m.histogram} (${signal})`);
  }
  if (technicals.sma) {
    const s = technicals.sma;
    const parts = [];
    if (s.sma20 != null) parts.push(`SMA20: $${s.sma20}`);
    if (s.sma50 != null) parts.push(`SMA50: $${s.sma50}`);
    if (s.sma200 != null) parts.push(`SMA200: $${s.sma200}`);
    if (parts.length > 0) lines.push(parts.join(' | '));
  }
  if (technicals.ema) {
    const e = technicals.ema;
    const parts = [];
    if (e.ema12 != null) parts.push(`EMA12: $${e.ema12}`);
    if (e.ema26 != null) parts.push(`EMA26: $${e.ema26}`);
    if (e.ema50 != null) parts.push(`EMA50: $${e.ema50}`);
    if (parts.length > 0) lines.push(parts.join(' | '));
  }
  if (technicals.bollingerBands) {
    const b = technicals.bollingerBands;
    lines.push(`Bollinger: Upper $${b.upper} | Mid $${b.middle} | Lower $${b.lower} | %B: ${b.percentB}`);
  }
  if (technicals.atr) {
    lines.push(`ATR(14): $${technicals.atr.value} (${technicals.atr.percent}% of price, ${technicals.atr.regime} volatility)`);
  }
  if (technicals.volumeProfile) {
    const v = technicals.volumeProfile;
    lines.push(`Volume: ${v.ratio}x avg (${v.tier}) | Current: ${formatVolume(v.currentVolume)} | Avg: ${formatVolume(v.avgVolume)}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function formatFundamentals(fundamentals) {
  if (!fundamentals) return null;

  const lines = [];

  if (fundamentals.name) lines.push(`Company: ${fundamentals.name}`);
  if (fundamentals.sector) lines.push(`Sector: ${fundamentals.sector} | Industry: ${fundamentals.industry || 'N/A'}`);

  const metrics = [];
  if (fundamentals.marketCap != null) metrics.push(`Market Cap: ${formatMarketCap(fundamentals.marketCap)}`);
  if (fundamentals.peRatio != null) metrics.push(`P/E: ${fundamentals.peRatio}`);
  if (fundamentals.pegRatio != null) metrics.push(`PEG: ${fundamentals.pegRatio}`);
  if (fundamentals.profitMargin != null) metrics.push(`Profit Margin: ${(fundamentals.profitMargin * 100).toFixed(1)}%`);
  if (fundamentals.revenueGrowthYOY != null) metrics.push(`Revenue Growth YoY: ${(fundamentals.revenueGrowthYOY * 100).toFixed(1)}%`);
  if (fundamentals.beta != null) metrics.push(`Beta: ${fundamentals.beta}`);
  if (metrics.length > 0) lines.push(metrics.join(' | '));

  const range = [];
  if (fundamentals.week52High != null) range.push(`52W High: $${fundamentals.week52High}`);
  if (fundamentals.week52Low != null) range.push(`52W Low: $${fundamentals.week52Low}`);
  if (fundamentals.ma50 != null) range.push(`50D MA: $${fundamentals.ma50}`);
  if (fundamentals.ma200 != null) range.push(`200D MA: $${fundamentals.ma200}`);
  if (range.length > 0) lines.push(range.join(' | '));

  if (fundamentals.targetPrice != null) {
    lines.push(`Analyst Target: $${fundamentals.targetPrice} | Rating: ${fundamentals.analystRating?.toFixed(1) || 'N/A'}/5`);
  }
  if (fundamentals.analystConsensus && fundamentals.analystConsensus.totalAnalysts > 0) {
    const c = fundamentals.analystConsensus;
    lines.push(`Consensus: ${c.buyPercent}% buy | ${c.totalAnalysts} analysts (StrongBuy:${c.strongBuy} Buy:${c.buy} Hold:${c.hold} Sell:${c.sell} StrongSell:${c.strongSell})`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function formatNews(news) {
  if (!news || !Array.isArray(news) || news.length === 0) return null;

  return news.map((item, i) => {
    const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `${i + 1}. "${item.title}" (${item.source}${date ? ', ' + date : ''})`;
  }).join('\n');
}

function formatEarnings(earnings) {
  if (!earnings) return null;

  const lines = [];

  if (earnings.nextEarningsDate) {
    lines.push(`Next Earnings: ${earnings.nextEarningsDate}`);
  }

  if (earnings.history && earnings.history.length > 0) {
    lines.push('Recent Earnings:');
    for (const e of earnings.history) {
      const label = e.quarter || e.reportDate;
      const beat = e.beat === true ? 'BEAT' : e.beat === false ? 'MISS' : 'N/A';
      const diff = e.epsDifference != null ? ` (${e.epsDifference > 0 ? '+' : ''}${e.epsDifference})` : '';
      lines.push(`  ${label}: EPS $${e.epsActual} vs $${e.epsEstimate} est → ${beat}${diff}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function formatDailyOHLCV(daily) {
  if (!daily || !Array.isArray(daily) || daily.length === 0) return null;

  // Last 5 days only (newest first)
  return daily.slice(0, 5).map(d => {
    const v = formatVolume(d.volume);
    return `${d.date}: O:${d.open} H:${d.high} L:${d.low} C:${d.close} V:${v}`;
  }).join('\n');
}

function formatVolume(vol) {
  if (!vol) return '0';
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`;
  return String(vol);
}

function formatMarketCap(cap) {
  if (!cap) return 'N/A';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap}`;
}

// ============================================
// MAIN EXPORT: buildIntelligencePrompt
// ============================================

// ============================================
// INDICATOR EDUCATION INJECTION HELPER
// ============================================

/**
 * Select relevant indicator education entries based on question types and
 * which data is present in stockData. Returns a formatted string for injection
 * into the user prompt.
 */
function buildIndicatorEducation(questionTypes, stockData) {
  const entries = [];

  // Map question types to relevant indicators
  const indicatorsForType = {
    technical: ['rsi', 'macd', 'bollinger', 'atr', 'volume', 'sma50', 'sma200'],
    fundamental: ['pe_ratio'],
    earnings: ['pe_ratio'],
    news: ['volume'],
    general: ['rsi', 'volume', 'pe_ratio'],
  };

  const seen = new Set();
  for (const type of questionTypes) {
    const indicators = indicatorsForType[type] || indicatorsForType.general;
    for (const key of indicators) {
      if (seen.has(key)) continue;
      seen.add(key);
      const ed = INDICATOR_EDUCATION[key];
      if (ed) {
        entries.push(`${key.toUpperCase()}: ${ed.detail} COMMON MISTAKE: ${ed.common_mistake}`);
      }
    }
  }

  // Also check which indicators are present in the data and add relevant education
  if (stockData.technicals) {
    if (stockData.technicals.rsi && !seen.has('rsi')) {
      entries.push(`RSI: ${INDICATOR_EDUCATION.rsi.detail} COMMON MISTAKE: ${INDICATOR_EDUCATION.rsi.common_mistake}`);
    }
    if (stockData.technicals.macd && !seen.has('macd')) {
      entries.push(`MACD: ${INDICATOR_EDUCATION.macd.detail} COMMON MISTAKE: ${INDICATOR_EDUCATION.macd.common_mistake}`);
    }
  }

  if (entries.length === 0) return null;
  return entries.join('\n');
}

// ============================================
// MAIN EXPORT: buildIntelligencePrompt
// ============================================

/**
 * Build the full prompt for the Intelligence Agent.
 * Supports single-asset and comparison modes.
 *
 * @param {string} question — User's question
 * @param {object} stockData — From getStockAnalysisData() (primary asset)
 * @param {object} context — Optional { currentScreen, gameMode, userWatchlist }
 * @param {object} [comparisonData] — From getStockAnalysisData() for second asset (comparison mode)
 * @returns {{ systemPrompt: string, userPrompt: string, questionTypes: string[], estimatedTokens: number, isComparison: boolean, comparisonSymbols: object|null }}
 */
export function buildIntelligencePrompt(question, stockData, context = {}, comparisonData = null) {
  const questionTypes = detectQuestionType(question);
  const isComparison = comparisonData !== null;

  // Collect all data fields needed across all detected types
  const dataFieldsNeeded = new Set();
  for (const type of questionTypes) {
    const fields = DATA_FIELDS_BY_TYPE[type] || DATA_FIELDS_BY_TYPE.general;
    fields.forEach(f => dataFieldsNeeded.add(f));
  }

  const sections = [];

  // Header
  sections.push(`QUESTION: ${question}`);

  if (isComparison) {
    // ---- COMPARISON MODE ----
    sections.push(`MODE: COMPARISON`);
    sections.push(`\n=== ASSET A: ${stockData.symbol} (${stockData.isCrypto ? 'CRYPTO' : 'STOCK'}) ===`);
    appendAssetData(sections, stockData, dataFieldsNeeded);

    sections.push(`\n=== ASSET B: ${comparisonData.symbol} (${comparisonData.isCrypto ? 'CRYPTO' : 'STOCK'}) ===`);
    appendAssetData(sections, comparisonData, dataFieldsNeeded);
  } else {
    // ---- SINGLE ASSET MODE ----
    const assetLabel = stockData.isCrypto ? 'CRYPTO' : 'STOCK';
    sections.push(`ASSET: ${stockData.symbol} (${assetLabel})`);
    appendAssetData(sections, stockData, dataFieldsNeeded);
  }

  // Indicator education block — inject relevant common_mistake entries
  const educationBlock = buildIndicatorEducation(questionTypes, stockData);
  if (educationBlock) {
    sections.push(`\nINDICATOR REFERENCE (use in your educationalNote — highlight common mistakes):\n${educationBlock}`);
  }

  // Stale data warning (check both assets in comparison mode)
  const staleWarnings = [];
  if (stockData.staleData && stockData.staleFields?.length > 0) {
    staleWarnings.push(`${stockData.symbol}: ${stockData.staleFields.join(', ')}`);
  }
  if (comparisonData?.staleData && comparisonData.staleFields?.length > 0) {
    staleWarnings.push(`${comparisonData.symbol}: ${comparisonData.staleFields.join(', ')}`);
  }
  if (staleWarnings.length > 0) {
    sections.push(`\nDATA FRESHNESS WARNING: The following data may be delayed:\n${staleWarnings.join('\n')}\nMention this in your response so the user knows some data may not be current.`);
  }

  // Optional context enrichment
  if (context.currentScreen) {
    sections.push(`\nUSER CONTEXT: Viewing from "${context.currentScreen}" screen.`);
  }
  if (context.userWatchlist && Array.isArray(context.userWatchlist) && context.userWatchlist.length > 0) {
    sections.push(`USER'S WATCHLIST: ${context.userWatchlist.join(', ')} (for relative context only — focus on the asked symbol${isComparison ? 's' : ''}).`);
  }

  sections.push('\nRespond with valid JSON only. No markdown fences.');

  const userPrompt = sections.join('\n');
  const estimatedTokens = Math.ceil(userPrompt.length / 4);

  return {
    systemPrompt: INTELLIGENCE_SYSTEM_PROMPT,
    userPrompt,
    questionTypes,
    estimatedTokens,
    isComparison,
    comparisonSymbols: isComparison
      ? { symbolA: stockData.symbol, symbolB: comparisonData.symbol }
      : null,
  };
}

/**
 * Append all relevant data sections for a single asset to the sections array.
 * Used by both single-asset and comparison modes to avoid duplication.
 */
function appendAssetData(sections, assetData, dataFieldsNeeded) {
  // Price (always included)
  const priceStr = formatPrice(assetData.price);
  if (priceStr) sections.push(`\nPRICE:\n${priceStr}`);

  // Conditionally include data sections based on detected types
  if (dataFieldsNeeded.has('daily')) {
    const dailyStr = formatDailyOHLCV(assetData.daily);
    if (dailyStr) sections.push(`\nRECENT DAILY DATA (last 5 days):\n${dailyStr}`);
  }

  if (dataFieldsNeeded.has('technicals')) {
    const techStr = formatTechnicals(assetData.technicals);
    if (techStr) sections.push(`\nTECHNICAL INDICATORS:\n${techStr}`);
  }

  if (dataFieldsNeeded.has('fundamentals') && !assetData.isCrypto) {
    const fundStr = formatFundamentals(assetData.fundamentals);
    if (fundStr) sections.push(`\nFUNDAMENTALS:\n${fundStr}`);
  }

  if (dataFieldsNeeded.has('news')) {
    const newsStr = formatNews(assetData.news);
    if (newsStr) sections.push(`\nRECENT NEWS:\n${newsStr}`);
  }

  if (dataFieldsNeeded.has('earnings') && !assetData.isCrypto) {
    const earningsStr = formatEarnings(assetData.earnings);
    if (earningsStr) sections.push(`\nEARNINGS:\n${earningsStr}`);
  }

  // Crypto-specific note
  if (assetData.isCrypto) {
    sections.push('\nNOTE: This is a cryptocurrency — it trades 24/7. Volume patterns differ from traditional stocks (no market open/close surges). Skip fundamental analysis (no P/E, EPS, etc.).');
  }
}
