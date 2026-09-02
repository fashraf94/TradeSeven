// api/_utils/tournamentBattleView.js
//
// P7 — server-side WHY projection for spectator reads of tournament battles.
//
// FOUNDER RULING (P7 Stage A): the live WHY must be concealed SERVER-SIDE for
// non-owners during an ACTIVE battle, not by client non-render — the
// agentBattles read rule is owner-private (firestore.rules:201-202), and an
// authenticated client read would otherwise ship every spectator the live
// reasoning over the wire, breaking the open-cards-AT-COMPLETION symmetry of a
// competitive game. So spectators NEVER read the doc directly; they read it
// through /api/tournament/battle-view, which calls this projector. Chosen over
// relaxing the read rule precisely because only the server path can strip WHY
// at the read boundary — net result: ZERO firestore-rule change (P7 Stage 0
// erratum resolved the clean way).
//
// Transparency contract (V2.1 §9): WHAT — positions, per-asset state,
// statusFeed narration MESSAGES, scoreState, the double-down stance, the frozen
// initial lineup — is PUBLIC live to all. WHY — the agent's reasoning AND its
// strategy surface (innerMonologue, strategy brief, Forge rules/citations,
// guardrails, equipped watchlist, the swap-candidate watchlist, per-evaluation/
// -trade rationale & hypothesis, proposals, gameplan, chat, the Film Room
// ledger) — is OWNER-ONLY while ACTIVE and opens to ALL at COMPLETION (the Film
// Room unlock).
//
// The non-owner ACTIVE projection is built from ALLOWLISTS, deliberately (P7
// code review): a denylist leaked the swap-candidate `watchlist` and the
// agentContext strategy fields when the doc shape grew. With an allowlist,
// anything not explicitly public is concealed BY DEFAULT — a new field added to
// the battle doc later cannot leak. Pure + node-clean (one zero-import schema
// import) so the projection is unit-tested directly.

import { pickCurrentTournamentBattle } from '../../src/constants/leagueTournament.js';

// PUBLIC WHAT — the only top-level keys a non-owner sees on an active battle.
// statusFeed/trades/agentContext are projected separately (sub-allowlisted).
const PUBLIC_TOP_LEVEL = [
  'id', 'agentId', 'ownerId', 'status', 'gameMode', 'groupId', 'isCpu',
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
// disagreeing. They stay out until completion, when the whole doc is returned
// unchanged and the Film Room shows everything.
const PUBLIC_STATUSFEED = ['timestamp', 'message', 'action', 'regime', 'score', 'symbolOut', 'symbolIn'];
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
 * - Owner (ownerId === viewerUid) OR completed battle → returned UNCHANGED
 *   (full WHY: the owner sees their own reasoning live; everyone gets it at
 *   completion via the Film Room).
 * - Non-owner viewing an ACTIVE battle → WHAT-only projection built from the
 *   allowlists above. Stamped `_whyConcealed: true` so the client renders the
 *   honest "reasoning unlocks at completion" note rather than mistaking
 *   concealment for absence.
 *
 * @param {Object} battle    the raw agentBattles doc (with id)
 * @param {{ isOwner: boolean }} opts
 * @returns {Object} a NEW object for the concealed case (input never mutated);
 *   the same reference for the full case.
 */
export function projectTournamentBattle(battle, { isOwner = false } = {}) {
  if (!battle) return battle;
  if (isOwner || battle.status === 'completed') {
    return battle; // full transparency: owner live, or anyone at completion
  }

  // Non-owner, active → WHAT-only (allowlist; nothing leaks by default).
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
