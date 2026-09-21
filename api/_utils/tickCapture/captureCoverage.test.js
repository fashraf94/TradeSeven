// api/_utils/tickCapture/captureCoverage.test.js
//
// The three C-1 figures, and the four things the spec says they must show:
// a TRAILING gap detected from the persisted counter; a timed-out batch
// reported `unknown` and resolved by the export; an expired body counted as
// expired, not missing; a truncated body captured but NOT a usable pair.

import { describe, it, expect } from 'vitest';
import { computeCoverage, coverageForBattle, formatCoverageReport, toJsonlLine } from './captureCoverage.js';

const tick = (tickSeq, over = {}) => ({ tickSeq, dispatched: true, bodyStatus: 'written', bodyPresent: true, ...over });

describe('coverage — the denominator is the PERSISTED COUNTER', () => {
  it('a complete battle is 100%', () => {
    const r = coverageForBattle({ battleId: 'b1', mintedTickSeq: 3, ticks: [tick(1), tick(2), tick(3)] });
    expect(r).toMatchObject({ minted: 3, captured: 3, coverage: 1, missing: [], trailingGap: 0, attemptUnknown: 0 });
  });

  it('a TRAILING gap is detected — the highest captured sequence could not reveal it', () => {
    // Ticks 4 and 5 were minted and never captured. Against the highest
    // CAPTURED sequence (3) this battle looks complete; against the counter it
    // is 60%. That difference is the whole reason C-1 names the counter.
    const r = coverageForBattle({ battleId: 'b1', mintedTickSeq: 5, ticks: [tick(1), tick(2), tick(3)] });
    expect(r.coverage).toBeCloseTo(0.6);
    expect(r.missing).toEqual([4, 5]);
    expect(r.trailingGap).toBe(2);
    // and the missing ticks are ATTEMPT UNKNOWN, never counted as failed pairs
    expect(r.attemptUnknown).toBe(2);
    expect(r.dispatched).toBe(3);
  });

  it('an INTERIOR gap is reported too, and is not a trailing one', () => {
    const r = coverageForBattle({ battleId: 'b1', mintedTickSeq: 4, ticks: [tick(1), tick(3), tick(4)] });
    expect(r.missing).toEqual([2]);
    expect(r.trailingGap).toBe(0);
    expect(r.coverage).toBe(0.75);
  });

  it('a record above the counter is REPORTED, not folded into a ratio above 1', () => {
    const r = coverageForBattle({ battleId: 'b1', mintedTickSeq: 1, ticks: [tick(1), tick(2)] });
    expect(r.aboveCounter).toEqual([2]);
  });

  it('a battle that never minted has no coverage figure at all — not 0, not 1', () => {
    expect(coverageForBattle({ battleId: 'b1', mintedTickSeq: 0, ticks: [] }).coverage).toBeNull();
  });
});

describe('usable pairs — over ticks KNOWN to have dispatched', () => {
  it('a tick that never dispatched is in NEITHER side of the ratio', () => {
    const r = coverageForBattle({
      battleId: 'b1', mintedTickSeq: 2,
      ticks: [tick(1), tick(2, { dispatched: false, bodyStatus: 'skipped' })],
    });
    expect(r.dispatched).toBe(1);
    expect(r.usablePairs).toBe(1);
    expect(r.usablePairRate).toBe(1);
  });

  it('a TRUNCATED body is captured but is NOT a usable pair', () => {
    const r = coverageForBattle({ battleId: 'b1', mintedTickSeq: 2, ticks: [tick(1), tick(2, { bodyStatus: 'truncated' })] });
    expect(r.captured).toBe(2);
    expect(r.coverage).toBe(1);          // captured — no gap
    expect(r.truncatedBodies).toBe(1);
    expect(r.usablePairs).toBe(1);
    expect(r.usablePairRate).toBe(0.5);
  });

  it('a COPY-FAILED body is captured but is not a usable pair either', () => {
    const r = coverageForBattle({ battleId: 'b1', mintedTickSeq: 1, ticks: [tick(1, { bodyStatus: 'copy_failed' })] });
    expect(r.copyFailedBodies).toBe(1);
    expect(r.usablePairs).toBe(0);
  });

  it('an EXPIRED body is counted as expired, never as a gap', () => {
    const r = coverageForBattle({ battleId: 'b1', mintedTickSeq: 2, ticks: [tick(1), tick(2, { bodyPresent: false })] });
    expect(r.expiredBodies).toBe(1);
    expect(r.missing).toEqual([]);       // NOT a gap
    expect(r.coverage).toBe(1);          // coverage is about the RECORD, not the body
    expect(r.usablePairs).toBe(1);       // but it is not a pair any more
    expect(r.usablePairRate).toBe(0.5);
  });
});

