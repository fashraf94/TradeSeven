// api/_utils/compositionProductionLoader.js
//
// Composition PR 3 — ledger item B5: THE shared production loader for
// composed identity state. This is the ONE sanctioned production read path of
// the three-layer resolver (A36 allowlist row) — the contract PR 4's
// activation flips against. PR 3 lands the loader + contract tests; NOTHING
// in production consumes it yet (that wiring is the PR-4 activation).
//
// THE B5 CONTRACT (docs/composition/ACTIVATION_PRECONDITIONS.md):
//   1. GENERATION-CONSISTENT — a load never returns a torn view (descriptor
//      from generation N, entries from N−1). Mechanism: transactional reads
//      PLUS an explicit seqlock (descriptor read → state reads → descriptor
//      RE-READ; a generation change retries the whole load). The seqlock is
//      deliberate belt-over-transaction: it keeps the guarantee testable
//      without real Firestore and survives adapters whose "transaction" is
//      weaker than serializable.
//   2. PINNED GENERATION RETURNED — every load returns { generation }, the
//      activationGeneration the whole view was read under (0 = pre-activation
//      dark world).
//   3. EVERY DERIVED WRITE STAMPED — anything computed from a load and
//      persisted MUST carry `compositionGeneration: <that load's generation>`
//      via stampDerivedWrite(); assertGenerationStamped() is the write-side
//      tripwire. Readers reject stale stamps at PR 4 (decide.js splice per
//      the reversed ruling).

import { resolveEffectiveConfig } from './compositionStateResolver.js';

export const ACTIVATION_COLLECTION = 'composition';
export const ACTIVATION_DOC_ID = 'activation';

const MAX_SEQLOCK_RETRIES = 5;

export class TornCompositionReadError extends Error {
  constructor(before, after) {
    super(`composition load torn across generations (${before} → ${after}) after ${MAX_SEQLOCK_RETRIES} retries`);
    this.name = 'TornCompositionReadError';
    this.code = 'composition_read_torn';
  }
}

function activationRef(db) {
  return db.collection(ACTIVATION_COLLECTION).doc(ACTIVATION_DOC_ID);
}

function descriptorOf(snap) {
  if (!snap.exists) return null;
  const d = snap.data();
  return {
    activationGeneration: typeof d.activationGeneration === 'number' ? d.activationGeneration : 0,
    activeEpochId: d.activeEpochId ?? null,
    candidateStateId: d.candidateStateId ?? null,
    semanticHash: d.semanticHash ?? null,
    identityVersionTarget: d.identityVersionTarget ?? null,
  };
}

/**
 * Load the activated composition state under one pinned generation.
 *
 * @param db Firestore Admin handle (or a contract-conformant fake).
 * @param fetchLayers async ({ tx, descriptor }) => ({ overlayEntries, epochOverrideEntries })
 *        — the storage adapter for the mutable layers, called INSIDE the
 *        transaction with the descriptor the load observed. Injected so the
 *        loader stays contract-testable and the entry pagination strategy can
 *        evolve at PR 4 without touching the seqlock.
 * @returns {{ activated, generation, descriptor, overlayEntries,
 *             epochOverrideEntries, resolveWith(baseDocs) }}
 */
export async function loadActivatedComposition(db, fetchLayers) {
  let lastBefore = null; let lastAfter = null;
  for (let attempt = 0; attempt < MAX_SEQLOCK_RETRIES; attempt += 1) {
    const out = await db.runTransaction(async (tx) => {
      const before = descriptorOf(await tx.get(activationRef(db)));
      if (before === null) {
        // Pre-activation dark world: generation 0, no layers, resolver passes
        // base through untouched. Byte-identical semantics for any consumer.
        return { activated: false, generation: 0, descriptor: null, overlayEntries: [], epochOverrideEntries: [] };
      }
      const layers = await fetchLayers({ tx, descriptor: before });
      // SEQLOCK: the descriptor must be unchanged after the layer reads —
      // otherwise an activation/rollback landed mid-load and the view may mix
      // generations. Retry from the top.
      const after = descriptorOf(await tx.get(activationRef(db)));
      if (!after || after.activationGeneration !== before.activationGeneration) {
        return { __retry: true, before: before.activationGeneration, after: after?.activationGeneration ?? null };
      }
      return {
        activated: true,
        generation: before.activationGeneration,
        descriptor: before,
        overlayEntries: layers.overlayEntries ?? [],
        epochOverrideEntries: layers.epochOverrideEntries ?? [],
      };
    });
    if (!out.__retry) {
      return {
        ...out,
        resolveWith: (baseDocs) => resolveEffectiveConfig({
          baseDocs,
          overlayEntries: out.overlayEntries,
          epochOverrideEntries: out.epochOverrideEntries,
          activeEpochId: out.descriptor?.activeEpochId ?? null,
          includeOverlay: out.activated,
        }),
      };
    }
    lastBefore = out.before; lastAfter = out.after;
  }
  throw new TornCompositionReadError(lastBefore, lastAfter);
}

/** Contract 3: stamp a derived payload with the generation it was derived from. */
export function stampDerivedWrite(payload, loaded) {
  if (typeof loaded?.generation !== 'number') {
    throw new Error('stampDerivedWrite: a loader result with a numeric generation is required');
  }
  return { ...payload, compositionGeneration: loaded.generation };
}

/** The write-side tripwire: a derived write without its stamp is a contract breach. */
export function assertGenerationStamped(payload) {
  if (!payload || typeof payload.compositionGeneration !== 'number' || payload.compositionGeneration < 0) {
    throw new Error('composition contract breach: derived write is missing its compositionGeneration stamp (B5)');
  }
  return payload;
}
