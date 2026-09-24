// api/_utils/callRecords/publish.js
//
// Cockpit Build 0 — PUBLICATION (spec docs/design/COCKPIT_SPEC_V1_3.md §3.7;
// contract docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §2.1, §3, §9).
//
// WHERE: the model-result path only, after the final evaluation update has
// resolved and before narration dispatch. One transaction, serialized with
// completion, under one deadline taken from the SHARED handler clock.
//
// THE BUDGET — one clock for every hook:
//   remaining = handlerStartMs + TIME_BUDGET_MS − now
//   available = remaining − TAIL_RESERVE_MS          (12,000 ms protected tail)
//   model path: run only if available ≥ 4,000; deadline = min(now + 4,000, tail boundary)
//   non-model:  run only if available ≥ 2,000; deadline = min(now + 2,000, tail boundary)
// The tail is protected because every exit still enters the `finally`, where
// narrations are awaited and capture spends what is left. Every read,
// canonicalization, transaction attempt, flip, receipt, reference and status
// attempt shares the deadline; nothing starts after it; a timeout is
// UNCONFIRMED; the platform kill buffer is never available. The admission
// reserve (4,000 ms added to the pre-call requirement at shadow/on) is what
// makes the model-path phase affordable in the first place.
//
// THE TRANSACTION (only when the entry said `expected`):
//   1. read the parent — status 'active' and cronState.evalSeq ≥ evalSeq, else
//      abort `parent_terminal` (the read is in the conflict set, so a
//      completion committing between read and commit aborts the attempt and
//      the retry reads 'completed');
//   2. read the declarations record and every call — present and identical in
//      canonical form → idempotent success (nothing written); any difference
//      → abort `call_conflict` (originals preserved, both ids logged);
//   3. with open calls (`newOpen` non-empty): read the sweep queue and arm
//      nextExpiresAt = min(existing finite value, finite expiries of newOpen);
//      with none (declarations-only, or every call invalidated): no queue read
//      and no queue write, and an existing queue document is left unchanged;
//   4. create the record and every call; set the queue with merge ONLY in the
//      non-empty branch. Never `merge` on a call; never Infinity/null/undefined
//      in the queue.
//
// THE PHASE WIRE is the contract's two values only —
// `cronState.declarationsPhase = { evalId, phase: 'written' | 'failed' }` —
// written after the outcome is known: `written` only once the commit returned
// (or an existence re-read after a timeout found the identical documents);
// `failed` on parent_terminal, call_conflict, skipped_budget, a thrown
// transaction, or a re-read that found nothing; LEFT UNCHANGED when a timeout
// could not be re-read (the diagnostics say `unconfirmed`). Richer detail lives
// in `cronState.callsDiag` (diagnostics, bounded, not a reader wire) and the
// structured log. Capture references come from CONFIRMED results only.

import { withTimeout } from '../intraday/evaluatorHook.js';
import { callsActive } from './mode.js';
import { buildMintCandidate, canonicalCall, canonicalRecord } from './candidate.js';

/** The admission reserve added to the pre-call requirement at shadow/on (§3.7). */
export const CALLS_RESERVE_MS = 4_000;
/** The protected tail — the finally's narration + capture work (§3.7). */
export const TAIL_RESERVE_MS = 12_000;
/** The model-path phase window. */
export const MODEL_PHASE_MS = 4_000;
/** A non-model hook's window. */
export const NON_MODEL_PHASE_MS = 2_000;
/** The slice of a phase kept for its one status write. */
export const STATUS_RESERVE_MS = 500;
/** The slice kept for the existence re-read after a publication timeout. */
export const REREAD_RESERVE_MS = 500;
/** A status-only write when the phase itself cannot run (skipped_budget). */
export const STATUS_ONLY_MS = 1_000;
/** Bounded diagnostic lists. */
export const DIAG_LIST_CAP = 8;

