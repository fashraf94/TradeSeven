// src/components/warpBattleAdapter.test.js
//
// Phase 2 adapter rows. Delight Layer arc, Task 2. Ruling R-T2-S13.
//
// FIXTURES ARE BUILT FROM THE REAL `agentBattles` DOC SHAPE, not from the
// override-synthesized shape. That is the whole point of R-T2-S13: the dev
// override manufactures BOTH `endsAt` and `totalDuration`, so a suite written
// against it would pass while production — where docs carry `expiresAt` and no
// duration field at all — silently never reached ENDGAME.
//
// The fixture below mirrors api/_utils/agentBattleService.js:112-126 field for
// field (the single production creation path). Pure module: default node env.

import { describe, it, expect } from 'vitest';
import { toLiveGame, toLiveGames, isLiveBattle } from './warpBattleAdapter';
import { resolveTier, WARP_TIER, WARP_TUNING } from './warpStateMachine';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// A Tuesday 09:35 ET deploy against a 16:00 ET close.
const DEPLOYED_AT = Date.parse('2026-07-28T13:35:00.000Z');
const CLOSES_AT = Date.parse('2026-07-28T20:00:00.000Z');

/**
 * A real `agentBattles` doc, shaped exactly as createAgentBattle writes it
 * (api/_utils/agentBattleService.js:112-126). Only the fields the adapter reads
 * are asserted on, but the surrounding shape is kept honest so a future field
 * rename shows up here.
 */
const agentBattleDoc = (overrides = {}) => ({
  id: 'battle-abc123',
  agentId: 'agent-1',
  ownerId: 'user-1',
  status: 'active',
  gameMode: 'tiered',
  duration: 'fullday',
  createdAt: new Date(DEPLOYED_AT).toISOString(),
  activatedAt: new Date(DEPLOYED_AT).toISOString(),
  completedAt: null,
  expiresAt: new Date(CLOSES_AT).toISOString(),
  updatedAt: new Date(DEPLOYED_AT).toISOString(),
  timing: {
    tradingDays: ['2026-07-28'],
    currentTradingDay: 1,
    timezone: 'America/New_York',
    localOpen: '09:30',
    localClose: '16:00',
    lastDailyResetAt: null,
  },
  executionMode: 'autopilot',
  ...overrides,
});

describe('R-T2-S13 — the adapter reads the REAL doc shape', () => {
  it('maps expiresAt -> endsAt and derives the duration from activatedAt', () => {
    const game = toLiveGame(agentBattleDoc());
    expect(game).toEqual({
      id: 'battle-abc123',
      endsAt: CLOSES_AT,
      totalDuration: CLOSES_AT - DEPLOYED_AT, // 6h25m — deploy instant to close
    });
  });

  it('produces a game the core can actually take to ENDGAME', () => {
    // The row that would have caught the whole defect class: a real doc, one
    // minute from its close, must reach the ramp — not sit at BATTLE LIVE.
    const doc = agentBattleDoc();
    const resolved = resolveTier({ liveGames: toLiveGames([doc]), now: CLOSES_AT - MIN });
    expect(resolved.tier).toBe(WARP_TIER.ENDGAME);
    expect(resolved.rampProgress).toBeGreaterThan(0.9);
  });

  it('a fullday doc yields the 30-minute capped window, not a 25% slice', () => {
    // 6h25m x 25% = ~96 min, so the 30-minute cap governs.
    const games = toLiveGames([agentBattleDoc()]);
    const justInside = resolveTier({ liveGames: games, now: CLOSES_AT - 29 * MIN });
    const justOutside = resolveTier({ liveGames: games, now: CLOSES_AT - 31 * MIN });
    expect(justInside.tier).toBe(WARP_TIER.ENDGAME);
    expect(justOutside.tier).toBe(WARP_TIER.LIVE);
    expect(justInside.windowMs).toBe(30 * MIN);
  });

  it('a late-day deploy gets a PROPORTIONALLY smaller window, never born in endgame', () => {
    // Deployed 20 minutes before the close: window is 5 min, so it opens LIVE.
    const lateDeploy = new Date(CLOSES_AT - 20 * MIN).toISOString();
    const doc = agentBattleDoc({ activatedAt: lateDeploy, createdAt: lateDeploy });
    const games = toLiveGames([doc]);
    expect(resolveTier({ liveGames: games, now: CLOSES_AT - 20 * MIN }).tier).toBe(WARP_TIER.LIVE);
    expect(resolveTier({ liveGames: games, now: CLOSES_AT - 4 * MIN }).tier).toBe(WARP_TIER.ENDGAME);
  });
});

