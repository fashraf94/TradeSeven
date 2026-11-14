// @vitest-environment jsdom
//
// src/hooks/useHubResearchReaders.jsdom.test.jsx
//
// Command Center core spec V1.2, Amendment E V1.1 §1 — the research door's two readers, row by row, against service
// stand-ins (no network, no database): the stories reader (useHubStories, fetchFeed()) and the research reader
// (useHubSharedResearch, the researchWork query). For each: no read unless admitted; one read per owner and epoch per load;
// an owner or epoch change starts fresh; a former owner's answer is never shown, not even for one render; Retry; a failed
// refresh keeps the last good answer. Their activity (one effect, no timer or listener) is pinned call by call in
// commandCenterHub.activity.guard.test.js.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ fetchFeed: vi.fn(), fetchSharedResearchRecords: vi.fn() }));
vi.mock('../services/fantasyTimesClient', () => ({ fetchFeed: svc.fetchFeed }));
vi.mock('../services/sharedResearchRecords', () => ({ fetchSharedResearchRecords: svc.fetchSharedResearchRecords }));

import useHubStories from './useHubStories';
import useHubSharedResearch from './useHubSharedResearch';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const A = Object.freeze({ signedIn: true, uid: 'uid-A', authEpoch: 2 });
const B = Object.freeze({ signedIn: true, uid: 'uid-B', authEpoch: 3 });

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = () => act(async () => { for (let i = 0; i < 4; i += 1) await Promise.resolve(); });

/** Mounts a probe calling `useHook(props)`; `seen` holds every render's return, `last()` the latest. */
function harness(useHook, props) {
  const seen = [];
  function Probe(p) { seen.push(useHook(p)); return null; }
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<Probe {...props} />); });
  return {
    seen,
    last: () => seen[seen.length - 1],
    rerender: (next) => act(() => { root.render(<Probe {...next} />); }),
    unmount: () => { act(() => { root.unmount(); }); host.remove(); },
  };
}

const READERS = [
  {
    name: 'useHubStories (fetchFeed)',
    useHook: useHubStories,
    service: () => svc.fetchFeed,
    payloadKey: 'stories',
    answerFor: (uid) => [{ id: `story-of-${uid}` }],
    callArgs: () => [],
  },
  {
    name: 'useHubSharedResearch (the researchWork query)',
    useHook: useHubSharedResearch,
    service: () => svc.fetchSharedResearchRecords,
    payloadKey: 'records',
    answerFor: (uid) => [{ id: `sr_of_${uid}`, origin: 'shared_research' }],
    callArgs: (uid) => [{ uid }],
  },
];

let mounted = [];
beforeEach(() => {
  svc.fetchFeed.mockReset();
  svc.fetchSharedResearchRecords.mockReset();
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
});
const mount = (useHook, props) => { const h = harness(useHook, props); mounted.push(h); return h; };

