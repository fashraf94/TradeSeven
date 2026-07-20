// api/cron/agent-evaluate.masteryCompletion.test.js
// Archetype Mastery P1 — completeBattle integration acceptance (Spec V2 §5.1,
// §12; V2.1 memo STOP-A.1). Proves, against the exported completeBattle:
//
//   • FLAGS-OFF BYTE-IDENTITY (valid-client scope): under the dark flag view
//     the committed battle doc + agent stats are the LEGACY photograph —
//     field-for-field — with ZERO mastery keys anywhere.
//   • §5.1 atomicity: when epoch 1 has begun, the SAME transaction that
//     commits status:'completed' carries masteryEligibility (+ the sweep
//     marker), and the §2.3 award chain runs to a masteryAward + profile.
//   • The guarded transaction (STOP-A.1): a competitor completing first
//     makes this writer no-op entirely — no double stats, no double feed.
//
// Cron-module import precedent: p4Flips.test.js / resolveCompletionDisposition.

import { describe, it, expect } from 'vitest';
import { completeBattle } from './agent-evaluate.js';
import { deriveFlagView } from '../_utils/masteryConfig.js';
import { makeMockDb } from '../_utils/__fixtures__/masteryMockDb.js';

const FLAG_ON = deriveFlagView({ entries: [{ state: 'enabled', at: '2026-07-19T00:00:00.000Z' }] }, true);

const TIERED_BATTLE = Object.freeze({
  agentId: 'agent-1',
  ownerId: 'u1',
  status: 'active',
  gameMode: 'baggerbomb_agent',
  createdAt: '2026-07-20T13:00:00.000Z',
  expiresAt: '2026-07-20T20:00:00.000Z',
  timing: { tradingDays: ['2026-07-20'] },
  scoreState: { currentScore: 40.125, opponentScore: 30 },
  agentContext: { archetype: 'degen' },
  statusFeed: [{ timestamp: '2026-07-20T13:05:00.000Z', message: 'seed', action: 'x', source: 'system', score: 0 }],
  cronState: { evaluatingAt: '2026-07-20T19:59:00.000Z' },
});

const AGENT_DOC = Object.freeze({
  ownerId: 'u1',
  stats: { wins: 2, losses: 1, draws: 0, gamesPlayed: 3, totalScore: 100, avgScore: 33, currentStreak: 2, bestStreak: 3 },
  activeBattleId: 'b1',
});

function fixture(over = {}) {
  return makeMockDb({
    'agentBattles/b1': { ...TIERED_BATTLE, ...over },
    'agents/agent-1': AGENT_DOC,
  });
}

describe('flags-off byte-identity (the STOP-A.1 conversion changes the MECHANISM, never the bytes)', () => {
  it('commits the legacy payload photograph and legacy stats math; zero mastery keys', async () => {
    const db = fixture();
    const summary = { evaluated: 0 };
    await completeBattle(db, { id: 'b1', ...TIERED_BATTLE }, summary); // default DARK view

    const doc = db.__dump('agentBattles/b1');
    // The photograph: every field the legacy plain update wrote, and nothing else.
    expect(doc.status).toBe('completed');
    expect(typeof doc.completedAt).toBe('string');
    expect(doc.pendingReflection).toBe(true);
    expect(doc.reflectedAt).toBeNull();
    expect(doc.cronState.evaluatingAt).toBeNull();
    expect(doc.statusFeed).toHaveLength(2);
    expect(doc.statusFeed[1]).toEqual({
      timestamp: doc.completedAt,
      message: 'Battle complete. Agent: +40.1 pts vs CPU: +30.0 pts. Result: Win.',
      action: 'battle_complete',
      source: 'system',
      score: 40.13, // Math.round(40.125 × 100) / 100 — the legacy rounding, byte-for-byte
    });
    expect(doc.completionContext).toBeUndefined();
    // NO mastery keys, anywhere:
    expect(doc.masteryEligibility).toBeUndefined();
    expect(doc.masteryAwardPending).toBeUndefined();
    expect(doc.masteryAward).toBeUndefined();
    expect(doc.masterySlot).toBeUndefined();
    expect(db.__paths('masteryProfiles/')).toEqual([]);
    expect(db.__paths('masteryQuarantine/')).toEqual([]);

    // Legacy stats math, untouched:
    const agent = db.__dump('agents/agent-1');
    expect(agent.stats).toEqual({
      wins: 3, losses: 1, draws: 0, gamesPlayed: 4,
      totalScore: 140.13, avgScore: 35, currentStreak: 3, bestStreak: 3,
    });
    expect(agent.activeBattleId).toBeNull();
    expect(summary.evaluated).toBe(1);
  });

  it('tournament battle: completionContext stamped, W/L stats untouched, pointer cleared (legacy P4 behavior)', async () => {
    const tournament = {
      ...TIERED_BATTLE,
      gameMode: 'baggerbomb_tournament',
      groupId: 'g1',
      scoreState: { currentScore: 12.5 },
    };
    const db = makeMockDb({ 'agentBattles/b1': tournament, 'agents/agent-1': AGENT_DOC });
    const summary = { evaluated: 0 };
    await completeBattle(db, { id: 'b1', ...tournament }, summary);
    const doc = db.__dump('agentBattles/b1');
    expect(doc.completionContext).toBe('tournament_group_scored');
    expect(doc.masteryEligibility).toBeUndefined();
    const agent = db.__dump('agents/agent-1');
    expect(agent.stats).toEqual(AGENT_DOC.stats); // never moves for tournament battles
    expect(agent.activeBattleId).toBeNull();
  });
});

