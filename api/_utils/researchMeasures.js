// api/_utils/researchMeasures.js
//
// Research universe Build 2 (PR B), build prompt section 5: A RESEARCH STOCK'S NUMBERS ON REQUEST. The first time
// someone asks, one EODHD fundamentals request (10 calls) gives the same business measures the rankings job stores
// for the 228, computed by the same code (api/_utils/stockMeasures.js); they are kept in researchMeasures/{symbol}
// and reused for 7 days (RU-16). A research stock shows its own numbers and no rank (RU-15).
//
// NOTHING IN THE APP CALLS THIS YET. scripts/research-stock.mjs, run by hand, is the only caller;
// researchUniverse.boundary.test.js fails if anything else names this module.
//
// THE RULES
//   - Only a research stock (a directory company: isResearchStock). One of the 228, a retired game stock or a symbol
//     not on the list is refused with no read, no write and no call.
//   - Kept numbers first: a record fetched 7 days ago or less is returned as it is (no call).
//   - Otherwise one fundamentals request, with the rankings job's own filter. The sector the math gets is
//     researchSectorOf(symbol) (see measuresOf). No price history (build prompt section 5.1).
//   - A daily ceiling (section 5.3): each fetch claims a slot in researchFetchDays/{UTC date} in a transaction BEFORE
//     the call. Over DAILY_FETCH_CEILING there is no call: kept numbers come back however old, marked stale;
//     with none, "not available today".
//   - A failed or empty response (section 5.4) stores an "unavailable" mark with its reason and time; the next touch
//     retries only after 1 day, so a stock with no data cannot cost 10 calls on every touch. Kept numbers from an
//     earlier fetch are not thrown away by a failed refetch: they stay, marked with the failure. A measure the
//     response does not carry is null; nothing partial is stored as if complete.
//   - Never stored: a rank, a percentile, a tier, a composite score, a pillar, a sector median, a leaderboard. The
//     `metrics` block has exactly the keys and units of peerRankings/{sym}.metrics (raw values, not converted;
//     fcfYield and fcfMargin are x100, grossMargin and the growth figures are fractions, as the rankings job stores
//     them). netDebtEbitda is carried exactly as the math gives it.
//   - Written only here, through the Admin SDK the caller passes in: researchMeasures and researchFetchDays. Nothing
//     the game reads is written. firestore.rules names neither collection, so its default rule denies every client.
//
// The store and the network are passed in (db, fetchImpl, now): this module imports no SDK and reads no environment.

import { ALL_TICKERS, EODHD_FUNDAMENTALS_FILTER, isRetiredStock } from './rankingConfig.js';
import { isResearchStock, researchIndustryOf, researchNameOf, researchSectorOf } from './researchUniverse.js';
import { computeEarningsConsistency, extractMetrics, shapeFundamentals } from './stockMeasures.js';

export const RESEARCH_MEASURES_COLLECTION = 'researchMeasures';
export const RESEARCH_FETCH_DAYS_COLLECTION = 'researchFetchDays';
/** Build prompt section 5.3: fetches a day (each costs CALLS_PER_FETCH calls, so 2,000 calls). */
export const DAILY_FETCH_CEILING = 200;
/** One fundamentals request (EODHD's published price, measured by the Nov 26 probe: 10). */
export const CALLS_PER_FETCH = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
/** RU-16: kept numbers are refreshed when they are more than 7 days old. */
export const KEEP_MS = 7 * DAY_MS;
/** Section 5.4: an unavailable stock is retried only after 1 day. */
export const UNAVAILABLE_RETRY_MS = DAY_MS;
/** The version of the stored record's shape. */
export const MEASURES_SHAPE_VERSION = 1;
export const API_BASE = 'https://eodhd.com/api';

/**
 * The keys of peerRankings/{sym}.metrics, in the rankings job's order (persistResults), each with the default it
 * writes for a missing value. researchMeasures.test.js reads compute-rankings.js and fails if they ever differ.
 */
export const STORED_METRIC_KEYS = Object.freeze([
  'revenueGrowthYOY', 'earningsGrowthYOY', 'opMarginTTM', 'profitMarginTTM', 'grossMargin', 'roaTTM', 'roeTTM',
  'evEbitda', 'trailingPE', 'priceSalesTTM', 'priceBookMRQ', 'fcfYield', 'dividendYield', 'fcfMargin',
  'sixMonthReturn', 'threeMonthReturn', 'oneMonthReturn',
  'debtToEquity', 'currentRatio', 'interestCoverage', 'netDebtEbitda',
  'beatRate', 'beatRateSource', 'avgSurpriseMag', 'surpriseConsistency',
  'earningsRevisions', 'avgEarningsSurprise', 'shortInterestScore', 'shortRatio', 'squeezeWatch', 'marketCap',
]);
const DEFAULT_FALSE = new Set(['squeezeWatch']);

