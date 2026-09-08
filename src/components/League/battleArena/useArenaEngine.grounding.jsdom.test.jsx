// @vitest-environment jsdom
//
// src/components/League/battleArena/useArenaEngine.grounding.jsdom.test.jsx
//
// Voice-layer grounding §6.2 / §6.3 / §8 — the HOOK's wiring (review R-27:
// the dock rows call a `fileLive` spy and the reducers are pinned, but the
// hook joining them was unguarded). Proved here: a shipped answer leaves the
// engine's chips, status line and belief untouched; a grounded answer feeds
// all three; `fileLive` posts to the deterministic route with the chip's id
// and the server-fed belief, never the ask route; a 200 lands the receipt
// from the route's own response; a 409 adopts the server's current thread; a
// 429 lands the counter; a battle change resets the three fields.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FILING_CONFLICT_LINE, FILING_BUDGET_LINE, filedLabel } from '../../../data/decisionRecord';
import { etTime } from '../../Dashboard/desk/deskCopy';

// The hook lazy-imports the REAL fetchWithAuth (its static graph stays
// node-clean); the token read under it is mocked and the global fetch is
// stubbed, so every request the hook makes is observed as the network sees it
// — url, method, body — never through a second fetch helper.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: { impl: null, calls: [] } }));
vi.mock('../../../firebase/authService', () => ({ getIdToken: async () => 'token-1' }));
vi.stubGlobal('fetch', async (url, init) => { fetchMock.calls.push([url, init]); return fetchMock.impl(url, init); });
vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  LEAGUE_AGENT_CHAT_ENABLED: true,
}));

import { useArenaEngine } from './useArenaEngine';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
}

const VOICE = { greet: { kind: 'greeting', text: 'live' }, live: [] };
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const BUDGET = { remaining: 5 };

let container;
let root;
let latest;
function Probe({ battleId }) {
  latest = useArenaEngine({ active: true, voice: VOICE, beats: [], ask: [], live: true, liveBeats: [], battleId, agentId: 'agent-1' });
  return null;
}
const mount = (battleId = 'b1') => act(() => { root.render(<Probe battleId={battleId} />); });
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const callsTo = (path) => fetchMock.calls.filter(([url]) => url === path);

