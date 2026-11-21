// @vitest-environment jsdom
//
// Shared Research B6a — THE SHEET'S NEW OPTIONS, rendered from the server's own
// answers (answers.json, thesisAnswers.json). No network: fetchWithAuth is the
// fake route, and every row checks the bodies sent.
//   X-5   startNow: the open is sent on mount with the item's question, and the story
//         preview is never drawn first; an existing investigation, the daily limit,
//         the gate, a refusal and a failure each show their existing state; a refusal
//         or a failure offers the preview with the question kept, and Try again
//         re-sends the same request id. Absent, nothing changes.
//   X-5b  words: the own-words box opens holding them; nothing is sent until the player
//         continues.
//   X-7   a reopened saved thesis shows the statement the session's adoption records; a
//         thesis saved before B6a shows none, as before.
//   Q-1   mode 'session' shows a closed builder investigation by id, read-only: a saved
//         one and a concluded one, no choices drawn, nothing sent but the read.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithAuth = vi.hoisted(() => vi.fn());
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth }));
const transitionHypothesis = vi.hoisted(() => vi.fn());
vi.mock('../../services/hypothesisVersionService', () => ({ transitionHypothesis }));
const equipLoadoutBook = vi.hoisted(() => vi.fn());
vi.mock('../../services/loadoutService', () => ({ equipLoadoutBook }));
const flags = vi.hoisted(() => ({ mode: 'off' }));
vi.mock('../../config/sharedResearchFlags', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get SHARED_RESEARCH_BUILDER_MODE() { return flags.mode; } };
});

