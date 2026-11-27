// @vitest-environment jsdom
//
// Explore Build 2 — EVERY NEW SCREEN AND STATE, AND THE HIERARCHY'S MOVES (spec
// docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §4, §5, §6, §7, §8; build prompt K-4 to K-18, Tests). The
// real Search page at 'on' (a phone unless a row says otherwise), the research read mocked in the service's own shape
// with answers composed by the server (exploreReads.json, its `agent` included), the kit's stories (the two pilot
// records as published, and the labelled samples), fixture bookmarks, and the sheet's body replaced — through
// Explore's own loader — by a stand-in that records the props of each mount. IntersectionObserver is a recording stub:
// a row fires its entries by hand. No network.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ mode: 'on', compare: false }));
vi.mock('../../config/exploreFlags', () => ({ EXPLORE_MODES: ['off', 'allowlist', 'on'], EXPLORE_MODE: 'off', exploreMode: () => flags.mode, get EXPLORE_COMPARE_ROUTE() { return flags.compare; } }));
const read = vi.hoisted(() => vi.fn());
vi.mock('../../services/sharedResearchService', () => ({ readExploreInvestigations: read }));
vi.mock('../../firebase/config', () => ({ db: {} }));
const body = vi.hoisted(() => ({ mounts: [] }));
vi.mock('./loadSharedResearch', async () => {
  const R = await import('react');
  function BodyStandIn(props) {
    body.latest = props; // the props of the last render (review N-2: an open sheet's props must not change under it)
    R.useEffect(() => { body.mounts.push(props); }, []);
    return R.createElement('div', { 'data-body-stand-in': props.mode }, R.createElement('button', { type: 'button', onClick: props.onClose, 'data-body-close': '' }, 'close'));
  }
  return { loadSharedResearch: () => Promise.resolve({ default: BodyStandIn }) };
});
vi.mock('../Search/ExploreView', () => ({ default: function MarketsStub() { return <div data-stub="markets" />; } }));
vi.mock('../draft/AssetResearchModal', () => ({ default: function AssetStub({ asset }) { return <div data-stub="asset" data-symbol={asset.symbol} data-name={asset.name} />; } }));

const { default: SearchDiscover } = await import('../Search/SearchDiscover');
const kit = await import('./__fixtures__/exploreKit');
const { READS, GATED, NO_ANSWER, KIT_STORIES, SAMPLE_STORIES, answerOf, fixtureSources, bookmarkOf, mount, flush, click, typeInto, $, $$, until, deferred } = kit;
const { PILOT_OVERVIEW, PILOT_DEEP, OLD_SHAPE_STORY } = await import('./__fixtures__/stories');
const { EXPLORE_COPY: COPY } = await import('./exploreCopy');
const { act } = await import('react');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Rows wait on lazy modules and the page's own animations in real time: 15 s each, so a loaded machine cannot time one out.
vi.setConfig({ testTimeout: 15_000 });
const USER = { uid: 'u-explore-1' };
const [S_AI, S_TAP, S_UTIL] = SAMPLE_STORIES;
const OV = PILOT_OVERVIEW.id;
const DEEP = PILOT_DEEP.id;
let mounted = [];
let sources;
let observers;
const keep = (m) => { mounted.push(m); return m; };