describe('the adapter filter IS the card filter', () => {
  it('keeps only status === "active", exactly as the dashboard card does', () => {
    // CommandDashboardDesktop.jsx:89 — (activeAgentBattles||[]).filter(b => b.status === 'active')
    expect(isLiveBattle(agentBattleDoc())).toBe(true);
    expect(isLiveBattle(agentBattleDoc({ status: 'completed' }))).toBe(false);
    expect(isLiveBattle(agentBattleDoc({ status: undefined }))).toBe(false);
    expect(isLiveBattle(null)).toBe(false);

    const mixed = [
      agentBattleDoc({ id: 'live-1' }),
      agentBattleDoc({ id: 'done-1', status: 'completed' }),
      agentBattleDoc({ id: 'live-2' }),
    ];
    expect(toLiveGames(mixed).map((g) => g.id)).toEqual(['live-1', 'live-2']);
  });

  it('a completed battle cannot hold the sky live', () => {
    const games = toLiveGames([agentBattleDoc({ status: 'completed' })]);
    expect(games).toEqual([]);
    expect(resolveTier({ liveGames: games, now: DEPLOYED_AT }).tier).toBe(WARP_TIER.RESTING);
  });
});

describe('activation fallback (the house activatedAt || createdAt pattern)', () => {
  it('falls back to createdAt when activatedAt is missing', () => {
    const doc = agentBattleDoc({ activatedAt: undefined });
    expect(toLiveGame(doc).totalDuration).toBe(CLOSES_AT - DEPLOYED_AT);
  });

  it('falls back when activatedAt is null (legacy doc)', () => {
    const doc = agentBattleDoc({ activatedAt: null });
    expect(toLiveGame(doc).totalDuration).toBe(CLOSES_AT - DEPLOYED_AT);
  });

  it('prefers activatedAt over createdAt when the two differ', () => {
    const later = new Date(DEPLOYED_AT + HOUR).toISOString();
    const doc = agentBattleDoc({ activatedAt: later });
    expect(toLiveGame(doc).totalDuration).toBe(CLOSES_AT - (DEPLOYED_AT + HOUR));
  });

  it('reports an UNPROVABLE duration rather than inventing one when both are gone', () => {
    // Still a live game (membership holds, matching the card) — but no window,
    // so it caps at BATTLE LIVE and never guesses a ramp (R-T2-S3 principle).
    const doc = agentBattleDoc({ activatedAt: null, createdAt: null });
    const game = toLiveGame(doc);
    expect(game.endsAt).toBe(CLOSES_AT);
    expect(game.totalDuration).toBeNull();

    const oneSecondOut = resolveTier({ liveGames: [game], now: CLOSES_AT - 1000 });
    expect(oneSecondOut.tier).toBe(WARP_TIER.LIVE);
    expect(oneSecondOut.liveCount).toBe(1);
  });

  it('treats a non-positive span as unprovable rather than clamping it', () => {
    const skewed = agentBattleDoc({ activatedAt: new Date(CLOSES_AT + HOUR).toISOString() });
    expect(toLiveGame(skewed).totalDuration).toBeNull();
  });

  it('survives a doc with no clock at all without dropping it from the live set', () => {
    const doc = agentBattleDoc({ expiresAt: null, activatedAt: null, createdAt: null });
    const game = toLiveGame(doc);
    expect(game.endsAt).toBeNull();
    expect(resolveTier({ liveGames: [game], now: DEPLOYED_AT }).tier).toBe(WARP_TIER.LIVE);
  });
});

describe('defect-#2-shaped input (App.jsx:3902 resets the poll to [] on any error)', () => {
  it('an empty array mid-battle reads as RESTING, matching the card', () => {
    // The card shows "No battle live" for the same input, so the sky agreeing
    // with it is correct behaviour, not a bug. The honest fix is upstream
    // (ruling R-T2-S11 — defect #2 is required before flip, on its own branch).
    expect(toLiveGames([])).toEqual([]);
    expect(resolveTier({ liveGames: toLiveGames([]), now: DEPLOYED_AT }).tier)
      .toBe(WARP_TIER.RESTING);
  });

  it('recovers on the next successful poll', () => {
    const back = toLiveGames([agentBattleDoc()]);
    expect(resolveTier({ liveGames: back, now: CLOSES_AT - MIN }).tier).toBe(WARP_TIER.ENDGAME);
  });
});

