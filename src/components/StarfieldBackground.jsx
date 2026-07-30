// src/components/StarfieldBackground.jsx
//
// The BATTLE-WEATHER STARFIELD — a canvas radial-projection field whose speed
// reflects the user's live games.
// Delight Layer arc, Task 2 (Phase 2 — live-wired). Spec V2 §4 D1/D3/D5,
// rulings R-T2-S1/S2/S4/S5/S7/S12.
// Basis: docs/audits/20260730_DELIGHT_STARFIELD_BACKGROUND_PHASE0_DISCOVERY.md
//
// ---------------------------------------------------------------------------
// WHAT THIS IS AND WHERE IT MOUNTS
// ---------------------------------------------------------------------------
// A read-only ambient layer. It writes nothing and gates nothing. It renders in
// the z0 background slot BEHIND the dashboard content, and is mounted at exactly
// two flag-conditional sites (spec V2 D4 + Amendment A2):
//
//   src/App.jsx:8631  desktop dashboard  <- isStarfieldOn()
//   src/App.jsx:8584  mobile dashboard   <- isStarfieldMobileOn()
//
// Flag off at either site mounts DesktopBackground exactly as before, so the
// off-state is byte-identical (acceptance row A1). DesktopBackground.jsx is NOT
// edited by this task and still renders on the other six screens (R-T2-S5).
//
// ---------------------------------------------------------------------------
// NO SELF-GATE — DEVICE MODE IS EXPLICIT (Amendment A2)
// ---------------------------------------------------------------------------
// DesktopBackground self-gates with `if (!isDesktop) return null`, which is why
// mobile has had no background layer at all. This component deliberately does
// NOT inherit that: it takes an explicit `mode` ('desktop' | 'mobile') and the
// mount site decides. Mobile is its own budget tier — fewer particles and a
// lower DPR cap (Amendment A3) — never a shrunken desktop field.
//
// ---------------------------------------------------------------------------
// LIFECYCLE IS INHERITED, NOT INVENTED (ruling R-T2-S7)
// ---------------------------------------------------------------------------
// The effect below is lifted from the shipping BaggerBombBackground.jsx
// (:16, :72-75, :83-88, :101, :183, :194-199, :213-227): DPR cap, debounced
// resize that never recreates particles, visibilitychange cancel/restart,
// style-opts-in-refs so the once-mounted loop reads fresh values without
// re-subscribing, and a cleanup that cancels the rAF, clears the timer and
// removes both listeners. That inheritance is the integration assurance for
// acceptance rows A3/A4.
//
// CORRECTION (ruling R-T2-S12): an earlier version of this header said the repo
// "mocks getContext/rAF nowhere and has no setupFiles to home one," which was
// the premise ruling S8 rested on. That premise was FALSE — see
// Forge/workshop/character/CharacterArea.scrollreset.test.jsx (jsdom docblock,
// createRoot + act, per-file mocks, no setupFiles). The narrow rig now lives at
// starfield.depstability.test.jsx and guards the one hazard that matters here:
// a new `liveGames` identity every poll must NOT restart the field.
//
// ONE MANDATORY INVERSION (R-T2-S7): BaggerBombBackground defaults
// honorReducedMotion=false (it always animates, to preserve the PvP view).
// Here it defaults TRUE — prefers-reduced-motion paints one static dim frame and
// never schedules a loop. Note the global CSS guard at src/index.css:550 CANNOT
// help: it zeroes CSS animation durations and is invisible to a JS rAF loop.
//
// ---------------------------------------------------------------------------
// DATA PATH
// ---------------------------------------------------------------------------
// LIVE (Phase 2): `liveGames` arrives as a PROP, mapped by warpBattleAdapter.js
// from the EXISTING `activeAgentBattles` poll (src/App.jsx:3887-3922) — zero new
// Firestore reads (R-T2-S1, acceptance row A6). This component imports no
// Firebase API and starts no timer of its own.
//
// The `?warpState=` dev override still WINS over live inputs when present
// (R-T2-S4) — it is anchored once at mount so its endgame clock counts down.
//
// The ENDGAME ramp ticks off the governing game's `expiresAt` on the rAF loop
// rather than on the 120s poll (R-T2-S2): the poll supplies set MEMBERSHIP, the
// local clock supplies the ramp. A poll-driven ramp would miss short windows
// entirely, since min(30min, 25%) can be smaller than the poll interval.
//
// v1 endgame scope is agentBattles only (R-T2-S3): the League 5-day arc caps at
// BATTLE LIVE because its end date is server-only, and a Snake-Draft-only user
// sees RESTING. Both fall out of the core's "unprovable clocks get no endgame"
// rule rather than needing a special case here.
//
// ---------------------------------------------------------------------------
// FOR WHOEVER RETIRES THE PRICE LINES (ruling R-T2-S6) — READ BEFORE DELETING
// ---------------------------------------------------------------------------
// This component REPLACES DesktopBackground at the two dashboard mounts only.
// DesktopBackground.jsx is untouched and still renders on six other screens, so
// after the v1 flag flip the app deliberately runs two ambient systems. The
// everywhere-swap follow-on is the PR that finally deletes the price-line SVGs —
// and when it does, it MUST also, in the same commit:
//
//   1. regenerate src/theme/tokenGuardBaseline.json (deleting those SVGs removes
//      3 pinned R-H8 hexes: #00d9ff x2 and #8b5cf6 x1 in DesktopBackground), and
//   2. update the hard-coded exempt count in src/theme/tokens.guard.test.js
//      (the R-BL21 row asserts those exact counts and a total of 21 -> 18).
//
// Without both, that PR fails on a guard whose message will not obviously point
// here. The v1 flip PR does NOT touch either file, because it deletes nothing.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readToken } from '../theme/cssTokens';
import { getWarpDevOverride } from '../config/featureFlags';
import {
  WARP_TUNING,
  advanceWarp,
  createStars,
  createWarpState,
  deviceProfile,
  makeRng,
  resolveLoopPlan,
  resolveTint,
  respawnStar,
  synthesizeOverrideGames,
} from './warpStateMachine';

