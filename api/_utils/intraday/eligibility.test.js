// api/_utils/intraday/eligibility.test.js — contract §8.3 policy v1.
import { describe, it, expect } from 'vitest';
import { evaluateIntraday, CONSUMERS, VERDICT } from './eligibility.js';
import { CONSUMER_MAX_AGE_MS } from '../intradayConfig.js';

const T = Date.UTC(2026, 8, 17, 15, 0, 0);
const cutoff = T - 10 * 60_000;

function facts(over = {}) {
  const base = {
    collectionStalled: false,
    // §8.2 puts availableAt on the symbol record; addendum A2 uses it as the
    // age basis when the indicator's own cutoff is unconfirmed.
    availableAt: T - 15 * 60_000,
    price: { value: 100, priceAsOf: T - 15 * 60_000 },
    indicators: {
      vwap: { status: 'ready', value: 99.5, method: 'sampled_estimate', experimental: false, estimateCutoff: cutoff, volumeCutoffAsOf: cutoff, quality: { samples: 5, degraded: false }, reason: null },
      sessionHL: { status: 'ready', value: { high: 101, low: 98, open: 99 }, cutoff, reason: null },
      volume: { status: 'ready', value: 1_000_000, cutoff, reason: null },
      volumePace: { status: 'ready', value: 1.2, method: 'linear_pace', elapsedAtCutoffMin: 30, cutoff, reason: null },
      sma20_5m: { status: 'completed', value: 100.2, cutoff, quality: { completedBars: 40, gaps: 0, closeLagMs: 1000, warmupMet: true, closeQualified: true }, reason: null },
      macd5m: { status: 'completed', value: { line: 0.1, signal: 0.05, hist: 0.05, event: false, eventBarKey: null }, cutoff, quality: { completedBars: 40, gaps: 0, closeLagMs: 1000, warmupMet: true, closeQualified: true }, reason: null },
      rsi5m: { status: 'completed', value: 55, cutoff, quality: { completedBars: 40, gaps: 0, closeLagMs: 1000, warmupMet: true, closeQualified: true }, reason: null },
    },
  };
  const merged = structuredClone(base);
  for (const [k, v] of Object.entries(over.indicators || {})) merged.indicators[k] = { ...merged.indicators[k], ...v };
  if ('collectionStalled' in over) merged.collectionStalled = over.collectionStalled;
  return merged;
}
const ev = (f, consumer = 'display', nowMs = T) => evaluateIntraday(f, { nowMs, policyVersion: 1, consumer }).verdicts;

describe('§8.3 eligible', () => {
  it('a confirmed, fresh, completed, warmed, non-degraded, non-experimental fact is eligible for both consumers; every verdict names its consumer', () => {
    for (const c of ['display', 'stage4']) {
      const v = ev(facts(), c);
      for (const k of Object.keys(v)) { expect(v[k].state, `${c}/${k}`).toBe(VERDICT.ELIGIBLE); expect(v[k].consumer).toBe(c); expect(v[k].ageMs).toBe(10 * 60_000); }
    }
  });
  it('the verdict flips as nowMs crosses the age limit while the fact is unchanged (display 45 min, stage 4 25 min)', () => {
    const f = facts();
    expect(CONSUMER_MAX_AGE_MS).toEqual({ display: 45 * 60_000, stage4: 25 * 60_000 });
    expect(ev(f, 'display', cutoff + 45 * 60_000).sma20_5m.state).toBe(VERDICT.ELIGIBLE);
    expect(ev(f, 'display', cutoff + 45 * 60_000 + 1).sma20_5m).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'stale' });
    expect(ev(f, 'stage4', cutoff + 25 * 60_000).macd5m.state).toBe(VERDICT.ELIGIBLE);
    expect(ev(f, 'stage4', cutoff + 25 * 60_000 + 1).macd5m).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'stale' });
    // Age is measured from the indicator's OWN cutoff, not the quote's.
    const older = facts({ indicators: { rsi5m: { cutoff: cutoff - 40 * 60_000 } } });
    expect(ev(older, 'display').rsi5m.reason).toBe('stale');
    expect(ev(older, 'display').sma20_5m.state).toBe(VERDICT.ELIGIBLE);
  });
});

describe('§8.3 display_only', () => {
  it('experimental VWAP (build 1) is display_only for display with reason cutoff_unconfirmed, ineligible for stage 4', () => {
    const f = facts({ indicators: { vwap: { experimental: true, estimateCutoff: null, volumeCutoffAsOf: null, reason: 'cutoff_unconfirmed' } } });
    // A2: with the cutoff unconfirmed the age is measured from the quote's
    // own availableAt, and it rides the verdict.
    expect(ev(f, 'display').vwap).toEqual({ state: VERDICT.DISPLAY_ONLY, reason: 'cutoff_unconfirmed', consumer: 'display', ageMs: 15 * 60_000 });
    expect(ev(f, 'stage4').vwap).toEqual({ state: VERDICT.INELIGIBLE, reason: 'cutoff_unconfirmed', consumer: 'stage4', ageMs: 15 * 60_000 });
    // experimental WITH a cutoff still never reaches eligible.
    const f2 = facts({ indicators: { vwap: { experimental: true } } });
    expect(ev(f2, 'display').vwap.state).toBe(VERDICT.DISPLAY_ONLY);
    expect(ev(f2, 'stage4').vwap).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'experimental' });
  });
  it('a vendor aggregate with a null cutoff is display_only for display only', () => {
    const f = facts({ indicators: { sessionHL: { cutoff: null }, volume: { cutoff: null } } });
    expect(ev(f, 'display').sessionHL.state).toBe(VERDICT.DISPLAY_ONLY);
    expect(ev(f, 'display').volume.state).toBe(VERDICT.DISPLAY_ONLY);
    expect(ev(f, 'stage4').sessionHL).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'cutoff_unconfirmed' });
  });
  it('a bucket indicator with a null cutoff is ineligible for every consumer (never display_only)', () => {
    const f = facts({ indicators: { sma20_5m: { cutoff: null } } });
    expect(ev(f, 'display').sma20_5m).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'cutoff_unconfirmed' });
  });
});

