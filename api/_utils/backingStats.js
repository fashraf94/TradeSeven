// api/_utils/backingStats.js
//
// Backing Beta PR 5 — THE PRIVATE STATS, computed at read time (spec V1.3 §5
// "My Backing stats — private" and "Trainer stats — private to the trainer,
// labeled 'beta stats'"; §2 the net formula; §8 "social-proof and trainer
// stats can be inflated … hence private, research-labeled, no consequences";
// §10 the naive baseline; rulings D-v, D-w). Nothing here is a ranking, a
// reputation or an achievement (§9), and nothing here is written back.
//
// TWO READERS, ONE SOURCE EACH:
//   · MY STATS — the viewer's OWN record. Net BP, season and career, is the
//     WALLET's cached ledger figure (`careerNet`, `seasons.{monthKey}.net` —
//     §6 ledger-first; settlement and the refund write both halves of every
//     pair there), never re-summed from stakes here. Pools backed / won and
//     weeks played are counted from the viewer's stake documents joined to
//     their pools; accuracy versus the naive baseline (§10: "back last week's
//     best placement") is judged per settled pool from the pool's recorded
//     winners and each human team's PRIOR placement in the tournament's own
//     rank history. A pool with no prior-week history on any team is EXCLUDED
//     from the comparison and counted separately, never scored.
//   · TRAINER STATS — the viewer AS A TEAM: unique backers on them, BP backed
//     on them, the backers' net on them, season and career, from the stakes
//     that name their seat (`teamOdUserId`, the committed
//     `(teamOdUserId, status)` composite). An admin-EXCLUDED stake (§8: the
//     flag "removes a stake from stats and social counts without touching
//     settlement math") is dropped here — it is the one social count this
//     layer computes — and is left alone in MY stats, which are the owner's
//     own ledger. AN OPEN POOL IS SEALED EVEN TO THE TRAINER (spec §3,
//     Amendment B D-q, the desktop design's "Closed weeks only — this week's
//     pool is sealed even to the trainer"; SEAL-1, the desktop review record):
//     none of its stakes reaches any figure or tally, the route states the
//     seal from the POOL (`trainerSealed`, over the pods of this week or later
//     the trainer sits in), never from whether a stake exists (SEAL-R-2), and
//     the reads the reply costs never depend on a sealed book (the trainer's
//     reads, below).
//
// SEASON = THE LADDER'S MONTH (§2): each pool's `monthKey` as settlement or
// the refund stamped it (the wallet's own season key), else the pool's
// battle-Monday month; the "current season" is the ET month of `now`. DEV
// POOLS ARE SKIPPED (§6's namespace): a founder smoke's dev stakes debit a
// `dev-` wallet, and mixing them into a production record would be two
// ledgers in one number. The skip is counted, not silent.
//
// READS, bounded — and one write every pool reader makes. My stats: the
// viewer's own stakes (one query), one pool per distinct pod, one rank doc per
// distinct human team of a settled pool. Trainer stats: the viewer's own pods
// (one member-scoped query), one pool read per pod of this week or later they
// sit in and per pod a counted stake names, and one sealed `private/meta` per
// countable stake for the exclusion flag (beta scale: tens, not thousands;
// stated in the route) — and THE LAZY CLOSE on a seated pod's pool open past
// its close (`ensureClosed`, the pod list's and the results reader's write;
// PLACE-A3). Nothing else is written.
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS
// module is the dependency-surface guard — never mock it.

import {
  BACKING_POOLS_COLLECTION,
  BACKING_STAKES_COLLECTION,
  POOL_STATUS,
  STAKE_STATUS,
  ensureClosed,
  liveStakeContradicts,
  liveTeamsFor,
  poolIdFor,
} from './backingPools.js';
import { TERMINAL_RESULT_STATUSES, monthKeyOfPool } from './backingResults.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_RANKS_COLLECTION,
  currentBaseLayerWeek,
  etDateString,
  isCpuUserId,
  monthKeyFromEtDate,
  rankDocId,
} from '../../src/constants/leagueTournament.js';

/** The label every stats surface carries (§5, D-w): research data, not a rank. */
export const BETA_STATS_LABEL = 'beta stats';

