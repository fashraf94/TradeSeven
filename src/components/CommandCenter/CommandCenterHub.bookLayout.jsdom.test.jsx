// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHub.bookLayout.jsdom.test.jsx
//
// The portfolio hub's slice 3 — THE FOUR TABS AND THE OVERVIEW (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md
// §2, §4 slice 3, PH-10, PH-12, PH-17, PH-19; Amendment A PH-25 to PH-28), in the connected hub at both sites, switch on, for a book
// owner (the decision 'book'). The fall-through cases of §3 are CommandCenterHub.portfolioSwitch.jsdom.test.jsx's parity rows.
//   1. the tab row: order, labels, one tab stop, the arrow keys, on the phone and on the three wide compositions;
//   2. the Overview's order: book line · Needs you · desk rows · table · marks stamp · today's list under the table;
//   3. the table: no Cash row in the hub, the same table as the Idea book's own screen otherwise, in every state it draws;
//      a row or a slot header opens its detail in place, at every width (PH-27);
//   5. the entry card and its full-window screen are not drawn;
//   6. the loadout: reachable from the game strip (phone) and the Deploy card (wide), in a sheet on the overlay stack that gives
//      focus back; the phone armory's sheet, the same;
//   7. no "Shadow" anywhere in what the book layout draws, with every desk row and an open slot filled;
// and the layout arriving after today's hub (PH-9). The views are the server's own (buildBookView over the B5 scenes, whose agent is
// "Atlas"), never hand-written JSON.

