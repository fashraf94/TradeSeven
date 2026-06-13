// api/_utils/tournamentAgentLedger.test.js
//
// P2 battery for the agent held-set ledger (Spec §1.2). The headline block
// is REGULAR-BATTLE INVARIANCE — the phase's governing rule: a non-tournament
// battle must trigger zero ledger I/O and identity-pass every filter seam.
// Then: reserve/confirm/release semantics (contention, compensating release,
// stale-reservation TTL + hardening), bulk acquisition, double-down
// detection, and the nightly derived reconciliation.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentAgentLedger.js IS the runtime guard that its transitive import
// surface (src/constants/leagueTournament.js, agentScoring.js) stays
// Node-clean. Never mock that import.
//
// The in-memory Firestore mock extends the P1b makeDb idiom
// (tournamentBanking.test.js / tournamentClaims.test.js) with a path-keyed
// MUTABLE store and commit-on-success transaction semantics, so sequential
// transactions observe each other's writes — which is what makes the
// contention assertions ("two agents reserve the same symbol — exactly one
// wins") real rather than vacuous.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  RESERVATION_TTL_MS,
  DOUBLE_DOWN_EVENTS_CAP,
  ledgerRef,
  readLedger,
  isReservationStale,
  buildHeldByOthers,
  excludeHeldByOthers,
  excludeHeldSymbols,
  getOwnUserPicks,
  detectDoubleDownEvents,
  detectUserDoubleDownEvents,
  buildOwnerAgentMap,
  resolveTournamentContext,
  reserveSymbol,
  confirmSwap,
  releaseReservation,
  reserveBulk,
  reconcileGroupLedger,
  reconcileAllTournamentLedgers,
} from './tournamentAgentLedger.js';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

const NOW = new Date('2026-06-15T15:00:00.000Z');
const NOW_ISO = NOW.toISOString();
const FRESH_AT = new Date(NOW.getTime() - 60_000).toISOString(); // 1 min old
const STALE_AT = new Date(NOW.getTime() - RESERVATION_TTL_MS - 1).toISOString();

const LEDGER_PATH = 'tournamentGroups/g1/ledger/agentHeldSet';

// ==================== IN-MEMORY FIRESTORE ====================

function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const reads = [];

  function makeDocRef(path) {
    return {
      path,
      get: async () => {
        reads.push(path);
        const data = store.get(path);
        return { exists: data !== undefined, id: path.split('/').pop(), data: () => data };
      },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }

  function makeCollection(prefix) {
    return {
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      where: (field, op, value) => {
        const runQuery = async () => {
          const docs = [];
          for (const [path, data] of store.entries()) {
            if (!path.startsWith(`${prefix}/`)) continue;
            const rel = path.slice(prefix.length + 1);
            if (rel.includes('/')) continue; // direct children only
            if (op === '==' && data?.[field] === value) {
              docs.push({ id: rel, data: () => data });
            }
          }
          return { docs, forEach: (cb) => docs.forEach(cb) };
        };
        // select() is a field-mask hint — the fake returns full docs, which
        // is a superset of any projection and keeps assertions honest.
        return { get: runQuery, select: () => ({ get: runQuery }) };
      },
    };
  }

  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => {
      const writes = [];
      const tx = {
        get: async (ref) => ref.get(),
        set: (_ref, data) => { writes.push([_ref.path, data]); },
        update: (_ref, data) => { writes.push([_ref.path, { ...(store.get(_ref.path) || {}), ...data }]); },
      };
      const result = await fn(tx);
      for (const [path, data] of writes) store.set(path, data);
      return result;
    },
  };

  return { db, store, reads };
}

// A db whose every entry point throws — proof of zero I/O on the regular path.
function makeThrowingDb() {
  return {
    collection: () => { throw new Error('Firestore touched for a non-tournament battle'); },
    runTransaction: () => { throw new Error('Firestore touched for a non-tournament battle'); },
  };
}

// ==================== FIXTURES ====================

function makeLeg({ direction = 'long', closedAt } = {}) {
  const leg = { direction, baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: NOW_ISO, thresholdHistory: [] };
  if (closedAt) leg.closedAt = closedAt;
  return leg;
}

function makeGroup(overrides = {}) {
  return {
    status: 'battle',
    groupMembers: ['user-a', 'user-b', 'user-c', 'user-d'],
    players: [
      { odUserId: 'user-a', picks: [{ symbol: 'NVDA', legs: [makeLeg()], flipCountToday: 0 }] },
      { odUserId: 'user-b', picks: [{ symbol: 'COIN', legs: [makeLeg()], flipCountToday: 0 }] },
      { odUserId: 'user-c', picks: [] },
      { odUserId: 'user-d', picks: [] },
    ],
    ...overrides,
  };
}

function makeTournamentBattle(overrides = {}) {
  return {
    id: 'battle-1',
    gameMode: TOURNAMENT_GAME_MODE,
    groupId: 'g1',
    agentId: 'agent-1',
    ownerId: 'user-a',
    ...overrides,
  };
}

function makeLedgerDoc({ held = {}, reservations = {}, doubleDowns = [] } = {}) {
  return { held, reservations, doubleDowns, updatedAt: NOW_ISO };
}

