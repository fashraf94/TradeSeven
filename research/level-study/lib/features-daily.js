// research/level-study/lib/features-daily.js
//
// LevelStory Session 5 — daily-grain pre_touch features (parent §8.4; Addendum §A3.4, §A4, §A5).
//
// THE AVAILABILITY BOUNDARY (S5 §3.3): every function here takes the EVENT-DATE index `i` in the
// symbol's daily series and reads ONLY indices ≤ L = i−1 (data through the prior session's close).
// No function reads the event date's daily bar. The leak tests (tests/26) verify this by comparing
// a full-series run against a series physically truncated at L.
//
// Reuses lib/level-series.js buildSeries (adjusted OHLC, Wilder ATR(14), confirmed k=3 fractal
// swings, range sparse tables) — no math duplicated. Null-never-zero: every feature defines its
// null condition; uncomputable → null. Zero product imports.

import CONFIG from '../config.js';
import { buildSeries } from './level-series.js';

const TREND = CONFIG.trend;
const LEG = TREND.currentLegOrigin;      // {swingFractalK 3, minAdvanceAtr 3, deepPullbackResetPct 50, sidewaysResetSessions 30, sidewaysResetBandAtr 2.5}
const PRIMARY = TREND.primaryOrigin;     // {lookbackSessions 252, minAdvanceAtr 4}
const BASE = TREND.baseCount;            // {minSessions 10, bandAtr 2.5, afterLegAtr 3}
const EXT = TREND.extension;             // {maPeriod 50, pctileTrailingSessions 504, pctileMinSessions 252, buckets}
const HTF = CONFIG.features.higherTf;    // {trendStack [20,50], smaWeeks [20,50], rangeCompressionPercentileDays 20}
const REL = CONFIG.features.relativeMomentum; // {returnsVsSpyDays [5,20,60], betaAdjustedExcess.betaDays 60}
const CAT = CONFIG.catalyst;

export { buildSeries }; // re-export: the one daily backbone every feature module shares

// ── Small pure helpers (all null-safe) ───────────────────────────────────────

/** Percentile rank of x within values (0–100, mid-rank for ties). Null if values empty. */
export function pctileRank(values, x) {
  if (!values.length || x == null) return null;
  let below = 0, equal = 0;
  for (const v of values) { if (v < x) below += 1; else if (v === x) equal += 1; }
  return ((below + 0.5 * equal) / values.length) * 100;
}

function smaAt(arr, end, n) { // mean of arr[end-n+1..end]; null on short history or null members
  if (end - n + 1 < 0) return null;
  let s = 0;
  for (let m = end - n + 1; m <= end; m++) { if (arr[m] == null) return null; s += arr[m]; }
  return s / n;
}

export function retOver(arr, end, n) { // simple return over n sessions ending at end
  if (end - n < 0 || arr[end] == null || arr[end - n] == null || arr[end - n] === 0) return null;
  return arr[end] / arr[end - n] - 1;
}

/**
 * Benchmark return between the SAME session dates as [dates[L−n], dates[L]] — EXACT date matches
 * required (S5 review fix): the study symbols and ETFs share the NYSE calendar, so a missing date
 * means the benchmark is stale/truncated there, and a stale-window comparison must be null, never
 * a real-looking number.
 */
export function benchRetBetween(series, bench, L, n) {
  if (!bench || L - n < 0) return null;
  const bEnd = bench.dateIndex.get(series.dates[L]);
  const bStart = bench.dateIndex.get(series.dates[L - n]);
  if (bEnd == null || bStart == null || bEnd <= bStart) return null;
  return bench.aClose[bStart] > 0 ? bench.aClose[bEnd] / bench.aClose[bStart] - 1 : null;
}

/** Largest index with date < d (or ≤ d when inclusive) — the point-in-time cursor. -1 if none. */
export function idxBefore(series, d, inclusive = false) {
  const exact = series.dateIndex.get(d);
  if (exact != null) return inclusive ? exact : exact - 1;
  let lo = 0, hi = series.n - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (series.dates[mid] < d) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}

