// @vitest-environment jsdom
//
// Explore Build 1 — THE FOUNDER'S ROUND (Nov 22, 2026; report §16, spec Amendment A). Two of the four changes need a
// page to show them (the other two are pinned in explore.guard.test.js and test/rules/exploreBookmarks.rules.mjs):
//   SQ-8  search at the daily limit: with the read ready, three or more characters typed and the limit reached (the
//         panel's own atLimitOf over the read's quota), the own-words row is not drawn; one status line takes its
//         place, its number the read's quota.perDay. Below the limit, gated and failed: as before.
//   F-1   inside a story the page's tab row is not drawn; the heading stays; "← Explore" brings the row back; it is
//         never hidden on another tab, on Explore's home, or at 'off'; the Explore tab reports false when it unmounts.
// Same harness as explore.screens.jsdom.test.jsx: the real Search page, the research read in the service's shape over
// server-composed answers, fixture sources, today's tab views stubbed, the sheet's body replaced through Explore's own
// loader by a stand-in.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ mode: 'on' }));
vi.mock('../../config/exploreFlags', () => ({ EXPLORE_MODES: ['off', 'allowlist', 'on'], EXPLORE_MODE: 'off', exploreMode: () => flags.mode }));
const read = vi.hoisted(() => vi.fn());
vi.mock('../../services/sharedResearchService', () => ({ readExploreInvestigations: read }));
vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('./loadSharedResearch', async () => {
  const R = await import('react');
  function BodyStandIn(props) {
    return R.createElement('div', { 'data-body-stand-in': props.mode }, R.createElement('button', { type: 'button', onClick: props.onClose, 'data-body-close': '' }, 'close'));
  }
  return { loadSharedResearch: () => Promise.resolve({ default: BodyStandIn }) };
});
vi.mock('../Search/ExploreView', () => ({ default: function MarketsStub() { return <div data-stub="markets">movers</div>; } }));
vi.mock('../Search/RankingsView', () => ({ default: function RankingsStub() { return <div data-stub="rankings" />; } }));
vi.mock('../Search/InstitutionalView', () => ({ default: function InstitutionalStub() { return <div data-stub="institutional" />; } }));
vi.mock('../Search/ScreenerView', () => ({ default: function ScreenerStub() { return <div data-stub="screen" />; } }));
vi.mock('../Research/CorrelationLab', () => ({ default: function CorrelationStub() { return <div data-stub="correlations" />; } }));
vi.mock('../draft/AssetResearchModal', () => ({ default: function AssetStub({ asset }) { return <div data-stub="asset">{asset.symbol}</div>; } }));

const { default: SearchDiscover } = await import('../Search/SearchDiscover');
const { default: ExploreTab } = await import('./ExploreTab');
const { default: ExploreRuntime } = await import('./ExploreRuntime');
const { CORRELATION_LAB_ENABLED } = await import('../../config/featureFlags');
const kit = await import('./__fixtures__/exploreKit');
const { READS, GATED, NO_ANSWER, SAMPLE_STORIES, answerOf, fixtureSources, mount, flush, click, typeInto, $, $$, buttonNamed, deferred, until } = kit;
const { EXPLORE_COPY: COPY } = await import('./exploreCopy');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Rows wait on lazy modules and the page's own animations in real time: 15 s each, so a loaded machine cannot time one out.
vi.setConfig({ testTimeout: 15_000 });
const USER = { uid: 'u-explore-1' };
const [AI, TAP] = SAMPLE_STORIES;
const OLD_TABS = ['Explore', 'Rankings', 'Institutional', 'Screen', ...(CORRELATION_LAB_ENABLED ? ['Correlations'] : [])];
const NEW_TABS = ['Explore', 'Markets', 'Rankings', 'Institutional', 'Screen', ...(CORRELATION_LAB_ENABLED ? ['Correlations'] : [])];
const CONTENT = { Explore: '[data-explore-tab]', Markets: '[data-stub="markets"]', Rankings: '[data-stub="rankings"]', Institutional: '[data-stub="institutional"]', Screen: '[data-stub="screen"]', Correlations: '[data-stub="correlations"]' };
let mounted = [];
let sources;
/** Whether the tab row was drawn at each window.scrollTo, in order (the scroll must see the row as the view has it). */
let scrolls = [];
const keep = (m) => { mounted.push(m); return m; };
/** The page's tab row: its buttons (the page's own pill style), as the page test reads them; [] when not drawn. */
const tabLabels = () => $$('button').filter((b) => b.style.borderRadius === '24px').map((b) => b.textContent.trim());
const heading = () => $('h1')?.textContent.trim();
const page = (props = {}) => <SearchDiscover user={USER} isMobile isDesktop={false} setScreen={vi.fn()} stocksData={[]} sidebarCollapsed={false} {...props} />;
const card = (id) => $(`[data-explore-card="${id}"]`);
const onHome = () => $('[data-explore-screen="home"]') && !$('[data-explore-home-holder]').hidden;

