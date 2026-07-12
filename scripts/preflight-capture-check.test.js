// scripts/preflight-capture-check.test.js
// Unit tests for the pure helpers of the pre-flight runner. No DB, no process
// exit (the runner is guarded, so importing the module is side-effect-free).
import { describe, it, expect } from 'vitest';
import {
  parseArgs, serialize, sampleBreadth, pickSampleBadReceipts, formatReport,
} from './preflight-capture-check.js';
import { validateCaptureSample } from '../api/_utils/learning/preflightReceiptCheck.js';
import { buildRawReceipt } from '../api/_utils/learning/captureReceipt.js';

function mkReceipt({ dR = 2.0, nearestSupport = 150, seq = 5, tradeCount = 4, battleId = 'b1', symbolIn = 'NVDA', techUpdatedAt = '2026-07-12T14:00:00.000Z' } = {}) {
  return buildRawReceipt({
    agentId: 'a', battleId, receiptSeq: seq, symbolIn, symbolOut: 'AMD',
    source: 'haiku', exitReason: 'haiku_decision', timestamp: '2026-07-12T14:30:00.000Z',
    tradeCountAtDecision: tradeCount, tradesLenAtDecision: tradeCount,
    rankingsComputedAtMs: techUpdatedAt == null ? null : Date.parse(techUpdatedAt),
    techDocIn: techUpdatedAt == null ? null : { mode: 'intraday', updatedAt: techUpdatedAt },
    snapshotIn: {
      volatility: { bbPercentB: 0.9 }, smaStack: { distTo52wkHigh: 3.0 },
      levels: { distanceToResistancePct: dR, nearestSupport, nearestResistance: dR == null ? null : 200 },
      volume: { ratio: 1.0 }, momentum: { upDayVolRatio: 1.0, macdAboveSignal: true },
    },
    snapshotOut: {},
  });
}

describe('parseArgs', () => {
  it('defaults to limit 25, no battle', () => {
    expect(parseArgs(['node', 'x'])).toEqual({ limit: 25, battle: null });
  });
  it('parses --limit and --battle', () => {
    expect(parseArgs(['node', 'x', '--limit', '50', '--battle', 'B7'])).toMatchObject({ limit: 50, battle: 'B7' });
  });
  it('sets help on --help', () => {
    expect(parseArgs(['node', 'x', '--help']).help).toBe(true);
  });
});

describe('serialize', () => {
  it('converts Firestore Timestamps (toDate) to ISO, recursively, and passes primitives through', () => {
    const ts = { toDate: () => new Date('2026-07-12T14:00:00.000Z') };
    expect(serialize(ts)).toBe('2026-07-12T14:00:00.000Z');
    expect(serialize({ a: ts, b: [ts, 1, 'x'], c: null })).toEqual({
      a: '2026-07-12T14:00:00.000Z', b: ['2026-07-12T14:00:00.000Z', 1, 'x'], c: null,
    });
  });
});

describe('sampleBreadth', () => {
  it('counts distinct battles/symbols + dataMode/drNullReason distributions', () => {
    const rs = [
      mkReceipt({ battleId: 'b1', symbolIn: 'NVDA', dR: 2.0 }), // present
      mkReceipt({ battleId: 'b2', symbolIn: 'AMD', dR: null, nearestSupport: 150 }), // blue_sky
      mkReceipt({ battleId: 'b2', symbolIn: 'NVDA', dR: null, nearestSupport: null }), // ambiguous
    ];
    const b = sampleBreadth(rs);
    expect(b.count).toBe(3);
    expect(new Set(b.battles)).toEqual(new Set(['b1', 'b2']));
    expect(new Set(b.symbols)).toEqual(new Set(['NVDA', 'AMD']));
    expect(b.dataModeDist).toEqual({ intraday: 3 });
    expect(b.drNullReasonDist).toEqual({ present: 1, blue_sky: 1, ambiguous: 1 });
    expect(b.narrow).toBe(false); // 2 battles AND 2 symbols
  });

  it('flags a single-battle sample as narrow', () => {
    const rs = [mkReceipt({ battleId: 'b1', symbolIn: 'NVDA' }), mkReceipt({ battleId: 'b1', symbolIn: 'AMD' })];
    expect(sampleBreadth(rs).narrow).toBe(true);
  });
});

describe('pickSampleBadReceipts', () => {
  it('returns the offending receipt for each failed error-check (deduped)', () => {
    const sample = [mkReceipt({ techUpdatedAt: null, seq: 2, tradeCount: 1 }), mkReceipt({ techUpdatedAt: null, seq: 3, tradeCount: 2 })];
    const res = validateCaptureSample(sample);
    const picks = pickSampleBadReceipts(res, sample);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0].receipt).toBe(sample[picks[0].index]);
    expect(picks[0].checkNames.length).toBeGreaterThan(0);
  });

  it('falls back to index 0 when a failed check has no offendingIndices', () => {
    const res = { checks: [{ name: 'x', level: 'error', pass: false }] };
    const picks = pickSampleBadReceipts(res, [{ id: 'r0' }, { id: 'r1' }]);
    expect(picks[0].index).toBe(0);
  });
});

describe('formatReport', () => {
  const base = { flags: { limit: 25, battle: null }, projectId: 'demo-preview' };

  it('PASS report announces PASS, prints breadth + checks, no bad-receipt section', () => {
    const receipts = [
      mkReceipt({ battleId: 'b1', dR: 2.0, seq: 2, tradeCount: 1 }),
      mkReceipt({ battleId: 'b2', symbolIn: 'AMD', dR: null, nearestSupport: 150, seq: 3, tradeCount: 2 }),
      mkReceipt({ battleId: 'b3', symbolIn: 'TSLA', dR: null, nearestSupport: null, seq: 4, tradeCount: 3 }),
    ];
    const result = validateCaptureSample(receipts, { expectedDrNullRate: 0.59 });
    const out = formatReport({ ...base, result, breadth: sampleBreadth(receipts), receipts });
    expect(out).toContain('PASS');
    expect(out).toContain('SAMPLE BREADTH');
    expect(out).toContain('distinct battles: 3');
    expect(out).toContain('drNullReason:');
    expect(out).not.toContain('SAMPLE BAD RECEIPT');
    expect(out).toContain('demo-preview');
  });

  it('FAIL report names the offending field and shows a sample bad receipt', () => {
    const receipts = [mkReceipt({ techUpdatedAt: null, seq: 2, tradeCount: 1 }), mkReceipt({ techUpdatedAt: null, seq: 3, tradeCount: 2 })];
    const result = validateCaptureSample(receipts, { expectedDrNullRate: 0.59 });
    const out = formatReport({ ...base, result, breadth: sampleBreadth(receipts), receipts });
    expect(out).toContain('FAIL');
    expect(out).toContain('predicateComputedAt-nonnull'); // names the offending field
    expect(out).toContain('SAMPLE BAD RECEIPT');
    expect(out).toContain('techDocUpdatedAtMs'); // the actual bad value is visible in the printed receipt
  });

  it('prints the NARROW SAMPLE warning for a one-battle sample', () => {
    const receipts = [mkReceipt({ battleId: 'b1', dR: 2.0, seq: 2, tradeCount: 1 }), mkReceipt({ battleId: 'b1', dR: null, nearestSupport: 150, seq: 3, tradeCount: 2 })];
    const result = validateCaptureSample(receipts, { expectedDrNullRate: 0.59 });
    const out = formatReport({ ...base, result, breadth: sampleBreadth(receipts), receipts });
    expect(out).toContain('NARROW SAMPLE');
  });
});
