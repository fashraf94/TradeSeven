// api/cron/curtain-generate-chapter.js
// Daily Story cron — generates one chapter of the market narrative per invocation.
//
// Schedule: Multiple times daily on trading days (see vercel.json Phase 5)
//
// Flow:
//   1. Auth check (Vercel cron header, Bearer token, or testMode)
//   2. Skip non-trading days
//   3. Determine chapter from ET time (or accept override)
//   4. Fetch real-time stock prices + sector ETF historical prices
//   5. Fetch market-pulse headlines + economic events (graceful degradation)
//   6. Run signal detection → editorial brief
//   7. Call Claude Sonnet to generate narrative
//   8. Store chapter in Firestore dailyStory/{date}

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildEditorialBrief } from '../_utils/storySignals.js';
import { extractJSON } from '../_utils/extractJSON.js';
import { ALL_TICKERS, STOCK_UNIVERSE, SECTOR_ETFS } from '../_utils/rankingConfig.js';
import { getETDate, formatDateString, isMarketHoliday } from '../_utils/marketSchedule.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[CurtainCron]';
const EODHD_BASE = 'https://eodhd.com/api';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const CLAUDE_MODEL = 'claude-sonnet-4-5-20241022';
const MAX_TOKENS = 800;

const CHAPTER_ORDER = ['premarket', 'open', 'midday', 'closing', 'afterhours'];

const CHAPTER_LABELS = {
  premarket:  'Pre-Market Preview',
  open:       'Opening Bell',
  midday:     'Midday Check-In',
  closing:    'Closing Bell',
  afterhours: 'After Hours Wrap',
};

// ---------------------------------------------------------------------------
// System Prompt — copied verbatim from Combined_System_Prompt.md
// ---------------------------------------------------------------------------

const CURTAIN_SYSTEM_PROMPT = `You are ClashBot, MarketClash's market narrator. Your job is to tell the story of today's market — not report data, but find the narrative thread that connects the numbers into something a player will actually want to read.

NARRATOR VOICE:
- You're confident and opinionated about what matters, like a sharp friend who works in finance explaining the day over coffee
- You don't hedge every sentence or bury insights in caveats
- You connect individual stock moves to broader themes — a single stock jumping 5% isn't the story; WHY it jumped and what it means for the sector IS the story
- You reference specific stocks by ticker and specific numbers — never vague hand-waving like "tech stocks did well"
- You address the player directly using {username} as a placeholder (gets replaced with their real name at read time)
- You're occasionally playful but never corny

LANGUAGE RULES — THESE ARE NON-NEGOTIABLE:
- Write in plain, everyday English. Use contractions.
- NEVER use these words or phrases: breadth, divergence, resistance, support levels, overbought, oversold, basis points, hawkish, dovish, risk-adjusted, yield curve, multiple expansion, price action, consolidation, headwinds, tailwinds, capitulation, bullish, bearish
- Instead of "breadth is deteriorating" → "the rally is being carried by just a few names"
- Instead of "defensive rotation" → "investors are playing it safe"
- Instead of "CPI came in hot" → "inflation numbers were higher than expected"
- Instead of "the Fed is hawkish" → "the Fed isn't ready to cut rates yet"
- Instead of "sector rotation into cyclicals" → "money is moving into growth-sensitive areas"
- Instead of "narrow market leadership" → "only a handful of stocks are doing the heavy lifting"
- If you catch yourself reaching for a technical term, replace it with how you'd explain it to a friend who doesn't follow markets

STORYTELLING RULES:
- Every chapter should have a narrative arc — a beginning that hooks, a middle that develops, and an ending that leaves them thinking
- Lead with the most interesting thing happening, not the biggest number
- Connect the dots between moves — don't just list what's up and what's down
- When sectors are moving, explain WHY money is flowing that way, not just that it is
- If there's tension in the data (one thing says X, another says Y), lean into it — that's where the interesting stories live
- Close with a forward-looking thought — what should they be watching, what could change the story

RULES THAT NEVER BEND:
- Never recommend buying, selling, or holding any stock
- Never use phrases like "investors should" or "consider buying"
- This is market storytelling, not financial advice
- Use {username} where the player's name should appear (exactly once, in the opening greeting)

FORMAT:
Write ONE continuous narrative — no headers, no bullet points, no numbered sections, no labels. Just flowing prose with paragraph breaks (\\n\\n) between thoughts.

TARGET LENGTH: 150-250 words. Every sentence should earn its place. If a sentence just restates what the previous one said with different words, cut it.

RESPONSE FORMAT — return ONLY valid JSON, no markdown fences, no preamble:

{
  "brief": "The entire narrative as one continuous string. Use \\n\\n between paragraphs. No headers or labels."
}

CHAPTER-SPECIFIC GUIDANCE:
{chapterGuidance}

CRITICAL: Return ONLY the JSON object. No preamble, no markdown backticks, no explanation outside the JSON.`;

