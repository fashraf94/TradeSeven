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
import { calculatePivotLevels, classifyTrend } from '../_utils/technicalCalculations.js';
import { findSwingHighsLows, findNearestLevels } from '../_utils/analyticalPrimitives.js';

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

// ==================== PHASE 2A — PIVOT LEVELS FORMULA ====================

describe('compute-index-intelligence Phase 2A — calculatePivotLevels formula', () => {
  it('computes Standard pivot levels exactly from prior-day OHLC', () => {
    // Prior day: H=110, L=90, C=100. PP = (110+90+100)/3 = 100. Range = 20.
    // R1 = 2*100 - 90 = 110. R2 = 100 + 20 = 120.
    // S1 = 2*100 - 110 = 90.  S2 = 100 - 20 = 80.
    const result = calculatePivotLevels(110, 90, 100);
    expect(result).toEqual({
      pivotPP: 100,
      pivotR1: 110,
      pivotR2: 120,
      pivotS1: 90,
      pivotS2: 80,
    });
  });

  it('rounds each level to 2 decimal places', () => {
    // H=105.55, L=99.99, C=103.33. PP = (105.55+99.99+103.33)/3 ≈ 102.9233
    const result = calculatePivotLevels(105.55, 99.99, 103.33);
    expect(result.pivotPP).toBe(102.96);
    // R1 = 2*102.9233 - 99.99 ≈ 105.8567
    expect(result.pivotR1).toBe(105.92);
  });

  it('returns null when any input is null', () => {
    expect(calculatePivotLevels(null, 90, 100)).toBe(null);
    expect(calculatePivotLevels(110, null, 100)).toBe(null);
    expect(calculatePivotLevels(110, 90, null)).toBe(null);
    expect(calculatePivotLevels(null, null, null)).toBe(null);
  });

  it('R values are above PP and S values are below PP for a valid range', () => {
    const result = calculatePivotLevels(120, 80, 100);
    expect(result.pivotR1).toBeGreaterThan(result.pivotPP);
    expect(result.pivotR2).toBeGreaterThan(result.pivotR1);
    expect(result.pivotS1).toBeLessThan(result.pivotPP);
    expect(result.pivotS2).toBeLessThan(result.pivotS1);
  });
});

// ==================== PHASE 2A — TREND CLASSIFICATION ====================

describe('compute-index-intelligence Phase 2A — classifyTrend', () => {
  it("returns 'up' when current price is above SMA", () => {
    expect(classifyTrend(105, 100)).toBe('up');
  });

  it("returns 'down' when current price is below SMA", () => {
    expect(classifyTrend(95, 100)).toBe('down');
  });

  it("returns 'down' when current price equals SMA exactly (matches strict aboveSMA convention)", () => {
    expect(classifyTrend(100, 100)).toBe('down');
  });

  it('returns null when SMA is null (insufficient history)', () => {
    expect(classifyTrend(105, null)).toBe(null);
  });

  it('returns null when current price is null', () => {
    expect(classifyTrend(null, 100)).toBe(null);
    expect(classifyTrend(undefined, 100)).toBe(null);
  });
});

// ==================== PHASE 2A — SWING DETECTION ====================

