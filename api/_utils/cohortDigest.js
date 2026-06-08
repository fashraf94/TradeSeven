// api/_utils/cohortDigest.js
//
// Phase 2 — deterministic cohort-digest assembly for the analysis hand-off.
// Pure + I/O-free (mirrors screenStocks.js / watchlistEquip.js): the caller
// (api/forge/watchlist-analysis.js) does the Firestore reads and hands the data
// in; this module only computes facts. That keeps the grounded substrate the
// Gemma set_analysis mode reasons over deterministic and unit-testable.
//
// Two tiers, both zero-EODHD:
//   * Tier-1 (always): the per-stock entries from the indexIntelligence/
//     stockRankings doc (compute-index-intelligence.js:992-1038) — sector/
//     industry mix, realized period returns, momentum, 200-day posture,
//     game-mode/quality scores, plus a winners-vs-losers contrast.
//   * Tier-2 (lazy): raw fundamentals from peerRankings/{ticker} metrics
//     (compute-rankings.js:1343-1378) — only assembled when the caller passes
//     peerMetricsBySymbol (it reads them only on a fundamentals-flavoured turn).
//
// Everything is null-safe — Tier-1/Tier-2 fields are frequently null on thin
// history, so each stat carries its own non-null `count`.

// ── pure stats helpers ────────────────────────────────────────────────
function numbers(arr) {
  return arr.filter((v) => typeof v === 'number' && Number.isFinite(v));
}

