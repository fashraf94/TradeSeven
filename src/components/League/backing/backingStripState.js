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
//
// EVERY TEAM NAME IS THE SERVER'S (Amendment C §C1, D-af): a listed pod's
// stakes carry their team's `teamLabel` (backing-pools.js), and the in-play
// pods' names arrive as `inPlay.labelsById` (GET /api/backing/team-labels,
// through useMyBacking). This module never composes a name from an id — an
// entry that arrives without a label reads UNNAMED_TEAM_LABEL, never the id
// the pre-flip `seatDisplayName` fell back to.

import { POOL_MIN_WINDOW_MS, TEAM_NAME_PENDING, UNNAMED_TEAM_LABEL } from '../../../constants/backing';
import { currentBaseLayerWeek, deriveCurrentTradingDay, etDateString, getWeeklyComposite, rankByScores, GROUP_STATUS } from '../../../constants/leagueTournament';
import { baseGroupName } from '../leagueAdapter';

export const STRIP_KIND = Object.freeze({
  OPEN: 'open',
  STAKED: 'staked',
  WEEK: 'week',
  BETWEEN: 'between',
  QUIET: 'quiet',
});

/**
 * Is the backing window open, as far as a strip state can say? The window
 * state itself, or the viewer's staked window with a pool still open (its
 * latest close is set). A staked window whose every pool already closed at
 * its fire is not — nothing is left to back there. Read by the desktop strip
 * for its "Back a team" action; derives nothing new from the pool.
 */
export function stripWindowOpen(state) {
  const kind = state?.kind;
  return kind === STRIP_KIND.OPEN || (kind === STRIP_KIND.STAKED && typeof state?.closesAt === 'string' && state.closesAt.length > 0);
}

/** Pool statuses that mean the stakes have settled or been voided. */
const SETTLED_POOL_STATUSES = new Set(['resolved', 'insufficient', 'refunded']);

const ET = 'America/New_York';

/**
 * The week keys the viewer's backing can live under right now: last week (a
 * holiday-short week banks its day 5 on the following Monday, and its result
 * is read after that — R-A-1), this week, and the window's week (the pod
 * list's, when known). The stake's own key is its battle Monday's label.
 */
export function backingWeekKeys(now = new Date(), upcomingWeek = null) {
  const week = (d) => currentBaseLayerWeek(d);
  return [...new Set([week(new Date(now.getTime() - 7 * 86400000)), week(now), upcomingWeek].filter((k) => typeof k === 'string' && k.length > 0))];
}

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

/**
 * The server's label for a team (D-af — Amendment C §C1): `entry` is a label
 * string or a `{ label }` the server sent. Anything else — a missing entry, a
 * blank label — reads the neutral UNNAMED_TEAM_LABEL. There is no id argument
 * on purpose: nothing here can turn an account id into a name.
 */
export function teamLabelOf(entry) {
  const label = typeof entry === 'string' ? entry : entry?.label;
  return typeof label === 'string' && label.trim().length > 0 ? label : UNNAMED_TEAM_LABEL;
}

/** A pod the map does not carry YET: its names are on their way (useMyBacking — WIRING-5). */
const namesPending = (labelsById, groupId) => labelsById != null && typeof labelsById === 'object' && labelsById[groupId] === undefined;
const nameOrNull = (v) => (typeof v === 'string' && v.trim().length > 0 ? v : null);

/**
 * The server's `{ label, secondary }` for one seat of one pod, from a
 * `labelsById` map: the pending placeholder while the pod's names are on their
 * way, the neutral name for a team the pod's names do not carry.
 */
export function podTeamLabel(labelsById, groupId, odUserId) {
  if (namesPending(labelsById, groupId)) return { label: TEAM_NAME_PENDING, secondary: null };
  const entry = labelsById?.[groupId]?.[odUserId] ?? null;
  return { label: teamLabelOf(entry), secondary: nameOrNull(entry?.secondary) };
}

