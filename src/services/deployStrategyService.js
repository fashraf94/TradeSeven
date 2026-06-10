// src/services/deployStrategyService.js
//
// Phase 4A — Deploy-to-Agent orchestration.
//
// Reuses the existing (protected) equipBundle pipeline from forgeService so
// the agent's activeRules array stays the single source of truth for the
// BaggerBomb prompt assembly (agentEvalPromptAssembly.js reads
// ctx.activeRules directly). On top of that, this service writes a
// `deployedStrategy` metadata object onto the agent doc for:
//   * UI display (ForgeLanding deployed-strategy banner)
//   * Phase 4B hybrid-execution guardrail enforcement
//
// Fire-and-forget shadow logger writes to the `deployEvents` Firestore
// collection — silent failure only, never blocks deploy UX.
//
// NOTE: This file does not modify any protected service. It composes
// forgeService.equipBundle / unequipBundle as black boxes.
//
// Public API:
//   deployExperimentToAgent({ agent, season, entry, dimensionValues,
//                              bundleId, directives, guardrails })
//       → Promise<{ deployedStrategy }>
//   clearDeployedStrategy(agentId) → Promise<void>

import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { equipBundle, unequipBundle } from './forgeService';
import { hashDimensions } from '../utils/dimensionMapper';

const SCHEMA_VERSION = 1;

/**
 * Deploy a proven experiment's strategy to the agent for live BaggerBomb
 * battles.
 *
 * @param {Object} params
 * @param {Object} params.agent          - Agent doc snapshot-like object with at least { id, activeBattleId, equippedBundleIds, deployedStrategy? }.
 * @param {Object} params.season         - Season/Experiment doc { id, name? }.
 * @param {Object} params.entry          - seasonEntries doc for the completed experiment.
 * @param {Object} params.dimensionValues - Canonical (or inferred) dimension values.
 * @param {string} params.bundleId       - Materialized bundle id already under agents/{id}/bundles.
 * @param {Array}  params.directives     - Output of dimensionsToDirectives(dv).
 * @param {Array}  params.guardrails     - Output of dimensionsToGuardrails(dv).
 * @returns {Promise<{ deployedStrategy: Object }>}
 */