const { default: Body } = await import('./SharedResearchSheetBody');
const { SR_COPY: COPY } = await import('./sharedResearchCopy');
const kit = await import('./__fixtures__/srKit');
const { default: TA } = await import('./__fixtures__/thesisAnswers.json');
const { A, NETWORK, fakeServer, mount, flush, click, typeInto, $, $$, deferred, storyOf } = kit;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let mounted = [];
let server;
let seen;
let observer;
const keep = (m) => { mounted.push(m); return m; };
beforeEach(() => {
  flags.mode = 'off';
  server = fakeServer({ list: A.list });
  fetchWithAuth.mockImplementation(server.fetch);
  // every screen label the body ever drew, in order — so "the preview was never drawn" is a fact, not a last look
  seen = [];
  observer = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        for (const el of [n, ...n.querySelectorAll('[data-screen-label]')]) if (el.dataset?.screenLabel) seen.push(el.dataset.screenLabel);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
afterEach(() => { observer.disconnect(); for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); });

const QUESTION = 'Who earns when data centers wait on power gear?';
const EXPLORE_ITEM = storyOf({ itemRef: { recordKind: 'exploreStories', recordId: 'ai-power-1' }, headline: 'Power gear, not chips, sets the pace of the AI buildout', question: QUESTION });
async function startNowOn(routes = {}, props = {}) {
  for (const [k, v] of Object.entries(routes)) server.set(k, v);
  const m = keep(mount(<Body mode="item" item={EXPLORE_ITEM} startNow agentName="Atlas" phone onClose={vi.fn()} {...props} />));
  await flush();
  return m;
}
const opens = () => server.sent('open').map((c) => c.body);
const PREVIEW = '[data-screen-label="Item preview"]';

describe('X-5 startNow: the open goes at once, and the preview is not drawn first', () => {
  it('on mount: one open with the item\'s own question and its itemRef; while it runs the opening line, never the preview', async () => {
    const held = deferred();
    await startNowOn({ open: held.promise });
    expect(opens()).toEqual([{ action: 'open', requestId: expect.stringMatching(UUID), entry: { kind: 'item', itemRef: { recordKind: 'exploreStories', recordId: 'ai-power-1' }, question: QUESTION } }]);
    expect($(PREVIEW)).toBeNull();
    expect($('#sr-item-q')).toBeNull();
    expect($('[data-shared-research-body]').textContent).toContain(COPY.opening);
    held.resolve(A.openStory);
    await flush();
    expect($('[data-screen-label^="Work"]')).not.toBeNull();
    expect(seen).not.toContain('Item preview');
    expect(opens()).toHaveLength(1);
  });
  it('a direction given with the item is sent with it (trimmed)', async () => {
    await startNowOn({ open: A.openStory }, { direction: '  utilities first ' });
    expect(opens()[0].entry).toEqual({ kind: 'item', itemRef: EXPLORE_ITEM.itemRef, question: QUESTION, direction: 'utilities first' });
  });
  it('an existing investigation: the existing Continue state; no preview, nothing more sent', async () => {
    await startNowOn({ open: { status: 200, body: { ...A.openStory.body, existing: true } } });
    expect($('[data-sr-continue-existing]')).not.toBeNull();
    expect(seen).not.toContain('Item preview');
    expect(opens()).toHaveLength(1);
  });
  it('the daily limit: the preview, the server\'s line, the question kept — and no second open', async () => {
    await startNowOn({ open: A.daily_limit });
    expect($(PREVIEW)).not.toBeNull();
    expect($('[data-sr-refusal="daily_limit"]').textContent).toBe(A.daily_limit.body.message);
    expect($('#sr-item-q').value).toBe(QUESTION);
    expect(opens()).toHaveLength(1);
  });
  it('a refusal: the preview with the question kept; Try again re-sends the same request id, with the question as edited', async () => {
    await startNowOn({ open: [A.attribution_unavailable, A.openStory] });
    expect($('[data-sr-refusal="attribution_unavailable"]').textContent).toBe(A.attribution_unavailable.body.message);
    expect($('#sr-item-q').value).toBe(QUESTION);
    const button = $('[data-sr-investigate]');
    expect(button.textContent).toBe(COPY.retry);
    typeInto($('#sr-item-q'), `${QUESTION} And how directly?`);
    click($('[data-sr-investigate]'));
    await flush();
    const [first, second] = opens();
    expect(second.requestId).toBe(first.requestId);
    expect(second.entry.question).toBe(`${QUESTION} And how directly?`);
    expect($('[data-screen-label^="Work"]')).not.toBeNull();
  });
  it('a failure (no answer): the preview, the open\'s own line; Try again re-sends the same request id', async () => {
    await startNowOn({ open: [NETWORK, A.openStory] });
    expect($(PREVIEW)).not.toBeNull();
    expect($('[data-sr-refusal="network"]').textContent).toBe(COPY.networkOpen);
    expect($('#sr-item-q').value).toBe(QUESTION);
    click($('[data-sr-investigate]'));
    await flush();
    expect(opens().map((b) => b.requestId)).toEqual([opens()[0].requestId, opens()[0].requestId]);
    expect($('[data-screen-label^="Work"]')).not.toBeNull();
  });
  it('the gate, from the server (404 disabled): the preview in its gated state, no Investigate', async () => {
    await startNowOn({ open: A.disabled, list: A.disabled });
    expect($(PREVIEW)).not.toBeNull();
    expect($('[data-sr-gated]')).not.toBeNull();
    expect($('[data-sr-investigate]')).toBeNull();
    expect(opens()).toHaveLength(1);
  });
  it('the gate, passed in: the preview, gated; nothing is sent', async () => {
    await startNowOn({ open: A.openStory }, { gated: true });
    expect($(PREVIEW)).not.toBeNull();
    expect($('[data-sr-gated]')).not.toBeNull();
    expect(opens()).toEqual([]);
  });
  it('an item with no question: the preview, as without startNow; nothing is sent', async () => {
    server.set('open', A.openStory);
    keep(mount(<Body mode="item" item={{ ...EXPLORE_ITEM, question: '   ' }} startNow phone onClose={vi.fn()} />));
    await flush();
    expect($(PREVIEW)).not.toBeNull();
    expect(opens()).toEqual([]);
  });
});

describe('X-5 startNow absent (or false): today\'s sheet', () => {
  for (const props of [{}, { startNow: false }]) {
    it(`${JSON.stringify(props)}: the preview first, and no open until Investigate`, async () => {
      server.set('open', A.openStory);
      keep(mount(<Body mode="item" item={EXPLORE_ITEM} agentName="Atlas" phone onClose={vi.fn()} {...props} />));
      await flush();
      expect($(PREVIEW)).not.toBeNull();
      expect($('#sr-item-q').value).toBe(QUESTION);
      expect(opens()).toEqual([]);
      expect(server.calls.map((c) => c.key)).toEqual(['list']);
    });
  }
  it('startNow with another mode does nothing: Start, and only the list read', async () => {
    keep(mount(<Body mode="start" startNow item={EXPLORE_ITEM} phone onClose={vi.fn()} />));
    await flush();
    expect($('[data-screen-label="Start"]')).not.toBeNull();
    expect(server.calls.map((c) => c.key)).toEqual(['list']);
  });
});

describe('X-5b words: the own-words box opens holding them; nothing is sent until the player continues', () => {
  it('mode \'start\': the box holds the words; the only request is the list read', async () => {
    keep(mount(<Body mode="start" words="power gear for data centers" phone onClose={vi.fn()} />));
    await flush();
    expect($('#sr-own').value).toBe('power gear for data centers');
    expect(server.calls.map((c) => c.key)).toEqual(['list']);
  });
  it('the player continues: the words go out then, as typed (today\'s framing)', async () => {
    server.set('frame', A.framed);
    keep(mount(<Body mode="start" words="power gear for data centers" phone onClose={vi.fn()} />));
    await flush();
    expect(server.sent('frame')).toEqual([]);
    click($('[data-sr-frame]'));
    await flush();
    expect(server.sent('frame').map((c) => c.body.observation)).toEqual(['power gear for data centers']);
  });
  it('with the builder on: Start the thesis opens own words with them', async () => {
    flags.mode = 'on';
    server.set('open', TA.walkOpen);
    keep(mount(<Body mode="start" words="power gear" phone onClose={vi.fn()} />));
    await flush();
    expect(opens()).toEqual([]);
    click($('[data-sr-start-thesis]'));
    await flush();
    expect(opens()[0].entry).toEqual({ kind: 'observation', observation: 'power gear' });
  });
  it('absent: the box opens empty, as before; words with another mode are not used', async () => {
    const a = keep(mount(<Body mode="start" phone onClose={vi.fn()} />));
    await flush();
    expect($('#sr-own').value).toBe('');
    a.unmount();
    mounted = mounted.filter((m) => m !== a);
    server.set('open', A.openStory);
    keep(mount(<Body mode="item" item={EXPLORE_ITEM} words="unused" phone onClose={vi.fn()} />));
    await flush();
    click($('[data-screen-label="Item preview"] button')); // ← All stories
    await flush();
    expect($('#sr-own').value).toBe('');
  });
});

const withStatement = (answer, statement) => ({ ...answer, body: { ...answer.body, session: { ...answer.body.session, adoption: { ...answer.body.session.adoption, statement } } } });
const EDIT = 'NVDA earns from accelerators because AI data centers buy them. It\'s wrong if big buyers cut spending.';

describe('X-7: the saved statement on a reopened thesis', () => {
  it('a reopened saved thesis shows the statement its adoption records', async () => {
    server.set('get', withStatement(TA.walkGetSaved, EDIT));
    keep(mount(<Body mode="session" sessionId={TA.walkGetSaved.body.session.sessionId} agentName="Atlas" phone onClose={vi.fn()} />));
    await flush();
    expect($('[data-sr-thesis-saved]')).not.toBeNull();
    expect($('[data-sr-saved-statement]').textContent).toBe(EDIT);
    expect(EDIT).not.toBe(TA.walkGetSaved.body.thesis.sentence);
  });
  it('a thesis saved before B6a (no statement recorded) shows none, as before', async () => {
    server.set('get', TA.walkGetSaved);
    keep(mount(<Body mode="session" sessionId={TA.walkGetSaved.body.session.sessionId} agentName="Atlas" phone onClose={vi.fn()} />));
    await flush();
    expect($('[data-sr-thesis-saved]')).not.toBeNull();
    expect($('[data-sr-saved-statement]')).toBeNull();
  });
  it('right after a save, the statement the server recorded is the one shown', async () => {
    flags.mode = 'on';
    server.set('get', [TA.walkGetReady, withStatement(TA.walkGetSaved, EDIT)]);
    server.set('adopt', TA.walkSaved);
    keep(mount(<Body mode="session" sessionId={TA.walkGetReady.body.session.sessionId} agentName="Atlas" phone onClose={vi.fn()} />));
    await flush();
    click($('[data-sr-save-thesis]'));
    await flush();
    expect($('[data-sr-saved-statement]').textContent).toBe(EDIT);
  });
});

/** A concluded builder investigation as the read answers it: the close's session, record and card, with the read's other keys. */
const getConcluded = () => ({ status: 200, body: { ...TA.getDeadEnd.body, session: TA.closeDeadEnd.body.session, record: TA.closeDeadEnd.body.record, thesis: TA.closeDeadEnd.body.thesis } });

describe('Q-1: mode \'session\' shows a closed builder investigation by id, read-only', () => {
  for (const [name, answer, check] of [
    ['saved', () => TA.walkGetSaved, () => expect($('[data-sr-thesis-saved]')).not.toBeNull()],
    ['concluded', getConcluded, () => expect($('[data-shared-research-body]').textContent).toContain(COPY.concluded)],
  ]) {
    it(`a ${name} one: its own screen, no choices drawn, nothing sent but the read`, async () => {
      const a = answer();
      expect(a.body.session.shape).toBe('builder');
      expect(a.body.session.status).toBe('completed');
      server.set('get', a);
      keep(mount(<Body mode="session" sessionId={a.body.session.sessionId} agentName="Atlas" phone onClose={vi.fn()} />));
      await flush();
      check();
      expect($$('[data-sr-choices], [data-sr-research], [data-sr-free], [data-sr-save-thesis], [data-sr-conclude], [data-sr-foot]')).toEqual([]);
      expect(server.calls.map((c) => [c.key, c.url])).toEqual([['get', `/api/forge/shared-research?sessionId=${encodeURIComponent(a.body.session.sessionId)}`]]);
    });
  }
});