describe.each(READERS)('$name', ({ useHook, service, payloadKey, answerFor, callArgs }) => {
  it('no read unless admitted: idle, and not one request, for a player outside admission or signed out', async () => {
    service().mockResolvedValue(answerFor('uid-A'));
    const h = mount(useHook, { auth: A, enabled: false });
    await flush();
    expect(service()).not.toHaveBeenCalled();
    expect(h.last().read.status).toBe('idle');
    const signedOut = mount(useHook, { auth: { signedIn: false }, enabled: true });
    await flush();
    expect(service()).not.toHaveBeenCalled();
    expect(signedOut.last().read.status).toBe('idle');
    const unresolved = mount(useHook, { auth: null, enabled: true });
    await flush();
    expect(service()).not.toHaveBeenCalled();
    expect(unresolved.last().read.status).toBe('idle');
  });

  it('admitted: one read for this owner, loading then ready with the answer', async () => {
    const d = deferred();
    service().mockReturnValue(d.promise);
    const h = mount(useHook, { auth: A, enabled: true });
    await flush();
    expect(service()).toHaveBeenCalledTimes(1);
    expect(service().mock.calls[0]).toEqual(callArgs('uid-A'));
    expect(h.last().read.status).toBe('loading');
    await act(async () => { d.resolve(answerFor('uid-A')); });
    await flush();
    expect(h.last().read.status).toBe('ready');
    expect(h.last().read[payloadKey]).toEqual(answerFor('uid-A'));
  });

  it('once per owner and epoch per load: re-renders, a new props object and the same owner read nothing more', async () => {
    service().mockResolvedValue(answerFor('uid-A'));
    const h = mount(useHook, { auth: A, enabled: true });
    await flush();
    for (let i = 0; i < 4; i += 1) h.rerender({ auth: { ...A }, enabled: true });
    await flush();
    expect(service()).toHaveBeenCalledTimes(1);
  });

  it('becoming admitted later reads then, once', async () => {
    service().mockResolvedValue(answerFor('uid-A'));
    const h = mount(useHook, { auth: A, enabled: false });
    await flush();
    expect(service()).not.toHaveBeenCalled();
    h.rerender({ auth: A, enabled: true });
    await flush();
    expect(service()).toHaveBeenCalledTimes(1);
    h.rerender({ auth: A, enabled: true });
    await flush();
    expect(service()).toHaveBeenCalledTimes(1);
  });

  it('an owner change starts fresh: the new owner\'s read, and the former owner\'s answer is not shown for even one render', async () => {
    const d = deferred();
    service().mockResolvedValueOnce(answerFor('uid-A')).mockReturnValueOnce(d.promise);
    const h = mount(useHook, { auth: A, enabled: true });
    await flush();
    expect(h.last().read.status).toBe('ready');
    expect(h.last().read[payloadKey]).toEqual(answerFor('uid-A'));
    const before = h.seen.length;
    h.rerender({ auth: B, enabled: true });
    // every render since the change: never the former owner's answer
    for (const out of h.seen.slice(before)) expect(out.read.status === 'ready' ? out.read[payloadKey] : null).not.toEqual(answerFor('uid-A'));
    await flush();
    expect(service()).toHaveBeenCalledTimes(2);
    expect(h.last().read.status).toBe('loading');
    await act(async () => { d.resolve(answerFor('uid-B')); });
    await flush();
    expect(h.last().read[payloadKey]).toEqual(answerFor('uid-B'));
  });

  it('an epoch change of the same uid starts fresh too', async () => {
    service().mockResolvedValue(answerFor('uid-A'));
    const h = mount(useHook, { auth: A, enabled: true });
    await flush();
    h.rerender({ auth: { ...A, authEpoch: 9 }, enabled: true });
    await flush();
    expect(service()).toHaveBeenCalledTimes(2);
  });

  it('a former owner\'s answer that lands after the change is dropped', async () => {
    const late = deferred();
    service().mockReturnValueOnce(late.promise).mockResolvedValueOnce(answerFor('uid-B'));
    const h = mount(useHook, { auth: A, enabled: true });
    await flush();
    h.rerender({ auth: B, enabled: true });
    await flush();
    expect(h.last().read[payloadKey]).toEqual(answerFor('uid-B'));
    await act(async () => { late.resolve(answerFor('uid-A')); });
    await flush();
    expect(h.last().read[payloadKey]).toEqual(answerFor('uid-B'));
  });

  it('admission ending: idle again, with nothing of the answer kept on screen', async () => {
    service().mockResolvedValue(answerFor('uid-A'));
    const h = mount(useHook, { auth: A, enabled: true });
    await flush();
    h.rerender({ auth: A, enabled: false });
    expect(h.last().read.status).toBe('idle');
    expect(h.last().read[payloadKey]).toBeNull();
  });

  it('a failed read is the error state; Retry reads once more and answers', async () => {
    service().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(answerFor('uid-A'));
    const h = mount(useHook, { auth: A, enabled: true });
    await flush();
    expect(h.last().read.status).toBe('error');
    expect(h.last().read[payloadKey]).toBeNull();
    await act(async () => { await h.last().refresh(); });
    await flush();
    expect(service()).toHaveBeenCalledTimes(2);
    expect(h.last().read.status).toBe('ready');
  });

  it('a failed refresh keeps the last good answer, marked stale', async () => {
    service().mockResolvedValueOnce(answerFor('uid-A')).mockRejectedValueOnce(new Error('offline'));
    const h = mount(useHook, { auth: A, enabled: true });
    await flush();
    await act(async () => { await h.last().refresh(); });
    await flush();
    expect(h.last().read.status).toBe('ready');
    expect(h.last().read.stale).toBe(true);
    expect(h.last().read[payloadKey]).toEqual(answerFor('uid-A'));
  });

  it('an older Retry landing after a newer one is dropped', async () => {
    const first = deferred();
    const second = deferred();
    service().mockResolvedValueOnce([]).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const h = mount(useHook, { auth: A, enabled: true });
    await flush();
    act(() => { h.last().refresh(); });
    act(() => { h.last().refresh(); });
    await act(async () => { second.resolve(answerFor('uid-A')); });
    await flush();
    await act(async () => { first.resolve([{ id: 'stale-older' }]); });
    await flush();
    expect(h.last().read[payloadKey]).toEqual(answerFor('uid-A'));
  });

  it('no timer and no listener: nothing reads again on its own, on focus or on a visibility change', async () => {
    service().mockResolvedValue(answerFor('uid-A'));
    mount(useHook, { auth: A, enabled: true });
    await flush();
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await flush();
    expect(service()).toHaveBeenCalledTimes(1);
  });
});
