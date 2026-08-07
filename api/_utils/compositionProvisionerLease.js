// api/_utils/compositionProvisionerLease.js
//
// Composition PR 4 — ledger item B2: lease/commit-fencing for the
// NONTRANSACTIONAL provisioners (casualClone.ensureCasualClone,
// trainingClone.ensureTrainingClones). Their multi-write flows (subcollection
// copies + doc sentinels) cannot ride one Firestore transaction, so the PR-2
// entry guard (assertWriteEpochOpen) only proved the epoch was open at ENTRY —
// a provisioner that read "open" could still land writes after the §8 close's
// watermark. B2 closes that gap with a REGISTERED LEASE the close DRAINS:
//
//   1. ACQUIRE (transactional): the provisioner registers a lease in the same
//      transaction that validates the epoch is open — a close landing between
//      the epoch read and the lease write forces a retry that observes the
//      closed epoch and REJECTS (the A41 serializable-read-set argument,
//      applied to the lease record itself).
//   2. HOLD: every write phase re-checks the lease is CURRENT (unexpired,
//      unreleased) — bounded conformance with a hard TTL deadline instead of
//      the old per-batch epoch re-read.
//   3. DRAIN: the §8 close writes state 'closing' (new acquisitions reject:
//      present-but-not-open), then WAITS until no active lease remains
//      (drainProvisionerLeases), then writes 'closed' — the watermark. So a
//      provisioner that read "open" either holds a lease (the close waits for
//      it) or hasn't acquired yet (its acquisition rejects). No write lands
//      after the watermark.
//
// TTL BACKSTOP, stated honestly: a provisioner that crashes mid-hold leaves a
// lease the drain would wait on forever — expiresAt bounds that wait. The
// price is a bounded conformance window: a provisioner stalled PAST its TTL
// must not write again (assertLeaseCurrent per phase enforces it in-process);
// a process stalled past TTL that skips the check is outside what any lease
// can promise — the B8 watermark scan is the backstop of record.
//
// DARK POSTURE (A23): with COMPOSITION_EPOCH_FENCE_ENABLED=false every helper
// returns a no-op lease before ANY read — zero added I/O, byte-identical
// production behavior until the runbook flips the fence.
//
// Leases live in a TOP-LEVEL collection (a B3 PROTECTED collection — the
// deny-by-default scan lists every writer of it). Release marks releasedAt
// rather than deleting, so the drain query never races a delete and the
// close's runbook log can archive the lease trail.

import { randomUUID } from 'node:crypto';
import { COMPOSITION_EPOCH_FENCE_ENABLED } from './compositionConfig.js';
import { writeEpochRef, EpochClosedError } from './compositionWriteEpoch.js';
import { ACTIVATION_COLLECTION, ACTIVATION_DOC_ID } from './compositionProductionLoader.js';

export const PROVISIONER_LEASE_COLLECTION = 'compositionProvisionerLeases';
export const PROVISIONER_LEASE_TTL_MS = 120_000;

export class ProvisionerLeaseExpiredError extends Error {
  constructor(leaseId, detail = 'expired') {
    super(`provisioner_lease_${detail}`);
    this.name = 'ProvisionerLeaseExpiredError';
    this.code = `provisioner_lease_${detail}`;
    this.leaseId = leaseId;
  }
}

export function provisionerLeaseRef(db, leaseId) {
  return db.collection(PROVISIONER_LEASE_COLLECTION).doc(leaseId);
}

/**
 * Acquire a provisioner lease. Transactionally validates the write epoch is
 * OPEN (absent = open ONLY pre-activation — once an activation record exists
 * an absent epoch doc FAILS CLOSED, B1 parity with validateWriteEpochInTx;
 * present-but-not-open — incl. 'closing' — rejects) and registers the lease
 * in the same transaction.
 *
 * @returns {Promise<{dark:boolean, leaseId:string|null, epochId:string|null, expiresAtMs:number|null}>}
 * @throws {EpochClosedError} when the epoch is not open.
 */
export async function acquireProvisionerLease(db, { holder, now = new Date(), ttlMs = PROVISIONER_LEASE_TTL_MS, enabled = COMPOSITION_EPOCH_FENCE_ENABLED } = {}) {
  if (!enabled) return { dark: true, leaseId: null, epochId: null, expiresAtMs: null }; // zero reads (A23)
  if (typeof holder !== 'string' || holder.length === 0) throw new Error('acquireProvisionerLease: holder required');
  // §2 review F8: a random suffix — two same-holder acquisitions in the same
  // millisecond (the contemplated double-tap) must never share a lease doc.
  const leaseId = `${holder}-${now.getTime()}-${randomUUID().slice(0, 8)}`;
  const expiresAtMs = now.getTime() + ttlMs;
  const epochId = await db.runTransaction(async (tx) => {
    const snap = await tx.get(writeEpochRef(db));
    const data = snap.exists ? snap.data() : null;
    if (!snap.exists) {
      // §2 pass-2 L2-7 (B1 parity): an absent epoch doc admits ONLY while no
      // activation record exists. Post-activation it fails CLOSED — the
      // highest-risk nontransactional identity-birthing writers must never be
      // the one boundary the activated world runs unfenced through.
      const act = await tx.get(db.collection(ACTIVATION_COLLECTION).doc(ACTIVATION_DOC_ID));
      if (act.exists) throw new EpochClosedError(null, 'absent_epoch_doc_post_activation');
    }
    if (data && data.state !== 'open') {
      throw new EpochClosedError(data.epochId ?? null, data.state ?? 'unrecognized');
    }
    await tx.set(provisionerLeaseRef(db, leaseId), {
      holder,
      epochId: data?.epochId ?? null,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
      releasedAt: null,
    });
    return data?.epochId ?? null;
  });
  return { dark: false, leaseId, epochId, expiresAtMs };
}

