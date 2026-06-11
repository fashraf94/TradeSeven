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
// Transport only: validation + doc assembly live in
// api/_utils/tournamentBoards.js (shared with the dev seeder; the P3
// orchestrator inherits the same core). Pattern reference:
// api/agent/equip-watchlist.js (security middleware, requireAuth, sentinel
// error map, transaction body).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { buildBoardCommit, BOARD_SENTINEL_PREFIX } from '../_utils/tournamentBoards.js';
import { TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 10 };

const SENTINEL_TO_HTTP = Object.freeze({
  group_not_found: [404, 'group_not_found', 'Tournament group not found.'],
  not_member:      [403, 'not_member',      'You are not a player in this group.'],
  not_forming:     [409, 'not_forming',     'Boards can only be committed while the group is forming.'],
  invalid_board:   [400, 'invalid_board',   'Board is invalid.'],
});

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
    if (typeof err?.message === 'string' && err.message.startsWith(BOARD_SENTINEL_PREFIX)) {
      const code = err.message.slice(BOARD_SENTINEL_PREFIX.length);
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
