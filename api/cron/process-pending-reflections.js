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
//
// Reflection outage fix (P-OUT-1, founder rulings O2–O4, 10 Oct 2026):
//   • each attempt is CLAIMED on the battle (reflectionAttempts) before the
//     model call, so a run that dies mid-attempt still counts toward the cap;
//     the claim holds a short lease (reflectionLeaseUntil) so an overlapping
//     run leaves the battle alone;
//   • a failed reflection writes nothing: the flag stays set and the next tick
//     retries; after MAX_REFLECTION_ATTEMPTS the flag clears and the battle is
//     marked reflectionNoLesson — it leaves the queue, honestly;
//   • every attempt's outcome lands on the battle (reflectionOutcome);
//   • a reflection STARTS only when its whole deadline still fits the
//     reflection phase, so the tenants below keep their slices.
//   See docs/audits/20261010_BUILD_REFLECTION_OUTAGE_FIX.md.
//
// Part 2 (P-OUT-2, founder rulings O7 and O9, 14 Oct 2026): an account-wide
// refusal (401 / 403 / 404, a spend or usage limit, the credit balance) does
// not use up a try while the battle completed within the last 7 days — the
// outcome write hands the claimed attempt back, and the battle stays pending;
// a battle that finishes without a lesson has left its no-lesson row in the
// learning window. See docs/audits/20261014_BUILD_REFLECTION_OUTAGE_FIX_2.md.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { generateReflection } from '../agent/reflect.js';
import {
  REFLECTION_TIMEOUT_MS, MAX_REFLECTION_ATTEMPTS, reflectionBattleUpdate, buildReflectionOutcome, errorNameOf,
} from '../_utils/reflectionOutcome.js';
import { getWireFlags } from '../_utils/wireFlags.js';
import { runWireReplaySweep } from '../_utils/wireReplaySweep.js';
import { runEditorialReview, EDITORIAL_MIN_BUDGET_MS } from '../_utils/wireEditorialRun.js';
// Cockpit Build 1a (spec §8): the call sweep — the LAST tenant, under the
// handler's remaining protected budget; inert before any read below global 'on'.
import { runCallSweep } from '../_utils/callRecords/sweep.js';
// Pilot P1a (founder decision D2): the hypothesis review pass — the FIFTH
// tenant, after the call sweep; with HYPOTHESIS_RECORDS_ENABLED false it
// returns before any read and the response carries no new key.
import { runHypothesisReviewPass } from '../_utils/hypothesisRecords/reviewPass.js';

// P-OUT-1: 60 → 120 s. The tenants' budget (TIME_BUDGET_MS) is unchanged; the
// ceiling is raised so the rare consolidation path — a reflection at its full
// 35 s deadline followed by its own consolidation call
// (agentConsolidationApply.js) — can never be killed mid-write. P-OUT-2 (O8)
// measured that call and set its deadline to 60 s: 5 s start + 35 s + 60 s +
// 10 s of writes = 110 s, still inside 120 s, so the ceiling is unchanged
// (pinned in process-pending-reflections.outcome.test.js).
export const config = { maxDuration: 120 };

