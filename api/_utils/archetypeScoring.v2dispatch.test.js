// api/_utils/archetypeScoring.v2dispatch.test.js
//
// Archetype Rank Interface V2 — spec §5 test 6: the flag-off byte-identity
// snapshot of computeArchetypeRankings (the V1 path), the P-2 fenced-entry
// tripwire (exactly three lines), and the ARCHETYPE_VECTORS_V2_ENABLED pin.
//
// The golden was recorded from the UNPATCHED fenced engine at Phase A HEAD
// (613da8d8) — before the P-2 entry existed — so this file proves the entry
// changed nothing while the flag is off. The pre-entry sha256 of the whole
// fenced file is recorded for the same reason: strip the three sanctioned
// lines and the file must hash back to it.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): REAL imports of the fenced engine,
// the V2 module and featureFlags.js — never mock them here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeArchetypeRankings,
  ARCHETYPE_WEIGHTS,
  ARCHETYPE_TEMPERATURES,
  ARCHETYPE_CONSTRAINTS,
} from './archetypeScoring.js';
import { canonicalContentHash } from './canonicalHash.js';
import { ARCHETYPE_VECTORS_V2_ENABLED } from '../../src/config/featureFlags.js';
import { maybeComputeArchetypeRankingsV2, isArchetypeVectorsV2Enabled } from './archetypeScoringV2.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FENCED = path.join(HERE, 'archetypeScoring.js');
const ARCHETYPES = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

// Recorded at Phase A HEAD 613da8d8 from the unpatched engine (scratchpad golden.mjs).
const V1_GOLDEN_HASH = '6776c931f22e756033173daa1794dfe7f42025c1b78d035923523eb088bb9da2';
const V1_GOLDEN_TOP3 = {
  momentum_chaser: ['NVDA:89.3', 'AMD:74', 'AAPL:66.8'],
  contrarian: ['NVDA:53.8', 'AMD:53.3', 'XOM:48.7'],
  diversifier: ['XOM:64', 'JNJ:63.3', 'NVDA:56.3'],
  degen: ['NVDA:87.8', 'AMD:72.5', 'AAPL:53.5'],
  analyst: ['NVDA:70.3', 'AAPL:66.5', 'MSFT:64.6'],
  guardian: ['JNJ:68', 'XOM:66.8', 'NVDA:50.3'],
};
const PRE_ENTRY_FILE_SHA256 = '26d4aa1b6bf02a8bf1708567fe8d8a6e4a4e9d26d8c2cec83c28de195c8a27b2';

const IMPORT_LINE = "import { maybeComputeArchetypeRankingsV2 } from './archetypeScoringV2.js';\n";
const ENTRY_SIGNATURE = 'export function computeArchetypeRankings(stocks, archetype, opts = {}) {\n';
const DISPATCH_LINE = '  const v2 = maybeComputeArchetypeRankingsV2(stocks, archetype, opts); if (v2) return v2;\n';
const V1_SIGNATURE = 'export function computeArchetypeRankings(stocks, archetype) {\n';

// The 7-stock synthetic universe of compute-index-intelligence.test.js.
const s = (symbol, sectorName, fundamentalScore, technicalScore, baggerBombFit, atrPercentile, compositeScore) =>
  ({ symbol, sectorName, fundamentalScore, technicalScore, baggerBombFit, atrPercentile, compositeScore });
const fixture = () => [
  s('AAPL', 'Technology', 75, 80, 70, 0.4, 78),
  s('MSFT', 'Technology', 82, 70, 60, 0.35, 80),
  s('GOOG', 'Technology', 70, 65, 55, 0.3, 72),
  s('NVDA', 'Technology', 60, 95, 90, 0.85, 88),
  s('AMD', 'Technology', 55, 78, 75, 0.7, 70),
  s('JNJ', 'Healthcare', 85, 50, 35, 0.2, 75),
  s('XOM', 'Energy', 65, 60, 45, 0.55, 62),
];

