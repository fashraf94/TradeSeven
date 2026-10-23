// src/components/CommandCenter/hub/nextAction.js
//
// Command Center hub, slice S4 (rulings R-S4-2, R-S4-3; spec V1.2 §8.2, §3.1;
// review IR-12) — the next action: ONE card, chosen by a fixed priority, and
// "Later", which sets a candidate aside and offers the next one WITHIN THE SAME
// RULE before falling to the next rule. Pure: it reads only its arguments.
//
//   1  an owned live game, in sortLiveBattles order (the live rows already are).
//      A game that has not opened yet says it is deployed and waiting for the open.
//   2  the newest game whose review the helper says is ready, by completedAt
//      then id. A pending, unavailable, checking, queued or timed-out review is
//      never a candidate: the test is the very one that draws "Open battle tape"
//      on the row (the row's `review`), so the card and the row agree.
//   3  the first deployment, only when `firstDeployment` says so — the selector
//      firstDeploymentCandidate (selectors/deployState.js): a ready, empty
//      completed read for this owner, no live game, a finite recorded
//      gamesPlayed of exactly 0, and canStart.
//   4  none.
//
// A candidate's Later key is the action kind and the record id (`openGame:{id}`,
// `review:{id}`, `deploy:first`): what is set aside is that action on that
// record, and a new game or a new review is a new key.

import { HUB_COPY as COPY } from './hubCopy';
import { formatHubDay, hubMs } from './hubDate';
import { firstDeploymentCandidate } from './selectors/deployState';

export const NEXT_ACTION_KINDS = Object.freeze({ OPEN_GAME: 'openGame', REVIEW: 'review', DEPLOY: 'deploy' });
export const FIRST_DEPLOYMENT_KEY = 'deploy:first';

/**
 * Rule 3's test (spec §3.1; selectors/deployState.js firstDeploymentCandidate) with THIS owner's own hold set aside. A hold that
 * is charging or locked makes the selector's canStart false for every OTHER control (the owner's matching token is exempted from
 * its own block only by canCommit); the card whose hold is being pressed must not leave under the finger, or the panel unmounts
 * mid-charge (the hub's "keep panels mounted while charging", spec §5.5). Every other block still holds — an unresolved
 * attempt, a live game, a cooldown, a failed or stale read — so the card goes when the deployment is actually under way.
 */
export function firstDeploymentOffer(inputs) {
  return firstDeploymentCandidate({ ...inputs, hold: null });
}

/** The Later key of an action on a record. The first deployment has no record: its key is the one. */
export function laterKeyOf(kind, id) {
  return kind === NEXT_ACTION_KINDS.DEPLOY ? FIRST_DEPLOYMENT_KEY : `${kind}:${id}`;
}

function liveCandidate(row) {
  const key = NEXT_ACTION_KINDS.OPEN_GAME;
  return {
    key,
    id: row.id,
    title: row.preOpen ? COPY.nextAction.preOpenTitle : COPY.nextAction.liveTitle,
    why: COPY.nextAction.liveWhy(row.mode, row.opponent, row.clock),
    ...(row.detail ? { detail: row.detail } : {}),
    cta: COPY.nextAction.openGame,
    laterKey: laterKeyOf(key, row.id),
  };
}

function reviewCandidate(doc, row) {
  const key = NEXT_ACTION_KINDS.REVIEW;
  return {
    key,
    id: doc.id,
    title: COPY.nextAction.reviewTitle(formatHubDay(hubMs(doc.completedAt))),
    why: COPY.nextAction.reviewWhy(row.opponent, row.outcome?.text || ''),
    cta: COPY.nextAction.openReview,
    laterKey: laterKeyOf(key, doc.id),
  };
}

function firstDeploymentCard() {
  const key = NEXT_ACTION_KINDS.DEPLOY;
  return {
    key,
    id: null,
    title: COPY.nextAction.firstTitle,
    why: COPY.nextAction.firstWhy,
    cta: COPY.deploy.holdShort,
    laterKey: laterKeyOf(key, null),
  };
}

/** Newest completed first; a record whose time cannot be read sorts after those that can; then id. */
const byNewest = (a, b) => {
  const ta = hubMs(a.completedAt);
  const tb = hubMs(b.completedAt);
  if (ta !== tb) {
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/**
 * @param {object}   p
 * @param {object[]} p.liveRows        Games' live rows, in sortLiveBattles order (hub/gamesDisplay.js liveGameRows)
 * @param {object[]} p.battles         the window's completed documents (empty while unread)
 * @param {Map}      p.rowsById        Games' display rows by id (a completed row's `review` is the tape link's own test)
 * @param {boolean}  p.firstDeployment firstDeploymentOffer(inputs)
 * @param {boolean}  [p.liveResolved]  the live poll has answered for this owner (Games' `liveResolved`). Until it has, whether a game is
 *                                    live is unknown, so rule 1 cannot yield and no later rule is offered: a review card would
 *                                    swap for a live game's the moment the poll answers. Left out, the poll is taken as answered.
 * @param {Set<string>} [p.dismissed]  the Later keys set aside
 * @returns {{ status: 'ready' | 'loading', candidate: null | object }}
 */
export function deriveNextAction({ liveRows, battles, rowsById, firstDeployment, liveResolved, dismissed = new Set() }) {
  const later = dismissed instanceof Set ? dismissed : new Set();
  const rows = rowsById instanceof Map ? rowsById : new Map();
  const liveList = Array.isArray(liveRows) ? liveRows : [];
  const liveIds = new Set(liveList.map((row) => row.id));
  const done = (Array.isArray(battles) ? battles : []).filter((doc) => doc && typeof doc.id === 'string' && !liveIds.has(doc.id));

  const live = liveList.find((row) => !later.has(laterKeyOf(NEXT_ACTION_KINDS.OPEN_GAME, row.id)));
  if (live) return Object.freeze({ status: 'ready', candidate: Object.freeze(liveCandidate(live)) });

  if (liveResolved === false) return Object.freeze({ status: 'loading', candidate: null });

  const ready = done
    .filter((doc) => rows.get(doc.id)?.review === true && !later.has(laterKeyOf(NEXT_ACTION_KINDS.REVIEW, doc.id)))
    .sort(byNewest)[0];
  if (ready) return Object.freeze({ status: 'ready', candidate: Object.freeze(reviewCandidate(ready, rows.get(ready.id))) });

  if (firstDeployment === true && !later.has(FIRST_DEPLOYMENT_KEY)) {
    return Object.freeze({ status: 'ready', candidate: Object.freeze(firstDeploymentCard()) });
  }
  return Object.freeze({ status: 'ready', candidate: null });
}