export async function deployExperimentToAgent({
  agent,
  season,
  entry,
  dimensionValues,
  bundleId,
  directives,
  guardrails,
}) {
  if (!agent?.id) throw new Error('deployExperimentToAgent: agent.id required');
  if (!bundleId) throw new Error('deployExperimentToAgent: bundleId required');
  if (!entry?.id) throw new Error('deployExperimentToAgent: entry.id required');

  // 1. Pre-check: no active battle (equipBundle will also throw, but we want
  //    a clean error before any writes happen).
  if (agent.activeBattleId) {
    throw new Error(
      'Your agent is currently in a battle. Wait for it to finish before deploying a new strategy.'
    );
  }

  const equippedIds = Array.isArray(agent.equippedBundleIds)
    ? agent.equippedBundleIds
    : [];
  const prev = agent.deployedStrategy || null;
  const replacedExperimentId = prev?.experimentId || null;
  const prevBundleId = prev?.bundleId || null;

  // ─────────────────────────────────────────────────────────────
  // NON-ATOMIC DEPLOY SEQUENCE — read before modifying.
  //
  // Steps 2 → 3 → 5 are three separate Firestore writes. They are NOT
  // wrapped in a transaction / writeBatch because we reuse the protected
  // `equipBundle` / `unequipBundle` helpers from forgeService.js, each of
  // which manages its own batch internally.
  //
  // Failure modes:
  //   * Unequip succeeds, equip fails → the agent is left WITHOUT the
  //     previous bundle's rules AND without the new bundle's rules.
  //     `activeRules` shrinks; Haiku loses the previously deployed
  //     directives until the user retries. `deployedStrategy` metadata
  //     is not updated (still points at the old bundle).
  //   * Equip succeeds, metadata write (step 5) fails → Haiku correctly
  //     sees the new rules in `activeRules`, but `deployedStrategy` still
  //     points at the old experiment. The ForgeLanding card may display
  //     stale origin info until the next successful deploy.
  //
  // Recovery: the whole operation is idempotent. `bundleId` is deterministic
  // (dimension hash), `equipBundle` short-circuits on an already-equipped
  // bundle, and the metadata write is a plain overwrite. A user retry from
  // the DeployToAgent modal will complete the sequence cleanly.
  //
  // Follow-up (pre-launch): migrate this orchestration to a single
  // server-side writeBatch OR a Cloud Function using Admin SDK so the
  // three writes commit atomically, eliminating the mid-sequence failure
  // window entirely.
  // ─────────────────────────────────────────────────────────────

  // 2. If there is an existing deployed-strategy bundle AND it differs from
  //    the new one AND it's still equipped, unequip it first. This keeps
  //    the activeRules array focused on the currently-deployed strategy and
  //    avoids hitting the maxBundles ceiling unnecessarily.
  if (prevBundleId && prevBundleId !== bundleId && equippedIds.includes(prevBundleId)) {
    try {
      await unequipBundle(agent.id, prevBundleId);
    } catch (err) {
      // Non-fatal — log and continue. Worst case is the old bundle stays
      // equipped alongside the new one; user can clean up in the Advanced tab.
      console.warn('[deployStrategy] Failed to unequip previous bundle', err);
    }
  }

  // 3. Equip the new bundle (populates agent.activeRules). Skip if the
  //    same bundle is already equipped — deterministic bundleId means an
  //    identical re-deploy is a metadata-only update.
  if (!equippedIds.includes(bundleId)) {
    try {
      await equipBundle(agent.id, bundleId);
    } catch (err) {
      const msg = err?.message || '';
      if (/Bundle limit reached/i.test(msg)) {
        throw new Error(
          `${msg} Unequip a bundle from the Advanced tab in the Forge and try again.`
        );
      }
      throw err;
    }
  }

  // 4. Build the deployedStrategy metadata payload.
  const alpha =
    typeof entry?.seasonState?.alphaVsSpy === 'number'
      ? entry.seasonState.alphaVsSpy
      : null;
  const rank =
    entry?.seasonState?.finalRank ?? entry?.seasonState?.rank ?? null;
  const forgeScore =
    entry?.seasonState?.forgeScore ?? entry?.forgeScore ?? null;
  const sourceCollection =
    dimensionValues?._sourceCollection || entry?.algorithm?.collectionId || null;

  const deployedStrategy = {
    experimentId: entry.id,
    experimentName: season?.name || entry?.algorithm?.description || null,
    seasonId: season?.id || entry?.seasonId || null,
    bundleId,
    dimensionValues: dimensionValues || null,
    dimensionHash: dimensionValues ? hashDimensions(dimensionValues) : null,
    directives: Array.isArray(directives) ? directives : [],
    guardrails: Array.isArray(guardrails) ? guardrails : [],
    sourceCollection,
    forgeScore,
    alpha,
    rank,
    deployedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };

  // 5. Write to agent doc. serverTimestamp() used for lastDeployedAt to stay
  //    consistent with other agent-doc writes in the codebase.
  const agentRef = doc(db, 'agents', agent.id);
  await updateDoc(agentRef, {
    deployedStrategy,
    lastDeployedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 6. Fire-and-forget shadow logger write.
  logDeployEvent({
    agent,
    deployedStrategy,
    replacedExperimentId,
  });

  return { deployedStrategy };
}

/**
 * Clear the deployedStrategy metadata without touching equippedBundleIds.
 * Not wired into Phase 4A UI — reserved for future "undeploy" flow.
 */
export async function clearDeployedStrategy(agentId) {
  if (!agentId) throw new Error('clearDeployedStrategy: agentId required');
  const agentRef = doc(db, 'agents', agentId);
  await updateDoc(agentRef, {
    deployedStrategy: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Client-side shadow logger fallback — writes to the top-level
 * `deployEvents` Firestore collection. The GCS-backed server-side shadow
 * logger isn't reachable from client code; a future cron can sync this
 * collection into the training-data pipeline.
 *
 * Silent failure only — never throws, never awaits from caller perspective.
 */
function logDeployEvent({ agent, deployedStrategy, replacedExperimentId }) {
  try {
    const docId = `${agent.id}_${deployedStrategy.experimentId}_${Date.now()}`;
    const eventRef = doc(db, 'deployEvents', docId);
    const payload = {
      agentId: agent.id,
      userId: agent.ownerId || null,
      seasonId: deployedStrategy.seasonId,
      experimentId: deployedStrategy.experimentId,
      bundleId: deployedStrategy.bundleId,
      sourceCollection: deployedStrategy.sourceCollection,
      forgeScore: deployedStrategy.forgeScore,
      alpha: deployedStrategy.alpha,
      rank: deployedStrategy.rank,
      directiveCount: deployedStrategy.directives?.length || 0,
      guardrails: deployedStrategy.guardrails || [],
      dimensionHash: deployedStrategy.dimensionHash,
      replacedExperimentId: replacedExperimentId || null,
      schemaVersion: SCHEMA_VERSION,
      clientTs: serverTimestamp(),
    };
    // Fire and forget — do not await from caller.
    setDoc(eventRef, payload).catch((err) => {
      console.warn('[deployStrategy] shadow log write failed', err);
    });
  } catch (err) {
    console.warn('[deployStrategy] shadow log build failed', err);
  }
}
