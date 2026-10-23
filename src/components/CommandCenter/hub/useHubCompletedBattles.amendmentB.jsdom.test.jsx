// @vitest-environment jsdom
//
// Command Center hub, slice S4 (Amendment B; R-S4-6, R-S4-7) — the hook's side of the two rulings, with the real scheduler and the
// real record per owner and epoch:
//   - a first read that succeeds after the hub unmounted is kept for THAT owner and epoch and never another's, and a quick
//     return shows it "as of" its read;
//   - the kept window brings back its rows' READY review answers at once; pending, unavailable and the rest are asked again;
//   - an owner or epoch change, and a sign-out, clear all of it.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const id = vi.hoisted(() => ({ current: { resolved: true, uid: 'uid-A', authEpoch: 1 } }));
vi.mock('../../../services/authIdentity', () => ({ useAuthIdentity: () => id.current }));
vi.mock('../../../services/completedAgentBattles', () => ({ fetchRecentCompletedAgentBattles: vi.fn(async () => []) }));
vi.mock('../../../utils/reviewAvailability', () => ({ getReviewAvailability: vi.fn(async () => ({ ready: true, target: 'filmRoom', availability: 'ready' })) }));

import { completedInputOf } from './selectors/readerInputs';
import useHubCompletedBattles, { resetHubLedgersForTests } from './useHubCompletedBattles';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const T0 = Date.UTC(2026, 9, 23, 15, 0, 0);
const S = 1000;
const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
const PENDING = Object.freeze({ ready: false, target: 'filmRoom', availability: 'pending' });
const UNAVAILABLE = Object.freeze({ ready: false, target: 'filmRoom', availability: 'unavailable' });

let host;
let root;
let seen;
let calls;

function Probe({ seams }) {
  seen.push(useHubCompletedBattles(10, seams));
  return null;
}
const render = (seams) => act(() => { root.render(<Probe seams={seams} />); });
const last = () => seen[seen.length - 1];
const docsFor = (uid, n = 4) => Array.from({ length: n }, (_, i) => ({ id: `${uid}_done_${i + 1}`, ownerId: uid, status: 'completed' }));
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const states = () => Object.fromEntries(Object.entries(last().reviews).map(([key, review]) => [key, review.state]));
const remount = () => {
  act(() => root.unmount());
  root = createRoot(host);
  seen = [];
};

/** Seams whose first read waits until the test answers it; later reads answer at once. */
function bounceSeams() {
  const box = { release: null };
  return {
    box,
    queryCompleted: (uid) => {
      calls.queries.push({ uid, at: Date.now() - T0 });
      if (calls.queries.length === 1) return new Promise((resolve) => { box.release = resolve; });
      return Promise.resolve(docsFor(uid));
    },
    checkReview: () => { calls.checks += 1; return Promise.resolve(READY); },
  };
}
function plainSeams(check = () => READY) {
  return {
    queryCompleted: (uid) => { calls.queries.push({ uid, at: Date.now() - T0 }); return Promise.resolve(docsFor(uid)); },
    checkReview: (battle) => { calls.checks += 1; return Promise.resolve(check(battle)); },
  };
}

