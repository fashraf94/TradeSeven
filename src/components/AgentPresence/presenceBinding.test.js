// src/components/AgentPresence/presenceBinding.test.js
//
// Node-clean unit tests for the read-only presence binding. Importing this module is
// the dependency-surface guard: presenceBinding.js must stay node-clean (it imports
// only faceMoves' plain EVENT_TIER object — no React, no framer, no Firestore). If a
// browser dep ever enters the graph, this test explodes in the Node test env.

import { describe, it, expect } from 'vitest';
import {
  archetypeToDisposition,
  resolveAccent,
  standingFromRank,
  standingFromDuel,
  beatKey,
  beatToEvent,
  beatsToEvents,
  statusFeedToEvents,
} from './presenceBinding';

describe('archetypeToDisposition', () => {
  it('maps the six canonical code-ids to reflex dispositions', () => {
    expect(archetypeToDisposition('degen')).toBe('speculator');
    expect(archetypeToDisposition('momentum_chaser')).toBe('speculator');
    expect(archetypeToDisposition('guardian')).toBe('capital-preserver');
    expect(archetypeToDisposition('diversifier')).toBe('capital-preserver');
    expect(archetypeToDisposition('analyst')).toBe('neutral');
    expect(archetypeToDisposition('contrarian')).toBe('neutral');
  });
  it('accepts display labels (normalizes case/space/punct)', () => {
    expect(archetypeToDisposition('Capital Preserver')).toBe('capital-preserver');
    expect(archetypeToDisposition('Trend Follower')).toBe('speculator');
    expect(archetypeToDisposition('Fundamental Investor')).toBe('neutral');
    expect(archetypeToDisposition('Speculator')).toBe('speculator');
  });
  it('falls back to neutral for unknown/empty', () => {
    expect(archetypeToDisposition('unknown')).toBe('neutral');
    expect(archetypeToDisposition('')).toBe('neutral');
    expect(archetypeToDisposition(null)).toBe('neutral');
    expect(archetypeToDisposition(undefined)).toBe('neutral');
  });
});

describe('resolveAccent', () => {
  it('prefers primaryColor, then avatarColors[0], then teal', () => {
    expect(resolveAccent({ primaryColor: '#ABCDEF' })).toBe('#ABCDEF');
    expect(resolveAccent({ avatarColors: ['#123456', '#000'] })).toBe('#123456');
    expect(resolveAccent({})).toBe('#5EEAD4');
    expect(resolveAccent(null)).toBe('#5EEAD4');
  });
});

describe('standingFromRank', () => {
  it('maps rank to [-1,1] across the seat field', () => {
    expect(standingFromRank(1, 4)).toBeCloseTo(1, 5);
    expect(standingFromRank(4, 4)).toBeCloseTo(-1, 5);
    expect(standingFromRank(2, 4)).toBeCloseTo(1 / 3, 5);
    expect(standingFromRank(3, 4)).toBeCloseTo(-1 / 3, 5);
    expect(standingFromRank(1, 2)).toBeCloseTo(1, 5);
    expect(standingFromRank(2, 2)).toBeCloseTo(-1, 5);
  });
  it('guards invalid input to neutral', () => {
    expect(standingFromRank(0, 4)).toBe(0);
    expect(standingFromRank(1, 1)).toBe(0);
    expect(standingFromRank(undefined, 4)).toBe(0);
    expect(standingFromRank(2, undefined)).toBe(0);
  });
});

