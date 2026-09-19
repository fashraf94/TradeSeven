// api/_utils/intraday/validator.test.js — contract §10.2–§10.5 (pure).
import { describe, it, expect } from 'vitest';
import { buildReferenceSeries, lastCompletedBarAt, computeCoverage, alignLogEntries, seriesMetrics, evaluationMetrics, validateSymbolSession, aggregateValidation, referenceBucketCloses } from './validator.js';
import { aggregateBarsToBuckets } from './seed.js';
import { sessionKeys } from './buckets.js';
import { FIXTURE_BARS } from '../__fixtures__/intradayPollHarness.js';
import { SEP17 } from '../__fixtures__/intradaySessions.js';

const series = buildReferenceSeries(FIXTURE_BARS, SEP17);
const EOD = FIXTURE_BARS.reduce((a, r) => a + r.volume, 0);
const fireTicksOf = () => 2;

describe('§10.2 reference series and coverage', () => {
  it('refVWAP(t) uses bars with start + 60 s ≤ t; the 16:00 row enters only after 20:01 UTC', () => {
    expect(series).toHaveLength(391);
    const at1345 = lastCompletedBarAt(series, SEP17.openMs + 15 * 60_000);
    expect(at1345.startMs).toBe(SEP17.openMs + 14 * 60_000);
    const first15 = FIXTURE_BARS.slice(0, 15);
    const ref = first15.reduce((a, r) => a + ((r.high + r.low + r.close) / 3) * r.volume, 0) / first15.reduce((a, r) => a + r.volume, 0);
    expect(at1345.vwap).toBeCloseTo(ref, 9);
    expect(lastCompletedBarAt(series, SEP17.closeMs).startMs).toBe(SEP17.closeMs - 60_000);
    expect(lastCompletedBarAt(series, SEP17.closeMs + 60_000).startMs).toBe(SEP17.closeMs);
    expect(lastCompletedBarAt(series, SEP17.openMs + 59_000)).toBeNull();
  });
  it('coverage: full fixture at 100 %; missing bars → partial; no EOD volume → unknown', () => {
    expect(computeCoverage({ series, session: SEP17, eodVolume: EOD })).toMatchObject({ referenceCoveragePct: 100, barsMissing: 0, barsPresent: 391, barsExpected: 391, coverage: 'full', reason: null });
    const holed = buildReferenceSeries(FIXTURE_BARS.filter((_, i) => i !== 100 && i !== 101), SEP17);
    const c = computeCoverage({ series: holed, session: SEP17, eodVolume: EOD });
    expect(c).toMatchObject({ barsMissing: 2, coverage: 'partial', reason: 'bars_missing' });
    expect(c.missingStarts).toEqual([SEP17.openMs + 100 * 60_000, SEP17.openMs + 101 * 60_000]);
    expect(computeCoverage({ series, session: SEP17, eodVolume: EOD * 1.2 })).toMatchObject({ coverage: 'partial', reason: 'coverage_below_90pct' });
    expect(computeCoverage({ series, session: SEP17, eodVolume: null })).toMatchObject({ coverage: 'unknown', reason: 'eod_volume_unavailable', referenceCoveragePct: null });
  });
});

describe('§10.3 alignment', () => {
  it('a null estimateCutoff is excluded (cutoff_unconfirmed) but the price-source residual still aligns on priceAsOf', () => {
    const [a] = alignLogEntries({ log: [{ sweepAt: 1, priceAsOf: SEP17.openMs + 30 * 60_000 + 20_000, price: 335, estimate: 334.5, estimateCutoff: null }], series });
    expect(a.excluded).toBe('cutoff_unconfirmed');
    expect(a.priceReferenceCutoff).toBe(SEP17.openMs + 30 * 60_000);
    expect(a.refClose).toBe(FIXTURE_BARS[29].close);
    expect(a.priceResidual).toBeCloseTo(335 - FIXTURE_BARS[29].close, 9);
  });
  it('with a cutoff: referenceCutoff is the end of the last completed bar ≤ cutoff; alignmentLagMs and comparisonResidual recorded; a missing bar before excludes', () => {
    const cutoff = SEP17.openMs + 30 * 60_000 + 25_000;
    const [a] = alignLogEntries({ log: [{ sweepAt: 1, priceAsOf: cutoff, price: 335, estimate: 334.5, estimateCutoff: cutoff }], series });
    expect(a.excluded).toBeNull();
    expect(a.referenceCutoff).toBe(SEP17.openMs + 30 * 60_000);
    expect(a.alignmentLagMs).toBe(25_000);
    expect(a.comparisonResidual).toBeCloseTo(334.5 - lastCompletedBarAt(series, cutoff).vwap, 9);
    const holed = buildReferenceSeries(FIXTURE_BARS.filter((_, i) => i !== 30), SEP17);
    const cutoff2 = SEP17.openMs + 31 * 60_000 + 10_000; // bar 30 (13:60) missing → last completed is bar 29's end, and bar 30's start lies between
    const [b] = alignLogEntries({ log: [{ sweepAt: 1, priceAsOf: cutoff2, price: 1, estimate: 1, estimateCutoff: cutoff2 }], series: holed, missingStarts: [SEP17.openMs + 30 * 60_000] });
    expect(b.missingBarBefore).toBe(true);
    expect(b.excluded).toBe('missing_bar_before_comparison');
    expect(b.alignmentLagMs).toBe(70_000);
  });
});

