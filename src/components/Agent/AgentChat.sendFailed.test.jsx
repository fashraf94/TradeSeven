// @vitest-environment jsdom
//
// src/components/Agent/AgentChat.sendFailed.test.jsx
//
// Addendum item 11 — the line a send that never reached the model leaves
// behind.
//
// The shipped string is `Agent is thinking too hard. Try again.`: an agent
// verb on a sentence that is not about the agent (the model was never
// reached), and silent about the one thing the player needs to know. The
// founder's smoke found the gap it leaves — three failed sends and a budget
// still reading 0/10, with no way to tell from the screen whether those three
// had been spent.
//
// Under the flag the line is `The character couldn't answer just now ·
// nothing was sent`. The rows below hold three claims:
//
//   1. It renders ON A FAILED SEND, and only then — not on mount, not on a
//      successful one, and not for the failures that have their own words
//      (401, the budget cap, 429, 504).
//   2. Nothing was sent is TRUE: the request that failed produced no server
//      write, so the budget the chat displays does not move.
//   3. Flag-off the shipped string is byte-for-byte what it was.
//
// jsdom + createRoot + act, the repo's interaction idiom; fetch is stubbed per
// row so the failure is the real send path's, not a mocked handler's.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token' } })),
}));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';
import { BATTLE_VIEW_COPY as COPY } from '../../screens/battleView/battleViewCopy';

const SHIPPED = 'Agent is thinking too hard. Try again.';
const RULED = "The character couldn't answer just now · nothing was sent";

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
  battleId: 'ab-1', agentId: 'agent-1', agentName: 'Aurora',
  chatExchanges: [], battleStatus: 'active', statusFeed: [], trades: [],
  knownTickers: new Set(), chatBudgetUsed: 0,
};

const render = (props = {}) => act(() => { root.render(<AgentChat {...BASE} {...props} />); });

