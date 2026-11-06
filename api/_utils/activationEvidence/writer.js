// api/_utils/activationEvidence/writer.js
//
// ID-1 Build 2 — WRITING A POINTER (contract §4.2). Create-once: every pointer
// is created by `tx.create` inside a transaction that first reads the pointer's
// document; an existing pointer is never updated, and the loser of a race moves
// on. Nothing here ever calls set, update or merge on a pointer.
//
//   createWithEvidence    the run holds a final snapshot for the key: read the
//                         pointer; it exists → skip; else create it from that
//                         snapshot.
//   createAtFinalization  the battle is finalisation-due and THIS run's store
//                         call for the key returned `retryable`: read the pointer
//                         AND the key's final document
//                         setupEvidence/{snapshotIdOf({ session, symbol,
//                         ruleSet: describeRuleSet() })}; the pointer exists →
//                         skip; the final exists → create the pointer from it
//                         (after checking its schemaVersion and key); else create
//                         the null pointer. So a null pointer promises exactly
//                         this: no final snapshot existed at this transaction's
//                         serialisation point.
//
// Only ever called with a real session (a calendar_missing activation is never
// sent here). Reads the store's FINAL collection only, never setupEvidenceClaims.
// setupEvidenceImportGuard.test.js lists this file by name.

import { snapshotIdOf } from '../setupEvidence/key.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { ACTIVATIONS_SUBCOLLECTION } from './constants.js';
import { snapshotServes } from './pointer.js';

const SESSION_RE = /^\d{4}-\d{2}-\d{2}$/;
/** A Firestore document id: no slash, not '.', '..' or a reserved __name__. */
const usableDocId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 1500 && !id.includes('/') && id !== '.' && id !== '..' && !/^__.*__$/.test(id);

function pointerRef(db, battleId, activationId) {
  if (!usableDocId(battleId) || !usableDocId(activationId)) throw new TypeError('activationEvidence writer: unusable document id');
  return db.collection('agentBattles').doc(battleId).collection(ACTIVATIONS_SUBCOLLECTION).doc(activationId);
}

/**
 * @param {{ db: object, battleId: string, pointer: object }} p a complete pointer (pointer.js) built from a final snapshot
 * @returns {Promise<'created' | 'exists'>}
 */
export async function createWithEvidence({ db, battleId, pointer }) {
  const ref = pointerRef(db, battleId, pointer?.activationId);
  if (!pointer.entry || pointer.missing !== null) throw new TypeError('activationEvidence writer: createWithEvidence needs a pointer with evidence');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return 'exists';
    tx.create(ref, pointer);
    return 'created';
  });
}

/**
 * @param {object} p
 * @param {object} p.db
 * @param {string} p.battleId
 * @param {string} p.activationId
 * @param {string} p.session the activation's completed session
 * @param {string} p.symbol
 * @param {(evidence: { snapshotId: string, snapshot: object } | null) => object} p.makePointer builds the pointer from the final found in the transaction, or the null pointer
 * @returns {Promise<'exists' | 'created_with_evidence' | 'created_null' | 'snapshot_invalid'>}
 */
export async function createAtFinalization({ db, battleId, activationId, session, symbol, makePointer }) {
  if (typeof session !== 'string' || !SESSION_RE.test(session)) throw new TypeError('activationEvidence writer: createAtFinalization needs a real session');
  const ruleSet = describeRuleSet();
  const snapshotId = snapshotIdOf({ session, symbol, ruleSet });
  const ref = pointerRef(db, battleId, activationId);
  const finalRef = db.collection('setupEvidence').doc(snapshotId);
  return db.runTransaction(async (tx) => {
    const [pointerSnap, finalSnap] = await tx.getAll(ref, finalRef);
    if (pointerSnap.exists) return 'exists';
    if (finalSnap.exists) {
      const snapshot = finalSnap.data();
      // A document at the key that is not this key's final is no evidence, and no proof of absence either.
      if (!snapshotServes(snapshot, { session, symbol, ruleSet })) return 'snapshot_invalid';
      const pointer = makePointer({ snapshotId, snapshot });
      if (pointer.activationId !== activationId) throw new TypeError('activationEvidence writer: pointer id mismatch');
      tx.create(ref, pointer);
      return 'created_with_evidence';
    }
    const pointer = makePointer(null);
    if (pointer.activationId !== activationId || pointer.entry !== null) throw new TypeError('activationEvidence writer: null pointer mismatch');
    tx.create(ref, pointer);
    return 'created_null';
  });
}
