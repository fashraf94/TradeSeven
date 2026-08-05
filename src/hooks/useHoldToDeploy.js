// src/hooks/useHoldToDeploy.js
//
// Deploy Ceremony Phase 2 · Act 1 — the shared press-and-hold gesture behind
// every deploy entry point when DEPLOY_CEREMONY is on (spec §4). One hook, four+
// sites (founder ruling #6). Models the house HoldToLaunchButton gesture
// (rAF/pointer/haptics/touch-action) with the ceremony's contract:
//
//   - 1300ms hold on pointerdown → pointerup/leave/cancel.
//   - Early release drains (the consumer animates the fill over ~250ms); no
//     penalty, no message.
//   - Completion → phase 'locked' ("Locked in"), a ~450ms beat, then onComplete
//     (the shell opens the ceremony overlay + initiates the deploy).
//   - Haptics tick at 25/50/75/100% where navigator.vibrate is supported;
//     silently skipped otherwise.
//   - Keyboard: Enter/Space performs an immediate deploy WITHOUT a hold — holding
//     is a pointer affordance, not a security gate (spec §4 accessibility).
//   - Disabled/flag-off: the hook attaches NO handlers (bind === {}), so the
//     consumer keeps its existing tap onClick — flag-off stays byte-identical.
//
// Reduced motion (spec §9) keeps the hold — it is an interaction, not decoration.
// The hook's timing is identical; the consumer chooses whether the fill sweeps or
// snaps.
//
// ===========================================================================
// THE DEPLOY-INTENT CHANNEL — Delight Layer Task 4, spec V1 §3
// THE EVENT CONTRACT OF RECORD. The listener carries a copy; they agree.
// ===========================================================================
//
// This hook is the DISPATCHER for `ft-deploy-intent`, the signal the
// battle-weather starfield leans in on ("the room responds to your intent
// before you commit"). The listener is src/components/StarfieldBackground.jsx.
//
// ---------------------------------------------------------------------------
// THE CONTRACT
// ---------------------------------------------------------------------------
//   name    DEPLOY_INTENT_EVENT, exported from components/warpStateMachine.js.
//           Defined ONCE and imported by both ends, so the two can never drift
//           to different strings. Never re-type the literal.
//   target  `window`. Not a prop and not a bubbling DOM event: the deploy CTA
//           is a deep descendant of a SIBLING subtree to the starfield, so a
//           prop would have to be drilled through App for a signal that changes
//           ~60x a second and is transient.
//   payload carried on `event.detail`:
//
//     { progress: 0..1 }          per animation frame while a POINTER hold
//                                 charges. Pointer-only by ruling R-T4-S4 —
//                                 the keyboard path has no charge to stream.
//     { progress: null,
//       reason: 'abort' }         the hold ended early. The sky exhales back.
//     { progress: null,
//       reason: 'commit' }        the hold completed. The sky punches, inside
//                                 the LOCK_BEAT_MS window below.
//
//   Anything else is MALFORMED and is ignored by the listener's reducer
//   (warpStateMachine.reduceIntentEvent), which returns its previous state by
//   identity. Emitting a malformed payload is a silent no-op, not a crash.
//
//   ORDERING GUARANTEE the consumer relies on: a terminal always follows the
//   progress stream it ends, and `commit` is AUTHORITATIVE — an `abort` that
//   arrives while a commit surge is still in flight is discarded by the
//   reducer. That matters because the post-deploy settle unmounts this very
//   button mid-ceremony, and an unmount closes the stream with an abort.
//
// ---------------------------------------------------------------------------
// FOR WHOEVER ADDS THE NEXT CUSTOM EVENT — READ THIS FIRST
// ---------------------------------------------------------------------------
// `ft-deploy-intent` is the app's FIRST production CustomEvent dispatch. Before
// it, `src/` contained exactly one custom-event LISTENER (`ft-accent-changed`,
// StarfieldBackground.jsx) whose dispatcher had never been written, and the
// only `dispatchEvent` calls anywhere were inside tests. So there was no house
// pattern to copy, and this is now it. What the pattern is:
//
//   1. NAME THE EVENT IN ONE MODULE and import it at both ends. Two string
//      literals is how a channel silently stops working.
//   2. GUARD `typeof window === 'undefined'` before dispatching. The repo
//      server-renders components in tests (renderToString), and a bare
//      `window.dispatchEvent` throws there.
//   3. WRAP THE DISPATCH IN try/catch when the consumer is ambient. A cosmetic
//      layer must never be able to break the interaction that feeds it.
//   4. PUT THE PAYLOAD CONTRACT IN BOTH HEADERS and validate on the LISTENING
//      side, in a pure function. A dispatcher cannot know who is listening;
//      the listener is the only place a malformed payload can be handled.
//   5. TEST BOTH ENDS through the real gesture, not through the helper — the
//      wiring is the part that breaks. See starfield.intent.test.jsx.
//
// ---------------------------------------------------------------------------
// WHY DISPATCH LIVES HERE AND NOT AT THE CALL SITES
// ---------------------------------------------------------------------------
// This hook is the single consumer-facing home of the gesture:
// HoldToDeployButton is its ONLY importer, and every deploy CTA that has a hold
// renders through that button. So one dispatch here covers all six hold sites
// at once and — just as important — covers NOTHING else. (Six sites exist in
// code; four render at current flags, because SCOUTING_BOARD_ENABLED routes two
// of them to the "See what it's eyeing" branch. Dispatching from the hook is
// correct precisely because it does not depend on which are live.) The other
// press-and-hold gesture in the app, draft's HoldToLaunchButton, is a separate
// implementation and never emits this event.
//
// Behind DEPLOY_SKY_COUPLING_ENABLED (merged dark). Flag-off dispatches
// nothing at all, so the gesture is byte-identical to today (acceptance A1).

