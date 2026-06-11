// api/tournament/resolve-user-draft.test.js
//
// Determinism battery for the 3-pick user snake resolution (rider #3 stream
// shape included).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL
// resolve-user-draft module below is the runtime guard for its api/ -> src/
// import chain (src/constants/leagueTournament.js) — it explodes in this Node
// test environment if a browser-only dependency ever enters the graph. Never
// mock this import.

import { describe, it, expect } from 'vitest';
import { resolveSnakeDraft } from './resolve-user-draft.js';

const POOL = [
  'NVDA', 'AMD', 'TSLA', 'META', 'AAPL', 'MSFT', 'AMZN', 'GOOG', 'NFLX', 'AVGO',
  'CRM', 'ORCL', 'ADBE', 'COIN', 'PLTR', 'SHOP', 'SQ', 'UBER', 'ABNB', 'SNOW',
];
const MEMBERS = ['user-a', 'user-b', 'user-c', 'user-d'];

function makeGroup(overrides = {}) {
  return {
    status: 'forming',
    roundNumber: 1,
    groupMembers: [...MEMBERS],
    players: MEMBERS.map(odUserId => ({ odUserId, picks: [] })),
    userPool: [...POOL],
    ...overrides,
  };
}

// Disjoint boards: no contention — everyone should walk their list in order.
function disjointBoards() {
  return {
    'user-a': { board: ['NVDA', 'AMD', 'TSLA'] },
    'user-b': { board: ['META', 'AAPL', 'MSFT'] },
    'user-c': { board: ['AMZN', 'GOOG', 'NFLX'] },
    'user-d': { board: ['AVGO', 'CRM', 'ORCL'] },
  };
}

describe('snake order', () => {
  it('rounds run fwd / rev / fwd over groupMembers (picks 1-12)', () => {
    const { events } = resolveSnakeDraft(makeGroup(), disjointBoards());
    expect(events.map(e => e.odUserId)).toEqual([
      'user-a', 'user-b', 'user-c', 'user-d',
      'user-d', 'user-c', 'user-b', 'user-a',
      'user-a', 'user-b', 'user-c', 'user-d',
    ]);
    expect(events.map(e => e.pickNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(events.map(e => e.round)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  });

  it('uncontended boards resolve in board order with no passes', () => {
    const { picksByUser, events } = resolveSnakeDraft(makeGroup(), disjointBoards());
    expect(picksByUser).toEqual({
      'user-a': ['NVDA', 'AMD', 'TSLA'],
      'user-b': ['META', 'AAPL', 'MSFT'],
      'user-c': ['AMZN', 'GOOG', 'NFLX'],
      'user-d': ['AVGO', 'CRM', 'ORCL'],
    });
    expect(events.every(e => e.passedOver.length === 0 && e.fallback === false)).toBe(true);
  });
});

describe('pool exclusivity (12 user-held names per group)', () => {
  it('12 unique picks; remainingPool = pool minus exactly those 12, order kept', () => {
    const { picksByUser, remainingPool } = resolveSnakeDraft(makeGroup(), disjointBoards());
    const all = Object.values(picksByUser).flat();
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
    expect(remainingPool).toEqual(POOL.filter(s => !all.includes(s)));
    expect(remainingPool).toHaveLength(POOL.length - 12);
  });

  it('holds under full contention (identical boards) — snipes force uniqueness', () => {
    const sharedBoard = { board: POOL.slice(0, 15) };
    const boards = Object.fromEntries(MEMBERS.map(id => [id, sharedBoard]));
    const { picksByUser, events } = resolveSnakeDraft(makeGroup(), boards);
    const all = Object.values(picksByUser).flat();
    expect(new Set(all).size).toBe(12);
    // Pick 12 (user-d's last) selects board rank 11; of the 11 names above
    // it, 2 are user-d's own earlier picks (silent) — 9 are snipes by others.
    expect(events[11].boardRank).toBe(11);
    expect(events[11].passedOver).toHaveLength(9);
    const ownPicks = picksByUser['user-d'];
    expect(events[11].passedOver.every(s => !ownPicks.includes(s))).toBe(true);
  });
});

describe('snipes and the passedOver record (playback source)', () => {
  it("a sniped top name shifts the player to their next rank, recorded", () => {
    const boards = disjointBoards();
    boards['user-b'] = { board: ['NVDA', 'META', 'AAPL'] }; // NVDA goes to user-a at pick 1
    const { events } = resolveSnakeDraft(makeGroup(), boards);
    const pickB = events.find(e => e.pickNumber === 2);
    expect(pickB).toEqual({
      pickNumber: 2,
      round: 1,
      odUserId: 'user-b',
      symbol: 'META',
      boardRank: 1,
      fallback: false,
      passedOver: ['NVDA'],
    });
  });
});

describe('board-exhaustion fallback (deterministic, pool-ranked)', () => {
  it('an exhausted board falls back to the highest-ranked remaining pool name', () => {
    const boards = disjointBoards();
    // user-d ranks only names user-a..c will have taken by round 2.
    boards['user-d'] = { board: ['NVDA', 'META', 'AMZN'] };
    const { events, picksByUser } = resolveSnakeDraft(makeGroup(), boards);
    const dEvents = events.filter(e => e.odUserId === 'user-d');
    // Pick 4: NVDA/META/AMZN are taken (picks 1-3) — full board passed, fallback.
    expect(dEvents[0].fallback).toBe(true);
    expect(dEvents[0].boardRank).toBeNull();
    expect(dEvents[0].passedOver).toEqual(['NVDA', 'META', 'AMZN']);
    // Highest-ranked pool name not yet taken at pick 4: AMD (NVDA,META,AMZN gone).
    expect(dEvents[0].symbol).toBe('AMD');
    expect(picksByUser['user-d']).toHaveLength(3);
  });
});

describe('determinism', () => {
  it('identical inputs produce identical resolutions', () => {
    const a = resolveSnakeDraft(makeGroup(), disjointBoards());
    const b = resolveSnakeDraft(makeGroup(), disjointBoards());
    expect(a).toEqual(b);
  });

  it('inputs are not mutated', () => {
    const group = makeGroup();
    const boards = disjointBoards();
    resolveSnakeDraft(group, boards);
    expect(group.userPool).toEqual(POOL);
    expect(boards['user-a'].board).toEqual(['NVDA', 'AMD', 'TSLA']);
  });
});

describe('preconditions', () => {
  it('requires a forming group', () => {
    expect(() => resolveSnakeDraft(makeGroup({ status: 'battle' }), disjointBoards()))
      .toThrow(/not_forming/);
    expect(() => resolveSnakeDraft(null, disjointBoards())).toThrow(/group_not_found/);
  });

  it('requires a committed board per member — names the laggards', () => {
    const boards = disjointBoards();
    delete boards['user-c'];
    try {
      resolveSnakeDraft(makeGroup(), boards);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/boards_missing/);
      expect(err.detail).toMatch(/user-c/);
    }
  });

  it('requires a pool of at least 12', () => {
    expect(() => resolveSnakeDraft(makeGroup({ userPool: POOL.slice(0, 11) }), disjointBoards()))
      .toThrow(/pool_too_small/);
  });
});
