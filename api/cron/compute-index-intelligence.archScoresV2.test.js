// api/cron/compute-index-intelligence.archScoresV2.test.js
//
// Archetype Rank Interface V2 — spec §5 test 9: the persisted arch_scores_v2
// is the V2 archetypeBaseScore with NO baggerBombFit contribution (hold
// baggerBombFit varying, output fixed), while the v1 arch_scores beside it —
// which blends baggerBombFit at 0.10–0.30 — moves (the control that proves the
// row can fail). Style-A: the real exported helper, zero mocks.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL import of the cron module
// is the runtime guard for its api→src edge into archetypeScoringV2.js →
// featureFlags.js. NEVER mock it.

import { describe, it, expect } from 'vitest';
import { attachArchScoresV2 } from './compute-index-intelligence.js';
import { computeArchetypeRankings } from '../_utils/archetypeScoring.js';
import { computeArchetypeRankingsV2 } from '../_utils/archetypeScoringV2.js';
import { deriveAxes, computeUniverseMedianReturn1W } from '../_utils/axisDerivation.js';

const ARCHETYPES = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

function entry(symbol, sectorName, fundamentalScore, technicalScore, momentumScore, atrPercentile, baggerBombFit, ret) {
  return {
    symbol, sectorName, fundamentalScore, technicalScore, momentumScore, atrPercentile, baggerBombFit,
    compositeScore: 60,
    techRaw: { rsi: 50, bbPercentB: 0.5, distTo52wkHigh: 5, atrPercent: 2 },
    return1W: ret[0], return1M: ret[1], return3M: ret[2], sma200_position: ret[3],
  };
}
// Persisted-shape universe AFTER the producer's axes attach (the state attachArchScoresV2 runs on).
function universe(bbFit = (i) => 40 + i * 5) {
  const raw = [
    entry('AAPL', 'Technology', 75, 80, 70, 0.4, bbFit(0), [1.2, -2.0, 6.0, 4.0]),
    entry('MSFT', 'Technology', 82, 70, 60, 0.35, bbFit(1), [0.4, 1.5, 9.0, 7.0]),
    entry('GOOG', 'Technology', 70, 65, 50, 0.3, bbFit(2), [-0.5, -6.0, -3.0, -2.0]),
    entry('NVDA', 'Technology', 60, 95, 90, 0.85, bbFit(3), [3.0, 12.0, 30.0, 25.0]),
    entry('AMD', 'Technology', 55, 78, 75, 0.7, bbFit(4), [2.0, 4.0, 8.0, 3.0]),
    entry('JNJ', 'Healthcare', 85, 50, 40, 0.2, bbFit(5), [-0.2, -1.0, 2.0, 1.0]),
    entry('XOM', 'Energy', 65, 60, 55, 0.55, bbFit(6), [-1.0, -4.0, -7.0, -5.0]),
    entry('NOFUND', 'Utilities', null, 55, 45, 0.5, bbFit(7), [0.1, 0.2, 0.3, 0.4]),
  ];
  const axes = deriveAxes(raw);
  return raw.map((s, i) => ({ ...s, axes: axes[i] }));
}

// The cron's v1 attach block, reproduced verbatim (compute-index-intelligence.test.js precedent).
function attachArchScoresV1(rankingStocks) {
  const by = {};
  for (const archetype of ARCHETYPES) {
    for (const s of computeArchetypeRankings(rankingStocks, archetype, { gameMode: 'standard' })) {
      if (!by[s.symbol]) by[s.symbol] = {};
      by[s.symbol][archetype] = s.archetypeScore;
    }
  }
  for (const stock of rankingStocks) stock.arch_scores = by[stock.symbol] || {};
}

describe('attachArchScoresV2 — the persisted V2 base score (test 9)', () => {
  it('equals computeArchetypeRankingsV2(...).archetypeBaseScore under gameMode standard for every (symbol, archetype)', () => {
    const u = universe();
    const median = computeUniverseMedianReturn1W(u);
    const { archetypePostFilterCounts, events } = attachArchScoresV2(u, { universeMedianReturn1W: median });
    for (const archetype of ARCHETYPES) {
      const independent = computeArchetypeRankingsV2(universe(), archetype, { gameMode: 'standard', universeMedianReturn1W: median, onEvent: () => {} });
      expect(archetypePostFilterCounts[archetype]).toBe(independent.length);
      for (const s of independent) {
        expect(u.find((x) => x.symbol === s.symbol).arch_scores_v2[archetype]).toBe(s.archetypeBaseScore);
      }
    }
    expect(Array.isArray(events)).toBe(true);
    // 8 names < the standard-mode minimum of 35 ⇒ one coverage event per archetype (what the snapshot records)
    expect(events.filter((e) => e.type === 'insufficient_axis_coverage').map((e) => e.archetype).sort()).toEqual([...ARCHETYPES].sort());
  });

  it('holds baggerBombFit varying while arch_scores_v2 stays fixed — and the v1 arch_scores beside it moves (control)', () => {
    const a = universe((i) => 40 + i * 5);
    const b = universe((i) => 90 - i * 7);
    const c = universe(() => null);
    for (const x of [a, b, c]) { attachArchScoresV2(x); attachArchScoresV1(x); }
    const v2 = (x) => x.map((s) => [s.symbol, s.arch_scores_v2]);
    expect(v2(b)).toEqual(v2(a));
    expect(v2(c)).toEqual(v2(a));
    const v1 = (x) => x.map((s) => [s.symbol, s.arch_scores]);
    expect(v1(b)).not.toEqual(v1(a));
  });

  it('an excluded name carries NO key for that archetype (never null, never a number); included names carry a 1-dp number in [0, 100]', () => {
    const u = universe();
    attachArchScoresV2(u);
    const nofund = u.find((s) => s.symbol === 'NOFUND').arch_scores_v2;
    expect(Object.keys(nofund).sort()).toEqual(['degen', 'momentum_chaser']);
    expect(nofund).not.toHaveProperty('analyst');
    for (const s of u) {
      for (const [archetype, v] of Object.entries(s.arch_scores_v2)) {
        expect(ARCHETYPES).toContain(archetype);
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
        expect(Math.round(v * 10) / 10).toBe(v);
      }
    }
  });

  it('does not write or disturb arch_scores (v1) and leaves the entry shape otherwise untouched', () => {
    const u = universe();
    attachArchScoresV1(u);
    const before = JSON.stringify(u.map((s) => s.arch_scores));
    attachArchScoresV2(u);
    expect(JSON.stringify(u.map((s) => s.arch_scores))).toBe(before);
    expect(u[0]).toHaveProperty('arch_scores_v2');
    expect(u[0]).toHaveProperty('axes');
  });
});
