// api/research-thread.js
// Thread deep-dive endpoint — on-demand analysis of a single stock
// Called when user taps a DiscoveryCard in the mobile Research Intelligence Hub

import { applySecurityMiddleware } from './_utils/security.js';
import { sanitizeInput } from './_utils/sanitizeInput.js';
import { requireAuth } from './_utils/authMiddleware.js';

const SYSTEM_PROMPT = `You are performing a focused deep-dive analysis of a single stock for the FantasyTrades educational platform.

RULES:
- NEVER give trading advice. Use: "pattern suggests", "historically", "worth monitoring"
- Every bullet must contain SPECIFIC data (prices, percentages, indicator values)
- The verdict should synthesize whether the technical + fundamental picture is coherent
- The risk should identify the single biggest threat to this stock's current trajectory

Return ONLY this JSON:
{
  "bullets": [
    "Bullet 1 with specific price/indicator data",
    "Bullet 2 with sector context",
    "Bullet 3 with support/resistance levels",
    "Bullet 4 with catalyst or timing info"
  ],
  "verdict": "2-3 sentence synthesis of the technical + fundamental picture",
  "risk": "Single biggest risk factor in 1-2 sentences"
}`;

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 15, windowMs: 60000 } })) {
    return;
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.CLAUDE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  try {
    const { symbol, discoveryContext: rawDiscovery, sectorContext } = req.body;
    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Missing symbol' });
    }
    const discoveryContext = rawDiscovery ? sanitizeInput(rawDiscovery, 2000) : null;

    const userPrompt = `Analyze ${symbol} for educational pattern detection.

DISCOVERY CONTEXT: ${discoveryContext || 'No additional context'}
SECTOR CONTEXT: ${JSON.stringify(sectorContext || {})}

Provide 4 specific bullets covering: price action, technical indicators, support/resistance levels, and upcoming catalysts. Then a verdict and key risk.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (data.error || !response.ok) {
      console.error('[Research Thread] API error:', data.error);
      return res.status(200).json({ success: false, error: 'AI unavailable' });
    }

    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ success: false, error: 'No structured response' });
    }

    return res.status(200).json({ success: true, data: JSON.parse(jsonMatch[0]) });

  } catch (error) {
    console.error('[Research Thread] Error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}
