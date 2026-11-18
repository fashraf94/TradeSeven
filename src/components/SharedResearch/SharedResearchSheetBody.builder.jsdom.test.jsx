// @vitest-environment jsdom
//
// Shared Research B4 — THE THESIS BUILDER'S SCREEN, rendered from the server's own
// answers (__fixtures__/thesisAnswers.json, composed by B3's functions in
// thesisAnswers.test.js; the ledger's from B2's answers.json). No network:
// fetchWithAuth is the fake route, and every row checks the exact bodies sent.
//   - the walk: the founder's example end to end, own words to saved;
//   - every state of the Tests list;
//   - a row for each ruling: K-2, K-3, K-4 (thesisView.test.js), K-5, K-6, K-8, K-10,
//     K-10b, K-11, K-12, K-13, K-15, K-16.
// The switch is mocked at the flag module and read at call time (builderMode.js),
// so a row sets it before it mounts.

import React, { act } from 'react';
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
const { sharedResearchBuilderMode } = await import('./builderMode');
const { formatWhen, STATEMENT_MAX } = await import('./sharedResearchView');
const { SR_SERVER_COPY } = await import('../../../api/_utils/sharedResearch/copy.js');
const kit = await import('./__fixtures__/srKit');
const { default: TA } = await import('./__fixtures__/thesisAnswers.json');
const { fakeServer, mount, flush, click, typeInto, $, $$, textOf, deferred, NETWORK } = kit;
const LEDGER = kit.A;
const B = COPY.builder;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let mounted = [];
let server;
const keep = (m) => { mounted.push(m); return m; };
beforeEach(() => {
  flags.mode = 'off';
  server = fakeServer({ list: TA.listEmpty });
  fetchWithAuth.mockImplementation(server.fetch);
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); vi.useRealTimers(); });

const SID = TA.ids.walk.sessionId;
/** Open the sheet on one investigation (mode 'session'), its GET answered by `get`. */
async function openOn(get, props = {}, routes = {}) {
  server.set('get', get);
  for (const [k, v] of Object.entries(routes)) server.set(k, v);
  const m = keep(mount(<Body mode="session" sessionId={get.body.session.sessionId} agentName="Atlas" agentId="agent-fixture-1" phone onClose={vi.fn()} {...props} />));
  await flush();
  return m;
}
async function start(props = {}, routes = {}) {
  for (const [k, v] of Object.entries(routes)) server.set(k, v);
  const m = keep(mount(<Body stories={[]} agentName="Atlas" agentId="agent-fixture-1" phone onClose={vi.fn()} {...props} />));
  await flush();
  return m;
}
const tap = async (sel) => { click($(sel)); await flush(); };
const last = (key) => server.sent(key).at(-1)?.body;
const thesisOf = (k) => TA[k].body.thesis;

describe('the switch is read at call time (K-3; the hubFlags.js precedent)', () => {
  it('the mock reaches the reader: \'on\' reads on, anything else reads off', () => {
    flags.mode = 'on';
    expect(sharedResearchBuilderMode()).toBe('on');
    flags.mode = 'ON';
    expect(sharedResearchBuilderMode()).toBe('off');
    flags.mode = undefined;
    expect(sharedResearchBuilderMode()).toBe('off');
    flags.mode = 'off';
    expect(sharedResearchBuilderMode()).toBe('off');
  });
});

describe('THE WALK: "I want to play AI" to a saved thesis, every request body checked', () => {
  it('own words → Map → a segment → Find the companies → one stock → Find the reasons → Confirm → a wrong-if → a time frame → Save → saved', async () => {
    flags.mode = 'on';
    await start({}, {
      open: TA.walkOpen,
      step: [TA.walkMap, TA.walkNames, TA.walkWhy],
      card: [TA.walkSegment, TA.walkOneStock, TA.walkConfirmWhy, TA.walkWrongIf, TA.walkTimeFrame],
      adopt: TA.walkSaved,
      get: TA.walkGetSaved,
    });
    // own words open at once (DR-6): no framing call, no framing screen
    typeInto($('#sr-own'), 'I want to play AI');
    expect($('[data-sr-start-thesis]').textContent).toBe(B.start);
    await tap('[data-sr-start-thesis]');
    const open = last('open');
    expect(Object.keys(open).sort()).toEqual(['action', 'entry', 'requestId']);
    expect(open).toMatchObject({ action: 'open', entry: { kind: 'observation', observation: 'I want to play AI' } });
    expect(open.requestId).toMatch(UUID);
    expect(server.sent('frame')).toHaveLength(0);
    expect($('[data-sr-builder="one-column"]')).not.toBeNull();
    // §B13 T-1 (moved from "1 of 6" and the theme reading the player's words): the theme opens blank; the words are
    // the player's, in the conversation
    expect($('[data-sr-filled]').textContent).toBe('0 of 6');
    expect($('[data-sr-slot="theme"]').dataset.srSlotState).toBe('unset');
    expect($('[data-sr-slot="theme"]').textContent).toBe(B.blank.theme);
    expect($('[data-sr-words]').textContent).toContain('I want to play AI');

    // Map the segments (1 step)
    await tap('[data-sr-research="map_segments"]');
    const map = last('step');
    expect(Object.keys(map).sort()).toEqual(['action', 'goal', 'intent', 'sessionId', 'stepId']);
    expect(map).toMatchObject({ action: 'step', sessionId: SID, intent: 'build', goal: 'map_segments' });
    expect(map.stepId).toMatch(UUID);
    // §B13 T-6: the theme suggestion sits as one line at the top of the choices, the segment's choices under it
    const line = $('[data-sr-choices="segment"] > [data-sr-theme-line]');
    expect(line).not.toBeNull();
    // §B14 Watch 10 (moved from the one-link line): "{agent} suggests a theme", the suggestion on its own line, two buttons
    expect(line.querySelector('[data-sr-theme-suggests]').textContent).toBe(B.themeSuggests('Atlas'));
    expect(line.querySelector('[data-sr-theme-suggestion]').textContent).toBe(thesisOf('walkMap').parts.theme.suggestion);
    expect($('[data-sr-choices="segment"]').firstElementChild).toBe(line);
    expect($('[data-sr-slot="theme"]').dataset.srSlotState).toBe('suggested');
    // the agent's pick, marked on its free choice; the part stays unset
    expect($('[data-sr-slot="segment"]').dataset.srSlotState).toBe('unset');
    const pick = $('[data-sr-free="confirm:segment"]');
    expect(pick.textContent).toContain(B.pickTag('Atlas'));
    expect(pick.textContent).toContain(thesisOf('walkMap').pick.reason);
    await tap('[data-sr-free="confirm:segment"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkMap').rev, op: 'confirm', part: 'segment', value: 'Accelerator chips' });
    expect($('[data-sr-slot="segment"]').textContent).toBe('Accelerator chips');
    expect(textOf()).toContain(B.cardLine('Segment: Accelerator chips'));

    // Find the listed companies (1 step), then one stock (free)
    await tap('[data-sr-research="find_names"]');
    expect(last('step')).toMatchObject({ goal: 'find_names', intent: 'build', sessionId: SID });
    expect(Object.keys(last('step')).sort()).toEqual(['action', 'goal', 'intent', 'sessionId', 'stepId']);
    click($('[data-sr-name-row="NVDA"] input'));
    await tap('[data-sr-free="set:names"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkNames').rev, op: 'set', part: 'names', value: ['NVDA'] });

    // Find the reasons (1 step), then Confirm these reasons (free)
    await tap('[data-sr-research="build_why"]');
    expect(last('step')).toMatchObject({ goal: 'build_why' });
    expect($('[data-sr-why-proposal]')).not.toBeNull();
    expect($('[data-sr-slot="why"]').dataset.srSlotState).toBe('suggested');
    await tap('[data-sr-free="confirm:why"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkWhy').rev, op: 'confirm', part: 'why' });

    // a wrong-if (the agent's pick), then a time frame (its suggestion)
    await tap('[data-sr-free="confirm:wrongIf"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkConfirmWhy').rev, op: 'confirm', part: 'wrongIf', value: thesisOf('walkConfirmWhy').pick.value });
    await tap('[data-sr-free="confirm:timeFrame"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkWrongIf').rev, op: 'confirm', part: 'timeFrame', value: 'positional' });

    // ready: the server's sentence, as received
    expect($('[data-sr-ready]')).not.toBeNull();
    expect($('[data-sr-sentence]').textContent).toBe(thesisOf('walkTimeFrame').sentence);
    await tap('[data-sr-save-thesis]');
    expect(last('adopt')).toEqual({ action: 'adopt', sessionId: SID, rev: thesisOf('walkTimeFrame').rev });

    // saved (today's state)
    expect($('[data-sr-thesis-saved]').textContent).toBe(B.saved);
    expect($('[data-sr-saved-at]').textContent).toBe(formatWhen(TA.walkGetSaved.body.session.adoption.at));
    expect($('[data-sr-saved-statement]').textContent).toBe(thesisOf('walkTimeFrame').sentence);
    expect($('[data-sr-honest]').textContent).toBe(B.honestLine('Atlas'));
    expect($('[data-sr-idea-book]').textContent).toBe('Atlas’s idea book isn’t reading saved theses yet. Yours is saved to your lists.');
    expect($('[data-sr-done]')).not.toBeNull();
    expect($('[data-sr-equip]').textContent).toContain(COPY.useNext);
    // every request, in order: one at a time, nothing else
    expect(server.calls.map((c) => c.key)).toEqual(['list', 'open', 'step', 'card', 'step', 'card', 'step', 'card', 'card', 'card', 'adopt', 'get']);
  }, 30_000); // eleven requests and their renders: past the default 5 s on a loaded 2-worker runner
});

describe('K-2: the SESSION chooses the view, never the flag', () => {
  it('a ledger investigation renders today\'s Work with the mode on', async () => {
    flags.mode = 'on';
    await openOn(LEDGER.getStepped);
    expect($('[data-sr-builder]')).toBeNull();
    expect($('[data-screen-label^="Work ·"]')).not.toBeNull();
  });
  it('a ledger investigation renders today\'s Work with the mode off', async () => {
    flags.mode = 'off';
    await openOn(LEDGER.getStepped);
    expect($('[data-sr-builder]')).toBeNull();
    expect($('[data-screen-label^="Work ·"]')).not.toBeNull();
  });
  it('a builder investigation renders the builder with the mode off (a rollback keeps open builders working)', async () => {
    flags.mode = 'off';
    await openOn(TA.walkGetMap);
    expect($('[data-sr-builder="one-column"]')).not.toBeNull();
    expect($('[data-screen-label^="Work ·"]')).toBeNull();
  });
});

describe('K-3: Start reads the switch; own words open at once with it on', () => {
  it('off: today\'s Frame my question, a frame request, no open', async () => {
    flags.mode = 'off';
    await start({}, { frame: LEDGER.framed });
    expect($('[data-sr-start-thesis]')).toBeNull();
    typeInto($('#sr-own'), 'I want to play AI');
    await tap('[data-sr-frame]');
    expect(server.sent('frame')).toHaveLength(1);
    expect(server.sent('open')).toHaveLength(0);
  });
  it('on: the own-words open, no framing call; the framing ceiling does not hold it, the day\'s does', async () => {
    flags.mode = 'on';
    await start({}, { list: TA.listFramingLimit, open: TA.walkOpen });
    typeInto($('#sr-own'), 'I want to play AI');
    expect($('[data-sr-start-thesis]').disabled).toBe(false);
    expect($('[data-sr-limit="framing_limit"]')).toBeNull();
    await tap('[data-sr-start-thesis]');
    expect(server.sent('open')).toHaveLength(1);
    expect(server.sent('frame')).toHaveLength(0);
  });
  it('on: the day\'s investigation ceiling holds it', async () => {
    flags.mode = 'on';
    await start({}, { list: TA.listDailyLimit });
    typeInto($('#sr-own'), 'I want to play AI');
    expect($('[data-sr-start-thesis]').disabled).toBe(true);
  });
  it('on, rolled back on the server (400 invalid_entry, W-4): today\'s framing path with the words kept', async () => {
    flags.mode = 'on';
    await start({}, { open: TA.invalidEntry, frame: LEDGER.framed });
    typeInto($('#sr-own'), 'I want to play AI');
    await tap('[data-sr-start-thesis]');
    expect(server.sent('frame')).toHaveLength(1);
    expect(last('frame')).toMatchObject({ action: 'frame', observation: 'I want to play AI' });
    expect($('[data-screen-label^="Framing"]')).not.toBeNull();
    expect(textOf()).toContain('I want to play AI');
  });
  it('on: a lost open, tried again with the same words, re-sends the same requestId', async () => {
    flags.mode = 'on';
    await start({}, { open: [NETWORK, TA.walkOpen] });
    typeInto($('#sr-own'), 'I want to play AI');
    await tap('[data-sr-start-thesis]');
    expect($('[data-sr-refusal]').textContent).toBe(COPY.networkOpen);
    await tap('[data-sr-start-thesis]');
    const [a, b] = server.sent('open').map((c) => c.body.requestId);
    expect(b).toBe(a);
    expect($('[data-sr-builder]')).not.toBeNull();
  });
});

