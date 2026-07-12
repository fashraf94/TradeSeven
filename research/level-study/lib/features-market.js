// research/level-study/lib/features-market.js
//
// LevelStory Session 5 — regime & breadth (Addendum §A3.1–A3.2) and group confirmation (§A2.1).
//
// Universe-internal context, computed ONCE per session date from data through the PRIOR session's
// close (the §3.3 D−1 rule), then read by every symbol's events. At 11 symbols the momentum
// deciles are 1 name each — the meter is built correctly, computed, tagged, and REPORTED AS NOT
// TRUSTWORTHY at this scale (the second concrete input to the universe-expansion decision).
// Null-never-zero; zero product imports.

import CONFIG from '../config.js';
import { idxBefore, pctileRank } from './features-daily.js';

const REG = CONFIG.regime;
const BR = CONFIG.features.market.breadth;
const GRP = CONFIG.features.group;

function retOver(series, end, n) {
  if (end - n < 0 || end >= series.n) return null;
  const a = series.aClose[end - n], b = series.aClose[end];
  return a > 0 ? b / a - 1 : null;
}

/** Return over n sessions ending at own idx, minus SPY between the same dates. Null-safe. */
function relSpyRet(series, spy, end, n) {
  const own = retOver(series, end, n);
  if (own == null || !spy) return null;
  const b1 = idxBefore(spy, series.dates[end], true), b0 = idxBefore(spy, series.dates[end - n], true);
  if (b1 < 0 || b0 < 0 || b1 <= b0) return null;
  const spyR = spy.aClose[b1] / spy.aClose[b0] - 1;
  return own - spyR;
}

/**
 * Build the per-session market context for every date in `sessionDates` (the master calendar).
 * members: [{symbol, sector, series}] — the study universe with prebuilt daily series.
 * Context at date D uses each series only through its last index with date < D.
 */
