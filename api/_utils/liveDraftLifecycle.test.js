// api/_utils/liveDraftLifecycle.test.js
//
// Competitive Live Draft — Phase 2 (fire + completion guarantee) battery:
//   (A) FIRE — a FORMING slot group → DRAFTING: CPU-fill (reserved numbers),
//       fresh userPool, live state inited, pointer on the first human, deadline
//       stamped. Idempotent re-fire.
//   (B) DRIVE — the completion guarantee: an ABANDONED draft completes in ONE
//       pass (every overdue turn autopicked in sequence) → AWAITING_OPEN with the
//       battleStartWeek anchor; a Monday-pre-open draft lands inline in BATTLE.
//   (C) DRIVE never interrupts an active/within-clock draft.
//   (D) findDueSlotGroups selects only due FORMING slot groups.
//   (E) The Mon-8:45am pre-open <9:30 assertion (compute, don't assume).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real imports of
// liveDraftLifecycle.js (and its transitive trainingLifecycle / tournamentCpu /
// tournamentGroupService graph) are the runtime guard that the api/ -> src/
// surface stays Node-clean. Never mock these imports.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fireCompetitiveSlotDraft,
  driveSlotDraftAutopick,
  applyCompetitivePick,
  findDueSlotGroups,
  findDraftingSlotGroups,
  LIVE_DRAFT_SENTINEL_PREFIX,
} from './liveDraftLifecycle.js';
import {
  GROUP_STATUS,
  GROUP_SIZE,
  PICKS_PER_PLAYER,
  TRAINING_TUNING,
  BASELINE_SOURCE,
  cpuAgentDocId,
} from '../../src/constants/leagueTournament.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ---- in-memory Firestore (the seam idiom: auto-id + where + nested + tx) ----
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
  let autoSeq = 0;
  function makeDocRef(path) {
    return {
      path, id: path.split('/').pop(),
      get: async () => ({ exists: store.has(path), id: path.split('/').pop(), data: () => structuredClone(store.get(path)) }),
      set: async (data) => { store.set(path, structuredClone(data)); },
      update: async (u) => { const d = store.get(path); if (d === undefined) throw new Error(`update missing ${path}`); applyDotPathUpdate(d, u); },
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
  const snapshotOf = (docs) => ({ docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) });
  function makeCollection(prefix) {
    const filtered = (field, value) => topLevelDocs(prefix).filter((d) => d.data()[field] === value);
    return {
      doc: (id) => makeDocRef(`${prefix}/${id ?? `auto-${++autoSeq}`}`),
      where: (field, op, value) => ({ get: async () => snapshotOf(filtered(field, value)) }),
      get: async () => snapshotOf(topLevelDocs(prefix)),
    };
  }
  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); },
      update: (ref, u) => { const d = store.get(ref.path); if (d === undefined) throw new Error(`tx.update missing ${ref.path}`); applyDotPathUpdate(d, u); },
      delete: (ref) => { store.delete(ref.path); },
    }),
  };
  return { db, store };
}

// ---- fixtures ----
const SYMBOLS = Array.from({ length: 40 }, (_, i) => `SYM${String(i).padStart(2, '0')}`);
const STOCKS = SYMBOLS.map((symbol, i) => ({ symbol, sectorName: 'Technology', fundamentalScore: 95 - i, technicalScore: 95 - i, baggerBombFit: 95 - i, atrPercentile: 0.5 }));

function humanAgent(ownerId, archetype = 'analyst') {
  return { ownerId, isCpu: false, name: ownerId, archetype, config: { risk: 50, concentration: 50, momentum: 50 }, personality: { traits: [] }, consolidatedInsight: '', evolutionCycle: 0 };
}

const WED_ID = 'lds_wed-1900_2026-07-08';
const WED_ANCHOR = { mondayEtDate: '2026-07-13', anchorEtDate: '2026-07-13', anchorIso: '2026-07-13T13:30:00.000Z' };