function makePortfolio(symbols) {
  // flattenPortfolioServer reads star/core/support arrays.
  return {
    star: symbols.slice(0, 2).map(symbol => ({ symbol, baseATR: 2.5 })),
    core: symbols.slice(2, 4).map(symbol => ({ symbol, baseATR: 2.5 })),
    support: symbols.slice(4).map(symbol => ({ symbol, baseATR: 2.5 })),
    bench: { stocks: [], crypto: null },
  };
}

let warnSpy;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ==================== REGULAR-BATTLE INVARIANCE ====================
//
// P2's equivalent of the tiered-mode byte-identical invariant. Non-tournament
// battles must (a) resolve to null BEFORE any Firestore access and (b) pass
// every filter seam untouched — same references out, zero reads.

describe('REGULAR-BATTLE INVARIANCE — the P2 governing rule', () => {
  it('a regular battle (gameMode baggerbomb_agent) resolves to null with ZERO Firestore I/O', async () => {
    const battle = { id: 'b1', gameMode: 'baggerbomb_agent', agentId: 'agent-1', ownerId: 'user-a' };
    expect(await resolveTournamentContext(makeThrowingDb(), battle)).toBeNull();
  });

  it('missing gameMode, missing groupId, empty groupId — all null, all zero-I/O', async () => {
    const throwingDb = makeThrowingDb();
    expect(await resolveTournamentContext(throwingDb, { id: 'b1', agentId: 'a', ownerId: 'u' })).toBeNull();
    expect(await resolveTournamentContext(throwingDb, { id: 'b1', gameMode: TOURNAMENT_GAME_MODE, agentId: 'a', ownerId: 'u' })).toBeNull();
    expect(await resolveTournamentContext(throwingDb, { id: 'b1', gameMode: TOURNAMENT_GAME_MODE, groupId: '', agentId: 'a', ownerId: 'u' })).toBeNull();
    expect(await resolveTournamentContext(throwingDb, null)).toBeNull();
  });

  it('a tournament stamp without an agentId fails safe (null) without ledger I/O', async () => {
    const battle = makeTournamentBattle({ agentId: undefined });
    expect(await resolveTournamentContext(makeThrowingDb(), battle)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('excludeHeldByOthers is an IDENTITY on the regular path: same reference back', () => {
    const assets = [{ symbol: 'AMD' }, { symbol: 'TSLA' }];
    expect(excludeHeldByOthers(assets, null)).toBe(assets);
    expect(excludeHeldByOthers(assets, undefined)).toBe(assets);
    expect(excludeHeldByOthers(assets, new Set())).toBe(assets);
    // No overlap → still the same reference (no copy, no churn).
    expect(excludeHeldByOthers(assets, new Set(['NVDA']))).toBe(assets);
    const notArray = undefined;
    expect(excludeHeldByOthers(notArray, new Set(['NVDA']))).toBe(notArray);
  });

  it('excludeHeldSymbols (the watchlist.hotBench seam) is the same identity contract for string arrays', () => {
    const symbols = ['AMD', 'TSLA'];
    expect(excludeHeldSymbols(symbols, null)).toBe(symbols);
    expect(excludeHeldSymbols(symbols, new Set())).toBe(symbols);
    expect(excludeHeldSymbols(symbols, new Set(['NVDA']))).toBe(symbols); // no overlap — same reference
    expect(excludeHeldSymbols(symbols, new Set(['TSLA']))).toEqual(['AMD']);
    expect(excludeHeldSymbols(undefined, new Set(['TSLA']))).toBeUndefined();
  });

  it('malformed stamps fail SAFE toward regular behavior: missing group / wrong status / non-member owner', async () => {
    const battle = makeTournamentBattle();

    const missing = makeDb({});
    expect(await resolveTournamentContext(missing.db, battle)).toBeNull();

    const forming = makeDb({ 'tournamentGroups/g1': makeGroup({ status: 'forming' }) });
    expect(await resolveTournamentContext(forming.db, battle)).toBeNull();

    const stranger = makeDb({ 'tournamentGroups/g1': makeGroup({ groupMembers: ['user-x', 'user-y', 'user-z', 'user-w'] }) });
    expect(await resolveTournamentContext(stranger.db, battle)).toBeNull();

    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
});

// ==================== RESOLVER (TOURNAMENT PATH) ====================

describe('resolveTournamentContext — tournament battles', () => {
  it('resolves group, held-by-others, and own user picks', async () => {
    const { db } = makeDb({
      'tournamentGroups/g1': makeGroup(),
      [LEDGER_PATH]: makeLedgerDoc({
        held: {
          AMD: { heldBy: 'agent-1', since: NOW_ISO, source: 'draft' },   // own — excluded
          TSLA: { heldBy: 'agent-2', since: NOW_ISO, source: 'draft' },  // rival — included
        },
        reservations: {
          MSFT: { by: 'agent-3', battleId: 'b3', at: new Date().toISOString() }, // fresh rival — included
        },
      }),
    });

    const ctx = await resolveTournamentContext(db, makeTournamentBattle());
    expect(ctx.groupId).toBe('g1');
    expect(ctx.agentId).toBe('agent-1');
    expect(ctx.odUserId).toBe('user-a');
    expect(ctx.heldByOthers.has('TSLA')).toBe(true);
    expect(ctx.heldByOthers.has('MSFT')).toBe(true);
    expect(ctx.heldByOthers.has('AMD')).toBe(false);
    // Shape lock: the group doc and user picks are deliberately NOT on the
    // context — confirmSwap re-reads picks fresh at confirm time so a
    // mid-invocation flip can't stamp a stale direction (review fix).
    expect('group' in ctx).toBe(false);
    expect('ownUserPicks' in ctx).toBe(false);
  });

  it('memoizes the group read per invocation, but reads the ledger fresh per battle', async () => {
    const { db, reads } = makeDb({
      'tournamentGroups/g1': makeGroup(),
      [LEDGER_PATH]: makeLedgerDoc(),
    });
    const cache = new Map();
    await resolveTournamentContext(db, makeTournamentBattle(), cache);
    await resolveTournamentContext(db, makeTournamentBattle({ id: 'battle-2', agentId: 'agent-2', ownerId: 'user-b' }), cache);
    expect(reads.filter(p => p === 'tournamentGroups/g1')).toHaveLength(1);
    expect(reads.filter(p => p === LEDGER_PATH)).toHaveLength(2);
  });
});

// ==================== PURE HELPERS ====================

describe('buildHeldByOthers', () => {
  it('rival holds + fresh rival reservations in; own anything + stale rival reservations out', () => {
    const ledger = makeLedgerDoc({
      held: {
        AMD: { heldBy: 'agent-1', since: NOW_ISO, source: 'swap' },
        TSLA: { heldBy: 'agent-2', since: NOW_ISO, source: 'swap' },
      },
      reservations: {
        MSFT: { by: 'agent-2', battleId: 'b2', at: FRESH_AT },
        META: { by: 'agent-3', battleId: 'b3', at: STALE_AT },
        NFLX: { by: 'agent-1', battleId: 'b1', at: FRESH_AT },
      },
    });
    const set = buildHeldByOthers(ledger, 'agent-1', NOW.getTime());
    expect([...set].sort()).toEqual(['MSFT', 'TSLA']);
  });

  it('empty/missing ledger → empty set', () => {
    expect(buildHeldByOthers(null, 'agent-1').size).toBe(0);
    expect(buildHeldByOthers({}, 'agent-1').size).toBe(0);
  });
});

describe('isReservationStale', () => {
  it('fresh under the TTL, stale at/over it, stale on malformed timestamps', () => {
    expect(isReservationStale({ at: FRESH_AT }, NOW.getTime())).toBe(false);
    expect(isReservationStale({ at: STALE_AT }, NOW.getTime())).toBe(true);
    expect(isReservationStale({ at: new Date(NOW.getTime() - RESERVATION_TTL_MS).toISOString() }, NOW.getTime())).toBe(true);
    expect(isReservationStale({ at: 'garbage' }, NOW.getTime())).toBe(true);
    expect(isReservationStale({}, NOW.getTime())).toBe(true);
  });
});

describe('getOwnUserPicks', () => {
  it('reads the LIVE leg direction (a flipped pick reports the open leg, not the closed one)', () => {
    const group = makeGroup({
      players: [{
        odUserId: 'user-a',
        picks: [{
          symbol: 'NVDA',
          legs: [makeLeg({ direction: 'long', closedAt: NOW_ISO }), makeLeg({ direction: 'short' })],
          flipCountToday: 1,
        }],
      }],
    });
    expect(getOwnUserPicks(group, 'user-a')).toEqual([{ symbol: 'NVDA', direction: 'short' }]);
  });

  it('unknown player or absent picks → empty', () => {
    expect(getOwnUserPicks(makeGroup(), 'user-zz')).toEqual([]);
    expect(getOwnUserPicks(null, 'user-a')).toEqual([]);
  });
});

describe('detectDoubleDownEvents', () => {
  const ownUserPicks = [{ symbol: 'NVDA', direction: 'long' }, { symbol: 'COIN', direction: 'short' }];
  const base = { ownUserPicks, agentId: 'agent-1', odUserId: 'user-a', now: NOW };

  it('formed when symbolIn ∈ own picks — carries the user leg direction', () => {
    const events = detectDoubleDownEvents({ ...base, symbolIn: 'NVDA', symbolOut: 'AMD' });
    expect(events).toEqual([{ kind: 'formed', symbol: 'NVDA', agentId: 'agent-1', odUserId: 'user-a', userDirection: 'long', at: NOW_ISO }]);
  });

  it('broken when symbolOut ∈ own picks', () => {
    const events = detectDoubleDownEvents({ ...base, symbolIn: 'AMD', symbolOut: 'COIN' });
    expect(events).toEqual([{ kind: 'broken', symbol: 'COIN', agentId: 'agent-1', odUserId: 'user-a', userDirection: 'short', at: NOW_ISO }]);
  });

  it('both, neither, and the degenerate symbolIn === symbolOut', () => {
    expect(detectDoubleDownEvents({ ...base, symbolIn: 'NVDA', symbolOut: 'COIN' })).toHaveLength(2);
    expect(detectDoubleDownEvents({ ...base, symbolIn: 'AMD', symbolOut: 'TSLA' })).toEqual([]);
    expect(detectDoubleDownEvents({ ...base, symbolIn: 'NVDA', symbolOut: 'NVDA' })).toHaveLength(1);
    expect(detectDoubleDownEvents({ symbolIn: 'NVDA', symbolOut: null, ownUserPicks: [], agentId: 'a', odUserId: 'u', now: NOW })).toEqual([]);
  });
});

describe('detectUserDoubleDownEvents — the user-side mirror (D-1, June 12, 2026)', () => {
  // NVDA held by the user's OWN agent; COIN held by a RIVAL agent.
  const held = { NVDA: { heldBy: 'agent-mine' }, COIN: { heldBy: 'agent-rival' } };
  const base = { ownAgentId: 'agent-mine', held, odUserId: 'user-a', now: NOW };

  it('FLIPPED: a flip on a symbol my own agent holds carries side:user + from/to', () => {
    const events = detectUserDoubleDownEvents({ ...base, candidates: [{ symbol: 'NVDA', kind: 'flipped', userDirection: 'short', from: 'long', to: 'short' }] });
    expect(events).toEqual([{ kind: 'flipped', side: 'user', symbol: 'NVDA', agentId: 'agent-mine', odUserId: 'user-a', userDirection: 'short', from: 'long', to: 'short', at: NOW_ISO }]);
  });

  it('FORMED on a claimed name, BROKEN on a dropped name — both against my own agent', () => {
    const events = detectUserDoubleDownEvents({ ...base, candidates: [
      { symbol: 'NVDA', kind: 'formed', userDirection: 'long' },
      { symbol: 'AMD', kind: 'broken', userDirection: 'long' }, // AMD not held → no event
    ] });
    expect(events).toEqual([{ kind: 'formed', side: 'user', symbol: 'NVDA', agentId: 'agent-mine', odUserId: 'user-a', userDirection: 'long', at: NOW_ISO }]);
  });

  it('CROSS-MARKET GUARD: a symbol held by a RIVAL agent is never a double-down', () => {
    expect(detectUserDoubleDownEvents({ ...base, candidates: [{ symbol: 'COIN', kind: 'formed', userDirection: 'long' }] })).toEqual([]);
  });

  it('PRE-DRAFT ABSENCE: no resolved own agent, or an empty held set, yields zero events', () => {
    const cand = [{ symbol: 'NVDA', kind: 'formed', userDirection: 'long' }];
    expect(detectUserDoubleDownEvents({ ...base, ownAgentId: null, candidates: cand })).toEqual([]);
    expect(detectUserDoubleDownEvents({ ...base, held: {}, candidates: cand })).toEqual([]);
    expect(detectUserDoubleDownEvents({ ...base, candidates: null })).toEqual([]);
  });
});

describe('buildOwnerAgentMap — odUserId → agentId from the immutable stream', () => {
  it('first-seen wins per user; tolerant of partial/empty events', () => {
    const stream = { events: [
      { odUserId: 'user-a', agentId: 'agent-a', symbol: 'NVDA' },
      { odUserId: 'user-b', agentId: 'agent-b', symbol: 'AMD' },
      { odUserId: 'user-a', agentId: 'agent-a', symbol: 'COIN' }, // dup — ignored
      { odUserId: 'user-c' }, // no agentId — skipped
    ] };
    expect(buildOwnerAgentMap(stream)).toEqual({ 'user-a': 'agent-a', 'user-b': 'agent-b' });
    expect(buildOwnerAgentMap(null)).toEqual({});
    expect(buildOwnerAgentMap({ events: [] })).toEqual({});
  });
});

// ==================== RESERVE / CONFIRM / RELEASE ====================

describe('reserveSymbol — the transactional claim', () => {
  it('reserves a free symbol', async () => {
    const { db, store } = makeDb({ [LEDGER_PATH]: makeLedgerDoc() });
    const result = await reserveSymbol(db, { groupId: 'g1', symbol: 'AMD', agentId: 'agent-1', battleId: 'b1', now: NOW });
    expect(result).toEqual({ reserved: true });
    expect(store.get(LEDGER_PATH).reservations.AMD).toEqual({ by: 'agent-1', battleId: 'b1', at: NOW_ISO });
  });

  it('creates the ledger doc on first reserve (pre-Monday dev state)', async () => {
    const { db, store } = makeDb({});
    const result = await reserveSymbol(db, { groupId: 'g1', symbol: 'AMD', agentId: 'agent-1', battleId: 'b1', now: NOW });
    expect(result.reserved).toBe(true);
    expect(store.get(LEDGER_PATH).held).toEqual({});
  });

  it('CONTENTION: two agents reserve the same symbol — exactly one wins', async () => {
    const { db, store } = makeDb({ [LEDGER_PATH]: makeLedgerDoc() });
    const first = await reserveSymbol(db, { groupId: 'g1', symbol: 'AMD', agentId: 'agent-1', battleId: 'b1', now: NOW });
    const second = await reserveSymbol(db, { groupId: 'g1', symbol: 'AMD', agentId: 'agent-2', battleId: 'b2', now: NOW });
    expect(first.reserved).toBe(true);
    expect(second).toEqual({ reserved: false, reason: 'reserved', heldBy: 'agent-1' });
    expect(store.get(LEDGER_PATH).reservations.AMD.by).toBe('agent-1');
  });

  it('fails on a symbol held by a rival — and on one held by the agent ITSELF (within-agent duplicates stay forbidden)', async () => {
    const { db } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({ held: { TSLA: { heldBy: 'agent-2', since: NOW_ISO, source: 'draft' } } }),
    });
    expect(await reserveSymbol(db, { groupId: 'g1', symbol: 'TSLA', agentId: 'agent-1', battleId: 'b1', now: NOW }))
      .toEqual({ reserved: false, reason: 'held', heldBy: 'agent-2' });
    expect(await reserveSymbol(db, { groupId: 'g1', symbol: 'TSLA', agentId: 'agent-2', battleId: 'b2', now: NOW }))
      .toEqual({ reserved: false, reason: 'already_held_self', heldBy: 'agent-2' });
  });

  it('claims over a STALE rival reservation (TTL elapsed — no symbol can deadlock)', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({ reservations: { AMD: { by: 'agent-2', battleId: 'b-crashed', at: STALE_AT } } }),
      'agentBattles/b-crashed': { portfolio: makePortfolio(['XOM', 'CVX']) }, // symbol did NOT land
    });
    const result = await reserveSymbol(db, { groupId: 'g1', symbol: 'AMD', agentId: 'agent-1', battleId: 'b1', now: NOW });
    expect(result.reserved).toBe(true);
    expect(store.get(LEDGER_PATH).reservations.AMD.by).toBe('agent-1');
  });

  it('HARDENING: a stale reservation whose swap actually landed converts to held — the claim is refused', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({ reservations: { AMD: { by: 'agent-2', battleId: 'b-crashed', at: STALE_AT } } }),
      'agentBattles/b-crashed': { portfolio: makePortfolio(['AMD', 'XOM']) }, // crashed AFTER the swap executed
    });
    const result = await reserveSymbol(db, { groupId: 'g1', symbol: 'AMD', agentId: 'agent-1', battleId: 'b1', now: NOW });
    expect(result).toEqual({ reserved: false, reason: 'held', heldBy: 'agent-2' });
    const ledger = store.get(LEDGER_PATH);
    expect(ledger.held.AMD).toEqual({ heldBy: 'agent-2', since: NOW_ISO, source: 'swap' });
    expect(ledger.reservations.AMD).toBeUndefined();
  });
});

