/**
 * Institutional Intelligence computation helpers.
 * Pure functions — no side effects, no API calls, no Firestore.
 *
 * Input: Raw holder arrays from EODHD (already converted via Object.values())
 * Output: Derived signals, conviction scores, archetype tags
 */

// ══════════════════════════════════════════════
// INSTITUTION ARCHETYPE LOOKUP
// ══════════════════════════════════════════════
// Static lookup of major institutions.
// Unknown institutions default to 'long_only'.

export const INSTITUTION_ARCHETYPES = {
  // Index/Passive (EXCLUDED from conviction calculations)
  'Vanguard Group Inc': 'index_passive',
  'Vanguard Group': 'index_passive',
  'BlackRock Inc.': 'index_passive',
  'BlackRock Inc': 'index_passive',
  'Blackrock Inc.': 'index_passive',
  'State Street Corporation': 'index_passive',
  'State Street Corp': 'index_passive',
  'Geode Capital Management, LLC': 'index_passive',
  'Geode Capital Management': 'index_passive',
  'Northern Trust Corporation': 'index_passive',
  'Charles Schwab Investment Management': 'index_passive',
  'Legal & General Group Plc': 'index_passive',

  // Quantitative (signal expires fast)
  'Renaissance Technologies LLC': 'quantitative',
  'Two Sigma Investments, LP': 'quantitative',
  'Two Sigma Advisors, LP': 'quantitative',
  'DE Shaw & Co': 'quantitative',
  'D. E. Shaw & Co., L.P.': 'quantitative',
  'Citadel Advisors LLC': 'quantitative',
  'AQR Capital Management': 'quantitative',
  'Millennium Management LLC': 'quantitative',
  'Jane Street Group, LLC': 'quantitative',
  'Susquehanna International Group': 'quantitative',
  'Jump Trading LLC': 'quantitative',

  // Transient (high-turnover, short-horizon momentum)
  'Point72 Asset Management': 'transient',
  'Viking Global Investors LP': 'transient',
  'Coatue Management LLC': 'transient',
  'Tiger Global Management LLC': 'transient',
  'Lone Pine Capital LLC': 'transient',
  'Dragoneer Investment Group': 'transient',
  'Altimeter Capital Management': 'transient',
  'D1 Capital Partners': 'transient',

  // Activist
  'Elliott Management Corporation': 'activist',
  'Elliott Investment Management': 'activist',
  'Third Point LLC': 'activist',
  'Pershing Square Capital Management': 'activist',
  'Starboard Value LP': 'activist',
  'ValueAct Capital': 'activist',
  'Trian Fund Management': 'activist',
  'Carl Icahn': 'activist',
  'Icahn Enterprises': 'activist',

  // Long-Only (high conviction, fundamental)
  'Berkshire Hathaway Inc': 'long_only',
  'Berkshire Hathaway': 'long_only',
  'FMR LLC': 'long_only',
  'Fidelity Management & Research': 'long_only',
  'T. Rowe Price Associates': 'long_only',
  'T. Rowe Price Group': 'long_only',
  'Capital Research Global Investors': 'long_only',
  'Capital International Investors': 'long_only',
  'Wellington Management Group LLP': 'long_only',
  'Wellington Management Co. LLP': 'long_only',
  'Baillie Gifford & Co': 'long_only',
  'Jennison Associates LLC': 'long_only',
  'Fisher Asset Management': 'long_only',
  'Dodge & Cox': 'long_only',
  'Primecap Management Co': 'long_only',
  'Bridgewater Associates': 'long_only',
  'ARK Investment Management LLC': 'long_only',
  'Cathie Wood': 'long_only',
};

/**
 * Get archetype for an institution name.
 * Uses fuzzy prefix matching to handle name variations.
 */
export function getArchetype(name) {
  if (!name) return 'long_only';

  // Exact match first
  if (INSTITUTION_ARCHETYPES[name]) return INSTITUTION_ARCHETYPES[name];

  // Prefix match (handles "Vanguard Group Inc." vs "Vanguard Group Inc")
  const normalized = name.trim();
  for (const [key, archetype] of Object.entries(INSTITUTION_ARCHETYPES)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) {
      return archetype;
    }
  }

  return 'long_only'; // Default
}

