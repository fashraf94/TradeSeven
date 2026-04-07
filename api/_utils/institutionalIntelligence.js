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
 *
 * A position is "new_position" only if every current share was added this
 * quarter (change === currentShares), meaning no prior holding existed.
 * A >100% increase with a prior holding is aggressive accumulation, not new.
 */
export function classifySignal(changePct, change = null, currentShares = null) {
  if (changePct == null || isNaN(changePct)) return 'unchanged';
  // Truly new: all current shares were added this quarter
  if (changePct > 100 && change != null && currentShares != null
      && currentShares > 0 && change === currentShares) return 'new_position';
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
  const newPositions = institutions.filter(i => {
    const change = parseInt(i.change) || 0;
    const shares = parseInt(i.currentShares) || 0;
    return classifySignal(parseFloat(i.change_p), change, shares) === 'new_position';
  }).length;

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
  const change = parseInt(holder.change) || 0;
  const currentShares = parseInt(holder.currentShares) || 0;
  return {
    name: holder.name || 'Unknown',
    date: holder.date || null,
    totalSharesPct: parseFloat(holder.totalShares) || 0,
    totalAssetsPct: parseFloat(holder.totalAssets) || 0,
    currentShares,
    change,
    changePct: parseFloat(holder.change_p) || 0,
    signal: classifySignal(parseFloat(holder.change_p), change, currentShares),
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

// ══════════════════════════════════════════════
// STORYLINE & HEADLINE GENERATORS
// ══════════════════════════════════════════════

/**
 * Generate narrative storyline cards from per-stock institutional data.
 * No AI needed — pure template matching on signals and thresholds.
 *
 * Input: Map of symbol -> { institutions (enriched), summary }
 * Output: Array of storyline objects, sorted by impact, capped at 8
 */
export function generateStorylines(stockHoldingsMap) {
  const storylines = [];

  for (const [symbol, data] of Object.entries(stockHoldingsMap)) {
    const { institutions, summary } = data;

    const activeHolders = institutions.filter(i => i.archetype !== 'index_passive');

    // TEMPLATE 1: Cluster Buy (highest priority)
    if (summary.clusterBuy) {
      const newEntrants = activeHolders
        .filter(i => i.signal === 'new_position')
        .map(i => i.name)
        .slice(0, 3);

      storylines.push({
        type: 'cluster_buy',
        priority: 85,
        symbol,
        headline: `Smart Money Stampede: ${newEntrants.length} major funds simultaneously entered ${symbol}`,
        detail: newEntrants.join(', '),
        metric: `${newEntrants.length} new positions`,
        metricType: 'count',
        archetype: 'mixed',
      });
    }

    // TEMPLATE 2: Massive new position (high conviction entry)
    for (const inst of activeHolders) {
      if (inst.signal === 'new_position' && inst.totalAssetsPct > 2.0) {
        storylines.push({
          type: 'new_position',
          priority: 90,
          symbol,
          headline: `${inst.name} opens massive new stake in ${symbol}`,
          detail: `Now ${inst.totalAssetsPct.toFixed(1)}% of their portfolio`,
          metric: `${inst.totalAssetsPct.toFixed(1)}% of portfolio`,
          metricType: 'weight',
          archetype: inst.archetype,
          institution: inst.name,
        });
      }
    }

    // TEMPLATE 3: Complete exit (high drama)
    for (const inst of activeHolders) {
      if (inst.signal === 'exiting') {
        storylines.push({
          type: 'exit',
          priority: 85,
          symbol,
          headline: `${inst.name} liquidates entire ${symbol} position`,
          detail: `Sold ${formatSharesCompact(Math.abs(inst.change))} shares`,
          metric: 'Full Exit',
          metricType: 'exit',
          archetype: inst.archetype,
          institution: inst.name,
        });
      }
    }

    // TEMPLATE 4: High-conviction accumulation (>5% portfolio weight AND accumulating)
    for (const inst of activeHolders) {
      if (inst.signal === 'accumulating' && inst.totalAssetsPct > 5.0) {
        storylines.push({
          type: 'high_conviction',
          priority: 75,
          symbol,
          headline: `${inst.name} doubles down on ${symbol} — now their #1 bet`,
          detail: `${inst.totalAssetsPct.toFixed(1)}% of portfolio, up ${inst.changePct.toFixed(1)}%`,
          metric: `${inst.totalAssetsPct.toFixed(1)}% weight`,
          metricType: 'weight',
          archetype: inst.archetype,
          institution: inst.name,
        });
      }
    }

    // TEMPLATE 5: Significant trimming by a major holder
    for (const inst of activeHolders) {
      if (inst.signal === 'trimming' && inst.totalAssetsPct > 3.0 && Math.abs(inst.changePct) > 10) {
        storylines.push({
          type: 'trimming',
          priority: 60,
          symbol,
          headline: `${inst.name} cuts ${symbol} position by ${Math.abs(inst.changePct).toFixed(0)}%`,
          detail: `Still holds ${inst.totalAssetsPct.toFixed(1)}% of portfolio`,
          metric: `${inst.changePct.toFixed(0)}%`,
          metricType: 'change',
          archetype: inst.archetype,
          institution: inst.name,
        });
      }
    }
  }

  // Sort by priority (highest first), then deduplicate by symbol (max 2 storylines per stock)
  storylines.sort((a, b) => b.priority - a.priority);

  const symbolCount = {};
  const deduped = storylines.filter(s => {
    symbolCount[s.symbol] = (symbolCount[s.symbol] || 0) + 1;
    return symbolCount[s.symbol] <= 2;
  });

  // Cap per type: cluster_buy max 2, others max 3 — ensures variety
  const typeCounts = {};
  const typeCapped = deduped.filter(s => {
    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
    return typeCounts[s.type] <= (s.type === 'cluster_buy' ? 2 : 3);
  });

  return typeCapped.slice(0, 8);
}

/**
 * Generate the hero headline from sector flow data.
 * Finds the sector with highest net accumulation and highest net distribution.
 */
export function generateHeroHeadline(sectorFlows) {
  if (!sectorFlows || Object.keys(sectorFlows).length === 0) {
    return 'Institutional intelligence processing — check back soon';
  }

  const SECTOR_NAMES = {
    XLK: 'Technology', XLV: 'Healthcare', XLF: 'Financials', XLE: 'Energy',
    XLY: 'Consumer Discretionary', XLP: 'Consumer Staples', XLI: 'Industrials',
    XLB: 'Materials', XLU: 'Utilities', XLRE: 'Real Estate', XLC: 'Communications',
  };

  let maxAccum = { sector: null, score: -Infinity };
  let maxDistrib = { sector: null, score: -Infinity };

  for (const [sector, flows] of Object.entries(sectorFlows)) {
    const accumScore = flows.netBuyers - flows.netSellers;
    const distribScore = flows.netSellers - flows.netBuyers;

    if (accumScore > maxAccum.score) {
      maxAccum = { sector, score: accumScore };
    }
    if (distribScore > maxDistrib.score) {
      maxDistrib = { sector, score: distribScore };
    }
  }

  const toName = (etf) => SECTOR_NAMES[etf] || etf;

  if (maxAccum.sector && maxDistrib.sector && maxAccum.sector !== maxDistrib.sector
      && maxAccum.score > 2 && maxDistrib.score > 2) {
    return `Smart money is rotating out of ${toName(maxDistrib.sector)} and into ${toName(maxAccum.sector)}`;
  }

  if (maxAccum.score > 2) {
    return `Institutions are loading up on ${toName(maxAccum.sector)} stocks`;
  }

  if (maxDistrib.score > 2) {
    return `Smart money is pulling back from ${toName(maxDistrib.sector)}`;
  }

  return 'Institutions are holding steady — no major sector rotations detected';
}

/**
 * Compute sector driver tickers — the top 2 stocks driving accumulation/distribution per sector.
 * Input: Map of symbol -> { summary, sector }
 * Output: { XLK: { accumulators: ["NVDA","CRM"], distributors: ["INTC","CSCO"] }, ... }
 */
export function computeSectorDrivers(stockHoldingsMap) {
  const sectorBuckets = {};

  for (const [symbol, data] of Object.entries(stockHoldingsMap)) {
    const sector = data.sector;
    if (!sector) continue;

    if (!sectorBuckets[sector]) {
      sectorBuckets[sector] = { accumulators: [], distributors: [] };
    }

    const conviction = data.summary?.conviction;
    const score = data.summary?.convictionScore || 0;

    if (conviction === 'strong_accumulation' || conviction === 'mild_accumulation') {
      sectorBuckets[sector].accumulators.push({ symbol, score });
    }
    if (conviction === 'strong_distribution' || conviction === 'mild_distribution') {
      sectorBuckets[sector].distributors.push({ symbol, score: Math.abs(score) });
    }
  }

  const result = {};
  for (const [sector, bucket] of Object.entries(sectorBuckets)) {
    result[sector] = {
      accumulators: bucket.accumulators
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map(s => s.symbol),
      distributors: bucket.distributors
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map(s => s.symbol),
    };
  }

  return result;
}

// ══════════════════════════════════════════════
// HERO INSIGHTS, SECTOR ANALYSIS, UNDER THE RADAR
// ══════════════════════════════════════════════

const SECTOR_NAMES = {
  XLK: 'Technology', XLV: 'Healthcare', XLF: 'Financials', XLE: 'Energy',
  XLY: 'Consumer Discretionary', XLP: 'Consumer Staples', XLI: 'Industrials',
  XLB: 'Materials', XLU: 'Utilities', XLRE: 'Real Estate', XLC: 'Communications',
};

/**
 * Generate 3-5 high-level intelligence observations from aggregate data.
 * Each insight is a standalone sentence that reveals a meaningful pattern.
 *
 * Input: Full aggregate computation results
 * Output: Array of 3-5 insight strings, prioritized by impact
 */
export function generateHeroInsights({
  sectorFlows,
  strongAccumulation,
  strongDistribution,
  storylines,
  topInstitutions,
  stocksProcessed,
}) {
  const insights = [];

  // Insight 1: Sector rotation
  if (sectorFlows) {
    let maxAccum = { sector: null, score: -Infinity };
    let maxDistrib = { sector: null, score: -Infinity };

    for (const [sector, flows] of Object.entries(sectorFlows)) {
      const accumScore = flows.netBuyers - flows.netSellers;
      const distribScore = flows.netSellers - flows.netBuyers;
      if (accumScore > maxAccum.score) maxAccum = { sector, score: accumScore };
      if (distribScore > maxDistrib.score) maxDistrib = { sector, score: distribScore };
    }

    const toName = (etf) => SECTOR_NAMES[etf] || etf;

    if (maxAccum.sector && maxDistrib.sector && maxAccum.sector !== maxDistrib.sector
        && maxAccum.score > 2 && maxDistrib.score > 2) {
      insights.push({
        text: `Smart money is rotating out of ${toName(maxDistrib.sector)} and into ${toName(maxAccum.sector)}`,
        type: 'rotation',
        tickers: [],
      });
    } else if (maxAccum.score > 2) {
      insights.push({
        text: `Institutions are loading up on ${toName(maxAccum.sector)} stocks`,
        type: 'rotation',
        tickers: [],
      });
    }
  }

  // Insight 2: Cluster buys — list actual ticker symbols
  const clusterBuyStories = (storylines || []).filter(s => s.type === 'cluster_buy');
  if (clusterBuyStories.length > 0) {
    const tickers = clusterBuyStories.map(s => s.symbol);
    insights.push({
      text: `Cluster buys detected in ${tickers.join(', ')} — multiple funds opened simultaneous new positions`,
      type: 'cluster',
      tickers,
    });
  }

  // Insight 3: Distribution pressure — name the specific stocks
  if (strongDistribution && strongDistribution.length > 0) {
    insights.push({
      text: `Under distribution pressure: ${strongDistribution.join(', ')} — institutions are net selling`,
      type: 'distribution',
      tickers: strongDistribution.slice(),
    });
  }

  // Insight 4: Biggest single-fund expansion — name the fund and top bets
  if (topInstitutions && topInstitutions.length > 0) {
    let maxNewPositions = { name: null, count: 0, stocksHeld: 0, topBets: [] };
    for (const inst of topInstitutions) {
      if (!inst.positions) continue;
      const newCount = inst.positions.filter(p => p.signal === 'new_position').length;
      if (newCount > maxNewPositions.count) {
        const topBets = inst.positions
          .sort((a, b) => b.totalAssetsPct - a.totalAssetsPct)
          .slice(0, 3)
          .map(p => p.symbol);
        maxNewPositions = { name: inst.name, count: newCount, stocksHeld: inst.stocksHeld, topBets };
      }
    }
    if (maxNewPositions.count >= 3) {
      insights.push({
        text: `${maxNewPositions.name} holds ${maxNewPositions.stocksHeld} stocks — top bets: ${maxNewPositions.topBets.join(', ')}`,
        type: 'expansion',
        tickers: maxNewPositions.topBets,
      });
    }
  }

  // Insight 5: Sector with strongest buyer/seller ratio
  if (sectorFlows) {
    let bestRatio = { sector: null, ratio: 0, buyers: 0, sellers: 0 };
    for (const [sector, flows] of Object.entries(sectorFlows)) {
      const total = flows.netBuyers + flows.netSellers;
      if (total < 3) continue;
      const ratio = flows.netBuyers / Math.max(flows.netSellers, 1);
      if (ratio > bestRatio.ratio) {
        bestRatio = { sector, ratio, buyers: flows.netBuyers, sellers: flows.netSellers };
      }
    }
    if (bestRatio.sector && bestRatio.ratio >= 3) {
      const name = SECTOR_NAMES[bestRatio.sector] || bestRatio.sector;
      insights.push({
        text: `${name} accumulation at ${bestRatio.buyers}:${bestRatio.sellers} buyer/seller ratio — strongest sector conviction`,
        type: 'sector_strength',
        tickers: [],
      });
    }
  }

  return insights.slice(0, 5);
}

/**
 * Generate a 1-2 sentence contextual analysis of sector rotation data.
 *
 * Input: sectorFlows, sectorDrivers
 * Output: String with 1-2 sentences
 */
export function generateSectorAnalysis(sectorFlows, sectorDrivers) {
  if (!sectorFlows || Object.keys(sectorFlows).length === 0) {
    return 'Institutional sector flow data is currently processing.';
  }

  const sorted = Object.entries(sectorFlows)
    .map(([sector, flow]) => ({
      sector,
      name: SECTOR_NAMES[sector] || sector,
      net: flow.netBuyers - flow.netSellers,
      buyers: flow.netBuyers,
      sellers: flow.netSellers,
      drivers: sectorDrivers?.[sector] || { accumulators: [], distributors: [] },
    }))
    .sort((a, b) => b.net - a.net);

  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  const parts = [];

  if (top && top.net > 0) {
    const driverStr = top.drivers.accumulators?.length > 0
      ? `, driven by ${top.drivers.accumulators.join(' and ')}`
      : '';
    parts.push(`${top.name} leads all sectors with ${top.buyers} stocks under accumulation${driverStr}.`);
  }

  if (bottom && bottom.net < 0) {
    const driverStr = bottom.drivers.distributors?.length > 0
      ? `, led by ${bottom.drivers.distributors.join(' and ')} outflows`
      : '';
    parts.push(`${bottom.name} faces the heaviest distribution pressure at ${bottom.sellers} net sellers${driverStr}.`);
  }

  if (parts.length === 0) {
    return 'Institutional flows are broadly neutral across sectors this quarter.';
  }

  return parts.join(' ');
}

/**
 * Find stocks with quiet institutional conviction from non-passive funds.
 * These are small positions (< 2% portfolio weight) in stocks with fewer
 * institutional holders — indicating early-stage institutional interest
 * that hasn't become crowded yet.
 *
 * Input: stockHoldingsMap (symbol -> { institutions, summary, sector })
 * Output: Array of { symbol, institution, archetype, weight, signal, changePct, activeHolderCount } objects, max 10
 */
export function computeUnderTheRadar(stockHoldingsMap) {
  const candidates = [];

  for (const [symbol, data] of Object.entries(stockHoldingsMap)) {
    const { institutions } = data;
    if (!institutions || institutions.length === 0) continue;

    const activeHolders = institutions.filter(i => i.archetype !== 'index_passive');
    if (activeHolders.length > 12) continue;

    for (const inst of activeHolders) {
      if (!['accumulating', 'new_position', 'unchanged'].includes(inst.signal)) continue;
      if (inst.totalAssetsPct > 3.0) continue;
      if (inst.totalAssetsPct < 0.005) continue;

      const interestingArchetypes = ['quantitative', 'activist', 'transient', 'long_only'];
      if (!interestingArchetypes.includes(inst.archetype)) continue;

      candidates.push({
        symbol,
        institution: inst.name,
        archetype: inst.archetype,
        weight: Math.round(inst.totalAssetsPct * 100) / 100,
        signal: inst.signal,
        changePct: inst.changePct,
        activeHolderCount: activeHolders.length,
      });
    }
  }

  // Score: prefer fewer active holders (more "under the radar") and newer signals
  candidates.sort((a, b) => {
    const signalScore = (s) => s.signal === 'new_position' ? 2 : 1;
    const radarScore = (c) => (14 - c.activeHolderCount) + signalScore(c);
    return radarScore(b) - radarScore(a);
  });

  // Deduplicate: max 1 entry per symbol (pick the most interesting institution)
  const seen = new Set();
  const deduped = candidates.filter(c => {
    if (seen.has(c.symbol)) return false;
    seen.add(c.symbol);
    return true;
  });

  return deduped.slice(0, 10);
}

// Helper for compact share formatting (used by storylines)
function formatSharesCompact(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}