/** Type into the composer and press the send button. */
async function send(text = 'protect the lead') {
  const textarea = container.querySelector('textarea');
  expect(textarea).toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const button = [...container.querySelectorAll('button')]
    .find((b) => b.querySelector('svg') && !b.disabled && b.getAttribute('aria-label') !== 'Close');
  expect(button).toBeTruthy();
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

const stubFetch = (impl) => vi.stubGlobal('fetch', vi.fn(impl));
const jsonResponse = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('item 11 — the send-failure line under the flag', () => {
  it('a 500 renders the ruled line, never the shipped one', async () => {
    stubFetch(async () => jsonResponse(500, { error: 'internal' }));
    render({ controllerCopy: true });
    await send();
    expect(container.textContent).toContain(RULED);
    expect(container.textContent).not.toContain(SHIPPED);
    expect(container.textContent).not.toContain('thinking');
  });

  it('a thrown request (the network path) renders the same line', async () => {
    stubFetch(async () => { throw new TypeError('Failed to fetch'); });
    render({ controllerCopy: true });
    await send();
    expect(container.textContent).toContain(RULED);
  });

  it('NOTHING WAS SENT — what the CLIENT can be held to, and what it cannot', async () => {
    // The old form of this row rendered with `chatBudgetUsed: 0`, sent three
    // times, and asserted the counter still read `0/10`. `chatBudgetUsed` is a
    // fixed PROP the row never changed, so it asserted that a constant is
    // constant: no mutation of this component could move it, and the identical
    // assertion passes on three SUCCESSFUL sends (review RB-F5).
    //
    // The claim also cannot be discharged here in full. `nothing was sent` is
    // a statement about the SERVER, and `api/agent/chat.js:617-623` writes the
    // exchange and increments the budget INSIDE the `try` whose `catch` is the
    // 500 this row stubs — so a 500 raised after that point HAS charged the
    // player (review RB-F4, recorded for the founder, not fixed here: `api/`
    // is behind the §1 fence). The network-drop path below needs no such
    // caveat: a request that threw never reached a writer.
    //
    // What IS this component's own behaviour, and what these rows hold:
    //
    //   · it fires ONE request per attempt — no silent retry that could charge
    //     twice for one failure;
    //   · the counter it displays is the SERVER's number arriving as a prop,
    //     not a tally the client keeps — proved by MOVING the prop, which is
    //     the half the old row left out.
    const fetchSpy = vi.fn(async () => jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchSpy);
    render({ controllerCopy: true, chatBudgetUsed: 0 });
    expect(container.textContent).toContain('0/10 battle');
    await send('one');
    await send('two');
    await send('three');
    expect(container.textContent).toContain(RULED);
    // Three attempts, three requests: nothing retried behind the line.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    // The display did not move — and the next two lines are what make that
    // mean something, by moving it the only way anything can.
    expect(container.textContent).toContain('0/10 battle');
    render({ controllerCopy: true, chatBudgetUsed: 3 });
    expect(container.textContent).toContain('3/10 battle');
    expect(container.textContent).not.toContain('0/10 battle');
  });

  it('a failed send leaves NO bubble behind — and the typed words are GONE', async () => {
    // The other half of `nothing was sent` the client can actually prove: the
    // optimistic bubble is rolled back on both failure paths, so a message the
    // character never received does not sit in the stream reading as one it
    // did.
    //
    // The second assertion is not a claim that the behaviour is right. The
    // composer is cleared at the top of `sendMessage` (`AgentChat.jsx:741`)
    // and neither the `!res.ok` branch (`:764-784`) nor the `catch` (`:796-800`) puts
    // the text back, so a failed send destroys what the player typed —
    // `nothing was sent` is then true and the words are lost anyway, with
    // retyping the only way to retry. Pinned here as the SHIPPED behaviour, on
    // both paths, because item 11 changed the sentence beside it and this row
    // is where a founder ruling on the draft would land. Recorded in the
    // review record; not fixed in this phase — the send path is shipped code
    // this phase does not touch, and restoring the draft changes the flag-off
    // path too.
    for (const failure of [
      async () => { throw new TypeError('Failed to fetch'); },
      async () => jsonResponse(500, {}),
    ]) {
      stubFetch(failure);
      render({ controllerCopy: true });
      await send('protect the lead');
      expect(container.textContent).toContain(RULED);
      const bubbles = [...container.querySelectorAll('div')]
        .filter((el) => el.textContent === 'protect the lead');
      expect(bubbles.length).toBe(0);
      expect(container.querySelector('textarea').value).toBe('');
    }
  });

  it('ONLY on a failed send — not on mount, and not on a successful one', async () => {
    stubFetch(async () => jsonResponse(200, { ok: true }));
    render({ controllerCopy: true });
    expect(container.textContent).not.toContain(RULED);
    await send();
    expect(container.textContent).not.toContain(RULED);
  });

  it('the failures that have their own words keep them (401 / budget / 429 / 504)', async () => {
    const cases = [
      [401, {}, 'Session expired. Please refresh.'],
      [403, { error: 'chat_budget_exceeded' }, "You've used all 10 messages for this battle."],
      [429, {}, 'Slow down — too many messages. Try again in a moment.'],
      [504, {}, 'Agent took too long. Try again.'],
    ];
    for (const [status, body, expected] of cases) {
      stubFetch(async () => jsonResponse(status, body));
      render({ controllerCopy: true });
      await send();
      expect(container.textContent).toContain(expected);
      expect(container.textContent).not.toContain(RULED);
    }
  });

  it('FLAG OFF — the shipped string, byte for byte', async () => {
    stubFetch(async () => jsonResponse(500, {}));
    render();
    await send();
    expect(container.textContent).toContain(SHIPPED);
    expect(container.textContent).not.toContain(RULED);
  });

  it('the string is the copy module\'s, not a literal in the component', () => {
    expect(COPY.chatSendFailed).toBe(RULED);
    // ASCII apostrophe, as every other possessive in battleViewCopy.js is
    // (`The agent's own words`, `The guardrail's reason`). Recorded in the
    // handover as a one-character copy question if the typographic form is
    // wanted — it would be the only curly apostrophe in the module.
    expect(COPY.chatSendFailed).not.toContain('’');
  });
});
