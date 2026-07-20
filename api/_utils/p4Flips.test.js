// api/_utils/p4Flips.test.js
//
// P4 final commit — the flips and their companions (founder-approved
// Fence-Edit Map §15.3):
//   1. TOURNAMENT_DEPLOY_ENABLED → true (same PR as the prescribed entry
//      path, exactly as contracted at P3b).
//   2. Companion (a): dev-group exclusion — the production dispatcher never
//      touches isDev groups; dev surfaces opt in; seeders stamp; advancement
//      inherits.
//   3. Companion (b): CPU passivity (contract #5's consumer) + the
//      null-opponent completion disposition (founder scope addition,
//      June 12): tournament battles complete with NO W/L-vs-opponent
//      semantics — the flat6 matrix completion test lives here.
//
// The cron module import follows the shouldRebuildHotBench precedent.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { TOURNAMENT_DEPLOY_ENABLED } from './tournamentOrchestrator.js';
import { fetchEligibleGroupsByStatus } from './tournamentGroupService.js';
import { resolveCompletionDisposition } from '../cron/agent-evaluate.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// ==================== 1. THE GATE ====================

describe('P4 — the gate', () => {
  it('TOURNAMENT_DEPLOY_ENABLED is TRUE (flipped in the fence-entry PR, never earlier)', () => {
    expect(TOURNAMENT_DEPLOY_ENABLED).toBe(true);
  });
});

// ==================== 2. Dev-group exclusion (companion a) ====================

function makeGroupsDb(docs) {
  return {
    collection: () => ({
      where: () => ({
        get: async () => ({
          forEach: (cb) => docs.forEach(([id, data]) => cb({ id, data: () => data })),
        }),
      }),
    }),
  };
}

describe('P4 — dev-group exclusion (founder ruling D9)', () => {
  const players = Array.from({ length: 4 }, (_, i) => ({ odUserId: `u${i}`, picks: [] }));
  const docs = [
    ['g-real', { status: GROUP_STATUS.BATTLE, players }],
    ['g-dev', { status: GROUP_STATUS.BATTLE, players, isDev: true }],
  ];

  it('the production default EXCLUDES isDev groups', async () => {
    const groups = await fetchEligibleGroupsByStatus(makeGroupsDb(docs), GROUP_STATUS.BATTLE);
    expect(groups.map(g => g.id)).toEqual(['g-real']);
  });

  it('the dev surface opts in with includeDev: true', async () => {
    const groups = await fetchEligibleGroupsByStatus(makeGroupsDb(docs), GROUP_STATUS.BATTLE, { includeDev: true });
    expect(groups.map(g => g.id)).toEqual(['g-real', 'g-dev']);
  });

  it('run-duty (the dev duty buttons) passes includeDevGroups: true; the production cron passes nothing', () => {
    expect(read('../tournament/run-duty.js')).toContain('includeDevGroups: true');
    expect(read('../cron/tournament-orchestrator.js')).not.toContain('includeDevGroups');
  });

  it('both seeders stamp isDev: true; Friday advancement inherits it from a dev bracket', () => {
    expect(read('../admin/seed-tournament-group.js')).toContain("update({ isDev: true })");
    expect(read('../admin/seed-tournament-bracket.js')).toContain('groupDoc.isDev = true;');
    expect(read('../admin/seed-tournament-bracket.js')).toContain('isDev: true });'); // bracket doc
    expect(read('./tournamentAdvancement.js')).toContain('if (bracket.isDev === true) groupDoc = { ...groupDoc, isDev: true };');
  });

  it('every dispatcher duty threads includeDevGroups into the eligibility fetch', () => {
    const orch = read('./tournamentOrchestrator.js');
    // Slice 3: the ranked duties now thread excludeTraining alongside includeDev,
    // so the options object is no longer { includeDev: includeDevGroups } alone —
    // match includeDev: includeDevGroups regardless of any trailing prop. Still 3.
    expect(orch.match(/fetchEligibleGroupsByStatus\(db, [^)]*includeDev: includeDevGroups[^)]*\)/g)?.length).toBe(3);
    expect(read('./tournamentAdvancement.js')).toContain('{ includeDev: includeDevGroups }');
  });
});

