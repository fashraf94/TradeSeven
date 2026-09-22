// api/_utils/intraday/seed.test.js — contract §6.6 seeding (pure half).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateBarsToBuckets, contiguousTail, combineSeedSessions, barTimeMs } from './seed.js';
import { advanceState, newState, sessionKeys, BUCKET_MS } from './buckets.js';
import { stepMacd, stepSma, stepWilderRsi, WARMUP_BARS } from './stepIndicators.js';
import { SEP17, SEP16, makeSession } from '../__fixtures__/intradaySessions.js';
import { CLOSING_ROW_POLICY, SEED_MAX_BUCKETS } from '../intradayConfig.js';
import { indicatorQuality } from './buckets.js';

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

describe('§6.6 / §15 item 2 — the continuous-session policy on the founder fixture', () => {
  const POLICY = { closingRowPolicy: CLOSING_ROW_POLICY };

  it('the shipped policy is continuous_session, and it uses the 390 rows through 15:59 — the 16:00 row is ignored, not folded in', () => {
    expect(CLOSING_ROW_POLICY).toBe('continuous_session');
    const { buckets, barsUsed, barsIgnored } = aggregateBarsToBuckets(bars, SEP17, POLICY);
    expect(barsUsed).toBe(390);
    expect(barsIgnored).toBe(1);
    expect(buckets).toHaveLength(78);
    const last = buckets[77];
    // 15:55…15:59 — five rows, not six, and the close is the 15:59 print.
    expect(last.sampleCount).toBe(5);
    expect(last.close).toBe(bars[389].close);
    expect(last.close).not.toBe(bars[390].close);
    expect(last.maxPriceAsOf).toBe(SEP17.closeMs - 60_000);
    expect(last.closeLagMs).toBe(60_000);
    // The row that is dropped is the closing auction: 19.1 M shares, 42.9 %
    // of the day's bar volume — the reason answer 3 exists.
    expect(bars[390].volume / bars.reduce((a, r) => a + r.volume, 0)).toBeGreaterThan(0.42);
  });

  it('the seeded last bucket is closeQualified TRUE under the policy and FALSE under null — the null stamping applies only when the policy is null', () => {
    expect(aggregateBarsToBuckets(bars, SEP17, POLICY).buckets[77].closeQualified).toBe(true);
    expect(aggregateBarsToBuckets(bars, SEP17, { closingRowPolicy: null }).buckets[77].closeQualified).toBe(false);
    expect(aggregateBarsToBuckets(bars, SEP17).buckets[77].closeQualified).toBe(false);
  });

  it('R-11 cannot arise under the policy: a seeded name is NOT close-unqualified all day', () => {
    // Review finding R-11 (docs/audits/20260919_BUILD1_INTRADAY_REVIEW.md):
    // with a null policy the seed's last bucket is unqualified, MACD and RSI
    // initialise from a segment containing it, and §6.7 says elapsed bars
    // never clear them — so every seeded name carried closeQualified: false
    // for the whole session and was excluded from every stage-4 consumer.
    const seedOf = (policy) => contiguousTail(aggregateBarsToBuckets(bars, SEP17, { closingRowPolicy: policy }).buckets, SEP17, SEED_MAX_BUCKETS);
    const stateOver = (tail) => { let st = newState(); for (const b of tail) st = advanceState(st, b, SEP17); return st; };

    const underPolicy = stateOver(seedOf(CLOSING_ROW_POLICY));
    for (const ind of ['sma20_5m', 'macd5m', 'rsi5m']) {
      expect(indicatorQuality(underPolicy, ind).warmupMet, ind).toBe(true);
      expect(indicatorQuality(underPolicy, ind).closeQualified, ind).toBe(true);
    }
    // …and the defect it replaces, still reproducible with a null policy.
    const underNull = stateOver(seedOf(null));
    expect(indicatorQuality(underNull, 'macd5m').closeQualified).toBe(false);
    expect(indicatorQuality(underNull, 'rsi5m').closeQualified).toBe(false);
  });

  it('an early-close session ends at 12:59 under the policy: 42 buckets, the 13:00 row ignored', () => {
    const early = makeSession('2026-11-27', { early: true, previousEtDate: '2026-11-25' });
    const earlyBars = Array.from({ length: 211 }, (_, i) => ({ timestamp: (early.openMs + i * 60_000) / 1000, close: 100 + i, volume: 100 }));
    const { buckets, barsUsed, barsIgnored } = aggregateBarsToBuckets(earlyBars, early, POLICY);
    expect(barsUsed).toBe(210);
    expect(barsIgnored).toBe(1);
    expect(buckets).toHaveLength(42);
    expect(buckets[41].maxPriceAsOf).toBe(early.closeMs - 60_000);
    expect(buckets[41].close).toBe(earlyBars[209].close);
    expect(buckets[41].closeQualified).toBe(true);
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
