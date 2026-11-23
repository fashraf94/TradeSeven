// @vitest-environment jsdom
//
// Explore Build 1 — EVERY SCREEN AND STATE, AND THE FOUR WAYS INTO THE SHEET (build prompt Tests; K-7, K-8, K-9,
// K-10, K-11, K-12; spec §3, §9). The real Search page at 'on', the research read mocked in the service's own shape
// with answers composed by the server (exploreReads.json), fixture stories and bookmarks, and the sheet's body
// replaced — through Explore's own loader — by a stand-in that records the props of each mount.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ mode: 'on' }));
vi.mock('../../config/exploreFlags', () => ({ EXPLORE_MODES: ['off', 'allowlist', 'on'], EXPLORE_MODE: 'off', exploreMode: () => flags.mode }));
const read = vi.hoisted(() => vi.fn());
vi.mock('../../services/sharedResearchService', () => ({ readExploreInvestigations: read }));
vi.mock('../../firebase/config', () => ({ db: {} }));
const body = vi.hoisted(() => ({ mounts: [] }));
vi.mock('./loadSharedResearch', async () => {
  const R = await import('react');
  function BodyStandIn(props) {
    R.useEffect(() => { body.mounts.push(props); }, []);
    return R.createElement('div', { 'data-body-stand-in': props.mode }, R.createElement('button', { type: 'button', onClick: props.onClose, 'data-body-close': '' }, 'close'));
  }
  return { loadSharedResearch: () => Promise.resolve({ default: BodyStandIn }) };
});
vi.mock('../Search/ExploreView', () => ({ default: function MarketsStub() { return <div data-stub="markets" />; } }));
vi.mock('../draft/AssetResearchModal', () => ({ default: function AssetStub({ asset }) { return <div data-stub="asset">{asset.symbol}</div>; } }));

const { default: SearchDiscover } = await import('../Search/SearchDiscover');
const kit = await import('./__fixtures__/exploreKit');
const { READS, GATED, NO_ANSWER, SAMPLE_STORIES, answerOf, fixtureSources, bookmarkOf, mount, flush, click, typeInto, press, $, $$, buttonNamed, deferred, until } = kit;
const { EXPLORE_COPY: COPY } = await import('./exploreCopy');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Rows wait on lazy modules and the page's own animations in real time: 15 s each, so a loaded machine cannot time one out.
vi.setConfig({ testTimeout: 15_000 });
const USER = { uid: 'u-explore-1' };
const [AI, TAP, UTIL] = SAMPLE_STORIES;
let mounted = [];
let sources;
const keep = (m) => { mounted.push(m); return m; };
const text = () => $('[data-explore-tab]')?.textContent ?? '';

