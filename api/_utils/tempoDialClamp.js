// api/_utils/tempoDialClamp.js
//
// Release 2 (Fenced Customization Bundle V1.1) — the tempo-dial CLAMP LAYER
// (spec Phase 1 item 4). Non-fenced: the Phase-2 integration point is the
// eval cron's mode-resolution seam (api/cron/agent-evaluate.js:1009-1012 @
// 4a0f43e, immediately after resolveHftConfig) — NOT fenced code.
//
// DESIRED → EFFECTIVE (spec changelog #2, fail closed, never silent):
//   effective = 'standard' UNLESS
//     TEMPO_DIAL_ENABLED (caller-passed)                        AND
//     bandTable.forKnobConfigVersion === deployed KNOB_CONFIG_VERSION AND
//     desired is a known tempo value.
//   Every suppression is visible via provenance.suppressionReason — the
//   desired state is never silently rewritten.
//
// IDENTITY-WHEN-STANDARD (off-state invariant, BY CONSTRUCTION): when the
// effective tempo is 'standard', clampHftConfig returns the INPUT hftConfig
// object — the same reference, not a rebuilt copy — so a dial-less / flag-off
// / suppressed battle runs a provably byte-identical config (spec Build Rule
// 4: "existing numeric config values identical").
//
// DIRECTION-AWARE APPLICATION (B4 §D rider 3, verified @ the acceptance
// report lines 67-77): multiplier mult ∈ {0.7, 1.0, 1.3} —
//   swapWindow.capPerWindow                        → round(cap × mult), ≥ 1   (capacity)
//   forcedRotation.ticksThreshold                  → round(ticks ÷ mult), ≥ 1 (resistance)
//   hurdleFloor.byReason.haiku_decision.atrMultiplier → round2(v ÷ mult)      (resistance)
//   hurdleFloor.byReason.stagnation.atrMultiplier     → round2(v ÷ mult)      (resistance)
//   hurdleFloor.default.atrMultiplier                 → round2(v ÷ mult)      (resistance)
// UNTOUCHED at every band (safety/structural, preserved verbatim):
// forcedRotation.enabled / pctThreshold / winnerThreshold / maxTickAgeMinutes,
// swapWindow.windowMinutes / countEmergencies / enabled, hurdleFloor.enabled /
// requireBenchPositive, and the EMERGENCY_BYPASS_REASONS set (never read here).
//
// MERGE-NOT-REPLACE: the adjusted config is a path-wise shallow clone — only
// the five band leaves change; every other key (known or future) rides
// through untouched, and absent sub-objects are never created. Downstream
// `?.`/`??` consumers (agent-evaluate.js:1038/1086/1748,
// agentRiskManager.js:154/315 @ 4a0f43e) always see a fully-populated config.
//
// PROVENANCE (spec changelog #14 field set, fixed at Phase 0 against the
// regex-locked receipt constraints): { tempoDesired, tempoEffective,
// selectionSource, dialBandVersion, knobConfigVersion, suppressionReason? }.
// It rides a SIBLING spread at the four swap call sites via
// buildSwapProvenance (swapProvenance.js) — buildSwapReceiptSource and its
// shape-locked return are NEVER touched (founder amendment: site 4 NO-EDIT).

import { KNOB_CONFIG_VERSION } from './agentArchetypeConfig.js';
import { TEMPO_DIAL_BANDS, VALID_TEMPO_VALUES } from './tempoDialBands.js';

export const TEMPO_SUPPRESSION_REASONS = Object.freeze({
  DIAL_DISABLED: 'dial_disabled',
  BAND_VERSION_MISMATCH: 'band_version_mismatch',
  UNKNOWN_TEMPO_VALUE: 'unknown_tempo_value',
});

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * THE snapshot path for a battle's desired tempo (agentContext.dials.tempo,
 * stamped at fenced site 1 via buildCustomizationSnapshot). Every reader
 * resolves through this accessor so the snapshot shape lives in ONE place —
 * the clamp seam and handleGameplanMeeting's provenance resolution can never
 * drift onto different paths (/code-review, Phase-2).
 */
export function desiredTempoOf(battle) {
  return battle?.agentContext?.dials?.tempo;
}

/**
 * Resolve desired → effective tempo with full provenance.
 *
 * @param {Object} p
 * @param {string|undefined} p.desiredTempo   battle.agentContext.dials?.tempo (absent = default standard)
 * @param {boolean} p.dialEnabled             TEMPO_DIAL_ENABLED, read at the call site
 * @param {number} [p.deployedKnobConfigVersion] defaults to the live KNOB_CONFIG_VERSION
 * @param {Object} [p.bandTable]              defaults to TEMPO_DIAL_BANDS
 * @returns {{ effectiveTempo: string, multiplier: number, provenance: Object }}
 */
