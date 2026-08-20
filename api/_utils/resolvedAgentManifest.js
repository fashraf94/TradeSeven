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
// PR 4 (FC-1-CLOSE, §7-signed concept-fence contact): `generationStamp`
// ({sourceGeneration, semanticHash} | null) stamps the manifest AND its
// compositionCompat slice with the activation generation + semantic identity
// the battle flow PINNED before manifest resolution — the reader-side
// internal-consistency pair (compositionAdvisoryRender's admissibility gate
// rejects a mismatched pair, fail closed). Null (dark / pre-activation) adds
// NO keys — the manifest stays byte-identical, hash included.
export function buildResolvedAgentManifest({ agentData, compiledBuild = null, equippedWatchlist = null, gameMode, now, generationStamp = null }) {
  const customization = buildCustomizationSnapshot(agentData, now);

  // Consistency guard (review finding): the deploy request's agentData is
  // read at request start, while the P2.4b gate validates/recompiles
  // against a fresh transactional read. If a settings mutation landed in
  // between, the gate's build carries a NEWER settingsRev than the state
  // this manifest freezes — recording its provenance would make the lock
  // record internally inconsistent. The manifest must agree with
  // agentContext (same agentData, §9 one-source), so a rev-mismatched
  // build is treated as absent and the skip is recorded truth.
  let buildForManifest = compiledBuild;
  let compiledBuildProvenanceSkipped = null;
  const buildRev = compiledBuild?.sourceRevisionVector?.settingsRev;
  if (compiledBuild && buildRev !== undefined && buildRev !== customization.settingsRev) {
    buildForManifest = null;
    compiledBuildProvenanceSkipped = {
      reason: 'settings_rev_mismatch',
      buildSettingsRev: buildRev,
      manifestSettingsRev: customization.settingsRev,
    };
  }

  // E9 (Strategy Foundation audit, founder-authorized 2026-08-20): the
  // equipped-config content, built ONCE so the frozen layers and the
  // fingerprint below cannot disagree (§9 one-source). frozenLayers derives
  // from this object by adding ONLY the per-creation snapshotAt stamp to the
  // watchlist; equippedConfigHash hashes exactly this object.
  const equippedConfigContent = {
    activeRules: agentData.activeRules || [],
    equippedBundleIds: agentData.equippedBundleIds || [],
    standingLeans: customization.standingLeans,
    standingLeansInvalidated: customization.standingLeansInvalidated,
    dials: customization.dials,
    deployedGuardrails: Array.isArray(agentData.deployedStrategy?.guardrails)
      ? agentData.deployedStrategy.guardrails
      : [],
    equippedWatchlist: equippedWatchlist ?? null,
  };

  const frozenLayers = {
    ...equippedConfigContent,
    equippedWatchlist: equippedWatchlist ? { ...equippedWatchlist, snapshotAt: now } : null,
  };

  // The equipped-config fingerprint — sha256 (canonicalContentHash) over the
  // equipped-config content ONLY, so "battles fought under config X" is an
  // equality query (agentId + resolvedAgentManifest.equippedConfigHash;
  // firestore.indexes.json entry + Console creation per the index-drift
  // dual-write note).
  //
  // Coverage caveat: config as frozen at battle birth, six axes by value —
  // activeRules (rules + params + hardness), equippedBundleIds,
  // standingLeans (+ the bounded invalidated record), dials (tempo),
  // deployedGuardrails, equippedWatchlist — version stamps deliberately
  // excluded. valuesAtLock/versionStamps are context, not config; if the
  // identity/rule-library epoch must be pinned too, that is a SECOND field
  // (configEpochHash), never a widening of this one.
  //
  // The one deviation from hashing frozenLayers literally: the watchlist
  // enters WITHOUT its per-creation snapshotAt stamp — the compileBuild
  // contentHash rule ("identical inputs at different times are the SAME
  // build"). Hashing snapshotAt would mint a new "config" per battle and
  // defeat the query the field exists for.
  const equippedConfigHash = canonicalContentHash(equippedConfigContent);

  const valuesAtLock = {
    archetype: agentData.archetype || 'unknown',
    agentName: agentData.name || 'Agent',
    // The battle-creation default — recorded as the value AT lock;
    // mid-battle preset flips are execution-state. DELIBERATE second copy
    // of the fenced literal (agentBattleService.js battleDoc
    // `strategyPreset: 'balanced'`): binding both to one exported constant
    // requires a fenced edit outside the P2.5 §7 sign-off — logged for
    // Amendment Sheet B with valueParamKey. If the fenced default ever
    // changes without this, the manifest lies about lock state (§9).
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
    ...(buildForManifest ? {
      compiledBuildIdAtLock: buildForManifest.compiledBuildId ?? null,
      compiledBuildContentHashAtLock: buildForManifest.contentHash ?? null,
      compilerVersionAtLock: buildForManifest.compilerVersion ?? null,
    } : {}),
  };

  const manifest = {
    manifestId: `${agentData.id ?? 'unknown'}_${gameMode}_${now}`,
    manifestHash: '',
    freezePolicyVersion: FREEZE_POLICY_VERSION,
    createdAt: now,
    frozenLayers,
    // E9: equipped-config fingerprint — coverage caveat and hash-input
    // contract at the computation above.
    equippedConfigHash,
    valuesAtLock,
    versionStamps,
    guardrails: buildGuardrailsLayer(agentData, buildForManifest),
    // DR-13 recording feed: compat-tension rules that would render alongside
    // the identity block (from the compile's tension candidates; empty until
    // Phase 3 authors tension cells).
    renderedTensionPairs: buildForManifest?.renderedTensionCandidates ?? [],
    // Composition PR 3 (A25): the frozen compat slice the eval assembler's
    // advisory renderer consumes — present ONLY when the build was compiled
    // in candidate mode (legacy builds carry no advisory keys, so this field
    // is absent and the manifest stays byte-identical, hash included).
    ...(buildForManifest?.compatVerdicts?.some((v) => 'advisory' in v) ? {
      compositionCompat: {
        ...(buildForManifest.quarantined === true ? { quarantined: true } : {}),
        // FC-1: the slice half of the generation-stamp pair.
        ...(generationStamp ? { sourceGeneration: generationStamp.sourceGeneration } : {}),
        entries: buildForManifest.compatVerdicts.map((v) => ({
          ruleId: v.ruleId, verdict: v.verdict,
          advisory: v.advisory ?? null, narrowedParams: v.narrowedParams ?? null,
          ...(v.blocked === true ? { blocked: true } : {}),
        })),
      },
    } : {}),
    // FC-1: the manifest half of the generation-stamp pair (+ the semantic
    // identity the ratified candidate carries). Absent when unstamped.
    ...(generationStamp ? {
      compositionSourceGeneration: generationStamp.sourceGeneration,
      compositionSemanticHash: generationStamp.semanticHash,
    } : {}),
    ...(compiledBuildProvenanceSkipped ? { compiledBuildProvenanceSkipped } : {}),
  };

  // manifestHash covers everything except the hash field itself.
  const { manifestHash, ...hashable } = manifest;
  manifest.manifestHash = canonicalContentHash(hashable);
  return manifest;
}