beforeEach(() => {
  flags.mode = 'on';
  flags.compare = false;
  read.mockReset();
  read.mockResolvedValue(answerOf(READS.fresh));
  sources = fixtureSources();
  body.mounts = [];
  window.scrollTo = vi.fn();
  window.scrollBy = vi.fn();
  observers = [];
  globalThis.IntersectionObserver = class {
    constructor(cb, options) { this.cb = cb; this.options = options; this.targets = []; observers.push(this); }
    observe(t) { this.targets.push(t); }
    disconnect() { this.disconnected = true; }
  };
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  document.body.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
  document.documentElement.style.scrollPaddingTop = '';
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

const page = (props = {}) => <SearchDiscover user={USER} isMobile isDesktop={false} setScreen={vi.fn()} stocksData={[]} sidebarCollapsed={false} {...props} />;
async function openPage({ answer = answerOf(READS.fresh), src = sources, props = {} } = {}) {
  if (answer) read.mockResolvedValue(answer);
  const m = keep(mount(page(props), { sources: src }));
  await until(() => $('[data-explore-search]'), 'the Explore tab');
  await flush();
  return m;
}
const storyEl = () => $('[data-explore-screen="story"]');
const inStory = (sel) => $$(sel, storyEl());
const hero = () => $('[data-explore-hero]');
const card = (id) => $(`[data-explore-card="${id}"]`);
const tabLabels = () => $$('button').filter((b) => b.style.borderRadius === '24px').map((b) => b.textContent.trim());
async function waitStory(id) {
  await until(() => storyEl() && $('[data-explore-story-title]')?.textContent === [...KIT_STORIES, OLD_SHAPE_STORY].find((s) => s.id === id)?.title, `the story ${id}`);
  await flush();
}
async function openOverview() {
  click(hero().querySelector('[data-explore-hero-read]'));
  await waitStory(OV);
}
const toggle = (ref) => storyEl().querySelector(`[data-explore-branch-toggle="${ref}"]`);
const branch = (ref) => storyEl().querySelector(`[data-explore-branch="${ref}"]`);
async function throughDoor() {
  if (toggle('power').getAttribute('aria-expanded') !== 'true') click(toggle('power'));
  click(storyEl().querySelector(`[data-explore-door="${DEEP}"]`));
  await waitStory(DEEP);
}
/** Every word a player can meet: the text (not the page's own <style>) and every aria-label. */
function seen() {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement.closest('style, script')) out.push(n.nodeValue);
  return [out.join(' '), ...$$('[aria-label], [title], [alt]').flatMap((e) => ['aria-label', 'title', 'alt'].map((a) => e.getAttribute(a)).filter(Boolean))].join(' ');
}
const observerOn = (el) => observers.filter((o) => !o.disconnected && o.targets.includes(el)).at(-1);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── the front page ───────────────────────────────────────────────────────────

describe('the front page (Amendment B §4.1, K-13)', () => {
  it('first visit: the hero is the newest overview — its question, its byline, its group as tickers, the chain with "This question" and a door, the count line, Read and Save, the free line', async () => {
    await openPage();
    const h = hero();
    expect(h.dataset.exploreHero).toBe(OV);
    expect(h.textContent).toContain(COPY.card.fromReporter('Kim'));
    expect(h.querySelector('[data-explore-kind]').textContent).toBe(COPY.home.overview);
    expect(h.querySelector('[data-explore-hero-question]').textContent).toBe(PILOT_OVERVIEW.questions[0].text);
    expect(h.textContent).toContain(PILOT_OVERVIEW.title);
    expect(h.querySelector('[data-explore-group]').textContent).toContain(COPY.panel.group.off.heading(4));
    expect($$('[data-explore-lead]', h).map((b) => b.dataset.exploreLead)).toEqual(['MSFT', 'AMZN', 'ORCL', 'CRWV']);
    expect($$('[data-explore-branch]', h).map((b) => b.dataset.exploreBranch)).toEqual(['chips', 'cloud', 'networking', 'landlords', 'power']);
    expect($$('[data-explore-this-question]', h).map((m) => m.closest('[data-explore-branch]').dataset.exploreBranch)).toEqual(['cloud']);
    const door = h.querySelector(`[data-explore-door="${DEEP}"]`);
    expect(door.closest('[data-explore-branch]').dataset.exploreBranch).toBe('power');
    expect(door.textContent).toBe(`${COPY.chain.deepStory}${PILOT_DEEP.title}`);
    expect(h.querySelector('[data-explore-count]').textContent).toBe('5 connections · 3 sourced · 2 not checked yet');
    expect(h.querySelector('[data-explore-hero-read]').textContent).toBe(COPY.card.read);
    expect(h.querySelector('[data-explore-save]')).not.toBeNull();
    expect(h.textContent).toContain(COPY.home.free);
    expect(h.querySelector('[data-explore-hero-unknown]')).toBeNull();
  });
  it('a specific question on the hero shows its unknown, not a group', async () => {
    sources = fixtureSources({ stories: [S_AI, S_UTIL] });
    await openPage();
    expect(hero().dataset.exploreHero).toBe(S_AI.id);
    expect(hero().querySelector('[data-explore-hero-unknown]').textContent).toBe(`${COPY.home.stillUnknown}${S_AI.questions[0].unknown}`);
    expect(hero().querySelector('[data-explore-group]')).toBeNull();
  });
  it('the tile: a product-led overview, by its product, with its count line — never also a card; the hero never also a card', async () => {
    await openPage();
    const tile = $(`[data-explore-tile="${S_TAP.id}"]`);
    expect(tile.textContent).toContain(S_TAP.productName);
    expect(tile.textContent).toContain('3 connections · 1 sourced · 2 not checked yet');
    expect(card(S_TAP.id)).toBeNull();
    expect(card(OV)).toBeNull();
    expect($$('[data-explore-card]').map((c) => c.dataset.exploreCard)).toEqual([S_AI.id, S_UTIL.id]);
  });
  it('the cards: the key once above them, one card per story with its chain in short; a card with a door says "Deep story ›" beside that branch', async () => {
    sources = fixtureSources({ stories: [PILOT_DEEP, S_UTIL, PILOT_OVERVIEW, S_AI, S_TAP] });
    await openPage();
    expect($$('[data-explore-cards] [data-explore-key]')).toHaveLength(1);
    const c = card(OV);
    expect(c.querySelector('[data-explore-chain]').dataset.exploreChain).toBe('card');
    expect($$('[data-explore-door-mark]', c).map((m) => [m.closest('[data-explore-branch]').dataset.exploreBranch, m.textContent])).toEqual([['power', COPY.chain.cardDoor]]);
    expect(c.querySelector('[data-explore-door]')).toBeNull(); // the card itself opens the overview
    expect(c.querySelector('[data-explore-count]').textContent).toBe('5 connections · 3 sourced · 2 not checked yet');
    expect(c.querySelector('[data-explore-card-question]').textContent).toBe(PILOT_OVERVIEW.questions[0].text);
  });
  it('Latest deep stories: "Deep story", the overview and connection it belongs to, its title, the company it is about', async () => {
    await openPage();
    const row = $(`[data-explore-latest="${DEEP}"]`);
    expect(row.textContent).toContain(COPY.home.deepStory);
    expect(row.querySelector('[data-explore-latest-path]').textContent).toBe('AI buildout › Electric utilities');
    expect(row.textContent).toContain(PILOT_DEEP.title);
    expect(row.querySelector('[data-explore-latest-about]').textContent).toBe('About D · Dominion Energy');
  });
  it('a row with nothing in it is not drawn, heading included: no product-led overview, no deep story', async () => {
    sources = fixtureSources({ stories: [PILOT_OVERVIEW, S_AI, S_UTIL] });
    await openPage();
    expect($('[data-explore-start]')).toBeNull();
    expect($('[data-explore-latest-row]')).toBeNull();
    expect(seen()).not.toContain(COPY.home.startFrom);
    expect(seen()).not.toContain(COPY.home.latest);
  });
});

describe('the shelf (Amendment B §4.2, K-12, B-16)', () => {
  const shelf = () => $('[data-explore-shelf]');
  it('nothing in the read: the blank thesis sentence, the line, the day\'s use — no count, no rail; after the cards on a phone', async () => {
    await openPage();
    const s = shelf();
    expect(s.dataset.exploreShelf).toBe('empty');
    expect(s.dataset.exploreShelfPlacement).toBe('after-cards');
    expect(s.querySelector('[data-explore-shelf-blank]').textContent).toBe(COPY.shelf.blank.map(([, w]) => w).join(''));
    expect(s.querySelector('[data-explore-shelf-empty]').textContent).toBe(COPY.shelf.empty);
    expect(s.querySelector('[data-explore-shelf-used]').textContent).toBe('0 of 3 investigations used today.');
    expect(s.querySelector('[data-explore-rail]')).toBeNull();
    expect(s.querySelector('[data-explore-shelf-counts]')).toBeNull();
    expect(s.textContent).not.toMatch(/of 6/);
    const order = [...$('[data-explore-screen="home"]').children];
    expect(order.indexOf(s)).toBe(order.indexOf($('[data-explore-cards]')) + 1);
  });
  it('a returning player: above the hero; one in progress (its question, the read\'s rail and numbers, its story, Continue) and a thesis saved with its own sentence (View it)', async () => {
    await openPage({ answer: answerOf(READS.returning) });
    const s = shelf();
    expect(s.dataset.exploreShelfPlacement).toBe('top');
    expect(s.nextElementSibling).toBe(hero());
    expect(s.querySelector('[data-explore-shelf-counts]').textContent).toBe(COPY.shelf.counts(1, 1));
    const open = s.querySelector(`[data-explore-progress-row="${S_UTIL.id}"]`);
    const o = READS.returning.items.find((it) => it.open).open;
    expect(open.querySelector('[data-explore-shelf-question]').textContent).toBe(o.question);
    expect(open.querySelector('[data-explore-rail]').dataset.exploreRail).toBe(`${o.filled}/${o.parts}`);
    expect(open.querySelector('[data-explore-state="open"]').textContent).toBe(`In progress · ${o.filled} of ${o.parts}`);
    expect(open.querySelector('[data-explore-steps]').textContent).toBe(COPY.state.stepsLeft(o.stepsLeft));
    expect(open.querySelector('[data-explore-shelf-story]').textContent).toBe(S_UTIL.title);
    const saved = s.querySelector(`[data-explore-thesis-row="${OV}"]`);
    const last = READS.returning.items.find((it) => it.last).last;
    expect(saved.querySelector('[data-explore-state="saved"]').textContent).toBe('Thesis saved · Nov 21, 2026');
    expect(saved.querySelector('[data-explore-thesis-words]').textContent).toBe(last.statement);
    click(saved.querySelector('[data-explore-thesis-view]'));
    await until(() => body.mounts.length === 1, 'the sheet');
    expect(body.mounts[0]).toMatchObject({ mode: 'session', sessionId: last.sessionId });
    expect(body.mounts[0].startNow).toBeUndefined();
    click($('[data-body-close]'));
    await until(() => !$('[data-explore-sheet-overlay]'), 'closed');
    click(open.querySelector('[data-explore-progress-continue]'));
    await until(() => body.mounts.length === 2, 'the sheet again');
    expect(body.mounts[1]).toMatchObject({ mode: 'session', sessionId: o.sessionId });
  });
  it('a saved thesis with no sentence shows its question; one whose record cannot be read shows neither — nothing invented', async () => {
    await openPage({ answer: answerOf(READS.saved) });
    let row = $('[data-explore-thesis-row]');
    expect(row.querySelector('[data-explore-thesis-words]').dataset.exploreThesisWords).toBe('question');
    expect(row.querySelector('[data-explore-thesis-words]').textContent).toBe(READS.saved.items[0].last.question);
    mounted.pop().unmount();
    await openPage({ answer: answerOf(READS.savedBare) });
    row = $('[data-explore-thesis-row]');
    expect(row.querySelector('[data-explore-state="saved"]').textContent).toBe('Thesis saved · Nov 21, 2026');
    expect(row.querySelector('[data-explore-thesis-words]')).toBeNull();
    expect(row.textContent).toBe(`Thesis saved · Nov 21, 2026${COPY.shelf.viewIt}`);
  });
  it('a concluded one: "Concluded · {date}" and its question', async () => {
    await openPage({ answer: answerOf(READS.concluded) });
    const row = $('[data-explore-thesis-row]');
    expect(row.dataset.exploreThesis).toBe('concluded');
    expect(row.querySelector('[data-explore-state="concluded"]').textContent).toBe('Concluded · Nov 21, 2026');
    expect(row.querySelector('[data-explore-thesis-words]').textContent).toBe(READS.concluded.items[0].last.question);
  });
  it('every number is the read\'s own (planted numbers no rule would compute): 4 of 7, 13 steps, 2 of 5 used; a ledger has no rail and no count', async () => {
    const item = READS.progress.items[0];
    await openPage({ answer: answerOf({ ...READS.progress, quota: { ...READS.progress.quota, investigationsToday: 2, perDay: 5 }, items: [{ ...item, open: { ...item.open, filled: 4, parts: 7, stepsLeft: 13 } }] }) });
    expect($('[data-explore-rail]').dataset.exploreRail).toBe('4/7');
    expect($$('[data-explore-rail] span')).toHaveLength(7);
    expect($('[data-explore-shelf] [data-explore-state="open"]').textContent).toBe('In progress · 4 of 7');
    expect($('[data-explore-shelf] [data-explore-steps]').textContent).toBe('13 steps left');
    expect($('[data-explore-shelf-used]').textContent).toBe('2 of 5 investigations used today.');
    mounted.pop().unmount();
    await openPage({ answer: answerOf(READS.ledger) });
    expect($('[data-explore-shelf] [data-explore-state="open"]').textContent).toBe(COPY.state.inProgress);
    expect($('[data-explore-rail]')).toBeNull();
  });
  it('no access: one line, no blank sentence; the read failed: the line and Try again — one more read', async () => {
    await openPage({ answer: GATED });
    expect($('[data-explore-shelf-gated]').textContent).toBe(COPY.shelf.gated);
    expect($('[data-explore-shelf-blank]')).toBeNull();
    mounted.pop().unmount();
    read.mockReset();
    await openPage({ answer: NO_ANSWER });
    expect($('[data-explore-shelf] [role="alert"]').textContent).toBe(COPY.shelf.failed);
    expect(read).toHaveBeenCalledTimes(1);
    read.mockResolvedValue(answerOf(READS.fresh));
    click($('[data-explore-shelf-retry]'));
    await until(() => $('[data-explore-shelf="empty"]'), 'the shelf');
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('from 1000 px the shelf and Saved for later sit beside the hero, each drawn once', async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = (q) => ({ matches: q === '(min-width: 1000px)', addEventListener() {}, removeEventListener() {} });
    try {
      sources = fixtureSources({ bookmarks: [bookmarkOf(S_AI)] });
      await openPage({ props: { isMobile: false, isDesktop: true } });
      const side = $('[data-ftx-col="side"]');
      expect([...side.children].map((el) => (el.matches('[data-explore-shelf]') ? 'shelf' : el.matches('[data-explore-saved]') ? 'saved' : '?'))).toEqual(['shelf', 'saved']);
      expect($$('[data-explore-shelf]')).toHaveLength(1);
      expect($$('[data-explore-saved]')).toHaveLength(1);
      expect($('[data-explore-shelf]').dataset.exploreShelfPlacement).toBe('side');
    } finally { window.matchMedia = matchMedia; }
  });
});

// ── the story pages ──────────────────────────────────────────────────────────

describe('inside a story (B-12, K-9): no page heading and no tab row, both kinds, phone and desktop', () => {
  it.each([[true], [false]])('isMobile %s', async (isMobile) => {
    await openPage({ props: { isMobile, isDesktop: !isMobile } });
    expect($('h1')?.textContent).toBe('Explore');
    await openOverview();
    expect($('h1')).toBeNull();
    expect(tabLabels()).toEqual([]);
    await throughDoor();
    expect($('h1')).toBeNull();
    expect(tabLabels()).toEqual([]);
    click(storyEl().querySelector('[data-explore-back]'));
    await waitStory(OV);
    click(storyEl().querySelector('[data-explore-back]'));
    await until(() => !storyEl(), 'the front page');
    expect($('h1').textContent).toBe('Explore');
    expect(tabLabels().length).toBeGreaterThan(0);
  });
});

describe('the connections (B-6, B-7, §4.3, K-7, K-11)', () => {
  it('one list, the chain itself: the count line, the key, the subject, five branches, all closed', async () => {
    await openPage();
    await openOverview();
    expect(inStory('[data-explore-chain]').map((c) => c.dataset.exploreChain)).toEqual(['story']);
    const conn = storyEl().querySelector('[data-explore-connections]');
    expect(conn.querySelector('[data-explore-count]').textContent).toBe('5 connections · 3 sourced · 2 not checked yet');
    expect(conn.querySelector('[data-explore-key]')).not.toBeNull();
    expect(conn.querySelector('[data-explore-chain-subject]').textContent).toBe('AI buildout');
    expect(inStory('[data-explore-branch-toggle]').map((b) => [b.dataset.exploreBranchToggle, b.getAttribute('aria-expanded')])).toEqual([
      ['chips', 'false'], ['cloud', 'false'], ['networking', 'false'], ['landlords', 'false'], ['power', 'false'],
    ]);
    expect(inStory('[data-explore-branch-detail]')).toEqual([]);
    expect(inStory('[data-explore-this-question]').map((m) => m.closest('[data-explore-branch]').dataset.exploreBranch)).toEqual(['cloud']);
    expect(conn.textContent).toContain(COPY.story.leadsNote);
    expect(conn.textContent).toContain(COPY.story.connectionsClose);
    expect($$('[data-explore-disclosure], [data-explore-connections] [aria-controls]')).toEqual([]);
  });
  it.each(PILOT_OVERVIEW.connections.map((c) => [c.ref, c]))('%s opened in place: its label, what it does, its basis line, the gap, its leads (and its door)', async (ref, c) => {
    await openPage();
    await openOverview();
    click(toggle(ref));
    expect(toggle(ref).getAttribute('aria-expanded')).toBe('true');
    const d = storyEl().querySelector(`[data-explore-branch-detail="${ref}"]`);
    expect(toggle(ref).getAttribute('aria-controls')).toBe(d.id);
    expect(branch(ref).querySelector('[data-explore-basis]').textContent).toBe(COPY.story.basis[c.basis]);
    expect(d.textContent).toContain(c.what);
    expect(d.textContent).toContain(c.basisLine);
    expect(d.querySelector('[data-explore-gap="known"]').textContent).toBe(`${COPY.story.known}${c.known ?? COPY.story.knownBlank}`);
    expect(d.querySelector('[data-explore-gap="unknown"]').textContent).toBe(`${COPY.story.unknown}${c.unknown}`);
    expect(d.querySelector('[data-explore-gap="where"]').textContent).toBe(`${COPY.story.whereToLook}${c.whereToLook}`);
    expect($$('[data-explore-lead]', d).map((b) => b.dataset.exploreLead)).toEqual(c.leads.map((l) => l.symbol));
    expect(d.querySelector('[data-explore-door]') !== null).toBe(ref === 'power');
    click(toggle(ref));
    expect(storyEl().querySelector(`[data-explore-branch-detail="${ref}"]`)).toBeNull();
  });
  it('a blank Known reads "Nothing sourced yet."', async () => {
    await openPage();
    await openOverview();
    click(toggle('landlords'));
    expect(storyEl().querySelector('[data-explore-branch-detail="landlords"] [data-explore-gap="known"]').textContent).toBe(`${COPY.story.known}${COPY.story.knownBlank}`);
  });
  it('a lead with a symbol opens that stock\'s research page (CRWV: in the 228, not in the 54); a lead without one is not a button', async () => {
    await openPage();
    await openOverview();
    click(toggle('cloud'));
    const crwv = storyEl().querySelector('[data-explore-branch-detail="cloud"] [data-explore-lead="CRWV"]');
    expect(crwv.tagName).toBe('BUTTON');
    expect(crwv.textContent).toBe('CRWVCoreWeave');
    click(crwv);
    await until(() => $('[data-stub="asset"]'), 'the research page');
    expect($('[data-stub="asset"]').dataset).toMatchObject({ symbol: 'CRWV', name: 'CoreWeave' });
  });
  it('plain-text leads (a sample company, the old shape) are text, never buttons', async () => {
    await openPage();
    click(card(S_AI.id).querySelector('[data-explore-card-primary]'));
    await waitStory(S_AI.id);
    click(toggle('chips'));
    const leads = $$('[data-explore-branch-detail="chips"] [data-explore-lead]');
    expect(leads.map((l) => [l.tagName, l.textContent])).toEqual([['SPAN', 'KSTL (sample company)'], ['SPAN', 'HLDN (sample company)']]);
  });
  it('a connection without a deep story says nothing about one', async () => {
    await openPage();
    await openOverview();
    for (const c of PILOT_OVERVIEW.connections) click(toggle(c.ref));
    expect(inStory('[data-explore-door]').map((d) => d.closest('[data-explore-branch]').dataset.exploreBranch)).toEqual(['power']);
    expect(inStory('[data-explore-door-mark]').map((d) => d.closest('[data-explore-branch]').dataset.exploreBranch)).toEqual(['power']);
    expect(seen()).not.toMatch(/not written yet/i);
  });
  it('the old shape still reads: plain leads, no gap, no door, no "This question"', async () => {
    sources = fixtureSources({ stories: [PILOT_OVERVIEW, OLD_SHAPE_STORY, S_UTIL] });
    await openPage();
    click(card(OLD_SHAPE_STORY.id).querySelector('[data-explore-card-primary]'));
    await waitStory(OLD_SHAPE_STORY.id);
    click(toggle('c0'));
    const d = storyEl().querySelector('[data-explore-branch-detail="c0"]');
    expect(d.querySelector('[data-explore-gap-block]')).toBeNull();
    expect(d.textContent).not.toContain(COPY.story.knownBlank);
    expect($$('[data-explore-lead]', d).every((l) => l.tagName === 'SPAN')).toBe(true);
    expect(inStory('[data-explore-this-question]')).toEqual([]);
  });
});

describe('doors and what a story page reads by id (K-4, K-7, §4.5, §5.1)', () => {
  it('a door whose target is not published (the read complete) is not drawn, on the hero, the card or the story', async () => {
    sources = fixtureSources({ stories: [PILOT_OVERVIEW, S_AI, S_UTIL] });
    await openPage();
    expect($$('[data-explore-door], [data-explore-door-mark]')).toEqual([]);
    await openOverview();
    click(toggle('power'));
    expect(inStory('[data-explore-door], [data-explore-door-mark]')).toEqual([]);
    expect(sources.calls.filter((c) => c.kind === 'readStory')).toEqual([]);
  });
  it.each([['missing', null], ['refused', 'fail'], ['not a deep story', { ...S_AI, id: DEEP }]])('the read not complete, the target %s: read by id once when the story opens, and no door', async (_n, answer) => {
    sources = fixtureSources({ stories: [PILOT_OVERVIEW, S_AI, S_UTIL], complete: false, byId: { [DEEP]: answer } });
    await openPage();
    expect(sources.calls.filter((c) => c.kind === 'readStory')).toEqual([]); // the front page never reads by id
    await openOverview();
    await flush();
    expect(sources.calls.filter((c) => c.kind === 'readStory')).toEqual([{ kind: 'readStory', id: DEEP }]);
    click(toggle('power'));
    expect(inStory('[data-explore-door]')).toEqual([]);
  });
  it('the read not complete, the target readable: read by id, and the door appears; opening the deep story reads nothing more', async () => {
    sources = fixtureSources({ stories: [PILOT_OVERVIEW, S_AI, S_UTIL], complete: false, byId: { [DEEP]: PILOT_DEEP } });
    await openPage();
    await openOverview();
    click(toggle('power'));
    await until(() => storyEl().querySelector(`[data-explore-door="${DEEP}"]`), 'the door');
    await throughDoor();
    expect(storyEl().querySelector('[data-explore-way-up]')).not.toBeNull();
    expect(sources.calls.filter((c) => c.kind === 'readStory').map((c) => c.id)).toEqual([DEEP]);
  });
  it('at most six by-id reads for one story page, each id once for the tab\'s life', async () => {
    const wide = { ...PILOT_OVERVIEW, id: 'wide-overview', connections: Array.from({ length: 8 }, (_, i) => ({ ...PILOT_OVERVIEW.connections[0], id: `k${i}`, ref: `k${i}`, who: `Link ${i}`, leadsToStory: `deep-${i}` })) };
    sources = fixtureSources({ stories: [wide, S_AI, S_UTIL], complete: false });
    await openPage();
    click(hero().querySelector('[data-explore-hero-read]'));
    await until(() => storyEl(), 'the story');
    await flush();
    expect(sources.calls.filter((c) => c.kind === 'readStory').map((c) => c.id)).toEqual(['deep-0', 'deep-1', 'deep-2', 'deep-3', 'deep-4', 'deep-5']);
    click(storyEl().querySelector('[data-explore-back]'));
    await until(() => !storyEl(), 'the front page');
    click(hero().querySelector('[data-explore-hero-read]'));
    await until(() => storyEl(), 'the story again');
    await flush();
    expect(sources.calls.filter((c) => c.kind === 'readStory')).toHaveLength(6);
  });
  it('a deep story whose parent is not loaded reads it by id (the parent first), and shows the way up once it arrives', async () => {
    sources = fixtureSources({ stories: [PILOT_DEEP, S_AI, S_UTIL], complete: false, byId: { [OV]: PILOT_OVERVIEW } });
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    await until(() => storyEl().querySelector('[data-explore-way-up]'), 'the way up');
    expect(sources.calls.filter((c) => c.kind === 'readStory').map((c) => c.id)).toEqual([OV]);
  });
});

describe('a deep story (Amendment B §4.4)', () => {
  it('above its title the way up ("AI buildout › Electric utilities") and its company; after its sources, Where next', async () => {
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    const article = storyEl().querySelector('article');
    const up = article.querySelector('[data-explore-way-up]');
    expect(up.textContent).toBe('AI buildout › Electric utilities');
    expect(up.getAttribute('aria-label')).toBe(COPY.story.wayUp('AI buildout', 'Electric utilities'));
    expect(article.querySelector('[data-explore-about] [data-explore-lead="D"]').textContent).toBe('DDominion Energy');
    expect(article.querySelector('[data-explore-kind]').textContent).toBe(COPY.home.deepStory);
    const next = storyEl().querySelector('[data-explore-where-next]');
    expect(next.previousElementSibling.matches('[data-explore-sources]')).toBe(true);
    expect(next.querySelector('[data-explore-where-up]').textContent).toContain(PILOT_OVERVIEW.title);
    expect(next.querySelector('[data-explore-you-are-here]').textContent).toContain(PILOT_DEEP.subject);
    expect($$('[data-explore-where-step]', next).map((b) => b.dataset.exploreWhereStep)).toEqual(['chips', 'cloud', 'networking', 'landlords']);
    expect(next.textContent).not.toMatch(/not written yet/i);
  });
  it('its parent unreadable: no way up and no Where next; the story still reads', async () => {
    sources = fixtureSources({ stories: [PILOT_DEEP, S_AI, S_UTIL] });
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    expect(storyEl().querySelector('[data-explore-way-up]')).toBeNull();
    expect(storyEl().querySelector('[data-explore-where-next]')).toBeNull();
    expect(storyEl().querySelector('[data-explore-body]').textContent).toContain(PILOT_DEEP.body[0]);
    expect($(`[data-explore-latest="${DEEP}"] [data-explore-latest-path]`)).toBeNull();
  });
  it('B-10: the sources list only what a connection cites — three of the overview\'s seven, none with a growth figure', async () => {
    await openPage();
    await openOverview();
    const src = storyEl().querySelector('[data-explore-sources]');
    expect(src.querySelector('button').textContent).toContain('3');
    click(src.querySelector('button'));
    expect($$('[data-explore-source]', src).map((s) => s.dataset.exploreSource)).toEqual(['s1', 's2', 's3']);
    for (const words of ['Azure', 'AWS segment', 'Cloud Infra', '3,661', 'Microsoft news release', 'CoreWeave news release']) expect(seen()).not.toContain(words);
  });
});

describe('moving between stories (B-11, K-8, §4.5)', () => {
  it('a door, then back: the overview at the scroll left, the branch still open, focus on the door', async () => {
    await openPage();
    await openOverview();
    click(toggle('power'));
    Object.defineProperty(window, 'scrollY', { value: 1234, configurable: true });
    click(storyEl().querySelector(`[data-explore-door="${DEEP}"]`));
    await waitStory(DEEP);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
    expect(document.activeElement).toBe($('[data-explore-story-title]'));
    expect(storyEl().querySelector('[data-explore-back]').textContent).toBe(COPY.story.backTo('AI buildout'));
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
    click(storyEl().querySelector('[data-explore-back]'));
    await waitStory(OV);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 1234);
    expect(toggle('power').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(storyEl().querySelector(`[data-explore-door="${DEEP}"]`));
  });
  it('the way up opens the overview at that connection, open, scrolled to it, focus on its branch; back returns to the deep story', async () => {
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    Object.defineProperty(window, 'scrollY', { value: 80, configurable: true });
    click(storyEl().querySelector('[data-explore-way-up]'));
    await waitStory(OV);
    expect(toggle('power').getAttribute('aria-expanded')).toBe('true');
    expect(inStory('[data-explore-branch-toggle][aria-expanded="true"]')).toHaveLength(1);
    expect(document.activeElement).toBe(toggle('power'));
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 80 - 8); // the branch's own top (jsdom: 0) less the clear band
    expect(storyEl().querySelector('[data-explore-back]').textContent).toBe(COPY.story.backTo(PILOT_DEEP.subject));
    click(storyEl().querySelector('[data-explore-back]'));
    await waitStory(DEEP);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 80);
    expect(document.activeElement).toBe(storyEl().querySelector('[data-explore-way-up]'));
  });
  it('Where next opens the overview at the chosen connection, open', async () => {
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    click(storyEl().querySelector('[data-explore-where-step="cloud"]'));
    await waitStory(OV);
    expect(inStory('[data-explore-branch-toggle][aria-expanded="true"]').map((b) => b.dataset.exploreBranchToggle)).toEqual(['cloud']);
    click(storyEl().querySelector('[data-explore-back]'));
    await waitStory(DEEP);
    expect(document.activeElement).toBe(storyEl().querySelector('[data-explore-where-step="cloud"]'));
  });
  it.each([
    ['the Latest row', () => $(`[data-explore-latest="${DEEP}"]`)],
    ['a search row', async () => { typeInto($('#ftx-search'), 'Dominion'); await flush(); return $('[data-explore-result="story"]'); }],
  ])('from %s: back returns to the front page at the scroll left, focus on that row', async (_n, opener) => {
    await openPage();
    const el = await opener();
    Object.defineProperty(window, 'scrollY', { value: 777, configurable: true });
    click(el);
    await waitStory(DEEP);
    expect(storyEl().querySelector('[data-explore-back]').textContent).toBe(COPY.story.back);
    click(storyEl().querySelector('[data-explore-back]'));
    await until(() => !storyEl(), 'the front page');
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 777);
    expect(document.activeElement).toBe(el);
  });
  it('two levels down and back up: the front page, the overview, the deep story — then the overview, then the front page with focus on the hero\'s Read', async () => {
    await openPage();
    const read1 = hero().querySelector('[data-explore-hero-read]');
    click(read1);
    await waitStory(OV);
    await throughDoor();
    click(storyEl().querySelector('[data-explore-back]'));
    await waitStory(OV);
    click(storyEl().querySelector('[data-explore-back]'));
    await until(() => !storyEl(), 'the front page');
    expect(document.activeElement).toBe(read1);
  });
  it('search: a deep story\'s row is tagged "Deep story" with its overview and connection; an overview\'s row "Overview"', async () => {
    await openPage();
    typeInto($('#ftx-search'), 'Dominion');
    await flush();
    expect($$('[data-explore-result="story"] [data-explore-result-kind]').map((k) => k.textContent)).toEqual(Array(3).fill(COPY.search.deepIn('AI buildout', 'Electric utilities')));
    typeInto($('#ftx-search'), 'AI buildout');
    await flush();
    expect($('[data-explore-result="story"] [data-explore-result-kind="overview"]').textContent).toBe(COPY.search.overview);
  });
});

