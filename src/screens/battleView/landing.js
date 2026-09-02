// src/screens/battleView/landing.js
//
// The landing — the ONE bold moment of the controller (design brief §4, Phase
// A seed §A1): when a check lands, the rows acknowledge it top to bottom and
// the turn line ticks, all inside 700 ms. Then still again.
//
// It fires on the SNAPSHOT CHANGE of `scoreState.lastScoredAt` only — the
// evaluation's own completion write — never on a timer, never on the clock,
// never on open (the first snapshot seeds the key without playing; a landing
// on open would be a landing for a check the player did not wait through).
//
// Reduced motion: no sequence at all — values update in place. The timing
// constants below are the whole choreography; the physics come from the
// motion vocabulary (motion.js) through motionToken(), never a raw literal.

import { useEffect, useRef, useState, useMemo } from 'react';
import { motionToken } from '../../theme/motion';

/** The whole sequence, rows and turn line, fits inside this. */
export const LANDING_TOTAL_MS = 700;
/** The rows' staggered starts span at most this much of it. */
export const LANDING_ROWS_SPAN_MS = 420;
/** Largest gap between two consecutive rows' starts. */
export const LANDING_STEP_MAX_MS = 60;

/** Per-row start delay (ms) for row `index` of `count`, top to bottom. */
export function landingRowDelayMs(index, count) {
  if (!Number.isFinite(index) || index <= 0 || !Number.isFinite(count) || count <= 1) return 0;
  const step = Math.min(LANDING_STEP_MAX_MS, LANDING_ROWS_SPAN_MS / (count - 1));
  return Math.round(step * index);
}

/** The turn line ticks after the last row has started (ms). */
export function landingTurnLineDelayMs(count) {
  return landingRowDelayMs(Math.max(0, (count || 0) - 1), count) + LANDING_STEP_MAX_MS;
}

/**
 * The landing key: the `lastScoredAt` value of the check that just landed, or
 * null. It changes exactly once per confirmed check after the first snapshot,
 * which is what keys the row washes and the turn-line tick to remount.
 */
export function useLandingKey(lastScoredAt, enabled) {
  const [key, setKey] = useState(null);
  const prevRef = useRef(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const current = lastScoredAt ?? null;
    if (!seededRef.current) {
      // First snapshot with a stamp: remember it, play nothing.
      if (current != null) {
        seededRef.current = true;
        prevRef.current = current;
      }
      return;
    }
    if (current != null && current !== prevRef.current) {
      prevRef.current = current;
      setKey(current);
    }
  }, [lastScoredAt, enabled]);

  return key;
}

/**
 * A fade transition from the vocabulary with the landing's own delay folded
 * in. Memoised so the JSX passes an identifier, not a fresh literal.
 */
export function useLandingTransition(delayMs, reducedMotion) {
  return useMemo(() => {
    const token = motionToken('fade', { reducedMotion: Boolean(reducedMotion) });
    return reducedMotion ? token : { ...token, delay: Math.max(0, delayMs) / 1000 };
  }, [delayMs, reducedMotion]);
}
