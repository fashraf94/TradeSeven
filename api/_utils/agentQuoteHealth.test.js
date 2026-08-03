// api/_utils/agentQuoteHealth.test.js
// Containment M1 — the agent cron must never turn an unusable quote set into
// flat 0% scores. These tests pin the usability decision the guard relies on.

import { describe, it, expect } from 'vitest';
import { isSettlementQuoteUsable, assessRequiredQuotes } from './agentQuoteHealth.js';

describe('agentQuoteHealth — isSettlementQuoteUsable', () => {
  it('accepts a genuine finite positive current price', () => {
    expect(isSettlementQuoteUsable({ current: 150 })).toBe(true);
    expect(isSettlementQuoteUsable({ current: 0.01, previousClose: 1 })).toBe(true);
  });

  it('rejects missing, zero, negative, NaN, infinite, or non-numeric prices', () => {
    for (const bad of [undefined, null, {}, { current: 0 }, { current: -5 }, { current: NaN }, { current: Infinity }, { current: '150' }]) {
      expect(isSettlementQuoteUsable(bad)).toBe(false);
    }
  });

  it('rejects synthetic real-time-fallback prices (fallback: true)', () => {
    expect(isSettlementQuoteUsable({ current: 150, fallback: true })).toBe(false);
  });
});

describe('agentQuoteHealth — assessRequiredQuotes', () => {
  it('empty price batch -> unusable when symbols are required (no flat-score write)', () => {
    const r = assessRequiredQuotes(['AAPL', 'NVDA'], {});
    expect(r.usable).toBe(false);
    expect(r.missing.sort()).toEqual(['AAPL', 'NVDA']);
    expect(r.usableCount).toBe(0);
  });

  it('all-symbol auth failure (no price map) -> unusable', () => {
    const r = assessRequiredQuotes(['AAPL', 'NVDA'], undefined);
    expect(r.usable).toBe(false);
    expect(r.usableCount).toBe(0);
  });

  it('one missing required symbol -> unusable and names it', () => {
    const r = assessRequiredQuotes(['AAPL', 'NVDA'], { AAPL: { current: 150 } });
    expect(r.usable).toBe(false);
    expect(r.missing).toEqual(['NVDA']);
    expect(r.usableCount).toBe(1);
  });

  it('zero / NaN / synthetic values are unusable', () => {
    expect(assessRequiredQuotes(['AAPL'], { AAPL: { current: 0 } }).usable).toBe(false);
    expect(assessRequiredQuotes(['AAPL'], { AAPL: { current: NaN } }).usable).toBe(false);
    expect(assessRequiredQuotes(['AAPL'], { AAPL: { current: 150, fallback: true } }).usable).toBe(false);
  });

  it('a complete valid quote set is usable', () => {
    const r = assessRequiredQuotes(['AAPL', 'NVDA'], { AAPL: { current: 150 }, NVDA: { current: 900 } });
    expect(r.usable).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.requiredCount).toBe(2);
  });

  it('empty required set is vacuously usable (nothing to protect)', () => {
    expect(assessRequiredQuotes([], {}).usable).toBe(true);
    expect(assessRequiredQuotes(undefined, {}).usable).toBe(true);
  });

  it('dedups required symbols', () => {
    const r = assessRequiredQuotes(['AAPL', 'AAPL'], { AAPL: { current: 150 } });
    expect(r.requiredCount).toBe(1);
    expect(r.usable).toBe(true);
  });
});
