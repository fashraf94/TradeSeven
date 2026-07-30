// src/components/warpStateMachine.js
//
// Battle-Weather Starfield — the render-free pure core.
// Delight Layer arc, Task 2 (Phase 1). Spec V2 §4 D2, rulings R-T2-S2/S3/S7/S8.
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
//   RESTING      no live games                      speed 0.12
//   BATTLE LIVE  >=1 live game, none in endgame      speed 0.5
//   ENDGAME      governing game inside its window    speed 0.8 -> 2.2, continuous
//
//   R-PREC   the SOONEST-ENDING live game governs.
//   R-WINDOW endgame window = min(30 min, 25% of that game's total duration).
//   R-RAMP   transitions ease over seconds, never step.
//   R-REST   resting is near-imperceptible drift.
//   R-PARAM  speed is the ONLY state-driven parameter; density is fixed.
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
  SPEED_RESTING: 0.12,
  SPEED_LIVE: 0.5,
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
  /** Depth consumed per second at speed 1.0. Resting (0.12) ~= 92s per star. */
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
    if (typeof value.seconds === 'number') return value.seconds * 1000;
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
 * R-PREC — the soonest-ending live game governs.
 *
 * Games with a provable end sort ahead of clockless ones: an unknown end cannot
 * claim to be "soonest". Ties break on key so precedence is deterministic and a
 * re-render can never thrash the governing choice (feel criterion 4).
 */
export function selectGoverningGame(normalized) {
  if (!normalized || normalized.length === 0) return null;

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

  const governing = selectGoverningGame(normalized);
  const windowMs = endgameWindowMs(governing.totalDuration, tuning);
  const remainingMs = governing.endsAt == null ? null : governing.endsAt - now;

  if (remainingMs != null && windowMs > 0 && remainingMs <= windowMs) {
    return {
      tier: WARP_TIER.ENDGAME,
      governingKey: governing.key,
      remainingMs,
      windowMs,
      rampProgress: clamp01(1 - remainingMs / windowMs),
      liveCount: normalized.length,
    };
  }

  return {
    tier: WARP_TIER.LIVE,
    governingKey: governing.key,
    remainingMs,
    windowMs,
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
 * Advance one frame. Returns the NEXT state; never mutates the input.
 *
 * Easing model — one rule covers tier change, endgame ramp, handoff and decay:
 * an ease ANCHOR is dropped whenever the tier changes OR the governing game
 * changes (R-PREC handoff). Speed is then `lerp(anchorSpeed, target, t)` with
 * t = elapsed/easeMs. While t < 1 the sky glides; once t reaches 1 speed tracks
 * the target exactly, so the continuous endgame ramp stays continuous.
 *
 * Because t is 0 on the very frame the anchor drops, speed equals the previous
 * speed at that instant — a transition can never step (R-RAMP). Decay to rest
 * uses DECAY_MS (~30s) rather than TIER_EASE_MS.
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
    easeMs = resolved.tier === WARP_TIER.RESTING ? tuning.DECAY_MS : tuning.TIER_EASE_MS;
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
