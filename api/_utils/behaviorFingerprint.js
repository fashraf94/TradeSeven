// api/_utils/behaviorFingerprint.js
//
// Release 3 (Character tab) — the behavior FINGERPRINT, DERIVED from the real
// resolved knob config for (archetype, tempoPosition). It replaces the design
// mock's invented FP_BASE + TEMPO_SHIFT constants (a demo fixture) with a pure
// read of the values production actually resolves. This is the §2.1 override:
// "the rendered axis vector equals the vector computed from the resolved config;
// a changed knob value must move the shape; no hardcoded axis constants survive."
//
// FENCE / IMPORT POSTURE (BUILD_RULES §1, §4):
//   - NOT fenced. Pure: no I/O, no Firestore, no clock, no randomness — the
//     hurdleAtr.js precedent for a Node-clean helper shared by api/ AND the
//     client (a test file's real import of this module IS the dependency-surface
//     guard — never mock it).
//   - It READS the fenced agentArchetypeConfig.js (getArchetypeConfig /
//     resolveHftConfig / ARCHETYPE_CONFIGS). Reading/calling fenced exports is
//     PERMITTED (BUILD_RULES §1:12); the precedent is tempoDialClamp.js:47, which
//     already imports KNOB_CONFIG_VERSION from it. This module never edits it.
//   - The tempo transform is the SAME non-fenced clamp the eval cron uses
//     (applyTempoToHftConfig / resolveTempoDial), so displayed disposition and
//     live behavior derive from ONE path and cannot drift (Display-Agreement §9).
//
// PROVISIONAL (like tempoDialBands.js): the axis→field mapping below and the
// normalization curve are Release-3 starting definitions. The STRUCTURE is
// blocking-tested (derived, dial-responsive vs fixed, knob-moves-shape); the
// exact raw-metric formulas + normalization are a calibrated artifact pending
// founder sign-off — they are NOT founder-locked finals.
//
// ── The five axes ──────────────────────────────────────────────────────────
// Founder ruling (Q3, 2026-07-13): three axes respond to the tempo dial; two
// are FIXED archetype anchors the dial never moves (rendered visually distinct,
// captioned "set by your archetype — the dial doesn't move these").
//
// DIAL-RESPONSIVE (move with the tempo dial via applyTempoToHftConfig):
//   tempo    "How often it rotates"          ← swapWindow.capPerWindow (×mult)
//   reach    "How far it stretches"          ← 1 / hurdleFloor.default.atrMultiplier (floor ÷mult)
//   patience "How long it holds through noise"← forcedRotation.ticksThreshold (÷mult),
//                                               or MAX when forced rotation is DISABLED
//                                               (guardian never force-rotates → maximally
//                                               patient AND dial-invariant — a truthful
//                                               special case).
// FIXED ANCHORS (set at creation, dial-invariant — live OUTSIDE resolveHftConfig):
//   concentration "How much it piles into what works" ← sectorConcentrationCap (direct)
//   discipline    "How tightly it cuts"               ← 1 / (preset.trailStopATR × preset.vwapFailureTicks)
//                                                        via archetypeConfig.defaultPreset
//
// WHY capPerWindow (not 1/ticksThreshold) for Tempo: the design/verifier flagged
// that a naive Tempo←1/ticksThreshold collides with Patience←ticksThreshold (they
// become mechanical inverses). Binding Tempo to the always-active swap-window
// ceiling gives each axis its OWN primary field and keeps both dial-responsive
// without collision. (forcedRotation.ticksThreshold is inert while
// forcedRotation.enabled is false, so Tempo must not depend on it either.)

import {
  getArchetypeConfig,
  resolveHftConfig,
  ARCHETYPE_CONFIGS,
  VALID_ARCHETYPES,
} from './agentArchetypeConfig.js';
import { resolveTempoDial, applyTempoToHftConfig } from './tempoDialClamp.js';
import { VALID_TEMPO_VALUES } from './tempoDialBands.js';
import { getPresetConfig } from './agentPresetConfig.js';

// Axis metadata (label + blurb mirror the design's FP_AXES copy; `kind` encodes
// the Q3 dial-responsive vs fixed-anchor distinction the UI renders + captions).
export const FINGERPRINT_AXES = Object.freeze([
  { key: 'tempo', label: 'Tempo', blurb: 'How often it rotates', kind: 'dial' },
  { key: 'reach', label: 'Reach', blurb: 'How far it stretches for a setup', kind: 'dial' },
  { key: 'patience', label: 'Patience', blurb: 'How long it holds through noise', kind: 'dial' },
  { key: 'concentration', label: 'Concentration', blurb: 'How much it piles into what works', kind: 'anchor' },
  { key: 'discipline', label: 'Discipline', blurb: 'How tightly it cuts', kind: 'anchor' },
]);

