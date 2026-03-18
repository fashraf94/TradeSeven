/**
 * Why Is It Moving? — POST endpoint (v2)
 *
 * Takes a stock symbol + context (optionally OHLC + peer moves),
 * calls Perplexity Sonar to explain why the stock is moving,
 * returns a structured catalyst-first explanation with citations.
 *
 * Request:  POST { symbol, name?, change?, price?, open?, high?, low?, close?, peerMoves?: [{symbol, change}] }
 * Response: { success, data: { catalyst, catalystType, signals[], peerContext, outlook, sourceQuality, citations[], timestamp,
 *                               // v1 compat fields:
 *                               explanation, factors[], keyDataPoint } }
 *
 * Caching: 30-minute server-side cache per symbol (NEWS tier).
 * Fallback: Returns basic price statement if Sonar fails.
 */

import { applySecurityMiddleware } from './_utils/security.js';
import { requireAuth } from './_utils/authMiddleware.js';
import { sanitizeDocumentId } from './_utils/sanitizeInput.js';
import { getFromCache, setInCache, CACHE_TIERS } from './_utils/serverCache.js';
import { querySonar } from './helpers/sonar.js';

// =============================================================================
// SYSTEM PROMPT (v2 — structured, catalyst-first)
// =============================================================================

const WHY_SYSTEM_PROMPT = `You are a senior equity research analyst providing concise, specific explanations for stock price movements. Your audience is retail investors who already know the stock's price and daily change — they want the WHY, not the WHAT.

RESPONSE FORMAT — Return valid JSON only, no markdown fences:
{
  "catalyst": "One sentence identifying the specific event or driver. Lead with the cause, not the price move. If no specific catalyst is identifiable, say so honestly rather than attributing to 'broader market sentiment.'",
  "catalystType": "earnings" | "analyst" | "guidance" | "macro" | "sector" | "news" | "technical" | "unknown",
  "signals": [
    {
      "type": "bullish" | "bearish" | "neutral",
      "label": "Short label (e.g., 'Analyst Upgrade', 'Revenue Beat', 'Sector Rotation')",
      "detail": "One sentence with a specific data point or fact"
    }
  ],
  "peerContext": "One sentence comparing this stock's move to its sector peers — is it leading, lagging, or moving in line? Only include if peer data was provided.",
  "outlook": "One sentence on what to watch next (upcoming earnings, guidance, catalyst)",
  "sourceQuality": "high" | "medium" | "low"
}

RULES:
- Maximum 3 signals, minimum 1
- Every signal MUST contain a specific number, name, date, or fact — no vague statements
- If the move is <1% and no specific news exists, say "catalystType": "technical" and note it's within normal trading range
- Prioritize sources: company IR, SEC filings, Reuters, Bloomberg, CNBC, WSJ over aggregator sites
- NEVER fabricate analyst names, price targets, or earnings numbers — only cite what you find
- If you cannot find a specific catalyst, set catalystType to "unknown" and be transparent`;

// =============================================================================
// USER PROMPT BUILDER
// =============================================================================

