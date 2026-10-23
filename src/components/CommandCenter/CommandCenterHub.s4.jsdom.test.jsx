// @vitest-environment jsdom
//
// Command Center hub, slice S4 (rulings R-S4-1 … R-S4-5, R-S4-8; spec V1.2 §8.2, §8.3, §11.3 "Activity/Later", "Copy") — the CONNECTED
// hub's Activity, next action, Later, brief and History Refresh. The readers' I/O is driven here (the identity, the owner-tagged
// agent, the ten-game window, App's poll and the brief's hook); the hub, its Later store (sessionStorage) and its sections are
// the real ones. Pinned:
//   - the next action for a live game, a game waiting for the open, a ready review and the first deployment, each opening what it
//     names through App's handlers; the first-deployment hold is inert until S2b supplies the deploy action;
//   - Later: the item stays dismissed after a remount, the next candidate of the same rule is offered, two Laters both stay, an
//     account change clears them, and storage throwing still works for the mount;
//   - Activity: its rows and words, the sheet behind "All activity · N", and that opening History changes neither rows nor count;
//   - the brief: every caption and state, and Retry; History's Refresh and the next permitted time.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
const r = vi.hoisted(() => ({
  identity: { resolved: true, uid: 'uid-A', authEpoch: 2 },
  agent: null,
  window: null,
  market: { state: 'OPEN', isOpen: true },
  brief: null,
}));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => r.identity }));
vi.mock('../../hooks/useAgent', () => ({ default: () => r.agent }));
vi.mock('./hub/useHubCompletedBattles', () => ({ default: () => r.window }));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => r.market }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({ default: function useDailyRegimeBrief() { return r.brief; } }));

import CommandCenterHub from './CommandCenterHub';
import NextActionCard from './sections/NextActionCard';
import { getCanonicalTextVersion } from '../../data/archetypeAdjustments';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { formatHubDay, formatHubTime } from './hub/hubDate';
import { REVIEW_TRIGGERS } from './hub/reviewScheduler';
import { laterStorageKey } from './hub/useHubLater';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 23, 15, 0);
const UID = 'uid-A';
const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
const PENDING = Object.freeze({ ready: false, target: 'filmRoom', availability: 'pending' });
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3600 * 1000;