/**
 * The sealed per-stake meta's path, as the stake endpoint writes it
 * (api/tournament/backing-stake.js STAKE_PRIVATE_SUBCOLLECTION / STAKE_META_DOC —
 * pinned equal by backingStats.test.js so the reader and the writer cannot
 * drift apart).
 */
export const STAKE_PRIVATE_SUBCOLLECTION = 'private';
export const STAKE_META_DOC = 'meta';

/** The statuses a stake COUNTS in: in play or decided. Voided stakes were never in the book. */
export const COUNTED_STAKE_STATUSES = Object.freeze([STAKE_STATUS.LIVE, STAKE_STATUS.WON, STAKE_STATUS.LOST]);

/** The current season key — the ET month of `now`, the ladder's own reading. */
export function currentSeasonKey(now = new Date()) {
  return monthKeyFromEtDate(etDateString(now));
}

// ==================== READS ====================

/** Every stake matching one equality (plus an optional status disjunction), as `{ id, ...data }`. */
export async function readStakesWhere(db, field, value, { statuses = null } = {}) {
  let q = db.collection(BACKING_STAKES_COLLECTION).where(field, '==', value);
  if (Array.isArray(statuses) && statuses.length > 0) q = q.where('status', 'in', statuses);
  const snap = await q.get();
  const out = [];
  snap.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
  return out;
}

/**
 * The pool document for a pod, by groupId alone: the production id first, the
 * dev namespace second (`ensureClosed`'s tombstone rule) — a stake document
 * names its pod, never its pool, and a dev pod's pool lives at `dev-{groupId}`.
 */
export async function readPoolByGroupId(db, groupId) {
  for (const poolId of [groupId, `dev-${groupId}`]) {
    const snap = await db.collection(BACKING_POOLS_COLLECTION).doc(poolId).get();
    if (snap.exists) return { poolId, pool: snap.data(), isDev: poolId !== groupId };
  }
  return { poolId: null, pool: null, isDev: false };
}

/** The pools of many pods, in parallel: groupId → { poolId, pool, isDev }. */
export async function readPoolsFor(db, groupIds) {
  const ids = [...new Set((Array.isArray(groupIds) ? groupIds : []).filter((g) => typeof g === 'string' && g.length > 0))];
  const entries = await Promise.all(ids.map(async (groupId) => [groupId, await readPoolByGroupId(db, groupId)]));
  return new Map(entries);
}

/** The admin `excluded` flags of many stakes (their sealed `private/meta`), as a Set of the excluded ids. */
export async function readExcludedStakeIds(db, stakeIds) {
  const ids = [...new Set((Array.isArray(stakeIds) ? stakeIds : []).filter((s) => typeof s === 'string' && s.length > 0))];
  const flags = await Promise.all(ids.map(async (stakeId) => {
    const snap = await db.collection(BACKING_STAKES_COLLECTION).doc(stakeId)
      .collection(STAKE_PRIVATE_SUBCOLLECTION).doc(STAKE_META_DOC).get();
    return [stakeId, snap.exists && snap.data()?.excluded === true];
  }));
  return new Set(flags.filter(([, excluded]) => excluded).map(([id]) => id));
}

// ==================== THE TRAINER'S READS — SEALED BY CONSTRUCTION ====================
//
// SEAL-1 (the desktop review record) and its review (SEAL-A1, SEAL-A2,
// WIRE-A2, PLACE-A3 — the pre-flip fixes 2 review record): the trainer's reply
// may say nothing about a sealed book — not in its figures, not in its seal
// line, not in the reads it costs. The route reads in three rounds, and no
// round's set of documents depends on the book of a pool still sealed:
//   1  the stakes on the seat ‖ the pods the viewer SITS in (`readSeatedPods`);
//   2  ONE pool read per SEAL pod — a seated pod of this week or later
//      (`sealPodsOf`), read whatever its book holds — and per pod a counted
//      stake names that is not among them (`readTrainerPools`). A counted
//      stake is DECIDED (its pool is settled: nothing sealed) or LIVE on a pod
//      the viewer sits in (`countedStakes`): a seal pod, read anyway, or a pod
//      of an EARLIER week, whose pool — if still open — is past its close, and
//      this same round closes it (below), so that read is the reveal's, not
//      the seal's. A live stake on a pod the viewer no longer sits in (a seat
//      left, a pod deleted) is sealed or refund-bound and is never read;
//   3  the exclusion flag (`private/meta`) of each stake the fold can count —
//      never one on an open pool (`flaggedStakeIds`).
// Round 2 runs THE LAZY CLOSE on every seated pod's pool that is open past its
// close (`ensureClosed`, as the pod list, the results reader and the stake
// route run it — PLACE-A3): the seal lifts when the close is due, not when
// some other reader happens by. The seal line (`trainerSealed`) is read off
// round 2's documents — the same ones the fold reads — so the two cannot
// disagree about a pool that closed between two reads.

