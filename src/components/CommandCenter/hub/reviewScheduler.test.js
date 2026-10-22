// src/components/CommandCenter/hub/reviewScheduler.test.js
//
// Command Center hub, slice S3 (ruling R-S3-6) — the Film Room coordinator's
// scheduler under a fake clock, row for row against spec V1.2 §11.3: Review C5,
// Review operation deadlines, Review expiry/fairness, and the budget evidence
// (§6: in any half-open ten minutes at most five queries, fifty returned
// documents and fifty helper invocations).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVIEW_BUDGET, REVIEW_STATES, REVIEW_TRIGGERS, createReviewScheduler } from './reviewScheduler';

const OWNER = Object.freeze({ uid: 'uid-A', authEpoch: 3 });
const T0 = Date.UTC(2026, 9, 22, 15, 0, 0);
const S = 1000;
const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
const PENDING = Object.freeze({ ready: false, target: 'filmRoom', availability: 'pending' });
const UNAVAILABLE = Object.freeze({ ready: false, target: 'filmRoom', availability: 'unavailable' });

const doc = (i, over = {}) => ({ id: `done_${String(i).padStart(2, '0')}`, ownerId: OWNER.uid, status: 'completed', dailyReviews: [], ...over });
const docsOf = (n) => Array.from({ length: n }, (_, i) => doc(i + 1));
const after = (ms, value) => new Promise((resolve) => { setTimeout(() => resolve(value), ms); });
const never = () => new Promise(() => {});
const failing = () => Promise.reject(new Error('failed-precondition: the query requires an index'));
const tick = (ms) => vi.advanceTimersByTimeAsync(ms);