describe('confirmSwap — finalize symbolIn, release symbolOut', () => {
  it('writes the held entry (source swap), clears the reservation, releases symbolOut to the pool', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({
        held: { TSLA: { heldBy: 'agent-1', since: '2026-06-15T13:30:00.000Z', source: 'draft' } },
        reservations: { AMD: { by: 'agent-1', battleId: 'b1', at: FRESH_AT } },
      }),
    });
    const result = await confirmSwap(db, {
      groupId: 'g1', symbolIn: 'AMD', symbolOut: 'TSLA', agentId: 'agent-1', battleId: 'b1', now: NOW,
      odUserId: 'user-a', // no group doc seeded → fresh read yields no picks (clean no-event path)
    });
    expect(result.confirmed).toBe(true);
    const ledger = store.get(LEDGER_PATH);
    expect(ledger.held.AMD).toEqual({ heldBy: 'agent-1', since: NOW_ISO, source: 'swap' });
    expect(ledger.held.TSLA).toBeUndefined();
    expect(ledger.reservations.AMD).toBeUndefined();
  });

  it('emits + persists double-down events atomically with the held-set change — picks read FRESH from the group at confirm time', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc(),
      'tournamentGroups/g1': makeGroup({
        players: [{
          odUserId: 'user-a',
          picks: [
            { symbol: 'NVDA', legs: [makeLeg({ direction: 'long' })], flipCountToday: 0 },
            // Flipped mid-invocation: closed long leg + live short leg — the
            // event must carry the CURRENT (short) direction.
            { symbol: 'COIN', legs: [makeLeg({ direction: 'long', closedAt: NOW_ISO }), makeLeg({ direction: 'short' })], flipCountToday: 1 },
          ],
        }],
      }),
    });
    const result = await confirmSwap(db, {
      groupId: 'g1', symbolIn: 'NVDA', symbolOut: 'COIN', agentId: 'agent-1', battleId: 'b1', now: NOW,
      odUserId: 'user-a',
    });
    expect(result.events.map(e => e.kind)).toEqual(['formed', 'broken']);
    expect(result.events[0].userDirection).toBe('long');
    expect(result.events[1].userDirection).toBe('short'); // the post-flip live leg, not the stale one
    expect(store.get(LEDGER_PATH).doubleDowns).toEqual(result.events);
  });

  it('caps the doubleDowns list', async () => {
    const existing = Array.from({ length: DOUBLE_DOWN_EVENTS_CAP }, (_, i) => ({ kind: 'formed', symbol: `S${i}` }));
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({ doubleDowns: existing }),
      'tournamentGroups/g1': makeGroup(), // user-a holds NVDA in the default fixture
    });
    await confirmSwap(db, {
      groupId: 'g1', symbolIn: 'NVDA', symbolOut: 'AMD', agentId: 'agent-1', battleId: 'b1', now: NOW,
      odUserId: 'user-a',
    });
    const list = store.get(LEDGER_PATH).doubleDowns;
    expect(list).toHaveLength(DOUBLE_DOWN_EVENTS_CAP);
    expect(list[list.length - 1].symbol).toBe('NVDA');
  });

  it('anomalies resolve toward what actually happened, loudly: rival-held symbolIn overwritten, foreign symbolOut left', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({
        held: {
          AMD: { heldBy: 'agent-9', since: NOW_ISO, source: 'swap' },
          TSLA: { heldBy: 'agent-9', since: NOW_ISO, source: 'swap' },
        },
      }),
    });
    await confirmSwap(db, { groupId: 'g1', symbolIn: 'AMD', symbolOut: 'TSLA', agentId: 'agent-1', battleId: 'b1', now: NOW });
    const ledger = store.get(LEDGER_PATH);
    expect(ledger.held.AMD.heldBy).toBe('agent-1');
    expect(ledger.held.TSLA.heldBy).toBe('agent-9'); // not ours to release
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

