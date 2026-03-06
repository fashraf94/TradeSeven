// api/sector-insight.js
// Sector Insight endpoint — Sonar-powered sector narratives for MoneyMap
// Replaces template generateInsight() text with news-grounded analysis

import { querySonar } from './helpers/sonar.js';
import { applySecurityMiddleware } from './_utils/security.js';
import { getFromCache, setInCache } from './_utils/serverCache.js';

// =============================================================================
// System prompt for Sonar — structured sector narrative
// =============================================================================

const SYSTEM_PROMPT = `You are a sector analyst for FantasyTrades, an educational stock analysis platform. Given a sector's current data, provide a concise news-grounded narrative explaining what's driving this sector right now.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
{
  "narrative": "2-3 sentences explaining what's driving this sector's current performance. Reference specific recent events, earnings, policy changes, or macro factors. Be specific — cite company names, dates, percentages when relevant.",
  "drivers": ["Driver 1 (3-5 words)", "Driver 2", "Driver 3"]
}

Rules:
- The narrative must explain WHY the sector is performing as indicated by the data, not just restate the numbers
- Reference real recent events from the past 1-2 weeks
- drivers array should have 2-4 concise labels for the key forces (e.g., "AI capex acceleration", "Fed rate cut hopes", "Weak consumer spending")
- Keep the narrative under 80 words
- Do NOT use generic filler — every sentence must contain actionable intelligence`;

// Module-level stale fallback per sector
const lastSuccessfulResponses = new Map();

const CACHE_TTL = 1800; // 30 minutes

// =============================================================================
// Handler
// =============================================================================

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 20, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sectorName, etfSymbol, change1M, breadthPct, quadrant } = req.body || {};

  if (!sectorName || !etfSymbol) {
    return res.status(400).json({ error: 'Missing required fields: sectorName, etfSymbol' });
  }

  // Per-sector cache
  const cacheKey = `sector_insight_${etfSymbol}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const userPrompt = `Analyze the ${sectorName} sector (ETF: ${etfSymbol}). Current data: 1-month change ${change1M > 0 ? '+' : ''}${change1M?.toFixed(1) || 0}%, breadth ${breadthPct?.toFixed(0) || 50}% above 50-DMA, quadrant: ${quadrant || 'NEUTRAL'}. Today is ${dateStr}. What recent events and forces are driving this sector's performance?`;

  try {
    console.log(`[SectorInsight] Fetching insight for ${etfSymbol} (${sectorName})`);

    const { text, citations } = await querySonar(SYSTEM_PROMPT, userPrompt, {
      searchRecencyFilter: 'week',
      maxTokens: 800,
      temperature: 0.3,
    });

    // Parse JSON from Sonar response
    let parsed;
    try {
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.warn(`[SectorInsight] JSON parse failed for ${etfSymbol}, raw:`, text.slice(0, 200));
      parsed = {
        narrative: 'Sector analysis temporarily unavailable',
        drivers: [],
      };
    }

    const responseData = {
      success: true,
      data: {
        narrative: parsed.narrative || 'Sector analysis temporarily unavailable',
        drivers: Array.isArray(parsed.drivers) ? parsed.drivers : [],
        citations: citations || [],
        cachedAt: Date.now(),
      },
    };

    setInCache(cacheKey, responseData, CACHE_TTL);
    lastSuccessfulResponses.set(etfSymbol, responseData);
    console.log(`[SectorInsight] Cached ${etfSymbol}: ${parsed.drivers?.length || 0} drivers, ${citations?.length || 0} citations`);

    return res.status(200).json(responseData);
  } catch (error) {
    console.error(`[SectorInsight] Error for ${etfSymbol}:`, error.message, error.stack);

    // Stale fallback per sector
    const stale = lastSuccessfulResponses.get(etfSymbol);
    if (stale) {
      console.log(`[SectorInsight] Returning stale fallback for ${etfSymbol}`);
      return res.status(200).json({ ...stale, stale: true });
    }

    return res.status(200).json({
      success: true,
      data: {
        narrative: null,
        drivers: [],
        citations: [],
        cachedAt: null,
      },
    });
  }
}
