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
  expireStaleTrainingPods,
} from './trainingLifecycle.js';
import { GROUP_STATUS, PICKS_PER_PLAYER } from '../../src/constants/leagueTournament.js';
import { generateSnakeOrder } from '../../src/services/draftAssets.js';
import { makeInMemoryDb as makeDb } from './__fixtures__/inMemoryFirestore.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE ====================
// The mock now lives in ./__fixtures__/inMemoryFirestore.js (imported as makeDb
// above) so the R4 canonical-chain regression lock drives the REAL training
// writers against the SAME store this suite uses.

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
    // Mid-draft the group doc's status + players stay untouched (the pick churn
    // rides the sibling state doc) — but B2 bumps progressVersion on EVERY pick so
    // the expiry precondition can detect a resumed draft and never expire it.
    const g = store.get('tournamentGroups/d1');
    expect(g.status).toBe(GROUP_STATUS.DRAFTING);
    expect(g.players.every(p => p.picks.length === 0)).toBe(true);
    expect(g.progressVersion).toBeGreaterThanOrEqual(1); // B2: draft mutation bumped it
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

  it('completes an idle pod even when the state doc has no humanId (derived from the pod players)', async () => {
    const { db, store } = seedDrafting('nohuman', {
      stateExtra: { humanId: undefined, lastActivityAt: '2026-06-17T05:00:00.000Z' },
    });
    const r = await sweepIdleDraftingPods(db, { now: BEFORE_OPEN });
    expect(r).toMatchObject({ swept: 1, completed: 1, errors: 0 });
    expect(store.get('tournamentGroups/nohuman').status).toBe(GROUP_STATUS.BATTLE);
  });

  it('ranked inertness: a DRAFTING group without isTraining is never swept', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/ranked': { status: GROUP_STATUS.DRAFTING, players: FOUR_PLAYERS },
    });
    const r = await sweepIdleDraftingPods(db, { now: BEFORE_OPEN });
    expect(r).toMatchObject({ swept: 0, completed: 0 });
    expect(store.get('tournamentGroups/ranked').status).toBe(GROUP_STATUS.DRAFTING);
  });

  it('competitive inertness: a LIVE-DRAFT (isLiveDraft) DRAFTING pod is never swept — it is the fire cron’s job', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/slot': { status: GROUP_STATUS.DRAFTING, isLiveDraft: true, players: FOUR_PLAYERS },
    });
    const r = await sweepIdleDraftingPods(db, { now: BEFORE_OPEN });
    expect(r).toMatchObject({ swept: 0, completed: 0 });
    expect(store.get('tournamentGroups/slot').status).toBe(GROUP_STATUS.DRAFTING);
  });
});

