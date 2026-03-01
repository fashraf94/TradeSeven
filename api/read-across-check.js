// api/read-across-check.js
// Read-Across Alert System — Vercel Cron endpoint
// Scans for significant market events via Sonar, traverses connection graph,
// synthesizes second-order impacts via Haiku, stores alerts for frontend.

import { querySonar } from './helpers/sonar.js';
import { applySecurityMiddleware } from './_utils/security.js';
import { readFileSync, writeFileSync } from 'fs';

const LOG = '[ReadAcross]';
const ALERTS_PATH = '/tmp/read-across-alerts.json';
const ALERT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_ALERTS = 10;
const MAX_SYNTH_PER_CYCLE = 3;

// Anthropic API config
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// =============================================================================
// STATIC CONNECTION GRAPH — derived from ledger extracts + Cross-Sector Bridge
// =============================================================================

const CONNECTION_GRAPH = {
  NVDA: {
    competitors: ['AMD', 'AVGO'],
    customers: ['MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA'],
    suppliers: [],
    thematic: ['SNOW'],
    crossSector: ['GS', 'MS', 'BX'],
  },
  AAPL: {
    competitors: ['MSFT', 'GOOGL'],
    customers: [],
    suppliers: ['AVGO'],
    thematic: ['V', 'AXP', 'JPM'],
    crossSector: ['JPM'],
  },
  MSFT: {
    competitors: ['GOOGL', 'AMZN', 'SNOW', 'META'],
    customers: ['JPM', 'GS', 'MS', 'C', 'PNC'],
    suppliers: ['NVDA', 'AMD'],
    thematic: [],
    crossSector: ['JPM', 'GS', 'MS'],
  },
  AMZN: {
    competitors: ['MSFT', 'GOOGL'],
    customers: ['JPM', 'GS', 'C', 'PNC'],
    suppliers: ['NVDA', 'AMD'],
    thematic: ['V', 'AXP'],
    crossSector: [],
  },
  META: {
    competitors: ['GOOGL', 'AMZN'],
    customers: [],
    suppliers: ['NVDA', 'AMD'],
    thematic: ['V'],
    crossSector: [],
  },
  GOOGL: {
    competitors: ['MSFT', 'AMZN', 'META'],
    customers: [],
    suppliers: ['NVDA'],
    thematic: ['AVGO'],
    crossSector: [],
  },
  TSLA: {
    competitors: [],
    customers: [],
    suppliers: ['NVDA'],
    thematic: ['ALLY'],
    crossSector: ['ALLY'],
  },
  AMD: {
    competitors: ['NVDA', 'AVGO'],
    customers: ['MSFT', 'AMZN', 'META', 'GOOGL'],
    suppliers: [],
    thematic: [],
    crossSector: [],
  },
  AVGO: {
    competitors: ['NVDA', 'AMD'],
    customers: ['GOOGL', 'META', 'AAPL'],
    suppliers: [],
    thematic: [],
    crossSector: [],
  },
  SNOW: {
    competitors: ['MSFT', 'AMZN', 'GOOGL'],
    customers: [],
    suppliers: [],
    thematic: ['NVDA'],
    crossSector: ['JPM', 'GS'],
  },
  JPM: {
    competitors: ['C', 'GS', 'MS', 'PNC'],
    customers: [],
    suppliers: ['MSFT', 'AMZN'],
    thematic: ['V', 'AXP', 'ALLY', 'AFRM'],
    crossSector: ['AAPL', 'NVDA', 'MSFT'],
  },
  C: {
    competitors: ['JPM', 'PNC'],
    customers: [],
    suppliers: [],
    thematic: ['ALLY', 'AFRM', 'V', 'AXP'],
    crossSector: [],
  },
  GS: {
    competitors: ['MS', 'JPM', 'BX'],
    customers: [],
    suppliers: [],
    thematic: ['AFRM'],
    crossSector: ['NVDA', 'MSFT', 'AMZN'],
  },
  MS: {
    competitors: ['GS', 'JPM', 'BX'],
    customers: [],
    suppliers: [],
    thematic: ['ALLY'],
    crossSector: ['NVDA', 'MSFT'],
  },
  V: {
    competitors: ['AXP'],
    customers: [],
    suppliers: [],
    thematic: ['JPM', 'C', 'AAPL', 'AMZN', 'META'],
    crossSector: ['AAPL', 'AMZN', 'META'],
  },
  AXP: {
    competitors: ['V', 'AFRM'],
    customers: [],
    suppliers: [],
    thematic: ['JPM', 'C'],
    crossSector: ['AAPL', 'TSLA'],
  },
  BX: {
    competitors: ['GS', 'MS'],
    customers: [],
    suppliers: [],
    thematic: ['ALLY', 'PNC'],
    crossSector: ['NVDA', 'MSFT'],
  },
  AFRM: {
    competitors: ['V', 'AXP', 'JPM'],
    customers: [],
    suppliers: [],
    thematic: ['ALLY', 'C'],
    crossSector: ['AMZN', 'AAPL'],
  },
  PNC: {
    competitors: ['JPM', 'C'],
    customers: [],
    suppliers: [],
    thematic: ['ALLY'],
    crossSector: ['MSFT'],
  },
  ALLY: {
    competitors: ['JPM', 'PNC'],
    customers: [],
    suppliers: [],
    thematic: ['TSLA', 'AFRM', 'V'],
    crossSector: ['TSLA'],
  },
};

