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
import { idxBefore, pctileRank, retOver, relReturn } from './features-daily.js';

const REG = CONFIG.regime;
const BR = CONFIG.features.market.breadth;
const GRP = CONFIG.features.group;
// rankAt is registered as the string 'T-21' — parse the offset once (S5 review fix: previously hardcoded).
const RANK_BACK = Number((String(REG.momoSpread.rankAt).match(/\d+/) || [21])[0]);
const SPREAD_WIN = REG.momoSpread.spreadWindowSessions; // 20 — the pre-registered measurement window

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
    // Addendum §A3.1: rank members at formation F = T−RANK_BACK on the trailing
    // lookbackReturnDays return vs SPY (as of F's prior close — point-in-time), then measure each
    // basket's rel-SPY return over the pre-registered SPREAD_WIN sessions ending at D−1.
    // (S5 review fix: the window is exactly spreadWindowSessions — previously 21 and hardcoded.)
    const F = t - RANK_BACK;
    if (F < 0) return { neutral: null, raw: null };
    const fDate = sessionDates[F], tDate = sessionDates[t];
    const rows = [];
    for (const m of members) {
      const fIdx = idxBefore(m.series, fDate);           // strictly before the formation date
      const tIdx = idxBefore(m.series, tDate);           // strictly before D
      if (fIdx < 0 || tIdx <= fIdx) continue;
      const rank = relReturn(m.series, spy, fIdx, REG.momoSpread.lookbackReturnDays);
      const perf = relReturn(m.series, spy, tIdx, SPREAD_WIN); // basket performance, rel-SPY, 20 sessions to D−1
      if (rank == null || perf == null) continue;
      rows.push({ symbol: m.symbol, sector: m.sector, rank, perf });
    }
    if (rows.length < Math.max(4, Math.floor(n / 2))) return { neutral: null, raw: null };
    const bySector = new Map();
    for (const r of rows) { if (!bySector.has(r.sector)) bySector.set(r.sector, []); bySector.get(r.sector).push(r.rank); }
    const secMean = new Map([...bySector].map(([s, v]) => [s, v.reduce((a, b) => a + b, 0) / v.length]));
    const dec = Math.max(1, Math.floor(rows.length * REG.momoSpread.decileFraction));
    const spreadOf = (keyFn) => {
      // ties (e.g. singleton sectors demeaned to exactly 0) break by RAW momentum, then symbol —
      // never by sector spelling (S5 review fix).
      const ranked = [...rows].sort((a, b) => keyFn(b) - keyFn(a) || b.rank - a.rank || (a.symbol < b.symbol ? -1 : 1));
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
      const rh = hi >= 0 ? retOver(sphb.aClose, hi, 20) : null, rl = lo >= 0 ? retOver(splv.aClose, lo, 20) : null;
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
      out.sector_rs_vs_spy_20d = relReturn(sector, spy, sIdx, 20);
      out.sector_rs_vs_spy_60d = relReturn(sector, spy, sIdx, 60);
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
  // A truncated prior window is uncomputable, not a 0-rate (review fix; mirrors the next_5d guard).
  out.peer_level_event_rate_prior_5d = prior.length === 5 ? hitPrior / peers.length : null;
  out.peer_fresh_extreme_rate_prior_5d = prior.length === 5 ? hitExtreme / peers.length : null;
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
