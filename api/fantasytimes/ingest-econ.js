// api/fantasytimes/ingest-econ.js
// Cron endpoint: fetches economic calendar via Sonar, ingests Tier 1 events via Haiku.
// Runs after major data release windows (9:45 AM, 1:45 PM, 5:45 PM ET).

import { applySecurityMiddleware } from '../_utils/security.js';
import { querySonar } from '../helpers/sonar.js';
import { getClaimsForTicker } from '../_utils/ingestedClaims.js';
import { ingestFedEvent } from '../_utils/ingestionPipeline.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:IngestEcon]';

// Tier 1 high-impact event keywords (matches generate-econ.js)
const TIER_1_KEYWORDS = [
  'cpi', 'nfp', 'non-farm', 'nonfarm', 'payrolls', 'gdp', 'ppi',
  'fed', 'fomc', 'interest rate', 'federal reserve', 'pce',
];

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

function logError(msg, data = null) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

/**
 * Check if an event is Tier 1 (high impact, market-moving).
 * Matches isTier1Event() logic from generate-econ.js.
 */
function isTier1Event(event) {
  if (event.impact === 'high') return true;
  const name = (event.event || '').toLowerCase();
  return TIER_1_KEYWORDS.some((kw) => name.includes(kw));
}

/**
 * Fetch economic calendar from Sonar (same pattern as generate-econ.js).
 */
async function fetchEconomicEvents() {
  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const systemPrompt = `You are an economic calendar analyst. Generate a structured economic events calendar as JSON.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
{
  "thisWeek": [
    {
      "date": "YYYY-MM-DD",
      "day": "Monday",
      "time": "10:00 AM ET",
      "event": "ISM Manufacturing PMI",
      "previous": "50.9",
      "estimate": "50.5",
      "actual": "51.2" or null,
      "impact": "high" | "medium" | "low",
      "category": "manufacturing" | "employment" | "inflation" | "housing" | "consumer" | "fed" | "gdp" | "trade" | "other",
      "brief": "One sentence on why this matters for markets right now"
    }
  ],
  "nextWeek": [],
  "highlight": "One sentence summary of the single most important event"
}

Rules:
- Include ALL major US economic releases for this week and next week
- "actual" should be null if the data hasn't been released yet, or the actual value if already released
- Order events chronologically within each week
- "impact" rating: high = likely to move markets (Fed decisions, NFP, CPI, GDP), medium = sector-specific impact, low = minor indicator
- Always include: Fed speakers/decisions, employment data, inflation data, GDP, PMIs, consumer confidence, housing data`;

  const userPrompt = `What are the major US economic data releases and Fed events for this week (starting ${todayET}) and next week? Include actual values for any data already released today.`;

  const { text } = await querySonar(systemPrompt, userPrompt, {
    maxTokens: 2000,
    temperature: 0.2,
    searchRecencyFilter: 'week',
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Sonar response');
  return JSON.parse(jsonMatch[0]);
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo('Fetching economic calendar from Sonar...');
    const calendar = await fetchEconomicEvents();
    const events = calendar.thisWeek || [];

    // Filter to Tier 1 events with released data
    const releasedTier1 = events.filter(
      (e) => e.actual !== null && e.actual !== undefined && isTier1Event(e)
    );

    logInfo(`Found ${releasedTier1.length} Tier 1 released events`);

    if (releasedTier1.length === 0) {
      return res.status(200).json({
        success: true,
        eventsFound: events.length,
        tier1Released: 0,
        alreadyIngested: 0,
        ingested: 0,
        results: [],
      });
    }

    // Time filter: only events from the last 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const yesterdayET = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Keep events from today or yesterday (rough 12h window — Sonar dates are date-level, not timestamp-level)
    const recentEvents = releasedTier1.filter(
      (e) => e.date === todayET || e.date === yesterdayET
    );

    logInfo(`Recent Tier 1 events (last 12h window): ${recentEvents.length}`);

    // Dedup: check which events already have claims
    const toIngest = [];
    let alreadyIngested = 0;

    for (const event of recentEvents) {
      const existingClaims = await getClaimsForTicker(null, {
        source: 'fed_event',
        limit: 1,
      });
      const alreadyDone = existingClaims.some(
        (c) => c.sourceDate === event.date && c.sourceEvent?.includes(event.event)
      );

      if (alreadyDone) {
        alreadyIngested++;
        logInfo(`Skipping ${event.event} — already ingested`);
        continue;
      }
      toIngest.push(event);
    }

    const results = [];
    for (const event of toIngest) {
      logInfo(`Ingesting event: ${event.event}`);
      const result = await ingestFedEvent(
        event.event,
        event.date,
        {
          decision: event.actual,
          actual: event.actual,
          expected: event.estimate,
          description: event.brief || '',
        }
      );
      results.push({ event: event.event, ...result });
    }

    const ingested = results.filter(r => r.success).length;
    logInfo('Econ ingestion complete', { ingested, errors: results.filter(r => !r.success).length });

    return res.status(200).json({
      success: true,
      eventsFound: events.length,
      tier1Released: releasedTier1.length,
      recentEvents: recentEvents.length,
      alreadyIngested,
      ingested,
      results,
    });
  } catch (err) {
    logError('Econ ingestion cron failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
