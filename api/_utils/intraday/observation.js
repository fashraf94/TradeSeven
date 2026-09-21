// api/_utils/intraday/observation.js
//
// Intraday Data — Build 1, contract §4 (one internal shape) and §5.5 (keys).
// PURE, ZERO IMPORTS, no Date.now(): `availableAt` is an argument.
//
//   Observation = { sym, price, priceAsOf (ms), snapshotTs (ms), availableAt (ms),
//                   volume|null, high|null, low|null, open|null, averageVolume|null,
//                   previousClose|null, change|null, changePercent|null, size|null,
//                   source }
//
// Two adapters produce it: Live v2 (US stocks/ETFs — a `data` object keyed by
// symbol, unresolved symbols silently omitted) and Live v1 (crypto — an array
// of { code, close, timestamp, … }). A requested symbol absent from the
// response is reported in `missing` (→ anomalies.missing++, no update).
//
// VENDOR SHAPE NOTE: eodhd.com was egress-blocked from the build session, so
// the Live v2 field names below are the contract's (§4 / G7), ASSUMED — see
// docs/audits/20260919_BUILD1_STEP0.md §4. A response with no `data` object
// is reported as `shapeUnexpected` with every requested symbol missing, never
// a throw.

export const SOURCE_LIVE_V2 = 'eodhd_live_v2';
export const SOURCE_LIVE_V1_CRYPTO = 'eodhd_live_v1_crypto';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v
  : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null));

/**
 * Epoch-millis from a vendor timestamp that may be seconds or milliseconds.
 * Below 1e11 (≈ 1973 in ms) it can only be seconds; the caller records the
 * coercion so a unit surprise is visible on day 1 rather than silent.
 */
export function toMs(v) {
  const n = num(v);
  if (n === null) return { ms: null, coerced: false };
  if (n < 1e11) return { ms: n * 1000, coerced: true };
  return { ms: n, coerced: false };
}