describe('every state, from the server\'s answers', () => {
  // §B13 T-1 (moved, each one less): the open no longer sets the theme, and the walk leaves it suggested
  it.each([
    ['walkGetOpen', 0], ['walkGetMap', 0], ['walkGetSegment', 1], ['walkGetNames', 1], ['walkGetOneStock', 2],
    ['walkGetWhy', 2], ['walkGetConfirmWhy', 3], ['walkGetWrongIf', 4], ['getStoryOpen', 0], ['walkGetThemeConfirm', 1],
  ])('%s: the card head reads the server\'s filled (%i of 6) and the steps left', async (key, n) => {
    await openOn(TA[key]);
    expect($('[data-sr-filled]').textContent).toBe(`${n} of 6`);
    const s = TA[key].body.session;
    expect($('[data-sr-steps-left]').textContent).toBe(B.stepsLeft(s.stepBudget - s.stepsUsed));
    expect(thesisOf(key).filled).toBe(n);
  });
  it('a suggested part reads "suggested" and is never drawn as filled (DR-3)', async () => {
    await openOn(TA.walkGetWhy);
    const why = $('[data-sr-slot="why"]');
    expect(why.dataset.srSlotState).toBe('suggested');
    expect(why.querySelector('[data-sr-suggested-mark]').textContent).toBe(B.suggested);
    expect($('[data-sr-rail="why"]').dataset.srRailState).toBe('suggested');
    expect($('[data-sr-filled]').textContent).toBe('2 of 6'); // §B13 T-1 (moved from 3): the theme is only suggested
    expect($('[data-sr-why-block]')).toBeNull(); // the why block waits for a why that holds a value
  });
  it('a stale part is marked and names what to do: Change it, or check it again for a step', async () => {
    await openOn(TA.getStaleSegment);
    expect($('[data-sr-slot="segment"]').dataset.srSlotState).toBe('stale');
    expect($('[data-sr-stale-mark]').textContent).toBe(B.stale);
    expect($('[data-sr-ready]')).toBeNull();
    expect($('[data-sr-choices="segment"] [data-sr-free="clear:segment"]').textContent).toContain(B.change);
    expect($('[data-sr-choices="segment"] [data-sr-research="strengthen:segment"]').textContent).toContain(B.strengthenPart('Segment'));
  });
  it('the story start (T8a): nothing set, the first choice checks the story against its source', async () => {
    await openOn(TA.getStoryOpen);
    expect($('[data-sr-research="verify_source"]').textContent).toContain(B.goals.verify_source);
    expect($$('[data-sr-research]').map((b) => b.dataset.srResearch)).toEqual(['verify_source']);
    expect($('[data-sr-composer]').dataset.srComposer).toBe('free');
  });
  // §B13 T-6 (moved from the confirm as a marked button in the foot): the suggestion is the theme's line at the top of
  // the choices — "Use … as the theme · free" — and the segment holds the front with Map the segments (T-2)
  it('the story after its check (T8b): the theme suggested, its line at the top of the choices, the map on offer', async () => {
    await openOn(TA.getStoryVerified);
    expect($('[data-sr-slot="theme"]').dataset.srSlotState).toBe('suggested');
    expect($('[data-sr-slot="theme"] [data-sr-suggested-mark]').textContent).toBe(B.suggested);
    // §B14 Watch 10 (moved from "Use “…” as the theme" on one link): the block names the suggestion on its own line
    expect($('[data-sr-theme-line] [data-sr-theme-suggestion]').textContent).toBe('Cloud AI data-center spending');
    const c = $('[data-sr-theme-line] [data-sr-free="confirm:theme"]');
    expect(c.textContent).toContain(B.useIt);
    expect(c.querySelector('[data-sr-cost="free"]').textContent).toBe(B.free);
    expect($('[data-sr-choices]').dataset.srChoices).toBe('segment');
    expect($('[data-sr-research="map_segments"]')).not.toBeNull();
  });
  it('P-1: two columns (D1) only when the sheet itself measures at least 880 px, and never on the phone', async () => {
    const realRO = globalThis.ResizeObserver;
    const realRect = Element.prototype.getBoundingClientRect;
    let width = 900;
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    Element.prototype.getBoundingClientRect = function rect() {
      return this.hasAttribute?.('data-sr-builder-view') ? { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0 } : realRect.call(this);
    };
    try {
      const m = await openOn(TA.walkGetConfirmWhy, { phone: false });
      expect($('[data-sr-builder="two-column"] [data-sr-card]')).not.toBeNull();
      expect($('[data-sr-builder="two-column"] [data-sr-choices]')).not.toBeNull();
      m.unmount(); mounted = mounted.filter((x) => x !== m);
      width = 879;
      const narrow = await openOn(TA.walkGetConfirmWhy, { phone: false });
      expect($('[data-sr-builder="one-column"]')).not.toBeNull();
      narrow.unmount(); mounted = mounted.filter((x) => x !== narrow);
      width = 1200;
      await openOn(TA.walkGetConfirmWhy, { phone: true });
      expect($('[data-sr-builder="one-column"]')).not.toBeNull();
    } finally {
      globalThis.ResizeObserver = realRO;
      Element.prototype.getBoundingClientRect = realRect;
    }
  });
  it('P-1: unmeasured (nothing lays out), it is one column — the hub\'s 720 px sheet is one column too', async () => {
    await openOn(TA.walkGetConfirmWhy, { phone: false });
    expect($('[data-sr-builder="one-column"]')).not.toBeNull();
    expect($('[data-sr-builder="two-column"]')).toBeNull();
  });
  it('the conversation: the player\'s words and taps, the agent\'s replies as stored, the card lines', async () => {
    await openOn(TA.walkGetConfirmWhy);
    const said = $$('[data-sr-said] [data-sr-said-text]').map((n) => n.textContent);
    const stored = TA.walkGetConfirmWhy.body.session.exchanges.filter((e) => e.who === 'partner').map((e) => e.text);
    expect(said).toEqual(stored);
    expect($$('[data-sr-tap]').map((n) => n.dataset.srTap)).toEqual(['map_segments', 'find_names', 'build_why']);
    expect($$('[data-sr-card-line]').map((n) => n.textContent)).toEqual(['Card · Segment: Accelerator chips', 'Card · Names: NVDA', 'Card · Why: confirmed']);
    expect($('[data-sr-words]').textContent).toContain('I want to play AI');
  });
});

describe('K-5: a research step and a free tap never look alike', () => {
  it.each(['walkGetMap', 'walkGetConfirmWhy', 'walkGetWrongIf', 'getStaleSegment'])('%s: every research choice costs "1 step" with the steps left; every free one says "free"', async (key) => {
    await openOn(TA[key]);
    const research = $$('[data-sr-research]');
    const free = $$('[data-sr-free]').filter((b) => b.tagName === 'BUTTON');
    expect(research.length).toBeGreaterThan(0);
    for (const b of research) {
      expect(b.querySelector('[data-sr-cost="step"]').textContent).toBe('1 step');
      expect(b.querySelector('[data-sr-cost="free"]')).toBeNull();
      expect(b.textContent).toContain(B.stepsLeft(TA[key].body.session.stepBudget - TA[key].body.session.stepsUsed));
    }
    for (const b of free) {
      expect(b.querySelector('[data-sr-cost="step"]')).toBeNull();
      if (b.querySelector('[data-sr-cost]')) expect(b.querySelector('[data-sr-cost]').textContent).toBe(B.free);
    }
  });
  it('the goal labels are the copy table\'s', () => {
    expect(B.goals).toMatchObject({
      verify_source: 'Check the story against its source', map_segments: 'Map the segments', find_names: 'Find the listed companies',
      build_why: 'Find the reasons', pick: 'You pick, and tell me why', strengthen: 'Keep researching',
    });
  });
});

describe('K-6: the composer says what sending does', () => {
  it('free mode on the wrong-if: its placeholder, "free" beside Send, and a card op — never a step', async () => {
    await openOn(TA.walkGetConfirmWhy, {}, { card: TA.walkOwnWrongIf });
    expect($('[data-sr-composer]').dataset.srComposer).toBe('free');
    expect($('[data-sr-composer-input]').placeholder).toBe(B.placeholder.wrongIf);
    expect($('[data-sr-composer-send] [data-sr-cost]').textContent).toBe(B.free);
    typeInto($('[data-sr-composer-input]'), 'AMD wins the big cloud accelerator orders instead');
    await tap('[data-sr-composer-send]');
    expect(server.sent('step')).toHaveLength(0);
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkConfirmWhy').rev, op: 'set', part: 'wrongIf', value: { text: 'AMD wins the big cloud accelerator orders instead' } });
  });
  it('the switch: "Point Atlas somewhere · 1 step" → direction mode, a direction step — never a card op', async () => {
    await openOn(TA.walkGetConfirmWhy, {}, { step: TA.walkDirection });
    const sw = $('[data-sr-composer-switch="direction"]');
    expect(sw.textContent).toBe(`${B.pointAgent('Atlas')} · ${B.oneStep}`);
    click(sw);
    expect($('[data-sr-composer]').dataset.srComposer).toBe('direction');
    expect($('[data-sr-composer-send] [data-sr-cost]').textContent).toBe(B.oneStep);
    typeInto($('[data-sr-composer-input]'), 'look at the cloud buyers');
    await tap('[data-sr-composer-send]');
    expect(server.sent('card')).toHaveLength(0);
    expect(last('step')).toEqual({ action: 'step', sessionId: SID, stepId: expect.stringMatching(UUID), intent: 'build', goal: 'direction', direction: 'look at the cloud buyers' });
  });
  it('direction mode where the part in front has no text box (the segment)', async () => {
    await openOn(TA.walkGetMap);
    expect($('[data-sr-composer]').dataset.srComposer).toBe('direction');
    expect($('[data-sr-composer-switch]')).toBeNull();
  });
});

describe('K-7: a tapped part', () => {
  it('a set part opens who set it, its sources and its evidence, and Change', async () => {
    await openOn(TA.walkGetConfirmWhy);
    const slot = $('[data-sr-slot="segment"]');
    expect(slot.getAttribute('aria-expanded')).toBe('false');
    await tap('[data-sr-slot="segment"]');
    expect($('[data-sr-slot="segment"]').getAttribute('aria-expanded')).toBe('true');
    const panel = $('[data-sr-panel="segment"]');
    expect(panel.querySelector('[data-sr-who]').textContent).toBe(B.by.partner_suggested_confirmed('Atlas'));
    const ids = thesisOf('walkGetConfirmWhy').parts.segment.findingIds;
    expect(panel.querySelector('[data-sr-part-evidence]').textContent).toBe(B.sources(ids.length));
    await tap('[data-sr-part-evidence="segment"]');
    expect($$('[data-sr-panel="segment"] [data-sr-finding]').map((n) => n.dataset.srFinding)).toEqual(ids);
    expect(panel.querySelector('[data-sr-change="segment"]')).not.toBeNull();
  });
  // §B13 T-1 (moved from walkGetConfirmWhy, where the open had set the player's words): the player's own phrase, typed
  it('the theme: "you wrote", "Your words · no sources", and no Change — a different theme is a new investigation', async () => {
    await openOn(TA.walkGetThemeOwn);
    await tap('[data-sr-slot="theme"]');
    const panel = $('[data-sr-panel="theme"]');
    expect(panel.querySelector('[data-sr-who]').textContent).toBe('you wrote');
    expect(panel.querySelector('[data-sr-no-sources]').textContent).toBe(B.yourWords);
    expect(panel.querySelector('[data-sr-theme-fixed]').textContent).toBe(B.themeFixed);
    expect(panel.querySelector('[data-sr-change]')).toBeNull();
  });
  it('an unset part that is not in front opens its own choices (the time frame, set early)', async () => {
    await openOn(TA.walkGetOneStock, {}, { card: TA.walkOneStock });
    await tap('[data-sr-slot="timeFrame"]');
    expect($$('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]').map((b) => b.dataset.srFreeValue)).toEqual(['swing', 'positional', 'longterm']);
  });
  it('All evidence: the existing evidence list, one tap back', async () => {
    await openOn(TA.walkGetConfirmWhy);
    await tap('[data-sr-all-evidence-open]');
    const rec = TA.walkGetConfirmWhy.body.record.findings.filter((f) => f.kind !== 'next_action');
    expect($$('[data-sr-all-evidence] [data-sr-finding]')).toHaveLength(rec.length);
    await tap('[data-sr-back-to-thesis]');
    expect($('[data-sr-card]')).not.toBeNull();
  });
});

