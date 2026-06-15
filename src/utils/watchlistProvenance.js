// src/utils/watchlistProvenance.js
//
// Read-only display helper for the desktop "My watchlists" card. Maps a
// watchlist's existing (scattered) source fields to a provenance label +
// ticker count. It does NOT introduce or backfill an `origin.type` field — it
// only reads what the doc already carries (founder decision, 2026-06-15):
//
//   source === 'theme'                       -> 'DISCOVER'
//   sourceDropId || sourceSessionId present   -> 'ATLAS'   (Signal-Drop / Atlas dialogue)
//   otherwise                                -> 'MANUAL'
//   count = tickers.length
//   no watchlist (null/undefined)            -> { label: null, count: 0 }  (caller shows nothing)
//
// The label is purely cosmetic; callers render `${label} · ${count} NAMES`
// (or just the count when label is null).

export function getWatchlistProvenance(watchlist) {
  if (!watchlist) return { label: null, count: 0 };

  const tickers = Array.isArray(watchlist.tickers) ? watchlist.tickers : [];
  const count = tickers.length;

  let label;
  if (watchlist.source === 'theme') {
    label = 'DISCOVER';
  } else if (watchlist.sourceDropId || watchlist.sourceSessionId) {
    label = 'ATLAS';
  } else {
    label = 'MANUAL';
  }

  return { label, count };
}

export default getWatchlistProvenance;
