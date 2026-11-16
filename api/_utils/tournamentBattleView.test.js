// api/_utils/tournamentBattleView.test.js
//
// P7 — the server-side WHY projection battery (founder ruling, P7 Stage A:
// conceal WHY server-side for non-owner reads). Locks: the owner sees full WHY,
// live and after completion; a NON-owner's read, at EVERY status (founder
// ruling R-F, 15 Nov 2026 — completion opens nothing more), is stripped of
// every WHY field (incl. the swap-candidate watchlist + agentContext strategy
// surface) and of the account id (`ownerId`) while keeping the public WHAT;
// input never mutated; the per-owner "current battle" pick; and the seat-keyed
// league view map (no account id as a key).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): importing the real
// tournamentBattleView.js is the runtime guard for its api/ -> src/ import of
// src/constants/leagueTournament.js (pickCurrentTournamentBattle) — it explodes
// in this Node test env if a browser-only dependency ever enters that graph.
// Never mock that import.

import { describe, it, expect } from 'vitest';
import { projectTournamentBattle, pickCurrentBattlesByOwner, projectBattlesBySeat } from './tournamentBattleView.js';

// A synthetic, uid-shaped owner id planted so a VALUE scan can prove no
// non-owner projection carries it anywhere (no real account id is used).
const RIVAL_UID = 'PLANTEDrivalUid00000000000AA';
const VIEWER_UID = 'PLANTEDviewerUid0000000000BB';

function whyBattle(overrides = {}) {
  return {
    id: 'b1',
    ownerId: RIVAL_UID,
    // A training pod's human seat deploys its training clone, whose doc id
    // embeds the owner's account id (trainingCloneDocId) — review lens E1.
    agentId: `training-agent-g1-${RIVAL_UID}`,
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
      // The free-text messages the real writers put in the feed (review lens
      // E2–E4): a guardrail LEVEL (agentGuardrails.js), the Film Room
      // self-review's grade and lesson (agent-batch-review.js), the model's own
      // status line (agent-evaluate.js `status_feed_update`).
      { timestamp: '2026-09-02T15:00:00.000Z', message: 'Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.', action: 'guardrail_forced_swap', symbolOut: 'GILD', symbolIn: 'MOS' },
      { timestamp: '2026-09-02T21:00:00.000Z', message: 'Game Tape: Day 1 review complete. Grade: B. PLANTED-LESSON: I sold strength too early.', action: 'film_room' },
      { timestamp: '2026-09-02T15:30:00.000Z', message: 'PLANTED-STATUS-LINE: holding per the no-crypto instruction, risk at 8%.', action: 'hold' },
    ],
    trades: [
      { symbolOut: 'OLD', symbolIn: 'NVDA', lockedPoints: 12, rationale: 'cut the laggard', hypothesis: 'NVDA runs', trade_reasoning: 'rotation', snapshot: { secret: true } },
    ],
    evaluations: [{ evalId: 'e1', rationale: 'hold the line', hypothesis: 'mean reversion' }],
    proposalHistory: [{ id: 'p1' }],
    // R-F's named private fields, each at its REAL path on the battle record
    // (discovery F5): chat, the instruction, the pending proposal.
    pendingProposal: { symbolOut: 'OLD', symbolIn: 'COIN', rationale: 'PLANTED-PROPOSAL' },
    directive: { text: 'PLANTED-DIRECTIVE: no crypto today', threadId: 'th-1', setAt: '2026-09-02T13:00:00.000Z' },
    chatExchanges: [{ q: 'why?', a: 'because' }],
    battleLedger: [{ kind: 'note' }],
    livePriceBeacon: { prices: { NVDA: 110 } },
    // The agent's swap-candidate universe — strategic intent; a denylist leaked
    // it (P7 code review). Must conceal for a non-owner active read.
    watchlist: { active: ['NVDA'], hotBench: ['COIN'], monitoring: ['PLTR'] },
    ...overrides,
  };
}

// The allowlist shape of whyBattle() for a non-owner — written out by hand, so
// a row comparing to it fails on ANY extra or missing key at any status.
function allowlistShapeOf(status) {
  return {
    id: 'b1',
    status,
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
    },
    statusFeed: [],
    trades: [{ symbolOut: 'OLD', symbolIn: 'NVDA', lockedPoints: 12 }],
    _whyConcealed: true,
  };
}

