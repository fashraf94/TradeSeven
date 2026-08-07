// api/_utils/compositionActivationService.js
//
// Composition PR 4 — THE ACTIVATION RECORD SERVICE (ledger items B4, M6,
// B1-EXT parts 1–2; R6-B1; A48). The activation record is the SOLE authority
// for the composed identity: one document
// (composition/activation — ACTIVATION_COLLECTION/ACTIVATION_DOC_ID), the
// FULL 7-field descriptor:
//
//   { activeIdentityVersion, boundaryStateVersion, activeEpochId,
//     candidateStateId, semanticHash, activationGeneration, overrideRevision }
//
// No standalone selector exists anywhere (A48) — every consumer reads THIS
// record through the B5 loader; a malformed record fails closed there.
// boundaryStateVersion (founder Q1 ruling, Aug 7 2026): the integer version
// of the per-boundary enforcement-state set — 1 at first activation; any
// change to the active-boundary set or its semantics mints a NEW
// activationGeneration (the descriptor never mutates in place); rollback
// carries the PRIOR value (it travels with its descriptor); A34's check
// compares it against each boundary's compile-time
// SUPPORTED_BOUNDARY_STATE_VERSIONS declaration (compositionWriteEpoch.js).
//
// WRITE DISCIPLINE (B4 + B1-EXT part 1): activationGeneration STRICTLY
// increases on every activation / rollback / reactivation — the writer mints
// current+1 inside the transaction, so no full tuple can ever repeat (the
// generation differs by construction) and a stamped derived write can never
// pass reader validation under a reused number. Every write appends the full
// prior-inclusive tuple to the compositionActivationHistory subcollection
// (append-only, create()-guarded) — the runbook's rollback reads the prior
// tuple FROM history and repoints it atomically.
//
// ACTIVATION VERIFICATION (R6-B1 + M6), INSIDE the same transaction:
//   R6-B1 — the given candidateStateId + semanticHash must match the
//     candidate run doc (mismatch aborts, nothing repointed);
//   M6   — the candidate namespace itself verifies BEFORE ratification:
//     exact entryCount match, recomputed semantic hash equals the stored
//     hash, no stale extra entries, and entry ids are create-only-consistent
//     (every doc id is the injective entryDocId of its own entryKey).
//   Each defect class aborts with a named error; nothing is repointed.
//
// OVERRIDE REVISION (B1-EXT part 2): every logical mutation of the mutable
// active-epoch override layer calls bumpOverrideRevisionInTx IN ITS OWN
// TRANSACTION — the token moves with the data, so a mid-read override edit
// at the SAME generation forces a B5 seqlock retry.

import {
  ACTIVATION_COLLECTION, ACTIVATION_DOC_ID, ACTIVATION_DESCRIPTOR_FIELDS,
} from './compositionProductionLoader.js';
import { computeOverlaySemanticHash, entryDocId } from './compositionStateResolver.js';
import { ARCHETYPE_IDENTITY_VERSION } from './archetypeVersionConstants.js';

export const ACTIVATION_HISTORY_SUBCOLLECTION = 'compositionActivationHistory';
export const CANDIDATE_STATE_COLLECTION = 'compositionCandidateState';

export class ActivationAbortError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'ActivationAbortError';
    this.code = code;
  }
}

export function activationRef(db) {
  return db.collection(ACTIVATION_COLLECTION).doc(ACTIVATION_DOC_ID);
}

function validateTupleContent({ activeIdentityVersion, boundaryStateVersion, activeEpochId, candidateStateId, semanticHash }) {
  if (!Number.isInteger(activeIdentityVersion) || activeIdentityVersion < 1) throw new ActivationAbortError('activation_invalid_input', `activeIdentityVersion=${activeIdentityVersion}`);
  if (!Number.isInteger(boundaryStateVersion) || boundaryStateVersion < 1) throw new ActivationAbortError('activation_invalid_input', `boundaryStateVersion=${boundaryStateVersion}`);
  if (typeof activeEpochId !== 'string' || !activeEpochId) throw new ActivationAbortError('activation_invalid_input', 'activeEpochId required');
  if (typeof candidateStateId !== 'string' || !candidateStateId) throw new ActivationAbortError('activation_invalid_input', 'candidateStateId required');
  if (typeof semanticHash !== 'string' || !semanticHash) throw new ActivationAbortError('activation_invalid_input', 'semanticHash required');
}