/**
 * Classify a holder's signal based on QoQ percentage change.
 */
export function classifySignal(changePct) {
  if (changePct == null || isNaN(changePct)) return 'unchanged';
  if (changePct > 100) return 'new_position';
  if (changePct > 5) return 'accumulating';
  if (changePct < -20) return 'exiting';
  if (changePct < -5) return 'trimming';
  return 'unchanged';
}

/**
 * Compute weighted conviction score for a stock.
 *
 * Only active managers are included (excludes index/passive).
 * Formula: C_score = SUM(change_pct_i * portfolio_weight_i) / n
 */
export function computeConvictionScore(institutions) {
  const active = institutions.filter(i =>
    getArchetype(i.name) !== 'index_passive'
  );

  if (active.length === 0) return { score: 0, level: 'neutral' };

  const weightedSum = active.reduce((sum, inst) => {
    const changePct = parseFloat(inst.change_p) || 0;
    const portfolioWeight = parseFloat(inst.totalAssets) || 0.01;
    return sum + (changePct * portfolioWeight);
  }, 0);

  const score = weightedSum / active.length;

  let level;
  if (score > 5.0) level = 'strong_accumulation';
  else if (score > 1.0) level = 'mild_accumulation';
  else if (score > -1.0) level = 'neutral';
  else if (score > -5.0) level = 'mild_distribution';
  else level = 'strong_distribution';

  return { score: Math.round(score * 100) / 100, level };
}

/**
 * Compute summary statistics for a stock's institutional holdings.
 */
export function computeSummary(institutions, funds) {
  const active = institutions.filter(i =>
    getArchetype(i.name) !== 'index_passive'
  );

  const buyers = active.filter(i => parseFloat(i.change) > 0).length;
  const sellers = active.filter(i => parseFloat(i.change) < 0).length;
  const newPositions = institutions.filter(i =>
    classifySignal(parseFloat(i.change_p)) === 'new_position'
  ).length;

  const { score, level } = computeConvictionScore(institutions);

  // Cluster buy: 3+ institutions with new positions
  const clusterBuy = newPositions >= 3;

  return {
    totalInstitutionalHolders: institutions.length,
    activeHolders: active.length,
    buyersCount: buyers,
    sellersCount: sellers,
    unchangedCount: active.length - buyers - sellers,
    newPositionsCount: newPositions,
    clusterBuy,
    convictionScore: score,
    conviction: level,
    totalFundHolders: funds.length,
    netFundChange: funds.reduce((s, f) => s + (parseFloat(f.change) || 0), 0),
    topHolderName: institutions[0]?.name || 'N/A',
    topHolderShares: parseInt(institutions[0]?.currentShares) || 0,
    reportDate: institutions[0]?.date || null,
  };
}

/**
 * Enrich a holder entry with derived fields.
 */
export function enrichHolder(holder) {
  return {
    name: holder.name || 'Unknown',
    date: holder.date || null,
    totalSharesPct: parseFloat(holder.totalShares) || 0,
    totalAssetsPct: parseFloat(holder.totalAssets) || 0,
    currentShares: parseInt(holder.currentShares) || 0,
    change: parseInt(holder.change) || 0,
    changePct: parseFloat(holder.change_p) || 0,
    signal: classifySignal(parseFloat(holder.change_p)),
    archetype: getArchetype(holder.name),
  };
}

/**
 * Compute signal freshness based on archetype and report date.
 * Returns: 'active' | 'aging' | 'expired'
 */
export function computeFreshness(reportDate, archetype) {
  if (!reportDate) return 'aging';

  const daysSinceReport = Math.floor(
    (Date.now() - new Date(reportDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // High-turnover funds: signal expires faster
  if (archetype === 'quantitative' || archetype === 'transient') {
    if (daysSinceReport <= 60) return 'active';
    return 'expired';
  }

  // All other funds
  if (daysSinceReport <= 90) return 'active';
  if (daysSinceReport <= 135) return 'aging';
  return 'expired';
}
