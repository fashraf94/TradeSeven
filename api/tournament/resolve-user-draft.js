// api/tournament/resolve-user-draft.js
//
// P1a — POST /api/tournament/resolve-user-draft. Deterministic snake
// resolution of one group's 3-pick user draft from the four pre-committed
// boards. Manually invocable (admin/cron secret — the P3 orchestrator becomes
// the production caller; P1 owns correctness, P3 owns scheduling).
//
// SIGNAL CAPTURE RIDER, EVENT #3 (user side, Addendum A §4 row 3): the
// resolution writes a pick-by-pick event stream to streams/userDraft in the
// SAME transaction as the group mutation — awaited in-request, atomic, no
// fire-and-forget. One record serves signal capture and the P5 playback
// surface (sniped-board shifts are reconstructable from passedOver).
//
// Lifecycle (GROUP_STATUS ratified at P1): the single-shot resolution moves
// forming -> battle atomically — a crash can never strand a group mid-state.
// 'drafting' belongs to the P3 multi-step Monday sequence.
//
// All picks initialize LONG (Spec §0) with baselinePrice null and
// baselineSource 'draft_resolution' — baselines settle at the next open
// (Spec §1.1), wired in P1b's banking pass.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { assertTransition } from '../_utils/tournamentGroupService.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  GROUP_SIZE,
  PICKS_PER_PLAYER,
  USER_HELD_NAMES_PER_GROUP,
  BASELINE_SOURCE,
  createPickState,
} from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 10 };

export const USER_DRAFT_SENTINEL_PREFIX = '__resolve_user_draft:';
const SENTINEL_PREFIX = USER_DRAFT_SENTINEL_PREFIX;
const SENTINEL_TO_HTTP = Object.freeze({
  group_not_found: [404, 'group_not_found', 'Tournament group not found.'],
  not_forming:     [409, 'not_forming',     'Resolution requires a forming group.'],
  boards_missing:  [409, 'boards_missing',  'Every player must have a committed board.'],
  pool_too_small:  [409, 'pool_too_small',  `The user pool must hold at least ${USER_HELD_NAMES_PER_GROUP} names.`],
});

function sentinel(code, detail) {
  const err = new Error(SENTINEL_PREFIX + code);
  err.detail = detail;
  return err;
}

/**
 * Pure deterministic snake resolution. Exported for tests; the handler is
 * transport + persistence.
 *
 * Order: group.groupMembers, 3 rounds, snake (fwd / rev / fwd). Each turn
 * takes that player's highest-ranked still-available board name; names a
 * player ranked above their selection that were already taken are recorded
 * as passedOver (the sniped-board shift). Board exhaustion falls back to the
 * highest-ranked remaining userPool name (the pool is stored in ranked
 * order — V2.1 §5's deterministic-fallback pattern, user side).
 *
 * Returns { picksByUser, events, remainingPool }.
 */
export function resolveSnakeDraft(group, boardsByUser) {
  if (!group) throw sentinel('group_not_found');
  if (group.status !== GROUP_STATUS.FORMING) throw sentinel('not_forming');

  const members = group.groupMembers || [];
  const missing = members.filter(id => !Array.isArray(boardsByUser?.[id]?.board) || boardsByUser[id].board.length === 0);
  if (members.length !== GROUP_SIZE || missing.length > 0) {
    throw sentinel('boards_missing', missing.length ? `missing boards: ${missing.join(', ')}` : undefined);
  }
  const pool = [...(group.userPool || [])];
  if (pool.length < USER_HELD_NAMES_PER_GROUP) {
    throw sentinel('pool_too_small', `pool has ${pool.length}`);
  }

  const taken = new Set();
  const picksByUser = Object.fromEntries(members.map(id => [id, []]));
  const events = [];
  let pickNumber = 0;

  for (let round = 1; round <= PICKS_PER_PLAYER; round++) {
    const order = round % 2 === 1 ? members : [...members].reverse();
    for (const odUserId of order) {
      pickNumber++;
      const board = boardsByUser[odUserId].board;

      let symbol = null;
      let boardRank = null;
      const passedOver = [];
      for (let rank = 0; rank < board.length; rank++) {
        if (taken.has(board[rank])) {
          // Only names taken by OTHERS are snipes; the player's own earlier
          // picks advance the board pointer silently.
          if (!picksByUser[odUserId].includes(board[rank])) {
            passedOver.push(board[rank]);
          }
          continue;
        }
        symbol = board[rank];
        boardRank = rank;
        break;
      }

      const fallback = symbol == null;
      if (fallback) {
        symbol = pool.find(s => !taken.has(s)) ?? null;
        if (symbol == null) throw sentinel('pool_too_small', 'pool exhausted mid-resolution');
      }

      taken.add(symbol);
      picksByUser[odUserId].push(symbol);
      events.push({ pickNumber, round, odUserId, symbol, boardRank, fallback, passedOver });
    }
  }

  return {
    picksByUser,
    events,
    remainingPool: pool.filter(s => !taken.has(s)),
  };
}

