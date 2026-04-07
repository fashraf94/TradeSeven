/**
 * Shared utility for fetching real-time stock catalysts from Perplexity Sonar.
 * Falls back to EODHD news headlines if Sonar fails or times out.
 *
 * Used by: generate-mover.js (Alex), generate-macro.js (Kai macro alerts)
 */

import { querySonar } from '../helpers/sonar.js';

const SONAR_TIMEOUT_MS = 8000;

const CATALYST_SYSTEM_PROMPT = `You are a financial catalyst analyst. Your job is to identify the specific, concrete reasons a stock or the broader market is moving RIGHT NOW. Prioritize breaking news, company-specific events, and actionable catalysts over generic macro narratives. Be concise and factual.`;

// ─── Sonar queries ──────────────────────────────────────────────────────────

/**
 * Fetch real-time catalysts for an individual stock via Perplexity Sonar.
 * Falls back to EODHD headlines on failure.
 *
 * @param {string} symbol       - Ticker symbol (e.g. "META")
 * @param {string} companyName  - Full company name (e.g. "Meta Platforms Inc.")
 * @param {number} priceChange  - Percent change (e.g. -8.2)
 * @param {string} direction    - "up" or "down"
 * @returns {Promise<{ catalysts: string|null, headlines: string[], raw: string|null, citations: string[], fallback: boolean }>}
 */
export async function fetchTickerCatalysts(symbol, companyName, priceChange, direction) {
  const absChange = Math.abs(priceChange).toFixed(2);
  const nameStr = companyName ? `${symbol} (${companyName})` : symbol;

  const userPrompt = `Why is ${nameStr} stock ${direction} ${absChange}% today? What are the specific catalysts, news events, court decisions, analyst actions, regulatory developments, executive changes, or company announcements driving this move? Include any breaking developments from the last 24 hours. Be specific — name the exact events, not just macro themes.`;

  try {
    const sonarPromise = querySonar(CATALYST_SYSTEM_PROMPT, userPrompt, {
      searchRecencyFilter: 'day',
      temperature: 0.1,
      maxTokens: 500,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sonar timeout')), SONAR_TIMEOUT_MS)
    );

    const { text, citations } = await Promise.race([sonarPromise, timeoutPromise]);

    console.log(`[Sonar] Catalyst fetch succeeded for ${symbol}: ${text.length} chars`);
    return {
      catalysts: text,
      headlines: [],
      raw: text,
      citations: citations || [],
      fallback: false,
    };
  } catch (err) {
    console.warn(`[Sonar] Catalyst fetch failed for ${symbol}, falling back to EODHD:`, err.message);
    const headlines = await fetchEodhdTickerNews(symbol);
    return {
      catalysts: null,
      headlines,
      raw: null,
      citations: [],
      fallback: true,
    };
  }
}

/**
 * Fetch real-time catalysts for a broad market move via Perplexity Sonar.
 * Falls back to EODHD general market news on failure.
 *
 * @param {{ symbol: string, percentChange: number, direction: string }[]} triggers
 * @returns {Promise<{ catalysts: string|null, headlines: string[], raw: string|null, citations: string[], fallback: boolean }>}
 */
export async function fetchMarketCatalysts(triggers) {
  const triggerList = triggers
    .map(t => `- ${t.symbol}: ${t.percentChange >= 0 ? '+' : ''}${Number(t.percentChange).toFixed(2)}% (${t.direction || 'unknown'})`)
    .join('\n');

  const userPrompt = `The following stocks are all moving significantly today:\n${triggerList}\nWhat are the specific catalysts driving this broad market move? Include any policy announcements, geopolitical events, economic data releases, or regulatory actions from the last 24 hours. Be specific.`;

  try {
    const sonarPromise = querySonar(CATALYST_SYSTEM_PROMPT, userPrompt, {
      searchRecencyFilter: 'day',
      temperature: 0.1,
      maxTokens: 500,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sonar timeout')), SONAR_TIMEOUT_MS)
    );

    const { text, citations } = await Promise.race([sonarPromise, timeoutPromise]);

    console.log(`[Sonar] Market catalyst fetch succeeded: ${text.length} chars`);
    return {
      catalysts: text,
      headlines: [],
      raw: text,
      citations: citations || [],
      fallback: false,
    };
  } catch (err) {
    console.warn(`[Sonar] Market catalyst fetch failed, falling back to EODHD:`, err.message);
    const headlines = await fetchEodhdMarketNews();
    return {
      catalysts: null,
      headlines,
      raw: null,
      citations: [],
      fallback: true,
    };
  }
}

// ─── EODHD fallback helpers ─────────────────────────────────────────────────

/**
 * Fetch EODHD news headlines for a specific ticker (fallback).
 * @param {string} symbol
 * @returns {Promise<string[]>}
 */
async function fetchEodhdTickerNews(symbol) {
  try {
    const url = `https://eodhd.com/api/news?s=${symbol}.US&limit=5&api_token=${process.env.EODHD_API_KEY}&fmt=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      const articles = (data || []).slice(0, 5);
      const fresh = articles.filter(n => {
        const pubDate = n.date ? new Date(n.date).getTime() : 0;
        return pubDate >= cutoff;
      });
      console.log(`[EODHD fallback] ${symbol}: ${articles.length} headlines fetched, ${fresh.length} within 24h`);
      return fresh.map(n => n.title || n.headline).filter(Boolean);
    }
  } catch (e) {
    console.warn('[EODHD fallback] Ticker news fetch failed:', e.message);
  }
  return [];
}

/**
 * Fetch EODHD general market news (fallback).
 * @returns {Promise<string[]>}
 */
async function fetchEodhdMarketNews() {
  try {
    const url = `https://eodhd.com/api/news?limit=3&api_token=${process.env.EODHD_API_KEY}&fmt=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      const articles = (data || []).slice(0, 3);
      const fresh = articles.filter(n => {
        const pubDate = n.date ? new Date(n.date).getTime() : 0;
        return pubDate >= cutoff;
      });
      console.log(`[EODHD fallback] Market news: ${articles.length} headlines fetched, ${fresh.length} within 24h`);
      return fresh.map(n => n.title || n.headline).filter(Boolean);
    }
  } catch (e) {
    console.warn('[EODHD fallback] Market news fetch failed:', e.message);
  }
  return [];
}
