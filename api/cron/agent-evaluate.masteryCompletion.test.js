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
import { completeBattle, repairBareGcCompletions } from './agent-evaluate.js';
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
    db.__resetReads();
    await completeBattle(db, { id: 'b1', ...TIERED_BATTLE }, summary); // default DARK view

    // READ-COUNT photograph (adversarial ruling B2): the dark completion
    // performs exactly two doc reads — the battle and the agent, both inside
    // the one transaction (B3) — and touches NO mastery collection and NO
    // query. The battle read is the approved STOP-A.1 guard cost; the agent
    // read replaces the legacy out-of-transaction get.
    expect(db.__readCounts()).toEqual({
      'agentBattles/b1': 1,
      'agents/agent-1': 1,
    });

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

describe('vision retirement rides the completion transaction (dark photograph of the relocated branch)', () => {
  // Minimal vision satisfying validateTransition's post-creation checks:
  // duck-typed immutable createdAt, an array history (only the NEW entry is
  // entry-validated), and a state with a legal battle_end→retired edge.
  const VISION = Object.freeze({
    state: 'active',
    thesis: 'test thesis',
    createdAt: { seconds: 1752000000, nanoseconds: 0 },
    transitionHistory: [{ fromState: 'forming', toState: 'active', actor: 'sonnet', cause: 'initial', timestamp: { seconds: 1752000000, nanoseconds: 0 } }],
  });

  it('retires an active vision atomically with status, appending the transition entry with ONE reused instant', async () => {
    const withVision = { ...TIERED_BATTLE, vision: VISION };
    const db = makeMockDb({ 'agentBattles/b1': withVision, 'agents/agent-1': AGENT_DOC });
    await completeBattle(db, { id: 'b1', ...withVision }, { evaluated: 0 });
    const doc = db.__dump('agentBattles/b1');
    expect(doc.status).toBe('completed');
    expect(doc.vision.state).toBe('retired');
    expect(doc.vision.transitionHistory).toHaveLength(2);
    const entry = doc.vision.transitionHistory[1];
    expect(entry).toMatchObject({ fromState: 'active', toState: 'retired', actor: 'cron', cause: 'battle_end' });
    // The per-call pre-computed instant is reused for both fields.
    expect(doc.vision.lastTransitionAt).toBe(entry.timestamp);
    // Still zero mastery keys in the dark state.
    expect(doc.masteryEligibility).toBeUndefined();
  });

  it('an already-retired vision is left byte-untouched while status still completes (the no-transition path)', async () => {
    const retiredVision = { ...VISION, state: 'retired' }; // no transition attempted
    const withVision = { ...TIERED_BATTLE, vision: retiredVision };
    const db = makeMockDb({ 'agentBattles/b1': withVision, 'agents/agent-1': AGENT_DOC });
    await completeBattle(db, { id: 'b1', ...withVision }, { evaluated: 0 });
    const doc = db.__dump('agentBattles/b1');
    expect(doc.status).toBe('completed');
    expect(doc.vision).toEqual(retiredVision);
  });
});