/**
 * Resolve one group's user draft end-to-end (the handler's former
 * transaction body, extracted at P3b so the orchestrator's Monday pipeline
 * calls the SAME code path — one copy). Throws USER_DRAFT_SENTINEL_PREFIX
 * errors (group_not_found / not_forming / boards_missing / pool_too_small);
 * `boards_missing` is the finding-#5 defer signal upstream.
 *
 * League Next-Arc Slice 1 (additive, default-preserving): `targetStatus` is the
 * status the resolution lands (default GROUP_STATUS.BATTLE — the Monday/ranked
 * path is byte-identical). The training on-demand path passes AWAITING_OPEN plus
 * `startAnchor` (the next-market-open anchor) so the resolved pod waits for the
 * open instead of ticking immediately; `startAnchor` is written only when given.
 */
export async function resolveUserDraftForGroup(db, groupId, { now = new Date(), targetStatus = GROUP_STATUS.BATTLE, startAnchor = null } = {}) {
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const nowIso = now.toISOString();

  return db.runTransaction(async (tx) => {
    const groupSnap = await tx.get(groupRef);
    const group = groupSnap.exists ? groupSnap.data() : null;
    if (!group) throw sentinel('group_not_found');

    const members = group.groupMembers || [];
    const boardSnaps = members.length > 0
      ? await tx.getAll(...members.map(id => groupRef.collection('boards').doc(id)))
      : [];
    const boardsByUser = {};
    boardSnaps.forEach((snap, i) => {
      if (snap.exists) boardsByUser[members[i]] = snap.data();
    });

    const { picksByUser, events, remainingPool } = resolveSnakeDraft(group, boardsByUser);

    const players = (group.players || []).map(p => ({
      ...p,
      picks: picksByUser[p.odUserId].map(symbol => createPickState({
        symbol,
        baselineSource: BASELINE_SOURCE.DRAFT_RESOLUTION,
        baselinePrice: null,
        openedAt: nowIso,
      })),
    }));

    assertTransition(group.status, targetStatus);
    // Rider #3 (user side): the stream write and the group mutation commit
    // atomically — awaited in-request via the transaction.
    const groupUpdate = {
      players,
      userPool: remainingPool,
      status: targetStatus,
      updatedAt: nowIso,
    };
    // League Next-Arc Slice 1: the training on-demand path stamps the start
    // anchor (the next market open) so the awaiting-open flip and the day
    // clock read it; the default path passes none and leaves the doc unchanged.
    if (startAnchor != null) groupUpdate.startAnchor = startAnchor;
    tx.update(groupRef, groupUpdate);
    tx.set(groupRef.collection('streams').doc('userDraft'), {
      events,
      roundNumber: group.roundNumber,
      resolvedAt: nowIso,
    });

    return { picksByUser, events, remainingPoolSize: remainingPool.length, status: targetStatus };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { groupId } = body;
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }

  let summary;
  try {
    summary = await resolveUserDraftForGroup(getFirebaseAdmin(), groupId, { now: new Date() });
  } catch (err) {
    if (typeof err?.message === 'string' && err.message.startsWith(SENTINEL_PREFIX)) {
      const code = err.message.slice(SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        return res.status(statusCode).json({
          error: errorKey,
          message: err.detail ? `${humanCopy} ${err.detail}` : humanCopy,
        });
      }
    }
    console.error('[Tournament] resolve-user-draft error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not resolve the user draft.' });
  }

  console.log(`[Tournament] resolve-user-draft: group ${groupId} -> battle (${summary.events.length} picks)`);
  return res.status(200).json({ groupId, status: GROUP_STATUS.BATTLE, ...summary });
}