describe('releaseReservation — the compensating action', () => {
  it('releases own reservation; never a rival\'s; no-ops idempotently on missing state', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({
        reservations: {
          AMD: { by: 'agent-1', battleId: 'b1', at: FRESH_AT },
          TSLA: { by: 'agent-2', battleId: 'b2', at: FRESH_AT },
        },
      }),
    });
    expect((await releaseReservation(db, { groupId: 'g1', symbol: 'AMD', agentId: 'agent-1', now: NOW })).released).toBe(true);
    expect((await releaseReservation(db, { groupId: 'g1', symbol: 'TSLA', agentId: 'agent-1', now: NOW })).released).toBe(false);
    expect((await releaseReservation(db, { groupId: 'g1', symbol: 'AMD', agentId: 'agent-1', now: NOW })).released).toBe(false);
    const ledger = store.get(LEDGER_PATH);
    expect(ledger.reservations.AMD).toBeUndefined();
    expect(ledger.reservations.TSLA.by).toBe('agent-2');
  });

  it('no-ops when the ledger doc does not exist', async () => {
    const { db, store } = makeDb({});
    expect((await releaseReservation(db, { groupId: 'g1', symbol: 'AMD', agentId: 'agent-1', now: NOW })).released).toBe(false);
    expect(store.has(LEDGER_PATH)).toBe(false);
  });
});

