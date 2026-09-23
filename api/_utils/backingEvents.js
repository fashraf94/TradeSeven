// api/_utils/backingEvents.js
//
// Backing Beta PR 5 — THE TELEMETRY SINK'S ONE WRITER (spec V1.3 §10, D-p;
// Amendment B §B7.3). Every `backingEvents/{eventId}` document is written
// here and nowhere else: the client-emitted events through
// POST /api/backing/event (the FIXED allowlist in src/constants/backing.js —
// window_viewed, team_card_opened with dwell ms, stake_control_opened,
// your_backing_viewed, results_viewed) and `stake_confirmed`, which the stake
// endpoint writes SERVER-SIDE after its transaction commits and never fails
// the stake over (§B7.3 — a client that could post it would be asserting a
// stake the server had not written, §9).
//
// AWAITED, IN-REQUEST (BUILD_RULES §5 — the Signal Capture Rider forbids
// fire-and-forget for catalog events on the server). The CLIENT emits
// fire-and-forget and deduplicates per session (src/services/
// backingTelemetry.js); the write itself is awaited by the route.
//
// NO CLIENT READ, EVER (§6: `backingEvents` is unreadable by clients; the
// rules block is `read, write: if false`). This module reads nothing either:
// it is a writer with a closed vocabulary, not an event pipe.
//
// THE DOCUMENT (§6): `{ userId, groupId, event, at, props }`. `props` is a
// closed set per event (below) so the sink cannot become a free-form log;
// the funnel's segmentation keys (§10 — human seats per pod, formation path)
// ride on `stake_confirmed`, which the server can state truthfully because it
// has just read the pod.
//
// A LITERAL COLLECTION CHAIN ON PURPOSE: `db.collection('backingEvents')` is
// spelled out so the protected-store scanner resolves the write statically
// (the collection is not protected) instead of listing it unresolved.
//
// Imports the zero-import constants module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of THIS
// module is the dependency-surface guard — never mock it.

import { randomUUID } from 'node:crypto';
import { BACKING_EVENT_ALLOWLIST } from '../../src/constants/backing.js';

/** The collection (§6). Readable by no client. */
export const BACKING_EVENTS_COLLECTION = 'backingEvents';

/** The one event the CLIENT may never post — the stake endpoint writes it (§10). */
export const STAKE_CONFIRMED_EVENT = 'stake_confirmed';

/** The longest dwell a card can honestly report — a day, in ms. */
export const MAX_DWELL_MS = 24 * 60 * 60 * 1000;

const FORGE_ID = /^[A-Za-z0-9_-]{1,200}$/;
const WEEK_KEY = /^\d{4}-W\d{2}$/;

/**
 * The CLOSED prop vocabulary per client event: name → validator. A prop not
 * named here is refused (`invalid_props`), so the sink's shape is fixed by
 * construction, not by convention.
 */
const PROP_RULES = Object.freeze({
  window_viewed: { weekKey: (v) => typeof v === 'string' && WEEK_KEY.test(v) },
  team_card_opened: {
    dwellMs: (v) => Number.isInteger(v) && v >= 0 && v <= MAX_DWELL_MS,
    odUserId: (v) => typeof v === 'string' && FORGE_ID.test(v),
  },
  stake_control_opened: { odUserId: (v) => typeof v === 'string' && FORGE_ID.test(v) },
  your_backing_viewed: { weekKey: (v) => typeof v === 'string' && WEEK_KEY.test(v) },
  results_viewed: { weekKey: (v) => typeof v === 'string' && WEEK_KEY.test(v) },
});

/** Props an event REQUIRES (the rest of its vocabulary is optional). */
const REQUIRED_PROPS = Object.freeze({ team_card_opened: ['dwellMs'] });

/**
 * Validate a client-posted event body against the allowlist and the prop
 * vocabulary. Pure. `{ ok: true, event, groupId, props }` or
 * `{ ok: false, error, message }` — each refusal one plain reason word.
 */
export function validateBackingEventBody(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const { event, groupId = null, props = {} } = b;
  if (typeof event !== 'string' || !BACKING_EVENT_ALLOWLIST.includes(event)) {
    return { ok: false, error: 'unknown_event', message: `event must be one of ${BACKING_EVENT_ALLOWLIST.join(', ')}.` };
  }
  if (groupId !== null && (typeof groupId !== 'string' || !FORGE_ID.test(groupId))) {
    return { ok: false, error: 'invalid_group_id', message: 'groupId must be a valid id when present.' };
  }
  if (props === null || typeof props !== 'object' || Array.isArray(props)) {
    return { ok: false, error: 'invalid_props', message: 'props must be an object when present.' };
  }
  const rules = PROP_RULES[event] ?? {};
  for (const [key, value] of Object.entries(props)) {
    if (!(key in rules)) return { ok: false, error: 'invalid_props', message: `props.${key} is not a recorded prop of ${event}.` };
    if (!rules[key](value)) return { ok: false, error: 'invalid_props', message: `props.${key} is out of range for ${event}.` };
  }
  for (const key of REQUIRED_PROPS[event] ?? []) {
    if (!(key in props)) return { ok: false, error: 'invalid_props', message: `props.${key} is required for ${event}.` };
  }
  return { ok: true, event, groupId, props: { ...props } };
}

/** A fresh, unguessable event id for a client-emitted event. */
export function newBackingEventId(event) {
  return `bev_${event}_${randomUUID()}`;
}

/**
 * The DETERMINISTIC id of a `stake_confirmed` record — keyed by its source id
 * (§6's "idempotency keyed by source id"), so a retried request can only ever
 * rewrite identical bytes, never mint a second confirmation. The stake
 * endpoint passes the REQUEST's debit key (Amendment C §C2, D-ag): a stake
 * and each of its top-ups are one document but separate confirmations.
 */
export function stakeConfirmedEventId(sourceId) {
  return `${STAKE_CONFIRMED_EVENT}:${sourceId}`;
}

/** The §6 document, built from its parts. Pure. */
export function buildBackingEvent({ userId, groupId = null, event, props = {}, now = new Date() }) {
  const at = new Date(now).toISOString();
  return { userId, groupId, event, at, props: props && typeof props === 'object' ? { ...props } : {} };
}

/**
 * Write ONE event, awaited. The only Firestore write this module performs.
 *
 * @returns {Promise<{eventId: string, doc: Object}>}
 */
export async function recordBackingEvent(db, { eventId, userId, groupId = null, event, props = {}, now = new Date() }) {
  if (typeof eventId !== 'string' || eventId.length === 0 || eventId.includes('/')) throw new Error('recordBackingEvent: a path-safe eventId is required');
  if (typeof userId !== 'string' || userId.length === 0) throw new Error('recordBackingEvent: userId is required');
  if (typeof event !== 'string' || event.length === 0) throw new Error('recordBackingEvent: event is required');
  const doc = buildBackingEvent({ userId, groupId, event, props, now });
  await db.collection('backingEvents').doc(eventId).set(doc);
  return { eventId, doc };
}
