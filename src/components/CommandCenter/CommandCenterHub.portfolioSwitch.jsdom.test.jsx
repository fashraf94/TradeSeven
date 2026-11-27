// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHub.portfolioSwitch.jsdom.test.jsx
//
// The portfolio hub's slice 1 — THE SWITCH AND THE ONE READ (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md
// §3, §4 slice 1), in the connected hub at both sites:
//   - switch off (the shipped value): no decision is made and none is drawn; the entry card reads the book for itself, as on
//     main (and again each time it remounts);
//   - switch on: the connected shell reads the book ONCE, decides the layout from that read and hands the same read to the
//     card, which makes no read of its own. Slice 1 draws nothing new: for every case of §3 (not admitted, no book, a failed
//     read, idle, loading, the screen's switch off) AND for a book owner, everything the hub draws is what it draws with the
//     switch off; the decision is exposed only on the scope's inert wrapper (`data-hub-layout`, `display: contents`).
// Both switches are read through getters, so one file holds both states. The book's route is the one stand-in for the
// network (fetchWithAuth, as the card's own suite stands it in); every other request answers 404.

import React, { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ portfolio: false, screen: true }));
vi.mock('../../config/commandCenterPortfolioFlags', () => ({ get COMMAND_CENTER_PORTFOLIO_HUB_ENABLED() { return f.portfolio; } }));
vi.mock('../../config/practiceFieldScreenFlags', () => ({ get PRACTICE_FIELD_SCREEN_ENABLED() { return f.screen; } }));
vi.mock('../../config/sharedResearchFlags', () => ({ SHARED_RESEARCH_MODE: 'off', SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
// Reduced motion, so every fade is instant and two renders draw the same frame (a fade mid-flight is a clock, not the hub).
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => true }));
const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: { getIdToken: async () => 'token' } }) }));
const r = vi.hoisted(() => ({ identity: null, agent: null, window: null, market: null }));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => r.identity }));
vi.mock('../../hooks/useAgent', () => ({ default: () => r.agent }));
vi.mock('./hub/useHubCompletedBattles', () => ({ default: () => r.window }));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => r.market }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));
vi.mock('../../services/leagueLockService', () => ({ subscribeLeagueLock: (uid, onLock) => { onLock({ locked: false, groupId: null, status: null, endsAtMs: null }); return () => {}; } }));
vi.mock('../../services/hypothesisVersionService', () => ({ listHypothesisVersions: vi.fn(async () => ({ watchlistId: 'wl-1', currentVersion: 0, versions: [], research: [] })) }));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({ default: function useDailyRegimeBrief() { return { dailyBrief: null, keyEvents: [], themes: [], forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} }; } }));
const net = vi.hoisted(() => ({ calls: [], answer: null }));
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: async (url, opts) => {
    net.calls.push({ url: String(url), method: opts?.method ?? 'GET' });
    if (String(url) !== '/api/practice-field/book') return { ok: false, status: 404, json: async () => ({ error: 'not_found' }) };
    const a = typeof net.answer === 'function' ? await net.answer() : net.answer;
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
  },
}));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import useIdeaBook, { IDEA_BOOK_PATH, REFOCUS_QUIET_MS } from '../PracticeField/useIdeaBook';
import { entryHeadlineOf } from '../PracticeField/ideaBookCopy';
import { buildBookView } from '../../../api/_utils/practiceField/bookView.js';
import { sceneInput } from '../../../api/_utils/practiceField/__testsupport__/bookViewScenes.js';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav, press } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 10, 27, 15, 0);
const UID = 'uid-A';
const BOOK = JSON.parse(JSON.stringify(buildBookView(sceneInput('sample'))));
const agentReady = () => ({ status: 'ready', agent: { id: 'agent-a', ownerId: UID, name: 'Atlas', archetype: 'degen', stats: { gamesPlayed: 3 } }, ownerUid: UID, ownerEpoch: 2, readError: null, retry: vi.fn() });
const windowOf = () => ({ battles: [], status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1, reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, carried: false, refresh: vi.fn() });
const pollMeta = () => ({ epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false });
const hubOf = () => ({ activeBattles: [], activePoll: pollMeta(), refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn(), onOpenForge: vi.fn(), setScreen: vi.fn() });

