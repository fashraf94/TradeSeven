// api/_utils/intraday/intradayFetch.js
//
// Intraday Data — Build 1, contract §4 / §5.3 steps 3–4: the vendor requests.
// `fetchImpl` and `now` are injected (tests pass fakes; the cron passes
// globalThis.fetch and Date.now). Fetches run OUTSIDE any transaction, with a
// 10 s timeout per request and concurrency 4 (§5.3). Units are counted here
// — 1 per ticker REQUESTED whether or not it returned (G1), 5 per /intraday/
// request — and returned to the cron, which records them before any
// calculation (§5.3 step 4).

import { normalizeLiveV2, normalizeLiveV1Crypto } from './observation.js';

export const API_BASE = 'https://eodhd.com/api';

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchJsonWithTimeout(url, { fetchImpl, timeoutMs }) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, controller ? { signal: controller.signal } : undefined);
    if (!res || !res.ok) return { ok: false, status: res?.status ?? 0, json: null };
    const json = await res.json();
    return { ok: true, status: res.status, json };
  } catch (err) {
    return { ok: false, status: 0, json: null, error: err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err)) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const liveV2Url = ({ apiKey, vendorSymbols }) => `${API_BASE}/us-quote-delayed?s=${vendorSymbols.join(',')}&api_token=${apiKey}&fmt=json`;
export const liveV1CryptoUrl = ({ apiKey, vendorSymbols }) => {
  const [first, ...rest] = vendorSymbols;
  return `${API_BASE}/real-time/${first}?api_token=${apiKey}&fmt=json${rest.length ? `&s=${rest.join(',')}` : ''}`;
};
export const intraday1mUrl = ({ apiKey, vendorSymbol, fromSec, toSec }) =>
  `${API_BASE}/intraday/${vendorSymbol}?api_token=${apiKey}&fmt=json&interval=1m&from=${fromSec}&to=${toSec}`;

/** Redact the token for logs. */
export const redactUrl = (url) => String(url).replace(/api_token=[^&]*/g, 'api_token=***');

/**
 * Fetch delayed quotes for stocks (Live v2) and crypto (Live v1).
 * @param {object} p
 * @param {Array<{sym: string, vendor: string}>} p.stocks
 * @param {Array<{sym: string, vendor: string}>} p.crypto
 * @returns {{ observations: Object<string, Observation>, missing: string[], anomalies, unitsRequested, unitsBySource, requests, failures }}
 */
export async function fetchQuotes({ apiKey, stocks = [], crypto = [], fetchImpl, now, timeoutMs, concurrency, maxPerRequest }) {
  const observations = {};
  const missing = [];
  const anomalies = { missing: 0, shapeUnexpected: 0, unitCoerced: 0, requestFailed: 0 };
  const failures = [];
  const batches = [
    ...chunk(stocks, maxPerRequest).map((group) => ({ kind: 'live_v2', group })),
    ...chunk(crypto, maxPerRequest).map((group) => ({ kind: 'live_v1_crypto', group })),
  ];
  const unitsBySource = { live_v2: stocks.length, live_v1_crypto: crypto.length };
  const unitsRequested = stocks.length + crypto.length;

  await mapConcurrent(batches, concurrency, async ({ kind, group }) => {
    const vendorSymbols = group.map((g) => g.vendor);
    const url = kind === 'live_v2' ? liveV2Url({ apiKey, vendorSymbols }) : liveV1CryptoUrl({ apiKey, vendorSymbols });
    const res = await fetchJsonWithTimeout(url, { fetchImpl, timeoutMs });
    const availableAt = now();
    if (!res.ok) {
      anomalies.requestFailed += 1;
      failures.push({ kind, symbols: group.map((g) => g.sym), status: res.status, error: res.error || null });
      for (const g of group) missing.push(g.sym);
      return;
    }
    const norm = kind === 'live_v2'
      ? normalizeLiveV2(res.json, group, { availableAt })
      : normalizeLiveV1Crypto(res.json, group, { availableAt });
    for (const o of norm.observations) observations[o.sym] = o;
    missing.push(...norm.missing);
    anomalies.shapeUnexpected += norm.anomalies.shapeUnexpected;
    anomalies.unitCoerced += norm.anomalies.unitCoerced;
  });
  anomalies.missing = missing.length;
  return { observations, missing, anomalies, unitsRequested, unitsBySource, requests: batches.length, failures };
}

/**
 * Raw 1-minute bars for one symbol over an absolute window — no partial or
 * synthetic-row stripping (the validator needs the vendor's 16:00 row, §10.2).
 * 5 units per request (G1).
 */
export async function fetchIntraday1mBars({ apiKey, vendorSymbol, fromSec, toSec, fetchImpl, timeoutMs }) {
  const url = intraday1mUrl({ apiKey, vendorSymbol, fromSec, toSec });
  const res = await fetchJsonWithTimeout(url, { fetchImpl, timeoutMs });
  if (!res.ok) return { ok: false, bars: null, units: 5, status: res.status, error: res.error || null };
  return { ok: true, bars: Array.isArray(res.json) ? res.json : [], units: 5, status: res.status };
}
