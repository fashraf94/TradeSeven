/**
 * Technical Analysis AI Service
 * Uses Claude API via /api/ai-advisor endpoint for AI-powered technical analysis
 * Supports conversational Explore tab with preset questions
 */

// ============================================
// FREEFORM FOLLOW-UP PROMPT (for AI-generated follow-up questions)
// ============================================

const FREEFORM_SYSTEM_PROMPT = `You are a technical analyst answering a follow-up question about a stock. Answer conversationally in 2-3 sentences.

Focus on the specific question asked, using the provided indicator data and OHLCV candles.

OUTPUT FORMAT (JSON only):
{
  "answer": "2-3 sentence conversational response addressing the question",
  "followUps": ["suggested follow-up question 1", "suggested follow-up question 2"]
}

Keep it educational and avoid trading recommendations.`;

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
    question: "What's the overall picture?",
    shortLabel: 'Overall Picture',
    systemPrompt: `You are a technical analyst providing a holistic summary. Answer conversationally in 3-4 sentences.

Synthesize across all available data:
- Trend direction and strength (moving averages, higher highs/lows)
- Momentum state (RSI zone, MACD histogram direction)
- Volume conviction (RVOL tier and what it implies for current moves)
- Nearest key level (support or resistance) and distance
- One-sentence "bottom line" assessment

OUTPUT FORMAT (JSON only):
{
  "answer": "3-4 sentence conversational overview synthesizing trend, momentum, volume, and levels",
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
    question: 'How strong is the current trend?',
    shortLabel: 'Trend Strength',
    systemPrompt: `You are a technical analyst assessing trend strength and momentum. Answer conversationally in 3-4 sentences.

Analyze:
- Trend direction from moving averages (price vs 20/50/200 SMA)
- MACD histogram direction, strength, and any crossovers
- RSI trend direction and zone
- Whether momentum is confirming or diverging from the trend
- RVOL context: is volume supporting the trend?

OUTPUT FORMAT (JSON only):
{
  "answer": "3-4 sentence conversational assessment of trend strength and momentum",
  "macdSignal": "Bullish|Neutral|Bearish",
  "momentumStrength": "Strong|Moderate|Weak",
  "trend": "Accelerating|Steady|Decelerating",
  "followUps": ["suggested question 1", "suggested question 2"]
}

Keep it educational and avoid trading recommendations.`
  },

  volatility: {
    id: 'volatility',
    question: "What's the risk profile right now?",
    shortLabel: 'Risk Profile',
    systemPrompt: `You are a technical analyst assessing risk and volatility. Answer conversationally in 3-4 sentences.

Analyze:
- ATR value and what it means for this stock's typical price swings
- Volatility regime (high, normal, low) and whether expanding or contracting
- RVOL tier and what it says about current participation and conviction
- Distance to nearest support and resistance (how much room the price has)
- Overall risk context: is this a high-risk or low-risk environment?

OUTPUT FORMAT (JSON only):
{
  "answer": "3-4 sentence conversational assessment of risk and volatility",
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
    question: 'What would change the current outlook?',
    shortLabel: 'Outlook Change',
    systemPrompt: `You are a technical analyst identifying the conditions that would shift the current technical picture. Answer conversationally in 3-4 sentences.

Identify:
- The specific price levels or events that would invalidate the current bias (e.g., "a close below $X would break the uptrend")
- Key levels to watch for confirmation of continuation vs reversal
- Volume conditions that would signal a regime change (e.g., "a breakout above $X on RVOL > 2.5 would confirm")
- Any forming patterns that could resolve in either direction

OUTPUT FORMAT (JSON only):
{
  "answer": "3-4 sentence conversational description of what would change the outlook",
  "bullishTrigger": "Condition that would turn outlook more bullish",
  "bearishTrigger": "Condition that would turn outlook more bearish",
  "keyLevelToWatch": number,
  "followUps": ["suggested question 1", "suggested question 2"]
}

Keep it educational and avoid trading recommendations.`
  }
};

// ============================================
// LEGACY PROMPTS - Used by analyzeStockWithAI (default export)
// Note: The Quick/Deep UI toggle was removed in Phase 6.
// 'quick' mode is now hardcoded. 'deep' mode is deprecated but kept for backwards compatibility.
// ============================================

