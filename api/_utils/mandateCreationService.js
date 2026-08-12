// api/_utils/mandateCreationService.js
//
// Spec 1 — Mandate Substrate — creation service (§5.2). Admin-side. Mints the
// stable managerAgentId, resolves + pins the vintageRef, seeds the book, and
// claims the user's single active mandate in ONE transaction.
//
// Spec 2 calls this from onboarding; Spec 1 ships the founder-gated endpoint
// (api/mandate/create.js) that calls it for dark testing. The service takes
// `userId` as a parameter (Spec 2 passes the onboarding user's uid); the Phase 1
// endpoint passes the authenticated founder uid.
//
// ONE ACTIVE BOOK PER USER (§5.2 / Q6): enforced by a transactional SAME-DOC
// claim on userMeta/{uid}.activeMandateId — read and write target the one
// userMeta doc, so two concurrent creators force a write-write conflict.
// Reference implementation: reserveSymbol (tournamentAgentLedger.js:364).
// Count-cap query patterns are explicitly rejected (they guard a cap, not
// uniqueness).

import { listArchetypeIds } from './archetypeRegistry.js';
import { publishVintage } from './mandateVintage.js';
import { deriveManagerAgentId, buildNewMandateDoc } from './mandateSchema.js';
import { getCadenceTier } from './mandateGenerationConfig.js';
import { computeNextRolloverAt } from './mandateCalendar.js';
import {
  MANDATE_ESCAPE_HATCH_WINDOW_DAYS,
  MANDATE_STARTING_CAPITAL,
} from './mandateConfig.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Create a mandate (book) for `userId` running `archetype`.
 *
 * @param {FirebaseFirestore.Firestore} db  Admin Firestore
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.archetype     one of listArchetypeIds()
 * @param {Date}   [opts.now]         injectable clock (tests); default new Date()
 * @param {string} [opts.requestKey]  idempotency key (§7) — a retry with the same
 *                                     key returns the book it already created
 * @returns {Promise<
 *   | { ok: true, mandateId, vintageRef, managerAgentId, cadenceTier, quarterKey,
 *       createdAt, nextRolloverAt, escapeHatchEligibleUntil, vintagePublished, idempotentReplay?: boolean }
 *   | { ok: false, code: 'unknown_archetype' | 'active_book_exists', activeMandateId?: string }
 * >}
 */
export async function createMandate(db, { userId, archetype, now = new Date(), requestKey = null }) {
  if (!db) throw new Error('createMandate: db required');
  if (!userId) throw new Error('createMandate: userId required');
  if (!archetype || !listArchetypeIds().includes(archetype)) {
    return { ok: false, code: 'unknown_archetype' };
  }

  // 1) Resolve + publish the vintage (idempotent, content-addressed). Pinning a
  //    PUBLISHED vintage is the risk-#3 mitigation: the pinned hash always
  //    resolves to an existing doc.
  const { vintageRef, created: vintagePublished } = await publishVintage(db, archetype);

  // 2) Deterministic identity + cadence (both stable per user × archetype).
  const managerAgentId = deriveManagerAgentId(userId, archetype);
  const cadenceTier = getCadenceTier(archetype);

  // 3) Timestamps (§5.2, I4).
  const createdAt = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  const quarterStartAt = new Date(createdAt.getTime());
  const escapeHatchEligibleUntil = new Date(createdAt.getTime() + MANDATE_ESCAPE_HATCH_WINDOW_DAYS * DAY_MS);
  const nextRolloverAt = computeNextRolloverAt(createdAt).at;

  // 4) Pre-allocate the mandate ref so mandateId is known before the transaction
  //    (quarterKey derives from it), mirroring the reserveSymbol pattern.
  const mandateRef = db.collection('mandates').doc();
  const mandateId = mandateRef.id;
  const mandateDoc = buildNewMandateDoc({
    mandateId,
    userId,
    archetype,
    managerAgentId,
    vintageRef,
    cadenceTier,
    createdAt,
    quarterStartAt,
    nextRolloverAt,
    escapeHatchEligibleUntil,
    startingCapital: MANDATE_STARTING_CAPITAL,
  });

  // 5) The transactional same-doc claim: create the book AND claim
  //    userMeta/{uid}.activeMandateId in one commit.
  const userMetaRef = db.collection('userMeta').doc(userId);

  const result = await db.runTransaction(async (tx) => {
    const metaSnap = await tx.get(userMetaRef);
    const meta = metaSnap.exists ? metaSnap.data() : {};

    if (meta.activeMandateId) {
      // Idempotent retry of THIS create (same request key) → return the book it made.
      if (requestKey && meta.lastCreateRequestKey === requestKey) {
        return { ok: true, mandateId: meta.activeMandateId, idempotentReplay: true };
      }
      // Otherwise the user already has an active book — reject (one active per user).
      return { ok: false, code: 'active_book_exists', activeMandateId: meta.activeMandateId };
    }

    tx.set(mandateRef, mandateDoc);
    tx.set(
      userMetaRef,
      {
        activeMandateId: mandateId,
        // §2.1 — escape-hatch once-ever flag lives on userMeta; initialize to
        // false without clobbering a prior `true` (merge + coalesce).
        mandateEscapeHatchUsed: meta.mandateEscapeHatchUsed ?? false,
        lastCreateRequestKey: requestKey ?? null,
        updatedAt: createdAt,
      },
      { merge: true },
    );
    return { ok: true, mandateId };
  });

  if (!result.ok) return result;

  return {
    ok: true,
    mandateId: result.mandateId,
    idempotentReplay: result.idempotentReplay === true,
    vintageRef,
    vintagePublished,
    managerAgentId,
    cadenceTier,
    quarterKey: `${result.mandateId}:1`,
    createdAt,
    nextRolloverAt,
    escapeHatchEligibleUntil,
  };
}
