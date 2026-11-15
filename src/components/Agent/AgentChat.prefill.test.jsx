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

  it('a new nonce replaces an UNTOUCHED prefill; the same nonce is a no-op', () => {
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

  it('a typed draft is never erased: a piece prefill leaves it, the empty book prefill only focuses (F13)', () => {
    const consumed = vi.fn();
    renderChat({ composerPrefill: null });
    // The user types a draft.
    act(() => {
      const ta = textarea();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, 'my own words');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(textarea().value).toBe('my own words');
    renderChat({ composerPrefill: { text: 'About SLB — ', nonce: 7 }, onComposerPrefillConsumed: consumed });
    expect(textarea().value).toBe('my own words');
    expect(document.activeElement).toBe(textarea());
    expect(consumed).toHaveBeenCalledTimes(1);
    renderChat({ composerPrefill: { text: '', nonce: 8 }, onComposerPrefillConsumed: consumed });
    expect(textarea().value).toBe('my own words');
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

// Battle Research Slice 1 (spec docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-19; Phase 0 point 8): the
// research draft's own mode, 'append'. It never replaces what the player typed — it goes AFTER it, a blank
// line between, in the longest of its trimmed variants that fits the composer's 2000; the shipped doors
// (the rows above) keep their rule.
describe('AgentChat — the append prefill (Battle Research\'s draft)', () => {
  const type = (text) => act(() => {
    const ta = textarea();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  it('an empty composer takes the draft whole', () => {
    renderChat({ composerPrefill: { text: 'Research: "Rank my bench"\nMSFT:', nonce: 1, mode: 'append', variants: ['Research: "Rank my bench"\nMSFT:'] } });
    expect(textarea().value).toBe('Research: "Rank my bench"\nMSFT:');
  });
  it('unsent text is KEPT: the draft is added after it with a blank line between, and nothing is lost', () => {
    renderChat({ composerPrefill: null });
    type('my own words');
    renderChat({ composerPrefill: { text: 'DRAFT', nonce: 2, mode: 'append', variants: ['DRAFT'] } });
    expect(textarea().value).toBe('my own words\n\nDRAFT');
  });
  it('the longest variant that still fits after the typed text; none fits → the typed text alone, never a draft cut mid-line', () => {
    renderChat({ composerPrefill: null });
    type('x'.repeat(1900));
    renderChat({ composerPrefill: { text: 'L'.repeat(200), nonce: 3, mode: 'append', variants: ['L'.repeat(200), 'M'.repeat(90), 'S'.repeat(20)] } });
    expect(textarea().value).toBe(`${'x'.repeat(1900)}\n\n${'M'.repeat(90)}`);
    renderChat({ composerPrefill: null });
    type('y'.repeat(1999));
    renderChat({ composerPrefill: { text: 'L'.repeat(200), nonce: 4, mode: 'append', variants: ['L'.repeat(200), 'S'.repeat(20)] } });
    expect(textarea().value).toBe('y'.repeat(1999));
  });
  it('a previous UNTOUCHED draft is replaced, not stacked', () => {
    renderChat({ composerPrefill: { text: 'FIRST', nonce: 5, mode: 'append', variants: ['FIRST'] } });
    renderChat({ composerPrefill: { text: 'SECOND', nonce: 6, mode: 'append', variants: ['SECOND'] } });
    expect(textarea().value).toBe('SECOND');
  });
});

describe('AgentChat — the append prefill never cuts a draft', () => {
  it('a little room left but no variant fits: the typed text alone, never the first characters of a draft', () => {
    act(() => { root.render(<AgentChat {...BASE} composerPrefill={null} />); });
    act(() => {
      const ta = textarea();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, 'z'.repeat(1990));
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { root.render(<AgentChat {...BASE} composerPrefill={{ text: 'Research: "Rank my bench"', nonce: 9, mode: 'append', variants: ['Research: "Rank my bench"'] }} />); });
    expect(textarea().value).toBe('z'.repeat(1990));
  });
});

// Review BL2-1 (lens 2 on PR B): the composer remembered "kept + draft" as an untouched prefill, so the next
// door treated the player's own words as replaceable. Each row failed on 06520f92.
describe('review BL2-1 — typed words survive every later door', () => {
  const type = (text) => act(() => {
    const ta = textarea();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const ap = (text, nonce) => ({ composerPrefill: { text, nonce, mode: 'append', variants: [text] } });
  it('a second research draft replaces only the first draft — the typed words stay', () => {
    renderChat({ composerPrefill: null });
    type('my own words');
    renderChat(ap('D1', 11));
    renderChat(ap('D2', 12));
    expect(textarea().value).toBe('my own words\n\nD2');
  });
  it('a shipped door after a research draft over typed words leaves the composer as it is (F13: typed text wins)', () => {
    renderChat({ composerPrefill: null });
    type('my own words');
    renderChat(ap('D1', 13));
    renderChat({ composerPrefill: { text: 'About SLB — ', nonce: 14 } });
    expect(textarea().value).toBe('my own words\n\nD1');
  });
  it('a draft that could not fit leaves the typed text, which a shipped door then never replaces', () => {
    renderChat({ composerPrefill: null });
    type('z'.repeat(1990));
    renderChat(ap('Research: "Rank my bench"', 15));
    renderChat({ composerPrefill: { text: 'About', nonce: 16 } });
    expect(textarea().value).toBe('z'.repeat(1990));
  });
});
