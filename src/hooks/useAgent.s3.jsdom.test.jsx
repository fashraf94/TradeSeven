// @vitest-environment jsdom
//
// src/hooks/useAgent.s3.jsdom.test.jsx
//
// Command Center slice S3 (ruling R-S3-4) — the ranked-agent reader gains owner
// tags, additively:
//   parity  `agent`, `loading` and `error` keep their values for every legacy
//           consumer (called as useAgent(uid), as all seven are): the same
//           subscription, the same answers, a failed read still "no agent";
//   new     `status`, `readError`, `ownerUid`, `ownerEpoch` and `retry` for the
//           hub — the swallowed subscription error (a defect today) surfaces.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const svc = vi.hoisted(() => ({ subs: [] }));
vi.mock('../services/agentService', () => ({
  subscribeToUserAgent: vi.fn((uid, callback, onError) => {
    // The real service's error path: the caller's error callback if it gave one, else the old null answer.
    const sub = { uid, callback, onError, fail: (e) => (typeof onError === 'function' ? onError(e) : callback(null)), unsubscribe: vi.fn() };
    svc.subs.push(sub);
    return sub.unsubscribe;
  }),
  createAgent: vi.fn(), addDirective: vi.fn(), removeDirective: vi.fn(), seedTestAgent: vi.fn(),
}));

import useAgent from './useAgent';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;
let results;
let renders;

/** The legacy call, as all seven consumers make it. */
function LegacyProbe({ uid }) {
  const result = useAgent(uid);
  renders += 1;
  results.push(result);
  return null;
}
/** The hub's call, with the identity epoch. */
function TaggedProbe({ uid, options }) {
  const result = useAgent(uid, options);
  renders += 1;
  results.push(result);
  return null;
}
const render = ({ uid, options }) => act(() => {
  root.render(options === undefined ? <LegacyProbe uid={uid} /> : <TaggedProbe uid={uid} options={options} />);
});
const last = () => results[results.length - 1];
const legacy = (r) => ({ agent: r.agent, loading: r.loading, error: r.error });
const sub = (i = svc.subs.length - 1) => svc.subs[i];

beforeEach(() => {
  svc.subs = [];
  results = [];
  renders = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const AGENT = { id: 'agent-A', name: 'Aurora', stats: { gamesPlayed: 3, wins: 2, losses: 1 } };

describe('parity — the legacy fields, for the legacy call useAgent(uid)', () => {
  it('mount: one subscription for the uid, loading, no agent, no error — and one render (no new state at mount)', () => {
    render({ uid: 'uid-A' });
    expect(svc.subs.map((s) => s.uid)).toEqual(['uid-A']);
    expect(legacy(last())).toEqual({ agent: null, loading: true, error: null });
    expect(renders).toBe(1);
  });

  it('an answer, then no agent: agent and loading follow the answers', () => {
    render({ uid: 'uid-A' });
    act(() => sub().callback(AGENT));
    expect(legacy(last())).toEqual({ agent: AGENT, loading: false, error: null });
    act(() => sub().callback(null));
    expect(legacy(last())).toEqual({ agent: null, loading: false, error: null });
  });

  it('a failed read: the legacy fields read exactly as the old null answer — no agent, not loading, no error', () => {
    render({ uid: 'uid-A' });
    act(() => sub().callback(AGENT));
    act(() => sub().fail(new Error('permission-denied')));
    expect(legacy(last())).toEqual({ agent: null, loading: false, error: null });
  });

  it('a re-render with the same uid subscribes nothing new; another uid unsubscribes and subscribes again; no uid is not loading', () => {
    render({ uid: 'uid-A' });
    render({ uid: 'uid-A' });
    expect(svc.subs).toHaveLength(1);
    render({ uid: 'uid-B' });
    expect(sub(0).unsubscribe).toHaveBeenCalledTimes(1);
    expect(svc.subs.map((s) => s.uid)).toEqual(['uid-A', 'uid-B']);
    render({ uid: null });
    expect(sub(1).unsubscribe).toHaveBeenCalledTimes(1);
    expect(legacy(last())).toEqual({ agent: null, loading: false, error: null });
  });

  it('the derived legacy fields still come from the agent: record and hasAgent', () => {
    render({ uid: 'uid-A' });
    act(() => sub().callback(AGENT));
    expect(last().record).toBe('2W-1L');
    expect(last().hasAgent).toBe(true);
  });
});

describe('new — the read\'s own state, owner-tagged (R-S3-4)', () => {
  it('a subscription error surfaces: status error, the error itself, tagged with its owner and epoch (swallowed before S3)', () => {
    render({ uid: 'uid-A', options: { ownerEpoch: 4 } });
    const failure = new Error('unavailable');
    act(() => sub().fail(failure));
    expect(last()).toMatchObject({ status: 'error', readError: failure, ownerUid: 'uid-A', ownerEpoch: 4 });
  });

  it('loading names no owner; an answer is ready and names the uid subscribed and the epoch given', () => {
    render({ uid: 'uid-A', options: { ownerEpoch: 4 } });
    expect(last()).toMatchObject({ status: 'loading', readError: null, ownerUid: null, ownerEpoch: null });
    act(() => sub().callback(null));
    expect(last()).toMatchObject({ status: 'ready', agent: null, ownerUid: 'uid-A', ownerEpoch: 4 });
  });

  it('retry subscribes again, back to loading, and the new answer is ready', () => {
    render({ uid: 'uid-A', options: { ownerEpoch: 4 } });
    act(() => sub().fail(new Error('unavailable')));
    act(() => last().retry());
    expect(sub(0).unsubscribe).toHaveBeenCalledTimes(1);
    expect(svc.subs).toHaveLength(2);
    expect(last()).toMatchObject({ status: 'loading', ownerUid: null });
    act(() => sub().callback(AGENT));
    expect(last()).toMatchObject({ status: 'ready', agent: AGENT, ownerUid: 'uid-A', ownerEpoch: 4 });
  });

  it('a new epoch for the same uid (A→B→A) subscribes again, and an answer of the old subscription writes nothing', () => {
    render({ uid: 'uid-A', options: { ownerEpoch: 4 } });
    const old = sub();
    render({ uid: 'uid-A', options: { ownerEpoch: 6 } });
    expect(old.unsubscribe).toHaveBeenCalledTimes(1);
    expect(svc.subs).toHaveLength(2);
    act(() => old.callback({ id: 'stale' }));
    act(() => old.fail(new Error('stale')));
    expect(last()).toMatchObject({ status: 'loading', agent: null, ownerUid: null });
    act(() => sub().callback(AGENT));
    expect(last()).toMatchObject({ status: 'ready', agent: AGENT, ownerUid: 'uid-A', ownerEpoch: 6 });
  });

  it('the legacy call tags its answers with no epoch — never one it was not given', () => {
    render({ uid: 'uid-A' });
    act(() => sub().callback(AGENT));
    expect(last()).toMatchObject({ status: 'ready', ownerUid: 'uid-A', ownerEpoch: null });
  });
});
