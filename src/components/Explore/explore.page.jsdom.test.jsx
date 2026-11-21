// @vitest-environment jsdom
//
// Explore Build 1 — THE SEARCH PAGE AT EACH VALUE OF THE SWITCH (build prompt K-2, K-4, K-5; spec §3.1, §6).
// The real SearchDiscover, with the research service mocked (its result shape), the stories and bookmarks answered
// by fixture sources, and today's tab views stubbed.
//   K-2  'off': today's heading, tabs, labels and search bar; the read is never made and no Explore module loads.
//   K-5  'allowlist': today's page until the read is ready, then the Explore tab in front, opened only if nothing was
//        tapped yet (and never stealing focus); a gated or failed read leaves today's page. 'on': Explore first and
//        open for everyone. The nav says "Explore" at 'on' only.
//   K-4  the read: once at mount (not at 'off'), never on a tab switch; an answer for a player who has changed is
//        dropped.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ mode: 'off' }));
vi.mock('../../config/exploreFlags', () => ({ EXPLORE_MODES: ['off', 'allowlist', 'on'], EXPLORE_MODE: 'off', exploreMode: () => flags.mode }));
const read = vi.hoisted(() => vi.fn());
vi.mock('../../services/sharedResearchService', () => ({ readExploreInvestigations: read }));
vi.mock('../../firebase/config', () => ({ db: {} }));
const loaded = vi.hoisted(() => ({ runtime: 0, tab: 0 }));
vi.mock('./ExploreRuntime', async (importOriginal) => { loaded.runtime += 1; return importOriginal(); });
vi.mock('./ExploreTab', async (importOriginal) => { loaded.tab += 1; return importOriginal(); });
vi.mock('../Search/ExploreView', () => ({ default: function MarketsStub() { return <div data-stub="markets">movers</div>; } }));
vi.mock('../Search/RankingsView', () => ({ default: function RankingsStub() { return <div data-stub="rankings" />; } }));
vi.mock('../Search/InstitutionalView', () => ({ default: function InstitutionalStub() { return <div data-stub="institutional" />; } }));
vi.mock('../Search/ScreenerView', () => ({ default: function ScreenerStub() { return <div data-stub="screen" />; } }));
vi.mock('../Research/CorrelationLab', () => ({ default: function CorrelationStub() { return <div data-stub="correlations" />; } }));
vi.mock('../draft/AssetResearchModal', () => ({ default: function AssetStub({ asset }) { return <div data-stub="asset">{asset.symbol}</div>; } }));

const { default: SearchDiscover } = await import('../Search/SearchDiscover');
const { default: BottomNav } = await import('../Navigation/BottomNav');
const { default: DesktopSidebar } = await import('../Navigation/DesktopSidebar');
const { CORRELATION_LAB_ENABLED } = await import('../../config/featureFlags');
const kit = await import('./__fixtures__/exploreKit');
const { READS, GATED, NO_ANSWER, answerOf, fixtureSources, mount, flush, click, $, $$, buttonNamed, deferred, until } = kit;
const CONTENT = { Explore: '[data-explore-tab]', Markets: '[data-stub="markets"]', Rankings: '[data-stub="rankings"]', Institutional: '[data-stub="institutional"]', Screen: '[data-stub="screen"]' };
const openTab = async (label) => { click(buttonNamed(label)); await until(() => $(CONTENT[label]), `the ${label} tab`); };

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const USER = { uid: 'u-explore-1', username: 'Flash' };
const OLD_TABS = ['Explore', 'Rankings', 'Institutional', 'Screen', ...(CORRELATION_LAB_ENABLED ? ['Correlations'] : [])];
const NEW_TABS = ['Explore', 'Markets', 'Rankings', 'Institutional', 'Screen', ...(CORRELATION_LAB_ENABLED ? ['Correlations'] : [])];
let mounted = [];
let sources;
const keep = (m) => { mounted.push(m); return m; };
const tabLabels = () => $$('button').filter((b) => b.style.borderRadius === '24px').map((b) => b.textContent.trim());
const heading = () => $('h1')?.textContent.trim();
const searchBar = () => $$('span').find((s) => s.textContent.trim() === 'Search stocks by ticker or name...') ?? null;
const page = (props = {}) => <SearchDiscover user={USER} isMobile isDesktop={false} setScreen={vi.fn()} stocksData={[]} sidebarCollapsed={false} {...props} />;

