// api/_utils/tournamentLeaderboard.js
//
// P6a — the seasonal leaderboard writer (Spec §1.5; founder rulings A-3/A-4,
// June 12, 2026). Month-keyed docs at tournamentLeaderboards/{YYYY-MM}: a
// monthly "reset" is simply a NEW doc key — nothing is deleted, history is
// the set of prior docs. Raw signed cumulative composite throughout:
// negative totals are first-class rows (the cautionary-learning ruling),
// never floored, never hidden.
//
// WEEKLY LADDER (dark, WEEKLY_LADDER_PLACEMENT_ENABLED — spec
// 20260831_WEEKLY_LADDER_BUILD_SPEC_V1): behind the flag this board's PRIMARY
// score becomes cumulative PLACEMENT POINTS (3/2/1/0 off the day-5 finish
// order), with the cumulative composite retained as the stored tiebreak input
// (margin over the group average). Placement is awarded on FINAL rows only.
// Flag-off emits none of those keys, and the board scores on composite exactly
// as it does today. Career RP (tournamentRanks) and its cpuFarmGuard are
// untouched — that guard has no code path from this file.
//
// IDEMPOTENT BY CONSTRUCTION: each player's contribution is keyed
// entries.{odUserId}.weeks.{groupId} and SET (never incremented); the month
// total is recomputed as the sum of the weeks map on every write — re-run =
// same totals. In-progress weeks update nightly; Friday's day-5 banking (or
// the advancement's final upsert) settles `final: true`.
//
// MONTH ATTRIBUTION (ruling A-3): a group-week belongs to the ET month of
// its day-1 banking date (dailyScores.day1.recordedDate) — a week straddling
// a month boundary never splits. Groups with no banked day yet have nothing
// to publish and are skipped.
//
// DEV POSTURE (ruling A-4): isDev groups route to dev-{YYYY-MM} docs; the
// production doc never sees a smoke row. The nightly banking mirror is
// dev-INCLUSIVE by design (tournamentGroupService.js fetch note), so the
// routing — not the query — is what protects production.
//
// HOSTS (zero new cron entries): the nightly snake-draft handler (third
// tournament branch, after banking) and the Friday advancement's
// finalization side-effects. The manual bank-daily-scores endpoint upserts
// its one group for smoke parity.
//
// SCALE (priced, June 12, 2026): one whole-doc month board, read-modified-
// written per upsert — at ~250-400 bytes/entry the Firestore 1 MiB doc cap
// lands around 3-5k active players in a month, at which point every upsert
// for that month fails together. A conscious V1-launch-scale call (one
// bracket + base layer ≈ tens of rows); per-entry subcollection sharding is
// the designed escape hatch and MUST land before open registration (P6b/P8
// checklist item — recorded in the P6a phase report).
//
// Imports the zero-import schema module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of
// THIS module is the dependency-surface guard. `getArchetypeLabel` is a
// FENCED export (agentArchetypeConfig.js) — CALLED read-only, never edited
// (the tournamentCpu.js precedent).

import {
  TOURNAMENT_LEADERBOARDS_COLLECTION,
  GROUP_STATUS,
  getWeeklyScore,
  getWeeklyComposite,
  isWeekBanked,
  monthKeyFromEtDate,
  leaderboardDocId,
  isCpuUserId,
  cpuNFromUserId,
  rankByScores,
  round2,
} from '../../src/constants/leagueTournament.js';
import { fetchEligibleGroupsByStatus } from './tournamentGroupService.js';
import { cpuAgentName } from './tournamentCpu.js';
import { toIso } from './tournamentTime.js';
import { TOURNAMENT_ADVANCEMENT_FROZEN, WEEKLY_LADDER_PLACEMENT_ENABLED } from '../../src/config/featureFlags.js';

const LOG_PREFIX = '[TournamentLeaderboard]';

/** Ruling A-3: the group-week's month key, from the day-1 banking date.
 * Null when nothing has banked yet (nothing to publish). Pure. */
export function monthKeyForGroup(group) {
  return monthKeyFromEtDate(group?.dailyScores?.day1?.recordedDate);
}

/** A CPU seat's display name, derived from the id alone (the agents doc is
 * never read here; the label format's ONE home is tournamentCpu.js
 * cpuAgentName). Falls back to the bare 'CPU' on a malformed id. */