describe('§10.4 / §10.5 series metrics', () => {
  const { buckets } = aggregateBarsToBuckets(FIXTURE_BARS, SEP17);
  const ring = { buckets: buckets.map((b) => ({ ...b, seeded: false })) };
  it('a ring built from the same bars has zero bucket residual, zero SMA residual and full MACD event agreement when the series is qualified', () => {
    const m = seriesMetrics({ aligned: [], ring, series, session: SEP17, closeQualifiedSeries: true });
    expect(m.bucketCloseComparisons).toBe(78);
    expect(m.bucketCloseP95AbsResidualOverPrice).toBe(0);
    expect(m.sma20P95AbsResidualOverPrice).toBe(0);
    expect(m.macdEventAgreement === null || m.macdEventAgreement === 1).toBe(true);
    expect(m.unavailable.p95AbsResidualOverPrice).toBe('no_aligned_comparisons');
    expect(referenceBucketCloses(series, SEP17).get(sessionKeys(SEP17).lastKey).close).toBe(FIXTURE_BARS[390].close);
  });
  it('an unqualified series is excluded from every qualification metric (closeQualified is CHECKED)', () => {
    const m = seriesMetrics({ aligned: [], ring, series, session: SEP17, closeQualifiedSeries: false });
    expect(m.sma20P95AbsResidualOverPrice).toBeNull();
    expect(m.unavailable.sma20P95AbsResidualOverPrice).toBe('close_unqualified');
    expect(m.unavailable.macdEventAgreement).toBe('close_unqualified');
    expect(m.bucketCloseComparisons).toBe(78); // the raw close comparison is not a qualification metric
  });
});

