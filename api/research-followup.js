// api/research-followup.js
// Follow-up chat endpoint for Research Intelligence question threads
// Used by both mobile QuestionCard follow-ups and desktop DesktopIntelChat

import { applySecurityMiddleware } from './_utils/security.js';

const SYSTEM_PROMPT = `You are a market intelligence analyst for the MarketClash educational trading platform. A user is asking a follow-up question about today's market.

RULES:
- NEVER give financial advice. Use educational language: "historically", "pattern suggests", "worth monitoring"
- CRITICAL DATA RULE: ONLY reference stock prices, percentages, and metrics that appear in the MARKET DATA section below. If a stock is not listed in the data, say "I don't have current data for [SYMBOL]" — NEVER estimate, approximate, or fabricate price data.
- When the user asks about a specific sector (e.g., "tech stocks", "energy", "financials"), reference ONLY the stocks and percentages from that sector in the MARKET DATA.
- When asked for "the best", "top", or a "list", sort by daily percentage change from the data and list them in order.
- Match response length to the question:
  - Focused questions: 2-3 insights
  - List requests: 5-8 items
  - Comparisons: 3-4 insights covering each side
- Each insight should reference SPECIFIC data points (exact percentages, exact prices) from the MARKET DATA.
- Build on the parent context without repeating what was already said.

Return ONLY this JSON:
{
  "insights": [
    { "text": "Specific insight referencing exact data from MARKET DATA", "type": "positive" | "negative" | "signal" }
  ]
}`;

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 15, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.CLAUDE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  try {
    const { question, parentContext, marketContext } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: 'Missing question' });
    }

    const userPrompt = `PRIOR CONTEXT (what was already discussed):
${parentContext || 'No prior context'}

MARKET DATA (use ONLY these numbers — do not fabricate):
${marketContext || 'No market data available'}

USER'S FOLLOW-UP QUESTION: ${question}

Provide focused insights that answer this follow-up using ONLY data from the MARKET DATA section above.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (data.error || !response.ok) {
      console.error('[Research Followup] API error:', data.error);
      return res.status(200).json({ success: false, error: 'AI unavailable' });
    }

    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ success: false, error: 'No structured response' });
    }

    return res.status(200).json({ success: true, data: JSON.parse(jsonMatch[0]) });

  } catch (error) {
    console.error('[Research Followup] Error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}
