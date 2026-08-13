// api/_utils/modelPriceTable.test.js
// Spec 1 §6.2 (P3) — the versioned $/MTok table: pricing arithmetic, the
// unknown-model null (never a silent $0), cacheHitTokens plumbing.
// P5 additions: the batch multiplier, cache read/write components, and the
// telemetryPatch accumulation moved here from the eval handler (§6.2 home).

import { describe, it, expect, vi } from 'vitest';
import {
  priceUsage, telemetryPatch, MODEL_PRICES_PER_MTOK, MODEL_PRICE_TABLE_VERSION,
  CACHE_WRITE_INPUT_MULTIPLIER, CACHE_READ_INPUT_MULTIPLIER, BATCH_DISCOUNT_MULTIPLIER,
} from './modelPriceTable.js';

describe('priceUsage', () => {
  it('prices Haiku 4.5 usage at the table rates', () => {
    const r = priceUsage('claude-haiku-4-5-20251001', { input_tokens: 12000, output_tokens: 600 });
    // 12000/1e6 × $1.00 + 600/1e6 × $5.00 = $0.012 + $0.003 = $0.015 (direct transport, full list rate)
    expect(r.estUsd).toBeCloseTo(0.015, 9);
    expect(r.tokensIn).toBe(12000);
    expect(r.tokensOut).toBe(600);
    expect(r.priced).toBe(true);
  });
  it('carries cacheHitTokens through and prices cache reads at the read multiplier', () => {
    const r = priceUsage('claude-haiku-4-5-20251001', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 40 });
    expect(r.cacheHitTokens).toBe(40);
    // 100×$1 + 10×$5 + 40×$1×0.1, per MTok
    expect(r.estUsd).toBeCloseTo((100 * 1 + 10 * 5 + 40 * 1 * CACHE_READ_INPUT_MULTIPLIER) / 1e6, 12);
    const r2 = priceUsage('claude-haiku-4-5-20251001', { input_tokens: 100, output_tokens: 10 });
    expect(r2.cacheHitTokens).toBe(0);
  });
  it('P5: prices cache WRITES at the write premium and carries cacheWriteTokens', () => {
    const r = priceUsage('claude-haiku-4-5-20251001', { input_tokens: 100, output_tokens: 0, cache_creation_input_tokens: 1000 });
    expect(r.cacheWriteTokens).toBe(1000);
    expect(r.estUsd).toBeCloseTo((100 * 1 + 1000 * 1 * CACHE_WRITE_INPUT_MULTIPLIER) / 1e6, 12);
  });
  it('P5: the batch flag halves every component (mutation guard: fails if the discount is dropped or misapplied)', () => {
    const usage = { input_tokens: 12000, output_tokens: 600, cache_read_input_tokens: 2000, cache_creation_input_tokens: 1000 };
    const direct = priceUsage('claude-haiku-4-5-20251001', usage);
    const batch = priceUsage('claude-haiku-4-5-20251001', usage, { batch: true });
    expect(batch.estUsd).toBeCloseTo(direct.estUsd * BATCH_DISCOUNT_MULTIPLIER, 12);
    expect(batch.estUsd).toBeLessThan(direct.estUsd); // the discount is real, not 1.0
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
    // v2 = the P5 rate-semantics change (batch flag + cache components).
    expect(MODEL_PRICE_TABLE_VERSION).toBe(2);
    expect(MODEL_PRICES_PER_MTOK['claude-haiku-4-5-20251001']).toEqual({ inputPerMTok: 1.0, outputPerMTok: 5.0 });
  });
});

describe('telemetryPatch (§6.2, moved here in P5)', () => {
  const PRICED = { tokensIn: 100, tokensOut: 10, cacheHitTokens: 5, cacheWriteTokens: 7, estUsd: 0.001, priced: true };

  it('accumulates month + today blocks, including the P5 cacheWriteTokens side', () => {
    const book = { costTelemetry: { monthKey: '2026-08', tokensIn: 50, tokensOut: 5, cacheHitTokens: 1, cacheWriteTokens: 2, estUsd: 0.0005, today: { date: '2026-08-12', evalCount: 1, tokensIn: 50, tokensOut: 5, cacheHitTokens: 1, cacheWriteTokens: 2, estUsd: 0.0005 } } };
    const p = telemetryPatch(book, '2026-08-12', PRICED);
    expect(p.costTelemetry.tokensIn).toBe(150);
    expect(p.costTelemetry.cacheHitTokens).toBe(6);
    expect(p.costTelemetry.cacheWriteTokens).toBe(9);
    expect(p.costTelemetry.today.evalCount).toBe(2);
    expect(p.costTelemetry.today.cacheWriteTokens).toBe(9);
  });

  it('resets on a month rollover and a new day', () => {
    const book = { costTelemetry: { monthKey: '2026-07', tokensIn: 999, today: { date: '2026-07-31', evalCount: 9, tokensIn: 999 } } };
    const p = telemetryPatch(book, '2026-08-03', PRICED);
    expect(p.costTelemetry.monthKey).toBe('2026-08');
    expect(p.costTelemetry.tokensIn).toBe(100); // fresh month
    expect(p.costTelemetry.today).toMatchObject({ date: '2026-08-03', evalCount: 1, tokensIn: 100 });
  });

  it('null priced → null patch (nothing billed, nothing merged)', () => {
    expect(telemetryPatch({}, '2026-08-12', null)).toBe(null);
  });
});
