/**
 * correlationMath.js unit suite — Build Spec V1.2 Phase 1.
 *
 * Synthetic fixtures only, no network, no mocks (the module is a zero-import
 * pure leaf — returnCalculations.test.js convention). Deterministic noise
 * comes from a Lehmer LCG (16807 · x mod 2147483647): products stay < 2^53 so
 * the stream is bit-exact in doubles on every platform — no Math.random.
 *
 * Locks, per spec: the OLDEST-FIRST + closeIndex/eventDate mapping contract
 * (including the literal [100, 110, 99] counterexample), classical-OLS
 * intercept recovery, the rolling-beta variance guard (null, never a spike),
 * the pinned lead-lag sign/selection/no-signal rules, the exclusive robust
 * SDS baseline + persistence + floor + hysteresis episode semantics, and
 * non-overlapping forward-return aggregation with end-of-series exclusion.
 */
import { describe, it, expect } from 'vitest';
import {
  computeReturnsSeries,
  rollingCorrelation,
  pearson,
  pairwiseCohesion,
  olsBeta,
  rollingBeta,
  leadLag,
  detectInflections,
  forwardReturns,
  standardizedDivergenceScore,
  trailingReturnInto,
  rollingStd,
  maskedPearson,
  compareConditionalSides,
  median,
  ABS_DIVERGENCE_FLOOR,
  SDS_BASELINE_WINDOW,
} from './correlationMath.js';

// ── Deterministic fixture helpers ───────────────────────────────────────────

/** Lehmer LCG → uniform (0, 1), bit-exact in doubles. */
function lehmer(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** n chronological ISO date strings (calendar days — opaque labels here). */
function makeDates(n, startUtcMs = Date.UTC(2024, 0, 1)) {
  return Array.from({ length: n }, (_, i) =>
    new Date(startUtcMs + i * 86400000).toISOString().slice(0, 10)
  );
}

/** Compound OLDEST-FIRST closes from a start level and pct returns. */
function compound(start, returns) {
  const closes = [start];
  for (const r of returns) closes.push(closes[closes.length - 1] * (1 + r));
  return closes;
}

/**
 * Divergence-series builder for detectInflections tests: entry i carries
 * d = ds[i] with corr20/corr60 consistent (corr20 − corr60 === d) and a
 * closeIndex offset mimicking the endpoint's window warmup.
 */
function mkDivergence(ds, closeIndexStart = 60) {
  return ds.map((d, i) => ({
    closeIndex: closeIndexStart + i,
    eventDate: `D${closeIndexStart + i}`,
    d,
    corr20: 0.4 + d / 2,
    corr60: 0.4 - d / 2,
  }));
}

/** Alternating ±amp baseline of `len` observations (median 0, MAD amp). */
function altBaseline(len, amp) {
  return Array.from({ length: len }, (_, i) => (i % 2 === 0 ? amp : -amp));
}

// ── computeReturnsSeries ────────────────────────────────────────────────────

describe('computeReturnsSeries', () => {
  it('pct mode: r_i = closes[i+1]/closes[i] − 1, length n−1', () => {
    const r = computeReturnsSeries([100, 110, 99]);
    expect(r).toHaveLength(2);
    expect(r[0]).toBeCloseTo(0.1, 12);
    expect(r[1]).toBeCloseTo(-0.1, 12);
  });

  it('diff mode: first differences, not percents', () => {
    const r = computeReturnsSeries([4.0, 4.4, 4.1], 'diff');
    expect(r).toHaveLength(2);
    expect(r[0]).toBeCloseTo(0.4, 12);
    expect(r[1]).toBeCloseTo(-0.3, 12);
    // and explicitly NOT the pct values
    expect(Math.abs(r[0] - 0.1)).toBeGreaterThan(0.05);
  });

  it('returns null on <2 closes, non-finite values, zero pct denominator, unknown mode', () => {
    expect(computeReturnsSeries([100])).toBeNull();
    expect(computeReturnsSeries([100, NaN, 105])).toBeNull();
    expect(computeReturnsSeries([0, 100])).toBeNull();
    expect(computeReturnsSeries([100, 105], 'log')).toBeNull();
    expect(computeReturnsSeries('not-an-array')).toBeNull();
  });
});

// ── pearson / olsBeta ───────────────────────────────────────────────────────

describe('pearson / olsBeta — known-correlation pair (b = 0.8a + 0.5 + noise)', () => {
  const gen = lehmer(42);
  const n = 500;
  const a = Array.from({ length: n }, () => (gen() - 0.5) * 0.02);
  const noise = Array.from({ length: n }, () => (gen() - 0.5) * 0.004);
  const b = a.map((v, i) => 0.8 * v + 0.5 + noise[i]);

  it('recovers correlation on the known pair within tolerance', () => {
    const r = pearson(b, a);
    expect(r).not.toBeNull();
    // analytic r = 0.8·σa / sqrt(0.64·σa² + σe²) ≈ 0.974 for these amplitudes
    expect(r).toBeGreaterThan(0.95);
    expect(r).toBeLessThan(0.995);
  });

  it('olsBeta recovers beta ≈ 0.8 AND the intercept 0.5 (kills any interceptless copy)', () => {
    const fit = olsBeta(b, a);
    expect(fit).not.toBeNull();
    expect(Math.abs(fit.beta - 0.8)).toBeLessThan(0.05);
    expect(Math.abs(fit.alpha - 0.5)).toBeLessThan(0.001);
    expect(fit.n).toBe(n);
    expect(fit.r).toBeGreaterThan(0.95);
  });

  it('degenerate inputs → null, never 0', () => {
    expect(pearson([0.01, 0.01, 0.01], [0.01, -0.01, 0.02])).toBeNull(); // zero variance A
    expect(pearson([0.01, -0.01], [0.01])).toBeNull(); // length mismatch
    expect(pearson([0.01], [0.02])).toBeNull(); // too short
    expect(olsBeta([0.01, -0.01, 0.02], [0.005, 0.005, 0.005])).toBeNull(); // zero driver variance
    expect(olsBeta([0.01, -0.01], [0.01, -0.01, 0.02])).toBeNull(); // mismatch
  });
});

// ── rollingBeta ─────────────────────────────────────────────────────────────

describe('rollingBeta', () => {
  const gen = lehmer(7);
  const n = 200;
  const driver = Array.from({ length: n }, () => (gen() - 0.5) * 0.02);
  const noise = Array.from({ length: n }, () => (gen() - 0.5) * 0.002);
  const group = driver.map((v, i) => 0.8 * v + noise[i]);
  const dates = makeDates(n + 1);

  it('recovers ≈0.8 across all full windows; partial windows skipped; oldest-first; eventDate = dates[j+1]', () => {
    const series = rollingBeta(group, driver, 40, dates);
    expect(series).toHaveLength(n - 40 + 1);
    expect(series[0].closeIndex).toBe(40);
    expect(series[0].eventDate).toBe(dates[40]);
    expect(series[series.length - 1].closeIndex).toBe(n);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].closeIndex).toBe(series[i - 1].closeIndex + 1);
    }
    for (const e of series) {
      expect(e.beta).not.toBeNull();
      expect(Math.abs(e.beta - 0.8)).toBeLessThan(0.1);
    }
  });

  it('a ~zero-driver-variance window yields beta null (entry preserved), not a spike', () => {
    const flatDriver = [...driver];
    for (let i = 80; i <= 124; i++) flatDriver[i] = 0.005; // 45 identical driver returns
    const series = rollingBeta(group, flatDriver, 40, dates);
    // windows fully inside the flat stretch: j ∈ [119, 124] → closeIndex 120..125
    for (const e of series) {
      if (e.closeIndex >= 120 && e.closeIndex <= 125) {
        expect(e.beta).toBeNull();
        expect(e.alpha).toBeNull();
        expect(e.r).toBeNull();
        expect(typeof e.eventDate).toBe('string'); // entry preserved for chart gapping
      }
    }
    expect(series.find((e) => e.closeIndex === 119).beta).not.toBeNull();
    expect(series.find((e) => e.closeIndex === 126).beta).not.toBeNull();
  });

  it('each entry carries its own window r', () => {
    const series = rollingBeta(group, driver, 40, dates);
    for (const e of series) {
      expect(e.r).toBeGreaterThan(0.9); // tight relationship in every window
    }
  });

  it('series shorter than the window → []; invalid dates → null', () => {
    expect(rollingBeta(group.slice(0, 39), driver.slice(0, 39), 40, makeDates(40))).toEqual([]);
    expect(rollingBeta(group, driver, 40, makeDates(n))).toBeNull(); // dates.length must be n+1
  });
});

