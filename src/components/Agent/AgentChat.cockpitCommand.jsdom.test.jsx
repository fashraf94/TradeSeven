// @vitest-environment jsdom
//
// src/components/Agent/AgentChat.cockpitCommand.jsdom.test.jsx
//
// Cockpit Build 2b (spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md §5.9, ruling
// R2B-4): while the slot holds a live COCKPIT command, the composer shows one
// line above the input — "Sending a directive replaces your cockpit command on
// {SYM}." Without the prop (flag off, or no live command) the composer is the
// shipped one. Harness: AgentChat.fromCockpit.jsdom.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token-1' } })) }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

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
});

const BASE = {
  battleId: 'ab-1', agentId: 'agent-1', agentName: 'Vega',
  chatExchanges: [], battleStatus: 'active', statusFeed: [], trades: [],
  knownTickers: new Set(), chatBudgetUsed: 2,
};
const render = (props = {}) => act(() => { root.render(<AgentChat {...BASE} {...props} />); });

describe('§5.9 the composer line', () => {
  it('a live cockpit command: one line, above the input, naming the symbol', () => {
    render({ cockpitCommand: { family: 'call', symbol: 'VLO' } });
    const line = container.querySelector('[data-chat-cockpit-command]');
    expect(line.textContent).toBe('Sending a directive replaces your cockpit command on VLO.');
    // Above the input: the line precedes the textarea in document order.
    const textarea = container.querySelector('textarea');
    expect(line.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('no prop, a non-call slot, or no symbol → no line: the shipped composer', () => {
    render({});
    expect(container.querySelector('[data-chat-cockpit-command]')).toBeNull();
    render({ cockpitCommand: { family: 'chat', symbol: 'VLO' } });
    expect(container.querySelector('[data-chat-cockpit-command]')).toBeNull();
    render({ cockpitCommand: { family: 'call', symbol: null } });
    expect(container.querySelector('[data-chat-cockpit-command]')).toBeNull();
  });
});
