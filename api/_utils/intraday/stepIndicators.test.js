// api/_utils/intraday/stepIndicators.test.js
// Contract §6.5 — step functions with batch parity at N ∈ {35, 61, 120} to 1e-9.
// The batch functions are the parity oracle (technicalCalculations.js is
// non-fenced; calculate5minSMA20 lives in the fenced agentRiskManager.js and
// is CALLED here, never edited — BUILD_RULES §1 permits calling).

import { describe, it, expect } from 'vitest';
import { calculateRSI, calculateMACD, calculateEMA } from '../technicalCalculations.js';
import { calculate5minSMA20 } from '../agentRiskManager.js';
import {
  stepEma, stepSma, stepWilderRsi, stepMacd, roundLikeBatch, WARMUP_BARS,
  RSI_PERIOD, SMA_PERIOD, MACD_FAST, MACD_SLOW, MACD_SIGNAL,
} from './stepIndicators.js';

// Deterministic pseudo-random closes (LCG) — a random walk with drift and a
// few sharp moves so the sign of the MACD histogram actually flips.
function closes(n, seed = 7) {
  let x = seed >>> 0;
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const u = x / 2 ** 32;
    p = p * (1 + (u - 0.5) * 0.02) + (i % 17 === 0 ? (u - 0.5) * 2 : 0);
    out.push(Number(p.toFixed(4)));
  }
  return out;
}

// Unrounded references — the batch loops, verbatim, without their toFixed.
function refRsiRaw(oldestFirst, period = RSI_PERIOD) {
  const changes = [];
  for (let i = 1; i < oldestFirst.length; i++) changes.push(oldestFirst[i] - oldestFirst[i - 1]);
  if (changes.length < period) return null;
  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? Math.abs(c) : 0));
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}
function refEmaSeries(data, period) {
  if (data.length < period) return new Array(data.length).fill(null);
  const k = 2 / (period + 1);
  const ema = [];
  let sum = 0;
  for (let i = 0; i < period; i++) { sum += data[i]; ema.push(null); }
  ema[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) ema.push((data[i] - ema[i - 1]) * k + ema[i - 1]);
  return ema;
}
function refMacdRaw(oldestFirst, fast = MACD_FAST, slow = MACD_SLOW, signal = MACD_SIGNAL) {
  if (oldestFirst.length < slow + signal) return null;
  const f = refEmaSeries(oldestFirst, fast);
  const s = refEmaSeries(oldestFirst, slow);
  const line = oldestFirst.map((_, i) => (f[i] !== null && s[i] !== null ? f[i] - s[i] : null));
  const valid = line.filter((v) => v !== null);
  if (valid.length < signal) return null;
  const sig = refEmaSeries(valid, signal);
  const l = line[line.length - 1];
  const g = sig[sig.length - 1];
  if (l === null || g === null) return null;
  return { line: l, signal: g, hist: l - g };
}

const NS = [35, 61, 120];

describe('§6.5 stepEma — batch parity', () => {
  for (const period of [12, 26]) {
    for (const n of NS) {
      it(`EMA(${period}) at N=${n} matches calculateEMA exactly (rounded) and the raw loop to 1e-9`, () => {
        const c = closes(n, period * 31 + n);
        const st = stepEma.init(c, { period });
        const raw = stepEma.value(st);
        const ref = refEmaSeries(c, period);
        expect(Math.abs(raw - ref[ref.length - 1])).toBeLessThanOrEqual(1e-9);
        expect(roundLikeBatch(raw, 4)).toBe(calculateEMA([...c].reverse(), period));
      });
    }
  }
  it('init-then-step equals init over the whole series (state is complete)', () => {
    const c = closes(80, 3);
    for (const k of [0, 5, 12, 40]) {
      let st = stepEma.init(c.slice(0, k), { period: 12 });
      for (const x of c.slice(k)) st = stepEma.step(st, x);
      expect(stepEma.value(st)).toBe(stepEma.value(stepEma.init(c, { period: 12 })));
    }
  });
  it('is null below period closes and does not mutate its input state', () => {
    const st0 = stepEma.init(closes(5), { period: 12 });
    expect(stepEma.value(st0)).toBeNull();
    const frozen = JSON.stringify(st0);
    stepEma.step(st0, 101);
    expect(JSON.stringify(st0)).toBe(frozen);
  });
});

describe('§6.5 stepSma — batch parity with calculate5minSMA20', () => {
  for (const n of NS) {
    it(`SMA20 at N=${n}`, () => {
      const c = closes(n, 11 + n);
      const raw = stepSma.value(stepSma.init(c, { period: SMA_PERIOD }));
      const ref = c.slice(-20).reduce((a, b) => a + b, 0) / 20;
      expect(Math.abs(raw - ref)).toBeLessThanOrEqual(1e-9);
      expect(roundLikeBatch(raw, 4)).toBe(calculate5minSMA20(c.map((close) => ({ close }))));
    });
  }
  it('is null below 20 closes, then defined at exactly 20', () => {
    const c = closes(20, 2);
    expect(stepSma.value(stepSma.init(c.slice(0, 19)))).toBeNull();
    expect(stepSma.value(stepSma.init(c))).not.toBeNull();
    expect(WARMUP_BARS.sma20_5m).toBe(20);
  });
});