import React, { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ portfolio: true, screen: true }));
vi.mock('../../config/commandCenterPortfolioFlags', () => ({ get COMMAND_CENTER_PORTFOLIO_HUB_ENABLED() { return f.portfolio; } }));
vi.mock('../../config/practiceFieldScreenFlags', () => ({ get PRACTICE_FIELD_SCREEN_ENABLED() { return f.screen; } }));
vi.mock('../../config/sharedResearchFlags', () => ({ SHARED_RESEARCH_MODE: 'off', SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
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
import { HUB_COPY as COPY, PORTFOLIO_HUB_COPY as BOOK_COPY, ARMORY_COPY } from './hub/hubCopy';
import { LOADOUT_COPY } from '../../constants/loadoutCopy';
import useIdeaBook, { REFOCUS_QUIET_MS } from '../PracticeField/useIdeaBook';
import IdeaBookScreen from '../PracticeField/IdeaBookScreen';
import { formatHubDay } from './hub/hubDate';
import { NeedsYouStrip } from './sections/BookOverview';
import { buildBookView } from '../../../api/_utils/practiceField/bookView.js';
import { hubSceneInput } from '../../../api/_utils/practiceField/__testsupport__/bookViewScenesHub.js';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav, press } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 10, 27, 15, 0);
const UID = 'uid-A';
const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const VIEWS = new Map();
/** The server-built view of a B5 scene (Atlas's desk and Trend Follower's desk), cached as JSON. */
const viewOf = (scene) => {
  if (!VIEWS.has(scene)) VIEWS.set(scene, JSON.stringify(buildBookView(hubSceneInput(scene))));
  return JSON.parse(VIEWS.get(scene));
};
const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
const done = (n) => {
  const completed = Date.UTC(2026, 10, 26 - n, 20, 5);
  return {
    id: `done_${String(n).padStart(2, '0')}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
    activatedAt: iso(completed - 6 * HOUR), completedAt: iso(completed),
    scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: iso(completed - 120000) }, statusFeed: [{ action: 'battle_complete' }],
  };
};
const THREE = [done(1), done(2), done(3)];
const agentReady = (stats = { gamesPlayed: 3 }) => ({ status: 'ready', agent: { id: 'agent-a', ownerId: UID, name: 'Atlas', archetype: 'degen', stats }, ownerUid: UID, ownerEpoch: 2, readError: null, retry: vi.fn() });
const windowOf = (battles = [], over = {}) => ({
  battles, status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1,
  reviews: Object.fromEntries(battles.map((b) => [b.id, { state: 'ready', result: READY, nextAt: null }])), checking: false, refreshing: false,
  nextAttemptAt: null, carried: false, refresh: vi.fn(), ...over,
});
const pollMeta = () => ({ epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false });
const hubOf = (over = {}) => ({ activeBattles: [], activePoll: pollMeta(), refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn(), onOpenForge: vi.fn(), setScreen: vi.fn(), ...over });

let layout;
let removeTokens;
let removeNav;
let mounted = [];
let fetchSpy;
let errorSpy;
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });

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
  f.portfolio = true;
  f.screen = true;
  r.identity = { resolved: true, uid: UID, authEpoch: 2 };
  r.agent = agentReady();
  r.window = windowOf();
  r.market = { state: 'OPEN', isOpen: true };
  await clearLastGood();
  net.calls = [];
  net.answer = { status: 200, body: { book: viewOf('sample') } };
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
/** The hub's own widths: the phone at 390 (or `width`); the desktop site's three compositions at 1216, 900 and 600. */
const SITE_WIDTH = Object.freeze({ mobile: 390, desktop: 1216, tablet: 900, stacked: 600 });
async function render(where, { hub = hubOf(), width } = {}) {
  layout.state.hubWidth = width ?? SITE_WIDTH[where];
  const site = where === 'mobile' ? 'mobile' : 'desktop';
  const x = mount(<CommandCenterHub site={site} hub={hub} />);
  mounted.push(x);
  await flush();
  return x;
}
const shell = () => document.querySelector('[data-hub="shell"]');
const tabRow = () => document.querySelector('[data-hub-book-tabs]');
const tabs = () => [...tabRow().querySelectorAll('[role="tab"]')];
const tabNamed = (label) => tabs().find((t) => t.textContent === label);
const selected = () => tabs().filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.getAttribute('data-hub-book-tab'));
const panel = () => document.querySelector('[data-hub-book-panel]');
const part = (sel) => panel().querySelector(sel);
const precedes = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const dialogs = () => [...document.querySelectorAll('[role="dialog"]')];
const dialogNamed = (name) => dialogs().find((d) => d.getAttribute('aria-label') === name) ?? null;
/** React's useId tokens renumbered by first appearance (the counter is global across roots). */
function normalized(html) {
  const ids = new Map();
  return html.replace(/_r_[0-9a-z]+_/g, (id) => {
    if (!ids.has(id)) ids.set(id, `_id${ids.size}_`);
    return ids.get(id);
  });
}

// ── 1. The tab row ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the tab row: Overview · Ideas · Setups · Partnership, on the phone and the three wide compositions', () => {
  it.each(['mobile', 'desktop', 'tablet', 'stacked'])('%s: the four tabs in order and words, one tab stop, the Overview first; today\'s tab row and area list are gone', async (where) => {
    await render(where);
    expect(document.querySelector('[data-hub-layout]').getAttribute('data-hub-layout')).toBe('book');
    expect(tabRow().getAttribute('role')).toBe('tablist');
    expect(tabRow().getAttribute('aria-label')).toBe('Command Center sections');
    expect(tabs().map((t) => t.textContent)).toEqual(['Overview', 'Ideas', 'Setups', 'Partnership']);
    expect(byRole(document, 'tab', 'Loadout')).toEqual([]);
    expect(selected()).toEqual(['overview']);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
    // Today's phone tab row and the wide three-area list (with its connector) are not drawn.
    expect(document.querySelector('[data-hub-phone-tabs]')).toBeNull();
    expect(document.querySelectorAll('[data-hub-area]')).toHaveLength(0);
    expect(document.querySelector('[aria-label="Relationship areas"]')).toBeNull();
    expect(document.querySelector('[data-hub-connector]')).toBeNull();
    // The panel is the selected tab's, and every tab controls it.
    expect(panel().getAttribute('role')).toBe('tabpanel');
    expect(panel().getAttribute('aria-labelledby')).toBe(tabNamed('Overview').id);
    for (const t of tabs()) expect(t.getAttribute('aria-controls')).toBe(panel().id);
    expect(tabRow().getAttribute('data-hub-book-tabs')).toBe(where === 'mobile' ? 'phone' : 'wide');
    // Review S3W-5: off the desktop the wide tabs take 12 px a side, so the four fit the tablet's narrowest column (332 px).
    expect(tabNamed('Overview').style.padding).toBe({ mobile: '0px', desktop: '0px 16px', tablet: '0px 12px', stacked: '0px 12px' }[where]);
  });

  it.each(['mobile', 'desktop', 'stacked'])('%s: the arrow keys, Home and End move the selection and the focus together, wrapping; a modified arrow and Up/Down do nothing', async (where) => {
    await render(where);
    act(() => { tabNamed('Overview').focus(); });
    const step = (key, init) => { press(document.activeElement, key, init); return [selected()[0], document.activeElement.getAttribute('data-hub-book-tab')]; };
    expect(step('ArrowRight')).toEqual(['ideas', 'ideas']);
    expect(step('ArrowRight')).toEqual(['setups', 'setups']);
    expect(step('ArrowRight')).toEqual(['partnership', 'partnership']);
    expect(step('ArrowRight')).toEqual(['overview', 'overview']);
    expect(step('ArrowLeft')).toEqual(['partnership', 'partnership']);
    expect(step('Home')).toEqual(['overview', 'overview']);
    expect(step('End')).toEqual(['partnership', 'partnership']);
    expect(step('ArrowLeft', { altKey: true })).toEqual(['partnership', 'partnership']);
    expect(step('ArrowDown')).toEqual(['partnership', 'partnership']);
    expect(tabs().filter((t) => t.tabIndex === 0).map((t) => t.getAttribute('data-hub-book-tab'))).toEqual(['partnership']);
    expect(panel().getAttribute('aria-labelledby')).toBe(tabNamed('Partnership').id);
  });

  it.each(['mobile', 'desktop'])('%s: each tab draws its panel — the Overview, today\'s Research panel, the archetype desk\'s Desks content, today\'s Partnership panel (PH-25)', async (where) => {
    await render(where);
    expect(part('[data-hub-book-overview]')).not.toBeNull();
    click(tabNamed('Ideas'));
    await flush();
    expect(panel().getAttribute('data-hub-book-panel')).toBe('ideas');
    expect(part('[data-hub-research-door], [data-hub-section], section, div')).not.toBeNull();
    expect(panel().textContent).toContain(COPY.research.ideas);
    expect(part('[data-ib="positions"]')).toBeNull();
    click(tabNamed('Setups'));
    await flush();
    expect(part('[data-hub-book-setups] [data-ib-desk="archetype"]')).not.toBeNull();
    expect(part('[data-ib-desk="shadow"]')).toBeNull();
    expect(panel().textContent).toContain('Trend Follower’s desk');
    click(tabNamed('Partnership'));
    await flush();
    expect(panel().textContent).toContain(COPY.partnership.reserved);
  });
});

// ── 2. The Overview, top to bottom ───────────────────────────────────────────────────────────────────────────────────────

describe('the Overview, top to bottom, for a book owner', () => {
  it.each(['mobile', 'desktop'])('%s: book line · Needs you · desk rows · table · marks stamp · reviews · Game history · Recent activity · the brief', async (where) => {
    r.window = windowOf(THREE);
    await render(where);
    const order = [
      part('[data-ib="book-line"]'),
      part('[data-hub-needs-you]'),
      part('[data-ib="strip"]'),
      part('[data-ib="positions"]'),
      part('[data-ib="stamp"]'),
      part(`[aria-label="${COPY.games.reviewsAvailable}"]`),
      byRole(panel(), 'button', COPY.history.rowLabel(3))[0],
      part('[data-hub-section="activity"]'),
      part(`[aria-label="${COPY.brief.label}"]`) ?? part('[data-hub-section="brief"]'),
    ];
    order.forEach((el, i) => expect(el, `part ${i}`).toBeTruthy());
    for (let i = 1; i < order.length; i += 1) expect(precedes(order[i - 1], order[i]), `part ${i - 1} before part ${i}`).toBe(true);
    // The stamp is the table's own last line.
    expect(part('[data-ib="positions"]').contains(part('[data-ib="stamp"]'))).toBe(true);
    // Needs you is today's next action: the newest ready review, its own title, its action and Later. No card anywhere.
    const strip = part('[data-hub-needs-you]');
    expect(strip.getAttribute('data-hub-needs-you')).toBe('review');
    expect(strip.getAttribute('aria-label')).toBe(BOOK_COPY.needsYou);
    expect(strip.textContent).toContain(COPY.nextAction.reviewTitle(formatHubDay(Date.parse(THREE[0].completedAt))));
    expect(byRole(strip, 'button', COPY.nextAction.openReview)).toHaveLength(1);
    expect(byRole(strip, 'button', COPY.nextAction.later)).toHaveLength(1);
    expect(document.querySelector('[data-hub-next-action]')).toBeNull();
    // The next action's own game is not listed again under the table (today's rule).
    const listed = [...panel().querySelectorAll('[data-hub-game]')].map((el) => el.getAttribute('data-hub-game'));
    expect(listed).not.toContain('done_01');
    expect(listed).toEqual(expect.arrayContaining(['done_02', 'done_03']));
  });

  it('desktop: the side column holds Deploy alone, and there is no next-action slot; the hero, its Huddle chip place, the tabs and the panel are in the main column', async () => {
    r.window = windowOf(THREE);
    await render('desktop');
    const side = document.querySelector('[data-hub-slot="side"]');
    expect(side.querySelector('[data-hub-section="deploy"]')).not.toBeNull();
    expect(side.querySelector('[data-hub-section="activity"]')).toBeNull();
    expect(side.querySelectorAll('section[aria-label]').length).toBe(1);
    // Today's next-action slot stays in the tree (so nothing around it remounts), hidden and empty: Needs you has the next action.
    const next = document.querySelector('[data-hub-slot="next"]');
    expect(next.style.display).toBe('none');
    expect(next.children).toHaveLength(0);
    const main = document.querySelector('[data-hub-slot="main"]');
    expect(main.contains(tabRow())).toBe(true);
    expect(main.contains(panel())).toBe(true);
    expect(precedes(document.querySelector('[data-hub-stage]'), tabRow())).toBe(true);
  });

  it('mobile: the hero and its area summaries stay today\'s, above the tabs; the strip is the game strip, outside the panel', async () => {
    await render('mobile');
    expect(precedes(document.querySelector('[data-hub-stage]'), tabRow())).toBe(true);
    expect(document.querySelectorAll('[data-hub-summary]')).toHaveLength(3);
    expect(document.querySelector('[data-hub-strip]')).not.toBeNull();
    expect(panel().contains(document.querySelector('[data-hub-strip]'))).toBe(false);
  });

  it.each(['mobile', 'desktop'])('%s: Needs you is absent when the selector returns nothing', async (where) => {
    await render(where);
    expect(part('[data-hub-needs-you]')).toBeNull();
    expect(part('[data-ib="book-line"]')).not.toBeNull();
  });

  it('Needs you\'s action and Later are today\'s: the review opens the Film Room; Later sets it aside for the next', async () => {
    r.window = windowOf(THREE);
    const hub = hubOf();
    await render('mobile', { hub });
    click(byRole(part('[data-hub-needs-you]'), 'button', COPY.nextAction.openReview)[0]);
    expect(hub.openFilmRoom).toHaveBeenCalledTimes(1);
    expect(hub.openFilmRoom.mock.calls[0][0]).toBe(THREE[0]);
    click(byRole(part('[data-hub-needs-you]'), 'button', COPY.nextAction.later)[0]);
    await flush();
    expect(part('[data-hub-needs-you]').textContent).toContain(COPY.nextAction.reviewTitle(formatHubDay(Date.parse(THREE[1].completedAt))));
  });

  it('a live game is the next action: Needs you opens it, and its row is not listed again under the table', async () => {
    const live = { id: 'bb_live', ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: iso(NOW - 2 * HOUR), expiresAt: iso(NOW + 3 * HOUR), scoreState: { currentScore: 3.1, tradeCount: 1, evaluationCount: 4 } };
    const hub = hubOf({ activeBattles: [live] });
    await render('mobile', { hub });
    const strip = part('[data-hub-needs-you]');
    expect(strip.getAttribute('data-hub-needs-you')).toBe('openGame');
    click(byRole(strip, 'button', COPY.nextAction.openGame)[0]);
    expect(hub.openGame).toHaveBeenCalledTimes(1);
    expect(panel().querySelector('[data-hub-game="bb_live"]')).toBeNull();
  });

  it('the first deployment is the next action: its action is the deploy hold, inert without the deploy provider, as on the card', async () => {
    r.agent = agentReady({ gamesPlayed: 0 });
    await render('mobile');
    const strip = part('[data-hub-needs-you]');
    expect(strip.getAttribute('data-hub-needs-you')).toBe('deploy');
    expect(strip.textContent).toContain(COPY.nextAction.firstTitle);
    const [hold] = byRole(strip, 'button', COPY.deploy.holdLabel);
    expect(hold.disabled).toBe(true);
    expect(byRole(strip, 'button', COPY.nextAction.later)).toHaveLength(1);
  });
});

describe('Needs you draws every kind the selector returns, with its action and Later (PH-26)', () => {
  const deploy = { displayState: 'ready', canStart: true, gateBlocked: false, freshness: { asOf: NOW, stale: false, refreshing: false }, retryAction: null, reason: null, action: null, recovered: false, battleId: null, cooldownUntil: null, holdControlId: null, retryBlock: null };
  it.each([
    ['openGame', 'Open your live game', 'Open game'],
    ['review', 'Review your Nov 26 game in the Film Room', 'Open Film Room'],
    ['huddle', 'Huddle ready', 'Open huddle'],
  ])('%s: the title, its own action and Later, each wired', (key, title, cta) => {
    const onAct = vi.fn();
    const onLater = vi.fn();
    const m = mount(<NeedsYouStrip nextAction={{ status: 'ready', candidate: { key, title, why: 'W', cta } }} deploy={deploy} onAct={onAct} onLater={onLater} />);
    mounted.push(m);
    const strip = m.host.querySelector('[data-hub-needs-you]');
    expect(strip.getAttribute('data-hub-needs-you')).toBe(key);
    expect(strip.querySelector('[data-hub-needs-you-title]').textContent).toBe(title);
    expect(strip.textContent).not.toContain('W');
    click(byRole(strip, 'button', cta)[0]);
    click(byRole(strip, 'button', COPY.nextAction.later)[0]);
    expect(onAct).toHaveBeenCalledTimes(1);
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('deploy: the provider\'s hold is its action — disabled with no wiring, armed by it; never the act handler', () => {
    const candidate = { status: 'ready', candidate: { key: 'deploy', title: COPY.nextAction.firstTitle, why: 'W', cta: COPY.deploy.holdShort } };
    const onAct = vi.fn();
    const m = mount(<NeedsYouStrip nextAction={candidate} deploy={deploy} onAct={onAct} onLater={() => {}} />);
    mounted.push(m);
    expect(byRole(m.host, 'button', COPY.deploy.holdLabel)[0].disabled).toBe(true);
    m.rerender(<NeedsYouStrip nextAction={candidate} deploy={deploy} onAct={onAct} onLater={() => {}} holdWiring={{ controlId: 'hub-next-action', onComplete: vi.fn() }} />);
    expect(byRole(m.host, 'button', COPY.deploy.holdLabel)[0].disabled).toBe(false);
  });

  it.each([null, { status: 'loading' }, { status: 'ready', candidate: null }])('nothing to say (%j): nothing drawn', (nextAction) => {
    const m = mount(<NeedsYouStrip nextAction={nextAction} deploy={deploy} />);
    mounted.push(m);
    expect(m.host.innerHTML).toBe('');
  });
});

// ── 3. The table ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The Idea book's own screen, at a width, drawing a view: its positions table, the Cash row removed. */
function screenTable(view, width) {
  const m = mount(<IdeaBookScreen read={{ status: 'ready', book: view }} onClose={() => {}} width={width} />);
  const table = m.host.querySelector('[data-ib="positions"]').cloneNode(true);
  const hadCash = Boolean(table.querySelector('[data-ib="cash"]'));
  table.querySelector('[data-ib="cash"]')?.remove();
  m.unmount();
  return { html: normalized(table.outerHTML), hadCash };
}

describe('the table: the Idea book\'s own, every state it draws, with no Cash row (PH-10)', () => {
  it.each(['mobile', 'desktop'])('%s: no Cash row in the hub, the marks stamp is there; the Idea book\'s own screen still draws its Cash row', async (where) => {
    const view = viewOf('sample');
    await render(where);
    expect(part('[data-ib="positions"]')).not.toBeNull();
    expect(document.querySelector('[data-ib="cash"]')).toBeNull();
    expect(part('[data-ib="stamp"]').textContent).toBe(view.asOf.text);
    expect(screenTable(view, 390).hadCash).toBe(true);
  });

  const SCENES = ['full', 'newBook', 'nearLine', 'lineHit', 'lineRecognised', 'exitCalled', 'waiting', 'boughtToday', 'unobserved', 'desksAdmit', 'settledToday', 'failed', 'paused', 'history'];
  for (const [where, width, screenWidth] of [['mobile', 390, 390], ['mobile', 320, 320], ['desktop', 1216, 1216]]) {
    it.each(SCENES)(`${where} at ${width}: %s — the hub's table is the screen's at the same layout, less its Cash row`, async (scene) => {
      const view = viewOf(scene);
      net.answer = { status: 200, body: { book: view } };
      await render(where, { width });
      const hub = normalized(part('[data-ib="positions"]').outerHTML);
      const own = screenTable(view, screenWidth);
      expect(own.hadCash).toBe(true);
      expect(hub).toBe(own.html);
    });
  }

  it.each(['mobile', 'desktop'])('%s: a name row and a slot header each open their built detail in place, under them; one at a time (PH-27)', async (where) => {
    await render(where);
    const table = part('[data-ib="positions"]');
    const group = table.querySelector('[data-ib-group="medium"]');
    const name = group.querySelector('[data-ib-name]');
    const symbol = name.getAttribute('data-ib-name');
    click(name);
    await flush();
    const namePanel = byRole(table, 'region', `${symbol} detail`)[0];
    expect(namePanel).toBeTruthy();
    expect(name.getAttribute('aria-expanded')).toBe('true');
    expect(name.nextElementSibling.contains(namePanel)).toBe(true);
    const header = group.querySelector('button[aria-expanded]');
    click(header);
    await flush();
    expect(byRole(table, 'region', `${symbol} detail`)).toEqual([]);
    const ideaPanel = byRole(group, 'region', 'Medium idea detail')[0];
    expect(ideaPanel).toBeTruthy();
    expect(group.contains(ideaPanel)).toBe(true);
    expect(precedes(header, ideaPanel)).toBe(true);
    click(header);
    await flush();
    expect(byRole(table, 'region', 'Medium idea detail')).toEqual([]);
  });

  it.each(['mobile', 'desktop'])('%s: a desk row opens Setups for the archetype\'s desk and Ideas for the agent\'s, and focus moves to that tab (review S3W-1)', async (where) => {
    await render(where);
    const rows = [...part('[data-ib="strip"]').querySelectorAll('button')];
    expect(rows.map((b) => b.textContent)).toEqual([expect.stringContaining('Trend Follower’s desk'), expect.stringContaining('Atlas’s desk')]);
    act(() => { rows[0].focus(); });
    click(rows[0]);
    await flush();
    expect(selected()).toEqual(['setups']);
    expect(part('[data-ib-desk="archetype"]')).not.toBeNull();
    // The row went away with the Overview; focus is on the tab it opened, never on <body>.
    expect(document.activeElement).toBe(tabNamed('Setups'));
    click(tabNamed('Overview'));
    await flush();
    const agentRow = part('[data-ib="strip"]').querySelectorAll('button')[1];
    act(() => { agentRow.focus(); });
    click(agentRow);
    await flush();
    expect(selected()).toEqual(['ideas']);
    expect(document.activeElement).toBe(tabNamed('Ideas'));
  });

  it.each(['mobile', 'desktop'])('%s: each desk row is named for the tab it opens here; the Idea book\'s own screen keeps "Open Desks" (review S3W-4)', async (where) => {
    const view = viewOf('sample');
    await render(where);
    const names = [...part('[data-ib="strip"]').querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      BOOK_COPY.deskRowLabel(view.strip[0].deskName, view.strip[0].text, BOOK_COPY.tabs.setups),
      BOOK_COPY.deskRowLabel(view.strip[1].deskName, view.strip[1].text, BOOK_COPY.tabs.ideas),
    ]);
    expect(names[0]).toBe(`Trend Follower’s desk · ${view.strip[0].text}. Open Setups`);
    const m = mount(<IdeaBookScreen read={{ status: 'ready', book: view }} onClose={() => {}} width={390} />);
    mounted.push(m);
    expect([...m.host.querySelectorAll('[data-ib="strip"] button')].map((b) => b.getAttribute('aria-label'))).toEqual(view.strip.map((it) => `${it.deskName} · ${it.text}. Open Desks`));
  });
});

// ── 5. The card ──────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the Idea book\'s entry card and its full-window screen are not drawn in the book layout (PH-19)', () => {
  it.each(['mobile', 'desktop'])('%s: no card on any tab, no layer; Recent activity is drawn under the table without it', async (where) => {
    await render(where);
    expect(part('[data-hub-section="activity"]')).not.toBeNull();
    for (const label of ['Overview', 'Ideas', 'Setups', 'Partnership', 'Overview']) {
      click(tabNamed(label));
      await flush();
      expect(document.querySelector('[data-ib="entry-card"]')).toBeNull();
      expect(document.querySelector('[data-ib="layer"]')).toBeNull();
    }
  });
});

// ── 6. The loadout ───────────────────────────────────────────────────────────────────────────────────────────────────────

const stripOpener = () => byRole(document.querySelector('[data-hub-strip]'), 'button', /Open loadout$/)[0];
const hostOf = () => mounted[mounted.length - 1].host;

describe('the loadout: no tab, a sheet, from the game strip on the phone and the Deploy card on the wide compositions (PH-17)', () => {
  it('mobile: the strip\'s status button opens today\'s Loadout area in a sheet on the overlay stack; Escape closes it and focus returns to the button', async () => {
    await render('mobile');
    const opener = stripOpener();
    expect(opener).toBeTruthy();
    act(() => { opener.focus(); });
    click(opener);
    await flush();
    const sheet = dialogNamed(BOOK_COPY.loadoutSheet);
    expect(sheet).not.toBeNull();
    expect(sheet.getAttribute('data-hub-sheet')).toBe('bottom');
    expect(sheet.querySelector('[data-hub-book-loadout="phone"]')).not.toBeNull();
    // Today's Loadout tab, whole: the phone's Deploy card first, then the loadout cards.
    expect(sheet.querySelector('[data-hub-deploy-card="phone"]')).not.toBeNull();
    expect(byRole(sheet, 'button', LOADOUT_COPY.changeArmor(LOADOUT_COPY.games.baggerbomb))).toHaveLength(1);
    expect(precedes(sheet.querySelector('[data-hub-deploy-card="phone"]'), byRole(sheet, 'button', LOADOUT_COPY.changeArmor(LOADOUT_COPY.games.baggerbomb))[0])).toBe(true);
    // The overlay stack: the page behind is inert while it is open.
    expect(hostOf().hasAttribute('inert')).toBe(true);
    press(sheet, 'Escape');
    await flush();
    expect(dialogNamed(BOOK_COPY.loadoutSheet)).toBeNull();
    expect(hostOf().hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(stripOpener());
  });

  it.each(['desktop', 'tablet', 'stacked'])('%s: the Deploy card\'s loadout line opens the same area in a dialog; Close returns focus to it', async (where) => {
    await render(where);
    const opener = byRole(document.querySelector('[data-hub-slot="deploy"]'), 'button', LOADOUT_COPY.openCard)[0];
    expect(opener).toBeTruthy();
    click(opener);
    await flush();
    const sheet = dialogNamed(BOOK_COPY.loadoutSheet);
    expect(sheet).not.toBeNull();
    expect(sheet.getAttribute('data-hub-sheet')).toBe('dialog');
    expect(sheet.querySelector('[data-hub-book-loadout="wide"]')).not.toBeNull();
    expect(byRole(sheet, 'button', LOADOUT_COPY.changeArmor(LOADOUT_COPY.games.baggerbomb))).toHaveLength(1);
    expect(hostOf().hasAttribute('inert')).toBe(true);
    click(byRole(sheet, 'button', COPY.sheet.close)[0]);
    await flush();
    expect(dialogNamed(BOOK_COPY.loadoutSheet)).toBeNull();
    expect(hostOf().hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('mobile: the armor row opens the armory in its own sheet (the hero\'s box stays closed); it joins the overlay stack and gives focus back to what opened the loadout', async () => {
    await render('mobile');
    const opener = stripOpener();
    click(opener);
    await flush();
    click(byRole(dialogNamed(BOOK_COPY.loadoutSheet), 'button', LOADOUT_COPY.changeArmor(LOADOUT_COPY.games.baggerbomb))[0]);
    await flush();
    // The armory takes the hub's one sheet slot: the loadout's sheet is gone, the armory's is open.
    expect(dialogNamed(BOOK_COPY.loadoutSheet)).toBeNull();
    const armory = dialogNamed(ARMORY_COPY.title);
    expect(armory).not.toBeNull();
    expect(armory.getAttribute('data-hub-sheet')).toBe('bottom');
    expect(armory.querySelector('[data-armory="sheet"]')).not.toBeNull();
    expect(armory.querySelectorAll('[role="option"]')).toHaveLength(6);
    // The sheet's own title and Close stand for the ring's: one Close, the sheet's.
    expect(armory.querySelector('[data-armory-close]')).toBeNull();
    expect(byRole(armory, 'button', COPY.sheet.close)).toHaveLength(1);
    expect(document.querySelector('[data-hub-armory="open"]')).toBeNull();
    expect(hostOf().hasAttribute('inert')).toBe(true);
    press(armory, 'Escape');
    await flush();
    expect(dialogNamed(ARMORY_COPY.title)).toBeNull();
    expect(hostOf().hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(stripOpener());
  });

  it('desktop: the armor row opens today\'s armory dialog, on the stack, and Escape gives focus back to the Deploy card\'s opener', async () => {
    await render('desktop');
    const opener = byRole(document.querySelector('[data-hub-slot="deploy"]'), 'button', LOADOUT_COPY.openCard)[0];
    click(opener);
    await flush();
    click(byRole(dialogNamed(BOOK_COPY.loadoutSheet), 'button', LOADOUT_COPY.changeArmor(LOADOUT_COPY.games.baggerbomb))[0]);
    await flush();
    const armory = dialogNamed(ARMORY_COPY.title);
    expect(armory).not.toBeNull();
    expect(armory.querySelector('[data-armory="dialog"]')).not.toBeNull();
    expect(hostOf().hasAttribute('inert')).toBe(true);
    press(armory, 'Escape');
    await flush();
    expect(dialogNamed(ARMORY_COPY.title)).toBeNull();
    expect(hostOf().hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  // Review S3W-2, S3W-3: each layout's armory has its own home and key, so a layout change closes the other's and opens nothing.
  it('mobile: the armory\'s sheet open when a read takes the book away closes; today\'s hero box does not open in its place', async () => {
    await render('mobile');
    const opener = stripOpener();
    click(opener);
    await flush();
    click(byRole(dialogNamed(BOOK_COPY.loadoutSheet), 'button', LOADOUT_COPY.changeArmor(LOADOUT_COPY.games.baggerbomb))[0]);
    await flush();
    expect(dialogNamed(ARMORY_COPY.title)).not.toBeNull();
    net.answer = { status: 200, body: { book: null } };
    vi.setSystemTime(NOW + REFOCUS_QUIET_MS + 1);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(document.querySelector('[data-hub-layout]').getAttribute('data-hub-layout')).toBe('today');
    expect(dialogNamed(ARMORY_COPY.title)).toBeNull();
    expect(document.querySelector('[data-hub-armory="open"]')).toBeNull();
    expect(shell().hasAttribute('data-hub-modal-open')).toBe(false);
    expect(hostOf().hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(stripOpener());
  });

  it('mobile: today\'s armory open in the hero\'s box when the book arrives closes; no sheet opens without a tap (PH-9)', async () => {
    let answer;
    const pending = new Promise((resolve) => { answer = resolve; });
    net.answer = () => pending;
    await render('mobile');
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    await flush();
    click(byRole(document.querySelector('[data-hub-phone-panel]'), 'button', LOADOUT_COPY.changeArmor(LOADOUT_COPY.games.baggerbomb))[0]);
    await flush();
    expect(document.querySelector('[data-hub-armory="open"]')).not.toBeNull();
    answer({ status: 200, body: { book: viewOf('sample') } });
    await flush();
    expect(document.querySelector('[data-hub-layout]').getAttribute('data-hub-layout')).toBe('book');
    expect(document.querySelector('[data-hub-armory="open"]')).toBeNull();
    expect(dialogs()).toEqual([]);
    expect(shell().hasAttribute('data-hub-modal-open')).toBe(false);
    expect(hostOf().hasAttribute('inert')).toBe(false);
  });

  it('the loadout\'s sheet belongs to the book layout: a read that takes the book away closes it and frees the slot', async () => {
    await render('mobile');
    click(stripOpener());
    await flush();
    expect(dialogNamed(BOOK_COPY.loadoutSheet)).not.toBeNull();
    net.answer = { status: 200, body: { book: null } };
    vi.setSystemTime(NOW + REFOCUS_QUIET_MS + 1);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(document.querySelector('[data-hub-layout]').getAttribute('data-hub-layout')).toBe('today');
    expect(dialogNamed(BOOK_COPY.loadoutSheet)).toBeNull();
    expect(shell().hasAttribute('data-hub-modal-open')).toBe(false);
    expect(hostOf().hasAttribute('inert')).toBe(false);
  });
});

// ── 7. No "Shadow" ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Every word the book layout draws, seen and named: the tab row and the panel's text, and every label and title in them. */
function wordsOf(...roots) {
  const out = [];
  for (const root of roots) {
    out.push(root.textContent);
    for (const el of [root, ...root.querySelectorAll('*')]) {
      for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) if (el.hasAttribute(attr)) out.push(el.getAttribute(attr));
    }
  }
  return out.join('\n');
}

describe('no player-facing "Shadow" in anything the book layout draws (spec PH-5; B5\'s names)', () => {
  it.each(['mobile', 'desktop'])('%s: the layout\'s own words — every desk row and an open slot filled (the desksAdmit scene), every tab, every row and slot opened', async (where) => {
    const view = viewOf('desksAdmit');
    expect(view.strip.map((s) => s.desk)).toEqual(['archetype', 'shadow']);
    expect(view.groups.some((g) => g.state === 'open')).toBe(true);
    expect(view.groups.some((g) => g.state === 'entering')).toBe(true);
    net.answer = { status: 200, body: { book: view } };
    await render(where);
    const seen = [];
    const look = () => seen.push(wordsOf(tabRow(), panel()));
    look();
    // Every slot header and every name row opened in turn, so each detail panel is drawn once.
    const table = () => part('[data-ib="positions"]');
    const toggles = () => [...table().querySelectorAll('button[aria-expanded]')];
    const count = toggles().length;
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < count; i += 1) {
      click(toggles()[i]);
      await flush();
      look();
      if (toggles()[i].getAttribute('aria-expanded') === 'true') { click(toggles()[i]); await flush(); }
    }
    for (const label of ['Ideas', 'Setups', 'Partnership']) {
      click(tabNamed(label));
      await flush();
      look();
    }
    const words = seen.join('\n');
    expect(words).toContain('Atlas’s desk');
    expect(words).toContain('Trend Follower’s desk');
    expect(words).toContain('Atlas’s desk looks tonight');
    expect(words.match(/shadow/gi)).toBeNull();
  });

  // Review S3G-1, S3R-1: the rows above scan the layout's own words. Around them, today's hub still names "Shadow" in strings the prompt
  // keeps — report §7 R1 and Q-1. This row scans the WHOLE page, and the loadout's and the armory's sheets the layout opens, and pins
  // every occurrence: each is one of today's named strings, and their count per place is exact, so a new one (even of a kept string) is
  // a decision, not a drift. Inside the layout's own region and its two new sheets there is none. The inventory of today's kept strings
  // (report R1): the hero's name and stage label, its image label bare or armored, the Deploy card's title, the armory dialog's centre
  // and intro, the first deployment's why (not drawn by Needs you), and the Huddle sheet's eyebrow (no Huddle member in this suite).
  const KEPT = () => new Set([
    COPY.shadow.name, COPY.shadow.stageLabel,
    ...Object.values(COPY.shadow.states).map((state) => COPY.shadow.imageLabel(state, null)),
    COPY.deploy.title, ARMORY_COPY.centre, ARMORY_COPY.intro, COPY.nextAction.firstWhy, COPY.huddle.sheetEyebrow,
  ]);
  /** Every visible text node and every label in `root` that names Shadow, each as drawn. */
  function shadowHits(root) {
    const hits = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (/shadow/i.test(node.nodeValue)) hits.push(node.nodeValue.trim());
    for (const el of [root, ...root.querySelectorAll('*')]) {
      for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) if (el.hasAttribute?.(attr) && /shadow/i.test(el.getAttribute(attr))) hits.push(el.getAttribute(attr));
    }
    return hits;
  }
  it.each(['mobile', 'desktop'])('%s: the whole page and every sheet the layout opens name "Shadow" only in today\'s kept strings, and the layout\'s own region and new sheets not at all', async (where) => {
    net.answer = { status: 200, body: { book: viewOf('desksAdmit') } };
    await render(where);
    // Every occurrence, counted: the hero's name line, its stage's label, its one image label; on the wide compositions the Deploy
    // card's title, and with today's armory dialog open its centre label.
    const expected = (extra = []) => {
      const hits = shadowHits(document.body);
      const image = hits.filter((s) => s.startsWith(`${COPY.shadow.name} — `));
      expect(image, 'one image label').toHaveLength(1);
      return [COPY.shadow.name, COPY.shadow.stageLabel, image[0], ...(where === 'mobile' ? [] : [COPY.deploy.title]), ...extra].sort();
    };
    const check = (label, extra) => {
      const hits = shadowHits(document.body);
      for (const s of hits) expect(KEPT().has(s), `${label}: "${s}"`).toBe(true);
      expect(hits.sort(), `${label}: every occurrence`).toEqual(expected(extra));
      expect(shadowHits(tabRow()).concat(shadowHits(panel())), `${label}: the layout's own region`).toEqual([]);
    };
    check('the page');
    // The loadout's sheet, then the armory from it.
    click(where === 'mobile' ? stripOpener() : byRole(document.querySelector('[data-hub-slot="deploy"]'), 'button', LOADOUT_COPY.openCard)[0]);
    await flush();
    expect(shadowHits(dialogNamed(BOOK_COPY.loadoutSheet)), 'the loadout\'s sheet').toEqual([]);
    check('the loadout open');
    click(byRole(dialogNamed(BOOK_COPY.loadoutSheet), 'button', LOADOUT_COPY.changeArmor(LOADOUT_COPY.games.baggerbomb))[0]);
    await flush();
    const armory = dialogNamed(ARMORY_COPY.title);
    expect(armory).not.toBeNull();
    if (where === 'mobile') expect(shadowHits(armory), 'the phone armory\'s new sheet').toEqual([]);
    check('the armory open', where === 'mobile' ? [] : [ARMORY_COPY.centre]);
  });

  it('the scan sees a "Shadow" the view would carry (a planted desk name), so the row above is not vacuous', async () => {
    const view = viewOf('desksAdmit');
    view.strip[1].deskName = 'Shadow desk';
    net.answer = { status: 200, body: { book: view } };
    await render('mobile');
    expect(wordsOf(tabRow(), panel()).match(/shadow/gi)).not.toBeNull();
  });
});

