// src/services/backingTelemetry.js
//
// Backing Beta PR 5 — THE CLIENT'S TELEMETRY EMITTER (spec V1.3 §10, D-p).
// The funnel's five client events — window_viewed, team_card_opened (with
// dwell ms), stake_control_opened, your_backing_viewed, results_viewed — go
// to POST /api/backing/event, where the write is AWAITED (BUILD_RULES §5).
// Here they are FIRE-AND-FORGET: `emitBackingEvent` never returns a promise a
// surface could wait on, never throws, never blocks a render or a tap, and
// swallows the reply — the sink has no client read.
//
// DEDUPLICATED PER SESSION: one record per (event, pod, seat) for the life of
// the page, so a re-render, a back-and-forth or a strict-mode double effect
// cannot inflate the funnel. The key is in memory only; a reload is a new
// session and may record again, which is what a session means.
//
// `stake_confirmed` is NOT emitted here — the stake endpoint writes it
// server-side (Amendment B §B7.3) — and the sink refuses it from a client.
//
// The dev preview page never reaches this module: it renders the surfaces
// with their data as props, and the hosts that emit are the lit hosts only.

import { postBackingEvent } from './backingService';

/** The five client events, as the sink's allowlist names them (src/constants/backing.js). */
export const BACKING_EVENT = Object.freeze({
  WINDOW_VIEWED: 'window_viewed',
  TEAM_CARD_OPENED: 'team_card_opened',
  STAKE_CONTROL_OPENED: 'stake_control_opened',
  YOUR_BACKING_VIEWED: 'your_backing_viewed',
  RESULTS_VIEWED: 'results_viewed',
});

const sent = new Set();

/** The per-session key: the event, the pod and the seat it was about. */
export function telemetryKey(event, { groupId = null, odUserId = null } = {}) {
  return `${event}|${groupId ?? ''}|${odUserId ?? ''}`;
}

/**
 * Emit one event. Returns true when a request was sent, false when the
 * session had already recorded it (or the event is not a client event).
 * Fire-and-forget: the request's outcome is never surfaced.
 */
export function emitBackingEvent(event, { groupId = null, odUserId = null, props = {} } = {}) {
  if (!Object.values(BACKING_EVENT).includes(event)) return false;
  const key = telemetryKey(event, { groupId, odUserId });
  if (sent.has(key)) return false;
  sent.add(key);
  const body = { event, groupId: groupId ?? null, props: { ...props } };
  if (odUserId && (event === BACKING_EVENT.TEAM_CARD_OPENED || event === BACKING_EVENT.STAKE_CONTROL_OPENED)) body.props.odUserId = odUserId;
  try {
    const p = postBackingEvent(body);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // never blocks, never throws
  }
  return true;
}

/** Dwell, in whole milliseconds, since an instant — clamped to the sink's range. */
export function dwellSince(startedAtMs, nowMs = Date.now()) {
  const ms = Math.round(nowMs - startedAtMs);
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(ms, 24 * 60 * 60 * 1000);
}

/** Test seam: forget the session's record. */
export function __resetBackingTelemetry() {
  sent.clear();
}
