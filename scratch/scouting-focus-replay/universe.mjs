// scratch/scouting-focus-replay/universe.mjs
//
// THROWAWAY measurement harness — synthetic universe generator.
// NOT production. NOT shipped. Read-mostly: this file only *builds inputs* for
// the real ranking/screening engine; it never edits the engine.
//
// WHY SYNTHETIC: the real daily universe lives in a SINGLE overwritten Firestore
// doc `indexIntelligence/stockRankings` (api/cron/compute-index-intelligence.js
// :1090). There is no date-keyed history/archive collection, so the system is
// POINT-IN-TIME (today only). In this sandbox there are also no Firebase Admin
// creds (FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY unset) and no in-repo
// fixtures, so even today's doc is unreachable. We therefore synthesize per-stock
// daily METRICS, but keep everything else real: the real symbols + sector
// structure (STOCK_UNIVERSE), and the metric *shape* the cron actually writes
// (compute-index-intelligence.js:993-1040). The ranking + screening run through
// the REAL engine functions. Conclusions are about the MECHANISM over realistic
// inputs, not about any live trading day.

import { STOCK_UNIVERSE } from '../../api/_utils/rankingConfig.js';

// ── seeded PRNG (mulberry32) + standard normal (Box-Muller) ──────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function randn(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ── regimes (approximate multi-state replay; clearly synthetic) ──────────────
// Each regime sets a sector "heat" common factor + market drift + dispersion.
// This is how we test robustness-of-conclusion across market states WITHOUT
// claiming historical data. Sector ids are the real ETF keys in STOCK_UNIVERSE.
const SECTORS = Object.keys(STOCK_UNIVERSE); // XLK, XLV, XLF, ...

export const REGIMES = {
  tech_led_bull:     { heat: { XLK: 1.3, XLC: 1.1, XLY: 0.8, XLP: -0.6, XLU: -0.7, XLRE: -0.5 }, drift: 1.2, dispersion: 1.0, mega: 0 },
  energy_rotation:   { heat: { XLE: 1.3, XLB: 1.0, XLF: 0.9, XLK: -0.9, XLC: -0.7, XLY: -0.4 }, drift: 0.4, dispersion: 1.0, mega: 0 },
  risk_off_defensive:{ heat: { XLP: 0.9, XLU: 0.9, XLV: 0.7, XLRE: 0.5, XLK: -1.0, XLY: -1.0, XLC: -0.7, XLE: -0.5 }, drift: -1.4, dispersion: 1.0, mega: 0 },
  broad_choppy:      { heat: {}, drift: 0.0, dispersion: 1.5, mega: 0 },
  narrow_megacap:    { heat: { XLK: 0.5, XLC: 0.4 }, drift: 0.3, dispersion: 0.8, mega: 0.05 },
};

const cross = (arr, key, asc) => {
  // return a Map symbol->rank (1=best) ranking arr by key
  const sorted = [...arr].sort((a, b) => asc ? (a[key] - b[key]) : (b[key] - a[key]));
  const m = new Map();
  sorted.forEach((s, i) => m.set(s.symbol, i + 1));
  return m;
};