// ── Weekly / monthly aggregation (from the prefix 0..L only) ─────────────────

function mondayOf(date) { // ISO-week Monday of a YYYY-MM-DD date (UTC math; deterministic)
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

/**
 * Aggregate daily bars 0..L into period bars (weekly via ISO-Monday key, monthly via YYYY-MM).
 * The last group is the CURRENT (possibly partial) period through L — included as the latest bar
 * for SMA/trend/ATR (S5-C: "as of D−1" convention), excluded by HH/LL structure (completed only).
 */
export function aggregate(series, L, grain) {
  const out = [];
  let key = null;
  for (let m = 0; m <= L; m++) {
    const k = grain === 'weekly' ? mondayOf(series.dates[m]) : series.dates[m].slice(0, 7);
    if (k !== key) { out.push({ key: k, high: series.aHigh[m], low: series.aLow[m], close: series.aClose[m] }); key = k; }
    else {
      const g = out[out.length - 1];
      g.high = Math.max(g.high, series.aHigh[m]); g.low = Math.min(g.low, series.aLow[m]); g.close = series.aClose[m];
    }
  }
  return out;
}

function wilderAtr(bars, period) { // ATR over aggregated period bars; null until period bars exist
  let atr = null, trSum = 0;
  for (let i = 0; i < bars.length; i++) {
    const tr = i === 0 ? bars[i].high - bars[i].low
      : Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close));
    if (i < period - 1) trSum += tr;
    else if (i === period - 1) atr = (trSum + tr) / period;
    else atr = (atr * (period - 1) + tr) / period;
  }
  return atr;
}

function trendState(close, s20, s50) {
  if (close == null || s20 == null || s50 == null) return null;
  if (close > s20 && s20 > s50) return 'UP';
  if (close < s20 && s20 < s50) return 'DOWN';
  return 'MIXED';
}

function hhllState(bars) { // last 3 COMPLETED period bars (exclude the partial current = last entry)
  const completed = bars.slice(0, -1);
  if (completed.length < 3) return null;
  const [a, b, c] = completed.slice(-3);
  if (c.high > b.high && c.low > b.low && b.high > a.high && b.low > a.low) return 'HH_HL';
  if (c.high < b.high && c.low < b.low && b.high < a.high && b.low < a.low) return 'LH_LL';
  return 'MIXED';
}

// ── Higher-timeframe context (§4.3) ──────────────────────────────────────────

export function higherTfAt(series, i) {
  const L = i - 1;
  const nul = { weekly_trend_state: null, monthly_trend_state: null, dist_20w_sma_watr: null, dist_50w_sma_watr: null,
    dist_52w_high_pct: null, dist_52w_low_pct: null, weekly_hhll_state: null, monthly_hhll_state: null,
    daily_atr_pctile: null, range_compression_pctile: null };
  if (L < 0) return nul;
  const close = series.aClose[L];
  const weekly = aggregate(series, L, 'weekly');
  const monthly = aggregate(series, L, 'monthly');
  const wCloses = weekly.map((b) => b.close), mCloses = monthly.map((b) => b.close);
  const [p20, p50] = HTF.trendStack;
  const w20 = smaAt(wCloses, wCloses.length - 1, p20), w50 = smaAt(wCloses, wCloses.length - 1, p50);
  const m20 = smaAt(mCloses, mCloses.length - 1, p20), m50 = smaAt(mCloses, mCloses.length - 1, p50);
  const wAtr = wilderAtr(weekly, 14);
  const out = { ...nul };
  out.weekly_trend_state = trendState(close, w20, w50);
  out.monthly_trend_state = trendState(close, m20, m50);
  out.dist_20w_sma_watr = (w20 != null && wAtr) ? (close - w20) / wAtr : null;
  out.dist_50w_sma_watr = (w50 != null && wAtr) ? (close - w50) / wAtr : null;
  if (L >= 251) {
    const hi52 = series.maxHighTable.query(L - 251, L), lo52 = series.minLowTable.query(L - 251, L);
    out.dist_52w_high_pct = hi52 > 0 ? (close / hi52 - 1) * 100 : null;
    out.dist_52w_low_pct = lo52 > 0 ? (close / lo52 - 1) * 100 : null;
  }
  out.weekly_hhll_state = hhllState(weekly);
  out.monthly_hhll_state = hhllState(monthly);
  // daily_atr_pctile: ATR% of price vs its own trailing 504 values (min 252 non-null) — S5-C2.
  out.daily_atr_pctile = trailingPctile(series, L, (m) => (series.atr[m] != null && series.aClose[m] > 0) ? (series.atr[m] / series.aClose[m]) * 100 : null);
  // range_compression_pctile: 20-day range in ATR units, pctile vs trailing (LOW = coiled) — S5-C3.
  const rcDays = HTF.rangeCompressionPercentileDays;
  out.range_compression_pctile = trailingPctile(series, L, (m) => (m - rcDays + 1 >= 0 && series.atr[m])
    ? (series.maxHighTable.query(m - rcDays + 1, m) - series.minLowTable.query(m - rcDays + 1, m)) / series.atr[m] : null);
  return out;
}

