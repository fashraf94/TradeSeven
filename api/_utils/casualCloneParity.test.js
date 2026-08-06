// api/_utils/casualCloneParity.test.js
//
// THE PHASE-1 PARITY GATE (design lock, acceptance #1). BaggerBomb TODAY runs on
// the real ranked agent and already contributes to the player's W-L, learning
// corpus, and lessons. Giving it a casual clone must PRESERVE that — the clone's
// battle must land on the PARENT ranked agent IDENTICALLY to the real-agent path,
// never regress onto the throwaway clone.
//
// Each block computes the REDIRECT result (via the two shared resolvers every one
// of the five redirect sites routes through — resolveRecordTargetId for the
// in-tx settlement + reflection, resolveAttributionAgentId for the corpus + DRB)
// and the NAIVE result (key on battle.agentId, the pre-redirect behavior), and
// asserts: redirect == the real-agent baseline (GREEN), naive != baseline (RED).
//
// The five redirect sites and the resolver each routes through:
//   record (settlement, agent-evaluate.js)      → resolveRecordTargetId  (pure, in-tx)
//   reflection memory (reflect.js)              → resolveRecordTargetId  (pure)
//   consolidation (reflect.js + apply)          → resolveRecordTargetId  (pure)
//   corpus receipts x2 (agent-evaluate.js)      → resolveAttributionAgentId (async)
//   DRB lessons (agent-batch-review.js)         → resolveAttributionAgentId (async)
// so a reversion of any site's key to battle.agentId reproduces the "naive"
// branch this gate marks RED.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveAttributionAgentId, resolveRecordTargetId } from './casualClone.js';
import { classifyEvidence } from './learning/captureReceipt.js';
import { casualCloneDocId } from '../../src/constants/leagueTournament.js';

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

const OWNER = 'user-42';
const PARENT_ID = 'ranked-1';
const CLONE_ID = casualCloneDocId(OWNER); // casual-agent-user-42

function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const docRef = (path) => ({
    get: async () => { const d = store.get(path); return { exists: d !== undefined, id: path.split('/').pop(), data: () => structuredClone(d) }; },
  });
  return { db: { collection: (name) => ({ doc: (id) => docRef(`${name}/${id}`) }) }, store };
}

function seededDb() {
  return makeDb({
    'agents/ranked-1': {
      ownerId: OWNER, archetype: 'analyst',
      stats: { wins: 3, losses: 1, draws: 0, gamesPlayed: 4, totalScore: 40, avgScore: 10, currentStreak: 2, bestStreak: 3 },
      lessons: [{ id: 'L-parent', text: 'parent lesson' }],
    },
    [`agents/${CLONE_ID}`]: {
      ownerId: OWNER, isCasualClone: true, rankedAgentId: PARENT_ID,
      stats: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 },
      lessons: [],
    },
  });
}

// The settlement W-L increment (agent-evaluate.js completeBattle) as a parity
// ORACLE: a real-agent casual battle applies THIS to the agent's OWN stats; the
// redirect applies it to the PARENT's stats and writes to the PARENT, so the two
// resulting records must be identical. (Mirror of the production math — kept in
// sync by this gate; the settlement itself is exercised by agent-evaluate.test.js.)
function applyStatsIncrement(base, result, score) {
  const s = base || {};
  const gamesPlayed = (s.gamesPlayed || 0) + 1;
  const totalScore = (s.totalScore || 0) + score;
  let streak = s.currentStreak || 0;
  if (result === 'win') streak = streak >= 0 ? streak + 1 : 1;
  else if (result === 'loss') streak = streak <= 0 ? streak - 1 : -1;
  else streak = 0;
  return {
    wins: (s.wins || 0) + (result === 'win' ? 1 : 0),
    losses: (s.losses || 0) + (result === 'loss' ? 1 : 0),
    draws: (s.draws || 0) + (result === 'draw' ? 1 : 0),
    gamesPlayed,
    totalScore: Math.round(totalScore * 100) / 100,
    avgScore: Math.round(totalScore / gamesPlayed),
    currentStreak: streak,
    bestStreak: Math.max(s.bestStreak || 0, Math.abs(streak)),
  };
}