// ============ 2b. Training-group exclusion (League Next-Arc, through Slice 3) ============
//
// The shared-query trap (Phase-3 discovery): fetchEligibleGroupsByStatus feeds
// many duties — some must EXCLUDE training pods, some must still see them. So the
// exclusion is opt-in (excludeTraining), default off:
//   - the permissive DEFAULT (include) keeps training pods visible to the
//     consumers that must still process them — Friday advancement (the
//     plain-finish completer) and the training sweep (which filters to
//     isTraining within the default-included BATTLE set).
//   - the seasonal leaderboard AND the ranked orchestrator duties opt OUT
//     (excludeTraining: true): training is kept off the seasonal board, and
//     (Slice 3) its agent layer is owned solely by activateTrainingPod /
//     sweepTrainingActivation, NOT the ranked Monday/weekday duties — without the
//     opt-out the ranked pipeline would mis-resolve a training seat to the ranked
//     agent.

describe('Next-Arc — training-group exclusion (fetchEligibleGroupsByStatus)', () => {
  const players = Array.from({ length: 4 }, (_, i) => ({ odUserId: `u${i}`, picks: [] }));
  const docs = [
    ['g-ranked', { status: GROUP_STATUS.BATTLE, players }],
    ['g-train', { status: GROUP_STATUS.BATTLE, players, isTraining: true }],
  ];

  it('the DEFAULT INCLUDES isTraining groups — the permissive default keeps them visible to advancement + the training sweep', async () => {
    const groups = await fetchEligibleGroupsByStatus(makeGroupsDb(docs), GROUP_STATUS.BATTLE);
    expect(groups.map(g => g.id)).toEqual(['g-ranked', 'g-train']);
  });

  it('the seasonal leaderboard opts in with excludeTraining: true', async () => {
    const groups = await fetchEligibleGroupsByStatus(makeGroupsDb(docs), GROUP_STATUS.BATTLE, { excludeTraining: true });
    expect(groups.map(g => g.id)).toEqual(['g-ranked']);
  });

  it('the seasonal leaderboard AND the ranked orchestrator duties pass excludeTraining; advancement does NOT (it completes training pods with the plain finish)', () => {
    expect(read('./tournamentLeaderboard.js')).toContain('excludeTraining: true');
    expect(read('./tournamentOrchestrator.js')).toContain('excludeTraining: true');
    expect(read('./tournamentAdvancement.js')).not.toContain('excludeTraining');
  });
});

// ==================== 3. Completion disposition (companion b — the flat6 matrix completion test) ====================

