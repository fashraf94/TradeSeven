// api/_utils/archetypeVersionConstants.js
//
// Archetype Architecture Phase 2 (P2.1) — the version constants the Phase 1
// Master Spec V1.2 introduces (§4.3, §1.2, §1.3, §2.3). Constants only; the
// modules that give each one teeth (content hashes + change-without-bump CI
// locks) live beside them (calibrationBundle.js, gameModePolicy.js,
// archetypeRegistry.js). Nothing in production imports this module in Phase 2
// — every consumer arrives with the dark compiler plumbing.
//
// Bump discipline (Spec §4.3 / §2.3): each constant is MONOTONIC and bumps
// when its covered content changes. The paired hash-lock tests fail the build
// on content-change-without-version-bump, so "bumped on any table change" is
// enforced, not aspirational.

// §4.3 — one monotonic version covering every live physics table:
//   - hftConfig knob table (api/_utils/agentArchetypeConfig.js, KNOB_CONFIG_VERSION 2)
//   - ARCHETYPE_WEIGHTS / ARCHETYPE_TEMPERATURES / ARCHETYPE_CONSTRAINTS
//     (api/_utils/archetypeScoring.js)
//   - strategy-preset levers (api/_utils/agentPresetConfig.js PRESET_CONFIGS)
//   - tempo dial bands (api/_utils/tempoDialBands.js TEMPO_DIAL_BANDS)
// Coverage is composed + hashed in calibrationBundle.js.
export const CALIBRATION_BUNDLE_VERSION = 1;

// §4.3 / Spec §3.2 — versions the Forge rule corpus (the "baseline rulebook"):
// src/data/forgeKnowledgeBase.js FORGE_RULE_TEMPLATES (+ conflict pairs).
// Stamped into sourceRevisionVector.ruleLibraryVersion at compile.
export const RULE_LIBRARY_VERSION = 1;

// §4.3 — versions the prompt-template generation (agentPromptAssembly /
// agentEvalPromptAssembly rendering logic, which resolves live at tick per
// census Map 5). Stamped into effectiveRuntimeResolution.promptSpecVersion
// when the tick-side envelope capture lands (P2.6).
export const PROMPT_SPEC_VERSION = 1;

// §1.2 — versions the PlatformGuardrails contract (platformGuardrails.js).
// Bumped on any change to the platform floors / universal filters /
// sector-cap policy the contract documents.
export const GUARDRAIL_SET_VERSION = 1;

// §1.3 / A-2 — versions the GameModePolicy table (gameModePolicy.js). A-2
// additionally gives each mode's policy a content hash; both enter
// CompiledBuild.contentHash AND sourceRevisionVector.
export const GAME_MODE_POLICY_VERSION = 1;

// §2.3 / §3.3 — the registry identity version. Every published
// identityVersion emits an immutable snapshot artifact
// (docs/registry-snapshots/), and the registry CI lock fails on
// content-change-without-bump. Builds compile against their EXACT
// parentIdentityVersion (§3.3 — missing/retired versions fail explicitly).
export const ARCHETYPE_IDENTITY_VERSION = 1;

// §4.4 — stamped into every CompiledBuild as compilerVersion. Bumped when
// compileBuild's derivation/merge/legality semantics change.
export const COMPILER_VERSION = 1;
