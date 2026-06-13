// src/utils/roundBoundary.js
//
// P7 (C) — pure read-composition for the weekend round-boundary flow. No
// writer, no new read: given the bracket doc (subscribeBracket) and the
// player's uid, resolve their latest finished game and which branch the
// interstitial shows — advancer / eliminated / champion. The advancer's fresh
// round-2 `forming` group is surfaced by subscribeMyGroup independently; this
// only drives the interstitial. Pure + node-clean (one zero-import schema
// import), unit-tested without a DOM.

import { rankByScores } from '../constants/leagueTournament';

/**
 * The player's most-recent COMPLETED bracket game (the one to report at the
 * boundary). Scans rounds.{rK}.games.{gId}; a game counts if the player is a
 * seat and it carries completedAt; the highest roundNumber wins. Returns
 * `{ roundNumber, gameId, game }` or null.
 */
export function findLatestCompletedGameForUser(bracket, uid) {
  if (!bracket?.rounds || !uid) return null;
  let best = null;
  for (const round of Object.values(bracket.rounds)) {
    const games = round?.games || {};
    for (const [gameId, game] of Object.entries(games)) {
      const inSeat = (game?.seats || []).some(s => s?.odUserId === uid);
      if (!inSeat || !game?.completedAt) continue;
      const rn = game.roundNumber ?? round.roundNumber ?? 0;
      if (!best || rn > best.roundNumber) best = { roundNumber: rn, gameId, game };
    }
  }
  return best;
}

/**
 * Resolve the round-boundary interstitial for a player. Returns null when the
 * player has no completed game (mid-battle, or never in a bracket). Otherwise
 * `{ kind, gameId, roundNumber, placement, composite, advancers, isTerminal }`
 * where kind is 'champion' | 'advancer' | 'eliminated'. Pure.
 */
export function resolveRoundBoundary(bracket, uid) {
  const latest = findLatestCompletedGameForUser(bracket, uid);
  if (!latest) return null;
  const { game, gameId, roundNumber } = latest;

  const advanced = Array.isArray(game.advancers) && game.advancers.includes(uid);
  const isChampion = bracket?.champion?.odUserId === uid;

  // Placement within the game = position in the composite ranking (ruling A-1).
  // Without finalScores, placement is UNKNOWN (null) — never fabricated from
  // seat order (advancement always writes finalScores at the lock; this guards
  // a partial/legacy shape honestly).
  const seatOrder = (game.seats || []).map(s => s.odUserId);
  const ranking = game.finalScores ? rankByScores(game.finalScores, seatOrder) : null;
  const idx = ranking ? ranking.indexOf(uid) : -1;
  const placement = idx >= 0 ? idx + 1 : null;

  // A champion is always terminal (even if a roundNumber/totalRounds mismatch
  // would say otherwise); otherwise terminal = the last round.
  const totalRounds = bracket?.totalRounds ?? null;
  const isTerminal = isChampion || (totalRounds != null && roundNumber >= totalRounds);

  const kind = isChampion ? 'champion' : advanced ? 'advancer' : 'eliminated';

  return {
    kind,
    gameId,
    roundNumber,
    placement,
    composite: game.finalScores?.[uid] ?? null,
    advancers: Array.isArray(game.advancers) ? game.advancers : [],
    isTerminal,
  };
}
