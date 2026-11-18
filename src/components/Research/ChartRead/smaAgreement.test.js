// src/components/Research/ChartRead/smaAgreement.test.js
//
// The Chart view's read — PHASE 0 POINT 4, AS ROWS (BUILD_RULES §9): does mark 1 (the record's 20-day) agree with
// the 20-day the chart draws (StockChart's SMA line, useResearchData's smaData = calculateRollingSMA on the same raw
// closes) on the record's day, to the cent, on unadjusted candles?
//
// The two are the SAME float mean of the same twenty raw closes, summed in the same order (newest first). They are
// rounded differently: the record keeps toFixed(4) (api/_utils/technicalCalculations.js calculateSMA), the chart
// Math.round(mean × 100) / 100. The read prints the record's 4-decimal value to the cent, half up. So they agree to
// the cent everywhere but one band: a mean whose 3rd–4th decimals lie in [x.xx4950, x.xx5000) rounds to x.xx50 at
// four decimals (printed up) while the chart rounds it down — one cent apart. The drawn line carries no number (its
// price label and last value are off), so the difference is in position only: half a cent at most.
// The rows below pin both facts, on records made by the store's own evaluator.

import { describe, it, expect } from 'vitest';
import { recordFor } from '../../../../api/_utils/setupRead/__fixtures__/readRecords.js';
import { projectSetupRecord } from '../../../../api/_utils/setupRead/projection.js';
import { rowsFromCloses, STATE_ROWS } from './__fixtures__/chartReadRecords.js';
import { calculateRollingSMA } from '../../../services/technicalIndicators.js';
import { formatPrice } from './format.js';
import { marksOf } from './marks.js';

const SESSION = '2026-11-17';
const readOf = async (rows) => {
  const { record } = await recordFor({ session: SESSION, symbol: 'ABC', fetchedAt: `${SESSION}T22:31:00.000Z`, rows });
  return projectSetupRecord(record, { session: SESSION, symbol: 'ABC', behind: false });
};
const drawnAt = (rows, day, period) => calculateRollingSMA(rows.map((r) => ({ ...r })), period).find((p) => p.date === day)?.value;

describe('mark 1 against the drawn 20-day on the record\'s day', () => {
  it('the evaluator-made fixtures: positions within half a cent always; the printed cents equal, but in the band', async () => {
    const parted = [];
    for (const state of ['VALID_PULLBACK', 'VALID_BREAKOUT', 'NO_SETUP', 'REGIME_A', 'REGIME_B', 'REGIME_C', 'DOWNTREND']) {
      const rows = STATE_ROWS[state](SESSION);
      const read = await readOf(rows);
      for (const [n, period] of [[1, 20], [2, 50]]) {
        const mark = marksOf(read).find((m) => m.n === n).value;
        const drawn = drawnAt(rows, SESSION, period);
        expect(Math.abs(mark - drawn), `${state} mark ${n}`).toBeLessThanOrEqual(0.005 + 1e-9);
        if (formatPrice(mark) !== formatPrice(drawn)) {
          expect(/\.\d\d5$/.test(String(mark)), `${state} mark ${n}: ${mark} vs ${drawn}`).toBe(true); // only a value ending x.xx5
          parted.push(`${state}:${n}:${mark}:${drawn}`);
        }
      }
    }
    // The fixtures' natural cases (Phase 0 point 4): DOWNTREND's 20-day, 154.455 printed $154.46, drawn at 154.45, and its
    // 50-day, 160.905 printed $160.91, drawn at 160.90 — each half a cent apart, the drawn line carrying no number.
    expect(parted).toEqual(['DOWNTREND:1:154.455:154.45', 'DOWNTREND:2:160.905:160.9']);
  });
  it('the one band where they part: a mean of x.xx496… prints one cent above the drawn line, half a cent away at most', async () => {
    // Twenty closes whose mean is 141.10496: nineteen at 141.10 and one at 141.10 + 20 × 0.00496 = 141.1992.
    const closes = Array.from({ length: 80 }, (_, i) => (i === 7 ? 141.1992 : i < 20 ? 141.1 : 140.37 - 0.01 * i));
    const rows = rowsFromCloses(SESSION, closes);
    const read = await readOf(rows);
    const mark1 = marksOf(read).find((m) => m.n === 1).value;
    const drawn = drawnAt(rows, SESSION, 20);
    expect(mark1).toBe(141.105); // toFixed(4) of 141.10496 → 141.1050
    expect(formatPrice(mark1)).toBe('$141.11'); // printed half up
    expect(drawn).toBe(141.1); // the chart's own rounding
    expect(Math.abs(mark1 - drawn)).toBeLessThanOrEqual(0.005 + 1e-9);
  });
});
