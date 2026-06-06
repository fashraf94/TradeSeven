// src/components/Search/screenerAdapter.test.js
//
// Research Engine — Phase 3 unit tests for the RankRow presentation adapter.
// Pure, no DOM. Covers: dot-path resolution, rankBy→type color mapping, headline
// scaling (incl. the 0–1 fields and arch_scores), row projection + maxScore, the
// plain-language spec line, and rejectedFilters → caveat lines.

import { describe, it, expect } from 'vitest';
import {
  resolveRankValue,
  rankFieldToType,
  headlineValue,
  buildRankRows,
  specToPlainLanguage,
  rejectedFiltersToLines,
  TYPE_TO_SCORE_KEY,
} from './screenerAdapter.js';

// A projected result like screenStocks emits: baseline scalars + a nested
// arch_scores namespace (present when the screen ranked by arch_scores.*).
function makeResult(overrides = {}) {
  return {
    symbol: 'NVDA',
    sectorName: 'Technology',
    compositeScore: 91.2,
    baggerBombFit: 80,
    momentumScore: 88,
    ...overrides,
  };
}

describe('resolveRankValue', () => {
  it('reads a flat field', () => {
    expect(resolveRankValue(makeResult(), 'momentumScore')).toBe(88);
  });
  it('reads a one-hop dot-path', () => {
    const r = makeResult({ arch_scores: { degen: 73.4 } });
    expect(resolveRankValue(r, 'arch_scores.degen')).toBe(73.4);
  });
  it('returns null for a missing flat field, missing namespace, or missing sub-key', () => {
    expect(resolveRankValue(makeResult(), 'technicalScore')).toBeNull();
    expect(resolveRankValue(makeResult(), 'arch_scores.degen')).toBeNull();
    expect(resolveRankValue(makeResult({ arch_scores: {} }), 'arch_scores.degen')).toBeNull();
  });
  it('handles null inputs without throwing', () => {
    expect(resolveRankValue(null, 'x')).toBeNull();
    expect(resolveRankValue(makeResult(), '')).toBeNull();
  });
});

describe('rankFieldToType', () => {
  it('maps the five known score fields', () => {
    expect(rankFieldToType('compositeScore')).toBe('composite');
    expect(rankFieldToType('baggerBombFit')).toBe('baggerBomb');
    expect(rankFieldToType('momentumScore')).toBe('momentum');
    expect(rankFieldToType('fundamentalScore')).toBe('fundamental');
    expect(rankFieldToType('technicalScore')).toBe('technical');
  });
  it('falls back to neutral composite for open-ended fields', () => {
    expect(rankFieldToType('arch_scores.degen')).toBe('composite');
    expect(rankFieldToType('momentumFactors.heat')).toBe('composite');
    expect(rankFieldToType('fundamentalRank')).toBe('composite');
    expect(rankFieldToType('atrPercentile')).toBe('composite');
  });
});

describe('headlineValue', () => {
  it('passes 0–100 scores through unrounded', () => {
    expect(headlineValue(makeResult(), 'compositeScore')).toBe(91.2);
  });
  it('treats arch_scores (already 0–100) without scaling', () => {
    const r = makeResult({ arch_scores: { degen: 73.4 } });
    expect(headlineValue(r, 'arch_scores.degen')).toBe(73.4);
  });
  it('scales the documented 0–1 fields ×100', () => {
    expect(headlineValue({ atrPercentile: 0.82 }, 'atrPercentile')).toBeCloseTo(82);
    expect(headlineValue({ bBandwidthPercentile: 0.5 }, 'bBandwidthPercentile')).toBeCloseTo(50);
  });
  it('coerces null / non-numeric to 0', () => {
    expect(headlineValue(makeResult(), 'technicalScore')).toBe(0);
    expect(headlineValue({ trend: 'up' }, 'trend')).toBe(0);
  });
});

describe('buildRankRows', () => {
  it('injects the headline into the type score key and computes maxScore', () => {
    const results = [
      makeResult({ symbol: 'A', baggerBombFit: 80 }),
      makeResult({ symbol: 'B', baggerBombFit: 60 }),
    ];
    const spec = { rankBy: { field: 'baggerBombFit', direction: 'desc' }, limit: 10 };
    const { rows, maxScore, type } = buildRankRows(results, spec);

    expect(type).toBe('baggerBomb');
    expect(maxScore).toBe(80);
    expect(rows).toHaveLength(2);
    // headline lives under the score key RankRow will read for this type.
    expect(rows[0].stock[TYPE_TO_SCORE_KEY.baggerBomb]).toBe(80);
    expect(rows[1].stock[TYPE_TO_SCORE_KEY.baggerBomb]).toBe(60);
  });

  it('projects an arch_scores ranking into the neutral composite score key', () => {
    const results = [
      makeResult({ symbol: 'A', arch_scores: { degen: 70 } }),
      makeResult({ symbol: 'B', arch_scores: { degen: 40 } }),
    ];
    const spec = { rankBy: { field: 'arch_scores.degen', direction: 'desc' }, limit: 10 };
    const { rows, type, maxScore } = buildRankRows(results, spec);

    expect(type).toBe('composite');
    expect(maxScore).toBe(70);
    expect(rows[0].stock[TYPE_TO_SCORE_KEY.composite]).toBe(70);
  });

  it('defaults to compositeScore when no rankBy is present, and never divides by zero', () => {
    const { type, maxScore, rows } = buildRankRows([], null);
    expect(type).toBe('composite');
    expect(maxScore).toBe(1); // Math.max(...[], 1)
    expect(rows).toEqual([]);
  });
});

describe('specToPlainLanguage', () => {
  it('renders a sector filter ranked by a score with a limit', () => {
    const spec = {
      filters: [{ field: 'sectorName', op: 'eq', value: 'Financials' }],
      rankBy: { field: 'compositeScore', direction: 'desc' },
      limit: 10,
    };
    expect(specToPlainLanguage(spec)).toBe('Financials · ranked by composite score · top 10');
  });

  it('names an archetype rankBy via the display name and an NR7 flag filter', () => {
    const spec = {
      filters: [{ field: 'nr7Flag', op: 'isTrue' }],
      rankBy: { field: 'arch_scores.degen', direction: 'desc' },
      limit: 5,
    };
    expect(specToPlainLanguage(spec)).toBe('NR7 (tight) setup · ranked by Speculator fit · top 5');
  });

  it('says "All stocks" when there are no filters, and renders excludes', () => {
    expect(
      specToPlainLanguage({ filters: [], rankBy: { field: 'momentumScore' }, limit: 10 }),
    ).toBe('All stocks · ranked by momentum · top 10');
    expect(
      specToPlainLanguage({ filters: [{ field: 'sectorName', op: 'neq', value: 'Energy' }] }),
    ).toBe('excluding Energy');
  });

  it('returns empty string for a null spec', () => {
    expect(specToPlainLanguage(null)).toBe('');
  });
});

describe('rejectedFiltersToLines', () => {
  it('reuses the server detail strings and drops malformed entries', () => {
    const rejected = [
      { scope: 'filter', field: 'price', reason: 'field_not_allowed', detail: "Field 'price' is not in the screening allowlist" },
      { scope: 'filter', field: 'x', reason: 'malformed_predicate' }, // no detail
      null,
    ];
    expect(rejectedFiltersToLines(rejected)).toEqual([
      "Field 'price' is not in the screening allowlist",
    ]);
  });
  it('returns [] for a non-array', () => {
    expect(rejectedFiltersToLines(undefined)).toEqual([]);
  });
});
