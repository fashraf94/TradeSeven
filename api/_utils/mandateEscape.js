// api/_utils/mandateEscape.js
//
// Spec 1 — Mandate Substrate — the ESCAPE HATCH transaction (§5.4 / D-3 / FR-3 /
// F6 / I1 / I17). A single re-assignment within the first 14 days, once ever per
// user: a correction of a bad ASSIGNMENT, not a manager change. The old book
// closes flagged `voided:true` with a NON-SCORING quarter summary; the
// replacement starts fresh at MANDATE_STARTING_CAPITAL.
//
// D-3 — NEVER BLOCKABLE BY PLUMBING: an open batch is CANCELLED inside the
// transaction, never refused. Every precondition is validated INSIDE one
// transaction; userMeta.mandateEscapeHatchUsed and activeMandateId are written
// in the SAME transaction as the close+create (F6 — never a follow-up write).

import { publishVintage, VINTAGE_COLLECTION, resolveVintage } from './mandateVintage.js';
import { deriveQuarterSummary } from './mandateQuarterSummary.js';
import {
  buildNewMandateDoc, buildDecision, deriveManagerAgentId,
} from './mandateSchema.js';
import { getCadenceTier } from './mandateGenerationConfig.js';
import { listArchetypeIds } from './archetypeRegistry.js';
import { computeNextRolloverAt } from './mandateCalendar.js';
import { MANDATE_STARTING_CAPITAL, MANDATE_FRICTION_MODEL_VERSION } from './mandateConfig.js';

