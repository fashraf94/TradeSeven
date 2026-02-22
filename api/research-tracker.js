// api/research-tracker.js
// Tracker Bot endpoint — on-demand intelligence for a single watchlist stock
// Called when user expands a TrackerStockCard in the mobile Research Intelligence Hub

import { applySecurityMiddleware } from './_utils/security.js';
import { getFromCache, setInCache, CACHE_TIERS } from './_utils/serverCache.js';

const SYSTEM_PROMPT = `You are the MarketClash Tracker Bot. You provide quick, focused intelligence on a single stock for educational purposes.

RULES:
- NEVER give trading advice. Use: "pattern suggests", "historically", "worth monitoring"
- Each field must be 1-2 concise sentences with SPECIFIC data when possible
- baggerBomb should be a fun, opinionated momentum/weakness meter (e.g. "Momentum rocket is fueled and ready" or "Bears are circling the campfire")

Return ONLY this JSON:
{
  "priceAction": "1-2 sentence summary of recent price movement and volume",
  "technicalLevel": "Key support/resistance level to watch with specific price",
  "news": "Latest catalyst, earnings, or news item affecting this stock",
  "baggerBomb": "Fun 1-sentence momentum/weakness meter"
}`;

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 20, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const noCache = req.query?.nocache === '1';

  const API_KEY = process.env.CLAUDE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  try {
    const { symbol, price, percentChange } = req.body;
    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Missing symbol' });
    }

    // Check memory cache
    const cacheKey = `tracker_${symbol}`;
    if (!noCache) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    const userPrompt = `Analyze ${symbol} for the Tracker Bot.

CURRENT DATA:
- Price: $${price || 'unknown'}
- Today's change: ${percentChange != null ? percentChange.toFixed(2) + '%' : 'unknown'}

Provide a quick intelligence snapshot: price action summary, key technical level, latest news/catalyst, and a fun baggerBomb momentum meter.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (data.error || !response.ok) {
      console.error('[Research Tracker] API error:', data.error);
      return res.status(200).json({ success: false, error: 'AI unavailable' });
    }

    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ success: false, error: 'No structured response' });
    }

    const responseData = { success: true, data: JSON.parse(jsonMatch[0]) };
    setInCache(cacheKey, responseData, CACHE_TIERS.AI_INTEL.memoryTTL);
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('[Research Tracker] Error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}
