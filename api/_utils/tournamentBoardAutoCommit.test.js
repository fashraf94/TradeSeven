// api/_utils/tournamentBoardAutoCommit.test.js
//
// P5 battery for the deadline auto-commit. Blocks: the server prefill twin's
// equivalence with the client derivation (same fixtures through the shared
// core + a static wiring guard that the client service actually routes
// through composeBoardPrefill — the no-forks contract), the no-watchlist
// floor (archetype ranking ∩ pool, ranked-pool fallback, loud + floored),
// the rider-#1 doc with the autoCommitted flag + atomic feed entry, the
// race-window player win, idempotency, and the too-small-pool failure that
// hands back to the orchestrator's loud defer.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentBoardAutoCommit.js IS the runtime guard that its transitive
// import surface (src/utils/boardPrefillCore.js,
// src/constants/leagueTournament.js) stays Node-clean. Never mock that
// import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
import {
  AUTO_COMMIT_FEED_TYPE,
  deriveServerBoardPrefill,
  autoCommitMissingBoards,
} from './tournamentBoardAutoCommit.js';
import { composeBoardPrefill } from '../../src/utils/boardPrefillCore.js';
import { GROUP_STATUS, TOURNAMENT_TUNING } from '../../src/constants/leagueTournament.js';

const { BOARD_DEPTH_MIN, BOARD_DEPTH_MAX } = TOURNAMENT_TUNING;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE (the orchestrator-battery fake) ====================

function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const writeLog = [];

  function makeDocRef(p) {
    return {
      path: p,
      get: async () => {
        const data = store.get(p);
        return { exists: data !== undefined, id: p.split('/').pop(), data: () => structuredClone(data) };
      },
      set: async (data) => { store.set(p, structuredClone(data)); writeLog.push(['set', p]); },
      collection: (sub) => makeCollection(`${p}/${sub}`),
    };
  }

  function topLevelDocs(prefix) {
    const docs = [];
    for (const [p, data] of store.entries()) {
      if (!p.startsWith(`${prefix}/`)) continue;
      const rel = p.slice(prefix.length + 1);
      if (rel.includes('/')) continue;
      docs.push({ id: rel, data: () => structuredClone(data) });
    }
    return docs;
  }

  const snapshotOf = (docs) => ({ docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) });

  function makeCollection(prefix) {
    const filtered = (field, value) => topLevelDocs(prefix).filter(d => d.data()[field] === value);
    return {
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      where: (field, op, value) => ({
        get: async () => snapshotOf(filtered(field, value)),
        limit: (n) => ({ get: async () => snapshotOf(filtered(field, value).slice(0, n)) }),
      }),
      get: async () => snapshotOf(topLevelDocs(prefix)),
    };
  }

  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      getAll: async (...refs) => Promise.all(refs.map(r => r.get())),
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); writeLog.push(['tx.set', ref.path]); },
      update: (ref, updates) => {
        const data = store.get(ref.path);
        if (data === undefined) throw new Error(`tx.update on missing doc ${ref.path}`);
        Object.assign(data, updates);
        writeLog.push(['tx.update', ref.path]);
      },
    }),
  };

  return { db, store, writeLog };
}

// ==================== FIXTURES ====================

const POOL = [
  'NVDA', 'AMD', 'TSLA', 'META', 'AAPL', 'MSFT', 'AMZN', 'GOOG', 'NFLX', 'AVGO',
  'CRM', 'ORCL', 'ADBE', 'COIN', 'PLTR', 'SHOP', 'SQ', 'UBER', 'ABNB', 'SNOW',
  'DDOG', 'NET', 'MDB', 'CRWD',
];
const STOCKS = POOL.map((symbol, i) => ({
  symbol,
  sectorName: 'Technology',
  fundamentalScore: 95 - i,
  technicalScore: 95 - i,
  baggerBombFit: 95 - i,
  atrPercentile: 0.5,
}));

const MEMBERS = ['user-a', 'user-b', 'user-c', 'user-d'];
const NOW = new Date('2026-06-15T11:05:00.000Z');

function formingGroup() {
  return {
    id: 'g1',
    status: GROUP_STATUS.FORMING,
    roundNumber: 1,
    baseLayerWeek: '2026-W25',
    groupMembers: [...MEMBERS],
    players: MEMBERS.map(odUserId => ({ odUserId, picks: [] })),
    userPool: [...POOL],
  };
}