// ==================== BULK ACQUISITION (P3 CONSUMES) ====================

describe('reserveBulk — the Monday acquisition', () => {
  const entries = [
    { symbol: 'AMD', agentId: 'agent-1' },
    { symbol: 'TSLA', agentId: 'agent-1' },
    { symbol: 'MSFT', agentId: 'agent-2' },
  ];

  it('registers every entry as held (source draft) atomically', async () => {
    const { db, store } = makeDb({});
    const result = await reserveBulk(db, { groupId: 'g1', entries, now: NOW });
    expect(result).toEqual({ reserved: true, count: 3 });
    const held = store.get(LEDGER_PATH).held;
    expect(held.AMD).toEqual({ heldBy: 'agent-1', since: NOW_ISO, source: 'draft' });
    expect(held.MSFT.heldBy).toBe('agent-2');
  });

  it('ALL-OR-NOTHING: one conflicting symbol fails the whole batch with zero writes', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({ held: { TSLA: { heldBy: 'agent-9', since: NOW_ISO, source: 'swap' } } }),
    });
    const result = await reserveBulk(db, { groupId: 'g1', entries, now: NOW });
    expect(result.reserved).toBe(false);
    expect(result.conflicts).toEqual([{ symbol: 'TSLA', reason: 'held', heldBy: 'agent-9' }]);
    expect(store.get(LEDGER_PATH).held.AMD).toBeUndefined();
  });

  it('a fresh rival reservation conflicts; re-running an identical bulk is idempotent (provenance preserved)', async () => {
    const { db } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({ reservations: { MSFT: { by: 'agent-9', battleId: 'b9', at: FRESH_AT } } }),
    });
    expect((await reserveBulk(db, { groupId: 'g1', entries, now: NOW })).reserved).toBe(false);

    const clean = makeDb({});
    await reserveBulk(clean.db, { groupId: 'g1', entries, now: NOW });
    const firstSince = clean.store.get(LEDGER_PATH).held.AMD.since;
    await reserveBulk(clean.db, { groupId: 'g1', entries, now: new Date(NOW.getTime() + 5_000) });
    expect(clean.store.get(LEDGER_PATH).held.AMD.since).toBe(firstSince);
  });

  it('rejects malformed input: empty, shapeless, duplicate symbols', async () => {
    const { db } = makeDb({});
    await expect(reserveBulk(db, { groupId: 'g1', entries: [], now: NOW })).rejects.toThrow(/non-empty/);
    await expect(reserveBulk(db, { groupId: 'g1', entries: [{ symbol: 'AMD' }], now: NOW })).rejects.toThrow(/agentId/);
    await expect(reserveBulk(db, {
      groupId: 'g1',
      entries: [{ symbol: 'AMD', agentId: 'a1' }, { symbol: 'AMD', agentId: 'a2' }],
      now: NOW,
    })).rejects.toThrow(/duplicate/);
  });
});

