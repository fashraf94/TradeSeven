// @vitest-environment jsdom
//
// src/hooks/useHubResearchAdmission.jsdom.test.jsx
//
// Command Center core spec V1.2, Amendment E V1.1 §1 (ruling R-D4) — who the research door admits, against the REAL verdict
// reader and its cache (src/utils/filmRoomGate.js). Only the network is a stand-in: firebase/auth's current user and a fetch
// recorder that answers GET /api/agent/cockpit-status (no request leaves the test).
//   'off'        not admitted, no request.
//   'on'         admitted, no request.
//   'allowlist'  one verdict request with the owned agent battle id, then cached for a second mount; no battle → not admitted
//                and no request; a false verdict → not admitted; until the answer, not admitted; a failed ask → not admitted.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: { getIdToken: async () => 'token' } }) }));

import useHubResearchAdmission from './useHubResearchAdmission';
import { FILM_ROOM_VERDICT_PATH, resetFilmRoomVerdicts } from '../utils/filmRoomGate';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const A = Object.freeze({ signedIn: true, uid: 'uid-A', authEpoch: 2 });
const B = Object.freeze({ signedIn: true, uid: 'uid-B', authEpoch: 3 });
const flush = () => act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });

let answer;
let fetchSpy;
let mounted = [];
beforeEach(() => {
  resetFilmRoomVerdicts();
  answer = { status: 200, body: { on: false, allowlisted: true, serverNowMs: 0 } };
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({ ok: answer.status === 200, status: answer.status, json: async () => answer.body }));
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  fetchSpy.mockRestore();
  resetFilmRoomVerdicts();
});

function mount(props) {
  const seen = [];
  function Probe(p) { seen.push(useHubResearchAdmission(p)); return null; }
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<Probe {...props} />); });
  const m = {
    seen,
    admitted: () => seen[seen.length - 1].admitted,
    rerender: (next) => act(() => { root.render(<Probe {...next} />); }),
    unmount: () => { act(() => { root.unmount(); }); host.remove(); },
  };
  mounted.push(m);
  return m;
}
const verdictCalls = () => fetchSpy.mock.calls.filter(([url]) => String(url).startsWith(FILM_ROOM_VERDICT_PATH));

describe("'off' and 'on' send nothing", () => {
  it("'off': not admitted and no request, whatever battle the hub holds", async () => {
    const m = mount({ mode: 'off', auth: A, battleId: 'ab_1' });
    await flush();
    expect(m.admitted()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("'on': admitted at once, with no request (the server's own admission still decides)", async () => {
    const m = mount({ mode: 'on', auth: A, battleId: null });
    expect(m.seen.every((out) => out.admitted === true)).toBe(true);
    await flush();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("'on' with no signed-in player: not admitted", async () => {
    const m = mount({ mode: 'on', auth: { signedIn: false }, battleId: null });
    await flush();
    expect(m.admitted()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a mode outside the walked three is no admission and no request (ConnectedHub maps it to off before; the hook holds too)', async () => {
    const m = mount({ mode: 'ON', auth: A, battleId: 'ab_1' });
    await flush();
    expect(m.admitted()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("'allowlist': the cached cockpit-status verdict for an owned agent battle", () => {
  it('one request, for the owned battle id, and admitted on a definite yes — not before the answer', async () => {
    const m = mount({ mode: 'allowlist', auth: A, battleId: 'ab_live_1' });
    expect(m.seen[0].admitted).toBe(false);
    await flush();
    expect(verdictCalls()).toHaveLength(1);
    expect(verdictCalls()[0][0]).toBe(`${FILM_ROOM_VERDICT_PATH}?battleId=ab_live_1`);
    expect(m.admitted()).toBe(true);
  });

  it('cached for a second mount: admitted from its first render, and no second request', async () => {
    const first = mount({ mode: 'allowlist', auth: A, battleId: 'ab_live_1' });
    await flush();
    expect(first.admitted()).toBe(true);
    first.unmount();
    mounted = mounted.filter((x) => x !== first);
    const second = mount({ mode: 'allowlist', auth: A, battleId: 'ab_live_1' });
    expect(second.seen[0].admitted).toBe(true);
    await flush();
    expect(verdictCalls()).toHaveLength(1);
  });

  it('the verdict is the owner\'s: another battle id of the same owner asks nothing new', async () => {
    const m = mount({ mode: 'allowlist', auth: A, battleId: 'ab_live_1' });
    await flush();
    m.rerender({ mode: 'allowlist', auth: A, battleId: 'ab_done_7' });
    await flush();
    expect(verdictCalls()).toHaveLength(1);
    expect(m.admitted()).toBe(true);
  });

  it('no owned battle: not admitted, and no request', async () => {
    const m = mount({ mode: 'allowlist', auth: A, battleId: null });
    await flush();
    expect(m.admitted()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a battle that arrives later (the window answers after the first render) is asked about then, once', async () => {
    const m = mount({ mode: 'allowlist', auth: A, battleId: null });
    await flush();
    m.rerender({ mode: 'allowlist', auth: A, battleId: 'ab_done_7' });
    await flush();
    expect(verdictCalls()).toHaveLength(1);
    expect(m.admitted()).toBe(true);
  });

  it('a false verdict: not admitted', async () => {
    answer = { status: 200, body: { on: false, allowlisted: false, serverNowMs: 0 } };
    const m = mount({ mode: 'allowlist', auth: A, battleId: 'ab_live_1' });
    await flush();
    expect(verdictCalls()).toHaveLength(1);
    expect(m.admitted()).toBe(false);
  });

  it('a refused or failed ask (403, a malformed body): not admitted', async () => {
    answer = { status: 403, body: { error: 'forbidden' } };
    const refused = mount({ mode: 'allowlist', auth: A, battleId: 'ab_other' });
    await flush();
    expect(refused.admitted()).toBe(false);
    resetFilmRoomVerdicts();
    answer = { status: 200, body: { on: true } };
    const malformed = mount({ mode: 'allowlist', auth: B, battleId: 'ab_b' });
    await flush();
    expect(malformed.admitted()).toBe(false);
  });

  it('an owner change: the former owner\'s yes is never the new owner\'s; the new owner is asked for itself', async () => {
    const m = mount({ mode: 'allowlist', auth: A, battleId: 'ab_live_1' });
    await flush();
    expect(m.admitted()).toBe(true);
    answer = { status: 200, body: { on: false, allowlisted: false, serverNowMs: 0 } };
    const before = m.seen.length;
    m.rerender({ mode: 'allowlist', auth: B, battleId: 'ab_b_1' });
    expect(m.seen.slice(before).every((out) => out.admitted === false)).toBe(true);
    await flush();
    expect(verdictCalls()).toHaveLength(2);
    expect(verdictCalls()[1][0]).toBe(`${FILM_ROOM_VERDICT_PATH}?battleId=ab_b_1`);
    expect(m.admitted()).toBe(false);
  });

  it('the mode moving to off while admitted: not admitted, at once', async () => {
    const m = mount({ mode: 'allowlist', auth: A, battleId: 'ab_live_1' });
    await flush();
    expect(m.admitted()).toBe(true);
    m.rerender({ mode: 'off', auth: A, battleId: 'ab_live_1' });
    expect(m.admitted()).toBe(false);
  });
});