function trailingPctile(series, L, valueAt) {
  const win = EXT.pctileTrailingSessions, minN = EXT.pctileMinSessions;
  const x = valueAt(L);
  if (x == null) return null;
  const vals = [];
  for (let m = Math.max(0, L - win + 1); m <= L; m++) { const v = valueAt(m); if (v != null) vals.push(v); }
  return vals.length >= minN ? pctileRank(vals, x) : null;
}

// ── Relative momentum vs a benchmark series (§4.4, daily part) ───────────────

/** Return over n sessions ending at own index L, minus the benchmark's return between the SAME dates. */
export function relReturn(series, bench, L, n) {
  const own = L - n >= 0 ? retOver(series.aClose, L, n) : null;
  const b = benchRetBetween(series, bench, L, n);
  return own != null && b != null ? own - b : null;
}

/** Beta over the trailing betaDays paired daily returns (exact date matches; ≥ 2/3 pairs required). */
export function betaAt(series, bench, L, days) {
  if (!bench || L - days < 0) return null;
  const xs = [], ys = [];
  for (let m = L - days + 1; m <= L; m++) {
    const b1 = bench.dateIndex.get(series.dates[m]), b0 = bench.dateIndex.get(series.dates[m - 1]);
    if (b1 == null || b0 == null || b1 !== b0 + 1) continue; // require consecutive bench sessions
    ys.push(series.aClose[m] / series.aClose[m - 1] - 1);
    xs.push(bench.aClose[b1] / bench.aClose[b0] - 1);
  }
  if (xs.length < Math.ceil((2 / 3) * days)) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0;
  for (let k = 0; k < xs.length; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; }
  return sxx > 0 ? sxy / sxx : null;
}

export function relativeMomentumAt(series, spy, sector, i) {
  const L = i - 1;
  const out = {};
  for (const n of REL.returnsVsSpyDays) out[`ret_${n}d_vs_spy`] = L >= 0 ? relReturn(series, spy, L, n) : null;
  for (const n of REL.returnsVsSectorDays) out[`ret_${n}d_vs_sector`] = L >= 0 ? relReturn(series, sector, L, n) : null;
  out.beta_60d = L >= 0 ? betaAt(series, spy, L, REL.betaAdjustedExcess.betaDays) : null;
  const r20 = L >= 0 ? retOver(series.aClose, L, 20) : null;
  const spy20 = L >= 0 ? benchRetBetween(series, spy, L, 20) : null; // same exact-date guard as relReturn
  out.beta_adj_excess_20d = (out.beta_60d != null && r20 != null && spy20 != null) ? r20 - out.beta_60d * spy20 : null;
  return out;
}

