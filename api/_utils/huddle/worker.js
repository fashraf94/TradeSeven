// api/_utils/huddle/worker.js
//
// Huddle S1 — THE STAGES AND THE DRAIN (spec V1.1 §5.1, §5.3; Amendment A §A3, §A6;
// Amendment B §B3).
//
// ENQUEUE STAGE (runEnqueueStage): build the shared layer once, enumerate the active
// players (§5.4), write their queue rows idempotently, and record on huddleRuns/{etDate}
// `enqueueStage: 'done'`, the counts and the shared layer. Run by the brief handler after
// its brief stage (flag on), and by the worker itself when the brief stage is done and
// the enqueue stage is not (A3: recovery belongs to the worker, never a second cron).
//
// WORKER INVOCATION (runWorkerInvocation), every 2 minutes 12–21 UTC on weekdays:
//   1. the reconcile pass over today's confirmed plans — heard, no longer current,
//      retries, and RETIREMENT AT THE CLOSE (B3: within two minutes of the stock close,
//      early closes included) — budgeted at 10 s;
//   2. enqueue recovery (A3);
//   3. the drain: 4 jobs in flight, a new one started whenever one finishes, until fewer
//      than 130 s of the 300 s maxDuration remain (A6's reserve for the longest job plus
//      writes); then the in-flight jobs finish and the invocation exits.
// An invocation with nothing to do exits in well under a second.
//
// THE COHORT (Amendment E §E7). The cron and the brief handler run none of this unless the flag is on AND
// HUDDLE_PLAYER_UIDS names someone (gate.js isHuddleLive). Inside, every stage keeps to the cohort: the enqueue
// enumerates only cohort members, the reconcile pass visits only their rows, and the drain claims only their rows — so a
// row left by a player since removed from the cohort (or by a preview with another scope) is never worked here.

import { huddleRunRef, sessionOf, etDateOfMs } from './records.js';
import { enqueuePlayers, selectClaimable, claimRow, rowsToReconcile, markReconciled } from './queue.js';
import { enumerateActivePlayers } from './players.js';
import { buildSharedLayer } from './sharedLayer.js';
import { reconcileHuddle } from './applyPlan.js';
import { runHuddleJob } from './job.js';
import { huddleCohortOf } from './gate.js';

export const WORKER_MAX_DURATION_MS = 300_000;
export const DRAIN_RESERVE_MS = 130_000;
export const IN_FLIGHT = 4;
export const RECONCILE_BUDGET_MS = 10_000;

const iso = (ms) => new Date(ms).toISOString();

/**
 * Write the run marker's fields (merge). The one write that runs while the flag is off (the brief handler's marker). The
 * collection is named literally so the protected-stores scanner counts this site (review L1-5: a ref helper's result went uncounted).
 */
export async function markRun(db, etDate, fields) {
  huddleRunRef(db, etDate); // validates the date key (it throws on a malformed one)
  await db.collection('huddleRuns').doc(etDate).set({ ...fields, updatedAt: iso(Date.now()) }, { merge: true });
}

/** The enqueue stage (idempotent row keys). Nothing on a non-trading day: the brief cron also runs on weekday holidays (review L2-8). */
export async function runEnqueueStage(db, { etDate, nowMs = Date.now(), deps = {}, cohort = huddleCohortOf() }) {
  if (!sessionOf(etDate)?.isTradingDay) return { enqueued: 0, created: 0, skipped: 'not_a_trading_day' };
  // E7: no cohort, no stage — not even the shared layer's one vendor call
  if (!(cohort instanceof Set) || cohort.size === 0) return { enqueued: 0, created: 0, skipped: 'no_cohort' };
  const shared = await (deps.buildSharedLayer || buildSharedLayer)(db, { etDate, nowMs });
  const players = await (deps.enumerateActivePlayers || enumerateActivePlayers)(db, { etDate, cohort });
  const { created } = await enqueuePlayers(db, { etDate, uids: players.uids, nowMs });
  await markRun(db, etDate, {
    enqueueStage: 'done', playersEnqueued: players.uids.length, rowsCreated: created, playersSkipped: players.skippedCpu,
    playerCounts: players.counts, playersOutsideCohort: players.outsideCohort ?? null, shared,
  });
  return { enqueued: players.uids.length, created };
}

/**
 * The reconcile pass over today's published and confirmed huddles, inside its budget, least recently reconciled first;
 * each visit is stamped, and a settled day leaves the set (review L1-3). I/O injectable for tests.
 */