const UNIVERSE = new Set(Object.keys(CONNECTION_GRAPH));

// In-memory backup for alerts (survives warm invocations)
let activeAlerts = [];

// =============================================================================
// PERSISTENCE HELPERS — /tmp file + in-memory backup
// =============================================================================

function loadAlerts() {
  try {
    const raw = readFileSync(ALERTS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      activeAlerts = parsed;
      return parsed;
    }
  } catch {
    // File doesn't exist or is corrupt — use in-memory
  }
  return activeAlerts;
}

function saveAlerts(alerts) {
  activeAlerts = alerts;
  try {
    writeFileSync(ALERTS_PATH, JSON.stringify(alerts, null, 2));
  } catch (err) {
    console.warn(`${LOG} Failed to write /tmp alerts:`, err.message);
  }
}

function pruneAlerts(alerts) {
  const now = Date.now();
  return alerts
    .filter(a => now - a.timestamp < ALERT_TTL_MS)
    .slice(0, MAX_ALERTS);
}

function isDuplicate(alerts, ticker) {
  const now = Date.now();
  return alerts.some(
    a => a.triggerTicker === ticker && now - a.timestamp < DEDUP_WINDOW_MS
  );
}

// =============================================================================
// STEP 3: CONNECTION GRAPH TRAVERSAL
// =============================================================================

function buildConnectionContext(ticker) {
  const conns = CONNECTION_GRAPH[ticker];
  if (!conns) return { context: '', tickers: [] };

  const parts = [];
  const allTickers = new Set();

  for (const [relType, tickers] of Object.entries(conns)) {
    if (tickers.length > 0) {
      const label = relType === 'crossSector' ? 'cross-sector' : relType;
      for (const t of tickers) allTickers.add(t);
      parts.push(`${tickers.join(', ')} (${label})`);
    }
  }

  return {
    context: parts.join('; '),
    tickers: [...allTickers],
  };
}

// =============================================================================
// STEP 4: HAIKU SYNTHESIS
// =============================================================================

async function synthesizeImpact(event, connectionContext) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.warn(`${LOG} CLAUDE_API_KEY not set, skipping Haiku synthesis`);
    return null;
  }

  const prompt = `EVENT: ${event.headline}
DETAILS: ${event.summary}
PRIMARY TICKER: ${event.primaryTicker} | DIRECTION: ${event.direction}

CONNECTED STOCKS: ${connectionContext}

Respond ONLY with valid JSON, no markdown fences:
{
  "analysis": "2-3 sentences on second-order impacts. Explain the causal chain — why does this event affect connected stocks?",
  "impactedStocks": [
    { "ticker": "X", "relationship": "competitor|customer|supplier|thematic|cross-sector", "expectedImpact": "positive|negative|mixed", "reasoning": "One sentence" }
  ],
  "watchItems": ["Brief monitoring item"]
}

Rules:
- Max 5 impacted stocks, max 3 watch items
- Be educational — explain the causal chain for each impacted stock
- Only include stocks that have a clear, logical connection to the event
- expectedImpact should reflect the SECOND-ORDER effect, not the primary event`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 600,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`${LOG} Haiku API error ${response.status}:`, errText);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error(`${LOG} Haiku synthesis failed:`, err.message);
    return null;
  }
}

// =============================================================================
// SONAR SCAN PROMPTS
// =============================================================================

const SCAN_SYSTEM = `You are a financial news scanner for a stock analysis platform. Return ONLY valid JSON, no markdown fences, no preamble.`;

