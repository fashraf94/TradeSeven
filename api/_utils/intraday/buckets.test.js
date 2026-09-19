// api/_utils/intraday/buckets.test.js — contract §6.1–6.4, §6.7.
import { describe, it, expect } from 'vitest';
import {
  applyObservationToBuckets, applyDeadline, advanceState, rebuildFromBuckets, newRing, newState,
  sessionKeys, bucketKeyFor, isAdjacent, indicatorQuality, BUCKET_MS,
} from './buckets.js';
import { stepSma, stepMacd, stepWilderRsi, WARMUP_BARS } from './stepIndicators.js';
import { SEP16, SEP17, SEP18, makeSession, obsAt, sessionOfFixture } from '../__fixtures__/intradaySessions.js';

const early = makeSession('2026-11-27', { early: true, previousEtDate: '2026-11-25' });

function feed(ring, state, obsList, session, opts = {}) {
  let r = ring; let s = state; const completed = []; const rejected = [];
  for (const obs of obsList) {
    const out = applyObservationToBuckets({ ring: r, state: s, obs, session, ...opts });
    r = out.ring; s = out.state; completed.push(...out.completed); if (out.rejected) rejected.push(out.rejected);
  }
  return { ring: r, state: s, completed, rejected };
}
// One price-new observation per minute, price = a deterministic walk.
const walk = (session, fromMin, toMin, seed = 1) => {
  const out = [];
  let p = 100 + seed;
  for (let m = fromMin; m <= toMin; m++) {
    p += Math.sin(m / 3 + seed) * 0.4;
    out.push(obsAt(session, m, { price: Number(p.toFixed(4)), volume: 1000 + m }));
  }
  return out;
};

describe('§6.1 keys and closes', () => {
  it('k = floor(priceAsOf / 300_000); the exact close belongs to the last regular bucket; outside the session → null', () => {
    const { firstKey, lastKey } = sessionKeys(SEP17);
    expect(firstKey).toBe(Math.floor(SEP17.openMs / BUCKET_MS));
    expect(lastKey).toBe(Math.floor((SEP17.closeMs - 1) / BUCKET_MS));
    expect(lastKey - firstKey + 1).toBe(78);
    expect(bucketKeyFor(SEP17.closeMs, SEP17)).toBe(lastKey);
    expect(bucketKeyFor(SEP17.closeMs - 1, SEP17)).toBe(lastKey);
    expect(bucketKeyFor(SEP17.openMs, SEP17)).toBe(firstKey);
    expect(bucketKeyFor(SEP17.openMs - 1, SEP17)).toBeNull();
    expect(bucketKeyFor(SEP17.closeMs + 1, SEP17)).toBeNull();
    const e = sessionKeys(early);
    expect(e.lastKey - e.firstKey + 1).toBe(42);
  });
  it('bucket close = price of the greatest priceAsOf; sampleCount and closeLagMs stored', () => {
    const obs = [obsAt(SEP17, 1, { price: 10 }), obsAt(SEP17, 3, { price: 12 }), obsAt(SEP17, 2, { price: 11 })];
    // (the third arrives late but is price-new relative to the bucket's max? No: 2 < 3 → close stays 12)
    const { ring } = feed(newRing(), newState(), obs, SEP17);
    const b = ring.buckets[0];
    expect(b.status).toBe('open');
    expect(b.close).toBe(12);
    expect(b.sampleCount).toBe(3);
    expect(b.maxPriceAsOf).toBe(SEP17.openMs + 3 * 60_000);
    const done = feed(ring, newState(), [obsAt(SEP17, 5, { price: 13 })], SEP17);
    expect(done.completed).toHaveLength(1);
    expect(done.completed[0]).toMatchObject({ status: 'completed', reason: 'normal', close: 12, sampleCount: 3, closeQualified: true });
    expect(done.completed[0].closeLagMs).toBe(BUCKET_MS - 3 * 60_000);
  });
});

