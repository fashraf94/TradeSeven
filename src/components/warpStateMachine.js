// src/components/warpStateMachine.js
//
// Battle-Weather Starfield — the render-free pure core.
// Delight Layer arc, Task 2 (Phases 1-3). Spec V2 §4 D2 + State Map Amendment B,
// rulings R-T2-S2/S3/S7/S8/S9/S10/S14.
// Basis: docs/audits/20260730_DELIGHT_STARFIELD_BACKGROUND_PHASE0_DISCOVERY.md
//
// Co-located with StarfieldBackground.jsx per the house render-free-core pattern
// (src/components/League/battleArena/arenaEngineCore.js:8 — "Kept render-free so
// it is unit-testable WITHOUT a jsdom/React setup"; same shape as
// src/components/AgentPresence/faceEngineCore.js beside faceEngine.jsx).
//
// ---------------------------------------------------------------------------
// THIS MODULE NEVER READS A CLOCK
// ---------------------------------------------------------------------------
// Every function takes `now` (epoch ms) from its caller — the same discipline as
// src/constants/leagueTournament.js:1169 ("this module never reads a clock").
// That is what makes the whole state machine unit-testable with plain numbers,
// and it is why ruling R-T2-S8 could retire the jsdom+rAF-spy rig: the
// scheduling DECISIONS live here (resolveLoopPlan) and are asserted as pure
// rows, while the loop that obeys them is lifecycle inherited verbatim from a
// shipping component (BaggerBombBackground.jsx).
//
// ---------------------------------------------------------------------------
// STATE MAP V2 (the contract this implements)
// ---------------------------------------------------------------------------
//   RESTING      no live games                      speed 0.08
//   BATTLE LIVE  the GOVERNING game is not in its window   speed 0.7
//   ENDGAME      governing game inside its window    speed 0.8 -> 2.2, continuous
//
//   R-PREC   (as amended by State Map Amendment B / R-T2-S9): the game FURTHEST
//            into its endgame window governs; if none is in a window, the
//            soonest-ending game governs. See selectGoverningGame.
//   R-WINDOW endgame window = min(30 min, 25% of that game's total duration).
//   R-RAMP   transitions ease over seconds, never step.
//   R-REST   resting is near-imperceptible drift.
//   R-PARAM  speed is the ONLY state-driven parameter; density is fixed.
//   R-INPUT  battle state is the SOLE authority for tier.
//
// ---------------------------------------------------------------------------
// STATE MAP AMENDMENT C (Task 4, ruling R-T4-ARCH — Aug 1, 2026)
// ---------------------------------------------------------------------------
// R-INPUT is amended to admit a SECOND input class: **user deploy intent**.
// It is transient, upward-only, and non-authoritative.
//
//   - TRANSIENT      it lives in a ref for the length of a hold plus its
//                    release, and leaves no trace in the tier machine.
//   - UPWARD-ONLY    speed = max(stateSpeed, intent). Intent can never slow the
//                    sky below what battle state warrants.
//   - NON-AUTHORITATIVE  it decorates the machine's OUTPUT at the consumption
//                    read. It never changes tier, and battle state remains the
//                    sole authority for tier.
//
// The full contract, the surge/exhale shapes, and — most importantly — WHY the
// max() must not be written back into state.speed live in "THE DEPLOY-INTENT
// OVERLAY" at the foot of this file. Read that block before changing any of it.
//
// ---------------------------------------------------------------------------
// UNPROVABLE CLOCKS DO NOT GET AN ENDGAME
// ---------------------------------------------------------------------------
// A game with no usable `endsAt`, or no usable `totalDuration`, counts toward
// LIVE membership but can never reach ENDGAME: its window resolves to 0. This is
// ruling R-T2-S3's stated principle applied in code — "a format that cannot
// prove its clock does not get an endgame (C-20 spirit)" — and it is what keeps
// the League 5-day arc (server-only end date) honestly capped at BATTLE LIVE
// instead of guessing a ramp.

/** The three tiers of State Map V2 §1. */
export const WARP_TIER = {
  RESTING: 'resting',
  LIVE: 'live',
  ENDGAME: 'endgame',
};

/**
 * TUNING-EXEMPT PARAMETERS (spec V2 §4 D2).
 *
 * Every value here is founder-judged by feel on the Vercel preview and may be
 * changed WITHOUT a spec re-version or a new ruling. Values below are the State
 * Map's starting points, not acceptance criteria.
 */
