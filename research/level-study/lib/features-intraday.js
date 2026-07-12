// research/level-study/lib/features-intraday.js
//
// LevelStory Session 5 — intraday pre_touch features (parent §8.2/§8.3; Addendum §A3.3, §A2.3).
//
// THE TOUCH-BAR RULE (S5 §3.2, the study's most likely leak point): touchAt is the touch bar's
// open label, but the touch bar's OHLCV is only observable at its CLOSE — after the touch. So no
// feature here reads any bar at or after the touch bar. The boundary is ONE line: preBars =
// bars.filter(etMinutes < touchEtMin). The leak test (tests/26 §6.1) proves a monster touch bar
// changes nothing. ETF direction tags additionally require the ETF bar to be FULLY COMPLETED
// strictly before touchAt (its window must not contain the touch — §3.4).
//
// Null-never-zero throughout. Zero product imports; imports ../config.js only.

import CONFIG from '../config.js';

const FP = CONFIG.features.fingerprint;
const TOD = FP.todBucketEtCutoffs;                 // {open:[570,630], midday:[630,870], power:[870,960]}
const GAP_ATR = FP.gap_context.thresholdAtr;       // 0.3
const RVOL_DAYS = CONFIG.hourlyClass.rvolOverlay.baselineDays; // 20 trailing sessions
const OR_MIN = CONFIG.features.momentumQuality.openingRangeMinutes; // 30

const BAR_MIN = 5;

/** The availability slice — the only place the boundary is drawn. */
export function preTouchBars(sessionBars, touchEtMin) {
  return (sessionBars || []).filter((b) => b.etMinutes < touchEtMin);
}

export function todBucket(touchEtMin) {
  for (const [name, [lo, hi]] of Object.entries(TOD)) if (touchEtMin >= lo && touchEtMin < hi) return name;
  return null;
}

/** Cumulative session volume through bars with etMinutes < cutoff (null volume = no trades = 0). */
function cumVolBefore(bars, cutoff) {
  let s = 0;
  for (const b of bars) { if (b.etMinutes >= cutoff) break; s += b.volume ?? 0; }
  return s;
}

/**
 * rvol_approach: cumulative pre-touch volume ÷ time-of-day-matched trailing-20-session average.
 * Baselines are cut at the SAME etMinutes cutoff — 10am volume never compares against 1pm volume.
 * Null unless all RVOL_DAYS baseline sessions exist with a positive average.
 */
export function rvolApproach(preBars, touchEtMin, baselineSessions) {
  if (!preBars.length || !baselineSessions || baselineSessions.length < RVOL_DAYS) return null;
  const own = preBars.reduce((a, b) => a + (b.volume ?? 0), 0);
  const cuts = baselineSessions.slice(-RVOL_DAYS).map((s) => cumVolBefore(s.regular || [], touchEtMin));
  const avg = cuts.reduce((a, b) => a + b, 0) / cuts.length;
  return avg > 0 ? own / avg : null;
}

// Load-time coherence assert (mirrors config validateGeometry's philosophy): the bucket edges are
// stored as [lo, hi) pairs — a half-applied founder edit must throw here, never run silently.
{
  const B = FP.rvolApproachBuckets;
  if (B.LOW[1] !== B.MID[0] || B.MID[1] !== B.HIGH[0]) {
    throw new Error(`config rvolApproachBuckets edges are not adjacent: LOW ${JSON.stringify(B.LOW)} MID ${JSON.stringify(B.MID)} HIGH ${JSON.stringify(B.HIGH)}`);
  }
}

export function rvolBucket(rvol) {
  if (rvol == null) return null;
  const B = FP.rvolApproachBuckets;
  if (rvol < B.MID[0]) return 'LOW';
  if (rvol < B.HIGH[0]) return 'MID';
  return 'HIGH';
}

