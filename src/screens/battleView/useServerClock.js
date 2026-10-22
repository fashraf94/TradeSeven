// src/screens/battleView/useServerClock.js
//
// Cockpit Build 2b — THE SERVER'S CLOCK FOR DEADLINES (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §8, §4 "Server clock offset"; from merge).
//
// A card stops offering answers at its deadline on SERVER time —
// `Date.now() + offset`, the offset `serverNowMs − Date.now()` taken when the
// cockpit-status answer arrives (useCockpitStatus) — and the 60-second coarse
// tick no longer decides it. Each open card's deadline arms a timer: this hook
// keeps ONE timer, at the earliest deadline still ahead, re-armed whenever the
// deadlines or the offset change, and bumps a render-time instant when it
// fires, so the card loses its buttons at that instant. The endpoint still
// decides; this only removes buttons it would refuse.
//
// Pure helpers plus one React hook. No colour, no motion.

import { useEffect, useState } from 'react';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** The longest a timer is armed for (setTimeout's 32-bit ceiling, minus a margin). */
export const MAX_TIMER_MS = 2_000_000_000;

/** The clock offset to apply: the server's instant minus the client's at receipt, or 0 when unknown. */
export function clockOffsetFrom(serverNowMs, clientNowMs) {
  return finite(serverNowMs) && finite(clientNowMs) ? serverNowMs - clientNowMs : 0;
}

/**
 * The delay (client ms) until the earliest deadline strictly after the server's
 * now, or null when none is ahead.
 */
export function nextDeadlineDelay(deadlines, { clientNowMs, offsetMs = 0 }) {
  const serverNow = clientNowMs + (finite(offsetMs) ? offsetMs : 0);
  let next = null;
  for (const d of Array.isArray(deadlines) ? deadlines : []) {
    if (finite(d) && d > serverNow && (next === null || d < next)) next = d;
  }
  return next === null ? null : Math.min(MAX_TIMER_MS, Math.max(0, next - serverNow));
}

/**
 * The cockpit's render-time instant on SERVER time: the coarse clock's instant
 * (or a later one, set by the deadline timer) plus the offset.
 *
 * @param {object} p
 * @param {boolean} p.enabled       only while cockpit-on (no timer otherwise)
 * @param {number} p.coarseNowMs    the screen's coarse clock (useCoarseNow)
 * @param {number} p.offsetMs       serverNowMs − Date.now() at the status answer (0 when unknown)
 * @param {number[]} p.deadlines    the open calls' `horizon.expiresAt`
 * @returns {number} server-time ms
 */
export function useServerNow({ enabled, coarseNowMs, offsetMs = 0, deadlines = [] }) {
  const [nudgeMs, setNudgeMs] = useState(0);
  const key = enabled ? (Array.isArray(deadlines) ? deadlines.filter(finite).sort((a, b) => a - b).join(',') : '') : '';
  useEffect(() => {
    if (!enabled) return undefined;
    const delay = nextDeadlineDelay(key ? key.split(',').map(Number) : [], { clientNowMs: Date.now(), offsetMs });
    if (delay === null) return undefined;
    const timer = setTimeout(() => setNudgeMs(Date.now()), delay + 1);
    return () => clearTimeout(timer);
  }, [enabled, key, offsetMs, nudgeMs]);
  const base = Math.max(finite(coarseNowMs) ? coarseNowMs : 0, nudgeMs);
  return base + (enabled && finite(offsetMs) ? offsetMs : 0);
}

export default useServerNow;
