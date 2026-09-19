// api/_utils/intraday/seed.test.js — contract §6.6 seeding (pure half).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateBarsToBuckets, contiguousTail, combineSeedSessions, barTimeMs } from './seed.js';
import { advanceState, newState, sessionKeys, BUCKET_MS } from './buckets.js';
import { stepMacd, stepSma, stepWilderRsi, WARMUP_BARS } from './stepIndicators.js';
import { SEP17, SEP16, makeSession } from '../__fixtures__/intradaySessions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '../../../docs/audits/fixtures/AAPL_2026-09-17_1m.json');
const bars = JSON.parse(readFileSync(FIXTURE, 'utf8'));

describe('the founder fixture (precondition 4, materialised at the contract path)', () => {
  it('has 391 rows, 13:30–20:00 UTC, contiguous at 60 s, 16:00 row carrying real volume', () => {
    expect(bars).toHaveLength(391);
    expect(bars[0].datetime).toBe('2026-09-17 13:30:00');
    expect(bars[390].datetime).toBe('2026-09-17 20:00:00');
    for (let i = 1; i < bars.length; i++) expect(bars[i].timestamp - bars[i - 1].timestamp).toBe(60);
    expect(bars[390].volume).toBe(19122063);
    expect(bars.reduce((a, r) => a + r.volume, 0)).toBe(44574829);
    expect(barTimeMs(bars[0])).toBe(SEP17.openMs);
    expect(barTimeMs(bars[390])).toBe(SEP17.closeMs);
  });
});

describe('§6.6 aggregation of 1-minute bars into 5-minute buckets', () => {
  it('a normal session yields 78 seeded, completed, contiguous buckets; the 16:00 row lands in the last bucket', () => {
    const { buckets, barsUsed, barsIgnored } = aggregateBarsToBuckets(bars, SEP17);
    expect(barsUsed).toBe(391); expect(barsIgnored).toBe(0);
    expect(buckets).toHaveLength(78);
    const { firstKey, lastKey } = sessionKeys(SEP17);
    expect(buckets[0].key).toBe(firstKey);
    expect(buckets[77].key).toBe(lastKey);
    expect(buckets.every((b) => b.seeded && b.status === 'completed')).toBe(true);
    expect(buckets[77].sampleCount).toBe(6); // 15:55..15:59 + the 16:00 row
    expect(buckets[77].close).toBe(bars[390].close);
    expect(buckets[77].maxPriceAsOf).toBe(SEP17.closeMs);
    expect(buckets[0].close).toBe(bars[4].close);
    expect(buckets[0].closeLagMs).toBe(60_000);
    // §6.7: the closing row is unresolved → last bucket unqualified in build 1.
    expect(buckets[77].closeQualified).toBe(false);
    expect(buckets[76].closeQualified).toBe(true);
    expect(aggregateBarsToBuckets(bars, SEP17, { closingRowPolicy: 'x' }).buckets[77].closeQualified).toBe(true);
  });
  it('an early-close session yields 42 buckets with per-indicator readiness (RSI/SMA ready, MACD ready at 35 ≤ 42)', () => {
    const early = makeSession('2026-11-27', { early: true, previousEtDate: '2026-11-25' });
    const minutes = 211; // 13:30 … 17:00 UTC inclusive
    const earlyBars = Array.from({ length: minutes }, (_, i) => ({ timestamp: (early.openMs + i * 60_000) / 1000, close: 100 + Math.sin(i / 7), volume: 100 }));
    const { buckets } = aggregateBarsToBuckets(earlyBars, early);
    expect(buckets).toHaveLength(42);
    const tail = contiguousTail(buckets, early, 60);
    expect(tail).toHaveLength(42);
    let s = newState();
    for (const b of tail) s = advanceState(s, b, early);
    expect(stepWilderRsi.value(s.rsi)).not.toBeNull();
    expect(stepSma.value(s.sma20)).not.toBeNull();
    expect(stepMacd.value(s.macd)).not.toBeNull();
    expect(s.segmentLen).toBe(42);
    expect(42 >= WARMUP_BARS.macd5m).toBe(true);
  });
  it('bars outside the session or without a finite close are ignored and counted', () => {
    const extra = [...bars, { timestamp: (SEP17.closeMs + 60_000) / 1000, close: 1 }, { timestamp: bars[10].timestamp, close: null }];
    const { buckets, barsIgnored } = aggregateBarsToBuckets(extra, SEP17);
    expect(barsIgnored).toBe(2);
    expect(buckets).toHaveLength(78);
  });
});

describe('§6.6 contiguous tail and two-session combination', () => {
  it('the tail is the longest run ending at the last bucket, capped at 60; a missing last bucket yields an empty seed', () => {
    const { buckets } = aggregateBarsToBuckets(bars, SEP17);
    expect(contiguousTail(buckets, SEP17, 60)).toHaveLength(60);
    expect(contiguousTail(buckets, SEP17, 60)[59].key).toBe(sessionKeys(SEP17).lastKey);
    const holed = buckets.filter((b) => b.key !== buckets[70].key);
    expect(contiguousTail(holed, SEP17, 60)).toHaveLength(7);
    expect(contiguousTail(buckets.slice(0, 77), SEP17, 60)).toEqual([]);
  });
  it('fewer than 35 available → a second (older) session is combined when it connects; otherwise the newer tail alone', () => {
    const { buckets: b17 } = aggregateBarsToBuckets(bars, SEP17);
    const { buckets: b16 } = aggregateBarsToBuckets(bars.map((r) => ({ ...r, timestamp: r.timestamp - 86400 })), SEP16);
    const short17 = contiguousTail(b17.filter((b) => b.key !== b17[60].key), SEP17, 60); // 17 buckets
    expect(short17.length).toBeLessThan(35);
    const combined = combineSeedSessions([contiguousTail(b16, SEP16, 60), short17], [SEP16, SEP17], 60);
    // The older session cannot connect: today's tail does not reach today's first bucket.
    expect(combined).toHaveLength(17);
    // A full-session gap at the FRONT of today (join at 10:35) DOES connect through the first bucket? No — the tail must reach firstKey.
    const full17 = contiguousTail(b17, SEP17, 60);
    const both = combineSeedSessions([contiguousTail(b16, SEP16, 60), full17], [SEP16, SEP17], 60);
    expect(both).toHaveLength(60);
    // When today's tail is the whole session (78 ≥ 60) the older one is trimmed away entirely.
    expect(both.every((b) => b.sessionEtDate === '2026-09-17')).toBe(true);
    // A short-but-complete newer session (early close: 42) + older session → 60 spanning both.
    const early = makeSession('2026-11-27', { early: true, previousEtDate: '2026-11-25' });
    const prev = makeSession('2026-11-25', { previousEtDate: '2026-11-24' });
    const eb = aggregateBarsToBuckets(Array.from({ length: 211 }, (_, i) => ({ timestamp: (early.openMs + i * 60_000) / 1000, close: 1 })), early).buckets;
    const pb = aggregateBarsToBuckets(Array.from({ length: 391 }, (_, i) => ({ timestamp: (prev.openMs + i * 60_000) / 1000, close: 1 })), prev).buckets;
    const span = combineSeedSessions([contiguousTail(pb, prev, 60), contiguousTail(eb, early, 60)], [prev, early], 60);
    expect(span).toHaveLength(60);
    expect(span.filter((b) => b.sessionEtDate === '2026-11-25')).toHaveLength(18);
    expect(span[17].isLast).toBe(true);
    expect(span[18].isFirst).toBe(true);
    expect(BUCKET_MS).toBe(300_000);
  });
});
