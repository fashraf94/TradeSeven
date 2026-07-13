// src/data/characterState.js
//
// Release 3 (Character tab) — the STATE RESOLVER: the surface's brain. Given the
// live agent state + the governing flags, it resolves which of the Character
// tab's states is in effect and the per-control detail the UI renders.
//
// PURE + single-source (Display-Agreement §9 / spec §2.2, §2.4): it does NOT
// re-implement lean validity or tempo suppression — it CALLS the exact same
// authorities the backend uses:
//   • revalidateStandingLeans — the kernel the battle snapshot + change-archetype
//     rider use (so the tab, the frozen battle snapshot, and the telemetry can
//     never disagree about which leans are live vs dropped and why).
//   • resolveTempoDial — the same clamp the eval cron uses to fail closed to
//     'standard' with a visible suppressionReason.
// Both live in Node-clean api/_utils modules whose only transitive import is the
// Node-clean src/data/archetypeAdjustments.js, so the client can import them
// directly (the hurdleAtr.js / tournamentUserScoring precedent). A test file's
// REAL import of this module is the BUILD_RULES §4 dependency-surface guard.
//
// The five design states + one base 'live' state. Priority (highest wins):
//   preactivation  a governing control flag is OFF (rollback-only post-2026-07-12,
//                  but the runbook's staged-walk + rollback path depends on it —
//                  built and rendered honestly, never assumed unreachable).
//   battle         an active battle freezes the loadout (view-only).
//   changed        an equipped lean does not apply to the current archetype
//                  (not_in_menu — "your leans didn't carry").
//   reconfirm      an equipped lean's canonical text was revised (deprecated_version).
//   empty          no valid leans + standard tempo — the front door.
//   live           the everyday default: valid leans and/or a non-standard tempo,
//                  everything current, controls live.

import { revalidateStandingLeans, LEAN_INVALIDATION_REASONS } from '../../api/_utils/leanRevalidation.js';
import { resolveTempoDial } from '../../api/_utils/tempoDialClamp.js';

export const CHARACTER_STATES = Object.freeze({
  PREACTIVATION: 'preactivation',
  BATTLE: 'battle',
  CHANGED: 'changed',
  RECONFIRM: 'reconfirm',
  EMPTY: 'empty',
  LIVE: 'live',
});

/**
 * @param {Object} p
 * @param {boolean} p.leansEnabled       STANDING_LEANS_ENABLED (server flag mirror)
 * @param {boolean} p.dialEnabled        TEMPO_DIAL_ENABLED
 * @param {string|null} [p.activeBattleId] agent.activeBattleId — truthy = battle-locked
 * @param {string} p.archetype           agent.archetype (code-id)
 * @param {Array<{adjustmentId:string,version:number,equippedAt?:string}>} [p.standingLeans] agent.standingLeans
 * @param {string} [p.tempo]             agent.dials?.tempo (desired); absent === 'standard'
 * @returns {{
 *   state: string,
 *   leans: { valid: Array, invalidated: Array },
 *   tempo: { desired: string, effective: string, suppressed: boolean, suppressionReason: string|null },
 *   pending: { leans: boolean, tempo: boolean },
 *   isBattleLocked: boolean,
 * }}
 */
export function resolveCharacterState({
  leansEnabled,
  dialEnabled,
  activeBattleId = null,
  archetype,
  standingLeans = [],
  tempo = 'standard',
} = {}) {
  const desiredTempo = tempo || 'standard';

  // Lean validity — the exact authority the battle snapshot re-asserts at rest
  // (menu membership + version currency + conflict/cap/duplicate). `valid` carries
  // the RESOLVED CURRENT canonical text; `invalidated` carries {adjustmentId,
  // version, reason}.
  const { valid, invalidated } = revalidateStandingLeans({ standingLeans, archetypeCodeId: archetype });

  // Tempo desired → effective — the exact fail-closed clamp the eval cron runs.
  const { effectiveTempo, provenance } = resolveTempoDial({ desiredTempo, dialEnabled: dialEnabled === true });
  const suppressionReason = provenance?.suppressionReason || null;

  const hasNotInMenu = invalidated.some((l) => l.reason === LEAN_INVALIDATION_REASONS.NOT_IN_MENU);
  const hasDeprecated = invalidated.some((l) => l.reason === LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION);

  const pending = {
    leans: leansEnabled !== true,
    tempo: dialEnabled !== true,
  };

  // Priority: preactivation > battle > changed > reconfirm > empty > live.
  // preactivation leads so a suppressed control is never rendered as if it were
  // live (§9). In the staged-walk window where only ONE control is dark, the UI
  // reads pending.{leans,tempo} to render the live control normally and badge the
  // dark one — see Phase 2.
  let state;
  if (pending.leans || pending.tempo) {
    state = CHARACTER_STATES.PREACTIVATION;
  } else if (activeBattleId) {
    state = CHARACTER_STATES.BATTLE;
  } else if (hasNotInMenu) {
    state = CHARACTER_STATES.CHANGED;
  } else if (hasDeprecated) {
    state = CHARACTER_STATES.RECONFIRM;
  } else if (valid.length === 0 && desiredTempo === 'standard') {
    state = CHARACTER_STATES.EMPTY;
  } else {
    state = CHARACTER_STATES.LIVE;
  }

  return {
    state,
    leans: { valid, invalidated },
    tempo: {
      desired: desiredTempo,
      effective: effectiveTempo,
      suppressed: effectiveTempo !== desiredTempo && !!suppressionReason,
      suppressionReason,
    },
    pending,
    isBattleLocked: !!activeBattleId,
  };
}