import { useCallback, useEffect, useRef, useState } from 'react';
import { isDeploySkyCouplingOn } from '../config/featureFlags';
import { DEPLOY_INTENT_EVENT } from '../components/warpStateMachine';

const HOLD_MS = 1300;
const LOCK_BEAT_MS = 450;
// Haptic ladder — fired once each as the charge crosses these fractions.
const HAPTIC_STEPS = [0.25, 0.5, 0.75, 1];

function vibrate(ms) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // Unsupported / blocked — silently skipped (spec §4).
  }
}

/**
 * Emit one frame of deploy intent. `progress` is 0..1, or null for the terminal
 * event (with `reason` 'abort' | 'commit').
 *
 * The flag is read per call rather than latched: it is the most direct
 * guarantee that flag-off emits nothing, with no window in which a cached value
 * could disagree. Once the constant flips true the helper returns on its first
 * line, so the URL parse only ever runs in the dark/preview state.
 *
 * Wrapped in try/catch on purpose: the starfield is an AMBIENT layer, and no
 * failure in telling it about a hold may ever be allowed to break the deploy
 * gesture itself. (Listener exceptions are reported globally rather than
 * propagated back to dispatchEvent, but the guarantee should not rest on that.)
 */
function dispatchIntent(progress, reason) {
  if (typeof window === 'undefined') return;
  if (!isDeploySkyCouplingOn()) return;
  try {
    window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, {
      detail: reason ? { progress, reason } : { progress },
    }));
  } catch {
    // The sky simply does not lean in. The deploy is unaffected.
  }
}

