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
//
// Each answer is kept BY ITS KEY (symbol|bar size) for the modal's life (PR 2
// review B1): a stock reached again after another stock's Battle finds its own
// bars, never a slot another request overwrote, and a late answer lands under
// its own key only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchHistoricalOHLCV } from '../../../services/eodhdAPI';
import { battleCandlesOf } from './battleChart.js';

/** Bars older than this are asked for again the next time Battle is shown (the client and the server cache 5-minute bars this long). */
export const REFRESH_MS = 5 * 60 * 1000;
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
  const [answers, setAnswers] = useState({}); // key → { status: 'loading'|'ready'|'error', raw, atMs }
  const asked = useRef(new Set());
  const [attempt, setAttempt] = useState(0);
  const liveRef = useRef(true);
  useEffect(() => { liveRef.current = true; return () => { liveRef.current = false; }; }, []);

  useEffect(() => {
    if (!active || !key) return;
    // One request per stock and bar size — asked again only when Battle is shown after the bars are
    // REFRESH_MS old (PR 2 review A1/B5/C2: a live session's later record must not sit on a stale last bar).
    const had = answers[key];
    const stale = had?.status === 'ready' && Number.isFinite(had.atMs) && Date.now() - had.atMs >= REFRESH_MS;
    if (asked.current.has(key) && !stale) return;
    asked.current.add(key);
    const settle = (a) => { if (liveRef.current) setAnswers((all) => ({ ...all, [key]: a })); };
    // A refresh keeps the bars on screen while it asks (never a blank chart for a reload).
    if (!stale) settle({ status: 'loading', raw: null, atMs: null });
    fetchHistoricalOHLCV(symbol, spec.bars.timeframe, { days: spec.bars.days })
      .then((rows) => {
        const actual = rows?._meta?.actualTimeframe;
        if ((typeof actual === 'string' && actual !== spec.bars.timeframe) || !intraday(rows)) throw new Error('not_intraday');
        settle({ status: 'ready', raw: rows, atMs: Date.now() });
      })
      .catch(() => { if (stale) settle({ ...had, atMs: Date.now() }); else settle({ status: 'error', raw: null, atMs: null }); });
  }, [active, key, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- the key names the symbol and the bar size

  const own = key ? answers[key] ?? null : null;
  const candles = useMemo(
    () => (own?.status === 'ready' ? battleCandlesOf(own.raw, { days: spec?.days ?? [], nowMs: own.atMs }) : []),
    [own, spec?.days],
  );
  const retry = useCallback(() => {
    if (!key) return;
    asked.current.delete(key);
    setAttempt((n) => n + 1);
  }, [key]);

  const status = !own ? (active && key ? 'loading' : 'idle')
    : own.status === 'ready' && candles.length === 0 ? 'empty' : own.status;
  return { status, candles, retry };
}