describe('the phone\'s jump row and bar (B-13, B-14, K-10)', () => {
  const labels = (scope) => $$('[data-explore-jump-to]', scope).map((b) => b.textContent);
  it('an overview: Story · Connections · Questions · Sources, with counts; a deep story: Story · Questions · Connections · Sources', async () => {
    await openPage();
    await openOverview();
    const flow = () => storyEl().querySelector('[data-explore-jump="flow"]');
    expect(labels(flow())).toEqual(['Story', 'Connections5', 'Questions1', 'Sources3']);
    expect(flow().querySelector('[data-explore-jump-back]').getAttribute('aria-label')).toBe(COPY.story.backLabel('Explore'));
    expect(flow().parentElement.previousElementSibling.tagName).toBe('ARTICLE'); // under the byline
    await throughDoor();
    expect(labels(flow())).toEqual(['Story', 'Questions3', 'Connections5', 'Sources5']);
    expect(flow().querySelector('[data-explore-jump-back]').getAttribute('aria-label')).toBe(COPY.story.backLabel('AI buildout'));
  });
  it('one observer marks the section in view; a tap scrolls to the section and puts focus on its heading', async () => {
    await openPage();
    await openOverview();
    const blocks = inStory('[data-explore-section]');
    const o = observerOn(blocks[0]);
    expect(o.targets).toEqual([...blocks, storyEl().querySelector('[data-explore-story-end]')]);
    act(() => o.cb(blocks.map((t) => ({ target: t, isIntersecting: t.dataset.exploreSection === 'connections' || t.dataset.exploreSection === 'questions' }))));
    expect(storyEl().querySelector('[data-explore-jump="flow"] [aria-current="location"]').dataset.exploreJumpTo).toBe('connections');
    click(storyEl().querySelector('[data-explore-jump="flow"] [data-explore-jump-to="questions"]'));
    expect(document.activeElement).toBe(storyEl().querySelector('[data-explore-questions] h3'));
    expect(storyEl().querySelector('[data-explore-jump="flow"] [aria-current="location"]').dataset.exploreJumpTo).toBe('questions');
    click(storyEl().querySelector('[data-explore-jump="flow"] [data-explore-jump-to="story"]'));
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
    expect(document.activeElement).toBe($('[data-explore-story-title]'));
  });
  it('pinned once scrolled past: a fixed copy whose buttons take no Tab stop; the top band kept clear; its back arrow works', async () => {
    await openPage();
    await openOverview();
    const flow = storyEl().querySelector('[data-explore-jump="flow"]');
    const o = observerOn(flow);
    act(() => o.cb([{ target: flow, isIntersecting: false, intersectionRatio: 0, boundingClientRect: { top: -60, height: 46 } }]));
    const pinned = $('[data-explore-jump="pinned"]');
    expect(pinned.parentElement).toBe(document.body);
    expect(pinned.style.position).toBe('fixed');
    expect($$('button', pinned).every((b) => b.tabIndex === -1)).toBe(true);
    expect(document.documentElement.style.scrollPaddingTop).toBe('53px');
    act(() => o.cb([{ target: flow, isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: 12, height: 46 } }]));
    expect($('[data-explore-jump="pinned"]')).toBeNull();
    expect(document.documentElement.style.scrollPaddingTop).toBe('');
    act(() => o.cb([{ target: flow, isIntersecting: false, intersectionRatio: 0, boundingClientRect: { top: -900, height: 46 } }]));
    click($('[data-explore-jump="pinned"] [data-explore-jump-back]'));
    await until(() => !storyEl(), 'the front page');
  });
  it('the bar carries the chosen question on one line beside the action; tapping it jumps to the chooser', async () => {
    await openPage();
    await openOverview();
    const primary = storyEl().querySelector('[data-explore-primary]');
    act(() => observerOn(primary).cb([{ target: primary, isIntersecting: false, intersectionRatio: 0 }]));
    const q = $('[data-explore-bar-question]');
    expect(q.textContent).toBe(PILOT_OVERVIEW.questions[0].text);
    expect(q.tabIndex).toBe(-1);
    expect(q.className).toContain('ftx-phone-only');
    expect($('[data-explore-bar-line]').textContent).toBe(COPY.panel.cost(3, 0));
    click(q);
    expect(document.activeElement).toBe(storyEl().querySelector('[data-explore-questions] h3'));
  });
  it('with an investigation open the bar reads the read\'s "In progress · {filled} of {parts}" and carries its question', async () => {
    await openPage({ answer: answerOf(READS.walkDeepAfterPart) });
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    const primary = storyEl().querySelector('[data-explore-primary]');
    act(() => observerOn(primary).cb([{ target: primary, isIntersecting: false, intersectionRatio: 0 }]));
    const open = READS.walkDeepAfterPart.items[0].open;
    expect($('[data-explore-bar-line]').textContent).toBe(`In progress · ${open.filled} of ${open.parts}`);
    expect($('[data-explore-bar-question]').textContent).toBe(open.question);
  });
});

