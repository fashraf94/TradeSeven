// api/_utils/screenStocks.test.js
//
// Research Engine — Phase 1 unit tests for the deterministic filter core.
// Covers: allowlist constants, isAllowedField / resolveField / evaluateOp, empty-filter
// rank-only, multi-filter AND, archetype rankBy, absent-field / invalid-rankBy / bad-
// direction / unsupported-op rejection, limit clamp/slice, null handling, projection
// completeness, namespace merge, no-dotted-keys, empty universe, metadata, determinism.

import { describe, it, expect } from 'vitest';
import {
  screenStocks,
  screenIndustries,
  ROLLUP_RANK_FIELDS,
  isAllowedField,
  resolveField,
  evaluateOp,
  canonicalizeSector,
  canonicalizeIndustry,
  ARCH_KEYS,
  MOMENTUM_KEYS,
  SCALAR_FIELDS,
  SUPPORTED_OPS,
  BASELINE_FIELDS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_FILTERS,
  MAX_IN_VALUES,
} from './screenStocks.js';

// ==================== FIXTURES ====================
// Five stocks shaped like the persisted entry (compute-index-intelligence.js:944-988 +
// arch_scores at :1015). Deliberately includes an "unranked" stock (momentumFactors:null,
// arch_scores:{}) and an all-null stock to exercise the null/missing branches.
function makeStocks() {
  return [
    {
      symbol: 'NVDA', sectorId: 'XLK', sectorName: 'Technology',
      fundamentalScore: 88, fundamentalRank: 2,
      technicalScore: 90, technicalRank: 1, sectorTechnicalRank: 1, sectorTechnicalTotal: 30,
      compositeScore: 92, baggerBombFit: 95, baggerBombRank: 1,
      atrPercentile: 0.88, dailyRange: 5.2, nr7Flag: false, bBandwidthPercentile: 0.7,
      momentumScore: 80, momentumRank: 1, sma200_position: 12.5, trend: 'up', recentAction: 'breakout',
      return1W: 4.2, return1M: 12.4, return3M: 25.0, returnYTD: 40.0, return12M: 80.0,
      momentumFactors: {
        residualMomentum: 1.2, intermediateRS: 0.9, acceleration: 0.5, turnoverMom: 0.3,
        fip: 0.1, ker: 0.6, stability: 70, heat: 85, quality: 75,
        overextensionPenalty: -0.2, momentumBreakPenalty: 0, peadAdjustment: 0.1,
      },
      arch_scores: { momentum_chaser: 88, contrarian: 30, diversifier: 40, degen: 70, analyst: 80, guardian: 50 },
    },
    {
      symbol: 'AAPL', sectorId: 'XLK', sectorName: 'Technology',
      fundamentalScore: 80, fundamentalRank: 5,
      technicalScore: 75, technicalRank: 8, sectorTechnicalRank: 4, sectorTechnicalTotal: 30,
      compositeScore: 78, baggerBombFit: 60, baggerBombRank: 12,
      atrPercentile: 0.45, dailyRange: 2.1, nr7Flag: true, bBandwidthPercentile: 0.3,
      momentumScore: 55, momentumRank: 20, sma200_position: 4.0, trend: 'up', recentAction: 'consolidating',
      return1W: 1.1, return1M: 3.2, return3M: 8.0, returnYTD: 15.0, return12M: 30.0,
      momentumFactors: {
        residualMomentum: 0.4, intermediateRS: 0.3, acceleration: 0.1, turnoverMom: 0.2,
        fip: 0.05, ker: 0.4, stability: 60, heat: 50, quality: 65,
        overextensionPenalty: 0, momentumBreakPenalty: 0, peadAdjustment: 0,
      },
      arch_scores: { momentum_chaser: 55, contrarian: 50, diversifier: 60, degen: 40, analyst: 70, guardian: 65 },
    },
    {
      // "Unranked": has a composite but no momentum/arch data — the :952 / :993 edge.
      symbol: 'XYZ', sectorId: 'XLK', sectorName: 'Technology',
      fundamentalScore: 50, fundamentalRank: 30,
      technicalScore: 40, technicalRank: 40, sectorTechnicalRank: 12, sectorTechnicalTotal: 30,
      compositeScore: 45, baggerBombFit: null, baggerBombRank: undefined,
      atrPercentile: 0.20, dailyRange: 1.0, nr7Flag: false, bBandwidthPercentile: 0.1,
      momentumScore: null, momentumRank: null, sma200_position: -3.0, trend: 'down', recentAction: 'breakdown',
      return1W: -2.5, return1M: -8.0, return3M: 5.0, returnYTD: -3.0, return12M: 10.0,
      momentumFactors: null,
      arch_scores: {},
    },
    {
      // All-null composite — must be EXCLUDED by a composite filter and sort LAST.
      symbol: 'NULLCO', sectorId: 'XLF', sectorName: 'Financials',
      fundamentalScore: null, fundamentalRank: null,
      technicalScore: null, technicalRank: null, sectorTechnicalRank: null, sectorTechnicalTotal: null,
      compositeScore: null, baggerBombFit: null,
      atrPercentile: null, dailyRange: null, nr7Flag: false, bBandwidthPercentile: null,
      momentumScore: null, momentumRank: null, sma200_position: null, trend: null, recentAction: null,
      return1W: null, return1M: null, return3M: null, returnYTD: null, return12M: null,
      momentumFactors: null,
      arch_scores: {},
    },
    {
      symbol: 'XOM', sectorId: 'XLE', sectorName: 'Energy',
      fundamentalScore: 70, fundamentalRank: 10,
      technicalScore: 65, technicalRank: 15, sectorTechnicalRank: 3, sectorTechnicalTotal: 22,
      compositeScore: 68, baggerBombFit: 72, baggerBombRank: 6,
      atrPercentile: 0.60, dailyRange: 3.0, nr7Flag: true, bBandwidthPercentile: 0.5,
      momentumScore: 62, momentumRank: 9, sma200_position: 8.0, trend: 'up', recentAction: 'pullback',
      return1W: 0.5, return1M: -1.5, return3M: -10.0, returnYTD: 6.0, return12M: -5.0,
      momentumFactors: {
        residualMomentum: 0.7, intermediateRS: 0.6, acceleration: 0.2, turnoverMom: 0.25,
        fip: 0.08, ker: 0.5, stability: 65, heat: 60, quality: 55,
        overextensionPenalty: -0.1, momentumBreakPenalty: 0, peadAdjustment: 0.05,
      },
      arch_scores: { momentum_chaser: 62, contrarian: 55, diversifier: 70, degen: 45, analyst: 60, guardian: 58 },
    },
  ];
}

