// scripts/experiments/setup-frequency/storeReplay.mjs
//
// Setup frequency count — THE REPLAY, THROUGH THE STORE'S OWN CODE (prompt §1 rule 3). This is the one module of the
// experiment that imports the shared setup-evidence store, and it imports only its pure acquisition and classifier:
//
//   acquireOnce      (api/_utils/setupEvidence/acquire.js:95)  — the store's request window (130 calendar days to the
//                    session, newest first), mapDailyRows, the date-defect refusal, attachAdjustedClose,
//                    buildDailyEvidence with MIN_COMPLETED_BARS, and evaluateTfEntry, in that order;
//   classifyEvidence (api/_utils/setupEvidence/classify.js:68) — final / confirm / retryable / programming_error, the
//                    split refusal (basis_discontinuity) included.
//
// The provider is replaced by a slice of one long series fetched once per symbol (fetchBars.mjs): `fetchPayload`
// answers the store's own { from, to, order: 'd' } request with the series' rows in that range, newest first, as fresh
// objects. The clock is the instant that long series was received, read by acquireOnce before and after its "fetch"
// exactly as it reads the real one; it is never invented. Nothing here reads or writes the store's collections:
// getOrAcquireSnapshot, claimSnapshot and every other store.js export stay unimported.
//
// setupEvidenceImportGuard.test.js lists this file by exact name.

import { acquireOnce } from '../../../api/_utils/setupEvidence/acquire.js';
import { classifyAcquisitionFailure, classifyEvidence } from '../../../api/_utils/setupEvidence/classify.js';
import { mapDailyRows } from '../../../api/_utils/marketDataCache.js';

export { lastCompletedSessionAt } from '../../../api/_utils/setupEvidence/sessionAt.js';

/** The provider stand-in: the store's request answered from the long series (newest first). */
export function sliceProvider(series) {
  return async (symbol, { from, to, order } = {}) => {
    if (order !== 'd') throw new TypeError('storeReplay: the store asks newest first');
    return series.filter((r) => r.date >= from && r.date <= to).map((r) => ({ ...r }));
  };
}

/**
 * One (symbol, session) through the store's acquisition and classifier.
 * @returns {Promise<{ acquired: object, disposition: { disposition: string, reason: string|null, detail: object|null } }>}
 */
export async function replayOne({ series, symbol, session, receivedAtMs }) {
  const now = () => new Date(receivedAtMs);
  const acquired = await acquireOnce({ session, symbol, now, fetchPayload: sliceProvider(series) });
  const disposition = acquired.failure ? classifyAcquisitionFailure(acquired.failure) : classifyEvidence(acquired.evidence, { session });
  return { acquired, disposition };
}

/** The compact record the analysis reads: the verdict fields, the regime, what is missing, the refusal and the extension limit. */
export function compactOf({ acquired, disposition }) {
  if (acquired.failure) return { failure: acquired.failure, d: disposition.disposition };
  const e = acquired.entry;
  const ext = Array.isArray(e.checks) ? e.checks.find((c) => c.id === 'extension') : null;
  return {
    v: e.verdict,
    r: e.reason ?? null,
    p: e.pattern ?? null,
    ps: e.patternsSatisfied ?? [],
    rg: e.regime ?? null,
    m: e.missing ?? [],
    ok: acquired.evidence.ok === true,
    rf: e.refusal ? e.refusal.reason : null,
    rfDate: e.refusal?.detail?.date ?? null,
    d: disposition.disposition,
    dr: disposition.reason ?? null,
    C: e.factsUsed?.C?.value ?? null,
    extLimit: ext && Number.isFinite(ext.rhs) ? ext.rhs : null,
  };
}

/**
 * The compression inputs at a session (prompt §6), as the rankings producer reads its bars: mapDailyRows over the
 * store's own request window (closes are the mapper's `close`, highs and lows its raw fields), newest first.
 */
export function rankingBarsAt(series, session, fromDate) {
  const rows = series.filter((r) => r.date >= fromDate && r.date <= session);
  return mapDailyRows(rows).rows;
}
