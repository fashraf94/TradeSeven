// src/components/Research/Sheet/useBattleSeries.js
//
// BC2-1 / BC2-2 (build prompt of Nov 13, 2026) — THE BATTLE CHART'S BARS. One
// request per stock per bar size, sent only when the Battle pill is shown
// (`active`: the player tapped it, or a timed item's "see on chart" opened it —
// never on open). The request is the research chart's own
// (eodhdAPI.fetchHistoricalOHLCV → /api/stocks/historical): '30m' with 💣's 20
// days (the same client and server cache as the 💣 view), '5m' with a fixed 5
// days (the server caches by symbol, timeframe and days). A response the server
// fell back to daily bars for (`_meta.actualTimeframe` not the bar size asked,
// or bars with no time of day) is refused — daily bars would stack the record
// on one candle again. A failed request is asked again only by a tap (retry).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchHistoricalOHLCV } from '../../../services/eodhdAPI';
import { battleCandlesOf } from './battleChart.js';

const intraday = (rows) => Array.isArray(rows) && rows.length > 0 && rows.every((r) => Number.isFinite(r?.timestamp) || (typeof r?.date === 'string' && r.date.includes('T')));

/**
 * @param {object} p
 * @param {string}  p.symbol
 * @param {object|null} p.spec   battleChart.battleSpecOf's answer (null: no Battle pill)
 * @param {boolean} p.active     the Battle pill is showing
 * @returns {{ status: 'idle'|'loading'|'ready'|'empty'|'error', candles: Array, retry: () => void }}
 */
export default function useBattleSeries({ symbol, spec, active }) {
  const key = spec && typeof symbol === 'string' && symbol ? `${symbol}|${spec.barSize}` : null;
  const [state, setState] = useState({ key: null, status: 'idle', raw: null, atMs: null });
  const asked = useRef(new Set());
  const [attempt, setAttempt] = useState(0);
  const liveRef = useRef(true);
  useEffect(() => { liveRef.current = true; return () => { liveRef.current = false; }; }, []);

  useEffect(() => {
    if (!active || !key || asked.current.has(key)) return;
    asked.current.add(key);
    setState({ key, status: 'loading', raw: null, atMs: null });
    fetchHistoricalOHLCV(symbol, spec.bars.timeframe, { days: spec.bars.days })
      .then((rows) => {
        const actual = rows?._meta?.actualTimeframe;
        if ((typeof actual === 'string' && actual !== spec.bars.timeframe) || !intraday(rows)) throw new Error('not_intraday');
        if (liveRef.current) setState({ key, status: 'ready', raw: rows, atMs: Date.now() });
      })
      .catch(() => { if (liveRef.current) setState({ key, status: 'error', raw: null, atMs: null }); });
  }, [active, key, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- the key names the symbol and the bar size

  const candles = useMemo(
    () => (state.key === key && state.status === 'ready' ? battleCandlesOf(state.raw, { days: spec?.days ?? [], nowMs: state.atMs }) : []),
    [state, key, spec?.days],
  );
  const retry = useCallback(() => {
    if (!key) return;
    asked.current.delete(key);
    setAttempt((n) => n + 1);
  }, [key]);

  const status = state.key !== key ? (active && key ? 'loading' : 'idle')
    : state.status === 'ready' && candles.length === 0 ? 'empty' : state.status;
  return { status, candles, retry };
}
