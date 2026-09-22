// src/components/League/backing/backingStripState.js
//
// Backing Beta PR 4 — THE STRIP'S STATE, derived (design brief rev3 §1: one
// strip, four states, never static). Pure: no React, no Firestore, no clock
// read of its own (the caller passes `now`), so the derivation is unit-tested
// directly and the strip component only renders what comes out.
//
// THE INPUTS ARE REAL DATA, three sources:
//   · `pods` — GET /api/tournament/backing-pools, the NEXT battle Monday's
//     pods with their sealed/revealed pool projection and the viewer's own
//     stakes on them (`myStakes`);
//   · `inPlay` — the viewer's stakes for the CURRENT battle week (owner-read
//     backingStakes) joined to their pools (authed-read backingPools) and pods
//     (authed-read tournamentGroups);
//   · `now`, and the response's `backingWeekCloses` for the between-state line.
//
// THE FOUR STATES, IN PRIORITY ORDER — one strip says one thing:
//   1 `week`    — the viewer has stakes IN PLAY (pool closed, pod not complete):
//                 "Your backing · day N of 5 · how your teams stand".
//   2 `staked`  — the window is open and the viewer has live stakes on it:
//                 "Your backing · N pods · closes <close> · your stakes".
//   3 `open`    — the window is open and the viewer has none:
//                 "Backing open · N pods · closes <close>".
//   4 `between` — the viewer's stakes have settled and no pool is open:
//                 "Last week's result · pools open again Monday".
//   plus the honest empty case, `quiet` — no pods, no stakes: the strip says
//   there is nothing to back yet rather than a "0 pods" window.
//
// THE CLOSE COMES FROM EACH POOL'S `closesAt`, never a hardcoded "Sunday": a
// slot pod's pool closes at its fire instant, days before the Sunday clock
// (spec §4). The window's own close is the LATEST close among the open pools
// (the last door to shut); the pod list shows each pod's own close beside it.
//
// NOTHING ABOUT THE POOL leaves this module while a pool is open: the state
// carries the viewer's own stakes and the capped signals the API already
// caps, and no pot, share, count above three or pays × exists in the inputs
// to leak (the API strips them — backing-pools.js projectPod).

import { POOL_MIN_WINDOW_MS } from '../../../constants/backing';
import { getWeeklyComposite, rankByScores, GROUP_STATUS } from '../../../constants/leagueTournament';
import { baseGroupName, cpuSeatName } from '../leagueAdapter';

export const STRIP_KIND = Object.freeze({
  OPEN: 'open',
  STAKED: 'staked',
  WEEK: 'week',
  BETWEEN: 'between',
  QUIET: 'quiet',
});

/** Pool statuses that mean the stakes have settled or been voided. */
const SETTLED_POOL_STATUSES = new Set(['resolved', 'insufficient', 'refunded']);

const ET = 'America/New_York';

/** ISO weekday index in ET — Mon=1 … Sun=7. */
export function etWeekdayIndex(now = new Date()) {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short' }).format(now);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(label) + 1;
}

/** Which of the five battle days it is (Mon=1 … Fri=5; the weekend reads as 5). */
export function weekDayOfFive(now = new Date()) {
  const idx = etWeekdayIndex(now);
  if (idx < 1) return 1;
  return Math.min(5, idx);
}

/** 'Sun 11:59 PM ET' from an ISO close, or null when unreadable. */
export function formatEtClose(iso) {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const text = new Intl.DateTimeFormat('en-US', {
    timeZone: ET, weekday: 'short', hour: 'numeric', minute: '2-digit',
  }).format(date);
  // "Sun, 11:59 PM" → "Sun 11:59 PM ET"
  return `${text.replace(',', '')} ET`;
}

/** The latest ISO instant in a list, or null. */
function latestIso(list) {
  let best = null;
  for (const iso of list) {
    if (typeof iso !== 'string') continue;
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) continue;
    if (best === null || ms > best.ms) best = { iso, ms };
  }
  return best ? best.iso : null;
}

/** A seat's display name from the pod's own seatNames map, or the CPU's synthesized name. */
export function seatDisplayName(seatNames, odUserId) {
  if (typeof odUserId !== 'string') return '';
  const cpu = cpuSeatName(odUserId);
  if (cpu !== 'CPU') return cpu;
  const named = seatNames && typeof seatNames === 'object' ? seatNames[odUserId] : null;
  return typeof named === 'string' && named.length > 0 ? named : odUserId;
}

/** The pod's rank order and each seat's composite — the tournament's own comparator. */
export function podStanding(group) {
  const players = Array.isArray(group?.players) ? group.players : [];
  const order = players.map((p) => p?.odUserId).filter(Boolean);
  const scores = Object.fromEntries(order.map((id) => [id, getWeeklyComposite(group, id)]));
  const ranking = rankByScores(scores, order);
  return ranking.map((id, i) => ({ odUserId: id, rank: i + 1, score: scores[id] }));
}