beforeEach(() => {
  flags.mode = 'on';
  read.mockReset();
  read.mockResolvedValue(answerOf(READS.none));
  sources = fixtureSources();
  body.mounts = [];
  window.scrollTo = vi.fn();
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; document.body.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert')); });

async function openPage({ answer = answerOf(READS.none), src = sources } = {}) {
  if (answer) read.mockResolvedValue(answer);
  const m = keep(mount(<SearchDiscover user={USER} isMobile isDesktop={false} setScreen={vi.fn()} stocksData={[]} sidebarCollapsed={false} />, { sources: src }));
  await until(() => $('[data-explore-search]'), 'the Explore tab');
  await flush();
  return m;
}
const card = (id) => $(`[data-explore-card="${id}"]`);
async function openStory(story, how = () => click(card(story.id).querySelector('[data-explore-card-read]') ?? card(story.id).querySelector('[data-explore-card-primary]'))) {
  how();
  await until(() => $('[data-explore-screen="story"]'), 'the story');
  await flush();
}
const panel = () => $('[data-explore-panel]');
const primary = () => $('[data-explore-primary]');
const workButtons = () => $$('button').filter((b) => b.textContent.trim() === COPY.panel.work);

describe('home (spec §3.2)', () => {
  it('loading: one line', async () => {
    const held = deferred();
    sources = fixtureSources({ stories: () => held.promise });
    await openPage();
    expect($('[data-explore-cards]').textContent).toContain(COPY.home.loading);
    held.resolve(SAMPLE_STORIES);
  });
  it('no stories: the line, with search still usable', async () => {
    sources = fixtureSources({ stories: [] });
    await openPage();
    expect($('[data-explore-empty]').textContent).toBe(COPY.home.empty);
    typeInto($('#ftx-search'), 'NVDA');
    await flush();
    expect($$('[data-explore-result="company"]').length).toBeGreaterThan(0);
  });
  it('stories failed: the line and Try again, which reads the stories once more', async () => {
    let n = 0;
    sources = fixtureSources({ stories: () => { n += 1; if (n === 1) throw new Error('x'); return SAMPLE_STORIES; } });
    await openPage();
    expect($('[role="alert"]').textContent).toBe(COPY.home.failed);
    click($('[data-explore-retry-stories]'));
    await until(() => card(AI.id), 'the cards');
    expect(sources.calls.filter((c) => c.kind === 'readStories')).toHaveLength(2);
  });
  it('the cards: one per featured question, the QUESTION as headline, origin and sample tags, Read the story, no state line', async () => {
    await openPage();
    expect($$('[data-explore-card]').map((c) => c.querySelector('[data-explore-card-question]').textContent)).toEqual([
      AI.questions[0].text, TAP.questions[0].text, UTIL.questions[0].text, UTIL.questions[1].text,
    ]);
    expect(card(TAP.id).textContent).toContain(COPY.card.product);
    expect(card(AI.id).textContent).toContain(COPY.card.fromReporter('Kim'));
    expect($$('[data-explore-card]').every((c) => c.textContent.includes(COPY.card.sample))).toBe(true);
    expect($$('[data-explore-card-primary]').map((b) => b.dataset.exploreCardPrimary)).toEqual(['read', 'read', 'read', 'read']);
    expect($$('[data-explore-card] [data-explore-state]')).toEqual([]);
    expect($('[data-explore-in-progress]')).toBeNull();
  });
  it('one in progress: Continue research leads the card, the state line is the read\'s numbers, and the row is listed', async () => {
    await openPage({ answer: answerOf(READS.progress) });
    expect(card(AI.id).querySelector('[data-explore-card-primary]').textContent).toBe(COPY.card.continue);
    expect(card(AI.id).querySelector('[data-explore-card-read]')).not.toBeNull();
    expect(card(AI.id).querySelector('[data-explore-state]').textContent).toBe('In progress · 1 of 6 · 8 steps left');
    const row = $('[data-explore-progress-row="sample-ai-buildout"]');
    expect(row.textContent).toContain(READS.progress.items[0].open.question);
    expect(row.textContent).toContain(COPY.card.continue);
  });
  it('a ledger investigation: "In progress" with no count', async () => {
    await openPage({ answer: answerOf(READS.ledger) });
    expect(card(AI.id).querySelector('[data-explore-state]').textContent).toBe(`In progress · ${READS.ledger.items[0].open.stepsLeft} steps left`);
  });
  it.each([['saved', 'Thesis saved · Nov 21, 2026'], ['concluded', 'Concluded · Nov 21, 2026']])('%s: the card says so, with the read\'s date, and offers Read the story', async (name, line) => {
    await openPage({ answer: answerOf(READS[name]) });
    expect(card(AI.id).querySelector('[data-explore-state]').textContent).toBe(line);
    expect(card(AI.id).querySelector('[data-explore-card-primary]').textContent).toBe(COPY.card.read);
  });
  it('a bookmark alone: under Saved for later as "Saved · not researched", never under Research in progress', async () => {
    sources = fixtureSources({ bookmarks: [bookmarkOf(TAP)] });
    await openPage();
    await until(() => $('[data-explore-saved-row]'), 'the saved row');
    expect($('[data-explore-saved-row="sample-tap-to-pay"]').textContent).toContain(COPY.home.savedState);
    expect($('[data-explore-in-progress]')).toBeNull();
  });
  it('saved and in progress: in both lists, with its in-progress state', async () => {
    sources = fixtureSources({ bookmarks: [bookmarkOf(AI)] });
    await openPage({ answer: answerOf(READS.progress) });
    await until(() => $('[data-explore-saved-row]'), 'the saved row');
    expect($('[data-explore-saved-row="sample-ai-buildout"] [data-explore-state]').dataset.exploreState).toBe('open');
    expect($('[data-explore-progress-row="sample-ai-buildout"]')).not.toBeNull();
  });
  it('a bookmark whose story is gone: its title, "No longer available", and Remove', async () => {
    sources = fixtureSources({ bookmarks: [{ storyId: 'gone-1', storyVersion: 1, title: 'A story taken down', savedAt: '2026-11-20T10:00:00.000Z' }] });
    await openPage();
    await until(() => $('[data-explore-saved-row="gone-1"]'), 'the saved row');
    const row = $('[data-explore-saved-row="gone-1"]');
    expect(row.textContent).toContain('A story taken down');
    expect(row.textContent).toContain(COPY.home.gone);
    click(row.querySelector('[data-explore-saved-remove]'));
    await until(() => !$('[data-explore-saved-row="gone-1"]'), 'the row removed');
    expect(sources.calls.filter((c) => c.kind === 'removeBookmark')).toEqual([{ kind: 'removeBookmark', uid: USER.uid, storyId: 'gone-1' }]);
  });
  it('an open investigation whose story is gone: still under Research in progress, with its question and Continue', async () => {
    await openPage({ answer: answerOf(READS.gone) });
    const row = $('[data-explore-progress-row="sample-unpublished-1"]');
    expect(row.textContent).toContain('Who keeps the fee?');
    click(row.querySelector('[data-explore-progress-continue]'));
    await until(() => body.mounts.length === 1, 'the sheet');
    expect(body.mounts[0]).toMatchObject({ mode: 'session', sessionId: READS.gone.items[0].open.sessionId });
    expect(body.mounts[0].startNow).toBeUndefined();
  });
  it('topics filter the cards; All topics clears', async () => {
    await openPage();
    click($('[data-explore-topic="Payments"]'));
    expect($$('[data-explore-card]').map((c) => c.dataset.exploreCard)).toEqual(['sample-tap-to-pay']);
    click($('[data-explore-topic="*"]'));
    expect($$('[data-explore-card]')).toHaveLength(4);
  });
});

describe('K-7: every number on the page is the read\'s own (planted numbers no rule would compute)', () => {
  const planted = (over) => answerOf({ ...READS.progress, ...over });
  it('the cost line and the limit come from the quota: 2 of 5 used, then 5 of 5', async () => {
    await openPage({ answer: planted({ quota: { ...READS.progress.quota, investigationsToday: 2, perDay: 5 } }) });
    await openStory(TAP);
    expect($('[data-explore-cost]').textContent).toBe('Uses 1 of your 5 investigations today · 2 used');
    expect(primary().textContent).toBe(COPY.panel.work);
  });
  it('at 5 of 5 the limit line names 5', async () => {
    await openPage({ answer: planted({ quota: { ...READS.progress.quota, investigationsToday: 5, perDay: 5 } }) });
    await openStory(TAP);
    expect($('[data-explore-limit]').textContent).toBe(COPY.panel.limit(5));
  });
  it('the state line carries filled, parts and steps left as read: 4 of 7, 13 steps', async () => {
    const item = READS.progress.items[0];
    await openPage({ answer: planted({ items: [{ ...item, open: { ...item.open, filled: 4, parts: 7, stepsLeft: 13 } }] }) });
    expect(card(AI.id).querySelector('[data-explore-state]').textContent).toBe('In progress · 4 of 7 · 13 steps left');
    await openStory(AI);
    expect($('[data-explore-open] [data-explore-state]').textContent).toBe('In progress · 4 of 7');
    expect($('[data-explore-steps]').textContent).toBe('13 steps left');
  });
});

describe('the reader and the panel (spec §3.4, §3.5)', () => {
  it('opening a story starts at the top and moves focus to its title', async () => {
    await openPage();
    await openStory(AI);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.activeElement).toBe($('[data-explore-story-title]'));
    expect($('[data-explore-story-title]').textContent).toBe(AI.title);
  });
  it('form A: the question editable, what starts with it (only what travels), the cost line from the quota, Work this idea', async () => {
    await openPage({ answer: answerOf(READS.progress) });
    await openStory(TAP);
    expect(panel().dataset.explorePanel).toBe('A');
    expect($('[data-explore-question-input]').value).toBe(TAP.questions[0].text);
    expect($('[data-explore-question-input]').maxLength).toBe(500);
    expect($$('[data-explore-starts-row]').map((r) => r.dataset.exploreStartsRow)).toEqual(['story', 'question', 'angle', 'firstStep', 'companies', 'open']);
    expect($('[data-explore-starts]').textContent).toContain(COPY.panel.startsFirstStep);
    expect($('[data-explore-cost]').textContent).toBe('Uses 1 of your 3 investigations today · 1 used');
    expect(primary().textContent).toBe(COPY.panel.work);
  });
  it('a story without tickers has no Companies row', async () => {
    sources = fixtureSources({ stories: [{ ...AI, tickers: [] }] });
    await openPage();
    await openStory(AI);
    expect($$('[data-explore-starts-row]').map((r) => r.dataset.exploreStartsRow)).not.toContain('companies');
  });
  it('editing shows "Use the story\'s wording", which puts it back; an empty question disables Work this idea', async () => {
    await openPage();
    await openStory(AI);
    typeInto($('[data-explore-question-input]'), 'Which suppliers ship first?');
    expect($('[data-explore-reset]')).not.toBeNull();
    click($('[data-explore-reset]'));
    expect($('[data-explore-question-input]').value).toBe(AI.questions[0].text);
    typeInto($('[data-explore-question-input]'), '   ');
    expect(primary().disabled).toBe(true);
  });
  it('at the daily limit: the limit line and Save for later in place of the button; no start control anywhere', async () => {
    await openPage({ answer: answerOf(READS.limit) });
    await openStory(AI);
    expect($('[data-explore-limit]').textContent).toBe(COPY.panel.limit(3));
    expect(primary()).toBeNull();
    expect($('[data-explore-actions] [data-explore-save]')).not.toBeNull();
    expect(workButtons()).toEqual([]);
    expect($('[data-explore-cost]')).toBeNull();
  });
  it('form B: the investigation\'s original question and the read\'s numbers, Continue research; another question changes nothing but the line (K-10)', async () => {
    await openPage({ answer: answerOf(READS.progress) });
    await openStory(AI);
    expect(panel().dataset.explorePanel).toBe('B');
    expect($('[data-explore-open-question]').textContent).toBe(READS.progress.items[0].open.question);
    expect($('[data-explore-open] [data-explore-state]').textContent).toBe('In progress · 1 of 6');
    expect($('[data-explore-steps]').textContent).toBe('8 steps left');
    expect(primary().textContent).toBe(COPY.panel.continue);
    expect($('[data-explore-one-per-story]')).toBeNull();
    const radios = $$('[role="radio"]');
    click(radios[1]);
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(panel().dataset.explorePanel).toBe('B');
    expect($('[data-explore-one-per-story]').textContent).toBe(COPY.panel.onePerStory);
    expect($('[data-explore-question-input]')).toBeNull();
    expect(workButtons()).toEqual([]);
    expect(primary().textContent).toBe(COPY.panel.continue);
  });
  it.each([['saved', 'Thesis saved · Nov 21, 2026'], ['concluded', 'Concluded · Nov 21, 2026']])('form C (%s): the ended line, View it, and form A\'s controls below', async (name, line) => {
    await openPage({ answer: answerOf(READS[name]) });
    await openStory(AI);
    expect(panel().dataset.explorePanel).toBe('C');
    expect($('[data-explore-ended] [data-explore-state]').textContent).toBe(line);
    expect($('[data-explore-view-it]')).not.toBeNull();
    expect($('[data-explore-question-input]')).not.toBeNull();
    expect(primary().textContent).toBe(COPY.panel.work);
  });
  it('form D (no access): the question, what starts with it, the gated line, Save — and no start control anywhere', async () => {
    await openPage({ answer: GATED });
    await openStory(AI);
    expect(panel().dataset.explorePanel).toBe('D');
    expect($('[data-explore-gated]').textContent).toBe(COPY.panel.gated);
    expect(panel().textContent).toContain(COPY.panel.gatedNote);
    expect($('[data-explore-starts]')).not.toBeNull();
    expect(panel().querySelector('[data-explore-save]')).not.toBeNull();
    expect(workButtons()).toEqual([]);
    expect(primary()).toBeNull();
  });
  it('form E (the read failed): the line, Try again — exactly one read — and no start control', async () => {
    await openPage({ answer: NO_ANSWER });
    await openStory(AI);
    expect(panel().dataset.explorePanel).toBe('E');
    expect(panel().querySelector('[role="alert"]').textContent).toBe(COPY.panel.readFailed);
    expect(workButtons()).toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
    read.mockResolvedValue(answerOf(READS.none));
    click($('[data-explore-retry-read]'));
    await until(() => panel()?.dataset.explorePanel === 'A', 'form A');
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('the connections carry one of the three labels each; the sources each carry their own date', async () => {
    await openPage();
    await openStory(AI);
    click($('[data-explore-connections] button'));
    expect($$('[data-explore-connection]').map((c) => c.dataset.exploreConnection)).toEqual(['source_cited', 'reporters_reading', 'no_source_yet']);
    expect($('[data-explore-connections]').textContent).toContain(COPY.story.connectionsClose);
    click($('[data-explore-sources] button'));
    expect($$('[data-explore-source-dated]').map((d) => d.textContent)).toEqual(['Evidence dated Aug 2026', 'Evidence dated Sep 2026', 'Evidence dated May 2026']);
    expect($('[data-explore-published]').textContent).toBe('Published Nov 20, 2026 · evidence dated May to Sep 2026');
  });
  it('the questions are a radio group: arrow keys move the choice and the focus; one Tab stop', async () => {
    await openPage();
    await openStory(AI);
    const radios = () => $$('[role="radio"]');
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1]);
    radios()[0].focus();
    press(radios()[0], 'ArrowDown');
    expect(radios()[1].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radios()[1]);
    expect($('[data-explore-question-input]').value).toBe(AI.questions[1].text);
  });
  it('← Explore returns home at the scroll position left, focus back on what opened the story', async () => {
    await openPage();
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    const opener = card(AI.id).querySelector('[data-explore-card-primary]');
    await openStory(AI, () => click(opener));
    click($('[data-explore-back]'));
    await until(() => $('[data-explore-screen="home"]'), 'home');
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 640);
    expect(document.activeElement).toBe(card(AI.id).querySelector('[data-explore-card-primary]'));
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });
});