beforeEach(async () => {
  fetchMock.calls = [];
  fetchMock.impl = async (url) => (url.startsWith('/api/agent/chat-budget') ? json(200, BUDGET) : json(500, {}));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await mount();
  await settle(); // the on-open budget read
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useArenaEngine — the grounded answer and the chip filing', () => {
  it('a SHIPPED answer leaves chips empty, no status line, the belief untouched', async () => {
    fetchMock.impl = async (url) => (url === '/api/agent/chat' ? json(200, { agentMessage: 'Holding.', remaining: 4, suggestedActions: ['a string chip'] }) : json(200, BUDGET));
    await act(async () => { await latest.askLive('plan?'); });
    expect(latest.chips).toEqual([]);
    expect(latest.lines[0]).toMatchObject({ kind: 'answer', text: 'Holding.' });
    expect('statusLine' in latest.lines[0]).toBe(false);
    expect(latest.currentDirectiveThreadId).toBeNull();
    expect(latest.remaining).toBe(4);
  });

  it('a GROUNDED answer feeds the chips, the status line and the belief', async () => {
    const chips = [{ kind: 'directive', id: 'DV-02', text: 'Widen the spread (target more sectors)' }, { kind: 'ask', text: 'Why?' }];
    fetchMock.impl = async (url) => (url === '/api/agent/chat'
      ? json(200, { agentMessage: 'Two ways.', remaining: 4, grounded: true, suggestedActions: chips, directiveStatusLine: 'No change made to your strategy this turn.', currentDirectiveThreadId: 'thread-A' })
      : json(200, BUDGET));
    await act(async () => { await latest.askLive('plan?'); });
    expect(latest.chips).toEqual(chips);
    expect(latest.lines[0].statusLine).toBe('No change made to your strategy this turn.');
    expect(latest.currentDirectiveThreadId).toBe('thread-A');
  });

  it('fileLive posts the chip id and the server-fed belief to the deterministic route — never the ask route — and a 200 lands the receipt from the response', async () => {
    fetchMock.impl = async (url) => (url === '/api/agent/chat'
      ? json(200, { agentMessage: 'Two ways.', grounded: true, suggestedActions: [{ kind: 'directive', id: 'DV-02', text: 'Widen the spread (target more sectors)' }], currentDirectiveThreadId: 'thread-A' })
      : url === '/api/agent/file-directive'
        ? json(200, { status: 'replaced-prior', directive: { text: 'Widen the spread (target more sectors)', directiveThreadId: 'thread-B', createdAt: '2026-09-08T15:20:00.000Z' }, replacedDirectiveThreadId: 'thread-A', remaining: 3 })
        : json(200, BUDGET));
    await act(async () => { await latest.askLive('plan?'); });
    await act(async () => { await latest.fileLive('DV-02'); });
    const [url, init] = callsTo('/api/agent/file-directive')[0];
    expect(url).toBe('/api/agent/file-directive');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    expect(JSON.parse(init.body)).toEqual({ agentId: 'agent-1', battleId: 'b1', adjustmentId: 'DV-02', expectedDirectiveThreadId: 'thread-A' });
    expect(callsTo('/api/agent/chat')).toHaveLength(1); // the ask, not the filing
    expect(latest.lines[0]).toMatchObject({ kind: 'directive', text: 'Widen the spread (target more sectors)', t: filedLabel(etTime('2026-09-08T15:20:00.000Z')) });
    expect(latest.lines[0].t).toBe('Filed 11:20 AM');
    expect(latest.chips).toEqual([]);
    expect(latest.currentDirectiveThreadId).toBe('thread-B');
    expect(latest.remaining).toBe(3);
    expect(latest.filing).toBe(false);
    expect(latest.filingError).toBeNull();
  });

  it('a 409 holds the ruled line, keeps the chips and ADOPTS the server\'s current thread; a 429 lands the counter', async () => {
    const chips = [{ kind: 'directive', id: 'DV-02', text: 'Widen the spread (target more sectors)' }];
    fetchMock.impl = async (url) => (url === '/api/agent/chat'
      ? json(200, { agentMessage: 'Two ways.', grounded: true, suggestedActions: chips, currentDirectiveThreadId: null })
      : url === '/api/agent/file-directive'
        ? json(409, { error: 'conflict', status: 'conflict', currentDirectiveThreadId: 'thread-Z' })
        : json(200, BUDGET));
    await act(async () => { await latest.askLive('plan?'); });
    await act(async () => { await latest.fileLive('DV-02'); });
    expect(latest.filingError).toBe(FILING_CONFLICT_LINE);
    expect(latest.chips).toEqual(chips);
    expect(latest.currentDirectiveThreadId).toBe('thread-Z');
    expect(latest.lines[0].kind).toBe('answer'); // no lane line for a failure
    // The retry files against the truth.
    fetchMock.impl = async (url) => (url === '/api/agent/file-directive' ? json(429, { error: 'budget_exhausted', status: 'budget-exhausted', remaining: 0 }) : json(200, BUDGET));
    await act(async () => { await latest.fileLive('DV-02'); });
    expect(JSON.parse(callsTo('/api/agent/file-directive')[1][1].body).expectedDirectiveThreadId).toBe('thread-Z');
    expect(latest.filingError).toBe(FILING_BUDGET_LINE);
    expect(latest.remaining).toBe(0);
  });

  it('a battle change resets the chips, the belief and the failure line with the counter (review R-17)', async () => {
    fetchMock.impl = async (url) => (url === '/api/agent/chat'
      ? json(200, { agentMessage: 'Two ways.', grounded: true, suggestedActions: [{ kind: 'ask', text: 'Why?' }], currentDirectiveThreadId: 'thread-A' })
      : url === '/api/agent/file-directive' ? json(409, { currentDirectiveThreadId: 'thread-Z' }) : json(200, BUDGET));
    await act(async () => { await latest.askLive('plan?'); });
    await act(async () => { await latest.fileLive('DV-02'); });
    expect(latest.chips).toHaveLength(1);
    expect(latest.filingError).toBe(FILING_CONFLICT_LINE);
    await mount('b2');
    await settle();
    expect(latest.chips).toEqual([]);
    expect(latest.currentDirectiveThreadId).toBeNull();
    expect(latest.filingError).toBeNull();
  });
});
