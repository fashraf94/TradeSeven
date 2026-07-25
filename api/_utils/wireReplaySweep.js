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
//   1. Terminal-state guard, transactional. The story is re-read and every
//      terminal action (alarm, conflict, exhaustion) is applied in the SAME
//      transaction as its counter increment, so a counter can never be
//      incremented twice for one story and a TOCTOU race with the inline
//      path (which may have completed between the query and now) can never
//      raise a false alarm.
//   2. Envelope missing → UNAMBIGUOUS ALARM (F2-1): wireConflict
//      'envelope_missing', flag cleared, envelopeMissing incremented, loud
//      log. Acceptance expectation for the counter: zero.
//   3. Envelope present → the SAME Wire transaction the inline path runs
//      (uniform replay). Pre-existing receipt: same storyId+hash → success
//      ("receipt hit IS success"); otherwise idempotency conflict.
//   4. Repeated failures are capped (wireReplayAttempts): a permanently
//      failing story is terminated as 'replay_exhausted' rather than
//      re-queued forever at the head of an orderBy publishedAt scan, where
//      it would starve every younger story behind it.
//   5. Orphaned envelopes (story no longer pending) older than one sweep
//      interval → delete + log (the bidirectional drain).

import {
  WIRE_COLLECTION,
  WIRE_ENVELOPE_COLLECTION,
  WIRE_CONFLICTS,
} from './wireContracts.js';
import {
  runWireTransactionFromEnvelope,
  finalizeWireSuccess,
  emptyWireDay,
  normalizeStats,
} from './wireWriteThrough.js';
import { deriveMarketDate } from './wireCalendar.js';

const LOG_PREFIX = '[WireReplaySweep]';

export const SWEEP_DEFAULTS = Object.freeze({
  limit: 10,                    // pending stories per tick; remainder defers
  orphanLimit: 10,              // orphan envelopes per tick
  orphanAgeMs: 30 * 60 * 1000,  // > one 15-min sweep interval, with margin
  maxAttempts: 5,               // then terminate as replay_exhausted
});

/**
 * Run one sweep pass. Never throws for per-item failures; the caller wraps
 * the whole call in an isolating try/catch anyway (host contract).
 *
 * @param {object} db
 * @param {object} [opts]
 * @param {number} [opts.limit]
 * @param {number} [opts.timeBudgetMs] — stop starting new items past this
 * @param {number} [opts.maxAttempts]
 * @param {Date}   [opts.now]
 * @returns {Promise<object>} summary counters
 */
