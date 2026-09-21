// api/_utils/intraday/buckets.js
//
// Intraday Data — Build 1, contract §6: 5-minute buckets and recursive state
// for the actionable set. PURE, no Date.now() (deadline processing takes
// `nowMs`). Every function returns NEW ring/state objects.
//
// Ring (persisted as ringJson, §7.1): { buckets: Bucket[] } oldest-first,
// trimmed to the last SEED_MAX_BUCKETS closed buckets plus any open one.
// Bucket: { key, startMs, endMs, sessionEtDate, isFirst, isLast, close,
//           sampleCount, maxPriceAsOf, closeLagMs, status: 'open'|'completed'|
//           'incomplete', reason, seeded, closeQualified }
// State (persisted as stateJson): { sma20, macd, rsi, segmentLen,
//           segmentCloses[], qualifiedRun, lastCompleted: {key, sessionEtDate,
//           isLast} | null, completedBars, gaps }
//
// §6.1 keys: k = floor(priceAsOf / 300_000). §6.2 completion: normal (an
// observation with key > k, or for the last bucket one with priceAsOf ≥
// sessionCloseMs — which establishes passage and is NEVER written, §5.5
// post-close) or deadline
// (close + 30 min → status 'incomplete', reason 'deadline'; state does not
// advance across it). §6.3 completed buckets are immutable (late updates
// rejected and counted). §6.4 a missing bucket breaks the contiguous segment
// and every indicator re-warms independently. §6.7 closeQualified: the last
// bucket of a session is unqualified until CLOSING_ROW_POLICY is set; SMA20
// clears by window exit, MACD/RSI only by reinitialisation from a fully
// qualified segment (recursive state retains the influence).

import { stepSma, stepMacd, stepWilderRsi, WARMUP_BARS } from './stepIndicators.js';

export const BUCKET_MS = 300_000;
const MAX_SEGMENT_CLOSES = Math.max(...Object.values(WARMUP_BARS));

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** First and last regular-session bucket keys for a calendar session. */
export function sessionKeys(session) {
  return {
    firstKey: Math.floor(session.openMs / BUCKET_MS),
    lastKey: Math.floor((session.closeMs - 1) / BUCKET_MS),
  };
}

/** §6.1 — the bucket key an in-session priceAsOf belongs to (null outside). */
export function bucketKeyFor(priceAsOf, session) {
  if (!isNum(priceAsOf) || priceAsOf < session.openMs || priceAsOf > session.closeMs) return null;
  const { lastKey } = sessionKeys(session);
  if (priceAsOf === session.closeMs) return lastKey;
  return Math.floor(priceAsOf / BUCKET_MS);
}

export function newRing() { return { buckets: [] }; }

export function newState() {
  return {
    sma20: null, macd: null, rsi: null,
    segmentLen: 0, segmentCloses: [], segmentKeys: [], qualifiedRun: 0,
    lastCompleted: null, completedBars: 0, gaps: 0,
    // §6.7 flags for the recursive indicators (set at init, ANDed by steps).
    macdCloseQualified: null, rsiCloseQualified: null,
  };
}

function makeBucket(key, session, { seeded = false } = {}) {
  const { firstKey, lastKey } = sessionKeys(session);
  return {
    key,
    startMs: key * BUCKET_MS,
    endMs: key * BUCKET_MS + BUCKET_MS,
    sessionEtDate: session.etDate,
    isFirst: key === firstKey,
    isLast: key === lastKey,
    close: null,
    sampleCount: 0,
    maxPriceAsOf: null,
    closeLagMs: null,
    status: 'open',
    reason: null,
    seeded,
    closeQualified: true,
  };
}

/** Session-relative adjacency (§6.3): consecutive keys, or last→first across consecutive sessions. */
export function isAdjacent(prev, bucket, session) {
  if (!prev) return false;
  if (prev.sessionEtDate === bucket.sessionEtDate) return bucket.key === prev.key + 1;
  return prev.isLast === true && bucket.isFirst === true && prev.sessionEtDate === session.previousEtDate;
}

/**
 * §6.4 / §6.5 / §6.7 — advance the recursive state over one completed bucket.
 * Pure; returns a new state.
 */