describe('expireStaleTrainingPods — R3 stale-pod backstop', () => {
  const NOW = new Date('2026-06-17T13:00:00.000Z'); // Wed 09:00 ET
  const OLD = '2026-06-14T00:00:00.000Z';   // > 48h before NOW → stale by age
  const FRESH = '2026-06-17T12:00:00.000Z'; // ~1h before NOW → within threshold

  const formingPod = (updatedAt, extra = {}) => ({
    status: GROUP_STATUS.FORMING, isTraining: true, players: FOUR_PLAYERS,
    createdAt: updatedAt, updatedAt, ...extra,
  });
  const draftingPod = (extra = {}) => ({
    status: GROUP_STATUS.DRAFTING, isTraining: true, players: FOUR_PLAYERS,
    createdAt: OLD, updatedAt: OLD, ...extra,
  });
  const draftStateDoc = (lastActivityAt) => ({ status: 'drafting', startedAt: OLD, lastActivityAt });

  it('expires a FORMING orphan past the threshold; a fresh FORMING pod is left alone', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/stale': formingPod(OLD),
      'tournamentGroups/fresh': formingPod(FRESH),
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r).toMatchObject({ scanned: 2, matched: 1, expired: 1, errors: 0, byStatus: { forming: 1 } });
    const done = store.get('tournamentGroups/stale');
    expect(done.status).toBe('expired');
    expect(done.expiredReason).toBe('forming_orphan');
    expect(done.expiredBy).toBe('rolling_sweep');
    expect(typeof done.expiredAt).toBe('string');
    expect(store.get('tournamentGroups/fresh').status).toBe(GROUP_STATUS.FORMING);
  });

  it('expires a WEDGED DRAFTING pod (old draft activity); an active draft is never interrupted', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/wedged': draftingPod(),
      'tournamentGroups/wedged/draft/state': draftStateDoc(OLD),
      'tournamentGroups/active': draftingPod(),
      'tournamentGroups/active/draft/state': draftStateDoc(FRESH),
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r).toMatchObject({ matched: 1, expired: 1, byStatus: { drafting: 1 } });
    expect(store.get('tournamentGroups/wedged').status).toBe('expired');
    expect(store.get('tournamentGroups/wedged').expiredReason).toBe('drafting_wedged');
    expect(store.get('tournamentGroups/active').status).toBe(GROUP_STATUS.DRAFTING);
  });

  it('AWAITING_OPEN with a FUTURE anchor is NEVER expired (legitimately pending), even when old', async () => {
    const { db, store } = makeDb({
      // anchor tomorrow (Thu 06-18); updatedAt 3 days old — still pending, not stale.
      'tournamentGroups/pending': awaitingPod('2026-06-18', { updatedAt: OLD, createdAt: OLD }),
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r).toMatchObject({ scanned: 1, matched: 0, expired: 0 });
    expect(store.get('tournamentGroups/pending').status).toBe(GROUP_STATUS.AWAITING_OPEN);
  });

  it('AWAITING_OPEN with an ARRIVED anchor past the threshold (the flip failed) IS expired', async () => {
    const { db, store } = makeDb({
      // anchor 06-14 (open ~71h before NOW, arrived); the flip has failed for > 48h.
      'tournamentGroups/flipfail': awaitingPod('2026-06-14', { updatedAt: OLD, createdAt: OLD }),
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r).toMatchObject({ matched: 1, expired: 1, byStatus: { awaiting_open: 1 } });
    expect(store.get('tournamentGroups/flipfail').status).toBe('expired');
    expect(store.get('tournamentGroups/flipfail').expiredReason).toBe('awaiting_open_flip_failed');
  });

  it('AWAITING_OPEN grace runs from ANCHOR ARRIVAL, not entry: a weekend-spanning pod whose anchor arrives today is NOT expired (F2)', async () => {
    const { db, store } = makeDb({
      // Entry 3 days ago; anchor arrives TODAY (its open instant is ~30m after NOW),
      // so the flip fires this morning — the pod must not be expired for having
      // waited out the weekend. Baseline = max(entry, anchor-open) = anchor-open.
      'tournamentGroups/weekend': awaitingPod('2026-06-17', { updatedAt: '2026-06-14T00:00:00.000Z', createdAt: '2026-06-14T00:00:00.000Z' }),
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r).toMatchObject({ matched: 0, expired: 0 });
    expect(store.get('tournamentGroups/weekend').status).toBe(GROUP_STATUS.AWAITING_OPEN);
  });

  it('AWAITING_OPEN with a MISSING/MALFORMED anchor IS expirable once stale — corruption cannot self-protect (Q4)', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/nostart': { status: GROUP_STATUS.AWAITING_OPEN, isTraining: true, players: FOUR_PLAYERS, updatedAt: OLD, createdAt: OLD }, // no startAnchor
      'tournamentGroups/badanchor': { status: GROUP_STATUS.AWAITING_OPEN, isTraining: true, players: FOUR_PLAYERS, startAnchor: { anchorEtDate: 'not-a-date' }, updatedAt: OLD, createdAt: OLD },
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r.expired).toBe(2);
    expect(store.get('tournamentGroups/nostart').status).toBe('expired');
    expect(store.get('tournamentGroups/nostart').expiredReason).toBe('awaiting_open_malformed_anchor');
    expect(store.get('tournamentGroups/badanchor').status).toBe('expired');
  });

  it('AWAITING_OPEN with a malformed anchor but RECENT is NOT expired (only stale corruption is retired)', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/fresh-bad': { status: GROUP_STATUS.AWAITING_OPEN, isTraining: true, players: FOUR_PLAYERS, startAnchor: {}, updatedAt: FRESH, createdAt: FRESH },
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r).toMatchObject({ matched: 0, expired: 0 });
    expect(store.get('tournamentGroups/fresh-bad').status).toBe(GROUP_STATUS.AWAITING_OPEN);
  });

  it('AWAITING_OPEN with a FORMAT-valid but CORRUPT anchor (absurd far-future / out-of-range month) is still expirable once stale (Q4 hardening)', async () => {
    const { db, store } = makeDb({
      // '9999-01-01' passes /^\\d{4}-\\d{2}-\\d{2}$/ and sorts after today, but is
      // absurdly far out (beyond the sane horizon) → not a legit future wait.
      'tournamentGroups/farfuture': { status: GROUP_STATUS.AWAITING_OPEN, isTraining: true, players: FOUR_PLAYERS, startAnchor: { anchorEtDate: '9999-01-01', anchorIso: '9999-01-01T13:30:00.000Z' }, updatedAt: OLD, createdAt: OLD },
      // '2026-13-01' is format-valid but not a real calendar date (month 13).
      'tournamentGroups/badmonth': { status: GROUP_STATUS.AWAITING_OPEN, isTraining: true, players: FOUR_PLAYERS, startAnchor: { anchorEtDate: '2026-13-01', anchorIso: '2026-13-01T13:30:00.000Z' }, updatedAt: OLD, createdAt: OLD },
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r.expired).toBe(2);
    expect(store.get('tournamentGroups/farfuture').expiredReason).toBe('awaiting_open_malformed_anchor');
    expect(store.get('tournamentGroups/badmonth').expiredReason).toBe('awaiting_open_malformed_anchor');
  });

  it('TRAINING-ONLY: never touches a ranked pod (no isTraining) or a competitive slot pod (isLiveDraft)', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/ranked': { status: GROUP_STATUS.FORMING, players: FOUR_PLAYERS, createdAt: OLD, updatedAt: OLD }, // no isTraining
      'tournamentGroups/slot': { status: GROUP_STATUS.AWAITING_OPEN, isTraining: false, isLiveDraft: true, players: FOUR_PLAYERS, startAnchor: { anchorEtDate: '2026-06-15' }, createdAt: OLD, updatedAt: OLD },
      'tournamentGroups/training': formingPod(OLD),
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r.expired).toBe(1); // only the training pod
    expect(store.get('tournamentGroups/ranked').status).toBe(GROUP_STATUS.FORMING);
    expect(store.get('tournamentGroups/slot').status).toBe(GROUP_STATUS.AWAITING_OPEN);
    expect(store.get('tournamentGroups/training').status).toBe('expired');
  });

  it('dryRun reports the would-expire census with ZERO writes', async () => {
    const { db, store, writeLog } = makeDb({ 'tournamentGroups/stale': formingPod(OLD) });
    const r = await expireStaleTrainingPods(db, { now: NOW, dryRun: true });
    expect(r).toMatchObject({ dryRun: true, matched: 1, expired: 0, byStatus: { forming: 1 } });
    expect(store.get('tournamentGroups/stale').status).toBe(GROUP_STATUS.FORMING); // untouched
    expect(writeLog.some(([op]) => op === 'tx.update' || op === 'update')).toBe(false);
  });

  it('cutoffIso leaves a stale pod created AFTER the cutoff alone (the one-time-cleanup bound)', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/old': formingPod(OLD, { createdAt: '2026-06-10T00:00:00.000Z' }), // before cutoff → eligible
      'tournamentGroups/new': formingPod(OLD, { createdAt: '2026-06-16T00:00:00.000Z' }), // after cutoff → skipped despite age
    });
    const r = await expireStaleTrainingPods(db, { now: NOW, cutoffIso: '2026-06-13T00:00:00.000Z' });
    expect(r).toMatchObject({ matched: 1, expired: 1 });
    expect(store.get('tournamentGroups/old').status).toBe('expired');
    expect(store.get('tournamentGroups/new').status).toBe(GROUP_STATUS.FORMING);
  });

  it('idempotent: an already-EXPIRED or a BATTLE pod is outside the pre-BATTLE queries — a re-run is a clean no-op', async () => {
    const { db } = makeDb({
      'tournamentGroups/done': { status: 'expired', isTraining: true, players: FOUR_PLAYERS, updatedAt: OLD },
      'tournamentGroups/live': { status: GROUP_STATUS.BATTLE, isTraining: true, players: FOUR_PLAYERS, updatedAt: OLD },
    });
    const r = await expireStaleTrainingPods(db, { now: NOW });
    expect(r).toMatchObject({ scanned: 0, matched: 0, expired: 0, errors: 0 });
  });
});
