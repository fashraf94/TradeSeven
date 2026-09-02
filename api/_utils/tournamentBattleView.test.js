// api/_utils/tournamentBattleView.test.js
//
// P7 — the server-side WHY projection battery (founder ruling, P7 Stage A:
// conceal live WHY server-side for non-owner active reads). Locks: owner sees
// full WHY live; ANYONE sees full WHY at completion (the Film Room unlock);
// a non-owner's ACTIVE read is stripped of every WHY field (incl. the
// swap-candidate watchlist + agentContext strategy surface) while keeping the
// public WHAT; input never mutated; and the per-owner "current battle" pick.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): importing the real
// tournamentBattleView.js is the runtime guard for its api/ -> src/ import of
// src/constants/leagueTournament.js (pickCurrentTournamentBattle) — it explodes
// in this Node test env if a browser-only dependency ever enters that graph.
// Never mock that import.

import { describe, it, expect } from 'vitest';
import { projectTournamentBattle, pickCurrentBattlesByOwner } from './tournamentBattleView.js';

function whyBattle(overrides = {}) {
  return {
    id: 'b1',
    ownerId: 'owner1',
    status: 'active',
    gameMode: 'baggerbomb_tournament',
    groupId: 'g1',
    opponent: null,
    portfolio: { star: [{ symbol: 'NVDA', tierMultiplier: 1 }], core: [], support: [], startingPrices: { NVDA: 100 } },
    scoreState: { currentScore: 42 },
    thresholdHistory: { NVDA: { maxMultiplier: 1.2 } },
    scoring: { thresholds: { NVDA: { threshold: 2.5 } } },
    agentContext: {
      agentName: 'Atlas',
      archetype: 'momentum',
      tournament: { doubleDownSymbols: ['NVDA'], userPicksAtDeploy: ['NVDA'] },
      initialPortfolio: { star: [{ symbol: 'NVDA' }] },
      innerMonologue: { strategy: 'ride the breakout', starRationale: 'NVDA momentum' },
      strategyBrief: 'aggressive momentum',
      consolidatedInsight: 'prior week notes',
      // Strategy surface that a denylist leaked (P7 code review) — must conceal.
      activeRules: [{ id: 'r1', text: 'cut losers fast' }],
      deployedGuardrails: [{ type: 'maxDrawdown', value: 0.1 }],
      equippedWatchlist: { name: 'My list', tickers: ['NVDA', 'COIN', 'PLTR'] },
      riskTolerance: 70,
    },
    statusFeed: [
      // Shaped after the REAL swap writer (api/cron/agent-evaluate.js) so the
      // allowlist is exercised against the fields production actually stamps —
      // `source` + `triggeredBy` among them (Phase 0 V2 Hazard 12).
      {
        timestamp: '2026-09-02T14:00:00.000Z',
        message: 'Swapped OLD → NVDA',
        action: 'swap',
        symbolOut: 'OLD',
        symbolIn: 'NVDA',
        source: 'haiku',
        triggeredBy: 'threshold_breach, momentum_shift',
        evalId: 'eval_001',
        trade_reasoning: 'OLD stalled, NVDA breaking out',
        citedForgeRules: ['r1'],
      },
    ],
    trades: [
      { symbolOut: 'OLD', symbolIn: 'NVDA', lockedPoints: 12, rationale: 'cut the laggard', hypothesis: 'NVDA runs', trade_reasoning: 'rotation', snapshot: { secret: true } },
    ],
    evaluations: [{ evalId: 'e1', rationale: 'hold the line', hypothesis: 'mean reversion' }],
    proposalHistory: [{ id: 'p1' }],
    chatExchanges: [{ q: 'why?', a: 'because' }],
    battleLedger: [{ kind: 'note' }],
    livePriceBeacon: { prices: { NVDA: 110 } },
    // The agent's swap-candidate universe — strategic intent; a denylist leaked
    // it (P7 code review). Must conceal for a non-owner active read.
    watchlist: { active: ['NVDA'], hotBench: ['COIN'], monitoring: ['PLTR'] },
    ...overrides,
  };
}

describe('projectTournamentBattle — owner / completion = full WHY', () => {
  it('returns the doc UNCHANGED for the owner (live WHY)', () => {
    const b = whyBattle();
    expect(projectTournamentBattle(b, { isOwner: true })).toBe(b);
  });

  it('returns the doc UNCHANGED for a non-owner once COMPLETED (Film Room unlock)', () => {
    const b = whyBattle({ status: 'completed' });
    expect(projectTournamentBattle(b, { isOwner: false })).toBe(b);
  });
});