describe('§6.2 completion — normal and deadline', () => {
  it('bucket k completes on an observation with key > k (a gap of several keys still completes it, once)', () => {
    const { ring, completed } = feed(newRing(), newState(), [obsAt(SEP17, 1, { price: 10 }), obsAt(SEP17, 20, { price: 11 })], SEP17);
    expect(completed).toHaveLength(1);
    expect(ring.buckets.map((b) => b.status)).toEqual(['completed', 'open']);
  });
  it('close order: an exact-close observation is applied to the last bucket FIRST, then finalised; indicators advance once', () => {
    const { lastKey } = sessionKeys(SEP17);
    const pre = feed(newRing(), newState(), walk(SEP17, 300, 389), SEP17);
    const closeObs = obsAt(SEP17, 390, { price: 999 });
    const out = applyObservationToBuckets({ ring: pre.ring, state: pre.state, obs: closeObs, session: SEP17 });
    const last = out.ring.buckets.find((b) => b.key === lastKey);
    expect(last.status).toBe('completed');
    expect(last.close).toBe(999);
    expect(last.maxPriceAsOf).toBe(SEP17.closeMs);
    expect(out.completed).toHaveLength(1);
    expect(out.state.completedBars).toBe(pre.state.completedBars + 1);
  });
  it('an observation past the close establishes passage: the last bucket completes but its price is never written', () => {
    const { lastKey } = sessionKeys(SEP17);
    const pre = feed(newRing(), newState(), walk(SEP17, 385, 389), SEP17);
    const out = applyObservationToBuckets({ ring: pre.ring, state: pre.state, obs: obsAt(SEP17, 400, { price: 999 }), session: SEP17 });
    const last = out.ring.buckets.find((b) => b.key === lastKey);
    expect(last.status).toBe('completed');
    expect(last.close).not.toBe(999);
    expect(out.ring.buckets.some((b) => b.key > lastKey)).toBe(false);
  });
  it('deadline: at close + 30 min a last bucket not normally completed is `incomplete` / `deadline`; idempotent; state does not advance', () => {
    const pre = feed(newRing(), newState(), walk(SEP17, 380, 389), SEP17);
    const before = applyDeadline({ ring: pre.ring, session: SEP17, nowMs: SEP17.closeMs + 29 * 60_000 });
    expect(before.changed).toBe(false);
    const at = applyDeadline({ ring: pre.ring, session: SEP17, nowMs: SEP17.closeMs + 30 * 60_000 });
    expect(at.changed).toBe(true);
    const last = at.ring.buckets.find((b) => b.isLast);
    expect(last).toMatchObject({ status: 'incomplete', reason: 'deadline', closeQualified: false });
    const again = applyDeadline({ ring: at.ring, session: SEP17, nowMs: SEP17.closeMs + 31 * 60_000 });
    expect(again.changed).toBe(false);
    // State does not advance across it: the next session's first bucket is NOT adjacent to it.
    const nextFirst = { key: sessionKeys(SEP18).firstKey, sessionEtDate: '2026-09-18', isFirst: true, isLast: false, close: 1, closeQualified: true };
    expect(isAdjacent({ key: last.key, sessionEtDate: '2026-09-17', isLast: true }, nextFirst, SEP18)).toBe(true); // adjacency is by key
    // …but the deadline bucket is never `completed`, so advanceState never saw it: lastCompleted stays the bucket before it.
    expect(pre.state.lastCompleted.key).toBe(last.key - 1);
  });
  it('deadline creates the last bucket as incomplete when it never opened (but only when the session had buckets at all)', () => {
    const pre = feed(newRing(), newState(), walk(SEP17, 370, 384), SEP17);
    const { lastKey } = sessionKeys(SEP17);
    expect(pre.ring.buckets.some((b) => b.key === lastKey)).toBe(false);
    const at = applyDeadline({ ring: pre.ring, session: SEP17, nowMs: SEP17.closeMs + 30 * 60_000 });
    expect(at.ring.buckets.find((b) => b.key === lastKey)).toMatchObject({ status: 'incomplete', reason: 'deadline', close: null });
    const empty = applyDeadline({ ring: newRing(), session: SEP17, nowMs: SEP17.closeMs + 30 * 60_000 });
    expect(empty.changed).toBe(false);
  });
});

