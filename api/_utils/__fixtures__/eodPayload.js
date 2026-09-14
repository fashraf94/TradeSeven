// api/_utils/__fixtures__/eodPayload.js
//
// The shared EODHD `/eod/` payload fixture, extracted verbatim from
// dailyRowHygiene.test.js:36-52 so both daily-mapper batteries drive the SAME
// production shape: the research path's `fetchDailyOHLCV` (newest-first, the
// endpoint passes `&order=d`) and the universe cron's `fetchOHLCV`
// (OLDEST-first — its URL carries no `order=` param, so it reverses).
//
// A test-only move. The body below is byte-for-byte the function that lived in
// dailyRowHygiene.test.js; nothing about the fixture changed.

const DAY_MS = 86_400_000;

// An EODHD `/eod/` payload: newest-first weekday rows, gently trending with a
// wobble so ATR/Bollinger/RSI are non-degenerate and nothing here depends on
// flat data. 90 weekdays clears MACD's 35-row and SMA50's 50-row minimums with
// room, which is what makes "the same series minus one row" a fair comparison.
export function eodPayload(n = 90) {
  const rows = [];
  const today = Date.UTC(2026, 5, 15);
  for (let i = 0; i < n; i++) {
    const close = Number((120 + i * 0.35 + Math.sin(i / 3) * 1.8).toFixed(4));
    rows.push({
      date: new Date(today - i * DAY_MS).toISOString().slice(0, 10),
      open: Number((close - 0.25).toFixed(4)),
      high: Number((close + 1.2).toFixed(4)),
      low: Number((close - 1.2).toFixed(4)),
      close,
      adjusted_close: close,
      volume: 4_000_000 + (i % 5) * 120_000,
    });
  }
  return rows;
}

/**
 * The same payload in the order the universe cron's endpoint returns it.
 * `compute-index-intelligence.js` builds its own URL with no `order=` param
 * (`:133`), so EODHD answers oldest-first and the cron reverses (`:155`).
 */
export function eodPayloadOldestFirst(n = 90) {
  return eodPayload(n).reverse();
}
