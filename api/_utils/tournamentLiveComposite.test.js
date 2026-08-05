// api/_utils/tournamentLiveComposite.test.js
//
// Standalone proof of the per-seat live-composite math (the endpoint is a
// one-way-door surface). Each seat's returned liveComposite is asserted against a
// HAND-computed banked-floor + today's-live = agent + user×1.5.
//
// Arithmetic is kept hand-checkable: atrPercentiles=null → baseATR=2.5 for every
// (non-crypto) symbol, and every open-leg move is |<2.5%| so multiplier<1 → NO
// threshold badge → livePoints = round(priceChange×10×1). Closed/dropped legs use
// explicit bankedScore. So each seat's numbers are computed by hand below.

import { describe, it, expect } from 'vitest';
import { computeGroupLiveComposites, collectGroupUserSymbols } from './tournamentLiveComposite.js';

// legs: open leg is LAST (scorePick's liveLeg = legs[legs.length-1]).
const closed = (bankedScore) => ({ closedAt: '2026-07-30T14:00:00Z', bankedScore });
const open = (baselinePrice, direction = 'long') => ({ baselinePrice, direction });

const group = {
  players: [
    {
      odUserId: 'userA',
      picks: [
        { symbol: 'AAA', legs: [closed(30), open(100)] }, // banked 30 + live(102 vs 100 = +2% → 20) = 50
        { symbol: 'BBB', legs: [open(200)] },              // live(203 vs 200 = +1.5% → 15)            = 15
      ],
      droppedPicks: [
        { symbol: 'CCC', legs: [closed(40)] },             // banked 40 (live leg already closed)      = 40
      ],
    },
    {
      odUserId: 'userB',
      picks: [
        { symbol: 'DDD', legs: [open(50)] },               // live(49 vs 50 = -2% → -20)               = -20
        { symbol: 'EEE', legs: [closed(10), open(80)] },   // banked 10 + live(81.6 vs 80 = +2% → 20)  = 30
      ],
    },
    { odUserId: 'cpu-0', isCpu: true, picks: [] },         // agent-only seat: userTotal 0
    { odUserId: 'cpu-1', isCpu: true, picks: [] },         // agent score ABSENT → agentPoints 0
  ],
};

// fetchGroupAgentScores byOwner (Σ scoreState.currentScore). cpu-1 deliberately absent.
const agentScores = { userA: 260, userB: 150, 'cpu-0': 90 };

const quotes = {
  AAA: { current: 102 },
  BBB: { current: 203 },
  DDD: { current: 49 },
  EEE: { current: 81.6 },
  // CCC omitted on purpose — its only leg is closed, scorePick never prices it.
};

describe('computeGroupLiveComposites — per-seat arithmetic (banked floor + today live)', () => {
  const out = computeGroupLiveComposites(group, agentScores, quotes, /* atrPercentiles */ null);

  it('userA = 260 + 1.5 × (50 + 15 + 40) = 260 + 157.5 = 417.5', () => {
    // user half: AAA(30+20) + BBB(15) + CCC dropped(40) = 105
    expect(out.userA).toBe(417.5);
  });

  it('userB = 150 + 1.5 × (-20 + 30) = 150 + 15 = 165', () => {
    // user half: DDD(-20) + EEE(10+20) = 10
    expect(out.userB).toBe(165);
  });

  it('cpu-0 (agent-only, no user picks) = 90 + 1.5 × 0 = 90', () => {
    expect(out['cpu-0']).toBe(90);
  });

  it('cpu-1 (agent score absent) degrades to 0, never NaN/undefined', () => {
    expect(out['cpu-1']).toBe(0);
  });

  it('returns scalars only — a flat {odUserId: number} map, no holdings/objects', () => {
    expect(Object.keys(out).sort()).toEqual(['cpu-0', 'cpu-1', 'userA', 'userB']);
    for (const v of Object.values(out)) expect(typeof v).toBe('number');
  });

  it('is k=1.5 exact: userA composite − agent equals 1.5 × userTotal', () => {
    expect(out.userA - 260).toBeCloseTo(1.5 * 105, 10);
  });
});

describe('collectGroupUserSymbols — held ∪ dropped union for the quote fetch', () => {
  it('includes held AND dropped symbols, deduped', () => {
    expect(collectGroupUserSymbols(group).sort()).toEqual(['AAA', 'BBB', 'CCC', 'DDD', 'EEE']);
  });
  it('is null-safe on an empty/absent group', () => {
    expect(collectGroupUserSymbols(null)).toEqual([]);
    expect(collectGroupUserSymbols({})).toEqual([]);
  });
});

describe('computeGroupLiveComposites — robustness', () => {
  it('skips players with no odUserId and picks with no symbol; never throws', () => {
    const g = { players: [
      { picks: [{ symbol: 'ZZZ', legs: [open(10)] }] },      // no odUserId → skipped
      { odUserId: 'u', picks: [{ legs: [open(10)] }] },      // pick without symbol → skipped, userTotal 0
    ] };
    const r = computeGroupLiveComposites(g, { u: 5 }, { ZZZ: { current: 10 } }, null);
    expect(r).toEqual({ u: 5 }); // agent 5 + 1.5×0
  });
});
