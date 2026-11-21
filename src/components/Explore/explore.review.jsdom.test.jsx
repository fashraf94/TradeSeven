// @vitest-environment jsdom
//
// Explore Build 1 — THE REVIEW'S FINDINGS, one row each (BUILD_RULES §2; report §10). Each row fails on the code the
// four lenses read (1271dba6) and passes on the fix. Same harness as explore.screens.jsdom.test.jsx: the real Search
// page at 'on', the research read in the service's shape over server-composed answers, fixture sources, the sheet's
// body replaced through Explore's own loader by a stand-in.

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
vi.mock('../Search/ExploreView', () => ({ default: function MarketsStub() { return <div data-stub="markets"><button type="button" data-stub-card="">Top Gainers</button></div>; } }));
vi.mock('../draft/AssetResearchModal', () => ({ default: function AssetStub() { return <div data-stub="asset" />; } }));

const { default: SearchDiscover } = await import('../Search/SearchDiscover');
const kit = await import('./__fixtures__/exploreKit');
const { READS, GATED, NO_ANSWER, SAMPLE_STORIES, answerOf, fixtureSources, bookmarkOf, mount, flush, click, $, $$, deferred, until, typeInto } = kit;
const { EXPLORE_COPY: COPY } = await import('./exploreCopy');
const { act } = await import('react');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const USER = { uid: 'u-explore-1' };
const [AI, TAP, UTIL] = SAMPLE_STORIES;
const ROW = 15_000;
let mounted = [];
let sources;
const keep = (m) => { mounted.push(m); return m; };
const card = (id) => $(`[data-explore-card="${id}"]`);
const panel = () => $('[data-explore-panel]');
const primary = () => $('[data-explore-primary]');
const page = (props = {}) => <SearchDiscover user={USER} isMobile isDesktop={false} setScreen={vi.fn()} stocksData={[]} sidebarCollapsed={false} {...props} />;

