// src/screens/battleView/useIntradayView.js
//
// Intraday Data — Build 1, contract §8.1 / §9.1: the Why? panel's ONE `get`
// of agentBattles/{battleId}/intradayViews/{evalId} when it opens. Never a
// subscription. The panel renders diagnostics only when the entry's
// `intradayViewRef === evalId` AND the fetched document's `evalId` matches.
// Flag-gated at render scope (the featureFlags mock hazard): with
// INTRADAY_DIAGNOSTIC_ENABLED off nothing is fetched and null is returned.

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { INTRADAY_DIAGNOSTIC_ENABLED } from '../../config/featureFlags';

/**
 * @param {object} p
 * @param {boolean} p.open        the panel is open
 * @param {string|null} p.battleId
 * @param {object|null} p.evaluation the latest decided entry (carries intradayViewRef)
 * @returns {object|null} the stored view, or null
 */
export function useIntradayView({ open, battleId, evaluation }) {
  const [view, setView] = useState(null);
  const evalId = typeof evaluation?.evalId === 'string' ? evaluation.evalId : null;
  const viewRef = typeof evaluation?.intradayViewRef === 'string' ? evaluation.intradayViewRef : null;
  const wanted = INTRADAY_DIAGNOSTIC_ENABLED && open && Boolean(battleId) && evalId !== null && viewRef === evalId;

  useEffect(() => {
    if (!wanted) { setView(null); return undefined; }
    let cancelled = false;
    getDoc(doc(db, 'agentBattles', battleId, 'intradayViews', evalId))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        setView(data && data.evalId === evalId ? data : null);
      })
      .catch(() => { if (!cancelled) setView(null); });
    return () => { cancelled = true; };
  }, [wanted, battleId, evalId]);

  return wanted ? view : null;
}

export default useIntradayView;
