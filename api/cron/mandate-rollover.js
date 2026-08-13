// api/cron/mandate-rollover.js
//
// Spec 1 — Mandate Substrate — the ROLLOVER sweep (§5.3, P4). Daily pre-market
// duty: every book whose quarter boundary has arrived rolls to its next quarter,
// carrying capital forward (FR-1). DARK by construction — behind
// MANAGED_MANDATE_ENABLED (master) AND MANDATE_ROLLOVER_ENABLED (§5.3), both
// default false. No vercel.json registration (that is P6); crons do not run on
// Vercel preview, so verification is unit tests on this logic + the first
// production run.
//
// PAGING (the P3 attempt-marker discipline under the §5.3 due-filter). The close
// sweep orders by an attempt marker so a persistently-throwing book rotates
// behind the frontier. Rollover filters `nextRolloverAt <= now`, and Firestore
// requires the inequality field to be the FIRST orderBy — so an attempt-marker
// primary order is impossible here. The Firestore-correct equivalent is a CURSOR
// WALK over (nextRolloverAt ASC, __name__): it reaches EVERY due book in a fire
// regardless of failures (the cursor steps past a stuck book), gives the same
// "no pinning, no vanishing" guarantee, keeps catch-up priority (oldest boundary
// first) correct, and reuses the existing status+nextRolloverAt index. A durable
// failure trace (health.consecutiveRolloverFailures + lastRolloverAttemptAt +
// MANDATE_ROLLOVER_FAILED_STREAK) gives the same observability the close sweep's
// INV-1 fix added. Residual: a systemic per-cohort failure at the OLDEST boundary
// can delay younger cohorts within a fire — non-destructive (books keep trading
// and marking; they just don't advance quarter), loudly alerted, and the correct
// oldest-first priority; documented in the P4 audit.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { MANAGED_MANDATE_ENABLED, MANDATE_ROLLOVER_ENABLED } from '../../src/config/featureFlags.js';
import { activeRolloverTick } from '../_utils/mandateSessionSlots.js';
import { mintOwnerToken, acquireLease, releaseLease } from '../_utils/mandateLease.js';
import { catchUpBook } from '../_utils/mandateRollover.js';
import {
  MANDATE_SWEEP_PAGE_SIZE,
  MANDATE_ROLLOVER_MAX_BOOKS_PER_FIRE,
  MANDATE_MISSED_MARKS_ALERT,
} from '../_utils/mandateConfig.js';

const TIME_BUDGET_MS = 290_000; // 10s buffer under maxDuration for the response
const LOG_PREFIX = '[MandateRollover]';
const MANDATES_COLLECTION = 'mandates';

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // 1. Auth (§7): x-vercel-cron OR CRON_SECRET on ALL methods (no GET-only bypass).
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Master gate (§7). Dark default → no-op before any I/O.
  if (!MANAGED_MANDATE_ENABLED) {
    return res.status(200).json({ ok: true, noop: true, reason: 'mandate_dark' });
  }

  const now = new Date();
  // 3. Calendar gate (§5.3): the pre-market rollover window on a trading day.
  const rolloverTick = activeRolloverTick(now);
  if (!rolloverTick) {
    return res.status(200).json({ ok: true, noop: true, reason: 'no_rollover_window' });
  }
  // 4. Rollover flag (§5.3). Dark → no-op (the window was live, the duty is off).
  if (!MANDATE_ROLLOVER_ENABLED) {
    return res.status(200).json({ ok: true, noop: true, reason: 'mandate_rollover_dark' });
  }

  return runRolloverSweep(req, res, { now, rolloverTick });
}

/**
 * The cursor-paged rollover sweep over the due set. Injectable `db`/`now`/tick
 * so it drives the real per-book catch-up against a transaction-faithful fake.
 */
