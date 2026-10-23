// src/components/CommandCenter/hub/reviewScheduler.js
//
// Command Center hub, slice S3 (ruling R-S3-6; spec V1.2 §6, correction C5) —
// the Film Room coordinator's scheduler. Pure: it holds no timer, clock or
// read of its own. The clock (`now`, `setTimer`, `clearTimer`), the completed
// read and the review helper are injected, so every rule below runs under a
// fake clock in its tests; hub/useHubCompletedBattles.js is the thin hook that
// gives it the real ones.
//
// ONE scheduler per mounted owner and auth epoch. A CYCLE is one completed
// query (the ten-game window) and then one helper check per non-ready row:
//
//   rolling cap   per 120 s: one query, ten helper starts. A cycle is admitted
//                 only when its query slot is free AND capacity for the full
//                 ten starts is (no helper start inside the window): its
//                 workload is unknown before the query, so it reserves the
//                 maximum. Waiting for admission is shown as queued, with the
//                 real next time, and is outside the cycle's 42 s.
//   concurrency   at most three helper checks at once.
//   deadlines     8 s for the query and 8 s for each helper check, each from
//                 its start (imports and setup included), and 42 s for the
//                 whole cycle from the query's start. A local timeout is never
//                 turned into the helper's `unavailable`: the row is unfinished.
//   fairness      the next cycle serves carry-over unstarted rows first, then
//                 carry-over timed-out rows by oldest start, rotating among
//                 rows of equal priority; every other non-ready row follows in
//                 window order. A ready row is cached and never asked again.
//   triggers      mount; explicit refresh or Retry; a live game ending; focus
//                 or becoming visible when the last cycle is at least 120 s
//                 old; and a scheduled cycle while a review is pending or work
//                 is unfinished. All share the cap: a trigger that cannot run
//                 now queues ONE cycle at the next permitted time; a trigger
//                 during a cycle leaves at most one dirty follow-up. A failed
//                 query owes ONE automatic retry per failure episode, queued
//                 at the next permitted time (published as the next attempt);
//                 if the retry fails too nothing is queued and only a trigger
//                 asks again (a success ends the episode; review T3-4).
//   lifecycle     hiding clears the timers, revokes the cycle's result
//                 consumers and keeps its unfinished rows and spent rate
//                 slots; nothing starts while hidden; coming back runs at most
//                 one cycle. dispose() (unmount, owner change) clears
//                 everything but the rate ledger, and a late answer of any
//                 kind is ignored — but one: the answer of a FIRST read that
//                 was out at dispose goes to `onLate` once (Amendment B,
//                 Q-S3-9), inside the query's own deadlines. The ledger may be
//                 handed in: the hook keeps
//                 one per owner and auth epoch, so a remount (a return from the
//                 Film Room, a site switch) spends the same budget (§6: "Every
//                 trigger shares this budget"; review T0-3).
//   carried       spec §6's unmount list as the founder amended it (Q-S3-2,
//                 ruling A+): the hook also keeps the owner's and epoch's last
//                 successful window — its documents, generation and as-of time
//                 — and hands it in as `retained`. The scheduler starts from it
//                 (`carried: true`, "as of" its time) and refreshes it at the
//                 next permitted slot; its first successful read ends the
//                 carry. Unfinished queues, dirty work and result consumers
//                 still clear on unmount, so a carried row's review is an
//                 unstarted row — except a row whose review was READY: that
//                 answer is kept with the window and handed in as
//                 `retained.ready` (Amendment B, Q-S3-10), so it opens at once.
//                 An owner or epoch change starts empty.
//
// Only getReviewAvailability's three fields are read from a check
// (`ready`, `target`, `availability`); the battle documents are handed over
// as they are and never read here.

export const REVIEW_BUDGET = Object.freeze({
  windowMs: 120_000,
  queriesPerWindow: 1,
  helpersPerWindow: 10,
  concurrency: 3,
  queryDeadlineMs: 8_000,
  helperDeadlineMs: 8_000,
  cycleDeadlineMs: 42_000,
  staleAfterMs: 120_000,
});

