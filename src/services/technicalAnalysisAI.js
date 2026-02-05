/**
 * Technical Analysis AI Service
 * Uses Claude API via /api/ai-advisor endpoint for AI-powered technical analysis
 * Supports conversational Explore tab with preset questions
 */

// ============================================
// EXPLORE TAB PROMPTS (Conversational Q&A)
// ============================================

/**
 * EXPLORE_PROMPTS - Each question has a focused system prompt
 * Returns concise, educational analysis with 2-3 follow-up suggestions
 */
export const EXPLORE_PROMPTS = {
  oversold_overbought: {
    id: 'oversold_overbought',
    question: 'Is this stock oversold or overbought?',
    shortLabel: 'Oversold/Overbought',
    systemPrompt: `You are a technical analyst providing RSI and momentum analysis. Answer conversationally in 2-3 sentences.

Focus on:
- RSI level and what zone it's in (oversold <30, overbought >70)
- Whether RSI is trending up or down
- Any divergences between price and RSI

OUTPUT FORMAT (JSON only):
{
  "answer": "2-3 sentence conversational response about oversold/overbought status",
  "rsiValue": number,
  "zone": "Oversold|Bearish|Neutral|Bullish|Overbought",
  "trend": "Improving|Stable|Weakening",
  "followUps": ["suggested question 1", "suggested question 2"]
}

Keep it educational and avoid trading recommendations.`
  },

  key_indicators: {
    id: 'key_indicators',
    question: 'What are the key indicators showing?',
    shortLabel: 'Key Indicators',
    systemPrompt: `You are a technical analyst summarizing key indicator readings. Answer conversationally in 3-4 sentences.

Cover these indicators briefly:
- RSI: momentum and zone
- MACD: histogram direction and signal
- Moving averages: price position relative to 20/50 SMA
- Volume: recent trend

OUTPUT FORMAT (JSON only):
{
  "answer": "3-4 sentence conversational summary of key indicators",
  "highlights": [
    { "indicator": "name", "reading": "brief status" }
  ],
  "overallBias": "Bullish|Neutral|Bearish",
  "followUps": ["suggested question 1", "suggested question 2"]
}

Keep it educational and avoid trading recommendations.`
  },

  support_resistance: {
    id: 'support_resistance',
    question: 'Where are the support and resistance levels?',
    shortLabel: 'Support/Resistance',
    systemPrompt: `You are a technical analyst identifying key price levels. Answer conversationally in 3-4 sentences.

Identify:
- Primary support level and its source (SMA, recent low, etc.)
- Primary resistance level and its source
- Distance from current price to each level

OUTPUT FORMAT (JSON only):
{
  "answer": "3-4 sentence conversational explanation of key levels",
  "primarySupport": { "price": number, "source": "description", "distance": "X%" },
  "primaryResistance": { "price": number, "source": "description", "distance": "X%" },
  "followUps": ["suggested question 1", "suggested question 2"]
}

Keep it educational and avoid trading recommendations.`
  },

  momentum: {
    id: 'momentum',
    question: 'How is momentum trending?',
    shortLabel: 'Momentum',
    systemPrompt: `You are a technical analyst assessing momentum. Answer conversationally in 2-3 sentences.

Analyze:
- MACD histogram direction and strength
- RSI trend direction
- Price momentum vs moving averages
- Any momentum divergences

OUTPUT FORMAT (JSON only):
{
  "answer": "2-3 sentence conversational assessment of momentum",
  "macdSignal": "Bullish|Neutral|Bearish",
  "momentumStrength": "Strong|Moderate|Weak",
  "trend": "Accelerating|Steady|Decelerating",
  "followUps": ["suggested question 1", "suggested question 2"]
}

Keep it educational and avoid trading recommendations.`
  },

  volatility: {
    id: 'volatility',
    question: "What's the current volatility like?",
    shortLabel: 'Volatility',
    systemPrompt: `You are a technical analyst assessing volatility. Answer conversationally in 2-3 sentences.

Analyze:
- ATR value and what it means for this stock
- Volatility regime (high, normal, low)
- Recent price range behavior
- Whether volatility is expanding or contracting

OUTPUT FORMAT (JSON only):
{
  "answer": "2-3 sentence conversational assessment of volatility",
  "atrValue": number,
  "atrPercent": number,
  "regime": "High|Normal|Low",
  "trend": "Expanding|Stable|Contracting",
  "followUps": ["suggested question 1", "suggested question 2"]
}

Keep it educational and avoid trading recommendations.`
  },

  patterns: {
    id: 'patterns',
    question: 'Are there any patterns forming?',
    shortLabel: 'Patterns',
    systemPrompt: `You are a technical analyst detecting chart patterns. Answer conversationally in 2-4 sentences.

Look for:
- Candlestick patterns (recent 5 candles)
- Chart patterns (triangles, wedges, channels)
- Trend patterns (higher highs/lows, consolidation)
- Any incomplete patterns that may be forming

OUTPUT FORMAT (JSON only):
{
  "answer": "2-4 sentence conversational description of any patterns",
  "patternsDetected": [
    { "name": "pattern name", "type": "Bullish|Bearish|Neutral", "description": "brief explanation" }
  ],
  "formingPatterns": "Description of incomplete patterns if any, or 'None detected'",
  "followUps": ["suggested question 1", "suggested question 2"]
}

Keep it educational and avoid trading recommendations.`
  }
};

