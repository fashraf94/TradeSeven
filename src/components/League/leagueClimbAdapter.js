// src/components/League/leagueClimbAdapter.js
//
// League Battle View V2 — the dailyScores → scores[] CLIMB-SERIES assembler
// (Phase 1, pure + node-clean: imports only the zero-import schema module, so
// its co-located test's real import IS the dependency-surface guard).
//
// This is the real-data side of the seam leagueClimbFixtures.js promises
// (CLB_SERIES, header lines 11-16): a per-seat `number[]` of the CUMULATIVE
// standing at each daily close, plotted positionally by LeagueClimbChart.
//
// It is a SIBLING of leagueAdapter.js, not an extension: leagueAdapter's whole
// scoring posture is final-snapshot-only (every seat score = getWeeklyComposite,
// the FINAL day). This module's job is the opposite — walk EVERY dayN. Folding a
// multi-day walker into a final-snapshot module would muddy a clean invariant
// and bloat its guarded test, so the climb series gets its own home + guard.
//
// THE LOAD-BEARING INVARIANT (BUILD_RULES §4 / the getWeeklyScore precedent):
// totalPoints/compositePoints are the CUMULATIVE standing AT each close — the
// series is each day's stored snapshot COPIED into place, NEVER re-summed across
// days. `series[n] = series[n-1] + delta` is the documented bug; we never do it.

import {
  computeComposite,
  getLatestDayEntry,
  GROUP_STATUS,
  WEEK_DAYS_REQUIRED,
} from '../../constants/leagueTournament';

/** Ascending [dayNumber, entry] pairs from a group's dailyScores (gaps allowed). */
function ascendingDayEntries(group) {
  const ds = group?.dailyScores || {};
  const out = [];
  for (const key of Object.keys(ds)) {
    const m = /^day(\d+)$/.exec(key);
    if (m) out.push([Number(m[1]), ds[key]]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out;
}

/** The canonical seat ids: the group's players, else the union of scored ids. */
function seatIds(group, dayEntries) {
  const fromPlayers = (group?.players || []).map((p) => p?.odUserId).filter(Boolean);
  if (fromPlayers.length) return fromPlayers;
  const set = new Set();
  for (const [, entry] of dayEntries) {
    for (const id of Object.keys(entry?.closeScores || {})) set.add(id);
  }
  return [...set];
}

/**
 * Per-day CUMULATIVE series for every seat in a group, keyed by odUserId.
 *
 * @param {Object} group - a tournamentGroups doc (with dailyScores)
 * @param {{ metric?: 'composite'|'user' }} [opts]
 *   - 'composite' (default): each day's compositePoints, degrading to
 *     computeComposite(agentPoints, totalPoints) for pre-P6 snapshots — exactly
 *     as getWeeklyComposite does.
 *   - 'user': each day's user-layer totalPoints.
 * @returns {Object<string, number[]>} { [odUserId]: number[] } — one element per
 *   banked day, in day order. A seat with no snapshot on a given day CARRIES
 *   FORWARD its prior value (no phantom drop to 0); a seat never scored yet
 *   reads the start line (0).
 */
export function buildClimbSeries(group, { metric = 'composite' } = {}) {
  const dayEntries = ascendingDayEntries(group);
  const ids = seatIds(group, dayEntries);
  const out = {};
  for (const id of ids) {
    const series = [];
    let prev = 0;
    for (const [, entry] of dayEntries) {
      const cs = entry?.closeScores?.[id];
      let val;
      if (cs) {
        if (metric === 'user') {
          val = Number.isFinite(cs.totalPoints) ? cs.totalPoints : prev;
        } else if (Number.isFinite(cs.compositePoints)) {
          val = cs.compositePoints; // already the cumulative-at-close snapshot (0 is valid, not missing)
        } else if (Number.isFinite(cs.agentPoints) || Number.isFinite(cs.totalPoints)) {
          // degrade EXACTLY as getWeeklyComposite: never guess, derive.
          val = computeComposite(cs.agentPoints ?? 0, cs.totalPoints ?? 0);
        } else {
          val = prev; // a present-but-empty snapshot is not a zero — carry forward
        }
      } else {
        val = prev; // carry forward — a missing day is not a zero
      }
      series.push(val);
      prev = val;
    }
    out[id] = series;
  }
  return out;
}

/**
 * The climb's lifecycle phase, for the chart's awaiting/live/complete render:
 *   - 'awaiting' — no banked day yet (the start line).
 *   - 'complete' — the group is COMPLETE, or the full week is banked
 *     (≥ WEEK_DAYS_REQUIRED) — keying on status too so a holiday-short week that
 *     never reaches day 5 still completes.
 *   - 'live'     — mid-week (at least one close, not yet complete).
 *
 * @param {Object} group
 * @returns {'awaiting'|'live'|'complete'}
 */
export function climbSeriesPhase(group) {
  const dayN = getLatestDayEntry(group)?.dayN || 0;
  if (dayN <= 0) return 'awaiting';
  if (group?.status === GROUP_STATUS.COMPLETE || dayN >= WEEK_DAYS_REQUIRED) return 'complete';
  return 'live';
}