const GAME = new Set(ALL_TICKERS);

/** The UTC date (YYYY-MM-DD) the daily counter is keyed by: the day EODHD's own usage counter keys (its user endpoint said 2026-11-27 at 00:30 UTC). */
export const fetchDayOf = (date) => date.toISOString().slice(0, 10);

/** Why a symbol is refused before anything is read, or null when it is a research stock. */
export function refusalOf(symbol) {
  if (typeof symbol !== 'string' || symbol.length === 0) return 'not_on_list';
  if (GAME.has(symbol)) return 'game_stock';
  if (isRetiredStock(symbol)) return 'retired';
  if (!isResearchStock(symbol)) return 'not_on_list';
  return null;
}

// -- The numbers -------------------------------------------------------------------------------------------------

/**
 * The stored metrics for one response: extractMetrics, exactly as the rankings job runs it, then the one
 * sector-dependent group recomputed with the research sector. extractMetrics reads its sector from the 228's map
 * (TICKER_TO_SECTOR[ticker]), which holds no research stock; the only measure the sector changes is the
 * earnings-consistency group's sector-default beat rate, so computeEarningsConsistency (the same function) runs again
 * with researchSectorOf(symbol). No function body was edited to pass it.
 */
export function measuresOf(symbol, shaped, sectorId) {
  const m = extractMetrics(symbol, shaped);
  const consistency = computeEarningsConsistency(shaped.earnings, sectorId);
  const merged = {
    ...m,
    beatRate: consistency.beatRate,
    beatRateSource: consistency.beatRateSource,
    avgSurpriseMag: consistency.avgSurpriseMag,
    surpriseConsistency: consistency.surpriseConsistency,
  };
  // The rankings job's persistResults: each key `?? null` (squeezeWatch `?? false`). The three momentum keys stay null:
  // the rankings job fills them from its rolling price history, which a research stock does not have.
  return Object.fromEntries(STORED_METRIC_KEYS.map((k) => [k, merged[k] ?? (DEFAULT_FALSE.has(k) ? false : null)]));
}

/**
 * compute-estimates.js's extractForwardEstimate, copied (that cron is out of this build's scope and does not export
 * it); researchMeasures.test.js reads compute-estimates.js and fails if the two bodies ever differ.
 */
function extractForwardEstimate(entry) {
  if (!entry) return null;
  return {
    avg: entry.earningsEstimateAvg ?? null,
    high: entry.earningsEstimateHigh ?? null,
    low: entry.earningsEstimateLow ?? null,
    numAnalysts: entry.earningsEstimateNumberOfAnalysts ?? null,
    growth: entry.earningsEstimateGrowth ?? null,
  };
}

/**
 * Analyst estimates from the same response's Earnings.Trend (build prompt section 2 point 4: it carries them), in
 * the shape estimatesCache keeps for one stock, with three differences:
 *   - emsPercentile is left out: a percentile (RU-15);
 *   - rsr, ems, surpriseStreak, avgSurprise and estimateSpread are null: compute-estimates.js computes them with
 *     functions it does not export, and a copy here would drift (a ruling question in the build report);
 *   - Trend keeps old periods under their old labels (every past year is "0y", every past quarter "0q") and keys rows
 *     by date, so a quarter ending with the fiscal year loses its "0q" row to the year's. A period is taken only from
 *     the latest-dated row with its label that ends after the last quarter with a reported actual; otherwise null.
 * Values are kept as EODHD sends them (strings), as estimatesCache keeps them. Null when no period qualifies.
 */