describe('search (spec §3.3, K-12)', () => {
  it('a story match opens the story with the matched question selected', async () => {
    await openPage();
    typeInto($('#ftx-search'), 'power-equipment');
    await flush();
    click($('[data-explore-result="story"]'));
    await until(() => $('[data-explore-screen="story"]'), 'the story');
    expect($('[role="radio"][aria-checked="true"]').dataset.exploreQuestion).toBe('q-power');
  });
  it('a company opens AssetResearch, by the Search page\'s own matcher', async () => {
    await openPage();
    typeInto($('#ftx-search'), 'NVDA');
    await flush();
    const row = $('[data-explore-result="company"]');
    expect(row.textContent).toContain('NVDA');
    click(row);
    await until(() => $('[data-stub="asset"]'), 'the research modal');
    expect($('[data-stub="asset"]').textContent).toBe('NVDA');
  });
  it('no match, with access: "No story on this yet." above the own-words row, which is last', async () => {
    await openPage();
    typeInto($('#ftx-search'), 'qqzzxx');
    await flush();
    const rows = $$('[data-explore-search-results] > *');
    expect(rows.at(-2).textContent).toBe(COPY.search.noStory);
    expect(rows.at(-1).dataset.exploreResult).toBe('own-words');
  });
  it('fewer than three characters: no own-words row', async () => {
    await openPage();
    typeInto($('#ftx-search'), 'qz');
    await flush();
    expect($('[data-explore-result="own-words"]')).toBeNull();
  });
  it.each([['gated', GATED], ['failed', NO_ANSWER]])('no match, %s: the line that points at companies, and no own-words row', async (_n, answer) => {
    await openPage({ answer });
    typeInto($('#ftx-search'), 'qqzzxx');
    await flush();
    expect($('[data-explore-no-story]').textContent).toBe(COPY.search.noStoryNoAccess);
    expect($('[data-explore-result="own-words"]')).toBeNull();
  });
});

