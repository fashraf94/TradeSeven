// src/components/League/battleArena/useAtrPercentiles.js
//
// Phase 2.5 (R1) — feed the arena the SAME per-symbol ATR basis banking uses, so
// the live user star cells + orb ride the percentile ATR instead of the port-
// contract preview default (2.5/5.0). Reads the single PUBLIC stockRankings doc
// (firestore.rules: indexIntelligence read:true — the same doc SectorETFRanksTab
// reads), reduced to {SYMBOL: atrPercentile} exactly as the server's
// loadAtrPercentiles does (tournamentUserScoring.js:64-85). The scoring FORMULA is
// never forked here — resolveBaseATR consumes this map downstream in buildArenaModel.
//
// SHORT-CACHE FRESH (founder ruling, Amendment 2): stockRankings is rewritten
// HOURLY INTRADAY with recomputed ATR percentiles (compute-index-intelligence
// ?mode=intraday, 14:00-20:00 UTC), and banking reads it FRESH at close. A 10-min
// cache (mirroring the flip endpoint, flip.js:111) lets the client track those
// intraday writes and, by close, hold the same ~20:00-UTC version banking reads →
// the user half converges at close. Residual R3 (small intraday ATR-version drift)
// is left UNSMOOTHED on purpose — smoothing would reintroduce display-vs-bank drift.

import React from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { reduceRankingsToPercentiles } from './atrPercentilesReduce';

const CACHE_MS = 10 * 60 * 1000; // 10 min — mirrors the intraday flip endpoint (flip.js:111)
let _cache = { at: 0, map: null };

/**
 * The percentile-ATR map for the arena user layer: {SYMBOL: atrPercentile}, or
 * null (loading / unavailable → the caller falls back to the port-contract ATR,
 * matching banking's own null path). Module-cached 10 min and refreshed on that
 * cadence so a long battle session tracks the intraday recompute.
 */
export function useAtrPercentiles() {
  const [map, setMap] = React.useState(() => (
    _cache.map && Date.now() - _cache.at < CACHE_MS ? _cache.map : null
  ));

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      if (_cache.map && Date.now() - _cache.at < CACHE_MS) {
        if (alive) setMap(_cache.map);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'indexIntelligence', 'stockRankings'));
        const next = snap.exists() ? reduceRankingsToPercentiles(snap.data()) : null;
        if (next) { _cache = { at: Date.now(), map: next }; if (alive) setMap(next); }
      } catch (err) {
        // Non-fatal: the user layer degrades to the port-contract ATR (as banking
        // does on a read failure). Never throw into the arena render.
        if (typeof console !== 'undefined') {
          console.warn('[useAtrPercentiles] stockRankings read failed:', err?.message || err);
        }
      }
    };
    load();
    const iv = setInterval(load, CACHE_MS);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return map;
}
