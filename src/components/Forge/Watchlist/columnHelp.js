// src/components/Forge/Watchlist/columnHelp.js
//
// Plain-language help for the cohort-analysis list columns — the single source
// the Column Help Modal reads (key → { label, description }). Keys match the
// column descriptors in WatchlistAnalysisView's T1/T2/T3_COLUMNS exactly.
//
// Descriptions were confirmed against the real field semantics (not the UI
// abbreviations): revenueGrowthYOY is QUARTERLY YoY (compute-rankings.js),
// profitMarginTTM is NET margin, momentumScore is a 0–100 percentile of a
// multi-factor composite, and emsPercentile is a SECTOR-relative revision
// percentile (compute-estimates.js). The three "(Street)" lines are worded to
// hold the honesty line — these are analyst consensus, never the app's forecast.
//
// symbol / sectorName are intentionally absent: their headers stay
// non-interactive (self-explanatory), so they never open the modal.

export const COLUMN_HELP = {
  // ── Tier-1 (technical / realized) ──
  return1M: {
    label: '1-month return',
    description: 'Price return over the past month — realized, not annualized.',
  },
  return3M: {
    label: '3-month return',
    description: 'Price return over the past three months — realized, not annualized.',
  },
  momentumScore: {
    label: 'Momentum',
    description:
      'Momentum score from 0–100, ranked across the universe — a multi-factor blend of trend and price strength. Higher means stronger momentum.',
  },
  sma200_position: {
    label: '200-day position',
    description:
      'How far the price sits above (+) or below (−) its 200-day moving average, in percent.',
  },
  atrPercentile: {
    label: 'ATR percentile',
    description:
      'Average-true-range percentile — a volatility gauge. Higher means bigger daily price swings relative to other stocks.',
  },

  // ── Tier-2 (trailing fundamentals) ──
  trailingPE: {
    label: 'Price / earnings',
    description: 'Price-to-earnings ratio over the trailing twelve months.',
  },
  debtToEquity: {
    label: 'Debt / equity',
    description: 'Total debt carried relative to shareholder equity.',
  },
  revenueGrowthYOY: {
    label: 'Revenue growth (YoY)',
    description:
      'Revenue in the latest quarter versus the same quarter a year ago — realized, not a forecast.',
  },
  profitMarginTTM: {
    label: 'Net profit margin',
    description: 'Net profit margin over the trailing twelve months.',
  },
  marketCap: {
    label: 'Market cap',
    description: "Market capitalization — the total market value of the company's shares.",
  },

  // ── Tier-3 (forward analyst consensus — attributed, NOT our forecast) ──
  consensusGrowthNextYear: {
    label: 'Consensus growth · next year (Street)',
    description:
      "Analysts' consensus estimate for next year's earnings growth. What the Street expects — not a prediction by us.",
  },
  emsPercentile: {
    label: 'Revision momentum (Street)',
    description:
      'How strongly analysts have lately been raising versus cutting their earnings estimates, ranked against sector peers (higher = more upgrades). Analyst behaviour, not our call.',
  },
  estimateSpread: {
    label: 'Estimate dispersion (Street)',
    description:
      'How much analysts disagree on the estimate. Higher means less consensus — and lower confidence in the number.',
  },
};
