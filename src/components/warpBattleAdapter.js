// src/components/warpBattleAdapter.js
//
// Battle-Weather Starfield — the live-game adapter.
// Delight Layer arc, Task 2 (Phase 2). Spec V2 §4 D5, rulings R-T2-S1/S2/S13.
//
// Maps the EXISTING `activeAgentBattles` poll result (src/App.jsx:2345, filled
// by the poll at :3891-3933) into the pure core's `liveGames` shape. Pure and
// render-free — no React, no Firebase, no clock of its own.
//
// ---------------------------------------------------------------------------
// ZERO NEW READS (ruling R-T2-S1, acceptance row A6)
// ---------------------------------------------------------------------------
// This module starts no listener and no poll. It is a projection of state
// App.jsx already holds for the "No battle live / Deploy to send your agent in"
// card — same source, same status filter (the §9 display-agreement rule). They
// share the SOURCE, but not the whole liveness rule: the sky additionally drops
// a game once its local `expiresAt` has passed (warpStateMachine.normalizeLiveGames),
// while the card keys on `status==='active'` alone. So in the brief window
// between a battle's close and the evaluate-cron flipping status to 'completed',
// the card can still read "live" while the sky has already calmed. That
// divergence is intentional and covered (warpBattleAdapter.test.js "a battle that
// expired between polls…"); the invariant is shared-source, not identical output.
//
// ---------------------------------------------------------------------------
// THE FILTER IS THE CARD'S FILTER, DELIBERATELY
// ---------------------------------------------------------------------------
// `status === 'active'`, character for character what CommandDashboardDesktop.jsx:89
// and CommandDashboard.jsx do to decide `isLive`. Do not "improve" it here — a
// filter that diverges is exactly how a sky that disagrees with the card gets
// built. Training-clone battles are already excluded upstream by the poll
// (App.jsx:3907-3911, TRAINING_CLONE_ID_PREFIX), so they never arrive.
//
// ---------------------------------------------------------------------------
// THE REAL DOC SHAPE (ruling R-T2-S13)
// ---------------------------------------------------------------------------
// An `agentBattles` doc does NOT carry `endsAt` or `totalDuration`. It carries:
//
//   expiresAt    ISO string — the fullday market close (4pm ET / 1pm early
//                close / 8pm ET when crypto is held). Written at creation,
//                api/_utils/agentBattleService.js:125.
//   activatedAt  ISO string — stamped to `now` at creation (:123).
//   createdAt    ISO string — stamped to the same `now` (:122).
//   status       'active' | 'completed' (:115). Binary; there is no server-side
//                "endgame" status — that tier is computed client-side from the
//                clock, per ruling R-T2-S2.
//
// So the R-WINDOW denominator is `expiresAt − activatedAt`: deploy instant to
// market close, which is genuinely that battle's whole run.
//
// ACTIVATION FALLBACK — the house pattern, not an invention. Two independent
// sites already resolve this field as `activatedAt || createdAt`
// (src/utils/flat6BattleEnrichment.js:56, src/screens/AgentBattleScreen.jsx:610),
// and api/cron/agent-evaluate.js:709 carries a defensive fallback with the
// comment "should never happen on new battles". Both timestamps are written in
// the SAME object literal by the SAME single creation path, so in practice they
// are equal; the fallback exists for legacy docs only.
//
// If BOTH are unusable the game still counts as LIVE membership but reports
// totalDuration: null, which the core reads as "this clock cannot be proven" and
// caps at BATTLE LIVE — never a guessed window. Same rule the League 5-day arc
// falls under (R-T2-S3).

import { toEpochMs } from './warpStateMachine';

/** The card's liveness predicate. One definition, used by both surfaces. */
export function isLiveBattle(battle) {
  return Boolean(battle) && battle.status === 'active';
}

/**
 * Project one `agentBattles` doc onto the core's game shape.
 *
 * Returns null only for a doc that is not live at all. A live doc with an
 * unreadable clock is still returned — it is a real game the user has a stake
 * in, and dropping it would make the sky disagree with the card.
 */
export function toLiveGame(battle) {
  if (!isLiveBattle(battle)) return null;

  const endsAt = toEpochMs(battle.expiresAt);
  const startedAt = toEpochMs(battle.activatedAt) ?? toEpochMs(battle.createdAt);

  // A non-positive span means the two stamps disagree (clock skew, a doctored
  // fixture). Treated as unprovable rather than clamped to something invented.
  const totalDuration = endsAt != null && startedAt != null && endsAt > startedAt
    ? endsAt - startedAt
    : null;

  return {
    id: battle.id != null ? String(battle.id) : null,
    endsAt,
    totalDuration,
  };
}

/**
 * Map the poll result to `liveGames` for the state machine.
 *
 * @param {Array} activeAgentBattles Raw docs from the App.jsx poll.
 * @returns {Array<{id: string|null, endsAt: number|null, totalDuration: number|null}>}
 */
export function toLiveGames(activeAgentBattles) {
  if (!Array.isArray(activeAgentBattles)) return [];

  const games = [];
  for (const battle of activeAgentBattles) {
    const game = toLiveGame(battle);
    if (game !== null) games.push(game);
  }
  return games;
}
