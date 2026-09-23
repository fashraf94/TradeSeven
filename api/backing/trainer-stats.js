// api/backing/trainer-stats.js
//
// GET /api/backing/trainer-stats — Backing Beta PR 5, TRAINER STATS, PRIVATE
// TO THE TRAINER, LABELED "beta stats" (spec V1.3 §5 "Trainer stats —
// private to the trainer, labeled 'beta stats.' Unique backers on you, BP
// backed on you, backers' net on you. Non-ranked, no consequences attach
// (D-w)"; §8 "social-proof and trainer stats can be inflated … hence private,
// research-labeled, no consequences").
//
// THE ORDER, the same rungs every backing route climbs:
//   1  security middleware + rate limit
//   2  method — GET only
//   3  auth — the uid from the VERIFIED token; NO query parameter names a team
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth
//   5  the stakes that name the viewer's SEAT (the committed
//      `(teamOdUserId, status)` composite — firestore.indexes.json, PR 5),
//      each stake's sealed exclusion flag, the pools, the pure fold
//
// COMPUTED AT READ TIME FROM STAKES — settlement is not changed for this:
// `trainerStats` on the wallet document (§6) stays unwritten, and this route
// derives the same three figures from the stake documents that ARE the ledger
// (§6 ledger-first). An admin-EXCLUDED stake (§8) is dropped from these
// counts: this is the one social count the layer computes. The cost is one
// sealed `private/meta` read per stake on the trainer's seat — tens at beta
// scale (a pool caps a backer at 500 BP per team; a seat sees at most one
// pool a week).
//
// OWNER ONLY, BY CONSTRUCTION: the token's uid is the seat. No query parameter
// is read. Nothing here ranks, compares or attaches a consequence.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import {
  COUNTED_STAKE_STATUSES,
  computeTrainerStats,
  readExcludedStakeIds,
  readPoolsFor,
  readStakesWhere,
} from '../_utils/backingStats.js';
import { BACKING_BETA_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });

  // 3. Auth — the ONLY identity this route reads for.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth.
  if (!BACKING_BETA_ENABLED) return res.status(404).json({ error: 'Not found' });

  const db = getFirebaseAdmin();
  const now = new Date();
  try {
    // 5a. The stakes on the viewer's SEAT — in play or decided (voided stakes were never in the book).
    const stakes = await readStakesWhere(db, 'teamOdUserId', user.uid, { statuses: [...COUNTED_STAKE_STATUSES] });
    // 5b. The exclusion flags and the pools, in parallel.
    const [excluded, poolsByGroup] = await Promise.all([
      readExcludedStakeIds(db, stakes.map((s) => s.id)),
      readPoolsFor(db, stakes.map((s) => s.groupId)),
    ]);
    // 5c. The pure fold.
    const stats = computeTrainerStats({ stakes, poolsByGroup, excluded, now });
    return res.status(200).json({ viewerUid: user.uid, ...stats });
  } catch (err) {
    console.error('[backing-trainer-stats] failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load your trainer stats.' });
  }
}