export function estimatesOf(earnings) {
  const trend = earnings?.Trend && typeof earnings.Trend === 'object' ? Object.values(earnings.Trend) : [];
  const reported = earnings?.History && typeof earnings.History === 'object'
    ? Object.values(earnings.History)
      .filter((h) => typeof h?.date === 'string' && h.epsActual !== null && h.epsActual !== undefined && h.epsActual !== '' && Number.isFinite(Number(h.epsActual)))
      .map((h) => h.date)
    : [];
  const lastReported = reported.length > 0 ? reported.sort().at(-1) : null;
  const current = (period) => trend
    .filter((r) => r?.period === period && typeof r.date === 'string' && (lastReported === null || r.date > lastReported))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0] ?? null;
  const entry0q = current('0q');
  const entry1q = current('+1q');
  const entry0y = current('0y');
  const entry1y = current('+1y');
  if (!entry0q && !entry1q && !entry0y && !entry1y) return null;
  return {
    rsr: null,
    ems: null,
    earningsEstimateNumberOfAnalysts: entry0y?.earningsEstimateNumberOfAnalysts ?? null,
    epsRevisionsUpLast30days: entry0y?.epsRevisionsUpLast30days ?? null,
    epsRevisionsDownLast30days: entry0y?.epsRevisionsDownLast30days ?? null,
    surpriseStreak: null,
    avgSurprise: null,
    estimateSpread: null,
    forwardEstimates: {
      currentQtr: extractForwardEstimate(entry0q),
      nextQtr: extractForwardEstimate(entry1q),
      currentYear: extractForwardEstimate(entry0y),
      nextYear: extractForwardEstimate(entry1y),
    },
  };
}

/** The fuller name the fundamentals response carries (the filter returns it under a top-level "General::Name" key). */
function fundamentalsNameOf(data) {
  const raw = data?.['General::Name'] ?? data?.General?.Name;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

/** A response with nothing to compute from: not an object, an array, or neither Highlights nor Financials. */
export function isEmptyResponse(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return true;
  const has = (v) => v && typeof v === 'object' && Object.keys(v).length > 0;
  return !has(data.Highlights) && !has(data.Financials);
}

/** The record stored for a successful fetch. */
export function buildRecord(symbol, data, nowIso) {
  const sectorId = researchSectorOf(symbol);
  const shaped = shapeFundamentals(data, symbol);
  return {
    symbol,
    name: fundamentalsNameOf(data) ?? researchNameOf(symbol) ?? symbol,
    sectorId,
    industry: researchIndustryOf(symbol),
    status: 'ok',
    metrics: measuresOf(symbol, shaped, sectorId),
    estimates: estimatesOf(shaped.earnings),
    fetchedAt: nowIso,
    unavailable: null,
    shapeVersion: MEASURES_SHAPE_VERSION,
  };
}

/** The record stored for a failed fetch: kept numbers from an earlier fetch stay; none are invented. */
export function buildUnavailableRecord(symbol, previous, reason, nowIso) {
  const hadNumbers = previous?.status === 'ok' && previous.metrics;
  // The record keeps its own shape version (none stays none), so numbers kept in an older shape are not later reused
  // as current (review R2-6).
  if (hadNumbers) return { ...previous, unavailable: { reason, at: nowIso }, shapeVersion: previous.shapeVersion ?? null };
  return {
    symbol,
    name: researchNameOf(symbol) ?? symbol,
    sectorId: researchSectorOf(symbol),
    industry: researchIndustryOf(symbol),
    status: 'unavailable',
    metrics: null,
    estimates: null,
    fetchedAt: null,
    unavailable: { reason, at: nowIso },
    shapeVersion: MEASURES_SHAPE_VERSION,
  };
}

// -- The plan ----------------------------------------------------------------------------------------------------

/** Allowed clock disagreement between the writer of a record and the reader. */
const CLOCK_SKEW_MS = 60 * 1000;

/** Age of a stored time; Infinity (never fresh) when it is not a date or lies in the future beyond the skew (review R2-4). */
const ageMs = (iso, nowMs) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t > nowMs + CLOCK_SKEW_MS) return Infinity;
  return nowMs - t;
};

/**
 * What a request would do, from what is kept and the clock alone (no ceiling: the claim decides that). The script's
 * dry run prints it; fetchResearchStock follows it.
 *   refuse          not a research stock (reason)
 *   use_kept        numbers fetched 7 days ago or less
 *   wait            the last attempt failed less than 1 day ago (kept numbers, if any, come back stale)
 *   fetch           one fundamentals request (claims a slot first)
 */
export function planResearchFetch(symbol, kept, nowMs) {
  const refused = refusalOf(symbol);
  if (refused) return { action: 'refuse', reason: refused, calls: 0 };
  const hasNumbers = kept?.status === 'ok' && kept.metrics && typeof kept.fetchedAt === 'string';
  const numbersAge = hasNumbers ? ageMs(kept.fetchedAt, nowMs) : null;
  // Numbers kept in an older shape are refetched, however fresh.
  if (hasNumbers && numbersAge <= KEEP_MS && kept.shapeVersion === MEASURES_SHAPE_VERSION) return { action: 'use_kept', calls: 0, ageMs: numbersAge };
  const failedAt = kept?.unavailable?.at;
  if (typeof failedAt === 'string' && ageMs(failedAt, nowMs) <= UNAVAILABLE_RETRY_MS) {
    return { action: 'wait', calls: 0, reason: kept.unavailable.reason, retryAfter: new Date(Date.parse(failedAt) + UNAVAILABLE_RETRY_MS).toISOString(), stale: Boolean(hasNumbers) };
  }
  return { action: 'fetch', calls: CALLS_PER_FETCH, refresh: Boolean(hasNumbers) };
}

