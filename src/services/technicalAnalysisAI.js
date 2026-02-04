/**
 * Technical Analysis AI Service
 * Uses Claude API via /api/ai-advisor endpoint for AI-powered technical analysis
 * Supports Quick (fast) and Deep (comprehensive) analysis modes
 */

// ============================================
// ANALYSIS MODES
// ============================================

/**
 * QUICK MODE PROMPT
 * Fast analysis focusing on key patterns and confluence zones
 * ~2,000 tokens, suitable for frequent use
 */
const QUICK_ANALYSIS_PROMPT = `You are a technical analyst for MarketClash, an educational platform. Identify patterns and levels - do NOT give trading advice.

LANGUAGE RULES:
- Use: "detected", "identified", "historically indicates", "pattern suggests"
- Never use: "buy", "sell", "entry", "target", "stop-loss"

OUTPUT FORMAT (JSON only):
{
  "summary": "2-3 sentence overview of current technical state",
  "indicators": {
    "rsi": { "value": number, "zone": "Oversold|Bearish|Neutral|Bullish|Overbought" },
    "macd": { "histogram": number, "state": "Bearish|Neutral|Bullish" },
    "trend": "Downtrend|Consolidating|Uptrend"
  },
  "trendlines": {
    "primary": { "type": "UPTREND|DOWNTREND|NONE", "touches": number, "strength": "Weak|Moderate|Strong" },
    "pattern": { "type": "TRIANGLE|WEDGE|CHANNEL|NONE", "subtype": "string", "reliability": "X%" }
  },
  "confluenceZones": [{
    "zoneType": "SUPPORT|RESISTANCE",
    "strength": "MODERATE|STRONG|VERY_STRONG",
    "priceLow": number, "priceHigh": number,
    "indicators": [{ "indicator": "name", "value": number }],
    "description": "Why this zone matters"
  }],
  "levels": {
    "support": [{ "source": "name", "price": number }],
    "resistance": [{ "source": "name", "price": number }]
  }
}

CONFLUENCE RULES:
- 2 indicators within 1% = MODERATE
- 3 indicators = STRONG
- 4+ indicators = VERY_STRONG
- Trendlines count as indicators

TRENDLINE RULES:
- Uptrend: Connect swing lows, 3+ touches validates
- Downtrend: Connect swing highs
- Patterns: Ascending triangle (83% bullish), Falling wedge (74% bullish), Rising wedge (81% bearish)

Return ONLY valid JSON.`;


/**
 * DEEP MODE PROMPT
 * Comprehensive analysis with detailed pattern detection and historical context
 * ~4,000 tokens, for serious research
 */