/**
 * Per-write-phase currency check (pure, no I/O): a provisioner stalled past
 * its TTL must abort instead of writing past a possible watermark.
 */
export function assertLeaseCurrent(lease, { now = new Date() } = {}) {
  if (!lease || lease.dark) return null;
  if (now.getTime() >= lease.expiresAtMs) {
    throw new ProvisionerLeaseExpiredError(lease.leaseId, 'expired');
  }
  return null;
}

/** Release the lease (marks releasedAt; the drain treats it as inactive). */
export async function releaseProvisionerLease(db, lease, { now = new Date() } = {}) {
  if (!lease || lease.dark || !lease.leaseId) return;
  try {
    // Inline chain (not provisionerLeaseRef) so the B3 deny-by-default scan
    // sees this write site — a helper-returned ref is invisible to it.
    await db.collection(PROVISIONER_LEASE_COLLECTION).doc(lease.leaseId).update({ releasedAt: now.toISOString() });
  } catch (err) {
    // Best-effort by design: an unreleased lease expires by TTL and the drain
    // proceeds. (Not a catalog event — the §5 fire-and-forget rule governs
    // capture writes, not control-plane cleanup; failure is LOGGED, bounded
    // by expiresAtMs, and never silent data loss.)
    console.warn(`[compositionProvisionerLease] release of ${lease.leaseId} failed (TTL backstop applies):`, err?.message);
  }
}

/** Active = neither released nor expired, as of `now`. */
export async function listActiveProvisionerLeases(db, { now = new Date() } = {}) {
  const snap = await db.collection(PROVISIONER_LEASE_COLLECTION).get();
  const active = [];
  for (const doc of snap.docs || []) {
    const d = doc.data();
    if (d.releasedAt) continue;
    if (typeof d.expiresAtMs === 'number' && now.getTime() >= d.expiresAtMs) continue;
    active.push({ leaseId: doc.id, ...d });
  }
  return active;
}

/**
 * The §8 close-side DRAIN: poll until no active lease remains. Call AFTER
 * writing state 'closing' (so no new lease can be acquired) and BEFORE
 * writing state 'closed' (the watermark). Injectable clock/sleep for tests;
 * the wait is bounded by the longest outstanding TTL plus one poll.
 *
 * @returns {Promise<{drained:true, waitedMs:number, polls:number}>}
 */
/**
 * §2 review F9: bound the registry. Released and long-expired leases are
 * PURGED at the runbook's unfreeze step (and may be purged any time) — the
 * keep-on-release semantics exist so the DRAIN never races a delete; once
 * the close is over, the trail has been archived in the runbook log and the
 * docs are dead weight.
 *
 * @returns {Promise<number>} purged count
 */
export async function purgeReleasedProvisionerLeases(db, { now = new Date(), expiredGraceMs = PROVISIONER_LEASE_TTL_MS } = {}) {
  const graceMs = Math.max(0, expiredGraceMs); // a negative grace could reach ACTIVE leases — clamp
  const snap = await db.collection(PROVISIONER_LEASE_COLLECTION).get();
  let purged = 0;
  for (const doc of snap.docs || []) {
    const d = doc.data();
    const released = !!d.releasedAt;
    const longExpired = typeof d.expiresAtMs === 'number' && now.getTime() >= d.expiresAtMs + graceMs;
    if (released || longExpired) {
      await db.collection(PROVISIONER_LEASE_COLLECTION).doc(doc.id).delete();
      purged += 1;
    }
  }
  return purged;
}

export async function drainProvisionerLeases(db, {
  nowFn = () => new Date(),
  pollMs = 1_000,
  timeoutMs = PROVISIONER_LEASE_TTL_MS + 30_000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const startMs = nowFn().getTime();
  let polls = 0;
  for (;;) {
    polls += 1;
    const active = await listActiveProvisionerLeases(db, { now: nowFn() });
    if (active.length === 0) {
      return { drained: true, waitedMs: nowFn().getTime() - startMs, polls };
    }
    if (nowFn().getTime() - startMs >= timeoutMs) {
      throw new Error(`drainProvisionerLeases: ${active.length} lease(s) still active after ${timeoutMs}ms — holders: ${active.map((l) => l.holder).join(', ')}`);
    }
    await sleep(pollMs);
  }
}
