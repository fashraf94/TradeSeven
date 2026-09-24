// api/_utils/callRecords/flip.js
//
// Cockpit Build 0 — ENCOUNTER FLIPS (spec docs/design/COCKPIT_SPEC_V1_3.md
// §3.8; contract docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §4, §6).
//
// WHEN: at every `Flips? = yes` row of §3.4, after that exit's authoritative
// write, under §3.7's budget rule for its class — the model-result row inside
// the model-path phase (publish.js runModelCallsPhase, which injects
// runCallFlips), every other row through runExitCallsHook here (the non-model
// rule: run only at available ≥ 2,000; deadline min(now + 2,000, the tail
// boundary)). Requires an active mode and a usable observation for THIS exit —
// a check never flips against another check's instant.
//
// THE SCAN: `calls` where state == 'open', orderBy mintedAt asc then
// __name__ asc (the document-id tie-break), page 50, starting AFTER the
// persisted cursor `cronState.callFlips.cursor` ({ mintedAt, callId }; absent →
// the collection start). Pages continue until the deadline; reaching the end
// wraps to the start and stops AT the persisted cursor, so one check covers
// the collection at most once and old unresolved calls cannot monopolize the
// deadline across checks. The query needs the composite index
// `calls: state ASC, mintedAt ASC, __name__ ASC` (firestore.indexes.json); the
// first scan per process validates it, and a missing index is logged loudly
// and skipped for INDEX_RECHECK_MS instead of failing every check.
//
// PER CALL, ONE TRANSACTION re-reading the call and the parent (a page read is
// only a hint — the transaction re-decides everything):
//   skip if not open, the parent is not active, the call was minted by THIS
//   check (never a hit on the minting check), or observedAtMs ≤ mintedAt;
//   observedAtMs > expiresAt → `expired_unresolved`;
//   else the symbol in the observation and px > level (above) / px < level
//   (below) → `hit`;
//   the first observed transition creates the companion receipt
//   (receipt.js) in the same transaction and sets outcome.receiptRef;
//   outcome.actedEvalId ONLY on the model-result row, from the committed
//   executor result, when it matches the call's WHOLE declared trade.
// Immutable fields and playerResponse are never rewritten; a call is never
// written with merge. Sequential transactions, ≤ 800 ms each, none started
// after the deadline; a timeout is unconfirmed.

import { withTimeout } from '../intraday/evaluatorHook.js';
import { callsActive } from './mode.js';
import { observationUsable, FLIP_EXITS } from './observe.js';
import { buildReceipt, receiptPathOf } from './receipt.js';
import {
  callsBudget, writeCallsStatus, composeCallsDiag, CallsAbort, isCallsTimeout,
  NON_MODEL_PHASE_MS, STATUS_RESERVE_MS,
} from './publish.js';

/** The scan's page size. */
export const FLIP_PAGE_SIZE = 50;
/** One flip transaction's ceiling. */
export const FLIP_TX_MS = 800;
/** How long a missing index is trusted before the scan re-validates it. */
export const INDEX_RECHECK_MS = 10 * 60_000;
/** The §3.4 rows whose flips run under the NON-model rule (every flip row but the model result). */
export const NON_MODEL_FLIP_EXITS = Object.freeze(FLIP_EXITS.filter((e) => e !== 'model_result'));
/** The exact server query, as data (the index row of the suite validates it against firestore.indexes.json). */
export const FLIP_QUERY = Object.freeze({
  collectionGroup: 'calls',
  queryScope: 'COLLECTION',
  equality: Object.freeze([Object.freeze({ fieldPath: 'state', value: 'open' })]),
  orderBy: Object.freeze([
    Object.freeze({ fieldPath: 'mintedAt', order: 'ASCENDING' }),
    Object.freeze({ fieldPath: '__name__', order: 'ASCENDING' }),
  ]),
});

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A persisted cursor, or null when absent or malformed. */
export function cursorOf(c) {
  return c && finite(c.mintedAt) && nonEmpty(c.callId) ? { mintedAt: c.mintedAt, callId: c.callId } : null;
}

/**
 * The transition an observation proves for an OPEN call, or null.
 * Expiry wins when the observation is outside the horizon; a `hit` needs the
 * symbol in the observation with a finite positive quote.
 */
export function decideFlip(call, observation) {
  const at = observation.observedAtMs;
  const expiresAt = call?.horizon?.expiresAt;
  if (finite(expiresAt) && at > expiresAt) return 'expired_unresolved';
  if (call?.kind === 'pick') return null;
  const px = observation.symbols?.[call?.symbol]?.px;
  const level = call?.condition?.level;
  if (!(finite(px) && px > 0) || !finite(level)) return null;
  const side = call.condition.side;
  if ((side === 'above' && px > level) || (side === 'below' && px < level)) return 'hit';
  return null;
}

