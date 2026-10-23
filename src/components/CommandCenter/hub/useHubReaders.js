// src/components/CommandCenter/hub/useHubReaders.js
//
// Command Center hub, slice S3 — the hub's readers, joined (rulings R-S3-2,
// R-S3-4, R-S3-5, R-S3-8, R-S3-9, R-S3-10). It runs only on the connected hub
// (CommandCenterHub, given App's `hub` object through the gate), so the
// layout fixtures and the tests that render the hub without one read nothing.
//
//   identity   services/authIdentity.js — the one source App's poll uses too
//   agent      useAgent(uid, { ownerEpoch }) — the owner-tagged ranked agent
//   poll       App's retained active list and its metadata, from `hub`
//              (activeBattles, activePoll); never read again here. Read the
//              list only through ownedLiveList (selectors/readerInputs.js),
//              never `hub.activeBattles` raw: the render that carries a new
//              identity can still hold the former owner's list (review T2-10;
//              S2b's provider too)
//   completed  useHubCompletedBattles(10) — the window and its reviews
//
// It also returns `agent`, the same owner-tagged read for S5's Loadout
// (selectors/readerInputs.js loadoutAgentOf): since the S3 merge with S5 App
// hands the hub no agent, so the deploy state and the Loadout read one source.
//
// It returns the Games and Deploy sections and the actions S3 wires: open a
// game (App's handleOpenAgentBattle), open a battle tape (App's legacy Film
// Room path, origin dashboard, only for a ready review whose target is the
// Film Room route), Retry a read (the agent's, or an explicit poll refresh),
// and Retry the window. The hold stays inert: no deploy handler is wired
// before S2b. A live id leaving a SUCCESSFUL poll of this owner refreshes the
// window, within its rate cap.

import { useEffect, useRef } from 'react';
import { CASUAL_CLONE_CONCURRENCY_ENABLED } from '../../../config/featureFlags';
import { FILM_ROOM_ROUTE } from '../../../constants/filmTape';
import useAgent from '../../../hooks/useAgent';
import { useAuthIdentity } from '../../../services/authIdentity';
import { getMarketState } from '../../../utils/marketSchedule';
import { DISPLAY_ACTIONS } from './deployDisplay';
import { completedGameRows, liveGameRows } from './gamesDisplay';
import { HUB_S2A_DEPLOY_INPUTS } from './hubModel';
import { REVIEW_TRIGGERS } from './reviewScheduler';
import { RETRY_ACTIONS, deriveHubDeployState } from './selectors/deployState';
import { agentInputOf, authInputOf, completedInputOf, loadoutAgentOf, ownedLiveList, pollInputOf } from './selectors/readerInputs';
import useHubCompletedBattles from './useHubCompletedBattles';

/**
 * The Games section (hub/hubModel.js `games`): loading or error until the window's first read succeeds. The live
 * rows are the poll's and ride apart from the window's status (`live`, read through liveGamesOf); `liveResolved`
 * says the poll has answered for this owner, so "No games yet" never stands in for an unknown live list.
 */
function gamesSectionOf(completed, liveRows, liveResolved) {
  const live = Object.freeze([...liveRows]);
  if (completed.battles === null) {
    // A read in flight is checking, not the failure of the one before it (spec §6; review T3-3).
    const failed = completed.status === 'error' && !completed.checking;
    return Object.freeze({ status: failed ? 'error' : 'loading', rows: Object.freeze([]), live, liveResolved, nextAttemptAt: completed.nextAttemptAt });
  }
  // A game the window already holds completed while App's retained list still holds it live is listed once, live —
  // the gate's own row; the poll dropping it refreshes the window (review T0R-1).
  const liveIds = new Set(live.map((g) => g.id));
  const done = completed.battles.filter((b) => !liveIds.has(b.id));
  return Object.freeze({
    status: 'ready',
    live,
    liveResolved,
    rows: Object.freeze([...live, ...completedGameRows(done, completed.reviews)]),
    stale: completed.status === 'error',
    refreshing: completed.refreshing === true,
    // Kept from an earlier mount of this owner and epoch, not yet read again (Q-S3-2, A+): shown "as of" its time.
    carried: completed.carried === true,
    asOf: completed.lastSuccessfulAt,
    nextAttemptAt: completed.nextAttemptAt,
  });
}

