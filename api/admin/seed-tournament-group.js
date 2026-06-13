// api/admin/seed-tournament-group.js
//
// P1a — POST /api/admin/seed-tournament-group. Dev/smoke-test seeding for the
// League Tournament user layer: creates one forming tournamentGroups doc with
// the caller-named founder player + three placeholder players, the user pool
// sourced from the live ranked universe (Spec §0.11: full catalog — the same
// universe agents see), and optionally pre-committed boards for the three
// placeholders so the founder can exercise resolution alone on Vercel preview.
//
// NOT a production path: the P3 orchestrator owns real group composition.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { createGroup, fetchRankedUserPool } from '../_utils/tournamentGroupService.js';
import { buildBoardCommit } from '../_utils/tournamentBoards.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_TUNING,
  USER_HELD_NAMES_PER_GROUP,
  PICKS_PER_PLAYER,
  isoWeekString,
} from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 10 };

const PLACEHOLDER_IDS = ['dev-user-1', 'dev-user-2', 'dev-user-3'];

// Pool floor when seeding placeholder boards (P3b-reported mismatch, fixed at
// P5 where the auto-commit smoke made it load-bearing): the deepest staggered
// slice starts at (placeholders−1)×PICKS_PER_PLAYER and must still yield
// BOARD_DEPTH_MIN names for buildBoardCommit — 12 alone under-guards it, and
// so would BOARD_DEPTH_MIN by itself (a 15-name pool leaves slice(3, 18) at
// 12 names). Without boards, resolution's own floor (12) is the requirement.
export const SEED_POOL_FLOOR =
  TOURNAMENT_TUNING.BOARD_DEPTH_MIN + (PLACEHOLDER_IDS.length - 1) * PICKS_PER_PLAYER;

// isoWeekString relocated to the schema module at P10 (BUILD_RULES §4 one-home
// rule) — the lobby formation service and this dev seeder now share it.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { founderUserId, autoCommitBoards = true } = body;
  if (!isValidForgeId(founderUserId)) {
    return res.status(400).json({ error: 'invalid_founder_user_id', message: 'founderUserId is required (the signed-in uid).' });
  }
  if (PLACEHOLDER_IDS.includes(founderUserId)) {
    return res.status(400).json({ error: 'invalid_founder_user_id', message: 'founderUserId collides with a placeholder id.' });
  }

  try {
    const db = getFirebaseAdmin();

    // Ranked universe -> user pool, ranked order preserved (Spec §0.11) —
    // converged onto the shared sourcing helper at P3b.
    const userPool = await fetchRankedUserPool(db);
    const poolFloor = autoCommitBoards ? SEED_POOL_FLOOR : USER_HELD_NAMES_PER_GROUP;
    if (userPool.length < poolFloor) {
      return res.status(503).json({
        error: 'universe_unavailable',
        message: `stockRankings yielded ${userPool.length} names (need ${poolFloor}) — rankings cron may not have run.`,
      });
    }

    const nowIso = new Date().toISOString();
    const players = [founderUserId, ...PLACEHOLDER_IDS].map(odUserId => ({ odUserId, picks: [] }));
    const { id: groupId, doc: groupDoc } = await createGroup(db, {
      players,
      userPool,
      roundNumber: 1,
      baseLayerWeek: isoWeekString(new Date()),
      now: nowIso,
    });
    // P4 companion (a): seeded groups are DEV groups — excluded from the
    // production orchestrator's duties (the dev duty buttons include them).
    await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).update({ isDev: true });
    groupDoc.isDev = true;

    // Optional placeholder boards: staggered top-of-pool slices so the
    // founder's board collides with at least one placeholder (real snipes in
    // the resolution stream). Stored via the same pure core as the real
    // endpoint, so the rider-#1 shape holds; marked seeded for the corpus.
    const seededBoards = [];
    if (autoCommitBoards) {
      const depth = TOURNAMENT_TUNING.BOARD_DEPTH_MIN;
      const batch = db.batch();
      const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
      PLACEHOLDER_IDS.forEach((odUserId, i) => {
        const board = userPool.slice(i * 3, i * 3 + depth);
        const commit = buildBoardCommit({
          group: groupDoc,
          odUserId,
          board,
          prefillAsSuggested: [],
          now: nowIso,
        });
        batch.set(groupRef.collection('boards').doc(odUserId), { ...commit, seeded: true });
        seededBoards.push({ odUserId, top3: board.slice(0, 3) });
      });
      await batch.commit();
    }

    console.log(`[Tournament] seed-tournament-group: ${groupId} for ${founderUserId} (pool ${userPool.length}, boards ${seededBoards.length})`);
    return res.status(200).json({
      groupId,
      status: groupDoc.status,
      poolSize: userPool.length,
      players: groupDoc.groupMembers,
      seededBoards,
    });
  } catch (err) {
    console.error('[Tournament] seed-tournament-group error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}