describe('the panel and the compare switch (B-9, §6, K-14)', () => {
  it('switch off: "Companies this question names", the built first step, no "Compares on", no Then — and no screen says "compare"', async () => {
    await openPage();
    expect(seen()).not.toMatch(/compar/i);
    await openOverview();
    const panel = storyEl().querySelector('[data-explore-panel]');
    expect(panel.querySelector('[data-explore-group]').textContent).toContain(COPY.panel.group.off.heading());
    expect(panel.querySelector('[data-explore-group-note]').textContent).toBe(COPY.panel.group.off.note);
    expect($$('[data-explore-lead]', panel).map((b) => b.dataset.exploreLead)).toEqual(['MSFT', 'AMZN', 'ORCL', 'CRWV']);
    expect(panel.querySelector('[data-explore-measures]')).toBeNull();
    expect($$('[data-explore-starts-row]', panel).map((r) => r.dataset.exploreStartsRow)).toEqual(['story', 'question', 'angle', 'firstStep', 'companies', 'open']);
    expect(panel.querySelector('[data-explore-starts-row="firstStep"]').textContent).toContain(COPY.panel.startsFirstStep);
    for (const c of PILOT_OVERVIEW.connections) click(toggle(c.ref));
    click(storyEl().querySelector('[data-explore-sources] button'));
    expect(seen()).not.toMatch(/compar/i);
    await throughDoor();
    expect(seen()).not.toMatch(/compar/i);
  });
  it.each([['progress', READS.progress], ['saved', READS.saved], ['gated', GATED], ['failed', NO_ANSWER], ['limit', READS.limit]])('switch off, %s: no "compare" on the front page or either story', async (_n, answer) => {
    await openPage({ answer: answer.gated !== undefined || answer.status !== undefined ? answer : answerOf(answer) });
    await openOverview();
    await throughDoor();
    expect(seen()).not.toMatch(/compar/i);
  });
  it('switch on (set in the row, never in the file): "Compares 4 companies", the story\'s own measure name, the compare first step and Then — still no figure, still the story\'s order', async () => {
    flags.compare = true;
    await openPage();
    expect(hero().querySelector('[data-explore-group]').textContent).toContain(COPY.panel.group.on.heading(4));
    await openOverview();
    const panel = storyEl().querySelector('[data-explore-panel]');
    expect(panel.querySelector('[data-explore-group]').textContent).toContain('Compares 4 companies');
    expect(panel.querySelector('[data-explore-group-note]').textContent).toBe(COPY.panel.group.on.note);
    expect(panel.querySelector('[data-explore-measures]').textContent).toBe(`${COPY.panel.group.on.measures}Cloud growth`);
    expect($$('[data-explore-starts-row]', panel).map((r) => r.dataset.exploreStartsRow)).toEqual(['story', 'question', 'angle', 'firstStep', 'then', 'companies', 'open']);
    expect(panel.querySelector('[data-explore-starts-row="firstStep"]').textContent).toContain(COPY.panel.group.on.firstStep);
    expect($$('[data-explore-lead]', panel).map((b) => b.dataset.exploreLead)).toEqual(['MSFT', 'AMZN', 'ORCL', 'CRWV']);
    expect(panel.textContent).not.toMatch(/48%|39%|121%|3,661|XLK/);
    await throughDoor();
    // a specific question: the built words at either value
    expect(storyEl().querySelector('[data-explore-starts-row="firstStep"]').textContent).toContain(COPY.panel.startsFirstStep);
    expect(storyEl().querySelector('[data-explore-starts-row="then"]')).toBeNull();
  });
  it('the finished form shows the read\'s question', async () => {
    await openPage({ answer: answerOf(READS.saved) });
    click(card(S_AI.id).querySelector('[data-explore-card-primary]'));
    await waitStory(S_AI.id);
    expect(storyEl().querySelector('[data-explore-ended-question]').textContent).toBe(READS.saved.items[0].last.question);
  });
});

