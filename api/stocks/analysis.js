// Vercel Serverless Function — Stock Analysis (AI-generated)
// Endpoint: GET /api/stocks/analysis?symbol=RKLB&mode=quick
//
// Combines Tier 1 knowledge packages or Tier 2 Sonar briefs with
// real-time EODHD data + pillar scores, calls Haiku, and returns
// rendered analysis text.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { sanitizeDocumentId } from '../_utils/sanitizeInput.js';
import { getFromCache, setInCache, setCacheHeaders } from '../_utils/serverCache.js';
import { getStockContext, TICKERS } from '../_utils/stockIntelligenceData.js';
import { getStockBrief } from '../_utils/stockBriefService.js';
import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[StockAnalysis]';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const CACHE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2-hour cache windows

// ---------------------------------------------------------------------------
// Firebase Admin
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
// System Prompts
// ---------------------------------------------------------------------------

const TIER_QUICK_PROMPT = `You are the FantasyTrades Stock Intelligence Agent — an educational tool helping users understand stocks for a competitive fantasy trading game.

You are provided with company research context, real-time market data, and ranking data.

MODE: QUICK INSIGHTS
- Respond with exactly 3-4 bullet points
- Each bullet: one specific data point + one sentence of context
- Format: **[Metric]:** [Value] — [What it means]
- Total response under 120 words
- No disclaimers, no preamble, no closing
- Lead with most impactful insight first
- Last bullet = counterpoint/risk if applicable
- Never recommend buying or selling
- Frame insights for a 5-day competitive trading game`;

const TIER_DEEP_PROMPT = `You are the FantasyTrades Stock Intelligence Agent — an educational tool helping users understand stocks for a competitive fantasy trading game. You are NOT a financial advisor.

You are provided with company research context, real-time market data, and ranking data.

MODE: DEEP ANALYSIS
- Respond in 3-4 concise paragraphs
- Lead with data, never opinion. Every claim references a specific metric.
- Explain concepts — teach what the metric means, not just its value.
- Present both sides — every bullish signal paired with a risk factor.
- Reference cross-company connections when relevant.
- Never recommend buying, selling, or holding.
- Use "the data suggests," "historically this indicates," "bulls would argue / bears would counter."
- Keep total response under 250 words.`;

// ---------------------------------------------------------------------------
// Context Formatters
// ---------------------------------------------------------------------------

function formatTier2Context(brief) {
  if (!brief) return '';
  let ctx = '';

  if (brief.description) {
    ctx += `COMPANY OVERVIEW:\n${brief.description}\n\n`;
  }
  if (brief.revenueSegments?.length) {
    ctx += `REVENUE SEGMENTS:\n${brief.revenueSegments.map(s =>
      `- ${s.name}: ${s.description} (${s.percentOfRevenue})`
    ).join('\n')}\n\n`;
  }
  if (brief.growthDrivers?.length) {
    ctx += `GROWTH DRIVERS: ${brief.growthDrivers.join('; ')}\n\n`;
  }
  if (brief.keyRisks?.length) {
    ctx += `KEY RISKS: ${brief.keyRisks.join('; ')}\n\n`;
  }
  if (brief.competitivePosition) {
    ctx += `COMPETITIVE POSITION: ${brief.competitivePosition}\n\n`;
  }
  if (brief.recentCatalysts?.length) {
    ctx += `RECENT CATALYSTS: ${brief.recentCatalysts.join('; ')}\n\n`;
  }
  if (brief.financialSnapshot) {
    const fs = brief.financialSnapshot;
    ctx += `FINANCIAL SNAPSHOT: Market Cap ${fs.marketCap}, Rev Growth ${fs.revenueGrowth}, Margin ${fs.profitMargin}, ${fs.keyMetric}\n`;
  }

  return ctx;
}

function formatEODHDContext(data) {
  if (!data) return '';
  let ctx = 'REAL-TIME DATA:\n';
  if (data.currentPrice) ctx += `Price: $${data.currentPrice} | Change: ${data.change >= 0 ? '+' : ''}${Number(data.change).toFixed(2)}%\n`;
  if (data.marketCap) ctx += `Market Cap: $${formatLargeNum(data.marketCap)} | P/E: ${data.peRatio ?? 'N/A'}\n`;
  if (data.week52Low && data.week52High) ctx += `52-Week Range: $${data.week52Low} - $${data.week52High}\n`;
  if (data.profitMargin != null) ctx += `Profit Margin: ${(data.profitMargin * 100).toFixed(1)}%\n`;
  if (data.revenueGrowthYOY != null) ctx += `Revenue Growth YoY: ${(data.revenueGrowthYOY * 100).toFixed(1)}%\n`;
  return ctx;
}

function formatPillarContext(rankings) {
  if (!rankings) return '';
  const d = rankings;
  let ctx = 'RANKING DATA:\n';
  if (d.compositeScore != null) ctx += `Composite Score: ${d.compositeScore}/100\n`;
  if (d.pillars) {
    const p = d.pillars;
    if (p.momentum?.percentile != null) ctx += `Momentum: ${p.momentum.percentile} | `;
    if (p.quality?.percentile != null) ctx += `Quality: ${p.quality.percentile} | `;
    if (p.valuation?.percentile != null) ctx += `Valuation: ${p.valuation.percentile}\n`;
    if (p.capitalEff?.percentile != null) ctx += `Capital Efficiency: ${p.capitalEff.percentile}\n`;
  }
  if (d.compositeRank != null && d.totalPeers != null) {
    ctx += `Sector Rank: #${d.compositeRank} of ${d.totalPeers}\n`;
  }
  if (d.dnaBadge) ctx += `DNA: ${d.dnaBadge}\n`;
  return ctx;
}