/** A well-formed base-layer week key ('YYYY-Www') — the only shape the seal's week bound compares. */
const WEEK_KEY = /^\d{4}-W\d{2}$/;

/**
 * The pods the viewer is SEATED in — the member-scoped `groupMembers
 * array-contains` query (one field, no composite index; the
 * `findActiveTrainingPodForUser` precedent) and a seat in `players[]`, the
 * pool's own team derivation (`liveTeamsFor`). Training pods never get a pool
 * and are left out. A seat the viewer LEFT is not theirs. `{ id, ...data }`.
 */
export async function readSeatedPods(db, uid) {
  if (typeof uid !== 'string' || uid.length === 0) return [];
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).where('groupMembers', 'array-contains', uid).get();
  const pods = [];
  snap.forEach((doc) => {
    const group = { id: doc.id, ...doc.data() };
    if (group.isTraining === true) return;
    if (!liveTeamsFor(group).some((t) => t.odUserId === uid)) return;
    pods.push(group);
  });
  return pods;
}

/**
 * THE SEAL'S WEEK BOUND (WIRE-A2): of the seated pods, the ones a sealed pool
 * can belong to — every pod NOT of an earlier week than `now`'s
 * (`currentBaseLayerWeek`, ET; week keys compare as strings). A pool is open,
 * in the ordinary run, only before its pod's battle week begins (its close
 * precedes the pod's Monday); this week's pods are kept for a close that is due
 * but not yet run (round 2 runs it). So the seal line never reads an earlier
 * week's pool — one a lifecycle gap left open cannot seal the record for ever
 * — and the reads stay at a pod or two. A pod with no readable week is kept:
 * a malformed field never drops a pod from the seal. Pure.
 */
export function sealPodsOf(pods, now = new Date()) {
  const current = currentBaseLayerWeek(now);
  return (Array.isArray(pods) ? pods : []).filter((g) => !(
    typeof g?.baseLayerWeek === 'string' && WEEK_KEY.test(g.baseLayerWeek) && g.baseLayerWeek < current
  ));
}

/**
 * The stakes the trainer fold may read at all: a DECIDED stake always (its
 * week closed and counts, even on a pod since deleted), a LIVE one only on a
 * pod the viewer sits in. A live stake on a pod the viewer left is sealed
 * until the close voids it (`seat_left`), and one on a deleted pod is
 * refund-bound — neither is ever the trainer's figure, and reading its pool
 * would make the reply's reads depend on a sealed book (SEAL-A2). Pure.
 */
export function countedStakes(stakes, seatedIds) {
  return (Array.isArray(stakes) ? stakes : []).filter((s) => s?.status !== STAKE_STATUS.LIVE || seatedIds.has(s?.groupId));
}

/** `ensureClosed`'s own due rule: past `closesAt`, or no readable `closesAt` at all (the conservative direction). Pure. */
export function closeIsDue(pool, now = new Date()) {
  const closesMs = new Date(pool?.closesAt).getTime();
  return !(Number.isFinite(closesMs) && new Date(now).getTime() < closesMs);
}

