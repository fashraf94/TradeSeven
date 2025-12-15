// api/ai-advisor.js
// AI Advisor endpoint using Claude API for Research and Draft advisors

// Dynamic system prompt with current date
const getResearchSystemPrompt = () => {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `You are a research advisor for MarketClash, a competitive portfolio battle game.

Today's date: ${today}

HOW TO RESPOND:
1. Use the EODHD market data provided for all specific prices and percentages
2. Use your knowledge to explain WHY things are moving and provide strategic context
3. Combine both into actionable insights for 24-hour battles

EXAMPLE FORMAT:
"NVDA is currently up 3.2% [from EODHD data], likely driven by continued momentum in AI infrastructure spending [your analysis]. For battles, this momentum could continue short-term [strategy]."

RULES:
- Always use provided data for numbers (prices, % changes)
- Add your analysis for context (why it's moving, what it means)
- Never make up prices or percentages - only use what's provided
- If data isn't provided for something, say so or skip it
- Focus on what matters for 24-hour battle performance
- Keep responses concise with bullet points`;
};

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
  'sectors': `Analyze current sector performance for MarketClash battle strategy.

Use these SPDR Sector ETFs as reference:
- XLK: Technology
- XLF: Financials
- XLE: Energy
- XLV: Healthcare
- XLY: Consumer Discretionary
- XLP: Consumer Staples
- XLI: Industrials
- XLB: Materials
- XLU: Utilities
- XLRE: Real Estate
- XLC: Communication Services
- SPY: S&P 500 (benchmark)

Provide a MOMENTUM-FOCUSED sector breakdown:

1. **Leading Sectors** (strongest momentum)
   - Which sectors are outperforming SPY?
   - Recent trend direction

2. **Lagging Sectors** (weakest momentum)
   - Which sectors are underperforming?
   - Sectors to avoid for battles

3. **Sector Momentum Ranking**
   - Quick ranking from strongest to weakest momentum

4. **Battle Recommendation**
   - Which sectors to favor for 24-hour battles
   - Any sector rotation happening?

Keep it data-driven and focused on short-term momentum, not long-term fundamentals.
Be concise - bullet points preferred.`,
  'risk-check': "What are the top 3 risk factors I should be watching this week? Consider economic events, earnings, and market conditions.",
};

// Build market data context from EODHD data
const buildMarketDataContext = (marketData) => {
  if (!marketData) return '';

  const parts = [];

  // Top stock movers
  if (marketData.stocks?.length > 0) {
    const topStocks = [...marketData.stocks]
      .filter(s => s.change24h !== undefined && s.change24h !== null)
      .sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0))
      .slice(0, 10);

    if (topStocks.length > 0) {
      parts.push(`TOP STOCK MOVERS:
${topStocks.map(s => {
  const change = s.change24h || 0;
  const changeStr = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
  return `• ${s.symbol} (${s.name || s.sector || 'Stock'}): $${(s.price || 0).toFixed(2)}, ${changeStr}`;
}).join('\n')}`);
    }
  }

  // Top crypto movers
  if (marketData.crypto?.length > 0) {
    const topCrypto = [...marketData.crypto]
      .filter(c => c.change24h !== undefined && c.change24h !== null)
      .sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0))
      .slice(0, 10);

    if (topCrypto.length > 0) {
      parts.push(`TOP CRYPTO MOVERS:
${topCrypto.map(c => {
  const change = c.change24h || 0;
  const changeStr = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
  return `• ${c.symbol}: $${(c.price || 0).toLocaleString()}, ${changeStr}`;
}).join('\n')}`);
    }
  }

  if (parts.length === 0) return '';

  return `REAL-TIME MARKET DATA FROM EODHD:

${parts.join('\n\n')}

Use this data for facts. Add your analysis for context and strategy.

`;
};

