// api/_utils/tournamentAgentDraft.test.js
//
// P3a battery for the agent draft (rider #3, agent side). Blocks: snake
// determinism (parity with the user-draft battery), the DUAL-MARKET rule
// (own player's picks draftable by the own agent ONLY — the drafted
// double-down), ledger awareness, exhaustion fallback, and the
// stream-then-acquire lifecycle with its crash-window healing.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentAgentDraft.js IS the runtime guard that its transitive import
// surface (src/constants/leagueTournament.js via the ledger module) stays
// Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  DRAFT_SENTINEL_PREFIX,
  resolveAgentSnakeDraft,
  toLedgerEntries,
  resolveAgentDraftForGroup,
} from './tournamentAgentDraft.js';
import { LEDGER_SOURCE } from '../../src/constants/leagueTournament.js';

const NOW = new Date('2026-06-15T12:00:00.000Z');

const SYMBOLS = [
  'NVDA', 'AMD', 'TSLA', 'META', 'AAPL', 'MSFT', 'AMZN', 'GOOG', 'NFLX', 'AVGO',
  'CRM', 'ORCL', 'ADBE', 'COIN', 'PLTR', 'SHOP', 'SQ', 'UBER', 'ABNB', 'SNOW',
  'DDOG', 'NET', 'MDB', 'CRWD', 'PANW', 'ZS', 'TEAM', 'NOW', 'WDAY', 'HUBS',
  'INTC', 'MU', 'QCOM', 'TXN', 'ADI', 'LRCX',
];
const STOCKS = SYMBOLS.map((symbol, i) => ({
  symbol,
  sectorName: 'Technology',
  fundamentalScore: 95 - i,
  technicalScore: 95 - i,
  baggerBombFit: 95 - i,
  atrPercentile: 0.5,
}));

const AGENTS = [
  { agentId: 'agent-a', odUserId: 'user-a' },
  { agentId: 'agent-b', odUserId: 'user-b' },
  { agentId: 'agent-c', odUserId: 'user-c' },
  { agentId: 'agent-d', odUserId: 'user-d' },
];

function pick(symbol) {
  return { symbol, legs: [{ direction: 'long', openedAt: 'x' }], flipCountToday: 0 };
}

function makeGroup(overrides = {}) {
  return {
    id: 'g1',
    status: 'battle',
    roundNumber: 1,
    baseLayerWeek: '2026-W25',
    groupMembers: ['user-a', 'user-b', 'user-c', 'user-d'],
    players: [
      { odUserId: 'user-a', picks: [pick('NVDA'), pick('AMD'), pick('TSLA')] },
      { odUserId: 'user-b', picks: [pick('META'), pick('AAPL'), pick('MSFT')] },
      { odUserId: 'user-c', picks: [pick('AMZN'), pick('GOOG'), pick('NFLX')] },
      { odUserId: 'user-d', picks: [pick('AVGO'), pick('CRM'), pick('ORCL')] },
    ],
    ...overrides,
  };
}

// Disjoint 6-deep boards drawn from the back half of the catalog — no user
// picks, no contention: everyone walks their list in order.
function disjointBoards() {
  return {
    'agent-a': { board: SYMBOLS.slice(12, 18) },
    'agent-b': { board: SYMBOLS.slice(18, 24) },
    'agent-c': { board: SYMBOLS.slice(24, 30) },
    'agent-d': { board: SYMBOLS.slice(30, 36) },
  };
}

function fallbackRankings() {
  return Object.fromEntries(AGENTS.map(a => [a.agentId, [...SYMBOLS]]));
}

const resolve = (args = {}) => resolveAgentSnakeDraft({
  group: makeGroup(),
  agents: AGENTS,
  boardsByAgent: disjointBoards(),
  heldSymbols: new Set(),
  fallbackRankingByAgent: fallbackRankings(),
  ...args,
});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ==================== SNAKE DETERMINISM ====================

describe('snake order (parity with the user-draft battery)', () => {
  it('6 rounds run fwd/rev alternating over the seats (picks 1-24)', () => {
    const { events } = resolve();
    expect(events).toHaveLength(24);
    expect(events.slice(0, 8).map(e => e.agentId)).toEqual([
      'agent-a', 'agent-b', 'agent-c', 'agent-d',
      'agent-d', 'agent-c', 'agent-b', 'agent-a',
    ]);
    expect(events.map(e => e.round)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]);
  });

  it('uncontended boards resolve in board order with no passes and no fallbacks', () => {
    const { picksByAgent, events } = resolve();
    expect(picksByAgent['agent-a']).toEqual(SYMBOLS.slice(12, 18));
    expect(picksByAgent['agent-d']).toEqual(SYMBOLS.slice(30, 36));
    expect(events.every(e => e.passedOver.length === 0 && e.fallback === false)).toBe(true);
  });

  it('24 unique names; full contention (identical boards) still yields uniqueness via snipes', () => {
    const sharedBoard = { board: SYMBOLS.slice(12, 36) }; // 24 names, no user picks
    const boards = Object.fromEntries(AGENTS.map(a => [a.agentId, sharedBoard]));
    const { picksByAgent, events } = resolve({ boardsByAgent: boards });
    const all = Object.values(picksByAgent).flat();
    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
    // The last pick walked past everyone else's takes — own picks silent.
    const last = events[23];
    const ownPicks = picksByAgent[last.agentId];
    expect(last.passedOver.every(s => !ownPicks.includes(s))).toBe(true);
    expect(last.passedOver.length).toBeGreaterThan(0);
  });
});