/**
 * QUICK MODE PROMPT (Still in use - hardcoded as default mode)
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
 * DEEP MODE PROMPT (DEPRECATED - kept for backwards compatibility)
 * Previously used for comprehensive analysis. UI toggle was removed in Phase 6.
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

RELATIVE VOLUME (RVOL):
- RVOL is PRE-CALCULATED and provided in the indicator data — do NOT recalculate it
- RVOL compares today's volume to the 20-day average. It answers: "Is participation unusual today?"
- 7-Tier Institutional Classification:
  * VERY_LOW (<0.5x): Extremely thin participation, moves likely unsustainable
  * LOW (0.5-0.75x): Below-average conviction, breakouts prone to failure
  * NORMAL (0.75-1.25x): Balanced auction, typical participation — neutral for pattern confirmation
  * ELEVATED (1.25-2.5x): Stock is "in-play" with above-normal interest, moderate follow-through expected
  * INSTITUTIONAL (2.5-4.0x): Strong institutional conviction, breakout-grade volume, highest follow-through probability
  * CLIMAX (>4.0x): CAUTION — Potential blow-off top or selling climax. Extreme volume at the end of extended moves historically indicates exhaustion, not continuation
- CRITICAL — The Climax Warning (RVOL > 4.0):
  * At end of extended uptrend + reversal candle = "Potential blow-off top detected. Extremely high volume indicates exhaustion."
  * At end of extended downtrend + reversal candle = "Potential selling climax detected. Capitulation — sellers exhausting themselves."
  * Breakout from consolidation base = Climax warning does NOT apply. High volume on base breakout is constructive.
- Always contextualize patterns with RVOL:
  * Bounce at support WITH RVOL > 2.5 = "High-conviction institutional reaction at support zone"
  * Bounce at support WITH RVOL < 0.75 = "Support held, but volume is unremarkable — conviction is neutral"
  * Breakout WITH RVOL < 0.75 = "Low-conviction breakout — historically prone to failure"
  * Pullback WITH RVOL < 0.75 = "Healthy volume dry-up on pullback — holders not liquidating" (bullish within uptrend)
  * Pattern WITH RVOL > 4.0 at extended move end = Apply climax warning
  * Pattern WITH RVOL < 0.5 = "Pattern detected but on very thin volume — reliability significantly reduced"
- Volume Dry-Up Context: Pullback on contracting RVOL = healthy pause. Pullback on expanding RVOL = warning of possible trend change.
- RVOL + OBV Cross-Check (when OBV data available):
  * Price rising + OBV rising + RVOL elevated = Healthy trend, accumulation confirmed
  * Price rising + OBV flat/declining + RVOL spikes on up-days = Distribution warning
  * Price declining + OBV flat + RVOL low = Orderly pullback, no panic
  * Price declining + OBV declining sharply + RVOL high = Active selling/liquidation
- RVOL influences confluence zone descriptions:
  * STRONG confluence + RVOL INSTITUTIONAL = "High-conviction STRONG confluence — institutional-grade volume supports this zone"
  * STRONG confluence + RVOL NORMAL = "STRONG confluence structurally, but volume participation is unremarkable"
  * STRONG confluence + RVOL LOW/VERY_LOW = "STRONG confluence detected, but current volume is unusually thin — reduced reliability"
  * Confluence at support during pullback + RVOL LOW = "Volume drying up at confluence support — historically constructive"

CANDLESTICK PATTERNS TO DETECT:
- Doji Sub-Types: Classify dojis by shadow structure:
  * Gravestone Doji: Long upper shadow, minimal lower shadow — bearish, only valid near resistance
  * Dragonfly Doji: Long lower shadow, minimal upper shadow — bullish, only valid near support
  * Long-Legged Doji: Long shadows on both sides — high indecision, valid at either level
  * Standard Doji: Small shadows — mild indecision, lowest significance
- Morning Star (3-candle bullish reversal):
  * Candle 1: Large bearish body (body > 50% of range)
  * Candle 2 (star): Small body (< 30% of candle 1 body)
  * Candle 3: Large bullish body closing above midpoint of candle 1
  * Strong variant: Candle 3 closes above entire candle 1 open
  * Historically ~75% reversal success rate at support
- Evening Star (3-candle bearish reversal):
  * Mirror of Morning Star — bullish candle 1, small star, bearish candle 3
  * Strong variant: Candle 3 closes below entire candle 1 open
  * Historically ~72% reversal success rate at resistance
- Inside Bar (volatility compression):
  * Current bar's high < prior bar's high AND current bar's low > prior bar's low
  * Double Inside Bar: Two consecutive inside bars — extreme compression, imminent expansion
  * NR4: Current bar is narrowest of last 4 bars — highest breakout probability
  * Inside Bars are NEUTRAL — direction of breakout determines bias
  * Volume typically contracts during inside bars; a breakout on RVOL > 2.0 confirms direction

CANDLESTICK PATTERN QUALITY RULES:
When detecting candlestick patterns, always assess and report quality context:
- Engulfing Patterns:
  * Strong: Engulfing candle's body is at least 2x the previous candle's body
  * Weak/Marginal: Engulfing candle barely exceeds previous body
  * Report: "Bullish Engulfing (strong — engulfing body 2.3x prior candle)" or "Bullish Engulfing (marginal — body only 1.1x prior)"
- Hammer / Shooting Star:
  * Valid: Lower shadow (hammer) or upper shadow (shooting star) must be at least 2x the body length
  * Invalid: If shadow < 2x body, do NOT classify as hammer/shooting star
  * Report shadow-to-body ratio when detected
  * A Shooting Star on RVOL > 4.0 at end of extended uptrend is a high-probability blow-off signal — always flag explicitly
- Double Top / Double Bottom:
  * Volume comparison is critical: Compare volume at first peak/trough vs second
  * Declining volume on second test = higher probability pattern (weakening conviction)
  * Increasing volume on second test = pattern less likely to resolve as expected
  * Report: "Double Top near $X — second peak on 40% lower volume, indicating weakening conviction"
- All Patterns:
  * Always report the RVOL tier at the candle where the pattern was detected
  * Pattern on RVOL < 0.75 = flag as "low-conviction"
  * Pattern on RVOL 2.5-4.0 = flag as "high-conviction, institutional-grade"
  * Pattern on RVOL > 4.0 = evaluate for exhaustion context (see Climax Warning above)

ELLIOTT WAVE ANALYSIS — GATING:
- Elliott Wave counting requires visual chart inspection for reliable wave identification
- In OHLCV-only mode (no chart image): Do NOT output specific wave counts (e.g., "we are in Wave 3")
- You MAY note structural observations consistent with wave theory if the OHLCV structure strongly suggests it:
  * "Price structure shows characteristics of an impulsive advance" (if clearly visible from data)
  * "The current pullback has a corrective appearance" (if pattern is unambiguous)
- ALWAYS include gating caveat: "Wave analysis requires visual confirmation for reliable counts"
- Flag confidence: LOW (OHLCV data only), HIGH (chart image available)

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
RVOL: ${indicators.rvol?.value || 'N/A'}x (${indicators.rvol?.label || 'Unknown'}) [Tier: ${indicators.rvol?.tier || 'UNKNOWN'}]
50 SMA: $${safeToFixed(indicators.sma50?.value, 2)} (${indicators.sma50?.position || 'N/A'})
20-Day Range: $${safeToFixed(low20, 2)} - $${safeToFixed(high20, 2)}

OHLCV (10 days):
${recentOhlcv}

Identify: primary trend, key level, one takeaway. Return JSON only.`;
};

/**
 * Build user prompt for deep analysis
 */