export const WARP_TUNING = {
  // --- speeds (x demo baseline) -------------------------------------------
  /**
   * RESTING / BATTLE LIVE widened at the founder's feel pass (round 1, T3;
   * Aug 1, 2026) from 0.12 / 0.5. BATTLE LIVE registered, but read only
   * slightly different from RESTING: perceived motion compresses at low
   * speeds, so a 4.2x ratio did not read as 4.2x. The gap is now 8.75x, and
   * the lower resting drift honours R-REST ("near-imperceptible") more
   * faithfully than 0.12 did. Tuning-exempt, per spec V2 §4 D2.
   */
  SPEED_RESTING: 0.08,
  SPEED_LIVE: 0.7,
  SPEED_ENDGAME_FLOOR: 0.8,
  SPEED_ENDGAME_PEAK: 2.2,

  // --- endgame window (R-WINDOW) ------------------------------------------
  ENDGAME_WINDOW_MAX_MS: 30 * 60 * 1000,
  ENDGAME_WINDOW_FRACTION: 0.25,

  // --- transitions (R-RAMP) -----------------------------------------------
  /** Ease between tiers. State Map says 10-20s; 15s sits mid-range. */
  TIER_EASE_MS: 15_000,
  /** "the sky calms down after the fight" — decay to RESTING on last resolve. */
  DECAY_MS: 30_000,

  // --- field density (R-PARAM: fixed, never state-driven) ------------------
  PARTICLES_DESKTOP: 220,
  PARTICLES_MOBILE: 120,
  PARTICLES_MOBILE_LITE: 70,

  // --- projection / motion feel -------------------------------------------
  /** Depth consumed per second at speed 1.0. Resting (0.08) ~= 136s per star. */
  Z_RATE: 0.09,
  /**
   * Field-of-view scalar for the radial projection.
   *
   * Tuned DOWN from an initial 0.5 after a browser smoke: at 0.5 most stars
   * crossed the viewport edge and were recycled while still too far away to be
   * bright, so a 220-star field rendered as ~20 visible specks. Lower widens the
   * on-screen portion of each star's run, which is what makes the density read.
   */
  PROJECTION: 0.28,
  /** Vanishing point, fraction of viewport. Slightly ABOVE centre (spec D1). */
  VANISHING_X: 0.5,
  VANISHING_Y: 0.42,
  /** Depth at which a star is recycled. */
  Z_NEAR: 0.02,
  /** Per-frame trail fade (translucent frame-clear). Higher = shorter streaks. */
  TRAIL_FADE: 0.28,
  /** Depth below which stars blend toward white (near-star white-blend). */
  WHITE_BLEND_Z: 0.28,
  /** Peak opacity of a star at its closest. */
  STAR_MAX_ALPHA: 0.9,
  /**
   * How fast a star gains opacity as it approaches. alpha = nearness x GAIN.
   * A squared curve was tried first and kept the field invisible until the last
   * moments of each star's run; a linear gain lights the mid-field, which is
   * where the sense of depth actually lives.
   */
  ALPHA_GAIN: 1.5,
  /** Opacity of the single static frame drawn under prefers-reduced-motion. */
  STATIC_FRAME_ALPHA: 0.35,

  // --- deploy intent (Task 4, spec V1 D2/D3 — see the overlay block below) --
  /**
   * Peak of the hold-intent curve. DELIBERATELY below SPEED_ENDGAME_PEAK (2.2)
   * so a hold can never outrank a real endgame's drama (D2). It sits above
   * SPEED_LIVE (0.7), so a completed hold reads as faster than a live battle.
   * Both bounds are pinned by a test row.
   *
   * Raised from 1.4 at the founder's feel pass (round 1, T2): the top of the
   * ramp needed more authority.
   */
  INTENT_PEAK: 1.8,
  /**
   * Shape of that curve: `peak * progress^n`. n > 1 keeps the curve convex, so
   * the back half still steepens — but the SIZE of n decides how long the
   * start feels dead, and that is the whole feel of the gesture.
   *
   * Lowered 2.5 -> 1.2 at the founder's feel pass (round 1, T1): "the ramp must
   * begin responding the instant the press starts." At 2.5 the first half of
   * the hold was effectively dead — only 18% of peak by the halfway point, and
   * a RESTING sky was not visibly lifted until ~37% in (~490ms of the shipped
   * 1300ms hold). At 1.2 the sky lifts off RESTING at ~7.5% (~100ms), while
   * the curve still sits below the linear line at every interior point, so the
   * late steepening the threshold feeling depends on survives.
   *
   * NOTE the tier interaction: because intent is max(coreSpeed, curve), the
   * higher the sky's current tier the later a hold becomes visible. From
   * RESTING (0.08) that is ~100ms; during a BATTLE LIVE sky (0.7) the hold does
   * not clear the floor until ~45% of the press (~590ms). See the round-1
   * tuning record for the measured table.
   */
  INTENT_CURVE_EXPONENT: 1.2,
  /**
   * The abort exhale (D3). Its own duration, deliberately NOT a tier ease: an
   * abort must be felt promptly, so this is far shorter than TIER_EASE_MS (15s)
   * or DECAY_MS (30s). Spec says ~1-2s.
   */
  INTENT_EXHALE_MS: 1200,

  // --- the commit surge (Task 4 Phase 2, spec V1 D4 / ruling R-T4-S3) -------
  /**
   * Ceiling of the commit punch. Set to SPEED_ENDGAME_PEAK deliberately: the
   * commit is the ONE moment intent is allowed to reach the sky's maximum
   * intensity, and it still never EXCEEDS what a real endgame reaches — so D2's
   * principle ("a hold never outranks a real endgame's drama") survives the
   * surge intact. Pinned by a test row.
   */
  INTENT_SURGE_PEAK: 2.2,
  /**
   * Total length of the surge. Mirrors LOCK_BEAT_MS in
   * src/hooks/useHoldToDeploy.js (450ms) on purpose — ruling R-T4-S3 option
   * (ii) places the punch inside the lock beat, the last window in which the
   * sky is still visible before the ceremony scrim mounts. The two constants
   * live in different modules (the pure core must not import the hook), so
   * each names the other: changing one without the other pushes part of the
   * surge behind the curtain.
   */
  INTENT_SURGE_MS: 450,
  /** The attack. Fast rise = the punch; the rest of the window is the release. */
  INTENT_SURGE_RISE_MS: 140,
};

/** Fallback tint if --ft-warp-tint is unreadable (matches its resolved value). */
export const WARP_TINT_FALLBACK = '#00d9ff';

/**
 * Synthetic duration behind the ?warpState= dev override (R-T2-S4). 4h gives a
 * 25% slice of 1h, which the 30-min cap then bounds — so the override exercises
 * the SAME R-WINDOW code path a real fullday battle does.
 */
export const WARP_OVERRIDE_TOTAL_DURATION_MS = 4 * 60 * 60 * 1000;

/** Default endgame clock when ?warpClock= is absent or unusable. */
export const WARP_OVERRIDE_DEFAULT_CLOCK_S = 90;

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Coerce a timestamp to epoch ms. Accepts the shapes the battle docs actually
 * carry — ISO string (`expiresAt`), epoch number, Date — plus Firestore-ish
 * `{seconds}`. Returns null for anything unusable, which callers treat as "this
 * clock cannot be proven" rather than as zero.
 */