beforeEach(() => {
  flags.mode = 'on';
  read.mockReset();
  read.mockResolvedValue(answerOf(READS.none));
  sources = fixtureSources();
  scrolls = [];
  window.scrollTo = vi.fn((_x, y) => { scrolls.push({ y, row: tabLabels().length > 0 }); });
  window.scrollBy = vi.fn();
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  document.body.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

async function openPage({ answer, src = sources } = {}) {
  if (answer) read.mockResolvedValue(answer);
  const m = keep(mount(page(), { sources: src }));
  await until(() => $('[data-explore-search]'), 'the Explore tab');
  await flush();
  return m;
}
async function openStory(story) {
  const opener = card(story.id).querySelector('[data-explore-card-read]') ?? card(story.id).querySelector('[data-explore-card-primary]');
  click(opener);
  await until(() => $('[data-explore-screen="story"]'), 'the story');
  await flush();
  return opener;
}
const searchRows = () => $$('[data-explore-search-results] > *');

describe('SQ-8: search at the daily limit', () => {
  // A planted quota no rule would compute: 7 a day, 7 used.
  const at = (used, perDay) => answerOf({ ...READS.none, quota: { ...READS.none.quota, investigationsToday: used, perDay } });

  it('no match: "No story on this yet.", then the limit line in the own-words row\'s place, with the read\'s own number', async () => {
    await openPage({ answer: at(7, 7) });
    typeInto($('#ftx-search'), 'qqzzxx');
    await flush();
    expect($('[data-explore-result="own-words"]')).toBeNull();
    const line = $('[data-explore-search-limit]');
    expect(line.getAttribute('role')).toBe('status');
    expect(line.textContent).toBe("You've used today's 7 investigations. Try this one tomorrow.");
    expect(line.textContent).toBe(COPY.search.limit(7));
    expect(searchRows().at(-2).textContent).toBe(COPY.search.noStory);
    expect(searchRows().at(-1)).toBe(line);
  });
  it('a company match: the companies as before, the limit line last, no own-words row', async () => {
    await openPage({ answer: at(7, 7) });
    typeInto($('#ftx-search'), 'NVDA');
    await flush();
    expect($('[data-explore-result="company"]').textContent).toContain('NVDA');
    expect($('[data-explore-no-story]')).toBeNull();
    expect($('[data-explore-result="own-words"]')).toBeNull();
    expect(searchRows().at(-1).textContent).toBe(COPY.search.limit(7));
  });
  it('past the limit (8 of 7, as the read says) is the limit too; fewer than three characters shows neither row nor line', async () => {
    await openPage({ answer: at(8, 7) });
    typeInto($('#ftx-search'), 'qz');
    await flush();
    expect($('[data-explore-search-limit]')).toBeNull();
    expect($('[data-explore-result="own-words"]')).toBeNull();
    typeInto($('#ftx-search'), 'qqzzxx');
    await flush();
    expect($('[data-explore-search-limit]').textContent).toBe(COPY.search.limit(7));
  });
  it('below the limit (6 of 7): the own-words row, last, as before — and no limit line', async () => {
    await openPage({ answer: at(6, 7) });
    typeInto($('#ftx-search'), 'qqzzxx');
    await flush();
    expect(searchRows().at(-2).textContent).toBe(COPY.search.noStory);
    expect(searchRows().at(-1).dataset.exploreResult).toBe('own-words');
    expect($('[data-explore-search-limit]')).toBeNull();
  });
  it.each([['gated', GATED], ['failed', NO_ANSWER]])('%s: the line that points at companies, no own-words row, no limit line — as before', async (_n, answer) => {
    await openPage({ answer });
    typeInto($('#ftx-search'), 'qqzzxx');
    await flush();
    expect($('[data-explore-no-story]').textContent).toBe(COPY.search.noStoryNoAccess);
    expect($('[data-explore-result="own-words"]')).toBeNull();
    expect($('[data-explore-search-limit]')).toBeNull();
  });
});

describe('F-1: no tab row inside a story', () => {
  it.each([['on'], ['allowlist']])('at \'%s\': home shows the row; a story hides it (the heading and "← Explore" stay); "← Explore" brings it back, at the scroll left, focus on the opener', async (mode) => {
    flags.mode = mode;
    await openPage();
    expect(tabLabels()).toEqual(NEW_TABS);
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    const opener = await openStory(AI);
    expect(tabLabels()).toEqual([]);
    expect(heading()).toBe('Explore');
    expect($('[data-explore-back]').textContent).toBe(COPY.story.back);
    expect(document.activeElement).toBe($('[data-explore-story-title]'));
    click($('[data-explore-back]'));
    await until(onHome, 'home');
    expect(tabLabels()).toEqual(NEW_TABS);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 640);
    expect(document.activeElement).toBe(opener);
  });
  it('the scroll on opening runs with the row already gone, and the scroll on "← Explore" with the row already back', async () => {
    await openPage();
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    await openStory(AI);
    expect(scrolls).toEqual([{ y: 0, row: false }]);
    click($('[data-explore-back]'));
    await until(onHome, 'home');
    expect(scrolls).toEqual([{ y: 0, row: false }, { y: 640, row: true }]);
  });
  it('a story opened from search hides it too; a second story after "← Explore" again', async () => {
    await openPage();
    typeInto($('#ftx-search'), 'power-equipment');
    await flush();
    click($('[data-explore-result="story"]'));
    await until(() => $('[data-explore-screen="story"]'), 'the story');
    expect(tabLabels()).toEqual([]);
    click($('[data-explore-back]'));
    await until(onHome, 'home');
    expect(tabLabels()).toEqual(NEW_TABS);
    await openStory(TAP);
    expect(tabLabels()).toEqual([]);
  });
  it('the row is there on every other tab, and on Explore\'s home after each', async () => {
    await openPage();
    for (const label of NEW_TABS.slice(1)) {
      click(buttonNamed(label));
      await until(() => $(CONTENT[label]), `the ${label} tab`);
      expect(tabLabels(), label).toEqual(NEW_TABS);
      click(buttonNamed('Explore'));
      await until(() => $('[data-explore-search]'), 'Explore');
      expect(tabLabels(), `Explore after ${label}`).toEqual(NEW_TABS);
    }
  });
  it('the story disappearing brings the row back (a player change at \'on\', whose stories no longer hold it)', async () => {
    const second = deferred();
    let n = 0;
    sources = fixtureSources({ stories: () => { n += 1; return n === 1 ? SAMPLE_STORIES : second.promise; } });
    const m = await openPage();
    await openStory(AI);
    expect(tabLabels()).toEqual([]);
    m.rerender(page({ user: { uid: 'u-explore-2' } }));
    await flush();
    expect(tabLabels()).toEqual(NEW_TABS); // the stories are loading: no story shows
    second.resolve(SAMPLE_STORIES.filter((s) => s.id !== AI.id));
    await until(() => $('[data-explore-screen="gone"]'), 'the gone line');
    expect(tabLabels()).toEqual(NEW_TABS);
    click($('[data-explore-back]'));
    await until(onHome, 'home');
    expect(tabLabels()).toEqual(NEW_TABS);
  });
  it('at \'allowlist\', the Explore tab dropped with a story open (a player change): the row is back at once, on Markets — and on Explore\'s home when the new player is admitted', async () => {
    flags.mode = 'allowlist';
    await openPage();
    const m = mounted.at(-1);
    await openStory(AI);
    expect(tabLabels()).toEqual([]);
    const held = deferred();
    read.mockReturnValue(held.promise);
    m.rerender(page({ user: { uid: 'u-explore-2' } }));
    await flush();
    // at once: the Explore tab's content is still leaving (the page's exit animation) — the row must not wait for it
    expect(tabLabels()).toEqual(OLD_TABS);
    await until(() => $('[data-stub="markets"]'), 'Markets');
    expect(tabLabels()).toEqual(OLD_TABS);
    held.resolve(answerOf(READS.none));
    await until(() => $('[data-explore-search]'), 'Explore again');
    expect(tabLabels()).toEqual(NEW_TABS);
  });
  it('at \'off\': the row on every tab, today\'s; the Explore tab is never drawn, so nothing can report a story', async () => {
    flags.mode = 'off';
    keep(mount(page(), { sources }));
    await flush();
    expect(tabLabels()).toEqual(OLD_TABS);
    for (const label of OLD_TABS) {
      click(buttonNamed(label));
      await until(() => $(CONTENT[label === 'Explore' ? 'Markets' : label]), `the ${label} tab`);
      expect(tabLabels(), label).toEqual(OLD_TABS);
    }
    expect($('[data-explore-tab]')).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});

describe('F-1: the Explore tab\'s report (its one callback)', () => {
  // The tab beside the real runtime (the page's reads, in their own shapes); `show` takes the tab away, as the page
  // does when the Explore tab is dropped.
  function Harness({ onInStory, show }) {
    const [explore, setExplore] = React.useState(null);
    return (
      <>
        <ExploreRuntime uid="u-explore-1" mode="on" onChange={setExplore} />
        {show ? <ExploreTab explore={explore} onInStory={onInStory} /> : null}
      </>
    );
  }
  it('true on a story, false on "← Explore", and false when it unmounts with a story open', async () => {
    const onInStory = vi.fn();
    const m = keep(mount(<Harness onInStory={onInStory} show />, { sources }));
    await until(() => card(AI.id), 'the cards');
    await flush();
    expect(onInStory).toHaveBeenLastCalledWith(false);
    click(card(AI.id).querySelector('[data-explore-card-read]') ?? card(AI.id).querySelector('[data-explore-card-primary]'));
    await until(() => $('[data-explore-screen="story"]'), 'the story');
    expect(onInStory).toHaveBeenLastCalledWith(true);
    click($('[data-explore-back]'));
    await flush();
    expect(onInStory).toHaveBeenLastCalledWith(false);
    click(card(AI.id).querySelector('[data-explore-card-read]') ?? card(AI.id).querySelector('[data-explore-card-primary]'));
    await until(() => $('[data-explore-screen="story"]'), 'the story');
    expect(onInStory).toHaveBeenLastCalledWith(true);
    const calls = onInStory.mock.calls.length;
    m.rerender(<Harness onInStory={onInStory} show={false} />);
    await flush();
    expect($('[data-explore-tab]')).toBeNull();
    expect(onInStory.mock.calls.slice(calls)).toEqual([[false]]);
  });
});