const symbolsOf = (out) => out.results.map(r => r.symbol);

// ==================== 1. ALLOWLIST CONSTANTS ====================

describe('allowlist constants', () => {
  it('ARCH_KEYS holds exactly the 6 archetype keys, frozen', () => {
    expect(ARCH_KEYS).toEqual([
      'momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian',
    ]);
    expect(Object.isFrozen(ARCH_KEYS)).toBe(true);
  });

  it('MOMENTUM_KEYS holds exactly the 12 momentumFactors keys, frozen', () => {
    expect(MOMENTUM_KEYS).toHaveLength(12);
    expect(MOMENTUM_KEYS).toContain('heat');
    expect(MOMENTUM_KEYS).toContain('quality');
    expect(MOMENTUM_KEYS).toContain('peadAdjustment');
    expect(Object.isFrozen(MOMENTUM_KEYS)).toBe(true);
  });

  it('SCALAR_FIELDS membership + frozen', () => {
    expect(SCALAR_FIELDS.has('nr7Flag')).toBe(true);
    expect(SCALAR_FIELDS.has('baggerBombRank')).toBe(true);
    expect(SCALAR_FIELDS.has('compositeScore')).toBe(true);
    expect(SCALAR_FIELDS.has('industryName')).toBe(true); // Phase 1 — filterable industry dimension
    expect(SCALAR_FIELDS.has('pe_ratio')).toBe(false);
    expect(SCALAR_FIELDS.has('compositeRank')).toBe(false); // explicitly-absent field
    expect(Object.isFrozen(SCALAR_FIELDS)).toBe(true);
  });

  it('SUPPORTED_OPS + BASELINE_FIELDS + limits', () => {
    expect([...SUPPORTED_OPS]).toEqual(
      expect.arrayContaining(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in', 'between', 'isTrue', 'isFalse']),
    );
    expect(BASELINE_FIELDS).toEqual(['symbol', 'sectorName', 'industryName', 'compositeScore', 'baggerBombFit', 'momentumScore']);
    expect(DEFAULT_LIMIT).toBe(10);
    expect(MAX_LIMIT).toBe(25);
  });
});

// ==================== 2. isAllowedField ====================

describe('isAllowedField', () => {
  it('accepts scalars and valid dot-paths', () => {
    expect(isAllowedField('compositeScore')).toBe(true);
    expect(isAllowedField('arch_scores.degen')).toBe(true);
    expect(isAllowedField('momentumFactors.heat')).toBe(true);
  });

  it('rejects bare namespaces, bogus sub-keys, unknown fields and junk', () => {
    expect(isAllowedField('arch_scores')).toBe(false);
    expect(isAllowedField('arch_scores.bogus')).toBe(false);
    expect(isAllowedField('momentumFactors.foo')).toBe(false);
    expect(isAllowedField('pe_ratio')).toBe(false);
    expect(isAllowedField('a.b.c')).toBe(false);
    expect(isAllowedField('')).toBe(false);
    expect(isAllowedField(null)).toBe(false);
    expect(isAllowedField(123)).toBe(false);
    expect(isAllowedField('constructor')).toBe(false); // prototype-pollution guard
    expect(isAllowedField('arch_scores.constructor')).toBe(false);
  });
});

// ==================== 3. resolveField ====================

describe('resolveField', () => {
  const [nvda, , xyz] = makeStocks();
  it('reads scalars and dot-paths', () => {
    expect(resolveField(nvda, 'compositeScore')).toBe(92);
    expect(resolveField(nvda, 'arch_scores.degen')).toBe(70);
    expect(resolveField(nvda, 'momentumFactors.heat')).toBe(85);
  });
  it('returns undefined on missing hops (empty {} / null parents)', () => {
    expect(resolveField(xyz, 'arch_scores.degen')).toBeUndefined();   // arch_scores: {}
    expect(resolveField(xyz, 'momentumFactors.heat')).toBeUndefined(); // momentumFactors: null
    expect(resolveField(null, 'compositeScore')).toBeUndefined();
  });
});

// ==================== 4. evaluateOp ====================

describe('evaluateOp', () => {
  it('comparison ops', () => {
    expect(evaluateOp('gt', 5, 3)).toBe(true);
    expect(evaluateOp('gt', 3, 5)).toBe(false);
    expect(evaluateOp('gte', 5, 5)).toBe(true);
    expect(evaluateOp('lt', 3, 5)).toBe(true);
    expect(evaluateOp('lte', 5, 5)).toBe(true);
  });
  it('eq / neq (numeric coercion + string)', () => {
    expect(evaluateOp('eq', 'Technology', 'Technology')).toBe(true);
    expect(evaluateOp('eq', 1, '1')).toBe(true);
    expect(evaluateOp('eq', 'a', 'b')).toBe(false);
    expect(evaluateOp('neq', 'a', 'b')).toBe(true);
    expect(evaluateOp('neq', 5, 5)).toBe(false);
  });
  it('in / between', () => {
    expect(evaluateOp('in', 'XLK', ['XLK', 'XLF'])).toBe(true);
    expect(evaluateOp('in', 'XLY', ['XLK', 'XLF'])).toBe(false);
    expect(evaluateOp('in', 5, 'notarray')).toBe(false);
    expect(evaluateOp('between', 5, [1, 10])).toBe(true);
    expect(evaluateOp('between', 1, [1, 10])).toBe(true); // inclusive low
    expect(evaluateOp('between', 10, [1, 10])).toBe(true); // inclusive high
    expect(evaluateOp('between', 11, [1, 10])).toBe(false);
    expect(evaluateOp('between', 5, [1, 2, 3])).toBe(false); // bad length
  });
  it('isTrue / isFalse', () => {
    expect(evaluateOp('isTrue', true)).toBe(true);
    expect(evaluateOp('isTrue', false)).toBe(false);
    expect(evaluateOp('isFalse', false)).toBe(true);
    expect(evaluateOp('isFalse', true)).toBe(false);
  });
  it('null/missing value fails every op; numeric op on a string never matches', () => {
    expect(evaluateOp('gt', null, 3)).toBe(false);
    expect(evaluateOp('isFalse', undefined)).toBe(false);
    expect(evaluateOp('neq', null, 5)).toBe(false);
    expect(evaluateOp('gt', 'Technology', 3)).toBe(false); // Number('Technology') is NaN
  });
});

// ==================== 4b. SECTOR CANONICALIZATION ====================
// The NL→spec layer can emit a sector variant ("Health Care") that differs from the
// stored form ("Healthcare"), which a strict compare missed → 0 results. Sector filters
// now canonicalize BOTH sides; non-sector string fields stay exact. See screenStocks.js.

describe('sector canonicalization', () => {
  // A small universe spanning the multi-word sectors the bug recurs on plus the
  // single-word sectors that must keep matching unchanged.
  const sectorUniverse = () => [
    { symbol: 'HUM', sectorId: 'XLV', sectorName: 'Healthcare', compositeScore: 70 },
    { symbol: 'JNJ', sectorId: 'XLV', sectorName: 'Healthcare', compositeScore: 60 },
    { symbol: 'META', sectorId: 'XLC', sectorName: 'Communication Services', compositeScore: 65 },
    { symbol: 'NVDA', sectorId: 'XLK', sectorName: 'Technology', compositeScore: 90 },
    { symbol: 'JPM', sectorId: 'XLF', sectorName: 'Financials', compositeScore: 80 },
    { symbol: 'XOM', sectorId: 'XLE', sectorName: 'Energy', compositeScore: 50 },
  ];

  it('canonicalizeSector: stored names pass through; aliases + spacing/case resolve to the stored form', () => {
    expect(canonicalizeSector('Healthcare')).toBe('Healthcare');
    expect(canonicalizeSector('Technology')).toBe('Technology');
    expect(canonicalizeSector('Consumer Discretionary')).toBe('Consumer Discretionary');
    // spacing / case variants of a stored name resolve to it
    expect(canonicalizeSector('Health Care')).toBe('Healthcare');
    expect(canonicalizeSector('HEALTHCARE')).toBe('Healthcare');
    expect(canonicalizeSector('communication services')).toBe('Communication Services');
    expect(canonicalizeSector('CommunicationServices')).toBe('Communication Services');
    // the fixed alias set (GICS-official / provider synonyms — exact equivalences only)
    expect(canonicalizeSector('Information Technology')).toBe('Technology');
    expect(canonicalizeSector('Consumer Cyclical')).toBe('Consumer Discretionary');
    expect(canonicalizeSector('Consumer Defensive')).toBe('Consumer Staples');
    expect(canonicalizeSector('Financial Services')).toBe('Financials');
    expect(canonicalizeSector('Basic Materials')).toBe('Materials');
  });

  it('canonicalizeSector: unknown values fall back to a normalized form; non-strings pass through', () => {
    expect(canonicalizeSector('Quantum Computing')).toBe('quantumcomputing');
    expect(canonicalizeSector('quantum computing')).toBe(canonicalizeSector('QuantumComputing'));
    expect(canonicalizeSector(null)).toBe(null);
    expect(canonicalizeSector(undefined)).toBe(undefined);
    expect(canonicalizeSector(123)).toBe(123);
  });

  it('the reported bug: spec "Health Care" matches the stored "Healthcare" names', () => {
    const out = screenStocks(sectorUniverse(), {
      filters: [{ field: 'sectorName', op: 'eq', value: 'Health Care' }],
      rankBy: { field: 'compositeScore', direction: 'desc' },
    });
    expect(symbolsOf(out)).toEqual(['HUM', 'JNJ']);
    expect(out.matchCount).toBe(2);
    expect(out.rejectedFilters).toEqual([]);
  });

  it('every case/space variant of a sectorName eq still matches', () => {
    for (const value of ['healthcare', 'HEALTHCARE', 'Health Care', ' Healthcare ']) {
      const out = screenStocks(sectorUniverse(), { filters: [{ field: 'sectorName', op: 'eq', value }] });
      expect(out.matchCount).toBe(2);
    }
  });

  it('a second multi-word sector ("Communication Services") tolerates spacing/case drift', () => {
    const out = screenStocks(sectorUniverse(), {
      filters: [{ field: 'sectorName', op: 'eq', value: 'communicationservices' }],
    });
    expect(symbolsOf(out)).toEqual(['META']);
    expect(out.matchCount).toBe(1);
  });

  it('alias map: spec "Information Technology" matches stored "Technology"', () => {
    const out = screenStocks(sectorUniverse(), {
      filters: [{ field: 'sectorName', op: 'eq', value: 'Information Technology' }],
    });
    expect(symbolsOf(out)).toEqual(['NVDA']);
  });

  it('neq with a variant excludes the canonical sector', () => {
    const out = screenStocks(sectorUniverse(), {
      filters: [{ field: 'sectorName', op: 'neq', value: 'Health Care' }],
      rankBy: { field: 'compositeScore', direction: 'desc' },
    });
    expect(symbolsOf(out)).toEqual(['NVDA', 'JPM', 'META', 'XOM']); // no HUM / JNJ
    expect(out.matchCount).toBe(4);
  });

  it('in with mixed variants matches each canonical sector', () => {
    const out = screenStocks(sectorUniverse(), {
      filters: [{ field: 'sectorName', op: 'in', value: ['Health Care', 'ENERGY'] }],
      rankBy: { field: 'compositeScore', direction: 'desc' },
    });
    expect(symbolsOf(out)).toEqual(['HUM', 'JNJ', 'XOM']);
    expect(out.matchCount).toBe(3);
  });

  it('regression: exact stored Technology / Financials still match', () => {
    const tech = screenStocks(sectorUniverse(), { filters: [{ field: 'sectorName', op: 'eq', value: 'Technology' }] });
    expect(symbolsOf(tech)).toEqual(['NVDA']);
    const fin = screenStocks(sectorUniverse(), { filters: [{ field: 'sectorName', op: 'eq', value: 'Financials' }] });
    expect(symbolsOf(fin)).toEqual(['JPM']);
  });

  it('sectorId compares case-insensitively', () => {
    const out = screenStocks(sectorUniverse(), { filters: [{ field: 'sectorId', op: 'eq', value: 'xlv' }] });
    expect(symbolsOf(out).sort()).toEqual(['HUM', 'JNJ']);
  });

  it('tolerance is scoped to sector fields — other string fields stay an exact compare', () => {
    const u = [
      { symbol: 'A', sectorName: 'Technology', trend: 'up', compositeScore: 10 },
      { symbol: 'B', sectorName: 'Technology', trend: 'up', compositeScore: 20 },
    ];
    // 'UP' !== stored 'up' for a non-sector field → no match (proves eq wasn't globally loosened)
    expect(screenStocks(u, { filters: [{ field: 'trend', op: 'eq', value: 'UP' }] }).matchCount).toBe(0);
    expect(screenStocks(u, { filters: [{ field: 'trend', op: 'eq', value: 'up' }] }).matchCount).toBe(2);
  });
});

// ── Industry canonicalization (Phase 1 — industryName filterable) ─────────────────────
// Mirrors the sector treatment for case/whitespace drift, but with NO alias table:
// industryName has a single canonical source (our own GICS strings), so colloquialisms
// are NOT remapped by the engine. The prompt layer maps "semis" → the GICS string; the
// engine matches the canonical value only. See screenStocks.js.

describe('industry canonicalization (no alias table)', () => {
  const industryUniverse = () => [
    { symbol: 'NVDA', industryName: 'Semiconductors & Semiconductor Equipment', compositeScore: 90, return3M: 25.0 },
    { symbol: 'AMD',  industryName: 'Semiconductors & Semiconductor Equipment', compositeScore: 70, return3M: 12.0 },
    { symbol: 'MSFT', industryName: 'Software', compositeScore: 85, return3M: 8.0 },
    { symbol: 'JPM',  industryName: 'Banks', compositeScore: 80, return3M: 5.0 },
    { symbol: 'XOM',  industryName: 'Oil, Gas & Consumable Fuels', compositeScore: 50, return3M: -10.0 },
  ];

  it('canonicalizeIndustry: case/whitespace variants normalize; NO alias remap; non-strings pass through', () => {
    // case / spacing variants of a stored GICS string collapse to one normalized key
    expect(canonicalizeIndustry('SEMICONDUCTORS & SEMICONDUCTOR EQUIPMENT'))
      .toBe(canonicalizeIndustry('semiconductors & semiconductor equipment'));
    expect(canonicalizeIndustry(' Semiconductors  &  Semiconductor  Equipment '))
      .toBe(canonicalizeIndustry('Semiconductors & Semiconductor Equipment'));
    // NO alias table (unlike sector): a colloquialism does NOT resolve to the GICS string
    expect(canonicalizeIndustry('Semis'))
      .not.toBe(canonicalizeIndustry('Semiconductors & Semiconductor Equipment'));
    expect(canonicalizeIndustry('Chips'))
      .not.toBe(canonicalizeIndustry('Semiconductors & Semiconductor Equipment'));
    // non-strings pass through untouched
    expect(canonicalizeIndustry(null)).toBe(null);
    expect(canonicalizeIndustry(undefined)).toBe(undefined);
    expect(canonicalizeIndustry(123)).toBe(123);
  });

  it('industryName eq tolerates case/spacing drift on a multi-word industry', () => {
    for (const value of [
      'Semiconductors & Semiconductor Equipment',
      'semiconductors & semiconductor equipment',
      'SEMICONDUCTORS & SEMICONDUCTOR EQUIPMENT',
      ' Semiconductors & Semiconductor Equipment ',
    ]) {
      const out = screenStocks(industryUniverse(), {
        filters: [{ field: 'industryName', op: 'eq', value }],
        rankBy: { field: 'compositeScore', direction: 'desc' },
      });
      expect(symbolsOf(out)).toEqual(['NVDA', 'AMD']);
      expect(out.matchCount).toBe(2);
      expect(out.rejectedFilters).toEqual([]);
    }
  });

  it('Phase 1 unlock: industryName filter + return3M rank returns the ranked peer list', () => {
    const out = screenStocks(industryUniverse(), {
      filters: [{ field: 'industryName', op: 'eq', value: 'semiconductors & semiconductor equipment' }],
      rankBy: { field: 'return3M', direction: 'desc' },
    });
    expect(symbolsOf(out)).toEqual(['NVDA', 'AMD']);
    // industryName rides along on every projected result (BASELINE_FIELDS)
    expect(out.results[0].industryName).toBe('Semiconductors & Semiconductor Equipment');
  });

  it('neq excludes the canonical industry; in matches each (case-insensitive)', () => {
    const neq = screenStocks(industryUniverse(), {
      filters: [{ field: 'industryName', op: 'neq', value: 'SEMICONDUCTORS & SEMICONDUCTOR EQUIPMENT' }],
      rankBy: { field: 'compositeScore', direction: 'desc' },
    });
    expect(symbolsOf(neq)).toEqual(['MSFT', 'JPM', 'XOM']); // no NVDA / AMD
    const inOut = screenStocks(industryUniverse(), {
      filters: [{ field: 'industryName', op: 'in', value: ['software', 'banks'] }],
      rankBy: { field: 'compositeScore', direction: 'desc' },
    });
    expect(symbolsOf(inOut)).toEqual(['MSFT', 'JPM']);
  });

  it('an unmatched colloquialism returns nothing (engine matches the canonical value only)', () => {
    const out = screenStocks(industryUniverse(), {
      filters: [{ field: 'industryName', op: 'eq', value: 'Semis' }],
    });
    expect(out.matchCount).toBe(0);
  });
});

// ==================== 5. EMPTY FILTERS (rank-only) ====================

describe('empty filters — rank-only', () => {
  it('passes the whole universe, sorted composite-desc with null last', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'compositeScore', direction: 'desc' } });
    expect(out.universeSize).toBe(5);
    expect(out.matchCount).toBe(5);
    expect(symbolsOf(out)).toEqual(['NVDA', 'AAPL', 'XOM', 'XYZ', 'NULLCO']);
    expect(out.rejectedFilters).toEqual([]);
  });

  it('absent rankBy defaults to composite-desc without a fallback flag', () => {
    const out = screenStocks(makeStocks(), { filters: [] });
    expect(out.appliedSpec.rankBy).toEqual({ field: 'compositeScore', direction: 'desc' });
    expect(out.appliedSpec.rankByFallback).toBe(false);
    expect(out.rejectedFilters).toEqual([]);
  });
});

