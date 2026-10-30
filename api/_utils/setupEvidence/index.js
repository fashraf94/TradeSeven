// api/_utils/setupEvidence/index.js
//
// ID-1 Build 1 — THE SHARED SETUP-EVIDENCE STORE (shape note V1.4 §3): one
// immutable, dated snapshot per (completed session, symbol, rule set), of what the
// Trend Follower's setup rule said about a stock and the price evidence it said it
// from. A framework library: NOTHING CALLS IT in this build. Slice 2, the ID-1
// observer and the Practice Field will, each behind its own gate
// (setupEvidenceImportGuard.test.js pins the importers).
//
// THE CLOCK IS A FUNCTION, `now: () => Date`, read before the claim, before the
// request and again when the response arrives. A plain Date could only ever stamp a
// time taken before the request, which the contract forbids, so it is refused.
//
// A session a request may not name is answered before any read, claim or fetch: an
// unmaintained year or a future date is retryable; a malformed date, a non-session
// or a session that has not closed throws. Crypto is excluded before all of that.
// A programming error after the lease was taken releases the lease, under its token,
// then throws, so the next caller need not wait out the 120 seconds.
//
// @see store.js for the protocol, classify.js for the table, acquire.js for the read.

import { expectedCompletedSession } from '../setupEvaluator/dailyBarsAdapter.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { isCryptoSymbol } from '../marketDataCache.js';
import { acquireOnce, readClock, snapshotDocOf } from './acquire.js';
import { classifyAcquisitionFailure, classifyEvidence, classifySessionRequest, detailHashOf, DISPOSITIONS, SetupEvidenceProgrammingError } from './classify.js';
import { snapshotIdOf } from './key.js';
import { claimSnapshot, createFinal, readFinal, releaseClaimLease, settleConfirmation } from './store.js';

export { lastCompletedSessionAt } from './sessionAt.js';
export { parseSnapshotId, ruleKeyOf, snapshotIdOf } from './key.js';
export { SetupEvidenceProgrammingError } from './classify.js';

/** The snapshot of (session, symbol, rule set), or null. Read only; never fetches. */
export async function readSnapshot({ db, session, symbol, ruleSet }) {
  return readFinal({ db, id: snapshotIdOf({ session, symbol, ruleSet }) });
}

/**
 * The snapshot of (session, symbol, the current rule set): the stored one, or one
 * acquisition under a lease.
 *
 * @param {object} args
 * @param {object} args.db Admin Firestore
 * @param {string} args.session a completed session (lastCompletedSessionAt)
 * @param {string} args.symbol
 * @param {() => Date} args.now the injected clock
 * @param {Function} [args.fetchPayload] the provider read (eodhdDailyWindow.js fetchDailyPayload)
 * @param {string} [args.host] who is asking, for the lease and the writer stamp
 * @returns {Promise<{ status: 'final', snapshot: object } | { status: 'pending' }
 *   | { status: 'retryable', reason: string } | { status: 'excluded', reason: 'unsupported_symbol_class' }>}
 */
export async function getOrAcquireSnapshot({ db, session, symbol, now, fetchPayload, host }) {
  if (isCryptoSymbol(symbol)) return { status: 'excluded', reason: 'unsupported_symbol_class' };
  const ruleSet = describeRuleSet();
  const id = snapshotIdOf({ session, symbol, ruleSet });

  const refused = classifySessionRequest(expectedCompletedSession({ asOf: session, now: readClock(now) }), { session });
  if (refused?.disposition === DISPOSITIONS.PROGRAMMING_ERROR) throw new SetupEvidenceProgrammingError(refused.reason, refused.detail);
  if (refused) return { status: 'retryable', reason: refused.reason };

  const claim = await claimSnapshot({ db, id, now, host });
  if (claim.status === 'final') return { status: 'final', snapshot: claim.snapshot };
  if (claim.status === 'pending') return { status: 'pending' };
  const { token } = claim;

  let settled = false;
  try {
    const acquired = await acquireOnce({ session, symbol, now, fetchPayload });
    const verdict = acquired.failure ? classifyAcquisitionFailure(acquired.failure) : classifyEvidence(acquired.evidence, { session });
    if (verdict.disposition === DISPOSITIONS.PROGRAMMING_ERROR) throw new SetupEvidenceProgrammingError(verdict.reason, verdict.detail);
    if (verdict.disposition === DISPOSITIONS.RETRYABLE) return { status: 'retryable', reason: verdict.reason };
    const doc = snapshotDocOf({ session, symbol, ruleSet, acquired, host });
    const result = verdict.disposition === DISPOSITIONS.FINAL
      ? { status: 'final', snapshot: await createFinal({ db, id, token, doc }) }
      : await settleConfirmation({ db, id, token, reason: verdict.reason, detailHash: detailHashOf(verdict.detail), acquired, doc });
    settled = true; // each releases the lease in its own commit
    return result;
  } finally {
    if (!settled) await releaseClaimLease({ db, id, token }).catch((err) => console.warn(`[setupEvidence] ${id}: lease release failed: ${err?.message}`));
  }
}