describe('standingFromDuel', () => {
  it('is positive when ahead, negative when behind, 0 when even', () => {
    expect(standingFromDuel(100, 0)).toBeCloseTo(1, 5);
    expect(standingFromDuel(0, 100)).toBeCloseTo(-1, 5);
    expect(standingFromDuel(50, 50)).toBe(0);
    expect(standingFromDuel(300, 100)).toBeCloseTo(0.5, 5);
  });
  it('resolves both-losing to who is less bad (mirrors the tug-of-war)', () => {
    expect(standingFromDuel(-100, -300)).toBeCloseTo(0.5, 5); // less negative = ahead
    expect(standingFromDuel(-300, -100)).toBeCloseTo(-0.5, 5);
  });
  it('agrees in sign with isLeading (my >= opp)', () => {
    const cases = [[10, 5], [5, 10], [-2, -8], [-8, -2], [0, 0], [7, 7]];
    for (const [my, opp] of cases) {
      const s = standingFromDuel(my, opp);
      if (my > opp) expect(s).toBeGreaterThan(0);
      else if (my < opp) expect(s).toBeLessThan(0);
      else expect(s).toBe(0);
    }
  });
  it('guards non-finite and 0/0 to neutral', () => {
    expect(standingFromDuel(0, 0)).toBe(0);
    expect(standingFromDuel(NaN, 5)).toBe(0);
    expect(standingFromDuel(5, undefined)).toBe(0);
  });
});

describe('beat mapping', () => {
  it('maps beat kinds to design events with the right tier/tone', () => {
    expect(beatToEvent({ kind: 'hit', star: 'NVDA', pts: 40, text: 'NVDA hit Bagger', tone: 'good' }))
      .toMatchObject({ ev: 'thresholdgood', tier: 3, tone: 'good' });
    expect(beatToEvent({ kind: 'edge', tone: 'good' })).toMatchObject({ ev: 'thresholdnear', tier: 2 });
    expect(beatToEvent({ kind: 'danger', tone: 'bad' })).toMatchObject({ ev: 'thresholdbad', tier: 3, tone: 'bad' });
    expect(beatToEvent({ kind: 'swap', tone: 'neutral' })).toMatchObject({ ev: 'swap', tier: 2, tone: 'neu' });
    expect(beatToEvent({ kind: 'lead', tone: 'good' })).toMatchObject({ ev: 'standingflip', tier: 2 });
    expect(beatToEvent({ kind: 'claim', tone: 'good' })).toMatchObject({ ev: 'swap' });
    expect(beatToEvent({ kind: 'flip', tone: 'neutral' })).toMatchObject({ ev: 'swap' });
  });
  it('returns null for unmapped/empty beats', () => {
    expect(beatToEvent({ kind: 'mystery' })).toBeNull();
    expect(beatToEvent(null)).toBeNull();
    expect(beatToEvent({})).toBeNull();
  });
  it('content-keys are stable and de-duplicated across a stream', () => {
    const b = { kind: 'swap', star: 'AAPL', pts: 12, text: 'swapped X → AAPL', tone: 'neutral' };
    expect(beatKey(b)).toBe('swap|AAPL|12|swapped X → AAPL');
    const events = beatsToEvents([b, { ...b }, { kind: 'hit', star: 'MSFT', pts: 30, text: 'MSFT hit', tone: 'good' }]);
    expect(events).toHaveLength(2); // duplicate swap collapses to one id
    expect(events.map((e) => e.ev)).toEqual(['swap', 'thresholdgood']);
  });
  it('ignores non-array input', () => {
    expect(beatsToEvents(null)).toEqual([]);
    expect(beatsToEvents(undefined)).toEqual([]);
  });
});

describe('statusFeedToEvents (1v1)', () => {
  it('maps only swap-class actions to swap events', () => {
    const feed = [
      { action: 'swap', timestamp: 't1', symbolIn: 'NVDA', symbolOut: 'AMD' },
      { action: 'hold', timestamp: 't2' },
      { action: 'trade_executed', timestamp: 't3', symbolIn: 'TSLA' },
      { action: 'battle_complete', timestamp: 't4' },
    ];
    const events = statusFeedToEvents(feed);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.ev === 'swap' && e.tier === 2)).toBe(true);
    expect(events[0].id).toContain('t1');
  });
  it('ignores non-array input', () => {
    expect(statusFeedToEvents(null)).toEqual([]);
  });
});
