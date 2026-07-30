// src/components/warpStateMachine.test.js
//
// Acceptance rows A2 + A2s for the Battle-Weather Starfield pure core.
// Delight Layer arc, Task 2 (Phase 1). Spec V2 §6.
//
// Pure module, no DOM: runs in the repo's DEFAULT vitest environment (node) with
// no setup file, no jsdom pragma, no canvas or rAF mock. That is the whole point
// of ruling R-T2-S8 — the scheduling decisions were moved into this module so
// they could be asserted here as plain rows instead of behind a jsdom rAF-spy
// rig that the repo has no precedent or home for.
//
// Each row is written to fail under its OWN specific defect, per spec §6 A2.

import { describe, it, expect } from 'vitest';
import {
  WARP_TIER,
  WARP_TUNING,
  WARP_TINT_FALLBACK,
  WARP_OVERRIDE_TOTAL_DURATION_MS,
  WARP_DEVICE_PROFILES,
  toEpochMs,
  endgameWindowMs,
  normalizeLiveGames,
  selectGoverningGame,
  resolveTier,
  targetSpeed,
  createWarpState,
  advanceWarp,
  resolveLoopPlan,
  deviceProfile,
  resolveTint,
  synthesizeOverrideGames,
  makeRng,
  createStars,
  respawnStar,
} from './warpStateMachine';

const NOW = 1_800_000_000_000; // fixed epoch — this module never reads a clock
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** A game that is live but nowhere near its endgame window. */
const liveGame = (overrides = {}) => ({
  id: 'g-live',
  endsAt: NOW + 4 * HOUR,
  totalDuration: 6 * HOUR,
  ...overrides,
});

/** Drive the machine forward in fixed steps, returning every state. */
function run(state, { liveGames, from, steps, stepMs }) {
  const out = [];
  let current = state;
  for (let i = 1; i <= steps; i += 1) {
    const now = from + i * stepMs;
    current = advanceWarp(current, { liveGames, now, dtMs: stepMs });
    out.push(current);
  }
  return out;
}

// ---------------------------------------------------------------------------
// A2 — tier selection
// ---------------------------------------------------------------------------

describe('A2 tier selection (State Map V2 §1)', () => {
  it('RESTING when there are no live games', () => {
    expect(resolveTier({ liveGames: [], now: NOW }).tier).toBe(WARP_TIER.RESTING);
    expect(resolveTier({ liveGames: null, now: NOW }).tier).toBe(WARP_TIER.RESTING);
    expect(resolveTier({ liveGames: undefined, now: NOW }).tier).toBe(WARP_TIER.RESTING);
  });

  it('BATTLE LIVE with >=1 live game when none is inside its endgame window', () => {
    const resolved = resolveTier({ liveGames: [liveGame()], now: NOW });
    expect(resolved.tier).toBe(WARP_TIER.LIVE);
    expect(resolved.liveCount).toBe(1);
  });

  it('ENDGAME when the governing game is inside its window', () => {
    // 6h duration -> 25% = 90min -> capped to 30min. 10min left is inside.
    const resolved = resolveTier({
      liveGames: [liveGame({ endsAt: NOW + 10 * MIN })],
      now: NOW,
    });
    expect(resolved.tier).toBe(WARP_TIER.ENDGAME);
    expect(resolved.remainingMs).toBe(10 * MIN);
  });

  it('drops games that have already ended (at or before now)', () => {
    const games = [
      liveGame({ id: 'done', endsAt: NOW - 1 }),
      liveGame({ id: 'exact', endsAt: NOW }),
    ];
    expect(normalizeLiveGames(games, NOW)).toHaveLength(0);
    expect(resolveTier({ liveGames: games, now: NOW }).tier).toBe(WARP_TIER.RESTING);
  });
});

// ---------------------------------------------------------------------------
// A2 — R-PREC precedence
// ---------------------------------------------------------------------------

