// api/_utils/intraday/accumulator.test.js — contract §5.4, §5.5, §5.6.
import { describe, it, expect } from 'vitest';
import { applyObservation, newAccumulator, vwapEstimate, computeVolumePace, validateObservation, OUTCOME } from './accumulator.js';
import { SEP17, SEP16, obsAt } from '../__fixtures__/intradaySessions.js';

const ctx = (obs, over = {}) => ({
  obsEtDate: '2026-09-17', obsSession: SEP17, pollSession: SEP17, futureToleranceMs: 60_000, ...over,
});
const run = (acc, obs, over) => applyObservation(acc, obs, ctx(obs, over));

describe('§5.5 numeric validation', () => {
  it('rejects a missing / non-finite / future / pre-open priceAsOf and a non-positive price, each with a coded reason', () => {
    const base = obsAt(SEP17, 10);
    expect(run(null, { ...base, priceAsOf: null })).toMatchObject({ outcome: OUTCOME.REJECTED, reason: 'price_as_of_missing', anomaly: 'rejected' });
    expect(run(null, { ...base, priceAsOf: NaN })).toMatchObject({ outcome: OUTCOME.REJECTED, reason: 'price_as_of_missing' });
    expect(run(null, { ...base, priceAsOf: base.availableAt + 60_001 })).toMatchObject({ outcome: OUTCOME.REJECTED, reason: 'price_as_of_future' });
    expect(run(null, { ...base, priceAsOf: base.availableAt + 60_000 }).outcome).not.toBe(OUTCOME.REJECTED);
    expect(run(null, { ...base, priceAsOf: SEP17.openMs - 1 })).toMatchObject({ outcome: OUTCOME.REJECTED, reason: 'price_as_of_before_open' });
    expect(run(null, { ...base, price: 0 })).toMatchObject({ outcome: OUTCOME.REJECTED, reason: 'price_invalid' });
    expect(run(null, { ...base, price: -1 })).toMatchObject({ outcome: OUTCOME.REJECTED, reason: 'price_invalid' });
    expect(run(null, { ...base, price: null })).toMatchObject({ outcome: OUTCOME.REJECTED, reason: 'price_invalid' });
    expect(run(null, base, { obsSession: null })).toMatchObject({ outcome: OUTCOME.REJECTED, reason: 'no_session_for_date' });
  });
  it('a rejected observation leaves the accumulator untouched', () => {
    const acc = run(null, obsAt(SEP17, 1, { volume: 100 })).acc;
    const after = run(acc, obsAt(SEP17, 2, { price: -5 }));
    expect(after.acc).toBe(acc);
  });
  it('volume invalid (missing / non-finite / negative): price-based updates proceed, volume-based skip, counted volumeInvalid', () => {
    const first = run(null, obsAt(SEP17, 1, { price: 100, volume: 1000 }));
    for (const volume of [null, NaN, -1, 'x']) {
      const r = run(first.acc, obsAt(SEP17, 2, { price: 101, volume }));
      expect(r.outcome).toBe(OUTCOME.ACCEPTED);
      expect(r.priceNew).toBe(true);
      expect(r.volumeInvalid).toBe(true);
      expect(r.anomaly).toBe('volumeInvalid');
      expect(r.acc.lastAcceptedAsOf).toBe(SEP17.openMs + 2 * 60_000);
      expect(r.acc.lastAcceptedPrice).toBe(101);
      // The accumulator did not move.
      expect(r.acc.num).toBe(first.acc.num); expect(r.acc.den).toBe(first.acc.den); expect(r.acc.samples).toBe(first.acc.samples);
      expect(r.acc.lastAcceptedVolume).toBe(1000);
    }
    expect(validateObservation(obsAt(SEP17, 1, { high: null }), { obsSession: SEP17, futureToleranceMs: 60_000 }).hlInvalid).toBe(true);
  });
});

