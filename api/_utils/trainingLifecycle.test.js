// api/_utils/trainingLifecycle.test.js
//
// League Training Slice 1 battery: the next-open ANCHOR (DST matrix), the
// AWAITING_OPEN → BATTLE flip (DATE-based — incl. the load-bearing winter/EST
// case a timestamp compare would miss), and the rolling COMPLETION (any
// weekday + idempotency + ranked inertness).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// trainingLifecycle.js IS the runtime guard that its transitive api/ -> src/
// import surface stays Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  nextMarketOpenAnchor,
  flipAwaitingOpenPods,
  completeBankedTrainingPods,
  applyTrainingPick,
  completeTrainingDraft,
  sweepIdleDraftingPods,
} from './trainingLifecycle.js';
import { GROUP_STATUS, PICKS_PER_PLAYER } from '../../src/constants/leagueTournament.js';
import { generateSnakeOrder } from '../../src/services/draftAssets.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE (shared makeDb idiom) ====================

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

  function makeDocRef(path) {
    return {
      path,
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

  function makeCollection(prefix) {
    return {
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      where: (field, op, value) => ({
        select: () => ({ get: async () => snapshotOf(filterDocs(field, value)) }),
        get: async () => snapshotOf(filterDocs(field, value)),
      }),
      get: async () => snapshotOf(topLevelDocs(prefix)),
    };
    function filterDocs(field, value) {
      return topLevelDocs(prefix).filter(d => d.data()[field] === value);
    }
    function snapshotOf(docs) {
      return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
    }
  }

  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      update: (ref, updates) => {
        const data = store.get(ref.path);
        if (data === undefined) throw new Error(`tx.update on missing doc ${ref.path}`);
        applyDotPathUpdate(data, updates);
        writeLog.push(['tx.update', ref.path]);
      },
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); writeLog.push(['tx.set', ref.path]); },
    }),
  };

  return { db, store, writeLog };
}

// ==================== FIXTURES ====================

const FOUR_PLAYERS = [
  { odUserId: 'u1', isCpu: false },
  { odUserId: 'u2', isCpu: true },
  { odUserId: 'u3', isCpu: true },
  { odUserId: 'u4', isCpu: true },
];

function bankedDays(n) {
  const dailyScores = {};
  for (let d = 1; d <= n; d++) dailyScores[`day${d}`] = { recordedDate: `2026-06-${String(d + 9).padStart(2, '0')}`, closeScores: {} };
  return dailyScores;
}

function awaitingPod(anchorEtDate, extra = {}) {
  return {
    status: GROUP_STATUS.AWAITING_OPEN,
    isTraining: true,
    players: FOUR_PLAYERS,
    startAnchor: { anchorEtDate, anchorIso: `${anchorEtDate}T13:30:00.000Z` },
    ...extra,
  };
}

function battleTrainingPod(dayN, extra = {}) {
  return {
    status: GROUP_STATUS.BATTLE,
    isTraining: true,
    players: FOUR_PLAYERS,
    dailyScores: bankedDays(dayN),
    ...extra,
  };
}

// ==================== ANCHOR (pure, DST matrix) ====================
// Reference weekdays (repo anchor: 2026-06-19 is Friday + Juneteenth holiday):
//   Jun 15 Mon · 16 Tue · 17 Wed · 18 Thu · 19 Fri(HOL) · 20 Sat · 22 Mon
//   Jun 26 Fri · 29 Mon · Jan 21 2026 Wed (EST, non-holiday).

