// api/cron/compute-index-intelligence.fundamentalsMirror.test.js
//
// Fundamental Wire — Commit 1 (dark mirror) contract tests.
// Style-A per the in-file convention (compute-index-intelligence.rollup.test.js:
// "the cron handler isn't exported, but its pure helpers are"): import the real
// exported helper, zero mocks.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL import of
// compute-index-intelligence.js is the runtime guard for the cron's new
// api→src edge (FUNDAMENTAL_MIRROR_ENABLED from src/config/featureFlags.js) —
// it explodes in the Node test env if a browser dep ever enters that graph.
// NEVER mock this import.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildFundamentalsMirror,
  STOCK_RANKINGS_DOC_WARN_BYTES,
} from './compute-index-intelligence.js';

const SOURCE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'compute-index-intelligence.js');

// A maximal peerRankings doc shaped like compute-rankings.js persistResults
// output (metrics :1343-1378 idiom + pillars per-dimension detail).
function fullFund(overrides = {}) {
  return {
    ticker: 'TEST',
    computedAt: new Date('2026-07-24T11:01:30Z'),
    metrics: {
      trailingPE: 42.13,
      priceBookMRQ: 8.297,
      revenueGrowthYOY: 0.116, // FRACTION at source
      marketCap: 1.42e12,
      earningsRevisions: 2.14,
      beatRate: 75.0,
      beatRateSource: 'computed',
      avgSurpriseMag: 6.2,
      ...overrides.metrics,
    },
    pillars: {
      valuation: {
        percentile: 40,
        dimensions: {
          trailingPE: { value: 42.13, rank: 20, percentile: 35, sectorMedian: 28.04 },
        },
      },
      earningsConsistency: {
        percentile: 80,
        dimensions: {
          avgSurpriseMag: { value: 6.2, rank: 4, percentile: 82, sectorMedian: 4.1 },
        },
      },
      ...overrides.pillars,
    },
    ...overrides.top,
  };
}

describe('buildFundamentalsMirror — D3 field completeness', () => {
  it('emits exactly the D3 field set from a full doc, rounded at write', () => {
    const out = buildFundamentalsMirror(fullFund());
    expect(out).toEqual({
      trailingPE: { value: 42.1, sectorMedian: 28.0 },
      priceBookMRQ: 8.3,
      revenueGrowthPct: 11.6, // ×100 normalization (D3)
      marketCapClass: 'large',
      earningsRevisions30d: 2.1,
      beatRate: 75,
      surpriseMagPercentile: 82,
      computedAt: Date.parse('2026-07-24T11:01:30Z'),
    });
    // Exact key set — no extras may creep into the persisted doc.
    expect(Object.keys(out).sort()).toEqual([
      'beatRate', 'computedAt', 'earningsRevisions30d', 'marketCapClass',
      'priceBookMRQ', 'revenueGrowthPct', 'surpriseMagPercentile', 'trailingPE',
    ]);
  });

  it('carries peerRankings computedAt provenance through Timestamp-like, Date, and number shapes', () => {
    const viaDate = buildFundamentalsMirror(fullFund());
    expect(viaDate.computedAt).toBe(Date.parse('2026-07-24T11:01:30Z'));

    const ms = Date.parse('2026-07-23T11:00:00Z');
    const viaTimestamp = buildFundamentalsMirror(fullFund({ top: { computedAt: { toMillis: () => ms } } }));
    expect(viaTimestamp.computedAt).toBe(ms);

    const viaNumber = buildFundamentalsMirror(fullFund({ top: { computedAt: ms } }));
    expect(viaNumber.computedAt).toBe(ms);

    const absent = buildFundamentalsMirror(fullFund({ top: { computedAt: undefined } }));
    expect('computedAt' in absent).toBe(false); // other metrics still present
    expect(absent.trailingPE).toEqual({ value: 42.1, sectorMedian: 28.0 });
  });
});