// ==================== 6. MULTI-FILTER AND ====================

describe('multi-filter AND', () => {
  it('keeps only stocks satisfying every predicate', () => {
    const out = screenStocks(makeStocks(), {
      filters: [
        { field: 'compositeScore', op: 'gte', value: 68 },
        { field: 'sectorName', op: 'eq', value: 'Technology' },
      ],
    });
    expect(symbolsOf(out)).toEqual(['NVDA', 'AAPL']); // XOM is Energy; XYZ/NULLCO below 68
    expect(out.matchCount).toBe(2);
  });

  it('AND with a boolean op', () => {
    const out = screenStocks(makeStocks(), {
      filters: [
        { field: 'atrPercentile', op: 'gt', value: 0.5 },
        { field: 'nr7Flag', op: 'isFalse' },
      ],
    });
    expect(symbolsOf(out)).toEqual(['NVDA']); // XOM has atr>0.5 but nr7Flag true
    expect(out.matchCount).toBe(1);
  });
});

// ==================== 7. ARCHETYPE rankBy ====================

describe('archetype rankBy via arch_scores.<key>', () => {
  it('ranks by arch_scores.degen desc; unranked stocks sort last; results carry nested value', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'arch_scores.degen', direction: 'desc' } });
    // degen: NVDA70, XOM45, AAPL40, then XYZ/NULLCO (both undefined → null) tie-broken by symbol asc.
    expect(symbolsOf(out)).toEqual(['NVDA', 'XOM', 'AAPL', 'NULLCO', 'XYZ']);
    const nvda = out.results[0];
    expect(nvda.arch_scores).toEqual({ degen: 70 });
    const unranked = out.results.find(r => r.symbol === 'XYZ');
    expect(unranked.arch_scores).toEqual({ degen: null });
  });
});

