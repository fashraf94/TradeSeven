// api/_utils/setupRead/__fixtures__/readRecords.js
//
// Real setup records for the read route's tests: the store's own acquisition
// (setupEvidence/acquire.js acquireOnce + snapshotDocOf) over injected daily rows, so
// every field — the entry record, capturedAt, key.ruleSet, the writer stamp, the 55
// stored bars — is the shape the store writes (the menuSnapshots.js precedent). No
// network, no Firestore. Decimal prices (x.37, x.61), never dyadic ones.
//
//   VALID_PULLBACK   ok · valid · pullback_resume · uptrend
//   EXTENDED         ok · invalid · extended — pattern null, patternsSatisfied ['pullback_resume']
//   UNKNOWN_V        ok · unknown · missing_fact — bar 0's volume is zero, missing ['V']
//   NO_ADJUSTMENT    ok · valid · pullback_resume, with no adjusted close: adjustment metadata absent
//   SPLIT            refused · basis_discontinuity (a 2:1 step in adjusted / raw inside the window)

import { acquireOnce, snapshotDocOf } from '../../setupEvidence/acquire.js';
import { snapshotIdOf } from '../../setupEvidence/key.js';
import { describeRuleSet } from '../../setupEvaluator/thresholds.js';
import { tradingDates } from '../../setupEvaluator/__fixtures__/syntheticBars.js';

/** Raw /eod/ rows, newest first, on real sessions: a steady uptrend whose bar 1 dips to its 20-day average. */
export function pullbackRows(session, n = 80) {
  return tradingDates(n, session).map((date, i) => {
    const close = 200.37 - 0.5 * i;
    const low = i === 1 ? 194.61 : close - 2.13;
    return { date, open: close, high: close + 2.13, low, close, adjusted_close: close, volume: 1_000_000 + 7 * i };
  });
}

/** The pullback, with bar 0 far above the guard: `invalid(extended)` with the pullback still satisfied. */
export function extendedRows(session, n = 80) {
  const rows = pullbackRows(session, n);
  rows[0] = { ...rows[0], open: 200.37, close: 215.61, high: 216.37, low: 194.37, adjusted_close: 215.61 };
  return rows;
}

/** A plain uptrend whose bar 0 traded no volume: V is missing, the breakout untestable, the verdict unknown. */
export function zeroVolumeRows(session, n = 80) {
  return tradingDates(n, session).map((date, i) => {
    const close = 200.37 - 0.5 * i;
    return { date, open: close, high: close + 2.13, low: close - 2.13, close, adjusted_close: close, volume: i === 0 ? 0 : 1_000_000 + 7 * i };
  });
}

/** The pullback rows with no adjusted close on any row: the split check cannot run. */
export function noAdjustmentRows(session, n = 80) {
  return pullbackRows(session, n).map(({ adjusted_close: _drop, ...row }) => row);
}

/** A 2:1 split ten sessions back: adjusted / raw steps from 0.5 to 1 inside the window. */
export function splitRows(session, n = 80) {
  return pullbackRows(session, n).map((r, i) => ({ ...r, adjusted_close: i >= 10 ? r.close / 2 : r.close }));
}

/** A stored record as the store would create it, for (session, symbol), its response received at `fetchedAt`. */
export async function recordFor({ session, symbol, fetchedAt, rows }) {
  const at = new Date(fetchedAt);
  const acquired = await acquireOnce({ session, symbol, now: () => at, fetchPayload: async () => structuredClone(rows) });
  if (acquired.failure) throw new Error(`fixture acquisition failed: ${acquired.failure}`);
  const ruleSet = describeRuleSet();
  return { id: snapshotIdOf({ session, symbol, ruleSet }), record: snapshotDocOf({ session, symbol, ruleSet, acquired, host: 'fixture-host' }) };
}

/** The fixture set for one (session, symbol). */
export async function readRecordSet({ session, symbol, fetchedAt }) {
  return {
    VALID_PULLBACK: await recordFor({ session, symbol, fetchedAt, rows: pullbackRows(session) }),
    EXTENDED: await recordFor({ session, symbol, fetchedAt, rows: extendedRows(session) }),
    UNKNOWN_V: await recordFor({ session, symbol, fetchedAt, rows: zeroVolumeRows(session) }),
    NO_ADJUSTMENT: await recordFor({ session, symbol, fetchedAt, rows: noAdjustmentRows(session) }),
    SPLIT: await recordFor({ session, symbol, fetchedAt, rows: splitRows(session) }),
  };
}
