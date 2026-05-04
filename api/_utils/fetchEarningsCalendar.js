// api/_utils/fetchEarningsCalendar.js
// Pure Sonar-calling fetcher for the earnings calendar.
// Consumed by both api/earnings-calendar-sonar.js (HTTP handler, wraps with
// auth + cache) and api/cron/compute-daily-regime-brief.js (direct import).
//
// No caching, no auth, no Express wrapping. Throws on failure — callers
// decide how to handle (stale fallback, empty data, etc).

import { querySonar } from '../helpers/sonar.js';
import { getETDate, formatDateString } from './marketSchedule.js';

const SYSTEM_PROMPT = `You are an earnings calendar analyst for FantasyTrades. Generate a structured earnings calendar for the most important upcoming reports as JSON.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
{
  "thisWeek": [
    {
      "date": "2026-03-03",
      "day": "Monday",
      "timing": "AMC" or "BMO",
      "symbol": "CRM",
      "name": "Salesforce",
      "significance": "high" or "medium" or "low",
      "watchFor": "One sentence on the key metric or narrative investors are watching",
      "sectorImpact": "One sentence on how this report could affect the broader sector"
    }
  ],
  "nextWeek": [...same schema...],
  "spotlight": "2-3 sentences on the single most important earnings report in the thisWeek array and why it matters"
}

CRITICAL RULES FOR STOCK SELECTION:
- ONLY include S&P 500 companies or widely-followed large-cap growth stocks
- Prioritize: mega-caps (AAPL, MSFT, NVDA, AMZN, META, GOOGL, TSLA, AVGO), major retailers (TGT, COST, WMT), major financials (JPM, GS, MS), and sector bellwethers
- If a company has less than $10B market cap, do NOT include it unless it is exceptionally notable
- Include 8-15 companies per week — quality and relevance over quantity
- significance = "high" ONLY for mega-caps, major retailers, or companies whose reports historically move entire sectors
- The "spotlight" field MUST reference a company that appears in the "thisWeek" array — never spotlight a company from a different week or one not in the results
- "watchFor" must be specific to THIS earnings report — reference analyst consensus, recent guidance, or specific business metrics. NOT generic statements like "revenue growth"
- Order by date, then by significance (high first) within each day
- Double-check that every symbol you include is actually reporting earnings in the specified week`;

// Sonar occasionally returns content-level garbage (e.g., Saturday earnings,
// internally-inconsistent day/date pairs, items from prior weeks). Drop any
// item that fails the five checks below. Silent on rejection — logging
// every drop would create noise from routine vendor mistakes.
function dayOfWeekUTC(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`)
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    .toLowerCase();
}

function validateEarningsEvent(item, todayET) {
  if (!item || typeof item !== 'object') return false;
  // (a) date format regex
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
  // (b) parses to a real date
  const parsed = new Date(`${item.date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // (c) ±14-day window from today (ET)
  const todayMs = new Date(`${todayET}T00:00:00Z`).getTime();
  if (Number.isNaN(todayMs)) return false;
  const diffDays = Math.abs(parsed.getTime() - todayMs) / 86_400_000;
  if (diffDays > 14) return false;
  // (d) day-of-week consistency, only if `day` is present
  if (typeof item.day === 'string' && item.day.trim() !== '') {
    if (dayOfWeekUTC(item.date) !== item.day.trim().toLowerCase()) return false;
  }
  // (e) weekend rejection — US companies don't report on Sat/Sun
  const dow = parsed.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return true;
}

export async function fetchEarningsCalendar() {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const userPrompt = `What are the most important earnings reports from S&P 500 and major large-cap companies scheduled for this week and next week? Today is ${dateStr}. Focus ONLY on well-known, widely-followed companies. Do NOT include small-cap or obscure names. Include the exact reporting date and whether it's before market open (BMO) or after market close (AMC).`;

  const { text, citations } = await querySonar(SYSTEM_PROMPT, userPrompt, {
    searchRecencyFilter: 'week',
    maxTokens: 2000,
    temperature: 0.2,
  });

  let parsed;
  try {
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    console.warn('[EarningsCalendar] JSON parse failed, raw text:', text.slice(0, 200));
    parsed = {
      thisWeek: [],
      nextWeek: [],
      spotlight: 'Earnings calendar temporarily unavailable',
    };
  }

  const todayET = formatDateString(getETDate());
  return {
    thisWeek: Array.isArray(parsed.thisWeek)
      ? parsed.thisWeek.filter((e) => validateEarningsEvent(e, todayET))
      : [],
    nextWeek: Array.isArray(parsed.nextWeek)
      ? parsed.nextWeek.filter((e) => validateEarningsEvent(e, todayET))
      : [],
    spotlight: parsed.spotlight || null,
    cachedAt: Date.now(),
    citations: citations || [],
  };
}