describe('K-8: Change asks first when it clears other parts', () => {
  it('Changing Segment also clears Names and Why: nothing is sent until the player confirms', async () => {
    await openOn(TA.walkGetReady, {}, { card: TA.walkSegment });
    await tap('[data-sr-slot="segment"]');
    await tap('[data-sr-change="segment"]');
    expect($('[data-sr-clear-confirm="segment"]').textContent).toContain('Changing Segment also clears Names and Why.');
    expect(server.sent('card')).toHaveLength(0);
    await tap('[data-sr-clear-yes]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkGetReady').rev, op: 'clear', part: 'segment' });
  });
  it('Keep it sends nothing', async () => {
    await openOn(TA.walkGetReady);
    await tap('[data-sr-slot="names"]');
    await tap('[data-sr-change="names"]');
    expect($('[data-sr-clear-confirm="names"]').textContent).toContain('Changing Names also clears Why.');
    await tap('[data-sr-clear-no]');
    expect($('[data-sr-clear-confirm]')).toBeNull();
    expect(server.sent('card')).toHaveLength(0);
  });
  it('a Change that clears nothing else goes at once', async () => {
    await openOn(TA.walkGetReady, {}, { card: TA.walkWrongIf });
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-change="timeFrame"]');
    expect($('[data-sr-clear-confirm]')).toBeNull();
    expect(last('card')).toMatchObject({ op: 'clear', part: 'timeFrame' });
  });
});

describe('K-10: the agent\'s pick', () => {
  it('a pick on a free choice: marked, its reason tagged as the agent\'s reasoning, the part still unset', async () => {
    await openOn(TA.walkGetMap);
    const b = $('[data-sr-free="confirm:segment"]');
    expect(b.querySelector('[data-sr-mark]').textContent).toBe(B.pickTag('Atlas'));
    expect(b.querySelector('[data-sr-pick-reason]').textContent).toContain(thesisOf('walkGetMap').pick.reason);
    expect(b.querySelector('[data-sr-pick-reason]').textContent).toContain(B.reasoningTag('Atlas'));
    expect(b.textContent).not.toContain('Source-backed');
    expect($('[data-sr-slot="segment"]').dataset.srSlotState).toBe('unset');
    expect($('[data-sr-filled]').textContent).toBe('0 of 6'); // §B13 T-1 (moved from 1): the theme is only suggested
    // the matching `set` is not drawn beside it: one button per value
    expect($$('[data-sr-free="set:segment"]').map((n) => n.dataset.srFreeValue)).not.toContain('Accelerator chips');
  });
  it('the asked pick: its reasons, each tagged from its own basis; the confirm beside the other choices', async () => {
    await openOn(TA.getPickAsked);
    const reasons = $$('[data-sr-asked-pick] [data-sr-pick-basis]');
    expect(reasons.map((n) => n.dataset.srPickBasis)).toEqual(['source', 'reasoning', 'source']);
    expect(reasons[0].textContent).toContain('Source-backed');
    expect(reasons[1].textContent).toContain(B.reasoningTag('Atlas'));
    expect(reasons[1].textContent).not.toContain('Source-backed');
    expect($('[data-sr-free="confirm:segment"]').textContent).toContain(B.confirmValue('GPUs and accelerators'));
    expect($('[data-sr-slot="segment"]').dataset.srSlotState).toBe('suggested');
  });
  it('the fallback name: "your agent", capitalized where it opens a mark', async () => {
    await openOn(TA.walkGetMap, { agentName: null });
    expect($('[data-sr-free="confirm:segment"] [data-sr-mark]').textContent).toBe('Your agent’s pick');
    expect(textOf()).not.toMatch(/Atlas/);
  });
});

describe('K-10b: the names', () => {
  it('each supported company a row to tick; the pick marked; a lead shown, not tickable; one free button sends the ticked', async () => {
    await openOn(TA.walkGetNames, {}, { card: TA.walkOneStock });
    const rows = $$('[data-sr-name-row]');
    expect(rows.map((r) => r.dataset.srNameRow)).toEqual(['NVDA', 'AMD', 'AVGO']);
    const nvda = TA.walkGetNames.body.companies.supported.find((c) => c.symbol === 'NVDA');
    expect(rows[0].textContent).toContain(nvda.name);
    expect(rows[0].textContent).toContain(B.sources(nvda.evidence.length));
    expect($$('[data-sr-name-pick]').map((n) => n.dataset.srNamePick)).toEqual(['NVDA', 'AMD']);
    const lead = $('[data-sr-name-lead="Orrin Compute"]');
    expect(lead.textContent).toContain(B.lead);
    expect(lead.querySelector('input')).toBeNull();
    expect($('[data-sr-free="set:names"]').disabled).toBe(true);
    click($('[data-sr-name-row="AVGO"] input'));
    click($('[data-sr-name-row="NVDA"] input'));
    expect($('[data-sr-free="set:names"]').textContent).toContain(B.namesBuild('NVDA and AVGO'));
    await tap('[data-sr-free="set:names"]');
    expect(last('card')).toMatchObject({ op: 'set', part: 'names', value: ['NVDA', 'AVGO'] });
  });
  it('the agent\'s names pick has its own confirm', async () => {
    await openOn(TA.walkGetNames, {}, { card: TA.walkConfirmNames });
    await tap('[data-sr-free="confirm:names"]');
    expect(last('card')).toMatchObject({ op: 'confirm', part: 'names', value: ['NVDA', 'AMD'] });
  });
});

describe('K-11: the why', () => {
  it('a proposal: the shared reason, the reason per name with its sources, the point against, Confirm these reasons · free', async () => {
    await openOn(TA.walkGetWhy);
    const p = thesisOf('walkGetWhy').parts.why.proposal;
    expect($('[data-sr-proposal-shared]').textContent).toBe(p.shared);
    expect($$('[data-sr-proposal-reason]').map((n) => n.dataset.srProposalReason)).toEqual(['NVDA']);
    expect($('[data-sr-why-proposal] [data-sr-against]').textContent).toContain(p.against.text);
    const c = $('[data-sr-free="confirm:why"]');
    expect(c.textContent).toContain(B.confirmWhy);
    expect(c.querySelector('[data-sr-cost]').textContent).toBe(B.free);
  });
  it('an incomplete why: the name without a Source-backed reason is said; no confirm; the drop goes at once (it clears nothing)', async () => {
    await openOn(TA.getIncompleteWhy, {}, { card: TA.dropUnsourced });
    expect($('[data-sr-incomplete="AMD"]')).not.toBeNull();
    expect($('[data-sr-free="confirm:why"]')).toBeNull();
    const drop = $('[data-sr-free="set:names"]');
    expect(drop.textContent).toContain(B.dropUnsourced('NVDA'));
    await tap('[data-sr-free="set:names"]');
    expect(last('card')).toMatchObject({ op: 'set', part: 'names', value: ['NVDA'] });
  });
  it('the revised why (§B12 W-13): offered → the waiting proposal beside the set why, "Use the revised why · free"', async () => {
    await openOn(TA.getRevisedWhy, {}, { card: TA.useRevisedWhy });
    await tap('[data-sr-revised-waiting]');
    expect($('[data-sr-revised-proposal]')).not.toBeNull();
    const use = $('[data-sr-free="confirm:why:revised"]');
    expect(use.textContent).toContain(B.useRevised);
    await tap('[data-sr-free="confirm:why:revised"]');
    const body = last('card');
    expect(body).toMatchObject({ op: 'confirm', part: 'why' });
    expect(Object.keys(body).sort()).toEqual(['action', 'op', 'opId', 'part', 'rev', 'sessionId']);
  });
  it('without the server\'s `revised` choice there is no revised button', async () => {
    await openOn(TA.walkGetReady);
    expect($('[data-sr-revised-waiting]')).toBeNull();
    await tap('[data-sr-slot="why"]');
    expect($('[data-sr-free="confirm:why:revised"]')).toBeNull();
  });
});

describe('K-12: ready and Save', () => {
  it('Save is drawn only on a ready card', async () => {
    await openOn(TA.walkGetConfirmWhy);
    expect($('[data-sr-save-thesis]')).toBeNull();
    expect(textOf()).not.toContain(B.save);
  });
  it('ready (T5): the server\'s sentence, Edit, the names, the why, How it will be judged', async () => {
    await openOn(TA.walkGetReady);
    const t = thesisOf('walkGetReady');
    expect($('[data-sr-sentence="server"]').textContent).toBe(t.sentence);
    expect($('[data-sr-edit]').textContent).toBe(B.edit);
    expect($('[data-sr-ready-names]').textContent).toContain('NVDA');
    expect($('[data-sr-ready-names]').textContent).toContain(B.oneStock);
    expect($('[data-sr-judged]').textContent).toContain(t.parts.timeFrame.label);
    expect($('[data-sr-judged]').textContent).toContain(t.parts.wrongIf.text);
    expect($('[data-sr-save-thesis]').disabled).toBe(false);
  });
  it('the group (T5G): three names, one reason each, the shared reason in the server\'s sentence', async () => {
    await openOn(TA.getGroupReady);
    const t = thesisOf('getGroupReady');
    expect($('[data-sr-sentence="server"]').textContent).toBe(t.sentence);
    expect($('[data-sr-ready-names]').textContent).toContain(B.nNames(3));
    expect($$('[data-sr-ready] [data-sr-reason]').map((n) => n.dataset.srReason)).toEqual(['NVDA', 'AMD', 'AVGO']);
    expect($('[data-sr-why-block]').textContent).toContain(B.perName);
  });
  it('saveIssue: Save disabled, with the line for its code (the server\'s own words)', async () => {
    await openOn(TA.getSaveIssue);
    expect($('[data-sr-save-thesis]').disabled).toBe(true);
    expect($('[data-sr-save-issue="names_not_supported"]').textContent).toBe(SR_SERVER_COPY.names_not_supported);
  });
  it('an edit is sent as `statement`; a refusal keeps the edit on screen with the server\'s message', async () => {
    await openOn(TA.walkGetReady, {}, { adopt: TA.adoptUnsupported });
    await tap('[data-sr-edit]');
    const mine = `${thesisOf('walkGetReady').sentence} It could take 30 percent of the market.`;
    typeInto($('#sr-thesis-edit'), mine);
    await tap('[data-sr-save-thesis]');
    expect(last('adopt')).toEqual({ action: 'adopt', sessionId: SID, rev: thesisOf('walkGetReady').rev, statement: mine });
    expect($('[data-sr-save="failed"]').textContent).toBe(TA.adoptUnsupported.body.message);
    expect($('#sr-thesis-edit').value).toBe(mine);
  });
  it('not_ready shows the blockers the answer carries', async () => {
    await openOn(TA.walkGetReady, {}, { adopt: TA.notReady });
    await tap('[data-sr-save-thesis]');
    expect($('[data-sr-blockers]').textContent).toBe(B.stillToSet('Wrong if, Time frame'));
  });
  it('the uncertain save: only Check the record — no Save is sent again before the check; the check finds it saved', async () => {
    await openOn(TA.walkGetReady, {}, { adopt: NETWORK });
    await tap('[data-sr-save-thesis]');
    expect($('[data-sr-save="uncertain"]').textContent).toBe(COPY.saveUncertain);
    expect($('[data-sr-save-thesis]')).toBeNull();
    expect($('[data-sr-check]')).not.toBeNull();
    server.set('get', TA.walkGetSaved);
    await tap('[data-sr-check]');
    expect(server.sent('adopt')).toHaveLength(1);
    expect($('[data-sr-thesis-saved]')).not.toBeNull();
    expect($('[data-sr-recovered]').textContent).toBe(COPY.recovered);
  });
  it('a stale card on Save: the fresh card, the server\'s line, the edit kept, nothing re-sent', async () => {
    await openOn(TA.walkGetReady, {}, { adopt: TA.adoptStale });
    await tap('[data-sr-edit]');
    const mine = `${thesisOf('walkGetReady').sentence} Mine.`;
    typeInto($('#sr-thesis-edit'), mine);
    await tap('[data-sr-save-thesis]');
    expect($('[data-sr-save="stale"]').textContent).toBe(SR_SERVER_COPY.card_stale);
    expect($('#sr-thesis-edit').value).toBe(mine);
    expect(server.sent('adopt')).toHaveLength(1);
  });
});

