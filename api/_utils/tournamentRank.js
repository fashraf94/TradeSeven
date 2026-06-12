// api/_utils/tournamentRank.js
//
// P6a — the career-rank writer (Spec §1.5; founder-signed B-1 ladder + B-2
// math, June 12, 2026). Rank moves on FINALIZED weeks only: the writer
// rides the Friday advancement duty (zero new cron entries) at game lock /
// base-layer completion, and the active-bracket sweep re-applies from the
// bracket doc alone so no crash window can orphan a week's RP.
//
// IDEMPOTENT PER (player, group-week): appliedGroups.{groupId} on the rank
// doc is the once-only guard — every caller may re-run freely. All math is
// the pure founder-signed functions in the schema module (computeRankDelta,
// cpuFarmGuard, applyRankWeek); this module owns only Firestore plumbing.
//
// DEV POSTURE (ruling A-4 mirrored): dev-group applications land at
// tournamentRanks/dev-{odUserId} — a smoke Friday can never move a real
// rank. CPUs accrue rank like anyone else, marked (no exclusion — the
// CPU-farm guard is the protection, not omission).
//
// Imports the zero-import schema module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of
// THIS module is the dependency-surface guard.

import {
  TOURNAMENT_RANKS_COLLECTION,
  RANK_TUNING,
  computeRankDelta,
  cpuFarmGuard,
  applyRankWeek,
  tierForRp,
  rankDocId,
  isCpuUserId,
} from '../../src/constants/leagueTournament.js';
import { resolveDisplayNames } from './tournamentLeaderboard.js';

const LOG_PREFIX = '[TournamentRank]';

const round2 = (x) => parseFloat(x.toFixed(2));

/**
 * Apply one finalized group-week to the four players' rank docs.
 *
 * @param {Object} db
 * @param {Object} args
 * @param {string} args.groupId - the idempotency key
 * @param {Array<{odUserId: string, isCpu?: boolean}>} args.seats
 * @param {Object<string, number>} args.compositeByPlayer - the locked weekly
 *   composites (ruling A-1: bracket finalScores / lockTopTwo finalScores)
 * @param {string[]} args.ranking - odUserIds, best first (placement order)
 * @param {boolean} [args.dev] - ruling A-4 namespace
 * @param {Date|string} [args.now]
 * @returns {{applied: number, skipped: number, errors: number}}
 */
export async function applyGroupWeekToRanks(db, { groupId, seats, compositeByPlayer, ranking, dev = false, now = new Date() }) {
  const nowIso = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const summary = { applied: 0, skipped: 0, errors: 0 };
  const displayNames = await resolveDisplayNames(db, seats.map(s => s.odUserId));

  for (const seat of seats) {
    const odUserId = seat.odUserId;
    try {
      const isCpu = seat.isCpu === true || isCpuUserId(odUserId);
      const placement = ranking.indexOf(odUserId) + 1; // 1-based; 0 → not ranked
      if (placement < 1) {
        console.error(`${LOG_PREFIX} group ${groupId}: ${odUserId} missing from ranking — skipped (founder attention)`);
        summary.errors++;
        continue;
      }
      const cpuOpponents = seats.filter(s => s.odUserId !== odUserId
        && (s.isCpu === true || isCpuUserId(s.odUserId))).length;
      const weeklyComposite = compositeByPlayer?.[odUserId] ?? 0;

      const ref = db.collection(TOURNAMENT_RANKS_COLLECTION).doc(rankDocId(odUserId, { dev }));
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const prior = snap.exists ? snap.data() : null;
        if (prior?.appliedGroups?.[groupId]) return 'skipped';

        const raw = weeklyComposite * RANK_TUNING.RP_PER_POINT
          + (RANK_TUNING.PLACEMENT_BONUS[placement - 1] ?? 0);
        const delta = computeRankDelta({ weeklyComposite, placement, cpuOpponents });
        const next = applyRankWeek(prior, delta);
        const event = {
          groupId,
          weeklyComposite: round2(weeklyComposite),
          placement,
          cpuOpponents,
          raw: round2(raw),
          guard: round2(cpuFarmGuard(cpuOpponents)),
          delta: round2(delta),
          rpAfter: next.rp,
          appliedAt: nowIso,
        };
        tx.set(ref, {
          odUserId,
          displayName: displayNames[odUserId] || odUserId,
          isCpu,
          ...next,
          appliedGroups: { ...(prior?.appliedGroups || {}), [groupId]: event },
          history: [...(prior?.history || []), event].slice(-RANK_TUNING.HISTORY_CAP),
          createdAt: prior?.createdAt ?? nowIso,
          updatedAt: nowIso,
        });
        return 'applied';
      });

      if (result === 'applied') {
        summary.applied++;
        console.log(`${LOG_PREFIX} ${dev ? '[dev] ' : ''}group ${groupId}: ${odUserId} placement ${placement}, composite ${round2(weeklyComposite)}, guard ${round2(cpuFarmGuard(cpuOpponents))} → applied`);
      } else {
        summary.skipped++;
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} group ${groupId}: rank apply for ${odUserId} FAILED:`, err.message);
      summary.errors++;
    }
  }
  return summary;
}

/**
 * The sweep-path variant: apply a LOCKED bracket game entry from the bracket
 * doc alone (the advancement's resumable-from-the-bracket posture). Ranking
 * is recomputed from finalScores with the seat-order tie-break — identical
 * to lockTopTwo's rule by construction. No-op until the entry is locked.
 */
export async function applyLockedGameToRanks(db, { entry, dev = false, now = new Date() }) {
  if (!entry || entry.advancers == null || entry.finalScores == null) {
    return { applied: 0, skipped: 0, errors: 0 };
  }
  const seats = entry.seats || [];
  const seatOrder = seats.map(s => s.odUserId);
  const ranking = [...seatOrder].sort((a, b) =>
    (entry.finalScores[b] - entry.finalScores[a]) || (seatOrder.indexOf(a) - seatOrder.indexOf(b)));
  return applyGroupWeekToRanks(db, {
    groupId: entry.groupId,
    seats,
    compositeByPlayer: entry.finalScores,
    ranking,
    dev,
    now,
  });
}

/** Read helper for surfaces/tests: the rank doc or the empty pre-play shape. */
export async function readRank(db, odUserId, { dev = false } = {}) {
  const snap = await db.collection(TOURNAMENT_RANKS_COLLECTION).doc(rankDocId(odUserId, { dev })).get();
  if (snap.exists) return snap.data();
  const tier = tierForRp(0);
  return {
    odUserId,
    rp: 0,
    tier: tier.tier,
    tierName: tier.name,
    floorRp: 0,
    peakRp: 0,
    appliedGroups: {},
    history: [],
  };
}
