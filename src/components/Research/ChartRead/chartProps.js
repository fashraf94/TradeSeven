// src/components/Research/ChartRead/chartProps.js
//
// The Chart view's read — WHAT THE CHART IS HANDED (build prompt §4, §7, MK-5, MK-7, UC-1 – UC-5, CR-5, CR-7; spec
// docs/specs/CHART_READ_SPEC_V1.md). One pure function, so the modal holds no logic of its own and every case is
// a row:
//   1D with the read      candleBasis 'raw' + the note "prices unadjusted" (UC-1, UC-3); the Rule chip; the marks
//   1W with the read      the Rule chip and the marks (1W bars are raw already, UC-5: no basis, no note)
//   Battle with the read  one stub for the 20-day at the right edge, nothing else (MK-5; no chip, MK-7)
//   no read (off, loading, hidden, failed, a quiet state)  nothing at all — today's chart
// The marks follow the Rule chip (on by default); with the chart compact every mark that exists shows (PG-3), and a tapped
// check's marks always show, lit — with the Rule chip off too (PG-3).

import { CHART_READ_COPY as C } from './chartReadCopy.js';
import { shownMarkNumbers } from './marks.js';
import { weekdayShort } from './format.js';

/** FX-4 (founder Q-4): the marks the weekly averages would contradict — the 20-day, the 50-day, the 50-day five sessions ago. */
export const WEEKLY_AVERAGES_HIDE = Object.freeze([1, 2, 3]);
/**
 * FX-4: on 1W with the SMA pill on, the chart draws 20- and 50-WEEK averages, which marks 1 – 3 (daily values) cannot
 * sit on (CR-4) — so those three are not drawn, lit or unlit, and the checks' head says why. Pure.
 */
export const weeklyAveragesHideMarks = ({ timeframe, smaOn }) => timeframe === '1W' && smaOn === true;

/**
 * @param {{ line: object|null, timeframe: string, battle: boolean, ruleOn: boolean, compact: boolean,
 *   lit: number[], dailyDates: string[], smaOn?: boolean }} p   `line` is readLineOf's, or null when there is no read
 *   to show; `compact` the pinned chart's compact height (PG-2); `lit` the tapped check's marks; `smaOn` the chart's
 *   SMA pill as it reports it (FX-4)
 * @returns {object|null} StockChart's read props, or null
 */
export function chartReadProps({ line, timeframe, battle, ruleOn, compact, lit, dailyDates, smaOn = false }) {
  if (!line || line.hasChecks !== true) return line ? rawOnly(line, timeframe, battle) : null;
  if (battle) {
    const m1 = line.marks.find((m) => m.n === 1);
    return m1 ? { dailyStub: { value: m1.value, label: C.dailyStub(weekdayShort(m1.session)) } } : null;
  }
  if (timeframe !== '1D' && timeframe !== '1W') return null;
  const out = timeframe === '1D' ? { candleBasis: 'raw', basisNote: C.basisNote } : {};
  if (line.marks.length > 0) {
    // Compact, every mark shows, so the chip reads pressed and cannot turn them off (review L3-7's rule, PG-3).
    out.ruleChip = { on: ruleOn === true || compact === true, label: C.ruleChip, disabled: compact === true };
    const exist = new Set(line.marks.map((m) => m.n));
    const tapped = (Array.isArray(lit) ? lit : []).filter((n) => exist.has(n));
    // PG-3: compact — every mark that exists; full height — the state's default set with the Rule chip on, none with it
    // off; and a tapped check's marks always, lit.
    const base = compact === true ? shownMarkNumbers(line.state, line.marks, { compact: true }) : ruleOn === true ? line.shown : [];
    const keep = weeklyAveragesHideMarks({ timeframe, smaOn }) ? (n) => !WEEKLY_AVERAGES_HIDE.includes(n) : () => true;
    const shown = [...new Set([...base, ...tapped])].sort((a, b) => a - b).filter(keep);
    if (base.length > 0 || tapped.length > 0) {
      out.ruleMarks = { marks: line.marks, shown, lit: tapped.filter(keep), dailyDates: Array.isArray(dailyDates) ? dailyDates : [] };
    }
  }
  return out;
}

const DAY_MS = 86_400_000;
/**
 * Are these bars (oldest first, the hook's ohlcvData) the timeframe's own (review L2-1)? The hook flips its timeframe at
 * once and keeps the previous series until the new one lands, so for a moment 1W can hold 52 daily bars (adjusted) and
 * 1D a weekly series. The median gap between bars decides: a day series ≤ 4 days, a week series ≥ 5. Pure.
 */
export function barsMatchTimeframe(bars, timeframe) {
  if (timeframe !== '1D' && timeframe !== '1W') return false;
  const ms = (Array.isArray(bars) ? bars : []).map((b) => Date.parse(String(b?.date || b?.datetime || '').slice(0, 10))).filter(Number.isFinite);
  if (ms.length < 3) return false;
  const gaps = ms.slice(1).map((t, i) => (t - ms[i]) / DAY_MS).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return timeframe === '1D' ? median <= 4 : median >= 5;
}

/** A read that shows no checks (unknown, refused, absent, …) still shows: the 1D candles are unadjusted under it (CR-7). */
function rawOnly(line, timeframe, battle) {
  return !battle && timeframe === '1D' ? { candleBasis: 'raw', basisNote: C.basisNote } : null;
}