describe('the review\'s fixes (4A: display honesty)', () => {
  it('4A-1: the point against carries its count, never a Source-backed tag (the view holds no basis for it)', async () => {
    await openOn(TA.walkGetWhy);
    const against = $('[data-sr-why-proposal] [data-sr-against]');
    expect(against.textContent).toContain(thesisOf('walkGetWhy').parts.why.proposal.against.text);
    expect(against.textContent).not.toContain('Source-backed');
    expect(against.textContent).toContain(B.sources(thesisOf('walkGetWhy').parts.why.proposal.against.findingIds.length));
  });
  it('4A-3: a saved thesis reopened shows no sentence as the saved one (no answer carries the statement)', async () => {
    await openOn(TA.walkGetSaved);
    expect($('[data-sr-thesis-saved]')).not.toBeNull();
    expect($('[data-sr-saved-statement]')).toBeNull();
    expect($('[data-sr-saved-line]').textContent).toContain('NVDA');
  });
  it('4A-4: a reason the server no longer holds wears no Source-backed tag — a stale why, a proposal name without a sourced reason', async () => {
    await openOn(TA.getStaleWhy);
    expect($('[data-sr-slot="why"]').dataset.srSlotState).toBe('stale');
    expect($('[data-sr-why-block] [data-sr-reason]').textContent).not.toContain('Source-backed');
  });
  it('4A-4: a waiting proposal whose reason a correction superseded: no tag on that name\'s reason', async () => {
    await openOn(TA.getProposalCorrected);
    expect($('[data-sr-incomplete="NVDA"]')).not.toBeNull();
    expect($('[data-sr-proposal-reason="NVDA"]').textContent).not.toContain('Source-backed');
  });
  it('4A-4 control: a set, holding why tags its reasons Source-backed', async () => {
    await openOn(TA.walkGetConfirmWhy);
    await tap('[data-sr-why-block] button');
    expect($('[data-sr-why-block] [data-sr-reason]').textContent).toContain('Source-backed');
  });
  it('4A-6: saveIssue holds Save for the composed sentence only; with the player\'s own edit, Save goes and the server judges it', async () => {
    await openOn(TA.getSaveIssue);
    expect($('[data-sr-save-thesis]').disabled).toBe(true);
    await tap('[data-sr-edit]');
    typeInto($('#sr-thesis-edit'), thesisOf('getSaveIssue').sentence.replace('AMD wins', 'a rival wins'));
    expect($('[data-sr-save-issue]')).toBeNull();
    expect($('[data-sr-save-thesis]').disabled).toBe(false);
  });
  it('4A-2: a step started from the ready view goes on in the work view, its working line there', async () => {
    const held = deferred();
    await openOn(TA.walkGetReady, {}, { step: () => held.promise });
    await tap('[data-sr-slot="why"]');
    click($('[data-sr-panel="why"] [data-sr-research="strengthen:why"]'));
    await flush();
    expect($('[data-sr-ready]')).toBeNull();
    expect($('[data-sr-builder] [data-sr-working]')).not.toBeNull();
    held.resolve(TA.revisedWhy);
    await flush();
  });
});

describe('the review\'s fixes (4B: state and wiring)', () => {
  it('4B-1: a lost step keeps its stepId through another request\'s refusal; a lost tap keeps its opId through a step', async () => {
    await openOn(TA.walkGetSegment, {}, { step: [NETWORK, NETWORK, TA.walkNames], card: [NETWORK, TA.stepInFlight] });
    await tap('[data-sr-research="find_names"]'); // lost
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]'); // lost too
    await tap('[data-sr-panel-close="timeFrame"]'); // (the foot folds its choices while another part's panel is open: 4C-4)
    await tap('[data-sr-research="find_names"]'); // lost again: the same stepId
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]'); // answered 409 step_in_flight
    await tap('[data-sr-panel-close="timeFrame"]');
    await tap('[data-sr-research="find_names"]'); // answered
    const steps = server.sent('step').map((c) => c.body.stepId);
    expect(new Set(steps).size).toBe(1);
    const cards = server.sent('card').map((c) => c.body.opId);
    expect(cards[1]).toBe(cards[0]);
  });
  it('4B-2: a step answered 409 step_in_flight offers Try again, and the same tap keeps its stepId', async () => {
    await openOn(TA.walkGetSegment, {}, { step: [NETWORK, TA.stepInFlight, TA.walkNames] });
    await tap('[data-sr-research="find_names"]');
    await tap('[data-sr-retry-step]');
    expect($('[data-sr-step-failed="step_in_flight"]').textContent).toBe(SR_SERVER_COPY.step_in_flight);
    expect($('[data-sr-retry-step]')).not.toBeNull();
    await tap('[data-sr-research="find_names"]');
    const ids = server.sent('step').map((c) => c.body.stepId);
    expect(ids).toEqual([ids[0], ids[0], ids[0]]);
  });
  it('4B-3: a stale card on Save that is no longer ready: the line shows on the work view, and the edit comes back when the card is ready again', async () => {
    const staleNotReady = { status: 409, body: { ...TA.adoptStale.body, thesis: TA.cardStale.body.thesis } };
    await openOn(TA.walkGetReady, {}, { adopt: staleNotReady, card: TA.walkTimeFrame });
    await tap('[data-sr-edit]');
    const mine = `${thesisOf('walkGetReady').sentence} Mine.`;
    typeInto($('#sr-thesis-edit'), mine);
    await tap('[data-sr-save-thesis]');
    expect($('[data-sr-ready]')).toBeNull();
    expect($('[data-sr-builder] [data-sr-save="stale"]').textContent).toBe(SR_SERVER_COPY.card_stale);
    // the card is made ready again (a free tap answered with the ready card): the player's sentence is still theirs
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]');
    expect($('[data-sr-ready]')).not.toBeNull();
    expect($('#sr-thesis-edit').value).toBe(mine);
  });
  it('4B-3: not_ready carries no card: the investigation is read again', async () => {
    await openOn(TA.walkGetReady, {}, { adopt: TA.notReady });
    await tap('[data-sr-save-thesis]');
    expect(server.sent('get')).toHaveLength(2);
  });
  it('4B-4: a step started from the ready view shows its working line, then its failure with Try again', async () => {
    const held = deferred();
    await openOn(TA.walkGetReady, {}, { step: [() => held.promise, TA.walkNames] });
    await tap('[data-sr-slot="names"]');
    click($('[data-sr-panel="names"] [data-sr-research="strengthen:names"]'));
    await flush();
    expect($('[data-sr-ready] ~ [data-sr-working], [data-sr-working]').textContent).toBe(B.workingLine('Atlas'));
    held.resolve(TA.serverError);
    await flush();
    expect($('[data-sr-step-failed="server_error"]').textContent).toBe(SR_SERVER_COPY.server_error);
    await tap('[data-sr-retry-step]');
    const [a, b] = server.sent('step').map((c) => c.body);
    expect(b).toEqual(a);
  });
  it('4B-4: a 429 on the ready view holds its controls until the wait has passed', async () => {
    await openOn(TA.walkGetReady, {}, { card: TA.rateLimited });
    await tap('[data-sr-price-open]');
    typeInto($('[data-sr-price-level="NVDA"]'), '120');
    await tap('[data-sr-free="set:wrongIf:priceLines"]');
    expect($('[data-sr-card-failed="rate_limited"]')).not.toBeNull();
    expect($('[data-sr-free="set:wrongIf:priceLines"]').disabled).toBe(true);
    expect($('[data-sr-edit]').disabled).toBe(true);
  });
  it('4B-5: a Change confirm belongs to its investigation: opening the earlier one and coming back leaves none', async () => {
    const withPrevious = { status: 200, body: { ...TA.walkGetConfirmWhy.body, previous: { sessionId: TA.ids.pickSid, endedAt: '2026-11-16T15:00:00.000Z', terminalReason: 'concluded' } } };
    await openOn(withPrevious, {}, { get: [withPrevious, TA.getPickAsked, withPrevious] });
    await tap('[data-sr-slot="segment"]');
    await tap('[data-sr-change="segment"]');
    expect($('[data-sr-clear-confirm]')).not.toBeNull();
    await tap(`[data-sr-previous="${TA.ids.pickSid}"] button`);
    expect($('[data-sr-clear-confirm]')).toBeNull();
    await tap('[data-sr-conversation] button');
    expect($('[data-sr-clear-confirm]')).toBeNull();
    expect(server.sent('card')).toHaveLength(0);
  });
  it('4B-6: own words keep their own requestId: a story opened between two tries does not take it', async () => {
    flags.mode = 'on';
    await start({ stories: [kit.storyOf()] }, { open: [NETWORK, NETWORK, TA.walkOpen] });
    typeInto($('#sr-own'), 'I want to play AI');
    await tap('[data-sr-start-thesis]');
    await tap('[data-sr-story]');
    await tap('[data-sr-investigate]');
    await tap('[data-screen-label="Item preview"] button');
    typeInto($('#sr-own'), 'I want to play AI');
    await tap('[data-sr-start-thesis]');
    const [own1, story, own2] = server.sent('open').map((c) => c.body.requestId);
    expect(own2).toBe(own1);
    expect(story).not.toBe(own1);
  });
  it('4B-7: a card answer that shows a step landed unheard reads the investigation again', async () => {
    await openOn(TA.walkGetSegment, {}, { step: NETWORK, card: TA.walkOneStock, get: [TA.walkGetSegment, TA.walkGetOneStock] });
    await tap('[data-sr-research="find_names"]');
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]');
    expect(server.sent('get')).toHaveLength(2);
  });
  it('a step left running on a reopened sheet: Check again reads it (its goal is not known, so nothing is re-sent)', async () => {
    const running = { status: 200, body: { ...TA.walkGetSegment.body, session: { ...TA.walkGetSegment.body.session, lastStep: { stepId: '5e5e5e5e-0000-4000-8000-0000000000aa', intent: 'build', status: 'running', startedAt: '2026-11-17T14:03:00.000Z', endedAt: null, error: null } } } };
    await openOn(running, {}, { get: [running, TA.walkGetNames] });
    await tap('[data-sr-check-again]');
    expect(server.sent('get')).toHaveLength(2);
    expect(server.sent('step')).toHaveLength(0);
  });
});

describe('K-13: what the idea book allows the screen to say', () => {
  // §B13 T-8 (b) (moved from "in your words" on every wrong-if): the walk's wrong-if is the agent's pick, confirmed
  it('the wrong-if the player did not write reads "in words"; the price line "optional · add your own"; nothing watched', async () => {
    await openOn(TA.walkGetReady, {}, { card: TA.walkPriceLine });
    expect(thesisOf('walkGetReady').parts.wrongIf.by).toBe('partner_suggested_confirmed');
    expect($('[data-sr-wrongif-tag]').textContent).toBe(B.inWords);
    expect($('[data-sr-judged]').textContent).not.toContain(B.inYourWords);
    expect($('[data-sr-price-open]').textContent).toBe(B.priceOptional);
    expect(textOf()).not.toMatch(/watched|will sell|sells at|holds it|held for|expire/i);
    await tap('[data-sr-price-open]');
    typeInto($('[data-sr-price-level="NVDA"]'), '120');
    await tap('[data-sr-free="set:wrongIf:priceLines"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkGetReady').rev, op: 'set', part: 'wrongIf', value: { priceLines: [{ symbol: 'NVDA', level: 120 }] } });
    expect($('[data-sr-price-line="NVDA"]').textContent).toBe(B.priceSet('NVDA', 120));
  });
});