describe('the review\'s fixes (lens b: N-1, N-2, N-3)', () => {
  it('N-1: back to a deep story keeps its Sources open, so Where next is where the player left it (scroll and focus)', async () => {
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    click(storyEl().querySelector('[data-explore-sources] button'));
    expect(storyEl().querySelector('[data-explore-sources] button').getAttribute('aria-expanded')).toBe('true');
    Object.defineProperty(window, 'scrollY', { value: 2400, configurable: true });
    click(storyEl().querySelector('[data-explore-where-step="cloud"]'));
    await waitStory(OV);
    click(storyEl().querySelector('[data-explore-back]'));
    await waitStory(DEEP);
    expect(storyEl().querySelector('[data-explore-sources] button').getAttribute('aria-expanded')).toBe('true');
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 2400);
    expect(document.activeElement).toBe(storyEl().querySelector('[data-explore-where-step="cloud"]'));
  });
  it('N-2: an open sheet keeps the agent it opened with when a later re-read fails', async () => {
    await openPage({ answer: answerOf(READS.returning) });
    click($('[data-explore-progress-continue]'));
    await until(() => body.mounts.length === 1, 'the sheet');
    const held = deferred();
    read.mockReturnValueOnce(held.promise);
    click($('[data-body-close]'));
    await until(() => !$('[data-explore-sheet-overlay]'), 'closed');
    click($('[data-explore-progress-continue]')); // while the re-read is still out
    await until(() => body.mounts.length === 2, 'the sheet again');
    expect(body.latest).toMatchObject({ agentId: 'agent-1', agentName: 'Atlas', equippedListLabel: 'Grid builders' });
    await act(async () => { held.resolve(NO_ANSWER); await Promise.resolve(); });
    await flush();
    expect(body.latest).toMatchObject({ agentId: 'agent-1', agentName: 'Atlas', equippedListLabel: 'Grid builders' });
  });
  it('N-3: Where next belongs to the row\'s last section — with no listed source, Connections is marked while it is in view', async () => {
    sources = fixtureSources({ stories: [{ ...PILOT_DEEP, sources: [] }, PILOT_OVERVIEW, S_AI, S_UTIL] });
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    expect($$('[data-explore-jump-to]', storyEl()).map((b) => b.dataset.exploreJumpTo)).toEqual(['story', 'questions', 'connections']);
    const next = storyEl().querySelector('[data-explore-where-next]');
    expect(next.dataset.exploreSection).toBe('connections');
    const o = observerOn(next);
    act(() => o.cb(o.targets.map((t) => ({ target: t, isIntersecting: t === next }))));
    expect(storyEl().querySelector('[data-explore-jump="flow"] [aria-current="location"]').dataset.exploreJumpTo).toBe('connections');
  });
  it('the section observer takes in Where next when the parent arrives by id', async () => {
    sources = fixtureSources({ stories: [PILOT_DEEP, S_AI, S_UTIL], complete: false, byId: { [OV]: PILOT_OVERVIEW } });
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    const next = await until(() => storyEl().querySelector('[data-explore-where-next]'), 'Where next');
    await flush();
    expect(observerOn(next)?.targets).toContain(next);
  });
});

