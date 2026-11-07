// api/_utils/evidence/lastClose.js
//
// Huddle S1, evidence layer (f) — a symbol's last close, the prior session's, said as
// such (spec V1.1 §5.3 gather, §7 rule 3; Amendment C V1.2 §C1 `price`). The daily bars
// come from the shared market-data cache (api/_utils/marketDataCache.js
// getStockAnalysisData, fields ['daily'] — the `/eod/` window, newest first, two cache
// layers, no live quote spent). The close is the UNADJUSTED close of the bar dated the
// previous session (`rawClose`, falling back to `close` as the cache's own readers do);
// a newest bar older than the previous session is STALE and yields no close (null, never
// zero), so it is not quoted (§7 rule 3; marketDataCache.js:665's asOf check). Volume is
// never read (C §C12).

import { getStockAnalysisData } from '../marketDataCache.js';

/**
 * Pure: the close for `previousEtDate` from daily rows (any order).
 * @returns {{ lastClose: number|null, lastCloseAsOf: string|null, reason: string|null }}
 */
export function closeFromDailyRows(rows, previousEtDate) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.date === 'string');
  if (list.length === 0) return { lastClose: null, lastCloseAsOf: null, reason: 'no_bars' };
  const newest = list.reduce((a, b) => (a.date >= b.date ? a : b));
  if (typeof previousEtDate === 'string' && newest.date < previousEtDate) return { lastClose: null, lastCloseAsOf: newest.date, reason: 'stale_close' };
  const bar = list.find((r) => r.date === previousEtDate) || null;
  if (!bar) return { lastClose: null, lastCloseAsOf: null, reason: 'no_bar_for_session' };
  const close = typeof bar.rawClose === 'number' && Number.isFinite(bar.rawClose) && bar.rawClose > 0 ? bar.rawClose
    : typeof bar.close === 'number' && Number.isFinite(bar.close) && bar.close > 0 ? bar.close : null;
  if (close === null) return { lastClose: null, lastCloseAsOf: null, reason: 'no_close' };
  return { lastClose: Math.round(close * 100) / 100, lastCloseAsOf: bar.date, reason: null };
}

/** How long the daily-bar read may take: the shared cache takes no AbortSignal, so it gets its own deadline (review L2-5). */
export const LAST_CLOSE_TIMEOUT_MS = 15_000;

/** Fetch and read. Never throws, never hangs past its deadline: an error or a timeout is the reason. */
export async function fetchLastClose({ symbol, previousEtDate, getData = getStockAnalysisData, timeoutMs = LAST_CLOSE_TIMEOUT_MS }) {
  let timer;
  try {
    const timedOut = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); });
    const data = await Promise.race([getData(symbol, { fields: ['daily'], type: 'stock' }), timedOut]);
    if (!Array.isArray(data?.daily)) return { lastClose: null, lastCloseAsOf: null, reason: data?.errors?.daily ? 'fetch_failed' : 'no_bars', status: 'error' };
    const r = closeFromDailyRows(data.daily, previousEtDate);
    return { ...r, status: r.lastClose === null ? 'unavailable' : 'ok' };
  } catch (err) {
    return { lastClose: null, lastCloseAsOf: null, reason: err?.message === 'timeout' ? 'timeout' : 'fetch_failed', status: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
