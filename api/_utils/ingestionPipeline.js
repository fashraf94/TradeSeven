// api/_utils/ingestionPipeline.js
// Two-step extraction pipeline: Sonar fetches event context → Haiku extracts structured claims.
// Used by ingestion cron endpoints to populate the ingestedClaims collection.

import Anthropic from '@anthropic-ai/sdk';
import { querySonar } from '../helpers/sonar.js';
import { storeClaims } from './ingestedClaims.js';

const LOG_PREFIX = '[IngestionPipeline]';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// Lazy singleton Anthropic client (same pattern as generate-recap.js)
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

// ═════════════════════════════════════════════════════════════════════
// EARNINGS CALL INGESTION
// ═════════════════════════════════════════════════════════════════════

/**
 * Ingest an earnings call: fetch summary via Sonar, extract claims via Haiku.
 *
 * @param {string} ticker - Stock symbol (e.g., "NVDA")
 * @param {string} reportDate - ISO date (e.g., "2026-03-15")
 * @param {Object} earningsData - { epsActual, epsEstimate, revenueActual, revenueEstimate, surprisePercent, companyName }
 * @returns {{ success: boolean, claimsStored?: number, ticker: string, sourceEvent?: string, error?: string, message?: string }}
 */
export async function ingestEarningsCall(ticker, reportDate, earningsData) {
  const sourceEvent = `${ticker} ${reportDate} Earnings Call`;
  try {
    console.log(`${LOG_PREFIX} Starting earnings ingestion: ${sourceEvent}`);

    // ── Step 1: Sonar fetch ──────────────────────────────────────
    let sonarSummary;
    try {
      const sonarSystem = 'You are a financial research assistant. Provide factual, structured summaries of earnings calls.';
      const sonarPrompt = `Summarize the key points from ${earningsData.companyName || ticker}'s earnings call on ${reportDate}.

Focus on:
1. CEO/CFO forward guidance and specific targets cited
2. Product roadmap updates and launch timelines
3. Competitive positioning statements and market share commentary
4. Risk factors or headwinds mentioned by management
5. Analyst Q&A highlights — what analysts pushed back on

EPS: $${earningsData.epsActual} actual vs $${earningsData.epsEstimate} estimate (${earningsData.surprisePercent > 0 ? '+' : ''}${earningsData.surprisePercent}% surprise).

Keep to 500 words maximum. Include specific numbers and direct quotes where available.`;

      const sonarResponse = await querySonar(sonarSystem, sonarPrompt, {
        maxTokens: 1500,
        temperature: 0.2,
        searchRecencyFilter: 'day',
      });

      sonarSummary = sonarResponse.text;
      if (!sonarSummary || sonarSummary.trim().length === 0) {
        console.error(`${LOG_PREFIX} Sonar returned empty summary for ${ticker}`);
        return { success: false, error: 'sonar_failed', ticker };
      }
      console.log(`${LOG_PREFIX} Sonar summary: ${sonarSummary.length} chars for ${ticker}`);
    } catch (err) {
      console.error(`${LOG_PREFIX} Sonar failed for ${ticker}:`, err.message);
      return { success: false, error: 'sonar_failed', ticker };
    }

    // ── Step 2: Haiku extraction ─────────────────────────────────
    let extractedClaims;
    try {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 2000,
        temperature: 0.3,
        system: EARNINGS_EXTRACTION_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Extract claims from this ${ticker} earnings call (${reportDate}). EPS: $${earningsData.epsActual} vs est $${earningsData.epsEstimate} (${earningsData.surprisePercent}% surprise).\n\nEarnings call summary:\n${sonarSummary}`,
          },
        ],
      });

      const rawText = response.content?.[0]?.text || '';
      extractedClaims = parseClaimsJSON(rawText, ticker);
      if (!extractedClaims) {
        return { success: false, error: 'extraction_failed', ticker };
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Haiku extraction failed for ${ticker}:`, err.message);
      return { success: false, error: 'haiku_failed', ticker };
    }

    // ── Step 3: Enrich and persist ───────────────────────────────
    const enrichedClaims = extractedClaims.map(c => ({
      ...c,
      ticker,
      source: 'earnings_call',
      sourceEvent,
      sourceDate: reportDate,
    }));

    const result = await storeClaims(enrichedClaims);
    console.log(`${LOG_PREFIX} Stored ${result.stored} claims for ${sourceEvent}`);
    return { success: true, claimsStored: result.stored, ticker, sourceEvent };
  } catch (err) {
    console.error(`${LOG_PREFIX} Unexpected error ingesting ${sourceEvent}:`, err.message);
    return { success: false, error: 'unexpected', ticker, message: err.message };
  }
}

