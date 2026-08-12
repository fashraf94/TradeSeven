// api/_utils/mandateCandidateUniverse.js
//
// Spec 1 — Mandate Substrate — the CURATED CANDIDATE UNIVERSE (§3.0). Pure data
// (Node-clean; no Firestore, no fetch). The base of the shared-snapshot build
// set: `build set = candidate universe ∪ all held tickers` (§3.0). BUY/ADD is
// restricted to symbols present-and-complete in the tick snapshot (F16), so this
// list bounds what any book may ever enter — held tickers are a subset of the
// universe by construction, which is what keeps the union flat in user count
// (F12).
//
// WHY CURATED (O-3 mitigating factor): the friction model is idealized (§4.1);
// the gap between idealized bps and real market impact is narrowest for liquid
// large/mid-caps, so the universe is deliberately liquid large/mid-cap. That
// keeps the honesty gap smallest exactly where books actually trade.
//
// SIZE (§3.0 bounds): the list must comfortably exceed MANDATE_MIN_CANDIDATE_CAPACITY
// (100) so a healthy snapshot always clears the candidate-capacity floor (I11),
// and stay well under MANDATE_UNIVERSE_MAX_SYMBOLS (300) so held tickers have
// headroom under the cap. ~150 names satisfies both with margin.
//
// SECTOR TAXONOMY: the per-symbol `sector` used by the deterministic gate's
// sector-cap (§3.4) is AUTHORITATIVELY the daily slow-layer fundamentals field
// (the daily snapshot's per-symbol `sector`, produced by the snapshot builder's
// slow layer, §3.0), so held and candidate sectors share one source at runtime.
// The labels below are a stable SEED/FALLBACK
// taxonomy (GICS-style) used when the daily layer has not yet enriched a symbol
// and to make gate tests deterministic without mocking fundamentals. They are
// organized by sector so the seed map falls out of the list structure — one place
// to edit, no parallel map to drift.

// Curated liquid large/mid-caps, grouped by sector. Editing a sector's array
// updates both CANDIDATE_UNIVERSE and CANDIDATE_SECTOR_SEED below.
const UNIVERSE_BY_SECTOR = Object.freeze({
  'Technology': [
    'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'AMD', 'ADBE', 'CSCO', 'ACN',
    'TXN', 'QCOM', 'INTC', 'IBM', 'INTU', 'NOW', 'AMAT', 'MU', 'LRCX', 'ADI',
  ],
  'Communication Services': [
    'GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'T', 'VZ', 'TMUS', 'CHTR', 'EA',
  ],
  'Consumer Discretionary': [
    'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'SBUX', 'BKNG', 'TJX', 'ORLY',
    'CMG', 'MAR', 'GM', 'F',
  ],
  'Consumer Staples': [
    'PG', 'KO', 'PEP', 'COST', 'WMT', 'PM', 'MO', 'MDLZ', 'CL', 'TGT',
    'KMB', 'GIS',
  ],
  'Health Care': [
    'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT', 'DHR', 'BMY',
    'AMGN', 'MDT', 'ISRG', 'GILD', 'CVS', 'CI',
  ],
  'Financials': [
    'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'AXP', 'SPGI',
    'BLK', 'C', 'SCHW', 'PGR', 'CB', 'PYPL',
  ],
  'Industrials': [
    'CAT', 'RTX', 'HON', 'UPS', 'BA', 'GE', 'DE', 'LMT', 'UNP', 'ADP',
    'ETN', 'EMR', 'FDX', 'CSX',
  ],
  'Energy': [
    'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'OXY', 'WMB', 'KMI',
  ],
  'Utilities': [
    'NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'SRE', 'XEL',
  ],
  'Real Estate': [
    'AMT', 'PLD', 'CCI', 'EQIX', 'PSA', 'O', 'SPG', 'WELL',
  ],
  'Materials': [
    'LIN', 'SHW', 'APD', 'ECL', 'FCX', 'NEM', 'DOW', 'NUE',
  ],
});

/**
 * The flat, ordered candidate list (deduped, uppercased). Order is sector-major,
 * matching UNIVERSE_BY_SECTOR — deterministic so the build set and any prompt
 * candidate slate are stable across ticks.
 */
export const CANDIDATE_UNIVERSE = Object.freeze(
  [...new Set(
    Object.values(UNIVERSE_BY_SECTOR)
      .flat()
      .map((s) => String(s).trim().toUpperCase())
      .filter(Boolean),
  )],
);

/**
 * SEED/FALLBACK sector map (symbol → GICS-style sector). Runtime sector from the
 * daily fundamentals layer (§3.0) is authoritative; this is used only when the
 * daily layer has not enriched a symbol and for deterministic gate tests.
 */
export const CANDIDATE_SECTOR_SEED = Object.freeze(
  Object.entries(UNIVERSE_BY_SECTOR).reduce((acc, [sector, symbols]) => {
    for (const raw of symbols) {
      acc[String(raw).trim().toUpperCase()] = sector;
    }
    return acc;
  }, {}),
);

/** True iff `symbol` is a curated candidate (case-insensitive). */
export function isCandidateSymbol(symbol) {
  return CANDIDATE_SECTOR_SEED[String(symbol || '').trim().toUpperCase()] !== undefined;
}

/** The seed sector for a candidate symbol, or null if not curated. */
export function seedSectorFor(symbol) {
  return CANDIDATE_SECTOR_SEED[String(symbol || '').trim().toUpperCase()] ?? null;
}
