// @vitest-environment jsdom
//
// src/components/Agent/AgentChat.fromCockpit.jsdom.test.jsx
//
// Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md §8.2): a directive
// card whose exchange the answer endpoint wrote (`source: 'cockpit'`) carries a
// small "From the cockpit" label; a chip or chat filing renders as it always
// has. Harness: AgentChat.chips.jsdom.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token-1' } })) }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';
import { BATTLE_VIEW_COPY as COPY } from '../../screens/battleView/battleViewCopy';
import { deriveReceipts } from '../../screens/battleView/deriveReceipts';
import { buildCockpitExchange } from '../../../api/agent/call-response.js';

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
});

const BASE = {
  battleId: 'ab-1', agentId: 'agent-1', agentName: 'Vega',
  chatExchanges: [], battleStatus: 'active', statusFeed: [], trades: [],
  knownTickers: new Set(), chatBudgetUsed: 2,
};
const render = (props = {}) => act(() => { root.render(<AgentChat {...BASE} {...props} />); });

const COCKPIT = buildCockpitExchange({
  record: { text: "Hold off on AMD until today's close", expiry: 'until_ms', directiveThreadId: 't-cockpit', kind: 'call_hold' },
  directiveThreadId: 't-cockpit', createdAt: '2026-09-09T14:33:00.000Z', callId: 'b:eval_010:call:0',
});
const CHIP = {
  userMessage: null, agentResponse: '', hasDirective: true, messageType: 'directive_filed', source: 'chip',
  directive: { text: 'Widen the spread', expiry: 'end_of_battle', directiveThreadId: 't-chip' },
  directiveThreadId: 't-chip', timestamp: '2026-09-09T14:10:00.000Z', groundingVersion: 1, elicitationTarget: 'directive_filed', mode: 'battle',
};

describe('§8.2 — "From the cockpit"', () => {
  it('a cockpit filing\'s card carries the label, once; the chip filing beside it does not', () => {
    const exchanges = [CHIP, COCKPIT];
    render({ chatExchanges: exchanges, receipts: deriveReceipts(exchanges, 'active'), currentDirectiveThreadId: 't-cockpit' });
    const labels = [...container.querySelectorAll('[data-from-cockpit]')];
    expect(labels).toHaveLength(1);
    expect(labels[0].textContent).toBe(COPY.fromCockpit);
    expect(COPY.fromCockpit).toBe('From the cockpit');
    expect(container.textContent).toContain("Hold off on AMD until today's close");
    expect(container.textContent).toContain('Widen the spread');
  });

  it('no cockpit filing → no label anywhere', () => {
    render({ chatExchanges: [CHIP], receipts: deriveReceipts([CHIP], 'active'), currentDirectiveThreadId: 't-chip' });
    expect(container.querySelector('[data-from-cockpit]')).toBeNull();
  });
});