describe('§6.5 stepWilderRsi — batch parity with calculateRSI', () => {
  for (const n of NS) {
    it(`RSI-14 at N=${n}`, () => {
      const c = closes(n, 101 + n);
      const raw = stepWilderRsi.value(stepWilderRsi.init(c, { period: RSI_PERIOD }));
      expect(Math.abs(raw - refRsiRaw(c))).toBeLessThanOrEqual(1e-9);
      expect(roundLikeBatch(raw, 2)).toBe(calculateRSI([...c].reverse(), RSI_PERIOD).value);
    });
  }
  it('path dependence is honoured: a 15-close window differs from the full path (the reason step functions exist)', () => {
    const c = closes(120, 5);
    const full = stepWilderRsi.value(stepWilderRsi.init(c));
    const windowed = stepWilderRsi.value(stepWilderRsi.init(c.slice(-15)));
    expect(full).not.toBe(windowed);
    expect(roundLikeBatch(full, 2)).toBe(calculateRSI([...c].reverse()).value);
  });
  it('is null until 15 closes (14 changes), then defined; avgLoss 0 → 100', () => {
    const c = closes(15, 9);
    expect(stepWilderRsi.value(stepWilderRsi.init(c.slice(0, 14)))).toBeNull();
    expect(stepWilderRsi.value(stepWilderRsi.init(c))).not.toBeNull();
    expect(WARMUP_BARS.rsi5m).toBe(15);
    const rising = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(stepWilderRsi.value(stepWilderRsi.init(rising))).toBe(100);
    expect(calculateRSI([...rising].reverse()).value).toBe(100);
  });
  it('init-then-step equals init over the whole series', () => {
    const c = closes(70, 4);
    for (const k of [0, 1, 14, 15, 33]) {
      let st = stepWilderRsi.init(c.slice(0, k));
      for (const x of c.slice(k)) st = stepWilderRsi.step(st, x);
      expect(stepWilderRsi.value(st)).toBe(stepWilderRsi.value(stepWilderRsi.init(c)));
    }
  });
});

describe('§6.5 stepMacd — batch parity with calculateMACD (signal seeded on the valid subsequence)', () => {
  for (const n of NS) {
    it(`MACD(12,26,9) at N=${n}`, () => {
      const c = closes(n, 55 + n);
      const v = stepMacd.value(stepMacd.init(c));
      const ref = refMacdRaw(c);
      expect(Math.abs(v.line - ref.line)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(v.signal - ref.signal)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(v.hist - ref.hist)).toBeLessThanOrEqual(1e-9);
      const batch = calculateMACD([...c].reverse());
      expect(roundLikeBatch(v.line, 4)).toBe(batch.macd);
      expect(roundLikeBatch(v.signal, 4)).toBe(batch.signal);
      expect(roundLikeBatch(v.hist, 4)).toBe(batch.histogram);
    });
  }
  it('honours the batch guard: null at 34 closes even though the signal EMA is defined, defined at 35', () => {
    const c = closes(35, 8);
    const at34 = stepMacd.init(c.slice(0, 34));
    expect(at34.signalValue).not.toBeNull();
    expect(stepMacd.value(at34)).toBeNull();
    expect(calculateMACD([...c.slice(0, 34)].reverse())).toBeNull();
    expect(stepMacd.value(stepMacd.init(c))).not.toBeNull();
    expect(WARMUP_BARS.macd5m).toBe(35);
  });
  it('event is set iff sign(line − signal) changed between the last two completed buckets, with that bucket key', () => {
    const c = closes(120, 21);
    const keys = c.map((_, i) => 1000 + i);
    let st = stepMacd.init([], {});
    let events = 0;
    let prevSign = null;
    for (let i = 0; i < c.length; i++) {
      st = stepMacd.step(st, c[i], keys[i]);
      const v = stepMacd.value(st);
      if (!v) continue;
      const s = v.hist > 0 ? 1 : v.hist < 0 ? -1 : 0;
      const expectedEvent = prevSign !== null && s !== 0 && s !== prevSign;
      expect(v.event).toBe(expectedEvent);
      if (expectedEvent) { events += 1; expect(v.eventBarKey).toBe(keys[i]); }
      if (s !== 0) prevSign = s;
    }
    expect(events).toBeGreaterThan(0);
  });
  it('init-then-step equals init over the whole series (recursive state is complete)', () => {
    const c = closes(90, 13);
    for (const k of [0, 11, 25, 34, 35, 60]) {
      let st = stepMacd.init(c.slice(0, k));
      for (const x of c.slice(k)) st = stepMacd.step(st, x);
      expect(stepMacd.value(st)).toEqual(stepMacd.value(stepMacd.init(c)));
    }
  });
  it('rejects a non-finite close loudly rather than poisoning the state', () => {
    const st = stepMacd.init(closes(40));
    expect(() => stepMacd.step(st, NaN)).toThrow();
    expect(() => stepWilderRsi.step(stepWilderRsi.init(closes(20)), null)).toThrow();
    expect(() => stepSma.step(stepSma.init(closes(20)), '1')).toThrow();
  });
  it('state round-trips through JSON (persisted as stateJson, §7.1)', () => {
    const c = closes(50, 2);
    const st = stepMacd.init(c.slice(0, 40));
    const revived = JSON.parse(JSON.stringify(st));
    let a = st; let b = revived;
    for (const x of c.slice(40)) { a = stepMacd.step(a, x); b = stepMacd.step(b, x); }
    expect(stepMacd.value(b)).toEqual(stepMacd.value(a));
  });
});
