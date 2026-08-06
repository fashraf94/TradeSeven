// api/_utils/archetypeRegistry.js
//
// Archetype Architecture Phase 2 (P2.2) — the archetype registry (Spec §2.3):
// the census Map-1 data homes composed behind ONE read surface, with an
// identityHash over every input and a completeness validator. ZERO production
// readers in Phase 2 (brief P2.2: no consumer migration; C1–C4 generation is
// Phase 3) — consumers today keep importing the legacy tables directly; the
// import-boundary ratchet test freezes that set so it can only shrink.
//
// Composition is BY REFERENCE from the live homes — this module re-declares
// no archetype content (the local-copy pattern is the documented BUILD_RULES
// §4 bug class). The registry is therefore always exactly as fresh as the
// deployed modules it composes; per-version immutability comes from the
// committed snapshot artifact (docs/registry-snapshots/) + the CI lock in
// archetypeRegistry.test.js, which fails the build when composed content
// changes without an ARCHETYPE_IDENTITY_VERSION bump.
//
// FENCE NOTE (BUILD_RULES §1): agentArchetypeConfig.js (fenced) and
// archetypeScoring.js (fenced "scoring engine" concept) are imported
// read-only — expressly permitted; nothing here edits them.
//
// EXCLUDED INPUT (documented): openerTemplateFloor.js ARCHETYPE_POSTURE is
// module-internal (not exported) and voice-display-only; covering it would
// require an export-only edit of that file for zero Phase-2 benefit. Phase 3
// can add it to the composition when it exports.

import { ARCHETYPE_DISPLAY_NAMES } from '../../src/data/archetypeDisplay.js';
import { ARCHETYPE_IDENTITY } from '../../src/data/archetypeIdentity.js';
import { ARCHETYPE_CHARACTER, ROSTER_ORDER } from '../../src/data/archetypeCharacter.js';
import {
  ARCHETYPE_ADJUSTMENTS,
  ADJUSTMENT_CONFLICT_GROUPS,
  ARCHETYPE_KEYS,
} from '../../src/data/archetypeAdjustments.js';
import { TRAIT_LIBRARY, TRAIT_BY_ID, ARCHETYPE_DEFAULT_TRAITS } from '../../src/data/traitLibrary.js';
import {
  ARCHETYPE_RULE_COMPATIBILITY,
  COMPAT_STATES,
  RULE_FAMILIES,
} from '../../src/data/archetypeRuleCompatibility.js';
import { TEMPO_MEANING, LEAN_DISPLAY_NAMES } from '../../src/data/characterLeanPresentation.js';
import {
  FORGE_RULE_TEMPLATES,
  FORGE_CATEGORIES,
  FORGE_CONFLICT_PAIRS,
  SEASON_CONFLICT_PAIRS,
} from '../../src/data/forgeKnowledgeBase.js';
import {
  ARCHETYPE_CONFIGS,
  KNOB_CONFIG_VERSION,
  VALID_ARCHETYPES,
} from './agentArchetypeConfig.js';
import {
  ARCHETYPE_WEIGHTS,
  ARCHETYPE_TEMPERATURES,
  ARCHETYPE_CONSTRAINTS,
} from './archetypeScoring.js';
import {
  ARCHETYPE_IDENTITY_VERSION,
  RULE_LIBRARY_VERSION,
  CALIBRATION_BUNDLE_VERSION,
} from './archetypeVersionConstants.js';
import { canonicalContentHash } from './canonicalHash.js';

export { ARCHETYPE_IDENTITY_VERSION };

/** The six launch archetype code-ids, from the fenced table's derived list. */
export function listArchetypeIds() {
  return [...VALID_ARCHETYPES];
}

/**
 * Trait lookup through the registry surface (§2.3 — the import-boundary
 * ratchet forbids new direct importers of traitLibrary.js; consumers that
 * need a trait's rule bundle + strength profiles go through here). Returns
 * the library object for a trait id, or null for an unknown id.
 */
export function getTraitById(traitId) {
  return TRAIT_BY_ID[traitId] ?? null;
}