// ── leadLag ─────────────────────────────────────────────────────────────────

describe('leadLag', () => {
  const gen = lehmer(1234);
  const L = 800;
  const base = Array.from({ length: L + 6 }, () => (gen() - 0.5) * 0.02);
  const u = Array.from({ length: L }, () => (gen() - 0.5) * 0.02);

  it('lag-sign fixture: B = A shifted forward 2 days → leadLag(B, A) reports bestLag +2 (A leads B)', () => {
    const A = base.slice(2, 2 + L); // driver
    const B = base.slice(0, L); // group: B[t] = A[t−2]
    const res = leadLag(B, A, 5);
    expect(res.bestLag).toBe(2);
    expect(res.corrAtBestLag).toBeCloseTo(1, 6);
    expect(res.verdict).toBe('driver_leads');
  });

  it('selection (a): picks the larger |corr| regardless of sign (−1 positive vs +2 strong negative → +2)', () => {
    // g[t] = 0.30·d[t+1] − 0.80·d[t−2] + 0.05·u[t]  (d = driver)
    const d = base.slice(2, 2 + L);
    const g = Array.from({ length: L }, (_, t) => 0.3 * base[t + 3] - 0.8 * base[t] + 0.05 * u[t]);
    const res = leadLag(g, d, 5);
    const rowMinus1 = res.table.find((r) => r.lag === -1);
    expect(rowMinus1.corr).toBeGreaterThan(0.25); // fixture guard: the competing positive peak exists
    expect(res.bestLag).toBe(2);
    expect(res.corrAtBestLag).toBeLessThan(-0.8);
    expect(res.verdict).toBe('driver_leads');
  });

  it('selection (b): a nonzero lag beating lag 0 by <0.05 loses — lag 0 wins', () => {
    // g[t] = 0.70·d[t] + 0.73·d[t−1] + 0.02·u[t] → |corr(+1)| − |corr(0)| ≈ 0.03
    const d = base.slice(2, 2 + L);
    const g = Array.from({ length: L }, (_, t) => 0.7 * base[t + 2] + 0.73 * base[t + 1] + 0.02 * u[t]);
    const res = leadLag(g, d, 5);
    const c0 = Math.abs(res.table.find((r) => r.lag === 0).corr);
    const c1 = Math.abs(res.table.find((r) => r.lag === 1).corr);
    // precondition asserted from the table itself so fixture drift can't silently invalidate the case
    expect(c1).toBeGreaterThan(c0);
    expect(c1 - c0).toBeLessThan(0.05);
    expect(res.bestLag).toBe(0);
    expect(res.verdict).toBe('coincident');
  });

  it("selection (c): max |corr| below 0.15 → verdict 'none' (bestLag still reported)", () => {
    const d = base.slice(2, 2 + L);
    const g = Array.from({ length: L }, (_, t) => 0.08 * base[t + 2] + 0.9968 * u[t]);
    const res = leadLag(g, d, 5);
    for (const row of res.table) expect(Math.abs(row.corr)).toBeLessThan(0.15); // fixture guard
    expect(res.verdict).toBe('none');
    expect(res.bestLag).not.toBeUndefined();
  });

  it('table rows carry n = pair count (length − |lag|)', () => {
    const d = base.slice(2, 2 + L);
    const g = base.slice(0, L);
    const res = leadLag(g, d, 5);
    expect(res.table).toHaveLength(11);
    for (const row of res.table) expect(row.n).toBe(L - Math.abs(row.lag));
  });

  it('degenerate lag-0 → whole call null; mismatched lengths → null', () => {
    expect(leadLag([0.01, 0.01, 0.01, 0.01], [0.02, 0.02, 0.02, 0.02], 1)).toBeNull();
    expect(leadLag([0.01, -0.01], [0.01, -0.01, 0.02], 5)).toBeNull();
  });
});

// ── detectInflections ───────────────────────────────────────────────────────

