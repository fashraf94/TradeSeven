// src/components/CommandCenter/hub/gamesDisplay.js
//
// Command Center hub, slice S3 (rulings R-S3-7, R-S3-8; spec V1.2 §3, §6, §7,
// §8.2) — the Games rows (hub/hubModel.js `games`) from the readers' records:
//
//   live rows       from the SAME retained poll list the deploy gate reads
//                   (App's active poll, owned by the current identity), in
//                   sortLiveBattles order, labelled by classifyBattleType — so
//                   a block always has its row. A game that has not opened
//                   yet says it is deployed and waiting for the open.
//   completed rows  from the ten-game window (useHubCompletedBattles), each
//                   with its §7 outcome — word, number and colour from one
//                   stored pair — and its §6 review state.
//
// The scores a row shows are the ones a reader may show (v2 Ruling 16,
// displayedStockScores): a measured-model battle's unavailable score is a
// dash, never 0. The record's feed is read for one thing only — whether it
// carries the platform's `battle_complete` entry, the final evidence of §7 —
// and no beat's words are ever shown from it.

import { BATTLE_TYPE_RANKED, battleTypeLabel, classifyBattleType, sortLiveBattles } from '../../../utils/commandCenterLiveBattles';
import { STOCK_RESULT_UNAVAILABLE, displayedStockScores } from '../../../utils/stockThresholdModel';
import { FILM_ROOM_ROUTE } from '../../../constants/filmTape';
import { PHASE, derivePhase } from '../../../adapters/baggerbombAdapter';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubDay, formatHubTime, hubMs } from './hubDate';
import { OUTCOME_KINDS, deriveGameOutcome } from './selectors/gameOutcome';
import { REVIEW_STATES } from './reviewScheduler';

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const MINUS = '−';

/** The record carries the platform's battle_complete feed entry (spec §7 final evidence) — its presence, nothing else. */
export function hasFinalEvidence(battle) {
  const feed = battle?.statusFeed;
  return Array.isArray(feed) && feed.some((entry) => Boolean(entry) && entry.action === 'battle_complete');
}

/** The one projection of a record that deriveGameOutcome reads. */
export function outcomeInputOf(battle) {
  return {
    status: battle?.status,
    gameMode: battle?.gameMode ?? null,
    completionContext: battle?.completionContext ?? null,
    resultUnavailable: battle?.completionContext === STOCK_RESULT_UNAVAILABLE,
    finalEvidence: hasFinalEvidence(battle),
    scoreState: displayedStockScores(battle || {}),
  };
}

const signed = (n, decimals) => {
  const text = Math.abs(n).toFixed(decimals);
  if (Number(text) === 0) return text;
  return n > 0 ? `+${text}` : `${MINUS}${text}`;
};

/**
 * The scores as shown: one decimal, more only when needed — so two different
 * stored scores never show as equal (no apparent draw) and a non-zero score
 * never shows as zero (spec §7). Stored precision decides the verdict; this
 * only shows it.
 */
export function formatScores(...scores) {
  const values = scores.filter(finite);
  for (let decimals = 1; decimals <= 6; decimals += 1) {
    const texts = values.map((n) => signed(n, decimals));
    const zeroLoss = values.some((n, i) => n !== 0 && Number(texts[i].replace(MINUS, '-')) === 0);
    const collision = values.some((a, i) => values.some((b, j) => j > i && a !== b && texts[i] === texts[j]));
    if (!zeroLoss && !collision) return scores.map((n) => (finite(n) ? signed(n, decimals) : COPY.games.scoreUnavailable));
  }
  return scores.map((n) => (finite(n) ? String(n) : COPY.games.scoreUnavailable));
}

/** A row's outcome words and tone, from deriveGameOutcome's one stored pair. */
export function outcomeDisplay(result) {
  const [mine, theirs] = formatScores(result.mine, result.theirs);
  switch (result.kind) {
    case OUTCOME_KINDS.WON: return { tag: { text: COPY.games.outcomeWon(mine), tone: 'pos' }, detail: COPY.games.scorePair(mine, theirs) };
    case OUTCOME_KINDS.LOST: return { tag: { text: COPY.games.outcomeLost(mine), tone: 'neg' }, detail: COPY.games.scorePair(mine, theirs) };
    case OUTCOME_KINDS.DRAW: return { tag: { text: COPY.games.outcomeDraw(mine), tone: 'draw' }, detail: COPY.games.scorePair(mine, theirs) };
    case OUTCOME_KINDS.BANKED: return { tag: { text: COPY.games.outcomeBanked, tone: 'neutral' }, detail: mine };
    case OUTCOME_KINDS.ENDED: return { tag: { text: COPY.games.outcomeEnded, tone: 'neutral' }, detail: COPY.games.endedDetail(mine, theirs) };
    case OUTCOME_KINDS.NO_SCORE: return { tag: { text: COPY.games.outcomeNoResult, tone: 'neutral' }, detail: COPY.games.noScoreRecorded };
    default: return { tag: { text: COPY.games.outcomeNoResult, tone: 'neutral' }, detail: '' };
  }
}

