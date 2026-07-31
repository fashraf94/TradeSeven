/**
 * Motion vocabulary — the single source of truth for named spring/tween physics.
 *
 * Delight Layer arc, Task 3 (Phase 1 — DEFINE, inert). Spec V1 §4–§6 + the founder
 * STOP rulings of July 31, 2026.
 * Basis: docs/audits/20260731_DELIGHT_MOTION_TOKENS_PHASE0_DISCOVERY.md
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A NEW SIBLING MODULE (decision D1)
 * ---------------------------------------------------------------------------
 * This is deliberately NOT a re-point of any existing motion-constant module.
 * Phase 0 discovery found SEVEN import-disjoint motion-constant modules —
 * constants/animationTokens.js, constants/animations.js, components/ui/motion.jsx
 * (DEAD, 0 importers), components/earningsGame/animationPresets.js, utils/shockwaveUtils.js,
 * components/Dashboard/WeeklyChallenges/challengeDefinitions.js, and the non-Framer
 * components/AgentPresence/faceEngineCore.js — with ZERO numerically-identical springs
 * and no superset among them, so re-pointing one cannot subsume the rest. This mirrors
 * the Task-1 R-S2 pattern: theme/cssTokens.js is a sibling to theme/tokens.js for the
 * same reason. This module is consumed by NOTHING in Phase 1; adoption is gated per D3.
 *
 * ---------------------------------------------------------------------------
 * THE VOCABULARY  (names LOCKED; VALUES tuning-exempt per D5)
 * ---------------------------------------------------------------------------
 * Every token is a plain object usable directly by a Framer Motion `transition` prop:
 *
 *     <motion.div transition={snappy} .../>
 *     <motion.div transition={motionToken('smooth', { reducedMotion })} .../>
 *
 *   | token   | shape  | value                       | intent
 *   |---------|--------|-----------------------------|------------------------------------------------
 *   | snappy  | spring | stiffness 300 / damping 25  | taps, toggles, small state — the app's de-facto
 *   |         |        |                             | plurality spring (28 sites; 300-family = 51%).
 *   | quick   | tween  | duration 0.2                | micro-interactions — the app's de-facto plurality
 *   |         |        |                             | tween (bare 0.2, 93 sites).
 *   | smooth  | tween  | duration 0.3, ease easeOut  | layout & content — calm, ZERO bounce. A tween by
 *   |         |        |                             | design (a spring cannot be truly bounce-free).
 *   | bouncy  | spring | stiffness 300 / damping 20  | celebratory / emphasis — visible overshoot.
 *   | gesture | spring | stiffness 300 / damping 30  | drag-release physics (Task 4's foundation).
 *   |         |        |                             | ζ ≈ 0.87 — the calm settle a released drag wants;
 *   |         |        |                             | Framer springs preserve pointer velocity on interrupt.
 *   | instant | tween  | duration 0                  | the reduced-motion / no-animation case.
 *
 * VALUES are the STOP-locked table. They are tunable by founder feedback WITHOUT a spec
 * re-version (D5) — but the NAMES are not. Any value change MUST update the frozen LOCKED
 * table in motion.test.js in the SAME commit, or acceptance row A2 fails.
 *
 * Naming note (founder veto available, no reasoning required): `quick` (tween) and
 * `snappy` (spring) are near-synonyms for different shapes. If that reads badly in review
 * the founder may rename `quick` → `micro` or `fade` — a name change, not a value change.
 *
 * ---------------------------------------------------------------------------
 * WHY `instant` IS { duration: 0 } AND MUST STAY THAT WAY  (STOP Observation 2)
 * ---------------------------------------------------------------------------
 * `instant` is the reduced-motion swap. `{ duration: 0 }` is a valid Framer transition
 * object at BOTH spring and tween call sites — a zero-duration tween completes on the first
 * frame and Framer ignores spring params it does not need. Do NOT "fix" this into a spring
 * with stiffness/damping: that reintroduces settle time, which is the exact thing reduced
 * motion must remove.
 *
 * ---------------------------------------------------------------------------
 * REDUCED MOTION  (decision D2)
 * ---------------------------------------------------------------------------
 * motionToken(name, { reducedMotion }) returns `instant` when reducedMotion is true, the
 * named token otherwise — so call sites never branch:
 *
 *     transition={motionToken('bouncy', { reducedMotion: prefersReduced })}
 *
 * The accessor is PURE. It does NOT read matchMedia / useReducedMotion internally. Phase 0
 * (§2.6) found call sites legitimately disagree on the reduced-motion SOURCE (Framer's
 * mount-latched hook vs a live-subscribed matchMedia hook vs a per-render read), so the
 * CALLER injects reducedMotion. The decision lives in one testable place, the way the
 * Task-2 core-decision resolveLoopPlan({ reducedMotion }) does (warpStateMachine.js:487).
 *
 * ---------------------------------------------------------------------------
 * PURITY  (decision D1 / acceptance row A4)
 * ---------------------------------------------------------------------------
 * No React import, no framer-motion import, no DOM access, no side effects at import, no
 * module-scope caching. Every exported object is frozen so a consumer cannot mutate the
 * shared vocabulary. Out of scope for this vocabulary: CSS keyframes (index.css — D4) and
 * the non-Framer rAF easing engine faceEngineCore.js (§8 non-goal).
 */

/** taps, toggles, small state — the de-facto plurality spring (300-family = 51% of springs). */
export const snappy = Object.freeze({ type: 'spring', stiffness: 300, damping: 25 });

/** micro-interactions — the de-facto plurality tween (bare duration 0.2). */
export const quick = Object.freeze({ duration: 0.2 });

/** layout & content — calm, zero bounce. A tween by design. */
export const smooth = Object.freeze({ duration: 0.3, ease: 'easeOut' });

/** celebratory / emphasis — visible overshoot. */
export const bouncy = Object.freeze({ type: 'spring', stiffness: 300, damping: 20 });

/** drag-release physics (Task 4's foundation) — ζ ≈ 0.87 calm settle, velocity preserved on interrupt. */
export const gesture = Object.freeze({ type: 'spring', stiffness: 300, damping: 30 });

/** the reduced-motion / no-animation case. Stays { duration: 0 } — never a spring. */
export const instant = Object.freeze({ duration: 0 });

/**
 * The full vocabulary, keyed by name. Frozen. Consumers that resolve a token by string
 * (e.g. motionToken) read from here.
 */
export const MOTION = Object.freeze({
  snappy,
  quick,
  smooth,
  bouncy,
  gesture,
  instant,
});

/**
 * Reduced-motion-aware accessor (D2). Returns `instant` when reducedMotion is true, the
 * named token otherwise, so call sites never branch. Pure — the caller supplies the
 * reduced-motion boolean; this function never reads matchMedia.
 *
 * The name is validated FIRST, before the reduced-motion swap, so a typo throws in BOTH
 * modes rather than silently "working" under reduced motion.
 *
 * @param {'snappy'|'quick'|'smooth'|'bouncy'|'gesture'|'instant'} name - a locked token name.
 * @param {{ reducedMotion?: boolean }} [opts] - reducedMotion is injected by the caller (default false).
 * @returns {Readonly<object>} a Framer Motion transition object.
 * @throws {Error} if `name` is not one of the six locked token names.
 */
export function motionToken(name, { reducedMotion = false } = {}) {
  const token = MOTION[name];
  if (!token) {
    throw new Error(
      `motionToken: unknown motion token "${name}". Valid names: ${Object.keys(MOTION).join(', ')}`,
    );
  }
  return reducedMotion ? instant : token;
}
