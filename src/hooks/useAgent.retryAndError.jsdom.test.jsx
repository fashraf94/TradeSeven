// @vitest-environment jsdom
//
// src/hooks/useAgent.retryAndError.jsdom.test.jsx
//
// Command Center slice S3 (ruling R-S3-4) — three corners of the ranked-agent
// reader that useAgent.s3.jsdom.test.jsx leaves open (S3 review T5-16):
//   - a FIRST read that fails ends the legacy `loading` (the old null answer did);
//   - every Retry subscribes again, not only the first;
//   - an answer clears the legacy `error` an action left (the old success
//     callback did).

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const svc = vi.hoisted(() => ({ subs: [], createAgent: null }));
vi.mock('../services/agentService', () => ({
  subscribeToUserAgent: vi.fn((uid, callback, onError) => {
    const sub = { uid, callback, onError, fail: (e) => (typeof onError === 'function' ? onError(e) : callback(null)), unsubscribe: vi.fn() };
    svc.subs.push(sub);
    return sub.unsubscribe;
  }),
  createAgent: vi.fn((...args) => svc.createAgent(...args)),
  addDirective: vi.fn(),
  removeDirective: vi.fn(),
  seedTestAgent: vi.fn(),
}));

import useAgent from './useAgent';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;
let results;
const last = () => results[results.length - 1];
const sub = (i = svc.subs.length - 1) => svc.subs[i];
function Probe({ uid }) {
  results.push(useAgent(uid));
  return null;
}

const AGENT = { id: 'agent-A', name: 'Aurora', stats: { gamesPlayed: 3, wins: 2, losses: 1 } };

beforeEach(() => {
  svc.subs = [];
  svc.createAgent = async () => 'agent-id';
  results = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<Probe uid="uid-A" />); });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('useAgent — corners of the read (R-S3-4)', () => {
  it('a FIRST read that fails ends the legacy loading: no agent, not loading, no error — and the read says why', () => {
    expect(last().loading).toBe(true);
    const failure = new Error('permission-denied');
    act(() => sub().fail(failure));
    expect(last()).toMatchObject({ agent: null, loading: false, error: null, status: 'error', readError: failure });
  });

  it('every Retry subscribes again — the second and the third too, not only the first', () => {
    act(() => sub().fail(new Error('unavailable')));
    act(() => last().retry());
    expect(svc.subs).toHaveLength(2);
    expect(last().status).toBe('loading');
    act(() => sub().fail(new Error('unavailable')));
    act(() => last().retry());
    expect(svc.subs).toHaveLength(3);
    act(() => sub().fail(new Error('unavailable')));
    act(() => last().retry());
    expect(svc.subs).toHaveLength(4);
    act(() => sub().callback(AGENT));
    expect(last()).toMatchObject({ status: 'ready', agent: AGENT });
  });

  it('an answer clears the legacy error an action left behind', async () => {
    svc.createAgent = async () => { throw new Error('nope'); };
    act(() => sub().callback(AGENT));
    await act(async () => { await last().createAgent({}); });
    expect(last().error).toBe('nope');
    act(() => sub().callback(AGENT));
    expect(last().error).toBeNull();
  });
});
