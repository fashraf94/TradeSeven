// api/cron/trainingPodCanonicalChain.regression.test.js
//
// Training-Pod Status-Transition P0 — R4 REGRESSION LOCK (rulings memo R4;
// carries forward Fix Spec V1 §4.3 through the supersession).
//
// Phase 0 established the premise reversal: the training-pod canonical chain is
// already BUILT, wired into the orchestrator tick, flag-on, and test-locked at
// HEAD — training pods DO advance to BATTLE and settle. The "never advances /
// stuck at Day 0" diagnosis was stale. This test PINS that now-working behavior
// end-to-end so it can never silently regress to the state the stale diagnosis
// described. It drives a training pod through the canonical status chain and its
// battle through the SAME completeBattle the Mastery arc converted (PR #640),
// asserting:
//   • the canonical transitions fire (FORMING→DRAFTING→{BATTLE,AWAITING_OPEN}→BATTLE),
//   • the settlement eligibility STAMP lands for the training HUMAN battle and
//     NEVER for a CPU seat (structurally outside mastery — V2.1 STOP-A.2),
//   • the resolved training award carries MODE_MULT 0.6 (the XP formula reads
//     training mode correctly), with a zero-gate-modification posture.
//
// Cron-module import precedent: agent-evaluate.masteryCompletion.test.js.

import { describe, it, expect } from 'vitest';
import { completeBattle } from './agent-evaluate.js';
import { computeHandoffWrites } from '../_utils/trainingLifecycle.js';
import { assertTransition } from '../_utils/tournamentGroupService.js';
import { classifyModeKind, runRepairSweep } from '../_utils/masterySettlement.js';
import { MODE_MULTS } from '../_utils/masteryFormula.js';
import { deriveFlagView } from '../_utils/masteryConfig.js';
import { makeMockDb } from '../_utils/__fixtures__/masteryMockDb.js';
import { GROUP_STATUS, TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

const FLAG_ON = deriveFlagView({ entries: [{ state: 'enabled', at: '2026-07-19T00:00:00.000Z' }] }, true);

// ── 1. CANONICAL STATUS CHAIN ──────────────────────────────────────────────
// The transitions the stale diagnosis claimed "never fire" for training pods.
describe('R4 — the training pod advances through the canonical chain (not stuck at Day 0)', () => {
  const trainingGroup = {
    id: 'g-train', isTraining: true,
    groupMembers: ['u1', 'cpu-1', 'cpu-2', 'cpu-3'],
    players: [
      { odUserId: 'u1', isCpu: false, picks: [] },
      { odUserId: 'cpu-1', isCpu: true, picks: [] },
      { odUserId: 'cpu-2', isCpu: true, picks: [] },
      { odUserId: 'cpu-3', isCpu: true, picks: [] },
    ],
    roundNumber: 1,
    userPool: ['NVDA', 'AMD', 'TSLA', 'AAPL', 'MSFT', 'META', 'AMZN', 'GOOG'],
  };
  const completeState = {
    status: 'complete',
    picksByUser: {
      u1: ['NVDA', 'AMD', 'TSLA'], 'cpu-1': ['AAPL', 'MSFT', 'META'],
      'cpu-2': ['AMZN', 'GOOG'], 'cpu-3': ['AMD', 'TSLA'],
    },
    taken: ['NVDA', 'AMD', 'TSLA', 'AAPL', 'MSFT', 'META', 'AMZN', 'GOOG'],
    pool: trainingGroup.userPool,
    events: [],
  };
  const NOW = new Date('2026-07-20T13:00:00.000Z'); // 09:00 ET, a pre-open weekday

  it('every canonical edge is legal: FORMING→DRAFTING→{BATTLE,AWAITING_OPEN}→BATTLE→COMPLETE', () => {
    expect(() => assertTransition(GROUP_STATUS.FORMING, GROUP_STATUS.DRAFTING)).not.toThrow();
    expect(() => assertTransition(GROUP_STATUS.DRAFTING, GROUP_STATUS.BATTLE)).not.toThrow();
    expect(() => assertTransition(GROUP_STATUS.DRAFTING, GROUP_STATUS.AWAITING_OPEN)).not.toThrow();
    expect(() => assertTransition(GROUP_STATUS.AWAITING_OPEN, GROUP_STATUS.BATTLE)).not.toThrow();
    expect(() => assertTransition(GROUP_STATUS.BATTLE, GROUP_STATUS.COMPLETE)).not.toThrow();
  });

  it('a completed draft with a TODAY anchor lands the pod straight in BATTLE (the R1 inline flip)', () => {
    const { target, groupUpdate } = computeHandoffWrites(trainingGroup, completeState, NOW, {
      startAnchor: { anchorEtDate: '2026-07-20', anchorIso: '2026-07-20T13:30:00.000Z' },
    });
    expect(target).toBe(GROUP_STATUS.BATTLE);
    expect(groupUpdate.status).toBe(GROUP_STATUS.BATTLE);
    // the human's picks are materialized onto players[] — the pod is battle-ready
    const human = groupUpdate.players.find((p) => p.odUserId === 'u1');
    expect(human.picks.map((pk) => pk.symbol)).toEqual(['NVDA', 'AMD', 'TSLA']);
  });

  it('a completed draft with a FUTURE anchor parks in AWAITING_OPEN, then AWAITING_OPEN→BATTLE is legal (the morning flip)', () => {
    const { target } = computeHandoffWrites(trainingGroup, completeState, NOW, {
      startAnchor: { anchorEtDate: '2026-07-21', anchorIso: '2026-07-21T13:30:00.000Z' },
    });
    expect(target).toBe(GROUP_STATUS.AWAITING_OPEN);
    expect(() => assertTransition(target, GROUP_STATUS.BATTLE)).not.toThrow();
  });
});

// ── 2 + 3. SETTLEMENT CONTINUITY: same completeBattle, stamp, MODE_MULT 0.6 ──
describe('R4 — a training pod battle settles through the SAME completeBattle: stamp + MODE_MULT 0.6', () => {
  const tournamentBattle = (over = {}) => ({
    ownerId: 'u1', agentId: 'a1', status: 'active',
    gameMode: TOURNAMENT_GAME_MODE, groupId: 'g-train',
    createdAt: '2026-07-20T13:00:00.000Z',
    expiresAt: '2026-07-20T20:00:00.000Z',
    timing: { tradingDays: ['2026-07-20'] },
    scoreState: { currentScore: 60 },
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
    // Complete the human (defers pending — cohort not yet terminal) and the CPU
    // seat (terminal, never awards), then the shared-cache repair sweep resolves
    // the human's award — the proven ADV-3 interleave.
    await completeBattle(db, { id: 'tr1', ...tournamentBattle() }, { evaluated: 0 }, FLAG_ON, groupCache, siblingsCache);
    await completeBattle(db, { id: 'tr-cpu', ...tournamentBattle(CPU_OVER) }, { evaluated: 0 }, FLAG_ON, groupCache, siblingsCache);
    await runRepairSweep(db, { nowIso, limit: 25, groupCache, siblingsCache });

    const award = db.__dump('agentBattles/tr1').masteryAward;
    expect(award).toBeDefined();
    expect(award.multipliers.mode).toBe(0.6); // THE regression lock: training mode multiplier
  });
});
