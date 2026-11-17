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
const { formatWhen } = await import('./sharedResearchView');
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
    expect($('[data-sr-builder="phone"]')).not.toBeNull();
    expect($('[data-sr-filled]').textContent).toBe('1 of 6');
    expect($('[data-sr-slot="theme"]').textContent).toBe('I want to play AI');

    // Map the segments (1 step)
    await tap('[data-sr-research="map_segments"]');
    const map = last('step');
    expect(Object.keys(map).sort()).toEqual(['action', 'goal', 'intent', 'sessionId', 'stepId']);
    expect(map).toMatchObject({ action: 'step', sessionId: SID, intent: 'build', goal: 'map_segments' });
    expect(map.stepId).toMatch(UUID);
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
    expect($('[data-sr-builder="phone"]')).not.toBeNull();
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
  it.each([
    ['walkGetOpen', 1], ['walkGetMap', 1], ['walkGetSegment', 2], ['walkGetNames', 2], ['walkGetOneStock', 3],
    ['walkGetWhy', 3], ['walkGetConfirmWhy', 4], ['walkGetWrongIf', 5], ['getStoryOpen', 0],
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
    expect($('[data-sr-filled]').textContent).toBe('3 of 6');
    expect($('[data-sr-why-block]')).toBeNull(); // the why block waits for a why that holds a value
  });
  it('a stale part is marked and names what to do: Change it, or check it again for a step', async () => {
    await openOn(TA.getStaleSegment);
    expect($('[data-sr-slot="segment"]').dataset.srSlotState).toBe('stale');
    expect($('[data-sr-stale-mark]').textContent).toBe(B.stale);
    expect($('[data-sr-ready]')).toBeNull();
    expect($('[data-sr-foot="segment"] [data-sr-free="clear:segment"]').textContent).toContain(B.change);
    expect($('[data-sr-foot="segment"] [data-sr-research="strengthen:segment"]').textContent).toContain(B.strengthenPart('Segment'));
  });
  it('the story start (T8a): nothing set, the first choice checks the story against its source', async () => {
    await openOn(TA.getStoryOpen);
    expect($('[data-sr-research="verify_source"]').textContent).toContain(B.goals.verify_source);
    expect($$('[data-sr-research]').map((b) => b.dataset.srResearch)).toEqual(['verify_source']);
    expect($('[data-sr-composer]').dataset.srComposer).toBe('free');
  });
  it('the story after its check (T8b): the theme suggested, offered as a free confirm', async () => {
    await openOn(TA.getStoryVerified);
    expect($('[data-sr-slot="theme"]').dataset.srSlotState).toBe('suggested');
    const c = $('[data-sr-free="confirm:theme"]');
    expect(c.textContent).toContain(B.themeConfirm('Cloud AI data-center spending'));
    expect(c.textContent).toContain(B.suggestedTag('Atlas'));
  });
  it('desktop (D1): the card left, the conversation and its choices right', async () => {
    await openOn(TA.walkGetConfirmWhy, { phone: false });
    expect($('[data-sr-builder="desktop"]')).not.toBeNull();
    expect($('[data-sr-builder="desktop"] [data-sr-card]')).not.toBeNull();
    expect($('[data-sr-builder="desktop"] [data-sr-foot]')).not.toBeNull();
  });
  it('the conversation: the player\'s words and taps, the agent\'s replies as stored, the card lines', async () => {
    await openOn(TA.walkGetConfirmWhy);
    const said = $$('[data-sr-said]').map((n) => n.textContent);
    const stored = TA.walkGetConfirmWhy.body.session.exchanges.filter((e) => e.who === 'partner').map((e) => `Atlas${e.text}`);
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
  it('the theme: "you wrote", "Your words · no sources", and no Change — a different theme is a new investigation', async () => {
    await openOn(TA.walkGetConfirmWhy);
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
    expect($('[data-sr-filled]').textContent).toBe('1 of 6');
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
    click($('[data-sr-name-row="AMD"] input'));
    click($('[data-sr-name-row="NVDA"] input'));
    expect($('[data-sr-free="set:names"]').textContent).toContain(B.namesBuild(2));
    await tap('[data-sr-free="set:names"]');
    expect(last('card')).toMatchObject({ op: 'set', part: 'names', value: ['NVDA', 'AMD'] });
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
  it('the wrong-if reads "in your words"; the price line "optional · add your own"; nothing watched', async () => {
    await openOn(TA.walkGetReady, {}, { card: TA.walkPriceLine });
    expect($('[data-sr-judged]').textContent).toContain(B.inYourWords);
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
    expect($$('[data-sr-foot] [data-sr-free="set:wrongIf"]').length).toBeGreaterThan(0);
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
    for (const b of $$('[data-sr-foot] button[data-sr-free]')) expect(b.disabled).toBe(true);
    held.resolve(TA.walkMap);
    await flush();
  });
});

describe('the review\'s fixes (4C: accessibility and phone)', () => {
  const settle = () => new Promise((r) => { setTimeout(r, 10); });
  it('4C-2: the foot\'s Change asks in the foot, beside the control, and its safe answer takes focus', async () => {
    await openOn(TA.getStaleSegment);
    await tap('[data-sr-foot] [data-sr-free="clear:segment"]');
    expect($('[data-sr-foot] [data-sr-clear-confirm="segment"]')).not.toBeNull();
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
  it('4C-4: while another part\'s panel is open, the foot folds its choices; they return when it closes', async () => {
    await openOn(TA.walkGetOneStock);
    expect($('[data-sr-foot] [data-sr-research="build_why"]')).not.toBeNull();
    await tap('[data-sr-slot="timeFrame"]');
    expect($('[data-sr-foot] [data-sr-research="build_why"]')).toBeNull();
    expect($('[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]')).not.toBeNull();
    await tap('[data-sr-panel-close="timeFrame"]');
    expect($('[data-sr-foot] [data-sr-research="build_why"]')).not.toBeNull();
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

  it('R1: a lost tap sent again after the card moved on: the same opId, with the card\'s rev as it is now', async () => {
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
    expect(b).toEqual({ ...a, rev: thesisOf('walkNames').rev });
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
  it('R3: a not_ready refusal belongs to its card: once a later card is ready, no "Still to set", no failed line, Save reads Save', async () => {
    await openOn(TA.walkGetReady, {}, { adopt: TA.notReady, get: [TA.walkGetReady, TA.walkGetWrongIf], card: TA.walkTimeFrame });
    await tap('[data-sr-save-thesis]');
    // the card the server judged, read again: the work view, the refusal and its blockers on it
    expect($('[data-sr-ready]')).toBeNull();
    expect($('[data-sr-builder] [data-sr-save="failed"]').textContent).toBe(TA.notReady.body.message);
    expect($('[data-sr-blockers]')).not.toBeNull();
    await tap('[data-sr-free="confirm:timeFrame"]');
    expect($('[data-sr-ready]')).not.toBeNull();
    expect($('[data-sr-blockers]')).toBeNull();
    expect($('[data-sr-save="failed"]')).toBeNull();
    expect($('[data-sr-save-thesis]').textContent).toBe(B.save);
  });
  it('R3: on the work view, a refusal leaves once the card changes (still not ready)', async () => {
    const staleNotReady = { status: 409, body: { ...TA.adoptStale.body, thesis: TA.cardStale.body.thesis } };
    await openOn(TA.walkGetReady, {}, { adopt: staleNotReady, card: TA.walkConfirmWhy });
    await tap('[data-sr-save-thesis]');
    expect($('[data-sr-builder] [data-sr-save="stale"]')).not.toBeNull();
    await tap('[data-sr-free="confirm:why"]');
    expect(thesisOf('walkConfirmWhy').ready).toBe(false);
    expect(thesisOf('walkConfirmWhy').rev).not.toBe(TA.cardStale.body.thesis.rev);
    expect($('[data-sr-builder]')).not.toBeNull();
    expect($('[data-sr-save="stale"]')).toBeNull();
  });
  it('R3: a stale refusal on the ready view leaves when the card changes again', async () => {
    const staleReady = { status: 409, body: { ...TA.adoptStale.body, thesis: thesisOf('walkGetReady') } };
    await openOn(TA.walkGetReady, {}, { adopt: staleReady, card: TA.walkPriceLine });
    await tap('[data-sr-save-thesis]');
    expect($('[data-sr-save="stale"]')).not.toBeNull();
    await tap('[data-sr-price-open]');
    typeInto($('[data-sr-price-level="NVDA"]'), '120');
    await tap('[data-sr-free="set:wrongIf:priceLines"]');
    expect(thesisOf('walkPriceLine').rev).not.toBe(thesisOf('walkGetReady').rev);
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
});