describe('ARCHETYPE_VECTORS_V2_ENABLED — dark by design (V-15)', () => {
  it('ships false; the V2 module reads it as off', () => {
    expect(ARCHETYPE_VECTORS_V2_ENABLED).toBe(false);
    expect(isArchetypeVectorsV2Enabled()).toBe(false);
  });
});

describe('flag-off byte-identity snapshot (test 6)', () => {
  it('the V1 path reproduces the pre-entry golden for all six archetypes — with or without the new opts parameter', () => {
    const results = ARCHETYPES.map((a) => computeArchetypeRankings(fixture(), a));
    expect(canonicalContentHash(results)).toBe(V1_GOLDEN_HASH);
    const withOpts = ARCHETYPES.map((a) => computeArchetypeRankings(fixture(), a, { gameMode: 'standard', universeSize: 7, minCandidates: 1 }));
    expect(canonicalContentHash(withOpts)).toBe(V1_GOLDEN_HASH);
    ARCHETYPES.forEach((a, i) => {
      expect(results[i].slice(0, 3).map((r) => `${r.symbol}:${r.archetypeScore}`)).toEqual(V1_GOLDEN_TOP3[a]);
    });
  });

  it('V1 objects carry no V2 field; the dispatch target returns null while dark', () => {
    for (const row of computeArchetypeRankings(fixture(), 'analyst')) {
      expect(row).not.toHaveProperty('archetypeBaseScore');
      expect(row).not.toHaveProperty('axes');
      expect(typeof row.archetypeScore).toBe('number');
    }
    expect(maybeComputeArchetypeRankingsV2(fixture(), 'analyst', { gameMode: 'standard' })).toBeNull();
    // Dark ⇒ V1's silent analyst fallback for an unknown archetype is still the behavior (P-14 lands at flip).
    expect(computeArchetypeRankings(fixture(), 'copycat').map((r) => r.symbol))
      .toEqual(computeArchetypeRankings(fixture(), 'analyst').map((r) => r.symbol));
  });

  it('the three V1 tables are untouched (the calibration-bundle hash lock and the registry snapshot lock also cover them)', () => {
    expect(Object.keys(ARCHETYPE_WEIGHTS)).toEqual(ARCHETYPES);
    expect(ARCHETYPE_WEIGHTS.analyst).toEqual({ fundamentalScore: 0.40, technicalScore: 0.30, baggerBombFit: 0.15, atrPercentile: 0.05, inverseComposite: 0.00, sectorDiversity: 0.10 });
    expect(ARCHETYPE_TEMPERATURES.degen).toEqual({ sonnet: 0.9, haiku: 0.8 });
    expect(ARCHETYPE_CONSTRAINTS.analyst).toMatch(/fundamentalScore below 40/);
  });
});

describe('the P-2 fenced entry — exactly three lines, nothing else (BUILD_RULES §1)', () => {
  const src = readFileSync(FENCED, 'utf8');

  it('one import, one parameter, one dispatch line', () => {
    expect(src.split(IMPORT_LINE).length - 1).toBe(1);
    expect(src).toContain(ENTRY_SIGNATURE + DISPATCH_LINE + '  const weights = ARCHETYPE_WEIGHTS[archetype] || ARCHETYPE_WEIGHTS.analyst;\n');
    expect(src.match(/^import /gm)).toHaveLength(1);
    expect(src.match(/maybeComputeArchetypeRankingsV2/g)).toHaveLength(2);
    expect(src).not.toMatch(/featureFlags|ARCHETYPE_VECTORS_V2_ENABLED|axisDerivation/);
  });

  it('stripping the three sanctioned lines restores the pre-entry file byte-for-byte (sha256)', () => {
    const restored = src
      .replace(IMPORT_LINE, '')
      .replace(ENTRY_SIGNATURE + DISPATCH_LINE, V1_SIGNATURE);
    expect(createHash('sha256').update(restored).digest('hex')).toBe(PRE_ENTRY_FILE_SHA256);
  });
});
