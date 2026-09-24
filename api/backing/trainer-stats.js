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
//   5  THREE READ ROUNDS (backingStats.js, "THE TRAINER'S READS"): the stakes
//      that name the viewer's SEAT (the committed `(teamOdUserId, status)`
//      composite — firestore.indexes.json, PR 5) ‖ the pods the viewer sits
//      in; the pools — one per pod of this week or later they sit in, one per
//      pod a counted stake names — with the lazy close of any of those pools
//      due to close; each countable stake's sealed exclusion flag; the pure fold
//
// CLOSED WEEKS ONLY — AN OPEN POOL IS SEALED EVEN TO THE TRAINER (spec §3,
// Amendment B D-q, the desktop design; SEAL-1, the desktop review record).
// The fold reads no stake on an open pool — no count, no sum, no tally moves
// while the book is sealed — and the reply carries `thisWeek: { sealed: true }`
// instead, whenever the trainer's team sits in a pool still open. That marker
// is read from the POOL (`trainerSealed`), never from the stakes: a seal line
// that appeared only when someone had staked would say so by itself
// (SEAL-R-2). No figure of an open pool is in this reply under any key; the
// trainer-stats suite walks the whole body to prove it. Nor is one in what the
// reply costs: no round's set of reads depends on a sealed book (SEAL-A2, the
// pre-flip fixes 2 review record) — only the stakes query's own response grows
// with it (PLACE-R-4; a composite index would remove that — separate tasking).
// The figures appear once the pool closes —
// and a pool this route reads past its close is closed by this route
// (`ensureClosed`, as every other pool reader closes it; PLACE-A3).
//
// COMPUTED AT READ TIME FROM STAKES — settlement is not changed for this:
// `trainerStats` on the wallet document (§6) stays unwritten, and this route
// derives the same three figures from the stake documents that ARE the ledger
// (§6 ledger-first). An admin-EXCLUDED stake (§8) is dropped from these
// counts: this is the one social count the layer computes. The cost is one
// sealed `private/meta` read per countable stake on the trainer's seat — tens
// at beta scale (a pool caps a backer at 500 BP per team; a seat sees at most
// one pool a week) — and the member-scoped pods query, whose result grows with
// the pods the viewer has ever sat in (bounding it needs a composite index:
// separate tasking, the pre-flip fixes 2 review record).
//
// OWNER ONLY, BY CONSTRUCTION: the token's uid is the seat. No query parameter
// is read. Nothing here ranks, compares or attaches a consequence.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import {
  COUNTED_STAKE_STATUSES,
  computeTrainerStats,
  countedStakes,
  flaggedStakeIds,
  readExcludedStakeIds,
  readSeatedPods,
  readStakesWhere,
  readTrainerPools,
  sealPodsOf,
  trainerSealed,
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
    // 5a. The stakes on the viewer's SEAT — in play or decided (voided stakes
    // were never in the book) — and, beside them, the pods the viewer sits in.
    const [stakes, seatedPods] = await Promise.all([
      readStakesWhere(db, 'teamOdUserId', user.uid, { statuses: [...COUNTED_STAKE_STATUSES] }),
      readSeatedPods(db, user.uid),
    ]);
    // 5b. The pools: one per pod of this week or later the viewer sits in (the
    // seal's, whatever their books hold) and one per pod a counted stake names
    // (a live stake on a pod the viewer left is never read) — each seated pod's
    // closed here when its close is due.
    const counted = countedStakes(stakes, new Set(seatedPods.map((g) => g.id)));
    const poolsByGroup = await readTrainerPools(db, { seatedPods, sealPods: sealPodsOf(seatedPods, now), stakes: counted, now });
    // 5c. The exclusion flags — only of stakes the fold can count, never one on an open pool.
    const excluded = await readExcludedStakeIds(db, flaggedStakeIds(counted, poolsByGroup));
    // 5d. The pure fold — closed weeks only — and the seal, off the same pools.
    const stats = computeTrainerStats({ stakes: counted, poolsByGroup, excluded, now });
    return res.status(200).json({ viewerUid: user.uid, ...stats, ...(trainerSealed(poolsByGroup) ? { thisWeek: { sealed: true } } : {}) });
  } catch (err) {
    console.error('[backing-trainer-stats] failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load your trainer stats.' });
  }
}