beforeEach(() => {
  flags.mode = 'on';
  read.mockReset();
  read.mockResolvedValue(answerOf(READS.none));
  sources = fixtureSources();
  body.mounts = [];
  window.scrollTo = vi.fn();
  window.scrollBy = vi.fn();
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; document.body.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert')); });

async function openPage({ answer, src = sources } = {}) {
  if (answer) read.mockResolvedValue(answer);
  const m = keep(mount(page(), { sources: src }));
  await until(() => $('[data-explore-search]'), 'the Explore tab');
  await flush();
  return m;
}
async function openStory(story) {
  click(card(story.id).querySelector('[data-explore-card-read]') ?? card(story.id).querySelector('[data-explore-card-primary]'));
  await until(() => $('[data-explore-screen="story"]'), 'the story');
  await flush();
}

describe('lens A — honesty', () => {
  it.each([['failed', NO_ANSWER], ['gated', GATED]])('A-1: with the read %s, a bookmark never says "not researched"', async (_n, answer) => {
    sources = fixtureSources({ bookmarks: [bookmarkOf(AI)] });
    await openPage({ answer });
    await until(() => $('[data-explore-saved-row="sample-ai-buildout"]'), 'the saved row');
    expect(document.body.textContent).not.toContain(COPY.home.savedState);
    expect(card(AI.id).querySelector('[data-explore-state]')).toBeNull();
  }, ROW);
  it('A-1: while the read runs, the same; once it answers with nothing, "Saved · not researched"', async () => {
    const held = deferred();
    read.mockReturnValue(held.promise);
    sources = fixtureSources({ bookmarks: [bookmarkOf(AI)] });
    await openPage({ answer: null });
    await until(() => $('[data-explore-saved-row="sample-ai-buildout"]'), 'the saved row');
    expect(document.body.textContent).not.toContain(COPY.home.savedState);
    held.resolve(answerOf(READS.none));
    await until(() => document.body.textContent.includes(COPY.home.savedState), 'the line');
  }, ROW);
  it('A-2: a bookmark missing from a read that does not hold every story is not called gone; from a complete one it is', async () => {
    const missing = { storyId: 'older-1', storyVersion: 1, title: 'An older story', savedAt: '2026-11-01T00:00:00.000Z' };
    sources = fixtureSources({ bookmarks: [missing], complete: false });
    const m = await openPage();
    await until(() => $('[data-explore-saved-row="older-1"]'), 'the row');
    expect($('[data-explore-saved-row="older-1"]').textContent).not.toContain(COPY.home.gone);
    expect($('[data-explore-saved-row="older-1"] [data-explore-saved-remove]')).not.toBeNull();
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    sources = fixtureSources({ bookmarks: [missing], complete: true });
    await openPage();
    await until(() => $('[data-explore-saved-row="older-1"]'), 'the row');
    expect($('[data-explore-saved-row="older-1"]').textContent).toContain(COPY.home.gone);
  }, ROW);
  it('A-3: while the stories have not loaded, search never says "No story on this yet."', async () => {
    sources = fixtureSources({ stories: 'fail' });
    await openPage();
    typeInto($('#ftx-search'), 'tap to pay');
    await flush();
    expect($('[data-explore-no-story]')).toBeNull();
  }, ROW);
  it.each([['the byline', '[data-explore-screen="story"] article [data-explore-save]'], ['the panel at the limit', '[data-explore-actions] [data-explore-save]']])('A-4: a failed save from %s says so in the reader, once', async (_n, sel) => {
    sources = fixtureSources({ failWrites: new Set(['save']) });
    await openPage({ answer: answerOf(READS.limit) });
    await openStory(TAP);
    await until(() => $(sel)?.getAttribute('aria-disabled') !== 'true', 'the toggle ready');
    click($(sel));
    await until(() => $$('[data-explore-bookmark-error]').length > 0, 'the line');
    expect($$('[data-explore-bookmark-error]')).toHaveLength(1);
    expect($('[data-explore-bookmark-error]').textContent).toBe(COPY.bookmark.failedSave);
  }, ROW);
  it('A-5 / B-4: Save for later does nothing until the bookmarks are known', async () => {
    let release;
    const holdBookmarks = new Promise((r) => { release = r; });
    sources = fixtureSources({ holdBookmarks });
    await openPage();
    const toggle = card(TAP.id).querySelector('[data-explore-save]');
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    click(toggle);
    await flush();
    expect(sources.calls.filter((c) => c.kind === 'saveBookmark')).toEqual([]);
    release();
    await until(() => card(TAP.id).querySelector('[data-explore-save]').getAttribute('aria-disabled') !== 'true', 'ready');
  }, ROW);
  it('A-6: a sample story is labelled in search rows and in Saved for later', async () => {
    sources = fixtureSources({ bookmarks: [bookmarkOf(TAP)] });
    await openPage();
    await until(() => $('[data-explore-saved-row="sample-tap-to-pay"]'), 'the saved row');
    expect($('[data-explore-saved-row="sample-tap-to-pay"]').textContent).toContain(COPY.card.sample);
    typeInto($('#ftx-search'), 'tap to pay');
    await flush();
    expect($$('[data-explore-result="story"]').every((r) => r.textContent.includes(COPY.card.sample))).toBe(true);
  }, ROW);
  it('A-9: a failed read heads the panel "Investigation", never "Proposed investigation"', async () => {
    await openPage({ answer: NO_ANSWER });
    await openStory(AI);
    expect(panel().querySelector('#ftx-panel-h').textContent).toBe(COPY.panel.investigation);
  }, ROW);
  it('A-8: no screen in any state shows a banned word, in its text or its labels', async () => {
    const BANNED = /supported|source-backed|verified|confirmed|confidence|shadow/i;
    const hits = (text) => [...text.matchAll(new RegExp(`.{0,40}(?:${BANNED.source}).{0,20}`, 'gi'))].map((x) => x[0]);
    for (const [answer, story] of [[READS.none, AI], [READS.progress, AI], [READS.saved, AI], [GATED, TAP], [NO_ANSWER, UTIL], [READS.limit, TAP]]) {
      const m = await openPage({ answer: answer.ok === undefined && !answer.gated && answer.status === undefined ? answerOf(answer) : answer });
      // every text node a player can meet (not the page's own <style> text), and every aria-label
      const words = () => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement.closest('style, script')) out.push(n.nodeValue); return out.join(' '); };
      const seen = () => [words(), ...$$('[aria-label]').map((e) => e.getAttribute('aria-label'))].join(' ');
      expect(hits(seen())).toEqual([]);
      await openStory(story);
      for (const b of $$('[data-explore-connections] button, [data-explore-sources] button')) click(b);
      expect(hits(seen())).toEqual([]);
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  }, 60_000);
});

describe('lens B — separation and wiring', () => {
  it('B-1: Continue from the in-progress row; the read then answers it concluded — focus goes to the screen\'s anchor, not <body>', async () => {
    await openPage({ answer: answerOf(READS.progress) });
    $('[data-explore-progress-continue]').focus();
    click($('[data-explore-progress-continue]'));
    await until(() => body.mounts.length === 1, 'the body');
    read.mockResolvedValue(answerOf(READS.concluded));
    click($('[data-body-close]'));
    await until(() => !$('[data-explore-progress-continue]'), 'the row gone');
    await flush();
    expect(document.activeElement).toBe($('[data-explore-intro]'));
  }, ROW);
  it('B-1: form B, Continue, close, and the re-read fails — focus goes to the story\'s title', async () => {
    await openPage({ answer: answerOf(READS.progress) });
    await openStory(AI);
    click(primary());
    await until(() => body.mounts.length === 1, 'the body');
    read.mockResolvedValue(NO_ANSWER);
    click($('[data-body-close]'));
    await until(() => panel()?.dataset.explorePanel === 'E', 'form E');
    await flush();
    expect(document.activeElement).toBe($('[data-explore-story-title]'));
  }, ROW);
  it('B-2: a scroll made while the read is out is never undone; the opener is kept only against the answer\'s own change', async () => {
    await openPage();
    await openStory(AI);
    const opener = primary();
    let top = 500;
    opener.getBoundingClientRect = () => ({ top, bottom: top + 44, left: 0, right: 100, width: 100, height: 44 });
    click(opener);
    await until(() => body.mounts.length === 1, 'the body');
    const held = deferred();
    read.mockReturnValue(held.promise);
    click($('[data-body-close]'));
    await flush();
    top = 200; // the player scrolls the page while the read is out
    window.dispatchEvent(new Event('scroll'));
    top = 140; // the answer lands: form B is shorter above the button, which rises 60
    held.resolve(answerOf(READS.walkAfterOpen));
    await until(() => panel()?.dataset.explorePanel === 'B', 'form B');
    expect(window.scrollBy).toHaveBeenCalledTimes(1);
    expect(window.scrollBy).toHaveBeenCalledWith(0, -60);
  }, ROW);
  it('B-3: the cap counts saves still in flight: at 49 saved, a second save while one runs is refused', async () => {
    let release;
    const slow = new Promise((r) => { release = r; });
    const stored = Array.from({ length: 49 }, (_, i) => ({ storyId: `old-${i}`, storyVersion: 1, title: `Old ${i}`, savedAt: '2026-11-01T00:00:00.000Z' }));
    sources = fixtureSources({ bookmarks: stored });
    const save = sources.saveBookmark;
    sources.saveBookmark = async (uid, story) => { await slow; return save(uid, story); };
    await openPage();
    await until(() => $$('[data-explore-saved-row]').length === 49, '49 saved');
    click(card(TAP.id).querySelector('[data-explore-save]'));
    await flush();
    click(card(UTIL.id).querySelector('[data-explore-save]'));
    await flush();
    expect(card(UTIL.id).querySelector('[data-explore-bookmark-error]').textContent).toBe(COPY.bookmark.cap(50));
    release();
    await flush();
  }, ROW);
  it('B-5: two failed saves on two stories each keep their own line', async () => {
    sources = fixtureSources({ failWrites: new Set(['save']) });
    await openPage();
    await until(() => card(TAP.id).querySelector('[data-explore-save]').getAttribute('aria-disabled') !== 'true', 'ready');
    click(card(TAP.id).querySelector('[data-explore-save]'));
    click(card(AI.id).querySelector('[data-explore-save]'));
    await until(() => $$('[data-explore-bookmark-error]').length === 2, 'two lines');
    expect(card(TAP.id).querySelector('[data-explore-bookmark-error]')).not.toBeNull();
    expect(card(AI.id).querySelector('[data-explore-bookmark-error]')).not.toBeNull();
  }, ROW);
  it('B-9: a story on two cards says a failed save once, under the card tapped', async () => {
    sources = fixtureSources({ failWrites: new Set(['save']) });
    await openPage();
    const cards = $$(`[data-explore-card="${UTIL.id}"]`);
    expect(cards).toHaveLength(2);
    await until(() => cards[1].querySelector('[data-explore-save]').getAttribute('aria-disabled') !== 'true', 'ready');
    click(cards[1].querySelector('[data-explore-save]'));
    await until(() => $$('[data-explore-bookmark-error]').length > 0, 'the line');
    expect($$('[data-explore-bookmark-error]')).toHaveLength(1);
    expect(cards[1].querySelector('[data-explore-bookmark-error]')).not.toBeNull();
  }, ROW);
  it('B-10: while the read after a close is out, the panel\'s button does nothing (aria-disabled), and keeps focus', async () => {
    await openPage();
    await openStory(AI);
    const opener = primary();
    click(opener);
    await until(() => body.mounts.length === 1, 'the body');
    const held = deferred();
    read.mockReturnValue(held.promise);
    click($('[data-body-close]'));
    await flush();
    expect(document.activeElement).toBe(opener);
    expect(opener.getAttribute('aria-disabled')).toBe('true');
    click(opener);
    await flush();
    expect(body.mounts).toHaveLength(1);
    held.resolve(answerOf(READS.walkAfterOpen));
    await until(() => panel()?.dataset.explorePanel === 'B', 'form B');
    expect(primary().getAttribute('aria-disabled')).toBeNull();
  }, ROW);
  it('B-6: at \'allowlist\', a tap on a card of today\'s page counts: the Explore tab is added but does not open', async () => {
    flags.mode = 'allowlist';
    const held = deferred();
    read.mockReturnValue(held.promise);
    keep(mount(page(), { sources }));
    await until(() => $('[data-stub-card]'), 'the movers');
    $('[data-stub-card]').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    held.resolve(answerOf(READS.none));
    await until(() => $$('button').some((b) => b.textContent.trim() === 'Markets'), 'the tab added');
    await new Promise((r) => { setTimeout(r, 300); });
    await flush();
    expect($('[data-explore-tab]')).toBeNull();
    expect($('[data-stub="markets"]')).not.toBeNull();
  }, ROW);
  it('B-7: at \'allowlist\', a player change while Explore is open never leaves a blank page', async () => {
    flags.mode = 'allowlist';
    const m = keep(mount(page(), { sources }));
    await until(() => $('[data-explore-tab]'), 'Explore');
    read.mockResolvedValue(GATED);
    m.rerender(page({ user: { uid: 'u-explore-2' } }));
    await until(() => $('[data-stub="markets"]'), 'Markets');
    expect($('[data-explore-tab]')).toBeNull();
  }, ROW);
});

describe('lens B and C — the pinned bar', () => {
  let observers;
  beforeEach(() => {
    observers = [];
    globalThis.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; this.targets = []; observers.push(this); }
      observe(t) { this.targets.push(t); }
      disconnect() {}
    };
  });
  afterEach(() => { delete globalThis.IntersectionObserver; document.documentElement.style.scrollPaddingBottom = ''; });
  const fire = (onScreen) => act(() => { const o = observers.at(-1); o.cb([{ isIntersecting: onScreen, intersectionRatio: onScreen ? 1 : 0, target: o.targets[0] }]); });

  it('B-8: a bar that appears while the sheet is open is inert; it is released with the close', async () => {
    await openPage();
    await openStory(AI);
    click(primary());
    await until(() => body.mounts.length === 1, 'the body');
    fire(false);
    expect($('[data-explore-pinned-bar]').hasAttribute('inert')).toBe(true);
    click($('[data-body-close]'));
    await until(() => !$('[data-explore-sheet-overlay]'), 'closed');
    expect($('[data-explore-pinned-bar]').hasAttribute('inert')).toBe(false);
  }, ROW);
  it('C-3: the bar leaves while its button holds focus — focus goes to the panel\'s button, not <body>', async () => {
    await openPage();
    await openStory(AI);
    fire(false);
    const barButton = $('[data-explore-bar-action]');
    barButton.focus();
    expect(document.activeElement).toBe(barButton);
    fire(true);
    expect($('[data-explore-pinned-bar]')).toBeNull();
    expect(document.activeElement).toBe(primary());
  }, ROW);
  it('C-2: while the bar is shown the page reserves its band for focus (scroll-padding-bottom), and gives it back', async () => {
    await openPage();
    await openStory(AI);
    document.documentElement.style.scrollPaddingBottom = '7px';
    fire(false);
    expect(document.documentElement.style.scrollPaddingBottom).toMatch(/^\d+px$/);
    fire(true);
    expect(document.documentElement.style.scrollPaddingBottom).toBe('7px');
  }, ROW);
});