export async function runRolloverSweep(req, res, { now, rolloverTick, db = getFirebaseAdmin() }) {
  const startedAt = Date.now();
  const ownerToken = mintOwnerToken();
  const summary = {
    duty: 'rollover', date: rolloverTick.date,
    rolledBooks: 0, boundaries: 0, skipped: 0, errors: 0, cappedBooks: 0, complete: false,
  };

  try {
    let cursor = null;           // [nextRolloverAt, __name__] of the last book fetched
    let seen = 0;                // total books visited this fire (hard cap backstop)
    let deferred = false;        // time-budget or per-fire cap hit → tail unproven
    let leaseSkips = 0;

    // Cursor walk over the due set, oldest boundary first.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { deferred = true; break; }
      if (seen >= MANDATE_ROLLOVER_MAX_BOOKS_PER_FIRE) { deferred = true; break; }

      let q = db.collection(MANDATES_COLLECTION)
        .where('status', '==', 'active')
        .where('nextRolloverAt', '<=', now)
        .orderBy('nextRolloverAt', 'asc')
        .orderBy('__name__', 'asc');
      if (cursor) q = q.startAfter(cursor[0], cursor[1]);
      const page = await q.limit(MANDATE_SWEEP_PAGE_SIZE).get();
      if (page.empty) break;

      for (const docSnap of page.docs) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) { deferred = true; break; }
        seen += 1;
        const book = docSnap.data();
        cursor = [book.nextRolloverAt, docSnap.id]; // advance the walk past this book regardless of outcome
        const mandateRef = docSnap.ref;

        const lease = await acquireLease(db, mandateRef, ownerToken, { now });
        if (!lease.acquired) { summary.skipped++; leaseSkips++; continue; }
        try {
          const { boundaries, cappedOut } = await catchUpBook(db, mandateRef, { now });
          if (boundaries > 0) { summary.rolledBooks++; summary.boundaries += boundaries; }
          else summary.skipped++;
          if (cappedOut) { summary.cappedBooks++; deferred = true; }
        } catch (bookErr) {
          // DURABLE failure trace (mirrors the close sweep's INV-1 fix): a book
          // whose rollover throws every fire gets a counter + a threshold alert,
          // never a silent stall behind a false "complete". nextRolloverAt is
          // NOT advanced (the boundary is genuinely unprocessed) — the cursor
          // walk still steps past it this fire, so it cannot pin the frontier.
          summary.errors++;
          console.error(`${LOG_PREFIX} rollover failed for ${docSnap.id}: ${bookErr.message}`);
          const failures = (book.health?.consecutiveRolloverFailures || 0) + 1;
          try {
            await mandateRef.set({
              health: { lastRolloverAttemptAt: now, consecutiveRolloverFailures: failures },
            }, { merge: true });
            if (failures >= MANDATE_MISSED_MARKS_ALERT) {
              console.error(`${LOG_PREFIX} MANDATE_ROLLOVER_FAILED_STREAK ${docSnap.id} — ${failures} consecutive rollover failures (§5.3)`);
            }
          } catch (writeErr) {
            summary.errors++;
            console.error(`${LOG_PREFIX} ${docSnap.id} rollover-failure persist FAILED: ${writeErr.message}`);
          }
        } finally {
          await releaseLease(db, mandateRef, ownerToken).catch(() => {});
        }
      }
      if (deferred) break;
      if (page.size < MANDATE_SWEEP_PAGE_SIZE) break; // last page reached
    }

    // Completion — must be TRUE (mirrors the close sweep): errors, lease-skips,
    // or a deferral leave the tail unproven, so the fire never claims complete.
    if (summary.errors === 0 && leaseSkips === 0 && !deferred) {
      summary.complete = true;
      console.log(`${LOG_PREFIX} rollover sweep complete for ${rolloverTick.date} — all due books processed`);
    }

    return res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    console.error(`${LOG_PREFIX} rollover sweep error: ${err.message}`);
    return res.status(500).json({ ok: false, error: err.message, ...summary });
  }
}
