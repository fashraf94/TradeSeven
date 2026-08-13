// api/_utils/mandateRollover.js
//
// Spec 1 — Mandate Substrate — rollover core (§5.3 / D-37 / F7 / F21 / F23 /
// FR-1 / I1 / I4 / I15). The atomic per-boundary transaction + the per-book
// catch-up loop. The cron handler (api/cron/mandate-rollover.js) owns the
// calendar gate and the cursor-paged sweep; this module owns the money-and-
// identity transaction so it is testable directly against a transaction-faithful
// fake (three revision writers now: executeDecision + closeBook + rollOneBoundary).
//
// THE CHARTER HANDSHAKE (FR-1, transaction-asserted per I15): capital carries
// forward across the boundary, same archetype or different. The rollover
// transaction NEVER writes cash, positions, totalValue, initialValue, or the
// lifetime lens; `assertCapitalConserved` proves the write-set cannot touch
// capital and that the only totalValue-derived write (the tenure-lens reset)
// equals the carried value — a real invariant against an independent in-txn
// pre-read, never an x===x tautology (money-review M2).
//
// IDEMPOTENCY (F7): the boundary is bound to a specific quarterIndex. A replay
// or a losing concurrent writer re-reads the advanced book and skips
// (already_rolled / not_due) — so a rollover replayed twice produces one summary
// (acceptance #4). The summary is derived from the tagged rows the close pass
// wrote (I4), never the book doc at processing time.

