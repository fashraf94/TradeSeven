// @vitest-environment jsdom
//
// Command Center hub, slice S6 (rulings R-S6-1 … R-S6-7; spec V1.2 §8.1, §8.2, §11.3 "Research") — the CONNECTED hub's Research
// panel, the idea labels, "Deploying with", the honest line and Activity's idea rows. The readers' I/O is driven here (identity, the
// owner-tagged agent, the ten-game window, the lists service and the idea service); the hub, its reader of the idea
// (hub/useHubResearch.js) and its sections are the real ones. The four shipped sheets are recording stand-ins, as in the S5 suite.
//
// The pure derivations are pinned in hub/researchView.test.js and activityRows.idea.test.js, the reader in
// hub/useHubResearch.jsdom.test.jsx; these rows prove the wiring: what a player sees for each state, that the labels follow
// the reader and nothing else, that the Deploy card and the Loadout card cannot disagree, and that nothing here writes.

import React, { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
const r = vi.hoisted(() => ({
  identity: { resolved: true, uid: 'uid-A', authEpoch: 2 },
  agent: null,
  window: null,
  market: { state: 'OPEN', isOpen: true },
  lists: [],
  recordsOn: true,
}));
// The idea service: the reader, and every writer of it as a spy that must never be called from the hub.
const svc = vi.hoisted(() => ({
  listHypothesisVersions: vi.fn(),
  createHypothesisVersion: vi.fn(),
  transitionHypothesis: vi.fn(),
  reaffirmHypothesis: vi.fn(),
  getHypothesisReview: vi.fn(),
  newOpId: vi.fn(),
}));
const agentWrites = vi.hoisted(() => ({ equipWatchlist: vi.fn(), unequipWatchlist: vi.fn(), changeArchetype: vi.fn() }));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => r.identity }));
vi.mock('../../hooks/useAgent', () => ({ default: () => r.agent }));
vi.mock('./hub/useHubCompletedBattles', () => ({ default: () => r.window }));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => r.market }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => r.lists }));
vi.mock('../../services/hypothesisVersionService', () => svc);
vi.mock('../../services/agentService', () => agentWrites);
vi.mock('../../hooks/useMasteryProfile', () => ({ default: () => null }));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({ default: function useDailyRegimeBrief() { return { dailyBrief: null, forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} }; } }));
vi.mock('./hub/hubFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, hubFlags: () => ({ ...actual.hubFlags(), hypothesisRecordsOn: r.recordsOn, characterTab: true }) };
});
vi.mock('../Dashboard/AgentRecordSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).AgentRecordSheetStub }));
vi.mock('../Dashboard/ArchetypePicker', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).ArchetypePickerStub }));
vi.mock('../Dashboard/EquipSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).EquipSheetStub }));
vi.mock('../Dashboard/TraitsSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).TraitsSheetStub }));

import CommandCenterHub, { areaSummaries } from './CommandCenterHub';
import { FORGE_AREAS, FORGE_RETURN } from './hubChrome';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { resetSeen, seen } from './__fixtures__/legacySheetStubs';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 23, 15, 0);
const UID = 'uid-A';
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3600 * 1000;
const T = { created: Date.UTC(2026, 9, 22, 14, 0), state: Date.UTC(2026, 9, 22, 16, 30) };

const done = (n) => {
  const completed = Date.UTC(2026, 9, 22 - n, 20, 5);
  return {
    id: `done_${String(n).padStart(2, '0')}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
    activatedAt: iso(completed - 6 * HOUR), completedAt: iso(completed),
    scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: iso(completed - 120000) },
    statusFeed: [{ action: 'battle_complete' }],
  };
};
const TEN = Array.from({ length: 10 }, (_, i) => done(i + 1));
const windowOf = (battles, over = {}) => ({
  battles, status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1,
  reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, carried: false, refresh: vi.fn(), ...over,
});
const agentReady = (agent = {}, over = {}) => ({
  status: 'ready',
  agent: { id: 'agent-a', ownerId: UID, archetype: 'degen', stats: { gamesPlayed: 3 }, equippedWatchlistId: 'wl-1', equippedWatchlistName: 'Tech Leaders', ...agent },
  ownerUid: UID, ownerEpoch: 2, readError: null, retry: vi.fn(), ...over,
});
const pollMeta = () => ({ epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false });
const hubOf = (over = {}) => ({
  activeBattles: [], activePoll: pollMeta(), refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn(), onOpenForge: vi.fn(), setScreen: vi.fn(), ...over,
});

const LIST = (over = {}) => ({ watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: [{ symbol: 'NVDA' }, { symbol: 'AAPL' }, { symbol: 'MSFT' }], currentHypothesisVersion: 1, thesis: '', ...over });
const V = (n, over = {}) => ({
  version: n, statement: `Idea v${n}: semis lead for ten sessions.`, status: 'draft', horizonEnum: 'swing', createdAt: iso(T.created), stateChangedAt: iso(T.state), ...over,
});
const BODY = (over = {}) => ({ watchlistId: 'wl-1', currentVersion: 1, versions: [V(1)], research: [], ...over });
const SIGNALDROP = { researchWorkId: 'rw_a', watchlistId: 'wl-1', origin: 'signaldrop', completions: 3, state: 'closed', stages: { shortlisted: 25, eligible: 10 } };
const SCREENER = { researchWorkId: 'rw_b', watchlistId: 'wl-1', origin: 'screener', completions: 2, state: 'closed', stages: { universeSize: 500, matchedPreLimit: 37, shortlisted: 25, eligible: 20 } };
const ANALYSIS = { researchWorkId: 'rw_c', watchlistId: 'wl-1', origin: 'analysis', completions: 1, state: 'open', stages: { selectedForInvestigation: 8, investigationsCompleted: 6 } };

let layout;
let removeTokens;
let removeNav;
let mounted = [];
let errorSpy;

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  sessionStorage.clear();
  for (const fn of Object.values(svc)) fn.mockReset();
  for (const fn of Object.values(agentWrites)) fn.mockReset();
  svc.listHypothesisVersions.mockImplementation(async () => BODY());
  r.identity = { resolved: true, uid: UID, authEpoch: 2 };
  r.agent = agentReady();
  r.window = windowOf(TEN);
  r.market = { state: 'OPEN', isOpen: true };
  r.lists = [LIST()];
  r.recordsOn = true;
  resetSeen();
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  // The hub writes no idea and no equip: none of the writers was called, whatever the row did.
  for (const name of ['createHypothesisVersion', 'transitionHypothesis', 'reaffirmHypothesis', 'getHypothesisReview', 'newOpId']) expect(svc[name], name).not.toHaveBeenCalled();
  for (const name of ['equipWatchlist', 'unequipWatchlist', 'changeArchetype']) expect(agentWrites[name], name).not.toHaveBeenCalled();
  for (const m of mounted) m.unmount();
  mounted = [];
  sessionStorage.clear();
  removeNav();
  layout.restore();
  errorSpy.mockRestore();
  vi.useRealTimers();
});

const flush = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });

async function renderHub(site, { hub = hubOf(), tab = null } = {}) {
  layout.state.hubWidth = site === 'mobile' ? 390 : 1216;
  const m = mount(<CommandCenterHub site={site} hub={hub} />);
  mounted.push(m);
  await flush();
  if (site === 'mobile' && tab) click(byRole(document, 'tab', tab)[0]);
  return { m, hub };
}
const phoneResearch = (hub = hubOf()) => renderHub('mobile', { hub, tab: COPY.phoneTabs.research });
const panel = () => document.querySelector('[data-hub-panel="research"]');
const panelText = () => panel()?.textContent ?? '';
const statusOf = () => panel()?.getAttribute('data-hub-status-of');
const forgeButton = () => byRole(panel(), 'button', COPY.research.openForge)[0] ?? byRole(panel(), 'button', COPY.research.reviewInForge)[0] ?? null;
const retryButton = () => byRole(panel(), 'button', COPY.research.retry)[0] ?? null;
const watchlistCard = () => document.querySelector('[data-hub-card="watchlist"]');
const deployLine = () => document.querySelector('[data-hub-deploying-with]');
const honest = () => document.querySelector('[data-hub-honest-line]');
const activitySection = () => document.querySelector('[data-hub-section="activity"]');
const activityText = () => activitySection()?.textContent ?? '';

describe('the Research panel, one row per state of spec §8.1\'s table (ruling R-S6-3)', () => {
  it('client gate off: "Research records aren\'t part of this release", ZERO requests, and no Forge action', async () => {
    r.recordsOn = false;
    await phoneResearch();
    expect(statusOf()).toBe('gate_off');
    expect(panelText()).toContain("Research records aren't part of this release");
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
    expect(forgeButton()).toBeNull();
    expect(retryButton()).toBeNull();
  });

  it('typed disabled: "Research records aren\'t available on this account" — not "no idea", not a zero count', async () => {
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('off'), { status: 404, code: 'disabled' }));
    await phoneResearch();
    expect(statusOf()).toBe('disabled');
    expect(panelText()).toContain("Research records aren't available on this account");
    expect(panelText()).not.toMatch(/No idea yet|0 ideas|1 idea/);
    expect(forgeButton()).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('loading: the read still out — the loading line, and no idea', async () => {
    svc.listHypothesisVersions.mockReturnValue(new Promise(() => {}));
    await phoneResearch();
    expect(statusOf()).toBe('loading');
    expect(panelText()).toContain(COPY.research.loading);
    expect(panelText()).not.toContain('Idea v1');
  });

  it('loading: the agent unresolved — nothing is asked yet', async () => {
    r.agent = { status: 'loading', agent: null, ownerUid: null, ownerEpoch: null, readError: null, retry: vi.fn() };
    await phoneResearch();
    expect(statusOf()).toBe('loading');
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
  });

  it('no equipped list: "Equip a watchlist in the Forge to see its idea here" and a Forge Lists action that works', async () => {
    r.agent = agentReady({ equippedWatchlistId: null, equippedWatchlistName: null });
    const { hub } = await phoneResearch();
    expect(statusOf()).toBe('no_list');
    expect(panelText()).toContain('Equip a watchlist in the Forge to see its idea here');
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
    click(forgeButton());
    expect(hub.onOpenForge).toHaveBeenCalledTimes(1);
    expect(hub.onOpenForge).toHaveBeenCalledWith({ area: FORGE_AREAS.LISTS, returnTo: FORGE_RETURN.DASHBOARD });
  });

  it('no current idea (currentVersion 0): "No idea yet on {list}" and "Open in the Forge"', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 0, versions: [] }));
    r.lists = [LIST({ currentHypothesisVersion: undefined })];
    const { hub } = await phoneResearch();
    expect(statusOf()).toBe('no_idea');
    expect(panelText()).toContain('No idea yet on Tech Leaders');
    click(forgeButton());
    expect(hub.onOpenForge).toHaveBeenCalledWith({ area: FORGE_AREAS.LISTS, returnTo: FORGE_RETURN.DASHBOARD });
  });

  it('a positive pointer with no matching version: unavailable, with Retry and the Forge — and no other version is shown', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 5, versions: [V(4), V(3)] }));
    await phoneResearch();
    expect(statusOf()).toBe('unavailable');
    expect(panelText()).toContain("The saved idea for Tech Leaders isn't available");
    expect(panelText()).not.toMatch(/Idea v[34]/);
    expect(forgeButton()).not.toBeNull();
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 4, versions: [V(4), V(3)] }));
    click(retryButton());
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
    expect(statusOf()).toBe('ready');
    expect(panelText()).toContain('Idea v4');
  });

  it('a Retry over an unavailable pointer refused inside the wait says when the next opens (the link is drawn in that state too)', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 5, versions: [V(4)] }));
    await phoneResearch();
    expect(statusOf()).toBe('unavailable');
    click(retryButton());
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
    vi.setSystemTime(NOW + 5_000);
    click(retryButton());
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
    expect(panelText()).toMatch(/You can try again at \d{1,2}:\d{2}\s?[AP]M ET/);
  });

  it('a request error: "Couldn\'t load your idea · Retry"', async () => {
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    await phoneResearch();
    expect(statusOf()).toBe('error');
    expect(panelText()).toContain("Couldn't load your idea");
    expect(retryButton()).not.toBeNull();
    expect(panelText()).not.toMatch(/No idea yet/);
  });

  it('Retry is one per 30 s: the second press inside the wait reads nothing and says when the next opens', async () => {
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    await phoneResearch();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
    click(retryButton());
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
    vi.setSystemTime(NOW + 10_000);
    click(retryButton());
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
    expect(panel().querySelector('[data-hub-research-wait]')).not.toBeNull();
    expect(panelText()).toMatch(/You can try again at \d{1,2}:\d{2}\s?[AP]M ET/);
    vi.setSystemTime(NOW + 31_000);
    svc.listHypothesisVersions.mockResolvedValue(BODY());
    click(retryButton());
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(3);
    expect(statusOf()).toBe('ready');
    expect(panel().querySelector('[data-hub-research-wait]')).toBeNull();
  });

  it('a current idea: the exact statement, the Forge\'s status word, the version, the time-frame, the recorded times, "1 idea on {list}"', async () => {
    const statement = '  Semis lead for ten sessions.\nWatch NVDA first.  ';
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { statement, status: 'ready' })] }));
    await phoneResearch();
    expect(statusOf()).toBe('ready');
    expect(panel().querySelector('[data-hub-idea-statement]').textContent).toBe(statement);
    const text = panelText();
    expect(text).toContain('Ready');
    expect(text).toContain('Version 1');
    expect(text).toContain('Swing, 10 trading sessions');
    expect(text).toContain('Saved Oct 22, 2026');
    expect(text).toContain('Status since Oct 22, 2026');
    expect(panel().querySelector('[data-hub-idea-count]').textContent).toBe('1 idea on Tech Leaders');
  });

  it('four versions of one idea are ONE idea: the pointer\'s version, "1 idea on {list}", nothing of the others', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({
      currentVersion: 3, versions: [V(4, { status: 'draft' }), V(3, { status: 'ready' }), V(2, { status: 'retired' }), V(1, { status: 'rejected' })],
    }));
    await phoneResearch();
    expect(panel().querySelector('[data-hub-idea-statement]').textContent).toBe('Idea v3: semis lead for ten sessions.');
    expect(panelText()).toContain('1 idea on Tech Leaders');
    expect(panelText()).not.toMatch(/Idea v[124]|[2-4] ideas/);
  });

  it('at most two recorded research lines', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ research: [ANALYSIS, SIGNALDROP, SCREENER] }));
    await phoneResearch();
    const lines = [...panel().querySelectorAll('[data-hub-idea-research] li')];
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toBe('Researched with your agent: 25 candidates · 10 kept');
    svc.listHypothesisVersions.mockResolvedValue(BODY({ research: [] }));
    unmountAll();
    await phoneResearch();
    expect(panel().querySelector('[data-hub-idea-research]')).toBeNull();
  });

  it('review due: the Forge\'s due copy with the frozen list, the Forge review door, and no verb of change anywhere in the panel', async () => {
    const due = V(1, { status: 'review_due', stateReason: 'horizon_elapsed', firstDeployedAt: iso(T.created), activation: [], invalidation: [] });
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [due], deployedLists: { 1: { battleId: 'b1', name: 'Tech Leaders', tickers: ['NVDA'] } } }));
    const { hub } = await phoneResearch();
    expect(panel().querySelector('[data-hub-idea-due]').textContent).toContain('Your NVDA idea reached its time-frame (Swing, 10 trading sessions).');
    expect(panelText()).toContain('Review due');
    expect(byRole(panel(), 'button', COPY.research.reviewInForge)).toHaveLength(1);
    // The hub offers no transition: every control in the panel is the Forge door (and the Retry of a failed read).
    const labels = [...panel().querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual([COPY.research.reviewInForge]);
    click(forgeButton());
    expect(hub.onOpenForge).toHaveBeenCalledWith({ area: FORGE_AREAS.LISTS, returnTo: FORGE_RETURN.DASHBOARD });
  });

  it('a failed refresh keeps only this owner\'s and list\'s idea, with its age and a Retry', async () => {
    const { hub } = await phoneResearch();
    expect(statusOf()).toBe('ready');
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    // The watchlist sheet\'s return reads the idea once more.
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    expect(statusOf()).toBe('ready');
    expect(panel().querySelector('[data-hub-research-stale]')).not.toBeNull();
    expect(panelText()).toContain('Idea v1');
    expect(panelText()).toMatch(/As of \d{1,2}:\d{2}\s?[AP]M ET · couldn.t refresh/);
    expect(retryButton()).not.toBeNull();
    expect(hub.onOpenForge).not.toHaveBeenCalled();
  });

  it('a Retry over a kept answer shows that it is being read, and a refused press\'s note goes with the wait', async () => {
    await phoneResearch();
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    expect(panel().querySelector('[data-hub-research-stale]')).not.toBeNull();
    // The first Retry (the wait opens at the press) is read; a second inside it is refused with a note.
    svc.listHypothesisVersions.mockReturnValue(new Promise(() => {}));
    click(retryButton());
    await flush();
    expect(panel().querySelector('[data-hub-research-stale] [data-hub-loading]')).not.toBeNull();
    expect(retryButton()).toBeNull();
    expect(panelText()).toContain('Idea v1');
  });

  it('a refused press says when the next Retry opens only while that wait stands', async () => {
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    await phoneResearch();
    click(retryButton());
    await flush();
    vi.setSystemTime(NOW + 10_000);
    click(retryButton());
    await flush();
    expect(panel().querySelector('[data-hub-research-wait]')).not.toBeNull();
    // The wait has ended; nothing has re-read since, so the note must not outlive it on a re-render.
    vi.setSystemTime(NOW + 40_000);
    act(() => { window.dispatchEvent(new Event('resize')); });
    click(byRole(document, 'tab', COPY.phoneTabs.overview)[0]);
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    expect(panel().querySelector('[data-hub-research-wait]')).toBeNull();
    expect(retryButton()).not.toBeNull();
  });

  it('the list changing clears the idea at once: the new list\'s read is out, and the old list\'s idea is gone', async () => {
    const { m } = await phoneResearch();
    expect(panelText()).toContain('Idea v1');
    svc.listHypothesisVersions.mockReturnValue(new Promise(() => {}));
    r.lists = [LIST(), LIST({ watchlistId: 'wl-2', name: 'Defensives', currentHypothesisVersion: undefined })];
    r.agent = agentReady({ equippedWatchlistId: 'wl-2', equippedWatchlistName: 'Defensives' });
    act(() => { m.rerender(<CommandCenterHub site="mobile" hub={hubOf()} />); });
    await flush();
    expect(statusOf()).toBe('loading');
    expect(panelText()).not.toContain('Idea v1');
    expect(svc.listHypothesisVersions).toHaveBeenLastCalledWith('wl-2');
  });

  it('the stage\'s area summary says each state in a line of its own (the loading words only while it loads)', async () => {
    const summary = (research) => areaSummaries({ loadout: { status: 'loading' }, research })[1];
    expect(summary({ status: 'loading' })).toBe(COPY.research.summaryLoading);
    expect(summary(undefined)).toBe(COPY.research.summaryLoading);
    expect(summary({ status: 'ready', summary: 'Ready' })).toBe('Ready');
    for (const [status, line] of [['gate_off', COPY.research.summary.gateOff], ['disabled', COPY.research.summary.disabled], ['no_list', COPY.research.summary.noList], ['no_idea', COPY.research.summary.noIdea], ['error', COPY.research.summary.error]]) {
      expect(summary({ status, summary: line }), status).toBe(line);
    }
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 0, versions: [] }));
    await phoneResearch();
    expect(document.body.textContent).toContain(COPY.research.summary.noIdea);
  });
});

function unmountAll() {
  for (const m of mounted) m.unmount();
  mounted = [];
}

describe('the idea labels follow the reader (ruling R-S6-4)', () => {
  const label = async (site = 'mobile') => {
    await renderHub(site, { tab: COPY.phoneTabs.loadout });
    return watchlistCard().textContent;
  };
  const wears = (text, word) => text.includes(word);

  it('an admitted player (the reader answered) sees "Universe · N names" for a list with an idea', async () => {
    const text = await label();
    expect(wears(text, 'Universe · 3 names')).toBe(true);
    expect(wears(text, COPY.loadout.plainList)).toBe(false);
  });

  it('...and "Plain watchlist · no idea yet" for one without', async () => {
    r.lists = [LIST({ currentHypothesisVersion: undefined })];
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 0, versions: [] }));
    expect(wears(await label(), COPY.loadout.plainList)).toBe(true);
  });

  it('not admitted (the typed disabled answer): the neutral "N names", never an idea word', async () => {
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('off'), { status: 404, code: 'disabled' }));
    const text = await label();
    expect(wears(text, '3 names')).toBe(true);
    expect(text).not.toMatch(/Universe|Plain watchlist/);
  });

  it('the client gate off: the neutral label, and not one request', async () => {
    r.recordsOn = false;
    const text = await label();
    expect(text).not.toMatch(/Universe|Plain watchlist/);
    expect(wears(text, '3 names')).toBe(true);
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
  });

  it('while the reader is out, and when it fails with nothing held: the neutral label (unknown is never admitted)', async () => {
    svc.listHypothesisVersions.mockReturnValue(new Promise(() => {}));
    expect(await label()).not.toMatch(/Universe|Plain watchlist/);
    unmountAll();
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    expect(await label()).not.toMatch(/Universe|Plain watchlist/);
  });

  it('S5\'s `hub.ideaAccess` seam stands only while the reader holds nothing: the reader\'s answer wins over it, either way', async () => {
    // The reader answered (admitted): a hub that says not_admitted does not override it.
    await renderHub('mobile', { hub: hubOf({ ideaAccess: 'not_admitted' }), tab: COPY.phoneTabs.loadout });
    expect(watchlistCard().textContent).toContain('Universe · 3 names');
    unmountAll();
    // The reader answered (not admitted): a hub that says admitted does not override it.
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('off'), { status: 404, code: 'disabled' }));
    await renderHub('mobile', { hub: hubOf({ ideaAccess: 'admitted' }), tab: COPY.phoneTabs.loadout });
    expect(watchlistCard().textContent).not.toMatch(/Universe|Plain watchlist/);
    unmountAll();
    // The reader holds nothing yet: the seam stands.
    svc.listHypothesisVersions.mockReturnValue(new Promise(() => {}));
    await renderHub('mobile', { hub: hubOf({ ideaAccess: 'admitted' }), tab: COPY.phoneTabs.loadout });
    expect(watchlistCard().textContent).toContain('Universe · 3 names');
  });

  it('a refresh in flight keeps the label; one that FAILED takes it back to the neutral words (error → unknown, as ruled), and a good one returns it', async () => {
    await renderHub('mobile', { tab: COPY.phoneTabs.loadout });
    expect(watchlistCard().textContent).toContain('Universe · 3 names');
    let finish;
    svc.listHypothesisVersions.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    expect(watchlistCard().textContent, 'while the read is out').toContain('Universe · 3 names');
    await act(async () => { finish(BODY()); await Promise.resolve(); await Promise.resolve(); });
    await flush();
    expect(watchlistCard().textContent).toContain('Universe · 3 names');
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    expect(watchlistCard().textContent).not.toMatch(/Universe|Plain watchlist/);
    expect(watchlistCard().textContent).toContain('3 names');
  });
});

describe('"Deploying with" on the Deploy card (ruling R-S6-5)', () => {
  const text = () => deployLine()?.textContent ?? null;

  it('the newest version ready or activated: "Deploying with: {statement} · N names" — on the desktop card and on the phone\'s Loadout tab', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'ready' })] }));
    await renderHub('desktop');
    expect(text()).toBe('Deploying with: Idea v1: semis lead for ten sessions. · 3 names');
    unmountAll();
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 2, versions: [V(2, { status: 'activated' }), V(1, { status: 'retired' })] }));
    await renderHub('mobile', { tab: COPY.phoneTabs.loadout });
    expect(document.querySelector('[data-hub-deploy-card="phone"] [data-hub-deploying-with]').textContent).toBe('Deploying with: Idea v2: semis lead for ten sessions. · 3 names');
  });

  it.each(['draft', 'researched', 'waiting_for_evidence', 'review_due', 'retired'])('the newest version %s: no line', async (status) => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status })] }));
    await renderHub('desktop');
    expect(deployLine()).toBeNull();
    expect(document.body.textContent).not.toContain('Deploying with');
  });

  it('no deployed version is review_due (R-S6-5 to the letter): none shows a line — a reaffirmed idea too, though the server carries its newer ready version (Q-S6-2)', async () => {
    const due = V(1, { status: 'review_due', firstDeployedAt: iso(T.created) });
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 2, versions: [V(2, { status: 'ready' }), due] }));
    await renderHub('desktop');
    expect(deployLine()).toBeNull();
    unmountAll();
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 2, versions: [V(2, { status: 'review_due', firstDeployedAt: iso(T.created) }), V(1, { status: 'ready' })] }));
    await renderHub('desktop');
    expect(deployLine()).toBeNull();
  });

  it('not admitted, or the gate off: no line', async () => {
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('off'), { code: 'disabled' }));
    await renderHub('desktop');
    expect(deployLine()).toBeNull();
    unmountAll();
    r.recordsOn = false;
    await renderHub('desktop');
    expect(deployLine()).toBeNull();
  });

  it('N is the Loadout card\'s own count, each name once: the two cards cannot disagree', async () => {
    r.lists = [LIST({ tickers: [{ symbol: 'NVDA' }, { symbol: 'NVDA' }, { symbol: 'AAPL' }, { ticker: 'AAPL' }, { symbol: 'MSFT' }] })];
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'ready' })] }));
    await renderHub('mobile', { tab: COPY.phoneTabs.loadout });
    expect(watchlistCard().textContent).toContain('Universe · 3 names');
    expect(deployLine().textContent.endsWith(' · 3 names')).toBe(true);
  });

  it('only for a list the Loadout card has found and that holds a name: not for an unavailable list, an empty one, or while the lists load', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'ready' })] }));
    r.lists = [];
    await renderHub('desktop');
    expect(deployLine()).toBeNull();
    unmountAll();
    r.lists = [LIST({ tickers: [] })];
    await renderHub('desktop');
    expect(deployLine()).toBeNull();
  });

  it('a failed refresh does not assert it: the line goes with the answer\'s freshness', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'ready' })] }));
    await renderHub('mobile', { tab: COPY.phoneTabs.loadout });
    expect(deployLine()).not.toBeNull();
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    expect(deployLine()).toBeNull();
  });
});

describe('"Deploying with": where the card can start a deploy, and where the deploy would carry it', () => {
  it('drawn beside a deploy that can be started; not beside one that cannot (checking, no agent, a game already running)', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'ready' })] }));
    await renderHub('desktop');
    expect(deployLine()).not.toBeNull();
    unmountAll();
    // A live game: the card says it is running, and the running battle froze its own version — the line would name the wrong one.
    const live = { id: 'bb_live', ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: iso(NOW - 2 * HOUR), expiresAt: iso(NOW + 3 * HOUR), scoreState: { currentScore: 1, tradeCount: 0, evaluationCount: 1 } };
    await renderHub('desktop', { hub: hubOf({ activeBattles: [live] }) });
    expect(document.querySelector('[data-hub-deploy]').getAttribute('data-hub-deploy')).not.toMatch(/^ready/);
    expect(deployLine()).toBeNull();
  });

  it('an activated idea whose recorded review time has passed is not shown (the deploy judges it due and carries nothing); a later one is', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'activated', reviewDueAt: iso(NOW - 60_000) })] }));
    await renderHub('desktop');
    expect(deployLine()).toBeNull();
    unmountAll();
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'activated', reviewDueAt: iso(NOW + 3 * HOUR) })] }));
    await renderHub('desktop');
    expect(deployLine()).not.toBeNull();
  });

  it('a list whose names the deploy drops (none passes the server\'s filter) is handed to the agent as nothing: no line, no honest line', async () => {
    r.lists = [LIST({ tickers: [{ symbol: '^GSPC' }, { symbol: 'BRK/B' }] })];
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'ready' })] }));
    await renderHub('desktop');
    expect(deployLine()).toBeNull();
    unmountAll();
    await phoneResearch();
    expect(statusOf()).toBe('ready');
    expect(honest()).toBeNull();
  });
});

describe('the label and the panel say the same pointer (BUILD_RULES §9, review D-3)', () => {
  const cardText = async () => {
    await renderHub('mobile', { tab: COPY.phoneTabs.loadout });
    return watchlistCard().textContent;
  };

  it('the list document lags the reader: no pointer on the document, an idea on the reader → "Universe"; the reverse → "Plain"', async () => {
    r.lists = [LIST({ currentHypothesisVersion: undefined })];
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'ready' })] }));
    expect(await cardText()).toContain('Universe · 3 names');
    unmountAll();
    r.lists = [LIST({ currentHypothesisVersion: 3 })];
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 0, versions: [] }));
    const text = await cardText();
    expect(text).toContain(COPY.loadout.plainList);
    expect(text).not.toContain('Universe');
  });

  it('while the reader holds nothing the document\'s pointer stands (S5)', async () => {
    r.lists = [LIST({ currentHypothesisVersion: 2 })];
    svc.listHypothesisVersions.mockReturnValue(new Promise(() => {}));
    expect(await cardText()).not.toMatch(/Universe|Plain watchlist/);
  });
});

describe('an equipped list the committed lists do not hold (review D-2)', () => {
  it('the route answers not_found: the panel says there is no usable list — no "Couldn\'t load" and no Retry that could never work — and Activity is not an error', async () => {
    r.lists = [];
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('nf'), { status: 404, code: 'not_found' }));
    r.window = windowOf([]);
    r.agent = agentReady({ equippedAt: undefined });
    await phoneResearch();
    expect(statusOf()).toBe('no_list');
    expect(panelText()).not.toContain("Couldn't load your idea");
    expect(retryButton()).toBeNull();
    unmountAll();
    await renderHub('desktop');
    expect(activityText()).toContain(COPY.activity.empty);
    expect(activityText()).not.toContain(COPY.activity.unavailable);
  });
});

describe('a kept answer says how old it is in every state it can be kept in (review H-1)', () => {
  it('"No idea yet" kept through a failed refresh carries the as-of note and its Retry, as a kept idea does', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 0, versions: [] }));
    await phoneResearch();
    expect(statusOf()).toBe('no_idea');
    expect(panel().querySelector('[data-hub-research-stale]')).toBeNull();
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    expect(statusOf()).toBe('no_idea');
    expect(panelText()).toMatch(/As of \d{1,2}:\d{2}\s?[AP]M ET · couldn.t refresh/);
    expect(retryButton()).not.toBeNull();
  });

  it('so does an unavailable pointer', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 5, versions: [V(4)] }));
    await phoneResearch();
    expect(statusOf()).toBe('unavailable');
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    expect(panelText()).toMatch(/As of \d{1,2}:\d{2}\s?[AP]M ET · couldn.t refresh/);
  });
});

describe('the honest line (ruling R-S6-6): one wording per case, under the idea, and nowhere else', () => {
  const STATEMENT = 'Semis lead for ten sessions.';
  const withThesis = async (thesis, statement = STATEMENT) => {
    r.lists = [LIST({ thesis })];
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { statement, status: 'ready' })] }));
    await phoneResearch();
    return honest();
  };

  it('(a) the list\'s thesis is the idea\'s current statement', async () => {
    const line = await withThesis(STATEMENT);
    expect(line.getAttribute('data-hub-honest-line')).toBe('thesis_is_idea');
    expect(line.textContent).toBe("Your agent gives this list's names priority and reads the idea as the list's thesis. It doesn't learn from your ideas or their reviews yet.");
  });

  it('(b) the thesis is what the list was saved with, not a later version of the idea', async () => {
    const line = await withThesis('The text the list was saved with.');
    expect(line.getAttribute('data-hub-honest-line')).toBe('thesis_saved');
    expect(line.textContent).toBe("Your agent gives this list's names priority and reads the thesis the list was saved with, not later versions of your idea. It doesn't learn from your ideas or their reviews yet.");
  });

  it('(c) the list has no thesis', async () => {
    const line = await withThesis('');
    expect(line.getAttribute('data-hub-honest-line')).toBe('no_thesis');
    expect(line.textContent).toBe("Your agent gives this list's names priority. It doesn't read or learn from your ideas yet.");
  });

  it('an idea longer than the prompt\'s 200 characters is not "read as the thesis" whole: the same long text on both sides is (b)', async () => {
    const long = `${'Semis lead for ten sessions. '.repeat(10)}Watch NVDA first.`;
    const line = await withThesis(long, long);
    expect(line.getAttribute('data-hub-honest-line')).toBe('thesis_saved');
  });

  it('exactly one of the three, and inside the idea\'s card', async () => {
    await withThesis(STATEMENT);
    expect(document.querySelectorAll('[data-hub-honest-line]')).toHaveLength(1);
    expect(panel().querySelector('[data-hub-card="idea"] [data-hub-honest-line]')).not.toBeNull();
  });

  it('no other state says it: not loading, no idea, unavailable, an error, the gate off or a disabled account', async () => {
    const states = [
      () => svc.listHypothesisVersions.mockReturnValue(new Promise(() => {})),
      () => svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 0, versions: [] })),
      () => svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 9 })),
      () => svc.listHypothesisVersions.mockRejectedValue(new Error('offline')),
      () => svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('off'), { code: 'disabled' })),
      () => { r.recordsOn = false; },
    ];
    for (const arrange of states) {
      r.recordsOn = true;
      arrange();
      unmountAll();
      await phoneResearch();
      expect(honest(), statusOf()).toBeNull();
      expect(document.body.textContent).not.toMatch(/names priority/);
    }
  });

  it('only about a list the agent can deploy with: the card unavailable (not among the committed lists) or empty → no line; the idea still shows', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { statement: STATEMENT, status: 'ready' })] }));
    r.lists = [];
    await phoneResearch();
    expect(statusOf()).toBe('ready');
    expect(honest()).toBeNull();
    unmountAll();
    r.lists = [LIST({ tickers: [], thesis: STATEMENT })];
    await phoneResearch();
    expect(statusOf()).toBe('ready');
    expect(honest()).toBeNull();
    // ...and with no list document the wording is not chosen at all.
    unmountAll();
    r.lists = [LIST({ thesis: STATEMENT })];
    await phoneResearch();
    expect(honest()).not.toBeNull();
  });

  it('a later version of the idea turns (a) into (b): the thesis does not follow the idea', async () => {
    r.lists = [LIST({ thesis: STATEMENT })];
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 2, versions: [V(2, { statement: 'A revised idea.' }), V(1, { statement: STATEMENT })] }));
    await phoneResearch();
    expect(honest().getAttribute('data-hub-honest-line')).toBe('thesis_saved');
  });
});

describe('Activity\'s idea rows (ruling R-S6-7)', () => {
  const ready = () => svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'ready' })] }));

  it('the current idea\'s "Idea saved" and its recorded status, among the loadout\'s rows, within the window\'s cutoff', async () => {
    ready();
    await renderHub('desktop');
    expect(activityText()).toContain('Idea saved');
    expect(activityText()).toContain('Idea · Ready');
    expect(activitySection().querySelectorAll('[data-hub-activity-row="idea"]').length).toBe(2);
  });

  it('a refresh that failed takes the idea rows with it (Activity carries no age note for them); the panel keeps its idea with one', async () => {
    ready();
    await renderHub('desktop');
    expect(activitySection().querySelectorAll('[data-hub-activity-row="idea"]').length).toBe(2);
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    expect(activitySection().querySelectorAll('[data-hub-activity-row="idea"]').length).toBe(0);
  });

  it('a revision is not a new idea: four versions, one pair of rows', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 4, versions: [V(4, { status: 'ready' }), V(3), V(2), V(1)] }));
    await renderHub('desktop');
    expect(activitySection().querySelectorAll('[data-hub-activity-row="idea"]').length).toBe(2);
  });

  it('nothing older than the window\'s oldest completed record', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ versions: [V(1, { status: 'ready', createdAt: iso(Date.UTC(2026, 9, 1, 14, 0)), stateChangedAt: iso(T.state) })] }));
    await renderHub('desktop');
    const kinds = [...activitySection().querySelectorAll('[data-hub-activity-row="idea"]')].map((el) => el.closest('button').getAttribute('aria-label'));
    expect(kinds).toHaveLength(1);
    expect(kinds[0]).toContain('Idea · Ready');
  });

  it('no idea row without an idea: no idea, a disabled account, the gate off', async () => {
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 0, versions: [] }));
    await renderHub('desktop');
    expect(activitySection().querySelectorAll('[data-hub-activity-row="idea"]')).toHaveLength(0);
    unmountAll();
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('off'), { code: 'disabled' }));
    await renderHub('desktop');
    expect(activitySection().querySelectorAll('[data-hub-activity-row="idea"]')).toHaveLength(0);
  });

  it('"Nothing recorded yet" waits for the reader: loading while the idea is out, the plain words once it answers', async () => {
    r.window = windowOf([]);
    r.agent = agentReady({ equippedAt: undefined });
    svc.listHypothesisVersions.mockReturnValue(new Promise(() => {}));
    await renderHub('desktop');
    expect(activityText()).toContain(COPY.activity.loading);
    expect(activityText()).not.toContain(COPY.activity.empty);
    unmountAll();
    svc.listHypothesisVersions.mockResolvedValue(BODY({ currentVersion: 0, versions: [] }));
    await renderHub('desktop');
    expect(activityText()).toContain(COPY.activity.empty);
    unmountAll();
    svc.listHypothesisVersions.mockRejectedValue(new Error('offline'));
    await renderHub('desktop');
    expect(activityText()).toContain(COPY.activity.unavailable);
    expect(activityText()).not.toContain(COPY.activity.empty);
  });
});

describe('the reads (ruling R-S6-2): when, and how often, through the whole hub', () => {
  it('mount reads once; the lists service is its own read; a tab switch reads nothing', async () => {
    await renderHub('mobile', { tab: COPY.phoneTabs.research });
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
    expect(svc.listHypothesisVersions).toHaveBeenCalledWith('wl-1');
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    click(byRole(document, 'tab', COPY.phoneTabs.overview)[0]);
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
  });

  it('the watchlist sheet\'s return reads once more, with the equipped id unchanged — a close with a pick races nothing', async () => {
    await renderHub('mobile', { tab: COPY.phoneTabs.loadout });
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
    act(() => { seen.equip.onClose(); });
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
    // Other sheets are not the watchlist sheet\'s return.
    click(byRole(document, 'button', COPY.loadout.changeArchetype)[0]);
    act(() => { seen.archetype.onClose(); });
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
  });

  it('a return while the first read is still out schedules ONE follow-up, not two', async () => {
    let first;
    svc.listHypothesisVersions.mockImplementationOnce(() => new Promise((resolve) => { first = resolve; }));
    await renderHub('mobile', { tab: COPY.phoneTabs.loadout });
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
    click(byRole(document, 'button', COPY.loadout.changeWatchlist)[0]);
    act(() => { seen.equip.onClose(); });
    await flush();
    await act(async () => { first(BODY()); await Promise.resolve(); await Promise.resolve(); });
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
  });

  it('the Forge: its door opens the Lists area and closes any sheet first; coming back is a mount, which reads once', async () => {
    const first = await renderHub('mobile', { hub: hubOf(), tab: COPY.phoneTabs.research });
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
    click(forgeButton());
    expect(first.hub.onOpenForge).toHaveBeenCalledWith({ area: FORGE_AREAS.LISTS, returnTo: FORGE_RETURN.DASHBOARD });
    // App unmounts the hub while the Forge shows and mounts it again on the return.
    unmountAll();
    await renderHub('mobile', { tab: COPY.phoneTabs.research });
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
  });

  it('another owner\'s idea never shows: the account changing clears it and reads for the new one', async () => {
    const { m } = await phoneResearch();
    expect(panelText()).toContain('Idea v1');
    svc.listHypothesisVersions.mockReturnValue(new Promise(() => {}));
    r.identity = { resolved: true, uid: 'uid-B', authEpoch: 3 };
    r.agent = { ...agentReady({ ownerId: 'uid-B' }), ownerUid: 'uid-B', ownerEpoch: 3 };
    act(() => { m.rerender(<CommandCenterHub site="mobile" hub={hubOf()} />); });
    await flush();
    expect(panelText()).not.toContain('Idea v1');
    expect(statusOf()).toBe('loading');
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
  });
});

describe('the first-deployment card under a sheet (R-S6-1, Q-S4-12)', () => {
  it('a hub sheet that opens leaves the card mounted — its hold stays the disabled one — and it is still there when the sheet closes', async () => {
    r.agent = agentReady({ stats: { gamesPlayed: 0 }, equippedWatchlistId: null, equippedWatchlistName: null });
    r.window = windowOf([]);
    await renderHub('desktop');
    const card = () => document.querySelector('[data-hub-next-action="deploy"]');
    expect(card()).not.toBeNull();
    click(byRole(document, 'button', COPY.loadout.changeArchetype)[0]);
    expect(seen.archetype.open).toBe(true);
    expect(document.querySelector('[data-hub="shell"]').hasAttribute('data-hub-modal-open')).toBe(true);
    expect(card()).not.toBeNull();
    expect(byRole(card(), 'button', COPY.deploy.holdLabel)[0].disabled).toBe(true);
    act(() => { seen.archetype.onClose(); });
    await flush();
    expect(card()).not.toBeNull();
  });
});
