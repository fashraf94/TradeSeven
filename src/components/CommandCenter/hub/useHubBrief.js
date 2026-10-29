// src/components/CommandCenter/hub/useHubBrief.js
//
// Command Center hub, slice S4 (ruling R-S4-4; spec V1.2 §3, §8.3) — the Daily
// Regime Brief, from the EXISTING hook (hooks/useDailyRegimeBrief.js), which
// owns its read and its one automatic retry. The hub adds no read of its own
// and runs only on the connected hub (CommandCenterHub's ConnectedHub), so the
// frames and the tests that render the hub without App's object read nothing.
//
//   brief.status   'loading'  the read, or its retry, is out
//                  'error'    it failed twice: "Couldn't load the brief · Retry"
//                  'ready'    a body, and a caption of the brief's own record
//                  'missing'  the read answered with no brief, or one more than
//                             five sessions old: "No brief available"
//   caption        the brief's age in trading sessions (DRB stale fix, founder
//                  ruling Oct 29 2026; hub/activityDates.js marketSessionsSince):
//                    0     "Brief for {date}"
//                    1     "Last session's brief · for {date}"
//                    2–5   "Brief for {date} · {n} sessions old", and the body
//                          collapsed behind More (`collapsed: true`)
//                  and "Generated {day} {time ET}" only when the document
//                  returned a `generatedAt`. The time the page fetched the
//                  document is never shown as a publication time, and no
//                  sources count is built (spec §8.3).
//
// `forDate` is a market-day label (YYYY-MM-DD, ET): it is formatted from its own
// parts, never converted through a time zone (hub/activityDates.js formatHubMarketDate).
// The age needs the clock, which the hook hands in as `nowMs`: the pure half reads
// only its arguments. The hook's own `isStale` is no longer read here.

import useDailyRegimeBrief from '../../../hooks/useDailyRegimeBrief';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubMarketDate, formatHubWeekdayTime, marketSessionsSince } from './activityDates';
import { hubMs } from './hubDate';

/** From this many sessions old the body waits behind More; past BRIEF_SHOWN_UP_TO it is not shown at all. */
export const BRIEF_COLLAPSED_FROM = 2;
export const BRIEF_SHOWN_UP_TO = 5;

/** The caption's parts that the document supports, in the spec's words; '' when it supports none. */
export function briefCaption({ forDate, generatedAt }, nowMs) {
  const date = formatHubMarketDate(forDate);
  const age = marketSessionsSince(forDate, nowMs);
  const parts = [];
  if (date) {
    if (age === 1) parts.push(COPY.brief.stale(date));
    else if (age !== null && age >= BRIEF_COLLAPSED_FROM) parts.push(COPY.brief.aged(date, age));
    else parts.push(COPY.brief.forDate(date));
  }
  const time = formatHubWeekdayTime(hubMs(generatedAt));
  if (time) parts.push(COPY.brief.generated(COPY.time.et(time)));
  return parts.join(COPY.sep);
}

/**
 * The brief section (hub/hubModel.js `brief`) from the hook's result and the clock. Pure.
 * @param {object} drb    { dailyBrief, forDate, generatedAt, loading, error }
 * @param {number} nowMs  the clock, ms since the epoch
 */
export function briefSectionOf(drb, nowMs) {
  if (!drb || drb.loading === true) return Object.freeze({ status: 'loading' });
  if (drb.error) return Object.freeze({ status: 'error' });
  const body = typeof drb.dailyBrief === 'string' && drb.dailyBrief.trim() !== '' ? drb.dailyBrief : null;
  if (!body) return Object.freeze({ status: 'missing' });
  const age = marketSessionsSince(drb.forDate, nowMs);
  if (age !== null && age > BRIEF_SHOWN_UP_TO) return Object.freeze({ status: 'missing' });
  const caption = briefCaption(drb, nowMs);
  const collapsed = age !== null && age >= BRIEF_COLLAPSED_FROM;
  return Object.freeze({ status: 'ready', body, ...(caption ? { caption } : {}), ...(collapsed ? { collapsed: true } : {}) });
}

export default function useHubBrief() {
  const drb = useDailyRegimeBrief();
  // Never `drb.refetch` itself: a click event would arrive as its `isRetry` argument and skip the hook's own retry.
  return { brief: briefSectionOf(drb, Date.now()), retry: () => drb.refetch() };
}
