/**
 * Intelligence Prompt — System prompt and prompt assembly for the Stock Intelligence Agent.
 *
 * Exports:
 *   INTELLIGENCE_SYSTEM_PROMPT — The educational personality prompt
 *   detectQuestionType(question) — Returns array of relevant data categories
 *   buildIntelligencePrompt(question, stockData, context) — Assembles the full prompt
 */

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
  "educationalNote": "1-2 sentences explaining a key concept mentioned in the analysis (e.g., 'RSI measures momentum on a 0-100 scale. Readings above 70 suggest aggressive buying that historically precedes consolidation periods.')"
}

EDUCATIONAL LANGUAGE EXAMPLES:

GOOD: "NVDA's RSI reads 72, which measures buying momentum on a 0-100 scale. Readings above 70 historically indicate aggressive buying that often precedes a cooling period. However, in strong uptrends, RSI can remain elevated for extended periods — the 2023 AI rally saw NVDA's RSI above 70 for 6 consecutive weeks."

BAD: "NVDA is overbought at RSI 72. You should wait for a pullback before adding it to your portfolio."

GOOD: "The stock trades 8% above its 50-day moving average of $810, which measures the medium-term trend. This separation — called 'extension' — has historically been followed by either a pullback to the average or a sideways consolidation that lets the average catch up."

BAD: "The stock is extended and due for a pullback. I'd wait for it to come back to the 50-day MA."

GOOD: "Volume has averaged 1.4x the 20-day average over the past 5 sessions. Elevated volume during a price advance is generally considered confirming — it suggests the move has broad participation rather than being driven by a few large trades."

BAD: "Strong volume confirms the breakout. This is a bullish setup."`;

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

/**
 * Build the full prompt for the Intelligence Agent.
 *
 * @param {string} question — User's question
 * @param {object} stockData — From getStockAnalysisData()
 * @param {object} context — Optional { currentScreen, gameMode, userWatchlist }
 * @returns {{ systemPrompt: string, userPrompt: string, questionTypes: string[], estimatedTokens: number }}
 */
export function buildIntelligencePrompt(question, stockData, context = {}) {
  const questionTypes = detectQuestionType(question);

  // Collect all data fields needed across all detected types
  const dataFieldsNeeded = new Set();
  for (const type of questionTypes) {
    const fields = DATA_FIELDS_BY_TYPE[type] || DATA_FIELDS_BY_TYPE.general;
    fields.forEach(f => dataFieldsNeeded.add(f));
  }

  // Always include price context
  const sections = [];

  // Header
  const assetLabel = stockData.isCrypto ? 'CRYPTO' : 'STOCK';
  sections.push(`QUESTION: ${question}`);
  sections.push(`ASSET: ${stockData.symbol} (${assetLabel})`);

  // Price (always included)
  const priceStr = formatPrice(stockData.price);
  if (priceStr) sections.push(`\nPRICE:\n${priceStr}`);

  // Conditionally include data sections based on detected types
  if (dataFieldsNeeded.has('daily')) {
    const dailyStr = formatDailyOHLCV(stockData.daily);
    if (dailyStr) sections.push(`\nRECENT DAILY DATA (last 5 days):\n${dailyStr}`);
  }

  if (dataFieldsNeeded.has('technicals')) {
    const techStr = formatTechnicals(stockData.technicals);
    if (techStr) sections.push(`\nTECHNICAL INDICATORS:\n${techStr}`);
  }

  if (dataFieldsNeeded.has('fundamentals') && !stockData.isCrypto) {
    const fundStr = formatFundamentals(stockData.fundamentals);
    if (fundStr) sections.push(`\nFUNDAMENTALS:\n${fundStr}`);
  }

  if (dataFieldsNeeded.has('news')) {
    const newsStr = formatNews(stockData.news);
    if (newsStr) sections.push(`\nRECENT NEWS:\n${newsStr}`);
  }

  if (dataFieldsNeeded.has('earnings') && !stockData.isCrypto) {
    const earningsStr = formatEarnings(stockData.earnings);
    if (earningsStr) sections.push(`\nEARNINGS:\n${earningsStr}`);
  }

  // Crypto-specific note
  if (stockData.isCrypto) {
    sections.push('\nNOTE: This is a cryptocurrency — it trades 24/7. Volume patterns differ from traditional stocks (no market open/close surges). Skip fundamental analysis (no P/E, EPS, etc.).');
  }

  // Stale data warning
  if (stockData.staleData && stockData.staleFields?.length > 0) {
    sections.push(`\nDATA FRESHNESS WARNING: The following data may be delayed: ${stockData.staleFields.join(', ')}. Mention this in your response so the user knows some data may not be current.`);
  }

  // Optional context enrichment
  if (context.currentScreen) {
    sections.push(`\nUSER CONTEXT: Viewing from "${context.currentScreen}" screen.`);
  }
  if (context.userWatchlist && Array.isArray(context.userWatchlist) && context.userWatchlist.length > 0) {
    sections.push(`USER'S WATCHLIST: ${context.userWatchlist.join(', ')} (for relative context only — focus on the asked symbol).`);
  }

  sections.push('\nRespond with valid JSON only. No markdown fences.');

  const userPrompt = sections.join('\n');
  const estimatedTokens = Math.ceil(userPrompt.length / 4);

  return {
    systemPrompt: INTELLIGENCE_SYSTEM_PROMPT,
    userPrompt,
    questionTypes,
    estimatedTokens,
  };
}
