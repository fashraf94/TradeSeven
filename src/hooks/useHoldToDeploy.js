// src/hooks/useHoldToDeploy.js
//
// Deploy Ceremony Phase 2 · Act 1 — the shared press-and-hold gesture behind
// every deploy entry point when DEPLOY_CEREMONY is on (spec §4). One hook, four+
// sites (founder ruling #6). Models the house HoldToLaunchButton gesture
// (rAF/pointer/haptics/touch-action) with the ceremony's contract:
//
//   - 1300ms hold on pointerdown → pointerup/leave/cancel (and, since R2, every
//     other loss of the gesture — THE HOLD CLAIM below).
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
// THE HOLD CLAIM — Command Center repair R2 (spec V1.2 §5.5, correction C4)
// ===========================================================================
//
// One ordinary hold, an early release and a keyboard deploy behave exactly as
// before R2, sky stream included. What R2 changed is every case in which the
// hook let two things happen that should be one, or let a deploy fire the
// player could not see coming.
//
//   ONE HOLD AT A TIME, APP-WIDE. ./holdClaim.js holds a single slot. Pointer
//   down and Enter/Space each CLAIM it before any effect: a denied claim
//   returns with no phase change, frame, haptic, progress, sky event, pointer
//   capture, timer or onComplete. A second control, a second pointer, or a key
//   on a charging control is denied the same way.
//
//   AUTHORITATIVE STATE IS IN REFS. stateRef ('idle' | 'charging' | 'locked')
//   and tokenRef are written in the same call that changes them; the React
//   phase only mirrors them for display. No guard reads a rendered phase — the
//   pre-R2 hook did, so two inputs processed before a re-render could both pass
//   (a release after the threshold frame reset the display while the deploy
//   still fired; two keydowns committed twice).
//
//   CHARGING CANCELS ON EVERY LOSS OF THE GESTURE: pointer up, leave, cancel,
//   lost pointer capture, the tab going hidden, window blur, disabled becoming
//   true, enabled becoming false, unmount. Each revokes the claim, clears the
//   queued frame, resets the display and emits ONE abort. A frame that runs
//   while the document is hidden cancels instead of committing, so a frame
//   resumed after a suspension can never commit. The blur/visibility listeners
//   exist only while charging.
//
//   THE THRESHOLD IS THE COMMITMENT BOUNDARY. At p ≥ 1 (or an accepted key)
//   commitHold(token) decides atomically; only on true does stateRef become
//   'locked' — before anything else — then the display, the haptic, exactly one
//   commit, onCommit and the beat. From then on release, leave, cancel, capture
//   loss, blur and hidden do nothing: "Locked in" stays and the deploy completes
//   once. A token revoked elsewhere cannot commit; that charge is torn down with
//   its one abort.
//
//   THE CLAIM LASTS THROUGH THE DEPLOY REQUEST. onComplete runs once, after the
//   beat; the slot stays locked until its result settles, so no second control
//   can start a hold while one deploy is in flight (Fable R1 review FR-4).
//   Released by: a cancel; that settle (a synchronous throw included); an
//   unmount that cancels a beat before it runs. An unmount AFTER onComplete has
//   run leaves the release to the settle.
//
//   THE BEAT. Unmounting during the 450 ms beat cancels it, as before R2 — a
//   deploy from an unmounted shell would have no ceremony to show it. The seam
//   for S2b's provider: onCommit(token), called synchronously at the boundary,
//   and beatOwner { commit(token, run) }, which takes the beat instead of this
//   hook's timer; an owned beat survives unmount and its run releases the claim.
//   With neither passed, behaviour is the legacy one above.
//
//   KEYBOARD. Enter/Space ignore auto-repeat, claim, commit at once and run the
//   same beat. No held-key requirement, no "release to cancel" for keys.
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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isDeploySkyCouplingOn } from '../config/featureFlags';
import { DEPLOY_INTENT_EVENT } from '../components/warpStateMachine';
import { claimHold, commitHold, releaseHold } from './holdClaim';

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

/**
 * Keep the pointer on the button for the rest of the gesture (R-R2-3), so its
 * release is delivered here wherever it happens. Feature-detected: jsdom and
 * older engines have no setPointerCapture, and a pointer the platform no
 * longer knows throws. Either way the hold carries on uncaptured, and release,
 * leave and cancel still end it.
 */