/** db where user-a..c have boards and user-d is the uncommitted seat. */
function fixtureDb({ agentForD = null, watchlist = null, voiceCache = null, rankings = STOCKS, pool = POOL } = {}) {
  const group = { ...formingGroup(), userPool: [...pool] };
  const initial = {
    'tournamentGroups/g1': group,
    ...(rankings ? { 'indexIntelligence/stockRankings': { stocks: rankings } } : {}),
  };
  for (const id of MEMBERS.slice(0, 3)) {
    initial[`tournamentGroups/g1/boards/${id}`] = { odUserId: id, board: pool.slice(0, BOARD_DEPTH_MIN) };
  }
  if (agentForD) initial['agents/agent-d'] = agentForD;
  if (watchlist) initial[`watchlists/${agentForD.equippedWatchlistId}`] = watchlist;
  if (voiceCache) initial[`voiceLayerCache/${agentForD.activeBattleId}`] = voiceCache;
  const made = makeDb(initial);
  return { ...made, group: { ...group } };
}

// Enough in-pool watchlist names that no floor padding is needed.
const FULL_WATCHLIST_SYMBOLS = POOL.slice(0, BOARD_DEPTH_MIN + 1);

const AGENT_D = {
  ownerId: 'user-d',
  archetype: 'momentum_chaser',
  equippedWatchlistId: 'wl-1',
  activeBattleId: 'battle-1',
};

// ==================== PREFILL TWIN ====================

describe('deriveServerBoardPrefill — the client derivation\'s Admin-SDK twin', () => {
  it('equals the shared core composed over the same raw inputs (equivalence on fixtures)', async () => {
    const equipped = ['tsla', ' NVDA ', 'ZZZZ', 'AMD']; // mixed case/whitespace/off-pool, the client's input shape
    const alerts = ['amd', 'META'];
    const { db } = fixtureDb({
      agentForD: AGENT_D,
      watchlist: { tickers: equipped.map(symbol => ({ symbol })) },
      voiceCache: { scoutAlerts: alerts.map(symbol => ({ symbol })) },
    });

    const { prefill, archetype } = await deriveServerBoardPrefill(db, { odUserId: 'user-d', userPool: POOL });

    // The client derivation on the identical fixtures: equipped-first merge
    // through the SAME core (tournamentGroupService.js assembleBoardPrefill
    // routes here too — wiring-guarded below).
    expect(prefill).toEqual(composeBoardPrefill({
      equippedSymbols: ['TSLA', 'NVDA', 'ZZZZ', 'AMD'],
      scoutAlertSymbols: ['AMD', 'META'],
      userPool: POOL,
      depthMax: BOARD_DEPTH_MAX,
    }));
    expect(prefill).toEqual(['TSLA', 'NVDA', 'AMD', 'META']); // off-pool ZZZZ dropped, in order
    expect(archetype).toBe('momentum_chaser');
  });

  it('STATIC WIRING GUARD: the client service routes through the same composeBoardPrefill core', () => {
    const clientSource = fs.readFileSync(
      path.resolve(TEST_DIR, '../../src/services/tournamentGroupService.js'), 'utf8'
    );
    expect(clientSource).toContain("from '../utils/boardPrefillCore'");
    expect(clientSource).toContain('composeBoardPrefill({');
    // The editor passes the pool into the derivation (the ∩ pool step moved
    // into the core — no consumer-side re-filter to fork).
    const editorSource = fs.readFileSync(
      path.resolve(TEST_DIR, '../../src/components/Tournament/BoardEditor.jsx'), 'utf8'
    );
    expect(editorSource).toContain('assembleBoardPrefill(uid, { userPool })');
  });

  it('degrades silently: no agent doc → empty prefill, analyst archetype', async () => {
    const { db } = fixtureDb();
    const { prefill, archetype } = await deriveServerBoardPrefill(db, { odUserId: 'user-d', userPool: POOL });
    expect(prefill).toEqual([]);
    expect(archetype).toBe('analyst');
  });
});

// ==================== AUTO-COMMIT ====================