// ── Leg lifecycle & extension (§4.7; Addendum §A4) ───────────────────────────

/**
 * current_leg_origin at prefix end L, direction 'up'|'down' (support→up, resistance→down).
 * Single forward fold implementing config trend.currentLegOrigin exactly:
 *  - candidates = confirmed fractal swings (k, confirmed when idx+k ≤ m);
 *  - a candidate QUALIFIES when price advances ≥ minAdvanceAtr·ATR beyond it (close-based);
 *  - INVALIDATION: a daily close beyond the origin extreme kills the leg;
 *  - DEEP-PULLBACK RESET: a swing retracing > deepPullbackResetPct% of the leg gain that then
 *    advances ≥ minAdvanceAtr·ATR fresh becomes the new origin (shallow swings never move it);
 *  - SIDEWAYS RESET: last sidewaysResetSessions sessions inside a sidewaysResetBandAtr·ATR band
 *    (and the origin predates the band) ends the leg;
 *  - multiple qualifying → most recent wins.
 * Returns { originIdx, originPrice, legExtreme } or null.
 */
export function legOriginAt(series, L, dir) {
  const k = LEG.swingFractalK, up = dir === 'up';
  if (L < k) return null;
  const price = up ? series.aLow : series.aHigh;
  const isSwing = up ? series.isSwingLow : series.isSwingHigh;
  const beyond = (a, b) => (up ? a < b : a > b);              // adverse to the leg
  const advanced = (close, p, atr) => atr != null && (up ? close - p : p - close) >= LEG.minAdvanceAtr * atr;

  let origin = null;            // {idx, price}
  let legExtreme = null;        // max favorable extreme since origin (aHigh for up)
  let cands = [];               // fresh-leg / deep-pullback candidates: {idx, price, resetOk}

  for (let m = 0; m <= L; m++) {
    const close = series.aClose[m], atr = series.atr[m];
    // 1) a swing confirms today (its full fractal window is inside the prefix)
    const j = m - k;
    if (j >= k && isSwing[j]) {
      let resetOk = origin == null; // with no leg, any swing may found one
      if (origin != null && j > origin.idx) {
        const ext = up ? series.maxHighTable.query(origin.idx, j) : series.minLowTable.query(origin.idx, j);
        const gain = up ? ext - origin.price : origin.price - ext;
        const retrace = gain > 0 ? (up ? ext - price[j] : price[j] - ext) / gain : 0;
        resetOk = retrace > LEG.deepPullbackResetPct / 100;   // shallow pullbacks never move the origin
      }
      cands.push({ idx: j, price: price[j], resetOk });
    }
    // 2) advance today's close through candidates & origin
    cands = cands.filter((c) => !beyond(close, c.price));     // a close beyond a candidate kills it
    for (const c of cands) {
      if (c.resetOk && c.idx !== (origin && origin.idx) && advanced(close, c.price, atr)) {
        if (origin == null || c.idx > origin.idx) {           // most recent wins
          origin = { idx: c.idx, price: c.price };
          legExtreme = up ? series.maxHighTable.query(c.idx, m) : series.minLowTable.query(c.idx, m);
        }
      }
    }
    if (origin != null) {
      if (beyond(close, origin.price)) { origin = null; legExtreme = null; } // invalidation
      else legExtreme = up ? Math.max(legExtreme ?? -Infinity, series.aHigh[m]) : Math.min(legExtreme ?? Infinity, series.aLow[m]);
    }
    // 3) sideways reset: the trailing band ends a stale leg
    const w = LEG.sidewaysResetSessions;
    if (origin != null && m >= w - 1 && origin.idx < m - w + 1 && atr != null) {
      const band = series.maxHighTable.query(m - w + 1, m) - series.minLowTable.query(m - w + 1, m);
      if (band <= LEG.sidewaysResetBandAtr * atr) {
        origin = null; legExtreme = null;
        cands = cands.filter((c) => c.idx >= m - w + 1);      // the ended leg cannot restart from before the band
        for (const c of cands) c.resetOk = true;              // fresh-leg search
      }
    }
  }
  return origin ? { originIdx: origin.idx, originPrice: origin.price, legExtreme } : null;
}

