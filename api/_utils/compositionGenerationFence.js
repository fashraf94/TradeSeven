// api/_utils/compositionGenerationFence.js
//
// Composition PR 4 — the DARK HALF of the §7-signed fenced work (the DR-13
// flag-split pattern: all logic here, one-import/minimal-call splices in the
// fenced files). Three seams:
//
//   1. THE decide.js PROJECTION SPLICE (ruling of record, REVERSED Aug 6):
//      epoch + generation validation BEFORE the activeRules write, a
//      projectionGeneration stamp ON the written value, and reader-side
//      rejection of stale stamps. Sol's cross-generation counterexample: a
//      deploy window in flight during activation can read authority stores at
//      generation N−1 and commit its re-derived projection AFTER generation N
//      activates — input-purity does not survive a generation flip mid-window;
//      only write-time validation plus a reader-checked stamp does. Both
//      directions live here: commitActiveRulesProjection (write-side, in one
//      transaction with the epoch check) and assertProjectionCurrent
//      (reader-side).
//
//   2. FC-1-CLOSE (createAgentBattle cutover atomicity): the battle writer
//      PINS the full descriptor BEFORE manifest resolution
//      (pinActivationDescriptor), stamps the manifest with source generation
//      + semantic identity (manifestGenerationStamp), and RE-VALIDATES the
//      pin at commit (commitBattleDocWithPin) — an activation interleaved
//      between pin and commit ABORTS the battle write with nothing created,
//      so a battle doc is wholly generation A or wholly generation B, never
//      A's compiledBuild with B's advisory slice. The deploy path retries
//      organically (a fresh call re-pins and re-resolves everything).
//
//   3. The A15-adjacent reader consistency check rides
//      compositionAdvisoryRender's admissibility gate (expected-vs-slice
//      generation stamps), not this module.
//
// DARK POSTURE (A23): with COMPOSITION_EPOCH_FENCE_ENABLED=false every seam
// reproduces the pre-PR-4 behavior byte-for-byte — the projection write is
// the same single update, the battle write is the same single add, zero
// added reads, no stamp fields. Lit pre-activation (record absent): writes
// proceed unstamped — the stamp exists only once a record exists.

import { COMPOSITION_EPOCH_FENCE_ENABLED } from './compositionConfig.js';
import {
  ACTIVATION_COLLECTION, ACTIVATION_DOC_ID,
  readActivationDescriptor, sameActivationDescriptor,
} from './compositionProductionLoader.js';
import { validateWriteEpochInTx } from './compositionWriteEpoch.js';

export class ProjectionStaleError extends Error {
  constructor(detail) {
    super(`projection_stale_generation: ${detail}`);
    this.name = 'ProjectionStaleError';
    this.code = 'projection_stale_generation';
  }
}

export class CutoverInterleavedError extends Error {
  constructor(detail) {
    super(`battle_cutover_interleaved: ${detail}`);
    this.name = 'CutoverInterleavedError';
    this.code = 'battle_cutover_interleaved';
  }
}

function activationDocRef(db) {
  return db.collection(ACTIVATION_COLLECTION).doc(ACTIVATION_DOC_ID);
}

/**
 * Pin the activation descriptor ONCE per logical write flow (a deploy, a
 * battle creation), BEFORE any state the flow derives from is read. Dark:
 * zero reads. Lit: { dark:false, descriptor } — null descriptor = the
 * pre-activation world.
 */
export async function pinActivationDescriptor(db, { enabled = COMPOSITION_EPOCH_FENCE_ENABLED } = {}) {
  if (!enabled) return { dark: true, descriptor: null };
  const snap = await activationDocRef(db).get();
  return { dark: false, descriptor: readActivationDescriptor(snap) }; // malformed fails closed here
}