const opponentOf = (battle) => (classifyBattleType(battle) === BATTLE_TYPE_RANKED ? COPY.games.opponentGroup : COPY.games.opponentCpu);

function timeLeft(endsMs, nowMs) {
  if (endsMs === null || !finite(nowMs)) return '';
  const minutes = Math.round((endsMs - nowMs) / 60000);
  if (minutes <= 0) return COPY.games.ending;
  return COPY.games.timeLeft(Math.floor(minutes / 60), minutes % 60);
}

/**
 * The live rows: the retained poll list's own documents, in sortLiveBattles
 * order. `marketState` is getMarketState()'s, read once at render: a game with
 * no evaluation yet while the market is not open is waiting for the open (the
 * Desk's own PRE_OPEN rule, adapters/baggerbombAdapter.js derivePhase).
 */
export function liveGameRows(battles, { nowMs, marketState }) {
  return sortLiveBattles(Array.isArray(battles) ? battles : []).map((battle) => {
    const preOpen = derivePhase(battle, marketState) === PHASE.PRE_OPEN;
    const endsMs = hubMs(battle.expiresAt);
    const shown = displayedStockScores(battle);
    const [score] = formatScores(shown.currentScore);
    const tradeCount = battle.scoreState?.tradeCount;
    const trades = finite(tradeCount) ? tradeCount : (Array.isArray(battle.trades) ? battle.trades.length : 0);
    const ends = endsMs === null ? '' : COPY.time.et(formatHubTime(endsMs));
    return Object.freeze({
      id: battle.id,
      kind: classifyBattleType(battle),
      mode: battleTypeLabel(battle),
      opponent: opponentOf(battle),
      live: true,
      preOpen,
      clock: preOpen ? COPY.games.waitingForOpen : timeLeft(endsMs, nowMs),
      detail: COPY.games.liveDetail(score, trades, ends),
    });
  });
}

/** A completed row's review line (spec §6), from the coordinator's row state. */
export function reviewLineOf(row) {
  if (!row) return Object.freeze({ state: REVIEW_STATES.CHECKING, text: COPY.games.review.checking, openable: false });
  const at = formatHubTime(row.nextAt, { roundUp: true });
  const time = at ? COPY.time.et(at) : '';
  switch (row.state) {
    case REVIEW_STATES.READY:
      // Only the helper's own target opens anything: the Film Room route.
      return Object.freeze({ state: row.state, text: COPY.games.review.openTape, openable: row.result?.ready === true && row.result.target === FILM_ROOM_ROUTE });
    case REVIEW_STATES.PENDING: return Object.freeze({ state: row.state, text: COPY.games.review.pending, openable: false });
    case REVIEW_STATES.UNAVAILABLE: return Object.freeze({ state: row.state, text: COPY.games.review.unavailable, openable: false });
    case REVIEW_STATES.QUEUED: return Object.freeze({ state: row.state, text: COPY.games.review.queued(time), openable: false });
    case REVIEW_STATES.TIMED_OUT: return Object.freeze({ state: row.state, text: COPY.games.review.timedOut(time), openable: false });
    default: return Object.freeze({ state: REVIEW_STATES.CHECKING, text: COPY.games.review.checking, openable: false });
  }
}

/** The completed rows: the window's documents, newest first, each with its outcome and review line. */
export function completedGameRows(battles, reviews = {}) {
  return (Array.isArray(battles) ? battles : []).map((battle) => {
    const display = outcomeDisplay(deriveGameOutcome(outcomeInputOf(battle)));
    const day = formatHubDay(hubMs(battle.completedAt));
    const reviewLine = reviewLineOf(reviews[battle.id]);
    return Object.freeze({
      id: battle.id,
      kind: classifyBattleType(battle),
      mode: battleTypeLabel(battle),
      opponent: opponentOf(battle),
      live: false,
      detail: COPY.games.detail(day, display.detail),
      outcome: display.tag,
      review: reviewLine.openable,
      reviewLine,
    });
  });
}
