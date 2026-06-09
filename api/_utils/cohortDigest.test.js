// api/_utils/cohortDigest.test.js
//
// Unit coverage for the deterministic cohort-digest assembly. Pure input →
// output; no mocks needed.

import { describe, it, expect } from 'vitest';
import { buildCohortDigest, buildCohortRows, tagStandouts, forwardStat } from './cohortDigest.js';

const RANKINGS = {
  AAA: { symbol: 'AAA', sectorName: 'Technology', industryName: 'Software', return1M: 10, return3M: 20, momentumScore: 80, sma200_position: 5, baggerBombFit: 70, compositeScore: 60, technicalScore: 65, nr7Flag: true },
  BBB: { symbol: 'BBB', sectorName: 'Technology', industryName: 'Semiconductors & Semiconductor Equipment', return1M: 5, return3M: 8, momentumScore: 60, sma200_position: 2, baggerBombFit: 50, compositeScore: 55, technicalScore: 50, nr7Flag: false },
  CCC: { symbol: 'CCC', sectorName: 'Healthcare', industryName: 'Biotechnology', return1M: -3, return3M: -10, momentumScore: 30, sma200_position: -4, baggerBombFit: 20, compositeScore: 40, technicalScore: 35, nr7Flag: false },
  DDD: { symbol: 'DDD', sectorName: 'Technology', industryName: 'Software', return1M: -8, return3M: -15, momentumScore: 20, sma200_position: -6, baggerBombFit: 10, compositeScore: 30, technicalScore: 25, nr7Flag: false },
};

// Tier-3 forward consensus fixture (already FLATTENED + percent-scaled, the way
// the endpoint's readEstimates hands it in). CCC is the thin / low-growth name.
const FORWARD = {
  AAA: { consensusGrowthNextYear: 18, consensusGrowthCurrentYear: 12, rsr: 0.8, emsPercentile: 70, estimateSpread: 8, numAnalystsNextYear: 20 },
  BBB: { consensusGrowthNextYear: 30, consensusGrowthCurrentYear: 22, rsr: 0.6, emsPercentile: 90, estimateSpread: 15, numAnalystsNextYear: 25 },
  CCC: { consensusGrowthNextYear: 6, consensusGrowthCurrentYear: 4, rsr: 0.3, emsPercentile: 40, estimateSpread: 22, numAnalystsNextYear: 8 },
};

describe('buildCohortDigest — Tier-1', () => {
  const digest = buildCohortDigest({
    symbols: ['AAA', 'BBB', 'CCC', 'DDD', 'ZZZ'],
    rankingsBySymbol: RANKINGS,
  });

  it('counts size / covered / off-universe', () => {
    expect(digest.size).toBe(5);
    expect(digest.covered).toBe(4);
    expect(digest.offUniverse).toEqual(['ZZZ']);
  });

  it('computes sector + industry concentration sorted desc', () => {
    expect(digest.sectors[0]).toEqual({ name: 'Technology', count: 3 });
    expect(digest.sectors).toContainEqual({ name: 'Healthcare', count: 1 });
    expect(digest.industries[0]).toEqual({ name: 'Software', count: 2 });
  });

  it('computes the return distribution', () => {
    expect(digest.returns.return1M).toEqual({ median: 1, min: -8, max: 10, count: 4 });
  });

  it('computes momentum + 200-day posture', () => {
    expect(digest.momentum.medianScore).toBe(45);
    expect(digest.trend.aboveCount).toBe(2);
    expect(digest.trend.belowCount).toBe(2);
  });

  it('counts NR7 setups', () => {
    expect(digest.nr7Count).toBe(1);
  });

  it('builds the winners-vs-losers contrast (split by return1M)', () => {
    expect(digest.winnersLosers.splitField).toBe('return1M');
    const { winners, losers } = digest.winnersLosers;
    expect(winners.count).toBe(2);
    expect(winners.symbols).toEqual(['AAA', 'BBB']);
    expect(winners.medianReturn).toBe(7.5);
    expect(winners.pctAbove200).toBe(100);
    expect(losers.symbols).toEqual(['CCC', 'DDD']);
    expect(losers.pctAbove200).toBe(0);
  });

  it('omits the Tier-2 fundamentals when no peer metrics are given', () => {
    expect(digest.tier2Included).toBe(false);
    expect(digest.fundamentals).toBeNull();
  });
});