// ── PH-9: the layout arrives after today's hub ───────────────────────────────────────────────────────────────────────────

describe('the book layout arrives after today\'s hub has drawn (PH-9), and opens on what today\'s selection becomes', () => {
  /** The book's first read, answered when the row says so: until then the read is loading and the hub is today's. */
  function lateRead() {
    let answer;
    const pending = new Promise((resolve) => { answer = resolve; });
    net.answer = () => pending;
    return async () => { answer({ status: 200, body: { book: viewOf('sample') } }); await flush(); };
  }

  it('mobile: a player on today\'s Research tab when the book arrives lands on Ideas', async () => {
    const arrive = lateRead();
    await render('mobile');
    expect(document.querySelector('[data-hub-layout]').getAttribute('data-hub-layout')).toBe('today');
    expect(tabRow()).toBeNull();
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    await flush();
    await arrive();
    expect(document.querySelector('[data-hub-layout]').getAttribute('data-hub-layout')).toBe('book');
    expect(selected()).toEqual(['ideas']);
    expect(document.querySelector('[data-hub-phone-tabs]')).toBeNull();
  });

  it('desktop: today\'s default area (Equipped Archetype) becomes the Overview', async () => {
    const arrive = lateRead();
    await render('desktop');
    expect(document.querySelectorAll('[data-hub-area]')).toHaveLength(3);
    await arrive();
    expect(selected()).toEqual(['overview']);
    expect(document.querySelectorAll('[data-hub-area]')).toHaveLength(0);
  });

  // Review S3W-6: the book layout keeps today's tree, so the hero and the Deploy card stay the same nodes as the layout arrives.
  it.each(['mobile', 'desktop', 'tablet', 'stacked'])('%s: the hero and the Deploy card (the strip, on the phone) are not remounted when the book arrives', async (where) => {
    const arrive = lateRead();
    await render(where);
    const stage = document.querySelector('[data-hub-stage]');
    const deployPart = where === 'mobile' ? document.querySelector('[data-hub-strip]') : document.querySelector('[data-hub-slot="deploy"] [data-hub-section="deploy"]');
    expect(stage).not.toBeNull();
    expect(deployPart).not.toBeNull();
    await arrive();
    expect(document.querySelector('[data-hub-layout]').getAttribute('data-hub-layout')).toBe('book');
    expect(tabRow()).not.toBeNull();
    expect(document.querySelector('[data-hub-stage]')).toBe(stage);
    expect(where === 'mobile' ? document.querySelector('[data-hub-strip]') : document.querySelector('[data-hub-slot="deploy"] [data-hub-section="deploy"]')).toBe(deployPart);
    expect(stage.isConnected && deployPart.isConnected).toBe(true);
  });
});