const buildDeepUserPrompt = (symbol, currentPrice, high20, low20, high50, low50, indicators, ohlcvSummary, battleType, hasChartImage = false) => {
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
- RVOL (20): ${indicators.rvol?.value || 'N/A'}x (${indicators.rvol?.label || 'Unknown'}) [Tier: ${indicators.rvol?.tier || 'UNKNOWN'}]

RECENT OHLCV DATA (45 days, newest first):
${ohlcvSummary}

ANALYSIS CONTEXT:
- Battle Type: ${battleType} (${battleType === 'BaggerBomb' ? 'focus on volatility and momentum setups' : 'standard swing analysis'})
- Analysis Mode: ${hasChartImage ? 'OHLCV + Chart Image' : 'OHLCV Only'}
- Request: Deep analysis with full pattern detection
${!hasChartImage ? '- NOTE: Elliott Wave analysis is NOT available in OHLCV-only mode.' : ''}

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
- RVOL (20): ${indicators.rvol?.value || 'N/A'}x (${indicators.rvol?.tier || 'N/A'} — ${indicators.rvol?.label || ''})
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

  // Support freeform follow-up questions: if questionId doesn't match a preset, treat it as freeform text
  const isFreeform = !promptConfig;
  const systemPrompt = isFreeform ? FREEFORM_SYSTEM_PROMPT : promptConfig.systemPrompt;
  const questionText = isFreeform ? questionId : promptConfig.question;
  const shortLabel = isFreeform ? 'Follow-up' : promptConfig.shortLabel;

  const currentPrice = ohlcvData[0]?.close;
  let userPrompt = buildExploreUserPrompt(symbol, questionId, currentPrice, calculatedIndicators, ohlcvData);

  // For freeform questions, append the actual question text
  if (isFreeform) {
    userPrompt += `\n\nUSER'S QUESTION: ${questionText}`;
  }

  try {
    const response = await fetch('/api/ai-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advisorType: 'technical-analysis',
        mode: 'explore',
        systemPrompt,
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
      question: questionText,
      ...parsed,
      ticker: symbol,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[TechnicalAnalysisAI] Explore question failed:', error);

    // Return fallback response
    return {
      questionId,
      question: questionText,
      answer: `Unable to analyze ${symbol} at this time. Please check the indicator readings above for ${shortLabel.toLowerCase()} information.`,
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
