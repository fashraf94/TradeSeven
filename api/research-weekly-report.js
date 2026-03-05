// api/research-weekly-report.js
// Weekly Intel Report endpoint — portfolio performance summary
// Called when user taps "View Weekly Intel Report" in the mobile Research Intelligence Hub

import { applySecurityMiddleware } from './_utils/security.js';
import { getFromCache, setInCache, CACHE_TIERS } from './_utils/serverCache.js';

const SYSTEM_PROMPT = `You are the MarketClash Weekly Intel Report generator. You produce a concise weekly portfolio summary for educational purposes.

RULES:
- NEVER give trading advice. Use: "pattern suggests", "historically", "worth monitoring"
- Summary should be 2-3 sentences covering overall portfolio performance
- Each stock verdict must be 1 concise sentence with specific data
- Outlook should be 1-2 forward-looking sentences about what to watch next week
- Signal must be "bullish", "bearish", or "neutral" based on the week's performance

Return ONLY this JSON:
{
  "period": "Date range string (e.g. Feb 5 – Feb 12)",
  "summary": "2-3 sentence portfolio performance summary",
  "stocks": [
    { "symbol": "TICKER", "verdict": "1-sentence take on this stock's week", "signal": "bullish" | "bearish" | "neutral" }
  ],
  "outlook": "1-2 sentence forward look for next week"
}`;

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
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
    const { watchlist, stockData } = req.body;
    if (!Array.isArray(watchlist) || !watchlist.length) {
      return res.status(400).json({ success: false, error: 'Missing or invalid watchlist' });
    }
    if (stockData && !Array.isArray(stockData)) {
      return res.status(400).json({ success: false, error: 'stockData must be an array' });
    }

    // Check memory cache
    const cacheKey = `weekly_report_${watchlist.sort().join(',')}`;
    if (!noCache) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    const stockSummary = (stockData || []).map(s =>
      `${s.symbol}: $${s.price || '?'} (${s.percentChange != null ? (s.percentChange >= 0 ? '+' : '') + s.percentChange.toFixed(2) + '%' : '?'})`
    ).join(', ');

    const userPrompt = `Generate a weekly intel report for this portfolio.

WATCHLIST: ${watchlist.join(', ')}
CURRENT PRICES: ${stockSummary}

Provide a weekly performance summary, per-stock verdicts with signals, and a forward outlook. The period should reflect the current week.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (data.error || !response.ok) {
      console.error('[Research Weekly Report] API error:', data.error);
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
    console.error('[Research Weekly Report] Error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}