// FNV-1a, two 32-bit lanes → 16 hex chars. Deterministic, dependency-free,
// identical on server and client (a stored view can be re-keyed anywhere).
function fnv1a32(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
export function hashKey(...parts) {
  const s = parts.map((p) => (p === null || p === undefined ? '' : String(p))).join('|');
  const a = fnv1a32(s, 0x811c9dc5).toString(16).padStart(8, '0');
  const b = fnv1a32(s, 0x9747b28c).toString(16).padStart(8, '0');
  return a + b;
}

/** §5.5 — records vendor revisions: a refreshed snapshotTs is a NEW observation. */
export function observationId(sym, priceAsOf, snapshotTs) {
  return hashKey('obs', sym, priceAsOf, snapshotTs);
}
/** §5.5 — the strike-evidence identity: unchanged across a refreshed snapshotTs. */
export function strikeKey(sym, priceAsOf) {
  return hashKey('strike', sym, priceAsOf);
}

function pickQuote(data, req) {
  if (!data || typeof data !== 'object') return null;
  const candidates = [req.vendor, req.sym, req.vendor?.toUpperCase?.(), req.sym?.toUpperCase?.()];
  for (const k of candidates) {
    if (k && Object.prototype.hasOwnProperty.call(data, k) && data[k] && typeof data[k] === 'object') return data[k];
  }
  return null;
}

/**
 * Live v2 (`/api/us-quote-delayed?s=…`).
 * @param {any} json the parsed response body
 * @param {Array<{sym: string, vendor: string}>} requested symbols in the request
 * @param {{availableAt: number}} ctx the instant the response was received
 * @returns {{ observations: Observation[], missing: string[], anomalies: {missing:number, shapeUnexpected:number, unitCoerced:number} }}
 */
export function normalizeLiveV2(json, requested, { availableAt }) {
  const out = { observations: [], missing: [], anomalies: { missing: 0, shapeUnexpected: 0, unitCoerced: 0 } };
  const reqs = Array.isArray(requested) ? requested : [];
  const data = json && typeof json === 'object' && json.data && typeof json.data === 'object' ? json.data : null;
  if (!data) {
    out.anomalies.shapeUnexpected = 1;
    for (const r of reqs) out.missing.push(r.sym);
    out.anomalies.missing = out.missing.length;
    return out;
  }
  for (const r of reqs) {
    const q = pickQuote(data, r);
    if (!q) { out.missing.push(r.sym); continue; }
    const asOf = toMs(q.lastTradeTime);
    // `snapshotTs` IS AN IDENTITY, NEVER AN INSTANT. On all 21 quotes of the
    // founder's Live v2 responses (2026-09-20) the vendor's `timestamp` is
    // exactly floor(lastTradeTime / 60_000) × 60 + 14_400 — the last-trade
    // minute plus the Eastern offset, as on EODHD's Live v2 documentation
    // page — so it carries no information `lastTradeTime` does not already
    // carry, and the offset makes it wrong by four hours read as UTC. It
    // exists here so a re-quoted symbol gets a NEW `observationId` while its
    // `strikeKey` holds (§5.5); nothing may read it as the instant a
    // cumulative field is cumulative to. See the two cutoff constants in
    // intradayConfig.js, which exclude it by name.
    // G7: `lastTradeTime` is documented in ms, snapshot `timestamp` in seconds —
    // only a seconds-valued lastTradeTime is a unit surprise worth counting.
    const snap = toMs(q.timestamp);
    if (asOf.coerced) out.anomalies.unitCoerced += 1;
    out.observations.push({
      sym: r.sym,
      price: num(q.lastTradePrice),
      priceAsOf: asOf.ms,
      snapshotTs: snap.ms,
      availableAt,
      volume: num(q.volume),
      high: num(q.high),
      low: num(q.low),
      open: num(q.open),
      averageVolume: num(q.averageVolume),
      previousClose: num(q.previousClosePrice),
      change: num(q.change),
      changePercent: num(q.changePercent),
      size: num(q.size),
      source: SOURCE_LIVE_V2,
    });
  }
  out.anomalies.missing = out.missing.length;
  return out;
}

/**
 * Live v1 (`/api/real-time/{first}?s=…`) for crypto — an array (or a single
 * object when one symbol was requested) of { code, close, timestamp, volume,
 * previousClose, change, change_p, open?, high?, low? }.
 */
export function normalizeLiveV1Crypto(json, requested, { availableAt }) {
  const out = { observations: [], missing: [], anomalies: { missing: 0, shapeUnexpected: 0, unitCoerced: 0 } };
  const reqs = Array.isArray(requested) ? requested : [];
  const rows = Array.isArray(json) ? json : (json && typeof json === 'object' && json.code ? [json] : null);
  if (!rows) {
    out.anomalies.shapeUnexpected = 1;
    for (const r of reqs) out.missing.push(r.sym);
    out.anomalies.missing = out.missing.length;
    return out;
  }
  const byCode = new Map();
  for (const row of rows) {
    if (row && typeof row === 'object' && typeof row.code === 'string') byCode.set(row.code.toUpperCase(), row);
  }
  for (const r of reqs) {
    const q = byCode.get(String(r.vendor).toUpperCase()) || byCode.get(String(r.sym).toUpperCase());
    if (!q) { out.missing.push(r.sym); continue; }
    const ts = toMs(q.timestamp);
    if (ts.coerced) out.anomalies.unitCoerced += 1;
    out.observations.push({
      sym: r.sym,
      price: num(q.close),
      priceAsOf: ts.ms,
      snapshotTs: ts.ms,
      availableAt,
      volume: num(q.volume),
      high: num(q.high),
      low: num(q.low),
      open: num(q.open),
      averageVolume: null,
      previousClose: num(q.previousClose),
      change: num(q.change),
      changePercent: num(q.change_p),
      size: null,
      source: SOURCE_LIVE_V1_CRYPTO,
    });
  }
  out.anomalies.missing = out.missing.length;
  return out;
}

/** Every Observation field, in order — the shape tests enumerate it. */
export const OBSERVATION_FIELDS = Object.freeze([
  'sym', 'price', 'priceAsOf', 'snapshotTs', 'availableAt', 'volume', 'high', 'low', 'open',
  'averageVolume', 'previousClose', 'change', 'changePercent', 'size', 'source',
]);