function capturePointer(e) {
  const el = e?.currentTarget;
  if (!el || typeof el.setPointerCapture !== 'function' || e.pointerId == null) return;
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    // Not capturable — see above.
  }
}

export default function useHoldToDeploy({
  enabled = false,
  disabled = false,
  onComplete,
  controlId,
  onCommit,
  beatOwner,
  holdMs = HOLD_MS,
  lockBeatMs = LOCK_BEAT_MS,
} = {}) {
  const [phase, setPhase] = useState('idle'); // display mirror of stateRef
  const [progress, setProgress] = useState(0); // 0..1

  // Authoritative (R-R2-2): each is written in the call that changes it, and
  // every guard below reads these — never the rendered phase.
  const stateRef = useRef('idle'); // 'idle' | 'charging' | 'locked'
  const tokenRef = useRef(null); // this control's claim on the slot, or null
  const beatPendingRef = useRef(false); // committed; onComplete not yet run
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const hapticRef = useRef(0); // count of HAPTIC_STEPS already fired
  const lockTimerRef = useRef(null);
  const gestureListenersRef = useRef(null); // removes the blur/visibility listeners
  const wasDisabledRef = useRef(disabled);

  const clearRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  };

  const detachGestureListeners = () => {
    const detach = gestureListenersRef.current;
    gestureListenersRef.current = null;
    if (detach) detach();
  };

  const cancel = useCallback(() => {
    // Every exit from a charge that is not its commitment (R-R2-4). Only a
    // charge cancels — a 'locked' completion is committed and irreversible.
    if (stateRef.current !== 'charging') return;
    stateRef.current = 'idle';
    releaseHold(tokenRef.current);
    tokenRef.current = null;
    clearRaf();
    detachGestureListeners();
    hapticRef.current = 0;
    setPhase('idle');
    setProgress(0);
    // The abort beat — half the signature. The sky exhales back to its battle
    // state; commitment only has weight if backing out feels like something.
    dispatchIntent(null, 'abort');
  }, []);

  // The tab going hidden or the window losing focus ends the gesture the
  // player was making (D4, D5). Attached when a charge starts, removed on every
  // exit from it.
  const attachGestureListeners = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const onVisibility = () => { if (document.hidden) cancel(); };
    const onBlur = () => { cancel(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    gestureListenersRef.current = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  };

  const fireComplete = useCallback(() => {
    // THE COMMITMENT BOUNDARY (R-R2-5). Only the slot's current charging claim
    // commits, and the state is 'locked' before any effect below, so a release,
    // a key or a reentrant callback processed after this point cannot cancel,
    // repeat or reschedule it.
    if (stateRef.current !== 'charging') return;
    const token = tokenRef.current;
    if (!commitHold(token)) {
      // The claim was revoked elsewhere: this charge can no longer deploy. End
      // it with its one abort rather than leave it hanging at full charge.
      cancel();
      return;
    }
    stateRef.current = 'locked';
    beatPendingRef.current = true;
    clearRaf();
    detachGestureListeners();
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
    let ran = false;
    const run = () => {
      if (ran) return; // one completion per commitment, whoever runs it
      ran = true;
      lockTimerRef.current = null;
      beatPendingRef.current = false;
      let result;
      try {
        result = onComplete?.();
      } catch (err) {
        releaseHold(token);
        throw err;
      }
      // R-R2-7: the claim is held until the deploy request settles. A rejection
      // still surfaces once, as it did when the result was dropped.
      Promise.resolve(result).finally(() => { releaseHold(token); });
    };
    try {
      onCommit?.(token);
    } finally {
      // The commitment stands even if onCommit throws, so its beat is scheduled
      // regardless — otherwise nothing would ever release the claim.
      if (beatOwner) {
        beatOwner.commit(token, run);
      } else {
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        lockTimerRef.current = setTimeout(run, lockBeatMs);
      }
    }
  }, [cancel, onComplete, onCommit, beatOwner, lockBeatMs]);

  const tick = useCallback(() => {
    // A frame that runs while the document is hidden is a frame resumed after
    // a suspension: rAF paused, performance.now() did not, so p would jump
    // straight to 1. It cancels instead of committing (D4, review IR-08).
    if (typeof document !== 'undefined' && document.hidden) {
      cancel();
      return;
    }
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
  }, [holdMs, cancel, fireComplete]);

  const start = useCallback((e) => {
    if (!enabled || disabled) return;
    if (stateRef.current !== 'idle') return;
    // Claim before any effect (R-R2-3). A denied claim — another control is
    // holding, or this one already is — returns here with nothing done.
    const token = claimHold(controlId);
    if (token === null) return;
    tokenRef.current = token;
    stateRef.current = 'charging';
    setPhase('charging');
    hapticRef.current = 0;
    startRef.current = performance.now();
    clearRaf();
    attachGestureListeners();
    capturePointer(e);
    rafRef.current = requestAnimationFrame(tick);
  }, [enabled, disabled, controlId, tick]);

  const onKeyDown = useCallback((e) => {
    if (!enabled || disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      // Auto-repeat never deploys, and a key on a charging or locked control is
      // ignored (R-R2-6).
      if (e.repeat || stateRef.current !== 'idle') return;
      const token = claimHold(controlId);
      if (token === null) return;
      tokenRef.current = token;
      stateRef.current = 'charging';
      fireComplete(); // immediate deploy, no hold (spec §4)
    }
  }, [enabled, disabled, controlId, fireComplete]);

  // A control that stops being live mid-charge cancels (R-R2-4): disabled
  // becoming true, or enabled becoming false. A layout effect, so the cancel
  // lands in the same commit that renders the change and no queued frame can
  // reach the threshold in between.
  useLayoutEffect(() => {
    if (!enabled || disabled) cancel();
  }, [enabled, disabled, cancel]);

  // Reset the gesture when the button is re-enabled after a deploy cycle (e.g.
  // the ceremony was dismissed via "Back to hub" and the deploy flag cleared) —
  // otherwise the label would stay stuck on "Locked in". Never while a
  // committed beat is still pending: showing idle then would show cancellation
  // for a deploy that is about to fire (spec §5.5). The claim is not released
  // here; its own settle does that.
  useEffect(() => {
    if (wasDisabledRef.current && !disabled && !beatPendingRef.current) {
      if (stateRef.current === 'locked') {
        stateRef.current = 'idle';
        tokenRef.current = null;
      }
      setPhase('idle');
      setProgress(0);
      hapticRef.current = 0;
    }
    wasDisabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => () => {
    clearRaf();
    detachGestureListeners();
    if (lockTimerRef.current) {
      // Unmounting during the legacy beat cancels the deploy, as before R2
      // (R-R2-8): onComplete will never run, so nothing else would release the
      // claim. An owned beat (beatOwner) is not cancelled, and a beat that has
      // already run is released by its own settle.
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
      beatPendingRef.current = false;
      releaseHold(tokenRef.current);
    }
    // Close the intent stream if the button disappears MID-CHARGE (a re-render
    // that swaps the CTA, a navigation). Without this the last event the sky
    // ever received is a live `progress`, and since the overlay only decays on
    // a terminal it would stay leaning in FOREVER — a sky pinned fast by a hold
    // that no longer exists. A 'locked' unmount needs nothing: fireComplete
    // already sent its terminal.
    if (stateRef.current === 'charging') {
      stateRef.current = 'idle';
      releaseHold(tokenRef.current);
      dispatchIntent(null, 'abort');
    }
  }, []);

  // Only the button's OWN capture loss ends a charge. A touch is implicitly
  // captured by the element actually touched (the label span, the icon), and
  // capturePointer moves it to the button. Chromium overwrites that pending
  // capture before processing it, so the child never fires
  // lostpointercapture (measured in headless Edge, R2 report §9); an engine
  // that processed it first would bubble the child's event up here. Either
  // way that is the hand-over, not a loss.
  const onLostPointerCapture = (e) => { if (e.target === e.currentTarget) cancel(); };

  const active = enabled && !disabled;
  const bind = active
    ? {
        onPointerDown: (e) => { if (e.preventDefault) e.preventDefault(); start(e); },
        onPointerUp: cancel,
        onPointerLeave: cancel,
        onPointerCancel: cancel,
        onLostPointerCapture,
        onKeyDown,
        onContextMenu: (e) => e.preventDefault(),
      }
    : {};

  return { phase, progress, bind, isActive: phase !== 'idle', locked: phase === 'locked' };
}
