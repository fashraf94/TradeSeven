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
// Auth pattern: api/admin/backfill-snake-draft-day.js (ADMIN_SECRET/CRON_SECRET).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { createGroup } from '../_utils/tournamentGroupService.js';
import { buildBoardCommit } from '../tournament/commit-board.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_TUNING,
  USER_HELD_NAMES_PER_GROUP,
} from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 10 };

const PLACEHOLDER_IDS = ['dev-user-1', 'dev-user-2', 'dev-user-3'];

/** ISO-8601 week label (UTC), e.g. '2026-W24' — the baseLayerWeek key. */
export function isoWeekString(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // nearest Thursday decides the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  const providedSecret =
    req.headers['x-admin-secret'] ||
    req.query.secret ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!adminSecret) {
    return res.status(500).json({ error: 'Server not configured for admin operations' });
  }
  if (providedSecret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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

    // Ranked universe -> user pool, ranked order preserved (Spec §0.11).
    const rankingsSnap = await db.collection('indexIntelligence').doc('stockRankings').get();
    const stocks = rankingsSnap.exists ? rankingsSnap.data().stocks : null;
    const userPool = [];
    const seen = new Set();
    for (const stock of Array.isArray(stocks) ? stocks : []) {
      const symbol = typeof stock?.symbol === 'string' ? stock.symbol.trim().toUpperCase() : '';
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      userPool.push(symbol);
    }
    if (userPool.length < USER_HELD_NAMES_PER_GROUP) {
      return res.status(503).json({
        error: 'universe_unavailable',
        message: `stockRankings yielded ${userPool.length} names — rankings cron may not have run.`,
      });
    }

    const nowIso = new Date().toISOString();
    const players = [founderUserId, ...PLACEHOLDER_IDS].map(odUserId => ({ odUserId, picks: [] }));
    const { id: groupId, doc: groupDoc } = await createGroup(db, {
      players,
      userPool,
      roundNumber: 1,
      baseLayerWeek: isoWeekString(),
      now: nowIso,
    });

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
