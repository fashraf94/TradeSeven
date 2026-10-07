// api/_utils/indexHistoryCache.js
//
// EODHD Quick Wins QW-6 (build report docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md):
// the PER-SESSION daily-history store behind compute-index-intelligence.
//
// That cron runs nine times a trading day (two pre-market wakes, seven hourly
// intraday wakes) and re-downloaded the same 256 daily histories every time —
// 2,304 `/eod/` calls a day for bars that do not change during the session
// (census §3 Q-04 rows 27–28). Its intraday quotes are a separate fetch and are
// untouched; only the history half is stored here.
//
// ONE document per symbol, `indexHistoryCache/{eodhdSymbol}`, stamped with the
// ET session date it was fetched on: { symbol, daysBack, etDate, newestBarDate,
// rows (newest-first, exactly as fetchOHLCV maps them), dropped, fetchedAt }.
// NOT marketDataCache `_daily` (founder ruling, Oct 7): those hold a 90-day
// window, while this cron asks for 378 / 75 / 45 calendar days per symbol type.
//
// A stored history is served only when ALL hold (the QW-1 currency rule,
// marketDataCache.js dailySeriesCurrency + priorCloseAgrees, applied to a
// per-session store):
//   • the session has NOT closed yet (getSessionForDate(etToday).closeMs) —
//     after the close a fresh fetch can already carry today's bar, which the
//     store never has (review E3-1: early-close days, the 20:00Z EDT wake);
//   • it was fetched on THIS ET session date, for THIS window (daysBack), and
//     at most HISTORY_STORE_MAX_AGE_MS ago (the QW-1 rule's 4 h TTL — review
//     E3-5: a vendor restatement is seen within one TTL, not one day);
//   • its newest bar is exactly the prior completed session,
//     getPreviousSessionDate(etToday) from the calendar of record — a
//     today-dated bar or a one-session-stale series is refused;
//   • when the run holds a live quote for the symbol (intraday mode), that
//     bar's raw close agrees with the quote's previousClose (review E1-1's
//     rule: a glitched or corrected bar is re-fetched, never served);
//   • the calendar answers at all (null outside the maintained horizon).
// Anything else fetches fresh, as before, and writes through only a series that
// itself passes the date rule. A store read or write failure is logged and
// never costs the run its data: the fresh fetch is used as today.
//
// `dropped` (rows mapDailyRows shed) is stored and replayed, so the run-level
// `droppedRows` persisted on indexIntelligence/stockRankings is the same number
// whether a history came from the store or from the vendor.

import { getPreviousSessionDate, getSessionForDate } from './marketSchedule.js';
import { PRIOR_CLOSE_AGREEMENT_TOLERANCE } from './marketDataCache.js';

export const INDEX_HISTORY_COLLECTION = 'indexHistoryCache';
/** The QW-1 rule's TTL (marketDataCache CACHE_TTL.daily). */
export const HISTORY_STORE_MAX_AGE_MS = 4 * 60 * 60 * 1000;