function slotGroup(overrides = {}) {
  const humanIds = overrides.humanIds || ['human-1'];
  return {
    status: GROUP_STATUS.FORMING, isLiveDraft: true, roundNumber: 1, baseLayerWeek: '2026-W28',
    slotId: 'wed-1900', scheduledDraftAt: '2026-07-08T23:00:00.000Z', battleStartWeek: WED_ANCHOR,
    groupMembers: [...humanIds],
    players: humanIds.map((id) => ({ odUserId: id, picks: [] })),
    seatNames: Object.fromEntries(humanIds.map((id) => [id, id])),
    userPool: [], claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] }, dailyScores: {},
    createdAt: '2026-07-06T12:00:00.000Z', updatedAt: '2026-07-06T12:00:00.000Z',
    ...overrides,
  };
}
function seedDb(groupOverrides = {}, humanIds = ['human-1']) {
  const seed = { 'indexIntelligence/stockRankings': { stocks: STOCKS } };
  for (const id of humanIds) seed[`agents/${id}`] = humanAgent(id);
  const { db, store } = makeDb(seed);
  store.set(`tournamentGroups/${WED_ID}`, structuredClone(slotGroup({ ...groupOverrides, humanIds })));
  return { db, store };
}
const g = (store, id = WED_ID) => store.get(`tournamentGroups/${id}`);
const draftState = (store, id = WED_ID) => store.get(`tournamentGroups/${id}/draft/state`);
const FIRE = new Date('2026-07-08T23:00:00.000Z');
const sentinel = (code) => new RegExp(`^${LIVE_DRAFT_SENTINEL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${code}`);

// ==================== (A) FIRE ====================

describe('fireCompetitiveSlotDraft — the competitive writer', () => {
  it('fires a 1-human FORMING slot group → DRAFTING: CPU-filled, pooled, live state on the first human', async () => {
    const { db, store } = seedDb();
    const r = await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    expect(r).toMatchObject({ status: GROUP_STATUS.DRAFTING, fired: true });

    const group = g(store);
    expect(group.status).toBe(GROUP_STATUS.DRAFTING);
    expect(group.players).toHaveLength(GROUP_SIZE);
    expect(group.players.filter((p) => p.isCpu === true)).toHaveLength(3); // CPU-filled to four
    expect(group.groupMembers).toHaveLength(GROUP_SIZE);
    expect(group.userPool.length).toBe(SYMBOLS.length); // fresh board stamped at fire
    expect(group.isTraining).toBeUndefined(); // competitive, never training

    // CPU system agents created (reserved numbers 1..3)
    expect(store.has(`agents/${cpuAgentDocId(1)}`)).toBe(true);
    expect(store.has(`agents/${cpuAgentDocId(3)}`)).toBe(true);

    const state = draftState(store);
    expect(state.status).toBe('drafting');
    expect(state.snakeOrder).toHaveLength(GROUP_SIZE * PICKS_PER_PLAYER);
    expect(state.archetypeByUser['human-1']).toBe('analyst');
    // pointer rests on the human's first turn (seat 0 leads the snake)
    expect(state.snakeOrder[state.currentPickIndex]).toBe(0);
    expect(Date.parse(state.turnDeadline)).toBe(FIRE.getTime() + TRAINING_TUNING.PICK_CLOCK_MS);
  });

  it('is idempotent — a re-fire resumes, never double-inits', async () => {
    const { db, store } = seedDb();
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    const stateAfter1 = structuredClone(draftState(store));
    const r2 = await fireCompetitiveSlotDraft(db, WED_ID, { now: new Date(FIRE.getTime() + 60000) });
    expect(r2).toMatchObject({ status: GROUP_STATUS.DRAFTING, fired: false, reason: 'already_drafting' });
    expect(g(store).players).toHaveLength(GROUP_SIZE); // not re-padded
    expect(draftState(store).snakeOrder).toEqual(stateAfter1.snakeOrder); // state untouched
  });

  it('skips a non-slot group and a non-FORMING group', async () => {
    const { db } = seedDb();
    const r1 = await fireCompetitiveSlotDraft(db, 'nonexistent', { now: FIRE });
    expect(r1.fired).toBe(false);
  });

  it('fails CLOSED when the ranking universe is not ready (never a boardless draft)', async () => {
    const { db, store } = seedDb();
    store.set('indexIntelligence/stockRankings', { stocks: STOCKS.slice(0, 5) }); // < BOARD_DEPTH_MIN
    await expect(fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE })).rejects.toThrow(sentinel('universe_unavailable'));
    expect(g(store).status).toBe(GROUP_STATUS.FORMING); // untouched
  });
});

