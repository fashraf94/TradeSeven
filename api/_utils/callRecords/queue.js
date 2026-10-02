// api/_utils/callRecords/queue.js
//
// Cockpit Build 1a — THE SWEEP QUEUE ROW (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md
// §8). `callSweepQueue/{battleId}` = { battleId, nextExpiresAt: number | null,
// pendingHeard: callId[], updatedAt }. Build 0 armed legacy rows of the shape
// { battleId, nextExpiresAt, updatedAt } (publish.js); they are NORMALIZED ON
// READ — never rewritten merely to add the field. Enrolled atomically by
// publication (open calls → nextExpiresAt) and by the answer endpoint
// (pendingHeard += callId); deleted only by the sweep, when both are empty,
// inside a transaction that re-read the row.
//
// Pure except the two write helpers, which only buffer on a transaction.

export const QUEUE_COLLECTION = 'callSweepQueue';
export const SWEEP_STATE_COLLECTION = 'callSweepState';
export const SWEEP_STATE_DOC = 'singleton';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/** The queue document reference. */
export function queueRef(db, battleId) {
  return db.collection(QUEUE_COLLECTION).doc(battleId);
}

/** The cursor document reference. */
export function sweepStateRef(db) {
  return db.collection(SWEEP_STATE_COLLECTION).doc(SWEEP_STATE_DOC);
}

/**
 * A queue row as the sweep and the endpoint read it: a legacy Build 0 row
 * gains `pendingHeard: []`; a non-finite `nextExpiresAt` is null; a missing
 * row is the empty row.
 */
export function normalizeQueueRow(data, battleId) {
  const row = data && typeof data === 'object' ? data : {};
  return {
    battleId: nonEmpty(row.battleId) ? row.battleId : battleId,
    nextExpiresAt: finite(row.nextExpiresAt) ? row.nextExpiresAt : null,
    pendingHeard: Array.isArray(row.pendingHeard) ? row.pendingHeard.filter(nonEmpty) : [],
    updatedAt: finite(row.updatedAt) ? row.updatedAt : null,
  };
}

/** Is there nothing left for the sweep to do for this row? */
export function queueRowEmpty(row) {
  const r = normalizeQueueRow(row);
  return r.nextExpiresAt === null && r.pendingHeard.length === 0;
}

/**
 * Enroll a heard-pending call (the endpoint's acceptance, spec §5 row 8): the
 * row, merged, with the call appended to `pendingHeard` (once) and
 * `nextExpiresAt` preserved. Buffers one `set(…, { merge: true })`.
 */
export function enrollPendingHeard(tx, db, battleId, existingRow, callId, nowMs) {
  const row = normalizeQueueRow(existingRow, battleId);
  const pendingHeard = row.pendingHeard.includes(callId) ? row.pendingHeard : [...row.pendingHeard, callId];
  const next = { battleId, nextExpiresAt: row.nextExpiresAt, pendingHeard, updatedAt: nowMs };
  tx.set(queueRef(db, battleId), next, { merge: true });
  return next;
}
