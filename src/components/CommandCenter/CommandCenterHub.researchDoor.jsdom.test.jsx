// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHub.researchDoor.jsdom.test.jsx
//
// Command Center core spec V1.2, Amendment E V1.1 Part 2 (§1, §3; rulings R-D1 to R-D4) — the hub research door end to end,
// in the connected hub at both sites:
//   - admission: at 'off' nothing new renders, is read or is requested; at 'on' every signed-in player is admitted with no
//     request; at 'allowlist' one cockpit-status verdict request with an owned agentBattles id the hub already holds, cached
//     for a second mount, none without a battle, nothing rendered or read on a false verdict;
//   - the Research panel's door: "Research in progress" with and without its last update, Continue, the read's error line
//     with Retry (the door stays), and while the read is out no line and the door shows;
//   - the sheet: "Work an idea" opens the start view with the selector's stories, Continue and an Activity row open their
//     investigation, focus returns to each opener on close, one overlay at a time, and admission ending closes it.
// The mode is the flag module's (mocked here, a getter each row sets; main ships 'off'); the verdict is the REAL filmRoomGate
// cache over a fetch recorder; the readers' services and the body's loader are stand-ins (no network, no database).

import React, { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ mode: 'off' }));
vi.mock('../../config/sharedResearchFlags', () => ({ get SHARED_RESEARCH_MODE() { return m.mode; }, SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: { getIdToken: async () => 'token' } }) }));
const r = vi.hoisted(() => ({ identity: null, agent: null, window: null, market: null, lists: [] }));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => r.identity }));
vi.mock('../../hooks/useAgent', () => ({ default: () => r.agent }));
vi.mock('./hub/useHubCompletedBattles', () => ({ default: () => r.window }));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => r.market }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => r.lists }));
vi.mock('../../services/leagueLockService', () => ({ subscribeLeagueLock: (uid, onLock) => { onLock({ locked: false, groupId: null, status: null, endsAtMs: null }); return () => {}; } }));
vi.mock('../../services/hypothesisVersionService', () => ({ listHypothesisVersions: vi.fn(async () => ({ watchlistId: 'wl-1', currentVersion: 0, versions: [], research: [] })) }));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({ default: function useDailyRegimeBrief() { return { dailyBrief: null, keyEvents: [], themes: [], forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} }; } }));
const svc = vi.hoisted(() => ({ fetchFeed: vi.fn(), fetchSharedResearchRecords: vi.fn(), load: vi.fn() }));
vi.mock('../../services/fantasyTimesClient', () => ({ fetchFeed: svc.fetchFeed }));
vi.mock('../../services/sharedResearchRecords', () => ({ fetchSharedResearchRecords: svc.fetchSharedResearchRecords }));
const body = vi.hoisted(() => ({ props: null }));
vi.mock('./hub/loadSharedResearch', () => ({ loadSharedResearch: svc.load }));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { selectStories } from '../../selectors/storySelection';
import { FILM_ROOM_VERDICT_PATH, resetFilmRoomVerdicts } from '../../utils/filmRoomGate';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav, press } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function StubBody(props) {
  body.props = props;
  return <div data-stub-body={props.mode} data-stub-session={props.sessionId ?? ''}><button type="button">inside</button></div>;
}

const NOW = Date.UTC(2026, 10, 14, 15, 0);
const UID = 'uid-A';
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3600 * 1000;