describe('adapter robustness', () => {
  it('tolerates a non-array, null or undefined poll result', () => {
    expect(toLiveGames(null)).toEqual([]);
    expect(toLiveGames(undefined)).toEqual([]);
    expect(toLiveGames('nope')).toEqual([]);
    expect(toLiveGames([null, undefined])).toEqual([]);
  });

  it('never imports a Firestore API (row A6)', async () => {
    const source = await import('node:fs').then(({ readFileSync }) =>
      readFileSync('src/components/warpBattleAdapter.js', 'utf8'));
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/from\s+['"]firebase/);
    expect(code).not.toContain('onSnapshot');
    expect(code).not.toContain('getDocs');
    expect(code).not.toContain('setInterval');
  });

  it('keeps the id so precedence has a stable identity across polls', () => {
    // Without this the core falls back to a content-derived key; with real docs
    // the id is present and is the stable handle across 120s poll refreshes.
    expect(toLiveGame(agentBattleDoc()).id).toBe('battle-abc123');
    expect(toLiveGame(agentBattleDoc({ id: undefined })).id).toBeNull();
  });

  it('a battle that expired between polls leaves the live set on the clock alone', () => {
    // The poll can be up to 120s stale, so a doc can still say status:'active'
    // after its expiry. The core drops it on the clock without waiting for the
    // server to flip the status.
    const games = toLiveGames([agentBattleDoc()]);
    expect(resolveTier({ liveGames: games, now: CLOSES_AT + 1 }).tier).toBe(WARP_TIER.RESTING);
    expect(WARP_TUNING.SPEED_RESTING).toBeGreaterThan(0); // guard against a 0 tuning typo
  });
});

// ===========================================================================
// Acceptance row A5 — the post-deploy settle (Task 4 Phase 2, ruling R-T4-S1).
//
// The settle appends the just-created battle to `activeAgentBattles` optimistically
// (src/App.jsx, handleCreateAgentTrainingBattle) so the sky lands on BATTLE LIVE at
// commit instead of decaying to RESTING and waiting up to 120s for the poll to
// notice. These rows pin the CONTRACT that injection depends on: that the shape it
// writes really does project to BATTLE LIVE through this adapter. The injection
// site itself is guarded in src/App.deploySettle.test.js.
// ===========================================================================

/**
 * Exactly the object the §2 settle appends — no more fields than App.jsx
 * actually writes, so this fails if the injection starts relying on something
 * the deploy response does not carry. Reuses the same deploy/close instants as
 * the real-doc fixture above.
 */
const injectedDoc = (overrides = {}) => ({
  id: 'battle-just-deployed',
  agentId: 'agent-1',
  status: 'active',
  expiresAt: new Date(CLOSES_AT).toISOString(),
  activatedAt: new Date(DEPLOYED_AT).toISOString(),
  createdAt: new Date(DEPLOYED_AT).toISOString(),
  ...overrides,
});

describe('A5 — the optimistically injected battle lands the sky on BATTLE LIVE', () => {
  it('projects to a live game the instant it is injected', () => {
    const games = toLiveGames([injectedDoc()]);
    expect(games).toHaveLength(1);
    expect(isLiveBattle(injectedDoc())).toBe(true);
  });

  it('resolves to BATTLE LIVE, never an intermediate RESTING dip', () => {
    // THE ROW THE WHOLE §2 MECHANISM EXISTS FOR. Without the injection the sky
    // sees an empty live set at commit and resolves RESTING until a poll lands.
    const games = toLiveGames([injectedDoc()]);
    const resolved = resolveTier({ liveGames: games, now: DEPLOYED_AT + 1000 });
    expect(resolved.tier).toBe(WARP_TIER.LIVE);
    expect(resolved.tier).not.toBe(WARP_TIER.RESTING);

    // ...and with NO injection, the same instant is RESTING — this is the
    // contradiction the settle removes.
    expect(resolveTier({ liveGames: [], now: DEPLOYED_AT + 1000 }).tier).toBe(WARP_TIER.RESTING);
  });

  it('does NOT claim an endgame at the moment of deploy', () => {
    // A fresh battle is a whole session away from its close; the sky must ramp
    // for a real endgame, not for having just been deployed.
    const resolved = resolveTier({ liveGames: toLiveGames([injectedDoc()]), now: DEPLOYED_AT + 1000 });
    expect(resolved.rampProgress).toBe(0);
  });

  it('a missing expiresAt still counts as live, capped at BATTLE LIVE', () => {
    // The deploy response may not carry expiresAt. That is an unprovable clock:
    // the battle is real and must show as live, but it can never claim a ramp.
    const games = toLiveGames([injectedDoc({ expiresAt: null })]);
    expect(games).toHaveLength(1);
    const resolved = resolveTier({ liveGames: games, now: DEPLOYED_AT + 1000 });
    expect(resolved.tier).toBe(WARP_TIER.LIVE);
    expect(resolved.windowMs).toBe(0); // no endgame is reachable
  });

  it('self-heals: a later poll carrying the real doc replaces it wholesale', () => {
    // The poll does setActiveAgentBattles(battles) over the whole array, so the
    // optimistic entry needs no dedup bookkeeping — the server doc simply wins.
    const serverDoc = { ...injectedDoc(), activatedAt: new Date(DEPLOYED_AT - 500).toISOString() };
    const games = toLiveGames([serverDoc]);
    expect(games).toHaveLength(1);
    expect(resolveTier({ liveGames: games, now: DEPLOYED_AT + 1000 }).tier).toBe(WARP_TIER.LIVE);
  });

  it('a FAILED deploy injects nothing, so the sky returns to what state warrants', () => {
    // Deploy failure never reaches the injection site (it lives past the success
    // gate), so the live set stays empty and the surge simply exhales out.
    expect(resolveTier({ liveGames: toLiveGames([]), now: DEPLOYED_AT }).tier)
      .toBe(WARP_TIER.RESTING);
  });
});