describe('the review\'s fixes (lens c: P-2, P-3, P-5, P-6)', () => {
  it('P-5: once the story\'s end is in view the row marks the last section that shows (Sources), not the first', async () => {
    await openPage();
    await openOverview();
    const blocks = inStory('[data-explore-section]');
    const end = storyEl().querySelector('[data-explore-story-end]');
    const o = observerOn(end);
    const showing = (t) => t.dataset.exploreSection === 'questions' || t.dataset.exploreSection === 'sources';
    act(() => o.cb(blocks.map((t) => ({ target: t, isIntersecting: showing(t) }))));
    expect(storyEl().querySelector('[data-explore-jump="flow"] [aria-current="location"]').dataset.exploreJumpTo).toBe('questions');
    act(() => o.cb([{ target: end, isIntersecting: true }]));
    expect(storyEl().querySelector('[data-explore-jump="flow"] [aria-current="location"]').dataset.exploreJumpTo).toBe('sources');
    act(() => o.cb([{ target: end, isIntersecting: false }]));
    expect(storyEl().querySelector('[data-explore-jump="flow"] [aria-current="location"]').dataset.exploreJumpTo).toBe('questions');
  });
  it('P-6: from 1000 px an overview\'s questions and panel come before its connections in the DOM (Tab reaches the action first); below, after', async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = (q) => ({ matches: q === '(min-width: 1000px)', addEventListener() {}, removeEventListener() {} });
    try {
      await openPage({ props: { isMobile: false, isDesktop: true } });
      await openOverview();
      const kids = [...$('[data-ftx-grid="story"]').children].map((el) => (el.matches('[data-ftx-side]') ? 'side' : el.matches('[data-explore-connections]') ? 'connections' : null)).filter(Boolean);
      expect(kids).toEqual(['side', 'connections']);
    } finally { window.matchMedia = matchMedia; }
  });
  it('P-4: each label draws its own line, also at card size — solid, fine 3 px dashes, broken (two pieces and a gap)', async () => {
    await openPage();
    const lineOf = (basis) => card(S_AI.id).querySelector(`[data-explore-line="${basis}"]`);
    expect([...lineOf('source_cited').children].map((s) => s.style.borderTop)).toEqual([expect.stringMatching(/^2px solid/)]);
    expect(lineOf('reporters_reading').children).toHaveLength(1);
    expect(lineOf('reporters_reading').children[0].style.background).toMatch(/repeating-linear-gradient\(90deg, .* 0(px)? 3px, transparent 3px 6px\)/);
    expect([...lineOf('no_source_yet').children].map((s) => s.style.borderTop || 'gap')).toEqual([expect.stringMatching(/^2px solid/), 'gap', expect.stringMatching(/^2px solid/)]);
  });
  it('P-3: the shelf\'s Try again hands focus to the shelf\'s heading, never to <body>', async () => {
    await openPage({ answer: NO_ANSWER });
    const retry = $('[data-explore-shelf-retry]');
    retry.focus();
    read.mockResolvedValue(answerOf(READS.fresh));
    click(retry);
    await until(() => $('[data-explore-shelf="empty"]'), 'the shelf');
    expect(document.activeElement).toBe($('[data-explore-shelf] h2'));
  });
  it('P-2: on a phone the bottom nav\'s band is kept clear for focus while Explore shows, and given back when it goes', async () => {
    document.documentElement.style.scrollPaddingBottom = '';
    const m = await openPage();
    expect(document.documentElement.style.scrollPaddingBottom).toBe('73px');
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    expect(document.documentElement.style.scrollPaddingBottom).toBe('');
    await openPage({ props: { isMobile: false, isDesktop: true } });
    expect(document.documentElement.style.scrollPaddingBottom).toBe('');
  });
});