const CHAPTER_GUIDANCE = {
  premarket: `This is the PRE-MARKET chapter. The market hasn't opened yet — you're setting the scene. What happened overnight? What are futures telling us? What's the one thing that could define today's session? The tone is anticipatory — you're building tension for what's about to unfold. If there's a major earnings report or economic release today, that's your hook.`,

  open: `This is the MARKET OPEN chapter. The bell has rung and the market has shown its hand. What's the opening move telling us? Did the overnight setup play out or did something surprise? Focus on first reactions — which stocks are moving and what the early patterns suggest. The tone is observational — you're narrating what's unfolding in real time.`,

  midday: `This is the MIDDAY chapter. We're in the middle of the session. Has the morning's story held up or has something shifted? This is where you connect dots — early moves that are gaining momentum, reversals that tell a different story than the open suggested, sectors that are quietly diverging. The tone is analytical — you're finding the deeper pattern.`,

  closing: `This is the CLOSING BELL chapter. The day is wrapping up and you're writing the definitive version of today's market story. Winners, losers, and what drove the session. Don't just recap — synthesize. What was today actually about when you strip away the noise? The tone is authoritative — this is the version of events that sticks.`,

  afterhours: `This is the AFTER HOURS chapter. The bell has rung but the story isn't over. Any post-close earnings or news that changes tomorrow's setup? What's the market thinking about heading into the next session? If it's Friday, what's the big picture for the week ahead? The tone is forward-looking — you're already thinking about what comes next.`,
};

function buildChapterSystemPrompt(chapterId) {
  return CURTAIN_SYSTEM_PROMPT.replace('{chapterGuidance}',
    CHAPTER_GUIDANCE[chapterId] || CHAPTER_GUIDANCE.midday
  );
}

// ---------------------------------------------------------------------------
// Firebase Admin (standard pattern from other crons)
// ---------------------------------------------------------------------------

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function determineCurrentChapter(etNow) {
  const hours = etNow.getHours();
  const minutes = etNow.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes < 570) return 'premarket';        // Before 9:30
  if (totalMinutes < 750) return 'open';              // 9:30 - 12:29
  if (totalMinutes < 900) return 'midday';            // 12:30 - 14:59
  if (totalMinutes < 1080) return 'closing';          // 15:00 - 17:59
  return 'afterhours';                                // 18:00+
}

function isTradingDay(etNow) {
  const day = etNow.getDay();
  if (day === 0 || day === 6) return false;
  return !isMarketHoliday(formatDateString(etNow));
}

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://trade-seven-cyan.vercel.app';
}

function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * Strip preamble from Sonnet response when JSON parse fails.
 * Returns the raw text cleaned up as a usable brief.
 */