// ============================================
// ANALYSIS MODES (Quick/Deep - legacy, still used by runAnalysis)
// ============================================

/**
 * QUICK MODE PROMPT
 * Fast, brief analysis - just the essentials
 * ~800 tokens, suitable for frequent use
 */
const QUICK_ANALYSIS_PROMPT = `You are a technical analyst. Provide a brief snapshot only - NOT trading advice.

RULES:
- Use: "showing", "indicates", "near", "at"
- Never use: "buy", "sell", "entry", "target"

OUTPUT FORMAT (JSON only):
{
  "summary": "1-2 sentences max describing current price action and trend",
  "indicators": {
    "rsi": { "zone": "Oversold|Bearish|Neutral|Bullish|Overbought" },
    "macd": { "state": "Bearish|Neutral|Bullish" },
    "trend": "Downtrend|Sideways|Uptrend"
  },
  "primaryLevel": {
    "type": "SUPPORT|RESISTANCE|NONE",
    "price": number,
    "source": "brief description (e.g. '50 SMA', '20-day low', 'prior resistance')"
  },
  "keyTakeaway": "One sentence: most important observation for this stock right now"
}

Keep it brief. Identify the single most important level. Return ONLY valid JSON.`;


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
  // Only use first 10 days for quick analysis
  const recentOhlcv = ohlcvSummary.split('\n').slice(0, 10).join('\n');

  return `Quick snapshot for ${symbol}.

CURRENT: $${safeToFixed(currentPrice, 2)}
RSI: ${safeToFixed(indicators.rsi?.value, 1)} | MACD: ${indicators.macd?.histogram > 0 ? '+' : ''}${safeToFixed(indicators.macd?.histogram, 2)}
50 SMA: $${safeToFixed(indicators.sma50?.value, 2)} (${indicators.sma50?.position || 'N/A'})
20-Day Range: $${safeToFixed(low20, 2)} - $${safeToFixed(high20, 2)}

OHLCV (10 days):
${recentOhlcv}

Identify: primary trend, key level, one takeaway. Return JSON only.`;
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
  const candleCount = mode === 'deep' ? 45 : 15;
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


// ============================================
// EXPLORE TAB ANALYSIS FUNCTION
// ============================================

/**
 * Build user prompt for explore question
 */
