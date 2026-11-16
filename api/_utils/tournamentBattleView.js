// api/_utils/tournamentBattleView.js
//
// P7 — server-side WHY projection for spectator reads of tournament battles.
//
// FOUNDER RULING R-F (15 Nov 2026, security pack — supersedes the completion
// unlock below): "Spectating stays possible. The fix is what a non-owner can
// see, at any battle status." A NON-owner gets the allowlist projection at
// EVERY status; completion opens nothing more. Chat, the instruction, the list,
// the hot bench, reasoning, proposals, guardrail levels and the loadout never
// leave the server for a non-owner, and no non-owner projection carries an
// account id (`ownerId` left the allowlist; the route keys its battles by seat,
// never by owner — src/constants/leagueTournament.js seatIndexByOwner). The
// owner's own view is unchanged. Report:
// docs/audits/20261115_FIX_SECURITY_PACK_LEAGUE_VIEW.md.
//
// FOUNDER RULING (P7 Stage A): the live WHY must be concealed SERVER-SIDE for
// non-owners, not by client non-render — the agentBattles read rule is
// owner-private, and an authenticated client read would otherwise ship every
// spectator the reasoning over the wire. So spectators NEVER read the doc
// directly; they read it through /api/tournament/battle-view, which calls this
// projector. Chosen over relaxing the read rule precisely because only the
// server path can strip WHY at the read boundary — net result: ZERO
// firestore-rule change (P7 Stage 0 erratum resolved the clean way).
//
// Transparency contract (V2.1 §9, as amended by R-F): WHAT — positions,
// per-asset state, statusFeed narration MESSAGES, scoreState, the double-down
// stance, the frozen initial lineup — is PUBLIC to all. WHY — the agent's
// reasoning AND its strategy surface (innerMonologue, strategy brief, Forge
// rules/citations, guardrails, equipped watchlist, the swap-candidate
// watchlist, per-evaluation/-trade rationale & hypothesis, proposals, gameplan,
// chat, the Film Room ledger, the player's frozen idea `equippedHypothesis`) —
// is OWNER-ONLY, live and after completion. (The pre-R-F contract opened it to
// all at completion — the Film Room unlock — minus the frozen idea, Pilot P1b.)
//
// The non-owner projection is built from ALLOWLISTS, deliberately (P7 code
// review): a denylist leaked the swap-candidate `watchlist` and the
// agentContext strategy fields when the doc shape grew. With an allowlist,
// anything not explicitly public is concealed BY DEFAULT — a new field added to
// the battle doc later cannot leak. Pure + node-clean (one zero-import schema
// import) so the projection is unit-tested directly.

import { pickCurrentTournamentBattle, seatIndexByOwner } from '../../src/constants/leagueTournament.js';

// PUBLIC WHAT — the only top-level keys a non-owner sees, at every status.
// statusFeed/trades/agentContext are projected separately (sub-allowlisted).
// `ownerId` is DELIBERATELY ABSENT (R-F): an account id never reaches another
// player's browser through this view. No league reader reads it (the
// security-pack report's reader table); a seat is identified by its key in
// the route's seat-keyed map.
const PUBLIC_TOP_LEVEL = [
  'id', 'agentId', 'status', 'gameMode', 'groupId', 'isCpu',
  'duration', 'createdAt', 'activatedAt', 'completedAt', 'expiresAt', 'updatedAt',
  'timing', 'portfolio', 'opponent', 'scoring', 'scoreState', 'thresholdHistory',
];
// PUBLIC agentContext — identity + the public double-down stance + the frozen
// starting lineup. NOT innerMonologue / strategyBrief / consolidatedInsight /
// activeRules / deployedGuardrails / equippedWatchlist / equippedBundleIds /
// riskTolerance (all strategy WHY).
const PUBLIC_AGENT_CONTEXT = ['agentName', 'archetype', 'tournament', 'initialPortfolio'];
// PUBLIC statusFeed entry — the narration MESSAGE + the trade WHAT; NOT
// trade_reasoning / citedRules / citedForgeRules / directiveThreadId, etc.
//
// `source` and `triggeredBy` are DELIBERATELY ABSENT (Phase 0 V2 Hazard 12).
// They name the MECHANISM that fired a swap — 'risk_manager' / 'guardrail' /
// 'haiku' / 'gameplan_meeting' (agent-evaluate.js stamps both on the swap
// entry) — which is WHY, not WHAT, and PUBLIC_TRADE below already withholds
// the same attribution from the sibling trades[] projection. Letting them
// through here let a rival read which mechanism moved an opponent's book
// mid-battle while the trade record said nothing: one posture, two lists,
// disagreeing. They stay out for a non-owner at every status (R-F: completion
// opens nothing more).
//
// `executionOutcome` is WHAT, not WHY (enforce readiness, table G V1.4): the
// typed marker that the swap's outcome could not be confirmed. A spectator's
// pane drops a marked beat exactly as the owner's does — without the marker it
// rendered the beat's pre-execution words (or its raw action) as if the record
// vouched for them. It names no mechanism and no reasoning.
const PUBLIC_STATUSFEED = ['timestamp', 'message', 'action', 'regime', 'score', 'symbolOut', 'symbolIn', 'executionOutcome'];
// PUBLIC trade entry — execution facts (drives the banked-score WHAT); NOT
// rationale / hypothesis / trade_reasoning / snapshot / Forge citations.
const PUBLIC_TRADE = ['symbolOut', 'symbolIn', 'name', 'slotIndex', 'entryPrice', 'exitPrice', 'lockedPoints', 'lockedGainPct', 'swappedOutAt', 'swapDay', 'action', 'tier', 'isCrypto'];

