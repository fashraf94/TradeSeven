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
// and Retry the window. A live id leaving a SUCCESSFUL poll of this owner
// refreshes the window, within its rate cap.
//
// Slice S2b: given the deploy provider's context, the selector also reads the
// provider's attempt, hold, cooldown and open overlays with the hub's own
// sheets (selectors/readerInputs.js attemptInputsOf), and the result carries
// the owned live set and the ceremony's directive count for the provider
// (hub/useHubDeploy.js wires the controls). Without one nothing changes: the
// hold stays inert.
//
// Slice S4 (rulings R-S4-1 … R-S4-3, R-S4-5) adds, from the same records and with
// no read, effect or listener of its own: the next action and its Later
// (hub/nextAction.js, hub/useHubLater.js), the Activity section's INPUTS
// (`activityInputs`: the Loadout is the runtime's, so hub/useHubRuntime.js finishes
// the list with it, hub/activityRows.js), and the actions that go with them —
// `nextAction`, `laterNextAction`, `openActivity` and History's `refreshHistory`. The Daily Regime Brief is the one thing it does read:
// through the existing brief hook (hub/useHubBrief.js), which owns that read and
// its one retry — `sections.brief` and `actions.retryBrief`.

import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { CASUAL_CLONE_CONCURRENCY_ENABLED } from '../../../config/featureFlags';
import { FILM_ROOM_ROUTE } from '../../../constants/filmTape';
import useAgent from '../../../hooks/useAgent';
import { useAuthIdentity } from '../../../services/authIdentity';
import { getMarketState } from '../../../utils/marketSchedule';
import { DISPLAY_ACTIONS } from './deployDisplay';
import { completedGameRows, liveGameRows } from './gamesDisplay';
import { HUB_S2A_DEPLOY_INPUTS } from './hubModel';
import { NEXT_ACTION_KINDS, deriveNextAction, firstDeploymentOffer } from './nextAction';
import { REVIEW_TRIGGERS } from './reviewScheduler';
import { RETRY_ACTIONS, deriveHubDeployState } from './selectors/deployState';
import { agentInputOf, attemptInputsOf, authInputOf, completedInputOf, loadoutAgentOf, ownedLiveList, pollInputOf } from './selectors/readerInputs';
import useHubBrief from './useHubBrief';
import useHubCompletedBattles from './useHubCompletedBattles';
import useHubLater from './useHubLater';

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
 * @param {null|{ snapshot }} [deployAttempt]  slice S2b: the deploy provider's context
 *                      (src/contexts/DeployAttemptContext.jsx), or null without one
 * @param {boolean} [hubModalOpen]  slice S2b: the hub's overlay stack's modalOpen
 */
