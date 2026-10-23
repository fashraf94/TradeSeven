// src/components/CommandCenter/hub/reviewScheduler.amendmentB.test.js
//
// Command Center hub, slice S4 (Amendment B; founder rulings Q-S3-9, Q-S3-10 as R-S4-6, R-S4-7; spec V1.2 §6) — the scheduler's
// two additions, under a fake clock:
//   - a FIRST read that succeeds after dispose() is handed to `onLate` once, inside the query's own deadlines, owner-filtered;
//   - a kept window's READY review answers seed the scheduler's ready cache, so those rows open at once and are not asked again;
//     pending, unavailable, timed-out and queued answers are not kept.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVIEW_BUDGET, REVIEW_STATES, REVIEW_TRIGGERS, carriedState, carriedWindow, createReviewScheduler } from './reviewScheduler';

const OWNER = Object.freeze({ uid: 'uid-A', authEpoch: 3 });
const T0 = Date.UTC(2026, 9, 23, 15, 0, 0);
const S = 1000;
const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
const PENDING = Object.freeze({ ready: false, target: 'filmRoom', availability: 'pending' });
const UNAVAILABLE = Object.freeze({ ready: false, target: 'filmRoom', availability: 'unavailable' });

const doc = (i, over = {}) => ({ id: `done_${String(i).padStart(2, '0')}`, ownerId: OWNER.uid, status: 'completed', ...over });
const docsOf = (n) => Array.from({ length: n }, (_, i) => doc(i + 1));
const tick = (ms) => vi.advanceTimersByTimeAsync(ms);

/** A scheduler on the fake clock whose query the test answers by hand. */
function harness({ retained = null, check = () => Promise.resolve(READY), withLate = true } = {}) {
  const late = [];
  const changes = [];
  const checks = [];
  let resolveQuery;
  let rejectQuery;
  const queries = [];
  const scheduler = createReviewScheduler({
    owner: OWNER,
    clock: { now: () => Date.now(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (h) => clearTimeout(h) },
    retained,
    queryCompleted: () => {
      queries.push(Date.now() - T0);
      return new Promise((resolve, reject) => { resolveQuery = resolve; rejectQuery = reject; });
    },
    checkReview: (battle) => { checks.push(battle.id); return check(battle); },
    onChange: (st) => changes.push(st),
    ...(withLate ? { onLate: (window) => late.push(window) } : {}),
  });
  return { s: scheduler, late, changes, checks, queries, answer: (docs) => resolveQuery(docs), fail: (err) => rejectQuery(err), state: () => scheduler.getState() };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a first read that lands after dispose() is kept once (Q-S3-9)', () => {
  it('handed to onLate with the owner\'s documents, generation 1 and the time it landed — and nothing else is published', async () => {
    const h = harness();
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(300);
    expect(h.queries).toEqual([0]);
    const publishedBefore = h.changes.length;
    h.s.dispose();
    h.answer([...docsOf(3), doc(9, { ownerId: 'uid-B' })]);
    await tick(0);
    expect(h.late).toHaveLength(1);
    expect(h.late[0]).toMatchObject({ generation: 1, lastSuccessfulAt: T0 + 300 });
    expect(h.late[0].battles.map((b) => b.id)).toEqual(['done_01', 'done_02', 'done_03']);
    expect(h.changes.length, 'a disposed scheduler publishes nothing').toBe(publishedBefore);
    expect(h.checks, 'and starts no review check').toEqual([]);
  });

  it('inside the query\'s own 8 s: the last moment is kept, the first moment past it is not', async () => {
    const inside = harness();
    inside.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10);
    inside.s.dispose();
    await tick(REVIEW_BUDGET.queryDeadlineMs - 10 - 1);
    inside.answer(docsOf(1));
    await tick(0);
    expect(inside.late).toHaveLength(1);

    const past = harness();
    past.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10);
    past.s.dispose();
    await tick(REVIEW_BUDGET.queryDeadlineMs - 10);
    past.answer(docsOf(1));
    await tick(0);
    expect(past.late, 'at 8 s the mounted scheduler would have called it a timeout').toEqual([]);
  });

  it('only a list is kept: anything else the read answers is a failure', async () => {
    for (const answer of [null, undefined, {}, 'docs', 7]) {
      const h = harness();
      h.s.trigger(REVIEW_TRIGGERS.MOUNT);
      await tick(10);
      h.s.dispose();
      h.answer(answer);
      await tick(0);
      expect(h.late, String(answer)).toEqual([]);
    }
  });

  it('a read that fails after dispose keeps nothing', async () => {
    const h = harness();
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10);
    h.s.dispose();
    h.fail(new Error('failed-precondition'));
    await tick(0);
    expect(h.late).toEqual([]);
  });

  it('a read that already landed before dispose() is the mounted scheduler\'s own: nothing is handed over', async () => {
    const h = harness();
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10);
    h.answer(docsOf(2));
    await tick(0);
    h.s.dispose();
    await tick(60 * S);
    expect(h.late).toEqual([]);
  });

  it('it is the owner\'s FIRST read only: a scheduler that held a window (a kept one included) hands over no later read', async () => {
    const h = harness({ retained: { battles: docsOf(2), generation: 4, lastSuccessfulAt: T0 - 30 * S } });
    h.s.trigger(REVIEW_TRIGGERS.MANUAL);
    await tick(REVIEW_BUDGET.windowMs);
    expect(h.queries.length).toBeGreaterThan(0);
    h.s.dispose();
    h.answer(docsOf(3));
    await tick(0);
    expect(h.late).toEqual([]);
  });

  it('it is delivered once, however many times the read is answered', async () => {
    const h = harness();
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10);
    h.s.dispose();
    h.answer(docsOf(1));
    h.answer(docsOf(5));
    await tick(0);
    expect(h.late).toHaveLength(1);
    expect(h.late[0].battles).toHaveLength(1);
  });

  it('a scheduler given no onLate loses it quietly, as before', async () => {
    const h = harness({ withLate: false });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10);
    h.s.dispose();
    h.answer(docsOf(1));
    await expect(tick(0)).resolves.not.toThrow();
    expect(h.late).toEqual([]);
  });

  it('it spends no slot of its own: the ledger holds the one query', async () => {
    const h = harness();
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10);
    h.s.dispose();
    h.answer(docsOf(1));
    await tick(0);
    expect(h.s.ledger()).toEqual({ queries: [T0], helpers: [] });
  });
});

