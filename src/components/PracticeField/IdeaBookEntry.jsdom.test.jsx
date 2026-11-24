// @vitest-environment jsdom
//
// Practice Field build B3 — THE ENTRY CARD AND ITS READ (B3 §4; ruling B3-7). The switch is read through a getter so one
// file can hold both states: OFF (the shipped value) — no request, no card, and the hub's one render site
// (sections/ActivitySection.jsx) draws exactly what it drew before; ON — the card only with a book, the page as a layer
// over the app (the app inert behind it, Escape closes it, focus returns), one read shared by the card and the page,
// refreshed on open and on the window regaining focus, keyed by the owner and their auth epoch.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ on: false, identity: { resolved: true, uid: 'owner-1', authEpoch: 1 }, calls: [], answer: null }));
vi.mock('../../config/practiceFieldScreenFlags', () => ({ get PRACTICE_FIELD_SCREEN_ENABLED() { return state.on; } }));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => state.identity }));
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: async (url, opts) => {
    state.calls.push({ url, opts, uid: state.identity.uid });
    const a = typeof state.answer === 'function' ? await state.answer() : state.answer;
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
  },
}));

import IdeaBookEntry, { IDEA_BOOK_SCREEN_ON } from './IdeaBookEntry';
import { entryTodayOf } from './ideaBookCopy';
import ActivitySection from '../CommandCenter/sections/ActivitySection';
import useIdeaBook, { REFOCUS_QUIET_MS } from './useIdeaBook';
import { buildBookView } from '../../../api/_utils/practiceField/bookView.js';
import { sceneInput } from '../../../api/_utils/practiceField/__testsupport__/bookViewScenes.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const viewOf = (scene) => JSON.parse(JSON.stringify(buildBookView(sceneInput(scene))));
let mounted = [];
let appRoot;
beforeEach(() => {
  state.on = false;
  state.identity = { resolved: true, uid: 'owner-1', authEpoch: 1 };
  state.calls = [];
  state.answer = { status: 200, body: { book: viewOf('sample') } };
  appRoot = document.createElement('div');
  appRoot.id = 'root';
  document.body.appendChild(appRoot);
});
afterEach(() => {
  for (const m of mounted) act(() => m.root.unmount());
  mounted = [];
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
const flush = async () => { await act(async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); }); };
async function mount(el) {
  const root = createRoot(appRoot);
  act(() => root.render(el));
  const m = { root, host: appRoot, render: (next) => act(() => root.render(next)) };
  mounted.push(m);
  await flush();
  return m;
}
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const ACTIVITY = { status: 'ready', items: [], rows: [] };

describe('the switch off (the shipped value): no request, no card, the hub\'s site as it was', () => {
  // (The shipped literal itself is pinned by practiceFieldScreenFlags.test.js; this file reads the switch through a getter.)
  it('the hub reads the switch through the card module re-export', () => {
    expect(IDEA_BOOK_SCREEN_ON).toBe(state.on);
  });
  it('the card renders nothing and asks nothing', async () => {
    const m = await mount(<IdeaBookEntry />);
    expect(m.host.innerHTML).toBe('');
    expect(state.calls).toEqual([]);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(state.calls).toEqual([]);
  });
  it('the hub\'s one render site draws the activity section exactly as without the card', async () => {
    const m = await mount(<ActivitySection activity={ACTIVITY} limit={3} />);
    expect(m.host.querySelector('[data-ib]')).toBeNull();
    expect(m.host.firstElementChild.getAttribute('data-hub-section')).toBe('activity');
    expect(state.calls).toEqual([]);
  });
});