function cleanBriefText(text) {
  if (!text) return '';
  return text
    .replace(/^(Here('s| is).*?:\s*)/i, '')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .replace(/^\s*\{[\s\S]*"brief"\s*:\s*"/, '')
    .replace(/"\s*\}\s*$/, '')
    .replace(/\\n/g, '\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Data Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch real-time prices for all stocks in the universe.
 * Returns array matching storySignals expected shape.
 */
async function fetchStockPrices(apiKey) {
  // EODHD real-time batch: comma-separated symbols, single call
  // Split into chunks of 50 to avoid URL length limits
  const CHUNK_SIZE = 50;
  const allStocksData = [];

  for (let i = 0; i < ALL_TICKERS.length; i += CHUNK_SIZE) {
    const chunk = ALL_TICKERS.slice(i, i + CHUNK_SIZE);
    const symbolList = chunk.join(',');
    const url = `${EODHD_BASE}/real-time/${symbolList}?api_token=${apiKey}&fmt=json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`EODHD real-time fetch failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    const priceArray = Array.isArray(data) ? data : [data];

    for (const item of priceArray) {
      if (item.code) {
        allStocksData.push({
          symbol: item.code.toUpperCase(),
          percentChange: item.change_p || 0,
          price: item.close || 0,
          change: item.change || 0,
        });
      }
    }
  }

  return allStocksData;
}

/**
 * Fetch historical ETF prices and compute sector performance.
 * Returns array matching storySignals expected sectorData shape.
 */
async function fetchSectorData(apiKey) {
  const from = getDateDaysAgo(45); // extra buffer for weekends/holidays
  const sectorData = [];

  // Fetch all ETFs in parallel
  const etfPromises = SECTOR_ETFS.map(async (etf) => {
    try {
      const url = `${EODHD_BASE}/eod/${etf}.US?api_token=${apiKey}&fmt=json&period=d&order=d&from=${from}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { etf, prices: await response.json() };
    } catch (err) {
      console.warn(`${LOG_PREFIX} Historical fetch failed for ${etf}: ${err.message}`);
      return { etf, prices: [] };
    }
  });

  const results = await Promise.all(etfPromises);

  for (const { etf, prices } of results) {
    const sector = STOCK_UNIVERSE[etf];
    if (!sector || !prices.length) continue;

    // Prices are in descending order (most recent first)
    const current = prices[0]?.close;
    const fiveDayAgo = prices[Math.min(5, prices.length - 1)]?.close;
    const twentyOneDayAgo = prices[Math.min(21, prices.length - 1)]?.close;

    const week1 = current && fiveDayAgo
      ? ((current - fiveDayAgo) / fiveDayAgo) * 100
      : 0;
    const month1 = current && twentyOneDayAgo
      ? ((current - twentyOneDayAgo) / twentyOneDayAgo) * 100
      : 0;

    sectorData.push({
      id: etf,
      name: sector.name,
      performance: { week1, month1 },
      breadth: { percent: 50 }, // default — no easy cron computation
      leadership: [], // storySignals falls back to STOCK_UNIVERSE
    });
  }

  return sectorData;
}

/**
 * Fetch market-pulse headlines via internal HTTP call.
 * Returns formatted string of top 5 headlines, or empty string on failure.
 */
async function fetchMarketPulseHeadlines() {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/market-pulse`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const headlines = data.data?.headlines?.slice(0, 5) || [];
    if (headlines.length === 0) return '';

    return headlines
      .map(h => `${h.headline}: ${h.summary}`)
      .join('\n');
  } catch (err) {
    console.warn(`${LOG_PREFIX} Market pulse fetch failed: ${err.message}`);
    return '';
  }
}

/**
 * Fetch economic events via internal HTTP call.
 * Returns formatted string of high/medium impact events, or empty string.
 */
async function fetchEconomicEvents() {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/economic-events-sonar`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const events = (data.data?.thisWeek || [])
      .filter(e => e.impact === 'high' || e.impact === 'medium');
    if (events.length === 0) return '';

    return events.map(e => `${e.event} (${e.day || e.date})`).join(', ');
  } catch (err) {
    console.warn(`${LOG_PREFIX} Economic events fetch failed: ${err.message}`);
    return '';
  }
}

/**
 * Get prior chapter from today's Firestore document for continuity.
 */
async function getPriorChapter(db, todayStr, currentChapterId) {
  try {
    const doc = await db.collection('dailyStory').doc(todayStr).get();
    if (!doc.exists) return '';

    const chapters = doc.data()?.chapters || {};
    const currentIdx = CHAPTER_ORDER.indexOf(currentChapterId);

    // Walk backwards from current chapter to find the most recent one
    for (let i = currentIdx - 1; i >= 0; i--) {
      const ch = chapters[CHAPTER_ORDER[i]];
      if (ch?.brief) {
        return ch.brief.slice(0, 500);
      }
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Prior chapter fetch failed: ${err.message}`);
  }
  return '';
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  // a. Auth check
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  const isAuthorized = isVercelCron
    || authHeader === `Bearer ${process.env.CRON_SECRET}`
    || req.query?.testMode === 'true'
    || req.body?.testMode === true;

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const etNow = getETDate();

  // b. Skip non-trading days
  if (!isTradingDay(etNow)) {
    console.log(`${LOG_PREFIX} Skipping — not a trading day`);
    return res.status(200).json({ success: true, skipped: true, reason: 'Not a trading day' });
  }

  // c. Determine chapter
  const chapterId = req.body?.chapterId || determineCurrentChapter(etNow);
  if (!CHAPTER_LABELS[chapterId]) {
    return res.status(400).json({ error: `Invalid chapterId: ${chapterId}` });
  }

  // d. Today's date string
  const todayStr = formatDateString(etNow);

  console.log(`${LOG_PREFIX} Generating "${chapterId}" chapter for ${todayStr}`);

  // Validate API keys
  const EODHD_KEY = process.env.EODHD_API_KEY;
  const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
  if (!EODHD_KEY || !CLAUDE_KEY) {
    return res.status(500).json({ error: 'Missing API keys (EODHD_API_KEY or CLAUDE_API_KEY)' });
  }

  try {
    // e. Fetch market data (parallel)
    const [stocksData, sectorData] = await Promise.all([
      fetchStockPrices(EODHD_KEY),
      fetchSectorData(EODHD_KEY),
    ]);

    console.log(`${LOG_PREFIX} Fetched ${stocksData.length} stocks, ${sectorData.length} sectors`);

    if (stocksData.length === 0) {
      return res.status(500).json({ error: 'No stock data available from EODHD' });
    }

    // f. Fetch context (parallel, graceful degradation)
    const db = getFirebaseAdmin();

    const [newsContext, economicEvents, priorChapter] = await Promise.all([
      fetchMarketPulseHeadlines(),
      fetchEconomicEvents(),
      getPriorChapter(db, todayStr, chapterId),
    ]);

    // h. Run signal detection
    const editorialBrief = buildEditorialBrief(stocksData, sectorData, economicEvents, newsContext);

    // i. Build combined context
    const topMovers = [...stocksData]
      .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
      .slice(0, 5)
      .map(s => `${s.symbol} ${s.percentChange >= 0 ? '+' : ''}${s.percentChange.toFixed(1)}%`)
      .join(', ');

    const contextParts = [editorialBrief];
    if (newsContext) contextParts.push(`\nRECENT HEADLINES:\n${newsContext}`);
    if (economicEvents) contextParts.push(`\nECONOMIC CALENDAR: ${economicEvents}`);
    if (priorChapter) contextParts.push(`\nPRIOR CHAPTER (for continuity):\n${priorChapter}`);
    contextParts.push(`\nTOP MOVERS: ${topMovers}`);

    const combinedContext = contextParts.join('\n');

    // k. Call Claude Sonnet
    const systemPrompt = buildChapterSystemPrompt(chapterId);

    const sonnetResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: combinedContext }],
      }),
    });

    const sonnetData = await sonnetResponse.json();

    if (sonnetData.error || !sonnetResponse.ok) {
      console.error(`${LOG_PREFIX} Sonnet API error:`, sonnetData.error);
      return res.status(500).json({
        error: 'Chapter generation failed',
        details: sonnetData.error?.message || 'Unknown Sonnet error',
      });
    }

    const rawText = sonnetData.content?.[0]?.text || '';

    // l. Parse response
    const parsed = extractJSON(rawText);
    let brief;
    if (parsed?.brief) {
      brief = parsed.brief;
    } else {
      console.warn(`${LOG_PREFIX} JSON parse failed, using cleanBriefText fallback`);
      brief = cleanBriefText(rawText);
    }

    if (!brief) {
      return res.status(500).json({ error: 'Chapter generation produced empty brief' });
    }

    // Extract signal types from editorial brief for metadata
    const signalTypes = [];
    if (editorialBrief.includes('LEAD STORY')) {
      const leadMatch = editorialBrief.match(/LEAD STORY:.*$/m);
      if (leadMatch) signalTypes.push('detected');
    }

    // m. Store in Firebase
    const chapterData = {
      id: chapterId,
      label: CHAPTER_LABELS[chapterId],
      generatedAt: new Date().toISOString(),
      brief,
      signals: signalTypes,
    };

    await db.collection('dailyStory').doc(todayStr).set(
      { chapters: { [chapterId]: chapterData } },
      { merge: true }
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`${LOG_PREFIX} Chapter "${chapterId}" generated and stored in ${elapsed}s`);

    // n. Return success
    const usage = {
      inputTokens: sonnetData.usage?.input_tokens || 0,
      outputTokens: sonnetData.usage?.output_tokens || 0,
    };

    return res.status(200).json({
      success: true,
      chapter: chapterData,
      meta: {
        date: todayStr,
        stocksFetched: stocksData.length,
        sectorsFetched: sectorData.length,
        hasNews: !!newsContext,
        hasEconomicEvents: !!economicEvents,
        hasPriorChapter: !!priorChapter,
        model: CLAUDE_MODEL,
        usage,
        elapsed: parseFloat(elapsed),
      },
    });
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`${LOG_PREFIX} Failed after ${elapsed}s:`, error.message);
    console.error(error.stack);
    return res.status(500).json({
      error: 'Chapter generation failed',
      message: error.message,
      elapsed: parseFloat(elapsed),
    });
  }
}
