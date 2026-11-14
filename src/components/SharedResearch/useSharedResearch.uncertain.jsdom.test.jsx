// @vitest-environment jsdom
//
// Shared Research B2 — the hook's own guard on an uncertain save (K-8: never a retry before the check). The
// screen offers no Save while the save is uncertain; this row calls the hook directly, as any future caller
// could, and proves adopt() sends nothing until "Check the record" has answered.

import React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchWithAuth = vi.hoisted(() => vi.fn());
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth }));
vi.mock('../../services/hypothesisVersionService', () => ({ transitionHypothesis: vi.fn() }));
vi.mock('../../services/loadoutService', () => ({ equipLoadoutBook: vi.fn() }));

const { default: useSharedResearch } = await import('./useSharedResearch');
const { A, IDS, NETWORK, fakeServer, mount, flush } = await import('./__fixtures__/srKit');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mounted = [];
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); });

function Probe({ onHook }) {
  const sr = useSharedResearch({});
  onHook(sr);
  return null;
}

describe('one request at a time, in the hook itself', () => {
  it('two step() calls in the same tick send ONE request (the disabled button is not the only guard)', async () => {
    let release;
    const held = new Promise((r) => { release = r; });
    const server = fakeServer({ get: A.getStepped, step: () => held.then(() => A.stepNext) });
    fetchWithAuth.mockImplementation(server.fetch);
    let sr;
    mounted.push(mount(<Probe onHook={(h) => { sr = h; }} />));
    await act(async () => { await sr.loadSession(IDS.dcSid); });
    let both;
    await act(async () => { both = Promise.all([sr.step({ intent: 'next' }), sr.step({ intent: 'next' })]); await Promise.resolve(); });
    expect(server.sent('step')).toHaveLength(1);
    await act(async () => { release(); await both; });
    expect(server.sent('step')).toHaveLength(1);
  });
});

describe('adopt() while the save is uncertain', () => {
  it('sends nothing until checkSave has read the record; after "nothing was created" it may send again', async () => {
    const server = fakeServer({ get: [A.getShopPay, A.getShopPay], adopt: [NETWORK, A.adoptSaved] });
    fetchWithAuth.mockImplementation(server.fetch);
    let sr;
    mounted.push(mount(<Probe onHook={(h) => { sr = h; }} />));
    await act(async () => { await sr.loadSession(IDS.spSid); });
    const input = { statement: A.getShopPay.body.adoptPreview.draft, horizonEnum: 'swing', symbols: ['SHOP', 'AAPL'], activation: [], invalidation: [] };
    await act(async () => { await sr.adopt(input); });
    expect(sr.save.status).toBe('uncertain');
    await act(async () => { await sr.adopt(input); });
    await act(async () => { await sr.adopt(input); });
    expect(server.sent('adopt')).toHaveLength(1);
    await act(async () => { await sr.checkSave(); });
    await flush();
    expect(sr.save.status).toBe('notsaved');
    await act(async () => { await sr.adopt(input); });
    expect(server.sent('adopt')).toHaveLength(2);
    expect(sr.save.status).toBe('saved');
  });
});
