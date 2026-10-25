// @vitest-environment jsdom
//
// Command Center hub, slice S3 (rulings R-S3-5, R-S3-6) — the thin hook over
// the review scheduler: it reads only while mounted, for the current owner and
// epoch; an owner change disposes the old scheduler and drops its window in
// render; a failed read never becomes an empty window; the page's visibility
// and focus reach the scheduler; and its default operations are the shared
// completed read and getReviewAvailability, unmodified.

import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const id = vi.hoisted(() => ({ current: { resolved: true, uid: 'uid-A', authEpoch: 1 } }));
vi.mock('../../../services/authIdentity', () => ({ useAuthIdentity: () => id.current }));
const ops = vi.hoisted(() => ({ reads: [], checks: [] }));
vi.mock('../../../services/completedAgentBattles', () => ({
  fetchRecentCompletedAgentBattles: vi.fn(async (uid, max) => { ops.reads.push([uid, max]); return []; }),
}));
vi.mock('../../../utils/reviewAvailability', () => ({
  getReviewAvailability: vi.fn((...args) => { ops.checks.push(args); return Promise.resolve({ ready: true, target: 'filmRoom', availability: 'ready' }); }),
}));

import useHubCompletedBattles, { HUB_COMPLETED_WINDOW, resetHubLedgersForTests } from './useHubCompletedBattles';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const T0 = Date.UTC(2026, 9, 22, 15, 0, 0);
const S = 1000;

let host;
let root;
let seen;
let visibility;

function DefaultProbe() {
  seen.push(useHubCompletedBattles());
  return null;
}
// A scheduler defect can start cycle after cycle in zero fake time, and the suite then hangs instead of reddening a row
// (review T5-18). Past this many reads a seam stops answering, so the runaway ends at its own 8 s deadline and the row fails
// by its own assertions. No row here makes more than a handful.
const RUNAWAY_READS = 80;
function capped(seams) {
  let reads = 0;
  return { ...seams, queryCompleted: (...args) => (++reads > RUNAWAY_READS ? new Promise(() => {}) : seams.queryCompleted(...args)) };
}
function SeamProbe({ seams }) {
  seen.push(useHubCompletedBattles(10, capped(seams)));
  return null;
}
const render = (el) => act(() => { root.render(el); });
const last = () => seen[seen.length - 1];
const docsFor = (uid, n = 2) => Array.from({ length: n }, (_, i) => ({ id: `${uid}_done_${i + 1}`, ownerId: uid, status: 'completed' }));

