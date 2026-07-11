/**
 * Correlation Intelligence — local EODHD daily-close fetch helper.
 *
 * Deliberately self-contained (Build Spec V1.2): does NOT import fetchOHLCV
 * from the compute-index-intelligence cron file (handler files are not import
 * targets) and does NOT touch marketDataCache.js (a fence-adjacent shared
 * dependency — reads/calls only, and this helper needs neither its cache nor
 * its analysis pipeline). It pattern-matches the existing EODHD idiom instead:
 * /eod/{symbol} with from= + period=d + order=d, adjusted_close mapping, and a
 * calendar over-fetch of Math.ceil(days * 1.5) to absorb weekends/holidays.
 *
 * Unlike the existing batch fetchers, failed symbols are dropped AND reported
 * — never silently (a silently missing group member would skew the composite).
 *
 * Supports the full 1260-trading-day lookback ceiling (1.5× → 1890 calendar
 * days ≈ 1302 trading days). The 1095-day cap in api/stocks/historical.js is
 * that endpoint's own TIMEFRAME_CONFIG, not an API limit.
 */

import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';

const API_BASE = 'https://eodhd.com/api';
const CHUNK_SIZE = 5;
const CHUNK_DELAY_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Fetch daily adjusted closes for one EODHD symbol, NEWEST-FIRST (order=d —
 * the wire order; the endpoint adapter reverses exactly once).
 * → [{ date: 'YYYY-MM-DD', close: number }], non-finite rows filtered out.
 * Throws on missing API key, non-OK response, or a non-array body.
 *
 * Optional { signal } (additive; H3): when provided it is threaded to fetch so
 * a caller can abort a hung socket. Existing callers pass nothing — an
 * undefined signal is inert, so their behavior is byte-identical.
 *
 * Optional { withVolume } (additive; V3 Sub-build 3 — the liquidity gate): when
 * true, each row ADDITIONALLY carries the raw OHLC + volume the driver-audit
 * tool needs to screen a candidate driver (median volume, zero-volume days,
 * single-print days = raw high==low==open==close). RAW values on purpose —
 * `close` stays adjusted (adjusted_close ?? close), but single-print detection
 * is a same-day data-quality check on the un-adjusted bar. Existing callers
 * pass no flag → rows stay exactly { date, close }, byte-identical.
 */
export async function fetchEodCloses(eodhSymbol, lookbackDays, { signal, withVolume } = {}) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error('EODHD_API_KEY not configured');
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - Math.ceil(lookbackDays * 1.5));
  const url = `${API_BASE}/eod/${encodeURIComponent(eodhSymbol)}?api_token=${apiKey}&fmt=json&period=d&order=d&from=${formatDate(fromDate)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`EODHD ${eodhSymbol}: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`EODHD ${eodhSymbol}: non-array response`);
  // adjusted_close with a raw-close fallback (the marketDataCache.js
  // `adjusted_close || close` production idiom; ?? here so a legitimate
  // numeric 0 adjusted_close is preserved). INDX payloads are proven to carry
  // adjusted_close on the TNX path (compute-index-intelligence.js), but
  // VIX.INDX has never been fetched in this codebase — the fallback keeps an
  // adjusted_close-less row usable instead of silently filtering the series
  // to empty (which would misreport as driver_unavailable).
  return rows
    .map((d) => {
      const row = { date: d.date, close: Number(d.adjusted_close ?? d.close) };
      if (withVolume) {
        // Additive audit fields (raw). Kept out of the closes-only shape so
        // the join-and-compute callers stay byte-identical.
        row.volume = Number(d.volume);
        row.open = Number(d.open);
        row.high = Number(d.high);
        row.low = Number(d.low);
        row.rawClose = Number(d.close);
      }
      return row;
    })
    .filter((r) => typeof r.date === 'string' && Number.isFinite(r.close));
}

/**
 * Fetch the driver plus every group member (US equities get the `.US` suffix —
 * the SPY.US idiom — after the repo-standard dot→hyphen class-share
 * normalization: app-form BRK.B fetches as BRK-B.US, the convention every
 * other EODHD equity path uses via symbolNormalize.js), chunked 5 concurrent
 * with ~300ms between chunks via Promise.allSettled, mirroring the repo's
 * hand-rolled batch convention.
 *
 * → { driverRows: rows|null, memberRows: { SYMBOL: rows }, failedSymbols }
 * memberRows/failedSymbols are keyed by the ORIGINAL app-form ticker (dots,
 * no suffix), not the EODHD wire form. A failed driver → driverRows null.
 * Driver symbols come exact from the registry and are never re-formatted.
 */
export async function fetchAllSeries({ driverSymbol, groupSymbols, lookbackDays }) {
  const jobs = [
    { key: '__driver__', eodhd: driverSymbol },
    ...groupSymbols.map((s) => ({ key: s, eodhd: `${normalizeSymbolForEODHD(s)}.US` })),
  ];
  const results = new Map();
  for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
    const chunk = jobs.slice(i, i + CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map((job) => fetchEodCloses(job.eodhd, lookbackDays))
    );
    settled.forEach((outcome, k) => {
      results.set(chunk[k].key, outcome.status === 'fulfilled' ? outcome.value : null);
    });
    if (i + CHUNK_SIZE < jobs.length) await sleep(CHUNK_DELAY_MS);
  }
  const driverRows = results.get('__driver__');
  const memberRows = {};
  const failedSymbols = [];
  for (const s of groupSymbols) {
    const rows = results.get(s);
    if (rows && rows.length > 0) memberRows[s] = rows;
    else failedSymbols.push(s);
  }
  return {
    driverRows: driverRows && driverRows.length > 0 ? driverRows : null,
    memberRows,
    failedSymbols,
  };
}
