// api/_utils/eodhdDailyWindow.js
//
// THE ONE RAW DATE-RANGE DAILY REQUEST (ID-1 shape note V1.4 §3, "one shared raw
// request"). EODHD's `/eod/` endpoint for a symbol over [from, to], moved here
// from the idea review card (hypothesisRecords/review.js fetchWindowDaily) so the
// card and the setup-evidence store ask the provider the same way.
//
// It returns the parsed JSON payload whatever its shape and classifies nothing:
// a non-array body is the caller's to read (the card's `no_data`, the store's
// retryable acquisition failure). It writes no cache. `order` is explicit because
// the caller's reading depends on it: mapDailyRows preserves payload order, and
// the daily-bars adapter expects the newest session first. `timeoutMs` is
// optional; with none given the request is exactly the one the card has always
// made, one argument to fetch and no signal.
//
// A failed request, a timed-out one included, and an unreadable body throw
// 'EODHD daily request failed'; a non-OK status throws
// 'EODHD daily responded with <status>'. Neither message is built from the
// error it replaces or from the body, because a fetch failure can carry the URL
// and the URL carries the key. The key never leaves this function.

import { getCleanSymbol, formatEODHDSymbol, isCryptoSymbol } from './marketDataCache.js';

const EODHD_API_BASE = 'https://eodhd.com/api';

/**
 * ONE market-data call.
 *
 * @param {string} symbol
 * @param {{ from: string, to: string, order: 'a'|'d', timeoutMs?: number }} options
 *   `from` and `to` are YYYY-MM-DD; `order` 'a' is oldest first, 'd' newest first.
 * @returns {Promise<*>} the parsed payload, unexamined
 */
export async function fetchDailyPayload(symbol, { from, to, order, timeoutMs } = {}) {
  if (order !== 'a' && order !== 'd') throw new TypeError("fetchDailyPayload: `order` must be 'a' or 'd'");
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error('EODHD_API_KEY not configured');
  const eodSymbol = formatEODHDSymbol(getCleanSymbol(symbol), isCryptoSymbol(symbol));
  const url = `${EODHD_API_BASE}/eod/${encodeURIComponent(eodSymbol)}?api_token=${apiKey}&fmt=json&period=d&order=${order}&from=${from}&to=${to}`;
  let response;
  try {
    response = timeoutMs === undefined ? await fetch(url) : await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error('EODHD daily request failed');
  }
  if (!response.ok) throw new Error(`EODHD daily responded with ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error('EODHD daily request failed');
  }
}
