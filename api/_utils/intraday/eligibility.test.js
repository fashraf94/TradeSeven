// api/_utils/intraday/eligibility.test.js — contract §8.3 policy v1.
import { describe, it, expect } from 'vitest';
import { evaluateIntraday, CONSUMERS, VERDICT } from './eligibility.js';
import { CONSUMER_MAX_AGE_MS } from '../intradayConfig.js';

const T = Date.UTC(2026, 8, 17, 15, 0, 0);
const cutoff = T - 10 * 60_000;

function facts(over = {}) {
  const base = {
    collectionStalled: false,
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
    expect(ev(f, 'display').vwap).toEqual({ state: VERDICT.DISPLAY_ONLY, reason: 'cutoff_unconfirmed', consumer: 'display' });
    expect(ev(f, 'stage4').vwap).toEqual({ state: VERDICT.INELIGIBLE, reason: 'cutoff_unconfirmed', consumer: 'stage4' });
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
