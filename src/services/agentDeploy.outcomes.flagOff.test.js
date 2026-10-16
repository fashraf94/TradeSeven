// src/services/agentDeploy.outcomes.flagOff.test.js
//
// Command Center repair R1 (review L5-9) — the identity guard with the
// casual-clone flag OFF (no clone ensure): the uid captured at entry is still
// checked after the token, after the POST and after the body read, and the
// created path is the legacy one, ranked agent only.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getIdTokenMock, auth } = vi.hoisted(() => ({ getIdTokenMock: vi.fn(), auth: { uid: 'uid-A' } }));
vi.mock('../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), CASUAL_CLONE_CONCURRENCY_ENABLED: false }));
vi.mock('../firebase/authService', () => ({
  getIdToken: getIdTokenMock,
  getCurrentUser: () => (auth.uid ? { uid: auth.uid } : null),
}));

const { deployAgent } = await import('./agentDeploy');

const RANKED = 'agent-ranked-1';
const CREATED_200 = { success: true, battleCreated: true, agentBattleId: 'battle-new', portfolio: {}, bench: {} };
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) });

let reported;
const run = (cb) => deployAgent(RANKED, cb, (id) => reported.push(id));

beforeEach(() => {
  auth.uid = 'uid-A';
  reported = [];
  getIdTokenMock.mockReset();
  getIdTokenMock.mockResolvedValue('tok');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); delete globalThis.fetch; });

describe('the identity guard with the casual clone off (review L5-9)', () => {
  it('created: one POST for the ranked agent, no clone ensure, the hand-off gets the captured owner', async () => {
    globalThis.fetch = vi.fn(async () => json(200, CREATED_200));
    const cb = vi.fn();
    expect(await run(cb)).toEqual({ outcome: 'created', success: true, agentBattleId: 'battle-new' });
    expect(globalThis.fetch.mock.calls.map(([url]) => url)).toEqual(['/api/agent/decide']);
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({ agentId: RANKED });
    expect(reported).toEqual([RANKED]);
    expect(cb.mock.calls[0][2]).toMatchObject({ agentId: RANKED, agentBattleId: 'battle-new', ownerUid: 'uid-A' });
  });

  it('after the token: another account → orphaned, no POST', async () => {
    getIdTokenMock.mockImplementation(async () => { auth.uid = 'uid-B'; return 'tok'; });
    globalThis.fetch = vi.fn(async () => json(200, CREATED_200));
    expect(await run(vi.fn())).toEqual({ outcome: 'orphaned', success: false, postIssued: false });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('after the POST: orphaned with postIssued true, no hand-off', async () => {
    globalThis.fetch = vi.fn(async () => { auth.uid = 'uid-B'; return json(200, CREATED_200); });
    const cb = vi.fn();
    expect(await run(cb)).toEqual({ outcome: 'orphaned', success: false, postIssued: true });
    expect(cb).not.toHaveBeenCalled();
  });

  it('after the body read: orphaned, no hand-off', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => { auth.uid = null; return JSON.stringify(CREATED_200); } }));
    const cb = vi.fn();
    expect(await run(cb)).toEqual({ outcome: 'orphaned', success: false, postIssued: true });
    expect(cb).not.toHaveBeenCalled();
  });
});
