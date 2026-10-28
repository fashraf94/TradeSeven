// src/hooks/useDailyRegimeBrief.js
//
// Read-only hook for the Daily Regime Brief (DRB) — the forward-looking daily
// market synthesis written by the 12:30 UTC cron to
// indexIntelligence/dailyRegimeBrief. Until now the DRB was consumed only
// server-side (Gemma's voice layer, Forge prompts, Discover current-events);
// this is the first frontend reader, surfaced by the Command Dashboard "Read"
// station.
//
// Mirrors useMarketContext's getDoc + single-retry pattern. No writes — the
// doc is public-read, Admin-SDK write only.

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Today's date (YYYY-MM-DD) in US market time, for staleness comparison.
// The DRB is overwritten on trading days; on weekends/holidays it holds the
// last session's brief, which we still want to show (flagged as stale).
function getMarketDateString() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function useDailyRegimeBrief() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedRef = useRef(false);
  // False once the reader has unmounted: the one retry below waits 1.5 s, and a reader gone by then reads nothing
  // (Command Center S8 review S8-13; the hub and both legacy shells call this hook).
  const aliveRef = useRef(true);

  const fetchData = useCallback(async (isRetry = false) => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDoc(doc(db, 'indexIntelligence', 'dailyRegimeBrief'));
      setData(snap.exists() ? snap.data() : null);
      loadedRef.current = true;
    } catch (err) {
      const code = err.code || 'unknown';
      console.error(
        `[useDailyRegimeBrief] Firestore read failed (${isRetry ? 'retry' : 'first attempt'}):\n` +
        `  path: indexIntelligence/dailyRegimeBrief\n  code: ${code}\n  message: ${err.message}`
      );
      // Auto-retry once after a short delay (covers transient network errors).
      if (!isRetry) {
        await new Promise(r => setTimeout(r, 1500));
        if (!aliveRef.current) return undefined;
        return fetchData(true);
      }
      setError(err.message || 'Failed to load the daily brief');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) fetchData();
  }, [fetchData]);

  // Shape the doc into the fields the Read station needs, with safe defaults.
  const dailyBrief = data?.dailyBrief || null;
  const keyEvents = Array.isArray(data?.keyEvents) ? data.keyEvents : [];
  const themes = Array.isArray(data?.themes) ? data.themes : [];
  const forDate = data?.forDate || null;
  const isStale = !!forDate && forDate !== getMarketDateString();
  // The cron's recorded generation time (api/cron/compute-daily-regime-brief.js: serverTimestamp), as stored: a
  // Firestore Timestamp, or null when the document carries none. Additive — the two legacy readers ignore it.
  const generatedAt = data?.generatedAt ?? null;

  return { dailyBrief, keyEvents, themes, forDate, generatedAt, isStale, loading, error, refetch: fetchData };
}
