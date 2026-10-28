// api/_utils/watchlistValidation.js
//
// Shared validation helpers for the watchlist write paths. Extracted from
// api/forge/watchlists/[id].js (PATCH) so the create-from-tickers branch in
// api/forge/watchlists.js validates tickers/strings against the SAME caps —
// a single source of truth means create and PATCH can never drift on the
// 40-ticker / per-field limits.
//
// Behaviour-preserving move: the cap values and the capString / capTickersArray
// logic are byte-identical to their previous in-[id].js definitions. The
// [id].js PATCH suite is the regression proof.

import { isRetiredStock } from './rankingConfig.js';

// Field caps locked in Phase 4A audit Section 9.
export const NAME_MAX_LEN = 100;
export const NOTES_MAX_LEN = 2000;

// Per-ticker caps mirror Phase 2.6 dialogue caps (so the shapes round-trip
// cleanly between the dialogue and the persisted watchlist).
export const TICKER_SYMBOL_MAX_LEN = 12;
export const TICKER_REASONING_MAX_LEN = 500;
export const TICKER_CATEGORY_MAX_LEN = 30;
export const TICKERS_MAX_COUNT = 40;

export const VALID_ADDED_BY = new Set(['agent', 'user']);

// Capped string trimmer. Returns the trimmed string ≤cap, or null if input
// isn't a string. Empty strings are preserved (PATCH can clear a field).
export function capString(value, cap) {
  if (typeof value !== 'string') return null;
  return value.slice(0, cap).trim();
}

export function capTickersArray(value, nowIso) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const t of value) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) continue;
    const symbol =
      typeof t.symbol === 'string' ? t.symbol.trim().toUpperCase().slice(0, TICKER_SYMBOL_MAX_LEN) : '';
    if (!symbol) continue;
    out.push({
      symbol,
      reasoning:
        typeof t.reasoning === 'string'
          ? t.reasoning.slice(0, TICKER_REASONING_MAX_LEN).trim()
          : '',
      category:
        typeof t.category === 'string'
          ? t.category.slice(0, TICKER_CATEGORY_MAX_LEN).trim()
          : '',
      addedBy: VALID_ADDED_BY.has(t.addedBy) ? t.addedBy : 'user',
      addedAt: typeof t.addedAt === 'string' ? t.addedAt : nowIso,
    });
    if (out.length >= TICKERS_MAX_COUNT) break;
  }
  return out;
}

// F4 (Flash, Oct 25, 2026; BR-3 hardening): the retired stocks a save would
// ADD — retired symbols in the new list that the stored list does not hold.
// A list that already holds one still saves and reads; a new pick is refused.
// The Forge add search and the ticker validator never offer one, so what this
// catches is a crafted request, a dialogue session proposed before BR-3, or a
// screen run on a stockRankings document from before BR-3.
export function newlyAddedRetiredTickers(nextTickers, storedTickers = []) {
  const symbolOf = (t) => (typeof t?.symbol === 'string' ? t.symbol.trim().toUpperCase() : '');
  const stored = new Set((Array.isArray(storedTickers) ? storedTickers : []).map(symbolOf));
  const next = new Set((Array.isArray(nextTickers) ? nextTickers : []).map(symbolOf));
  return [...next].filter((s) => isRetiredStock(s) && !stored.has(s));
}

// C4 (Flash, Oct 27, 2026): a saved DIALOGUE is not refused for an old retired
// candidate — its retired names are dropped and the rest saved. Splits the list
// the way newlyAddedRetiredTickers reads a symbol (trimmed, upper-cased), keeping
// each kept row as it came and naming each dropped symbol once, in list order.
export function splitRetiredTickers(tickers) {
  const kept = [];
  const dropped = [];
  for (const t of Array.isArray(tickers) ? tickers : []) {
    const symbol = typeof t?.symbol === 'string' ? t.symbol.trim().toUpperCase() : '';
    if (symbol && isRetiredStock(symbol)) {
      if (!dropped.includes(symbol)) dropped.push(symbol);
    } else kept.push(t);
  }
  return { kept, dropped };
}

// `symbols` names what was refused so the editor can say which one to remove
// (#998 MT3-6) from the payload, never by re-parsing the message.
export function retiredTickerRefusal(symbols) {
  return {
    error: 'retired_ticker',
    message: `${symbols.join(', ')} ${symbols.length === 1 ? 'has' : 'have'} left the stock universe and can't be added to a watchlist.`,
    symbols: [...symbols],
  };
}
