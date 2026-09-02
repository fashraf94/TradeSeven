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

/**
 * How long after the landing starts its key is cleared. The whole sequence
 * (rows, then the turn line) is over by LANDING_TOTAL_MS; a little slack lets
 * the last fade finish. Clearing the key is NOT a landing trigger — the
 * landing fires on the snapshot only — it is what stops a re-entered tab from
 * replaying a check that already landed (review finding L2-F2).
 */
export const LANDING_CLEAR_MS = 1000;

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
 * null. It is set exactly once per confirmed check after the doc's first
 * snapshot, which is what keys the row washes and the turn-line tick — and it
 * clears itself LANDING_CLEAR_MS later, so nothing that mounts afterwards (a
 * re-entered tab) finds a landing to replay.
 *
 * Seeding is on the DOC's first snapshot, not on the first stamp (review
 * finding F4): a battle opened before its first check has `lastScoredAt:
 * null` on arrival, and the first check the player then waits through is a
 * confirmed check that must land. A doc that arrives already stamped seeds
 * silently — the player did not wait through that one.
 *
 * @param {string|null} lastScoredAt  scoreState.lastScoredAt from the doc
 * @param {boolean} enabled           the controller flag
 * @param {boolean} docPresent        whether the battle doc has arrived
 */
export function useLandingKey(lastScoredAt, enabled, docPresent = lastScoredAt != null) {
  const [key, setKey] = useState(null);
  const prevRef = useRef(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const current = lastScoredAt ?? null;
    if (!seededRef.current) {
      // The doc's first snapshot: remember its stamp (even null), play nothing.
      if (docPresent) {
        seededRef.current = true;
        prevRef.current = current;
      }
      return;
    }
    if (current != null && current !== prevRef.current) {
      prevRef.current = current;
      setKey(current);
    }
  }, [lastScoredAt, enabled, docPresent]);

  // End the landing: the sequence is over, the key goes back to null. A timer
  // that only ENDS a landing the snapshot started — never one that starts it.
  useEffect(() => {
    if (key == null) return undefined;
    const id = setTimeout(() => setKey((k) => (k === key ? null : k)), LANDING_CLEAR_MS);
    return () => clearTimeout(id);
  }, [key]);

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
