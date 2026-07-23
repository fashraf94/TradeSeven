// api/_utils/calibrationBundle.js
//
// Archetype Architecture Phase 2 (P2.1) — composes the live physics tables
// CALIBRATION_BUNDLE_VERSION covers (Spec §4.3) behind one read surface and
// hashes them, so the paired test can fail the build when any covered table
// changes without a version bump.
//
// FENCE NOTE (BUILD_RULES §1): agentArchetypeConfig.js is §1-fenced and
// archetypeScoring.js is inside the fenced "scoring engine" concept. This
// module only IMPORTS their exports (reading/calling is expressly permitted);
// it edits nothing. The tables are composed by reference — no copies of
// calibration values are made here (the local-copy pattern is the documented
// §4 bug class).
//
// Zero production consumers in Phase 2. The compiler stamps
// CALIBRATION_BUNDLE_VERSION into sourceRevisionVector (P2.3); the per-tick
// effectiveRuntimeResolution stamp arrives with P2.6.

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
import { PRESET_CONFIGS } from './agentPresetConfig.js';
import { TEMPO_DIAL_BANDS } from './tempoDialBands.js';
import { CALIBRATION_BUNDLE_VERSION } from './archetypeVersionConstants.js';
import { canonicalContentHash } from './canonicalHash.js';

/**
 * The complete §4.3 coverage set: every live physics table, composed by
 * reference. hftConfig is lifted per archetype from the fenced config table
 * (the knob values Map 5 shows resolving live at tick, keyed by the frozen
 * archetype scalar).
 */
export function buildCalibrationBundle() {
  const hftConfigByArchetype = {};
  for (const archetype of VALID_ARCHETYPES) {
    hftConfigByArchetype[archetype] = ARCHETYPE_CONFIGS[archetype]?.hftConfig ?? null;
  }
  return {
    calibrationBundleVersion: CALIBRATION_BUNDLE_VERSION,
    knobConfigVersion: KNOB_CONFIG_VERSION,
    hftConfigByArchetype,
    archetypeWeights: ARCHETYPE_WEIGHTS,
    archetypeTemperatures: ARCHETYPE_TEMPERATURES,
    archetypeConstraints: ARCHETYPE_CONSTRAINTS,
    presetLevers: PRESET_CONFIGS,
    tempoBands: TEMPO_DIAL_BANDS,
  };
}

/**
 * Content hash over the covered tables (version fields excluded, so the hash
 * answers exactly one question: did covered CONTENT change?). The test locks
 * this against a recorded value; a mismatch without a
 * CALIBRATION_BUNDLE_VERSION bump fails the build (§4.3 bump discipline).
 */
export function computeCalibrationBundleHash() {
  const bundle = buildCalibrationBundle();
  const { calibrationBundleVersion, ...content } = bundle;
  return canonicalContentHash(content);
}