export function toEpochMs(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      const ms = value.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value.seconds === 'number') {
      // Same finiteness guard as every branch above — a {seconds: NaN} must
      // resolve to null ("unprovable clock"), not leak NaN into the state
      // machine. Unreachable via the adapter today (it converts before calling),
      // but this function's contract is "null for anything unusable".
      const ms = value.seconds * 1000;
      return Number.isFinite(ms) ? ms : null;
    }
  }
  return null;
}

/**
 * R-WINDOW — endgame window for a game = min(30 min, 25% x total duration).
 *
 * An unusable duration returns 0: no window, therefore no endgame, ever. See the
 * module header ("unprovable clocks do not get an endgame").
 */
export function endgameWindowMs(totalDuration, tuning = WARP_TUNING) {
  // Number() rather than a typeof check: a duration that arrives as a numeric
  // STRING is a proven value, not an unprovable clock, and treating it as
  // unknown would silently cost that game its endgame with no signal.
  const duration = Number(totalDuration);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(tuning.ENDGAME_WINDOW_MAX_MS, duration * tuning.ENDGAME_WINDOW_FRACTION);
}

/**
 * Normalize the caller's games into clock-comparable records, dropping any that
 * have already ended. A game with an unusable `endsAt` is KEPT (it is still a
 * live game the user has a stake in) but carries endsAt=null, so it can hold the
 * field at BATTLE LIVE without ever claiming the endgame ramp.
 */
export function normalizeLiveGames(liveGames, now) {
  if (!Array.isArray(liveGames)) return [];

  const out = [];
  for (let i = 0; i < liveGames.length; i += 1) {
    const game = liveGames[i];
    if (!game) continue;

    const endsAt = toEpochMs(game.endsAt);
    if (endsAt != null && endsAt <= now) continue; // resolved — no longer live

    // Coerced, not typeof-gated: this must agree with endgameWindowMs, which
    // also accepts a numeric string. Gating on `typeof === 'number'` here would
    // strip a provable duration BEFORE the window is computed, silently costing
    // that game its endgame — the two checks have to use the same rule.
    const coercedDuration = Number(game.totalDuration);
    const totalDuration = Number.isFinite(coercedDuration) && coercedDuration > 0
      ? coercedDuration
      : null;

    out.push({
      // CONTENT-derived, never positional. An `idx:${i}:…` fallback made the key
      // depend on ARRAY ORDER, so for id-less games a caller that reordered the
      // array between frames churned the key, re-anchored the ease every frame
      // and pinned the speed forever (t is 0 on an anchor frame by design). Two
      // id-less games with identical content collide here, which is correct:
      // they are indistinguishable, so they resolve the same target and a
      // handoff between them is a no-op.
      key: game.id != null
        ? String(game.id)
        : `anon:${endsAt ?? 'no-clock'}:${totalDuration ?? 'no-duration'}`,
      endsAt,
      totalDuration,
    });
  }
  return out;
}

/**
 * Where a game sits inside its OWN endgame window, or null if it is not in one.
 *
 * The unit of URGENCY under State Map Amendment B: `progress` is the fraction of
 * that game's window already elapsed, so it is comparable across games with
 * wildly different durations.
 */
export function endgameProgress(game, now, tuning = WARP_TUNING) {
  if (!game || game.endsAt == null) return null;
  const windowMs = endgameWindowMs(game.totalDuration, tuning);
  if (windowMs <= 0) return null;                 // unprovable clock — no endgame
  const remainingMs = game.endsAt - now;
  if (remainingMs > windowMs) return null;        // not in its window yet
  return { windowMs, remainingMs, progress: clamp01(1 - remainingMs / windowMs) };
}

/**
 * R-PREC, as amended by State Map Amendment B (ruling R-T2-S9).
 *
 * The governing game is the one FURTHEST INTO its endgame window, measured by
 * fraction of window elapsed. Only if no game is inside its window does the
 * soonest-ending game govern.
 *
 * WHY URGENCY RATHER THAN RAW END TIME: the original rule let a short battle
 * that happens to end slightly sooner take the field while a longer battle was
 * deep in its own final quarter — so the sky could sit calm through somebody's
 * actual peak. Worked case that drove the amendment: A ends in 20 min of a
 * 40-min run (window 10 min, so NOT in its window) while B ends in 25 min of a
 * 100-min run (window 25 min, so exactly AT its window edge). Raw end time hands
 * the field to A and shows BATTLE LIVE; urgency hands it to B and starts the
 * ramp. One clock still governs at all times, so the ramp stays coherent.
 *
 * Ties break on key so precedence is deterministic and a re-render can never
 * thrash the governing choice (feel criterion 4).
 */
export function selectGoverningGame(normalized, now, tuning = WARP_TUNING) {
  if (!normalized || normalized.length === 0) return null;

  // PASS 1 — anybody inside their own window? Most-progressed wins.
  let urgent = null;
  let urgentProgress = -Infinity;
  for (const game of normalized) {
    const eg = endgameProgress(game, now, tuning);
    if (eg === null) continue;
    if (eg.progress > urgentProgress
      || (eg.progress === urgentProgress && urgent !== null && game.key < urgent.key)) {
      urgent = game;
      urgentProgress = eg.progress;
    }
  }
  if (urgent !== null) return urgent;

  // PASS 2 — nobody is in a window, so the soonest-ending live game governs.
  // Games with a provable end sort ahead of clockless ones: an unknown end
  // cannot claim to be "soonest".
  let best = null;
  for (const game of normalized) {
    if (best === null) { best = game; continue; }

    if (game.endsAt == null && best.endsAt == null) {
      if (game.key < best.key) best = game;
      continue;
    }
    if (game.endsAt == null) continue;      // clocked incumbent wins
    if (best.endsAt == null) { best = game; continue; } // clocked challenger wins

    if (game.endsAt < best.endsAt) best = game;
    else if (game.endsAt === best.endsAt && game.key < best.key) best = game;
  }
  return best;
}

