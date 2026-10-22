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
//                 during a cycle leaves at most one dirty follow-up.
//   lifecycle     hiding clears the timers, revokes the cycle's result
//                 consumers and keeps its unfinished rows and spent rate
//                 slots; nothing starts while hidden; coming back runs at most
//                 one cycle. dispose() (unmount, owner change) clears
//                 everything, and a late answer of any kind is ignored.
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
 */
export function createReviewScheduler({
  owner, max = 10, clock, queryCompleted, checkReview, onChange, visible = true, budget = REVIEW_BUDGET,
}) {
  const { now, setTimer, clearTimer } = clock;
  const starts = { queries: [], helpers: [] };
  const results = new Map();      // battle id → the last real helper answer
  const unfinished = new Map();   // battle id → { cause: started|unstarted|timeout|error|interrupted, lastStartAt }
  let disposed = false;
  let isVisible = visible !== false;
  let battles = null;
  let generation = 0;
  let lastSuccessfulAt = null;
  let status = 'loading';
  let error = null;
  let lastCycleAt = null;
  let queryOwed = false;
  let cursor = 0;
  let cycle = null;
  let queued = null;              // { at, wanted, timer } — the one cycle waiting for admission
  let dirty = false;
  let seq = 0;
  let state = null;

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

  /** Work that warrants a scheduled cycle: a pending review, an unfinished row, an owed query. */
  function workRemains() {
    if (queryOwed || status === 'error') return true;
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
    const c = { id, phase: 'query', deadlineAt: t + budget.cycleDeadlineMs, queue: [], inflight: new Map(), queryTimer: null, cycleTimer: null };
    cycle = c;
    starts.queries.push(t);
    lastCycleAt = t;
    queryOwed = false;
    // Both deadlines run from before the first await: imports and setup count.
    c.queryTimer = setTimer(() => queryFailed(id, new LocalTimeout('the completed query')), budget.queryDeadlineMs);
    c.cycleTimer = setTimer(() => expireCycle(id), budget.cycleDeadlineMs);
    emit();
    settle(() => queryCompleted(owner.uid, max)).then((docs) => queryDone(id, docs), (err) => queryFailed(id, err));
  }

  const current = (id) => !disposed && cycle !== null && cycle.id === id;
  /** After a suspension the next callback checks the clock before anything else. */
  const overdue = (c) => now() >= c.deadlineAt;

  function queryDone(id, docs) {
    if (!current(id) || cycle.phase !== 'query') return;
    const c = cycle;
    if (overdue(c)) {
      expireCycle(id);
      return;
    }
    if (!Array.isArray(docs)) {
      queryFailed(id, new TypeError('the completed query answered no list'));
      return;
    }
    clearTimer(c.queryTimer);
    battles = Object.freeze(docs.filter((d) => d && typeof d === 'object' && typeof d.id === 'string' && d.id && d.ownerId === owner.uid));
    generation += 1;
    lastSuccessfulAt = now();
    status = 'ready';
    error = null;
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
    queryOwed = true;
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
    starts.helpers.push(t);
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
        if (c.phase === 'query') queryOwed = true;
        for (const [rowId, f] of c.inflight) {
          clearTimer(f.timer);
          unfinished.set(rowId, { cause: 'interrupted', lastStartAt: f.startedAt });
        }
        for (const rowId of c.queue) if (!unfinished.has(rowId)) unfinished.set(rowId, { cause: 'unstarted', lastStartAt: null });
        cycle = null;
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
