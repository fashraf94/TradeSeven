// api/_utils/filmTape/__fixtures__/tapeBars.js
//
// 1-minute bar fixtures in EODHD's /intraday row shape
// ({ timestamp, gmtoffset, datetime 'YYYY-MM-DD HH:mm:ss' UTC, open, high,
// low, close, volume } — discovery/eodhd-session-boundary-analysis.md §1), and
// a recording fetcher double with fetchIntradayCandles's signature. No network
// anywhere in the tape suites.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The literal sample: pre-market, the open, 13:46/13:47, 15:59, the 16:00 auction row, after hours, the next day. */
export function edgeRows() {
  return JSON.parse(readFileSync(path.join(HERE, 'bars', 'AAPL.1m.2026-09-24.edges.json'), 'utf8'));
}

const pad = (n) => String(n).padStart(2, '0');
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
};

/**
 * A full regular session of 1-minute rows for `date` (EDT: 13:30Z–19:59Z), the
 * close of minute i given by `priceAt(i, startMs)`; plus, unless disabled, a
 * pre-market row, the 16:00 closing-auction row and an after-hours row — the
 * rows the session cut must drop.
 */
export function sessionRows(date, priceAt, { volume = 1000, extras = true, openUtc = '13:30' } = {}) {
  const [h, m] = openUtc.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  const openMs = Date.UTC(y, mo - 1, d, h, m);
  const rows = [];
  let prev = priceAt(0, openMs);
  for (let i = 0; i < 390; i += 1) {
    const t = openMs + i * 60_000;
    const c = priceAt(i, t);
    const o = prev;
    rows.push({ timestamp: t / 1000, gmtoffset: 0, datetime: stamp(t), open: o, high: Math.max(o, c) + 0.01, low: Math.min(o, c) - 0.01, close: c, volume });
    prev = c;
  }
  if (extras) {
    const pre = openMs - 5 * 3_600_000;
    rows.unshift({ timestamp: pre / 1000, gmtoffset: 0, datetime: stamp(pre), open: 1, high: 1, low: 1, close: 1, volume: 5 });
    const auction = openMs + 390 * 60_000;
    rows.push({ timestamp: auction / 1000, gmtoffset: 0, datetime: stamp(auction), open: 999, high: 999, low: 999, close: 999, volume: 5_000_000 });
    rows.push({ timestamp: auction / 1000 + 60, gmtoffset: 0, datetime: stamp(auction + 60_000), open: 998, high: 998, low: 998, close: 998, volume: 10 });
  }
  return rows;
}

/** A flat session at `price`. */
export const flatRows = (date, price, opts) => sessionRows(date, () => price, opts);

/**
 * A price path that holds `before` until `switchUtc` (exclusive — the minute
 * starting at switchUtc is the first at `after`) — for "which minute did the
 * check read" rows.
 */
export function stepRows(date, before, after, switchUtc, opts) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, m] = switchUtc.split(':').map(Number);
  const switchMs = Date.UTC(y, mo - 1, d, h, m);
  return sessionRows(date, (i, t) => (t >= switchMs ? after : before), opts);
}

/**
 * fetchIntradayCandles's signature over a { SYMBOL: rows } map. A symbol
 * mapped to an Error throws it; an absent symbol returns []. Records every call.
 */
export function fetcherOf(bySymbol) {
  const calls = [];
  const fetchCandles = async (symbol, opts) => {
    calls.push({ symbol, ...opts });
    const v = bySymbol[symbol];
    if (v instanceof Error) throw v;
    // The generic fetcher's own output shape (marketDataCache.js): datetime + OHLCV.
    return (v || []).map((r) => ({ datetime: r.datetime, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume || 0 }));
  };
  return { fetchCandles, calls };
}