describe('a kept window\'s ready review answers (Q-S3-10)', () => {
  const kept = (ready) => ({ battles: docsOf(4), generation: 2, lastSuccessfulAt: T0 - 30 * S, ...(ready ? { ready } : {}) });

  it('carriedWindow keeps the helper\'s own ready answers for rows of this window, and nothing else', () => {
    const window = carriedWindow(OWNER, kept({
      done_01: READY,
      done_02: PENDING,
      done_03: { ready: true, availability: 'ready' },
      done_04: { ready: false, target: 'filmRoom', availability: 'ready' },
      done_99: READY,
    }));
    expect(Object.keys(window.ready)).toEqual(['done_01']);
    expect(window.ready.done_01).toEqual(READY);
    expect(Object.isFrozen(window.ready)).toBe(true);
  });

  it('pending, unavailable, timed-out and queued answers are not kept', () => {
    const window = carriedWindow(OWNER, kept({ done_01: PENDING, done_02: UNAVAILABLE, done_03: { state: 'timedOut', result: null }, done_04: null }));
    expect(window.ready).toBeUndefined();
  });

  it('with no ready answers the window has no `ready` key, so its shape is Amendment A\'s', () => {
    expect(Object.keys(carriedWindow(OWNER, kept(null))).sort()).toEqual(['battles', 'generation', 'lastSuccessfulAt']);
    expect(Object.keys(carriedWindow(OWNER, kept({}))).sort()).toEqual(['battles', 'generation', 'lastSuccessfulAt']);
    for (const odd of ['ready', 7, [], true]) expect(carriedWindow(OWNER, kept(odd)).ready, String(odd)).toBeUndefined();
  });

  it('a prototype key in the id space is not an answer', () => {
    const window = carriedWindow(OWNER, { battles: [doc(1, { id: 'constructor' })], generation: 1, lastSuccessfulAt: T0, ready: {} });
    expect(window.ready).toBeUndefined();
  });

  it('carriedState: a kept ready row is READY with its answer, every other row queued', () => {
    const state = carriedState(OWNER, kept({ done_02: READY }));
    expect(state.reviews.done_02).toEqual({ state: REVIEW_STATES.READY, result: READY, nextAt: null });
    for (const id of ['done_01', 'done_03', 'done_04']) expect(state.reviews[id], id).toEqual({ state: REVIEW_STATES.QUEUED, result: null, nextAt: null });
  });

  it('a scheduler started from it shows the ready row at once and asks only for the rest at the slot', async () => {
    const h = harness({ retained: kept({ done_01: READY, done_03: READY }), check: () => Promise.resolve(UNAVAILABLE) });
    expect(h.state().reviews.done_01).toMatchObject({ state: 'ready', result: READY });
    expect(h.state().reviews.done_02).toMatchObject({ state: 'queued' });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10);
    h.answer(docsOf(4));
    await tick(0);
    expect(h.checks.sort(), 'the two rows that were not ready; the two that were are not asked again').toEqual(['done_02', 'done_04']);
    expect(h.state().reviews.done_01).toMatchObject({ state: 'ready', result: READY });
    expect(h.state().reviews.done_03).toMatchObject({ state: 'ready', result: READY });
    expect(h.state().reviews.done_02).toMatchObject({ state: 'unavailable' });
  });

  it('a row that leaves the refreshed window takes its kept answer with it; one that stays keeps it', async () => {
    const h = harness({ retained: kept({ done_01: READY, done_04: READY }) });
    h.s.trigger(REVIEW_TRIGGERS.MOUNT);
    await tick(10);
    h.answer([doc(1), doc(2), doc(3), doc(5)]);
    await tick(0);
    expect(h.state().reviews.done_01.state).toBe('ready');
    expect(h.state().reviews.done_04).toBeUndefined();
    expect(h.checks).not.toContain('done_01');
  });

  it('a kept answer for a row of another owner\'s document is not seeded', () => {
    const foreign = { battles: [doc(1, { ownerId: 'uid-B' }), doc(2)], generation: 1, lastSuccessfulAt: T0, ready: { done_01: READY, done_02: READY } };
    const window = carriedWindow(OWNER, foreign);
    expect(window.battles.map((b) => b.id)).toEqual(['done_02']);
    expect(Object.keys(window.ready)).toEqual(['done_02']);
  });

  it('a ready-only window has no review work: no cycle is owed for it', async () => {
    const h = harness({ retained: { battles: docsOf(2), generation: 1, lastSuccessfulAt: T0 - 30 * S, ready: { done_01: READY, done_02: READY } } });
    await tick(10 * 60 * S);
    expect(h.queries, 'nothing is read without a trigger').toEqual([]);
    expect(h.checks).toEqual([]);
  });
});
