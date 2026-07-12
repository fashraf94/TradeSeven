// api/_utils/learning/preflightReceiptCheck.test.js
import { describe, it, expect } from 'vitest';
import { validateCaptureSample } from './preflightReceiptCheck.js';
import { buildRawReceipt } from './captureReceipt.js';

// Build a realistic receipt via the real buildRawReceipt so the test exercises
// the actual captured shape.
function mkReceipt({
  dR = 2.0, nearestSupport = 150, seq = 5, tradeCount = 4,
  techUpdatedAt = '2026-07-12T14:00:00.000Z', mode = 'intraday',
} = {}) {
  return buildRawReceipt({
    agentId: 'a', battleId: 'b', receiptSeq: seq, symbolIn: 'NVDA', symbolOut: 'AMD',
    source: 'haiku', exitReason: 'haiku_decision',
    timestamp: '2026-07-12T14:30:00.000Z',
    tradeCountAtDecision: tradeCount, tradesLenAtDecision: tradeCount,
    rankingsComputedAtMs: techUpdatedAt == null ? null : Date.parse(techUpdatedAt),
    techDocIn: techUpdatedAt == null ? null : { mode, updatedAt: techUpdatedAt },
    snapshotIn: {
      volatility: { bbPercentB: 0.9 }, smaStack: { distTo52wkHigh: 3.0 },
      levels: { distanceToResistancePct: dR, nearestSupport, nearestResistance: dR == null ? null : 200 },
      volume: { ratio: 1.0 }, momentum: { upDayVolRatio: 1.0, macdAboveSignal: true },
    },
    snapshotOut: {},
  });
}

// present ×3, blue_sky ×2, ambiguous ×2 → dR-null 4/7 ≈ 57% (near the 59% projection).
function goodSample() {
  return [
    mkReceipt({ dR: 2.0, seq: 5, tradeCount: 4 }),
    mkReceipt({ dR: 1.5, seq: 6, tradeCount: 5 }),
    mkReceipt({ dR: 3.0, seq: 7, tradeCount: 6 }),
    mkReceipt({ dR: null, nearestSupport: 150, seq: 8, tradeCount: 7 }),
    mkReceipt({ dR: null, nearestSupport: 148, seq: 9, tradeCount: 8 }),
    mkReceipt({ dR: null, nearestSupport: null, seq: 10, tradeCount: 9 }),
    mkReceipt({ dR: null, nearestSupport: null, seq: 11, tradeCount: 10 }),
  ];
}

const errorChecks = (res) => res.checks.filter((c) => c.level === 'error');
const failed = (res, name) => res.checks.find((c) => c.name === name && !c.pass);

describe('validateCaptureSample — pre-flight capture integrity', () => {
  it('a healthy sample PASSES all error-level checks', () => {
    const res = validateCaptureSample(goodSample());
    expect(res.pass).toBe(true);
    expect(errorChecks(res).every((c) => c.pass)).toBe(true);
    expect(res.summary.n).toBe(7);
    expect(res.summary.drNullRate).toBeCloseTo(4 / 7, 5);
    expect(new Set(res.summary.drNullReasonDistinct)).toEqual(new Set(['present', 'blue_sky', 'ambiguous']));
    expect(res.summary.receiptSeqViolations).toBe(0);
    expect(res.summary.missingFieldCount).toBe(0);
  });

  it('empty sample FAILS (nothing to validate)', () => {
    const res = validateCaptureSample([]);
    expect(res.pass).toBe(false);
    expect(failed(res, 'sample-nonempty')).toBeTruthy();
  });

  it('a missing required field FAILS field-presence and names the offending index', () => {
    const sample = goodSample();
    delete sample[2].predicateClassification; // drop a whole required sub-object
    const res = validateCaptureSample(sample);
    expect(res.pass).toBe(false);
    expect(failed(res, 'field-presence').offendingIndices).toContain(2);
  });

  it('all techDoc timestamps null FAILS predicateComputedAt-nonnull with every index', () => {
    const sample = [0, 1, 2, 3].map((i) => mkReceipt({ dR: i % 2 ? null : 2.0, seq: i + 2, tradeCount: i + 1, techUpdatedAt: null }));
    const res = validateCaptureSample(sample);
    expect(res.pass).toBe(false);
    expect(failed(res, 'predicateComputedAt-nonnull').offendingIndices).toEqual([0, 1, 2, 3]);
  });

  it('a broken receiptSeq invariant FAILS and names the offender', () => {
    const sample = goodSample();
    sample.push(mkReceipt({ dR: 2.0, seq: 99, tradeCount: 2 })); // 99 ≠ 2+1
    const res = validateCaptureSample(sample);
    expect(res.pass).toBe(false);
    expect(failed(res, 'receiptSeq-invariant').offendingIndices).toContain(sample.length - 1);
  });

  it('a passing sample carries no offendingIndices on its checks', () => {
    const res = validateCaptureSample(goodSample());
    expect(res.checks.every((c) => c.offendingIndices === undefined)).toBe(true);
  });

  it('a stuck discriminator (all ambiguous) FAILS diversity (and dR-null-rate at 100%)', () => {
    const sample = [0, 1, 2, 3].map((i) => mkReceipt({ dR: null, nearestSupport: null, seq: i + 2, tradeCount: i + 1 }));
    const res = validateCaptureSample(sample);
    expect(res.pass).toBe(false);
    expect(failed(res, 'drNullReason-diversity')).toBeTruthy();
    expect(failed(res, 'dR-null-rate')).toBeTruthy(); // 100% is stuck
  });

  it('dR never null (0%) FAILS dR-null-rate; diversity is only a warning', () => {
    const sample = [0, 1, 2, 3].map((i) => mkReceipt({ dR: 2.0, seq: i + 2, tradeCount: i + 1 }));
    const res = validateCaptureSample(sample);
    expect(res.pass).toBe(false);
    expect(failed(res, 'dR-null-rate')).toBeTruthy();
    const diversity = res.checks.find((c) => c.name === 'drNullReason-diversity');
    expect(diversity.pass).toBe(true); // warn, not error
    expect(diversity.level).toBe('warn');
  });

  it('an out-of-band (but nonzero) dR-null rate WARNS without failing', () => {
    // 1 of 7 null ≈ 14% — far below the 59% projection but not stuck.
    const sample = [
      mkReceipt({ dR: null, nearestSupport: 150, seq: 2, tradeCount: 1 }),
      ...[0, 1, 2, 3, 4, 5].map((i) => mkReceipt({ dR: 2.0, seq: i + 3, tradeCount: i + 2 })),
    ];
    const res = validateCaptureSample(sample);
    const drCheck = res.checks.find((c) => c.name === 'dR-null-rate');
    expect(drCheck.pass).toBe(true);
    expect(drCheck.level).toBe('warn');
    expect(res.pass).toBe(true); // warnings do not fail the pre-flight
  });
});