/**
 * When the next pool can open, for the between-state line: once fewer than
 * POOL_MIN_WINDOW_MS remain before the backing week's close, no new pool can
 * open this week (spec §4's 24-hour rule), so the next opening is Monday.
 */
export function nextOpening(now, backingWeekCloses) {
  const closesMs = typeof backingWeekCloses === 'string' ? new Date(backingWeekCloses).getTime() : NaN;
  if (!Number.isFinite(closesMs)) return 'onFormation';
  return new Date(now).getTime() >= closesMs - POOL_MIN_WINDOW_MS ? 'monday' : 'onFormation';
}

/**
 * Derive the strip's state.
 *
 * @param {Object} args
 * @param {Array} [args.pods]            the pod-list response's `pods`
 * @param {Object|null} [args.inPlay]    { stakes, poolsById, groupsById } for the current battle week
 * @param {Date} [args.now]
 * @param {string|null} [args.backingWeekCloses]
 */
export function deriveStripState({ pods = [], inPlay = null, now = new Date(), backingWeekCloses = null } = {}) {
  const list = Array.isArray(pods) ? pods : [];
  const openPods = list.filter((p) => p?.pool?.status === 'open');

  // The viewer's LIVE stakes on the upcoming window, by pod.
  const stakedPods = [];
  for (const pod of openPods) {
    const live = (Array.isArray(pod.myStakes) ? pod.myStakes : []).filter((s) => s?.status === 'live');
    if (live.length === 0) continue;
    stakedPods.push({
      groupId: pod.groupId,
      podName: baseGroupName(pod.groupId),
      closesAt: pod.pool?.closesAt ?? null,
      stakes: live.map((s) => ({
        stakeId: s.stakeId,
        teamOdUserId: s.teamOdUserId,
        teamName: seatDisplayName(pod.seatNames, s.teamOdUserId),
        amount: Number.isFinite(s.amount) ? s.amount : 0,
      })),
    });
  }

  // The viewer's stakes on the CURRENT week — in play, or settled.
  const live = [];
  const settled = [];
  const upcomingIds = new Set(list.map((p) => p?.groupId));
  for (const stake of Array.isArray(inPlay?.stakes) ? inPlay.stakes : []) {
    if (!stake || typeof stake.groupId !== 'string') continue;
    const pool = inPlay?.poolsById?.[stake.groupId] ?? null;
    const group = inPlay?.groupsById?.[stake.groupId] ?? null;
    if (pool?.status === 'open' || (pool == null && upcomingIds.has(stake.groupId))) continue; // still the window's — counted above
    const done = SETTLED_POOL_STATUSES.has(pool?.status)
      || group?.status === GROUP_STATUS.COMPLETE
      || (stake.status !== 'live');
    (done ? settled : live).push({ stake, pool, group });
  }

  if (live.length > 0) {
    const byGroup = new Map();
    for (const { stake, group } of live) {
      const entry = byGroup.get(stake.groupId) ?? { groupId: stake.groupId, podName: baseGroupName(stake.groupId), group, teams: [] };
      if (!entry.teams.some((t) => t.teamOdUserId === stake.teamOdUserId)) {
        entry.teams.push({ teamOdUserId: stake.teamOdUserId, amount: 0 });
      }
      entry.teams.find((t) => t.teamOdUserId === stake.teamOdUserId).amount += Number.isFinite(stake.amount) ? stake.amount : 0;
      byGroup.set(stake.groupId, entry);
    }
    const teams = [];
    for (const entry of byGroup.values()) {
      const standing = entry.group ? podStanding(entry.group) : [];
      for (const team of entry.teams) {
        const row = standing.find((s) => s.odUserId === team.teamOdUserId) ?? null;
        teams.push({
          groupId: entry.groupId,
          podName: entry.podName,
          teamOdUserId: team.teamOdUserId,
          teamName: seatDisplayName(entry.group?.seatNames, team.teamOdUserId),
          amount: team.amount,
          rank: row ? row.rank : null,
          score: row ? row.score : null,
          seatCount: standing.length,
        });
      }
    }
    return { kind: STRIP_KIND.WEEK, day: weekDayOfFive(now), pods: byGroup.size, teams };
  }

  if (stakedPods.length > 0) {
    return {
      kind: STRIP_KIND.STAKED,
      pods: stakedPods.length,
      closesAt: latestIso(stakedPods.map((p) => p.closesAt)),
      stakes: stakedPods.flatMap((p) => p.stakes.map((s) => ({ ...s, podName: p.podName, groupId: p.groupId }))),
    };
  }

  if (openPods.length > 0) {
    return {
      kind: STRIP_KIND.OPEN,
      pods: openPods.length,
      closesAt: latestIso(openPods.map((p) => p.pool?.closesAt)),
    };
  }

  if (settled.length > 0) {
    return {
      kind: STRIP_KIND.BETWEEN,
      pods: new Set(settled.map((s) => s.stake.groupId)).size,
      reopens: nextOpening(now, backingWeekCloses),
    };
  }

  return { kind: STRIP_KIND.QUIET };
}