export default function useHoldToDeploy({
  enabled = false,
  disabled = false,
  onComplete,
  holdMs = HOLD_MS,
  lockBeatMs = LOCK_BEAT_MS,
} = {}) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'charging' | 'locked'
  const [progress, setProgress] = useState(0); // 0..1

  const rafRef = useRef(0);
  const startRef = useRef(0);
  const hapticRef = useRef(0); // count of HAPTIC_STEPS already fired
  const lockTimerRef = useRef(null);
  const phaseRef = useRef('idle');
  const wasDisabledRef = useRef(disabled);
  phaseRef.current = phase;

  const clearRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  };

  const fireComplete = useCallback(() => {
    // Enter the "Locked in" beat, then hand off. onComplete opens the ceremony
    // overlay + initiates the deploy (or, flag-off callers never reach here).
    setPhase('locked');
    setProgress(1);
    vibrate(60);
    // Terminal-commit, from EVERY input path (ruling R-T4-S4) — the keyboard
    // deploy reaches here too, and gets the commit beat without a preceding
    // lean, which reads as a very fast hold. Phase 2 turns this into the surge,
    // timed into the ~450ms lock beat below (R-T4-S3) — the last window in
    // which the sky is still visible before the ceremony curtain.
    dispatchIntent(null, 'commit');
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => { onComplete?.(); }, lockBeatMs);
  }, [onComplete, lockBeatMs]);

  const tick = useCallback(() => {
    const p = Math.min(1, (performance.now() - startRef.current) / holdMs);
    setProgress(p);
    // The sky leans in with the finger. Dispatched BEFORE the completion check
    // below, so a hold that reaches 1 hands the terminal event a curve already
    // at its peak — the commit beat then releases from the top rather than from
    // wherever the previous frame happened to sit.
    dispatchIntent(p);
    while (hapticRef.current < HAPTIC_STEPS.length && p >= HAPTIC_STEPS[hapticRef.current]) {
      vibrate(hapticRef.current === HAPTIC_STEPS.length - 1 ? 60 : 12);
      hapticRef.current += 1;
    }
    if (p >= 1) {
      clearRaf();
      fireComplete();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs, fireComplete]);

  const start = useCallback(() => {
    if (!enabled || disabled) return;
    if (phaseRef.current !== 'idle') return;
    setPhase('charging');
    hapticRef.current = 0;
    startRef.current = performance.now();
    clearRaf();
    rafRef.current = requestAnimationFrame(tick);
  }, [enabled, disabled, tick]);

  const cancel = useCallback(() => {
    // Only a charge cancels — a 'locked' completion is committed and irreversible
    // by a pointer release.
    if (phaseRef.current !== 'charging') return;
    clearRaf();
    hapticRef.current = 0;
    setPhase('idle');
    setProgress(0);
    // The abort beat — half the signature. The sky exhales back to its battle
    // state; commitment only has weight if backing out feels like something.
    dispatchIntent(null, 'abort');
  }, []);

  const onKeyDown = useCallback((e) => {
    if (!enabled || disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (phaseRef.current !== 'idle') return; // ignore key auto-repeat / double fire
      fireComplete(); // immediate deploy, no hold (spec §4)
    }
  }, [enabled, disabled, fireComplete]);

  // Abort an in-flight charge if the button becomes disabled mid-hold.
  useEffect(() => {
    if (disabled && phaseRef.current === 'charging') cancel();
  }, [disabled, cancel]);

  // Reset the gesture when the button is re-enabled after a deploy cycle (e.g.
  // the ceremony was dismissed via "Back to hub" and the deploy flag cleared) —
  // otherwise the label would stay stuck on "Locked in".
  useEffect(() => {
    if (wasDisabledRef.current && !disabled) {
      setPhase('idle');
      setProgress(0);
      hapticRef.current = 0;
    }
    wasDisabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => () => {
    clearRaf();
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    // Close the intent stream if the button disappears MID-CHARGE (a re-render
    // that swaps the CTA, a navigation). Without this the last event the sky
    // ever received is a live `progress`, and since the overlay only decays on
    // a terminal it would stay leaning in FOREVER — a sky pinned fast by a hold
    // that no longer exists. A 'locked' unmount needs nothing: fireComplete
    // already sent its terminal.
    if (phaseRef.current === 'charging') dispatchIntent(null, 'abort');
  }, []);

  const active = enabled && !disabled;
  const bind = active
    ? {
        onPointerDown: (e) => { if (e.preventDefault) e.preventDefault(); start(); },
        onPointerUp: cancel,
        onPointerLeave: cancel,
        onPointerCancel: cancel,
        onKeyDown,
        onContextMenu: (e) => e.preventDefault(),
      }
    : {};

  return { phase, progress, bind, isActive: phase !== 'idle', locked: phase === 'locked' };
}