/** A row's review state, for the display (hub/gamesDisplay.js). */
export const REVIEW_STATES = Object.freeze({
  READY: 'ready',
  PENDING: 'pending',
  UNAVAILABLE: 'unavailable',
  CHECKING: 'checking',
  QUEUED: 'queued',
  TIMED_OUT: 'timedOut',
});

/** The triggers (spec §6). `focus` and `visible` run only when the last cycle is at least 120 s old. */
export const REVIEW_TRIGGERS = Object.freeze({
  MOUNT: 'mount',
  MANUAL: 'manual',
  LIVE_LEFT: 'liveLeft',
  FOCUS: 'focus',
  VISIBLE: 'visible',
  /** Slice S4 (founder ruling Q-S3-6): History's Refresh. An explicit trigger, so it shares the rolling cap with the rest (§6). */
  HISTORY: 'history',
});

const AVAILABILITY = new Set(['ready', 'pending', 'unavailable']);

/** A real helper answer: its three fields, a known word, and a target when ready. */
function helperAnswer(res) {
  if (!res || typeof res !== 'object' || !AVAILABILITY.has(res.availability)) return null;
  const ready = res.availability === 'ready';
  if (res.ready !== ready) return null;
  if (ready && !(typeof res.target === 'string' && res.target)) return null;
  return Object.freeze({ ready, target: typeof res.target === 'string' ? res.target : null, availability: res.availability });
}

/** The owner's own documents, one per id (the first copy): a row is keyed by its id everywhere (review T3-9). */
function ownedWindow(docs, ownerUid) {
  const seenIds = new Set();
  return Object.freeze(docs.filter((d) => {
    if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !d.id || d.ownerId !== ownerUid || seenIds.has(d.id)) return false;
    seenIds.add(d.id);
    return true;
  }));
}

/**
 * The ready review answers a kept window brings back (Amendment B, Q-S3-10): for a row of THIS window, the helper's own
 * answer, if it is a real one and says ready. Pending, unavailable, timed-out and queued answers are not kept: they are
 * asked again, as before. Anything malformed is dropped.
 */
function keptReadyAnswers(given, battles) {
  const kept = {};
  if (!given || typeof given !== 'object') return kept;
  for (const b of battles) {
    const answer = Object.hasOwn(given, b.id) ? helperAnswer(given[b.id]) : null;
    if (answer && answer.availability === 'ready') kept[b.id] = answer;
  }
  return kept;
}

/**
 * A kept window, as a scheduler for `owner` may start from it (Q-S3-2, A+): this owner's documents, a positive whole
 * generation and a real as-of time — or nothing, so a malformed hand-in starts empty rather than shows a guess. With them,
 * the ready review answers of its rows (Amendment B), when it has any.
 */
export function carriedWindow(owner, retained) {
  if (!owner || !retained || typeof retained !== 'object' || !Array.isArray(retained.battles)) return null;
  if (!Number.isSafeInteger(retained.generation) || retained.generation < 1) return null;
  if (!Number.isFinite(retained.lastSuccessfulAt)) return null;
  const battles = ownedWindow(retained.battles, owner.uid);
  const ready = keptReadyAnswers(retained.ready, battles);
  return Object.freeze({
    battles,
    generation: retained.generation,
    lastSuccessfulAt: retained.lastSuccessfulAt,
    ...(Object.keys(ready).length ? { ready: Object.freeze(ready) } : {}),
  });
}

/**
 * The public state a scheduler started from `retained` shows before it has done anything: the hook's render between
 * a remount and the scheduler's first change. Every carried row's review is queued (not yet started this mount).
 */