describe('the review\'s fixes and gaps (lens a: H-1 to H-7)', () => {
  const openNoQuestion = () => { const r = clone(READS.walkDeepAfterPart); r.items[0].open.question = null; return answerOf(r); };
  it('H-1: with the read\'s open.question null, the bar beside Continue research carries no question (never the chooser\'s), the panel none, the shelf none', async () => {
    await openPage({ answer: openNoQuestion() });
    expect($(`[data-explore-progress-row="${DEEP}"] [data-explore-shelf-question]`)).toBeNull();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    click(storyEl().querySelector('[data-explore-question="minimums"]'));
    const primary = storyEl().querySelector('[data-explore-primary]');
    act(() => observerOn(primary).cb([{ target: primary, isIntersecting: false, intersectionRatio: 0 }]));
    expect($('[data-explore-bar-action]').textContent).toBe(COPY.panel.continue);
    expect($('[data-explore-bar-question]')).toBeNull();
    expect(storyEl().querySelector('[data-explore-open-question]')).toBeNull();
  });
  it('H-2: the count line is the connections\' basis — the deep story lists five sources and counts three sourced', async () => {
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    expect(storyEl().querySelector('[data-explore-sources] button').textContent).toContain('5');
    expect(storyEl().querySelector('[data-explore-connections] [data-explore-count]').textContent).toBe('5 connections · 3 sourced · 2 not checked yet');
  });
  it.each([['complete', true], ['not complete, absent by id', false]])('H-3: an overview on a CARD whose deep story is unreadable (%s) carries no "Deep story ›"', async (_n, complete) => {
    sources = fixtureSources({ stories: [S_UTIL, PILOT_OVERVIEW, S_AI], complete });
    await openPage();
    expect(hero().dataset.exploreHero).toBe(S_UTIL.id);
    expect(card(OV).querySelector('[data-explore-door-mark]')).toBeNull();
    expect(sources.calls.filter((c) => c.kind === 'readStory')).toEqual([]);
  });
  it('H-4: Where next shows another connection\'s door only for a readable deep story (the one door rule)', async () => {
    const cloudDeep = { ...PILOT_DEEP, id: 'deep-cloud', title: 'The cloud companies, in depth', parent: { storyId: OV, connectionId: 'cloud' } };
    const withDoor = (to) => ({ ...PILOT_OVERVIEW, connections: PILOT_OVERVIEW.connections.map((c) => (c.id === 'cloud' ? { ...c, leadsToStory: to } : c)) });
    sources = fixtureSources({ stories: [PILOT_DEEP, cloudDeep, withDoor('deep-cloud'), S_AI, S_UTIL] });
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    expect(storyEl().querySelector('[data-explore-where-step="cloud"] [data-explore-where-door]').textContent).toContain(cloudDeep.title);
    expect(storyEl().querySelectorAll('[data-explore-where-door]')).toHaveLength(1);
    mounted.pop().unmount();
    sources = fixtureSources({ stories: [PILOT_DEEP, withDoor(S_AI.id), S_AI, S_UTIL] });
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    expect(storyEl().querySelectorAll('[data-explore-where-door]')).toHaveLength(0);
  });
  it('H-5: nothing is ordered by a value — the cards, the tiles and Latest keep the read\'s own order', async () => {
    const tap2 = { ...S_TAP, id: 'sample-tap-2', productName: 'Contactless', connections: S_TAP.connections.map((c) => ({ ...c, basis: 'no_source_yet' })) };
    const deep = (id) => ({ ...PILOT_DEEP, id, title: `Deep ${id}` });
    sources = fixtureSources({ stories: [deep('deep-c'), PILOT_OVERVIEW, deep('deep-a'), S_UTIL, tap2, S_AI, S_TAP, deep('deep-b')] });
    await openPage();
    expect($$('[data-explore-card]').map((c) => c.dataset.exploreCard)).toEqual([S_UTIL.id, S_AI.id]);
    expect($$('[data-explore-tile]').map((t) => t.dataset.exploreTile)).toEqual(['sample-tap-2', S_TAP.id]);
    expect($$('[data-explore-latest]').map((r) => r.dataset.exploreLatest)).toEqual(['deep-c', 'deep-a', 'deep-b']);
  });
  it.each([
    ['no name, no list', { id: 'agent-9', name: null, equippedList: null }, { agentId: 'agent-9', agentName: null, equippedListLabel: null }],
    ['a name, a list without a name', { id: 'agent-9', name: 'Nova', equippedList: { id: 'wl-1', name: null } }, { agentId: 'agent-9', agentName: 'Nova', equippedListLabel: null }],
  ])('H-6: an agent with %s: the sheet gets exactly what the read names, nothing in its place', async (_n, agent, props) => {
    await openPage({ answer: answerOf({ ...READS.fresh, agent }) });
    await openOverview();
    click(storyEl().querySelector('[data-explore-primary]'));
    await until(() => body.mounts.length === 1, 'the body');
    expect(body.mounts[0]).toMatchObject(props);
  });
  it('H-7: the shelf\'s heading counts the read\'s lists, not the rows drawn: five finished, three shown', async () => {
    const last = (n) => ({ itemRef: { recordKind: 'exploreStories', recordId: `gone-${n}` }, itemVersion: 1, open: null, last: { sessionId: `s-${n}`, ended: 'concluded', at: `2026-11-2${n}T10:00:00.000Z`, question: `Q${n}`, statement: null } });
    await openPage({ answer: answerOf({ ...READS.fresh, items: [1, 2, 3, 4, 5].map(last) }) });
    expect($('[data-explore-shelf-counts]').textContent).toBe(COPY.shelf.counts(0, 5));
    expect($$('[data-explore-thesis-row]')).toHaveLength(3);
  });
});