export function cpuDisplayName(odUserId) {
  const n = cpuNFromUserId(odUserId);
  if (n == null) return 'CPU';
  try {
    return cpuAgentName(n);
  } catch {
    return 'CPU';
  }
}

/**
 * Resolve display names for human players from users/{uid} (authenticated-
 * read profile docs; the PvP precedent reads username || displayName —
 * firebaseService.js:1715). Read failures degrade to the odUserId — the
 * leaderboard never blocks on a profile read. CPU ids never hit Firestore.
 */
export async function resolveDisplayNames(db, odUserIds) {
  const names = {};
  await Promise.all([...new Set(odUserIds)].map(async (odUserId) => {
    if (isCpuUserId(odUserId)) {
      names[odUserId] = cpuDisplayName(odUserId);
      return;
    }
    try {
      const snap = await db.collection('users').doc(odUserId).get();
      const profile = snap.exists ? snap.data() : null;
      names[odUserId] = profile?.username || profile?.displayName || odUserId;
    } catch (err) {
      console.warn(`${LOG_PREFIX} users/${odUserId} read failed — falling back to id:`, err.message);
      names[odUserId] = odUserId;
    }
  }));
  return names;
}

// ==================== WEEKLY LADDER — PLACEMENT POINTS (dark) ====================
//
// Spec 20260831_WEEKLY_LADDER_BUILD_SPEC_V1 §1-§3, behind
// WEEKLY_LADDER_PLACEMENT_ENABLED. Re-scores this board from cumulative
// COMPOSITE to cumulative PLACEMENT POINTS; the composite is retained as the
// stored tiebreak input (margin over the group average), never the primary key.
// Everything below is PURE and derives from the group doc alone — the finish
// order needs no new read, because lockTopTwo's order is itself just
// rankByScores over each seat's getWeeklyComposite.

/** 1st=3 · 2nd=2 · 3rd=1 · 4th=0 (spec §1). Frozen — a config entry, not code. */
export const PLACEMENT_POINTS = Object.freeze([3, 2, 1, 0]);

/** Points for a 1-based placement; 0 for unplaced or out-of-table. Pure. */
export function placementPointsFor(placement) {
  if (!Number.isInteger(placement) || placement < 1) return 0;
  return PLACEMENT_POINTS[placement - 1] ?? 0;
}

/**
 * Per-seat placement + composite margin for one group (spec §1/§3). Pure.
 *
 * ORDER OF RECORD: ranks over `groupMembers`, exactly as lockTopTwo does
 * (tournamentAdvancement.js:104-111) — NOT over `players`. The two carry the
 * same seats in the same order at creation (leagueTournament.js:1459), but
 * groupMembers is the sequence rankByScores uses for its draft-order tiebreak,
 * so ranking anything else could produce a finish order that disagrees with the
 * one the career path already recorded for the same week. Falls back to the
 * players' ids only if groupMembers is absent.
 *
 * SORTED ON the day-5 clamped composite (getWeeklyComposite — the L-B Guard 2
 * value), which is the same input the advancement's cut reads.
 *
 * MARGIN = seat composite − mean(group composites), over ALL seats including
 * CPUs: the CPUs are part of the field the human actually competed against, and
 * the ruling counts their finishes.
 *
 * FINAL-ONLY (founder decision D1, 2026-08-31): placement is a WEEK'S OUTCOME.
 * An unfinished week contributes nothing — 0 points, 0 margin, null placement —
 * so the nightly in-progress rewrite cannot churn the season rank on a day
 * nobody finished. THE FIELD carries the live state; this board carries results.
 */
export function buildPlacementForGroup(group, final) {
  const members = (group?.groupMembers?.length ? group.groupMembers : (group?.players || []).map(p => p?.odUserId))
    .filter(id => typeof id === 'string' && id.length > 0);
  const out = {};
  if (!final) {
    for (const id of members) out[id] = { placement: null, placementPoints: 0, compositeMargin: 0 };
    return out;
  }
  const composites = {};
  for (const id of members) composites[id] = getWeeklyComposite(group, id);
  const ranking = rankByScores(composites, members);
  const mean = members.length
    ? members.reduce((sum, id) => sum + composites[id], 0) / members.length
    : 0;
  for (const id of members) {
    const placement = ranking.indexOf(id) + 1;
    out[id] = {
      placement: placement >= 1 ? placement : null,
      placementPoints: placementPointsFor(placement),
      compositeMargin: round2(composites[id] - mean),
    };
  }
  return out;
}