describe('§6.3 immutability and adjacency', () => {
  it('an observation for a completed key is rejected (lateUpdateRejected) and the ring is unchanged', () => {
    const pre = feed(newRing(), newState(), [obsAt(SEP17, 1, { price: 10 }), obsAt(SEP17, 6, { price: 11 })], SEP17);
    const out = applyObservationToBuckets({ ring: pre.ring, state: pre.state, obs: obsAt(SEP17, 2, { price: 99 }), session: SEP17 });
    expect(out.rejected).toBe('lateUpdateRejected');
    expect(out.ring).toBe(pre.ring);
    expect(out.ring.buckets[0].close).toBe(10);
  });
  it('adjacency is session-relative: last of the previous session → first of this one; closure gaps are not gaps', () => {
    const prevLast = { key: sessionKeys(SEP16).lastKey, sessionEtDate: '2026-09-16', isLast: true };
    const first = { key: sessionKeys(SEP17).firstKey, sessionEtDate: '2026-09-17', isFirst: true };
    expect(isAdjacent(prevLast, first, SEP17)).toBe(true);
    expect(isAdjacent({ ...prevLast, sessionEtDate: '2026-09-15' }, first, SEP17)).toBe(false);
    expect(isAdjacent({ ...prevLast, isLast: false, key: prevLast.key - 1 }, first, SEP17)).toBe(false);
    expect(isAdjacent({ key: 10, sessionEtDate: '2026-09-17' }, { key: 11, sessionEtDate: '2026-09-17' }, SEP17)).toBe(true);
    expect(isAdjacent({ key: 10, sessionEtDate: '2026-09-17' }, { key: 12, sessionEtDate: '2026-09-17' }, SEP17)).toBe(false);
  });
});

describe('§6.4 gaps and per-indicator warmup', () => {
  const bucket = (key, close, over = {}) => ({ key, sessionEtDate: '2026-09-17', isFirst: false, isLast: false, close, status: 'completed', closeQualified: true, ...over });

  it('each indicator initialises independently once the contiguous segment reaches its warmup (15 / 20 / 35)', () => {
    let s = newState();
    const q = (i) => indicatorQuality(s, i);
    for (let i = 0; i < 40; i++) {
      s = advanceState(s, bucket(1000 + i, 100 + Math.sin(i)), SEP17);
      const n = i + 1;
      expect(q('rsi5m').warmupMet).toBe(n >= 15);
      expect(stepWilderRsi.value(s.rsi) !== null).toBe(n >= 15);
      expect(stepSma.value(s.sma20) !== null).toBe(n >= 20);
      expect(stepMacd.value(s.macd) !== null).toBe(n >= 35);
    }
    expect(WARMUP_BARS).toEqual({ rsi5m: 15, sma20_5m: 20, macd5m: 35 });
  });
  it('a missing bucket breaks the segment: state does not advance, every indicator re-warms from the new segment; gaps counted', () => {
    let s = newState();
    for (let i = 0; i < 40; i++) s = advanceState(s, bucket(1000 + i, 100 + i * 0.1), SEP17);
    expect(stepMacd.value(s.macd)).not.toBeNull();
    s = advanceState(s, bucket(1041, 105), SEP17); // 1040 missing
    expect(s.gaps).toBe(1);
    expect(s.segmentLen).toBe(1);
    expect(s.macd).toBeNull(); expect(s.rsi).toBeNull(); expect(s.sma20).toBeNull();
    for (let i = 42; i < 42 + 34; i++) s = advanceState(s, bucket(1000 + i, 105 + (i % 5)), SEP17);
    expect(stepMacd.value(s.macd)).not.toBeNull();
    expect(s.segmentLen).toBe(35);
  });
  it('warmup measured on the segment equals the batch value over that segment (parity through the bucket layer)', () => {
    let s = newState();
    const closes = [];
    for (let i = 0; i < 61; i++) { const c = 100 + Math.sin(i / 2) * 3; closes.push(c); s = advanceState(s, bucket(1000 + i, c), SEP17); }
    expect(stepMacd.value(s.macd)).toEqual(stepMacd.value(stepMacd.init(closes, { barKeys: closes.map((_, i) => 1000 + i) })));
    expect(stepWilderRsi.value(s.rsi)).toBe(stepWilderRsi.value(stepWilderRsi.init(closes)));
    expect(stepSma.value(s.sma20)).toBe(stepSma.value(stepSma.init(closes)));
  });
});