describe('buildCohortDigest — Tier-2', () => {
  const PEER = {
    AAA: { trailingPE: 20, debtToEquity: 1, revenueGrowthYOY: 15, marketCap: 1e11 },
    BBB: { trailingPE: 30, debtToEquity: 0.5, revenueGrowthYOY: 25, marketCap: 2e11 },
    CCC: { trailingPE: 10, debtToEquity: 2, revenueGrowthYOY: 5, marketCap: 5e10 },
  };
  const digest = buildCohortDigest({
    symbols: ['AAA', 'BBB', 'CCC'],
    rankingsBySymbol: RANKINGS,
    peerMetricsBySymbol: PEER,
  });

  it('flags tier2 and computes per-field median + outlier names', () => {
    expect(digest.tier2Included).toBe(true);
    expect(digest.fundamentals.trailingPE.median).toBe(20);
    expect(digest.fundamentals.trailingPE.min).toBe(10);
    expect(digest.fundamentals.trailingPE.max).toBe(30);
    expect(digest.fundamentals.trailingPE.lowName).toBe('CCC');
    expect(digest.fundamentals.trailingPE.highName).toBe('BBB');
    expect(digest.fundamentals.marketCap.count).toBe(3);
  });
});

describe('buildCohortDigest — Tier-3 (forward consensus)', () => {
  const digest = buildCohortDigest({
    symbols: ['AAA', 'BBB', 'CCC'],
    rankingsBySymbol: RANKINGS,
    forwardBySymbol: FORWARD,
  });

  it('flags tier3 and computes per-field median + outlier names', () => {
    expect(digest.tier3Included).toBe(true);
    expect(digest.forward.consensusGrowthNextYear.median).toBe(18);
    expect(digest.forward.consensusGrowthNextYear.min).toBe(6);
    expect(digest.forward.consensusGrowthNextYear.max).toBe(30);
    expect(digest.forward.consensusGrowthNextYear.lowName).toBe('CCC');
    expect(digest.forward.consensusGrowthNextYear.highName).toBe('BBB');
    expect(digest.forward.numAnalystsNextYear.count).toBe(3);
  });

  it('stays additive — Tier-2 untouched when only forward metrics are given', () => {
    expect(digest.tier2Included).toBe(false);
    expect(digest.fundamentals).toBeNull();
    expect(digest.returns.return1M.count).toBe(3); // Tier-1 aggregate unchanged
  });

  it('omits the Tier-3 forward block when no forward metrics are given', () => {
    const d = buildCohortDigest({ symbols: ['AAA', 'BBB', 'CCC'], rankingsBySymbol: RANKINGS });
    expect(d.tier3Included).toBe(false);
    expect(d.forward).toBeNull();
  });
});

describe('forwardStat', () => {
  it('computes median / range / holders over finite values, null-safe', () => {
    const E = { AAA: { g: 18 }, BBB: { g: 30 }, CCC: { g: 6 }, DDD: { g: null } };
    expect(forwardStat(E, ['AAA', 'BBB', 'CCC', 'DDD'], 'g')).toEqual({
      median: 18, min: 6, max: 30, count: 3, lowName: 'CCC', highName: 'BBB',
    });
  });

  it('returns an all-null stat when nothing is finite', () => {
    expect(forwardStat({ AAA: { g: null }, BBB: {} }, ['AAA', 'BBB'], 'g')).toEqual({
      median: null, min: null, max: null, count: 0, lowName: null, highName: null,
    });
  });
});