describe('K-15: the hard states', () => {
  it('waiting (T7): the working line only while the request is in flight, no duration', async () => {
    const held = deferred();
    await openOn(TA.walkGetSegment, {}, { step: () => held.promise });
    expect($('[data-sr-working]')).toBeNull();
    click($('[data-sr-research="find_names"]'));
    await flush();
    const line = $('[data-sr-working]');
    expect(line.getAttribute('role')).toBe('status');
    expect(line.textContent).toBe(B.workingLine('Atlas'));
    expect(line.textContent).not.toMatch(/\d/);
    expect($('[data-sr-slot="names"]').textContent).toBe(B.working('Atlas'));
    held.resolve(TA.walkNames);
    await flush();
    expect($('[data-sr-working]')).toBeNull();
  });
  it('a failed step (T10b): nothing was added; Try again re-sends the same stepId, goal and part', async () => {
    await openOn(TA.walkGetSegment, {}, { step: [TA.stepFailed, TA.walkNames] });
    await tap('[data-sr-research="find_names"]');
    expect($('[data-sr-step-failed]').getAttribute('role')).toBe('alert');
    expect($('[data-sr-step-failed]').textContent).toBe(COPY.server.step_failed);
    const retry = $('[data-sr-retry-step]');
    expect(retry.textContent).toContain(B.tryAgainGoal(B.goals.find_names));
    await tap('[data-sr-retry-step]');
    const [a, b] = server.sent('step').map((c) => c.body);
    expect(b).toEqual(a);
  });
  it('the dead end (T9): the reply, Conclude (keeps the research), Try another segment (asks first), the composer in direction mode', async () => {
    await openOn(TA.getDeadEnd, {}, { close: TA.closeDeadEnd, card: TA.tryAnotherSegment });
    expect(textOf()).toContain(TA.getDeadEnd.body.session.exchanges.at(-1).text);
    expect($('[data-sr-conclude]').textContent).toContain(B.keepsResearch);
    expect($('[data-sr-composer]').dataset.srComposer).toBe('direction');
    await tap('[data-sr-free="clear:segment"]');
    expect($('[data-sr-clear-confirm="segment"]')).not.toBeNull();
    await tap('[data-sr-clear-yes]');
    expect(last('card')).toMatchObject({ op: 'clear', part: 'segment' });
  });
  it('the dead end: Conclude is B1\'s close', async () => {
    await openOn(TA.getDeadEnd, {}, { close: TA.closeDeadEnd });
    await tap('[data-sr-conclude]');
    expect(last('close')).toEqual({ action: 'close', sessionId: TA.getDeadEnd.body.session.sessionId, reason: 'concluded' });
  });
  it('out of steps (T10a): the budget named, no research, the free choices, Conclude with what we have', async () => {
    await openOn(TA.getOutOfSteps);
    expect($('[data-sr-out-of-steps]').textContent).toBe(B.outOfSteps(10));
    expect($$('[data-sr-research]')).toHaveLength(0);
    expect($$('[data-sr-choices] [data-sr-free="set:wrongIf"]').length).toBeGreaterThan(0);
    expect($('[data-sr-composer]').dataset.srComposer).toBe('free');
    expect($('[data-sr-composer-switch]')).toBeNull();
    expect(textOf()).toContain(B.concludeWithWhatWeHave);
  });
  it('a stale card (409 card_stale): the fresh card from the answer, the server\'s line, never re-sent', async () => {
    await openOn(TA.walkGetOneStock, {}, { card: TA.cardStale });
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]');
    await flush();
    expect(server.sent('card')).toHaveLength(1);
    expect($('[data-sr-card-failed="card_stale"]').textContent).toBe(SR_SERVER_COPY.card_stale);
    expect($('[data-sr-slot="why"]').dataset.srSlotState).toBe(TA.cardStale.body.thesis.parts.why.state);
  });
  it('a retried tap after a lost answer re-sends the same opId and rev', async () => {
    await openOn(TA.walkGetMap, {}, { card: [NETWORK, TA.walkSegment] });
    await tap('[data-sr-free="confirm:segment"]');
    expect($('[data-sr-card-failed="network"]')).not.toBeNull();
    await tap('[data-sr-free="confirm:segment"]');
    const [a, b] = server.sent('card').map((c) => c.body);
    expect(b).toEqual(a);
  });
  it('a lost step, tapped again: the same stepId', async () => {
    await openOn(TA.walkGetSegment, {}, { step: [NETWORK, TA.walkNames] });
    await tap('[data-sr-research="find_names"]');
    await tap('[data-sr-research="find_names"]');
    const [a, b] = server.sent('step').map((c) => c.body);
    expect(b.stepId).toBe(a.stepId);
  });
  it('a refusal shows the server\'s line (step_in_flight)', async () => {
    await openOn(TA.walkGetMap, {}, { card: TA.stepInFlight });
    await tap('[data-sr-free="confirm:segment"]');
    expect($('[data-sr-card-failed="step_in_flight"]').textContent).toBe(SR_SERVER_COPY.step_in_flight);
  });
  it('429: its line, and every choice held until it has passed', async () => {
    await openOn(TA.walkGetMap, {}, { card: TA.rateLimited });
    await tap('[data-sr-free="confirm:segment"]');
    expect($('[data-sr-free="confirm:segment"]').disabled).toBe(true);
    expect($('[data-sr-research="map_segments"]').disabled).toBe(true);
  });
});

describe('K-16: one request at a time, taps included', () => {
  it('a free tap in flight: a second tap, a step and the composer send nothing', async () => {
    const held = deferred();
    await openOn(TA.walkGetMap, {}, { card: () => held.promise });
    click($('[data-sr-free="confirm:segment"]'));
    await flush();
    click($('[data-sr-free="confirm:segment"]'));
    click($('[data-sr-research="map_segments"]'));
    await flush();
    expect(server.sent('card')).toHaveLength(1);
    expect(server.sent('step')).toHaveLength(0);
    held.resolve(TA.walkSegment);
    await flush();
  });
  it('a step in flight: every free choice is held', async () => {
    const held = deferred();
    await openOn(TA.walkGetMap, {}, { step: () => held.promise });
    click($('[data-sr-research="map_segments"]'));
    await flush();
    for (const b of $$('[data-sr-choices] button[data-sr-free]')) expect(b.disabled).toBe(true);
    held.resolve(TA.walkMap);
    await flush();
  });
});