/**
 * One group's per-player week contributions (pure): the weekly composite of
 * record + the user-layer detail, keyed for the entries.{uid}.weeks.{groupId}
 * upsert. `final` once day 5 is banked or the group has completed.
 */
export function buildGroupWeekRows(group, nowIso) {
  const final = isWeekBanked(group) || group.status === GROUP_STATUS.COMPLETE;
  // Dark: null when the flag is off, so the spread below contributes NOTHING and
  // the row shape is byte-identical to today's (acceptance 7).
  const placement = WEEKLY_LADDER_PLACEMENT_ENABLED ? buildPlacementForGroup(group, final) : null;
  return (group.players || []).map(player => ({
    odUserId: player.odUserId,
    isCpu: player.isCpu === true,
    groupId: group.id,
    week: {
      points: getWeeklyComposite(group, player.odUserId),
      userPoints: getWeeklyScore(group, player.odUserId),
      roundNumber: group.roundNumber ?? null,
      ...(group.bracketGameId != null
        ? { bracketGameId: group.bracketGameId }
        : { baseLayerWeek: group.baseLayerWeek ?? null }),
      final,
      ...(placement?.[player.odUserId] ?? {}),
      updatedAt: nowIso,
    },
  }));
}

/** Linear-interpolation quantile of an ASCENDING-sorted numeric array
 * (the R-7 / Excel PERCENTILE.INC convention). Pure; [] → 0. */
function quantile(sortedAsc, q) {
  if (sortedAsc.length === 0) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedAsc[base + 1];
  return next !== undefined ? sortedAsc[base] + rest * (next - sortedAsc[base]) : sortedAsc[base];
}

/**
 * The C-1 consensus + contrarian feeds (founder ruling, June 12, 2026) —
 * PURE derived fields on the month leaderboard doc, no new reads: the cohort
 * groups already carry the user picks + the day's composites, and
 * `heldByGroup` is the agent-held symbol list threaded from the nightly
 * reconcile pass (Option 1).
 *
 * CONSENSUS — the crowd's favorites: per symbol, the count of distinct user
 * holders (a player whose live picks include it) and agent holders (one per
 * group, by exclusivity), ranked by the total. The agent layer is omitted for
 * any group MISSING from `heldByGroup` (reconcile skipped/failed it) — that
 * group degrades to user-layer-only, never crashes (founder constraint).
 *
 * CONTRARIAN — the lonely winners: symbols held by ≤ 2 holders total whose
 * best USER holder sits in the cohort's upper composite quartile (open cards
 * — named). Cohorts with < 4 composites have no meaningful quartile, so
 * contrarian is empty there (honest, never a degenerate Q3). Pure.
 */
export function buildLeaderboardFeeds(groups, { heldByGroup = {}, displayNames = {}, topN = 6 } = {}) {
  const userHolders = new Map();     // symbol -> Set<odUserId>
  const agentHolders = new Map();    // symbol -> count (one agent per group)
  const compositeByUser = new Map(); // odUserId -> latest-day composite

  for (const group of groups || []) {
    for (const player of group.players || []) {
      compositeByUser.set(player.odUserId, getWeeklyComposite(group, player.odUserId));
      for (const pick of player.picks || []) {
        if (!pick?.symbol) continue;
        if (!userHolders.has(pick.symbol)) userHolders.set(pick.symbol, new Set());
        userHolders.get(pick.symbol).add(player.odUserId);
      }
    }
    for (const symbol of heldByGroup[group.id] || []) {
      agentHolders.set(symbol, (agentHolders.get(symbol) || 0) + 1);
    }
  }

  const symbols = new Set([...userHolders.keys(), ...agentHolders.keys()]);
  const bySymbolAsc = (x, y) => (x.symbol < y.symbol ? -1 : x.symbol > y.symbol ? 1 : 0);

  const consensus = [...symbols]
    .map(symbol => {
      const u = userHolders.get(symbol)?.size || 0;
      const a = agentHolders.get(symbol) || 0;
      return { symbol, userHolders: u, agentHolders: a, totalHolders: u + a };
    })
    .sort((x, y) => (y.totalHolders - x.totalHolders) || bySymbolAsc(x, y))
    .slice(0, topN);

  let contrarian = [];
  const composites = [...compositeByUser.values()].sort((a, b) => a - b);
  if (composites.length >= 4) {
    const q3 = quantile(composites, 0.75);
    contrarian = [...symbols]
      .map(symbol => {
        const holders = (userHolders.get(symbol)?.size || 0) + (agentHolders.get(symbol) || 0);
        if (holders === 0 || holders > 2) return null;
        const inQuartile = [...(userHolders.get(symbol) || [])]
          .filter(uid => (compositeByUser.get(uid) ?? -Infinity) >= q3);
        if (inQuartile.length === 0) return null;
        const bestComposite = Math.max(...inQuartile.map(uid => compositeByUser.get(uid)));
        return {
          symbol,
          holders,
          names: inQuartile.map(uid => displayNames[uid] || uid),
          bestComposite: round2(bestComposite),
        };
      })
      .filter(Boolean)
      .sort((x, y) => (y.bestComposite - x.bestComposite) || bySymbolAsc(x, y))
      .slice(0, topN);
  }

  return { consensus, contrarian };
}

