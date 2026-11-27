// @vitest-environment jsdom
//
// Explore Build 1 — THE REQUEST GUARD (spec N-4, §9 check 9; build prompt K-4, Tests). With every export of the
// research service a spy and `fetch` itself trapped, a scripted run of everything the page offers short of the sheet
// — browsing, choosing a topic, searching (a story, a company, nonsense), opening a story, choosing, editing and
// resetting a question, the questions' arrow keys, the collapsed sections, saving and removing a bookmark, going
// back — calls ONLY readExploreInvestigations, and only once: at mount. No open, step, card op, close, list=open
// or session read leaves the page, and nothing else reaches the network.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/exploreFlags', () => ({ EXPLORE_MODES: ['off', 'allowlist', 'on'], EXPLORE_MODE: 'off', exploreMode: () => 'on', EXPLORE_COMPARE_ROUTE: false, exploreCompareRoute: () => false }));
const service = vi.hoisted(() => ({
  readExploreInvestigations: vi.fn(), listOpenInvestigations: vi.fn(), readInvestigation: vi.fn(), frameQuestion: vi.fn(), openInvestigation: vi.fn(),
  takeStep: vi.fn(), closeInvestigation: vi.fn(), adoptIdea: vi.fn(), applyCardOp: vi.fn(), equipIdea: vi.fn(), newRequestId: vi.fn(),
  SHARED_RESEARCH_ROUTE: '/api/forge/shared-research', CLIENT_TIMEOUT_MS: 35000,
}));
vi.mock('../../services/sharedResearchService', () => service);
vi.mock('../../firebase/config', () => ({ db: {} }));
const sheetLoads = vi.hoisted(() => ({ n: 0 }));
vi.mock('./loadSharedResearch', () => ({ loadSharedResearch: () => { sheetLoads.n += 1; return new Promise(() => {}); } }));
vi.mock('../Search/ExploreView', () => ({ default: function MarketsStub() { return <div data-stub="markets" />; } }));
vi.mock('../draft/AssetResearchModal', () => ({ default: function AssetStub() { return <div data-stub="asset" />; } }));

const { default: SearchDiscover } = await import('../Search/SearchDiscover');
const kit = await import('./__fixtures__/exploreKit');
const { READS, SAMPLE_STORIES, answerOf, fixtureSources, mount, flush, click, typeInto, press, $, $$, until } = kit;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Rows wait on lazy modules and the page's own animations in real time: 15 s each, so a loaded machine cannot time one out.
vi.setConfig({ testTimeout: 15_000 });
// Build 2: the tap-to-pay sample is a tile (B-5); the run saves and reads the utilities card instead, and browses a
// topic the cards carry (the AI and utilities overviews beside the pilot hero).
const [AI, , UTIL] = SAMPLE_STORIES;
let mounted = [];
let fetchCalls;
beforeEach(() => {
  for (const fn of Object.values(service)) if (typeof fn === 'function' && fn.mockReset) fn.mockReset();
  service.readExploreInvestigations.mockResolvedValue(answerOf(READS.progress));
  fetchCalls = [];
  globalThis.fetch = vi.fn((...args) => { fetchCalls.push(args); return Promise.reject(new Error('no network in this row')); });
  window.scrollTo = vi.fn();
  sheetLoads.n = 0;
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; });

const calledExports = () => Object.entries(service).filter(([, fn]) => typeof fn === 'function' && fn.mock?.calls.length > 0).map(([k, fn]) => [k, fn.mock.calls.length]);

describe('N-4: browsing, searching, bookmarking, choosing and editing call only the read', () => {
  it('a scripted run of the whole page: one read (at mount), nothing else of the service, no fetch, no sheet', async () => {
    const sources = fixtureSources();
    mounted.push(mount(<SearchDiscover user={{ uid: 'u-explore-1' }} isMobile isDesktop={false} setScreen={vi.fn()} stocksData={[]} sidebarCollapsed={false} />, { sources }));
    await until(() => $(`[data-explore-card="${AI.id}"]`), 'the cards');
    // browse: topics
    click($('[data-explore-topic="Energy grid"]'));
    click($('[data-explore-topic="*"]'));
    // search: a story, a company, nonsense (with the own-words row on screen, untouched)
    for (const q of ['power', 'NVDA', 'qqzzxx', '']) { typeInto($('#ftx-search'), q); await flush(); }
    // bookmark: save and remove
    click($(`[data-explore-card="${UTIL.id}"] [data-explore-save]`));
    await until(() => $(`[data-explore-card="${UTIL.id}"] [data-explore-save]`).getAttribute('aria-pressed') === 'true', 'saved');
    click($(`[data-explore-card="${UTIL.id}"] [data-explore-save]`));
    await until(() => $(`[data-explore-card="${UTIL.id}"] [data-explore-save]`).getAttribute('aria-pressed') === 'false', 'removed');
    // read a story with no investigation: choose, edit, reset, arrow keys, the two sections, save in the byline
    click($(`[data-explore-card="${UTIL.id}"] [data-explore-card-primary]`));
    await until(() => $('[data-explore-screen="story"]'), 'the story');
    const radios = () => $$('[role="radio"]');
    click(radios()[1]);
    typeInto($('[data-explore-question-input]'), 'Which utility spends first?');
    click($('[data-explore-reset]'));
    radios()[1].focus();
    press(radios()[1], 'ArrowUp');
    for (const b of $$('[data-explore-connections] button, [data-explore-sources] button')) click(b);
    click($('[data-explore-screen="story"] [data-explore-save]'));
    await flush();
    click($('[data-explore-back]'));
    // read the story WITH an open investigation and choose its other question (form B: no start control)
    click($(`[data-explore-card="${AI.id}"] [data-explore-card-read]`));
    await until(() => $('[data-explore-panel="B"]'), 'form B');
    click(radios()[1]);
    await flush();
    click($('[data-explore-back]'));
    await flush();

    expect(calledExports()).toEqual([['readExploreInvestigations', 1]]);
    expect(fetchCalls).toEqual([]);
    expect(sheetLoads.n).toBe(0);
    // the sources did only what the run asked: one stories read, one bookmarks read, the writes of the toggles
    expect(sources.calls.map((c) => c.kind)).toEqual(['readStories', 'readBookmarks', 'saveBookmark', 'removeBookmark', 'saveBookmark']);
  });
});
