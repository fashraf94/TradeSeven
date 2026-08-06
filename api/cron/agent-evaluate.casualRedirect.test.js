// api/cron/agent-evaluate.casualRedirect.test.js
//
// INTEGRATION proof of the Phase-1 RECORD attribution redirect, driven through
// the REAL exported completeBattle against the transactional mock db (same harness
// as agent-evaluate.masteryCompletion.test.js). Complements the resolver-level
// parity gate (casualCloneParity.test.js) by exercising the actual settlement
// transaction end to end.
//
// Proves: a casual-clone battle's W-L lands on the PARENT ranked agent IDENTICALLY
// to the real-agent path; the clone's own stats stay untouched; the clone's
// activeBattleId pointer is cleared while the PARENT's pointer (a concurrent ranked
// battle) is left intact.

import { describe, it, expect } from 'vitest';
import { completeBattle } from './agent-evaluate.js';
import { makeMockDb } from '../_utils/__fixtures__/masteryMockDb.js';

// Shared base record — used for BOTH the real agent and the parent so the two
// completions are directly comparable (parity).
const BASE_STATS = Object.freeze({ wins: 2, losses: 1, draws: 0, gamesPlayed: 3, totalScore: 100, avgScore: 33, currentStreak: 2, bestStreak: 3 });
const ZERO_STATS = Object.freeze({ wins: 0, losses: 0, draws: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 });

// A vs-CPU BaggerBomb battle (gameMode !== TOURNAMENT_GAME_MODE → updateAgentStats
// true), a WIN (currentScore > opponentScore).
const BATTLE = Object.freeze({
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

describe('completeBattle — Phase 1 casual-clone RECORD redirect (real settlement)', () => {
  it('the casual battle credits the PARENT record IDENTICALLY to the real-agent path, and never the clone', async () => {
    // --- BASELINE: a real-agent BaggerBomb battle (what happens today) ---
    const realDb = makeMockDb({
      'agentBattles/b1': { ...BATTLE, agentId: 'ranked-1' },
      'agents/ranked-1': { ownerId: 'u1', stats: { ...BASE_STATS }, activeBattleId: 'b1' },
    });
    await completeBattle(realDb, { id: 'b1', ...BATTLE, agentId: 'ranked-1' }, { evaluated: 0 });
    const realAgentAfter = realDb.__dump('agents/ranked-1').stats;

    // --- REDIRECT: the SAME battle, but run on the casual clone ---
    const cloneDb = makeMockDb({
      'agentBattles/b1': { ...BATTLE, agentId: 'casual-agent-u1' },
      // the clone: own id, rankedAgentId → parent, its OWN activeBattleId points here
      'agents/casual-agent-u1': { ownerId: 'u1', isCasualClone: true, rankedAgentId: 'ranked-1', activeBattleId: 'b1', stats: { ...ZERO_STATS } },
      // the parent: SAME base record as the real agent, and a CONCURRENT ranked battle live
      'agents/ranked-1': { ownerId: 'u1', stats: { ...BASE_STATS }, activeBattleId: 'ranked-battle-live' },
    });
    await completeBattle(cloneDb, { id: 'b1', ...BATTLE, agentId: 'casual-agent-u1' }, { evaluated: 0 });

    const parentAfter = cloneDb.__dump('agents/ranked-1').stats;
    const cloneAfter = cloneDb.__dump('agents/casual-agent-u1');

    // PARITY: the parent's record after the casual battle == the real-agent path.
    expect(parentAfter).toEqual(realAgentAfter);
    // and concretely: a win was credited (2 → 3 wins, 3 → 4 games).
    expect(parentAfter.wins).toBe(3);
    expect(parentAfter.gamesPlayed).toBe(4);
    expect(parentAfter.currentStreak).toBe(3);

    // The clone's OWN record is untouched (it is a throwaway identity).
    expect(cloneAfter.stats).toEqual(ZERO_STATS);

    // The clone's activeBattleId pointer is cleared (battle over); the PARENT's
    // pointer — a CONCURRENT ranked battle — is left intact (never touched).
    expect(cloneAfter.activeBattleId).toBeNull();
    expect(cloneDb.__dump('agents/ranked-1').activeBattleId).toBe('ranked-battle-live');
  });

  it('degrades safely: a casual battle whose parent doc is missing keeps stats on the clone (no throw)', async () => {
    const db = makeMockDb({
      'agentBattles/b1': { ...BATTLE, agentId: 'casual-agent-u1' },
      'agents/casual-agent-u1': { ownerId: 'u1', isCasualClone: true, rankedAgentId: 'ranked-GONE', activeBattleId: 'b1', stats: { ...ZERO_STATS } },
      // no agents/ranked-GONE
    });
    const outcome = await completeBattle(db, { id: 'b1', ...BATTLE, agentId: 'casual-agent-u1' }, { evaluated: 0 });
    expect(outcome.committed).toBe(true);
    // Parent missing → the redirect falls back to the clone (detectable, never a throw).
    expect(db.__dump('agents/casual-agent-u1').stats.wins).toBe(1);
    expect(db.__dump('agents/casual-agent-u1').activeBattleId).toBeNull();
  });

  it('a TOURNAMENT casual-clone battle writes no career stats (updateAgentStats:false) — redirect inert', async () => {
    // gameMode TOURNAMENT → no W-L on anyone; only the clone pointer clears.
    const tournamentBattle = { ...BATTLE, gameMode: 'baggerbomb_tournament', groupId: 'g1', scoreState: { currentScore: 12 } };
    const db = makeMockDb({
      'agentBattles/b1': { ...tournamentBattle, agentId: 'casual-agent-u1' },
      'agents/casual-agent-u1': { ownerId: 'u1', isCasualClone: true, rankedAgentId: 'ranked-1', activeBattleId: 'b1', stats: { ...ZERO_STATS } },
      'agents/ranked-1': { ownerId: 'u1', stats: { ...BASE_STATS }, activeBattleId: 'ranked-battle-live' },
    });
    await completeBattle(db, { id: 'b1', ...tournamentBattle, agentId: 'casual-agent-u1' }, { evaluated: 0 });
    // parent record untouched (tournament placement is the outcome, not W-L)
    expect(db.__dump('agents/ranked-1').stats).toEqual(BASE_STATS);
    expect(db.__dump('agents/casual-agent-u1').stats).toEqual(ZERO_STATS);
    // clone pointer still clears
    expect(db.__dump('agents/casual-agent-u1').activeBattleId).toBeNull();
  });
});