describe('A2 R-PREC — the soonest-ending live game governs', () => {
  it('picks the soonest-ending game out of three, regardless of array order', () => {
    const games = [
      liveGame({ id: 'late', endsAt: NOW + 5 * HOUR }),
      liveGame({ id: 'soon', endsAt: NOW + 20 * MIN }),
      liveGame({ id: 'mid', endsAt: NOW + 2 * HOUR }),
    ];
    expect(selectGoverningGame(normalizeLiveGames(games, NOW)).key).toBe('soon');
    expect(resolveTier({ liveGames: games, now: NOW }).governingKey).toBe('soon');
  });

  it('lets the soonest-ending game pull the whole field into ENDGAME while others stay far out', () => {
    const games = [
      liveGame({ id: 'late', endsAt: NOW + 5 * HOUR }),
      liveGame({ id: 'soon', endsAt: NOW + 3 * MIN }),
    ];
    const resolved = resolveTier({ liveGames: games, now: NOW });
    expect(resolved.tier).toBe(WARP_TIER.ENDGAME);
    expect(resolved.governingKey).toBe('soon');
  });

  it('prefers a game with a provable clock over one with no end time', () => {
    const games = [
      liveGame({ id: 'clockless', endsAt: null }),
      liveGame({ id: 'clocked', endsAt: NOW + 3 * HOUR }),
    ];
    expect(resolveTier({ liveGames: games, now: NOW }).governingKey).toBe('clocked');
  });

  it('is deterministic on a tie, so precedence cannot thrash between frames', () => {
    const games = [
      liveGame({ id: 'b', endsAt: NOW + HOUR }),
      liveGame({ id: 'a', endsAt: NOW + HOUR }),
    ];
    const first = resolveTier({ liveGames: games, now: NOW }).governingKey;
    const reversed = resolveTier({ liveGames: [...games].reverse(), now: NOW }).governingKey;
    expect(first).toBe('a');
    expect(reversed).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// A2 — R-WINDOW
// ---------------------------------------------------------------------------

describe('A2 R-WINDOW — window = min(30 min, 25% of total duration)', () => {
  it('takes the 25% slice when the game is short', () => {
    expect(endgameWindowMs(HOUR)).toBe(15 * MIN);          // 25% of 1h
    expect(endgameWindowMs(40 * MIN)).toBe(10 * MIN);      // 25% of 40m
  });

  it('caps at 30 minutes for long formats (the 120h Snake Draft case)', () => {
    expect(endgameWindowMs(120 * HOUR)).toBe(30 * MIN);
    expect(endgameWindowMs(8 * HOUR)).toBe(30 * MIN);
  });

  it('prevents a short battle from being BORN in endgame', () => {
    // A 20-minute battle: window is 5 min, so at t=0 with 20 min left it is LIVE.
    const born = resolveTier({
      liveGames: [{ id: 's', endsAt: NOW + 20 * MIN, totalDuration: 20 * MIN }],
      now: NOW,
    });
    expect(born.tier).toBe(WARP_TIER.LIVE);

    // ...and it only enters endgame in its final 5 minutes.
    const late = resolveTier({
      liveGames: [{ id: 's', endsAt: NOW + 4 * MIN, totalDuration: 20 * MIN }],
      now: NOW,
    });
    expect(late.tier).toBe(WARP_TIER.ENDGAME);
  });

  it('gives NO endgame to a game whose duration cannot be proven (R-T2-S3, C-20 spirit)', () => {
    expect(endgameWindowMs(null)).toBe(0);
    expect(endgameWindowMs(undefined)).toBe(0);
    expect(endgameWindowMs(0)).toBe(0);
    expect(endgameWindowMs(-5)).toBe(0);

    // One second from ending, but no provable duration => still only BATTLE LIVE.
    const resolved = resolveTier({
      liveGames: [{ id: 'league-5day', endsAt: NOW + 1000, totalDuration: null }],
      now: NOW,
    });
    expect(resolved.tier).toBe(WARP_TIER.LIVE);
  });

  it('gives NO endgame to a game with no end timestamp at all', () => {
    const resolved = resolveTier({
      liveGames: [{ id: 'no-clock', endsAt: null, totalDuration: 6 * HOUR }],
      now: NOW,
    });
    expect(resolved.tier).toBe(WARP_TIER.LIVE);
    expect(resolved.remainingMs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// A2 — the endgame ramp
// ---------------------------------------------------------------------------

describe('A2 endgame ramp 0.8 -> 2.2, monotone on the governing clock', () => {
  const duration = 6 * HOUR; // window = 30 min (capped)

  it('starts at the floor on entry and reaches the peak at the final moment', () => {
    const atEntry = resolveTier({
      liveGames: [{ id: 'g', endsAt: NOW + 30 * MIN, totalDuration: duration }],
      now: NOW,
    });
    expect(targetSpeed(atEntry)).toBeCloseTo(WARP_TUNING.SPEED_ENDGAME_FLOOR, 6);

    const atEnd = resolveTier({
      liveGames: [{ id: 'g', endsAt: NOW + 1, totalDuration: duration }],
      now: NOW,
    });
    expect(targetSpeed(atEnd)).toBeGreaterThan(2.19);
    expect(targetSpeed(atEnd)).toBeLessThanOrEqual(WARP_TUNING.SPEED_ENDGAME_PEAK);
  });

  it('is monotone non-decreasing across the whole window', () => {
    const endsAt = NOW + 30 * MIN;
    let previous = -Infinity;
    // Bound stops one second SHORT of the end on purpose: at endsAt the game is
    // resolved, so it correctly leaves the live set and the sky decays to rest.
    // Monotonicity is a property of the ramp while the game is live.
    for (let elapsed = 0; elapsed <= 30 * MIN - 1000; elapsed += 30 * 1000) {
      const speed = targetSpeed(resolveTier({
        liveGames: [{ id: 'g', endsAt, totalDuration: duration }],
        now: NOW + elapsed,
      }));
      expect(speed).toBeGreaterThanOrEqual(previous);
      previous = speed;
    }
    expect(previous).toBeGreaterThan(WARP_TUNING.SPEED_ENDGAME_FLOOR);
  });

  it('leaves the live set the instant the governing game resolves', () => {
    const endsAt = NOW + 30 * MIN;
    const games = [{ id: 'g', endsAt, totalDuration: duration }];
    expect(resolveTier({ liveGames: games, now: endsAt - 1 }).tier).toBe(WARP_TIER.ENDGAME);
    expect(resolveTier({ liveGames: games, now: endsAt }).tier).toBe(WARP_TIER.RESTING);
  });

  it('never exceeds the peak even if the clock overshoots the window', () => {
    const resolved = { tier: WARP_TIER.ENDGAME, rampProgress: 5 };
    expect(targetSpeed(resolved)).toBe(WARP_TUNING.SPEED_ENDGAME_PEAK);
  });

  it('the EASED speed also rises monotonically through a live -> endgame run', () => {
    const endsAt = NOW + 32 * MIN;
    const games = [{ id: 'g', endsAt, totalDuration: duration }];
    // 180 x 10s = 30 min, landing 2 min before the game resolves — deep inside
    // the 30-min window but never past the end (past it, the game is gone and
    // the field decays, which is correct behaviour, not a monotonicity break).
    const states = run(createWarpState(), {
      liveGames: games, from: NOW, steps: 180, stepMs: 10 * 1000,
    });
    const speeds = states.map((s) => s.speed);
    for (let i = 1; i < speeds.length; i += 1) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1] - 1e-9);
    }
    expect(speeds[speeds.length - 1]).toBeGreaterThan(2.0);
  });
});

// ---------------------------------------------------------------------------
// A2 — easing, decay, handoff (R-RAMP)
// ---------------------------------------------------------------------------

describe('A2 R-RAMP — transitions ease, never step', () => {
  it('does not jump on the frame a tier changes', () => {
    const rest = createWarpState();
    expect(rest.speed).toBeCloseTo(WARP_TUNING.SPEED_RESTING, 6);

    const firstLive = advanceWarp(rest, { liveGames: [liveGame()], now: NOW, dtMs: 16 });
    expect(firstLive.tier).toBe(WARP_TIER.LIVE);
    // Tier flipped, speed did NOT: the ease anchor is dropped at the old speed.
    expect(firstLive.speed).toBeCloseTo(WARP_TUNING.SPEED_RESTING, 6);
  });

  it('takes the full tier-ease duration to arrive at BATTLE LIVE', () => {
    const games = [liveGame()];
    let state = advanceWarp(createWarpState(), { liveGames: games, now: NOW, dtMs: 16 });

    const halfway = run(state, {
      liveGames: games, from: NOW, steps: 1, stepMs: WARP_TUNING.TIER_EASE_MS / 2,
    })[0];
    expect(halfway.speed).toBeGreaterThan(WARP_TUNING.SPEED_RESTING);
    expect(halfway.speed).toBeLessThan(WARP_TUNING.SPEED_LIVE);

    const settled = run(state, {
      liveGames: games, from: NOW, steps: 1, stepMs: WARP_TUNING.TIER_EASE_MS,
    })[0];
    expect(settled.speed).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);
  });

  it('decays to RESTING over the ~30s decay window when the last game resolves', () => {
    // Settle into BATTLE LIVE first.
    let state = advanceWarp(createWarpState(), { liveGames: [liveGame()], now: NOW, dtMs: 16 });
    state = run(state, {
      liveGames: [liveGame()], from: NOW, steps: 1, stepMs: WARP_TUNING.TIER_EASE_MS,
    })[0];
    expect(state.speed).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);

    // Game resolves. The decay must use DECAY_MS, not TIER_EASE_MS.
    const resolvedAt = NOW + WARP_TUNING.TIER_EASE_MS;
    const first = advanceWarp(state, { liveGames: [], now: resolvedAt + 16, dtMs: 16 });
    expect(first.tier).toBe(WARP_TIER.RESTING);
    expect(first.easeMs).toBe(WARP_TUNING.DECAY_MS);
    expect(first.speed).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 3); // no step

    // Still on its way down when the shorter tier-ease would already be over.
    const atTierEase = advanceWarp(first, {
      liveGames: [], now: resolvedAt + WARP_TUNING.TIER_EASE_MS, dtMs: WARP_TUNING.TIER_EASE_MS,
    });
    expect(atTierEase.speed).toBeGreaterThan(WARP_TUNING.SPEED_RESTING);

    // Arrived after the full decay.
    const settled = advanceWarp(first, {
      liveGames: [], now: resolvedAt + WARP_TUNING.DECAY_MS, dtMs: WARP_TUNING.DECAY_MS,
    });
    expect(settled.speed).toBeCloseTo(WARP_TUNING.SPEED_RESTING, 6);
  });

  it('re-evaluates precedence and eases on handoff when the governing game resolves', () => {
    const soon = { id: 'soon', endsAt: NOW + 10 * MIN, totalDuration: 6 * HOUR };
    const later = { id: 'later', endsAt: NOW + 5 * HOUR, totalDuration: 6 * HOUR };

    // Settle deep into the soon game's endgame.
    let state = advanceWarp(createWarpState(), { liveGames: [soon, later], now: NOW, dtMs: 16 });
    state = run(state, {
      liveGames: [soon, later], from: NOW, steps: 40, stepMs: 5 * 1000,
    }).pop();
    expect(state.tier).toBe(WARP_TIER.ENDGAME);
    expect(state.governingKey).toBe('soon');
    const speedBeforeHandoff = state.speed;
    expect(speedBeforeHandoff).toBeGreaterThan(WARP_TUNING.SPEED_ENDGAME_FLOOR);

    // 'soon' resolves; 'later' must take over WITHOUT a step.
    const afterHandoff = advanceWarp(state, {
      liveGames: [later], now: NOW + 10 * MIN + 1000, dtMs: 16,
    });
    expect(afterHandoff.tier).toBe(WARP_TIER.LIVE);
    expect(afterHandoff.governingKey).toBe('later');
    expect(afterHandoff.speed).toBeCloseTo(speedBeforeHandoff, 6);

    // ...then eases down to the BATTLE LIVE target rather than snapping.
    const eased = advanceWarp(afterHandoff, {
      liveGames: [later], now: NOW + 10 * MIN + 1000 + WARP_TUNING.TIER_EASE_MS,
      dtMs: WARP_TUNING.TIER_EASE_MS,
    });
    expect(eased.speed).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);
  });

  it('re-anchors when precedence switches between two still-live games', () => {
    const a = { id: 'a', endsAt: NOW + 3 * HOUR, totalDuration: 6 * HOUR };
    const b = { id: 'b', endsAt: NOW + 2 * HOUR, totalDuration: 6 * HOUR };
    let state = advanceWarp(createWarpState(), { liveGames: [a], now: NOW, dtMs: 16 });
    expect(state.governingKey).toBe('a');

    const withB = advanceWarp(state, { liveGames: [a, b], now: NOW + 16, dtMs: 16 });
    expect(withB.governingKey).toBe('b');       // R-PREC re-evaluated
    expect(withB.easeElapsedMs).toBe(0);        // ...and a fresh ease anchored
  });

  it('never mutates the state it is given', () => {
    const state = createWarpState();
    const snapshot = { ...state };
    advanceWarp(state, { liveGames: [liveGame()], now: NOW, dtMs: 500 });
    expect(state).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// A2s — scheduling decisions (ruling R-T2-S8)
// ---------------------------------------------------------------------------

describe('A2s scheduling decisions (R-T2-S8)', () => {
  it('flag OFF never schedules and never draws', () => {
    expect(resolveLoopPlan({ flagOn: false })).toMatchObject({
      shouldSchedule: false, shouldDrawOnce: false, reason: 'flag-off',
    });
  });

  it('reduced motion draws ONE static frame and never schedules a loop', () => {
    expect(resolveLoopPlan({ flagOn: true, reducedMotion: true })).toMatchObject({
      shouldSchedule: false, shouldDrawOnce: true, reason: 'reduced-motion',
    });
  });

  it('hidden tab pauses — no schedule, nothing drawn', () => {
    expect(resolveLoopPlan({ flagOn: true, hidden: true })).toMatchObject({
      shouldSchedule: false, shouldDrawOnce: false, reason: 'hidden',
    });
  });

  it('animates when on, motion-allowed and visible', () => {
    expect(resolveLoopPlan({ flagOn: true })).toMatchObject({
      shouldSchedule: true, shouldDrawOnce: false, reason: 'animate',
    });
  });

  it('applies precedence flag-off > reduced-motion > hidden', () => {
    expect(resolveLoopPlan({ flagOn: false, reducedMotion: true, hidden: true }).reason)
      .toBe('flag-off');
    expect(resolveLoopPlan({ flagOn: true, reducedMotion: true, hidden: true }).reason)
      .toBe('reduced-motion');
  });

  it('defaults to doing nothing when called with no argument', () => {
    expect(resolveLoopPlan()).toMatchObject({ shouldSchedule: false, shouldDrawOnce: false });
  });
});

// ---------------------------------------------------------------------------
// Device budget (Amendment A3)
// ---------------------------------------------------------------------------

describe('device budget tiers (Amendment A3)', () => {
  it('gives mobile its own tier — fewer particles AND a lower DPR cap', () => {
    const desktop = deviceProfile('desktop');
    const mobile = deviceProfile('mobile');
    expect(desktop).toEqual({ particleCount: 220, maxDpr: 2 });
    expect(mobile.particleCount).toBeLessThan(desktop.particleCount);
    expect(mobile.maxDpr).toBe(1.5);
    expect(mobile.particleCount).toBeGreaterThanOrEqual(110);
    expect(mobile.particleCount).toBeLessThanOrEqual(130);
  });

  it('defines a degraded mobile-lite tier (defined, deliberately not auto-selected)', () => {
    const lite = deviceProfile('mobile-lite');
    expect(lite.particleCount).toBeLessThan(deviceProfile('mobile').particleCount);
    expect(lite.maxDpr).toBe(1);
    // No detection signal exists in the repo, so nothing may resolve to it by
    // accident — an unknown mode must fall back to desktop, never to lite.
    expect(deviceProfile('weak-phone')).toEqual(WARP_DEVICE_PROFILES.desktop);
  });

  it('falls back to desktop for an unknown or missing mode', () => {
    expect(deviceProfile(undefined)).toEqual(WARP_DEVICE_PROFILES.desktop);
    expect(deviceProfile(null)).toEqual(WARP_DEVICE_PROFILES.desktop);
  });
});

// ---------------------------------------------------------------------------
// Tint sanitizing (feeds A5)
// ---------------------------------------------------------------------------

describe('resolveTint — no var() may reach a canvas op', () => {
  it('passes a computed hex straight through', () => {
    expect(resolveTint('#00d9ff')).toBe('#00d9ff');
    expect(resolveTint('  #ff00aa  ')).toBe('#ff00aa');
  });

  it('falls back when readToken hands back a var() string', () => {
    expect(resolveTint('var(--ft-accent)')).toBe(WARP_TINT_FALLBACK);
    expect(resolveTint('var(--ft-cyan)')).toBe(WARP_TINT_FALLBACK);
  });

  it('falls back on empty / missing / non-string input (no DOM case)', () => {
    expect(resolveTint('')).toBe(WARP_TINT_FALLBACK);
    expect(resolveTint(null)).toBe(WARP_TINT_FALLBACK);
    expect(resolveTint(undefined)).toBe(WARP_TINT_FALLBACK);
    expect(resolveTint(123)).toBe(WARP_TINT_FALLBACK);
  });

  it('honours an explicit fallback', () => {
    expect(resolveTint('var(--x)', '#123456')).toBe('#123456');
  });
});

// ---------------------------------------------------------------------------
// Dev override synthesis (R-T2-S4)
// ---------------------------------------------------------------------------

describe('synthesizeOverrideGames — the dev instrument drives the REAL machine', () => {
  it('returns null when there is no override (distinct from "resting")', () => {
    expect(synthesizeOverrideGames(null, NOW)).toBeNull();
    expect(synthesizeOverrideGames(undefined, NOW)).toBeNull();
    expect(synthesizeOverrideGames({}, NOW)).toBeNull();
    expect(synthesizeOverrideGames({ state: 'nonsense' }, NOW)).toBeNull();
  });

  it('resting yields an empty game list, which resolves to RESTING', () => {
    const games = synthesizeOverrideGames({ state: 'resting' }, NOW);
    expect(games).toEqual([]);
    expect(resolveTier({ liveGames: games, now: NOW }).tier).toBe(WARP_TIER.RESTING);
  });

  it('live yields a game far outside its window, which resolves to BATTLE LIVE', () => {
    const games = synthesizeOverrideGames({ state: 'live' }, NOW);
    const resolved = resolveTier({ liveGames: games, now: NOW });
    expect(resolved.tier).toBe(WARP_TIER.LIVE);
    expect(targetSpeed(resolved)).toBe(WARP_TUNING.SPEED_LIVE);
  });

  it('endgame honours ?warpClock= seconds and resolves to ENDGAME', () => {
    const games = synthesizeOverrideGames({ state: 'endgame', clockSeconds: 90 }, NOW);
    expect(games[0].endsAt).toBe(NOW + 90 * 1000);
    const resolved = resolveTier({ liveGames: games, now: NOW });
    expect(resolved.tier).toBe(WARP_TIER.ENDGAME);
    expect(resolved.remainingMs).toBe(90 * 1000);
  });

  it('defaults the endgame clock when ?warpClock= is absent or junk', () => {
    for (const override of [
      { state: 'endgame' },
      { state: 'endgame', clockSeconds: null },
      { state: 'endgame', clockSeconds: -5 },
      { state: 'endgame', clockSeconds: NaN },
    ]) {
      const games = synthesizeOverrideGames(override, NOW);
      expect(games[0].endsAt).toBe(NOW + 90 * 1000);
    }
  });

  it('clamps an over-long endgame clock into the window, so "endgame" IS endgame', () => {
    // 2h requested, but the window for the synthetic duration is 30 min.
    const games = synthesizeOverrideGames({ state: 'endgame', clockSeconds: 7200 }, NOW);
    const resolved = resolveTier({ liveGames: games, now: NOW });
    expect(resolved.tier).toBe(WARP_TIER.ENDGAME);
    expect(resolved.remainingMs).toBe(endgameWindowMs(WARP_OVERRIDE_TOTAL_DURATION_MS));
  });

  it('accepts capitalised state values from the query string', () => {
    expect(synthesizeOverrideGames({ state: 'ENDGAME', clockSeconds: 10 }, NOW)).toHaveLength(1);
    expect(synthesizeOverrideGames({ state: 'Resting' }, NOW)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Timestamp coercion — the shapes real battle docs carry
// ---------------------------------------------------------------------------

describe('toEpochMs', () => {
  it('accepts the ISO strings agentBattles docs actually store in expiresAt', () => {
    const iso = new Date(NOW).toISOString();
    expect(toEpochMs(iso)).toBe(NOW);
  });

  it('accepts epoch numbers, Dates and Firestore-ish shapes', () => {
    expect(toEpochMs(NOW)).toBe(NOW);
    expect(toEpochMs(new Date(NOW))).toBe(NOW);
    expect(toEpochMs({ seconds: NOW / 1000 })).toBe(NOW);
    expect(toEpochMs({ toMillis: () => NOW })).toBe(NOW);
  });

  it('returns null for unusable values rather than coercing to 0', () => {
    expect(toEpochMs(null)).toBeNull();
    expect(toEpochMs(undefined)).toBeNull();
    expect(toEpochMs('not a date')).toBeNull();
    expect(toEpochMs(NaN)).toBeNull();
    expect(toEpochMs({})).toBeNull();
  });

  it('a null end time must never read as "ended at epoch 0" and drop the game', () => {
    const resolved = resolveTier({
      liveGames: [{ id: 'x', endsAt: null, totalDuration: HOUR }],
      now: NOW,
    });
    expect(resolved.liveCount).toBe(1);
    expect(resolved.tier).toBe(WARP_TIER.LIVE);
  });
});

// ---------------------------------------------------------------------------
// Seeded field init (R-T2-S7)
// ---------------------------------------------------------------------------

describe('seeded init (R-T2-S7)', () => {
  it('makeRng is deterministic for a given seed and differs between seeds', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const c = makeRng(43);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    const seqC = [c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const n of seqA) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('falls back to Math.random with no seed', () => {
    expect(makeRng(null)).toBe(Math.random);
    expect(makeRng(undefined)).toBe(Math.random);
  });

  it('createStars produces a stable field for a seed, inside the unit ranges', () => {
    const first = createStars(50, makeRng(7));
    const second = createStars(50, makeRng(7));
    expect(first).toHaveLength(50);
    expect(first).toEqual(second);
    for (const star of first) {
      expect(star.x).toBeGreaterThanOrEqual(-1);
      expect(star.x).toBeLessThanOrEqual(1);
      expect(star.y).toBeGreaterThanOrEqual(-1);
      expect(star.y).toBeLessThanOrEqual(1);
      expect(star.z).toBeGreaterThan(0);
      expect(star.z).toBeLessThanOrEqual(1);
      expect(star.pz).toBe(star.z);
    }
  });

  it('respawnStar sends a star back to full depth with its trail reset', () => {
    const star = { x: 0.9, y: -0.4, z: 0.01, pz: 0.02 };
    respawnStar(star, makeRng(3));
    expect(star.z).toBe(1);
    expect(star.pz).toBe(1); // reset, else the first frame draws a full-screen streak
  });

  it('createStars tolerates a zero or negative count', () => {
    expect(createStars(0)).toEqual([]);
    expect(createStars(-5)).toEqual([]);
  });
});
