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

═══════════════════════════════════════════════════════════════════
CRITICAL RULE - ASSET TYPE SEPARATION:
═══════════════════════════════════════════════════════════════════
When the user asks about 'stocks', 'sectors', 'equities', or ETFs → respond ONLY about STOCKS - NOT crypto.
When the user asks about 'crypto', 'coins', 'tokens', or 'bitcoin' → respond ONLY about CRYPTO - NOT stocks.
When the user says 'assets', 'market', or 'both' → cover BOTH but keep them in SEPARATE sections.
If unclear what the user wants, ASK: "Would you like analysis on stocks, crypto, or both?"

STOCK TICKERS in our system: AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, JPM, V, JNJ, WMT, PG, UNH, HD, DIS
CRYPTO TICKERS in our system: BTC, ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, DOT, MATIC, LINK, UNI, ATOM, LTC

For STOCK SECTOR analysis, use SPDR ETFs: XLK, XLF, XLE, XLV, XLY, XLP, XLI, XLB, XLU, XLRE, XLC
═══════════════════════════════════════════════════════════════════

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

// Quick action prompts for Research Advisor - explicit about asset type
const QUICK_ACTIONS = {
  'whats-hot': `What's moving in the market today? Show me BOTH top STOCKS AND top CRYPTO - but keep them in SEPARATE sections.

Format your response as:
**📈 TOP STOCK MOVERS:**
[List top stocks with analysis]

**₿ TOP CRYPTO MOVERS:**
[List top crypto with analysis]

**⚔️ BATTLE PICKS:**
[Best options from each category for 24-hour battles]

Use the EODHD data provided. Keep it actionable for battle strategy.`,

  'sectors': `Give me a STOCK SECTOR momentum analysis using SPDR ETFs.

IMPORTANT: This is a STOCKS-ONLY analysis. Do NOT include any crypto.

Use these SPDR Sector ETFs:
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
   - Top stock picks from leading sectors

Keep it data-driven and focused on short-term momentum, not long-term fundamentals.
Be concise - bullet points preferred.`,

  'crypto-analysis': `Give me a CRYPTO momentum analysis.

IMPORTANT: This is a CRYPTO-ONLY analysis. Do NOT include any stocks or ETFs.

Analyze the provided crypto data and give me:

1. **Top Crypto Movers**
   - Which coins are showing strongest momentum?
   - Why are they moving?

2. **Category Breakdown**
   - Layer 1s (BTC, ETH, SOL, etc.)
   - DeFi tokens
   - Meme coins / Altcoins

3. **Risk Assessment**
   - Which crypto are overextended?
   - Which have more room to run?

4. **Battle Picks**
   - Best crypto for 24-hour battles
   - High-risk/high-reward options

Keep it data-driven and actionable for battle strategy.`,

  'risk-check': "What are the top 3 risk factors I should be watching this week for BOTH stocks AND crypto? Cover economic events, earnings, Fed decisions, and crypto-specific risks. Keep them in separate sections.",
};

// Build market data context from EODHD data - clearly separated by asset type
const buildMarketDataContext = (marketData) => {
  console.log('[AI Advisor] Building market data context...');
  console.log('[AI Advisor] Received marketData:', {
    hasStocks: !!marketData?.stocks,
    stocksCount: marketData?.stocks?.length || 0,
    hasCrypto: !!marketData?.crypto,
    cryptoCount: marketData?.crypto?.length || 0
  });

  if (!marketData) {
    console.log('[AI Advisor] No market data provided');
    return '';
  }

  // Debug first stock if available
  if (marketData.stocks?.length > 0) {
    console.log('[AI Advisor] Sample stock:', marketData.stocks[0]);
  }

  const parts = [];

  // Top stock movers - clearly labeled for stock questions
  if (marketData.stocks?.length > 0) {
    const topStocks = [...marketData.stocks]
      .filter(s => s.change24h !== undefined && s.change24h !== null)
      .sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0))
      .slice(0, 10);

    if (topStocks.length > 0) {
      parts.push(`═══════════════════════════════════════
STOCK DATA (Use for stock/sector questions):
═══════════════════════════════════════
${topStocks.map(s => {
  const change = s.change24h || 0;
  const changeStr = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
  return `• ${s.symbol} (${s.name || s.sector || 'Stock'}): $${(s.price || 0).toFixed(2)}, ${changeStr}`;
}).join('\n')}`);
    }
  }

  // Top crypto movers - clearly labeled for crypto questions
  if (marketData.crypto?.length > 0) {
    const topCrypto = [...marketData.crypto]
      .filter(c => c.change24h !== undefined && c.change24h !== null)
      .sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0))
      .slice(0, 10);

    if (topCrypto.length > 0) {
      parts.push(`═══════════════════════════════════════
CRYPTO DATA (Use for crypto questions):
═══════════════════════════════════════
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

IMPORTANT: Only use the relevant section based on what the user is asking about.
If user asks about STOCKS/SECTORS → use STOCK DATA only.
If user asks about CRYPTO → use CRYPTO DATA only.
If user asks about BOTH or general "market" → use both sections.

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

// Detect asset type from user message
const detectAssetType = (userMessage) => {
  if (!userMessage) return 'unclear';
  const msg = userMessage.toLowerCase();

  const stockKeywords = [
    'stock', 'stocks', 'sector', 'sectors', 'equity', 'equities',
    'xlk', 'xlf', 'xle', 'xlv', 'xly', 'xlp', 'xli', 'xlb', 'xlu', 'xlre', 'xlc', 'spy',
    'aapl', 'nvda', 'msft', 'googl', 'amzn', 'tsla', 'meta', 'jpm',
    'apple', 'nvidia', 'microsoft', 'google', 'amazon', 'tesla',
    'spdr', 'etf', 's&p', 'dow', 'nasdaq'
  ];

  const cryptoKeywords = [
    'crypto', 'cryptocurrency', 'coin', 'coins', 'token', 'tokens',
    'btc', 'eth', 'bitcoin', 'ethereum', 'sol', 'solana',
    'bnb', 'xrp', 'ripple', 'ada', 'cardano', 'doge', 'dogecoin',
    'defi', 'altcoin', 'altcoins', 'blockchain', 'web3'
  ];

  const hasStock = stockKeywords.some(kw => msg.includes(kw));
  const hasCrypto = cryptoKeywords.some(kw => msg.includes(kw));

  if (hasStock && !hasCrypto) return 'stocks';
  if (hasCrypto && !hasStock) return 'crypto';
  if (hasStock && hasCrypto) return 'both';
  return 'unclear';
};

// Get context prefix based on detected asset type
const getAssetTypePrefix = (assetType) => {
  switch (assetType) {
    case 'stocks':
      return '[USER WANTS STOCK ANALYSIS ONLY - Do not mention crypto. Focus on stocks and SPDR sector ETFs.]\n\n';
    case 'crypto':
      return '[USER WANTS CRYPTO ANALYSIS ONLY - Do not mention stocks. Focus on cryptocurrencies.]\n\n';
    case 'both':
      return '[USER WANTS BOTH - Cover stocks AND crypto but keep them in SEPARATE sections.]\n\n';
    case 'unclear':
    default:
      return '';
  }
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

    // Detect asset type and add context prefix for research advisor
    if (advisorType === 'research') {
      const assetType = detectAssetType(userMessage);
      const assetTypePrefix = getAssetTypePrefix(assetType);
      if (assetTypePrefix) {
        userMessage = assetTypePrefix + userMessage;
      }
      console.log('[AI Advisor] Detected asset type:', assetType);
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