describe('projectTournamentBattle — the owner sees full WHY; a non-owner the allowlist at EVERY status (R-F)', () => {
  it('returns the doc UNCHANGED for the owner, live and after completion (the same object)', () => {
    for (const status of ['active', 'completed']) {
      const b = whyBattle({ status });
      expect(projectTournamentBattle(b, { isOwner: true })).toBe(b);
    }
  });

  it('a non-owner\'s projection of a COMPLETED battle equals the allowlist shape — completion opens nothing more', () => {
    const b = whyBattle({ status: 'completed' });
    const out = projectTournamentBattle(b, { isOwner: false });
    expect(out).not.toBe(b);
    expect(out).toEqual(allowlistShapeOf('completed'));
  });

  it('a non-owner\'s projection is the same at every status (only `status` itself differs)', () => {
    for (const status of ['active', 'completed', 'cancelled', undefined]) {
      const out = projectTournamentBattle(whyBattle({ status }), { isOwner: false });
      const want = allowlistShapeOf(status);
      if (status === undefined) delete want.status;
      expect(out).toEqual(want);
    }
  });

  it('carries no `ownerId` — no account id reaches another player through the projection', () => {
    for (const status of ['active', 'completed']) {
      const out = projectTournamentBattle(whyBattle({ status }), { isOwner: false });
      expect(out).not.toHaveProperty('ownerId');
      expect(JSON.stringify(out)).not.toContain(RIVAL_UID);
    }
  });
});

// Pilot P1b (pilot spec §2.7; Phase 0 row #15; acceptance row 8): the player's
// frozen idea (agentContext.equippedHypothesis — statement, conditions,
// evidence refs) is owner-only at completion too: "owner sees full, others none".
const SIBLING = {
  watchlistId: 'wl-1', hypothesisVersion: 2, contentHash: 'c'.repeat(64), statement: 'PLANTED-IDEA: AI capex compounds',
  horizonEnum: 'swing', horizonSource: 'player', activation: [{ symbol: 'NVDA', side: 'above', level: 100, basis: 'daily_close' }],
  invalidation: [], evidenceRefs: [{ kind: 'researchWork', id: 'ws_planted' }], publishedAt: null, origin: 'signaldrop',
};