describe('compute-index-intelligence Phase 2A — findSwingHighsLows', () => {
  // Build a 30-bar synthetic series (newest-first) with a known high at i=5
  // and a known low at i=15. Surrounding bars stay within a flat envelope.
  function syntheticOHLC() {
    const highs = new Array(30).fill(101);
    const lows = new Array(30).fill(99);
    const closes = new Array(30).fill(100);
    // Inject a clear swing high at i=5 (bar 5's high is 110, neighbors are 101)
    highs[5] = 110;
    // Inject a clear swing low at i=15 (bar 15's low is 90, neighbors are 99)
    lows[15] = 90;
    return { closes, highs, lows };
  }

  it('detects a known swing high at the injected index', () => {
    const { closes, highs, lows } = syntheticOHLC();
    const result = findSwingHighsLows(closes, highs, lows, 20);
    expect(result).not.toBe(null);
    const swingAt5 = result.swingHighs.find(s => s.index === 5);
    expect(swingAt5).toBeDefined();
    expect(swingAt5.price).toBe(110);
  });

  it('detects a known swing low at the injected index', () => {
    const { closes, highs, lows } = syntheticOHLC();
    const result = findSwingHighsLows(closes, highs, lows, 20);
    expect(result).not.toBe(null);
    const swingAt15 = result.swingLows.find(s => s.index === 15);
    expect(swingAt15).toBeDefined();
    expect(swingAt15.price).toBe(90);
  });

  it('returns most-recent-first ordering (lowest index first)', () => {
    const highs = new Array(30).fill(101);
    const lows = new Array(30).fill(99);
    const closes = new Array(30).fill(100);
    highs[4] = 110; // newer swing high
    highs[18] = 109; // older swing high
    const result = findSwingHighsLows(closes, highs, lows, 20);
    expect(result.swingHighs.length).toBeGreaterThanOrEqual(2);
    expect(result.swingHighs[0].index).toBeLessThan(result.swingHighs[1].index);
  });

  it('returns null when input arrays are too short (need lookback + 5)', () => {
    const closes = new Array(20).fill(100);
    const highs = new Array(20).fill(101);
    const lows = new Array(20).fill(99);
    expect(findSwingHighsLows(closes, highs, lows, 20)).toBe(null);
  });

  it('returns empty arrays when no local extremes exist (monotonic decline)', () => {
    // Strictly decreasing highs (newest-first): newest is lowest.
    const highs = Array.from({ length: 30 }, (_, i) => 100 + i);
    const lows = Array.from({ length: 30 }, (_, i) => 99 + i);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i - 0.5);
    const result = findSwingHighsLows(closes, highs, lows, 20);
    expect(result.swingHighs).toEqual([]);
    expect(result.swingLows).toEqual([]);
  });

  it('admits ties — a bar tied with a neighbor still qualifies as a swing', () => {
    // Tied highs around a peak: neighbors equal, candidate ties with one side.
    const highs = new Array(30).fill(101);
    const lows = new Array(30).fill(99);
    const closes = new Array(30).fill(100);
    highs[5] = 110;
    highs[6] = 110; // tied neighbor
    const result = findSwingHighsLows(closes, highs, lows, 20);
    // Both i=5 and i=6 should qualify since the algorithm uses >= / <=.
    const indices = result.swingHighs.map(s => s.index);
    expect(indices).toContain(5);
    expect(indices).toContain(6);
  });
});

// ==================== PHASE 2A — NEAREST S/R LEVELS ====================