describe('the review\'s fixes (4C: accessibility and phone)', () => {
  const settle = () => new Promise((r) => { setTimeout(r, 10); });
  it('4C-2: the choices\' Change asks in the choices, beside the control, and its safe answer takes focus', async () => {
    await openOn(TA.getStaleSegment);
    await tap('[data-sr-choices] [data-sr-free="clear:segment"]');
    expect($('[data-sr-choices] [data-sr-clear-confirm="segment"]')).not.toBeNull();
    expect($('[data-sr-card] [data-sr-clear-confirm]')).toBeNull();
    expect(document.activeElement).toBe($('[data-sr-clear-no]'));
  });
  it('4C-1: the panel\'s close puts focus back on its part', async () => {
    await openOn(TA.walkGetConfirmWhy);
    await tap('[data-sr-slot="segment"]');
    await tap('[data-sr-panel-close="segment"]');
    await act(async () => { await settle(); });
    expect(document.activeElement).toBe($('[data-sr-slot="segment"]'));
  });
  it('P-2 (replaces 4C-4\'s folding foot): another part\'s panel holds its own choices; the conversation\'s stay where they are', async () => {
    await openOn(TA.walkGetOneStock);
    expect($('[data-sr-choices] [data-sr-research="build_why"]')).not.toBeNull();
    await tap('[data-sr-slot="timeFrame"]');
    expect($('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]')).not.toBeNull();
    expect($('[data-sr-choices] [data-sr-research="build_why"]')).not.toBeNull();
    expect($('[data-sr-choices] [data-sr-free="set:timeFrame"]')).toBeNull();
  });
  it('4C-7: the save issue\'s line sits beside Save and describes it', async () => {
    await openOn(TA.getSaveIssue);
    const line = $('[data-sr-foot] [data-sr-save-issue]');
    expect(line).not.toBeNull();
    expect($('[data-sr-save-thesis]').getAttribute('aria-describedby')).toBe(line.id);
  });
  it('4C-8: the panel\'s close is named for its part', async () => {
    await openOn(TA.walkGetConfirmWhy);
    await tap('[data-sr-slot="segment"]');
    expect($('[data-sr-panel-close="segment"]').getAttribute('aria-label')).toBe(B.closePart('Segment'));
  });
  it('4C-9: the conversation is a log, so a new turn is announced', async () => {
    await openOn(TA.walkGetConfirmWhy);
    expect($('[data-sr-conversation]').getAttribute('role')).toBe('log');
  });
  it('4C nits: a part\'s name says which part it is; two composers never share an id', async () => {
    await openOn(TA.walkGetWhy);
    expect($('[data-sr-slot="names"]').getAttribute('aria-label')).toBe(B.partLabel('Names', 'NVDA'));
    await tap('[data-sr-slot="wrongIf"]');
    const ids = $$('[data-sr-composer-input]').map((i) => i.id);
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('the refuter\'s round (fixes that regressed or fell short)', () => {
  /** The GET after a lost step that the server DID run: the held answer, its step's exchange on it (as the server writes one). */
  const landedGetOf = (base, stepId) => {
    const s = base.body.session;
    const partner = { ...s.exchanges.findLast((e) => e.who === 'partner'), stepId, goal: 'find_names', at: '2026-11-17T14:02:00.000Z' };
    return { status: 200, body: { ...base.body, session: { ...s, stepsUsed: s.stepsUsed + 1, lastStep: { ...s.lastStep, stepId }, exchanges: [...s.exchanges, partner] } } };
  };

  it('R1: a lost tap that never landed, sent again after the card moved on: a new tap — a fresh opId, the card\'s rev as it is now', async () => {
    await openOn(TA.walkGetSegment, {}, { card: [NETWORK, TA.stepInFlight], step: TA.walkNames });
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]'); // lost
    await tap('[data-sr-panel-close="timeFrame"]');
    await tap('[data-sr-research="find_names"]'); // lands: the card's rev moves on
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]');
    const [a, b] = server.sent('card').map((c) => c.body);
    expect(thesisOf('walkNames').rev).not.toBe(thesisOf('walkGetSegment').rev);
    expect(a.rev).toBe(thesisOf('walkGetSegment').rev);
    expect(b).toEqual({ ...a, opId: expect.stringMatching(UUID), rev: thesisOf('walkNames').rev });
    expect(b.opId).not.toBe(a.opId);
  });
  it('R1 (refuter 2): a lost tap that DID land, tapped again after the part was changed: a new tap the server applies, never the landed opId', async () => {
    const r = thesisOf('walkGetSegment').rev;
    await openOn(TA.walkGetSegment, {}, { card: [NETWORK, TA.timeFrameLanded, TA.clearTimeFrameAgain, TA.swingAgain] });
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"][data-sr-free-value="swing"]'); // lost: the server set swing
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"][data-sr-free-value="positional"]'); // 409: the card swing made
    expect($('[data-sr-slot="timeFrame"]').dataset.srSlotState).toBe('set');
    await tap('[data-sr-change="timeFrame"]'); // the player changes it
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"][data-sr-free-value="swing"]'); // and wants swing now
    const bodies = server.sent('card').map((c) => c.body);
    expect(bodies.map((b) => b.rev)).toEqual([r, r, r + 1, r + 2]);
    expect(bodies[3]).toMatchObject({ op: 'set', part: 'timeFrame', value: 'swing', rev: thesisOf('clearTimeFrameAgain').rev });
    expect(bodies[3].opId).not.toBe(bodies[0].opId);
    expect($('[data-sr-slot="timeFrame"]').dataset.srSlotState).toBe('set');
  });
  it('R1: a lost step that has since landed (its exchange is on screen): a new tap is a new step, with a new stepId', async () => {
    await openOn(TA.walkGetSegment, {}, {
      step: [NETWORK, TA.walkNames], card: TA.walkOneStock,
      get: [TA.walkGetSegment, () => landedGetOf(TA.walkGetSegment, server.sent('step')[0].body.stepId)],
    });
    await tap('[data-sr-research="find_names"]'); // lost — but the server ran it
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]'); // its answer shows the step landed: read again
    expect(server.sent('get')).toHaveLength(2);
    if ($('[data-sr-panel-close="timeFrame"]')) await tap('[data-sr-panel-close="timeFrame"]');
    await tap('[data-sr-research="find_names"]');
    const [a, b] = server.sent('step').map((c) => c.body.stepId);
    expect(b).toMatch(UUID);
    expect(b).not.toBe(a);
  });
  it('R2: saveIssue holds Save while the sentence is the server\'s, however it is typed (the same words, a space after)', async () => {
    await openOn(TA.getSaveIssue);
    await tap('[data-sr-edit]');
    for (const words of [thesisOf('getSaveIssue').sentence, `${thesisOf('getSaveIssue').sentence}  `, `  ${thesisOf('getSaveIssue').sentence}`]) {
      typeInto($('#sr-thesis-edit'), words);
      await flush();
      expect($('[data-sr-save-thesis]').disabled).toBe(true);
      expect($('[data-sr-save-issue="names_not_supported"]')).not.toBeNull();
    }
  });
  it('R2: too_many_evidence_refs holds Save whatever the player writes (no wording changes it; the server checks it first)', async () => {
    await openOn(TA.getTooManyRefs);
    expect(thesisOf('getTooManyRefs').saveIssue.code).toBe('too_many_evidence_refs');
    expect($('[data-sr-save-thesis]').disabled).toBe(true);
    await tap('[data-sr-edit]');
    typeInto($('#sr-thesis-edit'), 'My own sentence, nothing like the composed one.');
    await flush();
    expect($('[data-sr-save-thesis]').disabled).toBe(true);
    expect($('[data-sr-save-issue="too_many_evidence_refs"]').textContent).toBe(B.saveIssue.too_many_evidence_refs);
  });
  it('R3: not_ready on the card the screen holds: the read brings the card the server judged (the same rev); the refusal and its blockers show on it, and leave when the card changes', async () => {
    await openOn(TA.walkGetReady, {}, { adopt: TA.notReadyStaleWhy, get: [TA.walkGetReady, TA.getStaleWhy], card: TA.clearStaleWhy });
    await tap('[data-sr-save-thesis]');
    expect(thesisOf('getStaleWhy').rev).toBe(thesisOf('walkGetReady').rev);
    expect($('[data-sr-ready]')).toBeNull();
    expect($('[data-sr-builder] [data-sr-save="failed"]').textContent).toBe(TA.notReadyStaleWhy.body.message);
    expect($('[data-sr-blockers]').textContent).toBe(B.stillToSet(B.parts.why));
    await tap('[data-sr-slot="why"]');
    await tap('[data-sr-change="why"]');
    if ($('[data-sr-clear-yes]')) await tap('[data-sr-clear-yes]');
    expect(server.sent('card')).toHaveLength(1);
    expect($('[data-sr-builder]')).not.toBeNull();
    expect($('[data-sr-save="failed"]')).toBeNull();
    expect($('[data-sr-blockers]')).toBeNull();
  });
  it('R3 (refuter 2): a not_ready refusal is never drawn on a later card the read finds (another writer moved it): the server never judged that card', async () => {
    await openOn(TA.walkGetReady, {}, { adopt: TA.notReadyStaleWhy, get: [TA.walkGetReady, TA.getPriced] });
    await tap('[data-sr-save-thesis]');
    expect(thesisOf('getPriced').rev).toBeGreaterThan(thesisOf('walkGetReady').rev);
    expect($('[data-sr-ready]')).not.toBeNull();
    expect($('[data-sr-blockers]')).toBeNull();
    expect($('[data-sr-save="failed"]')).toBeNull();
    expect($('[data-sr-save-thesis]').textContent).toBe(B.save);
  });
  it('R3: a stale refusal on the ready view (another tap moved the card on) leaves when the card changes again', async () => {
    await openOn(TA.walkGetReady, {}, { adopt: TA.adoptStalePriced, card: TA.walkPriceLineAgain });
    await tap('[data-sr-save-thesis]');
    expect($('[data-sr-ready]')).not.toBeNull();
    expect($('[data-sr-save="stale"]').textContent).toBe(SR_SERVER_COPY.card_stale);
    await tap('[data-sr-price-open]');
    typeInto($('[data-sr-price-level="NVDA"]'), '110');
    await tap('[data-sr-free="set:wrongIf:priceLines"]');
    expect(server.sent('card')).toHaveLength(1);
    expect($('[data-sr-ready]')).not.toBeNull();
    expect($('[data-sr-save="stale"]')).toBeNull();
  });
  it('R4: the read after a card answer goes through the one-request rule: every choice held while it is out', async () => {
    const held = deferred();
    await openOn(TA.walkGetSegment, {}, { step: NETWORK, card: TA.walkOneStock, get: [TA.walkGetSegment, () => held.promise] });
    await tap('[data-sr-research="find_names"]');
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]');
    expect(server.sent('get')).toHaveLength(2);
    const held1 = $$('button[data-sr-free], button[data-sr-research]');
    expect(held1.length).toBeGreaterThan(0);
    for (const b of held1) expect(b.disabled).toBe(true);
    click(held1[0]);
    await flush();
    expect(server.sent('card')).toHaveLength(1);
    expect(server.sent('step')).toHaveLength(1);
    held.resolve(TA.walkGetOneStock);
    await flush();
  });
  it('R4: the read after not_ready goes through the one-request rule: Save held while it is out', async () => {
    const held = deferred();
    await openOn(TA.walkGetReady, {}, { adopt: TA.notReady, get: [TA.walkGetReady, () => held.promise] });
    await tap('[data-sr-save-thesis]');
    expect(server.sent('get')).toHaveLength(2);
    expect($('[data-sr-save-thesis]').disabled).toBe(true);
    click($('[data-sr-save-thesis]'));
    await flush();
    expect(server.sent('adopt')).toHaveLength(1);
    held.resolve(TA.walkGetWrongIf);
    await flush();
  });
  it('R4 (refuter 2): the read after a landed step fails: the line says so, and the next card answer reads again', async () => {
    await openOn(TA.walkGetSegment, {}, { step: NETWORK, card: [TA.namesTimeFrame, TA.namesTimeFrameCleared], get: [TA.walkGetSegment, NETWORK, TA.getNamesTimeFrameCleared] });
    await tap('[data-sr-research="find_names"]'); // lost — the server ran it
    await tap('[data-sr-slot="timeFrame"]');
    await tap('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"][data-sr-free-value="swing"]'); // shows the step landed: read → fails
    expect(server.sent('get')).toHaveLength(2);
    expect($('[data-sr-read-failed="network"]')).not.toBeNull();
    await tap('[data-sr-change="timeFrame"]'); // the next card answer reads again
    expect(server.sent('card')).toHaveLength(2);
    expect(server.sent('get')).toHaveLength(3);
    expect($('[data-sr-read-failed]')).toBeNull();
  });
  it('K-16 on the saved view (refuter 2): the read after the save goes through the one-request rule; equip waits for it', async () => {
    const held = deferred();
    transitionHypothesis.mockResolvedValue({});
    equipLoadoutBook.mockResolvedValue({ ok: true });
    await openOn(TA.walkGetReady, {}, { adopt: TA.walkSaved, get: [TA.walkGetReady, () => held.promise] });
    await tap('[data-sr-save-thesis]');
    expect(server.sent('get')).toHaveLength(2);
    expect($('[data-sr-thesis-saved]')).not.toBeNull();
    expect($('[data-sr-equip]').disabled).toBe(true);
    click($('[data-sr-equip]'));
    await flush();
    expect(transitionHypothesis).not.toHaveBeenCalled();
    expect(equipLoadoutBook).not.toHaveBeenCalled();
    held.resolve(TA.walkGetSaved);
    await flush();
    expect($('[data-sr-equip]').disabled).toBe(false);
  });
  it('refuter 2: an edit is measured as the server measures it (trimmed): a padded sentence within the limit can be saved', async () => {
    await openOn(TA.walkGetReady);
    await tap('[data-sr-edit]');
    const mine = `${thesisOf('walkGetReady').sentence} Mine.`;
    typeInto($('#sr-thesis-edit'), `${mine}${' '.repeat(STATEMENT_MAX - mine.length + 5)}`);
    await flush();
    expect($('[data-sr-save-thesis]').disabled).toBe(false);
  });
});

/** Is the reply's More shown (its box is always drawn; hidden when there is nothing more to show)? */
const moreShown = (said) => { const b = said.querySelector('[data-sr-said-more]'); return Boolean(b) && !b.closest('[hidden]'); };

