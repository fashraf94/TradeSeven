// api/_utils/setupEvidence/acquire.js
//
// ID-1 Build 1 — ONE ACQUISITION (shape note V1.4 §3): the provider's daily bars
// for a completed session, through the adapter and the evaluator, and the
// snapshot they make. Nothing here touches the store.
//
// ORDER. The request is newest first (`order: 'd'`, as slice 1's replay asked):
// mapDailyRows preserves the payload's order and the adapter expects the newest
// session first. Nothing re-sorts a payload, so malformed or duplicate dates stay
// visible to the adapter's own checks.
//
// REACH. 130 calendar days back, so a short history is a property of the symbol
// and not of the request.
//
// STAMPS. `fetchedAt` and `capturedAt` are the instant the response was received,
// never a time taken before the request, which is why the clock is a function: it
// is read again after the fetch resolves. The bars class follows the same instant:
// `contemporaneous` while `session` was still the latest completed session (before
// the close of the next session), otherwise `later_reconstruction`, and so when the
// calendar cannot say.
//
// The adjusted close comes from the raw payload (attachAdjustedClose), so the split
// check runs. mapDailyRows' drop count has no place in the record; it goes to the
// log, as fetchDailyOHLCV's does, and a dropped row reads `missing_bar` here anyway.

import { mapDailyRows } from '../marketDataCache.js';
import { fetchDailyPayload } from '../eodhdDailyWindow.js';
import { attachAdjustedClose, buildDailyEvidence } from '../setupEvaluator/dailyBarsAdapter.js';
import { evaluateTfEntry } from '../setupEvaluator/tfSetupV1.js';
import { MIN_COMPLETED_BARS } from '../setupEvaluator/thresholds.js';
import { ACQUISITION_FAILURES } from './classify.js';
import { lastCompletedSessionAt } from './sessionAt.js';

export const EVIDENCE_SOURCE = 'eodhd_eod';
/** The bound on one provider read, the body included. */
export const ACQUIRE_TIMEOUT_MS = 5_000;
export const REQUEST_LOOKBACK_CALENDAR_DAYS = 130;
const DAY_MS = 86_400_000;
const SOURCE_META_KEYS = Object.freeze(['fetchedAt', 'from', 'to']);

/** The injected clock, read now: a valid Date, or a TypeError. */
export function readClock(now) {
  const date = typeof now === 'function' ? now() : null;
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('setupEvidence: `now` must be a function returning a valid Date');
  return date;
}

/** The request's date range for a session. Pure. */
export function requestWindowOf(session) {
  const from = new Date(Date.parse(`${session}T12:00:00Z`) - REQUEST_LOOKBACK_CALENDAR_DAYS * DAY_MS).toISOString().slice(0, 10);
  return { from, to: session };
}

/** What the bars are to the session, from the instant the response was received. Pure. */
export function barsClassOf(session, receivedAtMs) {
  const latest = lastCompletedSessionAt(receivedAtMs);
  return latest.ok && latest.session === session ? 'contemporaneous' : 'later_reconstruction';
}

/** The contract's scalar allowlist: exactly its three keys, a value that is not a string reading null. Pure. */
export function sourceMetaOf(input) {
  const meta = {};
  for (const key of SOURCE_META_KEYS) {
    const value = input !== null && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, key) ? input[key] : null;
    meta[key] = typeof value === 'string' ? value : null;
  }
  return meta;
}

/**
 * One provider read and its evaluation. Never throws for the provider: a failed
 * fetch or a non-array body comes back as `failure`.
 *
 * @returns {Promise<{ failure: string, requestStartedAtMs: number }
 *   | { evidence: object, entry: object, fetchedAt: string, receivedAtMs: number, requestStartedAtMs: number }>}
 */
export async function acquireOnce({ session, symbol, now, fetchPayload = fetchDailyPayload }) {
  const { from, to } = requestWindowOf(session);
  const requestStartedAtMs = readClock(now).getTime();
  let payload;
  try {
    payload = await fetchPayload(symbol, { from, to, order: 'd', timeoutMs: ACQUIRE_TIMEOUT_MS });
  } catch {
    return { failure: ACQUISITION_FAILURES.FETCH_FAILED, requestStartedAtMs };
  }
  const received = readClock(now);
  if (!Array.isArray(payload)) return { failure: ACQUISITION_FAILURES.NON_ARRAY_PAYLOAD, requestStartedAtMs };

  const { rows, dropped } = mapDailyRows(payload);
  if (dropped > 0) console.warn(`[setupEvidence] ${symbol} ${session}: mapDailyRows dropped ${dropped} row(s) of ${payload.length}`);
  const fetchedAt = received.toISOString();
  const evidence = buildDailyEvidence({
    rows: attachAdjustedClose(rows, payload),
    asOf: session,
    now: received,
    minBars: MIN_COMPLETED_BARS,
    source: EVIDENCE_SOURCE,
    sourceMeta: sourceMetaOf({ fetchedAt, from, to }),
    barsClass: barsClassOf(session, received.getTime()),
    symbol,
  });
  return { evidence, entry: evaluateTfEntry(evidence), fetchedAt, receivedAtMs: received.getTime(), requestStartedAtMs };
}

/** The snapshot document (contract §3, "Content"). `commit` is the deployment's own, null where the platform does not expose it. */
export function snapshotDocOf({ session, symbol, ruleSet, acquired, host }) {
  const { evidence, entry, fetchedAt } = acquired;
  return {
    key: { session, symbol, ruleSet: { ...ruleSet } },
    status: evidence.ok ? 'ok' : 'refused',
    evidence,
    entry,
    asOf: entry.asOf,
    requestedAsOf: entry.requestedAsOf,
    refusal: entry.refusal ?? null,
    source: EVIDENCE_SOURCE,
    sourceMeta: evidence.sourceMeta,
    evidenceClass: { bars: evidence.evidenceClass.bars },
    capturedAt: fetchedAt,
    writer: { host: host ?? null, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
  };
}
