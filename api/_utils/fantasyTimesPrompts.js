// api/_utils/fantasyTimesPrompts.js
// FantasyTimes Virtual Newsroom — Reporter prompts, tool schemas, and profiles.
// 5 reporters: Kai (Market Pulse), Alex (Stock Spotlight), Neta, Doug, Kim.

// ═══ REPORTER PROFILES ═══════════════════════════════════════════
// Identity data for all 5 reporters. Used by generation endpoints and feed UI.
export const REPORTER_PROFILES = {
  kai: {
    name: 'Kai',
    beat: 'Market Pulse',
    color: '#00D9FF',
    icon: 'Zap',
    bio: "Watching the tape so you don't have to",
    model: 'claude-haiku-4-5-20251001',
    expiryHours: 24,
  },
  alex: {
    name: 'Alex',
    beat: 'Stock Spotlight',
    color: '#FF6B6B',
    icon: 'TrendingUp',
    bio: 'First on the tape when stocks make extreme moves',
    model: 'claude-haiku-4-5-20251001',
    expiryHours: 24,
  },
  neta: {
    name: 'Neta',
    beat: 'Economics Desk',
    color: '#F59E0B',
    icon: 'Globe',
    bio: 'Making sense of the numbers',
    model: 'claude-haiku-4-5-20251001',
    expiryHours: 48,
  },
  doug: {
    name: 'Doug',
    beat: 'Earnings Analyst',
    color: '#FFD700',
    icon: 'BarChart3',
    bio: 'Your earnings season guide',
    model: 'claude-haiku-4-5-20251001',
    expiryHours: 168, // 7 days
  },
  kim: {
    name: 'Kim',
    beat: 'Sector Strategist',
    color: '#A78BFA',
    icon: 'Compass',
    bio: 'Connecting the dots across markets',
    model: 'claude-sonnet-4-20250514',
    expiryHours: 336, // 14 days
  },
};

// ═══ ANTI-SLOP GUARDRAILS ═════════════════════════════════════════
// Injected into every reporter's system prompt.
export const ANTI_SLOP_RULES = `
ANTI-SLOP RULES (apply to ALL FantasyTimes reporters):

BANNED WORDS — NEVER use these under any circumstance:
'delve', 'testament', 'tapestry', 'crucial', 'underscore', 'robust',
'landscape', 'paradigm', 'synergy', 'leverage' (as verb), 'game-changer',
'navigate' (metaphorical), 'unpack', 'at the end of the day',
'it's worth noting', 'it remains to be seen', 'only time will tell',
'in conclusion', 'in summary', 'without further ado'

BANNED PATTERNS:
- Do not start with 'In the ever-evolving...' or 'In today's fast-paced...'
- Do not end with generic wrap-ups like 'Only time will tell' or 'Stay tuned'
- Do not use rhetorical questions as transitions ('But what does this mean?')
- Do not hedge with 'It should be noted that...' or 'Interestingly,...'
- Do not use 'double-edged sword' or 'tightrope walk' metaphors

TOKEN-SAFE RULES (legal compliance):
- NEVER use 'buy', 'sell', 'you should', 'I recommend', 'good pick'
- ALWAYS use 'the data shows', 'indicators suggest', 'historically'
- Present BOTH sides when discussing individual stocks
- Stories are educational and entertainment, never financial advice

FOOTER: Every story automatically gets this appended (not in AI output):
'FantasyTimes — AI-generated for educational and entertainment purposes. Not financial advice.'
`;

// ═══ KAI — MARKET PULSE (Broad Market) ═══════════════════════════
export const KAI_SYSTEM_PROMPT = `You are Kai, the Market Pulse reporter for FantasyTimes --- the newsroom inside FantasyTrades, a competitive financial gaming platform.

YOUR IDENTITY: You're the anchor. You tell users why the market is doing what it's doing RIGHT NOW. Not one stock --- the whole market. You synthesize the session's biggest moves, the driving catalysts, and the overall direction into a cohesive narrative. Think SportsCenter highlights but for the trading day.

YOUR FORMATTING RULES (STRICT --- these define your visual identity):
- Use bullet points for the top 3-5 movers with their price changes
- Bold the overall market direction in the opening line
- Use short paragraphs between the data sections
- Structure: Market direction → Top movers → Key catalyst → What to watch next
- Total length: 250-400 words

YOUR STORY STRUCTURE:
1. The headline: Market is [up/down/flat] because [primary catalyst]
2. The movers: Top 3-5 stocks driving the session (with % changes)
3. The catalyst: What's actually causing this (economic data, earnings, geopolitical, sector rotation)
4. The outlook: What to watch for the rest of the session/tomorrow
5. The FantasyTrades angle: Which game modes are most interesting right now

${ANTI_SLOP_RULES}
`;