/**
 * Does the committed executor result match the call's WHOLE declared trade?
 * entry ↔ symbolIn === symbol, tier === slot, symbolOut === counterpart when declared;
 * exit  ↔ symbolOut === symbol, tier === slot, symbolIn === counterpart when declared;
 * pick  ↔ symbolIn ∈ options, symbolOut === swapOut, tier === slot, and the
 *         selected option when one is bound (Build 0 has no selection surface —
 *         the answer endpoint is Build 1 — so the caller passes none).
 * The resolved slot must be a concrete index; a field the executor did not
 * return is null, and a null never matches.
 */
export function matchesWholeTrade(call, executorResult, { selectedSymbol = null } = {}) {
  const r = executorResult;
  if (!r || !nonEmpty(r.symbolIn) || !nonEmpty(r.symbolOut) || !nonEmpty(r.tier)) return false;
  if (!(Number.isInteger(r.slotIndex) && r.slotIndex >= 0)) return false;
  if (r.tier !== call?.slot) return false;
  if (call.kind === 'pick') {
    const options = Array.isArray(call.options) ? call.options.map((o) => o?.symbol) : [];
    if (!options.includes(r.symbolIn) || r.symbolOut !== call.swapOut) return false;
    return selectedSymbol === null || r.symbolIn === selectedSymbol;
  }
  if (call.direction === 'entry') {
    return r.symbolIn === call.symbol && (call.counterpart == null || r.symbolOut === call.counterpart);
  }
  if (call.direction === 'exit') {
    return r.symbolOut === call.symbol && (call.counterpart == null || r.symbolIn === call.counterpart);
  }
  return false;
}

/**
 * What this check may do to one call, decided from a read of it. `skip` names
 * why nothing happens; otherwise `next` (a transition or null) and `acted`.
 * Pure — the page read uses it as a hint and the transaction as the authority.
 */
export function planFlip(call, { observation, evalId, executorResult }) {
  if (!call || call.state !== 'open') return { skip: 'not_open' };
  if (evalId !== null && call.evalId === evalId) return { skip: 'minting_check' };
  if (!(finite(call.mintedAt) && observation.observedAtMs > call.mintedAt)) return { skip: 'before_mint' };
  const next = decideFlip(call, observation);
  const acted = evalId !== null && executorResult != null
    && !(isPlainObject(call.outcome) && call.outcome.actedEvalId)
    && matchesWholeTrade(call, executorResult);
  if (!next && !acted) return { skip: 'no_change' };
  return { next, acted };
}

// ---------------------------------------------------------------------------
// The index validation memo (per process).

const flipIndex = { state: 'unknown', missingSinceMs: null };

/** 'unknown' | 'ok' | 'missing' — what the first scan of this process learned. */
export function flipIndexState() {
  return flipIndex.state;
}

/** Tests only: forget what this process learned about the index. */
export function resetFlipIndexMemo() {
  flipIndex.state = 'unknown';
  flipIndex.missingSinceMs = null;
}

function isIndexMissing(err) {
  const msg = String(err?.message || '');
  return err?.code === 9 || /FAILED_PRECONDITION/.test(msg) || /requires an index/i.test(msg);
}

// ---------------------------------------------------------------------------