describe('§10.4 evaluation-linked metrics', () => {
  const rec = (price, est, cutoff, strikeKey) => ({ price: { value: price, priceAsOf: cutoff }, strikeKey, indicators: { vwap: { value: est, estimateCutoff: cutoff } } });
  it('no evaluation evidence → unavailable no_evaluation_evidence; unconfirmed cutoffs → excluded with the reason', () => {
    expect(evaluationMetrics({ views: [], sym: 'AAPL', series, fireTicksOf })).toMatchObject({ evaluations: 0, unavailable: { evaluationLinked: 'no_evaluation_evidence' } });
    const v = { evalId: 'e1', battleId: 'b', evaluatedAt: 1, presetId: 'balanced', presetBand: 0.5, symbols: { AAPL: rec(330, 334, null, 'k1') } };
    expect(evaluationMetrics({ views: [v], sym: 'AAPL', series, fireTicksOf })).toMatchObject({ evaluations: 1, unavailable: { evaluationLinked: { cutoff_unconfirmed: 1 } } });
  });
  it('agreement / false strike / missed strike / near-threshold / replayed exits on both series keyed by strikeKey', () => {
    const t = (m) => SEP17.openMs + m * 60_000 + 30_000;
    const refAt = (m) => lastCompletedBarAt(series, t(m)).vwap;
    // Build views: est deviation vs reference deviation with controlled disagreement.
    const mk = (id, m, price, est, key) => ({ evalId: id, battleId: 'b', evaluatedAt: t(m), presetId: 'balanced', presetBand: 0.5, symbols: { AAPL: rec(price, est, t(m), key) } });
    const r60 = refAt(60);
    const views = [
      mk('e1', 60, r60 * (1 - 0.01), r60, 'k1'),                 // both strike (−1 %)
      mk('e2', 61, r60 * (1 - 0.01), r60, 'k1'),                 // same strikeKey: counter does not advance
      mk('e3', 62, refAt(62) * (1 - 0.01), refAt(62), 'k2'),     // both strike → est and ref fire at 2
      mk('e4', 63, refAt(63) * (1 - 0.001), refAt(63) * 1.05, 'k3'), // est strike (est high), ref no strike → false strike
      mk('e5', 64, refAt(64) * (1 + 0.002), refAt(64), 'k4'),    // neither
      mk('e6', 65, refAt(65) * (1 - 0.0045), refAt(65), 'k5'),   // ref dev −0.45: near threshold (|−0.45 − (−0.5)| ≤ 0.25), neither strikes
    ];
    const m = evaluationMetrics({ views, sym: 'AAPL', series, fireTicksOf });
    expect(m.usable).toBe(6);
    expect(m.counts).toMatchObject({ falseStrike: 1, missedStrike: 0, refStrikes: 3, near: 1, nearDisagree: 0 });
    expect(m.agreement).toBeCloseTo(5 / 6, 9);
    expect(m.falseStrikeRate).toBeCloseTo(1 / 4, 9);
    expect(m.missedStrikeRate).toBe(0);
    expect(m.nearThresholdDisagreement).toBe(0);
    // Replay: k1 (strike, both count 1), k1 again skipped, k2 (both 2 → both fire, agree), k3 (est 1, ref 0), k4 (0,0), k5 (0,0).
    expect(m.counts.fires).toBe(1);
    expect(m.replayedExitDisagreement).toBe(0);
  });
});

describe('§10.5 per-symbol result and aggregate — unavailable reasons, never zero', () => {
  it('validateSymbolSession + aggregateValidation over one symbol with the closing row unresolved', () => {
    const { buckets } = aggregateBarsToBuckets(FIXTURE_BARS, SEP17); // last bucket closeQualified false (policy null)
    const doc = { ring: { buckets }, state: null, log: [{ sweepAt: 1, priceAsOf: SEP17.openMs + 30 * 60_000 + 20_000, price: 335, estimate: 334.5, estimateCutoff: null, strikeKey: 'k' }] };
    const r = validateSymbolSession({ sym: 'AAPL', bars: FIXTURE_BARS, session: SEP17, doc, eodVolume: EOD, views: [], fireTicksOf, calcVersion: 1, policyVersion: 1 });
    expect(r.coverage).toMatchObject({ referenceCoveragePct: 100, coverage: 'full', eodVolumeSource: 'live_v2_last_accepted_volume' });
    expect(r.closeQualified).toBe(false);
    expect(r.qualification).toEqual({ included: false, reason: 'close_unqualified' });
    expect(r.series.unavailable).toMatchObject({ p95AbsResidualOverPrice: 'no_aligned_comparisons', sma20P95AbsResidualOverPrice: 'close_unqualified', macdEventAgreement: 'close_unqualified' });
    expect(r.series.excludedByReason).toEqual({ cutoff_unconfirmed: 1 });
    expect(r.evaluationLinked.unavailable).toEqual({ evaluationLinked: 'no_evaluation_evidence' });
    const agg = aggregateValidation({ AAPL: r }, { etDate: '2026-09-17', calcVersion: 1, policyVersion: 1, firstPublishHourUtc: 11, status: 'done', computedAt: 2 });
    expect(agg).toMatchObject({ symbolsValidated: 1, symbolsQualified: 0, referenceCoveragePct: 100, firstPublishHourUtc: 11, lostCoverageByReason: {} });
    for (const k of ['p95AbsResidualOverPrice', 'falseStrikeRate', 'missedStrikeRate', 'nearThresholdDisagreement', 'replayedExitDisagreement', 'sma20P95AbsResidualOverPrice', 'macdEventAgreement']) {
      expect(agg[k], k).toBeNull();
      expect(typeof agg.unavailable[k], k).toBe('string');
    }
    expect(agg.unavailable.sma20P95AbsResidualOverPrice).toBe('no_qualified_series');
    expect(agg.unavailable.falseStrikeRate).toBe('no_evaluation_evidence');
    expect(Object.values(agg.unavailable).some((v) => v === 0 || v === '0')).toBe(false);
  });
});
