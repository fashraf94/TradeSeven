// api/_utils/intraday/seed.js
//
// Intraday Data — Build 1, contract §6.6: aggregate a prior session's 1-minute
// bars into completed 5-minute buckets (`seeded: true`) and pick the longest
// contiguous run ENDING at that session's last bucket, capped at 60. PURE.
//
// A 1-minute bar's `timestamp` (seconds, bar START) is treated as the
// priceAsOf of its close, so the same §6.1 rule the poller applies decides
// which bucket it lands in — INCLUDING the policy. Under
// `continuous_session` (§15 item 2) the vendor's 16:00 row
// (start === sessionCloseMs) is outside the session and is ignored, counted
// in `barsIgnored`: it carries the closing auction, which on the founder's
// AAPL fixture is 19,122,063 shares — 42.9 % of the day — at a price the
// continuous session never printed. Under a null policy it still lands in
// the last bucket, which is where build 1 stood.

import { sessionKeys, BUCKET_MS, bucketKeyFor } from './buckets.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Bar timestamp → ms (seconds or ms accepted; `datetime` 'YYYY-MM-DD HH:mm:ss' UTC as fallback). */
export function barTimeMs(bar) {
  if (!bar) return null;
  if (isNum(bar.timestamp)) return bar.timestamp < 1e11 ? bar.timestamp * 1000 : bar.timestamp;
  if (typeof bar.datetime === 'string') {
    const m = bar.datetime.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }
  return null;
}

/**
 * @param {Array<{timestamp?: number, datetime?: string, close: number, volume?: number}>} bars
 * @param {object} session the calendar session the bars belong to
 * @param {{closingRowPolicy?: any}} opts
 * @returns {{ buckets: Bucket[], barsUsed: number, barsIgnored: number }}
 */
export function aggregateBarsToBuckets(bars, session, { closingRowPolicy = null } = {}) {
  const { firstKey, lastKey } = sessionKeys(session);
  const map = new Map();
  let used = 0; let ignored = 0;
  for (const bar of Array.isArray(bars) ? bars : []) {
    const t = barTimeMs(bar);
    const close = isNum(bar?.close) ? bar.close : null;
    const k = t === null ? null : bucketKeyFor(t, session, { closingRowPolicy });
    if (k === null || close === null) { ignored += 1; continue; }
    used += 1;
    const cur = map.get(k) || {
      key: k, startMs: k * BUCKET_MS, endMs: k * BUCKET_MS + BUCKET_MS, sessionEtDate: session.etDate,
      isFirst: k === firstKey, isLast: k === lastKey,
      close: null, sampleCount: 0, maxPriceAsOf: null, closeLagMs: null,
      status: 'completed', reason: 'seed', seeded: true, closeQualified: k === lastKey ? closingRowPolicy !== null : true,
    };
    cur.sampleCount += 1;
    if (cur.maxPriceAsOf === null || t > cur.maxPriceAsOf) { cur.maxPriceAsOf = t; cur.close = close; }
    map.set(k, cur);
  }
  const buckets = [...map.values()].sort((a, b) => a.key - b.key).map((b) => ({ ...b, closeLagMs: b.endMs - b.maxPriceAsOf }));
  return { buckets, barsUsed: used, barsIgnored: ignored };
}

/**
 * The longest contiguous run of buckets ending at the session's last key,
 * capped at `max`. Empty when the last bucket is missing (the seed could not
 * connect to today's first bucket anyway).
 */
export function contiguousTail(buckets, session, max = 60) {
  const { lastKey } = sessionKeys(session);
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const out = [];
  let k = lastKey;
  while (byKey.has(k) && out.length < max) { out.unshift(byKey.get(k)); k -= 1; }
  return out;
}

/**
 * Combine up to two sessions' tails (older first) into one contiguous seed:
 * the older session contributes only if its tail reaches its own last bucket
 * AND the newer session's tail reaches its first bucket (session-relative
 * adjacency). Capped at `max` from the newest end.
 */
export function combineSeedSessions(tailsOldestFirst, sessionsOldestFirst, max = 60) {
  if (!tailsOldestFirst.length) return [];
  let out = [];
  for (let i = tailsOldestFirst.length - 1; i >= 0; i--) {
    const tail = tailsOldestFirst[i];
    const session = sessionsOldestFirst[i];
    if (!tail.length) break;
    if (i < tailsOldestFirst.length - 1) {
      const newerFirst = out[0];
      const { firstKey: newerFirstKey } = sessionKeys(sessionsOldestFirst[i + 1]);
      if (!newerFirst || newerFirst.key !== newerFirstKey) break;
      const { lastKey } = sessionKeys(session);
      if (tail[tail.length - 1].key !== lastKey) break;
    }
    out = [...tail, ...out];
  }
  return out.slice(-max);
}