function buildScanPrompt() {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return `What are the 3-5 most significant stock-moving news events in the LAST 2 HOURS for Technology, Financial Services, and Semiconductors?

Today is ${dateStr}.

Return JSON:
{
  "events": [
    {
      "headline": "Brief headline",
      "primaryTicker": "TICKER",
      "sector": "Technology" | "Financial Services" | "Semiconductors",
      "magnitude": "high" | "medium",
      "direction": "positive" | "negative" | "mixed",
      "summary": "1-2 sentence summary"
    }
  ]
}

Rules:
- Only events that moved stocks >1% or have clear forward implications
- primaryTicker = single most directly affected US stock ticker symbol
- If no significant events, return { "events": [] }
- Only include tickers from major US-listed companies`;
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Cron auth — allow Vercel cron header, Bearer token, or dev mode (no secret configured)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isTestMode = req.query.testMode === 'true';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (!isVercelCron && !isTestMode) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log(`${LOG} ── Run started ──`);
  console.log(`${LOG} Trigger: ${isVercelCron ? 'Vercel Cron' : 'Manual'}`);

  // Load existing alerts
  let alerts = loadAlerts();
  alerts = pruneAlerts(alerts);
  let newAlerts = 0;
  let eventsScanned = 0;
  let eventsRelevant = 0;

  try {
    // ─── Step 1: Sonar News Scan ────────────────────────────
    console.log(`${LOG} Step 1: Scanning for market events via Sonar`);

    const { text, citations } = await querySonar(SCAN_SYSTEM, buildScanPrompt(), {
      searchRecencyFilter: 'day',
      maxTokens: 1000,
      temperature: 0.2,
    });

    let scanResult;
    try {
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      scanResult = JSON.parse(jsonStr);
    } catch {
      console.warn(`${LOG} Sonar JSON parse failed, raw:`, text.slice(0, 200));
      scanResult = { events: [] };
    }

    const events = scanResult.events || [];
    eventsScanned = events.length;
    console.log(`${LOG} Step 1 complete: ${eventsScanned} events found`);

    if (eventsScanned === 0) {
      saveAlerts(alerts);
      return res.status(200).json({
        success: true,
        alerts,
        newAlerts: 0,
        eventsScanned: 0,
        eventsRelevant: 0,
        message: 'No significant events detected',
      });
    }

    // ─── Step 2: Filter to universe ─────────────────────────
    const relevant = events.filter(e => e.primaryTicker && UNIVERSE.has(e.primaryTicker));
    eventsRelevant = relevant.length;
    console.log(`${LOG} Step 2: ${eventsRelevant} events match our universe`);

    if (eventsRelevant === 0) {
      saveAlerts(alerts);
      return res.status(200).json({
        success: true,
        alerts,
        newAlerts: 0,
        eventsScanned,
        eventsRelevant: 0,
        message: 'No events for tracked tickers',
      });
    }

    // ─── Steps 3-5: Process each event ──────────────────────
    let synthCount = 0;
    for (const event of relevant) {
      if (synthCount >= MAX_SYNTH_PER_CYCLE) {
        console.log(`${LOG} Max syntheses per cycle (${MAX_SYNTH_PER_CYCLE}) reached`);
        break;
      }

      // Dedup check
      if (isDuplicate(alerts, event.primaryTicker)) {
        console.log(`${LOG} Skipping ${event.primaryTicker} — dedup within ${DEDUP_WINDOW_MS / 3600000}h`);
        continue;
      }

      // Step 3: Connection graph traversal
      const { context, tickers: connectedTickers } = buildConnectionContext(event.primaryTicker);
      console.log(`${LOG} Step 3: ${event.primaryTicker} connections: ${context || 'none'}`);

      if (!context) {
        console.log(`${LOG} No connections for ${event.primaryTicker}, skipping`);
        continue;
      }

      // Step 4: Haiku synthesis
      console.log(`${LOG} Step 4: Synthesizing impact for ${event.primaryTicker}`);
      const synthesis = await synthesizeImpact(event, context);
      synthCount++;

      // Step 5: Store alert
      const alert = {
        id: `${event.primaryTicker}-${Date.now()}`,
        triggerTicker: event.primaryTicker,
        headline: event.headline,
        summary: event.summary,
        direction: event.direction,
        magnitude: event.magnitude,
        sector: event.sector,
        analysis: synthesis?.analysis || `${event.headline} — monitoring for cross-company impacts.`,
        impactedStocks: synthesis?.impactedStocks || connectedTickers.slice(0, 5).map(t => ({
          ticker: t,
          relationship: Object.entries(CONNECTION_GRAPH[event.primaryTicker] || {})
            .find(([, arr]) => arr.includes(t))?.[0] || 'connected',
          expectedImpact: 'mixed',
          reasoning: 'Monitoring for impact',
        })),
        watchItems: synthesis?.watchItems || [],
        citations: citations || [],
        timestamp: Date.now(),
      };

      alerts.unshift(alert);
      newAlerts++;
      console.log(`${LOG} Step 5: Alert stored for ${event.primaryTicker} (${alert.id})`);
    }

    // Prune and save
    alerts = pruneAlerts(alerts);
    saveAlerts(alerts);

    console.log(`${LOG} ── Run complete: ${newAlerts} new alerts, ${alerts.length} total ──`);

    return res.status(200).json({
      success: true,
      alerts,
      newAlerts,
      eventsScanned,
      eventsRelevant,
    });
  } catch (error) {
    console.error(`${LOG} Pipeline error:`, error.message, error.stack);

    // Return whatever alerts we have (stale fallback)
    saveAlerts(alerts);
    return res.status(200).json({
      success: true,
      alerts,
      newAlerts: 0,
      eventsScanned,
      eventsRelevant,
      error: error.message,
    });
  }
}
