// api/_utils/compositionWriteEpoch.js
//
// Composition PR 2 — the write-epoch fence (R5-B2/R7-B2; design note §3).
//
// THE MECHANISM (A41): the epoch control doc is read INSIDE each writer's
// transaction, in the read phase. Firestore transactions are serializable over
// their read set, so a §8 runbook close that lands between a writer's read and
// its commit forces the transaction to retry, re-read the closed epoch, and
// REJECT — an old-epoch write cannot commit after the watermark. Rejection is
// the guarantee; the scan watermark is the backstop.
//
// DARK POSTURE (A23): with COMPOSITION_EPOCH_FENCE_ENABLED=false every helper
// returns before ANY read — zero added I/O, byte-identical behavior (the
// MASTERY_ENFORCEMENT_ENABLED zero-I/O-while-dark precedent,
// equip-bundle.js:112-115). The doc-absent state is also OPEN (fail-open):
// the fence only bites once the §8 runbook writes {state:'closed'}.
//
// Client-SDK writers are fenced at the RULES LAYER (epochWriteOpen() in
// firestore.rules — inert until Console deploy); background loops call
// assertWriteEpochOpen per batch. See the design note's writer-class table
// and compositionWriterCensus.json (test A46).

import { COMPOSITION_EPOCH_FENCE_ENABLED } from './compositionConfig.js';

/** The epoch control doc (design note §2). Absent ⇒ open. */
export const WRITE_EPOCH_COLLECTION = 'composition';
export const WRITE_EPOCH_DOC_ID = 'writeEpoch';

export class EpochClosedError extends Error {
  constructor(epochId = null) {
    super('epoch_closed');
    this.name = 'EpochClosedError';
    this.code = 'epoch_closed';
    this.epochId = epochId;
  }
}

export function writeEpochRef(db) {
  return db.collection(WRITE_EPOCH_COLLECTION).doc(WRITE_EPOCH_DOC_ID);
}

/**
 * Transactional commit-time validation — call in the READ PHASE of a writer's
 * existing transaction (Firestore requires reads before writes). Throws
 * EpochClosedError when the epoch is closed; endpoints map it to a 409 with
 * nothing written.
 *
 * When `sentinel` is provided (the endpoints' `SENTINEL_PREFIX` pattern), a
 * closed epoch throws `Error(sentinel + 'epoch_closed')` so the endpoint's
 * existing catch maps it through SENTINEL_TO_HTTP (409, nothing written).
 *
 * @returns {null | {state:string, epochId:string|null}} null while dark.
 */
export async function validateWriteEpochInTx(tx, db, { enabled = COMPOSITION_EPOCH_FENCE_ENABLED, sentinel = null } = {}) {
  if (!enabled) return null; // dark: zero reads, zero behavior change (A23)
  const snap = await tx.get(writeEpochRef(db));
  if (!snap.exists) return { state: 'open', epochId: null };
  const data = snap.data();
  if (data.state === 'closed') {
    if (sentinel) throw new Error(sentinel + 'epoch_closed');
    throw new EpochClosedError(data.epochId ?? null);
  }
  return { state: data.state ?? 'open', epochId: data.epochId ?? null };
}

/**
 * Non-transactional guard for background loops and admin scripts — called at
 * entry AND per batch/agent iteration (bounded conformance: a loop straddling
 * the close stops at the next boundary; the runbook pause is the second belt).
 */
export async function assertWriteEpochOpen(db, { enabled = COMPOSITION_EPOCH_FENCE_ENABLED } = {}) {
  if (!enabled) return null;
  const snap = await writeEpochRef(db).get();
  if (snap.exists && snap.data().state === 'closed') throw new EpochClosedError(snap.data().epochId ?? null);
  return null;
}