function buildWhyUserPrompt({ symbol, name, change, price, open, high, low, close, peerMoves }) {
  const direction = change >= 0 ? 'up' : 'down';
  const absChange = Math.abs(change).toFixed(2);

  let prompt = `${name || symbol} (${symbol}) is ${direction} ${absChange}% today at $${price}.`;

  // Inject OHLC if available
  if (open != null && high != null && low != null) {
    prompt += ` Today's range: Open $${open}, High $${high}, Low $${low}, Last $${close || price}.`;
  }

  // Inject peer context if available
  if (peerMoves && peerMoves.length > 0) {
    const peerStr = peerMoves
      .map(p => `${p.symbol} ${p.change >= 0 ? '+' : ''}${p.change.toFixed(1)}%`)
      .join(', ');
    prompt += ` Sector peers today: ${peerStr}.`;
  }

  // Calibrate depth based on move magnitude
  if (Math.abs(change) >= 3) {
    prompt += ` This is a significant move. Identify the specific catalyst — was it earnings, guidance, an analyst action, sector news, or a macro event? Provide detailed context.`;
  } else if (Math.abs(change) >= 1) {
    prompt += ` What is driving this move? Is it stock-specific or part of a broader sector/market trend?`;
  } else {
    prompt += ` This is a modest move. Is there a specific catalyst, or is this normal trading range activity?`;
  }

  return prompt;
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req, res) {
  console.log('[WhyMoving] Handler called with:', { symbol: req.body?.symbol, change: req.body?.change });

  // Security middleware (CORS, rate limiting, headers)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 20, windowMs: 60000 } })) {
    return;
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, name, change, price, open, high, low, close, peerMoves } = req.body || {};

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid symbol' });
  }

  const cleanSymbol = sanitizeDocumentId(symbol.toUpperCase().trim());
  if (!cleanSymbol) {
    return res.status(400).json({ success: false, error: 'Invalid symbol format' });
  }

  // Check server cache (30-min TTL via NEWS tier)
  const cacheKey = `why_moving_${cleanSymbol}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`[WhyMoving] Cache HIT for ${cleanSymbol}`);
    return res.status(200).json(cached);
  }

  // Build user prompt with available context
  const changeNum = typeof change === 'number' ? change : 0;
  const priceNum = typeof price === 'number' ? price : 0;
  const changeStr = typeof change === 'number'
    ? `${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}%`
    : 'moving';

  const userPrompt = (typeof change === 'number' && typeof price === 'number')
    ? buildWhyUserPrompt({
        symbol: cleanSymbol,
        name,
        change: changeNum,
        price: priceNum,
        open: typeof open === 'number' ? open : undefined,
        high: typeof high === 'number' ? high : undefined,
        low: typeof low === 'number' ? low : undefined,
        close: typeof close === 'number' ? close : undefined,
        peerMoves: Array.isArray(peerMoves) ? peerMoves : undefined,
      })
    : `Why is ${cleanSymbol}${name ? ` (${name})` : ''} ${changeStr} today${priceNum ? ` (current price: $${priceNum.toFixed(2)})` : ''}?`;

  try {
    console.log(`[WhyMoving] Fetching for ${cleanSymbol}: ${changeStr}`);

    const { text, citations } = await querySonar(WHY_SYSTEM_PROMPT, userPrompt, {
      searchRecencyFilter: 'day',
      maxTokens: 600,
      temperature: 0.1,
      searchDomainFilter: [
        'reuters.com',
        'cnbc.com',
        'bloomberg.com',
        'seekingalpha.com',
        'marketwatch.com',
      ],
    });

    // Parse JSON from Sonar response
    let parsed;
    try {
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, use raw text as explanation
      console.warn(`[WhyMoving] JSON parse failed for ${cleanSymbol}, raw text:`, text.slice(0, 200));
      parsed = {
        catalyst: text.slice(0, 500),
        catalystType: 'unknown',
        signals: [],
        peerContext: null,
        outlook: null,
        sourceQuality: 'low',
      };
    }

    // Normalize signals
    const signals = Array.isArray(parsed.signals) ? parsed.signals.slice(0, 3) : [];

    // Build v1-compatible factors from v2 signals
    const factors = signals.map(s => ({
      direction: s.type === 'bullish' ? 'up' : s.type === 'bearish' ? 'down' : 'neutral',
      text: s.detail ? `${s.label} — ${s.detail}` : s.label,
    }));

    const responseData = {
      success: true,
      data: {
        // v2 fields
        catalyst: parsed.catalyst || text.slice(0, 500),
        catalystType: parsed.catalystType || 'unknown',
        signals,
        peerContext: parsed.peerContext || null,
        outlook: parsed.outlook || null,
        sourceQuality: parsed.sourceQuality || 'medium',
        // v1 compat fields
        explanation: parsed.catalyst || text.slice(0, 500),
        factors,
        keyDataPoint: signals[0]?.detail || null,
        citations: citations || [],
        timestamp: Date.now(),
      },
    };

    // Cache for 30 minutes
    setInCache(cacheKey, responseData, CACHE_TIERS.NEWS.memoryTTL);
    console.log(`[WhyMoving] Cached ${cleanSymbol} (${citations.length} citations)`);

    return res.status(200).json(responseData);
  } catch (error) {
    console.error(`[WhyMoving] Error for ${cleanSymbol}:`, error.message, error.stack);

    // Graceful fallback — return basic price statement instead of failing
    const fallbackExplanation = name
      ? `${name} (${cleanSymbol}) is ${changeStr} today.`
      : `${cleanSymbol} is ${changeStr} today.`;

    return res.status(200).json({
      success: true,
      data: {
        catalyst: fallbackExplanation + ' Unable to fetch detailed explanation at this time.',
        catalystType: 'unknown',
        signals: [],
        peerContext: null,
        outlook: null,
        sourceQuality: 'low',
        explanation: fallbackExplanation + ' Unable to fetch detailed explanation at this time.',
        factors: [],
        keyDataPoint: null,
        citations: [],
        timestamp: Date.now(),
      },
    });
  }
}
