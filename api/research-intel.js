// api/research-intel.js
// Research Intelligence endpoint — Briefer + Scout in a single call
// Powers the mobile Research Intelligence Hub

import { applySecurityMiddleware } from './_utils/security.js';

const SYSTEM_PROMPT = `You are the MarketClash Research Intelligence system. You produce STRUCTURED JSON intelligence for a competitive trading game app. Your output powers two views:

1. THE BRIEFER — a conversational "Ask the Briefer" experience with 5 tappable question cards
2. THE SCOUT — discovery of stocks the user ISN'T already watching

CRITICAL RULES:
- NEVER give financial advice. Use educational language: "historically associated with", "pattern suggests", "worth monitoring"
- All insights must reference SPECIFIC DATA from the context provided (percentages, breadth numbers)
- The Scout must EXCLUDE stocks that appear in the user's watchlist or active battles
- Each question MUST have 2-4 insights with specific data points
- If data is limited, provide fewer but higher-quality insights rather than padding

RESPONSE FORMAT — Return ONLY this JSON structure, no other text:
{
  "briefer": {
    "headline": "One-line summary of today's market story (max 60 chars)",
    "sentiment": "bullish" | "bearish" | "cautious" | "neutral",
    "questions": [
      {
        "id": "market_pulse",
        "icon": "📊",
        "label": "What's driving the market today?",
        "answer": {
          "insights": [
            { "text": "Specific insight with data points", "type": "positive" | "negative" | "signal" }
          ]
        }
      },
      {
        "id": "sector_watch",
        "icon": "🏭",
        "label": "Which sectors are leading or lagging?",
        "answer": { "insights": [{ "text": "...", "type": "..." }] }
      },
      {
        "id": "risk_radar",
        "icon": "🛡️",
        "label": "Any risks I should watch for?",
        "answer": { "insights": [{ "text": "...", "type": "..." }] }
      },
      {
        "id": "earnings_events",
        "icon": "📅",
        "label": "Key earnings & events this week?",
        "answer": { "insights": [{ "text": "...", "type": "..." }] }
      },
      {
        "id": "trade_setup",
        "icon": "🎯",
        "label": "Any interesting setups forming?",
        "answer": { "insights": [{ "text": "...", "type": "..." }] }
      }
    ]
  },
  "scout": {
    "discoveries": [
      {
        "symbol": "TICKER",
        "name": "Company Name",
        "change": 4.9,
        "reason": "Why this stock is interesting right now with specific data",
        "actionTag": "momentum" | "early_signal" | "breakout" | "earnings_play",
        "sector": "Sector Name"
      }
    ],
    "hotSector": {
      "name": "Sector Name",
      "emoji": "relevant emoji",
      "why": "Why this sector stands out right now with specific metrics",
      "topPicks": ["TICK1", "TICK2", "TICK3"]
    }
  }
}

Each question must have 2-4 insights. Provide 3-4 discoveries (NONE from watchlist/battles) and 1 hotSector.`;

function buildUserPrompt(ctx) {
  return `TODAY'S MARKET DATA:

BREADTH:
- Stocks up: ${ctx.stocksUp || 0} | Stocks down: ${ctx.stocksDown || 0}
- Breadth ratio: ${(ctx.breadthRatio || 0.5).toFixed(2)}

TOP MOVERS:
- Gainers: ${JSON.stringify(ctx.gainers?.slice(0, 5) || [])}
- Losers: ${JSON.stringify(ctx.losers?.slice(0, 5) || [])}

RECENT NEWS:
${ctx.news?.slice(0, 5).map(n => `- ${n.title}`).join('\n') || 'No recent news'}

USER'S WATCHLIST: ${JSON.stringify(ctx.watchlist || [])}
USER'S ACTIVE BATTLE STOCKS: ${JSON.stringify(ctx.battleStocks || [])}

ECONOMIC EVENTS THIS WEEK:
${ctx.economicEvents?.map(e => `- ${e.date}: ${e.name} (${e.impact} impact)`).join('\n') || 'No major events'}

Remember: Discoveries must NOT include any stock from the user's watchlist or active battles. Watchlist alerts must ONLY reference stocks the user actually watches.`;
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
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
    const { context } = req.body;
    if (!context) {
      return res.status(400).json({ success: false, error: 'Missing context' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(context) }],
      }),
    });

    const data = await response.json();

    if (data.error || !response.ok) {
      console.error('[Research Intel] API error:', data.error);
      return res.status(200).json({ success: false, error: 'AI unavailable' });
    }

    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ success: false, error: 'No structured response' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ success: true, data: parsed });

  } catch (error) {
    console.error('[Research Intel] Error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}
