// api/_utils/tournamentBoardAutoCommit.js
//
// P5 — the deadline auto-commit (founder-ruled at P3 Stage 0, REQUIRED before
// launch; deadline ratified June 12, 2026: encountering an uncommitted board
// during the Monday pipeline IS the deadline — no separate timer, no new
// cron. The grace-tick alternative was weighed and rejected: it stalls the
// entire group's Monday for a player who had all weekend; it remains
// available as a one-line ET-time guard here if ever wanted).
//
// For each group member without a boards/{odUserId} doc at the Monday
// encounter:
//   1. Derive the SERVER prefill — the Admin-SDK twin of the client
//      derivation (tournamentGroupService.js assembleBoardPrefill), mirrored
//      FIELD-FOR-FIELD (raw tickers[].symbol through cleanSymbols, no
//      committed-status gating: the twin's contract is "exactly what the
//      player would have been prefilled with", and the equivalence battery
//      locks it). Assembly/∩ pool/depth run through the shared pure core
//      (src/utils/boardPrefillCore.js) so the two sides cannot fork.
//   2. Pad to BOARD_DEPTH_MIN when short (the no-watchlist floor,
//      generalized): the player's agent-archetype ranking ∩ pool, then the
//      ranked pool itself — LOUD on every floor use.
//   3. Commit through the SAME pure core as every board producer
//      (buildBoardCommit — rider #1), stamped `autoCommitted: true` (the
//      signal corpus must distinguish chosen boards from defaulted ones; the
//      delta is all-kept by construction, the flag carries the signal), plus
//      a feed entry on the group doc (the rider-#4 flip-feed pattern) so the
//      player sees the default. Board doc + feed entry land in ONE awaited
//      transaction per member (Signal Capture Rider — no fire-and-forget).
//
// IDEMPOTENT: a member whose board doc exists is never touched — re-runs
// write nothing and duplicate no feed entries; a player who commits in the
// race window between the subcollection read and the transaction WINS (their
// chosen board is never overwritten by a default).
//
// Imports the zero-import core + schema modules from src/ under the revised
// June 2026 import rule (BUILD_RULES §4); the co-located test's real import
// of THIS module is the dependency-surface guard.

import { buildBoardCommit } from './tournamentBoards.js';
import { computeArchetypeRankings } from './archetypeScoring.js';
import { cleanSymbols, composeBoardPrefill, padBoardToFloor } from '../../src/utils/boardPrefillCore.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_TUNING,
} from '../../src/constants/leagueTournament.js';

const LOG_PREFIX = '[TournamentAutoCommit]';

export const AUTO_COMMIT_FEED_TYPE = 'board_auto_commit';
// The group-feed cap of record (api/tournament/flip.js rider-#4 write).
const FEED_CAP = 50;

function toIso(now) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

/**
 * Admin-SDK twin of the client prefill reads (assembleBoardPrefill): agent by
 * ownerId (limit 1), equipped watchlist tickers, latest scout alerts — every
 * source degrades silently to empty (the client's posture; a prefill failure
 * must never block the auto-commit's floor path). Returns the composed
 * in-pool prefill plus the agent archetype the floor ranking keys on.
 */
export async function deriveServerBoardPrefill(db, { odUserId, userPool }) {
  let agent = null;
  try {
    const agentSnap = await db.collection('agents').where('ownerId', '==', odUserId).limit(1).get();
    if (!agentSnap.empty) agent = agentSnap.docs[0].data();
  } catch (error) {
    console.warn(`${LOG_PREFIX} prefill: agent read failed for ${odUserId}, degrading:`, error?.message);
  }

  let equippedSymbols = [];
  if (agent?.equippedWatchlistId) {
    try {
      const watchlistSnap = await db.collection('watchlists').doc(agent.equippedWatchlistId).get();
      const tickers = watchlistSnap.exists ? watchlistSnap.data()?.tickers : null;
      if (Array.isArray(tickers)) {
        equippedSymbols = cleanSymbols(tickers.map(t => t?.symbol));
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} prefill: watchlist read failed for ${odUserId}, degrading:`, error?.message);
    }
  }

  let scoutAlertSymbols = [];
  if (agent?.activeBattleId) {
    try {
      const cacheSnap = await db.collection('voiceLayerCache').doc(agent.activeBattleId).get();
      const alerts = cacheSnap.exists ? cacheSnap.data()?.scoutAlerts : null;
      if (Array.isArray(alerts)) {
        scoutAlertSymbols = cleanSymbols(alerts.map(a => a?.symbol));
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} prefill: scout alerts read failed for ${odUserId}, degrading:`, error?.message);
    }
  }

  return {
    prefill: composeBoardPrefill({
      equippedSymbols,
      scoutAlertSymbols,
      userPool,
      depthMax: TOURNAMENT_TUNING.BOARD_DEPTH_MAX,
    }),
    archetype: agent?.archetype || 'analyst',
  };
}