import { publishVintage, VINTAGE_COLLECTION, resolveVintage } from './mandateVintage.js';
import { deriveQuarterSummary } from './mandateQuarterSummary.js';
import { buildQuarterKey, deriveManagerAgentId, buildDecision } from './mandateSchema.js';
import { getCadenceTier } from './mandateGenerationConfig.js';
import { computeNextRolloverAt } from './mandateCalendar.js';
import {
  MANDATE_ROLLOVER_CATCHUP_CAP,
  MANDATE_VALUE_CONSERVE_TOLERANCE_USD,
  MANDATE_FRICTION_MODEL_VERSION,
} from './mandateConfig.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Normalize a Firestore Timestamp | Date | ISO string | millis to a Date (or null). */
function toDate(v) {
  if (v == null) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// FR-1 — capital fields the rollover write-set must NEVER contain.
function isCapitalKey(k) {
  return k === 'portfolio.totalValue' || k === 'portfolio.initialValue'
    || k === 'portfolio.cash' || k.startsWith('portfolio.cash.')
    || k === 'portfolio.positions' || k.startsWith('portfolio.positions.')
    || k.startsWith('portfolio.lifetime');
}

/**
 * FR-1 / I15 enforcement (M2-safe). Throws if the rollover write-set would alter
 * capital, if the pre-read total is not a sane positive number, or if the
 * tenure-lens reset does not equal the carried total. Exported so the assertion
 * itself is directly testable with a crafted violating patch.
 */
export function assertCapitalConserved(preTotalValue, patch) {
  if (!Number.isFinite(preTotalValue) || preTotalValue <= 0) {
    throw new Error(`FR-1: rollover pre-read totalValue is not a positive number (${preTotalValue})`);
  }
  for (const k of Object.keys(patch || {})) {
    if (isCapitalKey(k)) {
      throw new Error(`FR-1 violation: rollover write-set would alter capital field '${k}' — capital must carry unchanged`);
    }
  }
  const qhwm = patch?.['portfolio.quarterHighWaterMark'];
  if (qhwm !== undefined && Math.abs(num(qhwm) - preTotalValue) > MANDATE_VALUE_CONSERVE_TOLERANCE_USD) {
    throw new Error(`FR-1 violation: quarterHighWaterMark reset (${qhwm}) != carried totalValue (${preTotalValue})`);
  }
}

/**
 * Roll ONE quarter boundary for one book, atomically (§5.3 F7). Processes the
 * boundary ending the book's CURRENT quarterIndex; a book that already advanced
 * (winner / replay) skips.
 *
 * @param {Firestore} db
 * @param {DocumentReference} mandateRef
 * @param {object} opts
 * @param {Date}   opts.now
 * @param {string} [opts.archetype]     target archetype (V1 default: continue current). A different
 *                                      one changes archetype/managerAgentId/vintageRef, NOT capital (FR-1).
 * @param {Function} [opts.patchMutator] test-only seam (default identity): mutate the write patch
 *                                      before the FR-1 assertion, to observe the assertion firing
 *                                      end-to-end (accelerated-clock harness / mutation guard). Never
 *                                      set in production.
 * @returns {Promise<object>} { rolled, skipped?, oldQuarterIndex?, newQuarterIndex?, summary?,
 *                              boundaryAt?, nextRolloverAt?, vintageRef?, archetype? }
 */
export async function rollOneBoundary(db, mandateRef, { now = new Date(), archetype = null, patchMutator = (p) => p } = {}) {
  // 1. Outside-txn read: fix the boundary we are processing (its quarterIndex)
  //    and the target archetype for the vintage publish. The txn re-reads
  //    authoritatively and binds to this quarterIndex — a concurrent advance
  //    makes the retry skip, never process a wrong boundary with stale rows.
  const preSnap = await mandateRef.get();
  if (!preSnap.exists) return { rolled: false, skipped: 'no_book' };
  const pre = preSnap.data();
  const expectedQuarterIndex = pre.quarterIndex;
  const targetArchetype = archetype || pre.archetype;

  // 2. Re-pin the CURRENT published vintage for the target archetype (idempotent,
  //    content-addressed). publishVintage → buildVintagePayload ASSERTS the frozen
  //    composition resolves to the current ARCHETYPE_IDENTITY_VERSION (Risk-3),
  //    throwing BEFORE any write — a stale/candidate composition aborts the
  //    rollover, it never publishes mid-transaction.
  const cadenceTier = getCadenceTier(targetArchetype);
  if (!cadenceTier) throw new Error(`MANDATE_ROLLOVER_UNKNOWN_ARCHETYPE '${targetArchetype}'`);
  const { vintageRef } = await publishVintage(db, targetArchetype);
  // Risk-3, explicit: the pinned ref must resolve to an EXISTING vintage doc.
  const { docId } = resolveVintage(targetArchetype);
  const vintageDoc = await db.collection(VINTAGE_COLLECTION).doc(docId).get();
  if (!vintageDoc.exists) {
    throw new Error(`MANDATE_ROLLOVER_VINTAGE_MISSING ${vintageRef} — publish resolved no doc; aborting (Risk-3)`);
  }
  const newManagerAgentId = deriveManagerAgentId(pre.userId, targetArchetype); // FR-7: stable per user×archetype

  // 3. Pre-read the OLD quarter's rows (immutable family — the close pass writes
  //    each once; safe under txn retry). The summary derives from these (I4).
  const rowsSnap = await mandateRef.collection('dailyRows').orderBy('date', 'asc').get();
  const priorRows = rowsSnap.docs.map((d) => d.data());

  // 4. The atomic boundary transaction.
  return db.runTransaction(async (tx) => {
    const bookSnap = await tx.get(mandateRef);
    if (!bookSnap.exists) return { rolled: false, skipped: 'no_book' };
    const book = bookSnap.data();

    if (book.status !== 'active') return { rolled: false, skipped: 'not_active' };
    // Bind to the specific boundary: a concurrent winner (or a replay) advanced
    // quarterIndex → skip; the catch-up loop re-invokes fresh for the next one.
    if (book.quarterIndex !== expectedQuarterIndex) return { rolled: false, skipped: 'already_rolled' };
    // Defensive idempotency key (§5.3): this quarter already processed.
    if (book.execState?.lastProcessedRolloverKey === book.quarterKey) return { rolled: false, skipped: 'already_rolled' };
    // Not yet due (a winner advanced nextRolloverAt, or the boundary hasn't arrived).
    const boundaryAt = toDate(book.nextRolloverAt);
    if (!boundaryAt || boundaryAt.getTime() > now.getTime()) return { rolled: false, skipped: 'not_due' };

    const oldQuarterIndex = book.quarterIndex;
    const oldQuarterKey = book.quarterKey;
    const newQuarterIndex = oldQuarterIndex + 1;
    const newQuarterKey = buildQuarterKey(mandateRef.id, newQuarterIndex);

    // The OLD tenure's summary — derived from its tagged rows, boundaries logical
    // (never processing-time). Archetype + vintageRef are what SERVED that quarter.
    const summary = deriveQuarterSummary(priorRows, {
      quarterIndex: oldQuarterIndex,
      archetype: book.archetype,
      vintageRef: book.vintageRef,
      quarterStartAt: book.quarterStartAt ?? null,
      quarterEndAt: book.nextRolloverAt ?? null,
    });

    const newNextRolloverAt = computeNextRolloverAt(boundaryAt).at; // I4: same normalizer as creation

    // FR-1 (I15): capital carries. Independent in-txn pre-read.
    const preTotalValue = num(book.portfolio?.totalValue);

    // The write patch — dotted leaves so untouched book fields (incl. all of
    // capital and the lifetime lens and every health/exec carry-through) survive.
    let patch = {
      quarterIndex: newQuarterIndex,
      quarterKey: newQuarterKey,
      quarterStartAt: boundaryAt,               // §5.3: the logical boundary, never processing time
      nextRolloverAt: newNextRolloverAt,
      archetype: targetArchetype,               // same unless a re-choose override (DEF-1)
      managerAgentId: newManagerAgentId,         // same unless archetype changed (FR-7)
      vintageRef,                                // re-pinned to the current published vintage (§5.1)
      cadenceTier,                               // recomputed from the new vintage (F23)
      'portfolio.quarterHighWaterMark': preTotalValue, // tenure lens reset (§5.3) — carried value
      'portfolio.quarterDrawdownFromPeak': 0,
      'execState.lastProcessedRolloverKey': oldQuarterKey, // idempotency (§5.3)
      'health.consecutiveRolloverFailures': 0,   // a committed rollover ends the failure streak
      revision: (book.revision || 0) + 1,
    };

    // Open-batch disposal (I1): a book crossing a boundary with an open batch has
    // it cancelled INSIDE this transaction — stale batches never cross a boundary.
    // Dormant under direct transport (openBatchId always null until P5).
    const openBatchId = book.execState?.openBatchId ?? null;
    if (openBatchId) {
      patch['execState.openBatchId'] = null;
      patch['execState.openBatchSubmittedAt'] = null;
    }

    // Test-only injection seam, then the FR-1 assertion (M2-safe).
    patch = patchMutator(patch) || patch;
    assertCapitalConserved(preTotalValue, patch);

    // Writes (reads-before-writes: the only tx.get is the book above; rows +
    // vintage were pre-read outside the txn).
    tx.set(mandateRef.collection('quarterSummaries').doc(String(oldQuarterIndex)), summary);
    if (openBatchId) {
      tx.set(mandateRef.collection('decisions').doc(openBatchId), buildDecision({
        decisionId: openBatchId, verb: null, ticker: null, status: 'cancelled',
        frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
      }));
    }
    tx.update(mandateRef, patch);

    return {
      rolled: true,
      oldQuarterIndex, newQuarterIndex,
      summary,
      boundaryAt,
      nextRolloverAt: newNextRolloverAt,
      vintageRef, archetype: targetArchetype,
      cancelledBatch: openBatchId,
    };
  });
}

/**
 * Catch up ONE book across all its due boundaries (F21), oldest first, ONE
 * atomic transaction per boundary. Stops when the book is no longer due
 * (nextRolloverAt > now), already advanced, or the cap is reached (a deeper
 * backlog spills to the next fire).
 *
 * @returns {Promise<{ processed: object[], boundaries: number, cappedOut: boolean }>}
 */
export async function catchUpBook(db, mandateRef, { now = new Date(), archetype = null, cap = MANDATE_ROLLOVER_CATCHUP_CAP, patchMutator = (p) => p } = {}) {
  const processed = [];
  let cappedOut = false;
  for (let i = 0; i < cap; i++) {
    const r = await rollOneBoundary(db, mandateRef, { now, archetype, patchMutator });
    if (!r.rolled) break; // not_due / already_rolled / not_active → caught up
    processed.push(r);
    if (i === cap - 1) cappedOut = true; // hit the per-fire cap with a boundary still processed
  }
  return { processed, boundaries: processed.length, cappedOut };
}