let layout;
let removeTokens;
let removeNav;
let mounted = [];
let fetchSpy;
let errorSpy;
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });

/**
 * useIdeaBook keeps the last good answer per owner and epoch in its module (a card that remounts draws at once), and a read
 * that fails keeps it. So each row starts from an empty store, the way the hook itself empties it: an answer of 404.
 */
function ClearLastGood() { useIdeaBook({ enabled: true }); return null; }
async function clearLastGood() {
  net.answer = { status: 404, body: { error: 'not_found' } };
  const x = mount(<ClearLastGood />);
  await flush();
  x.unmount();
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  sessionStorage.clear();
  f.portfolio = false;
  f.screen = true;
  r.identity = { resolved: true, uid: UID, authEpoch: 2 };
  r.agent = agentReady();
  r.window = windowOf();
  r.market = { state: 'OPEN', isOpen: true };
  await clearLastGood();
  net.calls = [];
  net.answer = { status: 200, body: { book: BOOK } };
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({ ok: false, status: 404, json: async () => ({}) }));
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const x of mounted) x.unmount();
  mounted = [];
  sessionStorage.clear();
  removeNav();
  layout.restore();
  fetchSpy.mockRestore();
  errorSpy.mockRestore();
  vi.useRealTimers();
});

const flush = () => act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });
async function render(site, hub = hubOf()) {
  layout.state.hubWidth = site === 'mobile' ? 390 : 1216;
  const x = mount(<CommandCenterHub site={site} hub={hub} />);
  mounted.push(x);
  await flush();
  return x;
}
function unmountAll() {
  for (const x of mounted) x.unmount();
  mounted = [];
}
const bookReads = () => net.calls.filter((c) => c.url === IDEA_BOOK_PATH).length;
const markers = () => [...document.querySelectorAll('[data-hub-layout]')];
const card = () => document.querySelector('[data-ib="entry-card"]');

/** React's useId tokens renumbered by first appearance (the counter is global across roots): the HTML a player is drawn. */
function normalized(html) {
  const ids = new Map();
  return html.replace(/_r_[0-9a-z]+_/g, (id) => {
    if (!ids.has(id)) ids.set(id, `_id${ids.size}_`);
    return ids.get(id);
  });
}
/** Where two drawings first part, with a little of each around it (the assertion's message: the whole hub is long). */
function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i === a.length && i === b.length ? 'identical' : `first difference at ${i}: on «${a.slice(Math.max(0, i - 120), i + 160)}» off «${b.slice(Math.max(0, i - 120), i + 160)}»`;
}
/** Everything the hub draws into its host: with the switch on, inside the scope's wrapper; with it off, the host itself. */
function drawn(x) {
  const wrapper = x.host.querySelector(':scope > [data-hub-layout]');
  return normalized((wrapper ?? x.host).innerHTML);
}
/** Everything else on the page — <body> outside the host, where a portal would land (review P1T-3). */
const outside = (x) => normalized([...document.body.children].filter((el) => el !== x.host).map((el) => el.outerHTML).join('\n'));

// Every case of spec §3, and the book owner. `requests` is the book reads on mount, the same with the switch off and on.
const CASES = Object.freeze({
  'not admitted (the route answers 404)': { setup: () => { net.answer = { status: 404, body: { error: 'not_found' } }; }, layout: 'today', requests: 1, card: false },
  'no book (the route answers { book: null })': { setup: () => { net.answer = { status: 200, body: { book: null } }; }, layout: 'today', requests: 1, card: false },
  'a failed read (the route answers 500)': { setup: () => { net.answer = { status: 500, body: { error: 'read_failed' } }; }, layout: 'today', requests: 1, card: false },
  'loading (the read never answers)': { setup: () => { net.answer = () => new Promise(() => {}); }, layout: 'today', requests: 1, card: false },
  'idle (the identity is unresolved)': { setup: () => { r.identity = { resolved: false, uid: null, authEpoch: 0 }; }, layout: 'today', requests: 0, card: false },
  'idle (the idea book screen\'s switch is off)': { setup: () => { f.screen = false; }, layout: 'today', requests: 0, card: false },
  'a book owner': { setup: () => {}, layout: 'book', requests: 1, card: true },
});

