// api/_utils/fetchEconomicEvents.js
// Pure Sonar-calling fetcher for the economic events calendar.
// Consumed by both api/economic-events-sonar.js (HTTP handler, wraps with
// auth + cache) and api/cron/compute-daily-regime-brief.js (direct import).
//
// No caching, no auth, no Express wrapping. Throws on failure — callers
// decide how to handle (stale fallback, empty data, etc).

import { querySonar } from '../helpers/sonar.js';
import { getETDate, formatDateString } from './marketSchedule.js';

const SYSTEM_PROMPT = `You are an economic calendar analyst for FantasyTrades, an educational stock analysis platform. Generate a structured economic events calendar as JSON.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
{
  "thisWeek": [
    {
      "date": "2026-03-02",
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
  "highlight": "One sentence summary of the single most important event this week and why it matters"
}

Rules:
- Include ALL major US economic releases for this week and next week
- "actual" should be null if the data hasn't been released yet, or the actual value if already released
- Order events chronologically within each week
- "impact" rating: high = likely to move markets (Fed decisions, NFP, CPI, GDP), medium = sector-specific impact, low = minor indicator
- "brief" should connect the event to current market themes, not just define what the indicator measures
- Always include: Fed speakers/decisions, employment data, inflation data, GDP, PMIs, consumer confidence, housing data
- Do NOT include very minor or regional indicators — focus on market-moving events`;

// Sonar occasionally returns content-level garbage (e.g., NFP on Saturday,
// internally-inconsistent day/date pairs, items from prior weeks). Drop any
// item that fails the four checks below. Silent on rejection — logging
// every drop would create noise from routine vendor mistakes.
function dayOfWeekUTC(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`)
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    .toLowerCase();
}

function validateEconEvent(item, todayET) {
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
  return true;
}

export async function fetchEconomicEvents() {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const userPrompt = `What are all the major US economic events and data releases for this week and next week? Today is ${dateStr}. Include Fed speeches, employment data, inflation reports, PMI readings, consumer data, housing data, GDP, and any other market-moving releases.`;

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
    console.warn('[EconomicEvents] JSON parse failed, raw text:', text.slice(0, 200));
    parsed = {
      thisWeek: [],
      nextWeek: [],
      highlight: 'Economic calendar temporarily unavailable',
    };
  }

  const todayET = formatDateString(getETDate());
  return {
    thisWeek: Array.isArray(parsed.thisWeek)
      ? parsed.thisWeek.filter((e) => validateEconEvent(e, todayET))
      : [],
    nextWeek: Array.isArray(parsed.nextWeek)
      ? parsed.nextWeek.filter((e) => validateEconEvent(e, todayET))
      : [],
    highlight: parsed.highlight || null,
    cachedAt: Date.now(),
    citations: citations || [],
  };
}