// ==================== DUAL MARKETS / DOUBLE-DOWN ====================

describe('the dual-market rule (Spec §1.3)', () => {
  it("an agent CAN draft its own player's user pick — the drafted double-down", () => {
    const boards = disjointBoards();
    boards['agent-a'] = { board: ['NVDA', ...SYMBOLS.slice(12, 17)] }; // NVDA = user-a's own pick
    const { picksByAgent, events } = resolve({ boardsByAgent: boards });
    expect(picksByAgent['agent-a'][0]).toBe('NVDA');
    expect(events[0]).toMatchObject({ agentId: 'agent-a', symbol: 'NVDA', boardRank: 0, fallback: false });
  });

  it("a RIVAL player's user pick is passed over, never drafted", () => {
    const boards = disjointBoards();
    boards['agent-b'] = { board: ['NVDA', ...SYMBOLS.slice(18, 23)] }; // NVDA belongs to user-a
    const { picksByAgent, events } = resolve({ boardsByAgent: boards });
    expect(picksByAgent['agent-b']).not.toContain('NVDA');
    const firstB = events.find(e => e.agentId === 'agent-b');
    expect(firstB.passedOver).toContain('NVDA');
    expect(firstB.symbol).toBe(SYMBOLS[18]);
  });

  it('own user picks stay available in the exhaustion fallback too', () => {
    const boards = disjointBoards();
    boards['agent-a'] = { board: [SYMBOLS[12]] }; // 1-deep board → exhausts in round 2
    // A ranking where user-a's own picks lead: the fallback may take NVDA.
    const rankings = fallbackRankings();
    rankings['agent-a'] = ['NVDA', ...SYMBOLS.slice(12)];
    const { picksByAgent, events } = resolve({ boardsByAgent: boards, fallbackRankingByAgent: rankings });
    expect(picksByAgent['agent-a'][1]).toBe('NVDA');
    const fallbackEvent = events.find(e => e.agentId === 'agent-a' && e.fallback);
    expect(fallbackEvent).toMatchObject({ symbol: 'NVDA', boardRank: null });
  });

  it('every rival pick everywhere: 12 user names, only own-3 ever draftable per agent', () => {
    // Boards stuffed with ALL user picks first — each agent can only ever
    // take its own three, then falls through to real names.
    const userNames = SYMBOLS.slice(0, 12);
    const boards = Object.fromEntries(AGENTS.map((a, i) => [
      a.agentId,
      { board: [...userNames, ...SYMBOLS.slice(12 + i * 6, 18 + i * 6)] },
    ]));
    const { picksByAgent } = resolve({ boardsByAgent: boards });
    const ownPicksByAgent = {
      'agent-a': ['NVDA', 'AMD', 'TSLA'],
      'agent-b': ['META', 'AAPL', 'MSFT'],
      'agent-c': ['AMZN', 'GOOG', 'NFLX'],
      'agent-d': ['AVGO', 'CRM', 'ORCL'],
    };
    for (const { agentId } of AGENTS) {
      const drafted = picksByAgent[agentId].filter(s => userNames.includes(s));
      expect(drafted).toEqual(ownPicksByAgent[agentId]);
    }
  });
});

// ==================== LEDGER AWARENESS / EXHAUSTION ====================