/**
 * @param {object} hub  App's object (CommandCenterHubGate's `hub`): activeBattles, activePoll,
 *                      refreshActiveBattles, openGame, openFilmRoom — and S5's keys, which
 *                      hub/useHubRuntime.js reads
 */
export default function useHubReaders(hub) {
  const identity = useAuthIdentity();
  const signedInUid = identity.resolved && identity.uid ? identity.uid : null;
  const agent = useAgent(signedInUid, { ownerEpoch: identity.authEpoch });
  const completed = useHubCompletedBattles();

  const auth = authInputOf(identity);
  const poll = pollInputOf(hub.activePoll, hub.activeBattles, identity);
  const inputs = Object.freeze({
    ...HUB_S2A_DEPLOY_INPUTS,
    auth,
    agent: agentInputOf(agent),
    poll,
    completed: completedInputOf(completed),
    // As the shells read it: at render.
    concurrencyEnabled: CASUAL_CLONE_CONCURRENCY_ENABLED,
  });
  const deploy = deriveHubDeployState(inputs);

  // The gate's own owned set: every block has its live row.
  const live = ownedLiveList(poll, auth);

  // A live id leaving a successful poll of this owner and epoch: refresh the window.
  const seenLiveRef = useRef(null);
  const ownerKey = poll.ownerUid && poll.ownerUid === auth?.uid && poll.ownerEpoch === auth?.authEpoch ? `${poll.ownerUid}:${poll.ownerEpoch}` : null;
  const { refresh } = completed;
  useEffect(() => {
    if (!ownerKey) return;
    const ids = live.map((b) => b.id);
    const previous = seenLiveRef.current;
    seenLiveRef.current = { ownerKey, at: poll.lastSuccessfulAt, ids };
    if (previous && previous.ownerKey === ownerKey && previous.at !== poll.lastSuccessfulAt && previous.ids.some((id) => !ids.includes(id))) {
      refresh(REVIEW_TRIGGERS.LIVE_LEFT);
    }
    // Keyed on the poll's successes: a list change without one (an optimistic entry) is not a transition. App sets
    // the list and its success in one batch (App.activeBattlesPoll.source.test.js pins the order; review T3-10).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey, poll.lastSuccessfulAt, refresh]);

  const liveRows = liveGameRows(live, { nowMs: Date.now(), marketState: getMarketState() });
  const games = gamesSectionOf(completed, liveRows, ownerKey !== null);

  // A live row opens the poll's own record, even when the window holds the same id (review T0R-1).
  const documents = new Map([...(completed.battles || []), ...live].map((b) => [b.id, b]));
  const actions = {
    openGame: typeof hub.openGame === 'function'
      ? (row) => { const doc = documents.get(row?.id); if (doc) hub.openGame(doc); }
      : undefined,
    openTape: typeof hub.openFilmRoom === 'function'
      ? (row) => {
        const doc = documents.get(row?.id);
        const result = completed.reviews[row?.id]?.result;
        // The helper's own answer decides: ready, and its target the Film Room route.
        if (doc && result?.ready === true && result.target === FILM_ROOM_ROUTE) hub.openFilmRoom(doc);
      }
      : undefined,
    retryGames: () => refresh(REVIEW_TRIGGERS.MANUAL),
    // A read's Retry, by the reader the selector names. An attempt's actions are S2b's: none can show before it.
    deployAction: (kind) => {
      if (kind !== DISPLAY_ACTIONS.RETRY_READ) return;
      if (deploy.retryAction === RETRY_ACTIONS.AGENT) agent.retry();
      else if (deploy.retryAction === RETRY_ACTIONS.POLL && typeof hub.refreshActiveBattles === 'function') hub.refreshActiveBattles();
    },
  };

  // The Loadout's agent (slice S5) is this same read, never App's (the S3 merge with S5).
  return { sections: { games, deploy }, actions, inputs, agent: loadoutAgentOf(inputs.agent, auth, agent.retry) };
}
