// @vitest-environment jsdom
//
// src/hooks/useCockpitAnswer.jsdom.test.jsx
//
// Cockpit Build 2a — ANSWERING FROM A TILE (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §7.3, §8.3): the wire body; no optimistic
// state (pending while in flight, nothing kept on a 200 — the listener brings
// the record); the failure BODY kept per call; the belief = the subscribed
// thread, except after a 409 belief_mismatch, when the server's
// currentDirectiveThreadId is adopted until the subscription moves; a 404
// cockpit_unavailable asks for the status re-check; one tap in flight at a time.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

let USER = { getIdToken: vi.fn(async () => 'token-1') };
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: USER }) }));

import { useCockpitAnswer, postCallAnswer, CALL_RESPONSE_PATH } from './useCockpitAnswer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let hook;
function Probe(props) {
  hook = useCockpitAnswer(props);
  return null;
}
const render = (props) => act(() => { root.render(<Probe battleId="ab-1" {...props} />); });

beforeEach(() => {
  USER = { getIdToken: vi.fn(async () => 'token-1') };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('postCallAnswer — the wire', () => {
  it('POSTs { battleId, callId, answer, expectedDirectiveThreadId } with the caller\'s token; returns { status, body }', async () => {
    const fetchSpy = vi.fn(async () => ({ status: 409, json: async () => ({ error: 'refused', reason: 'budget' }) }));
    vi.stubGlobal('fetch', fetchSpy);
    const out = await postCallAnswer({ battleId: 'ab-1', callId: 'c1', answer: 'hold', expectedDirectiveThreadId: null });
    expect(fetchSpy).toHaveBeenCalledWith(CALL_RESPONSE_PATH, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId: 'ab-1', callId: 'c1', answer: 'hold', expectedDirectiveThreadId: null }),
    });
    expect(out).toEqual({ status: 409, body: { error: 'refused', reason: 'budget' } });
  });
  it('no response at all → { status: null }; no user → 401 without a request; an unreadable body → null body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await postCallAnswer({ battleId: 'ab-1', callId: 'c1', answer: 'go', expectedDirectiveThreadId: null })).toEqual({ status: null, body: null });
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 500, json: async () => { throw new Error('not json'); } })));
    expect(await postCallAnswer({ battleId: 'ab-1', callId: 'c1', answer: 'go', expectedDirectiveThreadId: null })).toEqual({ status: 500, body: null });
    USER = null;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await postCallAnswer({ battleId: 'ab-1', callId: 'c1', answer: 'go', expectedDirectiveThreadId: null })).toEqual({ status: 401, body: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('the hook — no optimistic state', () => {
  it('pending while in flight; a 200 keeps nothing (the tile changes when the listener delivers the record)', async () => {
    let release;
    const post = vi.fn(() => new Promise((r) => { release = r; }));
    render({ subscribedThreadId: 't-1', post });
    let done;
    await act(async () => { done = hook.submit('c1', 'go'); });
    expect(hook.pending).toEqual({ callId: 'c1', answer: 'go' });
    expect(post).toHaveBeenCalledWith({ battleId: 'ab-1', callId: 'c1', answer: 'go', expectedDirectiveThreadId: 't-1' });
    await act(async () => { release({ status: 200, body: { callId: 'c1' } }); await done; });
    expect(hook.pending).toBeNull();
    expect(hook.outcomes).toEqual({});
  });

  it('a failure keeps { status, body } for that call; the next tap on it clears the old line first', async () => {
    const post = vi.fn(async () => ({ status: 409, body: { error: 'refused', reason: 'expired' } }));
    render({ post });
    await act(async () => { await hook.submit('c1', 'hold'); });
    expect(hook.outcomes).toEqual({ c1: { status: 409, body: { error: 'refused', reason: 'expired' } } });
    let release;
    post.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    let done;
    await act(async () => { done = hook.submit('c1', 'go'); });
    expect(hook.outcomes).toEqual({});
    await act(async () => { release({ status: 200, body: {} }); await done; });
  });

  it('one tap in flight at a time: a second submit while the first is pending sends nothing', async () => {
    let release;
    const post = vi.fn(() => new Promise((r) => { release = r; }));
    render({ post });
    let first;
    await act(async () => { first = hook.submit('c1', 'go'); });
    await act(async () => { await hook.submit('c2', 'hold'); });
    expect(post).toHaveBeenCalledTimes(1);
    await act(async () => { release({ status: 200, body: {} }); await first; });
  });

  it('the belief is the subscribed thread; after 409 belief_mismatch the server\'s current thread is adopted until the subscription moves', async () => {
    const post = vi.fn(async () => ({ status: 409, body: { error: 'refused', reason: 'belief_mismatch', currentDirectiveThreadId: 't-new' } }));
    render({ subscribedThreadId: 't-old', post });
    expect(hook.belief).toBe('t-old');
    await act(async () => { await hook.submit('c1', 'hold'); });
    expect(hook.belief).toBe('t-new');
    post.mockResolvedValueOnce({ status: 200, body: {} });
    await act(async () => { await hook.submit('c1', 'hold'); });
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ expectedDirectiveThreadId: 't-new' }));
    // The subscription catches up (to anything): it is the belief again.
    render({ subscribedThreadId: 't-newer', post });
    expect(hook.belief).toBe('t-newer');
  });

  it('a belief_mismatch naming no current thread adopts null', async () => {
    const post = vi.fn(async () => ({ status: 409, body: { error: 'refused', reason: 'belief_mismatch', currentDirectiveThreadId: null } }));
    render({ subscribedThreadId: 't-old', post });
    await act(async () => { await hook.submit('c1', 'hold'); });
    expect(hook.belief).toBeNull();
  });

  it('404 cockpit_unavailable asks the screen to re-run the status check; other 404s do not', async () => {
    const onUnavailable = vi.fn();
    const post = vi.fn(async () => ({ status: 404, body: { error: 'cockpit_unavailable' } }));
    render({ post, onUnavailable });
    await act(async () => { await hook.submit('c1', 'go'); });
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    post.mockResolvedValueOnce({ status: 404, body: { error: 'not_found' } });
    await act(async () => { await hook.submit('c1', 'go'); });
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it('nothing is sent without a battle, a call or an answer', async () => {
    const post = vi.fn();
    render({ battleId: null, post });
    await act(async () => { await hook.submit('c1', 'go'); });
    render({ post });
    await act(async () => { await hook.submit(null, 'go'); await hook.submit('c1', null); });
    expect(post).not.toHaveBeenCalled();
  });
});