/** One call's transaction. Never throws. */
async function flipOne({ db, battleId, callId, observation, evalId, executorResult, deadlineMs }) {
  const budgetMs = Math.min(FLIP_TX_MS, deadlineMs - Date.now());
  if (budgetMs <= 0) return { result: 'not_started' };
  const attemptDeadlineMs = Date.now() + budgetMs;
  const flipCallRef = db.collection('agentBattles').doc(battleId).collection('calls').doc(callId);
  const flipParentRef = db.collection('agentBattles').doc(battleId);
  const receiptRef = db.collection('agentBattles').doc(battleId).collection('callObservations').doc(callId);
  try {
    return await withTimeout(db.runTransaction(async (tx) => {
      if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
      const [callSnap, parentSnap] = await tx.getAll(flipCallRef, flipParentRef);
      const parent = parentSnap?.exists ? parentSnap.data() : null;
      if (!parent || parent.status !== 'active') return { result: 'skipped', reason: 'parent_terminal' };
      if (!callSnap?.exists) return { result: 'skipped', reason: 'missing' };
      const call = callSnap.data();
      const plan = planFlip(call, { observation, evalId, executorResult });
      if (plan.skip) return { result: 'skipped', reason: plan.skip };
      // The reads can outlast the ceiling: nothing is written — so no commit is
      // issued — once it has passed (review E-1).
      if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
      const outcome = { ...(isPlainObject(call.outcome) ? call.outcome : {}) };
      const change = {};
      if (plan.next) {
        tx.create(receiptRef, buildReceipt({ call, evalId, observation }));
        outcome.receiptRef = receiptPathOf(battleId, callId);
        change.state = plan.next;
        change.stateChangedAt = observation.observedAtMs;
        change.stateSource = 'check';
      }
      if (plan.acted) outcome.actedEvalId = evalId;
      change.outcome = outcome;
      tx.update(flipCallRef, change);
      return { result: 'flipped', next: plan.next, acted: plan.acted };
    }), budgetMs, 'calls_flip');
  } catch (err) {
    if (err?.callsAbort === 'deadline' || isCallsTimeout(err)) return { result: 'unconfirmed' };
    const error = String(err?.message || err).slice(0, 200);
    console.error(`[calls] flip failed battle=${battleId} call=${callId}: ${error}`);
    return { result: 'failed', error };
  }
}

/**
 * THE SCAN (§3.8). Never throws.
 *
 * @param {object} callsCtx
 * @param {object} p
 * @param {object} p.db
 * @param {object} p.battle      the in-memory battle (its persisted cursor)
 * @param {number} p.deadlineMs  the shared deadline (minus the status slice)
 * @returns {Promise<{ status: object|null, diag: object }|null>}
 */
export async function runCallFlips(callsCtx, { db, battle, deadlineMs }) {
  if (!callsCtx || !callsActive(callsCtx.mode)) return null;
  const observation = callsCtx.observation;
  if (!observationUsable(observation)) return { status: null, diag: { stopped: 'no_observation' } };
  const startedMs = Date.now();
  const battleId = battle.id;
  const evalId = callsCtx.evalIdentity?.evalId ?? null;
  // actedEvalId: the model-result row only, with a committed identity.
  const executorResult = callsCtx.exit === 'model_result' && evalId !== null ? (callsCtx.executorResult ?? null) : null;
  const startCursor = cursorOf(battle?.cronState?.callFlips?.cursor);
  const diag = {
    scanned: 0, hit: 0, expired: 0, acted: 0, receipts: 0, skipped: {}, unconfirmed: 0, failed: 0,
    pages: 0, wrapped: false, complete: false, index: flipIndex.state, stopped: null, ms: 0,
  };
  const finish = (cursor, complete) => {
    diag.complete = complete;
    diag.index = flipIndex.state;
    diag.ms = Date.now() - startedMs;
    return {
      status: { evalId, cursor: complete ? null : cursor, scanned: diag.scanned, total: complete ? diag.scanned : null, complete },
      diag,
    };
  };

  if (flipIndex.state === 'missing' && Date.now() - flipIndex.missingSinceMs < INDEX_RECHECK_MS) {
    diag.stopped = 'index_missing';
    return finish(startCursor, false);
  }

  const openCalls = db.collection('agentBattles').doc(battleId).collection('calls')
    .where('state', '==', 'open')
    .orderBy('mintedAt', 'asc')
    .orderBy('__name__', 'asc');

  let leg = 'tail';            // after the persisted cursor → the end; then 'head': the start → the cursor
  let pageAfter = startCursor; // the exclusive lower bound of the next page
  let cursor = startCursor;    // where the next check resumes
  for (;;) {
    if (Date.now() >= deadlineMs) { diag.stopped = 'deadline'; return finish(cursor, false); }
    let q = openCalls;
    if (pageAfter) q = q.startAfter(pageAfter.mintedAt, pageAfter.callId);
    if (leg === 'head' && startCursor) q = q.endAt(startCursor.mintedAt, startCursor.callId);
    q = q.limit(FLIP_PAGE_SIZE);
    let page;
    try {
      page = await withTimeout(q.get(), deadlineMs - Date.now(), 'calls_flip_query');
    } catch (err) {
      if (isIndexMissing(err)) {
        flipIndex.state = 'missing';
        flipIndex.missingSinceMs = Date.now();
        diag.stopped = 'index_missing';
        console.error(`[calls] flip index MISSING — deploy the calls composite (state, mintedAt, __name__) from firestore.indexes.json; flips skipped for ${INDEX_RECHECK_MS / 60_000} min: ${String(err?.message || err).slice(0, 160)}`);
      } else {
        diag.stopped = isCallsTimeout(err) ? 'deadline' : 'query_failed';
      }
      return finish(cursor, false);
    }
    flipIndex.state = 'ok';
    diag.pages += 1;
    const docs = page?.docs || [];
    for (const doc of docs) {
      if (Date.now() >= deadlineMs) { diag.stopped = 'deadline'; return finish(cursor, false); }
      const call = doc.data();
      const position = { mintedAt: call?.mintedAt, callId: doc.id };
      diag.scanned += 1;
      const plan = planFlip(call, { observation, evalId, executorResult });
      if (plan.skip) {
        diag.skipped[plan.skip] = (diag.skipped[plan.skip] || 0) + 1;
      } else {
        const res = await flipOne({ db, battleId, callId: doc.id, observation, evalId, executorResult, deadlineMs });
        if (res.result === 'not_started') { diag.scanned -= 1; diag.stopped = 'deadline'; return finish(cursor, false); }
        if (res.result === 'flipped') {
          if (res.next === 'hit') diag.hit += 1;
          if (res.next === 'expired_unresolved') diag.expired += 1;
          if (res.next) diag.receipts += 1;
          if (res.acted) diag.acted += 1;
        } else if (res.result === 'skipped') {
          diag.skipped[res.reason] = (diag.skipped[res.reason] || 0) + 1;
          if (res.reason === 'parent_terminal') {
            cursor = cursorOf(position) ?? cursor;
            diag.stopped = 'parent_terminal';
            return finish(cursor, false);
          }
        } else if (res.result === 'unconfirmed') {
          diag.unconfirmed += 1;
        } else {
          diag.failed += 1;
        }
      }
      cursor = cursorOf(position) ?? cursor;
      pageAfter = position;
    }
    if (docs.length < FLIP_PAGE_SIZE) {
      if (leg === 'tail' && startCursor) {
        leg = 'head';
        pageAfter = null;
        diag.wrapped = true;
        continue;
      }
      return finish(cursor, true);
    }
  }
}

