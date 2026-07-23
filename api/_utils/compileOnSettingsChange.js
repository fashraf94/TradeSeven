// api/_utils/compileOnSettingsChange.js
//
// Archetype Architecture Phase 2 (P2.4a) — the equip-time compile helper the
// ten settings endpoints call, DARK behind COMPILER_ENABLED=false. When the
// flag is false BOTH entry points return null before touching anything:
// zero added Firestore reads, zero added writes, responses byte-identical
// (the mastery-profile "zero added I/O while dark" precedent,
// equip-bundle.js:106-110).
//
// When enabled, the compile runs INSIDE the endpoint's existing
// runTransaction and rides the SAME structural settingsRev increment
// (founder ruling, P2.0 approval #3): the endpoint's txUpdateAgentSettings
// bumps rev N→N+1 and the CompiledBuild docs written here carry
// sourceRevisionVector.settingsRev = N+1 — A-3's "the compile mints the
// revision", with no second counter.
//
// Storage home (P2.0-confirmed, founder-approved):
//   agents/{agentId}/compiledBuilds/{gameMode}
// Client access is denied by the firestore.rules default-deny catch-all
// (:886-888) — no rules addition, no manual deploy while dark; an explicit
// match block rides the Phase-4 UX PR.
//
// LIVE-CORPUS HONESTY (§5.6): rule metadata comes from the live
// forgeKnowledgeBase templates and compat cells from the live map. Today no
// template carries the §5.6 fields and unclassified cells resolve via
// fallthrough, so every enabled compile records validation.pass=false with
// the missing-metadata errors — the truthful pre-authoring state. Nothing
// is defaulted; the P2.4b deploy path refuses invalid/stale builds, and the
// production flag-flip is separately gated on activationGate going green.

import {
  FORGE_RULE_TEMPLATES,
} from '../../src/data/forgeKnowledgeBase.js';
import { getRuleCompatInfo } from '../../src/data/archetypeRuleCompatibility.js';
import { compileBuild } from './compileBuild.js';
import { buildPlatformGuardrails } from './platformGuardrails.js';
import {
  LIVE_DEPLOY_MODES,
  getGameModePolicy,
  computeGameModePolicyHash,
} from './gameModePolicy.js';
import {
  ARCHETYPE_IDENTITY_VERSION,
  RULE_LIBRARY_VERSION,
  CALIBRATION_BUNDLE_VERSION,
} from './archetypeVersionConstants.js';
import { computeIdentityHash } from './archetypeRegistry.js';

// §5.1 metadata fields lifted from a corpus template when (Phase 3+) they
// exist. `modes` is pre-existing corpus data and present today.
const METADATA_FIELDS = [
  'intendedMode', 'copyClass', 'receiptTag', 'contentClass', 'secondaryEffects',
  'detectorSource', 'guardrailBinding', 'missingDataFallback', 'modes',
];

let templateById = null;
function metadataForRule(ruleId) {
  if (!templateById) {
    templateById = new Map(FORGE_RULE_TEMPLATES.map((t) => [t.id, t]));
  }
  const t = templateById.get(ruleId);
  if (!t) return undefined; // unknown rule → compiler records metadata_missing
  const meta = {};
  for (const f of METADATA_FIELDS) {
    if (t[f] !== undefined && t[f] !== null) meta[f] = t[f];
  }
  return meta;
}

// The registry identityHash is content-static per deploy; memoized so the
// (flag-on) first compile pays the one canonicalization, and dark endpoints
// never pay it at all. Exported: the P2.4b deploy gate
// (deployBuildValidation.js) verifies stored vectors against the SAME
// memoized value the compiler stamps — one source, no drift.
let cachedIdentityHash = null;
export function registryIdentityHash() {
  if (cachedIdentityHash === null) cachedIdentityHash = computeIdentityHash();
  return cachedIdentityHash;
}

/**
 * Phase-1 of the two-call protocol: transactional READS (Firestore requires
 * every read before the first write). Call after the endpoint's own reads,
 * before its writes. Returns { bundles } or null when disabled.
 *
 * Takes agentRef and derives the bundles collection ONLY after the enabled
 * gate — callers must never pre-evaluate `agentRef.collection(...)` in the
 * argument list, or the dark path stops being a true no-op (endpoint test
 * fakes without `.collection` would 500 — the exact byte-identity break the
 * flag exists to prevent).
 */
export async function prepareCompileInputs(tx, {
  agentRef,
  nextEquippedBundleIds,
  enabled = false,
} = {}) {
  if (!enabled) return null;
  const ids = (nextEquippedBundleIds ?? []).filter(Boolean);
  if (ids.length === 0) return { bundles: [] };
  const bundlesCol = agentRef.collection('bundles');
  const snaps = await tx.getAll(...ids.map((id) => bundlesCol.doc(id)));
  const bundles = [];
  for (const snap of snaps) {
    if (!snap.exists) continue; // a dangling id compiles as an absent bundle
    bundles.push({ bundleId: snap.id, ...snap.data() });
  }
  return { bundles };
}