const RESIZE_DEBOUNCE_MS = 200;

/**
 * Reused projection targets (see `project`). Module-scoped rather than
 * per-instance because paint/step are synchronous and never interleave — rAF
 * callbacks run sequentially — so no two projections are ever in flight at once.
 */
const scratchA = { x: 0, y: 0 };
const scratchB = { x: 0, y: 0 };

/** Guard for the server-render smoke, where there is no document. */
const isHidden = () => typeof document !== 'undefined' && document.hidden === true;

/**
 * Live `prefers-reduced-motion`, subscribed rather than latched.
 *
 * DELIBERATE DEVIATION from the verbatim lift (disclosed for ratification):
 * BaggerBombBackground uses framer-motion's `useReducedMotion`, which is a
 * `useState` snapshot with NO subscription — correct at mount, stale forever
 * after. There it defaults OFF so nothing depended on it; here honouring reduced
 * motion is the component's stated contract (the one mandatory inversion), and a
 * latched value means a user who enables Reduce Motion mid-session keeps a
 * 220-star loop running until they navigate away and back.
 */
function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const onChange = (event) => setReduced(event.matches);
    setReduced(mql.matches);
    // addListener is the Safari < 14 fallback; both are removed symmetrically.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}

const StarfieldBackground = ({
  /** 'desktop' | 'mobile' — set by the mount site, never self-detected. */
  mode = 'desktop',
  /**
   * Live games for the state machine. PHASE 2 seam; unused while overridden.
   *
   * ⚠ MUST already be ADAPTER-MAPPED to `[{ endsAt, totalDuration }]`. Raw
   * `agentBattles` docs will NOT work: they carry `expiresAt` (ISO) and have no
   * duration field at all, so an unmapped doc resolves to endsAt=undefined —
   * which reads as "clock unprovable", caps the sky at BATTLE LIVE forever, and
   * (worse) makes an already-expired battle count as live, because the
   * ended-game filter keys on the same field. Spec V2 D5 assigns that mapping to
   * the Phase-2 adapter: `{ endsAt: expiresAt, totalDuration: expiresAt −
   * activatedAt }`. Deliberately NOT done here — one mapping site, not two.
   */
  liveGames = null,
  /** Optional deterministic seed for the initial field (R-T2-S7). */
  seed = null,
  /** Inverted vs BaggerBombBackground — reduced motion is honoured by default. */
  honorReducedMotion = true,
} = {}) => {
  const prefersReduced = usePrefersReducedMotion();
  const reduce = honorReducedMotion && Boolean(prefersReduced);

  const profile = useMemo(() => deviceProfile(mode), [mode]);

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const starsRef = useRef([]);
  const resizeTimerRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const warpRef = useRef(createWarpState());
  const lastFrameRef = useRef(null);
  const rngRef = useRef(Math.random);

  // --- tint (D3) ------------------------------------------------------------
  // Read lazily, never cached at module scope, and re-read on the accent event
  // the future accent-picker task will dispatch. resolveTint guarantees no
  // var() string can reach a canvas op (row A5) — canvas has no CSS parser, so a
  // var() assigned to fillStyle is silently ignored and the previous colour
  // persists. Fail loud-ish (fallback to the token's own resolved value) rather
  // than paint an invisible field.
  const [tint, setTint] = useState(() => resolveTint(readToken('warp-tint')));

  useEffect(() => {
    const syncTint = () => setTint(resolveTint(readToken('warp-tint')));
    syncTint();
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('ft-accent-changed', syncTint);
    return () => window.removeEventListener('ft-accent-changed', syncTint);
  }, []);

  // --- fresh values without restarting the loop (BaggerBombBackground:83-88) --
  const tintRef = useRef(tint);
  tintRef.current = tint;

  // The dev override (?warpState=) WINS over the live liveGames prop when present
  // (R-T2-S4); it is NOT the sole driver — currentGames() below falls back to the
  // live prop whenever there is no override. `false` means "not overridden",
  // distinct from `[]` ("overridden to resting"). Anchored once in the mount
  // effect below — NOT during render, because a render that React throws away
  // (concurrent mode, StrictMode) must not stamp the clock the endgame ramp
  // counts down from.
  const overrideGamesRef = useRef(false);

  const liveGamesRef = useRef(liveGames);
  liveGamesRef.current = liveGames;

  /** Override wins over live inputs (R-T2-S4); false means "no override". */
  const currentGames = useCallback(() => {
    const override = overrideGamesRef.current;
    if (override !== false) return override;
    return liveGamesRef.current || [];
  }, []);

  const applyCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);

    // Skip if nothing that affects the backing store changed (the mobile scroll
    // address bar fires resize constantly). DPR is part of that check: dragging
    // a window between a 1x and a 2x display fires resize with IDENTICAL css
    // dimensions, and skipping on size alone would leave the field rendering at
    // half resolution against crisp dashboard text until an unrelated resize.
    if (width === sizeRef.current.w
      && height === sizeRef.current.h
      && dpr === sizeRef.current.dpr) return;
    sizeRef.current = { w: width, h: height, dpr };
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // reset before scale, never compound
  }, [profile.maxDpr]);

  /**
   * Project a star through the fixed vanishing point. Depth alone drives the
   * outward rush, which is what makes the field read as travel rather than
   * drift: the same delta-z moves a near star much further than a far one.
   */
  // Writes into a caller-owned scratch object instead of returning a fresh one.
  // This runs 3x per star per frame (twice in paint, once in step); at 220 stars
  // that was ~660 short-lived objects per frame / ~40k per second, and young-gen
  // GC pauses read as scroll jank in the dashboard IN FRONT of this layer —
  // exactly the cost the mobile budget tier does not otherwise address.
  const project = useCallback((star, width, height, depth, out) => {
    const k = WARP_TUNING.PROJECTION / depth;
    out.x = width * WARP_TUNING.VANISHING_X + star.x * width * k;
    out.y = height * WARP_TUNING.VANISHING_Y + star.y * height * k;
    return out;
  }, []);

  /** Paint one frame of the current field. No stepping, no rescheduling. */
  const paint = useCallback((alphaScale = 1, withTrails = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w: width, h: height } = sizeRef.current;
    const stars = starsRef.current;
    const colour = tintRef.current;

    if (withTrails) {
      // Translucent frame-clear via destination-out: fades the previous frame
      // toward TRANSPARENT rather than toward an assumed background colour, so
      // the layer composites correctly over whatever the app paints behind it —
      // and it needs no hex parsing, avoiding the whole D-6 helper hazard.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${WARP_TUNING.TRAIL_FADE})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    // Constant for the whole frame — hoisted out of the per-star loop.
    ctx.strokeStyle = colour;
    ctx.lineCap = 'round';

    const now = scratchA;
    const then = scratchB;

    for (let i = 0; i < stars.length; i += 1) {
      const star = stars[i];
      project(star, width, height, star.z, now);
      project(star, width, height, star.pz, then);

      // Depth-driven presence: closer stars are brighter and fatter.
      const nearness = 1 - star.z;
      const alpha = Math.min(
        WARP_TUNING.STAR_MAX_ALPHA,
        nearness * WARP_TUNING.ALPHA_GAIN,
      ) * alphaScale;
      if (alpha <= 0.002) continue;

      const lineWidth = Math.max(0.7, nearness * 2.6);

      ctx.globalAlpha = alpha;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(then.x, then.y);
      ctx.lineTo(now.x, now.y);
      ctx.stroke();

      // Near-star white-blend: overdraw a small white core instead of mixing
      // channels, so the tint stays a single opaque value and no hex is parsed.
      if (star.z < WARP_TUNING.WHITE_BLEND_Z) {
        const blend = 1 - star.z / WARP_TUNING.WHITE_BLEND_Z;
        ctx.globalAlpha = alpha * blend;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(now.x, now.y, lineWidth * 0.6, 0, Math.PI * 2);
        ctx.fill();
        // fillStyle and strokeStyle are independent, so setting fillStyle above
        // did NOT disturb strokeStyle — it still holds `colour` from before the
        // loop, and the next iteration's stroke reads it unchanged. No restore
        // is needed.
      }
    }

    ctx.globalAlpha = 1;
  }, [project]);

  /** Advance depth by the state machine's current speed, then paint. */
  const step = useCallback((dtMs) => {
    const stars = starsRef.current;
    const rng = rngRef.current;
    const { w: width, h: height } = sizeRef.current;
    const dtSeconds = dtMs / 1000;
    const speed = warpRef.current.speed;
    const dz = speed * WARP_TUNING.Z_RATE * dtSeconds;

    for (let i = 0; i < stars.length; i += 1) {
      const star = stars[i];
      star.pz = star.z;
      star.z -= dz;

      if (star.z <= WARP_TUNING.Z_NEAR) {
        respawnStar(star, rng);
        continue;
      }

      // Recycle once the star has left the viewport, so off-screen stars do not
      // cost fill rate for the rest of their run.
      const { x, y } = project(star, width, height, star.z, scratchA);
      if (x < -width || x > width * 2 || y < -height || y > height * 2) {
        respawnStar(star, rng);
      }
    }

    paint(1, true);
  }, [paint, project]);

  const animate = useCallback(() => {
    const now = Date.now();
    const last = lastFrameRef.current;
    // Clamp dt so a backgrounded tab or a long GC pause cannot teleport the
    // field forward on the first frame back.
    const dtMs = last == null ? 16 : Math.min(100, Math.max(0, now - last));
    lastFrameRef.current = now;

    warpRef.current = advanceWarp(warpRef.current, {
      liveGames: currentGames(),
      now,
      dtMs,
    });

    step(dtMs);
    rafRef.current = requestAnimationFrame(animate);
  }, [currentGames, step]);

  useEffect(() => {
    // Anchor the dev override ONCE, here rather than during render, so the
    // endgame clock counts DOWN from a fixed instant. Recomputing `endsAt` from
    // `now` every frame would freeze the ramp at its start and never peak.
    overrideGamesRef.current = synthesizeOverrideGames(getWarpDevOverride(), Date.now()) ?? false;

    // Zeroed first so applyCanvasSize's skip-if-unchanged check cannot short
    // out on mount. Calling it here rather than re-implementing the DPR + size
    // + transform block keeps ONE copy of that logic — the duplicate used to be
    // the version the resize path never exercised.
    sizeRef.current = { w: 0, h: 0, dpr: 0 };
    applyCanvasSize();

    rngRef.current = makeRng(seed);
    starsRef.current = createStars(profile.particleCount, rngRef.current);
    warpRef.current = createWarpState();
    lastFrameRef.current = null;

    // The pure core owns the decision; this component only obeys it (R-T2-S8).
    // flagOn is true by construction: BEING MOUNTED IS the flag being on — both
    // mount sites are flag-conditional, so there is no in-component gate to
    // duplicate. The core keeps the parameter because the off-state is part of
    // its contract (row A2s covers it directly).
    const plan = resolveLoopPlan({ flagOn: true, reducedMotion: reduce, hidden: isHidden() });
    if (plan.shouldDrawOnce) {
      // prefers-reduced-motion: ONE static dim frame, loop never starts.
      paint(WARP_TUNING.STATIC_FRAME_ALPHA, false);
    } else if (plan.shouldSchedule) {
      rafRef.current = requestAnimationFrame(animate);
    }

    // Resize only updates canvas dimensions, never recreates the field.
    const handleResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        applyCanvasSize();
        if (reduce) paint(WARP_TUNING.STATIC_FRAME_ALPHA, false);
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', handleResize);

    // Pause while the tab is backgrounded (no-op under reduced motion / off).
    const handleVisibility = () => {
      const next = resolveLoopPlan({
        flagOn: true,
        reducedMotion: reduce,
        hidden: isHidden(),
      });
      cancelAnimationFrame(rafRef.current);
      if (next.shouldSchedule) {
        lastFrameRef.current = null; // do not bill the hidden interval to dt
        rafRef.current = requestAnimationFrame(animate);
      } else if (next.shouldDrawOnce) {
        // Reduced motion: repaint the static frame on return. iOS Safari
        // discards 2D backing stores for backgrounded tabs, so without this a
        // reduced-motion user comes back to a permanently blank field — the
        // only other repaint path needs an actual resize. The plan already
        // carries this flag; the handler used to consume only shouldSchedule.
        paint(WARP_TUNING.STATIC_FRAME_ALPHA, false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(resizeTimerRef.current);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [animate, applyCanvasSize, paint, reduce, profile.particleCount, profile.maxDpr, seed]);

  // Under reduced motion the mount effect paints ONE static frame and runs no
  // loop, so a mid-session tint change (a future accent-picker's
  // ft-accent-changed) has nothing to repaint it — the static field would keep
  // the old colour until an unrelated resize / tab-return. Repaint it here. Runs
  // after the mount effect (declaration order), so stars/size are already set;
  // a no-op when not reduced (the loop already reads tintRef every frame).
  useEffect(() => {
    if (reduce) paint(WARP_TUNING.STATIC_FRAME_ALPHA, false);
  }, [tint, reduce, paint]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="starfield-canvas"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

export default StarfieldBackground;