describe('buildCohortDigest — edge cases', () => {
  it('is null-safe for missing return fields (count reflects non-null only)', () => {
    const digest = buildCohortDigest({
      symbols: ['AAA', 'X'],
      rankingsBySymbol: { AAA: { symbol: 'AAA', sectorName: 'Technology', return1M: 4 }, X: { symbol: 'X', sectorName: 'Energy' } },
    });
    expect(digest.returns.return1M.count).toBe(1);
    expect(digest.returns.return1M.median).toBe(4);
    expect(digest.returns.return3M.count).toBe(0);
  });

  it('falls back to return3M for the split, then null when too few names', () => {
    // Only 3 names carry return1M → too few for a 1M split; but they carry
    // return3M, and 3 < MIN_SPLIT_SIZE (4) → no split at all.
    const small = buildCohortDigest({
      symbols: ['AAA', 'BBB', 'CCC'],
      rankingsBySymbol: RANKINGS,
    });
    expect(small.winnersLosers).toBeNull();
  });

  it('handles an empty cohort', () => {
    const digest = buildCohortDigest({ symbols: [], rankingsBySymbol: {} });
    expect(digest.size).toBe(0);
    expect(digest.covered).toBe(0);
    expect(digest.winnersLosers).toBeNull();
    expect(digest.sectors).toEqual([]);
  });
});

// ── Per-name layer (A + D): buildCohortRows + tagStandouts ───────────────────

describe('buildCohortRows — Tier-1', () => {
  const rows = buildCohortRows({
    symbols: ['AAA', 'BBB', 'CCC', 'DDD', 'ZZZ'],
    rankingsBySymbol: RANKINGS,
  });

  it('emits one row per covered symbol (off-universe excluded)', () => {
    expect(rows.map((r) => r.symbol)).toEqual(['AAA', 'BBB', 'CCC', 'DDD']);
  });

  it('carries the Tier-1 fields per row', () => {
    const aaa = rows.find((r) => r.symbol === 'AAA');
    expect(aaa.sectorName).toBe('Technology');
    expect(aaa.return1M).toBe(10);
    expect(aaa.momentumScore).toBe(80);
    expect(aaa.nr7Flag).toBe(true);
  });

  it('OMITS Tier-2 keys entirely when no peer metrics (absent ≠ null)', () => {
    for (const r of rows) {
      expect(r).not.toHaveProperty('trailingPE');
      expect(r).not.toHaveProperty('debtToEquity');
    }
  });

  it('tags standouts (high/low holders) on each technical dimension', () => {
    const aaa = rows.find((r) => r.symbol === 'AAA');
    const ddd = rows.find((r) => r.symbol === 'DDD');
    expect(aaa.standouts.high).toEqual(expect.arrayContaining(['return1M', 'momentumScore']));
    expect(ddd.standouts.low).toEqual(expect.arrayContaining(['return1M', 'momentumScore']));
    // BBB/CCC are neither extreme → no tags.
    const bbb = rows.find((r) => r.symbol === 'BBB');
    expect(bbb.standouts.high).toEqual([]);
    expect(bbb.standouts.low).toEqual([]);
  });
});

describe('buildCohortRows — Tier-2', () => {
  const PEER = {
    AAA: { trailingPE: 20, debtToEquity: 1, marketCap: 1e11 },
    BBB: { trailingPE: 30, debtToEquity: 0.5, marketCap: 2e11 },
    CCC: { trailingPE: 10, debtToEquity: 2, marketCap: 5e10 },
  };
  const rows = buildCohortRows({
    symbols: ['AAA', 'BBB', 'CCC'],
    rankingsBySymbol: RANKINGS,
    peerMetricsBySymbol: PEER,
  });

  it('includes Tier-2 keys with their values when peer metrics are provided', () => {
    const ccc = rows.find((r) => r.symbol === 'CCC');
    expect(ccc.trailingPE).toBe(10);
    expect(ccc.debtToEquity).toBe(2);
    expect(ccc.marketCap).toBe(5e10);
  });

  it('a missing Tier-2 field is null (loaded-but-null), not absent', () => {
    const PARTIAL = { AAA: { trailingPE: 20 }, BBB: { trailingPE: 25 }, CCC: { trailingPE: 15 } };
    const r = buildCohortRows({ symbols: ['AAA', 'BBB', 'CCC'], rankingsBySymbol: RANKINGS, peerMetricsBySymbol: PARTIAL });
    expect(r[0]).toHaveProperty('debtToEquity', null);
  });
});

