// api/_utils/mandateQuarterSummary.test.js
// Spec 1 §2.2/§5.3/FR-2/I4/I10 — the tenure summary is DERIVED from tagged rows,
// never asserted from the book doc. These pin the I4 row-derivation fidelity the
// spec reviewer will hunt: edge-row valuations, degraded-row discipline carried
// from the metrics, honest regime/agency mixes, term totals, void/empty semantics.

import { describe, it, expect } from 'vitest';
import { deriveQuarterSummary } from './mandateQuarterSummary.js';
import { buildDailyRow } from './mandateSchema.js';

// A tagged dailyRow with the fields the summary reads.
function row(date, quarterIndex, over = {}) {
  return buildDailyRow({ date, quarterIndex, totalValue: 100000, dayReturnPct: 0.001, regime: 'risk_on', agencyState: 'full', dayFrictionPaid: 5, dividendIncomeUsd: 0, ...over });
}

describe('deriveQuarterSummary — window + valuations (I4)', () => {
  it('opening/closing come from the tagged EDGE rows; window from their dates', () => {
    const rows = [
      row('2026-01-05', 1, { totalValue: 100000 }),
      row('2026-01-06', 1, { totalValue: 101000 }),
      row('2026-01-07', 1, { totalValue: 102000 }),
    ];
    const s = deriveQuarterSummary(rows, { quarterIndex: 1, archetype: 'analyst', vintageRef: 'archetypeVintages/analyst_x' });
    expect(s.openingValue).toBe(100000);
    expect(s.closingValue).toBe(102000);
    expect(s.quarterStartAt).toBe('2026-01-05');
    expect(s.quarterEndAt).toBe('2026-01-07');
    expect(s.tenureReturn).toBeCloseTo(2.0, 6); // (102000-100000)/100000 * 100
    expect(s.archetype).toBe('analyst');
    expect(s.vintageRef).toBe('archetypeVintages/analyst_x');
    expect(s.scoring).toBe(true);
    expect(s.empty).toBe(false);
  });

  it('rows tagged with OTHER quarters are excluded (FR-2 tags are the source of truth)', () => {
    const rows = [
      row('2026-01-05', 1, { totalValue: 100000 }),
      row('2026-04-06', 2, { totalValue: 200000 }), // different tenure
      row('2026-01-07', 1, { totalValue: 103000 }),
    ];
    const s = deriveQuarterSummary(rows, { quarterIndex: 1 });
    expect(s.openingValue).toBe(100000);
    expect(s.closingValue).toBe(103000); // NOT the q2 row
    expect(s.riskMetrics.rowsTotal).toBe(2);
  });

  it('a caller-supplied logical boundary overrides the edge-row date default', () => {
    const rows = [row('2026-01-06', 3, { totalValue: 100000 }), row('2026-03-30', 3, { totalValue: 110000 })];
    const s = deriveQuarterSummary(rows, { quarterIndex: 3, quarterStartAt: new Date('2026-01-05T21:00:00Z'), quarterEndAt: new Date('2026-03-31T20:00:00Z') });
    expect(s.quarterStartAt).toEqual(new Date('2026-01-05T21:00:00Z'));
    expect(s.quarterEndAt).toEqual(new Date('2026-03-31T20:00:00Z'));
  });
});