/** §4.1 fingerprint + §4.2 momentum quality, all from preBars only. */
export function intradayFeatures({ sessionBars, touchEtMin, prevSessionCloseAdj, atrDaily, side, baselineSessions, probesBeforeTouch = 0 }) {
  const pre = preTouchBars(sessionBars, touchEtMin);
  const atr = atrDaily || null;
  const out = {
    approach_velocity: null, rvol_approach: null, vwap_side: null, vwap_dist: null, consol_tightness: null,
    tod_bucket: todBucket(touchEtMin), gap_context: null,
    path_efficiency: null, accel_final_30m: null, pullback_depth_max: null, hl_progression: null,
    dist_from_opening_range: null, dist_from_session_extreme: null,
    prior_probe_count: probesBeforeTouch, // S5-C: structurally 0 under the S4 episode model (touchAt = first entry) — see rulings
    vol_slope_into_touch: null,
  };
  // Uniform touch-bar rule (S5-C): NO field of the touch bar is ever read — not even its open or
  // timestamp-adjacent prints. A touch on the session's first bar therefore nulls every intraday
  // feature (gap_context included): there is no pre-touch bar to compute from.
  if (!pre.length || atr == null) return out;
  const closes = pre.map((b) => b.adjClose);
  const last = pre[pre.length - 1], lastC = last.adjClose, lastEt = last.etMinutes;

  // approach_velocity — ATR/hr over the 90 minutes into the touch (full span required, else null).
  const ref = [...pre].reverse().find((b) => b.etMinutes <= lastEt - 90);
  out.approach_velocity = ref ? (lastC - ref.adjClose) / atr / ((lastEt - ref.etMinutes) / 60) : null;

  out.rvol_approach = rvolApproach(pre, touchEtMin, baselineSessions);

  // session VWAP over pre-touch bars (HLC3-weighted, matching the daily basis convention)
  let tpw = 0, w = 0;
  for (const b of pre) { const v = b.volume ?? 0; tpw += ((b.adjHigh + b.adjLow + b.adjClose) / 3) * v; w += v; }
  if (w > 0) {
    const vwap = tpw / w;
    out.vwap_side = lastC > vwap ? 'above' : lastC < vwap ? 'below' : 'at';
    out.vwap_dist = (lastC - vwap) / atr;
  }

  // consol_tightness — 60-minute pre-touch range in ATR (full 12-bar window required)
  const win60 = pre.filter((b) => b.etMinutes > lastEt - 60);
  if (win60.length === 60 / BAR_MIN) {
    out.consol_tightness = (Math.max(...win60.map((b) => b.adjHigh)) - Math.min(...win60.map((b) => b.adjLow))) / atr;
  }

  out.gap_context = gapContext(pre, prevSessionCloseAdj, atr, side);

  // path_efficiency — net ÷ total movement, session open → last pre-touch close
  if (pre.length >= 2) {
    const open0 = pre[0].adjOpen;
    let total = Math.abs(closes[0] - open0);
    for (let i = 1; i < closes.length; i++) total += Math.abs(closes[i] - closes[i - 1]);
    out.path_efficiency = total > 0 ? Math.abs(lastC - open0) / total : null;
  }

  // accel_final_30m — final-30m velocity minus the prior 30m's, ATR/hr (13 closes required)
  if (closes.length >= 13) {
    const c = closes.length - 1;
    const v2 = (closes[c] - closes[c - 6]) / atr / 0.5;
    const v1 = (closes[c - 6] - closes[c - 12]) / atr / 0.5;
    out.accel_final_30m = v2 - v1;
  }

  // pullback_depth_max — deepest counter-move against the session's net direction, ATR
  if (closes.length >= 3) {
    const dirUp = lastC > pre[0].adjOpen;
    let ext = closes[0], depth = 0;
    for (const c of closes) {
      if (dirUp) { ext = Math.max(ext, c); depth = Math.max(depth, ext - c); }
      else { ext = Math.min(ext, c); depth = Math.max(depth, c - ext); }
    }
    out.pullback_depth_max = lastC !== pre[0].adjOpen ? depth / atr : null;
  }

  // hl_progression — net share of bars stepping higher-high+higher-low vs lower-low+lower-high
  if (pre.length >= 2) {
    let up = 0, dn = 0;
    for (let i = 1; i < pre.length; i++) {
      if (pre[i].adjHigh > pre[i - 1].adjHigh && pre[i].adjLow > pre[i - 1].adjLow) up += 1;
      else if (pre[i].adjHigh < pre[i - 1].adjHigh && pre[i].adjLow < pre[i - 1].adjLow) dn += 1;
    }
    out.hl_progression = (up - dn) / (pre.length - 1);
  }

  // dist_from_opening_range — signed ATR distance from the nearest OR30 boundary (+ outside / − inside);
  // null until the full opening range is pre-touch (a touch inside the first 30m has no OR30 yet).
  const sessFirstEt = pre[0].etMinutes; // == session first bar when pre-touch (touch-on-first-bar already returned)
  {
    const orBars = pre.filter((b) => b.etMinutes < sessFirstEt + OR_MIN);
    if (orBars.length === OR_MIN / BAR_MIN && lastEt >= sessFirstEt + OR_MIN) {
      const orHi = Math.max(...orBars.map((b) => b.adjHigh)), orLo = Math.min(...orBars.map((b) => b.adjLow));
      out.dist_from_opening_range = lastC > orHi ? (lastC - orHi) / atr
        : lastC < orLo ? (orLo - lastC) / atr
          : -Math.min(orHi - lastC, lastC - orLo) / atr;
    }
  }

  // dist_from_session_extreme — how far price has traveled from the approach-origin extreme
  out.dist_from_session_extreme = side === 'support'
    ? (Math.max(...pre.map((b) => b.adjHigh)) - lastC) / atr
    : (lastC - Math.min(...pre.map((b) => b.adjLow))) / atr;

  // vol_slope_into_touch — mean volume of the final 30m over the prior 30m, minus 1
  if (pre.length >= 12) {
    const v = pre.map((b) => b.volume ?? 0);
    const m2 = v.slice(-6).reduce((a, b) => a + b, 0) / 6;
    const m1 = v.slice(-12, -6).reduce((a, b) => a + b, 0) / 6;
    out.vol_slope_into_touch = m1 > 0 ? m2 / m1 - 1 : null;
  }

  return out;
}

function gapContext(preBars, prevClose, atr, side) {
  if (!preBars || !preBars.length || prevClose == null || !atr) return null;
  const g = (preBars[0].adjOpen - prevClose) / atr;
  if (Math.abs(g) < GAP_ATR) return 'none';
  const toward = side === 'support' ? g < 0 : g > 0;
  return toward ? 'toward' : 'away';
}

/**
 * §3.4 / Addendum §A2.3 — direction tag from the last FULLY COMPLETED ETF 5-min bar strictly
 * before touchAt: the bar's window must end at or before the touch (etMinutes + 5 ≤ touchEtMin).
 * A bar whose window contains touchAt closes after the touch and is never used.
 */
export function etfDirectionAtTouch(etfSessionBars, touchEtMin, etfPrevCloseAdj) {
  if (!etfSessionBars || !etfSessionBars.length || etfPrevCloseAdj == null) return null;
  let lastDone = null;
  for (const b of etfSessionBars) { if (b.etMinutes + BAR_MIN <= touchEtMin) lastDone = b; else break; }
  if (!lastDone) return null;
  return lastDone.adjClose > etfPrevCloseAdj ? 'UP' : lastDone.adjClose < etfPrevCloseAdj ? 'DOWN' : 'FLAT';
}