const buildExploreUserPrompt = (symbol, questionId, currentPrice, indicators, ohlcvData) => {
  const recentCandles = ohlcvData.slice(0, 15);
  const ohlcvSummary = recentCandles.map(c =>
    `${c.date}: O=${safeToFixed(c.open, 2)} H=${safeToFixed(c.high, 2)} L=${safeToFixed(c.low, 2)} C=${safeToFixed(c.close, 2)} V=${(c.volume / 1000000).toFixed(1)}M`
  ).join('\n');

  const high20 = Math.max(...ohlcvData.slice(0, 20).map(c => c.high));
  const low20 = Math.min(...ohlcvData.slice(0, 20).map(c => c.low));

  return `Analyze ${symbol} to answer the user's question.

CURRENT DATA:
- Price: $${safeToFixed(currentPrice, 2)}
- RSI (14): ${safeToFixed(indicators.rsi?.value, 1)} (${indicators.rsi?.zone || 'N/A'})
- MACD Histogram: ${safeToFixed(indicators.macd?.histogram, 3)}
- 20 SMA: $${safeToFixed(indicators.sma20, 2)}
- 50 SMA: $${safeToFixed(indicators.sma50?.value, 2)} (Price ${indicators.sma50?.position || 'N/A'})
- 200 SMA: $${safeToFixed(indicators.sma200, 2)}
- ATR (14): $${safeToFixed(indicators.atr?.value, 2)} (${safeToFixed(indicators.atr?.percent, 1)}% of price, ${indicators.atr?.regime || 'N/A'})
- 20-Day Range: $${safeToFixed(low20, 2)} - $${safeToFixed(high20, 2)}
- Trend: ${indicators.trend?.direction || 'N/A'}

RECENT OHLCV (15 days):
${ohlcvSummary}

Provide a focused answer with 2 relevant follow-up question suggestions. Return JSON only.`;
};

/**
 * Analyze stock for a specific explore question
 * @param {string} symbol - Stock ticker
 * @param {string} questionId - ID from EXPLORE_PROMPTS
 * @param {Array} ohlcvData - OHLCV candles (newest first)
 * @param {Object} calculatedIndicators - Pre-calculated indicators
 * @returns {Promise<Object>} AI response with answer and follow-ups
 */
export const analyzeExploreQuestion = async (symbol, questionId, ohlcvData, calculatedIndicators) => {
  const promptConfig = EXPLORE_PROMPTS[questionId];
  if (!promptConfig) {
    throw new Error(`Unknown question ID: ${questionId}`);
  }

  console.log(`[TechnicalAnalysisAI] Explore: ${promptConfig.shortLabel} for ${symbol}`);

  const currentPrice = ohlcvData[0]?.close;
  const userPrompt = buildExploreUserPrompt(symbol, questionId, currentPrice, calculatedIndicators, ohlcvData);

  try {
    const response = await fetch('/api/ai-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advisorType: 'technical-analysis',
        mode: 'explore',
        systemPrompt: promptConfig.systemPrompt,
        prompt: userPrompt,
        maxTokens: 800
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.response || data.message || data.content;
    const parsed = parseAIResponse(responseText);

    return {
      questionId,
      question: promptConfig.question,
      ...parsed,
      ticker: symbol,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[TechnicalAnalysisAI] Explore question failed:', error);

    // Return fallback response
    return {
      questionId,
      question: promptConfig.question,
      answer: `Unable to analyze ${symbol} at this time. Please check the indicator readings above for ${promptConfig.shortLabel.toLowerCase()} information.`,
      followUps: ['What are the key indicators showing?', 'Where are the support and resistance levels?'],
      error: true,
      ticker: symbol,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Get list of explore questions for UI
 */
export const getExploreQuestions = () => {
  return Object.values(EXPLORE_PROMPTS).map(p => ({
    id: p.id,
    question: p.question,
    shortLabel: p.shortLabel,
  }));
};

export default analyzeStockWithAI;