describe('the phone round (P-2 to P-7)', () => {
  const SLOT_STATES = ['walkGetOpen', 'walkGetMap', 'walkGetSegment', 'walkGetNames', 'walkGetOneStock', 'walkGetWhy', 'walkGetConfirmWhy', 'walkGetWrongIf', 'getDeadEnd', 'getStoryOpen'];
  it('P-2: the choices sit directly under the conversation and scroll with it; the pinned foot holds only the composer', async () => {
    await openOn(TA.walkGetConfirmWhy);
    const choices = $('[data-sr-choices]');
    expect($('[data-sr-conversation]').nextElementSibling).toBe(choices);
    expect(choices.querySelectorAll('[data-sr-free="set:wrongIf"]').length).toBeGreaterThan(0);
    expect($$('[data-sr-foot] button[data-sr-free], [data-sr-foot] button[data-sr-research]')).toHaveLength(0);
    expect($('[data-sr-foot] [data-sr-composer-input]')).not.toBeNull();
    for (const el of [choices, ...choices.querySelectorAll('*')]) {
      expect(['auto', 'scroll']).not.toContain(el.style.overflowY);
      expect(['auto', 'scroll']).not.toContain(el.style.overflow);
      expect(el.style.maxHeight).toBe('');
    }
  });
  it('P-3: no "Continue later" in the builder; Discard sits behind "⋯" in the card\'s head and opens B2\'s discard confirm', async () => {
    await openOn(TA.walkGetConfirmWhy);
    expect(textOf()).not.toContain(COPY.later);
    const more = $('[data-sr-card] [data-sr-more="card"]');
    expect(more.getAttribute('aria-label')).toBe(B.moreActions);
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect($('[data-sr-discard]')).toBeNull();
    await tap('[data-sr-more="card"]');
    expect(more.getAttribute('aria-expanded')).toBe('true');
    await tap('[data-sr-discard="card"]');
    expect(textOf()).toContain(COPY.discardTitle);
    expect(server.sent('close')).toHaveLength(0);
  });
  it('P-3: a closed builder keeps its closed actions and has no "⋯"', async () => {
    await openOn(TA.getDeadEnd, {}, { close: TA.closeDeadEnd });
    await tap('[data-sr-conclude]');
    expect($('[data-sr-more]')).toBeNull();
    expect(textOf()).toContain(COPY.returnCC);
  });
  it('P-4: the pick\'s button, its reason once, then the tick button — right under the list, in that order', async () => {
    await openOn(TA.walkGetNames);
    const pickBox = $('[data-sr-names-pick]');
    const kids = [...pickBox.querySelector('[data-sr-names-buttons]').children];
    expect(kids.map((k) => k.dataset.srFree ?? (k.hasAttribute('data-sr-pick-reason') ? 'reason' : '?'))).toEqual(['confirm:names', 'reason', 'set:names']);
    expect(pickBox.lastElementChild).toBe(pickBox.querySelector('[data-sr-names-buttons]'));
    expect($('[data-sr-free="confirm:names"]').textContent).toContain(B.pickButton('Atlas', 'NVDA and AMD'));
    expect($('[data-sr-free="confirm:names"] [data-sr-mark]')).toBeNull();
    expect($$('[data-sr-pick-reason]')).toHaveLength(1);
    expect($('[data-sr-pick-reason]').textContent).toContain(thesisOf('walkGetNames').pick.reason);
    expect($('[data-sr-free="set:names"]').textContent).toContain(B.namesBuild(''));
    expect($('[data-sr-free="set:names"]').disabled).toBe(true);
  });
  it('P-4: the tick button names what it builds — one, two, three', async () => {
    await openOn(TA.walkGetNames);
    click($('[data-sr-name-row="AMD"] input'));
    expect($('[data-sr-free="set:names"]').textContent).toContain(B.namesBuild('AMD'));
    click($('[data-sr-name-row="AVGO"] input'));
    expect($('[data-sr-free="set:names"]').textContent).toContain(B.namesBuild('AMD and AVGO'));
    click($('[data-sr-name-row="NVDA"] input'));
    expect($('[data-sr-free="set:names"]').textContent).toContain(B.namesBuild('NVDA, AMD and AVGO'));
  });
  it('P-4: the pick\'s tag sits once per picked row, on the symbol\'s own line', async () => {
    await openOn(TA.walkGetNames);
    for (const sym of ['NVDA', 'AMD']) {
      const tags = $$(`[data-sr-name-row="${sym}"] [data-sr-name-pick]`);
      expect(tags).toHaveLength(1);
      const line = tags[0].closest('[data-sr-name-line]');
      expect(line.textContent.startsWith(sym)).toBe(true);
      expect(line.style.whiteSpace).toBe('nowrap');
      // a long agent name shrinks the tag (an ellipsis) on this line rather than running over the count (5C-3)
      expect(tags[0].parentElement.style.textOverflow).toBe('ellipsis');
    }
    expect($$('[data-sr-name-row="AVGO"] [data-sr-name-pick]')).toHaveLength(0);
  });
  it('P-4: ticking exactly the agent\'s pick sends the server\'s confirm (routine choice 7)', async () => {
    await openOn(TA.walkGetNames, {}, { card: TA.walkConfirmNames });
    click($('[data-sr-name-row="AMD"] input'));
    click($('[data-sr-name-row="NVDA"] input'));
    await tap('[data-sr-free="set:names"]');
    expect(last('card')).toMatchObject({ op: 'confirm', part: 'names', value: ['NVDA', 'AMD'] });
  });
  it('P-5: the latest reply in full; each earlier one folded to two lines with More (aria-expanded)', async () => {
    await openOn(TA.walkGetConfirmWhy);
    const said = $$('[data-sr-said]');
    expect(said.length).toBeGreaterThan(1);
    expect(said.map((n) => n.dataset.srSaidFolded)).toEqual([...said.slice(0, -1).map(() => 'true'), 'false']);
    expect(moreShown(said.at(-1))).toBe(false);
    expect(moreShown(said[0])).toBe(true);
    const more = said[0].querySelector('[data-sr-said-more]');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.textContent).toBe(B.moreReply);
    await tap('[data-sr-said] [data-sr-said-more]');
    expect($$('[data-sr-said]')[0].dataset.srSaidFolded).toBe('false');
    expect($$('[data-sr-said]')[0].querySelector('[data-sr-said-more]').textContent).toBe(B.lessReply);
    // the text is drawn as received; only its display folds
    expect($$('[data-sr-said] [data-sr-said-text]').map((n) => n.textContent)).toEqual(TA.walkGetConfirmWhy.body.session.exchanges.filter((e) => e.who === 'partner').map((e) => e.text));
  });
  it.each(SLOT_STATES)('P-6 %s: no space before a comma or a full stop; a blank at the sentence\'s size, muted, dotted, unpadded; filled parts not bold', async (key) => {
    await openOn(TA[key]);
    const sentence = $('[data-sr-sentence]');
    expect(sentence.textContent).not.toMatch(/\s[,.]/);
    for (const blank of sentence.querySelectorAll('[data-sr-blank]')) {
      expect(blank.style.padding + blank.style.paddingRight + blank.style.marginRight + blank.style.fontSize).toBe('');
      expect(blank.style.borderBottom).toContain('dotted');
    }
    for (const part of sentence.querySelectorAll('[data-sr-slot] > span')) expect(['700', '600', 'bold']).not.toContain(part.style.fontWeight);
  });
  it('P-6: the ready sentence on the phone is 16 px, its parts not bold', async () => {
    await openOn(TA.walkGetReady);
    expect($('[data-sr-sentence]').style.fontSize).toBe('16px');
    for (const part of $$('[data-sr-sentence] [data-sr-slot] > span')) expect(['700', '600', 'bold']).not.toContain(part.style.fontWeight);
  });
  it('P-7: "It’s wrong if…" leads the wrong-if options; "Time frame:" leads the time frames', async () => {
    await openOn(TA.walkGetConfirmWhy);
    const lead = $('[data-sr-choices] [data-sr-lead="wrongIf"]');
    expect(lead.textContent).toBe(B.leadWrongIf);
    expect(lead.compareDocumentPosition($('[data-sr-choices] [data-sr-free^="set:wrongIf"], [data-sr-choices] [data-sr-free="confirm:wrongIf"]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    mounted.forEach((m) => m.unmount()); mounted = [];
    await openOn(TA.walkGetWrongIf);
    expect($('[data-sr-choices] [data-sr-lead="timeFrame"]').textContent).toBe(B.leadTimeFrame);
  });
});

describe('lens (c) on the phone round: the fixes', () => {
  it('5C-2: folding or unfolding a reply keeps the very same text nodes — the log never hears the reply again', async () => {
    await openOn(TA.walkGetConfirmWhy);
    const first = () => $$('[data-sr-said] [data-sr-said-text]')[0];
    const nodes = [...first().childNodes];
    await tap('[data-sr-said] [data-sr-said-more]');
    expect([...first().childNodes]).toEqual(nodes);
    for (const [a, b] of nodes.map((x, i) => [x, first().childNodes[i]])) expect(b).toBe(a);
  });
  it('5C-2: a new turn folds the reply before it without re-adding its text', async () => {
    await openOn(TA.walkGetSegment, {}, { step: TA.walkNames });
    const before = $$('[data-sr-said] [data-sr-said-text]').at(-1);
    const kids = [...before.childNodes];
    expect(before.closest('[data-sr-said]').dataset.srSaidFolded).toBe('false');
    await tap('[data-sr-research="find_names"]');
    const again = $$('[data-sr-said] [data-sr-said-text]').at(-2);
    expect(again).toBe(before);
    expect(again.closest('[data-sr-said]').dataset.srSaidFolded).toBe('true');
    kids.forEach((k, i) => expect(again.childNodes[i]).toBe(k));
  });
  it('R-2 (refuter): a fold adds nothing to the log — the More box was already there; only its hidden attribute changes', async () => {
    await openOn(TA.walkGetSegment, {}, { step: TA.walkNames });
    const latest = $$('[data-sr-said]').at(-1);
    const box = latest.querySelector('[data-sr-said-more-box]');
    expect(box.hasAttribute('hidden')).toBe(true);
    await tap('[data-sr-research="find_names"]');
    expect($$('[data-sr-said]').at(-2).querySelector('[data-sr-said-more-box]')).toBe(box);
    expect(box.hasAttribute('hidden')).toBe(false);
  });
  it('R-3 (refuter): the scroll padding follows the composer when it leaves and comes back', async () => {
    const realRO = globalThis.ResizeObserver;
    const off = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    // An observer fires as a browser's does: once for an element it begins to observe, and once when an observed element
    // leaves the page (its size goes to zero) — never for an element it does not observe (a foot that came back is new).
    const live = new Set();
    globalThis.ResizeObserver = class {
      constructor(cb) { this.cb = cb; this.els = new Map(); }
      observe(el) { this.els.set(el, 'new'); live.add(this); }
      disconnect() { this.els.clear(); live.delete(this); }
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return this.hasAttribute?.('data-sr-foot') ? 61 : 0; } });
    const fire = () => act(async () => {
      for (const ro of [...live]) {
        let due = false;
        for (const [el, seen] of ro.els) {
          if (seen === 'new') { ro.els.set(el, 'seen'); due = true; } else if (seen === 'seen' && !el.isConnected) { ro.els.set(el, 'gone'); due = true; }
        }
        if (due) ro.cb([]);
      }
    });
    try {
      server.set('get', TA.getOutOfSteps);
      server.set('card', [TA.oosWrongIfSet, TA.oosWrongIfCleared]);
      const m = keep(mount(<div style={{ overflowY: 'auto' }} data-zz-scroller=""><Body mode="session" sessionId={TA.getOutOfSteps.body.session.sessionId} agentName="Atlas" agentId="agent-fixture-1" phone onClose={vi.fn()} /></div>));
      await flush();
      await fire(); // the first observations are delivered, as a browser does at once
      const box = m.host.querySelector('[data-zz-scroller]');
      expect($('[data-sr-foot]')).not.toBeNull();
      expect(box.style.scrollPaddingBottom).toBe('89px');
      await tap('[data-sr-choices] [data-sr-free="set:wrongIf"]'); // the time frame comes to the front: no text box, no direction
      await fire();
      expect($('[data-sr-foot]')).toBeNull();
      expect(box.style.scrollPaddingBottom).toBe('28px');
      await tap('[data-sr-slot="wrongIf"]');
      await tap('[data-sr-change="wrongIf"]');
      if ($('[data-sr-clear-yes]')) await tap('[data-sr-clear-yes]');
      await fire();
      expect($('[data-sr-foot]')).not.toBeNull(); // the wrong-if's text box is back
      expect(box.style.scrollPaddingBottom).toBe('89px');
    } finally {
      globalThis.ResizeObserver = realRO;
      if (off) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', off); else delete HTMLElement.prototype.offsetHeight;
    }
  });
  it('5C-1: a folded reply is measured again when its box resizes — More comes back when it stops fitting', async () => {
    const realRO = globalThis.ResizeObserver;
    const proto = HTMLElement.prototype;
    const ch = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
    const sh = Object.getOwnPropertyDescriptor(proto, 'scrollHeight');
    const observed = [];
    let spill = 0;
    globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; observed.push(this); } observe() {} disconnect() {} };
    Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return this.hasAttribute?.('data-sr-said-text') ? 45 : 0; } });
    Object.defineProperty(proto, 'scrollHeight', { configurable: true, get() { return this.hasAttribute?.('data-sr-said-text') ? 45 + spill : 0; } });
    try {
      await openOn(TA.walkGetConfirmWhy);
      expect(moreShown($('[data-sr-said]'))).toBe(false); // fits at this width: no More
      spill = 23;
      await act(async () => { for (const ro of observed) ro.cb([]); });
      expect(moreShown($('[data-sr-said]'))).toBe(true);
    } finally {
      globalThis.ResizeObserver = realRO;
      if (ch) Object.defineProperty(proto, 'clientHeight', ch); else delete proto.clientHeight;
      if (sh) Object.defineProperty(proto, 'scrollHeight', sh); else delete proto.scrollHeight;
    }
  });
  it('5C-6, 5C-8: More is at least 44 px and is named for whose reply it opens', async () => {
    await openOn(TA.walkGetConfirmWhy);
    const more = $('[data-sr-said] [data-sr-said-more]');
    expect(more.style.minWidth).toBe('44px');
    expect(more.style.minHeight).toBe('44px');
    expect(more.getAttribute('aria-label')).toBe(B.moreReplyLabel('Atlas'));
    expect(more.textContent).toBe(B.moreReply);
    await tap('[data-sr-said] [data-sr-said-more]');
    expect($('[data-sr-said] [data-sr-said-more]').getAttribute('aria-label')).toBe(B.lessReplyLabel('Atlas'));
  });
  it('5C-5: the Discard confirm opened from a builder says the sheet\'s close keeps it open (no "Continue later" there)', async () => {
    await openOn(TA.walkGetConfirmWhy);
    await tap('[data-sr-more="card"]');
    await tap('[data-sr-discard="card"]');
    expect(textOf()).toContain(B.discardAlt);
    expect(textOf()).not.toContain(COPY.discardAlt);
  });
  it('5C-7: the pick\'s reason describes its button; a lead line names the group of choices it leads', async () => {
    await openOn(TA.walkGetNames);
    const pick = $('[data-sr-free="confirm:names"]');
    expect(document.getElementById(pick.getAttribute('aria-describedby'))).toBe($('[data-sr-pick-reason]'));
    mounted.forEach((m) => m.unmount()); mounted = [];
    await openOn(TA.walkGetConfirmWhy);
    // §B13 T-6 (moved from the first group): the theme's line is a group too (aria-label), so the lead's is named by its label
    const group = $('[data-sr-choices] [role="group"][aria-labelledby]');
    expect(document.getElementById(group.getAttribute('aria-labelledby'))).toBe($('[data-sr-lead="wrongIf"]'));
    expect(group.querySelectorAll('[data-sr-free="set:wrongIf"]').length).toBeGreaterThan(0);
  });
  it('5C-9: the "⋯" closes when a tap lands elsewhere, or focus leaves it', async () => {
    await openOn(TA.walkGetConfirmWhy);
    await tap('[data-sr-more="card"]');
    expect($('[data-sr-discard="card"]')).not.toBeNull();
    await act(async () => { $('[data-sr-conversation]').dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect($('[data-sr-discard="card"]')).toBeNull();
    await tap('[data-sr-more="card"]');
    expect($('[data-sr-discard="card"]')).not.toBeNull();
    await act(async () => { $('[data-sr-more="card"]').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: $('[data-sr-slot="theme"]') })); });
    expect($('[data-sr-discard="card"]')).toBeNull();
  });
});