describe('§6.7 close qualification propagates', () => {
  const b = (key, close, { last = false, qualified = !last } = {}) => ({ key, sessionEtDate: '2026-09-17', isFirst: false, isLast: last, close, status: 'completed', closeQualified: qualified });

  it('the last bucket of a session is unqualified while CLOSING_ROW_POLICY is null, qualified once it is set', () => {
    const pre = feed(newRing(), newState(), walk(SEP17, 385, 389), SEP17);
    const nul = applyObservationToBuckets({ ring: pre.ring, state: pre.state, obs: obsAt(SEP17, 390, { price: 5 }), session: SEP17, closingRowPolicy: null });
    expect(nul.ring.buckets.find((x) => x.isLast).closeQualified).toBe(false);
    const set = applyObservationToBuckets({ ring: pre.ring, state: pre.state, obs: obsAt(SEP17, 390, { price: 5 }), session: SEP17, closingRowPolicy: 'vendor_close_row' });
    expect(set.ring.buckets.find((x) => x.isLast).closeQualified).toBe(true);
  });

  it('SMA20 clears when the unqualified bucket leaves its 20-bucket window; MACD/RSI clear ONLY by qualified reinitialisation', () => {
    let s = newState();
    for (let i = 0; i < 40; i++) s = advanceState(s, b(1000 + i, 100 + i * 0.05), SEP17);
    expect(indicatorQuality(s, 'sma20_5m').closeQualified).toBe(true);
    expect(indicatorQuality(s, 'macd5m').closeQualified).toBe(true);
    expect(indicatorQuality(s, 'rsi5m').closeQualified).toBe(true);
    // An unqualified bucket (a session's last, closing row unresolved).
    s = advanceState(s, b(1040, 102, { last: true }), SEP17);
    expect(indicatorQuality(s, 'sma20_5m').closeQualified).toBe(false);
    expect(indicatorQuality(s, 'macd5m').closeQualified).toBe(false);
    expect(indicatorQuality(s, 'rsi5m').closeQualified).toBe(false);
    // 19 more qualified buckets: still inside the SMA window.
    for (let i = 41; i < 60; i++) s = advanceState(s, b(1000 + i, 102 + (i % 3) * 0.1), SEP17);
    expect(indicatorQuality(s, 'sma20_5m').closeQualified).toBe(false);
    // The 20th: the unqualified bucket leaves the window → SMA clears; MACD/RSI do not (elapsed bars never clear them).
    s = advanceState(s, b(1060, 102.5), SEP17);
    expect(indicatorQuality(s, 'sma20_5m').closeQualified).toBe(true);
    expect(indicatorQuality(s, 'macd5m').closeQualified).toBe(false);
    expect(indicatorQuality(s, 'rsi5m').closeQualified).toBe(false);
    for (let i = 61; i < 120; i++) s = advanceState(s, b(1000 + i, 102 + (i % 7) * 0.1), SEP17);
    expect(indicatorQuality(s, 'macd5m').closeQualified).toBe(false);
    expect(indicatorQuality(s, 'rsi5m').closeQualified).toBe(false);
    // A contiguity break, then a fully qualified segment of warmupBars → reinitialisation clears them.
    s = advanceState(s, b(1200, 103), SEP17);
    for (let i = 1201; i < 1200 + 35; i++) s = advanceState(s, b(i, 103 + (i % 4) * 0.1), SEP17);
    expect(indicatorQuality(s, 'macd5m').closeQualified).toBe(true);
    expect(indicatorQuality(s, 'rsi5m').closeQualified).toBe(true);
  });

  it('a reinitialisation whose seed segment contains an unqualified bucket stays unqualified', () => {
    let s = newState();
    for (let i = 0; i < 10; i++) s = advanceState(s, b(1000 + i, 100 + i * 0.1), SEP17);
    s = advanceState(s, b(1010, 101, { last: true }), SEP17);
    for (let i = 11; i < 40; i++) s = advanceState(s, b(1000 + i, 101 + (i % 3) * 0.1), SEP17);
    expect(stepMacd.value(s.macd)).not.toBeNull();
    expect(indicatorQuality(s, 'macd5m').closeQualified).toBe(false);
    expect(indicatorQuality(s, 'rsi5m').closeQualified).toBe(false);
  });
});

