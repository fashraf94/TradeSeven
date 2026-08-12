// api/_utils/mandateRiskMetrics.test.js
// Spec 1 §4.2 (P3) — warmup nulls (never NaN, never 0-as-placeholder),
// null-on-degenerate (the Q4-preserved season contract), partial-row
// discipline (I6), lens separation (FR-2), composite renormalization.

import { describe, it, expect } from 'vitest';
import {
  computeSharpe, computeConsistency, computeMaxDrawdown, computeRecoveryFactor,
  computeComposite, computeLensMetrics, computeMandateScoring, isDegradedRow,
} from './mandateRiskMetrics.js';
import { MANDATE_METRIC_MIN_ROWS } from './mandateConfig.js';

/** Build n clean rows with the given daily returns (values compound from 100). */
function rowsFrom(returns, { quarterIndex = 1, startDate = 1 } = {}) {
  let value = 1_000_000;
  return returns.map((ret, i) => {
    value *= (1 + ret);
    return {
      date: `2026-07-${String(startDate + i).padStart(2, '0')}`,
      totalValue: value,
      dayReturnPct: ret,
      quarterIndex,
      partial: false,
    };
  });
}

describe('warmup nulls (§4.2) — null, never NaN, never 0', () => {
  it('Sharpe/consistency are NULL below 20 usable rows; drawdown below 5', () => {
    const rows = rowsFrom(Array(19).fill(0.01));
    const m = computeLensMetrics(rows);
    expect(m.sharpe).toBe(null);
    expect(m.consistencyPct).toBe(null);
    expect(m.maxDrawdownPct).not.toBe(null); // 19 ≥ 5
    const few = computeLensMetrics(rowsFrom([0.01, 0.01, 0.01, 0.01])); // 4 rows
    expect(few.maxDrawdownPct).toBe(null);
  });
  it('metrics appear at exactly the warmup minimums', () => {
    const returns = Array.from({ length: MANDATE_METRIC_MIN_ROWS.sharpe }, (_, i) => (i % 2 === 0 ? 0.01 : -0.005));
    const m = computeLensMetrics(rowsFrom(returns));
    expect(m.sharpe).not.toBe(null);
    expect(Number.isFinite(m.sharpe)).toBe(true);
    expect(m.consistencyPct).not.toBe(null);
  });
});

describe('null-on-degenerate (Q4 contract preserved)', () => {
  it('zero variance → Sharpe null (never Infinity/NaN)', () => {
    expect(computeSharpe(Array(25).fill(0.01))).toBe(null);
  });
  it('zero drawdown → recovery factor null, NOT Infinity (§4.2)', () => {
    expect(computeRecoveryFactor(12.5, 0)).toBe(null);
    expect(computeRecoveryFactor(12.5, null)).toBe(null);
    expect(computeRecoveryFactor(null, -5)).toBe(null);
    expect(computeRecoveryFactor(10, -5)).toBe(2);
  });
  it('monotonic-rise series reports 0 drawdown and null recovery', () => {
    const m = computeLensMetrics(rowsFrom(Array(25).fill(0.01)));
    expect(m.maxDrawdownPct).toBe(0);
    expect(m.recoveryFactor).toBe(null);
  });
});

describe('partial-row discipline (I6)', () => {
  it('partial / carry-over rows are EXCLUDED from variance metrics but COUNT in drawdown, with degradedMarks flagged', () => {
    const clean = rowsFrom(Array(25).fill(0.01));
    // A deep partial-row trough in the middle: variance metrics must not see it;
    // drawdown must.
    const trough = { date: '2026-07-26', totalValue: clean[12].totalValue * 0.5, dayReturnPct: -0.5, quarterIndex: 1, partial: true };
    const rows = [...clean, trough];
    const m = computeLensMetrics(rows);
    expect(m.degradedMarks).toBe(true);
    expect(m.rowsUsable).toBe(25); // the partial row is not usable for variance
    // Sharpe computed over the CLEAN returns only — identical to the clean series
    // (which is zero-variance here → null), proving the -50% day never entered.
    expect(m.sharpe).toBe(null);
    // Drawdown DOES see the trough.
    expect(m.maxDrawdownPct).toBeLessThan(-40);
  });
  it('markSource carry_over marks a row degraded even without partial:true', () => {
    expect(isDegradedRow({ markSource: 'carry_over' })).toBe(true);
    expect(isDegradedRow({ partial: true })).toBe(true);
    expect(isDegradedRow({ markSource: 'close_snapshot', partial: false })).toBe(false);
  });
  it('a null dayReturnPct row (first-ever close) is excluded from variance metrics without poisoning them', () => {
    const rows = [{ date: '2026-07-01', totalValue: 1_000_000, dayReturnPct: null, quarterIndex: 1, partial: false },
      ...rowsFrom(Array(20).fill(0.01), { startDate: 2 })];
    const m = computeLensMetrics(rows);
    expect(m.rowsUsable).toBe(20);
    expect(Number.isNaN(m.sharpe)).toBe(false);
  });
});

describe('lens separation (FR-2/I4) — row quarterIndex tags are the source of truth', () => {
  it('quarter lens uses ONLY current-quarter rows; lifetime uses all', () => {
    const q1 = rowsFrom(Array(10).fill(-0.02), { quarterIndex: 1, startDate: 1 });   // a bad old tenure
    const q2 = rowsFrom(Array(10).fill(0.01), { quarterIndex: 2, startDate: 15 });   // the current tenure
    const scoring = computeMandateScoring([...q1, ...q2], 2, new Date('2026-08-12T21:00:00Z'));
    expect(scoring.quarter.rowsTotal).toBe(10);
    expect(scoring.lifetime.rowsTotal).toBe(20);
    // The current quarter never inherits the old tenure's drawdown (FR-2).
    expect(scoring.quarter.maxDrawdownPct).toBe(0);
    expect(scoring.lifetime.maxDrawdownPct).toBeLessThan(0);
    expect(scoring.asOf).toBe('2026-08-12T21:00:00.000Z');
  });
});

describe('composite (§4.2) — non-null components, renormalized weights, contributions recorded', () => {
  it('renormalizes over the non-null subset and records contributors', () => {
    const c = computeComposite({ sharpe: null, maxDrawdownPct: -10, consistencyPct: 60 });
    expect(c.contributed.sort()).toEqual(['consistency', 'drawdown']);
    const w = c.weightsUsed;
    expect(w.drawdown + w.consistency).toBeCloseTo(1, 10);
    expect(c.score).not.toBe(null);
  });
  it('all components null → composite null (insufficient history is not a zero score)', () => {
    const c = computeComposite({ sharpe: null, maxDrawdownPct: null, consistencyPct: null });
    expect(c.score).toBe(null);
    expect(c.contributed).toEqual([]);
  });
});