const LIVE = { id: 'ab_live_1', ownerId: UID, agentId: 'agent-a', status: 'active', activatedAt: iso(NOW - HOUR), expiresAt: iso(NOW + 8 * HOUR), scoreState: { currentScore: 0, tradeCount: 0, evaluationCount: 0, lastScoredAt: null } };
const DONE = { id: 'ab_done_1', ownerId: UID, agentId: 'agent-a', status: 'completed', activatedAt: iso(NOW - 30 * HOUR), completedAt: iso(NOW - 24 * HOUR), scoreState: { currentScore: 4, opponentScore: 2, lastScoredAt: iso(NOW - 25 * HOUR) }, statusFeed: [{ action: 'battle_complete' }] };
const STORIES = [
  { id: 'st_1', type: 'market_mover', headline: 'Switchgear makers jump', subheadline: 'Lead times set the pace.', reporterName: 'Alex', reporterBeat: 'Stock Spotlight', publishedAt: iso(NOW - HOUR), expiresAt: iso(NOW + 5 * HOUR), status: 'published' },
  { id: 'st_2', type: 'market_pulse', headline: 'The tape today', reporterName: 'Kai', reporterBeat: 'Market Pulse', publishedAt: iso(NOW - 30 * 60000), expiresAt: iso(NOW + 5 * HOUR), status: 'published' },
];
const recordOf = (sessionId, over = {}) => ({
  id: `sr_${sessionId}`, origin: 'shared_research', state: 'open', host: { collection: 'sharedResearchSessions', id: sessionId },
  question: 'Who earns from the switchgear backlog?', createdAt: iso(NOW - 3 * HOUR), endedAt: null, terminalReason: null,
  findings: [{}, {}, {}, {}], telemetry: { lastTurnAt: iso(NOW - 20 * 60000) }, ...over,
});

const agentReady = () => ({ status: 'ready', agent: { id: 'agent-a', ownerId: UID, name: 'Atlas', archetype: 'degen', stats: { gamesPlayed: 3 } }, ownerUid: UID, ownerEpoch: 2, readError: null, retry: vi.fn() });
const windowOf = (battles) => ({ battles, status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1, reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, carried: false, refresh: vi.fn() });
const pollMeta = () => ({ epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false });
const hubOf = (over = {}) => ({ activeBattles: [], activePoll: pollMeta(), refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn(), onOpenForge: vi.fn(), setScreen: vi.fn(), ...over });

let layout;
let removeTokens;
let removeNav;
let mounted = [];
let fetchSpy;
let verdict;
let errorSpy;
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  sessionStorage.clear();
  resetFilmRoomVerdicts();
  m.mode = 'off';
  r.identity = { resolved: true, uid: UID, authEpoch: 2 };
  r.agent = agentReady();
  r.window = windowOf([DONE]);
  r.market = { state: 'OPEN', isOpen: true };
  r.lists = [];
  body.props = null;
  svc.fetchFeed.mockReset().mockResolvedValue(STORIES);
  svc.fetchSharedResearchRecords.mockReset().mockResolvedValue([]);
  svc.load.mockReset().mockResolvedValue({ default: StubBody });
  verdict = { status: 200, body: { on: false, allowlisted: true, serverNowMs: 0 } };
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({ ok: verdict.status === 200, status: verdict.status, json: async () => verdict.body }));
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
  resetFilmRoomVerdicts();
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
async function openResearchArea(site) {
  if (site === 'mobile') click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
  else click(byRole(document, 'tab', new RegExp(COPY.areas.names[1]))[0]);
  await flush();
}
const verdictCalls = () => fetchSpy.mock.calls.filter(([url]) => String(url).startsWith(FILM_ROOM_VERDICT_PATH));
/** Every request but the Huddle's own status read, which today's hub makes at every mode (DRB_HUDDLE_ENABLED; not this build's). */
const newRequests = () => fetchSpy.mock.calls.map(([url]) => String(url)).filter((url) => !url.startsWith('/api/huddle/'));
/** Every element this build adds (the S6 idea card's own data-hub-research-retry / -stale / -wait are S6's, not the door's). */
const DOOR_SELECTORS = ['[data-hub-research-door]', '[data-hub-research-progress]', '[data-hub-research-continue]', '[data-hub-research-door-error]', '[data-hub-research-work]', '[data-hub-research-load-failed]'];
const doorElements = () => DOOR_SELECTORS.flatMap((s) => [...document.querySelectorAll(s)]);
const door = () => document.querySelector('[data-hub-research-door]');
const workButton = () => document.querySelector('[data-hub-research-work]');
const continueButton = () => document.querySelector('[data-hub-research-continue] button');
const dialogs = () => document.querySelectorAll('[role="dialog"]');
const activityRows = () => [...document.querySelectorAll('[data-hub-activity-row="research"]')];

