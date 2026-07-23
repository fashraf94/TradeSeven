// api/_utils/resolvedAgentManifest.js
//
// Archetype Architecture Phase 2 (P2.5, §7-signed commit) — the
// ResolvedAgentManifest builder (Spec §4.1 + V1.1 amendments, §4.3, DR-6).
// NON-FENCED kernel: fenced createAgentBattle calls this from ONE
// conditional spread adjacent to the agentContext snapshot (the
// buildCustomizationSnapshot precedent at agentBattleService.js:183) —
// exactly the P2.0-verified attach point.
//
// Create-only-after-start (R1-4) holds BY CONSTRUCTION: the block is born
// inside the single battle-creation `.add` and no updater exists anywhere.
// Battles keep their birth freeze policy (R1-2): FREEZE_POLICY_VERSION is
// stamped at creation and consulted from the battle, never re-read live.
//
// ZERO READERS in Phase 2 — agentContext remains the runtime authority
// (brief P2.5). The manifest records LOCK-STATE (…AtLock versions + values);
// execution-state lives in per-tick effectiveRuntimeResolution (§4.3) — two
// records, never conflated; divergence between them is recorded truth.
//
// Kernel-sharing note: frozen leans/dials/settingsRev come from the SAME
// buildCustomizationSnapshot kernel the agentContext spread uses, so the two
// snapshots cannot disagree (§9 one-source discipline). Under
// MANIFEST_WRITE_ENABLED the kernel therefore runs twice per creation —
// pure CPU plus a possible duplicate [LeanRevalidation] ops-log line;
// accepted and documented (values are deterministic per (agentData, now)).

import { buildCustomizationSnapshot } from './leanRevalidation.js';
import { KNOB_CONFIG_VERSION } from './agentArchetypeConfig.js';
import { TEMPO_DIAL_BANDS } from './tempoDialBands.js';
import {
  FREEZE_POLICY_VERSION,
  RULE_LIBRARY_VERSION,
  CALIBRATION_BUNDLE_VERSION,
  GUARDRAIL_SET_VERSION,
  PROMPT_SPEC_VERSION,
  GAME_MODE_POLICY_VERSION,
  ARCHETYPE_IDENTITY_VERSION,
} from './archetypeVersionConstants.js';
import { registryIdentityHash } from './compileOnSettingsChange.js';
import { computeGameModePolicyHash } from './gameModePolicy.js';
import { canonicalContentHash } from './canonicalHash.js';

/**
 * §4.1 three-part guardrails layer (R1-10): user source copied and NEVER
 * mutated; compiled entries carry sourceRuleId + guardrailBinding; the
 * effective merge exists only here and in CompiledBuild. Without a
 * CompiledBuild (manifest flag on, compiler flag off) the merge is the
 * user layer verbatim — honestly recorded via mergeSource.
 */
function buildGuardrailsLayer(agentData, compiledBuild) {
  const userGuardrails = Array.isArray(agentData.deployedStrategy?.guardrails)
    ? agentData.deployedStrategy.guardrails.map((g) => ({ ...g }))
    : [];

  const perType = compiledBuild?.effectiveGuardrailsPreview?.perType ?? null;
  const compiledRuleGuardrails = [];
  const effectiveGuardrails = [];
  if (perType) {
    for (const [type, row] of Object.entries(perType)) {
      for (const d of row.derivedFromRules ?? []) {
        compiledRuleGuardrails.push({ type, sourceRuleId: d.ruleId, value: d.value, guardrailBinding: d.binding ?? null });
      }
      effectiveGuardrails.push({
        type,
        effective: row.effective,
        governingSource: row.governingSource,
        onUnequipBehavior: row.onUnequipBehavior,
      });
    }
  } else {
    for (const g of userGuardrails) {
      effectiveGuardrails.push({ type: g.type, effective: g.value, governingSource: 'user', onUnequipBehavior: 'unchanged (user value governs)' });
    }
  }
  return {
    userGuardrails,
    compiledRuleGuardrails,
    effectiveGuardrails,
    mergeSource: perType ? 'compiled_build' : 'user_only_no_compiled_build',
  };
}