export function advanceState(state, bucket, session) {
  const s = state || newState();
  const adjacent = s.lastCompleted ? isAdjacent(s.lastCompleted, bucket, session) : false;
  let next = { ...s };
  if (!adjacent) {
    if (s.lastCompleted) next.gaps = s.gaps + 1;
    next.segmentLen = 0;
    next.segmentCloses = [];
    next.segmentKeys = [];
    next.qualifiedRun = 0;
    next.sma20 = null; next.macd = null; next.rsi = null;
    next.macdCloseQualified = null; next.rsiCloseQualified = null;
  }
  next.segmentLen += 1;
  next.segmentCloses = [...next.segmentCloses, bucket.close].slice(-MAX_SEGMENT_CLOSES);
  next.segmentKeys = [...(next.segmentKeys || []), bucket.key].slice(-MAX_SEGMENT_CLOSES);
  next.qualifiedRun = bucket.closeQualified ? next.qualifiedRun + 1 : 0;
  next.completedBars = s.completedBars + 1;
  next.lastCompleted = { key: bucket.key, sessionEtDate: bucket.sessionEtDate, isLast: bucket.isLast === true };

  // SMA20 — window-based; closeQualified is a fact of its window (§6.7).
  if (next.sma20 === null) {
    if (next.segmentLen >= WARMUP_BARS.sma20_5m) next.sma20 = stepSma.init(next.segmentCloses.slice(-WARMUP_BARS.sma20_5m));
  } else {
    next.sma20 = stepSma.step(next.sma20, bucket.close);
  }
  // MACD — recursive; qualified only if initialised from a fully qualified
  // segment and never stepped over an unqualified bucket since.
  if (next.macd === null) {
    if (next.segmentLen >= WARMUP_BARS.macd5m) {
      const seed = next.segmentCloses.slice(-WARMUP_BARS.macd5m);
      next.macd = stepMacd.init(seed, { barKeys: next.segmentKeys.slice(-WARMUP_BARS.macd5m) });
      next.macdCloseQualified = next.qualifiedRun >= WARMUP_BARS.macd5m;
    }
  } else {
    next.macd = stepMacd.step(next.macd, bucket.close, bucket.key);
    next.macdCloseQualified = next.macdCloseQualified === true && bucket.closeQualified === true;
  }
  // RSI — recursive, same rule.
  if (next.rsi === null) {
    if (next.segmentLen >= WARMUP_BARS.rsi5m) {
      next.rsi = stepWilderRsi.init(next.segmentCloses.slice(-WARMUP_BARS.rsi5m));
      next.rsiCloseQualified = next.qualifiedRun >= WARMUP_BARS.rsi5m;
    }
  } else {
    next.rsi = stepWilderRsi.step(next.rsi, bucket.close);
    next.rsiCloseQualified = next.rsiCloseQualified === true && bucket.closeQualified === true;
  }
  return next;
}

function finalize(bucket, { closingRowPolicy }) {
  return {
    ...bucket,
    status: 'completed',
    reason: 'normal',
    closeLagMs: isNum(bucket.maxPriceAsOf) ? bucket.endMs - bucket.maxPriceAsOf : null,
    // §6.7 — the closing bar is unresolved until §15 answers.
    closeQualified: bucket.isLast ? closingRowPolicy !== null : true,
  };
}

function trimRing(buckets, maxClosed) {
  const closed = buckets.filter((b) => b.status !== 'open');
  const open = buckets.filter((b) => b.status === 'open');
  return [...closed.slice(-maxClosed), ...open].sort((a, b) => a.key - b.key);
}

/**
 * §6.1–6.3 — apply one price-new observation to a symbol's ring and state.
 * @returns {{ ring, state, completed: Bucket[], rejected: string|null }}
 */
