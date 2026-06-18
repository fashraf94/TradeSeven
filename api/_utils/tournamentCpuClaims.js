// api/_utils/tournamentCpuClaims.js
//
// League Training Slice 4 (B2) — CPU user-layer claim placement. CPUs contest
// the overnight waiver wire on their 3 user-layer stocks, symmetric to the human
// (founder ruling 5-C). Ported from the legacy snake-draft heuristic SHAPE
// (api/cron/snake-draft-daily-scores.js:322-371 — drop the worst performer) but
// adapted to the flat userPool / pick-state tournament model, with a DESIRABLE
// add bias: the add is the head of the CPU's deterministic ranked board
// (buildCpuUserBoard over the current userPool), NOT a random name — so a CPU's
// add collides with the human's top targets and makes contested waivers real.
//
// TRAINING-SCOPED: only isTraining pods get CPU placement (the legacy gate too);
// ranked CPU claims are a separate future decision and ranked pods are untouched.
//
// IDEMPOTENT PER CYCLE (founder build condition): placement carries a probability
// roll, so it is non-idempotent by nature. A per-pod marker
// claimSystem.lastCpuClaimDay — the only-exists-once-set idiom of
// claimSystem.lastProcessedDay — is reserved transactionally BEFORE any roll, so
// a host re-run (a retry, a manual trigger, any future dual-fire) is a clean
// no-op and a CPU can never stack claims across re-runs (bounded otherwise only
// by the 3-cap).
//
// Placement reuses the SHARED core (validateClaimPlacement + commitClaimPlacement,
// tournamentClaimPlacement.js) — ONE copy of the rules (BUILD_RULES §4). The
// claim-doc write is the rider #5 "placed" awaited capture (BUILD_RULES §5).
//
// USER-LAYER ONLY: writes only pending claim docs + the marker; it never touches
// the agent ledger / flattenPortfolioServer path (resolution owns the read-only
// double-down). Per-pod and per-seat try-isolation: one failure never blocks the
// rest, never blocks banking/completion (its host branch carries its own catch).
//
// Imports the zero-import schema module from src/ (BUILD_RULES §4); the
// co-located test's real import of THIS module is the dependency-surface guard.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  TRAINING_TUNING,
  buildCpuUserBoard,
  cpuNFromUserId,
  getLatestDayEntry,
  deriveCurrentTradingDay,
} from '../../src/constants/leagueTournament.js';
import { fetchEligibleGroupsByStatus } from './tournamentGroupService.js';
import { formatEtDate } from './tournamentTime.js';
import { validateClaimPlacement, commitClaimPlacement, LAST_CLAIM_DAY } from './tournamentClaimPlacement.js';

const LOG_PREFIX = '[TournamentCpuClaims]';

/**
 * Pure per-CPU claim decision (no I/O). Drop the worst-scoring own pick (legacy
 * shape), add the most DESIRABLE available pool name via the CPU's deterministic
 * ranked board. Returns `{ dropSymbol, addSymbol }` or `null` when no eligible
 * drop/add exists.
 *
 * @param {Object} args
 * @param {Object} args.player - the CPU player (group.players entry, has picks[].symbol)
 * @param {Object|undefined} args.closeScoresEntry - closeScores[cpuId] from the
 *   freshly-banked snapshot: { picks: [{ symbol, totalPoints, dropped? }] }
 * @param {string[]} args.userPool - the group's current claimable pool (ranked head)
 * @param {number} args.cpuN - cpuNFromUserId(player.odUserId)
 */
export function chooseCpuClaim({ player, closeScoresEntry, userPool, cpuN }) {
  const picks = player?.picks || [];
  if (picks.length === 0 || !Array.isArray(userPool) || userPool.length === 0) return null;
  if (!Number.isInteger(cpuN) || cpuN < 1) return null;

  const ownSymbols = new Set(picks.map(p => p?.symbol).filter(Boolean));

  // --- drop: the worst-scoring LIVE own pick (legacy drop-worst), scored by the
  // banked snapshot. A live pick missing from the snapshot is ignored here; if
  // none of the picks are scorable we fall back to the first own pick. ---
  const scored = (closeScoresEntry?.picks || []).filter(p => p && !p.dropped && ownSymbols.has(p.symbol));
  let dropSymbol;
  if (scored.length > 0) {
    dropSymbol = [...scored].sort((a, b) => (a.totalPoints ?? 0) - (b.totalPoints ?? 0))[0].symbol;
  } else {
    dropSymbol = picks[0]?.symbol ?? null;
  }
  if (!dropSymbol) return null;

  // --- add: the most desirable available name on the CPU's ranked board; the
  // per-CPU stagger collides neighboring boards + the human's top targets, so
  // resolution produces real contested waivers (board head → pool head fallback). ---
  const board = buildCpuUserBoard(userPool, cpuN);
  let addSymbol = board.find(s => !ownSymbols.has(s)) ?? null;
  if (!addSymbol) addSymbol = userPool.find(s => !ownSymbols.has(s)) ?? null;
  if (!addSymbol || addSymbol === dropSymbol) return null;

  return { dropSymbol, addSymbol };
}