describe('P4 — resolveCompletionDisposition (null-opponent disposition, founder scope addition)', () => {
  it('TIERED battles keep today\'s behavior byte-for-byte: W/L/D vs the CPU, stats mutate, reflection queued', () => {
    const win = resolveCompletionDisposition({
      gameMode: 'baggerbomb_agent',
      scoreState: { currentScore: 42.5, opponentScore: 10 },
    });
    expect(win.result).toBe('win');
    expect(win.updateAgentStats).toBe(true);
    expect(win.pendingReflection).toBe(true);
    expect(win.completionContext).toBeNull();
    expect(win.statusMessage).toBe('Battle complete. Agent: +42.5 pts vs CPU: +10.0 pts. Result: Win.');

    const loss = resolveCompletionDisposition({ scoreState: { currentScore: -5, opponentScore: 0 } });
    expect(loss.result).toBe('loss');
    expect(loss.statusMessage).toBe('Battle complete. Agent: -5.0 pts vs CPU: +0.0 pts. Result: Loss.');

    const draw = resolveCompletionDisposition({ scoreState: { currentScore: 0, opponentScore: 0 } });
    expect(draw.result).toBe('draw');
  });

  it('TOURNAMENT battles produce a defined terminal state with NO W/L-vs-opponent semantics', () => {
    const d = resolveCompletionDisposition({
      gameMode: 'baggerbomb_tournament',
      groupId: 'g1',
      scoreState: { currentScore: -12.3, opponentScore: 0 },
    });
    expect(d.result).toBeNull();                            // no phantom W/L vs a null opponent
    expect(d.updateAgentStats).toBe(false);                  // career W/L/streak never move
    expect(d.completionContext).toBe('tournament_group_scored');
    expect(d.pendingReflection).toBe(true);                  // human-owned: reflection stays
    expect(d.statusMessage).toBe('Battle complete. Day banked at -12.3 pts for the tournament composite.');
    expect(d.statusMessage).not.toContain('vs CPU');
    expect(d.statusMessage).not.toContain('Result');
  });

  it('TOURNAMENT CPU battles additionally skip reflection (contract #5 passivity — no model calls)', () => {
    const d = resolveCompletionDisposition({
      gameMode: 'baggerbomb_tournament',
      isCpu: true,
      scoreState: { currentScore: 7.7 },
    });
    expect(d.pendingReflection).toBe(false);
    expect(d.result).toBeNull();
  });

  it('no completion path throws on opponent: null / missing scoreState', () => {
    expect(() => resolveCompletionDisposition({})).not.toThrow();
    expect(() => resolveCompletionDisposition({ gameMode: 'baggerbomb_tournament' })).not.toThrow();
    expect(resolveCompletionDisposition({}).result).toBe('draw'); // 0 vs 0 — legacy arithmetic intact
  });
});

// ==================== 4. CPU eval skip — static wiring guards ====================

describe('P4 — CPU passive-battle skip (contract #5 consumer), static source guards', () => {
  const source = read('../cron/agent-evaluate.js');

  it('the skip sits AFTER scoring/threshold-history and BEFORE the momentum fetch + risk layer', () => {
    const thresholdLoop = source.indexOf("scoreUpdate[`thresholdHistory.${score.symbol}`] = score.history;");
    const cpuSkip = source.indexOf('if (battle.isCpu === true) {');
    const parallelFetch = source.indexOf('// ---- Parallel data fetch: intraday + rankings');
    const riskLayer = source.indexOf('// ---- Risk evaluation layer');
    expect(thresholdLoop).toBeGreaterThan(-1);
    expect(cpuSkip).toBeGreaterThan(thresholdLoop);
    expect(cpuSkip).toBeLessThan(parallelFetch);
    expect(parallelFetch).toBeLessThan(riskLayer);
  });

  it('the skip persists the scores, releases the lock via finalizeCronState, and returns', () => {
    const block = source.slice(
      source.indexOf('if (battle.isCpu === true) {'),
      source.indexOf('// ---- Parallel data fetch: intraday + rankings')
    );
    expect(block).toContain('finalizeCronState(scoreUpdate,');
    expect(block).toContain('await battleRef.update(scoreUpdate);');
    expect(block).toContain('return;');
    // Nothing triggered: no Haiku, no risk swaps, no narrations inside the block.
    expect(block).not.toContain('executeSwapServer');
    expect(block).not.toContain('anthropic');
  });

  it('completeBattle consumes the disposition (message, reflection flag, stats gate, context stamp)', () => {
    // Mastery P1 (STOP-A.1): completion is a guarded transaction; the
    // disposition now derives from the transaction's own fresh read.
    expect(source).toContain('const disposition = resolveCompletionDisposition(fresh);');
    expect(source).toContain('pendingReflection: disposition.pendingReflection,');
    expect(source).toContain('message: disposition.statusMessage,');
    expect(source).toContain('if (agentDoc.exists && !disposition.updateAgentStats) {');
    expect(source).toContain("await agentRef.update({ activeBattleId: null });");
    expect(source).toContain('updatePayload.completionContext = disposition.completionContext;');
  });
});
