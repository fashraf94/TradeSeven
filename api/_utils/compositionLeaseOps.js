// api/_utils/compositionLeaseOps.js
//
// The §8 runbook's PROVISIONER-LEASE OPERATIONS — step 1.9 (drain to the
// watermark) and step 8B (purge released) — as testable, db-injectable
// functions. `scripts/composition/lease-ops.js` is the thin CLI over this;
// the split follows the compositionRunbookGates.js precedent, so the runbook's
// behaviour is unit-proven rather than trusted to a script that only ever runs
// once, live, under time pressure.
//
// WHY THIS EXISTS (review finding R2, 2026-08-16). The runbook names
// `drainProvisionerLeases` at 1.9 and `purgeReleasedProvisionerLeases` at 8B,
// but NOTHING in the repo called either — no cron, no endpoint, no script. At
// the close the operator had no command to run and would have been hand-writing
// an invocation inside a closed epoch. Written NOW because step 1.2 pins THE
// ACTIVATION SHA and forbids any commit after it.
//
// EVERY FUNCTION HERE IS SAFE WITH THE EPOCH CLOSED — which is exactly when 1.9
// runs. That is not an assumption: none of the underlying helpers consults the
// write-epoch fence (they are Admin-SDK reads plus, for the mutating two, direct
// doc writes), and `compositionLeaseOps.test.js` proves it by running
// every operation against a seeded `{state:'closed'}` epoch doc.
//
// This module NEVER supplies `operator` or `reason` on the operator's behalf —
// a resolution is an attributed human act (#3), so the caller must pass both and
// the CLI refuses without them.

import {
  listUnreleasedProvisionerLeases,
  drainProvisionerLeases,
  purgeReleasedProvisionerLeases,
  resolveStuckProvisionerLease,
  StuckProvisionerLeaseError,
  PROVISIONER_LEASE_COLLECTION,
} from './compositionProvisionerLease.js';

export { PROVISIONER_LEASE_COLLECTION };

/** The CLI path, used to pre-fill runnable commands in reports. */
export const LEASE_OPS_SCRIPT = 'scripts/composition/lease-ops.js';

/**
 * One report row per unreleased lease.
 *
 * `stuck` is NOT re-derived here — it is taken from which bucket
 * listUnreleasedProvisionerLeases put the lease in, so this report and the
 * drain's refusal can never disagree about what "stuck" means. (Re-deriving the
 * predicate is the display-disagreement bug family, BUILD_RULES §9.)
 */
function toRow(lease, stuck) {
  return {
    leaseId: lease.leaseId,
    holder: lease.holder ?? null,
    epochId: lease.epochId ?? null,
    acquiredAt: lease.acquiredAt ?? null,
    expiresAt: lease.expiresAt ?? null,
    expiresAtMs: typeof lease.expiresAtMs === 'number' ? lease.expiresAtMs : null,
    stuck,
  };
}

/**
 * Subcommand 1 — LIST. Pure read.
 * @returns {Promise<{ranAt:string, activeCount:number, stuckCount:number, rows:object[]}>}
 */
export async function listLeases(db, { now = new Date() } = {}) {
  const { active, stuck } = await listUnreleasedProvisionerLeases(db, { now });
  const rows = [
    ...stuck.map((l) => toRow(l, true)),
    ...active.map((l) => toRow(l, false)),
  ].sort((a, b) => String(a.acquiredAt ?? '').localeCompare(String(b.acquiredAt ?? '')));
  return { ranAt: now.toISOString(), activeCount: active.length, stuckCount: stuck.length, rows };
}

/**
 * The exact, RUNNABLE resolution command for a stuck lease. Operator and reason
 * are left as placeholders on purpose — #3 requires a named human to declare the
 * holder dead, and this tool must never appear to have made that call.
 */
export function resolveCommandFor(leaseId) {
  return `node ${LEASE_OPS_SCRIPT} resolve --lease-id ${leaseId} `
    + '--operator "<your name>" --reason "<why the holder is known dead>" --apply';
}

/**
 * Subcommand 2, DRY-RUN half — one classification pass, no polling, no writes.
 * Reports what a real drain would do right now. Deliberately does NOT block for
 * up to timeoutMs, so a rehearsal is instant.
 */