/**
 * M6 + R6-B1: verify the candidate namespace INSIDE the activation
 * transaction. Reads the run doc and EVERY entry through the transaction so
 * the ratified state is exactly the committed state.
 */
async function verifyCandidateInTx(tx, db, { candidateStateId, semanticHash }) {
  const runSnap = await tx.get(db.collection(CANDIDATE_STATE_COLLECTION).doc(candidateStateId));
  if (!runSnap.exists) throw new ActivationAbortError('activation_candidate_missing', `no candidate run doc ${candidateStateId}`);
  const run = runSnap.data();
  // R6-B1: the descriptor's semantic identity must equal the candidate manifest's.
  if (run.semanticHash !== semanticHash) {
    throw new ActivationAbortError('activation_semantic_hash_mismatch', `descriptor ${semanticHash} ≠ candidate ${run.semanticHash}`);
  }
  const entriesSnap = await tx.get(db.collection(CANDIDATE_STATE_COLLECTION).doc(candidateStateId).collection('entries'));
  const entries = (entriesSnap.docs || []).map((d) => ({ id: d.id, ...d.data() }));
  // M6: exact count — a missing entry AND a stale extra both surface here.
  if (entries.length !== run.entryCount) {
    throw new ActivationAbortError('activation_entry_count_mismatch', `found ${entries.length}, run doc pins ${run.entryCount}`);
  }
  // M6: create-only id consistency — every doc id IS the injective id of its
  // own entryKey (an overwritten/foreign doc cannot masquerade as an entry).
  for (const e of entries) {
    if (entryDocId(e.entryKey) !== e.id) {
      throw new ActivationAbortError('activation_entry_id_mismatch', `doc ${e.id} does not match its entryKey`);
    }
  }
  // M6: recomputed content hash equals the stored hash (semantic form — the
  // runId-independent identity the founder ratified at FINAL-DRYRUN).
  const recomputed = computeOverlaySemanticHash(entries.map(({ id, ...e }) => e));
  if (recomputed !== run.semanticHash) {
    throw new ActivationAbortError('activation_entry_hash_mismatch', `recomputed ${recomputed} ≠ stored ${run.semanticHash}`);
  }
  return run;
}

async function writeDescriptorInTx(tx, db, current, tuple) {
  const activationGeneration = (current?.activationGeneration ?? 0) + 1; // strict monotonicity — MAX+1, never a reuse
  const descriptor = { ...tuple, activationGeneration };
  for (const f of ACTIVATION_DESCRIPTOR_FIELDS) {
    if (descriptor[f] === undefined) throw new ActivationAbortError('activation_invalid_input', `descriptor field missing: ${f}`);
  }
  await tx.set(activationRef(db), descriptor);
  // Append-only history: the rollback source of record. create() so a
  // generation can never be silently rewritten.
  await tx.create(
    activationRef(db).collection(ACTIVATION_HISTORY_SUBCOLLECTION).doc(String(activationGeneration)),
    { ...descriptor, recordedAt: tuple.recordedAt ?? null },
  );
  return descriptor;
}

/**
 * THE ACTIVATION WRITE (runbook step 7). Verifies the candidate namespace
 * (M6) and the semantic identity binding (R6-B1) inside the SAME transaction
 * that repoints the record; any defect aborts with nothing repointed.
 *
 * @returns {Promise<descriptor>} the descriptor as written.
 */