describe("'off' (the shipped mode): the hub is today's hub", () => {
  it.each(['mobile', 'desktop'])('%s: no request, no read, no load, and no element of the door anywhere — the Research area included', async (site) => {
    await render(site, hubOf({ activeBattles: [LIVE] }));
    await openResearchArea(site);
    expect(document.querySelector('[data-hub-panel="research"]')).not.toBeNull();
    expect(doorElements()).toEqual([]);
    expect(verdictCalls()).toEqual([]);
    expect(newRequests()).toEqual([]);
    expect(svc.fetchFeed).not.toHaveBeenCalled();
    expect(svc.fetchSharedResearchRecords).not.toHaveBeenCalled();
    expect(svc.load).not.toHaveBeenCalled();
    expect(activityRows()).toEqual([]);
  });

  it("a value outside the walked three reads 'off': nothing either", async () => {
    m.mode = 'ON';
    await render('mobile', hubOf({ activeBattles: [LIVE] }));
    await openResearchArea('mobile');
    expect(doorElements()).toEqual([]);
    expect(newRequests()).toEqual([]);
    expect(svc.fetchFeed).not.toHaveBeenCalled();
  });
});

describe("'on': every signed-in player is admitted, with no request", () => {
  it.each(['mobile', 'desktop'])('%s: the door shows; the stories and research readers read once each; no verdict request', async (site) => {
    m.mode = 'on';
    await render(site);
    await openResearchArea(site);
    expect(door()).not.toBeNull();
    expect(workButton().textContent).toBe(COPY.research.door.work);
    expect(verdictCalls()).toEqual([]);
    expect(svc.fetchFeed).toHaveBeenCalledTimes(1);
    expect(svc.fetchSharedResearchRecords).toHaveBeenCalledTimes(1);
    expect(svc.fetchSharedResearchRecords.mock.calls[0][0]).toEqual({ uid: UID });
  });

  it('a tab switch, an area switch and a re-render read nothing more (read once per load)', async () => {
    m.mode = 'on';
    const x = await render('mobile');
    await openResearchArea('mobile');
    click(byRole(document, 'tab', COPY.phoneTabs.overview)[0]);
    await flush();
    await openResearchArea('mobile');
    x.rerender(<CommandCenterHub site="mobile" hub={hubOf()} />);
    await flush();
    expect(svc.fetchFeed).toHaveBeenCalledTimes(1);
    expect(svc.fetchSharedResearchRecords).toHaveBeenCalledTimes(1);
  });
});

describe("'allowlist': the cached cockpit-status verdict for an owned agent battle", () => {
  it('one verdict request with the owned LIVE battle id first; admitted on yes', async () => {
    m.mode = 'allowlist';
    await render('mobile', hubOf({ activeBattles: [LIVE] }));
    await openResearchArea('mobile');
    expect(verdictCalls()).toHaveLength(1);
    expect(verdictCalls()[0][0]).toBe(`${FILM_ROOM_VERDICT_PATH}?battleId=ab_live_1`);
    expect(door()).not.toBeNull();
    expect(svc.fetchFeed).toHaveBeenCalledTimes(1);
  });

  it('no live game: the completed window\'s battle', async () => {
    m.mode = 'allowlist';
    await render('mobile');
    expect(verdictCalls()).toHaveLength(1);
    expect(verdictCalls()[0][0]).toBe(`${FILM_ROOM_VERDICT_PATH}?battleId=ab_done_1`);
  });

  it('cached for a second mount: no second request, and the door is there at once', async () => {
    m.mode = 'allowlist';
    const first = await render('mobile', hubOf({ activeBattles: [LIVE] }));
    first.unmount();
    mounted = mounted.filter((x) => x !== first);
    await render('mobile', hubOf({ activeBattles: [LIVE] }));
    await openResearchArea('mobile');
    expect(verdictCalls()).toHaveLength(1);
    expect(door()).not.toBeNull();
  });

  it('no owned battle (no live game, an empty window): not admitted, and no request', async () => {
    m.mode = 'allowlist';
    r.window = windowOf([]);
    await render('mobile');
    await openResearchArea('mobile');
    expect(newRequests()).toEqual([]);
    expect(doorElements()).toEqual([]);
    expect(svc.fetchFeed).not.toHaveBeenCalled();
    expect(svc.fetchSharedResearchRecords).not.toHaveBeenCalled();
  });

  it('a false verdict: nothing renders and nothing is read', async () => {
    m.mode = 'allowlist';
    verdict = { status: 200, body: { on: false, allowlisted: false, serverNowMs: 0 } };
    await render('mobile', hubOf({ activeBattles: [LIVE] }));
    await openResearchArea('mobile');
    expect(verdictCalls()).toHaveLength(1);
    expect(doorElements()).toEqual([]);
    expect(svc.fetchFeed).not.toHaveBeenCalled();
    expect(svc.fetchSharedResearchRecords).not.toHaveBeenCalled();
    expect(activityRows()).toEqual([]);
  });

  it('until the verdict answers: not admitted — no door, no read', async () => {
    m.mode = 'allowlist';
    let answer;
    fetchSpy.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    await render('mobile', hubOf({ activeBattles: [LIVE] }));
    await openResearchArea('mobile');
    expect(doorElements()).toEqual([]);
    expect(svc.fetchFeed).not.toHaveBeenCalled();
    await act(async () => { answer({ ok: true, status: 200, json: async () => ({ allowlisted: true }) }); });
    await flush();
    expect(door()).not.toBeNull();
  });
});

