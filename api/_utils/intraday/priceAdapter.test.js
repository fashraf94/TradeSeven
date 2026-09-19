// api/_utils/intraday/priceAdapter.test.js — contract §8.5 (built now, no consumer).
import { describe, it, expect } from 'vitest';
import { toLegacyPriceShape, LEGACY_PRICE_FIELDS } from './priceAdapter.js';
import { buildSymbolFacts } from './facts.js';
import { newAccumulator } from './accumulator.js';
import { SEP17, obsAt } from '../__fixtures__/intradaySessions.js';
import * as CONFIG from '../intradayConfig.js';

const ids = { observationId: 'o', strikeKey: 's' };

describe('§8.5 toLegacyPriceShape', () => {
  it('enumerates every legacy consumer field, in the legacy order, with the legacy units', () => {
    const obs = obsAt(SEP17, 30, { price: 334.5, volume: 1_234_567, high: 335.58, low: 333.2, open: 334.77, extra: { previousClose: 330.1, change: 4.4, changePercent: 1.33, size: 100 } });
    const facts = buildSymbolFacts({ sym: 'AAPL', acc: newAccumulator('2026-09-17'), obs, ring: null, state: null, session: SEP17, ids, config: CONFIG });
    const legacy = toLegacyPriceShape(facts);
    expect(Object.keys(legacy)).toEqual([...LEGACY_PRICE_FIELDS]);
    expect(legacy).toEqual({
      current: 334.5, previousClose: 330.1, change: 4.4, changePercent: 1.33, high: 335.58, low: 333.2, volume: 1_234_567,
      timestamp: Math.floor(obs.priceAsOf / 1000), // legacy unit: vendor SECONDS
      priceAsOf: obs.priceAsOf,                     // the ms instant beside it
      source: 'eodhd_live_v2', fallback: false,
    });
    expect(Number.isInteger(legacy.timestamp)).toBe(true);
    expect(legacy.priceAsOf / legacy.timestamp).toBeGreaterThan(999);
  });
  it('previousClose is nullable (never coerced to 0); a missing volume / range is null; no finite price → null, never 0', () => {
    const obs = obsAt(SEP17, 30, { price: 10, volume: null });
    const facts = buildSymbolFacts({ sym: 'X', acc: null, obs, ring: null, state: null, session: SEP17, ids, volumeInvalid: true, hlInvalid: true, config: CONFIG });
    const legacy = toLegacyPriceShape(facts);
    expect(legacy.previousClose).toBeNull();
    expect(legacy.volume).toBeNull();
    expect(legacy.high).toBeNull(); expect(legacy.low).toBeNull();
    expect(legacy.change).toBeNull(); expect(legacy.changePercent).toBeNull();
    expect(toLegacyPriceShape({ price: { value: 0 } })).toBeNull();
    expect(toLegacyPriceShape({ price: { value: null } })).toBeNull();
    expect(toLegacyPriceShape(null)).toBeNull();
  });
  it('the crypto path maps the Live v1 facts the same way, with the crypto source', () => {
    const obs = { ...obsAt(SEP17, 30, { sym: 'BTC', price: 60500.5, volume: 12345.6, high: 61000, low: 59000, open: 60000 }), source: 'eodhd_live_v1_crypto', previousClose: 59900, change: 600.5, changePercent: 1.002 };
    const facts = buildSymbolFacts({ sym: 'BTC', isCrypto: true, acc: null, obs, ring: null, state: null, session: SEP17, ids, config: CONFIG });
    const legacy = toLegacyPriceShape(facts);
    expect(legacy).toMatchObject({ current: 60500.5, previousClose: 59900, change: 600.5, changePercent: 1.002, high: 61000, low: 59000, volume: 12345.6, source: 'eodhd_live_v1_crypto', fallback: false });
    expect(legacy.timestamp).toBe(Math.floor(obs.priceAsOf / 1000));
  });
  it('fallback is always false — the adapter never invents a synthetic price the M1 guard would have to refuse', () => {
    const facts = buildSymbolFacts({ sym: 'X', acc: null, obs: obsAt(SEP17, 1, { price: 5 }), ring: null, state: null, session: SEP17, ids, config: CONFIG });
    expect(toLegacyPriceShape(facts).fallback).toBe(false);
  });
});