export const DIAL_RESPONSIVE_AXES = Object.freeze(FINGERPRINT_AXES.filter((a) => a.kind === 'dial').map((a) => a.key));
export const FIXED_ANCHOR_AXES = Object.freeze(FINGERPRINT_AXES.filter((a) => a.kind === 'anchor').map((a) => a.key));

// Render clamp — no spoke is ever exactly 0 or 1 (the shape stays legible).
const FP_MIN = 0.06;
const FP_MAX = 0.97;
const clampFP = (v) => Math.max(FP_MIN, Math.min(FP_MAX, v));

/**
 * Resolve the full knob config for a hypothetical (archetype, tempoPosition) —
 * the EXACT path production uses: archetype-locked hftConfig, then the tempo
 * clamp. When the dial is disabled or the band-version mismatches, the clamp
 * fails closed to 'standard' (identity config), so the fingerprint honestly
 * shows the standard shape (matching what the agent would actually run).
 *
 * @param {string} archetype
 * @param {string} tempoPosition  measured|standard|aggressive
 * @param {{configs?: Object, gameMode?: string, dialEnabled?: boolean}} [opts]
 * @returns {{ archetypeConfig: Object, resolvedHftConfig: Object|null, effectiveTempo: string }}
 */
export function resolveConfigForFingerprint(archetype, tempoPosition, opts = {}) {
  const { configs = ARCHETYPE_CONFIGS, gameMode, dialEnabled = true } = opts;
  const archetypeConfig = configs[archetype] || configs.analyst || getArchetypeConfig(archetype);
  const baseHft = resolveHftConfig(archetypeConfig, gameMode);
  const { effectiveTempo, multiplier } = resolveTempoDial({ desiredTempo: tempoPosition, dialEnabled });
  const resolvedHftConfig = applyTempoToHftConfig(baseHft, effectiveTempo, multiplier);
  return { archetypeConfig, resolvedHftConfig, effectiveTempo };
}

/**
 * THE axis→field mapping, as pure numbers (before normalization). Higher raw =
 * more of that axis quality. This is the single home of the mapping — both the
 * helper and its blocking test read it, so they cannot drift.
 *
 * @param {Object} archetypeConfig   the (possibly fixture) archetype config
 * @param {Object} resolvedHftConfig the tempo-resolved hftConfig
 * @returns {{tempo:number, reach:number, patience:number, concentration:number, discipline:number}}
 */
export function rawAxisMetrics(archetypeConfig, resolvedHftConfig) {
  const hft = resolvedHftConfig || {};
  const fr = hft.forcedRotation || {};
  const sw = hft.swapWindow || {};
  const floorDefault = hft.hurdleFloor?.default?.atrMultiplier;

  // Tempo — swap-window ceiling (always active; ×mult under the dial).
  const tempo = Number.isFinite(sw.capPerWindow) ? sw.capPerWindow : 0;

  // Reach — inverse of the quality-gate floor (lower floor reaches further; ÷mult).
  const reach = Number.isFinite(floorDefault) && floorDefault > 0 ? 1 / floorDefault : 0;

  // Patience — forced-rotation threshold (÷mult, higher = holds longer). A
  // DISABLED forced rotation means the agent never mechanically rotates → the
  // most patient posture there is, and dial-invariant. We pin it to the top of
  // the enabled range (+1) so it reads as maximal without a hardcoded axis value.
  const patience = fr.enabled === false ? PATIENCE_DISABLED_RAW : (Number.isFinite(fr.ticksThreshold) ? fr.ticksThreshold : 0);

  // Concentration (ANCHOR) — the per-sector ceiling (higher cap = more willing
  // to pile into one sector). Top-level, NOT dial-touched.
  const concentration = Number.isFinite(archetypeConfig?.sectorConcentrationCap) ? archetypeConfig.sectorConcentrationCap : 0;

  // Discipline (ANCHOR) — exit tightness of the archetype's default preset:
  // inverse of (trailing-stop distance × VWAP-failure tolerance). Tighter stop
  // and quicker cut → higher discipline. NOT dial-touched.
  const preset = getPresetConfig(archetypeConfig?.defaultPreset);
  const trail = preset?.risk?.trailStopATR;
  const vwapTicks = preset?.risk?.vwapFailureTicks;
  const looseness = (Number.isFinite(trail) && trail > 0 ? trail : 1) * (Number.isFinite(vwapTicks) && vwapTicks > 0 ? vwapTicks : 1);
  const discipline = looseness > 0 ? 1 / looseness : 0;

  return { tempo, reach, patience, concentration, discipline };
}

// The raw patience value for a disabled forced rotation: one tick above the
// largest ENABLED ticksThreshold across the roster, so "never force-rotates"
// reads as maximally patient. Derived, not hardcoded to a magnitude.
const PATIENCE_DISABLED_RAW = (() => {
  let maxEnabled = 0;
  for (const cfg of Object.values(ARCHETYPE_CONFIGS)) {
    const fr = cfg?.hftConfig?.forcedRotation;
    if (fr && fr.enabled !== false && Number.isFinite(fr.ticksThreshold)) maxEnabled = Math.max(maxEnabled, fr.ticksThreshold);
  }
  return maxEnabled + 1;
})();