/**
 * Resolve the tier for this instant. Pure: same inputs, same answer.
 *
 * @returns {{tier: string, governingKey: string|null, remainingMs: number|null,
 *            windowMs: number, rampProgress: number, liveCount: number}}
 */
export function resolveTier({ liveGames, now }, tuning = WARP_TUNING) {
  const normalized = normalizeLiveGames(liveGames, now);

  if (normalized.length === 0) {
    return {
      tier: WARP_TIER.RESTING,
      governingKey: null,
      remainingMs: null,
      windowMs: 0,
      rampProgress: 0,
      liveCount: 0,
    };
  }

  const governing = selectGoverningGame(normalized, now, tuning);
  const eg = endgameProgress(governing, now, tuning);

  // Amendment B corrects the state table's clause to "BATTLE LIVE = the
  // GOVERNING game is not in its endgame window". Because pass 1 of
  // selectGoverningGame already prefers any in-window game, this single check
  // now IS that clause — if anybody were in a window, they would be governing.
  if (eg !== null) {
    return {
      tier: WARP_TIER.ENDGAME,
      governingKey: governing.key,
      remainingMs: eg.remainingMs,
      windowMs: eg.windowMs,
      rampProgress: eg.progress,
      liveCount: normalized.length,
    };
  }

  return {
    tier: WARP_TIER.LIVE,
    governingKey: governing.key,
    remainingMs: governing.endsAt == null ? null : governing.endsAt - now,
    windowMs: endgameWindowMs(governing.totalDuration, tuning),
    rampProgress: 0,
    liveCount: normalized.length,
  };
}

/**
 * The speed this tier is aiming at, before easing. Monotone in the clock inside
 * ENDGAME: as remaining time falls, rampProgress rises, so speed rises — peak at
 * the final moment. No steps inside the ramp (R-RAMP).
 */
export function targetSpeed(resolved, tuning = WARP_TUNING) {
  if (!resolved) return tuning.SPEED_RESTING;
  if (resolved.tier === WARP_TIER.RESTING) return tuning.SPEED_RESTING;
  if (resolved.tier === WARP_TIER.LIVE) return tuning.SPEED_LIVE;
  const span = tuning.SPEED_ENDGAME_PEAK - tuning.SPEED_ENDGAME_FLOOR;
  // `|| 0` because a malformed resolved object would otherwise yield NaN, and a
  // NaN speed propagates into the star-depth integration and pins every star at
  // z = NaN — a permanently blank field with no error anywhere.
  return tuning.SPEED_ENDGAME_FLOOR + span * clamp01(Number(resolved.rampProgress) || 0);
}

/** Initial machine state: at rest, settled (no in-flight ease). */
export function createWarpState(tuning = WARP_TUNING) {
  return {
    tier: WARP_TIER.RESTING,
    speed: tuning.SPEED_RESTING,
    governingKey: null,
    anchorSpeed: tuning.SPEED_RESTING,
    easeElapsedMs: tuning.TIER_EASE_MS, // already settled
    easeMs: tuning.TIER_EASE_MS,
    rampProgress: 0,
    remainingMs: null,
    /** Wall clock of the last advance, so easing measures real elapsed time. */
    lastNow: null,
    /** The target at the last advance, to detect a MEANINGFUL change. */
    target: tuning.SPEED_RESTING,
  };
}

/**
 * How long this transition should take (ruling R-T2-S10).
 *
 * Coming DOWN off an endgame peak is not a tier change like any other — it is a
 * fight ending. At the 15s tier ease a drop from 2.2 reads as a glitch, so it
 * gets the same ~30s resolution decay the last-game-resolves case uses.
 *
 * SCOPE, RATIFIED (ruling R-T2-S14): the decay ease applies to ANY downward
 * transition out of ENDGAME, not only the ENDGAME→ENDGAME handoff R-T2-S10
 * names. That covers ENDGAME→BATTLE LIVE too, where the drop is actually LARGER
 * (2.2 → 0.5 rather than 2.2 → 0.8) and would otherwise snap at the faster ease.
 * Upward transitions keep the fast tier ease so entering a fight stays
 * responsive — pinned by its own test row. Still tuning-exempt.
 */
function resolveEaseMs(prev, resolved, target, tuning) {
  if (resolved.tier === WARP_TIER.RESTING) return tuning.DECAY_MS;
  if (prev.tier === WARP_TIER.ENDGAME && target < prev.speed) return tuning.DECAY_MS;
  return tuning.TIER_EASE_MS;
}

/**
 * Advance one frame. Returns the NEXT state; never mutates the input.
 *
 * Easing model — one rule covers tier change, endgame ramp, handoff and decay:
 * an ease ANCHOR is dropped whenever the tier changes OR the governing game
 * changes (R-PREC handoff). Speed is then `lerp(anchorSpeed, target, t)` with
 * t = elapsed/easeMs. While t < 1 the sky glides; once t reaches 1 speed tracks
 * the target exactly, so the continuous endgame ramp stays continuous.
 *
 * Because t is 0 on the very frame the anchor drops, speed equals the previous
 * speed at that instant — a transition can never step (R-RAMP). The ease
 * DURATION per transition is chosen by resolveEaseMs (R-T2-S10/S14).
 */