beforeEach(() => {
  resetHubLedgersForTests();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  id.current = { resolved: true, uid: 'uid-A', authEpoch: 1 };
  seen = [];
  calls = { queries: [], checks: 0 };
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('a first read that lands after the hub unmounted is kept for its owner and epoch (Q-S3-9)', () => {
  it('the same owner and epoch: the return shows it "as of" its read, owner-filtered, and the slot is still spent', async () => {
    const s = bounceSeams();
    render(s);
    await advance(300);
    remount();
    await act(async () => { s.box.release([...docsFor('uid-A', 3), ...docsFor('uid-B', 1)]); await vi.advanceTimersByTimeAsync(0); });
    await advance(4000);
    render(s);
    // The very first frame of the return: the late window, carried, never a loading frame.
    expect(seen[0]).toMatchObject({ status: 'ready', carried: true, generation: 1, lastSuccessfulAt: T0 + 300, ownerUid: 'uid-A', ownerEpoch: 1 });
    expect(seen[0].battles.map((b) => b.id)).toEqual(['uid-A_done_1', 'uid-A_done_2', 'uid-A_done_3']);
    await advance(1 * S);
    expect(calls.queries.map((q) => q.at), 'no second query inside the window').toEqual([0]);
    expect(last().nextAttemptAt).toBe(T0 + 120 * S);
    // At the slot the read ends the carry and the generation goes on from the kept one.
    await advance(116 * S);
    expect(calls.queries.map((q) => q.at)).toEqual([0, 120 * S]);
    expect(last()).toMatchObject({ carried: false, generation: 2 });
  });

  it('past the query\'s 8 s it is a failure, kept or not: the return shows no rows', async () => {
    const s = bounceSeams();
    render(s);
    await advance(300);
    remount();
    await advance(9 * S);
    await act(async () => { s.box.release(docsFor('uid-A', 3)); await vi.advanceTimersByTimeAsync(0); });
    render(s);
    expect(seen[0]).toMatchObject({ status: 'loading', battles: null });
  });

  it('another EPOCH of the same uid never sees it: the new epoch has its own record, and the late answer finds none', async () => {
    const s = bounceSeams();
    render(s);
    await advance(300);
    remount();
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 2 };
    render(plainSeams());
    await advance(1 * S);
    expect(last()).toMatchObject({ ownerEpoch: 2, generation: 1, carried: false });
    await act(async () => { s.box.release(docsFor('uid-A', 9)); await vi.advanceTimersByTimeAsync(0); });
    remount();
    render(plainSeams());
    // The new epoch's remount shows ITS window (4 documents), not the late one's (9).
    expect(seen[0].battles).toHaveLength(4);
    expect(seen[0]).toMatchObject({ carried: true, ownerEpoch: 2 });
  });

  it('another OWNER never sees it, and its own record is untouched', async () => {
    const s = bounceSeams();
    render(s);
    await advance(300);
    remount();
    id.current = { resolved: true, uid: 'uid-B', authEpoch: 2 };
    render(plainSeams());
    await advance(1 * S);
    expect(last().battles.every((b) => b.ownerId === 'uid-B')).toBe(true);
    await act(async () => { s.box.release(docsFor('uid-A', 9)); await vi.advanceTimersByTimeAsync(0); });
    remount();
    render(plainSeams());
    expect(seen[0].battles.map((b) => b.ownerId)).toEqual(Array(4).fill('uid-B'));
    // ...and nor does a later return of A, at the epoch A would have: the key was cleared when B's record began.
    remount();
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 1 };
    render(plainSeams());
    expect(seen[0]).toMatchObject({ status: 'loading', battles: null });
  });

  it('a sign-out while the hub is mounted drops the owner\'s record, so a late answer finds none', async () => {
    const s = bounceSeams();
    render(s);
    await advance(300);
    remount();
    id.current = { resolved: true, uid: null, authEpoch: 2 };
    render(plainSeams());
    await advance(1 * S);
    await act(async () => { s.box.release(docsFor('uid-A', 3)); await vi.advanceTimersByTimeAsync(0); });
    remount();
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 1 };
    render(plainSeams());
    expect(seen[0]).toMatchObject({ status: 'loading', battles: null });
  });

  it('a return BEFORE the late answer lands: the wait gives way to the window at the next render, and the hub\'s own read supersedes it', async () => {
    const s = bounceSeams();
    render(s);
    await advance(300);
    remount();
    render(s);
    await advance(1 * S);
    expect(last()).toMatchObject({ status: 'loading', battles: null });
    await act(async () => { s.box.release(docsFor('uid-A', 3)); await vi.advanceTimersByTimeAsync(0); });
    render(s);
    expect(last()).toMatchObject({ status: 'ready', carried: true, generation: 1 });
    expect(last().battles).toHaveLength(3);
    await advance(125 * S);
    expect(last()).toMatchObject({ carried: false, generation: 1 });
    expect(last().battles).toHaveLength(4);
  });

  // Reviewer K-1: the kept window on screen in place of the wait must not hide what the mounted scheduler goes on to publish.
  describe('a window shown in place of the wait still tells the truth about the scheduler\'s own read (Amendment A, K-1)', () => {
    /** Reads answered by hand: [0] is the bounced first read, then each later read waits for the test. */
    function manual() {
      const pending = [];
      return {
        pending,
        queryCompleted: (uid) => {
          calls.queries.push({ uid, at: Date.now() - T0 });
          return new Promise((resolve, reject) => { pending.push({ resolve, reject }); });
        },
        checkReview: () => Promise.resolve(READY),
      };
    }
    const landLate = async (s, n = 3) => {
      await act(async () => { s.pending[0].resolve(docsFor('uid-A', n)); await vi.advanceTimersByTimeAsync(0); });
      render(s);
    };

    it('queued: the next attempt it owes shows beside the window, in place of nothing', async () => {
      const s = manual();
      render(s);
      await advance(300);
      remount();
      render(s);
      await advance(1 * S);
      await landLate(s);
      expect(last()).toMatchObject({ status: 'ready', carried: true, error: null });
      expect(last().nextAttemptAt, 'the scheduler\'s own queued time, not a carried state\'s null').toBe(T0 + 120 * S);
    });

    it('in flight: while the slot\'s read is out the window is refreshing, not idle', async () => {
      const s = manual();
      render(s);
      await advance(300);
      remount();
      render(s);
      await advance(1 * S);
      await landLate(s);
      await advance(120 * S);
      expect(calls.queries.map((q) => q.at)).toEqual([0, 120 * S]);
      expect(last()).toMatchObject({ status: 'ready', carried: true, checking: true, refreshing: true, nextAttemptAt: null });
    });

    it('failed: the read that fails is the stale note and Retry — never a clean carried window — and it is no ready, empty read for the first deployment; the owed retry and its failure follow', async () => {
      const s = manual();
      render(s);
      await advance(300);
      remount();
      render(s);
      await advance(1 * S);
      await landLate(s, 0);
      expect(last().battles).toEqual([]);
      expect(completedInputOf(last())).toMatchObject({ status: 'ready', rows: [] });
      await advance(120 * S);
      await act(async () => { s.pending[1].reject(new Error('failed-precondition')); await vi.advanceTimersByTimeAsync(0); });
      expect(last()).toMatchObject({ status: 'error', carried: true, checking: false, refreshing: false });
      expect(last().error).not.toBeNull();
      expect(last().battles, 'the window it holds stays').toEqual([]);
      expect(completedInputOf(last()).status, 'a failed read is never an empty history').toBe('error');
      expect(last().nextAttemptAt, 'the one owed retry, queued at its permitted time').toBe(T0 + 240 * S);
      await advance(120 * S);
      expect(calls.queries.map((q) => q.at)).toEqual([0, 120 * S, 240 * S]);
      await act(async () => { s.pending[2].reject(new Error('failed-precondition')); await vi.advanceTimersByTimeAsync(0); });
      expect(last()).toMatchObject({ status: 'error', nextAttemptAt: null });
    });

    it('and when the scheduler\'s own read succeeds it takes over: its window, no longer carried', async () => {
      const s = manual();
      render(s);
      await advance(300);
      remount();
      render(s);
      await advance(1 * S);
      await landLate(s);
      await advance(120 * S);
      await act(async () => { s.pending[1].resolve(docsFor('uid-A', 4)); await vi.advanceTimersByTimeAsync(0); });
      expect(last()).toMatchObject({ status: 'ready', carried: false, generation: 1, error: null, checking: false });
      expect(last().battles).toHaveLength(4);
    });
  });

  // Reviewer K-3: "first" is the owner's, not the scheduler's: a hub that was SHOWING a window keeps no later read.
  it('a hub that was showing a window when it unmounted keeps no later read, even if its own scheduler had none: the shown window stays', async () => {
    const pending = [];
    const s = {
      queryCompleted: (uid) => { calls.queries.push({ uid, at: Date.now() - T0 }); return new Promise((resolve) => { pending.push(resolve); }); },
      checkReview: () => Promise.resolve(READY),
    };
    render(s);
    await advance(300);
    remount();
    render(s);
    await advance(1 * S);
    await act(async () => { pending[0](docsFor('uid-A', 3)); await vi.advanceTimersByTimeAsync(0); });
    render(s);
    expect(last().battles).toHaveLength(3);
    await advance(120 * S);
    expect(calls.queries).toHaveLength(2);
    remount();
    await act(async () => { pending[1](docsFor('uid-A', 7)); await vi.advanceTimersByTimeAsync(0); });
    render(s);
    expect(seen[0]).toMatchObject({ carried: true, generation: 1 });
    expect(seen[0].battles, 'the window the hub showed, not the later read').toHaveLength(3);
  });

  it('a first read that FAILED after the unmount keeps nothing', async () => {
    let fail;
    const s = {
      queryCompleted: () => new Promise((_, reject) => { fail = reject; }),
      checkReview: () => Promise.resolve(READY),
    };
    render(s);
    await advance(300);
    remount();
    await act(async () => { fail(new Error('failed-precondition')); await vi.advanceTimersByTimeAsync(0); });
    render(plainSeams());
    expect(seen[0]).toMatchObject({ status: 'loading', battles: null });
  });
});