/**
 * A NON-MODEL exit's calls hook (§3.8 under §3.7's non-model rule): the flips
 * and one status write, or nothing at all. Never throws.
 *
 * @param {object} callsCtx
 * @param {object} p
 * @param {object} p.db
 * @param {object} p.battle
 * @param {number} p.timeBudgetMs  the handler's TIME_BUDGET_MS (the one clock)
 */
export async function runExitCallsHook(callsCtx, { db, battle, timeBudgetMs }) {
  if (!callsCtx || !callsActive(callsCtx.mode)) return null;
  if (!NON_MODEL_FLIP_EXITS.includes(callsCtx.exit)) return null;
  if (!observationUsable(callsCtx.observation)) return null;
  const startedMs = Date.now();
  const budget = callsBudget({ handlerStartMs: callsCtx.handlerStartMs, timeBudgetMs, nowMs: startedMs, phaseMs: NON_MODEL_PHASE_MS });
  if (!budget.run) {
    // Nothing starts — the protected tail belongs to the finally's narrations
    // and capture. The encounter coverage this check forfeits is logged.
    console.log(`[calls] flips skipped battle=${battle.id} exit=${callsCtx.exit} available=${budget.available}ms (< ${NON_MODEL_PHASE_MS})`);
    return { skipped: 'budget', available: budget.available, flips: null, status: 'skipped' };
  }
  const flips = await runCallFlips(callsCtx, { db, battle, deadlineMs: budget.deadlineMs - STATUS_RESERVE_MS });
  const fields = {
    ...(flips?.status ? { 'cronState.callFlips': flips.status } : {}),
    'cronState.callsDiag': composeCallsDiag({
      evalId: callsCtx.evalIdentity?.evalId ?? null,
      exit: callsCtx.exit,
      phaseResult: 'none',
      flips: flips?.diag ?? null,
      truncated: callsCtx.diag.truncated,
      faults: callsCtx.diag.faults,
      ms: Date.now() - startedMs,
    }),
  };
  const status = await writeCallsStatus({ db, battleId: battle.id, fields, deadlineMs: budget.deadlineMs });
  console.log(`[calls] flips battle=${battle.id} exit=${callsCtx.exit} scanned=${flips?.diag?.scanned ?? 0} hit=${flips?.diag?.hit ?? 0} expired=${flips?.diag?.expired ?? 0} complete=${flips?.status?.complete ?? false} stopped=${flips?.diag?.stopped ?? 'none'} status=${status}`);
  return { skipped: null, flips, status };
}
