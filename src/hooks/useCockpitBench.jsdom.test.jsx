// @vitest-environment jsdom
//
// src/hooks/useCockpitBench.jsdom.test.jsx
//
// Cockpit Build 2b — THE BENCH READ (spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md
// §4 "Bench rows", §5.7). One fetch when the sheet opens, a fresh one on every
// reopen; nothing while closed (and no re-render for it); an answer that lands
// after the sheet closed is dropped; every failure reads 'error', never rows.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

let USER = { getIdToken: vi.fn(async () => 'token-1') };
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: USER }) }));

import { useCockpitBench, requestCockpitBench, COCKPIT_BENCH_PATH } from './useCockpitBench';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let seen;
function Probe(props) {
  seen.push(useCockpitBench(props));
  return null;
}
const render = async (props) => {
  await act(async () => { root.render(<Probe {...props} />); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const latest = () => seen[seen.length - 1];
const BODY = { asOf: '2026-10-21T17:15:00.000Z', out: { symbol: 'VLO', slot: 'core' }, rows: [{ symbol: 'XOM', status: 'available' }] };

beforeEach(() => {
  USER = { getIdToken: vi.fn(async () => 'token-1') };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  seen = [];
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('useCockpitBench', () => {
  it('closed: idle, no request, and no re-render for the hook', async () => {
    const request = vi.fn();
    await render({ battleId: 'b1', callId: null, open: false, request });
    expect(request).not.toHaveBeenCalled();
    expect(latest()).toEqual({ status: 'idle', data: null });
    expect(seen).toHaveLength(1);
  });

  it('open: loading, then the 200 body as read; scoped to the call', async () => {
    let resolve;
    const request = vi.fn(() => new Promise((r) => { resolve = r; }));
    await render({ battleId: 'b1', callId: 'b1:e:call:0', open: true, request });
    expect(request).toHaveBeenCalledWith({ battleId: 'b1', callId: 'b1:e:call:0' });
    expect(latest().status).toBe('loading');
    await act(async () => { resolve({ status: 'ready', data: BODY }); });
    expect(latest()).toEqual({ status: 'ready', data: BODY });
  });

  it('an error reads error; a reopen asks again', async () => {
    const request = vi.fn(async () => ({ status: 'error', data: null }));
    await render({ battleId: 'b1', callId: null, open: true, request });
    expect(latest().status).toBe('error');
    await render({ battleId: 'b1', callId: null, open: false, request });
    await render({ battleId: 'b1', callId: null, open: true, request });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('an answer that lands after the sheet closed is dropped', async () => {
    let resolve;
    const request = vi.fn(() => new Promise((r) => { resolve = r; }));
    await render({ battleId: 'b1', callId: null, open: true, request });
    await render({ battleId: 'b1', callId: null, open: false, request });
    await act(async () => { resolve({ status: 'ready', data: BODY }); });
    expect(latest()).toEqual({ status: 'idle', data: null });
  });

  it('review L7 C35b — a REJECTION that lands after the sheet closed is dropped too', async () => {
    let reject;
    const request = vi.fn(() => new Promise((_, rej) => { reject = rej; }));
    await render({ battleId: 'b1', callId: null, open: true, request });
    await render({ battleId: 'b1', callId: null, open: false, request });
    await act(async () => { reject(new Error('late')); });
    expect(latest()).toEqual({ status: 'idle', data: null });
  });
});

describe('requestCockpitBench', () => {
  const respond = (status, body) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
  it('GET with the bearer token, the battle and (scoped) the call; no-store', async () => {
    const fetchMock = respond(200, BODY);
    vi.stubGlobal('fetch', fetchMock);
    expect(await requestCockpitBench({ battleId: 'b 1', callId: 'c:1' })).toEqual({ status: 'ready', data: BODY });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${COCKPIT_BENCH_PATH}?battleId=b%201&callId=c%3A1`);
    expect(init).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer token-1' }, cache: 'no-store' });
    await requestCockpitBench({ battleId: 'b1' });
    expect(fetchMock.mock.calls[1][0]).toBe(`${COCKPIT_BENCH_PATH}?battleId=b1`);
  });
  it('a refusal, a malformed body, a network failure or no user → error', async () => {
    vi.stubGlobal('fetch', respond(404, { error: 'cockpit_unavailable' }));
    expect((await requestCockpitBench({ battleId: 'b1' })).status).toBe('error');
    vi.stubGlobal('fetch', respond(200, { rows: 'nope' }));
    expect((await requestCockpitBench({ battleId: 'b1' })).status).toBe('error');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await requestCockpitBench({ battleId: 'b1' })).status).toBe('error');
    USER = null;
    expect((await requestCockpitBench({ battleId: 'b1' })).status).toBe('error');
  });
});
