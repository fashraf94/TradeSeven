// api/_utils/tournamentLiveComposite.js
//
// Phase B (B-server) — the PURE per-seat live-composite core for the read-only
// GET /api/tournament/live-composites endpoint. No I/O, no clock: inputs in, a
// { [odUserId]: liveComposite } scalar map out. Tested in isolation (the endpoint
// is a one-way-door surface — prove the math without Firestore/network).
//
// WHY server-side (B1 hard-stop, Phase B Gate Discovery): a rival's agent-six
// holdings live in an owner-scoped agentBattles doc (firestore.rules) the client
// can never read, and the arena is owner-only. The server (Admin SDK) is the only
// place a per-rival live composite can be formed — and it returns ONLY the scalar
// composite, never rival holdings/positions/reasoning (Ruling 1).
//
// The composite of record is agentScore + k×userScore (k = USER_LAYER_K = 1.5),
// single-homed in computeComposite. This module REUSES the canonical pure pieces
// (scorePick, resolveBaseATR, computeComposite) — calling them is BUILD_RULES §1
// permitted; nothing here is a scorer edit, and there is no persistence.
//
// Freshness path (a), per the build brief: the agent half is the per-owner
// scoreState.currentScore total (via fetchGroupAgentScores in the handler), fresh
// to the last ~15-min agent-evaluate pass. The user half is recomputed live from
// this-poll quotes. (Path (b) — live-recompute the rival agent half — is a parked
// fast-follow, deliberately NOT built here.)

import { scorePick, resolveBaseATR } from './tournamentUserScoring.js';
import { isCryptoSymbol } from './marketDataCache.js';
import { computeComposite, round2 } from '../../src/constants/leagueTournament.js';

/**
 * Every user-layer symbol held or dropped across the pod — the fetchBatchQuotes
 * union the handler prices. Held ∪ dropped so a dropped pick's still-counting
 * banked legs (and any live leg) are priced too. Pure.
 * @param {Object} group - a tournamentGroups doc
 * @returns {string[]} unique symbols
 */
export function collectGroupUserSymbols(group) {
  const set = new Set();
  for (const player of (group?.players || [])) {
    const scorable = [
      ...(Array.isArray(player?.picks) ? player.picks : []),
      ...(Array.isArray(player?.droppedPicks) ? player.droppedPicks : []),
    ];
    for (const pick of scorable) {
      if (pick?.symbol) set.add(pick.symbol);
    }
  }
  return [...set];
}

/**
 * Per-seat live composite for every player in the group.
 *
 * Agent half: agentScoresByOwner[odUserId] — the fetchGroupAgentScores byOwner
 *   map (Σ scoreState.currentScore over that owner's tournament agentBattles,
 *   CPU included). Absent/NaN → 0 (a live read reflects current state; it does
 *   NOT carry forward like the nightly bank, whose carry protects a PERSISTED
 *   cumulative from read-failure regressions — this map is ephemeral).
 *
 * User half: Σ scorePick over the player's held picks ∪ droppedPicks, exactly
 *   as computeBankingUpdate scores them (tournamentBanking.js:180-189) MINUS the
 *   settlement mutation — read-only, so unsettled legs (same-day new claims,
 *   bank-pending closed legs) contribute 0 until banking settles them, byte-for-
 *   byte parity with the your-seat live display (readUserStar → scorePick). Held
 *   picks bank their closed legs + score the live leg off quote.current; dropped
 *   picks carry their banked closed legs (their live leg is already closed).
 *
 * Combine: round2(computeComposite(round2(agent), round2(user))) — the same
 * rounding shape the nightly bank stamps (tournamentBanking.js:295,310,318), so a
 * live tick converges to the banked compositePoints at close with no jump.
 *
 * @param {Object} group - tournamentGroups doc (players[].picks / droppedPicks)
 * @param {Object<string,number>} agentScoresByOwner - fetchGroupAgentScores result
 * @param {Object<string,{current:number|null}>} quotes - fetchBatchQuotes result
 * @param {Object|null} atrPercentiles - loadAtrPercentiles result (null → port-contract ATR)
 * @returns {Object<string,number>} { [odUserId]: liveComposite }
 */
export function computeGroupLiveComposites(group, agentScoresByOwner = {}, quotes = {}, atrPercentiles = null) {
  const out = {};
  const players = Array.isArray(group?.players) ? group.players : [];

  for (const player of players) {
    const odUserId = player?.odUserId;
    if (typeof odUserId !== 'string' || odUserId.length === 0) continue;

    // ── agent half ──
    const agentRaw = agentScoresByOwner?.[odUserId];
    const agentPoints = Number.isFinite(agentRaw) ? round2(agentRaw) : 0;

    // ── user half ── held ∪ dropped, scorePick each, no settlement.
    const scorablePicks = [
      ...(Array.isArray(player.picks) ? player.picks : []),
      ...(Array.isArray(player.droppedPicks) ? player.droppedPicks : []),
    ];
    let userTotal = 0;
    for (const pick of scorablePicks) {
      if (!pick?.symbol) continue;
      const baseATR = resolveBaseATR(pick.symbol, atrPercentiles)
        ?? (isCryptoSymbol(pick.symbol) ? 5.0 : 2.5); // port-contract fallback, mirrors banking
      const scored = scorePick({ pick, baseATR, quote: quotes?.[pick.symbol] });
      userTotal += Number.isFinite(scored?.totalPoints) ? scored.totalPoints : 0;
    }

    out[odUserId] = round2(computeComposite(agentPoints, round2(userTotal)));
  }

  return out;
}