describe('lens C — reading order and contrast', () => {
  it('C-1: the reader\'s DOM is the phone\'s reading order: story, body, what it leaves open, the questions and panel, connections, sources', async () => {
    await openPage();
    await openStory(AI);
    const kids = [...$('[data-ftx-grid="story"]').children].map((el) => (el.tagName === 'ARTICLE' ? 'story' : el.querySelector('[data-explore-body]') ? 'body'
      : el.matches('[data-explore-leaves-open]') ? 'open' : el.matches('[data-ftx-side]') ? 'side' : el.matches('[data-explore-connections]') ? 'connections' : el.matches('[data-explore-sources]') ? 'sources' : '?'));
    expect(kids).toEqual(['story', 'body', 'open', 'side', 'connections', 'sources']);
    expect($('[data-ftx-side]').style.getPropertyValue('--ftx-side-rows')).toBe('5');
    expect(document.querySelector('.ftx-o1, .ftx-o2, .ftx-o3')).toBeNull();
  }, ROW);
  it('C-1: home\'s DOM is the phone\'s reading order: search, Research in progress, the cards — and the side column\'s own copy for wide screens', async () => {
    await openPage({ answer: answerOf(READS.progress) });
    const main = [...$('[data-ftx-col="main"]').children].map((el) => (el.querySelector('[data-explore-search]') ? 'search' : el.matches('[data-explore-progress-placement]') ? `progress:${el.dataset.exploreProgressPlacement}` : el.matches('[data-explore-cards]') ? 'cards' : '?'));
    expect(main).toEqual(['search', 'progress:phone', 'cards']);
    expect($('[data-ftx-col="side"]').firstElementChild.dataset.exploreProgressPlacement).toBe('wide');
    expect($('[data-explore-progress-placement="phone"]').className).toBe('ftx-phone-only');
    expect($('[data-explore-progress-placement="wide"]').className).toBe('ftx-wide-only');
  }, ROW);
  it('C-4: the Product tag\'s words are ink, not purple', async () => {
    await openPage();
    const tag = [...card(TAP.id).querySelectorAll('span')].find((s) => s.textContent === COPY.card.product);
    expect(tag.style.color).toBe('var(--ft-ink)');
  }, ROW);
});
