// api/_utils/archetypeBuildSchemas.js
//
// Archetype Architecture Phase 2 (P2.1) — schema vocabulary + validators for
// the three Phase-1-spec artifacts:
//
//   CompiledBuild            — Spec §4.4 + Amendment A-2 (mode-scoped)
//   ResolvedAgentManifest    — Spec §4.1 (V1.1 amendments) + §4.3 + the P2.5
//                              manifest-block contract; see V1.0 note below
//   behaviorRecordEnvelope   — Amendment A-1 (shared, schema-versioned)
//
// Validators return { valid, errors: [] } and never throw — the caller
// decides disposition. They enforce the invariants the locked Spec states;
// unknown extra fields are legal (additive evolution), absent required
// fields are not.
//
// V1.0 NOTE (provenance): V1.1 §4.1 amends a V1.0 §4.1 manifest schema that
// is not itself a repo document. The manifest validator therefore enforces
// exactly the components V1.1/V1.2 and the Phase-2 brief P2.5 specify
// (frozen layers, valuesAtLock, versionStamps, freezePolicyVersion,
// renderedTensionPairs, manifestHash, the R1-10 three-part guardrails
// layer) and no invented others. Create-only-after-start (R1-4) is a
// write-path semantic, enforced at the writer (P2.5), not expressible in a
// shape validator.

// ── §5.3 vocabulary ──────────────────────────────────────────────────────
export const INTENDED_MODES = Object.freeze([
  'eligibility_constraint',
  'execution_constraint',
  'scoring_modifier',
  'required_consideration',
  'tie_breaker',
]);

export const EFFECTIVE_ENFORCEMENT = Object.freeze(['deterministic', 'prompt_advisory']);

// §4.4 verdict vocabulary. INPUT NOTE: the live compat map
// (src/data/archetypeRuleCompatibility.js COMPAT_STATES) spells the second
// class 'neutral'; §5.2 declares the map "unchanged (four classes via
// additive tension)" and §4.4 names the verdict token 'compatible' — the
// only consistent reading is that input 'neutral' IS the 'compatible'
// verdict class. The compiler maps it; flagged in the phase report.
export const COMPAT_VERDICTS = Object.freeze(['native', 'compatible', 'tension', 'core_conflict']);

// §5.4 fallback legality per effective enforcement: deterministic may only
// abstain/block (fail-open on stale data is prohibited for anything
// enforced); ignore_rule is legal solely for prompt_advisory.
export const DETERMINISTIC_LEGAL_FALLBACKS = Object.freeze(['abstain', 'block']);
export const ADVISORY_LEGAL_FALLBACKS = Object.freeze(['abstain', 'block', 'ignore_rule']);

// A-1: the envelope is schema-versioned (no grandfathering — Phase 5
// consumers reject any record missing it).
export const ENVELOPE_SCHEMA_VERSION = 1;

// §4.3 — the per-tick execution-state stamp's required key set.
export const EFFECTIVE_RUNTIME_RESOLUTION_KEYS = Object.freeze([
  'calibrationBundleVersion',
  'knobConfigVersion',
  'dialBandVersion',
  'modelId',
  'promptSpecVersion',
  'guardrailSetVersion',
  'gameModePolicyVersion',
  'commitSha',
]);

// A-2 — the sourceRevisionVector's required key set (§4.4 base + the three
// mode fields A-2 adds; the lock transaction re-verifies every component).
export const SOURCE_REVISION_VECTOR_KEYS = Object.freeze([
  'settingsRev',
  'bundleContentHashes',
  'ruleLibraryVersion',
  'identityHash',
  'calibrationBundleVersion',
  'guardrailSetVersion',
  'gameMode',
  'gameModePolicyVersion',
  'gameModePolicyHash',
]);

// R1 finding 12 — the mandatory per-type preview fields (§4.4): save is
// blocked whenever effective ≠ requested and this preview was not presented.
export const PREVIEW_PER_TYPE_KEYS = Object.freeze([
  'requestedByUser',
  'derivedFromRules',
  'effective',
  'governingSource',
  'onUnequipBehavior',
]);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const isIsoDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

