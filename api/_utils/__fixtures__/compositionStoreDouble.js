// api/_utils/__fixtures__/compositionStoreDouble.js
//
// The PRE-GENESIS composition protected store, as a test double.
//
// WHY THIS EXISTS (ACTIVATION_RUNBOOK step 1.1, 2026-08-16). Until the flip,
// COMPOSITION_EPOCH_FENCE_ENABLED was false and every fence helper returned
// BEFORE touching Firestore (the A23 zero-I/O dark posture). Suites could
// therefore drive the endpoints, provisioners and battle writers with db
// doubles that had never heard of the `composition` collection. With the
// fence LIT those helpers genuinely read, and ~21 suites exploded on
// `Unmocked collection: composition` / `db.runTransaction is not a function`.
//
// The honest fix is to make the doubles model the world we now ship, NOT to
// mock the flag back to dark — a suite that pins a configuration we no longer
// deploy proves nothing. This module is that model, defined ONCE so all
// suites agree on what "pre-genesis production" means:
//
//   composition/writeEpoch  — ABSENT  ⇒ the fence FAILS OPEN
//   composition/activation  — ABSENT  ⇒ no record, live identity selected
//
// which is exactly the state observed in production at the flip (probe,
// 2026-08-16: both docs absent, both collections empty).
//
// The addresses are IMPORTED from the modules under test, never re-typed —
// a doc-id rename must break the double, not silently bypass it.

import { WRITE_EPOCH_COLLECTION, WRITE_EPOCH_DOC_ID } from '../compositionWriteEpoch.js';
import { ACTIVATION_COLLECTION, ACTIVATION_DOC_ID } from '../compositionProductionLoader.js';
import { PROVISIONER_LEASE_COLLECTION } from '../compositionProvisionerLease.js';

// Both docs live in the same collection; the assertion keeps that assumption
// honest if either module ever moves.
if (WRITE_EPOCH_COLLECTION !== ACTIVATION_COLLECTION) {
  throw new Error(
    `compositionStoreDouble: the epoch and activation docs are no longer in one collection `
    + `(${WRITE_EPOCH_COLLECTION} vs ${ACTIVATION_COLLECTION}) — update this double.`,
  );
}

export const COMPOSITION_COLLECTION = WRITE_EPOCH_COLLECTION;
export { WRITE_EPOCH_DOC_ID, ACTIVATION_DOC_ID, PROVISIONER_LEASE_COLLECTION };

function snapshot(id, data) {
  return { id, exists: data != null, data: () => data ?? undefined };
}

/**
 * A composition-store double.
 *
 * @param {object}  [opts]
 * @param {object|null} [opts.epoch]      composition/writeEpoch contents; null = ABSENT (default, pre-genesis).
 * @param {object|null} [opts.activation] composition/activation contents; null = ABSENT (default, pre-genesis).
 * @returns {{
 *   collection: (name: string) => object|null,
 *   isCompositionRef: (ref: any) => boolean,
 *   get: (ref: any) => object,
 *   leases: object,
 * }}
 *
 * `epoch` / `activation` are constructor params rather than setters on purpose:
 * a suite declares the world it is modelling once, up front, instead of mutating
 * the store mid-test. Pass `{epoch: {state:'closed', epochId:'E0'}}` to model a
 * closed window; the default ({} ⇒ both absent) is pre-genesis production.
 *
 * `collection(name)` returns a collection double for the composition store and
 * the provisioner-lease collection, and **null** for anything else — so a host
 * suite keeps its own `Unmocked collection: X` guard for every OTHER name
 * (that guard is load-bearing; this must not become a blanket allow).
 */
export function makeCompositionStoreDouble({ epoch = null, activation = null } = {}) {
  const state = { epoch, activation };
  const leases = {};

  const docData = (docId) => {
    if (docId === WRITE_EPOCH_DOC_ID) return state.epoch;
    if (docId === ACTIVATION_DOC_ID) return state.activation;
    return null;
  };

  const compositionDoc = (docId) => ({
    id: docId,
    __compositionDoc: docId,
    get: async () => snapshot(docId, docData(docId)),
    set: async (data) => {
      if (docId === WRITE_EPOCH_DOC_ID) state.epoch = data;
      else if (docId === ACTIVATION_DOC_ID) state.activation = data;
    },
  });

  const leaseDoc = (docId) => ({
    id: docId,
    __leaseDoc: docId,
    get: async () => snapshot(docId, leases[docId] ?? null),
    set: async (data) => { leases[docId] = data; },
    update: async (patch) => { leases[docId] = { ...leases[docId], ...patch }; },
  });

  const collection = (name) => {
    if (name === COMPOSITION_COLLECTION) return { doc: compositionDoc };
    if (name === PROVISIONER_LEASE_COLLECTION) {
      return {
        doc: leaseDoc,
        get: async () => ({ docs: Object.entries(leases).map(([id, d]) => ({ id, data: () => d })) }),
      };
    }
    return null;
  };

  const isCompositionRef = (ref) => !!(ref && (ref.__compositionDoc || ref.__leaseDoc));

  // For host suites whose tx.get is a switch on ref shape: delegate here first.
  const get = (ref) => {
    if (ref?.__compositionDoc) return snapshot(ref.__compositionDoc, docData(ref.__compositionDoc));
    if (ref?.__leaseDoc) return snapshot(ref.__leaseDoc, leases[ref.__leaseDoc] ?? null);
    throw new Error('compositionStoreDouble.get: not a composition ref');
  };

  return { collection, isCompositionRef, get, leases };
}