describe('§8.3 ineligible, with reason', () => {
  it('samples < 3, degraded, collectionStalled, warmup unmet, not completed, absent, and (stage 4 only) closeQualified false', () => {
    expect(ev(facts({ indicators: { vwap: { quality: { samples: 2, degraded: false } } } })).vwap).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'insufficient_samples' });
    expect(ev(facts({ indicators: { vwap: { quality: { samples: 9, degraded: true } } } })).vwap).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'degraded' });
    const stalled = ev(facts({ collectionStalled: true }));
    for (const k of Object.keys(stalled)) expect(stalled[k]).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'collection_stalled' });
    expect(ev(facts({ indicators: { macd5m: { quality: { warmupMet: false, closeQualified: null } } } })).macd5m).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'warmup' });
    expect(ev(facts({ indicators: { rsi5m: { status: 'absent', value: null, reason: 'warmup' } } })).rsi5m).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'warmup' });
    expect(ev(facts({ indicators: { rsi5m: { status: 'open' } } })).rsi5m).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'not_completed' });
    const unq = facts({ indicators: { macd5m: { quality: { warmupMet: true, closeQualified: false } } } });
    expect(ev(unq, 'display').macd5m.state).toBe(VERDICT.ELIGIBLE);
    expect(ev(unq, 'stage4').macd5m).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'close_unqualified' });
    expect(ev({ indicators: {} }).vwap).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'not_in_snapshot' });
    expect(ev(facts({ indicators: { vwap: { status: 'ineligible', reason: 'no_session_anchor', value: null } } })).vwap).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'no_session_anchor' });
  });
  it('a non-finite value is never eligible; unknown consumer / policy throw', () => {
    expect(ev(facts({ indicators: { sma20_5m: { value: NaN } } })).sma20_5m.state).toBe(VERDICT.INELIGIBLE);
    expect(() => evaluateIntraday(facts(), { nowMs: T, consumer: 'agent' })).toThrow();
    expect(() => evaluateIntraday(facts(), { nowMs: T, consumer: 'display', policyVersion: 2 })).toThrow();
    expect(() => evaluateIntraday(facts(), { consumer: 'display' })).toThrow();
    expect(CONSUMERS).toEqual({ DISPLAY: 'display', STAGE4: 'stage4' });
  });
});

// ---------------------------------------------------------------------------
// Addendum A2 — the age gate runs BEFORE the cutoff-null branch.
// Review finding R-3 (docs/audits/20260919_BUILD1_INTRADAY_REVIEW.md).
// ---------------------------------------------------------------------------
describe('A2 §8.3 — a cutoff-unconfirmed fact is still bounded by the quote behind it', () => {
  it('an 18-hour-old carried-forward fact is ineligible/stale, NOT display_only', () => {
    // The shape the review measured: §15 open so every cutoff is null, the
    // poller alive so collectionStalled is false, and the facts carried
    // forward from yesterday by §5.5.
    const f = facts({
      indicators: {
        vwap: { experimental: true, estimateCutoff: null, volumeCutoffAsOf: null, reason: 'cutoff_unconfirmed' },
        sessionHL: { cutoff: null },
        volume: { cutoff: null },
      },
    });
    f.availableAt = T - 18 * 60 * 60_000;
    f.collectionStalled = false;

    const v = ev(f, 'display');
    for (const k of ['vwap', 'sessionHL', 'volume']) {
      expect(v[k], `${k} must not render as current`).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'stale' });
      expect(v[k].ageMs).toBe(18 * 60 * 60_000);
    }
  });

  it('the display_only window is the consumer\'s own maxAgeMs, measured from availableAt', () => {
    const mk = (ageMs) => {
      const f = facts({ indicators: { sessionHL: { cutoff: null }, volume: { cutoff: null } } });
      f.availableAt = T - ageMs;
      return f;
    };
    // Exactly at the display limit: still shown.
    expect(ev(mk(45 * 60_000), 'display').sessionHL.state).toBe(VERDICT.DISPLAY_ONLY);
    // One millisecond past it: refused.
    expect(ev(mk(45 * 60_000 + 1), 'display').sessionHL).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'stale' });
    // A fresh quote is unaffected — the fix costs nothing in normal operation.
    expect(ev(mk(60_000), 'display').sessionHL.state).toBe(VERDICT.DISPLAY_ONLY);
  });

  it('a record with no cutoff AND no availableAt cannot be aged, so it is never display_only', () => {
    const f = facts({ indicators: { sessionHL: { cutoff: null } } });
    f.availableAt = null;
    expect(ev(f, 'display').sessionHL).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'cutoff_unconfirmed' });
  });

  it('a confirmed indicator is UNAFFECTED — §8.3 still ages it from its own cutoff, not the quote', () => {
    // Deliberate scope: A2 bounds only the null-cutoff path. An hour-old
    // quote with 10-minute-old cutoffs keeps its eligible verdicts, because
    // the cutoff is the tighter and more accurate measure and §8.3 says so.
    const f = facts();
    f.availableAt = T - 60 * 60_000;
    expect(ev(f, 'display').sma20_5m.state).toBe(VERDICT.ELIGIBLE);
    expect(ev(f, 'display').sma20_5m.ageMs).toBe(10 * 60_000);
  });
});