function requireKeys(target, keys, path, errors) {
  if (!isObject(target)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  for (const k of keys) {
    if (!(k in target)) errors.push(`${path}.${k} is required`);
  }
  return true;
}

// ── CompiledBuild (§4.4 + A-2) ───────────────────────────────────────────
export function validateCompiledBuild(build) {
  const errors = [];
  if (!isObject(build)) return { valid: false, errors: ['CompiledBuild must be an object'] };

  for (const k of ['compiledBuildId', 'contentHash', 'agentId', 'parentArchetypeId', 'identityHash', 'gameMode', 'gameModePolicyHash']) {
    if (!isNonEmptyString(build[k])) errors.push(`${k} must be a non-empty string`);
  }
  for (const k of ['compilerVersion', 'buildVersion', 'parentIdentityVersion', 'gameModePolicyVersion']) {
    if (typeof build[k] !== 'number') errors.push(`${k} must be a number`);
  }
  if (!isIsoDate(build.compiledAt)) errors.push('compiledAt must be an ISO date string');

  if (requireKeys(build.sourceRevisionVector, SOURCE_REVISION_VECTOR_KEYS, 'sourceRevisionVector', errors)) {
    const v = build.sourceRevisionVector;
    if (!isObject(v.bundleContentHashes)) errors.push('sourceRevisionVector.bundleContentHashes must be an object');
    // A-2 consistency: the vector's mode fields are THE build's mode fields.
    if (v.gameMode !== undefined && build.gameMode !== undefined && v.gameMode !== build.gameMode) {
      errors.push('sourceRevisionVector.gameMode must equal build.gameMode (A-2: one build, one mode)');
    }
    if (v.identityHash !== undefined && build.identityHash !== undefined && v.identityHash !== build.identityHash) {
      errors.push('sourceRevisionVector.identityHash must equal build.identityHash');
    }
    if (v.gameModePolicyHash !== undefined && build.gameModePolicyHash !== undefined && v.gameModePolicyHash !== build.gameModePolicyHash) {
      errors.push('sourceRevisionVector.gameModePolicyHash must equal build.gameModePolicyHash');
    }
    if (typeof v.settingsRev !== 'number') errors.push('sourceRevisionVector.settingsRev must be a number (buildVersion pointer domain)');
  }

  if (!isObject(build.validation) || typeof build.validation.pass !== 'boolean' || !Array.isArray(build.validation.errors)) {
    errors.push('validation must be { pass: boolean, errors: [] }');
  }

  if (!Array.isArray(build.compatVerdicts)) {
    errors.push('compatVerdicts must be an array');
  } else {
    build.compatVerdicts.forEach((cv, i) => {
      if (!isObject(cv) || !isNonEmptyString(cv.ruleId)) {
        errors.push(`compatVerdicts[${i}] must be an object with ruleId`);
        return;
      }
      if (!COMPAT_VERDICTS.includes(cv.verdict)) {
        errors.push(`compatVerdicts[${i}].verdict must be one of ${COMPAT_VERDICTS.join('|')}`);
      }
      // §5.2/§5.4: tension is meaningless without its treatment — never a
      // default (§5.6: no invented defaults).
      if (cv.verdict === 'tension' && !isNonEmptyString(cv.treatment)) {
        errors.push(`compatVerdicts[${i}] tension verdict requires a treatment`);
      }
    });
  }

  if (!Array.isArray(build.blockedControls)) errors.push('blockedControls must be an array');

  if (!isObject(build.effectiveGuardrailsPreview) || !isObject(build.effectiveGuardrailsPreview.perType)) {
    errors.push('effectiveGuardrailsPreview.perType is required (R1 finding 12)');
  } else {
    for (const [type, entry] of Object.entries(build.effectiveGuardrailsPreview.perType)) {
      requireKeys(entry, PREVIEW_PER_TYPE_KEYS, `effectiveGuardrailsPreview.perType.${type}`, errors);
      if (isObject(entry) && entry.derivedFromRules !== undefined && !Array.isArray(entry.derivedFromRules)) {
        errors.push(`effectiveGuardrailsPreview.perType.${type}.derivedFromRules must be an array`);
      }
    }
  }

  if (!isObject(build.freshness) || build.freshness.validUntilSourceChange !== true) {
    errors.push('freshness.validUntilSourceChange must be true (§4.4)');
  }

  return { valid: errors.length === 0, errors };
}

// ── ResolvedAgentManifest (§4.1 amendments + §4.3 + P2.5 block) ──────────
export function validateResolvedAgentManifest(manifest) {
  const errors = [];
  if (!isObject(manifest)) return { valid: false, errors: ['manifest must be an object'] };

  for (const k of ['manifestId', 'manifestHash']) {
    if (!isNonEmptyString(manifest[k])) errors.push(`${k} must be a non-empty string`);
  }
  // R1 finding 2: battles keep their birth policy; endpoints consult the stamp.
  if (typeof manifest.freezePolicyVersion !== 'number') errors.push('freezePolicyVersion must be a number (R1-2)');
  // DR-13 amendment: compat-tension rules rendered alongside the identity
  // block are recorded here.
  if (!Array.isArray(manifest.renderedTensionPairs)) errors.push('renderedTensionPairs must be an array (DR-13)');

  // P2.5 block: the frozen layers + the lock-state record (§4.3: the
  // manifest stamps …AtLock versions AND values — two distinct records,
  // never conflated with execution-state).
  if (!isObject(manifest.frozenLayers)) errors.push('frozenLayers must be an object');
  if (!isObject(manifest.valuesAtLock)) errors.push('valuesAtLock must be an object');
  if (!isObject(manifest.versionStamps)) errors.push('versionStamps must be an object (§4.3 …AtLock stamps)');

  // R1 finding 10: the three-part guardrails layer — user source never
  // mutated; the merge exists only here and in CompiledBuild.
  if (!isObject(manifest.guardrails)) {
    errors.push('guardrails layer is required (R1-10)');
  } else {
    const g = manifest.guardrails;
    if (!('userGuardrails' in g)) errors.push('guardrails.userGuardrails is required (source, never mutated)');
    if (!Array.isArray(g.compiledRuleGuardrails)) errors.push('guardrails.compiledRuleGuardrails must be an array (guardrailBinding + sourceRuleId entries)');
    if (!('effectiveGuardrails' in g)) errors.push('guardrails.effectiveGuardrails is required (merged snapshot)');
  }

  return { valid: errors.length === 0, errors };
}

// ── behaviorRecordEnvelope (A-1) ─────────────────────────────────────────
export function validateBehaviorRecordEnvelope(envelope) {
  const errors = [];
  if (!isObject(envelope)) return { valid: false, errors: ['envelope must be an object'] };

  if (envelope.envelopeSchemaVersion !== ENVELOPE_SCHEMA_VERSION) {
    errors.push(`envelopeSchemaVersion must be ${ENVELOPE_SCHEMA_VERSION} (A-1: schema-versioned, no grandfathering)`);
  }
  for (const k of ['manifestId', 'manifestHash', 'tickId']) {
    if (!isNonEmptyString(envelope[k])) errors.push(`${k} must be a non-empty string`);
  }
  if (!isObject(envelope.versionsAtLock)) errors.push('versionsAtLock must be an object (from manifest)');
  if (!isIsoDate(envelope.evaluatedAt)) errors.push('evaluatedAt must be an ISO date string');

  // §4.3: captured during the SAME tick as the record. Keys are required;
  // a value the tick genuinely lacks is captured null, never invented
  // (learningSchemas versions{} precedent).
  if (requireKeys(envelope.effectiveRuntimeResolution, EFFECTIVE_RUNTIME_RESOLUTION_KEYS, 'effectiveRuntimeResolution', errors)) {
    const r = envelope.effectiveRuntimeResolution;
    for (const k of EFFECTIVE_RUNTIME_RESOLUTION_KEYS) {
      const v = r[k];
      if (v !== null && v !== undefined && typeof v !== 'string' && typeof v !== 'number') {
        errors.push(`effectiveRuntimeResolution.${k} must be a string, number, or null`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
