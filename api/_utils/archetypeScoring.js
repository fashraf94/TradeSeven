/**
 * Archetype-specific scoring for portfolio differentiation.
 *
 * Each archetype weights ranking metrics differently so agents
 * see a stock universe sorted by their strategic preference.
 */

// ---------- A) Weight profiles per archetype ----------
// Each dimension weight set sums to 1.0.
// Dimensions: fundamentalScore (0-100), technicalScore (0-100),
// baggerBombFit (0-100), atrPercentile (0-1 raw, scaled to 0-100),
// inverseComposite (100 - compositeScore), sectorDiversity (computed dynamically).

export const ARCHETYPE_WEIGHTS = {
  momentum_chaser: {
    fundamentalScore: 0.05,
    technicalScore: 0.40,
    baggerBombFit: 0.30,
    atrPercentile: 0.25,
    inverseComposite: 0.00,
    sectorDiversity: 0.00,
  },
  contrarian: {
    fundamentalScore: 0.15,
    technicalScore: 0.10,
    baggerBombFit: 0.15,
    atrPercentile: 0.20,
    inverseComposite: 0.40,
    sectorDiversity: 0.00,
  },
  diversifier: {
    fundamentalScore: 0.25,
    technicalScore: 0.20,
    baggerBombFit: 0.20,
    atrPercentile: 0.05,
    inverseComposite: 0.00,
    sectorDiversity: 0.30,
  },
  degen: {
    fundamentalScore: 0.00,
    technicalScore: 0.15,
    baggerBombFit: 0.25,
    atrPercentile: 0.60,
    inverseComposite: 0.00,
    sectorDiversity: 0.00,
  },
  analyst: {
    fundamentalScore: 0.40,
    technicalScore: 0.30,
    baggerBombFit: 0.15,
    atrPercentile: 0.05,
    inverseComposite: 0.00,
    sectorDiversity: 0.10,
  },
  guardian: {
    fundamentalScore: 0.30,
    technicalScore: 0.20,
    baggerBombFit: 0.10,
    atrPercentile: 0.05,
    inverseComposite: 0.00,
    sectorDiversity: 0.35,
  },
};

// ---------- B) Temperature profiles ----------
// Controls LLM creativity per archetype for Sonnet (strategy) and Haiku (portfolio).

export const ARCHETYPE_TEMPERATURES = {
  momentum_chaser: { sonnet: 0.3, haiku: 0.3 },
  contrarian: { sonnet: 0.7, haiku: 0.6 },
  diversifier: { sonnet: 0.5, haiku: 0.4 },
  degen: { sonnet: 0.9, haiku: 0.8 },
  analyst: { sonnet: 0.2, haiku: 0.2 },
  guardian: { sonnet: 0.3, haiku: 0.2 },
};

// ---------- C) Sector constraint strings ----------
// Injected into Sonnet's system prompt to enforce archetype-specific behavior.

export const ARCHETYPE_CONSTRAINTS = {
  momentum_chaser:
    'Your shortlist MUST include at least 5 stocks from today\'s top 3 performing sectors. Avoid sectors down more than 1% today.',
  contrarian:
    'Your shortlist MUST include at least 5 stocks from today\'s bottom 3 performing sectors. Avoid the top-performing sector entirely.',
  diversifier:
    'Your shortlist MUST span at least 7 different sectors. No sector may have more than 4 stocks in your shortlist.',
  degen:
    'Your shortlist MUST include at least 3 stocks with ATR percentile above 0.80. Ignore fundamental scores entirely — focus only on volatility and momentum.',
  analyst:
    'Your shortlist MUST include at least 5 stocks with fundamentalScore above 70. Exclude any stock with fundamentalScore below 40.',
  guardian:
    'Your shortlist MUST include at least 5 stocks with fundamentalScore above 60. Spread across at least 6 sectors. Avoid stocks with ATR percentile above 0.75. Your edge is avoiding busts, not chasing baggers.',
};

// ---------- D) Scoring function ----------

/**
 * Computes an archetype-specific score for each stock and returns
 * the array sorted by that score descending.
 *
 * Does NOT mutate the input array.
 *
 * @param {Array} stocks - stockRankings array from Firestore
 * @param {string} archetype - agent archetype key
 * @returns {Array} new array with `archetypeScore` property added, sorted desc
 */
export function computeArchetypeRankings(stocks, archetype) {
  const weights = ARCHETYPE_WEIGHTS[archetype] || ARCHETYPE_WEIGHTS.analyst;

  // Pre-compute sector counts for sectorDiversity scoring
  const sectorCounts = {};
  for (const s of stocks) {
    const sector = s.sectorName || 'Unknown';
    sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
  }
  const maxSectorCount = Math.max(...Object.values(sectorCounts), 1);

  const scored = stocks.map((s) => {
    const dimensions = {
      fundamentalScore: s.fundamentalScore ?? 50,
      technicalScore: s.technicalScore ?? 50,
      baggerBombFit: s.baggerBombFit ?? 50,
      atrPercentile: Math.min((s.atrPercentile ?? 0.5) * 100, 100),
      inverseComposite: 100 - (s.compositeScore ?? 50),
      sectorDiversity:
        ((maxSectorCount - (sectorCounts[s.sectorName || 'Unknown'] || 0)) / maxSectorCount) * 100,
    };

    let score = 0;
    for (const [dim, weight] of Object.entries(weights)) {
      score += (dimensions[dim] ?? 0) * weight;
    }

    // Clamp to 0-100, round to 1 decimal
    score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;

    return { ...s, archetypeScore: score };
  });

  return scored.sort((a, b) => b.archetypeScore - a.archetypeScore);
}