describe('§5.4 the VWAP estimate', () => {
  it('first accepted observation: num = HLC3 × volume, den = volume, samples = 1; price × volume when H/L null', () => {
    const r = run(null, obsAt(SEP17, 1, { price: 100, volume: 1000, high: 102, low: 98 }));
    expect(r.outcome).toBe(OUTCOME.ACCEPTED);
    expect(r.acc.num).toBeCloseTo(((102 + 98 + 100) / 3) * 1000, 9);
    expect(r.acc.den).toBe(1000);
    expect(r.acc.samples).toBe(1);
    expect(vwapEstimate(r.acc)).toBeCloseTo(100, 9);
    const r2 = run(null, obsAt(SEP17, 1, { price: 100, volume: 1000 }));
    expect(r2.acc.num).toBe(100 * 1000);
    expect(r2.hlInvalid).toBe(true);
  });
  it('subsequent accepted observations add Δvol at the new price; Δvol = 0 adds nothing and no sample', () => {
    let { acc } = run(null, obsAt(SEP17, 1, { price: 100, volume: 1000 }));
    ({ acc } = run(acc, obsAt(SEP17, 2, { price: 110, volume: 1500 })));
    expect(acc.num).toBe(100 * 1000 + 110 * 500);
    expect(acc.den).toBe(1500);
    expect(acc.samples).toBe(2);
    expect(vwapEstimate(acc)).toBeCloseTo((100000 + 55000) / 1500, 9);
    const r = run(acc, obsAt(SEP17, 3, { price: 120, volume: 1500 }));
    expect(r.outcome).toBe(OUTCOME.ACCEPTED);
    expect(r.deltaVol).toBe(0);
    expect(r.acc.samples).toBe(2);
    expect(r.acc.num).toBe(acc.num);
    expect(r.acc.lastAcceptedAsOf).toBe(SEP17.openMs + 3 * 60_000);
  });
  it('estimate is null until volume has been assigned', () => {
    expect(vwapEstimate(newAccumulator('2026-09-17'))).toBeNull();
    const r = run(null, obsAt(SEP17, 1, { price: 100, volume: null }));
    expect(vwapEstimate(r.acc)).toBeNull();
  });
});

