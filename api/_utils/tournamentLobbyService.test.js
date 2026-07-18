// api/_utils/tournamentLobbyService.test.js
//
// P10a battery for the self-serve lobby service. Blocks: create (open /
// private join code), join (FIFO append, double-join idempotency, capacity
// guard), matchmaking (FIFO into the oldest open lobby, fresh-lobby fallback),
// and FORMATION — the seam: CPU-padded base-layer group creation with the
// transactional CPU-number allocator (uniqueness across concurrent
// formations), isDev NEVER set (production scope), double-form idempotency,
// the 4-human no-pad case, and quick play.
//
// The CPU-padding-THROUGH-the-duties proof (formation → Monday → banking →
// base-layer COMPLETE) lives in the companion seam battery
// (tournamentLobbyFormation.seam.test.js).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentLobbyService.js IS the runtime guard that its transitive import
// surface (src/constants/leagueTournament.js, tournamentCpu.js, the fenced
// agentArchetypeConfig exports it reaches) stays Node-clean. Never mock it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createLobby,
  joinLobby,
  matchmakeJoin,
  formGroupFromLobby,
  quickPlay,
  findLobbyByJoinCode,
  CPU_SEQUENCE_DOC_ID,
} from './tournamentLobbyService.js';
import {
  GROUP_SIZE,
  GROUP_STATUS,
  LOBBY_STATUS,
  LOBBY_MODE,
  TOURNAMENT_TUNING,
  cpuAgentDocId,
  isCpuUserId,
} from '../../src/constants/leagueTournament.js';
import { deriveBattleStartWeek, deriveBaseLayerWeek } from './liveDraftFormation.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE ====================
// The advancement/orchestrator makeDb idiom + auto-id doc() (createLobby uses
// collection().doc() with no id).

function applyDotPathUpdate(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
}

function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const writeLog = [];
  let autoSeq = 0;

  function makeDocRef(path) {
    return {
      path,
      id: path.split('/').pop(),
      get: async () => {
        const data = store.get(path);
        return { exists: data !== undefined, id: path.split('/').pop(), data: () => structuredClone(data) };
      },
      set: async (data) => { store.set(path, structuredClone(data)); writeLog.push(['set', path]); },
      update: async (updates) => {
        const data = store.get(path);
        if (data === undefined) throw new Error(`update on missing doc ${path}`);
        applyDotPathUpdate(data, updates);
        writeLog.push(['update', path]);
      },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }

  function topLevelDocs(prefix) {
    const docs = [];
    for (const [path, data] of store.entries()) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const rel = path.slice(prefix.length + 1);
      if (rel.includes('/')) continue;
      docs.push({ id: rel, data: () => structuredClone(data) });
    }
    return docs;
  }

  function snapshotOf(docs) {
    return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
  }

  function makeCollection(prefix) {
    // Honors the operator: array-contains for the mirror guard's member-scoped
    // query (the liveDraftFormation.test makeDb idiom); anything else is
    // equality, as before.
    const filtered = (field, op, value) => topLevelDocs(prefix).filter(d => {
      const fv = d.data()[field];
      return op === 'array-contains' ? (Array.isArray(fv) && fv.includes(value)) : fv === value;
    });
    return {
      doc: (id) => makeDocRef(`${prefix}/${id ?? `auto-${++autoSeq}`}`),
      where: (field, op, value) => ({
        get: async () => snapshotOf(filtered(field, op, value)),
        limit: (n) => ({ get: async () => snapshotOf(filtered(field, op, value).slice(0, n)) }),
        select: () => ({ get: async () => snapshotOf(filtered(field, op, value)) }),
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
        applyDotPathUpdate(data, updates);
        writeLog.push(['tx.update', ref.path]);
      },
    }),
  };

  return { db, store, writeLog };
}

const SYMBOLS = Array.from({ length: 40 }, (_, i) => `SYM${i}`);
const STOCKS = SYMBOLS.map(symbol => ({ symbol }));
const NOW = new Date('2026-06-10T15:00:00.000Z'); // a Wednesday

function withRankings(initial = {}) {
  return makeDb({ 'indexIntelligence/stockRankings': { stocks: STOCKS }, ...initial });
}

// ==================== CREATE ====================

