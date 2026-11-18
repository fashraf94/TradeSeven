// src/components/Research/ChartRead/useChartRead.js
//
// The Chart view's read — THE ONE REQUEST (build prompt §5, RD-11, RD-12; spec docs/specs/CHART_READ_SPEC_V1.md).
// GET /api/research/setup-read through the client read (Sheet/setupRead.js), once per symbol while it stays on screen
// (the route's own 60-second cache serves a return to an earlier symbol).
//
//   CHART_READ_MODE 'off'  no request, ever: status 'off'.
//   'allowlist' / 'on'     one request when the caller says the read can show (a ranked-stock's Chart view; never
//                          crypto, an index or a sector fund — RD-11). The server decides the audience: a 404
//                          chart_read_unavailable (not admitted) or a 400 (not one of the ranked stocks) is 'hidden'
//                          — no slot, the layout closes up. The per-player allowlist verdict exists only on the
//                          server (isCockpitOwnerAllowlisted); the client's film-room verdict is per battle, and a
//                          browse mount has none, so the route's own answer is the gate (spec reading R-2).
//   a network failure, a 5xx, a 429 or a body outside the contract → 'failed' (RD-12: the quiet line and Try again;
//                          never a stale or partial read) — under 'allowlist' only a 5xx or a malformed 200, the
//                          answers that come after admission; a 401, the per-IP 429 or a network failure is no slot
//                          (review L3-2).
//
// Returns { status: 'off'|'loading'|'ready'|'hidden'|'failed', body, retry }.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSetupRead } from '../Sheet/setupRead.js';
import { resolveChartReadMode } from '../Sheet/chartReadMode.js';

export function useChartRead({ symbol, enabled }) {
  const mode = resolveChartReadMode();
  const ask = enabled === true && mode !== 'off' && typeof symbol === 'string' && symbol.length > 0;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', body: null });
  const startedRef = useRef(null);
  const doneRef = useRef(null);
  const key = `${symbol}|${attempt}`;

  useEffect(() => {
    if (!ask || doneRef.current === key || startedRef.current === key) return undefined;
    startedRef.current = key;
    let live = true;
    setState({ key, status: 'loading', body: null });
    fetchSetupRead(symbol)
      .then((body) => { if (live) { doneRef.current = key; setState({ key, status: 'ready', body }); } })
      .catch((e) => {
        if (!live) return;
        // 404 (not admitted) and 400 (not a ranked stock) are no slot. Under 'allowlist' the client cannot know the
        // player is admitted, so only an answer the route gives AFTER admission is a failed read — a 5xx, or a 200
        // outside the contract; a 401, the per-IP 429 or a network failure before admission is no slot (review L3-2).
        const status = e?.status;
        const hidden = status === 404 || status === 400 || (mode === 'allowlist' && !(status >= 500 || status === 200));
        doneRef.current = key;
        setState({ key, status: hidden ? 'hidden' : 'failed', body: null });
      });
    return () => {
      live = false;
      // A request cut off before its answer (the view switched, the modal closed) is asked again next time.
      if (startedRef.current === key && doneRef.current !== key) startedRef.current = null;
    };
  }, [ask, key, symbol, mode]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  if (!ask) return { status: 'off', body: null, retry };
  if (state.key !== key) return { status: 'loading', body: null, retry };
  return { status: state.status, body: state.body, retry };
}