/** The contract's phase wire — two values, nothing else (§2.1). */
export const PHASE_WIRE_VALUES = Object.freeze(['written', 'failed']);
/** Per-id publication results (contract §3). */
export const PER_ID_RESULTS = Object.freeze(['confirmed', 'rejected', 'unconfirmed']);
/** What the phase diagnostics can say (never a reader wire). */
export const PHASE_RESULTS = Object.freeze([
  'written', 'idempotent', 'parent_terminal', 'call_conflict', 'threw', 'skipped_budget',
  'timeout_present', 'timeout_absent', 'timeout_conflict', 'unconfirmed', 'nothing_to_write', 'none',
]);

/** The admission reserve for a resolved mode: 4,000 ms at shadow/on, 0 at off. */
export function callsReserveMsFor(mode) {
  return callsActive(mode) ? CALLS_RESERVE_MS : 0;
}

/**
 * The shared clock. `run` is whether the hook may start; `deadlineMs` is the
 * one absolute deadline everything inside it shares.
 */
export function callsBudget({ handlerStartMs, timeBudgetMs, nowMs, phaseMs }) {
  const tailBoundaryMs = handlerStartMs + timeBudgetMs - TAIL_RESERVE_MS;
  const available = tailBoundaryMs - nowMs;
  return {
    run: available >= phaseMs,
    available,
    tailBoundaryMs,
    deadlineMs: Math.min(nowMs + phaseMs, tailBoundaryMs),
  };
}

/** A typed abort raised inside the publication transaction. */
export class CallsAbort extends Error {
  constructor(reason) {
    super(`calls_abort_${reason}`);
    this.callsAbort = reason;
  }
}

/** Did a withTimeout race reject (the helper's `<label>_timeout_<ms>ms` message)? */
export const isCallsTimeout = (err) => String(err?.message || '').includes('_timeout_');
const isTimeout = isCallsTimeout;
const finiteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * THE TRANSACTION (§3.7). Never throws.
 *
 * Every attempt checks the deadline FIRST (the SDK retries a contended
 * transaction, and no attempt may start after the deadline — "nothing starts
 * after it") and AGAIN between its reads and its first write (reads can
 * outlast the deadline; the SDK issues the commit as soon as the body returns).
 * An attempt refused either way is treated like a timeout — an earlier
 * attempt's outcome is not provably absent — so the bounded existence re-read
 * decides, exactly as for a timeout.
 *
 * @returns {Promise<{ phaseResult: string, wire: 'written'|'failed'|null, perId: Array<{id:string, result:string, reason?:string}>, confirmedCallIds: string[], ms: number }>}
 */
