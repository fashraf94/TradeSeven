// api/research-followup.js
// Follow-up chat endpoint for Research Intelligence question threads
// Used by both mobile QuestionCard follow-ups and desktop DesktopIntelChat

import { applySecurityMiddleware } from './_utils/security.js';

const SYSTEM_PROMPT = `You are a follow-up analyst for the MarketClash Research Intelligence system. A user has read initial market insights and wants to explore a topic further.

RULES:
- NEVER give financial advice. Use: "pattern suggests", "historically associated with", "worth monitoring"
- Every insight must reference SPECIFIC DATA when available (percentages, breadth numbers, prices)
- Keep responses focused and concise — 2-3 insights maximum
- Build on the parent context without repeating what was already said

Return ONLY this JSON:
{
  "insights": [
    { "text": "Specific follow-up insight with data", "type": "positive" | "negative" | "signal" }
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

    const userPrompt = `PARENT CONTEXT (insights user already saw):
${parentContext || 'No prior context'}

CURRENT MARKET CONTEXT:
${marketContext || 'No market data available'}

USER'S FOLLOW-UP QUESTION: ${question}

Provide 2-3 focused insights that build on the parent context to answer this follow-up.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
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