describe('detectInflections', () => {
  const DENOM = 1.4826 * 0.1; // alternating ±0.1 baseline: median 0, MAD 0.1

  it('SDS baseline excludes the current day: a spike does not dilute its own score (flags via 2-of-3)', () => {
    // 120 alternating ±0.1, then two consecutive d = 0.31.
    // Exclusive baseline: SDS = 0.31/0.14826 ≈ 2.091 on both event days → raw
    // twice → flag at the 2nd. An inclusive-baseline implementation shifts
    // median/MAD and scores < 2 → no episode (discriminating).
    const ds = [...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.31, 0.31];
    const series = mkDivergence(ds);
    const episodes = detectInflections(series);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].startCloseIndex).toBe(series[121].closeIndex);
    expect(episodes[0].startDate).toBe(series[121].eventDate);
    expect(episodes[0].direction).toBe('strengthening');
    expect(episodes[0].score).toBeCloseTo(0.31 / DENOM, 3);
    expect(episodes[0].corr20AtFlag).toBeCloseTo(series[121].corr20, 12);
    expect(episodes[0].corr60AtFlag).toBeCloseTo(series[121].corr60, 12);
  });

  it('MAD baseline is robust to one outlier in the trailing window', () => {
    // A d = 5.0 shock planted in the (unscoreable) first 120 obs barely moves
    // median/MAD; a later emergency-scale event still flags. A stdev-based
    // baseline would be blown out by the outlier and stay silent.
    const ds = [...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.55];
    ds[30] = 5.0;
    const episodes = detectInflections(mkDivergence(ds));
    expect(episodes).toHaveLength(1);
    expect(episodes[0].score).toBeGreaterThan(3.5);
  });

  it('persistence: a single |SDS| ≈ 2.1 observation does NOT flag', () => {
    const ds = [...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.312, 0.1, -0.1];
    expect(detectInflections(mkDivergence(ds))).toHaveLength(0);
  });

  it('persistence: 2 of the last 3 raw (with a quiet day between) flags at the second raw observation', () => {
    const ds = [...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.31, -0.1, 0.31];
    const series = mkDivergence(ds);
    const episodes = detectInflections(series);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].startCloseIndex).toBe(series[122].closeIndex); // flags at the 2nd raw, not the quiet day
  });

  it('emergency: a single |SDS| ≥ 3.5 with |d| ≥ 0.25 flags immediately (persistence exempt)', () => {
    const ds = [...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.535];
    const series = mkDivergence(ds);
    const episodes = detectInflections(series);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].startCloseIndex).toBe(series[120].closeIndex);
    expect(episodes[0].score).toBeCloseTo(0.535 / DENOM, 2); // ≈ 3.61
  });

  it('divergence floor: |d| = 0.27 with qualifying SDS flags; |d| = 0.22 does not (floor blocks, not the SDS)', () => {
    // ±0.05 baseline → MAD 0.05, denom ≈ 0.0741: SDS(0.27) ≈ 3.64, SDS(0.22) ≈ 2.97.
    // Both clear the SDS thresholds; only the 0.27 case clears the 0.25 floor.
    const flags = detectInflections(mkDivergence([...altBaseline(SDS_BASELINE_WINDOW, 0.05), 0.27]));
    expect(flags).toHaveLength(1);
    const blocked = detectInflections(
      mkDivergence([...altBaseline(SDS_BASELINE_WINDOW, 0.05), 0.22, 0.22])
    );
    expect(blocked).toHaveLength(0);
    expect(0.22 / (1.4826 * 0.05)).toBeGreaterThan(2); // fixture guard: SDS alone would have qualified
  });

  it('opts.absFloor overrides the exported default (the calibration knob)', () => {
    const ds = [...altBaseline(SDS_BASELINE_WINDOW, 0.05), 0.22, 0.22];
    expect(detectInflections(mkDivergence(ds), { absFloor: 0.2 })).toHaveLength(1);
    expect(ABS_DIVERGENCE_FLOOR).toBe(0.25);
  });

  it('hysteresis: consecutive flags collapse into one episode; released when |SDS| < 1.0; open at series end closes at the final obs', () => {
    // Pattern baseline [0.01, −0.01, 0.02, −0.02]: median 0, MAD 0.015 — both
    // stable under window slides, so the engineered event values are
    // drift-proof: 0.5 → SDS ≫ 3.5 (flags), 0.08 → SDS ≥ 1 but under the 0.25
    // floor (keeps the episode open, can't re-flag), 0.0 → SDS < 1 (release).
    const pattern = Array.from({ length: SDS_BASELINE_WINDOW }, (_, i) =>
      [0.01, -0.01, 0.02, -0.02][i % 4]
    );
    const ds = [...pattern, 0.5, 0.5, 0.08, 0.0, 0.0, 0.5];
    const series = mkDivergence(ds);
    const episodes = detectInflections(series);
    expect(episodes).toHaveLength(2);
    expect(episodes[0].startCloseIndex).toBe(series[120].closeIndex); // both 0.5s absorbed into one episode
    expect(episodes[0].endCloseIndex).toBe(series[122].closeIndex); // 0.08 keeps it open; first 0.0 releases
    expect(episodes[0].direction).toBe('strengthening');
    expect(episodes[1].startCloseIndex).toBe(series[125].closeIndex);
    expect(episodes[1].endCloseIndex).toBe(series[125].closeIndex); // still open at series end → closes at final obs
  });

  it("direction: 'weakening' when d < 0 at flag", () => {
    const ds = [...altBaseline(SDS_BASELINE_WINDOW, 0.1), -0.535];
    const episodes = detectInflections(mkDivergence(ds));
    expect(episodes).toHaveLength(1);
    expect(episodes[0].direction).toBe('weakening');
    expect(episodes[0].score).toBeLessThan(-3.5);
  });

  it('MAD == 0 baseline → observation unscoreable, never flags', () => {
    const ds = [...Array.from({ length: SDS_BASELINE_WINDOW }, () => 0), 0.5, 0.5, 0.5];
    expect(detectInflections(mkDivergence(ds))).toHaveLength(0);
  });

  it('invalid input → null; valid-but-short input → []', () => {
    expect(detectInflections('nope')).toBeNull();
    expect(detectInflections([])).toEqual([]);
    expect(detectInflections(mkDivergence(altBaseline(50, 0.1)))).toEqual([]); // < full baseline: nothing scoreable
  });
});

// ── standardizedDivergenceScore ─────────────────────────────────────────────