describe('the Research panel\'s door (amendment §3.1)', () => {
  beforeEach(() => { m.mode = 'on'; });

  it('sits at the top of the panel, above the Ideas eyebrow', async () => {
    await render('mobile');
    await openResearchArea('mobile');
    const panel = document.querySelector('[data-hub-panel="research"]');
    expect(panel.firstElementChild).toBe(door());
    expect(panel.textContent.indexOf(COPY.research.door.work)).toBeLessThan(panel.textContent.indexOf(COPY.research.ideas));
  });

  it('an open investigation: "Research in progress · last update {time} · {n} findings" and Continue', async () => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-1')]);
    await render('mobile');
    await openResearchArea('mobile');
    const progress = document.querySelector('[data-hub-research-progress]');
    expect(progress.getAttribute('data-hub-research-progress')).toBe('sess-1');
    expect(progress.textContent).toContain('Research in progress · last update Nov 14, 9:40 AM ET · 4 findings');
    expect(continueButton().textContent).toBe(COPY.research.door.continue);
    expect(workButton()).not.toBeNull();
  });

  it('opened, not yet stepped (no lastTurnAt): the count alone', async () => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-1', { telemetry: { lastTurnAt: null } })]);
    await render('mobile');
    await openResearchArea('mobile');
    expect(document.querySelector('[data-hub-research-progress]').textContent).toContain('Research in progress · 4 findings');
  });

  it('nothing open: no line and no Continue — never "no research"; the door shows', async () => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-1', { state: 'completed', terminalReason: 'concluded', endedAt: iso(NOW - HOUR) })]);
    await render('mobile');
    await openResearchArea('mobile');
    expect(document.querySelector('[data-hub-research-progress]')).toBeNull();
    expect(continueButton()).toBeNull();
    expect(workButton()).not.toBeNull();
    expect(door().textContent).not.toMatch(/no research/i);
  });

  it('the read failed: "Couldn\'t check your research" with Retry, and the door stays; Retry reads once more', async () => {
    svc.fetchSharedResearchRecords.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([recordOf('sess-1')]);
    await render('mobile');
    await openResearchArea('mobile');
    const error = document.querySelector('[data-hub-research-door-error]');
    expect(error.textContent).toContain(COPY.research.door.error);
    expect(workButton()).not.toBeNull();
    click(byRole(error, 'button', COPY.research.retry)[0]);
    await flush();
    expect(svc.fetchSharedResearchRecords).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-hub-research-door-error]')).toBeNull();
    expect(document.querySelector('[data-hub-research-progress]')).not.toBeNull();
  });

  it('while the read is out: no line, and the door shows', async () => {
    svc.fetchSharedResearchRecords.mockReturnValue(new Promise(() => {}));
    await render('mobile');
    await openResearchArea('mobile');
    expect(door().getAttribute('data-hub-research-door')).toBe('loading');
    expect(document.querySelector('[data-hub-research-progress]')).toBeNull();
    expect(document.querySelector('[data-hub-research-door-error]')).toBeNull();
    expect(workButton()).not.toBeNull();
  });

  it('nothing announces: the door holds no live region', async () => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-1')]);
    await render('mobile');
    await openResearchArea('mobile');
    expect(door().querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });
});