/**
 * The server's two layers for one seat of one pod, named apart (RAWID-R-2) —
 * a surface that names the player and the agent separately reads these,
 * never the single label (a label with no secondary may be either layer):
 *   · `player` — the player's name; the pending placeholder while the pod's
 *     names are on their way; else the neutral name;
 *   · `agent` — the agent's (server-belted) name; the pending placeholder
 *     while on their way; else null, for the surface's own "{player}'s agent".
 * An entry without the two fields (an older reply) yields them only where they
 * are certain: a label WITH a secondary is the agent's, the secondary the
 * player's.
 */
export function podTeamLayers(labelsById, groupId, odUserId) {
  const pending = namesPending(labelsById, groupId);
  const entry = labelsById?.[groupId]?.[odUserId] ?? null;
  const secondary = nameOrNull(entry?.secondary);
  const player = nameOrNull(entry?.player) ?? secondary;
  const agent = nameOrNull(entry?.agent) ?? (secondary != null ? nameOrNull(entry?.label) : null);
  return {
    player: player ?? (pending ? TEAM_NAME_PENDING : UNNAMED_TEAM_LABEL),
    agent: agent ?? (pending ? TEAM_NAME_PENDING : null),
  };
}

/**
 * The pod's battle day, 1…5, from its BANKING RECORD — the League's own
 * reading (deriveCurrentTradingDay: the latest banked close's day if it banked
 * today, else the next), so a holiday-short week counts its own days and the
 * header agrees with the rail (FAB-9 / R-A-1, the PR 4 review record). 5 once
 * the pod is complete; null without a pod document.
 */