const LOG_PREFIX = '[ProcessPendingReflections]';
const TIME_BUDGET_MS = 50_000; // 50s — the tenants' budget, measured from the handler start
const BATCH_LIMIT = 5;          // up to 5 battles read per tick; the start rule below decides how many run
// The reflection phase: a reflection starts only if its full deadline plus the
// writes around it end by REFLECTION_PHASE_MS, so the Wire sweep keeps its 5 s
// floor under TIME_BUDGET_MS and the call sweep / review pass (capped at
// handlerStart + 45 s / + 50 s) are not starved. The first reflection of a
// tick always starts, so the queue always moves. With a 35 s deadline a
// second one starts only if the first ended within 2 s (a skip, a fast
// error): in practice one model call per tick, 48 ticks a day (vercel.json).
const REFLECTION_PHASE_MS = 40_000;
const REFLECTION_WRITE_RESERVE_MS = 3_000;
// The claim lease: longer than maxDuration, so a live run always holds it; a
// run that died frees the battle long before the next 15-minute tick.
export const REFLECTION_LEASE_MS = 150_000;

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

    // NOTE: no early return on an empty queue — step 4 (the Wire sweep) MUST
    // still run. An empty reflection queue is the steady state (this cron
    // clears the flag in the same tick it processes it), so returning here
    // would make the sweep dead code on almost every tick.
    if (snapshot.empty) {
      console.log(`${LOG_PREFIX} No pending reflections`);
    } else {
      console.log(`${LOG_PREFIX} Found ${snapshot.size} pending reflection(s)`);
    }

    // ---- 3. Process each battle (synchronous-await loop) ----
    for (const doc of snapshot.docs) {
      const elapsed = Date.now() - startTime;
      if (summary.processed > 0 && elapsed + REFLECTION_TIMEOUT_MS + REFLECTION_WRITE_RESERVE_MS > REFLECTION_PHASE_MS) {
        const remaining = snapshot.size - summary.processed;
        console.log(`${LOG_PREFIX} Reflection phase full (${elapsed}ms; one more could run ${REFLECTION_TIMEOUT_MS}ms). ${remaining} deferred to next tick.`);
        summary.skipped += remaining;
        break;
      }

      const battleId = doc.id;
      const battleRef = db.collection('agentBattles').doc(battleId);
      summary.processed++;

      let claim = null;
      let result;
      try {
        // Claim this attempt BEFORE the model call (re-checking the flag), so
        // an attempt is counted even if this run dies inside it. A battle that
        // already used every attempt without a recorded end gets a recovery
        // pass instead: no model call, the lesson looked up, then it leaves.
        // The claim is also a LEASE (review RV-5): a second invocation that
        // finds an unexpired lease leaves the battle alone, so overlapping runs
        // (a manual run during a tick) never call twice or write contradicting
        // end states. The lease outlives maxDuration; the outcome write clears it.
        claim = await db.runTransaction(async (tx) => {
          const snap = await tx.get(battleRef);
          const data = snap.exists ? snap.data() : null;
          if (!data || data.status !== 'completed' || data.pendingReflection !== true) return { state: 'not_pending' };
          const nowMs = Date.now();
          if (Number.isFinite(data.reflectionLeaseUntil) && data.reflectionLeaseUntil > nowMs) return { state: 'busy' };
          const prior = Number.isInteger(data.reflectionAttempts) && data.reflectionAttempts > 0 ? data.reflectionAttempts : 0;
          const exhausted = prior >= MAX_REFLECTION_ATTEMPTS;
          tx.update(battleRef, exhausted
            ? { reflectionLeaseUntil: nowMs + REFLECTION_LEASE_MS }
            : { reflectionAttempts: prior + 1, reflectionLeaseUntil: nowMs + REFLECTION_LEASE_MS });
          return exhausted ? { state: 'exhausted', attempt: prior } : { state: 'claimed', attempt: prior + 1 };
        });
        if (claim.state === 'not_pending' || claim.state === 'busy') {
          summary.skipped++;
          console.log(`${LOG_PREFIX} Battle ${battleId}: ${claim.state === 'busy' ? 'held by another run' : 'no longer pending'} — skipped`);
          continue;
        }

        result = await generateReflection(db, battleId, claim.state === 'exhausted'
          ? { attempt: claim.attempt, modelCall: false }
          : { attempt: claim.attempt });

        // ok → flag cleared + outcome; skipped → flag cleared (nothing to
        // reflect); failed → no lesson was written by the reflection: the flag
        // stays set for the next tick, or clears at the cap with the battle
        // marked reflectionNoLesson (reflectionOutcome.js). P-OUT-2: an
        // account-wide refusal within the backstop hands this attempt back in
        // the same write (O7); a third attempt that could not leave its
        // no-lesson row waits for the recovery pass (O9).
        const update = reflectionBattleUpdate(result, {
          attempt: claim.attempt, at: new Date().toISOString(), recoveryPass: claim.state === 'exhausted',
        });
        await battleRef.update({ ...update, reflectionLeaseUntil: null });

        if (result?.outcome === 'ok' || result?.outcome === 'skipped') {
          summary.succeeded++;
          console.log(`${LOG_PREFIX} Battle ${battleId}: reflection ${result.outcome}${result.reason ? ` (${result.reason})` : ''}, flag cleared`);
        } else {
          summary.failed++;
          const after = update.reflectionNoLesson ? ' — finished without a lesson'
            : ('reflectionAttempts' in update ? ' — not counted (account-wide refusal); retries next tick' : ' — retries next tick');
          console.warn(`${LOG_PREFIX} Battle ${battleId}: attempt ${claim.attempt}/${MAX_REFLECTION_ATTEMPTS} failed (${update.reflectionOutcome?.failureClass ?? 'unknown'})${after}`);
        }
      } catch (err) {
        // An unexpected throw (a Firestore read or write): the flag stays set
        // and the claimed attempt stays counted, so the cap still bounds it.
        console.error(`${LOG_PREFIX} Battle ${battleId} failed:`, err?.message || err);
        summary.failed++;
        // When the throw came from the reflection itself (never from the
        // outcome write — that would turn a landed success into a failure),
        // record the attempt as failed/unknown, best effort. P-OUT-2 (O9,
        // review WR-2): a THIRD attempt that threw has left no no-lesson row,
        // so it waits one tick for the no-call recovery pass, which writes the
        // row; a recovery pass that throws finishes the battle at once.
        if (claim?.attempt && result === undefined) {
          try {
            const at = new Date().toISOString();
            const record = buildReflectionOutcome({ outcome: 'failed', failureClass: 'unknown', errorName: errorNameOf(err), model: null, attempt: claim.attempt, at });
            await battleRef.update({
              ...reflectionBattleUpdate({ outcome: 'failed', record, deferToRecovery: true }, { attempt: claim.attempt, at, recoveryPass: claim.state === 'exhausted' }),
              reflectionLeaseUntil: null,
            });
          } catch (recordErr) {
            console.error(`${LOG_PREFIX} Battle ${battleId}: could not record the failed attempt:`, recordErr?.message || recordErr);
          }
        }
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

    // ---- 5. Weekly Wire editorial review (rider, LAST — R4-M5) ----
    // Three-tenant budget hierarchy, pinned: reflections → Wire sweep →
    // editorial. The editorial runs last at lowest priority under a HARD
    // remaining-budget floor, so it can never consume the sweep's reserved
    // budget (P2-47) — an editorial starving the sweep would delay the very
    // settlements it samples. Isolating try/catch: an editorial failure can
    // never break reflections or the sweep (P2-36). Sunday-gated: the slot
    // is the UTC Sunday; Amendment F's captured {scheduledSlotDate, isoWeek}
    // keeps a run that races past midnight filing under its original week.
    let editorial = null;
    try {
      const isUtcSunday = new Date().getUTCDay() === 0;
      if (getWireFlags().editorialEnabled && isUtcSunday) {
        const remaining = TIME_BUDGET_MS - (Date.now() - startTime);
        if (remaining > EDITORIAL_MIN_BUDGET_MS) {
          editorial = await runEditorialReview(db, {
            now: new Date(),
            deadline: startTime + TIME_BUDGET_MS,
          });
          console.log(`${LOG_PREFIX} Editorial:`, editorial);
        } else {
          console.log(`${LOG_PREFIX} Editorial deferred (budget ${remaining}ms below floor); a later Sunday tick covers it`);
          editorial = { action: 'deferred', remaining };
        }
      }
    } catch (edErr) {
      console.error(`${LOG_PREFIX} Editorial failed (isolated):`, edErr?.message || edErr);
      editorial = { action: 'error', error: String(edErr?.message || edErr) };
    }

    // ---- 6. Cockpit Build 1a — the call sweep (rider, LAST; spec §8) ----
    // Fourth tenant, after the editorial: its deadline is min(now + 20 s,
    // handlerStart + 45 s) — capped by this handler's remaining budget, never
    // added to it. Below global 'on' it returns before any read, and the
    // response carries no new key (byte-identical at off / shadow). A sweep
    // failure can never break the reflections (isolating try/catch).
    let callSweep = null;
    try {
      callSweep = await runCallSweep({ db, handlerStartMs: startTime });
      if (callSweep && !callSweep.skipped) console.log(`${LOG_PREFIX} Call sweep:`, callSweep);
    } catch (sweepErr) {
      console.error(`${LOG_PREFIX} Call sweep failed (isolated):`, sweepErr?.message || sweepErr);
      callSweep = { action: 'error', error: String(sweepErr?.message || sweepErr) };
    }

    // ---- 7. Pilot P1a — the hypothesis review pass (rider, LAST; D2) ----
    // Fifth tenant, after the call sweep: its own slice, min(now + 8 s,
    // handlerStart + 50 s) — never past this handler's TIME_BUDGET_MS. Flag
    // off → it returns before any read and the response carries no new key
    // (byte-identical). A pass failure can never break the reflections
    // (isolating try/catch; the pass itself never throws).
    let hypothesisReview = null;
    try {
      hypothesisReview = await runHypothesisReviewPass({ db, handlerStartMs: startTime });
    } catch (reviewErr) {
      console.error(`${LOG_PREFIX} Hypothesis review failed (isolated):`, reviewErr?.message || reviewErr);
      hypothesisReview = { action: 'error', error: String(reviewErr?.message || reviewErr) };
    }

    const duration = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Complete in ${duration}ms:`, summary);
    return res.status(200).json({
      ...summary,
      ...(snapshot.empty ? { message: 'No pending reflections' } : {}),
      wireSweep,
      ...(editorial ? { editorial } : {}),
      ...(callSweep && !callSweep.skipped ? { callSweep } : {}),
      ...(hypothesisReview && !hypothesisReview.skipped ? { hypothesisReview } : {}),
      duration,
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} Fatal error:`, err);
    return res.status(500).json({ error: err.message });
  }
}