export function advanceWarp(state, { liveGames, now, dtMs }, tuning = WARP_TUNING) {
  const prev = state || createWarpState(tuning);
  const resolved = resolveTier({ liveGames, now }, tuning);
  const target = targetSpeed(resolved, tuning);

  // Elapsed comes from the WALL CLOCK the caller already passes, not from a
  // caller-supplied delta. Two reasons, both measured:
  //   1. `dtMs` used to default to 0, so the natural call
  //      advanceWarp(s, {liveGames, now}) accumulated nothing and pinned the
  //      speed at its anchor forever.
  //   2. Easing on a render delta made the "10-20s" tier ease frame-rate
  //      dependent — at 200ms frames it stretched to 30s of wall time.
  // `dtMs` remains an accepted fallback for the first call / clockless callers.
  // No upper clamp: if the tab was hidden for an hour the ease genuinely
  // finished, and arriving settled is right (nobody watched it happen).
  const measured = prev.lastNow != null && Number.isFinite(now) ? now - prev.lastNow : null;
  const elapsedMs = measured != null
    ? Math.max(0, measured)
    : (Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0);

  // Re-anchor on a tier or precedence change — but ONLY when it actually moves
  // the target. Without this guard any churn in the governing key (a reordered
  // array, an id-less game) re-anchored every frame, and since t is 0 on an
  // anchor frame the speed could never advance at all.
  const structuralChange = prev.tier !== resolved.tier
    || prev.governingKey !== resolved.governingKey;
  const targetMoved = Math.abs(target - (Number.isFinite(prev.target) ? prev.target : target)) > 1e-9;
  const changed = structuralChange && targetMoved;

  let anchorSpeed;
  let easeElapsedMs;
  let easeMs;

  if (changed) {
    anchorSpeed = prev.speed;
    easeElapsedMs = 0;
    easeMs = resolveEaseMs(prev, resolved, target, tuning);
  } else {
    anchorSpeed = prev.anchorSpeed;
    // Capped at easeMs: past that the ease is settled, and letting it grow
    // unbounded is just a number climbing forever in a long-lived session.
    easeMs = prev.easeMs;
    easeElapsedMs = Math.min(prev.easeElapsedMs + elapsedMs, Math.max(easeMs, 0));
  }

  const t = easeMs > 0 ? clamp01(easeElapsedMs / easeMs) : 1;
  const speed = anchorSpeed + (target - anchorSpeed) * t;

  return {
    tier: resolved.tier,
    speed,
    governingKey: resolved.governingKey,
    anchorSpeed,
    easeElapsedMs,
    easeMs,
    rampProgress: resolved.rampProgress,
    remainingMs: resolved.remainingMs,
    lastNow: Number.isFinite(now) ? now : prev.lastNow,
    target,
  };
}

/**
 * A2s / R-T2-S8 — the scheduling DECISION, as a pure function.
 *
 * The component obeys this; it does not re-derive it. Keeping the decision here
 * is what lets "reduced motion never schedules a loop" and "hidden pauses" be
 * asserted as plain unit rows instead of a jsdom rAF-spy rig.
 *
 * Precedence is deliberate: flag-off beats everything (a dark feature does no
 * work at all), then reduced motion (one dim static frame, no loop — the
 * accessibility contract), then tab-hidden (paused, nothing drawn).
 */
export function resolveLoopPlan({ flagOn = false, reducedMotion = false, hidden = false } = {}) {
  if (!flagOn) return { shouldSchedule: false, shouldDrawOnce: false, reason: 'flag-off' };
  if (reducedMotion) return { shouldSchedule: false, shouldDrawOnce: true, reason: 'reduced-motion' };
  if (hidden) return { shouldSchedule: false, shouldDrawOnce: false, reason: 'hidden' };
  return { shouldSchedule: true, shouldDrawOnce: false, reason: 'animate' };
}

/**
 * Per-device budget (Amendment A3). Mobile is its own tier, NOT desktop shrunk:
 * fewer particles AND a lower DPR cap, because fill-rate is the phone cost.
 *
 * `mobile-lite` is the degraded tier for weak devices. It is DEFINED but NOT
 * WIRED: Phase 0 found ZERO house precedent for capability detection
 * (no deviceMemory / hardwareConcurrency / getBattery / connection.effectiveType
 * anywhere in src/), and Amendment A3 says report rather than invent. Selecting
 * it needs a founder ruling on the detection signal; until then nothing returns
 * it automatically.
 */
export const WARP_DEVICE_PROFILES = {
  desktop: { particleCount: WARP_TUNING.PARTICLES_DESKTOP, maxDpr: 2 },
  mobile: { particleCount: WARP_TUNING.PARTICLES_MOBILE, maxDpr: 1.5 },
  'mobile-lite': { particleCount: WARP_TUNING.PARTICLES_MOBILE_LITE, maxDpr: 1 },
};

export function deviceProfile(mode) {
  return WARP_DEVICE_PROFILES[mode] || WARP_DEVICE_PROFILES.desktop;
}

/**
 * A5 — guarantee no `var()` string ever reaches a canvas op.
 *
 * readToken() already resolves the alias chain, but canvas has no CSS parser: a
 * `var(...)` string assigned to fillStyle is silently ignored and the previous
 * style persists — the exact silent-failure class BUILD_RULES §10 warns about.
 * So the value is sanitized here, in the pure core, where it can be asserted.
 */
export function resolveTint(raw, fallback = WARP_TINT_FALLBACK) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return fallback;
  if (value.includes('var(')) return fallback;
  return value;
}

/**
 * Turn the ?warpState= dev override into the SAME `liveGames` shape the Phase-2
 * live adapter will produce (R-T2-S4).
 *
 * One input shape means one code path: the override drives the real state
 * machine rather than a parallel display path that could drift from it (the §9
 * display-agreement rule applied to the dev instrument).
 *
 * Returns null when no override is present — distinct from [] ("override says
 * resting"), so the caller can tell "not overridden" from "overridden to empty".
 */