/** A seated pod's pool at its own id (`poolIdFor` — the dev namespace included); an id no pool can carry reads as none. */
async function readSeatPool(db, group) {
  let poolId;
  try { poolId = poolIdFor(group); } catch { return { poolId: null, pool: null, isDev: false }; }
  const snap = await db.collection(BACKING_POOLS_COLLECTION).doc(poolId).get();
  return { poolId: snap.exists ? poolId : null, pool: snap.exists ? snap.data() : null, isDev: group.isDev === true };
}

/**
 * THE LAZY CLOSE (PLACE-A3) for a seated pod's pool that is open past its
 * close: `ensureClosed`, and the pool as the close left it — closed by this
 * request or found closed by another. A failed close is logged and the pool
 * RE-READ (the pod list's rule; the close may have committed before the
 * failure): a failed re-read fails the request, as any plain read does. A dev
 * pool is left alone: it neither seals nor counts in this record.
 */
async function closeIfDue(db, group, located, now) {
  if (located.isDev === true || located.pool?.status !== POOL_STATUS.OPEN || !closeIsDue(located.pool, now)) return located;
  try {
    const closed = await ensureClosed(db, group, now);
    return closed.pool ? { ...located, pool: closed.pool } : located;
  } catch (err) {
    console.warn(`[backing-trainer-stats] close not run for ${group.id}:`, err?.message);
    const snap = await db.collection(BACKING_POOLS_COLLECTION).doc(located.poolId).get();
    return { ...located, pool: snap.exists ? snap.data() : null };
  }
}

/**
 * ROUND 2 — the trainer's pools, ONE read each: every SEAL pod's, whatever its
 * book holds, and every pod's a counted stake names that is not among them — a
 * seated pod's at its own id, any other's by `readPoolByGroupId`'s two
 * namespaces (a decided stake's pod, since left or deleted). Each seated pod's
 * pool then takes the lazy close when it is due (`closeIfDue`). The same map
 * feeds the fold, the seal line and round 3. groupId → { poolId, pool, isDev, seal }.
 */
export async function readTrainerPools(db, { seatedPods = [], sealPods = [], stakes = [], now = new Date() } = {}) {
  const seatedById = new Map([...seatedPods, ...sealPods].map((g) => [g.id, g]));
  const sealIds = new Set(sealPods.map((g) => g.id));
  const named = stakes.map((s) => s?.groupId).filter((g) => typeof g === 'string' && g.length > 0 && !sealIds.has(g));
  const entries = await Promise.all([...sealIds, ...new Set(named)].map(async (groupId) => {
    const group = seatedById.get(groupId) ?? null;
    const located = group ? await closeIfDue(db, group, await readSeatPool(db, group), now) : await readPoolByGroupId(db, groupId);
    return [groupId, { ...located, seal: sealIds.has(groupId) }];
  }));
  return new Map(entries);
}

/**
 * THE SEAL LINE (SEAL-1 / SEAL-R-2): is a SEAL pod's pool (a seated pod of
 * this week or later) still OPEN once round 2 has run its due closes? Read off
 * round 2's pools — the ones the fold reads — and keyed on the POOL, never on
 * stakes: a line that showed only when a stake named the seat would itself
 * say someone had backed the team, and a fold that hid an open pool's stakes
 * with no line would read "Nobody has backed your team yet" while four had.
 * The pool's STATUS is the seal: a close that failed leaves it sealed (the
 * close may yet void its stakes). A dev pod never seals the production record
 * the fold keeps (it skips dev pools — WIRE-A3). Pure.
 */
export function trainerSealed(poolsByGroup) {
  for (const located of poolsByGroup instanceof Map ? poolsByGroup.values() : []) {
    if (located?.seal === true && located.isDev !== true && located.pool?.status === POOL_STATUS.OPEN) return true;
  }
  return false;
}

/**
 * The stakes whose exclusion flag round 3 reads: the ones the fold can count —
 * on a pool round 2 found, not open, the copy not contradicted by it. Never a
 * stake on an open pool (SEAL-A2). Pure.
 */
export function flaggedStakeIds(stakes, poolsByGroup) {
  return (Array.isArray(stakes) ? stakes : [])
    .filter((s) => {
      const pool = poolsByGroup.get(s?.groupId)?.pool ?? null;
      return pool != null && pool.status !== POOL_STATUS.OPEN && !liveStakeContradicts(pool, s);
    })
    .map((s) => s.id);
}

