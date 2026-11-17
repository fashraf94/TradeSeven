// api/_utils/evalPool.js
//
// Evaluator capacity, Build 1 — THE POOL (shape (d) of
// docs/audits/20261115_PHASE0_EVAL_FANOUT.md; build report
// docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md §Part 1).
//
// The dispatcher the evaluation handler drives in place of its sequential
// loop. Pure scheduling: no I/O, no clock of its own (the handler's start rule
// reads the run's clock), no knowledge of what a battle check does. The
// handler hands it one item per battle in rotation order and a `run` that
// checks one battle inside its OWN capture scope with its OWN catch — the pool
// never wraps several battles in one scope (discovery Part C item 1: one scope
// around a batch would make the checks share `ctx` and `holder`).
//
// At K = 1 it is the loop it replaced, await for await: before each battle the
// start rule is asked once; the first "no" stops the dispatcher and the rest
// are deferred, in rotation order; a battle runs to its end before the next is
// asked about. (The next battle starts one microtask hop later than in the
// loop — the pool's own `.then` — which no I/O can observe; the dark proof
// compares every effect.) The League affinity rule never binds at K = 1,
// because nothing else is in flight when a battle starts.

/** The largest K the setting may ask for; anything outside 1–8 reads as 1. */
export const EVAL_POOL_K_MAX = 8;

/**
 * EVAL_POOL_K as the dispatcher uses it: an integer 1–8 as is, anything else
 * (0, 9, 1.5, the string "3", NaN, null) as 1 — a malformed setting can only
 * ever mean today's sequential loop.
 */
export function clampPoolK(value) {
  return Number.isInteger(value) && value >= 1 && value <= EVAL_POOL_K_MAX ? value : 1;
}

/**
 * The start cutoff in force for a run: TIME_BUDGET_MS at K = 1 (the rule the
 * loop always had), the pool's own cutoff above it. A pool cutoff that is not
 * a finite number in (0, timeBudgetMs] reads as timeBudgetMs — a malformed
 * setting can never defer every battle (review PL-7).
 */
export function poolStartCutoffMs(k, { timeBudgetMs, poolCutoffMs }) {
  if (k === 1) return timeBudgetMs;
  return Number.isFinite(poolCutoffMs) && poolCutoffMs > 0 && poolCutoffMs <= timeBudgetMs ? poolCutoffMs : timeBudgetMs;
}

/**
 * The League affinity key: a battle's `groupId` when it is a non-empty string
 * (the field resolveTournamentContext reads, tournamentAgentLedger.js), else
 * null — no affinity. Two battles with the same key are never in flight at once.
 */
export function poolGroupOf(battle) {
  return typeof battle?.groupId === 'string' && battle.groupId.length > 0 ? battle.groupId : null;
}

/**
 * Run `run(item)` over `items`, at most `k` at once, starting them in order.
 *
 * - Before each start, and only while an item is waiting, `mayStart()` is
 *   asked. The first false stops the dispatcher for good: `onStop` receives
 *   the items never started, in their original order, at that instant. Items
 *   already running are never deferred; the pool waits for them.
 * - An item whose group (via `groupOf`) has an item in flight is passed over;
 *   the first later item whose group is free starts instead, and the passed-over
 *   one is reconsidered, ahead of later items, when a slot or its group frees.
 * - `stats` (optional) is updated live with `dispatched` and `maxInFlight`, so a
 *   caller that is interrupted still holds the numbers so far.
 * - If a `run` rejects (the handler's own catch makes that a defect, not a
 *   battle error), nothing more is started; the pool waits for the items still
 *   running and then rejects with the first such error. No item is deferred on
 *   that path — exactly as the loop's exception left the rest unrecorded.
 *
 * Resolves with `{ dispatched, maxInFlight, deferred, stopped }` once nothing
 * is in flight and nothing more will start.
 *
 * @param {object} p
 * @param {Array} p.items
 * @param {number} p.k                       already clamped (clampPoolK)
 * @param {() => boolean} p.mayStart
 * @param {(item:any) => Promise<void>} p.run
 * @param {(item:any) => (string|null)} [p.groupOf]
 * @param {(deferred:Array) => void} [p.onStop]
 * @param {{dispatched:number, maxInFlight:number}} [p.stats]
 */
export function runEvalPool({ items, k: requestedK, mayStart, run, groupOf = () => null, onStop = () => {}, stats = { dispatched: 0, maxInFlight: 0 } }) {
  // The helper clamps too (review PL-2): a K outside 1–8 can only mean one at a time.
  const k = clampPoolK(requestedK);
  return new Promise((resolve, reject) => {
    const waiting = [...items];
    const busyGroups = new Set();
    let inFlight = 0;
    let stopped = false;
    let deferred = [];
    let failure = null;
    let settledOnce = false;

    const settle = () => {
      if (settledOnce) return;
      settledOnce = true;
      if (failure) reject(failure.error);
      else resolve({ dispatched: stats.dispatched, maxInFlight: stats.maxInFlight, deferred, stopped });
    };

    // `failed` is its own argument: a run that rejects with a falsy reason (0,
    // '', false, undefined) is still a failure (review PL-2).
    const finished = (group, failed, error) => {
      inFlight -= 1;
      if (group !== null) busyGroups.delete(group);
      if (failed && !failure) failure = { error };
      pump();
    };

    const pump = () => {
      try {
        while (!stopped && !failure && inFlight < k && waiting.length > 0) {
          if (!mayStart()) {
            stopped = true;
            deferred = waiting.splice(0, waiting.length);
            onStop(deferred);
            break;
          }
          const at = waiting.findIndex((item) => {
            const group = groupOf(item);
            return group === null || !busyGroups.has(group);
          });
          if (at < 0) break; // every waiting item's group is busy: the next finish pumps again
          const [item] = waiting.splice(at, 1);
          const group = groupOf(item);
          if (group !== null) busyGroups.add(group);
          inFlight += 1;
          stats.dispatched += 1;
          if (inFlight > stats.maxInFlight) stats.maxInFlight = inFlight;
          let pending;
          try {
            pending = Promise.resolve(run(item));
          } catch (err) {
            pending = Promise.reject(err);
          }
          pending.then(
            () => finished(group, false, null),
            (err) => finished(group, true, err ?? new Error('evalPool: a run rejected without a reason')),
          );
        }
      } catch (err) {
        // A throwing start rule, group key or onStop is a defect of the caller:
        // start nothing more, let what runs finish, then reject with it.
        if (!failure) failure = { error: err };
      }
      if (inFlight === 0) settle();
    };

    pump();
  });
}
