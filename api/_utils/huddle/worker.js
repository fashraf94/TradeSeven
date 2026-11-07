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

import { huddleRunRef, sessionOf, etDateOfMs } from './records.js';
import { enqueuePlayers, selectClaimable, claimRow, rowsToReconcile } from './queue.js';
import { enumerateActivePlayers } from './players.js';
import { buildSharedLayer } from './sharedLayer.js';
import { reconcileHuddle } from './applyPlan.js';
import { runHuddleJob } from './job.js';

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

/** The enqueue stage (idempotent row keys). */
export async function runEnqueueStage(db, { etDate, nowMs = Date.now(), deps = {} }) {
  const shared = await (deps.buildSharedLayer || buildSharedLayer)(db, { etDate, nowMs });
  const players = await (deps.enumerateActivePlayers || enumerateActivePlayers)(db, { etDate });
  const { created } = await enqueuePlayers(db, { etDate, uids: players.uids, nowMs });
  await markRun(db, etDate, {
    enqueueStage: 'done', playersEnqueued: players.uids.length, rowsCreated: created, playersSkipped: players.skippedCpu,
    playerCounts: players.counts, shared,
  });
  return { enqueued: players.uids.length, created };
}

/** The reconcile pass over today's confirmed plans, inside its budget. */
export async function runReconcilePass(db, { etDate, nowMs, budgetMs = RECONCILE_BUDGET_MS, clock = () => Date.now() }) {
  const start = clock();
  const rows = await rowsToReconcile(db, { etDate });
  const tallies = [];
  for (const row of rows) {
    if (clock() - start > budgetMs) break;
    tallies.push(await reconcileHuddle(db, { uid: row.uid, etDate, nowMs: nowMs ?? clock() }));
  }
  return { visited: tallies.length, of: rows.length, retired: tallies.reduce((n, t) => n + (t.retired || 0), 0) };
}

/**
 * The drain: up to IN_FLIGHT jobs at once, replenished as each finishes, while at least
 * DRAIN_RESERVE_MS of the invocation remain. `runJob` is injectable for tests.
 */
export async function drainQueue(db, { etDate, session, shared, invocationStartMs, clock = () => Date.now(), maxDurationMs = WORKER_MAX_DURATION_MS, runJob = runHuddleJob, deps = {} }) {
  const deadlineMs = invocationStartMs + maxDurationMs;
  const canStart = () => deadlineMs - clock() >= DRAIN_RESERVE_MS;
  const results = [];
  if (!canStart()) return { started: 0, results };
  const candidates = await selectClaimable(db, { etDate, nowMs: clock() });
  let next = 0;
  let started = 0;
  const startOne = async () => {
    while (next < candidates.length && canStart()) {
      const row = candidates[next];
      next += 1;
      const claim = await claimRow(db, { uid: row.uid, etDate, nowMs: clock() });
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
export async function runWorkerInvocation(db, { clock = () => Date.now(), deps = {} } = {}) {
  const invocationStartMs = clock();
  const etDate = etDateOfMs(invocationStartMs);
  const session = sessionOf(etDate);
  if (!session) return { etDate, outcome: 'calendar_missing' };
  if (!session.isTradingDay) return { etDate, outcome: 'not_a_trading_day' };

  const reconcile = await runReconcilePass(db, { etDate, clock });

  const runSnap = await huddleRunRef(db, etDate).get();
  let run = runSnap.exists ? runSnap.data() : null;
  let recovered = false;
  if (run?.briefStage === 'done' && run?.enqueueStage !== 'done') {
    await runEnqueueStage(db, { etDate, nowMs: clock(), deps: deps.enqueue || {} });
    recovered = true;
    run = (await huddleRunRef(db, etDate).get()).data();
  }
  if (run?.enqueueStage !== 'done') return { etDate, outcome: 'not_enqueued', reconcile };

  const drain = await drainQueue(db, { etDate, session, shared: run.shared ?? null, invocationStartMs, clock, runJob: deps.runJob, deps: deps.job || {} });
  return { etDate, outcome: 'drained', reconcile, recovered, started: drain.started, results: drain.results };
}