describe('ledger awareness + exhaustion', () => {
  it('ledger-held symbols are passed over for everyone', () => {
    const boards = disjointBoards();
    const held = new Set([SYMBOLS[12], SYMBOLS[13]]); // agent-a's top two
    const { picksByAgent, events } = resolve({ heldSymbols: held });
    void boards;
    expect(picksByAgent['agent-a'][0]).toBe(SYMBOLS[14]);
    expect(events[0].passedOver).toEqual([SYMBOLS[12], SYMBOLS[13]]);
  });

  it('board exhaustion falls back to the highest-ranked available archetype name (boardRank null, fallback true)', () => {
    const boards = disjointBoards();
    boards['agent-a'] = { board: SYMBOLS.slice(12, 14) }; // 2-deep → exhausts round 3
    const { picksByAgent, events } = resolve({ boardsByAgent: boards });
    expect(picksByAgent['agent-a']).toHaveLength(6);
    const fallbacks = events.filter(e => e.agentId === 'agent-a' && e.fallback);
    expect(fallbacks).toHaveLength(4);
    expect(fallbacks.every(e => e.boardRank === null)).toBe(true);
    // Fallback respects rival-pick + taken blocks: never a rival user name.
    const rivalNames = SYMBOLS.slice(3, 12);
    expect(picksByAgent['agent-a'].every(s => !rivalNames.includes(s))).toBe(true);
  });

  it('catalog exhaustion throws the sentinel', () => {
    const boards = disjointBoards();
    boards['agent-a'] = { board: [SYMBOLS[12]] };
    const rankings = fallbackRankings();
    rankings['agent-a'] = [SYMBOLS[12]]; // nowhere to fall
    expect(() => resolve({ boardsByAgent: boards, fallbackRankingByAgent: rankings }))
      .toThrow(`${DRAFT_SENTINEL_PREFIX}catalog_exhausted`);
  });

  it('sentinels: not_battle, boards_missing, group_not_found', () => {
    expect(() => resolve({ group: makeGroup({ status: 'forming' }) })).toThrow(`${DRAFT_SENTINEL_PREFIX}not_battle`);
    expect(() => resolve({ group: null })).toThrow(`${DRAFT_SENTINEL_PREFIX}group_not_found`);
    const boards = disjointBoards();
    boards['agent-a'] = { board: [] };
    expect(() => resolve({ boardsByAgent: boards })).toThrow(`${DRAFT_SENTINEL_PREFIX}boards_missing`);
  });
});

describe('toLedgerEntries', () => {
  it('flattens picksByAgent into reserveBulk entries', () => {
    expect(toLedgerEntries({ a: ['X', 'Y'], b: ['Z'] })).toEqual([
      { symbol: 'X', agentId: 'a' },
      { symbol: 'Y', agentId: 'a' },
      { symbol: 'Z', agentId: 'b' },
    ]);
  });
});

// ==================== HANDLER LIFECYCLE (stream -> acquire) ====================

// In-memory Firestore with MUTABLE store + commit-on-success transactions
// (the P2 idiom), extended with subcollection listing for the boards read.
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial));

  function makeDocRef(path) {
    return {
      path,
      get: async () => {
        const data = store.get(path);
        return { exists: data !== undefined, id: path.split('/').pop(), data: () => data };
      },
      set: async (data) => { store.set(path, data); },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }

  function makeCollection(prefix) {
    return {
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      get: async () => {
        const docs = [];
        for (const [path, data] of store.entries()) {
          if (!path.startsWith(`${prefix}/`)) continue;
          const rel = path.slice(prefix.length + 1);
          if (rel.includes('/')) continue;
          docs.push({ id: rel, data: () => data });
        }
        return { docs, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
      },
    };
  }

  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => {
      const writes = [];
      const tx = {
        get: async (ref) => ref.get(),
        set: (ref, data) => { writes.push([ref.path, data]); },
      };
      const result = await fn(tx);
      for (const [path, data] of writes) store.set(path, data);
      return result;
    },
  };

  return { db, store };
}

function boardDoc(agentId, odUserId, board, archetype = 'analyst') {
  return { agentId, odUserId, archetype, board, fallback: false };
}

function seededDraftDb() {
  const boards = disjointBoards();
  return makeDb({
    'indexIntelligence/stockRankings': { stocks: STOCKS },
    'tournamentGroups/g1/agentBoards/agent-a': boardDoc('agent-a', 'user-a', boards['agent-a'].board),
    'tournamentGroups/g1/agentBoards/agent-b': boardDoc('agent-b', 'user-b', boards['agent-b'].board),
    'tournamentGroups/g1/agentBoards/agent-c': boardDoc('agent-c', 'user-c', boards['agent-c'].board),
    'tournamentGroups/g1/agentBoards/agent-d': boardDoc('agent-d', 'user-d', boards['agent-d'].board),
  });
}

const STREAM_PATH = 'tournamentGroups/g1/streams/agentDraft';
const LEDGER_PATH = 'tournamentGroups/g1/ledger/agentHeldSet';