describe('createLobby', () => {
  it('seats the creator in an OPEN matchmaking lobby (no join code)', async () => {
    const { db, store } = withRankings();
    const { id, doc } = await createLobby(db, { createdBy: 'u1', displayName: 'Ada', now: NOW });
    expect(doc.status).toBe(LOBBY_STATUS.OPEN);
    expect(doc.mode).toBe(LOBBY_MODE.MATCHMAKING);
    expect(doc).not.toHaveProperty('joinCode');
    expect(doc.members).toEqual([{ odUserId: 'u1', displayName: 'Ada', joinedAt: NOW.toISOString() }]);
    expect(doc.groupId).toBeNull();
    expect(doc.cpuStartN).toBeNull();
    expect(store.get(`tournamentLobby/${id}`).createdBy).toBe('u1');
  });

  it('a private lobby carries a shareable join code', async () => {
    const { db } = withRankings();
    const { doc } = await createLobby(db, { createdBy: 'u1', mode: LOBBY_MODE.PRIVATE, now: NOW });
    expect(doc.mode).toBe(LOBBY_MODE.PRIVATE);
    expect(typeof doc.joinCode).toBe('string');
    expect(doc.joinCode).toMatch(/^[A-Z2-9]{6}$/);
  });
});

// ==================== JOIN ====================

describe('joinLobby', () => {
  it('appends a member in FIFO order and reports capacity', async () => {
    const { db } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'u1', now: NOW });
    const r2 = await joinLobby(db, id, { odUserId: 'u2', displayName: 'Bo', now: NOW });
    expect(r2.joined).toBe(true);
    expect(r2.full).toBe(false);
    expect(r2.lobby.members.map(m => m.odUserId)).toEqual(['u1', 'u2']);
  });

  it('double-join is idempotent — never a duplicate seat', async () => {
    const { db, store } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'u1', now: NOW });
    await joinLobby(db, id, { odUserId: 'u2', now: NOW });
    const again = await joinLobby(db, id, { odUserId: 'u2', now: NOW });
    expect(again.joined).toBe(false);
    expect(again.alreadyMember).toBe(true);
    expect(store.get(`tournamentLobby/${id}`).members.map(m => m.odUserId)).toEqual(['u1', 'u2']);
  });

  it('reports full at GROUP_SIZE humans and refuses a fifth', async () => {
    const { db } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'u1', now: NOW });
    await joinLobby(db, id, { odUserId: 'u2', now: NOW });
    await joinLobby(db, id, { odUserId: 'u3', now: NOW });
    const r4 = await joinLobby(db, id, { odUserId: 'u4', now: NOW });
    expect(r4.full).toBe(true);
    await expect(joinLobby(db, id, { odUserId: 'u5', now: NOW })).rejects.toThrow('lobby_full');
  });

  it('refuses a join on a non-open lobby', async () => {
    const { db } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'u1', now: NOW });
    await formGroupFromLobby(db, id, { now: NOW }); // → formed
    await expect(joinLobby(db, id, { odUserId: 'u2', now: NOW })).rejects.toThrow('lobby_not_open');
  });
});

// ==================== MATCHMAKING (FIFO) ====================

describe('matchmakeJoin — FIFO fill-to-4 (ruling 1)', () => {
  it('joins the OLDEST open matchmaking lobby with a free seat', async () => {
    const { db } = withRankings();
    const older = await createLobby(db, { createdBy: 'u1', now: new Date('2026-06-10T14:00:00Z') });
    await createLobby(db, { createdBy: 'u2', now: new Date('2026-06-10T15:00:00Z') }); // newer
    const res = await matchmakeJoin(db, { odUserId: 'u3', now: NOW });
    expect(res.created).toBe(false);
    expect(res.id).toBe(older.id);
    expect(res.lobby.members.map(m => m.odUserId)).toEqual(['u1', 'u3']);
  });

  it('opens a fresh lobby when none are joinable', async () => {
    const { db, store } = withRankings();
    const res = await matchmakeJoin(db, { odUserId: 'u1', now: NOW });
    expect(res.created).toBe(true);
    expect(store.get(`tournamentLobby/${res.id}`).members.map(m => m.odUserId)).toEqual(['u1']);
  });

  it('skips a full lobby and a private lobby; never matches the __cpuSequence doc', async () => {
    const { db } = withRankings();
    // A full matchmaking lobby.
    const full = await createLobby(db, { createdBy: 'a1', now: new Date('2026-06-10T10:00:00Z') });
    await joinLobby(db, full.id, { odUserId: 'a2', now: NOW });
    await joinLobby(db, full.id, { odUserId: 'a3', now: NOW });
    await joinLobby(db, full.id, { odUserId: 'a4', now: NOW });
    // A private lobby (must be ignored by matchmaking).
    await createLobby(db, { createdBy: 'p1', mode: LOBBY_MODE.PRIVATE, now: new Date('2026-06-10T11:00:00Z') });
    // Force the allocator doc to exist (it has no status field → never a candidate).
    await quickPlay(db, { odUserId: 'q1', now: NOW });

    const res = await matchmakeJoin(db, { odUserId: 'u9', now: NOW });
    expect(res.created).toBe(true); // none of full/private/quickplay were joinable
  });
});