export function podDayOfFive(group, now = new Date()) {
  if (!group) return null;
  if (group.status === GROUP_STATUS.COMPLETE) return 5;
  return Math.min(5, Math.max(1, deriveCurrentTradingDay(group, etDateString(now))));
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
 * @param {Object|null} [args.inPlay]    { stakes, poolsById, groupsById, labelsById } — the viewer's stakes for last week, this week and the window's week, and the server's names for their pods' teams
 * @param {Date} [args.now]
 * @param {string|null} [args.backingWeekCloses]
 */
export function deriveStripState({ pods = [], inPlay = null, now = new Date(), backingWeekCloses = null } = {}) {
  const list = Array.isArray(pods) ? pods : [];
  const openPods = list.filter((p) => p?.pool?.status === 'open');
  const listedIds = new Set(list.map((p) => p?.groupId).filter(Boolean));

  // Every stake of the viewer's lands in exactly one of these, from its POOL's
  // status, its own status and its pod's status — never from the calendar:
  //   window  — live, on a pool OPEN or CLOSED at its fire, the pod not yet in battle (DOM-1)
  //   live    — live, pool closed, pod in battle (or complete with the pool unresolved: settling — FAB-1)
  //   settled — the pool resolved / insufficient / refunded, or the stake itself no longer live (R-A-4)
  const window = new Map();
  const live = [];
  const settled = [];
  const classify = ({ stake, pool, group, groupStatus, listed }) => {
    if (!stake || typeof stake.groupId !== 'string') return;
    const status = pool?.status ?? null;
    if (SETTLED_POOL_STATUSES.has(status) || stake.status !== 'live') { settled.push({ stake, pool, group }); return; }
    // No pool document (not delivered, or not readable): the stake's state is
    // UNKNOWN and the strip does not guess a week or a result from it (SEAL-1).
    if (pool == null) return;
    const podStatus = groupStatus ?? group?.status ?? null;
    if (status !== 'open') {
      if (status !== 'closed' && status !== 'resolving') return; // a status this module does not know: not guessed
      if (podStatus == null && !listed) return; // closed, and the pod's state is not known yet: not guessed
      if (podStatus === GROUP_STATUS.BATTLE || podStatus === GROUP_STATUS.COMPLETE) {
        live.push({ stake, pool, group, settling: podStatus === GROUP_STATUS.COMPLETE });
        return;
      }
    }
    // Open, or closed on a pod that has not started: the window's (a slot
    // pod's pool shuts days before its Monday; the stake is committed, not in play).
    const entry = window.get(stake.groupId) ?? {
      groupId: stake.groupId, closesAt: status === 'open' ? pool.closesAt ?? null : null, closed: status !== 'open', stakes: [],
    };
    entry.stakes.push(stake);
    window.set(stake.groupId, entry);
  };

  // The listed pods carry the viewer's stakes on them (the endpoint's own
  // projection) and the pod's status; the joined group doc, when read, adds
  // the standing.
  for (const pod of list) {
    for (const stake of Array.isArray(pod?.myStakes) ? pod.myStakes : []) {
      classify({ stake: { ...stake, groupId: pod.groupId }, pool: pod.pool ?? null, group: inPlay?.groupsById?.[pod.groupId] ?? null, groupStatus: pod.groupStatus ?? null, listed: true });
    }
  }
  // The pods the list does not carry: last week's and this week's, from the
  // viewer's own stake subscription joined to each pool and pod document.
  for (const stake of Array.isArray(inPlay?.stakes) ? inPlay.stakes : []) {
    if (!stake || typeof stake.groupId !== 'string' || listedIds.has(stake.groupId)) continue;
    const group = inPlay?.groupsById?.[stake.groupId] ?? null;
    classify({ stake, pool: inPlay?.poolsById?.[stake.groupId] ?? null, group, groupStatus: null, listed: false });
  }

  if (live.length > 0) {
    const byGroup = new Map();
    for (const { stake, group, settling } of live) {
      const entry = byGroup.get(stake.groupId) ?? { groupId: stake.groupId, podName: baseGroupName(stake.groupId), group, settling, teams: [] };
      if (!entry.teams.some((t) => t.teamOdUserId === stake.teamOdUserId)) {
        // The server's name for the team: the listed pod's stake carries its
        // own `teamLabel`; an in-play pod's comes from `labelsById`.
        const teamName = stake.teamLabel != null ? teamLabelOf(stake.teamLabel) : podTeamLabel(inPlay?.labelsById, stake.groupId, stake.teamOdUserId).label;
        entry.teams.push({ teamOdUserId: stake.teamOdUserId, teamName, amount: 0 });
      }
      entry.teams.find((t) => t.teamOdUserId === stake.teamOdUserId).amount += Number.isFinite(stake.amount) ? stake.amount : 0;
      byGroup.set(stake.groupId, entry);
    }
    const teams = [];
    let day = null;
    for (const entry of byGroup.values()) {
      // A rank exists once a close has banked; before that, no seat has a
      // standing and the rail shows none (never seat order as a rank).
      const standing = bankedCloses(entry.group) > 0 ? podStanding(entry.group) : [];
      const podDay = podDayOfFive(entry.group, now);
      if (podDay != null) day = Math.max(day ?? 0, podDay);
      for (const team of entry.teams) {
        const row = standing.find((s) => s.odUserId === team.teamOdUserId) ?? null;
        teams.push({
          groupId: entry.groupId,
          podName: entry.podName,
          teamOdUserId: team.teamOdUserId,
          teamName: team.teamName,
          amount: team.amount,
          rank: row ? row.rank : null,
          score: row ? row.score : null,
          seatCount: standing.length,
        });
      }
    }
    // The week is complete but a pool has not settled: the stakes are in
    // play until the pool says otherwise. The day is the pods' own banking
    // record; the calendar weekday only while no pod document has been read.
    const settling = [...byGroup.values()].every((e) => e.settling);
    return { kind: STRIP_KIND.WEEK, day: day ?? weekDayOfFive(now), settling, pods: byGroup.size, teams };
  }

  if (window.size > 0) {
    const stakedPods = [...window.values()].map((p) => ({
      groupId: p.groupId,
      podName: baseGroupName(p.groupId),
      closesAt: p.closesAt,
      closed: p.closed,
      stakes: p.stakes.map((s) => ({
        stakeId: s.stakeId ?? s.id ?? null,
        teamOdUserId: s.teamOdUserId,
        teamName: s.teamLabel != null ? teamLabelOf(s.teamLabel) : podTeamLabel(inPlay?.labelsById, p.groupId, s.teamOdUserId).label,
        amount: Number.isFinite(s.amount) ? s.amount : 0,
      })),
    }));
    return {
      kind: STRIP_KIND.STAKED,
      pods: stakedPods.length,
      // The window's close is the latest close among the OPEN pools; with every
      // staked pool already closed there is none to show.
      closesAt: latestIso(stakedPods.filter((p) => !p.closed).map((p) => p.closesAt)),
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