/** primary_trend_origin: EARLIEST valid swing in the lookback with a ≥ minAdvanceAtr·ATR advance. */
export function primaryOriginAt(series, L, dir) {
  const k = LEG.swingFractalK, up = dir === 'up';
  const price = up ? series.aLow : series.aHigh;
  const isSwing = up ? series.isSwingLow : series.isSwingHigh;
  const lo = Math.max(k, L - PRIMARY.lookbackSessions);
  for (let j = lo; j <= L - k; j++) {
    if (!isSwing[j]) continue;
    let ok = false, valid = true;
    for (let m = j + 1; m <= L; m++) {
      const adv = up ? series.aClose[m] - price[j] : price[j] - series.aClose[m];
      if (up ? series.aClose[m] < price[j] : series.aClose[m] > price[j]) { valid = false; break; }
      if (series.atr[m] != null && adv >= PRIMARY.minAdvanceAtr * series.atr[m]) ok = true;
    }
    if (ok && valid) return { originIdx: j, originPrice: price[j] };
  }
  return null;
}

/** base_count: maximal ≥minSessions runs inside a bandAtr·ATR band after the leg advanced ≥afterLegAtr·ATR. */
export function baseCountAt(series, L, leg, dir) {
  if (!leg) return null;
  const up = dir === 'up';
  let count = 0, runStart = -1, runHi = -Infinity, runLo = Infinity, advanced = false;
  const closeRun = (end) => { if (runStart >= 0 && end - runStart + 1 >= BASE.minSessions) count += 1; };
  for (let m = leg.originIdx + 1; m <= L; m++) {
    const adv = up ? series.aClose[m] - leg.originPrice : leg.originPrice - series.aClose[m];
    if (series.atr[m] != null && adv >= BASE.afterLegAtr * series.atr[m]) advanced = true;
    if (!advanced) continue;                                   // bases only count once the leg exists
    const atrRef = series.atr[runStart >= 0 ? runStart : m];
    const hi = Math.max(runHi, series.aHigh[m]), lo = Math.min(runLo, series.aLow[m]);
    if (runStart >= 0 && atrRef != null && hi - lo <= BASE.bandAtr * atrRef) { runHi = hi; runLo = lo; }
    else { closeRun(m - 1); runStart = m; runHi = series.aHigh[m]; runLo = series.aLow[m]; }
  }
  closeRun(L);
  return count;
}

/** Sign-normalized extension + own-history percentile + bucket (§A4.2). One window loop: trailingPctile. */
export function extensionAt(series, i, side) {
  const L = i - 1;
  const nul = { extension_in_trend_direction_atr: null, extension_pctile: null, extension_bucket: null };
  if (L < 0) return nul;
  const sgn = side === 'support' ? 1 : -1;
  const valueAt = (m) => {
    const sma = smaAt(series.aClose, m, EXT.maPeriod);
    return (sma != null && series.atr[m]) ? (sgn * (series.aClose[m] - sma)) / series.atr[m] : null;
  };
  const x = valueAt(L);
  if (x == null) return nul;
  const p = trailingPctile(series, L, valueAt);
  if (p == null) return { ...nul, extension_in_trend_direction_atr: x };
  const bucket = p < 50 ? 'NOT_EXT' : p > 85 ? 'EXT' : 'MID'; // config trend.extension.buckets
  return { extension_in_trend_direction_atr: x, extension_pctile: p, extension_bucket: bucket };
}

// ── Move origin & earnings (§4.8; Addendum §A5) ──────────────────────────────

