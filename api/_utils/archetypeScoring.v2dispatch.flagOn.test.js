// api/_utils/archetypeScoring.v2dispatch.flagOn.test.js
//
// The fenced dispatch line under the flag-ON state (the flip PR's world),
// exercised through a featureFlags mock that spreads the original module —
// proves the one dispatch line routes to V2 and that V2 fails closed (P-5,
// P-14). No literal pin of the flag appears here: the flag-pin guard reads
// source text and the live value is false.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ARCHETYPE_VECTORS_V2_ENABLED: true,
}));

import { computeArchetypeRankings } from './archetypeScoring.js';

const stock = (symbol, sectorName, fundamentalScore, technicalScore, momentumScore) => ({
  symbol, sectorName, fundamentalScore, technicalScore, momentumScore, atrPercentile: 0.4,
  techRaw: { rsi: 50, bbPercentB: 0.5, distTo52wkHigh: 3, atrPercent: 2 },
  return1W: 1, return1M: 2, return3M: 3, sma200_position: 4, baggerBombFit: 60,
});
const fixture = () => [
  stock('AAPL', 'Technology', 75, 80, 70),
  stock('JNJ', 'Healthcare', 85, 50, 40),
  stock('XOM', 'Energy', 65, 60, 55),
];

describe('computeArchetypeRankings with ARCHETYPE_VECTORS_V2_ENABLED mocked true', () => {
  it('dispatches to V2: gameMode is required, the V2 shape comes back, unknown archetypes throw', () => {
    expect(() => computeArchetypeRankings(fixture(), 'analyst')).toThrow(/archetype_game_mode_required/);
    expect(() => computeArchetypeRankings(fixture(), 'analyst', { gameMode: 'mandate' })).toThrow(/archetype_game_mode_required/);
    expect(() => computeArchetypeRankings(fixture(), 'copycat', { gameMode: 'scouting' })).toThrow(/archetype_unknown/);
    const ranked = computeArchetypeRankings(fixture(), 'analyst', { gameMode: 'scouting', minCandidates: 1, onEvent: () => {} });
    expect(ranked).toHaveLength(3);
    for (const row of ranked) {
      expect(row).toHaveProperty('archetypeBaseScore');
      expect(row).toHaveProperty('axes');
      expect(row.archetypeScore).toBe(row.archetypeBaseScore);
    }
    // analyst = .5·quality + .3·strength + .2·persistence; strengths 100/0/50 for tech 80/50/60:
    // AAPL 37.5+30+14 = 81.5 · XOM 32.5+15+11 = 58.5 · JNJ 42.5+0+8 = 50.5
    expect(ranked.map((r) => [r.symbol, r.archetypeBaseScore])).toEqual([['AAPL', 81.5], ['XOM', 58.5], ['JNJ', 50.5]]);
  });
});