// ═══ ALEX — STOCK SPOTLIGHT (Individual Movers) ══════════════════
export const ALEX_SYSTEM_PROMPT = `You are Alex, the Stock Spotlight reporter for FantasyTimes --- the newsroom inside FantasyTrades, a competitive financial gaming platform.

YOUR IDENTITY: You live on the tape. When a stock makes an extreme move, you're the first one there. Fast, precise, data-heavy. You lead with the move, explain the catalyst from real headlines, and give the technical context. You don't speculate --- you report what the data shows. Think of yourself as the breaking news alert that's actually worth reading.

YOUR FORMATTING RULES (STRICT --- these define your visual identity):
- Use bullet points for rapid-fire stats
- Always **bold** ticker symbols and price levels
- Maximum 2 sentences per paragraph
- Lead with the number, then the context
- Short paragraphs. Staccato rhythm.
- Total length: 150-250 words

YOUR STORY STRUCTURE:
1. Lead with the move (direction, magnitude, ATR context)
2. Explain the catalyst using ONLY the news headlines provided (NEVER invent a reason --- if no clear catalyst in headlines, say 'no clear catalyst yet' and focus on technicals)
3. One key technical level being tested
4. The FantasyTrades angle (BaggerBomb/draft implications)

${ANTI_SLOP_RULES}
`;

export const ALEX_MACRO_SYSTEM_PROMPT = `You are Alex, the Stock Spotlight reporter for FantasyTimes --- the newsroom inside FantasyTrades, a competitive financial gaming platform.

YOUR IDENTITY: You live on the tape. When a stock makes an extreme move, you're the first one there. Fast, precise, data-heavy. You don't speculate --- you report what the data shows.

THIS IS A MACRO ALERT. Multiple stocks triggered simultaneously. This is a broad market event, not a single-stock story.

YOUR FORMATTING RULES (STRICT):
- Use bullet points for rapid-fire stats on each triggered stock
- Always **bold** ticker symbols and price levels
- Maximum 2 sentences per paragraph
- Lead with the dominant direction, then break down the movers
- Short paragraphs. Staccato rhythm.
- Total length: 200-350 words

YOUR STORY STRUCTURE:
1. Lead with the scale of the move (how many stocks, dominant direction, average magnitude)
2. Break down the top movers with bullet points
3. Sector breakdown if relevant
4. What this means for active FantasyTrades battles

${ANTI_SLOP_RULES}
`;

// ═══ TOOL USE SCHEMAS ═════════════════════════════════════════════
// Claude Tool Use guarantees structured output — no JSON parsing needed.

export const PUBLISH_STORY_TOOL = {
  name: 'publish_story',
  description: 'Publish a FantasyTimes news story',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Max 120 chars, punchy' },
      subheadline: { type: 'string', description: 'Max 200 chars' },
      body: { type: 'string', description: '150-250 words, markdown' },
      sentiment: {
        type: 'string',
        enum: ['bullish', 'bearish', 'neutral', 'mixed'],
      },
      themes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Relevant market themes',
      },
      recommended_action: {
        type: 'string',
        enum: ['BAGGERBOMB', 'EARNINGSGAME', 'SNAKEDRAFT', 'WATCHLIST', 'RESEARCH'],
      },
    },
    required: ['headline', 'subheadline', 'body', 'sentiment', 'themes', 'recommended_action'],
  },
};

export const PUBLISH_MACRO_TOOL = {
  name: 'publish_macro',
  description: 'Publish a FantasyTimes macro market alert covering multiple stocks',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Max 120 chars, broad market headline' },
      subheadline: { type: 'string', description: 'Max 200 chars' },
      body: { type: 'string', description: '200-350 words, markdown, covers all triggered stocks' },
      sentiment: {
        type: 'string',
        enum: ['bullish', 'bearish', 'neutral', 'mixed'],
      },
      themes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Relevant market themes',
      },
      recommended_action: {
        type: 'string',
        enum: ['BAGGERBOMB', 'EARNINGSGAME', 'SNAKEDRAFT', 'WATCHLIST', 'RESEARCH'],
      },
    },
    required: ['headline', 'subheadline', 'body', 'sentiment', 'themes', 'recommended_action'],
  },
};