/**
 * Seam 1, write side: the guarded activeRules projection write. Dark: the
 * exact pre-PR-4 update, byte-identical. Lit: one transaction — epoch
 * validation (with retry-stable pin), descriptor re-read compared against
 * the flow's pin (a flip since the pin REJECTS — generation N−1 inputs can
 * never persist past N's watermark), then the update WITH the
 * activeRulesProjection stamp when a record exists.
 */
export async function commitActiveRulesProjection(db, agentRef, activeRules, pin) {
  if (!pin || pin.dark) {
    await agentRef.update({ activeRules });
    return { stamped: false };
  }
  const epochPin = {};
  await db.runTransaction(async (tx) => {
    await validateWriteEpochInTx(tx, db, { enabled: true, epochPin });
    const current = readActivationDescriptor(await tx.get(activationDocRef(db)));
    const bothAbsent = pin.descriptor === null && current === null;
    if (!bothAbsent && !sameActivationDescriptor(pin.descriptor, current)) {
      throw new ProjectionStaleError(
        `deploy derived at generation ${pin.descriptor?.activationGeneration ?? 'none'}, record now at ${current?.activationGeneration ?? 'none'}`,
      );
    }
    const stamp = current
      ? { activeRulesProjection: { projectionGeneration: current.activationGeneration, semanticHash: current.semanticHash } }
      : {};
    await tx.update(agentRef, { activeRules, ...stamp });
  });
  return { stamped: !!pin.descriptor };
}

/**
 * Seam 1, reader side: a persisted projection carrying a stale generation
 * stamp is REJECTED by the paths that consume it (battle creation / deploy
 * validation). Legacy/dark docs (no stamp) are tolerated — the stamp only
 * exists post-activation.
 */
export function assertProjectionCurrent(agentData, descriptor, { sentinel = null } = {}) {
  const stamp = agentData?.activeRulesProjection;
  if (stamp?.projectionGeneration == null) return null;
  if (!descriptor || descriptor.activationGeneration !== stamp.projectionGeneration) {
    if (sentinel) throw new Error(`${sentinel}projection_stale_generation`);
    throw new ProjectionStaleError(
      `persisted projection stamped generation ${stamp.projectionGeneration}, record at ${descriptor?.activationGeneration ?? 'none'}`,
    );
  }
  return null;
}

/**
 * Seam 2: the manifest stamp for a pinned flow — source generation + the
 * semantic identity of the candidate the generation ratified. Null when
 * dark or pre-activation (the manifest gains NO new keys — byte-identity).
 */
export function manifestGenerationStamp(pin) {
  if (!pin || pin.dark || !pin.descriptor) return null;
  return {
    sourceGeneration: pin.descriptor.activationGeneration,
    semanticHash: pin.descriptor.semanticHash,
  };
}

/**
 * Seam 2: the battle-doc commit. Dark: the exact pre-PR-4 add. Lit: a
 * transaction that re-reads the descriptor and compares the FULL tuple
 * against the pin taken before manifest resolution — an interleaved
 * activation/rollback ABORTS with nothing created (wholly-A or wholly-B;
 * the caller's retry is a fresh deploy that re-pins and re-resolves).
 *
 * @returns {Promise<{id: string}>} the created battle ref.
 */
export async function commitBattleDocWithPin(db, battleDoc, pin) {
  if (!pin || pin.dark) {
    return db.collection('agentBattles').add(battleDoc);
  }
  const ref = db.collection('agentBattles').doc();
  await db.runTransaction(async (tx) => {
    const current = readActivationDescriptor(await tx.get(activationDocRef(db)));
    const bothAbsent = pin.descriptor === null && current === null;
    if (!bothAbsent && !sameActivationDescriptor(pin.descriptor, current)) {
      throw new CutoverInterleavedError(
        `battle resolved at generation ${pin.descriptor?.activationGeneration ?? 'none'}, record now at ${current?.activationGeneration ?? 'none'}`,
      );
    }
    await tx.create(ref, battleDoc);
  });
  return ref;
}
