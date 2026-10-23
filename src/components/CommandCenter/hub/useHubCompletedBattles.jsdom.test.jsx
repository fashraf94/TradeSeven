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

  it('a return inside the 120 s window (the Film Room, a site switch) reads nothing until the permitted time — and says when', async () => {
    const s = seams();
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(calls.queries).toEqual([0]);
    expect(calls.checks).toHaveLength(10);
    act(() => root.unmount());
    await act(async () => { await vi.advanceTimersByTimeAsync(29 * S); });
    root = createRoot(host);
    seen = [];
    render(<SeamProbe seams={s} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1 * S); });
    expect(calls.queries, 'no second query inside the window').toEqual([0]);
    expect(last()).toMatchObject({ status: 'loading', battles: null, nextAttemptAt: T0 + 120 * S });
    await act(async () => { await vi.advanceTimersByTimeAsync(88.9 * S); });
    expect(calls.queries).toEqual([0]);
    await act(async () => { await vi.advanceTimersByTimeAsync(0.2 * S); });
    expect(calls.queries, 'one queued cycle at the permitted time').toEqual([0, 120 * S]);
    expect(calls.checks).toHaveLength(20);
    expect(last()).toMatchObject({ status: 'ready', generation: 1 });
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
    expect(last()).toMatchObject({ status: 'loading', battles: null, nextAttemptAt: T0 + 120 * S });
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
