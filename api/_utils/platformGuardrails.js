// api/_utils/platformGuardrails.js
//
// Archetype Architecture Phase 2 (P2.1) — the PlatformGuardrails contract
// (Spec §1.2, R1 finding 29). Documents-and-versions the EXISTING platform
// layer; no behavior change, zero production consumers in Phase 2. Every
// value below is the live repo value with its source cited — where the live
// substrate differs from a spec illustration, the live repo is authoritative
// (Spec governing principle) and the divergence is flagged.
//
// FENCE NOTE (BUILD_RULES §1): EMERGENCY_BYPASS_REASONS is imported from the
// fenced agentRiskManager.js — the census-confirmed single source of truth
// (import-by-reference, never redefined; reading fenced exports is
// permitted).

import { EMERGENCY_BYPASS_REASONS } from './agentRiskManager.js';
import { GUARDRAIL_SET_VERSION } from './archetypeVersionConstants.js';
import { SECTOR_CAP_MODE } from '../../src/config/featureFlags.js';
import { canonicalContentHash } from './canonicalHash.js';

/**
 * §1.2 contract object. precedencePosition 1 — ladder rung 1, overrides every
 * other layer, always (Platform → GameMode → Archetype identity → compiled
 * user constraints → user preferences → leans).
 */
export function buildPlatformGuardrails() {
  return {
    guardrailSetVersion: GUARDRAIL_SET_VERSION,
    floors: {
      // Preset-resolved risk levers: the platform guarantees the MECHANISM
      // (evaluateRisk bust/vwap gates); the numeric lever varies by the
      // battle's strategyPreset (agentPresetConfig.js PRESET_CONFIGS
      // aggressive/balanced/defensive: bustBuffer -0.90/-0.85/-0.75,
      // vwapFailureTicks 3/2/1). capSource records that resolution.
      bustBuffer: { capSource: 'preset', ref: 'agentPresetConfig.PRESET_CONFIGS[preset].risk.bustBuffer' },
      vwapFailure: { capSource: 'preset', ref: 'agentPresetConfig.PRESET_CONFIGS[preset].risk.vwapFailureTicks' },
      // Hard platform validation floor: a SWAP with conviction < 70 fails
      // validateTradeDecision (agentSwapExecution.js:77); the eval tool
      // schema instructs HOLD below 70 (agentEvalToolSchema.js:16) and the
      // approved-proposal path floors at 70 (agent-evaluate.js:2047). The
      // preset minConviction (65/75/85) is a preset-layer tightening ABOVE
      // this platform floor, except aggressive's 65 which the :77 floor
      // overrides at execution — platform wins (rung 1).
      convictionFloor: 70,
      // Revolving-door bench cooldown: swapped-out assets return to bench
      // with cooldownUntil = now + 24h (agentSwapExecution.js:311); swap-in
      // of a cooling asset is a validation error (:58-62).
      cooldownHours: 24,
      // Identity/duplicate invariants at execution (agentSwapExecution.js
      // :169-177): symbolIn === symbolOut rejected; symbolIn already in an
      // active slot rejected.
      selfSwapBan: true,
      duplicateSlotBan: true,
      // ATR-lock proximity: within 0.2 ATR-multiples below a threshold the
      // risk manager locks (threshold_proximity), fenced
      // agentRiskManager.js:8 (LOCK_PROXIMITY), applied :125.
      lockProximity: 0.2,
    },
    universalFilters: {
      // Distressed-regime swap-in guard: replacement selection flags a
      // distressed-regime candidate for downstream downgrade
      // (agentGuardrails.js:438-458 mirror of the executeSwapServer-side
      // validation).
      distressedSwapInBlock: true,
    },
    // Single source (census Map 1: exactly ONE definition, fenced
    // agentRiskManager.js:28-34). Composed by reference — never copied.
    emergencyBypassReasonsRef: EMERGENCY_BYPASS_REASONS,
    sectorCapPolicy: {
      // Live tri-state flag value, read at build time. CENSUS CONTRADICTION
      // (pending founder ruling, census Founder-Verify #1): the live value
      // 'true' matches neither 'observe' nor 'enforce', so the Diversifier
      // cap is inert at HEAD. Recorded, not corrected — §1.2 documents, it
      // does not fix.
      mode: SECTOR_CAP_MODE,
      capSource: 'agentGuardrails.DIVERSIFIER_SECTOR_CAP_PCT (hardcoded 35, flat6 Diversifier only)',
    },
    precedencePosition: 1,
  };
}

/** Content hash (version excluded) for the §1.2 bump-discipline lock. */
export function computePlatformGuardrailsHash() {
  const { guardrailSetVersion, emergencyBypassReasonsRef, ...content } = buildPlatformGuardrails();
  // The Set is hashed as its sorted member list (Sets don't JSON-serialize).
  return canonicalContentHash({
    ...content,
    emergencyBypassReasons: [...emergencyBypassReasonsRef].sort(),
  });
}