describe('switch off (the shipped value): today\'s hub, the card reading for itself', () => {
  it.each(['mobile', 'desktop'])('%s: no decision drawn; the card is drawn from its own one read', async (site) => {
    await render(site);
    expect(markers()).toEqual([]);
    expect(bookReads()).toBe(1);
    expect(card()).not.toBeNull();
    expect(card().textContent).toContain(entryHeadlineOf(BOOK.line));
  });

  it('mobile: the card reads again each time the Overview comes back (today\'s behaviour, unchanged)', async () => {
    await render('mobile');
    expect(bookReads()).toBe(1);
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    await flush();
    expect(card()).toBeNull();
    click(byRole(document, 'tab', COPY.phoneTabs.overview)[0]);
    await flush();
    expect(card()).not.toBeNull();
    expect(bookReads()).toBe(2);
  });
});

describe('switch on: slice 1 draws nothing new — for every case of §3, and for a book owner, the hub is what it is with the switch off', () => {
  for (const site of ['mobile', 'desktop']) {
    it.each(Object.keys(CASES))(`${site}, %s`, async (name) => {
      const c = CASES[name];
      c.setup();
      const off = await render(site);
      const offHtml = drawn(off);
      const offOutside = outside(off);
      const offReads = bookReads();
      expect(markers()).toEqual([]);
      unmountAll();

      net.calls = [];
      f.portfolio = true;
      const on = await render(site);
      // The decision, in its one inert place: the scope's wrapper, the host's only child, drawing no box.
      expect(markers()).toHaveLength(1);
      const wrapper = markers()[0];
      expect(wrapper.parentElement).toBe(on.host);
      expect(on.host.children).toHaveLength(1);
      expect(wrapper.getAttribute('data-hub-layout')).toBe(c.layout);
      expect(wrapper.getAttribute('style')).toBe('display: contents;');
      expect(wrapper.getAttributeNames().sort()).toEqual(['data-hub-layout', 'style']);
      // Everything the hub draws inside it is exactly what it draws with the switch off.
      const onHtml = drawn(on);
      expect(onHtml, firstDiff(onHtml, offHtml)).toBe(offHtml);
      // ...and nothing lands outside it either (a portal into <body>, review P1T-3).
      const onOutside = outside(on);
      expect(onOutside, firstDiff(onOutside, offOutside)).toBe(offOutside);
      // The compared drawing is the whole hub, down to its activity section (and the card, for a book owner): review P1T-4.
      expect(offHtml).toContain('data-hub="shell"');
      expect(offHtml).toContain('data-hub-section="activity"');
      expect(offHtml.includes('data-ib="entry-card"')).toBe(c.card);
      // The same number of book reads: one (or none while idle) — the shell's, never the card's as well.
      expect(offReads).toBe(c.requests);
      expect(bookReads()).toBe(c.requests);
      expect(Boolean(card())).toBe(c.card);
    });
  }
});

