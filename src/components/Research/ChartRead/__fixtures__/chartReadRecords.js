// src/components/Research/ChartRead/__fixtures__/chartReadRecords.js
//
// The Chart view's read — FIXTURE RECORDS MADE BY THE STORE'S OWN EVALUATOR (build prompt §8): each state's
// raw daily rows go through the read route's record fixture (api/_utils/setupRead/__fixtures__/readRecords.js
// recordFor: the store's acquisition, the daily-bars adapter and evaluateTfEntry over injected rows), then the
// route's own projection — so every body here is exactly what GET /api/research/setup-read would answer.
// No network, no Firestore, no model. Decimal prices (x.37, x.61, x.13), never dyadic ones.
//
//   VALID_PULLBACK   valid · pullback_resume            (readRecords.js pullbackRows)
//   VALID_BREAKOUT   valid · breakout                    a close above the 20-session high on 2.1× volume
//   NO_SETUP         invalid · no_setup                  an uptrend whose lows stay off the 20-day, no breakout
//   EXTENDED         invalid · extended, pullback still satisfied (readRecords.js extendedRows)
//   UNKNOWN_V        unknown · missing_fact, missing ['V'] (readRecords.js zeroVolumeRows)
//   NO_ADJUSTMENT    valid · pullback_resume, adjustment metadata absent (readRecords.js noAdjustmentRows)
//   SPLIT            refused · basis_discontinuity      (readRecords.js splitRows)
//   PULLBACK_NO_V    valid · pullback_resume with the breakout UNTESTABLE: bar 0 above the 20-session high, no volume
//   EXTENDED_BREAKOUT invalid · extended with patternsSatisfied ['breakout'] (review L1-5)
//   REGIME_*         invalid · regime, one per combination of the three uptrend rows that fail:
//                    A close above the 20-day · B the 20-day above the 50-day · C the 50-day rising
//                    (REGIME_A, REGIME_B, REGIME_C, REGIME_AB, REGIME_AC, REGIME_BC, REGIME_ABC_FLAT — all three
//                    fail AT equality, so the record is no_trend — and DOWNTREND, all three fail and the mirrors hold)

import { recordFor, pullbackRows, extendedRows, zeroVolumeRows, noAdjustmentRows, splitRows } from '../../../../../api/_utils/setupRead/__fixtures__/readRecords.js';
import { tradingDates } from '../../../../../api/_utils/setupEvaluator/__fixtures__/syntheticBars.js';
import { answerOf, projectSetupRecord, projectPreviousRecord } from '../../../../../api/_utils/setupRead/projection.js';

/** Rows from closes (newest first): a fixed decimal spread for the high and the low, volume steady. */
export function rowsFromCloses(session, closes, { up = 1.13, down = 1.07, volume0 = null } = {}) {
  const dates = tradingDates(closes.length, session);
  return closes.map((close, i) => ({
    date: dates[i], open: close, high: close + up, low: close - down, close, adjusted_close: close,
    volume: i === 0 && volume0 != null ? volume0 : 1_000_000 + 7 * i,
  }));
}

/** n closes, newest first, from a function of the bar index (0 = the record's day). */
const closesOf = (n, f) => Array.from({ length: n }, (_, i) => Number(f(i).toFixed(2)));

// A steady rise: bar i closes 200.37 − 0.31 i. Bar 0 well inside the stretch guard.
const rise = (i) => 200.37 - 0.31 * i;

