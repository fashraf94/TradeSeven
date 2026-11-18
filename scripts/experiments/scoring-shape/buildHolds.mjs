#!/usr/bin/env node
// scripts/experiments/scoring-shape/buildHolds.mjs
//
// THE HOLDS (prompt §4). For every eligible (stock, entry session): the three sessions from the entry, fully
// adjusted, and the units measured with no look-ahead.
//
//   - Universe: V2's 228 qualified symbols (closeout of 12 Oct 2026).
//   - Entry rule (V2's anchor, "validated_position_entry_or_swap_fill"): the fill is the OPEN of entry session t.
//     The one-day unit comes from the 15 bars ending at t−1 (the last completed session at commit; V2 policy
//     "sourceSession": independently_latest_completed_exchange_session_at_each_position_commit).
//   - Prices: the V2 normalizer's fully adjusted series (each row × adjusted_close/close), so an ex-dividend drop
//     inside a hold cannot fake a Bust and a split cannot fake anything.
//   - Eligible: rows t−45 … t+2 are consecutive sessions on the pinned calendar (U6 needs 45 sessions back; the
//     three-session hold needs t+1 and t+2). Every eligible entry gets BOTH a one-session hold (session t) and a
//     three-session hold (t … t+2) from the same fill.
//   - Stored per hold: the three sessions' O/H/L/C, the prior close (t−1), the measured one-day unit at t, t+1 and
//     t+2 (the last two for Step 5's re-entered one-day matches), and U6 at t. All percentages unrounded; the 6-dp
//     admitted unit is applied by each analysis script through effectiveStockPercentage.
//
// USAGE: node scripts/experiments/scoring-shape/buildHolds.mjs [--bars <run dir>] [--v2 <closeout dir>] [--out <dir>]

import path from 'node:path';
import { argOf, calendarSessions, DEFAULT_BARS_RUN, DEFAULT_V2_DIR, die, loadSeries, oneDayUnitAt, outDirOf, threeSessionUnitAt,
  U6_BLOCK, U6_BLOCKS, V2_WINDOW_FIRST_ENTRY, v2Universe, writeJson } from './lib.mjs';

const argv = process.argv;
const barsRun = argOf(argv, '--bars', DEFAULT_BARS_RUN);
const out = outDirOf(argv);
const { symbols } = v2Universe(argOf(argv, '--v2', DEFAULT_V2_DIR));
const BACK = U6_BLOCK * U6_BLOCKS; // 45

const holds = [];
const skipped = {};
let first = null, last = null;
for (const sym of symbols) {
  const series = loadSeries(barsRun, sym);
  if (series.status !== 'valid') { skipped[sym] = series.status; continue; }
  // The pinned calendar maintains 2026–2027 only (src/utils/marketCalendar.js:69); bars before 2026 are not used.
  const rows = series.rows.filter((r) => r.date >= '2026-01-01');
  const sessions = calendarSessions(rows[0].date, rows.at(-1).date);
  const idx = new Map(sessions.map((d, i) => [d, i]));
  const extra = rows.filter((r) => !idx.has(r.date)).map((r) => r.date);
  if (extra.length) die(`${sym}: dates not on the calendar of record: ${extra.join(',')}`);
  first = first && first < rows[0].date ? first : rows[0].date;
  last = last && last > rows.at(-1).date ? last : rows.at(-1).date;
  for (let i = BACK; i + 2 < rows.length; i++) {
    const base = idx.get(rows[i].date);
    let consecutive = true;
    for (let j = i - BACK; j <= i + 2; j++) if (idx.get(rows[j].date) !== base + (j - i)) { consecutive = false; break; }
    if (!consecutive) { skipped[`${sym}@${rows[i].date}`] = 'gap'; continue; }
    const u1 = [oneDayUnitAt(rows, i), oneDayUnitAt(rows, i + 1), oneDayUnitAt(rows, i + 2)];
    const u6 = threeSessionUnitAt(rows, i);
    if (u1.some((u) => !(u > 0)) || !(u6 > 0)) { skipped[`${sym}@${rows[i].date}`] = 'unit_unavailable'; continue; }
    holds.push({ s: sym, d: rows[i].date, pc: rows[i - 1].close,
      p: [0, 1, 2].map((k) => [rows[i + k].open, rows[i + k].high, rows[i + k].low, rows[i + k].close]),
      days: [rows[i].date, rows[i + 1].date, rows[i + 2].date], u1, u6 });
  }
}
holds.sort((x, y) => x.d.localeCompare(y.d) || x.s.localeCompare(y.s));
const entries = [...new Set(holds.map((h) => h.d))];
const v2 = holds.filter((h) => h.d >= V2_WINDOW_FIRST_ENTRY);
const meta = { universe: symbols.length, barsFirst: first, barsLast: last, holds: holds.length, entrySessions: entries.length,
  firstEntry: entries[0], lastEntry: entries.at(-1), v2Window: { firstEntry: V2_WINDOW_FIRST_ENTRY, holds: v2.length, entrySessions: new Set(v2.map((h) => h.d)).size, lastEntry: v2.at(-1)?.d },
  skipped: Object.keys(skipped).length, skippedReasons: Object.values(skipped).reduce((m, r) => ({ ...m, [r]: (m[r] || 0) + 1 }), {}) };
writeJson(path.join(out, 'holds.json'), { meta, holds });
console.log(JSON.stringify(meta, null, 1));
