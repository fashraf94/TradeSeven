// src/components/Research/ChartRead/chartProps.js
//
// The Chart view's read — WHAT THE CHART IS HANDED (build prompt §4, §7, MK-5, MK-7, UC-1 – UC-5, CR-5, CR-7; spec
// docs/specs/CHART_READ_SPEC_V1.md). One pure function, so the modal holds no logic of its own and every case is
// a row:
//   1D with the read      candleBasis 'raw' + the note "prices unadjusted" (UC-1, UC-3); the Rule chip; the marks
//   1W with the read      the Rule chip and the marks (1W bars are raw already, UC-5: no basis, no note)
//   Battle with the read  one stub for the 20-day at the right edge, nothing else (MK-5; no chip, MK-7)
//   no read (off, loading, hidden, failed, a quiet state)  nothing at all — today's chart
// The marks follow the Rule chip (on by default); with the sheet open every mark that exists shows (MK-3).

import { CHART_READ_COPY as C } from './chartReadCopy.js';
import { weekdayShort } from './format.js';

/**
 * @param {{ line: object|null, timeframe: string, battle: boolean, ruleOn: boolean, sheetOpen: boolean,
 *   lit: number[], dailyDates: string[] }} p   `line` is readLineOf's, or null when there is no read to show
 * @returns {object|null} StockChart's read props, or null
 */
export function chartReadProps({ line, timeframe, battle, ruleOn, sheetOpen, lit, dailyDates }) {
  if (!line || line.opensSheet !== true) return line ? rawOnly(line, timeframe, battle) : null;
  if (battle) {
    const m1 = line.marks.find((m) => m.n === 1);
    return m1 ? { dailyStub: { value: m1.value, label: C.dailyStub(weekdayShort(m1.session)) } } : null;
  }
  if (timeframe !== '1D' && timeframe !== '1W') return null;
  const out = timeframe === '1D' ? { candleBasis: 'raw', basisNote: C.basisNote } : {};
  if (line.marks.length > 0) {
    out.ruleChip = { on: ruleOn === true, label: C.ruleChip };
    if (ruleOn === true || sheetOpen === true) {
      out.ruleMarks = { marks: line.marks, shown: sheetOpen ? line.marks.map((m) => m.n) : line.shown, lit: Array.isArray(lit) ? lit : [], dailyDates: Array.isArray(dailyDates) ? dailyDates : [] };
    }
  }
  return out;
}

/** A read that opens no sheet (unknown, refused, absent, …) still shows: the 1D candles are unadjusted under it (CR-7). */
function rawOnly(line, timeframe, battle) {
  return !battle && timeframe === '1D' ? { candleBasis: 'raw', basisNote: C.basisNote } : null;
}