// Build one synthetic daily universe (array of stock rows mirroring the cron shape).
export function genUniverse(regimeName, seed) {
  const regime = REGIMES[regimeName];
  const rng = mulberry32(strHash(`${regimeName}|${seed}`));
  const disp = regime.dispersion;

  const rows = [];
  for (const sectorId of SECTORS) {
    const sector = STOCK_UNIVERSE[sectorId];
    const sH = (regime.heat[sectorId] ?? 0) + randn(rng) * 0.15; // per-state sector jitter
    for (const symbol of sector.stocks) {
      const idioMom = randn(rng) * disp;
      const idioQual = randn(rng);
      const idioVol = randn(rng);
      const mega = (rng() < regime.mega) ? (2.0 + rng() * 2.5) : 0; // narrow-leadership spikes

      // latents
      const momLatent = 0.55 * sH + 0.85 * idioMom + mega;
      const qualLatent = idioQual + 0.15 * idioMom;
      const volLatent = 0.65 * idioVol - 0.25 * qualLatent + 0.20 * Math.abs(momLatent) + 0.10 * mega;

      // scores (0-100) — absolute technical/momentum carry the sector common factor,
      // so a hot-sector mid-pack name can outscore a cold-sector sector-leader: this
      // is what makes raw-technical vs sector-relative a genuine, divergent axis.
      const technicalScore = clamp(50 + 13 * momLatent + 3 * randn(rng), 0, 100);
      const momentumScore  = clamp(50 + 13 * (0.9 * momLatent) + 4 * randn(rng), 0, 100);
      const fundamentalScore = clamp(50 + 13 * qualLatent + 3 * randn(rng), 0, 100);
      const atrPercentile = clamp(1 / (1 + Math.exp(-volLatent)) + (rng() - 0.5) * 0.06, 0.01, 0.99);
      const baggerBombFit = clamp(50 + 9 * momLatent + 30 * (atrPercentile - 0.5) + 6 * randn(rng), 0, 100);

      const r1 = regime.drift + 6 * momLatent + 4 * randn(rng);
      rows.push({
        symbol,
        sectorId,
        sectorName: sector.name,
        industryName: sector.name, // coarse; industry granularity not needed for these focuses
        fundamentalScore: Math.round(fundamentalScore * 10) / 10,
        technicalScore: Math.round(technicalScore * 10) / 10,
        momentumScore: Math.round(momentumScore * 10) / 10,
        atrPercentile: Math.round(atrPercentile * 100) / 100,
        baggerBombFit: Math.round(baggerBombFit * 10) / 10,
        return1W: Math.round((r1 * 0.4 + randn(rng)) * 10) / 10,
        return1M: Math.round(r1 * 10) / 10,
        return3M: Math.round((r1 * 1.8 + 4 * randn(rng)) * 10) / 10,
        returnYTD: Math.round((r1 * 3.0 + 7 * randn(rng)) * 10) / 10,
        return12M: Math.round((r1 * 3.6 + 9 * randn(rng)) * 10) / 10,
        trend: momLatent > 0.3 ? 'up' : (momLatent < -0.3 ? 'down' : 'flat'),
        sma200_position: momLatent > 0 ? 'above' : 'below',
      });
    }
  }

  // sectorTechnicalRank / Total — exactly how the cron computes it
  // (compute-index-intelligence.js:799-802): sort each sector by technicalScore desc.
  const bySector = {};
  for (const r of rows) (bySector[r.sectorId] ||= []).push(r);
  for (const sid of Object.keys(bySector)) {
    const arr = bySector[sid].sort((a, b) => b.technicalScore - a.technicalScore);
    arr.forEach((r, i) => { r.sectorTechnicalRank = i + 1; r.sectorTechnicalTotal = arr.length; });
  }

  // cross-sectional ranks (1 = best)
  const N = rows.length;
  const techRankMap = cross(rows, 'technicalScore', false);
  const fundRankMap = cross(rows, 'fundamentalScore', false);
  const momRankMap  = cross(rows, 'momentumScore', false);
  const fitRankMap  = cross(rows, 'baggerBombFit', false);
  for (const r of rows) {
    r.technicalRank = techRankMap.get(r.symbol);
    r.fundamentalRank = fundRankMap.get(r.symbol);
    r.momentumRank = momRankMap.get(r.symbol);
    r.baggerBombRank = fitRankMap.get(r.symbol);
    // compositeScore mirrors the cron formula (compute-index-intelligence.js:952-953):
    // avg of fundamental percentile and sector-relative technical percentile.
    const fundPct = ((N - r.fundamentalRank) / N) * 100;
    const techPct = ((r.sectorTechnicalTotal - r.sectorTechnicalRank) / r.sectorTechnicalTotal) * 100;
    r.compositeScore = Math.round(((fundPct + techPct) / 2) * 10) / 10;
  }
  return rows;
}

// The set of synthetic market states the sweep replays across.
export function buildStates({ seeds = [1, 2] } = {}) {
  const states = [];
  for (const regime of Object.keys(REGIMES)) {
    for (const seed of seeds) {
      states.push({ id: `${regime}#${seed}`, regime, seed, universe: genUniverse(regime, seed) });
    }
  }
  return states;
}