// -- The ceiling -------------------------------------------------------------------------------------------------

/**
 * Claims one fetch slot for today, in a transaction, before any call. Refused, with nothing written and no slot taken:
 *   - over the ceiling (reason 'ceiling');
 *   - a symbol already claimed today (reason 'symbol_claimed_today'): a symbol is fetched at most once a UTC day, so
 *     whatever fails after the call (a store write, the math on an odd response) costs one request a day, never one a
 *     touch, and two touches at once cannot both fetch it (review R2-1, R2-2);
 *   - a counter that is not a whole number of fetches (reason 'counter_malformed'): fail closed (review R2-5).
 * Returns { ok, day, fetches, reason? } (fetches: the count after the claim, or the count that refused it).
 */
export async function claimFetchSlot(db, now, { ceiling = DAILY_FETCH_CEILING, symbol = null } = {}) {
  const day = fetchDayOf(now);
  const ref = db.collection('researchFetchDays').doc(day);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() ?? {} : null;
    const fetches = data === null ? 0 : data.fetches;
    if (!(Number.isInteger(fetches) && fetches >= 0)) return { ok: false, reason: 'counter_malformed', day, fetches: null };
    const symbols = data?.symbols && typeof data.symbols === 'object' ? data.symbols : {};
    if (symbol !== null && Object.hasOwn(symbols, symbol)) return { ok: false, reason: 'symbol_claimed_today', day, fetches };
    if (fetches >= ceiling) return { ok: false, reason: 'ceiling', day, fetches };
    const at = now.toISOString();
    tx.set(ref, {
      day, fetches: fetches + 1, ceiling, callsPerFetch: CALLS_PER_FETCH, updatedAt: at,
      symbols: symbol === null ? symbols : { ...symbols, [symbol]: at },
    });
    return { ok: true, day, fetches: fetches + 1 };
  });
}

/** Today's counter, read only. */
export async function readFetchDay(db, now) {
  const day = fetchDayOf(now);
  const snap = await db.collection('researchFetchDays').doc(day).get();
  const data = snap.exists ? snap.data() ?? {} : {};
  return { day, fetches: Number(data.fetches) || 0, ceiling: DAILY_FETCH_CEILING, symbols: data.symbols && typeof data.symbols === 'object' ? data.symbols : {} };
}

// -- The request -------------------------------------------------------------------------------------------------

/** The rankings job's request for one symbol (compute-rankings.js fetchSingleFundamental's URL). */
export const fundamentalsUrlOf = (symbol, apiKey) => `${API_BASE}/fundamentals/${symbol.replace(/\./g, '-')}.US?api_token=${apiKey}&fmt=json&filter=${EODHD_FUNDAMENTALS_FILTER}`;

/**
 * One fundamentals request. Never throws and never returns the URL or any error text (the URL carries the key):
 * { ok: true, data } or { ok: false, reason } with a fixed reason code.
 */
export async function requestFundamentals(symbol, apiKey, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(fundamentalsUrlOf(symbol, apiKey));
  } catch {
    return { ok: false, reason: 'network_error' };
  }
  if (!res || !res.ok) return { ok: false, reason: `http_${Number(res?.status) || 0}` };
  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: 'bad_json' };
  }
  if (isEmptyResponse(data)) return { ok: false, reason: 'empty_response' };
  return { ok: true, data };
}

/**
 * A research stock's numbers: kept, fetched, or why not. Returns
 *   { symbol, outcome, calls, record, stale, reason?, day? }
 * outcome: 'refused' | 'kept' | 'fetched' | 'unavailable' | 'over_ceiling'. `record` is what is stored (null when
 * nothing is); `stale` marks numbers older than 7 days returned because no fresh ones could be had.
 */