/** The rank documents of many human teams (production namespace): odUserId → rank doc | null. */
export async function readRanksFor(db, odUserIds) {
  const ids = [...new Set((Array.isArray(odUserIds) ? odUserIds : []).filter((id) => typeof id === 'string' && id.length > 0 && !isCpuUserId(id)))];
  const entries = await Promise.all(ids.map(async (odUserId) => {
    const snap = await db.collection(TOURNAMENT_RANKS_COLLECTION).doc(rankDocId(odUserId)).get();
    return [odUserId, snap.exists ? snap.data() : null];
  }));
  return new Map(entries);
}

// ==================== THE BASELINE (§10) ====================

/**
 * A team's PRIOR placement — the placement the rank writer recorded for the
 * most recent completed week applied BEFORE `beforeIso` (the pool's close),
 * excluding this pod's own event. Null when the team has no such history.
 * Pure over the rank doc.
 */
/**
 * A rank document's events, ONE per pod: `appliedGroups` (the idempotency
 * map the rank writer keeps for every pod ever applied — never capped) first,
 * `history` (the last HISTORY_CAP events, a display list) only for a pod the
 * map does not carry. Judging the baseline over the capped list alone made
 * an old pool's "no prior week" EXCLUSION drift as newer events rolled the
 * pre-close ones off (HON-12, the PR 5 review record).
 */
export function rankEventsOf(rank) {
  const byGroup = new Map();
  const applied = rank?.appliedGroups && typeof rank.appliedGroups === 'object' ? Object.values(rank.appliedGroups) : [];
  for (const event of applied) if (event && typeof event.groupId === 'string') byGroup.set(event.groupId, event);
  for (const event of Array.isArray(rank?.history) ? rank.history : []) {
    if (event && typeof event.groupId === 'string' && !byGroup.has(event.groupId)) byGroup.set(event.groupId, event);
  }
  return [...byGroup.values()];
}

export function priorPlacementBefore(rank, { beforeIso, excludeGroupId = null } = {}) {
  const history = rankEventsOf(rank);
  let best = null;
  for (const event of history) {
    if (!event || event.groupId === excludeGroupId) continue;
    if (!Number.isInteger(event.placement) || event.placement < 1) continue;
    if (typeof event.appliedAt !== 'string') continue;
    if (typeof beforeIso === 'string' && !(event.appliedAt < beforeIso)) continue;
    if (best === null || event.appliedAt > best.appliedAt) best = event;
  }
  return best ? best.placement : null;
}

/**
 * The naive baseline's pick for a pool (§10: "back last week's best
 * placement"): the human team with the LOWEST prior placement; a tie goes to
 * the earlier seat in the frozen `teams[]` (the tournament's own seat-order
 * tiebreak). Null when NO team carries a prior placement — the pool is then
 * excluded from the comparison, never scored. Pure.
 *
 * @param {{odUserId: string, isCpu?: boolean}[]} teams the pool's frozen teams
 * @param {Map<string, number|null>} priorByTeam odUserId → prior placement
 */
export function baselinePick(teams, priorByTeam) {
  let pick = null;
  for (const team of Array.isArray(teams) ? teams : []) {
    if (!team || team.isCpu === true || isCpuUserId(team.odUserId)) continue;
    const prior = priorByTeam?.get?.(team.odUserId) ?? null;
    if (!Number.isInteger(prior)) continue;
    if (pick === null || prior < pick.prior) pick = { odUserId: team.odUserId, prior };
  }
  return pick ? pick.odUserId : null;
}

// ==================== THE PURE FOLDS ====================

const emptyMine = (monthKey = null) => ({
  monthKey, poolsBacked: 0, poolsWon: 0, weeksPlayed: 0, pending: 0, voidedPools: 0,
  stakes: 0, stakedBp: 0, paidBp: 0, inPlayBp: 0,
});

/**
 * ONE stake's ledger effect on net BP (§2: net BP = Σ payouts + Σ refunds −
 * Σ stakes): a won stake's payout less its stake, a lost or LIVE stake's
 * stake (debited at placement), a voided stake's zero (its refund pairs).
 */