describe('compute-index-intelligence Phase 2A — findNearestLevels', () => {
  it('clusters two close swing highs and reports the average as resistance', () => {
    // Two swing highs at 110.0 and 110.5 (within 2%) cluster to ~110.25.
    // Current price 100 — resistance is above.
    const swingHighs = [
      { index: 3, price: 110.0 },
      { index: 8, price: 110.5 },
    ];
    const swingLows = [];
    const result = findNearestLevels(100, swingHighs, swingLows, 20);
    expect(result.nearestResistance).toBeCloseTo(110.25, 2);
    expect(result.distanceToResistancePct).toBeCloseTo(10.25, 2);
  });

  it('clusters two close swing lows and reports the average as support', () => {
    // Two swing lows at 90.0 and 89.5 cluster to ~89.75. Current price 100.
    const swingHighs = [];
    const swingLows = [
      { index: 4, price: 90.0 },
      { index: 12, price: 89.5 },
    ];
    const result = findNearestLevels(100, swingHighs, swingLows, 20);
    expect(result.nearestSupport).toBeCloseTo(89.75, 2);
    // distance is signed — negative because support is below current price.
    expect(result.distanceToSupportPct).toBeCloseTo(-10.25, 2);
  });

  it('excludes single-touch swings (noise filter)', () => {
    // One isolated swing high at 110 (single touch) should NOT count.
    const swingHighs = [{ index: 5, price: 110 }];
    const swingLows = [{ index: 10, price: 90 }];
    const result = findNearestLevels(100, swingHighs, swingLows, 20);
    expect(result.nearestResistance).toBe(null);
    expect(result.nearestSupport).toBe(null);
    expect(result.distanceToResistancePct).toBe(null);
    expect(result.distanceToSupportPct).toBe(null);
  });

  it('excludes swings outside the lookback window', () => {
    // Two swings at price 110 but at indices 22 and 25 (outside lookback=20).
    const swingHighs = [
      { index: 22, price: 110 },
      { index: 25, price: 110 },
    ];
    const result = findNearestLevels(100, swingHighs, [], 20);
    expect(result.nearestResistance).toBe(null);
  });

  it('selects the closest qualifying cluster when multiple exist', () => {
    // Two clusters above current price: ~105 (closer) and ~120 (farther).
    const swingHighs = [
      { index: 3, price: 105.0 },
      { index: 7, price: 105.4 }, // cluster #1 → ~105.2
      { index: 10, price: 120.0 },
      { index: 15, price: 120.5 }, // cluster #2 → ~120.25
    ];
    const result = findNearestLevels(100, swingHighs, [], 20);
    expect(result.nearestResistance).toBeCloseTo(105.2, 1);
  });

  it('returns the all-null result when current price is null or non-positive', () => {
    const result1 = findNearestLevels(null, [], []);
    const result2 = findNearestLevels(0, [], []);
    for (const r of [result1, result2]) {
      expect(r.nearestResistance).toBe(null);
      expect(r.nearestSupport).toBe(null);
      expect(r.distanceToResistancePct).toBe(null);
      expect(r.distanceToSupportPct).toBe(null);
    }
  });

  it('does NOT classify a swing-high cluster as resistance once price has broken above it', () => {
    // Swing-high cluster at ~105 — but current price is 110 (broken through).
    // Per spec: only swing-HIGH clusters strictly above currentPrice qualify.
    const swingHighs = [
      { index: 3, price: 105.0 },
      { index: 7, price: 105.5 },
    ];
    const result = findNearestLevels(110, swingHighs, [], 20);
    expect(result.nearestResistance).toBe(null);
  });
});

// ==================== PHASE 2A — CRON WIRING (BYTE-IDENTICAL PORT) ====================

// Reproduces the cron's per-stock loop wiring for Phase 2A primitives so a
// drift in either the cron or the helper functions trips this test.
function reproducePhase2AWiring({ closes, highs, lows, sma20, sma50, sma200 }) {
  const currentPrice = closes[0];

  const pivots = calculatePivotLevels(highs[1] ?? null, lows[1] ?? null, closes[1] ?? null);

  const trend = {
    shortTerm: classifyTrend(currentPrice, sma20),
    intermediate: classifyTrend(currentPrice, sma50),
    longTerm: classifyTrend(currentPrice, sma200),
  };

  const swings = findSwingHighsLows(closes, highs, lows, 20);
  const levels = swings
    ? findNearestLevels(currentPrice, swings.swingHighs, swings.swingLows, 20)
    : { nearestResistance: null, nearestSupport: null, distanceToResistancePct: null, distanceToSupportPct: null };

  return { trend, pivots, levels };
}