/**
 * Build the manifest block for one battle creation. Pure given its inputs
 * (now is caller-supplied — the same `now` the battle doc stamps).
 *
 * @param {Object} p.agentData        the createAgentBattle agentData
 * @param {Object} p.compiledBuild    options.compiledBuild (validated/fresh
 *                                    from the P2.4b gate) or null
 * @param {Object} p.equippedWatchlist options.equippedWatchlist or null
 * @param {string} p.gameMode         the battle's resolved mode (A-2)
 * @param {string} p.now              ISO creation instant
 */
export function buildResolvedAgentManifest({ agentData, compiledBuild = null, equippedWatchlist = null, gameMode, now }) {
  const customization = buildCustomizationSnapshot(agentData, now);

  const frozenLayers = {
    activeRules: agentData.activeRules || [],
    equippedBundleIds: agentData.equippedBundleIds || [],
    standingLeans: customization.standingLeans,
    standingLeansInvalidated: customization.standingLeansInvalidated,
    dials: customization.dials,
    deployedGuardrails: Array.isArray(agentData.deployedStrategy?.guardrails)
      ? agentData.deployedStrategy.guardrails
      : [],
    equippedWatchlist: equippedWatchlist ? { ...equippedWatchlist, snapshotAt: now } : null,
  };

  const valuesAtLock = {
    archetype: agentData.archetype || 'unknown',
    agentName: agentData.name || 'Agent',
    // The battle default at creation (agentBattleService.js:216) — recorded
    // as the value AT lock; mid-battle preset flips are execution-state.
    strategyPreset: 'balanced',
    riskTolerance: agentData.config?.risk ?? 50,
    settingsRev: customization.settingsRev,
  };

  // §4.3 lock-state stamps, incl. the A-2 mode fields. dialBandVersionAtLock
  // mirrors the tempo clamp's fail-closed pairing source.
  const versionStamps = {
    settingsRevAtLock: customization.settingsRev,
    calibrationBundleVersionAtLock: CALIBRATION_BUNDLE_VERSION,
    knobConfigVersionAtLock: KNOB_CONFIG_VERSION,
    dialBandVersionAtLock: TEMPO_DIAL_BANDS.forKnobConfigVersion,
    ruleLibraryVersionAtLock: RULE_LIBRARY_VERSION,
    identityVersionAtLock: ARCHETYPE_IDENTITY_VERSION,
    identityHashAtLock: registryIdentityHash(),
    guardrailSetVersionAtLock: GUARDRAIL_SET_VERSION,
    promptSpecVersionAtLock: PROMPT_SPEC_VERSION,
    gameModeAtLock: gameMode,
    gameModePolicyVersionAtLock: GAME_MODE_POLICY_VERSION,
    gameModePolicyHashAtLock: computeGameModePolicyHash(gameMode),
    ...(compiledBuild ? {
      compiledBuildIdAtLock: compiledBuild.compiledBuildId ?? null,
      compiledBuildContentHashAtLock: compiledBuild.contentHash ?? null,
      compilerVersionAtLock: compiledBuild.compilerVersion ?? null,
    } : {}),
  };

  const manifest = {
    manifestId: `${agentData.id ?? 'unknown'}_${gameMode}_${now}`,
    manifestHash: '',
    freezePolicyVersion: FREEZE_POLICY_VERSION,
    createdAt: now,
    frozenLayers,
    valuesAtLock,
    versionStamps,
    guardrails: buildGuardrailsLayer(agentData, compiledBuild),
    // DR-13 recording feed: compat-tension rules that would render alongside
    // the identity block (from the compile's tension candidates; empty until
    // Phase 3 authors tension cells).
    renderedTensionPairs: compiledBuild?.renderedTensionCandidates ?? [],
  };

  // manifestHash covers everything except the hash field itself.
  const { manifestHash, ...hashable } = manifest;
  manifest.manifestHash = canonicalContentHash(hashable);
  return manifest;
}
