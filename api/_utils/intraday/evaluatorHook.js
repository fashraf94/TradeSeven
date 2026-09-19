// api/_utils/intraday/evaluatorHook.js
//
// Intraday Data — Build 1, contract §8.1: the evaluator's ISOLATED read of
// intradaySnapshots/latest (once per invocation) and the per-battle,
// per-tick view write to agentBattles/{battleId}/intradayViews/{evalId}
// (set-merge, idempotent on retry). Each is wrapped, bounded to 2 s, and
// non-fatal: every failure mode resolves to a status string and the trading
// evaluation proceeds unchanged. Nothing here throws.
//
//   read:  'ok' | 'no_snapshot' | 'snapshot_invalid' | 'read_failed'
//   write: 'written' | 'write_failed'

import { validateSnapshot, VIEW_STATUS, INTRADAY_ENTRY_FIELDS } from './view.js';
import { snapshotRef, definitionsRef } from './intradayStore.js';

export const INTRADAY_HOOK_TIMEOUT_MS = 2_000;
export const VIEWS_SUBCOLLECTION = 'intradayViews';

/** Race a promise against a timer; the timer is always cleared. */
export function withTimeout(promise, ms, label = 'intraday') {
  let timer = null;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms); });
  return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

/**
 * @returns {Promise<{status: string, snapshot: object|null, snapshotId: string|null, generation: number|null, error?: string}>}
 */
export async function readIntradaySnapshot(db, { timeoutMs = INTRADAY_HOOK_TIMEOUT_MS } = {}) {
  try {
    const snap = await withTimeout(snapshotRef(db).get(), timeoutMs, 'intraday_snapshot_read');
    const data = snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    const v = validateSnapshot(data);
    if (!v.ok) return { status: v.reason, snapshot: null, snapshotId: null, generation: null };
    return { status: 'ok', snapshot: data, snapshotId: data.sweepId, generation: data.generation };
  } catch (err) {
    return { status: VIEW_STATUS.READ_FAILED, snapshot: null, snapshotId: null, generation: null, error: err?.message || String(err) };
  }
}

/**
 * Set-merge the view beside the check. Never throws.
 * @returns {Promise<{status: 'written'|'write_failed', viewRef: string|null, error?: string}>}
 */
export async function writeIntradayView(db, { battleId, view, timeoutMs = INTRADAY_HOOK_TIMEOUT_MS } = {}) {
  const viewRef = `agentBattles/${battleId}/${VIEWS_SUBCOLLECTION}/${view?.evalId}`;
  try {
    if (!battleId || !view || typeof view.evalId !== 'string' || !view.evalId) throw new Error('intraday_view_invalid');
    const ref = db.collection('agentBattles').doc(battleId).collection(VIEWS_SUBCOLLECTION).doc(view.evalId);
    await withTimeout(ref.set(view, { merge: true }), timeoutMs, 'intraday_view_write');
    return { status: VIEW_STATUS.WRITTEN, viewRef };
  } catch (err) {
    return { status: VIEW_STATUS.WRITE_FAILED, viewRef: null, error: err?.message || String(err) };
  }
}

/**
 * The eight pointer fields the evaluation entry carries (§8.1) — the ONLY
 * intraday keys on an entry. `intradayViewRef` is the evalId of the written
 * view (the client renders diagnostics only when `intradayViewRef === evalId`
 * AND the fetched document's evalId matches).
 */
export function composeIntradayEntryFields({ status, snapshotId = null, generation = null, viewWritten = false, evalId = null, evaluatedAt = null, policyVersion = 1, decisionStartedAt = null, decisionCompletedAt = null }) {
  const out = {
    intradaySnapshotId: snapshotId ?? null,
    intradayGeneration: Number.isFinite(generation) ? generation : null,
    intradayViewRef: viewWritten ? evalId : null,
    intradayViewStatus: status,
    intradayEvaluatedAt: evaluatedAt ?? null,
    intradayPolicyVersion: policyVersion,
    decisionStartedAt: decisionStartedAt ?? null,
    decisionCompletedAt: decisionCompletedAt ?? null,
  };
  for (const k of Object.keys(out)) if (!INTRADAY_ENTRY_FIELDS.includes(k)) throw new Error(`unexpected intraday entry field ${k}`);
  return out;
}

/** Create-if-missing the immutable definitions document (§8.2). Never throws. */
export async function ensureDefinitionsDoc(db, definitions, { timeoutMs = INTRADAY_HOOK_TIMEOUT_MS } = {}) {
  try {
    const ref = definitionsRef(db, definitions.calcVersion);
    const snap = await withTimeout(ref.get(), timeoutMs, 'intraday_definitions_read');
    if (snap && snap.exists) return { status: 'exists' };
    await withTimeout(ref.set(definitions), timeoutMs, 'intraday_definitions_write');
    return { status: 'created' };
  } catch (err) {
    return { status: 'failed', error: err?.message || String(err) };
  }
}