describe('the sheet: each opener, its mode, focus, one overlay (amendment §3.2)', () => {
  beforeEach(() => { m.mode = 'on'; });

  it.each(['mobile', 'desktop'])('%s: "Work an idea" opens the start view with the selector\'s stories, the agent and gated false; Escape closes it and focus is back on "Work an idea"', async (site) => {
    await render(site);
    await openResearchArea(site);
    const opener = workButton();
    click(opener);
    await flush();
    expect(dialogs()).toHaveLength(1);
    expect(dialogs()[0].getAttribute('aria-label')).toBe(COPY.research.workLabel);
    expect(document.querySelector('[data-stub-body]').getAttribute('data-stub-body')).toBe('start');
    expect(body.props.stories).toEqual(selectStories({ stories: STORIES, nowMs: NOW }).items);
    expect(body.props.stories.map((s) => s.itemRef.recordId)).toEqual(['st_1']);
    expect(body.props).toMatchObject({ mode: 'start', sessionId: null, item: null, direction: null, agentName: 'Atlas', agentId: 'agent-a', gated: false, phone: site === 'mobile' });
    // one load per page: the body's lazy is module-scope, so a later row of this file finds it loaded already
    expect(svc.load.mock.calls.length).toBeLessThanOrEqual(1);
    press(dialogs()[0], 'Escape');
    await flush();
    expect(dialogs()).toHaveLength(0);
    expect(document.activeElement).toBe(opener);
  });

  it('Continue opens the open investigation (mode session, its id); closing returns focus to Continue', async () => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-1')]);
    await render('mobile');
    await openResearchArea('mobile');
    const opener = continueButton();
    click(opener);
    await flush();
    expect(body.props).toMatchObject({ mode: 'session', sessionId: 'sess-1' });
    click(dialogs()[0].querySelector('[data-hub-sheet-close]'));
    await flush();
    expect(dialogs()).toHaveLength(0);
    expect(document.activeElement).toBe(opener);
  });

  it('an Activity row opens its investigation (mode session); closing returns focus to the row', async () => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-2', { state: 'completed', terminalReason: 'saved_to_list', endedAt: iso(NOW - HOUR) })]);
    await render('desktop');
    const rows = activityRows();
    expect(rows.map((row) => row.textContent)).toEqual(expect.arrayContaining([expect.stringContaining(COPY.activity.ideaFromResearch), expect.stringContaining(COPY.activity.researchOpened)]));
    const opener = rows[0].closest('button');
    expect(opener.disabled).toBe(false);
    click(opener);
    await flush();
    expect(body.props).toMatchObject({ mode: 'session', sessionId: 'sess-2' });
    press(dialogs()[0], 'Escape');
    await flush();
    expect(document.activeElement).toBe(opener);
  });

  it('a game row still opens its game, and a research row never does', async () => {
    const hub = hubOf();
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-2')]);
    await render('desktop', hub);
    click(activityRows()[0].closest('button'));
    await flush();
    expect(hub.openGame).not.toHaveBeenCalled();
    press(dialogs()[0], 'Escape');
    await flush();
    const gameRow = [...document.querySelectorAll('[data-hub-activity-row="completed"]')][0].closest('button');
    click(gameRow);
    expect(hub.openGame).toHaveBeenCalledTimes(1);
    expect(hub.openGame.mock.calls[0][0].id).toBe('ab_done_1');
  });

  it('one overlay at a time: a research row inside the open activity sheet replaces it; the background is inert while the sheet is up, and live again after', async () => {
    svc.fetchSharedResearchRecords.mockResolvedValue(Array.from({ length: 6 }, (_, i) => recordOf(`sess-${i}`, { state: 'completed', terminalReason: 'concluded', createdAt: iso(NOW - (i + 2) * HOUR), endedAt: iso(NOW - (i + 1) * HOUR) })));
    const x = await render('desktop');
    const all = [...document.querySelectorAll('[data-hub-section="activity"] button')].find((el) => el.textContent.startsWith(COPY.activity.all(0).replace(/\d+$/, '')));
    expect(all).toBeTruthy();
    click(all);
    await flush();
    expect(dialogs()).toHaveLength(1);
    expect(dialogs()[0].getAttribute('aria-label')).toBe(COPY.activity.sheetLabel);
    click(dialogs()[0].querySelector('[data-hub-activity-row="research"]').closest('button'));
    await flush();
    expect(dialogs()).toHaveLength(1);
    expect(dialogs()[0].getAttribute('aria-label')).toBe(COPY.research.workLabel);
    expect(body.props.mode).toBe('session');
    expect(x.host.hasAttribute('inert')).toBe(true);
    press(dialogs()[0], 'Escape');
    await flush();
    expect(dialogs()).toHaveLength(0);
    expect(x.host.hasAttribute('inert')).toBe(false);
  });

  it('admission ending while the sheet is open closes it (as the Huddle\'s lapse does)', async () => {
    const x = await render('mobile');
    await openResearchArea('mobile');
    click(workButton());
    await flush();
    expect(dialogs()).toHaveLength(1);
    m.mode = 'off';
    x.rerender(<CommandCenterHub site="mobile" hub={hubOf()} />);
    await flush();
    expect(dialogs()).toHaveLength(0);
    expect(doorElements()).toEqual([]);
  });

  it('the stories read failing: the sheet opens with no stories ([]), never a stale or invented list', async () => {
    svc.fetchFeed.mockRejectedValue(new Error('feed down'));
    await render('mobile');
    await openResearchArea('mobile');
    click(workButton());
    await flush();
    expect(body.props.stories).toEqual([]);
  });
});