describe('§5.5 classification', () => {
  const first = () => run(null, obsAt(SEP17, 5, { price: 100, volume: 1000 }));

  it('unchanged: same priceAsOf and volume → no update, unchangedCount, NOT an anomaly (a refreshed snapshotTs is normal)', () => {
    const { acc } = first();
    const o = obsAt(SEP17, 5, { price: 100, volume: 1000, snapshotLagMs: 20 * 60_000 });
    const r = run(acc, o);
    expect(r.outcome).toBe(OUTCOME.UNCHANGED);
    expect(r.anomaly).toBeNull();
    expect(r.acc).toBe(acc);
    expect(r.priceNew).toBe(false);
    // strikeKey unchanged across the refreshed snapshotTs; observationId records the revision.
    const f = first();
    expect(r.strikeKey).toBe(f.strikeKey);
    expect(r.observationId).not.toBe(f.observationId);
  });

  it('volume-only advance: same priceAsOf, larger volume → Δvol at the last accepted price; not an anomaly', () => {
    const { acc } = first();
    const r = run(acc, obsAt(SEP17, 5, { price: 100, volume: 1300 }));
    expect(r.outcome).toBe(OUTCOME.VOLUME_ONLY_ADVANCE);
    expect(r.anomaly).toBeNull();
    expect(r.deltaVol).toBe(300);
    expect(r.acc.num).toBe(100 * 1000 + 100 * 300);
    expect(r.acc.den).toBe(1300);
    expect(r.acc.samples).toBe(2);
    expect(r.acc.lastAcceptedVolume).toBe(1300);
    expect(r.priceNew).toBe(false);
  });

  it('regressed vs unchanged: an earlier priceAsOf or a smaller volume is HELD (anomaly), nothing applied', () => {
    const { acc } = first();
    const back = run(acc, obsAt(SEP17, 4, { price: 99, volume: 1000 }));
    expect(back.outcome).toBe(OUTCOME.HELD);
    expect(back.anomaly).toBe('held');
    expect(back.reason).toBe('price_as_of_regressed');
    expect(back.acc.num).toBe(acc.num);
    expect(back.acc.lastAcceptedAsOf).toBe(acc.lastAcceptedAsOf);
    expect(back.acc.holding).toBe(true);
    const less = run(acc, obsAt(SEP17, 6, { price: 101, volume: 900 }));
    expect(less.outcome).toBe(OUTCOME.HELD);
    expect(less.reason).toBe('volume_regressed');
    const same = run(acc, obsAt(SEP17, 5, { price: 100, volume: 1000 }));
    expect(same.outcome).toBe(OUTCOME.UNCHANGED);
  });

  it('resume: after a hold, the next observation with later priceAsOf and volume ≥ last assigns the gap at its price (gapAssigned)', () => {
    const { acc } = first();
    const held = run(acc, obsAt(SEP17, 6, { price: 101, volume: 900 })).acc;
    const r = run(held, obsAt(SEP17, 7, { price: 102, volume: 1400 }));
    expect(r.outcome).toBe(OUTCOME.RESUMED);
    expect(r.anomaly).toBe('gapAssigned');
    expect(r.deltaVol).toBe(400);
    expect(r.acc.num).toBe(100 * 1000 + 102 * 400);
    expect(r.acc.holding).toBe(false);
    expect(r.priceNew).toBe(true);
  });

  it('two DISTINCT held observations in a session set degraded; the same held observation twice does not', () => {
    const { acc } = first();
    const h1 = run(acc, obsAt(SEP17, 4, { price: 99, volume: 1000 }));
    expect(h1.acc.degraded).toBe(false);
    expect(h1.acc.heldObservationIds).toHaveLength(1);
    const h1again = run(h1.acc, obsAt(SEP17, 4, { price: 99, volume: 1000 }));
    expect(h1again.acc.degraded).toBe(false);
    expect(h1again.acc.heldObservationIds).toHaveLength(1);
    const h2 = run(h1.acc, obsAt(SEP17, 4, { price: 99, volume: 1000, snapshotLagMs: 30 * 60_000 }));
    expect(h2.acc.degraded).toBe(true);
    expect(h2.acc.heldObservationIds).toHaveLength(2);
  });

  it('numeric validation with volume-invalid leaves the price indicators intact (priceNew true) while the accumulator skips', () => {
    const { acc } = first();
    const r = run(acc, obsAt(SEP17, 6, { price: 105, volume: null }));
    expect(r.priceNew).toBe(true);
    expect(r.outcome).toBe(OUTCOME.ACCEPTED);
    expect(r.acc.den).toBe(acc.den);
    // Same-priceAsOf refresh with unusable volume: unchanged, counted volumeInvalid.
    const r2 = run(r.acc, obsAt(SEP17, 6, { price: 105, volume: null }));
    expect(r2.outcome).toBe(OUTCOME.UNCHANGED);
    expect(r2.anomaly).toBe('volumeInvalid');
  });
});