/** A scheduler on the fake clock, recording every query, check and state. */
function harness({ docs = () => docsOf(10), query, check, visible = true } = {}) {
  const queries = [];
  const checks = [];
  const states = [];
  let inflight = 0;
  let maxInflight = 0;
  const scheduler = createReviewScheduler({
    owner: OWNER,
    clock: { now: () => Date.now(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (h) => clearTimeout(h) },
    visible,
    queryCompleted: (uid, max) => {
      queries.push({ at: Date.now() - T0, uid, max });
      return query ? query(queries.length) : Promise.resolve(docs(queries.length));
    },
    checkReview: (battle) => {
      checks.push({ id: battle.id, at: Date.now() - T0, battle });
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      const p = check ? check(battle, checks.length) : Promise.resolve(READY);
      return Promise.resolve(p).finally(() => { inflight -= 1; });
    },
    onChange: (st) => states.push(st),
  });
  return {
    s: scheduler, queries, checks, states, state: () => scheduler.getState(),
    /** Operations physically running (a timed-out check may still run: spec §6 promises no cancellation). */
    maxInflight: () => maxInflight,
    /** Logical slots held, from every state the scheduler published. */
    maxLogical: () => Math.max(0, ...states.map((st) => st.inFlight)),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Review C5 — one coordinator, helper-only, shared cap', () => {
  it('reads only the helper\'s three fields; hands each document over as it came from the query', async () => {
    const h = harness({ docs: () => docsOf(2), check: () => Promise.resolve({ ...READY, stage: 3, extra: 'never read' }) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    expect(h.checks.map((c) => c.id)).toEqual(['done_01', 'done_02']);
    expect(h.checks[0].battle).toBe(h.state().battles[0]);
    expect(h.state().reviews.done_01.result).toEqual({ ready: true, target: 'filmRoom', availability: 'ready' });
  });

  it('an unchanged document goes pending → ready through a scheduled re-check, with no field changed', async () => {
    const answers = [PENDING, READY];
    const h = harness({ docs: () => docsOf(1), check: (b, n) => Promise.resolve(answers[n - 1]) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    expect(h.state().reviews.done_01.state).toBe(REVIEW_STATES.PENDING);
    expect(h.state().nextAttemptAt).toBe(T0 + 120 * S);
    await tick(119.999 * S);
    expect(h.queries).toHaveLength(1);
    await tick(0.001 * S);
    expect(h.queries).toHaveLength(2);
    expect(h.state().reviews.done_01.state).toBe(REVIEW_STATES.READY);
    expect(h.state().generation).toBe(2);
  });

  it('all ready or unavailable with nothing unfinished: no scheduled cycle — unavailable waits for a trigger', async () => {
    const h = harness({ docs: () => docsOf(2), check: (b) => Promise.resolve(b.id === 'done_01' ? READY : UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    expect(h.state().nextAttemptAt).toBeNull();
    await tick(600 * S);
    expect(h.queries).toHaveLength(1);
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    await tick(0);
    expect(h.queries).toHaveLength(2);
    // The ready row is cached: the second cycle asks only the unavailable one.
    expect(h.checks.map((c) => c.id)).toEqual(['done_01', 'done_02', 'done_02']);
  });

  it('a live game ending refreshes the window: the new completion appears and gets its check — within the cap', async () => {
    const h = harness({ docs: (n) => (n === 1 ? docsOf(2) : [doc(9), ...docsOf(2)]), check: () => Promise.resolve(UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(30 * S);
    h.s.trigger(REVIEW_TRIGGERS.LIVE_LEFT);
    await tick(0);
    expect(h.queries).toHaveLength(1);
    expect(h.state().nextAttemptAt).toBe(T0 + 120 * S);
    await tick(90 * S);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S]);
    expect(h.state().battles.map((b) => b.id)).toEqual(['done_09', 'done_01', 'done_02']);
    expect(h.checks.filter((c) => c.id === 'done_09')).toHaveLength(1);
  });

  it('simultaneous triggers run one cycle and leave at most one dirty follow-up', async () => {
    const h = harness({ docs: () => docsOf(1), query: () => after(2 * S, docsOf(1)), check: () => Promise.resolve(UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    h.s.trigger(REVIEW_TRIGGERS.LIVE_LEFT);
    h.s.trigger(REVIEW_TRIGGERS.FOCUS);
    h.s.trigger(REVIEW_TRIGGERS.VISIBLE);
    await tick(10 * S);
    expect(h.queries).toHaveLength(1);
    await tick(600 * S);
    // The one dirty follow-up, at the next permitted time — and nothing else (the row is unavailable).
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S + 2 * S]);
  });

  it('focus and becoming visible refresh only when the last cycle is at least 120 s old', async () => {
    const h = harness({ docs: () => docsOf(1), check: () => Promise.resolve(UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(119 * S);
    h.s.trigger(REVIEW_TRIGGERS.FOCUS);
    await tick(0);
    expect(h.queries).toHaveLength(1);
    expect(h.state().nextAttemptAt).toBeNull();
    await tick(1 * S);
    h.s.trigger(REVIEW_TRIGGERS.FOCUS);
    await tick(0);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S]);
  });

  it('a manual trigger inside the window queues one cycle at the next permitted time, never a burst', async () => {
    const h = harness({ docs: () => docsOf(3), check: () => Promise.resolve(UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(5 * S);
    for (let i = 0; i < 20; i += 1) {
      h.s.trigger(REVIEW_TRIGGERS.MANUAL);
      await tick(1 * S);
    }
    expect(h.queries).toHaveLength(1);
    expect(h.state().nextAttemptAt).toBe(T0 + 120 * S);
    await tick(120 * S);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S]);
  });

  it('a failed query keeps the last good window and generation, runs no helper pass, and retries once at the permitted time', async () => {
    const h = harness({
      query: (n) => (n === 2 ? Promise.reject(new Error('unavailable')) : Promise.resolve(docsOf(2))),
      check: () => Promise.resolve(PENDING),
    });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    const good = h.state().battles;
    await tick(120 * S);
    expect(h.queries).toHaveLength(2);
    expect(h.state()).toMatchObject({ status: 'error', generation: 1, battles: good, lastSuccessfulAt: T0 });
    expect(h.checks).toHaveLength(2);
    expect(h.state().nextAttemptAt).toBe(T0 + 240 * S);
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    await tick(119 * S);
    expect(h.queries).toHaveLength(2);
    await tick(1 * S);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S, 240 * S]);
    expect(h.state()).toMatchObject({ status: 'ready', generation: 2 });
  });

  it('a first query that fails leaves no window — never an empty one — and its Retry waits for the slot', async () => {
    const h = harness({ query: (n) => (n === 1 ? Promise.reject(new Error('failed-precondition')) : Promise.resolve([])) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    expect(h.state()).toMatchObject({ status: 'error', battles: null, generation: 0, nextAttemptAt: T0 + 120 * S });
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    await tick(60 * S);
    expect(h.queries).toHaveLength(1);
    await tick(60 * S);
    expect(h.queries).toHaveLength(2);
    expect(h.state()).toMatchObject({ status: 'ready', battles: [], generation: 1 });
  });

  it('hiding pauses: nothing starts while hidden; coming back runs one cycle, not a catch-up burst', async () => {
    const h = harness({ docs: () => docsOf(1), check: () => Promise.resolve(PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    h.s.setVisible(false);
    await tick(1000 * S);
    expect(h.queries).toHaveLength(1);
    h.s.setVisible(true);
    await tick(0);
    expect(h.queries).toHaveLength(2);
    await tick(119 * S);
    expect(h.queries).toHaveLength(2);
  });

  it('hiding mid-cycle revokes its answers, keeps the spent rate slots and the unfinished rows', async () => {
    const h = harness({ docs: () => docsOf(5), check: () => after(3 * S, READY) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(1 * S);
    expect(h.checks).toHaveLength(3);
    h.s.setVisible(false);
    await tick(10 * S);
    expect(Object.values(h.state().reviews).map((r) => r.state)).toEqual(Array(5).fill(REVIEW_STATES.QUEUED));
    expect(Object.values(h.state().reviews).every((r) => r.result === null)).toBe(true);
    h.s.setVisible(true);
    await tick(0);
    // The hidden cycle's query and helper starts (all at 0 s) still count: the next waits for them to age out.
    expect(h.queries).toHaveLength(1);
    await tick(T0 + 120 * S - Date.now() - 1);
    expect(h.queries).toHaveLength(1);
    await tick(1);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S]);
  });

  it('dispose (unmount, owner change) clears everything: no state from a late answer, no further cycle', async () => {
    let release;
    const h = harness({ docs: () => docsOf(1), query: () => new Promise((r) => { release = r; }) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(1 * S);
    const count = h.states.length;
    h.s.dispose();
    release(docsOf(1));
    await tick(600 * S);
    expect(h.states).toHaveLength(count);
    expect(h.queries).toHaveLength(1);
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    await tick(600 * S);
    expect(h.queries).toHaveLength(1);
  });

  it('keeps only the owner\'s own documents from a window', async () => {
    const h = harness({ docs: () => [doc(1), doc(2, { ownerId: 'uid-B' }), { id: '' }, null] });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    expect(h.state().battles.map((b) => b.id)).toEqual(['done_01']);
    expect(h.state()).toMatchObject({ ownerUid: 'uid-A', ownerEpoch: 3 });
  });
});

describe('Review operation deadlines — 8 s query, 8 s per check, 42 s per cycle', () => {
  it('ten checks each near four seconds after a query near eight: all ten checked inside 42 s, never more than three at once', async () => {
    const h = harness({ query: () => after(7.9 * S, docsOf(10)), check: () => after(3.9 * S, READY) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(42 * S);
    expect(h.checks).toHaveLength(10);
    expect(Object.values(h.state().reviews).every((r) => r.state === REVIEW_STATES.READY)).toBe(true);
    expect(h.maxInflight()).toBe(3);
    expect(h.state().checking).toBe(false);
  });

  it('the maximum normal workload — every operation just inside eight seconds — still checks all ten inside 42 s', async () => {
    const h = harness({ query: () => after(7.99 * S, docsOf(10)), check: () => after(7.99 * S, PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(41.99 * S);
    expect(h.checks).toHaveLength(10);
    expect(Object.values(h.state().reviews).every((r) => r.state === REVIEW_STATES.PENDING)).toBe(true);
    expect(h.state().checking).toBe(false);
  });

  it('an operation\'s eight seconds count its imports and setup: the deadline starts before the operation is called', async () => {
    // A check that spends 4 s importing and 3.9 s reading settles in time; one more second does not.
    const h = harness({ docs: () => docsOf(2), check: (b) => after(b.id === 'done_01' ? 7.9 * S : 8.9 * S, READY) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(20 * S);
    expect(h.state().reviews.done_01.state).toBe(REVIEW_STATES.READY);
    expect(h.state().reviews.done_02.state).toBe(REVIEW_STATES.TIMED_OUT);
  });

  it('a query that never settles times out at eight seconds: the prior generation stays and no check runs', async () => {
    const h = harness({ query: (n) => (n === 1 ? Promise.resolve(docsOf(3)) : never()), check: () => Promise.resolve(PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    await tick(120 * S);
    expect(h.queries).toHaveLength(2);
    expect(h.state().checking).toBe(true);
    await tick(7.999 * S);
    expect(h.state().checking).toBe(true);
    await tick(0.001 * S);
    expect(h.state()).toMatchObject({ checking: false, status: 'error', generation: 1 });
    expect(h.state().battles.map((b) => b.id)).toEqual(['done_01', 'done_02', 'done_03']);
    expect(h.checks).toHaveLength(3);
  });

  it('a check that never settles times out at eight seconds: its slot is released and the remaining rows are checked', async () => {
    const h = harness({ docs: () => docsOf(5), check: (b) => (b.id === 'done_01' ? never() : after(1 * S, READY)) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(3 * S);
    expect(h.checks).toHaveLength(5);
    await tick(5 * S);
    expect(h.state().reviews.done_01.state).toBe(REVIEW_STATES.TIMED_OUT);
    expect(h.state().checking).toBe(false);
  });

  it('a local timeout is never the helper\'s "unavailable": the row is unfinished, with no answer, and its late answer is ignored', async () => {
    const h = harness({ docs: () => docsOf(1), check: () => after(9 * S, UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(8 * S);
    // Its next attempt is the next permitted cycle: 120 s after the query and the check began.
    expect(h.state().reviews.done_01).toMatchObject({ state: REVIEW_STATES.TIMED_OUT, result: null, nextAt: T0 + 120 * S });
    await tick(5 * S);
    expect(h.state().reviews.done_01).toMatchObject({ state: REVIEW_STATES.TIMED_OUT, result: null });
  });

  it('a check that throws, or answers anything but the three fields, is unfinished — never an invented error field', async () => {
    const h = harness({ docs: () => docsOf(2), check: (b) => (b.id === 'done_01' ? Promise.reject(new Error('x')) : Promise.resolve({ availability: 'maybe' })) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    for (const id of ['done_01', 'done_02']) expect(h.state().reviews[id]).toMatchObject({ state: REVIEW_STATES.TIMED_OUT, result: null });
    expect(Object.keys(h.state().reviews.done_01)).toEqual(['state', 'result', 'nextAt']);
  });
});

describe('Review expiry and fairness', () => {
  it('a cycle overdue after a suspension ends at its next callback: resolved results kept, in-flight rows timed out, the unstarted suffix queued', async () => {
    const h = harness({ check: (b) => (b.id === 'done_01' ? Promise.resolve(READY) : after(2 * S, PENDING)) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    // done_01 answered at once; done_02..done_04 are in flight. The page sleeps 45 s without a timer firing.
    vi.setSystemTime(T0 + 45 * S);
    await tick(2 * S);
    const rows = h.state().reviews;
    expect(rows.done_01.state).toBe(REVIEW_STATES.READY);
    expect(['done_02', 'done_03', 'done_04'].map((id) => rows[id].state)).toEqual(Array(3).fill(REVIEW_STATES.TIMED_OUT));
    expect(['done_05', 'done_06', 'done_07', 'done_08', 'done_09', 'done_10'].map((id) => rows[id].state)).toEqual(Array(6).fill(REVIEW_STATES.QUEUED));
    expect(h.checks).toHaveLength(4);
    expect(h.state().checking).toBe(false);
  });

  it('the next permitted cycle serves the unstarted rows first, then the timed-out rows by oldest start; ready rows are never asked again', async () => {
    const h = harness({ check: (b, n) => (n === 1 ? Promise.resolve(READY) : n <= 4 ? after(2 * S, PENDING) : Promise.resolve(PENDING)) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    vi.setSystemTime(T0 + 45 * S);
    await tick(2 * S);
    const nextAt = h.state().nextAttemptAt;
    expect(nextAt).toBe(T0 + 120 * S);
    await tick(nextAt - Date.now());
    const second = h.checks.slice(4).map((c) => c.id);
    expect(second.slice(0, 6).sort()).toEqual(['done_05', 'done_06', 'done_07', 'done_08', 'done_09', 'done_10']);
    // done_02..04 began together (one start time): equal priority, served in rotation.
    expect(second.slice(6).sort()).toEqual(['done_02', 'done_03', 'done_04']);
    expect(second).not.toContain('done_01');
  });

  it('timed-out rows go oldest-started first, and a newly eligible row queues behind the carried work', async () => {
    let window = docsOf(4);
    const slow = new Set(['done_02', 'done_03', 'done_04']);
    const h = harness({
      docs: () => window,
      check: (b) => (slow.has(b.id) ? never() : Promise.resolve(PENDING)),
    });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(20 * S);
    // done_02..04 started at 0 s and timed out together? No — concurrency 3: done_01, 02, 03 at 0 s; 04 when 01 freed.
    expect(h.checks.slice(0, 4).map((c) => [c.id, c.at])).toEqual([['done_01', 0], ['done_02', 0], ['done_03', 0], ['done_04', 0]]);
    slow.clear();
    window = [doc(7), ...docsOf(4)];
    await tick(h.state().nextAttemptAt - Date.now());
    const order = h.checks.slice(4).map((c) => c.id);
    // Carried timed-out rows first (one start time: rotated among them), then the rest in window order.
    expect(order.slice(0, 3).sort()).toEqual(['done_02', 'done_03', 'done_04']);
    expect(order.slice(3)).toEqual(['done_07', 'done_01']);
  });

  it('a carried row reads as being checked while its re-check runs — not "timed out", not "queued"', async () => {
    const h = harness({ docs: () => docsOf(1), check: (b, n) => (n === 1 ? never() : after(5 * S, PENDING)) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(8 * S);
    expect(h.state().reviews.done_01.state).toBe(REVIEW_STATES.TIMED_OUT);
    await tick(T0 + 121 * S - Date.now());
    expect(h.checks).toHaveLength(2);
    expect(h.state().reviews.done_01).toMatchObject({ state: REVIEW_STATES.CHECKING, nextAt: null });
    await tick(5 * S);
    expect(h.state().reviews.done_01.state).toBe(REVIEW_STATES.PENDING);
  });

  it('rows that keep failing are served in rotation: no prefix is checked forever while another starves', async () => {
    const h = harness({ docs: () => docsOf(6), check: () => never() });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    const firstOfCycle = [];
    for (let cycleNo = 0; cycleNo < 4; cycleNo += 1) {
      const before = h.checks.length;
      await tick(40 * S);
      firstOfCycle.push(h.checks[before]?.id);
      // Each cycle: every row starts within it (six rows, three slots, eight seconds each).
      await tick(h.state().nextAttemptAt - Date.now());
    }
    const counts = {};
    for (const c of h.checks) counts[c.id] = (counts[c.id] || 0) + 1;
    expect(Object.keys(counts).sort()).toEqual(docsOf(6).map((d) => d.id));
    expect(Math.max(...Object.values(counts)) - Math.min(...Object.values(counts))).toBeLessThanOrEqual(1);
  });

  it('a new cycle waits for the prior cycle\'s helper starts to age out before its query — its 42 s start only then', async () => {
    const h = harness({ query: () => after(5 * S, docsOf(10)), check: () => after(7 * S, PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(42 * S);
    const lastHelperStart = Math.max(...h.checks.map((c) => c.at));
    expect(lastHelperStart).toBe(26 * S);
    expect(h.state().nextAttemptAt).toBe(T0 + lastHelperStart + 120 * S);
    await tick(T0 + lastHelperStart + 120 * S - Date.now() - 1);
    expect(h.queries).toHaveLength(1);
    await tick(1);
    expect(h.queries.map((q) => q.at)).toEqual([0, lastHelperStart + 120 * S]);
  });

  it('late answers from an expired cycle are ignored, even when nothing newer has finished', async () => {
    let releaseQuery;
    const h = harness({ query: (n) => (n === 1 ? new Promise((r) => { releaseQuery = r; }) : Promise.resolve(docsOf(1))), check: () => Promise.resolve(READY) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(8 * S);
    expect(h.state()).toMatchObject({ status: 'error', battles: null });
    releaseQuery(docsOf(3));
    await tick(1 * S);
    expect(h.state()).toMatchObject({ status: 'error', battles: null, generation: 0 });
    expect(h.checks).toHaveLength(0);
  });

  it('timeouts, dirty follow-ups and manual triggers never burst: three at a time at most, one query and ten checks per 120 s', async () => {
    const h = harness({ check: () => after(9 * S, PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    for (let i = 0; i < 60; i += 1) {
      h.s.trigger(i % 2 ? REVIEW_TRIGGERS.MANUAL : REVIEW_TRIGGERS.LIVE_LEFT);
      await tick(10 * S);
    }
    expect(h.maxLogical()).toBe(REVIEW_BUDGET.concurrency);
    const inWindow = (list, end) => list.filter((at) => at > end - 120 * S && at <= end).length;
    for (const { at } of [...h.queries, ...h.checks]) {
      expect(inWindow(h.queries.map((q) => q.at), at)).toBeLessThanOrEqual(1);
      expect(inWindow(h.checks.map((c) => c.at), at)).toBeLessThanOrEqual(10);
    }
  });
});

describe('timers, hidden triggers, late answers and freshness (review T3-5)', () => {
  it('a trigger while hidden queues; nothing starts until the page is visible — a live game ending included', async () => {
    const h = harness({ docs: () => docsOf(2), check: () => Promise.resolve(UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    h.s.setVisible(false);
    await tick(200 * S);
    h.s.trigger(REVIEW_TRIGGERS.LIVE_LEFT);
    await tick(200 * S);
    expect(h.queries).toHaveLength(1);
    h.s.setVisible(true);
    await tick(1 * S);
    expect(h.queries).toHaveLength(2);
  });

  it('a late query answer of an expired cycle never completes the next cycle\'s query', async () => {
    let releaseFirst;
    const h = harness({ query: (n) => (n === 1 ? new Promise((resolve) => { releaseFirst = resolve; }) : after(5 * S, docsOf(1))) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(8 * S);
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    await tick(114 * S);
    releaseFirst(docsOf(3));
    await tick(0);
    expect(h.state().battles).toBeNull();
    expect(h.state().generation).toBe(0);
    await tick(4 * S);
    expect(h.state().battles.map((b) => b.id)).toEqual(['done_01']);
  });

  it('dispose leaves no timer behind (§6 "Unmount … clears timers")', async () => {
    const h = harness({ query: () => never() });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    h.s.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('hiding clears the running cycle\'s timers (§6 "Hide clears timers")', async () => {
    const h = harness({ query: () => never() });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    h.s.setVisible(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('hiding clears the queued cycle\'s timer', async () => {
    const h = harness({ check: () => Promise.resolve(PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    expect(h.state().nextAttemptAt).not.toBeNull();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    h.s.setVisible(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lastSuccessfulAt advances with every accepted window', async () => {
    const h = harness({ check: () => Promise.resolve(PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    expect(h.state().lastSuccessfulAt).toBe(T0);
    await tick(125 * S);
    expect(h.state().generation).toBe(2);
    expect(h.state().lastSuccessfulAt).toBe(T0 + 120 * S);
  });
});

describe('a backward step of the wall clock (review T3-7, T3R-1)', () => {
  /** The scheduler on `Date.now() + skew`; a step moves `skew`. Fake timers never step. */
  function stepped() {
    let skew = 0;
    const wall = () => Date.now() + skew;
    const queries = [];
    const delays = [];
    const s = createReviewScheduler({
      owner: OWNER,
      clock: { now: wall, setTimer: (fn, ms) => { delays.push(ms); return setTimeout(fn, ms); }, clearTimer: (h) => clearTimeout(h) },
      queryCompleted: () => { queries.push(wall()); return Promise.resolve(docsOf(2)); },
      checkReview: () => Promise.resolve(UNAVAILABLE),
      onChange: () => {},
    });
    return { s, queries, delays, wall, step: (ms) => { skew += ms; } };
  }

  it('after a 30 minute step back the next permitted cycle is at most one window away, and runs then', async () => {
    const r = stepped();
    r.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10 * S);
    r.step(-1800 * S);
    r.s.trigger(REVIEW_TRIGGERS.MANUAL);
    const wait = r.s.getState().nextAttemptAt - r.wall();
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(120 * S);
    await tick(125 * S);
    expect(r.queries).toHaveLength(2);
  });

  it('a focus 125 s after the step is not swallowed by a last cycle that lies in the future', async () => {
    const r = stepped();
    r.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(200 * S);
    r.step(-1800 * S);
    r.s.trigger(REVIEW_TRIGGERS.FOCUS);
    expect(r.queries).toHaveLength(1);
    await tick(125 * S);
    r.s.trigger(REVIEW_TRIGGERS.FOCUS);
    await tick(0);
    expect(r.queries).toHaveLength(2);
  });

  it('no timer is asked for past setTimeout\'s limit — a month-long step back must not turn into a hot loop', async () => {
    const r = stepped();
    r.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10 * S);
    r.step(-30 * 86400 * S);
    r.s.trigger(REVIEW_TRIGGERS.MANUAL);
    await tick(1 * S);
    expect(Math.max(...r.delays)).toBeLessThanOrEqual(2 ** 31 - 1);
  });

  it('with no step: the next permitted cycle is one window after the helper starts', async () => {
    const r = stepped();
    r.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10 * S);
    r.s.trigger(REVIEW_TRIGGERS.MANUAL);
    expect(r.s.getState().nextAttemptAt).toBe(T0 + 120 * S);
    await tick(115 * S);
    expect(r.queries).toHaveLength(2);
  });
});

describe('the rolling ledger can outlive one scheduler (spec §6 "Every trigger shares this budget"; review T0-3)', () => {
  it('a second scheduler handed the first one\'s ledger at +30 s queues its mount cycle until the window ages out', async () => {
    const ledger = { queries: [], helpers: [] };
    const queries = [];
    const onLedger = () => createReviewScheduler({
      owner: OWNER,
      ledger,
      clock: { now: () => Date.now(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (h) => clearTimeout(h) },
      queryCompleted: () => { queries.push(Date.now() - T0); return Promise.resolve(docsOf(10)); },
      checkReview: () => Promise.resolve(READY),
      onChange: () => {},
    });
    const first = onLedger();
    first.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(1 * S);
    expect(queries).toEqual([0]);
    expect(ledger.helpers).toHaveLength(10);
    first.dispose();
    await tick(29 * S);
    const second = onLedger();
    second.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(1 * S);
    expect(queries, 'no query for the second scheduler inside the window').toEqual([0]);
    expect(second.getState().nextAttemptAt).toBe(T0 + 120 * S);
    await tick(89 * S);
    expect(queries).toEqual([0, 120 * S]);
    // A start older than the window is dropped from a ledger that outlives its mounts.
    expect(ledger.queries).toEqual([T0 + 120 * S]);
    second.dispose();
  });
});

describe('the budget evidence (spec §6): any half-open ten minutes', () => {
  it('a visible hub with a review always pending and a trigger every five seconds for an hour: at most 5 queries, 50 documents, 50 checks per ten minutes', async () => {
    const h = harness({ docs: () => docsOf(10), check: () => after(1 * S, PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    for (let i = 0; i < 720; i += 1) {
      h.s.trigger([REVIEW_TRIGGERS.MANUAL, REVIEW_TRIGGERS.FOCUS, REVIEW_TRIGGERS.VISIBLE, REVIEW_TRIGGERS.LIVE_LEFT][i % 4]);
      await tick(5 * S);
    }
    const queryAts = h.queries.map((q) => q.at);
    const checkAts = h.checks.map((c) => c.at);
    const tenMin = 600 * S;
    let worst = { queries: 0, docs: 0, checks: 0 };
    for (const start of [...queryAts, ...checkAts]) {
      const inside = (at) => at >= start && at < start + tenMin;
      const q = queryAts.filter(inside).length;
      worst = {
        queries: Math.max(worst.queries, q),
        docs: Math.max(worst.docs, q * 10),
        checks: Math.max(worst.checks, checkAts.filter(inside).length),
      };
    }
    expect(worst.queries).toBeLessThanOrEqual(5);
    expect(worst.docs).toBeLessThanOrEqual(50);
    expect(worst.checks).toBeLessThanOrEqual(50);
    // ...and the hub did keep refreshing: one cycle every ~121 s for the hour.
    expect(h.queries.length).toBeGreaterThanOrEqual(29);
  });
});

describe('review T3-2 — a hide hands a pending Retry to the re-queued cycle: no stale dirty follow-up (spec §6: "retain at most one dirty follow-up", "without a catch-up burst")', () => {
  // The cycle's query is out for 5 s; the trigger lands at 1 s; the tab hides at 3 s and shows again at 4 s.
  const run = async ({ hide, reason = REVIEW_TRIGGERS.MANUAL, second = null }) => {
    const h = harness({ docs: () => docsOf(2), query: () => after(5 * S, docsOf(2)), check: () => Promise.resolve(UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(1 * S);
    h.s.trigger(reason);
    await tick(2 * S);
    if (hide) {
      h.s.setVisible(false);
      await tick(1 * S);
      h.s.setVisible(true);
    }
    if (second !== null) {
      await tick(second - (Date.now() - T0));
      h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    }
    await tick(3000 * S);
    return h.queries.map((q) => q.at / S);
  };

  it('control: a Retry during a running cycle yields exactly one follow-up, 120 s after the last helper start', async () => {
    expect(await run({ hide: false })).toEqual([0, 125]);
  });

  it.each([REVIEW_TRIGGERS.MANUAL, REVIEW_TRIGGERS.LIVE_LEFT])('a %s trigger, then a hide and a show: the resumed cycle already serves it - no third query', async (reason) => {
    expect(await run({ hide: true, reason })).toEqual([0, 120]);
  });

  it('the flag is cleared at the hide, not disabled: a trigger during the RESUMED cycle still earns its one follow-up', async () => {
    // The resumed cycle starts at 120 s (query out until 125 s); the new Retry lands at 122 s.
    expect(await run({ hide: true, second: 122 * S })).toEqual([0, 120, 245]);
  });
});

describe('review T3-4 — a failed query queues ONE automatic retry per failure episode (spec §6: "queues one retry at permitted time"; "Scheduled work runs only while ... unfinished logical work remains")', () => {
  it('a permanently failing read, visible for an hour: the attempt and its one retry - no steady timer', async () => {
    const h = harness({ query: failing });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    // The retry is queued: its time is real, and is shown.
    expect(h.state()).toMatchObject({ status: 'error', battles: null, generation: 0, nextAttemptAt: T0 + 120 * S });
    await tick(120 * S);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S]);
    // The retry failed too: nothing is queued, so no "next attempt" is promised.
    expect(h.state()).toMatchObject({ status: 'error', battles: null, nextAttemptAt: null, checking: false });
    await tick(3600 * S);
    expect(h.queries).toHaveLength(2);
  });

  it('after the episode\'s retry, an explicit Retry runs once at its permitted time and earns no automatic retry of its own', async () => {
    const h = harness({ query: failing });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(600 * S);
    expect(h.queries).toHaveLength(2);
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    await tick(0);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S, 600 * S]);
    expect(h.state().nextAttemptAt).toBeNull();
    // A Retry inside the window queues one cycle at the slot and shows its time (a queued retry is a real retry).
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    expect(h.state().nextAttemptAt).toBe(T0 + 720 * S);
    await tick(3600 * S);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S, 600 * S, 720 * S]);
    expect(h.state().nextAttemptAt).toBeNull();
  });

  it('a Retry pressed before the slot merges with the queued retry: one query at the slot, and no further automatic retry if it fails', async () => {
    const h = harness({ query: failing });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(30 * S);
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    expect(h.state().nextAttemptAt).toBe(T0 + 120 * S);
    await tick(3600 * S);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S]);
  });

  it('a success ends the episode: a later failure owes its own one retry', async () => {
    // Failed at 0 s, answered at its retry (120 s), then a Retry at 400 s fails and so does its retry.
    const h = harness({ docs: () => docsOf(1), query: (n) => (n === 2 ? Promise.resolve(docsOf(1)) : failing()), check: () => Promise.resolve(UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(300 * S);
    expect(h.state()).toMatchObject({ status: 'ready', generation: 1, nextAttemptAt: null });
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S]);
    await tick(100 * S);
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    await tick(0);
    expect(h.state()).toMatchObject({ status: 'error', generation: 1, nextAttemptAt: T0 + 520 * S });
    await tick(3600 * S);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S, 400 * S, 520 * S]);
    expect(h.state()).toMatchObject({ status: 'error', nextAttemptAt: null });
  });

  it('a tab hidden during the first query: the re-queued cycle is the attempt, its failure earns the one retry, its failure ends the run', async () => {
    const h = harness({ query: (n) => (n === 1 ? never() : failing()) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(1 * S);
    h.s.setVisible(false);
    await tick(1 * S);
    h.s.setVisible(true);
    await tick(3600 * S);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S, 240 * S]);
    expect(h.state().nextAttemptAt).toBeNull();
  });

  it('a tab hidden during the RETRY\'s own query: the re-queued cycle is that retry resumed - its failure ends the run, it earns no further retry', async () => {
    const h = harness({ query: (n) => (n === 2 ? never() : failing()) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);                      // attempt 1 fails at once; its one retry is queued for 120 s
    await tick(121 * S);                // the retry's query is out and never answers
    h.s.setVisible(false);
    await tick(1 * S);
    h.s.setVisible(true);
    await tick(3600 * S);
    expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S, 240 * S]);
    expect(h.state()).toMatchObject({ status: 'error', nextAttemptAt: null });
  });

  describe('the hub is never stranded: once the retry has failed, a listed trigger still runs one cycle', () => {
    // Attempts 1 and 2 fail (the second is the episode's one retry); from the third on the read answers.
    const spent = async () => {
      const h = harness({ docs: () => docsOf(1), query: (n) => (n >= 3 ? Promise.resolve(docsOf(1)) : failing()), check: () => Promise.resolve(UNAVAILABLE) });
      h.s.trigger(REVIEW_TRIGGERS.MOUNT);
      await tick(300 * S);
      expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S]);
      expect(h.state()).toMatchObject({ status: 'error', nextAttemptAt: null });
      return h;
    };

    it('window focus, 120 s+ after the last attempt', async () => {
      const h = await spent();
      h.s.trigger(REVIEW_TRIGGERS.FOCUS);
      await tick(0);
      expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S, 300 * S]);
      expect(h.state()).toMatchObject({ status: 'ready', generation: 1, nextAttemptAt: null });
    });

    it('coming back to the tab, 120 s+ after the last attempt', async () => {
      const h = await spent();
      h.s.setVisible(false);
      await tick(60 * S);
      h.s.setVisible(true);
      await tick(0);
      expect(h.queries.map((q) => q.at)).toEqual([0, 120 * S, 360 * S]);
      expect(h.state()).toMatchObject({ status: 'ready', generation: 1 });
    });
  });

  it('control: a pending review keeps its own scheduled cycles through failing queries (spec §6: scheduled refresh while a review is pending)', async () => {
    const h = harness({ docs: () => docsOf(1), query: (n) => (n === 1 ? Promise.resolve(docsOf(1)) : failing()), check: () => Promise.resolve(PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(3600 * S);
    // One query every 120 s for the hour: the pending row, not the failure, is what keeps the schedule.
    expect(h.queries).toHaveLength(31);
    expect(h.queries.every((q, i) => q.at === i * 120 * S)).toBe(true);
    expect(h.state().reviews.done_01.state).toBe(REVIEW_STATES.PENDING);
  });
});

describe('review T3-6 — an operation\'s own eight seconds are re-checked when its answer arrives (spec §6: "Late results from expired invocation ... are ignored"; "the next callback checks elapsed time")', () => {
  // vi's setSystemTime moves the clock and keeps every pending timer's remaining time: the page slept, no callback ran.
  it('a helper answer that lands after its eight seconds, before its timer has run, is a timeout - never the helper\'s "unavailable"', async () => {
    const h = harness({ docs: () => docsOf(1), check: () => after(2 * S, UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    vi.setSystemTime(Date.now() + 10 * S);
    await tick(2 * S);
    expect(h.state().reviews.done_01).toMatchObject({ state: REVIEW_STATES.TIMED_OUT, result: null });
    expect(h.state().checking).toBe(false);
  });

  it('...and the row is retried: unfinished work, queued at the next permitted time', async () => {
    const answers = [UNAVAILABLE, READY];
    const h = harness({ docs: () => docsOf(1), check: (b, n) => (n === 1 ? after(2 * S, answers[0]) : Promise.resolve(answers[1])) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    vi.setSystemTime(Date.now() + 10 * S);
    await tick(2 * S);
    const slot = h.state().nextAttemptAt;
    expect(slot).toBe(T0 + 120 * S);
    await tick(slot - Date.now());
    expect(h.state().reviews.done_01).toMatchObject({ state: REVIEW_STATES.READY });
  });

  it('a completed-query answer that lands after its eight seconds, before its timer has run, keeps the prior window and generation', async () => {
    const h = harness({ query: (n) => (n === 1 ? Promise.resolve(docsOf(2)) : after(2 * S, docsOf(5))), check: () => Promise.resolve(PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    const good = h.state().battles;
    await tick(120 * S);
    expect(h.queries).toHaveLength(2);
    vi.setSystemTime(Date.now() + 10 * S);
    await tick(2 * S);
    expect(h.state()).toMatchObject({ status: 'error', generation: 1, battles: good, checking: false });
    expect(h.checks).toHaveLength(2);
  });

  it('an answer landing at exactly its eighth second is a timeout, as its timer would have made it (the boundary)', async () => {
    // The check answers 2 s after it starts; the page slept 6 s first: the answer's callback runs at exactly start + 8 s.
    const h = harness({ docs: () => docsOf(1), check: () => after(2 * S, UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    vi.setSystemTime(Date.now() + 6 * S);
    await tick(2 * S);
    expect(h.state().reviews.done_01).toMatchObject({ state: REVIEW_STATES.TIMED_OUT, result: null });
  });

  it('...and a completed-query answer at exactly its eighth second likewise', async () => {
    const h = harness({ query: (n) => (n === 1 ? Promise.resolve(docsOf(2)) : after(2 * S, docsOf(5))), check: () => Promise.resolve(PENDING) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    await tick(120 * S);
    vi.setSystemTime(Date.now() + 6 * S);
    await tick(2 * S);
    expect(h.state()).toMatchObject({ status: 'error', generation: 1 });
  });

  it('control: an answer just inside its eight seconds is still the answer (the rows at 7.9 s and 7.99 s are unchanged)', async () => {
    const h = harness({ docs: () => docsOf(1), query: () => after(7.99 * S, docsOf(1)), check: () => after(7.99 * S, READY) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(16 * S);
    expect(h.state()).toMatchObject({ status: 'ready', generation: 1 });
    expect(h.state().reviews.done_01.state).toBe(REVIEW_STATES.READY);
  });
});

describe('review T3-9 — a window that repeats an id keeps its first copy (one row, one check, one helper start)', () => {
  it('[doc 1, doc 1 again, doc 2] is two rows and two checks', async () => {
    const dup = [doc(1), doc(1, { note: 'second copy' }), doc(2)];
    const h = harness({ docs: () => dup, check: () => after(1 * S, UNAVAILABLE) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(30 * S);
    expect(h.checks.map((c) => c.id)).toEqual(['done_01', 'done_02']);
    expect(h.state().battles).toHaveLength(2);
    expect(h.state().battles[0]).toBe(dup[0]);
    expect(Object.keys(h.state().reviews)).toEqual(['done_01', 'done_02']);
    expect(h.state().inFlight).toBe(0);
  });

  it('a duplicate that is the owner\'s second copy of a foreign-first id is still kept once', async () => {
    const dup = [doc(1, { ownerId: 'uid-B' }), doc(1), doc(1, { note: 'again' })];
    const h = harness({ docs: () => dup, check: () => Promise.resolve(READY) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(0);
    expect(h.state().battles).toEqual([dup[1]]);
    expect(h.checks).toHaveLength(1);
  });
});
