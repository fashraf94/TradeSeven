// @vitest-environment jsdom
//
// src/hooks/useCockpitStatus.jsdom.test.jsx
//
// Cockpit Build 2a — IS THIS BATTLE COCKPIT-ON? (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §4, S-6; ruling R2A-7). The client never
// decides: it asks GET /api/agent/cockpit-status and renders the answer.
// Disabled → nothing is requested; every error, refusal and malformed body
// reads off; only `{ on: true }` for THIS battle reads on; a battle status
// change and recheck() ask again.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

let USER = { getIdToken: vi.fn(async () => 'token-1') };
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: USER }) }));

import { useCockpitStatus, requestCockpitStatus, COCKPIT_STATUS_PATH } from './useCockpitStatus';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let latest;
function Probe({ battleId, enabled, battleStatus }) {
  latest = useCockpitStatus(battleId, { enabled, battleStatus });
  return null;
}
const render = async (props) => {
  await act(async () => { root.render(<Probe {...props} />); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const respond = (status, body) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));

beforeEach(() => {
  USER = { getIdToken: vi.fn(async () => 'token-1') };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('disabled — nothing is requested at all', () => {
  it('flag off / battle not active → no fetch, reads off', async () => {
    const fetchSpy = respond(200, { on: true });
    vi.stubGlobal('fetch', fetchSpy);
    await render({ battleId: 'ab-1', enabled: false, battleStatus: 'active' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(latest.on).toBe(false);
  });
  it('no battle id → no fetch', async () => {
    const fetchSpy = respond(200, { on: true });
    vi.stubGlobal('fetch', fetchSpy);
    await render({ battleId: null, enabled: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(latest.on).toBe(false);
  });
});

describe('enabled — the server answers, the screen renders the answer', () => {
  it('asks the status route for THIS battle with the caller\'s token, uncached; { on: true } → on', async () => {
    const fetchSpy = respond(200, { on: true });
    vi.stubGlobal('fetch', fetchSpy);
    await render({ battleId: 'ab 1', enabled: true, battleStatus: 'active' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${COCKPIT_STATUS_PATH}?battleId=ab%201`);
    expect(init).toEqual({ method: 'GET', headers: { Authorization: 'Bearer token-1' }, cache: 'no-store' });
    expect(latest.on).toBe(true);
  });

  it('unknown reads off until the answer arrives (no layout change on a guess)', async () => {
    let release;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { release = r; })));
    await act(async () => { root.render(<Probe battleId="ab-1" enabled battleStatus="active" />); });
    expect(latest.on).toBe(false);
    await act(async () => { release({ ok: true, status: 200, json: async () => ({ on: true }) }); await Promise.resolve(); await Promise.resolve(); });
    expect(latest.on).toBe(true);
  });

  it.each([
    ['{ on: false }', 200, { on: false }],
    ['a truthy non-boolean', 200, { on: 'yes' }],
    ['a malformed body', 200, null],
    ['401', 401, { error: 'unauthorized' }],
    ['403', 403, { error: 'forbidden' }],
    ['404', 404, { error: 'not_found' }],
    ['429', 429, { error: 'rate_limited' }],
    ['500', 500, {}],
  ])('%s → off', async (_label, status, body) => {
    vi.stubGlobal('fetch', respond(status, body));
    await render({ battleId: 'ab-1', enabled: true, battleStatus: 'active' });
    expect(latest.on).toBe(false);
  });

  it('a network failure → off; no signed-in user → off without a request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await requestCockpitStatus('ab-1')).toBe(false);
    USER = null;
    const fetchSpy = respond(200, { on: true });
    vi.stubGlobal('fetch', fetchSpy);
    expect(await requestCockpitStatus('ab-1')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('re-runs when the battle\'s status changes, and on recheck()', async () => {
    const fetchSpy = respond(200, { on: true });
    vi.stubGlobal('fetch', fetchSpy);
    await render({ battleId: 'ab-1', enabled: true, battleStatus: 'active' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await render({ battleId: 'ab-1', enabled: true, battleStatus: 'paused' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await act(async () => { latest.recheck(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('an answer counts only for the battle it was asked about, and only while enabled', async () => {
    vi.stubGlobal('fetch', respond(200, { on: true }));
    await render({ battleId: 'ab-1', enabled: true, battleStatus: 'active' });
    expect(latest.on).toBe(true);
    let release;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { release = r; })));
    await act(async () => { root.render(<Probe battleId="ab-2" enabled battleStatus="active" />); });
    expect(latest.on).toBe(false); // ab-1's answer is not ab-2's
    await act(async () => { release({ ok: true, status: 200, json: async () => ({ on: true }) }); await Promise.resolve(); await Promise.resolve(); });
    expect(latest.on).toBe(true);
    await render({ battleId: 'ab-2', enabled: false, battleStatus: 'active' });
    expect(latest.on).toBe(false);
  });
});