describe('tagStandouts — ≥3-finite guard', () => {
  it('does not tag a dimension with fewer than 3 finite values', () => {
    const rows = [
      { symbol: 'A', momentumScore: 90 },
      { symbol: 'B', momentumScore: 10 },
      { symbol: 'C', momentumScore: null },
    ];
    tagStandouts(rows, { tier2: false });
    for (const r of rows) {
      expect(r.standouts.high).not.toContain('momentumScore');
      expect(r.standouts.low).not.toContain('momentumScore');
    }
  });

  it('only tags fundamental dimensions when tier2 is true', () => {
    const rows = [
      { symbol: 'A', debtToEquity: 3 },
      { symbol: 'B', debtToEquity: 2 },
      { symbol: 'C', debtToEquity: 1 },
    ];
    tagStandouts(rows, { tier2: false });
    expect(rows[0].standouts.high).not.toContain('debtToEquity');
    tagStandouts(rows, { tier2: true });
    expect(rows[0].standouts.high).toContain('debtToEquity'); // A is the max holder
    expect(rows[2].standouts.low).toContain('debtToEquity'); // C is the min holder
  });
});

describe('buildCohortRows — Tier-3', () => {
  const rows = buildCohortRows({
    symbols: ['AAA', 'BBB', 'CCC'],
    rankingsBySymbol: RANKINGS,
    forwardBySymbol: FORWARD,
  });

  it('includes Tier-3 keys with their values when forward metrics are provided', () => {
    const bbb = rows.find((r) => r.symbol === 'BBB');
    expect(bbb.consensusGrowthNextYear).toBe(30);
    expect(bbb.emsPercentile).toBe(90);
    expect(bbb.estimateSpread).toBe(15);
  });

  it('OMITS Tier-3 keys entirely when no forward metrics (absent ≠ null)', () => {
    const t1 = buildCohortRows({ symbols: ['AAA', 'BBB', 'CCC'], rankingsBySymbol: RANKINGS });
    for (const r of t1) {
      expect(r).not.toHaveProperty('consensusGrowthNextYear');
      expect(r).not.toHaveProperty('emsPercentile');
    }
  });

  it('a missing Tier-3 field is null (loaded-but-null), not absent', () => {
    const PARTIAL = { AAA: { consensusGrowthNextYear: 18 }, BBB: { consensusGrowthNextYear: 30 }, CCC: { consensusGrowthNextYear: 6 } };
    const r = buildCohortRows({ symbols: ['AAA', 'BBB', 'CCC'], rankingsBySymbol: RANKINGS, forwardBySymbol: PARTIAL });
    expect(r[0]).toHaveProperty('emsPercentile', null);
  });

  it('keeps Tier-2 and Tier-3 independent (both carried when both provided)', () => {
    const PEER = { AAA: { trailingPE: 20 }, BBB: { trailingPE: 30 }, CCC: { trailingPE: 10 } };
    const r = buildCohortRows({ symbols: ['AAA', 'BBB', 'CCC'], rankingsBySymbol: RANKINGS, peerMetricsBySymbol: PEER, forwardBySymbol: FORWARD });
    expect(r[0]).toHaveProperty('trailingPE');
    expect(r[0]).toHaveProperty('consensusGrowthNextYear');
  });
});

describe('tagStandouts — Tier-3 forward dims', () => {
  it('only tags forward dimensions when tier3 is true', () => {
    const rows = [
      { symbol: 'A', consensusGrowthNextYear: 30 },
      { symbol: 'B', consensusGrowthNextYear: 18 },
      { symbol: 'C', consensusGrowthNextYear: 6 },
    ];
    tagStandouts(rows, { tier3: false });
    expect(rows[0].standouts.high).not.toContain('consensusGrowthNextYear');
    tagStandouts(rows, { tier3: true });
    expect(rows[0].standouts.high).toContain('consensusGrowthNextYear'); // A is the max holder
    expect(rows[2].standouts.low).toContain('consensusGrowthNextYear');  // C is the min holder
  });

  it('honors the ≥3-finite guard on forward dims', () => {
    const rows = [
      { symbol: 'A', consensusGrowthNextYear: 30 },
      { symbol: 'B', consensusGrowthNextYear: 18 },
      { symbol: 'C', consensusGrowthNextYear: null },
    ];
    tagStandouts(rows, { tier3: true });
    for (const r of rows) {
      expect(r.standouts.high).not.toContain('consensusGrowthNextYear');
      expect(r.standouts.low).not.toContain('consensusGrowthNextYear');
    }
  });
});