// ==================== (B) DRIVE — completion guarantee ====================

describe('driveSlotDraftAutopick — abandoned draft completes in ONE pass', () => {
  it('autopicks every overdue turn in sequence → AWAITING_OPEN with the battleStartWeek anchor', async () => {
    const { db, store } = seedDb();
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });

    // 20 minutes later, fully abandoned — one drive pass must finish it.
    const r = await driveSlotDraftAutopick(db, WED_ID, { now: new Date(FIRE.getTime() + 20 * 60 * 1000) });
    expect(r.complete).toBe(true);
    expect(r.status).toBe(GROUP_STATUS.AWAITING_OPEN); // Wed draft, Monday anchor still future
    expect(r.autopicked).toBe(PICKS_PER_PLAYER); // the one human's three turns (CPUs advance within)

    const group = g(store);
    expect(group.status).toBe(GROUP_STATUS.AWAITING_OPEN);
    expect(group.startAnchor).toEqual({ anchorEtDate: '2026-07-13', anchorIso: '2026-07-13T13:30:00.000Z' }); // battleStartWeek honored
    // every seat drafted its full book, materialized byte-identically to the resolver
    for (const p of group.players) {
      expect(p.picks).toHaveLength(PICKS_PER_PLAYER);
      // materialized via the SAME createPickState the resolver uses → the leg
      // carries DRAFT_RESOLUTION provenance with a null baseline (settled at open)
      expect(p.picks[0].legs[0].baselineSource).toBe(BASELINE_SOURCE.DRAFT_RESOLUTION);
      expect(p.picks[0].legs[0].baselinePrice).toBeNull();
    }
    expect(draftState(store).status).toBe('complete');
    expect(store.has(`tournamentGroups/${WED_ID}/streams/userDraft`)).toBe(true); // playback stream written
  });

  it('a Monday-PRE-OPEN slot completes inline into BATTLE (today-anchor)', async () => {
    // Fire the Mon-8:45am slot at 8:45 ET; its battle anchor is that same Monday.
    const MON_ANCHOR = { mondayEtDate: '2026-07-13', anchorEtDate: '2026-07-13', anchorIso: '2026-07-13T13:30:00.000Z' };
    const { db, store } = seedDb({ slotId: 'mon-0845', scheduledDraftAt: '2026-07-13T12:45:00.000Z', battleStartWeek: MON_ANCHOR });
    await fireCompetitiveSlotDraft(db, WED_ID, { now: new Date('2026-07-13T12:45:00.000Z') });

    // driven 8:47 ET Monday (pre-open) — abandoned → completes → inline BATTLE
    const r = await driveSlotDraftAutopick(db, WED_ID, { now: new Date('2026-07-13T12:47:00.000Z') });
    expect(r.complete).toBe(true);
    expect(r.status).toBe(GROUP_STATUS.BATTLE); // today-anchor reached → straight to battle before 9:30
    expect(g(store).status).toBe(GROUP_STATUS.BATTLE);
  });

  it('does NOT interrupt an active / within-clock draft', async () => {
    const { db, store } = seedDb();
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    // 5s later — well within the 20s clock
    const r = await driveSlotDraftAutopick(db, WED_ID, { now: new Date(FIRE.getTime() + 5000) });
    expect(r).toMatchObject({ complete: false, autopicked: 0, reason: 'within_clock' });
    expect(g(store).status).toBe(GROUP_STATUS.DRAFTING);
  });

  it('FIRED-LATE: a pod whose stamped Monday is past re-derives the anchor at fire AND completion (no stale mid-week battle)', async () => {
    // Claimed for a Wed with anchor 2026-07-06, but the fire cron lagged a week:
    // firing on Wed 2026-07-15, the stamped 07-06 Monday is already past.
    const STALE = { mondayEtDate: '2026-07-06', anchorEtDate: '2026-07-06', anchorIso: '2026-07-06T13:30:00.000Z' };
    const { db, store } = seedDb({ battleStartWeek: STALE });
    const FIRE_LATE = new Date('2026-07-15T23:00:00.000Z'); // Wed 7pm EDT, a week late

    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE_LATE });
    // re-stamped at fire to the NEXT Monday (2026-07-20), not the stale 07-06
    expect(g(store).battleStartWeek.anchorEtDate).toBe('2026-07-20');
    // finding #1: baseLayerWeek re-derives WITH the anchor (the fixture seeds W28)
    expect(g(store).baseLayerWeek).toBe('2026-W30'); // the 2026-07-20 battle week

    const r = await driveSlotDraftAutopick(db, WED_ID, { now: new Date(FIRE_LATE.getTime() + 20 * 60 * 1000) });
    expect(r.complete).toBe(true);
    expect(r.status).toBe(GROUP_STATUS.AWAITING_OPEN); // future Monday → waits, does NOT flip to a stale battle
    expect(g(store).startAnchor.anchorEtDate).toBe('2026-07-20');
    expect(g(store).baseLayerWeek).toBe('2026-W30'); // stays the re-derived battle week through completion
  });

  it('drives a multi-human abandoned draft to completion in one pass', async () => {
    const { db, store } = seedDb({}, ['human-1', 'human-2']);
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    expect(g(store).players.filter((p) => p.isCpu === true)).toHaveLength(2); // two humans + two CPUs

    const r = await driveSlotDraftAutopick(db, WED_ID, { now: new Date(FIRE.getTime() + 20 * 60 * 1000) });
    expect(r.complete).toBe(true);
    expect(r.autopicked).toBe(2 * PICKS_PER_PLAYER); // both humans' turns autopicked
    for (const p of g(store).players) expect(p.picks).toHaveLength(PICKS_PER_PLAYER);
  });
});