describe('the switch on: the card, its read and the page', () => {
  beforeEach(() => { state.on = true; });

  it('one read on mount, of the one endpoint; the card shows the value and today\'s change', async () => {
    const v = viewOf('sample');
    const m = await mount(<IdeaBookEntry />);
    expect(state.calls.map((c) => [c.url, c.opts.method])).toEqual([['/api/practice-field/book', 'GET']]);
    const card = m.host.querySelector('[data-ib="entry-card"]');
    expect(card.textContent).toContain(v.line.value);
    expect(card.textContent).toContain(`${v.line.today.text} (${v.line.today.pct}) today`);
    expect(card.getAttribute('aria-label')).toBe(`Idea book, ${v.line.value}, ${v.line.today.text} (${v.line.today.pct}) today. Open`);
  });

  it('no card without a book: { book: null }, a 404, a failed read', async () => {
    for (const answer of [{ status: 200, body: { book: null } }, { status: 404, body: { error: 'disabled' } }, { status: 500, body: { error: 'internal_error' } }]) {
      state.answer = answer;
      const m = await mount(<IdeaBookEntry />);
      expect(m.host.querySelector('[data-ib="entry-card"]'), JSON.stringify(answer)).toBeNull();
      act(() => m.root.unmount());
      mounted = [];
    }
  });

  it('the card\'s second line: paused, a new book\'s opening day', () => {
    expect(entryTodayOf(viewOf('paused').line)).toEqual({ text: 'Paused', dir: 0 });
    expect(entryTodayOf(viewOf('newBook').line)).toEqual({ text: 'Opens 23 Nov', dir: 0 });
  });

  it('a tap opens the page as a layer over the app: read again, the app inert, Escape closes, focus returns', async () => {
    const m = await mount(<IdeaBookEntry />);
    const card = m.host.querySelector('[data-ib="entry-card"]');
    card.focus();
    click(card);
    await flush();
    expect(state.calls).toHaveLength(2); // the page's open reads again
    const layer = document.querySelector('[data-ib="layer"]');
    expect(layer).not.toBeNull();
    expect(layer.parentElement).toBe(document.body);
    expect(layer.getAttribute('role')).toBe('dialog');
    expect(appRoot.hasAttribute('inert')).toBe(true);
    expect(layer.textContent).toContain('Positions');
    act(() => { layer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(document.querySelector('[data-ib="layer"]')).toBeNull();
    expect(appRoot.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(m.host.querySelector('[data-ib="entry-card"]'));
  });

  it('reads again when the window regains focus — once, however many signals arrive together — and never on a timer', async () => {
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    await mount(<IdeaBookEntry />);
    expect(state.calls).toHaveLength(1);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(state.calls).toHaveLength(1); // inside the quiet window after the mount's read
    now += REFOCUS_QUIET_MS;
    act(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    await flush();
    expect(state.calls).toHaveLength(2);
  });

  it('keyed by the owner and their epoch: a new identity drops the old view and reads for itself', async () => {
    const m = await mount(<IdeaBookEntry />);
    expect(m.host.querySelector('[data-ib="entry-card"]')).not.toBeNull();
    state.identity = { resolved: true, uid: 'owner-2', authEpoch: 2 };
    state.answer = () => ({ status: 200, body: { book: null } });
    m.render(<IdeaBookEntry key="same" />);
    await flush();
    expect(state.calls.map((c) => c.uid)).toEqual(['owner-1', 'owner-2']);
    expect(m.host.querySelector('[data-ib="entry-card"]')).toBeNull();
  });

  it('an identity changed IN PLACE never shows the earlier owner\x27s book — not at once, not when its answer lands last (review C10)', async () => {
    // owner-1 has a book on screen; the identity becomes owner-2 without a remount: the card goes at that very render.
    const m = await mount(<IdeaBookEntry />);
    expect(m.host.querySelector('[data-ib="entry-card"]')).not.toBeNull();
    let releaseTwo;
    state.answer = () => new Promise((r) => { releaseTwo = () => r({ status: 200, body: { book: null } }); });
    state.identity = { resolved: true, uid: 'owner-2', authEpoch: 2 };
    m.render(<IdeaBookEntry />);
    expect(m.host.querySelector('[data-ib="entry-card"]')).toBeNull();
    releaseTwo();
    await flush();
    // owner-3 asks while owner-2's slow read is still out; owner-2's answer (a book) lands last and is never shown.
    let releaseLate;
    state.answer = () => new Promise((r) => { releaseLate = () => r({ status: 200, body: { book: viewOf('full') } }); });
    state.identity = { resolved: true, uid: 'owner-2', authEpoch: 3 };
    m.render(<IdeaBookEntry />);
    await flush();
    const lateForEpoch3 = releaseLate;
    state.answer = () => ({ status: 200, body: { book: null } });
    state.identity = { resolved: true, uid: 'owner-3', authEpoch: 4 };
    m.render(<IdeaBookEntry />);
    await flush();
    lateForEpoch3();
    await flush();
    expect(state.calls.map((c) => c.uid)).toEqual(['owner-1', 'owner-2', 'owner-2', 'owner-3']);
    expect(m.host.querySelector('[data-ib="entry-card"]')).toBeNull();
  });

  it('the read is keyed: no render ever hands one owner the other\x27s answer (the hook\x27s return filter)', async () => {
    const seen = [];
    function Probe() { const { read } = useIdeaBook({ enabled: true }); seen.push({ uid: state.identity.uid, key: read.key, book: read.book !== null }); return null; }
    const root = createRoot(appRoot);
    act(() => root.render(<Probe />));
    mounted.push({ root });
    await flush();
    expect(seen.at(-1)).toMatchObject({ uid: 'owner-1', book: true });
    let release;
    state.answer = () => new Promise((r) => { release = () => r({ status: 200, body: { book: null } }); });
    state.identity = { resolved: true, uid: 'owner-2', authEpoch: 2 };
    act(() => root.render(<Probe />));
    release();
    await flush();
    for (const r of seen) if (r.book) expect(r.key.startsWith(`${r.uid}:`), JSON.stringify(r)).toBe(true);
  });

  it('an older answer for the same owner never replaces a newer one (the stale-answer drop)', async () => {
    const resolvers = [];
    state.answer = () => new Promise((r) => { resolvers.push(r); });
    let api;
    function Probe() { api = useIdeaBook({ enabled: true }); return api.read.book ? <span data-value={api.read.book.line.value} /> : null; }
    const root = createRoot(appRoot);
    act(() => root.render(<Probe />));
    mounted.push({ root });
    await flush();
    act(() => { api.refresh(); });
    await flush();
    expect(resolvers).toHaveLength(2);
    const older = viewOf('full');
    const newer = viewOf('sample');
    resolvers[1]({ status: 200, body: { book: newer } });
    await flush();
    resolvers[0]({ status: 200, body: { book: older } });
    await flush();
    expect(appRoot.querySelector('[data-value]').getAttribute('data-value')).toBe(newer.line.value);
  });

  it('never reads on a timer: hours pass with no read', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] });
    try {
      await mount(<IdeaBookEntry />);
      const before = state.calls.length;
      act(() => { vi.advanceTimersByTime(6 * 60 * 60 * 1000); });
      await flush();
      expect(state.calls.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('after a 404 the window regaining focus does not ask again for that owner (review A5)', async () => {
    let now = 5_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    state.answer = { status: 404, body: { error: 'disabled' } };
    await mount(<IdeaBookEntry />);
    expect(state.calls).toHaveLength(1);
    now += 60_000;
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(state.calls).toHaveLength(1);
  });

  it('B3-11 (B3-A02): the card draws the waiting headline and its reason, and says so to a screen reader — no figure', async () => {
    const v = viewOf('waiting');
    state.answer = { status: 200, body: { book: v } };
    const m = await mount(<IdeaBookEntry />);
    const card = m.host.querySelector('[data-ib="entry-card"]');
    expect(card.textContent).toContain('Waiting on data');
    expect(card.textContent).toContain(v.line.waiting.reason);
    expect(card.textContent).not.toMatch(/\$/);
    expect(card.getAttribute('aria-label')).toBe(`Idea book, Waiting on data, ${v.line.waiting.reason}. Open`);
  });

  it('B3-A09: a refresh that answers 404 while the page is open closes the page, lifts inert, and puts focus beside the card', async () => {
    let now = 7_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const m = await mount(<div><IdeaBookEntry /><button type="button" data-next="">Recent activity</button></div>);
    const card = m.host.querySelector('[data-ib="entry-card"]');
    card.focus();
    click(card);
    await flush();
    expect(document.querySelector('[data-ib="layer"]')).not.toBeNull();
    expect(appRoot.hasAttribute('inert')).toBe(true);
    // The gate closes while the page is open: the next read answers 404.
    state.answer = { status: 404, body: { error: 'disabled' } };
    now += 60_000;
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(document.querySelector('[data-ib="layer"]')).toBeNull();
    expect(appRoot.hasAttribute('inert')).toBe(false);
    expect(m.host.querySelector('[data-ib="entry-card"]')).toBeNull();
    expect(document.activeElement).toBe(m.host.querySelector('[data-next]'));
  });

  it('a card that remounts (the phone Overview coming back) draws its last answer at once, then reads again (review C8)', async () => {
    const first = await mount(<IdeaBookEntry />);
    expect(first.host.querySelector('[data-ib="entry-card"]')).not.toBeNull();
    act(() => first.root.unmount());
    mounted = [];
    let release;
    state.answer = () => new Promise((r) => { release = () => r({ status: 200, body: { book: viewOf('sample') } }); });
    const root = createRoot(appRoot);
    act(() => root.render(<IdeaBookEntry />));
    mounted.push({ root });
    expect(appRoot.querySelector('[data-ib="entry-card"]')).not.toBeNull(); // before its answer
    release();
    await flush();
    expect(state.calls).toHaveLength(2);
  });

  it('a signed-out or unresolved identity asks nothing', async () => {
    state.identity = { resolved: false, uid: null, authEpoch: 0 };
    await mount(<IdeaBookEntry />);
    expect(state.calls).toEqual([]);
  });

  it('the hub\'s site with the switch on: the card above the activity section', async () => {
    const m = await mount(<ActivitySection activity={ACTIVITY} limit={3} />);
    const card = m.host.querySelector('[data-ib="entry-card"]');
    const section = m.host.querySelector('[data-hub-section="activity"]');
    expect(card).not.toBeNull();
    expect(card.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