describe('F6 (Astra round 1) — the three arithmetic defects', () => {
  it('(a) an EXPIRED body is counted even when the tick never dispatched', () => {
    // A CPU-passive or no-trigger tick has a body document too (it holds the
    // controls and the fault text). Skipping non-dispatched ticks before the
    // expiry count made those bodies vanish from the figure entirely.
    const r = coverageForBattle({
      battleId: 'b1', mintedTickSeq: 2,
      ticks: [
        tick(1, { dispatched: false, bodyStatus: 'skipped', bodyPresent: false }),
        tick(2, { dispatched: false, bodyStatus: 'skipped', bodyPresent: false }),
      ],
    });
    expect(r.expiredBodies).toBe(2);
    expect(r.dispatched).toBe(0);
    expect(r.usablePairRate).toBeNull();     // still not an all-attempts rate
  });

  it('(b) coverage NEVER exceeds 100%, and a record above the counter is an inconsistency', () => {
    // The export reads the battle document and the ticks subcollection
    // separately; a tick written between the two reads carries a sequence
    // above the counter the export saw.
    const r = coverageForBattle({ battleId: 'b1', mintedTickSeq: 1, ticks: [tick(1), tick(2)] });
    expect(r.coverage).toBeLessThanOrEqual(1);
    expect(r.aboveCounter).toEqual([2]);
    expect(r.inconsistent).toBe(true);
    expect(r.capturedWithinCounter).toBe(1);
  });

  it('(b) the totals and the printed report disclose the inconsistency rather than hiding it', () => {
    const t = computeCoverage([{ battleId: 'b1', mintedTickSeq: 1, ticks: [tick(1), tick(2)] }]);
    expect(t.coverage).toBeLessThanOrEqual(1);
    expect(t.aboveCounter).toBe(1);
    expect(formatCoverageReport(t, { scope: 'b1' })).toMatch(/above the counter|inconsisten/i);
  });
});

describe('a timed-out write is `unknown` until the export checks whether it landed', () => {
  it('resolves each reported sequence by PRESENCE', () => {
    const r = coverageForBattle({
      battleId: 'b1', mintedTickSeq: 3, ticks: [tick(1), tick(3)],
      reportedUnknown: [2, 3],
    });
    expect(r.resolvedUnknown).toEqual([
      { tickSeq: 2, resolution: 'missing' },   // the batch never landed
      { tickSeq: 3, resolution: 'landed' },    // the race timed out; the commit did not
    ]);
  });
});

describe('totals across battles, and the printed report', () => {
  const battles = [
    { battleId: 'b1', mintedTickSeq: 5, ticks: [tick(1), tick(2), tick(3)] },
    { battleId: 'b2', mintedTickSeq: 2, ticks: [tick(1, { bodyStatus: 'truncated' }), tick(2, { bodyPresent: false })] },
  ];

  it('sums each figure over its own denominator', () => {
    const t = computeCoverage(battles);
    expect(t).toMatchObject({
      battles: 2, minted: 7, captured: 5, attemptUnknown: 2, trailingGap: 2,
      dispatched: 5, usablePairs: 3, truncatedBodies: 1, expiredBodies: 1,
    });
    expect(t.coverage).toBeCloseTo(5 / 7);
    expect(t.usablePairRate).toBeCloseTo(3 / 5);
  });

  it('the report labels every figure with ITS OWN denominator and never claims an all-attempts rate', () => {
    const text = formatCoverageReport(computeCoverage(battles), { scope: 'battle b1' });
    expect(text).toContain('5 captured / 7 minted');
    expect(text).toContain('the persisted cronState.tickSeq');
    expect(text).toContain('3 / 5 captured ticks known to have dispatched');
    expect(text).toContain('attempt unknown 2');
    expect(text).toContain('EXPIRED BODIES  1');
    expect(text).toMatch(/never as a gap/);
    expect(text).not.toMatch(/all attempts/i);
  });

  it('an empty input produces no ratios rather than zeroes', () => {
    const t = computeCoverage([]);
    expect(t.coverage).toBeNull();
    expect(t.usablePairRate).toBeNull();
  });
});

describe('the JSONL line', () => {
  it('carries the permanent record and the body, and null where the body expired', () => {
    const permanent = { tickId: 'b1:2', tickSeq: 2 };
    expect(JSON.parse(toJsonlLine({ permanent, body: { tickId: 'b1:2' } }))).toEqual({ tickId: 'b1:2', permanent, body: { tickId: 'b1:2' } });
    expect(JSON.parse(toJsonlLine({ permanent }))).toEqual({ tickId: 'b1:2', permanent, body: null });
    expect(toJsonlLine({ permanent })).not.toContain('\n');
  });
});