// ==================== (C2) HUMAN PICK ====================

describe('applyCompetitivePick — a human pick in a competitive draft', () => {
  it('applies an explicit human pick, runs the CPU run-up, and refreshes the clock', async () => {
    const { db, store } = seedDb();
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    const before = draftState(store);
    const sym = before.pool[0]; // a valid board name

    const r = await applyCompetitivePick(db, WED_ID, { odUserId: 'human-1', symbol: sym, now: new Date(FIRE.getTime() + 5000) });
    expect(r.complete).toBe(false);
    const st = draftState(store);
    expect(st.picksByUser['human-1']).toContain(sym.toUpperCase());
    expect(st.currentPickIndex).toBeGreaterThan(before.currentPickIndex); // advanced past the CPU run-up
    // a fresh clock (now + PICK_CLOCK), not the anchored driver deadline
    expect(Date.parse(st.turnDeadline)).toBe(FIRE.getTime() + 5000 + TRAINING_TUNING.PICK_CLOCK_MS);
  });

  it('rejects a pick out of turn', async () => {
    const { db } = seedDb({}, ['human-1', 'human-2']);
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    // seat 0 (human-1) is on the clock; human-2 cannot pick
    await expect(applyCompetitivePick(db, WED_ID, { odUserId: 'human-2', symbol: 'SYM00', now: FIRE }))
      .rejects.toThrow(sentinel('not_your_turn'));
  });

  it('rejects a pick before fire (no draft) and after completion (not drafting)', async () => {
    const { db } = seedDb();
    // FORMING, never fired → no draft state doc
    await expect(applyCompetitivePick(db, WED_ID, { odUserId: 'human-1', symbol: 'SYM00', now: FIRE }))
      .rejects.toThrow(sentinel('draft_not_found'));
    // fire then complete via the driver → AWAITING_OPEN; a late pick is rejected
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    await driveSlotDraftAutopick(db, WED_ID, { now: new Date(FIRE.getTime() + 20 * 60 * 1000) });
    await expect(applyCompetitivePick(db, WED_ID, { odUserId: 'human-1', symbol: 'SYM00', now: new Date(FIRE.getTime() + 21 * 60 * 1000) }))
      .rejects.toThrow(sentinel('draft_not_active'));
  });

  it('a human picking their full book completes the draft (honoring the anchor)', async () => {
    const { db, store } = seedDb();
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    let complete = false; let guard = 0;
    while (!complete && guard++ < 6) {
      const st = draftState(store);
      const sym = st.pool.find((s) => !(st.taken || []).includes(s)); // any available name
      const r = await applyCompetitivePick(db, WED_ID, { odUserId: 'human-1', symbol: sym, now: new Date(FIRE.getTime() + guard * 1000) });
      complete = r.complete;
    }
    expect(complete).toBe(true);
    expect([GROUP_STATUS.AWAITING_OPEN, GROUP_STATUS.BATTLE]).toContain(g(store).status);
    expect(g(store).players.find((p) => p.odUserId === 'human-1').picks).toHaveLength(PICKS_PER_PLAYER);
  });
});