function toDate(v) {
  if (v == null) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Perform the escape-hatch re-assignment for `userId`.
 *
 * @param {Firestore} db
 * @param {object} opts
 * @param {string} opts.userId          the authenticated uid (owner)
 * @param {string} opts.archetype       the replacement archetype
 * @param {Date}   [opts.now]
 * @param {string} [opts.requestKey]    idempotency key (§7) — a retry returns the replacement it made
 * @returns {Promise<
 *   | { ok:true, oldMandateId, newMandateId, vintageRef, managerAgentId, cadenceTier, quarterKey,
 *       nextRolloverAt, idempotentReplay:boolean }
 *   | { ok:false, code:'unknown_archetype'|'no_active_book'|'escape_already_used'|'book_missing'
 *              |'not_owner'|'not_active'|'escape_window_expired'|'concurrent_modification' }
 * >}
 */
export async function escapeMandate(db, { userId, archetype, now = new Date(), requestKey = null }) {
  if (!db) throw new Error('escapeMandate: db required');
  if (!userId) throw new Error('escapeMandate: userId required');
  if (!archetype || !listArchetypeIds().includes(archetype)) {
    return { ok: false, code: 'unknown_archetype' };
  }
  const cadenceTier = getCadenceTier(archetype);
  if (!cadenceTier) return { ok: false, code: 'unknown_archetype' };

  const userMetaRef = db.collection('userMeta').doc(userId);

  // Outside-txn read to fix the OLD book (for the immutable dailyRows pre-read).
  const metaSnap0 = await userMetaRef.get();
  const meta0 = metaSnap0.exists ? metaSnap0.data() : {};
  // Idempotent replay short-circuit (no writes): the escape already ran with this key.
  if (requestKey && meta0.lastEscapeRequestKey === requestKey) {
    return {
      ok: true, idempotentReplay: true,
      oldMandateId: meta0.escapeReplacedMandateId ?? null,
      newMandateId: meta0.activeMandateId ?? null,
    };
  }
  const oldMandateId = meta0.activeMandateId ?? null;
  if (!oldMandateId) return { ok: false, code: 'no_active_book' };

  const oldMandateRef = db.collection('mandates').doc(oldMandateId);
  const rowsSnap = await oldMandateRef.collection('dailyRows').orderBy('date', 'asc').get();
  const priorRows = rowsSnap.docs.map((d) => d.data());

  // Publish + assert the REPLACEMENT vintage (Risk-3) BEFORE the transaction.
  const { vintageRef } = await publishVintage(db, archetype);
  const { docId } = resolveVintage(archetype);
  const vDoc = await db.collection(VINTAGE_COLLECTION).doc(docId).get();
  if (!vDoc.exists) throw new Error(`MANDATE_ESCAPE_VINTAGE_MISSING ${vintageRef} (Risk-3)`);
  const managerAgentId = deriveManagerAgentId(userId, archetype); // FR-7 stable per user×archetype

  const newMandateRef = db.collection('mandates').doc(); // pre-allocate the replacement id
  const newMandateId = newMandateRef.id;

  return db.runTransaction(async (tx) => {
    const metaSnap = await tx.get(userMetaRef);
    const meta = metaSnap.exists ? metaSnap.data() : {};

    // Authoritative idempotent replay.
    if (requestKey && meta.lastEscapeRequestKey === requestKey) {
      return { ok: true, idempotentReplay: true, oldMandateId: meta.escapeReplacedMandateId ?? null, newMandateId: meta.activeMandateId ?? null };
    }
    if (!meta.activeMandateId) return { ok: false, code: 'no_active_book' };
    // Once ever (F6) — checked BEFORE the stale-rows guard so a LOSING concurrent
    // escape gets the terminal 'escape_already_used' (the winner set the flag),
    // not a retryable 'concurrent_modification'.
    if (meta.mandateEscapeHatchUsed === true) return { ok: false, code: 'escape_already_used' };
    // The rows were pre-read for THIS old book; a change with the flag still false
    // means some other concurrent op moved the active book — retry with fresh rows.
    if (meta.activeMandateId !== oldMandateId) return { ok: false, code: 'concurrent_modification' };

    const bookSnap = await tx.get(oldMandateRef);
    if (!bookSnap.exists) return { ok: false, code: 'book_missing' };
    const book = bookSnap.data();
    if (book.userId !== userId) return { ok: false, code: 'not_owner' };
    if (book.status !== 'active') return { ok: false, code: 'not_active' };
    // "First book, within 14 days" (§5.4). A rolled book (>3mo) has no live window;
    // the replacement's window is null. Absent/expired → refuse the ACTION (not a
    // plumbing refusal — this is the eligibility rule D-3 is scoped by).
    const eligibleUntil = toDate(book.escapeHatchEligibleUntil);
    if (!eligibleUntil || now.getTime() > eligibleUntil.getTime()) {
      return { ok: false, code: 'escape_window_expired' };
    }
    // F6 race guard: the tx.get above IS the revision precondition (the fake +
    // real Admin SDK abort the loser on a concurrent commit to this doc).

    const oldQuarterIndex = book.quarterIndex;

    // Terminal NON-SCORING summary (FR-3) — derived from the old book's rows like
    // any other; the void flag (not emptiness) is what excludes it from scoring.
    const summary = deriveQuarterSummary(priorRows, {
      quarterIndex: oldQuarterIndex,
      archetype: book.archetype,
      vintageRef: book.vintageRef,
      voided: true,
      quarterStartAt: book.quarterStartAt ?? null,
      quarterEndAt: now,
    });

    // Open-batch disposal (I1 / D-3): cancel INSIDE the txn, never refuse.
    const openBatchId = book.execState?.openBatchId ?? null;

    // The replacement book — fresh capital, new archetype/vintage/manager,
    // quarterIndex 1, NO escape window (once ever), I-5 cohort-flagged and linked.
    const createdAt = new Date(now.getTime());
    const newDoc = {
      ...buildNewMandateDoc({
        mandateId: newMandateId,
        userId,
        archetype,
        managerAgentId,
        vintageRef,
        cadenceTier,
        createdAt,
        quarterStartAt: createdAt,
        nextRolloverAt: computeNextRolloverAt(createdAt).at,
        escapeHatchEligibleUntil: null, // once ever means once ever
        startingCapital: MANDATE_STARTING_CAPITAL,
      }),
      escapeCohort: true,               // I-5 cohort
      escapeReplacementOf: oldMandateId, // link to the voided book
    };

    // ── Writes (reads-before-writes: userMeta + old book gotten above) ──
    // 1. Terminal summary on the OLD book.
    tx.set(oldMandateRef.collection('quarterSummaries').doc(String(oldQuarterIndex)), summary);
    // 2. Cancel an open batch (dormant under direct transport).
    if (openBatchId) {
      tx.set(oldMandateRef.collection('decisions').doc(openBatchId), buildDecision({
        decisionId: openBatchId, verb: null, ticker: null, status: 'cancelled',
        frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
      }));
    }
    // 3. Close + void the old book (I-5 cohort-flagged).
    tx.update(oldMandateRef, {
      status: 'closed',
      voided: true,
      escapeCohort: true,
      escapeReplacedBy: newMandateId,
      revision: (book.revision || 0) + 1,
      ...(openBatchId ? { 'execState.openBatchId': null, 'execState.openBatchSubmittedAt': null } : {}),
    });
    // 4. Create the replacement.
    tx.set(newMandateRef, newDoc);
    // 5. Once-ever flag + active-book pointer, SAME transaction (F6).
    tx.set(userMetaRef, {
      activeMandateId: newMandateId,
      mandateEscapeHatchUsed: true,
      escapeReplacedMandateId: oldMandateId,
      lastEscapeRequestKey: requestKey ?? null,
      updatedAt: createdAt,
    }, { merge: true });

    return {
      ok: true, idempotentReplay: false,
      oldMandateId, newMandateId,
      vintageRef, managerAgentId, cadenceTier,
      quarterKey: newDoc.quarterKey,
      nextRolloverAt: newDoc.nextRolloverAt,
    };
  });
}
