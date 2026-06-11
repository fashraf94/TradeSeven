// api/tournament/commit-board.js
//
// P1a — POST /api/tournament/commit-board. Commits (or re-commits, while the
// group is still forming — last commit wins) the caller's pre-committed
// ranked draft board for one tournament group.
//
// SIGNAL CAPTURE RIDER, EVENT #1 (Addendum A §4 row 1, binding): the single
// awaited subcollection write below IS the capture — final ranked board, the
// prefill as suggested, the per-name delta (kept / reordered / removed /
// added), and round + group context, all writer-readable fields. No
// fire-and-forget anywhere in this handler.
//
// Pattern reference: api/agent/equip-watchlist.js (security middleware,
// requireAuth, sentinel error map, transaction body).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { getPlayer } from '../_utils/tournamentGroupService.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  TOURNAMENT_TUNING,
} from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__commit_board:';
const SENTINEL_TO_HTTP = Object.freeze({
  group_not_found: [404, 'group_not_found', 'Tournament group not found.'],
  not_member:      [403, 'not_member',      'You are not a player in this group.'],
  not_forming:     [409, 'not_forming',     'Boards can only be committed while the group is forming.'],
  invalid_board:   [400, 'invalid_board',   'Board is invalid.'],
});

function sentinel(code, detail) {
  const err = new Error(SENTINEL_PREFIX + code);
  err.detail = detail;
  return err;
}

/** Uppercase/trim string symbols; throws the supplied sentinel code on non-strings. */
function normalizeSymbols(values, code) {
  if (!Array.isArray(values)) throw sentinel(code, 'expected an array of symbols');
  return values.map((value) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw sentinel(code, 'symbols must be non-empty strings');
    }
    return value.trim().toUpperCase();
  });
}

/**
 * Per-name board-vs-prefill delta (rider #1 field). Pure; exported for tests.
 * kept = same rank as suggested; reordered = present in both at a different
 * rank; removed = suggested but cut; added = on the board, not suggested.
 * Ranks are 0-based board/prefill indexes.
 */
export function computeBoardDelta(prefillAsSuggested, board) {
  const prefillRank = new Map(prefillAsSuggested.map((s, i) => [s, i]));
  const boardRank = new Map(board.map((s, i) => [s, i]));
  const delta = [];
  for (const [symbol, rank] of boardRank) {
    if (!prefillRank.has(symbol)) {
      delta.push({ symbol, status: 'added', prefillRank: null, boardRank: rank });
    } else if (prefillRank.get(symbol) === rank) {
      delta.push({ symbol, status: 'kept', prefillRank: rank, boardRank: rank });
    } else {
      delta.push({ symbol, status: 'reordered', prefillRank: prefillRank.get(symbol), boardRank: rank });
    }
  }
  for (const [symbol, rank] of prefillRank) {
    if (!boardRank.has(symbol)) {
      delta.push({ symbol, status: 'removed', prefillRank: rank, boardRank: null });
    }
  }
  return delta;
}

/**
 * Pure core: validates the submission against the group and assembles the
 * boards/{odUserId} document. Exported for tests; the handler is transport.
 * Throws sentinel errors mapped to HTTP above.
 */
export function buildBoardCommit({ group, odUserId, board, prefillAsSuggested, now }) {
  if (!group) throw sentinel('group_not_found');
  if (!getPlayer(group, odUserId)) throw sentinel('not_member');
  if (group.status !== GROUP_STATUS.FORMING) throw sentinel('not_forming');

  const normalizedBoard = normalizeSymbols(board, 'invalid_board');
  const { BOARD_DEPTH_MIN, BOARD_DEPTH_MAX } = TOURNAMENT_TUNING;
  if (normalizedBoard.length < BOARD_DEPTH_MIN || normalizedBoard.length > BOARD_DEPTH_MAX) {
    throw sentinel('invalid_board', `board must rank ${BOARD_DEPTH_MIN}-${BOARD_DEPTH_MAX} names (got ${normalizedBoard.length})`);
  }
  if (new Set(normalizedBoard).size !== normalizedBoard.length) {
    throw sentinel('invalid_board', 'board contains duplicate symbols');
  }
  const pool = new Set(group.userPool || []);
  const offPool = normalizedBoard.filter(s => !pool.has(s));
  if (offPool.length > 0) {
    throw sentinel('invalid_board', `not in the group's draftable pool: ${offPool.join(', ')}`);
  }

  // The prefill snapshot is stored as suggested (deduped) — it is the
  // reference the delta is computed against, not a ranked submission.
  const normalizedPrefill = [...new Set(normalizeSymbols(prefillAsSuggested ?? [], 'invalid_board'))];

  return {
    odUserId,
    board: normalizedBoard,
    prefillAsSuggested: normalizedPrefill,
    delta: computeBoardDelta(normalizedPrefill, normalizedBoard),
    roundNumber: group.roundNumber,
    ...(group.bracketGameId != null
      ? { bracketGameId: group.bracketGameId }
      : { baseLayerWeek: group.baseLayerWeek }),
    committedAt: now,
  };
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { groupId, board, prefillAsSuggested } = req.body || {};
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }

  const db = getFirebaseAdmin();
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const nowIso = new Date().toISOString();

  let boardDoc;
  try {
    boardDoc = await db.runTransaction(async (tx) => {
      const groupSnap = await tx.get(groupRef);
      const commit = buildBoardCommit({
        group: groupSnap.exists ? groupSnap.data() : null,
        odUserId: user.uid,
        board,
        prefillAsSuggested,
        now: nowIso,
      });
      // Rider #1: awaited in-request via the transaction commit.
      tx.set(groupRef.collection('boards').doc(user.uid), commit);
      return commit;
    });
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
    console.error('[Tournament] commit-board error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not commit board.' });
  }

  console.log(`[Tournament] commit-board: group ${groupId} player ${user.uid} (${boardDoc.board.length} names)`);
  return res.status(200).json({ groupId, ...boardDoc });
}