describe('nextMarketOpenAnchor', () => {
  it('before 09:30 ET on a trading day → today (EDT)', () => {
    // 13:00 UTC = 09:00 ET (EDT, UTC-4), Wed Jun 17.
    const a = nextMarketOpenAnchor(new Date('2026-06-17T13:00:00.000Z'));
    expect(a.anchorEtDate).toBe('2026-06-17');
    expect(a.anchorIso).toBe('2026-06-17T13:30:00.000Z'); // 09:30 EDT
  });

  it('after 09:30 ET → next trading day', () => {
    // 14:00 UTC = 10:00 ET, Wed Jun 17 → Thu Jun 18.
    expect(nextMarketOpenAnchor(new Date('2026-06-17T14:00:00.000Z')).anchorEtDate).toBe('2026-06-18');
  });

  it('skips a holiday (Thu after open → Fri is Juneteenth → Mon)', () => {
    // 18:00 UTC = 14:00 ET, Thu Jun 18 → Fri Jun 19 (holiday) → Mon Jun 22.
    expect(nextMarketOpenAnchor(new Date('2026-06-18T18:00:00.000Z')).anchorEtDate).toBe('2026-06-22');
  });

  it('Friday afternoon → Monday (skips the weekend)', () => {
    // 18:00 UTC = 14:00 ET, Fri Jun 26 → Mon Jun 29.
    expect(nextMarketOpenAnchor(new Date('2026-06-26T18:00:00.000Z')).anchorEtDate).toBe('2026-06-29');
  });

  it('weekend → Monday', () => {
    // Sat Jun 20 → Mon Jun 22.
    expect(nextMarketOpenAnchor(new Date('2026-06-20T18:00:00.000Z')).anchorEtDate).toBe('2026-06-22');
  });

  it('winter/EST: before open → today, anchorIso is the 09:30 EST instant (14:30 UTC)', () => {
    // 14:00 UTC = 09:00 ET (EST, UTC-5), Wed Jan 21.
    const a = nextMarketOpenAnchor(new Date('2026-01-21T14:00:00.000Z'));
    expect(a.anchorEtDate).toBe('2026-01-21');
    expect(a.anchorIso).toBe('2026-01-21T14:30:00.000Z'); // 09:30 EST, DST-correct
  });
});

// ==================== FLIP (date-based) ====================

describe('flipAwaitingOpenPods', () => {
  it('pending before the anchor date — pod stays AWAITING_OPEN', async () => {
    const { db, store } = makeDb({ 'tournamentGroups/p1': awaitingPod('2026-06-18') });
    const r = await flipAwaitingOpenPods(db, { now: new Date('2026-06-17T13:00:00.000Z') }); // Wed, anchor Thu
    expect(r).toMatchObject({ flipped: 0, pending: 1 });
    expect(store.get('tournamentGroups/p1').status).toBe(GROUP_STATUS.AWAITING_OPEN);
  });

  it('flips on the anchor date → BATTLE', async () => {
    const { db, store } = makeDb({ 'tournamentGroups/p1': awaitingPod('2026-06-17') });
    const r = await flipAwaitingOpenPods(db, { now: new Date('2026-06-17T13:00:00.000Z') });
    expect(r).toMatchObject({ flipped: 1, pending: 0 });
    expect(store.get('tournamentGroups/p1').status).toBe(GROUP_STATUS.BATTLE);
    expect(store.get('tournamentGroups/p1').startAnchor.anchorEtDate).toBe('2026-06-17'); // retained
  });

  it('WINTER/EST: a 09:00 ET morning tick on the anchor day STILL flips (date-based, not timestamp)', async () => {
    // The load-bearing case: 09:00 ET EST (14:00 UTC) is before the 09:30 open
    // AND before the 14:30 UTC anchorIso — a timestamp compare would NOT flip.
    const { db, store } = makeDb({ 'tournamentGroups/p1': awaitingPod('2026-01-21') });
    const r = await flipAwaitingOpenPods(db, { now: new Date('2026-01-21T14:00:00.000Z') });
    expect(r.flipped).toBe(1);
    expect(store.get('tournamentGroups/p1').status).toBe(GROUP_STATUS.BATTLE);
  });

  it('catch-up: flips a pod whose anchor date already passed', async () => {
    const { db, store } = makeDb({ 'tournamentGroups/p1': awaitingPod('2026-06-16') });
    await flipAwaitingOpenPods(db, { now: new Date('2026-06-18T13:00:00.000Z') }); // two days later
    expect(store.get('tournamentGroups/p1').status).toBe(GROUP_STATUS.BATTLE);
  });

  it('idempotent: a second sweep finds no AWAITING_OPEN pods and writes nothing', async () => {
    const { db, writeLog } = makeDb({ 'tournamentGroups/p1': awaitingPod('2026-06-17') });
    await flipAwaitingOpenPods(db, { now: new Date('2026-06-17T13:00:00.000Z') });
    const writesAfterFirst = writeLog.length;
    const r2 = await flipAwaitingOpenPods(db, { now: new Date('2026-06-17T13:10:00.000Z') });
    expect(r2).toMatchObject({ swept: 0, flipped: 0 });
    expect(writeLog.length).toBe(writesAfterFirst);
  });

  it('ranked inertness: a BATTLE/FORMING group is never swept (AWAITING_OPEN is training-only)', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/ranked-battle': { status: GROUP_STATUS.BATTLE, players: FOUR_PLAYERS },
      'tournamentGroups/ranked-forming': { status: GROUP_STATUS.FORMING, players: FOUR_PLAYERS },
    });
    const r = await flipAwaitingOpenPods(db, { now: new Date('2026-06-17T13:00:00.000Z') });
    expect(r).toMatchObject({ swept: 0, flipped: 0 });
    expect(store.get('tournamentGroups/ranked-battle').status).toBe(GROUP_STATUS.BATTLE);
    expect(store.get('tournamentGroups/ranked-forming').status).toBe(GROUP_STATUS.FORMING);
  });
});

