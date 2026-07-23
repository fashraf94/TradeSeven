// api/_utils/deployBuildValidation.js
//
// Archetype Architecture Phase 2 (P2.4b, §7-signed commit) — the deploy-path
// validate-or-recompile + lock-time sourceRevisionVector re-verify (Spec
// §4.4 / DR-12, A-2, A-3). NON-FENCED: fenced decide.js gets two thin call
// sites; every rule lives here (the census pattern — non-fenced seams hold
// the logic so fenced call-sites stay thin).
//
// DARK CONTRACT (COMPILER_ENABLED=false): ensureDeployableCompiledBuild
// returns { proceed: true } IMMEDIATELY — no Firestore I/O, no argument is
// touched (the P2.4a lazy-ref lesson: test fakes without full surfaces must
// never be dereferenced on the dark path). decide.js behavior is
// byte-identical with the flag off.
//
// ENABLED CONTRACT (per attempt, ≤2 attempts — the §4.4 abort/retry):
//   1. Fresh-read agents/{id} + compiledBuilds/{gameMode} in ONE
//      transaction (the lock-time re-verify: this read happens at the
//      insertion point immediately before createAgentBattle — nothing runs
//      between a passing verify and the lock write).
//   2. Verify the stored vector against LIVE state: settingsRev, per-bundle
//      bundleContentHashes (recomputed from the live equipped bundle docs),
//      identityHash, calibrationBundleVersion, guardrailSetVersion,
//      ruleLibraryVersion, and the A-2 mode triple (gameMode,
//      gameModePolicyVersion, gameModePolicyHash).
//   3. Fresh → proceed with the stored build. Stale/absent → RECOMPILE in
//      the same transaction at the CURRENT revision (A-3: no source
//      mutation ⇒ no minted revision; see writeCompiledBuildsInTx
//      revision:'current') and proceed with the fresh artifact.
//   4. A transaction failure/mutation race retries once; persistent
//      failure REFUSES the deploy ({ proceed: false, reason }) — A-3: a
//      stale or version-less CompiledBuild is undeployable. Callers clear
//      the deploy lock and 4xx loudly (the bad-prescription precedent:
//      never improvise).
//
// VALIDATION.PASS IS DELIBERATELY NOT A DEPLOY GATE IN PHASE 2: §4.4's
// lock verify is about VECTOR freshness; a fresh build whose
// validation.pass=false (today's §5.6 metadata-less corpus) deploys with
// zero compiled semantics — the truthful status quo. Gating on
// validation.pass is the activation-gate epoch's decision (§5.6/A-4), not
// this phase's.

import { COMPILER_ENABLED } from '../../src/config/featureFlags.js';
import { computeBundleContentHash } from './compileBuild.js';
import {
  prepareCompileInputs,
  writeCompiledBuildsInTx,
  registryIdentityHash,
} from './compileOnSettingsChange.js';
import {
  RULE_LIBRARY_VERSION,
  CALIBRATION_BUNDLE_VERSION,
  GUARDRAIL_SET_VERSION,
  GAME_MODE_POLICY_VERSION,
} from './archetypeVersionConstants.js';
import { computeGameModePolicyHash } from './gameModePolicy.js';

const LOG_PREFIX = '[deployBuildValidation]';

/**
 * Pure vector-vs-live comparison. Exported for tests. `expected` carries the
 * live-derived values; `vector` is the stored build's sourceRevisionVector.
 * Returns [] when fresh, else the mismatched component names (§4.4: ANY
 * component change invalidates).
 */
export function diffSourceRevisionVector(vector, expected) {
  const mismatches = [];
  if (!vector || typeof vector !== 'object') return ['vector_missing'];
  for (const key of [
    'settingsRev',
    'ruleLibraryVersion',
    'identityHash',
    'calibrationBundleVersion',
    'guardrailSetVersion',
    // A-2 mode triple — re-verified exactly like a settingsRev mismatch.
    'gameMode',
    'gameModePolicyVersion',
    'gameModePolicyHash',
  ]) {
    if (vector[key] !== expected[key]) mismatches.push(key);
  }
  const stored = vector.bundleContentHashes ?? {};
  const live = expected.bundleContentHashes ?? {};
  const ids = new Set([...Object.keys(stored), ...Object.keys(live)]);
  for (const id of ids) {
    if (stored[id] !== live[id]) mismatches.push(`bundleContentHashes.${id}`);
  }
  return mismatches;
}