describe('GC repair (angle-B legacy behavior, V2.1 STOP-A.2 boundary): bare decide.js completions are finished in place', () => {
  const GC_BARE = Object.freeze({
    ...TIERED_BATTLE,
    status: 'completed',
    completedAt: '2026-07-20T20:02:00.000Z', // decide.js GC'd it at 20:02
    completionReason: 'expired',
    // pendingReflection ABSENT — the bare-write discriminator
  });

  it('supplies stats, reflection queue and feed entry; preserves the GC completedAt; stamps NOTHING even with the flag on', async () => {
    const db = makeMockDb({ 'agentBattles/b1': GC_BARE, 'agents/agent-1': AGENT_DOC });
    const summary = { evaluated: 0 };
    const outcome = await completeBattle(db, { id: 'b1', ...GC_BARE }, summary, FLAG_ON, new Map(), new Map());
    expect(outcome).toMatchObject({ committed: true, repaired: true });

    const doc = db.__dump('agentBattles/b1');
    expect(doc.status).toBe('completed');
    expect(doc.completedAt).toBe('2026-07-20T20:02:00.000Z'); // GC's earlier instant KEPT
    expect(doc.completionReason).toBe('expired_repaired'); // retag: drops out of the Q11 query server-side
    expect(doc.pendingReflection).toBe(true); // reflection queue restored
    expect(doc.statusFeed).toHaveLength(2); // battle_complete feed entry appended
    expect(doc.cronState.evaluatingAt).toBeNull();
    // Structurally outside mastery: NO stamp, NO award, even with epoch live.
    expect(doc.masteryEligibility).toBeUndefined();
    expect(doc.masteryAwardPending).toBeUndefined();
    expect(doc.masteryAward).toBeUndefined();
    // Stats ran (legacy behavior restored): win math applied once.
    const agent = db.__dump('agents/agent-1');
    expect(agent.stats.gamesPlayed).toBe(4);
    expect(agent.activeBattleId).toBeNull();
    expect(summary.evaluated).toBe(1);
  });

  it('repair is idempotent: a second worker sees pendingReflection set and no-ops', async () => {
    const db = makeMockDb({ 'agentBattles/b1': GC_BARE, 'agents/agent-1': AGENT_DOC });
    await completeBattle(db, { id: 'b1', ...GC_BARE }, { evaluated: 0 });
    const afterFirst = db.__dump('agentBattles/b1');
    const second = await completeBattle(db, { id: 'b1', ...GC_BARE }, { evaluated: 0 });
    expect(second).toMatchObject({ committed: false, reason: 'already_terminal' });
    expect(db.__dump('agentBattles/b1')).toEqual(afterFirst);
    expect(db.__dump('agents/agent-1').stats.gamesPlayed).toBe(4); // stats once
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

  it('an already-terminal FULLY-completed battle is left byte-untouched (not a bare GC write — no repair)', async () => {
    const done = { ...TIERED_BATTLE, status: 'completed', completedAt: '2026-07-20T20:01:00.000Z', pendingReflection: false };
    const db = makeMockDb({ 'agentBattles/b1': done, 'agents/agent-1': AGENT_DOC });
    const before = db.__dump('agentBattles/b1');
    const summary = { evaluated: 0 };
    db.__resetReads();
    const outcome = await completeBattle(db, { id: 'b1', ...done }, summary, FLAG_ON, new Map(), new Map());
    expect(outcome).toMatchObject({ committed: false, reason: 'already_terminal' });
    expect(db.__dump('agentBattles/b1')).toEqual(before);
    expect(db.__dump('agents/agent-1')).toEqual(AGENT_DOC);
    expect(summary.evaluated).toBe(0);
    // Skip path reads ONLY the battle guard — the agent read never happens.
    expect(db.__readCounts()).toEqual({ 'agentBattles/b1': 1 });
  });

  it('pointer guard: a completion never nulls activeBattleId that references a DIFFERENT (newer) battle', async () => {
    const GC_OLD = {
      ...TIERED_BATTLE,
      status: 'completed',
      completedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      completionReason: 'expired',
    };
    // decide.js already GC'd this battle and re-pointed the agent at battle-B.
    const agent = { ...AGENT_DOC, activeBattleId: 'battle-B' };
    const db = makeMockDb({ 'agentBattles/b1': GC_OLD, 'agents/agent-1': agent });
    const outcome = await completeBattle(db, { id: 'b1', ...GC_OLD }, { evaluated: 0 });
    expect(outcome).toMatchObject({ committed: true, repaired: true });
    const after = db.__dump('agents/agent-1');
    expect(after.activeBattleId).toBe('battle-B'); // the LIVE battle keeps its lock
    expect(after.stats.gamesPlayed).toBe(4); // stats still fold
  });

  it('a missing agentId never aborts the completion (legacy semantics: battle completes, stats skipped)', async () => {
    const noAgent = { ...TIERED_BATTLE };
    delete noAgent.agentId;
    const db = makeMockDb({ 'agentBattles/b1': noAgent, 'agents/agent-1': AGENT_DOC });
    const summary = { evaluated: 0 };
    const outcome = await completeBattle(db, { id: 'b1', ...noAgent }, summary);
    expect(outcome.committed).toBe(true);
    expect(db.__dump('agentBattles/b1').status).toBe('completed');
    expect(db.__dump('agents/agent-1')).toEqual(AGENT_DOC); // untouched, no throw
    expect(summary.evaluated).toBe(1);
  });

  it('B2 pin: the registry read sits INSIDE the compile-time branch — the dark handler performs no mastery I/O at the flag step', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./agent-evaluate.js', import.meta.url), 'utf8');
    expect(source).toMatch(/if \(MASTERY_XP_ENABLED\) \{\s*\n\s*try \{\s*\n\s*masteryFlagView = await readMasteryFlagView\(db\);/);
    // Exactly one call site, and it is the guarded one.
    expect(source.match(/readMasteryFlagView\(db\)/g)).toHaveLength(1);
  });

  it('ADV-3: shared caches converge within ONE run — a cohort_pending award resolves via the sweep after its siblings complete (real completeBattle + invalidation)', async () => {
    const { runRepairSweep } = await import('../_utils/masterySettlement.js');
    const DAY = { tradingDays: ['2026-07-20'] };
    const tb = (id, over) => ({
      ...TIERED_BATTLE,
      gameMode: 'baggerbomb_tournament',
      groupId: 'g1',
      timing: DAY,
      ...over,
    });
    const A = tb('A', { ownerId: 'u1', agentId: 'agent-1', scoreState: { currentScore: 50 } });
    const B = tb('B', { ownerId: 'u2', agentId: 'agent-2', createdAt: '2026-07-20T13:01:00.000Z', scoreState: { currentScore: 30 } });
    const C = tb('C', { ownerId: 'cpu-owner', agentId: 'cpu-a', isCpu: true, createdAt: '2026-07-20T13:02:00.000Z', scoreState: { currentScore: 10 } });
    const db = makeMockDb({
      'agentBattles/A': A, 'agentBattles/B': B, 'agentBattles/C': C,
      'agents/agent-1': AGENT_DOC, 'agents/agent-2': { ...AGENT_DOC, ownerId: 'u2' }, 'agents/cpu-a': { ownerId: 'cpu-owner', stats: {} },
      'tournamentGroups/g1': { status: 'battle' },
    });
    // ONE set of run-level caches, exactly like the handler.
    const groupCache = new Map();
    const siblingsCache = new Map();
    const summary = { evaluated: 0 };
    await completeBattle(db, { id: 'A', ...A }, summary, FLAG_ON, groupCache, siblingsCache);
    // A's award deferred: B and C still live — and the sibling set is now cached.
    expect(db.__dump('agentBattles/A').masteryAward).toBeUndefined();
    expect(db.__dump('agentBattles/A').masteryAwardPending).toBe(true);
    await completeBattle(db, { id: 'B', ...B }, summary, FLAG_ON, groupCache, siblingsCache);
    await completeBattle(db, { id: 'C', ...C }, summary, FLAG_ON, groupCache, siblingsCache);
    // Same-run sweep with the SAME caches: the per-completion invalidation
    // must have dropped the stale 'active' snapshots, or this defers again.
    const sweep = await runRepairSweep(db, { nowIso: new Date().toISOString(), limit: 25, groupCache, siblingsCache });
    expect(sweep.awarded).toBeGreaterThanOrEqual(1);
    const award = db.__dump('agentBattles/A').masteryAward;
    expect(award).toBeDefined();
    expect(award.components.placement).toBe(30); // outplaced u2@30, CPU top blocks nothing here (C@10): strict first → but humans paid first
    expect(db.__dump('agentBattles/A').masteryAwardPending).toBeUndefined();
  });

  it('Q11: repairBareGcCompletions finds bare GC completions via the bounded query and repairs them; full docs pass through', async () => {
    const GC_BARE = {
      ...TIERED_BATTLE,
      status: 'completed',
      completedAt: new Date(Date.now() - 3600 * 1000).toISOString(), // 1h ago — inside the window
      completionReason: 'expired',
    };
    const FULL = {
      ...TIERED_BATTLE,
      agentId: 'agent-2',
      status: 'completed',
      completedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      completionReason: 'expired',
      pendingReflection: false, // already fully completed — must pass through
    };
    const db = makeMockDb({
      'agentBattles/gc1': GC_BARE,
      'agentBattles/full1': FULL,
      'agents/agent-1': AGENT_DOC,
    });
    const summary = { evaluated: 0 };
    const counts = await repairBareGcCompletions(db, summary);
    expect(counts).toMatchObject({ scanned: 2, repaired: 1, errors: 0 });
    const repaired = db.__dump('agentBattles/gc1');
    expect(repaired.pendingReflection).toBe(true);
    expect(repaired.completedAt).toBe(GC_BARE.completedAt); // GC instant kept
    expect(repaired.completionReason).toBe('expired_repaired');
    expect(repaired.masteryEligibility).toBeUndefined(); // never stamps (STOP-A.2)
    expect(db.__dump('agentBattles/full1')).toEqual(FULL); // untouched
    expect(db.__dump('agents/agent-1').stats.gamesPlayed).toBe(4); // stats ran, once
    // Second run: the retag dropped gc1 out of the QUERY itself (occlusion
    // fix — repaired docs can never pin the limit-25 page); only the
    // synthetic still-'expired' full doc is scanned, and passes through.
    const again = await repairBareGcCompletions(db, { evaluated: 0 });
    expect(again).toMatchObject({ scanned: 1, repaired: 0 });
  });

  it('Q11: the window bounds the query — stale GC completions outside it are not scanned', async () => {
    const OLD_GC = {
      ...TIERED_BATTLE,
      status: 'completed',
      completedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), // 10 days ago
      completionReason: 'expired',
    };
    const db = makeMockDb({ 'agentBattles/old1': OLD_GC, 'agents/agent-1': AGENT_DOC });
    const counts = await repairBareGcCompletions(db, { evaluated: 0 }); // default 96h window
    expect(counts).toMatchObject({ scanned: 0, repaired: 0 });
    expect(db.__dump('agentBattles/old1')).toEqual(OLD_GC);
  });
});