// ==================== FORMATION (THE SEAM) ====================

describe('formGroupFromLobby — CPU-padded base-layer formation', () => {
  it('a solo human forms a base-layer group of four: 3 CPU pad seats, CPU agents + boards, isDev NEVER set', async () => {
    const { db, store } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'human-1', displayName: 'Ada', now: NOW });
    const formed = await formGroupFromLobby(db, id, { now: NOW });

    expect(formed.alreadyFormed).toBe(false);
    expect(formed.humanCount).toBe(1);
    expect(formed.cpuNs).toEqual([1, 2, 3]);
    expect(formed.groupId).toBe(id); // deterministic 1:1

    const group = store.get(`tournamentGroups/${id}`);
    expect(group.status).toBe(GROUP_STATUS.FORMING);
    expect(group.players).toHaveLength(GROUP_SIZE);
    expect(group.players[0]).toMatchObject({ odUserId: 'human-1' });
    expect(group.players[0]).not.toHaveProperty('isCpu'); // human seat
    expect(group.players.slice(1).every(p => p.isCpu === true)).toBe(true);
    expect(group.players.slice(1).every(p => isCpuUserId(p.odUserId))).toBe(true);
    expect(group.baseLayerWeek).toBeTruthy();
    expect(group).not.toHaveProperty('bracketGameId');
    // SEAM FACT #2 — production scope: never a dev group.
    expect(group).not.toHaveProperty('isDev');

    // CPU system agents created (lazy get-or-create) + CPU user boards committed.
    expect(store.get(`agents/${cpuAgentDocId(1)}`).ownerId).toBe('cpu-1');
    for (const n of [1, 2, 3]) {
      const board = store.get(`tournamentGroups/${id}/boards/cpu-${n}`);
      expect(board.isCpu).toBe(true);
      expect(board.board.length).toBeGreaterThanOrEqual(TOURNAMENT_TUNING.BOARD_DEPTH_MIN);
    }
    // The human owes only their own board (commit flow / Monday auto-commit).
    expect(store.get(`tournamentGroups/${id}/boards/human-1`)).toBeUndefined();

    // The lobby is finalized.
    const lobby = store.get(`tournamentLobby/${id}`);
    expect(lobby.status).toBe(LOBBY_STATUS.FORMED);
    expect(lobby.groupId).toBe(id);
  });

  it('two humans → two CPU pads; four humans → zero pads (no CPU agents touched)', async () => {
    const { db, store } = withRankings();
    const a = await createLobby(db, { createdBy: 'h1', now: NOW });
    await joinLobby(db, a.id, { odUserId: 'h2', now: NOW });
    const two = await formGroupFromLobby(db, a.id, { now: NOW });
    expect(two.cpuNs).toHaveLength(2);

    const b = await createLobby(db, { createdBy: 'g1', now: NOW });
    await joinLobby(db, b.id, { odUserId: 'g2', now: NOW });
    await joinLobby(db, b.id, { odUserId: 'g3', now: NOW });
    await joinLobby(db, b.id, { odUserId: 'g4', now: NOW });
    const four = await formGroupFromLobby(db, b.id, { now: NOW });
    expect(four.cpuNs).toEqual([]);
    const group = store.get(`tournamentGroups/${b.id}`);
    expect(group.players.map(p => p.odUserId)).toEqual(['g1', 'g2', 'g3', 'g4']);
    expect(group.players.some(p => p.isCpu)).toBe(false);
  });

  it('SEAM FACT #1 — separate formations get DISJOINT cpu-agent numbers from the monotonic allocator', async () => {
    // The allocator reserves [next, next+cpuCount) by reading AND writing the
    // __cpuSequence counter inside ONE transaction — so under real Firestore
    // optimistic concurrency two interleaving formations cannot read the same
    // `next` (the cross-concurrent-group guarantee). The in-memory tx is single-
    // shot (no conflict simulation), so this test proves the observable
    // property: two formations reserve disjoint, monotonic ranges and never
    // share a cpu-agent.
    const { db, store } = withRankings();
    const l1 = await createLobby(db, { createdBy: 'solo-a', now: NOW });
    const l2 = await createLobby(db, { createdBy: 'solo-b', now: NOW });
    const f1 = await formGroupFromLobby(db, l1.id, { now: NOW });
    const f2 = await formGroupFromLobby(db, l2.id, { now: NOW });

    expect(f1.cpuNs).toEqual([1, 2, 3]);
    expect(f2.cpuNs).toEqual([4, 5, 6]); // reserved past the first formation
    // No cpu-agent is shared between the two active groups.
    const g1Cpus = store.get(`tournamentGroups/${l1.id}`).players.filter(p => p.isCpu).map(p => p.odUserId);
    const g2Cpus = store.get(`tournamentGroups/${l2.id}`).players.filter(p => p.isCpu).map(p => p.odUserId);
    expect(g1Cpus.some(c => g2Cpus.includes(c))).toBe(false);
    expect(store.get(`tournamentLobby/${CPU_SEQUENCE_DOC_ID}`).next).toBe(7);
  });

  it('double-form is idempotent: the second call recreates nothing and re-pads no CPUs', async () => {
    const { db, store, writeLog } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'human-1', now: NOW });
    const first = await formGroupFromLobby(db, id, { now: NOW });
    const writesAfterFirst = writeLog.length;

    const second = await formGroupFromLobby(db, id, { now: new Date('2026-06-10T16:00:00Z') });
    expect(second.alreadyFormed).toBe(true);
    expect(second.groupId).toBe(first.groupId);
    // The allocator did not advance again, and no new group/board writes landed.
    expect(store.get(`tournamentLobby/${CPU_SEQUENCE_DOC_ID}`).next).toBe(4);
    expect(writeLog.length).toBe(writesAfterFirst);
  });

  it('resumes an interrupted formation with the SAME reserved CPU base (crash shape)', async () => {
    const { db, store } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'human-1', now: NOW });
    // Simulate a crash AFTER the claim (status forming, base reserved) but
    // BEFORE the group doc / lobby finalize.
    await db.collection('tournamentLobby').doc(id).update({
      status: LOBBY_STATUS.FORMING, groupId: id, cpuStartN: 5,
    });
    await db.collection('tournamentLobby').doc(CPU_SEQUENCE_DOC_ID).set({ next: 8 });

    const resumed = await formGroupFromLobby(db, id, { now: NOW });
    expect(resumed.cpuNs).toEqual([5, 6, 7]); // the reserved base, not a fresh reservation
    expect(store.get(`tournamentLobby/${CPU_SEQUENCE_DOC_ID}`).next).toBe(8); // untouched on resume
    expect(store.get(`tournamentGroups/${id}`).players.slice(1).map(p => p.odUserId)).toEqual(['cpu-5', 'cpu-6', 'cpu-7']);
  });

  it('refuses to form a NEW group when the ranked universe is below the board floor', async () => {
    const { db } = makeDb({ 'indexIntelligence/stockRankings': { stocks: STOCKS.slice(0, 10) } });
    const { id } = await createLobby(db, { createdBy: 'human-1', now: NOW });
    await expect(formGroupFromLobby(db, id, { now: NOW })).rejects.toThrow(/universe_unavailable/);
  });

  it('a RESUME of an already-created group never re-validates the pool — a later rankings shortfall cannot strand it', async () => {
    // The group already exists (created on a prior attempt with a healthy pool)
    // and the lobby is mid-formation (FORMING). The rankings have since shrunk
    // below the floor. Resume must finalize from the group’s own frozen pool,
    // not throw universe_unavailable.
    const { db, store } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'human-1', now: NOW });
    await formGroupFromLobby(db, id, { now: NOW });            // creates the group (healthy pool)
    // Roll the lobby back to FORMING (simulate a crash before finalize) and
    // shrink the universe.
    await db.collection('tournamentLobby').doc(id).update({ status: LOBBY_STATUS.FORMING });
    store.set('indexIntelligence/stockRankings', { stocks: STOCKS.slice(0, 5) });

    const resumed = await formGroupFromLobby(db, id, { now: NOW });
    expect(resumed.alreadyFormed).toBe(false);
    expect(store.get(`tournamentLobby/${id}`).status).toBe(LOBBY_STATUS.FORMED);
    expect(store.get(`tournamentGroups/${id}`).players).toHaveLength(GROUP_SIZE);
  });

  it('a corrupt __cpuSequence (next 0) cannot reserve cpu-0 — the guard falls back to 1', async () => {
    const { db } = withRankings();
    await db.collection('tournamentLobby').doc(CPU_SEQUENCE_DOC_ID).set({ next: 0 });
    const { id } = await createLobby(db, { createdBy: 'human-1', now: NOW });
    const formed = await formGroupFromLobby(db, id, { now: NOW });
    expect(formed.cpuNs).toEqual([1, 2, 3]); // never [0, 1, 2]
  });

  it('a FORMED lobby with no groupId surfaces the corrupt state instead of reporting false success', async () => {
    const { db } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'human-1', now: NOW });
    await db.collection('tournamentLobby').doc(id).update({ status: LOBBY_STATUS.FORMED, groupId: null });
    await expect(formGroupFromLobby(db, id, { now: NOW })).rejects.toThrow('lobby_formed_without_group');
  });
});