const DEEP_ANALYSIS_PROMPT = `You are an expert technical analyst for MarketClash, an educational financial learning platform. Your role is to provide thorough pattern detection and analysis - NOT trading recommendations.

CRITICAL FRAMING:
- You IDENTIFY patterns and levels - you do NOT recommend actions
- You DESCRIBE what indicators show - you do NOT say what users should do
- You DETECT confluence zones - users decide whether to track them
- NEVER use: "buy", "sell", "short", "entry", "target", "stop-loss", "take profit"
- ALWAYS use: "detected", "identified", "showing", "indicates", "historically", "pattern suggests"

OUTPUT FORMAT (JSON only):
{
  "summary": "3-4 sentence educational overview describing current technical state, key observations, and notable patterns",
  "indicators": {
    "rsi": {
      "value": number,
      "zone": "Oversold|Bearish|Neutral|Bullish|Overbought",
      "divergence": "BULLISH|BEARISH|HIDDEN_BULLISH|HIDDEN_BEARISH|NONE",
      "regime": "Description of RSI behavior pattern"
    },
    "macd": {
      "histogram": number,
      "state": "Bearish|Neutral-Bearish|Neutral|Neutral-Bullish|Bullish",
      "crossover": "BULLISH|BEARISH|NONE",
      "zeroLinePosition": "ABOVE|BELOW|CROSSING"
    },
    "trend": "Downtrend|Consolidating|Uptrend",
    "trendStrength": "Weak|Moderate|Strong"
  },
  "trendlines": {
    "primary": {
      "type": "UPTREND|DOWNTREND|NONE",
      "classification": "TYPE_1_STRUCTURAL|TYPE_2_TRIGGER|TYPE_3_PATTERN",
      "touches": number,
      "slope": "Shallow|Moderate|Steep",
      "currentDistance": "X% above/below line",
      "strength": "Weak|Moderate|Strong",
      "healthAssessment": "Description of trend health based on price behavior"
    },
    "channel": {
      "detected": boolean,
      "type": "ASCENDING|DESCENDING|HORIZONTAL|NONE",
      "width": number,
      "widthPercent": "X%",
      "position": "LOWER_THIRD|MIDDLE|UPPER_THIRD",
      "medianLineRelation": "ABOVE|BELOW|AT"
    },
    "pattern": {
      "type": "ASCENDING_TRIANGLE|DESCENDING_TRIANGLE|SYMMETRICAL_TRIANGLE|RISING_WEDGE|FALLING_WEDGE|NONE",
      "reliability": "X% (Bulkowski)",
      "apexBars": number,
      "description": "Pattern explanation and what it historically indicates",
      "volumePattern": "Increasing|Decreasing|Mixed"
    },
    "fakeoutRisk": "LOW|MODERATE|HIGH",
    "fakeoutFactors": ["List of warning signs if any"]
  },
  "confluenceZones": [
    {
      "zoneType": "SUPPORT|RESISTANCE",
      "strength": "MODERATE|STRONG|VERY_STRONG",
      "priceLow": number,
      "priceHigh": number,
      "indicators": [
        { "indicator": "indicator name", "value": number, "weight": "PRIMARY|SECONDARY" }
      ],
      "description": "Educational explanation of why this zone matters",
      "historicalContext": "What has historically happened at similar setups",
      "volumeContext": "Volume behavior near this zone"
    }
  ],
  "patterns": [
    {
      "name": "Pattern Name",
      "type": "BULLISH|BEARISH|NEUTRAL",
      "category": "DIVERGENCE|TRENDLINE|MOMENTUM|VOLUME",
      "description": "What this pattern indicates",
      "historicalContext": "Historical behavior and reliability statistics",
      "relatedIndicators": ["List of indicators involved"]
    }
  ],
  "levels": {
    "support": [
      { "source": "indicator name", "price": number, "strength": "Strong|Moderate", "touches": number }
    ],
    "resistance": [
      { "source": "indicator name", "price": number, "strength": "Strong|Moderate", "touches": number }
    ]
  },
  "marketContext": {
    "volatilityRegime": "LOW|NORMAL|HIGH",
    "trendPhase": "EARLY|MIDDLE|LATE|REVERSAL",
    "keyObservation": "Most important thing to note about current structure"
  }
}

INDICATOR ANALYSIS DEPTH:

RSI (Relative Strength Index):
- Zones: >70 Overbought, 50-70 Bullish, 50 Neutral, 30-50 Bearish, <30 Oversold
- Detect divergences: Price vs RSI making opposite highs/lows
- Identify regime: Bullish range (40-80), Bearish range (20-60)
- Note failure swings if present

MACD:
- Histogram expansion/contraction indicates momentum strength
- Zero line crosses signal trend shifts
- Crossovers: MACD crossing signal line
- Divergences between price and histogram

TRENDLINES:
- Type 1 (Structural): Shallow slope, 50+ bars, defines master trend
- Type 2 (Trigger): Steeper, 10-30 bars, pullback completion signals
- Type 3 (Pattern): Defines chart pattern boundaries
- Validation: 3+ touches required, never cut through candle bodies
- Channel: Parallel lines create supply/demand boundaries
- Health: Failure to reach channel edge = momentum warning

PATTERNS TO DETECT:
- Triangles: Ascending (83% bullish), Descending (84% target hit on upward break), Symmetrical (75% continues trend)
- Wedges: Rising (81% bearish), Falling (74% bullish, only 8-11% failure)
- Channels: Note position within channel and median line relationship
- Divergences: RSI, MACD, OBV divergences from price

CONFLUENCE STRENGTH:
- 2 indicators within 1% = MODERATE
- 3 indicators within 1% = STRONG
- 4+ indicators within 1% = VERY_STRONG
- Trendlines count as indicators for confluence calculation

FAKEOUT DETECTION:
- Low volume on breakout = warning
- Narrow spread candle on break = warning
- Immediate reversal = confirmation of fakeout
- Note risk level for any detected patterns

Remember: This is for EDUCATIONAL pattern tracking. Provide thorough analysis with historical context, but never recommend specific actions.`;


/**
 * Safe number formatting helper
 */
const safeToFixed = (val, decimals = 2) => {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? '0' : num.toFixed(decimals);
};


/**
 * Build user prompt for quick analysis
 */
