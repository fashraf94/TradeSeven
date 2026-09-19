// api/_utils/intraday/observation.test.js — contract §4 (one internal shape), §5.5 (keys).
import { describe, it, expect } from 'vitest';
import {
  normalizeLiveV2, normalizeLiveV1Crypto, observationId, strikeKey, OBSERVATION_FIELDS, toMs,
  SOURCE_LIVE_V2, SOURCE_LIVE_V1_CRYPTO,
} from './observation.js';

const AVAILABLE_AT = Date.UTC(2026, 8, 17, 14, 0, 0);

const v2Quote = (symbol, over = {}) => ({
  symbol, lastTradePrice: 334.5, lastTradeTime: Date.UTC(2026, 8, 17, 13, 44, 10), size: 100,
  open: 334.77, high: 335.58, low: 333.2, volume: 1_234_567, averageVolume: 44_000_000,
  previousClosePrice: 330.1, change: 4.4, changePercent: 1.33, timestamp: Math.floor(Date.UTC(2026, 8, 17, 13, 59, 0) / 1000),
  ...over,
});

describe('§4 Live v2 — `data` object keyed by symbol', () => {
  const requested = [{ sym: 'AAPL', vendor: 'AAPL.US' }, { sym: 'MSFT', vendor: 'MSFT.US' }, { sym: 'ZZZZ', vendor: 'ZZZZ.US' }];

  it('parses every §4 field into the one internal shape; an omitted symbol is `missing`, not a throw', () => {
    const json = { data: { 'AAPL.US': v2Quote('AAPL.US'), 'MSFT.US': v2Quote('MSFT.US', { lastTradePrice: 500 }) } };
    const out = normalizeLiveV2(json, requested, { availableAt: AVAILABLE_AT });
    expect(out.missing).toEqual(['ZZZZ']);
    expect(out.anomalies).toEqual({ missing: 1, shapeUnexpected: 0, unitCoerced: 0 });
    expect(out.observations.map((o) => o.sym)).toEqual(['AAPL', 'MSFT']);
    const a = out.observations[0];
    expect(Object.keys(a)).toEqual([...OBSERVATION_FIELDS]);
    expect(a).toEqual({
      sym: 'AAPL', price: 334.5, priceAsOf: Date.UTC(2026, 8, 17, 13, 44, 10), snapshotTs: Date.UTC(2026, 8, 17, 13, 59, 0),
      availableAt: AVAILABLE_AT, volume: 1_234_567, high: 335.58, low: 333.2, open: 334.77, averageVolume: 44_000_000,
      previousClose: 330.1, change: 4.4, changePercent: 1.33, size: 100, source: SOURCE_LIVE_V2,
    });
  });

  it('matches a quote keyed by the clean symbol or by the vendor symbol', () => {
    const json = { data: { AAPL: v2Quote('AAPL') } };
    const out = normalizeLiveV2(json, [{ sym: 'AAPL', vendor: 'AAPL.US' }], { availableAt: AVAILABLE_AT });
    expect(out.observations).toHaveLength(1);
    expect(out.missing).toEqual([]);
  });

  it('a response with no `data` object is shapeUnexpected with every requested symbol missing', () => {
    for (const bad of [null, undefined, [], { code: 'AAPL.US', close: 1 }, 'nope']) {
      const out = normalizeLiveV2(bad, requested, { availableAt: AVAILABLE_AT });
      expect(out.observations).toEqual([]);
      expect(out.missing).toEqual(['AAPL', 'MSFT', 'ZZZZ']);
      expect(out.anomalies.shapeUnexpected).toBe(1);
      expect(out.anomalies.missing).toBe(3);
    }
  });

  it('null / non-numeric vendor fields become null — never 0, never NaN', () => {
    const json = { data: { 'AAPL.US': v2Quote('AAPL.US', { volume: null, high: 'NA', size: undefined, averageVolume: '' }) } };
    const [o] = normalizeLiveV2(json, [requested[0]], { availableAt: AVAILABLE_AT }).observations;
    expect(o.volume).toBeNull(); expect(o.high).toBeNull(); expect(o.size).toBeNull(); expect(o.averageVolume).toBeNull();
    expect(o.price).toBe(334.5);
  });

  it('a lastTradeTime in SECONDS is coerced to ms and counted (unitCoerced) — visible, never silent', () => {
    const secs = Math.floor(Date.UTC(2026, 8, 17, 13, 44, 10) / 1000);
    const json = { data: { 'AAPL.US': v2Quote('AAPL.US', { lastTradeTime: secs }) } };
    const out = normalizeLiveV2(json, [requested[0]], { availableAt: AVAILABLE_AT });
    expect(out.observations[0].priceAsOf).toBe(secs * 1000);
    expect(out.anomalies.unitCoerced).toBe(1);
    expect(toMs(secs)).toEqual({ ms: secs * 1000, coerced: true });
    expect(toMs(secs * 1000)).toEqual({ ms: secs * 1000, coerced: false });
    expect(toMs('x')).toEqual({ ms: null, coerced: false });
  });
});

