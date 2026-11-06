// api/_utils/activationEvidence/__fixtures__/activationSnapshots.js
//
// Real snapshot documents for the observer's tests: the store's own acquisition
// (setupEvidence/acquire.js acquireOnce + snapshotDocOf) over an injected payload,
// so every field — the entry record, its swing low, capturedAt, key.ruleSet — is
// the shape the store writes. No network, no Firestore.

import { acquireOnce, snapshotDocOf } from '../../setupEvidence/acquire.js';
import { snapshotIdOf } from '../../setupEvidence/key.js';
import { describeRuleSet } from '../../setupEvaluator/thresholds.js';
import { tradingDates } from '../../setupEvaluator/__fixtures__/syntheticBars.js';

/** Raw /eod/ rows, newest first, on real sessions: a steady uptrend with adjusted closes (a final, ok snapshot). */
export function upRows(session, n = 80) {
  return tradingDates(n, session).map((date, i) => {
    const close = 200 - 0.5 * i;
    return { date, open: close, high: close + 2, low: close - 2, close, adjusted_close: close, volume: 1_000_000 + i };
  });
}

/** A snapshot document as the store would create it, for (session, symbol), fetched at `fetchedAt`. */
export async function snapshotFor({ session, symbol, fetchedAt, rows = upRows(session) }) {
  const at = new Date(fetchedAt);
  const acquired = await acquireOnce({ session, symbol, now: () => at, fetchPayload: async () => structuredClone(rows) });
  if (acquired.failure) throw new Error(`fixture acquisition failed: ${acquired.failure}`);
  const ruleSet = describeRuleSet();
  return { snapshotId: snapshotIdOf({ session, symbol, ruleSet }), snapshot: snapshotDocOf({ session, symbol, ruleSet, acquired, host: 'fixture' }) };
}

/** A payload with the newest session's bar missing: retryable, never finalised by the store. */
export const rowsWithoutNewest = (session, n = 80) => upRows(session, n + 1).slice(1);