/**
 * Upsert the given groups' current week contributions into their month docs.
 * Cohorts by (dev-namespace, month key); one transaction per doc — the
 * whole-doc tx.set read-modify-write (the ledger's whole-doc precedent:
 * entry keys are caller ids, never dot-pathed).
 *
 * Returns {groups, skippedNoBanking, docsWritten, errors}.
 */
export async function upsertLeaderboardForGroups(db, groups, { now = new Date(), dev, heldByGroup = {}, writeFeeds = false } = {}) {
  const nowIso = toIso(now);
  const summary = { groups: groups.length, skippedNoBanking: 0, docsWritten: 0, errors: 0, frozenSkipped: 0 };

  // EMERGENCY ADVANCEMENT FREEZE (TOURNAMENT_ADVANCEMENT_FROZEN) — the ONE
  // knowledge point covering BOTH leaderboard call sites (nightly
  // aggregateTournamentLeaderboards and the manual bank-daily-scores endpoint).
  // While frozen, do NOT publish in-flight non-training (battle) composites:
  // buildGroupWeekRows would otherwise stamp the poisoned week `final: true` on
  // day-5 banking, outside the advancement guard. Skip those groups loudly and
  // leave existing rows untouched (they self-heal on the post-remediation
  // re-aggregation — SET + recomputed month total). Training pods are already
  // excluded upstream; COMPLETED groups (a finalized, non-frozen week) still
  // upsert. Flag-off, this block is a no-op and behavior is identical.
  let eligibleGroups = groups;
  if (TOURNAMENT_ADVANCEMENT_FROZEN) {
    eligibleGroups = [];
    for (const group of groups) {
      if (group.status === GROUP_STATUS.BATTLE && group.isTraining !== true) {
        summary.frozenSkipped++;
        console.error(`${LOG_PREFIX} FROZEN (TOURNAMENT_ADVANCEMENT_FROZEN): leaderboard week-row upsert WITHHELD for battle group ${group.id} — poisoned composite not published (existing rows left to self-heal on re-aggregation)`);
      } else {
        eligibleGroups.push(group);
      }
    }
  }

  // Cohort groups by target doc id. `dev` (when the caller resolved the
  // namespace — the advancement's unified derivation) overrides the
  // per-group flag so BOTH side-effect halves route from ONE decision
  // (code review: rank and leaderboard could otherwise split namespaces).
  const cohorts = new Map(); // docId -> { monthKey, groups: [] }
  for (const group of eligibleGroups) {
    const monthKey = monthKeyForGroup(group);
    if (!monthKey) {
      summary.skippedNoBanking++;
      continue;
    }
    const docId = leaderboardDocId(monthKey, { dev: dev === undefined ? group.isDev === true : dev === true });
    if (!cohorts.has(docId)) cohorts.set(docId, { monthKey, groups: [] });
    cohorts.get(docId).groups.push(group);
  }
  if (cohorts.size === 0) return summary;

  // One name resolution per run, outside the transactions.
  const allIds = [...cohorts.values()].flatMap(({ groups: gs }) =>
    gs.flatMap(g => (g.players || []).map(p => p.odUserId)));
  const displayNames = await resolveDisplayNames(db, allIds);

  for (const [docId, { monthKey, groups: cohortGroups }] of cohorts.entries()) {
    try {
      const ref = db.collection(TOURNAMENT_LEADERBOARDS_COLLECTION).doc(docId);
      // C-1 feeds: only the nightly aggregation writes them (writeFeeds + the
      // threaded heldByGroup). Computed ONCE here — it depends on no tx-read
      // data, so it must not live inside the transaction body (which re-runs
      // on contention). The advancement's single-group final upsert omits
      // feeds, so `...doc` preserves the richer nightly feeds — a degenerate
      // one-group view never clobbers the season's board.
      const feeds = writeFeeds
        ? buildLeaderboardFeeds(cohortGroups, { heldByGroup, displayNames })
        : undefined;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const doc = snap.exists
          ? snap.data()
          : { monthKey, entries: {}, createdAt: nowIso };
        const entries = { ...(doc.entries || {}) };

        for (const group of cohortGroups) {
          for (const row of buildGroupWeekRows(group, nowIso)) {
            const prior = entries[row.odUserId] || {
              odUserId: row.odUserId,
              weeks: {},
            };
            const weeks = { ...(prior.weeks || {}), [row.groupId]: row.week };
            entries[row.odUserId] = {
              ...prior,
              odUserId: row.odUserId,
              displayName: displayNames[row.odUserId] || row.odUserId,
              isCpu: row.isCpu,
              weeks,
              // The month total: Σ over the weeks map, recomputed every
              // write — signed, never floored (re-run = same totals).
              points: round2(Object.values(weeks).reduce((sum, w) => sum + (w.points || 0), 0)),
              // Weekly ladder (dark): the PRIMARY sort key and its tiebreak,
              // accumulated on the SAME Σ-over-weeks grain as `points` above —
              // SET-not-increment, recomputed every write, so a cron re-run,
              // retry or replay re-derives the identical total instead of
              // double-awarding (spec §6; the guard this path already had).
              // Flag-off contributes no keys at all (acceptance 7).
              ...(WEEKLY_LADDER_PLACEMENT_ENABLED ? {
                placementPoints: Object.values(weeks).reduce((sum, w) => sum + (w.placementPoints || 0), 0),
                compositeMargin: round2(Object.values(weeks).reduce((sum, w) => sum + (w.compositeMargin || 0), 0)),
              } : {}),
              // Tier-2 spectator entry (P6b reads it): the latest group —
              // an active group always wins; otherwise keep the prior
              // pointer, defaulting to this group when none exists.
              currentGroupId: group.status === GROUP_STATUS.BATTLE
                ? row.groupId
                : (prior.currentGroupId ?? row.groupId),
              updatedAt: nowIso,
            };
          }
        }

        tx.set(ref, { ...doc, monthKey, entries, ...(feeds ? { feeds } : {}), updatedAt: nowIso });
      });
      summary.docsWritten++;
    } catch (err) {
      console.error(`${LOG_PREFIX} doc ${docId} upsert FAILED:`, err.message);
      summary.errors++;
    }
  }
  return summary;
}

