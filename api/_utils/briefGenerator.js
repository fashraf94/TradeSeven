/**
 * Shared Sonar Brief Generator
 *
 * Core logic for generating Tier 2 company briefs via Perplexity Sonar.
 * Used by: api/cron/compute-briefs.js, api/admin/generate-briefs.js
 */

import { querySonar } from '../helpers/sonar.js';
import { extractJSON } from './extractJSON.js';
import {
  NEUTRAL_STOCKS,
  AGGRESSIVE_STOCKS,
  DEFENSIVE_STOCKS,
} from '../../src/services/draftAssets.js';

// Stocks with Tier 1 knowledge packages — skip these in brief generation
export const TIER_1_STOCKS = new Set([
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AMD', 'AVGO', 'SNOW',
  'JPM', 'C', 'GS', 'MS', 'V', 'AXP', 'BX', 'AFRM', 'PNC', 'ALLY',
]);

/**
 * Returns all 75 draft stocks (combined from 3 category arrays).
 */
export function getAllDraftStocks() {
  return [...NEUTRAL_STOCKS, ...AGGRESSIVE_STOCKS, ...DEFENSIVE_STOCKS];
}

/**
 * Returns draft stocks that do NOT have a Tier 1 knowledge package.
 * Result count: 61 (75 draft stocks - 14 that overlap with Tier 1).
 */
export function getNonTier1Stocks() {
  return getAllDraftStocks().filter(stock => !TIER_1_STOCKS.has(stock.symbol));
}

// ---------------------------------------------------------------------------
// Sonar Prompts
// ---------------------------------------------------------------------------

const BRIEF_SYSTEM_PROMPT = `You are a financial research analyst producing concise company briefs for an educational stock analysis platform.

OUTPUT FORMAT — respond ONLY with a JSON object, no markdown, no preamble:
{
  "description": "2-3 sentence company description. What they do, how they make money.",
  "revenueSegments": [
    { "name": "Segment Name", "description": "What this segment does", "percentOfRevenue": "~XX%" }
  ],
  "growthDrivers": ["Driver 1 with specific data point", "Driver 2", "Driver 3"],
  "keyRisks": ["Risk 1 with context", "Risk 2", "Risk 3"],
  "competitivePosition": "2-3 sentences on market position, key competitors, and moat/differentiation",
  "recentCatalysts": ["Most recent significant event with date", "Second recent event"],
  "financialSnapshot": {
    "marketCap": "$XXB",
    "revenueGrowth": "XX% YoY",
    "profitMargin": "XX%",
    "keyMetric": "One standout financial metric specific to this company"
  }
}

RULES:
- Use the most recent publicly available data (10-K, 10-Q, earnings calls)
- Include specific numbers and dates, not vague statements
- Revenue segments should reflect actual business unit reporting where available
- For pre-revenue or single-segment companies, use operational metrics instead
- Keep total response under 800 tokens
- Do NOT include disclaimers, caveats, or investment recommendations`;

export function buildBriefPrompt(symbol, name, category) {
  return `Generate a company brief for ${name} (${symbol}), a ${category} category stock. Include their most recent quarterly results, revenue breakdown by segment, key growth drivers, main risks, competitive positioning, and any significant recent developments from the past 3 months.`;
}

/**
 * Generate a single company brief via Perplexity Sonar.
 *
 * @param {string} symbol - Stock ticker
 * @param {string} name   - Company name
 * @param {string} category - Draft category (neutral/aggressive/defensive)
 * @returns {Promise<Object>} Parsed brief object, or { rawText, parseError } fallback
 */
export async function generateBrief(symbol, name, category) {
  const { text } = await querySonar(
    BRIEF_SYSTEM_PROMPT,
    buildBriefPrompt(symbol, name, category),
    { temperature: 0.1, maxTokens: 1000 },
  );

  const parsed = extractJSON(text);
  if (parsed) {
    return parsed;
  }

  // Fallback: store raw text if JSON parsing failed
  console.warn(`[BriefGenerator] Failed to parse JSON for ${symbol}, storing raw text`);
  return { rawText: text, parseError: true };
}
