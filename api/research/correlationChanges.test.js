/**
 * Change 2 ("Since your last scan") unit tests — snapshot-carry, the
 * fingerprint-gated comparison, and the change-event model with its floors,
 * ordering, and honest degenerate states.
 */
import { describe, it, expect } from 'vitest';
import {
  compactSnapshot,
  carryPriorSnapshot,
  buildComparison,
  computeChanges,
  driverUniverseHash,
} from './correlationChanges.js';

const FP = {
  membershipHash: 'mh-1',
  driverUniverseHash: 'uh-1',
  methodologyVersion: 'corr-v3',
  changePolicyVersion: '1',
};

function snap(day, drivers, fp = FP) {
  return { observationTradingDay: day, ...fp, drivers };
}
function driver(o) {
  return { driverId: 'TNX', rank: 1, tier: 'established', corr20: 0.6, corr60: 0.55, adjusted20: 0.4, tensionState: 'calm', ...o };
}

describe('compactSnapshot', () => {
  it('captures the pinned per-driver fields + fingerprints', () => {
    const s = compactSnapshot({
      rows: [{ driver: 'TNX', tier: 'established', corr20: 0.6, corr60: 0.55, tensionState: 'calm', rq: { partial: { w20: { adjusted: 0.4 } } } }],
      observationTradingDay: '2026-07-10',
      fingerprints: FP,
    });
    expect(s.observationTradingDay).toBe('2026-07-10');
    expect(s.membershipHash).toBe('mh-1');
    expect(s.drivers[0]).toEqual({ driverId: 'TNX', rank: 1, tier: 'established', corr20: 0.6, corr60: 0.55, adjusted20: 0.4, adjustedSuppressed: false, tensionState: 'calm' });
  });
  it('suppressed/skipped adjusted collapses to null', () => {
    const s = compactSnapshot({ rows: [{ driver: 'SPX', corr20: 0.9, corr60: 0.9, tier: 'established', tensionState: null, rq: { partial: { w20: { suppressed: 'driver_is_market' } } } }], observationTradingDay: '2026-07-10', fingerprints: FP });
    expect(s.drivers[0].adjusted20).toBeNull();
  });
});

describe('carryPriorSnapshot — snapshot-carry idiom', () => {
  it('a DIFFERENT observation day → the existing snapshot becomes the baseline', () => {
    const existing = { snapshot: snap('2026-07-06', [driver()]), priorSnapshot: null };
    const carried = carryPriorSnapshot(existing, '2026-07-09');
    expect(carried.observationTradingDay).toBe('2026-07-06');
  });
  it('the SAME observation day → preserve the existing priorSnapshot unchanged (never advance the baseline)', () => {
    const prior = snap('2026-07-02', [driver()]);
    const existing = { snapshot: snap('2026-07-06', [driver()]), priorSnapshot: prior };
    // A Monday-premarket recompute on Friday's bars: same observation day as the existing doc.
    const carried = carryPriorSnapshot(existing, '2026-07-06');
    expect(carried).toBe(prior);
  });
  it('malformed legacy priorSnapshot is tolerated (→ null)', () => {
    const existing = { snapshot: { garbage: true }, priorSnapshot: { also: 'bad' } };
    expect(carryPriorSnapshot(existing, '2026-07-09')).toBeNull();
  });
  it('no existing doc → null', () => {
    expect(carryPriorSnapshot(undefined, '2026-07-09')).toBeNull();
  });
});

describe('buildComparison', () => {
  it('no prior → no_prior_scan', () => {
    const c = buildComparison({ prior: null, current: snap('2026-07-10', [driver()]), fingerprints: FP });
    expect(c.status).toBe('no_prior_scan');
    expect(c.baselineObservationDay).toBeNull();
  });
  it('a 3-trading-day gap is walked via getPreviousTradingDay', () => {
    const c = buildComparison({ prior: snap('2026-07-06', [driver()]), current: snap('2026-07-09', [driver()]), fingerprints: FP });
    expect(c.status).toBe('available');
    expect(c.baselineObservationDay).toBe('2026-07-06');
    expect(c.gapTradingDays).toBe(3);
  });
  it('membership change → not_comparable', () => {
    const prior = snap('2026-07-06', [driver()], { ...FP, membershipHash: 'mh-OTHER' });
    const c = buildComparison({ prior, current: snap('2026-07-09', [driver()]), fingerprints: FP });
    expect(c.status).toBe('not_comparable');
    expect(c.baselineMembershipHash).toBe('mh-OTHER');
  });
  it('driver-universe change → not_comparable', () => {
    const prior = snap('2026-07-06', [driver()], { ...FP, driverUniverseHash: 'uh-OTHER' });
    expect(buildComparison({ prior, current: snap('2026-07-09', [driver()]), fingerprints: FP }).status).toBe('not_comparable');
  });
  it('methodology bump → not_comparable', () => {
    const prior = snap('2026-07-06', [driver()], { ...FP, methodologyVersion: 'corr-v2' });
    expect(buildComparison({ prior, current: snap('2026-07-09', [driver()]), fingerprints: FP }).status).toBe('not_comparable');
  });
});

describe('driverUniverseHash', () => {
  it('is a stable sha1 of the registry salt', () => {
    expect(driverUniverseHash('A:X,B:Y')).toBe(driverUniverseHash('A:X,B:Y'));
    expect(driverUniverseHash('A:X,B:Y')).not.toBe(driverUniverseHash('A:X,B:Z'));
  });
});