// ==================== 7b. RETURN-FIELD rankBy (Conversational Performance) ====================

describe('return-field rankBy', () => {
  it('ranks by return1W desc ("best this week"), nulls last', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'return1W', direction: 'desc' } });
    // 1W: NVDA 4.2, AAPL 1.1, XOM 0.5, XYZ -2.5, then NULLCO (null) last.
    expect(symbolsOf(out)).toEqual(['NVDA', 'AAPL', 'XOM', 'XYZ', 'NULLCO']);
  });

  it('ranks by return1M asc ("worst this month") — negatives sort right, nulls last', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'return1M', direction: 'asc' } });
    // 1M asc: XYZ -8.0, XOM -1.5, AAPL 3.2, NVDA 12.4, then NULLCO (null) last.
    expect(symbolsOf(out)).toEqual(['XYZ', 'XOM', 'AAPL', 'NVDA', 'NULLCO']);
  });

  it('ranks by return3M desc — a negative return sorts below every positive one', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'return3M', direction: 'desc' } });
    // 3M desc: NVDA 25, AAPL 8, XYZ 5, XOM -10, then NULLCO (null) last.
    expect(symbolsOf(out)).toEqual(['NVDA', 'AAPL', 'XYZ', 'XOM', 'NULLCO']);
  });

  it('"best tech stocks this week" — sector filter + return1W desc, ranked field carried raw', () => {
    const out = screenStocks(makeStocks(), {
      filters: [{ field: 'sectorName', op: 'eq', value: 'Technology' }],
      rankBy: { field: 'return1W', direction: 'desc' },
    });
    expect(symbolsOf(out)).toEqual(['NVDA', 'AAPL', 'XYZ']); // the three Tech names; XYZ (-2.5%) last
    expect(out.results[0].return1W).toBe(4.2);               // signed percent passes through raw
    expect(out.results.find(r => r.symbol === 'XYZ').return1W).toBe(-2.5);
  });

  it('a return field is a valid, non-fallback rankBy with nothing rejected', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'return12M', direction: 'desc' } });
    expect(out.appliedSpec.rankBy).toEqual({ field: 'return12M', direction: 'desc' });
    expect(out.appliedSpec.rankByFallback).toBe(false);
    expect(out.rejectedFilters).toHaveLength(0);
  });
});

