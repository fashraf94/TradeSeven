// api/_utils/setupMenuLabels/__fixtures__/menuSnapshots.js
//
// Real snapshot documents for Slice 2's tests: the store's own acquisition (setupEvidence/acquire.js
// acquireOnce + snapshotDocOf) over injected daily rows, so every field — the entry record, capturedAt,
// key.ruleSet, the refusal — is the shape the store writes (the activationSnapshots.js precedent). No
// network, no Firestore. Plus the few hand-made documents a real acquisition cannot produce (another
// triple, a malformed one, an `ok` entry with an evaluator `unknown`).

import { acquireOnce, snapshotDocOf } from '../../setupEvidence/acquire.js';
import { snapshotIdOf } from '../../setupEvidence/key.js';
import { describeRuleSet } from '../../setupEvaluator/thresholds.js';
import { tradingDates } from '../../setupEvaluator/__fixtures__/syntheticBars.js';

/** Raw /eod/ rows, newest first, on real sessions: a steady uptrend with adjusted closes. */
export function upRows(session, n = 80) {
  return tradingDates(n, session).map((date, i) => {
    const close = 200 - 0.5 * i;
    return { date, open: close, high: close + 2, low: close - 2, close, adjusted_close: close, volume: 1_000_000 + i };
  });
}

/** A steady downtrend: `invalid(regime)`. */
export function downRows(session, n = 80) {
  return upRows(session, n).map((r, i) => {
    const close = 100 + 0.5 * i;
    return { ...r, open: close, high: close + 2, low: close - 2, close, adjusted_close: close };
  });
}

/** The uptrend with a breakout on the newest session: `valid(breakout)`. */
export function breakoutRows(session, n = 80) {
  const rows = upRows(session, n);
  rows[0] = { ...rows[0], close: 203, high: 204, low: 199, open: 200, adjusted_close: 203, volume: 4_000_000 };
  return rows;
}

/** A snapshot document as the store would create it, for (session, symbol), its response received at `fetchedAt`. */
export async function snapshotFor({ session, symbol, fetchedAt, rows = upRows(session) }) {
  const at = new Date(fetchedAt);
  const acquired = await acquireOnce({ session, symbol, now: () => at, fetchPayload: async () => structuredClone(rows) });
  if (acquired.failure) throw new Error(`fixture acquisition failed: ${acquired.failure}`);
  const ruleSet = describeRuleSet();
  return { snapshotId: snapshotIdOf({ session, symbol, ruleSet }), snapshot: snapshotDocOf({ session, symbol, ruleSet, acquired, host: 'fixture' }) };
}

/**
 * The fixture set for one session, keyed by symbol:
 *   AAPL valid(breakout) · MSFT invalid(regime) · AMZN invalid(no_setup) · IBM refused(insufficient_history)
 *   ORCL ok with an evaluator unknown(missing_fact) (hand-set entry) · TSLA under another triple · META malformed.
 */
export async function menuSnapshotSet({ session, fetchedAt }) {
  const out = {};
  out.AAPL = await snapshotFor({ session, symbol: 'AAPL', fetchedAt, rows: breakoutRows(session) });
  out.MSFT = await snapshotFor({ session, symbol: 'MSFT', fetchedAt, rows: downRows(session) });
  out.AMZN = await snapshotFor({ session, symbol: 'AMZN', fetchedAt });
  out.IBM = await snapshotFor({ session, symbol: 'IBM', fetchedAt, rows: upRows(session, 20) });
  const orcl = await snapshotFor({ session, symbol: 'ORCL', fetchedAt });
  out.ORCL = { ...orcl, snapshot: { ...orcl.snapshot, entry: { ...orcl.snapshot.entry, verdict: 'unknown', reason: 'missing_fact', pattern: null, regime: 'unknown' } } };
  const tsla = await snapshotFor({ session, symbol: 'TSLA', fetchedAt });
  out.TSLA = { ...tsla, snapshot: { ...tsla.snapshot, key: { ...tsla.snapshot.key, ruleSet: { ...tsla.snapshot.key.ruleSet, thresholdsHash: '000000000000' } } } };
  const meta = await snapshotFor({ session, symbol: 'META', fetchedAt });
  out.META = { ...meta, snapshot: { ...meta.snapshot, schemaVersion: 2 } };
  return out;
}
