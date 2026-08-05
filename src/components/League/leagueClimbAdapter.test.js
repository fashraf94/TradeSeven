// src/components/League/leagueClimbAdapter.test.js
//
// Real imports (never mocked) — the import itself is the node-clean dependency
// guard for this pure assembler.
import { describe, it, expect } from 'vitest';
import { buildClimbSeries, climbSeriesPhase } from './leagueClimbAdapter';

const group = (dailyScores, extra = {}) => ({
  players: [{ odUserId: 'u1' }, { odUserId: 'u2' }],
  status: 'battle',
  dailyScores,
  ...extra,
});

describe('buildClimbSeries — cumulative snapshots, NEVER re-summed', () => {
  it('HEADLINE: copies each day\'s cumulative compositePoints, does NOT add days', () => {
    const g = group({
      day1: { closeScores: { u1: { compositePoints: 4, totalPoints: 2, agentPoints: 1 } } },
      day2: { closeScores: { u1: { compositePoints: 10.5, totalPoints: 6, agentPoints: 1.5 } } },
    });
    const series = buildClimbSeries(g);
    expect(series.u1).toEqual([4, 10.5]);
    expect(series.u1).not.toEqual([4, 14.5]); // 4 + 10.5 — the re-sum bug
  });

  it('degrades a pre-P6 snapshot via computeComposite (k=1.5), exactly as getWeeklyComposite', () => {
    const g = group({
      day1: { closeScores: { u1: { totalPoints: 2, agentPoints: 3 } } }, // no compositePoints
    });
    // computeComposite(3, 2) = 3 + 1.5 * 2 = 6
    expect(buildClimbSeries(g).u1).toEqual([6]);
  });

  it("metric:'user' reads the user-layer totalPoints", () => {
    const g = group({
      day1: { closeScores: { u1: { compositePoints: 99, totalPoints: 2 } } },
      day2: { closeScores: { u1: { compositePoints: 99, totalPoints: 6.5 } } },
    });
    expect(buildClimbSeries(g, { metric: 'user' }).u1).toEqual([2, 6.5]);
  });

  it('carries a missing day forward — no phantom drop to 0', () => {
    const g = group({
      day1: { closeScores: { u1: { compositePoints: 4 } } },
      day2: { closeScores: { u2: { compositePoints: 1 } } }, // u1 absent on day2
    });
    expect(buildClimbSeries(g).u1).toEqual([4, 4]); // held, not 0
  });

  it('emits every group seat — an unscored player reads the start line (0)', () => {
    const g = group({ day1: { closeScores: { u1: { compositePoints: 4 } } } });
    const series = buildClimbSeries(g);
    expect(series.u2).toEqual([0]);
    expect(Object.keys(series).sort()).toEqual(['u1', 'u2']);
  });

  it('sorts days numerically (day2 before day10) and returns a dense array', () => {
    const g = {
      players: [{ odUserId: 'u1' }],
      dailyScores: {
        day10: { closeScores: { u1: { compositePoints: 30 } } },
        day2: { closeScores: { u1: { compositePoints: 20 } } },
      },
    };
    expect(buildClimbSeries(g).u1).toEqual([20, 30]);
  });

  it('treats compositePoints:0 as a real snapshot (falsy-but-valid), not missing', () => {
    const g = group({
      day1: { closeScores: { u1: { compositePoints: 4 } } },
      day2: { closeScores: { u1: { compositePoints: 0, agentPoints: 9, totalPoints: 9 } } },
    });
    // 0 must win over the degrade path (which would fabricate 9 + 1.5*9 = 22.5)
    expect(buildClimbSeries(g).u1).toEqual([4, 0]);
  });

  it('carries forward a present-but-empty snapshot {} (does not collapse to 0)', () => {
    const g = group({
      day1: { closeScores: { u1: { compositePoints: 40 } } },
      day2: { closeScores: { u1: {} } }, // banked-but-empty record
    });
    expect(buildClimbSeries(g).u1).toEqual([40, 40]); // held, not a phantom 0
  });

  it('no dailyScores → empty series per seat', () => {
    expect(buildClimbSeries(group({})).u1).toEqual([]);
  });
});

describe('climbSeriesPhase', () => {
  it('awaiting when no day is banked', () => {
    expect(climbSeriesPhase(group({}))).toBe('awaiting');
  });
  it('live mid-week (2 of 5 days, status battle)', () => {
    expect(climbSeriesPhase(group({
      day1: { closeScores: {} }, day2: { closeScores: {} },
    }))).toBe('live');
  });
  it('complete when the full week is banked (5 days)', () => {
    const days = {};
    for (let n = 1; n <= 5; n++) days[`day${n}`] = { closeScores: {} };
    expect(climbSeriesPhase(group(days))).toBe('complete');
  });
  it('complete when status is complete even on a short (holiday) week', () => {
    expect(climbSeriesPhase(group({ day1: { closeScores: {} } }, { status: 'complete' }))).toBe('complete');
  });
  it('complete (terminal) when EXPIRED, even with no banked day — never reads awaiting (Training-Pod P0 R2)', () => {
    expect(climbSeriesPhase(group({}, { status: 'expired' }))).toBe('complete');
  });
  it('complete (terminal) when VOIDED, even with banked days present — never reads live (L-A)', () => {
    expect(climbSeriesPhase(group({ day1: { closeScores: {} }, day2: { closeScores: {} } }, { status: 'voided' }))).toBe('complete');
  });
});
