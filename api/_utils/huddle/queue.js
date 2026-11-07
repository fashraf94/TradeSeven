// api/_utils/huddle/queue.js
//
// Huddle S1 — THE JOB QUEUE (spec V1.1 §3.3; Amendment A §A2; Amendment B §B4).
//
//   huddleQueue/{uid}_{etDate}
//     uid, etDate, status: 'pending'|'claimed'|'done'|'failed', attempts, claimGeneration,
//     leaseUntil, lastError, createdAt, updatedAt, reconcile?
//
// SELECT (Q-W1, Q-W2 in huddle-s1-queries.md; equality filters only, no composite):
// today's `pending` rows, oldest first in memory, and today's `claimed` rows whose lease
// has expired (reclaim of a crashed claim).
//
// CLAIM: a transaction re-reads the row and requires it still selectable. B4's reclaim
// order: before claiming an expired row the worker reads the huddle record — if it is
// already `ready`, the row is marked `done` (repair), never `failed`, whatever its
// attempts; only a record that is not ready with `attempts == 3` is marked `failed` (and
// the record `failed`). Otherwise: `claimed`, `attempts + 1`, `claimGeneration + 1`,
// `leaseUntil = now + 150 s`. The worker holds its generation.
//
// FINALIZERS (B4): every finalizer — the record publish (job.js), queue `done` / `failed`,
// and the record's `generating` mark — requires inside its transaction ALL THREE:
// generation equality, row `status == 'claimed'`, and `leaseUntil > now`. Marking a row
// `done` or `failed` BUMPS `claimGeneration`, so a worker whose claim another terminalized
// can never pass the equality check afterwards. A refused finalizer writes nothing and
// logs `stale_generation`.

import { queueRowRef, queueRowId, huddleDayRef, QUEUE_STATUS, RECORD_STATUS, HUDDLE_QUEUE } from './records.js';

export const QUEUE_LEASE_MS = 150_000;
export const MAX_ATTEMPTS = 3;

const iso = (ms) => new Date(ms).toISOString();

/** Write today's rows for these players, idempotently (an existing row is left as it is). */
export async function enqueuePlayers(db, { etDate, uids, nowMs = Date.now() }) {
  let created = 0;
  for (const uid of uids) {
    const ref = queueRowRef(db, uid, etDate);
    const made = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.data()?.status) return false;
      tx.set(ref, { uid, etDate, status: QUEUE_STATUS.PENDING, attempts: 0, claimGeneration: 0, leaseUntil: null, lastError: null, createdAt: iso(nowMs), updatedAt: iso(nowMs) }, { merge: true });
      return true;
    });
    if (made) created += 1;
  }
  return { created };
}

/** Today's selectable rows: pending (oldest first) then expired claims. Two equality queries (Q-W1, Q-W2). */
export async function selectClaimable(db, { etDate, nowMs = Date.now() }) {
  const col = db.collection(HUDDLE_QUEUE);
  const [pending, claimed] = await Promise.all([
    col.where('etDate', '==', etDate).where('status', '==', QUEUE_STATUS.PENDING).get(),
    col.where('etDate', '==', etDate).where('status', '==', QUEUE_STATUS.CLAIMED).get(),
  ]);
  const rows = [
    ...pending.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    ...claimed.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => !(Number.isFinite(r.leaseUntil) && r.leaseUntil > nowMs)),
  ];
  return rows;
}

/**
 * Claim one row (B4 reclaim order included).
 * @returns {Promise<{ kind: 'claimed', generation: number, attempt: number } | { kind: 'repaired_done' | 'failed_cap' | 'not_selectable' }>}
 */
export async function claimRow(db, { uid, etDate, nowMs = Date.now() }) {
  const ref = queueRowRef(db, uid, etDate);
  const dayRef = huddleDayRef(db, uid, etDate);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const recordSnap = await tx.get(dayRef);
    if (!snap.exists) return { kind: 'not_selectable' };
    const row = snap.data();
    const expired = row.status === QUEUE_STATUS.CLAIMED && !(Number.isFinite(row.leaseUntil) && row.leaseUntil > nowMs);
    if (row.status !== QUEUE_STATUS.PENDING && !expired) return { kind: 'not_selectable' };
    const gen = Number.isInteger(row.claimGeneration) ? row.claimGeneration : 0;
    const attempts = Number.isInteger(row.attempts) ? row.attempts : 0;
    if (recordSnap.exists && recordSnap.data()?.status === RECORD_STATUS.READY) {
      tx.update(ref, { status: QUEUE_STATUS.DONE, claimGeneration: gen + 1, leaseUntil: null, updatedAt: iso(nowMs) });
      return { kind: 'repaired_done' };
    }
    if (attempts >= MAX_ATTEMPTS) {
      tx.update(ref, { status: QUEUE_STATUS.FAILED, claimGeneration: gen + 1, leaseUntil: null, lastError: row.lastError || 'attempts_exhausted', updatedAt: iso(nowMs) });
      tx.set(dayRef, { uid, etDate, status: RECORD_STATUS.FAILED, generation: { failReason: row.lastError || 'attempts_exhausted' }, updatedAt: iso(nowMs) }, { merge: true });
      return { kind: 'failed_cap' };
    }
    tx.update(ref, { status: QUEUE_STATUS.CLAIMED, attempts: attempts + 1, claimGeneration: gen + 1, leaseUntil: nowMs + QUEUE_LEASE_MS, updatedAt: iso(nowMs) });
    return { kind: 'claimed', generation: gen + 1, attempt: attempts + 1 };
  });
}