const buildQuickUserPrompt = (symbol, currentPrice, high20, low20, indicators, ohlcvSummary, battleType) => {
  return `Analyze ${symbol} for educational pattern detection.

CURRENT DATA:
- Price: $${safeToFixed(currentPrice, 2)}
- 20-Day Range: $${safeToFixed(low20, 2)} - $${safeToFixed(high20, 2)}

INDICATORS:
- RSI (14): ${safeToFixed(indicators.rsi?.value, 1)} (${indicators.rsi?.zone || 'N/A'})
- MACD Histogram: ${safeToFixed(indicators.macd?.histogram, 3)}
- 50 SMA: $${safeToFixed(indicators.sma50?.value, 2)} (${indicators.sma50?.position || 'N/A'} by ${indicators.sma50?.distance || 'N/A'})
- ATR (14): $${safeToFixed(indicators.atr?.value, 2)} (${indicators.atr?.regime || 'N/A'})

OHLCV (30 days):
${ohlcvSummary}

Context: ${battleType}

Identify: confluence zones, trendlines, patterns. Return JSON only.`;
};

/**
 * Build user prompt for deep analysis
 */
const buildDeepUserPrompt = (symbol, currentPrice, high20, low20, high50, low50, indicators, ohlcvSummary, battleType) => {
  return `Perform comprehensive technical analysis of ${symbol} for educational pattern detection.

CURRENT MARKET DATA:
- Current Price: $${safeToFixed(currentPrice, 2)}
- 20-Day Range: $${safeToFixed(low20, 2)} - $${safeToFixed(high20, 2)} (${safeToFixed((high20 - low20) / low20 * 100, 1)}% range)
- 50-Day Range: $${safeToFixed(low50, 2)} - $${safeToFixed(high50, 2)} (${safeToFixed((high50 - low50) / low50 * 100, 1)}% range)

PRE-CALCULATED INDICATORS:
- RSI (14): ${safeToFixed(indicators.rsi?.value, 1)} (${indicators.rsi?.zone || 'N/A'})
- MACD: Line=${safeToFixed(indicators.macd?.line, 3) || 'N/A'}, Signal=${safeToFixed(indicators.macd?.signal, 3) || 'N/A'}, Histogram=${safeToFixed(indicators.macd?.histogram, 3)}
- 20 SMA: $${safeToFixed(indicators.sma20, 2)}
- 50 SMA: $${safeToFixed(indicators.sma50?.value, 2)} (Price ${indicators.sma50?.position || 'N/A'} by ${indicators.sma50?.distance || 'N/A'})
- 200 SMA: $${safeToFixed(indicators.sma200, 2)}
- ATR (14): $${safeToFixed(indicators.atr?.value, 2)} (${indicators.atr?.regime || 'N/A'}, ${safeToFixed(indicators.atr?.percent, 1)}% of price)

RECENT OHLCV DATA (45 days, newest first):
${ohlcvSummary}

ANALYSIS CONTEXT:
- Battle Type: ${battleType} (${battleType === 'BaggerBomb' ? 'focus on volatility and momentum setups' : 'standard swing analysis'})
- Request: Deep analysis with full pattern detection

REQUIRED ANALYSIS:
1. Identify all confluence zones where multiple indicators align within 1%
2. Detect primary trendlines - connect swing lows (uptrend) or swing highs (downtrend)
3. Classify trendline type (Type 1 structural, Type 2 trigger, Type 3 pattern)
4. Identify if price is in a channel, triangle, or wedge formation
5. Assess pattern reliability using Bulkowski statistics
6. Note any RSI or MACD divergences from price
7. Evaluate trendline health (touch count, slope, distance from price)
8. Assess fakeout risk for any detected patterns
9. Provide historical context for all identified patterns

Return ONLY valid JSON matching the specified deep analysis format.`;
};


/**
 * Parse AI response, handling potential JSON issues
 */
const parseAIResponse = (responseText) => {
  if (!responseText) {
    return {
      summary: 'No response received from AI analysis.',
      indicators: {},
      trendlines: {},
      confluenceZones: [],
      patterns: [],
      levels: { support: [], resistance: [] },
      parseError: true
    };
  }

  // Remove markdown code blocks if present
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[TechnicalAnalysisAI] Failed to parse AI response:', e);
    console.log('[TechnicalAnalysisAI] Raw response:', responseText);

    // Return a fallback structure
    return {
      summary: 'AI analysis completed but response parsing failed. Using calculated indicators.',
      indicators: {},
      trendlines: {},
      confluenceZones: [],
      patterns: [],
      levels: { support: [], resistance: [] },
      parseError: true
    };
  }
};


/**
 * Analyze a stock using Claude API via /api/ai-advisor
 * @param {string} symbol - Stock ticker
 * @param {Array} ohlcvData - OHLCV candles (newest first)
 * @param {Object} calculatedIndicators - Pre-calculated indicators from technicalIndicators.js
 * @param {Object} options - Analysis options
 * @param {string} options.mode - 'quick' or 'deep' (default: 'quick')
 * @param {string} options.battleType - 'Classic', 'BaggerBomb', etc.
 * @returns {Promise<Object>} AI analysis result
 */