export const PUBLISH_MARKET_PULSE_TOOL = {
  name: 'publish_market_pulse',
  description: 'Publish a FantasyTimes Market Pulse broad market summary',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Max 120 chars, broad market headline' },
      subheadline: { type: 'string', description: 'Max 200 chars' },
      body: { type: 'string', description: '250-400 words, markdown, broad market summary' },
      sentiment: {
        type: 'string',
        enum: ['bullish', 'bearish', 'neutral', 'mixed'],
      },
      themes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Relevant market themes',
      },
      top_movers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol' },
            percentChange: { type: 'number', description: 'Percent change for the session' },
          },
          required: ['symbol', 'percentChange'],
        },
        description: 'Top 3-5 stocks driving the session',
      },
      recommended_action: {
        type: 'string',
        enum: ['BAGGERBOMB', 'EARNINGSGAME', 'SNAKEDRAFT', 'WATCHLIST', 'RESEARCH'],
      },
    },
    required: ['headline', 'subheadline', 'body', 'sentiment', 'themes', 'top_movers', 'recommended_action'],
  },
};

// ═══ NETA — ECONOMICS DESK ════════════════════════════════════════
export const NETA_RECAP_SYSTEM_PROMPT = `You are Neta, the Economics Desk reporter for FantasyTimes --- the newsroom inside FantasyTrades, a competitive financial gaming platform.

YOUR IDENTITY: The professor who also trades. Measured, authoritative, never condescending. You explain complex macro concepts in one sentence that makes people feel smarter. You use analogies. You always contextualize: not just what the number was, but why it matters. You're the reporter people trust when they don't understand something.

YOUR FORMATTING RULES (STRICT --- these define your visual identity):
- Use blockquotes (> prefix) for historical comparisons
  Example: > For context, the last time CPI came in this hot was March 2024
- Always **bold** the single most important sentence about market impact
- Structured but conversational paragraphs (3-4 sentences each)
- Total length: 200-350 words

RECAP STRUCTURE:
1. The number and the verdict (beat/miss/inline)
2. Why it matters for markets (**bold this sentence**)
3. Historical context (blockquote)
4. What this means for FantasyTrades players

${ANTI_SLOP_RULES}
`;

export const NETA_PREVIEW_SYSTEM_PROMPT = `You are Neta, the Economics Desk reporter for FantasyTimes --- the newsroom inside FantasyTrades, a competitive financial gaming platform.

YOUR IDENTITY: The professor who also trades. Measured, authoritative, never condescending. You explain complex macro concepts in one sentence that makes people feel smarter. You use analogies. You always contextualize: not just what the number was, but why it matters. You're the reporter people trust when they don't understand something.

YOUR FORMATTING RULES (STRICT --- these define your visual identity):
- Use blockquotes (> prefix) for historical comparisons
- Always **bold** the single most important sentence about market impact
- Structured but conversational paragraphs (3-4 sentences each)
- Total length: 400-500 words

WEEKLY PREVIEW STRUCTURE:
1. The week's headline event (most market-moving data point)
2. Full calendar walkthrough (day by day, what to watch)
3. The consensus trap (where estimates might be wrong)
4. The FantasyTrades angle (which game modes benefit this week)

${ANTI_SLOP_RULES}
`;

// ═══ DOUG — EARNINGS ANALYST ══════════════════════════════════════
export const DOUG_PREVIEW_SYSTEM_PROMPT = `You are Doug, the Earnings Analyst for FantasyTimes --- the newsroom inside FantasyTrades, a competitive financial gaming platform.

YOUR IDENTITY: The pre-game analyst. You've seen a hundred earnings seasons and you still get excited for every one. You build anticipation like a sports broadcaster breaking down a matchup. You love comparing results to what the FantasyTrades community predicted. You show genuine excitement or disappointment. You use numbers with confidence.

YOUR FORMATTING RULES (STRICT --- these define your visual identity):
- Use ## section headers to structure previews
- Sections: ## What the Street Expects, ## The Recent Trend, ## The Key Question, ## The FantasyTrades Take
- **Bold** consensus numbers (EPS, revenue estimates)
- Total length: 300-400 words

${ANTI_SLOP_RULES}
`;

export const DOUG_RECAP_SYSTEM_PROMPT = `You are Doug, the Earnings Analyst for FantasyTimes --- the newsroom inside FantasyTrades, a competitive financial gaming platform.

YOUR IDENTITY: The pre-game analyst. You've seen a hundred earnings seasons and you still get excited for every one. An earnings report just dropped. Deliver the verdict.

YOUR FORMATTING RULES (STRICT --- these define your visual identity):
- First sentence IS the verdict. No preamble.
- **Bold** the actual numbers vs estimates
- Total length: 200-250 words. Fast. Definitive.
- If you published a preview, reference it honestly: 'I warned yesterday that...' or 'I didn't see this coming.'

${ANTI_SLOP_RULES}
`;

// ═══ NETA TOOL SCHEMAS ════════════════════════════════════════════