describe('equippedListLabel: the list as the Loadout card shows it (amendment §3.2, the props table)', () => {
  beforeEach(() => { m.mode = 'on'; });

  it('per-game loadouts on (main): the name of the BaggerBomb book, the same words the Loadout card shows', async () => {
    r.agent = { ...agentReady(), agent: { ...agentReady().agent, loadouts: { baggerbomb: { archetype: 'degen', book: { ref: { watchlistId: 'wl-1' }, name: 'Stored name', pin: null } } } } };
    r.lists = [{ watchlistId: 'wl-1', name: 'Grid builders', status: 'committed', tickers: [{ symbol: 'NVDA' }, { symbol: 'ETN' }] }];
    await render('mobile');
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    await flush();
    const card = document.querySelector('[data-loadout-card="baggerbomb"]');
    expect(card.textContent).toContain('Grid builders');
    await openResearchArea('mobile');
    click(workButton());
    await flush();
    expect(body.props.equippedListLabel).toBe('Grid builders');
  });

  it('no book equipped: null (the body then names no list to replace)', async () => {
    r.agent = { ...agentReady(), agent: { ...agentReady().agent, loadouts: { baggerbomb: { archetype: 'degen', book: { ref: null, name: null, pin: null } } } } };
    await render('mobile');
    await openResearchArea('mobile');
    click(workButton());
    await flush();
    expect(body.props.equippedListLabel).toBeNull();
  });
});

// ── The review's rows (docs/audits build report §8): each pins a fix or closes a gap the refuters confirmed ──────────────────
const allActivityLink = () => [...document.querySelectorAll('[data-hub-section="activity"] button')].find((el) => el.textContent.startsWith(COPY.activity.all(0).replace(/\d+$/, '')));
const concluded = (n) => Array.from({ length: n }, (_, i) => recordOf(`sess-${i}`, { state: 'completed', terminalReason: 'concluded', createdAt: iso(NOW - (i + 2) * HOUR), endedAt: iso(NOW - (i + 1) * HOUR) }));