beforeEach(() => {
  // The owner's rate ledger outlives a mount (review T0-3): each row starts with none spent.
  resetHubLedgersForTests();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  id.current = { resolved: true, uid: 'uid-A', authEpoch: 1 };
  ops.reads = [];
  ops.checks = [];
  seen = [];
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('useHubCompletedBattles — the hub\'s ten-game window', () => {
  it('its defaults: the shared completed read for the owner\'s ten, and getReviewAvailability handed each document alone', async () => {
    const { fetchRecentCompletedAgentBattles } = await import('../../../services/completedAgentBattles');
    const docs = docsFor('uid-A');
    fetchRecentCompletedAgentBattles.mockImplementationOnce(async (uid, max) => { ops.reads.push([uid, max]); return docs; });
    render(<DefaultProbe />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(HUB_COMPLETED_WINDOW).toBe(10);
    expect(ops.reads).toEqual([['uid-A', 10]]);
    expect(ops.checks).toEqual([[docs[0]], [docs[1]]]);
    expect(last()).toMatchObject({ status: 'ready', ownerUid: 'uid-A', ownerEpoch: 1, generation: 1 });
    expect(last().battles).toEqual(docs);
  });

  it('reads nothing while signed out or unresolved, and reads once mounted for an owner', async () => {
    id.current = { resolved: false, uid: null, authEpoch: 0 };
    render(<DefaultProbe />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600 * S); });
    expect(ops.reads).toEqual([]);
    expect(last()).toMatchObject({ status: 'loading', battles: null, ownerUid: null });
    id.current = { resolved: true, uid: null, authEpoch: 1 };
    render(<DefaultProbe />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600 * S); });
    expect(ops.reads).toEqual([]);
  });

  it('a failed read never becomes an empty window: battles stay null and the status is the error', async () => {
    const seams = { queryCompleted: () => Promise.reject(new Error('failed-precondition')), checkReview: vi.fn() };
    render(<SeamProbe seams={seams} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(last()).toMatchObject({ status: 'error', battles: null, generation: 0 });
    expect(last().battles).not.toEqual([]);
  });

  it('an owner change drops the old window in the very render it arrives, then reads for the new owner', async () => {
    const reads = [];
    const seams = { queryCompleted: (uid) => { reads.push(uid); return Promise.resolve(docsFor(uid)); }, checkReview: () => Promise.resolve({ ready: false, target: 'filmRoom', availability: 'unavailable' }) };
    render(<SeamProbe seams={seams} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(last().battles.map((b) => b.ownerId)).toEqual(['uid-A', 'uid-A']);
    id.current = { resolved: true, uid: 'uid-B', authEpoch: 2 };
    seen = [];
    await act(async () => { root.render(<SeamProbe seams={seams} />); });
    // The first render under B already shows nothing of A's.
    expect(seen[0]).toMatchObject({ battles: null, status: 'loading', ownerUid: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(reads).toEqual(['uid-A', 'uid-B']);
    expect(last()).toMatchObject({ ownerUid: 'uid-B', ownerEpoch: 2 });
    expect(last().battles.map((b) => b.ownerId)).toEqual(['uid-B', 'uid-B']);
  });

  it('A→B→A: the same uid at a new epoch starts afresh — a late answer of the first A is never shown', async () => {
    let releaseFirst;
    const answers = { 1: () => new Promise((r) => { releaseFirst = r; }) };
    const reads = [];
    const seams = { queryCompleted: (uid) => { reads.push(uid); return (answers[reads.length] || (() => Promise.resolve(docsFor(`${uid}-${reads.length}`))))(); }, checkReview: () => Promise.resolve({ ready: false, target: 'filmRoom', availability: 'unavailable' }) };
    render(<SeamProbe seams={seams} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    id.current = { resolved: true, uid: 'uid-B', authEpoch: 2 };
    render(<SeamProbe seams={seams} />);
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 3 };
    render(<SeamProbe seams={seams} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { releaseFirst(docsFor('stale-A')); await vi.advanceTimersByTimeAsync(0); });
    expect(last()).toMatchObject({ ownerUid: 'uid-A', ownerEpoch: 3 });
    expect(last().battles.some((b) => b.id.startsWith('stale-A'))).toBe(false);
  });

  it('unmount stops it: no read after, and a late answer sets nothing', async () => {
    let release;
    const reads = [];
    const seams = { queryCompleted: () => { reads.push(1); return new Promise((r) => { release = r; }); }, checkReview: vi.fn() };
    render(<SeamProbe seams={seams} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    act(() => root.unmount());
    const count = seen.length;
    await act(async () => { release(docsFor('uid-A')); await vi.advanceTimersByTimeAsync(600 * S); });
    expect(reads).toHaveLength(1);
    expect(seen).toHaveLength(count);
    root = createRoot(host);
  });

  it('the page\'s visibility pauses it and its focus refreshes a stale window — once', async () => {
    const reads = [];
    const seams = { queryCompleted: () => { reads.push(Date.now() - T0); return Promise.resolve(docsFor('uid-A', 1)); }, checkReview: () => Promise.resolve({ ready: false, target: 'filmRoom', availability: 'pending' }) };
    render(<SeamProbe seams={seams} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    visibility = 'hidden';
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600 * S); });
    expect(reads).toEqual([0]);
    visibility = 'visible';
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    act(() => { window.dispatchEvent(new Event('focus')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(reads).toEqual([0, 600 * S]);
  });

  it('refresh() asks for a cycle, within the shared cap', async () => {
    const reads = [];
    const seams = { queryCompleted: () => { reads.push(Date.now() - T0); return Promise.resolve([]); }, checkReview: vi.fn() };
    render(<SeamProbe seams={seams} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * S); });
    act(() => last().refresh());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(reads).toEqual([0]);
    expect(last().nextAttemptAt).toBe(T0 + 120 * S);
    await act(async () => { await vi.advanceTimersByTimeAsync(110 * S); });
    expect(reads).toEqual([0, 120 * S]);
  });
});

describe('the rate cap belongs to the owner and epoch, not to one mount (spec §6 "Every trigger shares this budget"; review T0-3)', () => {
  const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
  let calls;
  const seams = () => ({
    queryCompleted: (uid) => { calls.queries.push(Date.now() - T0); return Promise.resolve(docsFor(uid, 10)); },
    checkReview: () => { calls.checks.push(Date.now() - T0); return Promise.resolve(READY); },
  });
  beforeEach(() => { calls = { queries: [], checks: [] }; });

  // Spec §6 as the founder amended it (Q-S3-2, A+): the last successful window is kept across the remount for the same
  // owner and epoch and shown "as of" its time; the read waits for the permitted slot (the ledger, as built).
  it('a return inside the 120 s window (the Film Room, a site switch) shows the kept window "as of" its read at once, reads nothing until the permitted time — and says when', async () => {
    const s = seams();
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(calls.queries).toEqual([0]);
    expect(calls.checks).toHaveLength(10);
    const firstWindow = last().battles;
    act(() => root.unmount());
    await act(async () => { await vi.advanceTimersByTimeAsync(29 * S); });
    root = createRoot(host);
    seen = [];
    render(<SeamProbe seams={s} />);
    // The very first render of the remount: the kept window, never a loading frame.
    expect(seen[0]).toMatchObject({ status: 'ready', carried: true, generation: 1, lastSuccessfulAt: T0, ownerUid: 'uid-A', ownerEpoch: 1 });
    expect(seen[0].battles.map((b) => b.id)).toEqual(firstWindow.map((b) => b.id));
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(calls.queries, 'no second query inside the window').toEqual([0]);
    expect(last()).toMatchObject({ status: 'ready', carried: true, generation: 1, lastSuccessfulAt: T0, nextAttemptAt: T0 + 120 * S, checking: false });
    // Amendment B (Q-S3-10): a kept row's READY review answer survives the unmount, so it is ready at once and no check
    // starts for it. (Every other state is queued for the slot: the scheduler rows pin that.)
    expect(Object.values(last().reviews).map((r) => r.state)).toEqual(Array(10).fill('ready'));
    expect(calls.checks).toHaveLength(10);
    await act(async () => { await vi.advanceTimersByTimeAsync(88.9 * S); });
    expect(calls.queries).toEqual([0]);
    await act(async () => { await vi.advanceTimersByTimeAsync(0.2 * S); });
    expect(calls.queries, 'one queued cycle at the permitted time').toEqual([0, 120 * S]);
    expect(calls.checks, 'a kept ready answer is not asked again').toHaveLength(10);
    // The read ends the carry; the generation goes on from the kept one.
    expect(last()).toMatchObject({ status: 'ready', carried: false, generation: 2, lastSuccessfulAt: T0 + 120 * S });
  });

  it('an actual owner change starts afresh: A, then B, then A at a new epoch each read at once', async () => {
    const s = seams();
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    id.current = { resolved: true, uid: 'uid-B', authEpoch: 2 };
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 3 };
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(calls.queries).toEqual([0, 1 * S, 2 * S]);
  });

  it('the development double mount (StrictMode) reads once, at once', async () => {
    render(<StrictMode><SeamProbe seams={seams()} /></StrictMode>);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(calls.queries).toEqual([0]);
    expect(last()).toMatchObject({ status: 'ready' });
  });

  // Amendment B (Q-S3-9): the slot is still spent; the first read that succeeds after the unmount is now KEPT, so the return shows
  // it "as of" its read instead of no rows (the scheduler and hook rows of the amendment pin the bounds).
  it('a quick bounce — unmounted while its first read is in flight — still spends the slot', async () => {
    let release;
    const s = { ...seams(), queryCompleted: () => { calls.queries.push(Date.now() - T0); return new Promise((r) => { release = r; }); } };
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    act(() => root.unmount());
    await act(async () => { release(docsFor('uid-A', 10)); await vi.advanceTimersByTimeAsync(4700); });
    root = createRoot(host);
    seen = [];
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(calls.queries).toEqual([0]);
    expect(last()).toMatchObject({ status: 'ready', carried: true, generation: 1, nextAttemptAt: T0 + 120 * S });
    expect(last().battles).toHaveLength(10);
  });
});

describe('the page and the identity reach the scheduler one fact at a time (spec §3 and §6; review T5-12)', () => {
  const UNAVAILABLE = Object.freeze({ ready: false, target: 'filmRoom', availability: 'unavailable' });
  const seamsAt = (reads) => ({
    queryCompleted: (uid) => { reads.push({ uid, at: Date.now() - T0 }); return Promise.resolve(docsFor(uid, 1)); },
    checkReview: () => Promise.resolve(UNAVAILABLE),
  });

  it('the same uid at a new epoch with no render between (A → B → A in one batch): its first render shows nothing of the old window, and it reads afresh at once', async () => {
    const reads = [];
    const seams = seamsAt(reads);
    render(<SeamProbe seams={seams} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(last().battles).toHaveLength(1);
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 3 };
    seen = [];
    await act(async () => { root.render(<SeamProbe seams={seams} />); });
    expect(seen[0]).toMatchObject({ battles: null, status: 'loading', ownerUid: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    // Its own budget, too: a new epoch is a new mounted owner, so the read is not queued behind the first epoch's.
    expect(reads.map((r) => [r.uid, r.at])).toEqual([['uid-A', 0], ['uid-A', 1 * S]]);
    expect(last()).toMatchObject({ ownerUid: 'uid-A', ownerEpoch: 3, status: 'ready' });
  });

  it('the window\'s own focus event refreshes a window 130 s old — once', async () => {
    const reads = [];
    render(<SeamProbe seams={seamsAt(reads)} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(130 * S); });
    expect(reads).toHaveLength(1);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(reads.map((r) => r.at)).toEqual([0, 130 * S]);
  });

  it('focus inside 120 s of the last cycle asks for nothing: no read, nothing queued', async () => {
    const reads = [];
    render(<SeamProbe seams={seamsAt(reads)} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    act(() => { window.dispatchEvent(new Event('focus')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(reads).toHaveLength(1);
    expect(last().nextAttemptAt).toBeNull();
  });

  it('a hub mounted in a hidden page waits to be shown: nothing is read until the page is visible', async () => {
    visibility = 'hidden';
    const reads = [];
    render(<SeamProbe seams={seamsAt(reads)} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * S); });
    expect(reads).toHaveLength(0);
    visibility = 'visible';
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(reads).toHaveLength(1);
  });

  it('unmount removes every page listener it added (spec §6 "Unmount … clears timers"; a leaked listener outlives the hub on every site switch)', async () => {
    // Pass-through spies: React's own listeners still register.
    const [docAdd, docRemove, winAdd, winRemove] = [document, window].flatMap((target) => ['addEventListener', 'removeEventListener'].map((m) => vi.spyOn(target, m)));
    try {
      render(<SeamProbe seams={seamsAt([])} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
      const mine = (spy) => spy.mock.calls.filter(([type]) => type === 'visibilitychange' || type === 'focus');
      expect(mine(docAdd).map(([type]) => type)).toEqual(['visibilitychange']);
      expect(mine(winAdd).map(([type]) => type)).toEqual(['focus']);
      act(() => root.unmount());
      for (const [add, remove] of [[docAdd, docRemove], [winAdd, winRemove]]) {
        for (const [type, fn] of mine(add)) expect(mine(remove).some(([t, f]) => t === type && f === fn), type).toBe(true);
      }
      root = createRoot(host);
    } finally {
      for (const spy of [docAdd, docRemove, winAdd, winRemove]) spy.mockRestore();
    }
  });
});

describe('the kept window (spec §6 as the founder amended it: Q-S3-2, A+) belongs to the owner and epoch, like the ledger', () => {
  const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
  let reads;
  const seams = (answer = (uid) => Promise.resolve(docsFor(uid, 3))) => ({
    queryCompleted: (uid) => { reads.push({ uid, at: Date.now() - T0 }); return answer(uid); },
    checkReview: () => Promise.resolve(READY),
  });
  const remount = () => {
    act(() => root.unmount());
    root = createRoot(host);
    seen = [];
  };
  beforeEach(() => { reads = []; });

  it('an owner change clears it: B never sees A\'s kept window, and A at a new epoch starts empty too', async () => {
    const s = seams();
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    remount();
    id.current = { resolved: true, uid: 'uid-B', authEpoch: 2 };
    render(<SeamProbe seams={s} />);
    expect(seen[0]).toMatchObject({ status: 'loading', battles: null, carried: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(last().battles.map((b) => b.ownerId)).toEqual(['uid-B', 'uid-B', 'uid-B']);
    remount();
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 3 };
    render(<SeamProbe seams={s} />);
    expect(seen[0]).toMatchObject({ status: 'loading', battles: null, carried: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(reads.map((r) => r.uid)).toEqual(['uid-A', 'uid-B', 'uid-A']);
    expect(last()).toMatchObject({ ownerUid: 'uid-A', ownerEpoch: 3, carried: false, generation: 1 });
  });

  it('only a successful read is kept: a return after a failed first read shows no window, and waits for the slot', async () => {
    const s = seams(() => Promise.reject(new Error('unavailable')));
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(last()).toMatchObject({ status: 'error', battles: null });
    remount();
    render(<SeamProbe seams={s} />);
    expect(seen[0]).toMatchObject({ status: 'loading', battles: null, carried: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(last()).toMatchObject({ status: 'loading', battles: null, carried: false, nextAttemptAt: T0 + 120 * S });
  });

  it('the kept window follows the latest success: the second visit\'s refresh is what the third visit shows', async () => {
    let n = 0;
    const s = seams((uid) => { n += 1; return Promise.resolve(docsFor(uid, n)); });
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    remount();
    render(<SeamProbe seams={s} />);
    expect(seen[0]).toMatchObject({ carried: true, generation: 1 });
    await act(async () => { await vi.advanceTimersByTimeAsync(120 * S); });
    expect(last()).toMatchObject({ carried: false, generation: 2 });
    remount();
    render(<SeamProbe seams={s} />);
    expect(seen[0]).toMatchObject({ carried: true, generation: 2, lastSuccessfulAt: T0 + 120 * S });
    expect(seen[0].battles).toHaveLength(2);
  });

  it('signed out, a kept window shows nothing; signing back in is a new epoch, so it is gone', async () => {
    const s = seams();
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    remount();
    id.current = { resolved: true, uid: null, authEpoch: 2 };
    render(<SeamProbe seams={s} />);
    expect(last()).toMatchObject({ status: 'loading', battles: null, carried: false });
    remount();
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 3 };
    render(<SeamProbe seams={s} />);
    expect(seen[0]).toMatchObject({ status: 'loading', battles: null, carried: false });
  });
});

describe('the kept window is dropped, not just hidden, and never goes back (review MR-5, MR-11)', () => {
  const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });

  // The identity source never hands a key back (the epoch only grows); these rows do, to see what is still held.
  it('signed out while the hub is mounted, the kept window is dropped at once: the same key handed back shows nothing', async () => {
    const reads = [];
    const s = { queryCompleted: (uid) => { reads.push(Date.now() - T0); return Promise.resolve(docsFor(uid, 3)); }, checkReview: () => Promise.resolve(READY) };
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    id.current = { resolved: true, uid: null, authEpoch: 2 };
    render(<SeamProbe seams={s} />);
    act(() => root.unmount());
    root = createRoot(host);
    seen = [];
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 1 };
    render(<SeamProbe seams={s} />);
    expect(seen[0]).toMatchObject({ status: 'loading', battles: null, carried: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    // The ledger went with it: the read runs at once.
    expect(reads).toEqual([0, 1 * S]);
  });

  it('signed out while the hub is away, the next mount drops it — even a signed-out one', async () => {
    const s = { queryCompleted: (uid) => Promise.resolve(docsFor(uid, 3)), checkReview: () => Promise.resolve(READY) };
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    act(() => root.unmount());
    root = createRoot(host);
    id.current = { resolved: true, uid: null, authEpoch: 2 };
    render(<SeamProbe seams={s} />);
    act(() => root.unmount());
    root = createRoot(host);
    seen = [];
    id.current = { resolved: true, uid: 'uid-A', authEpoch: 1 };
    render(<SeamProbe seams={s} />);
    expect(seen[0]).toMatchObject({ battles: null, carried: false });
  });

  it('two mounts at once: a lagging mount\'s older window never replaces a newer kept one', async () => {
    const firstSeen = [];
    const secondSeen = [];
    function Probe({ seams, into }) {
      into.push(useHubCompletedBattles(10, capped(seams)));
      return null;
    }
    let failFirst = false;
    const first = { queryCompleted: (uid) => (failFirst ? Promise.reject(new Error('unavailable')) : Promise.resolve(docsFor(uid, 1))), checkReview: () => Promise.resolve(READY) };
    const second = { queryCompleted: (uid) => Promise.resolve(docsFor(uid, 2)), checkReview: () => Promise.resolve(READY) };
    render(<Probe seams={first} into={firstSeen} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    const host2 = document.createElement('div');
    document.body.appendChild(host2);
    const root2 = createRoot(host2);
    act(() => { root2.render(<Probe seams={second} into={secondSeen} />); });
    // The second mount starts from the kept window and reads at the slot: generation 2, kept.
    await act(async () => { await vi.advanceTimersByTimeAsync(120 * S); });
    expect(secondSeen.at(-1)).toMatchObject({ generation: 2, carried: false });
    // The first mount, still at generation 1, now fails a read and publishes its old window again.
    failFirst = true;
    await act(async () => { firstSeen.at(-1).refresh(); await vi.advanceTimersByTimeAsync(120 * S); });
    expect(firstSeen.at(-1)).toMatchObject({ status: 'error', generation: 1 });
    act(() => root.unmount());
    act(() => root2.unmount());
    host2.remove();
    root = createRoot(host);
    seen = [];
    render(<SeamProbe seams={second} />);
    expect(seen[0]).toMatchObject({ carried: true, generation: 2 });
    expect(seen[0].battles).toHaveLength(2);
  });

  it('two mounts at one generation: the later read stays kept when the earlier one publishes again', async () => {
    const intoA = [];
    const intoB = [];
    function Probe({ seams, into }) {
      into.push(useHubCompletedBattles(10, capped(seams)));
      return null;
    }
    const seamsOf = (n) => ({ queryCompleted: (uid) => Promise.resolve(docsFor(uid, n)), checkReview: () => Promise.resolve(READY) });
    // A first read at T0, kept; then two mounts start from it and both wait for the slot.
    render(<SeamProbe seams={seamsOf(1)} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    act(() => root.unmount());
    root = createRoot(host);
    render(<Probe seams={seamsOf(4)} into={intoA} />);
    const hostB = document.createElement('div');
    document.body.appendChild(hostB);
    const rootB = createRoot(hostB);
    act(() => { rootB.render(<Probe seams={seamsOf(5)} into={intoB} />); });
    // A takes the slot at 120 s (generation 2); B, refused by the shared ledger, reads at 240 s (generation 2, later).
    await act(async () => { await vi.advanceTimersByTimeAsync(240 * S); });
    expect(intoA.at(-1)).toMatchObject({ generation: 2, lastSuccessfulAt: T0 + 120 * S });
    expect(intoB.at(-1)).toMatchObject({ generation: 2, lastSuccessfulAt: T0 + 240 * S });
    // A asks again and is queued: it publishes its older window at the same generation.
    await act(async () => { intoA.at(-1).refresh(); await vi.advanceTimersByTimeAsync(1 * S); });
    expect(intoA.at(-1)).toMatchObject({ generation: 2, lastSuccessfulAt: T0 + 120 * S });
    act(() => root.unmount());
    act(() => rootB.unmount());
    hostB.remove();
    root = createRoot(host);
    seen = [];
    render(<SeamProbe seams={seamsOf(5)} />);
    expect(seen[0]).toMatchObject({ carried: true, generation: 2, lastSuccessfulAt: T0 + 240 * S });
    expect(seen[0].battles).toHaveLength(5);
  });
});
