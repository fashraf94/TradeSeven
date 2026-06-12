// src/services/tournamentGroupService.js
//
// League Tournament — client-side reads for the `tournamentGroups`
// collection. READS ONLY by design: the deployed Firestore rules make the
// collection client-read-only (write: false), so every mutation goes through
// the api/tournament/* endpoints (Admin SDK). Do not add write calls here.

import { doc, getDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { cleanSymbols, composeBoardPrefill } from '../utils/boardPrefillCore';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_BRACKETS_COLLECTION,
  TOURNAMENT_TUNING,
  GROUP_STATUS,
  AGENT_BOARDS_SUBCOLLECTION,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
  USER_DRAFT_STREAM_DOC_ID,
  AGENT_LEDGER_SUBCOLLECTION,
  AGENT_LEDGER_DOC_ID,
} from '../constants/leagueTournament';

/** One-shot group read. Returns { id, ...data } or null. */
export async function getGroup(groupId) {
  const snap = await getDoc(doc(db, TOURNAMENT_GROUPS_COLLECTION, groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
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
 * Live "my group" subscription (P5 — the League tab home): the caller's
 * active tournament group, found by membership. Status is filtered
 * client-side (a where-in on status would demand a composite index; if the
 * console still prompts for the array-contains index during smoke, FLAG it
 * — founder note, never improvise rules/index changes). Picks the most
 * recently updated active group when several match. Callback receives
 * { id, ...group } or null. Returns the unsubscribe fn.
 */
export function subscribeMyGroup(uid, callback) {
  const groupsQuery = query(
    collection(db, TOURNAMENT_GROUPS_COLLECTION),
    where('groupMembers', 'array-contains', uid)
  );
  return onSnapshot(groupsQuery, (snapshot) => {
    const active = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(g => g.status === GROUP_STATUS.FORMING || g.status === GROUP_STATUS.BATTLE)
      .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
    callback(active[0] ?? null);
  }, (error) => {
    console.error('[TournamentGroupService] My-group subscription error:', error);
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
    const agentSnap = await getDocs(query(
      collection(db, 'agents'),
      where('ownerId', '==', uid),
      limit(1)
    ));
    if (!agentSnap.empty) {
      agent = agentSnap.docs[0].data();
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