/**
 * Phase-2 of the protocol: compile for every live deploy mode and WRITE the
 * CompiledBuild docs inside the same transaction. Call adjacent to the
 * endpoint's txUpdateAgentSettings. Returns the client preview payload
 * (per-mode) or null when disabled.
 *
 * nextState carries the POST-write values the endpoint is committing —
 * the compile describes the build the user just saved, not the one that
 * existed before this transaction.
 *
 * revision (A-3 discipline):
 *   'mint'    (default) — the settings-endpoint case: the caller's
 *             txUpdateAgentSettings bumps rev N→N+1 in this same
 *             transaction and the builds carry N+1.
 *   'current' — the deploy-path validate-or-recompile case (P2.4b): no
 *             source mutation happened, so NO revision is minted and no
 *             agent-doc write occurs — the artifact is re-derived for the
 *             CURRENT rev (a stale artifact re-derived at rev N is the
 *             same buildVersion N; phantom revisions would break the
 *             update-agent-settings no-phantom-revs discipline).
 */
export function writeCompiledBuildsInTx(tx, {
  agentRef,
  agentId,
  agent,
  nextState = {},
  bundles,
  enabled = false,
  nowIso,
  revision = 'mint',
} = {}) {
  if (!enabled) return null;

  const settingsRevAfter = (agent?.settingsRev || 0) + (revision === 'current' ? 0 : 1);
  const archetype = nextState.archetype ?? agent?.archetype ?? null;
  const deployedStrategy = 'deployedStrategy' in nextState
    ? nextState.deployedStrategy
    : agent?.deployedStrategy;

  const archetypeDefinition = {
    codeId: archetype,
    // §3.3: the compile targets the CURRENT registry identity version — the
    // exact parent this build is being authored against. (The agent doc
    // carries no historical parent pointer today; rebase semantics arrive
    // with Phase 3 authoring.)
    identityVersion: ARCHETYPE_IDENTITY_VERSION,
    identityHash: registryIdentityHash(),
  };

  const ruleMetadata = {};
  const compatCells = {};
  for (const bundle of bundles ?? []) {
    for (const snap of bundle.ruleSnapshots ?? []) {
      if (!snap?.id || ruleMetadata[snap.id] !== undefined) continue;
      const meta = metadataForRule(snap.id);
      if (meta !== undefined) ruleMetadata[snap.id] = meta;
      // Live cells pass through verbatim — getRuleCompatInfo's
      // via:'fallthrough' is ABSENCE and the compiler records it as a
      // missing cell (A-4), never as a verdict.
      compatCells[snap.id] = getRuleCompatInfo(snap.id, archetype);
    }
  }

  const userBuildDelta = {
    agentId,
    settingsRev: settingsRevAfter,
    parentArchetypeId: archetype,
    parentIdentityVersion: ARCHETYPE_IDENTITY_VERSION,
    equippedBundles: bundles ?? [],
    ruleMetadata,
    compatCells,
    userGuardrails: Array.isArray(deployedStrategy?.guardrails) ? deployedStrategy.guardrails : [],
  };

  const platformGuardrails = buildPlatformGuardrails();
  const previews = {};
  for (const gameMode of LIVE_DEPLOY_MODES) {
    const build = compileBuild({
      archetypeDefinition,
      userBuildDelta,
      platformGuardrails,
      gameModePolicy: getGameModePolicy(gameMode),
      gameModePolicyHash: computeGameModePolicyHash(gameMode),
      versions: {
        ruleLibraryVersion: RULE_LIBRARY_VERSION,
        calibrationBundleVersion: CALIBRATION_BUNDLE_VERSION,
      },
      now: nowIso,
    });

    // DELIBERATE DIVERGENCE from captureSwapReceipt's create-only pattern
    // (founder ruling, P2.0 approval #3): overwrite-in-place .set() is
    // CORRECT here. A CompiledBuild is a freshness artifact — only the
    // latest compile per (agent, mode) is the contract object; history is
    // the manifest's job at lock. Do NOT "fix" this to .create().
    tx.set(agentRef.collection('compiledBuilds').doc(gameMode), build);

    previews[gameMode] = {
      compiledBuildId: build.compiledBuildId,
      gameMode,
      buildVersion: build.buildVersion,
      contentHash: build.contentHash,
      validationPass: build.validation.pass,
      validationErrorCount: build.validation.errors.length,
      effectiveGuardrailsPreview: build.effectiveGuardrailsPreview,
      blockedControls: build.blockedControls,
    };
  }
  return previews;
}

/** Test seam: reset module memos (fixture corpuses across test files). */
export function __resetCompileMemos() {
  templateById = null;
  cachedIdentityHash = null;
}