// ==================== 8. ABSENT-FIELD REJECTION ====================

describe('absent-field rejection', () => {
  it('drops a non-allowlisted filter into rejectedFilters and applies the valid sibling', () => {
    const out = screenStocks(makeStocks(), {
      filters: [
        { field: 'pe_ratio', op: 'gt', value: 15 },
        { field: 'compositeScore', op: 'gt', value: 0 },
      ],
    });
    expect(out.rejectedFilters).toHaveLength(1);
    expect(out.rejectedFilters[0]).toMatchObject({
      scope: 'filter', field: 'pe_ratio', reason: 'field_not_allowed',
    });
    expect(out.rejectedFilters[0].detail).toMatch(/pe_ratio/);
    expect(out.appliedSpec.filters).toHaveLength(1);
    // compositeScore > 0 keeps the 4 non-null stocks; NULLCO excluded.
    expect(out.matchCount).toBe(4);
    expect(symbolsOf(out)).not.toContain('NULLCO');
  });
});

// ==================== 9. INVALID rankBy field / bad direction ====================

describe('rankBy validation', () => {
  it('invalid field falls back to composite-desc and flags rankByFallback', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'arch_scores.bogus', direction: 'desc' } });
    expect(out.appliedSpec.rankBy).toEqual({ field: 'compositeScore', direction: 'desc' });
    expect(out.appliedSpec.rankByFallback).toBe(true);
    expect(out.rejectedFilters).toEqual([
      expect.objectContaining({ scope: 'rankBy', field: 'arch_scores.bogus', reason: 'invalid_rank_field' }),
    ]);
  });

  it('valid field + bad direction keeps the field, infers direction, reports it, no fallback', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'momentumScore', direction: 'sideways' } });
    expect(out.appliedSpec.rankBy).toEqual({ field: 'momentumScore', direction: 'desc' }); // inferred desc
    expect(out.appliedSpec.rankByFallback).toBe(false);
    expect(out.rejectedFilters).toEqual([
      expect.objectContaining({ scope: 'rankBy', field: 'momentumScore', reason: 'unsupported_rank_direction', value: 'sideways' }),
    ]);
  });

  it('infers asc for a *Rank field when direction is bad', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'momentumRank', direction: 'sideways' } });
    expect(out.appliedSpec.rankBy).toEqual({ field: 'momentumRank', direction: 'asc' });
    // momentumRank asc: NVDA(1), XOM(9), AAPL(20), then null ranks (XYZ/NULLCO) last, symbol-tiebroken.
    expect(symbolsOf(out)).toEqual(['NVDA', 'XOM', 'AAPL', 'NULLCO', 'XYZ']);
  });
});