describe('review rows: the lapse, the owner change, every opener at both sites, focus', () => {
  beforeEach(() => { m.mode = 'on'; });

  it.each(['mobile', 'desktop'])('%s (A3, B1): admission ending frees the sheet slot — when admission returns the sheet does NOT reopen without a tap', async (site) => {
    const x = await render(site);
    await openResearchArea(site);
    click(workButton());
    await flush();
    expect(dialogs()).toHaveLength(1);
    m.mode = 'off';
    x.rerender(<CommandCenterHub site={site} hub={hubOf()} />);
    await flush();
    expect(dialogs()).toHaveLength(0);
    m.mode = 'on';
    x.rerender(<CommandCenterHub site={site} hub={hubOf()} />);
    await flush();
    expect(dialogs()).toHaveLength(0);
  });

  it.each(['mobile', 'desktop'])('%s (B3): an owner change closes a sheet opened on the former owner\'s investigation, and it stays closed', async (site) => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-A')]);
    const x = await render(site);
    await openResearchArea(site);
    click(continueButton());
    await flush();
    expect(body.props).toMatchObject({ mode: 'session', sessionId: 'sess-A' });
    r.identity = { resolved: true, uid: 'uid-B', authEpoch: 3 };
    x.rerender(<CommandCenterHub site={site} hub={hubOf()} />);
    await flush();
    expect(dialogs()).toHaveLength(0);
    // the door is still there for the new owner (mode 'on'), and nothing reopened on its own
    x.rerender(<CommandCenterHub site={site} hub={hubOf()} />);
    await flush();
    expect(dialogs()).toHaveLength(0);
  });

  it.each(['mobile', 'desktop'])('%s (B5): with an investigation open, "Work an idea" still opens the start view, never the open investigation', async (site) => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-1')]);
    await render(site);
    await openResearchArea(site);
    expect(continueButton()).not.toBeNull();
    click(workButton());
    await flush();
    expect(body.props).toMatchObject({ mode: 'start', sessionId: null });
  });

  it.each(['mobile', 'desktop'])('%s (B6): Continue opens its investigation and focus returns to it', async (site) => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-1')]);
    await render(site);
    await openResearchArea(site);
    const opener = continueButton();
    click(opener);
    await flush();
    expect(body.props).toMatchObject({ mode: 'session', sessionId: 'sess-1' });
    press(dialogs()[0], 'Escape');
    await flush();
    expect(document.activeElement).toBe(opener);
  });

  it.each(['mobile', 'desktop'])('%s (B6, C3): the door\'s Retry reads again; while it is out focus is on "Work an idea", so the row leaving drops nothing', async (site) => {
    let answer;
    svc.fetchSharedResearchRecords.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    await render(site);
    await openResearchArea(site);
    const retry = byRole(document.querySelector('[data-hub-research-door-error]'), 'button', COPY.research.retry)[0];
    retry.focus();
    click(retry);
    expect(document.activeElement).toBe(workButton());
    await act(async () => { answer([recordOf('sess-1')]); });
    await flush();
    expect(svc.fetchSharedResearchRecords).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-hub-research-door-error]')).toBeNull();
    expect(document.activeElement).toBe(workButton());
  });

  it.each(['mobile', 'desktop'])('%s (B6): a research Activity row opens its investigation, and focus returns to the row', async (site) => {
    svc.fetchSharedResearchRecords.mockResolvedValue([recordOf('sess-7', { createdAt: iso(NOW - 10 * 60000) })]);
    await render(site);
    const row = activityRows()[0].closest('button');
    click(row);
    await flush();
    expect(body.props).toMatchObject({ mode: 'session', sessionId: 'sess-7' });
    press(dialogs()[0], 'Escape');
    await flush();
    expect(document.activeElement).toBe(row);
  });

  it.each(['mobile', 'desktop'])('%s (C1): a research row pressed inside the open activity sheet: on close focus returns to "All activity", which opened that sheet', async (site) => {
    svc.fetchSharedResearchRecords.mockResolvedValue(concluded(6));
    await render(site);
    const all = allActivityLink();
    expect(all).toBeTruthy();
    click(all);
    await flush();
    click(dialogs()[0].querySelector('[data-hub-activity-row="research"]').closest('button'));
    await flush();
    expect(dialogs()[0].getAttribute('aria-label')).toBe(COPY.research.workLabel);
    press(dialogs()[0], 'Escape');
    await flush();
    expect(dialogs()).toHaveLength(0);
    expect(document.activeElement).toBe(all);
  });
});