// ==================== ROLLING COMPLETION ====================

describe('completeBankedTrainingPods', () => {
  const TUE_NIGHT = new Date('2026-06-16T21:15:00.000Z'); // Tuesday — proves "any weekday"

  it('completes a training pod whose week banked (dayN ≥ 5), on a non-Friday night', async () => {
    const { db, store } = makeDb({ 'tournamentGroups/t5': battleTrainingPod(5) });
    const r = await completeBankedTrainingPods(db, { now: TUE_NIGHT });
    expect(r).toMatchObject({ groups: 1, completed: 1, skipped: 0, errors: 0 });
    expect(store.get('tournamentGroups/t5').status).toBe(GROUP_STATUS.COMPLETE);
  });

  it('does NOT complete before the 5th day banks (dayN = 4 → skipped)', async () => {
    const { db, store } = makeDb({ 'tournamentGroups/t4': battleTrainingPod(4) });
    const r = await completeBankedTrainingPods(db, { now: TUE_NIGHT });
    expect(r).toMatchObject({ groups: 1, completed: 0, skipped: 1 });
    expect(store.get('tournamentGroups/t4').status).toBe(GROUP_STATUS.BATTLE);
  });

  it('idempotent: a re-run completes nothing (the pod already left BATTLE)', async () => {
    const { db, writeLog } = makeDb({ 'tournamentGroups/t5': battleTrainingPod(5) });
    await completeBankedTrainingPods(db, { now: TUE_NIGHT });
    const writesAfterFirst = writeLog.length;
    const r2 = await completeBankedTrainingPods(db, { now: TUE_NIGHT });
    expect(r2).toMatchObject({ groups: 0, completed: 0 });
    expect(writeLog.length).toBe(writesAfterFirst);
  });

  it('ranked inertness: a BATTLE base group with dayN ≥ 5 but no isTraining is NOT completed here', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/ranked5': { status: GROUP_STATUS.BATTLE, players: FOUR_PLAYERS, dailyScores: bankedDays(5) },
    });
    const r = await completeBankedTrainingPods(db, { now: TUE_NIGHT });
    expect(r).toMatchObject({ groups: 0, completed: 0 });
    expect(store.get('tournamentGroups/ranked5').status).toBe(GROUP_STATUS.BATTLE); // Friday advancement owns ranked
  });
});

// ==================== SLICE 2 — INTERACTIVE DRAFT ====================
// Seats: u1 is the lone human at seat 0; cpu-1/2/3 are CPU seats. With
// generateSnakeOrder(4,3) = [0,1,2,3, 3,2,1,0, 0,1,2,3], the human picks at
// pick-indices 0, 7, 8 — so a single human pick at index 0 triggers a 6-deep
// CPU run-up that comes to rest at index 7 (the human again).

const POOL = Array.from({ length: 20 }, (_, i) => `S${i}`);
const DRAFT_MEMBERS = ['u1', 'cpu-1', 'cpu-2', 'cpu-3'];
const DRAFT_PLAYERS = [
  { odUserId: 'u1', picks: [] },
  { odUserId: 'cpu-1', picks: [], isCpu: true },
  { odUserId: 'cpu-2', picks: [], isCpu: true },
  { odUserId: 'cpu-3', picks: [], isCpu: true },
];

function draftingPod(extra = {}) {
  return {
    status: GROUP_STATUS.DRAFTING,
    isTraining: true,
    roundNumber: 1,
    baseLayerWeek: 1,
    groupMembers: DRAFT_MEMBERS,
    players: DRAFT_PLAYERS.map(p => ({ ...p, picks: [] })),
    userPool: [...POOL],
    ...extra,
  };
}