export function synthesizeOverrideGames(override, now, tuning = WARP_TUNING) {
  if (!override || typeof override.state !== 'string') return null;

  const state = override.state.toLowerCase();
  const totalDuration = WARP_OVERRIDE_TOTAL_DURATION_MS;

  if (state === WARP_TIER.RESTING) return [];

  if (state === WARP_TIER.LIVE) {
    // Ends a full duration out, so it is nowhere near its endgame window.
    return [{ id: 'warp-dev-live', endsAt: now + totalDuration, totalDuration }];
  }

  if (state === WARP_TIER.ENDGAME) {
    const requested = Number.isFinite(override.clockSeconds) && override.clockSeconds > 0
      ? override.clockSeconds
      : WARP_OVERRIDE_DEFAULT_CLOCK_S;
    // Clamp inside the window, else "endgame" would honestly resolve to LIVE.
    const windowMs = endgameWindowMs(totalDuration, tuning);
    const remainingMs = Math.min(requested * 1000, windowMs);
    return [{ id: 'warp-dev-endgame', endsAt: now + remainingMs, totalDuration }];
  }

  return null;
}

/**
 * Deterministic RNG for seeded init (R-T2-S7). xorshift32 — small, fast, and
 * good enough for star placement. Without a seed the caller gets Math.random,
 * which is what ships; the seed exists so a test can pin the field.
 */