describe('projectTournamentBattle — non-owner active = WHAT only', () => {
  const projected = projectTournamentBattle(whyBattle(), { isOwner: false });

  it('strips every WHY collection AND the swap-candidate watchlist', () => {
    expect(projected.evaluations).toBeUndefined();
    expect(projected.proposalHistory).toBeUndefined();
    expect(projected.chatExchanges).toBeUndefined();
    expect(projected.battleLedger).toBeUndefined();
    expect(projected.livePriceBeacon).toBeUndefined();
    // The leak the allowlist closes: the agent's swap-candidate universe.
    expect(projected.watchlist).toBeUndefined();
  });

  it('strips agentContext reasoning AND the strategy surface, keeps public stance/identity', () => {
    expect(projected.agentContext.innerMonologue).toBeUndefined();
    expect(projected.agentContext.strategyBrief).toBeUndefined();
    expect(projected.agentContext.consolidatedInsight).toBeUndefined();
    // The agentContext leaks the allowlist closes (P7 code review):
    expect(projected.agentContext.activeRules).toBeUndefined();
    expect(projected.agentContext.deployedGuardrails).toBeUndefined();
    expect(projected.agentContext.equippedWatchlist).toBeUndefined();
    expect(projected.agentContext.riskTolerance).toBeUndefined();
    // ...while the public stance/identity survives.
    expect(projected.agentContext.agentName).toBe('Atlas');
    expect(projected.agentContext.archetype).toBe('momentum');
    expect(projected.agentContext.tournament.doubleDownSymbols).toEqual(['NVDA']);
    expect(projected.agentContext.initialPortfolio).toBeDefined();
  });

  it('keeps statusFeed MESSAGES but strips the structured WHY (trade_reasoning, Forge citations)', () => {
    expect(projected.statusFeed[0].message).toBe('Swapped OLD → NVDA');
    expect(projected.statusFeed[0].action).toBe('swap');
    expect(projected.statusFeed[0].trade_reasoning).toBeUndefined();
    expect(projected.statusFeed[0].citedForgeRules).toBeUndefined();
  });

  // Phase 0 V2 Hazard 12. `source` / `triggeredBy` name the MECHANISM that
  // fired a swap (risk_manager / guardrail / haiku / gameplan_meeting). That is
  // WHY, and the sibling trades[] projection has always withheld it — so a
  // rival could read from the feed what the trade record refused to tell them.
  // These two rows are the whole fix; if either regresses, the leak is back.
  it('strips swap ATTRIBUTION from the statusFeed for a non-owner (same posture as PUBLIC_TRADE)', () => {
    const e = projected.statusFeed[0];
    expect(e.source).toBeUndefined();
    expect(e.triggeredBy).toBeUndefined();
    // ...while the WHAT the rival is entitled to still lands.
    expect(e.symbolOut).toBe('OLD');
    expect(e.symbolIn).toBe('NVDA');
    expect(e.timestamp).toBe('2026-09-02T14:00:00.000Z');
    // The sibling projection this now agrees with — one posture, both lists.
    expect(projected.trades[0].source).toBeUndefined();
    expect(projected.trades[0].triggeredBy).toBeUndefined();
  });

  it('the OWNER still sees swap attribution (concealment is per-viewer, not deletion)', () => {
    const b = whyBattle();
    const own = projectTournamentBattle(b, { isOwner: true });
    expect(own.statusFeed[0].source).toBe('haiku');
    expect(own.statusFeed[0].triggeredBy).toBe('threshold_breach, momentum_shift');
  });

  it('a COMPLETED battle unlocks attribution for everyone (Film Room)', () => {
    const done = projectTournamentBattle(whyBattle({ status: 'completed' }), { isOwner: false });
    expect(done.statusFeed[0].source).toBe('haiku');
    expect(done.statusFeed[0].triggeredBy).toBe('threshold_breach, momentum_shift');
  });

  it('keeps trade WHAT (symbols, points) but strips trade WHY', () => {
    const t = projected.trades[0];
    expect(t.symbolOut).toBe('OLD');
    expect(t.symbolIn).toBe('NVDA');
    expect(t.lockedPoints).toBe(12);
    expect(t.rationale).toBeUndefined();
    expect(t.hypothesis).toBeUndefined();
    expect(t.trade_reasoning).toBeUndefined();
    expect(t.snapshot).toBeUndefined();
  });

  it('keeps the public WHAT (positions, score, thresholds) and stamps _whyConcealed', () => {
    expect(projected.portfolio.star[0].symbol).toBe('NVDA');
    expect(projected.scoreState.currentScore).toBe(42);
    expect(projected.thresholdHistory.NVDA.maxMultiplier).toBe(1.2);
    expect(projected.scoring.thresholds.NVDA.threshold).toBe(2.5);
    expect(projected._whyConcealed).toBe(true);
  });

  it('never mutates the input', () => {
    const b = whyBattle();
    projectTournamentBattle(b, { isOwner: false });
    expect(b.evaluations).toHaveLength(1);
    expect(b.agentContext.innerMonologue).toBeDefined();
    expect(b.agentContext.activeRules).toHaveLength(1);
    expect(b.watchlist.active).toEqual(['NVDA']);
    expect(b.statusFeed[0].trade_reasoning).toBe('OLD stalled, NVDA breaking out');
    expect(b.trades[0].rationale).toBe('cut the laggard');
  });
});

describe('pickCurrentBattlesByOwner', () => {
  it('prefers the active battle over a completed one for the same owner', () => {
    const out = pickCurrentBattlesByOwner([
      { id: 'old', ownerId: 'o1', status: 'completed', createdAt: '2026-06-13T00:00:00Z' },
      { id: 'today', ownerId: 'o1', status: 'active', createdAt: '2026-06-12T00:00:00Z' },
    ]);
    expect(out.o1.id).toBe('today');
  });

  it('among same-status battles, picks the most recent by createdAt', () => {
    const out = pickCurrentBattlesByOwner([
      { id: 'd1', ownerId: 'o1', status: 'completed', createdAt: '2026-06-10T00:00:00Z' },
      { id: 'd2', ownerId: 'o1', status: 'completed', createdAt: '2026-06-12T00:00:00Z' },
    ]);
    expect(out.o1.id).toBe('d2');
  });

  it('returns one entry per owner', () => {
    const out = pickCurrentBattlesByOwner([
      { id: 'a', ownerId: 'o1', status: 'active', createdAt: '2026-06-12T00:00:00Z' },
      { id: 'b', ownerId: 'o2', status: 'active', createdAt: '2026-06-12T00:00:00Z' },
    ]);
    expect(Object.keys(out).sort()).toEqual(['o1', 'o2']);
  });
});