/**
 * Auto-commit a board for every group member without one. Called by the
 * Monday pipeline when resolution reports boards_missing; the caller retries
 * resolution when committed === missing and falls back to the loud defer
 * otherwise. Returns { missing, committed, floored, errors }.
 */
export async function autoCommitMissingBoards(db, group, { now = new Date() } = {}) {
  const nowIso = toIso(now);
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id);
  const members = group.groupMembers || [];

  const boardsSnap = await groupRef.collection('boards').get();
  const committed = new Set();
  boardsSnap.forEach(doc => committed.add(doc.id));
  const missing = members.filter(id => !committed.has(id));

  const summary = { missing: missing.length, committed: 0, floored: 0, errors: 0 };
  if (missing.length === 0) return summary;

  // Floor candidates: archetype rankings over the universe. A missing or
  // degraded rankings doc degrades to ranked-pool padding alone (the pool is
  // stored in ranked order — resolve-user-draft.js).
  let stocks = null;
  try {
    const rankingsDoc = await db.collection('indexIntelligence').doc('stockRankings').get();
    stocks = rankingsDoc.exists ? rankingsDoc.data().stocks : null;
  } catch (error) {
    console.warn(`${LOG_PREFIX} stockRankings read failed — floor degrades to ranked-pool padding:`, error?.message);
  }
  const rankingByArchetype = new Map();

  for (const odUserId of missing) {
    try {
      const userPool = group.userPool || [];
      const { prefill, archetype } = await deriveServerBoardPrefill(db, { odUserId, userPool });

      let board = prefill;
      let floored = false;
      if (board.length < TOURNAMENT_TUNING.BOARD_DEPTH_MIN) {
        if (Array.isArray(stocks) && stocks.length > 0 && !rankingByArchetype.has(archetype)) {
          rankingByArchetype.set(archetype, computeArchetypeRankings(stocks, archetype).map(s => s.symbol));
        }
        const padded = padBoardToFloor({
          board,
          rankedCandidates: rankingByArchetype.get(archetype) || [],
          rankedPool: userPool,
          depthMin: TOURNAMENT_TUNING.BOARD_DEPTH_MIN,
        });
        board = padded.board;
        floored = padded.floored;
        if (floored) {
          console.warn(`${LOG_PREFIX} group ${group.id}: FLOOR used for ${odUserId} — prefill had ${prefill.length} in-pool name(s); padded to ${board.length} from the ${archetype} ranking ∩ pool`);
        }
      }

      // The same rider-#1 assembly every producer uses; throws on an
      // invalid board (e.g. a pool too small to reach the floor) — counted
      // as an error and the caller's loud defer takes over.
      const commit = buildBoardCommit({ group, odUserId, board, prefillAsSuggested: prefill, now: nowIso });

      const wrote = await db.runTransaction(async (tx) => {
        const boardRef = groupRef.collection('boards').doc(odUserId);
        const [boardSnap, groupSnap] = await tx.getAll(boardRef, groupRef);
        // A player commit landing in the race window wins — a chosen board
        // is never overwritten by a default.
        if (boardSnap.exists) return false;
        const freshFeed = groupSnap.exists ? (groupSnap.data().feed || []) : [];
        const feedEvent = {
          type: AUTO_COMMIT_FEED_TYPE,
          odUserId,
          boardLength: board.length,
          floored,
          timestamp: nowIso,
        };
        tx.set(boardRef, { ...commit, autoCommitted: true });
        tx.update(groupRef, { feed: [...freshFeed, feedEvent].slice(-FEED_CAP), updatedAt: nowIso });
        return true;
      });

      if (wrote) {
        summary.committed++;
        if (floored) summary.floored++;
        console.log(`${LOG_PREFIX} group ${group.id}: AUTO-COMMITTED ${odUserId}'s board at the Monday deadline (${board.length} names${floored ? ', FLOORED' : ''}) — rider #1 stamped autoCommitted, feed entry written`);
      } else {
        // The race-window player commit: count the member as covered.
        summary.committed++;
        console.log(`${LOG_PREFIX} group ${group.id}: ${odUserId} committed in the race window — their board wins, auto-commit skipped`);
      }
    } catch (error) {
      summary.errors++;
      console.error(`${LOG_PREFIX} group ${group.id}: auto-commit FAILED for ${odUserId}: ${error.message}`);
    }
  }
  return summary;
}
