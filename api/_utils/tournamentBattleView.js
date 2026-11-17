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
// trades/agentContext are projected separately (sub-allowlisted).
// `ownerId` and `agentId` are DELIBERATELY ABSENT (R-F): an account id never
// reaches another player's browser through this view, and a training pod's
// agent id embeds one (`training-agent-{groupId}-{uid}`, trainingCloneDocId in
// src/constants/leagueTournament.js). No league reader reads either from a
// rival's battle (the security-pack report's reader table); a seat is
// identified by its key in the route's seat-keyed map.
const PUBLIC_TOP_LEVEL = [
  'id', 'status', 'gameMode', 'groupId', 'isCpu',
  'duration', 'createdAt', 'activatedAt', 'completedAt', 'expiresAt', 'updatedAt',
  'timing', 'portfolio', 'opponent', 'scoring', 'scoreState', 'thresholdHistory',
];
// PUBLIC agentContext — identity + the public double-down stance + the frozen
// starting lineup. NOT innerMonologue / strategyBrief / consolidatedInsight /
// activeRules / deployedGuardrails / equippedWatchlist / equippedBundleIds /
// riskTolerance (all strategy WHY).
const PUBLIC_AGENT_CONTEXT = ['agentName', 'archetype', 'tournament', 'initialPortfolio'];
// NO statusFeed for a non-owner (R-F, 15 Nov 2026; security-pack review,
// exposure lens E2–E5). The feed's free-text `message` is written by many
// hands and carries what the ruling keeps on the server: guardrail levels
// ("Guardrail override: stop-loss at 8% breached …", agentGuardrails.js),
// the Film Room self-review's grade and lesson (agent-batch-review.js), the
// model's own status line (agent-evaluate.js `status_feed_update`), risk
// details and hot-bench names; its `action` names the mechanism that moved
// the book. An allowlist of entry KEYS cannot strip what a free-text VALUE
// says, so the whole feed stays with the owner. The swap facts a spectator is
// owed are in `trades[]` (PUBLIC_TRADE). (Before R-F the feed went out with
// `message`, `action`, `regime`, `score`, the symbols and `executionOutcome`;
// `source`/`triggeredBy` were already withheld — Phase 0 V2 Hazard 12.)
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
 *   others none" (pilot spec §2.7) holds by construction. The narration
 *   feed is withheld whole (`statusFeed: []`). Stamped `_whyConcealed: true`
 *   so the client renders the honest "reasoning is not shared" note rather
 *   than mistaking concealment for absence.
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
  projected.statusFeed = []; // the owner's narration: never a non-owner's (see above)
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