/** B4: generation equality, still claimed, lease unexpired. */
export function ownsClaim(row, { generation, nowMs }) {
  return !!row && row.claimGeneration === generation && row.status === QUEUE_STATUS.CLAIMED && Number.isFinite(row.leaseUntil) && row.leaseUntil > nowMs;
}

/**
 * Run `write(tx, row)` only while this worker owns the claim; otherwise nothing.
 * @returns {Promise<{ outcome: 'written' | 'stale_generation', value?: unknown }>}
 */
export async function withOwnedClaim(db, { uid, etDate, generation, nowMs = () => Date.now(), label }, write) {
  const ref = queueRowRef(db, uid, etDate);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const row = snap.exists ? snap.data() : null;
    if (!ownsClaim(row, { generation, nowMs: nowMs() })) {
      console.warn('[huddle/queue] stale_generation', JSON.stringify({ etDate, label, generation }));
      return { outcome: 'stale_generation' };
    }
    const value = await write(tx, row, ref);
    return { outcome: 'written', value };
  });
}

/** Mark the row done (bumping the generation). Refused without the claim. */
export function markDone(db, { uid, etDate, generation, nowMs = () => Date.now() }) {
  return withOwnedClaim(db, { uid, etDate, generation, nowMs, label: 'done' }, (tx, row, ref) => {
    tx.update(ref, { status: QUEUE_STATUS.DONE, claimGeneration: generation + 1, leaseUntil: null, updatedAt: iso(nowMs()) });
  });
}

/**
 * A job failed. Below the cap the row goes back to `pending` (the lease cleared, the
 * generation bumped) for the next tick; at the cap it is `failed` and the record says why.
 * Refused without the claim.
 */
export function markAttemptFailed(db, { uid, etDate, generation, reason, nowMs = () => Date.now() }) {
  return withOwnedClaim(db, { uid, etDate, generation, nowMs, label: 'failed' }, async (tx, row, ref) => {
    const dayRef = huddleDayRef(db, uid, etDate);
    const terminal = (Number.isInteger(row.attempts) ? row.attempts : 0) >= MAX_ATTEMPTS;
    tx.update(ref, {
      status: terminal ? QUEUE_STATUS.FAILED : QUEUE_STATUS.PENDING,
      claimGeneration: generation + 1,
      leaseUntil: null,
      lastError: String(reason || 'unknown').slice(0, 200),
      updatedAt: iso(nowMs()),
    });
    if (terminal) {
      tx.set(dayRef, { uid, etDate, status: RECORD_STATUS.FAILED, generation: { failReason: String(reason || 'unknown').slice(0, 200), claimGeneration: generation }, updatedAt: iso(nowMs()) }, { merge: true });
    }
    return terminal ? 'failed' : 'pending';
  });
}

/**
 * Today's rows the reconcile pass visits (Q-W3): every published huddle (the publish marks it) and every confirmed plan
 * (the confirm transaction marks it), LEAST RECENTLY RECONCILED FIRST — a row never visited sorts first — so a pass that
 * runs out of budget starts the next tick where it stopped instead of on the same leading uids (review L1-3). Sorted in
 * memory: no index.
 */
export async function rowsToReconcile(db, { etDate }) {
  const snap = await db.collection(HUDDLE_QUEUE).where('etDate', '==', etDate).where('reconcile', '==', true).get();
  return snap.docs.map((d) => d.data()).filter((r) => typeof r.uid === 'string')
    .sort((a, b) => String(a.reconciledAt ?? '').localeCompare(String(b.reconciledAt ?? '')) || (a.uid < b.uid ? -1 : 1));
}

/**
 * Stamp a row's reconcile visit; a SETTLED day (its plan skipped or expired, or the session closed with nothing left to
 * retire or expire) leaves the reconcile set (review L1-3: the flag was never cleared). The collection is named literally
 * so the protected-stores scanner counts this write.
 */
export async function markReconciled(db, { uid, etDate, settled, nowMs = Date.now() }) {
  const at = iso(nowMs);
  await db.collection('huddleQueue').doc(queueRowId(uid, etDate)).update(settled ? { reconcile: false, reconciledAt: at, updatedAt: at } : { reconciledAt: at });
}