export async function fetchResearchStock(symbol, { db, apiKey, fetchImpl = globalThis.fetch, now = () => new Date(), ceiling = DAILY_FETCH_CEILING } = {}) {
  const refused = refusalOf(symbol);
  if (refused) return { symbol, outcome: 'refused', reason: refused, calls: 0, record: null, stale: false };

  // Collections are named by their literal (as RESEARCH_MEASURES_COLLECTION and RESEARCH_FETCH_DAYS_COLLECTION give
  // them), so the protected-store write scan (compositionProtectedStoresScan.js) resolves the plain write here; its two
  // transaction writes (claimFetchSlot, storeFailure) are handle-form and allowlisted by name with a human review
  // (compositionProtectedStoresAllowlist.json, _notes_research_numbers).
  const ref = db.collection('researchMeasures').doc(symbol);
  const snap = await ref.get();
  const kept = snap.exists ? snap.data() : null;
  const at = now();
  const nowMs = at.getTime();
  const plan = planResearchFetch(symbol, kept, nowMs);
  const keptNumbers = kept?.status === 'ok' && kept.metrics ? kept : null;

  if (plan.action === 'use_kept') return { symbol, outcome: 'kept', calls: 0, record: kept, stale: false };
  if (plan.action === 'wait') {
    return { symbol, outcome: 'unavailable', reason: plan.reason, retryAfter: plan.retryAfter, calls: 0, record: kept, stale: Boolean(keptNumbers) };
  }

  if (typeof apiKey !== 'string' || apiKey.length === 0) throw new Error('fetchResearchStock: no EODHD key');
  const claim = await claimFetchSlot(db, at, { ceiling, symbol });
  if (!claim.ok) {
    if (claim.reason === 'symbol_claimed_today') {
      // Fetched, or tried, earlier today: what that touch stored comes back, and never a second call (review R2-1).
      const again = await ref.get();
      const latest = again.exists ? again.data() : null;
      if (planResearchFetch(symbol, latest, nowMs).action === 'use_kept') return { symbol, outcome: 'kept', calls: 0, record: latest, stale: false };
      const latestNumbers = latest?.status === 'ok' && latest.metrics ? latest : null;
      return { symbol, outcome: 'unavailable', reason: 'symbol_claimed_today', day: claim.day, calls: 0, record: latest, stale: Boolean(latestNumbers) };
    }
    return { symbol, outcome: 'over_ceiling', reason: claim.reason === 'ceiling' ? 'daily_ceiling' : claim.reason, day: claim.day, calls: 0, record: keptNumbers, stale: Boolean(keptNumbers) };
  }

  const got = await requestFundamentals(symbol, apiKey, fetchImpl);
  const nowIso = now().toISOString();
  let record = null;
  let reason = got.ok ? null : got.reason;
  if (got.ok) {
    // The moved math throws on some malformed responses (a null history row, say): stored as a failure (review R2-1).
    try { record = buildRecord(symbol, got.data, nowIso); } catch { reason = 'compute_error'; }
  }
  if (record) {
    await ref.set(record);
    return { symbol, outcome: 'fetched', day: claim.day, calls: CALLS_PER_FETCH, record, stale: false };
  }
  const stored = await storeFailure(db, symbol, reason, nowIso, at.toISOString());
  const storedNumbers = stored?.status === 'ok' && stored.metrics ? stored : null;
  const stale = Boolean(storedNumbers) && ageMs(storedNumbers.fetchedAt, nowMs) > KEEP_MS;
  return { symbol, outcome: 'unavailable', reason, day: claim.day, calls: CALLS_PER_FETCH, record: stored, stale };
}

/**
 * Stores a failed attempt in a transaction that reads the record as it is now, not as it was before the call: numbers
 * another touch stored after this attempt began are newer than the failure and stay as they are (review R2-2);
 * otherwise kept numbers stay, marked with the failure, or an unavailable record is written.
 */
async function storeFailure(db, symbol, reason, nowIso, attemptStartIso) {
  const ref = db.collection('researchMeasures').doc(symbol);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : null;
    if (current?.status === 'ok' && current.metrics && Date.parse(current.fetchedAt) >= Date.parse(attemptStartIso)) return current;
    const marked = buildUnavailableRecord(symbol, current, reason, nowIso);
    tx.set(ref, marked);
    return marked;
  });
}

/** What is kept for a symbol, read only: { record, ageMs } (record null when nothing is kept). */
export async function readResearchStock(db, symbol, now = new Date()) {
  const snap = await db.collection('researchMeasures').doc(symbol).get();
  if (!snap.exists) return { record: null, ageMs: null };
  const record = snap.data();
  return { record, ageMs: typeof record?.fetchedAt === 'string' ? ageMs(record.fetchedAt, now.getTime()) : null };
}
