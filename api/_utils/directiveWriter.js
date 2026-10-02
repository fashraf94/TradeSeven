// api/_utils/directiveWriter.js
//
// Cockpit Build 1a — THE SHARED SLOT WRITER and the call directive's
// retirement (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §6; contract Amendment B
// §3). Three writers file a directive — the chat turn (api/agent/chat.js, a
// plain update, latest-wins, no client belief), the chip route
// (api/agent/file-directive.js, one transaction with the client's belief) and
// the answer endpoint (api/agent/call-response.js, one transaction) — and all
// three go through fileDirectiveTransactional() from a PRE-VALIDATED plan:
// the writer gates nothing and cannot become a gate bypass; admission (owner,
// active parent, binding, belief, canonical, budget, pending) stays with each
// route, exactly where HEAD keeps it.
//
// WHAT THE WRITER ADDS, AND WHEN (Amendment B §3): when a filing replaces a
// CALL-FAMILY slot, the replacing exchange is stamped
// `supersedes: { directiveThreadId, at }` (additive, ordinary state — written at
// every mode) and, at resolved 'on', a `superseded` call event is created in
// the same commit; the replaced call's `playerResponse` is never rewritten. An
// ordinary filing over an ordinary slot writes exactly today's payload — no
// stamp, no event, no extra key — so chat and chip migrate behavior-
// preservingly (their own frozen rows prove it).
//
// RETIREMENT (spec §6) is compare-and-clear on a FRESH parent inside a
// transaction: the slot is cleared only when it is call-family AND its
// `directiveThreadId` AND its `answerId` match the retiring call's; a newer
// slot — any other thread — is never touched. Hearing consumes nothing.
//
// The ONLY persisted thread key is `directiveThreadId` (no alias).

import { isCallDirective } from './directiveUtils.js';
import { buildCallEvent, createCallEvent, callEventRef, eventIdOf } from './callRecords/events.js';
import { renderSupersededEvent } from './callRecords/copy.js';

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/**
 * The `supersedes` stamp a replacing exchange carries — only when the slot
 * being replaced is call-family and names a different thread.
 *
 * @returns {{ directiveThreadId: string, at: string }|null}
 */
export function supersedesStamp(priorSlot, { newThreadId, at }) {
  if (!isCallDirective(priorSlot)) return null;
  const prior = priorSlot.directiveThreadId;
  if (!nonEmpty(prior) || prior === newThreadId) return null;
  return { directiveThreadId: prior, at };
}

/**
 * Does the retiring call's identity match the slot? Family, thread AND
 * immutable answer identity, all three.
 */
export function planRetirement(slot, { directiveThreadId, answerId }) {
  if (!isCallDirective(slot)) return false;
  if (!nonEmpty(directiveThreadId) || !nonEmpty(answerId)) return false;
  return slot.directiveThreadId === directiveThreadId && slot.answerId === answerId;
}

/**
 * Compare-and-clear: buffer `directive: null` on the transaction when the
 * FRESH parent's slot is this directive, else touch nothing. Returns whether
 * a clear was buffered.
 */
export function retireCallDirective(tx, battleRef, freshParent, { directiveThreadId, answerId }) {
  if (!planRetirement(freshParent?.directive, { directiveThreadId, answerId })) return false;
  tx.update(battleRef, { directive: null });
  return true;
}

/**
 * THE SHARED WRITER. `plan`:
 *   exchange    — the thread exchange to append (the route's own shape)
 *   fields      — the route's other battle fields, in its own key order
 *                 (the slot under `directive`, the budget, …)
 *   filed       — whether this filing installs a directive (chat: only when
 *                 one was minted)
 *   priorSlot   — the slot the route read (the fresh transaction read, or the
 *                 turn's battle for chat's latest-wins)
 *   callsMode   — the battle's resolved mode (the `superseded` event at 'on')
 *   battleId, db, arrayUnion — the handles the write needs
 * `tx` is a transaction (chip, endpoint) or null (chat's plain update; a
 * `superseded` event then rides a WriteBatch with the update, atomically).
 *
 * @returns {Promise<{ exchange: object, supersedes: object|null, supersededEventId: string|null }>}
 */
export async function fileDirectiveTransactional(tx, battleRef, plan) {
  const { exchange, fields = {}, filed = true, priorSlot = null, callsMode = null, battleId, db, arrayUnion } = plan;
  if (typeof arrayUnion !== 'function') throw new Error('directiveWriter: arrayUnion is required');
  const stamp = filed ? supersedesStamp(priorSlot, { newThreadId: exchange?.directiveThreadId ?? null, at: exchange?.timestamp ?? null }) : null;
  const stamped = stamp ? { ...exchange, supersedes: stamp } : exchange;
  const payload = { chatExchanges: arrayUnion(stamped), ...fields };

  let event = null;
  if (stamp && callsMode === 'on') {
    const atMs = Date.parse(exchange.timestamp);
    event = {
      kind: 'superseded',
      idParams: { directiveThreadId: stamp.directiveThreadId },
      event: buildCallEvent({
        kind: 'superseded',
        at: Number.isFinite(atMs) ? atMs : null,
        callIds: nonEmpty(priorSlot.callId) ? [priorSlot.callId] : [],
        text: renderSupersededEvent({ at: exchange.timestamp }),
        extra: { supersededBy: exchange.directiveThreadId ?? null, supersededDirectiveThreadId: stamp.directiveThreadId },
      }),
    };
  }

  if (tx) {
    tx.update(battleRef, payload);
    const supersededEventId = event ? createCallEvent(tx, db, battleId, event) : null;
    return { exchange: stamped, supersedes: stamp, supersededEventId };
  }
  if (!event) {
    await battleRef.update(payload);
    return { exchange: stamped, supersedes: stamp, supersededEventId: null };
  }
  // Chat's plain path with an event due: one atomic batch (the update and the create commit together).
  const batch = db.batch();
  batch.update(battleRef, payload);
  const id = eventIdOf('superseded', event.idParams);
  batch.create(callEventRef(db, battleId, id), event.event);
  await batch.commit();
  return { exchange: stamped, supersedes: stamp, supersededEventId: id };
}