function draftState(extra = {}) {
  return {
    status: 'drafting',
    snakeOrder: generateSnakeOrder(4, PICKS_PER_PLAYER),
    currentPickIndex: 0,
    pool: [...POOL],
    taken: [],
    picksByUser: Object.fromEntries(DRAFT_MEMBERS.map(id => [id, []])),
    events: [],
    humanArchetype: 'analyst',
    humanId: 'u1',
    startedAt: '2026-06-17T12:00:00.000Z',
    lastActivityAt: '2026-06-17T12:00:00.000Z',
    ...extra,
  };
}

function seedDrafting(id = 'd1', { podExtra = {}, stateExtra = {} } = {}) {
  return makeDb({
    [`tournamentGroups/${id}`]: draftingPod(podExtra),
    [`tournamentGroups/${id}/draft/state`]: draftState(stateExtra),
  });
}

// 09:00 ET (before the 09:30 open) on Wed Jun 17 — a today-anchor instant.
const BEFORE_OPEN = new Date('2026-06-17T13:00:00.000Z');
// 10:00 ET (after the open) on Wed Jun 17 — anchors to the NEXT trading day.
const AFTER_OPEN = new Date('2026-06-17T14:00:00.000Z');

describe('applyTrainingPick — live snake', () => {
  it('rejects a pick when it is not that human seat on the clock', async () => {
    const { db } = seedDrafting();
    await expect(applyTrainingPick(db, 'd1', { odUserId: 'cpu-1', symbol: 'S5', now: BEFORE_OPEN }))
      .rejects.toThrow(/not_your_turn/);
  });

  it('rejects an off-board / already-taken symbol', async () => {
    const { db } = seedDrafting();
    await expect(applyTrainingPick(db, 'd1', { odUserId: 'u1', symbol: 'NOPE', now: BEFORE_OPEN }))
      .rejects.toThrow(/invalid_pick/);
  });

  it('a human pick advances the clock and runs the CPUs up to the next human turn', async () => {
    const { db, store } = seedDrafting();
    const r = await applyTrainingPick(db, 'd1', { odUserId: 'u1', symbol: 'S0', now: BEFORE_OPEN });
    expect(r).toMatchObject({ complete: false, status: GROUP_STATUS.DRAFTING, currentPickIndex: 7 });
    const state = store.get('tournamentGroups/d1/draft/state');
    expect(state.picksByUser.u1).toEqual(['S0']);        // the human's choice
    expect(state.taken).toHaveLength(7);                  // human + 6 CPU run-up picks
    expect(new Set(state.taken).size).toBe(7);            // pool exclusivity
    expect(state.events).toHaveLength(7);
    expect(state.events[0]).toMatchObject({ odUserId: 'u1', symbol: 'S0', liveSource: 'human' });
    expect(state.events[1].liveSource).toBe('cpu');
    // The group doc is untouched mid-draft (churn rides the sibling state doc).
    expect(store.get('tournamentGroups/d1').status).toBe(GROUP_STATUS.DRAFTING);
    expect(store.get('tournamentGroups/d1').players.every(p => p.picks.length === 0)).toBe(true);
  });

  it('the 12th pick hands off transition-only → BATTLE inline on a today-anchor (R1)', async () => {
    const { db, store } = seedDrafting();
    // Human picks at indices 0, 7, 8 (three calls); autopick (no universe seeded
    // → best-available) drives picks 2 and 3.
    let r = await applyTrainingPick(db, 'd1', { odUserId: 'u1', symbol: 'S0', now: BEFORE_OPEN });
    expect(r.currentPickIndex).toBe(7);
    r = await applyTrainingPick(db, 'd1', { odUserId: 'u1', autopick: true, now: BEFORE_OPEN });
    expect(r).toMatchObject({ complete: false, currentPickIndex: 8 });
    r = await applyTrainingPick(db, 'd1', { odUserId: 'u1', autopick: true, now: BEFORE_OPEN });
    expect(r).toMatchObject({ complete: true, status: GROUP_STATUS.BATTLE }); // inline flip

    const group = store.get('tournamentGroups/d1');
    expect(group.status).toBe(GROUP_STATUS.BATTLE);
    expect(group.startAnchor.anchorEtDate).toBe('2026-06-17'); // anchor stamped at handoff
    // Byte-identical downstream: every seat holds 3 createPickState picks.
    for (const p of group.players) {
      expect(p.picks).toHaveLength(PICKS_PER_PLAYER);
      for (const pick of p.picks) {
        expect(pick).toHaveProperty('symbol');
        expect(Array.isArray(pick.legs)).toBe(true);
        expect(pick.legs[0].baselineSource).toBe('draft_resolution');
        expect(pick.legs[0].baselinePrice).toBeNull();
        expect(pick.flipCountToday).toBe(0);
      }
    }
    // userPool is the post-draft remainder (12 names removed), order preserved.
    expect(group.userPool).toHaveLength(POOL.length - 12);
    // The playback stream lands in the same shape the resolver writes.
    const stream = store.get('tournamentGroups/d1/streams/userDraft');
    expect(stream.events).toHaveLength(12);
    expect(stream).toHaveProperty('resolvedAt');
    expect(stream.roundNumber).toBe(1);
  });

  it('a draft finished after the open waits in AWAITING_OPEN (anchor = next trading day)', async () => {
    const { db, store } = seedDrafting();
    await applyTrainingPick(db, 'd1', { odUserId: 'u1', symbol: 'S0', now: AFTER_OPEN });
    await applyTrainingPick(db, 'd1', { odUserId: 'u1', autopick: true, now: AFTER_OPEN });
    const r = await applyTrainingPick(db, 'd1', { odUserId: 'u1', autopick: true, now: AFTER_OPEN });
    expect(r).toMatchObject({ complete: true, status: GROUP_STATUS.AWAITING_OPEN });
    const group = store.get('tournamentGroups/d1');
    expect(group.status).toBe(GROUP_STATUS.AWAITING_OPEN);
    expect(group.startAnchor.anchorEtDate).toBe('2026-06-18'); // Thu Jun 18
  });
});

