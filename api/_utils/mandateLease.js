// api/_utils/mandateLease.js
//
// Spec 1 — Mandate Substrate — the per-book OWNER-TOKEN LEASE (§3.1, Q3).
//
// Q3 found the existing `evaluatingAt` lease inadequate for the mandate handler:
// timestamp-only, NO owner identity, releases UNCONDITIONALLY, and its 120s
// timeout sits under a 300s handler — the stale-writer race is real. This lease
// carries an owner token (invocation nonce); RELEASE AND RENEWAL are preconditioned
// on token match, so a stale invocation can never release or renew a lease a
// live one now holds.
//
// CORRECTNESS NEVER RESTS ON THE LEASE (§3.1). Every book mutation is a
// revision-preconditioned transaction (§3.5): a stale writer's commit fails on
// revision mismatch regardless of lock state. The lease exists only to prevent
// wasted duplicate work — two invocations doing the same eval — not to guarantee
// safety. It therefore does NOT increment `revision` (it is bookkeeping, not a
// book mutation), and it is never on the critical path for money correctness.

import { randomUUID } from 'node:crypto';
import { MANDATE_LEASE_TTL_MS } from './mandateConfig.js';

/** One nonce per handler invocation, reused across every book it sweeps. */
export function mintOwnerToken() {
  return `inv_${randomUUID()}`;
}

function toMs(v) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; }
  if (typeof v.toDate === 'function') return v.toDate().getTime(); // Firestore Timestamp
  return 0;
}

/**
 * Acquire (or re-acquire) the lease on a book for `ownerToken`. Transactional:
 *   • free / expired  → claimed by us.
 *   • held by us      → renewed (idempotent re-entry).
 *   • held by another and unexpired → NOT acquired.
 *
 * @returns {Promise<{ acquired: boolean, reason?: string, heldBy?: string }>}
 */
export async function acquireLease(db, mandateRef, ownerToken, { now = new Date(), ttlMs = MANDATE_LEASE_TTL_MS } = {}) {
  if (!ownerToken) throw new Error('acquireLease: ownerToken required');
  const nowMs = now.getTime();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(mandateRef);
    if (!snap.exists) return { acquired: false, reason: 'no_such_book' };
    const lease = snap.data().lease || null;
    if (lease && lease.ownerToken && lease.ownerToken !== ownerToken) {
      const expMs = toMs(lease.expiresAt);
      if (expMs > nowMs) return { acquired: false, reason: 'held', heldBy: lease.ownerToken };
    }
    tx.set(mandateRef, {
      lease: { ownerToken, acquiredAt: now, expiresAt: new Date(nowMs + ttlMs) },
    }, { merge: true });
    return { acquired: true };
  });
}

/**
 * Renew the lease — ONLY if we still hold it (precondition: token match). A stale
 * invocation whose token no longer matches renews nothing.
 *
 * @returns {Promise<{ renewed: boolean, reason?: string }>}
 */
export async function renewLease(db, mandateRef, ownerToken, { now = new Date(), ttlMs = MANDATE_LEASE_TTL_MS } = {}) {
  if (!ownerToken) throw new Error('renewLease: ownerToken required');
  const nowMs = now.getTime();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(mandateRef);
    if (!snap.exists) return { renewed: false, reason: 'no_such_book' };
    const lease = snap.data().lease || null;
    if (!lease || lease.ownerToken !== ownerToken) return { renewed: false, reason: 'not_owner' };
    tx.set(mandateRef, {
      lease: { ownerToken, acquiredAt: lease.acquiredAt ?? now, expiresAt: new Date(nowMs + ttlMs) },
    }, { merge: true });
    return { renewed: true };
  });
}

/**
 * Release the lease — ONLY if we hold it (precondition: token match). Never
 * stomps another owner's lease (the flaw Q3 flagged in the timestamp-only lease,
 * which released unconditionally).
 *
 * @returns {Promise<{ released: boolean, reason?: string }>}
 */
export async function releaseLease(db, mandateRef, ownerToken) {
  if (!ownerToken) throw new Error('releaseLease: ownerToken required');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(mandateRef);
    if (!snap.exists) return { released: false, reason: 'no_such_book' };
    const lease = snap.data().lease || null;
    if (!lease) return { released: true }; // already free
    if (lease.ownerToken !== ownerToken) return { released: false, reason: 'not_owner' };
    tx.set(mandateRef, { lease: null }, { merge: true });
    return { released: true };
  });
}
