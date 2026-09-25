// @vitest-environment jsdom
// src/hooks/useBackingWallet.subscription.test.jsx
//
// The activation PR (DEV-5 / SCRIPT-04 in its review record): the wallet
// DOCUMENT the hook subscribes to is the one the pod list names — a founder
// smoke session's `dev-{uid}`, where its smoke stakes debit — else the
// viewer's own uid, exactly as before. A name that arrives later re-subscribes
// (the list resolves after the first render); an empty name is no name.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const svc = vi.hoisted(() => ({ subs: [], unsubs: [] }));
vi.mock('../services/backingService', () => ({
  subscribeWallet: (id, cb) => {
    svc.subs.push(id);
    cb({ id, lastAllowanceWeek: '2026-W40', allowanceRemaining: id.startsWith('dev-') ? 750 : 1000 }, null);
    return () => svc.unsubs.push(id);
  },
}));

const { default: useBackingWallet } = await import('./useBackingWallet');

let latest = null;
function Probe({ uid, walletId }) {
  latest = useBackingWallet(uid, '2026-W40', true, walletId);
  return null;
}
const roots = [];
async function mount(props) {
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => { root.render(<Probe {...props} />); });
  roots.push(root);
  return { rerender: async (next) => { await act(async () => { root.render(<Probe {...next} />); }); } };
}
beforeEach(() => { svc.subs.length = 0; svc.unsubs.length = 0; latest = null; });
afterEach(async () => { for (const r of roots.splice(0)) await act(async () => { r.unmount(); }); });

describe('the wallet document the hook reads', () => {
  it("the viewer's own uid when the list names none — today's behaviour, byte for byte", async () => {
    await mount({ uid: 'u1' });
    expect(svc.subs).toEqual(['u1']);
    expect(latest.left).toBe(1000);
    expect(latest.known).toBe(true);
  });

  it("the NAMED document (a smoke session's dev-{uid}) when the list names one — and it re-subscribes when the name arrives", async () => {
    const h = await mount({ uid: 'u1', walletId: null });
    expect(svc.subs).toEqual(['u1']);
    await h.rerender({ uid: 'u1', walletId: 'dev-u1' });
    expect(svc.unsubs).toEqual(['u1']);
    expect(svc.subs).toEqual(['u1', 'dev-u1']);
    expect(latest.wallet.id).toBe('dev-u1');
    expect(latest.left).toBe(750);
    // An unchanged name re-subscribes nothing.
    await h.rerender({ uid: 'u1', walletId: 'dev-u1' });
    expect(svc.subs).toEqual(['u1', 'dev-u1']);
  });

  it('an empty or non-string name is no name: the uid', async () => {
    await mount({ uid: 'u1', walletId: '' });
    expect(svc.subs).toEqual(['u1']);
    await mount({ uid: 'u2', walletId: 42 });
    expect(svc.subs).toEqual(['u1', 'u2']);
  });
});