describe('buildFundamentalsMirror — null honesty (C-20)', () => {
  it('an absent metric is OMITTED — no key, never null, never a default', () => {
    const out = buildFundamentalsMirror(fullFund({
      metrics: { priceBookMRQ: null, earningsRevisions: null, marketCap: null },
    }));
    expect('priceBookMRQ' in out).toBe(false);
    expect('earningsRevisions30d' in out).toBe(false);
    expect('marketCapClass' in out).toBe(false);
    expect(Object.values(out)).not.toContain(null);
  });

  it('returns null (whole key omitted upstream) when no metric is available', () => {
    expect(buildFundamentalsMirror(null)).toBeNull();
    expect(buildFundamentalsMirror({})).toBeNull();
    expect(buildFundamentalsMirror({ metrics: {}, computedAt: new Date() })).toBeNull();
    expect(buildFundamentalsMirror({
      metrics: {
        trailingPE: null, priceBookMRQ: null, revenueGrowthYOY: null,
        marketCap: null, earningsRevisions: null, beatRate: null, avgSurpriseMag: null,
      },
      computedAt: new Date(),
    })).toBeNull();
  });

  it('a legitimate 0 SURVIVES (?? discipline, not ||)', () => {
    const out = buildFundamentalsMirror(fullFund({
      metrics: { revenueGrowthYOY: 0, earningsRevisions: 0, beatRate: 0, beatRateSource: 'computed' },
    }));
    expect(out.revenueGrowthPct).toBe(0);
    expect(out.earningsRevisions30d).toBe(0);
    expect(out.beatRate).toBe(0);
  });

  it('the mirror function body contains no neutral-default coercion', () => {
    const src = buildFundamentalsMirror.toString();
    expect(/\?\?\s*50/.test(src)).toBe(false);
    expect(/\|\|\s*0(?![.\d])/.test(src)).toBe(false);
    expect(/\?\?\s*['"`]/.test(src)).toBe(false);
  });
});

describe('buildFundamentalsMirror — D2/F1 suppression on the source marker', () => {
  it("includes beatRate only when beatRateSource === 'computed'", () => {
    expect(buildFundamentalsMirror(fullFund()).beatRate).toBe(75);
    const fabricated = buildFundamentalsMirror(fullFund({ metrics: { beatRateSource: 'sector_default' } }));
    expect('beatRate' in fabricated).toBe(false);
  });

  it('F1: surpriseMagPercentile suppresses on the SAME marker — both f-07 legs travel together', () => {
    // <4 quarters flips avgSurpriseMag to the mean-of-ABSOLUTE formula, which
    // is not comparable to its ≥4-quarter sector peers. The 'computed' state
    // IS the ≥4-quarter condition, so one gate serves both legs.
    expect(buildFundamentalsMirror(fullFund()).surpriseMagPercentile).toBe(82);
    const fabricated = buildFundamentalsMirror(fullFund({ metrics: { beatRateSource: 'sector_default' } }));
    expect('surpriseMagPercentile' in fabricated).toBe(false);
  });

  it('an ABSENT marker (pre-D2 peerRankings doc) suppresses BOTH — transition-safe', () => {
    const preD2 = buildFundamentalsMirror(fullFund({ metrics: { beatRateSource: undefined } }));
    expect('beatRate' in preD2).toBe(false);
    expect('surpriseMagPercentile' in preD2).toBe(false);
  });
});

describe('buildFundamentalsMirror — derived/gated fields', () => {
  it('surpriseMagPercentile is ALSO gated on metrics.avgSurpriseMag presence (no ranking artifact leaks)', () => {
    // beatRateSource stays 'computed' in both fixtures — this test isolates
    // the presence gate from the F1 formula gate.
    const gated = buildFundamentalsMirror(fullFund({ metrics: { avgSurpriseMag: null } }));
    expect('surpriseMagPercentile' in gated).toBe(false);
    // Value present but the pillar dimension missing → also omitted (never invented).
    const noDim = buildFundamentalsMirror(fullFund({ pillars: { earningsConsistency: { dimensions: {} } } }));
    expect('surpriseMagPercentile' in noDim).toBe(false);
  });

  it('trailingPE is value-gated; sectorMedian rides only alongside a real value', () => {
    const noValue = buildFundamentalsMirror(fullFund({ metrics: { trailingPE: null } }));
    expect('trailingPE' in noValue).toBe(false); // the inverted percentile-0 artifact cannot leak
    const noMedian = buildFundamentalsMirror(fullFund({
      pillars: { valuation: { dimensions: { trailingPE: { sectorMedian: null } } } },
    }));
    expect(noMedian.trailingPE).toEqual({ value: 42.1 });
  });

  it('revenueGrowthPct is the ×100 normalization of the source FRACTION (1dp)', () => {
    expect(buildFundamentalsMirror(fullFund({ metrics: { revenueGrowthYOY: 0.116 } })).revenueGrowthPct).toBe(11.6);
    expect(buildFundamentalsMirror(fullFund({ metrics: { revenueGrowthYOY: -0.0425 } })).revenueGrowthPct).toBe(-4.2);
  });

  it("marketCapClass buckets match the rule's param labels (>$10B / $2–10B / <$2B)", () => {
    const cls = (mc) => buildFundamentalsMirror(fullFund({ metrics: { marketCap: mc } })).marketCapClass;
    expect(cls(15e9)).toBe('large');
    expect(cls(10e9)).toBe('mid');   // "$2-10B" is inclusive at the top
    expect(cls(5e9)).toBe('mid');
    expect(cls(2e9)).toBe('mid');    // inclusive at the bottom
    expect(cls(1.9e9)).toBe('small');
    const nonPositive = buildFundamentalsMirror(fullFund({ metrics: { marketCap: 0 } }));
    expect('marketCapClass' in nonPositive).toBe(false);
  });
});

describe('flag gating + doc-size bound', () => {
  const src = readFileSync(SOURCE_PATH, 'utf8');

  it('the attach site is flag-gated and spread-omitted (static-source guard, agent-evaluate.test.js precedent)', () => {
    expect(/const fundamentalsMirror = FUNDAMENTAL_MIRROR_ENABLED\s*\?\s*buildFundamentalsMirror\(fund\)\s*:\s*null/.test(src)).toBe(true);
    expect(/\.\.\.\(fundamentalsMirror \? \{ fundamentals: fundamentalsMirror \} : \{\}\)/.test(src)).toBe(true);
    // Exactly one attach of the key — no second writer.
    expect(src.match(/fundamentals: fundamentalsMirror/g)).toHaveLength(1);
  });

  it('the write path carries the 60% warn guard on the real payload', () => {
    expect(/rankingsApproxBytes > STOCK_RANKINGS_DOC_WARN_BYTES/.test(src)).toBe(true);
    expect(STOCK_RANKINGS_DOC_WARN_BYTES).toBe(629145);
  });

  it('doc-size bound: worst-case mirror × 239-stock universe stays far under the warn line', () => {
    const worst = buildFundamentalsMirror(fullFund());
    const perStock = JSON.stringify(worst).length;
    expect(perStock).toBeLessThanOrEqual(260); // measured ~215; hard ceiling with slack
    const universeMirrorBytes = perStock * 239;
    expect(universeMirrorBytes).toBeLessThan(100_000);

    // Representative full doc simulation: a current-shape stock entry measures
    // ~1,300 B JSON (Phase 0 verified band); mirror added on every entry must
    // keep the whole payload under the 60% warn line with wide margin.
    const representativeEntryBytes = 1300;
    const simulatedDoc = (representativeEntryBytes + perStock) * 239 + 8_000; // + sectors/industries rollups
    expect(simulatedDoc).toBeLessThan(STOCK_RANKINGS_DOC_WARN_BYTES);
  });
});