describe('computeChanges — event model', () => {
  it('a driver that went uncomputable is became_unavailable, never signal_exited (finding 14)', () => {
    const prior = snap('2026-07-06', [driver({ corr20: 0.6, tier: 'established' })]);
    const current = snap('2026-07-09', [driver({ corr20: null, corr60: null, tier: 'weak' })]);
    const events = computeChanges({ prior, current });
    expect(events.map((e) => e.event)).toEqual(['became_unavailable']);
  });

  it('a real signal exit (still measured) emits signal_exited', () => {
    const prior = snap('2026-07-06', [driver({ corr20: 0.6, corr60: 0.55, tier: 'established' })]);
    const current = snap('2026-07-09', [driver({ corr20: 0.55, corr60: 0.5, tier: 'emerging' })]);
    const events = computeChanges({ prior, current });
    expect(events.some((e) => e.event === 'signal_exited')).toBe(true);
    expect(events.some((e) => e.event === 'became_unavailable')).toBe(false);
  });

  it('|Δcorr20| below 0.15 emits no correlation event', () => {
    const prior = snap('2026-07-06', [driver({ corr20: 0.6 })]);
    const current = snap('2026-07-09', [driver({ corr20: 0.7 })]); // Δ 0.10 < floor
    expect(computeChanges({ prior, current }).some((e) => e.event.startsWith('correlation_'))).toBe(false);
  });

  it('a ≥0.15 strengthen fires with a magnitude', () => {
    const prior = snap('2026-07-06', [driver({ corr20: 0.4 })]);
    const current = snap('2026-07-09', [driver({ corr20: 0.6 })]);
    const ev = computeChanges({ prior, current }).find((e) => e.event === 'correlation_strengthened');
    expect(ev).toBeTruthy();
    expect(ev.magnitude).toBeCloseTo(0.2, 5);
  });

  it('sign flip requires both sides |r| ≥ 0.15', () => {
    const flip = computeChanges({ prior: snap('2026-07-06', [driver({ corr20: 0.4 })]), current: snap('2026-07-09', [driver({ corr20: -0.4 })]) });
    expect(flip.some((e) => e.event === 'correlation_sign_flipped')).toBe(true);
    // one side sub-floor → not a flip (falls through to a magnitude event)
    const noFlip = computeChanges({ prior: snap('2026-07-06', [driver({ corr20: 0.05 })]), current: snap('2026-07-09', [driver({ corr20: -0.25 })]) });
    expect(noFlip.some((e) => e.event === 'correlation_sign_flipped')).toBe(false);
  });

  it('tension worsening and recovery both emit on boundary crossings', () => {
    const worse = computeChanges({ prior: snap('2026-07-06', [driver({ tensionState: 'calm' })]), current: snap('2026-07-09', [driver({ tensionState: 'stretched' })]) });
    expect(worse.some((e) => e.event === 'tension_worsened')).toBe(true);
    const recover = computeChanges({ prior: snap('2026-07-06', [driver({ tensionState: 'break' })]), current: snap('2026-07-09', [driver({ tensionState: 'calm' })]) });
    expect(recover.some((e) => e.event === 'tension_recovered')).toBe(true);
  });

  it('rank move alone (no accompanying corr move) is context, not an event', () => {
    const prior = snap('2026-07-06', [driver({ driverId: 'A', rank: 10, corr20: 0.5 }), driver({ driverId: 'B', rank: 1, corr20: 0.5 })]);
    const current = snap('2026-07-09', [driver({ driverId: 'A', rank: 1, corr20: 0.5 }), driver({ driverId: 'B', rank: 10, corr20: 0.5 })]);
    const events = computeChanges({ prior, current });
    expect(events.some((e) => e.event === 'rank_rose' || e.event === 'rank_fell')).toBe(false);
  });

  it('a big rank move WITH a corr move emits rank_rose, ordered after headline events, tie-broken by driverId', () => {
    const prior = snap('2026-07-06', [driver({ driverId: 'ZZZ', rank: 8, corr20: 0.3, tier: 'emerging' }), driver({ driverId: 'AAA', rank: 9, corr20: 0.3, tier: 'emerging' })]);
    const current = snap('2026-07-09', [driver({ driverId: 'ZZZ', rank: 1, corr20: 0.45, tier: 'established' }), driver({ driverId: 'AAA', rank: 2, corr20: 0.45, tier: 'established' })]);
    const events = computeChanges({ prior, current });
    const ranks = events.filter((e) => e.event === 'rank_rose');
    expect(ranks.length).toBe(2);
    // signal_entered (priority 2) precedes rank_rose (priority 5)
    expect(events.findIndex((e) => e.event === 'signal_entered')).toBeLessThan(events.findIndex((e) => e.event === 'rank_rose'));
    // within rank_rose, AAA precedes ZZZ (driverId tie-break)
    expect(ranks[0].driverId).toBe('AAA');
  });

  it('became_suppressed when the raw link holds but the SPY-adjustment is suppressed (driver-is-market)', () => {
    const prior = snap('2026-07-06', [driver({ corr20: 0.6, adjusted20: 0.4 })]);
    const current = snap('2026-07-09', [driver({ corr20: 0.6, adjusted20: null, adjustedSuppressed: true })]);
    expect(computeChanges({ prior, current }).some((e) => e.event === 'became_suppressed')).toBe(true);
  });

  it('a thin/insufficient adjustment window (null, NOT suppressed) does NOT emit became_suppressed', () => {
    const prior = snap('2026-07-06', [driver({ corr20: 0.6, adjusted20: 0.4 })]);
    const current = snap('2026-07-09', [driver({ corr20: 0.6, adjusted20: null, adjustedSuppressed: false })]);
    expect(computeChanges({ prior, current }).some((e) => e.event === 'became_suppressed')).toBe(false);
  });

  it('no meaningful change → empty event list', () => {
    const prior = snap('2026-07-06', [driver()]);
    const current = snap('2026-07-09', [driver()]);
    expect(computeChanges({ prior, current })).toEqual([]);
  });
});