export const analyzeStockWithAI = async (symbol, ohlcvData, calculatedIndicators, options = {}) => {
  const { mode = 'quick', battleType = 'Classic' } = options;

  console.log(`[TechnicalAnalysisAI] Starting ${mode} analysis for ${symbol}`);

  // Select prompt based on mode
  const systemPrompt = mode === 'deep' ? DEEP_ANALYSIS_PROMPT : QUICK_ANALYSIS_PROMPT;

  // Format OHLCV data for the prompt
  const candleCount = mode === 'deep' ? 45 : 30;
  const recentCandles = ohlcvData.slice(0, candleCount);
  const ohlcvSummary = recentCandles.map(c =>
    `${c.date}: O=${safeToFixed(c.open, 2)} H=${safeToFixed(c.high, 2)} L=${safeToFixed(c.low, 2)} C=${safeToFixed(c.close, 2)} V=${(c.volume / 1000000).toFixed(1)}M`
  ).join('\n');

  const currentPrice = ohlcvData[0]?.close;
  const high20 = Math.max(...ohlcvData.slice(0, 20).map(c => c.high));
  const low20 = Math.min(...ohlcvData.slice(0, 20).map(c => c.low));
  const high50 = Math.max(...ohlcvData.slice(0, 50).map(c => c.high));
  const low50 = Math.min(...ohlcvData.slice(0, 50).map(c => c.low));

  // Build user prompt based on mode
  const userPrompt = mode === 'deep'
    ? buildDeepUserPrompt(symbol, currentPrice, high20, low20, high50, low50, calculatedIndicators, ohlcvSummary, battleType)
    : buildQuickUserPrompt(symbol, currentPrice, high20, low20, calculatedIndicators, ohlcvSummary, battleType);

  try {
    // Call Claude API via existing /api/ai-advisor endpoint
    const response = await fetch('/api/ai-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advisorType: 'technical-analysis',
        mode,
        systemPrompt,
        prompt: userPrompt,
        maxTokens: mode === 'deep' ? 3000 : 1500
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.response || data.message || data.content;

    // Parse the JSON response
    const analysis = parseAIResponse(responseText);

    // Add metadata
    analysis.ticker = symbol;
    analysis.analyzedAt = new Date().toISOString();
    analysis.analysisMode = mode;
    analysis.dataPoints = ohlcvData.length;
    analysis.aiGenerated = true;

    console.log(`[TechnicalAnalysisAI] ${mode} analysis complete for ${symbol}`);

    return analysis;
  } catch (error) {
    console.error('[TechnicalAnalysisAI] AI Analysis failed:', error);
    throw error;
  }
};


/**
 * Generate a fallback analysis from calculated indicators (when AI fails)
 * @param {string} symbol - Stock ticker
 * @param {Object} calculatedIndicators - Pre-calculated indicators
 * @returns {Object} Fallback analysis structure
 */
export const generateFallbackAnalysis = (symbol, calculatedIndicators) => {
  const { rsi, macd, sma50, atr, trend } = calculatedIndicators;

  // Build basic confluence zones from indicators
  const confluenceZones = [];

  // Check for support near SMA50
  if (sma50?.position === 'above') {
    confluenceZones.push({
      zoneType: 'SUPPORT',
      strength: 'MODERATE',
      priceLow: sma50.value * 0.99,
      priceHigh: sma50.value * 1.01,
      indicators: [{ indicator: '50 SMA', value: sma50.value }],
      description: 'Price above 50 SMA indicates potential support'
    });
  }

  return {
    ticker: symbol,
    summary: `${symbol} is showing ${trend || 'mixed'} momentum. RSI at ${rsi?.value?.toFixed(1) || 'N/A'} (${rsi?.zone || 'N/A'}). MACD histogram ${macd?.histogram > 0 ? 'positive' : 'negative'}.`,
    indicators: {
      rsi: { value: rsi?.value || 50, zone: rsi?.zone || 'Neutral' },
      macd: { histogram: macd?.histogram || 0, state: macd?.histogram > 0 ? 'Bullish' : 'Bearish' },
      trend: trend || 'Consolidating'
    },
    trendlines: {
      primary: { type: 'NONE', touches: 0, strength: 'Weak' },
      pattern: { type: 'NONE', subtype: 'None detected', reliability: 'N/A' }
    },
    confluenceZones,
    patterns: [],
    levels: {
      support: sma50?.value ? [{ source: '50 SMA', price: sma50.value }] : [],
      resistance: []
    },
    analyzedAt: new Date().toISOString(),
    analysisMode: 'fallback',
    dataPoints: 0,
    aiGenerated: false
  };
};


export default analyzeStockWithAI;