export function applyObservationToBuckets({ ring, state, obs, session, closingRowPolicy = null, maxClosed = 60 }) {
  const r = ring || newRing();
  let st = state || newState();
  let buckets = [...r.buckets];
  const completed = [];
  const { lastKey } = sessionKeys(session);

  const advanced = new Set();
  const closeOpen = (pred) => {
    buckets = buckets.map((b) => {
      if (b.status === 'open' && pred(b)) {
        const done = finalize(b, { closingRowPolicy });
        completed.push(done);
        return done;
      }
      return b;
    });
    for (const done of completed) {
      const id = `${done.sessionEtDate}:${done.key}`;
      if (!advanced.has(id)) { st = advanceState(st, done, session); advanced.add(id); }
    }
  };

  // Passage AT OR PAST the close: the last bucket completes; the price is
  // never written. `>=`, not `>`, since calcVersion 2 (§5.5 post-close rule,
  // EODHD answer 3): the closing-auction print lands AT the close on Nasdaq
  // and most NYSE symbols, and minutes after it on the rest, so an
  // observation stamped `sessionCloseMs` is the auction — outside the
  // continuous session these buckets describe — and its price must not become
  // a 5-minute close. The bucket still completes: passage is established.
  if (isNum(obs.priceAsOf) && obs.priceAsOf >= session.closeMs) {
    closeOpen((b) => b.sessionEtDate === session.etDate && b.key <= lastKey);
    return { ring: { buckets: trimRing(buckets, maxClosed) }, state: st, completed, rejected: null };
  }

  const k = bucketKeyFor(obs.priceAsOf, session);
  if (k === null) return { ring: r, state: st, completed: [], rejected: 'outside_session' };

  // §6.3 — a completed key is immutable.
  const existing = buckets.find((b) => b.key === k && b.sessionEtDate === session.etDate);
  if (existing && existing.status !== 'open') {
    return { ring: r, state: st, completed: [], rejected: 'lateUpdateRejected' };
  }
  // A later key completes every open bucket before it (normal completion).
  closeOpen((b) => b.status === 'open' && (b.sessionEtDate < session.etDate || b.key < k));

  let bucket = buckets.find((b) => b.key === k && b.sessionEtDate === session.etDate);
  if (!bucket) {
    bucket = makeBucket(k, session);
    buckets.push(bucket);
    buckets.sort((a, b) => a.key - b.key);
  }
  const updated = { ...bucket, sampleCount: bucket.sampleCount + 1 };
  if (!isNum(bucket.maxPriceAsOf) || obs.priceAsOf > bucket.maxPriceAsOf) {
    updated.maxPriceAsOf = obs.priceAsOf;
    updated.close = obs.price;
  }
  buckets = buckets.map((b) => (b === bucket ? updated : b));

  // No exact-close special case remains: `priceAsOf === sessionCloseMs` is
  // caught by the passage branch above (calcVersion 2). The last bucket
  // closes on the last CONTINUOUS-session trade, or on the §6.2 deadline.
  return { ring: { buckets: trimRing(buckets, maxClosed) }, state: st, completed, rejected: null };
}

/**
 * §6.2 deadline — at close + 30 min, any bucket of `session` still open is
 * marked `incomplete` / `deadline`; the last bucket is created as incomplete
 * if it never opened. State does not advance. Idempotent.
 * @returns {{ ring, changed: boolean, marked: number[] }}
 */
export function applyDeadline({ ring, session, nowMs, deadlineAfterCloseMs = 30 * 60_000 }) {
  const r = ring || newRing();
  if (!isNum(nowMs) || nowMs < session.closeMs + deadlineAfterCloseMs) return { ring: r, changed: false, marked: [] };
  const { lastKey } = sessionKeys(session);
  const marked = [];
  let buckets = r.buckets.map((b) => {
    if (b.sessionEtDate === session.etDate && b.status === 'open') {
      marked.push(b.key);
      return { ...b, status: 'incomplete', reason: 'deadline', closeQualified: false };
    }
    return b;
  });
  const hasLast = buckets.some((b) => b.sessionEtDate === session.etDate && b.key === lastKey);
  if (!hasLast) {
    const missingLast = { ...makeBucket(lastKey, session), status: 'incomplete', reason: 'deadline', closeQualified: false };
    // Only record it when the session had ANY bucket — a symbol with no
    // observations at all today has nothing to mark (a gap, not a deadline).
    if (buckets.some((b) => b.sessionEtDate === session.etDate)) {
      buckets = [...buckets, missingLast].sort((a, b) => a.key - b.key);
      marked.push(lastKey);
    }
  }
  return { ring: { buckets }, changed: marked.length > 0, marked };
}

/**
 * §6.6 late seed / rebuild — recompute the state chronologically over the
 * given closed buckets (seeded first, then today's, in key order), then trim.
 * Today's observations are never erased or reordered: the caller passes the
 * ring's existing buckets and the seed; open buckets ride through untouched.
 */
export function rebuildFromBuckets({ seeded = [], existing = [], sessionOf, maxClosed = 60 }) {
  const byId = new Map();
  for (const b of [...seeded, ...existing]) byId.set(`${b.sessionEtDate}:${b.key}`, b);
  const all = [...byId.values()].sort((a, b) => a.key - b.key);
  let state = newState();
  for (const b of all) {
    if (b.status !== 'completed') continue;
    state = advanceState(state, b, sessionOf(b.sessionEtDate));
  }
  return { ring: { buckets: trimRing(all, maxClosed) }, state };
}

/** §8.2 quality block for the recursive indicators. */
export function indicatorQuality(state, indicator) {
  const s = state || newState();
  const warmup = WARMUP_BARS[indicator];
  const last = s.lastCompleted;
  return {
    completedBars: s.completedBars,
    gaps: s.gaps,
    segmentLen: s.segmentLen,
    warmupMet: s.segmentLen >= warmup,
    lastCompletedKey: last ? last.key : null,
    closeQualified: indicator === 'sma20_5m'
      ? (s.sma20 !== null ? s.qualifiedRun >= WARMUP_BARS.sma20_5m : null)
      : indicator === 'macd5m' ? s.macdCloseQualified : s.rsiCloseQualified,
  };
}