// ==================== NIGHTLY DERIVED RECONCILIATION ====================

describe('reconcileGroupLedger — derived rebuild', () => {
  const group = { id: 'g1', ...makeGroup() };

  it('repairs both divergence directions to the derived truth and preserves provenance on agreement', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({
        held: {
          AMD: { heldBy: 'agent-1', since: '2026-06-15T13:30:00.000Z', source: 'draft' }, // agrees — keep provenance
          GHOST: { heldBy: 'agent-1', since: NOW_ISO, source: 'swap' },                   // ledger-only — removed
          TSLA: { heldBy: 'agent-1', since: NOW_ISO, source: 'swap' },                    // wrong holder — corrected
        },
      }),
      'agentBattles/b1': {
        gameMode: TOURNAMENT_GAME_MODE, agentId: 'agent-1', groupId: 'g1', status: 'completed',
        createdAt: '2026-06-15T13:00:00.000Z', portfolio: makePortfolio(['AMD', 'XOM']),
      },
      'agentBattles/b2': {
        gameMode: TOURNAMENT_GAME_MODE, agentId: 'agent-2', groupId: 'g1', status: 'active',
        createdAt: '2026-06-15T13:00:00.000Z', portfolio: makePortfolio(['TSLA']),
      },
    });

    const result = await reconcileGroupLedger(db, group, { now: NOW });
    const held = store.get(LEDGER_PATH).held;

    expect(held.AMD).toEqual({ heldBy: 'agent-1', since: '2026-06-15T13:30:00.000Z', source: 'draft' });
    expect(held.XOM).toEqual({ heldBy: 'agent-1', since: NOW_ISO, source: 'swap' }); // missing_in_ledger — added
    expect(held.TSLA.heldBy).toBe('agent-2');
    expect(held.GHOST).toBeUndefined();

    const types = result.divergences.map(d => d.type).sort();
    expect(types).toEqual(['missing_in_ledger', 'not_in_portfolio', 'wrong_holder']);
    expect(result.heldCount).toBe(3);
  });

  it('uses each agent\'s LATEST battle only, ignores non-tournament battles in the group query, clears stale reservations', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({
        reservations: {
          OLD: { by: 'agent-1', battleId: 'bx', at: STALE_AT },
          FRESH: { by: 'agent-2', battleId: 'by', at: NOW_ISO },
        },
      }),
      'agentBattles/day1': {
        gameMode: TOURNAMENT_GAME_MODE, agentId: 'agent-1', groupId: 'g1', status: 'completed',
        createdAt: '2026-06-14T13:00:00.000Z', portfolio: makePortfolio(['YESTERDAY']),
      },
      'agentBattles/day2': {
        gameMode: TOURNAMENT_GAME_MODE, agentId: 'agent-1', groupId: 'g1', status: 'active',
        createdAt: '2026-06-15T13:00:00.000Z', portfolio: makePortfolio(['TODAY']),
      },
      'agentBattles/casual': {
        gameMode: 'baggerbomb_agent', agentId: 'agent-1', groupId: 'g1', status: 'active',
        createdAt: '2026-06-15T14:00:00.000Z', portfolio: makePortfolio(['CASUAL']),
      },
    });

    const result = await reconcileGroupLedger(db, { id: 'g1' }, { now: NOW });
    const ledger = store.get(LEDGER_PATH);

    expect(ledger.held.TODAY).toBeDefined();
    expect(ledger.held.YESTERDAY).toBeUndefined();
    expect(ledger.held.CASUAL).toBeUndefined();
    expect(ledger.reservations).toEqual({ FRESH: { by: 'agent-2', battleId: 'by', at: NOW_ISO } });
    expect(result.staleCleared).toBe(1);
  });

  it('preserves holdings of agents with no battles yet (Monday pre-deploy) as unverifiable, not divergent-removed', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({
        held: { DRAFTED: { heldBy: 'agent-7', since: NOW_ISO, source: 'draft' } },
      }),
    });
    const result = await reconcileGroupLedger(db, { id: 'g1' }, { now: NOW });
    expect(store.get(LEDGER_PATH).held.DRAFTED.heldBy).toBe('agent-7');
    expect(result.divergences).toEqual([
      { type: 'unverifiable_holder', symbol: 'DRAFTED', details: expect.stringContaining('agent-7') },
    ]);
  });

  it('excludes FOREIGN battles (owner not in groupMembers) from the derivation — same predicate as the eval-cron resolver', async () => {
    // A dev-seeded battle stamped onto the group but owned by a stranger:
    // the cron treats it as non-tournament (fail-safe), so the rebuild must
    // not ingest its portfolio as derived truth either — otherwise the two
    // directions disagree forever and the 'held' entries block real agents.
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc(),
      'agentBattles/foreign': {
        gameMode: TOURNAMENT_GAME_MODE, agentId: 'agent-9', groupId: 'g1', status: 'active',
        ownerId: 'user-stranger', createdAt: NOW_ISO, portfolio: makePortfolio(['INTRUDER']),
      },
      'agentBattles/legit': {
        gameMode: TOURNAMENT_GAME_MODE, agentId: 'agent-1', groupId: 'g1', status: 'active',
        ownerId: 'user-a', createdAt: NOW_ISO, portfolio: makePortfolio(['AMD']),
      },
    });
    const result = await reconcileGroupLedger(db, { id: 'g1', ...makeGroup() }, { now: NOW });
    const held = store.get(LEDGER_PATH).held;
    expect(held.AMD.heldBy).toBe('agent-1');
    expect(held.INTRUDER).toBeUndefined();
    expect(result.divergences).toContainEqual({ type: 'foreign_battle', symbol: null, details: expect.stringContaining('user-stranger') });
  });

  it('RETRY-SAFE: a transaction retry does not double-count divergences or staleCleared', async () => {
    const { db } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc({
        held: { GHOST: { heldBy: 'agent-1', since: NOW_ISO, source: 'swap' } },
        reservations: { OLD: { by: 'agent-1', battleId: 'bx', at: STALE_AT } },
      }),
      'agentBattles/b1': {
        gameMode: TOURNAMENT_GAME_MODE, agentId: 'agent-1', groupId: 'g1', status: 'active',
        ownerId: 'user-a', createdAt: NOW_ISO, portfolio: makePortfolio(['AMD']),
      },
    });
    // Simulate Firestore contention: the Admin SDK re-runs the closure.
    const original = db.runTransaction;
    db.runTransaction = async (fn) => {
      await fn({ get: async (ref) => ref.get(), set: () => {}, update: () => {} }); // aborted attempt
      return original(fn); // committed attempt
    };
    const result = await reconcileGroupLedger(db, { id: 'g1', ...makeGroup() }, { now: NOW });
    // One missing_in_ledger (AMD), one not_in_portfolio (GHOST), one stale —
    // each exactly once despite the closure running twice.
    expect(result.divergences.filter(d => d.type === 'missing_in_ledger')).toHaveLength(1);
    expect(result.divergences.filter(d => d.type === 'not_in_portfolio')).toHaveLength(1);
    expect(result.staleCleared).toBe(1);
  });

  it('logs duplicate holdings deterministically (sorted agent order wins)', async () => {
    const { db, store } = makeDb({
      [LEDGER_PATH]: makeLedgerDoc(),
      'agentBattles/b1': {
        gameMode: TOURNAMENT_GAME_MODE, agentId: 'agent-2', groupId: 'g1', status: 'active',
        createdAt: NOW_ISO, portfolio: makePortfolio(['DUP']),
      },
      'agentBattles/b2': {
        gameMode: TOURNAMENT_GAME_MODE, agentId: 'agent-1', groupId: 'g1', status: 'active',
        createdAt: NOW_ISO, portfolio: makePortfolio(['DUP']),
      },
    });
    const result = await reconcileGroupLedger(db, { id: 'g1' }, { now: NOW });
    expect(store.get(LEDGER_PATH).held.DUP.heldBy).toBe('agent-1');
    // The duplicate is reported; the winner's repair onto the empty ledger
    // additionally reports as missing_in_ledger — both are real.
    expect(result.divergences).toContainEqual({ type: 'duplicate_holding', symbol: 'DUP', details: expect.stringContaining('agent-2') });
  });
});