function formatLargeNum(n) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Data Fetchers
// ---------------------------------------------------------------------------

async function fetchEODHDData(symbol) {
  const API_KEY = process.env.EODHD_API_KEY;
  if (!API_KEY) return null;

  try {
    const eohdSymbol = normalizeSymbolForEODHD(symbol);
    const url = `https://eodhd.com/api/fundamentals/${eohdSymbol}.US?api_token=${API_KEY}&fmt=json`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const highlights = data.Highlights || {};
    const technicals = data.Technicals || {};

    return {
      currentPrice: highlights.MarketCapitalization && highlights.SharesOutstanding
        ? (highlights.MarketCapitalization / highlights.SharesOutstanding)
        : null,
      change: null, // Would need historical data for daily change
      marketCap: highlights.MarketCapitalization || 0,
      peRatio: highlights.PERatio || null,
      profitMargin: highlights.ProfitMargin || null,
      revenueGrowthYOY: highlights.QuarterlyRevenueGrowthYOY || null,
      week52Low: technicals['52WeekLow'] || null,
      week52High: technicals['52WeekHigh'] || null,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} EODHD fetch error for ${symbol}:`, err.message);
    return null;
  }
}

async function fetchPillarScores(symbol) {
  try {
    const db = getFirebaseAdmin();
    const doc = await db.collection('peerRankings').doc(symbol).get();
    if (!doc.exists) return null;
    return doc.data();
  } catch (err) {
    console.error(`${LOG_PREFIX} Pillar scores error for ${symbol}:`, err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { symbol, mode = 'quick' } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const sanitizedSymbol = sanitizeDocumentId(symbol.trim().toUpperCase());
  if (!sanitizedSymbol) {
    return res.status(400).json({ error: 'Invalid symbol format' });
  }

  const upper = sanitizedSymbol;
  if (upper.length > 10 || !/^[A-Z0-9.\-]+$/.test(upper)) {
    return res.status(400).json({ error: 'Invalid symbol format' });
  }

  const validMode = mode === 'deep' ? 'deep' : 'quick';

  // Check response cache (2-hour window)
  const hourBucket = Math.floor(Date.now() / CACHE_WINDOW_MS);
  const cacheKey = `analysis_${upper}_${validMode}_${hourBucket}`;

  const cached = getFromCache(cacheKey);
  if (cached) {
    setCacheHeaders(res, 3600, 600);
    return res.status(200).json({ ...cached, cached: true });
  }

  // Validate API key
  const API_KEY = process.env.CLAUDE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
    // Determine tier and load context
    let companyContext = '';
    let tier = 2;
    let source = 'sonar';

    const isTier1 = TICKERS.includes(upper);

    if (isTier1) {
      tier = 1;
      source = 'knowledge_package';
      companyContext = getStockContext(upper, '', { mode: validMode });
    } else {
      const brief = await getStockBrief(upper);
      if (brief) {
        companyContext = formatTier2Context(brief);
      } else {
        return res.status(200).json({ analysis: null, tier: 0, error: 'No analysis data available' });
      }
    }

    // Fetch EODHD data and pillar scores in parallel
    const [eodhd, pillar] = await Promise.all([
      fetchEODHDData(upper),
      fetchPillarScores(upper),
    ]);

    // Assemble full context
    const contextParts = [companyContext];
    const eohdCtx = formatEODHDContext(eodhd);
    if (eohdCtx) contextParts.push(eohdCtx);
    const pillarCtx = formatPillarContext(pillar);
    if (pillarCtx) contextParts.push(pillarCtx);

    const fullContext = contextParts.join('\n\n');

    // Call Haiku
    const systemPrompt = validMode === 'deep' ? TIER_DEEP_PROMPT : TIER_QUICK_PROMPT;
    const maxTokens = validMode === 'deep' ? 1000 : 400;

    const aiResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Analyze this stock:\n\n${fullContext}`,
        }],
      }),
    });

    const aiData = await aiResponse.json();

    if (aiData.error || !aiResponse.ok) {
      console.error(`${LOG_PREFIX} Haiku API error for ${upper}:`, aiData.error);
      return res.status(500).json({ error: 'AI analysis failed', details: aiData.error?.message });
    }

    const analysis = aiData.content?.[0]?.text || null;

    if (!analysis) {
      return res.status(500).json({ error: 'Empty AI response' });
    }

    // Cache and return
    const result = { analysis, tier, source };
    setInCache(cacheKey, result, 7200); // 2 hours
    setCacheHeaders(res, 3600, 600);

    return res.status(200).json({ ...result, cached: false });

  } catch (error) {
    console.error(`${LOG_PREFIX} Error for ${upper}:`, error.message);
    return res.status(500).json({ error: 'Failed to generate analysis', message: error.message });
  }
}
