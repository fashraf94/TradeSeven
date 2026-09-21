// api/_utils/intraday/validator.test.js — contract §10.2–§10.5 (pure).
import { describe, it, expect } from 'vitest';
import { buildReferenceSeries, lastCompletedBarAt, computeCoverage, alignLogEntries, seriesMetrics, evaluationMetrics, validateSymbolSession, aggregateValidation, referenceBucketCloses, lastReferenceBarStartMs, sessionCalcVersionOf } from './validator.js';
import { aggregateBarsToBuckets } from './seed.js';
import { sessionKeys } from './buckets.js';
import { FIXTURE_BARS } from '../__fixtures__/intradayPollHarness.js';
import { SEP17, makeSession } from '../__fixtures__/intradaySessions.js';

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
  it('A5 — coverage is decided by barsMissing ALONE; the ratio is a diagnostic beside it', () => {
    const full = computeCoverage({ series, session: SEP17, quoteCumulativeVolume: EOD });
    expect(full).toMatchObject({ barsMissing: 0, barsPresent: 391, barsExpected: 391, coverage: 'full', reason: null });
    expect(full.quoteCumulativeVolumeRatio).toBeCloseTo(1, 6);
    expect(full.denominatorSource).toBe('live_v2_last_accepted_volume');

    const holed = buildReferenceSeries(FIXTURE_BARS.filter((_, i) => i !== 100 && i !== 101), SEP17);
    const c = computeCoverage({ series: holed, session: SEP17, quoteCumulativeVolume: EOD });
    expect(c).toMatchObject({ barsMissing: 2, coverage: 'partial', reason: 'bars_missing' });
    expect(c.missingStarts).toEqual([SEP17.openMs + 100 * 60_000, SEP17.openMs + 101 * 60_000]);

    // A5: the `< 90 %` leg is GONE. A denominator 20 % larger than the bar
    // sum used to read `partial / coverage_below_90pct`; with every bar
    // present the series is complete, and that is what coverage means.
    const inflated = computeCoverage({ series, session: SEP17, quoteCumulativeVolume: EOD * 1.2 });
    expect(inflated).toMatchObject({ coverage: 'full', reason: null });
    expect(inflated.quoteCumulativeVolumeRatio).toBeCloseTo(1 / 1.2, 6);

    // No denominator → the RATIO is unavailable, but coverage still stands.
    const noDenom = computeCoverage({ series, session: SEP17, quoteCumulativeVolume: null });
    expect(noDenom).toMatchObject({
      coverage: 'full', reason: null,
      quoteCumulativeVolumeRatio: null, denominatorSource: null,
      ratioUnavailableReason: 'quote_cumulative_volume_unavailable',
    });
  });

  it('A5 — the founder\'s fixture at a 15:44 last-accepted quote reads ~1.97, labelled diagnostic, coverage full', () => {
    // The realistic shape: a 15-minute delayed feed's last accepted quote
    // carries cumulative volume to ~15:44, while the bar series runs to the
    // 16:00 closing auction. The denominator structurally omits it.
    const cutoffUtc = '2026-09-17 19:44:00';
    const cum = FIXTURE_BARS.filter((b) => b.datetime <= cutoffUtc).reduce((a, b) => a + b.volume, 0);
    const c = computeCoverage({ series, session: SEP17, quoteCumulativeVolume: cum });
    expect(c.quoteCumulativeVolumeRatio).toBeGreaterThan(1.9);
    expect(c.quoteCumulativeVolumeRatio).toBeLessThan(2.05);
    expect(c.denominatorSource).toBe('live_v2_last_accepted_volume');
    // ...and it does NOT make the session partial. That was the bug.
    expect(c).toMatchObject({ coverage: 'full', reason: null, barsMissing: 0 });
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

describe('§10.2 / §10.7 — the reference window is the GRADED session\'s calcVersion', () => {
  const EARLY = makeSession('2026-11-27', { early: true, previousEtDate: '2026-11-25' });
  const logAt = (version, count = 3) => Array.from({ length: count }, (_, i) => ({
    sweepAt: SEP17.openMs + (100 + i) * 60_000,
    priceAsOf: SEP17.openMs + (100 + i) * 60_000,
    price: 335, estimate: 334.5,
    estimateCutoff: SEP17.openMs + (100 + i) * 60_000,
    calcVersion: version, strikeKey: `k${i}`,
  }));
  const ringFor = (policy) => ({ buckets: aggregateBarsToBuckets(FIXTURE_BARS, SEP17, { closingRowPolicy: policy }).buckets });
  const validate = (log, policy) => validateSymbolSession({
    sym: 'AAPL', bars: FIXTURE_BARS, session: SEP17,
    doc: { ring: ringFor(policy), state: null, log },
    quoteCumulativeVolume: EOD, views: [], fireTicksOf, calcVersion: 1, policyVersion: 1,
  });

  it('the last reference bar is the calendar close under v1 and 15:59 under v2; an early close gives 12:59', () => {
    expect(lastReferenceBarStartMs(SEP17, 1)).toBe(SEP17.closeMs);
    expect(lastReferenceBarStartMs(SEP17, 2)).toBe(SEP17.closeMs - 60_000);
    expect(lastReferenceBarStartMs(EARLY, 2)).toBe(EARLY.closeMs - 60_000);
    // 12:59 ET, stated as the wall clock the contract names.
    expect(new Date(lastReferenceBarStartMs(EARLY, 2) - 4 * 3600_000).toISOString().slice(11, 16)).toBe('12:59');
    expect(new Date(lastReferenceBarStartMs(SEP17, 2) - 4 * 3600_000).toISOString().slice(11, 16)).toBe('15:59');
  });

  it('v2 uses the 390 rows through 15:59 and excludes the 16:00 row from the series, the coverage denominator and the 5-minute closes', () => {
    const v2 = buildReferenceSeries(FIXTURE_BARS, SEP17, { sessionCalcVersion: 2 });
    expect(v2).toHaveLength(390);
    expect(v2.at(-1).startMs).toBe(SEP17.closeMs - 60_000);
    expect(v2.some((r) => r.startMs === SEP17.closeMs)).toBe(false);
    // The auction's 19.1 M shares are out of the reference VWAP entirely.
    expect(v2.at(-1).cumVol).toBe(FIXTURE_BARS.slice(0, 390).reduce((a, r) => a + r.volume, 0));
    expect(v2.at(-1).cumVol).toBeLessThan(series.at(-1).cumVol);
    expect(v2.at(-1).vwap).not.toBeCloseTo(series.at(-1).vwap, 6);

    const cov = computeCoverage({ series: v2, session: SEP17, quoteCumulativeVolume: EOD, sessionCalcVersion: 2 });
    expect(cov).toMatchObject({ barsExpected: 390, barsPresent: 390, barsMissing: 0, coverage: 'full' });

    const ref5 = referenceBucketCloses(v2, SEP17);
    const { lastKey } = sessionKeys(SEP17);
    expect(ref5.get(lastKey).close).toBe(FIXTURE_BARS[389].close);
    expect(ref5.get(lastKey).close).not.toBe(FIXTURE_BARS[390].close);
  });

  it('a v1-stamped session is graded with the OLD window, through the 16:00 row — the grader\'s own constant never decides', () => {
    const r = validate(logAt(1), null);
    expect(r.sessionCalcVersion).toBe(1);
    expect(r.calcVersionSource).toBe('log');
    expect(r.calcVersionMixed).toBe(false);
    expect(r.referenceWindow.lastBarStartMs).toBe(SEP17.closeMs);
    expect(r.coverage.barsExpected).toBe(391);
    expect(r.coverage.barsPresent).toBe(391);
    // The same bars graded as v2 shrink to the continuous session.
    const v2 = validate(logAt(2), 'continuous_session');
    expect(v2.sessionCalcVersion).toBe(2);
    expect(v2.referenceWindow.lastBarStartMs).toBe(SEP17.closeMs - 60_000);
    expect(v2.coverage.barsExpected).toBe(390);
    expect(v2.coverage.barsPresent).toBe(390);
    expect(v2.qualification).toEqual({ included: true, reason: null });
  });

  it('a session whose entries straddle the bump is `calc_version_mixed` and excluded from qualification, while still being reported', () => {
    const mixed = validate([...logAt(1, 2), ...logAt(2, 2)], 'continuous_session');
    expect(mixed.calcVersionMixed).toBe(true);
    expect(mixed.calcVersions).toEqual([1, 2]);
    expect(mixed.qualification).toEqual({ included: false, reason: 'calc_version_mixed' });
    // Excluded, not erased: the numbers are still there to look at.
    expect(mixed.series.comparisons).toBeGreaterThan(0);
    expect(mixed.coverage.coverage).toBe('full');
    const agg = aggregateValidation({ AAPL: mixed }, { etDate: '2026-09-17', calcVersion: 2, policyVersion: 1, firstPublishHourUtc: 11, status: 'done', computedAt: 2 });
    expect(agg.symbolsQualified).toBe(0);
    expect(agg.symbolsCalcVersionMixed).toBe(1);
    expect(agg.symbolsByCalcVersion).toEqual({ 2: 1 });
  });

  it('an empty log falls back to the grader\'s calcVersion and says so, rather than guessing silently', () => {
    expect(sessionCalcVersionOf([], 7)).toEqual({ calcVersion: 7, mixed: false, versions: [], source: 'fallback' });
    expect(sessionCalcVersionOf(logAt(2), 7)).toEqual({ calcVersion: 2, mixed: false, versions: [2], source: 'log' });
  });
});

describe('§10.5 per-symbol result and aggregate — unavailable reasons, never zero', () => {
  it('validateSymbolSession + aggregateValidation over one symbol with the closing row unresolved', () => {
    const { buckets } = aggregateBarsToBuckets(FIXTURE_BARS, SEP17); // last bucket closeQualified false (policy null)
    const doc = { ring: { buckets }, state: null, log: [{ sweepAt: 1, priceAsOf: SEP17.openMs + 30 * 60_000 + 20_000, price: 335, estimate: 334.5, estimateCutoff: null, strikeKey: 'k' }] };
    const r = validateSymbolSession({ sym: 'AAPL', bars: FIXTURE_BARS, session: SEP17, doc, quoteCumulativeVolume: EOD, views: [], fireTicksOf, calcVersion: 1, policyVersion: 1 });
    expect(r.coverage).toMatchObject({ coverage: 'full', denominatorSource: 'live_v2_last_accepted_volume' });
    expect(r.coverage.quoteCumulativeVolumeRatio).toBeCloseTo(1, 6);
    expect(r.closeQualified).toBe(false);
    expect(r.qualification).toEqual({ included: false, reason: 'close_unqualified' });
    expect(r.series.unavailable).toMatchObject({ p95AbsResidualOverPrice: 'no_aligned_comparisons', sma20P95AbsResidualOverPrice: 'close_unqualified', macdEventAgreement: 'close_unqualified' });
    expect(r.series.excludedByReason).toEqual({ cutoff_unconfirmed: 1 });
    expect(r.evaluationLinked.unavailable).toEqual({ evaluationLinked: 'no_evaluation_evidence' });
    const agg = aggregateValidation({ AAPL: r }, { etDate: '2026-09-17', calcVersion: 1, policyVersion: 1, firstPublishHourUtc: 11, status: 'done', computedAt: 2 });
    expect(agg).toMatchObject({ symbolsValidated: 1, symbolsQualified: 0, firstPublishHourUtc: 11, lostCoverageByReason: {} });
    expect(agg.quoteCumulativeVolumeRatio).toBeCloseTo(1, 6);
    for (const k of ['p95AbsResidualOverPrice', 'falseStrikeRate', 'missedStrikeRate', 'nearThresholdDisagreement', 'replayedExitDisagreement', 'sma20P95AbsResidualOverPrice', 'macdEventAgreement']) {
      expect(agg[k], k).toBeNull();
      expect(typeof agg.unavailable[k], k).toBe('string');
    }
    expect(agg.unavailable.sma20P95AbsResidualOverPrice).toBe('no_qualified_series');
    expect(agg.unavailable.falseStrikeRate).toBe('no_evaluation_evidence');
    expect(Object.values(agg.unavailable).some((v) => v === 0 || v === '0')).toBe(false);
  });
});