const BB = { id: 'bb_live', ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: iso(NOW - 2 * HOUR), expiresAt: iso(NOW + 3 * HOUR), scoreState: { currentScore: 3.1, tradeCount: 1, evaluationCount: 4 } };
const RANKED = { id: 'rk_live', ownerId: UID, agentId: 'agent-a', groupId: 'g1', status: 'active', activatedAt: iso(NOW - 3 * HOUR), expiresAt: iso(NOW + 3 * HOUR), scoreState: { currentScore: 1, tradeCount: 0, evaluationCount: 2 } };
const done = (n, over = {}) => {
  const completed = Date.UTC(2026, 9, 22 - n, 20, 5);
  return {
    id: `done_${String(n).padStart(2, '0')}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
    activatedAt: iso(completed - 6 * HOUR), completedAt: iso(completed),
    scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: iso(completed - 120000) },
    statusFeed: [{ action: 'battle_complete' }],
    ...over,
  };
};
const TEN = Array.from({ length: 10 }, (_, i) => done(i + 1));

const agentReady = (stats = { gamesPlayed: 3 }, over = {}) => ({ status: 'ready', agent: { id: 'agent-a', archetype: 'degen', stats }, ownerUid: UID, ownerEpoch: 2, readError: null, retry: vi.fn(), ...over });
const allReady = (battles) => Object.fromEntries(battles.map((b) => [b.id, { state: 'ready', result: READY, nextAt: null }]));
const windowOf = (battles, over = {}) => ({
  battles, status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1,
  reviews: allReady(battles || []), checking: false, refreshing: false, nextAttemptAt: null, carried: false, refresh: vi.fn(), ...over,
});
const pollMeta = (over = {}) => ({ epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false, ...over });
const hubOf = (over = {}) => ({ activeBattles: [], activePoll: pollMeta(), refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn(), ...over });
const briefOf = (over = {}) => ({
  dailyBrief: 'Heavy macro week, front-loaded into Thursday and Friday.', keyEvents: [], themes: [], forDate: '2026-10-23', generatedAt: { seconds: Math.floor(Date.UTC(2026, 9, 23, 9, 30) / 1000), nanoseconds: 0 },
  isStale: false, loading: false, error: null, refetch: vi.fn(), ...over,
});

let layout;
let removeTokens;
let removeNav;
let mounted = [];

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  sessionStorage.clear();
  r.identity = { resolved: true, uid: UID, authEpoch: 2 };
  r.agent = agentReady();
  r.window = windowOf(TEN);
  r.market = { state: 'OPEN', isOpen: true };
  r.brief = briefOf();
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  sessionStorage.clear();
  removeNav();
  layout.restore();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function render(site, hub, width = site === 'mobile' ? 390 : 1216) {
  layout.state.hubWidth = width;
  const m = mount(<CommandCenterHub site={site} hub={hub} />);
  mounted.push(m);
  return m;
}
const nextCard = () => document.querySelector('[data-hub-next-action]');
const nextKind = () => nextCard()?.getAttribute('data-hub-next-action') ?? null;
const nextText = () => nextCard()?.textContent ?? '';
const later = () => byRole(nextCard(), 'button', COPY.nextAction.later)[0];
const activitySection = () => document.querySelector('[data-hub-section="activity"]');
const activityLabels = (scope = activitySection()) => [...scope.querySelectorAll('[data-hub-activity-row]')].map((el) => el.closest('button').getAttribute('aria-label'));
const briefSection = () => document.querySelector('[data-hub-section="brief"]');
const overview = () => document.querySelector('[data-hub-phone-panel="overview"]');
const dialog = () => document.querySelector('[role="dialog"]');
const stored = () => JSON.parse(sessionStorage.getItem(laterStorageKey(UID)) || 'null');
const closeSheet = () => click(byRole(dialog(), 'button', COPY.sheet.close)[0]);
const set = (hub, ...rest) => ({ ...hub, ...rest[0] });

describe('the next action (R-S4-2)', () => {
  it('a live game: the card names it, and Open game opens the poll\'s own record', () => {
    const hub = hubOf({ activeBattles: [BB] });
    render('desktop', hub);
    expect(nextKind()).toBe('openGame');
    expect(nextText()).toContain(COPY.nextAction.liveTitle);
    expect(nextText()).toMatch(/BaggerBomb vs CPU · \d+h \d+m left/);
    click(byRole(nextCard(), 'button', COPY.nextAction.openGame)[0]);
    expect(hub.openGame).toHaveBeenCalledTimes(1);
    expect(hub.openGame.mock.calls[0][0]).toBe(BB);
    expect(document.querySelector('[data-hub-slot="next"]').style.display).toBe('block');
  });

  it('two live games: the ranked game first (sortLiveBattles); the phone Overview lists the other, not the card\'s game twice', () => {
    const hub = hubOf({ activeBattles: [BB, RANKED] });
    render('mobile', hub);
    expect(nextText()).toContain('Ranked vs League group');
    const liveRows = [...overview().querySelectorAll('[data-hub-game-row="live"]')].map((el) => el.closest('button').getAttribute('aria-label'));
    expect(liveRows).toHaveLength(1);
    expect(liveRows[0]).toMatch(/^Open live game: BaggerBomb vs CPU/);
  });

  it('a game that has not opened yet says it is deployed and waiting for the open (spec §8.2)', () => {
    r.market = { state: 'CLOSED_AFTERHOURS', isOpen: false };
    const fresh = { ...BB, scoreState: { currentScore: 0, tradeCount: 0, evaluationCount: 0, lastScoredAt: null } };
    render('desktop', hubOf({ activeBattles: [fresh] }));
    expect(nextText()).toContain(COPY.nextAction.preOpenTitle);
    expect(nextText()).toContain(COPY.games.waitingForOpen);
    expect(nextText()).not.toContain(COPY.nextAction.liveTitle);
  });

  it('a ready review: the newest game, and Open Film Room opens its tape through the legacy Film Room path with the raw record', () => {
    const hub = hubOf();
    render('desktop', hub);
    expect(nextKind()).toBe('review');
    expect(nextText()).toContain(COPY.nextAction.reviewTitle(formatHubDay(Date.parse(TEN[0].completedAt))));
    click(byRole(nextCard(), 'button', COPY.nextAction.openReview)[0]);
    expect(hub.openFilmRoom).toHaveBeenCalledTimes(1);
    expect(hub.openFilmRoom.mock.calls[0][0]).toBe(TEN[0]);
    expect(hub.openGame).not.toHaveBeenCalled();
  });

  it('a pending, unavailable or still-queued review is never offered: no card at all', () => {
    r.window = windowOf(TEN.slice(0, 3), { reviews: {
      done_01: { state: 'pending', result: PENDING, nextAt: null },
      done_02: { state: 'queued', result: null, nextAt: NOW + 60000 },
      done_03: { state: 'unavailable', result: { ready: false, target: 'filmRoom', availability: 'unavailable' }, nextAt: null },
    } });
    render('desktop', hubOf());
    expect(nextCard()).toBeNull();
    expect(document.querySelector('[data-hub-slot="next"]').style.display).toBe('none');
  });

  it('a live game wins over a ready review', () => {
    render('desktop', hubOf({ activeBattles: [BB] }));
    expect(nextKind()).toBe('openGame');
  });

  it('the phone Overview shows the card first, and nothing is listed twice', () => {
    render('mobile', hubOf());
    expect(nextKind()).toBe('review');
    expect(overview().firstElementChild.contains(nextCard()) || overview().contains(nextCard())).toBe(true);
    const reviewRows = [...overview().querySelectorAll('[data-hub-game]')].map((el) => el.getAttribute('data-hub-game'));
    expect(reviewRows).not.toContain('done_01');
  });
});

describe('the first deployment (spec §3.1; R-S4-2, R-S4-8)', () => {
  const firstTime = (over = {}) => {
    r.agent = agentReady({ gamesPlayed: 0 }, over.agent);
    r.window = windowOf([], over.window);
  };

  it('a ready, empty completed read, no live game, gamesPlayed 0 and canStart: the card, carrying the hold', () => {
    firstTime();
    render('desktop', hubOf());
    expect(nextKind()).toBe('deploy');
    expect(nextText()).toContain(COPY.nextAction.firstTitle);
    expect(byRole(nextCard(), 'button', COPY.deploy.holdLabel)).toHaveLength(1);
    expect(nextCard().textContent).toContain(COPY.deploy.hold);
  });

  it('the hold is inert until S2b supplies the deploy action: disabled, and completing it deploys nothing — the same as the strip\'s', () => {
    firstTime();
    const hub = hubOf();
    render('desktop', hub);
    const [hold] = byRole(nextCard(), 'button', COPY.deploy.holdLabel);
    expect(hold.disabled).toBe(true);
    expect(byRole(document.querySelector('[data-hub-deploy]'), 'button', COPY.deploy.holdLabel)[0].disabled).toBe(true);
    // The phone's strip, the same state:
    unmountAll();
    render('mobile', hub);
    expect(byRole(document.querySelector('[data-hub-strip]'), 'button', COPY.deploy.holdLabel)[0].disabled).toBe(true);
    expect(byRole(nextCard(), 'button', COPY.deploy.holdLabel)[0].disabled).toBe(true);
  });

  it('the hold takes the deploy action and nothing else: the card\'s onAct never reaches it, its onDeploy does (R-S4-8)', () => {
    const candidate = { status: 'ready', candidate: { key: 'deploy', id: null, title: 'T', why: 'W', cta: 'Deploy' } };
    const deploy = { displayState: 'ready', canStart: true, gateBlocked: false, freshness: { asOf: NOW, stale: false, refreshing: false }, retryAction: null, reason: null, action: null, recovered: false, battleId: null, cooldownUntil: null, holdControlId: null, retryBlock: null };
    const onAct = vi.fn();
    const onDeploy = vi.fn();
    const m = mount(<NextActionCard nextAction={candidate} deploy={deploy} onAct={onAct} />);
    mounted.push(m);
    const [withActOnly] = byRole(document.body, 'button', COPY.deploy.holdLabel);
    expect(withActOnly.disabled, 'a handler for opening things is not a handler for deploying').toBe(true);
    m.rerender(<NextActionCard nextAction={candidate} deploy={deploy} onAct={onAct} onDeploy={onDeploy} />);
    expect(byRole(document.body, 'button', COPY.deploy.holdLabel)[0].disabled).toBe(false);
    expect(onAct).not.toHaveBeenCalled();
  });

  it.each([
    ['the agent has played', () => { r.agent = agentReady({ gamesPlayed: 4 }); r.window = windowOf([]); }],
    ['no recorded gamesPlayed (a missing score is no first-game fact)', () => { r.agent = agentReady({}); r.window = windowOf([]); }],
    ['a recorded gamesPlayed that is not a number', () => { r.agent = agentReady({ gamesPlayed: '0' }); r.window = windowOf([]); }],
    ['the completed read has games', () => { r.agent = agentReady({ gamesPlayed: 0 }); r.window = windowOf([done(1)], { reviews: {} }); }],
    ['the completed read has not answered', () => { r.agent = agentReady({ gamesPlayed: 0 }); r.window = windowOf(null, { status: 'loading', lastSuccessfulAt: null, generation: 0 }); }],
    ['the completed read failed and nothing is retained', () => { r.agent = agentReady({ gamesPlayed: 0 }); r.window = windowOf(null, { status: 'error', error: new Error('x'), lastSuccessfulAt: null, generation: 0 }); }],
    ['an empty window whose latest read failed (a failure is never an empty history)', () => { r.agent = agentReady({ gamesPlayed: 0 }); r.window = windowOf([], { status: 'error', error: new Error('x') }); }],
    ['the agent has not answered', () => { r.agent = agentReady({ gamesPlayed: 0 }, { status: 'loading', agent: null }); r.window = windowOf([]); }],
    ['the agent read failed', () => { r.agent = agentReady({ gamesPlayed: 0 }, { status: 'error', agent: null, readError: new Error('x') }); r.window = windowOf([]); }],
  ])('not offered when %s', (_, arrange) => {
    arrange();
    render('desktop', hubOf());
    expect(nextCard()).toBeNull();
  });

  it('not offered with a live game (the live game is the card)', () => {
    firstTime();
    render('desktop', hubOf({ activeBattles: [BB] }));
    expect(nextKind()).toBe('openGame');
  });

  it('not offered when deployment cannot start (the poll failed with nothing retained)', () => {
    firstTime();
    render('desktop', hubOf({ activePoll: pollMeta({ status: 'error', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null }) }));
    expect(nextCard()).toBeNull();
  });

  it('a window kept from an earlier visit (empty, "as of" its read) counts, as Games shows the same empty history; one whose refresh failed does not', () => {
    firstTime({ window: { carried: true } });
    render('desktop', hubOf());
    expect(nextKind()).toBe('deploy');
    unmountAll();
    firstTime({ window: { carried: true, status: 'error', error: new Error('x') } });
    render('desktop', hubOf());
    expect(nextCard()).toBeNull();
  });
});

function unmountAll() {
  for (const m of mounted) m.unmount();
  mounted = [];
}

describe('Later (R-S4-3; IR-12)', () => {
  // These rows are about one live game and no other candidate, so the window holds no ready review unless a row says so.
  beforeEach(() => { r.window = windowOf([]); });

  it('the card goes; its key is the action and the record, stored under cc.later.{uid}', () => {
    render('desktop', hubOf({ activeBattles: [BB] }));
    click(later());
    expect(nextCard()).toBeNull();
    expect(stored()).toEqual(['openGame:bb_live']);
  });

  it('a review\'s key is review:{id}; the first deployment\'s is deploy:first', () => {
    r.window = windowOf(TEN);
    render('desktop', hubOf());
    click(later());
    expect(stored()).toEqual(['review:done_01']);
    unmountAll();
    sessionStorage.clear();
    r.agent = agentReady({ gamesPlayed: 0 });
    r.window = windowOf([]);
    render('desktop', hubOf());
    click(later());
    expect(stored()).toEqual(['deploy:first']);
    expect(nextCard()).toBeNull();
  });

  it('the item stays dismissed after a remount (a trip to the Film Room and back, a site switch)', () => {
    const hub = hubOf({ activeBattles: [BB] });
    render('desktop', hub);
    click(later());
    unmountAll();
    render('desktop', hub);
    expect(nextCard()).toBeNull();
    unmountAll();
    render('mobile', hub);
    expect(nextCard()).toBeNull();
  });

  it('with two live games, Later on the first offers the second; then the next rule', () => {
    r.window = windowOf(TEN);
    const hub = hubOf({ activeBattles: [BB, RANKED] });
    render('desktop', hub);
    expect(nextText()).toContain('Ranked vs League group');
    click(later());
    expect(nextKind()).toBe('openGame');
    expect(nextText()).toContain('BaggerBomb vs CPU');
    expect(nextText()).not.toContain('Ranked vs League group');
    click(later());
    expect(nextKind()).toBe('review');
    expect(nextText()).toContain(COPY.nextAction.reviewTitle(formatHubDay(Date.parse(TEN[0].completedAt))));
  });

  it('two Laters both stay, across a remount', () => {
    r.window = windowOf(TEN);
    const hub = hubOf({ activeBattles: [BB, RANKED] });
    render('desktop', hub);
    click(later());
    click(later());
    expect(stored().sort()).toEqual(['openGame:bb_live', 'openGame:rk_live']);
    unmountAll();
    render('desktop', hub);
    expect(nextKind()).toBe('review');
    expect(stored().sort()).toEqual(['openGame:bb_live', 'openGame:rk_live']);
  });

  it('a review set aside offers the next newest; a new game is not hidden by an old Later', () => {
    r.window = windowOf(TEN);
    const hub = hubOf();
    render('desktop', hub);
    click(later());
    expect(nextText()).toContain(COPY.nextAction.reviewTitle(formatHubDay(Date.parse(TEN[1].completedAt))));
    unmountAll();
    render('desktop', set(hub, { activeBattles: [{ ...BB, id: 'bb_next' }] }));
    expect(nextKind()).toBe('openGame');
  });

  it('an account change clears them: the next hub, for another account, finds none (and drops the former one\'s key)', () => {
    const hub = hubOf({ activeBattles: [BB] });
    render('desktop', hub);
    click(later());
    unmountAll();
    r.identity = { resolved: true, uid: 'uid-B', authEpoch: 3 };
    r.agent = agentReady({ gamesPlayed: 3 }, { ownerUid: 'uid-B', ownerEpoch: 3 });
    r.window = windowOf(TEN.map((d) => ({ ...d, ownerId: 'uid-B' })), { ownerUid: 'uid-B', ownerEpoch: 3 });
    const bb = { ...BB, ownerId: 'uid-B' };
    render('desktop', hubOf({ activeBattles: [bb], activePoll: pollMeta({ epoch: 3, ownerUid: 'uid-B', ownerEpoch: 3 }) }));
    expect(nextKind()).toBe('openGame');
    expect(sessionStorage.getItem(laterStorageKey('uid-A'))).toBeNull();
  });

  it('storage throwing still works for the mount: the card goes and stays gone until the hub is left', () => {
    const denied = () => { throw new Error('SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'key').mockImplementation(denied);
    const hub = hubOf({ activeBattles: [BB] });
    expect(() => render('desktop', hub)).not.toThrow();
    expect(nextKind()).toBe('openGame');
    click(later());
    expect(nextCard()).toBeNull();
  });

  it('the phone card has its Later too', () => {
    render('mobile', hubOf({ activeBattles: [BB] }));
    click(later());
    expect(nextCard()).toBeNull();
    expect(stored()).toEqual(['openGame:bb_live']);
  });
});

describe('Recent activity (R-S4-1)', () => {
  const THREE = [done(1), done(2), done(3)];
  const withThree = () => { r.window = windowOf(THREE); };

  it('the heading is the spec\'s, and the rows are newest first with the kinds\' own words and absolute ET times', () => {
    withThree();
    render('desktop', hubOf({ activeBattles: [BB] }));
    expect(activitySection().textContent).toContain('Recent activity · your last 10 games and current loadout');
    const labels = activityLabels();
    expect(labels[0]).toMatch(/^Deployed: BaggerBomb vs CPU, Oct 23, 9:00\s?AM ET$/);
    expect(labels[1]).toMatch(/^Game completed: vs CPU · Won \+11\.0, Oct 21, 4:05\s?PM ET$/);
    expect(labels).toHaveLength(1 + 3 + 2);
  });

  it('a row for a game opens that game, the poll\'s record for a live one and the window\'s for a completed one; a loadout row opens nothing', () => {
    withThree();
    r.agent = agentReady({ gamesPlayed: 3 });
    r.agent.agent.equippedWatchlistId = 'wl_hb';
    r.agent.agent.equippedWatchlistName = 'High-Beta Ten';
    r.agent.agent.equippedAt = iso(Date.UTC(2026, 9, 21, 22, 5));
    const hub = hubOf({ activeBattles: [BB] });
    render('desktop', hub);
    const buttons = [...activitySection().querySelectorAll('[data-hub-activity-row]')].map((el) => el.closest('button'));
    const kinds = [...activitySection().querySelectorAll('[data-hub-activity-row]')].map((el) => el.getAttribute('data-hub-activity-row'));
    const live = buttons[kinds.indexOf('deployed')];
    click(live);
    expect(hub.openGame.mock.calls[0][0]).toBe(BB);
    const completed = buttons[kinds.indexOf('completed')];
    click(completed);
    expect(hub.openGame.mock.calls[1][0]).toBe(THREE[0]);
    const loadout = buttons[kinds.indexOf('loadout')];
    expect(loadout.disabled).toBe(true);
    expect(loadout.getAttribute('aria-label')).toContain(COPY.activity.watchlistEquipped('Oct 21'));
  });

  it('the watchlist row exists only where an equip time is recorded, and a re-equip replaces it', () => {
    withThree();
    const agent = agentReady({ gamesPlayed: 3 });
    agent.agent.equippedWatchlistId = 'wl_hb';
    agent.agent.equippedWatchlistName = 'High-Beta Ten';
    r.agent = agent;
    const m = render('desktop', hubOf());
    expect(activityLabels().some((l) => l.startsWith('Watchlist equipped'))).toBe(false);
    agent.agent.equippedAt = iso(Date.UTC(2026, 9, 21, 22, 5));
    m.rerender(<CommandCenterHub site="desktop" hub={hubOf()} />);
    expect(activityLabels().filter((l) => l.startsWith('Watchlist equipped'))).toHaveLength(1);
    agent.agent.equippedAt = iso(Date.UTC(2026, 9, 22, 22, 5));
    m.rerender(<CommandCenterHub site="desktop" hub={hubOf()} />);
    const rows = activityLabels().filter((l) => l.startsWith('Watchlist equipped'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('since Oct 22');
  });

  it('an adjustment row: an accepted standing lean at its recorded equip time, never its raw id', () => {
    withThree();
    const agent = agentReady({ gamesPlayed: 3 });
    agent.agent.standingLeans = [{ adjustmentId: 'SP-01', version: getCanonicalTextVersion('degen', 'SP-01'), equippedAt: iso(Date.UTC(2026, 9, 21, 23, 30)) }];
    r.agent = agent;
    render('desktop', hubOf());
    const row = activityLabels().find((l) => l.startsWith('Adjustment equipped'));
    expect(row).toContain('since Oct 21');
    expect(row).not.toContain('SP-01');
  });

  it('the optimistic entry is kept out until the server document replaces it', () => {
    withThree();
    const optimistic = { ...BB, localOrigin: true };
    const m = render('desktop', hubOf({ activeBattles: [optimistic] }));
    const todays = () => activityLabels().filter((l) => l.startsWith('Deployed') && l.includes('Oct 23'));
    expect(todays()).toEqual([]);
    expect(nextKind(), 'the game is live for the player all the same').toBe('openGame');
    m.rerender(<CommandCenterHub site="desktop" hub={hubOf({ activeBattles: [BB] })} />);
    expect(todays()).toHaveLength(1);
  });

  it('loading until the window reads; a failed first read says so (Games carries the Retry), never "Nothing recorded yet"', () => {
    r.window = windowOf(null, { status: 'loading', lastSuccessfulAt: null, generation: 0 });
    render('desktop', hubOf());
    expect(activitySection().textContent).toContain(COPY.activity.loading);
    unmountAll();
    r.window = windowOf(null, { status: 'error', error: new Error('x'), lastSuccessfulAt: null, generation: 0 });
    render('desktop', hubOf());
    expect(activitySection().textContent).toContain(COPY.activity.unavailable);
    expect(activitySection().textContent).not.toContain(COPY.activity.empty);
  });

  it('a read, empty window with no loadout record says there is nothing recorded yet', () => {
    r.window = windowOf([]);
    render('desktop', hubOf());
    expect(activitySection().textContent).toContain(COPY.activity.empty);
  });

  it('no learning, growth or "since your last visit" claim anywhere in it', () => {
    render('desktop', hubOf({ activeBattles: [BB] }));
    expect(activitySection().textContent).not.toMatch(/learn|improv|grow|since your last visit|intelligen/i);
  });

  it('the side column shows ten rows and links to the rest; the phone shows three; both link "All activity · N" with the projection\'s own count', () => {
    render('desktop', hubOf({ activeBattles: [BB] }));
    const total = activityLabels().length;
    expect(total).toBe(10);
    const [all] = byRole(activitySection(), 'button', /^All activity · \d+$/);
    const n = Number(/(\d+)$/.exec(all.textContent)[1]);
    expect(n).toBeGreaterThan(10);
    unmountAll();
    render('mobile', hubOf({ activeBattles: [BB] }));
    expect(activityLabels(overview())).toHaveLength(3);
    expect(byRole(overview(), 'button', COPY.activity.all(n))).toHaveLength(1);
  });

  it('"All activity · N" opens the activity sheet with all N rows, in the overlay stack (the background goes inert); Close returns focus', () => {
    render('desktop', hubOf({ activeBattles: [BB] }));
    const [all] = byRole(activitySection(), 'button', /^All activity · \d+$/);
    const n = Number(/(\d+)$/.exec(all.textContent)[1]);
    click(all);
    expect(dialog()).not.toBeNull();
    expect(dialog().getAttribute('aria-label') ?? dialog().textContent).toContain(COPY.activity.sheetLabel);
    expect(activityLabels(dialog())).toHaveLength(n);
    expect(dialog().textContent).toContain(COPY.activity.sheetEyebrow(n));
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('[inert]'), 'the overlay stack made the background inert').not.toBeNull();
    closeSheet();
    expect(dialog()).toBeNull();
  });

  it('a row in the sheet opens its game just as the section\'s does', () => {
    render('desktop', hubOf({ activeBattles: [BB] }));
    const hub = hubOf({ activeBattles: [BB] });
    unmountAll();
    render('desktop', hub);
    click(byRole(activitySection(), 'button', /^All activity · \d+$/)[0]);
    const completed = [...dialog().querySelectorAll('[data-hub-activity-row="completed"]')][0].closest('button');
    click(completed);
    expect(hub.openGame.mock.calls[0][0]).toBe(TEN[0]);
  });

  it('opening History changes neither the rows nor the count — behind the sheet or after it', () => {
    const hub = hubOf({ activeBattles: [BB] });
    render('desktop', hub);
    const before = { text: activitySection().textContent, labels: activityLabels() };
    click(byRole(document.querySelector('[data-hub-section="games"]'), 'button', COPY.games.history)[0]);
    expect(dialog()).not.toBeNull();
    expect(activitySection().textContent).toBe(before.text);
    expect(activityLabels()).toEqual(before.labels);
    expect(r.window.refresh).not.toHaveBeenCalled();
    closeSheet();
    expect(activitySection().textContent).toBe(before.text);
    // ...and on the phone, where the count is the link's:
    unmountAll();
    render('mobile', hub);
    const link = byRole(overview(), 'button', /^All activity · \d+$/)[0].textContent;
    const rows = activityLabels(overview());
    click(byRole(overview(), 'button', COPY.history.rowLabel(10))[0]);
    closeSheet();
    expect(byRole(overview(), 'button', /^All activity · \d+$/)[0].textContent).toBe(link);
    expect(activityLabels(overview())).toEqual(rows);
  });

  it('a window whose read failed after a success keeps the rows it holds (the stale note is Games\')', () => {
    r.window = windowOf(TEN, { status: 'error', error: new Error('x') });
    render('desktop', hubOf());
    expect(activityLabels().length).toBeGreaterThan(0);
  });
});

describe('the Daily Regime Brief (R-S4-4)', () => {
  const GEN = `Generated ${formatHubTime(Date.UTC(2026, 9, 23, 9, 30))} ET`;

  it.each(['desktop', 'mobile'])('%s: the body with More / Less, and the caption of the brief\'s own record', (site) => {
    render(site, hubOf());
    const section = briefSection();
    expect(section.textContent).toContain(`Brief for Fri Oct 23${COPY.sep}${GEN}`);
    const toggle = () => byRole(section, 'button').find((b) => b.hasAttribute('aria-expanded'));
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    if (site === 'mobile') expect(section.textContent).not.toContain('Heavy macro week');
    click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(section.textContent).toContain('Heavy macro week, front-loaded into Thursday and Friday.');
    if (site === 'desktop') expect(toggle().textContent).toBe(COPY.brief.less);
    click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('a stale brief: "Last session\'s brief · for {date}"', () => {
    r.brief = briefOf({ forDate: '2026-10-20', isStale: true });
    render('desktop', hubOf());
    expect(briefSection().textContent).toContain(`Last session's brief · for Tue Oct 20${COPY.sep}${GEN}`);
    expect(briefSection().textContent).not.toContain('Brief for');
  });

  it('no generatedAt returned: no "Generated" at all — the fetch time is never a publication time', () => {
    r.brief = briefOf({ generatedAt: null });
    render('desktop', hubOf());
    expect(briefSection().textContent).toContain('Brief for Fri Oct 23');
    expect(briefSection().textContent).not.toContain('Generated');
  });

  it('missing: "No brief available", and no More / Less to press', () => {
    r.brief = briefOf({ dailyBrief: null, forDate: null, generatedAt: null });
    render('desktop', hubOf());
    expect(briefSection().textContent).toContain(COPY.brief.missing);
    expect(byRole(briefSection(), 'button', COPY.brief.more)).toHaveLength(0);
    expect(briefSection().textContent).not.toContain(COPY.brief.loading);
  });

  it.each(['desktop', 'mobile'])('%s: failed — "Couldn\'t load the brief · Retry", and Retry reads it again through the hook\'s own refetch, with no argument', (site) => {
    const refetch = vi.fn();
    r.brief = briefOf({ dailyBrief: null, error: 'unavailable', refetch });
    render(site, hubOf());
    expect(briefSection().textContent).toContain(COPY.brief.failed);
    expect(briefSection().textContent).not.toContain(COPY.brief.missing);
    click(byRole(briefSection(), 'button', COPY.brief.retry)[0]);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch.mock.calls[0]).toEqual([]);
  });

  it('loading: the wait, with the inert More / Less of S1', () => {
    r.brief = briefOf({ loading: true, dailyBrief: null });
    render('desktop', hubOf());
    expect(briefSection().textContent).toContain(COPY.brief.loading);
    expect(byRole(briefSection(), 'button', COPY.brief.more)[0].disabled).toBe(true);
  });

  it('a sources count is never drawn', () => {
    r.brief = briefOf({ sourceFailures: ['a', 'b'] });
    render('desktop', hubOf());
    expect(briefSection().textContent).not.toMatch(/sources?\s*·?\s*\d/i);
  });
});