beforeEach(() => {
  flags.mode = 'off';
  read.mockReset();
  read.mockResolvedValue(answerOf(READS.none));
  sources = fixtureSources();
  window.scrollTo = vi.fn();
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; });

describe("K-2: at 'off' the Search page is today's", () => {
  it('the heading, the tabs and their labels, the search bar and the movers tab — and the read is never made', async () => {
    keep(mount(page(), { sources }));
    await flush();
    expect(heading()).toBe('Discover');
    expect(tabLabels()).toEqual(OLD_TABS);
    expect(searchBar()).not.toBeNull();
    expect($('[data-stub="markets"]')).not.toBeNull();
    expect($('[data-explore-tab]')).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(sources.calls).toEqual([]);
  });
  it('no Explore module is loaded at all (neither the runtime nor the tab)', async () => {
    keep(mount(page(), { sources }));
    await flush();
    buttonNamed('Rankings') && click(buttonNamed('Rankings'));
    await flush();
    expect(loaded).toEqual({ runtime: 0, tab: 0 });
  });
  it('the nav says "Search" (BottomNav and the desktop sidebar)', () => {
    keep(mount(<BottomNav screen="search" setScreen={vi.fn()} setShowForge={vi.fn()} showForge={false} />));
    keep(mount(<DesktopSidebar screen="search" setScreen={vi.fn()} />));
    expect($$('nav button').map((b) => b.textContent.trim()).filter((t) => /Search|Explore/.test(t))).toEqual(['Search', 'Search']);
  });
});

