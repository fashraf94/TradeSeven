// src/services/tournamentGroupService.js
//
// League Tournament — client-side reads for the `tournamentGroups`
// collection. READS ONLY by design: the deployed Firestore rules make the
// collection client-read-only (write: false), so every mutation goes through
// the api/tournament/* endpoints (Admin SDK). Do not add write calls here.

import { doc, getDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { cleanSymbols, composeBoardPrefill } from '../utils/boardPrefillCore';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_BRACKETS_COLLECTION,
  TOURNAMENT_LEADERBOARDS_COLLECTION,
  TOURNAMENT_RANKS_COLLECTION,
  TOURNAMENT_LOBBY_COLLECTION,
  TOURNAMENT_TUNING,
  LOBBY_STATUS,
  isCpuUserId,
  AGENT_BOARDS_SUBCOLLECTION,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
  USER_DRAFT_STREAM_DOC_ID,
  AGENT_LEDGER_SUBCOLLECTION,
  AGENT_LEDGER_DOC_ID,
  DRAFT_SUBCOLLECTION,
  DRAFT_STATE_DOC_ID,
  selectActiveLobby,
  selectMyGroup,
  selectMyTrainingPod,
  selectBaseLayerField,
  BASE_LAYER_FIELD_OVERFETCH,
} from '../constants/leagueTournament';