/** Each state's rows (newest first), 80 sessions ending on `session`. */
export const STATE_ROWS = Object.freeze({
  VALID_PULLBACK: (s) => pullbackRows(s),
  // Bar 0 closes above every high of bars 1..20 on 2.1× the average volume; lows far from the 20-day.
  VALID_BREAKOUT: (s) => rowsFromCloses(s, closesOf(80, (i) => (i === 0 ? 202.61 : rise(i))), { up: 2.13, down: 0.41, volume0: 2_100_013 }),
  // An uptrend whose last three lows stay above the 20-day and whose close stays under the 20-session high.
  NO_SETUP: (s) => rowsFromCloses(s, closesOf(80, (i) => (i === 0 ? 199.83 : rise(i))), { up: 2.13, down: 0.41 }),
  EXTENDED: (s) => extendedRows(s),
  UNKNOWN_V: (s) => zeroVolumeRows(s),
  NO_ADJUSTMENT: (s) => noAdjustmentRows(s),
  SPLIT: (s) => splitRows(s),
  // Review L1-3: the pullback, bar 0 closing above every high of bars 1..20 on a session with no volume — the breakout
  // can't be tested (its close check passes, its volume check is unknown), never "not present".
  PULLBACK_NO_V: (s) => { const rows = pullbackRows(s); rows[0] = { ...rows[0], close: 202.37, high: 203.11, adjusted_close: 202.37, volume: 0 }; return rows; },
  // Review L1-5: the breakout, bar 0 far past the stretch guard.
  EXTENDED_BREAKOUT: (s) => { const rows = rowsFromCloses(s, closesOf(80, (i) => (i === 0 ? 215.61 : rise(i))), { up: 2.13, down: 0.41, volume0: 2_100_013 }); rows[0] = { ...rows[0], high: 216.37 }; return rows; },
  // A only: the rise, but bar 0 closes under its 20-day.
  REGIME_A: (s) => rowsFromCloses(s, closesOf(80, (i) => (i === 0 ? 192.37 : rise(i)))),
  // B only: old lows (bars 50+), a high middle (20..49), a lower recent run (1..19), bar 0 above that run's average.
  REGIME_B: (s) => rowsFromCloses(s, closesOf(80, (i) => (i === 0 ? 160.37 : i < 20 ? 150.13 : i < 50 ? 200.61 : 100.37))),
  // C only: a spike long ago (bars 50..54) the 50-day drops; a rise since.
  REGIME_C: (s) => rowsFromCloses(s, closesOf(80, (i) => (i >= 50 && i <= 54 ? 300.37 : 150.37 - 0.97 * i))),
  // A and B: the B shape, bar 0 under the recent run.
  REGIME_AB: (s) => rowsFromCloses(s, closesOf(80, (i) => (i === 0 ? 140.37 : i < 20 ? 150.13 : i < 50 ? 200.61 : 100.37))),
  // A and C: the C shape, bar 0 under its 20-day.
  REGIME_AC: (s) => rowsFromCloses(s, closesOf(80, (i) => (i === 0 ? 120.61 : i >= 50 && i <= 54 ? 300.37 : 150.37 - 0.97 * i))),
  // B and C: recent run under the middle, the 50-day falling (bars 50..54 high), bar 0 above the recent run.
  REGIME_BC: (s) => rowsFromCloses(s, closesOf(80, (i) => (i === 0 ? 160.37 : i < 20 ? 150.13 : i < 50 ? 200.61 : 250.37))),
  // All three fail, none of them by a strict fall: every close the same, so the close sits AT its 20-day, the 20-day
  // is level with the 50-day and the 50-day is flat — not an uptrend, and not the downtrend mirror either (no_trend).
  REGIME_ABC_FLAT: (s) => rowsFromCloses(s, closesOf(80, () => 150.13)),
  // A downtrend: a steady fall, bar 0 lowest.
  DOWNTREND: (s) => rowsFromCloses(s, closesOf(80, (i) => 150.37 + 0.43 * i)),
});

/** The route's answer body for one state's record, read at `session` (behind false), with no previous. */
export async function bodyFor(state, { session, symbol = 'ABC', fetchedAt, behind = false, previous = null } = {}) {
  const { record } = await recordFor({ session, symbol, fetchedAt: fetchedAt ?? `${session}T22:31:00.000Z`, rows: STATE_ROWS[state](session) });
  return { answer: answerOf(record), symbol, servedAt: Date.parse(`${session}T22:40:00.000Z`), sessionsTried: [session], read: projectSetupRecord(record, { session, symbol, behind }), previous };
}

/** `previous` (RD-2) for one state's record at `session`, through the route's own projection. */
export async function previousFor(state, { session, symbol = 'ABC' } = {}) {
  const { record } = await recordFor({ session, symbol, fetchedAt: `${session}T22:31:00.000Z`, rows: STATE_ROWS[state](session) });
  return projectPreviousRecord(record, { session, symbol });
}

/** The raw record (for the rows that need the evaluator's own fields beside the projection). */
export async function recordOf(state, { session, symbol = 'ABC' } = {}) {
  return (await recordFor({ session, symbol, fetchedAt: `${session}T22:31:00.000Z`, rows: STATE_ROWS[state](session) })).record;
}