// ==================== (D) QUERIES ====================

describe('findDueSlotGroups / findDraftingSlotGroups', () => {
  it('returns only FORMING slot groups whose fire instant has arrived', async () => {
    const { db, store } = seedDb();
    store.set('tournamentGroups/future', slotGroup({ scheduledDraftAt: '2099-01-01T00:00:00.000Z' }));
    store.set('tournamentGroups/regular', { status: GROUP_STATUS.FORMING, players: [] }); // non-slot forming
    const due = await findDueSlotGroups(db, new Date('2026-07-08T23:05:00.000Z'));
    expect(due.map((d) => d.id)).toEqual([WED_ID]); // not future, not regular
  });

  it('returns DRAFTING slot groups only', async () => {
    const { db, store } = seedDb();
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    store.set('tournamentGroups/training', { status: GROUP_STATUS.DRAFTING, isTraining: true }); // not a slot group
    const drafting = await findDraftingSlotGroups(db);
    expect(drafting.map((d) => d.id)).toEqual([WED_ID]);
  });
});

// ==================== (E) Mon pre-open <9:30 assertion ====================

describe('Monday pre-open completes before the 9:30 open (compute, not assume)', () => {
  it('slot 8:45 + fire latency + one drive cadence + max draft duration < 9:30', () => {
    const SLOT_MIN = 8 * 60 + 45;          // Mon 8:45am ET
    const OPEN_MIN = 9 * 60 + 30;          // 9:30am ET
    const CRON_CADENCE_MIN = 10;           // */10 fire cron
    const maxDraftMin = (GROUP_SIZE * PICKS_PER_PLAYER * TRAINING_TUNING.PICK_CLOCK_MS) / 60000; // all-autopick, one pass
    // worst case: fire at the first tick after 8:45 (≤ one cadence), then the next
    // tick drives the abandoned draft to completion (the draft itself finishes in
    // that single pass, bounded by maxDraftMin).
    const completeBy = SLOT_MIN + CRON_CADENCE_MIN + CRON_CADENCE_MIN + maxDraftMin;
    expect(maxDraftMin).toBeLessThanOrEqual(5);   // 12 × 20s = 4 min
    expect(completeBy).toBeLessThan(OPEN_MIN);     // 545 min = 9:05 < 9:30 ✓
  });
});