/**
 * The one read surface (§2.3). Returns the full composed definition for a
 * code-id, or null for an unknown id — callers fail loudly, no analyst
 * fallback here (the registry is a contract surface, not a display helper).
 */
export function getArchetypeDefinition(codeId) {
  if (!VALID_ARCHETYPES.includes(codeId)) return null;
  const config = ARCHETYPE_CONFIGS[codeId];
  const adjustments = ARCHETYPE_ADJUSTMENTS[codeId] || null;
  const defaultTraitIds = ARCHETYPE_DEFAULT_TRAITS[codeId] || [];
  return {
    codeId,
    identityVersion: ARCHETYPE_IDENTITY_VERSION,
    displayName: ARCHETYPE_DISPLAY_NAMES[codeId] ?? null,
    identity: ARCHETYPE_IDENTITY[codeId] ?? null,
    character: ARCHETYPE_CHARACTER[codeId] ?? null,
    // The four-zone identity block (DR-13's kernel-content source) + the
    // per-archetype lean allowlist + conflict groups.
    zones: adjustments?.zones ?? null,
    adjustments: adjustments?.adjustments ?? null,
    conflictGroups: ADJUSTMENT_CONFLICT_GROUPS[codeId] ?? null,
    // Born-with traits, resolved to their library objects (rule bundles +
    // strength profiles).
    defaultTraitIds,
    defaultTraits: defaultTraitIds.map((id) => TRAIT_BY_ID[id] ?? null),
    // Physics profile — refs carry calibrationBundleVersion (§2 amendment:
    // physicsProfile refs are version-stamped).
    physics: {
      calibrationBundleVersion: CALIBRATION_BUNDLE_VERSION,
      knobConfigVersion: KNOB_CONFIG_VERSION,
      hftConfig: config?.hftConfig ?? null,
      sectorConcentrationCap: config?.sectorConcentrationCap ?? null,
      convictionMods: config?.convictionMods ?? null,
      regimePreferences: config?.regimePreferences ?? null,
      defaultConfig: config?.defaultConfig ?? null,
    },
    scoring: {
      weights: ARCHETYPE_WEIGHTS[codeId] ?? null,
      temperatures: ARCHETYPE_TEMPERATURES[codeId] ?? null,
      constraints: ARCHETYPE_CONSTRAINTS[codeId] ?? null,
    },
    display: {
      label: config?.label ?? null,
      avatarColors: config?.avatarColors ?? null,
      tempoMeaning: TEMPO_MEANING[codeId] ?? null,
    },
    // The per-archetype compat block (family defaults + rule overrides) —
    // resolution semantics stay in archetypeRuleCompatibility.getRuleCompatInfo.
    compat: ARCHETYPE_RULE_COMPATIBILITY[codeId] ?? null,
  };
}

/**
 * Registry-wide inputs that are not per-archetype: the baseline rulebook
 * (§2.3's tenth home) and the corpus-level compat vocabulary.
 */
export function getRegistryCorpus() {
  return {
    ruleLibraryVersion: RULE_LIBRARY_VERSION,
    forgeCategories: FORGE_CATEGORIES,
    forgeRuleTemplates: FORGE_RULE_TEMPLATES,
    forgeConflictPairs: FORGE_CONFLICT_PAIRS,
    seasonConflictPairs: SEASON_CONFLICT_PAIRS,
    compatStates: COMPAT_STATES,
    ruleFamilies: RULE_FAMILIES,
    leanDisplayNames: LEAN_DISPLAY_NAMES,
    rosterOrder: ROSTER_ORDER,
  };
}

/**
 * §2.3 identityHash — canonical content hash over EVERY registry input:
 * the six composed definitions + zones + allowlists + the baseline rulebook.
 * The version constants are excluded from the hashed content so the hash
 * answers exactly one question (did composed CONTENT change?); the CI lock
 * pairs it with ARCHETYPE_IDENTITY_VERSION to enforce the bump discipline.
 */