describe('the sheet (Amendment B §7, K-16)', () => {
  it('Work this idea: the read\'s agent (id, name, equipped list) and the chosen question\'s id', async () => {
    await openPage();
    click($(`[data-explore-latest="${DEEP}"]`));
    await waitStory(DEEP);
    click(storyEl().querySelector('[data-explore-question="minimums"]'));
    click(storyEl().querySelector('[data-explore-primary]'));
    await until(() => body.mounts.length === 1, 'the body');
    expect(body.mounts[0]).toMatchObject({
      mode: 'item', startNow: true, agentId: 'agent-1', agentName: 'Atlas', equippedListLabel: 'Grid builders',
      item: { itemRef: { recordKind: 'exploreStories', recordId: DEEP }, questionId: 'minimums', question: PILOT_DEEP.questions[1].text },
    });
  });
  it('without an agent in the read: null for the id, the name and the list; Continue and View it carry the agent too', async () => {
    await openPage({ answer: answerOf(READS.none) });
    await openOverview();
    click(storyEl().querySelector('[data-explore-primary]'));
    await until(() => body.mounts.length === 1, 'the body');
    expect(body.mounts[0]).toMatchObject({ agentId: null, agentName: null, equippedListLabel: null, item: { questionId: 'cloud-leaders' } });
    mounted.pop().unmount();
    body.mounts = [];
    await openPage({ answer: answerOf(READS.returning) });
    click($('[data-explore-progress-continue]'));
    await until(() => body.mounts.length === 1, 'the body');
    expect(body.mounts[0]).toMatchObject({ mode: 'session', agentId: 'agent-1', agentName: 'Atlas' });
  });
  it('one research read for a whole walk of Build 2\'s controls, and none of the service\'s other calls; no story written', async () => {
    await openPage();
    click($(`[data-explore-tile="${S_TAP.id}"]`));
    await waitStory(S_TAP.id);
    click(storyEl().querySelector('[data-explore-back]'));
    await until(() => !storyEl(), 'home');
    await openOverview();
    for (const c of PILOT_OVERVIEW.connections) click(toggle(c.ref));
    click(storyEl().querySelector('[data-explore-jump="flow"] [data-explore-jump-to="sources"]'));
    click(storyEl().querySelector(`[data-explore-door="${DEEP}"]`));
    await waitStory(DEEP);
    click(storyEl().querySelector('[data-explore-where-step="chips"]'));
    await waitStory(OV);
    click(storyEl().querySelector('[data-explore-back]'));
    await waitStory(DEEP);
    click(storyEl().querySelector('[data-explore-way-up]'));
    await waitStory(OV);
    expect(read).toHaveBeenCalledTimes(1);
    expect(body.mounts).toEqual([]);
    expect(sources.calls.map((c) => c.kind)).toEqual(['readStories', 'readBookmarks']);
  });
});

describe('the words (K-18, B-7)', () => {
  it.each([['fresh', READS.fresh], ['returning', READS.returning], ['saved', READS.saved], ['concluded', READS.concluded], ['limit', READS.limit], ['ledger', READS.ledger], ['gated', GATED], ['failed', NO_ANSWER]])('%s: no screen says "not written yet", "Supported", "Source-backed" or "Shadow" (every branch and the sources open)', async (_n, answer) => {
    await openPage({ answer: answer.gated !== undefined || answer.status !== undefined ? answer : answerOf(answer) });
    const banned = /not written yet|supported|source-backed|shadow|confidence/i;
    expect(seen()).not.toMatch(banned);
    await openOverview();
    for (const c of PILOT_OVERVIEW.connections) click(toggle(c.ref));
    click(storyEl().querySelector('[data-explore-sources] button'));
    expect(seen()).not.toMatch(banned);
    await throughDoor();
    for (const c of PILOT_DEEP.connections) click(toggle(c.ref));
    click(storyEl().querySelector('[data-explore-sources] button'));
    expect(seen()).not.toMatch(banned);
  });
});
