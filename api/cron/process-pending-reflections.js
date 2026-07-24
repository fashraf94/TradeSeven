// api/cron/process-pending-reflections.js
// Sprint 1 fix — dedicated cron that drains the pendingReflection queue.
//
// Why this exists: agent-evaluate.js used to fire-and-forget generateReflection()
// from inside its expired-battles loop. Vercel froze the lambda after the
// cron's HTTP response returned, killing the dangling reflection promise
// before its memory/gameDesignFeedback writes landed. Symptom was
// agent.memory[] empty across all post-completion battles despite gamesPlayed
// incrementing. See REFLECTION_WRITER_INVESTIGATION_V2.md for the diagnosis.
//
// New flow:
//   1. agent-evaluate.js's completeBattle() sets pendingReflection: true
//      atomically with status: 'completed'.
//   2. This cron polls agentBattles where status='completed' AND
//      pendingReflection=true, processes them in a synchronous-await loop,
//      and clears the flag on success.
//   3. generateReflection() awaits the consolidation hook internally (Sprint 1
//      Phase 2 fix), so reflection AND its conditional consolidation chain
//      complete inside one cron iteration — not subject to the original race.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { generateReflection } from '../agent/reflect.js';
import { getWireFlags } from '../_utils/wireFlags.js';
import { runWireReplaySweep } from '../_utils/wireReplaySweep.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[ProcessPendingReflections]';
const TIME_BUDGET_MS = 50_000; // 50s — leave 10s buffer for cleanup/response
const BATCH_LIMIT = 5;          // up to 5 battles per tick; remainder defers

export default async function handler(req, res) {
  // ---- 1. Auth (matches agent-batch-review.js pattern) ----
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getFirebaseAdmin();
  const startTime = Date.now();
  const summary = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };

  try {
    // ---- 2. Query pending reflections ----
    const snapshot = await db
      .collection('agentBattles')
      .where('status', '==', 'completed')
      .where('pendingReflection', '==', true)
      .orderBy('completedAt', 'asc')
      .limit(BATCH_LIMIT)
      .get();

    if (snapshot.empty) {
      console.log(`${LOG_PREFIX} No pending reflections`);
      return res.status(200).json({ ...summary, message: 'No pending reflections' });
    }

    console.log(`${LOG_PREFIX} Found ${snapshot.size} pending reflection(s)`);

    // ---- 3. Process each battle (synchronous-await loop) ----
    for (const doc of snapshot.docs) {
      const elapsed = Date.now() - startTime;
      if (elapsed > TIME_BUDGET_MS) {
        const remaining = snapshot.size - summary.processed;
        console.log(`${LOG_PREFIX} Time budget exceeded (${elapsed}ms). ${remaining} deferred to next tick.`);
        summary.skipped += remaining;
        break;
      }

      const battleId = doc.id;
      summary.processed++;

      try {
        await generateReflection(db, battleId);

        // Clear the flag only on success. Reflection has its own internal
        // try/catch around the memory write and gameDesignFeedback write —
        // so a successful return here means writes landed (or at minimum
        // didn't throw). On Sonnet failure, generateReflection writes a
        // fallback reflection to memory[] (reflect.js:70-79) and still
        // resolves successfully, which is the desired idempotent behavior.
        await doc.ref.update({
          pendingReflection: false,
          reflectedAt: new Date().toISOString(),
        });

        summary.succeeded++;
        console.log(`${LOG_PREFIX} Battle ${battleId}: reflection complete, flag cleared`);
      } catch (err) {
        // Leave pendingReflection: true so the next cron tick retries.
        // No exponential backoff in v1 — revisit if we observe a stuck-battle
        // hot loop.
        console.error(`${LOG_PREFIX} Battle ${battleId} failed:`, err?.message || err);
        summary.failed++;
      }
    }

    // ---- 4. FantasyTimes Wire reconciliation sweep (rider) ----
    // Hosted here per Wire Spec V1.5 §4.7/P6: this is the only cron whose
    // window covers every hour a story can publish, incl. weekends — worst
    // gap 12h15m. Isolating try/catch: a Wire failure can NEVER break this
    // cron's primary job (the runRepairSweep/agent-evaluate precedent).
    // Gated on WIRE_WRITES_ENABLED (the sweep is part of the writes
    // machinery; pre-flip its composite index may not exist yet).
    let wireSweep = null;
    try {
      if (getWireFlags().writesEnabled) {
        const remaining = TIME_BUDGET_MS - (Date.now() - startTime);
        if (remaining > 5_000) {
          wireSweep = await runWireReplaySweep(db, { timeBudgetMs: remaining });
          console.log(`${LOG_PREFIX} Wire sweep:`, wireSweep);
        } else {
          console.log(`${LOG_PREFIX} Wire sweep skipped (budget exhausted); next tick covers it`);
        }
      }
    } catch (wireErr) {
      console.error(`${LOG_PREFIX} Wire sweep failed (isolated):`, wireErr?.message || wireErr);
    }

    const duration = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Complete in ${duration}ms:`, summary);
    return res.status(200).json({ ...summary, wireSweep, duration });
  } catch (err) {
    console.error(`${LOG_PREFIX} Fatal error:`, err);
    return res.status(500).json({ error: err.message });
  }
}
