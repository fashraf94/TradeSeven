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

import { useCallback, useEffect, useRef, useState } from 'react';

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
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => { onComplete?.(); }, lockBeatMs);
  }, [onComplete, lockBeatMs]);

  const tick = useCallback(() => {
    const p = Math.min(1, (performance.now() - startRef.current) / holdMs);
    setProgress(p);
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
