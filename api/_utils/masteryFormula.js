// api/_utils/masteryFormula.js
// Archetype Mastery — the XP formula + level curve (Spec V2 §4/§6; V2.1 memo
// of record: docs/ARCHETYPE_MASTERY_SPEC_V2_1_STOP_RULINGS_JUL21_2026.md).
//
// PURE MODULE — no Firestore, no clocks. Everything here is a function of
// its inputs so the §12 order-independence property test can permute freely.
//
// CONSTANTS ARE PROVISIONAL AT formulaVersion: 1 (V2.1 memo §9 ruling):
// design-intent targets, EVALUATED-ON-ASSUMPTIONS where the acceptance
// matrix needs the live score distribution (Phase 0 S11.9: no in-repo
// distribution exists; the 22 known battles are all pre-Jul-18). The
// recalibration checkpoint (≥100 post-Jul-18 settled battles) ships
// constants v2 at formulaVersion: 2 — NEVER retroactive: every award
// carries its own formulaVersion (spec §5), per-award versions are the
// source of truth, and settled awards are never recomputed.
//
// Fail-closed (spec §4): unknown/missing mode, alien archetype, non-finite
// score, ambiguous shape → terminal zero receipt reason 'quarantined' +
// server-only quarantine-ledger entry. NEVER defaults to 1.0 mode.

// Fence note (BUILD_RULES §1): agentArchetypeConfig.js is a FENCE file;
// importing/reading its exported VALID_ARCHETYPES constant is permitted —
// this is a read of a fence export, not a fence edit. One source for "what
// is an archetype" by construction.
import { VALID_ARCHETYPES } from './agentArchetypeConfig.js';

export const FORMULA_VERSION = 1;

// ---- XP components (spec §4) — PROVISIONAL, see header ----
export const MASTERY_XP_CONSTANTS = Object.freeze({
  PARTICIPATION: 25, // flat, any settled eligible battle
  PERFORMANCE_K: 0.5, // PERFORMANCE = clamp(round(currentScore × K), 0, CAP)
  PERFORMANCE_CAP: 60,
  PLACEMENT_PER_HUMAN: 30, // per human opponent strictly outplaced
  PLACEMENT_CAP: 60,
  CPU_PLACEMENT: 8, // flat, 0 humans outplaced but first against the field (< 1v1 human win — acceptance (e))
  COMPLETION: 20, // multi-day battle fully completed (see idle-tension note in the P1 constants proposal)
});

// MODE_MULT (spec §4, spec-fixed): ranked/league 1.0, training 0.6.
export const MODE_MULTS = Object.freeze({
  ranked: 1.0,
  league: 1.0,
  training: 0.6,
});
// Module-local: consumed only by validateFormulaInputs (MODE_MULTS is the
// public mode contract).
const MODE_KINDS = Object.freeze(Object.keys(MODE_MULTS));

// Valid rate bands (spec §3) — used only for fail-closed input validation.
const VALID_RATE_BANDS = Object.freeze([1.0, 0.5, 0]);

// ---- Level curve (spec §6, founder-ratified D1): 10 levels, cumulative XP
// to REACH level (index+1). Bands: Novice 1–3 / Adept 4–7 / Master 8–10 (D5).
export const LEVEL_XP_THRESHOLDS = Object.freeze([
  0, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400,
]);
export const MAX_LEVEL = LEVEL_XP_THRESHOLDS.length; // 10

