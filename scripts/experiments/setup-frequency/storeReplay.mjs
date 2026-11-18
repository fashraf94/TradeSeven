// scripts/experiments/setup-frequency/storeReplay.mjs
//
// Setup frequency count — THE REPLAY, THROUGH THE STORE'S OWN PURE FUNCTIONS (prompt §1 rules 3 and 5). No acquire
// path is called: not getOrAcquireSnapshot, not acquireOnce. The chain is the one acquireOnce runs
// (api/_utils/setupEvidence/acquire.js:95–130) and the one getOrAcquireSnapshot classifies with (index.js:70), called
// here in the same order on a slice of one long series fetched once per symbol (fetchBars.mjs):
//
//   requestWindowOf  (acquire.js:56)   the store's request range for the session (130 calendar days to it)
//   mapDailyRows     (marketDataCache.js:317), newest first, as the store requests (`order: 'd'`)
//   attachAdjustedClose, buildDailyEvidence with MIN_COMPLETED_BARS (setupEvaluator/dailyBarsAdapter.js:116, :139)
//   evaluateTfEntry  (setupEvaluator/tfSetupV1.js:360)
//   classifyEvidence (setupEvidence/classify.js:68): final / confirm / retryable / programming_error, the split
//                    refusal (basis_discontinuity) included.
//
// THE CLOCK is injected per session: the session's own close (the calendar of record), so the adapter's expected
// completed session is the session itself. The bars class is stated as what it is, `later_reconstruction`.
// acquireOnce's one step that is not exported — refusing a payload whose mapper dropped a row with a bad or duplicate
// date — is not copied: every slice's drop count is returned instead, and the run reports it.
//
// setupEvidenceImportGuard.test.js lists this file by exact name.

import { requestWindowOf, EVIDENCE_SOURCE } from '../../../api/_utils/setupEvidence/acquire.js';
import { classifyEvidence } from '../../../api/_utils/setupEvidence/classify.js';
import { attachAdjustedClose, buildDailyEvidence } from '../../../api/_utils/setupEvaluator/dailyBarsAdapter.js';
import { evaluateTfEntry } from '../../../api/_utils/setupEvaluator/tfSetupV1.js';
import { MIN_COMPLETED_BARS } from '../../../api/_utils/setupEvaluator/thresholds.js';
import { mapDailyRows } from '../../../api/_utils/marketDataCache.js';
import { getSessionForDate } from '../../../api/_utils/marketSchedule.js';

export { lastCompletedSessionAt } from '../../../api/_utils/setupEvidence/sessionAt.js';

/** The store's request answered from the long series: rows in [from, to], newest first, as fresh objects. */
export function sliceOf(series, session) {
  const { from, to } = requestWindowOf(session);
  return { from, to, payload: series.filter((r) => r.date >= from && r.date <= to).map((r) => ({ ...r })) };
}

/**
 * One (symbol, session) through the store's pure chain.
 * @returns {{ evidence: object, entry: object, disposition: object, dropped: number }}
 */
export function replayOne({ series, symbol, session, fetchedAt }) {
  const { from, to, payload } = sliceOf(series, session);
  const mapped = mapDailyRows(payload);
  const rows = attachAdjustedClose(mapped.rows, payload);
  const now = new Date(getSessionForDate(session).closeMs);
  const evidence = buildDailyEvidence({
    rows, asOf: session, now, minBars: MIN_COMPLETED_BARS, source: EVIDENCE_SOURCE,
    sourceMeta: { fetchedAt, from, to }, barsClass: 'later_reconstruction', symbol,
  });
  const entry = evaluateTfEntry(evidence);
  return { evidence, entry, disposition: classifyEvidence(evidence, { session }), dropped: mapped.dropped };
}

/** The compact record the analysis reads: the verdict fields, the regime, what is missing, the refusal and the extension limit. */
export function compactOf({ evidence, entry: e, disposition, dropped }) {
  const ext = Array.isArray(e.checks) ? e.checks.find((c) => c.id === 'extension') : null;
  return {
    v: e.verdict,
    r: e.reason ?? null,
    p: e.pattern ?? null,
    ps: e.patternsSatisfied ?? [],
    rg: e.regime ?? null,
    m: e.missing ?? [],
    ok: evidence.ok === true,
    rf: e.refusal ? e.refusal.reason : null,
    rfDate: e.refusal?.detail?.date ?? null,
    d: disposition.disposition,
    dr: disposition.reason ?? null,
    C: e.factsUsed?.C?.value ?? null,
    extLimit: ext && Number.isFinite(ext.rhs) ? ext.rhs : null,
    dropped,
  };
}

/**
 * The compression inputs at a session (prompt §6), as the rankings producer reads its bars: mapDailyRows over the
 * store's request window (closes are the mapper's `close`, highs and lows its raw fields), newest first.
 */
export function rankingBarsAt(series, session) {
  return mapDailyRows(sliceOf(series, session).payload).rows;
}