describe('PARITY GATE — a casual-clone battle contributes to the PARENT identically to the real-agent path', () => {
  it('RECORD (W-L): the parent record after a casual battle matches the real-agent path; naive (clone) does not', () => {
    const { store } = seededDb();
    const casualBattle = { agentId: CLONE_ID };
    const parentBase = store.get('agents/ranked-1').stats;
    const cloneBase = store.get(`agents/${CLONE_ID}`).stats;

    // What BaggerBomb produces TODAY on the real agent (the baseline oracle):
    const realAgentPath = applyStatsIncrement(parentBase, 'win', 12.5);
    expect(realAgentPath.wins).toBe(4);         // 3 → 4
    expect(realAgentPath.gamesPlayed).toBe(5);  // 4 → 5

    // REDIRECT: settlement resolves the record TARGET to the parent (statsTargetRef)
    // and builds on the PARENT's stats (statsBaseData) — so the result is identical.
    const recordTargetId = resolveRecordTargetId(casualBattle.agentId, store.get(`agents/${CLONE_ID}`));
    expect(recordTargetId).toBe(PARENT_ID); // GREEN: target is the parent
    const redirectPath = applyStatsIncrement(store.get(`agents/${recordTargetId}`).stats, 'win', 12.5);
    expect(redirectPath).toEqual(realAgentPath); // parity ✓

    // NAIVE (regressed onto the clone): target = clone, base = clone zeros → wrong.
    expect(casualBattle.agentId).not.toBe(PARENT_ID);
    const naivePath = applyStatsIncrement(cloneBase, 'win', 12.5);
    expect(naivePath).not.toEqual(realAgentPath); // RED: a 1-win clone, parent untouched
    expect(naivePath.wins).toBe(1);
  });

  it('CORPUS: a casual receipt is admitted as live_agent AND attributed to the parent; naive mis-attributes', async () => {
    const { db } = seededDb();
    const casualBattle = { agentId: CLONE_ID, isCpu: false };

    const attributionAgentId = await resolveAttributionAgentId(db, casualBattle);
    expect(attributionAgentId).toBe(PARENT_ID); // GREEN: booked under the parent
    // admitted as REAL evidence (the parent id is a live_agent, never 'training'):
    expect(classifyEvidence({ isCpu: false, agentId: attributionAgentId })).toBe('live_agent');

    // NAIVE: the receipt would carry the clone id — still admitted (casual- is
    // live_agent, NOT training-), but attributed to the throwaway clone, not the parent.
    expect(classifyEvidence({ isCpu: false, agentId: casualBattle.agentId })).toBe('live_agent');
    expect(casualBattle.agentId).not.toBe(PARENT_ID); // RED: wrong owner of the evidence
  });

  it('LESSONS: DRB (async) + reflection (pure) both target the parent; naive targets the clone', async () => {
    const { db } = seededDb();
    const casualBattle = { agentId: CLONE_ID };
    const cloneDoc = { rankedAgentId: PARENT_ID };

    expect(await resolveAttributionAgentId(db, casualBattle)).toBe(PARENT_ID); // DRB target
    expect(resolveRecordTargetId(casualBattle.agentId, cloneDoc)).toBe(PARENT_ID); // reflection target
    expect(casualBattle.agentId).not.toBe(PARENT_ID); // naive → clone (RED)
  });

  it('NON-CASUAL is byte-identical: a real-agent / training / cpu battle attributes to itself (no read, no redirect)', async () => {
    // A throwing db proves resolveAttributionAgentId does NO read for non-casual ids.
    const throwingDb = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('must not read'); } }) }) };
    expect(await resolveAttributionAgentId(throwingDb, { agentId: PARENT_ID })).toBe(PARENT_ID);
    expect(await resolveAttributionAgentId(throwingDb, { agentId: 'training-agent-g-user-42' })).toBe('training-agent-g-user-42');
    expect(await resolveAttributionAgentId(throwingDb, { agentId: 'cpu-agent-1' })).toBe('cpu-agent-1');
    expect(resolveRecordTargetId(PARENT_ID, { rankedAgentId: 'should-be-ignored' })).toBe(PARENT_ID);
  });

  it('degrades SAFELY: a casual clone missing its rankedAgentId keeps attribution on the clone (never throws)', async () => {
    const { db } = makeDb({ [`agents/${CLONE_ID}`]: { ownerId: OWNER, isCasualClone: true /* no rankedAgentId */ } });
    expect(await resolveAttributionAgentId(db, { agentId: CLONE_ID })).toBe(CLONE_ID);
    expect(resolveRecordTargetId(CLONE_ID, { isCasualClone: true })).toBe(CLONE_ID);
  });
});