export function carriedState(owner, retained) {
  const kept = carriedWindow(owner, retained);
  if (!kept) return null;
  return Object.freeze({
    ownerUid: owner.uid,
    ownerEpoch: owner.authEpoch,
    status: 'ready',
    battles: kept.battles,
    generation: kept.generation,
    lastSuccessfulAt: kept.lastSuccessfulAt,
    error: null,
    checking: false,
    refreshing: false,
    inFlight: 0,
    nextAttemptAt: null,
    carried: true,
    // A kept ready answer is ready at once (Amendment B): "Open battle tape" works on the first frame of a return.
    reviews: Object.freeze(Object.fromEntries(kept.battles.map((b) => {
      const answer = kept.ready?.[b.id];
      return [b.id, Object.freeze(answer
        ? { state: REVIEW_STATES.READY, result: answer, nextAt: null }
        : { state: REVIEW_STATES.QUEUED, result: null, nextAt: null })];
    }))),
  });
}

const settle = (fn) => new Promise((resolve) => { resolve(fn()); });

class LocalTimeout extends Error {
  constructor(what) {
    super(`${what} passed its local deadline`);
    this.name = 'LocalTimeout';
  }
}

/**
 * @param {object} p
 * @param {{ uid: string, authEpoch: number }} p.owner
 * @param {number} [p.max]                  the window size (10)
 * @param {{ now: () => number, setTimer: (fn, ms) => any, clearTimer: (handle) => void }} p.clock
 * @param {(uid: string, max: number) => Promise<object[]>} p.queryCompleted
 * @param {(battle: object) => Promise<{ ready, target, availability }>} p.checkReview
 * @param {(state: object) => void} p.onChange   every new public state
 * @param {boolean} [p.visible]
 * @param {{ queries: number[], helpers: number[] }} [p.ledger]  the rolling start times, when they outlive this
 *                                          scheduler (the owner's and epoch's, kept by the hook); else its own
 * @param {{ battles: object[], generation: number, lastSuccessfulAt: number, ready?: object }} [p.retained]  the owner's and
 *                                          epoch's last successful window, kept by the hook across a remount (Q-S3-2, A+),
 *                                          with the ready review answers of its rows (Amendment B)
 * @param {(window: { battles: object[], generation: number, lastSuccessfulAt: number }) => void} [p.onLate]  Amendment B: a
 *                                          FIRST read that succeeds after dispose() is handed here, once, for the hook to keep
 *                                          for this owner and epoch (never for another: the hook keys it)
 */