// ==================== JOIN-CODE RESOLUTION (P10b surface dependency) ====================

describe('findLobbyByJoinCode — the typed/pasted private-invite path', () => {
  it('resolves a 6-char code to its OPEN private lobby (case-insensitive)', async () => {
    const { db } = withRankings();
    const { id, doc } = await createLobby(db, { createdBy: 'host', mode: LOBBY_MODE.PRIVATE, now: NOW });
    const hit = await findLobbyByJoinCode(db, `  ${doc.joinCode.toLowerCase()}  `);
    expect(hit).not.toBeNull();
    expect(hit.id).toBe(id);
    expect(hit.lobby.joinCode).toBe(doc.joinCode);
  });

  it('returns null (honest no-match) for a typo\'d / unknown code — never throws', async () => {
    const { db } = withRankings();
    await createLobby(db, { createdBy: 'host', mode: LOBBY_MODE.PRIVATE, now: NOW });
    await expect(findLobbyByJoinCode(db, 'ZZZZZZ')).resolves.toBeNull();
    await expect(findLobbyByJoinCode(db, '')).resolves.toBeNull();
    await expect(findLobbyByJoinCode(db, null)).resolves.toBeNull();
  });

  it('does NOT resolve a code whose lobby has already formed (only OPEN is joinable)', async () => {
    const { db } = withRankings();
    const { id, doc } = await createLobby(db, { createdBy: 'host', mode: LOBBY_MODE.PRIVATE, now: NOW });
    await formGroupFromLobby(db, id, { now: NOW }); // → FORMED
    await expect(findLobbyByJoinCode(db, doc.joinCode)).resolves.toBeNull();
  });
});