// ==================== 10. UNSUPPORTED OP / MALFORMED VALUE ====================

describe('unsupported op and malformed value rejection', () => {
  it('unsupported op rejected; remaining behaviour is rank-only', () => {
    const out = screenStocks(makeStocks(), { filters: [{ field: 'compositeScore', op: 'approx', value: 50 }] });
    expect(out.rejectedFilters[0]).toMatchObject({ reason: 'unsupported_op', field: 'compositeScore', op: 'approx' });
    expect(out.appliedSpec.filters).toEqual([]);
    expect(out.matchCount).toBe(5); // no valid filters ⇒ all pass
  });

  it('malformed in/between values rejected', () => {
    const inOut = screenStocks(makeStocks(), { filters: [{ field: 'sectorId', op: 'in', value: 'XLK' }] });
    expect(inOut.rejectedFilters[0]).toMatchObject({ reason: 'malformed_value', op: 'in' });

    const btwOut = screenStocks(makeStocks(), { filters: [{ field: 'atrPercentile', op: 'between', value: [1, 2, 3] }] });
    expect(btwOut.rejectedFilters[0]).toMatchObject({ reason: 'malformed_value', op: 'between' });
  });

  it('non-object predicate rejected as malformed_predicate', () => {
    const out = screenStocks(makeStocks(), { filters: ['nonsense', null, { op: 'gt', value: 1 }] });
    expect(out.rejectedFilters).toHaveLength(3);
    expect(out.rejectedFilters.every(r => r.reason === 'malformed_predicate')).toBe(true);
  });
});

// ==================== 10b. DEFENSIVE INPUT BOUNDS ====================

describe('defensive input bounds (untrusted spec)', () => {
  it('caps filters at MAX_FILTERS and reports the overflow', () => {
    const many = Array.from({ length: MAX_FILTERS + 5 }, () => ({ field: 'compositeScore', op: 'gte', value: 0 }));
    const out = screenStocks(makeStocks(), { filters: many });
    expect(out.appliedSpec.filters).toHaveLength(MAX_FILTERS);
    expect(out.rejectedFilters.some((r) => r.reason === 'too_many_filters')).toBe(true);
  });

  it('rejects an in-list longer than MAX_IN_VALUES', () => {
    const big = Array.from({ length: MAX_IN_VALUES + 1 }, (_, i) => `S${i}`);
    const out = screenStocks(makeStocks(), { filters: [{ field: 'sectorId', op: 'in', value: big }] });
    expect(out.rejectedFilters[0]).toMatchObject({ reason: 'value_too_large', op: 'in' });
    expect(out.appliedSpec.filters).toHaveLength(0);
  });
});

// ==================== 11. LIMIT CLAMP / SLICE ====================