export function buildMarketContext({ sessionDates, members, spy, sphb, splv }) {
  const n = members.length;
  const spreadHist = new Map(); // date -> {neutral, raw}
  const out = new Map();

  const spreadAt = (t) => {
    // Addendum §A3.1: at formation F = T−rank sessions back, rank members on trailing
    // lookbackReturnDays return vs SPY (sector-neutral = demeaned by sector group), then measure
    // each basket's rel-SPY return over the spreadWindowSessions since formation.
    const F = t - 21; // rankAt 'T-21'
    if (F < 0) return { neutral: null, raw: null };
    const fDate = sessionDates[F], tDate = sessionDates[t];
    const rows = [];
    for (const m of members) {
      const fIdx = idxBefore(m.series, fDate);           // strictly before formation date
      const tIdx = idxBefore(m.series, tDate);           // strictly before D
      if (fIdx < 0 || tIdx <= fIdx) continue;
      const rank = relSpyRet(m.series, spy, fIdx, REG.momoSpread.lookbackReturnDays);
      const relF = relSpyRet(m.series, spy, tIdx, tIdx - fIdx); // basket performance since formation, vs SPY
      if (rank == null || relF == null) continue;
      rows.push({ sector: m.sector, rank, perf: relF });
    }
    if (rows.length < Math.max(4, Math.floor(n / 2))) return { neutral: null, raw: null };
    const bySector = new Map();
    for (const r of rows) { if (!bySector.has(r.sector)) bySector.set(r.sector, []); bySector.get(r.sector).push(r.rank); }
    const secMean = new Map([...bySector].map(([s, v]) => [s, v.reduce((a, b) => a + b, 0) / v.length]));
    const dec = Math.max(1, Math.floor(rows.length * REG.momoSpread.decileFraction));
    const spreadOf = (keyFn) => {
      const ranked = [...rows].sort((a, b) => keyFn(b) - keyFn(a) || (a.sector < b.sector ? -1 : 1));
      const top = ranked.slice(0, dec), bot = ranked.slice(-dec);
      const avg = (g) => g.reduce((a, r) => a + r.perf, 0) / g.length;
      return (avg(top) - avg(bot)) * 100; // pct
    };
    return { neutral: spreadOf((r) => r.rank - secMean.get(r.sector)), raw: spreadOf((r) => r.rank) };
  };

  for (let t = 0; t < sessionDates.length; t++) {
    const D = sessionDates[t];
    const ctx = {
      date: D,
      sector_neutral_momo_spread_20d: null, raw_momo_spread_20d: null, momo_regime: null,
      breadth_pct_above_20dma: null, breadth_pct_above_50dma: null, nh_nl_net_63d: null,
      beta_appetite_20d: null, vol_regime_pctile: null, universeSize: n,
    };

    // momentum spread + regime (with the 81-session spin-up: regime null until enough history)
    const s = spreadAt(t);
    spreadHist.set(D, s);
    ctx.sector_neutral_momo_spread_20d = s.neutral;
    ctx.raw_momo_spread_20d = s.raw;
    if (s.neutral != null && t >= REG.warmupSpinupSessions) {
      const prev = spreadHist.get(sessionDates[t - REG.states.MOMO_ON.slopeSessions]);
      // 1e-9 epsilon: a mathematically-flat spread must satisfy "slope ≥ 0" despite float noise
      const slopeOk = prev && prev.neutral != null ? s.neutral - prev.neutral >= REG.states.MOMO_ON.slopeMin - 1e-9 : false;
      ctx.momo_regime = s.neutral >= REG.states.MOMO_ON.spreadMinPct && slopeOk ? 'MOMO_ON'
        : s.neutral <= REG.states.MOMO_OFF.spreadMaxPct ? 'MOMO_OFF' : 'NEUTRAL';
    }

    // breadth (each member read at its own last index strictly before D)
    let n20 = 0, a20 = 0, n50 = 0, a50 = 0, nh = 0, nl = 0, nhnlCounted = 0;
    for (const m of members) {
      const idx = idxBefore(m.series, D);
      if (idx < 0) continue;
      const smaOf = (p) => {
        if (idx - p + 1 < 0) return null;
        let acc = 0; for (let q = idx - p + 1; q <= idx; q++) acc += m.series.aClose[q];
        return acc / p;
      };
      const s20 = smaOf(BR.pctAboveMa[0]), s50 = smaOf(BR.pctAboveMa[1]);
      if (s20 != null) { n20 += 1; if (m.series.aClose[idx] > s20) a20 += 1; }
      if (s50 != null) { n50 += 1; if (m.series.aClose[idx] > s50) a50 += 1; }
      const w = BR.nhNlNetDays;
      if (idx - w >= 0) {
        nhnlCounted += 1;
        if (m.series.aHigh[idx] > m.series.maxHighTable.query(idx - w, idx - 1)) nh += 1;
        if (m.series.aLow[idx] < m.series.minLowTable.query(idx - w, idx - 1)) nl += 1;
      }
    }
    if (n20 >= Math.ceil(n / 2)) ctx.breadth_pct_above_20dma = (a20 / n20) * 100;
    if (n50 >= Math.ceil(n / 2)) ctx.breadth_pct_above_50dma = (a50 / n50) * 100;
    if (nhnlCounted >= Math.ceil(n / 2)) ctx.nh_nl_net_63d = nh - nl;

    // beta appetite: SPHB − SPLV 20-day return spread (daily grain per F4)
    if (sphb && splv) {
      const hi = idxBefore(sphb, D), lo = idxBefore(splv, D);
      const rh = hi >= 0 ? retOver(sphb, hi, 20) : null, rl = lo >= 0 ? retOver(splv, lo, 20) : null;
      if (rh != null && rl != null) ctx.beta_appetite_20d = (rh - rl) * 100;
    }

    // vol regime: SPY 20-day realized vol percentile vs trailing 2 years
    if (spy) {
      const idx = idxBefore(spy, D);
      const rv = (m) => {
        if (m - BR.volRegimePctile.spyRealizedVolDays < 0) return null;
        const rets = [];
        for (let q = m - BR.volRegimePctile.spyRealizedVolDays + 1; q <= m; q++) rets.push(spy.aClose[q] / spy.aClose[q - 1] - 1);
        const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
        return Math.sqrt(rets.reduce((a, b) => a + (b - mu) ** 2, 0) / rets.length);
      };
      const win = BR.volRegimePctile.trailingYears * 252;
      const x = idx >= 0 ? rv(idx) : null;
      if (x != null) {
        const vals = [];
        for (let m = Math.max(0, idx - win + 1); m <= idx; m++) { const v = rv(m); if (v != null) vals.push(v); }
        if (vals.length >= 252) ctx.vol_regime_pctile = pctileRank(vals, x);
      }
    }

    out.set(D, ctx);
  }
  return out;
}