describe('deriveQuarterSummary — degraded-row discipline (I6/I11) carried from the metrics', () => {
  it('partial / carry-over rows are excluded from variance but counted in drawdown (≥5-row window)', () => {
    const rows = [
      row('2026-01-05', 1, { totalValue: 100000, dayReturnPct: null, partial: true }), // creation-day partial
      row('2026-01-06', 1, { totalValue: 100000, dayReturnPct: 0 }),
      row('2026-01-07', 1, { totalValue: 90000, dayReturnPct: -0.1, markSource: 'carry_over', degradedMarks: true }), // degraded trough
      row('2026-01-08', 1, { totalValue: 92000, dayReturnPct: 0.0222 }),
      row('2026-01-09', 1, { totalValue: 95000, dayReturnPct: 0.0326 }),
      row('2026-01-12', 1, { totalValue: 96000, dayReturnPct: 0.0105 }),
    ];
    const s = deriveQuarterSummary(rows, { quarterIndex: 1 });
    // Drawdown reads totalValue directly → the real -10% trough is captured
    // even though the trough row is a carry-over mark (values are real).
    expect(s.riskMetrics.maxDrawdownPct).toBeLessThan(0);
    expect(s.riskMetrics.maxDrawdownPct).toBeCloseTo(-10, 6);
    // The degraded rows are flagged so the block is labeled honestly.
    expect(s.riskMetrics.degradedMarks).toBe(true);
    // The partial (null return) + carry-over rows are excluded from variance;
    // rowsUsable < rowsTotal — the exclusion is visible, not silent.
    expect(s.riskMetrics.rowsTotal).toBe(6);
    expect(s.riskMetrics.rowsUsable).toBe(4);
  });
});

describe('deriveQuarterSummary — mixes + term totals (I10/§4.3)', () => {
  it('regimeMix and agencyStateMix count every session, unknown included honestly', () => {
    const rows = [
      row('2026-01-05', 1, { regime: 'risk_on', agencyState: 'full' }),
      row('2026-01-06', 1, { regime: 'risk_off', agencyState: 'exit_only' }),
      row('2026-01-07', 1, { regime: 'unknown', agencyState: 'full' }),
      row('2026-01-08', 1, { regime: 'risk_on', agencyState: 'skipped:eval_failure' }),
    ];
    const s = deriveQuarterSummary(rows, { quarterIndex: 1 });
    expect(s.regimeMix).toEqual({ risk_on: 2, risk_off: 1, unknown: 1 });
    expect(s.agencyStateMix).toEqual({ full: 2, exit_only: 1, 'skipped:eval_failure': 1 });
  });

  it('friction + dividend term totals sum the rows; first-row null friction coalesces to 0', () => {
    const rows = [
      row('2026-01-05', 1, { dayFrictionPaid: null, dividendIncomeUsd: 0 }), // first-row null window
      row('2026-01-06', 1, { dayFrictionPaid: 12.5, dividendIncomeUsd: 100 }),
      row('2026-01-07', 1, { dayFrictionPaid: 7.25, dividendIncomeUsd: 0 }),
    ];
    const s = deriveQuarterSummary(rows, { quarterIndex: 1 });
    expect(s.frictionTotalUsd).toBe(19.75);
    expect(s.dividendIncomeTotalUsd).toBe(100);
  });
});

describe('deriveQuarterSummary — void + empty semantics (FR-3/§5.3)', () => {
  it('voided → scoring:false, but numbers are still derived (the void flag excludes it, not emptiness)', () => {
    const rows = [row('2026-01-05', 1, { totalValue: 100000 }), row('2026-01-06', 1, { totalValue: 99000 })];
    const s = deriveQuarterSummary(rows, { quarterIndex: 1, voided: true });
    expect(s.scoring).toBe(false);
    expect(s.empty).toBe(false);
    expect(s.openingValue).toBe(100000);
    expect(s.closingValue).toBe(99000);
  });

  it('a catch-up quarter with zero tagged rows is empty:true, never fabricated', () => {
    const rows = [row('2026-01-05', 1)]; // only q1 rows; asking for q2
    const s = deriveQuarterSummary(rows, { quarterIndex: 2, archetype: 'analyst' });
    expect(s.empty).toBe(true);
    expect(s.scoring).toBe(true); // not voided
    expect(s.openingValue).toBeNull();
    expect(s.closingValue).toBeNull();
    expect(s.tenureReturn).toBeNull();
    expect(s.riskMetrics).toBeNull();
    expect(s.regimeMix).toEqual({});
    expect(s.archetype).toBe('analyst');
  });

  it('an empty AND voided catch-up quarter is both empty:true and scoring:false', () => {
    const s = deriveQuarterSummary([], { quarterIndex: 1, voided: true });
    expect(s.empty).toBe(true);
    expect(s.scoring).toBe(false);
  });
});