describe('§5.1 stamp atomicity + the §2.3 award chain (epoch 1 begun)', () => {
  it('stamps eligibility in the completion transaction and runs the award to a profile increment', async () => {
    const db = fixture();
    const summary = { evaluated: 0 };
    await completeBattle(db, { id: 'b1', ...TIERED_BATTLE }, summary, FLAG_ON, new Map());

    const doc = db.__dump('agentBattles/b1');
    expect(doc.masteryEligibility).toEqual({
      eligible: true,
      epochId: 1,
      stampedAt: doc.completedAt, // atomic with the completion instant — same `now`
    });
    // Award chain ran: pending cleared, award + lazy slot written, profile incremented.
    expect(doc.masteryAwardPending).toBeUndefined();
    expect(doc.masterySlot).toEqual({ date: '2026-07-20', rank: 1, rateBand: 1.0, assignedAt: doc.completedAt });
    expect(doc.masteryAward.xpFinal).toBe(53); // 25 + round(40.125×0.5)=20 + 8 (CPU win)
    expect(doc.masteryAward.levelBefore).toBe(1);
    expect(doc.masteryAward.levelAfter).toBe(1);
    expect(db.__dump('masteryProfiles/u1').archetypes.degen).toMatchObject({ xp: 53, level: 1, battlesCounted: 1 });
  });

  it('CPU seats are never stamped even with the flag on (structurally outside mastery)', async () => {
    const cpuBattle = { ...TIERED_BATTLE, isCpu: true, gameMode: 'baggerbomb_tournament', groupId: 'g1' };
    const db = makeMockDb({ 'agentBattles/b1': cpuBattle, 'agents/agent-1': AGENT_DOC });
    await completeBattle(db, { id: 'b1', ...cpuBattle }, { evaluated: 0 }, FLAG_ON, new Map());
    const doc = db.__dump('agentBattles/b1');
    expect(doc.status).toBe('completed');
    expect(doc.masteryEligibility).toBeUndefined();
    expect(doc.masteryAward).toBeUndefined();
  });
});

describe('the guarded transaction (STOP-A.1): racing writers cannot double-complete', () => {
  it('a competitor completing first makes this writer no-op — stats move ONCE, feed appends ONCE', async () => {
    const db = fixture();
    const summaryLoser = { evaluated: 0 };
    // Deterministic interleave: between the loser's callback and commit, the
    // competitor completes the battle fully (the stolen-lock overlap).
    db.__beforeCommit = () => completeBattle(db, { id: 'b1', ...TIERED_BATTLE }, { evaluated: 0 });
    await completeBattle(db, { id: 'b1', ...TIERED_BATTLE }, summaryLoser);

    const doc = db.__dump('agentBattles/b1');
    expect(doc.statusFeed).toHaveLength(2); // seed + exactly ONE battle_complete
    const agent = db.__dump('agents/agent-1');
    expect(agent.stats.gamesPlayed).toBe(4); // 3 + exactly one completion
    expect(summaryLoser.evaluated).toBe(0); // the loser reported nothing
  });

  it('an already-terminal battle is left byte-untouched', async () => {
    const done = { ...TIERED_BATTLE, status: 'completed', completedAt: '2026-07-20T20:01:00.000Z' };
    const db = makeMockDb({ 'agentBattles/b1': done, 'agents/agent-1': AGENT_DOC });
    const before = db.__dump('agentBattles/b1');
    const summary = { evaluated: 0 };
    await completeBattle(db, { id: 'b1', ...done }, summary, FLAG_ON, new Map());
    expect(db.__dump('agentBattles/b1')).toEqual(before);
    expect(db.__dump('agents/agent-1')).toEqual(AGENT_DOC);
    expect(summary.evaluated).toBe(0);
  });
});
