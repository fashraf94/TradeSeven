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
import { resolveSnakeDraft, resolveUserDraftForGroup } from './resolve-user-draft.js';
import { generateSnakeOrder } from '../../src/services/draftAssets.js';
import {
  GROUP_SIZE,
  PICKS_PER_PLAYER,
  GROUP_STATUS,
  currentBaseLayerWeek,
} from '../../src/constants/leagueTournament.js';

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

  // League Training Slice 2 (Decision 1): the canonical generateSnakeOrder
  // (draftAssets.js) is the ONE source for the live interactive draft. Rather
  // than refactor this battle-tested ranked resolver's inline order, we LOCK the
  // equivalence so the two can never drift: generateSnakeOrder's seat indices,
  // mapped over groupMembers, MUST match the resolver's pick-by-pick order.
  it('the canonical generateSnakeOrder matches the resolver order (unification lock)', () => {
    const { events } = resolveSnakeDraft(makeGroup(), disjointBoards());
    const fromEngine = generateSnakeOrder(GROUP_SIZE, PICKS_PER_PLAYER).map(seatIdx => MEMBERS[seatIdx]);
    expect(events.map(e => e.odUserId)).toEqual(fromEngine);
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


// ==================== D-LOBBYWEEK (ii): the FORMING→BATTLE restamp ====================
//
// The drift-proof half of the fix. A base-layer pod's battle week is NOT reliably
// knowable at formation: a pod that lingers in FORMING past its formation-derived
// Monday (board auto-commit deferral, or a cron gap spanning a Monday morning — there
// is no expiry backstop for a non-training lobby pod) battles a LATER week, and its
// formation stamp would stay wrong forever. Resolution is the moment the true battle
// week is certain, so the cohort key is re-stamped here with currentBaseLayerWeek —
// the ET-anchored READ-side twin THE FIELD queries with.
//
// The lingering row below is modelled on a REAL production document found by the
// D-LOBBYWEEK pre-check: created 2026-07-01 (formation derives 2026-W28) but first
// banked 2026-07-15 (2026-W29) — it sat through two Mondays. Formation-time
// derivation alone would have stamped that group wrong.

function makeTxDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const ref = (path) => ({
    path,
    id: path.split('/').pop(),
    collection: (name) => ({ doc: (id) => ref(`${path}/${name}/${id}`) }),
  });
  const snap = (path) => ({
    exists: store.has(path),
    data: () => (store.has(path) ? structuredClone(store.get(path)) : undefined),
  });
  return {
    store,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction: async (fn) => fn({
      get: async (r) => snap(r.path),
      getAll: async (...refs) => refs.map(r => snap(r.path)),
      update: (r, updates) => store.set(r.path, { ...structuredClone(store.get(r.path)), ...structuredClone(updates) }),
      set: (r, data) => store.set(r.path, structuredClone(data)),
    }),
  };
}

const RS_MEMBERS = ['user-a', 'user-b', 'user-c', 'user-d'];

function seedGroup(groupId, groupOverrides = {}) {
  const seed = {
    [`tournamentGroups/${groupId}`]: {
      status: GROUP_STATUS.FORMING,
      roundNumber: 1,
      groupMembers: [...RS_MEMBERS],
      players: RS_MEMBERS.map(odUserId => ({ odUserId, picks: [] })),
      userPool: [...POOL],
      ...groupOverrides,
    },
  };
  const boards = disjointBoards();
  for (const uid of RS_MEMBERS) seed[`tournamentGroups/${groupId}/boards/${uid}`] = boards[uid];
  return seed;
}

describe('D-LOBBYWEEK (ii) — baseLayerWeek is re-stamped at FORMING→BATTLE', () => {
  // The production lingering case: formed 2026-07-01 (derives 2026-W28), but it sat
  // in FORMING through two Mondays and actually resolved into battle in 2026-W29.
  const LINGERED_RESOLVE = new Date('2026-07-13T13:00:00.000Z'); // Mon 2026-07-13, 09:00 ET

  it('a pod that LINGERED in FORMING is re-stamped to the week it actually battles', async () => {
    const db = makeTxDb(seedGroup('lingerer', { baseLayerWeek: '2026-W28' }));
    await resolveUserDraftForGroup(db, 'lingerer', { now: LINGERED_RESOLVE });

    const group = db.store.get('tournamentGroups/lingerer');
    expect(group.status).toBe(GROUP_STATUS.BATTLE);
    // The week it actually plays — what THE FIELD will ask for all that week.
    expect(group.baseLayerWeek).toBe(currentBaseLayerWeek(LINGERED_RESOLVE));
    expect(group.baseLayerWeek).toBe('2026-W29');
    // The stale formation-derived week is gone. Without the restamp this stays
    // '2026-W28' and the pod is absent from THE FIELD for the whole week it plays.
    expect(group.baseLayerWeek).not.toBe('2026-W28');
  });

  it('an ON-TIME resolution keeps the already-correct week (the restamp is not a change)', async () => {
    const onTime = currentBaseLayerWeek(LINGERED_RESOLVE);
    const db = makeTxDb(seedGroup('ontime', { baseLayerWeek: onTime }));
    await resolveUserDraftForGroup(db, 'ontime', { now: LINGERED_RESOLVE });
    expect(db.store.get('tournamentGroups/ontime').baseLayerWeek).toBe(onTime);
  });

  it('a BRACKET pod is never given a baseLayerWeek — the bracketGameId XOR is preserved', async () => {
    // createTournamentGroupDoc enforces exactly one of bracketGameId | baseLayerWeek.
    // Bracket groups resolve through this very path, so an unconditional restamp
    // would break that invariant and silently change the doc shape.
    const db = makeTxDb(seedGroup('bracket-r2-g7', { bracketGameId: 'bracket-r2-g7' }));
    await resolveUserDraftForGroup(db, 'bracket-r2-g7', { now: LINGERED_RESOLVE });

    const group = db.store.get('tournamentGroups/bracket-r2-g7');
    expect(group.status).toBe(GROUP_STATUS.BATTLE);
    expect(group.bracketGameId).toBe('bracket-r2-g7');
    expect('baseLayerWeek' in group).toBe(false);
  });

  it('an AWAITING_OPEN resolution (training on-demand) does NOT restamp — the battle has not started', async () => {
    const db = makeTxDb(seedGroup('training-pod', { baseLayerWeek: '2026-W28', isTraining: true }));
    await resolveUserDraftForGroup(db, 'training-pod', {
      now: LINGERED_RESOLVE,
      targetStatus: GROUP_STATUS.AWAITING_OPEN,
      startAnchor: { anchorEtDate: '2026-07-14', anchorIso: '2026-07-14T13:30:00.000Z' },
    });

    const group = db.store.get('tournamentGroups/training-pod');
    expect(group.status).toBe(GROUP_STATUS.AWAITING_OPEN);
    expect(group.baseLayerWeek).toBe('2026-W28'); // untouched — stamping here would be premature
    expect(group.startAnchor).toEqual({ anchorEtDate: '2026-07-14', anchorIso: '2026-07-14T13:30:00.000Z' });
  });
});
