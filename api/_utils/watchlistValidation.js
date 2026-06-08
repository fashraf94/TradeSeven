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
//
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
