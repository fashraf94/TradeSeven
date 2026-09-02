// src/screens/battleView/useCoarseNow.js
//
// A COARSE clock for the turn line (Phase A seed §A1): once a minute, or when
// the tab becomes visible again. The rendered text only changes at state
// transitions (due → late, open → closed), so a minute of granularity loses
// nothing — and a per-second countdown is exactly the live-ticking clock the
// motion lock forbids ("no countdown that ticks per second; a static `next ~`
// is the whole clock").
//
// Disabled (no interval, no listener) when the controller is off, so the
// flag-off screen re-renders exactly as it did before Phase A.

import { useEffect, useState } from 'react';

export const COARSE_NOW_INTERVAL_MS = 60 * 1000;

export default function useCoarseNow(enabled, intervalMs = COARSE_NOW_INTERVAL_MS) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => setNow(new Date());
    const id = setInterval(tick, intervalMs);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') tick();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs]);

  return now;
}