export async function writeActivationRecord(db, {
  activeIdentityVersion, boundaryStateVersion = 1, activeEpochId,
  candidateStateId, semanticHash, recordedAt = null,
}) {
  validateTupleContent({ activeIdentityVersion, boundaryStateVersion, activeEpochId, candidateStateId, semanticHash });
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(activationRef(db));
    const current = snap.exists ? snap.data() : null;
    if (current && current.activeEpochId === activeEpochId) {
      // A49: any (re)activation mints a FRESH epoch so abandoned overrides
      // can never resurrect — reusing the live epoch id is a defect.
      throw new ActivationAbortError('activation_epoch_reuse', `epoch ${activeEpochId} is already the active epoch`);
    }
    await verifyCandidateInTx(tx, db, { candidateStateId, semanticHash });
    return writeDescriptorInTx(tx, db, current, {
      activeIdentityVersion, boundaryStateVersion, activeEpochId,
      candidateStateId, semanticHash, overrideRevision: 0, recordedAt,
    });
  });
}

/**
 * ROLLBACK (runbook §10 / A29/A45/A49): atomically repoint the COMPLETE
 * prior tuple — read from the append-only history, never hand-assembled —
 * under a NEW strictly-greater generation. boundaryStateVersion travels with
 * its descriptor (the Q1 ruling: the PRIOR value, always). The abandoned
 * epoch's overrides stop resolving because activeEpochId repoints; they are
 * retained, never deleted.
 *
 * @param toGeneration the history generation whose tuple is being restored.
 */
export async function rollbackActivationRecord(db, { toGeneration, recordedAt = null }) {
  if (!Number.isInteger(toGeneration) || toGeneration < 1) throw new ActivationAbortError('activation_invalid_input', `toGeneration=${toGeneration}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(activationRef(db));
    if (!snap.exists) throw new ActivationAbortError('activation_rollback_no_record', 'nothing to roll back');
    const current = snap.data();
    if (toGeneration >= current.activationGeneration) {
      throw new ActivationAbortError('activation_rollback_not_prior', `generation ${toGeneration} is not prior to ${current.activationGeneration}`);
    }
    const priorSnap = await tx.get(activationRef(db).collection(ACTIVATION_HISTORY_SUBCOLLECTION).doc(String(toGeneration)));
    if (!priorSnap.exists) throw new ActivationAbortError('activation_rollback_unknown_generation', `no history for generation ${toGeneration}`);
    const prior = priorSnap.data();
    // The COMPLETE tuple repoints together — every content field from the
    // prior descriptor, a fresh strictly-greater generation, overrideRevision
    // reset (the restored epoch's override token restarts; the abandoned
    // epoch's overrides are out of resolution entirely).
    return writeDescriptorInTx(tx, db, current, {
      activeIdentityVersion: prior.activeIdentityVersion,
      boundaryStateVersion: prior.boundaryStateVersion, // Q1: the prior value, always
      activeEpochId: prior.activeEpochId,
      candidateStateId: prior.candidateStateId,
      semanticHash: prior.semanticHash,
      overrideRevision: 0,
      recordedAt,
    });
  });
}

/**
 * B1-EXT part 2: increment the override-consistency token ATOMICALLY with a
 * logical mutation of the active-epoch override layer. Call INSIDE the same
 * transaction that writes the override entry; the caller must have read the
 * record in the SAME transaction (pass that snapshot's data here).
 */
export async function bumpOverrideRevisionInTx(tx, db, currentDescriptor) {
  if (!currentDescriptor || !Number.isInteger(currentDescriptor.overrideRevision)) {
    throw new ActivationAbortError('override_revision_no_record', 'override writes require an activation record read in the same transaction');
  }
  await tx.update(activationRef(db), { overrideRevision: currentDescriptor.overrideRevision + 1 });
  return currentDescriptor.overrideRevision + 1;
}

/**
 * A24 seam: which identity version does a descriptor select? Absent record
 * (null) → the LIVE version — the pre-activation world, byte-identical
 * births. The record is the ONLY thing that can select the candidate (A48).
 */
export function selectIdentityVersion(descriptor) {
  return descriptor?.activeIdentityVersion ?? ARCHETYPE_IDENTITY_VERSION;
}