describe("K-5 'on': the Explore tab is first and open for everyone", () => {
  it('heading Explore, tabs Explore · Markets · …, the old search bar gone on Explore, the read made once', async () => {
    flags.mode = 'on';
    keep(mount(page(), { sources }));
    await until(() => $('[data-explore-search]'), 'the Explore tab');
    expect(heading()).toBe('Explore');
    expect(tabLabels()).toEqual(NEW_TABS);
    expect($('[data-explore-tab]')).not.toBeNull();
    expect(searchBar()).toBeNull();
    expect($('[data-explore-search]')).not.toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('Markets is today\'s movers tab, with today\'s search bar; tab switches never read again', async () => {
    flags.mode = 'on';
    keep(mount(page(), { sources }));
    await until(() => $('[data-explore-search]'), 'the Explore tab');
    await openTab('Markets');
    expect(searchBar()).not.toBeNull();
    for (const t of ['Rankings', 'Institutional', 'Screen', 'Explore', 'Markets', 'Explore']) await openTab(t);
    expect(read).toHaveBeenCalledTimes(1);
    expect(sources.calls.filter((c) => c.kind === 'readStories')).toHaveLength(1);
    expect(sources.calls.filter((c) => c.kind === 'readBookmarks')).toHaveLength(1);
  });
  it('a gated player and a failed read still get the Explore tab (states inside it)', async () => {
    flags.mode = 'on';
    read.mockResolvedValue(GATED);
    keep(mount(page(), { sources }));
    await until(() => $('[data-explore-cards]'), 'the cards');
    expect(tabLabels()[0]).toBe('Explore');
  });
  it('the nav says "Explore" at \'on\'', () => {
    flags.mode = 'on';
    keep(mount(<BottomNav screen="search" setScreen={vi.fn()} setShowForge={vi.fn()} showForge={false} />));
    keep(mount(<DesktopSidebar screen="search" setScreen={vi.fn()} />));
    expect($$('nav button').map((b) => b.textContent.trim()).filter((t) => /Search|Explore/.test(t))).toEqual(['Explore', 'Explore']);
  });
});

describe("K-5 'allowlist': today's page until the read admits the player", () => {
  it('while the read runs: today\'s page; no stories or bookmarks read', async () => {
    flags.mode = 'allowlist';
    const held = deferred();
    read.mockReturnValue(held.promise);
    keep(mount(page(), { sources }));
    await flush();
    expect(heading()).toBe('Discover');
    expect(tabLabels()).toEqual(OLD_TABS);
    expect(sources.calls).toEqual([]);
    held.resolve(answerOf(READS.none));
    await until(() => $('[data-explore-tab]'), 'the Explore tab'); // opened by itself: nothing was tapped
    expect(heading()).toBe('Explore');
    expect(tabLabels()).toEqual(NEW_TABS);
    expect(sources.calls.map((c) => c.kind).sort()).toEqual(['readBookmarks', 'readStories']);
  });
  it.each([['gated', GATED], ['failed', NO_ANSWER]])('a %s read leaves today\'s page, and reads no stories', async (_n, answer) => {
    flags.mode = 'allowlist';
    read.mockResolvedValue(answer);
    keep(mount(page(), { sources }));
    await flush();
    expect(heading()).toBe('Discover');
    expect(tabLabels()).toEqual(OLD_TABS);
    expect(sources.calls).toEqual([]);
  });
  it('a tap before the read answers: the tab is added but does not open, and focus stays where the player put it', async () => {
    flags.mode = 'allowlist';
    const held = deferred();
    read.mockReturnValue(held.promise);
    keep(mount(page(), { sources }));
    await flush();
    const rankings = buttonNamed('Rankings');
    rankings.focus();
    click(rankings);
    await until(() => $('[data-stub="rankings"]'), 'the Rankings tab');
    held.resolve(answerOf(READS.none));
    await until(() => tabLabels()[0] === 'Explore' && tabLabels()[1] === 'Markets', 'the tab added');
    await new Promise((r) => { setTimeout(r, 300); });
    await flush();
    expect(tabLabels()).toEqual(NEW_TABS);
    expect($('[data-stub="rankings"]')).not.toBeNull();
    expect($('[data-explore-tab]')).toBeNull();
    expect(document.activeElement).toBe(buttonNamed('Rankings'));
  });
  it('the search bar tap counts as a tap too', async () => {
    flags.mode = 'allowlist';
    const held = deferred();
    read.mockReturnValue(held.promise);
    keep(mount(page(), { sources }));
    await flush();
    click(searchBar().parentElement);
    held.resolve(answerOf(READS.none));
    await until(() => tabLabels()[1] === 'Markets', 'the tab added');
    await new Promise((r) => { setTimeout(r, 300); });
    await flush();
    expect($('[data-explore-tab]')).toBeNull();
    expect(tabLabels()[0]).toBe('Explore');
  });
  it('the nav still says "Search" at \'allowlist\'', () => {
    flags.mode = 'allowlist';
    keep(mount(<BottomNav screen="search" setScreen={vi.fn()} setShowForge={vi.fn()} showForge={false} />));
    expect($$('nav button').map((b) => b.textContent.trim())).toContain('Search');
    expect($$('nav button').map((b) => b.textContent.trim())).not.toContain('Explore');
  });
});

describe('K-4: an answer for a player who has changed is dropped', () => {
  it('the first player\'s late answer never shows for the second; the second gets one read of their own', async () => {
    flags.mode = 'on';
    const first = deferred();
    read.mockReturnValueOnce(first.promise).mockResolvedValueOnce(answerOf(READS.none));
    const m = keep(mount(page(), { sources }));
    await flush();
    m.rerender(page({ user: { uid: 'u-explore-2' } }));
    await flush();
    first.resolve(answerOf(READS.progress));
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
    expect($('[data-explore-progress-row]')).toBeNull();
    expect($$('[data-explore-card-primary="continue"]')).toEqual([]);
  });
});
