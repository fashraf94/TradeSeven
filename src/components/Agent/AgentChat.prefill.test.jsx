// @vitest-environment jsdom
//
// src/components/Agent/AgentChat.prefill.test.jsx
//
// Phase A (A2) — the Why? panel's one door: `Ask a follow-up · 1 message`
// hands the chat a prefill (`{ text, nonce }`). The chat fills its composer
// with that text, focuses it, and tells the screen it consumed it — so the
// prefill is a string the USER edits and sends through the shipped path
// (C2: nothing the UI computes reaches the composer except this editable
// prefill), and a remount can never replay it.
//
// Harness precedent: starfield.depstability.test.jsx (jsdom docblock,
// createRoot + act, per-file mocks, no setupFiles).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
// The activity panel owns timers and framer state that add nothing here.
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom does not implement scrollIntoView (the auto-scroll effect) or
// matchMedia (the desktop breakpoint effect); neither is under test here.
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
  battleId: 'ab-1',
  agentId: 'agent-1',
  agentName: 'Aurora',
  chatExchanges: [],
  battleStatus: 'active',
  statusFeed: [],
  trades: [],
  knownTickers: new Set(),
};

const renderChat = (props) => act(() => { root.render(<AgentChat {...BASE} {...props} />); });
const textarea = () => container.querySelector('textarea');

describe('AgentChat — the composer prefill (the Why? door)', () => {
  it('fills the composer with the prefill text, focuses it, and reports it consumed', () => {
    const consumed = vi.fn();
    renderChat({ composerPrefill: { text: 'About SLB — ', nonce: 1 }, onComposerPrefillConsumed: consumed });
    expect(textarea().value).toBe('About SLB — ');
    expect(document.activeElement).toBe(textarea());
    expect(consumed).toHaveBeenCalledTimes(1);
  });

  it('a new nonce replaces the text; the same nonce does not re-fill what the user has typed over', () => {
    const consumed = vi.fn();
    renderChat({ composerPrefill: { text: 'About SLB — ', nonce: 1 }, onComposerPrefillConsumed: consumed });
    // The screen clears the prefill after consumption (the consumed callback);
    // a re-render with the SAME nonce must not touch the composer again.
    renderChat({ composerPrefill: { text: 'About SLB — ', nonce: 1 }, onComposerPrefillConsumed: consumed });
    expect(consumed).toHaveBeenCalledTimes(1);
    renderChat({ composerPrefill: { text: 'About DVN — ', nonce: 2 }, onComposerPrefillConsumed: consumed });
    expect(textarea().value).toBe('About DVN — ');
    expect(consumed).toHaveBeenCalledTimes(2);
  });

  it('no prefill → the composer stays empty (flag-off hands null)', () => {
    renderChat({ composerPrefill: null });
    expect(textarea().value).toBe('');
  });

  it('the send button stays disabled by the existing rules even with a prefill (a completed battle)', () => {
    renderChat({ composerPrefill: { text: 'About SLB — ', nonce: 3 }, battleStatus: 'completed' });
    expect(textarea().value).toBe('About SLB — ');
    expect(textarea().disabled).toBe(true);
  });
});
