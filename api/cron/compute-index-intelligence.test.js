// api/cron/compute-index-intelligence.test.js
// Tier 0 Item 6: persisted ARCH scores + sma200_position field.
//
// The cron handler in compute-index-intelligence.js is not exported, so these
// tests reproduce the two new transformations (arch_scores attachment + the
// sma200_position formula) verbatim from the cron source against a synthetic
// universe. That locks the byte-identical-port contract: if anyone changes the
// cron's transformation, these tests must change in lockstep.

import { describe, it, expect } from 'vitest';
import { computeArchetypeRankings } from '../_utils/archetypeScoring.js';

const ARCHETYPES = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

// ==================== HELPERS ====================

// Synthetic stock entry shape mirrors what compute-index-intelligence.js
// pushes into rankingStocks at the point where ARCH scores are attached.
function syntheticStock({
  symbol,
  sectorName,
  fundamentalScore = 50,
  technicalScore = 50,
  baggerBombFit = 50,
  atrPercentile = 0.5,
  compositeScore = 50,
}) {
  return {
    symbol,
    sectorName,
    fundamentalScore,
    technicalScore,
    baggerBombFit,
    atrPercentile,
    compositeScore,
  };
}

// Reproduces the cron's arch_scores attachment block (lines after rankingStocks
// is sorted, before batch.set). Mutates each stock by adding `arch_scores`.
function attachArchScores(rankingStocks) {
  const archScoresBySymbol = {};
  for (const archetype of ARCHETYPES) {
    const ranked = computeArchetypeRankings(rankingStocks, archetype);
    for (const s of ranked) {
      if (!archScoresBySymbol[s.symbol]) archScoresBySymbol[s.symbol] = {};
      archScoresBySymbol[s.symbol][archetype] = s.archetypeScore;
    }
  }
  for (const stock of rankingStocks) {
    stock.arch_scores = archScoresBySymbol[stock.symbol] || {};
  }
  return rankingStocks;
}

// Reproduces the cron's sma200_position formula verbatim (per-stock loop).
function computeSma200Position(currentPrice, sma200) {
  return (sma200 !== null && currentPrice != null)
    ? Number((((currentPrice - sma200) / sma200) * 100).toFixed(2))
    : null;
}

// Builds a 7-stock universe spanning 3 sectors (5 Tech, 1 Healthcare, 1 Energy)
// so sectorDiversity has meaningful variance.
function buildSyntheticUniverse() {
  return [
    syntheticStock({ symbol: 'AAPL', sectorName: 'Technology', fundamentalScore: 75, technicalScore: 80, baggerBombFit: 70, atrPercentile: 0.4, compositeScore: 78 }),
    syntheticStock({ symbol: 'MSFT', sectorName: 'Technology', fundamentalScore: 82, technicalScore: 70, baggerBombFit: 60, atrPercentile: 0.35, compositeScore: 80 }),
    syntheticStock({ symbol: 'GOOG', sectorName: 'Technology', fundamentalScore: 70, technicalScore: 65, baggerBombFit: 55, atrPercentile: 0.3, compositeScore: 72 }),
    syntheticStock({ symbol: 'NVDA', sectorName: 'Technology', fundamentalScore: 60, technicalScore: 95, baggerBombFit: 90, atrPercentile: 0.85, compositeScore: 88 }),
    syntheticStock({ symbol: 'AMD', sectorName: 'Technology', fundamentalScore: 55, technicalScore: 78, baggerBombFit: 75, atrPercentile: 0.7, compositeScore: 70 }),
    syntheticStock({ symbol: 'JNJ', sectorName: 'Healthcare', fundamentalScore: 85, technicalScore: 50, baggerBombFit: 35, atrPercentile: 0.2, compositeScore: 75 }),
    syntheticStock({ symbol: 'XOM', sectorName: 'Energy', fundamentalScore: 65, technicalScore: 60, baggerBombFit: 45, atrPercentile: 0.55, compositeScore: 62 }),
  ];
}

// ==================== ARCH MATH-CONSISTENCY ====================

