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
  endgameProgress,
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

// ---------------------------------------------------------------------------
// State Map Amendment B (ruling R-T2-S9) — precedence by URGENCY
// ---------------------------------------------------------------------------

describe('Amendment B — the game furthest into its window governs', () => {
  it('THE CASE THAT DROVE THE AMENDMENT: a longer battle deep in its window wins', () => {
    // A ends sooner in raw time but is NOT in its window (20 min left of a
    // 40-min run => 10-min window). B ends later yet IS in its window (25 min
    // left of a 100-min run => 25-min window). Under the old soonest-ending
    // rule A governed and the sky sat calm through B's actual peak.
    const a = { id: 'a-short', endsAt: NOW + 20 * MIN, totalDuration: 40 * MIN };
    const b = { id: 'b-long', endsAt: NOW + 25 * MIN, totalDuration: 100 * MIN };

    const resolved = resolveTier({ liveGames: [a, b], now: NOW });
    expect(resolved.governingKey).toBe('b-long');
    expect(resolved.tier).toBe(WARP_TIER.ENDGAME);
    expect(resolved.rampProgress).toBeCloseTo(0, 6); // exactly at B's window edge
  });

  it('picks the MOST progressed when several are inside their windows', () => {
    // Progress is fraction of window elapsed, so it compares across durations.
    const early = { id: 'early', endsAt: NOW + 27 * MIN, totalDuration: 6 * HOUR }; // 30m window -> 10%
    const deep = { id: 'deep', endsAt: NOW + 2 * MIN, totalDuration: 40 * MIN };    // 10m window -> 80%
    const mid = { id: 'mid', endsAt: NOW + 10 * MIN, totalDuration: 80 * MIN };     // 20m window -> 50%

    const resolved = resolveTier({ liveGames: [early, deep, mid], now: NOW });
    expect(resolved.governingKey).toBe('deep');
    expect(resolved.rampProgress).toBeCloseTo(0.8, 6);
  });

  it('still falls back to soonest-ending when NOBODY is in a window', () => {
    const soon = { id: 'soon', endsAt: NOW + 2 * HOUR, totalDuration: 6 * HOUR };
    const later = { id: 'later', endsAt: NOW + 5 * HOUR, totalDuration: 6 * HOUR };
    const resolved = resolveTier({ liveGames: [later, soon], now: NOW });
    expect(resolved.tier).toBe(WARP_TIER.LIVE);
    expect(resolved.governingKey).toBe('soon');
  });

  it('an in-window game outranks a sooner-ending one with an unprovable clock', () => {
    const clockless = { id: 'clockless', endsAt: NOW + 1 * MIN, totalDuration: null };
    const inWindow = { id: 'in-window', endsAt: NOW + 10 * MIN, totalDuration: 60 * MIN };
    const resolved = resolveTier({ liveGames: [clockless, inWindow], now: NOW });
    expect(resolved.governingKey).toBe('in-window');
    expect(resolved.tier).toBe(WARP_TIER.ENDGAME);
  });

  it('is order-independent and deterministic on a progress tie', () => {
    const x = { id: 'x', endsAt: NOW + 5 * MIN, totalDuration: 40 * MIN };
    const y = { id: 'y', endsAt: NOW + 5 * MIN, totalDuration: 40 * MIN };
    expect(resolveTier({ liveGames: [x, y], now: NOW }).governingKey).toBe('x');
    expect(resolveTier({ liveGames: [y, x], now: NOW }).governingKey).toBe('x');
  });

  it('corrects the state table clause: BATTLE LIVE = the GOVERNING game is not in its window', () => {
    // With Amendment B this is automatic — if anyone were in a window they
    // would be governing, so a LIVE verdict proves nobody is.
    const games = [
      { id: 'p', endsAt: NOW + 3 * HOUR, totalDuration: 6 * HOUR },
      { id: 'q', endsAt: NOW + 4 * HOUR, totalDuration: 6 * HOUR },
    ];
    const resolved = resolveTier({ liveGames: games, now: NOW });
    expect(resolved.tier).toBe(WARP_TIER.LIVE);
    for (const game of games) {
      expect(endgameProgress({ ...game, key: game.id }, NOW)).toBeNull();
    }
  });

  it('endgameProgress reports null outside a window and a fraction inside it', () => {
    const game = { key: 'g', endsAt: NOW + 30 * MIN, totalDuration: 6 * HOUR };
    expect(endgameProgress(game, NOW - MIN)).toBeNull();          // not yet
    expect(endgameProgress(game, NOW).progress).toBeCloseTo(0, 6); // at the edge
    expect(endgameProgress({ ...game, endsAt: NOW + 15 * MIN }, NOW).progress)
      .toBeCloseTo(0.5, 6);
    expect(endgameProgress({ key: 'n', endsAt: null, totalDuration: HOUR }, NOW)).toBeNull();
    expect(endgameProgress({ key: 'n', endsAt: NOW + MIN, totalDuration: null }, NOW)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// R-T2-S10 — coming down off a peak reads as "that fight ended"
// ---------------------------------------------------------------------------

describe('R-T2-S10 — a resolved endgame eases down over the decay duration', () => {
  it('uses DECAY_MS, not TIER_EASE_MS, on an ENDGAME -> ENDGAME handoff downward', () => {
    const peak = { id: 'peak', endsAt: NOW + 30 * 1000, totalDuration: 6 * HOUR };
    const fresh = { id: 'fresh', endsAt: NOW + 29 * MIN, totalDuration: 6 * HOUR };

    // Settle deep into `peak`'s ramp.
    let state = advanceWarp(createWarpState(), { liveGames: [peak, fresh], now: NOW, dtMs: 16 });
    state = advanceWarp(state, { liveGames: [peak, fresh], now: NOW + WARP_TUNING.TIER_EASE_MS });
    expect(state.tier).toBe(WARP_TIER.ENDGAME);
    expect(state.governingKey).toBe('peak');
    const peakSpeed = state.speed;
    expect(peakSpeed).toBeGreaterThan(1.5);

    // `peak` resolves; `fresh` is still in its own window but far less urgent.
    const after = advanceWarp(state, { liveGames: [fresh], now: NOW + 31 * 1000, dtMs: 16 });
    expect(after.tier).toBe(WARP_TIER.ENDGAME);
    expect(after.governingKey).toBe('fresh');
    expect(after.easeMs, 'the drop must use the ~30s decay, not the 15s tier ease')
      .toBe(WARP_TUNING.DECAY_MS);
    expect(after.speed).toBeCloseTo(peakSpeed, 6); // no step on the handoff frame
  });

  it('also eases down over DECAY_MS when the next game is not in its window', () => {
    // Documented interpretation (flagged in the Phase 2 report): this drop is
    // LARGER than the ENDGAME->ENDGAME one, so snapping it at the tier ease
    // would be the very glitch R-T2-S10 exists to remove.
    const peak = { id: 'peak', endsAt: NOW + 30 * 1000, totalDuration: 6 * HOUR };
    const calm = { id: 'calm', endsAt: NOW + 5 * HOUR, totalDuration: 6 * HOUR };

    let state = advanceWarp(createWarpState(), { liveGames: [peak, calm], now: NOW, dtMs: 16 });
    state = advanceWarp(state, { liveGames: [peak, calm], now: NOW + WARP_TUNING.TIER_EASE_MS });
    const peakSpeed = state.speed;

    const after = advanceWarp(state, { liveGames: [calm], now: NOW + 31 * 1000, dtMs: 16 });
    expect(after.tier).toBe(WARP_TIER.LIVE);
    expect(after.easeMs).toBe(WARP_TUNING.DECAY_MS);
    expect(after.speed).toBeCloseTo(peakSpeed, 6);
  });

  it('still uses the FAST tier ease when the sky is ramping UP into a fight', () => {
    // The decay duration is for winding down only; entering a fight must stay
    // responsive at the 10-20s tier ease.
    const game = [liveGame()];
    const up = advanceWarp(createWarpState(), { liveGames: game, now: NOW, dtMs: 16 });
    expect(up.tier).toBe(WARP_TIER.LIVE);
    expect(up.easeMs).toBe(WARP_TUNING.TIER_EASE_MS);
  });

  it('an UPWARD endgame -> endgame handoff keeps the FAST tier ease, not the decay', () => {
    // Pins the `&& target < prev.speed` clause of resolveEaseMs, which decides
    // decay-vs-fast by DIRECTION. Without it, a hotter fight taking over the sky
    // would ease UP over 30s instead of 15s — sluggish exactly when it should
    // sharpen. Every other handoff row is downward, so this is the row that fails
    // if the direction guard is dropped.
    const mild = { id: 'mild', endsAt: NOW + 29 * MIN, totalDuration: 6 * HOUR }; // barely in window
    let state = advanceWarp(createWarpState(), { liveGames: [mild], now: NOW, dtMs: 16 });
    state = advanceWarp(state, { liveGames: [mild], now: NOW + WARP_TUNING.TIER_EASE_MS });
    expect(state.tier).toBe(WARP_TIER.ENDGAME);
    expect(state.governingKey).toBe('mild');

    // A far more urgent game appears — furthest into its own window, so per
    // Amendment B it governs and the target jumps UP.
    const hot = { id: 'hot', endsAt: NOW + 2 * MIN, totalDuration: 6 * HOUR };
    const after = advanceWarp(state, {
      liveGames: [mild, hot], now: NOW + WARP_TUNING.TIER_EASE_MS + 16, dtMs: 16,
    });
    expect(after.tier).toBe(WARP_TIER.ENDGAME);
    expect(after.governingKey).toBe('hot');
    expect(after.target).toBeGreaterThan(state.speed);   // genuinely upward
    expect(after.easeMs, 'a hotter fight must sharpen fast, not wind down slowly')
      .toBe(WARP_TUNING.TIER_EASE_MS);
  });

  it('takes the full decay duration to arrive after a peak resolves', () => {
    const peak = { id: 'peak', endsAt: NOW + 30 * 1000, totalDuration: 6 * HOUR };
    const calm = { id: 'calm', endsAt: NOW + 5 * HOUR, totalDuration: 6 * HOUR };
    let state = advanceWarp(createWarpState(), { liveGames: [peak, calm], now: NOW, dtMs: 16 });
    state = advanceWarp(state, { liveGames: [peak, calm], now: NOW + WARP_TUNING.TIER_EASE_MS });

    const handoffAt = NOW + 31 * 1000;
    const after = advanceWarp(state, { liveGames: [calm], now: handoffAt, dtMs: 16 });

    // Still coming down when the shorter tier ease would already be finished...
    const midway = advanceWarp(after, {
      liveGames: [calm], now: handoffAt + WARP_TUNING.TIER_EASE_MS,
    });
    expect(midway.speed).toBeGreaterThan(WARP_TUNING.SPEED_LIVE);

    // ...and settled after the full decay.
    const settled = advanceWarp(after, {
      liveGames: [calm], now: handoffAt + WARP_TUNING.DECAY_MS,
    });
    expect(settled.speed).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);
  });
});

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

    // Arrived after the full decay. Measured from `first`'s own clock (+16),
    // because the ease now advances on wall time rather than a supplied delta.
    const settled = advanceWarp(first, {
      liveGames: [], now: resolvedAt + 16 + WARP_TUNING.DECAY_MS,
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
    // Per ruling R-T2-S10 this descent takes the ~30s DECAY duration, not the
    // 15s tier ease: coming down off a peak must read as "that fight ended".
    const handoffAt = NOW + 10 * MIN + 1000;
    const halfway = advanceWarp(afterHandoff, {
      liveGames: [later], now: handoffAt + WARP_TUNING.TIER_EASE_MS,
    });
    expect(halfway.speed).toBeGreaterThan(WARP_TUNING.SPEED_LIVE);

    const eased = advanceWarp(afterHandoff, {
      liveGames: [later], now: handoffAt + WARP_TUNING.DECAY_MS,
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
    // Both games sit at BATTLE LIVE, so the handoff does NOT move the target and
    // the in-flight ease is deliberately preserved rather than restarted. (A
    // re-anchor on every key change is what used to freeze the speed when the
    // key churned; the ease is re-anchored only when the target actually moves —
    // see the ENDGAME handoff row above, which does step the target.)
    // "No step" = a single frame moves the speed only by its normal ease
    // increment, NOT bit-equality: the ease is still in flight and correctly
    // keeps advancing across the handoff.
    expect(Math.abs(withB.speed - state.speed)).toBeLessThan(0.01);
    expect(withB.speed).toBeGreaterThanOrEqual(state.speed); // still climbing
    expect(withB.target).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);
  });

  // --- rows added after the mutation-tested code review -------------------
  // Each of these was a SURVIVING MUTANT: the behaviour was (or became) wrong
  // and all 53 original rows still passed. They are written to fail under their
  // specific defect, not to restate the implementation.

  it('does not step at the LIVE -> ENDGAME boundary for a SINGLE game', () => {
    // The boundary R-RAMP cares most about, and the one case where the tier
    // flips while the governing key does NOT — so a key-only change check would
    // silently hard-step 0.5 -> 0.8 here.
    const duration = 6 * HOUR;                    // window = 30 min
    const endsAt = NOW + 31 * MIN;
    const games = [{ id: 'solo', endsAt, totalDuration: duration }];

    // Settle in BATTLE LIVE first.
    let state = advanceWarp(createWarpState(), { liveGames: games, now: NOW, dtMs: 16 });
    state = advanceWarp(state, { liveGames: games, now: NOW + WARP_TUNING.TIER_EASE_MS });
    expect(state.tier).toBe(WARP_TIER.LIVE);
    expect(state.speed).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);

    // Step across the window edge one frame at a time and catch any jump.
    let previous = state;
    let sawEndgame = false;
    for (let ms = WARP_TUNING.TIER_EASE_MS + 16; ms <= 90 * 1000; ms += 16) {
      const next = advanceWarp(previous, { liveGames: games, now: NOW + ms });
      expect(
        Math.abs(next.speed - previous.speed),
        `single-frame jump of ${Math.abs(next.speed - previous.speed)} at ${ms}ms`
      ).toBeLessThan(0.01);
      if (next.tier === WARP_TIER.ENDGAME) sawEndgame = true;
      previous = next;
    }
    expect(sawEndgame, 'the run must actually cross into ENDGAME').toBe(true);
    expect(previous.speed).toBeGreaterThan(WARP_TUNING.SPEED_LIVE);
  });

  it('keeps easing when the governing key churns but the target does not move', () => {
    // Two id-less games. A caller that reorders the array between frames used to
    // churn a positional key, re-anchor every frame, and freeze the speed.
    const a = { endsAt: NOW + 3 * HOUR, totalDuration: 6 * HOUR };
    const b = { endsAt: NOW + 2 * HOUR, totalDuration: 6 * HOUR };

    let state = createWarpState();
    for (let i = 1; i <= 400; i += 1) {
      const order = i % 2 === 0 ? [a, b] : [b, a];
      state = advanceWarp(state, { liveGames: order, now: NOW + i * 100 });
    }
    expect(state.tier).toBe(WARP_TIER.LIVE);
    expect(
      state.speed,
      'speed must reach the BATTLE LIVE target despite the reordering'
    ).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);
  });

  it('gives id-less games a CONTENT-derived key, stable under reordering', () => {
    const a = { endsAt: NOW + 3 * HOUR, totalDuration: 6 * HOUR };
    const b = { endsAt: NOW + 2 * HOUR, totalDuration: 6 * HOUR };
    const forward = resolveTier({ liveGames: [a, b], now: NOW }).governingKey;
    const reverse = resolveTier({ liveGames: [b, a], now: NOW }).governingKey;
    expect(forward).toBe(reverse);
    expect(forward).not.toMatch(/^idx:/); // positional keys are the defect
    // ...and two DIFFERENT id-less games still get different keys.
    expect(resolveTier({ liveGames: [a], now: NOW }).governingKey)
      .not.toBe(resolveTier({ liveGames: [b], now: NOW }).governingKey);
  });

  it('eases on WALL TIME, so a frame-rate drop cannot stretch the transition', () => {
    const games = [liveGame()];
    const settleAt = NOW + WARP_TUNING.TIER_EASE_MS;

    // 16ms frames, landing exactly on the ease duration.
    let fast = advanceWarp(createWarpState(), { liveGames: games, now: NOW, dtMs: 16 });
    for (let ms = 16; ms < WARP_TUNING.TIER_EASE_MS; ms += 16) {
      fast = advanceWarp(fast, { liveGames: games, now: NOW + ms });
    }
    fast = advanceWarp(fast, { liveGames: games, now: settleAt });

    // 500ms frames — same wall time, ~31x fewer calls.
    let slow = advanceWarp(createWarpState(), { liveGames: games, now: NOW, dtMs: 16 });
    for (let ms = 500; ms < WARP_TUNING.TIER_EASE_MS; ms += 500) {
      slow = advanceWarp(slow, { liveGames: games, now: NOW + ms });
    }
    slow = advanceWarp(slow, { liveGames: games, now: settleAt });

    expect(fast.speed).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);
    expect(
      slow.speed,
      'a slow frame rate must not stretch the ease past its wall-clock duration'
    ).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);
    expect(settleAt).toBe(NOW + WARP_TUNING.TIER_EASE_MS);
  });

  it('advances the ease even when the caller omits dtMs entirely', () => {
    // advanceWarp(state, {liveGames, now}) is the natural call shape; it used to
    // accumulate nothing and pin the speed at its anchor forever.
    const games = [liveGame()];
    let state = advanceWarp(createWarpState(), { liveGames: games, now: NOW });
    for (let i = 1; i <= 200; i += 1) {
      state = advanceWarp(state, { liveGames: games, now: NOW + i * 100 });
    }
    expect(state.speed).toBeCloseTo(WARP_TUNING.SPEED_LIVE, 6);
  });

  it('R-PREC prefers the clocked game in BOTH array orders', () => {
    const clocked = { id: 'clocked', endsAt: NOW + 5 * MIN, totalDuration: 6 * HOUR };
    const clockless = { id: 'clockless', endsAt: null, totalDuration: 6 * HOUR };
    for (const order of [[clockless, clocked], [clocked, clockless]]) {
      const resolved = resolveTier({ liveGames: order, now: NOW });
      expect(resolved.governingKey).toBe('clocked');
      expect(resolved.tier).toBe(WARP_TIER.ENDGAME);
    }
  });

  it('keeps the EASED speed inside [resting, peak] under adversarial churn', () => {
    // The bound that actually ships, as opposed to a hand-built resolved object.
    const pool = [
      { id: 'x', endsAt: NOW + 2 * MIN, totalDuration: 6 * HOUR },
      { id: 'y', endsAt: NOW + 45 * MIN, totalDuration: 6 * HOUR },
      { id: 'z', endsAt: NOW + 6 * HOUR, totalDuration: 12 * HOUR },
    ];
    let state = createWarpState();
    let min = Infinity;
    let max = -Infinity;
    for (let i = 1; i <= 3000; i += 1) {
      const games = pool.slice(0, (i % 4)); // 0..3 games, churning
      state = advanceWarp(state, { liveGames: games, now: NOW + i * 250 });
      min = Math.min(min, state.speed);
      max = Math.max(max, state.speed);
    }
    expect(min).toBeGreaterThanOrEqual(WARP_TUNING.SPEED_RESTING - 1e-9);
    expect(max).toBeLessThanOrEqual(WARP_TUNING.SPEED_ENDGAME_PEAK + 1e-9);
    expect(Number.isFinite(state.speed)).toBe(true);
  });

  it('never yields NaN from a malformed resolved object', () => {
    // NaN would propagate into the star-depth integration and blank the field
    // permanently, with no throw and no failing test anywhere.
    expect(targetSpeed({ tier: WARP_TIER.ENDGAME })).not.toBeNaN();
    expect(targetSpeed({ tier: WARP_TIER.ENDGAME, rampProgress: undefined })).not.toBeNaN();
    expect(targetSpeed({ tier: WARP_TIER.ENDGAME, rampProgress: 'x' })).not.toBeNaN();
    expect(targetSpeed({ tier: WARP_TIER.ENDGAME })).toBe(WARP_TUNING.SPEED_ENDGAME_FLOOR);
  });

  it('treats a numeric-STRING duration as provable, not unknown', () => {
    // A duration arriving as a string would otherwise look identical to a
    // genuinely unknown clock and silently cost that game its endgame.
    expect(endgameWindowMs('21600000')).toBe(30 * MIN);
    expect(resolveTier({
      liveGames: [{ id: 's', endsAt: NOW + 5 * MIN, totalDuration: '21600000' }],
      now: NOW,
    }).tier).toBe(WARP_TIER.ENDGAME);
  });

  it('does not let easeElapsedMs grow without bound once settled', () => {
    const games = [liveGame()];
    let state = advanceWarp(createWarpState(), { liveGames: games, now: NOW, dtMs: 16 });
    for (let i = 1; i <= 5000; i += 1) {
      state = advanceWarp(state, { liveGames: games, now: NOW + i * 1000 });
    }
    expect(state.easeElapsedMs).toBeLessThanOrEqual(state.easeMs);
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

  it('rejects a non-finite {seconds} — the guard must match every other branch', () => {
    // A {seconds: NaN} is an unprovable clock, not epoch NaN. Without the guard
    // it leaked NaN into the state machine; the contract is "null for unusable".
    expect(toEpochMs({ seconds: NaN })).toBeNull();
    expect(toEpochMs({ seconds: Infinity })).toBeNull();
    expect(toEpochMs({ toMillis: () => NaN })).toBeNull();
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