// ═════════════════════════════════════════════════════════════════════
// FED EVENT INGESTION
// ═════════════════════════════════════════════════════════════════════

/**
 * Ingest a Fed/macro event: fetch press conference summary via Sonar, extract claims via Haiku.
 *
 * @param {string} eventName - e.g., "FOMC Rate Decision March 2026"
 * @param {string} eventDate - ISO date
 * @param {Object} eventDetails - { decision, actual, expected, description }
 * @returns {{ success: boolean, claimsStored?: number, sourceEvent?: string, error?: string, message?: string }}
 */
export async function ingestFedEvent(eventName, eventDate, eventDetails) {
  const sourceEvent = eventName;
  try {
    console.log(`${LOG_PREFIX} Starting Fed event ingestion: ${sourceEvent}`);

    // ── Step 1: Sonar fetch ──────────────────────────────────────
    let sonarSummary;
    try {
      const sonarSystem = 'You are a macroeconomic research assistant. Provide factual, structured summaries of central bank events and economic data releases.';
      const sonarPrompt = `Summarize the key points from the ${eventName} on ${eventDate}.

Focus on:
1. The decision itself and how it compared to expectations
2. Press conference commentary — Chair's reasoning and key phrases
3. Dot plot changes or forward guidance shifts
4. Any dissenting votes and their reasoning
5. Market reaction commentary from analysts

Decision: ${eventDetails.actual || eventDetails.decision || 'N/A'} (expected: ${eventDetails.expected || 'N/A'}).

Keep to 500 words maximum. Include specific quotes from the press conference where available.`;

      const sonarResponse = await querySonar(sonarSystem, sonarPrompt, {
        maxTokens: 1500,
        temperature: 0.2,
        searchRecencyFilter: 'day',
      });

      sonarSummary = sonarResponse.text;
      if (!sonarSummary || sonarSummary.trim().length === 0) {
        console.error(`${LOG_PREFIX} Sonar returned empty summary for ${eventName}`);
        return { success: false, error: 'sonar_failed' };
      }
      console.log(`${LOG_PREFIX} Sonar summary: ${sonarSummary.length} chars for ${eventName}`);
    } catch (err) {
      console.error(`${LOG_PREFIX} Sonar failed for ${eventName}:`, err.message);
      return { success: false, error: 'sonar_failed' };
    }

    // ── Step 2: Haiku extraction ─────────────────────────────────
    let extractedClaims;
    try {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 2000,
        temperature: 0.3,
        system: FED_EXTRACTION_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Extract claims from this economic event: ${eventName} (${eventDate}).\nDecision: ${eventDetails.actual || eventDetails.decision || 'N/A'} (expected: ${eventDetails.expected || 'N/A'}).\n${eventDetails.description ? `Context: ${eventDetails.description}\n` : ''}\nEvent summary:\n${sonarSummary}`,
          },
        ],
      });

      const rawText = response.content?.[0]?.text || '';
      extractedClaims = parseClaimsJSON(rawText, eventName);
      if (!extractedClaims) {
        return { success: false, error: 'extraction_failed' };
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Haiku extraction failed for ${eventName}:`, err.message);
      return { success: false, error: 'haiku_failed' };
    }

    // ── Step 3: Enrich and persist ───────────────────────────────
    const enrichedClaims = extractedClaims.map(c => ({
      ...c,
      ticker: null,
      source: 'fed_event',
      sourceEvent,
      sourceDate: eventDate,
    }));

    const result = await storeClaims(enrichedClaims);
    console.log(`${LOG_PREFIX} Stored ${result.stored} claims for ${sourceEvent}`);
    return { success: true, claimsStored: result.stored, sourceEvent };
  } catch (err) {
    console.error(`${LOG_PREFIX} Unexpected error ingesting ${sourceEvent}:`, err.message);
    return { success: false, error: 'unexpected', message: err.message };
  }
}