describe('limit clamping and slicing', () => {
  it('defaults to 10 when omitted', () => {
    const out = screenStocks(makeStocks(), {});
    expect(out.appliedSpec.limit).toBe(10);
    expect(out.results).toHaveLength(5); // only 5 in fixture
  });

  it('slices to an explicit limit; matchCount stays pre-slice', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'compositeScore', direction: 'desc' }, limit: 3 });
    expect(symbolsOf(out)).toEqual(['NVDA', 'AAPL', 'XOM']);
    expect(out.matchCount).toBe(5);
    expect(out.appliedSpec.limit).toBe(3);
  });

  it('clamps a too-large limit to MAX_LIMIT (25)', () => {
    const big = Array.from({ length: 30 }, (_, i) => ({
      symbol: `S${String(i).padStart(2, '0')}`, sectorName: 'Technology', compositeScore: 100 - i,
    }));
    const out = screenStocks(big, { rankBy: { field: 'compositeScore', direction: 'desc' }, limit: 99 });
    expect(out.appliedSpec.limit).toBe(25);
    expect(out.results).toHaveLength(25);
    expect(out.matchCount).toBe(30);
  });

  it('non-positive / non-numeric limits fall back to the default', () => {
    for (const bad of [0, -5, 'x', NaN, null]) {
      expect(screenStocks(makeStocks(), { limit: bad }).appliedSpec.limit).toBe(10);
    }
  });
});

// ==================== 12. NULL-VALUE HANDLING ====================

describe('null-value handling', () => {
  it('excludes a stock whose filtered field is null', () => {
    const out = screenStocks(makeStocks(), { filters: [{ field: 'compositeScore', op: 'gte', value: 0 }] });
    expect(symbolsOf(out)).not.toContain('NULLCO');
    expect(out.matchCount).toBe(4);
  });

  it('sorts null values last, not first', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'compositeScore', direction: 'desc' } });
    expect(out.results[out.results.length - 1].symbol).toBe('NULLCO');
  });
});

// ==================== 13. PROJECTION COMPLETENESS ====================

describe('result projection', () => {
  it('carries baseline + referenced fields, nulls as null, no duplicate baseline key', () => {
    const out = screenStocks(makeStocks(), {
      filters: [{ field: 'atrPercentile', op: 'gte', value: 0 }, { field: 'compositeScore', op: 'gte', value: 0 }],
      rankBy: { field: 'arch_scores.degen', direction: 'desc' },
    });
    const nvda = out.results.find(r => r.symbol === 'NVDA');
    expect(Object.keys(nvda).sort()).toEqual(
      ['arch_scores', 'atrPercentile', 'baggerBombFit', 'compositeScore', 'industryName', 'momentumScore', 'sectorName', 'symbol'].sort(),
    );
    // compositeScore referenced by a filter but is a baseline ⇒ appears exactly once.
    expect(Object.keys(nvda).filter(k => k === 'compositeScore')).toHaveLength(1);
    // A referenced field that is null on a stock surfaces as null (not missing).
    const xyz = out.results.find(r => r.symbol === 'XYZ');
    expect(xyz.arch_scores).toEqual({ degen: null });
    expect('arch_scores' in xyz).toBe(true);
  });
});

// ==================== 14. EMPTY / GARBAGE UNIVERSE ====================

describe('empty and garbage input', () => {
  it('empty universe returns a well-formed zero result', () => {
    const out = screenStocks([], { filters: [{ field: 'compositeScore', op: 'gt', value: 0 }] });
    expect(out.universeSize).toBe(0);
    expect(out.matchCount).toBe(0);
    expect(out.results).toEqual([]);
  });

  it('undefined inputs do not throw and return defaults', () => {
    const out = screenStocks(undefined, undefined);
    expect(out.universeSize).toBe(0);
    expect(out.matchCount).toBe(0);
    expect(out.results).toEqual([]);
    expect(out.appliedSpec.rankBy).toEqual({ field: 'compositeScore', direction: 'desc' });
  });
});

// ==================== 15. METADATA SHAPE ====================

describe('metadata', () => {
  it('exposes exactly the 6 documented keys with valid types', () => {
    const out = screenStocks(makeStocks(), { rankBy: { field: 'compositeScore', direction: 'desc' } });
    expect(Object.keys(out).sort()).toEqual(
      ['appliedSpec', 'computedAt', 'matchCount', 'rejectedFilters', 'results', 'universeSize'],
    );
    expect(Number.isNaN(Date.parse(out.computedAt))).toBe(false);
    expect(Number.isInteger(out.universeSize)).toBe(true);
    expect(Number.isInteger(out.matchCount)).toBe(true);
  });
});

// ==================== 16. DETERMINISM ====================

describe('determinism', () => {
  it('identical input yields identical output', () => {
    const spec = {
      filters: [{ field: 'compositeScore', op: 'gte', value: 0 }],
      rankBy: { field: 'compositeScore', direction: 'desc' },
    };
    expect(screenStocks(makeStocks(), spec)).toEqual(screenStocks(makeStocks(), spec));
  });

  it('ties break on symbol ascending', () => {
    const tied = [
      { symbol: 'ZZZ', sectorName: 'Technology', compositeScore: 50 },
      { symbol: 'AAA', sectorName: 'Technology', compositeScore: 50 },
      { symbol: 'MMM', sectorName: 'Technology', compositeScore: 50 },
    ];
    const out = screenStocks(tied, { rankBy: { field: 'compositeScore', direction: 'desc' } });
    expect(symbolsOf(out)).toEqual(['AAA', 'MMM', 'ZZZ']);
  });
});

// ==================== 17. NAMESPACE MERGE ====================