describe('History\'s Refresh (R-S4-5; founder ruling Q-S3-6)', () => {
  const openHistory = (site = 'desktop') => {
    if (site === 'desktop') click(byRole(document.querySelector('[data-hub-section="games"]'), 'button', COPY.games.history)[0]);
    else click(byRole(overview(), 'button', COPY.history.rowLabel(10))[0]);
  };

  it('a Refresh asks the window for a read with the history trigger — and reads nothing itself', () => {
    render('desktop', hubOf());
    openHistory();
    click(byRole(dialog(), 'button', COPY.history.refresh)[0]);
    expect(r.window.refresh).toHaveBeenCalledTimes(1);
    expect(r.window.refresh).toHaveBeenCalledWith(REVIEW_TRIGGERS.HISTORY);
    expect(REVIEW_TRIGGERS.HISTORY).toBe('history');
  });

  it('the phone\'s History sheet has it too', () => {
    render('mobile', hubOf());
    openHistory('mobile');
    click(byRole(dialog(), 'button', COPY.history.refresh)[0]);
    expect(r.window.refresh).toHaveBeenCalledWith(REVIEW_TRIGGERS.HISTORY);
  });

  it('a read in flight: "Refreshing…", and no second control for it', () => {
    r.window = windowOf(TEN, { refreshing: true, checking: true });
    render('desktop', hubOf());
    openHistory();
    expect(dialog().textContent).toContain(COPY.history.refreshing);
    expect(byRole(dialog(), 'button', COPY.history.refresh)).toHaveLength(0);
  });

  it('a read that is queued shows the next permitted time instead of a button that would read', () => {
    r.window = windowOf(TEN, { nextAttemptAt: NOW + 90000 });
    render('desktop', hubOf());
    openHistory();
    const at = formatHubTime(NOW + 90000, { roundUp: true });
    expect(dialog().textContent).toContain(COPY.history.nextRefresh(COPY.time.et(at)));
    expect(byRole(dialog(), 'button', COPY.history.refresh)).toHaveLength(0);
    expect(r.window.refresh).not.toHaveBeenCalled();
  });

  it('a stale window has its note\'s Retry and a kept one its next read: no second control beside them', () => {
    r.window = windowOf(TEN, { status: 'error', error: new Error('x') });
    render('desktop', hubOf());
    openHistory();
    expect(byRole(dialog(), 'button', COPY.history.refresh)).toHaveLength(0);
    expect(byRole(dialog(), 'button', COPY.games.retry)).toHaveLength(1);
    closeSheet();
    unmountAll();
    r.window = windowOf(TEN, { carried: true, nextAttemptAt: NOW + 60000 });
    render('desktop', hubOf());
    openHistory();
    expect(byRole(dialog(), 'button', COPY.history.refresh)).toHaveLength(0);
  });

  it('nothing to refresh before the first read', () => {
    r.window = windowOf(null, { status: 'loading', lastSuccessfulAt: null, generation: 0 });
    render('desktop', hubOf());
    expect(dialog()).toBeNull();
  });
});