function netEffectOf(stake) {
  const amount = Number.isFinite(stake?.amount) ? stake.amount : 0;
  switch (stake?.status) {
    case STAKE_STATUS.WON: return (Number.isFinite(stake.payout) ? stake.payout : 0) - amount;
    case STAKE_STATUS.LOST: return -amount;
    case STAKE_STATUS.LIVE: return -amount;
    default: return 0;
  }
}
const emptyAccuracy = () => ({ pools: 0, youWon: 0, baselineWon: 0, both: 0, excluded: 0 });

/**
 * MY STATS, pure. `stakes` are the viewer's own; `poolsByGroup` is groupId →
 * { poolId, pool }; `ranksByTeam` is odUserId → rank doc for the baseline;
 * `wallet` is the viewer's production wallet document (or null).
 */
export function computeMyStats({ stakes = [], poolsByGroup = new Map(), ranksByTeam = new Map(), wallet = null, now = new Date(), excluded = new Set() } = {}) {
  const season = currentSeasonKey(now);
  const career = emptyMine();
  const seasons = {};
  const accuracy = { career: emptyAccuracy(), seasons: {} };
  const weeksCareer = new Set();
  const weeksBySeason = {};
  let devPoolsSkipped = 0;
  let unknownPools = 0;
  // NET BP FOLLOWS ONE DEFINITION IN BOTH COLUMNS (§2: Σ payouts + Σ refunds
  // − Σ stakes, an in-play stake counted from the moment it is placed). The
  // wallet's `careerNet` already carries every placement's debit; its season
  // buckets move only at settlement (`recordStakeLoss`) — so the season
  // figure subtracts the live BP on that month's pools here, or the two
  // columns would count an in-play stake differently under one label (HON-4,
  // the PR 5 review record). An admin-EXCLUDED stake leaves the stats and
  // their net (§8; HON-5): its ledger effect is taken back out of both.
  const liveBp = { career: 0, seasons: {} };
  const excludedEffect = { career: 0, seasons: {} };
  let excludedStakes = 0;

  const byGroup = new Map();
  for (const s of stakes) {
    if (typeof s?.groupId !== 'string') continue;
    const list = byGroup.get(s.groupId) ?? [];
    list.push(s);
    byGroup.set(s.groupId, list);
  }

  for (const [groupId, mineAll] of byGroup) {
    let mine = mineAll;
    const located = poolsByGroup.get(groupId) ?? null;
    if (!located?.pool) { unknownPools += 1; continue; }
    if (located.isDev === true || (typeof located.poolId === 'string' && located.poolId.startsWith('dev-'))) { devPoolsSkipped += 1; continue; }
    const pool = located.pool;
    const monthKey = monthKeyOfPool(pool);
    const bucket = monthKey ? (seasons[monthKey] ??= emptyMine(monthKey)) : null;
    // The excluded stakes of this pool leave the counts, and their ledger
    // effect leaves the net (career, and the pool's month).
    const dropped = mine.filter((s) => excluded.has(s.id));
    if (dropped.length > 0) {
      excludedStakes += dropped.length;
      const effect = dropped.reduce((sum, s) => sum + netEffectOf(s), 0);
      excludedEffect.career += effect;
      if (monthKey) excludedEffect.seasons[monthKey] = (excludedEffect.seasons[monthKey] ?? 0) + effect;
      mine = mine.filter((s) => !excluded.has(s.id));
      if (mine.length === 0) continue;
    }
    const decided = mine.filter((s) => s.status === STAKE_STATUS.WON || s.status === STAKE_STATUS.LOST);
    const live = mine.filter((s) => s.status === STAKE_STATUS.LIVE);
    const won = decided.some((s) => s.status === STAKE_STATUS.WON);
    const liveAmount = live.reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0);
    liveBp.career += liveAmount;
    if (monthKey) liveBp.seasons[monthKey] = (liveBp.seasons[monthKey] ?? 0) + liveAmount;

    for (const target of [career, bucket].filter(Boolean)) {
      target.stakes += mine.length;
      target.inPlayBp += liveAmount;
      if (decided.length > 0) {
        target.poolsBacked += 1;
        if (won) target.poolsWon += 1;
        target.stakedBp += decided.reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0);
        target.paidBp += decided.reduce((sum, s) => sum + (s.status === STAKE_STATUS.WON && Number.isFinite(s.payout) ? s.payout : 0), 0);
      } else if (live.length > 0) {
        target.pending += 1;
      } else if (mine.length > 0 && mine.every((s) => s.status === STAKE_STATUS.VOIDED)) {
        target.voidedPools += 1;
      }
    }
    if (decided.length > 0) {
      for (const s of decided) {
        if (typeof s.weekKey !== 'string') continue;
        weeksCareer.add(s.weekKey);
        if (monthKey) (weeksBySeason[monthKey] ??= new Set()).add(s.weekKey);
      }
    }

    // ACCURACY (§10) — settled pools only, judged against the recorded winners.
    if (pool.status === POOL_STATUS.RESOLVED && decided.length > 0) {
      const winners = Array.isArray(pool.winnerOdUserIds) ? pool.winnerOdUserIds : [];
      const teams = Array.isArray(pool.teams) ? pool.teams : [];
      const priorByTeam = new Map(teams.map((t) => [t.odUserId, priorPlacementBefore(ranksByTeam.get(t.odUserId) ?? null, { beforeIso: pool.closedAt ?? pool.settledAt ?? null, excludeGroupId: groupId })]));
      const baseline = baselinePick(teams, priorByTeam);
      const targets = [accuracy.career, monthKey ? (accuracy.seasons[monthKey] ??= emptyAccuracy()) : null].filter(Boolean);
      if (baseline === null) {
        for (const a of targets) a.excluded += 1;
      } else {
        const yours = won;
        const theirs = winners.includes(baseline);
        for (const a of targets) {
          a.pools += 1;
          if (yours) a.youWon += 1;
          if (theirs) a.baselineWon += 1;
          if (yours && theirs) a.both += 1;
        }
      }
    }
  }

  career.weeksPlayed = weeksCareer.size;
  for (const [monthKey, weeks] of Object.entries(weeksBySeason)) seasons[monthKey].weeksPlayed = weeks.size;

  const walletSeasons = wallet?.seasons && typeof wallet.seasons === 'object' ? wallet.seasons : {};
  // A month's net: the ledger's settled figure, less the BP still in play on
  // that month's pools (debited at placement, not yet in the bucket), less
  // the effect of any excluded stake — the same definition as the career's.
  const netFor = (monthKey) => (Number.isFinite(walletSeasons[monthKey]?.net) ? walletSeasons[monthKey].net : 0)
    - (liveBp.seasons[monthKey] ?? 0) - (excludedEffect.seasons[monthKey] ?? 0);
  const careerNet = (Number.isFinite(wallet?.careerNet) ? wallet.careerNet : 0) - excludedEffect.career;
  for (const monthKey of Object.keys(seasons)) seasons[monthKey].net = netFor(monthKey);
  // A season the wallet knows but no pool of the viewer's names (a refund of a
  // pool since deleted, say) still shows its ledger figure.
  for (const monthKey of Object.keys(walletSeasons)) if (!seasons[monthKey]) seasons[monthKey] = { ...emptyMine(monthKey), net: netFor(monthKey) };

  return {
    label: BETA_STATS_LABEL,
    seasonKey: season,
    net: { career: careerNet, season: netFor(season) },
    career: { ...career, net: careerNet },
    season: seasons[season] ?? { ...emptyMine(season), net: netFor(season) },
    seasons,
    accuracy: { career: accuracy.career, season: accuracy.seasons[season] ?? emptyAccuracy(), seasons: accuracy.seasons },
    excludedStakes,
    devPoolsSkipped,
    unknownPools,
  };
}

