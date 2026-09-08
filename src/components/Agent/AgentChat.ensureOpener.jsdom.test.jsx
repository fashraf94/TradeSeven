// @vitest-environment jsdom
//
// src/components/Agent/AgentChat.ensureOpener.jsdom.test.jsx
//
// The lazy opener backfill's REQUEST, and the two callers that make it.
//
// `POST /api/agent/ensure-opener` verifies the agent binding unconditionally
// (api/agent/ensure-opener.js — the same shared predicate chat.js and
// file-directive.js call), so a call that names no agent is a 403. Both shipped
// callers are this component, mounted twice by AgentBattleScreen.jsx — the
// Battle View controller column and the arena's Command Center tab — and both
// hand it the battle's own `agentBattle.agentId`. These rows hold that pair
// together: a source row per caller proving the prop is passed, and behaviour
// rows proving what the component then sends.
//
// The one-shot dedupe (`attemptedOpenerBattleIds`) is MODULE-scoped and
// survives between rows on purpose, so every row uses its own battleId.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token-1' } })),
}));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';
import { OPENER_LAZY_FALLBACK_ENABLED } from '../../config/featureFlags';

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

const BASE = {
  agentName: 'Vega', chatExchanges: [], battleStatus: 'active', statusFeed: [],
  trades: [], knownTickers: new Set(), chatBudgetUsed: 0,
};
const render = async (props) => {
  await act(async () => {
    root.render(<AgentChat {...BASE} {...props} />);
    await Promise.resolve();
    await Promise.resolve();
  });
};
const stubFetch = () => {
  const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 'generated' }) }));
  vi.stubGlobal('fetch', spy);
  return spy;
};
const openerCalls = (spy) => spy.mock.calls.filter(([url]) => url === '/api/agent/ensure-opener');

// ── The two callers, at their mount sites ───────────────────────────────────
//
// The screen is the caller; this component is the wire. A third mount added
// without the prop would send `{ battleId }` and take a 403 for an opener that
// would otherwise have been backfilled, so the mounts are counted, not just
// scanned.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREEN = readFileSync(path.join(HERE, '..', '..', 'screens', 'AgentBattleScreen.jsx'), 'utf8');
const MOUNTS = SCREEN.split('<AgentChat').slice(1);

describe('the two callers each hand the battle\'s agentId to the chat', () => {
  it('AgentBattleScreen mounts AgentChat exactly twice — the Battle View controller column and the arena Command Center tab', () => {
    expect(MOUNTS).toHaveLength(2);
  });

  it.each([
    ['the Battle View controller column', 0],
    ['the arena Command Center tab', 1],
  ])('%s passes agentId={agentBattle?.agentId} beside battleId', (_label, index) => {
    // The window is the whole JSX opening element: up to the `/>` that CLOSES
    // it, which is the only one at the start of a line. Splitting on the first
    // `>` instead truncated mount 1 after nine lines — at the `>` inside
    // `onSwitchToGameTape={() => …}` — so a prop moved below it read as absent.
    const props = MOUNTS[index].split(/\n\s*\/>/)[0];
    expect(props).toContain('battleId={agentBattleId}');
    expect(props).toContain('agentId={agentBattle?.agentId}');
    // The window really is the element, not a fragment of it: every mount ends
    // with the chat's own props, so a truncated window would fail this too.
    expect(props).toContain('chatExchanges={chatExchanges}');
  });
});

describe('what the chat then sends', () => {
  it('the backfill POSTs { battleId, agentId } — the id the route\'s binding check reads', async () => {
    const spy = stubFetch();
    await render({ battleId: 'ab-send-1', agentId: 'agent-send-1' });
    const calls = openerCalls(spy);
    expect(calls).toHaveLength(1);
    const [, init] = calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ battleId: 'ab-send-1', agentId: 'agent-send-1' });
    expect(init.headers.Authorization).toBe('Bearer token-1');
  });

  it('NO agentId yet (the subscribed doc has not landed) → no call, and the one-shot is not burned', async () => {
    const spy = stubFetch();
    await render({ battleId: 'ab-send-2', agentId: undefined });
    expect(openerCalls(spy)).toHaveLength(0);
    // The effect re-runs when the doc arrives and fires then — a render without
    // the id must not spend the battle's single attempt on a guaranteed 403.
    await render({ battleId: 'ab-send-2', agentId: 'agent-send-2' });
    const calls = openerCalls(spy);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1].body)).toEqual({ battleId: 'ab-send-2', agentId: 'agent-send-2' });
  });

  it('the one-shot still holds: a remount for the same battle does not re-POST', async () => {
    const spy = stubFetch();
    await render({ battleId: 'ab-send-3', agentId: 'agent-send-3' });
    await act(async () => { root.unmount(); });
    root = createRoot(container);
    await render({ battleId: 'ab-send-3', agentId: 'agent-send-3' });
    expect(openerCalls(spy)).toHaveLength(1);
  });

  it('the flag is the outer gate, and it ships TRUE (the live-state pin)', () => {
    // The value pin BUILD_RULES §2 asks a flip commit to reconcile — pointed at
    // from the flag's definition, so flagPinGuard.test.js keeps the pair honest
    // and a walk-back reds here with a file:line rather than silently.
    expect(OPENER_LAZY_FALLBACK_ENABLED).toBe(true);
  });

  it('an existing first_message means nothing to backfill', async () => {
    const spy = stubFetch();
    await render({
      battleId: 'ab-send-4', agentId: 'agent-send-4',
      chatExchanges: [{ messageType: 'first_message', agentResponse: 'Deployed.', timestamp: '2026-09-08T14:00:00.000Z' }],
    });
    expect(openerCalls(spy)).toHaveLength(0);
  });
});
