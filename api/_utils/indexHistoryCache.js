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
// marketDataCache.js dailySeriesCurrency, applied to a per-session store):
//   • it was fetched on THIS ET session date and for THIS window (daysBack);
//   • its newest bar is exactly the prior completed session,
//     getPreviousSessionDate(etToday) from the calendar of record — a
//     today-dated bar or a one-session-stale series is refused;
//   • the calendar answers at all (null outside the maintained horizon).
// Anything else fetches fresh, as before, and writes through only a series that
// itself passes the rule. A store read or write failure is logged and never
// costs the run its data: the fresh fetch is used as today.
//
// `dropped` (rows mapDailyRows shed) is stored and replayed, so the run-level
// `droppedRows` persisted on indexIntelligence/stockRankings is the same number
// whether a history came from the store or from the vendor.

import { getPreviousSessionDate } from './marketSchedule.js';

export const INDEX_HISTORY_COLLECTION = 'indexHistoryCache';

/**
 * Is a stored history servable for this session?
 * @returns {{ok:boolean, reason:(string|null)}}
 */
export function checkStoredHistory(doc, { daysBack, etToday, expected }) {
  if (!expected) return { ok: false, reason: 'calendar_missing' };
  if (!doc || !Array.isArray(doc.rows) || doc.rows.length === 0) return { ok: false, reason: 'empty' };
  if (doc.daysBack !== daysBack) return { ok: false, reason: 'window_mismatch' };
  if (doc.etDate !== etToday) return { ok: false, reason: 'other_session_date' };
  const newest = doc.rows[0]?.date;
  if (typeof newest !== 'string') return { ok: false, reason: 'empty' };
  if (newest < expected) return { ok: false, reason: 'stale_session' };
  if (newest > expected) return { ok: false, reason: 'current_day_bar' };
  return { ok: true, reason: null };
}

/**
 * One store per cron invocation.
 *
 * @param {object} db - Firestore (Admin SDK shape)
 * @param {{etToday:string}} ctx - the ET session date of this run
 * @returns {{ expected:(string|null), stats:object,
 *   load:(eodhdSymbol:string, daysBack:number, fetchFresh:() => Promise<{rows:Array, dropped:number}>) => Promise<{rows:Array, dropped:number, source:string}>,
 *   summary:() => string }}
 */
export function createSessionHistoryStore(db, { etToday }) {
  const expected = getPreviousSessionDate(etToday);
  const stats = { served: 0, fetched: 0, stored: 0, reasons: {} };

  async function load(eodhdSymbol, daysBack, fetchFresh) {
    // The literal (not INDEX_HISTORY_COLLECTION) keeps this write statically
    // resolvable for the protected-store scan (compositionProtectedStoresScan.js),
    // the mandateUniverseSnapshot precedent: a non-protected literal needs no
    // allowlist entry.
    const ref = db.collection('indexHistoryCache').doc(eodhdSymbol);
    let reason = expected ? 'miss' : 'calendar_missing';
    if (expected) {
      try {
        const snap = await ref.get();
        if (snap.exists) {
          const doc = snap.data();
          const check = checkStoredHistory(doc, { daysBack, etToday, expected });
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

    if (expected && Array.isArray(fresh.rows) && fresh.rows.length > 0 && fresh.rows[0]?.date === expected) {
      try {
        await ref.set({
          symbol: eodhdSymbol,
          daysBack,
          etDate: etToday,
          newestBarDate: fresh.rows[0].date,
          rows: fresh.rows,
          dropped: fresh.dropped,
          fetchedAt: new Date(),
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

  return { expected, stats, load, summary };
}