describe('projectTournamentBattle — P1b: the frozen idea is the OWNER\'s, at completion too', () => {
  it('a COMPLETED battle shown to a NON-owner never carries equippedHypothesis (the allowlist — a copy, the input is not mutated)', () => {
    const b = whyBattle({ status: 'completed' });
    b.agentContext.equippedHypothesis = SIBLING;
    const out = projectTournamentBattle(b, { isOwner: false });
    expect(out).not.toBe(b);
    expect('equippedHypothesis' in out.agentContext).toBe(false);
    expect(JSON.stringify(out)).not.toContain('PLANTED-IDEA');
    expect(out).toEqual(allowlistShapeOf('completed'));
    expect(b.agentContext.equippedHypothesis).toBe(SIBLING);
  });
  it('the OWNER sees it in full, live and after completion (the same object)', () => {
    for (const status of ['active', 'completed']) {
      const b = whyBattle({ status });
      b.agentContext.equippedHypothesis = SIBLING;
      expect(projectTournamentBattle(b, { isOwner: true })).toBe(b);
    }
  });
  it('an ACTIVE battle shown to a non-owner never carried it either (the allowlist)', () => {
    const b = whyBattle();
    b.agentContext.equippedHypothesis = SIBLING;
    expect('equippedHypothesis' in projectTournamentBattle(b, { isOwner: false }).agentContext).toBe(false);
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

  // R-F (security-pack review, exposure lens E2–E5): the feed's free-text
  // `message` carries guardrail LEVELS, the self-review's grade and lesson and
  // the model's own status line, and its `action` names the mechanism. A key
  // allowlist cannot strip a value, so a non-owner receives no feed at all.
  it('a non-owner receives NO statusFeed — not the guardrail level, not the review lesson, not the model\'s status line', () => {
    expect(projected.statusFeed).toEqual([]);
    const wire = JSON.stringify(projected);
    for (const leak of ['stop-loss at 8%', 'PLANTED-LESSON', 'Grade: B', 'PLANTED-STATUS-LINE', 'guardrail_forced_swap', 'film_room']) {
      expect(wire, leak).not.toContain(leak);
    }
  });

  // Phase 0 V2 Hazard 12: `source` / `triggeredBy` name the MECHANISM that
  // fired a swap. The trades[] projection withholds them; the feed is withheld whole.
  it('withholds swap ATTRIBUTION from the trades a non-owner receives', () => {
    expect(projected.trades[0].source).toBeUndefined();
    expect(projected.trades[0].triggeredBy).toBeUndefined();
  });

  it('carries no `agentId` — a training clone\'s id embeds the owner\'s account id (review lens E1)', () => {
    expect(projected).not.toHaveProperty('agentId');
    expect(JSON.stringify(projected)).not.toContain(RIVAL_UID);
  });

  it('the OWNER still sees swap attribution (concealment is per-viewer, not deletion)', () => {
    const b = whyBattle();
    const own = projectTournamentBattle(b, { isOwner: true });
    expect(own.statusFeed[0].source).toBe('haiku');
    expect(own.statusFeed[0].triggeredBy).toBe('threshold_breach, momentum_shift');
  });

  it('a COMPLETED battle keeps the feed and the attribution from a non-owner (R-F: completion opens nothing more)', () => {
    const done = projectTournamentBattle(whyBattle({ status: 'completed' }), { isOwner: false });
    expect(done.statusFeed).toEqual([]);
    expect(done.trades[0].rationale).toBeUndefined();
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

// Enforce readiness (table G, V1.4; review ER4-3): the typed marker that a swap's
// outcome could not be confirmed is WHAT, not WHY — a spectator's pane drops a
// marked beat exactly as the owner's does, so the projection must carry it.
// Enforce readiness (table G V1.4) pinned the unconfirmed-outcome marker on the
// PUBLIC feed. Since R-F a non-owner receives no feed, so the marker is the
// OWNER's: their own copy keeps every entry and its marker, unchanged.
describe('enforce readiness — the unconfirmed-outcome marker stays on the owner\'s feed; a non-owner receives none', () => {
  it('the owner\'s feed is the stored feed, marker and all; a non-owner\'s is empty', () => {
    const battle = {
      id: 'b', ownerId: 'owner', status: 'active',
      statusFeed: [
        { timestamp: 't1', message: null, action: 'risk_swap_failed', source: 'risk_manager', triggeredBy: 'risk_bust', executionOutcome: 'unknown', symbolOut: 'KO', symbolIn: 'AMD' },
        { timestamp: 't2', message: 'Swapped OLD → NVDA', action: 'swap', source: 'haiku', symbolOut: 'OLD', symbolIn: 'NVDA' },
      ],
    };
    const own = projectTournamentBattle(battle, { isOwner: true });
    expect(own.statusFeed[0].executionOutcome).toBe('unknown');
    expect(own.statusFeed[1]).not.toHaveProperty('executionOutcome');
    expect(projectTournamentBattle(battle, { isOwner: false }).statusFeed).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Security pack, founder ruling R-F (15 Nov 2026): "Spectating stays possible.
// The fix is what a non-owner can see, at any battle status." The eight names
// below are the ruling's private things (and the account id), as keys on the
// battle record (discovery F5): every one is planted at its real path in
// whyBattle(), and a RECURSIVE walk of every non-owner projection — active and
// completed — must find none of them at any depth.
const FORBIDDEN_KEYS = ['ownerId', 'chatExchanges', 'directive', 'equippedWatchlist', 'hotBench', 'pendingProposal', 'deployedGuardrails', 'activeRules'];

function keysFoundDeep(node, found = new Set()) {
  if (Array.isArray(node)) { for (const v of node) keysFoundDeep(v, found); return found; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) { found.add(k); keysFoundDeep(v, found); }
  }
  return found;
}

describe('R-F — a recursive scan of every non-owner projection finds none of the private keys', () => {
  it('the fixture plants every one of them (the scan cannot pass on an empty shell)', () => {
    const planted = keysFoundDeep(whyBattle());
    for (const k of FORBIDDEN_KEYS) expect(planted.has(k), `fixture is missing ${k}`).toBe(true);
  });

  it.each(['active', 'completed'])('%s battle: no private key at any depth, and no planted account id anywhere', (status) => {
    const b = whyBattle({ status });
    b.agentContext.equippedHypothesis = SIBLING;
    const out = projectTournamentBattle(b, { isOwner: false });
    const found = keysFoundDeep(out);
    for (const k of FORBIDDEN_KEYS) expect(found.has(k), `${status}: ${k} reached a non-owner`).toBe(false);
    const wire = JSON.stringify(out);
    expect(wire).not.toContain(RIVAL_UID);
    for (const planted of ['PLANTED-DIRECTIVE', 'PLANTED-PROPOSAL', 'PLANTED-IDEA', 'ride the breakout', 'cut the laggard', 'because', 'stop-loss at 8%', 'PLANTED-LESSON', 'PLANTED-STATUS-LINE', 'training-agent-']) {
      expect(wire, `${status}: "${planted}" reached a non-owner`).not.toContain(planted);
    }
  });

  it('the owner\'s projection is unchanged: every private key still reaches the owner, live and after completion', () => {
    for (const status of ['active', 'completed']) {
      const b = whyBattle({ status });
      const out = projectTournamentBattle(b, { isOwner: true });
      expect(out).toBe(b);
      const found = keysFoundDeep(out);
      for (const k of FORBIDDEN_KEYS) expect(found.has(k)).toBe(true);
    }
  });
});

describe('R-F — projectBattlesBySeat: the league view keys battles by SEAT, never by account id', () => {
  const players = [
    { odUserId: VIEWER_UID, picks: [] },
    { odUserId: RIVAL_UID, picks: [] },
    { odUserId: 'cpu-3', isCpu: true, picks: [] },
  ];
  const viewerBattle = (status = 'active') => whyBattle({ id: 'b-viewer', ownerId: VIEWER_UID, agentId: `training-agent-g1-${VIEWER_UID}`, status });
  const rivalBattle = (status = 'completed') => whyBattle({ id: 'b-rival', ownerId: RIVAL_UID, status });

  it('keys are the owners\' indices in `players` (\'0\'..), the viewer\'s own seat full, every other seat the allowlist', () => {
    const v = viewerBattle();
    const out = projectBattlesBySeat([v, rivalBattle(), whyBattle({ id: 'b-cpu', ownerId: 'cpu-3', agentId: 'cpu-agent-3', isCpu: true })], players, VIEWER_UID);
    expect(Object.keys(out).sort()).toEqual(['0', '1', '2']);
    expect(out['0']).toBe(v);
    expect(out['1']).toEqual({ ...allowlistShapeOf('completed'), id: 'b-rival' });
    expect(out['2']._whyConcealed).toBe(true);
    expect(out['2']).not.toHaveProperty('ownerId');
  });

  it('no rival account id travels anywhere in the map — as a key or a value; the viewer\'s own id only inside the viewer\'s own seat', () => {
    const out = projectBattlesBySeat([viewerBattle(), rivalBattle()], players, VIEWER_UID);
    const wire = JSON.stringify(out);
    expect(wire).not.toContain(RIVAL_UID);
    expect(JSON.stringify({ ...out, 0: undefined })).not.toContain(VIEWER_UID);
  });

  it('a spectator who holds no seat gets every seat as the allowlist, and no account id at all', () => {
    const out = projectBattlesBySeat([viewerBattle(), rivalBattle('active')], players, 'someone-else');
    expect(out['0']._whyConcealed).toBe(true);
    expect(out['1']._whyConcealed).toBe(true);
    const wire = JSON.stringify(out);
    expect(wire).not.toContain(RIVAL_UID);
    expect(wire).not.toContain(VIEWER_UID);
  });

  it('a battle whose owner holds no seat is left out; a missing `players` seats nobody', () => {
    const stray = whyBattle({ id: 'b-stray', ownerId: 'left-the-group' });
    expect(Object.keys(projectBattlesBySeat([stray, rivalBattle()], players, VIEWER_UID))).toEqual(['1']);
    expect(projectBattlesBySeat([rivalBattle()], undefined, VIEWER_UID)).toEqual({});
  });

  it('each seat carries its owner\'s CURRENT battle (the shared pick: active over completed)', () => {
    const done = whyBattle({ id: 'b-rival-mon', ownerId: RIVAL_UID, status: 'completed', createdAt: '2026-09-01T13:30:00.000Z' });
    const live = whyBattle({ id: 'b-rival-tue', ownerId: RIVAL_UID, status: 'active', createdAt: '2026-09-02T13:30:00.000Z' });
    expect(projectBattlesBySeat([done, live], players, VIEWER_UID)['1'].id).toBe('b-rival-tue');
  });
});