describe('quickPlay — the solo cold-start', () => {
  it('creates + forms in one act: a private lobby and an instant CPU-padded group', async () => {
    const { db, store } = withRankings();
    const res = await quickPlay(db, { odUserId: 'solo-1', displayName: 'Solo', now: NOW });
    expect(res.groupId).toBe(res.lobbyId);
    expect(res.cpuNs).toEqual([1, 2, 3]);
    const group = store.get(`tournamentGroups/${res.groupId}`);
    expect(group.status).toBe(GROUP_STATUS.FORMING);
    expect(group.players[0].odUserId).toBe('solo-1');
    expect(group.players.filter(p => p.isCpu)).toHaveLength(3);
    expect(store.get(`tournamentLobby/${res.lobbyId}`).mode).toBe(LOBBY_MODE.PRIVATE);
  });
});

// ==================== THE MIRROR GUARD (Entry-Flow Consolidation P4) ====================
//
// The reciprocal of the slot-side per-battle-week one-game guard: a user
// holding a slot seat must be blocked from forming a REGULAR group that plays
// the same battle week. The guard keys on the BATTLE week (the same
// deriveBattleStartWeek Monday-anchor rule the slot side uses) — NOW is a
// Wednesday, so the battle week is NEXT Monday's ISO week, which is exactly
// how a Wed-claimed slot pod stamps its baseLayerWeek. A formation-week key
// (isoWeekString(now)) would miss it — the asserted bug class.