describe('reconcileAllTournamentLedgers — the nightly pass', () => {
  it('ZERO GROUPS IS A CLEAN NO-OP (production inertness until P3+)', async () => {
    const { db, reads } = makeDb({});
    const summary = await reconcileAllTournamentLedgers(db, { now: NOW });
    expect(summary).toEqual({ groups: 0, reconciled: 0, divergences: 0, staleCleared: 0, errors: 0, heldByGroup: {} });
    expect(reads).toHaveLength(0); // the status query touches no docs
  });

  it('reconciles every in-battle group; one failure never blocks the rest', async () => {
    const { db } = makeDb({
      'tournamentGroups/g1': makeGroup(),
      'tournamentGroups/g2': makeGroup(),
      'tournamentGroups/done': makeGroup({ status: 'complete' }),
      'tournamentGroups/g1/ledger/agentHeldSet': makeLedgerDoc({ reservations: { X: { by: 'a', battleId: 'b', at: STALE_AT } } }),
    });
    // Sabotage g2's reconcile by making its ledger transaction explode once.
    const original = db.runTransaction;
    let call = 0;
    db.runTransaction = async (fn) => {
      call++;
      if (call === 2) throw new Error('boom');
      return original(fn);
    };

    const summary = await reconcileAllTournamentLedgers(db, { now: NOW });
    expect(summary.groups).toBe(2); // 'complete' group not selected
    expect(summary.reconciled).toBe(1);
    expect(summary.errors).toBe(1);
    expect(summary.staleCleared).toBe(1);
  });
});

// ==================== MISC ====================

describe('readLedger / ledgerRef', () => {
  it('defaults to the empty shape when the doc is missing; reads it when present', async () => {
    const empty = makeDb({});
    expect(await readLedger(empty.db, 'g1', NOW)).toEqual({ held: {}, reservations: {}, doubleDowns: [], updatedAt: NOW_ISO });

    const seeded = makeDb({ [LEDGER_PATH]: makeLedgerDoc({ held: { AMD: { heldBy: 'a1', since: NOW_ISO, source: 'draft' } } }) });
    expect((await readLedger(seeded.db, 'g1')).held.AMD.heldBy).toBe('a1');
  });

  it('the sibling path is tournamentGroups/{groupId}/ledger/agentHeldSet', () => {
    const { db } = makeDb({});
    expect(ledgerRef(db, 'g1').path).toBe(LEDGER_PATH);
  });
});