export default function useHubReaders(hub, deployAttempt = null, hubModalOpen = false) {
  const identity = useAuthIdentity();
  const signedInUid = identity.resolved && identity.uid ? identity.uid : null;
  const agent = useAgent(signedInUid, { ownerEpoch: identity.authEpoch });
  const completed = useHubCompletedBattles();

  const auth = authInputOf(identity);
  const later = useHubLater(auth);
  const brief = useHubBrief();
  const poll = pollInputOf(hub.activePoll, hub.activeBattles, identity);
  const agentInput = agentInputOf(agent);
  const inputs = Object.freeze({
    ...HUB_S2A_DEPLOY_INPUTS,
    auth,
    agent: agentInput,
    poll,
    completed: completedInputOf(completed),
    // As the shells read it: at render.
    concurrencyEnabled: CASUAL_CLONE_CONCURRENCY_ENABLED,
    // Slice S2b: the provider's attempt, hold, cooldown and overlays, with this render's clock (none without one).
    ...attemptInputsOf(deployAttempt?.snapshot ?? null, {
      auth, agentId: agentInput.agent?.id ?? null, hubModalOpen, now: Date.now(),
    }),
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

  // The Loadout's agent (slice S5) is this same read, never App's (the S3 merge with S5).
  const loadoutAgent = loadoutAgentOf(inputs.agent, auth, agent.retry);

  // Slice S4: Activity and the next action are projections of the records above (no read of their own), over Games' own rows
  // so a word, a verdict or an openable tape is said once. Activity's loadout rows need the Loadout (its resolved list and
  // archetype), which the runtime holds: the readers hand it the games' side, with the age of the window it stands on.
  const rowsById = new Map(games.rows.map((row) => [row.id, row]));
  const activityInputs = Object.freeze({
    battles: completed.battles,
    failed: completed.status === 'error' && !completed.checking,
    live,
    rowsById,
    nowMs: Date.now(),
    windowAge: Object.freeze({ asOf: games.asOf ?? null, stale: games.stale === true, carried: games.carried === true }),
  });
  const nextInputs = {
    liveRows,
    battles: completed.battles,
    rowsById,
    firstDeployment: firstDeploymentOffer(inputs),
    liveResolved: games.liveResolved,
  };
  const nextAction = deriveNextAction({ ...nextInputs, dismissed: later.dismissed });
  const candidate = nextAction.candidate;

  // A live row opens the poll's own record, even when the window holds the same id (review T0R-1).
  const documents = new Map([...(completed.battles || []), ...live].map((b) => [b.id, b]));
  const openGame = typeof hub.openGame === 'function'
    ? (row) => { const doc = documents.get(row?.id); if (doc) hub.openGame(doc); }
    : undefined;
  const openTape = typeof hub.openFilmRoom === 'function'
    ? (row) => {
      const doc = documents.get(row?.id);
      const result = completed.reviews[row?.id]?.result;
      // The helper's own answer decides: ready, and its target the Film Room route.
      if (doc && result?.ready === true && result.target === FILM_ROOM_ROUTE) hub.openFilmRoom(doc);
    }
    : undefined;
  const actions = {
    openGame,
    openTape,
    retryGames: () => refresh(REVIEW_TRIGGERS.MANUAL),
    // History's Refresh (founder ruling Q-S3-6): an explicit trigger, so it shares the rolling budget.
    refreshHistory: () => refresh(REVIEW_TRIGGERS.HISTORY),
    // The next action goes through the same two lookups as the rows (one guard each). The first deployment's hold is not
    // here: its handler is the deploy action the strip and the card receive, which S2b supplies (R-S4-8).
    nextAction: candidate?.key === NEXT_ACTION_KINDS.OPEN_GAME && openGame ? () => openGame({ id: candidate.id })
      : candidate?.key === NEXT_ACTION_KINDS.REVIEW && openTape ? () => openTape({ id: candidate.id })
        : undefined,
    // Setting a candidate aside can take the focused Later button with it: the last candidate takes the card, and on the phone a card
    // that moves between its two slots (a live game's above the rows, a review's below) is mounted afresh. A control that unmounts
    // drops focus to <body>, so once the render is in, focus follows the card (its Later button) or, with none left, the hub's root.
    laterNextAction: candidate ? (event) => {
      const shell = event?.currentTarget?.closest?.('[data-hub="shell"]') ?? null;
      flushSync(() => later.dismiss(candidate.laterKey));
      if (shell && !shell.contains(document.activeElement)) (shell.querySelector('[data-hub-next-action] [data-hub-later]') ?? shell).focus();
    } : undefined,
    retryBrief: brief.retry,
    // An Activity row for a game opens that game's record, as Games' row does; a loadout row opens nothing.
    openActivity: openGame ? (row) => { if (row?.battleId) openGame({ id: row.battleId }); } : undefined,
    // A read's Retry, by the reader the selector names. An attempt's actions are S2b's: none can show before it.
    deployAction: (kind) => {
      if (kind !== DISPLAY_ACTIONS.RETRY_READ) return;
      if (deploy.retryAction === RETRY_ACTIONS.AGENT) agent.retry();
      else if (deploy.retryAction === RETRY_ACTIONS.POLL && typeof hub.refreshActiveBattles === 'function') hub.refreshActiveBattles();
    },
  };

  // The Loadout's agent (slice S5) is this same read, never App's (the S3 merge with S5). Slice S2b: the gate's owned
  // live set and the ceremony's directive count, for the deploy provider (hub/useHubDeploy.js).
  return {
    sections: { games, deploy, activityInputs, nextAction, brief: brief.brief },
    actions,
    inputs,
    agent: loadoutAgent,
    liveBattles: live,
    ceremonyAgent: Object.freeze({ directiveCount: Array.isArray(agent?.activeDirectives) ? agent.activeDirectives.length : 0 }),
  };
}