describe('the sheet: the four ways in (K-8, K-9; spec §3.6\'s table)', () => {
  it('Work this idea: mode item, startNow, the spec\'s item with the question as edited; standalone; focus to Close; the page inert', async () => {
    const m = await openPage();
    await openStory(AI);
    typeInto($('[data-explore-question-input]'), 'Which suppliers ship first?');
    const opener = primary();
    click(opener);
    await until(() => body.mounts.length === 1, 'the body');
    const p = body.mounts[0];
    expect(p).toMatchObject({
      open: true, mode: 'item', startNow: true, direction: null, stories: [], agentName: null, agentId: null, equippedListLabel: null, gated: false, overlayStack: null,
      item: { itemRef: { recordKind: 'exploreStories', recordId: AI.id }, headline: AI.title, reporterName: 'Kim', beat: AI.reporter.beat, publishedAt: AI.publishedAt, context: AI.deck, question: 'Which suppliers ship first?', reason: null },
    });
    expect(p.sessionId).toBeUndefined();
    expect(p.words).toBeUndefined();
    expect(document.activeElement).toBe($('[data-explore-sheet-close]'));
    expect(m.host.hasAttribute('inert')).toBe(true);
    expect($('[data-explore-sheet-overlay]').hasAttribute('inert')).toBe(false);
    expect(window.scrollTo).toHaveBeenCalledTimes(1); // the story's own scroll to the top; the sheet moves nothing
  });
  it('closing it: the read once more, the page released, focus back on the SAME button — now Continue research (spec §9 checks 4, 5)', async () => {
    const m = await openPage();
    await openStory(AI);
    const opener = primary();
    click(opener);
    await until(() => body.mounts.length === 1, 'the body');
    read.mockResolvedValue(answerOf(READS.walkAfterOpen));
    click($('[data-body-close]'));
    await until(() => panel()?.dataset.explorePanel === 'B', 'form B');
    expect(read).toHaveBeenCalledTimes(2);
    expect(m.host.hasAttribute('inert')).toBe(false);
    expect(primary()).toBe(opener);
    expect(opener.textContent).toBe(COPY.panel.continue);
    expect(document.activeElement).toBe(opener);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });
  it('Continue research: mode session with the read\'s open.sessionId — never a new open (K-9); a fresh body per opening', async () => {
    await openPage({ answer: answerOf(READS.progress) });
    await openStory(AI);
    click(primary());
    await until(() => body.mounts.length === 1, 'the body');
    expect(body.mounts[0]).toMatchObject({ mode: 'session', sessionId: READS.progress.items[0].open.sessionId });
    expect(body.mounts[0].startNow).toBeUndefined();
    expect(body.mounts[0].item).toBeUndefined();
    click($('[data-body-close]'));
    await until(() => !$('[data-explore-sheet-overlay]'), 'closed');
    await flush();
    click(primary());
    await until(() => body.mounts.length === 2, 'a second body');
    expect(body.mounts[1].sessionId).toBe(body.mounts[0].sessionId);
  });
  it('Continue from the card and from the in-progress row: the same session', async () => {
    await openPage({ answer: answerOf(READS.progress) });
    click(card(AI.id).querySelector('[data-explore-card-primary]'));
    await until(() => body.mounts.length === 1, 'the body');
    click($('[data-body-close]'));
    await until(() => !$('[data-explore-sheet-overlay]'), 'closed');
    click($('[data-explore-progress-continue]'));
    await until(() => body.mounts.length === 2, 'the body again');
    expect(body.mounts.map((p) => [p.mode, p.sessionId])).toEqual([['session', READS.progress.items[0].open.sessionId], ['session', READS.progress.items[0].open.sessionId]]);
  });
  it('View it: mode session with the read\'s last.sessionId', async () => {
    await openPage({ answer: answerOf(READS.saved) });
    await openStory(AI);
    click($('[data-explore-view-it]'));
    await until(() => body.mounts.length === 1, 'the body');
    expect(body.mounts[0]).toMatchObject({ mode: 'session', sessionId: READS.saved.items[0].last.sessionId });
  });
  it('search\'s own words: mode start with the typed text, and nothing else', async () => {
    await openPage();
    typeInto($('#ftx-search'), 'drones for farms');
    await flush();
    click($('[data-explore-result="own-words"]'));
    await until(() => body.mounts.length === 1, 'the body');
    expect(body.mounts[0]).toMatchObject({ mode: 'start', words: 'drones for farms' });
    expect(body.mounts[0].startNow).toBeUndefined();
  });
  it('Escape closes; the close button closes; the read runs once per close', async () => {
    await openPage();
    await openStory(AI);
    click(primary());
    await until(() => body.mounts.length === 1, 'the body');
    press($('[data-explore-sheet-close]'), 'Escape');
    await until(() => !$('[data-explore-sheet-overlay]'), 'closed by Escape');
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe('bookmarks (K-11, spec §3.8)', () => {
  it('Save for later saves the story (aria-pressed) and lists it; again removes it', async () => {
    await openPage();
    await until(() => $('[data-explore-saved]')?.textContent.includes(COPY.home.savedEmpty), 'the saved list');
    const toggle = card(TAP.id).querySelector('[data-explore-save]');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    click(toggle);
    await until(() => card(TAP.id).querySelector('[data-explore-save]').getAttribute('aria-pressed') === 'true', 'saved');
    expect($('[data-explore-saved-row="sample-tap-to-pay"]')).not.toBeNull();
    click(card(TAP.id).querySelector('[data-explore-save]'));
    await until(() => card(TAP.id).querySelector('[data-explore-save]').getAttribute('aria-pressed') === 'false', 'removed');
    expect(sources.calls.filter((c) => /Bookmark$/.test(c.kind) && c.kind !== 'readBookmarks').map((c) => c.kind)).toEqual(['saveBookmark', 'removeBookmark']);
  });
  it('a failed save says so in one line and leaves the toggle as it was', async () => {
    sources = fixtureSources({ failWrites: new Set(['save']) });
    await openPage();
    click(card(TAP.id).querySelector('[data-explore-save]'));
    await until(() => card(TAP.id).querySelector('[data-explore-bookmark-error]'), 'the line');
    expect(card(TAP.id).querySelector('[data-explore-bookmark-error]').textContent).toBe(COPY.bookmark.failedSave);
    expect(card(TAP.id).querySelector('[data-explore-save]').getAttribute('aria-pressed')).toBe('false');
  });
  it('the cap of 50 is the client\'s: the 51st is refused with its line and nothing is written', async () => {
    sources = fixtureSources({ bookmarks: Array.from({ length: 50 }, (_, i) => ({ storyId: `old-${i}`, storyVersion: 1, title: `Old ${i}`, savedAt: '2026-11-01T00:00:00.000Z' })) });
    await openPage();
    await until(() => $$('[data-explore-saved-row]').length === 50, 'fifty saved');
    click(card(TAP.id).querySelector('[data-explore-save]'));
    await flush();
    expect(card(TAP.id).querySelector('[data-explore-bookmark-error]').textContent).toBe(COPY.bookmark.cap(50));
    expect(sources.calls.filter((c) => c.kind === 'saveBookmark')).toEqual([]);
  });
});
