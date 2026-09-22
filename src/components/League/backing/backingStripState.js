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

/** How many closes the pod has banked — the day1…day5 close entries present. */
export function bankedCloses(group) {
  let n = 0;
  for (let d = 1; d <= 5; d += 1) if (group?.dailyScores?.[`day${d}`]) n += 1;
  return n;
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
 * @param {Array} [args.pods]            the pod-list response's `pods` (the next Monday's pods, with the viewer's own stakes)
 * @param {Object|null} [args.inPlay]    { stakes, poolsById, groupsById } — the viewer's stakes for the current and the upcoming week
 * @param {Date} [args.now]
 * @param {string|null} [args.backingWeekCloses]
 */
export function deriveStripState({ pods = [], inPlay = null, now = new Date(), backingWeekCloses = null } = {}) {
  const list = Array.isArray(pods) ? pods : [];
  const openPods = list.filter((p) => p?.pool?.status === 'open');
  const listedIds = new Set(list.map((p) => p?.groupId).filter(Boolean));

  // The viewer's LIVE stakes on the upcoming window, by pod: on pools still
  // OPEN, and on pools already CLOSED at their fire — a slot pod's pool shuts
  // days before its Monday and the stake is committed, not yet in play
  // (DOM-1, the PR 4 review record). A closed pod carries no close to show.
  const stakedPods = [];
  const pushStaked = ({ groupId, seatNames, closesAt, closed, stakes }) => {
    const live = stakes.filter((s) => s?.status === 'live');
    if (live.length === 0) return;
    stakedPods.push({
      groupId,
      podName: baseGroupName(groupId),
      closesAt,
      closed,
      stakes: live.map((s) => ({
        stakeId: s.stakeId ?? s.id ?? null,
        teamOdUserId: s.teamOdUserId,
        teamName: seatDisplayName(seatNames, s.teamOdUserId),
        amount: Number.isFinite(s.amount) ? s.amount : 0,
      })),
    });
  };
  for (const pod of list) {
    const status = pod?.pool?.status;
    if (status !== 'open' && status !== 'closed') continue;
    pushStaked({
      groupId: pod.groupId,
      seatNames: pod.seatNames,
      closesAt: status === 'open' ? pod.pool?.closesAt ?? null : null,
      closed: status === 'closed',
      stakes: Array.isArray(pod.myStakes) ? pod.myStakes : [],
    });
  }

  // The viewer's stakes on pods the list does not carry — the current battle
  // week's pods, in play or settled, and any committed pod the list has
  // dropped. Each is classified from its POOL document and its pod's status.
  const live = [];
  const settled = [];
  const pending = new Map();
  for (const stake of Array.isArray(inPlay?.stakes) ? inPlay.stakes : []) {
    if (!stake || typeof stake.groupId !== 'string') continue;
    if (listedIds.has(stake.groupId)) continue; // the list carries this pod's stakes (above)
    const pool = inPlay?.poolsById?.[stake.groupId] ?? null;
    const group = inPlay?.groupsById?.[stake.groupId] ?? null;
    // No pool document yet (not delivered, or not readable): the stake's state
    // is UNKNOWN, and the strip does not guess a week in play or a result from
    // it — it says what the known pools say (SEAL-1, the PR 4 review record).
    if (pool == null) continue;
    // Settled is a fact of the POOL (or of the stake itself) — never inferred
    // from the pod being complete: a pool can sit unresolved after the week
    // ends (a hold, a settlement error), and its stakes are not settled (FAB-1).
    if (SETTLED_POOL_STATUSES.has(pool.status) || stake.status !== 'live') { settled.push({ stake, pool, group }); continue; }
    if (pool.status !== 'open') {
      if (group == null) continue; // closed, and the pod's state is not known yet: not guessed
      const inBattle = group.status === GROUP_STATUS.BATTLE || group.status === GROUP_STATUS.COMPLETE;
      if (inBattle) { live.push({ stake, pool, group, settling: group.status === GROUP_STATUS.COMPLETE }); continue; }
    }
    // Open, or closed on a pod that has not started: the window's.
    const entry = pending.get(stake.groupId) ?? {
      groupId: stake.groupId, seatNames: group?.seatNames, closesAt: pool.status === 'open' ? pool.closesAt ?? null : null, closed: pool.status !== 'open', stakes: [],
    };
    entry.stakes.push(stake);
    pending.set(stake.groupId, entry);
  }
  for (const entry of pending.values()) pushStaked(entry);

  if (live.length > 0) {
    const byGroup = new Map();
    for (const { stake, group, settling } of live) {
      const entry = byGroup.get(stake.groupId) ?? { groupId: stake.groupId, podName: baseGroupName(stake.groupId), group, settling, teams: [] };
      if (!entry.teams.some((t) => t.teamOdUserId === stake.teamOdUserId)) {
        entry.teams.push({ teamOdUserId: stake.teamOdUserId, amount: 0 });
      }
      entry.teams.find((t) => t.teamOdUserId === stake.teamOdUserId).amount += Number.isFinite(stake.amount) ? stake.amount : 0;
      byGroup.set(stake.groupId, entry);
    }
    const teams = [];
    for (const entry of byGroup.values()) {
      // A rank exists once a close has banked; before that, no seat has a
      // standing and the rail shows none (never seat order as a rank).
      const standing = bankedCloses(entry.group) > 0 ? podStanding(entry.group) : [];
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
    // The week is complete but a pool has not settled: the stakes are in
    // play until the pool says otherwise.
    const settling = [...byGroup.values()].every((e) => e.settling);
    return { kind: STRIP_KIND.WEEK, day: weekDayOfFive(now), settling, pods: byGroup.size, teams };
  }

  if (stakedPods.length > 0) {
    const openCloses = stakedPods.filter((p) => !p.closed).map((p) => p.closesAt);
    return {
      kind: STRIP_KIND.STAKED,
      pods: stakedPods.length,
      // The window's close is the latest close among the OPEN pools; with every
      // staked pool already closed there is none to show.
      closesAt: latestIso(openCloses),
      stakes: stakedPods.flatMap((p) => p.stakes.map((s) => ({ ...s, podName: p.podName, groupId: p.groupId, closed: p.closed }))),
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
