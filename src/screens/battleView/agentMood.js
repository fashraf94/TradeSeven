// src/screens/battleView/agentMood.js
//
// Agent form build S1 (Scope B) — the battle forms' mood, from real signals only (founder rulings R8, R9). Pure: the
// caller hands in what the battle screen already holds — the live battle document, the cockpit feed while the cockpit
// runs, the pair of scores the header shows, and the screen's coarse clock — and nothing here reads, waits or listens.
//
// The player's form, first match (R8):
//   celebrating  the battle is completed and the player WON — the existing outcome derivation, the hub's
//                deriveGameOutcome (final evidence, scoring evidence, the stored pair compared), never a second one.
//                The caller hands that module in (`outcomes`; BattleAgentForm.jsx loads it, and says why it is not
//                imported here); without it a completed battle is idle.
//                A completed battle lost, drawn or without a result shows idle; a completed battle never shows the
//                live standing.
//   waiting      the cockpit has an open call that needs the player (cockpitFeed.needsYouCount > 0; the feed exists
//                only while the cockpit runs, AgentBattleScreen.jsx `cockpitOn`).
//   researching  an evaluation is in flight: cronState.evaluatingAt is set and younger than the lock's lifetime. The
//                server treats an older lock as stale and takes it again (api/cron/agent-evaluate.js
//                EVALUATING_LOCK_TIMEOUT_MS, 120 s; a crashed tick leaves its stamp until then), so this does too.
//   confident /  the live standing, standingFromDuel of the pair the header shows (BUILD_RULES §9: the same numbers,
//   worried      the same source) — ahead is confident, behind is worried, level is idle.
//   idle         otherwise.
// The CPU opponent's form (R9): the sign-flipped standing only — never waiting, researching or celebrating.

import { standingFromDuel } from '../../components/AgentPresence/presenceBinding';
import { STOCK_RESULT_UNAVAILABLE, displayedStockScores } from '../../utils/stockThresholdModel';

/** The evaluate lock's lifetime: an older evaluatingAt is a stale lock (agent-evaluate.js EVALUATING_LOCK_TIMEOUT_MS, pinned by a tripwire). */
export const EVALUATION_LOCK_MS = 120_000;

/**
 * The one projection of a battle that deriveGameOutcome reads — the hub's own (hub/gamesDisplay.js outcomeInputOf),
 * rebuilt here from the same shipped helpers because that module carries the hub's copy table; a parity row
 * (agentMood.test.js) holds the two equal on every fixture.
 */
export function outcomeInputOf(battle) {
  const feed = battle?.statusFeed;
  return {
    status: battle?.status,
    gameMode: battle?.gameMode ?? null,
    completionContext: battle?.completionContext ?? null,
    resultUnavailable: battle?.completionContext === STOCK_RESULT_UNAVAILABLE,
    finalEvidence: Array.isArray(feed) && feed.some((entry) => Boolean(entry) && entry.action === 'battle_complete'),
    scoreState: displayedStockScores(battle || {}),
  };
}

/** Whether an evaluation is in flight at `nowMs`: a lock stamp the server would still honour. No clock, no claim (R21). */
export function evaluationInFlight(battle, nowMs) {
  const stamp = battle?.cronState?.evaluatingAt;
  if (!stamp || !Number.isFinite(nowMs)) return false;
  const at = typeof stamp === 'string' ? Date.parse(stamp) : (typeof stamp?.toMillis === 'function' ? stamp.toMillis() : NaN);
  // An unreadable stamp is stale to the server (its age is NaN, never under the timeout), so it is here.
  return Number.isFinite(at) && nowMs - at < EVALUATION_LOCK_MS;
}

const moodOfStanding = (s) => (s > 0 ? 'confident' : s < 0 ? 'worried' : 'idle');

/**
 * @param {object}  args
 * @param {object}  args.battle       the live battle document
 * @param {object}  [args.cockpitFeed] buildCockpitFeed's answer while the cockpit runs, else null
 * @param {'player'|'opponent'} [args.side]
 * @param {{ player: number, opponent: number }|null} [args.scores] the pair the header shows; null when it shows none
 * @param {number}  [args.nowMs]      the screen's clock, for the evaluation lock's age
 * @param {{ deriveGameOutcome: Function, OUTCOME_KINDS: object }} [args.outcomes] hub/selectors/gameOutcome.js
 * @returns {'celebrating'|'waiting'|'researching'|'confident'|'worried'|'idle'}
 */
export function deriveAgentMood({ battle, cockpitFeed = null, side = 'player', scores = null, nowMs, outcomes = null } = {}) {
  const b = battle && typeof battle === 'object' ? battle : {};
  const s = scores && typeof scores === 'object' ? scores : null;
  if (side === 'opponent') return moodOfStanding(s ? standingFromDuel(s.opponent, s.player) : 0);
  if (b.status === 'completed') {
    const won = Boolean(outcomes) && outcomes.deriveGameOutcome(outcomeInputOf(b)).kind === outcomes.OUTCOME_KINDS.WON;
    return won ? 'celebrating' : 'idle';
  }
  const needsYou = cockpitFeed && typeof cockpitFeed === 'object' ? cockpitFeed.needsYouCount : 0;
  if (Number.isFinite(needsYou) && needsYou > 0) return 'waiting';
  if (evaluationInFlight(b, nowMs)) return 'researching';
  return moodOfStanding(s ? standingFromDuel(s.player, s.opponent) : 0);
}