/**
 * Product-wide min/max per axis, DERIVED by scanning every archetype × dial
 * position. Normalizing on this shared scale (a) preserves each archetype's base
 * disposition (a Speculator sits high on Tempo, a Capital Preserver low) and
 * (b) lets the dial visibly slide the responsive axes within that scale. The
 * base archetype gaps dwarf the ±30% dial swing, so the "stays in its lane"
 * promise (Guardian@Aggressive is still calmer than Speculator@Measured) holds
 * by construction of the real knobs — verified in the blocking test.
 *
 * Memoized per `configs` object identity so the default roster computes once
 * while a test may inject a mutated roster.
 */
const _rangeCache = new WeakMap();
export function computeAxisRanges(configs = ARCHETYPE_CONFIGS) {
  if (_rangeCache.has(configs)) return _rangeCache.get(configs);
  const ranges = {};
  for (const axis of FINGERPRINT_AXES) ranges[axis.key] = { min: Infinity, max: -Infinity };
  const archetypes = Object.keys(configs).filter((k) => VALID_ARCHETYPES.includes(k));
  for (const archetype of archetypes) {
    // Fixed anchors are dial-invariant, so scanning 'standard' alone covers them;
    // dial-responsive axes need all three positions to bound their swing.
    for (const tempo of VALID_TEMPO_VALUES) {
      const { archetypeConfig, resolvedHftConfig } = resolveConfigForFingerprint(archetype, tempo, { configs });
      const raw = rawAxisMetrics(archetypeConfig, resolvedHftConfig);
      for (const axis of FINGERPRINT_AXES) {
        const v = raw[axis.key];
        if (!Number.isFinite(v)) continue;
        if (v < ranges[axis.key].min) ranges[axis.key].min = v;
        if (v > ranges[axis.key].max) ranges[axis.key].max = v;
      }
    }
  }
  _rangeCache.set(configs, ranges);
  return ranges;
}

const normalize = (raw, range) => {
  if (!range || !Number.isFinite(raw)) return FP_MIN;
  const span = range.max - range.min;
  if (span <= 0) return clampFP(0.5); // a degenerate (all-equal) axis renders mid
  return clampFP(FP_MIN + ((raw - range.min) / span) * (FP_MAX - FP_MIN));
};

/**
 * Compute the behavior fingerprint for a hypothetical (archetype, tempoPosition).
 * Leans do NOT enter this computation (they annotate the shape elsewhere, never
 * reshape it — the design honesty contract).
 *
 * @param {string} archetype       code-id (momentum_chaser|analyst|diversifier|contrarian|degen|guardian)
 * @param {string} tempoPosition   measured|standard|aggressive
 * @param {{configs?: Object, gameMode?: string, dialEnabled?: boolean}} [opts]
 * @returns {{
 *   archetype: string,
 *   tempo: string,                         // the effective tempo the shape reflects
 *   axes: Record<string, number>,          // 0.06..0.97 per axis key
 *   raw: Record<string, number>,           // pre-normalization metrics (provenance)
 *   dialResponsive: string[],              // axis keys the dial moves
 *   fixed: string[],                       // axis keys pinned by archetype
 * }}
 */
export function computeFingerprint(archetype, tempoPosition, opts = {}) {
  const { configs = ARCHETYPE_CONFIGS } = opts;
  const { archetypeConfig, resolvedHftConfig, effectiveTempo } = resolveConfigForFingerprint(archetype, tempoPosition, opts);
  const raw = rawAxisMetrics(archetypeConfig, resolvedHftConfig);
  const ranges = computeAxisRanges(configs);
  const axes = {};
  for (const axis of FINGERPRINT_AXES) axes[axis.key] = normalize(raw[axis.key], ranges[axis.key]);
  return {
    archetype,
    tempo: effectiveTempo,
    axes,
    raw,
    dialResponsive: [...DIAL_RESPONSIVE_AXES],
    fixed: [...FIXED_ANCHOR_AXES],
  };
}

/**
 * Convenience for the tab: all three dial positions at once, so the client can
 * animate the dial with zero re-fetch (Option A's payoff). Returns the effective
 * shape per position plus the ghost/desired distinction the UI overlays.
 *
 * @param {string} archetype
 * @param {{gameMode?: string, dialEnabled?: boolean}} [opts]
 * @returns {{measured: Object, standard: Object, aggressive: Object}}
 */
export function computeFingerprintByTempo(archetype, opts = {}) {
  const out = {};
  for (const tempo of VALID_TEMPO_VALUES) out[tempo] = computeFingerprint(archetype, tempo, opts);
  return out;
}