function toMillis(value) {
  if (value == null) return NaN;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/**
 * Is a stored history servable for this session?
 * @param {object} doc - the stored document
 * @param {{daysBack:number, etToday:string, expected:(string|null), nowMs?:number, previousClose?:(number|null)}} ctx
 * @returns {{ok:boolean, reason:(string|null)}}
 */
export function checkStoredHistory(doc, { daysBack, etToday, expected, nowMs = Date.now(), previousClose = null }) {
  if (!expected) return { ok: false, reason: 'calendar_missing' };
  if (!doc || !Array.isArray(doc.rows) || doc.rows.length === 0) return { ok: false, reason: 'empty' };
  if (doc.daysBack !== daysBack) return { ok: false, reason: 'window_mismatch' };
  if (doc.etDate !== etToday) return { ok: false, reason: 'other_session_date' };
  const fetchedAtMs = toMillis(doc.fetchedAt);
  if (!Number.isFinite(fetchedAtMs) || nowMs - fetchedAtMs > HISTORY_STORE_MAX_AGE_MS) return { ok: false, reason: 'ttl_stale' };
  const newest = doc.rows[0]?.date;
  if (typeof newest !== 'string') return { ok: false, reason: 'empty' };
  if (newest < expected) return { ok: false, reason: 'stale_session' };
  if (newest > expected) return { ok: false, reason: 'current_day_bar' };
  if (Number.isFinite(previousClose) && previousClose > 0) {
    const rawClose = doc.rows[0]?.rawClose;
    if (!Number.isFinite(rawClose) || Math.abs(rawClose - previousClose) / previousClose > PRIOR_CLOSE_AGREEMENT_TOLERANCE) {
      return { ok: false, reason: 'prev_close_mismatch' };
    }
  }
  return { ok: true, reason: null };
}

/**
 * One store per cron invocation.
 *
 * @param {object} db - Firestore (Admin SDK shape)
 * @param {{etToday:string, now?:() => number}} ctx - the ET session date of this run
 * @returns {{ expected:(string|null), closeMs:(number|null), stats:object,
 *   load:(eodhdSymbol:string, daysBack:number, fetchFresh:() => Promise<{rows:Array, dropped:number}>, opts?:{previousClose?:(number|null)}) => Promise<{rows:Array, dropped:number, source:string}>,
 *   summary:() => string }}
 */
export function createSessionHistoryStore(db, { etToday, now = () => Date.now() }) {
  const expected = getPreviousSessionDate(etToday);
  const closeMs = getSessionForDate(etToday)?.closeMs ?? null;
  const stats = { served: 0, fetched: 0, stored: 0, reasons: {} };

  async function load(eodhdSymbol, daysBack, fetchFresh, { previousClose = null } = {}) {
    let storeReachable = false;
    let reason = 'miss';
    if (!expected) {
      reason = 'calendar_missing';
    } else if (closeMs != null && now() >= closeMs) {
      reason = 'after_close';
    } else {
      try {
        // Built inside the try (review E3-7): an id Firestore rejects costs only
        // the store, never the symbol.
        const snap = await db.collection('indexHistoryCache').doc(eodhdSymbol).get();
        storeReachable = true;
        if (snap.exists) {
          const doc = snap.data();
          const check = checkStoredHistory(doc, { daysBack, etToday, expected, nowMs: now(), previousClose });
          if (check.ok) {
            stats.served++;
            return { rows: doc.rows, dropped: Number.isFinite(doc.dropped) ? doc.dropped : 0, source: 'store' };
          }
          reason = check.reason;
        }
      } catch (err) {
        reason = 'read_error';
        console.error(`[IndexHistoryCache] read failed for ${eodhdSymbol} (fetching fresh): ${err.message}`);
      }
    }

    const fresh = await fetchFresh();
    stats.fetched++;
    stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;

    if (storeReachable && expected && Array.isArray(fresh.rows) && fresh.rows.length > 0 && fresh.rows[0]?.date === expected) {
      try {
        // The literal chain (not INDEX_HISTORY_COLLECTION, not a variable) keeps
        // this write statically resolvable for the protected-store scan
        // (compositionProtectedStoresScan.js), the mandateUniverseSnapshot
        // precedent: a non-protected literal needs no allowlist entry.
        await db.collection('indexHistoryCache').doc(eodhdSymbol).set({
          symbol: eodhdSymbol,
          daysBack,
          etDate: etToday,
          newestBarDate: fresh.rows[0].date,
          rows: fresh.rows,
          dropped: fresh.dropped,
          fetchedAt: new Date(now()),
        });
        stats.stored++;
      } catch (err) {
        console.error(`[IndexHistoryCache] write failed for ${eodhdSymbol} (run unaffected): ${err.message}`);
      }
    }
    return { ...fresh, source: 'fetched' };
  }

  function summary() {
    const reasons = Object.entries(stats.reasons).map(([k, v]) => `${k}=${v}`).join(',') || 'none';
    return `QW6 HISTORY_STORE | etDate=${etToday} | expectedNewest=${expected} | served=${stats.served} | fetched=${stats.fetched} | stored=${stats.stored} | refetchReasons=${reasons}`;
  }

  return { expected, closeMs, stats, load, summary };
}