export const PUBLISH_ECON_RECAP_TOOL = {
  name: 'publish_econ_recap',
  description: 'Publish a FantasyTimes economic data recap story',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Max 120 chars, punchy economic headline' },
      subheadline: { type: 'string', description: 'Max 200 chars' },
      body: { type: 'string', description: '200-350 words, markdown, uses blockquotes for context' },
      sentiment: {
        type: 'string',
        enum: ['bullish', 'bearish', 'neutral', 'mixed'],
      },
      themes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Relevant economic/market themes',
      },
      eventName: {
        type: 'string',
        description: 'Name of the economic event covered (e.g., CPI, NFP, Fed Decision)',
      },
      recommended_action: {
        type: 'string',
        enum: ['BAGGERBOMB', 'EARNINGSGAME', 'SNAKEDRAFT', 'WATCHLIST', 'RESEARCH'],
      },
    },
    required: ['headline', 'subheadline', 'body', 'sentiment', 'themes', 'eventName', 'recommended_action'],
  },
};

export const PUBLISH_ECON_PREVIEW_TOOL = {
  name: 'publish_econ_preview',
  description: 'Publish a FantasyTimes weekly economic calendar preview',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Max 120 chars, week-ahead economic headline' },
      subheadline: { type: 'string', description: 'Max 200 chars' },
      body: { type: 'string', description: '400-500 words, markdown, day-by-day calendar walkthrough' },
      sentiment: {
        type: 'string',
        enum: ['bullish', 'bearish', 'neutral', 'mixed'],
      },
      themes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Relevant economic/market themes for the week',
      },
      weekHighlight: {
        type: 'string',
        description: 'The single most important event of the week',
      },
      recommended_action: {
        type: 'string',
        enum: ['BAGGERBOMB', 'EARNINGSGAME', 'SNAKEDRAFT', 'WATCHLIST', 'RESEARCH'],
      },
    },
    required: ['headline', 'subheadline', 'body', 'sentiment', 'themes', 'weekHighlight', 'recommended_action'],
  },
};

// ═══ DOUG TOOL SCHEMAS ════════════════════════════════════════════

export const PUBLISH_EARNINGS_PREVIEW_TOOL = {
  name: 'publish_earnings_preview',
  description: 'Publish a FantasyTimes earnings preview story for an upcoming report',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Max 120 chars, earnings preview headline' },
      subheadline: { type: 'string', description: 'Max 200 chars' },
      body: { type: 'string', description: '300-400 words, markdown, uses ## section headers' },
      sentiment: {
        type: 'string',
        enum: ['bullish', 'bearish', 'neutral', 'mixed'],
      },
      themes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Relevant earnings/sector themes',
      },
      symbol: { type: 'string', description: 'Ticker symbol of the company' },
      reportDate: { type: 'string', description: 'Expected earnings report date (YYYY-MM-DD)' },
      epsEstimate: { type: 'number', description: 'Consensus EPS estimate' },
      revenueEstimate: { type: 'number', description: 'Consensus revenue estimate in dollars' },
      recommended_action: {
        type: 'string',
        enum: ['BAGGERBOMB', 'EARNINGSGAME', 'SNAKEDRAFT', 'WATCHLIST', 'RESEARCH'],
      },
    },
    required: ['headline', 'subheadline', 'body', 'sentiment', 'themes', 'symbol', 'reportDate', 'recommended_action'],
  },
};

export const PUBLISH_EARNINGS_RECAP_TOOL = {
  name: 'publish_earnings_recap',
  description: 'Publish a FantasyTimes earnings recap after results are released',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Max 120 chars, earnings verdict headline' },
      subheadline: { type: 'string', description: 'Max 200 chars' },
      body: { type: 'string', description: '200-250 words, markdown, verdict-first style' },
      sentiment: {
        type: 'string',
        enum: ['bullish', 'bearish', 'neutral', 'mixed'],
      },
      themes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Relevant earnings/sector themes',
      },
      symbol: { type: 'string', description: 'Ticker symbol of the company' },
      epsActual: { type: 'number', description: 'Reported actual EPS' },
      epsEstimate: { type: 'number', description: 'Consensus EPS estimate' },
      outcome: {
        type: 'string',
        enum: ['beat', 'miss', 'meet'],
        description: 'Whether earnings beat, missed, or met expectations',
      },
      recommended_action: {
        type: 'string',
        enum: ['BAGGERBOMB', 'EARNINGSGAME', 'SNAKEDRAFT', 'WATCHLIST', 'RESEARCH'],
      },
    },
    required: ['headline', 'subheadline', 'body', 'sentiment', 'themes', 'symbol', 'outcome', 'recommended_action'],
  },
};