describe('completeTrainingDraft — idempotent handoff', () => {
  it('a re-fire after completion is an idempotent skip (illegal transition swallowed)', async () => {
    const { db, store } = seedDrafting();
    await applyTrainingPick(db, 'd1', { odUserId: 'u1', symbol: 'S0', now: BEFORE_OPEN });
    await applyTrainingPick(db, 'd1', { odUserId: 'u1', autopick: true, now: BEFORE_OPEN });
    await applyTrainingPick(db, 'd1', { odUserId: 'u1', autopick: true, now: BEFORE_OPEN });
    expect(store.get('tournamentGroups/d1').status).toBe(GROUP_STATUS.BATTLE);
    // The pod already left DRAFTING — completeTrainingDraft must skip, not throw.
    const r = await completeTrainingDraft(db, 'd1', { now: BEFORE_OPEN });
    expect(r.skipped).toBe(true);
    expect(store.get('tournamentGroups/d1').status).toBe(GROUP_STATUS.BATTLE);
  });

  it('refuses to complete a draft that is not finished', async () => {
    const { db } = seedDrafting();
    await expect(completeTrainingDraft(db, 'd1', { now: BEFORE_OPEN })).rejects.toThrow(/draft_incomplete/);
  });
});

describe('sweepIdleDraftingPods — abandonment', () => {
  it('auto-completes an IDLE zero-pick draft and flips it (today-anchor) within the sweep', async () => {
    const { db, store } = seedDrafting('idle', {
      stateExtra: { lastActivityAt: '2026-06-17T05:00:00.000Z' }, // 8h before the tick
    });
    const r = await sweepIdleDraftingPods(db, { now: BEFORE_OPEN });
    expect(r).toMatchObject({ swept: 1, completed: 1, active: 0 });
    const group = store.get('tournamentGroups/idle');
    expect(group.status).toBe(GROUP_STATUS.BATTLE); // R1 inline flip inside the sweep
    expect(group.players.every(p => p.picks.length === PICKS_PER_PLAYER)).toBe(true);
  });

  it('NEVER interrupts an ACTIVE draft (lastActivityAt within the threshold)', async () => {
    const { db, store } = seedDrafting('active', {
      stateExtra: { lastActivityAt: '2026-06-17T12:59:00.000Z' }, // 1 min before the tick
    });
    const r = await sweepIdleDraftingPods(db, { now: BEFORE_OPEN });
    expect(r).toMatchObject({ swept: 1, completed: 0, active: 1 });
    expect(store.get('tournamentGroups/active').status).toBe(GROUP_STATUS.DRAFTING);
  });

  it('ranked inertness: a DRAFTING group without isTraining is never swept', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/ranked': { status: GROUP_STATUS.DRAFTING, players: FOUR_PLAYERS },
    });
    const r = await sweepIdleDraftingPods(db, { now: BEFORE_OPEN });
    expect(r).toMatchObject({ swept: 0, completed: 0 });
    expect(store.get('tournamentGroups/ranked').status).toBe(GROUP_STATUS.DRAFTING);
  });
});
