// api/cron/trainingPodCanonicalChain.regression.test.js
//
// Training-Pod Status-Transition P0 — R4 REGRESSION LOCK (rulings memo R4; review
// B3). Phase 0 established the premise reversal: the training-pod canonical chain
// is already BUILT, wired, flag-on, and test-locked at HEAD — training pods DO
// advance to BATTLE and settle; the "never advances / stuck at Day 0" diagnosis
// was stale. This test PINS that now-working behavior so it can never silently
// regress.
//
// B3: it drives the REAL writer functions against a store (not computeHandoffWrites
// return values), so the test FAILS if any real status-transition wiring is
// removed — a full emulator cron run (draft → flip → canonical-open capture → eval
// → banking) is not feasible as a unit test, so we exercise the real writers that
// perform each hop and the real completeBattle for settlement:
//   • completeTrainingDraft   — DRAFTING → BATTLE (today anchor) / AWAITING_OPEN
//   • flipAwaitingOpenPods     — AWAITING_OPEN → BATTLE (the morning flip)
//   • completeBankedTrainingPods — BATTLE → COMPLETE
//   • completeBattle           — the settlement stamp + MODE_MULT 0.6
//
// Cron-module import precedent: agent-evaluate.masteryCompletion.test.js.

import { describe, it, expect } from 'vitest';
import { completeBattle } from './agent-evaluate.js';
import { completeTrainingDraft, flipAwaitingOpenPods, completeBankedTrainingPods } from '../_utils/trainingLifecycle.js';
import { classifyModeKind, runRepairSweep } from '../_utils/masterySettlement.js';
import { MODE_MULTS } from '../_utils/masteryFormula.js';
import { deriveFlagView } from '../_utils/masteryConfig.js';
import { makeMockDb } from '../_utils/__fixtures__/masteryMockDb.js';
import { makeInMemoryDb } from '../_utils/__fixtures__/inMemoryFirestore.js';
import { GROUP_STATUS, TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

const FLAG_ON = deriveFlagView({ entries: [{ state: 'enabled', at: '2026-07-19T00:00:00.000Z' }] }, true);

// ── 1. CANONICAL STATUS CHAIN — driven through the REAL writers (B3) ─────────
describe('R4 — the training pod advances through the canonical chain (real writers, not helper returns)', () => {
  const MEMBERS = ['u1', 'cpu-1', 'cpu-2', 'cpu-3'];
  const POOL = Array.from({ length: 20 }, (_, i) => `S${i}`);
  const PICKS = { u1: ['S0', 'S1', 'S2'], 'cpu-1': ['S3', 'S4', 'S5'], 'cpu-2': ['S6', 'S7', 'S8'], 'cpu-3': ['S9', 'S10', 'S11'] };
  const TAKEN = Object.values(PICKS).flat();

  // A DRAFTING training pod whose live draft is COMPLETE (all 12 picks) — the
  // exact precondition completeTrainingDraft's real handoff consumes.
  function seedCompletedDraft(groupId) {
    return makeInMemoryDb({
      [`tournamentGroups/${groupId}`]: {
        status: GROUP_STATUS.DRAFTING, isTraining: true, groupMembers: MEMBERS,
        players: MEMBERS.map((odUserId, i) => ({ odUserId, isCpu: i !== 0, picks: [] })),
        userPool: POOL, roundNumber: 1, progressVersion: 12,
      },
      [`tournamentGroups/${groupId}/draft/state`]: {
        status: 'drafting', currentPickIndex: 12, pool: POOL, taken: TAKEN, picksByUser: PICKS,
        events: TAKEN.map((symbol, i) => ({ pickNumber: i + 1, symbol, odUserId: MEMBERS[i % 4] })),
        humanArchetype: 'analyst', humanId: 'u1',
        startedAt: '2026-06-17T12:00:00.000Z', lastActivityAt: '2026-06-17T12:00:00.000Z',
      },
    });
  }

  it('completeTrainingDraft (REAL) lands a completed draft straight in BATTLE on a today anchor — DRAFTING→BATTLE actually fires', async () => {
    const { db, store } = seedCompletedDraft('d1');
    const res = await completeTrainingDraft(db, 'd1', { now: new Date('2026-06-17T13:00:00.000Z') }); // Wed 09:00 ET, pre-open
    expect(res.status).toBe(GROUP_STATUS.BATTLE);
    // the assertion is on the STORE (the real write), not a helper's return value
    expect(store.get('tournamentGroups/d1').status).toBe(GROUP_STATUS.BATTLE);
    const human = store.get('tournamentGroups/d1').players.find(p => p.odUserId === 'u1');
    expect(human.picks.map(pk => pk.symbol)).toEqual(['S0', 'S1', 'S2']); // picks materialized onto players[]
  });

  it('completeTrainingDraft parks a future-anchor draft in AWAITING_OPEN, then flipAwaitingOpenPods (REAL) flips it to BATTLE', async () => {
    const { db, store } = seedCompletedDraft('d2');
    const res = await completeTrainingDraft(db, 'd2', { now: new Date('2026-06-17T14:00:00.000Z') }); // 10:00 ET → next trading day
    expect(res.status).toBe(GROUP_STATUS.AWAITING_OPEN);
    expect(store.get('tournamentGroups/d2').status).toBe(GROUP_STATUS.AWAITING_OPEN);

    const flip = await flipAwaitingOpenPods(db, { now: new Date('2026-06-18T13:00:00.000Z') }); // Thu, the anchor date
    expect(flip.flipped).toBe(1);
    expect(store.get('tournamentGroups/d2').status).toBe(GROUP_STATUS.BATTLE); // the real morning flip
  });

  it('completeBankedTrainingPods (REAL) completes a week-banked BATTLE training pod → COMPLETE', async () => {
    const dailyScores = {};
    for (let d = 1; d <= 5; d++) dailyScores[`day${d}`] = { recordedDate: `2026-06-${11 + d}`, closeScores: {} };
    const { db, store } = makeInMemoryDb({
      'tournamentGroups/b1': {
        status: GROUP_STATUS.BATTLE, isTraining: true,
        players: MEMBERS.map((odUserId, i) => ({ odUserId, isCpu: i !== 0, picks: [] })),
        dailyScores,
      },
    });
    const res = await completeBankedTrainingPods(db, { now: new Date('2026-06-19T22:00:00.000Z') });
    expect(res.completed).toBe(1);
    expect(store.get('tournamentGroups/b1').status).toBe(GROUP_STATUS.COMPLETE);
  });
});

// ── 2. SETTLEMENT CONTINUITY: the SAME completeBattle, stamp, MODE_MULT 0.6 ───
describe('R4 — a training pod battle settles through the SAME completeBattle: stamp + MODE_MULT 0.6', () => {
  const tournamentBattle = (over = {}) => ({
    ownerId: 'u1', agentId: 'a1', status: 'active',
    gameMode: TOURNAMENT_GAME_MODE, groupId: 'g-train',
    createdAt: '2026-07-20T13:00:00.000Z', expiresAt: '2026-07-20T20:00:00.000Z',
    timing: { tradingDays: ['2026-07-20'] }, scoreState: { currentScore: 60 },
    agentContext: { archetype: 'degen' },
    statusFeed: [{ timestamp: '2026-07-20T13:05:00.000Z', message: 'seed', action: 'x', source: 'system', score: 0 }],
    cronState: { evaluatingAt: '2026-07-20T19:59:00.000Z' },
    ...over,
  });
  const CPU_OVER = { ownerId: 'cpu-owner', agentId: 'cpu-a', isCpu: true, createdAt: '2026-07-20T13:00:30.000Z', scoreState: { currentScore: 20 } };
  const HUMAN_AGENT = { ownerId: 'u1', stats: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 }, activeBattleId: 'tr1' };

  function trainingFixture() {
    return makeMockDb({
      'agentBattles/tr1': tournamentBattle(),
      'agentBattles/tr-cpu': tournamentBattle(CPU_OVER),
      'agents/a1': { ...HUMAN_AGENT },
      'agents/cpu-a': { ownerId: 'cpu-owner', stats: {} },
      'tournamentGroups/g-train': { isTraining: true, status: GROUP_STATUS.BATTLE },
    });
  }

  it('the mode classifier reads a training tournament battle as 0.6 (the constant the XP formula multiplies by)', () => {
    expect(classifyModeKind({ gameMode: TOURNAMENT_GAME_MODE, group: { isTraining: true } })).toBe('training');
    expect(classifyModeKind({ gameMode: TOURNAMENT_GAME_MODE, group: {} })).toBe('league');
    expect(MODE_MULTS.training).toBe(0.6);
    expect(MODE_MULTS.league).toBe(1.0);
  });

  it('completeBattle stamps eligibility on the training HUMAN battle; the CPU seat is never stamped (STOP-A.2)', async () => {
    const db = trainingFixture();
    await completeBattle(db, { id: 'tr1', ...tournamentBattle() }, { evaluated: 0 }, FLAG_ON, new Map(), new Map());
    const human = db.__dump('agentBattles/tr1');
    expect(human.status).toBe('completed');
    expect(human.masteryEligibility).toMatchObject({ eligible: true, epochId: 1 });
    expect(human.masteryEligibility.stampedAt).toBe(human.completedAt); // atomic with completion

    await completeBattle(db, { id: 'tr-cpu', ...tournamentBattle(CPU_OVER) }, { evaluated: 0 }, FLAG_ON, new Map(), new Map());
    const cpu = db.__dump('agentBattles/tr-cpu');
    expect(cpu.status).toBe('completed');
    expect(cpu.masteryEligibility).toBeUndefined();
  });

  it('the resolved training award carries MODE_MULT 0.6 — end-to-end through completeBattle + the repair sweep', async () => {
    const db = trainingFixture();
    const groupCache = new Map();
    const siblingsCache = new Map();
    const nowIso = '2026-07-21T00:30:00.000Z';
    await completeBattle(db, { id: 'tr1', ...tournamentBattle() }, { evaluated: 0 }, FLAG_ON, groupCache, siblingsCache);
    await completeBattle(db, { id: 'tr-cpu', ...tournamentBattle(CPU_OVER) }, { evaluated: 0 }, FLAG_ON, groupCache, siblingsCache);
    await runRepairSweep(db, { nowIso, limit: 25, groupCache, siblingsCache });

    const award = db.__dump('agentBattles/tr1').masteryAward;
    expect(award).toBeDefined();
    expect(award.multipliers.mode).toBe(0.6); // THE regression lock: training mode multiplier
  });
});
