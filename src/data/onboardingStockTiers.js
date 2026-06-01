// src/data/onboardingStockTiers.js
//
// Curated, risk-grouped stock list for the onboarding "Which names do you like?"
// step. Grouping by risk tier teaches risk by inspection, gives the starter
// watchlist a legible character, and supplies the sector read used for
// personality.sectorAffinity.
//
// IMPORTANT (locked decision): the picks build the starter watchlist and supply
// sectorAffinity ONLY. They do NOT influence the derived archetype — that is a
// question-only derivation (see api/agent/create-profile.js). Two users who
// both pick NVDA/AAPL can still land on different archetypes.
//
// Every symbol below is a member of the scored DKB universe
// (DKB_STOCK_UNIVERSE.md) so the committed watchlist round-trips cleanly through
// decide.js (api/_utils/watchlistEquip.js extractTickerSymbols/foldEquippedTickers).
//
// The `sector` strings are intentionally kept verbatim-equal to the canonical
// SECTORS[].name in src/constants/sectors.js (consumed via
// sectorUtils.resolveSectorInfo / findSectorByName, which match by exact name).
// Keep them in sync if a canonical sector is ever renamed — derived
// sectorAffinity is only as good as that join.

export const PICK_MIN = 3;
export const PICK_MAX = 8;

export const STOCK_TIERS = [
  {
    id: 'steady',
    label: 'Steady',
    blurb: 'Lower-volatility blue chips. Slow and dependable.',
    picks: [
      { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare' },
      { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
      { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples' },
      { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples' },
      { symbol: 'COST', name: 'Costco', sector: 'Consumer Staples' },
      { symbol: 'WMT', name: 'Walmart', sector: 'Consumer Staples' },
      { symbol: 'NEE', name: 'NextEra Energy', sector: 'Utilities' },
      { symbol: 'V', name: 'Visa', sector: 'Financials' },
    ],
  },
  {
    id: 'balanced',
    label: 'Balanced',
    blurb: 'Household-name large caps. Growth with both feet on the ground.',
    picks: [
      { symbol: 'AAPL', name: 'Apple', sector: 'Technology' },
      { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology' },
      { symbol: 'GOOGL', name: 'Alphabet', sector: 'Communication Services' },
      { symbol: 'AMZN', name: 'Amazon', sector: 'Consumer Discretionary' },
      { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology' },
      { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials' },
      { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary' },
      { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
    ],
  },
  {
    id: 'highOctane',
    label: 'High-octane',
    blurb: 'Wide swings and big stories. Bigger upside, bigger drawdowns.',
    picks: [
      { symbol: 'TSLA', name: 'Tesla', sector: 'Consumer Discretionary' },
      { symbol: 'PLTR', name: 'Palantir', sector: 'Technology' },
      { symbol: 'COIN', name: 'Coinbase', sector: 'Financials' },
      { symbol: 'HOOD', name: 'Robinhood', sector: 'Financials' },
      { symbol: 'RKLB', name: 'Rocket Lab', sector: 'Industrials' },
      { symbol: 'BE', name: 'Bloom Energy', sector: 'Technology' },
      { symbol: 'AFRM', name: 'Affirm', sector: 'Financials' },
      { symbol: 'GME', name: 'GameStop', sector: 'Consumer Discretionary' },
    ],
  },
];

// Flat symbol → { name, sector, tierId, tierLabel } lookup, built once.
const BY_SYMBOL = STOCK_TIERS.reduce((acc, tier) => {
  for (const p of tier.picks) {
    acc[p.symbol] = { ...p, tierId: tier.id, tierLabel: tier.label };
  }
  return acc;
}, {});

/** Metadata (name, sector, tier) for one picked symbol, or null. */
export const getPickMeta = (symbol) => BY_SYMBOL[symbol] || null;

/**
 * Derive a sector-affinity list from the picked symbols: the sectors the user
 * leaned toward, most-picked first (alphabetical tiebreak for determinism).
 * Stored on the agent as personality.sectorAffinity.
 *
 * @param {string[]} symbols
 * @returns {string[]}
 */
export function deriveSectorAffinity(symbols) {
  if (!Array.isArray(symbols)) return [];
  const counts = new Map();
  for (const sym of symbols) {
    const meta = BY_SYMBOL[sym];
    if (!meta) continue;
    counts.set(meta.sector, (counts.get(meta.sector) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([sector]) => sector);
}

export default STOCK_TIERS;
