// api/ai-advisor.js
// AI Advisor endpoint using Claude API for Research and Draft advisors

const RESEARCH_SYSTEM_PROMPT = `You are a market research assistant for MarketClash, a stock picking game. You help users understand:
- Market trends and what's moving
- Sector performance and rotation
- Economic events and their likely impact
- Risk factors to watch

Keep responses concise (2-3 paragraphs max). Use bullet points for lists.
Focus on actionable insights for stock picking decisions.
Don't give specific buy/sell recommendations - help users think through their decisions.
Current game context will be provided with each message.`;

const DRAFT_SYSTEM_PROMPT = `You are a tactical draft advisor for MarketClash snake drafts. Help users make smart picks by:
- Analyzing available stocks vs what's been drafted
- Identifying sector gaps in their portfolio
- Suggesting picks based on their draft position and strategy
- Comparing similar stocks when they're deciding between options

Keep responses SHORT and tactical - users are on a timer during drafts.
Use bullet points. Be decisive but explain your reasoning briefly.
Consider: sector balance, volatility mix, upcoming catalysts.`;

// Quick action prompts for Research Advisor
const QUICK_ACTIONS = {
  'whats-hot': "What's moving in the market today? Highlight the top 3 themes or stocks getting attention and why they matter for a stock picking game.",
  'sectors': "Give me a quick sector breakdown - which sectors look strong, which look weak, and what's driving the rotation?",
  'risk-check': "What are the top 3 risk factors I should be watching this week? Consider economic events, earnings, and market conditions.",
};

// Draft action prompts
const DRAFT_ACTIONS = {
  'analyze': (context) => `Analyze the current draft state. My picks so far: ${context.myPicks?.join(', ') || 'None yet'}. Available high-impact stocks: ${context.availableStocks?.slice(0, 10).join(', ') || 'Unknown'}. What should I be thinking about for my next pick?`,
  'compare': (context) => `I'm deciding between these stocks: ${context.compareStocks?.join(' vs ') || 'Unknown'}. Quick comparison for a draft pick - which would you lean toward and why?`,
  'gaps': (context) => `My current picks: ${context.myPicks?.join(', ') || 'None'}. What sectors or themes am I missing? What type of stock should I target next?`,
  'suggest': (context) => `Draft position: ${context.draftPosition || 'Unknown'}. My picks: ${context.myPicks?.join(', ') || 'None'}. Round: ${context.round || 'Unknown'}. Available: ${context.availableStocks?.slice(0, 15).join(', ') || 'Unknown'}. Suggest my next pick with brief reasoning.`,
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    console.error('[AI Advisor] ERROR: ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
    const { advisorType, message, action, context } = req.body;

    if (!advisorType || (!message && !action)) {
      return res.status(400).json({ error: 'Missing advisorType and message/action' });
    }

    // Determine system prompt based on advisor type
    const systemPrompt = advisorType === 'draft' ? DRAFT_SYSTEM_PROMPT : RESEARCH_SYSTEM_PROMPT;

    // Build the user message
    let userMessage = message;

    // Handle quick actions for Research Advisor
    if (advisorType === 'research' && action && QUICK_ACTIONS[action]) {
      userMessage = QUICK_ACTIONS[action];
    }

    // Handle draft actions
    if (advisorType === 'draft' && action && DRAFT_ACTIONS[action]) {
      userMessage = DRAFT_ACTIONS[action](context || {});
    }

    // Add game context if provided
    if (context && advisorType === 'research') {
      const contextParts = [];
      if (context.portfolio?.length) {
        contextParts.push(`My portfolio: ${context.portfolio.join(', ')}`);
      }
      if (context.weekAheadEvents?.length) {
        contextParts.push(`Upcoming events: ${context.weekAheadEvents.map(e => e.name).join(', ')}`);
      }
      if (contextParts.length) {
        userMessage = `[Context: ${contextParts.join('. ')}]\n\n${userMessage}`;
      }
    }

    console.log('[AI Advisor] Request:', { advisorType, action, messagePreview: userMessage?.substring(0, 100) });

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Advisor] Claude API error:', response.status, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || 'No response generated';

    console.log('[AI Advisor] Response length:', assistantMessage.length);

    res.status(200).json({
      message: assistantMessage,
      advisorType,
      action: action || null,
    });

  } catch (error) {
    console.error('[AI Advisor] Error:', error.message);
    res.status(500).json({
      error: 'Failed to get AI response',
      details: error.message
    });
  }
}