export async function publishDeclarations({ db, battleId, candidate, evalSeq, txDeadlineMs, rereadDeadlineMs }) {
  const startedMs = Date.now();
  const evalId = candidate.record.evalId;
  const recordId = `declarations/${evalId}`;
  const ids = [recordId, ...candidate.calls.map((c) => c.callId)];
  const all = (result, reason) => ids.map((id) => ({ id, result, ...(reason ? { reason } : {}) }));
  const done = (phaseResult, wire, perId, confirmedCallIds = []) => ({ phaseResult, wire, perId, confirmedCallIds, ms: Date.now() - startedMs });
  const confirmedIds = () => candidate.calls.map((c) => c.callId);

  const txBudget = txDeadlineMs - Date.now();
  if (txBudget <= 0) return done('skipped_budget', 'failed', all('rejected', 'skipped_budget'));

  const publishBattleRef = db.collection('agentBattles').doc(battleId);
  const publishDeclarationsRef = db.collection('agentBattles').doc(battleId).collection('declarations').doc(evalId);
  const publishQueueRef = db.collection('callSweepQueue').doc(battleId);
  const existingCallRefs = candidate.calls.map((c) => db.collection('agentBattles').doc(battleId).collection('calls').doc(c.callId));
  const sameAsCandidate = (declSnap, callSnaps) => declSnap?.exists
    && canonicalRecord(declSnap.data()) === candidate.canonical.record
    && callSnaps.every((s, i) => s?.exists && canonicalCall(s.data()) === candidate.canonical.calls[candidate.calls[i].callId]);

  try {
    const outcome = await withTimeout(db.runTransaction(async (tx) => {
      if (Date.now() >= txDeadlineMs) throw new CallsAbort('deadline');
      // ONE round trip: the parent, the record, every call — all in the
      // conflict set, all before any write.
      const [parentSnap, declSnap, ...callSnaps] = await tx.getAll(publishBattleRef, publishDeclarationsRef, ...existingCallRefs);
      // 1. THE PARENT.
      const parent = parentSnap?.exists ? parentSnap.data() : null;
      const committedSeq = Number(parent?.cronState?.evalSeq);
      if (!parent || parent.status !== 'active' || !(Number.isFinite(committedSeq) && committedSeq >= evalSeq)) {
        throw new CallsAbort('parent_terminal');
      }
      // 2. THE EXISTING PUBLICATION — identical → idempotent; anything else → conflict.
      if (declSnap?.exists || callSnaps.some((s) => s?.exists)) {
        if (sameAsCandidate(declSnap, callSnaps)) return { idempotent: true };
        throw new CallsAbort('call_conflict');
      }
      // 3. THE QUEUE — read and armed only when this publication opens a call.
      let nextExpiresAt = null;
      if (candidate.newOpen.length > 0) {
        // No second read starts after the deadline either (review E-1).
        if (Date.now() >= txDeadlineMs) throw new CallsAbort('deadline');
        const queueSnap = await tx.get(publishQueueRef);
        const existing = queueSnap?.exists ? queueSnap.data()?.nextExpiresAt : undefined;
        const finiteExpiries = candidate.newOpen.map((c) => c.horizon?.expiresAt).filter(finiteNumber);
        const armable = [...(finiteNumber(existing) ? [existing] : []), ...finiteExpiries];
        nextExpiresAt = armable.length > 0 ? Math.min(...armable) : null;
      }
      // The reads can outlast the deadline: re-check before the first write,
      // so no commit is ever ISSUED after it (review E-1). A commit already in
      // flight at the deadline stays unconfirmed — the re-read decides.
      if (Date.now() >= txDeadlineMs) throw new CallsAbort('deadline');
      // 4. CREATE-ONCE — the record and every call; the queue with merge.
      tx.create(publishDeclarationsRef, candidate.record);
      for (const call of candidate.calls) {
        const newCallRef = db.collection('agentBattles').doc(battleId).collection('calls').doc(call.callId);
        tx.create(newCallRef, call);
      }
      if (finiteNumber(nextExpiresAt)) {
        tx.set(publishQueueRef, { battleId, nextExpiresAt, updatedAt: candidate.record.mintedAt }, { merge: true });
      }
      return { idempotent: false };
    }), txBudget, 'calls_publish');
    return done(outcome?.idempotent ? 'idempotent' : 'written', 'written', all('confirmed'), confirmedIds());
  } catch (err) {
    const reason = err?.callsAbort;
    if (reason === 'parent_terminal' || reason === 'call_conflict') {
      if (reason === 'call_conflict') {
        console.error(`[calls] call_conflict battle=${battleId} evalId=${evalId} ids=${ids.join(',')} — originals preserved`);
      }
      return done(reason, 'failed', all('rejected', reason));
    }
    if (reason !== 'deadline' && !isTimeout(err)) {
      console.error(`[calls] publication threw battle=${battleId} evalId=${evalId}: ${String(err?.message || err).slice(0, 200)}`);
      return done('threw', 'failed', all('rejected', 'threw'));
    }
    // A TIMEOUT IS UNCONFIRMED: the commit may still land. One bounded
    // existence re-read, inside the deadline, decides the wire; without it the
    // wire is left unchanged.
    const rereadBudget = rereadDeadlineMs - Date.now();
    if (rereadBudget <= 0) return done('unconfirmed', null, all('unconfirmed', 'timeout'));
    try {
      const [declSnap, ...callSnaps] = await withTimeout(db.getAll(publishDeclarationsRef, ...existingCallRefs), rereadBudget, 'calls_publish_reread');
      if (!declSnap?.exists) return done('timeout_absent', 'failed', all('unconfirmed', 'timeout_absent'));
      if (sameAsCandidate(declSnap, callSnaps)) return done('timeout_present', 'written', all('confirmed'), confirmedIds());
      return done('timeout_conflict', 'failed', all('rejected', 'timeout_conflict'));
    } catch {
      return done('unconfirmed', null, all('unconfirmed', 'reread_failed'));
    }
  }
}