export async function previewDrain(db, { now = new Date() } = {}) {
  const { active, stuck } = await listUnreleasedProvisionerLeases(db, { now });
  if (stuck.length > 0) {
    return {
      verdict: 'WOULD_REFUSE',
      reason: 'stuck lease(s) — expired but never released; the drain refuses until each is explicitly resolved (#3)',
      stuck: stuck.map((l) => toRow(l, true)),
      active: active.map((l) => toRow(l, false)),
      resolveCommands: stuck.map((l) => resolveCommandFor(l.leaseId)),
    };
  }
  if (active.length === 0) return { verdict: 'WOULD_DRAIN_IMMEDIATELY', stuck: [], active: [], resolveCommands: [] };
  return {
    verdict: 'WOULD_WAIT',
    reason: `${active.length} lease(s) still held and unexpired; the drain polls until they release or their TTL passes`,
    stuck: [],
    active: active.map((l) => toRow(l, false)),
    resolveCommands: [],
  };
}

/**
 * Subcommand 2, LIVE half — the step-1.9 call.
 *
 * Performs NO writes of its own: it polls the registry until nothing is active.
 * A StuckProvisionerLeaseError is caught and returned as STRUCTURED refusal —
 * holders named, with a pre-filled resolution command each — rather than an
 * opaque throw at the worst possible moment.
 */
export async function runDrain(db, { now = new Date(), nowFn, pollMs, timeoutMs, sleep } = {}) {
  const opts = {};
  // The drain classifies against ITS OWN clock. Injectable so a test can place
  // the registry at a chosen instant; production passes nothing and gets the
  // real clock, which is correct — a lease TTL is wall-clock (finding R1).
  if (nowFn !== undefined) opts.nowFn = nowFn;
  if (pollMs !== undefined) opts.pollMs = pollMs;
  if (timeoutMs !== undefined) opts.timeoutMs = timeoutMs;
  if (sleep !== undefined) opts.sleep = sleep;
  try {
    const result = await drainProvisionerLeases(db, opts);
    return { verdict: 'DRAINED', ...result };
  } catch (err) {
    if (err instanceof StuckProvisionerLeaseError || err?.code === 'provisioner_lease_stuck') {
      const stuck = (err.stuck ?? []).map((l) => toRow(l, true));
      return {
        verdict: 'REFUSED',
        code: 'provisioner_lease_stuck',
        message: err.message,
        stuck,
        resolveCommands: stuck.map((l) => resolveCommandFor(l.leaseId)),
      };
    }
    return { verdict: 'FAILED', code: err?.code ?? null, message: err?.message ?? String(err), now: now.toISOString() };
  }
}

/**
 * Subcommand 3 — PURGE released (step 8B). Deletes ONLY leases carrying
 * releasedAt; an expired-but-unreleased lease is never purged (purging it would
 * destroy exactly the signal the drain refuses on — Sol review #3).
 *
 * `operator` is required by the CALLER for the run record; the underlying helper
 * takes none because a delete leaves nothing to stamp. Attribution therefore
 * lives in the report artifact, which is why the CLI refuses --apply without it.
 */
export async function runPurge(db, { operator }) {
  if (typeof operator !== 'string' || !operator.trim()) {
    throw new Error('runPurge: operator required (the purge is an attributed act; the deleted docs cannot carry the stamp themselves)');
  }
  const before = await listUnreleasedProvisionerLeases(db);
  const purged = await purgeReleasedProvisionerLeases(db);
  const after = await listUnreleasedProvisionerLeases(db);
  return {
    verdict: 'PURGED',
    purged,
    operator,
    // Proof the purge touched only released docs: the unreleased population is
    // identical either side of it.
    unreleasedBefore: before.active.length + before.stuck.length,
    unreleasedAfter: after.active.length + after.stuck.length,
  };
}

/** Subcommand 4 — RESOLVE one stuck lease. Attributed; #3's explicit act. */
export async function runResolve(db, leaseId, { operator, reason, now = new Date() }) {
  if (typeof leaseId !== 'string' || !leaseId.trim()) throw new Error('runResolve: --lease-id required');
  if (typeof operator !== 'string' || !operator.trim()) throw new Error('runResolve: --operator required (#3: a named human declares the holder dead)');
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('runResolve: --reason required (#3: the log records WHY)');
  const result = await resolveStuckProvisionerLease(db, leaseId, { operator, reason, now });
  return { verdict: 'RESOLVED', ...result, operator, reason };
}