describe('§4 Live v1 crypto — array of { code, close, timestamp, … }', () => {
  it('parses the crypto shape; omitted symbol is missing; single-object response accepted', () => {
    const ts = Math.floor(Date.UTC(2026, 8, 17, 14, 0, 0) / 1000);
    const json = [
      { code: 'BTC-USD.CC', timestamp: ts, gmtoffset: 0, open: 60000, high: 61000, low: 59000, close: 60500.5, volume: 12345.6, previousClose: 59900, change: 600.5, change_p: 1.002 },
    ];
    const out = normalizeLiveV1Crypto(json, [{ sym: 'BTC', vendor: 'BTC-USD.CC' }, { sym: 'ETH', vendor: 'ETH-USD.CC' }], { availableAt: AVAILABLE_AT });
    expect(out.missing).toEqual(['ETH']);
    const [o] = out.observations;
    expect(Object.keys(o)).toEqual([...OBSERVATION_FIELDS]);
    expect(o).toMatchObject({ sym: 'BTC', price: 60500.5, priceAsOf: ts * 1000, snapshotTs: ts * 1000, availableAt: AVAILABLE_AT, volume: 12345.6, high: 61000, low: 59000, open: 60000, previousClose: 59900, change: 600.5, changePercent: 1.002, size: null, averageVolume: null, source: SOURCE_LIVE_V1_CRYPTO });
    const single = normalizeLiveV1Crypto(json[0], [{ sym: 'BTC', vendor: 'BTC-USD.CC' }], { availableAt: AVAILABLE_AT });
    expect(single.observations).toHaveLength(1);
  });
  it('a non-array, non-quote body is shapeUnexpected', () => {
    const out = normalizeLiveV1Crypto({ error: 'x' }, [{ sym: 'BTC', vendor: 'BTC-USD.CC' }], { availableAt: AVAILABLE_AT });
    expect(out.anomalies.shapeUnexpected).toBe(1);
    expect(out.missing).toEqual(['BTC']);
  });
});

describe('§5.5 keys — observationId records vendor revisions; strikeKey is the strike identity', () => {
  it('strikeKey is unchanged across a refreshed snapshotTs; observationId changes', () => {
    const t = Date.UTC(2026, 8, 17, 13, 44, 10);
    const a = observationId('AAPL', t, t + 60_000);
    const b = observationId('AAPL', t, t + 120_000);
    expect(a).not.toBe(b);
    expect(strikeKey('AAPL', t)).toBe(strikeKey('AAPL', t));
    expect(strikeKey('AAPL', t)).not.toBe(strikeKey('AAPL', t + 1));
    expect(strikeKey('AAPL', t)).not.toBe(strikeKey('MSFT', t));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
  it('is deterministic (the same inputs on any runtime give the same key)', () => {
    expect(strikeKey('AAPL', 1789652650000)).toBe(strikeKey('AAPL', 1789652650000));
    expect(observationId('AAPL', 1, 2)).toBe(observationId('AAPL', 1, 2));
  });
});