describe('standardizedDivergenceScore (the SDS detectInflections flags on, exposed for divergence.latest)', () => {
  const DENOM = 1.4826 * 0.1; // alternating ±0.1 baseline: median 0, MAD 0.1

  it('numeric SDS on a clean trailing baseline = (d − median)/(1.4826·MAD)', () => {
    const series = mkDivergence([...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.31]);
    // obs SDS_BASELINE_WINDOW (index 120) has a full ±0.1 trailing baseline.
    expect(standardizedDivergenceScore(series, SDS_BASELINE_WINDOW)).toBeCloseTo(0.31 / DENOM, 10);
  });

  it('is the SAME value detectInflections stores as an episode score (single-source refactor)', () => {
    // Emergency-scale event → one episode whose score = SDS at the flag obs.
    const series = mkDivergence([...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.535]);
    const episodes = detectInflections(series);
    expect(episodes).toHaveLength(1);
    expect(standardizedDivergenceScore(series, SDS_BASELINE_WINDOW)).toBe(episodes[0].score);
  });

  it('null (unscoreable) when the observation lacks a full trailing baseline', () => {
    const series = mkDivergence([...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.31]);
    expect(standardizedDivergenceScore(series, SDS_BASELINE_WINDOW - 1)).toBeNull();
    expect(standardizedDivergenceScore(series, 0)).toBeNull();
  });

  it('null when MAD == 0 (degenerate baseline) or d is non-finite', () => {
    const flat = mkDivergence([...Array.from({ length: SDS_BASELINE_WINDOW }, () => 0), 0.5]);
    expect(standardizedDivergenceScore(flat, SDS_BASELINE_WINDOW)).toBeNull(); // MAD == 0
    const nan = mkDivergence([...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.31]);
    nan[SDS_BASELINE_WINDOW].d = NaN;
    expect(standardizedDivergenceScore(nan, SDS_BASELINE_WINDOW)).toBeNull();
  });

  it('null on invalid index / non-array input', () => {
    const series = mkDivergence([...altBaseline(SDS_BASELINE_WINDOW, 0.1), 0.31]);
    expect(standardizedDivergenceScore(series, series.length)).toBeNull(); // out of range
    expect(standardizedDivergenceScore(series, 120.5)).toBeNull(); // non-integer
    expect(standardizedDivergenceScore('nope', 0)).toBeNull();
  });
});

// ── trailingReturnInto ──────────────────────────────────────────────────────

describe('trailingReturnInto (forwardReturns pointed backward — the N-session move INTO a flag)', () => {
  const levels = compound(100, Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.005)));

  it('levels[c] / levels[c − look] − 1 over the trailing window', () => {
    expect(trailingReturnInto(levels, 10, 5)).toBeCloseTo(levels[10] / levels[5] - 1, 12);
    expect(trailingReturnInto([100, 110, 99], 2, 2)).toBeCloseTo(99 / 100 - 1, 12);
  });

  it('c === look is valid (base index 0); c < look → null (no trailing window)', () => {
    expect(trailingReturnInto(levels, 5, 5)).toBeCloseTo(levels[5] / levels[0] - 1, 12);
    expect(trailingReturnInto(levels, 4, 5)).toBeNull();
    expect(trailingReturnInto(levels, 0, 5)).toBeNull();
  });

  it('null on a zero / non-finite base or non-integer / non-array input', () => {
    expect(trailingReturnInto([0, 1, 2, 3, 4, 5], 5, 5)).toBeNull(); // base level 0
    expect(trailingReturnInto([NaN, 1, 2, 3, 4, 5], 5, 5)).toBeNull();
    expect(trailingReturnInto(levels, 10.5, 5)).toBeNull();
    expect(trailingReturnInto('nope', 10, 5)).toBeNull();
  });
});

// ── forwardReturns ──────────────────────────────────────────────────────────

describe('forwardReturns', () => {
  it('index-mapping counterexample (literal): closes [100, 110, 99] — the return-index-0 event anchors at closeIndex 1; 1-day fwd = 99/110 − 1 = −10%, NOT +10%', () => {
    const closes = [100, 110, 99];
    const dates = ['2024-01-01', '2024-01-02', '2024-01-03'];
    const episodes = [
      { startCloseIndex: 1, startDate: '2024-01-02', direction: 'weakening' },
    ];
    const out = forwardReturns(closes, dates, episodes, [1]);
    expect(out[1].eligibleCount).toBe(1);
    expect(out[1].details[0].fwdReturn).toBeCloseTo(99 / 110 - 1, 12); // −0.1
    expect(out[1].details[0].fwdReturn).toBeLessThan(0);
    expect(out[1].details[0].exitDate).toBe('2024-01-03');
    expect(out[1].hitRate).toBe(0);
  });

  it('non-overlap aggregation: episodes at closeIndex 100 and 105, horizon 20 → independentCount 1, eligibleCount 2, 2 detail rows', () => {
    const n = 130;
    const closes = Array.from({ length: n }, (_, i) => 100 * Math.pow(1.001, i));
    const dates = makeDates(n);
    const episodes = [
      { startCloseIndex: 100, startDate: dates[100], direction: 'weakening' },
      { startCloseIndex: 105, startDate: dates[105], direction: 'weakening' },
    ];
    const out = forwardReturns(closes, dates, episodes, [20]);
    expect(out[20].eligibleCount).toBe(2);
    expect(out[20].independentCount).toBe(1);
    expect(out[20].details).toHaveLength(2);
    expect(out[20].details[0].independent).toBe(true);
    expect(out[20].details[1].independent).toBe(false); // clustered — excluded from the aggregate
    expect(out[20].mean).toBeCloseTo(Math.pow(1.001, 20) - 1, 12); // aggregate over the independent set only
  });

  it('clustered episodes never advance the non-overlap boundary (no chaining off rejected rows)', () => {
    const n = 200;
    const closes = Array.from({ length: n }, (_, i) => 100 + i);
    const dates = makeDates(n);
    // 100 accepted (window ends 120); 105 clustered; 121 must be INDEPENDENT
    // (disjoint from 100's window) even though it overlaps 105's window.
    const episodes = [100, 105, 121].map((c) => ({
      startCloseIndex: c,
      startDate: dates[c],
      direction: 'weakening',
    }));
    const out = forwardReturns(closes, dates, episodes, [20]);
    expect(out[20].independentCount).toBe(2);
    expect(out[20].details.map((r) => r.independent)).toEqual([true, false, true]);
  });

  it('end-of-series: an episode near the end is excluded from 20d but present in 5d; c+h landing exactly on the last close is still eligible', () => {
    const n = 130; // last index 129
    const closes = Array.from({ length: n }, (_, i) => 100 + i);
    const dates = makeDates(n);
    const episodes = [{ startCloseIndex: 112, startDate: dates[112], direction: 'strengthening' }];
    const out = forwardReturns(closes, dates, episodes, [5, 10, 20]);
    expect(out[5].eligibleCount).toBe(1);
    expect(out[10].eligibleCount).toBe(1);
    expect(out[20].eligibleCount).toBe(0); // 112 + 20 = 132 > 129 — excluded, never zero-filled
    expect(out[20].mean).toBeNull();
    expect(out[20].median).toBeNull();
    expect(out[20].hitRate).toBeNull();
    const edge = forwardReturns(closes, dates, [{ startCloseIndex: 109, startDate: dates[109] }], [20]);
    expect(edge[20].eligibleCount).toBe(1); // 109 + 20 = 129 = last index: eligible
  });

  it('aggregates (mean/median/hitRate) computed over the independent set; hitRate counts strictly positive', () => {
    // Flat stretch → 0% fwd (a miss), rising stretch → positive fwd (a hit).
    const closes = [
      ...Array.from({ length: 30 }, () => 100), // flat: fwd = 0
      ...Array.from({ length: 40 }, (_, i) => 100 + i + 1), // rising
    ];
    const dates = makeDates(closes.length);
    const episodes = [
      { startCloseIndex: 10, startDate: dates[10] }, // fwd 0 → miss
      { startCloseIndex: 40, startDate: dates[40] }, // fwd > 0 → hit
    ];
    const out = forwardReturns(closes, dates, episodes, [5]);
    expect(out[5].independentCount).toBe(2);
    expect(out[5].hitRate).toBeCloseTo(0.5, 12);
  });

  it('invalid input → null; empty episodes → zero-count aggregates', () => {
    const closes = [100, 101, 102];
    const dates = makeDates(3);
    expect(forwardReturns(closes, dates.slice(0, 2), [], [5])).toBeNull(); // dates length mismatch
    expect(forwardReturns(closes, dates, 'nope', [5])).toBeNull();
    expect(forwardReturns(closes, dates, [], [0])).toBeNull(); // horizon must be ≥ 1
    const out = forwardReturns(closes, dates, [], [1]);
    expect(out[1].eligibleCount).toBe(0);
    expect(out[1].mean).toBeNull();
  });
});