export async function runWireReplaySweep(db, opts = {}) {
  const limit = opts.limit ?? SWEEP_DEFAULTS.limit;
  const maxAttempts = opts.maxAttempts ?? SWEEP_DEFAULTS.maxAttempts;
  const timeBudgetMs = opts.timeBudgetMs ?? 20_000;
  const now = opts.now ?? new Date();
  const started = Date.now();
  const summary = {
    scanned: 0, replayed: 0, receiptHits: 0, conflicts: 0,
    envelopeMissing: 0, exhausted: 0, alreadyTerminal: 0,
    orphansDeleted: 0, failed: 0, deferred: 0,
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

      // 2. Envelope missing — the alarm path (F2-1: expectation ZERO).
      if (!envSnap.exists) {
        const story = doc.data();
        const marketDate = deriveMarketDate(toDate(story.publishedAt) || now);
        const applied = await terminate(db, {
          storyRef, marketDate, now,
          conflictClass: WIRE_CONFLICTS.ENVELOPE_MISSING,
          statField: 'envelopeMissing',
        });
        if (applied) {
          summary.envelopeMissing += 1;
          console.error(
            `${LOG_PREFIX} ALARM envelope_missing: story ${doc.id} was wirePending with no envelope ` +
            `(marketDate ${marketDate}). This counter's acceptance expectation is ZERO.`
          );
        } else {
          // The inline path completed between the query and now — no anomaly.
          summary.alreadyTerminal += 1;
        }
        continue;
      }

      const envelope = envSnap.data();

      // 4. Attempt cap — terminate a permanently failing story so it cannot
      //    head-of-line block the queue.
      const attempts = Number(doc.data().wireReplayAttempts) || 0;
      if (attempts >= maxAttempts) {
        const applied = await terminate(db, {
          storyRef, marketDate: envelope.marketDate, now,
          conflictClass: WIRE_CONFLICTS.REPLAY_EXHAUSTED,
          statField: 'replayExhausted',
          deleteEnvelopeRef: envelopeRef,
        });
        if (applied) {
          summary.exhausted += 1;
          console.error(
            `${LOG_PREFIX} replay_exhausted after ${attempts} attempts: story ${doc.id} ` +
            `(seam ${envelope.seam}, key ${envelope.idempotencyKey}) — investigate; not retried again.`
          );
        } else {
          summary.alreadyTerminal += 1;
        }
        continue;
      }

      // 3. Uniform replay through the shared transaction. SWEEP
      // interpretation of a pre-existing receipt (§4.7 tri-state): same
      // storyId+hash → post-commit race, success; different storyId or
      // hash → idempotency conflict — a replayed envelope disagreeing with
      // the receipt is an anomaly, unlike the inline F2-10 no-op.
      const tx = await runWireTransactionFromEnvelope(db, envelope, { now });
      if (tx.status === 'receipt_exists' && !(tx.sameStory && tx.sameHash)) {
        const conflictClass = !tx.sameStory
          ? WIRE_CONFLICTS.STORY_MISMATCH
          : WIRE_CONFLICTS.HASH_MISMATCH;
        const applied = await terminate(db, {
          storyRef, marketDate: envelope.marketDate, now,
          conflictClass,
          statField: 'idempotencyConflicts',
          deleteEnvelopeRef: envelopeRef,
        });
        if (applied) {
          summary.conflicts += 1;
          console.warn(`${LOG_PREFIX} idempotency conflict (${conflictClass}) on story ${doc.id}`);
        } else {
          summary.alreadyTerminal += 1;
        }
      } else {
        await finalizeWireSuccess(db, storyRef, envelopeRef);
        if (tx.status === 'receipt_exists') summary.receiptHits += 1;
        else summary.replayed += 1;
      }
    } catch (err) {
      // Leave wirePending: true → retried next tick, up to maxAttempts.
      summary.failed += 1;
      console.error(`${LOG_PREFIX} replay failed for story ${doc.id}:`, err?.message || err);
      try {
        await storyRef.update({ wireReplayAttempts: (Number(doc.data().wireReplayAttempts) || 0) + 1 });
      } catch (bumpErr) {
        console.error(`${LOG_PREFIX} could not record attempt for ${doc.id}:`, bumpErr?.message || bumpErr);
      }
    }
  }

  // ── 5. Orphaned envelopes (bidirectional drain) ────────────────────────
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

/**
 * Apply a TERMINAL outcome to a pending story and its day-doc counter in ONE
 * transaction — exactly-once by construction.
 *
 * Returns false (and writes nothing) when the story is no longer pending:
 * the inline path finished between the sweep's query and now, so there is
 * nothing to reconcile and no anomaly to count.
 */
async function terminate(db, { storyRef, marketDate, now, conflictClass, statField, deleteEnvelopeRef }) {
  const dayRef = db.collection(WIRE_COLLECTION).doc(marketDate);
  const applied = await db.runTransaction(async (t) => {
    // All reads before any write (Firestore transaction requirement).
    const storySnap = await t.get(storyRef);
    if (!storySnap.exists || storySnap.data().wirePending !== true) return false;
    const daySnap = await t.get(dayRef);

    const data = daySnap.exists ? daySnap.data() : emptyWireDay(marketDate);
    const stats = normalizeStats(data.validationStats);
    stats[statField] += 1;

    t.set(dayRef, { ...data, validationStats: stats, updatedAt: now });
    t.update(storyRef, { wirePending: false, wireConflict: conflictClass });
    return true;
  });

  // Envelope deletion is outside the transaction: it is pure cleanup, and a
  // failure here degrades to an orphan the drain collects.
  if (applied && deleteEnvelopeRef) {
    try {
      await deleteEnvelopeRef.delete();
    } catch (err) {
      console.error(`${LOG_PREFIX} envelope cleanup failed (drain will collect):`, err?.message || err);
    }
  }
  return applied;
}

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate(); // Firestore Timestamp
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
