// src/components/League/battleArena/buildScoreHistory.test.js
import { describe, it, expect } from 'vitest';
import { buildScoreHistory } from './buildScoreHistory';
import { buildSwapLedger } from './leagueSwapLedger';

const UID = 'u-you';

function group({ status = 'complete', days = {} } = {}) {
  return { status, players: [{ odUserId: UID }], dailyScores: days };
}

// A group with a 3-day composite climb for UID (10 → 25 → 22).
const CLIMB = {
  day1: { closeScores: { [UID]: { compositePoints: 10 } } },
  day2: { closeScores: { [UID]: { compositePoints: 25 } } },
  day3: { closeScores: { [UID]: { compositePoints: 22 } } },
};

describe('buildScoreHistory — Level 1 timeline', () => {
  it('reads the per-day composite timeline with day numbers and deltas', () => {
    const h = buildScoreHistory({ group: group({ days: CLIMB }), battleChain: [], uid: UID });
    expect(h.timeline).toEqual([
      { day: 1, composite: 10, delta: null },
      { day: 2, composite: 25, delta: 15 },
      { day: 3, composite: 22, delta: -3 },
    ]);
  });

  it('is a pure read that renders identically on a COMPLETE group (survives the bank)', () => {
    const live = buildScoreHistory({ group: group({ status: 'battle', days: CLIMB }), battleChain: [], uid: UID });
    const done = buildScoreHistory({ group: group({ status: 'complete', days: CLIMB }), battleChain: [], uid: UID });
    expect(done.timeline).toEqual(live.timeline); // same banked read either side of the bank
    expect(done.phase).toBe('complete');
  });

  it('empty group → empty timeline, phase awaiting, no swaps', () => {
    const h = buildScoreHistory({ group: group({ status: 'forming', days: {} }), battleChain: [], uid: UID });
    expect(h.timeline).toEqual([]);
    expect(h.swapDays).toEqual([]);
    expect(h.swapTotal).toBe(0);
    expect(h.phase).toBe('awaiting');
  });
});

describe('buildScoreHistory — swap ledger across the chain', () => {
  // Two daily docs; day 1 had two swaps, day 2 (the current/active doc) one.
  const chain = [
    {
      id: 'b2', createdAt: '2026-08-12T13:00:00Z', status: 'active',
      trades: [{ symbolOut: 'COIN', symbolIn: 'SHOP', lockedPoints: -8, swappedOutAt: 'd2t1' }],
    },
    {
      id: 'b1', createdAt: '2026-08-11T13:00:00Z', status: 'completed',
      trades: [
        { symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 12 },
        { symbolOut: 'PFE', symbolIn: 'AMD', lockedPoints: -3 },
      ],
    },
  ];

  it('walks every day (createdAt order), labels battle-days, and totals across the battle', () => {
    const h = buildScoreHistory({ group: group({ days: CLIMB }), battleChain: chain, uid: UID });
    expect(h.swapDays.map((d) => [d.day, d.subtotal, d.items.length])).toEqual([
      [1, 9, 2], // b1 first by createdAt → Day 1 → 12 + (-3)
      [2, -8, 1], // b2 → Day 2
    ]);
    expect(h.swapTotal).toBe(1); // 9 + (-8) — the full-battle swap total (the BANKED-prior story)
    expect(h.swapCount).toBe(3);
  });

  it('marks the current doc and reconciles its subtotal with the live strip SWAPS (§9)', () => {
    const h = buildScoreHistory({ group: group({ days: CLIMB }), battleChain: chain, uid: UID });
    const currentDay = h.swapDays.find((d) => d.isCurrent);
    expect(currentDay.day).toBe(2);
    // The strip reads the SAME current doc via buildSwapLedger → identical number.
    const stripSwaps = buildSwapLedger(chain[0].trades).total; // chain[0] is b2 (active)
    expect(h.currentSwapSubtotal).toBe(stripSwaps);
    expect(currentDay.subtotal).toBe(stripSwaps);
  });

  it('a current day with zero swaps still reports currentSwapSubtotal 0 (honest, not omitted)', () => {
    const noSwapCurrent = [
      { id: 'b1', createdAt: '2026-08-11T13:00:00Z', status: 'completed', trades: [{ symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 12 }] },
      { id: 'b2', createdAt: '2026-08-12T13:00:00Z', status: 'active', trades: [] },
    ];
    const h = buildScoreHistory({ group: group({ days: CLIMB }), battleChain: noSwapCurrent, uid: UID });
    expect(h.currentSwapSubtotal).toBe(0); // strip would show SWAPS 0 today — they agree
    expect(h.swapDays.map((d) => d.day)).toEqual([1]); // only the day that had a swap is listed
    expect(h.baseUnavailable).toBe(true);
  });
});