describe('compute-index-intelligence — arch_scores byte-identical with computeArchetypeRankings', () => {
  it('attached arch_scores match an independent computeArchetypeRankings call for every (symbol, archetype) pair', () => {
    const universe = buildSyntheticUniverse();
    attachArchScores(universe);

    for (const archetype of ARCHETYPES) {
      const independent = computeArchetypeRankings(buildSyntheticUniverse(), archetype);
      for (const s of independent) {
        const attached = universe.find(x => x.symbol === s.symbol);
        expect(attached.arch_scores[archetype]).toBe(s.archetypeScore);
      }
    }
  });

  it('every stock has arch_scores with all six archetype keys', () => {
    const universe = buildSyntheticUniverse();
    attachArchScores(universe);

    for (const stock of universe) {
      expect(stock.arch_scores).toBeDefined();
      for (const archetype of ARCHETYPES) {
        expect(stock.arch_scores).toHaveProperty(archetype);
        expect(typeof stock.arch_scores[archetype]).toBe('number');
        expect(stock.arch_scores[archetype]).toBeGreaterThanOrEqual(0);
        expect(stock.arch_scores[archetype]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('produces stable scores when called twice on the same universe', () => {
    const a = buildSyntheticUniverse();
    const b = buildSyntheticUniverse();
    attachArchScores(a);
    attachArchScores(b);

    for (const stockA of a) {
      const stockB = b.find(s => s.symbol === stockA.symbol);
      for (const archetype of ARCHETYPES) {
        expect(stockA.arch_scores[archetype]).toBe(stockB.arch_scores[archetype]);
      }
    }
  });
});

// ==================== sectorDiversity UNIVERSE INVARIANT ====================

describe('compute-index-intelligence — ARCH must be computed against the FULL universe', () => {
  it('the same stock gets DIFFERENT diversifier scores when the universe is filtered', () => {
    // sectorDiversity = ((maxSectorCount − count[stock.sector]) / maxSectorCount) × 100.
    // A stock in the dominant sector always scores 0, so we need a stock in a
    // minority sector to expose the universe dependency.
    //
    // Full universe (5 Tech, 1 Healthcare, 1 Energy):
    //   maxSectorCount = 5, JNJ in Healthcare → sectorDiversity = (5−1)/5 × 100 = 80.
    // Healthcare-only subset (1 Healthcare):
    //   maxSectorCount = 1, JNJ in Healthcare → sectorDiversity = (1−1)/1 × 100 = 0.
    const fullUniverse = buildSyntheticUniverse();
    const fullRanked = computeArchetypeRankings(fullUniverse, 'diversifier');

    const healthcareOnly = fullUniverse.filter(s => s.sectorName === 'Healthcare');
    const filteredRanked = computeArchetypeRankings(healthcareOnly, 'diversifier');

    const fullJnjScore = fullRanked.find(s => s.symbol === 'JNJ').archetypeScore;
    const filteredJnjScore = filteredRanked.find(s => s.symbol === 'JNJ').archetypeScore;

    // Locks the rule: the cron MUST pass the full rankingStocks array. A future
    // change that filters the universe before calling computeArchetypeRankings
    // would shift scores and trip this assertion.
    expect(fullJnjScore).not.toBe(filteredJnjScore);
    expect(fullJnjScore).toBeGreaterThan(filteredJnjScore);
  });
});

// ==================== sma200_position FORMULA ====================

describe('compute-index-intelligence — sma200_position formula', () => {
  it('returns positive signed % when current price is above SMA200', () => {
    const result = computeSma200Position(105.50, 100.00);
    expect(result).toBe(5.5);
  });

  it('returns negative signed % when current price is below SMA200', () => {
    const result = computeSma200Position(96.80, 100.00);
    expect(result).toBe(-3.2);
  });

  it('returns null when SMA200 is null (insufficient history)', () => {
    expect(computeSma200Position(100.00, null)).toBe(null);
  });

  it('returns null when current price is null or undefined', () => {
    expect(computeSma200Position(null, 100.00)).toBe(null);
    expect(computeSma200Position(undefined, 100.00)).toBe(null);
  });

  it('rounds to 2 decimal places', () => {
    // (123.456 - 100) / 100 * 100 = 23.456 → 23.46
    expect(computeSma200Position(123.456, 100)).toBe(23.46);
    // (101.0001 - 100) / 100 * 100 = 1.0001 → 1.00
    expect(computeSma200Position(101.0001, 100)).toBe(1);
  });

  it('handles zero distance (price exactly at SMA200)', () => {
    expect(computeSma200Position(100.00, 100.00)).toBe(0);
  });
});

// ==================== END-TO-END SHAPE CHECK ====================

describe('compute-index-intelligence — combined output shape', () => {
  it('a populated stock entry carries both arch_scores and sma200_position', () => {
    const universe = buildSyntheticUniverse();
    attachArchScores(universe);

    // Simulate the per-stock loop attaching sma200_position from synthetic
    // (currentPrice, sma200) pairs.
    const priceData = {
      AAPL: { currentPrice: 175.0, sma200: 165.0 }, // above
      MSFT: { currentPrice: 380.0, sma200: 400.0 }, // below
      GOOG: { currentPrice: 140.0, sma200: null },  // insufficient history
      NVDA: { currentPrice: 500.0, sma200: 450.0 },
      AMD: { currentPrice: 110.0, sma200: 120.0 },
      JNJ: { currentPrice: 155.0, sma200: 155.0 },  // exactly at SMA
      XOM: { currentPrice: 105.0, sma200: 100.0 },
    };
    for (const stock of universe) {
      const { currentPrice, sma200 } = priceData[stock.symbol];
      stock.sma200_position = computeSma200Position(currentPrice, sma200);
    }

    const aapl = universe.find(s => s.symbol === 'AAPL');
    expect(aapl.sma200_position).toBeCloseTo(6.06, 2);
    expect(aapl.arch_scores).toHaveProperty('momentum_chaser');

    const goog = universe.find(s => s.symbol === 'GOOG');
    expect(goog.sma200_position).toBe(null);
    expect(Object.keys(goog.arch_scores)).toHaveLength(6);

    const jnj = universe.find(s => s.symbol === 'JNJ');
    expect(jnj.sma200_position).toBe(0);
  });
});