/** One-shot group read. Returns { id, ...data } or null. */
export async function getGroup(groupId) {
  const snap = await getDoc(doc(db, TOURNAMENT_GROUPS_COLLECTION, groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Server-computed per-seat LIVE composites for a group's arena climb (Phase B,
 * Option X). GET /api/tournament/live-composites → { [odUserId]: liveComposite }
 * — scalars only (never rival holdings/positions/reasoning; the B1 hard-stop path
 * for a rival's owner-scoped agent six). A READ (no Firestore write), authenticated
 * via the Bearer ID token. Degrade-not-throw: returns {} on any failure so the
 * arena falls back to the banked series and a render is never blocked.
 * @param {string} groupId
 * @returns {Promise<Object<string, number>>}
 */
export async function fetchLiveComposites(groupId) {
  if (!groupId) return {};
  try {
    const res = await fetchWithAuth(`/api/tournament/live-composites?groupId=${encodeURIComponent(groupId)}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data.composites === 'object' && data.composites ? data.composites : {};
  } catch {
    return {};
  }
}

/**
 * Live group subscription (precedent: draftService subscribeDraft).
 * Callback receives { id, ...data } or null. Returns the unsubscribe fn.
 */
export function subscribeGroup(groupId, callback) {
  return onSnapshot(doc(db, TOURNAMENT_GROUPS_COLLECTION, groupId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ id: snapshot.id, ...snapshot.data() });
  }, (error) => {
    console.error('[TournamentGroupService] Group subscription error:', error);
    callback(null);
  });
}

/**
 * Live claims subscription (P1b) — newest first, capped. Reads are
 * client-legal under the deployed subcollection rules block
 * (firestore.rules tournamentGroups/{groupId}/{document=**}); placement
 * itself goes through POST /api/tournament/place-claim.
 * Callback receives an array of { id, ...claim }. Returns the unsubscribe fn.
 */
export function subscribeClaims(groupId, callback) {
  const claimsQuery = query(
    collection(db, TOURNAMENT_GROUPS_COLLECTION, groupId, 'claims'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(claimsQuery, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error('[TournamentGroupService] Claims subscription error:', error);
    callback([]);
  });
}

/**
 * Live agent-boards subscription (P3a — rider #2 read surface). One doc per
 * agent, keyed by agentId; reads are client-legal under the deployed
 * recursive subcollection rules block. Production writes happen server-side
 * (produce-agent-boards / the P3b orchestrator).
 * Callback receives an array of { id, ...board }. Returns the unsubscribe fn.
 */
export function subscribeAgentBoards(groupId, callback) {
  const boardsCol = collection(db, TOURNAMENT_GROUPS_COLLECTION, groupId, AGENT_BOARDS_SUBCOLLECTION);
  return onSnapshot(boardsCol, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error('[TournamentGroupService] Agent boards subscription error:', error);
    callback([]);
  });
}

/**
 * Live agent-draft stream subscription (P3a — rider #3 playback record; P5
 * replays it on the ~5s/pick clock). Callback receives the stream doc
 * ({ events, picksByAgent, ... }) or null. Returns the unsubscribe fn.
 */
export function subscribeAgentDraftStream(groupId, callback) {
  const streamDoc = doc(db, TOURNAMENT_GROUPS_COLLECTION, groupId, STREAMS_SUBCOLLECTION, AGENT_DRAFT_STREAM_DOC_ID);
  return onSnapshot(streamDoc, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  }, (error) => {
    console.error('[TournamentGroupService] Agent draft stream subscription error:', error);
    callback(null);
  });
}

/**
 * Live interactive-draft state subscription (League Training Slice 2 — the live
 * snake draft's source of truth at draft/state). Reads are client-legal under
 * the deployed recursive subcollection rules block; writes stay Admin SDK (the
 * training-pick endpoint + the lifecycle sweeps). Callback receives the state
 * doc ({ status, snakeOrder, currentPickIndex, pool, taken, picksByUser, events,
 * humanArchetype, ... }) or null. Returns the unsubscribe fn.
 */
export function subscribeDraftState(groupId, callback) {
  const stateDoc = doc(db, TOURNAMENT_GROUPS_COLLECTION, groupId, DRAFT_SUBCOLLECTION, DRAFT_STATE_DOC_ID);
  return onSnapshot(stateDoc, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  }, (error) => {
    console.error('[TournamentGroupService] Draft state subscription error:', error);
    callback(null);
  });
}

/**
 * Live user-draft stream subscription (P5 — the playback theater's Act 1;
 * the P1a rider-#3 record at streams/userDraft). Callback receives the
 * stream doc ({ events, roundNumber, resolvedAt }) or null. Returns the
 * unsubscribe fn.
 */
export function subscribeUserDraftStream(groupId, callback) {
  const streamDoc = doc(db, TOURNAMENT_GROUPS_COLLECTION, groupId, STREAMS_SUBCOLLECTION, USER_DRAFT_STREAM_DOC_ID);
  return onSnapshot(streamDoc, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  }, (error) => {
    console.error('[TournamentGroupService] User draft stream subscription error:', error);
    callback(null);
  });
}

/**
 * Live subscription to the caller's OWN committed board doc (P5 — the
 * committed-state display: ranked list, committedAt, the autoCommitted
 * badge). Boards are keyed by odUserId; reads are client-legal under the
 * deployed recursive subcollection rules block. Callback receives
 * { id, ...board } or null. Returns the unsubscribe fn.
 */
export function subscribeOwnBoard(groupId, odUserId, callback) {
  const boardDoc = doc(db, TOURNAMENT_GROUPS_COLLECTION, groupId, 'boards', odUserId);
  return onSnapshot(boardDoc, (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, (error) => {
    console.error('[TournamentGroupService] Own board subscription error:', error);
    callback(null);
  });
}

/**
 * Live "my group" subscription (P5 — the League tab home): the caller's active
 * RANKED tournament group, found by membership. The query is unchanged (a single
 * `array-contains` on groupMembers — no composite index; if the console still
 * prompts for the array-contains index during smoke, FLAG it — founder note,
 * never improvise rules/index changes); the selection is the pure `selectMyGroup`
 * predicate (FORMING/BATTLE, most-recent-wins, AND `isTraining !== true`). That
 * training exclusion is load-bearing: training pods share this collection and
 * match this same member query, but must never surface on the ranked tab (the
 * status-keyed ranked UI would mis-render them) — selectMyGroup is the safety
 * gate, unit-tested without Firestore. Protects both callers (LeagueParticipantView,
 * useRealLeagueState). Callback receives { id, ...group } or null. Returns the
 * unsubscribe fn.
 */
export function subscribeMyGroup(uid, callback) {
  const groupsQuery = query(
    collection(db, TOURNAMENT_GROUPS_COLLECTION),
    where('groupMembers', 'array-contains', uid)
  );
  return onSnapshot(groupsQuery, (snapshot) => {
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(selectMyGroup(docs));
  }, (error) => {
    console.error('[TournamentGroupService] My-group subscription error:', error);
    callback(null);
  });
}

/**
 * Live "my active training pod" subscription (League Next-Arc Slice 5b-i — the
 * Training-tab re-entry surface): the caller's in-flight training pod, found by
 * the SAME member-scoped `array-contains` query (no new index) and selected by
 * the pure `selectMyTrainingPod` predicate (isTraining + DRAFTING/AWAITING_OPEN/
 * BATTLE, most-recent-wins; COMPLETE excluded so the re-entry bar disappears and
 * the start CTA returns once a pod finishes). The twin of subscribeMyGroup — that
 * one is the ranked read with training excluded, this one is the training read with
 * ranked excluded; the two predicates are complementary by construction. Callback
 * receives { id, ...pod } or null. Returns the unsubscribe fn.
 */
export function subscribeMyTrainingPod(uid, callback) {
  const groupsQuery = query(
    collection(db, TOURNAMENT_GROUPS_COLLECTION),
    where('groupMembers', 'array-contains', uid)
  );
  return onSnapshot(groupsQuery, (snapshot) => {
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(selectMyTrainingPod(docs));
  }, (error) => {
    console.error('[TournamentGroupService] My-training-pod subscription error:', error);
    callback(null);
  });
}

/**
 * Live base-layer "field" subscription (League Next-Arc Phase 1): the always-on
 * weekly groups of four for one ISO week, the redesign's "field" surface. BOUNDED
 * by design (founder ruling B) — a single `baseLayerWeek ==` equality + recency
 * order + a hard `limit`, NEVER an unbounded all-groups read. The equality+orderBy
 * needs the composite index added in firestore.indexes.json (baseLayerWeek ASC,
 * updatedAt DESC) AND created in the Firebase Console (the firestore.indexes.json
 * drift is known — if the console prompts for it during smoke, that's expected);
 * the training exclusion below is index-free (client-side), so no NEW index.
 *
 * TRAINING EXCLUSION (League field-leak fix): training pods share this collection
 * and match this same `baseLayerWeek` query, but THE FIELD is base layer + bracket
 * and must exclude `isTraining: true` pods (CPUs stay by design). We can't cheaply
 * exclude them query-side — `where('isTraining','!=',true)` needs a new composite
 * index AND drops docs that omit the flag — so we OVER-FETCH by
 * BASE_LAYER_FIELD_OVERFETCH and exclude client-side via the pure
 * selectBaseLayerField (the direct mirror of subscribeMyGroup → selectMyGroup).
 * The over-fetch is what stops training pods from consuming a `limit` slot: the
 * cap is applied AFTER the training filter, on a wider read window. Callback
 * receives an array of { id, ...group } (training-excluded, capped to `max`).
 * Returns the unsubscribe fn.
 */
export function subscribeBaseLayerGroups(baseLayerWeek, callback, { max = 12 } = {}) {
  if (!baseLayerWeek) {
    callback([]);
    return () => {};
  }
  const groupsQuery = query(
    collection(db, TOURNAMENT_GROUPS_COLLECTION),
    where('baseLayerWeek', '==', baseLayerWeek),
    orderBy('updatedAt', 'desc'),
    limit(Math.ceil(max * BASE_LAYER_FIELD_OVERFETCH))
  );
  return onSnapshot(groupsQuery, (snapshot) => {
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(selectBaseLayerField(docs, max));
  }, (error) => {
    console.error('[TournamentGroupService] Base-layer groups subscription error:', error);
    callback([]);
  });
}

/**
 * Resolve human display names for the redesign surfaces (League Next-Arc Phase 1,
 * founder ruling A): the CLIENT twin of the leaderboard writer's resolveDisplayNames
 * — `users/{uid}.username || displayName`, degrading to the bare id on any read
 * failure (never blocks a render). CPU seats are EXCLUDED here: their names are
 * synthesized deterministically from the archetype in leagueAdapter.cpuSeatName
 * (no doc read). One-shot batched read (not a subscription) — names are stable.
 * Returns a { [uid]: name } map.
 */
export async function fetchDisplayNames(odUserIds) {
  const names = {};
  const humans = [...new Set(odUserIds || [])].filter(id => typeof id === 'string' && id && !isCpuUserId(id));
  await Promise.all(humans.map(async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const profile = snap.exists() ? snap.data() : null;
      names[uid] = (profile && (profile.username || profile.displayName)) || uid;
    } catch (error) {
      console.warn(`[TournamentGroupService] users/${uid} read failed — falling back to id:`, error?.message);
      names[uid] = uid;
    }
  }));
  return names;
}

/**
 * Live "my lobby" subscription (P10b — the front door before a group exists):
 * the caller's OPEN/FORMING self-serve lobby, found by membership. The lobby's
 * `members` is an array of OBJECTS (no scalar member-id field to
 * `array-contains` on), so this reads the open/forming lobbies (a single-field
 * `status in` — no composite index) and filters membership client-side via the
 * pure `selectActiveLobby` (the subscribeMyGroup read-then-filter idiom). At
 * FIFO V1 scale this is a handful of docs; the denormalized-`memberIds` array
 * is the documented scale-time follow-up (watch ledger W8).
 *
 * Composes with subscribeMyGroup for the handoff: the lobby state shows only
 * while `subscribeMyGroup` returns null; the instant a group forms, the lobby
 * reaches FORMED (excluded here → null) and the group subscription takes over.
 * Callback receives { id, ...lobby } or null. Returns the unsubscribe fn.
 */
export function subscribeMyLobby(uid, callback) {
  const lobbyQuery = query(
    collection(db, TOURNAMENT_LOBBY_COLLECTION),
    where('status', 'in', [LOBBY_STATUS.OPEN, LOBBY_STATUS.FORMING])
  );
  return onSnapshot(lobbyQuery, (snapshot) => {
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(selectActiveLobby(docs, uid));
  }, (error) => {
    console.error('[TournamentGroupService] My-lobby subscription error:', error);
    callback(null);
  });
}

/**
 * Live agent held-set ledger subscription (P2 sibling doc; P3a dev surface
 * watches the draft acquisition land). Callback receives the ledger doc
 * ({ held, reservations, doubleDowns, ... }) or null. Returns the
 * unsubscribe fn.
 */
export function subscribeAgentLedger(groupId, callback) {
  const ledgerDoc = doc(db, TOURNAMENT_GROUPS_COLLECTION, groupId, AGENT_LEDGER_SUBCOLLECTION, AGENT_LEDGER_DOC_ID);
  return onSnapshot(ledgerDoc, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  }, (error) => {
    console.error('[TournamentGroupService] Agent ledger subscription error:', error);
    callback(null);
  });
}

/**
 * Live bracket-state subscription (P3b — the dev bracket card now, the
 * P6/P7 spectator surfaces later). Whole bracket in one doc by design.
 * Callback receives { id, ...bracket } or null. Returns the unsubscribe fn.
 */
export function subscribeBracket(bracketId, callback) {
  return onSnapshot(doc(db, TOURNAMENT_BRACKETS_COLLECTION, bracketId), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, (error) => {
    console.error('[TournamentGroupService] Bracket subscription error:', error);
    callback(null);
  });
}

/**
 * Live seasonal-leaderboard subscription (P6a — the dev card now, the P6b
 * leaderboard surface later). One month-keyed doc holds the whole board
 * (docId via leaderboardDocId: 'YYYY-MM', dev-prefixed for smoke data).
 * Callback receives { id, ...doc } or null. Returns the unsubscribe fn.
 */
export function subscribeLeaderboard(docId, callback) {
  return onSnapshot(doc(db, TOURNAMENT_LEADERBOARDS_COLLECTION, docId), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, (error) => {
    console.error('[TournamentGroupService] Leaderboard subscription error:', error);
    callback(null);
  });
}

/**
 * Live career-rank subscription (P6a — the dev card now, the P6b rank
 * surface later). docId via rankDocId: the odUserId, dev-prefixed for
 * smoke-sourced applications. Callback receives { id, ...doc } or null.
 */
export function subscribeRank(docId, callback) {
  return onSnapshot(doc(db, TOURNAMENT_RANKS_COLLECTION, docId), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, (error) => {
    console.error('[TournamentGroupService] Rank subscription error:', error);
    callback(null);
  });
}

/**
 * Board prefill (Spec §3 default, founder-confirmed June 11, 2026): the
 * player's equipped-watchlist names in their stored order, then the latest
 * scout-alert symbols not already present, intersected with the group's
 * draftable pool. Freely editable downstream — this is a suggestion, and the
 * as-suggested snapshot is what the board commit stores for the rider #1
 * delta.
 *
 * P5: assembly/intersection/depth live in the shared pure core
 * (src/utils/boardPrefillCore.js) — the deadline auto-commit's server twin
 * (api/_utils/tournamentBoardAutoCommit.js) routes its Admin-SDK reads
 * through the SAME core, so the two derivations cannot fork. This function
 * owns only the browser-SDK reads.
 *
 * Every source degrades silently to empty (posture precedent: the deploy
 * endpoint's equipped-watchlist read) — a prefill failure must never block
 * board creation.
 */
export async function assembleBoardPrefill(uid, { userPool = null } = {}) {
  let agent = null;
  try {
    // EXCLUDE training clones (Slice 3): ranked board prefill keys on the
    // player's RANKED agent (a clone shares the player's ownerId).
    const agentSnap = await getDocs(query(
      collection(db, 'agents'),
      where('ownerId', '==', uid)
    ));
    const agentDoc = agentSnap.docs.find(d => d.data().isTrainingClone !== true && d.data().isCasualClone !== true);
    if (agentDoc) {
      agent = agentDoc.data();
    }
  } catch (error) {
    console.warn('[TournamentGroupService] Prefill: agent read failed, degrading:', error?.message);
  }

  let equipped = [];
  if (agent?.equippedWatchlistId) {
    try {
      const watchlistSnap = await getDoc(doc(db, 'watchlists', agent.equippedWatchlistId));
      const tickers = watchlistSnap.exists() ? watchlistSnap.data()?.tickers : null;
      if (Array.isArray(tickers)) {
        equipped = cleanSymbols(tickers.map(t => t?.symbol));
      }
    } catch (error) {
      console.warn('[TournamentGroupService] Prefill: watchlist read failed, degrading:', error?.message);
    }
  }

  let scoutAlerts = [];
  if (agent?.activeBattleId) {
    try {
      const cacheSnap = await getDoc(doc(db, 'voiceLayerCache', agent.activeBattleId));
      const alerts = cacheSnap.exists() ? cacheSnap.data()?.scoutAlerts : null;
      if (Array.isArray(alerts)) {
        scoutAlerts = cleanSymbols(alerts.map(a => a?.symbol));
      }
    } catch (error) {
      console.warn('[TournamentGroupService] Prefill: scout alerts read failed, degrading:', error?.message);
    }
  }

  return composeBoardPrefill({
    equippedSymbols: equipped,
    scoutAlertSymbols: scoutAlerts,
    userPool,
    depthMax: TOURNAMENT_TUNING.BOARD_DEPTH_MAX,
  });
}
