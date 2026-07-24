// api/_utils/wireReplaySweep.js
// FantasyTimes Wire — the reconciliation sweep (Spec V1.5 §4.7).
//
// Hosted by api/cron/process-pending-reflections.js inside an isolating
// try/catch (the runRepairSweep/agent-evaluate precedent) — ZERO new cron
// slots (P6, 37/40 preserved). Query shape is the repo's blessed queue-flag
// pattern (`wirePending == true` + orderBy publishedAt; BUILD_RULES §5 —
// never a `!=` inequality), with the composite index declared in
// firestore.indexes.json.
//
// Per pending story:
//   1. envelope missing → UNAMBIGUOUS ALARM (F2-1): wireConflict
//      'envelope_missing', flag cleared, envelopeMissing incremented in the
//      day doc (marketDate re-derived from the story's own publishedAt —
//      deterministic), loud log. Acceptance expectation for the counter: 0.
//   2. envelope present → the SAME Wire transaction the inline path runs
//      (uniform replay): no receipt → transact per the envelope's outcome;
//      receipt matching (storyId+hash) → success ("receipt hit IS success");
//      receipt mismatching → conflict class, terminate.
//   3. Orphaned envelopes (story no longer pending) older than one sweep
//      interval → delete + log (the bidirectional orphan drain).

import {
  WIRE_COLLECTION,
  WIRE_ENVELOPE_COLLECTION,
  WIRE_CONFLICTS,
} from './wireContracts.js';
import {
  runWireTransactionFromEnvelope,
  finalizeWireSuccess,
  markWireConflict,
  emptyWireDay,
  normalizeStats,
} from './wireWriteThrough.js';
import { deriveMarketDate } from './wireCalendar.js';

const LOG_PREFIX = '[WireReplaySweep]';

export const SWEEP_DEFAULTS = Object.freeze({
  limit: 10,           // pending stories per tick; remainder defers
  orphanLimit: 10,     // orphan envelopes per tick
  orphanAgeMs: 30 * 60 * 1000, // > one 15-min sweep interval, with margin
});

/**
 * Run one sweep pass. Never throws for per-item failures; the caller wraps
 * the whole call in an isolating try/catch anyway (host contract).
 *
 * @param {object} db
 * @param {object} [opts]
 * @param {number} [opts.limit]
 * @param {number} [opts.timeBudgetMs] — stop starting new items past this
 * @param {Date}   [opts.now]
 * @returns {Promise<object>} summary counters
 */
export async function runWireReplaySweep(db, opts = {}) {
  const limit = opts.limit ?? SWEEP_DEFAULTS.limit;
  const timeBudgetMs = opts.timeBudgetMs ?? 20_000;
  const now = opts.now ?? new Date();
  const started = Date.now();
  const summary = {
    scanned: 0, replayed: 0, receiptHits: 0, conflicts: 0,
    envelopeMissing: 0, orphansDeleted: 0, failed: 0, deferred: 0,
  };

  // ── Pending stories ────────────────────────────────────────────────────
  const pendingSnap = await db
    .collection('fantasyTimesStories')
    .where('wirePending', '==', true)
    .orderBy('publishedAt', 'asc')
    .limit(limit)
    .get();

  for (const doc of pendingSnap.docs) {
    if (Date.now() - started > timeBudgetMs) {
      summary.deferred += pendingSnap.size - summary.scanned;
      break;
    }
    summary.scanned += 1;
    const storyRef = doc.ref;
    const envelopeRef = db.collection(WIRE_ENVELOPE_COLLECTION).doc(doc.id);

    try {
      const envSnap = await envelopeRef.get();

      // 1. Envelope missing — the alarm path (F2-1: expectation ZERO).
      if (!envSnap.exists) {
        const story = doc.data();
        const marketDate = deriveMarketDate(toDate(story.publishedAt) || now);
        await incrementDayStat(db, marketDate, 'envelopeMissing', now);
        await storyRef.update({
          wirePending: false,
          wireConflict: WIRE_CONFLICTS.ENVELOPE_MISSING,
        });
        summary.envelopeMissing += 1;
        console.error(
          `${LOG_PREFIX} ALARM envelope_missing: story ${doc.id} was wirePending with no envelope ` +
          `(marketDate ${marketDate}). This counter's acceptance expectation is ZERO.`
        );
        continue;
      }

      // 2. Uniform replay through the shared transaction. SWEEP
      // interpretation of a pre-existing receipt (§4.7 tri-state): same
      // storyId+hash → post-commit race, success; different storyId or
      // hash → idempotency conflict — a replayed envelope disagreeing with
      // the receipt is an anomaly, unlike the inline F2-10 no-op.
      const envelope = envSnap.data();
      const tx = await runWireTransactionFromEnvelope(db, envelope, { now });
      if (tx.status === 'receipt_exists' && !(tx.sameStory && tx.sameHash)) {
        const conflictClass = !tx.sameStory
          ? WIRE_CONFLICTS.STORY_MISMATCH
          : WIRE_CONFLICTS.HASH_MISMATCH;
        await incrementDayStat(db, envelope.marketDate, 'idempotencyConflicts', now);
        await markWireConflict(db, storyRef, envelopeRef, conflictClass);
        summary.conflicts += 1;
        console.warn(`${LOG_PREFIX} idempotency conflict (${conflictClass}) on story ${doc.id}`);
      } else {
        await finalizeWireSuccess(db, storyRef, envelopeRef);
        if (tx.status === 'receipt_exists') summary.receiptHits += 1;
        else summary.replayed += 1;
      }
    } catch (err) {
      // Leave wirePending: true → retried next tick.
      summary.failed += 1;
      console.error(`${LOG_PREFIX} replay failed for story ${doc.id}:`, err?.message || err);
    }
  }

  // ── 3. Orphaned envelopes (bidirectional drain) ────────────────────────
  try {
    const cutoff = new Date(now.getTime() - (opts.orphanAgeMs ?? SWEEP_DEFAULTS.orphanAgeMs));
    const orphanSnap = await db
      .collection(WIRE_ENVELOPE_COLLECTION)
      .where('createdAt', '<', cutoff)
      .limit(opts.orphanLimit ?? SWEEP_DEFAULTS.orphanLimit)
      .get();

    for (const envDoc of orphanSnap.docs) {
      if (Date.now() - started > timeBudgetMs) break;
      const storySnap = await db.collection('fantasyTimesStories').doc(envDoc.id).get();
      const stillPending = storySnap.exists && storySnap.data().wirePending === true;
      if (!stillPending) {
        await envDoc.ref.delete();
        summary.orphansDeleted += 1;
        console.warn(`${LOG_PREFIX} deleted orphaned envelope ${envDoc.id} (story not pending)`);
      }
      // else: the pending-story loop owns it (this tick or a later one).
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} orphan drain failed:`, err?.message || err);
  }

  return summary;
}

/** Transactional single-stat increment on the day doc. */
async function incrementDayStat(db, marketDate, field, now) {
  const dayRef = db.collection(WIRE_COLLECTION).doc(marketDate);
  await db.runTransaction(async (t) => {
    const snap = await t.get(dayRef);
    const data = snap.exists ? snap.data() : emptyWireDay(marketDate);
    const stats = normalizeStats(data.validationStats);
    stats[field] += 1;
    t.set(dayRef, { ...data, validationStats: stats, updatedAt: now });
  });
}

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate(); // Firestore Timestamp
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