function pick(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

/**
 * Project a tournament battle doc for a given viewer.
 *
 * - Owner (ownerId === viewerUid) → returned UNCHANGED, live and after
 *   completion (full WHY: the owner sees their own reasoning and their own
 *   frozen idea, `agentContext.equippedHypothesis`).
 * - Non-owner, at EVERY status (founder ruling R-F, 15 Nov 2026) → WHAT-only
 *   projection built from the allowlists above. Completion opens nothing more.
 *   The frozen idea is not on the allowlist, so Pilot P1b's "owner sees full,
 *   others none" (pilot spec §2.7) holds by construction. Stamped
 *   `_whyConcealed: true` so the client renders the honest "reasoning is
 *   private to its owner" note rather than mistaking concealment for absence.
 *
 * @param {Object} battle    the raw agentBattles doc (with id)
 * @param {{ isOwner: boolean }} opts
 * @returns {Object} a NEW object for the non-owner case (input never mutated);
 *   the same reference for the owner.
 */
export function projectTournamentBattle(battle, { isOwner = false } = {}) {
  if (!battle) return battle;
  if (isOwner) return battle; // full transparency: the owner, live and after

  // Non-owner, any status → WHAT-only (allowlist; nothing leaks by default).
  const projected = pick(battle, PUBLIC_TOP_LEVEL);
  projected.agentContext = pick(battle.agentContext, PUBLIC_AGENT_CONTEXT);
  projected.statusFeed = Array.isArray(battle.statusFeed)
    ? battle.statusFeed.map((e) => pick(e, PUBLIC_STATUSFEED))
    : [];
  projected.trades = Array.isArray(battle.trades)
    ? battle.trades.map((t) => pick(t, PUBLIC_TRADE))
    : [];
  projected._whyConcealed = true;
  return projected;
}

/**
 * Map ownerId -> the CURRENT battle for that owner from a group's battles
 * (daily-chained: many docs per owner across a week). The per-owner pick — the
 * active battle, else the most recent by createdAt — is the shared
 * `pickCurrentTournamentBattle` (ONE home; the client hook uses the same rule).
 * Pure.
 *
 * @param {Array} battles  raw agentBattles docs for one group
 * @returns {Object} map ownerId -> the chosen raw battle doc
 */
export function pickCurrentBattlesByOwner(battles) {
  const byOwner = {};
  for (const b of battles || []) {
    if (!b || !b.ownerId) continue;
    (byOwner[b.ownerId] ||= []).push(b);
  }
  const out = {};
  for (const [ownerId, docs] of Object.entries(byOwner)) {
    out[ownerId] = pickCurrentTournamentBattle(docs);
  }
  return out;
}

/**
 * The league view's `battles` map for one viewer (founder ruling R-F, 15 Nov
 * 2026): each seat's CURRENT battle, projected for the viewer, keyed by SEAT —
 * the owner's index in the group's `players` ('0'..'3', the shared
 * seatIndexByOwner) — never by owner, so no account id travels as a key. A
 * battle whose owner holds no seat in `players` is left out: no reader could
 * place it. Pure.
 *
 * @param {Array} battles    raw tournament agentBattles docs for one group (with id)
 * @param {Array} players    the group document's `players`
 * @param {string} viewerUid the signed-in viewer
 * @returns {Object} seat key -> projected battle
 */
export function projectBattlesBySeat(battles, players, viewerUid) {
  const seats = seatIndexByOwner(players);
  const out = {};
  for (const [ownerId, battle] of Object.entries(pickCurrentBattlesByOwner(battles))) {
    const seat = seats.get(ownerId);
    if (seat === undefined) continue;
    out[seat] = projectTournamentBattle(battle, { isOwner: ownerId === viewerUid });
  }
  return out;
}