export function resolveTempoDial({
  desiredTempo,
  dialEnabled,
  deployedKnobConfigVersion = KNOB_CONFIG_VERSION,
  bandTable = TEMPO_DIAL_BANDS,
} = {}) {
  // selectionSource distinguishes default-standard from an explicit user
  // 'standard' (spec PR-b blocking test: the two must be distinguishable).
  const hasUserValue = desiredTempo !== undefined && desiredTempo !== null;
  const selectionSource = hasUserValue ? 'user_dial' : 'default';
  const tempoDesired = hasUserValue ? desiredTempo : 'standard';

  const provenanceBase = {
    tempoDesired,
    selectionSource,
    dialBandVersion: bandTable.forKnobConfigVersion,
    knobConfigVersion: deployedKnobConfigVersion,
  };

  const suppress = (reason) => ({
    effectiveTempo: 'standard',
    multiplier: 1.0,
    provenance: { ...provenanceBase, tempoEffective: 'standard', suppressionReason: reason },
  });

  // Garbage in the snapshot fails closed and visibly — never trust future UI.
  if (hasUserValue && !VALID_TEMPO_VALUES.includes(desiredTempo)) {
    return suppress(TEMPO_SUPPRESSION_REASONS.UNKNOWN_TEMPO_VALUE);
  }
  // A non-standard desire needs the dial ON…
  if (tempoDesired !== 'standard' && dialEnabled !== true) {
    return suppress(TEMPO_SUPPRESSION_REASONS.DIAL_DISABLED);
  }
  // …AND a band table calibrated for the DEPLOYED knob generation
  // (version-bound fail-closed, spec changelog #13).
  if (tempoDesired !== 'standard' && bandTable.forKnobConfigVersion !== deployedKnobConfigVersion) {
    return suppress(TEMPO_SUPPRESSION_REASONS.BAND_VERSION_MISMATCH);
  }

  // Standard (default or explicit) resolves cleanly — no suppression key.
  const effectiveTempo = tempoDesired;
  return {
    effectiveTempo,
    multiplier: bandTable.multipliers[effectiveTempo] ?? 1.0,
    provenance: { ...provenanceBase, tempoEffective: effectiveTempo },
  };
}

/**
 * Apply an effective tempo to a resolved hftConfig. IDENTITY when standard
 * (returns the input reference). Path-wise shallow clone otherwise — only the
 * five B4 §D band leaves change; absent sub-objects are never created.
 */
export function applyTempoToHftConfig(hftConfig, effectiveTempo, multiplier) {
  if (!hftConfig || effectiveTempo === 'standard' || multiplier === 1.0) return hftConfig;

  const out = { ...hftConfig };
  if (hftConfig.swapWindow && typeof hftConfig.swapWindow.capPerWindow === 'number') {
    out.swapWindow = {
      ...hftConfig.swapWindow,
      capPerWindow: Math.max(1, Math.round(hftConfig.swapWindow.capPerWindow * multiplier)),
    };
  }
  if (hftConfig.forcedRotation && typeof hftConfig.forcedRotation.ticksThreshold === 'number') {
    out.forcedRotation = {
      ...hftConfig.forcedRotation,
      ticksThreshold: Math.max(1, Math.round(hftConfig.forcedRotation.ticksThreshold / multiplier)),
    };
  }
  if (hftConfig.hurdleFloor) {
    const hf = { ...hftConfig.hurdleFloor };
    if (hf.byReason) {
      const byReason = { ...hf.byReason };
      for (const reason of ['haiku_decision', 'stagnation']) {
        if (byReason[reason] && typeof byReason[reason].atrMultiplier === 'number') {
          byReason[reason] = {
            ...byReason[reason],
            atrMultiplier: round2(byReason[reason].atrMultiplier / multiplier),
          };
        }
      }
      hf.byReason = byReason;
    }
    if (hf.default && typeof hf.default.atrMultiplier === 'number') {
      hf.default = { ...hf.default, atrMultiplier: round2(hf.default.atrMultiplier / multiplier) };
    }
    out.hurdleFloor = hf;
  }
  return out;
}

/**
 * The one-call composition for the Phase-2 choke point:
 *   const { hftConfig, provenance } = clampHftConfig({
 *     hftConfig: resolveHftConfig(baseArchetypeConfig, battle.gameMode),
 *     desiredTempo: desiredTempoOf(battle),
 *     dialEnabled: TEMPO_DIAL_ENABLED,
 *   });
 */
export function clampHftConfig({ hftConfig, desiredTempo, dialEnabled, deployedKnobConfigVersion, bandTable } = {}) {
  // resolveTempoDial's destructuring defaults fire on undefined values
  // exactly as on absent keys — plain pass-through.
  const { effectiveTempo, multiplier, provenance } = resolveTempoDial({
    desiredTempo,
    dialEnabled,
    deployedKnobConfigVersion,
    bandTable,
  });
  return {
    hftConfig: applyTempoToHftConfig(hftConfig, effectiveTempo, multiplier),
    effectiveTempo,
    multiplier,
    provenance,
  };
}