// ── rollingCorrelation ──────────────────────────────────────────────────────

describe('rollingCorrelation', () => {
  const gen = lehmer(99);
  const n = 80;
  const a = Array.from({ length: n }, () => (gen() - 0.5) * 0.02);
  const b = a.map((v) => 0.9 * v); // perfectly correlated
  const dates = makeDates(n + 1);

  it('full windows only, closeIndex = j+1, eventDate = dates[j+1]', () => {
    const series = rollingCorrelation(a, b, 20, dates);
    expect(series).toHaveLength(n - 20 + 1);
    expect(series[0].closeIndex).toBe(20);
    expect(series[0].eventDate).toBe(dates[20]);
    expect(series[series.length - 1].closeIndex).toBe(n);
    for (const e of series) expect(e.value).toBeCloseTo(1, 9);
  });

  it('degenerate window preserved as an entry with value null (chart gaps, x-position kept)', () => {
    const flat = [...a];
    for (let i = 30; i <= 54; i++) flat[i] = 0.003; // 25 constant returns > window 20
    const series = rollingCorrelation(a, flat, 20, dates);
    const nullEntries = series.filter((e) => e.value === null);
    expect(nullEntries.length).toBeGreaterThan(0);
    for (const e of nullEntries) {
      expect(e.closeIndex).toBeGreaterThanOrEqual(20);
      expect(typeof e.eventDate).toBe('string');
    }
    expect(series).toHaveLength(n - 20 + 1); // no dropped x-positions
  });

  it('shorter than window → []; invalid input → null', () => {
    expect(rollingCorrelation(a.slice(0, 10), b.slice(0, 10), 20, makeDates(11))).toEqual([]);
    expect(rollingCorrelation(a, b, 20, makeDates(n))).toBeNull(); // dates must be returns + 1
    expect(rollingCorrelation(a, b.slice(0, 50), 20, dates)).toBeNull(); // length mismatch
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// V2 Build 4 — conditional correlation ("when does the link hold?")
// ═════════════════════════════════════════════════════════════════════════════

describe('rollingStd — rolling sample std over full windows (Build 4)', () => {
  it('hand-computed values with the SAMPLE (n−1) divisor and the closeIndex/eventDate mapping', () => {
    const returns = [1, 2, 3, 4]; // integers pin the divisor unambiguously
    const dates = makeDates(5);
    const series = rollingStd(returns, 3, dates);
    expect(series).toHaveLength(2);
    // window [1,2,3]: mean 2, Σ(d²) = 2, SAMPLE var = 2/2 = 1 → sd 1 (the
    // population divisor would give √(2/3) ≈ 0.816 — this value pins n−1).
    expect(series[0]).toMatchObject({ closeIndex: 3, eventDate: dates[3] });
    expect(series[0].value).toBeCloseTo(1, 12);
    expect(series[1]).toMatchObject({ closeIndex: 4, eventDate: dates[4] });
    expect(series[1].value).toBeCloseTo(1, 12);
  });

  it('a constant window reads 0 (a quiet reading is a value, not a degenerate null)', () => {
    const series = rollingStd([0.01, 0.01, 0.01], 2, makeDates(4));
    expect(series).toHaveLength(2);
    for (const e of series) expect(e.value).toBe(0);
  });

  it('shorter than window → []; invalid input → null (never zero)', () => {
    expect(rollingStd([0.01], 2, makeDates(2))).toEqual([]);
    expect(rollingStd([0.01, 0.02], 1, makeDates(3))).toBeNull(); // window < 2
    expect(rollingStd([0.01, 0.02], 2, makeDates(2))).toBeNull(); // dates ≠ returns + 1
    expect(rollingStd([0.01, NaN, 0.02], 2, makeDates(4))).toBeNull(); // corrupt input
    expect(rollingStd(null, 2, makeDates(3))).toBeNull();
  });
});

describe('maskedPearson — Pearson over a strict-true mask (Build 4)', () => {
  const gen = lehmer(40400);
  const A = Array.from({ length: 120 }, () => (gen() - 0.5) * 0.02);
  const B = A.map((v) => 0.7 * v + (gen() - 0.5) * 0.01);

  it('an all-true mask reproduces pearson exactly, with n = the full length', () => {
    const out = maskedPearson(A, B, A.map(() => true));
    expect(out).not.toBeNull();
    expect(out.corr).toBe(pearson(A, B));
    expect(out.n).toBe(A.length);
  });

  it('a subset mask equals pearson over the hand-extracted subset', () => {
    const mask = A.map((_, i) => i % 3 === 0);
    const subA = A.filter((_, i) => mask[i]);
    const subB = B.filter((_, i) => mask[i]);
    const out = maskedPearson(A, B, mask);
    expect(out.corr).toBe(pearson(subA, subB));
    expect(out.n).toBe(subA.length);
  });

  it('mask semantics are STRICT === true — truthy non-booleans select nothing', () => {
    const a = [1, 2, 3, 4];
    const b = [1, 2, 3, 4];
    // only indices 0 and 2 are strict true; 1 and 'yes' are truthy but ignored
    const out = maskedPearson(a, b, [true, 1, true, 'yes']);
    expect(out.n).toBe(2);
    expect(out.corr).toBeCloseTo(1, 12);
  });

  it('null below the caller floor (n < minN), even when the subset itself is computable', () => {
    const mask = A.map((_, i) => i < 59); // 59 observations
    expect(maskedPearson(A, B, mask, 60)).toBeNull();
    expect(maskedPearson(A, B, mask, 59)).not.toBeNull(); // the floor is the only failure
  });

  it('null on a degenerate masked subset (~zero variance) — never zero', () => {
    const flat = A.map(() => 0.004);
    expect(maskedPearson(flat, B, A.map(() => true))).toBeNull();
  });

  it('null on invalid input: mismatched arrays, wrong-length mask, bad minN', () => {
    expect(maskedPearson(A, B.slice(0, 100), A.map(() => true))).toBeNull();
    expect(maskedPearson(A, B, A.slice(0, 100).map(() => true))).toBeNull();
    expect(maskedPearson(A, B, 'not a mask')).toBeNull();
    expect(maskedPearson(A, B, A.map(() => true), 1)).toBeNull(); // minN < 2
    expect(maskedPearson(A, B, A.map(() => true), 60.5)).toBeNull();
  });
});

describe('compareConditionalSides — the pinned 0.15 asymmetry floor (Build 4)', () => {
  it('floor straddle: a 0.13 difference is NOT asymmetric; 0.17 is', () => {
    expect(compareConditionalSides({ corr: 0.5, n: 100 }, { corr: 0.37, n: 100 })).toEqual({
      asymmetric: false,
      direction: null,
      flipped: false,
    });
    expect(compareConditionalSides({ corr: 0.5, n: 100 }, { corr: 0.33, n: 100 })).toEqual({
      asymmetric: true,
      direction: 'A',
      flipped: false,
    });
  });

  it('an exact-floor gap clears (≥), across fp representations of "0.15 apart"', () => {
    // Review fix: 0.45 − 0.3 is 0.15000000000000002 in IEEE-754 (strictly
    // above the floor), so it alone cannot pin the ≥ edge. These pairs land on
    // BOTH sides of 0.15's double (0.15 − 0 hits it exactly; 0.3 − 0.15 lands
    // on it; 0.6 − 0.45 lands 1 ulp above) — every displayed 0.15 gap must be
    // asymmetric regardless of which double the difference rounds to.
    for (const [a, b] of [
      [0.15, 0],
      [0.3, 0.15],
      [0.6, 0.45],
      [-0.45, -0.6],
    ]) {
      expect(
        compareConditionalSides({ corr: a, n: 80 }, { corr: b, n: 80 }).asymmetric,
        `${a} vs ${b}`
      ).toBe(true);
    }
  });

  it('H5 display agreement: the verdict is decided on the 2dp values the UI prints', () => {
    // Raw diff 0.1402 (< 0.15) but the card prints +0.60 / +0.45 — a visible
    // exactly-at-the-floor gap. The word must follow the printed numbers
    // (the strengthBand rounding-family rule), so this IS asymmetric.
    expect(compareConditionalSides({ corr: 0.5951, n: 250 }, { corr: 0.4549, n: 250 })).toEqual({
      asymmetric: true,
      direction: 'A',
      flipped: false,
    });
    // Near-floor raw diff 0.1498 printing as +0.59 / +0.45 — a 0.14 displayed
    // gap stays "no meaningful difference" (pins the rounded comparison
    // against a raw-with-tolerance implementation, which would flip this).
    // The reverse direction cannot exist: raw ≥ 0.15 always displays ≥ 0.15.
    expect(compareConditionalSides({ corr: 0.5949, n: 250 }, { corr: 0.4451, n: 250 })).toEqual({
      asymmetric: false,
      direction: null,
      flipped: false,
    });
  });

  it('direction is the LARGER-|corr| side — for inverse links, the more-negative side', () => {
    // QQQ × VIX shape: both sides negative (same sign — not a flip); tighter is B.
    const out = compareConditionalSides({ corr: -0.45, n: 200 }, { corr: -0.72, n: 200 });
    expect(out).toEqual({ asymmetric: true, direction: 'B', flipped: false });
  });

  it('null when either side is null — no comparison is ever fabricated', () => {
    expect(compareConditionalSides(null, { corr: 0.5, n: 100 })).toBeNull();
    expect(compareConditionalSides({ corr: 0.5, n: 100 }, null)).toBeNull();
    expect(compareConditionalSides(null, null)).toBeNull();
  });

  it('a custom floor overrides the 0.15 default; invalid floors null', () => {
    expect(
      compareConditionalSides({ corr: 0.5, n: 100 }, { corr: 0.4, n: 100 }, 0.05).asymmetric
    ).toBe(true);
    expect(compareConditionalSides({ corr: 0.5, n: 100 }, { corr: 0.4, n: 100 }, -1)).toBeNull();
    expect(compareConditionalSides({ corr: 0.5, n: 100 }, { corr: 0.4, n: 100 }, NaN)).toBeNull();
  });

  it('a meaningful sign reversal is flipped:true with a NULL direction (both unequal and equal magnitude)', () => {
    // The founder-folded flip verdict. Neither side is "tighter" — the link
    // REVERSES. Unequal magnitudes (+0.30 / −0.31, the reviewer's example) and
    // the equal-magnitude corner (+0.30 / −0.30) are BOTH flips; direction is
    // null in each (no winner), so the UI renders reversal copy, not "tighter"
    // (unequal) and not "no meaningful difference" (the old equal-mag bug).
    expect(compareConditionalSides({ corr: 0.3, n: 100 }, { corr: -0.31, n: 100 })).toEqual({
      asymmetric: true,
      direction: null,
      flipped: true,
    });
    expect(compareConditionalSides({ corr: 0.3, n: 100 }, { corr: -0.3, n: 100 })).toEqual({
      asymmetric: true,
      direction: null,
      flipped: true,
    });
  });

  it('a sign difference where ONE side is ~0 is NOT a flip — it is "tighter" on the side with the link', () => {
    // +0.02 is no link; −0.31 is a real inverse link. Calling this a "flip"
    // would fabricate a reversal from noise, so the per-side floor excludes it:
    // it stays a tighter-on-B asymmetry (the honest read — the link is on B).
    expect(compareConditionalSides({ corr: 0.02, n: 200 }, { corr: -0.31, n: 200 })).toEqual({
      asymmetric: true,
      direction: 'B',
      flipped: false,
    });
    // Both sides sub-floor and opposite-signed (±0.10): neither is a real link,
    // so no flip and no winner → the UI's "no meaningful difference" path.
    expect(compareConditionalSides({ corr: 0.1, n: 200 }, { corr: -0.1, n: 200 })).toEqual({
      asymmetric: true,
      direction: null,
      flipped: false,
    });
  });
});

describe('Build 4 — the symmetric-truncation discriminator (MANDATORY fixture)', () => {
  // A perfectly SYMMETRIC engineered relationship: group = 1.0 × driver + noise
  // with the SAME coupling on driver up-days and down-days. Conditioning on the
  // driver's sign truncates the driver's variance, so BOTH side correlations
  // come out well below the full-sample value — while the sides stay equal to
  // each other (within noise, far under the 0.15 floor). This fixture exists
  // to kill any implementation or copy that invites comparing a side to the
  // full-sample headline: the honest read of this data is "no meaningful
  // difference", never "both regimes weakened the link".
  const gen = lehmer(20260704);
  const N = 600;
  const driver = Array.from({ length: N }, () => (gen() - 0.5) * 0.02); // uniform(−1%, +1%), never exactly 0
  const noise = Array.from({ length: N }, () => (gen() - 0.5) * 0.0176); // σ tuned for r_full ≈ 0.75
  const group = driver.map((d, i) => d + noise[i]);

  const upMask = driver.map((d) => d > 0);
  const downMask = driver.map((d) => d < 0);
  const full = pearson(group, driver);
  const up = maskedPearson(group, driver, upMask, 60);
  const down = maskedPearson(group, driver, downMask, 60);

  it('both sides carry ≥ 60 observations and a strong full-sample link exists', () => {
    expect(up.n).toBeGreaterThanOrEqual(60);
    expect(down.n).toBeGreaterThanOrEqual(60);
    expect(up.n + down.n).toBe(N); // no exact zeros in the driver
    expect(full).toBeGreaterThan(0.65);
  });

  it('BOTH side correlations sit well below the full-sample value (the truncation effect itself)', () => {
    // Range restriction alone drops r from ≈0.75 to ≈0.49 here — with zero
    // change in the true relationship. This is why side-vs-headline is a
    // systematic misread.
    expect(up.corr).toBeLessThan(full - 0.1);
    expect(down.corr).toBeLessThan(full - 0.1);
  });

  it('…and the verdict is asymmetric: FALSE — the sides match each other (and same-signed, so never a flip)', () => {
    expect(Math.abs(up.corr - down.corr)).toBeLessThan(0.15);
    expect(compareConditionalSides(up, down)).toEqual({
      asymmetric: false,
      direction: null,
      flipped: false,
    });
  });
});

describe('Build 4 — engineered asymmetry fixture (tight on down-days, loose on up-days)', () => {
  // The classic candidate shape: strong coupling when the driver falls, weak
  // when it rises. compareConditionalSides must flag it and point at the
  // down side (side B here).
  const gen = lehmer(77007);
  const N = 600;
  const driver = Array.from({ length: N }, () => (gen() - 0.5) * 0.02);
  const noise = Array.from({ length: N }, () => (gen() - 0.5) * 0.008);
  const group = driver.map((d, i) => (d < 0 ? 1.0 : 0.12) * d + noise[i]);

  const up = maskedPearson(group, driver, driver.map((d) => d > 0), 60);
  const down = maskedPearson(group, driver, driver.map((d) => d < 0), 60);

  it('the down side is decisively tighter and the comparison points at it', () => {
    expect(down.corr - up.corr).toBeGreaterThanOrEqual(0.15);
    expect(Math.abs(down.corr)).toBeGreaterThan(Math.abs(up.corr));
    // Both sides positive (weak vs strong SAME-direction link) — tighter, not a flip.
    expect(up.corr).toBeGreaterThan(0);
    expect(down.corr).toBeGreaterThan(0);
    expect(compareConditionalSides(up, down)).toEqual({
      asymmetric: true,
      direction: 'B',
      flipped: false,
    });
  });

  it('min-obs floor: shrinking one side below 60 nulls that side AND the comparison', () => {
    // Keep only the first 59 up-days in the mask — the up side must null at
    // the pinned floor and the comparison must refuse to fabricate a verdict.
    const upIdx = [];
    driver.forEach((d, i) => {
      if (d > 0 && upIdx.length < 59) upIdx.push(i);
    });
    const mask59 = driver.map((_, i) => upIdx.includes(i));
    const up59 = maskedPearson(group, driver, mask59, 60);
    expect(up59).toBeNull();
    expect(compareConditionalSides(up59, down)).toBeNull();
  });
});

describe('Build 4 — engineered sign-FLIP fixture (link reverses direction by regime)', () => {
  // The link tracks the driver on up-days and INVERTS on down-days — a genuine
  // regime reversal, the case "tighter on {side}" would misdescribe. The sign
  // flip is the one comparison that survives the truncation caveat (subsetting
  // shrinks |r| but cannot change its sign), so it is a real finding, not an
  // artifact.
  const gen = lehmer(31337);
  const N = 600;
  const driver = Array.from({ length: N }, () => (gen() - 0.5) * 0.02);
  const noise = Array.from({ length: N }, () => (gen() - 0.5) * 0.006);
  const group = driver.map((d, i) => (d > 0 ? 1.0 : -1.0) * d + noise[i]);

  const up = maskedPearson(group, driver, driver.map((d) => d > 0), 60);
  const down = maskedPearson(group, driver, driver.map((d) => d < 0), 60);

  it('up-side is strongly positive, down-side strongly negative — a real reversal', () => {
    expect(up.corr).toBeGreaterThan(0.3);
    expect(down.corr).toBeLessThan(-0.3);
    expect(up.n).toBeGreaterThanOrEqual(60);
    expect(down.n).toBeGreaterThanOrEqual(60);
  });

  it('the comparison reports flipped:true with a null direction (no side is "tighter")', () => {
    const cmp = compareConditionalSides(up, down);
    expect(cmp.asymmetric).toBe(true);
    expect(cmp.flipped).toBe(true);
    expect(cmp.direction).toBeNull();
  });
});

describe('median — the exported shared implementation (Build 4 review)', () => {
  it('odd length → middle; even length → mean of the two middle values', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([5])).toBe(5);
  });

  it('copy-sorts — the caller\'s array is never mutated', () => {
    const a = [3, 1, 2];
    median(a);
    expect(a).toEqual([3, 1, 2]);
  });
});

// ── pairwiseCohesion — intra-group cohesion (V2 Build 5) ─────────────────────
describe('pairwiseCohesion', () => {
  // Period-4 Hadamard rows (zero-sum, mutually orthogonal), tiled to length 60 so
  // slice(-20) = 5 periods and slice(-60) = 15 periods both stay period-aligned,
  // zero-sum AND orthogonal → each pair's Pearson is EXACTLY 0, not noisy-≈0.
  const tile = (pat, times) => Array.from({ length: times }, () => pat).flat();
  const ORTHO_A = tile([1, -1, 1, -1], 15);
  const ORTHO_B = tile([1, 1, -1, -1], 15);
  const ORTHO_C = tile([1, -1, -1, 1], 15);

  // A varied base + two tiny-noise copies → near-perfectly-correlated members.
  const gen = lehmer(555);
  const base = Array.from({ length: 60 }, () => (gen() - 0.5) * 0.03);
  const near1 = base.map((v) => v + (gen() - 0.5) * 0.0004);
  const near2 = base.map((v) => v + (gen() - 0.5) * 0.0004);
  const w = (a) => a.slice(-20);

  it('near-identical members → value ≈ 1, every pair used', () => {
    const r = pairwiseCohesion([base, near1, near2], 20);
    expect(r.value).toBeGreaterThan(0.99);
    expect(r.pairsUsed).toBe(3);
    expect(r.pairsTotal).toBe(3);
  });

  it('mutually-orthogonal zero-sum members → value exactly 0 at BOTH windows', () => {
    const r20 = pairwiseCohesion([ORTHO_A, ORTHO_B, ORTHO_C], 20);
    const r60 = pairwiseCohesion([ORTHO_A, ORTHO_B, ORTHO_C], 60);
    expect(r20.value).toBeCloseTo(0, 12);
    expect(r20.pairsUsed).toBe(3);
    expect(r60.value).toBeCloseTo(0, 12);
    expect(r60.pairsUsed).toBe(3);
  });

  it('value is the mean of the individual pairwise Pearsons over the LAST window (pair indexing + slicing)', () => {
    const members = [base, near1, ORTHO_A];
    const r = pairwiseCohesion(members, 20);
    const expected =
      (pearson(w(base), w(near1)) + pearson(w(base), w(ORTHO_A)) + pearson(w(near1), w(ORTHO_A))) / 3;
    expect(r.value).toBeCloseTo(expected, 12);
    expect(r.pairsUsed).toBe(3);
    expect(r.pairsTotal).toBe(3);
  });

  it('one degenerate (flat) member → its pairs null, disclosed via pairsUsed < pairsTotal, mean over the rest', () => {
    const flat = new Array(60).fill(0.004); // zero variance → pearson nulls its two pairs
    const r = pairwiseCohesion([base, near1, flat], 20);
    expect(r.pairsUsed).toBe(1); // only (base, near1) survives
    expect(r.pairsTotal).toBe(3);
    expect(r.value).toBeCloseTo(pearson(w(base), w(near1)), 12);
  });

  it('every pair degenerate → null (null-never-zero, not a 0 reading)', () => {
    const flatA = new Array(60).fill(0.001);
    const flatB = new Array(60).fill(0.002);
    expect(pairwiseCohesion([flatA, flatB, flatA], 20)).toBe(null);
  });

  it('two members with a valid pair → the single-pair value (general primitive; the ≥3 policy is the endpoint\'s)', () => {
    const r = pairwiseCohesion([base, near1], 20);
    expect(r.pairsTotal).toBe(1);
    expect(r.pairsUsed).toBe(1);
    expect(r.value).toBeCloseTo(pearson(w(base), w(near1)), 12);
  });

  it('fewer than 2 member arrays → null', () => {
    expect(pairwiseCohesion([base], 20)).toBe(null);
    expect(pairwiseCohesion([], 20)).toBe(null);
    expect(pairwiseCohesion(null, 20)).toBe(null);
  });

  it('insufficient window (arrays shorter than window) → null', () => {
    const short = [base.slice(0, 12), near1.slice(0, 12), near2.slice(0, 12)];
    expect(pairwiseCohesion(short, 20)).toBe(null);
  });

  it('per-window gating: enough for 20 but not 60 → c20 value, c60 null', () => {
    const trio = [base.slice(-30), near1.slice(-30), near2.slice(-30)];
    expect(pairwiseCohesion(trio, 20)).not.toBe(null);
    expect(pairwiseCohesion(trio, 60)).toBe(null);
  });

  it('pairsTotal counts every unordered pair (7 members → 21)', () => {
    const seven = Array.from({ length: 7 }, (_, k) =>
      base.map((v) => v + k * 1e-6 + (gen() - 0.5) * 0.0002)
    );
    expect(pairwiseCohesion(seven, 20).pairsTotal).toBe(21);
  });

  it('invalid window → null', () => {
    expect(pairwiseCohesion([base, near1, near2], 1)).toBe(null);
    expect(pairwiseCohesion([base, near1, near2], 20.5)).toBe(null);
  });
});
