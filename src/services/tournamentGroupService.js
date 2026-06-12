// src/services/tournamentGroupService.js
//
// League Tournament — client-side reads for the `tournamentGroups`
// collection. READS ONLY by design: the deployed Firestore rules make the
// collection client-read-only (write: false), so every mutation goes through
// the api/tournament/* endpoints (Admin SDK). Do not add write calls here.

import { doc, getDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_BRACKETS_COLLECTION,
  TOURNAMENT_TUNING,
  AGENT_BOARDS_SUBCOLLECTION,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
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

function cleanSymbols(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const symbol = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
}

/**
 * Board prefill (Spec §3 default, founder-confirmed June 11, 2026): the
 * player's equipped-watchlist names in their stored order, then the latest
 * scout-alert symbols not already present. Freely editable downstream — this
 * is a suggestion, and the as-suggested snapshot is what the board commit
 * stores for the rider #1 delta.
 *
 * Every source degrades silently to empty (posture precedent: the deploy
 * endpoint's equipped-watchlist read) — a prefill failure must never block
 * board creation.
 */
export async function assembleBoardPrefill(uid) {
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

  return cleanSymbols([...equipped, ...scoutAlerts]).slice(0, TOURNAMENT_TUNING.BOARD_DEPTH_MAX);
}
