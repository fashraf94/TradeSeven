// @vitest-environment jsdom
//
// src/components/Agent/AgentChat.chips.jsdom.test.jsx
//
// Voice-layer grounding §6.2 / §6.3 on the Battle View chat (spec §10's rows):
// a minted `directive` chip renders `Files: {canonical text}` and its tap hits
// the deterministic route with the chip's id and the client's belief about the
// current directive — NEVER the chat route; an `ask` chip and a shipped string
// chip send to the chat as today; a filing renders NOTHING from the response
// (the receipt is derived from the exchange the route writes); a failure
// renders only what the client can be held to; the no-change status renders
// only from a persisted grounded exchange on which the gate ran and wrote no
// directive.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token-1' } })),
}));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';
import { BATTLE_VIEW_COPY as COPY } from '../../screens/battleView/battleViewCopy';
import {
  FILING_CONFLICT_LINE,
  FILING_BUDGET_LINE,
  FILING_FAILED_LINE,
  NO_CHANGE_STATUS_LINE,
} from '../../data/decisionRecord';

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

const DV02 = 'Widen the spread (target more sectors)';
const MINTED = [
  { kind: 'directive', id: 'DV-02', text: DV02 },
  { kind: 'ask', text: 'Why the spread?' },
];
const lastAgentMessage = (over = {}) => ({
  userMessage: 'What would you file?', agentResponse: 'Two ways to shape the next checks.',
  timestamp: '2026-09-08T15:05:00.000Z', mode: 'battle', suggestedActions: MINTED, groundingVersion: 1, ...over,
});
const BASE = {
  battleId: 'ab-1', agentId: 'agent-1', agentName: 'Vega',
  chatExchanges: [], battleStatus: 'active', statusFeed: [], trades: [],
  knownTickers: new Set(), chatBudgetUsed: 2,
};
const render = (props = {}) => act(() => { root.render(<AgentChat {...BASE} {...props} />); });
const buttons = () => [...container.querySelectorAll('button')];
const chipButton = (label) => buttons().find((b) => b.textContent === label);
const click = async (button) => {
  expect(button).toBeTruthy();
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
};
const stubFetch = (impl) => { const spy = vi.fn(impl); vi.stubGlobal('fetch', spy); return spy; };
const jsonResponse = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('chips minted by id — the labels', () => {
  it('a directive chip reads `Files: {canonical text}`; an ask chip reads its question; a string chip is the shipped chip', () => {
    render({ chatExchanges: [lastAgentMessage({ suggestedActions: [...MINTED, 'Show me the checks'] })] });
    expect(chipButton(COPY.filesChip(DV02))).toBeTruthy();
    expect(chipButton('Why the spread?')).toBeTruthy();
    expect(chipButton('Show me the checks')).toBeTruthy();
    expect(container.textContent).not.toContain('[object Object]');
  });

  it('a chip of an unknown kind renders nothing rather than a guess', () => {
    render({ chatExchanges: [lastAgentMessage({ suggestedActions: [{ kind: 'weather', text: 'sunny' }, { kind: 'ask', text: 'ok?' }] })] });
    expect(container.textContent).not.toContain('sunny');
    expect(chipButton('ok?')).toBeTruthy();
  });
});

describe('chips minted by id — the taps', () => {
  it('a directive chip hits /api/agent/file-directive with its id and the current belief — never the chat route', async () => {
    const fetchSpy = stubFetch(async () => jsonResponse(200, { status: 'filed', directive: { text: DV02 }, remaining: 7 }));
    render({ chatExchanges: [lastAgentMessage()], currentDirectiveThreadId: 'thread-A' });
    await click(chipButton(COPY.filesChip(DV02)));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/agent/file-directive');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    expect(JSON.parse(init.body)).toEqual({ agentId: 'agent-1', battleId: 'ab-1', adjustmentId: 'DV-02', expectedDirectiveThreadId: 'thread-A' });
    // Nothing is rendered from the response: no "Filed" line, no error.
    expect(container.textContent).not.toContain('Filed');
    expect(container.querySelector('[style*="EF4444"]')).toBeNull();
  });

  it('with no current directive the belief sent is null', async () => {
    const fetchSpy = stubFetch(async () => jsonResponse(200, { status: 'filed', directive: { text: DV02 } }));
    render({ chatExchanges: [lastAgentMessage()] });
    await click(chipButton(COPY.filesChip(DV02)));
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).expectedDirectiveThreadId).toBeNull();
  });

  it('an ask chip and a string chip send to the chat route, as text', async () => {
    const fetchSpy = stubFetch(async () => jsonResponse(200, { agentMessage: 'ok' }));
    render({ chatExchanges: [lastAgentMessage({ suggestedActions: [...MINTED, 'Show me the checks'] })] });
    await click(chipButton('Why the spread?'));
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/agent/chat');
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).message).toBe('Why the spread?');
    // A second render with the string chip (the first send's in-flight state clears at the end).
    await act(async () => { await Promise.resolve(); });
    await click(chipButton('Show me the checks'));
    expect(fetchSpy.mock.calls[1][0]).toBe('/api/agent/chat');
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body).message).toBe('Show me the checks');
  });

  it.each([
    [409, FILING_CONFLICT_LINE],
    [429, FILING_BUDGET_LINE],
    [500, FILING_FAILED_LINE],
  ])('a %s renders its ruled line and nothing else', async (status, line) => {
    stubFetch(async () => jsonResponse(status, { error: 'x' }));
    render({ chatExchanges: [lastAgentMessage()] });
    await click(chipButton(COPY.filesChip(DV02)));
    expect(container.textContent).toContain(line);
  });

  it('a 5xx / thrown request never claims nothing was filed (the D-90 rule)', async () => {
    stubFetch(async () => { throw new TypeError('Failed to fetch'); });
    render({ chatExchanges: [lastAgentMessage()] });
    await click(chipButton(COPY.filesChip(DV02)));
    expect(container.textContent).toContain(FILING_FAILED_LINE);
    expect(container.textContent).not.toContain('nothing was filed');
  });
});

describe('the no-change status line (§6.3) — from the persisted exchange only', () => {
  const nullWrite = { userMessage: 'Should we go all in?', agentResponse: 'That reverses the core.', timestamp: '2026-09-08T15:05:00.000Z', mode: 'battle', hasDirective: false, archetypeGate: { classification: 'core_conflict', selectedAdjustmentId: null, status: 'no_change', repairUsed: false } };

  it('renders on a GROUNDED null-write turn on which the gate ran', () => {
    render({ chatExchanges: [{ ...nullWrite, groundingVersion: 1 }] });
    expect(container.querySelector('[data-directive-status="no_change"]')?.textContent).toBe(NO_CHANGE_STATUS_LINE);
  });

  it('does NOT render on a legacy exchange (no marker), on a directive turn, or where the gate never ran', () => {
    render({ chatExchanges: [nullWrite] });
    expect(container.querySelector('[data-directive-status]')).toBeNull();
    render({ chatExchanges: [{ ...nullWrite, groundingVersion: 1, hasDirective: true, directive: { text: DV02, directiveThreadId: 't' }, archetypeGate: { status: 'committed' } }] });
    expect(container.querySelector('[data-directive-status]')).toBeNull();
    render({ chatExchanges: [{ ...nullWrite, groundingVersion: 1, archetypeGate: undefined }] });
    expect(container.querySelector('[data-directive-status]')).toBeNull();
  });
});