describe('the kept window brings back its rows\' ready review answers (Q-S3-10)', () => {
  const mixed = (battle) => (/_(1|3)$/.test(battle.id) ? READY : /_2$/.test(battle.id) ? PENDING : UNAVAILABLE);

  it('ready rows are ready on the first frame of the return, with the helper\'s answer; every other row is queued', async () => {
    const s = plainSeams(mixed);
    render(s);
    await advance(1 * S);
    expect(states()).toEqual({ 'uid-A_done_1': 'ready', 'uid-A_done_2': 'pending', 'uid-A_done_3': 'ready', 'uid-A_done_4': 'unavailable' });
    const checksBefore = calls.checks;
    remount();
    render(s);
    expect(Object.fromEntries(Object.entries(seen[0].reviews).map(([key, review]) => [key, review.state])))
      .toEqual({ 'uid-A_done_1': 'ready', 'uid-A_done_2': 'queued', 'uid-A_done_3': 'ready', 'uid-A_done_4': 'queued' });
    expect(seen[0].reviews['uid-A_done_1'].result).toEqual(READY);
    expect(calls.checks, 'a return asks nothing').toBe(checksBefore);
  });

  it('at the slot only the rows that were not ready are asked again', async () => {
    const s = plainSeams(mixed);
    render(s);
    await advance(1 * S);
    const checksBefore = calls.checks;
    remount();
    render(s);
    await advance(125 * S);
    expect(calls.checks - checksBefore, 'two rows, not four').toBe(2);
    expect(states()['uid-A_done_1']).toBe('ready');
    expect(states()['uid-A_done_3']).toBe('ready');
  });

  it('a review that turns ready later in the same mount is kept too', async () => {
    let round = 0;
    const s = {
      queryCompleted: (uid) => { calls.queries.push({ uid, at: Date.now() - T0 }); return Promise.resolve(docsFor(uid, 2)); },
      checkReview: () => { round += 1; return Promise.resolve(round <= 2 ? PENDING : READY); },
    };
    render(s);
    await advance(1 * S);
    expect(Object.values(states())).toEqual(['pending', 'pending']);
    await advance(125 * S);
    expect(Object.values(states())).toEqual(['ready', 'ready']);
    remount();
    render(s);
    expect(Object.values(states())).toEqual(['ready', 'ready']);
  });

  it('a kept answer stays across a later read for as long as its row is in the window', async () => {
    let reads = 0;
    const s = {
      queryCompleted: (uid) => { reads += 1; return Promise.resolve(reads === 1 ? docsFor(uid, 3) : docsFor(uid, 3).slice(1)); },
      checkReview: () => Promise.resolve(READY),
    };
    render(s);
    await advance(1 * S);
    remount();
    render(s);
    await advance(125 * S);
    expect(Object.keys(last().reviews)).toEqual(['uid-A_done_2', 'uid-A_done_3']);
    remount();
    render(s);
    expect(states()).toEqual({ 'uid-A_done_2': 'ready', 'uid-A_done_3': 'ready' });
  });

  it('another owner, another epoch and a sign-out get none of it', async () => {
    const s = plainSeams();
    render(s);
    await advance(1 * S);
    remount();
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 2 };
    render(s);
    expect(seen[0].reviews).toEqual({});
    await advance(1 * S);
    remount();
    id.current = { resolved: true, uid: 'uid-B', authEpoch: 3 };
    render(s);
    expect(seen[0].reviews).toEqual({});
    await advance(1 * S);
    remount();
    id.current = { resolved: true, uid: null, authEpoch: 4 };
    render(s);
    expect(seen[0].battles).toBeNull();
    remount();
    id.current = { resolved: true, uid: 'uid-B', authEpoch: 3 };
    render(s);
    expect(seen[0].battles, 'the sign-out dropped B\'s record').toBeNull();
  });
});
