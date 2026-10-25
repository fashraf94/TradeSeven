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
//                  'missing'  the read answered with no brief: "No brief available"
//   caption        "Brief for {date}" from the recorded `forDate`, or, when the
//                  brief is the last session's, "Last session's brief · for
//                  {date}"; and "Generated {time ET}" only when the document
//                  returned a `generatedAt`. The time the page fetched the
//                  document is never shown as a publication time, and no
//                  sources count is built (spec §8.3).
//
// `forDate` is a market-day label (YYYY-MM-DD, ET): it is formatted from its own
// parts, never converted through a time zone (hub/hubDate.js formatHubMarketDate).

import useDailyRegimeBrief from '../../../hooks/useDailyRegimeBrief';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubMarketDate } from './activityDates';
import { formatHubTime, hubMs } from './hubDate';

/** The caption's parts that the document supports, in the spec's words; '' when it supports none. */
export function briefCaption({ forDate, generatedAt, isStale }) {
  const date = formatHubMarketDate(forDate);
  const parts = [];
  if (date) parts.push(isStale === true ? COPY.brief.stale(date) : COPY.brief.forDate(date));
  const time = formatHubTime(hubMs(generatedAt));
  if (time) parts.push(COPY.brief.generated(COPY.time.et(time)));
  return parts.join(COPY.sep);
}

/**
 * The brief section (hub/hubModel.js `brief`) from the hook's result. Pure.
 * @param {object} drb  { dailyBrief, forDate, generatedAt, isStale, loading, error }
 */
export function briefSectionOf(drb) {
  if (!drb || drb.loading === true) return Object.freeze({ status: 'loading' });
  if (drb.error) return Object.freeze({ status: 'error' });
  const body = typeof drb.dailyBrief === 'string' && drb.dailyBrief.trim() !== '' ? drb.dailyBrief : null;
  if (!body) return Object.freeze({ status: 'missing' });
  const caption = briefCaption(drb);
  return Object.freeze({ status: 'ready', body, ...(caption ? { caption } : {}) });
}

export default function useHubBrief() {
  const drb = useDailyRegimeBrief();
  // Never `drb.refetch` itself: a click event would arrive as its `isRetry` argument and skip the hook's own retry.
  return { brief: briefSectionOf(drb), retry: () => drb.refetch() };
}