describe('§5.6 rollover — on the ET date of the observation\'s OWN priceAsOf, before any comparison', () => {
  it('overnight volume reset is not an anomaly: a yesterday-dated accumulator resets on today\'s first trade', () => {
    let acc = run(null, obsAt(SEP16, 380, { price: 90, volume: 50_000_000 }), { obsEtDate: '2026-09-16', obsSession: SEP16, pollSession: SEP16 }).acc;
    expect(acc.sessionEtDate).toBe('2026-09-16');
    const r = run(acc, obsAt(SEP17, 1, { price: 91, volume: 120_000 }));
    expect(r.rollover).toBe(true);
    expect(r.outcome).toBe(OUTCOME.ACCEPTED);
    expect(r.anomaly).toBeNull();
    expect(r.acc.sessionEtDate).toBe('2026-09-17');
    expect(r.acc.num).toBe(91 * 120_000);
    expect(r.acc.den).toBe(120_000);
    expect(r.acc.degraded).toBe(false);
    expect(r.acc.heldObservationIds).toEqual([]);
  });
  it("yesterday's closing quote before today's first trade is `prior_session` — no update, no anomaly", () => {
    const stale = obsAt(SEP16, 390, { price: 90, volume: 50_000_000 });
    const r = run(null, stale, { obsEtDate: '2026-09-16', obsSession: SEP16, pollSession: SEP17 });
    expect(r.outcome).toBe(OUTCOME.PRIOR_SESSION);
    expect(r.anomaly).toBeNull();
    expect(r.acc.lastAcceptedAsOf).toBeNull();
  });
  it('a priceAsOf dated AFTER the poller\'s session is rejected', () => {
    const r = run(null, obsAt(SEP17, 1), { obsEtDate: '2026-09-18', obsSession: SEP17, pollSession: SEP16 });
    expect(r.outcome).toBe(OUTCOME.REJECTED);
    expect(r.reason).toBe('price_as_of_after_session');
  });
  it('the rollover happens BEFORE the regression comparison (a smaller overnight volume is never held)', () => {
    const acc = run(null, obsAt(SEP16, 380, { price: 90, volume: 50_000_000 }), { obsEtDate: '2026-09-16', obsSession: SEP16, pollSession: SEP16 }).acc;
    const r = run(acc, obsAt(SEP17, 1, { price: 91, volume: 1000 }));
    expect(r.outcome).toBe(OUTCOME.ACCEPTED);
    expect(r.acc.heldObservationIds).toEqual([]);
  });
});

describe('§5.4 volumePace', () => {
  it('absent with cutoff_unconfirmed while the cutoff is null (VOLUME_CUTOFF_FIELD null in build 1)', () => {
    expect(computeVolumePace({ volume: 1000, averageVolume: 100_000, volumeCutoffAsOf: null, session: SEP17, volumeInvalid: false }))
      .toEqual({ status: 'absent', value: null, method: 'linear_pace', elapsedAtCutoffMin: null, reason: 'cutoff_unconfirmed' });
  });
  it('the restored formula: volume / (averageVolume × elapsed / sessionLen); the early-close session uses its shorter length', () => {
    const cutoff = SEP17.openMs + 39 * 60_000; // 39 min = 10% of 390
    const r = computeVolumePace({ volume: 2_000_000, averageVolume: 10_000_000, volumeCutoffAsOf: cutoff, session: SEP17, volumeInvalid: false });
    expect(r.status).toBe('ready');
    expect(r.value).toBeCloseTo(2, 9);
    expect(r.elapsedAtCutoffMin).toBe(39);
    const early = { ...SEP17, closeMs: SEP17.openMs + 210 * 60_000 };
    const r2 = computeVolumePace({ volume: 2_000_000, averageVolume: 10_000_000, volumeCutoffAsOf: SEP17.openMs + 21 * 60_000, session: early, volumeInvalid: false });
    expect(r2.value).toBeCloseTo(2, 9);
  });
  it('absent reasons: insufficient_elapsed (< 5 min), no_reference_volume, volume_invalid', () => {
    const cutoff = SEP17.openMs + 4 * 60_000;
    expect(computeVolumePace({ volume: 1, averageVolume: 1, volumeCutoffAsOf: cutoff, session: SEP17, volumeInvalid: false }).reason).toBe('insufficient_elapsed');
    expect(computeVolumePace({ volume: 1, averageVolume: 0, volumeCutoffAsOf: SEP17.openMs + 10 * 60_000, session: SEP17, volumeInvalid: false }).reason).toBe('no_reference_volume');
    expect(computeVolumePace({ volume: 1, averageVolume: null, volumeCutoffAsOf: SEP17.openMs + 10 * 60_000, session: SEP17, volumeInvalid: false }).reason).toBe('no_reference_volume');
    expect(computeVolumePace({ volume: null, averageVolume: 5, volumeCutoffAsOf: SEP17.openMs + 10 * 60_000, session: SEP17, volumeInvalid: true }).reason).toBe('volume_invalid');
  });
});
