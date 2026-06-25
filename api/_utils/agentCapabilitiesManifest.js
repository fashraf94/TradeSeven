// api/_utils/agentCapabilitiesManifest.js
//
// Archetype-Integrity / "Third Path" — Phase B (V2 plan, Contract B).
// A PURE, non-fenced builder that bounds the agent's hand-off language: the
// voice/gate may point the user at a lever ONLY when its manifest flag is true.
// This is what keeps the corrected mode-aware hand-off model honest (Capital
// Preserver doc §11–17): the agent adjusts its OWN book by conversation in every
// mode, but it may only point at a USER action that actually exists in THIS mode.
//
// Inert in Phase B — nobody imports it yet (C/D/E wire it). No live behavior.
//
// FENCE: reads only `battle.gameMode` (a permitted field read, not the fenced
// `createAgentBattle` doc-SHAPE) and a NON-FENCED tournament `group` context.
// The flip/claim caps come from the canonical TOURNAMENT_TUNING constant — never
// a local copy (BUILD_RULES §4). The fenced battle-doc shape is NOT consulted.
//
// PHASE E supplies the resolved, non-fenced inputs on `group` (this is the
// fetch/assembly seam, deliberately out of Phase B scope):
//   - status            : GROUP_STATUS — gate user actions on BATTLE.
//   - userPicks         : the CURRENT user's picks, each {flipCountToday,
//                          flipCountDate}. Source: group.players[me].picks
//                          (api/tournament/flip.js:141-149).
//   - pendingClaimCount : count of the user's pending claims. Source: the
//                          `claims` collection `where(odUserId).where(status==
//                          'pending')` query (tournamentClaimPlacement.js:111-113).
//   - claimWindowOpen   : ET claim-window boolean. Source: tournamentTime.js
//                          claim-placement window (Phase E resolves; default-safe).
//   - etDate            : 'YYYY-MM-DD' ET today, for the per-pick flip reset.
//
// NOTE for founder review (discovery refinement): the flip cap is PER-PICK per
// day, NOT per-user (flip.js:148-150 — each pick resets at ET midnight and caps
// at FLIP_CAP_PER_DAY independently). So a single user-level `flipsRemaining`
// number is necessarily a summary; we expose the BEST remaining capacity across
// the user's picks ("the most flips you could still do on a single pick today"),
// which is the honest bound for "can the user still flip?" hand-off language.

import {
  TOURNAMENT_GAME_MODE,
  GROUP_STATUS,
  TOURNAMENT_TUNING,
} from '../../src/constants/leagueTournament.js';

const clamp0 = (n) => (Number.isFinite(n) ? Math.max(0, n) : 0);

// Flips a single pick has already used TODAY (resets across ET midnight via
// flipCountDate — mirrors flip.js:149).
function flipsUsedToday(pick, etDate) {
  if (!pick) return 0;
  return pick.flipCountDate === etDate ? clamp0(pick.flipCountToday || 0) : 0;
}

// Best remaining flip capacity across the user's picks (per-pick cap; see header).
function bestFlipsRemaining(userPicks, etDate) {
  const picks = Array.isArray(userPicks) ? userPicks : [];
  if (picks.length === 0) return 0;
  return picks.reduce((best, pick) => {
    const remaining = clamp0(TOURNAMENT_TUNING.FLIP_CAP_PER_DAY - flipsUsedToday(pick, etDate));
    return remaining > best ? remaining : best;
  }, 0);
}

/**
 * Build the user-capabilities manifest for an agent battle.
 *
 * @param {Object}  args
 * @param {Object}  args.battle  - the agent battle doc (read `gameMode` only).
 * @param {Object} [args.group]  - the NON-FENCED tournament context for the
 *                                 current user (see header), or null/absent for
 *                                 standard battles.
 * @returns {{
 *   user_can_short: boolean,
 *   user_can_make_claims: boolean,
 *   user_can_hedge: false,
 *   options_enabled: false,
 *   sector_hedges_enabled: false,
 *   flipsRemaining: number|null,
 *   claimsRemaining: number|null,
 * }}
 */
export function buildCapabilitiesManifest({ battle, group } = {}) {
  // These three levers do not exist in V1 — permanently un-referenceable in
  // BOTH modes so the agent can never point at a hedge/options/sector-hedge
  // mechanic the game does not have.
  const base = {
    user_can_short: false,
    user_can_make_claims: false,
    user_can_hedge: false,
    options_enabled: false,
    sector_hedges_enabled: false,
    flipsRemaining: null,
    claimsRemaining: null,
  };

  const isTournament = battle?.gameMode === TOURNAMENT_GAME_MODE && !!group;
  if (!isTournament) {
    // Standard battle: the user has NO trade lever. Honest hand-off is
    // "coach me a directive / equip a watchlist," never "do that trade."
    return base;
  }

  const inBattle = group.status === GROUP_STATUS.BATTLE;
  const flipsRemaining = bestFlipsRemaining(group.userPicks, group.etDate);
  const claimsRemaining = clamp0(
    TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE - clamp0(group.pendingClaimCount || 0),
  );

  return {
    ...base,
    // Flip (long↔short) is the user's ONLY way to go short — gated on an active
    // battle and at least one pick with remaining flip capacity today.
    user_can_short: inBattle && flipsRemaining > 0,
    // Claims need an active battle, the ET claim window open, and budget left.
    user_can_make_claims: inBattle && group.claimWindowOpen === true && claimsRemaining > 0,
    flipsRemaining,
    claimsRemaining,
  };
}

export default buildCapabilitiesManifest;