describe('B5 — before the switch (§B13): the screen', () => {
  it('T-6: after the first map, the theme\'s line confirms the suggestion — the server\'s confirm, as offered; the segment stays in front', async () => {
    await openOn(TA.walkGetMap, {}, { card: TA.walkThemeConfirm });
    const suggestion = thesisOf('walkGetMap').parts.theme.suggestion;
    expect($('[data-sr-choices]').dataset.srChoices).toBe('segment');
    expect($('[data-sr-choices]').firstElementChild).toBe($('[data-sr-theme-line]'));
    expect($$('[data-sr-choices] [data-sr-free="set:segment"]').length).toBeGreaterThan(0); // the map's choices at once
    await tap('[data-sr-theme-line] [data-sr-free="confirm:theme"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkGetMap').rev, op: 'confirm', part: 'theme', value: suggestion });
    expect($('[data-sr-theme-line]')).toBeNull();
    expect($('[data-sr-slot="theme"]').textContent).toBe(suggestion);
    expect($('[data-sr-choices]').dataset.srChoices).toBe('segment');
    expect(server.sent('step')).toHaveLength(0); // free: no step
  });
  it('T-6: Write your own opens the theme\'s part with its text box; the phrase goes as the player\'s own words (free)', async () => {
    await openOn(TA.walkGetMap, {}, { card: TA.walkThemeOwn });
    const phrase = thesisOf('walkThemeOwn').parts.theme.value;
    await tap('[data-sr-theme-own]');
    const panel = $('[data-sr-panel="theme"]');
    expect(panel).not.toBeNull();
    expect(panel.querySelector('[data-sr-theme-fixed]')).toBeNull(); // only suggested: nothing is fixed yet
    typeInto(panel.querySelector('[data-sr-composer-input]'), phrase);
    await tap('[data-sr-panel="theme"] [data-sr-composer-send="free"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkGetMap').rev, op: 'set', part: 'theme', value: { text: phrase } });
    expect($('[data-sr-slot="theme"]').textContent).toBe(phrase);
    expect($('[data-sr-theme-line]')).toBeNull();
  });
  it('review B6 (T-6): "Write your own" is a disclosure for the theme\'s part, and closing the part puts focus back on it', async () => {
    await openOn(TA.walkGetMap);
    const own = $('[data-sr-theme-own]');
    expect(own.getAttribute('aria-expanded')).toBe('false');
    await tap('[data-sr-theme-own]');
    const panel = $('[data-sr-panel="theme"]');
    expect(own.getAttribute('aria-expanded')).toBe('true');
    expect(own.getAttribute('aria-controls')).toBe(panel.id);
    await act(async () => { own.focus(); });
    await tap('[data-sr-panel-close="theme"]');
    await act(async () => { await new Promise((r) => { setTimeout(r, 5); }); });
    expect($('[data-sr-panel="theme"]')).toBeNull();
    expect(document.activeElement).toBe($('[data-sr-theme-own]'));
    expect($('[data-sr-theme-own]').getAttribute('aria-expanded')).toBe('false');
  });
  it('T-6: an unset theme with no suggestion stays in front — no line; its text box is the composer\'s', async () => {
    await openOn(TA.walkGetOpen);
    expect($('[data-sr-theme-line]')).toBeNull();
    expect($('[data-sr-choices]').dataset.srChoices).toBe('theme');
    expect($('[data-sr-composer]').dataset.srComposer).toBe('free');
    expect($('[data-sr-composer-input]').getAttribute('placeholder')).toBe(B.placeholder.theme);
  });
  it.each(['walkGetSegment', 'walkGetNames', 'walkGetWhy', 'walkGetConfirmWhy', 'walkGetWrongIf'])('T-6: %s — the theme only suggested: its line stays at the top of the choices', async (key) => {
    await openOn(TA[key]);
    expect(thesisOf(key).parts.theme.state).toBe('suggested');
    expect($('[data-sr-choices]').firstElementChild).toBe($('[data-sr-theme-line]'));
    expect($('[data-sr-choices]').dataset.srChoices).not.toBe('theme');
  });
  it('T-2: the server\'s "Built on …, through …" sentence, drawn as received, every set part tappable where it stands', async () => {
    await openOn(TA.walkGetReady);
    const sentence = $('[data-sr-sentence="server"]');
    expect(sentence.textContent).toBe(thesisOf('walkGetReady').sentence);
    expect(sentence.textContent.startsWith('Built on NVDA, through Accelerator chips, because ')).toBe(true);
    expect([...sentence.querySelectorAll('[data-sr-slot]')].map((n) => n.dataset.srSlot)).toEqual(['names', 'segment', 'why', 'wrongIf', 'timeFrame']);
  });
  it('T-8 (b): a wrong-if the player wrote reads "in your words"', async () => {
    await openOn(TA.getReadySkipped);
    expect(thesisOf('getReadySkipped').parts.wrongIf.by).toBe('player_wrote');
    expect($('[data-sr-wrongif-tag]').textContent).toBe(B.inYourWords);
    expect($('[data-sr-judged]').textContent).not.toMatch(/watched/i);
  });
  it('T-5: the time frame\'s confirm says whose answer it carries — "{agent} suggested", or the asked pick\'s "{agent}\'s pick"', async () => {
    await openOn(TA.walkGetWrongIf);
    const suggested = $('[data-sr-choices="timeFrame"] [data-sr-free="confirm:timeFrame"]');
    expect(suggested.dataset.srFreeValue).toBe('positional');
    expect(suggested.querySelector('[data-sr-mark]').textContent).toBe(B.suggestedTag('Atlas'));
    mounted.forEach((m) => m.unmount()); mounted = [];
    await openOn(TA.getTimeFramePicked, {}, { card: TA.walkTimeFrame });
    const picked = $$('[data-sr-choices="timeFrame"] [data-sr-free="confirm:timeFrame"]');
    expect(picked).toHaveLength(1); // one confirm: the newer answer
    expect(picked[0].dataset.srFreeValue).toBe('longterm');
    expect(picked[0].querySelector('[data-sr-mark]').textContent).toBe(B.pickTag('Atlas'));
    expect(picked[0].textContent).toContain(B.confirmValue('Longterm · about 60 sessions'));
    await tap('[data-sr-choices="timeFrame"] [data-sr-free="confirm:timeFrame"]');
    expect(last('card')).toMatchObject({ op: 'confirm', part: 'timeFrame', value: 'longterm' });
  });
});

describe('§B14 (Nov 18): the theme block, the ready view, the surviving time-frame answer', () => {
  it('Watch 10: "{agent} suggests a theme", the suggestion on its own line, then two buttons side by side — "Use it · free" and "Write your own"', async () => {
    await openOn(TA.walkGetMap);
    const block = $('[data-sr-theme-line]');
    expect(block.getAttribute('aria-label')).toBe(B.themeSuggests('Atlas'));
    expect(block.querySelector('[data-sr-theme-suggests]').textContent).toBe('Atlas suggests a theme');
    const suggestion = block.querySelector('[data-sr-theme-suggestion]');
    expect(suggestion.textContent).toBe(thesisOf('walkGetMap').parts.theme.suggestion);
    const buttons = [...block.querySelectorAll('[data-sr-theme-buttons] > button')];
    expect(buttons.map((b) => b.textContent)).toEqual([`${B.useIt}·${B.free}`, B.writeOwnTheme]);
    expect(buttons[0].getAttribute('aria-describedby')).toBe(suggestion.id);
    expect(buttons[0].dataset.srFree).toBe('confirm:theme');
    expect(buttons[1].hasAttribute('data-sr-theme-own')).toBe(true);
  });
  it('Watch 10 (the styles jsdom can read; the real browser measures the row): a flex row that does not wrap, two equal halves, 44 px, one-line labels', async () => {
    await openOn(TA.walkGetMap);
    const row = $('[data-sr-theme-buttons]');
    expect([row.style.display, row.style.flexDirection, row.style.flexWrap]).toEqual(['flex', '', '']);
    for (const b of row.querySelectorAll(':scope > button')) {
      expect([b.style.flexGrow, b.style.flexShrink, b.style.flexBasis, b.style.minHeight, b.style.whiteSpace]).toEqual(['1', '1', '0%', '44px', 'nowrap']);
    }
  });
  it('Q-4: a ready card whose theme is only suggested draws the block on the ready view; Use it confirms it, and the sentence opens with it', async () => {
    await openOn(TA.walkGetReady, {}, { card: TA.readyThemeConfirm });
    expect($('[data-sr-ready]')).not.toBeNull();
    expect(thesisOf('walkGetReady').parts.theme.state).toBe('suggested');
    expect($('[data-sr-ready] [data-sr-theme-line]')).not.toBeNull();
    expect($('[data-sr-sentence]').textContent.startsWith('Built on NVDA')).toBe(true);
    await tap('[data-sr-ready] [data-sr-theme-line] [data-sr-free="confirm:theme"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkGetReady').rev, op: 'confirm', part: 'theme', value: thesisOf('walkGetReady').parts.theme.suggestion });
    expect($('[data-sr-theme-line]')).toBeNull();
    expect($('[data-sr-sentence]').textContent).toBe(thesisOf('readyThemeConfirm').sentence);
    expect($('[data-sr-sentence]').textContent.startsWith('My theme is ')).toBe(true);
    expect($('[data-sr-ready]')).not.toBeNull(); // still ready
  });
  it('Q-4: on the ready view, Write your own opens the theme\'s part with its text box; the phrase goes as the player\'s own; closing returns focus to the opener', async () => {
    await openOn(TA.walkGetReady, {}, { card: TA.readyThemeOwn });
    const own = $('[data-sr-ready] [data-sr-theme-own]');
    expect(own.getAttribute('aria-expanded')).toBe('false');
    await tap('[data-sr-ready] [data-sr-theme-own]');
    const panel = $('[data-sr-panel="theme"]');
    expect(own.getAttribute('aria-expanded')).toBe('true');
    expect(own.getAttribute('aria-controls')).toBe(panel.id);
    await act(async () => { own.focus(); });
    await tap('[data-sr-panel-close="theme"]');
    await act(async () => { await new Promise((r) => { setTimeout(r, 5); }); });
    expect(document.activeElement).toBe($('[data-sr-ready] [data-sr-theme-own]'));
    await tap('[data-sr-ready] [data-sr-theme-own]');
    const phrase = thesisOf('readyThemeOwn').parts.theme.value;
    typeInto($('[data-sr-panel="theme"] [data-sr-composer-input]'), phrase);
    await tap('[data-sr-panel="theme"] [data-sr-composer-send="free"]');
    expect(last('card')).toEqual({ action: 'card', sessionId: SID, opId: expect.stringMatching(UUID), rev: thesisOf('walkGetReady').rev, op: 'set', part: 'theme', value: { text: phrase } });
    expect($('[data-sr-sentence]').textContent.startsWith(`My theme is ${phrase}`)).toBe(true);
    expect($('[data-sr-theme-line]')).toBeNull();
  });
  it('Q-4: a ready card with its theme set draws no block', async () => {
    await openOn(TA.getReadyThemed);
    expect($('[data-sr-ready]')).not.toBeNull();
    expect($('[data-sr-theme-line]')).toBeNull();
  });
  it('Q-1 (b): after a later step the asked pick\'s value is still offered, now as "{agent} suggested"', async () => {
    await openOn(TA.getTimeFrameAfterPick, {}, { card: TA.walkTimeFrame });
    expect(thesisOf('getTimeFrameAfterPick').pick).toBeNull();
    const c = $$('[data-sr-choices="timeFrame"] [data-sr-free="confirm:timeFrame"]');
    expect(c).toHaveLength(1);
    expect(c[0].dataset.srFreeValue).toBe('longterm');
    expect(c[0].querySelector('[data-sr-mark]').textContent).toBe(B.suggestedTag('Atlas'));
  });
});