function median(arr) {
  const nums = numbers(arr).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

// {median, min, max, count} over the non-null numbers in `arr`.
function stat(arr) {
  const nums = numbers(arr);
  if (nums.length === 0) return { median: null, min: null, max: null, count: 0 };
  return {
    median: median(nums),
    min: Math.min(...nums),
    max: Math.max(...nums),
    count: nums.length,
  };
}

// Count occurrences of a string field → [{ name, count }] sorted desc, then by
// name for a stable tie-break.
function concentration(entries, field) {
  const counts = new Map();
  for (const e of entries) {
    const key = e && typeof e[field] === 'string' && e[field] ? e[field] : 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// Profile of a subgroup of Tier-1 entries (for the winners/losers contrast).
function subgroupProfile(entries, splitField) {
  const withPos = entries.filter((e) => typeof e.sma200_position === 'number');
  const above = withPos.filter((e) => e.sma200_position > 0).length;
  return {
    count: entries.length,
    symbols: entries.map((e) => e.symbol),
    medianReturn: median(entries.map((e) => e[splitField])),
    medianMomentum: median(entries.map((e) => e.momentumScore)),
    pctAbove200: withPos.length ? Math.round((above / withPos.length) * 100) : null,
    topSectors: concentration(entries, 'sectorName').slice(0, 3),
  };
}

// Per-fundamental cohort stat + the outlier names (min / max holders).
function fundamentalStat(entriesBySymbol, symbols, field) {
  const pairs = symbols
    .map((s) => [s, entriesBySymbol[s]?.[field]])
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v));
  if (pairs.length === 0) return { median: null, min: null, max: null, count: 0, lowName: null, highName: null };
  let low = pairs[0];
  let high = pairs[0];
  for (const p of pairs) {
    if (p[1] < low[1]) low = p;
    if (p[1] > high[1]) high = p;
  }
  return {
    median: median(pairs.map(([, v]) => v)),
    min: low[1],
    max: high[1],
    count: pairs.length,
    lowName: low[0],
    highName: high[0],
  };
}

const RETURN_FIELDS = ['return1W', 'return1M', 'return3M', 'returnYTD', 'return12M'];
const QUALITY_FIELDS = ['baggerBombFit', 'compositeScore', 'technicalScore', 'atrPercentile'];
// Exported so the endpoint's isFundamentalDimension() can test focusDimension
// membership without re-declaring the list (one source of truth).
export const FUNDAMENTAL_FIELDS = [
  'trailingPE', 'evEbitda', 'priceSalesTTM', 'priceBookMRQ',
  'revenueGrowthYOY', 'earningsGrowthYOY',
  'grossMargin', 'opMarginTTM', 'profitMarginTTM',
  'debtToEquity', 'currentRatio', 'interestCoverage', 'netDebtEbitda',
  'marketCap', 'beatRate',
];

// Minimum covered cohort size for a winners-vs-losers split to be meaningful
// (≥2 per side).
const MIN_SPLIT_SIZE = 4;

/**
 * Assemble the cohort digest.
 *
 * @param {Object} args
 * @param {string[]} args.symbols                 - cohort symbols (uppercase, ≤40).
 * @param {Object<string,Object>} args.rankingsBySymbol - symbol → stockRankings entry (Tier-1).
 * @param {Object<string,Object>|null} [args.peerMetricsBySymbol] - symbol → peerRankings.metrics (Tier-2),
 *                                                  or null/absent to skip the fundamentals tier.
 * @returns {Object} digest
 */
export function buildCohortDigest({ symbols, rankingsBySymbol, peerMetricsBySymbol = null }) {
  const syms = Array.isArray(symbols) ? symbols : [];
  const ranks = rankingsBySymbol || {};

  const covered = syms.filter((s) => ranks[s]);
  const entries = covered.map((s) => ranks[s]);
  const offUniverse = syms.filter((s) => !ranks[s]);

  // Return distribution per period.
  const returns = {};
  for (const f of RETURN_FIELDS) returns[f] = stat(entries.map((e) => e[f]));

  // Quality / game-mode fit.
  const quality = {};
  for (const f of QUALITY_FIELDS) quality[f] = stat(entries.map((e) => e[f]));

  // 200-day posture.
  const withPos = entries.filter((e) => typeof e.sma200_position === 'number');
  const aboveCount = withPos.filter((e) => e.sma200_position > 0).length;

  // Winners-vs-losers contrast: split by return1M (fallback return3M) when
  // enough names carry a value. Pure description of how the halves DIFFER.
  let splitField = 'return1M';
  let ranked = covered
    .map((s) => ranks[s])
    .filter((e) => typeof e[splitField] === 'number');
  if (ranked.length < MIN_SPLIT_SIZE) {
    splitField = 'return3M';
    ranked = covered.map((s) => ranks[s]).filter((e) => typeof e[splitField] === 'number');
  }
  let winnersLosers = null;
  if (ranked.length >= MIN_SPLIT_SIZE) {
    ranked = [...ranked].sort((a, b) => b[splitField] - a[splitField]);
    const half = Math.floor(ranked.length / 2);
    winnersLosers = {
      splitField,
      winners: subgroupProfile(ranked.slice(0, half), splitField),
      losers: subgroupProfile(ranked.slice(ranked.length - half), splitField),
    };
  }

  const tier2Included = !!peerMetricsBySymbol;
  let fundamentals = null;
  if (tier2Included) {
    fundamentals = {};
    for (const f of FUNDAMENTAL_FIELDS) {
      fundamentals[f] = fundamentalStat(peerMetricsBySymbol, syms, f);
    }
  }

  return {
    size: syms.length,
    covered: covered.length,
    offUniverse,
    sectors: concentration(entries, 'sectorName'),
    industries: concentration(entries, 'industryName'),
    returns,
    momentum: {
      medianScore: median(entries.map((e) => e.momentumScore)),
      count: numbers(entries.map((e) => e.momentumScore)).length,
    },
    trend: {
      aboveCount,
      belowCount: withPos.length - aboveCount,
      medianSma200Position: median(entries.map((e) => e.sma200_position)),
    },
    quality,
    nr7Count: entries.filter((e) => e.nr7Flag === true).length,
    winnersLosers,
    tier2Included,
    fundamentals,
  };
}

// ── Per-name layer (A + D) — sibling helpers; buildCohortDigest is untouched ──
//
// buildCohortRows lets the REAL per-name data through to the UI so the visible
// list ranks deterministically (no model in the ranking loop). tagStandouts
// flags the extreme name per dimension for a neutral UI highlight. Both are
// UI-only: their output is returned to the client, NEVER added to the Gemma
// prompt (a per-name table in the prompt is sub-capability B, deferred).

// Per-row Tier-1 fields surfaced to the list. nr7Flag is a boolean (defaults
// false upstream), atrPercentile is pre-rounded — copied as-is.
const ROW_TIER1_FIELDS = [
  'sectorName', 'industryName',
  'return1W', 'return1M', 'return3M', 'returnYTD', 'return12M',
  'momentumScore', 'sma200_position', 'atrPercentile',
  'compositeScore', 'technicalScore', 'baggerBombFit', 'nr7Flag',
];

// Dimensions the standout-tagger flags. Technical always; fundamental only when
// Tier-2 rows are present.
const TECHNICAL_OUTLIER_DIMS = ['return1M', 'return3M', 'momentumScore', 'sma200_position', 'atrPercentile'];
const FUNDAMENTAL_OUTLIER_DIMS = ['trailingPE', 'debtToEquity', 'revenueGrowthYOY', 'profitMarginTTM', 'marketCap'];

// Below this many finite values on a dimension, "the extreme" is not meaningful.
const MIN_STANDOUT_COUNT = 3;

/**
 * Tag the extreme (min/max-holder) name per dimension — the same deterministic
 * pass fundamentalStat already uses (ties resolve to the first symbol). The
 * marker is DIRECTION-AWARE (high vs low) but VALUE-NEUTRAL: the UI renders an
 * "extreme on this dimension" marker, not a good/bad tint. Mutates + returns rows.
 *
 * @param {Object[]} rows
 * @param {{ tier2?: boolean }} [opts]
 */
export function tagStandouts(rows, { tier2 = false } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  for (const r of list) r.standouts = { high: [], low: [] };
  const dims = tier2 ? [...TECHNICAL_OUTLIER_DIMS, ...FUNDAMENTAL_OUTLIER_DIMS] : TECHNICAL_OUTLIER_DIMS;
  for (const dim of dims) {
    const finite = list.filter((r) => typeof r[dim] === 'number' && Number.isFinite(r[dim]));
    if (finite.length < MIN_STANDOUT_COUNT) continue;
    let low = finite[0];
    let high = finite[0];
    for (const r of finite) {
      if (r[dim] < low[dim]) low = r;
      if (r[dim] > high[dim]) high = r;
    }
    high.standouts.high.push(dim);
    low.standouts.low.push(dim);
  }
  return list;
}

/**
 * Per-name rows for the visible list — one object per COVERED symbol (input
 * order; the UI owns the sort). Tier-1 fields always; Tier-2 fields present
 * ONLY when peerMetricsBySymbol is provided, so the client can tell "not loaded"
 * (key absent) from "loaded-but-null" (key === null) and hide columns. Rows are
 * standout-tagged before return.
 *
 * @returns {Object[]}
 */
export function buildCohortRows({ symbols, rankingsBySymbol, peerMetricsBySymbol = null }) {
  const syms = Array.isArray(symbols) ? symbols : [];
  const ranks = rankingsBySymbol || {};
  const tier2 = !!peerMetricsBySymbol;

  const rows = [];
  for (const s of syms) {
    const e = ranks[s];
    if (!e) continue; // off-universe excluded here — the UI lists them from digest.offUniverse
    const row = { symbol: s };
    for (const f of ROW_TIER1_FIELDS) row[f] = e[f] ?? null;
    if (tier2) {
      const m = peerMetricsBySymbol[s] || null;
      for (const f of FUNDAMENTAL_FIELDS) row[f] = m?.[f] ?? null;
    }
    rows.push(row);
  }
  tagStandouts(rows, { tier2 });
  return rows;
}
