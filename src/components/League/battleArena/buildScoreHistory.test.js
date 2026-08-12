// src/components/League/battleArena/buildScoreHistory.test.js
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { buildScoreHistory } from './buildScoreHistory';
import { buildSwapLedger } from './leagueSwapLedger';
import { FilmRoomRecap } from './FilmRoomRecap';

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

describe('buildScoreHistory — swap day labels bind to the timeline dayN (recordedDate axis, §9)', () => {
  const dayEntry = (rd, comp) => ({ recordedDate: rd, closeScores: { [UID]: { compositePoints: comp } } });
  const g = {
    status: 'complete',
    players: [{ odUserId: UID }],
    dailyScores: {
      day1: dayEntry('2026-08-10', 5),
      day2: dayEntry('2026-08-11', 8),
      day3: dayEntry('2026-08-12', 6),
    },
  };
  const doc = (id, date, trades) => ({ id, createdAt: `${date}T13:00:00Z`, timing: { tradingDays: [date] }, trades });

  it('labels swaps by mapped tournament dayN, NOT chain ordinal — a mid-battle no-swap day does not shift later days', () => {
    const chain = [
      doc('b1', '2026-08-10', [{ symbolOut: 'A', symbolIn: 'B', lockedPoints: 4 }]),
      doc('b2', '2026-08-11', []), // no swap on day 2
      doc('b3', '2026-08-12', [{ symbolOut: 'C', symbolIn: 'D', lockedPoints: -2 }]),
    ];
    const h = buildScoreHistory({ group: g, battleChain: chain, uid: UID });
    // The day-3 swap stays DAY 3 (its banked dayN) — a filter-then-ordinal
    // numbering would mislabel it DAY 2. This row fails under that regression.
    expect(h.swapDays.map((d) => d.day)).toEqual([1, 3]);
    expect(h.swapDays.every((d) => d.dayIsOrdinalFallback === false)).toBe(true);
    // Swap DAY numbers are a subset of the timeline DAY numbers — one axis, no §9
    // self-contradiction between the two halves of the recap.
    const timelineDays = h.timeline.map((t) => t.day);
    expect(h.swapDays.every((d) => timelineDays.includes(d.day))).toBe(true);
  });

  it('falls back to the chain ordinal (flagged) only when a doc has no mappable trading date', () => {
    const chain = [
      { id: 'x1', createdAt: '2026-08-10T13:00:00Z', trades: [{ symbolOut: 'A', symbolIn: 'B', lockedPoints: 1 }] }, // no timing.tradingDays
    ];
    const h = buildScoreHistory({ group: g, battleChain: chain, uid: UID });
    expect(h.swapDays[0].day).toBe(1);
    expect(h.swapDays[0].dayIsOrdinalFallback).toBe(true);
  });
});

describe('buildScoreHistory — phase follows the arena, not the banked-day count (ruling 2)', () => {
  it('a LIVE, UNBANKED day (status BATTLE, 0 banked) reads phase live — not awaiting', () => {
    // climbSeriesPhase returned 'awaiting' here (banked dayN = 0); deriveArenaState
    // returns 'live' for status BATTLE. This row is RED before the phase binding.
    const liveDay0 = { status: 'battle', players: [{ odUserId: UID }], dailyScores: {} };
    const h = buildScoreHistory({ group: liveDay0, battleChain: [], uid: UID });
    expect(h.phase).toBe('live');
  });

  it('a completed group reads phase complete; a forming group reads awaiting', () => {
    expect(buildScoreHistory({ group: { status: 'complete', players: [{ odUserId: UID }], dailyScores: {} }, uid: UID }).phase).toBe('complete');
    expect(buildScoreHistory({ group: { status: 'forming', players: [{ odUserId: UID }], dailyScores: {} }, uid: UID }).phase).toBe('awaiting');
  });
});

describe('FilmRoomRecap — live vs completed copy follows history.phase (ruling 2)', () => {
  const swapChain = (date) => [{
    id: 't', status: 'active', createdAt: `${date}T13:30:00.000Z`,
    timing: { tradingDays: [date] }, trades: [{ symbolOut: 'A', symbolIn: 'B', lockedPoints: 2 }],
  }];

  it('LIVE unbanked day: the recap shows the live copy and the "· today" marker', () => {
    // The exact scenario the phase fix protects: a live, unbanked Day-with-a-swap.
    // Before the fix (climbSeriesPhase → awaiting) the recap wrongly showed the
    // "banked into your final standing" copy and dropped "· today" — asserting
    // unbanked money is banked. This render is RED before the fix.
    const liveGroup = { status: 'battle', players: [{ odUserId: UID }], dailyScores: {} };
    const h = buildScoreHistory({ group: liveGroup, battleChain: swapChain('2026-06-16'), uid: UID, now: Date.parse('2026-06-16T14:00:00.000Z') });
    expect(h.phase).toBe('live');
    const html = renderToString(React.createElement(FilmRoomRecap, { history: h }));
    expect(html).toContain('on the live strip');            // live footer
    expect(html).toContain('· today');                 // the "· today" marker on the current day
    expect(html).not.toContain('banked into your final standing');
  });

  it('COMPLETED battle: the recap shows the banked copy and no "· today"', () => {
    const doneGroup = {
      status: 'complete', players: [{ odUserId: UID }],
      dailyScores: { day1: { recordedDate: '2026-06-16', closeScores: { [UID]: { compositePoints: 5 } } } },
    };
    const doneChain = [{
      id: 'd1', status: 'completed', createdAt: '2026-06-16T13:30:00.000Z',
      timing: { tradingDays: ['2026-06-16'] }, trades: [{ symbolOut: 'A', symbolIn: 'B', lockedPoints: 2 }],
    }];
    const h = buildScoreHistory({ group: doneGroup, battleChain: doneChain, uid: UID, now: Date.parse('2026-06-17T14:00:00.000Z') });
    expect(h.phase).toBe('complete');
    const html = renderToString(React.createElement(FilmRoomRecap, { history: h }));
    expect(html).toContain('banked into your final standing'); // completed footer
    expect(html).not.toContain('on the live strip');
    expect(html).not.toContain('· today');
  });
});