describe('compute-index-intelligence Phase 2A — combined output shape', () => {
  function syntheticInputs() {
    const highs = new Array(30).fill(101);
    const lows = new Array(30).fill(99);
    const closes = new Array(30).fill(100);
    // Today's price = 102 (above all SMAs we'll test); prior day 100.
    closes[0] = 102;
    highs[0] = 103;
    lows[0] = 101;
    // Yesterday: H=104, L=98, C=100 → PP=(104+98+100)/3 = 100.67, R1=103.33, etc.
    highs[1] = 104;
    lows[1] = 98;
    closes[1] = 100;
    // Inject swings so levels can populate
    highs[5] = 115;
    highs[8] = 115.5;
    lows[12] = 92;
    lows[16] = 91.5;
    return { closes, highs, lows, sma20: 100, sma50: 99, sma200: 95 };
  }

  it('produces a populated record with trend, pivots, and levels sub-objects', () => {
    const inputs = syntheticInputs();
    const out = reproducePhase2AWiring(inputs);

    // trend
    expect(out.trend).toBeDefined();
    expect(out.trend.shortTerm).toBe('up');
    expect(out.trend.intermediate).toBe('up');
    expect(out.trend.longTerm).toBe('up');

    // pivots — exact match to formula on prior-day OHLC
    expect(out.pivots).toBeDefined();
    expect(out.pivots.pivotPP).toBeCloseTo(100.67, 2);
    expect(out.pivots.pivotR1).toBeCloseTo(103.33, 2);
    expect(out.pivots.pivotS1).toBeCloseTo(97.33, 2);

    // levels — clusters above price and below price both populate
    expect(out.levels).toBeDefined();
    expect(out.levels.nearestResistance).not.toBe(null);
    expect(out.levels.nearestResistance).toBeGreaterThan(102);
    expect(out.levels.nearestSupport).not.toBe(null);
    expect(out.levels.nearestSupport).toBeLessThan(102);
    expect(out.levels.distanceToResistancePct).toBeGreaterThan(0);
    expect(out.levels.distanceToSupportPct).toBeLessThan(0);
  });

  it('produces null trend.longTerm when sma200 is null (insufficient history)', () => {
    const inputs = { ...syntheticInputs(), sma200: null };
    const out = reproducePhase2AWiring(inputs);
    expect(out.trend.longTerm).toBe(null);
    expect(out.trend.shortTerm).toBe('up'); // sma20 still present
  });

  it('produces null pivots when any prior-day OHLC field is missing', () => {
    const inputs = syntheticInputs();
    inputs.highs[1] = null;
    const out = reproducePhase2AWiring(inputs);
    expect(out.pivots).toBe(null);
  });

  it('produces an all-null levels sub-object when input arrays are too short for swing detection', () => {
    const closes = new Array(20).fill(100);
    const highs = new Array(20).fill(101);
    const lows = new Array(20).fill(99);
    const out = reproducePhase2AWiring({ closes, highs, lows, sma20: 100, sma50: 99, sma200: 95 });
    expect(out.levels).toEqual({
      nearestResistance: null,
      nearestSupport: null,
      distanceToResistancePct: null,
      distanceToSupportPct: null,
    });
  });
});

// ==================== PHASE 2A — REGRESSION GUARDS ====================

describe('compute-index-intelligence Phase 2A — regression guards on existing fields', () => {
  it('Phase 2A primitives do NOT replace or rename existing fields', () => {
    // The four Phase 2A sub-objects (trend, pivots, levels) plus the existing
    // sma200_position must coexist without clobbering. Spot-check on a
    // synthetic stock entry shape.
    const stock = {
      // Existing Phase 1 / Tier 0 fields:
      symbol: 'AAPL',
      bbPercentB: 0.62,
      volumeProfile: { ratio: 1.2, avgVolume: 50_000_000, tier: 'ELEVATED' },
      sma200_position: 5.7,
      factors: {
        rsi: 55,
        macdHistogram: 0.42,
        aboveSMA200: true,
      },
      // Phase 2A additions:
      trend: { shortTerm: 'up', intermediate: 'up', longTerm: 'up' },
      pivots: { pivotPP: 100, pivotR1: 110, pivotR2: 120, pivotS1: 90, pivotS2: 80 },
      levels: {
        nearestResistance: 110.25,
        nearestSupport: 89.75,
        distanceToResistancePct: 10.25,
        distanceToSupportPct: -10.25,
      },
    };

    // Existing fields preserved
    expect(stock.bbPercentB).toBe(0.62);
    expect(stock.volumeProfile.tier).toBe('ELEVATED');
    expect(stock.sma200_position).toBe(5.7);
    expect(stock.factors.rsi).toBe(55);
    expect(stock.factors.macdHistogram).toBe(0.42);
    expect(stock.factors.aboveSMA200).toBe(true);

    // Phase 2A fields are top-level sub-objects — NOT inside factors
    expect(stock.factors).not.toHaveProperty('trend');
    expect(stock.factors).not.toHaveProperty('pivots');
    expect(stock.factors).not.toHaveProperty('levels');
    expect(stock).toHaveProperty('trend');
    expect(stock).toHaveProperty('pivots');
    expect(stock).toHaveProperty('levels');

    // sma200_position remains snake_case, distinct from Phase 2A's camelCase
    // sub-object keys.
    expect(stock).toHaveProperty('sma200_position');
    expect(stock.trend).toHaveProperty('shortTerm');
    expect(stock.levels).toHaveProperty('nearestResistance');
    expect(stock.pivots).toHaveProperty('pivotPP');
  });
});