export function createReviewScheduler({
  owner, max = 10, clock, queryCompleted, checkReview, onChange, visible = true, budget = REVIEW_BUDGET, ledger = null, retained = null, onLate = null,
}) {
  const { setTimer, clearTimer } = clock;
  const starts = ledger || { queries: [], helpers: [] };
  /** A start counts for one window; older ones are dropped, so a ledger that outlives a mount stays small. */
  const record = (list, t) => {
    list.push(t);
    while (list.length && list[0] <= t - budget.windowMs) list.shift();
  };
  const results = new Map();      // battle id → the last real helper answer
  const unfinished = new Map();   // battle id → { cause: started|unstarted|timeout|error|interrupted, lastStartAt }
  let disposed = false;
  let lateRead = null;            // dispose() left a FIRST read out: { id, startedAt } — its one answer may still be kept (Amendment B)
  let isVisible = visible !== false;
  let battles = null;
  let generation = 0;
  let lastSuccessfulAt = null;
  let status = 'loading';
  let error = null;
  let lastCycleAt = null;
  let retryOwed = false;          // a failed query owes its failure episode's ONE automatic retry...
  let retrySpent = false;         // ...which this episode has already had; a successful query starts a new episode
  let cursor = 0;
  let cycle = null;
  let queued = null;              // { at, wanted, timer } — the one cycle waiting for admission
  let dirty = false;
  let seq = 0;
  let state = null;
  // Q-S3-2 (A+): a kept window starts this scheduler "as of" its time; this scheduler's first successful read ends the carry.
  let carried = false;
  const kept = carriedWindow(owner, retained);
  if (kept) {
    battles = kept.battles;
    generation = kept.generation;
    lastSuccessfulAt = kept.lastSuccessfulAt;
    status = 'ready';
    carried = true;
    // Amendment B (Q-S3-10): a kept ready answer is this mount's ready cache; every other carried row's review (pending,
    // unavailable, timed out, queued) did not survive the unmount and is unstarted in this mount.
    for (const b of battles) {
      const answer = kept.ready?.[b.id];
      if (answer) results.set(b.id, answer);
      else unfinished.set(b.id, { cause: 'unstarted', lastStartAt: null });
    }
  }

  /**
   * The clock's reading, with the bookkeeping healed to it (review T3-7). Stamps are wall-clock ms; a backward step of
   * the clock (NTP, a manual change) would leave every recorded start and the last cycle in the future, where they
   * never age out for the size of the step. A stamp later than the reading is taken to be the reading: the window
   * restarts there, never longer than one window, and the printed times stay the wall clock's own.
   */
  function now() {
    const t = clock.now();
    for (const list of [starts.queries, starts.helpers]) {
      for (let i = 0; i < list.length; i += 1) if (list[i] > t) list[i] = t;
    }
    if (lastCycleAt !== null && lastCycleAt > t) lastCycleAt = t;
    return t;
  }

  const inWindow = (list, t) => list.filter((s) => s > t - budget.windowMs);

  /**
   * The first time a cycle may start: room in the window for its one query AND
   * for its whole helper workload, reserved at the maximum (the window's rows
   * are unknown before the query). Room for `need` more under `cap` means the
   * oldest `count - (cap - need)` starts have aged out of the window.
   */
  function admissionAt(t) {
    const roomAt = (list, cap, need) => {
      const inside = inWindow(list, t).sort((a, b) => a - b);
      const excess = inside.length - (cap - need);
      return excess > 0 ? inside[excess - 1] + budget.windowMs : t;
    };
    return Math.max(
      t,
      roomAt(starts.queries, budget.queriesPerWindow, 1),
      roomAt(starts.helpers, budget.helpersPerWindow, budget.helpersPerWindow),
    );
  }

  const inView = () => new Set((battles || []).map((b) => b.id));

  /** Work that warrants a scheduled cycle: a pending review, an unfinished row, the owed retry of a failed query. */
  function workRemains() {
    if (retryOwed) return true;
    const ids = inView();
    for (const id of unfinished.keys()) if (ids.has(id)) return true;
    for (const [id, r] of results) if (ids.has(id) && r.availability === 'pending') return true;
    return false;
  }

  function rowOf(id) {
    const r = results.get(id) || null;
    const u = unfinished.get(id) || null;
    const nextAt = queued ? queued.at : null;
    if (r && r.availability === 'ready') return Object.freeze({ state: REVIEW_STATES.READY, result: r, nextAt: null });
    if (u && (u.cause === 'timeout' || u.cause === 'error')) return Object.freeze({ state: REVIEW_STATES.TIMED_OUT, result: r, nextAt });
    if (u && (u.cause === 'unstarted' || u.cause === 'interrupted')) return Object.freeze({ state: REVIEW_STATES.QUEUED, result: r, nextAt });
    if (r) return Object.freeze({ state: r.availability, result: r, nextAt: null });
    return Object.freeze({ state: REVIEW_STATES.CHECKING, result: null, nextAt: null });
  }

  function emit() {
    if (disposed) return;
    state = Object.freeze({
      ownerUid: owner.uid,
      ownerEpoch: owner.authEpoch,
      status,
      battles,
      generation,
      lastSuccessfulAt,
      error,
      checking: Boolean(cycle),
      refreshing: Boolean(cycle) && battles !== null,
      // Logical slots held now: a check past its deadline holds none, though its SDK work may still run.
      inFlight: cycle ? cycle.inflight.size : 0,
      nextAttemptAt: queued ? queued.at : null,
      carried,
      reviews: Object.freeze(Object.fromEntries((battles || []).map((b) => [b.id, rowOf(b.id)]))),
    });
    onChange(state);
  }

  // ── admission ────────────────────────────────────────────────────────────

  function arm() {
    if (!queued || !isVisible || queued.timer != null || disposed) return;
    queued.timer = setTimer(fire, Math.max(0, queued.at - now()));
  }

  function fire() {
    if (disposed || !queued) return;
    queued.timer = null;
    if (!isVisible) return;
    const t = now();
    const at = admissionAt(t);
    if (at > t) {
      queued.at = at;
      arm();
      emit();
      return;
    }
    const { wanted } = queued;
    queued = null;
    if (!wanted && !workRemains()) {
      emit();
      return;
    }
    startCycle(t);
  }

  /** Ask for a cycle. `wanted`: an explicit trigger, run even with no review pending. */
  function request(wanted) {
    if (disposed) return;
    if (cycle) {
      if (wanted) dirty = true;
      return;
    }
    if (queued) {
      queued.wanted = queued.wanted || wanted;
      return;
    }
    const t = now();
    const at = admissionAt(t);
    if (isVisible && at <= t) {
      startCycle(t);
      return;
    }
    queued = { at, wanted, timer: null };
    arm();
    emit();
  }

  // ── the cycle ────────────────────────────────────────────────────────────

  function startCycle(t) {
    const id = ++seq;
    // `firstRead`: this scheduler holds no window yet (a kept one counts), so this query's answer would be the owner's first.
    const c = { id, phase: 'query', firstRead: battles === null, startedAt: t, deadlineAt: t + budget.cycleDeadlineMs, queue: [], inflight: new Map(), queryTimer: null, cycleTimer: null };
    cycle = c;
    record(starts.queries, t);
    lastCycleAt = t;
    if (retryOwed) {
      retryOwed = false;
      retrySpent = true;
    }
    // Both deadlines run from before the first await: imports and setup count.
    c.queryTimer = setTimer(() => queryFailed(id, new LocalTimeout('the completed query')), budget.queryDeadlineMs);
    c.cycleTimer = setTimer(() => expireCycle(id), budget.cycleDeadlineMs);
    emit();
    settle(() => queryCompleted(owner.uid, max)).then((docs) => queryDone(id, docs), (err) => queryFailed(id, err));
  }

  const current = (id) => !disposed && cycle !== null && cycle.id === id;
  /** After a suspension the next callback checks the clock before anything else. */
  const overdue = (c) => now() >= c.deadlineAt;
  /** ...and so does an operation's own eight seconds: an answer past them, delivered before its timer's callback has run, is late (review T3-6). */
  const late = (startedAt, limit) => now() - startedAt >= limit;

  /**
   * Amendment B (founder ruling Q-S3-9): the answer of a FIRST read that was out when the hub unmounted. It is kept only if
   * a mounted scheduler would have accepted it — a list, inside the query's own 8 s and the cycle's 42 s — and only once; the
   * hook files it under the owner and epoch it was started for, and nowhere else.
   */
  function lateDone(id, docs) {
    const read = lateRead;
    lateRead = null;
    if (!read || read.id !== id || !Array.isArray(docs) || typeof onLate !== 'function') return;
    const elapsed = clock.now() - read.startedAt;
    if (elapsed >= budget.queryDeadlineMs || elapsed >= budget.cycleDeadlineMs) return;
    onLate(Object.freeze({ battles: ownedWindow(docs, owner.uid), generation: generation + 1, lastSuccessfulAt: clock.now() }));
  }

  function queryDone(id, docs) {
    if (disposed) {
      lateDone(id, docs);
      return;
    }
    if (!current(id) || cycle.phase !== 'query') return;
    const c = cycle;
    if (overdue(c)) {
      expireCycle(id);
      return;
    }
    if (late(c.startedAt, budget.queryDeadlineMs)) {
      queryFailed(id, new LocalTimeout('the completed query'));
      return;
    }
    if (!Array.isArray(docs)) {
      queryFailed(id, new TypeError('the completed query answered no list'));
      return;
    }
    clearTimer(c.queryTimer);
    battles = ownedWindow(docs, owner.uid);
    generation += 1;
    lastSuccessfulAt = now();
    status = 'ready';
    error = null;
    retrySpent = false;
    carried = false;
    // A row that left the refreshed window is done.
    const ids = inView();
    for (const key of [...results.keys()]) if (!ids.has(key)) results.delete(key);
    for (const key of [...unfinished.keys()]) if (!ids.has(key)) unfinished.delete(key);
    c.queue = buildQueue();
    c.phase = 'helpers';
    emit();
    pump(id);
  }

  function queryFailed(id, err) {
    if (!current(id) || cycle.phase !== 'query') return;
    const c = cycle;
    clearTimer(c.queryTimer);
    // The prior window and generation stay; no helper pass runs on unproven data.
    status = 'error';
    error = err ?? null;
    // One automatic retry at the next permitted slot per failure episode; the retry's own failure ends the run.
    // Pending reviews and unfinished rows keep their own schedule; an explicit trigger is never refused.
    retryOwed = !retrySpent;
    endCycle(id);
  }

  /** The fair order: unstarted carry-over (rotated), then timed-out carry-over by oldest start, then the rest. */
  function buildQueue() {
    const rows = battles.filter((b) => results.get(b.id)?.availability !== 'ready').map((b) => b.id);
    const rotate = (list) => {
      if (list.length < 2) return list;
      const k = cursor % list.length;
      return [...list.slice(k), ...list.slice(0, k)];
    };
    const unstarted = rows.filter((id) => unfinished.get(id)?.cause === 'unstarted');
    const started = rows.filter((id) => unfinished.has(id) && unfinished.get(id).cause !== 'unstarted');
    const byStart = new Map();
    for (const id of started) {
      const key = unfinished.get(id).lastStartAt ?? -Infinity;
      if (!byStart.has(key)) byStart.set(key, []);
      byStart.get(key).push(id);
    }
    const startedOrdered = [...byStart.keys()].sort((a, b) => a - b).flatMap((key) => rotate(byStart.get(key)));
    const rest = rows.filter((id) => !unfinished.has(id));
    const order = [...rotate(unstarted), ...startedOrdered, ...rest];
    cursor += 1;
    return order;
  }

  function pump(id) {
    if (!current(id) || cycle.phase !== 'helpers') return;
    const c = cycle;
    const t = now();
    if (overdue(c)) {
      expireCycle(id);
      return;
    }
    let started = 0;
    while (c.inflight.size < budget.concurrency && c.queue.length) {
      // Never past the rolling cap, whatever an earlier cycle spent.
      if (inWindow(starts.helpers, t).length >= budget.helpersPerWindow) break;
      const rowId = c.queue.shift();
      const doc = battles.find((b) => b.id === rowId);
      if (!doc || results.get(rowId)?.availability === 'ready') continue;
      startCheck(c, doc, t);
      started += 1;
    }
    if (c.inflight.size === 0) {
      endCycle(id);
      return;
    }
    // A row being checked no longer reads as queued or timed out.
    if (started) emit();
  }

  function startCheck(c, doc, t) {
    const inv = ++seq;
    record(starts.helpers, t);
    unfinished.set(doc.id, { cause: 'started', lastStartAt: t });
    const timer = setTimer(() => checkFailed(c.id, doc.id, inv, 'timeout'), budget.helperDeadlineMs);
    c.inflight.set(doc.id, { inv, startedAt: t, timer });
    settle(() => checkReview(doc)).then((res) => checkDone(c.id, doc.id, inv, res), () => checkFailed(c.id, doc.id, inv, 'error'));
  }

  /** The invocation still owns its slot: same cycle, same invocation, not expired. */
  function owning(cid, rowId, inv) {
    if (!current(cid)) return null;
    const f = cycle.inflight.get(rowId);
    return f && f.inv === inv ? f : null;
  }

  function checkDone(cid, rowId, inv, res) {
    const f = owning(cid, rowId, inv);
    if (!f) return;
    if (overdue(cycle)) {
      expireCycle(cid);
      return;
    }
    if (late(f.startedAt, budget.helperDeadlineMs)) {
      // Past its eight seconds: a timeout (unfinished, retried), whatever the helper says — never an `unavailable` it did not earn on time.
      checkFailed(cid, rowId, inv, 'timeout');
      return;
    }
    clearTimer(f.timer);
    cycle.inflight.delete(rowId);
    const answer = helperAnswer(res);
    if (answer) {
      results.set(rowId, answer);
      unfinished.delete(rowId);
    } else {
      unfinished.set(rowId, { cause: 'error', lastStartAt: f.startedAt });
    }
    emit();
    pump(cid);
  }

  function checkFailed(cid, rowId, inv, cause) {
    const f = owning(cid, rowId, inv);
    if (!f) return;
    if (overdue(cycle)) {
      expireCycle(cid);
      return;
    }
    clearTimer(f.timer);
    cycle.inflight.delete(rowId);
    // Unfinished, never the helper's `unavailable`; its answer, if it ever comes, is ignored.
    unfinished.set(rowId, { cause, lastStartAt: f.startedAt });
    emit();
    pump(cid);
  }

  function expireCycle(cid) {
    if (!current(cid)) return;
    const c = cycle;
    if (c.phase === 'query') {
      queryFailed(cid, new LocalTimeout('the review cycle'));
      return;
    }
    for (const [rowId, f] of c.inflight) {
      clearTimer(f.timer);
      unfinished.set(rowId, { cause: 'timeout', lastStartAt: f.startedAt });
    }
    c.inflight.clear();
    endCycle(cid);
  }

  function endCycle(cid) {
    if (!current(cid)) return;
    const c = cycle;
    for (const rowId of c.queue) if (!unfinished.has(rowId)) unfinished.set(rowId, { cause: 'unstarted', lastStartAt: null });
    clearTimer(c.queryTimer);
    clearTimer(c.cycleTimer);
    cycle = null;
    if (dirty) {
      dirty = false;
      request(true);
    } else if (workRemains()) {
      request(false);
    }
    emit();
  }

  // ── the public surface ───────────────────────────────────────────────────

  function trigger(reason) {
    if (disposed) return;
    if ((reason === REVIEW_TRIGGERS.FOCUS || reason === REVIEW_TRIGGERS.VISIBLE)
      && lastCycleAt !== null && now() - lastCycleAt < budget.staleAfterMs) return;
    request(true);
  }

  function setVisible(next) {
    const v = next !== false;
    if (disposed || v === isVisible) return;
    isVisible = v;
    if (!v) {
      if (queued && queued.timer != null) {
        clearTimer(queued.timer);
        queued.timer = null;
      }
      const c = cycle;
      if (c) {
        clearTimer(c.queryTimer);
        clearTimer(c.cycleTimer);
        for (const [rowId, f] of c.inflight) {
          clearTimer(f.timer);
          unfinished.set(rowId, { cause: 'interrupted', lastStartAt: f.startedAt });
        }
        for (const rowId of c.queue) if (!unfinished.has(rowId)) unfinished.set(rowId, { cause: 'unstarted', lastStartAt: null });
        cycle = null;
        // The re-queued cycle below is a fresh query that starts after every trigger so far: it already serves the
        // dirty follow-up, so the flag must not outlive the cycle it belonged to (review T3-2).
        dirty = false;
        if (!queued) queued = { at: admissionAt(now()), wanted: true, timer: null };
      }
      emit();
      return;
    }
    // Back: refresh if due and resume queued work — one cycle at most.
    if (queued) arm();
    else if (workRemains()) request(false);
    else trigger(REVIEW_TRIGGERS.VISIBLE);
    emit();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (cycle && cycle.phase === 'query' && cycle.firstRead && typeof onLate === 'function') lateRead = { id: cycle.id, startedAt: cycle.startedAt };
    if (queued && queued.timer != null) clearTimer(queued.timer);
    if (cycle) {
      clearTimer(cycle.queryTimer);
      clearTimer(cycle.cycleTimer);
      for (const f of cycle.inflight.values()) clearTimer(f.timer);
    }
    cycle = null;
    queued = null;
    results.clear();
    unfinished.clear();
    battles = null;
  }

  emit();
  return {
    trigger,
    setVisible,
    dispose,
    getState: () => state,
    /** The rolling ledger, for the budget evidence (tests and the S3 report). */
    ledger: () => ({ queries: [...starts.queries], helpers: [...starts.helpers] }),
  };
}
