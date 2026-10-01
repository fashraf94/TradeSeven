// api/_utils/filmTape/bars.js
//
// Film Room tape — 1-minute bars for one past session (spec §6, BA-11, BA-12).
// PURE: bars in, numbers out. No fetch, no clock.
//
// THE REGULAR SESSION, three filters in order:
//   1. the target ET date — the fetch window is NOW-anchored (build report
//      §1.1 item 6), so it can carry later sessions and extended hours;
//   2. the EXISTING clamp, filterToLatestSession (marketDataCache.js) — which
//      anchors on the latest ET date present, hence step 1 first;
//   3. the platform's closing-row policy of record, CLOSING_ROW_POLICY
//      (intradayConfig.js) through sessionEndMs (intraday/buckets.js): under
//      `continuous_session` the session ends the millisecond before the
//      calendar close, so the 16:00 closing-auction row is outside it and the
//      last regular bar is the one starting 15:59.
//
// BAR TIME: EODHD stamps a bar with its START (discovery
// eodhd-session-boundary-analysis.md §2: the 09:30 bar covers 09:30–09:35), so
// a 1-minute bar starting at t has COMPLETED at t + 60 s.
//
// PRICE AT AN INSTANT (BA-11): the close of the last 1-minute bar that
// completed at or before the instant — "the last completed minute before the
// check", never the bar containing it. A check at 10:07:30 reads the 10:06
// bar (completed 10:07:00), never 10:07 (completes 10:08:00). The day's close
// is the same rule at the session close: the 15:59 bar.
//
// A SAMPLE IS VALID ONLY WHEN FRESH (BA-24): that bar must have completed
// within 5 minutes of the instant — so the close sample's bar completed at or
// after the calendar close minus 5 minutes. A bar hours old is not the price
// at the instant: the sample is null, and its bar's close time is kept beside
// the null so the age shows. A session whose 10-minute bars are fewer than the
// calendar's count (39 regular, 21 on an early close — derived from the
// session's own bounds, never a constant) is not a whole session.

import { filterToLatestSession } from '../marketDataCache.js';
import { CLOSING_ROW_POLICY } from '../intradayConfig.js';
import { sessionEndMs } from '../intraday/buckets.js';
import { etDateOf } from './tapeTime.js';

export const BAR_MS = 60_000;
export const SERIES_BUCKET_MS = 10 * 60_000;
/** BA-24: a sample's bar must have completed within this long of the instant. */
export const SAMPLE_MAX_AGE_MS = 5 * 60_000;

/** A bar's start instant from EODHD's `datetime` ('YYYY-MM-DD HH:mm:ss' UTC, or ISO with Z). */
export function barStartMs(datetime) {
  if (typeof datetime !== 'string' || !datetime) return null;
  if (datetime.endsWith('Z')) { const ms = Date.parse(datetime); return Number.isFinite(ms) ? ms : null; }
  const m = datetime.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * The regular-session 1-minute bars of `etDate`, oldest first, as
 * `{ t, o, h, l, c, v }` (t = start, epoch ms). `session` is
 * marketSchedule.getSessionForDate(etDate).
 */
export function sessionBars(candles, etDate, session) {
  if (!Array.isArray(candles) || !session?.isTradingDay) return [];
  const onDate = candles.filter((c) => {
    const t = barStartMs(c?.datetime);
    return t !== null && etDateOf(t) === etDate;
  });
  const { candles: clamped, sessionDate } = filterToLatestSession(onDate);
  if (sessionDate !== etDate) return [];
  const endMs = sessionEndMs(session, CLOSING_ROW_POLICY);
  const byStart = new Map();
  for (const c of clamped) {
    const t = barStartMs(c.datetime);
    if (t === null || t < session.openMs || t > endMs) continue;
    if (![c.open, c.high, c.low, c.close].every(finite)) continue;
    byStart.set(t, { t, o: c.open, h: c.high, l: c.low, c: c.close, v: finite(c.volume) ? c.volume : 0 });
  }
  return [...byStart.values()].sort((a, b) => a.t - b.t);
}

/**
 * The close of the last bar COMPLETED at or before `instantMs`, and when it
 * completed; null when no bar of the session had completed.
 */
export function priceAt(bars, instantMs) {
  if (!Array.isArray(bars) || !finite(instantMs)) return null;
  let hit = null;
  for (const b of bars) {
    if (b.t + BAR_MS <= instantMs) hit = b; else break;
  }
  return hit ? { price: hit.c, barClosedAt: hit.t + BAR_MS } : null;
}

/**
 * BA-24 — the sample at an instant: the last completed bar (priceAt) and
 * whether it is fresh enough to stand for the instant. null when no bar of
 * the session had completed; else `{ price, barClosedAt, valid }`.
 */
export function sampleAt(bars, instantMs) {
  const p = priceAt(bars, instantMs);
  return p ? { ...p, valid: instantMs - p.barClosedAt <= SAMPLE_MAX_AGE_MS } : null;
}

/**
 * Could any bar of the session have completed by this instant? Before the
 * first minute closes (09:31 ET) no price exists at all — that null is the
 * record's shape, not a hole a later fetch could fill.
 */
export function sampleCanExist(session, instantMs) {
  return typeof instantMs === 'number' && instantMs >= session.openMs + BAR_MS;
}

/** The 10-minute bars a whole session holds — from the calendar's own bounds (39 regular, 21 early close). */
export function expectedSeriesBars(session) {
  return Math.ceil((session.closeMs - session.openMs) / SERIES_BUCKET_MS);
}

/** The session's opening price: the open of the bar starting at the open, else null. */
export function sessionOpenOf(bars, session) {
  const first = Array.isArray(bars) ? bars[0] : null;
  return first && first.t === session.openMs ? { value: first.o, at: new Date(first.t).toISOString() } : null;
}

/**
 * 1-minute → 10-minute bars (BA-12), anchored on the session open. `m` is the
 * number of 1-minute bars each was built from (BA-34, class `market`): a
 * retry's merge keeps, bucket by bucket, the bar built from more minutes. `n`
 * is the same count under the name A1 shipped; both are declared `market`.
 */
export function aggregate10m(bars, session) {
  const buckets = new Map();
  for (const b of Array.isArray(bars) ? bars : []) {
    const k = Math.floor((b.t - session.openMs) / SERIES_BUCKET_MS);
    if (k < 0) continue;
    const cur = buckets.get(k);
    if (!cur) buckets.set(k, { t: new Date(session.openMs + k * SERIES_BUCKET_MS).toISOString(), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, n: 1, m: 1 });
    else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; cur.v += b.v; cur.n += 1; cur.m += 1; }
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

/** Percent change, rounded to 3 dp; null when either end is missing. */
export function pctChange(from, to) {
  if (!finite(from) || !finite(to) || from === 0) return null;
  return Math.round(((to - from) / from) * 100 * 1000) / 1000;
}
