// api/_utils/__fixtures__/eodhdQuoteFixtures.js
//
// EODHD response shapes for the invalid-real-time-price regression rows
// (docs/audits/20261014_BUILD_NA_QUOTE_INVALID_PRICE.md), plus a `fetch` stub
// that routes EODHD URLs to them. Lets a suite run the REAL
// marketDataCache.getStockAnalysisData with only the network as a double.
//
// From read-only probes on 14 Oct 2026:
//   · EQR.US real-time, 19:57 UTC — verbatim: a delisted symbol, HTTP 200, every
//     field "NA";
//   · WBD.US real-time — close "NA" and previousClose 30.95 as probed (Phase 0,
//     20:55 UTC); its other fields are written "NA" like EQR's;
//   · MPC.US real-time, 19:42 UTC — verbatim, an ordinary live quote;
//   · EQR.US / AVB.US daily bars — their last sessions. The dates, raw closes,
//     AVB's adjusted close and EQR's volumes are as probed; open/high/low are
//     illustrative. AVB's adjusted close (65.90) is far below its raw close
//     (184.0601), which is what makes the existing non-200 fallback (adjusted
//     close) unsafe against a raw baseline.
// Market data only: no key, no uid.

/** Real-time bodies, keyed by name. Each value is what `response.json()` returns. */
export const REAL_TIME = Object.freeze({
  EQR_ALL_NA: { code: 'EQR.US', timestamp: 'NA', gmtoffset: 0, open: 'NA', high: 'NA', low: 'NA', close: 'NA', volume: 'NA', previousClose: 'NA', change: 'NA', change_p: 'NA' },
  WBD_MIXED: { code: 'WBD.US', timestamp: 'NA', gmtoffset: 0, open: 'NA', high: 'NA', low: 'NA', close: 'NA', volume: 'NA', previousClose: 30.95, change: 'NA', change_p: 'NA' },
  MPC_LIVE: { code: 'MPC.US', timestamp: 1792006920, gmtoffset: 0, open: 480, high: 482.65, low: 480, close: 482.65, volume: 1129234, previousClose: 476.98, change: 5.67, change_p: 1.1887 },
});

/** EODHD /eod rows (order=d, newest first), in the API's own field names. */
export const DAILY = Object.freeze({
  EQR: [
    { date: '2026-08-17', open: 63.5, high: 64.1, low: 63.2, close: 63.66, adjusted_close: 63.66, volume: 17443420 },
    { date: '2026-08-14', open: 65.5, high: 66.2, low: 65.4, close: 65.97, adjusted_close: 65.97, volume: 7322801 },
  ],
  AVB: [
    { date: '2026-08-14', open: 183.9, high: 185.2, low: 183.1, close: 184.0601, adjusted_close: 65.9, volume: 2400000 },
  ],
});

/** A body as raw JSON text, for values JSON.stringify cannot carry (1e400 → Infinity). */
export const rawJson = (text) => ({ __rawJson: text });

/**
 * Stub global `fetch` for EODHD. `realTime` / `eod` map an EODHD symbol
 * ('EQR.US') to a body, a `rawJson(...)` body, or a number = a non-200 HTTP
 * status. An unmapped symbol answers 404. `calls` records each URL with the
 * key redacted.
 */
export function stubEodhdFetch(vi, { realTime = {}, eod = {} } = {}) {
  const calls = [];
  const fetchStub = vi.fn(async (url) => {
    const u = String(url);
    calls.push(u.replace(/api_token=[^&]*/, 'api_token=***'));
    const m = /\/api\/(real-time|eod)\/([^?]+)\?/.exec(u);
    const table = m?.[1] === 'real-time' ? realTime : m?.[1] === 'eod' ? eod : {};
    const entry = m ? table[decodeURIComponent(m[2])] : undefined;
    if (entry === undefined) return { ok: false, status: 404, json: async () => ({}) };
    if (typeof entry === 'number') return { ok: false, status: entry, json: async () => ({}) };
    if (entry && entry.__rawJson !== undefined) return { ok: true, status: 200, json: async () => JSON.parse(entry.__rawJson) };
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(entry)) };
  });
  vi.stubGlobal('fetch', fetchStub);
  return { fetchStub, calls };
}

/** The Firestore surface marketDataCache's cache writer touches, as a no-op double. */
export function cacheDbDouble() {
  const doc = () => ({ set: async () => {}, get: async () => ({ exists: false, data: () => undefined }) });
  return { collection: () => ({ doc }) };
}