/**
 * Place CPU claims for ONE training BATTLE pod, once per cycle. Reserves the
 * per-cycle marker transactionally before any probability roll (idempotent
 * re-runs), then places each eligible CPU's claim through the shared core.
 * Returns `{ status, day?, placed }` —
 * status ∈ 'placed' | 'no_claims' | 'already_placed' | 'skipped'.
 *
 * @param {Object} db
 * @param {Object} group - tournamentGroups doc data (with id)
 * @param {Object} [opts]
 * @param {Date} [opts.now]
 * @param {string} [opts.etDate]
 * @param {() => number} [opts.random] - injectable for tests
 */
export async function placeCpuClaimsForGroup(db, group, { now = new Date(), etDate = formatEtDate(now), random = Math.random } = {}) {
  if (group.isTraining !== true) return { status: 'skipped', reason: 'not_training', placed: 0 };
  if (group.status !== GROUP_STATUS.BATTLE) return { status: 'skipped', reason: 'not_battle', placed: 0 };
  if (!group.claimSystem?.enabled) return { status: 'skipped', reason: 'claims_disabled', placed: 0 };

  const currentDay = deriveCurrentTradingDay(group, etDate);
  if (currentDay >= LAST_CLAIM_DAY) return { status: 'skipped', reason: 'last_day', day: currentDay, placed: 0 };

  // Per-cycle idempotency: reserve this day's CPU placement transactionally
  // (mirrors claimSystem.lastProcessedDay). A re-entry that already placed for
  // this day no-ops, so the probability roll never repeats.
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id);
  const reserved = await db.runTransaction(async (tx) => {
    const snap = await tx.get(groupRef);
    if (!snap.exists) return false;
    const fresh = snap.data();
    if (fresh.status !== GROUP_STATUS.BATTLE) return false;
    if ((fresh.claimSystem?.lastCpuClaimDay ?? 0) >= currentDay) return false;
    tx.update(groupRef, { 'claimSystem.lastCpuClaimDay': currentDay });
    return true;
  });
  if (!reserved) return { status: 'already_placed', day: currentDay, placed: 0 };

  const closeScores = getLatestDayEntry(group)?.entry?.closeScores || {};
  const userPool = group.userPool || [];
  const cpus = (group.players || []).filter(p => p.isCpu === true);

  let placed = 0;
  for (const cpu of cpus) {
    try {
      if (random() >= TRAINING_TUNING.CPU_CLAIM_PROBABILITY) continue;
      const cpuN = cpuNFromUserId(cpu.odUserId);
      if (cpuN == null) continue;

      const choice = chooseCpuClaim({ player: cpu, closeScoresEntry: closeScores[cpu.odUserId], userPool, cpuN });
      if (!choice) continue;

      // Same canonical validation the human path runs (the shared core).
      const validation = validateClaimPlacement({ group, player: cpu, dropSymbol: choice.dropSymbol, addSymbol: choice.addSymbol, now });
      if (!validation.ok) continue;

      const placement = await commitClaimPlacement(db, {
        groupId: group.id, odUserId: cpu.odUserId, username: cpu.displayName ?? null,
        dropSymbol: choice.dropSymbol, addSymbol: choice.addSymbol, rank: 1, now,
      });
      if (placement.claimId) {
        placed++;
        console.log(`${LOG_PREFIX} pod ${group.id} ${cpu.odUserId}: claimed ${choice.addSymbol} (drop ${choice.dropSymbol})`);
      }
    } catch (err) {
      // One seat's placement failure never blocks the rest (the marker is
      // already reserved, so the un-placed seats are simply skipped this cycle).
      console.error(`${LOG_PREFIX} pod ${group.id} ${cpu.odUserId}: placement failed: ${err.message}`);
    }
  }
  return { status: placed > 0 ? 'placed' : 'no_claims', day: currentDay, placed };
}

/**
 * The nightly pass: place CPU claims for EVERY training BATTLE pod. Rides the
 * banking host (snake-draft-daily-scores) AFTER banking — zero new cron. Its own
 * try per pod; a failure never blocks banking/completion (the host branch carries
 * its own catch too). Returns `{ pods, placed, claimedPods, skipped, errors }`.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date} [opts.now]
 * @param {() => number} [opts.random]
 * @param {boolean} [opts.includeDev] - matches the nightly banking posture (dev-inclusive)
 */
export async function placeCpuClaimsForTrainingPods(db, { now = new Date(), random = Math.random, includeDev = true } = {}) {
  const etDate = formatEtDate(now);
  const battle = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE, { includeDev });
  const training = battle.filter(g => g.isTraining === true);
  const summary = { pods: training.length, placed: 0, claimedPods: 0, skipped: 0, errors: 0 };
  if (training.length === 0) return summary;

  for (const group of training) {
    try {
      const res = await placeCpuClaimsForGroup(db, group, { now, etDate, random });
      summary.placed += res.placed;
      if (res.placed > 0) summary.claimedPods++;
      if (res.status === 'skipped' || res.status === 'already_placed') summary.skipped++;
    } catch (err) {
      summary.errors++;
      console.error(`${LOG_PREFIX} pod ${group.id} CPU-claim placement failed: ${err.message}`);
    }
  }
  return summary;
}
