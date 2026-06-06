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
  buildReturnRows,
  isReturnField,
  formatSignedPercent,
  returnColor,
  RETURN_FIELDS,
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

// ==================== CONVERSATIONAL PERFORMANCE (returns) ====================

describe('isReturnField / RETURN_FIELDS', () => {
  it('recognizes exactly the five return fields', () => {
    expect([...RETURN_FIELDS].sort()).toEqual(
      ['return12M', 'return1M', 'return1W', 'return3M', 'returnYTD'].sort(),
    );
    for (const f of ['return1W', 'return1M', 'return3M', 'returnYTD', 'return12M']) {
      expect(isReturnField(f)).toBe(true);
    }
  });
  it('is false for score fields and dot-paths', () => {
    expect(isReturnField('compositeScore')).toBe(false);
    expect(isReturnField('momentumScore')).toBe(false);
    expect(isReturnField('arch_scores.degen')).toBe(false);
    expect(isReturnField(undefined)).toBe(false);
  });
});

describe('formatSignedPercent', () => {
  it('prefixes a + on non-negatives and keeps the native sign on negatives, one decimal', () => {
    expect(formatSignedPercent(12.4)).toBe('+12.4%');
    expect(formatSignedPercent(-3.1)).toBe('-3.1%');
    expect(formatSignedPercent(0)).toBe('+0.0%');
  });
  it('trims a stored 2-dp value to one decimal', () => {
    expect(formatSignedPercent(12.44)).toBe('+12.4%');
    expect(formatSignedPercent(-3.15)).toBe('-3.1%'); // toFixed(1) rounds -3.15 → -3.1
  });
  it('renders a dash for null / non-finite', () => {
    expect(formatSignedPercent(null)).toBe('—');
    expect(formatSignedPercent(undefined)).toBe('—');
    expect(formatSignedPercent(NaN)).toBe('—');
  });
  it('never emits a contradictory "-0.0%" for a tiny loss that rounds to zero', () => {
    expect(formatSignedPercent(-0.04)).toBe('+0.0%');
    expect(formatSignedPercent(-0)).toBe('+0.0%');
  });
});

describe('returnColor', () => {
  const tokens = { emerald: '#34d399', red: '#ef4444', textFaint: '#6b7280' };
  it('maps up → emerald, down → red, null → muted (theme-aware via tokens)', () => {
    expect(returnColor(5, tokens)).toBe('#34d399');
    expect(returnColor(0, tokens)).toBe('#34d399'); // 0 counts as up (>= 0)
    expect(returnColor(-2, tokens)).toBe('#ef4444');
    expect(returnColor(null, tokens)).toBe('#6b7280');
  });
  it('falls back to dark-theme hexes when tokens is absent', () => {
    expect(returnColor(5)).toBe('#34d399');
    expect(returnColor(-5)).toBe('#ef4444');
  });
});

describe('buildReturnRows', () => {
  it('resolves signed returns raw (no scaling), preserves null, and max-abs normalizes', () => {
    const results = [
      makeResult({ symbol: 'NVDA', return1W: 4.2 }),
      makeResult({ symbol: 'XYZ', return1W: -2.5 }),
      makeResult({ symbol: 'NUL', return1W: null }),
    ];
    const spec = { rankBy: { field: 'return1W', direction: 'desc' }, limit: 10 };
    const { rows, maxAbs, field } = buildReturnRows(results, spec);

    expect(field).toBe('return1W');
    expect(rows.map((r) => r.value)).toEqual([4.2, -2.5, null]); // raw, null preserved
    expect(maxAbs).toBe(4.2);
    // the stock is carried through untouched (no headline injection)
    expect(rows[0].stock.symbol).toBe('NVDA');
  });

  it('max-abs comes from the largest magnitude even when it is negative (all-down set)', () => {
    const results = [
      makeResult({ symbol: 'A', return1M: -3 }),
      makeResult({ symbol: 'B', return1M: -30 }),
    ];
    const { maxAbs } = buildReturnRows(results, { rankBy: { field: 'return1M', direction: 'asc' } });
    expect(maxAbs).toBe(30); // not Math.max(-3, -30, 1) === 1
  });

  it('empty / all-null sets yield maxAbs 0 (caller guards the divide)', () => {
    expect(buildReturnRows([], { rankBy: { field: 'return3M' } }).maxAbs).toBe(0);
    const allNull = buildReturnRows(
      [makeResult({ symbol: 'A', return3M: null })],
      { rankBy: { field: 'return3M' } },
    );
    expect(allNull.maxAbs).toBe(0);
    expect(allNull.rows[0].value).toBeNull();
  });
});

describe('specToPlainLanguage — return label', () => {
  it('names a return rankBy in plain language', () => {
    expect(
      specToPlainLanguage({
        filters: [{ field: 'sectorName', op: 'eq', value: 'Technology' }],
        rankBy: { field: 'return1W', direction: 'desc' },
        limit: 10,
      }),
    ).toBe('Technology · ranked by 1-week return · top 10');
  });
});