describe('§6.6 rebuild — chronological recompute over seed + today, trim to 60, parity over > 60 bars', () => {
  it('rebuildFromBuckets equals the incremental path over 78 + 30 buckets and trims the ring to 60 closed buckets', () => {
    // Yesterday's full session, seeded, then 30 of today's buckets incrementally.
    const { firstKey: f16, lastKey: l16 } = sessionKeys(SEP16);
    const seeded = [];
    for (let k = f16; k <= l16; k++) seeded.push({ key: k, startMs: k * BUCKET_MS, endMs: k * BUCKET_MS + BUCKET_MS, sessionEtDate: '2026-09-16', isFirst: k === f16, isLast: k === l16, close: 100 + Math.sin((k - f16) / 4) * 2, sampleCount: 5, maxPriceAsOf: k * BUCKET_MS + 240_000, closeLagMs: 60_000, status: 'completed', reason: 'seed', seeded: true, closeQualified: k !== l16 });
    // Incremental: seed state, then today's observations.
    let s = newState();
    for (const bk of seeded) s = advanceState(s, bk, SEP16);
    const inc = feed({ buckets: seeded }, s, walk(SEP17, 0, 154), SEP17);
    const rebuilt = rebuildFromBuckets({ seeded, existing: inc.ring.buckets, sessionOf: sessionOfFixture, maxClosed: 60 });
    expect(rebuilt.ring.buckets.filter((x) => x.status !== 'open')).toHaveLength(60);
    expect(inc.ring.buckets.filter((x) => x.status !== 'open')).toHaveLength(60);
    expect(stepMacd.value(rebuilt.state.macd)).toEqual(stepMacd.value(inc.state.macd));
    expect(stepWilderRsi.value(rebuilt.state.rsi)).toBe(stepWilderRsi.value(inc.state.rsi));
    expect(stepSma.value(rebuilt.state.sma20)).toBe(stepSma.value(inc.state.sma20));
    expect(rebuilt.state.completedBars).toBe(78 + 30);
    expect(rebuilt.state.gaps).toBe(0);
    expect(rebuilt.state.segmentLen).toBe(108);
    // Today's observations never erased or reordered.
    const todays = rebuilt.ring.buckets.filter((x) => x.sessionEtDate === '2026-09-17').map((x) => x.key);
    expect(todays).toEqual([...todays].sort((a, c) => a - c));
    expect(todays).toHaveLength(31);
    expect(rebuilt.ring.buckets.at(-1).status).toBe('open');
  });
});
