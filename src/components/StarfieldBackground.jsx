// src/components/StarfieldBackground.jsx
//
// The BATTLE-WEATHER STARFIELD — a canvas radial-projection field whose speed
// reflects the user's live games.
// Delight Layer arc, Task 2 (Phase 1). Spec V2 §4 D1/D3, rulings R-T2-S4/S5/S7.
// Basis: docs/audits/20260730_DELIGHT_STARFIELD_BACKGROUND_PHASE0_DISCOVERY.md
//
// ---------------------------------------------------------------------------
// WHAT THIS IS AND WHERE IT MOUNTS
// ---------------------------------------------------------------------------
// A read-only ambient layer. It writes nothing and gates nothing. It renders in
// the z0 background slot BEHIND the dashboard content, and is mounted at exactly
// two flag-conditional sites (spec V2 D4 + Amendment A2):
//
//   src/App.jsx:8608  desktop dashboard  <- isStarfieldOn()
//   src/App.jsx:8567  mobile dashboard   <- isStarfieldMobileOn()
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
// removes both listeners. That inheritance IS the integration assurance for
// acceptance rows A3/A4 — per R-T2-S8 there is no jsdom rAF-spy rig, because the
// repo mocks getContext/rAF nowhere and has no setupFiles to home one.
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
// PHASE 1 (this commit): driven ONLY by the ?warpState= dev override. There is
// no live wiring yet and no Firestore import — acceptance row A6.
// PHASE 2 (next): `liveGames` arrives as a PROP, mapped from the EXISTING
// `activeAgentBattles` poll (src/App.jsx:3873-3909) — zero new Firestore reads
// (R-T2-S1). The override keeps winning when present (R-T2-S4). The seam is
// marked below.
//
// v1 endgame scope is agentBattles only (R-T2-S3): the League 5-day arc caps at
// BATTLE LIVE because its end date is server-only, and a Snake-Draft-only user
// sees RESTING. Both fall out of the core's "unprovable clocks get no endgame"
// rule rather than needing a special case here.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
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

/** Guard for the server-render smoke, where there is no document. */
const isHidden = () => typeof document !== 'undefined' && document.hidden === true;

const StarfieldBackground = ({
  /** 'desktop' | 'mobile' — set by the mount site, never self-detected. */
  mode = 'desktop',
  /** Live games for the state machine. PHASE 2 seam; unused while overridden. */
  liveGames = null,
  /** Optional deterministic seed for the initial field (R-T2-S7). */
  seed = null,
  /** Belt-and-braces: the mount site already gates on the flag. */
  enabled = true,
  /** Inverted vs BaggerBombBackground — reduced motion is honoured by default. */
  honorReducedMotion = true,
} = {}) => {
  const prefersReduced = useReducedMotion();
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

  // PHASE 1: the override is the ONLY driver. Anchored once so the endgame
  // clock genuinely counts DOWN — recomputing `endsAt` from `now` every frame
  // would freeze the ramp at its start and the sky would never peak.
  const overrideGamesRef = useRef(null);
  if (overrideGamesRef.current === null) {
    overrideGamesRef.current = synthesizeOverrideGames(getWarpDevOverride(), Date.now()) ?? false;
  }

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

    // Skip if dimensions haven't actually changed (mobile scroll address bar).
    if (width === sizeRef.current.w && height === sizeRef.current.h) return;
    sizeRef.current = { w: width, h: height };

    const dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);
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
  const project = useCallback((star, width, height, depth) => {
    const vpX = width * WARP_TUNING.VANISHING_X;
    const vpY = height * WARP_TUNING.VANISHING_Y;
    const k = WARP_TUNING.PROJECTION / depth;
    return { x: vpX + star.x * width * k, y: vpY + star.y * height * k };
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

    for (let i = 0; i < stars.length; i += 1) {
      const star = stars[i];
      const now = project(star, width, height, star.z);
      const then = project(star, width, height, star.pz);

      // Depth-driven presence: closer stars are brighter and fatter.
      const nearness = 1 - star.z;
      const alpha = Math.min(
        WARP_TUNING.STAR_MAX_ALPHA,
        nearness * WARP_TUNING.ALPHA_GAIN,
      ) * alphaScale;
      if (alpha <= 0.002) continue;

      const lineWidth = Math.max(0.7, nearness * 2.6);

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
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
      const { x, y } = project(star, width, height, star.z);
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
    const width = window.innerWidth;
    const height = window.innerHeight;
    sizeRef.current = { w: width, h: height };

    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    rngRef.current = makeRng(seed);
    starsRef.current = createStars(profile.particleCount, rngRef.current);
    warpRef.current = createWarpState();
    lastFrameRef.current = null;

    // The pure core owns the decision; this component only obeys it (R-T2-S8).
    const plan = resolveLoopPlan({ flagOn: enabled, reducedMotion: reduce, hidden: isHidden() });
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
        flagOn: enabled,
        reducedMotion: reduce,
        hidden: isHidden(),
      });
      cancelAnimationFrame(rafRef.current);
      if (next.shouldSchedule) {
        lastFrameRef.current = null; // do not bill the hidden interval to dt
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(resizeTimerRef.current);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [animate, applyCanvasSize, paint, reduce, enabled, profile.particleCount, profile.maxDpr, seed]);

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