export function computeIdentityHash() {
  const definitions = {};
  for (const id of VALID_ARCHETYPES) {
    const { identityVersion, physics, ...rest } = getArchetypeDefinition(id);
    const { calibrationBundleVersion, ...physicsContent } = physics;
    definitions[id] = { ...rest, physics: physicsContent };
  }
  const { ruleLibraryVersion, ...corpusContent } = getRegistryCorpus();
  return canonicalContentHash({ definitions, corpus: corpusContent });
}

/**
 * Completeness validator (§2.3): every archetype present in every keyed home,
 * structural invariants intact. Returns { complete, problems: [] }.
 */
export function validateRegistryCompleteness() {
  const problems = [];
  const ids = VALID_ARCHETYPES;

  if (ids.length !== 6) problems.push(`expected 6 launch archetypes, found ${ids.length}`);
  if ([...ROSTER_ORDER].sort().join() !== [...ids].sort().join()) {
    problems.push('ROSTER_ORDER and VALID_ARCHETYPES disagree');
  }
  if ([...ARCHETYPE_KEYS].sort().join() !== [...ids].sort().join()) {
    problems.push('ARCHETYPE_ADJUSTMENTS keys and VALID_ARCHETYPES disagree');
  }

  for (const id of ids) {
    const def = getArchetypeDefinition(id);
    for (const [field, value] of Object.entries({
      displayName: def.displayName,
      identity: def.identity,
      character: def.character,
      zones: def.zones,
      adjustments: def.adjustments,
      'physics.hftConfig': def.physics.hftConfig,
      'scoring.weights': def.scoring.weights,
      'scoring.temperatures': def.scoring.temperatures,
      'scoring.constraints': def.scoring.constraints,
      'display.label': def.display.label,
      'display.tempoMeaning': def.display.tempoMeaning,
      compat: def.compat,
    })) {
      if (value === null || value === undefined) problems.push(`${id}: missing ${field}`);
    }

    for (const traitId of def.defaultTraitIds) {
      if (!TRAIT_BY_ID[traitId]) problems.push(`${id}: default trait ${traitId} not in TRAIT_LIBRARY`);
    }
    if (def.defaultTraitIds.length === 0) problems.push(`${id}: no default traits`);

    // Every lean id must have display chrome, and every conflict-group
    // member must be a real allowlist entry.
    const allowlistIds = new Set((def.adjustments || []).map((a) => a.id));
    for (const a of def.adjustments || []) {
      if (!LEAN_DISPLAY_NAMES[a.id]) problems.push(`${id}: lean ${a.id} missing LEAN_DISPLAY_NAMES entry`);
      if (typeof a.canonicalTextVersion !== 'number') problems.push(`${id}: lean ${a.id} missing canonicalTextVersion`);
    }
    // Conflict-group members are { id, version } objects (archetypeAdjustments
    // ADJUSTMENT_CONFLICT_GROUPS shape) — each must name a real allowlist lean.
    for (const group of def.conflictGroups || []) {
      for (const m of group?.members || []) {
        if (!allowlistIds.has(m?.id)) problems.push(`${id}: conflict-group member ${m?.id} not in allowlist`);
      }
    }
  }

  if (!Array.isArray(FORGE_RULE_TEMPLATES) || FORGE_RULE_TEMPLATES.length === 0) {
    problems.push('baseline rulebook (FORGE_RULE_TEMPLATES) is empty');
  }
  if (TRAIT_LIBRARY.length === 0) problems.push('TRAIT_LIBRARY is empty');

  return { complete: problems.length === 0, problems };
}

/**
 * The snapshot artifact body for the CURRENT identity version — what
 * docs/registry-snapshots/archetype-registry-identity-v{N}.json holds.
 * Deterministic; git provides retrieval of every published version (§2.3 /
 * R1 finding 23).
 */
export function buildRegistrySnapshot() {
  const definitions = {};
  for (const id of VALID_ARCHETYPES) definitions[id] = getArchetypeDefinition(id);
  return {
    identityVersion: ARCHETYPE_IDENTITY_VERSION,
    identityHash: computeIdentityHash(),
    generatedFor: `archetype-registry-identity-v${ARCHETYPE_IDENTITY_VERSION}`,
    definitions,
    corpus: getRegistryCorpus(),
  };
}