/**
 * The removals as ONE bounded log token — per (source, reason) counts in
 * first-appearance order, or `none`. callsDiag keeps only the latest check's
 * removals (every later check overwrites it), so the phase log line is where
 * a malformed or fully removed block stays readable per check (review B-4).
 */
export function removedLogToken(removed) {
  const groups = [];
  for (const r of Array.isArray(removed) ? removed : []) {
    const group = groups.find((g) => g.source === r?.source && g.reason === r?.reason);
    if (group) group.count += 1;
    else groups.push({ source: r?.source, reason: r?.reason, count: 1 });
  }
  return groups.length ? groups.map((g) => `${g.source}:${g.reason}x${g.count}`).join(',') : 'none';
}

/** The bounded diagnostics document (never a reader wire). */
export function composeCallsDiag({ evalId = null, exit = null, phaseResult = 'none', perId = [], removed = [], flips = null, truncated = false, faults = [], ms = null }) {
  return {
    evalId,
    exit,
    phaseResult,
    perId: perId.slice(0, DIAG_LIST_CAP),
    removed: removed.slice(0, DIAG_LIST_CAP).map((r) => ({ source: r.source, index: r.index ?? null, reason: r.reason })),
    flips: flips ?? null,
    truncated: truncated === true,
    faults: (Array.isArray(faults) ? faults : []).slice(0, DIAG_LIST_CAP),
    ms,
  };
}

/**
 * The ONE status write of a calls phase: the battle document's cronState keys,
 * started only before the deadline and bounded by it. Never throws.
 *
 * @returns {Promise<'written'|'unconfirmed'|'failed'|'skipped'>}
 */
export async function writeCallsStatus({ db, battleId, fields, deadlineMs }) {
  const budget = deadlineMs - Date.now();
  if (budget <= 0 || !fields || Object.keys(fields).length === 0) return 'skipped';
  const statusRef = db.collection('agentBattles').doc(battleId);
  try {
    await withTimeout(statusRef.update(fields), budget, 'calls_status');
    return 'written';
  } catch (err) {
    return isTimeout(err) ? 'unconfirmed' : 'failed';
  }
}

/** The capture references a phase may record: confirmed calls only. */
export function captureRefsFor(candidate, confirmedCallIds) {
  if (!candidate?.record) return [];
  const confirmed = new Set(confirmedCallIds);
  return candidate.record.minted.filter((m) => confirmed.has(m.callId)).map((m) => ({ callId: m.callId, n: m.n, kind: m.kind }));
}

/**
 * THE MODEL-PATH PHASE (§3.7 + §3.8): publication (when the entry said
 * `expected`), then the flips, then ONE status write — all under the shared
 * clock. Runs only on the model-result row with a committed evaluation
 * identity. Never throws; returns what it did.
 *
 * @param {object} callsCtx
 * @param {object} p
 * @param {object} p.db
 * @param {object} p.battle           the in-memory battle (frozen context)
 * @param {number} p.timeBudgetMs     the handler's TIME_BUDGET_MS (the one clock)
 * @param {string|null} p.promptBuiltAt
 * @param {string|null} p.tickId      the capture tick id, or null (capture off)
 * @param {(ctx: object, opts: { db: object, battle: object, battleId: string, deadlineMs: number }) => Promise<object>} [p.flips]
 *   the flip runner (§3.8: flip.js runCallFlips), injected so this module never imports flip.js
 */
