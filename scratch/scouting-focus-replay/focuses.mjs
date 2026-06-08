// scratch/scouting-focus-replay/focuses.mjs
//
// Hardcoded screenSpecs per Scouting Focus (the task permits hardcoding the
// screenSpec — "the goal is measuring movement, not clean architecture").
// Every field/op used here is in the REAL screener allowlist
// (api/_utils/screenStocks.js SCALAR_FIELDS / SUPPORTED_OPS), so these specs are
// run verbatim through the real screenStocks().
//
// Each focus is a function (universe, watchlistSize) -> screenSpec, because a
// couple of them need a data-derived threshold (e.g. a top-50% fundamental floor).

const median = (xs) => {
  const a = xs.filter((x) => x != null).sort((p, q) => p - q);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// ── Focus library ────────────────────────────────────────────────────────────
export const FOCUSES = {
  // "Chase Winners" — recent/absolute momentum leaders.
  chaseWinners: (_u, limit) => ({
    filters: [{ field: 'momentumScore', op: 'gte', value: 50 }],
    rankBy: { field: 'momentumScore', direction: 'desc' },
    limit,
  }),

  // "Sector Leaders (raw technical)" — top ABSOLUTE technical names, no sector
  // normalization. Hypothesis: this barely differs from Chase Winners.
  sectorLeadersRaw: (_u, limit) => ({
    filters: [],
    rankBy: { field: 'technicalRank', direction: 'asc' }, // 1 = best absolute technical
    limit,
  }),

  // "Sector Leaders (sector-relative)" — each sector's intra-sector leaders.
  // Uses sectorTechnicalRank (1 = leader WITHIN its sector). Structurally spreads
  // across sectors incl. leaders of cold sectors.
  sectorLeadersRel: (_u, limit) => ({
    filters: [{ field: 'sectorTechnicalRank', op: 'lte', value: 3 }],
    rankBy: { field: 'sectorTechnicalRank', direction: 'asc' },
    limit,
  }),

  // "Hunt Big Movers" — highest realized volatility (degen's dominant axis).
  huntBigMovers: (_u, limit) => ({
    filters: [{ field: 'atrPercentile', op: 'gte', value: 0.6 }],
    rankBy: { field: 'atrPercentile', direction: 'desc' },
    limit,
  }),

  // "Back Strong Companies" — top fundamental quality.
  backStrongCompanies: (_u, limit) => ({
    filters: [{ field: 'fundamentalScore', op: 'gte', value: 70 }],
    rankBy: { field: 'fundamentalScore', direction: 'desc' },
    limit,
  }),

  // "Sector Leaders + quality floor" — sector-relative leaders, but only among the
  // top-50% fundamentalScore names (the task's quality floor for the analyst pair).
  sectorLeadersRelQuality: (u, limit) => ({
    filters: [
      { field: 'fundamentalScore', op: 'gte', value: median(u.map((s) => s.fundamentalScore)) },
      { field: 'sectorTechnicalRank', op: 'lte', value: 3 },
    ],
    rankBy: { field: 'sectorTechnicalRank', direction: 'asc' },
    limit,
  }),
};

// ── Riskiest pairs (cheap falsification first) ───────────────────────────────
// archetype keys: momentum_chaser=Trend Follower, degen=Speculator, analyst=Fundamental Investor
export const PAIRS = [
  {
    id: 'trend_follower',
    label: 'Trend Follower',
    archetype: 'momentum_chaser',
    default: { key: 'chaseWinners', label: 'Chase Winners' },
    // Two alternate constructions of "Sector Leaders": raw vs sector-relative.
    alternates: [
      { key: 'sectorLeadersRaw', label: 'Sector Leaders (raw technical)' },
      { key: 'sectorLeadersRel', label: 'Sector Leaders (sector-relative)' },
    ],
  },
  {
    id: 'speculator',
    label: 'Speculator',
    archetype: 'degen',
    default: { key: 'huntBigMovers', label: 'Hunt Big Movers' },
    alternates: [
      { key: 'chaseWinners', label: 'Chase Winners' },
    ],
  },
  {
    id: 'fundamental_investor',
    label: 'Fundamental Investor',
    archetype: 'analyst',
    default: { key: 'backStrongCompanies', label: 'Back Strong Companies' },
    alternates: [
      { key: 'sectorLeadersRelQuality', label: 'Sector Leaders (sector-rel + top-50% quality floor)' },
    ],
  },
];
