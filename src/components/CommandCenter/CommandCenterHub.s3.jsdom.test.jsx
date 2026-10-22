// @vitest-environment jsdom
//
// Command Center hub, slice S3 — the CONNECTED hub: given App's `hub` object
// (rulings R-S3-8 … R-S3-10), the readers' sections replace the loading ones.
// The readers themselves are driven here (the identity, the owner-tagged agent,
// the ten-game window); App's poll arrives through `hub` exactly as App sends
// it. Pinned:
//   - Games: live rows from the same retained poll list the gate reads, in the
//     gate's order; completed rows with §7 outcome words and §6 review lines;
//     desktop ≤ 2 completed, the phone Overview ≤ 3, History the whole window
//     with no read of its own;
//   - opening: a game through App's handleOpenAgentBattle, a tape through the
//     legacy Film Room path, each handed the raw record;
//   - the strip and card show real eligibility; a read's Retry reaches its
//     reader; the hold stays inert (no deploy handler before S2b);
//   - a failed window read is never an empty history;
//   - without `hub` nothing is read.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
const r = vi.hoisted(() => ({
  identity: { resolved: true, uid: 'uid-A', authEpoch: 2 },
  agent: null,
  agentCalls: [],
  window: null,
  windowCalls: 0,
}));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => r.identity }));
vi.mock('../../hooks/useAgent', () => ({
  default: (uid, options) => { r.agentCalls.push([uid, options]); return r.agent; },
}));
vi.mock('./hub/useHubCompletedBattles', () => ({
  default: () => { r.windowCalls += 1; return r.window; },
}));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => ({ state: 'OPEN', isOpen: true }) }));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { DEPLOY_BLOCK_REASON } from '../../utils/commandCenterLiveBattles';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 22, 15, 0);
const UID = 'uid-A';
const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });

const BB = { id: 'bb_live', ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: '2026-10-22T13:30:00Z', expiresAt: '2026-10-22T20:00:00Z', scoreState: { currentScore: 3.1, tradeCount: 1, evaluationCount: 4 } };
const RANKED = { id: 'rk_live', ownerId: UID, agentId: 'agent-a', groupId: 'g1', status: 'active', activatedAt: '2026-10-22T13:31:00Z', expiresAt: '2026-10-22T20:00:00Z', scoreState: { currentScore: 1, tradeCount: 0, evaluationCount: 2 } };
const done = (n, over = {}) => ({
  id: `done_${String(n).padStart(2, '0')}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
  completedAt: `2026-10-${String(21 - n).padStart(2, '0')}T20:05:00.000Z`,
  scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: '2026-10-20T19:58:00.000Z' },
  statusFeed: [{ action: 'battle_complete' }],
  ...over,
});
const TEN = Array.from({ length: 10 }, (_, i) => done(i + 1));

const agentReady = (over = {}) => ({ status: 'ready', agent: { id: 'agent-a', stats: { gamesPlayed: 3 } }, ownerUid: UID, ownerEpoch: 2, readError: null, retry: vi.fn(), ...over });
const windowOf = (battles, over = {}) => ({
  battles, status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1,
  reviews: Object.fromEntries((battles || []).map((b) => [b.id, { state: 'ready', result: READY, nextAt: null }])),
  checking: false, refreshing: false, nextAttemptAt: null, refresh: vi.fn(), ...over,
});
const pollMeta = (over = {}) => ({ epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false, ...over });
const hubOf = (over = {}) => ({
  activeBattles: [],
  activePoll: pollMeta(),
  refreshActiveBattles: vi.fn(),
  openGame: vi.fn(),
  openFilmRoom: vi.fn(),
  ...over,
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
  r.identity = { resolved: true, uid: UID, authEpoch: 2 };
  r.agent = agentReady();
  r.agentCalls = [];
  r.window = windowOf(TEN);
  r.windowCalls = 0;
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  removeNav();
  layout.restore();
  vi.useRealTimers();
});

function render(site, hub, width = site === 'mobile' ? 390 : 1216) {
  layout.state.hubWidth = width;
  const m = mount(<CommandCenterHub site={site} hub={hub} />);
  mounted.push(m);
  return m;
}
const games = () => document.querySelector('[data-hub-section="games"]');
const strip = () => document.querySelector('[data-hub-strip]');
const card = () => document.querySelector('[data-hub-deploy]');
const rowsOf = (scope) => [...scope.querySelectorAll('[data-hub-game-row]')].map((el) => el.closest('button').getAttribute('aria-label'));

describe('Games from the readers (R-S3-8)', () => {
  it('desktop: the live rows in the gate\'s order, then two completed rows with their outcome words and review lines', () => {
    render('desktop', hubOf({ activeBattles: [BB, RANKED] }));
    const labels = rowsOf(games());
    expect(labels).toHaveLength(4);
    expect(labels[0]).toMatch(/^Open live game: Ranked vs League group/);
    expect(labels[1]).toMatch(/^Open live game: BaggerBomb vs CPU/);
    expect(labels[2]).toMatch(/^Open game record: BaggerBomb vs CPU, Won \+11\.0, review available, Oct 20 · \+11\.0 vs \+5\.0$/);
    expect(games().querySelectorAll('[data-hub-review="ready"]')).toHaveLength(2);
    expect(byRole(games(), 'button', COPY.games.history)).toHaveLength(1);
  });

  it('History shows the whole ten-game window, and opening it reads nothing', () => {
    render('desktop', hubOf());
    const refresh = r.window.refresh;
    click(byRole(games(), 'button', COPY.games.history)[0]);
    const sheet = document.querySelector('[data-hub-sheet-overlay]');
    expect(rowsOf(sheet)).toHaveLength(10);
    expect(sheet.querySelectorAll('[data-hub-review]')).toHaveLength(10);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('the phone Overview shows at most three completed rows', () => {
    render('mobile', hubOf());
    const overview = document.querySelector('[data-hub-phone-panel="overview"]');
    expect(rowsOf(overview)).toHaveLength(3);
  });

  it('opening a game hands App the raw record — the poll\'s for a live game, the window\'s for a completed one', () => {
    const hub = hubOf({ activeBattles: [BB] });
    render('desktop', hub);
    const buttons = [...games().querySelectorAll('[data-hub-game-row]')].map((el) => el.closest('button'));
    click(buttons[0]);
    click(buttons[1]);
    expect(hub.openGame.mock.calls.map(([doc]) => doc)).toEqual([BB, TEN[0]]);
  });

  it('Open battle tape: the legacy Film Room path with the raw record, only for a ready review whose target is the Film Room', () => {
    r.window = windowOf(TEN.slice(0, 2), {
      reviews: {
        done_01: { state: 'ready', result: READY, nextAt: null },
        done_02: { state: 'pending', result: { ready: false, target: 'filmRoom', availability: 'pending' }, nextAt: null },
      },
    });
    const hub = hubOf();
    render('desktop', hub);
    const links = byRole(games(), 'button', /^Open battle tape:/);
    expect(links).toHaveLength(1);
    click(links[0]);
    expect(hub.openFilmRoom).toHaveBeenCalledTimes(1);
    expect(hub.openFilmRoom.mock.calls[0][0]).toBe(TEN[0]);
    expect(games().querySelector('[data-hub-review="pending"]').textContent).toBe(COPY.games.review.pending);
  });

  it('a block always has its live row: the strip\'s first line is the live game, Open targets the BaggerBomb game', () => {
    const hub = hubOf({ activeBattles: [RANKED, BB] });
    render('mobile', hub);
    expect(strip().getAttribute('data-hub-strip')).toBe('blocked');
    expect(strip().querySelector('[data-hub-strip-line="1"]').textContent).toMatch(/^Live · /);
    expect(strip().querySelector('[data-hub-strip-line="2"]').textContent).toBe(`Deploy unavailable · ${DEPLOY_BLOCK_REASON}`);
    click(byRole(strip(), 'button', COPY.deploy.openGame)[0]);
    expect(hub.openGame.mock.calls[0][0]).toBe(BB);
  });
});

describe('a failed window read is never an empty history (spec §3)', () => {
  it('nothing retained: the failure with Retry, never "No games yet" — and Retry asks the window', () => {
    r.window = windowOf(null, { status: 'error', error: new Error('failed-precondition'), lastSuccessfulAt: null, generation: 0, nextAttemptAt: NOW + 120000 });
    render('desktop', hubOf());
    expect(games().textContent).toContain(COPY.games.loadFailed);
    expect(games().textContent).not.toContain(COPY.games.empty);
    expect(games().textContent).toContain('next attempt at 11:02 AM ET');
    click(byRole(games(), 'button', COPY.games.retry)[0]);
    expect(r.window.refresh).toHaveBeenCalledTimes(1);
  });

  it('a retained window whose latest read failed: its rows, when they were true, and Retry — still never empty-history copy', () => {
    r.window = windowOf([], { status: 'error', error: new Error('unavailable') });
    render('mobile', hubOf());
    const overview = document.querySelector('[data-hub-phone-panel="overview"]');
    expect(overview.textContent).toMatch(/As of \d{1,2}:\d{2} [AP]M ET · couldn’t refresh/);
    expect(overview.textContent).not.toContain(COPY.games.empty);
  });

  it('a successful empty read is the one time "No games yet" shows', () => {
    r.window = windowOf([]);
    render('desktop', hubOf());
    expect(games().textContent).toContain(COPY.games.empty);
  });
});

describe('real eligibility on the strip and the card (R-S3-9)', () => {
  it('resolved readers leave checking: ready to deploy — and the hold stays inert', () => {
    render('desktop', hubOf());
    expect(card().getAttribute('data-hub-deploy')).toBe('ready');
    const [hold] = byRole(card(), 'button', COPY.deploy.holdLabel);
    expect(hold.disabled).toBe(true);
    for (const m of mounted) m.unmount();
    mounted = [];
    render('mobile', hubOf());
    expect(strip().getAttribute('data-hub-strip')).toBe('ready');
    expect(byRole(strip(), 'button', COPY.deploy.holdLabel)[0].disabled).toBe(true);
  });

  it('the agent read is the owner-tagged one: the identity\'s uid and epoch', () => {
    render('desktop', hubOf());
    expect(r.agentCalls[0]).toEqual([UID, { ownerEpoch: 2 }]);
  });

  it('a first-poll failure: eligibility unavailable, and its Retry is an explicit poll refresh', () => {
    const hub = hubOf({ activePoll: pollMeta({ status: 'error', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null }) });
    render('desktop', hub);
    expect(card().getAttribute('data-hub-deploy')).toBe('eligibility_error');
    click(byRole(card(), 'button', COPY.deploy.retry)[0]);
    expect(hub.refreshActiveBattles).toHaveBeenCalledTimes(1);
  });

  it('an agent read failure: agent unavailable, and its Retry re-subscribes the agent', () => {
    r.agent = agentReady({ status: 'error', agent: null, readError: new Error('permission-denied') });
    const hub = hubOf();
    render('desktop', hub);
    expect(card().getAttribute('data-hub-deploy')).toBe('agent_error');
    click(byRole(card(), 'button', COPY.deploy.retry)[0]);
    expect(r.agent.retry).toHaveBeenCalledTimes(1);
    expect(hub.refreshActiveBattles).not.toHaveBeenCalled();
  });

  it('an explicit refresh reads Refreshing; the background run does not', () => {
    render('desktop', hubOf({ activePoll: pollMeta({ refreshing: true }) }));
    expect(card().querySelector('[data-hub-deploy-note]').textContent).toMatch(/^Refreshing · as of/);
    for (const m of mounted) m.unmount();
    mounted = [];
    render('desktop', hubOf());
    expect(card().querySelector('[data-hub-deploy-note]')).toBeNull();
  });

  it('another identity than the poll\'s: Switching account…, and none of the former owner\'s games', () => {
    r.identity = { resolved: true, uid: 'uid-B', authEpoch: 3 };
    r.agent = agentReady({ ownerUid: 'uid-B', ownerEpoch: 3 });
    r.window = windowOf(null, { status: 'loading', ownerUid: null, ownerEpoch: null });
    render('desktop', hubOf({ activeBattles: [BB] }));
    expect(card().getAttribute('data-hub-deploy')).toBe('account_transition');
    expect(rowsOf(games())).toEqual([]);
  });
});

describe('without `hub`, nothing is read', () => {
  it('the layout path: no reader runs', () => {
    layout.state.hubWidth = 1216;
    mounted.push(mount(<CommandCenterHub site="desktop" />));
    expect(r.agentCalls).toEqual([]);
    expect(r.windowCalls).toBe(0);
    expect(card().getAttribute('data-hub-deploy')).toBe('checking');
  });
});