describe('switch on, a book owner: one read at the shell, and the card draws from it', () => {
  beforeEach(() => { f.portfolio = true; });

  it.each(['mobile', 'desktop'])('%s: one read on mount; the decision is book; the card is drawn from that read', async (site) => {
    await render(site);
    expect(bookReads()).toBe(1);
    expect(markers().map((m) => m.getAttribute('data-hub-layout'))).toEqual(['book']);
    expect(card()).not.toBeNull();
    expect(card().textContent).toContain(entryHeadlineOf(BOOK.line));
  });

  it('opening the card reads once more (the shell\'s read, refreshed); Escape closes the page and focus returns to the card', async () => {
    await render('desktop');
    const opener = card();
    act(() => { opener.focus(); });
    click(opener);
    await flush();
    expect(bookReads()).toBe(2);
    const layer = document.querySelector('[data-ib="layer"]');
    expect(layer).not.toBeNull();
    press(layer, 'Escape');
    await flush();
    expect(document.querySelector('[data-ib="layer"]')).toBeNull();
    expect(document.activeElement).toBe(card());
    expect(bookReads()).toBe(2);
  });

  it('the window regaining focus reads once — a focus and a visibility change together are one read, never two readers', async () => {
    await render('mobile');
    expect(bookReads()).toBe(1);
    vi.setSystemTime(NOW + REFOCUS_QUIET_MS + 1);
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await flush();
    expect(bookReads()).toBe(2);
  });

  it('mobile: the Overview coming back draws the card at once from the shell\'s read, and reads nothing', async () => {
    await render('mobile');
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    await flush();
    expect(card()).toBeNull();
    click(byRole(document, 'tab', COPY.phoneTabs.overview)[0]);
    await flush();
    expect(card()).not.toBeNull();
    expect(bookReads()).toBe(1);
  });

  it('the card and the decision never disagree: a read that comes back with no book takes both away in the same render', async () => {
    await render('desktop');
    expect(markers()[0].getAttribute('data-hub-layout')).toBe('book');
    expect(card()).not.toBeNull();
    net.answer = { status: 200, body: { book: null } };
    vi.setSystemTime(NOW + REFOCUS_QUIET_MS + 1);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(bookReads()).toBe(2);
    expect(markers()[0].getAttribute('data-hub-layout')).toBe('today');
    expect(card()).toBeNull();
  });

  it('a refresh that fails after a good read keeps the book: the card stays, and so does the decision', async () => {
    await render('desktop');
    net.answer = { status: 500, body: { error: 'read_failed' } };
    vi.setSystemTime(NOW + REFOCUS_QUIET_MS + 1);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(bookReads()).toBe(2);
    expect(markers()[0].getAttribute('data-hub-layout')).toBe('book');
    expect(card()).not.toBeNull();
  });

  // Review P1W-2, a stated change (report §3): with the switch on the read belongs to the shell, so on the phone it no longer follows
  // the card. The window's focus reads while the card is off screen, and the Overview coming back does not read again.
  it.each([
    [false, [1, 1, 1, 2]],
    [true, [1, 1, 2, 2]],
  ])('mobile, the read\'s triggers (switch on: %s) — reads after mount, the Research tab, a window focus, the Overview again: %j', async (on, expected) => {
    f.portfolio = on;
    await render('mobile');
    const seen = [bookReads()];
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    await flush();
    seen.push(bookReads());
    vi.setSystemTime(NOW + REFOCUS_QUIET_MS + 1);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    seen.push(bookReads());
    click(byRole(document, 'tab', COPY.phoneTabs.overview)[0]);
    await flush();
    seen.push(bookReads());
    expect(seen).toEqual(expected);
  });

  it.each([false, true])('a site change starts the shell afresh, scope and all (ruling R-S1-5): one more read, as today — switch on: %s', async (on) => {
    f.portfolio = on;
    const hub = hubOf();
    const x = await render('mobile', hub);
    expect(bookReads()).toBe(1);
    layout.state.hubWidth = 1216;
    x.rerender(<CommandCenterHub site="desktop" hub={hub} />);
    await flush();
    expect(document.querySelector('[data-hub="shell"]').getAttribute('data-hub-site')).toBe('desktop');
    expect(bookReads()).toBe(2);
    expect(markers().map((m) => m.getAttribute('data-hub-layout'))).toEqual(on ? ['book'] : []);
    expect(card()).not.toBeNull();
  });

  it('a hub handed no App object (the S1 frames) has no connected shell: no decision, and the card reads for itself, as today', async () => {
    layout.state.hubWidth = 1216;
    const x = mount(<CommandCenterHub site="desktop" />);
    mounted.push(x);
    await flush();
    expect(markers()).toEqual([]);
    expect(bookReads()).toBe(1);
    expect(card()).not.toBeNull();
  });
});