describe('formGroupFromLobby — the mirror guard (slot seat blocks same-battle-week regular entry)', () => {
  // The battle week a group formed at NOW plays — via the REAL derivations the
  // guard uses (never a hand-rolled week string).
  const BATTLE_WEEK = deriveBaseLayerWeek(deriveBattleStartWeek(NOW.toISOString()));

  // A claimed slot pod as buildInitialSlotGroupDoc writes it: FORMING,
  // isLiveDraft, humans-only, NO isTraining key, battle-week baseLayerWeek.
  const slotPod = (odUserId, baseLayerWeek, id = 'lds_sun19_2026-06-14') => ({
    [`tournamentGroups/${id}`]: {
      status: GROUP_STATUS.FORMING,
      isLiveDraft: true,
      baseLayerWeek,
      groupMembers: [odUserId],
      players: [{ odUserId, picks: [] }],
    },
  });

  it('BLOCKS: a user holding a slot seat for the SAME battle week cannot quick-play', async () => {
    const { db } = withRankings(slotPod('u1', BATTLE_WEEK));
    await expect(quickPlay(db, { odUserId: 'u1', now: NOW }))
      .rejects.toThrow(/^already_in_competitive/);
  });

  it('does NOT block: a slot seat for a DIFFERENT battle week', async () => {
    const { db, store } = withRankings(slotPod('u1', '2099-W01'));
    const res = await quickPlay(db, { odUserId: 'u1', now: NOW });
    expect(store.get(`tournamentGroups/${res.groupId}`).status).toBe(GROUP_STATUS.FORMING);
  });

  it('does NOT block: a training pod in the same battle week (isTraining never counts)', async () => {
    const seed = slotPod('u1', BATTLE_WEEK, 'training-pod-1');
    seed['tournamentGroups/training-pod-1'].isTraining = true;
    delete seed['tournamentGroups/training-pod-1'].isLiveDraft;
    const { db, store } = withRankings(seed);
    const res = await quickPlay(db, { odUserId: 'u1', now: NOW });
    expect(store.get(`tournamentGroups/${res.groupId}`).status).toBe(GROUP_STATUS.FORMING);
  });

  it('does NOT block the TRAINING direction either: a slot seat never blocks starting a training pod', async () => {
    // The reciprocal of "training never blocks": training is never BLOCKED.
    // formTrainingDraft reaches this path via quickPlay({isTraining:true});
    // holding a same-battle-week slot seat must not reject practice.
    const { db, store } = withRankings(slotPod('u1', BATTLE_WEEK));
    const res = await quickPlay(db, { odUserId: 'u1', now: NOW, isTraining: true });
    const group = store.get(`tournamentGroups/${res.groupId}`);
    expect(group.status).toBe(GROUP_STATUS.FORMING);
    expect(group.isTraining).toBe(true);
  });

  it('same-lobby re-entry is unaffected: alreadyFormed returns BEFORE the guard', async () => {
    const { db, store } = withRankings();
    const { id } = await createLobby(db, { createdBy: 'u1', now: NOW });
    const first = await formGroupFromLobby(db, id, { now: NOW }); // forms clean
    expect(first.alreadyFormed).toBe(false);
    // A conflicting slot seat claimed AFTER formation must not break the
    // idempotent re-entry of the already-formed lobby.
    Object.entries(slotPod('u1', BATTLE_WEEK)).forEach(([path, doc]) => store.set(path, doc));
    const again = await formGroupFromLobby(db, id, { now: NOW });
    expect(again.alreadyFormed).toBe(true);
    expect(again.groupId).toBe(first.groupId);
  });

  it('a multi-human lobby is blocked when ANY member holds a same-battle-week game', async () => {
    const { db } = withRankings(slotPod('u2', BATTLE_WEEK));
    const { id } = await createLobby(db, { createdBy: 'u1', now: NOW });
    await joinLobby(db, id, { odUserId: 'u2', now: NOW });
    await expect(formGroupFromLobby(db, id, { now: NOW }))
      .rejects.toThrow(/already holds/);
  });
});
