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

const DRAFT_SYSTEM_PROMPT = `You are a tactical draft advisor for MarketClash snake drafts.

CRITICAL RULES FOR MARKETCLASH DRAFTS:
1. Users have 60 seconds per pick - be EXTREMELY concise (under 100 words)
2. MarketClash uses THREE GAME CATEGORIES: Steady, Risky, Defensive
3. ONLY suggest assets from the AVAILABLE lists provided - never suggest already-drafted assets
4. Pay attention to CATEGORY requirements - if user needs a Defensive pick, ONLY suggest from Defensive
5. The categories are GAME CATEGORIES assigned by MarketClash, NOT real-world financial classifications
6. An asset's game category may differ from its real-world classification (e.g., TSLA might be "Risky" in-game)

RESPONSE FORMAT:
- Bullet points only, no paragraphs
- Always specify which CATEGORY your suggestion is from
- Be decisive - don't hedge

When giving a Quick Pick:
🎯 PICK: [SYMBOL] (from [CATEGORY] category)
📝 WHY: [One sentence, max 15 words]`;

// Build complete draft context for AI
const buildDraftContext = (context) => {
  if (!context) return '';

  const parts = [];

  // Header
  parts.push(`
MARKETCLASH SNAKE DRAFT - CURRENT STATE
════════════════════════════════════════`);

  // Draft status
  parts.push(`
YOUR DRAFT STATUS:
- Picks made: ${context.myPicks?.length || 0}
- Current round: ${context.round || 'Unknown'}
- Draft position: ${context.draftPosition || 'Unknown'}`);

  // Category requirements (if provided)
  if (context.categoryRequirements) {
    const req = context.categoryRequirements;
    parts.push(`
CATEGORY REQUIREMENTS:
- Steady: ${req.steadyPicked || 0}/${req.steadyRequired || 0} picked (need ${Math.max(0, (req.steadyRequired || 0) - (req.steadyPicked || 0))} more)
- Risky: ${req.riskyPicked || 0}/${req.riskyRequired || 0} picked (need ${Math.max(0, (req.riskyRequired || 0) - (req.riskyPicked || 0))} more)
- Defensive: ${req.defensivePicked || 0}/${req.defensiveRequired || 0} picked (need ${Math.max(0, (req.defensiveRequired || 0) - (req.defensivePicked || 0))} more)`);
  }

  // Current picks with categories
  if (context.myPicksDetailed?.length > 0) {
    parts.push(`
YOUR CURRENT PICKS:
${context.myPicksDetailed.map(p => `- ${p.symbol} (${p.name || 'Unknown'}) - Category: ${p.category || 'Unknown'}`).join('\n')}`);
  } else if (context.myPicks?.length > 0) {
    parts.push(`
YOUR CURRENT PICKS: ${context.myPicks.join(', ')}`);
  }

  // Available assets by category
  parts.push(`
════════════════════════════════════════
AVAILABLE ASSETS BY CATEGORY:
════════════════════════════════════════`);

  if (context.availableSteady?.length > 0) {
    parts.push(`
📊 STEADY CATEGORY (${context.availableSteady.length} available):
${context.availableSteady.slice(0, 15).map(a => `- ${a.symbol}: ${a.name || ''} | ${(a.change24h || 0) >= 0 ? '+' : ''}${(a.change24h || 0).toFixed(1)}%`).join('\n')}`);
  }

  if (context.availableRisky?.length > 0) {
    parts.push(`
🔥 RISKY CATEGORY (${context.availableRisky.length} available):
${context.availableRisky.slice(0, 15).map(a => `- ${a.symbol}: ${a.name || ''} | ${(a.change24h || 0) >= 0 ? '+' : ''}${(a.change24h || 0).toFixed(1)}%`).join('\n')}`);
  }

  if (context.availableDefensive?.length > 0) {
    parts.push(`
🛡️ DEFENSIVE CATEGORY (${context.availableDefensive.length} available):
${context.availableDefensive.slice(0, 15).map(a => `- ${a.symbol}: ${a.name || ''} | ${(a.change24h || 0) >= 0 ? '+' : ''}${(a.change24h || 0).toFixed(1)}%`).join('\n')}`);
  }

  // Fallback if no categorized assets but has availableStocks
  if (!context.availableSteady && !context.availableRisky && !context.availableDefensive && context.availableStocks?.length > 0) {
    parts.push(`
AVAILABLE ASSETS (uncategorized):
${context.availableStocks.slice(0, 20).map(s => typeof s === 'string' ? `- ${s}` : `- ${s.symbol}`).join('\n')}`);
  }

  parts.push(`
════════════════════════════════════════
IMPORTANT: ONLY suggest assets from the AVAILABLE lists above.
Never suggest assets that have already been drafted.
════════════════════════════════════════`);

  return parts.join('\n');
};

// Determine which category the user needs to pick from
const getNeededCategory = (context) => {
  if (!context?.categoryRequirements) return null;

  const req = context.categoryRequirements;
  const steadyNeeded = Math.max(0, (req.steadyRequired || 0) - (req.steadyPicked || 0));
  const riskyNeeded = Math.max(0, (req.riskyRequired || 0) - (req.riskyPicked || 0));
  const defensiveNeeded = Math.max(0, (req.defensiveRequired || 0) - (req.defensivePicked || 0));

  // If only one category has remaining picks, that's what they need
  if (steadyNeeded > 0 && riskyNeeded === 0 && defensiveNeeded === 0) return 'Steady';
  if (riskyNeeded > 0 && steadyNeeded === 0 && defensiveNeeded === 0) return 'Risky';
  if (defensiveNeeded > 0 && steadyNeeded === 0 && riskyNeeded === 0) return 'Defensive';

  return null; // Multiple categories still available
};

