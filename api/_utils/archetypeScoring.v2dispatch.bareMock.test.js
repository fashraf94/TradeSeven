// api/_utils/archetypeScoring.v2dispatch.bareMock.test.js
//
// The V-15 hazard, kept executable: many suites vi.mock featureFlags.js with a
// BARE factory (no importOriginal spread), so ARCHETYPE_VECTORS_V2_ENABLED is
// simply not on the mock. The fenced engine must still take the V1 path — the
// V2 module reads the flag at call time through a namespace import inside
// try/catch and counts only `=== true`. A regression here would red every
// such suite on the day the fence entry landed.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/featureFlags.js', () => ({ SOME_UNRELATED_FLAG_ENABLED: false }));

import { computeArchetypeRankings } from './archetypeScoring.js';
import { isArchetypeVectorsV2Enabled } from './archetypeScoringV2.js';

describe('a bare featureFlags mock (no V2 export)', () => {
  it('reads as OFF and the engine takes the V1 path without throwing', () => {
    expect(isArchetypeVectorsV2Enabled()).toBe(false);
    const ranked = computeArchetypeRankings([
      { symbol: 'A', sectorName: 'Technology', fundamentalScore: 70, technicalScore: 60, baggerBombFit: 50, atrPercentile: 0.4, compositeScore: 65 },
      { symbol: 'B', sectorName: 'Energy', fundamentalScore: 40, technicalScore: 80, baggerBombFit: 70, atrPercentile: 0.6, compositeScore: 55 },
    ], 'analyst');
    expect(ranked.map((r) => r.symbol)).toEqual(['A', 'B']);
    expect(ranked[0]).not.toHaveProperty('archetypeBaseScore');
  });
});
