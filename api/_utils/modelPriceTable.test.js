// api/_utils/modelPriceTable.test.js
// Spec 1 §6.2 (P3) — the versioned $/MTok table: pricing arithmetic, the
// unknown-model null (never a silent $0), cacheHitTokens plumbing.

import { describe, it, expect, vi } from 'vitest';
import { priceUsage, MODEL_PRICES_PER_MTOK, MODEL_PRICE_TABLE_VERSION } from './modelPriceTable.js';

describe('priceUsage', () => {
  it('prices Haiku 4.5 usage at the table rates', () => {
    const r = priceUsage('claude-haiku-4-5-20251001', { input_tokens: 12000, output_tokens: 600 });
    // 12000/1e6 × $1.00 + 600/1e6 × $5.00 = $0.012 + $0.003 = $0.015 (direct transport, full list rate)
    expect(r.estUsd).toBeCloseTo(0.015, 9);
    expect(r.tokensIn).toBe(12000);
    expect(r.tokensOut).toBe(600);
    expect(r.priced).toBe(true);
  });
  it('carries cacheHitTokens through (zero until P5 wires caching)', () => {
    const r = priceUsage('claude-haiku-4-5-20251001', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 40 });
    expect(r.cacheHitTokens).toBe(40);
    const r2 = priceUsage('claude-haiku-4-5-20251001', { input_tokens: 100, output_tokens: 10 });
    expect(r2.cacheHitTokens).toBe(0);
  });
  it('an UNKNOWN model id yields estUsd null (never a silent $0) and alerts once', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = priceUsage('mystery-model-1', { input_tokens: 1000, output_tokens: 100 });
    expect(r.estUsd).toBe(null);
    expect(r.priced).toBe(false);
    expect(r.tokensIn).toBe(1000); // tokens still counted — coverage stays honest
    priceUsage('mystery-model-1', { input_tokens: 1, output_tokens: 1 }); // second call: no second alert
    const alerts = spy.mock.calls.filter((c) => String(c[0]).includes('MODEL_PRICE_UNKNOWN'));
    expect(alerts.length).toBe(1);
    spy.mockRestore();
  });
  it('null/absent usage prices to zeros (a call that reported no usage still counts as an eval)', () => {
    const r = priceUsage('claude-haiku-4-5-20251001', null);
    expect(r).toMatchObject({ tokensIn: 0, tokensOut: 0, estUsd: 0 });
  });
  it('the table is versioned and covers the P1-pinned mandate seat', () => {
    expect(MODEL_PRICE_TABLE_VERSION).toBe(1);
    expect(MODEL_PRICES_PER_MTOK['claude-haiku-4-5-20251001']).toEqual({ inputPerMTok: 1.0, outputPerMTok: 5.0 });
  });
});