export function makeRng(seed) {
  if (seed == null) return Math.random;
  let s = (typeof seed === 'number' ? seed : 1) >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

/**
 * Seed the field. Stars live in a unit direction (x, y) at depth z; the renderer
 * projects them radially from the vanishing point, so depth alone drives the
 * outward rush. `pz` carries the previous depth so a frame can draw the streak
 * between two projections rather than a bare dot.
 */
export function createStars(count, rng = Math.random) {
  const stars = new Array(Math.max(0, count | 0));
  for (let i = 0; i < stars.length; i += 1) {
    const z = 0.05 + rng() * 0.95;
    const { x, y } = sampleDisc(rng);
    stars[i] = { x, y, z, pz: z };
  }
  return stars;
}

/**
 * Sample a direction uniformly over the unit DISC rather than the unit square.
 *
 * Square sampling puts ~21% of stars in the corners, at radius up to 1.41, and
 * those exit the viewport almost immediately after spawning — budget spent on
 * stars nobody sees. sqrt() on the radius keeps the density even by area rather
 * than clustering everything at the centre.
 */
function sampleDisc(rng) {
  const radius = Math.sqrt(rng());
  const angle = rng() * Math.PI * 2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/**
 * Recycle a star that has flown past the viewer (or off-screen) back to full
 * depth with a fresh direction. Mutates in place — this runs per frame per star.
 */
export function respawnStar(star, rng = Math.random) {
  const { x, y } = sampleDisc(rng);
  star.x = x;
  star.y = y;
  star.z = 1;
  star.pz = 1;
  return star;
}

// ===========================================================================
// THE DEPLOY-INTENT OVERLAY
// Delight Layer arc, Task 4 (Phase 1). State Map Amendment C, ruling R-T4-ARCH.
// Basis: docs/audits/20260801_DELIGHT_DEPLOY_SKY_COUPLING_PHASE0_DISCOVERY.md
// ===========================================================================
//
// The signature deploy: while the user holds a deploy button the sky leans in,
// if they let go early it exhales back, and if they see it through it punches.
// "The room responds to your intent before you commit."
//
// ---------------------------------------------------------------------------
// THE THREE BEATS
// ---------------------------------------------------------------------------
//   RAMP    intentCurve(progress) rises with the finger, upward-only.
//   EXHALE  an early release decays back to battle state over ~1.2s (D3). The
//           abort is half the signature: commitment only has weight if backing
//           out feels like something.
//   SURGE   completing the hold punches to the sky's ceiling inside the ~450ms
//           lock beat (D4 / R-T4-S3), the last window before the ceremony scrim
//           mounts. Then the existing agent-thinking animation takes the stage
//           (untouched), and the sky settles at BATTLE LIVE — see the §2 settle
//           in App.jsx handleCreateAgentTrainingBattle.
//
// The surge is OPTIMISTIC by design: it fires at hold completion, before the
// deploy call resolves. A deploy that then FAILS never reaches BATTLE LIVE —
// no battle is injected, so the surge simply falls into the exhale and the sky
// returns to what battle state warrants. That is the abort beat doing double
// duty, and it is why the settle is gated on confirmed success rather than on
// the commit.
//
// ---------------------------------------------------------------------------
// THIS IS AN OUTPUT DECORATOR. IT NEVER FEEDS BACK INTO THE TIER MACHINE.
// ---------------------------------------------------------------------------
// Amendment C admits user deploy intent as a SECOND input class — transient,
// upward-only, non-authoritative. Battle state remains the sole authority for
// tier. Ruling R-T4-ARCH fixes exactly where that lands in code:
//
//   applyIntent() is called at the CONSUMPTION READ (StarfieldBackground.step,
//   where the loop reads warpRef.current.speed), NEVER inside advanceWarp's
//   returned state.speed and NEVER inside targetSpeed.
//
// That is not a style preference — the other two placements are BROKEN. Both
// `advanceWarp`'s ease anchor (`anchorSpeed = prev.speed`) and its transition
// choice (`resolveEaseMs` reads `prev.speed`/`prev.tier`) are computed from the
// PREVIOUS frame's speed. Writing an intent-inflated speed back into the state
// would make the sky, on the frame a hold ends, believe it is easing down from
// 1.4 — re-anchoring the 15s tier ease (or the 30s decay) against a speed no
// battle ever justified, and corrupting the `targetMoved` guard along with it.
// The tier machine must keep integrating as if no hold were happening; the
// hold only decorates what gets DRAWN.
//
// So: `state.speed` stays the honest battle-state speed. The overlay carries
// its own transient easing state, held in a ref by the component and advanced
// only by the events it receives plus the wall clock.
//
// ---------------------------------------------------------------------------
// UPWARD-ONLY, ALWAYS (spec §3)
// ---------------------------------------------------------------------------
// `speed = max(stateSpeed, intent)`. Intent can never slow the sky below what
// battle state warrants. A corollary the founder ratified (R-T4-S3b): during a
// real ENDGAME (up to 2.2) a hold adds nothing visible, because INTENT_PEAK is
// deliberately lower. The sky is already telling a more important truth, and
// the button's own fill still communicates hold progress.
//
// ---------------------------------------------------------------------------
// WHY THE EXHALE IS NEVER CANCELLED
// ---------------------------------------------------------------------------
// The live curve and the exhale are combined with max() rather than the exhale
// being cleared when a new hold starts. That is what makes a re-hold DURING an
// exhale continuous: the curve starts at 0 and would otherwise drop the sky
// from mid-exhale to nothing in a single frame — a visible snap, precisely the
// kind of step R-RAMP exists to forbid. Letting the exhale keep decaying
// underneath while the new curve climbs means the louder of the two always
// wins, so the sky only ever glides.

/**
 * The intent channel's event name — the ONE definition, imported by BOTH ends
 * (the dispatcher in src/hooks/useHoldToDeploy.js and the listener in
 * StarfieldBackground.jsx) so the two can never drift to different strings.
 *
 * Payload contract (acceptance row A3):
 *   detail: { progress: number }  0..1, dispatched per animation frame while a
 *                                 POINTER hold charges.
 *   detail: { progress: null }    terminal — the hold ended, by abort OR by
 *                                 commit. Starts the exhale.
 * Anything else is malformed and is IGNORED by reduceIntentEvent.
 *
 * `reason: 'abort' | 'commit'` rides along on the terminal event. Phase 1 does
 * not read it (both terminals exhale identically); it exists from the start so
 * Phase 2's commit surge does not have to change a shipped contract.
 */
export const DEPLOY_INTENT_EVENT = 'ft-deploy-intent';

/**
 * The hold curve (D2). Eased, gentle → steep, peaking below the endgame.
 *
 * Monotone non-decreasing in `progress`, which acceptance row A2 pins: a hold
 * that is further along must never ask the sky for LESS speed.
 *
 * Returns 0 for an unusable progress rather than NaN — a NaN speed propagates
 * into the star-depth integration and pins every star at z = NaN, a permanently
 * blank field with no error anywhere (the same hazard targetSpeed guards).
 */
export function intentCurve(progress, tuning = WARP_TUNING) {
  const p = Number(progress);
  if (!Number.isFinite(p)) return 0;
  return tuning.INTENT_PEAK * Math.pow(clamp01(p), tuning.INTENT_CURVE_EXPONENT);
}

/** Initial overlay state: no hold in flight, nothing exhaling, no surge. */
export function createIntentState() {
  return {
    /** Live hold progress 0..1, or null when no hold is charging. */
    progress: null,
    /** Intent speed at the instant the terminal event arrived. */
    exhaleFrom: 0,
    /** Wall clock the exhale began, or null when nothing is exhaling. */
    exhaleAt: null,
    /** Intent speed the commit surge launched from. */
    surgeFrom: 0,
    /** Wall clock the commit surge began, or null when none. */
    surgeAt: null,
  };
}

/** Is a commit surge still inside its window? */
export function isSurging(state, now, tuning = WARP_TUNING) {
  if (!state || state.surgeAt == null) return false;
  if (!Number.isFinite(now) || !Number.isFinite(state.surgeAt)) return false;
  const elapsed = now - state.surgeAt;
  // A clock that has stepped BACKWARDS (NTP correction) is not a surge that
  // has yet to start — the anchor is only ever stamped as `now` at the
  // terminal, so `elapsed < 0` can only mean the clock moved. Treat it as
  // stale, else a long-dead surge could swallow a real abort terminal.
  return elapsed >= 0 && elapsed < tuning.INTENT_SURGE_MS;
}

/**
 * The commit punch (spec V1 D4, ruling R-T4-S3 option ii).
 *
 * Shape: a fast attack from wherever the hold left the sky up to the ceiling,
 * then a release back down. It is deliberately NOT a decay to the resting
 * speed — the exhale runs underneath it simultaneously, and because the two are
 * combined with max(), the exhale simply takes over the moment the release
 * falls below it. That hand-off is what keeps the whole commit beat continuous:
 * punch, fall, then the long exhale, with no step anywhere (R-RAMP).
 */
function surgeSpeed(state, now, tuning = WARP_TUNING) {
  if (!state || state.surgeAt == null) return 0;
  // A single unusable read holds the punch rather than dropping it (the same
  // rule the exhale follows); `surgeAt` is always finite when set.
  if (!Number.isFinite(now)) return state.surgeFrom;
  const total = tuning.INTENT_SURGE_MS;
  if (!(total > 0)) return 0;

  const elapsed = now - state.surgeAt;
  // elapsed === 0 is the launch frame (hold the speed the punch starts from);
  // elapsed < 0 means the wall clock stepped backwards, which must not
  // resurrect a finished punch at full strength.
  if (elapsed < 0) return 0;
  if (elapsed === 0) return state.surgeFrom;
  if (elapsed >= total) return 0;

  // Never let the attack descend: a surge that started from an intent speed
  // ABOVE the configured ceiling holds that speed instead of dipping.
  const peak = Math.max(tuning.INTENT_SURGE_PEAK, state.surgeFrom);
  const rise = Math.min(Math.max(tuning.INTENT_SURGE_RISE_MS, 0), total);
  const fall = total - rise;

  if (elapsed < rise) {
    return state.surgeFrom + (peak - state.surgeFrom) * (elapsed / rise);
  }
  if (fall <= 0) return peak; // all attack, no release — degenerate but defined
  return peak * (1 - (elapsed - rise) / fall);
}

/**
 * How much speed the fading exhale still contributes.
 *
 * Quadratic ease-out: a quick initial release that settles gently — an exhale,
 * not a linear fade. Reaches EXACTLY 0 at INTENT_EXHALE_MS, which is what lets
 * A2 assert "the abort exhale reaches state speed within bound" as equality
 * rather than an epsilon.
 */
function exhaleSpeed(state, now, tuning = WARP_TUNING) {
  if (!state || state.exhaleAt == null || !(state.exhaleFrom > 0)) return 0;
  // A single unusable READ holds the exhale at its current start value rather
  // than snapping it to zero; `exhaleAt` is always finite when set (see the
  // terminal branch of reduceIntentEvent), so the next frame with a good clock
  // resumes the decay from the right place and this can never strand.
  if (!Number.isFinite(now)) return state.exhaleFrom;
  const span = tuning.INTENT_EXHALE_MS;
  if (!(span > 0)) return 0;
  // Same backwards-clock rule as the surge: clamp01 would otherwise floor a
  // negative elapsed at t=0 and replay the exhale from full strength.
  if (now < state.exhaleAt) return 0;
  const t = clamp01((now - state.exhaleAt) / span);
  const remaining = 1 - t;
  return state.exhaleFrom * remaining * remaining;
}

/**
 * Total speed the overlay is asking for right now — the louder of the live
 * hold and the still-fading exhale (see "WHY THE EXHALE IS NEVER CANCELLED").
 */
export function intentSpeed(state, now, tuning = WARP_TUNING) {
  if (!state) return 0;
  const live = state.progress == null ? 0 : intentCurve(state.progress, tuning);
  return Math.max(
    live,
    exhaleSpeed(state, now, tuning),
    surgeSpeed(state, now, tuning),
  );
}

/**
 * Fold one `ft-deploy-intent` payload into the overlay state. Pure: returns the
 * NEXT state and never mutates the input.
 *
 * A malformed payload returns the SAME state object by identity, so "the
 * listener ignores malformed payloads" (row A3) is assertable with toBe() and a
 * stray event can never churn the field.
 */
export function reduceIntentEvent(state, detail, now, tuning = WARP_TUNING) {
  const prev = state || createIntentState();
  if (!detail || typeof detail !== 'object') return prev;

  // Terminal — abort or commit. Hand the exhale the speed we are AT (which may
  // itself still include an older exhale or surge), so the release is continuous.
  if (detail.progress === null) {
    // A terminal with an unusable clock cannot time a decay. Intent CLEARS at
    // once rather than guessing a duration or leaving the sky leaning in on an
    // exhale that can never be measured — the conservative answer, the same
    // rule the tier machine applies to a game whose clock it cannot prove. In
    // practice `now` is Date.now() from the listener and is always finite.
    if (!Number.isFinite(now)) return createIntentState();

    const committing = detail.reason === 'commit';

    // THE TERMINAL-COLLISION GUARD — a commit surge is AUTHORITATIVE.
    //
    // Phase 2's own settle makes this reachable: injecting the new battle flips
    // `isLive`, which swaps the Deploy section out for Manage
    // (CommandDashboard.jsx:465 / CommandDashboardDesktop.jsx:221), unmounting
    // the very button that was just held. The hook closes its stream on unmount
    // with an ABORT, and an abort landing on an in-flight commit would replace
    // the signature beat with its exact opposite — a punch turned into a sigh.
    //
    // Today the ordering makes that unreachable (the unmount arrives seconds
    // after fireComplete has set phase 'locked', long past the 450ms window),
    // but that is a timing margin, not a guarantee, and a future change to the
    // ceremony could close the gap. So the precedence is structural: while a
    // commit surge is in flight, nothing but another commit may disturb it.
    // ...but the abort still has a SECOND job, and discarding the whole event
    // discarded that too: clearing `progress`. The terminal branch below is the
    // only writer that ever nulls it, so a live-progress frame arriving between
    // the commit and the blocked abort would strand a hold value forever — the
    // sky pinned above battle state with no gesture in flight and no event able
    // to bring it down. Reachable because two hold buttons are mounted at once
    // (the muted CTA and DeployStation on mobile; ReadColumn and DeployCard on
    // desktop), so two pointers can drive two independent streams into the one
    // window channel. Close the stream, keep the punch.
    if (!committing && isSurging(prev, now, tuning)) {
      return prev.progress == null ? prev : { ...prev, progress: null };
    }

    const from = intentSpeed(prev, now, tuning);
    return {
      progress: null,
      exhaleFrom: from,
      exhaleAt: now,
      surgeFrom: committing ? from : prev.surgeFrom,
      surgeAt: committing ? now : prev.surgeAt,
    };
  }

  // Live progress. The exhale (and any surge) is deliberately left running
  // underneath — see "WHY THE EXHALE IS NEVER CANCELLED".
  if (typeof detail.progress === 'number' && Number.isFinite(detail.progress)) {
    return { ...prev, progress: clamp01(detail.progress) };
  }

  return prev; // undefined, NaN, string, boolean — malformed.
}

/**
 * R-T4-ARCH — the whole coupling, as one pure function.
 *
 * Called at the consumption read to decorate what gets DRAWN. The tier
 * machine's own `speed` is untouched and keeps integrating honestly.
 *
 * @param {number} coreSpeed  advanceWarp's battle-state speed for this frame.
 * @param {object|null} state The overlay state (a component ref).
 * @param {number} now        Wall clock, epoch ms — this module never reads one.
 * @returns {number} the speed to draw with: never below `coreSpeed`.
 */
export function applyIntent(coreSpeed, state, now, tuning = WARP_TUNING) {
  const intent = intentSpeed(state, now, tuning);
  // A non-finite core speed would poison max() and blank the field; fall back
  // to the intent alone rather than propagating NaN into the star depths.
  if (!Number.isFinite(coreSpeed)) return intent;
  return Math.max(coreSpeed, intent);
}