// ═════════════════════════════════════════════════════════════════════
// ANALYST COMMENTARY INGESTION
// ═════════════════════════════════════════════════════════════════════

/**
 * Lighter-weight ingestion for analyst upgrades/downgrades.
 * Built for future use — no cron trigger in Phase 2.
 *
 * @param {string} ticker - Stock symbol
 * @param {string} headline - Analyst action headline
 * @param {string} sourceName - Source publication (e.g., "Morgan Stanley")
 * @returns {{ success: boolean, claimsStored?: number, ticker: string, error?: string, message?: string }}
 */
export async function ingestAnalystCommentary(ticker, headline, sourceName) {
  const sourceEvent = `${ticker} Analyst Commentary — ${sourceName || 'Unknown'}`;
  const sourceDate = new Date().toISOString().split('T')[0];
  try {
    console.log(`${LOG_PREFIX} Starting analyst ingestion: ${sourceEvent}`);

    // ── Step 1: Sonar fetch ──────────────────────────────────────
    let sonarSummary;
    try {
      const sonarSystem = 'You are a financial research assistant. Provide concise summaries of analyst actions and commentary.';
      const sonarPrompt = `Summarize the key points from this analyst action on ${ticker}: "${headline}".
Focus on: the analyst's reasoning, price target (old and new if available), key thesis points, and any sector implications.
Keep to 200 words.`;

      const sonarResponse = await querySonar(sonarSystem, sonarPrompt, {
        maxTokens: 800,
        temperature: 0.2,
        searchRecencyFilter: 'day',
      });

      sonarSummary = sonarResponse.text;
      if (!sonarSummary || sonarSummary.trim().length === 0) {
        console.error(`${LOG_PREFIX} Sonar returned empty summary for ${ticker} analyst`);
        return { success: false, error: 'sonar_failed', ticker };
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Sonar failed for ${ticker} analyst:`, err.message);
      return { success: false, error: 'sonar_failed', ticker };
    }

    // ── Step 2: Haiku extraction ─────────────────────────────────
    let extractedClaims;
    try {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 800,
        temperature: 0.3,
        system: ANALYST_EXTRACTION_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Extract claims from this analyst action on ${ticker}: "${headline}".\n\nAnalyst summary:\n${sonarSummary}`,
          },
        ],
      });

      const rawText = response.content?.[0]?.text || '';
      extractedClaims = parseClaimsJSON(rawText, ticker);
      if (!extractedClaims) {
        return { success: false, error: 'extraction_failed', ticker };
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Haiku extraction failed for ${ticker} analyst:`, err.message);
      return { success: false, error: 'haiku_failed', ticker };
    }

    // ── Step 3: Enrich and persist ───────────────────────────────
    const enrichedClaims = extractedClaims.map(c => ({
      ...c,
      ticker,
      source: 'analyst_commentary',
      sourceEvent,
      sourceDate,
    }));

    const result = await storeClaims(enrichedClaims);
    console.log(`${LOG_PREFIX} Stored ${result.stored} claims for ${sourceEvent}`);
    return { success: true, claimsStored: result.stored, ticker, sourceEvent };
  } catch (err) {
    console.error(`${LOG_PREFIX} Unexpected error ingesting ${sourceEvent}:`, err.message);
    return { success: false, error: 'unexpected', ticker, message: err.message };
  }
}

// ═════════════════════════════════════════════════════════════════════
// EXTRACTION SYSTEM PROMPTS
// ═════════════════════════════════════════════════════════════════════

const EARNINGS_EXTRACTION_SYSTEM = `You are a financial knowledge extraction agent. Extract atomic claims from earnings call summaries. Each claim should be a single, self-contained assertion that could stand alone without any other context.

Respond ONLY with a valid JSON array. No preamble, no markdown fences, no explanation.

Each object in the array:
{
  "claim": "The assertion as a complete, readable sentence",
  "category": "guidance|product|competitive|financial|risk|sentiment",
  "sentiment": "bullish|bearish|neutral",
  "confidence": "high|medium|speculative",
  "linkedTickers": ["OTHER_TICKERS_MENTIONED_IN_THIS_CLAIM"],
  "relevantReporters": ["doug", "alex", "kim"]
}

Category definitions:
- guidance: Forward-looking statements, targets, outlook from management
- product: Product launches, roadmaps, ramp timelines, technical milestones
- competitive: Market share data, competitor mentions, positioning
- financial: Specific numbers — revenue breakdowns, margin changes, CapEx
- risk: Headwinds, risks, regulatory concerns mentioned
- sentiment: Overall tone of the call, analyst reaction, surprise factors

Reporter assignment rules:
- doug (earnings analyst): ALL claims
- alex (stock spotlight): product, competitive, and financial claims
- kim (sector strategist): competitive and financial claims that mention other tickers in linkedTickers
- kai (market pulse): ONLY claims where sentiment is "bullish" or "bearish" AND confidence is "high"
- neta (economics desk): ONLY claims referencing macro factors (Fed, rates, inflation, GDP)

Extract 8-15 claims. Prioritize specificity — "revenue grew 25%" over "revenue grew strongly".`;

const FED_EXTRACTION_SYSTEM = `You are a macroeconomic knowledge extraction agent. Extract atomic claims from central bank event summaries. Each claim should be a single, self-contained assertion that could stand alone without any other context.

Respond ONLY with a valid JSON array. No preamble, no markdown fences, no explanation.

Each object in the array:
{
  "claim": "The assertion as a complete, readable sentence",
  "category": "macro|guidance|risk|sentiment|financial",
  "sentiment": "bullish|bearish|neutral",
  "confidence": "high|medium|speculative",
  "linkedTickers": ["SECTORS_OR_COMPANIES_MENTIONED"],
  "relevantReporters": ["neta", "kim", "kai"]
}

Category definitions:
- macro: Rate decisions, inflation data, employment figures, GDP
- guidance: Forward guidance language, dot plot changes, future meeting signals
- risk: Risks cited by officials — recession, financial stability, global contagion
- sentiment: Market reaction, analyst interpretation, tone assessment
- financial: Specific numbers — rate levels, inflation readings, yield curve data

Reporter assignment rules:
- neta (economics desk): ALL claims
- kim (sector strategist): Claims mentioning specific sectors, industries, or companies
- kai (market pulse): Claims with "bullish" or "bearish" sentiment AND "high" confidence
- doug (earnings analyst): ONLY claims that mention specific company earnings or fundamentals
- alex (stock spotlight): ONLY claims that mention specific company names or tickers

Extract 8-15 claims. Prioritize specificity and direct quotes from officials.`;

const ANALYST_EXTRACTION_SYSTEM = `You are a financial knowledge extraction agent. Extract atomic claims from analyst commentary. Each claim should be a single, self-contained assertion.

Respond ONLY with a valid JSON array. No preamble, no markdown fences, no explanation.

Each object in the array:
{
  "claim": "The assertion as a complete, readable sentence",
  "category": "guidance|product|competitive|financial|risk|sentiment",
  "sentiment": "bullish|bearish|neutral",
  "confidence": "high|medium|speculative",
  "linkedTickers": ["OTHER_TICKERS_MENTIONED"],
  "relevantReporters": ["alex", "kim"]
}

Reporter assignment rules:
- alex (stock spotlight): ALL claims about the target stock
- kim (sector strategist): Claims with sector-wide implications or competitor mentions
- doug (earnings analyst): Claims referencing earnings estimates or fundamentals
- kai (market pulse): ONLY strongly bullish/bearish high-confidence claims
- neta (economics desk): ONLY claims about macro implications

Extract 3-5 claims. Be concise and specific.`;

// ═════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════

/**
 * Parse JSON from a Haiku response, stripping markdown fences if present.
 * Returns parsed array or null on failure.
 */
function parseClaimsJSON(rawText, label) {
  let cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error(`${LOG_PREFIX} Parsed result is not a non-empty array for ${label}`);
      return null;
    }
    console.log(`${LOG_PREFIX} Extracted ${parsed.length} claims for ${label}`);
    return parsed;
  } catch (err) {
    console.error(`${LOG_PREFIX} JSON parse failed for ${label}:`, cleaned.substring(0, 200));
    return null;
  }
}