export async function runModelCallsPhase(callsCtx, { db, battle, timeBudgetMs, promptBuiltAt, tickId, flips = null }) {
  if (!callsCtx || !callsActive(callsCtx.mode) || callsCtx.exit !== 'model_result' || !callsCtx.evalIdentity) return null;
  const battleId = battle.id;
  const { evalId, evalSeq } = callsCtx.evalIdentity;
  const startedMs = Date.now();
  const expected = callsCtx.declarations?.phase === 'expected';
  const budget = callsBudget({ handlerStartMs: callsCtx.handlerStartMs, timeBudgetMs, nowMs: startedMs, phaseMs: MODEL_PHASE_MS });
  const removedPre = callsCtx.declarations?.validation?.removed ?? [];

  if (!budget.run) {
    // The phase does not run. A status-only write may still say so, inside the
    // tail boundary — never into the protected tail.
    const phaseResult = 'skipped_budget';
    const fields = {
      ...(expected ? { 'cronState.declarationsPhase': { evalId, phase: 'failed' } } : {}),
      'cronState.callsDiag': composeCallsDiag({ evalId, exit: callsCtx.exit, phaseResult, removed: removedPre, truncated: callsCtx.diag.truncated, faults: callsCtx.diag.faults, ms: 0 }),
    };
    const status = await writeCallsStatus({ db, battleId, fields, deadlineMs: Math.min(startedMs + STATUS_ONLY_MS, budget.tailBoundaryMs) });
    console.log(`[calls] phase battle=${battleId} evalId=${evalId} result=${phaseResult} available=${budget.available}ms removed=${removedLogToken(removedPre)} status=${status}`);
    return { phaseResult, wire: expected ? 'failed' : null, captureRefs: [], status, flips: null };
  }

  const workDeadlineMs = budget.deadlineMs - STATUS_RESERVE_MS;
  let phaseResult = 'none';
  let wire = null;
  let perId = [];
  let removed = removedPre;
  let captureRefs = [];

  if (expected) {
    const mintedAtMs = Date.now();
    const candidate = buildMintCandidate({
      battleId, evalId, evalSeq, mintedAtMs,
      raw: callsCtx.declarations.raw,
      universe: callsCtx.universe,
      observation: callsCtx.observation,
      promptBuiltAt,
      tickId,
      battle,
    });
    removed = candidate.removed;
    if (!candidate.record) {
      // Expected at the commit, emptied at mint (a horizon crossed in between):
      // expected + no document is `failed` on the wire.
      phaseResult = 'nothing_to_write';
      wire = 'failed';
    } else {
      const pub = await publishDeclarations({
        db, battleId, candidate, evalSeq,
        txDeadlineMs: workDeadlineMs - REREAD_RESERVE_MS,
        rereadDeadlineMs: workDeadlineMs,
      });
      phaseResult = pub.phaseResult;
      wire = pub.wire;
      perId = pub.perId;
      captureRefs = captureRefsFor(candidate, pub.confirmedCallIds);
    }
  }

  const flipResult = typeof flips === 'function'
    ? await flips(callsCtx, { db, battle, battleId, deadlineMs: workDeadlineMs })
    : null;

  const fields = {
    ...(wire ? { 'cronState.declarationsPhase': { evalId, phase: wire } } : {}),
    ...(flipResult?.status ? { 'cronState.callFlips': flipResult.status } : {}),
    'cronState.callsDiag': composeCallsDiag({
      evalId, exit: callsCtx.exit, phaseResult, perId, removed, flips: flipResult?.diag ?? null,
      truncated: callsCtx.diag.truncated, faults: callsCtx.diag.faults, ms: Date.now() - startedMs,
    }),
  };
  const status = await writeCallsStatus({ db, battleId, fields, deadlineMs: budget.deadlineMs });
  console.log(`[calls] phase battle=${battleId} evalId=${evalId} result=${phaseResult} wire=${wire ?? 'unchanged'} perId=${JSON.stringify(perId)} removed=${removedLogToken(removed)} status=${status} ms=${Date.now() - startedMs}`);
  return { phaseResult, wire, perId, captureRefs, status, flips: flipResult };
}
