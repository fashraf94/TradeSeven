// api/_utils/tournamentPrices.js
//
// Batch EODHD real-time quotes for the tournament user layer (P1b banking +
// flips). The /real-time/ payload carries the session's open alongside the
// live price — field contract proven in-repo at api/stocks/prices.js:106-119
// (`open: item.open`) — so ONE batch call provides both the banking pass's
// settlement price (open) and its live price (close/current). URL shape and
// response handling mirror the house batch fetcher
// (api/cron/snake-draft-daily-scores.js:169-208, comma-joined symbol list).
//
// Symbol formatting is imported from marketDataCache (the house formatter),
// never re-stated. Results are keyed by the CALLER'S symbol (uppercased), so
// dot-class tickers (BRK.B -> BRK-B.US) round-trip without surprises.

import { isCryptoSymbol, getCleanSymbol, formatEODHDSymbol } from './marketDataCache.js';

/** EODHD emits 'NA' strings and zeros for missing fields — normalize hard. */
function toFiniteOrNull(value) {
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/**
 * Price fields specifically: a zero price is a missing price. Letting 0
 * through would score a long as −100% (and a flip would mint a permanently
 * unscoreable 0-baseline leg) — normalize to null so every downstream
 * guard's "no usable price" path runs instead.
 */
function toPositiveOrNull(value) {
  const n = toFiniteOrNull(value);
  return n != null && n > 0 ? n : null;
}

/**
 * Fetch real-time quotes for a symbol list in one batch call.
 *
 * @param {string[]} symbols - plain tickers ('NVDA', 'BRK.B', 'BTC')
 * @param {{ fetchImpl?: typeof fetch, apiKey?: string }} [opts]
 * @returns {Promise<Object<string, {open: number|null, close: number|null,
 *   current: number|null, previousClose: number|null, timestamp: number|null}>>}
 *   keyed by the caller's symbol, uppercased. `close` is the RAW last price
 *   (no fallback) — consumers that must not execute on a stale price (the
 *   flip endpoint) require it; `current` is the close ?? previousClose
 *   convenience for close-of-day scoring. {} on any transport failure
 *   (house convention: the caller degrades, never throws on price loss).
 */
export async function fetchBatchQuotes(symbols, { fetchImpl = fetch, apiKey = process.env.EODHD_API_KEY } = {}) {
  const unique = [...new Set((symbols || []).map(s => String(s || '').trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return {};
  if (!apiKey) {
    console.error('[TournamentPrices] EODHD_API_KEY not configured');
    return {};
  }

  // eodhd symbol -> caller symbol, so responses key back to what was asked.
  const byEodhd = {};
  for (const symbol of unique) {
    const crypto = isCryptoSymbol(symbol);
    byEodhd[formatEODHDSymbol(getCleanSymbol(symbol), crypto).toUpperCase()] = symbol;
  }

  const quotes = {};
  try {
    const url = `https://eodhd.com/api/real-time/${Object.keys(byEodhd).join(',')}?api_token=${apiKey}&fmt=json`;
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status}`);
    }
    const data = await response.json();
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      if (!item?.code) continue;
      const symbol = byEodhd[String(item.code).toUpperCase()];
      if (!symbol) continue;
      const close = toPositiveOrNull(item.close);
      const previousClose = toPositiveOrNull(item.previousClose);
      quotes[symbol] = {
        open: toPositiveOrNull(item.open),
        close,
        current: close ?? previousClose,
        previousClose,
        timestamp: toFiniteOrNull(item.timestamp),
      };
    }
  } catch (err) {
    console.error('[TournamentPrices] batch quote fetch failed:', err.message);
    return {};
  }
  return quotes;
}

/** Single-symbol convenience for the flip endpoint. Null when unavailable. */
export async function fetchQuoteForSymbol(symbol, opts) {
  const quotes = await fetchBatchQuotes([symbol], opts);
  return quotes[String(symbol || '').trim().toUpperCase()] ?? null;
}