/**
 * The nightly aggregation pass (rides the snake-draft handler AFTER banking
 * so the day's snapshots are in — zero new cron entries). Queries battle
 * groups dev-INCLUSIVELY and lets the A-4 routing namespace them; zero
 * groups is a clean no-op (the production state until brackets run).
 */
export async function aggregateTournamentLeaderboards(db, { now = new Date(), heldByGroup = {} } = {}) {
  // The ONE eligibility query home (code review: this was a third copy) —
  // dev-INCLUSIVE here by design; the A-4 routing namespaces inside.
  // League Next-Arc (Slice 3.0): EXCLUDE isTraining pods — they bank their own
  // daily closes but never feed the seasonal board / cumulative season score
  // (Spec §5). Opt-in on the shared query so deploy/fan-out duties keep training.
  const groups = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE, { includeDev: true, excludeTraining: true });
  if (groups.length === 0) {
    return { groups: 0, skippedNoBanking: 0, docsWritten: 0, errors: 0 };
  }
  // P6b: writeFeeds + the heldByGroup threaded from the reconcile pass (the
  // host runs banking → reconcile → leaderboard). heldByGroup defaults to {}
  // if reconcile failed/was skipped — every feed then degrades honestly.
  return upsertLeaderboardForGroups(db, groups, { now, heldByGroup, writeFeeds: true });
}