// Draft action prompts - now category-aware
const DRAFT_ACTIONS = {
  'analyze': (context) => {
    const draftContext = buildDraftContext(context);
    return `${draftContext}

Analyze my current draft state. What categories do I still need to fill? Which available assets look strongest in the categories I need?`;
  },

  'compare': (context) => {
    const draftContext = buildDraftContext(context);
    const stocks = context.compareStocks?.join(' vs ') || 'Unknown';
    return `${draftContext}

Compare these assets: ${stocks}
- Which category is each one in?
- Which fits my draft needs better?
- Quick recommendation on which to pick`;
  },

  'gaps': (context) => {
    const draftContext = buildDraftContext(context);
    return `${draftContext}

What am I missing in my draft? Look at:
1. Which categories still need picks?
2. Am I over-concentrated in any sector?
3. What type of asset should I prioritize next?`;
  },

  'suggest': (context) => {
    const draftContext = buildDraftContext(context);
    const neededCategory = getNeededCategory(context);

    let categoryInstruction = '';
    if (neededCategory) {
      categoryInstruction = `\n\nIMPORTANT: I specifically need a ${neededCategory.toUpperCase()} category pick. ONLY suggest from the ${neededCategory} available assets.`;
    }

    return `${draftContext}${categoryInstruction}

Give me a Quick Pick recommendation. Format:
🎯 PICK: [SYMBOL] (from [CATEGORY] category)
📝 WHY: [One sentence reason]`;
  },
};
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

// Handle market_summary type for AI Market Summary component
async function handleMarketSummary(req, res, API_KEY, context) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Build a concise summary of the market data
  const gainersText = context?.topGainers?.length > 0
    ? context.topGainers.map(g => `${g.symbol} +${g.change?.toFixed(1)}%`).join(', ')
    : 'none notable';

  const losersText = context?.topLosers?.length > 0
    ? context.topLosers.map(l => `${l.symbol} ${l.change?.toFixed(1)}%`).join(', ')
    : 'none notable';

  const newsText = context?.recentNews?.length > 0
    ? context.recentNews.slice(0, 3).join(' | ')
    : 'no recent headlines';

  const userPrompt = `Today: ${today}
Market Stats: ${context?.stocksUp || 0} stocks up, ${context?.stocksDown || 0} stocks down. ${context?.cryptoUp || 0} crypto up, ${context?.cryptoDown || 0} crypto down.
Top Gainers: ${gainersText}
Biggest Decliners: ${losersText}
Recent News: ${newsText}

Provide a brief, insightful 2-3 sentence market summary suitable for a trading game. Focus on:
1. Overall market sentiment (bullish/bearish/mixed)
2. One key driver or theme (if apparent from the data)
3. A quick strategic tip for 24-hour battles

Be concise, engaging, and actionable. No bullet points - flowing prose only.`;

  const systemPrompt = `You are a market analyst providing brief daily market summaries for MarketClash, a competitive portfolio battle game. Keep responses under 100 words. Be insightful but concise. Focus on actionable insights for short-term trading battles.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 200,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    const data = await response.json();

    if (data.error || !response.ok) {
      console.error('[AI Advisor] Market summary error:', data.error);
      return res.status(200).json({ success: false, error: 'AI unavailable' });
    }

    const advice = data.content?.[0]?.text || null;

    return res.status(200).json({
      success: !!advice,
      advice,
    });

  } catch (error) {
    console.error('[AI Advisor] Market summary error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}

// Handle earnings web search for insights fallback
async function handleEarningsWebSearch(req, res, API_KEY) {
  const { symbol, companyName } = req.body;

  console.log('[AI Advisor] Earnings web search for:', symbol);

  const prompt = `Search the web for ${symbol} (${companyName || symbol}) most recent earnings call transcript or earnings report summary from 2024 or 2025.

Find and analyze the key points from their latest quarterly earnings. Focus on:

1. **Management Commentary** - What did the CEO/CFO say about performance?
2. **Key Metrics** - Revenue, EPS, and how they compared to estimates
3. **Strategic Updates** - New products, markets, or initiatives mentioned
4. **Forward Guidance** - What is management expecting for next quarter/year?
5. **Risks & Challenges** - Any headwinds or concerns mentioned

Provide 4-5 bullet points summarizing the most important insights from the earnings call. Start each bullet with an appropriate emoji:
✅ = positive development
⚠️ = concern or risk
📊 = key metric/data
🎯 = forward guidance
💡 = strategic initiative

If you cannot find recent earnings information, respond with exactly: "No recent earnings data found for ${symbol}."`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        tools: [{
          type: "web_search_20250305",
          name: "web_search"
        }],
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();

    if (data.error || !response.ok) {
      console.error('[AI Advisor] Earnings web search error:', data.error);
      return res.status(200).json({ success: false, error: 'Web search unavailable' });
    }

    // Extract text content from response (may include web search results)
    let resultText = '';
    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text') {
          resultText += block.text;
        }
      }
    }

    console.log('[AI Advisor] Earnings web search completed for:', symbol);

    return res.status(200).json({
      success: true,
      message: resultText || 'No insights generated',
      source: 'web-search'
    });

  } catch (error) {
    console.error('[AI Advisor] Earnings web search error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}

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
    const { advisorType, message, action, context, type } = req.body;

    // Handle market_summary type for AI Market Summary component
    if (type === 'market_summary') {
      return await handleMarketSummary(req, res, API_KEY, context);
    }

    // Handle earnings-web-search type for earnings insights with web search fallback
    if (type === 'earnings-web-search') {
      return await handleEarningsWebSearch(req, res, API_KEY);
    }

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