/** Map earnings report dates → session indices (first session ≥ report date). Sorted, deduped. */
export function reportSessionIdxs(series, reportDates) {
  const out = [];
  for (const d of [...reportDates].sort()) {
    const at = idxBefore(series, d, true);
    const idx = (at >= 0 && series.dates[at] === d) ? at : at + 1; // first session ≥ d
    if (idx < series.n && (out.length === 0 || out[out.length - 1] !== idx)) out.push(idx);
  }
  return out;
}

export function moveOriginAt(series, L, leg, reports) {
  if (!leg) return null; // config catalyst.originClass.nullWhenLegOriginNull
  const oc = CAT.originClass;
  const end = Math.min(leg.originIdx + oc.EARNINGS_GAP.atLegOriginOrFirstNSessions, L);
  for (let m = Math.max(1, leg.originIdx); m <= end; m++) {
    if (series.atr[m - 1] == null) continue;
    if (Math.abs(series.aOpen[m] - series.aClose[m - 1]) >= oc.EARNINGS_GAP.gapMinAtr * series.atr[m - 1]) {
      const near = reports.some((r) => Math.abs(r - m) <= oc.EARNINGS_GAP.earningsWithinSessions);
      return near ? 'EARNINGS_GAP' : 'NON_EARNINGS_GAP';
    }
  }
  return 'NO_GAP';
}

/** Earnings timing features. Pre_touch uses only reports on sessions ≤ L (S5-C: a same-day report is never assumed known). */
export function earningsAt(series, i, reports) {
  const L = i - 1;
  const known = reports.filter((r) => r <= L);
  const out = { sessions_since_last_earnings: null, sessions_to_expected_earnings: null,
    sessions_to_next_earnings_actual: null, expected_vs_actual_earnings_error: null };
  if (known.length) out.sessions_since_last_earnings = i - known[known.length - 1];
  if (known.length >= CAT.earnings.sessions_to_expected_earnings.minPriorReports) { // ≥2 prior reports → ≥1 gap, else null
    const gaps = [];
    for (let g = 1; g < known.length; g++) gaps.push(known[g] - known[g - 1]);
    gaps.sort((a, b) => a - b);
    const med = gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2;
    out.sessions_to_expected_earnings = known[known.length - 1] + med - i; // signed; negative = overdue
  }
  const next = reports.find((r) => r >= i); // post_touch descriptive — the calendar's CURRENT state
  if (next != null) out.sessions_to_next_earnings_actual = next - i;
  if (out.sessions_to_expected_earnings != null && out.sessions_to_next_earnings_actual != null) {
    out.expected_vs_actual_earnings_error = out.sessions_to_expected_earnings - out.sessions_to_next_earnings_actual;
  }
  return out;
}

/** The full daily-grain feature block for one event. side ∈ {support, resistance}. */
export function dailyFeaturesAt(series, i, side, { spy = null, sector = null, reports = [] } = {}) {
  const L = i - 1;
  const dir = side === 'support' ? 'up' : 'down';
  const leg = L >= 0 ? legOriginAt(series, L, dir) : null;
  const primary = L >= 0 ? primaryOriginAt(series, L, dir) : null;
  // S5 review fix: move_origin is pre_touch — it may only see reports on sessions ≤ L. Without
  // this filter, an event-day report next to a fresh gap would reclassify it EARNINGS_GAP using
  // information not knowable at the prior close (earningsAt filters internally; this call must too).
  const knownReports = reports.filter((r) => r <= L);
  return {
    ...higherTfAt(series, i),
    ...relativeMomentumAt(series, spy, sector, i),
    ...extensionAt(series, i, side),
    current_leg_origin_date: leg ? series.dates[leg.originIdx] : null,
    primary_trend_origin_date: primary ? series.dates[primary.originIdx] : null,
    base_count: L >= 0 ? baseCountAt(series, L, leg, dir) : null,
    move_origin: L >= 0 ? moveOriginAt(series, L, leg, knownReports) : null,
    ...earningsAt(series, i, reports),
  };
}