const emptyTrainer = (monthKey = null) => ({
  monthKey, uniqueBackers: 0, bpBacked: 0, backersNet: 0, pending: 0, poolsBackedOn: 0, stakes: 0, decidedStakes: 0,
});

/**
 * TRAINER STATS, pure. `stakes` name the viewer's seat; `excluded` is the Set
 * of admin-excluded stake ids (dropped here, §8); `poolsByGroup` is groupId →
 * { poolId, pool, isDev }.
 *
 * A STAKE ON AN OPEN POOL IS NOT READ AT ALL (SEAL-1, the desktop review
 * record): it is skipped BEFORE every figure and every tally — backers, BP
 * backed, backers' net, in play, pools, the stake counts, and the excluded,
 * dev and unknown counters too — in the season buckets and the career alike,
 * so no part of this answer moves while the book is sealed. It counts from
 * the moment its pool's status leaves `open` (the close's reveal) — as the
 * close left it: a `live` copy the pool contradicts is stale and skipped
 * (SEAL-A1). The route hands in `countedStakes` (a live stake on a pod the
 * trainer no longer sits in is never read) and round 2's pools.
 */
export function computeTrainerStats({ stakes = [], poolsByGroup = new Map(), excluded = new Set(), now = new Date() } = {}) {
  const season = currentSeasonKey(now);
  const career = emptyTrainer();
  const seasons = {};
  const backersCareer = new Set();
  const poolsCareer = new Set();
  const backersBySeason = {};
  const poolsBySeason = {};
  let excludedStakes = 0;
  let devPoolsSkipped = 0;
  let unknownPools = 0;

  for (const s of stakes) {
    if (!COUNTED_STAKE_STATUSES.includes(s?.status)) continue;
    const located = poolsByGroup.get(s.groupId) ?? null;
    // THE SEAL, first: nothing below may see a stake on an open pool.
    if (located?.pool?.status === POOL_STATUS.OPEN) continue;
    // …nor a `live` copy the pool AS READ says cannot still be live (SEAL-A1,
    // the pre-flip fixes 2 review record): a close or a settlement landed
    // between the stakes query and the pool read — it voided the stake (a seat
    // that left, a deleted pod, below the floor) or decided it — so the copy
    // predates it, and counting it would show the trainer a stake the close
    // never revealed. It counts, as it now stands, on the next read.
    if (liveStakeContradicts(located?.pool, s)) continue;
    if (excluded.has(s.id)) { excludedStakes += 1; continue; }
    if (!located?.pool) { unknownPools += 1; continue; }
    if (located.isDev === true || (typeof located.poolId === 'string' && located.poolId.startsWith('dev-'))) { devPoolsSkipped += 1; continue; }
    const monthKey = monthKeyOfPool(located.pool);
    const bucket = monthKey ? (seasons[monthKey] ??= emptyTrainer(monthKey)) : null;
    const amount = Number.isFinite(s.amount) ? s.amount : 0;
    const decided = s.status === STAKE_STATUS.WON || s.status === STAKE_STATUS.LOST;
    const payout = s.status === STAKE_STATUS.WON && Number.isFinite(s.payout) ? s.payout : 0;
    for (const [target, backers, pools] of [[career, backersCareer, poolsCareer], bucket ? [bucket, (backersBySeason[monthKey] ??= new Set()), (poolsBySeason[monthKey] ??= new Set())] : null].filter(Boolean)) {
      target.stakes += 1;
      target.bpBacked += amount;
      backers.add(s.userId);
      pools.add(s.groupId);
      if (decided) { target.decidedStakes += 1; target.backersNet += payout - amount; } else target.pending += amount;
    }
  }
  career.uniqueBackers = backersCareer.size;
  career.poolsBackedOn = poolsCareer.size;
  for (const monthKey of Object.keys(seasons)) {
    seasons[monthKey].uniqueBackers = backersBySeason[monthKey]?.size ?? 0;
    seasons[monthKey].poolsBackedOn = poolsBySeason[monthKey]?.size ?? 0;
  }
  return {
    label: BETA_STATS_LABEL,
    seasonKey: season,
    career,
    season: seasons[season] ?? emptyTrainer(season),
    seasons,
    excludedStakes,
    devPoolsSkipped,
    unknownPools,
  };
}

/** True when a pool document has nothing left to decide (the results card's "completed" test). */
export function isTerminalPool(pool) {
  return TERMINAL_RESULT_STATUSES.has(pool?.status);
}
