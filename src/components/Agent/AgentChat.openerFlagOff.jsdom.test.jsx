// @vitest-environment jsdom
//
// src/components/Agent/AgentChat.openerFlagOff.jsdom.test.jsx
//
// The CLIENT half of the lazy opener's kill switch — the half nothing covered.
//
// `api/agent/ensure-opener.flagoff.test.js` proves the SERVER no-ops when
// OPENER_LAZY_FALLBACK_ENABLED is off. The client's own gate — the guard that
// stops the request being made at all, and the reason the flag can be flipped
// without the endpoint seeing traffic — had no row: deleting
// `if (!OPENER_LAZY_FALLBACK_ENABLED) return;` from AgentChat.jsx left the whole
// suite green. This file is that guard's row, in its own file because the flag
// is read at module scope and has to be mocked before the component loads.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token-1' } })),
}));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

// The REAL flags module with the one flag under test forced OFF — the
// ensure-opener.flagoff.test.js idiom, so the Node-clean dependency-surface
// guard on featureFlags.js still holds.
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  OPENER_LAZY_FALLBACK_ENABLED: false,
}));

import AgentChat from './AgentChat';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
}

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('the lazy opener kill switch, client side', () => {
  it('flag OFF: an empty active battle makes NO ensure-opener call', async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal('fetch', spy);
    await act(async () => {
      root.render(
        <AgentChat
          battleId="ab-flagoff-1"
          agentId="agent-flagoff-1"
          agentName="Vega"
          chatExchanges={[]}
          battleStatus="active"
          statusFeed={[]}
          trades={[]}
          knownTickers={new Set()}
          chatBudgetUsed={0}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    // Not "no POST to ensure-opener" — NO fetch at all: the gate returns before
    // the auth read, so the flag-off client is byte-identical to the pre-build
    // client on mount.
    expect(spy.mock.calls.filter(([url]) => url === '/api/agent/ensure-opener')).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