// ── Group confirmation (Addendum §A2.1) ──────────────────────────────────────

/**
 * Peer features for one event. peers: [{symbol, series, events}] — same-sector universe members
 * (excluding self) with data coverage at D. All rate features are null when the eligible peer
 * count is below minEligiblePeers (5) — at 11 symbols this is nearly always, BY DESIGN: the null
 * condition doing its job is the expansion evidence, reported per feature.
 */
export function groupFeaturesAt({ series, i, peers, spy, sector }) {
  const D = series.dates[i];
  const out = {
    eligible_peer_count: peers.length,
    peer_level_event_rate_prior_5d: null,
    peer_fresh_extreme_rate_prior_5d: null,
    peer_confirmations_same_session_before_touch: null, // S6 STUB — confirmationAt does not exist yet (recorded)
    rs_rank_in_group: null,
    sector_rs_vs_spy_20d: null, sector_rs_vs_spy_60d: null,
    peer_level_event_rate_next_5d: null,                // post_touch, descriptive-only
  };
  // sector-vs-SPY RS needs the sector ETF (only XLK/XLE carry data in the frozen probe — nulls elsewhere)
  if (sector && spy) {
    const sIdx = idxBefore(sector, D);
    if (sIdx >= 0) {
      out.sector_rs_vs_spy_20d = relSpyRet(sector, spy, sIdx, 20);
      out.sector_rs_vs_spy_60d = relSpyRet(sector, spy, sIdx, 60);
    }
  }
  if (peers.length < GRP.minEligiblePeers) return out;

  const prior = series.dates.slice(Math.max(0, i - 5), i);           // D−5..D−1 (own calendar)
  const next = series.dates.slice(i + 1, i + 6);                     // D+1..D+5 (post_touch)
  const inWindow = (ev, win) => ev.disposition === 'touch' && win.includes(ev.eventDate);
  let hitPrior = 0, hitNext = 0, hitExtreme = 0;
  for (const p of peers) {
    if ((p.events || []).some((ev) => inWindow(ev, prior))) hitPrior += 1;
    if ((p.events || []).some((ev) => inWindow(ev, next))) hitNext += 1;
    const w = GRP.peer_fresh_extreme_rate_prior_5d.freshExtremeDays; // 63
    let fresh = false;
    for (const d of prior) {
      const idx = p.series.dateIndex.get(d);
      if (idx == null || idx - w < 0) continue;
      if (p.series.aHigh[idx] > p.series.maxHighTable.query(idx - w, idx - 1)
        || p.series.aLow[idx] < p.series.minLowTable.query(idx - w, idx - 1)) { fresh = true; break; }
    }
    if (fresh) hitExtreme += 1;
  }
  out.peer_level_event_rate_prior_5d = hitPrior / peers.length;
  out.peer_fresh_extreme_rate_prior_5d = hitExtreme / peers.length;
  out.peer_level_event_rate_next_5d = next.length === 5 ? hitNext / peers.length : null;

  // rs_rank_in_group: own trailing-20d return ranked among self + peers (1 = strongest)
  const L = i - 1;
  const own = L >= 20 ? series.aClose[L] / series.aClose[L - 20] - 1 : null;
  if (own != null) {
    let stronger = 0, counted = 0;
    for (const p of peers) {
      const idx = idxBefore(p.series, D);
      if (idx < 20) continue;
      counted += 1;
      if (p.series.aClose[idx] / p.series.aClose[idx - 20] - 1 > own) stronger += 1;
    }
    if (counted >= GRP.minEligiblePeers) out.rs_rank_in_group = stronger + 1;
  }
  return out;
}