// Game Plan prompt builder - takes user notes and creates personalized strategy
const buildGamePlanPrompt = (userNotes) => {
  if (!userNotes || userNotes.length === 0) {
    return null; // Will be handled by frontend
  }

  const notesText = userNotes.map((note, i) =>
    `${i + 1}. [${note.asset || note.symbol || 'General'}] ${note.content || note.text} (saved: ${note.timestamp || 'recently'})`
  ).join('\n');

  return `You are helping a MarketClash player build their battle strategy.

They have saved these research notes:

${notesText}

Based on their notes, provide a personalized GAME PLAN:

1. **Notes Summary**
   - What assets/themes are they interested in?
   - What patterns do you see in their research?

2. **Strengths**
   - What good instincts do their notes show?
   - Which noted assets look promising?

3. **Gaps to Consider**
   - What might they be missing?
   - Any over-concentration in one sector/type?

4. **Recommended Portfolio**
   - Based on their notes, suggest 5-8 assets for a battle
   - Mix of their noted assets + suggestions to balance

5. **Quick Tips**
   - 2-3 actionable tips based on their specific notes

Make it personal - reference their specific notes. This should feel like a custom strategy session, not generic advice.`;
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

  // Use CLAUDE_API_KEY (the env var name used in Vercel)
  const API_KEY = process.env.CLAUDE_API_KEY;

  console.log('[AI Advisor] API Key exists:', !!API_KEY);

  if (!API_KEY) {
    console.error('[AI Advisor] ERROR: CLAUDE_API_KEY not set');
    return res.status(500).json({ error: 'AI service not configured - missing API key' });
  }

  try {
    const { advisorType, message, action, context } = req.body;

    if (!advisorType || (!message && !action)) {
      return res.status(400).json({ error: 'Missing advisorType and message/action' });
    }

    // Determine system prompt based on advisor type
    const systemPrompt = advisorType === 'draft' ? DRAFT_SYSTEM_PROMPT : getResearchSystemPrompt();

    // Build market data context if provided
    const marketDataContext = advisorType === 'research' ? buildMarketDataContext(context?.marketData) : '';

    // Build the user message
    let userMessage = message;

    // Handle quick actions for Research Advisor
    if (advisorType === 'research' && action && QUICK_ACTIONS[action]) {
      userMessage = QUICK_ACTIONS[action];
    }

    // Handle game-plan action (requires user notes in context)
    if (advisorType === 'research' && action === 'game-plan') {
      const gamePlanPrompt = buildGamePlanPrompt(context?.userNotes);
      if (!gamePlanPrompt) {
        // No notes - return empty state message
        return res.status(200).json({
          message: null,
          advisorType,
          action,
          emptyState: true,
          emptyStateMessage: "You haven't saved any research notes yet.\n\nHere's how to get started:\n1. Go to the Stocks or Crypto tabs\n2. Research assets you're interested in\n3. Pin insights to your notes\n4. Come back here and I'll help you build a game plan!\n\nYour notes become your personal scouting report for battles."
        });
      }
      userMessage = gamePlanPrompt;
    }

    // Handle draft actions
    if (advisorType === 'draft' && action && DRAFT_ACTIONS[action]) {
      userMessage = DRAFT_ACTIONS[action](context || {});
    }

    // Add game context if provided (for research advisor)
    if (context && advisorType === 'research') {
      const contextParts = [];
      if (context.portfolio?.length) {
        contextParts.push(`My portfolio: ${context.portfolio.join(', ')}`);
      }
      if (context.weekAheadEvents?.length) {
        contextParts.push(`Upcoming events: ${context.weekAheadEvents.map(e => e.name).join(', ')}`);
      }

      // Build final message with market data + context + question
      let finalMessage = '';

      // Add real-time market data first
      if (marketDataContext) {
        finalMessage += marketDataContext;
      }

      // Add user context
      if (contextParts.length) {
        finalMessage += `[User Context: ${contextParts.join('. ')}]\n\n`;
      }

      // Add the actual question/action
      finalMessage += userMessage;

      userMessage = finalMessage;
    }

    console.log('[AI Advisor] Request:', { advisorType, action, messagePreview: userMessage?.substring(0, 100) });

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
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

    const data = await response.json();

    // Log any error from Anthropic
    if (data.error) {
      console.error('[AI Advisor] Anthropic error:', data.error);
      return res.status(500).json({
        error: 'AI service error',
        details: data.error.message || data.error
      });
    }

    if (!response.ok) {
      console.error('[AI Advisor] Claude API error:', response.status, JSON.stringify(data));
      return res.status(500).json({
        error: 'AI service error',
        details: `Status ${response.status}`
      });
    }

    const assistantMessage = data.content?.[0]?.text || 'No response generated';

    console.log('[AI Advisor] Response length:', assistantMessage.length);

    res.status(200).json({
      message: assistantMessage,
      advisorType,
      action: action || null,
    });

  } catch (error) {
    console.error('[AI Advisor] Error:', error.message);
    console.error('[AI Advisor] Stack:', error.stack);
    res.status(500).json({
      error: 'Failed to get AI response',
      details: error.message
    });
  }
}