describe('namespace merge in projection', () => {
  it('merges two referenced sub-keys of one namespace into a single parent', () => {
    const out = screenStocks(makeStocks(), {
      filters: [{ field: 'momentumFactors.heat', op: 'gt', value: 0 }],
      rankBy: { field: 'momentumFactors.quality', direction: 'desc' },
    });
    // heat>0 keeps NVDA/AAPL/XOM (XYZ & NULLCO have null momentumFactors); ranked by quality desc.
    expect(symbolsOf(out)).toEqual(['NVDA', 'AAPL', 'XOM']);
    const nvda = out.results[0];
    // ONE merged parent carrying both sub-keys — not two partial parents, not an overwrite.
    expect(nvda.momentumFactors).toEqual({ heat: 85, quality: 75 });
    expect(Object.keys(nvda)).toContain('momentumFactors');
  });
});

// ==================== 18. NO DOTTED KEYS ====================

describe('Firestore-safe keys', () => {
  it('no top-level result key contains a dot', () => {
    const out = screenStocks(makeStocks(), {
      filters: [{ field: 'arch_scores.degen', op: 'gte', value: 0 }, { field: 'momentumFactors.heat', op: 'gte', value: 0 }],
      rankBy: { field: 'momentumFactors.quality', direction: 'desc' },
    });
    for (const r of out.results) {
      for (const key of Object.keys(r)) {
        expect(key).not.toContain('.');
      }
    }
  });
});

// ==================== screenIndustries (Phase 2 — industry rollup) ====================

describe('screenIndustries', () => {
  // Mirrors the precomputed `industries` map in stockRankings (keyed by GICS name).
  const industries = () => ({
    'Semiconductors & Semiconductor Equipment': {
      name: 'Semiconductors & Semiconductor Equipment', totalStocks: 10,
      stocks: ['NVDA', 'AMD'], return1M: 12, return3M: 25, momentumScore: 80,
    },
    Software: {
      name: 'Software', totalStocks: 10,
      stocks: ['MSFT'], return1M: 8, return3M: 15, momentumScore: 70,
    },
    Banks: {
      name: 'Banks', totalStocks: 5,
      stocks: ['JPM'], return1M: 3, return3M: 5, momentumScore: 60,
    },
    'Oil, Gas & Consumable Fuels': {
      name: 'Oil, Gas & Consumable Fuels', totalStocks: 16,
      stocks: ['XOM'], return1M: -2, return3M: null, momentumScore: 50,
    },
  });
  const namesOf = (out) => out.results.map((r) => r.name);

  it('ROLLUP_RANK_FIELDS holds the aggregated metrics only', () => {
    expect(ROLLUP_RANK_FIELDS.has('return1M')).toBe(true);
    expect(ROLLUP_RANK_FIELDS.has('return3M')).toBe(true);
    expect(ROLLUP_RANK_FIELDS.has('momentumScore')).toBe(true);
    expect(ROLLUP_RANK_FIELDS.has('compositeScore')).toBe(false); // not an industry metric
    expect(ROLLUP_RANK_FIELDS.has('sectorName')).toBe(false);
  });

  it('ranks industries by a return horizon (desc) and projects {name,totalStocks,stocks,field,value}', () => {
    const out = screenIndustries(industries(), { rankBy: { field: 'return1M', direction: 'desc' } });
    expect(namesOf(out)).toEqual([
      'Semiconductors & Semiconductor Equipment', 'Software', 'Banks', 'Oil, Gas & Consumable Fuels',
    ]);
    expect(out.appliedSpec.screenType).toBe('industries');
    expect(out.universeSize).toBe(4);
    expect(out.results[0]).toEqual({
      name: 'Semiconductors & Semiconductor Equipment', totalStocks: 10,
      stocks: ['NVDA', 'AMD'], field: 'return1M', value: 12,
    });
  });

  it('asc direction reverses the order', () => {
    const out = screenIndustries(industries(), { rankBy: { field: 'return1M', direction: 'asc' } });
    expect(namesOf(out)).toEqual([
      'Oil, Gas & Consumable Fuels', 'Banks', 'Software', 'Semiconductors & Semiconductor Equipment',
    ]);
  });

  it('a null metric sorts LAST in either direction', () => {
    const desc = screenIndustries(industries(), { rankBy: { field: 'return3M', direction: 'desc' } });
    expect(namesOf(desc)[3]).toBe('Oil, Gas & Consumable Fuels'); // return3M null → last
    const asc = screenIndustries(industries(), { rankBy: { field: 'return3M', direction: 'asc' } });
    expect(namesOf(asc)[3]).toBe('Oil, Gas & Consumable Fuels'); // still last
  });

  it('ranks by momentumScore', () => {
    const out = screenIndustries(industries(), { rankBy: { field: 'momentumScore', direction: 'desc' } });
    expect(namesOf(out)[0]).toBe('Semiconductors & Semiconductor Equipment');
    expect(out.results[0].value).toBe(80);
  });

  it('rejects a non-rollup rankBy field and falls back to return1M desc', () => {
    const out = screenIndustries(industries(), { rankBy: { field: 'compositeScore', direction: 'desc' } });
    expect(out.appliedSpec.rankBy).toEqual({ field: 'return1M', direction: 'desc' });
    expect(out.appliedSpec.rankByFallback).toBe(true);
    expect(out.rejectedFilters[0].reason).toBe('invalid_rank_field');
    expect(namesOf(out)[0]).toBe('Semiconductors & Semiconductor Equipment');
  });

  it('clamps the limit and slices', () => {
    const out = screenIndustries(industries(), { rankBy: { field: 'return1M', direction: 'desc' }, limit: 2 });
    expect(out.results).toHaveLength(2);
    expect(out.appliedSpec.limit).toBe(2);
  });

  it('empty / missing rollup → well-formed zero result', () => {
    const out = screenIndustries({}, { rankBy: { field: 'return1M', direction: 'desc' } });
    expect(out.results).toEqual([]);
    expect(out.universeSize).toBe(0);
    expect(out.appliedSpec.screenType).toBe('industries');
  });
});
