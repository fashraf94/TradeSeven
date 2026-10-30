// api/_utils/setupEvidence/store.js
//
// ID-1 Build 1 — THE PROTOCOL (shape note V1.4 §3, "Create-once, the lease and
// the confirmation record"). Two server-only collections:
//
//   setupEvidence/{id}        the final snapshot. Written only by `tx.create`,
//                             never updated; a lost race reads the winner. Its
//                             correctness never depends on the lease.
//   setupEvidenceClaims/{id}  the mutable state: `lease { token, claimedAt, host }`
//                             or null ("I am fetching this", 120 seconds), the
//                             `observation { reason, detailHash, observedAt }` or
//                             null, and `attempts`, `lastAttemptAt`. It stays after
//                             the snapshot is final, with its lease cleared, so
//                             attempts can be counted apart from completed snapshots.
//
// THE TOKEN. A claim carries a unique token and every later claim mutation is a
// transaction that checks it, so a worker whose lease expired and was taken over
// can neither release nor overwrite its successor's lease or observation. It may
// still create the final document if no one has: the `create` decides.
//
// THE OBSERVATION. Releasing a lease preserves it. A matching result keeps the
// original `observedAt`; a different reason or detail replaces it; a matching
// result from a fetch that STARTED at least 30 minutes after `observedAt` makes the
// outcome final, so the two provider samples really are that far apart. No call
// ever waits: a later caller makes the confirming fetch.
//
// `observedAt` is the first fetch's `fetchedAt`. An unreadable one matches nothing
// and is replaced.

import { randomUUID } from 'node:crypto';
import { readClock } from './acquire.js';

/** "I am fetching this." */
export const LEASE_MS = 120_000;
/** The gap between the two samples of a confirmed refusal. */
export const CONFIRM_AFTER_MS = 30 * 60_000;
/** gRPC ALREADY_EXISTS: a `create` that lost its race. */
const ALREADY_EXISTS = 6;

/** Live within the lease on either side of `nowMs`: a stamp far in the future is no lease, so it can never block forever. */
function leaseIsLive(lease, nowMs) {
  const age = nowMs - Date.parse(lease?.claimedAt);
  return Number.isFinite(age) && Math.abs(age) < LEASE_MS;
}

/** The final snapshot, read only. */
export async function readFinal({ db, id }) {
  const snap = await db.collection('setupEvidence').doc(id).get();
  return snap.exists ? snap.data() : null;
}

/**
 * ONE transaction: a final snapshot → it; a live lease → pending, no fetch; else
 * the lease is taken (over an expired one, if any), the observation kept and the
 * attempt counted.
 *
 * @returns {Promise<{ status: 'final', snapshot: object } | { status: 'pending' } | { status: 'claimed', token: string }>}
 */
export async function claimSnapshot({ db, id, now, host }) {
  const finalRef = db.collection('setupEvidence').doc(id);
  const claimRef = db.collection('setupEvidenceClaims').doc(id);
  return db.runTransaction(async (tx) => {
    const finalSnap = await tx.get(finalRef);
    if (finalSnap.exists) return { status: 'final', snapshot: finalSnap.data() };
    const claimSnap = await tx.get(claimRef);
    const claim = claimSnap.exists ? claimSnap.data() : null;
    const at = readClock(now);
    if (leaseIsLive(claim?.lease, at.getTime())) return { status: 'pending' };
    const token = randomUUID();
    const stamp = at.toISOString();
    tx.set(claimRef, {
      lease: { token, claimedAt: stamp, host: host ?? null },
      observation: claim?.observation ?? null,
      attempts: (Number.isInteger(claim?.attempts) ? claim.attempts : 0) + 1,
      lastAttemptAt: stamp,
    });
    return { status: 'claimed', token };
  });
}

/** Release our lease, the observation and the count untouched. A token that is no longer ours changes nothing. */
export async function releaseClaimLease({ db, id, token }) {
  const claimRef = db.collection('setupEvidenceClaims').doc(id);
  await db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists || claimSnap.data().lease?.token !== token) return;
    tx.set(claimRef, { ...claimSnap.data(), lease: null });
  });
}

/** After a `create` lost a race the transaction's own read did not see: the winner is the snapshot. */
async function winnerAfter(err, { db, id }) {
  if (err?.code !== ALREADY_EXISTS) throw err;
  const winner = await readFinal({ db, id });
  if (!winner) throw err;
  return winner;
}

/**
 * ONE transaction: the final document by `create`, or the winner's if it exists;
 * our lease is released in the same commit. @returns {Promise<object>} the snapshot
 */
export async function createFinal({ db, id, token, doc }) {
  const finalRef = db.collection('setupEvidence').doc(id);
  const claimRef = db.collection('setupEvidenceClaims').doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const finalSnap = await tx.get(finalRef);
      const claimSnap = await tx.get(claimRef);
      if (claimSnap.exists && claimSnap.data().lease?.token === token) tx.set(claimRef, { ...claimSnap.data(), lease: null });
      if (finalSnap.exists) return finalSnap.data();
      tx.create(finalRef, doc);
      return doc;
    });
  } catch (err) {
    return winnerAfter(err, { db, id });
  }
}

/**
 * ONE transaction for a `confirm` outcome: a reproduced result from a separate
 * fetch at least 30 minutes on is created as final (by a worker that lost its
 * lease too: the `create` decides); otherwise the observation is kept or replaced
 * and the lease released, both only under our token.
 *
 * @returns {Promise<{ status: 'final', snapshot: object } | { status: 'retryable', reason: string }>}
 */
export async function settleConfirmation({ db, id, token, reason, detailHash, acquired, doc }) {
  const finalRef = db.collection('setupEvidence').doc(id);
  const claimRef = db.collection('setupEvidenceClaims').doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const finalSnap = await tx.get(finalRef);
      const claimSnap = await tx.get(claimRef);
      const claim = claimSnap.exists ? claimSnap.data() : null;
      const ours = claim?.lease?.token === token;
      if (finalSnap.exists) {
        if (ours) tx.set(claimRef, { ...claim, lease: null });
        return { status: 'final', snapshot: finalSnap.data() };
      }
      const observed = claim?.observation ?? null;
      const observedAtMs = Date.parse(observed?.observedAt);
      const matches = observed?.reason === reason && observed?.detailHash === detailHash && Number.isFinite(observedAtMs);
      if (matches && acquired.requestStartedAtMs - observedAtMs >= CONFIRM_AFTER_MS) {
        if (ours) tx.set(claimRef, { ...claim, lease: null });
        tx.create(finalRef, doc);
        return { status: 'final', snapshot: doc };
      }
      if (ours) tx.set(claimRef, { ...claim, lease: null, observation: matches ? observed : { reason, detailHash, observedAt: acquired.fetchedAt } });
      return { status: 'retryable', reason };
    });
  } catch (err) {
    return { status: 'final', snapshot: await winnerAfter(err, { db, id }) };
  }
}
