// @vitest-environment jsdom
//
// src/components/FilmRoom/FilmRoomChat.attestation.jsdom.test.jsx
//
// B2 (spec §2 ruling 7) — THE EIGHTH CLIENT OF POST /api/agent/chat.
//
// The B2 Phase 0 discovery's client census (§3.2) enumerated seven sites that
// infer cost or persistence from an HTTP status. This is the eighth, found by
// the build's own adversarial review (lens C, finding C8): the Film Room's
// chat posts `mode: 'review'` to the same route, and the shared filing
// transaction commits a review turn exactly as it commits a battle turn — so
// it can receive the same commit-then-throw body as every other caller.
//
// It used to roll back the optimistic bubble on ANY non-ok status and say
// "Could not reach the agent" — a reachability claim on a turn where the agent
// answered and the message was spent. Mounted, real response shapes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token' } })),
}));

// Dependency-surface guard (BUILD_RULES §4): this file's import of the module under test is the runtime guard that its imports stay clean. Never mock it.
import FilmRoomChat from './FilmRoomChat';

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
  agentId: 'agent-1',
  battleId: 'ab-1',
  chatExchanges: [],
  reviewBudgetUsed: 0,
  knownTickers: new Set(),
  tokens: {},
};
const render = (props = {}) => act(() => { root.render(<FilmRoomChat {...BASE} {...props} />); });
const stubFetch = (impl) => vi.stubGlobal('fetch', vi.fn(impl));
const jsonResponse = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const UNREACHABLE = 'Could not reach the agent. Try again.';

async function send(text = 'walk me through the close') {
  const textarea = container.querySelector('textarea');
  expect(textarea).toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const button = [...container.querySelectorAll('button')].find((b) => !b.disabled);
  expect(button).toBeTruthy();
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('FilmRoomChat — B2: the eighth site reads the attestation', () => {
  it('C-8a: a `persisted: true` failure keeps the bubble and makes NO reachability claim', async () => {
    stubFetch(async () => jsonResponse(500, { persisted: true, charged: true, reason: 'failed_after_commit', error: 'Agent unavailable.' }));
    render();
    await send('walk me through the close');
    expect(container.textContent).not.toContain(UNREACHABLE);
    expect(container.textContent).toContain('walk me through the close');
  });

  it('C-8b: an attested `persisted: false` failure still rolls back and still says so', async () => {
    stubFetch(async () => jsonResponse(500, { persisted: false, charged: false, reason: 'handler_exception' }));
    render();
    await send('walk me through the close');
    expect(container.textContent).toContain(UNREACHABLE);
    expect(container.textContent).not.toContain('walk me through the close');
  });

  it('C-8c: an UNATTESTED failure keeps the shipped behaviour, byte for byte', async () => {
    stubFetch(async () => jsonResponse(500, { error: 'internal' }));
    render();
    await send('walk me through the close');
    expect(container.textContent).toContain(UNREACHABLE);
    expect(container.textContent).not.toContain('walk me through the close');
  });

  it('C-8d: an AMBIGUOUS commit claims nothing either way — the bubble goes, the line stays claimless', async () => {
    stubFetch(async () => jsonResponse(500, { persisted: null, charged: null, reason: 'handler_exception' }));
    render();
    await send();
    expect(container.textContent).toContain(UNREACHABLE);
  });

  it('C-8e: the failures that have their own words keep them', async () => {
    for (const [status, body, expected] of [
      [401, {}, 'Session expired. Please refresh.'],
      [403, { error: 'chat_budget_exceeded', persisted: false, charged: false }, "You've used all 5 review messages for this battle."],
      [429, { persisted: false, charged: false }, 'Slow down — too many messages. Try again in a moment.'],
      [504, { persisted: false, charged: false }, 'Took too long. Try again.'],
    ]) {
      stubFetch(async () => jsonResponse(status, body));
      render();
      await send();
      expect(container.textContent).toContain(expected);
    }
  });
});