describe('autoCommitMissingBoards — the Monday deadline', () => {
  it('commits the missing seat via the rider-#1 core with autoCommitted + atomic feed entry (no floor when prefill is deep)', async () => {
    const { db, store } = fixtureDb({
      agentForD: AGENT_D,
      watchlist: { tickers: FULL_WATCHLIST_SYMBOLS.map(symbol => ({ symbol })) },
    });

    const summary = await autoCommitMissingBoards(db, { ...formingGroup() }, { now: NOW });
    expect(summary).toEqual({ missing: 1, committed: 1, floored: 0, errors: 0 });

    const board = store.get('tournamentGroups/g1/boards/user-d');
    expect(board.autoCommitted).toBe(true);
    expect(board.odUserId).toBe('user-d');
    expect(board.board).toEqual(FULL_WATCHLIST_SYMBOLS.slice(0, BOARD_DEPTH_MAX));
    expect(board.prefillAsSuggested).toEqual(board.board); // delta all-kept by construction
    expect(board.delta.every(d => d.status === 'kept')).toBe(true);
    expect(board.committedAt).toBe(NOW.toISOString());

    const feed = store.get('tournamentGroups/g1').feed;
    expect(feed).toHaveLength(1);
    expect(feed[0]).toEqual({
      type: AUTO_COMMIT_FEED_TYPE,
      odUserId: 'user-d',
      boardLength: board.board.length,
      floored: false,
      timestamp: NOW.toISOString(),
    });
  });

  it('NO-WATCHLIST FLOOR: pads to BOARD_DEPTH_MIN from the archetype ranking ∩ pool, loud + floored', async () => {
    const { db, store } = fixtureDb(); // user-d has no agent doc at all
    const summary = await autoCommitMissingBoards(db, { ...formingGroup() }, { now: NOW });
    expect(summary).toEqual({ missing: 1, committed: 1, floored: 1, errors: 0 });

    const board = store.get('tournamentGroups/g1/boards/user-d');
    expect(board.board).toHaveLength(BOARD_DEPTH_MIN);
    expect(board.board.every(s => POOL.includes(s))).toBe(true);
    expect(board.autoCommitted).toBe(true);
    expect(board.prefillAsSuggested).toEqual([]); // the honest empty suggestion
    expect(board.delta.every(d => d.status === 'added')).toBe(true);
    expect(store.get('tournamentGroups/g1').feed[0].floored).toBe(true);
    expect(console.warn.mock.calls.map(c => c.join(' ')).some(l => l.includes('FLOOR used for user-d'))).toBe(true);
  });

  it('FLOOR FALLBACK: a missing rankings doc pads from the ranked pool itself', async () => {
    const { db, store } = fixtureDb({ rankings: null });
    const summary = await autoCommitMissingBoards(db, { ...formingGroup() }, { now: NOW });
    expect(summary.committed).toBe(1);
    // The pool is stored ranked — padding takes its head in order.
    expect(store.get('tournamentGroups/g1/boards/user-d').board).toEqual(POOL.slice(0, BOARD_DEPTH_MIN));
  });

  it('IDEMPOTENT: all boards present → zero writes, zero feed entries', async () => {
    const { db, store, writeLog } = fixtureDb();
    store.set('tournamentGroups/g1/boards/user-d', { odUserId: 'user-d', board: POOL.slice(0, BOARD_DEPTH_MIN) });
    const summary = await autoCommitMissingBoards(db, { ...formingGroup() }, { now: NOW });
    expect(summary).toEqual({ missing: 0, committed: 0, floored: 0, errors: 0 });
    expect(writeLog).toHaveLength(0);
    expect(store.get('tournamentGroups/g1').feed).toBeUndefined();
  });

  it('RACE WINDOW: a player commit landing mid-run wins — never overwritten by a default', async () => {
    const { db, store } = fixtureDb();
    const playerBoard = { odUserId: 'user-d', board: POOL.slice(3, 3 + BOARD_DEPTH_MIN) };
    // The player's commit lands after the missing-boards read: hook the
    // agents lookup (the first per-member read) to land it.
    const realCollection = db.collection.bind(db);
    let landed = false;
    db.collection = (name) => {
      if (name === 'agents' && !landed) {
        landed = true;
        store.set('tournamentGroups/g1/boards/user-d', structuredClone(playerBoard));
      }
      return realCollection(name);
    };

    const summary = await autoCommitMissingBoards(db, { ...formingGroup() }, { now: NOW });
    expect(summary.committed).toBe(1); // the seat is covered…
    const board = store.get('tournamentGroups/g1/boards/user-d');
    expect(board).toEqual(playerBoard); // …by the PLAYER's board, untouched
    expect(board.autoCommitted).toBeUndefined();
    expect(store.get('tournamentGroups/g1').feed).toBeUndefined(); // no feed entry for a non-event
  });

  it('FAILURE HANDS BACK TO THE DEFER: a pool below the commit floor errors loudly, commits nothing', async () => {
    const smallPool = POOL.slice(0, BOARD_DEPTH_MIN - 3); // 12: passes resolution's floor, fails the board's
    const { db, store } = fixtureDb({ pool: smallPool, rankings: STOCKS });
    const summary = await autoCommitMissingBoards(db, { ...formingGroup(), userPool: smallPool }, { now: NOW });
    expect(summary).toEqual({ missing: 1, committed: 0, floored: 0, errors: 1 });
    expect(store.get('tournamentGroups/g1/boards/user-d')).toBeUndefined();
    expect(console.error.mock.calls.map(c => c.join(' ')).some(l => l.includes('auto-commit FAILED for user-d'))).toBe(true);
  });

  it('FEED CAP: the group feed never grows past 50', async () => {
    const { db, store } = fixtureDb();
    const group = store.get('tournamentGroups/g1');
    group.feed = Array.from({ length: 50 }, (_, i) => ({ type: 'flip', i }));
    const summary = await autoCommitMissingBoards(db, { ...formingGroup() }, { now: NOW });
    expect(summary.committed).toBe(1);
    const feed = store.get('tournamentGroups/g1').feed;
    expect(feed).toHaveLength(50);
    expect(feed[49].type).toBe(AUTO_COMMIT_FEED_TYPE);
  });
});
