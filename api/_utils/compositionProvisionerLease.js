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
// TTL SEMANTICS (Sol pre-activation review #3 — the straddle closed): the
// TTL bounds the HOLDER's write authority in-process (assertLeaseCurrent per
// phase refuses past expiry), but an expired-but-UNRELEASED lease is NEVER
// treated as drained — a process stalled past its TTL may still be mid-copy
// between checks, and completing the drain over it would let writes land
// after the watermark. The drain REFUSES on such a lease (StuckProvisioner-
// LeaseError, holders named): the operator must verify the holder process is
// actually dead (the platform's max function lifetime bounds this) and then
// resolve it EXPLICITLY (resolveStuckProvisionerLease — a named, attributed
// release). The B8 watermark scan remains the backstop of record.
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

/** #3: an expired-but-unreleased lease — the drain refuses; explicit resolution required. */
export class StuckProvisionerLeaseError extends Error {
  constructor(stuck) {
    super(`provisioner_lease_stuck: ${stuck.map((l) => `${l.holder} (${l.leaseId})`).join(', ')} — expired without release; verify the holder process is dead, then resolveStuckProvisionerLease`);
    this.name = 'StuckProvisionerLeaseError';
    this.code = 'provisioner_lease_stuck';
    this.stuck = stuck;
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

/**
 * Classify the registry as of `now`: `active` = unreleased + unexpired
 * (the drain waits on these), `stuck` = unreleased + EXPIRED (#3: the drain
 * REFUSES on these — never auto-drained).
 */
export async function listUnreleasedProvisionerLeases(db, { now = new Date() } = {}) {
  const snap = await db.collection(PROVISIONER_LEASE_COLLECTION).get();
  const active = [];
  const stuck = [];
  for (const doc of snap.docs || []) {
    const d = doc.data();
    if (d.releasedAt) continue;
    const expired = typeof d.expiresAtMs === 'number' && now.getTime() >= d.expiresAtMs;
    (expired ? stuck : active).push({ leaseId: doc.id, ...d });
  }
  return { active, stuck };
}

/** Active = neither released nor expired, as of `now`. */
export async function listActiveProvisionerLeases(db, { now = new Date() } = {}) {
  return (await listUnreleasedProvisionerLeases(db, { now })).active;
}

/**
 * #3: the EXPLICIT resolution for a stuck (expired-but-unreleased) lease.
 * Only callable on a lease that is genuinely stuck — a live lease refuses
 * (the holder may still be writing). Marks the release ATTRIBUTED
 * (resolvedBy/resolvedReason) so the runbook log carries who declared the
 * holder dead and why; the drain then completes normally.
 */
export async function resolveStuckProvisionerLease(db, leaseId, { operator, reason, now = new Date() } = {}) {
  if (typeof operator !== 'string' || !operator) throw new Error('resolveStuckProvisionerLease: operator required');
  if (typeof reason !== 'string' || !reason) throw new Error('resolveStuckProvisionerLease: reason required');
  const ref = db.collection(PROVISIONER_LEASE_COLLECTION).doc(leaseId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`resolveStuckProvisionerLease: no lease ${leaseId}`);
  const d = snap.data();
  if (d.releasedAt) throw new Error(`resolveStuckProvisionerLease: ${leaseId} is already released`);
  if (!(typeof d.expiresAtMs === 'number' && now.getTime() >= d.expiresAtMs)) {
    throw new Error(`resolveStuckProvisionerLease: ${leaseId} has not expired — the holder may still be writing (resolution is for DEAD holders only)`);
  }
  await db.collection(PROVISIONER_LEASE_COLLECTION).doc(leaseId).update({
    releasedAt: now.toISOString(), resolvedBy: operator, resolvedReason: reason,
  });
  return { resolved: true, leaseId, holder: d.holder };
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
 * §2 review F9, narrowed by Sol review #3: bound the registry by purging
 * RELEASED leases ONLY (at the runbook's unfreeze step, or any time). An
 * expired-but-unreleased lease is NEVER purged — it is an unresolved stuck
 * holder the drain must refuse on; purging it would hide exactly that
 * signal. Resolve it first (resolveStuckProvisionerLease), then purge. The
 * keep-on-release semantics exist so the DRAIN never races a delete.
 *
 * @returns {Promise<number>} purged count
 */
export async function purgeReleasedProvisionerLeases(db) {
  const snap = await db.collection(PROVISIONER_LEASE_COLLECTION).get();
  let purged = 0;
  for (const doc of snap.docs || []) {
    if (!doc.data().releasedAt) continue; // unreleased — active OR stuck; never purged
    await db.collection(PROVISIONER_LEASE_COLLECTION).doc(doc.id).delete();
    purged += 1;
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
    const { active, stuck } = await listUnreleasedProvisionerLeases(db, { now: nowFn() });
    if (stuck.length > 0) {
      // #3: expired-but-unreleased is NOT drained — the holder may be
      // stalled mid-copy between currency checks. REFUSE, name the holders,
      // require explicit resolution (the runbook STOP).
      throw new StuckProvisionerLeaseError(stuck);
    }
    if (active.length === 0) {
      return { drained: true, waitedMs: nowFn().getTime() - startMs, polls };
    }
    if (nowFn().getTime() - startMs >= timeoutMs) {
      throw new Error(`drainProvisionerLeases: ${active.length} lease(s) still active after ${timeoutMs}ms — holders: ${active.map((l) => l.holder).join(', ')}`);
    }
    await sleep(pollMs);
  }
}