/**
 * The P2.4b gate. Returns:
 *   { proceed: true,  compiledBuild, recompiled, mismatches? }  — deploy on
 *   { proceed: false, reason }                                  — refuse
 * Dark (enabled=false): { proceed: true, dark: true } with zero I/O.
 */
export async function ensureDeployableCompiledBuild({
  db,
  agentRef,
  agentId,
  gameMode,
  enabled = COMPILER_ENABLED,
  attempts = 2,
} = {}) {
  if (!enabled) return { proceed: true, dark: true };

  let lastReason = 'unknown';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // One transaction per attempt = the atomic fresh-read + (re)write.
      // A concurrent settings mutation between reads and the recompile
      // write makes the transaction retry/fail — exactly the §4.4 abort.
      const outcome = await db.runTransaction(async (tx) => {
        const agentSnap = await tx.get(agentRef);
        if (!agentSnap.exists) return { proceed: false, reason: 'agent_not_found' };
        const agent = agentSnap.data();

        const buildRef = agentRef.collection('compiledBuilds').doc(gameMode);
        const buildSnap = await tx.get(buildRef);
        const stored = buildSnap.exists ? buildSnap.data() : null;

        // Live inputs for both the verify and any recompile — read INSIDE
        // the transaction so verify and recompile see one consistent state.
        const inputs = await prepareCompileInputs(tx, {
          agentRef,
          nextEquippedBundleIds: agent.equippedBundleIds || [],
          enabled: true,
        });

        if (stored) {
          const liveBundleHashes = {};
          for (const bundle of inputs.bundles) {
            liveBundleHashes[bundle.bundleId] = computeBundleContentHash(bundle);
          }
          // Expected = the LIVE values a compile right now would stamp,
          // from the same modules the equip-time writer stamps them from —
          // so a module-version bump (calibration, guardrail set, policy,
          // registry identity, rule library) reads as staleness here, not
          // just settingsRev/bundle drift.
          const expected = {
            settingsRev: agent.settingsRev || 0,
            ruleLibraryVersion: RULE_LIBRARY_VERSION,
            identityHash: registryIdentityHash(),
            calibrationBundleVersion: CALIBRATION_BUNDLE_VERSION,
            guardrailSetVersion: GUARDRAIL_SET_VERSION,
            gameMode,
            gameModePolicyVersion: GAME_MODE_POLICY_VERSION,
            gameModePolicyHash: computeGameModePolicyHash(gameMode),
            bundleContentHashes: liveBundleHashes,
          };
          const mismatches = diffSourceRevisionVector(stored.sourceRevisionVector, expected);
          if (mismatches.length === 0) {
            // Fresh: pure verify, zero writes — the stored artifact IS the
            // deployable build (§4.4 validate half).
            return { proceed: true, compiledBuild: stored, recompiled: false };
          }
          // Stale → fall through to the recompile half.
          console.warn(`${LOG_PREFIX} stale CompiledBuild for agent ${agentId} mode ${gameMode}: ${mismatches.join(', ')} — recompiling at current revision`);
        }

        // Collect the FULL builds — the gate's contract is the CompiledBuild
        // document (same shape as the fresh path's stored doc), never the
        // client preview (review finding: two shapes under one name).
        const fullBuilds = {};
        writeCompiledBuildsInTx(tx, {
          agentRef,
          agentId,
          agent,
          nextState: {},
          bundles: inputs.bundles,
          enabled: true,
          nowIso: new Date().toISOString(),
          revision: 'current',
          collectBuilds: fullBuilds,
        });
        return {
          proceed: true,
          compiledBuild: fullBuilds[gameMode] ?? null,
          recompiled: true,
        };
      });
      return outcome;
    } catch (err) {
      lastReason = err?.message || String(err);
      console.error(`${LOG_PREFIX} attempt ${attempt}/${attempts} failed for agent ${agentId} mode ${gameMode}: ${lastReason}`);
    }
  }
  return { proceed: false, reason: `compiled_build_unverifiable: ${lastReason}` };
}