/** Cumulative XP → level (1..10). Non-finite/negative XP → level 1. */
export function levelForXp(xp) {
  if (!Number.isFinite(xp) || xp < 0) return 1;
  let level = 1;
  for (let i = 0; i < LEVEL_XP_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

// ---- Public reasonCode enum (spec §4): the ONLY vocabulary a receipt may
// carry publicly. Diagnostics live in the server-only quarantine ledger; the
// Film Room never renders internals.
export const REASON_CODES = Object.freeze({
  QUARANTINED: 'quarantined',
  DAILY_CEILING: 'daily_ceiling',
  FLAG_DISABLED: 'flag_disabled',
});

/**
 * Fail-closed input validation (spec §4). Returns null when inputs are sound,
 * else a server-only diagnostic string (the public receipt says only
 * 'quarantined').
 */
export function validateFormulaInputs({ modeKind, archetype, currentScore, rateBand }) {
  if (!MODE_KINDS.includes(modeKind)) return `unknown_mode:${String(modeKind)}`;
  if (typeof archetype !== 'string' || !VALID_ARCHETYPES.includes(archetype)) {
    return `alien_archetype:${String(archetype)}`;
  }
  if (!Number.isFinite(currentScore)) return `non_finite_score:${String(currentScore)}`;
  if (!VALID_RATE_BANDS.includes(rateBand)) return `invalid_rate_band:${String(rateBand)}`;
  return null;
}

/**
 * The §4 XP computation, pure:
 *
 *   xpBase  = PARTICIPATION + PERFORMANCE + PLACEMENT + COMPLETION
 *   xpFinal = round(xpBase × MODE_MULT × rateBand)
 *
 * PERFORMANCE floors at 0, never negative. PLACEMENT pays strictly-outplaced
 * humans only (an engineered N-way tie pays zero placement to all N — spec
 * §4); with 0 humans outplaced, a strict first place against the field pays
 * flat CPU_PLACEMENT, else 0. COMPLETION pays only a multi-day battle that
 * ran to term on the settlement path.
 *
 * Callers MUST validateFormulaInputs first; this function assumes sound inputs.
 */
export function computeXp({ modeKind, currentScore, humansOutplaced, wonAgainstField, isMultiDay, rateBand }) {
  const C = MASTERY_XP_CONSTANTS;
  const participation = C.PARTICIPATION;
  const performance = Math.min(
    Math.max(Math.round(currentScore * C.PERFORMANCE_K), 0),
    C.PERFORMANCE_CAP
  );
  const outplaced = Number.isInteger(humansOutplaced) && humansOutplaced > 0 ? humansOutplaced : 0;
  const placement = outplaced > 0
    ? Math.min(C.PLACEMENT_PER_HUMAN * outplaced, C.PLACEMENT_CAP)
    : (wonAgainstField === true ? C.CPU_PLACEMENT : 0);
  const completion = isMultiDay === true ? C.COMPLETION : 0;

  const xpBase = participation + performance + placement + completion;
  const modeMult = MODE_MULTS[modeKind];
  const xpFinal = Math.round(xpBase * modeMult * rateBand);

  return {
    components: { participation, performance, placement, completion },
    xpBase,
    modeMult,
    xpFinal,
  };
}

/**
 * masteryAward doc shape (spec §5, as amended by the P2 greenlight ruling —
 * the placementInputs? addition is founder-directed; flagged in the P2
 * report for a V2.x shape-delta record so backfill/rules authors never work
 * from a stale enumeration):
 * { archetype, components, multipliers: {mode, rateBand}, xpFinal,
 *   levelBefore, levelAfter, levelProvisional?, formulaVersion, epochId,
 *   reasonCode?, settledAt, backfilled?, placementInputs? }
 * placementInputs rides PAYING awards only — never zero receipts (§4:
 * public reasonCode only). Optional keys are included only when set —
 * absent, not null (the write-once absence guard keys on the masteryAward
 * field itself).
 */
export function buildAwardDoc({
  archetype,
  components,
  modeMult,
  rateBand,
  xpFinal,
  levelBefore,
  levelAfter,
  epochId,
  settledAt,
  reasonCode,
  levelProvisional,
  backfilled,
  placementInputs,
}) {
  return {
    archetype,
    components,
    multipliers: { mode: modeMult, rateBand },
    xpFinal,
    levelBefore,
    levelAfter,
    formulaVersion: FORMULA_VERSION,
    epochId,
    settledAt,
    ...(reasonCode ? { reasonCode } : {}),
    ...(levelProvisional === true ? { levelProvisional: true } : {}),
    ...(backfilled === true ? { backfilled: true } : {}),
    // P2 auditability (founder-directed): the exact sibling ids + scores
    // placement consumed — see computePlacementInputs. Real awards only.
    ...(placementInputs ? { placementInputs } : {}),
  };
}

/**
 * Terminal zero receipt (spec §4): a REAL masteryAward doc with xpFinal: 0
 * and a public reasonCode only. levelBefore === levelAfter (no movement).
 */
export function buildZeroReceipt({ archetype, reasonCode, epochId, settledAt, level, rateBand = 0, modeMult = 0 }) {
  return buildAwardDoc({
    archetype,
    components: { participation: 0, performance: 0, placement: 0, completion: 0 },
    modeMult,
    rateBand,
    xpFinal: 0,
    levelBefore: level,
    levelAfter: level,
    epochId,
    settledAt,
    reasonCode,
  });
}
