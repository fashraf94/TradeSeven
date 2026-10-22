// @vitest-environment jsdom
//
// Command Center hub, slice S3 (rulings R-S3-5, R-S3-6) — the thin hook over
// the review scheduler: it reads only while mounted, for the current owner and
// epoch; an owner change disposes the old scheduler and drops its window in
// render; a failed read never becomes an empty window; the page's visibility
// and focus reach the scheduler; and its default operations are the shared
// completed read and getReviewAvailability, unmodified.

import React, { act } from 'react';
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

import useHubCompletedBattles, { HUB_COMPLETED_WINDOW } from './useHubCompletedBattles';

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
function SeamProbe({ seams }) {
  seen.push(useHubCompletedBattles(10, seams));
  return null;
}
const render = (el) => act(() => { root.render(el); });
const last = () => seen[seen.length - 1];
const docsFor = (uid, n = 2) => Array.from({ length: n }, (_, i) => ({ id: `${uid}_done_${i + 1}`, ownerId: uid, status: 'completed' }));

beforeEach(() => {
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