describe('resolveAgentDraftForGroup', () => {
  it('resolves, writes the stream (rider #3), then lands all 24 as held/draft', async () => {
    const { db, store } = seededDraftDb();
    const result = await resolveAgentDraftForGroup(db, makeGroup(), { now: NOW });
    expect(result.status).toBe('resolved');
    expect(result.heldCount).toBe(24);

    const stream = store.get(STREAM_PATH);
    expect(stream.events).toHaveLength(24);
    expect(stream.picksByAgent['agent-a']).toEqual(SYMBOLS.slice(12, 18));
    expect(stream.roundNumber).toBe(1);
    expect(stream.baseLayerWeek).toBe('2026-W25');
    expect(stream.resolvedAt).toBe(NOW.toISOString());

    const ledger = store.get(LEDGER_PATH);
    expect(Object.keys(ledger.held)).toHaveLength(24);
    expect(ledger.held[SYMBOLS[12]]).toMatchObject({ heldBy: 'agent-a', source: LEDGER_SOURCE.DRAFT });
    expect(ledger.held[SYMBOLS[30]]).toMatchObject({ heldBy: 'agent-d', source: LEDGER_SOURCE.DRAFT });
  });

  it('is idempotent: a second call never re-resolves, just re-ensures acquisition', async () => {
    const { db, store } = seededDraftDb();
    await resolveAgentDraftForGroup(db, makeGroup(), { now: NOW });
    const streamBefore = store.get(STREAM_PATH);
    const second = await resolveAgentDraftForGroup(db, makeGroup(), { now: new Date(NOW.getTime() + 60_000) });
    expect(second).toMatchObject({ status: 'already_resolved', ensured: true, heldCount: 24 });
    expect(store.get(STREAM_PATH)).toBe(streamBefore); // untouched, not rewritten
  });

  it('heals the crash window: stream written but acquisition lost -> re-run lands the ledger', async () => {
    const { db, store } = seededDraftDb();
    await resolveAgentDraftForGroup(db, makeGroup(), { now: NOW });
    store.delete(LEDGER_PATH); // simulate the crash between stream and reserveBulk
    const healed = await resolveAgentDraftForGroup(db, makeGroup(), { now: NOW });
    expect(healed).toMatchObject({ status: 'already_resolved', ensured: true, heldCount: 24 });
    expect(Object.keys(store.get(LEDGER_PATH).held)).toHaveLength(24);
  });

  it('respects pre-held ledger symbols at resolution time', async () => {
    const { db, store } = seededDraftDb();
    store.set(LEDGER_PATH, {
      held: { [SYMBOLS[12]]: { heldBy: 'agent-x', since: NOW.toISOString(), source: 'swap' } },
      reservations: {},
      doubleDowns: [],
      updatedAt: NOW.toISOString(),
    });
    const result = await resolveAgentDraftForGroup(db, makeGroup(), { now: NOW });
    expect(result.status).toBe('resolved');
    expect(result.picksByAgent['agent-a']).not.toContain(SYMBOLS[12]);
    const stream = store.get(STREAM_PATH);
    expect(stream.events[0].passedOver).toContain(SYMBOLS[12]);
  });

  it('surfaces an acquisition conflict instead of retrying blindly', async () => {
    const { db, store } = seededDraftDb();
    // A rival holder appears for a symbol the draft will assign to agent-a.
    // resolveAgentSnakeDraft skips held symbols, so to force the conflict we
    // pre-write the STREAM (as if resolved before the rival landed) and let
    // the ensure-acquisition path hit the conflict.
    store.set(STREAM_PATH, {
      events: [],
      picksByAgent: { 'agent-a': [SYMBOLS[12]] },
      roundNumber: 1,
      baseLayerWeek: '2026-W25',
      resolvedAt: NOW.toISOString(),
    });
    store.set(LEDGER_PATH, {
      held: { [SYMBOLS[12]]: { heldBy: 'agent-rival', since: NOW.toISOString(), source: 'swap' } },
      reservations: {},
      doubleDowns: [],
      updatedAt: NOW.toISOString(),
    });
    const result = await resolveAgentDraftForGroup(db, makeGroup(), { now: NOW });
    expect(result.status).toBe('acquisition_conflict');
    expect(result.conflicts).toEqual([{ symbol: SYMBOLS[12], reason: 'held', heldBy: 'agent-rival' }]);
  });

  it('throws boards_missing when any member lacks an agent board', async () => {
    const { db, store } = seededDraftDb();
    store.delete('tournamentGroups/g1/agentBoards/agent-c');
    await expect(resolveAgentDraftForGroup(db, makeGroup(), { now: NOW }))
      .rejects.toThrow(`${DRAFT_SENTINEL_PREFIX}boards_missing`);
  });

  it('throws not_battle on a forming group', async () => {
    const { db } = seededDraftDb();
    await expect(resolveAgentDraftForGroup(db, makeGroup({ status: 'forming' }), { now: NOW }))
      .rejects.toThrow(`${DRAFT_SENTINEL_PREFIX}not_battle`);
  });
});