export async function runReconcilePass(db, { etDate, nowMs, budgetMs = RECONCILE_BUDGET_MS, clock = () => Date.now(), deps = {}, cohort = huddleCohortOf() }) {
  const start = clock();
  // E7: only the cohort's rows are visited
  const inCohort = (uid) => cohort instanceof Set && cohort.has(uid);
  const rows = (await (deps.rowsToReconcile || rowsToReconcile)(db, { etDate })).filter((row) => inCohort(row?.uid));
  const visit = deps.reconcileHuddle || reconcileHuddle;
  const mark = deps.markReconciled || markReconciled;
  const tallies = [];
  for (const row of rows) {
    if (clock() - start > budgetMs) break;
    const at = nowMs ?? clock();
    const tally = await visit(db, { uid: row.uid, etDate, nowMs: at });
    tallies.push(tally);
    try {
      await mark(db, { uid: row.uid, etDate, settled: tally?.settled === true, nowMs: at });
    } catch { /* the next tick visits it again */ }
  }
  return { visited: tallies.length, of: rows.length, retired: tallies.reduce((n, t) => n + (t.retired || 0), 0) };
}

/**
 * The drain: up to IN_FLIGHT jobs at once, replenished as each finishes, while at least
 * DRAIN_RESERVE_MS of the invocation remain. `runJob` is injectable for tests.
 */
export async function drainQueue(db, { etDate, session, shared, invocationStartMs, clock = () => Date.now(), maxDurationMs = WORKER_MAX_DURATION_MS, runJob = runHuddleJob, deps = {}, io = {}, cohort = huddleCohortOf() }) {
  const deadlineMs = invocationStartMs + maxDurationMs;
  // No job starts once the session has closed: its plan would expire at once (review L2-8). Without a session (the brief
  // handler's in-handler drain, which claims nothing anyway) only the reserve applies.
  const closeMs = typeof session?.closeMs === 'number' ? session.closeMs : Infinity;
  const canStart = () => deadlineMs - clock() >= DRAIN_RESERVE_MS && clock() < closeMs;
  const results = [];
  if (!canStart()) return { started: 0, results };
  // E7: only the cohort's rows are claimed
  const candidates = (await (io.selectClaimable || selectClaimable)(db, { etDate, nowMs: clock() }))
    .filter((row) => cohort instanceof Set && cohort.has(row?.uid));
  const claimOne = io.claimRow || claimRow;
  let next = 0;
  let started = 0;
  const startOne = async () => {
    while (next < candidates.length && canStart()) {
      const row = candidates[next];
      next += 1;
      // A claim that throws (contention past the SDK's retries, Firestore unavailable) is that row's outcome, never the
      // drain's: the other lanes keep running and are awaited (review L2-7).
      let claim;
      try {
        claim = await claimOne(db, { uid: row.uid, etDate, nowMs: clock() });
      } catch {
        results.push({ uid: row.uid, outcome: 'claim_error' });
        continue;
      }
      if (claim.kind !== 'claimed') { results.push({ uid: row.uid, outcome: claim.kind }); continue; }
      started += 1;
      const t0 = clock();
      const r = await runJob(db, { uid: row.uid, etDate, generation: claim.generation, session, shared, invocationDeadlineMs: deadlineMs - 10_000, deps, clock });
      results.push({ uid: row.uid, outcome: r.outcome, reason: r.reason ?? null, ms: clock() - t0, timings: r.timings ?? null });
    }
  };
  await Promise.all(Array.from({ length: IN_FLIGHT }, () => startOne()));
  return { started, results };
}

/**
 * One worker invocation. The caller has already checked the flag (it exits at once off).
 * @returns {Promise<object>} the summary the cron logs and returns
 */
export async function runWorkerInvocation(db, { clock = () => Date.now(), deps = {}, cohort = huddleCohortOf() } = {}) {
  const invocationStartMs = clock();
  const etDate = etDateOfMs(invocationStartMs);
  const session = sessionOf(etDate);
  if (!session) return { etDate, outcome: 'calendar_missing' };
  if (!session.isTradingDay) return { etDate, outcome: 'not_a_trading_day' };

  // The reconcile pass never stops the drain (review L2-7).
  let reconcile;
  try {
    reconcile = await runReconcilePass(db, { etDate, clock, cohort });
  } catch (err) {
    reconcile = { error: String(err?.message || err).slice(0, 120) };
  }

  const runSnap = await huddleRunRef(db, etDate).get();
  let run = runSnap.exists ? runSnap.data() : null;
  let recovered = false;
  if (run?.briefStage === 'done' && run?.enqueueStage !== 'done') {
    await runEnqueueStage(db, { etDate, nowMs: clock(), deps: deps.enqueue || {}, cohort });
    recovered = true;
    run = (await huddleRunRef(db, etDate).get()).data();
  }
  if (run?.enqueueStage !== 'done') return { etDate, outcome: 'not_enqueued', reconcile };

  const drain = await drainQueue(db, { etDate, session, shared: run.shared ?? null, invocationStartMs, clock, runJob: deps.runJob, deps: deps.job || {}, cohort });
  return { etDate, outcome: 'drained', reconcile, recovered, started: drain.started, results: drain.results };
}
